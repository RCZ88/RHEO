# CONTEXT BUNDLE — Project Migration (NTFS mount → Linux native dir)

Target AI: read this file first. It is the source of truth for paths, configs, and code facts gathered 2026-09-10 from the live repo. Verify each claim against the repo before planning (paths below are absolute as observed).

## 1. Current location (SOURCE)

```
/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker
```

- This is a Windows NTFS partition mounted on Linux. Evidence of lag: `git status --short --branch` run on this mount **timed out after 180s** (2026-09-10). Any migration plan must avoid running git/npm on the old mount and do all operations on the Linux side.
- Project folder name contains a **space** (`App Tracker`). Per `agent/COMMON_ERRORS_FIXED.md:124`: "The **space in the project path** (`App Tracker`) is a second landmine that breaks node-gyp." Consider renaming (e.g. `app-tracker`) as part of the move.

## 2. Git facts (from `.git/config`, read directly — no git command was runnable)

```ini
[core]
	repositoryformatversion = 0
	filemode = false
	bare = false
	logallrefupdates = true
	symlinks = false
	ignorecase = true
[remote "origin"]
	url = https://github.com/RCZ88/RHEO.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[http]
	postBuffer = 524288000
[branch "master"]
	remote = origin
	merge = refs/heads/master
```

- Branch: `master`, remote `https://github.com/RCZ88/RHEO.git`.
- **Destructive-command blocking aliases** live in `.git/config` (`agent` profile rule: NEVER run destructive git commands without explicit permission — a past `git reset --hard` wiped the working tree and lost 8 files permanently):
```ini
[alias]
	reset = !echo BLOCKED: git reset is disabled. Use 'git reset --soft HEAD~1' instead. && exit 1
	clean = !echo BLOCKED: git clean is disabled. Use 'git clean -fdn' for dry run. && exit 1
	push = !echo BLOCKED: git push is disabled. Use 'git push --force-with-lease' instead. && exit 1
	branch = !echo BLOCKED: git branch is disabled. Use 'git branch -d' instead. && exit 1
	checkout = !echo BLOCKED: git checkout is disabled. Use 'git stash push' to save changes. && exit 1
	stash = !echo BLOCKED: git stash is disabled. Use 'git stash pop' instead. && exit 1
```
- These aliases live in `.git/` → they travel with a **file-copy** migration but are **lost** with a `git clone` migration and must be re-applied. Same for `http.postBuffer`.
- `core.symlinks=false`, `core.filemode=false`, `core.ignorecase=true` are **Windows/NTFS settings** — wrong for a Linux ext4 target and should be reset (`symlinks=true`, `filemode=true`, `ignorecase=false`) after the move.
- Untracked-but-essential files (per `.gitignore`): `.env` (gitignored, contains `TWENTY_FIRST_API_KEY`), `*.db`, `node_modules/`, `dist*/`, `release/`. A clone migration must manually carry over `.env` and the user-data DB (see §5). `.gitignore` also ignores `*.env`, `credentials.json`, `secrets.json`.

## 3. Build/config path handling (actual source — already dynamic ✅)

`scripts/build.mjs` (lines 33-35) — portable, keep as the pattern:
```js
const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'src');
const OUT = resolve(ROOT, 'dist-electron');
```
- Lock file: `resolve(import.meta.dirname, '..', '.build-lock')` (§7). All `execSync` use `{ cwd: ROOT }`.

`scripts/mcp-launcher.mjs` (lines 6-10) — portable:
```js
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
// .env loaded from resolve(projectRoot, '.env')
```

`vite.config.ts` (lines 7-16) — portable:
```ts
const __dirname = path.dirname(fileURLToPath(import.meta.url))
'@': path.resolve(__dirname, 'src'),
```

`electron.vite.config.ts` — all relative (`outDir: 'dist-electron'`, `entry: 'src/main.ts'`, `input: 'index.html'`). External natives: `better-sqlite3, active-win, node-pty, ...`.

`package.json` — `build.directories.output: "release"`, `files: ["dist/**/*", "dist-electron/**/*"]`, scripts: `build: node scripts/build.mjs`, `dist: npm run build && electron-builder --win`. All relative ✅.

## 4. Known hardcoded / platform-coupled code (must be made dynamic)

| # | Location | Problem |
|---|----------|---------|
| 1 | `opencode.json:22-29` | `probe` MCP command is `["node", "../probe/dist/index.js"]` — **relative path to a sibling directory OUTSIDE the repo**. Per project docs, `probe` lives at `C:/Users/cleme/Documents/COMPUTAH_SAYENCE/probe/` (standalone repo, must be built separately). Moving only App Tracker breaks this. Plan must relocate/rebuild probe on the Linux side too, or re-point the command. |
| 2 | `opencode.json:14-20,37-39` | Contains **live secrets** (`x-api-key`, `NOTION_API_TOKEN`). Must never be committed; verify git-tracking status (`git ls-files opencode.json`) and carry over securely, not via the public remote. |
| 3 | `check-db.js:6`, `check-tables.cjs:5`, `list-tables.cjs:5`, `test-ipc.cjs:4` | `process.env.APPDATA \|\| path.join(os.homedir(), 'AppData', 'Roaming')` — **Windows-only fallback**; on Linux `APPDATA` is unset so it resolves to a nonexistent `~/AppData/Roaming`. Must branch on `process.platform` (`~/.config/<app>` on Linux). |
| 4 | `migrate-fixed.mjs:8-15`, `migrate-sqlite-to-json-sqljs.mjs:10-15` | Already portable pattern — `APPDATA ? ... : HOME/.config` — use as the template for fixing #3. |
| 5 | `nuclear-fix.ps1:27-29` | Hardcodes `$env:APPDATA\DeskFlow\...` cache paths and uses Windows-only `Get-Process`/`node scripts\rebuild-main.mjs`. PowerShell-only workflow doc; Linux needs a `.sh` equivalent. (User runs `npm run dev` in PowerShell/cmd on Windows per profile — the new location changes the dev OS to Linux.) |
| 6 | `agent/COMMON_ERRORS_FIXED.md:95-98` | DB path convention: stable path via `path.join(app.getPath('userData'), 'deskflow.db')`. `app.getPath('userData')` resolves per-OS — code using it is portable, but the **data itself** doesn't move (see §5). |
| 7 | Session/doc `.md` logs (e.g. `SELF PLIFE SuPAGE.md`, `aitoolssession29082026.md`, `AI Assistant FIX.md`) | Contain dozens of hardcoded `C:\Users\cleme\Documents\COMPUTAH_SAYENCE\...` command strings and old `const ROOT = 'C:\\Users\\...\\App Tracker'` build-script snapshots. These are **historical logs, not live code** — do NOT "fix" them; exclude `*.md` logs from any path-rewrite pass. (Current `scripts/build.mjs` is already dynamic — the hardcoded ROOT only exists in old session transcripts.) |

## 5. Runtime data that does NOT live in the repo (migration must carry it)

- Electron `userData`: on Windows `%APPDATA%/RHEO/deskflow-data.db` (+ `deskflow-data.json`); on Linux it becomes `~/.config/RHEO/`. The DB file must be copied to the new platform path (or the app starts with an empty database — per `MEMORY.md`, `package.json` `name` must match the data folder or the app reads the wrong/empty DB).
- `.env` at project root (gitignored): holds `TWENTY_FIRST_API_KEY` and possibly others — copy manually, never commit.
- `agent/backups/` — user's safety net for destructive ops; preserve.
- `node_modules/` — **DO NOT COPY**. Contains Windows-built natives (`better-sqlite3`, `active-win`, `node-pty`, `sqlite3`). Fresh `npm install` + rebuild on Linux. Flag: `active-win` and `node-pty` Linux support must be verified — the app is an Electron Windows-first tracker; features depending on them may degrade on Linux.

## 6. Constraints the plan must respect

1. **No destructive git commands** without explicit user confirmation (`reset --hard`, `clean -fd`, `push --force`, `checkout -- .`, `stash drop`). The repo's git aliases enforce this interactively — re-apply them post-migration.
2. **Do not commit, push, or rewrite history** unless the user asks (repo rule). The migration itself should be push-free until the user approves.
3. **Never read, print, or commit secrets** (`.env`, tokens in `opencode.json`).
4. All git/npm operations must run on the **Linux target**, never on the NTFS mount (git times out there).
5. Verify with `npm run lint` and `npm run build` (Node `scripts/build.mjs`) on the new location before declaring done.

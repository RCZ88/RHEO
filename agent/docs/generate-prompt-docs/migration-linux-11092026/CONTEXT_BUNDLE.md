# CONTEXT BUNDLE — Project Migration (NTFS mount → Linux native dir) v2

Target AI: read this file first, then verify every claim against the live repo. Distrust summaries — including this one. Speculation is labeled. Fresh verification outputs from 2026-09-10 are in §8.

## 1. Current location (SOURCE — NEVER DELETE, NEVER MODIFY IN PLACE)

```
/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker
```

- NTFS partition mounted on Linux. `git status` on this mount **timed out after 180s** (2026-09-10). No git/npm/build commands run here, ever. Read-only file access only.
- **Migration method is FILE-COPY (rsync). `git clone` is FORBIDDEN** — see §2. The source directory remains fully intact until the principal signs off; rollback = `rm -rf` the new dir only.
- Folder name contains a **space** (`App Tracker`). Per `agent/COMMON_ERRORS_FIXED.md:124` this breaks node-gyp. Target path must have no spaces: `~/dev/rheo`.

## 2. Working tree state — DIRTY (governing fact, read from ledger not git)

Per the orchestrator ledger: Atlas C1 staged rows (R-6), boot-splash fixes, possibly LIGHT-wave edits are in flight. A clone would orphan all of this (§3-1 rule: rsync ≠ clone) and lose the `.git/config` blocking aliases + `http.postBuffer`. **Copy the tree as-is, dirt included.** Post-copy gate G-MIG-3 verifies the dirty set matches expectations — surprises = STOP.

## 3. Git facts (`.git/config`, `.git/HEAD`, `.git/refs/heads/master` read as files)

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
[alias]
	reset = !echo BLOCKED: git reset is disabled. ... && exit 1
	clean = !echo BLOCKED: git clean is disabled. ... && exit 1
	push = !echo BLOCKED: git push is disabled. ... && exit 1
	branch = !echo BLOCKED: git branch is disabled. ... && exit 1
	checkout = !echo BLOCKED: git checkout is disabled. ... && exit 1
	stash = !echo BLOCKED: git stash is disabled. ... && exit 1
```

- Branch `master`, remote `https://github.com/RCZ88/RHEO.git`. These travel with the copy (they live in `.git/`).
- `core.symlinks=false`, `core.filemode=false`, `core.ignorecase=true` are Windows/NTFS settings — the flips to Linux values are **GATED, not one-liners**: strip exec bits repo-wide and re-grant the known set BEFORE `filemode=true` (else status explodes with mode noise); run the case-collision scan (`git ls-files | tr A-Z a-z | sort | uniq -d`) and require it empty BEFORE `ignorecase=false`. Noise = STOP.
- `core.autocrlf=input` is set; **NO `git add --renormalize`** (rewrites the tree).
- Migration is push-free by construction (the repo's own alias blocks push).

## 4. userData — SPLIT-BRAIN RISK (two candidate DBs, census both, clobber neither)

- **Linux side EXISTS and is LIVE**: `~/.config/RHEO/deskflow-data.db`, 122 MB, mtime Sep 10 02:36 (verified 2026-09-10, §8). SingletonLock/SingletonSocket symlinks present → app ran here recently. **Never overwrite this directory without a timestamped backup.**
- Windows side expected at `%APPDATA%/RHEO` (reachable via mount at `/run/media/.../Users/cleme/AppData/Roaming/RHEO/`) — census in STEP-0, metadata only.
- **DB filename discrepancy — never guess**: this bundle's v1 said `deskflow-data.db`; `agent/COMMON_ERRORS_FIXED.md:95-98` says `deskflow.db`. Census actual filenames on both sides; carry what exists, verbatim names. Linux side confirmed: `deskflow-data.db` (+ `deskflow-data.json`, 2 bytes).
- Pre-staged default: Linux-side DB is authoritative (newest sessions); loser archived; row-count report after boot per DB law. Override row B lets the principal flip this.

## 5. Build/config path handling (actual source)

Already dynamic — keep as the portable pattern, do not touch:

`scripts/build.mjs:33-35`: `const ROOT = resolve(import.meta.dirname, '..')` (+ `.build-lock` at ROOT — **exclude `.build-lock` from rsync; it would be stale on arrival and refuse the first build**). All `execSync` use `{ cwd: ROOT }`.
`scripts/mcp-launcher.mjs:6-10`: `projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')`, `.env` loaded from project root.
`vite.config.ts:7-16`: dynamic `__dirname`, `'@'` alias, `base: './'`.
`electron.vite.config.ts`: relative outDirs; externals include `better-sqlite3, active-win, node-pty`.
`package.json`: `main: dist-electron/main.cjs`, scripts `build: node scripts/build.mjs`, `dist: npm run build && electron-builder --win`; `build.directories.output: release` (relative).
`.gitignore` covers `node_modules/`, `dist*/`, `release/`, `.env`, `*.db` — rsync excludes mirror this.

## 6. Known hardcoded / platform-coupled code (live code only)

| # | Location | Problem | Fix pattern |
|---|----------|---------|-------------|
| 1 | `opencode.json:22-29` | `probe` = `["node", "../probe/dist/index.js"]` — sibling repo OUTSIDE this tree (`C:/Users/cleme/Documents/COMPUTAH_SAYENCE/probe/`, standalone, built separately). **Preserved by layout**: target `~/dev/rheo` + `~/dev/probe` keeps `../probe` working with zero re-point. Probe gets its own copy + `npm ci` + build. | layout, not code |
| 2 | `opencode.json:14-20,37-39` | Live secrets (`x-api-key`, `NOTION_API_TOKEN`). Never printed/committed. Post-move: `git ls-files opencode.json` → if tracked, `git rm --cached` is a PROPOSAL for principal ruling only, no history rewrite. | policy |
| 3 | `check-db.js:6`, `check-tables.cjs:5`, `list-tables.cjs:5`, `test-ipc.cjs:4` | `process.env.APPDATA \|\| homedir/AppData/Roaming` — Windows-only; broken on Linux. | `process.platform` branch per `migrate-fixed.mjs:8-15` (APPDATA ? … : HOME/.config) |
| 4 | `nuclear-fix.ps1:27-29` | Hardcoded `$env:APPDATA\DeskFlow\...`, Windows-only cmdlets. Transcript-era tool; Linux needs `.sh` equivalent if still wanted. | rewrite, not port |
| 5 | Session/doc `.md` logs (SELF PLIFE SuPAGE.md, aitoolssession29082026.md, AI Assistant FIX.md, workspace29082026.md) | Dozens of `C:\Users\...` strings + stale hardcoded-ROOT build snapshots. **Historical transcripts — EXCLUDED from all rewrite passes.** | exclude `*.md` logs + `.ps1` |

## 7. Constraints

1. **Copy only. Nothing on the source path is deleted, modified, or moved.** No destructive git commands anywhere without explicit principal confirmation.
2. No commit / push / history rewrite unless the principal asks.
3. Never print or commit secrets (`.env`, tokens).
4. No git/npm/build on the NTFS mount — Linux target only.
5. `npm ci` covers BOTH codebases (root + `landing/`). Native rebuild vs Electron 41 ABI. `active-win`/`node-pty` Linux build failure = record verbatim + flag for P0 arbitration, never silent dep removal.
6. Linux env gates the staged spec already carries: `fs.inotify.max_user_watches=524288`, `playwright install --with-deps`, start script persisting env + `WAYLAND_DISPLAY=` (X11 mode).
7. Verify with `npm run lint`, `node scripts/build.mjs`, and a real shell-launch (Playwright `_electron.launch` + bounding-box assertions + screenshots) showing REAL row counts — empty dashboard after migration = data loss, FAIL loudly.

## 8. Fresh verification outputs (2026-09-10, read-only)

- `.git/HEAD` → `ref: refs/heads/master`; `.git/refs/heads/master` → `0b066b8d1e1a31f96b53925efec95770c5cbaca7`. Git-free SHA capture works — use for HEAD-parity gate.
- `~/.config/RHEO/` exists: `deskflow-data.db` 122,585,088 bytes (Sep 10 02:36), `deskflow-data.json` 2 bytes, prefs/sleep/window JSONs, `backups/` dir, Chromium SingletonLock/SingletonSocket symlinks (recent run).
- `~/dev` does NOT exist — target directory to be created.
- `/home` filesystem: `/dev/nvme0n1p4`, ext4, 139 GB available.
- Windows-side `%APPDATA%/RHEO` census: NOT yet performed — STEP-0 item for the planner (read-only listing via mount).

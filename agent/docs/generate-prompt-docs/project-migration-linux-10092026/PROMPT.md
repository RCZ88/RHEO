# PROMPT — Plan the project migration (NTFS mount → Linux native directory)

## Raw Request (user's exact words, verbatim — do not rephrase)

> "skill to plan out a migration from one path to another so hcanging the location of hte direcoty of this project to a new directoy on the linux side of teh partition so that it is less laggy. make sure to take account the git commands that we can use and like the fact that some cod are migth still be hardcoded into a specific direotry to make sure that everythign is dynamic to where the projeft currently is"

Follow-up instruction, verbatim:

> "I Need you to make sure htat u use the prompt to generate ap rompt for other ai to plan the migration plan"

## Context

- Read `CONTEXT_BUNDLE.md` in this same folder FIRST. It is the source of truth for current paths, git config, secrets locations, and which files are already dynamic vs. hardcoded. Verify its claims against the live repo before trusting them.
- The "why": the project currently sits on a Windows NTFS partition mounted on Linux (`/run/media/.../App Tracker`). Filesystem latency is severe — even `git status` timed out after 180s. The goal is to relocate the project to a native Linux directory so dev/build/git are fast again.
- The "where": RHEO — Electron + React + Vite app (`npm run build` → `node scripts/build.mjs`, `npm run lint`). Branch `master`, remote `https://github.com/RCZ88/RHEO.git`.

## The Mandate

Design a comprehensive, single migration plan — not options — covering: (1) the relocation procedure, (2) the git strategy, (3) the hardcoded-path audit and fixes so every path resolves dynamically from the project's current location, and (4) the verification gates. The plan must be executable step-by-step by an implementing AI or the user.

## Requirement Checklist

### A. Relocation procedure
- Specify the exact target directory (native Linux path, no spaces — the current `App Tracker` space breaks node-gyp; propose the rename).
- `git clone` vs file-copy trade-off: weigh losing `.git/config` aliases + `http.postBuffer` (clone) vs copying NTFS permission/case quirks + stale Windows binaries (copy). Recommend ONE method with reasons.
- Enumerate what moves via git, what is carried manually (`.env`, user-data DB, `agent/backups/`), and what is rebuilt from scratch (`node_modules`, `dist*/`, `release/`).
- Account for the **probe** standalone repo (sibling of the project, referenced as `../probe/dist/index.js` in `opencode.json`) — it must move/be rebuilt too or the MCP breaks.
- Account for runtime data: `%APPDATA%/RHEO` → `~/.config/RHEO` DB relocation so the app doesn't boot into an empty database.

### B. Git strategy
- List the exact git commands to use, in order. Every command must be non-destructive or explicitly gated behind user confirmation.
- Cover: preserving or re-applying the six destructive-command blocking aliases in `.git/config`, resetting `core.symlinks`/`filemode`/`ignorecase` for Linux ext4, re-setting upstream `master`, and confirming `git status` is instant on the new location.
- State what must NOT be committed or pushed (secrets, `.env`, DB files, `opencode.json` if it holds live tokens — check tracking status and say explicitly).

### C. Hardcoded-path audit → dynamic-path fixes
- Audit every live-code reference to absolute locations: `C:\...`, `/run/media/...`, `COMPUTAH_SAYENCE`, `%APPDATA%`-only fallbacks, `.ps1`-only workflows, `../probe` coupling.
- For each finding give: file + line, why it breaks after the move, and the fix using the repo's existing portable patterns (`resolve(import.meta.dirname, '..')`, `fileURLToPath`, `app.getPath('userData')`, `process.platform` branching as in `migrate-fixed.mjs`).
- Explicitly EXCLUDE historical session/doc `.md` logs from the rewrite pass (they are transcripts, not code).
- Fix the Windows-only `APPDATA || ~/AppData/Roaming` fallback scripts (`check-db.js`, `check-tables.cjs`, `list-tables.cjs`, `test-ipc.cjs`) for Linux.
- Flag risks that can't be fixed by paths alone: `better-sqlite3`/`active-win`/`node-pty` native rebuild on Linux, and any feature degradation if a native module lacks Linux support.

### D. Verification gates
- Define pass/fail checks in order: `git status` responsiveness, `npm install` + native rebuild success, `npm run lint`, `npm run build`, app boot with the migrated DB showing real data, probe MCP resolving, and a repo-wide grep proving zero absolute-path references remain in live code.
- Include a rollback plan: what to do if the new location fails (old mount stays untouched until sign-off — nothing destructive happens to the source).

## Constraints (hard limits)

1. NO destructive git commands (`reset --hard`, `clean -fd`, `push --force`, `checkout --`, `stash drop`) without explicit user confirmation. Re-apply the blocking aliases post-migration.
2. Do not commit, push, or rewrite history unless the user asks.
3. Never print or commit secrets (`.env` contents, API tokens in `opencode.json`).
4. All operations run on the Linux side — never run git/npm on the old NTFS mount.
5. Do not "fix" historical `.md` session logs; live code only.
6. The old source directory must remain intact until the user signs off on the new location.

## Output Format

Return a single Markdown migration plan with these sections:

1. **Target layout** — exact new paths (project + probe + data).
2. **Step-by-step procedure** — ordered commands, each with expected output.
3. **Git command ledger** — every git command used, with a destructive/non-destructive label.
4. **Path-fix table** — `| File:line | Current | Fix | Pattern used |`.
5. **Backend/data notes** — DB + `.env` + backups handling.
6. **Verification gates** — ordered pass/fail checklist + rollback plan.
7. **Open questions** — only items you could not resolve from the repo; ask the user for these instead of guessing.

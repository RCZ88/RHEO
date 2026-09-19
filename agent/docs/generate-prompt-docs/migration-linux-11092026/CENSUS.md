# STEP-0 CENSUS OUTPUTS (filled by Hermes, 2026-09-12, read-only + Linux-side shell)

Paste this file back to the external Migration Planner to unblock the final RESULT.md.
Every value below is real tool output. Secret contents never included (checksums only where needed).

## 1. Git-free state capture

- `.git/HEAD` → `ref: refs/heads/master`
- `.git/refs/heads/master` → `0b066b8d1e1a31f96b53925efec95770c5cbaca7`
- `.git/config` → branch `master`, remote `https://github.com/RCZ88/RHEO.git`,
  six BLOCKED aliases (reset/clean/push/branch/checkout/stash), `http.postBuffer = 524288000`,
  `core`: `filemode=false, symlinks=false, ignorecase=true` (full text in CONTEXT_BUNDLE.md §3).

## 2. Filesystem facts

- Source mount: `/dev/nvme0n1p3`, fstype **fuseblk**, opts `rw,relatime,user_id=0,group_id=0,allow_other,blksize=4096`.
  87% used, 109 GB avail. **Confirms Deviation 2: exec bits on the source are FUSE mount-policy noise —
  use the git-index-derived exec set (step d), never the mount's bits.**
- Target `/home`: `/dev/nvme0n1p4`, **ext4**, 32% used, 134 GB avail.
- Copy size (excl `node_modules`, `dist*`, `release`, `.git`): **2.6 GB**. `.git` alone: **130 MB**.
  `node_modules` (excluded, rebuilt): 1.4 GB. `~/dev` does not exist yet — create it.
- `git status` on the mount times out at 180s+ (reconfirmed 2026-09-10); `ls`/`du`/`grep` reads work but slow.

## 3. userData census — BOTH SIDES EXIST, DO NOT ASSUME LINUX WINS

Linux `~/.config/RHEO/`:
- `deskflow-data.db` — **122,585,088 bytes, mtime Sep 10 02:36**; `deskflow-data.json` 2 bytes;
  prefs/sleep/window JSONs (Sep 8–10); `backups/` dir; Chromium SingletonLock/SingletonSocket symlinks.
- No `-wal`/`-shm` → app NOT currently running on Linux side.

Windows `%APPDATA%/RHEO` (via mount `.../Users/cleme/AppData/Roaming/RHEO/`, listing Sep 12 ~22:0x):
- `deskflow-data.db` — **122,585,088 bytes, mtime Sep 12 21:51** (SAME byte size as Linux copy, 2.5 days newer)
- `deskflow-data.db-wal` — 1,738,672 bytes, mtime **Sep 12 22:04**; `deskflow-data.db-shm` 32,768 bytes
- → **the Windows side is the currently-written DB (live WAL minutes old).**
  Identical main-DB size is coincidence or shared history — authority MUST be decided by
  pre-boot row-count snapshot + max-timestamp comparison per table AFTER quiesce, not by default.
  Override row B is a real decision: either side's newest rows die with the loser. Both archived, never merged.
- Actual filenames confirmed: `deskflow-data.db` (+ `.json`). The `deskflow.db` variant from
  COMMON_ERRORS_FIXED.md was NOT observed on either side — discrepancy resolved in favor of `deskflow-data.db`.
- No row counts taken (both DBs potentially live; snapshot at quiesce with `sqlite3 -readonly`).

## 4. Live-code path audit (grep, `*.md` logs excluded from judgment)

Scripts dir (`scripts/*.mjs`): **zero hits — clean.**

New findings NOT in the bundle (all live code, all need the platform-branch fix):
| File:line | Current | Fix |
|---|---|---|
| `src/main.ts:1554-1561` (×2 blocks) | `process.env.LOCALAPPDATA \|\| homedir/AppData/Local` (Hermes profiles lookup) — Windows-only fallback | `process.platform` branch → `~/.config/hermes/profiles` on Linux, same pattern as `migrate-fixed.mjs` |
| `src/main.ts:8944-8945` | `process.env.PROGRAMFILES \|\| 'C:\\Program Files'` (Firefox/Edge exe locate) | platform guard — Linux browser lookup (PATH/`which`) or documented Windows-only degradation |
| `src/gameDetection.ts:56-57` | Hardcoded `C:\Program Files (x86)\Steam`, `C:\Program Files\Steam` | platform branch — `~/.steam`, `~/.local/share/Steam` candidates on Linux |
| `src/main.ts:16370` | `'…never modify %APPDATA%/RHEO/deskflow-data.db'` — prompt/doc string, informational | update string to reflect both userData paths, or leave (harmless) |

Reviewed and EXCLUDED (display text / placeholders, not path logic):
- `src/components/workspace/FortressProtocolSetup.tsx` (`C:\Scripts`, `C:\FORTRESS`, `C:\Program Files\Git` inside generated-PS1 strings + git-trap; Windows-feature UI)
- `src/features/content-engine/components/CaptureView.tsx:192,206`, `src/pages/IDEProjectsPage.tsx:2763-2764,2785,3895` (placeholder/example strings)
- `src/pages/StatsPage.tsx` hits are `selectedAppData` variable names, not paths
- `--help/analysis.json`, `--help/graph.json` — graphify plugin artifacts full of absolute paths.
  **Recommend adding `--help/` to the rsync exclude list (regenerable output, not source).**
- Bundle's four APPDATA-only scripts (`check-db.js:6`, `check-tables.cjs:5`, `list-tables.cjs:5`, `test-ipc.cjs:4`) reconfirmed.

## 5. Sibling probe

`.../COMPUTAH_SAYENCE/probe/` exists with `src/`, `dist/` (built), `node_modules/`, `package.json`,
`opencode.json`, `test/`, `AGENTS.md`. Copy + `npm ci` + rebuild plan stands; `../probe` ref preserved by layout.

## 6. Linux tool availability

- `node v26.8.1`, `npm 11.19.0`, `git 2.55.0`, `sqlite3 3.51.2` (present), `playwright 1.62.1` (project-local).
- `fs.inotify.max_user_watches = 275411` (current) → still needs the 524288 sudo line + persistence file.
- `landing/` exists (second codebase confirmed — `npm ci` ×2 stands). `.env` exists at project root (carry via `--include='.env'`, checksum-verify; principal nods the Deviation-1 override of "excludes mirror .gitignore").
- FERROFLUID-2 pgrep patterns: not available to Hermes either — executor must supply or use
  `pgrep -af 'electron|vite|node .*scripts/'` placeholder, replaced before quiesce.
- BUILD skill contents: not retrievable from this session — planner proceeds without or flags it.

## Principal decisions required (override rows, unchanged)

- A: target `~/dev/rheo` + `~/dev/probe` (defaults-taken unless renamed).
- B: authoritative DB — **no longer safely defaultable to Linux-side** (Windows side has today's WAL).
  Decide by quiesce-time row-count + max-timestamp evidence.
- C: filemode flip now vs after one post-signoff chore commit.
- Deviation 1 nod: `--include='.env'` overriding the gitignore-mirror exclude (same-machine copy, checksum-verified, never printed).

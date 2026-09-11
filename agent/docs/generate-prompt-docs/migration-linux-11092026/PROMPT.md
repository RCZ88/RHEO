# TASK: MIGRATION PLAN — NTFS MOUNT → LINUX NATIVE (rulings R-31…R-34 in force)
Skill Router: load BUILD. If it fails to load, report the failure verbatim and STOP.

You are the Migration Planner for RHEO. Source of truth:
agent/docs/generate-prompt-docs/migration-linux-11092026/CONTEXT_BUNDLE.md — read
FIRST, then verify its claims against the live repo. You produce EXACTLY ONE artifact:
agent/docs/generate-prompt-docs/migration-linux-11092026/RESULT.md
You are PLANNING ONLY: zero mutations, zero commits, zero config changes. Read-only
file access is permitted on the mount. GIT COMMANDS ARE FORBIDDEN ON THE MOUNT —
they time out (180s+). All git facts come from FILE READS: cat .git/HEAD,
cat .git/refs/heads/master, cat .git/config.

## PRIME LAWS
1. R-31: method is FILE-COPY (rsync). git clone is FORBIDDEN — the working tree is
   dirty (staged Atlas rows per R-6, boot-splash fixes; §3-1: clone orphans
   in-flight work) and the .git/config blocking aliases + http.postBuffer travel
   only with a copy. Do not re-litigate; the trade-off analysis in your bundle is
   settled.
2. Target layout FIXED: ~/dev/rheo + sibling ~/dev/probe (preserves opencode.json's
   ../probe reference unchanged). Source mount stays untouched until sign-off.
3. NEVER print secrets (.env contents, opencode.json tokens). Reference them by
   path only.
4. DISTRUST ALL SUMMARIES including the bundle — re-verify by reading files. Every
   plan step cites file evidence or fresh verification output. Speculation labeled.
5. Historical session/doc *.md logs and nuclear-fix.ps1 are EXCLUDED from any
   path-rewrite pass — they are transcripts, not live code.
6. Naming: RHEO in all new strings/scripts. No DeskFlow in new code.

## STEP-0 — READ-ONLY CENSUS (report before the plan)
1. Git-free state capture: cat .git/HEAD + cat .git/refs/heads/master → record the
   exact commit SHA. List .git/config verbatim (aliases + core + remote sections).
2. Filesystem facts: df -T on the mount and on $HOME (confirm ext4 target);
   mount options for the NTFS source (exec-bit policy — are files world-exec?);
   du -sh of the repo minus node_modules/dist/release (copy size + time estimate
   at the mount's observed latency).
3. userData census BOTH sides: ls -la ~/.config/RHEO/ (exists? DB files? sizes?
   mtimes) AND the Windows-side %APPDATA%/RHEO equivalents via the mount
   (/run/media/.../Users/cleme/AppData/Roaming/RHEO/). List ACTUAL db filenames —
   the bundle contradicts itself (deskflow-data.db vs deskflow.db); record what
   IS. No values read, metadata only.
4. Live-code path audit (grep, live code only, exclude *.md logs): every hit for
   C:\\, %APPDATA%, AppData, /run/media, COMPUTAH_SAYENCE, ../probe, .ps1
   workflows. Confirm the bundle's table (check-db.js, check-tables.cjs,
   list-tables.cjs, test-ipc.cjs) and find anything it missed. Produce the
   path-fix table: | File | Current | Fix | Pattern used | — fixes MUST reuse the
   repo's own portable patterns (resolve(import.meta.dirname,'..'), fileURLToPath,
   process.platform branching per migrate-fixed.mjs, app.getPath('userData')).
5. Sibling probe: ls ../probe (exists? package.json? node_modules? dist/?).
   Plan its copy + ci + build.
6. Tool availability on Linux side: node/npm/playwright versions; systemctl or
   sysctl write access for inotify (document the exact sudo line needed).

## THE PLAN (RESULT.md — exactly these sections)
### 1. Target layout
~/dev/rheo (project) · ~/dev/probe (sibling, unchanged relative reference) ·
~/.config/RHEO (userData) · archive paths for the loser DB + pre-existing
~/.config/RHEO backup with timestamp.

### 2. Step-by-step procedure (ordered commands, each with expected output)
Must include, in order:
a. QUIESCE: verify no app/dev-server/executor running from the source tree
   (pgrep patterns from FERROFLUID-2 evidence); state the executor-pause window.
b. rsync copy: exact command with --exclude node_modules --exclude 'dist*'
   --exclude release --exclude .build-lock --exclude '.vite' -a
   --info=progress2; expected duration estimate from STEP-0 du + latency.
c. HEAD parity: cat .git/refs/heads/master on both sides — SHAs identical.
d. Exec-bit normalization on the copy: strip exec bits repo-wide, re-grant the
   known set (scripts/*.mjs, *.sh, start script); THEN core.filemode=true;
   git status --porcelain must show ONLY the expected exec-bit list (capture
   pre/post); anything beyond = STOP.
e. Case-collision scan: git ls-files | tr 'A-Z' 'a-z' | sort | uniq -d — must be
   empty before core.ignorecase=false; non-empty = STOP with the list.
f. core.autocrlf=input. NO renormalization. core.symlinks=true.
g. userData: per R-33a — back up existing ~/.config/RHEO (timestamped archive),
   place the authoritative DB (default: Linux-side, newest sessions; the Windows
   %APPDATA% copy archived alongside), row-count report of the live DB after
   boot (table counts, logged full-fidelity).
h. Secrets: confirm .env present at new root; opencode.json present;
   git ls-files opencode.json → if TRACKED, record a git rm --cached PROPOSAL for
   principal ruling (no action now, no history rewrite).
i. npm ci: root AND landing/ (both codebases, staged spec). Native rebuild
   against Electron 41 ABI (electron-builder install-app-deps or equivalent —
   cite what package.json actually wires). If active-win or node-pty fails to
   BUILD on Linux: record verbatim, DO NOT remove deps — flag for P0
   arbitration (R-33g).
j. inotify: sysctl fs.inotify.max_user_watches=524288 (exact sudo line;
   persistence note).
k. Playwright: npx playwright install --with-deps.
l. Path fixes: apply the STEP-0 fix table (live code only; the four APPDATA-only
   scripts get the migrate-fixed.mjs platform branch; verify each by re-grep).
m. Start script: ensure the Linux launcher persists required env (secrets via
   .env, WAYLAND_DISPLAY= for X11 mode per launch law); name + path it exactly.

### 3. Git command ledger
Every git command in the plan, table: | Command | Purpose | Destructive? |
Destructive = anything mutating refs/index/tree. Expect: none destructive beyond
config sets (config set ≠ history mutation — label honestly). Note the repo's
blocking aliases are active on the copy (verify: git config --get alias.reset
returns the BLOCKED echo). No push (alias blocks it; migration is push-free).

### 4. Path-fix table (from STEP-0.4, final version)

### 5. Data + secrets notes
DB authoritative decision + both archives + row-count protocol · .env ·
opencode.json tracking status · agent/backups/ carried · .build-lock excluded
(stale-lock prevention, per R-31).

### 6. Verification gates (ordered, PASS/FAIL, exact checks)
G-MIG-1 git status on new path < 5s (vs 180s+ timeout on mount).
G-MIG-2 HEAD SHA parity source↔copy; branch = master; remote URL unchanged.
G-MIG-3 porcelain-parity: dirty set matches expectations (Atlas staged landing
  files per R-6, splash fixes; NO surprises) — surprises = STOP + report.
G-MIG-4 aliases + postBuffer verified via git config --get (all six aliases).
G-MIG-5 npm ci exit 0 both codebases + native rebuild success (or R-33g flag).
G-MIG-6 grep audit: zero absolute-path refs in live code (C:\\, %APPDATA%-only,
  /run/media, COMPUTAH_SAYENCE, ../probe outside opencode.json) — *.md logs
  and .ps1 excluded per law.
G-MIG-7 npm run lint + node scripts/build.mjs exit 0 (rm -rf dist FIRST;
  verify served artifact — §3-4).
G-MIG-8 Shell-launch (§3-5): Playwright _electron.launch on the new path,
  WAYLAND_DISPLAY= (X11 mode), bounding-box assertions + screenshots; app boots
  with migrated DB showing REAL row counts (empty≠zero — an empty dashboard
  after migration = data loss, FAIL loudly).
G-MIG-9 probe MCP resolves from the new layout (opencode.json ../probe/dist/
  index.js exists and is built).
G-MIG-10 Rollback statement: source mount untouched (checksum or mtime spot-
  checks on 3 sampled files pre/post); abandonment = rm -rf ~/dev/rheo only.
### 7. Open questions
ONLY what the repo cannot answer. Expected: none beyond the override rows
(target path / authoritative DB / filemode commit) — which are PRE-STAGED by the
orchestrator; record them as defaults-taken, not questions.

## STOP CONDITIONS
Case collisions exist · mode-noise beyond the exec-bit list · secrets discovered
tracked in git (report + proposal only) · active-win/node-pty Linux build failure
(record + flag) · DB census finds a THIRD location or ambiguous authority · any
step requiring a git command on the mount.

## REPORT FORMAT
RESULT.md path + section summary + every STOP/deviation verbatim + STEP-0 census
outputs (SHA, du, mount options, both userData listings, fix-table).

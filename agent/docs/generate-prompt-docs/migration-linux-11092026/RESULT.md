# RESULT.md — Migration Plan: NTFS mount → Linux native (~/dev/rheo)
Source of truth: CONTEXT_BUNDLE.md + STEP-0 census (Hermes, 2026-09-12).
Method R-31 file-copy · rulings R-31…R-34 in force · commit/push-free by design.
HEAD at planning time: master → 0b066b8d1e1a31f96b53925efec95770c5cbaca7.

## 1. Target layout

| Path | Role |
|---|---|
| `~/dev/rheo` | Project copy, dirty tree as-is (rsync; clone forbidden per R-31) |
| `~/dev/probe` | Sibling copy; `opencode.json` `../probe` reference unchanged (zero re-point) |
| `~/.config/RHEO` | userData — stays in place; authority decided at quiesce (§2-g) |
| `~/.config/RHEO.backup.<TS>/` | Timestamped full backup of Linux userData before any change |
| `~/rheo-migration-archive/<TS>/{windows-staging,linux-staging}/` | Both DB sides, staged + checkpointed + counted; loser archived, never merged, never deleted |
| `scripts/launch-linux.sh` | New Linux launcher (§2-m), untracked, RHEO-named |

`~/dev` must be created (does not exist). Target fs: ext4, 134 GB free vs ~2.9 GB total need (2.73 GB copy + node_modules rebuilds). Source mount: NEVER modified; rollback = `rm -rf ~/dev/rheo ~/dev/probe` + restore `~/.config/RHEO.backup.<TS>` only.

## 2. Step-by-step procedure

### a. QUIESCE
```bash
pgrep -af 'electron|vite|node .*scripts/'      # EXPECT: no output, exit 1
W=/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/AppData/Roaming/RHEO
stat -c '%n %s %Y' $W/deskflow-data.db-wal $W/deskflow-data.db-shm
sleep 60
stat -c '%n %s %Y' $W/deskflow-data.db-wal $W/deskflow-data.db-shm   # EXPECT: identical values
```
- Pgrep patterns are the declared placeholder — FERROFLUID-2 patterns unavailable to both sessions (deviation D3); executor must replace before running.
- Windows side is dual-boot-cold by construction (we are on Linux) but the WAL was live minutes before census; the 60s no-growth re-stat is the proof. Linux side already proven cold (no `-wal`/`-shm`, census §3).
- **Executor-pause window: declared here, closed only after G-MIG-8.** No other agent touches source, target, or userData during the window.

### b. rsync copy (two-pass)
```bash
mkdir -p ~/dev
rsync -a --info=progress2 --modify-window=2 \
  --include='/.env' \
  --exclude='node_modules' --exclude='dist*' --exclude='release' \
  --exclude='.build-lock' --exclude='.vite' --exclude='/--help' \
  '/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker/' \
  ~/dev/rheo/
```
- `--include='/.env'` BEFORE excludes (principal-approved override of "excludes mirror .gitignore" — Deviation 1, nodded). `--modify-window=2` guards delta re-runs against fuseblk timestamp rounding. `--delete` deliberately omitted (source is frozen; nothing should ever disappear).
- Copy payload: 2.6 GB tree + 130 MB `.git` ≈ 2.73 GB. **Duration estimate: 8–25 min pass 1** (fuseblk read latency; `progress2` reports the real rate — record it), seconds for pass 2.
- **Pass 2 (delta): re-run the identical command immediately after (a) re-confirms quiesce**, then verify excluded paths are untracked (a tracked exclusion would surface as `D` entries at G-MIG-3 = false alarm):
```bash
cd ~/dev/rheo && git ls-files -- node_modules 'dist*' release .build-lock .vite '--help'
# EXPECT: empty. Non-empty output → that path is TRACKED: drop its --exclude, re-sync it, record.
```

### c. HEAD parity (file reads only; zero git on the mount, ever)
```bash
cat ~/dev/rheo/.git/HEAD                # EXPECT: ref: refs/heads/master
cat ~/dev/rheo/.git/refs/heads/master   # EXPECT: 0b066b8d1e1a31f96b53925efec95770c5cbaca7
```
Must equal census §1 source SHA byte-for-byte. (Fallback if loose ref absent: `grep 'refs/heads/master' .git/packed-refs`.)

### d. Exec-bit normalization (index-derived — mount bits are fuseblk policy noise, census §2)
```bash
cd ~/dev/rheo
cp .git/config /tmp/rheo-git-config-orig.txt
git ls-files -s | awk -F'\t' '$1 ~ /^100755 /{print $2}' > /tmp/rheo-exec-set.txt
wc -l /tmp/rheo-exec-set.txt            # EXPECT: small known list (scripts, *.sh)
git status --porcelain > /tmp/rheo-porcelain-pre-flip.txt    # filemode still false → staged-set baseline
find . -type d -not -path './.git*' -exec chmod 755 {} +
find . -type f -not -path './.git/*' -print0 | xargs -0 chmod 644
xargs -d '\n' -r chmod 755 < /tmp/rheo-exec-set.txt
git config core.filemode true
git status --porcelain > /tmp/rheo-porcelain-post-flip.txt
diff /tmp/rheo-porcelain-pre-flip.txt /tmp/rheo-porcelain-post-flip.txt   # EXPECT: no output
```
Any post-flip entry beyond the baseline whose `git diff <file>` shows only `old mode/new mode` = normalization failure = **STOP**.

### e. Case-collision scan
```bash
git ls-files | tr 'A-Z' 'a-z' | sort | uniq -d   # EXPECT: empty — non-empty = STOP with the list
git config core.ignorecase false
```

### f. Remaining config flips (verify-then-set; NO renormalize, ever)
```bash
git ls-files -s | awk -F'\t' '$1 ~ /^120000/'   # EXPECT: empty (else STOP: symlink entries need materialization ruling)
git config core.symlinks true
git config --get core.autocrlf || true          # EXPECT: empty — see deviation D5
git config core.autocrlf input                  # explicit repo-local set, idempotent
```
D5: bundle §3 prose claims `autocrlf=input` is set, but the bundle's own ini dump and the census core listing both omit it — resolved by explicit set, not by trusting either summary.

### g. userData — authority by EVIDENCE (row B is no longer defaultable; census §3)
```bash
TS=$(date +%Y%m%d-%H%M%S)
cp -a ~/.config/RHEO ~/.config/RHEO.backup.$TS
mkdir -p ~/rheo-migration-archive/$TS/windows-staging ~/rheo-migration-archive/$TS/linux-staging
W=/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/AppData/Roaming/RHEO
cp -p $W/deskflow-data.db $W/deskflow-data.db-wal $W/deskflow-data.db-shm ~/rheo-migration-archive/$TS/windows-staging/
cp -p ~/.config/RHEO/deskflow-data.db ~/rheo-migration-archive/$TS/linux-staging/
cd ~/rheo-migration-archive/$TS/windows-staging
sqlite3 deskflow-data.db 'PRAGMA wal_checkpoint(TRUNCATE); PRAGMA integrity_check;'  # EXPECT: ok (WAL folded into the COPY)
cd ../linux-staging && sqlite3 deskflow-data.db 'PRAGMA integrity_check;'            # EXPECT: ok
sha256sum ../windows-staging/deskflow-data.db ../linux-staging/deskflow-data.db      # document; never diff by size again
for db in ../windows-staging/deskflow-data.db ../linux-staging/deskflow-data.db; do
  echo "== $db"; for t in $(sqlite3 "$db" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"); do
    printf '%s\t%s\t%s\n' "$t" \
      "$(sqlite3 "$db" "SELECT COUNT(*) FROM \"$t\";")" \
      "$(sqlite3 "$db" "SELECT COALESCE(MAX(rowid),0) FROM \"$t\";")"
  done
done | tee rowcounts-$TS.txt
```
- **WAL rule: a WAL-mode DB never travels without its `-wal`/`-shm`** — both archived; checkpoint happens on the staging COPY only, originals on the mount untouched.
- **Decision rule (defaults-taken, not a question):** authority = the side with ≥ row counts AND ≥ MAX(rowid) on the session-bearing tables, mtime as corroboration. Expected per census: Windows side leads. If the sides SPLIT (each leads on some tables beyond noise) = ambiguous authority = **STOP for principal row-B ruling**. Loser archived in `~/rheo-migration-archive/<TS>/`, never merged, never deleted.
- Place winner: `cp -p` the checkpointed staging DB to `~/.config/RHEO/deskflow-data.db` (after `.backup.$TS` exists). Linux prefs/sleep/window JSONs stay regardless — they are Linux-native state; only the DB crosses.
- Filenames settled by census: `deskflow-data.db` both sides; the `deskflow.db` variant in `COMMON_ERRORS_FIXED.md:95-98` does not exist — doc erratum, noted.
- Post-boot row-count report (G-MIG-8) is compared against `rowcounts-$TS.txt`, not against "non-zero".

### h. Secrets
```bash
sha256sum .env   # compute on source (via mount) and on ~/dev/rheo/.env — MUST match; contents never printed
git ls-files --error-unmatch .env            # EXPECT: error/not tracked — tracked = STOP (secrets in index)
git ls-files --error-unmatch opencode.json   # if TRACKED → PROPOSAL ONLY, recorded for principal:
#   git rm --cached opencode.json + .gitignore entry — NOT executed now, no history rewrite
```

### i. npm ci — both codebases + native rebuild
```bash
grep -nE '"(postinstall|install)"' package.json landing/package.json   # cite what ACTUALLY wires the rebuild
npm ci
grep -o '"electron": *"[^"]*"' package.json                            # confirm ABI target (bundle says 41 — verify, don't trust)
npx electron-builder install-app-deps                                  # if not already wired by postinstall
(cd landing && npm ci)
```
`active-win`/`node-pty`/`better-sqlite3` build failure on Linux: tee the full stderr to a log, keep the deps in package.json, flag R-33g for P0 arbitration. Never silent-remove.

### j. inotify
```bash
sudo sysctl -w fs.inotify.max_user_watches=524288
echo 'fs.inotify.max_user_watches=524288' | sudo tee /etc/sysctl.d/99-rheo-inotify.conf
sudo sysctl --system && sysctl fs.inotify.max_user_watches   # EXPECT: 524288 (from 275411)
```

### k. Playwright
```bash
npx playwright install --with-deps    # project-local 1.62.1; system deps via sudo when prompted
```

### l. Path fixes — apply §4 table, then re-grep
```bash
grep -rnE 'C:\\\\|%APPDATA%|LOCALAPPDATA|PROGRAMFILES|/run/media|COMPUTAH_SAYENCE' ~/dev/rheo \
  --exclude-dir={node_modules,dist,dist-electron,release,.git,.vite,landing} --exclude='*.md'
```
Resulting hit set must equal the §4 whitelist exactly (opencode.json `../probe` line + excluded-files list). Anything new = fix or STOP.

### m. Start script
Read `package.json` `scripts` (executor-time; exact launch entry not in any census). Create `scripts/launch-linux.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
export WAYLAND_DISPLAY=              # force X11 mode per launch law
exec <EXACT electron command from package.json scripts>
```
`chmod 755 scripts/launch-linux.sh` (untracked file → no porcelain mode noise). No `DeskFlow` strings (Law 6). Name/path recorded here once the script entry is read.

### n. Sibling probe
```bash
rsync -a --info=progress2 --exclude node_modules --exclude dist \
  '/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/probe/' ~/dev/probe/
(cd ~/dev/probe && npm ci && npm run build)
ls -l ~/dev/probe/dist/index.js      # EXPECT: exists, freshly built (G-MIG-9)
```

## 3. Git command ledger

| Command | Purpose | Destructive? |
|---|---|---|
| `cat .git/HEAD`, `cat .git/refs/heads/master` (both sides) | HEAD parity | no (file read) |
| `git ls-files -s` (×3: exec set, symlink scan) | index-mode reads | no |
| `git ls-files -- <excluded paths>` | exclusion safety (b) | no |
| `git ls-files` (case scan, e) | collision gate | no |
| `git status --porcelain` (pre/post flip; gates) | dirty-set capture | no (writes stat-cache only) |
| `git diff <file>` | mode-only vs content diagnosis | no |
| `git ls-files --error-unmatch .env / opencode.json` | tracking census | no |
| `git config --get` (aliases ×6, postBuffer, remote.url, autocrlf) | G-MIG-2/4 | no |
| `git config core.filemode/ignorecase/symlinks/autocrlf <v>` | platform flips | **config-set only — mutates `.git/config`, never refs/index/tree** (labeled honestly) |
| `git rm --cached opencode.json` | PROPOSAL ONLY — never executed in this plan | would mutate index |

Blocking aliases travel with `.git/config` (verify: `git config --get alias.reset` → `BLOCKED: …` echo). Plan invokes none of the six blocked verbs; push-free by construction (alias + Law 2). All git runs in `~/dev/rheo` (ext4); the mount sees only `cat`/`rsync`/`stat`/`sha256sum` reads.

## 4. Path-fix table (final — census §4 supersedes bundle §6)

| File | Current | Fix | Pattern used |
|---|---|---|---|
| `check-db.js:6` | `APPDATA \|\| homedir/AppData/Roaming` | platform branch → win32 APPDATA / else `~/.config/RHEO` | `migrate-fixed.mjs:8-15` |
| `check-tables.cjs:5` | same | same | same |
| `list-tables.cjs:5` | same | same | same |
| `test-ipc.cjs:4` | same | same | same |
| `src/main.ts:1554-1561` (×2) | `LOCALAPPDATA \|\| homedir/AppData/Local` | platform branch → win32 LOCALAPPDATA / else `~/.config/hermes/profiles` | `migrate-fixed.mjs` pattern |
| `src/main.ts:8944-8945` | `PROGRAMFILES \|\| 'C:\Program Files'` | platform guard; Linux = `which`-based browser lookup, graceful log-and-skip degradation | same platform-branch shape |
| `src/gameDetection.ts:56-57` | hardcoded Steam x2 (`C:\Program Files (x86)\Steam`, `C:\Program Files\Steam`) | platform branch → Linux candidates `~/.steam/steam`, `~/.local/share/Steam` | same pattern |
| `src/main.ts:16370` | `%APPDATA%` in informational prompt string | update text to both-path wording (cosmetic; default-taken) | n/a |

**Excluded (not live path logic; verified by census):** `FortressProtocolSetup.tsx` (generated-PS1 UI strings), `CaptureView.tsx:192,206` + `IDEProjectsPage.tsx:2763-2764,2785,3895` (placeholders), `StatsPage.tsx` (variable names only), `--help/*.json` (regenerable artifacts; rsync-excluded), all `*.md` session logs + `nuclear-fix.ps1` (Law 5), `opencode.json` `../probe` (preserved by layout, §1). `scripts/*.mjs` audited clean (zero hits).

## 5. Data + secrets notes

- **DB authority is evidence-decided at quiesce** (§2-g decision rule), replacing the bundle's Linux-side default — census proved the Windows side carried a live WAL (Sep 12 22:04) on a same-sized main DB; identical byte size proves nothing (sha256 both staging copies at decision time). Both sides archived, never merged; fork = STOP for row B.
- Filenames: `deskflow-data.db` (+ `.json`) verbatim, both sides; `deskflow.db` confirmed nonexistent.
- `.env` travels via `--include='/.env'` (approved Deviation 1); sha256 gate at §2-h; never printed.
- `opencode.json`: tracking status decided at §2-h; if tracked → `git rm --cached` PROPOSAL recorded for principal; no history rewrite, no secrets in any log.
- `agent/backups/` carried (not in exclude list). `.build-lock` excluded — stale lock would refuse the first build (R-31). `--help/` excluded pending the b tracked-check (deviation D6).

## 6. Verification gates (ordered; PASS/FAIL recorded verbatim in the ledger)

- **G-MIG-1** `git status` on `~/dev/rheo`: warm-up run (index re-hash after copy; record duration, exempt), then measured run **< 5s**. (vs 180s+ timeout on mount.)
- **G-MIG-2** HEAD SHA parity `0b066b8d1e1a31f96b53925efec95770c5cbaca7`; `git config --get remote.origin.url` = `https://github.com/RCZ88/RHEO.git`.
- **G-MIG-3** Porcelain parity, run TWICE: (i) after §2-f — equals the ledger's staged set (Atlas landing rows per R-6 + splash fixes), zero extras; (ii) after §2-l — staged set **plus exactly the §4 fix files + `scripts/launch-linux.sh`**, nothing else. Any other entry = STOP + report.
- **G-MIG-4** Six aliases return `BLOCKED` echo; `http.postBuffer` = `524288000`; core flips = filemode true / ignorecase false / symlinks true / autocrlf input.
- **G-MIG-5** `npm ci` exit 0 ×2 (root + landing) + native rebuild success — or R-33g flag with verbatim build log.
- **G-MIG-6** Grep audit (§2-l) hits = §4 whitelist exactly; `../probe` only in `opencode.json`; `*.md`/`.ps1` excluded per law.
- **G-MIG-7** `rm -rf dist dist-electron` → `npm run lint` exit 0 → `node scripts/build.mjs` exit 0 → verify served artifact: `dist-electron/main.cjs` + renderer output present. **BUILD-skill flag:** §3-4 served-artifact law reconstructed from bundle text; executor applies the loaded skill text at this gate if available.
- **G-MIG-8** Shell-launch: Playwright `_electron.launch` on the new path, `WAYLAND_DISPLAY=` (X11), bounding-box assertions + screenshots; dashboard row counts compared per-table against `rowcounts-$TS.txt` — **every count ≥ snapshot; empty dashboard = data loss = FAIL loudly** (empty ≠ zero). Same BUILD flag as G-MIG-7 for §3-5 law text.
- **G-MIG-9** `~/dev/probe/dist/index.js` exists and resolves from `opencode.json`'s `../probe/dist/index.js`.
- **G-MIG-10** Rollback: sha256 of 3 sampled source files (`package.json`, `scripts/build.mjs`, one landing file) identical pre/post; source mount mtimes unchanged. Abandonment = `rm -rf ~/dev/rheo ~/dev/probe` + restore `~/.config/RHEO.backup.$TS`; archives retained.

## 7. Open questions

None. Pre-staged rows recorded as defaults-taken:
- **A — target path:** `~/dev/rheo` + `~/dev/probe` (default taken).
- **B — authoritative DB:** default taken = the §2-g evidence procedure with tie-break and fork-STOP; the census itself retired the old Linux-side default (live Windows WAL). Principal may override the evidence at any point before §2-g placement.
- **C — filemode commit:** moot in a commit-free plan — config flip happens now (§2-d); any resulting porcelain is committed only if the principal later asks.
- **Deviation 1 nod:** granted (census §6) — recorded, not re-asked.

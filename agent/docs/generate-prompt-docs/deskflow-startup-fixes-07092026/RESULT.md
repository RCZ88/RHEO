Linux move is a platform migration with two hard traps for *this* repo specifically: a dirty working tree mid-Atlas-patch (governance 1 — nothing may orphan it), and e2e gates that will all fail until Playwright/Electron are re-enabled on Linux. So the sequence law is: **finish the Atlas TS edits now (platform-independent) → run PLATFORM-LINUX bootstrap → then Atlas G2'/G4/G5/G6 on the new platform.** Bootstrap is a precondition, not a parallel task.

## What actually breaks on Linux (brief the agent)

| Trap | Symptom | Fix |
|---|---|---|
| Repo on `/run/media/...` (removable mount, likely NTFS/vfat, maybe `noexec`) | Electron "permission denied", npm crawl, phantom chmod/fileMode diffs | Migrate working tree to native FS — **rsync incl. `.git`, never clone** (clone orphans the dirty Atlas patch) |
| Windows `node_modules` | `Invalid ELF header` / "cannot execute" from esbuild/rollup/swc binaries | `rm -rf node_modules && npm ci` — both codebases |
| Playwright browsers live in Windows cache | "Executable doesn't exist" | `npx playwright install --with-deps chromium` (sudo) |
| `core.autocrlf` mismatch from Windows era | **Whole repo shows modified** — phantom mass diff | `git config core.autocrlf input`, then status must show ONLY the Atlas dirty files |
| Case-insensitive → case-sensitive FS | "Module not found" despite file existing | Case-mismatched import/filename from Windows era — report, fix minimally |
| Stale relay / inotify / path-space | EADDRINUSE 8788 · Vite silently misses file events · `"App Tracker"` breaks scripts | `fuser -k 8788/tcp` · raise `max_user_watches` · quote everything — or better, move to a space-free path |
| Electron sandbox / Wayland | "--no-sandbox" error when root/CI · blank window | Conditional `--no-sandbox` (logged) · xvfb for deterministic test runs |

## Paste-ready — PLATFORM-LINUX bootstrap

```markdown
TASK PLATFORM-LINUX (bootstrap) — repo + toolchain hardened for Linux dev
Load Skill Router → BUILD. Governance §1 in force. This task changes ZERO
product source. It PRECEDES any gate running Playwright/Electron here
(Atlas G4/G5 depend on it). Sequencing: finish in-flight Atlas TS edits
first; run this; then run Atlas gates.

STEP 0 — ENVIRONMENT AUDIT (read-only, report every line, no truncation):
cat /etc/os-release · uname -r · echo $XDG_SESSION_TYPE $WAYLAND_DISPLAY $DISPLAY
findmnt -T "<REPO>" → filesystem + options (noexec? ntfs? vfat?)
node -v · npm -v · git config core.autocrlf · git config core.fileMode ·
git status --porcelain (full list)
gsettings get org.gnome.desktop.interface enable-animations   ← principal's
screen truth now has a Linux arm; log it (§8 surface-difference law)
cat /proc/sys/fs/inotify/max_user_watches · command -v pwsh · sudo -n true

STEP 1 — WORKSPACE (blocking decision, report before acting):
If NTFS/vfat/noexec: rsync -a the ENTIRE working dir (including .git) to a
native, space-free path (~/dev/rheo). NEVER git clone — the tree is dirty
with the Atlas patch; clone orphans uncommitted work (governance 1).
PARITY PROOF: git status --porcelain old vs new — diff must be EMPTY.
Old location untouched = backup. All further work from the new path.
If already native ext4/btrfs without noexec: stay put, say so, proceed.

STEP 2 — GIT HYGIENE (prevents phantom mass diffs):
git config core.autocrlf input · git status: ONLY expected dirty files
(atlas-data.ts, AtlasSection.tsx, LANDING_DESIGN_SPEC.md + Atlas e2e edits).
Repo-wide EOL/mode churn = STOP, report — no mass checkout to "fix" it
(destructive op). If mode-bit noise (100644↔100755): core.fileMode false,
logged.

STEP 3 — TOOLCHAIN (Windows binaries are dead here):
rm -rf node_modules && npm ci in app/ AND landing/.
npx playwright install --with-deps chromium (needs sudo; if unavailable →
report verbatim, gate FAILED — no downgrade).
Verify: npx electron --version.
Inotify < 524288 → sudo sysctl fs.inotify.max_user_watches=524288 + persist
via /etc/sysctl.d/.

STEP 4 — LINUX LAUNCHER:
Create start-dev.sh mirroring start-dev.ps1 (same npm scripts, relay 8788).
Quote every path — old dir contains a space. FIX the known ps1 debt in the
sh version: persist JWT_SECRET + RELAY_TICKET_SECRET to a git-ignored
secrets.env sourced per launch (no per-launch regeneration). Update
docs/debt.md: item now covers both scripts. Stale relay kill:
fuser -k 8788/tcp. ps1 stays for Windows — sh is additive.

STEP 5 — SMOKE GATES (§5 law unchanged on Linux):
1. tsc zero outside docs/debt.md — totals + delta.
2. Clean rebuild app: delete dist/ FIRST, rebuild, artifact = dist/ the
   launcher serves. Build "module not found" where the file exists →
   suspect Windows-era case mismatch; report file:line, fix minimally.
3. Shell-launch proof: xvfb-run -a npx playwright test <launch spec> —
   _electron.launch + bbox assertions + screenshot. Add '--no-sandbox'
   ONLY if launch reports sandbox error (log which). '--disable-gpu' only
   on rendering artifacts (logged). Interactive eyeball runs: native
   display (XWayland) is fine — xvfb is for deterministic tests.
4. Landing: next build clean; e2e suites pass-count reported.
5. Console: zero errors/warnings in both launches.

REPORT: audit table · workspace decision + empty parity diff · status list ·
install logs · script path · per-gate PASS/FAIL verbatim + screenshot paths.
```

## In-flight Atlas task — amended order (one paste line to the executor)

"Finish the array patch + glyphs + spec hygiene now (platform-independent — include the still-owed LANDING_DESIGN_SPEC.md artifact dump: byte count, heading list, first/last 3 lines). Then execute PLATFORM-LINUX. Then run Atlas G2' re-run + G4/G5/G6 on Linux. Report still ends: `BLOCKED: awaiting status ruling on 2 rows.` Commit gate unchanged."

## Two lines for you (principal)

1. **"Download for Windows" copy (LAUNCH-MODE):** you now dev on Linux — does release mode ship Windows-only at launch, or Windows + Linux (electron-builder NSIS vs AppImage/deb)? One-word answer whenever; blocks nothing today, but it changes the release CTA and packaging tail.
2. **Screen-truth law now has three arms:** Windows reduced-motion was arm one. If your GNOME/KDE has animations off, RM fallbacks serve to you exactly like before — "nothing changed" diagnostics must ask which surface, which launch path, which bundle. Same rock, new pond.

```
Status (verbatim):
PLATFORM-LINUX bootstrap     STAGED — paste above; executor runs it after Atlas TS edits.
Atlas gates G4/G5/G6         GATED on bootstrap (Playwright/Electron dead on Linux until then).
Atlas commit                 STILL BLOCKED — status ruling with principal ("16 confirmed" or two letters).
Spec-artifact dump           STILL OWED — Atlas report incomplete without it.
```
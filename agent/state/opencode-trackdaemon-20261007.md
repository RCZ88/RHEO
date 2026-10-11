<!-- SESSION: opencode-trackdaemon-20261007 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-trackdaemon-20261007

> **STATUS:** completed | **UPDATED:** 2026-10-08T04:15:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Build an always-on RHEO time tracker (systemd user service, Linux partition) that runs with the app closed.
**STATUS:** working
**IN FLIGHT:**
- (none — cycle complete)
**COMPLETED:**
- CZ chose to move the profile to `~/.config/RHEO`. DONE: verified backup first
  (`~/rheo-migration-backup-20261007-221011`, all 9 tables matched, integrity ok, sha256 recorded),
  stale fossil preserved as `~/.config/RHEO.stale-fossil-*`, rsync done, `cmp` byte-identical,
  `start-dev.sh:370-375` now defaults to `$HOME/.config/RHEO` and no longer probes NTFS.
- **SERVICE IS LIVE AND TRACKING.** `rheo-tracker.service` enabled + running; wrote rows
  33761-33763 (firefox/konsole) to the Linux DB; app handover proven live — on app launch it
  flushed the open session, released 54321 and stood down with zero double-counting.
  NTFS original verified frozen at 33,760 rows = full rollback intact.
- Refactor pass: removed 6 dead symbols, added `rheo-tracker/tsconfig.json` with
  `noUnusedLocals`/`noUnusedParameters` so the sweep stays clean. tsc exit 0.
- Wrote `rheo-sync` (Windows⇄Linux merger) + `rheo-sync.sh`. Verified on COPIES ONLY:
  Linux-only, both-sides-divergent, idempotent, and the writer gate (which refused
  correctly with divergence present — the first gate test had passed trivially).
- **HANDOFF DOC WRITTEN: `agent/docs/RHEO_TRACKING_MIGRATION.md` (341 lines).**
  Wired into THREE places so a future session cannot miss it: `AGENTS.md` §0-0z
  (force-loaded at repo root), `agent/SURFACES.md` (confused-pairs row +
  Cross-cutting migrations table), and `opencode.json` `instructions[]`.
  Contains: the 3 root-cause facts, all 8 bugs with the lesson in each, backup and
  rollback paths, the scoped typecheck recipe, and the sandbox recipe for testing a
  merge without touching real data.
- Proved `src/linuxForeground.ts` works headless: native Wayland via kdotool, ~40ms/poll, correct app + title, no Electron.
- Built `rheo-tracker/` (7 files): daemon, session state machine, DB layer, ownership lock, browser ingest on 54321, systemd unit, installer.
- Verified: tsc clean, 46KB self-contained bundle, tracks konsole→webstorm→zen, 60s checkpoint + SIGTERM flush, browser ingest end-to-end, trigger correctness (38144.5s vs 38144.467s), second-instance lock, zero writes while app runs.
- Found and fixed 6 real bugs (see NOTES).
**NEXT ACTION:** None required. To verify by hand:
`systemctl --user status rheo-tracker` and `journalctl --user -u rheo-tracker -f`.
To roll back: `./rheo-tracker/uninstall.sh`, then restore `start-dev.sh` and point
`ELECTRON_USER_DATA_DIR` back at the NTFS profile (still intact).
**NOTES:**
- **THE ROOT CAUSE:** `start-dev.sh:370-375` passes `--user-data-dir=<NTFS>/Application Data/RHEO` on purpose. So the APP ITSELF needs the Windows mount — not just the daemon. `~/.config/RHEO` is a stale 29,289-row fossil; the live DB has 33,613 rows.
- Bugs found by testing on a DB copy (all fixed, none reachable by tsc alone):
  1. `isAppRunning()` matched nothing — `dist-electron/main.cjs` never appears in argv.
  2. `startBrowserServer()` never resolved on EADDRINUSE → top-level `await` hung → polling never started.
  3. "standing down" logged once per second (~86k journal lines/day).
  4. DB hardcoded to `~/.config/RHEO` → would have written a parallel history.
  5. Heartbeat filled by blind spread → `rowsWritten: 0` after writing 4 rows.
  6. `session.ts` read `open.category` after `flush()` nulled `open` → threw once per 60s checkpoint, i.e. on exactly the long sessions the daemon exists for. Caught by tsc (`TS18047`).
- Also fixed 2 syntax errors: unquoted `microsoft edge` key; `*/` inside a comment closing it early.
- Known gap: app minimized-to-tray still untracked (daemon stands down, app's loop lives inside `createWindow()`). Proper fix needs a `main.ts` change → CZ must build.

---

## HISTORY (previous 2 cycles, oldest first)

_(first cycle for this session)_
<!-- SESSION: opencode-afk-input-20261020 -->
<!-- AGENT: opencode | TERMINAL: afk-input | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-afk-input-20261020

> **STATUS:** source half fixed + deployed daemon; RUNNING APP awaits CZ build | **UPDATED:** 2026-10-24T06:20Z

---

## CURRENT CYCLE (2)
**ROLE:** Verify normal tracking end-to-end (sleep / AFK / app detection).
**STATUS:** VERIFIED (DB + journal + probes). NEW defect found + fixed this cycle: app-identity aliasing.
**IN FLIGHT:** CZ: rebuild + reopen → watch `idea` replace `jetbrains-idea`; then resume tracking-time spec.
**COMPLETED:**
- Sleep: no `logs` rows span suspend/shutdown (journal-matched gaps verified; first post-wake
  row written at wake+9s). Sleep pattern + external_sessions records hold. Two-clock flush proven.
- AFK: prefs `afkThresholdMinutes=5`, sleep window 23–7 enabled, trackerAppMode=track.
  App main holds live evdev input clock (25 fds), heartbeat/auto-resume/return detector wired,
  renderer bundle contains the new code. Probes: AFK 10/10, sleep 12/12, categories (extended) 68 ALL PASS.
- Categories: today (2026-10-24) has ZERO non-canonical rows; last-6 rows all canonical.
- NEW FIX (this cycle): canonical app identity + daemon shell filter.
  `src/shared/appIdentity.ts` (aliases: jetbrains-idea→idea, idea64→idea, app.zen_browser.zen→zen,
  zen_browser→zen, org.kde.dolphin→dolphin, org.kde.okular→okular, org.kde.kwrite→kwrite).
  Applied in `src/main.ts` poll + daemon `normalizeApp`; substring shell filter in daemon
  (filters org.kde.polkit-kde-authentication-agent-1, ksecretd, systemsettings, plasma-systemmonitor);
  `kwrite` → Productivity added to app + daemon category maps. `org.kde.konsole` deliberately NOT
  aliased (user has conflicting overrides there).
- Daemon rebuilt (`rheo-tracker/build.mjs`, 58.2 KB), restarted (`rheo-tracker.service` pid 132137,
  input fds 25), probes re-run: ALL PASS. Source zips refreshed (`scripts/zip-src.mjs`).

**NEXT ACTION:** CZ builds + reopens; verify live DB now shows single-identity `idea` sessions.

**NOTES:** Live DB flapping (pre-fix) seen today: `zen` ↔ `app.zen_browser.zen`, `webstorm` ↔
`app.webstorm`? (no) — observed `zen`/`app.zen_browser.zen` alternating rows ~5s apart; fixed by alias.
Running app main.cjs (2026-10-22) does NOT yet contain the alias fix → needs CZ build. No debug port.

---

## HISTORY
_(new spoke — no earlier cycles)_

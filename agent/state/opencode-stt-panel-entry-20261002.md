<!-- SESSION: opencode-stt-panel-entry-20261002 -->
<!-- AGENT: opencode | TERMINAL: unknown | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-stt-panel-entry-20261002

> **STATUS:** completed | **UPDATED:** 2026-10-02T00:00:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix "the panel shows the app's loading screen + boot timeout" and "the shortcut never closes it"
**STATUS:** completed
**IN FLIGHT:** nothing — leases released
**COMPLETED:**
- **ROOT CAUSE of the timeout.** The panel window loaded `/index.html#/stt-float`, i.e. the
  WHOLE app in a 400x560 frameless window: `BootGate` (main.tsx:27, a **2000ms** timeout
  awaiting splash IPC), NumberMaskProvider, HashRouter, SmoothScrollProvider, 4 stylesheets and
  the 193KB App. Worse, the `#/stt-float` branch I had added to App.tsx had been **reverted by
  another agent** (App.tsx is 193KB and heavily rewritten), so nothing short-circuited the boot
  at all — the panel was permanently stuck on the app's loading screen.
  Verified: `stt-float` was absent from all 122 built chunks while `mini-todo`/`AppRoot` were
  present, proving the built App.tsx lacked my branch.
- **FIX: a real standalone Vite entry.** `stt-panel.html` + `src/stt-panel.tsx`, with
  `vite.config.ts` `rollupOptions.input = { index: 'index.html', 'stt-panel': 'stt-panel.html' }`.
  Entry key kept as `index` so `assets/index.[hash].js` is NOT renamed.
  `main.ts` now `loadFile(dist/stt-panel.html)` (dev: `VITE_DEV_SERVER_URL/stt-panel.html`).
  Proven app-free via esbuild metafile: **7 project files**, and App.tsx / main.tsx / BootGate /
  BootOverlay / HashRouter / NumberMaskProvider / Sidebar / react-router-dom all absent.
  1.38 MB entry graph vs 27.24 MB for the app.
- **FIX: shortcut now closes.** `toggleSttPanelWindow()` is a true toggle — close when open,
  open when closed — wired into both global registration sites. The old version only ever
  opened. Removed the now-unused `sttShortcutTarget()`.
- **FIXED A TRAP I CREATED:** with a real toggle, `stt:shortcut-triggered` never fires, so the
  panel's on-screen "Press Start or Ctrl+Shift+V" would have told users to press a key that
  CLOSES the panel. Removed the dead subscription and rewrote the copy to Space/Esc.
- Also: `stt-panel.html` has its own inline fallback styles + a 4s watchdog, so a failed bundle
  shows a real message instead of a blank frameless window.
**BEHAVIOUR CHANGE TO FLAG:** Ctrl+Shift+V is now the panel show/hide toggle, so the old
"inline per-input mic" hotkey no longer fires from it. Inline mic buttons still work by click.
One-line revert available in main.ts if CZ wants both.
**NEXT ACTION:** CZ builds and tests. Needs a speech API key for real transcription.
**NOTES:** `validate:pages` now FAILS on `/agentic` (App.tsx:3349, another agent's route with no
manifest) — not mine, I touched no registry file and added no route.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 0 — opencode-stt-reach-20261002
Fixed the dead feature: launcher moved from never-imported `settings/ColorsSection.tsx` into
live `SettingsPage.tsx`; added `onSttPanelState`; caught that `Mic` was not in SettingsPage's
lucide import (would have been a runtime ReferenceError that esbuild AND tsc both pass).

### Cycle -1 — opencode-stt-float-20261002
Shipped `useSttFloat.ts`, `SttFloatPanel.tsx`, `stt:panel-*` window, and 6 real STT bug fixes
(snake_case transcript list, dropped INSERT columns, `{ok,id}` stored as id, lying `stt:local-*`
stubs, preload allowlist typo, dead hotkey targeting).

---
<!-- SESSION: opencode-stt-build-20261002 -->
<!-- AGENT: opencode | TERMINAL: unknown | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-stt-build-20261002

> **STATUS:** completed | **UPDATED:** 2026-10-04T10:50:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Build the app (CZ authorised via AGENTS.md §0-0 exception) and verify the STT widget at runtime
**STATUS:** completed
**IN FLIGHT:** nothing — Probe closed, no leaked processes
**COMPLETED:**
- **BUILT IT. `npm run build` → exit 0**, all four steps (renderer 7922 modules / preload
  138 KB / services / main 1614 KB). No OOM. First attempt was interrupted by the user
  after the renderer step; renderer+preload had landed, `main.cjs` was stale, so I re-ran
  the full build to completion.
- **Verified the standalone entry actually emitted**: `dist/stt-panel.html` + 
  `dist/assets/stt-panel.*.js` = **24 KB** vs a 15 MB app entry.
- **RUNTIME BUG FOUND THAT NO STATIC CHECK COULD SEE:** all 24 waveform bars rendered at
  26px (a solid block) instead of collapsing to 3px. `framer-motion`'s `animate={{scaleY:1}}`
  OWNS the `transform` property and overwrote my inline `scaleY(...)`. The SSR render probe
  PASSED because framer only claims the property on the client. Fixed by making the bars
  plain `<span>`s with a bound `transform`, and the level bar a plain span too.
- **Runtime verified in the real app** via Probe:
  • window is exactly **300x60**, frameless, `isAlwaysOnTop() === true`,
    URL `file://.../dist/stt-panel.html` (NOT the app bundle), windowCount 2
  • content fits exactly (scrollHeight 60 / clientHeight 60), no overflow
  • bars now collapse to 3px (`allCollapsedTo3px: true`)
  • `Ctrl+Shift+V` closes it (windows 2 → 1) — a true toggle
  • drag moved it (16,10) → (520,240), size unchanged, and
    `stt-panel-bounds.json` contains `{"x":520,"y":240}` — position persists
  • Settings → **Colors** tab → "Floating dictation panel" launcher present, live label
    tracked state (Close ↔ Open), and a REAL click round-tripped open→close→open
  • `/labs` renders TranscriptShelf with empty state + "Open dictation widget"
  • main + renderer consoles CLEAN
- `sttGetStatus()` on this Linux box returns `{engine:'browser', apiConfigured:false,
  nativeAvailable:false}` → **no working engine without an API key**, so actual recording
  could not be exercised here. That is the real limitation, not a bug.
VERDICT: PASS at runtime for everything except end-to-end transcription (needs an API key).
**NEXT ACTION:** CZ adds a speech API key (Settings → Voice & Speech) to test real recording.
**NOTES:** Voice & Speech lives under the **Colors** tab in Settings, not General — that is
pre-existing app structure, not something I moved.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle -1 — opencode-stt-lab-20261002
Rewrote the panel as a 300x60 capsule; click=record / drag=move with 4px threshold;
persisted bounds; added Ctrl+Shift+R global record toggle; TranscriptShelf on /labs.
Caught a `/labs` white-screen from array-destructuring a `useRef`.

---
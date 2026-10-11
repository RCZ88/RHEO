<!-- SESSION: opencode-stt-lab-20261002 -->
<!-- AGENT: opencode | TERMINAL: unknown | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-stt-lab-20261002

> **STATUS:** completed | **UPDATED:** 2026-10-02T00:00:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Make the STT widget TINY + draggable, add a global record hotkey, put transcripts on /labs
**STATUS:** completed
**IN FLIGHT:** nothing — leases released
**COMPLETED:**
- **Rewrote `SttFloatPanel.tsx` as a 300x60 capsule** (was 400x560 = an app, not a
  widget). Single row: 24-bar waveform | one line of text | mono `m:ss` | hover controls,
  plus the 3px level hairline. Design EXTRACTED from `VoiceInputWrapper.tsx`'s portalled
  speech card (same 3px rounded bars with brighter centre bars, hairline divider, italic
  truncated interim, level hairline) + the stopwatch's mono tabular readout.
- **Click = record, drag = move.** Manual drag with a 4px threshold via a new
  `stt:panel-move` IPC. Deliberately NOT CSS `-webkit-app-region: drag`, because a drag
  region swallows mouse events and would kill click-to-record on the same element.
- **Position persists** to `stt-panel-bounds.json` in userData; restored on create and
  clamped to the current display so a stale monitor position can't strand it offscreen.
- **Window is `resizable: false`** so it can never grow back into a big panel.
- **`Ctrl+Shift+R` = global record toggle** (`requestSttRecordToggle`): summons the widget
  if hidden (waiting for `did-finish-load` so listeners are attached), then commands it.
- **`TranscriptShelf.tsx` on `/labs`**: search, mono clock + relative time, copy, delete,
  skeleton loading, error+retry, empty state. Saved transcripts previously had NO read
  surface anywhere, so "it saved" looked identical to "it vanished".
- **CAUGHT A REAL CRASH:** `const [searchRef, setSearchRef] = useRef(...)` array-destructured
  a RefObject → "object is not iterable" → would have white-screened `/labs`. Found by the
  SSR render probe; the ref was unnecessary and is gone.
VERDICT: PASS on static + logic layers. NOT TESTED at runtime (no build — §0-0).
**NEXT ACTION:** CZ builds. Needs a speech API key in Settings → Voice & Speech, otherwise
there is NO engine on Linux (no webkitSpeechRecognition, no Windows-native fallback).
**NOTES:** `validate:pages` still fails on `/agentic` (App.tsx:3349) — another agent's route
with no manifest, not mine. A second dead feature is left alone: `TranscriptLibraryPage`
(1150 lines, 0 importers, imports `sttStore`/`getCategoryLabel` which don't exist).

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle -1 — opencode-stt-panel-entry-20261002
Diagnosed "the panel shows the app's loading screen + boot timeout": it loaded
`/index.html#/stt-float`, booting BootGate (2s splash wait) + HashRouter + 193KB App in a
400x560 window — and the `#/stt-float` branch had been REVERTED by another agent, so nothing
short-circuited the boot. Replaced with a real standalone Vite entry (`stt-panel.html` +
`src/stt-panel.tsx`), proven app-free via esbuild metafile (7 project files). Made the
shortcut a true toggle.

### Cycle -2 — opencode-stt-reach-20261002
Fixed the dead feature: launcher moved out of never-imported `settings/ColorsSection.tsx`
into live `SettingsPage.tsx`; caught `Mic` missing from SettingsPage's lucide import.

---
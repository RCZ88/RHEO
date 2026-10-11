<!-- SESSION: opencode-stt-local-20261004 -->
<!-- AGENT: opencode | TERMINAL: unknown | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-stt-local-20261004

> **STATUS:** completed | **UPDATED:** 2026-10-04T12:30:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Make speech-to-text LOCAL (no API key) and turn the widget into an in-app floating overlay
**STATUS:** completed
**IN FLIGHT:** nothing — Probe closed, no leaks
**COMPLETED:**
- **LOCAL ENGINE, not cloud.** Added `stt:local-availability` (spawnSync probe, cached) and
  `stt:transcribe-local` (base64 → temp file → `faster_whisper.WhisperModel` on CPU/int8 →
  delete temp files in `finally`). `stt:get-status` now returns `engine:'local'` with
  `localAvailable/localReason/localInstall`. Cloud is now only a fallback if a key happens
  to be set.
- **BUG FIXED: `sttModel` held a CLOUD id** (SettingsPage defaults it to
  `whisper-large-v3-turbo`). faster-whisper identifies models by SIZE, so passing it
  straight through would request a non-existent HF model. Added `sttLocalModelSize()`
  with a `STT_LOCAL_SIZES` allowlist, defaulting to `base`.
- **INSTALLED the enabling dep:** `faster-whisper 1.2.1`. It shipped broken against
  `av 19` (`faster_whisper/audio.py` passes `metadata_errors`, removed in PyAV 19) →
  pinned `av<19` (18.1.0). Verified the real pipeline: model loads in 1.4 s, decodes a
  WAV, returns empty text for a tone — no crash.
- **IT IS A FLOATING THING IN THE APP, NOT A WINDOW.** Replaced the frameless
  always-on-top BrowserWindow with a `createPortal(document.body)` overlay
  (`src/features/stt/DictationOverlay.tsx`) — the same technique
  `VoiceInputWrapper.tsx` already uses. Deleted: `stt-panel.html`,
  `src/stt-panel.tsx`, `SttFloatPanel.tsx`, `createSttPanel`, 6 `stt:panel-*`
  handlers, `stt:panel-move`, and the Vite second-entry input. `dist` back to one entry.
- **IT MATCHES THE IN-APP SPEECH UI.** Card classes, 3px rounded-full bars, `w-px
  zinc-700/50` divider, italic truncated status, terracotta mic button + pulse, red stop
  button, 3px `bg-[#e8866b]/60` level bar — all copied from `VoiceInputWrapper`'s card.
  The first version used token colours and looked like a different app; this one does not.
- Visibility moved to `src/features/stt/dictationStore.ts` (module scope + localStorage)
  so the Settings launcher, the /labs launcher and both hotkeys share one source.
- Hotkeys now target the main window: `Ctrl+Shift+V` → `stt:overlay-toggle`,
  `Ctrl+Shift+R` → `stt:record-toggle`.
**RUNTIME VERIFIED:** `engine:'local'`, faster-whisper 1.2.1 detected; overlay is a BODY
portal with `position:fixed`, `z-index:99999`; **windowCount stays 1**; bar colours
measured `rgba(232,134,107,·)` centre / `rgba(217,104,70,·)` outer, identical to the app
card; toggle hides/shows; console clean.
**LESSON WORTH KEEPING:** framer-motion owns `transform` — an `animate={{scaleY:1}}` on a
bar silently flattened all 24 waveform bars to full height in the real app while SSR
probes still passed. Bars that need a bespoke inline transform must be plain elements.
**NEXT ACTION:** real microphone test — needs CZ to grant mic access in the app.

---
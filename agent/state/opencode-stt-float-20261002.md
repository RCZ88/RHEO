<!-- SESSION: opencode-stt-float-20261002 -->
<!-- AGENT: opencode | TERMINAL: unknown | PROJECT: /run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Documents/COMPUTAH_SAYENCE/App Tracker -->

# Agent State — opencode-stt-float-20261002

> **STATUS:** completed | **UPDATED:** 2026-10-02T00:00:00.000Z

---

## CURRENT CYCLE (1)
**ROLE:** Fix Speech-to-Text + ship an always-on-top floating STT window (save + copy on finish)
**STATUS:** completed
**IN FLIGHT:** nothing — cycle closed, all leases released
**COMPLETED:**
- Audited STT. Found THREE systems: (A) live `useVoiceInput`+`VoiceInputWrapper` (30+ mounts),
  (B) `src/components/stt/*` + `useLocalStt` — ~3,000 lines, 100% UNMOUNTED and its main-process
  handlers were lying stubs returning `{ok:true,text:''}` with no mic access,
  (C) `/lecture/transcriber` (own server).
- NEW `src/hooks/useSttFloat.ts` — real engine: ONE getUserMedia stream feeds both an
  AnalyserNode (genuine RMS) and a MediaRecorder; kills the `Math.random()` fake waveform.
- NEW `src/features/stt/SttFloatPanel.tsx` — the floating window UI, LAMINAR tokens, 5 states,
  auto-save + auto-copy with honest partial-failure reporting.
- `src/main.ts` — real frameless always-on-top BrowserWindow (`stt:panel-*`, `#/stt-float`,
  `setVisibleOnAllWorkspaces`); fixed shortcut targeting via `sttShortcutTarget()`.
- `src/preload.ts` — `sttPanel*` bridge; fixed `stt:transcript-delete` → `-remove` allowlist bug.
- `src/lib/sttStore.ts` — save() no longer stores the whole `{ok,id}` object AS the id.
- `src/types/deskflow-api.d.ts` — STT surface was entirely untyped (fell through `any`).
- `src/App.tsx` — `#/stt-float` hash short-circuit (same shape as `#/mini-todo`).
- `src/pages/settings/ColorsSection.tsx` — "Open dictation panel" launcher.
**NEXT ACTION:** CZ builds (`npm run build`) and clicks through; needs a speech API key in
Settings → Voice & Speech, otherwise the engine is unavailable on Linux and only works on Windows native.
**NOTES:** `src/main.ts` had 537 pre-existing uncommitted insertions from another agent — all my
edits were surgical line-targeted and re-verified against current content.

---

## HISTORY (previous 2 cycles, oldest first)

<!-- none — first cycle for this session -->
<!-- SESSION: opencode-lecture-fix-20261001 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker -->

# Agent State — opencode-lecture-fix-20261001

> **STATUS:** completed | **UPDATED:** 2026-10-01T17:35:00Z

---

## CURRENT CYCLE (1)
**ROLE:** Rebuild the whole lecture/SlideMind system — local vision AI, speech-to-text, PPTX presentation processing, plus the silent-failure plumbing behind them.
**STATUS:** completed
**IN FLIGHT:**
- (none)
**COMPLETED:**
- Ran §0a coordination gate (1 agent, 0 locks) and claimed src/features/lecture, src/services/lecture, src/preload.ts.
- **Local AI moved from renderer to MAIN process.** `ImageLab` called `fetch('http://localhost:11434')` from the renderer — CORS preflight + app CSP made it fail, and the only symptom was an error string in the textarea. Added `lecture:local-ai:{status,vision,stt}` in services/lecture + 3 preload bridges.
- **Real model discovery.** Ollama `/api/tags` is now probed; the dropdown lists actually-installed vision models instead of 4 hardcoded guesses — one of which (`qwen2.5-vl:3b`) is not a real Ollama tag (family is `qwen2.5vl`).
- **Speech-to-text, part 2.** Previously mic-only + Web Speech API only. Added audio-FILE transcription with dependency-free backend discovery (OpenAI-compatible local servers on 5 ports + whisper.cpp CLI on PATH), manual multipart, and multi-shape transcript parsing.
- **Fixed the decorative "Auto EN-ID".** `rec.lang` is read once at construction; detection updated React state only. Now flips tear the recogniser down and restart it.
- **PPTX: speaker notes were hardcoded `''`** on insert — now read from `ppt/notesSlides/notesSlideN.xml` (body placeholder only, so the `sldNum` "1" never leaks), persisted, and shown as a distinct `notes` element.
- **PPTX: embedded figures were discarded.** Now resolved via slide `.rels` → `a:blip r:embed` → `ppt/media/*`, returned as base64 and fed to the local VLM at ingest.
- **PPTX title** now read from the real `type="title"` placeholder instead of "first lvl-0 shape".
- **Silent-failure fixes:** fabricated `100% token savings` on an empty DB (`deckTokens*6 + 42000` phantom baseline) → real ingested-content baseline, 0 when empty. Deck delete orphaned every `sm_slide_elements` row → now cascades. Destructive `optimizePrompt` flattened code/tables → line-aware, skips fenced blocks. `alert()`/`.catch(()=>{})` → `InlineNotice` with the original message. Dead `element` prompt-type chip → derived from data. Dead mobile `<a href={'#'+path}>` nav → `NavLink`.
- **Added `parsererror` detection** after discovering a malformed slide silently yields a blank slide (see MEMORY).
**NEXT ACTION:** Real full `vite build` into `dist/` + relaunch + Probe UI pass, once the box has RAM headroom (see NOTES).
**NOTES:**
- **Build did NOT complete into dist/ — machine OOM.** Verified compilation by building to a scratch outDir instead: `✓ 7829 modules transformed` then a silent death with no error text = kernel OOM kill, not a code error. `dist/` was left intact (300 assets) precisely because of the scratch-dir strategy. A real build is still needed before this ships.
- Pre-existing, NOT mine: 3 `Database` namespace tsc errors in services/lecture (confirmed identical at HEAD by extracting the HEAD file and type-checking it).
- No Ollama and no whisper on this box, so local-AI paths are verified for correctness/wiring/error-reporting, not against a live model.

---

## HISTORY (previous 2 cycles, oldest first)

(none — first cycle for this session)

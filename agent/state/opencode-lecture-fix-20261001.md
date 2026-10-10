<!-- SESSION: opencode-lecture-fix-20261001 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: App Tracker -->

# Agent State — opencode-lecture-fix-20261001

> **STATUS:** working | **UPDATED:** 2026-10-01T18:40:00Z

---

## CURRENT CYCLE (2)
**ROLE:** Second pass — bulk deck copy, multi-source prompt composer, PDF ingestion, and an in-app embedded browser panel.
**STATUS:** working
**IN FLIGHT:**
- (nothing blocked; all code written and verified statically)
**COMPLETED:**
- **Bulk copy (the "copy the whole PPT at once" ask).** `lib/deck.ts` builds a whole-deck Markdown text and a whole-deck prompt with a *fair* budget: slides are taken in order under one running budget so what survives is a contiguous PREFIX, never a scattershot sample, and dropped slides are COUNTED in the output. Naive `.slice(0, N)` silently amputated the back half of long decks. Wired as "Copy all text" + "Copy whole-deck prompt" in SlideViewer (with per-slide checkboxes for scope) and one click from the decks list. 26 tests.
- **Found + fixed a bug I introduced:** `buildDeckText` read only `text_content`, which is stored as `allText.slice(0, 6000)` — so on a text-heavy slide the `[SPEAKER NOTES]` heading fell past the cut and notes vanished. Now recovered from the `notes` column, and deduped so inlined notes are not repeated.
- **Multi-source composer** (`lib/compose.ts` + `lib/selection.ts`): deck/slide/transcript/YouTube/figure/prompt all flatten to one `SourceItem`, combined into one prompt with numbered `[SOURCE n — Kind: title]` headers and provenance `(from <deck>)`. Dropped sources are NAMED, never sliced mid-sentence. 46 tests, including the keyboard model as a pure reducer.
- **Found + fixed: `extendRange` was purely additive.** Shift-extend never replaced the previous range, so dragging 1→4 then 1→2 left rows 3-4 selected. Added `lastRange` tracking. **Found via testing:** force-keeping 2 huge sources blew the budget 2x; now force-keeps exactly 1.
- **PDF ingestion via Poppler, NOT pdfjs-dist** — `package.json` is being edited by another agent, so an install would collide. `pdftotext -layout` + `pdfinfo` + `pdftoppm`. Scanned pages get rasterised so the local vision model can read them. 19 tests against real poppler output.
- **Merged PDF into the decks UI** per request: `pages/Decks.tsx` deleted, replaced by `pages/Ingest.tsx` = "File Ingestion", which states the accepted formats (`.pptx`, `.pdf`) up front. PDFs ingest as a deck whose "slides" are pages, so SlideViewer + bulk copy + composer all work on them unchanged. Route `/lecture/ingest` added, `/lecture/decks` kept as an alias so old links survive.
- **Embedded browser panel** (`services/embedded-browser/index.ts` + `components/EmbeddedBrowser.tsx`): `WebContentsView` inside the app window, persistent `persist:deskflow-embedded-browser` partition so Google sign-in survives restarts, Chrome UA spoofing (Google refuses OAuth in webviews that admit to being Electron), `nodeIntegration:false / contextIsolation:true / sandbox:true`, window.open handed to the real browser, non-http(s) navigations blocked. "Ask free AI" now opens providers in-app with the external link kept as fallback.
- **Fixed the black-window root cause:** `BrowserManager.ts` wrapped `page.goto` in a bare `catch {}`, so a failed load looked exactly like a slow one and the app reported success over a blank window. It now reports the real error plus the URL and title the page ended up at. Also `availability()` only checked `require('playwright')`, never that a browser binary exists.
- Verified: 91 unit assertions green, all lecture files compile, **full importer chain bundles** (catches export-shape mismatches a per-file check cannot), scoped tsc back to the 3 pre-existing baseline errors.
**NEXT ACTION:** Real `vite build` into `dist/` + relaunch + Probe UI pass. The embedded browser in particular CANNOT be verified without a live build.
**NOTES:**
- **The embedded browser panel is UNVERIFIED at runtime.** It compiles and the importer chain bundles, but a native WebContentsView only exists in a running Electron window. Do not claim it works until it has been launched and clicked through.
- **Nothing still needs a build to be *code*-complete**, but the app in `dist/` is the PRE-CHANGE bundle — all of this needs one build before CZ sees any of it.
- Pre-existing, NOT mine: 3 `Database` namespace tsc errors in services/lecture (verified identical at HEAD).
- Claims held: src/features/lecture, src/services/lecture, src/preload.ts, src/main.ts, src/services/ai-gateway, src/services/embedded-browser, src/components/EmbeddedBrowser.tsx.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 1 — 2026-10-01
**ROLE:** Rebuild the whole lecture/SlideMind system — local vision AI, STT, PPTX processing.
**STATUS:** completed
**IN FLIGHT:** (none)
**COMPLETED:**
- Local AI moved renderer → main process (renderer `fetch` to localhost:11434 could never pass CORS+CSP). Real `/api/tags` model discovery; `qwen2.5-vl:3b` was not a real Ollama tag (family is `qwen2.5vl`).
- STT part 2: mic-only → added audio-FILE transcription with dependency-free backend discovery.
- Fixed the decorative "Auto EN-ID" (`rec.lang` is read once at construction).
- PPTX: speaker notes were hardcoded `''`; `ppt/media/*` was counted then discarded. Both now read and persisted.
- 7 silent-failure bugs fixed, incl. the dashboard showing "100% token saved" on an empty DB.
**NEXT ACTION:** Real build + runtime verification.
**NOTES:** Build OOM'd; verified compilation via scratch outDir so `dist/` was never at risk.
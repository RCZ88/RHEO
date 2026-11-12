# HANDOFF — Brain Revamp Session → Fresh Chat (no memory)

> Paste this into a fresh opencode chat. It replaces all conversation memory.
> Written 2026-11-12 by the outgoing brain-revamp session.

---

## 0. WHO YOU ARE + STANDING RULES (do not re-derive)

You are the **Hands & Eyes** coding agent (opencode) in `/home/clementzhao/dev/rheo` (RHEO/DeskFlow, Electron + React + better-sqlite3). AGENTS.md is auto-loaded — the rules that matter for this task:

- **Agents NEVER build.** CZ builds (`npm run build`). Verify with scoped `npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep <your paths>` + `npx esbuild <file> --bundle --outfile=/dev/null ...`. Never touch `dist/`/`dist-electron/`. Never git stash/reset/checkout.
- **Additive only.** Any deletion needs CZ's explicit confirmation list.
- **The tree has many agents' uncommitted work.** Stage only paths you claimed (coord.mjs gate). Never `git add -A`.
- End every cycle with the CYCLE REPORT format from AGENTS.md §3.

## 1. THE TASK — full arc so far

**Goal:** fix/revamp the Context Brain end-to-end: real 2D graph (no gimmicks, real dynamic data), wire the browser extension (external AI chats) into it, context transfer, debug/eval system. Multi-round Architect relay via `agent/skills/generate-prompt/`.

### Round 0 (done)
- Prompt folder: `agent/docs/generate-prompt-docs/brain-2d-connections-extension-debug/` (use the SLUG with prompt-copy; numeric IDs shift).
- Architect replied with spec `/home/clementzhao/Downloads/RESULT(9).md` (P1 Truth → P5 backend intelligence). Root cause: facts stored subject-only (`object_id` NULL) → zero real edges → "fake" everything.

### Implementation (done, ALL UNCOMMITTED in working tree)
Verify any marker with grep before trusting it:

| Change | File(s) | Marker |
|---|---|---|
| Predicate registry | `src/main/ai/predicates.ts` (new) | `PREDICATES` |
| LLM-free concept extractor | `src/main/ai/conceptExtraction.ts` (new) | `extractConcepts` |
| Main-process graph assembly (real + capped synthetic co-occurrence edges) | `src/main/ai/graphAssembler.ts` (new) | `assembleGraph` |
| Structured logger (ring 500, `[BRAIN-<COMP>]` console mirror, `agent/logs/brain.log` rotate 10MB) | `src/main/ai/brainLogger.ts` (new) | `getEntries` |
| Concept linking with objectId at capture time | `src/main/ai/episodeWriters.ts` (`writeAiContextEpisode`) | `addFact(entityId, 'discussed', c, epId, cid)` |
| objectId resolution in LLM extraction | `src/main/ai/entityExtraction.ts` | `applyExtraction` |
| Episode writers were undeclared (goal/finance/deadline episodes silently never written) | `src/main/ai/goal-handlers.ts`, `finance-handlers.ts` | `require('../../main/ai/episodeWriters')` |
| New IPCs: `brain:get-graph`, `brain:health` (+HTTP `GET /brain/health`), `brain:evaluate` (9 checks), `brain:logs`, `brain:log-level`, `brain:logs-clear`, `brain:logs-export`, `brain:run-extraction`, `brain:export-subgraph`, `brain:enrich-prompt`; `[BRAIN-EXT]` logs in POST `/ai-context` (~23340) | `src/main.ts` (~18061 block, ~23151 routes) | grep the channel names |
| Renderer consumes `brain:get-graph` exclusively (client assembly deleted) | `src/features/warmth/self/SelfOrchestrator.tsx` (`loadGraphData`) | `api.brainGetGraph?.(` |
| Selection fix: white ring (r+7) + 2.5px stroke, NO persistent amber fill; firing halo unchanged | `src/features/warmth/context-brain/BrainGraph.tsx` | — |
| Single monotonic clock | `src/features/warmth/context-brain/physics/avalanche.ts` | `export function now()` |
| ActivityFeed: glow-only activity, cascade summary, ↻ Replay, honest empty state | `src/features/warmth/context-brain/ActivityFeed.tsx` | `onReplay`, `cascadeSummary` |
| preload + types for all new endpoints | `src/preload.ts`, `src/types/deskflow-api.d.ts` | `brainGetGraph/brainEvaluate/brainExportSubgraph/brainEnrichPrompt/brainLogs*/brainRunExtraction` |

All touched files: scoped tsc + esbuild clean. **Nothing is runtime-verified — CZ must build.**

### Measured live DB (`/home/clementzhao/.config/RHEO/deskflow-data.db`, read-only sqlite3, 2026-11-12)
- 37 entities / 220 facts / **0 facts with object_id** (ZERO real edges in stored data) / 256 episodes (external_ai=143, deskflow_ai=33, goals=33, connector=14, deadlines=10, finance=10, terminal=8, life_phase=5)
- 143 `ai_context_captures` (chatgpt 72, claude 70, qwen 1), **all `episode_status='pending'`**, newest **2026-08-27** → the extension has been DEAD ~11 weeks (Firefox "Load Temporary Add-on" dies on browser restart). Receiver on port 54321 IS alive (verified by curl).
- **Backfill for old facts + stranded captures does not exist yet** (M2).

### Round 2 (done)
- Audit + new prompt folder: `agent/docs/generate-prompt-docs/brain-page-real-data-extension-revive-12112026/` (CONTEXT_BUNDLE.md + prompt.md; `prompt-copy list brain-page` → ID 49).
- Architect delivered RESULT (467 lines), saved **verbatim** at that folder's `RESULT.md`. Verdicts: **M1** two purposeful surfaces (no `/brain` route; Self = visual brain, BrainSurface = tools; slim ContextGraphView; CanvasGraph/BrainGrowthChart/EntityGroups on the deletion confirm-list); **M2** new `brain:backfill` IPC, match-first reconciliation, dry-run + `maxCreate=25` abort guard; **M3** watchdog from `MAX(captured_at) WHERE is_manual=0`, 5th Self stat tile + trail status card; **M4** Health+Debug panels in manage tab; **M5** **no 3D, permanently**; **M6** waits on requested sources.

### Round 2b (done — last action of the outgoing session)
- Delivered all six REQUESTed sources in `CONTEXT-ROUNDB2.md` (2,137 lines, line-anchored) in the same folder: `userContextService.ts` (418), `embeddingService.ts` (155), `contextBrainMCP.ts` (545), chat send path `main.ts:22855–23010`, `episodeWriters.ts` (247), `ContextGraphView.tsx` (409) + bonus `contextBackfill.ts` (182).
- **Design-changing discoveries (flagged to the Architect in the file header):**
  1. MCP server ALREADY EXISTS: `src/main/ai/contextBrainMCP.ts` — `startMcpServer()`, port 54322, 10 tools + 5 resources. Extend it; don't invent one.
  2. Backfill service ALREADY EXISTS + wired: `src/main/ai/contextBackfill.ts` @ `main.ts:17983`. M2 must reconcile or explicitly replace (removal-list item).
  3. Chat send path: `ai-chat:send` handler `main.ts:22855`; LLM call = `callProvider` from `src/services/providers/callProvider`; brain-enrichment insertion = steps 3/4 of the handler.
  4. Path correction: `ContextGraphView.tsx` is at `src/features/warmth/`, NOT `context-brain/`.
  5. Unmapped files exist (`memoryCapture/Compaction/Extractor/Retrieval/Store`, `chatLibrary`, `contextFormatter`, `contextScheduler`) — Architect told to REQUEST if needed.
- Conversation state tracked in `conversation/round-02b-context-delivered.md` in the same folder.

## 2. CURRENT STATE

- **Awaiting:** the Architect's M6 file-by-file spec (reply to CONTEXT-ROUNDB2.md). CZ relays it.
- **M1–M5 are implementable NOW** per the Architect — do not block them on M6.
- **CZ must build** to see anything at runtime; nothing runtime-verified yet.
- The 467-line RESULT.md still needs the **mandatory coverage check** (every PROMPT item → RESULT location) before implementation begins, per generate-prompt post-result workflow.

## 3. NEXT MOVES (ordered)

1. When CZ pastes the next Architect reply: save it verbatim as the next `RESULT*.md`/round file in `brain-page-real-data-extension-revive-12112026/`, run the coverage table (PROMPT items → RESULT sections; gaps → follow-up), then write `IMPLEMENTATION_PLAN.md`.
2. Implement M1–M5 file-by-file per RESULT.md + plan. Answer any new `REQUEST:` with `CONTEXT:` (real source, line-anchored, assembled by shell into a file; give CZ a `prompt-copy <path>` command).
3. After implementation: scoped tsc/esbuild on touched files, `npm run validate:pages` if pages/registry touched, leak census, commit `wip:` staged paths only.
4. Suggest CZ builds, then verify at runtime (probe/`brain:evaluate`, `brain:health`, extension capture flow) — honest NOT TESTED labels until then.
5. Deletion confirm-list (dead components etc.) goes to CZ only after the working state is proven.

## 4. GOTCHAS (learned, do not re-learn)

- `context_episodes` has **NO `created_at`** (use `ingested_at`/`occurred_at`); `ai_context_captures` uses `messages` JSON + `dedup_key` (NOT `prompt_text`).
- The clipboard is global and contended: give `prompt-copy` commands, don't run them speculatively; verify pasted bytes if you run one.
- `prompt-copy get <numeric-ID>` unreliable — use slugs (`brain-page-real-data-extension-revive-12112026`).
- Live DB reads: use `sqlite3 "file:<path>?mode=ro"`.
- Port 54321 = browser-ingest (app) / rheo-tracker daemon; port 54322 = contextBrainMCP.
- Repo-wide `tsc` reports 8,000+ pre-existing errors — always scope to touched paths.

## 5. KEY PATHS

- Round-2 folder (all artifacts): `agent/docs/generate-prompt-docs/brain-page-real-data-extension-revive-12112026/`
- Round-0 prompt: `agent/docs/generate-prompt-docs/brain-2d-connections-extension-debug/`
- Brain renderer: `src/features/warmth/self/SelfOrchestrator.tsx`, `src/features/warmth/context-brain/*`, `src/features/warmth/ContextGraphView.tsx`, `src/components/ai/chat/BrainSurface.tsx`
- Brain engine: `src/main/ai/*` (see §1 table), brain IPC block in `src/main.ts` (~18061), extension route ~23332, chat send ~22855

---

## 6. ROUND-M6 APPENDIX (2026-11-12, post-handoff events)

After this handoff was written, the following happened — a fresh session should read these files in `agent/docs/generate-prompt-docs/brain-page-real-data-extension-revive-12112026/`:

- **`RESULT-M6.md`** (1,120 lines, saved verbatim) — the Architect's WP-A…WP-G spec: safety hotfixes, privacy, signals engine, embeddings v2, brain context + chat enrichment + MCP tools, M2 backfill reconcile (D2: extend `contextBackfill.ts`, never replace), UI slim. Tagged GROUNDED vs ASSUMES throughout.
- **`CONTEXT-R1R5.md`** (1,330 lines) — answers to RESULT-M6's five REQUESTs: `contextBrain.ts` (628), `contextScheduler.ts` + PRAGMA, `contextFormatter.ts` (115) + `memoryRetrieval.ts` (62), main.ts excerpts (backfill wiring 17960–18010, `brain:enrich-prompt` @18222, `brain:export-subgraph` @18138, `brain:evaluate` signal_decay_ran @18293, `writeAiChatEpisode` call site @22603), `conceptExtraction.ts` + `predicates.ts`.
- **`NEXT-CLAUDE-PACKAGE.md`** (1,355 lines) — the single paste-ready file for the next Claude session: round-2c header + CZ confirm-list placeholder (R-1…R-7, D6) + full CONTEXT-R1R5 content. Copy with `prompt-copy agent/docs/generate-prompt-docs/brain-page-real-data-extension-revive-12112026/NEXT-CLAUDE-PACKAGE.md` (path form — the slug form only copies prompt.md + CONTEXT_BUNDLE).
- **`conversation/round-m6-delivered.md`** — round state log.
- **Applied since the handoff:** F3 crash hotfix — `src/features/warmth/ContextGraphView.tsx` now imports `TYPE_COLORS` from `./context-graph/types` (was ReferenceError on render). Scoped tsc + esbuild clean. The full file replace (R-3) is still gated on CZ.
- **Still unresolved:** D6 (Round-2 M5 "no 3D, permanently" vs a `RESULT_PART2_3D.md` from a different Claude chat — CZ must decide and deliver that file if he wants the toggle); all RESULT-M6 GROUNDED implementation is gated on CZ's §7 confirm answers.

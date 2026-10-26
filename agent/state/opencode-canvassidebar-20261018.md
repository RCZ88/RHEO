<!-- SESSION: opencode-canvassidebar-20261018 -->
<!-- AGENT: opencode | TERMINAL: n/a | PROJECT: /home/clementzhao/dev/rheo -->

# Agent State — opencode-canvassidebar-20261018

> **STATUS:** completed | **UPDATED:** 2026-10-20T12:30:00+07:00

---

## CURRENT CYCLE (3)
**ROLE:** Finish the AI page's grouping system + polish canvas chat overlay + fix model mismatch (CZ: "WHY IS THE AI OUTPUT DIRECTLY ABOVE THE TEXT INPUT?", "model DOESN'T MATCH", "MAKE SWITCHING INTUITIVE + ADD MODELS").
**STATUS:** completed (code + 25-assertion reducer/helper probe; runtime NOT TESTED — app not running, CZ builds)
**IN FLIGHT:**
- (none)
**COMPLETED:**
- Root cause (read, not guessed): members rendered as absolute `childCards` entries with `onPointerDown={stopPropagation}` + `cursor:'default'` — NO drag handler existed, so members were frozen. `arrangeGroup`'s `custom` mode had zero callers.
- `GroupCard.tsx`: real in-group dragging — mousedown on a member (ignoring button/input/textarea/select/a), `zoom`-aware local preview, clamped ≥0, ONE absolute commit on mouseup; `grab/grabbing` cursor; `group-body-wrapper` overflow visible while dragging so the moving card is not clipped. `onMoveChild` + `zoom` props added.
- `types/canvas.ts` `MOVE_CARD`: when the moved card is a GROUP CARD, translate `groups[id].position`, every live member position AND the `childCards` snapshot by the same delta. Before this, the canonical group position went stale on every group drag → later arrange/ungroup/child-drag anchored to where the group used to be.
- `useCanvasState.ts`: new exported `groupFrameFor(members, positions, base)` (exact-fit frame from rendered positions); `layoutTidyGrid` now derives its `size` from it (one source of truth); new `moveGroupChild(groupId, cardId, position)` re-fits from the childCards SNAPSHOT and dispatches `ARRANGE_GROUP` with the single moved position, so live card + snapshot + group/frame sizes stay in lock-step. Exposed in the hook return.
- Wiring: `AiPage` → `CanvasContainer` → `CanvasGrid` → `CanvasCard` ctx (now carries `zoom` + `onMoveGroupChild`) → `GroupCard.onMoveChild`.
- Probe (real `canvasReducer` + real helpers, esbuild bundle + node): 25/25 PASS — create from scattered pair (18×11 cells), snapshot==layout, manual drag commits at the drop point, frame tight-fit (+22px/+0px slack), group drag translates canonical+live+snapshot with unchanged rendered offsets, child drag after group move has zero drift, tidy returns identical positions to all three stores with zero overlaps, 4-corner scatter → 880×800 with reading order preserved.
- Verification: `npx esbuild` rc=0 for the 6 canvas modules AND `src/pages/AiPage.tsx`; scoped `tsc --noEmit --project tsconfig.app.json` → GroupCard 0 errors, types/canvas 0 errors, no error anywhere mentions `moveGroupChild|onMoveGroupChild|groupFrameFor|dragPreview|handleChildMouseDown|onMoveChild`; remaining canvas-scope errors are pre-existing unused-import/type noise (AiPage 56, all pre-existing).
- DOM drag harness (headless Chromium via local Playwright, real `GroupCard`, trusted mouse events, no app build): 18/18 PASS at zoom 1 AND zoom 2 — member mounts at `pos-base-10/30` with `cursor:grab`; preview tracks the pointer (`104/74` for +100/+60 at zoom 1; `54/44` at zoom 2, i.e. delta/zoom); `grabbing` cursor, zIndex 2, body overflow visible; exactly ONE commit on mouseup with the absolute canvas position (`214,204` / `164,674`); preview cleared; a press on the ✕ button starts no drag and commits nothing; zero renderer errors. Artifacts: `/tmp/opencode/harness-drag/{test-drag.mjs,mid-drag.png}`.
- Collapse/popup chat overlay (CanvasContainer): transcript now rests collapsed by default so the canvas is visible; a pill shows message count; auto-expands whenever a new message arrives (send or reply) — "popup whenever I send another message"; manual collapse/expand toggle; polished CSS (header bar, count chip, hover states, light-mode). Persisted to localStorage.
- Model mismatch fix: `aiAgentService.callLLM` was overriding the user's selected chat model with `aiConfig.briefModel` (a briefs/summaries model) and ignoring `this.config`. Removed the briefModel override; model resolution now prefers `this.config.model`/`providerId` (pushed from useAiChat each send via pickTarget) → `routing.default` → first model. This is the "model doesn't match what's selected" root cause.
- Scoped tsc: no new errors from these edits; esbuild rc=0 for CanvasContainer.
**NEXT ACTION:** CZ builds + relaunches. Verify in the running app: drag a member inside a group → it follows the cursor and the coating grows/shrinks; drag the group header → members stay glued; Tidy re-packs; colour coats the whole card.
**NOTES:** 11 files UNCOMMITTED (`src/main.ts` also carries earlier/other work — never blanket-stage). Running app predates every fix. Probe MCP is not in this session's catalog → runtime NOT TESTED, no screenshot. BACKLOG (found, untouched, one line each): group card still exposes the resize handle (manual resize desyncs the exact-fit frame); dropping a card onto a GROUP CARD runs `onGroupCards([cardId, groupCardId])` → would nest the group card instead of adding to the group; MEMORY.md is over its 10-entry cap.

---

## HISTORY (previous 2 cycles, oldest first)

### Cycle 2 — 2026-10-19 (checkpoint cycle)
**ROLE:** Four AI-page defects — navrail never covers canvas, chat history saves/lists, pinch zooms, groups tidy + colour.
**STATUS:** completed
**COMPLETED:**
- `deck.css` ≤640px: restated `padding-right: var(--dk-navrail-actual)` after the `padding` shorthand. Chromium matrix: BEFORE 620px overlap 120.4px expanded / 40px collapsed; AFTER 0px at 620/900/2048 × both states.
- Chat history: idempotent bootstrap `ALTER TABLE ai_chat_threads ADD COLUMN workspace_name/canvas_name TEXT` (proved on a `.backup` DB copy: list fails before, 23 threads after); `useAiChat.ts` TDZ `const finish` → `async function finish`; `refreshThreads` after persist + declaration moved above its deps array (second TDZ).
- Pinch: shipped `dist/assets/CanvasGrid.*.js` already has ctrl+wheel → `Math.exp(-rawY*15e-4)` with `passive:false`; platform event delivery is the remaining variable (X11 does not synthesize ctrl+wheel).
- Groups: `layoutTidyGrid` used by create + Tidy; ARRANGE_GROUP syncs live cards + snapshot + size; `.group-card` consumes `--group-bg`/`--group-border`.

### Cycle 1 — 2026-10-18/19
**ROLE:** Same four defects; recon + first fixes.
**STATUS:** completed
**COMPLETED:**
- Coordination gate; claims.
- Chat recon proved both roots on the live DB; group system identified (snapshot render, `arrangeGroup` no-op, `.dk-group` CSS dead).

# Implementation Plan — AI Action System

> Generated from RESULT.md analysis. Maps every spec item to actual codebase.
> Build order: Foundation → Primitives → Hooks → Dynamic UI → Compositions → Wiring → Build.

---

## Phase 1: Foundation (no UI changes, pure additions)

### Step 1: Add ACTION_ACCENT + ACTION_ICON to tokens.ts
- **File:** `src/components/ai/tokens.ts`
- **Change:** Append `ACTION_ACCENT` map (19 action→accent mappings), `ACTION_ICON` map (19 action→icon name strings), `ActionType` type union
- **Codebase adaptation:** tokens.ts currently ends at line 109. Append after SECTION_ACCENT.
- **Verification:** TypeScript compiles without errors.

### Step 2: Add 12 variant sets to motion.ts
- **File:** `src/components/ai/lib/motion.ts`
- **Change:** Append `cardEnterVariants`, `cardExitVariants`, `contentUpdateVariants`, `actionSpinnerVariants`, `completionBurstVariants`, `glowPulseVariants`, `errorShakeVariants`, `errorFlashVariants`, `listItemAddVariants`, `listItemRemoveVariants`, `dragFeedbackVariants`, `groupFormationVariants`, `groupColorPulse`, `aiBuildingVariants`, `compositionExecuteVariants`, `statusBadgePulse` + `useActionMotionProps()` hook
- **Codebase adaptation:** motion.ts currently ends at line 86. Append after useMotionProps. Import `useReducedMotion` already present. Import `MOTION` already present.
- **Verification:** TypeScript compiles. No existing imports break.

### Step 3: Create actionBus.ts
- **File:** `src/components/ai/lib/actionBus.ts` (NEW)
- **Change:** Create event bus class with `start(actionId, type, label)`, `complete(actionId)`, `fail(actionId, error)`, `subscribe(callback)`, `getActive()`, `getLastCompleted()`
- **Codebase adaptation:** Pure new file, no conflicts.
- **Verification:** TypeScript compiles. Unit test: start → complete cycle works.

### Step 4: Create dynamicUI.ts types
- **File:** `src/types/dynamicUI.ts` (NEW)
- **Change:** Full JSON schema types: `DynamicUIComponent`, `DynamicComponentType`, `ChartVariant`, `FormFieldType`, 7 data variants (`CardData`, `ChartData`, `ListData`, `FormData`, `StatData`, `TableData`, `TimelineData`), `DynamicAction`, `AiUIGenerationResponse`
- **Codebase adaptation:** Pure new file, no conflicts.
- **Verification:** TypeScript compiles.

### Step 5: Add 'generated' to CanvasCard type
- **File:** `src/types/canvas.ts`
- **Change:** Add `'generated'` to `CardType` union (line 1). Add `ADD_GENERATED_CARD` and `REMOVE_GENERATED_CARD` to `CanvasAction` union (line 55).
- **Codebase adaptation:** CardType union is at line 1. CanvasAction union starts at line 55. Add after existing entries.
- **Verification:** TypeScript compiles. Existing card type switches don't break (they have default cases).

---

## Phase 2: Primitives (new components, not yet wired)

### Step 6: Create ActionOverlay.tsx
- **File:** `src/components/ai/primitives/ActionOverlay.tsx` (NEW)
- **Change:** Wraps children; shows Loader2 spinner + accent label during execution; emerald CheckDraw + glow ring on completion. Uses `actionSpinnerVariants`, `completionBurstVariants`, `glowPulseVariants` from motion.ts.
- **Codebase adaptation:** Follow existing primitive patterns (CheckDraw.tsx, Progress.tsx). Use `cn()` from `lib/cn`. Use `ACCENT` from tokens.
- **Verification:** Renders without errors. Spinner shows on status="executing". CheckDraw shows on status="complete".

### Step 7: Create ErrorShake.tsx
- **File:** `src/components/ai/primitives/ErrorShake.tsx` (NEW)
- **Change:** Wraps children; applies x-axis shake + red border flash when trigger=true. Uses `errorShakeVariants`, `errorFlashVariants`.
- **Codebase adaptation:** Follow existing primitive patterns.
- **Verification:** Renders. Shake fires on trigger=true.

### Step 8: Create AiBuildingIndicator.tsx
- **File:** `src/components/ai/primitives/AiBuildingIndicator.tsx` (NEW)
- **Change:** Sparkles icon + label + Progress bar + optional partial preview. Uses `aiBuildingVariants`.
- **Codebase adaptation:** Import `Progress` from `./Progress`. Import `Sparkles` from lucide-react.
- **Verification:** Renders. Progress bar animates.

### Step 9: Create ListTransition.tsx
- **File:** `src/components/ai/primitives/ListTransition.tsx` (NEW)
- **Change:** AnimatePresence wrapper for lists. Items slide in from x:24, slide out to x:-24 + height collapse. Uses `listItemAddVariants`, `listItemRemoveVariants`.
- **Codebase adaptation:** Import `AnimatePresence` from framer-motion (already used everywhere).
- **Verification:** Renders. Items animate in/out.

---

## Phase 3: Hooks (state management)

### Step 10: Create useAiActions.ts
- **File:** `src/hooks/useAiActions.ts` (NEW)
- **Change:** Hook that subscribes to actionBus, tracks active/lastCompleted/lastError. Provides `isSlotActive(slot)`, `isCardActive(cardId)`, `getActionForSlot(slot)`.
- **Codebase adaptation:** Import actionBus from `../components/ai/lib/actionBus`. Follow existing hook patterns (useToasts.ts, useAutoSync.ts).
- **Verification:** Returns correct state after start/complete/fail cycles.

### Step 11: Create useDynamicUI.ts
- **File:** `src/hooks/useDynamicUI.ts` (NEW)
- **Change:** Manages AI-generated UI components. State in localStorage["rheo-dynamic-ui-components"]. Methods: `generateFromAI(response)`, `addComponent(comp)`, `removeComponent(id)`, `updateComponent(id, patch)`, `toCanvasCards()`. Simulates build progress (0→1 over 2s).
- **Codebase adaptation:** Follow localStorage patterns from useCanvasState.ts. Use `crypto.randomUUID()` for IDs.
- **Verification:** Components persist across page reloads. toCanvasCards returns valid CanvasCard[].

---

## Phase 4: Dynamic UI (AI-generated cards)

### Step 12: Create DynamicCardRenderer.tsx
- **File:** `src/components/ai/canvas/cards/DynamicCardRenderer.tsx` (NEW)
- **Change:** Schema→React renderer. Handles 7 component types (card/chart/list/stat/form/table/timeline). Each uses accent-aware styling from ACCENT tokens. Card type renders markdown body. Chart type uses recharts (already installed). List type uses ListTransition. Stat type uses CountUp.
- **Codebase adaptation:** Import `ACCENT` from tokens. Import `CountUp` from primitives. Import `MarkdownRenderer` from chat. Import recharts components (BarChart, LineChart, etc. — already in project). Follow glass card pattern: `bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl`.
- **Verification:** Renders each component type. Accent colors apply correctly.

### Step 13: Create DynamicCard.tsx wrapper
- **File:** `src/components/ai/canvas/cards/DynamicCard.tsx` (NEW)
- **Change:** CanvasCard wrapper that detects `type === "generated"` → renders DynamicCardRenderer. Includes dismiss button, AI badge, action buttons.
- **Codebase adaptation:** Follow existing CanvasCard.tsx patterns. Import DynamicCardRenderer.
- **Verification:** When a generated card is on canvas, DynamicCardRenderer shows instead of default content.

---

## Phase 5: Compositions (extract + integrate)

### Step 14: Create compositions/types.ts
- **File:** `src/components/ai/compositions/types.ts` (NEW)
- **Change:** Shared types: `CompositionRule`, `ExecutionStatus`, `ExecutionLog` (extracted from CompositionPage.tsx lines 7-40).
- **Codebase adaptation:** Copy types from CompositionPage.tsx. No changes needed.
- **Verification:** TypeScript compiles.

### Step 15: Create CompositionRuleCard.tsx
- **File:** `src/components/ai/compositions/CompositionRuleCard.tsx` (NEW)
- **Change:** Animated rule card with status badge pulse, action buttons, failure warning. Uses `compositionExecuteVariants`, `statusBadgePulse`.
- **Codebase adaptation:** Follow glass card pattern. Import StatusBadge from CompositionPage (or recreate).
- **Verification:** Renders. Status badge pulses on hover.

### Step 16: Create CompositionEditorModal.tsx
- **File:** `src/components/ai/compositions/CompositionEditorModal.tsx` (NEW)
- **Change:** Extract editor modal from CompositionPage.tsx (lines 291-381). Reuse DSL textarea, validation, save logic.
- **Codebase adaptation:** Copy from CompositionPage.tsx. Replace `API?.compositionsX` calls with direct preload imports.
- **Verification:** Modal opens, validates DSL, saves rules.

### Step 17: Create CompositionHistoryDrawer.tsx
- **File:** `src/components/ai/compositions/CompositionHistoryDrawer.tsx` (NEW)
- **Change:** Extract history view from CompositionPage.tsx (lines 383-415).
- **Codebase adaptation:** Copy from CompositionPage.tsx.
- **Verification:** Shows execution history.

### Step 18: Create CompositionPanel.tsx
- **File:** `src/components/ai/compositions/CompositionPanel.tsx` (NEW)
- **Change:** Main compositions view. Header + rules list + editor modal + history drawer. Uses CompositionRuleCard, CompositionEditorModal, CompositionHistoryDrawer.
- **Codebase adaptation:** Follow AiPageDeck pattern for layout. Import all composition sub-components.
- **Verification:** Full CRUD works. Animations fire on rule create/delete.

---

## Phase 6: Wiring (modify existing files)

### Step 19: Modify AiPage.tsx — 3-way mode toggle
- **File:** `src/pages/AiPage.tsx`
- **Changes:**
  1. Add `compositionsMode` state (or extend canvasMode to 3-way: 'deck' | 'canvas' | 'compositions')
  2. Replace DECK/CANVAS button with 3-way toggle (DECK / CANVAS / COMPS)
  3. Import `CompositionPanel` from `../components/ai/compositions/CompositionPanel`
  4. Add conditional render: `{mode === 'compositions' && <CompositionPanel />}`
  5. Import `useAiActions` and `useDynamicUI` hooks
  6. Wrap deck slots with `ActionOverlay` using `isSlotActive()`
  7. Add `actionBus.start()/complete()/fail()` calls to goal handlers (lines ~941, ~966, ~1142, ~1152)
  8. Add `actionBus.start()/complete()/fail()` to email handlers (line ~1341-1346)
  9. Add `actionBus.start()/complete()/fail()` to schedule/deadline handlers (lines ~1361-1386)
  10. Add `actionBus.start()/complete()/fail()` to composition operations
  11. Parse ` ```ui-generation ` blocks in chat messages → call `dynamicUI.generateFromAI()`
  12. Render `AiBuildingIndicator` when dynamicUI is building
- **Codebase adaptation:** AiPage.tsx is 1643 lines. Top bar is at lines 1229-1291. Mode toggle is at line 1249-1259. Deck/Canvas conditional is at line 1294. Add imports at top (lines 1-34).
- **Verification:** 3-way toggle works. Action overlays show on slot interactions. AI can generate UI.

### Step 20: Modify ActionConfirmCard.tsx — actionBus integration
- **File:** `src/components/ai/chat/ActionConfirmCard.tsx`
- **Change:** Wire confirm button to `actionBus.start()` before `onConfirm()`, `actionBus.complete()` after success, `actionBus.fail()` on error.
- **Codebase adaptation:** Lines 17-26 (handleConfirm). Add imports at top.
- **Verification:** Confirm → actionBus fires → ActionOverlay in slot activates.

### Step 21: Modify AgentProgressBar.tsx — actionId prop
- **File:** `src/components/ai/chat/AgentProgressBar.tsx`
- **Change:** Accept optional `actionId` prop. If provided, read steps from actionBus event instead of props.
- **Codebase adaptation:** Lines 13-19 (interface). Add `actionId?: string` prop.
- **Verification:** Progress bar syncs with actionBus events.

### Step 22: Modify CanvasCard.tsx — ActionOverlay wrap
- **File:** `src/components/ai/canvas/CanvasCard.tsx`
- **Change:** Wrap card content with `ActionOverlay` when `isCardActive(card.id)` is true.
- **Codebase adaptation:** Lines 227-243 (main div). Add ActionOverlay around content area. Import useAiActions.
- **Verification:** Card shows spinner during AI action on that card.

### Step 23: Modify App.tsx — remove /compositions route
- **File:** `src/App.tsx`
- **Change:**
  1. Remove sidebar nav item at line 2414: `{ icon: FileCode, label: 'Compositions', path: '/compositions' }`
  2. Replace route at line 2766: `<Route path="/compositions" element={<CompositionPage />} />` → `<Route path="/compositions" element={<Navigate to="/ai" replace />} />`
  3. Add `import { Navigate } from 'react-router-dom'` if not already imported
- **Codebase adaptation:** App.tsx is large (~3000+ lines). Find exact lines by grepping.
- **Verification:** /compositions redirects to /ai. Sidebar no longer shows Compositions.

### Step 24: Deprecate CompositionPage.tsx
- **File:** `src/pages/CompositionPage.tsx`
- **Change:** Add redirect notice at top. Keep file for backward compat but all content moved to CompositionPanel.
- **Codebase adaptation:** Add a useEffect redirect or just leave as-is (route redirect handles it).
- **Verification:** Old /compositions URL redirects to /ai.

---

## Phase 7: Build + Verify

### Step 25: Run build
```bash
npx vite build
npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
node scripts/build.mjs
```

### Step 26: Black-screen checklist
- Step 1: vite build exit 0
- Step 2: preload.cjs > 1KB
- Step 3: main.cjs exists
- Step 4: dist/index.html has #root, type="module", df-fallback
- Step 5: entry JS > 10KB

### Step 27: Verify animations
- Toggle goal → ActionOverlay shows spinner → CheckDraw animates on completion
- Add goal → list item slides in from right
- Delete goal → list item slides out left + collapses
- AI sends email → ActionConfirmCard → spinner → emerald glow
- Composition rule created → card enters with scale animation
- AI generates UI → AiBuildingIndicator shows progress → DynamicCard renders

---

## File Change Summary

| Action | File | Lines Changed |
|---|---|---|
| MODIFY | `src/components/ai/tokens.ts` | +35 (append ACTION_ACCENT, ACTION_ICON, ActionType) |
| MODIFY | `src/components/ai/lib/motion.ts` | +140 (append 16 variant sets + useActionMotionProps) |
| CREATE | `src/components/ai/lib/actionBus.ts` | +60 |
| CREATE | `src/types/dynamicUI.ts` | +120 |
| MODIFY | `src/types/canvas.ts` | +5 (add 'generated' type, 2 actions) |
| CREATE | `src/components/ai/primitives/ActionOverlay.tsx` | +60 |
| CREATE | `src/components/ai/primitives/ErrorShake.tsx` | +45 |
| CREATE | `src/components/ai/primitives/AiBuildingIndicator.tsx` | +55 |
| CREATE | `src/components/ai/primitives/ListTransition.tsx` | +50 |
| CREATE | `src/hooks/useAiActions.ts` | +75 |
| CREATE | `src/hooks/useDynamicUI.ts` | +90 |
| CREATE | `src/components/ai/canvas/cards/DynamicCardRenderer.tsx` | +300 |
| CREATE | `src/components/ai/canvas/cards/DynamicCard.tsx` | +40 |
| CREATE | `src/components/ai/compositions/types.ts` | +30 |
| CREATE | `src/components/ai/compositions/CompositionRuleCard.tsx` | +80 |
| CREATE | `src/components/ai/compositions/CompositionEditorModal.tsx` | +100 |
| CREATE | `src/components/ai/compositions/CompositionHistoryDrawer.tsx` | +60 |
| CREATE | `src/components/ai/compositions/CompositionPanel.tsx` | +120 |
| MODIFY | `src/pages/AiPage.tsx` | +80, -20 |
| MODIFY | `src/components/ai/chat/ActionConfirmCard.tsx` | +10 |
| MODIFY | `src/components/ai/chat/AgentProgressBar.tsx` | +5 |
| MODIFY | `src/components/ai/canvas/CanvasCard.tsx` | +15 |
| MODIFY | `src/App.tsx` | -2, +1 |
| MODIFY | `src/pages/CompositionPage.tsx` | +5 (deprecation notice) |

**Total: 14 new files, 9 modified files, ~1,400 new lines**

---

## Gaps / Risks

1. **DynamicCardRenderer chart rendering** — RESULT.md references recharts but the exact import path needs verification. Recharts IS installed (circular dependency warnings in build). Need to import `BarChart, LineChart, PieChart, AreaChart` from `recharts`.

2. **CompositionEditorModal / CompositionHistoryDrawer** — RESULT.md says "code not in this spec — referenced only." These are extracted from CompositionPage.tsx. The actual code is in the context bundle (lines 291-415). Must copy and adapt.

3. **AI prompt for `ui-generation`** — The system prompt in `aiAgentService.ts` needs a new instruction telling the AI to output ` ```ui-generation ` blocks. This is a system prompt change, not a code change.

4. **Chat message parsing** — AiPage.tsx needs to parse ` ```ui-generation ` blocks from assistant messages. This requires modifying the message rendering pipeline (wherever markdown is rendered).

5. **No test suite** — All verification is manual. Must build + launch + test each phase.

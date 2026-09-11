# CONTEXT_BUNDLE â€” AI Canvas: Default Setup, UX Pass, Research Digest, Provider Fallback, Context/RAG System

> Generated 2026-08-12 by opencode (Hands & Eyes) for the Architect.
> This bundle is SELF-CONTAINED: the target AI must be able to design the complete
> solution using only this file. Read it fully before writing the RESULT.md.
> Repo root: `C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker`
> App name: DeskFlow (AI page = route `/` â†’ AiPage; canvas = the AI Assistant canvas).

---

## PART A â€” CRITICAL CONTEXT & CURRENT STATE (verified 2026-08-12)

### A1. What has ALREADY been fixed (do NOT regress)

1. **Canvas drag** â€” dnd-kit/framer-motion intercept `pointerdown` in capture phase
   (stopPropagation), so React's `#root` delegation NEVER fires for real events.
   CanvasCard.tsx now uses `mousedown`/`mousemove`/`mouseup` with window-level
   listeners + a `dragCleanupRef` cleanup pattern. Never convert back to pointer events.
2. **Snap-back bug** â€” fixed via blur-only safety net (see CanvasCard excerpt below).
3. **Grouping** â€” 30% area-overlap threshold, groups excluded as targets AND as
   dragged items; rAF-throttled drop-target scan in CanvasGrid.
4. **Seeding dedup** â€” unified seeding effect in AiPage; `wasLoaded` flag in
   useCanvasState; `clearAll()` resets the flag + sets `stateRef.current = DEFAULT_STATE`
   immediately (beforeunload race fixed).
5. **Persistence** â€” `clearCanvasLayout()` removes ALL `deskflow-canvas-*` keys
   (was: only active key â†’ old canvases resurrected). `Save` overwrites the active
   canvas; **`Save As` (canvas.saveAs(name)) creates a NEW named canvas**.
6. **CardDrawer.tsx** + **CustomConfirmDialog.tsx** were just created (see Part C).
   `window.confirm` is BANNED in this app â€” all confirmations use CustomConfirmDialog.

### A2. The user's current demands (verbatim intent)

The user is frustrated that the canvas/AI page is not "fully implemented". They want:

1. **A "SAVED SETUP" / DEFAULT CANVAS SETUP feature** (THE headline item): the user
   can configure which cards (and their data/config) appear on a NEW blank canvas,
   save that setup, and every new canvas starts with those cards as defaults.
   "we should be able to setup like the default setup that we want on our new canvas
   so that everytime we create a new canvas, those cards that we have setup appear."
2. **A full humancentred-UIUX pass over ALL canvas cards** â€” empty/loading/error/
   populated states, hover/focus/disabled, keyboard, confirmation dialogs, coherent
   visual hierarchy. Cards: focus, plan, finance, digest, reflect, response,
   annotation, connectors, schedule, deadlines, planner, automation, generated, group.
3. **Daily Research (Research Digest) must WORK properly** â€” generation, polling,
   fallback chain (providers), error surfacing. Verify `get-topic-digest` end-to-end.
4. **The provider fallback system must WORK** â€” `buildChain` + `runWithFallback`
   (see Part D) must be used by EVERY AI feature; assignment UI exists
   (AiProviderSelectModal) for default/researchDigest/goalAssistant.
5. **The system must be ADAPTIVE/DYNAMIC to the feature list** â€” cards appear
   based on which features/data exist (e.g. no finance data â†’ finance card shows
   empty state with CTA, not a broken card).
6. **Context system design** â€” the user asks: "how do we handle the context system
   in using RAG or more advanced systems like Graph RAG, Tiered Memory, multi-strategy
   retrieval and stuff like that?" **This is an ARCHITECTURE DESIGN QUESTION** â€”
   the Architect must propose a concrete, buildable design (files, IPC, schemas)
   for the AI page's context/memory, NOT a vague essay.
7. **Use frontend MCP inventory + skills** â€” shadcn, Magic UI, Lucide, React Bits,
   Iconify; re-skin to DeskFlow tokens (see Part F).

### A3. Hard invariants (NEVER regress)

- Canvas card drag = mouse events only (see A1.1).
- `window.confirm`/`alert` BANNED â€” CustomConfirmDialog everywhere.
- localStorage access wrapped in try/catch; files CRLF; dark-mode only.
- Seeding: seed defaults ONLY on fresh canvases or after explicit New Canvas;
  never re-seed when canvas state was loaded from storage (even if empty).
- Renderer is built with `npx vite build`; preload with esbuild; main with
  `node scripts/rebuild-main.mjs`. After renderer changes, the app must be
  fully closed + relaunched (stale bundles cause false "still broken" reports).
- The canvas state is saved **synchronously** on every change
  (saveCanvasLayout(state) in a useEffect) â€” no debounce explosion.

---

## PART B â€” CANVAS DATA MODEL (verbatim)

### B1. src/types/canvas.ts (full current types)

```ts
export type CardType =
  | 'focus' | 'plan' | 'reflect' | 'finance'
  | 'digest' | 'approval' | 'transient' | 'annotation'
  | 'response' | 'group' | 'connectors'
  | 'schedule' | 'deadlines' | 'planner'
  | 'automation'
  | 'generated'

export type CardStatus = 'live' | 'stale' | 'error' | 'loading'

export interface CanvasCard {
  id: string
  type: CardType
  position: { x: number; y: number }
  size: { w: number; h: number }
  zIndex: number
  pinned: boolean
  data: Record<string, any>
  source: 'ai' | 'user' | 'system'
  status: CardStatus
  createdAt: number
  dismissedAt?: number
  groupId?: string
}

export interface CanvasGroup {
  id: string
  label: string
  colorId: GroupColorId
  cardIds: string[]
  position: { x: number; y: number }
  size: { w: number; h: number }
  createdAt: number
  orientation?: GroupOrientation
  ratio?: number
}

export interface CanvasState {
  cards: Record<string, CanvasCard>
  groups: Record<string, CanvasGroup>
  nextZIndex: number
  pan: { x: number; y: number }
  zoom: number
}

export const DEFAULT_STATE: CanvasState = {
  cards: {}, groups: {}, nextZIndex: 1, pan: { x: 0, y: 0 }, zoom: 1,
}
```

### B2. src/services/canvasPersistence.ts (verbatim â€” the CURRENT saving system)

```ts
const STORAGE_PREFIX = 'deskflow-canvas-'
const ACTIVE_KEY = 'deskflow-canvas-active'

export interface CanvasSnapshot {
  id: string; name: string; savedAt: number; cardCount: number; state: CanvasState
}

export function loadCanvasLayout(): CanvasState | null {
  try {
    const activeId = localStorage.getItem(ACTIVE_KEY)
    if (!activeId) {
      const hasAny = listCanvases()
      if (hasAny.length > 0) {
        localStorage.setItem(ACTIVE_KEY, hasAny[0].id)
        return hasAny[0].state
      }
      return null
    }
    const raw = localStorage.getItem(STORAGE_PREFIX + activeId)
    if (!raw) {
      const hasAny = listCanvases()
      if (hasAny.length > 0) {
        localStorage.setItem(ACTIVE_KEY, hasAny[0].id)
        return hasAny[0].state
      }
      return null
    }
    const parsed = JSON.parse(raw)
    if (parsed && parsed.state && parsed.state.cards) {
      return parsed.state as CanvasState
    }
    return null
  } catch { return null }
}

export function saveCanvasLayout(state: CanvasState, name?: string): string {
  const activeId = localStorage.getItem(ACTIVE_KEY) || crypto.randomUUID()
  localStorage.setItem(ACTIVE_KEY, activeId)
  const cardCount = Object.keys(state.cards).length
  const snapshot: CanvasSnapshot = {
    id: activeId, name: name || `Canvas ${cardCount} cards`,
    savedAt: Date.now(), cardCount,
    state: serializeState(state),
  }
  localStorage.setItem(STORAGE_PREFIX + activeId, JSON.stringify(snapshot))
  return activeId
}

function serializeState(state: CanvasState): CanvasState {
  return {
    nextZIndex: state.nextZIndex, groups: state.groups || {},
    pan: state.pan, zoom: state.zoom,
    cards: Object.fromEntries(
      Object.entries(state.cards).map(([id, card]) => [
        id, { id: card.id, type: card.type, position: card.position, size: card.size,
              zIndex: card.zIndex, pinned: card.pinned, source: card.source,
              createdAt: card.createdAt, groupId: card.groupId, status: card.status,
              data: card.data, dismissedAt: card.dismissedAt },
      ])
    ),
  }
}

export function listCanvases(): CanvasSnapshot[] { /* iterates all deskflow-canvas-* keys, sorts by savedAt DESC */ }

export function loadCanvasById(id: string): CanvasState | null {
  /* reads STORAGE_PREFIX+id, sets ACTIVE_KEY=id, returns snapshot.state */
}

export function renameCanvas(id: string, newName: string): void { /* renames snapshot.name */ }
export function deleteCanvas(id: string): void { /* removes key; if active, removes ACTIVE_KEY */ }

export function clearCanvasLayout(): void {
  // Removes ALL deskflow-canvas-* keys + ACTIVE_KEY + legacy 'deskflow-canvas-layout'
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith(STORAGE_PREFIX) || key === ACTIVE_KEY || key === 'deskflow-canvas-layout')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}
```

### B3. src/hooks/useCanvasState.ts (key API surface, verbatim excerpts)

```ts
const DISMISS_TIMEOUT_MS = 30_000
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useCanvasState() {
  const loadedFromStorage = useRef(false)
  const [state, dispatch] = useReducer(canvasReducer, null, () => {
    const loaded = loadCanvasLayout()
    if (loaded) loadedFromStorage.current = true
    return loaded || DEFAULT_STATE
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [canvasList, setCanvasList] = useState<CanvasSnapshot[]>(listCanvases())
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const saveResetTimer = useRef<...>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Save on every state change â€” synchronous
  useEffect(() => {
    setSaveStatus('saving')
    try {
      saveCanvasLayout(state)
      setSaveStatus('saved')
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current)
      saveResetTimer.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch { setSaveStatus('error') }
  }, [state.cards, state.groups, state.pan, state.zoom])

  // Force-save on unmount + beforeunload (both use stateRef.current)

  const addCard = useCallback((type, data, opts?) => { /* creates card, dispatch ADD_CARD, 30s dismiss timer unless pinned */ }, [])
  const updateCard / removeCard / moveCard / resizeCard / pinCard / dismissCard / setStatus
  const resetLayout / arrangeCards / setPanZoom / createGroup / updateGroup / ungroup /
        deleteGroup / addToGroup / removeFromGroup / syncAutomations / arrangeGroup

  const clearAll = useCallback(() => {
    dismissTimers.current.forEach(t => clearTimeout(t))
    dismissTimers.current.clear()
    loadedFromStorage.current = false      // re-seed defaults on next mount (New Canvas)
    stateRef.current = DEFAULT_STATE        // beforeunload saves the empty state
    dispatch({ type: 'RESET_LAYOUT' })
    clearCanvasLayout()
  }, [])

  const forceSave = useCallback(() => { /* saveCanvasLayout(state); setCanvasList(listCanvases()); status cycle */ }, [state])

  // Canvas management
  const saveAs = useCallback((name: string) => {
    setSaveStatus('saving')
    try {
      saveCanvasLayout(state, name)   // creates NEW entry (new UUID via ACTIVE_KEY || randomUUID)
      setCanvasList(listCanvases())
      setSaveStatus('saved')
      ...
    } catch { setSaveStatus('error') }
  }, [state])

  const loadCanvas = (id: string) => { /* loadCanvasById + HYDRATE dispatch */ }
  const rename / removeCanvas / refreshList

  return {
    cards /* non-dismissed */, allCards: state.cards, groups, nextZIndex, saveStatus,
    wasLoaded: loadedFromStorage.current,
    addCard, updateCard, removeCard, moveCard, resizeCard, pinCard, dismissCard,
    setStatus, resetLayout, arrangeCards, clearAll, forceSave, setPanZoom,
    createGroup, updateGroup, ungroup, deleteGroup, addToGroup, removeFromGroup, arrangeGroup, syncAutomations,
    canvasList, saveAs, loadCanvas, rename, removeCanvas, refreshList,
  }
}
```
---

## PART C — CURRENT CANVAS UI COMPONENTS (key excerpts)

### C1. CanvasContainer.tsx — toolbar buttons (current state, ~L300-476)

The toolbar currently has (in order): Add Card (emerald +), Focus, Zoom-, % label,
Zoom+, Auto-focus toggle, Save (floppy), New Canvas (cross icon), Fullscreen.
Save As is a separate dialog (`showSaveAs` state, name input) triggered from the
Manager panel. The user said "the buttons are too similar, like the + button is the
same for both functions. change it. and make sure they are properly arranged" —
the toolbar was rearranged into Left (Add +, Manager) / Center (Arrange, Focus,
Zoom) / Right (Auto-focus, Save, Save As, New, Fullscreen) groups, but the user has
NOT yet confirmed the visual result. **Verify the arrangement matches and icons are
distinct.**

```tsx
// Save As dialog (CanvasContainer.tsx:438-476)
{showSaveAs && (
  <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
      onClick={() => setShowSaveAs(false)} />
    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] rounded-2xl border border-zinc-700/50 bg-[rgba(18,18,18,0.98)] backdrop-blur-xl shadow-2xl p-5"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-[14px] font-semibold text-white mb-1">Save Canvas As</h3>
        <p className="text-[12px] text-zinc-400 mb-4">Create a new canvas with this layout.</p>
        <input type="text" value={saveAsName} onChange={e => setSaveAsName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && saveAsName.trim()) { onSaveAs?.(saveAsName.trim()); setShowSaveAs(false) } }}
          autoFocus className="w-full px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-700/50 text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors mb-4"
          placeholder="Canvas name..." />
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setShowSaveAs(false)} className="px-4 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors">Cancel</button>
          <button onClick={() => { if (saveAsName.trim()) { onSaveAs?.(saveAsName.trim()); setShowSaveAs(false) } }}
            disabled={!saveAsName.trim()}
            className="px-4 py-2 rounded-xl text-[12px] font-medium text-white bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
        </div>
      </div>
    </motion.div>
  </>
)}
```

### C2. CardDrawer.tsx (NEW — verbatim, full component, 155 lines)

```tsx
import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Target, Calendar, TrendingUp, Newspaper, Plug, Clock,
  ListTodo, Bell, MessageSquare, Layers, ChevronRight, ChevronLeft,
  type LucideIcon } from "lucide-react"
import type { CardType } from "../../../types/canvas"

interface CardDrawerProps { open: boolean; onToggle: () => void; onAddCard: (type: CardType) => void }

interface CardTemplate {
  type: CardType; label: string; description: string;
  icon: LucideIcon; color: string; category: "core" | "content" | "tools" | "special"
}

const CARD_TEMPLATES: CardTemplate[] = [
  { type: "focus", label: "Focus Goals", description: "Daily goals and focus tracking", icon: Target, color: "#f472b6", category: "core" },
  { type: "plan", label: "Long-term Plan", description: "Long-term goals and planning notes", icon: TrendingUp, color: "#a78bfa", category: "core" },
  { type: "finance", label: "Finance", description: "Balance, income, and expenses", icon: TrendingUp, color: "#34d399", category: "core" },
  { type: "digest", label: "Research Digest", description: "Research topics and summaries", icon: Newspaper, color: "#22d3ee", category: "core" },
  { type: "reflect", label: "Reflections", description: "Daily reflection summaries", icon: Bell, color: "#c084fc", category: "core" },
  { type: "response", label: "AI Response", description: "Text response from the AI", icon: MessageSquare, color: "#60a5fa", category: "content" },
  { type: "annotation", label: "Annotation", description: "Notes and reminders", icon: MessageSquare, color: "#fb923c", category: "content" },
  { type: "connectors", label: "Connectors", description: "Email and calendar integration", icon: Plug, color: "#2dd4bf", category: "tools" },
  { type: "schedule", label: "Weekly Schedule", description: "7-day schedule overview", icon: Calendar, color: "#f87171", category: "tools" },
  { type: "deadlines", label: "Deadlines", description: "Deadline tracker", icon: Clock, color: "#f97316", category: "tools" },
  { type: "planner", label: "Daily Planner", description: "Timeline with goals and tasks", icon: ListTodo, color: "#38bdf8", category: "tools" },
  { type: "group", label: "Group", description: "Container for grouped cards", icon: Layers, color: "#818cf8", category: "special" },
]

const CATEGORY_LABELS = { core: "Core", content: "Content", tools: "Tools", special: "Special" }
const CATEGORY_ORDER = ["core", "content", "tools", "special"]

export function CardDrawer({ open, onToggle, onAddCard }: CardDrawerProps) {
  const [hoveredType, setHoveredType] = useState<string | null>(null)
  // groups templates by category, renders animated slide-in drawer (right, w-[320px],
  // backdrop z-[180], panel z-[190]) with per-template hover glow using template.color
}
```

### C3. CustomConfirmDialog.tsx (NEW — verbatim, full component)

```tsx
// Props: { open, title, message, confirmLabel?, cancelLabel?, variant: "danger"|"warning"|"info", onConfirm, onCancel }
// Renders a fixed z-[200] backdrop + centered panel (max-w-[380px], rounded-2xl,
// border zinc-700/50, bg-[rgba(18,18,18,0.98)] backdrop-blur-xl shadow-2xl p-5)
// with a colored icon ring per variant (danger=rose, warning=amber, info=sky),
// title, message, Cancel (ghost) + Confirm (variant-colored) buttons.
// Supports Escape-to-cancel and Enter-to-confirm via useEffect keydown listener,
// and clicking the backdrop cancels.
```

### C4. CanvasCard.tsx — drag architecture (current, DO NOT REGRESS)

- Uses `mousedown` (not pointerdown!) on the drag handle; `mousemove`/`mouseup`
  registered on `window` inside `dragCleanupRef.current`; `onUp` commits position.
- Safety net effect: `window.addEventListener("blur", cleanupInteraction)` ONLY —
  no mouseup in the safety net (ordering bug), and the safety net's unmount
  cleanup must NOT call `cleanupInteraction()`.
- `engageDrag(e)` stores start position; a ~2px movement threshold before
  committing drag-end (prevents accidental grouping).
- Drop-target detection in CanvasGrid is rAF-throttled; groups are excluded both
  as targets and as dragged items; overlap threshold = 30% of dragged card area.
- `data-card-dragging` class + zIndex bump during drag; onPointerCancel + window
  pointerup/pointercancel/blur + unmount fallbacks clear refs.

---

## PART D — AI PROVIDER CHAIN + FALLBACK (verbatim)

### D1. src/services/providers/router.ts (full, 132 lines — THE fallback system)

```ts
export function buildChain(
  state: AiProvidersState,
  feature: "researchDigest" | "goalAssistant" | "resumeBuilder" | "category" | "colors" | "lifeAssistant" | "monthlyRecap",
): Array<{ provider: ResolvedProvider; model: string }> {
  const enabled = state.providers.filter(p => p.enabled)
  const assigned = state.routing[feature] ?? state.routing.default
  // primary = enabled provider matching assigned.providerId (model = assigned.model)
  // then ALL other enabled providers sorted by priority (model = p.models[0] ?? assigned.model)
  return chain
}

async function callWithTokenTiers(provider, req, externalSignal?): Promise<CanonicalResponse> {
  // monthlyTokenBudget check ? 402 if exhausted
  // tiers = [req.maxTokens ?? 1500, 100, 50, 40] — retry on 402/AbortError/5xx only
  // tracks cfg.tokensUsedThisMonth
}

export async function runWithFallback(
  chain: ReturnType<typeof buildChain>,
  req: Omit<CanonicalRequest, "model">,
  externalSignal?: AbortSignal,
): Promise<{ result: CanonicalResponse; usedProviderId: string }> {
  // tries chain[i] in order; callWithTokenTiers each; returns first success
  // aggregates errors; distinguishes timeout (AbortError) vs failure
  // final: throw Error(`All ${n} provider(s) exhausted — ...`)
}
```

**GOTCHA:** buildChain takes a CLOSED feature union — ANY new AI feature that wants
provider routing MUST extend that union in router.ts, or TS errors block the renderer
build. New AI IPC features go through `buildChain(pState, "<feature>")` +
`runWithFallback` for the chain, then OpenRouter direct fallback.

### D2. Digest IPC chain (current)

- preload.ts: `getTopicDigest: (opts?: { force?: boolean }) => ipcRenderer.invoke("get-topic-digest", opts)`
- preload.ts: `isDigestGenerating: () => ipcRenderer.invoke("is-digest-generating")`
- preload.ts: `onDigestGenerationComplete: (handler) => { ipcRenderer.on("digest-generation-complete", handler); return () => ipcRenderer.removeListener(...) }`
- main.ts:15963: `ipcMain.handle("get-topic-digest", ...)` — checks in-progress flag,
  returns { topics, status, reason } shapes; on completion sends
  `digest-generation-complete` event to renderer.
- AiPage digest polling: `digestPollRef` setInterval (AiPage.tsx:683-704) polls
  `isDigestGenerating`, stops when complete.
- Digest card data: `digestTopics` state; card type `digest`; seed pos {200,320},
  size {w:6,h:4} (AiPage.tsx:742).
- Provider routing UI: `AiProviderSelectModal` (src/components/AiProviderSelectModal.tsx)
  with featureKey "researchDigest" | "goalAssistant", wired in AiPage.tsx:961-1010
  (handleRoutingSave) + SettingsPage AI provider routing state.

### D3. SettingsPage AI config (defaults)

- `digestModel: "google/gemini-2.0-flash-001"` (SettingsPage.tsx:1395)
- routing state: `{ default: { providerId, model }, researchDigest: null, goalAssistant: null }`
- Settings ? AI section has "Topics you want AI to research daily digests for" (L4604).

---

## PART E — SEEDING & ADAPTIVE CARD LOGIC (AiPage.tsx)

### E1. Seeding effect (unified, uses canvas.wasLoaded)

```tsx
// AiPage.tsx (effect deps: [canvasMode, goals, longTermGoals, planningNotes,
//   digestTopics, reflectDays, connectorsState, connectors, connectorSyncing])
// if (!canvas.wasLoaded && cards.length === 0) ? seed core cards at grid positions:
//   focus {x:200,y:80}, plan {x:200,y:320}, finance {x:200,y:560},
//   digest {x:200,y:320} (digest only when digestTopics exist? — verify),
//   reflect, connectors, schedule, deadlines, planner
// if cards exist ? UPDATE existing cards' data in place (never duplicate)
// getCardPosition(type, index) ? 4-column grid, 200px spacing (replaces old 40px diagonal)
```

### E2. Bridge effect (message ? card)

AiPage.tsx:197: `case "digest_item": return "digest"` — message parsing maps parsed
types to CardTypes. Line 273-274: digest_item ? `canvas.addCard("digest", { topics: [...], msgId }, ...)`.
Other parsed types: goal_card, plan_item, reflection, finance, connector, schedule,
deadline, planner, annotation, transient — each mapped to a card add.

### E3. Adaptive requirement (user demand #5)

Cards must react to DATA PRESENCE: e.g. finance card with no transactions shows an
empty state + CTA ("No finance data yet — add your first transaction"), not a blank
or broken body. Each card component should own its 4 states (empty/loading/error/
populated) per the humancentred-UIUX skill (Part F2).

---

## PART F — DESIGN SYSTEM & MCP INVENTORY

### F1. DeskFlow tokens (re-skin rules — MANDATORY for any MCP-sourced component)

- Dark mode only. Glass layer: `bg-[rgba(24,24,27,0.60)]` or `bg-zinc-900/80` + `backdrop-blur-xl`.
- Max radius `rounded-xl` (exception: dialogs use rounded-2xl). Padding `p-5`.
- Fonts: Geist + JetBrains Mono (Google Fonts in index.html).
- Accents: emerald #10b981?#34d399 (productive), rose #f87171?#fbbf24 (deadlines),
  violet #8b5cf6?#a78bfa (AI), cyan #22d3ee (research/stats).
- Canvas CSS vars: `--dk-accent`, `--dk-text-muted` used by toolbar buttons.
- Text scale: 14px semibold titles, 12px muted secondary, 11px labels.

### F2. humancentred-UIUX skill — 6 pillars to apply to EVERY canvas card

1. Clarity over cleverness — plain-language labels, no raw tokens.
2. Progressive disclosure — advanced options hidden behind toggles.
3. Visual hierarchy — one focal point, muted metadata.
4. **Complete state coverage** — EVERY data-driven card: Empty (icon + one-line
   explanation + CTA), Loading (skeleton matching content shape), Error (plain
   cause + Retry), Populated, Partial/Overflow (truncation).
5. Feedback & micro-interactions — hover/focus/active/disabled on every control;
   150-300ms transitions; destructive actions confirmed (CustomConfirmDialog);
   submit feedback (loading?success/error).
6. Forgiveness & affordance — =44px targets, inline validation, keyboard nav,
   visible focus rings, no mouse-only interactions.

### F3. MCP component inventory (query results — use these, do NOT invent)

| Component | Source | Use for |
|-----------|--------|---------|
| card / dialog / input / button / tooltip | shadcn (installed) | Standard UI in cards |
| skeleton | shadcn (installed) | Loading states |
| Animated Beam / Border Beam / Number Ticker / Particles | Magic UI (vendored) | Card accents, stat ticks, connecting lines |
| Target, Calendar, TrendingUp, Newspaper, Plug, Clock, ListTodo, Bell, MessageSquare, Layers | lucide-react (installed) | Card icons (already used) |
| React Bits (135+), Iconify (200k+) | MCP | Fallbacks if a specific effect/icon is missing |

**Anti-slop checklist after sourcing:** re-skin to F1 tokens · max rounded-xl ·
p-5 · dark-only · Geist/JetBrains Mono · glass layer · no default purple gradients ·
no identical-radius-everything · real empty states, not blank boxes.

---

## PART G — CONTEXT SYSTEM (user demand #6 — DESIGN REQUIRED)

Current state of context/knowledge systems in the app (do NOT rebuild these — DESIGN
the integration for the AI page):

- **Graphify** — `graphify-out/graph.json`, skill at agent/skills/graphify/SKILL.md.
- **LLM Wiki** — all `agent/*.md` files.
- **Obsidian Skills** — `agent/skills/<name>/SKILL.md`.
- **PARA** — `CZVault/` (00_Projects, 01_Areas, 02_Resources, 03_Archives).
- **QMD** — `agent/templates/*.qmd`.
- **Automations** — `agent/automations/automations.json`.
- Terminal context assembly: `assemble-context` IPC (2000 token budget) injects
  problems/requests/sessions into agent prompts (TerminalPage.initializeTerminal).

The DESIGN must answer concretely: how the AI page (chat + canvas + digest) pulls
context via RAG / Graph RAG / Tiered Memory / multi-strategy retrieval — with real
file paths, IPC channel names, DB schema (or file locations), and a phased build plan.
Prefer: main-process index built from existing knowledge stores, chunked + embedded
(or keyword-scored if no embedding key), multi-strategy (BM25 + graph adjacency +
recency tier), exposed via a single `context:query` IPC.

---

## PART H — OPEN QUESTIONS FOR THE ARCHITECT

1. Should the "default canvas setup" be a NEW localStorage key (e.g.
   `deskflow-canvas-default-setup`) storing an array of {type, data, position,
   size, pinned}? Or a full CanvasState? Recommend one.
2. Where does the setup UI live? (CanvasContainer toolbar button ? setup dialog
   with per-card toggles + save; Manager panel entry point?)
3. Should "New Canvas" use the default setup, and should there be a per-canvas
   "Apply default setup" action?
4. Digest: is `get-topic-digest` generation synchronous-blocking or async with
   polling? (AiPage polls isDigestGenerating — verify handler returns quickly.)
5. Context system scope: AI-page only, or shared with terminal agents?

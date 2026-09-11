# RHEO AI Action System — Complete Design Specification

## Architecture Overview

```
src/
├── components/ai/
│   ├── tokens.ts                          (MODIFIED — add ACTION_ACCENT map)
│   ├── lib/
│   │   ├── motion.ts                      (MODIFIED — add 12 new variant sets)
│   │   └── actionBus.ts                   (NEW — event bus for AI action lifecycle)
│   ├── primitives/
│   │   ├── ActionOverlay.tsx              (NEW — in-context action feedback wrapper)
│   │   ├── CompletionBurst.tsx            (NEW — emerald glow + CheckDraw)
│   │   ├── ErrorShake.tsx                 (NEW — shake + red flash wrapper)
│   │   ├── AiBuildingIndicator.tsx        (NEW — progress + partial render)
│   │   └── ListTransition.tsx             (NEW — AnimatePresence list wrapper)
│   ├── chat/
│   │   ├── ThinkingIndicator.tsx          (UNCHANGED)
│   │   ├── ActionConfirmCard.tsx          (MODIFIED — wire to actionBus)
│   │   └── AgentProgressBar.tsx           (MODIFIED — accept actionId prop)
│   ├── canvas/
│   │   ├── cards/
│   │   │   ├── DynamicCard.tsx            (NEW — renders AI-generated UI JSON)
│   │   │   └── DynamicCardRenderer.tsx    (NEW — schema→React component mapper)
│   │   └── CanvasCard.tsx                 (MODIFIED — wrap with ActionOverlay)
│   └── compositions/
│       ├── CompositionPanel.tsx           (NEW — extracted from CompositionPage)
│       ├── CompositionRuleCard.tsx        (NEW — single rule with animations)
│       ├── CompositionEditorModal.tsx     (NEW — extracted editor)
│       └── CompositionHistoryDrawer.tsx   (NEW — extracted history)
├── hooks/
│   ├── useAiActions.ts                    (NEW — central action lifecycle hook)
│   ├── useDynamicUI.ts                    (NEW — AI UI generation state)
│   └── useToasts.ts                       (UNCHANGED — tertiary only)
├── types/
│   ├── canvas.ts                          (MODIFIED — add 'generated' CardType)
│   └── dynamicUI.ts                       (NEW — JSON schema types)
├── pages/
│   ├── AiPage.tsx                         (MODIFIED — 3-mode toggle, action wiring)
│   └── CompositionPage.tsx                (DEPRECATED — content moved)
└── App.tsx                                (MODIFIED — remove /compositions route)
```

---

## 1. Component Architecture

### Hierarchy (AI Page)

```
AiPage
├── TopBar
│   ├── ModeToggle [DECK | CANVAS | COMPOSITIONS]   ← 3-way now
│   ├── ProviderChip
│   ├── ConnectionStatus
│   └── ActionButtons (History, Goals, New, Features)
├── <AnimatePresence mode="wait">
│   ├── {mode === 'deck' && <AiPageDeck />}
│   ├── {mode === 'canvas' && <AiPageCanvas />}
│   └── {mode === 'compositions' && <CompositionPanel />}
├── ActionOverlayLayer (fixed, pointer-events-none)
│   └── Renders in-context overlays at action sites
├── AgentProgressBar (sticky bottom of chat slot)
└── ToastContainer (fixed bottom-right, tertiary only)
```

### Action Lifecycle Flow

```
User/AI triggers action
  → actionBus.emit('action:start', { id, type, target, payload })
    → useAiActions hook picks up event
      → Sets state: { status: 'executing', targetSlot, targetCardId }
        → ActionOverlay renders at target location (spinner + pink pulse)
        → AgentProgressBar shows step if multi-step
  → IPC call resolves
    → actionBus.emit('action:complete', { id, type, result })
      → CompletionBurst renders (emerald glow + CheckDraw, 1.2s)
      → In-context animation fires (card enter, list item slide, etc.)
  → OR IPC call rejects
    → actionBus.emit('action:error', { id, type, error })
      → ErrorShake renders (red flash + shake, 600ms)
      → Toast shows error message (tertiary)
```

---

## 2. Animation Specifications — Exact Framer-Motion Variants

### Additions to `src/components/ai/lib/motion.ts`

```ts
// ═══════════════════════════════════════════════════════════
// NEW: AI Action Animation Variants (appended after line 86)
// ═══════════════════════════════════════════════════════════

// ─── 1. Card Enter ───────────────────────────────────────
export const cardEnterVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  show: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: MOTION.slow, ease: easeOut },
  },
  exit: {
    opacity: 0, scale: 0.95, y: 8,
    transition: { duration: MOTION.normal, ease: easeInOut },
  },
}

// ─── 2. Card Exit ────────────────────────────────────────
export const cardExitVariants: Variants = {
  exit: {
    opacity: 0, y: 16, scale: 0.95,
    transition: { duration: MOTION.normal, ease: easeInOut },
  },
}

// ─── 3. Content Update Flash ─────────────────────────────
export const contentUpdateVariants: Variants = {
  idle: { backgroundColor: "rgba(139,92,246,0)" },
  flash: {
    backgroundColor: ["rgba(139,92,246,0)", "rgba(139,92,246,0.08)", "rgba(139,92,246,0)"],
    transition: { duration: 0.6, ease: "easeInOut" },
  },
}

// ─── 4. Action Spinner (in-context) ─────────────────────
export const actionSpinnerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: {
    opacity: 1, scale: 1,
    transition: { duration: MOTION.fast, ease: easeOut },
  },
  exit: {
    opacity: 0, scale: 0.8,
    transition: { duration: MOTION.fast, ease: easeInOut },
  },
}

// ─── 5. Completion Burst ─────────────────────────────────
export const completionBurstVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: {
    opacity: 1, scale: 1,
    transition: { duration: MOTION.normal, ease: [0.34, 1.56, 0.64, 1] }, // spring overshoot
  },
  exit: {
    opacity: 0, scale: 1.1,
    transition: { duration: MOTION.fast, ease: easeInOut },
  },
}

export const glowPulseVariants: Variants = {
  idle: { boxShadow: "0 0 0px 0px rgba(16,185,129,0)" },
  glow: {
    boxShadow: [
      "0 0 0px 0px rgba(16,185,129,0)",
      "0 0 12px 2px rgba(16,185,129,0.25)",
      "0 0 0px 0px rgba(16,185,129,0)",
    ],
    transition: { duration: 1.2, ease: "easeInOut" },
  },
}

// ─── 6. Error Shake ──────────────────────────────────────
export const errorShakeVariants: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -6, 6, -4, 4, -2, 2, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
}

export const errorFlashVariants: Variants = {
  idle: { borderColor: "rgba(63,63,70,0.5)" },
  flash: {
    borderColor: [
      "rgba(63,63,70,0.5)",
      "rgba(239,68,68,0.6)",
      "rgba(239,68,68,0.3)",
      "rgba(63,63,70,0.5)",
    ],
    transition: { duration: 0.6, ease: "easeInOut" },
  },
}

// ─── 7. List Item Add ────────────────────────────────────
export const listItemAddVariants: Variants = {
  hidden: { opacity: 0, x: 24, height: 0 },
  show: {
    opacity: 1, x: 0, height: "auto",
    transition: { duration: MOTION.normal, ease: easeOut },
  },
}

// ─── 8. List Item Remove ─────────────────────────────────
export const listItemRemoveVariants: Variants = {
  exit: {
    opacity: 0, x: -24, height: 0, marginBottom: 0,
    transition: { duration: MOTION.normal, ease: easeInOut },
  },
}

// ─── 9. Drag Feedback ────────────────────────────────────
export const dragFeedbackVariants: Variants = {
  idle: { scale: 1, zIndex: 1 },
  dragging: {
    scale: 1.03,
    zIndex: 100,
    transition: { duration: MOTION.fast, ease: easeOut },
  },
}

// ─── 10. Group Formation ─────────────────────────────────
export const groupFormationVariants: Variants = {
  hidden: { opacity: 0, scale: 1.1 },
  show: {
    opacity: 1, scale: 1,
    transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] },
  },
}

export const groupColorPulse: Variants = {
  idle: { opacity: 0.6 },
  pulse: {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 0.8, ease: "easeInOut", repeat: 1 },
  },
}

// ─── 11. AI Building ─────────────────────────────────────
export const aiBuildingVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  building: {
    opacity: 0.6, y: 10, scale: 0.95,
    transition: { duration: MOTION.slow, ease: easeOut },
  },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: MOTION.slow, ease: [0.34, 1.56, 0.64, 1] },
  },
}

// ─── 12. Composition Execute ─────────────────────────────
export const compositionExecuteVariants: Variants = {
  idle: { opacity: 1 },
  execute: {
    opacity: [1, 0.7, 1],
    transition: { duration: 0.4, ease: "easeInOut" },
  },
}

export const statusBadgePulse: Variants = {
  idle: { scale: 1 },
  pulse: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
}

// ─── Reduced Motion Override ─────────────────────────────
export function useActionMotionProps() {
  const reduce = useReducedMotion()
  if (reduce) {
    const instant = { duration: 0 }
    return {
      reduce: true as const,
      cardEnter: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } } satisfies Variants,
      listItem: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } } satisfies Variants,
      shake: { idle: {}, shake: {} } satisfies Variants,
      burst: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } } satisfies Variants,
      building: { hidden: { opacity: 0 }, building: { opacity: 0.6, transition: instant }, show: { opacity: 1, transition: instant } } satisfies Variants,
    }
  }
  return {
    reduce: false as const,
    cardEnter: cardEnterVariants,
    listItem: { ...listItemAddVariants, exit: listItemRemoveVariants.exit },
    shake: errorShakeVariants,
    burst: completionBurstVariants,
    building: aiBuildingVariants,
  }
}
```

### Additions to `src/components/ai/tokens.ts`

```ts
// Appended after SECTION_ACCENT (line 109)

export const ACTION_ACCENT = {
  "goal-add": "emerald",
  "goal-update": "violet",
  "goal-delete": "red",
  "email-send": "cyan",
  "email-sync": "cyan",
  "schedule-add": "amber",
  "deadline-add": "amber",
  "deadline-update": "violet",
  "deadline-delete": "red",
  "calendar-create": "cyan",
  "calendar-update": "violet",
  "calendar-delete": "red",
  "canvas-add": "pink",
  "canvas-remove": "red",
  "canvas-group": "violet",
  "composition-create": "emerald",
  "composition-execute": "pink",
  "composition-delete": "red",
  "ui-generate": "violet",
} as const satisfies Record<string, AccentKey>

export type ActionType = keyof typeof ACTION_ACCENT

export const ACTION_ICON = {
  "goal-add": "Plus",
  "goal-update": "Pencil",
  "goal-delete": "Trash2",
  "email-send": "Mail",
  "email-sync": "RefreshCw",
  "schedule-add": "CalendarPlus",
  "deadline-add": "Clock",
  "deadline-update": "Pencil",
  "deadline-delete": "Trash2",
  "calendar-create": "CalendarPlus",
  "calendar-update": "Pencil",
  "calendar-delete": "Trash2",
  "canvas-add": "LayoutGrid",
  "canvas-remove": "X",
  "canvas-group": "Group",
  "composition-create": "FileCode",
  "composition-execute": "Play",
  "composition-delete": "Trash2",
  "ui-generate": "Sparkles",
} as const
```

---

## 3. New Component Implementations

### `src/components/ai/lib/actionBus.ts` (NEW)

```ts
import { createContext, useContext } from "react"

export type ActionStatus = "pending" | "executing" | "complete" | "error"

export interface AiActionEvent {
  id: string
  type: ActionType
  status: ActionStatus
  targetSlot?: string       // e.g., "plan", "schedule", "deadlines"
  targetCardId?: string     // canvas card ID
  label: string             // human-readable: "Adding goal…"
  payload?: Record<string, any>
  error?: string
  steps?: { label: string; status: "pending" | "active" | "done" }[]
  timestamp: number
}

type Listener = (event: AiActionEvent) => void

class ActionBus {
  private listeners = new Set<Listener>()
  private active = new Map<string, AiActionEvent>()

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(event: AiActionEvent) {
    if (event.status === "complete" || event.status === "error") {
      this.active.delete(event.id)
    } else {
      this.active.set(event.id, event)
    }
    this.listeners.forEach((fn) => fn(event))
  }

  start(type: ActionType, label: string, opts?: Partial<AiActionEvent>): string {
    const id = crypto.randomUUID()
    this.emit({
      id, type, status: "executing", label,
      timestamp: Date.now(), ...opts,
    })
    return id
  }

  complete(id: string, result?: any) {
    const existing = this.active.get(id)
    if (existing) {
      this.emit({ ...existing, status: "complete", payload: result })
    }
  }

  fail(id: string, error: string) {
    const existing = this.active.get(id)
    if (existing) {
      this.emit({ ...existing, status: "error", error })
    }
  }

  getActive(): AiActionEvent[] {
    return [...this.active.values()]
  }
}

export const actionBus = new ActionBus()
export const ActionBusContext = createContext<ActionBus>(actionBus)
export const useActionBus = () => useContext(ActionBusContext)
```

### `src/hooks/useAiActions.ts` (NEW)

```ts
import { useState, useEffect, useCallback, useRef } from "react"
import { actionBus, type AiActionEvent, type ActionStatus } from "../components/ai/lib/actionBus"
import type { ActionType } from "../components/ai/tokens"

export interface ActiveAction {
  id: string
  type: ActionType
  status: ActionStatus
  label: string
  targetSlot?: string
  targetCardId?: string
  steps?: AiActionEvent["steps"]
  error?: string
}

export function useAiActions() {
  const [actions, setActions] = useState<Map<string, ActiveAction>>(new Map())
  const [lastCompleted, setLastCompleted] = useState<AiActionEvent | null>(null)
  const [lastError, setLastError] = useState<AiActionEvent | null>(null)
  const timeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    const unsub = actionBus.subscribe((event) => {
      if (event.status === "executing" || event.status === "pending") {
        setActions((prev) => {
          const next = new Map(prev)
          next.set(event.id, {
            id: event.id, type: event.type, status: event.status,
            label: event.label, targetSlot: event.targetSlot,
            targetCardId: event.targetCardId, steps: event.steps,
          })
          return next
        })
      } else if (event.status === "complete") {
        setActions((prev) => {
          const next = new Map(prev)
          next.delete(event.id)
          return next
        })
        setLastCompleted(event)
        // Auto-clear completion indicator after 1.5s
        const t = setTimeout(() => setLastCompleted(null), 1500)
        timeouts.current.set(event.id + "-complete", t)
      } else if (event.status === "error") {
        setActions((prev) => {
          const next = new Map(prev)
          next.delete(event.id)
          return next
        })
        setLastError(event)
        const t = setTimeout(() => setLastError(null), 2000)
        timeouts.current.set(event.id + "-error", t)
      }
    })
    return () => {
      unsub()
      timeouts.current.forEach(clearTimeout)
    }
  }, [])

  const isSlotActive = useCallback(
    (slot: string) => [...actions.values()].some((a) => a.targetSlot === slot && a.status === "executing"),
    [actions]
  )

  const isCardActive = useCallback(
    (cardId: string) => [...actions.values()].some((a) => a.targetCardId === cardId && a.status === "executing"),
    [actions]
  )

  const getActionForSlot = useCallback(
    (slot: string) => [...actions.values()].find((a) => a.targetSlot === slot && a.status === "executing"),
    [actions]
  )

  return { actions, lastCompleted, lastError, isSlotActive, isCardActive, getActionForSlot }
}
```

### `src/components/ai/primitives/ActionOverlay.tsx` (NEW)

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Check, AlertTriangle } from "lucide-react"
import { cn } from "../lib/cn"
import { ACCENT, MOTION, type AccentKey } from "../tokens"
import { ACTION_ACCENT, type ActionType } from "../tokens"
import { actionSpinnerVariants, completionBurstVariants, glowPulseVariants } from "../lib/motion"
import { CheckDraw } from "./CheckDraw"

interface ActionOverlayProps {
  status: "executing" | "complete" | "error" | null
  actionType?: ActionType
  label?: string
  className?: string
  children: React.ReactNode
}

/**
 * Wraps any UI section. Shows in-context feedback overlay
 * when an AI action targets this slot.
 */
export function ActionOverlay({ status, actionType, label, className, children }: ActionOverlayProps) {
  const reduce = useReducedMotion()
  const accent: AccentKey = actionType ? ACTION_ACCENT[actionType] : "pink"
  const a = ACCENT[accent]

  return (
    <div className={cn("relative", className)}>
      {children}

      {/* Executing overlay */}
      <AnimatePresence>
        {status === "executing" && (
          <motion.div
            variants={reduce ? undefined : actionSpinnerVariants}
            initial="hidden" animate="show" exit="exit"
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-zinc-950/40 backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900/90 px-3 py-2 ring-1 ring-zinc-700/60">
              <Loader2 size={14} className={cn("animate-spin motion-reduce:animate-none", a.text)} />
              <span className={cn("text-[11px] font-medium", a.text)}>{label ?? "Working…"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion glow */}
      <AnimatePresence>
        {status === "complete" && (
          <motion.div
            variants={reduce ? undefined : glowPulseVariants}
            initial="idle" animate="glow" exit="idle"
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
          >
            <motion.div
              variants={reduce ? undefined : completionBurstVariants}
              initial="hidden" animate="show" exit="exit"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20"
            >
              <CheckDraw done accent="emerald" size={14} reduce={reduce} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

### `src/components/ai/primitives/ErrorShake.tsx` (NEW)

```tsx
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "../lib/cn"
import { errorShakeVariants, errorFlashVariants } from "../lib/motion"

interface ErrorShakeProps {
  trigger: boolean
  onDone?: () => void
  className?: string
  children: React.ReactNode
}

export function ErrorShake({ trigger, onDone, className, children }: ErrorShakeProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={cn(trigger && "ring-1 ring-red-500/40 rounded-2xl", className)}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      variants={errorShakeVariants}
      animate={trigger ? "shake" : "idle"}
      onAnimationComplete={() => { if (trigger) onDone?.() }}
      className={className}
    >
      <motion.div
        variants={errorFlashVariants}
        animate={trigger ? "flash" : "idle"}
        className="rounded-2xl border border-transparent"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
```

### `src/components/ai/primitives/AiBuildingIndicator.tsx` (NEW)

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Sparkles, Loader2 } from "lucide-react"
import { cn } from "../lib/cn"
import { ACCENT, MOTION } from "../tokens"
import { Progress } from "./Progress"
import { aiBuildingVariants } from "../lib/motion"

interface AiBuildingIndicatorProps {
  visible: boolean
  label?: string
  progress?: number        // 0-1, undefined = indeterminate
  partialPreview?: React.ReactNode  // skeleton/partial render
  className?: string
}

export function AiBuildingIndicator({ visible, label = "Generating UI…", progress, partialPreview, className }: AiBuildingIndicatorProps) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          variants={reduce ? undefined : aiBuildingVariants}
          initial="hidden" animate="building" exit="hidden"
          className={cn(
            "rounded-2xl bg-zinc-900/40 p-5 ring-1 ring-violet-500/20 backdrop-blur-xl",
            className
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-violet-400 animate-pulse motion-reduce:animate-none" />
            <span className="text-[12px] font-medium text-violet-300">{label}</span>
            {progress !== undefined && (
              <span className="ml-auto text-[11px] tabular-nums text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          <Progress
            accent="violet"
            indeterminate={progress === undefined}
            value={progress ?? 0}
            aria-label="AI generation progress"
          />
          {partialPreview && (
            <div className="mt-3 opacity-40 animate-pulse motion-reduce:animate-none">
              {partialPreview}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### `src/components/ai/primitives/ListTransition.tsx` (NEW)

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { MOTION } from "../tokens"
import { listItemAddVariants, listItemRemoveVariants, easeOut, easeInOut } from "../lib/motion"

interface ListTransitionProps {
  items: { id: string; [key: string]: any }[]
  renderItem: (item: any, index: number) => React.ReactNode
  className?: string
  itemClassName?: string
}

/**
 * Wraps a list with AnimatePresence for add/remove animations.
 * Items slide in from right on add, slide out left + collapse on remove.
 */
export function ListTransition({ items, renderItem, className, itemClassName }: ListTransitionProps) {
  const reduce = useReducedMotion()

  const itemV = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0 } }, exit: { opacity: 0, transition: { duration: 0 } } }
    : { ...listItemAddVariants, exit: listItemRemoveVariants.exit }

  return (
    <div className={className}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            variants={itemV}
            initial="hidden"
            animate="show"
            exit="exit"
            transition={reduce ? { duration: 0 } : { duration: MOTION.normal, ease: easeOut }}
            className={itemClassName}
          >
            {renderItem(item, i)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

---

## 4. Dynamic UI Generation System

### `src/types/dynamicUI.ts` (NEW)

```ts
/**
 * JSON Schema for AI-generated UI components.
 * The AI emits this structure; DynamicCardRenderer converts it to React.
 */

export type DynamicComponentType =
  | "card"
  | "chart"
  | "list"
  | "form"
  | "stat"
  | "table"
  | "timeline"
  | "custom"

export type ChartVariant = "bar" | "line" | "donut" | "area"
export type FormFieldType = "text" | "number" | "select" | "toggle" | "date"

export interface DynamicUIComponent {
  id: string
  type: DynamicComponentType
  title: string
  subtitle?: string
  accent: "pink" | "emerald" | "amber" | "violet" | "red" | "cyan"
  size: { w: number; h: number }          // grid units (1 = 280px)
  position?: { x: number; y: number }     // canvas coords, auto-assigned if omitted
  data: DynamicComponentData
  actions?: DynamicAction[]
  createdAt: number
  source: "ai-generated"
}

export type DynamicComponentData =
  | CardData
  | ChartData
  | ListData
  | FormData
  | StatData
  | TableData
  | TimelineData

export interface CardData {
  kind: "card"
  body: string                            // markdown
  footer?: string
  badge?: { label: string; color: string }
}

export interface ChartData {
  kind: "chart"
  variant: ChartVariant
  series: { label: string; values: number[]; color?: string }[]
  xLabels?: string[]
  unit?: string
}

export interface ListData {
  kind: "list"
  items: { id: string; label: string; meta?: string; done?: boolean; icon?: string }[]
  sortable?: boolean
}

export interface FormData {
  kind: "form"
  fields: {
    name: string
    label: string
    type: FormFieldType
    placeholder?: string
    options?: string[]                     // for select
    defaultValue?: any
    required?: boolean
  }[]
  submitLabel?: string
}

export interface StatData {
  kind: "stat"
  value: number
  format?: "number" | "currency" | "percent" | "duration"
  trend?: { direction: "up" | "down" | "flat"; delta: number }
  sparkline?: number[]
}

export interface TableData {
  kind: "table"
  columns: { key: string; label: string; width?: number }[]
  rows: Record<string, any>[]
}

export interface TimelineData {
  kind: "timeline"
  events: { id: string; time: string; label: string; status?: "done" | "active" | "pending" }[]
}

export interface DynamicAction {
  id: string
  label: string
  icon?: string
  variant: "primary" | "secondary" | "danger"
  action: string                           // e.g., "dismiss", "save", "edit", "refresh"
}

/**
 * The AI response envelope for UI generation.
 * Parsed from the AI's structured output block.
 */
export interface AiUIGenerationResponse {
  intent: "generate-ui"
  components: DynamicUIComponent[]
  narration: string                        // what the AI says about what it built
  placement: "canvas" | "deck-slot"
  targetSlot?: string                      // if placement === "deck-slot"
}
```

### `src/components/ai/canvas/cards/DynamicCardRenderer.tsx` (NEW)

```tsx
import { useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  TrendingUp, TrendingDown, Minus, GripVertical, X, Pencil, Save,
} from "lucide-react"
import { cn } from "../../lib/cn"
import { ACCENT, SURFACE, RING, TEXT, MOTION, type AccentKey } from "../../tokens"
import { cardEnterVariants } from "../../lib/motion"
import { CountUp } from "../../primitives/CountUp"
import { Progress } from "../../primitives/Progress"
import type { DynamicUIComponent, ChartData, ListData, StatData, FormData, TableData, TimelineData, CardData } from "../../../types/dynamicUI"

interface DynamicCardRendererProps {
  component: DynamicUIComponent
  onDismiss: (id: string) => void
  onAction: (id: string, actionId: string) => void
  isBuilding?: boolean
}

export function DynamicCardRenderer({ component, onDismiss, onAction, isBuilding }: DynamicCardRendererProps) {
  const reduce = useReducedMotion()
  const a = ACCENT[component.accent as AccentKey]

  return (
    <motion.div
      variants={reduce ? undefined : cardEnterVariants}
      initial="hidden"
      animate={isBuilding ? "hidden" : "show"}
      exit="exit"
      layout
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl p-5 backdrop-blur-xl",
        SURFACE.card, RING.base,
        "hover:ring-zinc-700 transition-shadow",
        isBuilding && "opacity-50 animate-pulse motion-reduce:animate-none"
      )}
      style={{ minWidth: component.size.w * 280, minHeight: component.size.h * 200 }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className={cn("text-[13px] font-semibold", TEXT.primary)}>{component.title}</h3>
          {component.subtitle && (
            <p className={cn("text-[11px] mt-0.5", TEXT.muted)}>{component.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAction(component.id, "edit")} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDismiss(component.id)} className="p-1 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Accent bar */}
      <div className={cn("absolute top-0 left-0 h-0.5 w-full", a.bar)} style={{ opacity: 0.6 }} />

      {/* Body — type-specific renderer */}
      <div className="flex-1 min-h-0">
        <DataRenderer data={component.data} accent={component.accent as AccentKey} />
      </div>

      {/* Actions */}
      {component.actions && component.actions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-zinc-800/40 pt-3">
          {component.actions.map((act) => (
            <button
              key={act.id}
              onClick={() => onAction(component.id, act.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
                act.variant === "primary" && cn(a.pill, "hover:opacity-80"),
                act.variant === "secondary" && "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60",
                act.variant === "danger" && "bg-red-500/10 text-red-300 hover:bg-red-500/20"
              )}
            >
              {act.label}
            </button>
          ))}
        </div>
      )}

      {/* AI-generated badge */}
      <div className="absolute bottom-2 right-3 flex items-center gap-1 opacity-40">
        <span className="text-[9px] text-violet-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>AI</span>
      </div>
    </motion.div>
  )
}

function DataRenderer({ data, accent }: { data: DynamicUIComponent["data"]; accent: AccentKey }) {
  switch (data.kind) {
    case "card": return <CardBody data={data} />
    case "chart": return <ChartBody data={data} accent={accent} />
    case "list": return <ListBody data={data} accent={accent} />
    case "stat": return <StatBody data={data} accent={accent} />
    case "form": return <FormBody data={data} />
    case "table": return <TableBody data={data} />
    case "timeline": return <TimelineBody data={data} accent={accent} />
    default: return null
  }
}

function CardBody({ data }: { data: CardData }) {
  return (
    <div>
      <p className={cn("text-[12px] leading-relaxed", TEXT.secondary)}>{data.body}</p>
      {data.badge && (
        <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px]" style={{ background: data.badge.color + "18", color: data.badge.color }}>
          {data.badge.label}
        </span>
      )}
      {data.footer && <p className={cn("mt-2 text-[10px]", TEXT.muted)}>{data.footer}</p>}
    </div>
  )
}

function ChartBody({ data, accent }: { data: ChartData; accent: AccentKey }) {
  const a = ACCENT[accent]
  const max = Math.max(...data.series.flatMap((s) => s.values), 1)

  if (data.variant === "bar" || data.variant === "area") {
    return (
      <div className="flex items-end gap-1 h-24">
        {data.series[0]?.values.map((v, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${(v / max) * 100}%` }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn("flex-1 rounded-t-sm", a.bar)}
            style={{ opacity: 0.7 }}
            title={`${data.xLabels?.[i] ?? i}: ${v}${data.unit ?? ""}`}
          />
        ))}
      </div>
    )
  }

  if (data.variant === "donut") {
    const total = data.series[0]?.values.reduce((a, b) => a + b, 0) ?? 1
    let cumulative = 0
    const colors = ["#f472b6", "#10b981", "#f59e0b", "#8b5cf6", "#22d3ee", "#f87171"]
    return (
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64">
          {data.series[0]?.values.map((v, i) => {
            const pct = v / total
            const offset = cumulative
            cumulative += pct
            return (
              <circle key={i} cx="32" cy="32" r="24" fill="none"
                stroke={data.series[0]?.color ?? colors[i % colors.length]}
                strokeWidth="8" strokeDasharray={`${pct * 150.8} 150.8`}
                strokeDashoffset={-offset * 150.8}
                style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
              />
            )
          })}
        </svg>
        <div className="space-y-1">
          {data.series[0]?.values.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
              {data.xLabels?.[i] ?? `Item ${i + 1}`}: {v}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <div className="text-[11px] text-zinc-500">Chart: {data.variant}</div>
}

function ListBody({ data, accent }: { data: ListData; accent: AccentKey }) {
  const a = ACCENT[accent]
  return (
    <div className="space-y-1.5 max-h-40 overflow-y-auto">
      {data.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/40 transition-colors">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", item.done ? "bg-emerald-400" : a.dot)} />
          <span className={cn("flex-1 text-[11px] truncate", item.done ? "text-zinc-500 line-through" : TEXT.secondary)}>
            {item.label}
          </span>
          {item.meta && <span className="text-[9px] text-zinc-600 tabular-nums">{item.meta}</span>}
        </div>
      ))}
    </div>
  )
}

function StatBody({ data, accent }: { data: StatData; accent: AccentKey }) {
  const a = ACCENT[accent]
  const TrendIcon = data.trend?.direction === "up" ? TrendingUp : data.trend?.direction === "down" ? TrendingDown : Minus
  const trendColor = data.trend?.direction === "up" ? "text-emerald-400" : data.trend?.direction === "down" ? "text-red-400" : "text-zinc-500"

  const fmt = (n: number) => {
    switch (data.format) {
      case "currency": return `$${n.toLocaleString()}`
      case "percent": return `${n}%`
      case "duration": return `${Math.floor(n / 60)}h ${n % 60}m`
      default: return n.toLocaleString()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <CountUp value={data.value} format={fmt} className={cn("text-2xl font-bold", TEXT.primary)} />
      {data.trend && (
        <div className={cn("mt-1 flex items-center gap-1 text-[11px]", trendColor)}>
          <TrendIcon size={12} />
          <span>{data.trend.delta > 0 ? "+" : ""}{data.trend.delta}%</span>
        </div>
      )}
      {data.sparkline && (
        <div className="mt-2 flex items-end gap-px h-6">
          {data.sparkline.map((v, i) => {
            const max = Math.max(...data.sparkline!)
            return <div key={i} className={cn("w-1 rounded-full", a.bar)} style={{ height: `${(v / max) * 100}%`, opacity: 0.5 }} />
          })}
        </div>
      )}
    </div>
  )
}

function FormBody({ data }: { data: FormData }) {
  return (
    <div className="space-y-2">
      {data.fields.map((field) => (
        <div key={field.name}>
          <label className="text-[10px] text-zinc-500 block mb-1">{field.label}{field.required && " *"}</label>
          {field.type === "toggle" ? (
            <div className="h-5 w-9 rounded-full bg-zinc-700 relative cursor-pointer">
              <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-zinc-400" />
            </div>
          ) : field.type === "select" ? (
            <select className="w-full rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none">
              {field.options?.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : "text"}
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              className="w-full rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600"
            />
          )}
        </div>
      ))}
      <button className="mt-2 w-full rounded-lg bg-violet-600/80 hover:bg-violet-500/80 py-1.5 text-[11px] font-medium text-white transition-colors">
        {data.submitLabel ?? "Submit"}
      </button>
    </div>
  )
}

function TableBody({ data }: { data: TableData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-zinc-800/60">
            {data.columns.map((col) => (
              <th key={col.key} className="px-2 py-1.5 text-left font-medium text-zinc-500">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.slice(0, 8).map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
              {data.columns.map((col) => (
                <td key={col.key} className="px-2 py-1.5 text-zinc-300">{String(row[col.key] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TimelineBody({ data, accent }: { data: TimelineData; accent: AccentKey }) {
  const a = ACCENT[accent]
  return (
    <div className="space-y-0">
      {data.events.map((ev, i) => (
        <div key={ev.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("h-2 w-2 rounded-full mt-1", ev.status === "done" ? "bg-emerald-400" : ev.status === "active" ? a.dot : "bg-zinc-600")} />
            {i < data.events.length - 1 && <span className="w-px flex-1 bg-zinc-800" />}
          </div>
          <div className="pb-3">
            <span className="text-[9px] text-zinc-600 tabular-nums">{ev.time}</span>
            <p className={cn("text-[11px]", ev.status === "done" ? "text-zinc-500" : TEXT.secondary)}>{ev.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### `src/hooks/useDynamicUI.ts` (NEW)

```ts
import { useState, useCallback, useRef } from "react"
import { actionBus } from "../components/ai/lib/actionBus"
import type { DynamicUIComponent, AiUIGenerationResponse } from "../types/dynamicUI"
import type { CanvasCard } from "../types/canvas"

const STORAGE_KEY = "rheo-dynamic-ui-components"

function loadPersisted(): DynamicUIComponent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function persist(components: DynamicUIComponent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(components))
  } catch { /* quota exceeded — silently drop */ }
}

export function useDynamicUI() {
  const [components, setComponents] = useState<DynamicUIComponent[]>(loadPersisted)
  const [building, setBuilding] = useState<{ visible: boolean; progress?: number; label: string }>({ visible: false, label: "" })
  const buildTimer = useRef<NodeJS.Timeout | null>(null)

  const generateFromAI = useCallback(async (response: AiUIGenerationResponse) => {
    const actionId = actionBus.start("ui-generate", `Generating ${response.components.length} component(s)…`, {
      targetSlot: response.targetSlot,
    })

    // Simulate building progress
    setBuilding({ visible: true, progress: 0, label: "Generating UI…" })
    const steps = response.components.length
    for (let i = 0; i < steps; i++) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 200))
      setBuilding({ visible: true, progress: (i + 1) / steps, label: `Building "${response.components[i].title}"…` })
    }

    // Add components
    const newComponents = response.components.map((c) => ({
      ...c,
      id: c.id || crypto.randomUUID(),
      createdAt: Date.now(),
      source: "ai-generated" as const,
    }))

    setComponents((prev) => {
      const next = [...prev, ...newComponents]
      persist(next)
      return next
    })

    setBuilding({ visible: false, label: "" })
    actionBus.complete(actionId)
    return newComponents
  }, [])

  const dismissComponent = useCallback((id: string) => {
    setComponents((prev) => {
      const next = prev.filter((c) => c.id !== id)
      persist(next)
      return next
    })
  }, [])

  const updateComponent = useCallback((id: string, patch: Partial<DynamicUIComponent>) => {
    setComponents((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      persist(next)
      return next
    })
  }, [])

  const toCanvasCards = useCallback((): CanvasCard[] => {
    return components.map((c, i) => ({
      id: `dyn-${c.id}`,
      type: "generated" as any,
      position: c.position ?? { x: 80 + (i % 3) * 320, y: 80 + Math.floor(i / 3) * 260 },
      size: { w: c.size.w * 280, h: c.size.h * 200 },
      zIndex: 10 + i,
      pinned: false,
      data: { dynamicComponent: c },
      source: "ai" as const,
      status: "live" as const,
      createdAt: c.createdAt,
    }))
  }, [components])

  return { components, building, generateFromAI, dismissComponent, updateComponent, toCanvasCards }
}
```

---

## 5. Compositions Integration

### `src/components/ai/compositions/CompositionPanel.tsx` (NEW)

```tsx
import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Plus, FileCode, Loader2 } from "lucide-react"
import { cn } from "../lib/cn"
import { SURFACE, RING, TEXT, ACCENT, MOTION } from "../tokens"
import { sectionVariants, staggerParent, itemVariants, cardEnterVariants } from "../lib/motion"
import { actionBus } from "../lib/actionBus"
import { CompositionRuleCard } from "./CompositionRuleCard"
import { CompositionEditorModal } from "./CompositionEditorModal"
import { CompositionHistoryDrawer } from "./CompositionHistoryDrawer"
import type { CompositionRule, ExecutionStatus, ExecutionLog } from "./types"

const API = (window as any).deskflowAPI

export function CompositionPanel() {
  const reduce = useReducedMotion()
  const [rules, setRules] = useState<CompositionRule[]>([])
  const [statuses, setStatuses] = useState<Map<string, ExecutionStatus>>(new Map())
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<CompositionRule | null>(null)
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([API?.compositionsList(), API?.compositionsStatus()])
      if (r) setRules(r)
      if (s) {
        const map = new Map<string, ExecutionStatus>()
        for (const row of s) map.set(row.rule_id, row)
        setStatuses(map)
      }
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = useCallback(async (data: any) => {
    const actionId = actionBus.start("composition-create", `Creating rule "${data.name}"…`)
    try {
      await API?.compositionsCreate({ id: crypto.randomUUID(), ...data, enabled: 1 })
      actionBus.complete(actionId)
      setShowEditor(false)
      await load()
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
    }
  }, [load])

  const handleEvaluate = useCallback(async (id: string, name: string) => {
    const actionId = actionBus.start("composition-execute", `Running "${name}"…`)
    try {
      await API?.compositionsEvaluate(id, {})
      actionBus.complete(actionId)
      await load()
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
    }
  }, [load])

  const handleDelete = useCallback(async (id: string, name: string) => {
    const actionId = actionBus.start("composition-delete", `Deleting "${name}"…`)
    try {
      await API?.compositionsDelete(id)
      actionBus.complete(actionId)
      await load()
    } catch (err: any) {
      actionBus.fail(actionId, err.message)
    }
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-zinc-500 motion-reduce:animate-none" />
      </div>
    )
  }

  return (
    <motion.div
      variants={reduce ? undefined : staggerParent}
      initial="hidden" animate="show"
      className="flex flex-col h-full"
    >
      {/* Header */}
      <motion.div variants={reduce ? undefined : sectionVariants} className="flex items-center justify-between mb-5">
        <div>
          <h2 className={cn("text-[15px] font-semibold", TEXT.primary)}>Compositions</h2>
          <p className={cn("text-[11px] mt-0.5", TEXT.muted)}>DSL-driven automation rules</p>
        </div>
        <button
          onClick={() => { setEditingRule(null); setShowEditor(true) }}
          className="flex items-center gap-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-500/80 px-4 py-2 text-[12px] font-medium text-white transition-colors"
        >
          <Plus size={14} /> New Rule
        </button>
      </motion.div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <motion.div variants={reduce ? undefined : sectionVariants} className="flex flex-col items-center justify-center flex-1 text-zinc-500">
          <FileCode size={40} className="mb-3 opacity-20" />
          <p className="text-[13px]">No composition rules yet</p>
          <p className="text-[11px] mt-1 text-zinc-600">Ask the AI to create one, or click New Rule</p>
        </motion.div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence mode="popLayout">
            {rules.map((rule) => (
              <CompositionRuleCard
                key={rule.id}
                rule={rule}
                status={statuses.get(rule.id)}
                onEdit={() => { setEditingRule(rule); setShowEditor(true) }}
                onEvaluate={() => handleEvaluate(rule.id, rule.name)}
                onDelete={() => handleDelete(rule.id, rule.name)}
                onHistory={() => setHistoryRuleId(rule.id)}
                reduce={reduce}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <CompositionEditorModal
            rule={editingRule}
            onSave={handleCreate}
            onClose={() => setShowEditor(false)}
          />
        )}
      </AnimatePresence>

      {/* History Drawer */}
      <AnimatePresence>
        {historyRuleId && (
          <CompositionHistoryDrawer
            ruleId={historyRuleId}
            onClose={() => setHistoryRuleId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

### `src/components/ai/compositions/CompositionRuleCard.tsx` (NEW)

```tsx
import { motion, useReducedMotion } from "framer-motion"
import { Play, Pencil, Trash2, RotateCcw, Loader2, AlertCircle } from "lucide-react"
import { cn } from "../lib/cn"
import { SURFACE, RING, TEXT, MOTION } from "../tokens"
import { cardEnterVariants, compositionExecuteVariants, statusBadgePulse } from "../lib/motion"
import type { CompositionRule, ExecutionStatus } from "./types"

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: "text-zinc-400 bg-zinc-800", label: "Idle" },
  success: { color: "text-emerald-400 bg-emerald-500/10", label: "Success" },
  failure: { color: "text-red-400 bg-red-500/10", label: "Failure" },
  running: { color: "text-pink-400 bg-pink-500/10", label: "Running" },
  active: { color: "text-emerald-400 bg-emerald-500/10", label: "Active" },
}

interface Props {
  rule: CompositionRule
  status?: ExecutionStatus
  onEdit: () => void
  onEvaluate: () => void
  onDelete: () => void
  onHistory: () => void
  reduce: boolean
}

export function CompositionRuleCard({ rule, status, onEdit, onEvaluate, onDelete, onHistory, reduce }: Props) {
  const sc = STATUS_CONFIG[status?.last_status ?? "idle"] ?? STATUS_CONFIG.idle
  const isRunning = status?.last_status === "running"

  return (
    <motion.div
      layout
      variants={reduce ? undefined : cardEnterVariants}
      initial="hidden" animate="show" exit="exit"
      className={cn(
        "rounded-2xl p-5 backdrop-blur-xl transition-colors",
        SURFACE.card, RING.base, "hover:ring-zinc-700"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className={cn("text-[13px] font-medium truncate", TEXT.primary)}>{rule.name}</h3>
            <motion.span
              variants={reduce ? undefined : statusBadgePulse}
              animate={isRunning ? "pulse" : "idle"}
              className={cn("text-[10px] px-2 py-0.5 rounded-full", sc.color)}
            >
              {sc.label}
            </motion.span>
            {rule.enabled ? (
              <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">On</span>
            ) : (
              <span className="text-[9px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">Off</span>
            )}
          </div>
          {rule.description && <p className={cn("text-[11px] mt-1 truncate", TEXT.muted)}>{rule.description}</p>}
          <div className={cn("flex items-center gap-3 mt-2 text-[9px]", TEXT.muted)} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <span>v{rule.version}</span>
            <span>{rule.category}</span>
            <span>{rule.lifecycle}</span>
            <span>pri:{rule.priority}</span>
          </div>
          {(status?.consecutive_failures ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-400">
              <AlertCircle size={11} />
              {status!.consecutive_failures} consecutive failure{(status!.consecutive_failures ?? 0) > 1 ? "s" : ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 ml-3">
          <button onClick={onEvaluate} disabled={isRunning} className="p-2 rounded-lg text-zinc-400 hover:text-pink-300 hover:bg-pink-500/10 transition-colors" title="Run">
            {isRunning ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" /> : <Play size={13} />}
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors" title="Edit">
            <Pencil size={13} />
          </button>
          <button onClick={onHistory} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors" title="History">
            <RotateCcw size={13} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
```

---

## 6. AiPage.tsx Modifications

### Top Bar — 3-Way Mode Toggle

Replace the existing DECK/CANVAS toggle (lines 1229–1291) with:

```tsx
// Replace the single canvas toggle button with a 3-way segmented control:
type ViewMode = "deck" | "canvas" | "compositions"
const [viewMode, setViewMode] = useState<ViewMode>("deck")

// In the top bar JSX:
<div className="flex items-center rounded-lg bg-zinc-900/60 p-0.5 ring-1 ring-zinc-800/60">
  {(["deck", "canvas", "compositions"] as ViewMode[]).map((m) => (
    <button
      key={m}
      onClick={() => setViewMode(m)}
      className={cn(
        "relative rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
        viewMode === m ? "text-white" : "text-zinc-500 hover:text-zinc-300"
      )}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {viewMode === m && (
        <motion.span
          layoutId="mode-pill"
          className="absolute inset-0 rounded-md bg-zinc-700/60"
          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
        />
      )}
      <span className="relative z-10 uppercase">{m}</span>
    </button>
  ))}
</div>
```

### Main Content Area

```tsx
// Replace the existing conditional render with:
<AnimatePresence mode="wait">
  {viewMode === "deck" && (
    <motion.div key="deck" variants={sectionVariants} initial="hidden" animate="show" exit="hidden" className="flex-1 min-h-0">
      <AiPageDeck {/* ...existing props... */} />
    </motion.div>
  )}
  {viewMode === "canvas" && (
    <motion.div key="canvas" variants={sectionVariants} initial="hidden" animate="show" exit="hidden" className="flex-1 min-h-0">
      <AiPageCanvas {/* ...existing props + dynamicUI cards... */} />
    </motion.div>
  )}
  {viewMode === "compositions" && (
    <motion.div key="compositions" variants={sectionVariants} initial="hidden" animate="show" exit="hidden" className="flex-1 min-h-0 overflow-hidden">
      <CompositionPanel />
    </motion.div>
  )}
</AnimatePresence>
```

### Wiring Actions to Existing Handlers

```tsx
// Example: Goal add handler (around line 966)
const handleAddGoal = async (goalText: string) => {
  const actionId = actionBus.start("goal-add", `Adding goal "${goalText.slice(0, 30)}…"`, {
    targetSlot: "plan",
  })
  try {
    await api.saveGoal(today, { id: crypto.randomUUID(), text: goalText, status: "active", createdAt: Date.now() })
    actionBus.complete(actionId)
    // The plan slot will show CompletionBurst via useAiActions
  } catch (err: any) {
    actionBus.fail(actionId, err.message)
  }
}

// Example: Email send (in ActionConfirmCard onConfirm)
const handleSendEmail = async () => {
  const actionId = actionBus.start("email-send", `Sending email to ${action.to}…`, {
    targetSlot: "connectors",
    steps: [
      { label: "Composing", status: "done" },
      { label: "Sending via SMTP", status: "active" },
      { label: "Confirming delivery", status: "pending" },
    ],
  })
  try {
    await API.connectorsSendEmail(action.payload)
    actionBus.complete(actionId)
  } catch (err: any) {
    actionBus.fail(actionId, err.message)
  }
}
```

### Deck Slot Wrapper

Each deck slot gets wrapped with `ActionOverlay`:

```tsx
// In AiPageDeck, wrap each section:
<ActionOverlay
  status={isSlotActive("plan") ? "executing" : lastCompleted?.targetSlot === "plan" ? "complete" : null}
  actionType="goal-add"
  label={getActionForSlot("plan")?.label}
>
  {/* existing PlanSlot content */}
</ActionOverlay>
```

---

## 7. App.tsx Modifications

```tsx
// REMOVE from sidebar nav (line 2414):
// { icon: FileCode, label: 'Compositions', path: '/compositions' }

// REMOVE route (line 2766):
// <Route path="/compositions" element={<CompositionPage />} />

// ADD redirect for backwards compat:
<Route path="/compositions" element={<Navigate to="/ai" replace />} />
```

---

## 8. Canvas Types Modification

### `src/types/canvas.ts` — Add generated card type

```ts
// Line 1: extend CardType
export type CardType = 'focus' | 'plan' | 'reflect' | 'finance' | 'digest' | 'approval'
  | 'transient' | 'annotation' | 'response' | 'group' | 'connectors'
  | 'schedule' | 'deadlines' | 'planner' | 'generated'  // ← ADD 'generated'

// Add to CanvasAction union:
  | { type: 'ADD_GENERATED_CARD'; component: DynamicUIComponent; card: CanvasCard }
  | { type: 'REMOVE_GENERATED_CARD'; id: string }
```

---

## 9. Persistence Model

```
┌─────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYERS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Canvas State (existing)                                 │
│     └─ localStorage["rheo-canvas-state"]                    │
│        └─ cards: Record<string, CanvasCard>                 │
│           └─ type: "generated" cards have                   │
│              data.dynamicComponent = DynamicUIComponent      │
│                                                             │
│  2. Dynamic UI Components (new, redundant for fast access)  │
│     └─ localStorage["rheo-dynamic-ui-components"]           │
│        └─ DynamicUIComponent[]                              │
│        └─ Written on every add/update/dismiss               │
│        └─ Read on hook init                                 │
│                                                             │
│  3. Composition Rules (existing, SQLite)                    │
│     └─ composition_rules table                              │
│     └─ composition_versions table                           │
│     └─ composition_execution_log table                      │
│     └─ Accessed via IPC (compositions:* handlers)           │
│                                                             │
│  4. Action History (new, ephemeral + optional persist)      │
│     └─ In-memory Map in actionBus                           │
│     └─ Optional: last 50 actions → localStorage             │
│        ["rheo-action-history"]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Hydration flow on app start:**
1. `useDynamicUI` reads `localStorage["rheo-dynamic-ui-components"]`
2. Canvas reducer hydrates from `localStorage["rheo-canvas-state"]`
3. Generated cards in canvas state are cross-referenced with dynamic UI list
4. If a card exists in canvas but not in dynamic list → orphan, remove on next save
5. If a component exists in dynamic list but not canvas → re-add card on next canvas render

---

## 10. Error Handling — Graceful Degradation

| Failure Mode | Detection | Response | Recovery |
|---|---|---|---|
| **AI generation returns malformed JSON** | `JSON.parse` throws in response handler | Show ErrorShake on chat slot + toast "Couldn't parse AI response" | User can retry; partial components discarded |
| **AI generation times out (>30s)** | `AbortController` signal | AiBuildingIndicator shows error state, progress bar turns red | Auto-dismiss after 3s; user can retry |
| **IPC call fails (compositions, email, etc.)** | Promise rejection in handler | `actionBus.fail()` → ErrorShake on target slot + error toast | Action removed from active map; user can retry manually |
| **Canvas state localStorage full** | `setItem` throws `QuotaExceededError` | Silently skip persist; show one-time toast "Storage full — changes won't persist" | Components remain in memory for session |
| **DynamicCardRenderer receives unknown type** | `switch` default case | Render fallback: title + "Unsupported component" text in muted style | Component still dismissible |
| **Composition DSL validation fails** | `compositions:validate` returns `valid: false` | Show inline errors in editor modal with line/col highlights | User fixes DSL and re-validates |
| **framer-motion animation interrupted** | Component unmounts mid-animation | `AnimatePresence` handles exit; no orphaned DOM | Automatic via React lifecycle |
| **prefers-reduced-motion enabled** | `useReducedMotion()` returns true | All variants collapse to `{ opacity: 0 } → { opacity: 1, duration: 0 }` | No motion, instant state changes |
| **Multiple simultaneous actions on same slot** | actionBus tracks by ID | Overlay shows most recent; AgentProgressBar shows queue count | FIFO completion; each gets its own burst |
| **Network failure during email/calendar** | IPC timeout / nodemailer error | ErrorShake + specific error message in toast | ActionConfirmCard reverts to confirm state for retry |

### Error Boundary for Dynamic Cards

```tsx
// Wrap each DynamicCardRenderer in an error boundary:
class DynamicCardErrorBoundary extends React.Component<
  { children: React.ReactNode; componentId: string; onDismiss: (id: string) => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl bg-red-500/5 ring-1 ring-red-500/20 p-4 flex flex-col items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <span className="text-[11px] text-red-300">Component failed to render</span>
          <button
            onClick={() => this.props.onDismiss(this.props.componentId)}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

## 11. AI Prompt Integration for Dynamic UI

The AI system prompt addition that enables structured UI generation:

```
When the user asks you to create a visual element, dashboard, chart, or any UI component,
respond with a fenced code block tagged ```ui-generation containing valid JSON matching
the AiUIGenerationResponse schema. The system will parse this and render it live.

Example:
```ui-generation
{
  "intent": "generate-ui",
  "components": [{
    "id": "auto",
    "type": "stat",
    "title": "Focus Hours This Week",
    "accent": "emerald",
    "size": { "w": 1, "h": 1 },
    "data": {
      "kind": "stat",
      "value": 23.5,
      "format": "duration",
      "trend": { "direction": "up", "delta": 12 },
      "sparkline": [3, 4, 2, 5, 4, 6, 3.5]
    },
    "actions": [
      { "id": "details", "label": "View Details", "variant": "secondary", "action": "navigate" }
    ]
  }],
  "narration": "Here's your focus summary for the week — trending up 12%!",
  "placement": "canvas"
}
```
```

The chat message parser in AiPage detects ` ```ui-generation ` blocks, extracts the JSON, and calls `dynamicUI.generateFromAI(parsed)`.

---

## 12. Complete Animation Sequence Reference

| # | Animation | Trigger | Duration | Easing | Visual |
|---|---|---|---|---|---|
| 1 | Card Enter | AI adds canvas card | 400ms | `[0.16,1,0.3,1]` | scale 0.95→1, y 12→0, fade in |
| 2 | Card Exit | User dismisses card | 250ms | `[0.4,0,0.2,1]` | fade out, y 0→16, scale 1→0.95 |
| 3 | Content Update | AI edits existing card | 600ms | easeInOut | violet bg flash 0→8%→0 |
| 4 | Action Spinner | Any AI action executing | ∞ (loop) | linear | Loader2 spin + pink text + backdrop blur |
| 5 | Completion Burst | Action succeeds | 1200ms | spring `[0.34,1.56,0.64,1]` | CheckDraw path draw + emerald glow ring |
| 6 | Error Shake | Action fails | 500ms | easeInOut | x: 0→-6→6→-4→4→-2→2→0 + red border |
| 7 | List Item Add | Goal/item inserted | 250ms | `[0.16,1,0.3,1]` | x 24→0, height 0→auto, fade in |
| 8 | List Item Remove | Goal/item deleted | 250ms | `[0.4,0,0.2,1]` | x 0→-24, height→0, fade out |
| 9 | Drag Feedback | Card drag start | 150ms | `[0.16,1,0.3,1]` | scale 1→1.03, z-index boost |
| 10 | Group Formation | Cards grouped | 400ms | spring | scale 1.1→1, fade in, color pulse ×2 |
| 11 | AI Building | UI generation in progress | 400ms enter | `[0.16,1,0.3,1]` | y 20→10, opacity 0→0.6, progress bar |
| 12 | Composition Execute | DSL rule runs | 400ms | easeInOut | opacity 1→0.7→1, status badge scale pulse |

---

## 13. File Change Summary

| File | Action | Scope |
|---|---|---|
| `src/components/ai/tokens.ts` | MODIFY | Add `ACTION_ACCENT`, `ACTION_ICON`, `ActionType` (+35 lines) |
| `src/components/ai/lib/motion.ts` | MODIFY | Add 12 variant sets + `useActionMotionProps` (+140 lines) |
| `src/components/ai/lib/actionBus.ts` | CREATE | Event bus class + context (~80 lines) |
| `src/components/ai/primitives/ActionOverlay.tsx` | CREATE | In-context overlay wrapper (~75 lines) |
| `src/components/ai/primitives/ErrorShake.tsx` | CREATE | Shake + flash wrapper (~40 lines) |
| `src/components/ai/primitives/AiBuildingIndicator.tsx` | CREATE | Generation progress (~60 lines) |
| `src/components/ai/primitives/ListTransition.tsx` | CREATE | Animated list wrapper (~50 lines) |
| `src/hooks/useAiActions.ts` | CREATE | Central action state hook (~90 lines) |
| `src/hooks/useDynamicUI.ts` | CREATE | Dynamic UI state + persistence (~100 lines) |
| `src/types/dynamicUI.ts` | CREATE | JSON schema types (~120 lines) |
| `src/types/canvas.ts` | MODIFY | Add `'generated'` to CardType, 2 new actions (+5 lines) |
| `src/components/ai/canvas/cards/DynamicCardRenderer.tsx` | CREATE | Schema→React renderer (~280 lines) |
| `src/components/ai/compositions/CompositionPanel.tsx` | CREATE | Integrated compositions view (~130 lines) |
| `src/components/ai/compositions/CompositionRuleCard.tsx` | CREATE | Animated rule card (~90 lines) |
| `src/components/ai/compositions/CompositionEditorModal.tsx` | CREATE | Extracted from CompositionPage (~150 lines) |
| `src/components/ai/compositions/CompositionHistoryDrawer.tsx` | CREATE | Extracted history view (~80 lines) |
| `src/components/ai/compositions/types.ts` | CREATE | Shared composition types (~20 lines) |
| `src/pages/AiPage.tsx` | MODIFY | 3-mode toggle, ActionOverlay wiring, useAiActions, useDynamicUI (~+80 lines, ~-20 lines) |
| `src/pages/CompositionPage.tsx` | DEPRECATE | Keep file, add redirect notice; content lives in CompositionPanel |
| `src/App.tsx` | MODIFY | Remove sidebar item + route, add redirect (~-2 lines, +1 line) |
| `src/components/ai/chat/ActionConfirmCard.tsx` | MODIFY | Wire confirm/cancel to actionBus (~+10 lines) |
| `src/components/ai/chat/AgentProgressBar.tsx` | MODIFY | Accept `actionId` prop for bus integration (~+5 lines) |

**Total new code: ~1,380 lines across 12 new files**
**Total modifications: ~200 lines across 7 existing files**

---

This is one unified system. The action bus is the spine — every AI action flows through it, every animation reacts to it, compositions use it, and dynamic UI generation is triggered through it. The three view modes (Deck / Canvas / Compositions) share the same action feedback layer, so a composition rule that creates a goal will animate the goal appearing in the Plan slot regardless of which view the user is currently in.
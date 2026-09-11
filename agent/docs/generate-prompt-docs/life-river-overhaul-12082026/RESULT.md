# RESULT.md — Life River Feature Overhaul

## 0. What this change guarantees on first paint

When `/life` loads in **River mode**, the user must immediately see:

1. **Lens indicator bar** — current lens name, icon, and meaning.
2. **Quick-add toolbar** — Phase / Covenant / Goal / Memory buttons, always visible.
3. **Data preview cards** — Covenant, Gold, and Memories counts visible without switching lens.
4. **Draft shelf** — existing drafts or a clear empty state.
5. **Voice badge** — visible mic indicator on the Phase add button and inside the Phase dialog.
6. **Taller River / Core Sample** — the ring/river visualization is materially larger.
7. **Interactive rings** — clicking a ring opens the phase edit dialog.
8. **Inline add overlays** — Covenant, Gold, and Memory can be added without leaving River mode.

No feature may require the user to open a dialog, switch lens, or create data first before the UI proves the feature exists.

---

## 1. File-by-file implementation

---

# 1.1 `src/features/warmth/LifePage.tsx`

This is the orchestration layer. It must render the always-visible River control deck and wire ring clicks to editing.

## A. Add imports

Add these imports near the existing `lucide-react` and component imports:

```tsx
import {
  Layers,
  Sparkles,
  Target,
  Images,
  Mic,
  Plus,
  FileClock,
  Pencil,
} from 'lucide-react'

import {
  InlineGoldForm,
  InlineMemoryForm,
  type GoldDraft,
  type MemoryDraft,
} from '@/components/life-river/inline-add-forms'
```

If `LensId` is not already imported, import it from the same place `CoreSample` or `RingCanvas` exports it:

```tsx
import type { LensId } from '@/components/life-river/RingCanvas'
```

---

## B. Add lens metadata after existing state declarations

Place this inside `LifePage`, after the existing state hooks and before the return.

```tsx
const LENS_META: Record<
  LensId,
  {
    label: string
    icon: typeof Layers
    blurb: string
    activeClass: string
  }
> = {
  phases: {
    label: 'Phases',
    icon: Layers,
    blurb: 'The full cross-section — every chapter and every layer visible together.',
    activeClass: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  },
  covenant: {
    label: 'Covenant',
    icon: Sparkles,
    blurb: 'The grain brightens — daily promises become texture in the ring.',
    activeClass: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  },
  gold: {
    label: 'Gold',
    icon: Target,
    blurb: 'The branches brighten — long-term goals become visible.',
    activeClass: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  },
  memories: {
    label: 'Memories',
    icon: Images,
    blurb: 'The amber pockets brighten — kept moments become visible.',
    activeClass: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  },
}

const LensIcon = LENS_META[lens].icon
```

---

## C. Add always-visible derived data

Add this immediately after the lens metadata.

```tsx
const drafts = useMemo(() => {
  return (phases ?? [])
    .filter((p) => p.status === 'draft')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}, [phases])

const todayISO = new Date().toISOString().slice(0, 10)

const covenantCount = covenant.commitments?.length ?? 0
const covenantCompletionsToday =
  covenant.completions?.filter((c) => c.date === todayISO).length ?? 0

const goldCount = goals.length + ltgs.length
const memoryCount = memories.length
```

---

## D. Add inline save handlers

These allow Gold and Memory creation without leaving River mode.

```tsx
const [goldVersion, setGoldVersion] = useState(0)

useEffect(() => {
  let mounted = true

  async function loadGold() {
    const api = (window as any).deskflowAPI

    const [dailyGoals, longTermGoals] = await Promise.all([
      api.goals?.list?.() ?? Promise.resolve([]),
      api.longtermGoals?.list?.() ?? Promise.resolve([]),
    ])

    if (!mounted) return

    setGoals(dailyGoals ?? [])
    setLtgs(longTermGoals ?? [])
  }

  loadGold()

  return () => {
    mounted = false
  }
}, [goldVersion])

const openAddForLens = (nextLens: LensId) => {
  setLens(nextLens)

  if (nextLens === 'phases') {
    setAdding(true)
    return
  }

  if (nextLens === 'covenant') {
    setInlineModal('covenant')
    setInlineModalPhaseId(activePhaseId ?? undefined)
    return
  }

  if (nextLens === 'gold') {
    setInlineModal('gold')
    setInlineModalPhaseId(activePhaseId ?? undefined)
    return
  }

  setInlineModal('memory')
  setInlineModalPhaseId(activePhaseId ?? undefined)
}

const saveGold = async (draft: GoldDraft) => {
  const api = (window as any).deskflowAPI

  if (draft.kind === 'longterm') {
    if (api.longtermGoals?.save) {
      await api.longtermGoals.save(draft)
    } else if (api.longtermGoals?.create) {
      await api.longtermGoals.create(draft)
    } else if (api.gold?.saveLongTermGoal) {
      await api.gold.saveLongTermGoal(draft)
    } else {
      throw new Error('No existing long-term goal IPC handler found')
    }
  } else {
    if (api.goals?.save) {
      await api.goals.save(draft)
    } else if (api.goals?.create) {
      await api.goals.create(draft)
    } else if (api.gold?.saveGoal) {
      await api.gold.saveGoal(draft)
    } else {
      throw new Error('No existing daily goal IPC handler found')
    }
  }

  setGoldVersion((v) => v + 1)
}

const saveMemory = async (draft: MemoryDraft) => {
  const api = (window as any).deskflowAPI

  const electronPath = (draft.file as any)?.path ?? null

  const payload = {
    ...draft,
    filePath: electronPath,
  }

  if (api.memories?.addWithFile) {
    await api.memories.addWithFile(payload)
  } else if (api.memories?.save) {
    await api.memories.save(payload)
  } else if (api.memories?.add) {
    await api.memories.add(payload)
  } else {
    throw new Error('No existing memory IPC handler found')
  }

  // If the memories hook exposes refresh later, this will pick it up automatically.
  if (typeof (memories as any)?.refresh === 'function') {
    await (memories as any).refresh()
  }
}
```

---

## E. Make ring clicks open the edit dialog

Replace the existing `CoreSample` usage in River mode with this version.

The important change is:

```tsx
onPhaseClick={(phaseId) => {
  const phase = (phases ?? []).find((p) => p.id === phaseId)
  setActivePhaseId(phaseId)
  if (phase) setEditingPhase(phase)
}}
```

Full replacement:

```tsx
<CoreSample
  phases={phases}
  covenant={covenant}
  memoriesByPhase={memoriesByPhase}
  ltgsByPhase={ltgsByPhase}
  selectedPhaseId={activePhaseId}
  onPhaseClick={(phaseId) => {
    const phase = (phases ?? []).find((p) => p.id === phaseId)
    setActivePhaseId(phaseId)
    if (phase) setEditingPhase(phase)
  }}
  onOpenMemories={(phaseId) => {
    setActivePhaseId(phaseId)
    setLens('memories')
  }}
  lens={lens}
  onLensChange={setLens}
/>
```

If your existing `CoreSample` requires additional props, keep them. The mandatory change is that `onPhaseClick` sets `editingPhase`.

---

## F. Insert the always-visible River control deck

Insert this immediately below the `CoreSample` / `TimelineView` / `RiverMap` header area and above the `PhaseCard` list.

This block must render unconditionally in River mode.

```tsx
<section
  data-river-controls="always-visible"
  className="mt-6 space-y-4"
>
  {/* Lens indicator — always visible */}
  <div
    data-lens-indicator
    className={`flex flex-col gap-3 rounded-xl border bg-zinc-900/30 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between ${LENS_META[lens].activeClass}`}
  >
    <div className="flex items-center gap-3">
      <LensIcon className="h-4 w-4" />
      <div>
        <p className="text-sm font-medium">
          {LENS_META[lens].label} lens active
        </p>
        <p className="text-[12px] text-zinc-400">
          {LENS_META[lens].blurb}
        </p>
      </div>
    </div>

    <div className="flex flex-wrap gap-1">
      {(Object.keys(LENS_META) as LensId[]).map((key) => {
        const Meta = LENS_META[key]
        const Icon = Meta.icon

        return (
          <button
            key={key}
            onClick={() => setLens(key)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors ${
              lens === key
                ? Meta.activeClass
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {Meta.label}
          </button>
        )
      })}
    </div>
  </div>

  {/* Quick-add toolbar — always visible */}
  <div
    data-quick-add
    className="grid grid-cols-2 gap-2 lg:grid-cols-4"
  >
    <button
      onClick={() => openAddForLens('phases')}
      className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
        lens === 'phases'
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
          : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'
      }`}
    >
      <span className="flex items-center gap-2">
        <Layers className="h-4 w-4" />
        New Phase
      </span>

      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300">
        <Mic className="h-3 w-3" />
        voice
      </span>
    </button>

    <button
      onClick={() => openAddForLens('covenant')}
      className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
        lens === 'covenant'
          ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
          : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'
      }`}
    >
      <span className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        New Covenant
      </span>

      <Plus className="h-4 w-4 text-zinc-500" />
    </button>

    <button
      onClick={() => openAddForLens('gold')}
      className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
        lens === 'gold'
          ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
          : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'
      }`}
    >
      <span className="flex items-center gap-2">
        <Target className="h-4 w-4" />
        New Goal
      </span>

      <Plus className="h-4 w-4 text-zinc-500" />
    </button>

    <button
      onClick={() => openAddForLens('memories')}
      className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
        lens === 'memories'
          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
          : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'
      }`}
    >
      <span className="flex items-center gap-2">
        <Images className="h-4 w-4" />
        New Memory
      </span>

      <Plus className="h-4 w-4 text-zinc-500" />
    </button>
  </div>

  {/* Data preview cards — always visible */}
  <div
    data-preview-cards
    className="grid gap-2 md:grid-cols-3"
  >
    <button
      onClick={() => setLens('covenant')}
      className={`rounded-xl border p-5 text-left transition-colors ${
        lens === 'covenant'
          ? 'border-rose-400/40 bg-rose-500/10'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-2 text-rose-300">
        <Sparkles className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">
          Covenant
        </span>
      </div>

      <p className="mt-3 text-2xl text-zinc-100">
        {covenantCount}
      </p>

      <p className="text-[12px] text-zinc-500">
        commitments · {covenantCompletionsToday} kept today
      </p>
    </button>

    <button
      onClick={() => setLens('gold')}
      className={`rounded-xl border p-5 text-left transition-colors ${
        lens === 'gold'
          ? 'border-amber-400/40 bg-amber-500/10'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-2 text-amber-300">
        <Target className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">
          Gold
        </span>
      </div>

      <p className="mt-3 text-2xl text-zinc-100">
        {goldCount}
      </p>

      <p className="text-[12px] text-zinc-500">
        goals and long-term branches
      </p>
    </button>

    <button
      onClick={() => setLens('memories')}
      className={`rounded-xl border p-5 text-left transition-colors ${
        lens === 'memories'
          ? 'border-emerald-400/40 bg-emerald-500/10'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center gap-2 text-emerald-300">
        <Images className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider">
          Memories
        </span>
      </div>

      <p className="mt-3 text-2xl text-zinc-100">
        {memoryCount}
      </p>

      <p className="text-[12px] text-zinc-500">
        amber pockets kept
      </p>
    </button>
  </div>

  {/* Draft shelf — always visible */}
  <div
    data-drafts-shelf
    className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 backdrop-blur"
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <FileClock className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-medium text-zinc-100">
          Draft chapters
        </h3>
      </div>

      <span className="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
        {drafts.length}
      </span>
    </div>

    {drafts.length === 0 ? (
      <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-4">
        <p className="text-[13px] text-zinc-500">
          No saved drafts yet. Start a chapter and choose
          “Save as draft” — it will appear here so you can return to it.
        </p>
      </div>
    ) : (
      <div className="mt-4 space-y-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">
                {draft.title || 'Untitled draft'}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {draft.category}
                {draft.updatedAt
                  ? ` · updated ${new Date(draft.updatedAt).toLocaleString()}`
                  : ''}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setEditingPhase(draft)}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 text-[11px] text-amber-200 hover:bg-amber-400/15"
              >
                <Pencil className="h-3 w-3" />
                Resume
              </button>

              <button
                onClick={() =>
                  savePhase({
                    ...draft,
                    status: 'complete',
                    updatedAt: new Date().toISOString(),
                  })
                }
                className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-2.5 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Mark complete
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</section>
```

---

## G. Pass edit handlers into `PhaseCard`

Update the phase card list so every card can edit itself and open inline add overlays.

Wrap each card with an id for scrolling:

```tsx
<div
  key={phase.id}
  id={`phase-card-${phase.id}`}
  className="scroll-mt-28"
>
  <PhaseCard
    phase={phase}
    active={activePhaseId === phase.id}
    allPhases={phases}
    memories={memories}
    longTermGoals={ltgs}
    covenant={covenant}
    onActiveChange={setActivePhaseId}
    onSave={savePhase}
    onReflect={reflect}
    onKeepReflection={(updated, text) => {
      savePhase({
        ...updated,
        reflection: text,
        reflectionSource: updated.reflectionSource ?? 'manual',
        reflectionGeneratedAt: updated.reflectionGeneratedAt ?? new Date().toISOString(),
      })
    }}
    onOpenMemory={setViewing}
    onJump={(phaseId) => {
      setActivePhaseId(phaseId)
      document
        .getElementById(`phase-card-${phaseId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }}
    lens={lens}
    onAddMemory={() => {
      setLens('memories')
      setInlineModal('memory')
      setInlineModalPhaseId(phase.id)
    }}
    onAddGoal={() => {
      setLens('gold')
      setInlineModal('gold')
      setInlineModalPhaseId(phase.id)
    }}
    onAddCovenant={() => {
      setLens('covenant')
      setInlineModal('covenant')
      setInlineModalPhaseId(phase.id)
    }}
    onEditPhase={() => setEditingPhase(phase)}
  />
</div>
```

---

## H. Add Gold and Memory inline modals

Keep the existing Covenant inline modal. Add these two after it.

```tsx
{inlineModal === 'gold' && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    onClick={() => setInlineModal(null)}
  >
    <div
      className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-zinc-900/95 p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
            <Target className="h-4 w-4 text-amber-400" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              New Goal
            </h3>
            <p className="text-[11px] text-zinc-600">
              A branch reaching from this chapter
            </p>
          </div>
        </div>

        <button
          onClick={() => setInlineModal(null)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <InlineGoldForm
        phaseId={inlineModalPhaseId}
        phases={phases}
        onClose={() => setInlineModal(null)}
        onSave={async (draft) => {
          await saveGold(draft)
          setInlineModal(null)
        }}
      />
    </div>
  </div>
)}

{inlineModal === 'memory' && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    onClick={() => setInlineModal(null)}
  >
    <div
      className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-zinc-900/95 p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Images className="h-4 w-4 text-emerald-400" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              New Memory
            </h3>
            <p className="text-[11px] text-zinc-600">
              An amber pocket pressed into the ring
            </p>
          </div>
        </div>

        <button
          onClick={() => setInlineModal(null)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <InlineMemoryForm
        phaseId={inlineModalPhaseId}
        phases={phases}
        onClose={() => setInlineModal(null)}
        onSave={async (draft) => {
          await saveMemory(draft)
          setInlineModal(null)
        }}
      />
    </div>
  </div>
)}
```

---

# 1.2 `src/components/life-river/CoreSample.tsx`

The Core Sample must be visibly larger and must clearly expose the lens switcher.

## A. Increase ring stage height

Replace the existing ring container:

```tsx
<div className="relative h-52 w-52 sm:h-64 sm:w-64">
```

with:

```tsx
<div
  data-core-sample-stage
  className="relative h-72 w-72 sm:h-[420px] sm:w-[420px] lg:h-[460px] lg:w-[460px]"
>
```

Full context:

```tsx
<div className="flex flex-col items-center px-6 pb-6 pt-6">
  <div
    data-core-sample-stage
    className="relative h-72 w-72 sm:h-[420px] sm:w-[420px] lg:h-[460px] lg:w-[460px]"
  >
    <RingCanvas
      phases={phases}
      lens={lens}
      grainByPhase={grainByPhase}
      todayCompletions={todayCompletions}
      memoriesByPhase={memoriesByPhase}
      ltgsByPhase={ltgsByPhase}
      selectedPhaseId={selectedPhaseId}
      onPhaseClick={onPhaseClick}
      onOpenMemory={onOpenMemories}
    />
  </div>
```

---

## B. Add a visible lens description under the switcher

The lens switcher already exists, but ensure it has this `data-lens-switcher` marker and remains visible:

```tsx
<div
  data-lens-switcher
  className="mt-4 flex flex-wrap items-center justify-center gap-1 rounded-lg bg-zinc-800/50 p-0.5"
>
```

Keep the existing lens buttons.

---

# 1.3 `src/components/life-river/RiverCanvas.tsx`

If `RiverCanvas` owns its own outer height, enforce a minimum visual height.

Replace its outer wrapper with:

```tsx
<div
  data-river-canvas
  className="relative h-[420px] min-h-[420px] w-full sm:h-[480px]"
>
  <svg
    className="h-full w-full"
    viewBox="0 0 800 480"
    preserveAspectRatio="xMidYMid meet"
  >
    {/* existing river paths */}
  </svg>
</div>
```

If the component receives a `height` prop from `LifePage`, update the call site instead:

```tsx
<RiverCanvas height={480} />
```

The requirement is that the rendered river canvas is at least `420px` tall on desktop.

---

# 1.4 `src/components/life-river/RiverMap.tsx`

If `RiverMap` is used as the bottom river visualization, enlarge it.

Replace its outer wrapper with:

```tsx
<div
  data-river-map
  className="relative h-[420px] min-h-[420px] w-full sm:h-[480px]"
>
  {/* existing SVG river map */}
</div>
```

If the SVG has a fixed `height` attribute, change it from anything below `420` to:

```tsx
height={480}
```

or use CSS:

```tsx
className="h-[420px] w-full sm:h-[480px]"
```

---

# 1.5 `src/components/life-river/TimelineView.tsx`

The bottom timeline should also become more prominent.

Replace a `h-16` track with `h-24`:

```tsx
<div
  data-timeline-track
  className="relative flex h-24 snap-x snap-proximity gap-1 overflow-x-auto rounded-lg border border-zinc-800/40 bg-zinc-950/40 px-2 py-3"
>
```

If phase blocks currently use very small text, increase them:

```tsx
<span className="truncate font-mono text-xs text-white/90 sm:text-sm">
  {phase.title}
</span>
```

If the Now marker is small, enlarge it:

```tsx
<span className="relative flex h-4 w-4">
  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
  <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-400" />
</span>
```

---

# 1.6 `src/components/life-river/PhaseCard.tsx`

The phase card must show Covenant, Gold, and Memories data even when the default `phases` lens is active.

## A. Extend props

Add these props to `PhaseCardProps`:

```tsx
interface PhaseCardProps {
  phase: LifePhase
  active: boolean
  allPhases?: LifePhase[]
  memories: LoadedMemory[]
  longTermGoals: LongTermGoal[]
  covenant?: {
    commitments: { id: string }[]
    completions: { commitmentId: string; date: string }[]
  }
  onActiveChange: (id: string | null) => void
  onSave: (phase: LifePhase) => void
  onReflect: (
    phase: LifePhase,
    answers: string[],
    variation?: string
  ) => Promise<AiReflectResult | null>
  onKeepReflection: (phase: LifePhase, text: string) => void
  onOpenMemory: (memory: LoadedMemory) => void
  onJump?: (phaseId: string) => void
  lens: LensId
  onAddMemory?: () => void
  onAddGoal?: () => void
  onAddCovenant?: () => void
  onEditPhase?: () => void
}
```

---

## B. Add date-range helper

Add this above the component:

```tsx
function getPhaseRange(phase: LifePhase) {
  const start = new Date(
    Date.UTC(phase.startYear, phase.startMonth - 1, 1)
  )
    .toISOString()
    .slice(0, 10)

  const end = phase.endYear
    ? new Date(
        Date.UTC(
          phase.endYear,
          (phase.endMonth ?? 12) - 1,
          28
        )
      )
          .toISOString()
          .slice(0, 10)
    : null

  return { start, end }
}
```

---

## C. Compute Covenant, Gold, and Memory data inside the card

Inside the component:

```tsx
const { start, end } = useMemo(() => getPhaseRange(phase), [phase])

const phaseMemories = useMemo(() => {
  return memories.filter((m) => {
    const date = m.meta.date
    return date >= start && (!end || date <= end)
  })
}, [memories, start, end])

const phaseLtgs = useMemo(() => {
  return longTermGoals.filter((ltg) => {
    const anyLtg = ltg as any

    if (anyLtg.phaseId && anyLtg.phaseId === phase.id) {
      return true
    }

    if (anyLtg.targetDate) {
      return (
        anyLtg.targetDate >= start &&
        (!end || anyLtg.targetDate <= end)
      )
    }

    return false
  })
}, [longTermGoals, phase.id, start, end])

const covenantCompletions = useMemo(() => {
  if (!covenant?.completions) return []

  return covenant.completions.filter((c) => {
    return c.date >= start && (!end || c.date <= end)
  })
}, [covenant, start, end])
```

---

## D. Add an always-visible edit button

Inside the header band, add this near the top:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation()
    onEditPhase?.()
  }}
  className="absolute right-4 top-4 z-30 inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 text-[11px] text-white/80 backdrop-blur transition-colors hover:bg-black/40"
>
  <Pencil className="h-3.5 w-3.5" />
  Edit
</button>
```

If the magnitude number currently overlaps, move it downward:

```tsx
<span className="absolute right-5 top-16 select-none font-display text-8xl text-white/10">
  {phase.magnitude}
</span>
```

---

## E. Replace conditional Covenant / Memories sections with an always-visible data strip

Remove or replace the old blocks that only render when:

```tsx
{lens === 'covenant' && ...}
{lens === 'memories' && ...}
```

Insert this always-visible strip near the top of the card body:

```tsx
<div className="px-5 pt-5">
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
    {/* Covenant strip */}
    <div
      data-phase-covenant-strip
      className={sectionOpacity('covenant') + ' rounded-lg border border-rose-500/15 bg-rose-500/[0.04] p-3'}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-rose-300/80">
          Covenant
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddCovenant?.()
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-rose-500/20 text-rose-300 hover:bg-rose-500/10"
          aria-label="Add covenant"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-2 text-lg text-zinc-100">
        {covenantCompletions.length}
      </p>

      <p className="text-[11px] text-zinc-500">
        kept in this chapter
      </p>
    </div>

    {/* Gold strip */}
    <div
      data-phase-gold-strip
      className={sectionOpacity('gold') + ' rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-3'}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-amber-300/80">
          Gold
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddGoal?.()
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/20 text-amber-300 hover:bg-amber-500/10"
          aria-label="Add goal"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-2 text-lg text-zinc-100">
        {phaseLtgs.length}
      </p>

      <p className="text-[11px] text-zinc-500">
        branches in this chapter
      </p>
    </div>

    {/* Memories strip */}
    <div
      data-phase-memories-strip
      className={sectionOpacity('memories') + ' rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3'}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">
          Memories
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddMemory?.()
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10"
          aria-label="Add memory"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-2 text-lg text-zinc-100">
        {phaseMemories.length}
      </p>

      <p className="text-[11px] text-zinc-500">
        amber pockets
      </p>
    </div>
  </div>
</div>
```

This ensures Covenant, Gold, and Memories are visible on the default lens, while still responding to lens focus through `sectionOpacity`.

---

# 1.7 `src/components/life-river/phase-form-dialog.tsx`

All meaningful text inputs must be connected to speech-to-text.

## A. Add imports

```tsx
import { Mic } from 'lucide-react'
import { VoiceInputWrapper } from '@/components/voice/VoiceInputWrapper'
```

If your existing wrapper lives elsewhere, use that path. The usage pattern remains the same.

---

## B. Add visible voice badge in the dialog header

Inside the dialog header, add:

```tsx
<div className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300">
  <Mic className="h-3 w-3" />
  Voice input ready
</div>
```

---

## C. Wrap every major textarea

### Title input

If the title is an `Input`, wrap it:

```tsx
<VoiceInputWrapper>
  <Input
    value={draft.title}
    onChange={(e) =>
      dispatch({
        type: 'SET_FIELD',
        field: 'title',
        value: e.target.value,
      })
    }
    placeholder="What do you call this chapter?"
    className="warmth-serif text-2xl"
  />
</VoiceInputWrapper>
```

---

### Story textarea

Replace the Step 2 story textarea with:

```tsx
<VoiceInputWrapper className="mt-3">
  <Textarea
    value={draft.description}
    onChange={(e) =>
      dispatch({
        type: 'SET_FIELD',
        field: 'description',
        value: e.target.value,
      })
    }
    placeholder="What defined this period?"
    className="warmth-serif min-h-40 resize-none text-lg leading-relaxed"
  />
</VoiceInputWrapper>
```

---

### Feelings textarea

```tsx
<VoiceInputWrapper>
  <Textarea
    value={draft.feelingsNote ?? ''}
    onChange={(e) =>
      dispatch({
        type: 'SET_FIELD',
        field: 'feelingsNote',
        value: e.target.value,
      })
    }
    placeholder="How did this chapter actually feel, day to day?"
    className="min-h-28 resize-none"
  />
</VoiceInputWrapper>
```

---

### Lessons textarea

```tsx
<VoiceInputWrapper>
  <Textarea
    value={draft.lessonsLearned ?? ''}
    onChange={(e) =>
      dispatch({
        type: 'SET_FIELD',
        field: 'lessonsLearned',
        value: e.target.value,
      })
    }
    placeholder="What did this chapter teach you?"
    className="min-h-28 resize-none"
  />
</VoiceInputWrapper>
```

---

### Impact textarea

```tsx
<VoiceInputWrapper>
  <Textarea
    value={draft.impactNotes ?? ''}
    onChange={(e) =>
      dispatch({
        type: 'SET_FIELD',
        field: 'impactNotes',
        value: e.target.value,
      })
    }
    placeholder="How are you different now than before this chapter?"
    className="min-h-28 resize-none"
  />
</VoiceInputWrapper>
```

---

### Reflection textarea

```tsx
<VoiceInputWrapper>
  <Textarea
    value={
      state.aiReflectionDraft ??
      draft.reflection ??
      ''
    }
    onChange={(e) =>
      dispatch({
        type: 'SET_FIELD',
        field: 'reflection',
        value: e.target.value,
      })
    }
    placeholder="Write or edit the reflection in your own words."
    className="min-h-32 resize-none"
  />
</VoiceInputWrapper>
```

---

## D. Ensure “Save as draft” is visible

In the dialog footer, ensure this button appears from Step 2 onward:

```tsx
{step > 0 && (
  <Button
    variant="ghost"
    onClick={() => saveNow('draft')}
    className="text-zinc-400 hover:text-zinc-200"
  >
    Save as draft
  </Button>
)}
```

If the stepper is zero-indexed, `step > 0` means the user has moved past Basics. If it is one-indexed, use `step > 1`.

---

# 1.8 New file: `src/components/life-river/inline-add-forms.tsx`

Create this file.

```tsx
"use client"

import * as React from 'react'
import { useState } from 'react'
import { Images, Target } from 'lucide-react'
import type { LifePhase } from '@/lib/riverMath'
import { cn } from '@/lib/utils'

export interface GoldDraft {
  title: string
  kind: 'daily' | 'longterm'
  targetDate?: string | null
  phaseId?: string | null
}

export interface MemoryDraft {
  title: string
  date: string
  note?: string | null
  phaseId?: string | null
  file?: File | null
  filePath?: string | null
}

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600'

const labelClass = 'mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500'

export function InlineGoldForm({
  phaseId,
  phases,
  onClose,
  onSave,
}: {
  phaseId?: string
  phases: LifePhase[]
  onClose: () => void
  onSave: (draft: GoldDraft) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'daily' | 'longterm'>('longterm')
  const [targetDate, setTargetDate] = useState('')
  const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) {
      setError('Give this goal a name.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        title: title.trim(),
        kind,
        targetDate: targetDate || null,
        phaseId: selectedPhaseId || null,
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Goal</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this branch reaching toward?"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Type</label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind('longterm')}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              kind === 'longterm'
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
            )}
          >
            Long-term branch
          </button>

          <button
            type="button"
            onClick={() => setKind('daily')}
            className={cn(
              'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
              kind === 'daily'
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
            )}
          >
            Daily goal
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Target date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Connect to phase</label>
          <select
            value={selectedPhaseId}
            onChange={(e) => setSelectedPhaseId(e.target.value)}
            className={inputClass}
          >
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-rose-400">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>

        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 text-sm text-amber-100 disabled:opacity-60"
        >
          <Target className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save goal'}
        </button>
      </div>
    </div>
  )
}

export function InlineMemoryForm({
  phaseId,
  phases,
  onClose,
  onSave,
}: {
  phaseId?: string
  phases: LifePhase[]
  onClose: () => void
  onSave: (draft: MemoryDraft) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [note, setNote] = useState('')
  const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFileChange = (nextFile: File | null) => {
    setFile(nextFile)

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    if (nextFile) {
      setPreview(URL.createObjectURL(nextFile))
    } else {
      setPreview(null)
    }
  }

  const submit = async () => {
    if (!title.trim()) {
      setError('Give this memory a name.')
      return
    }

    if (!date) {
      setError('Choose a date.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        title: title.trim(),
        date,
        note: note.trim() || null,
        phaseId: selectedPhaseId || null,
        file,
      })

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save memory.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Memory</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What did you keep?"
          className={inputClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Connect to phase</label>
          <select
            value={selectedPhaseId}
            onChange={(e) => setSelectedPhaseId(e.target.value)}
            className={inputClass}
          >
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — why this moment matters."
          className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600"
        />
      </div>

      <div>
        <label className={labelClass}>Image</label>

        <div className="flex items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-zinc-500">
            Choose image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <span className="truncate text-[12px] text-zinc-500">
              {file.name}
            </span>
          )}
        </div>

        {preview && (
          <div className="mt-3 overflow-hidden rounded-lg border border-emerald-500/20">
            <img
              src={preview}
              alt="Memory preview"
              className="h-32 w-full object-cover"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-rose-400">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-lg border border-zinc-800 px-3 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>

        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 text-sm text-emerald-100 disabled:opacity-60"
        >
          <Images className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save memory'}
        </button>
      </div>
    </div>
  )
}
```

---

# 1.9 Voice input fallback: `src/components/voice/VoiceInputWrapper.tsx`

If the project already has a working `VoiceInputWrapper`, keep it and only ensure all Life River fields use it.

If it does not exist, create this file:

```tsx
"use client"

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VoiceInputWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) return

    setSupported(true)

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = navigator.language

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      if (!transcript) return

      const el =
        rootRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          'textarea, input'
        )

      if (!el) return

      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype

      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set

      const current = el.value
      const next = current
        ? `${current.replace(/\s+$/, '')} ${transcript}`
        : transcript

      setter?.call(el, next)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }

    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition

    return () => {
      recognition.abort?.()
    }
  }, [])

  if (!supported) {
    return <div className={className}>{children}</div>
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {children}

      <button
        type="button"
        onClick={() => {
          if (listening) {
            recognitionRef.current?.stop()
            setListening(false)
          } else {
            recognitionRef.current?.start()
            setListening(true)
          }
        }}
        className={cn(
          'absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
          listening
            ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
            : 'border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:text-zinc-100'
        )}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
      >
        {listening ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
```

---

# 1.10 Project note: `docs/notes/life-river-rules.md`

Create this note so the rule persists beyond this change.

```md
# Life River Rules

## Voice Input

Every text input or textarea in `/life` that asks the user for meaning must use `VoiceInputWrapper`.

This includes:

- Phase title
- Phase story
- Feelings note
- Lessons learned
- Impact notes
- Reflection editor
- Memory notes
- Any future Covenant or Gold note field

Speech-to-text is not optional decoration. It is a core input method for the Life River.

## Drafts

Draft phases must always be visible in River mode.

If no drafts exist, show an empty state. Never hide the drafts section.

## Covenant / Gold / Memories

Covenant, Gold, and Memories must be visible in River mode without requiring the user to leave River mode.

Each phase card must show compact Covenant, Gold, and Memories data even when the default Phases lens is active.

Adding Covenant, Gold, or Memories must open an inline overlay, not navigate away from River mode.

## Editing

Every phase ring and every phase card must expose edit access.

Clicking a ring should open the phase edit dialog.

Every phase card must show an edit button.
```

---

## 2. How each missing feature becomes visible without user action

| Problem | Before | After |
|---|---|---|
| Speech-to-text invisible | Only visible if dialog opened and wrapper happened to render | Add Phase button shows a visible `voice` badge; dialog header shows “Voice input ready”; every major textarea gets a mic button |
| Drafts inaccessible | Drafts existed only after saving | Draft shelf is always rendered; empty state appears even with zero drafts |
| Covenant/Gold/Memories invisible | Lens only changed ring rendering | Data preview cards show real counts immediately; PhaseCards show Covenant/Gold/Memories strips even on default Phases lens |
| No add buttons in River mode | User had to leave River mode | Quick-add toolbar is always visible with Phase / Covenant / Goal / Memory buttons |
| No edit from visualization | Ring click did not open edit | `CoreSample.onPhaseClick` now sets `editingPhase`, opening `PhaseFormDialog` |
| River too small | Small ring/river canvas | Core Sample becomes `420px+` on desktop; river canvas and timeline are enlarged |

---

## 3. How real data appears in each lens mode

### Default: Phases lens

The page shows:

- Full Core Sample.
- Lens indicator saying “Phases lens active”.
- Quick-add toolbar with Phase highlighted.
- Data preview cards for Covenant, Gold, Memories.
- Draft shelf.
- Phase cards with all three data strips visible at full opacity.

### Covenant lens

When the user clicks Covenant:

- Lens indicator becomes rose-tinted.
- Quick-add Covenant button highlights.
- Covenant preview card highlights.
- PhaseCard Covenant strips become full opacity.
- Gold and Memories strips dim using `sectionOpacity`.
- “New Covenant” opens the inline Covenant modal.

### Gold lens

When the user clicks Gold:

- Lens indicator becomes amber-tinted.
- Quick-add Goal button highlights.
- Gold preview card highlights.
- PhaseCard Gold strips become full opacity.
- Long-term goal counts appear per phase.
- “New Goal” opens the inline Goal modal.

### Memories lens

When the user clicks Memories:

- Lens indicator becomes emerald-tinted.
- Quick-add Memory button highlights.
- Memories preview card highlights.
- PhaseCard memory strips become full opacity.
- Existing memory thumbnails remain clickable.
- “New Memory” opens the inline Memory modal.

---

## 4. Inline add behavior

No add action may navigate away from River mode.

### Phase

`New Phase` opens the existing `PhaseFormDialog`.

This is allowed because it is an overlay, not a route change.

### Covenant

`New Covenant` opens the existing inline Covenant overlay.

It must remain a fixed modal:

```tsx
fixed inset-0 z-50
```

### Gold

`New Goal` opens the new `InlineGoldForm` overlay.

It writes through existing goal IPC handlers and stays inside River mode.

### Memory

`New Memory` opens the new `InlineMemoryForm` overlay.

It supports:

- title
- date
- optional note
- optional phase connection
- image file
- image preview

It writes through existing memory IPC handlers and stays inside River mode.

---

## 5. Runtime verification steps

Run the app and verify the following without clearing data manually.

### 5.1 Initial load

1. Open `/life`.
2. Ensure River mode is active.
3. Open DevTools console.
4. Confirm:

```text
[LifePage] v2.0 loaded
```

5. Without clicking anything, confirm that all of these are visible:

```text
Lens indicator bar
Quick-add toolbar
Covenant preview card
Gold preview card
Memories preview card
Draft shelf
Voice badge on New Phase button
Large Core Sample / River visualization
```

---

### 5.2 DOM verification

In DevTools, confirm these elements exist:

```js
document.querySelector('[data-river-controls="always-visible"]')
document.querySelector('[data-lens-indicator]')
document.querySelector('[data-quick-add]')
document.querySelector('[data-preview-cards]')
document.querySelector('[data-drafts-shelf]')
document.querySelector('[data-core-sample-stage]')
```

All should return non-null.

---

### 5.3 Height verification

Run:

```js
document
  .querySelector('[data-core-sample-stage]')
  ?.getBoundingClientRect()
```

On desktop, height should be at least `420`.

If checking the river canvas:

```js
document
  .querySelector('[data-river-canvas], [data-river-map]')
  ?.getBoundingClientRect()
```

Height should be at least `420`.

---

### 5.4 Lens behavior

1. Click Covenant lens.
   - Lens indicator becomes rose.
   - Covenant preview card highlights.
   - Covenant quick-add button highlights.

2. Click Gold lens.
   - Lens indicator becomes amber.
   - Gold preview card highlights.
   - Gold quick-add button highlights.

3. Click Memories lens.
   - Lens indicator becomes emerald.
   - Memories preview card highlights.
   - Memory quick-add button highlights.

---

### 5.5 Ring editing

1. Click any ring in the Core Sample.
2. The `PhaseFormDialog` should open in edit mode.
3. The phase title should already be populated.
4. Saving should update the phase without leaving River mode.

---

### 5.6 Draft behavior

1. Open `New Phase`.
2. Enter a title.
3. Move past Step 1.
4. Click `Save as draft`.
5. Close the dialog.
6. The draft should appear under `Draft chapters`.
7. Click `Resume`.
8. The draft should reopen in the phase dialog.

If no drafts exist, the shelf must show:

```text
No saved drafts yet. Start a chapter and choose “Save as draft” — it will appear here so you can return to it.
```

---

### 5.7 Voice input

1. Click `New Phase`.
2. Confirm the dialog header shows:

```text
Voice input ready
```

3. Confirm textareas show mic buttons.
4. Click the mic button.
5. Speak.
6. The transcript should append into the focused textarea/input.

---

### 5.8 Inline add overlays

For each of these:

- Covenant
- Goal
- Memory

Confirm:

1. Clicking the quick-add button opens an overlay.
2. The URL/page mode does not change.
3. River mode remains visible beneath the overlay.
4. Closing the overlay returns to River mode.
5. Saving updates the corresponding preview count or phase strip.

---

## 6. Acceptance criteria

This overhaul is complete when:

- [ ] Lens indicator is visible on first load.
- [ ] Quick-add toolbar is visible on first load.
- [ ] Covenant/Gold/Memories preview cards are visible on first load.
- [ ] Draft shelf is visible on first load.
- [ ] New Phase button visibly mentions voice input.
- [ ] Phase dialog textareas are wrapped in speech-to-text input.
- [ ] Drafts can be resumed from River mode.
- [ ] Clicking a ring opens the phase edit dialog.
- [ ] Phase cards expose an edit button.
- [ ] Covenant, Gold, and Memories can be added via inline overlays.
- [ ] No add flow navigates away from River mode.
- [ ] Core Sample / River visualization is visibly taller.
- [ ] Covenant, Gold, and Memories data appears in Phase cards on the default lens.
- [ ] Lens switching changes emphasis across the page, not only the ring.
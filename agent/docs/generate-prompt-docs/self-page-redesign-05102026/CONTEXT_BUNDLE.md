# CONTEXT_BUNDLE — Self Page Redesign

> Source of truth for the receiving agent. Everything here is quoted from the
> repository. Snapshot: 2026-10-05.

---

## 1. What the Self page is

`Life` → **Self** tab. It is meant to be the user's own model of themselves:
identity, plus the "Context Brain" — a knowledge graph of entities and facts
that grows as they use the app.

Mounted at `src/features/warmth/LifePage.tsx`, which renders
`<SelfOrchestrator />` inside a full-width wrapper (`className="w-full"`).

The whole page is one file: `src/features/warmth/self/SelfOrchestrator.tsx`,
**569 lines**.

## 2. Current layout, verbatim

Master container, `SelfOrchestrator.tsx:318`:

```tsx
<div className="relative z-10 p-5 grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-5 items-start">
```

That produces exactly two columns on wide screens:

```
┌──────────────┬────────────────────────────────────────┐
│ LEFT RAIL    │ RIGHT MAIN                             │
│ 340px        │ 1fr                                    │
│              │  ┌──────────────────────────────────┐  │
│  Identity    │  │ Row 2: Knowledge Graph           │  │
│  (ProfileTab)│  │  BrainVisualization + ActivityFeed│  │
│              │  └──────────────────────────────────┘  │
│  Brain stats │  ┌──────────────────────────────────┐  │
│  (StatPill)  │  │ Row 3: Memory & Brain Management  │  │
│              │  └──────────────────────────────────┘  │
└──────────────┴────────────────────────────────────────┘
```

Section map, from the in-file comments:

| Line | Comment | Contents |
|---|---|---|
| 305 | `Full-height ambient canvas (NeuralFlow = RHEO's "Current")` | `<NeuralFlow>` background layer |
| 320 | `LEFT RAIL: Identity over Brain stats` | `<ProfileTab />` then a card of `<StatPill>` |
| 371 | `RIGHT MAIN: Knowledge Graph over Brain Management` | opens the main column |
| 380 | `Row 2: Knowledge Graph (dominant, centerpiece)` | `<BrainVisualization>` + `<ActivityFeed>` |
| 474 | `Row 3: Brain Management (single column, cleaner)` | a **collapsible** "Memory & Brain Management" card |

Notable: there is **no** `data-section` or `data-lifephase` attribute anywhere in
this file. Deep links and the page-manifest registry have nothing to anchor to.

## 3. The known problems (all reported by the user, all still true)

1. **"Everything is stacked on top of one another."** Repeated across multiple
   sessions.
2. **"Still a mess."** After a two-column restructure.
3. **Cards feel like they float rather than belong together** — no visual
   hierarchy between the graph (centrepiece) and everything else.

A previous agent already tried and reported the cause of one earlier round:
the page was wrapped in `max-w-5xl` (1024px) while its own wide layouts were
gated on `xl:` (1280px), so **the wide layout could never trigger**. The cap was
removed. The stacking complaint survived that fix, which means the cap was a
real bug but **not** the current one.

## 4. Hard constraints — the build is fragile here

- **`prefers-reduced-motion`** is read once, `SelfOrchestrator.tsx:20`:
  ```ts
  function getReducedMotion(): boolean {
    const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined
    return !!(mq?.matches ?? false)
  }
  ```
  It is passed down as `reducedMotion`. Ambient animation is skipped when true.
- **WebGL is unavailable on this machine.** `src/lib/webgl.ts` exports
  `webglSupported()` and three live R3F surfaces are guarded by it
  (`LivingSubstrate`, `OrbitSystem`, `CodeArchitectureMap`). The Self page's
  ambient layer is **Canvas2D**, not R3F, so it is unaffected — but if your
  redesign introduces any `<Canvas>` from `@react-three/fiber`, you **must**
  guard it with `webglSupported()` or it will throw
  `Error creating WebGL context` inside a commit-phase effect and unmount the
  subtree.
- **CSP is `img-src 'self' data: blob: https:`** in `src/main.ts`. `blob:` is
  load-bearing for any object-URL image.
- **`CARD_CLASS` uses `backdrop-blur-xl`** (`SelfOrchestrator.tsx:17`), which
  LAMINAR bans on chrome. Whatever replaces it should not inherit that.

## 5. The graph layer — what it depends on

`BrainVisualization` (`src/features/warmth/context-brain/BrainVisualization.tsx`)
is an orchestrator that owns the shared noise field and activity state and
composes two layers. Its props:

```ts
interface BrainVisualizationProps {
  nodes: GraphNode[]
  links: GraphLink[]
  activity?: { nodeId: string; magnitude: number; timestamp: number }[]
  width: number
  height: number
  state: 'empty' | 'loading' | 'error' | 'populated'
  livelinessLevel?: 'L1' | 'L2' | 'L3'
  reducedMotion?: boolean
  onNodeHover?: (n: GraphNode | null) => void
  onNodeClick?: (n: GraphNode | null) => void
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
  hideChrome?: boolean
}
```

`SelfOrchestrator.tsx:444` currently passes `nodes`, `links`, `width`, `height`,
`state`, `onNodeHover`, `onNodeClick`, `hoveredNode`, `selectedNode`,
`selectionSet`, `hideChrome`, `reducedMotion`.

The graph is Canvas2D, sized by `width`/`height` props — so **the container
must give it real pixel dimensions**. It is currently
`h-[clamp(420px,52vh,620px)]` inside a `flex gap-4` with the ActivityFeed at
`w-72 shrink-0`.

**Do not remove `BrainVisualization`, `NeuralFlow`, or `ActivityFeed`.** They
are wired to real data and to the physics in `context-brain/physics/`.

## 6. Data sources the page already calls

- `<ProfileTab />` — the identity card (imported from elsewhere)
- `StatPill` × N — brain stats from `brain:stats`
- `BrainVisualization` ← `brain:get-entities` + `brain:get-facts`
- `ActivityFeed` ← avalanche readout, fed by the state-diff poll

## 7. Sibling pages — do not duplicate their content

The Life page has seven tabs. Self owns **identity + the brain graph**. It must
not re-implement anything the others already own:

| Tab | Owns |
|---|---|
| Covenant | commitments / promises |
| Memories | photos, people, dates |
| Gold | goals, outcomes, reflection, phases |
| Notes | written knowledge, note links, tasks |
| Schedule | calendar, schedule blocks, deadlines, reminders |
| Habits | habit tracking, WeekReview |
| **Self** | **identity + Context Brain** |

## 8. LAMINAR constraints that bind this surface

- One signal hue per surface, read from `var(--page-accent)`.
- Radii ∈ {8, 12, pill}. No `rounded-2xl` / `rounded-3xl`.
- Max 2 font families per view (Inter, JetBrains Mono, Space Grotesk).
- **No `backdrop-blur` glassmorphism on chrome.**
- No spring/bounce motion.
- No raw hex / `rgba()` inside a `.tsx` — tokens or `var()` only.
- `lucide-react` icons only, never emoji.
- Decorative infinite loops are **banned** in App UI. (The existing
  `NeuralFlow` layer is a functional ambient loop already gated on
  `reducedMotion`; keep gating it.)
- Charts / data-viz must come from `@bklit` via the shadcn MCP, never
  hand-rolled Recharts.

## 9. Suggested files to read before designing

```
src/features/warmth/self/SelfOrchestrator.tsx      the whole page, 569 lines
src/features/warmth/LifePage.tsx                   the tab shell + river/page modes
src/features/warmth/context-brain/BrainVisualization.tsx   the graph orchestrator
src/features/warmth/context-brain/NeuralFlow.tsx   the ambient layer
src/features/warmth/context-brain/ActivityFeed.tsx the avalanche readout
src/lib/webgl.ts                                   capability probe (use it)
design/design.md                                   LAMINAR constitution
```

## 10. Explicit non-goals

- Do not redesign the graph renderer itself. `BrainVisualization` has its own
  approved spec; it is not this task.
- Do not add a new runtime dependency (the project is on `motion` v12).
- Do not change the route or the tab id — `data-section` values are validated
  by the page-manifest registry.
- Do not remove `reducedMotion` threading. It is load-bearing.
# CONTEXT_BUNDLE — Life page: Habits / Gold / Training deduplication

> Self-contained codebase reference. The receiving AI has NO access to this repo.
> Every code excerpt below is verbatim with real file paths and line numbers.

---

## 1. What exists today

`/life` (`src/features/warmth/LifePage.tsx`) is a single route with a **Pages** mode
(8 tabs) and a **River** mode (scroll feed). The 8 tabs:

```tsx
// src/features/warmth/LifePage.tsx:54
type PageTab = 'covenant' | 'memories' | 'gold' | 'notes' | 'schedule' | 'habits' | 'training' | 'self';

// src/features/warmth/LifePage.tsx:56
const PAGE_TABS: { key: PageTab; label: string; icon: typeof HeartHandshake; accent: string }[] = [
  { key: 'covenant', label: 'Covenant', icon: HeartHandshake, accent: 'var(--color-clay-400)' },
  { key: 'memories', label: 'Memories', icon: Images, accent: 'var(--color-mem-400)' },
  { key: 'gold',     label: 'Gold',     icon: Layers,  accent: 'var(--color-amber-400)' },
  { key: 'notes',    label: 'Notes',    icon: BookOpen,accent: 'var(--color-violet-400)' },
  { key: 'schedule', label: 'Schedule', icon: Calendar,accent: 'var(--color-pink-400)' },
  { key: 'habits',   label: 'Habits',   icon: Target,  accent: 'var(--color-emerald-400)' },
  { key: 'training', label: 'Training', icon: Activity,accent: 'var(--page-accent)' },
  { key: 'self',     label: 'Self',     icon: User,    accent: 'var(--color-violet-400)' },
]
```

Tab content renders one component each (LifePage.tsx:590-640):

```tsx
{pageTab === 'gold'     && (<motion.div key="gold"     {...crossfade} data-section="life.gold"><GoldPage /></motion.div>)}
{pageTab === 'habits'   && (<motion.div key="habits"   {...crossfade} data-section="life.habits"><HabitsPage /></motion.div>)}
{pageTab === 'training' && (<motion.div key="training" {...crossfade} data-section="life.training"><TrainingPage /></motion.div>)}
```

### Page sizes
| File | Lines |
|---|---|
| `src/features/warmth/gold/GoldPage.tsx` | **1665** |
| `src/features/warmth/training/TrainingPage.tsx` | **1046** |
| `src/features/warmth/habits/HabitsPage.tsx` | **918** |

---

## 2. THE CORE DEFECT — three pages, one record type

There is **one** `Goal` record. Habits are goals with `isHabit: true`. There is no
separate habits table.

### src/types/goals.ts:64 (verbatim)

```ts
export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus;
  date: string;
  source: GoalSource;
  links: GoalLink[];
  progressSeconds?: number;
  completedAt?: string;
  createdAt: string;

  // Existing extended fields
  parentId?: string;
  parentIds?: string[];
  streak?: number;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: {
    enabled: boolean;
    mode: 'positive' | 'avoidance';
```

### The species predicate exists TWICE and THEY DISAGREE

This is the single most important finding. `GoldPage` was already fixed once
(the comment below is the fix); `HabitsPage` was left with the **old, broken**
version.

**`src/features/warmth/gold/GoldPage.tsx:170-182` (verbatim — the CORRECT one):**

```ts
/* Habits are also not routines — they are streaks, and they live in the habit
 * tracker — but `isHabit` is kept here because a habit created with a weekly
 * cadence is genuinely a recurring target and users expect to see it in the
 * weekly recap. */
const isWeeklyish = (g: Goal) =>
  !!g.isHabit ||
  g.cadence === 'weekly' ||
  g.period === 'weekly';
```

**`src/features/warmth/habits/HabitsPage.tsx:147-152` (verbatim — the STALE one):**

```ts
const isWeeklyish = (g: Goal) =>
  !!g.isHabit ||
  g.cadence === 'weekly' ||
  g.period === 'weekly' ||
  g.period === 'longterm';      // <-- puts every long-term goal in the ROUTINES list
```

**Consequence, already documented in GoldPage's own history:** a goal with
`period === 'longterm'` lands in Gold's *Routines* list **and** in Gold's *The
Vault* — the same goal, two lists, one page. That is the literal "the routine and
the goal are the same thing" user report. HabitsPage still ships that predicate,
so the same double-count happens in the Habits tab too.

**Design rule this establishes: a recurring ROUTINE is not a long-term DESTINATION.**
They are different objects with different periods and belong in different lists.
Any consolidation MUST carry this rule, not just the field list.

---

## 3. Fourteen functions are copy-pasted across these pages

Every one is locally `function`-defined in ≥2 files. None is imported from a
shared module. Line numbers of each definition:

| Function | HabitsPage | GoldPage | TrainingPage |
|---|---|---|---|
| `addDaysStr` | 39 | 40 | — |
| `mondayOf` | 44 | 45 | 196 |
| `daysUntil` | 48 | 49 | — |
| `formatTime` | 55 | 56 | — |
| `prettyDate` | 60 | 61 | — |
| `useCalendarSide` | 69 | 80 | — |
| `covenantStreak` | 106 | 119 | — |
| `covenantDoneDates` | 119 | 132 | — |
| `buildPrompts` | 125 | 139 | — |
| `goalToCriteria` | 178 | 205 | — |
| `criteriaToGoal` | 206 | 233 | — |
| `StatPill` | 240 | 271 | — |
| `DayRing` | 258 | 291 | — |
| `WeekReview` | 269 | 780 | — |

`StatPill` / `DayRing` / `WeekReview` are *UI* components duplicated verbatim as
local functions — measured as 19-line blocks that **differ only in surrounding
context**, i.e. they drifted apart after being copied. `mondayOf` is triplicated.

### The duplicated reflection shape

Both pages declare this shape independently (HabitsPage:96, GoldPage:108):

```ts
  habits: { total: number; completed: number };
```

and the same prompt builder (HabitsPage:139-146, GoldPage:153-160):

```ts
if (data.habits.completed > 0 && data.habits.total > 0) {
  prompts.push(`Habits: ${data.habits.completed}/${data.habits.total} — which kept you honest?`);
}
if (streak > 0) prompts.push(`Covenant day ${streak} — what's the habit that holds the streak together?`);
```

---

## 4. GoldPage is 7 surfaces stacked in one tab

Composition, with line numbers of each child:

| # | Surface | Line | Unique to Gold? |
|---|---|---|---|
| 1 | Goal list (renders **habits** too, via `goal.isHabit`) | ~1360-1420 | no — HabitsPage does this |
| 2 | Suggested-goals review queue (accept/dismiss) | 1420-1470 | yes |
| 3 | **Phases list** + its own `PhaseFormDialog` | 868-1620 | **duplicates River mode** |
| 4 | `TheVault` (long-term goals + today's goals) | 1639 | yes |
| 5 | `ReflectionCard` | 1647 | yes |
| 6 | `WeekReview` (Mon→Sun recap) | 1653 | duplicates HabitsPage |
| 7 | `ConnectionExplorer` (goal hub) | 1657 | shared component |

Locally-defined components in GoldPage: `DayRing`, `GoldHeader`, `ReflectionCard`,
`StatPill`, `TheVault`, `WeekBoard`, `WeekReview`.
HabitsPage has only `DayRing`, `StatPill`, `WeekReview` — i.e. **every one of
HabitsPage's local components is already duplicated in GoldPage.**

TrainingPage locals: `AiBridge`, `GhostButton`, `Ledger`, `Panel`, `PhaseCard`,
`PrimaryButton`, `QuickCapture`, `ReviewQueue`, `TrainingRules`, `WeeklyReview`,
`WeekStrip` — it has its OWN `PhaseCard` and `WeeklyReview`.

**`PhaseCard` is defined in at least 2 places:** `LifePage.tsx` (River mode, imported)
and `TrainingPage.tsx` (locally defined).

### The phases duplication

Phases render in **two** surfaces with **two** independent create paths:

- **River mode** (`LifePage.tsx`): `RiverMap` + `TimelineView` + `CoreSample` ring +
  a `PhaseCard` per phase + **two** `PhaseFormDialog` instances (~lines 480-560, 690-740)
- **Gold tab** (`GoldPage.tsx:868-1620`): a compact list + its own `PhaseFormDialog`

Both write through the same IPC (`lifePhaseSave`), so there is no data fork — the
problem is purely that the same object has two homes and two create buttons.

### A correction to a previous claim

`GoalsPage` (`src/pages/GoalsPage.tsx`, route `/goals`) is **NOT** imported or
rendered inside `GoldPage`. Grep for `GoalsPage` in GoldPage returns nothing. An
earlier summary asserted it was nested there; that was wrong. Do not design around it.

---

## 5. Backend audit — all real, nothing is a stub

Every channel used by these pages exists in `src/preload.ts` and is handled in `src/main.ts`.

```ts
// src/preload.ts:1527-1532
getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
getGoalsBatch: (startDate: string, endDate: string) => ipcRenderer.invoke('get-goals-batch', startDate, endDate),
getLongtermGoals: () => ipcRenderer.invoke('get-longterm-goals'),
saveGoal: (date: string, goal: any) => ipcRenderer.invoke('save-goal', date, goal),
saveGoalReview: (date: string, reviewSummary: string) => ipcRenderer.invoke('save-goal-review', date, reviewSummary),

// src/preload.ts:1613
saveGoalsBatch: (goals: any[]) => ipcRenderer.invoke('save-goals-batch', goals),

// src/preload.ts:1616-1620 — phases
lifePhaseGet: () => ipcRenderer.invoke('lifePhase:get'),
lifePhaseGetSummary: () => ipcRenderer.invoke('lifePhase:getSummary'),
lifePhaseSave: (phase: any) => ipcRenderer.invoke('lifePhase:save', phase),
lifePhaseDelete: (phaseId: string) => ipcRenderer.invoke('lifePhase:delete', phaseId),
lifePhaseSaveAll: (phases: any[]) => ipcRenderer.invoke('lifePhase:saveAll', phases),
```

| Capability | IPC | Handler | Real? |
|---|---|---|---|
| Daily goals | `get-goals` / `save-goal` | ✅ | ✅ real |
| Week batch | `get-goals-batch` | ✅ | ✅ real |
| Long-term goals | `get-longterm-goals` / `save-goals-batch` | ✅ | ✅ real |
| Goal review | `save-goal-review` | ✅ | ✅ real |
| Phases | `lifePhase:*` | ✅ | ✅ real |
| Layout persistence | `compositionsSettingsGet/Set` | ✅ | ✅ real |

`loadCompletions` is imported by both HabitsPage and GoldPage and is a real
localStorage/completions reader.

**No backend work is required for this consolidation.** It is a presentation +
module-extraction task. Do not invent new IPC.

---

## 6. Shared components already extracted (reuse; do NOT re-create)

These live in `src/components/goals/` and are imported by BOTH HabitsPage and GoldPage:

```
HabitTracker.tsx (186 lines)   HierarchyTree.tsx     ConnectionExplorer.tsx
WeeklyGoalsView.tsx            GoalCard.tsx          CriteriaBuilder.tsx
MissedGoalRecoveryBanner.tsx   GoalCompletionEngine.ts (getMissedGoals)
GoalAICoach.tsx                GoalLanguageParser.tsx
```

Also imported by both: `useFocusGoals` (`src/hooks/useFocusGoals`), `WarmCard`
(`src/features/warmth/WarmCard.tsx:43`), and the `GoalCard` / `GoalEmptyState` /
`GoalErrorState` / `GoalCardSkeleton` family.

**These are the precedent.** The extraction pattern the codebase already uses is
"shared component under `src/components/goals/`, imported by every consumer." The
14 duplicated local helpers should follow exactly that pattern.

---

## 7. Design tokens

### Semantic entity colors — `src/lib/CategoryColors.ts:17+`

One color source of truth, already centralised, with a light variant per entity:

```ts
export const ENTITY_COLORS = {
  goal:     { text: 'text-amber-300',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   bar: 'bg-amber-400',
              light: { text: 'text-amber-700',   border: 'border-amber-500/40', bg: 'bg-amber-50',   bar: 'bg-amber-500' } },
  ltg:      { text: 'text-yellow-300',  border: 'border-yellow-500/30',  bg: 'bg-yellow-500/10',  bar: 'bg-yellow-400',
              light: { text: 'text-yellow-700',  border: 'border-yellow-500/40', bg: 'bg-yellow-50',  bar: 'bg-yellow-500' } },
  habit:    { text: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', bar: 'bg-emerald-400',
              light: { text: 'text-emerald-700', border: 'border-emerald-500/40', bg: 'bg-emerald-50', bar: 'bg-emerald-500' } },
  deadline: { text: 'text-rose-300',    border: 'border-rose-500/30',    bg: 'bg-rose-500/10',    bar: 'bg-rose-400',
              light: { text: 'text-rose-700',    border: 'border-rose-500/40', bg: 'bg-rose-50',    bar: 'bg-rose-500' } },
  schedule: { text: 'text-cyan-300',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10',    bar: 'bg-cyan-400',
              light: { text: 'text-cyan-700',    border: 'border-cyan-500/40', bg: 'bg-cyan-50',    bar: 'bg-cyan-500' } },
  note:     { text: 'text-violet-300',  ... },
  todo:     { text: 'text-zinc-300',    ... },
}
```

Note the **entity hue map**, which is the visual grammar already in force:
goal=amber, ltg=yellow, habit=emerald, deadline=rose, schedule=cyan, note=violet, todo=zinc.

### Category dot colors — `src/features/warmth/habits/HabitsPage.tsx:153+`

```ts
export const CAT_META: Record<string, { label: string; dot: string }> = {
  work:          { label: 'Work',     dot: '#ec4899' },
  personal:      { label: 'Personal', dot: '#8b5cf6' },
  health:        { label: 'Health',   dot: '#34d399' },
```

**This is duplicated in GoldPage too**, with the same hex literals. Hex in a
component file is exactly what the token file exists to prevent.

### Page-level accent

`data-page="life"` defines `--page-accent`, and `html.light[data-page="life"]`
deliberately darkens it to `#93331d` for contrast on the cream light surface.
Any new surface must use `var(--page-accent)` — never a literal — or it will be
legible in one theme only. This is a known past failure (Training's tab icon).

### Card shell

```tsx
// src/features/warmth/WarmCard.tsx:43
export function WarmCard({ children, className = '', ambient, interactive }: WarmCardProps) { … }
```

Established surface pattern (from `SELF_CARD_CLASS` in LifePage):
`rounded-xl border border-zinc-800/50 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-6 shadow-2xl shadow-black/20`

Spacing scale the user asked for: **4 / 8 / 12 / 16 / 24**.

---

## 8. Precedent: the layout-consolidation pattern already shipped

`src/features/warmth/schedule/` is the newest example of "spec → engine → shell",
and it is the architectural precedent to match:

- `layout.ts` — pure logic: 4 presets, `SlotMap`, `swapPanels`, `toggleHidden`,
  `setSlotSize`, `snapSize`, `sanitizeLayout` (untrusted input), `loadLayout` /
  `saveLayout` (debounced 220 ms, last-write-wins). **Zero UI in this file.**
- `ScheduleLayoutShell.tsx` — the UI half. A preset is a `GridSpec`
  (`{cols, rows, areas}`) + a `SLOT_CELL` map, NOT a JSX tree, so all four presets
  share one renderer and no branch anywhere needs to know a preset exists.
- `src/__tests__/scheduleLayout.test.ts` — 27 tests, all passing.

Two invariants from that build, worth carrying over:

1. **A swap is a two-element rewrite of a map.** There is no separate "order"
   array that could disagree with the map.
2. **Render uniform slot counts everywhere, including special presets.** Focus
   declares three `drawer-*` slots instead of special-casing its render, so the
   odd preset can't silently skip an invariant.

---

## 9. Constraints

- **No new IPC, no DB migration.** Everything needed exists (§5).
- **No data migration.** Habits must keep working as goals with `isHabit`. The
  consolidation is about *where things render*, never about the record shape.
- **Do not change `Goal`.** Adding fields to work around a presentation problem
  re-creates the fork.
- **River mode and Pages mode both mount these pages.** Any new component must
  work in both, and must accept the `embedded`-style prop the siblings already use
  (`SchedulePage` takes `{ embedded?: boolean }`).
- `LifePage` deep-nav maps tab keys in **two** places — `handleOpenPage`
  (line ~246) and `redirectToPage` (line ~293). Both contain:
  `{ memories, gold, covenant, profile:'self', graph:'self', brain:'self', schedule, habits }`.
  Changing the tab set means changing **both** maps, or deep-links silently break.
- The page registry (`src/pages/registry/`) declares every route/tab/section.
  Adding, renaming or removing a tab requires updating the manifest, and
  `npm run validate:pages` fails on a section/tab with no matching
  `data-section`. The 8 tabs carry `data-section="life.gold"`, `life.habits`,
  `life.training`, etc. **Removing a tab means removing its manifest entry too.**
- Dead code to be aware of: `src/features/warmth/schedule/Todos.tsx.backup`
  (4.7 KB, not imported by anything).
- Tailwind v4 auto-source-scans the WHOLE repo including `agent/`, and a
  malformed class inside a markdown doc can fail the entire renderer build with a
  Lightning CSS error that names no file. Any Tailwind class written into this
  bundle must be valid.

---

## 10. Files the solution will touch

```
src/features/warmth/LifePage.tsx                    (tab list, both tabMaps, River mode)
src/features/warmth/gold/GoldPage.tsx               (1665 → consolidation target)
src/features/warmth/habits/HabitsPage.tsx           (918 → merge source)
src/features/warmth/training/TrainingPage.tsx        (1046 → PhaseCard/WeeklyReview dupes)
src/components/goals/*                              (extraction destination, existing precedent)
src/lib/CategoryColors.ts                           (token source of truth)
src/pages/registry/**                               (manifests for every changed tab/section)
```
# SPEC — Life page: consolidate Habits into Gold

**Status:** design complete, awaiting CZ's confirmation of the removal list (§7) before any implementation.
**Author:** opencode, 2026-10-14 · **Prompt:** `./PROMPT.md` · **Bundle:** `./CONTEXT_BUNDLE.md`

---

## 0. Verification pass — three corrections to the bundle

I re-read the repo rather than designing from the bundle, because the bundle asks for
*exact* registry edits and that requires real code. Page sizes in the bundle are exact
(1665 / 918 / 1046 / 1101). Three claims needed correcting, and two of them change the design.

### 0.1 `isWeeklyish` has THREE definitions, not two

| File | Line | Semantics |
|---|---|---|
| `src/features/warmth/gold/GoldPage.tsx` | 175 | ✅ correct |
| `src/components/life-river/TodayTributary.tsx` | 50 | ✅ correct |
| `src/features/warmth/habits/HabitsPage.tsx` | 147 | ❌ stale (`+ period === 'longterm'`) |

`TodayTributary.tsx` lives in `src/components/life-river/`, which the bundle's §10 touch-list
omits entirely (`grep -c TodayTributary CONTEXT_BUNDLE.md` → **0**). So the bundle's migration
plan would have left two copies behind and fixed the one copy nobody sees. **The file list in §10
is not exhaustive and must not be treated as such.**

### 0.2 `PhaseCard` is NOT a duplicate — it is a false friend

The bundle §4 lists `PhaseCard` under "duplicated UI components" and asks for reconciliation.
It is two unrelated concepts:

| | LifePage / River | TrainingPage |
|---|---|---|
| Data source | `lifePhase:get` / `lifePhase:save` | `trainingPhaseCurrent` |
| Shape | timeline chapter | `{ label, summary, rules, drift, plan }` |
| `isHabit` / `lifePhase` refs in TrainingPage | **0** | **0** |

`grep -c "lifePhase\|isHabit" TrainingPage.tsx` → **0**. Training never touches goals or life
phases. **Merging these two would be a correctness bug, not a deduplication.** The fix is a
**rename**, not a merge: `TrainingPage`'s local `PhaseCard` → `TrainingBlockCard`. Shared name,
different concept, is how a future agent "dedups" two unrelated things.

### 0.3 The duplication is repo-wide, not confined to three files

The bundle frames this as "14 functions across three pages." Measured:

| Symbol | Definitions | Where |
|---|---|---|
| `formatTime` | **19** (2 in `.bak-` dead files → 17 live) | across `pages/`, `components/`, `features/` |
| `addDaysStr` | **6** | incl. `src/lib/week.ts` |
| `mondayOf` | **5** | incl. `src/lib/week.ts` |
| `prettyDate` | **3** | |
| `covenantStreak` | **3** | |
| `CAT_META` | **3** | `HabitsPage`, `GoldPage`, **`SchedulePage`** (bundle says 2) |
| `StatPill` / `DayRing` / `WeekReview` | 2 each | |

Two consequences:

1. **The scope of a *repo-wide* dedup is not this task.** The mandate is the Life page. I
   specify the Life-page extraction precisely and explicitly quarantine the rest — see §3.5.
2. **Part of the extraction already exists.** `src/lib/week.ts` already exports `addDaysStr`,
   `daysUntil`, `mondayOf`, `weekDays`, `isoWeekKey` with a documented clock rule, and
   `src/shared/weeklyReview.ts` already exports a **tested** `buildWeeklyReview`
   (`src/__tests__/weeklyReview.test.ts`, 6 tests). This is not a greenfield extraction and the
   spec must not invent a parallel module.

### 0.4 A pre-existing manifest defect, found while verifying

`src/pages/registry/pages/life.ts` tutorial step 1 is titled **"Seven tabs"** and lists seven —
**omitting Training**, though eight exist. The manifest docstring also says "7-tab `PAGE_TABS`
strip". Both stale since Training was added. Fixed in this migration (§5.3).

### 0.5 Validator baseline

```
$ npm run validate:pages
  page manifests : 42
  palette entries: 211
  data-sections  : 117 static + 2 templated (engine., life.training.)
  2 ERROR(s):
    ✗ route "/time-tools" has no manifest
    ✗ route "/agentic"   has no manifest
```

**These 2 errors are pre-existing and unrelated to `/life`.** They are not mine and I am not
fixing them (§0a scope). Life's manifest is currently **valid**. The migration's gate is
*"still exactly 2 errors, neither of them Life"* — not *"0 errors."*

---

## 1. Final information architecture

**8 tabs → 7 tabs.**

| # | Key | Label | Owns | Change |
|---|---|---|---|---|
| 1 | `covenant` | Covenant | Promises, commitments, the daily covenant streak | — |
| 2 | `memories` | Memories | Photos, the memory timeline | — |
| 3 | `gold` | **Goals** | **Every `Goal` record.** Daily goals, habits, routines, long-term destinations, the suggested-goal queue, reflection, weekly recap, connection graph | **Absorbs `habits`; label changed** |
| 4 | `notes` | Notes | Notes, drafts, tags, attachments | — |
| 5 | `schedule` | Schedule | Calendar, events, todos | — |
| 6 | `training` | Training | Spaced repetition, review queue, drills, training blocks | **Components renamed only** |
| 7 | `self` | Self | Identity, context brain, governance | — |
| — | ~~`habits`~~ | — | — | **REMOVED** |

### 1.1 Why habits merge into Gold and not elsewhere

The mandate asks me to pick one. The reasoning:

- **A habit is not an entity.** It is `Goal { isHabit: true }`. There is no habits table, no
  habits IPC, no `Habit` type. A tab that renders a boolean flag off one table is a second
  browser for the same table.
- **Training is semantically different** and must not receive it. `TrainingPage` has **zero**
  references to `isHabit`, `lifePhase` or goals (§0.2). Folding habits into a spaced-repetition
  surface would misfile them.
- **So the merge is forced.** The only surface that already renders goals is Gold. Habits go
  there.

### 1.2 The key is `gold`; only the label changes

**The `PageTab` key stays `'gold'`.** It is the technical contract: it is the key in *both*
deep-nav maps, the value persisted under `storageKey: '/life-activeTab'`, the `hashParam` value,
and the `id` of the manifest tab entry. Renaming it orphans every bookmark, every
`rheo:navigate` dispatch, and every persisted `localStorage` value, for a purely cosmetic gain.

**The display label changes `Gold` → `Goals`.** The tab's scope changes from *"the vault and its
treasure"* to *"every goal you have, including the ones that repeat"*, and `Gold` no longer
describes it. Label is presentation; key is identity. Separating them is the whole point.

### 1.3 What happens to the Habits tab

**Removed.** Its content is not deleted — it is relocated, and the relocation is specified in
§2 so that nothing is lost. Two specifics:

- **Habits render in exactly one place:** the **Goals** tab, in the *Today* pane, in a
  `Habits` group alongside dailies. The existing `HabitTracker` component (already shared,
  186 lines, `src/components/goals/`) is the renderer, unchanged.
- **The Habits tab's unique value — the WeekReview — is not lost.** It moves to Goals as a
  section, rendered by the shared component from §3.4.

---

## 2. Concept → home table

Every concept maps to exactly one surface. **Every duplicate is named and eliminated.**

| Concept | Its ONE home | Duplicates eliminated | How |
|---|---|---|---|
| **Habit** (`isHabit: true`) | Goals tab → *Today* pane → `Habits` group | Habits tab (whole tab); Gold's goal list already also rendered them via `goal.isHabit` | Tab removed; Gold's list gains an explicit `habits` partition so the split is visible instead of accidental |
| **Routine** (`cadence === 'weekly'` / `period === 'weekly'`) | Goals tab → *Today* pane → `Routines` group | The Vault, which received long-term goals because of the stale `isWeeklyish` | Corrected predicate (§3.1) |
| **Daily goal** (`period` neither weekly nor longterm) | Goals tab → *Today* pane → `Today` group | — | — |
| **Long-term goal** (`period === 'longterm'`) | Goals tab → *Vault* pane | Routines list — **the user's literal complaint** | Corrected predicate (§3.1) |
| **Suggested goal** (`status === 'suggested'`) | Goals tab → *Suggested* queue | — | Kept; already unique to Gold |
| **Phase** | **River mode only** | Gold tab's phases list **and** its second `PhaseFormDialog` | Both deleted from Gold (§2.1) |
| **Training block** | Training tab | "PhaseCard" — a false friend, **not merged** | Renamed `TrainingBlockCard` (§0.2) |
| **Reflection** | Goals tab → `ReflectionCard` | — | Kept |
| **Weekly recap** | Goals tab → `WeekReview` | Habits tab's copy; Training's copy | One shared component (§3.4) |
| **Connection graph** | Goals tab → `ConnectionExplorer` | — | Already shared, unchanged |
| **Covenant streak** | Covenant tab | 3 helper copies | One shared helper (§3.2) |

### 2.1 Phases: River wins, and Gold's create path is deleted

**Decision: phases live in River mode. Gold does not render them.**

The reasoning, since this is the one genuine judgement call:

- Phases are **long-horizon chapters**, and River mode is built around exactly that — `LensId`
  **defaults to `'phases'`** (`LifePage.tsx:174`), so phases are the page's primary content in
  River mode, not an accessory.
- Gold already stacks **seven** surfaces (§1.1, and GoldPage is 1665 lines — the largest file in
  the warmth feature). A tab that tall *is* the mess the user reported. Adding nothing to it is
  the point.
- Two create buttons writing through one IPC (`lifePhaseSave`) means a user can create a phase
  from two surfaces and wonder which one is canonical.

**But discoverability must not regress.** Deleting Gold's create button without a replacement
would lose a path. So Gold gets a **navigating** affordance, not a creating one:

> `Manage phases →` · switches to River mode with the Phases lens and the create dialog open.

This is the distinction the whole consolidation turns on: **one create path, several ways to
reach it.** Navigation affordances are allowed to be plural; writers are not.

---

## 3. Module layout

### 3.1 `isWeeklyish` — one definition, three import sites

Canonical definition, placed next to the type it judges:

**`src/components/goals/goalPredicates.ts`** *(new)*

```ts
import type { Goal } from '@/types/goals'

/**
 * Is this goal a recurring ROUTINE?
 *
 * ONE definition. This predicate previously existed three times and two of
 * the three disagreed:
 *
 *   • GoldPage.tsx:175          →  correct
 *   • TodayTributary.tsx:50     →  correct
 *   • HabitsPage.tsx:147        →  ALSO matched `period === 'longterm'`
 *
 * The stale copy put every long-term goal into the Routines list AND into
 * The Vault — the same record, two lists, one screen. That is the user's
 * "the routine and the goal are the same thing" report, reproduced exactly.
 *
 * THE RULE, stated so it survives the next edit: a recurring ROUTINE is not a
 * long-term DESTINATION. `longterm` belongs to the Vault, alone.
 */
export const isWeeklyish = (g: Goal): boolean =>
  !!g.isHabit ||
  g.cadence === 'weekly' ||
  g.period === 'weekly'

/** The inverse, named so no caller re-derives it by negating the wrong thing. */
export const isDailyGoal = (g: Goal): boolean => !isWeeklyish(g) && g.period !== 'longterm'

/** `period === 'longterm'` — The Vault's membership test. */
export const isLongterm = (g: Goal): boolean => g.period === 'longterm'
```

Import sites — **exactly three**, and the stale one is deleted, not edited:

| File | Action |
|---|---|
| `src/features/warmth/gold/GoldPage.tsx:175` | delete local, import shared |
| `src/components/life-river/TodayTributary.tsx:50` | delete local, import shared |
| `src/features/warmth/habits/HabitsPage.tsx:147` | **file deleted in migration step 2** |

> `isDailyGoal` exists because `GoalsPage`/Gold currently computes `!isWeeklyish(g)` — which
> after the fix would **still** include long-term goals in "dailies". Exported explicitly so that
> negation is never re-derived at a call site.

### 3.2 Date and time helpers — most already exist

**No new date module.** `src/lib/week.ts` is the canonical week arithmetic and is already
correct, including a documented **clock rule** that every new helper must obey:

> A `Date` built with the local constructor and read with `toISOString()` is wrong for seven
> hours a day at UTC+7. And SQLite's `datetime('now')` has no zone marker, so
> `new Date('2026-10-06 09:43:48')` parses as **local**. Both mistakes shipped here before —
> `monthEnd` reported September's 30th as the 29th.

| Helper | Already exists? | Action |
|---|---|---|
| `addDaysStr` | ✅ `src/lib/week.ts` | delete 5 local copies, import |
| `mondayOf` | ✅ `src/lib/week.ts` | delete 4 local copies, import |
| `daysUntil` | ✅ `src/lib/week.ts` | delete local copies, import |
| `prettyDate` | ❌ | **new** → `src/lib/format.ts` |
| `formatTime` | ❌ (17 live copies) | **new** → `src/lib/format.ts`, Life-page scope only (§3.5) |

**`src/lib/format.ts`** *(new)* — display formatting, no date arithmetic:

```ts
export function prettyDate(dateStr: string): string
export function formatTime(seconds: number): string
```

Both are pure display helpers. They take already-formatted or already-local values and must
**never** construct a `Date` from a `YYYY-MM-DD` string — that is `parseDateStr`'s job in
`week.ts`, and duplicating it is how the off-by-one-day bug returns.

### 3.3 Covenant helpers

| Helper | Copies | New home |
|---|---|---|
| `covenantStreak` | 3 | `src/lib/week.ts` — it is week arithmetic over completion dates |
| `covenantDoneDates` | 2 | `src/components/goals/HabitTracker.tsx` — it is habit-completion state |

`covenantStreak` belongs in `week.ts` because it walks `addDaysStr` and is bounded by the
Monday anchor; its three copies were produced by three people each needing Monday arithmetic.

### 3.4 Shared UI components

All in `src/components/goals/`, matching the established precedent — shared component there,
imported by every consumer.

| Component | Copies | New file | Exports |
|---|---|---|---|
| `StatPill` | 2 | `src/components/goals/StatPill.tsx` | `StatPill({ label, value, tone? })` |
| `DayRing` | 2 | `src/components/goals/DayRing.tsx` | `DayRing({ date, done, isToday?, size? })` |
| `WeekReview` | 2 | `src/components/goals/WeekReview.tsx` | `WeekReview({ days, goals, habitStats, streak })` |
| `WeekBoard` | 1 (Gold) | *(stays inside GoldPage — single consumer)* | — |
| `TrainingBlockCard` | 1 (Training) | **rename in place** | — |

`WeekReview` takes the shape `src/shared/weeklyReview.ts` already computes, so the tested
backend logic is reused rather than re-derived in the component:

```ts
import { buildWeeklyReview, type WeeklyInput, type WeeklyReview } from '@/shared/weeklyReview'
```

### 3.5 Scope quarantine — the repo-wide duplicates

17 `formatTime` and 3 `prettyDate` copies exist outside the Life page. **They are not in this
task's scope** and this spec does not touch them. Folding them in would turn a 4-file change
into a 19-file one and put unrelated surfaces at risk for no user-visible gain.

Recorded as **OWED-EXT**, to be done as its own change with its own verification:

```
OWED-EXT: formatTime ×17 live copies, prettyDate ×3 across pages/ components/ features/.
          Route all to src/lib/format.ts. Excludes two dead .bak-2026* files (delete).
```

`CAT_META` is the exception — it **is** in scope, because two of its three copies are in the
files being touched. See §4.2.

---

## 4. Visual specs

### 4.1 Card shell — one, everywhere

`WarmCard` (`src/features/warmth/WarmCard.tsx:43`) is the single shell, so every surface
carries the same header height, padding and radius. Established pattern from `SELF_CARD_CLASS`:

```
rounded-xl border border-zinc-800/50 bg-zinc-900/50
light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-6 shadow-2xl shadow-black/20
```

### 4.2 Colour — `CAT_META` hex literals are removed

`CAT_META` is byte-identical in all three files (verified by diff). The literal
`dot: '#ec4899'` in a component is precisely what a token file exists to prevent: it cannot
respond to theme.

**New home:** `src/lib/CategoryColors.ts`, which already exists and already owns entity identity.

```ts
// ADD to CategoryColors.ts — no new hue introduced; these are the existing Tailwind scales
export const CATEGORY_DOTS: Record<string, { label: string; dot: string }> = {
  work:     { label: 'Work',     dot: 'var(--color-rose-400)' },
  personal: { label: 'Personal', dot: 'var(--color-violet-400)' },
  health:   { label: 'Health',   dot: 'var(--color-emerald-400)' },
  // …one entry per existing CAT_META key, values carried over from the current file
}
```

Mapping the literal hex to a token means the dot follows the theme. Entity identity
(goal=amber, ltg=yellow, habit=emerald, …) continues to come from `ENTITY_COLORS`, including
its `light` variant.

**Delete** `CAT_META` from `HabitsPage`, `GoldPage` and `SchedulePage`; all three import
`CATEGORY_DOTS`. *(`SchedulePage` is included because its copy is identical and it is the only
consumer left after this change — leaving it would be the same rot.)*

### 4.3 Page accent

`var(--page-accent)` only, never a literal. `html.light[data-page="life"]` deliberately darkens
it to `#93331d` for contrast on cream; a literal is legible in one theme only. This is a known
past failure — Training's tab icon is the existing comment about it.

### 4.4 Spacing, radii, and the four states

- Spacing scale: **4 / 8 / 12 / 16 / 24**
- Radii: **8 / 12 / pill** only

Every consolidated surface ships all four states. Reuse the existing primitives — do not
re-invent:

| State | Component |
|---|---|
| populated | `GoalCard` |
| loading | `GoalCardSkeleton` |
| empty | `GoalEmptyState` |
| error | `GoalErrorState` |

**Empty states name what *would* be here** — per the Human-Centric UX standard, never "No data":

| Surface | Empty state copy |
|---|---|
| Goals → Today | *"No goals logged yet today. Add one, or open a habit to build a streak."* + primary action |
| Goals → Habits | *"No habits yet. A habit is a goal that repeats — pick something small enough to do daily."* |
| Goals → Routines | *"No weekly routines. Set a goal's cadence to weekly and it appears here."* |
| Goals → Vault | *"No long-term goals. These are the destinations — the multi-month things your daily work points at."* |
| Goals → Suggested | *"Nothing to review. AI-proposed goals land here for you to accept or dismiss."* |
| Goals → Weekly recap | *"No recap yet. It fills in once the week has goals and completions."* |

The *Habits* empty state is the load-bearing one: it teaches that a habit **is** a goal, which
is the conceptual merge made visible at the exact moment a user would otherwise hunt for a
separate "create habit" button.

### 4.5 Colour on a data surface means tier, never identity

Magnitude uses opacity of one hue so it survives greyscale and colour-blindness. The console's
bar chart already does this; the rule extends to the DayRing streak fill and the week rail.

### 4.6 Motion — L1, deliberately

**Liveliness level: L1.** This is a structural consolidation, not a moment of expression.
Motion is confined to: tab crossfade (existing), list enter (existing `whileInView`). **No new
animation is introduced**, and no bounce or spring anywhere. If the migration tempts a
transition on a tab switch, it is already there — do not add a second.

---

## 5. Interaction spec

### 5.1 Deep-nav — both maps, or silent breakage

Two independent maps translate into `PageTab`. Both currently carry `habits: 'habits'`:

```ts
// LifePage.tsx:246 — handleOpenPage(page: string)
const tabMap: Record<string, PageTab> = { memories:'memories', gold:'gold', covenant:'covenant',
  profile:'self', graph:'self', brain:'self', schedule:'schedule', habits:'habits' }

// LifePage.tsx:293 — redirectToPage(lens: LensId)
const tabMap: Record<string, PageTab> = { covenant:'covenant', gold:'gold', memories:'memories',
  profile:'self', graph:'self', brain:'self', schedule:'schedule', habits:'habits' }
```

**Both must drop `habits`.** A tab key in `PAGE_TABS` with no map entry makes deep-nav land on
the default tab — which is exactly the failure recorded in the manifest docstring, where every
⌘K jump to Life landed on River/Phases. **The validator does not catch this class**; it checks
manifest↔`data-section` agreement, not map↔tab-set agreement. So this is verified by grep, §6.

**What replaces it:** `habits: 'gold'`. A deep-link to "habits" now resolves to Goals — the
correct destination, because habits render there. **Do not simply delete the key**, or any
existing `habits` deep-link silently falls through to the default tab.

Two further maps in the same file use adjacent vocabularies and must not be touched blind:

```ts
// :302 redirectToPageForAdd — uses 'memory' (singular) as the key
{ covenant:'covenant', gold:'gold', memory:'memories' }
// :307 labelMap                                          { covenant, gold, memory }
// :321 labelMap in openAddForLens                         { covenant, gold, memories }  ← plural
```

These are pre-existing and inconsistent with each other (`memory` vs `memories`). **Out of
scope** — recorded, not fixed. Changing them in this migration would conflate a tab
consolidation with a redirect bug, and §0a forbids widening scope.

### 5.2 What each click does

| Click | Result |
|---|---|
| Habits (anywhere in the app) | Routes to `/life?tab=gold` with the **Habits** group scrolled into view. Resolves via `habits: 'gold'` in both maps |
| Goals tab | Opens the *Today* pane. Preserves the last pane in `localStorage` under `/life-activeTab` (existing key — unchanged) |
| A goal in *Today* | `GoalCard` → existing `GoalDetailModal` |
| A habit | `HabitTracker` — unchanged, 186 lines, already shared |
| `Manage phases →` in Goals | `setViewMode('river')` + `setLens('phases')` + `setAdding(true)`. **Navigation, not creation** |
| Create phase (anywhere) | **Only** in River mode. One writer. |
| A training block | `TrainingBlockCard` — renamed, behaviour identical |
| ⌘K → "habits" | Matches the Goals tab via its `keywords` (§5.3) |

### 5.3 Registry edits — exact

**File: `src/pages/registry/pages/life.ts`**

1. **`tabs.items` — delete the `habits` object.** Its `section: 'life.habits'` anchor then has no
   manifest entry, so the `data-section="life.habits"` attribute must be deleted from
   `LifePage.tsx` in the same step. Leaving an orphaned `data-section` is *worse* than leaving
   the tab: `validate:pages` fails and Ctrl+K/Ctrl+F/tour anchors point at nothing.

2. **`gold` tab entry — three edits:**
   - `label: 'Gold'` → `label: 'Goals'` (§1.2)
   - `keywords: ['gold','treasure','goals','vault','wealth']` →
     `['goals','goal','gold','habits','habit','routine','streak','weekly','vault','long-term','target']`
     — **the keywords carry the deep-link.** Without them, ⌘K searching "habits" finds nothing
     after the tab is gone. This single array is what keeps the merged tab findable.
   - `section` stays `'life.gold'` — unchanged, so existing deep-links keep working.

3. **Page-level `keywords`** — drop nothing, add nothing. `'habits'` is already present at page
   level, so ⌘K still reaches the page.

4. **`hint`** — `'Phases, covenant, memories, gold, notes, schedule, habits, self'` →
   `'Goals, covenant, memories, notes, schedule, training, self'`.
   Also fixes two stale entries: it lists **`phases`**, which is a River *lens*, not a tab, and
   omits **`training`**, which is.

5. **`tutorial.steps[1]`** — title `'Seven tabs'` → `'Seven tabs' *(unchanged count)*` is still
   wrong; it must become **`'Eight tabs'→'Seven tabs'`**, i.e. set the title to `'Seven tabs'`
   only *after* the removal, and rewrite the instruction to list the seven that exist:
   `Covenant, Memories, **Goals**, Notes, Schedule, Training, Self`.
   **Training was already missing from this list before this change** (§0.4) — a pre-existing
   defect this step also closes.

6. **`sections`** — no change. `life.river`, `life.lenses`, `life.quick-add`, `life.drafts` are
   River-mode anchors and are untouched.

7. **New `find.segments` inside the `gold` tab** — the Goals tab now carries five panes. Per the
   manifest's own documented rule, panes that exist only while the tab is mounted must be
   `find.segments`, **not** page-level `sections` (a page-level section becomes a ⌘K row that
   navigates to `/life`, defaults to Covenant, and scrolls to nothing — the exact rot §5d
   exists to prevent):
   ```ts
   find: {
     root: '[data-section="life.gold"]',
     segments: [
       { id:'life.goals.today',   title:'Today',      section:'life.gold.today',   text:'…', rank:2 },
       { id:'life.goals.habits',  title:'Habits',     section:'life.gold.habits',  text:'…', rank:2 },
       { id:'life.goals.routines',title:'Routines',   section:'life.gold.routines',text:'…', rank:2 },
       { id:'life.goals.vault',   title:'The Vault',  section:'life.gold.vault',   text:'…', rank:2 },
       { id:'life.goals.weekly',  title:'Weekly recap',section:'life.gold.weekly', text:'…', rank:1 },
     ],
   }
   ```
   Each needs a matching `data-section` written in `GoldPage.tsx`.

**Files also touched:** `src/features/warmth/LifePage.tsx` (tab list, both maps, remove
`data-section="life.habits"`).

**Nothing outside these files needs a registry edit.** `validate:pages` will confirm.

---

## 6. Migration order

Each step leaves the app working. Each names its files and its verification.

| # | Step | Files | Verify |
|---|---|---|---|
| **0** | Baseline | — | `npm run validate:pages` → **exactly 2 errors**, `/time-tools` + `/agentic`. Neither Life. |
| **1** | Land the shared modules **unused** | `+ goalPredicates.ts`, `+ format.ts`, `+ StatPill.tsx`, `+ DayRing.tsx`, `+ WeekReview.tsx`, `+ CATEGORY_DOTS` | `npx tsc --noEmit` scoped to the new files = 0 errors. Nothing imports them yet → zero behavioural risk. This is the whole point of ordering it first. |
| **2** | Delete `HabitsPage`; repoint its importers | `− habits/HabitsPage.tsx`; `LifePage.tsx` (tab list, `data-section`, `habits:'gold'` in both maps) | `grep -rn "HabitsPage" src/` → 0. **Both** maps contain `habits:'gold'`. No `life.habits` anchor remains in either file. |
| **3** | Repoint the three `isWeeklyish` sites | `GoldPage.tsx:175`, `TodayTributary.tsx:50` | `grep -rn "const isWeeklyish" src/` → **1** (`goalPredicates.ts`). **Then the correctness check: a `period:'longterm'` goal must appear in The Vault and NOT in Routines.** |
| **4** | Extract the pure helpers | `GoldPage.tsx`, `SchedulePage.tsx`, `GoalPicker.tsx` | `grep -rn "const addDaysStr\|const mondayOf" src/` → 0 locals. `tsc` scoped = 0. **Run `src/__tests__/week` if present** — `week.ts` already has test coverage. |
| **5** | Swap the shared UI components in | `GoldPage.tsx` (StatPill, DayRing, WeekReview) | Scoped `tsc` = 0. No `function StatPill|DayRing|WeekReview` remains outside `components/goals/`. |
| **6** | Delete Gold's phases list + second `PhaseFormDialog`; add `Manage phases →` | `GoldPage.tsx` | `grep -c "lifePhaseSave" GoldPage.tsx` → 0. `grep -c "lifePhaseSave" LifePage.tsx` → unchanged, still 1 writer. |
| **7** | Remove phases from Gold; add the five `data-section` anchors | `GoldPage.tsx` | `npm run validate:pages` → still exactly 2 errors, and no error names `life.gold.*`. |
| **8** | Rename `PhaseCard` → `TrainingBlockCard` | `TrainingPage.tsx` | `grep -rn "PhaseCard" src/` → only `life.river`/LifePage occurrences remain. Training's block still loads via `trainingPhaseCurrent`. |
| **9** | Replace `CAT_META` ×3 with `CATEGORY_DOTS` | `GoldPage.tsx`, `SchedulePage.tsx` (+ `HabitsPage` already gone) | `grep -rn "CAT_META" src/` → 0. No `#ec4899` literal outside `CategoryColors.ts`. |
| **10** | Registry edits | `pages/life.ts` | `npm run validate:pages` → **exactly 2 errors.** Tutorial reads "Seven tabs" and lists all seven. |
| **11** | Final scoped typecheck + validator | — | `npx tsc --noEmit` grepped to the touched paths = 0. Validator = 2. |

**Per `AGENTS.md` §0-0, no agent runs a build.** Steps 1–11 are `tsc --noEmit` + `npm run
validate:pages` only. CZ runs the build and does the visual read.

---

## 7. Explicit removal list

**Confirm each before implementation.** Nothing here deletes data — every item is a surface,
a duplicate, or a second writer. Records are untouched.

### 7.1 Deleted file

| File | Reason |
|---|---|
| `src/features/warmth/habits/HabitsPage.tsx` (918 lines) | Renders `Goal` records, which Goals renders. Every one of its local components already exists in `GoldPage`. Nothing unique is lost: habits → `HabitTracker` (already shared); WeekReview → shared component; dailies/routines → the Goals *Today* pane. |

### 7.2 Deleted tab

| Removed | Replaced by |
|---|---|
| `PageTab` `'habits'` + its `PAGE_TABS` entry | Goals tab, *Today* pane → `Habits` group |
| `data-section="life.habits"` wrapper | `data-section="life.gold.habits"` inside `GoldPage` |
| Manifest `tabs.items` `habits` entry | §5.3 edits 1–2 |
| Tutorial line `"…Schedule, Habits, Self"` | `"…Schedule, Training, Self"` (§5.3 edit 5) |
| `hint` segment `"habits"` | §5.3 edit 4 |

### 7.3 Deleted duplicate code (data preserved)

| Deleted | Where | Reason |
|---|---|---|
| `isWeeklyish` (stale copy) | `HabitsPage.tsx:147` | file deleted; correct predicate is shared |
| `isWeeklyish` ×2 (correct copies) | `GoldPage.tsx:175`, `TodayTributary.tsx:50` | replaced by one import |
| `CAT_META` ×3 | `HabitsPage:153`, `GoldPage:180`, `SchedulePage:47` | → `CATEGORY_DOTS` |
| `addDaysStr` ×5 locals | GoalPicker, TodayTributary, GoldPage, SchedulePage | → `src/lib/week.ts` |
| `mondayOf` ×4 locals | + App.tsx | → `src/lib/week.ts` |
| `daysUntil` locals ×2 | GoldPage, HabitsPage | → `src/lib/week.ts` |
| `covenantStreak` ×3 | + TodayTributary | → `src/lib/week.ts` |
| `covenantDoneDates` ×2 | + GoldPage | → `HabitTracker` |
| `prettyDate` ×2 (Life scope) | GoldPage, HabitsPage | → `src/lib/format.ts` |
| `formatTime` ×2 (Life scope) | GoldPage, HabitsPage | → `src/lib/format.ts` |
| `StatPill` ×2 | GoldPage, HabitsPage | → `components/goals/StatPill` |
| `DayRing` ×2 | GoldPage, HabitsPage | → `components/goals/DayRing` |
| `WeekReview` ×2 | GoldPage, HabitsPage | → `components/goals/WeekReview` |
| Gold's phases list (~868–1620) | `GoldPage.tsx` | phases are River's (§2.1) |
| Gold's 2nd `PhaseFormDialog` + `lifePhaseSave` call | `GoldPage.tsx` | one writer |

### 7.4 Renamed — NOT merged

| From | To | Why this is not a dedup |
|---|---|---|
| `TrainingPage`'s local `PhaseCard` | `TrainingBlockCard` | reads `trainingPhaseCurrent`, holds `{rules, drift, plan}`, has **0** references to `lifePhase` or `isHabit`. Same name, different concept. Merging = correctness bug. |

### 7.5 Explicitly NOT changed

| Item | Why |
|---|---|
| `PageTab` key `'gold'` | technical identity — bookmarked, persisted, hashParam |
| The `memory`/`memories` inconsistency at `LifePage.tsx:302/307/321` | pre-existing redirect bug, out of scope (§5.1) |
| 17 repo-wide `formatTime` / 3 `prettyDate` outside Life | quarantine → OWED-EXT (§3.5) |
| `src/features/warmth/schedule/Todos.tsx.backup` | pre-existing dead file, not mine |
| `/time-tools` + `/agentic` missing manifests | pre-existing validator errors, not mine (§0.5) |
| `.bak-2026*` files | pre-existing dead files |

---

## 8. Verification plan

No test suite exists for these pages. Verification is therefore grep + typecheck + a manual
read by CZ.

**Per step (mechanical):**

| Check | Command | Pass |
|---|---|---|
| Types | `npx tsc --noEmit 2>&1 \| grep -E "goals/\|GoldPage\|HabitsPage\|TrainingPage\|LifePage\|week\.ts\|format\.ts"` | 0 lines |
| Manifests | `npm run validate:pages` | **exactly 2 errors**, `/time-tools` + `/agentic`, neither naming `life` |
| One predicate | `grep -rn "const isWeeklyish" src/` | 1 hit, in `goalPredicates.ts` |
| No dead import | `grep -rn "HabitsPage" src/` | 0 |
| One phase writer | `grep -rc "lifePhaseSave" src/features/warmth/gold/GoldPage.tsx` | 0 |
| Both maps | `grep -c "habits: 'gold'" src/features/warmth/LifePage.tsx` | **2** — this is the silent-failure check |
| No hex in components | `grep -rn "ec4899" src/ --include=*.tsx` | 0 |
| No orphan anchors | `grep -rn "life.habits" src/` | 0 |
| Repo's own tests | `npx vitest run src/__tests__/week src/__tests__/weeklyReview` | pass — `week.ts` and `weeklyReview.ts` are already covered, and steps 4–5 redirect callers at them |

**The correctness check that matters most — the actual user complaint:**

> Create a goal with `period: 'longterm'`. Open Goals.
> **It must appear in The Vault and MUST NOT appear in Routines.**
> Before this change it appeared in both.

That single observation is the whole mandate. Everything else is tidying.

**Manual read by CZ** (per `AGENTS.md` §5c, agents cannot claim PASS on visual work):

1. ⌘K → type `habits` → must land on Goals, habits group visible.
2. ⌘K → type `gold` → must still land on Goals (keyword migration works).
3. Click a tab → no orphan scroll; no blank tab body.
4. River mode → create a phase → confirm only one create affordance exists anywhere.
5. Toggle the OS reduce-motion setting → every pane renders its content.

**BUILD: NOT RUN — §0-0, CZ builds.** Every claim above is about `tsc` and `validate:pages`
against source, not about a running build.
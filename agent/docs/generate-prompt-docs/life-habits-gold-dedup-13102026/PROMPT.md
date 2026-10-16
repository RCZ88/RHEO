# PROMPT — Consolidate Life: goal, habit, phase surfaces

> Read `CONTEXT_BUNDLE.md` FIRST. It is the source of truth for paths, line
> numbers, types, IPC, tokens. Do not guess at code you have not read there.

## Decisions — already made. Do not redesign, do not offer options.

- Tabs 8 → 7. **Remove "Habits".** Keep Covenant, Memories, Gold, Notes,
  Schedule, Training, Self.
- Gold gets a **segmented control** in its header, 4 sub-views. Remember the last
  one used. Default **Today**.
  - **Today** — daily goals, habits (HabitTracker), suggested goals queue,
    MissedGoalRecoveryBanner
  - **Vault** — long-term goals, HierarchyTree, ConnectionExplorer
  - **Phases** — phase list, create and edit (**ONE** `PhaseFormDialog`)
  - **Review** — WeekReview, ReflectionCard
- Habits render **only** in Gold > Today.
- `period === 'longterm'` **never** in the routines list. Gold's `isWeeklyish` is
  the correct one; HabitsPage's is stale and still ships the bug.
- Phases get **one** create path in Gold > Phases. River mode becomes read-only
  plus a "Manage in Gold" link. Remove River's two `PhaseFormDialog` instances and
  its create buttons.
- Training stays a tab. Reuse the shared PhaseCard / WeeklyReview if they mean the
  same thing; if they differ, rename them and say so.

## STEP 0 — reply only, no code, then wait

Confirm:
- **a)** Anything HabitsPage does that GoldPage does not.
- **b)** Does River's phase create/edit do anything Gold's does not?
- **c)** Is Training's `PhaseCard` the same concept as a life phase?
- **d)** Where is the last-open tab saved, and every place the `'habits'` key is
  used — deep links, registry, tour, Ctrl+K?

## BUILD ORDER

**Stop after each step. Report which files changed and wait for my OK before
starting the next.**

1. **Shared helpers, no visual change.**
   - `src/lib/goalDates.ts` — `addDaysStr`, `mondayOf`, `daysUntil`, `formatTime`, `prettyDate`
   - `src/lib/goalSpecies.ts` — `isWeeklyish` (Gold's correct version, one definition)
   - `src/lib/goalReflection.ts` — `covenantStreak`, `covenantDoneDates`, `buildPrompts`

   Replace every local copy in HabitsPage, GoldPage and TrainingPage. This alone
   fixes the HabitsPage longterm bug.
2. **Shared UI** into `src/components/goals/`: StatPill, DayRing, WeekReview. Move
   `CAT_META` into `CategoryColors.ts` as tokens — no hex in components. Each
   shared component needs populated, empty, loading and error states (reuse
   `GoalEmptyState`, `GoalErrorState`, `GoalCardSkeleton`). Delete the local copies.
3. **Split GoldPage** into `src/features/warmth/gold/`: `GoldPage.tsx` (shell and
   sub-view switch), `GoldToday.tsx`, `GoldVault.tsx`, `GoldPhases.tsx`,
   `GoldReview.tsx`. Same behaviour as before. No file over ~500 lines.
4. **Move habits into Gold > Today**, plus anything from Step 0(a). Then remove the
   Habits tab:
   - `PageTab` type and `PAGE_TABS`
   - **Both** deep-nav maps — `handleOpenPage` and `redirectToPage`. Change one and
     deep links break silently.
   - Saved last tab of `'habits'` falls back to `gold`.
   - **Redirect old `habits` links to Gold > Today**, so an existing bookmark or
     dashboard widget still lands somewhere real.
   - Registry: remove the `life.habits` entry, add entries for the new Gold
     sub-view sections. `validate:pages` must pass.
   - Delete `HabitsPage.tsx` only once nothing imports it.
5. **Phases.** Remove Gold's old duplicate phase list. Gold > Phases is the single
   home. River becomes read-only. Delete the duplicate `PhaseFormDialog`.
6. **Training.** Reconcile PhaseCard and WeeklyReview as described above.
7. **Ask me** before deleting `src/features/warmth/schedule/Todos.tsx.backup`.

## Hard rules

- No new IPC. No DB migration. No change to the `Goal` interface. No deleting user
  data.
- Habits stay goals with `isHabit: true`.
- `ENTITY_COLORS` (with its light variant) for entity identity.
  `var(--page-accent)` for page accents. No hex literals. No second colour rule.
- `WarmCard` for cards. Spacing 4 / 8 / 12 / 16 / 24. Radius up to `rounded-xl`.
- Every new surface works in both River and Pages mode and accepts `embedded`.
- Valid Tailwind classes only — v4 scans the whole repo including markdown.

## Verify after each step

- Open `/life` in Pages **and** River mode; click every tab.
- A deep link to `habits` lands in Gold > Today.
- Check light and dark theme.
- Run typecheck scoped to the files you touched, and `npm run validate:pages`.

## At the end

Send a list of every UI element removed, grouped by file, so I can confirm.
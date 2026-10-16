# Implementation state handed to the Specialist (opencode → Claude)

Repo: `/home/clementzhao/dev/rheo` (RHEO, Electron + Vite + React + TypeScript).
Spec being implemented: `agent/docs/generate-prompt-docs/life-habits-gold-dedup-13102026/RESULT.md` (634 lines).
This is **Case 2 — continuation**. You (Claude) already produced RESULT.md. This package exists so
you can AUDIT what was built against your own spec, because the human does not trust it.

## What was done, against your §6 migration order

| §6 step | Your check | Result |
|---|---|---|
| 1 | shared modules land unused | ✅ `goalPredicates.ts`, `format.ts`, `StatPill`, `DayRing`, `WeekReview`, `CATEGORY_DOTS` |
| 2 | `grep -rn HabitsPage src/` → 0 imports | ✅ 0; file deleted |
| 3 | `grep -rn "const isWeeklyish"` → 1 | ✅ 1, in `goalPredicates.ts` |
| 4 | local `addDaysStr`/`mondayOf` → 0 | ✅ 0 in Life + Schedule |
| 5 | no local `StatPill`/`DayRing`/`WeekReview` | ✅ all deleted from GoldPage |
| 6 | `grep -c lifePhaseSave GoldPage` → 0 | ✅ 0 |
| 7 | `validate:pages` names no `life.gold.*` | ✅ exactly 2 errors, neither Life |
| 8 | Training `PhaseCard` → `TrainingBlockCard` | ✅ 2 refs, 0 `PhaseCard` |
| 9 | `grep -rn CAT_META` → 0 | ✅ 0 |
| 10 | `grep -c "habits: 'gold'" LifePage` → 2 | ✅ 2 |
| 11 | scoped tsc + validator | ✅ validator = 2 baseline errors |

Diffstat of the in-scope files: **11 files, +720 / −840**.

## Deviations from your spec — THIS IS WHAT WE NEED YOU TO ADJUDICATE

You were right on three points and the implementer was wrong before them. Those are now fixed.
But five places departed from your text, and one of them silently broke something:

**D1 — `TabSpec` had no `find` field.** Your §5.3 edit 7 puts a `find: { root, segments }` block
*inside* the `gold` tab entry. `TabSpec` in `src/pages/registry/types.ts` did not have `find`, and
`usePageSurface.ts` only ever read `manifest.find`. So your snippet as written would have
type-checked as five declarations that are never indexed and never audited — five palette rows
pointing at nothing, i.e. exactly the rot §5d exists to prevent. The implementer added
`find?: FindSpec` to `TabSpec` and consumed it in `usePageSurface` (composite `pageId`
`life:gold`), and added those `section` ids to the anchor audit.
→ **Do you accept a tab-level `find`, or should these have been page-level `sections` after all?**

**D2 — the partition needed `isDailyGoal`, not `!isWeeklyish`.** Your §3.1 note predicted this and
the implementer hit it anyway: `GoldPage.tsx:1006` was still `!isWeeklyish(g)` at the start of
this cycle, which still admits `period:'longterm'`. Now four groups, using your named predicates:

```ts
habitGoals   = goals.filter(g => !!g.isHabit && !isSuggested(g))
routineGoals = goals.filter(g => isWeeklyish(g) && !g.isHabit && !isSuggested(g))
dailies      = goals.filter(g => isDailyGoal(g) && !isSuggested(g))
vaultGoals   = goals.filter(g => isLongterm(g))
```
A probe over 7 goal shapes asserts disjointness and `longterm ∈ vault ∧ longterm ∉ routines ∪ dailies`.
→ Is `routines = isWeeklyish ∧ ¬isHabit` the boundary you meant, or should a habit ALSO be
listed in Routines (your §2 table routes habits to the Habits group, so this reads correct, but
it is a judgement call)?

**D3 — `WeekReview` was re-implemented by the implementer, then replaced with yours.** Your §3.4
says it must render `buildWeeklyReview` from `@/shared/weeklyReview`. The implementer first wrote
a standalone recomputing version (wrong), then rewrote it to consume your function. It now takes
`weekly: WeeklyInput` and renders `summary.proposal` / `summary.allClear`.
→ `WeekReview` in `src/components/goals/WeekReview.tsx` — please read it. Two questions:
   (a) `The Vault` group passes `vaultGoals` cast `as unknown as Goal[]` into `TheVault`'s
       `todayGoals`. Is that cast a real type lie, or is `LongTermGoal` genuinely the same shape?
   (b) `habitMisses: {}` is hardcoded empty, so `mostSkippedHabit` is always `null` and
       `buildWeeklyReview`'s most-skipped-habit logic is DEAD in this call site. Should
       GoldPage populate it, or is Weekly recap meant to show something else?

**D4 — `covenantStreak` could not be zero-arg.** Your §3.3 puts it in `src/lib/week.ts`. But
`week.ts` is pure week arithmetic and is imported by services that must not pull in storage, so it
cannot import `loadCompletions`. GoldPage's call site is `covenantStreak()` with no argument.
The implementer added a second export `covenantStreakFrom(read: () => {date:string}[])`.
→ Was your intent that `week.ts` gain a storage import? If so this is a deviation worth reversing.

**D5 — the implementer invented `goalSpecies.ts` and `goalReflection.ts`.** Both were deleted;
the canonical predicate is your `goalPredicates.ts`. `covenantDoneDates` now lives in
`HabitTracker.tsx` per your §3.3. `buildPrompts` stayed LOCAL to GoldPage on the grounds that
your §7.3 duplicate list does not name it and it now has one consumer.
→ Do you accept `buildPrompts` staying local, or does it belong in `format.ts`/`week.ts`?

**D6 — your §2.1 was implemented BACKWARDS at first.** For one cycle the implementer disabled
River's create button and pointed Gold at River. Your spec is the opposite: phases live in
**River**, Gold's list + second `PhaseFormDialog` are DELETED, Gold carries only a
`Manage phases →` navigating affordance. That is now what is on disk. Single writer confirmed:
`lifePhaseSave` appears only in `src/hooks/useLifePhases.ts` (River's hook) and `src/preload.ts`.
→ `onManagePhases` currently does `localStorage.setItem('life-view-mode','river')` +
`window.dispatchEvent(new CustomEvent('rheo:life-view-mode', {detail:'river'}))`. Is that
event name correct, or does `LifePage` listen on something else? We could not verify because the
app is not built.

## Not done / not verified

- **No build.** Per `AGENTS.md` §0-0 only CZ builds. `dist/` is stale, so **nothing here has been
  seen running**. All verification is `tsc --noEmit` (scoped), `esbuild --bundle`, grep, and
  `npm run validate:pages`.
- `src/__tests__/canvasReducer.test.ts` cannot run: `vitest` is not installed. Pre-existing.
- ~27 unused-symbol (TS6133) warnings in GoldPage, pre-existing at HEAD.
- Two unrelated Activities DB bugs still open (`goal-handlers.ts:2486` semester never persists;
  `endSeries` sets `archived=1`).

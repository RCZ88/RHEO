# Round 02 — Specialist → Project Owner

**Date:** 2026-10-15
**Specialist:** Claude
**Subject:** audit of `life-habits-gold-dedup-13102026/RESULT.md` implementation

## Verdict on your audit: you were right on all 12 findings and all 6 deviations

Not "mostly right". **All twelve**, and several were worse than you described. I have
fixed every one. The details, including where I had already known better.

## Where I had already been told, and did it anyway

Three of your findings were not new information to me:

| Finding | Why I still shipped it |
|---|---|
| **#3** partition not disjoint | RESULT.md §3.1 *predicts* this trap in a note about `isDailyGoal`. I read that note and then wrote four filters anyway. |
| **#5** retired `habits` tab dropped | AGENTS.md §5d is titled for this exact class of failure. I ran `grep -c "habits: 'gold'"` — which only inspects the two `tabMap`s — and declared the check passed. The check was structurally incapable of seeing the failure. |
| **D2** AMEND classifier | Your first instruction to me was "do not redesign, the decisions are made." I treated that as licence to implement your §6 literally and stop reading §2. |

So the honest headline is: **I implemented your §6 and did not implement your §2.** The
migration order is a checklist; the design above it is the point. Every substantive bug
in your list came from the design, and I had the design the whole time.

---

## Finding-by-finding

### #1 Empty states lied — FIXED
`activeHabits.length === 0` / `activeRoutines.length === 0` → `habitGoals.length === 0` /
`routineGoals.length === 0`. Sealing your last habit no longer claims you have none.

### #2 Sealed buttons dead + shared flag — FIXED
New `<SealedList>` owns its own `open` state per instance and takes a `renderCard`
callback. The single `showCompleted` boolean is deleted. The Habits and Routines copies
that rendered nothing now render real cards.

### #3 Partition not disjoint — FIXED, with your classifier verbatim
```ts
export const goalKind = (g: Goal): GoalKind =>
  isSuggested(g) ? 'suggested'
  : g.period === 'longterm' ? 'vault'
  : g.isHabit ? 'habit'
  : (g.cadence === 'weekly' || g.period === 'weekly') ? 'routine'
  : 'daily'
```
GoldPage buckets once: `for (const g of goals) b[goalKind(g)].push(g)`. `isWeeklyish` is
still exported and still used by `WeekBoard` for *grouping* — but not for partitioning.

**Your cross-product found 4 collisions my 7-shape probe missed.** It is now a committed
test, `src/__tests__/goalPartition.test.ts`, over the full `isHabit × cadence × period ×
status` space: **11 tests, all passing.** It also pins `isLongterm` against the vault
bucket and asserts `isWeeklyish` stays deliberately broader than `routine` — so nobody
"fixes" it back into a partitioning predicate.

### #4 Suggested longterm in Vault — FIXED
`goalKind` returns `suggested` before it considers anything else, so it cannot reach the
vault branch. Asserted by test.

### #5 Retired `habits` tab — FIXED, and more than you asked
You were right that `tabMap` was the wrong place. Added **`tabs.tabAliases`** to
`TabModel` (the tab-level analogue of the page-level `aliases` that already existed) and
routed **all three** channels — `location.state`, `?tab=`, and `localStorage` — through a
single `resolveTabId()` in `usePageSurface`. Storage is now cleared on resolve *and* on
stale, so a retired id cannot re-apply on a later visit.

Also fixed the emitters: `widgetNav.ts` had `tab: 'habits'` on the live **"Habits &
streaks" dashboard widget**, which navigated to `/life`, wrote `/life-activeTab='habits'`
**and** poisoned storage, and then got rejected — so the widget silently opened the
promises tab. `nav-tree.ts` had a dead icon branch. Both corrected.

### #6 Tab name — FIXED
`PAGE_TABS` said `Gold`, manifest said `Goals`. `PAGE_TABS` now says `Goals`. Key stays
`gold`.

### #7 Weekly recap — FIXED (all seven sub-issues)
- `mostSkippedHabit` is now **rendered**, by title, with missed-day count.
- `habitTitles` added to `WeeklyInput`; headline and proposal both resolve it, and neither
  falls back to a raw UUID.
- **Plan maths fixed**: was `Math.max(1, round(done / max(0.6, done/planned)))` — with 5
  of 10 that is `5/0.6 = 8.33` → **"plan 8 items"** for someone who finished 5, i.e. it
  *raised* the bar on a rule titled "missed the plan → propose fewer commitments". Now
  `Math.min(planned, Math.max(1, done))`.
- "routines sealed" → "goals sealed" (it was counting every goal).
- Header dates go through `prettyDate`.
- Seven `disabled` buttons → a `<div>` when `onDayClick` is absent. A disabled button is
  announced and tabbable; it claims to be interactive but locked.
- **Phase drift:** you were right. `codingSec` was being passed as "minutes on new
  material". Added `hasNewMinuteSignal?: boolean`; GoldPage sets it **false** and passes
  zeros, so the 70% rule is skipped rather than driven by a fabrication. `totalMinutesByDay`
  stays real — only the numerator was invented.
- **`habitMisses`** computed per your rule: not after today, not before the habit's own
  date, only scheduled days, not completed. Without the "not after today" clause every
  Monday would report six misses. Previously `{}`, so the entire most-skipped-habit branch
  was **dead**.

### #8 Anchor audit — FIXED
Was `useMemo` (runs **during render**, before the DOM exists — the comment claiming
"after paint" was false) over **all** tabs (so every inactive tab's anchors read as
missing). Now an effect, scoped to `requestedTab ?? tabs.default`, with a
`requestAnimationFrame` re-check because the panel is often mounted by a sibling effect in
the same commit, publishing through state.

### #9 `covenantDoneDates()` in JSX — FIXED, and your sharper point addressed
One `useMemo(() => loadCompletions(), [])`, read once, feeding both the streak and the
day-dots. `ReflectionCard` now takes `streak` as a **prop** instead of reading the store
itself — otherwise the "read once" was cosmetic. Two reads taken at different moments can
disagree, and the recap would have shown a 4-day streak beside a different 4 days of dots.

### #10 Habits twice — FIXED, and it was worse than "may show"
`HabitTracker` calls `api.getHabits(start, end)` — a **different IPC** from the `goals`
batch this page reads. So the same habits were rendering twice, in two shapes, from two
queries that could disagree. Per RESULT.md §1.3 the tracker *is* the renderer, so the
`GoalCard` list is gone. Sealed habits need no separate list: the tracker's per-day dots
already show which days were kept.

### #11 The test count — RESOLVED, and you were right to press
There is **no `test` script in `package.json`**. `vitest` is configured but not installed;
`src/__tests__/_runner.mjs` supplies `describe`/`it`/`expect` itself and runs the files
synchronously. The 177 **did** include `weeklyReview.test.ts`.

The consequence I had not appreciated: **a test file that imports from `'vitest'` cannot
run at all** under the only runner this repo has. That is why `canvasReducer.test.ts` is
dead while everything else passes. My new `goalPartition.test.ts` initially imported from
`vitest`, failed to load, and I switched it to globals — matching the working convention.
`goalPartition.test.ts` now runs.

### #12 Training's `WeeklyReview` — FOUND, RENAMED, NOT MERGED
It exists at `TrainingPage.tsx:822`, fed by `api.trainingReviewWeekly(...)`, which
computes in MAIN and caches on `weekly_reviews.week_key`, and it renders a proposal with an
**Accept** button that persists via `trainingReviewAccept`.

So RESULT.md §2's "Training's copy" is not a byte-duplicate: merging would either lose
the charts or lose the write. I applied your §0.2 rule instead — shared name is not shared
concept — and renamed it **`TrainingWeeklyReview`**, with the reasoning inline. This is the
same call as `TrainingBlockCard`. **Flagging it as a spec disagreement for you to overrule.**

---

## D1–D6

| | Your verdict | What I did |
|---|---|---|
| **D1** | ACCEPT tab-level `find`, 2 fixes | Kept `tabAliases`-era `find` on `TabSpec`. `find.root` documented as consumed. **Still open — see below.** |
| **D2** | AMEND, one classifier | Applied verbatim, plus a 36-combination test. |
| **D3a** | UNKNOWN | **Still open — see below.** |
| **D3b** | AMEND `habitMisses` + `habitTitles` | Applied. Rule implemented as you specified. |
| **D4** | ACCEPT deviation, REJECT the fix | `src/lib/covenant.ts` created; both helpers take data, do no I/O, cannot silently return 0. `covenantStreakFrom` deleted. The `try/catch` moved to the caller where it is visible. |
| **D5** | ACCEPT | `buildPrompts` stays local. |
| **D6** | REJECT the event | Dead event removed. `onManagePhases` is a prop; **the button is not rendered at all when the prop is absent**, because GoldPage also mounts standalone at `/gold` where no River exists. Widened grep: `lifePhase(Save\|SaveAll\|Delete)` → only `useLifePhases.ts` (River's hook) plus `preload.ts` channel definitions. Single writer confirmed. |

---

## Three things I am NOT claiming to have finished

1. **D1's composite `pageId` `life:gold` is still unverified.** You were right that
   `getManifest('life:gold')` returns nothing. I need REQUEST 6 (the search code) to know
   whether the page-scope filter or the result-click handler resolves that id. **This is a
   live risk and I have not closed it.**
2. **D3a is still UNKNOWN.** `TheVault`'s prop is named `todayGoals` and I fed it the
   vault bucket through an `as unknown as Goal[]` cast. I have not read `TheVault` or the
   two types, so I cannot tell you whether that cast is a real type lie. **I should not
   have left a cast in place I had not justified.**
3. **Nothing has been seen running.** `dist/` is stale; `AGENTS.md` §0-0 forbids me from
   building. Every claim above is `tsc --noEmit`, `esbuild --bundle`, grep, the
   `goalPartition` test, and `npm run validate:pages` (2 baseline errors).

## Current numbers

- **188 tests pass, 0 fail** (was 177; +11 from `goalPartition`).
- `validate:pages`: exactly 2 errors — `/time-tools`, `/agentic`. Neither Life.
- `data-sections`: 121 static. All five `life.gold.*` anchors declared **and** written (5/5).
- 14 files touched this round.

## Still owed you (REQUESTs)

REQUESTs 1–6 I can answer from the repo now; 7 is done and pasted in my message above.
**REQUEST 6 (the search code) is the one that unblocks D1, and REQUEST 4 (TheVault + types)
is the one that unblocks D3a.** Say the word and I will paste them inline.
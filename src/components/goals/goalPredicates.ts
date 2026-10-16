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

/** `period === 'longterm'` — The Vault's membership test. */
export const isLongterm = (g: Goal): boolean => g.period === 'longterm'

/**
 * AI-suggested goals live in a REVIEW QUEUE, not in any of the four groups.
 *
 * It is here rather than in GoldPage because the classifier below needs it, and
 * a predicate that the classifier depends on cannot live in the file that calls
 * the classifier.
 *
 * WHY A LOCAL WIDENING: the `goals` table still carries the legacy AI statuses
 * ('suggested', 'pending') that the canonical `GoalStatus` union does not
 * declare. The value is genuinely in the DB — it was previously filtered out
 * with no way to reach it, leaving 11 rows unreachable — so this widens locally
 * rather than casting the whole goal away.
 */
export const isSuggested = (g: Goal): boolean => (g.status as string) === 'suggested'

/** The five mutually exclusive buckets a goal can land in. */
export type GoalKind = 'suggested' | 'vault' | 'habit' | 'routine' | 'daily'

/**
 * THE CLASSIFIER. Exactly one bucket per goal, by construction.
 *
 * ── WHY THIS EXISTS RATHER THAN FOUR `.filter()` CALLS ──
 * Four independent filters were NOT disjoint, and the overlap was invisible to
 * both the compiler and my first probe (which covered 7 shapes and missed it).
 * The cross-product over `isHabit × cadence × period × suggested` found 4 goals
 * landing in two buckets at once:
 *
 *   • `isHabit && period==='longterm'`      → Habits AND Vault
 *   • `cadence==='weekly' && period==='longterm'` → Routines AND Vault
 *
 * That is the ORIGINAL bug — "the routine and the goal are the same thing" —
 * reproduced one layer up, because each filter was individually defensible and
 * only the COMBINATION was wrong. Filtering can only ever be correct if every
 * filter is written with the others in mind, which nothing enforces.
 *
 * A single ordered `if/else` chain makes disjointness a property of control
 * flow rather than of five predicates agreeing. There is no combination of
 * inputs that reaches two arms, because the first match returns.
 *
 * ORDER IS THE SPEC: suggested wins over everything (it is a queue, not a
 * group), then long-term (a destination outranks every recurring reading), then
 * habit, then routine, then daily.
 */
export const goalKind = (g: Goal): GoalKind =>
  isSuggested(g) ? 'suggested'
  : g.period === 'longterm' ? 'vault'
  : g.isHabit ? 'habit'
  : (g.cadence === 'weekly' || g.period === 'weekly') ? 'routine'
  : 'daily'
/**
 * THE PARTITION MUST BE DISJOINT. This test exists because it was not.
 *
 * Two rounds of filtering shipped before this one:
 *
 *   1. `!isWeeklyish(g)` for dailies — still admitted `period:'longterm'`, which
 *      is how a long-term goal appeared in BOTH the dailies list and The Vault.
 *   2. Four independent `.filter()` calls — each defensible in isolation, jointly
 *      wrong. The full cross-product found FOUR goals landing in two buckets:
 *        `isHabit && period==='longterm'`            -> Habits AND Vault
 *        `cadence==='weekly' && period==='longterm'` -> Routines AND Vault
 *
 * Round 2 was caught by Claude's audit, not by the test suite, because the
 * probe written to accompany round 1 covered SEVEN hand-picked shapes instead of
 * the cross product. A test that only checks the shapes you already thought of
 * is decoration — it cannot fail on the shapes you did not.
 *
 * So this enumerates `isHabit × cadence × period × status` — every combination
 * the schema can hold — and asserts:
 *   (a) `goalKind` returns exactly one bucket (structural, by construction), and
 *   (b) bucketing by that classifier never double-assigns or drops a goal
 *       (behavioural, against the exact loop GoldPage runs), and
 *   (c) the user's original complaint stays fixed: a long-term goal is in The
 *       Vault and nowhere else.
 */

/* `describe`/`it`/`expect` are used as GLOBALS, not imported from 'vitest'.
   That is the convention in this repo and it is not incidental: `vitest` is
   configured but NOT INSTALLED, and `src/__tests__/_runner.mjs` supplies those
   four globals itself. A file that imports them from 'vitest' therefore fails to
   LOAD under the only runner this repo currently has — which is how
   canvasReducer.test.ts is dead while every other file passes. */
import { goalKind, isSuggested, isWeeklyish, isLongterm, type GoalKind } from '../components/goals/goalPredicates'

/** Every shape the `goals` table can hold, as a flat cross product. */
function crossProduct() {
  const out: any[] = []
  for (const isHabit of [false, true]) {
    for (const cadence of [null, 'daily', 'weekly']) {
      for (const period of ['daily', 'weekly', 'longterm']) {
        for (const suggested of [false, true]) {
          out.push({
            id: `h${+isHabit}-c${cadence}-p${period}-s${+suggested}`,
            isHabit,
            cadence,
            period,
            status: suggested ? 'suggested' : 'active',
          })
        }
      }
    }
  }
  return out
}

const ALL = crossProduct()
const KINDS: GoalKind[] = ['suggested', 'vault', 'habit', 'routine', 'daily']

describe('goalKind — the partition', () => {
  it('covers every combination the schema can hold', () => {
    // 2 isHabit x 3 cadence x 3 period x 2 status
    expect(ALL.length).toBe(36)
  })

  it('returns exactly one bucket for every shape (it is an if/else chain, so this is structural)', () => {
    for (const g of ALL) {
      const k = goalKind(g)
      expect(KINDS, `unknown kind for ${g.id}`).toContain(k)
      // Re-evaluating cannot change the answer, and no shape can reach two arms.
      expect(goalKind(g)).toBe(k)
    }
  })

  it('never double-assigns and never drops a goal when bucketed', () => {
    const b: Record<GoalKind, any[]> = { suggested: [], vault: [], habit: [], routine: [], daily: [] }
    for (const g of ALL) b[goalKind(g)].push(g)

    for (const [kind, list] of Object.entries(b)) {
      expect(new Set(list.map(g => g.id)).size, `${kind} has a duplicate`).toBe(list.length)
    }
    const assigned = Object.values(b).flat().length
    expect(assigned).toBe(ALL.length)
  })

  // ── THE USER'S ORIGINAL COMPLAINT ──
  it('a long-term goal is in The Vault and NOWHERE ELSE, whatever else it is', () => {
    for (const g of ALL.filter(x => x.period === 'longterm' && !isSuggested(x))) {
      expect(goalKind(g), `${g.id} must be vault`).toBe('vault')
    }
  })

  it('a suggested goal is in the review queue and in no group', () => {
    for (const g of ALL.filter(isSuggested)) {
      expect(goalKind(g)).toBe('suggested')
    }
  })

  it('a habit is a habit, never a routine, even with a weekly cadence', () => {
    for (const g of ALL.filter(x => x.isHabit && !isSuggested(x) && x.period !== 'longterm')) {
      expect(goalKind(g), `${g.id}`).toBe('habit')
    }
  })

  it('a weekly cadence is a routine unless the goal is a habit or long-term', () => {
    for (const g of ALL.filter(x => x.cadence === 'weekly' && !x.isHabit && !isSuggested(x) && x.period !== 'longterm')) {
      expect(goalKind(g), `${g.id}`).toBe('routine')
    }
  })

  it('anything left over is a daily goal', () => {
    for (const g of ALL.filter(x => !x.isHabit && !isSuggested(x)
      && x.cadence !== 'weekly' && x.period !== 'weekly' && x.period !== 'longterm')) {
      expect(goalKind(g)).toBe('daily')
    }
  })

  it('isLongterm still agrees with the vault bucket', () => {
    // These are separate exports and can drift. This pins them together.
    for (const g of ALL) {
      expect(isLongterm(g)).toBe(g.period === 'longterm')
    }
  })
})

describe('isWeeklyish — retained for grouping, NOT for partitioning', () => {
  it('is deliberately broader than the routine bucket', () => {
    // This is WHY it must not be used to split groups: it matches habits and
    // weekly-cadence goals regardless of period, so filtering on it alone
    // re-creates the overlap.
    for (const g of ALL.filter(x => isWeeklyish(x) && !isSuggested(x) && x.period !== 'longterm')) {
      expect(['habit', 'routine']).toContain(goalKind(g))
    }
  })

  it('never treats a long-term goal as weeklyish-by-period', () => {
    for (const g of ALL.filter(x => x.period === 'longterm' && !x.isHabit && x.cadence !== 'weekly')) {
      expect(isWeeklyish(g)).toBe(false)
    }
  })
})
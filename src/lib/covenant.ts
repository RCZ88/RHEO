/**
 * Covenant streak and completion dates.
 *
 * ── WHY A NEW MODULE, AND WHY IT TAKES DATA ──
 * RESULT.md §3.3 put these in `src/lib/week.ts`. They do not belong there:
 * `week.ts` is pure date arithmetic, imported by main-process services that must
 * not pull in renderer storage, so it cannot import `loadCompletions`. The first
 * implementation papered over that with `covenantStreakFrom(read)`, whose
 * try/catch returned 0 — which converts a broken store into "streak: 0", a
 * plausible lie rendered with total confidence. That is worse than a crash.
 *
 * So both helpers here take `completions` as an ARGUMENT. They do no I/O, so
 * they cannot fail silently, and the page that owns the data owns the failure:
 *
 *   const completions = useMemo(() => {
 *     try { return loadCompletions() } catch { return [] }
 *   }, [])
 *
 * The `try/catch` moves to the CALLER, where it is visible, and where an empty
 * read is a decision rather than a swallowed exception.
 */

export interface CompletionDate {
  date: string
}

/**
 * Consecutive days with a completion, counting back from today.
 *
 * If today is not yet logged the count falls back to yesterday, so the streak is
 * not reported as broken at 9am — the same rule the three copies of this
 * function disagreed about, which is why there is one now.
 */
export function covenantStreak(completions: CompletionDate[], today: string, step: (d: string, n: number) => string): number {
  const set = new Set(completions.map(c => c.date))
  if (set.size === 0) return 0
  let cursor = today
  if (!set.has(cursor)) cursor = step(cursor, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = step(cursor, -1)
  }
  return streak
}

/**
 * The set of dates carrying a completion — the day-dots in the weekly recap.
 *
 * Derived from the SAME array the streak uses, so the two cannot disagree.
 */
export function covenantDoneDates(completions: CompletionDate[]): Set<string> {
  return new Set(completions.map(c => c.date))
}
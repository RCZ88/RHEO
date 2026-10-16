/**
 * Week arithmetic — ONE implementation, Monday-anchored.
 *
 * WHY THIS FILE EXISTS. The repo had three incompatible week anchors:
 *
 *   • `mondayOf()` in HabitsPage.tsx and SchedulePage.tsx — Monday
 *   • `currentWeekStart.setDate(getDate())` in App.tsx:2049 — SUNDAY
 *   • `weekStart()` / period keys like `2026-W42` in services/insights/engine.ts
 *     — ISO-8601, which is also Monday
 *
 * Two of the three agree and one does not, which means a Sunday-anchored "this
 * week" disagrees with a Monday-anchored one for the whole weekend. Any weekly
 * score, weekly review or "days active this week" number is wrong for two days
 * out of seven unless one anchor wins. Monday wins here, deliberately: CZ's
 * weekly review lands on Sunday and covers Monday→Sunday, so the training week
 * is Mon–Sun, not Sun–Sat.
 *
 * ── THE CLOCK RULE, which is the actual trap in this file ──
 * A `Date` built with the LOCAL constructor and read with `toISOString()` is
 * wrong for seven hours a day at UTC+7: `new Date(2026, 9, 5)` in that zone is
 * `2026-10-04T17:00Z`, so `toISOString().slice(0,10)` yields the 4th for a date
 * that is the 5th locally. The reverse trap is worse and silent: SQLite's
 * `datetime('now')` produces UTC with no zone marker, so `new Date('2026-10-06
 * 09:43:48')` parses that string as LOCAL time. Both mistakes shipped here
 * before — `monthEnd` in the Insights page reported September's 30th as the
 * 29th, and a 24h cache stretched to 31h.
 *
 * So: every parse and every format in this file goes through the same local
 * clock, and `toISOString()` appears exactly once, in a comment explaining why
 * it must not be used.
 */

/** Local `YYYY-MM-DD`. Never use `toISOString()` for this — see the clock rule. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today, local. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/**
 * Parse `YYYY-MM-DD` into a LOCAL midnight Date.
 *
 * `new Date('2026-10-06')` is specified by ECMAScript to parse as UTC midnight,
 * which in any negative-offset zone is the previous local day. Appending
 * `T00:00:00` forces the local-time branch instead.
 */
export function parseDateStr(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || '').trim());
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Add (or subtract) days, crossing month and year boundaries. */
export function addDaysStr(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Whole days from today to `dateStr`. Negative = past. `null` if unparseable. */
export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const a = parseDateStr(todayStr()).getTime();
  const b = parseDateStr(dateStr).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** The Monday of the week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const d = parseDateStr(dateStr);
  const offset = (d.getDay() + 6) % 7; // Sunday(0) → 6, Monday(1) → 0
  return addDaysStr(dateStr, -offset);
}

/** All seven days of the week containing `dateStr`, Monday first. */
export function weekDays(dateStr: string): string[] {
  const mon = mondayOf(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysStr(mon, i));
}

/**
 * ISO-8601 week key, e.g. `2026-W42`. Matches the format
 * `services/insights/engine.ts` already stores in `rewind_cache.period_key`, so
 * this can read existing cache rows rather than invalidating them.
 */
export function isoWeekKey(dateStr: string): string {
  // ISO weeks start Monday, and week 1 is the week containing the first
  // Thursday of the year — which is why this cannot be a simple day-of-year
  // division. The trick: shift to the Thursday of this week, then the calendar
  // year of that Thursday IS the ISO year.
  const d = parseDateStr(dateStr);
  const target = new Date(d);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Inverse of `isoWeekKey`: the Monday and Sunday of that ISO week. */
export function isoWeekBounds(weekKey: string): { start: string; end: string } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(weekKey || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  // Jan 4 is always in ISO week 1.
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const start = new Date(week1Monday);
  start.setDate(week1Monday.getDate() + (week - 1) * 7);
  return { start: toDateStr(start), end: toDateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)) };
}

/** "Mon", "Tue", … for display. */
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Single letters for a dense week rail. */
export const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * How many DISTINCT days of the week containing `dateStr` appear in `dates`.
 * This is the primitive behind the weekly score: 5 of 7 is a win.
 *
 * Iterates the week's own day set and probes a Set of the input, rather than
 * iterating the input — so a repeated date counts once. That matters because a
 * score must not be inflatable: a duplicated completion row would otherwise
 * read as two active days. `habit_completions` has UNIQUE(habit_id, date), but
 * this is a reporting primitive and reporting code should not depend on an
 * unrelated table's constraint to be correct.
 */
export function daysActiveInWeek(dateStr: string, dates: Iterable<string>): number {
  const inWeek = new Set(weekDays(dateStr));
  const seen = new Set<string>();
  for (const d of dates) seen.add(d);
  let n = 0;
  for (const d of inWeek) if (seen.has(d)) n += 1;
  return n;
}

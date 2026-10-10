/**
 * rewindPeriod — the single source of truth for rewind period arithmetic.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Three separate defects came out of the rewind showing "October" on the 1st of
 * October, and all three are the same class of bug: **two different clocks, or
 * two different owners, wearing the same label.**
 *
 * 1. `RewindPlayer` asked for the CURRENT month. A rewind is a RETROSPECTIVE.
 *    On Oct 1 the current month is 1 day old and mostly empty, so the player
 *    opened on an almost-blank recap. The default is now the previous month.
 *
 * 2. `monthEnd()` in the insights engine mixed clocks: it built the date with
 *    the LOCAL `Date` constructor and then read it back with `toISOString()`
 *    (UTC). On this box (UTC+7) that turned September's last day into the
 *    29th, so the September rewind covered 29 of 30 days. **Every function here
 *    parses and formats with LOCAL calendar fields.** `toISOString()` is banned
 *    for day arithmetic — see `localDay`.
 *
 * 3. `InsightsPage` labelled the card with `format(new Date(), 'MMMM')` while
 *    the player requested a period computed somewhere else entirely. Two
 *    formaters for one period. There is now exactly one: `monthLabel`.
 *
 * Everything is module scope and pure. `InsightsPage` and `RewindPlayer` both
 * import from here, so they cannot drift.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Format a Date as 'YYYY-MM-DD' from its LOCAL calendar fields.
 *
 * Do not replace this with `toISOString().slice(0, 10)`. That is UTC, so every
 * local day before 07:00 (or 08:00 under DST) formats as the PREVIOUS day —
 * which is how the "today" insight silently described yesterday for seven hours
 * a day, and how a month's last day went missing entirely.
 */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse 'YYYY-MM-DD' as LOCAL midnight (not UTC midnight). */
export function parseLocalDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Today, in local time. */
export function localToday(now: Date = new Date()): string {
  return localDay(now);
}

/** `n` days before today, in local time. */
export function localDaysAgo(n: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - n);
  return localDay(d);
}

/** 'YYYY-MM' for the month containing `date`. */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** A month key `delta` months from `key` (negative = earlier). */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  // Day 0 of month m+1+delta IS the last day of month m+delta, and using day 0
  // makes the arithmetic total: no special-casing December.
  const shifted = new Date(y, m - 1 + delta + 1, 0);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The month to open a rewind on: the last month that has actually happened.
 *
 * On 6 Oct this is `2026-09`. On 31 Dec it is `2026-12`; on 1 Jan it is
 * `2026-01` — i.e. `2025-12`. `shiftMonth` with -1 handles the year boundary.
 */
export function defaultRewindMonthKey(now: Date = new Date()): string {
  return shiftMonth(monthKeyOf(now), -1);
}

/** First and last LOCAL day of a 'YYYY-MM' month. */
export function periodBounds(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  return {
    start: localDay(new Date(y, m - 1, 1)),
    end: localDay(new Date(y, m, 0)),
  };
}

/** Number of days in a 'YYYY-MM' month. */
export function daysInMonth(key: string): number {
  const { start, end } = periodBounds(key);
  return Math.round(
    (parseLocalDay(end).getTime() - parseLocalDay(start).getTime()) / 86_400_000,
  ) + 1;
}

/**
 * Has this month finished? A rewind over a finished month is immutable, so its
 * cache can live forever; the current month must stay live.
 */
export function isMonthComplete(key: string, now: Date = new Date()): boolean {
  const { end } = periodBounds(key);
  return end < localDay(now);
}

/** 'September 2026' — the ONLY formatter for a rewind period label. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** 'Sep 2026' — for tight spaces like the player header. */
export function monthLabelShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

/** 'September' on its own — for a headline where the year is already implied. */
export function monthName(key: string): string {
  const m = Number(key.split('-')[1]);
  return MONTH_NAMES[m - 1];
}

/**
 * The label a rewind card should advertise.
 *
 * A finished month is named plainly. The CURRENT month is called out as
 * in-progress rather than presented as a completed recap — the difference
 * between "your September" and "October so far" is the difference between a
 * retrospective and a lie.
 */
export function rewindCardLabel(key: string, now: Date = new Date()): string {
  return isMonthComplete(key, now) ? monthName(key) : `${monthName(key)} so far`;
}


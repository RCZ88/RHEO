/**
 * weeklyScore — feature 4, "make failure cheap".
 *
 * ── THE DESIGN DECISION ──
 * CZ: "Most trackers die from the 'broken streak' feeling. Use a weekly score,
 * like 5 out of 7 days counts as a win. Add a 'minimum day' setting: on bad days,
 * one 20-minute task still keeps the habit alive."
 *
 * So the unit is deliberately the WEEK, not the day. A streak measures the most
 * recent run, which means a single missed day reports the same number as total
 * collapse: 0. That is a catastrophic loss of information presented as a single
 * integer, and it is precisely what makes people delete the app.
 *
 * Here, a 4/7 week that misses the bar still READS AS 4. The score degrades
 * smoothly. There is no state in which a bad week is indistinguishable from a
 * abandoned one.
 *
 * ── WHY TWO COUNTS AND NOT ONE ──
 * `countedDays` and `qualifiedDays` answer different questions and the UI needs
 * both, because they encode the minimum-day rule:
 *   · a 10-minute day COUNTS (the habit is alive — that is the whole promise)
 *   · but it is visibly flagged as a minimum day, not a full one
 * Collapsing them would either make minimum days invisible (defeating the rule)
 * or make them feel like failures (defeating the rule's purpose).
 */

import { weekDays, daysActiveInWeek } from '../lib/week';

export const DEFAULT_MINIMUM_MINUTES = 20;
export const DEFAULT_WEEKLY_WIN_DAYS = 5;

export interface DayMark {
  date: string;
  /** Minutes logged on that day. 0 = nothing. */
  minutes: number;
  /** Did that day meet the minimum? Stored at write time, see below. */
  metMinimum: boolean;
}

export interface WeeklyScore {
  weekOf: string;
  days: string[];
  /** Days with any completion at all — THE score. */
  counted: number;
  /** Days that also met the minimum. */
  qualified: number;
  /** Minimum of `counted` needed for a win. */
  target: number;
  isWin: boolean;
  /**
   * 0..1 toward the target, CLAMPED at 1.
   *
   * Clamping matters: an uncapped 7/7 would read as 1.4 and make the progress
   * ring overflow its track on exactly the weeks the user wants to look at.
   * Exceeding the target is a win, not a score of 140%.
   */
  ratio: number;
  /** Minutes per counted day — the quality half of the week. */
  avgMinutes: number;
  minimumMinutes: number;
  /**
   * The single worst thing about the week, or null when it was clean.
   * Used by the weekly review to answer "what went wrong", and deliberately
   * ONE item: a review that lists three problems gets fixed zero.
   */
  weakest: { date: string; reason: string } | null;
}

export interface WeeklyScoreOptions {
  /** Overrides the persisted setting. */
  minimumMinutes?: number;
  /** Days needed to win. Default 5. */
  winDays?: number;
}

export function computeWeeklyScore(weekOf: string, marks: DayMark[], opts: WeeklyScoreOptions = {}): WeeklyScore {
  const days = weekDays(weekOf);
  const minimumMinutes = Number.isFinite(opts.minimumMinutes) && (opts.minimumMinutes as number) > 0
    ? (opts.minimumMinutes as number)
    : DEFAULT_MINIMUM_MINUTES;
  const target = Number.isFinite(opts.winDays) && (opts.winDays as number) > 0
    ? Math.min(7, opts.winDays as number)
    : DEFAULT_WEEKLY_WIN_DAYS;

  const byDate = new Map(marks.map((m) => [m.date, m]));
  const countedDates = days.filter((d) => byDate.has(d));
  const qualifiedDates = days.filter((d) => {
    const m = byDate.get(d);
    if (!m) return false;
    // Prefer the stored flag; fall back to recomputing so a row written before
    // `met_minimum` existed still scores correctly instead of reading as failed.
    return m.metMinimum ?? (m.minutes >= minimumMinutes);
  });

  const counted = daysActiveInWeek(weekOf, countedDates);
  const qualified = daysActiveInWeek(weekOf, qualifiedDates);
  const totalMinutes = countedDates.reduce((sum, d) => sum + (byDate.get(d)?.minutes ?? 0), 0);

  // The weakest day: prefer a genuinely missed day (nothing logged), because
  // "you did 8 minutes on Tuesday" is a much weaker piece of feedback than
  // "Tuesday was empty", and a review that cannot tell them apart is useless.
  const missed = days.filter((d) => !byDate.has(d));
  const thin = days.filter((d) => {
    const m = byDate.get(d);
    return m && !qualifiedDates.includes(d) && m.minutes > 0;
  });
  let weakest: WeeklyScore['weakest'] = null;
  if (missed.length) weakest = { date: missed[missed.length - 1], reason: 'Nothing logged' };
  else if (thin.length) weakest = { date: thin[0], reason: 'Below the minimum day' };

  return {
    weekOf,
    days,
    counted,
    qualified,
    target,
    isWin: counted >= target,
    ratio: Math.min(1, counted / target),
    avgMinutes: counted ? Math.round(totalMinutes / counted) : 0,
    minimumMinutes,
    weakest,
  };
}

/**
 * The headline sentence for the week card.
 *
 * Written as a sentence rather than a number because the number alone carries
 * the failure framing the feature exists to remove. "4 of 5 days" reads as
 * nearly-there; "4/7" reads as a failing grade. Same information, different
 * emotional register — and that difference is the feature.
 */
export function describeWeeklyScore(s: WeeklyScore): string {
  if (s.counted === 0) return 'No days logged this week. One 20-minute task is enough to start.';
  if (s.isWin) {
    const over = s.counted - s.target;
    return over > 0
      ? `${s.counted} of ${s.target} days — a clear week.`
      : `${s.counted} of ${s.target} days — exactly enough.`;
  }
  const short = s.target - s.counted;
  return `${s.counted} of ${s.target} days. ${short === 1 ? 'One more day' : `${short} more days`} and this week is a win.`;
}

/**
 * The streak a tracker would have shown, kept ONLY so the review can name it as
 * the thing being replaced. Never rendered as a score.
 *
 * `streakOnMiss` comes from the goal's `completion_config` and was, until Wave 0,
 * never written by any IPC — so every goal silently read `reset`. It is read here
 * for the first time.
 */
export type StreakOnMiss = 'reset' | 'continue' | 'pause';

export function currentStreak(
  markedDates: Iterable<string>,
  today: string,
  onMiss: StreakOnMiss = 'reset',
): { current: number; justReset: boolean } {
  const set = new Set(markedDates);
  const LOOKBACK_DAYS = 365;
  const runFrom = (start: string): number => {
    let n = 0;
    let cursor = start;
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      if (!set.has(cursor)) break;          // a gap STOPS a strict run
      n += 1;
      const next = shiftBack(cursor, 1);
      if (next === cursor) break;          // malformed date, never loop forever
      cursor = next;
    }
    return n;
  };

  // ── The three modes must ACTUALLY DIFFER, and the old code did not. ──
  // Walking back to "the nearest marked day" and then counting contiguously
  // makes `continue` behave identically to `reset`, so the one setting whose
  // entire purpose is "a gap must not cost me everything" was the one that
  // still reported the harsh answer. That is the worst possible place for the
  // bug, because a user who opts into forgiveness is explicitly saying the
  // harsh number is not what they want to see.
  //
  //   reset    strict consecutive run          03,04,05        -> 3
  //   continue gaps do not break it at all    03,04,[05],06    -> 4
  //   pause    gaps ≤3 days pass, longer breaks            03,[04..06],07 -> 1
  if (onMiss === 'reset') {
    // Today being unfinished is not a miss — every streak implementation gets
    // this wrong and it is why streaks feel hostile at 9am.
    const cursor = set.has(today) ? today : shiftBack(today, 1);
    return { current: runFrom(cursor), justReset: !set.has(today) && runFrom(cursor) === 0 };
  }

  if (onMiss === 'continue') {
    let n = 0;
    let cursor = today;
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      if (set.has(cursor)) n += 1;
      const next = shiftBack(cursor, 1);
      if (next === cursor) break;
      cursor = next;
    }
    return { current: n, justReset: false };
  }

  // pause — a short slip is tolerated, a longer one breaks the block.
  let n = 0;
  let cursor = today;
  let missRun = 0;
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    if (set.has(cursor)) { n += 1; missRun = 0; }
    else if (++missRun > 3) break;
    const next = shiftBack(cursor, 1);
    if (next === cursor) break;
    cursor = next;
  }
  return { current: n, justReset: false };
}

function shiftBack(dateStr: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return dateStr;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
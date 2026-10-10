/**
 * SLEEP WINDOW — pure time math, shared by the renderer AND the main process.
 *
 * There were three unrelated bedtime definitions in this codebase and none of
 * them was configurable:
 *
 *   main.ts SLEEP_HOUR_START / SLEEP_HOUR_END   21:00 → 10:59   (live)
 *   main.ts checkMorningPrompt `wasSleepTime`   22:00 → 03:59   (live, conflicts)
 *   App.tsx                                    (none — the AFK prompt ignored bedtime)
 *
 * The live one was also wrong at its edges, which is the bug this file exists
 * to kill. The old gate was `h >= 21 || h <= 10`, tested on each gap ENDPOINT:
 *
 *   1. `h <= 10` swallows the whole 10 o'clock hour, so a 10:15am coffee break
 *      was inside "sleep hours" and raised the sleep popup in broad daylight.
 *   2. Requiring only that an ENDPOINT be in-window means a 20:00 → 21:30 gap
 *      passes while overlapping bedtime by ZERO minutes.
 *   3. The window was 14 hours wide, so almost any evening or morning gap
 *      qualified and the AFK prompt — the correct prompt for a coffee run —
 *      never got a turn.
 *
 * So the sleep popup fired for absences that were not sleep at all, while the
 * setting that was supposed to control it did not exist.
 *
 * The honest question is not "is an endpoint in bedtime hours", it is "how much
 * of this gap actually overlaps bedtime". `sleepWindowOverlapMs` answers that.
 *
 * PURE BY CONTRACT: no `window`, no `localStorage`, no `require`, no Electron.
 * That is the entire reason this file is separate from `src/lib/sleepWindow.ts`
 * (which owns persistence) — so `main.ts` can import it, the renderer can
 * import it, and a plain `node` probe can exercise it with no harness at all.
 */

export const MIN_SLEEP_OVERLAP_MINUTES = 45;

/**
 * How much of an absence must fall in bedtime before the AFK prompt stands
 * down. Deliberately much lower than the sleep prompt's bar: a 12-minute gap
 * at 23:30 is a trip to the bathroom, not something to ask about, but it is far
 * too short to claim as sleep.
 */
export const AFK_DEFER_TO_SLEEP_MINUTES = 10;

export const SLEEP_HOUR_MIN = 0;
export const SLEEP_HOUR_MAX = 23;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const MAX_WINDOW_DAYS = 32;

export function clampHour(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const h = Math.round(n);
  if (h < SLEEP_HOUR_MIN || h > SLEEP_HOUR_MAX) return fallback;
  return h;
}

export function formatHour(hour: number): string {
  return `${String(clampHour(hour, 0)).padStart(2, '0')}:00`;
}

export function describeSleepWindow(startHour: number, endHour: number): string {
  const s = formatHour(startHour);
  const e = formatHour(endHour);
  const start = clampHour(startHour, 0);
  const end = clampHour(endHour, 0);
  return start > end ? `${s} → ${e} overnight` : `${s} → ${e}`;
}

/**
 * Is this hour-of-day inside the window? Handles the wrap past midnight, so
 * 22 → 7 matches 22,23,0,1,2,3,4,5,6 and excludes 7. A zero-length window
 * (start === end) matches nothing — "I never sleep" is a real answer here and
 * it must not silently become "always asleep".
 */
export function hourInSleepWindow(hour: number, startHour: number, endHour: number): boolean {
  const h = clampHour(hour, 0);
  const s = clampHour(startHour, 0);
  const e = clampHour(endHour, 0);
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/** Local-time window occurrences that could intersect `[fromMs, toMs]`. */
function windowOccurrences(
  startHour: number,
  endHour: number,
  fromMs: number,
  toMs: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const s = clampHour(startHour, 0);
  const e = clampHour(endHour, 0);
  if (s === e) return out;

  // Begin at the PREVIOUS local midnight, not this one: an overnight window
  // that began the night before still covers the early hours of the gap's
  // first day, and a 02:00 → 06:00 gap would otherwise find no occurrence.
  const cursor = new Date(fromMs);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < MAX_WINDOW_DAYS; i++) {
    const day = new Date(cursor.getTime());
    day.setDate(day.getDate() + i);
    const midnight = day.getTime();
    if (midnight > toMs) break;
    const startMs = midnight + s * HOUR_MS;
    const endMs = s > e ? midnight + (24 + e) * HOUR_MS : midnight + e * HOUR_MS;
    out.push([startMs, endMs]);
  }
  return out;
}

/**
 * Total milliseconds of `[gapStart, gapEnd]` that fall inside the sleep window,
 * summed across every day the gap spans.
 */
export function sleepWindowOverlapMs(
  startHour: number,
  endHour: number,
  gapStart: number,
  gapEnd: number,
): number {
  if (!Number.isFinite(gapStart) || !Number.isFinite(gapEnd)) return 0;
  if (gapEnd <= gapStart) return 0;

  let total = 0;
  // Consecutive occurrences never overlap each other, so summing is safe.
  for (const [ws, we] of windowOccurrences(startHour, endHour, gapStart, gapEnd)) {
    const from = Math.max(gapStart, ws);
    const to = Math.min(gapEnd, we);
    if (to > from) total += to - from;
  }
  return total;
}

export function sleepWindowOverlapMinutes(
  startHour: number,
  endHour: number,
  gapStart: number,
  gapEnd: number,
): number {
  return Math.floor(sleepWindowOverlapMs(startHour, endHour, gapStart, gapEnd) / MINUTE_MS);
}

export type GapVerdict = 'sleep' | 'afk';

export interface GapClassification {
  verdict: GapVerdict;
  /** Minutes of the gap that genuinely fell inside the sleep window. */
  overlapMinutes: number;
  gapMinutes: number;
}

/**
 * THE rule both paths were missing: a gap is only sleep if it genuinely
 * overlaps bedtime. Everything else — a lunch break, a coffee run, a meeting, a
 * crash-and-reboot at 3pm — is AFK, and the AFK prompt is the right thing to
 * show for it.
 */
export function classifyGap(
  startHour: number,
  endHour: number,
  gapStart: number,
  gapEnd: number,
  minOverlapMinutes: number = MIN_SLEEP_OVERLAP_MINUTES,
): GapClassification {
  const overlapMinutes = sleepWindowOverlapMinutes(startHour, endHour, gapStart, gapEnd);
  const gapMinutes = Math.max(0, Math.round((gapEnd - gapStart) / MINUTE_MS));
  return {
    verdict: overlapMinutes >= minOverlapMinutes ? 'sleep' : 'afk',
    overlapMinutes,
    gapMinutes,
  };
}

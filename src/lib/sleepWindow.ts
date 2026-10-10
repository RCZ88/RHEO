// ============================================================
// SLEEP WINDOW — the setting, and the one place that answers
// "is this absence sleep, or just AFK?"
// ============================================================
//
// `src/shared/sleepWindow.ts` owns the arithmetic. This file owns persistence and
// the renderer-side convenience wrappers, and it mirrors the user's hours across
// the process boundary — because the gap classifier that actually raises the
// sleep popup runs in `main.ts`, which cannot see localStorage. Before this
// existed, main hardcoded 21:00 → 10:59 while the renderer knew nothing, which
// is why nothing you did in Settings could change the sleep prompt.
//
// The AFK threshold lives in `src/lib/afk.ts`. These two files are deliberately
// siblings: "how long until AFK" and "when does AFK become sleep" are one
// decision, and they were previously decided in three places that disagreed.
// ============================================================

import {
  AFK_DEFER_TO_SLEEP_MINUTES,
  MIN_SLEEP_OVERLAP_MINUTES,
  clampHour,
  classifyGap,
  describeSleepWindow,
  formatHour,
  hourInSleepWindow,
  sleepWindowOverlapMs,
} from '../shared/sleepWindow';

const STORAGE_KEY = 'deskflow-sleep-window';

export interface SleepWindowPrefs {
  /** Master switch. Off = every absence is AFK, never a sleep prompt. */
  enabled: boolean;
  /** Hour of day sleep begins, inclusive, 0–23. */
  startHour: number;
  /** Hour of day sleep ends, exclusive, 0–23. Wraps past midnight when start > end. */
  endHour: number;
}

export const SLEEP_WINDOW_DEFAULTS: SleepWindowPrefs = {
  enabled: true,
  startHour: 22,
  endHour: 7,
};

export const SLEEP_WINDOW_CHANGED_EVENT = 'sleep-window-changed';

/** The windows people actually pick. Anything else is reachable by typing. */
export const COMMON_SLEEP_WINDOWS: { startHour: number; endHour: number; label: string }[] = [
  { startHour: 21, endHour: 6, label: '9pm – 6am' },
  { startHour: 22, endHour: 7, label: '10pm – 7am' },
  { startHour: 23, endHour: 7, label: '11pm – 7am' },
  { startHour: 23, endHour: 8, label: '11pm – 8am' },
  { startHour: 0, endHour: 8, label: 'midnight – 8am' },
];

export { MIN_SLEEP_OVERLAP_MINUTES, AFK_DEFER_TO_SLEEP_MINUTES, formatHour, describeSleepWindow };

function normalize(p: unknown): SleepWindowPrefs {
  if (typeof p !== 'object' || p === null) return { ...SLEEP_WINDOW_DEFAULTS };
  const raw = p as Partial<SleepWindowPrefs>;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : SLEEP_WINDOW_DEFAULTS.enabled,
    startHour: clampHour(raw.startHour, SLEEP_WINDOW_DEFAULTS.startHour),
    endHour: clampHour(raw.endHour, SLEEP_WINDOW_DEFAULTS.endHour),
  };
}

export function getSleepWindow(): SleepWindowPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...SLEEP_WINDOW_DEFAULTS };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...SLEEP_WINDOW_DEFAULTS };
  }
}

export function setSleepWindow(patch: Partial<SleepWindowPrefs>): SleepWindowPrefs {
  const next = normalize({ ...getSleepWindow(), ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the in-memory value still drives this session */
  }

  // Mirror into userPreferences so `main.ts` classifies gaps with the SAME
  // hours the user just picked. Fire-and-forget: main cannot see localStorage,
  // so without this the sleep popup keeps using the hardcoded window no matter
  // what Settings says.
  try {
    const api = (window as any).deskflowAPI;
    if (api?.setPreference) {
      Promise.resolve(api.setPreference('sleepWindowStartHour', next.startHour)).catch(() => {});
      Promise.resolve(api.setPreference('sleepWindowEndHour', next.endHour)).catch(() => {});
      Promise.resolve(api.setPreference('sleepWindowEnabled', next.enabled)).catch(() => {});
    }
  } catch {
    /* not fatal */
  }

  try {
    window.dispatchEvent(new CustomEvent(SLEEP_WINDOW_CHANGED_EVENT, { detail: next }));
  } catch {
    /* non-fatal */
  }
  return next;
}

function classify(gapStart: number, gapEnd: number, minOverlapMinutes: number) {
  const p = getSleepWindow();
  // A disabled window is not "match nothing by accident" — it is an explicit
  // "never classify anything as sleep", so the overlap is forced to zero rather
  // than left to whatever hours happen to be stored.
  return p.enabled
    ? classifyGap(p.startHour, p.endHour, gapStart, gapEnd, minOverlapMinutes)
    : { verdict: 'afk' as const, overlapMinutes: 0, gapMinutes: Math.max(0, Math.round((gapEnd - gapStart) / 60_000)) };
}

/**
 * Should the sleep popup be allowed to claim this gap? This is the gate that was
 * missing entirely: previously a gap qualified if either endpoint sat in
 * hardcoded bedtime hours, so a 10:15am coffee break raised it.
 */
export function isSleepGap(gapStart: number, gapEnd: number): boolean {
  return classify(gapStart, gapEnd, MIN_SLEEP_OVERLAP_MINUTES).verdict === 'sleep';
}

/**
 * How long an absence must be before the AFK prompt will stand down for it.
 *
 * Three hours is the floor because the stand-down is only safe when the sleep
 * popup is genuinely going to appear: that flow is raised by specific
 * main-process events (screen resume, window focus, poll-gap) which reliably
 * fire for an overnight but not for a 90-minute gap. Anything shorter always
 * asks, because an un-asked question is far worse than a duplicate one.
 */
export const AFK_DEFERS_MIN_HOURS = 3;

/**
 * How much of a long absence may fall OUTSIDE bedtime before the AFK prompt
 * stops deferring. Waking up later than your stated wake hour is normal and the
 * sleep popup already records that latency, so 90 minutes of "I was still in
 * bed" must not turn a night into a question.
 *
 * Note this is a bound on the EXCEPTION, not a substitute for the length test —
 * a 2-hour evening absence also has under 90 minutes of daytime in it, which is
 * exactly why `AFK_DEFERS_MIN_HOURS` is required as well. Length first, then
 * how much of it was awake time.
 */
export const AFK_AWAKE_GRACE_MINUTES = 90;

/**
 * Should the AFK prompt stand down because the sleep flow owns this absence?
 *
 * Requires BOTH: the absence is at least `AFK_DEFERS_MIN_HOURS` long, AND at
 * most `AFK_AWAKE_GRACE_MINUTES` of it fell outside the configured bedtime.
 *
 * The previous rule was "overlaps bedtime by ≥10 minutes", which looked
 * reasonable and was catastrophically wrong: a 2-hour absence from 21:30 to
 * 23:30 overlaps a 22:00→07:00 window by 90 minutes, so it deferred — and since
 * the sleep popup is only raised by specific main-process events (resume, window
 * focus, poll-gap) which did not fire, the user got NO PROMPT AT ALL.
 */
export function shouldDeferToSleep(gapStart: number, gapEnd: number): boolean {
  const p = getSleepWindow();
  if (!p.enabled) return false;
  const gapMs = gapEnd - gapStart;
  if (!Number.isFinite(gapMs) || gapMs <= 0) return false;
  if (gapMs < AFK_DEFERS_MIN_HOURS * 3_600_000) return false;

  const overlapMs = sleepWindowOverlapMs(p.startHour, p.endHour, gapStart, gapEnd);
  const awakeMs = gapMs - overlapMs;
  return awakeMs <= AFK_AWAKE_GRACE_MINUTES * 60_000;
}

export function describeActiveWindow(p: SleepWindowPrefs = getSleepWindow()): string {
  return p.enabled ? describeSleepWindow(p.startHour, p.endHour) : 'off';
}

/**
 * Is this instant inside the user's configured bedtime?
 *
 * Added because three places had each hardcoded their own hours:
 * `main.ts` (21:00), `checkMorningPrompt` (22:00–03:00) and — the last holdout —
 * the renderer's foreground return path in `App.tsx`, which was still testing
 * `hour >= 21 || hour < 10` while the rest of the app honoured the setting. That
 * is precisely the "I changed the setting and nothing happened" shape: a user who
 * set 01:00 → 09:00 still got the night-time behaviour on return at 23:00.
 */
export function isWithinSleepWindow(timestamp: number, p: SleepWindowPrefs = getSleepWindow()): boolean {
  if (!p.enabled) return false;
  return hourInSleepWindow(new Date(timestamp).getHours(), p.startHour, p.endHour);
}

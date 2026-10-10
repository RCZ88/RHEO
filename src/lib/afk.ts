// ============================================================
// AFK BEHAVIOUR — one threshold, one action, adjustable
// ============================================================
//
// There were THREE unrelated idle thresholds in the codebase, none of them in
// Settings and none of them agreeing:
//
//   src/lib/stopwatchStore.ts   5 min, hardcoded  — stops the stopwatch counting
//   src/App.tsx                 5 min, component state, never persisted
//   src/main.ts                 10 min, hardcoded — pauses OS-level tracking
//
// So "how long is AFK" had no single answer, and there was no way to change it
// without editing source. This module is the one place that answers it.
//
// WHAT HAPPENS ON AFK is a choice, because the right answer differs by person:
//   pause-only       stop counting, keep what you have        (default)
//   reset-stopwatch  also zero the current productive/distracting timers
//   reset-streak     also reset the streak counter
//   reset-both       both of the above
//
// The threshold is deliberately a SYSTEM idle time (OS-level input), not a
// "no mouse movement in this window" timer: a timer keeps counting while you
// read a long article or watch a video, which is exactly the false positive
// that makes people distrust a tracker.
// ============================================================

const STORAGE_KEY = 'deskflow-afk-prefs';

export type AfkAction = 'pause-only' | 'reset-stopwatch' | 'reset-streak' | 'reset-both';

export interface AfkPrefs {
  /** Idle minutes before AFK behaviour kicks in. */
  thresholdMinutes: number;
  action: AfkAction;
  /** Master switch. Off = never cut, whatever the threshold. */
  enabled: boolean;
  /**
   * Absences shorter than this are discarded silently instead of prompting.
   * Hardcoded to 60s in App.tsx until now, so there was no way to stop a
   * coffee-cup bump from opening a dialog.
   */
  minPromptSeconds: number;
  /**
   * Absences up to this many minutes open with "I wasn't AFK" pre-selected.
   * Hardcoded to 15 in App.tsx.
   */
  notAfkBelowMinutes: number;
  /**
   * Categories where being idle is the POINT — watching a film, playing a game.
   * Hardcoded to Entertainment + Gaming in App.tsx.
   */
  passiveCategories: string[];
  /**
   * A new absence must persist this long before it counts as "away".
   *
   * The threshold is a single crossing, but real use is noisy: you brush the
   * trackpad, glance at another window, come back. Requiring the absence to
   * HOLD before anything happens means those never interrupt you. Raising the
   * threshold alone does not help, because the moment you move the mouse the
   * absence is over — the two knobs solve different halves of the problem.
   */
  holdSeconds: number;
}

/** THE default AFK threshold. Five minutes of no input before AFK is even
 *  considered — anything shorter is not an absence, it is a coffee cup, and
 *  prompting for it is what made people stop trusting the prompt.
 *  Asserted by agent/probes/afk-prefs.probe.ts so it cannot silently drift. */
export const AFK_DEFAULT_THRESHOLD_MINUTES = 5;

export const AFK_DEFAULTS: AfkPrefs = {
  thresholdMinutes: AFK_DEFAULT_THRESHOLD_MINUTES,
  action: 'pause-only',
  enabled: true,
  minPromptSeconds: 60,
  notAfkBelowMinutes: 15,
  passiveCategories: ['Entertainment', 'Gaming'],
  holdSeconds: 90,
};

/**
 * Mirrors `DEFAULT_CATEGORIES` in src/main.ts:313.
 *
 * Duplicated rather than imported because that array lives in the main process
 * and this is a renderer module. If you change one, change the other —
 * `clampCategories` filters against this list, so a category missing here is
 * silently dropped from the user's saved value. That is exactly how 'Gaming'
 * disappeared the first time round.
 */
export const ALL_CATEGORIES = [
  'IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication',
  'Design', 'Productivity', 'Tools', 'Education', 'Developer Tools',
  'Search Engine', 'News', 'Shopping', 'Social Media', 'Gaming',
  'Uncategorized', 'Other',
] as const;

export const AFK_MIN_HOLD_SECONDS = 0;
export const AFK_MAX_HOLD_SECONDS = 600;
export const AFK_MIN_PROMPT_SECONDS = 0;
export const AFK_MAX_PROMPT_SECONDS = 600;
export const AFK_MIN_NOT_AFK_MINUTES = 1;
export const AFK_MAX_NOT_AFK_MINUTES = 120;

export const AFK_MIN_MINUTES = 1;
export const AFK_MAX_MINUTES = 60;

export const AFK_PRESETS = [1, 2, 5, 10, 15, 30, 60];

export const AFK_ACTIONS: { value: AfkAction; label: string; hint: string }[] = [
  { value: 'pause-only', label: 'Pause only', hint: 'Stop counting. Keep the timer and streak as they are.' },
  { value: 'reset-stopwatch', label: 'Reset stopwatch', hint: 'Stop counting and zero the current timers.' },
  { value: 'reset-streak', label: 'Reset streak', hint: 'Stop counting and clear the streak counter.' },
  { value: 'reset-both', label: 'Reset both', hint: 'Stop counting, zero the timers and clear the streak.' },
];

function clampMinutes(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return AFK_DEFAULTS.thresholdMinutes;
  return Math.min(AFK_MAX_MINUTES, Math.max(AFK_MIN_MINUTES, Math.round(n)));
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampCategories(v: unknown): string[] {
  if (!Array.isArray(v)) return [...AFK_DEFAULTS.passiveCategories];
  const known = new Set<string>(ALL_CATEGORIES);
  const out = v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && known.has(x));
  // De-dupe so a hand-edited localStorage value can't produce duplicate chips.
  return Array.from(new Set(out));
}

/**
 * One normaliser for both read and write.
 *
 * `setAfkPrefs` used to inline its own clamping while `getAfkPrefs` had a
 * separate copy — and the first attempt at this function called a `normalize`
 * that did not exist, which is a ReferenceError on EVERY settings write. It
 * passed `esbuild`, because esbuild only strips types and never resolves an
 * identifier. Keep exactly one implementation.
 */
function normalize(p: unknown): AfkPrefs {
  if (typeof p !== 'object' || p === null) return { ...AFK_DEFAULTS };
  const r = p as Partial<AfkPrefs>;
  return {
    thresholdMinutes: clampMinutes(r.thresholdMinutes),
    action: AFK_ACTIONS.some(a => a.value === r.action) ? (r.action as AfkAction) : AFK_DEFAULTS.action,
    enabled: typeof r.enabled === 'boolean' ? r.enabled : AFK_DEFAULTS.enabled,
    // Absent keys fall back to the previous hardcoded values, so a prefs blob
    // written by an older build keeps working and gains the new keys on write.
    minPromptSeconds: clampInt(
      r.minPromptSeconds, AFK_MIN_PROMPT_SECONDS, AFK_MAX_PROMPT_SECONDS,
      AFK_DEFAULTS.minPromptSeconds,
    ),
    notAfkBelowMinutes: clampInt(
      r.notAfkBelowMinutes, AFK_MIN_NOT_AFK_MINUTES, AFK_MAX_NOT_AFK_MINUTES,
      AFK_DEFAULTS.notAfkBelowMinutes,
    ),
    passiveCategories: clampCategories(r.passiveCategories),
    holdSeconds: clampInt(r.holdSeconds, AFK_MIN_HOLD_SECONDS, AFK_MAX_HOLD_SECONDS, AFK_DEFAULTS.holdSeconds),
  };
}

/**
 * Has an absence lasted long enough to be worth interrupting about?
 * Evaluated continuously by the detector, so a single brush of the mouse resets
 * it rather than latching a decision made from one bad sample.
 */
export function absenceHasHeld(seconds: number, prefs: AfkPrefs = getAfkPrefs()): boolean {
  return seconds >= prefs.holdSeconds;
}

export function getAfkPrefs(): AfkPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...AFK_DEFAULTS };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...AFK_DEFAULTS };
  }
}

export function setAfkPrefs(patch: Partial<AfkPrefs>): AfkPrefs {
  const next = normalize({ ...getAfkPrefs(), ...patch });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }

  // Mirror into userPreferences so the MAIN process can read it too. It cannot see
  // localStorage, and it had its own inline `300` (5 min) in the sleep-gap guard,
  // which meant AFK had two different definitions across the process boundary.
  // Fire-and-forget: a failure here must never block the local update.
  try {
    const api = (window as any).deskflowAPI;
    if (api?.setPreference) {
      Promise.resolve(api.setPreference('afkThresholdMinutes', next.enabled ? next.thresholdMinutes : 0))
        .catch(() => { /* main-side mirror is best-effort */ });
    }
  } catch { /* not fatal */ }

  try { window.dispatchEvent(new CustomEvent('afk-prefs-changed', { detail: next })); } catch { /* non-fatal */ }
  return next;
}

/** Convenience for the places that only want milliseconds. */
export function afkThresholdMs(prefs: AfkPrefs = getAfkPrefs()): number {
  return prefs.enabled ? prefs.thresholdMinutes * 60_000 : Infinity;
}

/**
 * Should this absence raise the "While you were away" prompt at all?
 *
 * Was three separate `if`s in App.tsx with three hardcoded numbers. Centralised
 * so the Settings controls and the detector cannot drift apart again.
 */
export function shouldPromptForAbsence(
  elapsedSeconds: number,
  prefs: AfkPrefs = getAfkPrefs(),
): boolean {
  return prefs.enabled && elapsedSeconds >= prefs.minPromptSeconds;
}

/** Does the current category mean "idle is expected"? Then never call it AFK. */
export function isPassiveCategory(category: string | null | undefined, prefs: AfkPrefs = getAfkPrefs()): boolean {
  if (!category) return false;
  return prefs.passiveCategories.includes(category);
}

/** Open with "I wasn't AFK" already selected for short absences. */
export function defaultsToNotAfk(elapsedSeconds: number, prefs: AfkPrefs = getAfkPrefs()): boolean {
  return elapsedSeconds <= prefs.notAfkBelowMinutes * 60;
}

/**
 * Fired once per AFK transition, not once per tick, so a reset cannot repeat
 * every second while the user is away.
 */
export const AFK_TRIPPED_EVENT = 'afk-tripped';

export function notifyAfkTripped(): void {
  try { window.dispatchEvent(new CustomEvent(AFK_TRIPPED_EVENT, { detail: getAfkPrefs() })); } catch { /* non-fatal */ }
}

/** Convenience for the places that only want milliseconds. */
export function shouldResetStopwatch(prefs: AfkPrefs = getAfkPrefs()): boolean {
  return prefs.action === 'reset-stopwatch' || prefs.action === 'reset-both';
}

export function shouldResetStreak(prefs: AfkPrefs = getAfkPrefs()): boolean {
  return prefs.action === 'reset-streak' || prefs.action === 'reset-both';
}

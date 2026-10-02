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
}

export const AFK_DEFAULTS: AfkPrefs = {
  thresholdMinutes: 5,
  action: 'pause-only',
  enabled: true,
};

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

export function getAfkPrefs(): AfkPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...AFK_DEFAULTS };
    const p = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return { ...AFK_DEFAULTS };
    const action = AFK_ACTIONS.some(a => a.value === (p as AfkPrefs).action)
      ? (p as AfkPrefs).action
      : AFK_DEFAULTS.action;
    return {
      thresholdMinutes: clampMinutes((p as AfkPrefs).thresholdMinutes),
      action,
      enabled: typeof (p as AfkPrefs).enabled === 'boolean' ? (p as AfkPrefs).enabled : AFK_DEFAULTS.enabled,
    };
  } catch {
    return { ...AFK_DEFAULTS };
  }
}

export function setAfkPrefs(patch: Partial<AfkPrefs>): AfkPrefs {
  const next = { ...getAfkPrefs(), ...patch };
  next.thresholdMinutes = clampMinutes(next.thresholdMinutes);
  next.enabled = !!next.enabled;
  if (!AFK_ACTIONS.some(a => a.value === next.action)) next.action = AFK_DEFAULTS.action;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent('afk-prefs-changed', { detail: next })); } catch { /* non-fatal */ }
  return next;
}

/** Convenience for the places that only want milliseconds. */
export function afkThresholdMs(prefs: AfkPrefs = getAfkPrefs()): number {
  return prefs.enabled ? prefs.thresholdMinutes * 60_000 : Infinity;
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

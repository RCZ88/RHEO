/**
 * Halo notice model — the DECISION half of HALO_FIT ranks 6-8.
 *
 * `notice` is the island's transient voice (drift / break due / break over /
 * resume note / capture ack / reset recap). The slot model owns WHERE a notice
 * shows (toast lane, priorityForKind); this module owns WHETHER one should be
 * raised right now, as PURE functions of (state, now) — no React, no IPC, no
 * Date.now() — so every firing rule is probe-able with printed numbers, exactly
 * like slotModel.ts.
 *
 * The honesty rule (RESULT.md §5) applies to every rule here: a notice is a
 * measurement the island actually took, never a number invented for the pill.
 * Each rule returns `null` (raise nothing) whenever its condition does not
 * genuinely hold.
 */

import type { NoticePayload } from './types';

/** A raised notice: the payload plus how long the spec says it holds the pill. */
export interface NoticeEvent {
  payload: NoticePayload;
  durationMs: number;
}

/* ── Spec'd constants (island-feature-fit RESULT §4) ───────────────────────── */
export const NOTICE_HOLD = {
  /** N4 drift toast: 8 s. */
  driftMs: 8_000,
  /** N2 break-due nudge: 8 s, and it repeats at most once per interval. */
  breakDueMs: 8_000,
  /** N2 "Break over": 4 s. */
  breakOverMs: 4_000,
  /** N5 resume note: 8 s. */
  resumeMs: 8_000,
  /** N3 capture ack: 3 s. */
  captureAckMs: 3_000,
  /** N6 reset recap: 4 s. */
  recapMs: 4_000,
} as const;

/** N4 default: after 3 minutes continuously distracting. Setting later. */
export const DRIFT_AFTER_MS = 3 * 60_000;
/** N2 default: the due nudge repeats once per 90 minutes of continuous activity. */
export const BREAK_DUE_INTERVAL_MS = 90 * 60_000;

/* ── Formatting ────────────────────────────────────────────────────────────── */

/** The mono streak numeral. Under a minute the notice does not fire at all, so
 * this never has to render seconds: "4m", "1h 52m", "2h". */
export function formatStreak(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ── N4 — the drift notice ─────────────────────────────────────────────────── */

export interface DriftState {
  /** The foreground tier reading (the one that tints the ambient edge). */
  tier: string | null;
  /** How long THAT tier has held continuously (the island's tierSince clock). */
  streakMs: number;
  /** A focus session is active — the session's own lock is speaking, so the
   * drift toast stays silent rather than talking over the countdown. */
  sessionActive: boolean;
  /** The user is away — nobody is drifting if nobody is looking. */
  away: boolean;
  /** The streak-start ms the drift toast was last raised for (0 = never). */
  shownForSinceMs: number;
  /** The streak-start ms of the CURRENT tier streak (0 = unknown). */
  sinceMs: number;
}

/** Raise `[TrendingDown][Drifting][Nm]` once per continuous distracting streak.
 * `null` until the streak crosses DRIFT_AFTER_MS, then once — the returned
 * `shownForSinceMs` marks the streak so a second call does not re-fire. */
export function driftNotice(s: DriftState, holdMs = NOTICE_HOLD.driftMs): { notice: NoticeEvent; shownForSinceMs: number } | null {
  if (s.tier !== 'distracting') return null;
  if (s.sessionActive || s.away) return null;
  if (s.sinceMs <= 0 || s.streakMs < DRIFT_AFTER_MS) return null;
  if (s.shownForSinceMs === s.sinceMs) return null;
  const minutes = Math.floor(s.streakMs / 60_000);
  return {
    notice: {
      payload: { icon: 'trend', label: 'Drifting', mono: `${minutes}m`, tone: 'warn' },
      durationMs: holdMs,
    },
    shownForSinceMs: s.sinceMs,
  };
}

/* ── N2 — the break-due nudge ──────────────────────────────────────────────── */

export interface BreakDueState {
  /** Epoch ms of the last genuine rest: the end of an away gap or the end (or
   * start) of a taken break. 0 = unknown → the nudge stays silent until the
   * island has measured one. */
  lastRestAtMs: number;
  /** Epoch ms the due nudge last fired (0 = never). */
  lastNudgeAtMs: number;
  /** A break is running right now — resting, not drifting toward due. */
  breakLive: boolean;
  away: boolean;
}

/** Raise `[Coffee][Break due][1h 52m]` after BREAK_DUE_INTERVAL_MS of continuous
 * activity, and again each interval while it lasts. A live break or an away gap
 * both RESET the clock by construction (the caller moves lastRestAtMs), so this
 * rule only ever reads a positive stretch. */
export function breakDueNotice(s: BreakDueState, t: number, holdMs = NOTICE_HOLD.breakDueMs): { notice: NoticeEvent; lastNudgeAtMs: number } | null {
  if (s.breakLive || s.away) return null;
  if (s.lastRestAtMs <= 0) return null;
  const sinceRest = t - s.lastRestAtMs;
  if (sinceRest < BREAK_DUE_INTERVAL_MS) return null;
  /* The once-per-interval gate: also true on the very first fire (lastNudgeAtMs 0). */
  if (s.lastNudgeAtMs > 0 && t - s.lastNudgeAtMs < BREAK_DUE_INTERVAL_MS) return null;
  return {
    notice: {
      payload: { icon: 'coffee', label: 'Break due', mono: formatStreak(sinceRest), tone: 'dim' },
      durationMs: holdMs,
    },
    lastNudgeAtMs: t,
  };
}

/* ── N2 — "Break over" ─────────────────────────────────────────────────────── */

/** The promise's end is a moment the pill should mark: the previous tick had a
 * live window, this one does not, and the window ended NATURALLY (now, not by
 * the user ending it early — the caller passes `endedEarly`). */
export function breakOverNotice(endedEarly: boolean, holdMs = NOTICE_HOLD.breakOverMs): NoticeEvent | null {
  if (endedEarly) return null;
  return { payload: { icon: 'coffee', label: 'Break over', tone: 'dim' }, durationMs: holdMs };
}

/* ── N6 — the reset recap ──────────────────────────────────────────────────── */

export interface TierBuckets {
  productiveMs: number;
  neutralMs: number;
  distractingMs: number;
}

export interface RecapState {
  /** resetCount from the CACHED previous snapshot. */
  prevResetCount: number;
  /** resetCount from the current snapshot. */
  nextResetCount: number;
  /** The cached PREVIOUS buckets — the reset closes a block; the block it
   * closes is the one the PREVIOUS snapshot was measuring. */
  prev: TierBuckets | null;
}

/** `[Check][42m · 80% productive]` — fires when resetCount genuinely bumps and
 * the cached block was real (measurable, non-zero, finite). Guards:
 *  - equal counts → not a reset, nothing to recap;
 *  - no cached buckets (first snapshot after mount) → nothing to recap;
 *  - a zero total → the "reset" closed an empty block; recapping "0m · 0%"
 *    would be a number dressed as a fact. */
export function recapNotice(s: RecapState, holdMs = NOTICE_HOLD.recapMs): NoticeEvent | null {
  if (s.nextResetCount <= s.prevResetCount) return null;
  if (!s.prev) return null;
  const { productiveMs, neutralMs, distractingMs } = s.prev;
  if (![productiveMs, neutralMs, distractingMs].every((v) => Number.isFinite(v) && v >= 0)) return null;
  const total = productiveMs + neutralMs + distractingMs;
  if (total <= 0) return null;
  const productiveMin = Math.round(productiveMs / 60_000);
  const pct = Math.round((productiveMs / total) * 100);
  return {
    payload: { icon: 'check', label: `${productiveMin}m · ${pct}% productive`, tone: 'ok' },
    durationMs: holdMs,
  };
}

/* ── N5 — the resume note ──────────────────────────────────────────────────── */

/** `[NotebookPen][your own words]` at the return moment. The island shows the
 * note ONCE (the caller clears the pref after showing) — the moment it exists
 * for is the moment you come back. Presenter mode masks the text; the caller
 * handles that at render so the stored note survives the toggle. */
export function resumeNotice(text: string, holdMs = NOTICE_HOLD.resumeMs): NoticeEvent | null {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return null;
  return { payload: { icon: 'note', label: trimmed, tone: 'dim' }, durationMs: holdMs };
}

/* ── N3 — the capture ack ──────────────────────────────────────────────────── */

export function captureAckNotice(resume: boolean, holdMs = NOTICE_HOLD.captureAckMs): NoticeEvent {
  return {
    payload: { icon: 'check', label: resume ? 'Saved · pick up here' : 'Saved to Life', tone: 'ok' },
    durationMs: holdMs,
  };
}

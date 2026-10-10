import type { Rect } from './types';

/**
 * HALO §50 hover intent.
 *
 * This is a pure function on purpose. HALO §46 requires the MAIN process to own
 * hover intent — a click-through window cannot be trusted to deliver a renderer
 * mouseleave — which means it must be pollable from a cursor sample and therefore
 * testable without a window. HALO §151 lists the nine cases it has to satisfy;
 * `agent/probes/halo-core.probe.mts` asserts all nine.
 */
export interface HoverConfig {
  openDelayMs: number;
  closeDelayMs: number;
  leaveMarginPx: number;
}

/** HALO §48 starting values. */
export const DEFAULT_HOVER_CONFIG: HoverConfig = {
  openDelayMs: 110,
  closeDelayMs: 280,
  leaveMarginPx: 24,
};

export interface HoverState {
  hovered: boolean;
  /** 0 when the cursor is inside; otherwise the exit timestamp. */
  outsideSince: number;
  /** 0 when no open intent is pending; otherwise the entry timestamp. */
  intentSince: number;
  inside: boolean;
  pinned: boolean;
}

export type HoverIntent = 'open' | 'close' | 'none';

export interface HoverInput {
  now: number;
  /** Cursor is within the hot zone or the island body. */
  inside: boolean;
  pinned: boolean;
}

export function initialHoverState(): HoverState {
  return { hovered: false, outsideSince: 0, intentSince: 0, inside: false, pinned: false };
}

function rectContains(r: Rect, x: number, y: number, margin = 0): boolean {
  return (
    x >= r.x - margin &&
    x <= r.x + r.width + margin &&
    y >= r.y - margin &&
    y <= r.y + r.height + margin
  );
}

export function pointInHotZone(hotZone: Rect, x: number, y: number, margin = 0): boolean {
  return rectContains(hotZone, x, y, margin);
}

/**
 * Advances the hover machine by one poll tick and reports the resulting intent.
 *
 * Note what this does NOT do: it never resizes anything and never reads layout.
 * It only converts a cursor sample into an open/close intention.
 */
export type HoverTriggerMode = 'hover' | 'click' | 'hotkey' | 'hover-or-click';

/**
 * WHY THE TRIGGER MODE LIVES IN THE MACHINE, NOT ONLY AT THE CALL SITE
 * -----------------------------------------------------------------
 * The poll loop in `haloIsland.ts` could gate `inside` to false for a click-only island and
 * that would appear to work — until it didn't: the timer would still run, the cursor would
 * still cross a zone that does nothing, and nothing would say "this island does not open on
 * hover". Deciding it here means the state machine enforces it, so every caller gets it
 * right and the probe can assert it with no window at all.
 */
export function stepHover(
  prev: HoverState,
  input: HoverInput,
  config: HoverConfig = DEFAULT_HOVER_CONFIG,
  mode: HoverTriggerMode = 'hover',
): { state: HoverState; intent: HoverIntent } {
  const { now, pinned } = input;

  // Pinning overrides ordinary cursor-based collapse (HALO §51). `inside` is forced true
  // rather than passed through: a pinned island is open BY DESIGN and must stay open with
  // the pointer anywhere — including nowhere near it. Echoing the real cursor position here
  // would make `inside` flap and the expanded chrome would flicker with it.
  if (pinned) {
    return {
      state: { hovered: true, outsideSince: 0, intentSince: 0, inside: true, pinned: true },
      intent: prev.pinned ? 'none' : 'open',
    };
  }

  // A click-only or hotkey-only island has no hover channel at all. Falling through to a
  // clean "not hovered" state (rather than returning early) keeps every machine invariant
  // intact — notably that it never reports itself hovered when it was never open, which is
  // the stuck-hover failure HALO §216 lists as release-blocking.
  const hoverEnabled = mode === 'hover' || mode === 'hover-or-click';
  const inside = hoverEnabled ? input.inside : false;

  if (inside) {
    // HALO §50 sets hovered the moment the cursor is in the zone; `hovered`
    // therefore means "cursor is inside", NOT "the surface is open". The open
    // decision is carried separately by the returned intent, which only fires
    // once the open delay has matured.
    const intentSince = prev.inside ? prev.intentSince : now;
    const matured = now - intentSince >= config.openDelayMs;
    return {
      state: { hovered: true, outsideSince: 0, intentSince, inside: true, pinned: false },
      intent: matured ? 'open' : 'none',
    };
  }

  // There is nothing to close when the surface was never open. Without this gate
  // a cursor that starts outside begins an exit timestamp on its very first
  // sample and the machine reports itself hovered indefinitely — HALO §216 lists
  // "stuck hover state" as a release-blocking failure.
  if (!prev.hovered) {
    return {
      state: { hovered: false, outsideSince: 0, intentSince: 0, inside: false, pinned: false },
      intent: 'none',
    };
  }

  // First exit starts the grace period; the surface does NOT close immediately.
  const outsideSince = prev.outsideSince > 0 ? prev.outsideSince : now;
  const graceElapsed = now - outsideSince >= config.closeDelayMs;

  if (graceElapsed) {
    return {
      state: { hovered: false, outsideSince, intentSince: 0, inside: false, pinned: false },
      intent: 'close',
    };
  }

  // Crossing filter (HALO §48): an intent that never matured is cancelled when the
  // cursor contradicts it, so a brush past the zone does not open the island.
  return {
    state: {
      hovered: true,
      outsideSince,
      intentSince: prev.outsideSince > 0 ? 0 : prev.intentSince,
      inside: false,
      pinned: false,
    },
    intent: 'none',
  };
}

/** HALO §47 poll rates. Hover detection is not an animation clock. */
export const HOVER_POLL_IDLE_MS = 120;
export const HOVER_POLL_EXPANDED_MS = 40;
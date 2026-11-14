import type { ActivityKind, IslandActivity } from './types';

/**
 * HALO §5 priority table, with two deliberate deviations, both argued below.
 *
 * This table decides only ONE thing: which activity gets the surface when
 * several are eligible. It does NOT decide what the island is "about" — that is
 * the hero policy below. Conflating the two is how a notification system turns
 * into a dashboard.
 */
export const PRIORITY = {
  pinnedUserInteraction: 1000,
  criticalError: 900,
  directUserFeedback: 800,
  recording: 750,
  breakPromise: 700,
  focusCountdown: 600,
  nextBlock: 550,
  stopwatchRunning: 500,
  afkGap: 450,
  nowApp: 350,
  pinnedActivity: 300,
  tierBreakdown: 250,
  nextDeadline: 200,
  clock: 100,
} as const;

/** Which activity owns the expanded surface when nothing louder is happening. */
export const HERO_KIND: ActivityKind = 'stopwatch';

export function priorityForKind(kind: ActivityKind): number {
  switch (kind) {
    case 'critical':
      return PRIORITY.criticalError;
    case 'hud':
      // RESULT.md promotes `hud` as an ambient rail card ("CONSOLE"), so it ranks with the
      // ambient tier rather than the interrupt tier. The old mapping gave it
      // criticalError, which pushed it above `critical` itself in the toast lane.
      return PRIORITY.tierBreakdown;
    case 'dictation':
      return PRIORITY.recording;
    case 'focus':
      return PRIORITY.focusCountdown;
    case 'break':
      // Rank 3 in HALO_FIT's queue — just below dictation (750, the live microphone)
      // and above the imminent class (550). A promise you made to yourself outranks
      // upcoming context but must never steal the pill from a live recording.
      return PRIORITY.breakPromise;
    case 'notice':
      // HALO_FIT ranks 6-8 (drift / break due / acks + resume + recap), all toast-lane.
      // The spec splits them across three ranks, but they share ONE transient slot and
      // can never coexist — each replaces the previous — so the split would order
      // things that are never simultaneously present. They sit in the unused
      // directUserFeedback band: below critical (900, the only higher toast) and above
      // every live state, because a toast the queue chose to raise has already won
      // that comparison by existing at all.
      return PRIORITY.directUserFeedback;
      // DEVIATION 3 — 550, between focus (600) and the running stopwatch (500).
      // "Your class starts in 8 minutes" outranks the accumulating stopwatch
      // precisely because the stopwatch does not interrupt anything (see
      // DEVIATION 2 below) while a block start is a real upcoming boundary.
      // It still loses to a live focus countdown, which the user started on
      // purpose. Documented deviation, not a silent new band.
      return PRIORITY.nextBlock;
    case 'external':
      // The external session is the resident COMPANION: it only ever drives the
      // pill while the stopwatch clock itself is sourced from it
      // (displaySource === 'external'), so in the general priority table it
      // ranks as ambient context — same band as the app-derived 'now'.
      return PRIORITY.nowApp;
    case 'stopwatch':
      return PRIORITY.stopwatchRunning;
    case 'afkGap':
      return PRIORITY.afkGap;
    case 'now':
      return PRIORITY.nowApp;
    case 'pinnedActivity':
      return PRIORITY.pinnedActivity;
    case 'tierBreakdown':
      return PRIORITY.tierBreakdown;
    case 'nextDeadline':
      return PRIORITY.nextDeadline;
    case 'clock':
      return PRIORITY.clock;
    default:
      return PRIORITY.clock;
  }
}

/**
 * DEVIATION 1 — recording sits at 750, above HALO §5's `system_hud: 700`.
 *
 * Justification: the generic HUD tier assumes a volume change, which is
 * self-evidently transient and may be interrupted. Dictation is a live
 * microphone the user is speaking into; interrupting it mid-utterance loses
 * their words. So it outranks the HUD band.
 *
 * DEVIATION 2 — stopwatch sits at 500, NOT above focus.
 *
 * The stopwatch is the hero (see HERO_KIND) but it is `persistent`, so it never
 * competes for the surface at all: it is always eligible and never expires.
 * Priority is an interruption policy, and a stopwatch does not interrupt anything
 * — it accumulates. Expressed as a high priority it would wrongly interrupt a
 * focus countdown every second that it ticked.
 */
export function isPersistentKind(kind: ActivityKind): boolean {
  return (
    kind === 'stopwatch' ||
    kind === 'focus' ||
    kind === 'clock' ||
    kind === 'now' ||
    kind === 'tierBreakdown' ||
    kind === 'pinnedActivity' ||
    kind === 'nextDeadline'
  );
}

/**
 * HALO §6: a burst of updates to the same logical thing (volume 52, 53, 54...)
 * must remain ONE activity, never four queued notifications. Publishers get
 * these helpers so the stable id is constructed in exactly one place — a random
 * uuid per tick is the single most common way this subsystem breaks.
 */
export function stableId(kind: ActivityKind, discriminator = 'default'): string {
  return `${kind}:${discriminator}`;
}

export function byPriorityThenAge(
  a: IslandActivity,
  b: IslandActivity,
): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.createdAt - b.createdAt;
}
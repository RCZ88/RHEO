/**
 * srs — the spaced-repetition queue. CZ: "every solved problem comes back at 3
 * and 10 days. This matters more for your plan than any other feature."
 *
 * ── WHY OWN SCHEDULING INSTEAD OF `ts-fsrs` ──
 * The repo already has a correct FSRS implementation (`learn_cards` +
 * `learn_card_reviews`, `ts-fsrs`, with a proper derived-state + event-log
 * split). Reusing the *library* was rejected for a specific reason: FSRS
 * schedules from a self-assessed rating on recall, which needs the material in
 * front of you. CZ's queue is the opposite — a problem you already solved, which
 * is *coming back to you* unprompted. That is a fixed-interval re-read, not a
 * recall test, so the free-running difficulty/stability model would be fitting
 * parameters to a process that isn't happening.
 *
 * What IS copied is the convention, which is the genuinely good part: the queue
 * row is derived state, and every scheduling decision is ALSO appended to an
 * immutable log, so the whole schedule can be rebuilt from scratch if the
 * heuristic is ever replaced.
 *
 * ── WHY 3 AND 10 DAYS ──
 * Day 3 catches a solution that was remembered rather than derived — you still
 * half-know it. Day 10 catches the ones that only worked with the editor open.
 * Those are the two failures worth spending a re-read on, so they get fixed
 * slots. After those, the interval grows 2.5x per successful recall with a cap,
 * which is deliberately gentle: this is a background queue, and a queue you
 * dread is one you stop opening.
 */

export const FIRST_INTERVAL_DAYS = 3;
export const SECOND_INTERVAL_DAYS = 10;
/** 180 days ≈ one term. Past that the problem is archive material, not a rep. */
export const MAX_INTERVAL_DAYS = 180;
export const INTERVAL_GROWTH = 2.5;

export interface SrsCard {
  id: string;
  pattern: string;
  title: string;
  /** YYYY-MM-DD, or null = new, never scheduled. */
  due: string | null;
  /** How many successful recalls. Drives the growth curve. */
  reps: number;
  /** How many times it was re-shown and still not recalled. */
  lapses: number;
  /** The interval that produced the current `due` date, in days. */
  scheduledDays: number;
}

export type Rating = 'recalled' | 'partial' | 'forgotten';

export interface SrsDecision {
  due: string;
  scheduledDays: number;
  /** What to show in the UI. Kept separate from the maths so copy can be tuned. */
  label: 'Day 3 · first re-read' | 'Day 10 · second re-read' | 'Review' | 'Archived';
  /** If lapses grew, the queue should say so rather than silently re-scheduling. */
  weakened: boolean;
}

/**
 * Pure day arithmetic on `YYYY-MM-DD`, local clock, never `toISOString()`.
 * See `src/lib/week.ts` for why that is a hard rule in this repo.
 */
function addDays(dateStr: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return dateStr;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  const pa = /^(\d{4})-(\d{2})-(\d{2})/.exec(a || '');
  const pb = /^(\d{4})-(\d{2})-(\d{2})/.exec(b || '');
  if (!pa || !pb) return 0;
  const da = new Date(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3])).getTime();
  const db = new Date(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3])).getTime();
  return Math.round((db - da) / 86_400_000);
}

/**
 * Decide when a card comes back. `today` is a REQUIRED argument for the same
 * reason `nowMinutes` is on the capture parser: a scheduler that reads the
 * ambient clock cannot be tested and cannot be re-run for a past date.
 */
export function scheduleCard(card: SrsCard, rating: Rating, today: string): SrsDecision {
  const reps = card.reps || 0;
  const lapses = card.lapses || 0;

  if (rating === 'forgotten') {
    // A lapse does NOT reset to day 3. That would punish the queue and teach the
    // user to ignore it. It goes back a third of the way, which is still soon
    // enough to matter and far enough to be worth reading.
    const back = Math.max(1, Math.round((card.scheduledDays || FIRST_INTERVAL_DAYS) / 3));
    return {
      due: addDays(today, back),
      scheduledDays: back,
      label: 'Review',
      weakened: lapses + 1 >= 3,
    };
  }

  if (reps === 0) {
    return {
      due: addDays(today, FIRST_INTERVAL_DAYS),
      scheduledDays: FIRST_INTERVAL_DAYS,
      label: 'Day 3 · first re-read',
      weakened: false,
    };
  }

  if (reps === 1) {
    return {
      due: addDays(today, SECOND_INTERVAL_DAYS),
      scheduledDays: SECOND_INTERVAL_DAYS,
      label: 'Day 10 · second re-read',
      weakened: lapses >= 3,
    };
  }

  const next = rating === 'partial'
    // A partial recall grows, but slower. If it grew at the same rate the queue
    // would promote problems you are visibly not holding.
    ? Math.max(SECOND_INTERVAL_DAYS, Math.round(card.scheduledDays * 1.6))
    : Math.min(MAX_INTERVAL_DAYS, Math.round((card.scheduledDays || SECOND_INTERVAL_DAYS) * INTERVAL_GROWTH));

  return {
    due: addDays(today, next),
    scheduledDays: next,
    label: next >= MAX_INTERVAL_DAYS ? 'Archived' : 'Review',
    weakened: lapses >= 3,
  };
}

/** The next N days a card is expected back, for the UI's "due in 3 days" hint. */
export function nextDueHint(due: string | null, today: string): string {
  if (!due) return 'New';
  const n = daysBetween(today, due);
  if (n <= 0) return 'Due now';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return `In ${n} days`;
  if (n < 14) return 'Next week';
  return `In ${Math.round(n / 7)} weeks`;
}

/**
 * Cards that are actually due now.
 *
 * New cards (`due === null`) sort FIRST, on purpose: the user's own words about
 * what makes a review plan work are that opening a queue and finding nothing in
 * it is how you stop opening it. A queue of due items is always worth opening.
 *
 * `limit` is a hard cap rather than pagination because this renders in one
 * panel and the repo's convention for dense lists is a render cap
 * (`TerminalPage:4894`, `main.ts:22415`).
 */
export function dueCards(cards: SrsCard[], today: string, limit = 20): SrsCard[] {
  return cards
    .filter((c) => !c.due || daysBetween(today, c.due) <= 0)
    .sort((a, b) => {
      // 0 sorts before 1. A card with a due date is 0, a NEW card (due === null)
      // is 1 — which puts new cards LAST. That is backwards: the stated goal is
      // "a queue you open must never look empty", and burying every new card
      // under the due ones guarantees an empty-looking queue on day one.
      const an = a.due ? 1 : 0;
      const bn = b.due ? 1 : 0;
      if (an !== bn) return an - bn;                 // new cards first
      // `an !== bn` guarantees both are null or neither, but TS cannot infer
      // that through the boolean, so `b.due` was still `string | null` here.
      // Hoist and narrow rather than reaching for `!`: an assertion would hide a
      // genuine one-sided-null case instead of making it impossible.
      const aDue = a.due, bDue = b.due;
      if (!aDue || !bDue) return 0;
      return daysBetween(bDue, aDue);                 // then most-overdue first
    })
    .slice(0, limit);
}
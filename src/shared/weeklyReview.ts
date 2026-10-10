/**
 * weeklyReview — feature 6. "Every Sunday it shows planned vs done, the one
 * habit you skipped most, and one proposed change for next week. One change
 * only. Too many changes means none happen."
 *
 * ── WHY EXACTLY ONE PROPOSAL ──
 * CZ is right and this is the load-bearing constraint. A review that lists five
 * suggestions has an effective adoption rate of zero, because choosing among
 * five costs more than the week saved. The output is therefore a SINGLE
 * proposal with a single accept button — and if there is genuinely nothing to
 * propose, it says so rather than inventing a suggestion to fill the shape.
 *
 * An empty review is a real, useful review: "5 of 5 days, nothing to change" is
 * information. A padded one is worse than nothing, because it spends trust.
 *
 * ── WHY IT IS COMPUTED IN MAIN, NOT THE RENDERER ──
 * The week spans seven days of goals, completions, deadlines, schedule blocks
 * and review-queue rows. Deriving that in a React render would be seven serial
 * IPC round trips per repaint. It is computed once, cached on `week_key`, and
 * the renderer just reads a row — the repo's `DatabasePage` precedent, whose
 * comment records that the old per-row fan-out was ~206 serial hops.
 */

import { weekDays, isoWeekKey } from '../lib/week';

export interface WeeklyInput {
  weekOf: string;
  /** Goals planned for the week, by date. */
  planned: Array<{ id: string; title: string; date: string; done: boolean; isHabit: boolean }>;
  /** Habit ids with at least one day logged in the week. */
  habitIdsTracked: string[];
  /** Habit id → dates it was NOT logged, within the week. */
  habitMisses: Record<string, string[]>;
  /** Minutes of new-topic work per day, aligned to the week. */
  newMinutesByDay: number[];
  /** Total minutes per day, aligned to the week. */
  totalMinutesByDay: number[];
  /** Cards due during the week that were never reviewed. */
  queueMissed: number;
  /** Existing accepted proposal for this week, so it is not regenerated. */
  acceptedProposal?: string | null;
}

export interface WeeklyReview {
  weekKey: string;
  start: string;
  end: string;
  planned: number;
  done: number;
  /** 0..1, clamped. Rendered as a bar, never as a grade. */
  ratio: number;
  /** The single habit skipped most. Null when every tracked habit was touched. */
  mostSkippedHabit: { id: string; missedDays: number } | null;
  /** Exactly ONE change. Never an array — see the note at the top. */
  proposal: { text: string; why: string } | null;
  /** True when there is genuinely nothing to say. Shown, not hidden. */
  allClear: boolean;
  headline: string;
}

export function buildWeeklyReview(input: WeeklyInput): WeeklyReview {
  const days = weekDays(input.weekOf);
  const start = days[0];
  const end = days[6];

  // DEFENSIVE DEFAULTS ON EVERY COLLECTION. This function is fed straight from
  // SQL, so "the caller forgot a field" is a realistic event, not a theoretical
  // one — and a missing optional column should cost you one insight, not crash
  // the whole Sunday review. The earlier version called `.reduce()` on
  // `newMinutesByDay` unguarded, so omitting it threw before anything rendered.
  const plannedRows = input.planned ?? [];
  const newMinByDay = input.newMinutesByDay ?? [];
  const totalMinByDay = input.totalMinutesByDay ?? [];
  const misses = input.habitMisses ?? {};
  const queueMissed = Number.isFinite(input.queueMissed) ? input.queueMissed : 0;

  const planned = plannedRows.length;
  const done = plannedRows.filter((g) => g.done).length;

  // Most-skipped habit: misses, not completions. Counting completions would
  // always pick the most-frequent habit rather than the most-neglected one,
  // which is the opposite of what the review is for. Ties break toward the
  // habit with more missed days in the recent half of the week.
  let mostSkipped: WeeklyReview['mostSkippedHabit'] = null;
  for (const id of Object.keys(misses)) {
    const missedDays = (misses[id] || []).filter((d) => days.includes(d)).length;
    if (missedDays > 0 && (!mostSkipped || missedDays > mostSkipped.missedDays)) {
      mostSkipped = { id, missedDays };
    }
  }

  const proposal = chooseProposal(
    { ...input, planned: plannedRows, newMinutesByDay: newMinByDay, totalMinutesByDay: totalMinByDay, habitMisses: misses, queueMissed },
    mostSkipped, planned, done
  );
  const allClear = !proposal && done >= planned && planned > 0;

  return {
    weekKey: isoWeekKey(input.weekOf),
    start,
    end,
    planned,
    done,
    ratio: planned ? Math.min(1, done / planned) : 0,
    mostSkippedHabit: mostSkipped,
    proposal,
    allClear,
    headline: buildHeadline({ planned, done, mostSkipped, allClear, proposal }),
  };
}

/**
 * Pick the ONE change.
 *
 * Priority is deliberate and ordered by how much the change is worth:
 *   1. A phase drift (mostly new material) → the phase is wrong, not the effort.
 *   2. A neglected habit → shrink it, do not try harder.
 *   3. A backlog of un-reviewed cards → the queue is the cheapest win there is.
 *
 * "Shrink it, do not try harder" is the important one. When a habit is skipped
 * most, the obvious suggestion is to do it more, and that is how people quit.
 * The suggestion is instead to make it smaller.
 */
function chooseProposal(
  input: WeeklyInput,
  mostSkipped: WeeklyReview['mostSkippedHabit'],
  planned: number,
  done: number,
): WeeklyReview['proposal'] {
  // An already-accepted proposal is not regenerated. Re-asking a settled decision
  // every Sunday is how a review becomes noise.
  if (input.acceptedProposal) return null;

  // 1. Phase drift.
  const newMin = input.newMinutesByDay.reduce((a, b) => a + b, 0);
  const totalMin = input.totalMinutesByDay.reduce((a, b) => a + b, 0);
  if (totalMin > 0 && newMin / totalMin >= 0.7) {
    return {
      text: 'Split your week: learn for the first two days, burn down for the rest.',
      why: `${Math.round((newMin / totalMin) * 100)}% of your logged time went to new material. One phase does not do both well.`,
    };
  }

  // 2. Neglected habit → make it smaller, not harder.
  if (mostSkipped && mostSkipped.missedDays >= 3) {
    return {
      text: 'Shrink that habit so it fits a bad day.',
      why: `You skipped it on ${mostSkipped.missedDays} of 7 days. A smaller version you keep beats a larger version you abandon.`,
    };
  }

  // 3. Un-reviewed queue: the cheapest possible win.
  if (input.queueMissed > 0) {
    return {
      text: `Clear ${Math.min(5, input.queueMissed)} of the ${input.queueMissed} review-queue cards that came due.`,
      why: 'Re-reads are the cheapest work you have. Clearing them keeps the queue short enough that you keep opening it.',
    };
  }

  // 4. Missed the plan → propose fewer commitments, explicitly.
  if (planned > 0 && done < planned * 0.6) {
    return {
      text: `Plan ${Math.max(1, Math.round(done / Math.max(0.6, done / planned)))} items next week instead of ${planned}.`,
      why: `You finished ${done} of ${planned}. Planning what you can actually finish is not a lower bar, it is the same bar honestly set.`,
    };
  }

  return null;
}

function buildHeadline(x: {
  planned: number; done: number; mostSkipped: WeeklyReview['mostSkippedHabit'];
  allClear: boolean; proposal: WeeklyReview['proposal'];
}): string {
  if (x.planned === 0) return 'Nothing was planned this week. Next week: plan one thing.';
  if (x.allClear) return `${x.done} of ${x.planned} done, and nothing to change. Keep it.`;
  const missed = x.mostSkipped ? ` ${x.mostSkipped.id} came up most.` : '';
  return `${x.done} of ${x.planned} done.${missed}`;
}
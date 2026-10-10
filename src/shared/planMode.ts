/**
 * planMode — feature 7. "Block plan mode. A rule that you can't edit the system
 * on days with unfinished core tasks. This one is blunt, and it's aimed at you."
 *
 * ── THE DESIGN DECISION, AND WHY IT IS NOT A LOCK ──
 * A hard lock with no escape is how people delete the app. So the lock is real
 * but ALWAYS escapable, and the escape has a COST rather than a wall:
 *
 *   · "Break the block" is permanently visible, never hidden behind a condition
 *   · it requires a TYPED confirmation, not a click — a click is an accident, a
 *     typed word is a decision
 *   · it WRITES A ROW, and the weekly review names it
 *
 * That last point is the actual mechanism. The rule is not there to prevent you
 * editing; it is there to make editing a thing you remember doing. A rule that
 * only punishes gets deleted; a rule that shows up in Sunday's review gets
 * negotiated, which is the behaviour that actually changes things.
 *
 * ── WHY "CORE" IS DEFINED AND NOT INFERRED ──
 * `coreIds` is explicit. Inferring "core" from priority or category would mean
 * the app silently changes which rules apply when you rename something. A rule
 * whose scope can move on its own is not a rule.
 *
 * ── ARMING ──
 * `armed` is opt-in PER PHASE. It never arms itself. A guard that activates on
 * its own is indistinguishable from a bug, and CZ would (rightly) assume the
 * app had locked itself.
 */

export interface PlanModeInput {
  /** Is the guard switched on for this phase? Never inferred. */
  armed: boolean;
  /** Ids of the tasks that count as core. Explicit. */
  coreIds: string[];
  /** Ids completed, anywhere in the payload. */
  doneIds: string[];
  /** Has the user already broken the block today? */
  alreadyBroken?: boolean;
}

export interface PlanModeVerdict {
  /** Are system edits blocked right now? */
  blocked: boolean;
  /** Core tasks still open. */
  outstandingCore: string[];
  /** Copy for the banner. Never blank, never a bare boolean. */
  headline: string;
  detail: string;
  /** Should the break control be shown? Always true when blocked. */
  canBreak: boolean;
  /** The word the user must type to break the block. */
  breakPhrase: string;
}

export const BREAK_PHRASE = 'break the block';

export function evaluatePlanMode(input: PlanModeInput): PlanModeVerdict {
  const done = new Set(input.doneIds);
  const outstandingCore = (input.coreIds || []).filter((id) => !done.has(id));
  const hasCore = (input.coreIds || []).length > 0;

  // No core tasks defined means the rule has no subject. Reporting "blocked"
  // with nothing to finish would be a lock on nothing, which is the most
  // infuriating version of this feature.
  if (!input.armed || !hasCore) {
    return {
      blocked: false,
      outstandingCore,
      headline: '',
      detail: '',
      canBreak: false,
      breakPhrase: BREAK_PHRASE,
    };
  }

  if (outstandingCore.length === 0) {
    return {
      blocked: false,
      outstandingCore,
      headline: 'Plan mode released',
      detail: 'Core tasks are done. The system is yours again.',
      canBreak: false,
      breakPhrase: BREAK_PHRASE,
    };
  }

  const n = outstandingCore.length;
  return {
    blocked: true,
    outstandingCore,
    headline: `Plan mode — ${n} core task${n === 1 ? '' : 's'} open`,
    detail: 'Settings stay read-only today so today\'s plan survives the day. You can break the block, but it will be in Sunday\'s review.',
    canBreak: true,
    breakPhrase: BREAK_PHRASE,
  };
}

/**
 * Should the break control warn before confirming?
 *
 * Plain-language, no guilt, no exclamation marks. Shaming copy makes people
 * disable the feature rather than obey it, which is the opposite of the goal.
 */
export function breakWarning(count: number): string {
  return count === 0
    ? 'This will be recorded in Sunday\'s review.'
    : `You have broken the block ${count === 1 ? 'once' : `${count} times`} this week. It will appear in Sunday\'s review.`;
}
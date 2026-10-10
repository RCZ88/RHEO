/**
 * phaseRules — feature 5. "When you flip phases, the app swaps the daily
 * checklist automatically. Detection of drift is good, but only if it asks you
 * 'are you in a new phase?' instead of guessing."
 *
 * ── THE DESIGN DECISION ──
 * Two rules, one per phase, and they are genuinely different KINDS of rule, not
 * two presets of the same one:
 *
 *   learn      → ADDITIVE. Low targets, new topics allowed, review is a floor.
 *   burn-down  → SUBTRACTIVE. New material is BLOCKED. Only finishing and
 *                reviewing survive.
 *
 * Burn-down is the one worth arguing for. A tracker that keeps letting you add
 * during a catch-up phase is not helping you catch up; it is just a to-do list
 * with a nicer heading. So `burn-down` marks new goals as *blocked* rather than
 * hiding them — hiding would make the user think the app lost their work, and
 * losing work is the fastest way to lose trust in a tracker.
 *
 * ── WHY DRIFT ASKS AND NEVER GUESSES ──
 * CZ's instruction is the whole feature, and it is a good one. An app that
 * silently reinterprets "you opened a new topic, so you must be in a new phase"
 * will be wrong exactly when it matters — mid-experiment, mid-recovery — and the
 * user has no way to tell it misread them. So drift produces ONE question with
 * three answers (Yes / Not now / No), and "No" is a first-class answer that
 * records the answer so the same question is not asked again tomorrow.
 *
 * Detection is deliberately CONSERVATIVE: it needs a pattern across days, not a
 * single event, so it cannot fire on one exploratory session.
 */

export type TrainingMode = 'learn' | 'burn_down';

export interface PhaseRules {
  mode: TrainingMode;
  /** Are new goals/tasks allowed right now? */
  allowNew: boolean;
  /** New-topic work that is allowed this phase, per day. */
  maxNewPerDay: number;
  /** Minutes of review that count as the daily floor. */
  reviewFloorMinutes: number;
  /** Is this phase allowed to end? Burn-down needs the queue empty-ish. */
  requireReviewQueueCleared: boolean;
}

/**
 * The two rule sets. Exported as a frozen literal rather than computed, because
 * these are POLICY, and a policy that is derived from data will change itself
 * without anyone deciding to change it.
 */
export const PHASE_RULES: Record<TrainingMode, PhaseRules> = {
  learn: {
    mode: 'learn',
    allowNew: true,
    // "Low targets" from CZ's spec. Two a day is enough to be in new material
    // without the day becoming nothing but new material.
    maxNewPerDay: 2,
    reviewFloorMinutes: 10,
    requireReviewQueueCleared: false,
  },
  burn_down: {
    mode: 'burn_down',
    allowNew: false,
    maxNewPerDay: 0,
    // Higher floor: finishing is the only thing left, so the floor is most of
    // the work rather than a token amount.
    reviewFloorMinutes: 20,
    requireReviewQueueCleared: true,
  },
};

/** What the app says when you try to add new material during burn-down. */
export const BURN_DOWN_BLOCK_COPY =
  'Burn-down phase — new topics are blocked until you flip the phase. Finish what is open, or flip the phase yourself.';

/**
 * Human label for the phase. Deliberately short: it sits in a header chip and
 * anything longer wraps.
 */
export function phaseLabel(mode: TrainingMode): string {
  return mode === 'burn_down' ? 'Burn-down' : 'Learn';
}

/**
 * The one-sentence summary shown when a phase flips. It states what CHANGED,
 * not just what the new mode is — because "you are now in burn-down" is a label
 * and "new topics are blocked until you flip this" is a consequence.
 */
export function phaseChangeSummary(mode: TrainingMode): string {
  return mode === 'burn_down'
    ? 'Burn-down — reviewing and finishing only. New topics are blocked.'
    : 'Learn — low targets, new topics open, review is the floor.';
}

/**
 * Is the user drifting? CONSERVATIVE BY DESIGN.
 *
 * Requires BOTH a run of consecutive days AND a majority of recent work being
 * new material. A single exploratory session cannot trigger it, and neither can
 * a genuinely light week.
 */
export function detectDrift(input: {
  /** 'YYYY-MM-DD' per day, oldest first. */
  days: string[];
  /** Minutes of NEW-topic work per day, aligned to `days`. */
  newMinutesByDay: number[];
  /** Total minutes per day, aligned to `days`. */
  totalMinutesByDay: number[];
  currentMode: TrainingMode;
}): { drifting: boolean; reason: string } {
  const n = input.days.length;
  if (n < 3) return { drifting: false, reason: 'Not enough days to judge a phase.' };

  const window = Math.min(5, n);
  const start = n - window;
  let newMin = 0;
  let totalMin = 0;
  for (let i = start; i < n; i++) {
    newMin += input.newMinutesByDay[i] ?? 0;
    totalMin += input.totalMinutesByDay[i] ?? 0;
  }
  if (totalMin <= 0) return { drifting: false, reason: 'No work logged in the last few days.' };

  const newShare = newMin / totalMin;
  const consecutive = trailingRun(input.newMinutesByDay, start, n, (m) => m > 0);

  if (newShare < 0.6 || consecutive < 3) {
    return { drifting: false, reason: 'Not enough new material to call a phase change.' };
  }

  // Direction of drift depends on where you are: piling on new material during
  // a burn-down means you have moved back into learn mode.
  return input.currentMode === 'burn_down'
    ? { drifting: true, reason: `You have spent ${Math.round(newShare * 100)}% of the last ${window} days on new material.` }
    : { drifting: false, reason: 'Already in a phase that allows new material.' };
}

function trailingRun(values: number[], from: number, to: number, pred: (v: number) => boolean): number {
  let run = 0;
  for (let i = to - 1; i >= from; i--) {
    if (pred(values[i] ?? 0)) run += 1;
    else break;
  }
  return run;
}

/**
 * THE QUESTION. One question, three answers, never an action.
 *
 * `notNow` is a real answer rather than dismissal: it records a 7-day cooldown
 * so the app does not re-ask every single session, which is how a helpful
 * prompt becomes an irritant that gets permanently dismissed without reading.
 */
export interface DriftQuestion {
  kind: 'new-phase';
  reason: string;
  question: string;
  options: Array<{ key: 'yes' | 'not_now' | 'no'; label: string; hint: string }>;
}

export function driftQuestion(reason: string): DriftQuestion {
  return {
    kind: 'new-phase',
    reason,
    question: 'Are you in a new phase?',
    options: [
      { key: 'yes', label: 'Yes, flip the phase', hint: 'Switch mode and load the new checklist.' },
      { key: 'not_now', label: 'Not now', hint: 'Ask me again in a week.' },
      { key: 'no', label: 'No, same phase', hint: 'Stop asking for this phase.' },
    ],
  };
}

/** How long a "not now" silences the question. */
export const DRIFT_COOLDOWN_DAYS = 7;
/** Feature 5. The load-bearing rule: drift ASKS, it never guesses. */
import { PHASE_RULES, phaseLabel, phaseChangeSummary, detectDrift, driftQuestion, BURN_DOWN_BLOCK_COPY, DRIFT_COOLDOWN_DAYS } from '../shared/phaseRules';

describe('phaseRules — the two phases are different KINDS of rule', () => {
  it('learn ADDS: new material is allowed', () => {
    expect(PHASE_RULES.learn.allowNew).toBe(true);
    expect(PHASE_RULES.learn.maxNewPerDay).toBeGreaterThan(0);
  });
  it('burn-down SUBTRACTS: new material is blocked', () => {
    expect(PHASE_RULES.burn_down.allowNew).toBe(false);
    expect(PHASE_RULES.burn_down.maxNewPerDay).toBe(0);
  });
  it('burn-down demands a cleared queue', () => {
    expect(PHASE_RULES.burn_down.requireReviewQueueCleared).toBe(true);
    expect(PHASE_RULES.learn.requireReviewQueueCleared).toBe(false);
  });
  it('burn-down raises the daily floor, because finishing is all that is left', () => {
    expect(PHASE_RULES.burn_down.reviewFloorMinutes).toBeGreaterThan(PHASE_RULES.learn.reviewFloorMinutes);
  });
});

describe('phaseRules — copy states the CONSEQUENCE, not the label', () => {
  it('names the modes in plain language', () => {
    expect(phaseLabel('learn')).toBe('Learn');
    expect(phaseLabel('burn_down')).toBe('Burn-down');
  });
  it('the burn-down summary says what is now blocked', () => {
    expect(phaseChangeSummary('burn_down')).toContain('blocked');
  });
  it('the learn summary names the low-target rule', () => {
    expect(phaseChangeSummary('learn')).toContain('low targets');
  });
  it('the block copy tells the user how to change it, rather than forbidding', () => {
    expect(BURN_DOWN_BLOCK_COPY).toContain('flip the phase');
  });
});

describe('phaseRules — drift must ASK, never act', () => {
  const days = ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'];
  it('does not fire on too little history', () => {
    expect(detectDrift({ days: ['2026-10-07'], newMinutesByDay: [100], totalMinutesByDay: [100], currentMode: 'burn_down' }).drifting).toBe(false);
  });
  it('does not fire on a single heavy day — a pattern is required', () => {
    expect(detectDrift({ days, newMinutesByDay: [0,0,0,120,0], totalMinutesByDay: [120,120,120,120,120], currentMode: 'burn_down' }).drifting).toBe(false);
  });
  it('fires on a sustained run of new material during burn-down', () => {
    const d = detectDrift({ days, newMinutesByDay: [100,110,120,130,140], totalMinutesByDay: [120,120,120,130,140], currentMode: 'burn_down' });
    expect(d.drifting).toBe(true);
    expect(d.reason).toContain('%');
  });
  it('does NOT fire while already in learn — nothing to change', () => {
    expect(detectDrift({ days, newMinutesByDay: [100,110,120,130,140], totalMinutesByDay: [120,120,120,130,140], currentMode: 'learn' }).drifting).toBe(false);
  });
  it('no work logged means no accusation', () => {
    expect(detectDrift({ days, newMinutesByDay: [0,0,0,0,0], totalMinutesByDay: [0,0,0,0,0], currentMode: 'burn_down' }).drifting).toBe(false);
  });
});

describe('phaseRules — the question is answerable', () => {
  const q = driftQuestion('80% of the last 5 days were new material.');
  it('asks rather than asserting', () => {
    expect(q.question).toBe('Are you in a new phase?');
  });
  it('offers THREE answers, and "not now" is a real one', () => {
    expect(q.options.length).toBe(3);
    expect(q.options.map((o) => o.key)).toContain('not_now');
  });
  it('every option says what it will do', () => {
    for (const o of q.options) expect(o.hint.length).toBeGreaterThan(0);
  });
  it('"not now" silences it for a week, so it cannot become an irritant', () => {
    expect(DRIFT_COOLDOWN_DAYS).toBe(7);
  });
});

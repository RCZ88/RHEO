/** Feature 7: "This one is blunt, and it's aimed at you." — so it must be escapable. */
import { evaluatePlanMode, breakWarning, BREAK_PHRASE } from '../shared/planMode';

describe('planMode — the escape hatch is never taken away', () => {
  it('a block ALWAYS offers a break', () => {
    expect(evaluatePlanMode({ armed: true, coreIds: ['a','b'], doneIds: [] }).canBreak).toBe(true);
  });
  it('the break requires typing, not clicking', () => {
    expect(BREAK_PHRASE.length).toBeGreaterThan(6);
    expect(BREAK_PHRASE).toContain(' ');
  });
  it('the cost is stated, not shamed', () => {
    const w = breakWarning(0);
    expect(w).toContain('review');
    expect(w.toLowerCase().includes('weak')).toBe(false);
    expect(w.toLowerCase().includes('fail')).toBe(false);
  });
  it('a repeat breaker is counted in words', () => {
    expect(breakWarning(1)).toContain('once');
    expect(breakWarning(4)).toContain('4 times');
  });
});

describe('planMode — it only locks when it has a subject', () => {
  it('not armed means not blocked', () => {
    const v = evaluatePlanMode({ armed: false, coreIds: ['a'], doneIds: [] });
    expect(v.blocked).toBe(false);
    expect(v.canBreak).toBe(false);
  });
  it('no core tasks means not blocked — a lock on nothing is the worst version', () => {
    const v = evaluatePlanMode({ armed: true, coreIds: [], doneIds: [] });
    expect(v.blocked).toBe(false);
    expect(v.headline).toBe('');
  });
});

describe('planMode — it releases itself', () => {
  it('finishing every core task releases the block', () => {
    const v = evaluatePlanMode({ armed: true, coreIds: ['a','b'], doneIds: ['a','b'] });
    expect(v.blocked).toBe(false);
    expect(v.headline).toBe('Plan mode released');
  });
  it('one open task is enough to hold it', () => {
    const v = evaluatePlanMode({ armed: true, coreIds: ['a','b'], doneIds: ['a'] });
    expect(v.blocked).toBe(true);
    expect(v.outstandingCore).toEqual(['b']);
  });
});

describe('planMode — copy is plain and singular-aware', () => {
  it('one open task reads as "1 core task"', () => {
    expect(evaluatePlanMode({ armed: true, coreIds: ['a'], doneIds: [] }).headline).toContain('1 core task ');
  });
  it('two open tasks read as plural', () => {
    expect(evaluatePlanMode({ armed: true, coreIds: ['a','b'], doneIds: [] }).headline).toContain('2 core tasks');
  });
  it('the detail says how to change it', () => {
    expect(evaluatePlanMode({ armed: true, coreIds: ['a'], doneIds: [] }).detail.toLowerCase()).toContain('break the block');
  });
  it('an out-of-range done id does not crash it', () => {
    const v = evaluatePlanMode({ armed: true, coreIds: ['a'], doneIds: ['zzz', null as any, 7 as any] });
    expect(v.blocked).toBe(true);
  });
});

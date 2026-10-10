/** Feature 6. "One change only. Too many changes means none happen." */
import { buildWeeklyReview } from '../shared/weeklyReview';

const WEEK = '2026-10-07';
const z = (n: number) => new Array(n).fill(0);
const plan = (total: number, done: number) =>
  Array.from({ length: total }, (_, i) => ({ id: `g${i}`, title: `G${i}`, date: '2026-10-07', done: i < done, isHabit: false }));
const base = { weekOf: WEEK, planned: plan(5, 5), habitIdsTracked: ['gym'], habitMisses: {}, queueMissed: 0 };

describe('weeklyReview — planned vs done', () => {
  it('counts the plan', () => {
    const r = buildWeeklyReview({ ...base, planned: plan(6, 3) });
    expect(r.planned).toBe(6);
    expect(r.done).toBe(3);
    expect(r.ratio).toBeCloseTo(0.5);
  });
  it('ratio is clamped so an over-target week cannot overflow a bar', () => {
    expect(buildWeeklyReview({ ...base, planned: plan(3, 3) }).ratio).toBe(1);
  });
  it('keys the week in the stored ISO format', () => {
    expect(buildWeeklyReview(base).weekKey).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('weeklyReview — EXACTLY ONE proposal, never a list', () => {
  it('returns a single object, not an array, even when several things are wrong', () => {
    const r = buildWeeklyReview({
      weekOf: WEEK, planned: plan(6, 1),
      habitMisses: { gym: ['2026-10-06','2026-10-07','2026-10-08','2026-10-09'] },
      queueMissed: 7, newMinutesByDay: z(7), totalMinutesByDay: z(7),
    });
    expect(Array.isArray(r.proposal)).toBe(false);
    expect(r.proposal !== null).toBe(true);
  });
  it('every proposal carries a reason — an unexplained suggestion gets ignored', () => {
    const r = buildWeeklyReview({ ...base, planned: plan(6, 1), newMinutesByDay: z(7), totalMinutesByDay: z(7) });
    expect(r.proposal?.why.length).toBeGreaterThan(0);
  });
  it('phase drift outranks the neglected habit', () => {
    const r = buildWeeklyReview({
      weekOf: WEEK, planned: plan(6, 4),
      habitMisses: { gym: ['2026-10-06','2026-10-07','2026-10-08','2026-10-09'] },
      newMinutesByDay: [100,100,100,100,100,100,100], totalMinutesByDay: [100,100,100,100,100,100,100],
    });
    expect(r.proposal?.text).toContain('burn down');
  });
  it('a neglected habit gets SHRUNK, not intensified', () => {
    const r = buildWeeklyReview({
      weekOf: WEEK, planned: plan(5, 4),
      habitMisses: { gym: ['2026-10-06','2026-10-07','2026-10-08','2026-10-09'] },
      newMinutesByDay: z(7), totalMinutesByDay: [10,10,10,10,10,10,10],
    });
    expect(r.proposal?.text.toLowerCase()).toContain('shrink');
  });
  it('a clean week proposes NOTHING rather than padding the shape', () => {
    const r = buildWeeklyReview(base);
    expect(r.proposal).toBeNull();
    expect(r.allClear).toBe(true);
    expect(r.headline).toContain('nothing to change');
  });
  it('an already-accepted proposal is never regenerated', () => {
    const r = buildWeeklyReview({ ...base, planned: plan(6, 1), acceptedProposal: 'Split your week' });
    expect(r.proposal).toBeNull();
  });
});

describe('weeklyReview — the most-skipped habit', () => {
  it('finds the habit with the most MISSES, not the most completions', () => {
    const r = buildWeeklyReview({
      ...base,
      habitMisses: { gym: ['2026-10-05','2026-10-06'], meditation: ['2026-10-05','2026-10-06','2026-10-07','2026-10-08'] },
    });
    expect(r.mostSkippedHabit?.id).toBe('meditation');
  });
  it('is null when nothing was missed', () => {
    expect(buildWeeklyReview(base).mostSkippedHabit).toBeNull();
  });
});

describe('weeklyReview — an empty week still says something useful', () => {
  it('does not report a failure when nothing was planned', () => {
    const r = buildWeeklyReview({ ...base, planned: [] });
    expect(r.headline).toContain('plan one thing');
    expect(r.headline.toLowerCase().includes('fail')).toBe(false);
  });
});

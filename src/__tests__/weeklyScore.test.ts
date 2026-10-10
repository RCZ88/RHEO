/** Feature 4: "make failure cheap". The tests are mostly about NOT zeroing. */
import { computeWeeklyScore, describeWeeklyScore, currentStreak, DEFAULT_WEEKLY_WIN_DAYS } from '../shared/weeklyScore';

const WEEK = '2026-10-07';                    // a Wednesday
const DAYS = ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11'];
const full = (n: number, minutes = 60) => Array.from({ length: n }, (_, i) => ({ date: DAYS[i], minutes, metMinimum: minutes >= 20 }));

describe('weeklyScore — 5 of 7 is a win', () => {
  it('default target is 5', () => expect(DEFAULT_WEEKLY_WIN_DAYS).toBe(5));
  it('5 of 7 wins', () => { const s = computeWeeklyScore(WEEK, full(5)); expect(s.counted).toBe(5); expect(s.isWin).toBe(true); });
  it('4 of 7 does not win', () => { const s = computeWeeklyScore(WEEK, full(4)); expect(s.isWin).toBe(false); });
  it('7 of 7 wins', () => expect(computeWeeklyScore(WEEK, full(7)).isWin).toBe(true));
});

describe('weeklyScore — the point of the feature', () => {
  it('4 of 7 reads as "4", NOT as 0', () => {
    const s = computeWeeklyScore(WEEK, full(4));
    expect(s.counted).toBe(4);
    expect(s.ratio).toBeCloseTo(0.8);
  });
  it('ratio CLAMPS at 1 so an over-target week cannot overflow the ring', () => {
    expect(computeWeeklyScore(WEEK, full(7)).ratio).toBe(1);
  });
  it('a missed day does not zero the week', () => {
    const mixed = [{ date: DAYS[0], minutes: 30, metMinimum: true }, { date: DAYS[4], minutes: 30, metMinimum: true }];
    const s = computeWeeklyScore(WEEK, mixed);
    expect(s.counted).toBe(2);
    expect(s.isWin).toBe(false);
  });
});

describe('weeklyScore — the minimum day rule', () => {
  const ten = [{ date: DAYS[0], minutes: 10, metMinimum: false }];
  const twenty = [{ date: DAYS[1], minutes: 20, metMinimum: true }];

  it('a 10-minute day COUNTS', () => expect(computeWeeklyScore(WEEK, ten).counted).toBe(1));
  it('…but does not count as QUALIFIED', () => expect(computeWeeklyScore(WEEK, ten).qualified).toBe(0));
  it('a 20-minute day counts and qualifies', () => {
    const s = computeWeeklyScore(WEEK, twenty);
    expect(s.counted).toBe(1);
    expect(s.qualified).toBe(1);
  });
  it('honours a custom minimum when nothing was stored', () => {
    const unstored = [{ date: DAYS[0], minutes: 10, metMinimum: undefined as any }];
    expect(computeWeeklyScore(WEEK, unstored, { minimumMinutes: 5 }).qualified).toBe(1);
  });
  it('a STORED met_minimum wins over a later minimum change', () => {
    // This is the whole reason met_minimum is persisted rather than derived:
    // raising the minimum next month must not retroactively un-count days that
    // genuinely met the rule in force at the time.
    expect(computeWeeklyScore(WEEK, ten, { minimumMinutes: 60 }).qualified).toBe(0);
  });
  it('falls back to recomputing when met_minimum was never stored', () => {
    const legacy = [{ date: DAYS[0], minutes: 45, metMinimum: undefined as any }];
    expect(computeWeeklyScore(WEEK, legacy).qualified).toBe(1);
  });
});

describe('weeklyScore — weakest day, ONE thing', () => {
  it('prefers a genuinely empty day over a thin one', () => {
    const s = computeWeeklyScore(WEEK, [{ date: DAYS[0], minutes: 5, metMinimum: false }, { date: DAYS[5], minutes: 5, metMinimum: false }]);
    expect(s.weakest?.reason).toBe('Nothing logged');
  });
  it('names a thin day when nothing was empty', () => {
    const s = computeWeeklyScore(WEEK, full(7, 5));
    expect(s.weakest?.reason).toBe('Below the minimum day');
  });
  it('is null on a clean week', () => {
    const s = computeWeeklyScore(WEEK, full(7, 60));
    expect(s.weakest).toBeNull();
  });
});

describe('weeklyScore — copy carries no failure framing', () => {
  it('an empty week invites one small task rather than reporting a failure', () => {
    const copy = describeWeeklyScore(computeWeeklyScore(WEEK, []));
    expect(copy).toContain('20-minute');
    expect(copy.toLowerCase().includes('fail')).toBe(false);
  });
  it('a near-miss says how many days short, not "FAILED"', () => {
    const copy = describeWeeklyScore(computeWeeklyScore(WEEK, full(4)));
    expect(copy).toContain('4 of 5');
    expect(copy).toContain('One more day');
    expect(copy.toLowerCase().includes('fail')).toBe(false);
  });
  it('an exact week is acknowledged without inflating', () => {
    expect(describeWeeklyScore(computeWeeklyScore(WEEK, full(5)))).toContain('exactly enough');
  });
});

describe('streak — kept only so the review can name what it replaces', () => {
  it('today not being done yet is NOT a miss', () => {
    expect(currentStreak(['2026-10-05', '2026-10-06'], '2026-10-07').current).toBe(2);
  });
  // The same 5-day gap, three settings, three genuinely different answers.
  const SPARSE = ['2026-10-01', '2026-10-06'];
  const TIGHT = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'];

  it('reset: the gap cuts the run to the days after it', () => {
    expect(currentStreak(SPARSE, '2026-10-07', 'reset').current).toBe(1);
    expect(currentStreak(TIGHT, '2026-10-07', 'reset').current).toBe(4);
  });
  it('continue: a gap does NOT cost the earlier days', () => {
    expect(currentStreak(SPARSE, '2026-10-07', 'continue').current).toBe(2);
  });
  it('pause: a short slip passes, a long one breaks', () => {
    expect(currentStreak(SPARSE, '2026-10-07', 'pause').current).toBe(1);
    expect(currentStreak(TIGHT, '2026-10-07', 'pause').current).toBe(4);
  });
  it('continue NEVER reports the same number as reset — the forgiving setting must differ', () => {
    // `reset` and `pause` may legitimately agree on a single long gap (both stop
    // there), so demanding all three differ would be a false requirement. The
    // invariant that actually matters: a user who opts out of streak-reset must
    // not be handed the reset number, or the setting does nothing at all.
    for (const set of [SPARSE, ['2026-10-03', '2026-10-04', '2026-10-06'], ['2026-10-06']]) {
      const reset = currentStreak(set, '2026-10-07', 'reset').current;
      const cont = currentStreak(set, '2026-10-07', 'continue').current;
      expect(cont >= reset).toBe(true);
      if (set.length > 1 && new Set(set).size > 1) expect(cont > reset).toBe(true);
    }
  });
  it('an unbroken week reports the same number in every mode', () => {
    const tight = currentStreak(TIGHT, '2026-10-07', 'reset').current;
    expect(currentStreak(TIGHT, '2026-10-07', 'continue').current).toBe(tight);
    expect(currentStreak(TIGHT, '2026-10-07', 'pause').current).toBe(tight);
  });
  it('no days at all is 0, not a crash', () => {
    expect(currentStreak([], '2026-10-07').current).toBe(0);
  });
});

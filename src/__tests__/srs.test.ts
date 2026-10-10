/** The queue CZ called "more important for your plan than any other feature". */
import { scheduleCard, dueCards, nextDueHint, daysBetween, FIRST_INTERVAL_DAYS, SECOND_INTERVAL_DAYS, type SrsCard } from '../shared/srs';

const D = (s: string, n: number) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)!;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const card = (over: Partial<SrsCard> = {}): SrsCard =>
  ({ id: 'c1', pattern: 'hash-map', title: 'Prefix Sum', due: null, reps: 0, lapses: 0, scheduledDays: 0, ...over });

describe('srs — the 3 and 10 day promise', () => {
  it('a new problem comes back in exactly 3 days', () => {
    expect(scheduleCard(card(), 'recalled', '2026-10-05').due).toBe(D('2026-10-05', 3));
  });
  it('the second re-read is exactly 10 days', () => {
    expect(scheduleCard(card({ reps: 1, scheduledDays: 3 }), 'recalled', '2026-10-08').due).toBe(D('2026-10-08', 10));
  });
  it('the interval constants are 3 and 10', () => {
    expect(FIRST_INTERVAL_DAYS).toBe(3);
    expect(SECOND_INTERVAL_DAYS).toBe(10);
  });
  it('crosses a month boundary correctly', () => {
    expect(scheduleCard(card(), 'recalled', '2026-10-29').due).toBe('2026-11-01');
  });
});

describe('srs — a lapse must not punish the queue', () => {
  it('a forgotten card comes back sooner than a full interval', () => {
    const d = scheduleCard(card({ reps: 5, scheduledDays: 90 }), 'forgotten', '2026-10-05');
    expect(daysBetween('2026-10-05', d.due)).toBe(30);
  });
  it('but never resets all the way to day 3', () => {
    const d = scheduleCard(card({ reps: 5, scheduledDays: 90 }), 'forgotten', '2026-10-05');
    expect(daysBetween('2026-10-05', d.due)).toBeGreaterThan(3);
  });
  it('flags a repeatedly-forgotten card so the UI can say so', () => {
    expect(scheduleCard(card({ reps: 5, scheduledDays: 90, lapses: 3 }), 'forgotten', '2026-10-05').weakened).toBe(true);
  });
});

describe('srs — growth', () => {
  it('grows 2.5x after a solid recall', () => {
    const d = scheduleCard(card({ reps: 2, scheduledDays: 10 }), 'recalled', '2026-10-05');
    expect(d.scheduledDays).toBe(25);
  });
  it('a partial recall grows, but slower', () => {
    const d = scheduleCard(card({ reps: 2, scheduledDays: 10 }), 'partial', '2026-10-05');
    expect(d.scheduledDays).toBe(16);
    expect(d.scheduledDays).toBeLessThan(25);
  });
  it('is capped, so the queue cannot grow unbounded', () => {
    const d = scheduleCard(card({ reps: 20, scheduledDays: 150 }), 'recalled', '2026-10-05');
    expect(d.scheduledDays).toBeLessThanOrEqual(180);
    expect(d.label).toBe('Archived');
  });
});

describe('srs — the queue itself', () => {
  const today = '2026-10-07';
  const due = card({ id: 'due1', due: '2026-10-05' });
  const later = card({ id: 'later', due: '2026-11-01' });
  const fresh = card({ id: 'fresh', due: null });

  it('new cards sort FIRST — a queue you open must never look empty', () => {
    expect(dueCards([due, fresh], today)[0].id).toBe('fresh');
  });
  it('excludes cards not yet due', () => {
    expect(dueCards([later], today).length).toBe(0);
  });
  it('most-overdue comes first among due cards', () => {
    const overdue = card({ id: 'over', due: '2026-09-01' });
    expect(dueCards([due, overdue], today)[0].id).toBe('over');
  });
  it('respects the render cap (repo convention for dense lists)', () => {
    const many = Array.from({ length: 50 }, (_, i) => card({ id: `x${i}`, due: '2026-10-01' }));
    expect(dueCards(many, today, 20).length).toBe(20);
  });
});

describe('srs — due hints read as English, not as a diff', () => {
  it('new / due now / tomorrow / in N days / next week', () => {
    expect(nextDueHint(null, '2026-10-07')).toBe('New');
    expect(nextDueHint('2026-10-07', '2026-10-07')).toBe('Due now');
    expect(nextDueHint('2026-10-08', '2026-10-07')).toBe('Tomorrow');
    expect(nextDueHint('2026-10-10', '2026-10-07')).toBe('In 3 days');
    expect(nextDueHint('2026-10-20', '2026-10-07')).toBe('Next week');
    expect(nextDueHint('2026-11-20', '2026-10-07')).toBe('In 6 weeks');
  });
});

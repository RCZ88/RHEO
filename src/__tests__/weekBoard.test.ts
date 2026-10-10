import { buildWeekRows, weekDates } from '../features/warmth/schedule/WeekBoard';

// 2026-10-05 is a Monday. Week = Mon 5th .. Sun 11th.
const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
const NONE = { schedule: [], deadlines: [], reminders: [], todos: [], goals: [] } as any;

const block = (id: string, day: number, start = '14:00', end = '15:00') =>
  ({ id, title: `Block ${id}`, day_of_week: day, start_time: start, end_time: end, createdAt: '' }) as any;

describe('weekDates — the visible week', () => {
  it('is Monday-anchored and always 7 days', () => {
    const w = weekDates('2026-10-07');
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2026-10-05');   // Monday
    expect(w[6]).toBe('2026-10-11');   // Sunday
  });

  it('handles a Sunday anchor by returning the week it BELONGS to', () => {
    // Sunday 11 Oct is the LAST day of the 5th-11th week, not the first of the next.
    expect(weekDates('2026-10-11')[0]).toBe('2026-10-05');
  });

  it('handles a mid-week anchor', () => {
    expect(weekDates('2026-10-08')[0]).toBe('2026-10-05');
  });

  it('returns nothing for an unparseable date rather than throwing', () => {
    expect(weekDates('not-a-date')).toHaveLength(0);
  });
});

describe('WeekBoard — RECURRING blocks appear on EVERY matching date', () => {
  // This is the behaviour the old page structurally could not express: it held
  // one selected weekday, so a recurring block was only ever visible once.
  const r = buildWeekRows(WEEK, { ...NONE, schedule: [block('a', 2)] }); // 2 = Tuesday

  it('lands on Tuesday the 6th', () => expect(r['2026-10-06'].map(x => x.kind)).toEqual(['block']));
  it('lands on Tuesday the 13th-equivalent too — i.e. EVERY Tuesday in view', () => {
    expect(r['2026-10-13'] ?? undefined).toBe(undefined);          // next week is out of view
    expect(r['2026-10-06']).toHaveLength(1);
  });

  it('does NOT put it on any other day', () => {
    for (const d of WEEK) {
      if (d === '2026-10-06') continue;
      expect(r[d]).toHaveLength(0);
    }
  });

  it('repeats across a SECOND week when both weeks are in view', () => {
    const twoWeeks = [...WEEK, '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
    const rr = buildWeekRows(twoWeeks, { ...NONE, schedule: [block('a', 2)] });
    expect(rr['2026-10-06']).toHaveLength(1);
    expect(rr['2026-10-13']).toHaveLength(1);   // the following Tuesday
  });

  it('two recurring blocks on different weekdays land on different days only', () => {
    const rr = buildWeekRows(WEEK, { ...NONE, schedule: [block('mon', 1), block('thu', 4)] });
    expect(rr['2026-10-05']).toHaveLength(1);
    expect(rr['2026-10-08']).toHaveLength(1);
    expect(rr['2026-10-07']).toHaveLength(0);
  });
});

describe('WeekBoard — DATED items land on their own date', () => {
  it('a deadline shows on its due date only', () => {
    const r = buildWeekRows(WEEK, { ...NONE, deadlines: [{ id: 'd1', title: 'Essay', due_date: '2026-10-09', status: 'pending', priority: 'medium', created_at: '' } as any] });
    expect(r['2026-10-09'].map(x => x.title)).toEqual(['Essay']);
    expect(r['2026-10-10']).toHaveLength(0);
  });

  it('a reminder with no date is NOT scattered across the week', () => {
    // An undated reminder has no business inventing a column.
    const r = buildWeekRows(WEEK, { ...NONE, reminders: [{ id: 'r1', text: 'Call mum', due_date: null, done: false, goal_id: null, created_at: '' } as any] });
    for (const d of WEEK) expect(r[d]).toHaveLength(0);
  });

  it('a dated reminder shows on its date', () => {
    const r = buildWeekRows(WEEK, { ...NONE, reminders: [{ id: 'r1', text: 'Call mum', due_date: '2026-10-07', done: false, goal_id: null, created_at: '' } as any] });
    expect(r['2026-10-07'].map(x => x.title)).toEqual(['Call mum']);
  });

  it('a completed item is marked done so the row can strike it through', () => {
    const r = buildWeekRows(WEEK, { ...NONE, todos: [{ id: 't1', text: 'Ship it', done: true, dueDate: '2026-10-08' } as any] });
    expect(r['2026-10-08'][0].done).toBe(true);
  });
});

describe('WeekBoard — ordering and time honesty', () => {
  it('puts timed rows before untimed ones, earliest first', () => {
    const r = buildWeekRows(WEEK, {
      ...NONE,
      schedule: [block('late', 2, '18:00', '19:00'), block('early', 2, '09:00', '10:00')],
      todos: [{ id: 't1', text: 'Someday', done: false, dueDate: '2026-10-06' }],
    });
    expect(r['2026-10-06'].map(x => x.title)).toEqual(['Block early', 'Block late', 'Someday']);
  });

  it('flags an overnight block instead of implying it ends before it starts', () => {
    // 23:30 -> 01:00 printed as "23:30 → 01:00" is a small lie: it reads as
    // ending 22.5h before it begins. The row must say so.
    const r = buildWeekRows(WEEK, { ...NONE, schedule: [block('night', 2, '23:30', '01:00')] });
    const row = r['2026-10-06'][0];
    expect(row.overnight).toBe(true);
    expect(row.time).toContain('next day');
  });

  it('does not flag a normal block as overnight', () => {
    const r = buildWeekRows(WEEK, { ...NONE, schedule: [block('day', 2, '09:00', '17:00')] });
    expect(r['2026-10-06'][0].overnight).toBe(false);
  });

  it('tolerates a malformed time without producing NaN in the label', () => {
    const r = buildWeekRows(WEEK, { ...NONE, schedule: [{ id: 'x', title: 'Bad time', day_of_week: 2, start_time: '99:99', end_time: '', createdAt: '' } as any] });
    expect(r['2026-10-06']).toHaveLength(1);
    expect(String(r['2026-10-06'][0].time)).not.toContain('NaN');
  });

  it('an untitled row still renders a word rather than a blank line', () => {
    const r = buildWeekRows(WEEK, { ...NONE, goals: [{ id: 'g', title: '', date: '2026-10-06' } as any] });
    expect(r['2026-10-06'][0].title).toBe('Untitled goal');
  });
});

describe('WeekBoard — hostile input', () => {
  it('an unparseable date in the list is skipped, not crashed on', () => {
    const r = buildWeekRows([...WEEK, 'garbage'], { ...NONE, schedule: [block('a', 2)] });
    expect(r['2026-10-06']).toHaveLength(1);
  });

  it('null entries in the lists do not throw', () => {
    const r = buildWeekRows(WEEK, { schedule: [null, block('a', 2), undefined] as any, deadlines: [], reminders: [], todos: [], goals: [] });
    expect(r['2026-10-06']).toHaveLength(1);
  });

  it('an empty week yields an entry per date with no rows', () => {
    const r = buildWeekRows(WEEK, NONE);
    for (const d of WEEK) expect(r[d]).toHaveLength(0);
  });
});
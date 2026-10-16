import {
  deadlineInstant, fireTimeFor, describeLead, describeWhen,
  normalizeReminder, liveReminders, newReminderId,
  type DeadlineReminder,
} from '../shared/deadlineReminders';

/* 2026-10-12 is a Monday. Fixed instants throughout — a reminder feature whose
   own tests depend on "today" is a reminder feature that breaks in production. */
const NOW = new Date(2026, 9, 10, 12, 0, 0);        // Sat 10 Oct, 12:00 local
const DUE = { due_date: '2026-10-12', due_time: '14:00' };
const DUE_AT = new Date(2026, 9, 12, 14, 0, 0);     // Mon 12 Oct, 14:00

const rem = (o: Partial<DeadlineReminder> = {}): DeadlineReminder => ({
  id: 'r1', deadline_id: 'd1', mode: 'relative', lead_min: 60,
  remind_at: null, fired: 0, created_at: NOW.toISOString(), ...o,
});

describe('deadlineInstant — when the thing happens', () => {
  it('reads a bare date with the clock time from due_time', () => {
    expect(deadlineInstant(DUE)?.getTime()).toBe(DUE_AT.getTime());
  });

  it('defaults to 09:00 when no time is given, so an all-day deadline still has an instant', () => {
    const d = deadlineInstant({ due_date: '2026-10-12' });
    expect(d?.getHours()).toBe(9);
    expect(d?.getDate()).toBe(12);
  });

  it('builds in LOCAL time — a date-only deadline is not shifted by the UTC offset', () => {
    const d = deadlineInstant({ due_date: '2026-10-12' });
    expect(d?.getMonth()).toBe(9);   // October, not September/December
    expect(d?.getDate()).toBe(12);   // the 12th, always
  });

  it('accepts a full ISO stamp and uses its own clock time', () => {
    const d = deadlineInstant({ due_date: '2026-10-12T18:30:00' });
    expect(d?.getHours()).toBe(18);
    expect(d?.getMinutes()).toBe(30);
  });

  it('returns null rather than an Invalid Date for junk', () => {
    expect(deadlineInstant({ due_date: '' })).toBeNull();
    expect(deadlineInstant({ due_date: 'not-a-date' })).toBeNull();
  });

  it('rejects an out-of-range clock time instead of rolling into the next day', () => {
    // new Date(…, 25, 0) silently becomes the 26th. A bad time must not invent a day.
    const d = deadlineInstant({ due_date: '2026-10-12', due_time: '25:00' });
    expect(d?.getDate()).toBe(12);
    expect(d?.getHours()).toBe(9);   // falls back to the default, same day
  });
});

describe('fireTimeFor — the reminder resolves against the deadline', () => {
  it('a relative lead counts back from the deadline', () => {
    expect(fireTimeFor(rem({ lead_min: 60 }), DUE)!.getTime()).toBe(DUE_AT.getTime() - 3600e3);
  });

  it('a week of lead still lands on the right DAY, not 7×24h into the wrong one', () => {
    const f = fireTimeFor(rem({ lead_min: 10080 }), DUE)!;
    expect(f.getDate()).toBe(5);
    expect(f.getHours()).toBe(14);
  });

  it('an absolute reminder uses its own instant and ignores the lead', () => {
    const at = new Date(2026, 9, 11, 9, 0, 0);
    const f = fireTimeFor(rem({ mode: 'absolute', lead_min: 999, remind_at: at.toISOString() }), DUE)!;
    expect(f.getTime()).toBe(at.getTime());
  });

  it('MOVING THE DEADLINE MOVES A RELATIVE REMINDER WITH IT — this is the whole point', () => {
    const before = fireTimeFor(rem({ lead_min: 1440 }), DUE)!;
    const after  = fireTimeFor(rem({ lead_min: 1440 }), { due_date: '2026-10-15', due_time: '14:00' })!;
    const moved = new Date(2026, 9, 15, 14, 0, 0);
    expect(after.getDate() - before.getDate()).toBe(3);          // 3 days later
    // the OFFSET is what must be preserved, each against its own deadline
    expect(after.getTime() - moved.getTime()).toBe(before.getTime() - DUE_AT.getTime());
  });

  it('an absolute reminder does NOT move when the deadline moves', () => {
    const at = new Date(2026, 9, 11, 9, 0, 0).toISOString();
    const a = fireTimeFor(rem({ mode: 'absolute', remind_at: at }), DUE)!;
    const b = fireTimeFor(rem({ mode: 'absolute', remind_at: at }), { due_date: '2026-11-30' })!;
    expect(a.getTime()).toBe(b.getTime());
  });

  it('is null when the reminder has no usable time', () => {
    expect(fireTimeFor(rem({ mode: 'absolute', remind_at: null }), DUE)).toBeNull();
    expect(fireTimeFor(rem({ mode: 'absolute', remind_at: 'nonsense' }), DUE)).toBeNull();
  });
});

describe('describeLead — a lead time in words, not as 1440', () => {
  it('names the units a person uses', () => {
    expect(describeLead(0)).toBe('At the deadline');
    expect(describeLead(30)).toBe('30 minutes before');
    expect(describeLead(60)).toBe('1 hour before');
    expect(describeLead(120)).toBe('2 hours before');
    expect(describeLead(1440)).toBe('1 day before');
    expect(describeLead(10080)).toBe('1 week before');
  });

  it('says "1 minute" not "1 minutes"', () => {
    expect(describeLead(1)).toBe('1 minute before');
  });

  it('handles a mixed lead', () => {
    expect(describeLead(90)).toBe('1h 30m before');
  });

  it('treats junk as "at the deadline" rather than printing NaN', () => {
    expect(describeLead(NaN)).toBe('At the deadline');
    expect(describeLead(-5)).toBe('At the deadline');
  });
});

describe('describeWhen', () => {
  it('shows a relative lead AND the moment it resolves to', () => {
    expect(describeWhen(rem({ lead_min: 60 }), DUE, NOW)).toContain('1 hour before');
  });

  it('counts an absolute reminder down in human units', () => {
    const soon = new Date(NOW.getTime() + 30 * 60e3).toISOString();
    expect(describeWhen(rem({ mode: 'absolute', remind_at: soon }), DUE, NOW)).toContain('in 30 min');
  });

  it('says "already passed" for a reminder in the past', () => {
    const past = new Date(NOW.getTime() - 60e3).toISOString();
    expect(describeWhen(rem({ mode: 'absolute', remind_at: past }), DUE, NOW)).toBe('already passed');
  });

  it('is null when the deadline itself is unreadable', () => {
    expect(describeWhen(rem(), { due_date: '' }, NOW)).toBeNull();
  });
});

describe('normalizeReminder — the two modes, and the clamp', () => {
  it('accepts a relative lead', () => {
    const r = normalizeReminder({ mode: 'relative', lead_min: 1440 }, DUE, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ mode: 'relative', lead_min: 1440, remind_at: null });
  });

  it('clears the absolute field when switching to relative', () => {
    const r = normalizeReminder({ mode: 'relative', lead_min: 60, remind_at: '2026-10-11T09:00:00Z' }, DUE, NOW);
    expect(r.ok && r.value.remind_at).toBeNull();
  });

  it('clears the lead when switching to absolute', () => {
    const r = normalizeReminder({ mode: 'absolute', lead_min: 60, remind_at: new Date(2026, 9, 11, 9).toISOString() }, DUE, NOW);
    expect(r.ok && r.value.lead_min).toBe(0);
  });

  it('REJECTS a reminder after the deadline — that is not a reminder', () => {
    const after = new Date(2026, 9, 13, 9).toISOString();
    const r = normalizeReminder({ mode: 'absolute', remind_at: after }, DUE, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('cannot be after');
  });

  it('REJECTS a reminder in the past', () => {
    const past = new Date(2026, 9, 9, 9).toISOString();
    const r = normalizeReminder({ mode: 'absolute', remind_at: past }, DUE, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('already passed');
  });

  it('REJECTS a relative lead whose moment has already gone by', () => {
    const pastDue = { due_date: '2026-10-10', due_time: '13:00' };  // 1h after NOW
    const r = normalizeReminder({ mode: 'relative', lead_min: 120 }, pastDue, NOW);
    expect(r.ok).toBe(false);
  });

  it('rejects a bad absolute time with a usable message', () => {
    const r = normalizeReminder({ mode: 'absolute', remind_at: 'nonsense' }, DUE, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('could not be read');
  });

  it('rejects an empty absolute time', () => {
    const r = normalizeReminder({ mode: 'absolute', remind_at: '' }, DUE, NOW);
    expect(r.ok).toBe(false);
  });

  it('refuses everything when the deadline has no valid date', () => {
    const r = normalizeReminder({ mode: 'relative', lead_min: 60 }, { due_date: '' }, NOW);
    expect(r.ok).toBe(false);
  });
});

describe('liveReminders — several at once', () => {
  it('sorts by WHEN THEY FIRE, not by lead length', () => {
    const { live } = liveReminders([
      rem({ id: 'a', lead_min: 2880 }),    // fires 10 Oct 14:00
      rem({ id: 'b', lead_min: 60 }),       // fires 12 Oct 13:00
      rem({ id: 'c', lead_min: 1440 }),     // fires 11 Oct 14:00
    ], DUE, NOW);
    expect(live.map(r => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('separates out the ones that can no longer fire', () => {
    const { live, expired } = liveReminders([
      rem({ id: 'live', lead_min: 60 }),
      rem({ id: 'gone', mode: 'absolute', remind_at: new Date(2026, 9, 9, 9).toISOString() }),
    ], DUE, NOW);
    expect(live.map(r => r.id)).toEqual(['live']);
    expect(expired.map(r => r.id)).toEqual(['gone']);
  });

  it('drops a reminder the deadline moved back under', () => {
    const later = { due_date: '2026-10-30', due_time: '14:00' };
    const { live } = liveReminders([rem({ id: 'x', lead_min: 60 })], later, NOW);
    expect(live.map(r => r.id)).toEqual(['x']);
    // and it expires once the deadline comes back under it
    const past = { due_date: '2026-10-01', due_time: '14:00' };
    expect(liveReminders([rem({ id: 'x', lead_min: 60 })], past, NOW).live).toHaveLength(0);
  });

  it('never re-offers a reminder that already fired', () => {
    const { expired } = liveReminders([rem({ id: 'f', lead_min: 60, fired: 1 })], DUE, NOW);
    expect(expired.map(r => r.id)).toEqual(['f']);
  });

  it('an empty list is an empty list, not a crash', () => {
    expect(liveReminders([], DUE, NOW)).toEqual({ live: [], expired: [] });
  });

  it('survives a null entry in the array', () => {
    const { live } = liveReminders([null as any, rem({ id: 'ok', lead_min: 60 })], DUE, NOW);
    expect(live.map(r => r.id)).toEqual(['ok']);
  });
});

describe('newReminderId', () => {
  it('is unique per call', () => {
    const a = newReminderId('d1', NOW);
    const b = newReminderId('d1', NOW);
    expect(a).not.toBe(b);
    expect(a).toContain('d1');
  });
});
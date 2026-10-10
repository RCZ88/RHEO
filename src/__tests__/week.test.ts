/**
 * Week arithmetic — the local-clock rule and the Monday anchor.
 *
 * The repo had THREE incompatible week anchors (Monday in two files, Sunday in
 * App.tsx, ISO in the insights engine), so any weekly number disagreed with
 * itself for two days out of seven. Monday wins deliberately.
 */
import {
  toDateStr, parseDateStr, addDaysStr, mondayOf, weekDays,
  isoWeekKey, isoWeekBounds, daysUntil, daysActiveInWeek,
} from '../lib/week';

describe('week — the local clock rule', () => {
  it('toDateStr does not fall back to the previous day (the UTC+7 hazard)', () => {
    expect(toDateStr(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
  it('proves toISOString() WOULD have been wrong here', () => {
    // This is the bug this module exists to prevent, asserted so it cannot regress.
    expect(new Date(2026, 9, 5).toISOString().slice(0, 10) === '2026-10-05').toBe(false);
  });
  it('parseDateStr round-trips exactly', () => {
    expect(toDateStr(parseDateStr('2026-10-05'))).toBe('2026-10-05');
  });
  it('parseDateStr yields LOCAL midnight, not UTC midnight', () => {
    expect(parseDateStr('2026-10-05').getHours()).toBe(0);
  });
  it('round-trips across a year boundary', () => {
    expect(toDateStr(parseDateStr('2027-01-01'))).toBe('2027-01-01');
  });
});

describe('week — Monday anchor', () => {
  it('mondayOf(Sunday) is the Monday 6 days EARLIER, not the next one', () => {
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
  });
  it('mondayOf(Monday) is itself', () => expect(mondayOf('2026-10-05')).toBe('2026-10-05'));
  it('mondayOf(Saturday) is that weeks Monday', () => expect(mondayOf('2026-10-10')).toBe('2026-10-05'));
  it('weekDays spans Monday..Sunday', () => {
    expect(weekDays('2026-10-07').join()).toBe('2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-10,2026-10-11');
  });
  it('a week spanning new year still starts on a Monday', () => {
    expect(parseDateStr(weekDays('2027-01-04')[0]).getDay()).toBe(1);
  });
  it('a week spanning new year is 7 contiguous days', () => {
    const w = weekDays('2027-01-04');
    expect(w.length).toBe(7);
    expect(w.every((d, i) => i === 0 || addDaysStr(w[i - 1], 1) === d)).toBe(true);
  });
});

describe('week — boundary crossing', () => {
  it('crosses a month boundary', () => expect(addDaysStr('2026-10-31', 1)).toBe('2026-11-01'));
  it('crosses a year boundary', () => expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01'));
  it('goes backwards', () => expect(addDaysStr('2026-01-01', -1)).toBe('2025-12-31'));
});

describe('week — ISO key matches the format already in rewind_cache', () => {
  it('has the stored shape YYYY-Wnn', () => expect(/^2026-W\d{2}$/.test(isoWeekKey('2026-10-07'))).toBe(true));
  it('all 7 days of a week yield the SAME key', () => {
    expect(new Set(weekDays('2026-10-07').map(isoWeekKey)).size).toBe(1);
  });
  it('Sunday and the next Monday are different weeks', () => {
    expect(isoWeekKey('2026-10-11') !== isoWeekKey('2026-10-12')).toBe(true);
  });
  it('isoWeekBounds is the exact inverse of isoWeekKey + weekDays', () => {
    for (const d of ['2026-01-01', '2026-03-30', '2026-10-07', '2026-12-28', '2027-01-04']) {
      const b = isoWeekBounds(isoWeekKey(d));
      const w = weekDays(d);
      expect(b.start).toBe(w[0]);
      expect(b.end).toBe(w[6]);
    }
  });
  it('rejects a malformed key', () => expect(isoWeekBounds('nope')).toBeNull());
  it('rejects an out-of-range week', () => expect(isoWeekBounds('2026-W99')).toBeNull());
});

describe('week — weekly score primitive', () => {
  const w = weekDays('2026-10-07');
  it('counts 5 active days', () => expect(daysActiveInWeek('2026-10-07', w.slice(0, 5))).toBe(5));
  it('counts 0 for an empty week', () => expect(daysActiveInWeek('2026-10-07', [])).toBe(0));
  it('ignores days outside the week', () => expect(daysActiveInWeek('2026-10-07', [...w, '2026-10-19'])).toBe(7));
  it('a duplicate day cannot inflate the score', () => {
    expect(daysActiveInWeek('2026-10-07', [w[0], w[0], w[0], w[1], w[2], w[3], w[4]])).toBe(5);
  });
});

describe('week — bad input must not throw', () => {
  it('parseDateStr("") yields Invalid Date', () => expect(Number.isNaN(parseDateStr('').getTime())).toBe(true));
  it('mondayOf("junk") does not throw', () => expect(typeof mondayOf('junk')).toBe('string'));
  it('daysUntil("") is null', () => expect(daysUntil('')).toBeNull());
});

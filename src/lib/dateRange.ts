export type Period = 'today' | 'week' | '7day' | 'month' | '30day' | 'all';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDateRange(
  period: Period,
  dateOffset: number,
): DateRange {
  const now = new Date();

  if (period === 'today') {
    const d = new Date(now);
    d.setDate(d.getDate() - dateOffset);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      start,
      end,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }

  if (period === 'week') {
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;
    weekStart.setDate(weekStart.getDate() - diff - dateOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return {
      start: weekStart,
      end: weekEnd,
      label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  }

  if (period === '7day') {
    const end = new Date(now.getTime() - dateOffset * 7 * DAY_MS);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - 6 * DAY_MS);
    start.setHours(0, 0, 0, 0);
    return {
      start,
      end,
      label: dateOffset === 0
        ? 'Last 7 Days'
        : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  }

  if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - dateOffset, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    return {
      start: monthStart,
      end: monthEnd,
      label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }

  if (period === '30day') {
    const end = new Date(now.getTime() - dateOffset * 30 * DAY_MS);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - 29 * DAY_MS);
    start.setHours(0, 0, 0, 0);
    return {
      start,
      end,
      label: dateOffset === 0
        ? 'Last 30 Days'
        : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  }

  return {
    start: new Date(0),
    end: new Date(8640000000000000),
    label: 'All Time',
  };
}

export function isInRange(timestamp: string | number | Date, range: DateRange): boolean {
  const t = new Date(timestamp);
  return t >= range.start && t < range.end;
}

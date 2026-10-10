// ============================================================
// Normalizer for `get-dashboard-aggregates`.
//
// The IPC returns RAW ROWS:
//   { data: [{ date, app_name, app_type, total_seconds, sessions }] }
//
// But DashboardPage reads a SHAPE that no handler currently produces:
//   overview.{productiveSeconds,neutralSeconds,distractingSeconds,totalSeconds}
//   weeklyHeatmap[{ date, productiveHours }]
//   recentSessions, sleepData, avgSleep, sleepDebt, focusMinutes, focusProgress,
//   hourlyHeatmap, appStats, websiteStats
//
// `productiveSeconds` / `weeklyHeatmap` appear NOWHERE in main.ts, so every one of
// those reads resolved to undefined/0 through `?.` chaining — silently, with no
// error. This module derives that shape from the rows that DO exist.
//
// app_type carries the tier: 'productive' | 'neutral' | 'distracting'.
//
// Pure function: no IPC, no React, no side effects. Independently testable.
// ============================================================

export interface AggregateRow {
  date: string;
  app_name: string;
  /** 'app' | 'domain' — NOT a tier. See `tierOf` below. */
  app_type: string;
  /** 'IDE' | 'Browser' | 'Gaming' | … — THIS is the tier source. */
  category?: string;
  total_seconds: number;
  sessions: number;
}

/**
 * Category → tier. This mapping is duplicated from DashboardPage's
 * `DEFAULT_TIER_ASSIGNMENTS`; keep the two in sync.
 */
export const TIER_ASSIGNMENTS = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming'],
} as const;

export interface NormalizedAggregates {
  overview: {
    productiveSeconds: number;
    neutralSeconds: number;
    distractingSeconds: number;
    totalSeconds: number;
  };
  /** One entry per day that has data, oldest first. */
  weeklyHeatmap: {
    date: string;
    productiveHours: number;
    neutralHours: number;
    distractingHours: number;
    totalHours: number;
  }[];
  /** Most recent sessions, newest first. */
  recentSessions: {
    date: string;
    app: string;
    category: string;
    seconds: number;
    sessions: number;
  }[];
  /**
   * Per-day, per-hour seconds: `{ 'YYYY-MM-DD': { '0': secs, '1': secs, … } }`.
   *
   * NOTE: this used to be a flat `number[24]` indexed by HOUR, while DashboardPage
   * read it as `hourlyHeatmap[dateStr]` — an array indexed by a DATE STRING. That
   * always resolved to `undefined`, so the "today" view and the per-day fallback
   * both read zero for every hour. The keyed shape is what the page expects.
   */
  hourlyHeatmap: Record<string, Record<string, number>>;
  appStats: { app: string; category: string; seconds: number }[];
  websiteStats: { domain: string; seconds: number }[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Rows may carry either a bare day ('2026-09-29') or a full timestamp
 * ('2026-09-29T14:00:00Z'). The day strip and the heatmap must both key on the
 * DAY, otherwise one day splits into N entries.
 */
const dayOf = (d: unknown) => {
  if (typeof d !== 'string' || !d) return '';
  const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};

/**
 * Resolve a row's tier.
 *
 * The row's `app_type` column is only ever `'app'` or `'domain'` — it describes
 * what KIND of row this is, not how productive it was. Reading the tier from it
 * made every single row fall through to 'neutral', so `productiveSeconds` and
 * `distractingSeconds` were permanently 0 and the productivity chart rendered
 * no productive band at all. The tier actually lives in `category`.
 *
 * `app_type` is still honoured as a fallback, because a caller that already
 * resolved a tier there should not lose it.
 */
const tierOf = (row: AggregateRow): 'productive' | 'neutral' | 'distracting' => {
  const cat = typeof row?.category === 'string' ? row.category : '';
  if (cat) {
    if ((TIER_ASSIGNMENTS.productive as readonly string[]).includes(cat)) return 'productive';
    if ((TIER_ASSIGNMENTS.distracting as readonly string[]).includes(cat)) return 'distracting';
    return 'neutral';
  }
  const legacy = String(row?.app_type || '').toLowerCase();
  if (legacy === 'productive') return 'productive';
  if (legacy === 'distracting') return 'distracting';
  return 'neutral';
};

export function normalizeAggregates(raw: unknown): NormalizedAggregates {
  const rows: AggregateRow[] = Array.isArray((raw as any)?.data)
    ? ((raw as any).data as AggregateRow[])
    : Array.isArray(raw)
      ? (raw as AggregateRow[])
      : [];

  let productive = 0;
  let neutral = 0;
  let distracting = 0;

  const byDate = new Map<string, { productiveSeconds: number; neutralSeconds: number; distractingSeconds: number; totalSeconds: number }>();
  const hourly: Record<string, Record<string, number>> = {};
  const hourOf = (d: unknown) => {
    if (typeof d !== 'string') return NaN;
    // A full ISO timestamp has an hour at offset 11; a bare day does not.
    const m = d.match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}):/);
    return m ? Number(m[1]) : NaN;
  };

  // Hour-level rows, if the handler supplied them. `stats_daily` has no hour
  // column, so without this the per-hour breakdown was permanently empty.
  const hourlyRows: any[] = Array.isArray((raw as any)?.hourlyData)
    ? (raw as any).hourlyData
    : Array.isArray((raw as any)?.data)
      ? (raw as any).data
      : [];
  const byApp = new Map<string, { app: string; category: string; seconds: number }>();
  const byDomain = new Map<string, number>();
  const recent: NormalizedAggregates['recentSessions'] = [];

  for (const r of rows) {
    const seconds = num(r?.total_seconds);
    const sessions = num(r?.sessions);
    const category = tierOf(r as AggregateRow);
    const date = dayOf(r?.date);
    const hour = hourOf(r?.date);
    const name = typeof r?.app_name === 'string' ? r.app_name : 'Unknown';

    if (category === 'productive') productive += seconds;
    else if (category === 'distracting') distracting += seconds;
    else neutral += seconds;

    if (date) {
      const d = byDate.get(date) || { productiveSeconds: 0, neutralSeconds: 0, distractingSeconds: 0, totalSeconds: 0 };
      if (category === 'productive') d.productiveSeconds += seconds;
      else if (category === 'distracting') d.distractingSeconds += seconds;
      else d.neutralSeconds += seconds;
      d.totalSeconds += seconds;
      byDate.set(date, d);

      if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
        const dayHours = hourly[date] || (hourly[date] = {});
        dayHours[String(hour)] = (dayHours[String(hour)] || 0) + seconds;
      }

      recent.push({ date, app: name, category, seconds, sessions });
    }

    // Apps and domains live in the same column; split on a dot.
    if (name.includes('.')) {
      byDomain.set(name, (byDomain.get(name) || 0) + seconds);
    } else {
      const prev = byApp.get(name);
      if (prev) {
        prev.seconds += seconds;
      } else {
        byApp.set(name, { app: name, category, seconds });
      }
    }
  }

  // Hour-level rows feed ONLY the per-hour map. `stats_daily` and `stats_hourly`
  // are two roll-ups of the SAME tracked seconds, so adding hourly rows to the
  // daily buckets double-counted every second (the grand total came out at
  // exactly 2× on real data). Tiers stay sourced from the daily rows; the hourly
  // map carries volume only, which is all the "today" view needs.
  for (const r of hourlyRows) {
    const date = dayOf(r?.date);
    const hour = Number(r?.hour);
    if (!date || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const seconds = num(r?.total_seconds);
    if (seconds <= 0) continue;
    const dayHours = hourly[date] || (hourly[date] = {});
    dayHours[String(hour)] = (dayHours[String(hour)] || 0) + seconds;
  }

  const weeklyHeatmap = Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      productiveHours: v.productiveSeconds / 3600,
      neutralHours: v.neutralSeconds / 3600,
      distractingHours: v.distractingSeconds / 3600,
      totalHours: v.totalSeconds / 3600,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  recent.sort((a, b) => b.date.localeCompare(a.date));

  return {
    overview: {
      productiveSeconds: productive,
      neutralSeconds: neutral,
      distractingSeconds: distracting,
      totalSeconds: productive + neutral + distracting,
    },
    weeklyHeatmap,
    recentSessions: recent.slice(0, 25),
    hourlyHeatmap: hourly,
    appStats: Array.from(byApp.values()).sort((a, b) => b.seconds - a.seconds),
    websiteStats: Array.from(byDomain.entries())
      .map(([domain, seconds]) => ({ domain, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

/** The exact shape DashboardPage reads. Typing it (not `Record<string, unknown>`)
 *  keeps `overview.totalSeconds` etc. type-checked at the call site. */
export interface DashboardDataShape {
  overview: {
    productiveSeconds: number;
    neutralSeconds: number;
    distractingSeconds: number;
    totalSeconds: number;
  };
  weeklyHeatmap: {
    date: string;
    productiveHours: number;
    neutralHours: number;
    distractingHours: number;
    totalHours: number;
  }[];
  recentSessions: {
    date: string;
    app: string;
    category: string;
    seconds: number;
    sessions: number;
  }[];
  hourlyHeatmap: Record<string, Record<string, number>>;
  appStats: { app: string; category: string; seconds: number }[];
  websiteStats: { domain: string; seconds: number }[];
  sleepData: any[];
  avgSleep: number;
  sleepDebt: number;
  focusMinutes: number;
  focusProgress: number;
}

/** Folds normalized aggregates + sleep trend into the full DashboardPage shape. */
export function buildDashboardData(opts: {
  raw: unknown;
  sleep?: { daily?: any[]; average_sleep_duration?: number } | null;
  todaySleepHours?: number;
}): DashboardDataShape {
  const base = normalizeAggregates(opts.raw);
  const daily = Array.isArray(opts.sleep?.daily) ? opts.sleep!.daily! : [];
  const avgSleep = num(opts.sleep?.average_sleep_duration);
  const todaySleep = num(opts.todaySleepHours);

  // Deficit vs. a 7.5h target, floored at zero.
  const sleepDebt = avgSleep > 0 ? Math.max(0, 7.5 - avgSleep) : 0;

  return {
    ...base,
    sleepData: daily,
    avgSleep: todaySleep > 0 ? todaySleep : avgSleep,
    sleepDebt,
    focusMinutes: Math.round(base.overview.productiveSeconds / 60),
    focusProgress: base.overview.totalSeconds
      ? base.overview.productiveSeconds / base.overview.totalSeconds
      : 0,
  };
}

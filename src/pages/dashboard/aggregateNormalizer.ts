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
  app_type: string;
  total_seconds: number;
  sessions: number;
}

export interface NormalizedAggregates {
  overview: {
    productiveSeconds: number;
    neutralSeconds: number;
    distractingSeconds: number;
    totalSeconds: number;
  };
  /** One entry per day that has data, oldest first. */
  weeklyHeatmap: { date: string; productiveHours: number; totalHours: number }[];
  /** Most recent sessions, newest first. */
  recentSessions: {
    date: string;
    app: string;
    category: string;
    seconds: number;
    sessions: number;
  }[];
  /** 24 buckets of total seconds, index = hour of day. */
  hourlyHeatmap: number[];
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

/** Weekend days get a lower "productive" bar in the UI; keep the split honest. */
const TIER = (t: unknown): 'productive' | 'neutral' | 'distracting' => {
  const s = String(t || '').toLowerCase();
  if (s === 'productive') return 'productive';
  if (s === 'distracting') return 'distracting';
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

  const byDate = new Map<string, { productiveSeconds: number; totalSeconds: number }>();
  const hourly = new Array(24).fill(0);
  const byApp = new Map<string, { app: string; category: string; seconds: number }>();
  const byDomain = new Map<string, number>();
  const recent: NormalizedAggregates['recentSessions'] = [];

  for (const r of rows) {
    const seconds = num(r?.total_seconds);
    const sessions = num(r?.sessions);
    const category = TIER(r?.app_type);
    const date = dayOf(r?.date);
    const hour = Number(String(r?.date || '').slice(11, 13));
    const name = typeof r?.app_name === 'string' ? r.app_name : 'Unknown';

    if (category === 'productive') productive += seconds;
    else if (category === 'distracting') distracting += seconds;
    else neutral += seconds;

    if (date) {
      const d = byDate.get(date) || { productiveSeconds: 0, totalSeconds: 0 };
      if (category === 'productive') d.productiveSeconds += seconds;
      d.totalSeconds += seconds;
      byDate.set(date, d);

      if (Number.isInteger(hour) && hour >= 0 && hour < 24) hourly[hour] += seconds;

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

  const weeklyHeatmap = Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      productiveHours: v.productiveSeconds / 3600,
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
  weeklyHeatmap: { date: string; productiveHours: number; totalHours: number }[];
  recentSessions: {
    date: string;
    app: string;
    category: string;
    seconds: number;
    sessions: number;
  }[];
  hourlyHeatmap: number[];
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

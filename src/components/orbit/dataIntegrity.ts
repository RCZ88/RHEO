/**
 * Data-integrity layer for the Orbit (solar system) visualization.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Orbit view reads `stats_daily`, which a SQLite trigger buckets with
 * `DATE(NEW.timestamp)` — i.e. by UTC day — while the Dashboard heatmap and the
 * Activity page read the raw `logs` rows and bucket by LOCAL day. On a UTC+7
 * machine everything between 00:00 and 07:00 local is stamped with the previous
 * day. Measured on the live DB: `stats_daily` for 2026-10-04 held 447.7 min
 * while the `logs` rows for local Oct 4 held 473.2 min.
 *
 * So the pretty picture and the table underneath it disagree. This module makes
 * that disagreement MEASURABLE instead of invisible, and gives the view an
 * honest long tail instead of silently dropping everything small.
 *
 * EVERY FUNCTION HERE IS PURE. No React, no IPC, no THREE. That is deliberate:
 * it makes the numbers verifiable from a plain node probe, which is the only
 * kind of verification available when the renderer cannot be attached to a
 * debugger.
 */

/** A raw `logs` row, tolerating every field spelling the data layer has used. */
export interface LogLike {
  timestamp: string | Date;
  app?: string | null;
  category?: string | null;
  domain?: string | null;
  duration?: number | null;
  seconds?: number | null;
  total_ms?: number | null;
  duration_ms?: number | null;
  is_browser_tracking?: number | boolean | null;
  project?: string | null;
}

/** One row of `stats_daily` / the dashboard's normalized `appStats`. */
export interface AggregateRow {
  app?: string | null;
  app_name?: string | null;
  domain?: string | null;
  category?: string | null;
  seconds?: number | null;
  totalSeconds?: number | null;
  total_seconds?: number | null;
  total_ms?: number | null;
  duration_ms?: number | null;
  date?: string | null;
}

export interface PlanetAggregate {
  name: string;
  category: string;
  seconds: number;
  sessions: number;
}

export interface OthersBucket {
  /** Number of apps folded into this bucket. */
  count: number;
  seconds: number;
  sessions: number;
}

export interface VisualizationData {
  planets: PlanetAggregate[];
  /** Apps below `minSeconds`, preserved rather than discarded. */
  others: OthersBucket;
  /** Sum over `planets` + `others`. Never a partial total. */
  totalSeconds: number;
  totalSessions: number;
}

export interface AppDifference {
  app: string;
  solarSeconds: number;
  activitySeconds: number;
  deltaSeconds: number;
}

export interface ReconciliationReport {
  totalMatch: boolean;
  solarTotalSeconds: number;
  activityTotalSeconds: number;
  totalDeltaSeconds: number;
  /** Worst absolute per-app delta, for a one-line summary. */
  worst: AppDifference | null;
  perApp: AppDifference[];
  /** Apps present in one source and absent from the other. */
  onlyInSolar: string[];
  onlyInActivity: string[];
  toleranceSeconds: number;
}

/* ────────────────────────────── clock ────────────────────────────── */

/**
 * Local calendar day as `YYYY-MM-DD`.
 *
 * NEVER `toISOString().split('T')[0]`: `toISOString()` is UTC, so on a UTC+7
 * machine a local midnight serialises to the PREVIOUS day. That single
 * `.split('T')[0]` has silently mislabelled a day in at least three places in
 * this repo. Parse and format with one clock — the local one.
 */
export function localDayKey(ts: string | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local hour 0-23, or -1 for an unparseable timestamp. */
export function localHour(ts: string | Date): number {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return -1;
  return d.getHours();
}

/**
 * Seconds a row represents.
 *
 * The `logs` table has NO `duration` column — only `duration_ms`. The dashboard
 * aggregate normalizer emits `seconds`. The legacy shape used `duration`.
 * Reading only one spelling yields 0, and 0 is indistinguishable from "no time
 * spent", so an entire view can render empty with no error anywhere.
 */
export function rowSeconds(row: LogLike | AggregateRow | null | undefined): number {
  if (!row) return 0;
  const r = row as Record<string, unknown>;
  const msFirst = [r.total_ms, r.duration_ms];
  for (const v of msFirst) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v / 1000;
  }
  const secFirst = [r.seconds, r.totalSeconds, r.total_seconds, r.duration];
  for (const v of secFirst) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** The display name of a row: an app name, or a domain for browser rows. */
export function rowName(row: LogLike | AggregateRow): string {
  const r = row as Record<string, unknown>;
  const name = (r.app_name ?? r.app ?? r.domain ?? '') as string;
  return typeof name === 'string' ? name.trim() : '';
}

/* ─────────────────────── honest aggregation ─────────────────────── */

export interface AggregateOptions {
  /**
   * Apps below this many seconds are folded into `others` instead of being
   * dropped. The current view DISCARDS them, which is why a 3-minute app is
   * simply absent with no indication that it existed.
   */
  minSeconds?: number;
  /** Cap on returned planets. Survivors are the LARGEST, never the smallest. */
  maxPlanets?: number;
  /** Exclude browser/domain rows (the app view and the website view differ). */
  excludeBrowser?: boolean;
  /** Restrict to one local day (`YYYY-MM-DD`). */
  day?: string;
}

const isBrowserRow = (r: LogLike): boolean => r.is_browser_tracking === 1 || r.is_browser_tracking === true;

/**
 * Group rows into planets by app, preserving the long tail.
 *
 * Ordering note that has bitten this file before: the previous implementation
 * did `.slice(0, N)` on a DESCENDING-by-time list, and a sibling did
 * `.slice(-N)` on the SAME list — which kept the 80 SMALLEST apps and silently
 * deleted Visual Studio Code (the largest object in the database) from the
 * solar system. Survivors here are always the largest.
 */
export function aggregateForVisualization(
  rows: Array<LogLike | AggregateRow>,
  opts: AggregateOptions = {},
): VisualizationData {
  const { minSeconds = 30, maxPlanets = 80, excludeBrowser = true, day } = opts;

  const totals = new Map<string, { seconds: number; sessions: number; category: string }>();
  let grandSeconds = 0;
  let grandSessions = 0;

  for (const row of rows || []) {
    if (!row) continue;
    if (excludeBrowser && isBrowserRow(row as LogLike)) continue;
    const name = rowName(row);
    if (!name) continue;
    if (day) {
      const ts = (row as LogLike).timestamp;
      if (ts === undefined || localDayKey(ts as string | Date) !== day) continue;
    }
    const seconds = rowSeconds(row);
    // Sessions: a raw log row IS a session; an aggregate row carries its own
    // count. Zero-duration rows still count as a session if the source has a
    // count, otherwise they are not evidence of anything.
    const declared = (row as Record<string, unknown>).session_count ?? (row as Record<string, unknown>).sessions;
    const sessions = typeof declared === 'number' && Number.isFinite(declared) && declared > 0
      ? declared
      : (row as LogLike).timestamp !== undefined ? 1 : 0;

    const entry = totals.get(name) || { seconds: 0, sessions: 0, category: '' };
    entry.seconds += seconds;
    entry.sessions += sessions;
    if (!entry.category) entry.category = (row.category as string) || 'Other';
    totals.set(name, entry);
    grandSeconds += seconds;
    grandSessions += sessions;
  }

  const all = [...totals.entries()].map(([name, v]) => ({ name, ...v }));
  const big = all.filter((a) => a.seconds >= minSeconds).sort((a, b) => b.seconds - a.seconds);
  const kept = big.slice(0, Math.max(0, maxPlanets));
  const small = all.filter((a) => !kept.includes(a));

  return {
    planets: kept.map((a) => ({ name: a.name, category: a.category, seconds: a.seconds, sessions: a.sessions })),
    others: {
      count: small.length,
      seconds: small.reduce((s, a) => s + a.seconds, 0),
      sessions: small.reduce((s, a) => s + a.sessions, 0),
    },
    totalSeconds: grandSeconds,
    totalSessions: grandSessions,
  };
}

/* ───────────────────────── reconciliation ───────────────────────── */

/**
 * Compare the numbers the Orbit view would show against the numbers the
 * Activity page shows for the SAME local day, and report every disagreement.
 *
 * This is RESULT.md §6.3's verification procedure, as a pure function so it can
 * be run from a probe or a test — which is the only way to actually prove the
 * two surfaces agree, instead of asserting it in a comment.
 *
 * `toleranceSeconds` absorbs per-row rounding; the aggregate normalizer rounds
 * to whole seconds, so a 1 s tolerance is the floor, not a nicety.
 */
export function reconcile(
  solarRows: Array<AggregateRow>,
  activityRows: Array<LogLike>,
  opts: { day?: string; toleranceSeconds?: number; excludeBrowser?: boolean } = {},
): ReconciliationReport {
  const { day, toleranceSeconds = 1, excludeBrowser = true } = opts;

  const solar = aggregateForVisualization(solarRows as Array<LogLike | AggregateRow>, {
    minSeconds: 0, maxPlanets: Number.MAX_SAFE_INTEGER, excludeBrowser, day: undefined,
  });
  const activity = aggregateForVisualization(activityRows, {
    minSeconds: 0, maxPlanets: Number.MAX_SAFE_INTEGER, excludeBrowser, day,
  });

  const solarByApp = new Map(solar.planets.map((p) => [p.name, p.seconds]));
  const activityByApp = new Map(activity.planets.map((p) => [p.name, p.seconds]));

  const names = new Set<string>([...solarByApp.keys(), ...activityByApp.keys()]);
  const perApp: AppDifference[] = [];
  const onlyInSolar: string[] = [];
  const onlyInActivity: string[] = [];

  for (const name of names) {
    const a = solarByApp.get(name) ?? 0;
    const b = activityByApp.get(name) ?? 0;
    if (solarByApp.has(name) && !activityByApp.has(name)) onlyInSolar.push(name);
    if (!solarByApp.has(name) && activityByApp.has(name)) onlyInActivity.push(name);
    const delta = a - b;
    if (Math.abs(delta) > toleranceSeconds || (a === 0) !== (b === 0)) {
      perApp.push({ app: name, solarSeconds: a, activitySeconds: b, deltaSeconds: delta });
    }
  }
  perApp.sort((x, y) => Math.abs(y.deltaSeconds) - Math.abs(x.deltaSeconds));

  const totalDelta = solar.totalSeconds - activity.totalSeconds;

  return {
    totalMatch: Math.abs(totalDelta) <= toleranceSeconds,
    solarTotalSeconds: solar.totalSeconds,
    activityTotalSeconds: activity.totalSeconds,
    totalDeltaSeconds: totalDelta,
    worst: perApp[0] ?? null,
    perApp,
    onlyInSolar,
    onlyInActivity,
    toleranceSeconds,
  };
}

/** One-line human summary for a console stamp or a dev-tools check. */
export function describeReconciliation(r: ReconciliationReport): string {
  const head = r.totalMatch
    ? `MATCH (Δ${r.totalDeltaSeconds.toFixed(1)}s)`
    : `MISMATCH Δ${r.totalDeltaSeconds.toFixed(1)}s`;
  const parts = [
    `[orbit] ${head}`,
    `solar=${(r.solarTotalSeconds / 3600).toFixed(2)}h`,
    `activity=${(r.activityTotalSeconds / 3600).toFixed(2)}h`,
  ];
  if (r.perApp.length) parts.push(`${r.perApp.length} app(s) differ, worst=${r.worst?.app} (${r.worst?.deltaSeconds.toFixed(0)}s)`);
  return parts.join(' · ');
}
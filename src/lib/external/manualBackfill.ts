// Manual backfill — turns a user-written specification into concrete usage spans.
//
// This is a GENERATOR, not a filler of pre-baked data: the caller supplies the
// shape (which apps, how long, how random) and this decides where each minute
// lands. Nothing here writes to the database — the caller decides that, which is
// why a preview can be produced without touching a single row.
//
// Placement is delegated to `scatterChunks` from ./manualTime rather than
// reimplemented. That function carries a hard invariant (it MUST keep BOTH the
// leading and tail leftover when placing a chunk, MUST use floor for the
// whole-minute start, and MUST carry the unplaced delta when clamping) and has a
// 500-trial verification harness behind it. Re-deriving that logic here would
// risk silently reintroducing the discarded-capacity bug it was fixed for.

import { scatterChunks, type TimeInterval } from './manualTime';

const MS_MIN = 60 * 1000;

export interface BackfillApp {
  app: string;
  category: string;
  /** Relative likelihood. 0 = never. Normalised internally. */
  weight: number;
}

export interface BackfillSpec {
  /** Inclusive range, YYYY-MM-DD. Never defaulted to any particular month. */
  from: string;
  to: string;
  apps: BackfillApp[];
  weekdayHours: number;
  weekendHours: number;
  /** Multiplier on the day length. 1 = as specified, 1.5 = 50% longer. */
  intensity: number;
  /** 0 = every day identical, 1 = wildly different day lengths. */
  variance: number;
  /** Target sessions per day. */
  chunksPerDay: number;
  /** Local hours the day may occupy, e.g. 8..23. */
  dayStartHour: number;
  dayEndHour: number;
  /**
   * Same seed reproduces the identical result; change it to re-roll.
   * This is what makes a generated week reviewable — you can regenerate until it
   * looks right and then reproduce exactly what you approved.
   */
  seed: number;
}

export interface GeneratedSpan {
  /** YYYY-MM-DD */
  date: string;
  start: Date;
  end: Date;
  app: string;
  category: string;
  minutes: number;
}

export interface GeneratedDay {
  date: string;
  isWeekend: boolean;
  plannedMinutes: number;
  placedMinutes: number;
  spans: GeneratedSpan[];
}

// Deterministic 32-bit PRNG (mulberry32). Fast, good enough distribution for
// plausible-looking day shapes, and fully reproducible from an integer seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs `fn` with Math.random replaced by a seeded PRNG, then restores it.
 *
 * scatterChunks/splitDurations call Math.random() directly and are covered by an
 * existing invariant test, so they are left untouched. Swapping the global for the
 * duration of one synchronous call is what lets them stay byte-for-byte
 * identical while still being reproducible. Safe here because the whole
 * generation is synchronous — no async work can observe the swap. If that ever
 * changes, this must become a threaded RNG passed down instead.
 */
export function withSeed<T>(seed: number, fn: (rand: () => number) => T): T {
  const realRandom = Math.random;
  const rand = mulberry32(seed);
  Math.random = rand;
  try {
    return fn(rand);
  } finally {
    Math.random = realRandom;
  }
}

export function isWeekendDate(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Local-midnight Date for a YYYY-MM-DD string. */
export function localDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

/** Inclusive list of YYYY-MM-DD keys from `from` to `to`. */
export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = localDayStart(from);
  const end = localDayStart(to);
  // Guard against an inverted range looping forever.
  if (isNaN(cur.getTime()) || isNaN(end.getTime()) || cur > end) return out;
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    if (out.length > 3660) break; // ~10y sanity ceiling
  }
  return out;
}

function pickWeighted(apps: BackfillApp[], rand: () => number): BackfillApp | null {
  const usable = apps.filter((a) => a.weight > 0 && a.app);
  if (usable.length === 0) return null;
  const total = usable.reduce((s, a) => s + a.weight, 0);
  if (total <= 0) return usable[Math.floor(rand() * usable.length)];
  let r = rand() * total;
  for (const a of usable) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return usable[usable.length - 1];
}

/**
 * Builds the spec for a range without generating anything — used by the preview
 * so the user sees the shape before any row exists.
 */
export function planBackfill(
  spec: BackfillSpec,
  occupiedByDate: Record<string, TimeInterval[]> = {}
): GeneratedDay[] {
  const dates = enumerateDates(spec.from, spec.to);
  if (dates.length === 0) return [];

  // Each day gets its own derived seed so adding a day to the range does not
  // reshuffle every later day, but re-running the same range is identical.
  const baseSeed = spec.seed >>> 0;

  return withSeed(baseSeed, (rand) =>
    dates.map((dateKey, idx) => {
      const dayStart = localDayStart(dateKey);
      const weekend = isWeekendDate(dayStart);
      const baseHours = weekend ? spec.weekendHours : spec.weekdayHours;

      // Variance bends the day length either side of the base. Bounded to
      // [0.35, 1.65]× so a "low usage" day still reads as a day rather than
      // vanishing and leaving a hole in the chart.
      const spread = 0.65 * spec.variance;
      const dayFactor = 1 + (rand() * 2 - 1) * spread;
      const plannedMinutes = Math.max(
        15,
        Math.round(baseHours * 60 * spec.intensity * dayFactor)
      );

      // Occupancies already in the database for this day (real tracked time and
      // earlier manual entries) so generation never proposes writing over them.
      const occupied = occupiedByDate[dateKey] || [];

      const spanStart = new Date(dayStart);
      spanStart.setHours(spec.dayStartHour, 0, 0, 0);
      const spanEnd = new Date(dayStart);
      spanEnd.setHours(spec.dayEndHour, 0, 0, 0);

      // Vary the session count a little so a month is not a metronome.
      const chunkCount = Math.max(
        1,
        Math.round(spec.chunksPerDay * (0.7 + rand() * 0.6))
      );

      const placed = scatterChunks({
        spanStart,
        spanEnd,
        totalMinutes: plannedMinutes,
        chunkCount,
        occupied,
        minChunkMinutes: 10,
      });

      const spans: GeneratedSpan[] = placed.map((c) => {
        const chosen = pickWeighted(spec.apps, rand) || {
          app: 'Manual time',
          category: 'other',
          weight: 1,
        };
        return {
          date: dateKey,
          start: c.start,
          end: c.end,
          app: chosen.app,
          category: chosen.category,
          minutes: Math.max(1, Math.round((c.end.getTime() - c.start.getTime()) / MS_MIN)),
        };
      });

      return {
        date: dateKey,
        isWeekend: weekend,
        plannedMinutes,
        placedMinutes: spans.reduce((s, x) => s + x.minutes, 0),
        spans,
      };
    })
  );
}

export interface BackfillTotals {
  days: number;
  plannedMinutes: number;
  placedMinutes: number;
  spanCount: number;
}

export function summarise(days: GeneratedDay[]): BackfillTotals {
  return {
    days: days.length,
    plannedMinutes: days.reduce((s, d) => s + d.plannedMinutes, 0),
    placedMinutes: days.reduce((s, d) => s + d.placedMinutes, 0),
    spanCount: days.reduce((s, d) => s + d.spans.length, 0),
  };
}

// ---------------------------------------------------------------------------
// History as the template library
// ---------------------------------------------------------------------------

export interface DayTemplateApp {
  app: string;
  category: string;
  minutes: number;
  /** Share of the day this app occupied, 0..1. Becomes the backfill weight. */
  share: number;
}

export interface DayTemplate {
  date: string;
  totalMinutes: number;
  apps: DayTemplateApp[];
  firstHour: number;
  lastHour: number;
}

export interface RawLogRow {
  timestamp: string;
  app: string;
  category: string;
  duration_ms: number;
}

/**
 * Builds a reusable template from a day that has already been logged — tracked
 * or previously filled. This is deliberately the ONLY way to make a template:
 * the shape always comes from real rows, so "reuse my Thursday" cannot drift
 * into a shape nobody ever actually had.
 *
 * Excludes source='manual' rows unless asked, so a day can be re-derived from
 * purely real tracking.
 */
export function deriveDayTemplate(
  rows: RawLogRow[],
  opts: { excludeManual?: boolean } = {}
): DayTemplate | null {
  const excludeManual = opts.excludeManual !== false;

  const perApp = new Map<string, { category: string; ms: number }>();
  let firstMs = Infinity;
  let lastMs = -Infinity;
  let totalMs = 0;

  for (const r of rows || []) {
    const ms = Math.max(0, r.duration_ms || 0);
    if (ms <= 0) continue;
    // 'source' is absent from pre-migration rows, which are all real tracking.
    const src = (r as RawLogRow & { source?: string }).source;
    if (excludeManual && src === 'manual') continue;

    const t = new Date(r.timestamp).getTime();
    if (!isFinite(t)) continue;
    if (t < firstMs) firstMs = t;
    if (t > lastMs) lastMs = t;
    totalMs += ms;

    const cur = perApp.get(r.app);
    if (cur) cur.ms += ms;
    else perApp.set(r.app, { category: r.category || 'other', ms });
  }

  if (totalMs <= 0) return null;

  const apps: DayTemplateApp[] = [...perApp.entries()]
    .map(([app, v]) => ({
      app,
      category: v.category,
      minutes: Math.max(1, Math.round(v.ms / MS_MIN)),
      share: v.ms / totalMs,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    date: new Date(firstMs).toISOString().slice(0, 10),
    totalMinutes: Math.round(totalMs / MS_MIN),
    apps,
    firstHour: new Date(firstMs).getHours(),
    lastHour: new Date(lastMs).getHours(),
  };
}

/** Turns a derived template back into something planBackfill() accepts. */
export function templateToSpecApps(template: DayTemplate): BackfillApp[] {
  return template.apps.map((a) => ({
    app: a.app,
    category: a.category,
    weight: Math.max(0.0001, a.share),
  }));
}

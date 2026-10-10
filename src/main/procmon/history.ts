/**
 * procmon — history, growth analysis, and persistence
 *
 * Purpose: let an AI distinguish Case A (1.2 GB, stable for 30 min) from
 * Case B (400 MB -> 2.0 GB). A single instantaneous sample cannot; a bounded
 * ring plus compact persisted rollups can, and it survives an app restart.
 *
 * Storage shape:
 *   - in-memory ring: ~300 samples per workspace (1 Hz for 5 min), pruned by age
 *   - persisted rollups: one row per workspace per minute, kept 48 h
 *
 * Raw 1 Hz samples are deliberately NOT persisted forever. The requirement is
 * that a fresh AI session can see roughly the last hour; minute rollups cover
 * that at 1/60th the rows.
 */

import type { GrowthAnalysis, GrowthVerdict, HistorySeries } from './types';
import { GROWTH_VERDICT_MEANING } from './types';

export interface HistorySample {
  ts: number;
  rssMb: number;
  pssMb: number | null;
  cpuPctOfCore: number | null;
  swapMb: number | null;
  procCount: number;
  threadCount: number;
}

/** In-memory samples older than this are pruned regardless of count. */
const RING_MAX_AGE_MS = 30 * 60 * 1000;
const RING_MAX_SAMPLES = 300;
/** How often a rollup row is written. */
const ROLLUP_INTERVAL_MS = 60 * 1000;
const ROLLUP_RETENTION_MS = 48 * 60 * 60 * 1000;

const MB = 1024 * 1024;

export class WorkspaceHistory {
  readonly workspaceId: string;
  private ring: HistorySample[] = [];
  private events: { ts: number; appeared: number; disappeared: number }[] = [];
  private lastRollupTs = 0;
  private rollupPending: HistorySample | null = null;
  /** Set false for workspaces that must never be written (e.g. tests). */
  persistEnabled: boolean;
  /** One-shot guard so persisted history is restored exactly once. */
  private seeded = false;

  constructor(workspaceId: string, persistEnabled = true) {
    this.workspaceId = workspaceId;
    this.persistEnabled = persistEnabled;
  }

  /**
   * Seed the ring from persisted rollups, once, on first use.
   *
   * Without this, restarting the app blanks the history: the ring starts empty,
   * so `growth_verdict` would be `insufficient_data` for the next MIN_SAMPLES
   * ticks -- up to half an hour of a 1 Hz workspace -- even though an hour of
   * minute rollups is sitting in the database. That defeats the entire point of
   * persisting them.
   *
   * Returns the number of samples restored. Never throws: a failed read just
   * means no history, which is a correct state, not an error.
   */
  seedFromPersisted(): number {
    if (this.seeded) return 0;
    this.seeded = true;
    const stored = readRollups(this.workspaceId);
    if (!stored || !stored.samples || stored.samples.length === 0) return 0;
    for (const s of stored.samples) {
      this.ring.push({
        ts: s.ts,
        rssMb: s.rssMb,
        pssMb: s.pssMb,
        cpuPctOfCore: s.cpuPct,
        swapMb: s.swapMb,
        procCount: s.procCount,
        threadCount: s.threadCount,
      });
    }
    // Rollups can predate RING_MAX_AGE_MS; prune so the ring stays bounded.
    const newest = this.ring.length ? this.ring[this.ring.length - 1].ts : Date.now();
    const cutoff = newest - RING_MAX_AGE_MS;
    while (this.ring.length > 0 && this.ring[0].ts < cutoff) this.ring.shift();
    while (this.ring.length > RING_MAX_SAMPLES) this.ring.shift();
    // Do not immediately rewrite a row we just read back.
    this.lastRollupTs = newest;
    return this.ring.length;
  }

  add(sample: HistorySample): void {
    this.ring.push(sample);
    // Prune by age AND count so a workspace that was sampled at 1 Hz for half
    // an hour cannot grow without bound.
    const cutoff = sample.ts - RING_MAX_AGE_MS;
    while (this.ring.length > 0 && this.ring[0].ts < cutoff) this.ring.shift();
    while (this.ring.length > RING_MAX_SAMPLES) this.ring.shift();

    if (this.persistEnabled) {
      if (!this.lastRollupTs) {
        this.lastRollupTs = sample.ts;
        this.rollupPending = sample;
      } else if (sample.ts - this.lastRollupTs >= ROLLUP_INTERVAL_MS) {
        // Roll up the sample that was pending, not the newest one, so the
        // newest second is still available if the app dies in the next 59 s.
        if (this.rollupPending) writeRollup(this.workspaceId, this.rollupPending);
        this.rollupPending = sample;
        this.lastRollupTs = sample.ts;
      }
    }
  }

  addEvent(ts: number, appeared: number, disappeared: number): void {
    this.events.push({ ts, appeared, disappeared });
    const cutoff = ts - RING_MAX_AGE_MS;
    while (this.events.length > 0 && this.events[0].ts < cutoff) this.events.shift();
  }

  /** Flush a pending rollup. Called on workspace teardown. */
  flush(): void {
    if (this.persistEnabled && this.rollupPending) {
      writeRollup(this.workspaceId, this.rollupPending);
      this.rollupPending = null;
      this.lastRollupTs = 0;
    }
  }

  eventCounts(nowMs: number): {
    appeared: number;
    disappeared: number;
    appearedPerMin: number;
    disappearedPerMin: number;
  } {
    const windowMs = 60 * 1000;
    const cutoff = nowMs - windowMs;
    let appeared = 0;
    let disappeared = 0;
    for (const e of this.events) {
      if (e.ts < cutoff) continue;
      appeared += e.appeared;
      disappeared += e.disappeared;
    }
    return {
      appeared,
      disappeared,
      appearedPerMin: appeared,
      disappearedPerMin: disappeared,
    };
  }

  series(_nowMs?: number): HistorySeries {
    // Downsample for the payload: the AI needs the shape, not 300 rows. Oldest
    // buckets get thinned so the window still spans the full retention.
    const src = this.ring;
    const target = 40;
    let samples = src;
    if (src.length > target) {
      const step = Math.ceil(src.length / target);
      samples = src.filter((_, i) => i % step === 0);
      if (samples[samples.length - 1] !== src[src.length - 1]) samples.push(src[src.length - 1]);
    }
    const out = samples.map((s) => ({
      ts: s.ts,
      rssMb: round1(s.rssMb),
      pssMb: s.pssMb === null ? null : round1(s.pssMb),
      cpuPct: s.cpuPctOfCore === null ? null : round1(s.cpuPctOfCore),
      swapMb: s.swapMb === null ? null : round1(s.swapMb),
      procCount: s.procCount,
      threadCount: s.threadCount,
    }));
    const windowSec = src.length > 1 ? (src[src.length - 1].ts - src[0].ts) / 1000 : 0;
    const hasGaps = detectGaps(src);
    return {
      samples: out,
      sampleCount: src.length,
      windowSec: Math.round(windowSec),
      hasGaps,
      note:
        `Downsampled from ${src.length} raw samples. ` +
        (hasGaps
          ? 'SAMPLING GAPS PRESENT — the monitor was suspended or busy; do not read a slope across a gap as a continuous trend.'
          : 'No sampling gaps in this window.'),
    };
  }

  /** Stats used for the payload's current/peak/average set. */
  stats(): { peakRssMb: number; avgRssMb: number; peakPssMb: number | null; avgCpuPct: number | null } | null {
    if (this.ring.length === 0) return null;
    let peakRss = 0;
    let sumRss = 0;
    let peakPss: number | null = null;
    let sumPss = 0;
    let pssN = 0;
    let sumCpu = 0;
    let cpuN = 0;
    for (const s of this.ring) {
      if (s.rssMb > peakRss) peakRss = s.rssMb;
      sumRss += s.rssMb;
      if (s.pssMb !== null) {
        if (peakPss === null || s.pssMb > peakPss) peakPss = s.pssMb;
        sumPss += s.pssMb;
        pssN++;
      }
      if (s.cpuPctOfCore !== null) {
        sumCpu += s.cpuPctOfCore;
        cpuN++;
      }
    }
    return {
      peakRssMb: round1(peakRss),
      avgRssMb: round1(sumRss / this.ring.length),
      peakPssMb: peakPss === null ? null : round1(peakPss),
      avgCpuPct: cpuN === 0 ? null : round1(sumCpu / cpuN),
    };
  }

  growth(_nowMs?: number): GrowthAnalysis {
    return analyseGrowth(this.ring);
  }

  /** Load persisted rollups from a previous app run. */
  static loadPersisted(workspaceId: string): HistorySeries | null {
    return readRollups(workspaceId);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function detectGaps(samples: HistorySample[]): boolean {
  if (samples.length < 3) return false;
  const intervals: number[] = [];
  for (let i = 1; i < samples.length; i++) intervals.push(samples[i].ts - samples[i - 1].ts);
  const sorted = intervals.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median > 0 && sorted[sorted.length - 1] > median * 4;
}

/* ------------------------------------------------------------------ */
/* Growth analysis                                                     */
/* ------------------------------------------------------------------ */

/** Minimum samples before any trend verdict is offered. */
const MIN_SAMPLES = 8;
/** Minimum window before a slope means anything. */
const MIN_WINDOW_MS = 60 * 1000;
/** MB/min above which growth is 'rapid_growth'. */
const RAPID_MB_PER_MIN = 25;
/** MB/min above which growth is 'slow_growth'. */
const SLOW_MB_PER_MIN = 2;

/**
 * Least-squares slope over the ring, in MB/min.
 *
 * Uses PSS when it is available for enough samples, else RSS — and says which
 * it used, because a slope in "RSS-sum" units is a different claim from a slope
 * in "PSS" units (the former can rise purely because children were added).
 */
export function analyseGrowth(ring: HistorySample[], _nowMs?: number): GrowthAnalysis {
  const usePss = ring.filter((s) => s.pssMb !== null).length >= MIN_SAMPLES;
  const series = usePss ? ring.filter((s) => s.pssMb !== null) : ring;

  if (series.length < MIN_SAMPLES) {
    return {
      verdict: 'insufficient_data',
      verdictMeaning: GROWTH_VERDICT_MEANING.insufficient_data,
      rateMbPerMin: null,
      observationWindowSec: 0,
      evidence: {
        firstMb: series[0] ? val(series[0], usePss) : null,
        lastMb: series.length ? val(series[series.length - 1], usePss) : null,
        minMb: null,
        maxMb: null,
        peakMb: null,
        meanMb: null,
        monotonicIncrease: null,
        validSamples: series.length,
      },
      note:
        `Only ${series.length} sample(s); ${MIN_SAMPLES} required, and a verdict needs at least ` +
        `${MIN_WINDOW_MS / 1000}s of observation. Basis would have been ${usePss ? 'PSS' : 'RSS'}.`,
    };
  }

  const ys = series.map((s) => val(s, usePss) as number);
  const firstTs = series[0].ts;
  const xs = series.map((s) => (s.ts - firstTs) / 60000); // minutes
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slope = den > 0 ? num / den : 0;
  const windowSec = (series[series.length - 1].ts - firstTs) / 1000;

  let monotonic = true;
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] < ys[i - 1] - 1.5) {
      // A 1.5 MB tolerance stops allocator noise reading as a saw-tooth, while
      // still catching a real one-way climb.
      monotonic = false;
      break;
    }
  }

  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const delta = ys[ys.length - 1] - ys[0];

  let verdict: GrowthVerdict;
  if (slope >= RAPID_MB_PER_MIN) verdict = 'rapid_growth';
  else if (slope >= SLOW_MB_PER_MIN) verdict = 'slow_growth';
  else if (slope <= -SLOW_MB_PER_MIN) verdict = 'decreasing';
  else verdict = 'stable';

  if (windowSec < MIN_WINDOW_MS / 1000) verdict = 'insufficient_data';

  return {
    verdict,
    verdictMeaning: GROWTH_VERDICT_MEANING[verdict],
    rateMbPerMin: round1(slope),
    observationWindowSec: Math.round(windowSec),
    evidence: {
      firstMb: round1(ys[0]),
      lastMb: round1(ys[ys.length - 1]),
      minMb: round1(min),
      maxMb: round1(max),
      peakMb: round1(max),
      meanMb: round1(mean),
      monotonicIncrease: monotonic,
      validSamples: n,
    },
    note:
      `Least-squares slope over ${n} samples / ${Math.round(windowSec)}s, basis = ${usePss ? 'PSS' : 'RSS'}` +
      `(mean ${round1(mean)} MB, spread ${round1(max - min)} MB, net change ${round1(delta)} MB). ` +
      `A rising slope is consistent with a leak or with unbounded accumulation, but it is NOT proof ` +
      `of either — check whether children were added (compare process_count) before concluding.`,
  };
}

function val(s: HistorySample, usePss: boolean): number | null {
  return usePss ? s.pssMb : s.rssMb;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

type RollupWriter = (workspaceId: string, s: HistorySample) => void;

/**
 * Injected by the caller (main.ts) so this module never touches the database
 * itself. Keeps procmon testable with no DB, and keeps the single-writer rule
 * in one place.
 */
let rollupWriter: RollupWriter | null = null;
type RollupReader = (workspaceId: string) => HistorySeries | null;
let rollupReader: RollupReader | null = null;

export function configureRollupStore(write: RollupWriter | null, read?: RollupReader | null): void {
  rollupWriter = write;
  if (read !== undefined) rollupReader = read;
}

function writeRollup(workspaceId: string, s: HistorySample): void {
  try {
    rollupWriter?.(workspaceId, s);
  } catch {
    /* never let telemetry persistence break sampling */
  }
}

function readRollups(workspaceId: string): HistorySeries | null {
  try {
    return rollupReader?.(workspaceId) ?? null;
  } catch {
    return null;
  }
}

export const HISTORY_CONSTANTS = {
  RING_MAX_AGE_MS,
  RING_MAX_SAMPLES,
  ROLLUP_INTERVAL_MS,
  ROLLUP_RETENTION_MS,
  MIN_SAMPLES,
  MIN_WINDOW_MS,
  RAPID_MB_PER_MIN,
  SLOW_MB_PER_MIN,
  MB,
};

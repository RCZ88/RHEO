/**
 * Stage 0 instrumentation for the Orbit view.
 *
 * Implements §2 of the performance RESULT.md. This file changes NO behaviour —
 * it only makes cost visible, which is finding F10: until now nothing in the app
 * could answer "is this scene slow, and which part".
 *
 * THE ONE SUBTLE THING, AND WHY IT MATTERS
 * ----------------------------------------
 * `renderer.info.autoReset` defaults to `true`, so the renderer zeroes its own
 * `render.*` counters on every internal `render()` call. This scene renders
 * through `EffectComposer`, which issues SEVERAL `renderer.render()` calls per
 * frame (scene pass, effect passes, final blit). With autoReset on, anything
 * reading `info.render.calls` asynchronously sees only the LAST pass — so the
 * naive reading is not merely imprecise, it reports a small number while the
 * frame is actually expensive.
 *
 * The fix is `autoReset = false` plus exactly ONE privileged reader that
 * accumulates the whole frame and then calls `info.reset()` itself.
 *
 * WHY A PRIORITY-0 `useFrame` IS THE CORRECT PLACE
 * ------------------------------------------------
 * `@react-three/postprocessing` takes over rendering by subscribing at
 * priority 1. Priority-0 callbacks run BEFORE that, so our sampler always runs
 * before the current frame's draws and therefore reads the PREVIOUS frame's
 * complete totals. One frame of lag, zero stalls, and no GPU readback.
 *
 * COST: a dozen integer property reads plus two `performance.now()` per frame —
 * single-digit microseconds against a 16.6 ms budget. No `readPixels`, no GPU
 * timer queries, no allocation per frame (all buffers preallocated).
 */

/** Named per-subsystem buckets. Scene JS time accumulates into these. */
export type Bucket =
  | 'dust' | 'belts' | 'stars' | 'planets' | 'moons'
  | 'disc' | 'camera' | 'controls' | 'hud';

export const BUCKETS: Bucket[] = [
  'dust', 'belts', 'stars', 'planets', 'moons', 'disc', 'camera', 'controls', 'hud',
];

/** Ring-buffer length. 120 samples ≈ 2 s at 60 fps. */
const RING = 120;
/** HUD flush interval. 2 Hz — never per frame, or React re-renders every frame. */
export const FLUSH_MS = 500;

export interface PerfSample {
  frameMs: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  sceneJsMs: number;
}

export interface PerfSnapshot {
  /** Median frame time over the ring — the number a human actually feels. */
  p50: number;
  p95: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
  /** Σ of all timed scene callbacks this window. This is the JS share of a frame. */
  sceneJsMs: number;
  /** Per-bucket scene-JS, so "which subsystem" is answerable inside the app. */
  buckets: Record<Bucket, number>;
  /** React commits per second, as a proxy for "is the reconciler the problem". */
  commitsPerSec: number;
  /**
   * Monotonic frame counter from `renderer.info.render.frame`. Used to prove
   * `frameloop="demand"` actually stopped rendering: if this stops advancing,
   * the loop really did stop. Costs nothing and settles O7 with a number.
   */
  renderFrame: number;
}

type AnyRenderer = {
  info: {
    autoReset: boolean;
    reset: () => void;
    render: { calls: number; triangles: number; points: number; lines: number; frame: number };
    memory: { geometries: number; textures: number };
    programs?: { length?: number } | null;
  };
};

const pct = (sorted: number[], p: number): number =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

/**
 * Module-level singleton. Deliberately NOT React state: writing to React state
 * every frame is precisely the reconciler cost the probe exists to detect.
 * The HUD subscribes to `onFlush` and is the only thing that re-renders.
 */
class PerfProbe {
  private frameTimes = new Float32Array(RING);
  private cursor = 0;
  private lastFrameAt = 0;

  private bucketMs: Record<Bucket, number> = {
    dust: 0, belts: 0, stars: 0, planets: 0, moons: 0, disc: 0, camera: 0, controls: 0, hud: 0,
  };

  private commitCount = 0;
  private commitWindowStart = performance.now();
  private commitsPerSec = 0;
  private last = { calls: 0, triangles: 0, points: 0, lines: 0, renderFrame: 0 };
  private installed = false;
  private listeners = new Set<(s: PerfSnapshot) => void>();

  /** Call once from the Canvas `onCreated` callback. Idempotent. */
  install(renderer: AnyRenderer) {
    if (this.installed) return;
    this.installed = true;
    renderer.info.autoReset = false;
    this.lastFrameAt = performance.now();
  }

  /**
   * Priority-0 frame sampler. Reads the PREVIOUS frame's accumulated totals,
   * then resets for this frame. Called from a single `useFrame(cb, 0)`.
   */
  sampleFrame(renderer: AnyRenderer) {
    const info = renderer.info;
    const now = performance.now();
    const frameMs = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;

    this.frameTimes[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % RING;

    // Accumulate this frame's scene-JS into the snapshot that will be flushed.
    this.last.calls = info.render.calls;
    this.last.triangles = info.render.triangles;
    this.last.points = info.render.points;
    this.last.lines = info.render.lines;
    this.last.renderFrame = info.render.frame;

    info.reset();
  }

  /**
   * Wrap a per-frame callback so its cost lands in a named bucket.
   * Behaviour-neutral: same function, same arguments, just timed.
   */
  timed<T extends (...args: never[]) => void>(bucket: Bucket, fn: T): T {
    return ((...args: never[]) => {
      const t0 = performance.now();
      fn(...args);
      this.bucketMs[bucket] += performance.now() - t0;
    }) as unknown as T;
  }

  /** Called from a cheap render body to count React commits. ~Zero cost. */
  markCommit() { this.commitCount += 1; }

  /** Interval flush — 2 Hz. Computes percentiles, notifies the HUD, resets. */
  flush(renderer: AnyRenderer) {
    const now = performance.now();
    const elapsed = now - this.commitWindowStart;
    if (elapsed >= FLUSH_MS) {
      this.commitsPerSec = (this.commitCount * 1000) / elapsed;
      this.commitCount = 0;
      this.commitWindowStart = now;
    }

    const times: number[] = [];
    for (let i = 0; i < RING; i++) if (this.frameTimes[i] > 0) times.push(this.frameTimes[i]);
    times.sort((a, b) => a - b);

    const snapshot: PerfSnapshot = {
      p50: pct(times, 0.5),
      p95: pct(times, 0.95),
      calls: this.last.calls,
      triangles: this.last.triangles,
      points: this.last.points,
      lines: this.last.lines,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0,
      sceneJsMs: BUCKETS.reduce((s, b) => s + this.bucketMs[b], 0),
      buckets: { ...this.bucketMs },
      commitsPerSec: this.commitsPerSec,
      renderFrame: this.last.renderFrame,
    };

    // Reset the per-window buckets so the HUD shows a rate, not a running total.
    for (const b of BUCKETS) this.bucketMs[b] = 0;

    for (const l of this.listeners) l(snapshot);
    return snapshot;
  }

  /** Subscribe to the 2 Hz flush. Returns an unsubscribe fn. */
  subscribe(fn: (s: PerfSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /**
   * Test seams. Stage 0's rule is that every claim must be provable without a
   * GPU, so the arithmetic is reachable directly.
   */
  _injectFrameMs(ms: number) {
    this.frameTimes[this.cursor] = ms;
    this.cursor = (this.cursor + 1) % RING;
  }
  _reset() {
    this.frameTimes = new Float32Array(RING);
    this.cursor = 0;
    this.lastFrameAt = performance.now();
    for (const b of BUCKETS) this.bucketMs[b] = 0;
    this.commitCount = 0;
    this.commitWindowStart = performance.now();
    this.commitsPerSec = 0;
    this.installed = false;
  }
}

export const perfProbe = new PerfProbe();

/**
 * §2.5 thresholds. Automatic step-down ONLY; incline is user-only, which is what
 * replaces PerformanceMonitor's flip-flop with hysteresis.
 */
export const DECLINE = {
  /** p95 frame time above this is a decline. */
  frameMs: 22,
  /** …sustained across this many consecutive flush windows (≥3 s). */
  windows: 3,
  /** Do not step down again within this window. */
  cooldownMs: 30_000,
  /** Never auto-step below this. */
  floor: 'performance' as const,
};
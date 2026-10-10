/**
 * perfTypes.ts — the profiler's vocabulary and all of its arithmetic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE IS SEPARATE FROM THE RECORDER
 *
 * `src/lib/perfRecorder.ts` touches `PerformanceObserver`, `requestAnimationFrame`
 * and `performance.memory`. None of those exist in the Node process that runs
 * `src/main.ts`, and none of them exist in a bare `node` probe. So the moment any
 * scoring rule lived next to the measurement code, it could only be tested by
 * loading a browser.
 *
 * This is the same split `src/shared/sleepWindow.ts` documents: pure logic here,
 * persistence/side-effects in `src/lib/`. The contract is verbatim —
 *
 *   PURE BY CONTRACT: no `window`, no `localStorage`, no `require`, no Electron.
 *
 * Every rule below is therefore verifiable by a plain Node script that prints
 * numbers, which is how the thresholds in §1 were checked rather than eyeballed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── 1. THRESHOLDS ──────────────────────────────────────────────────────────
 * These are not style choices. 16.7ms is one frame at 60Hz: exceed it and a
 * frame is dropped, which is the definition of the stutter a user feels. 50ms is
 * the Long Tasks API's own boundary — Chromium emits an entry for a task that
 * blocks the main thread longer than this, and nothing shorter is ever reported.
 * So the 50ms line is not our opinion, it is the boundary of what the platform
 * is even willing to tell us about.
 */
export const FRAME_BUDGET_MS = 16.7
export const LONG_TASK_MS = 50

/**
 * `verdictFor` returns one of these. The thresholds are deliberately NOT the
 * same as the tile colours: `busy` means "you are losing frames", which is
 * annoying, while `lagging` means "the UI is measurably frozen", which is a bug.
 */
export type PerfVerdict = 'smooth' | 'busy' | 'lagging' | 'unknown'

export interface Verdict {
  state: PerfVerdict
  /** Short imperative the user acts on, not a description of the number. */
  label: string
  /** One sentence naming the cause, because "LAGGING" alone is not actionable. */
  because: string
}

/* ── 2. WINDOW / CAPACITY ───────────────────────────────────────────────────
 * The trace is bounded on purpose. An unbounded array of samples is a memory
 * leak wearing a telemetry costume, and the whole point of this page is to
 * report on memory.
 */
export const TRACE_WINDOW_MS = 120_000
export const TRACE_MAX_SAMPLES = 900
export const MAX_LONG_TASKS = 240
export const MAX_PAGES = 60

/* ── 3. THE SAMPLE ───────────────────────────────────────────────────────────
 * ONE discriminated union keyed on `source`, and the key is not decoration: it
 * is the join between a number and the layer that produced it. A profiler that
 * shows "120ms" without saying whether Chromium's Long Tasks API, React, or the
 * host OS clock produced it is how a developer ends up debugging the wrong
 * process. `source` is rendered next to every number in the UI for that reason.
 */
export type PerfSource = 'longtask' | 'frame' | 'memory' | 'ipc' | 'host' | 'react'

export interface TraceSample {
  /** ms since session start (monotonic `performance.now()`), not epoch. */
  t: number
  source: PerfSource
  /** The measured quantity. For `frame` this is the frame's total duration. */
  value: number
  /** Unit label so a bare number is never rendered without one. */
  unit: 'ms' | 'MB' | '%' | 'fps'
  /** Route id active when this was measured. `null` = chrome, outside any page. */
  route: string | null
}

/** A single blocking task, kept verbatim because the stack is the whole point. */
export interface LongTaskRecord {
  id: string
  /** ms since session start. */
  t: number
  durationMs: number
  route: string | null
  /**
   * `PerformanceTaskAttributionTiming.name` — Chromium's own label ("self",
   * "same-origin", "unknown"). Reported verbatim rather than guessed at; in a
   * same-document app it is usually "unknown", and pretending otherwise would be
   * inventing attribution the platform never provided.
   */
  attribution: string
  containerType: string
}

/* ── 4. THE PER-PAGE LEDGER ──────────────────────────────────────────────────
 * One row per route. This is the artefact that answers "which page is slow",
 * which no single-number view can.
 */
export interface PageLedgerRow {
  route: string
  /**
   * No `label` here on purpose. The recorder stores the route id it was handed
   * by `deskflow:route`, and the VIEW resolves it to a human label through the
   * page registry. Putting a prettified string in the store would mean a second
   * place that decides how a route is named — which is exactly the drift the
   * page registry exists to prevent.
   */
  visits: number
  /** Wall-clock ms attributed to this route, across all visits. */
  observedMs: number
  longTasks: number
  /** Blocking ms / observed ms × 100. The comparable number — see below. */
  blockPct: number
  avgBlockMs: number
  p95BlockMs: number
  worstMs: number
  /** Total blocking time. NOT the worst single task — see `worstMs`. */
  totalBlockingMs: number
  /** Renderer heap delta across visits. Negative is a release. Negative heap
   *  growth across repeated visits to one page is the classic leak signature. */
  heapDeltaMB: number
  /** Median IPC round-trip observed while this route was active. */
  ipcMedianMs: number | null
  /** Newest-last sparkline of `blockPct`, for the trend column. */
  trend: number[]
}

/* ── 5. THE SNAPSHOT ────────────────────────────────────────────────────────
 * What `getSnapshot()` returns. One immutable object per publish, because
 * `useSyncExternalStore` compares by reference and a mutated object would make
 * React skip every re-render while the page silently showed stale numbers.
 */
export interface PerfSnapshot {
  /** Wall-clock ms since the recorder was first armed. */
  sessionMs: number
  armed: boolean
  /** Wall-clock ms during which measurement was actually running. */
  armedMs: number
  verdict: Verdict
  /** Share of observed wall-clock spent inside long tasks, 0–100. */
  blockingPct: number
  totalBlockingMs: number
  longTaskCount: number
  /** Worst single task this session. */
  worstMs: number
  /** p95 over the long-task durations recorded this session. */
  p95BlockMs: number
  /** Median of the last 120 frame samples. */
  frameMedianMs: number
  /** Share of sampled frames that exceeded the 16.7ms budget, 0–100. */
  droppedFramePct: number
  /** Frames per second, derived from the median frame duration. */
  fps: number
  heapUsedMB: number | null
  heapTotalMB: number | null
  heapLimitMB: number | null
  /** Heap slope in MB/min over the session. The leak indicator. */
  heapSlopeMBPerMin: number
  trace: TraceSample[]
  longTasks: LongTaskRecord[]
  /** Declared regions of work, for blaming a freeze on an operation. */
  marks: MarkRecord[]
  /** Uncaught errors, kept beside the stalls to give them context. */
  errors: ErrorRecord[]
  ledger: PageLedgerRow[]
  routesSeen: number
  /** Which measurement channels actually produced data, for honest labelling. */
  capabilities: PerfCapabilities
}

/**
 * Which channels are live in THIS build.
 *
 * This exists because the honest answer differs per environment and a profiler
 * that renders an unavailable channel as `0` is lying. In particular React's
 * `<Profiler onRender>` is stripped from production React builds, so component
 * timings are genuinely unavailable in the shipped app — the UI says so instead
 * of showing a column of zeros.
 */
export interface PerfCapabilities {
  longtask: boolean
  /**
   * Keys are deliberately identical to the `Layer` union so a view can index
   * `capabilities[layer]` with no lookup table. An earlier draft had `frames`
   * (plural) here and `frame` in `Layer`, which needed a mapping that nothing
   * enforced — the exact drift that makes a status panel lie about which
   * channel is live.
   */
  frame: boolean
  memory: boolean
  ipc: boolean
  host: boolean
  react: boolean
}

/* ── 6. ARITHMETIC ───────────────────────────────────────────────────────────
 * All pure. Verified by probe — see `agent/state/` for the printed numbers.
 */

/** Linear-interpolated percentile over an unsorted array. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}

export function median(values: readonly number[]): number {
  return percentile(values, 50)
}

/**
 * THE HEADLINE NUMBER.
 *
 * `blockingPct` is deliberately NOT "how many long tasks happened". A count is
 * not comparable across pages — ten 51ms tasks freeze the user for half a
 * second, ten 400ms tasks freeze them for four seconds, and both are "10".
 * Dividing blocking time by the wall-clock it was observed in makes every row
 * on the ledger comparable, which is the only property that makes a ranking
 * meaningful.
 */
export function blockingPct(totalBlockingMs: number, observedMs: number): number {
  if (!Number.isFinite(totalBlockingMs) || !Number.isFinite(observedMs) || observedMs <= 0) return 0
  const pct = (totalBlockingMs / observedMs) * 100
  return Math.min(100, Math.round(pct * 10) / 10)
}

/** Frames per second implied by a median frame duration. */
export function fpsFromFrameMs(frameMs: number): number {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return 0
  // 1000ms in a second — NOT 60_000. Writing 60_000 here silently clamped every
  // value to the 120 ceiling, which a probe caught; the unit is milliseconds.
  // Clamped at 120 because rAF can fire faster than 60Hz on a high-refresh
  // display, and "144fps" would read as a problem when it is the opposite.
  return Math.round(Math.min(120, 1000 / frameMs))
}

/** Signed least-squares slope of `values` against 0..n-1, in units per minute. */
export function slopePerMinute(values: readonly number[], windowMs: number): number {
  const n = values.length
  if (n < 3 || windowMs <= 0) return 0
  const stepMs = windowMs / (n - 1)
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const x = i * stepMs
    sumX += x
    sumY += values[i]
    sumXY += x * values[i]
    sumXX += x * x
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  const slopePerMs = (n * sumXY - sumX * sumY) / denom
  return Math.round((slopePerMs * 60_000) * 100) / 100
}

/**
 * The one verdict function. Every threshold is stated here so the UI never has
 * to decide "is this bad" on its own — a colour chosen at the call site is a
 * colour that will drift from the number it is describing.
 */
export function verdictFor(input: {
  blockingPct: number
  p95BlockMs: number
  sampled: boolean
}): Verdict {
  const { blockingPct: pct, p95BlockMs: p95, sampled } = input
  if (!sampled) {
    return {
      state: 'unknown',
      label: 'Not measuring',
      because: 'Arm the profiler to start collecting frame and blocking data.',
    }
  }
  if (p95 >= LONG_TASK_MS * 4 || pct >= 15) {
    return {
      state: 'lagging',
      label: 'Lagging',
      because: `${round1(pct)}% of wall-clock is blocked and the worst 5% of stalls exceed ${Math.round(p95)}ms — the interface is measurably frozen, not just busy.`,
    }
  }
  if (pct >= 4 || p95 >= LONG_TASK_MS) {
    return {
      state: 'busy',
      label: 'Stuttery',
      because: `${round1(pct)}% of wall-clock is blocked, and typical stalls cross the ${LONG_TASK_MS}ms long-task line — you are losing frames.`,
    }
  }
  return {
      state: 'smooth',
      label: 'Smooth',
      because: `Only ${round1(pct)}% of wall-clock is blocked and no stall crosses ${LONG_TASK_MS}ms.`,
    }
}

/* ── 9. CAPTURES — save a measurement, load it back later ────────────────────
 * Why a capture exists: a performance problem is not reproducible on demand. It
 * happens while you were doing something you no longer remember, on a machine
 * under a load you cannot recreate. So the finding has to be *portable* — the
 * thing you attach to a bug report.
 *
 * THE ONE RULE: A LOADED CAPTURE MUST NEVER LOOK LIKE A LIVE MEASUREMENT.
 * Every number on the page is tagged with the layer that produced it, so the
 * same rule applies to the WHOLE file: a capture carries its own timestamp, its
 * own duration and its own provenance, and the UI switches to a visibly
 * different "loaded" mode. Reading a capture from last Tuesday must never be
 * mistaken for watching the app right now.
 */

/** Bumped whenever the shape changes; `validateCapture` rejects a mismatch. */
export const PERF_CAPTURE_VERSION = 1

/** One frame of a capture: frame times, memory, IPC, host — everything but
 *  blocking tasks, which have their own record because a task is an EVENT with
 *  a duration, not a sample. */
export interface PerfCapture {
  /** Schema version. A file from a future build is rejected, not guessed at. */
  v: number
  /** ISO timestamp of the moment the capture was taken. */
  capturedAtIso: string
  /** Total wall-clock the capture covers, in ms. */
  durationMs: number
  /** ms since session start, needed to rebuild the scope's time axis. */
  sessionMs: number
  trace: TraceSample[]
  longTasks: LongTaskRecord[]
  marks: MarkRecord[]
  errors: ErrorRecord[]
  ledger: PageLedgerRow[]
  capabilities: PerfCapabilities
}

/** Upper bounds on what a file is allowed to make the renderer allocate.
 *
 *  These are not arbitrary. `importCapture` runs on whatever JSON a user hands
 *  it, so a file claiming 10 million trace samples would otherwise hang the tab
 *  before the UI could show an error. The file is CLAMPED to the same limits the
 *  recorder already enforces live, so a capture can never be bigger than the
 *  live buffer it came from. */
const CAPTURE_LIMITS = {
  trace: TRACE_MAX_SAMPLES,
  longTasks: MAX_LONG_TASKS,
  ledger: MAX_PAGES,
  trend: 16,
  marks: 1200,
  errors: 80,
} as const

function finite(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** Coerce an unknown array into a bounded array of records, or `[]`. */
function clampArray<T>(input: unknown, limit: number, coerce: (raw: any, i: number) => T): T[] {
  if (!Array.isArray(input)) return []
  const out: T[] = []
  for (let i = 0; i < Math.min(input.length, limit); i++) {
    const raw = input[i]
    if (!raw || typeof raw !== 'object') continue
    out.push(coerce(raw, i))
  }
  return out
}

/**
 * Bounded list of plain NUMBERS, dropping anything non-numeric.
 *
 * This exists because `clampArray` above only accepts objects, so routing the
 * ledger's `trend: number[]` through it silently produced an EMPTY sparkline for
 * every row of every loaded capture. The bug is invisible in the file (the array
 * is present and the right length) and invisible to `tsc`; only rendering the
 * loaded ledger shows it.
 */
function clampNumbers(input: unknown, limit: number): number[] {
  if (!Array.isArray(input)) return []
  const out: number[] = []
  for (let i = 0; i < Math.min(input.length, limit); i++) {
    const v = input[i]
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
  }
  return out
}

/**
 * An optional measurement.
 *
 * Returns null for anything that is not a finite number, INCLUDING a numeric
 * string. `0` is a real measurement (an instantaneous IPC round trip) and must
 * survive; a garbage value means "unknown", and reporting that as `0ms` would
 * claim the app's IPC is infinitely fast.
 */
function optionalNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

const KNOWN_SOURCES: readonly PerfSource[] = ['longtask', 'frame', 'memory', 'ipc', 'host', 'react']
const KNOWN_UNITS: readonly TraceSample['unit'][] = ['ms', 'MB', '%', 'fps']

/**
 * Validate and sanitise an untrusted capture.
 *
 * PURE BY CONTRACT (see the module header), so it is probe-testable without a
 * browser. Returns `null` for anything structurally unusable — a caller must
 * never render half a file.
 *
 * It rebuilds the DERIVED numbers from the raw arrays rather than trusting the
 * ones in the file. A hand-edited or truncated capture could otherwise claim
 * `blockingPct: 0` while its own `longTasks` say 40 seconds of stalls, and the
 * page would then disagree with its own contents.
 */
export function validateCapture(input: unknown): PerfCapture | null {
  if (!input || typeof input !== 'object') return null
  const c = input as Record<string, unknown>
  if (finite(c.v, 0) !== PERF_CAPTURE_VERSION) return null

  const sourceRaw = (c.capabilities && typeof c.capabilities === 'object' ? c.capabilities : {}) as Record<string, unknown>

  const trace = clampArray<TraceSample>(c.trace, CAPTURE_LIMITS.trace, (raw) => {
    const src = KNOWN_SOURCES.includes(raw.source) ? (raw.source as PerfSource) : 'frame'
    const unit = KNOWN_UNITS.includes(raw.unit) ? raw.unit : 'ms'
    return {
      t: Math.max(0, finite(raw.t)),
      source: src,
      value: Math.max(0, finite(raw.value)),
      unit,
      route: typeof raw.route === 'string' ? raw.route : null,
    }
  })

  const longTasks = clampArray<LongTaskRecord>(c.longTasks, CAPTURE_LIMITS.longTasks, (raw, i) => ({
    id: str(raw.id, `lt-${i}`),
    t: Math.max(0, finite(raw.t)),
    durationMs: Math.max(0, finite(raw.durationMs)),
    route: typeof raw.route === 'string' ? raw.route : null,
    attribution: str(raw.attribution, 'unknown'),
    containerType: str(raw.containerType, 'unknown'),
  }))

  const marks = clampArray<MarkRecord>(c.marks, CAPTURE_LIMITS.marks, (raw, i) => ({
    id: str(raw.id, `m-${i}`),
    label: str(raw.label, 'unlabelled'),
    start: Math.max(0, finite(raw.start)),
    end: raw.end == null ? null : Math.max(0, finite(raw.end)),
    route: typeof raw.route === 'string' ? raw.route : null,
  }))

  const errors = clampArray<ErrorRecord>(c.errors, CAPTURE_LIMITS.errors, (raw, i) => ({
    id: str(raw.id, `e-${i}`),
    t: Math.max(0, finite(raw.t)),
    kind: raw.kind === 'unhandledrejection' ? 'unhandledrejection' : 'error',
    message: str(raw.message, 'unknown error').slice(0, 400),
    stack: typeof raw.stack === 'string' ? raw.stack.slice(0, 2000) : null,
    route: typeof raw.route === 'string' ? raw.route : null,
  }))

  const ledger = clampArray<PageLedgerRow>(c.ledger, CAPTURE_LIMITS.ledger, (raw) => ({
    route: str(raw.route),
    visits: Math.max(0, Math.round(finite(raw.visits))),
    observedMs: Math.max(0, finite(raw.observedMs)),
    longTasks: Math.max(0, Math.round(finite(raw.longTasks))),
    blockPct: Math.min(100, Math.max(0, finite(raw.blockPct))),
    avgBlockMs: Math.max(0, finite(raw.avgBlockMs)),
    p95BlockMs: Math.max(0, finite(raw.p95BlockMs)),
    worstMs: Math.max(0, finite(raw.worstMs)),
    totalBlockingMs: Math.max(0, finite(raw.totalBlockingMs)),
    heapDeltaMB: finite(raw.heapDeltaMB),
    ipcMedianMs: optionalNumber(raw.ipcMedianMs),
    trend: clampNumbers(raw.trend, CAPTURE_LIMITS.trend),
  }))

  if (!trace.length && !longTasks.length && !ledger.length) return null

  return {
    v: PERF_CAPTURE_VERSION,
    capturedAtIso: str(c.capturedAtIso, new Date(0).toISOString()),
    durationMs: Math.max(0, finite(c.durationMs)),
    sessionMs: Math.max(0, finite(c.sessionMs)),
    trace,
    longTasks,
    // Tolerated-but-optional on the way IN (an older capture file has none),
    // required on the way OUT so nothing downstream has to null-check them.
    marks,
    errors,
    ledger,
    capabilities: {
      longtask: sourceRaw.longtask === true,
      frame: sourceRaw.frame === true,
      memory: sourceRaw.memory === true,
      ipc: sourceRaw.ipc === true,
      host: sourceRaw.host === true,
      react: sourceRaw.react === true,
    },
  }
}

/** The headline numbers a capture implies, recomputed from its own contents. */
export function captureSummary(c: PerfCapture): {
  blockingPct: number
  p95BlockMs: number
  worstMs: number
  longTaskCount: number
} {
  const durations = c.longTasks.map((t) => t.durationMs)
  const totalBlockingMs = durations.reduce((s, d) => s + d, 0)
  const observedMs = c.ledger.reduce((s, r) => s + r.observedMs, 0)
  return {
    blockingPct: blockingPct(totalBlockingMs, observedMs),
    p95BlockMs: durations.length ? Math.round(percentile(durations, 95) * 10) / 10 : 0,
    worstMs: durations.length ? Math.round(Math.max(...durations)) : 0,
    longTaskCount: durations.length,
  }
}

/** Turn a capture into the numbers the UI renders, in one pure step. */
export function captureToSnapshot(c: PerfCapture): PerfSnapshot {
  const summary = captureSummary(c)
  const frames = c.trace.filter((s) => s.source === 'frame').map((s) => s.value)
  const frameMedianMs = frames.length ? Math.round(median(frames) * 10) / 10 : 0
  const heap = c.trace.filter((s) => s.source === 'memory').map((s) => s.value)
  const slope = heap.length > 2 ? slopePerMinute(heap, Math.max(1000, heap.length * 2000)) : 0

  return {
    sessionMs: Math.round(c.sessionMs),
    armed: false,
    armedMs: Math.round(c.durationMs),
    verdict: verdictFor({ blockingPct: summary.blockingPct, p95BlockMs: summary.p95BlockMs, sampled: summary.longTaskCount > 0 }),
    blockingPct: summary.blockingPct,
    totalBlockingMs: Math.round(c.longTasks.reduce((s, t) => s + t.durationMs, 0)),
    longTaskCount: summary.longTaskCount,
    worstMs: summary.worstMs,
    p95BlockMs: summary.p95BlockMs,
    frameMedianMs,
    droppedFramePct: frames.length
      ? Math.round((frames.filter((f) => f > FRAME_BUDGET_MS).length / frames.length) * 1000) / 10
      : 0,
    fps: fpsFromFrameMs(frameMedianMs),
    heapUsedMB: heap.length ? Math.round(heap[heap.length - 1]) : null,
    heapTotalMB: null,
    heapLimitMB: null,
    heapSlopeMBPerMin: slope,
    trace: c.trace,
    longTasks: c.longTasks,
    marks: c.marks ?? [],
    errors: c.errors ?? [],
    ledger: c.ledger,
    routesSeen: c.ledger.length,
    capabilities: c.capabilities,
  }
}

/* ── 10. MARKS — declaring what is expensive, and blaming the freeze ─────────
 *
 * WHY MARKS EXIST
 *
 * The Long Tasks API says a freeze happened. It does not say why, and in a
 * production Electron build it cannot: React strips `<Profiler onRender>` from
 * production bundles (verified — `onRender` appears zero times in
 * `react-dom-client.production.js`), and Chromium's
 * `PerformanceTaskAttributionTiming` is reliably `containerType: "window"` /
 * `name: "unknown"` for same-document JavaScript, which is all this is.
 *
 * So attribution cannot be harvested here — it has to be DECLARED. `mark()` is
 * that declaration, and the join is arithmetic: a blocking task has a
 * `startTime` and a `duration`; a mark has a start and an end. Where they
 * overlap, the marked operation was running while the main thread was blocked,
 * and the size of the overlap is the confidence.
 *
 * "Blocked 412ms, 380ms of it inside getLogs" is an answer. "Blocked 412ms" is
 * a complaint.
 */

/** A declared region of work, on the same clock as `TraceSample.t`. */
export interface MarkRecord {
  id: string
  /** Human label, e.g. `ipc:getLogs`. */
  label: string
  /** ms since session start. */
  start: number
  /** ms since session start, or null while the region is still open. */
  end: number | null
  route: string | null
}

/** A captured JS error, kept with the timeline so it can sit next to a stall. */
export interface ErrorRecord {
  id: string
  /** ms since session start. */
  t: number
  kind: 'error' | 'unhandledrejection'
  message: string
  /** The top frames only — a full stack is megabytes and unreadable. */
  stack: string | null
  route: string | null
}

/** How much of a blocking task a single marked operation accounts for. */
export interface TaskAttribution {
  label: string
  /** ms of the task spent inside this operation. */
  overlapMs: number
  /** Overlap as a share of the task, 0–100. Below ~30% is a weak claim. */
  sharePct: number
  /** How many marks overlapped, not just the winner — concurrent work. */
  overlapping: number
}

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

/**
 * Blame a blocking task on the marked operation that overlaps it most.
 *
 * Returns `null` when nothing overlaps — an unattributed freeze is a real
 * answer, not a failure to be hidden, and the UI says so rather than guessing.
 * A still-open mark (`end === null`) is treated as running until `taskEnd`, so
 * an operation that never returns still gets named instead of being excluded.
 */
export function attributeTask(
  task: { t: number; durationMs: number },
  marks: readonly MarkRecord[],
): TaskAttribution | null {
  if (!task || !Number.isFinite(task.t) || !Number.isFinite(task.durationMs) || task.durationMs <= 0) {
    return null
  }
  const taskStart = task.t
  const taskEnd = task.t + task.durationMs
  let best: TaskAttribution | null = null
  let overlapping = 0

  for (const m of marks) {
    if (!m || !Number.isFinite(m.start)) continue
    const markStart = m.start
    const markEnd = m.end == null || !Number.isFinite(m.end) ? taskEnd : m.end
    if (markEnd <= markStart) continue
    const ov = overlapMs(taskStart, taskEnd, markStart, markEnd)
    if (ov <= 0) continue
    overlapping++
    if (!best || ov > best.overlapMs) {
      best = {
        label: m.label,
        overlapMs: Math.round(ov),
        sharePct: Math.min(100, Math.round((ov / task.durationMs) * 100)),
        overlapping,
      }
    }
  }
  return best ? { ...best, overlapping } : null
}

/** Attach attribution to every task in one pass. */
export function attributeAll(
  tasks: readonly LongTaskRecord[],
  marks: readonly MarkRecord[],
): Array<{ task: LongTaskRecord; attribution: TaskAttribution | null }> {
  return tasks.map((task) => ({
    task,
    attribution: attributeTask({ t: task.t, durationMs: task.durationMs }, marks),
  }))
}

/**
 * Summarise where blocking time went, by label.
 *
 * Uses each mark's ACTUAL duration rather than the sum of overlaps, so one
 * operation called fifty times is one line with a real total, not fifty
 * fragments. Sorted by time spent, because the question is always "where did
 * the time go", not "what was called".
 */
export function markTotals(marks: readonly MarkRecord[]): Array<{ label: string; totalMs: number; calls: number }> {
  const by = new Map<string, { totalMs: number; calls: number }>()
  for (const m of marks) {
    if (!m || !Number.isFinite(m.start)) continue
    const end = m.end == null || !Number.isFinite(m.end) ? m.start : m.end
    const dur = Math.max(0, end - m.start)
    const cur = by.get(m.label) ?? { totalMs: 0, calls: 0 }
    cur.totalMs += dur
    cur.calls += 1
    by.set(m.label, cur)
  }
  return [...by.entries()]
    .map(([label, v]) => ({ label, totalMs: Math.round(v.totalMs), calls: v.calls }))
    .sort((a, b) => b.totalMs - a.totalMs)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/* ── 7. BUCKETING — how the scope turns events into a time axis ───────────── */

/** One column of the frame scope: a fixed slice of wall-clock. */
export interface TraceBucket {
  /** ms since session start at which this slice begins. */
  t: number
  /** Worst frame duration inside the slice. Worst, not mean: the mean of a
   *  slice containing one 300ms stall hides the stall, which is the only thing
   *  the reader is looking for. */
  frameMs: number
  /** Blocking ms summed in the slice. Sums, so two stalls in one second read
   *  as one tall bar rather than two bars the eye has to add up. */
  blockMs: number
  /** How many long tasks landed here. */
  tasks: number
  /** Route active for most of the slice, used for the scope's route ribbon. */
  route: string | null
}

export const SCOPE_WINDOW_MS = 120_000
export const SCOPE_BUCKET_MS = 1000

/**
 * Fold the raw trace into fixed wall-clock slices.
 *
 * WHY BUCKETS AT ALL: the scope has to put discrete events (a long task) and
 * continuous samples (a frame delta) on ONE shared x-axis. Feeding a chart a
 * mixed series makes bar positions ambiguous. Bucketing to a fixed 1s grid does
 * three things at once — it gives both channels a common axis, it keeps the
 * chart's point count constant (so a burst of 400ms tasks cannot tank the frame
 * rate of the chart itself, which would make the profiler the lag), and it
 * answers the question that actually matters, which is WHEN.
 *
 * ONE SOURCE OF TRUTH: blocking time is derived from `trace` entries whose
 * `source` is `longtask`, and from NOTHING else. An earlier revision also walked
 * a parallel `longTasks` array and tried to dedupe the two with a
 * `buckets[i].tasks > 0` guard — which silently dropped every task after the
 * first in each bucket, reporting 500 stalls of 200ms as a single 200ms bar.
 * Deriving from exactly one array removes the whole class of bug: there is no
 * second copy to reconcile.
 *
 * Exact per-task values are not lost to this — `BlockingTaskList` shows every one
 * of them with its precise duration. The scope answers "when", the list answers
 * "exactly what".
 */
export function bucketTrace(args: {
  trace: readonly TraceSample[]
  windowMs: number
  bucketMs: number
  sessionMs: number
}): TraceBucket[] {
  const { trace, windowMs, bucketMs, sessionMs } = args
  const bucket = Math.max(1, bucketMs)
  const count = Math.max(1, Math.ceil(windowMs / bucket))
  const start = Math.max(0, sessionMs - windowMs)

  const buckets: TraceBucket[] = Array.from({ length: count }, (_, i) => ({
    t: start + i * bucket,
    frameMs: 0,
    blockMs: 0,
    tasks: 0,
    route: null,
  }))

  const indexFor = (t: number): number => {
    const rel = t - start
    if (rel < 0 || rel >= windowMs) return -1
    return Math.min(count - 1, Math.floor(rel / bucket))
  }

  // Route votes are counted rather than last-write-wins: with sub-second
  // sampling, "last" would let a single stray sample flip a whole second's label.
  const votes = new Map<number, Map<string, number>>()

  for (const s of trace) {
    const i = indexFor(s.t)
    if (i < 0) continue
    if (s.source === 'frame') {
      if (s.value > buckets[i].frameMs) buckets[i].frameMs = s.value
    } else if (s.source === 'longtask') {
      buckets[i].blockMs += s.value
      buckets[i].tasks += 1
      const key = s.route ?? '__chrome__'
      const m = votes.get(i) ?? new Map<string, number>()
      m.set(key, (m.get(key) ?? 0) + 1)
      votes.set(i, m)
    }
  }

  for (const [i, m] of votes) {
    let best = '__chrome__'
    let bestN = -1
    for (const [route, n] of m) {
      if (n > bestN) {
        bestN = n
        best = route
      }
    }
    buckets[i].route = best === '__chrome__' ? null : best
  }

  for (let i = 0; i < count; i++) {
    buckets[i].frameMs = round1(buckets[i].frameMs)
    buckets[i].blockMs = Math.round(buckets[i].blockMs)
  }
  return buckets
}

/** The y-domain for the scope, in ms. Always includes both thresholds so the
 *  reference lines are never clipped off the top of the plot. */
export function scopeDomain(buckets: readonly TraceBucket[]): [number, number] {
  let peak = 0
  for (const b of buckets) peak = Math.max(peak, b.frameMs, b.blockMs)
  // Round up to the next 25ms so the axis lands on readable gridlines.
  const top = Math.max(LONG_TASK_MS * 2, Math.ceil(peak / 25) * 25 || LONG_TASK_MS * 2)
  return [0, top]
}

/* ── 8. FORMATTERS ───────────────────────────────────────────────────────────
 * One formatter per unit, shared, so two surfaces cannot print the same value
 * two different ways — the bug that made the sidebar stopwatch and the
 * dashboard hero disagree (see MEMORY.md, 2026-10-04).
 */

/** Durations. One decimal below 100ms, because that is exactly the range where
 *  the frame budget lives — `Math.round(16.7)` printed "17ms", which is the same
 *  number as the budget it was being compared against, so the comparison was
 *  invisible. Above 100ms a decimal is noise and the integer reads better. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms === 0) return '0ms'
  if (ms < 100) {
    const r = round1(ms)
    return `${r >= 100 ? Math.round(ms) : r}ms`
  }
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${round1(ms / 1000)}s`
}

/** Session-length elapsed time: `0:07`, `2:14`, `1:02:33`. */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatMb(mb: number | null): string {
  if (mb == null || !Number.isFinite(mb)) return '—'
  if (mb >= 1024) return `${round1(mb / 1024)} GB`
  return `${Math.round(mb)} MB`
}

/** Signed heap slope. The sign IS the finding, so it is always shown. */
export function formatSlope(mbPerMin: number): string {
  if (!Number.isFinite(mbPerMin) || Math.abs(mbPerMin) < 0.05) return 'steady'
  return `${mbPerMin > 0 ? '+' : '−'}${Math.abs(round1(mbPerMin))} MB/min`
}

/** Turn a route id into something readable without inventing a second naming
 *  authority: the page views resolve labels through the registry, and this is
 *  only the fallback for ids the registry does not know. */
export function prettifyRoute(route: string): string {
  if (!route) return 'App chrome'
  const tail = route.split('/').filter(Boolean).pop() ?? route
  return tail
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

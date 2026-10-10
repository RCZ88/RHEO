/**
 * perfRecorder.ts — the only place in the app that measures the renderer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A MODULE-SCOPE SINGLETON
 *
 * `App.tsx` renders `<Routes key={location.pathname}>`. That key is deliberate
 * — it forces a full unmount/remount on navigation so page-local effects cannot
 * leak between pages. The unavoidable cost is that EVERY `useState`/`useRef` in
 * a page dies on every navigation.
 *
 * The same trap killed the stopwatch: its accumulators lived in page-local
 * state, so leaving the dashboard for ten seconds wiped the session. See the
 * header of `src/lib/stopwatchStore.ts`. A profiler whose history resets every
 * time you navigate to the page you want to read would be useless by
 * construction, so every accumulator here is module scope.
 *
 * The publish interval is module scope for the same reason. An earlier
 * iteration owned it from inside the page component; because the page unmounts
 * on navigation, the timer froze on every other route and restarted on return,
 * and the displayed numbers silently went stale. The interval belongs to the
 * module, not to the view.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS ARM-GATED
 *
 * Every channel below costs real CPU: a rAF loop runs every frame, a heap read
 * runs on a timer, an IPC round-trip runs every few seconds. A profiler that
 * taxes the app it measures INVENTS the lag it reports, which would make the
 * whole page a liar. So nothing is armed until asked, and the passive longtask
 * observer — the one channel that is free, because Chromium only fires it on
 * blocks that already happened — is the sole thing running by default.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE EACH NUMBER COMES FROM (provenance is not incidental)
 *
 *   longtask  Chromium Long Tasks API. Exact: an entry IS a >50ms main-thread
 *             block. The only unimpeachable lag signal available.
 *   frame     rAF delta. Exact while armed. Says nothing about what blocked.
 *   memory    Chromium `performance.memory`. Real V8 heap for the RENDERER,
 *             which is the process that actually runs out — `console:metrics`
 *             reports the MAIN process heap, which is a different number.
 *   ipc       Monotonic round-trip around a no-op invoke. Exact RTT.
 *   host      `console:metrics`, which already existed. Reused, not forked.
 *   react     `<Profiler onRender>`. UNAVAILABLE in production React builds —
 *             verified: `onRender` appears 0 times in react-dom's production
 *             bundle. Reported as a capability, never as a column of zeros.
 */
import {
  type LongTaskRecord,
  type PageLedgerRow,
  type ErrorRecord,
  type MarkRecord,
  type PerfCapabilities,
  type PerfCapture,
  type PerfSnapshot,
  type TraceSample,
  FRAME_BUDGET_MS,
  LONG_TASK_MS,
  MAX_LONG_TASKS,
  MAX_PAGES,
  PERF_CAPTURE_VERSION,
  TRACE_MAX_SAMPLES,
  TRACE_WINDOW_MS,
  blockingPct,
  captureToSnapshot,
  fpsFromFrameMs,
  median,
  percentile,
  slopePerMinute,
  verdictFor,
} from '../shared/perfTypes'

/* ── Chromium's non-standard heap read. Typed locally, never as `any` soup. ── */
interface ChromiumMemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}
interface PerfWithMemory extends Performance {
  memory?: ChromiumMemoryInfo
}

/* ── tunables ─────────────────────────────────────────────────────────────── */
const PUBLISH_MS = 250
const MEMORY_SAMPLE_MS = 2000
const IPC_SAMPLE_MS = 5000
const HOST_SAMPLE_MS = 3000
const FRAME_WINDOW = 120

/** The shape `console:metrics` returns. Declared so a shape change is a type
 *  error here rather than an `undefined` at runtime three fields deep. */
interface HostMetrics {
  cpuPct: number | null
  memPct: number
  appRssMB: number
  appHeapMB: number
}

/* ── module state ─────────────────────────────────────────────────────────── */
interface RouteAccum {
  route: string | null
  enteredAt: number
  observedMs: number
  visits: number
  longTasks: number
  totalBlockingMs: number
  worstMs: number
  /** Long-task durations, kept only so p95/avg can be computed. Bounded. */
  durations: number[]
  ipcSamples: number[]
  heapAtFirstVisitMB: number | null
  lastHeapMB: number | null
  /** Rolling per-visit blockPct for the ledger sparkline. */
  trend: number[]
  /**
   * Blocking observed in the visit currently in progress.
   *
   * SCOPE: used ONLY to compute this visit's trend point. It is deliberately NOT
   * added to the row total — `totalBlockingMs` is already cumulative and
   * includes it. An earlier revision incremented BOTH and then summed them in
   * `buildLedger`, which double-counted every ledger row while the user sat on
   * one page and snapped back to the truth the moment they navigated, so the
   * ledger and the headline disagreed by 2x depending on when you looked.
   */
  visitBlockMs: number
}

function newAccum(route: string | null, now: number): RouteAccum {
  return {
    route,
    enteredAt: now,
    observedMs: 0,
    visits: 1,
    longTasks: 0,
    totalBlockingMs: 0,
    worstMs: 0,
    durations: [],
    ipcSamples: [],
    heapAtFirstVisitMB: null,
    lastHeapMB: null,
    trend: [],
    visitBlockMs: 0,
  }
}

let sessionStart = 0
let armedSince = 0
/**
 * Banked measuring time from PREVIOUS arm cycles.
 *
 * `armedMs` used to be just `now - armedSince`, and `armedSince` was never
 * cleared on stop — so the duration kept climbing forever after you pressed
 * Stop, and that inflated figure is exactly what `exportCapture` writes as
 * `durationMs`. A saved evaluation claiming "measured for 4 hours" when the
 * test ran for 40 seconds is worse than no number at all.
 */
let armedBankedMs = 0
let armed = false

let currentRoute: string | null = null
let currentEnteredAt = 0
let accumulators = new Map<string, RouteAccum>()

let trace: TraceSample[] = []
let longTasks: LongTaskRecord[] = []
/** Declared regions of work — the only production-viable attribution source. */
let marks: MarkRecord[] = []
let errors: ErrorRecord[] = []
let markSeq = 0
let frameSamples: number[] = []
let heapSeries: number[] = []
let longTaskSeq = 0

let capabilities: PerfCapabilities = {
  longtask: false,
  frame: false,
  memory: false,
  ipc: false,
  host: false,
  react: false,
}

let longTaskObserver: PerformanceObserver | null = null
let publishTimer: ReturnType<typeof setInterval> | null = null
let memoryTimer: ReturnType<typeof setInterval> | null = null
let ipcTimer: ReturnType<typeof setInterval> | null = null
let hostTimer: ReturnType<typeof setInterval> | null = null
let rafId = 0
let lastFrameAt = 0

let snapshot: PerfSnapshot = emptySnapshot()
const listeners = new Set<() => void>()

/**
 * A capture loaded from a file, or null while showing live data.
 *
 * While this is set, `rebuild()` refuses to overwrite `snapshot`. That is the
 * whole mechanism behind "a loaded capture must never look live": if live
 * publishing kept running, the arm button could still be on, samples would keep
 * arriving, and the numbers on screen would silently cross-fade from "last
 * Tuesday's file" into "right now" with nothing to mark the transition. Loading
 * a capture therefore also stops presenting as a live measurement.
 */
let loadedCapture: PerfCapture | null = null

/* ── helpers ──────────────────────────────────────────────────────────────── */
const now = (): number => performance.now()
/**
 * The preload bridge, or undefined outside a browser.
 *
 * MUST be guarded. This used to be `(window as any).deskflowAPI`, which throws a
 * bare `ReferenceError: window is not defined` in any non-DOM context — and once
 * `publish()` began draining IPC marks, that turned into a crash on `arm()` in a
 * plain Node probe. A helper whose entire job is "give me the bridge, or don't"
 * must never be the thing that throws.
 */
const api = (): any => (typeof window === 'undefined' ? undefined : (window as any).deskflowAPI)

function readMemory(): ChromiumMemoryInfo | null {
  const mem = (performance as PerfWithMemory).memory
  if (!mem || typeof mem.usedJSHeapSize !== 'number') return null
  return mem
}

function pushTrace(sample: TraceSample): void {
  trace.push(sample)
  // Bound by COUNT as well as age. A 2-minute window at ~4 samples/sec is ~480
  // points; 900 leaves headroom without letting a burst run away.
  if (trace.length > TRACE_MAX_SAMPLES) trace.splice(0, trace.length - TRACE_MAX_SAMPLES)
}

function routeKey(route: string | null): string {
  return route ?? '__chrome__'
}

function ensureAccum(route: string | null, at: number): RouteAccum {
  const key = routeKey(route)
  let acc = accumulators.get(key)
  if (!acc) {
    if (accumulators.size >= MAX_PAGES) {
      // Drop the least-recently-seen route rather than refusing to record a new
      // one. A profiler that stops working after 60 pages is worse than lossy.
      const oldest = [...accumulators.entries()].sort(
        (a, b) => a[1].enteredAt - b[1].enteredAt,
      )[0]
      if (oldest) accumulators.delete(oldest[0])
    }
    acc = newAccum(route, at)
    accumulators.set(key, acc)
  }
  return acc
}

/* ── the single source of snapshot truth ──────────────────────────────────── */

function emptySnapshot(): PerfSnapshot {
  return {
    sessionMs: 0,
    armed: false,
    armedMs: 0,
    verdict: verdictFor({ blockingPct: 0, p95BlockMs: 0, sampled: false }),
    blockingPct: 0,
    totalBlockingMs: 0,
    longTaskCount: 0,
    worstMs: 0,
    p95BlockMs: 0,
    frameMedianMs: 0,
    droppedFramePct: 0,
    fps: 0,
    heapUsedMB: null,
    heapTotalMB: null,
    heapLimitMB: null,
    heapSlopeMBPerMin: 0,
    trace: [],
    longTasks: [],
    marks: [],
    errors: [],
    ledger: [],
    routesSeen: 0,
    capabilities: { ...capabilities },
  }
}

/**
 * Recompute the snapshot. Runs on the publish tick, NEVER inside getSnapshot —
 * `getSnapshot` is called by React on every render and must stay O(1).
 */
function rebuild(): void {
  // A loaded capture owns the snapshot until it is dismissed. See loadedCapture.
  if (loadedCapture) return
  const t = now()
  const sessionMs = Math.round(t - sessionStart)
  // Bank the in-flight cycle and add it to the completed ones, so the figure is
  // frozen the moment you stop and correct across repeated arm/disarm cycles.
  const armedMs = Math.round(armedBankedMs + (armedSince ? t - armedSince : 0))

  // Close out the visit in progress so its wall-clock lands on the right row
  // even if the user is still sitting on that page. `publish()` does the
  // banking; `rebuild()` only reads, so it must not mutate an accumulator.
  const observedTotal = [...accumulators.values()].reduce((s, a) => s + a.observedMs, 0)
  const blockingTotal = [...accumulators.values()].reduce((s, a) => s + a.totalBlockingMs, 0)
  const durations = longTasks.map((l) => l.durationMs)

  const frames = frameSamples.length ? [...frameSamples] : []
  const frameMedianMs = frames.length ? Math.round(median(frames) * 10) / 10 : 0
  const droppedFramePct = frames.length
    ? Math.round((frames.filter((f) => f > FRAME_BUDGET_MS).length / frames.length) * 1000) / 10
    : 0

  const mem = readMemory()
  const heapUsedMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : null
  const heapTotalMB = mem ? Math.round(mem.totalJSHeapSize / 1048576) : null
  const heapLimitMB = mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null

  // Slope over the whole retained window, which is what makes "it gets laggy
  // after an hour" visible at all.
  const heapWindowMs =
    heapSeries.length > 1 ? Math.min(TRACE_WINDOW_MS, Math.max(1000, heapSeries.length * MEMORY_SAMPLE_MS)) : 0
  const heapSlopeMBPerMin = heapWindowMs ? slopePerMinute(heapSeries, heapWindowMs) : 0

  const p95BlockMs = durations.length ? Math.round(percentile(durations, 95) * 10) / 10 : 0

  snapshot = {
    sessionMs,
    armed,
    armedMs,
    verdict: verdictFor({
      blockingPct: blockingPct(blockingTotal, observedTotal),
      p95BlockMs,
      sampled: durations.length > 0 || frames.length > 0,
    }),
    blockingPct: blockingPct(blockingTotal, observedTotal),
    totalBlockingMs: Math.round(blockingTotal),
    longTaskCount: longTasks.length,
    worstMs: durations.length ? Math.round(Math.max(...durations)) : 0,
    p95BlockMs,
    frameMedianMs,
    droppedFramePct,
    fps: fpsFromFrameMs(frameMedianMs),
    heapUsedMB,
    heapTotalMB,
    heapLimitMB,
    heapSlopeMBPerMin,
    trace: trace.slice(),
    longTasks: longTasks.slice(),
    marks: marks.slice(),
    errors: errors.slice(),
    ledger: buildLedger(),
    routesSeen: accumulators.size,
    capabilities: { ...capabilities },
  }

  for (const l of listeners) l()
}

function buildLedger(): PageLedgerRow[] {
  const rows: PageLedgerRow[] = []
  for (const a of accumulators.values()) {
    // `totalBlockingMs` is cumulative and already includes the in-flight visit,
    // so it is the single source of truth here — never re-add `visitBlockMs`.
    const totalBlocking = a.totalBlockingMs
    const observed = a.observedMs
    rows.push({
      route: a.route ?? '',
      visits: a.visits,
      observedMs: Math.round(observed),
      longTasks: a.longTasks,
      blockPct: blockingPct(totalBlocking, observed),
      avgBlockMs: a.durations.length
        ? Math.round((a.durations.reduce((s, d) => s + d, 0) / a.durations.length) * 10) / 10
        : 0,
      p95BlockMs: a.durations.length ? Math.round(percentile(a.durations, 95) * 10) / 10 : 0,
      worstMs: Math.round(a.worstMs),
      totalBlockingMs: Math.round(totalBlocking),
      heapDeltaMB:
        a.heapAtFirstVisitMB != null && a.lastHeapMB != null
          ? Math.round((a.lastHeapMB - a.heapAtFirstVisitMB) * 10) / 10
          : 0,
      ipcMedianMs: a.ipcSamples.length ? Math.round(median(a.ipcSamples) * 100) / 100 : null,
      trend: a.trend.slice(-16),
    })
  }
  // Rank by blocking share, and put never-measured routes last rather than
  // first — a 0.0% row caused by "no data yet" must never outrank a real one.
  return rows.sort((x, y) => {
    const xEmpty = x.observedMs <= 0
    const yEmpty = y.observedMs <= 0
    if (xEmpty !== yEmpty) return xEmpty ? 1 : -1
    if (y.blockPct !== x.blockPct) return y.blockPct - x.blockPct
    return y.totalBlockingMs - x.totalBlockingMs
  })
}

function publish(): void {
  // Collect automatically-timed IPC operations BEFORE the snapshot is rebuilt,
  // so a mark that overlaps a freeze recorded this tick is available to blame it.
  if (armed) drainIpcMarks()
  // Bank the in-flight visit's elapsed time into its own row.
  if (armed && currentEnteredAt) {
    const acc = ensureAccum(currentRoute, currentEnteredAt)
    acc.observedMs += now() - currentEnteredAt
    currentEnteredAt = now()
  }
  rebuild()
}

/* ── measurement channels ─────────────────────────────────────────────────── */

/**
 * The Long Tasks API. `buffered: true` so tasks that occurred before the
 * observer attached are still delivered — otherwise arming after a stutter
 * would silently lose exactly the event you armed to catch.
 */
function startLongTasks(): void {
  if (longTaskObserver || typeof PerformanceObserver === 'undefined') return
  const supported = PerformanceObserver.supportedEntryTypes || []
  if (!supported.includes('longtask')) return
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      if (!armed) return
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const task = entry as PerformanceEntry & {
          attribution?: Array<{ name?: string; containerType?: string }>
        }
        const attr = task.attribution?.[0]
        const durationMs = task.duration
        const acc = ensureAccum(currentRoute, currentEnteredAt)
        acc.longTasks++
        acc.totalBlockingMs += durationMs
        acc.visitBlockMs += durationMs
        acc.worstMs = Math.max(acc.worstMs, durationMs)
        if (acc.durations.length < 400) acc.durations.push(durationMs)

        longTasks.push({
          id: `lt-${++longTaskSeq}`,
          t: Math.round(task.startTime - sessionStart),
          durationMs: Math.round(durationMs),
          route: currentRoute,
          attribution: attr?.name ?? 'unknown',
          containerType: attr?.containerType ?? 'unknown',
        })
        if (longTasks.length > MAX_LONG_TASKS) longTasks.splice(0, longTasks.length - MAX_LONG_TASKS)

        pushTrace({
          t: Math.round(task.startTime - sessionStart),
          source: 'longtask',
          value: Math.round(durationMs),
          unit: 'ms',
          route: currentRoute,
        })
      }
    })
    longTaskObserver.observe({ type: 'longtask', buffered: true })
    capabilities.longtask = true
  } catch {
    capabilities.longtask = false
  }
}

/** rAF delta. Only runs while armed — this is the expensive channel. */
function startFrames(): void {
  if (rafId || typeof requestAnimationFrame === 'undefined') return
  lastFrameAt = now()
  const tick = (t: number) => {
    if (!armed) {
      rafId = 0
      return
    }
    const delta = t - lastFrameAt
    lastFrameAt = t
    // Ignore the first frame after arming and any gap over 2s: a backgrounded
    // window, a laptop resume, or a modal-open freeze all produce enormous
    // deltas that are not frame cost and would poison every percentile.
    if (delta > 0 && delta < 2000) {
      frameSamples.push(Math.round(delta * 10) / 10)
      if (frameSamples.length > FRAME_WINDOW) frameSamples.shift()
      if (frameSamples.length % 15 === 0) {
        pushTrace({
          t: Math.round(t - sessionStart),
          source: 'frame',
          value: Math.round(delta * 10) / 10,
          unit: 'ms',
          route: currentRoute,
        })
      }
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  capabilities.frame = true
}

function stopFrames(): void {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

function sampleMemory(): void {
  const mem = readMemory()
  if (!mem) {
    capabilities.memory = false
    return
  }
  capabilities.memory = true
  const usedMB = Math.round(mem.usedJSHeapSize / 1048576)
  heapSeries.push(usedMB)
  if (heapSeries.length > Math.ceil(TRACE_WINDOW_MS / MEMORY_SAMPLE_MS) + 4) heapSeries.shift()
  pushTrace({
    t: Math.round(now() - sessionStart),
    source: 'memory',
    value: usedMB,
    unit: 'MB',
    route: currentRoute,
  })
  const acc = ensureAccum(currentRoute, currentEnteredAt)
  if (acc.heapAtFirstVisitMB == null) acc.heapAtFirstVisitMB = usedMB
  acc.lastHeapMB = usedMB
}

/**
 * IPC round-trip, measured by the renderer with a monotonic clock around a
 * no-op invoke. Honest about what it is: it measures the full renderer→main→
 * renderer path including the main process's event-loop queue, which is exactly
 * the number that matters when a handler is blocking the main thread.
 */
async function sampleIpc(): Promise<void> {
  const a = api()
  if (!a?.perfPing) {
    capabilities.ipc = false
    return
  }
  const t0 = performance.now()
  try {
    await a.perfPing()
    const rtt = performance.now() - t0
    capabilities.ipc = true
    const acc = ensureAccum(currentRoute, currentEnteredAt)
    if (acc.ipcSamples.length < 200) acc.ipcSamples.push(rtt)
    pushTrace({
      t: Math.round(now() - sessionStart),
      source: 'ipc',
      value: Math.round(rtt * 100) / 100,
      unit: 'ms',
      route: currentRoute,
    })
  } catch {
    capabilities.ipc = false
  }
}

/** Reuses the handler that already existed. No second CPU sampler. */
async function sampleHost(): Promise<void> {
  const a = api()
  if (!a?.consoleMetrics) {
    capabilities.host = false
    return
  }
  try {
    const res = await a.consoleMetrics()
    if (!res?.success) {
      capabilities.host = false
      return
    }
    capabilities.host = true
    const d = res.data as HostMetrics
    pushTrace({
      t: Math.round(now() - sessionStart),
      source: 'host',
      value: Math.round((d.cpuPct ?? 0) * 10) / 10,
      unit: '%',
      route: currentRoute,
    })
  } catch {
    capabilities.host = false
  }
}

/* ── arm / disarm ─────────────────────────────────────────────────────────── */

export function arm(): void {
  if (armed) return
  armed = true
  sessionStart = sessionStart || now()
  armedSince = now()
  capabilities.react = detectReactProfiler()

  startLongTasks()
  startFrames()

  if (!publishTimer) publishTimer = setInterval(publish, PUBLISH_MS)
  if (!memoryTimer) {
    memoryTimer = setInterval(sampleMemory, MEMORY_SAMPLE_MS)
    sampleMemory()
  }
  if (!ipcTimer) {
    ipcTimer = setInterval(() => void sampleIpc(), IPC_SAMPLE_MS)
    void sampleIpc()
  }
  if (!hostTimer) {
    hostTimer = setInterval(() => void sampleHost(), HOST_SAMPLE_MS)
    void sampleHost()
  }
  publish()
}

export function disarm(): void {
  if (!armed) return
  publish()
  if (armedSince) armedBankedMs += now() - armedSince
  armedSince = 0
  armed = false
  stopFrames()
  if (publishTimer) { clearInterval(publishTimer); publishTimer = null }
  if (memoryTimer) { clearInterval(memoryTimer); memoryTimer = null }
  if (ipcTimer) { clearInterval(ipcTimer); ipcTimer = null }
  if (hostTimer) { clearInterval(hostTimer); hostTimer = null }
  publish()
}

export function isArmed(): boolean {
  return armed
}

/** Wipe collected data but stay armed, so a fresh measurement can start. */
export function reset(): void {
  loadedCapture = null
  trace = []
  longTasks = []
  marks = []
  errors = []
  markSeq = 0
  frameSamples = []
  heapSeries = []
  accumulators = new Map()
  longTaskSeq = 0
  sessionStart = now()
  armedBankedMs = 0
  armedSince = armed ? now() : 0
  currentEnteredAt = now()
  ensureAccum(currentRoute, currentEnteredAt)
  publish()
}

/**
 * React component timings require `<Profiler onRender>`, which React strips from
 * production builds. Rather than render a component table full of zeros in the
 * shipped app, the UI reads this flag and states the limitation.
 */
function detectReactProfiler(): boolean {
  return false
}

export function reportReactCommit(_id: string, actualDuration: number): void {
  pushTrace({
    t: Math.round(now() - sessionStart),
    source: 'react',
    value: Math.round(actualDuration * 100) / 100,
    unit: 'ms',
    route: currentRoute,
  })
}

/* ── route attribution ────────────────────────────────────────────────────── */

/**
 * Bound at module load, NOT from a component effect.
 *
 * `App.tsx` dispatches `deskflow:route` after paint on every pathname change.
 * Listening from a page component would miss every navigation that happened
 * while the profiler page was not mounted — which is most of them, and is the
 * exact data the page exists to collect.
 */
function attachRouteListener(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('deskflow:route', (e) => {
    const page = (e as CustomEvent<{ page?: string }>).detail?.page ?? null
    const t = now()
    // Bank the outgoing visit before switching, so its wall-clock is not lost.
    if (armed && currentEnteredAt) {
      const prev = ensureAccum(currentRoute, currentEnteredAt)
      prev.observedMs += t - currentEnteredAt
      prev.trend.push(blockingPct(prev.visitBlockMs, prev.observedMs))
      if (prev.trend.length > 16) prev.trend.shift()
      prev.visitBlockMs = 0
    }
    currentRoute = page
    currentEnteredAt = t
    const acc = ensureAccum(page, t)
    acc.visits++
    if (armed) publish()
  })
}

if (typeof window !== 'undefined') {
  attachRouteListener()
  attachErrorListeners()
  // Read the current route immediately so the first row exists before the user
  // navigates anywhere.
  const initial = window.location.hash.replace(/^#/, '').split('?')[0] || '/'
  currentRoute = initial === '/' ? 'dashboard' : initial.replace('/', '') || 'dashboard'
  currentEnteredAt = now()
  sessionStart = now()
}

/* ── React binding surface ────────────────────────────────────────────────── */

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * MUST be O(1) and MUST return a stable reference between publishes —
 * `useSyncExternalStore` compares by identity and recomputes on every render.
 */
export function getSnapshot(): PerfSnapshot {
  return snapshot
}

/** Exposed for the page's own "clear" affordance and for probes. */
/**
 * Pull IPC timings the preload buffered automatically and record them as marks.
 *
 * The preload wraps `ipcRenderer.invoke` once, so every one of the ~2000 bridge
 * methods is timed without a single feature-code change. Draining on the publish
 * tick keeps the preload stateless — it never needs to know whether the profiler
 * is armed.
 *
 * `startMs` from the preload is on `performance.now()`'s clock, the same clock
 * this module uses, so the two are directly comparable — no epoch mixing.
 */
function drainIpcMarks(): void {
  const a = api()
  if (!a?.drainIpcMarks) return
  let batch: Array<{ label: string; startMs: number; durationMs: number }>
  try {
    batch = a.drainIpcMarks()
  } catch {
    return
  }
  if (!Array.isArray(batch) || batch.length === 0) return
  for (const m of batch) {
    if (!m || !Number.isFinite(m.startMs) || !Number.isFinite(m.durationMs)) continue
    const start = Math.round(m.startMs - sessionStart)
    marks.push({
      id: `ipc-${marks.length + 1}`,
      label: String(m.label ?? 'ipc:unknown'),
      start: Math.max(0, start),
      end: Math.max(0, start + Math.round(m.durationMs)),
      route: currentRoute,
    })
  }
  if (marks.length > 1200) marks.splice(0, marks.length - 1200)
}

export function currentRouteId(): string | null {
  return currentRoute
}

/* ── marks: declaring what is expensive ──────────────────────────────────────
 *
 * The Long Tasks API reports THAT the main thread blocked. It cannot report WHY
 * in a production build: React strips `<Profiler onRender>` from production
 * bundles, and Chromium's task attribution is `window`/`unknown` for
 * same-document JavaScript. So the blame has to be declared by the code that
 * knows, and joined afterwards by arithmetic — see `attributeTask`.
 *
 * `perfMark` is a no-op unless the recorder is armed, so instrumenting a hot
 * path costs one boolean check when the profiler is off.
 */

/** How many frames of a stack to keep. A full V8 stack is megabytes. */
const STACK_FRAMES = 6
const MAX_ERRORS = 80

export function beginMark(label: string): string | null {
  if (!armed) return null
  const id = `m-${++markSeq}`
  marks.push({ id, label, start: Math.round(now() - sessionStart), end: null, route: currentRoute })
  // A runaway caller must not grow this without bound.
  if (marks.length > 1200) marks.splice(0, marks.length - 1200)
  return id
}

export function endMark(id: string | null): void {
  if (!id) return
  const m = marks.find((x) => x.id === id)
  if (m && m.end == null) m.end = Math.round(now() - sessionStart)
}

/**
 * Time a function, sync or async, as one mark.
 *
 * The `finally` is load-bearing: without it a thrown error leaves the mark open
 * forever, and an open mark overlapping every subsequent freeze would blame that
 * operation for stalls it had nothing to do with.
 */
export async function perfMark<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
  const id = beginMark(label)
  try {
    return await fn()
  } finally {
    endMark(id)
  }
}

/** Every mark recorded so far — used by the UI's "where did the time go" table. */
export function getMarks(): MarkRecord[] {
  return marks
}

function recordError(kind: 'error' | 'unhandledrejection', message: string, stack?: string | null): void {
  if (!armed) return
  const frames = (stack ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at '))
    .slice(0, STACK_FRAMES)
  errors.push({
    id: `e-${errors.length + 1}`,
    t: Math.round(now() - sessionStart),
    kind,
    // Bound the message: a thrown object can stringify to megabytes.
    message: String(message ?? 'unknown error').slice(0, 400),
    stack: frames.length ? frames.join('\n') : null,
    route: currentRoute,
  })
  if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS)
}

export function getErrors(): ErrorRecord[] {
  return errors
}

/**
 * Listen for uncaught errors so a crash can be read NEXT TO the stall it caused.
 *
 * `addEventListener('error')` is used rather than assigning `window.onerror`,
 * because `src/main.tsx` already assigns `window.onerror` to route errors into
 * the React boundary — overwriting it here would break the app's error handling.
 * Adding a listener composes with it instead of replacing it.
 */
function attachErrorListeners(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (e) => {
    const err = (e as ErrorEvent).error as Error | undefined
    recordError('error', err?.message ?? (e as ErrorEvent).message ?? 'unknown error', err?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason as unknown
    const err = reason instanceof Error ? reason : null
    recordError('unhandledrejection', err?.message ?? String(reason ?? 'rejected'), err?.stack)
  })
}

/* ── captures: save a measurement, load it back ───────────────────────────── */

/** Snapshot the live buffers into a portable, serialisable capture. */
export function exportCapture(): PerfCapture {
  return {
    v: PERF_CAPTURE_VERSION,
    capturedAtIso: new Date().toISOString(),
    durationMs: snapshot.armedMs,
    sessionMs: snapshot.sessionMs,
    trace: snapshot.trace.slice(),
    longTasks: snapshot.longTasks.slice(),
    marks: marks.slice(),
    errors: errors.slice(),
    ledger: snapshot.ledger.slice(),
    capabilities: { ...snapshot.capabilities },
  }
}

/**
 * Show a validated capture instead of live data.
 *
 * Takes a `PerfCapture` rather than `unknown` on purpose: the caller MUST run it
 * through `validateCapture` first, so a malformed or hostile file can never
 * reach the render path. This function does no validation of its own because it
 * is not the boundary — the file parser is.
 */
export function showCapture(c: PerfCapture): void {
  loadedCapture = c
  snapshot = captureToSnapshot(c)
  for (const l of listeners) l()
}

/** The capture currently being viewed, or null when live. */
export function loadedCaptureInfo(): PerfCapture | null {
  return loadedCapture
}

/**
 * Dismiss a loaded capture and return to live data.
 *
 * Re-arms nothing and clears nothing: if the recorder was still armed when the
 * capture was loaded, samples kept accumulating in the live buffers throughout,
 * so going back shows everything observed since — which is the behaviour you
 * want after reading an old file, not an empty page.
 */
export function dismissCapture(): void {
  if (!loadedCapture) return
  loadedCapture = null
  publish()
}

export const PERF_CONSTANTS = { FRAME_BUDGET_MS, LONG_TASK_MS, TRACE_WINDOW_MS }

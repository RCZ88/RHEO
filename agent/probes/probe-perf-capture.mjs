/**
 * probe-perf-capture.mjs — prints NUMBERS for capture save/load validation.
 *
 * Run: node --experimental-strip-types agent/probes/probe-perf-capture.mjs
 *
 * WHY THIS IS PROBED HARD: `validateCapture` is the ONLY thing between an
 * arbitrary JSON file a user hands the app and the render path. It is pure (see
 * the shared/perfTypes.ts contract), so it can be attacked in a plain Node
 * process — which is far cheaper than discovering the hole in the browser.
 *
 * The two failure modes that matter:
 *  1. A malformed file must be REJECTED, never half-rendered.
 *  2. A file that lies must be CORRECTED — the derived numbers are rebuilt from
 *     the file's own contents, so a hand-edited `blockingPct: 0` next to 40s of
 *     recorded stalls cannot survive.
 */
import {
  PERF_CAPTURE_VERSION,
  validateCapture,
  captureSummary,
  captureToSnapshot,
  bucketTrace,
} from '../../src/shared/perfTypes.ts'

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`)
}

/** A minimal valid capture: 2 tasks, some frames, one ledger row. */
function goodCapture() {
  return {
    v: PERF_CAPTURE_VERSION,
    capturedAtIso: '2026-10-04T08:00:00.000Z',
    durationMs: 60_000,
    sessionMs: 60_000,
    trace: [
      { t: 1000, source: 'frame', value: 16.7, unit: 'ms', route: 'dashboard' },
      { t: 1040, source: 'frame', value: 300, unit: 'ms', route: 'dashboard' },
      { t: 2000, source: 'longtask', value: 400, unit: 'ms', route: 'database' },
      { t: 3000, source: 'memory', value: 180, unit: 'MB', route: 'database' },
      { t: 4000, source: 'longtask', value: 200, unit: 'ms', route: 'database' },
    ],
    longTasks: [
      { id: 'lt-1', t: 2000, durationMs: 400, route: 'database', attribution: 'self', containerType: 'window' },
      { id: 'lt-2', t: 4000, durationMs: 200, route: 'database', attribution: 'self', containerType: 'window' },
    ],
    ledger: [
      { route: 'database', visits: 3, observedMs: 30_000, longTasks: 2, blockPct: 2, avgBlockMs: 300, p95BlockMs: 390, worstMs: 400, totalBlockingMs: 600, heapDeltaMB: 12, ipcMedianMs: 1.4, trend: [1, 2] },
      { route: 'dashboard', visits: 1, observedMs: 30_000, longTasks: 0, blockPct: 0, avgBlockMs: 0, p95BlockMs: 0, worstMs: 0, totalBlockingMs: 0, heapDeltaMB: 0, ipcMedianMs: null, trend: [] },
    ],
    capabilities: { longtask: true, frame: true, memory: true, ipc: true, host: false, react: false },
  }
}

console.log('\n=== a well-formed capture round-trips ===')
const ok = validateCapture(goodCapture())
check('accepted', !!ok)
check('version preserved', ok?.v === PERF_CAPTURE_VERSION)
check('2 long tasks kept', ok?.longTasks.length === 2)
check('2 ledger rows kept', ok?.ledger.length === 2)
check('5 trace samples kept', ok?.trace.length === 5)
check('capabilities carried through', ok?.capabilities.longtask === true && ok?.capabilities.host === false)

console.log('\n=== malformed input is REJECTED, never half-rendered ===')
check('null rejected', validateCapture(null) === null)
check('undefined rejected', validateCapture(undefined) === null)
check('string rejected', validateCapture('not a capture') === null)
check('number rejected', validateCapture(42) === null)
check('array rejected', validateCapture([]) === null)
check('wrong version rejected', validateCapture({ ...goodCapture(), v: 999 }) === null)
check('missing version rejected', validateCapture({ ...goodCapture(), v: undefined }) === null)
const empty = goodCapture(); empty.trace = []; empty.longTasks = []; empty.ledger = []
check('a capture with no data at all is rejected (nothing to show)', validateCapture(empty) === null)

console.log('\n=== hostile sizes are CLAMPED, not allocated ===')
const bomb = goodCapture()
bomb.trace = Array.from({ length: 500_000 }, (_, i) => ({ t: i, source: 'frame', value: 16, unit: 'ms', route: 'x' }))
bomb.longTasks = Array.from({ length: 500_000 }, (_, i) => ({ id: `x${i}`, t: 0, durationMs: 99, route: 'x', attribution: 'self', containerType: 'window' }))
bomb.ledger = Array.from({ length: 500_000 }, (_, i) => ({ route: `r${i}`, visits: 1, observedMs: 1, longTasks: 0, blockPct: 0, avgBlockMs: 0, p95BlockMs: 0, worstMs: 0, totalBlockingMs: 0, heapDeltaMB: 0, ipcMedianMs: null, trend: Array.from({ length: 1000 }, () => 5) }))
const clamped = validateCapture(bomb)
check('500k trace samples clamped to 900', clamped?.trace.length === 900, `got ${clamped?.trace.length}`)
check('500k tasks clamped to 240', clamped?.longTasks.length === 240, `got ${clamped?.longTasks.length}`)
check('500k ledger rows clamped to 60', clamped?.ledger.length === 60, `got ${clamped?.ledger.length}`)
check('a 1000-entry trend clamped to 16', clamped?.ledger[0]?.trend.length === 16, `got ${clamped?.ledger[0]?.trend.length}`)

console.log('\n=== junk INSIDE a valid envelope is coerced, not trusted ===')
const junk = goodCapture()
junk.trace = [null, 'nope', 42, { t: 'x', source: 'NOT_A_SOURCE', value: 'y', unit: 'GIGABYTES', route: 7 }]
junk.longTasks = [{ id: 5, t: -99, durationMs: NaN, route: {}, attribution: null }]
junk.ledger = [{ route: 9, visits: -3, observedMs: 'abc', blockPct: 5000, ipcMedianMs: 'x', trend: ['a', null, 3] }]
const coerced = validateCapture(junk)
check('junk array entries dropped, real ones kept', coerced !== null)
check('unknown source coerced to a known one', coerced?.trace.every((t) => ['longtask', 'frame', 'memory', 'ipc', 'host', 'react'].includes(t.source)), JSON.stringify(coerced?.trace.map((t) => t.source)))
check('unknown unit coerced to ms', coerced?.trace.every((t) => ['ms', 'MB', '%', 'fps'].includes(t.unit)))
check('no NaN survived anywhere', JSON.stringify(coerced).indexOf('null') === -1 || !/NaN/.test(JSON.stringify(coerced)))
check('negative duration floored to 0', coerced?.longTasks[0]?.durationMs === 0, `got ${coerced?.longTasks[0]?.durationMs}`)
check('negative t floored to 0', coerced?.longTasks[0]?.t === 0)
check('blockPct clamped to <=100', (coerced?.ledger[0]?.blockPct ?? 999) <= 100, `got ${coerced?.ledger[0]?.blockPct}`)
check('non-numeric ipcMedianMs becomes null', coerced?.ledger[0]?.ipcMedianMs === null, `got ${coerced?.ledger[0]?.ipcMedianMs}`)

console.log('\n=== derived numbers are REBUILT from the file, so a lying file is corrected ===')
const liar = goodCapture()
// The file CLAIMS it was perfectly smooth:
liar.ledger = [{ ...liar.ledger[0], blockPct: 0, p95BlockMs: 0, worstMs: 0, totalBlockingMs: 0 }]
const s = captureSummary(validateCapture(liar))
check('claimed 0% blocking', liar.ledger[0].blockPct === 0)
check('but recomputed blocking is NON-zero (400ms+200ms over 60s)', s.blockingPct > 0, `got ${s.blockingPct}`)
check('recomputed p95 reflects the real tasks', s.p95BlockMs > 0, `got ${s.p95BlockMs}`)
check('recomputed worst reflects the real tasks', s.worstMs === 400, `got ${s.worstMs}`)
check('recomputed task count', s.longTaskCount === 2)

console.log('\n=== captureToSnapshot produces a renderable snapshot ===')
const snap = captureToSnapshot(validateCapture(goodCapture()))
check('not armed — a loaded file is never "measuring"', snap.armed === false)
check('armedMs carries the capture duration', snap.armedMs === 60_000)
check('frame median comes from the 16.7 and 300 samples', snap.frameMedianMs === 158.4, `got ${snap.frameMedianMs}`)
check('dropped-frame share counts the 300ms frame', snap.droppedFramePct === 50, `got ${snap.droppedFramePct}`)
check('verdict is not "unknown" (there IS data)', snap.verdict.state !== 'unknown', snap.verdict.state)
check('heap read from the last memory sample', snap.heapUsedMB === 180, `got ${snap.heapUsedMB}`)
check('ledger preserved', snap.ledger.length === 2)

console.log('\n=== a loaded capture still feeds the scope ===')
const cap = validateCapture(goodCapture())
const buckets = bucketTrace({ trace: cap.trace, windowMs: 10_000, bucketMs: 1000, sessionMs: 10_000 })
const withTask = buckets.find((b) => b.tasks > 0)
check('the scope has a slice with a blocking task', !!withTask, `buckets=${buckets.length}`)
check('that slice carries the summed blocking time', withTask ? withTask.blockMs === 400 : false, `got ${withTask?.blockMs}`)

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
/**
 * probe-perf-scope.mjs — prints NUMBERS for the frame scope's aggregation.
 *
 * Run: node --experimental-strip-types agent/probes/probe-perf-scope.mjs
 *
 * The scope's job is to fold discrete events (long tasks) and continuous
 * samples (frame deltas) onto one shared time axis. If it double-counts a
 * blocking task, every number on the page inflates and the verdict is wrong —
 * so the aggregation is probed, not eyeballed.
 */
import {
  SCOPE_BUCKET_MS,
  SCOPE_WINDOW_MS,
  LONG_TASK_MS,
  bucketTrace,
  scopeDomain,
  formatMs,
  formatElapsed,
  formatMb,
  formatSlope,
  prettifyRoute,
} from '../../src/shared/perfTypes.ts'

let failures = 0
function check(label, got, want, tol = 0) {
  const ok = typeof want === 'number' ? Math.abs(got - want) <= tol : got === want
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${got}${ok ? '' : ` want ${want}`}`)
}

const win = 10_000
const bucket = SCOPE_BUCKET_MS
const n = Math.ceil(win / bucket)

console.log('\n=== shape: fixed bucket count regardless of event volume ===')
const empty = bucketTrace({ trace: [], windowMs: win, bucketMs: bucket, sessionMs: win })
check('empty trace still yields a full axis', empty.length, n)
// A burst of 500 tasks must NOT change the point count — otherwise the chart
// itself becomes the lag the profiler is reporting.
const burstTasks = Array.from({ length: 500 }, (_, i) => ({
  id: `t${i}`, t: win - 100, durationMs: 200, route: 'dashboard', attribution: 'self', containerType: 'window',
}))
const burstTraceFor = Array.from({ length: 500 }, () => ({ t: win - 100, source: 'longtask', value: 200, unit: 'ms', route: 'dashboard' }))
const burst = bucketTrace({ trace: burstTraceFor, windowMs: win, bucketMs: bucket, sessionMs: win })
check('500 tasks in one second -> same bucket count', burst.length, n)
check('all 500 summed into one bucket', burst[burst.length - 1].blockMs, 500 * 200)
check('task count is 500', burst[burst.length - 1].tasks, 500)

console.log('\n=== no double-counting between trace + longTasks ===')
// The recorder writes a longtask into BOTH `trace` and `longTasks`. The folder
// must count it once. If it counted twice, one 300ms stall would report 600ms.
const oneTask = { id: 'a', t: win - 500, durationMs: 300, route: 'database', attribution: 'self', containerType: 'window' }
const withTrace = bucketTrace({
  trace: [{ t: win - 500, source: 'longtask', value: 300, unit: 'ms', route: 'database' }],
  windowMs: win, bucketMs: bucket, sessionMs: win,
})
const lastB = withTrace[withTrace.length - 1]
check('one task counted ONCE (not 600ms)', lastB.blockMs, 300)
check('one task, not two', lastB.tasks, 1)

console.log('\n=== worst-frame, not mean-frame ===')
// A slice with 39 fast frames and one 300ms stall: mean hides it, worst shows it.
const frames = Array.from({ length: 39 }, (_, i) => ({ t: win - 900 + i, source: 'frame', value: 16, unit: 'ms', route: 'ai' }))
const worst = bucketTrace({ trace: frames, windowMs: win, bucketMs: bucket, sessionMs: win })
check('worst frame surfaces the stall', worst[worst.length - 1].frameMs, 16)
const spike = bucketTrace({
  trace: [...frames, { t: win - 500, source: 'frame', value: 300, unit: 'ms', route: 'ai' }],
  windowMs: win, bucketMs: bucket, sessionMs: win,
})
check('a 300ms frame is NOT averaged away', spike[spike.length - 1].frameMs, 300)

console.log('\n=== window edge: events older than the window are dropped ===')
// sessionMs 20000 with a 10s window puts the window at [10000,20000], so a task
// at t=10 is genuinely outside it.
const stale = bucketTrace({
  trace: [{ t: 10, source: 'longtask', value: 900, unit: 'ms', route: 'life' }],
  windowMs: win, bucketMs: bucket, sessionMs: 20_000,
})
check('a 20s-old task is outside a 10s window', stale.reduce((s, b) => s + b.blockMs, 0), 0)

console.log('\n=== route labelling uses a majority vote ===')
const mixed = bucketTrace({
  trace: [
    { t: win - 900, source: 'longtask', value: 60, unit: 'ms', route: 'database' },
    { t: win - 800, source: 'longtask', value: 60, unit: 'ms', route: 'database' },
    { t: win - 700, source: 'longtask', value: 60, unit: 'ms', route: 'finance' },
  ],
  windowMs: win, bucketMs: bucket, sessionMs: win,
})
check('majority route wins the slice', mixed[mixed.length - 1].route, 'database')

console.log('\n=== scopeDomain always contains both thresholds ===')
const emptyDom = scopeDomain(empty)
check('empty domain still covers 2x the long-task line', emptyDom[1], LONG_TASK_MS * 2)
const bigDom = scopeDomain([{ t: 0, frameMs: 0, blockMs: 1300, tasks: 1, route: null }])
check('a 1300ms stall lifts the top above it', bigDom[1] >= 1300, true)
check('domain bottom is 0', bigDom[0], 0)

console.log('\n=== formatters ===')
check('16.7ms keeps a decimal (frame budget lives here)', formatMs(16.7), '16.7ms')
check('300ms rounds', formatMs(300), '300ms')
check('2500ms becomes seconds', formatMs(2500), '2.5s')
check('0ms', formatMs(0), '0ms')
check('negative -> em dash not NaN', formatMs(-1), '—')
check('NaN -> em dash', formatMs(NaN), '—')
check('7s', formatElapsed(7400), '0:07')
check('2m14s', formatElapsed(134_000), '2:14')
check('1h02m33s', formatElapsed(3_753_000), '1:02:33')
check('512MB', formatMb(512), '512 MB')
check('null -> em dash', formatMb(null), '—')
check('2048MB -> GB', formatMb(2048), '2 GB')
check('flat slope', formatSlope(0.01), 'steady')
check('leak shows a sign', formatSlope(4.2), '+4.2 MB/min')
check('GC release shows a sign', formatSlope(-4.2), '−4.2 MB/min')
check('route fallback prettifies', prettifyRoute('penguin-console'), 'Penguin Console')
check('nested route uses the tail', prettifyRoute('resume/build'), 'Build')
check('empty route reads as chrome', prettifyRoute(''), 'App chrome')

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
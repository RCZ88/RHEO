/**
 * probe-perf-math.mjs — prints NUMBERS for the profiler's scoring rules.
 *
 * Run: node agent/probes/probe-perf-math.mjs
 *
 * Why this exists: `src/shared/perfTypes.ts` is PURE BY CONTRACT (no window, no
 * Electron, no require) precisely so its rules can be checked by a bare Node
 * process instead of a browser. A threshold nobody measured is a guess.
 */
import {
  FRAME_BUDGET_MS,
  LONG_TASK_MS,
  percentile,
  median,
  blockingPct,
  fpsFromFrameMs,
  slopePerMinute,
  verdictFor,
} from '../../src/shared/perfTypes.ts'

let failures = 0
function check(label, got, want, tol = 0) {
  const ok = typeof want === 'number' ? Math.abs(got - want) <= tol : got === want
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${got}${ok ? '' : ` want ${want}`}`)
}

console.log('\n=== percentile (linear interpolation) ===')
check('p95 of [1..100]', percentile([...Array(100).keys()].map(i => i + 1), 95), 95.05, 0.01)
check('p50 of [1..100]', percentile([...Array(100).keys()].map(i => i + 1), 50), 50.5, 0.01)
check('p95 of single', percentile([42], 95), 42)
check('p95 of empty -> 0', percentile([], 95), 0)
check('unsorted input is sorted internally', percentile([100, 1, 50], 50), 50)
check('median of odd', median([5, 1, 3]), 3)

console.log('\n=== blockingPct — THE headline number ===')
// The comparability property: same task COUNT, wildly different freeze time.
const tenSmall = blockingPct(10 * 51, 60_000)
const tenHuge = blockingPct(10 * 400, 60_000)
console.log(`  ten x 51ms tasks over 60s  -> ${tenSmall}%  (count 10)`)
console.log(`  ten x 400ms tasks over 60s -> ${tenHuge}%  (count 10)`)
check('identical counts give DIFFERENT pct (a count would say 10 == 10)', tenSmall !== tenHuge, true)
// 10 x 51ms  = 510ms of freeze inside 60s = 0.85% -> 0.9
check('51ms task pct', tenSmall, 0.9, 0.01)
// 10 x 400ms = 4000ms of freeze inside 60s = 6.67% -> 6.7
check('400ms task pct', tenHuge, 6.7, 0.01)
check('zero observed -> 0 not Infinity', blockingPct(500, 0), 0)
check('never exceeds 100', blockingPct(9_999_999, 100), 100)
check('negative garbage -> 0', blockingPct(-5, -5), 0)

console.log('\n=== fpsFromFrameMs ===')
check('16.7ms -> 60fps', fpsFromFrameMs(16.7), 60)
check('8.35ms (120Hz) -> clamped 120', fpsFromFrameMs(8.35), 120)
check('33.4ms -> 30fps', fpsFromFrameMs(33.4), 30)
check('0 -> 0 not Infinity', fpsFromFrameMs(0), 0)
check('negative -> 0', fpsFromFrameMs(-5), 0)

console.log('\n=== slopePerMinute — the leak detector ===')
// 60 samples spanning a 60s window. Built so y rises EXACTLY 6MB across the
// window, which makes the expected slope obvious: 6MB per 60s = +6MB/min.
const N = 60
const rising = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 6)
check('linear +6MB/min detected', slopePerMinute(rising, 60_000), 6, 0.05)
const flat = Array.from({ length: N }, () => 100)
check('flat line -> 0.00 (no false leak)', slopePerMinute(flat, 60_000), 0)
const falling = Array.from({ length: N }, (_, i) => 200 - (i / (N - 1)) * 6)
check('linear -6MB/min (GC release)', slopePerMinute(falling, 60_000), -6, 0.05)
check('too few samples -> 0', slopePerMinute([1, 2], 60_000), 0)
check('zero window -> 0 not NaN', slopePerMinute(rising, 0), 0)

console.log('\n=== verdictFor — thresholds ===')
const cases = [
  [{ blockingPct: 0.2, p95BlockMs: 30, sampled: true }, 'smooth'],
  [{ blockingPct: 4, p95BlockMs: 30, sampled: true }, 'busy'],
  [{ blockingPct: 0.5, p95BlockMs: 50, sampled: true }, 'busy'],
  [{ blockingPct: 15, p95BlockMs: 30, sampled: true }, 'lagging'],
  [{ blockingPct: 0.1, p95BlockMs: 200, sampled: true }, 'lagging'],
  [{ blockingPct: 0, p95BlockMs: 0, sampled: false }, 'unknown'],
]
for (const [input, want] of cases) {
  const v = verdictFor(input)
  check(`block=${input.blockingPct}% p95=${input.p95BlockMs}ms sampled=${input.sampled}`, v.state, want)
  if (!v.because || v.because.length < 20) { failures++; console.log(`  FAIL  because is not actionable: "${v.because}"`) }
  else console.log(`         because: ${v.because}`)
}

console.log('\n=== boundary sanity: verdict agrees with the raw constants ===')
check('LONG_TASK_MS is the Chromium Long Tasks boundary', LONG_TASK_MS, 50)
check('FRAME_BUDGET_MS is one 60Hz frame', Math.round(FRAME_BUDGET_MS), 17)
check('smooth is possible only below the long-task line', verdictFor({ blockingPct: 0.1, p95BlockMs: LONG_TASK_MS - 1, sampled: true }).state, 'smooth')

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)

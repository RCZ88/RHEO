/**
 * probe-perf-recorder.mjs — exercises the recorder's STORE CONTRACT in Node.
 *
 * Run: node agent/probes/probe-perf-recorder.mjs
 *
 * `lib/perfRecorder.ts` is mostly browser-bound (PerformanceObserver, rAF,
 * window events), so this cannot verify the measurements themselves. What it CAN
 * verify is the contract the React binding depends on, and that contract has
 * real failure modes:
 *
 * 1. MODULE LOAD MUST NOT CRASH OUTSIDE A BROWSER. Every `window` touch has to
 *    be guarded, because the module is imported at app startup by a hook.
 * 2. `getSnapshot()` MUST RETURN THE SAME REFERENCE between publishes.
 *    `useSyncExternalStore` compares by identity; a fresh object per call makes
 *    React re-render forever, and a MUTATED object makes it never re-render — so
 *    the numbers on screen silently freeze. Neither failure throws, so neither is
 *    caught by tsc or by a passing build.
 * 3. arm/disarm/reset must be safe to call repeatedly and in any order.
 *
 * WHY THE esbuild STEP: `perfRecorder.ts` imports `'../shared/perfTypes'` with no
 * file extension, which is correct for Vite but rejected by Node's ESM resolver
 * (`ERR_MODULE_NOT_FOUND`). Rather than add extensions the bundler does not want,
 * the module is transpiled first — the same technique
 * `scripts/validate-page-manifests.mjs` already uses to read the TS page registry.
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const outdir = mkdtempSync(join(tmpdir(), 'pf-recorder-'))
// The transpiled bundle must outlive the dynamic import below, but not the run.
// Without this the probe leaves a temp dir behind on every invocation, which is
// the same "leak a process and forget it" discipline §0.6 applies to processes.
process.on('exit', () => {
  try {
    rmSync(outdir, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})
const outfile = join(outdir, 'perfRecorder.mjs')
// `fileURLToPath`, NOT `new URL(...).pathname` — the project path contains a
// space ("App Tracker") and `.pathname` percent-encodes it to `App%20Tracker`,
// which esbuild then cannot resolve.
const entry = fileURLToPath(new URL('../../src/lib/perfRecorder.ts', import.meta.url))
await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
})

const { arm, disarm, reset, getSnapshot, subscribe, isArmed, currentRouteId } =
  await import(pathToFileURL(outfile).href)

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`)
}

console.log('\n=== 1. the module loaded outside a browser (all window touches guarded) ===')
check('import did not throw', true)
check('isArmed() starts false', isArmed() === false)
// `null` is the CORRECT answer here: with no `window` there is no route, and the
// recorder must not invent one. An earlier version of this probe asserted a
// non-empty string and "failed" a guard that was working exactly as intended.
check('currentRouteId() is null with no window rather than a fabricated route', currentRouteId() === null, `got ${currentRouteId()}`)

console.log('\n=== 2. getSnapshot() returns a STABLE reference between publishes ===')
const s1 = getSnapshot()
const s2 = getSnapshot()
check('two consecutive calls are identical (===)', s1 === s2)
check('it is a frozen-shape object with the full contract', [
  'sessionMs', 'armed', 'verdict', 'blockingPct', 'totalBlockingMs', 'longTaskCount',
  'worstMs', 'p95BlockMs', 'frameMedianMs', 'droppedFramePct', 'fps', 'heapUsedMB',
  'heapTotalMB', 'heapLimitMB', 'heapSlopeMBPerMin', 'trace', 'longTasks', 'ledger',
  'routesSeen', 'capabilities',
].every((k) => k in s1))
check('empty snapshot does not claim a verdict it cannot support', s1.verdict.state === 'unknown', `got ${s1.verdict.state}`)
check('no NaN leaked into the snapshot', !Object.entries(s1).some(([k, v]) => typeof v === 'number' && Number.isNaN(v)))

console.log('\n=== 3. subscribers fire on publish, and unsubscribe works ===')
let fires = 0
const un = subscribe(() => { fires++ })
check('subscribe returns a function', typeof un === 'function')
arm()
check('arm() flipped isArmed()', isArmed() === true)
check('at least one publish happened after arm', fires >= 1, `fires=${fires}`)
const armedSnapshot = getSnapshot()
check('getSnapshot() changed identity after a publish', armedSnapshot !== s1, 'a mutated-in-place snapshot would break useSyncExternalStore')
check('snapshot now reports armed', armedSnapshot.armed === true)

un()
const firesAtUnsub = fires
reset()
check('no further notifications after unsubscribe', fires === firesAtUnsub, `fires went ${firesAtUnsub} -> ${fires}`)

console.log('\n=== 4. reset() clears data but stays armed ===')
reset()
check('still armed after reset', isArmed() === true)
check('trace cleared', getSnapshot().trace.length === 0)
check('long tasks cleared', getSnapshot().longTasks.length === 0)
check('ledger has exactly the current row', getSnapshot().ledger.length === 1, `got ${getSnapshot().ledger.length}`)
check('that row is the current route', getSnapshot().ledger[0].route === (currentRouteId() ?? ''))

console.log('\n=== 5. ledger invariants on a fresh accumulator ===')
const row = getSnapshot().ledger[0]
check('heapDeltaMB is 0, not NaN, before any heap sample', row.heapDeltaMB === 0, `got ${row.heapDeltaMB}`)
check('ipcMedianMs is null, not 0, before any sample', row.ipcMedianMs === null, `got ${row.ipcMedianMs}`)
check('trend starts empty', row.trend.length === 0)
check('visits starts at 1', row.visits === 1)

console.log('\n=== 6. idempotence and ordering ===')
const before = isArmed()
arm()
arm()
check('arm() twice is a no-op', isArmed() === before)
disarm()
disarm()
check('disarm() twice is a no-op', isArmed() === false)
check('a disarmed snapshot says so', getSnapshot().armed === false)
check('a disarmed snapshot refuses to judge', getSnapshot().verdict.state === 'unknown')
arm()
disarm()
reset()
check('reset() after disarm does not crash or re-arm', isArmed() === false)

console.log('\n=== 7. capabilities report honestly in an environment with no Chromium ===')
const caps = getSnapshot().capabilities
check('longtask reported unavailable here (Node has no longtask entry type)', caps.longtask === false)
check('react reported unavailable', caps.react === false)
// An earlier check here read `caps !== caps`, which is false for any value in
// JavaScript and so asserted nothing at all — a passing test that tested
// nothing. The real property is the key set: every capability the status panel
// indexes must exist, or it renders "unavailable" for a channel that works.
const CAP_KEYS = ['longtask', 'frame', 'memory', 'ipc', 'host', 'react']
check('every capability key the status panel indexes exists', CAP_KEYS.every((k) => k in caps), `got ${Object.keys(caps).join(',')}`)
check('capability values are real booleans', CAP_KEYS.every((k) => typeof caps[k] === 'boolean'))
check('no stray key beyond the six channels', Object.keys(caps).length === CAP_KEYS.length, `got ${Object.keys(caps).length}`)

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
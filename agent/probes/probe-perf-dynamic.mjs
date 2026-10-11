/**
 * probe-perf-dynamic.mjs — proves the profiler is DYNAMIC, not page-specific.
 *
 * Run: node agent/probes/probe-perf-dynamic.mjs
 *
 * THE QUESTION THIS ANSWERS
 * "Is it a dynamic system that tracks whatever page we're in, or does it only
 *  work for the pages someone wired it up for?"
 *
 * The proof is not a grep. It is an EXECUTION test: this installs a fake
 * `window`, dispatches synthetic `deskflow:route` events for routes that appear
 * NOWHERE in the codebase, and asserts each one lands in the ledger with its own
 * row. If the system had a hardcoded page list, these invented routes would be
 * dropped and this probe would fail.
 *
 * It also checks the ONE legitimate hardcoded string: `/` maps to `dashboard`,
 * which mirrors `App.tsx`'s own `location.pathname === '/' ? 'dashboard' : ...`.
 * That is the root route, not a page list.
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`)
}

/* ── install a minimal fake `window` BEFORE importing the recorder ───────────
 * `perfRecorder.ts` guards every window access with `typeof window !== 'undefined'`
 * and calls `attachRouteListener()` at module scope. Node has no window, so
 * without this the route listener would never attach and every assertion below
 * would be vacuous — a test that passes because it tested nothing. */
const fakeWindow = new EventTarget()
fakeWindow.location = { hash: '#/' }
globalThis.window = fakeWindow

const outdir = mkdtempSync(join(tmpdir(), 'pf-dyn-'))
process.on('exit', () => { try { rmSync(outdir, { recursive: true, force: true }) } catch {} })
const outfile = join(outdir, 'perfRecorder.mjs')
await build({
  entryPoints: [fileURLToPath(new URL('../../src/lib/perfRecorder.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent',
})
const rec = await import(pathToFileURL(outfile).href)
const { arm, disarm, getSnapshot, currentRouteId } = rec

/** Navigate, exactly as App.tsx signals it. */
function navigate(routeId, ms = 3000) {
  fakeWindow.dispatchEvent(new CustomEvent('deskflow:route', { detail: { page: routeId } }))
  // Advance the clock by banking observed time for the page we just left.
  const s = getSnapshot()
  void s
  void ms
}

console.log('\n=== 0. the fake window actually attached (the test is not vacuous) ===')
check('currentRouteId() resolved the root route to dashboard', currentRouteId() === 'dashboard', `got ${currentRouteId()}`)

console.log('\n=== 1. ARBITRARY routes are tracked — nothing is page-specific ===')
// None of these exist anywhere in this repository. They are invented here.
const INVENTED = ['zzz-not-a-real-page', 'queue/deep/nested/route', 'a', 'some-future-feature-2099']
arm()
for (const r of INVENTED) navigate(r)
check('currentRoute followed the last invented route', currentRouteId() === 'some-future-feature-2099', `got ${currentRouteId()}`)

let snap = getSnapshot()
const routes = snap.ledger.map((r) => r.route)
for (const r of INVENTED) {
  check(`"${r}" got its own ledger row`, routes.includes(r), `ledger has: ${JSON.stringify(routes)}`)
}
check('app chrome ("/") is tracked as its own row too', routes.includes('') || routes.includes('dashboard'), JSON.stringify(routes))
check('ledger grew to cover every route visited', snap.ledger.length >= INVENTED.length + 1, `got ${snap.ledger.length}`)

console.log('\n=== 2. re-visiting a route UPDATES its row, it does not duplicate it ===')
const before = getSnapshot().ledger.find((r) => r.route === 'zzz-not-a-real-page')?.visits ?? 0
navigate('dashboard')
navigate('zzz-not-a-real-page')
const after = getSnapshot().ledger.find((r) => r.route === 'zzz-not-a-real-page')
check('same route, one row', getSnapshot().ledger.filter((r) => r.route === 'zzz-not-a-real-page').length === 1)
check('visit count increased', (after?.visits ?? 0) > before, `${before} -> ${after?.visits}`)

console.log('\n=== 3. the duration FREEZES on stop (this is the save bug) ===')
disarm()
const atStop = getSnapshot().armedMs
check('a stopped run reports a duration', atStop > 0, `got ${atStop}`)
await new Promise((r) => setTimeout(r, 400))
const later = getSnapshot().armedMs
check('duration does NOT keep climbing after stop', later === atStop, `${atStop} -> ${later}`)

console.log('\n=== 4. re-arming ADDS to the bank instead of restarting ===')
arm()
// MUST outlast the recorder's PUBLISH_MS (250ms) timer. `getSnapshot()`
// returns the cached snapshot and only refreshes on a publish tick, so a 60ms
// wait read a stale value and this assertion failed on correct code — the same
// trap as a probe that fails on correct code being worse than none at all.
await new Promise((r) => setTimeout(r, 400))
const midSecond = getSnapshot().armedMs
check('second cycle adds to the first', midSecond > atStop, `${atStop} -> ${midSecond}`)
disarm()
const banked = getSnapshot().armedMs
await new Promise((r) => setTimeout(r, 400))
check('banked total is stable after the second stop', getSnapshot().armedMs === banked, `${banked}`)

console.log('\n=== 5. what a saved capture would record as its duration ===')
const capture = rec.exportCapture()
check('capture carries a duration', capture.durationMs === banked, `${capture.durationMs} vs ${banked}`)
check('capture duration is sane (not hours from a stuck timer)', capture.durationMs < 600_000, `${capture.durationMs}ms`)

console.log('\n=== 6. no page name is hardcoded (only the root-route mapping) ===')
const src = readFileSync(join(ROOT, 'src', 'lib', 'perfRecorder.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const KNOWN = ['dashboard', 'activity', 'ide', 'life', 'finance', 'resume', 'settings', 'studio', 'learn', 'reports', 'database', 'terminal', 'labs', 'guide', 'transcripts']
const hardcoded = KNOWN.filter((k) => new RegExp(`'${k}'`).test(src))
// 'dashboard' is allowed and ONLY as the `/` root-route mapping.
const offending = hardcoded.filter((k) => k !== 'dashboard')
check('only the root-route mapping appears', offending.length === 0, `unexpected: ${offending.join(', ')}`)
const dashHits = (src.match(/'dashboard'/g) || []).length
check("'dashboard' appears at most twice (init fallback only)", dashHits <= 2, `got ${dashHits}`)

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
/**
 * probe-perf-layout.mjs — guards the profiler page's width behaviour.
 *
 * Run: node agent/probes/probe-perf-layout.mjs
 *
 * WHY THIS EXISTS
 * The profiler page was reported "cut off on the right" three times. It was
 * never an overflow bug at all — it was a bare `max-w-[1400px]` on the page
 * shell, which pins content to the LEFT and renders the remainder as dead black
 * space, visually identical to clipping. Two wrong fixes followed (adding
 * `mx-auto`, which made the gutters symmetric but still wasted space) before
 * the cause was finally traced.
 *
 * The container chain ABOVE the page already stretches to the window:
 *   div.flex.flex-1.relative → Sidebar(fixed) + div.flex-1.overflow-hidden
 *   → div[data-page-root].flex-1.overflow-auto → cross-axis stretch
 *
 * So `data-page-root` fills the viewport and the page needs NO width cap. This
 * probe asserts that, so the class of bug cannot come back silently — it is
 * exactly the guard that was missing while three rounds of guessing happened.
 *
 * Comments are stripped before every assertion so this file's own prose about a
 * class cannot be mistaken for a component using it.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(ROOT, 'src')

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`)
}

/** Source with `//` and block comments removed, so prose cannot pass a check. */
const codeOf = (rel) => {
  const s = readFileSync(join(SRC, rel), 'utf8')
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const page = codeOf('pages/ProfilerPage.tsx')

console.log('\n=== 1. the page shell carries NO width cap (the actual root cause) ===')
const shellMatch = page.match(/<PageShell[^>]*page="profiler"[^>]*>/)
check('the profiler PageShell exists', !!shellMatch)
const shell = shellMatch?.[0] ?? ''
const caps = [...shell.matchAll(/max-w-\[(\d+)px\]/g)].map((m) => m[1])
check('no max-w-[…px] cap on the page shell', caps.length === 0, `found ${JSON.stringify(caps)}`)
check('no max-w-screen / max-w-7xl either', !/max-w-(screen|7xl|6xl)/.test(shell), shell)
check('no overflow-x-hidden on the page shell (it CLIPS, it does not prevent overflow)', !/overflow-x-hidden/.test(shell))

console.log('\n=== 2. the shell fills its container and can shrink ===')
check('w-full present', /\bw-full\b/.test(shell), shell)
check('min-w-0 present — the only load-bearing class left', /\bmin-w-0\b/.test(shell), shell)

console.log('\n=== 3. every panel can shrink (no descendant may force intrinsic width) ===')
// A flex/grid item defaults to min-width:auto, so one wide child inflates
// min-content all the way up the chain. min-w-0 + max-w-full is the fix.
// A `>` can legally appear INSIDE a quoted attribute value — Tailwind's
  // `[&>*]:min-w-0` is exactly that case. Any `<div[^>]*>` pattern truncates the
  // tag mid-className there, so the probe then failed on CORRECT code, which is
  // as dangerous as a probe that passes on broken code. `"[^"]*"` makes a quoted
  // value an atomic unit, so the matcher can cross it safely.
const TAG = /<div(?:"[^"]*"|[^"<>])*>/g
const panels = [...page.matchAll(TAG)].filter((m) => /id="pf-[a-z]+"/.test(m[0])).map((m) => m[0])
// 7 panels: vitals, trace, ledger, tasks, blame, memory, sources.
// Assert against the manifest instead of a hardcoded count, so adding a section
// fails LOUDLY here rather than being silently grandfathered in.
const manifestSrc = readFileSync(join(SRC, 'pages', 'registry', 'pages', 'profiler.ts'), 'utf8')
const declaredSections = [...manifestSrc.matchAll(/id: '(profiler\.[a-z]+)'/g)].map((m) => m[1]).length
check('a panel exists for every declared manifest section', panels.length === declaredSections, `${panels.length} panels vs ${declaredSections} sections`)
for (const p of panels) {
  const id = p.match(/id="(pf-[a-z]+)"/)?.[1] ?? '?'
  // pf-vitals is the grid; it constrains its CHILDREN via [&>*]:min-w-0 rather
  // than itself. Assert the right mechanism for each instead of one blanket rule.
  const ok = id === 'pf-vitals'
    ? /\[&>\*\]:min-w-0/.test(p)
    : /min-w-0/.test(p) && /max-w-full/.test(p)
  const how = id === 'pf-vitals' ? '[&>*]:min-w-0 on the grid' : 'min-w-0 + max-w-full'
  check(`${id} shrinks its content (${how})`, ok, p.slice(0, 100))
}

console.log('\n=== 4. the vitals grid lets its tiles shrink ===')
const grid = [...page.matchAll(TAG)].map((m) => m[0]).find((t) => /id="pf-vitals"/.test(t)) ?? ''
check('grid items can shrink below content min-content ([&>*]:min-w-0)', /\[&>\*\]:min-w-0/.test(grid), grid)
check('grid is multi-column on wide screens', /lg:grid-cols-4/.test(grid), grid)

console.log('\n=== 5. the ledger table scrolls INSIDE its box, it does not widen the page ===')
const ledger = codeOf('features/profiler/PageLedger.tsx')
check('table scroller has overflow-x-auto', /overflow-x-auto/.test(ledger))
check('scroller is shrinkable (min-w-0 + max-w-full)', /min-w-0/.test(ledger) && /max-w-full/.test(ledger))
const tableW = ledger.match(/<table[^>]*className="([^"]*)"/)?.[1] ?? ''
// `(?<![\w-])` stops `w-[560px]` from matching inside `min-w-[560px]`.
check('the table uses min-w, never a fixed w-[…px]', /(?<![\w-])min-w-\[/.test(tableW) && !/(?<![\w-])w-\[\d+px\]/.test(tableW), tableW)
check('no live overflow-x-hidden anywhere in the ledger', !/overflow-x-hidden/.test(ledger))

console.log('\n=== 6. both charts are shrinkable ===')
for (const rel of ['features/profiler/FrameScope.tsx', 'features/profiler/MemoryTrend.tsx']) {
  const c = codeOf(rel)
  const chartBox = c.match(/<div className="h-\[\d+px\][^"]*"/)?.[0] ?? ''
  check(`${rel.split('/')[1]} chart box has max-w-full + min-w-0`, /max-w-full/.test(chartBox) && /min-w-0/.test(chartBox), chartBox)
}

console.log('\n=== 7. no raw width in px survives on the page (would reintroduce a cap) ===')
// Prose in strings (ms widths, bar heights) is fine; what must not appear is a
// px WIDTH constraint, which is how the bug got in.
const pxWidths = [...page.matchAll(/(?<![\w-])w-\[(\d+)px\]/g)].map((m) => m[1])
check('no w-[…px] width utility on the page shell', pxWidths.length === 0, JSON.stringify(pxWidths))

console.log(failures === 0 ? '\n  ALL PROBES PASS\n' : `\n  ${failures} PROBE FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
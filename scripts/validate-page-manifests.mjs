#!/usr/bin/env node
/**
 * validate-page-manifests.mjs — the enforcement behind AGENTS.md §5d.
 *
 * A mandate nobody checks is a suggestion. This script fails the build for
 * every way a page can drift out of the navigation system, and it is the reason
 * "⌘K is missing half the app" is now impossible rather than merely fixed once.
 *
 * It runs as a STATIC analysis over source text — no React, no bundler — because
 * it has to run in CI and on a machine with no display. The runtime anchor audit
 * in `usePageSurface.ts` is the second line of defence; this is the first.
 *
 * Checks:
 *   1. Every <Route path> in App.tsx has a manifest whose route/match covers it.
 *   2. Every manifest route corresponds to a real route (catches `/focus`).
 *   3. Every same-page section has a `data-section` attribute in some .tsx.
 *   4. Every tab `section` has a `data-section` attribute in some .tsx.
 *   5. Every declared icon name exists in the icon vocabulary.
 *   6. Palette entry ids are unique.
 *   7. A page with tabs declares a way to receive the hint (stateKey/hashParam/
 *      storageKey) — otherwise ⌘K navigates and the tab never switches.
 *   8. Route match patterns are unambiguous (no two manifests match the same
 *      concrete path with different ids).
 *
 * Usage: node scripts/validate-page-manifests.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const REGISTRY = join(SRC, 'pages', 'registry')

const errors = []
const warnings = []
const fail = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

/* ── collect source text ─────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.cache' || name === 'dist') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p)
  }
  return out
}

const SOURCE_FILES = walk(SRC)
const APP_TSX = join(SRC, 'App.tsx')
const appText = readFileSync(APP_TSX, 'utf8')

/**
 * All literal `data-section` values anywhere in src.
 *
 * Two shapes count as "the anchor exists":
 *
 * 1. A static attribute — `data-section="ai.canvas"`.
 * 2. A TEMPLATED attribute — `data-section={`engine.${view}`}`.
 *    ContentEngineWorkspace renders one container whose id is the active pipeline
 *    stage, so all ten `engine.*` anchors are produced by a single JSX site. A
 *    static-only scan reports all ten as missing, which is a false positive that
 *    would push an author into hardcoding ten attributes that cannot coexist.
 *    So we record the literal PREFIX before the first `${` and accept any declared
 *    id that starts with it.
 */
const DATA_SECTIONS = new Set()
const DYNAMIC_SECTION_PREFIXES = new Set()
for (const f of SOURCE_FILES) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/data-section=\{?["'`]([^"'`$]+)["'`]\}?/g)) {
    DATA_SECTIONS.add(m[1])
  }
  for (const m of text.matchAll(/data-section=\{?`([^`$]*)\$\{/g)) {
    DYNAMIC_SECTION_PREFIXES.add(m[1])
  }
}
const hasAnchor = (id) =>
  DATA_SECTIONS.has(id) ||
  [...DYNAMIC_SECTION_PREFIXES].some(p => id.startsWith(p))

/** All `data-tutorial="..."` literals anywhere in src. */
const DATA_TUTORIALS = new Set()
for (const f of SOURCE_FILES) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/data-tutorial=\{?["'`]([^"'`$]+)["'`]\}?/g)) {
    DATA_TUTORIALS.add(m[1])
  }
}

/**
 * Icon names, read from the LIVE module rather than scraped from source.
 *
 * The first attempt scraped `icons.ts` with
 * `/^\s*([A-Z][A-Za-z0-9]*)\s*[,}]/gm`, which only ever captured the FIRST name
 * on each line — so `Activity, AlarmClock, AlertTriangle` yielded exactly one
 * hit and 160 icons were reported "unknown". Deriving the set from the exported
 * `ICONS` object cannot drift from what the palette will actually resolve.
 */
let ICON_NAMES = new Set()

/* ── routes declared in App.tsx ──────────────────────────────────────────── */

/**
 * Every real page route declared in App.tsx.
 *
 * Redirect routes are EXCLUDED. `<Route path="/stats" element={<Navigate …/>}>`
 * is not a page — it is a bookmark-compatibility shim for a URL that used to be
 * one, and demanding a manifest for it would mean inventing a manifest for a
 * surface that renders nothing. `/stats`, `/browser`, `/productivity`,
 * `/compositions` and `/old-dashboard` are all exactly that.
 *
 * The `*` catch-all is excluded too — it is the 404, not a page.
 */
const ROUTES = []
for (const m of appText.matchAll(/<Route\s+path=["']([^"']+)["']\s+element=\{(?:[^{}]|\{[^{}]*\})*\}/gs)) {
  const path = m[1]
  const element = m[0].slice(m[0].indexOf('element='))
  if (path === '*') continue
  if (/<Navigate\b/.test(element)) continue // bookmark redirect, not a page
  ROUTES.push(path)
}
/** Everything routed, redirects and the 404 included. */
const ALL_ROUTE_PATHS = [...appText.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map(m => m[1])

/* ── load manifests ─────────────────────────────────────────────────────── */

// The registry is TypeScript. Rather than ship a TS parser, evaluate the manifest
// modules in a tiny sandbox: strip the type imports and `satisfies`/`as` noise,
// then read the objects back out. Manifests are DATA — deliberately free of
// React imports (see icons.ts) — so this is safe and stays in sync automatically.

/**
 * Manifests are plain data, so the most reliable way to read them without a TS
 * toolchain is to let esbuild (already a dependency) transpile the barrel and
 * then import the result. That keeps this script in lockstep with the runtime.
 */
async function loadViaEsbuild() {
  const indexPath = join(REGISTRY, 'index.ts')
  const { build } = await import('esbuild')
  const outfile = join(ROOT, 'node_modules', '.cache', 'page-registry-probe.mjs')
  await build({
    entryPoints: [indexPath],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile,
    logLevel: 'silent',
    // lucide-react pulls in a lot; we only need the manifest data + icon NAMES.
    external: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
    plugins: [{
      name: 'stub-react',
      setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export const useEffect=()=>{},useMemo=f=>f,useRef=()=>({current:null}),useState=()=>[null,()=>{}],useLocation=()=>({pathname:"/",hash:"",state:null});export default {}',
          loader: 'js',
        }))
        b.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'rr', namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export const useLocation=()=>({pathname:"/",hash:"",state:null});export default {}',
          loader: 'js',
        }))
      },
    }],
  })
  const mod = await import(`file://${outfile}?t=${Date.now()}`)
  return mod
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const labels = []
const ids = new Set()

function checkManifest(p, trail = '') {
  const where = trail || p.id
  if (!p.id) { fail(`${where}: missing id`); return }
  if (ids.has(p.id)) fail(`duplicate page id "${p.id}"`)
  ids.add(p.id)

  // A command row (`event`) intentionally has no route; anything else must.
  if (!p.route && !p.event) fail(`${where}: missing route (and no event, so nothing to dispatch)`)
  labels.push({ id: p.id, label: p.label, route: p.route, match: p.match ?? p.route, hidden: !!p.hidden, icon: p.icon, event: p.event })

  // 5. icon names
  for (const [field, ic] of [['page', p.icon], ...(p.tabs?.items ?? []).map(t => [`tab:${t.id}`, t.icon])]) {
    if (ic && !ICON_NAMES.has(ic)) fail(`${where}: unknown icon "${ic}" on ${field}`)
  }

  // 3/4. anchors
  for (const s of p.sections ?? []) {
    if (s.route) continue // cross-page shortcut, no anchor by design
    if (!hasAnchor(s.id)) {
      fail(`${where}: section "${s.id}" has no data-section anywhere in src/ — ⌘K would navigate but not scroll`)
    }
  }
  const walkTabs = (tabs) => {
    for (const t of tabs) {
      if (t.section && !hasAnchor(t.section)) {
        fail(`${where}: tab "${t.id}" points at section "${t.section}" which has no data-section in src/`)
      }
      if (t.children?.length) walkTabs(t.children)
    }
  }
  walkTabs(p.tabs?.items ?? [])

  // 7. a page with tabs must say how it receives the hint
  if (p.tabs?.items?.length && !p.hidden) {
    const m = p.tabs
    if (!m.stateKey && !m.hashParam && !m.storageKey) {
      fail(`${where}: declares tabs but no stateKey/hashParam/storageKey — ⌘K cannot switch the tab`)
    }
    if (m.default && !m.items.some(i => i.id === m.default)) {
      fail(`${where}: default tab "${m.default}" is not one of its items`)
    }
    const dup = m.items.map(i => i.id).filter((id, i, a) => a.indexOf(id) !== i)
    if (dup.length) fail(`${where}: duplicate tab id(s) ${dup.join(', ')}`)
  }

  // tutorial targets
  for (const step of p.tutorial?.steps ?? []) {
    const m = step.target.match(/\[data-tutorial="([^"]+)"\]/)
    if (!m) {
      warn(`${where}: tutorial step target "${step.target}" is not a [data-tutorial="…"] selector`)
    } else if (!DATA_TUTORIALS.has(m[1])) {
      fail(`${where}: tutorial step targets [data-tutorial="${m[1]}"] which no component renders`)
    }
  }

  for (const c of p.children ?? []) checkManifest(c, `${where} > ${c.id}`)
}

const run = async () => {
  // Load failures become errors, not silent early returns. A validator that
  // exits 0 having printed nothing is worse than no validator: it looks like a
  // pass. Every path below now falls through to `report()`.
  let mod = null
  try {
    mod = await loadViaEsbuild()
  } catch (e) {
    fail(`could not load the registry: ${e && e.message ? e.message : e}`)
  }

  if (mod) {
    ICON_NAMES = new Set(Object.keys(mod.ICONS ?? {}))
    if (!ICON_NAMES.size) fail('ICONS is empty — icons.ts failed to load')
    const manifests = mod.PAGE_MANIFESTS ?? []
    if (!manifests.length) fail('PAGE_MANIFESTS is empty')

    for (const p of manifests) checkManifest(p)

  // 1. every real route is covered by a manifest
  //
  // A splat route (`/lecture/*`) is covered by any manifest whose route is its
  // PREFIX — the child manifests describe the individual sub-routes underneath,
  // and the parent describes the landing page. Requiring a literal match would
  // force a redundant `/lecture/*` manifest that navigates nowhere useful.
  for (const route of ROUTES) {
    const isSplat = route.endsWith('/*')
    const bare = isSplat ? route.slice(0, -2) : route
    const covered = manifests.some(p => {
      for (const m of [p, ...(p.children ?? [])]) {
        const pat = m.match ?? m.route
        if (pat === route) return true
        if (isSplat && (pat === bare || pat.startsWith(`${bare}/`))) return true
        const norm = (x) => x.split('/').filter(Boolean)
        const a = norm(pat)
        const b = norm(route)
        if (pat.endsWith('/*')) return a.every((seg, i) => b[i] === seg) && b.length >= a.length
        if (pat.includes(':')) {
          return a.length === b.length && a.every((seg, i) => seg.startsWith(':') || seg === b[i])
        }
      }
      return false
    })
    if (!covered) {
      fail(`route "${route}" has no manifest — add src/pages/registry/pages/<name>.ts and register it in manifests.ts (AGENTS.md §5d)`)
    }
  }

  // 2. every manifest route is actually routable (catches retired pages that 404).
  //    A child route under a splat parent is fine: `/lecture/*` reaches it.
  const splatPrefixes = ALL_ROUTE_PATHS.filter(p => p.endsWith('/*')).map(p => p.slice(0, -2))
  for (const { id, route, hidden, event } of labels) {
    if (hidden) continue
    // A command row deliberately has no route — it dispatches an event instead.
    if (event) continue
    if (route === '/' || ALL_ROUTE_PATHS.includes(route)) continue
    if (splatPrefixes.some(pre => route === pre || route.startsWith(`${pre}/`))) continue
    fail(`manifest "${id}" points at route "${route}" which App.tsx does not route — ⌘K would land on NotFoundPage`)
  }

  // 6. palette ids unique
  const seen = new Set()
  for (const e of mod.PALETTE_ENTRIES ?? []) {
    if (seen.has(e.id)) fail(`duplicate palette entry id "${e.id}"`)
    seen.add(e.id)
  }

  // 8. unambiguous matching
  const sample = ['/activity', '/ide', '/life', '/learn', '/studio', '/labs', '/finance',
    '/resume', '/resume/build', '/resume/preview', '/resume/import', '/resume/export',
    '/external', '/reports', '/database', '/settings', '/guide', '/terminal',
    '/lecture', '/lecture/decks', '/lecture/decks/42', '/lecture/image-lab',
    '/lecture/transcriber', '/lecture/prompts', '/penguin-console', '/simple-terminal',
    '/ide-help']
  for (const s of sample) {
    const hit = mod.manifestForPath?.(s)
    if (!hit) { warn(`no manifest matches "${s}"`); continue }
    const resolved = mod.pageIdForPath?.(s)
    if (resolved !== hit.id) fail(`pageIdForPath("${s}") returned "${resolved}" but manifestForPath returned "${hit.id}"`)
  }

  }

  // report
  const nEntries = (mod?.PALETTE_ENTRIES ?? []).length
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ errors, warnings, pages: labels.length, paletteEntries: nEntries }, null, 2))
  } else {
    console.log(`\n  page manifests : ${labels.length}`)
    console.log(`  palette entries: ${nEntries}`)
    console.log(`  data-sections  : ${DATA_SECTIONS.size} static + ${DYNAMIC_SECTION_PREFIXES.size} templated (${[...DYNAMIC_SECTION_PREFIXES].join(', ') || 'none'})`)
    console.log(`  data-tutorial  : ${DATA_TUTORIALS.size} found in src/`)
    if (warnings.length) {
      console.log(`\n  ${warnings.length} warning(s):`)
      for (const w of warnings) console.log(`    ~ ${w}`)
    }
    if (errors.length) {
      console.log(`\n  ${errors.length} ERROR(s):`)
      for (const e of errors) console.log(`    ✗ ${e}`)
      console.log('')
      process.exit(1)
    }
    console.log(`\n  ✓ every route has a manifest, every anchor exists, every icon resolves\n`)
  }
}

run().catch(e => {
  console.error('validator crashed:', e)
  process.exit(1)
})
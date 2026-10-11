/**
 * probe-perf-imports.mjs — proves every cross-module import in the profiler
 * feature resolves to a REAL export.
 *
 * Run: node agent/probes/probe-perf-imports.mjs
 *
 * WHY THIS EXISTS
 * `PerformanceObserver` is browser-only and `main.ts` is 1.4MB, so most of this
 * feature cannot be exercised by a Node probe. What CAN be proven statically is
 * the failure mode that has actually bitten this repo: an import that resolves to
 * nothing and only explodes at runtime as `X is not defined`. That happened with
 * `notes={notes}` in the Penguin Console — esbuild passed, `tsc` passed, the
 * build passed, and the shipped page threw on click.
 *
 * A type checker will NOT catch it when the consumer is typed `any` (which the
 * preload surface is), so this checks the text of the import against the text of
 * the target module's exports.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(ROOT, 'src')

const MY_FILES = [
  'pages/ProfilerPage.tsx',
  'hooks/usePerfProfiler.ts',
  'lib/perfRecorder.ts',
  'shared/perfTypes.ts',
  ...readdirSync(join(SRC, 'features', 'profiler')).map((f) => `features/profiler/${f}`),
]

let failures = 0
const bad = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}

/** Named exports of a module, read from its source text. */
function exportsOf(absPath) {
  const src = readFileSync(absPath, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) names.add(m[1])
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/)
      const name = (bits[1] ?? bits[0] ?? '').trim()
      if (name) names.add(name)
    }
  }
  if (/export\s+default/.test(src)) names.add('default')
  return names
}

/** Resolve a relative specifier the way Vite/TS would. */
function resolveRelative(fromFile, spec) {
  const base = resolvePath(dirname(fromFile), spec)
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    try {
      readFileSync(cand, 'utf8')
      return cand
    } catch {
      /* keep trying */
    }
  }
  return null
}

console.log('\n=== every relative import in the profiler feature resolves ===')
let checked = 0
for (const rel of MY_FILES) {
  const abs = join(SRC, rel)
  const src = readFileSync(abs, 'utf8')
  const importRe = /import\s*(type\s*)?\{([^{}]*)\}\s*from\s*'([^']+)'/g
  for (const m of src.matchAll(importRe)) {
    const spec = m[3]
    if (!spec.startsWith('.')) continue
    const target = resolveRelative(abs, spec)
    if (!target) {
      bad(`${rel}: cannot resolve '${spec}'`)
      continue
    }
    const available = exportsOf(target)
    for (const raw of m[2].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim()
      if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue
      checked++
      if (!available.has(name)) {
        bad(`${rel}: '${name}' is not exported by ${spec}`)
      }
    }
  }
}
console.log(`  checked ${checked} named imports across ${MY_FILES.length} files`)

console.log('\n=== barrel re-export sanity (no cycle: index must not be imported by data) ===')
const indexSrc = readFileSync(join(SRC, 'pages', 'registry', 'index.ts'), 'utf8')
const manifestSrc = readFileSync(join(SRC, 'pages', 'registry', 'manifests.ts'), 'utf8')
if (/from\s*'\.\/index'/.test(manifestSrc)) bad('manifests.ts imports the barrel — that is the white-screen cycle')
else console.log('  PASS  manifests.ts does not import the barrel')
for (const needed of ['usePageSurface', 'PAGE_MANIFESTS', 'getManifest']) {
  const inIndex = new RegExp(needed).test(indexSrc)
  const inReg = new RegExp(needed).test(readFileSync(join(SRC, 'pages', 'registry', 'registry.ts'), 'utf8'))
  if (!inIndex && !inReg) bad(`registry barrel cannot supply '${needed}'`)
  else console.log(`  PASS  '${needed}' reachable from the registry barrel`)
}

console.log('\n=== the manifest and the page agree on every section anchor ===')
const pageSrc = readFileSync(join(SRC, 'pages', 'ProfilerPage.tsx'), 'utf8')
const manifestSrc2 = readFileSync(join(SRC, 'pages', 'registry', 'pages', 'profiler.ts'), 'utf8')
const declared = [...manifestSrc2.matchAll(/id:\s*'(profiler\.[a-z]+)'/g)].map((m) => m[1])
const rendered = new Set([...pageSrc.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]))
console.log(`  manifest declares ${declared.length}, page renders ${rendered.size}`)
for (const id of declared) {
  if (!rendered.has(id)) bad(`manifest declares section '${id}' but ProfilerPage never renders it`)
  else console.log(`  PASS  ${id} declared AND rendered`)
}
for (const id of rendered) {
  if (!declared.includes(id)) bad(`page renders data-section '${id}' that no manifest declares`)
}

console.log('\n=== IPC: the preload bridge and the main handler name the same channel ===')
const preloadSrc = readFileSync(join(SRC, 'preload.ts'), 'utf8')
const mainSrc = readFileSync(join(SRC, 'main.ts'), 'utf8')
const invoked = [...preloadSrc.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((m) => m[1])
const handled = new Set([...mainSrc.matchAll(/ipcMain\.handle\('([^']+)'/g)].map((m) => m[1]))
for (const ch of ['perf:ping', 'console:metrics']) {
  if (!invoked.includes(ch)) bad(`preload never invokes '${ch}'`)
  if (!handled.has(ch)) bad(`main.ts has no ipcMain.handle('${ch}')`)
  if (invoked.includes(ch) && handled.has(ch)) console.log(`  PASS  '${ch}' invoked in preload AND handled in main`)
}

console.log('\n=== the recorder only calls APIs that exist on the preload bridge ===')
const recSrc = readFileSync(join(SRC, 'lib', 'perfRecorder.ts'), 'utf8')
// The recorder aliases the bridge as `const a = api()` and then calls `a?.name`,
// so the shape to match is the aliased local, not `api()?.name` — an earlier
// version of this probe grepped for the latter, matched nothing, and printed an
// empty PASS-looking section. A check that inspects zero call sites is worse
// than no check, so the count is asserted too.
const aliasDecl = recSrc.match(/const\s+(\w+)\s*=\s*api\(\)/)
if (!aliasDecl) bad('could not find the `api()` alias in perfRecorder — update this probe')
const alias = aliasDecl?.[1] ?? 'a'
const used = new Set([...recSrc.matchAll(new RegExp(`\\b${alias}\\?\\.(\\w+)`, 'g'))].map((m) => m[1]))
console.log(`  recorder calls ${used.size} preload methods via '${alias}'`)
if (used.size === 0) bad('found zero api() call sites — the check below is vacuous')
for (const key of used) {
  const onBridge = new RegExp(`\\b${key}:`).test(preloadSrc)
  if (!onBridge) bad(`perfRecorder calls ${alias}?.${key}, which preload does not expose`)
  else console.log(`  PASS  ${alias}?.${key} exists on the preload bridge`)
}

console.log(failures === 0 ? '\n  ALL IMPORT POSTCONDITIONS HOLD\n' : `\n  ${failures} FAILURE(S)\n`)
process.exit(failures === 0 ? 0 : 1)
#!/usr/bin/env node
/**
 * brain-3d-bundle.probe.mjs — D6 WP-3D-A/I bundle probe (RESULT_PART2_3D §11.2).
 *
 * 1. `three` resolves at exactly 0.187.0 (spec pin).
 * 2. Both classic addon paths exist (controls + CSS2DRenderer).
 * 3. esbuild bundle of the full import set, minified, within +5% of the
 *    spec-measured 564,617 bytes (drift guard against accidental deep
 *    imports of all of examples/jsm).
 * 4. Chunk-vs-inline report: reads the project's own renderer config.
 *    Rollup (vite build) SPLITS dynamic imports by default unless
 *    `inlineDynamicImports` is set; the lazy import in BrainVisualization
 *    is a dynamic import, so the config check decides it. NOT TESTED beyond
 *    that — CZ's build reveals the real chunk.
 * Run: node agent/probes/brain-3d-bundle.probe.mjs
 */

import { build } from 'esbuild'
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname).replace(/\/agent$/, '')

let failures = 0
let passes = 0
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`  PASS  ${name}`) }
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

// 1. Version pin.
const threePkg = JSON.parse(readFileSync(join(ROOT, 'node_modules/three/package.json'), 'utf8'))
check('1. three version === 0.187.0', threePkg.version === '0.187.0', `got ${threePkg.version}`)
const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
check('1b. package.json pins three 0.187.0 (runtime dep)',
  /^0\.187\.0$/.test(String(rootPkg.dependencies?.three || '').replace(/[\^~]/g, '')),
  `got ${rootPkg.dependencies?.three}`)
check('1c. @types/three is a devDependency (zero bundle cost)',
  !!rootPkg.devDependencies?.['@types/three'], `got ${rootPkg.devDependencies?.['@types/three']}`)

// 2. Addon paths (classic examples/jsm paths, per spec §1.3).
const controlsPath = join(ROOT, 'node_modules/three/examples/jsm/controls/OrbitControls.js')
const css2dPath = join(ROOT, 'node_modules/three/examples/jsm/renderers/CSS2DRenderer.js')
check('2a. OrbitControls.js exists', existsSync(controlsPath))
check('2b. CSS2DRenderer.js exists', existsSync(css2dPath))

// 3. Full-set bundle size drift guard (spec measured 564,617 B minified).
const tmp = mkdtempSync(join(tmpdir(), 'brain3d-bundle-'))
const stub = join(tmp, 'entry.mjs')
writeFileSync(stub, `
import {
  WebGLRenderer, Scene, PerspectiveCamera, InstancedMesh, SphereGeometry,
  MeshBasicMaterial, LineBasicMaterial, LineDashedMaterial, LineSegments,
  BufferGeometry, BufferAttribute, RingGeometry, Mesh, DynamicDrawUsage,
  DoubleSide, Matrix4, Color, Vector2, Vector3, Plane, Raycaster,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
export { WebGLRenderer, Scene, OrbitControls, CSS2DRenderer, CSS2DObject }
`)
try {
  const r = await build({
    entryPoints: [stub],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    absWorkingDir: ROOT,
    nodePaths: [join(ROOT, 'node_modules')],
    logLevel: 'warning',
  })
  const size = r.outputFiles[0].contents.length
  const REF = 564617
  const drift = (size - REF) / REF
  check(`3. minified bundle ${size} B within +5% of ${REF} B`, size <= REF * 1.05, `drift ${(drift * 100).toFixed(1)}%`)
  // Also confirm GraphScene3D.tsx itself bundles (the real import set, react external).
  await build({
    entryPoints: [join(ROOT, 'src/features/warmth/context-brain/GraphScene3D.tsx')],
    bundle: true,
    minify: true,
    format: 'esm',
    outfile: '/dev/null',
    external: ['react'],
    logLevel: 'warning',
  })
  check('3b. GraphScene3D.tsx bundles clean (minified)', true)
} catch (err) {
  failures++
  console.error('  FAIL  3. bundle error:', err?.message ?? err)
} finally {
  try { rmSync(tmp, { recursive: true, force: true }) } catch { /* volatile */ }
}

// 4. Chunk-vs-inline from the project's own renderer config.
try {
  const cfg = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
  const inlineDynamic = cfg.includes('inlineDynamicImports')
  // rollupOptions without inlineDynamicImports → dynamic imports split.
  check('4. renderer build SPLITS the lazy GraphScene3D chunk (config-derived)',
    !inlineDynamic,
    inlineDynamic ? 'inlineDynamicImports set — would inline' : 'no inlineDynamicImports in rollupOptions → rollup splits dynamic imports')
  console.log('        (config-derived report; the real chunk layout is revealed by CZ\'s build — NOT TESTED beyond this)')
} catch (err) {
  console.log('  WARN  4. could not read vite.config.ts — UNKNOWN, CZ build reveals')
}

console.log(`\n${passes}/${passes + failures} PASS`)
process.exit(failures ? 1 : 0)

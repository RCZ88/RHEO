#!/usr/bin/env node
/**
 * brain-3d-layout.probe.mjs — D6 WP-3D-C numeric probe (RESULT_PART2_3D §11.1).
 *
 * Compiles the PURE layout module (zero `three` imports) with esbuild to a
 * temp ESM file, imports it, and asserts the spec's six numeric requirements.
 * ALL PASS required. Run: node agent/probes/brain-3d-layout.probe.mjs
 */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname).replace(/\/agent$/, '')
const SRC = join(ROOT, 'src/features/warmth/context-brain/graph3d/layout.ts')

const tmp = mkdtempSync(join(tmpdir(), 'brain3d-'))
const OUT = join(tmp, 'layout.mjs')

let failures = 0
let passes = 0
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`  PASS  ${name}`) }
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

try {
  await build({
    entryPoints: [SRC],
    bundle: true,
    format: 'esm',
    outfile: OUT,
    logLevel: 'warning',
  })
  const mod = await import(pathToFileURL(OUT).href)
  const { capFor3D, computeLayout3D, framingDistance, WORLD_R, ELEV_H } = mod

  const mkNode = (i, over = {}) => ({
    id: `n${i}`, name: `Node ${i}`, type: 'concept', state: 'active',
    degree: 0, facts: [], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ...over,
  })
  const mkLink = (s, t, synthetic = false) => ({ source: s, target: t, predicate: 'rel', synthetic })

  // ── 1. cap on a synthetic 300-node / 900-link payload ──
  {
    const nodes = Array.from({ length: 300 }, (_, i) => mkNode(i, { degree: i, x: i, y: i }))
    const links = []
    for (let i = 0; i < 900; i++) {
      links.push(mkLink(`n${i % 300}`, `n${(i * 7 + 13) % 300}`, i % 2 === 0))
    }
    const r = capFor3D(nodes, links)
    check('1a. nodes.length === 150', r.nodes.length === 150, `got ${r.nodes.length}`)
    check('1b. links.length <= 300', r.links.length <= 300, `got ${r.links.length}`)
    check('1c. droppedNodes === 150', r.droppedNodes === 150, `got ${r.droppedNodes}`)
  }

  // ── 2. culled endpoints never survive; real outranks synthetic ──
  {
    // 10 nodes, cap 4: the 6 lowest-degree are culled. Links touching them must vanish.
    const nodes = Array.from({ length: 10 }, (_, i) => mkNode(`k${i}`.replace('k', ''), { id: `n${i}`, degree: i }))
    const links = [
      mkLink('n9', 'n8'),              // real, both kept
      mkLink('n9', 'n0'),              // endpoint culled
      mkLink('n0', 'n1', true),        // both culled
      mkLink('n8', 'n7'),              // real, both kept
      mkLink('n7', 'n6'),              // real, both kept
      mkLink('n6', 'n5', true),        // synth, both kept
      mkLink('n5', 'n4', true),        // synth, both kept
      mkLink('n4', 'n3', true),        // synth, one endpoint at rank boundary? n4 kept (degree 4) — both kept
      mkLink('n3', 'n2', true),        // synth, both kept
      mkLink('n2', 'n1', true),        // synth, both kept
    ]
    const r = capFor3D(nodes, links, 4, 3)
    const ids = new Set(r.nodes.map(n => n.id))
    check('2a. kept are the 4 highest-degree', ids.has('n9') && ids.has('n8') && ids.has('n7') && ids.has('n6') && ids.size === 4, [...ids].join(','))
    const bad = r.links.filter(l => !ids.has(l.source) || !ids.has(l.target))
    check('2b. no link survives with a culled endpoint', bad.length === 0, `${bad.length} orphans`)
    check('2c. links capped at 3', r.links.length === 3, `got ${r.links.length}`)
    check('2d. real links fill the cap first', r.links.every(l => !l.synthetic), 'expected all real under cap')
    check('2e. droppedLinks counted', r.droppedLinks === links.length - 3, `got ${r.droppedLinks}`)
  }

  // ── 3. determinism (incl. tiebreak by id) ──
  {
    const mk = () => {
      const nodes = Array.from({ length: 40 }, (_, i) => mkNode(i, { id: `n${(i * 13) % 40}`.padStart(3, '0'), degree: i % 5, x: i * 3.7, y: i * -1.9 }))
      const links = Array.from({ length: 80 }, (_, i) => mkLink(`n${String((i * 11) % 40).padStart(3, '0')}`, `n${String((i * 17 + 3) % 40).padStart(3, '0')}`, i % 3 === 0))
      return capFor3D(nodes, links)
    }
    const a = mk(), b = mk()
    check('3. two runs deep-equal (nodes order)', JSON.stringify(a.nodes.map(n => n.id)) === JSON.stringify(b.nodes.map(n => n.id)))
    check('3b. two runs deep-equal (links)', JSON.stringify(a.links) === JSON.stringify(b.links))
    // Explicit tiebreak: equal degrees must order by id ascending.
    const tied = [mkNode(1, { id: 'b', degree: 5 }), mkNode(0, { id: 'a', degree: 5 })]
    const tr = capFor3D(tied, [], 2, 10)
    check('3c. equal-degree tiebreak is id asc', tr.nodes[0].id === 'a' && tr.nodes[1].id === 'b')
  }

  // ── 4. computeLayout3D bounds, elevation extrema, z-mirror ──
  {
    const nodes = Array.from({ length: 25 }, (_, i) => mkNode(i, {
      id: `n${i}`,
      degree: i + 1,                       // 1..25, maxDeg = 25
      x: -50 + i * 7.3,
      y: 120 - i * 11.7,
    }))
    const pos = computeLayout3D(nodes)
    let okBounds = true
    let okZ = true
    const maxDeg = 25
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
    }
    const spanX = Math.max(1e-6, maxX - minX), spanY = Math.max(1e-6, maxY - minY)
    const span = Math.max(spanX, spanY)
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2
    nodes.forEach((n, i) => {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
      if (Math.abs(x) > 2 * WORLD_R + 1e-6 || Math.abs(z) > 2 * WORLD_R + 1e-6 || Math.abs(y) > ELEV_H + 1e-6) okBounds = false
      const ex = ((n.x - midX) / span) * 2 * WORLD_R
      const ez = -(((n.y - midY) / span) * 2 * WORLD_R)
      if (Math.abs(x - ex) > 1e-6 || Math.abs(z - ez) > 1e-6) okZ = false
      const elev = ((n.degree / maxDeg) * 2 - 1) * ELEV_H
      if (Math.abs(y - elev) > 1e-6) okBounds = false
    })
    check('4a. |x|,|z| <= 2·WORLD_R and |y| <= ELEV_H (exact elevations)', okBounds)
    check('4b. z is the negated normalized 2D y (chirality mirror)', okZ)
    const iMax = nodes.findIndex(n => n.degree === maxDeg)
    const iMin = nodes.findIndex(n => n.degree === 1)
    check('4c. max-degree node has max elevation', Math.abs(pos[iMax * 3 + 1] - ELEV_H) < 1e-6, `got ${pos[iMax * 3 + 1]}`)
    // Spec: min-degree node has the MINIMUM elevation among the nodes (only
    // degree 0 would hit exactly −ELEV_H; degree 1 of maxDeg 25 = −2.76, which
    // is correct — the first FAIL here was the assertion, not the code).
    let minElev = Infinity
    for (let i = 0; i < nodes.length; i++) minElev = Math.min(minElev, pos[i * 3 + 1])
    const expected = ((1 / maxDeg) * 2 - 1) * ELEV_H
    check('4d. min-degree node has the minimum elevation', Math.abs(pos[iMin * 3 + 1] - expected) < 1e-6 && pos[iMin * 3 + 1] === minElev, `got ${pos[iMin * 3 + 1]}, min ${minElev}, expected ${expected}`)
  }

  // ── 5. framingDistance floor + monotonicity ──
  {
    const d0 = framingDistance(10, 50, 1.0)
    check('5a. framingDistance(10,50,1.0) >= 8', d0 >= 8, `got ${d0}`)
    let mono = true
    let prev = -Infinity
    for (const r of [4, 6, 8, 10, 14, 20, 40]) {
      const d = framingDistance(r, 50, 1.0)
      if (d <= prev) mono = false
      prev = d
    }
    check('5b. monotonically increasing in radius', mono)
  }

  // ── 6. empty guard ──
  {
    const empty = computeLayout3D([])
    check('6. computeLayout3D([]) returns a zero-length array', empty instanceof Float32Array && empty.length === 0, `len ${empty.length}`)
  }
} catch (err) {
  failures++
  console.error('  FAIL  probe harness error:', err)
} finally {
  try { rmSync(tmp, { recursive: true, force: true }) } catch { /* volatile */ }
}

console.log(`\n${passes}/${passes + failures} PASS`)
process.exit(failures ? 1 : 0)

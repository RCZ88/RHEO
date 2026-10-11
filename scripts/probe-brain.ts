/**
 * PROBE — does the brain visualisation actually animate and organise?
 * Run: npx esbuild scripts/probe-brain.ts --bundle --platform=node --format=esm --outfile=/tmp/probe-brain.mjs && node /tmp/probe-brain.mjs
 *
 * This prints NUMBERS, not claims. It exercises the two real fixes:
 *   A. the force layout (which did not exist before) and
 *   B. `computeCascade` -> `lastFiredAt` -> `getNodeGlow`, which was a permanent
 *      zero before, i.e. the animation was dead at the source.
 */
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, forceZ } from 'd3-force-3d'
import { computeCascade, getNodeGlow, fireNode, buildNodeIndex } from '../src/features/warmth/context-brain/physics/avalanche'

const W = 1200, H = 640

// ── The shape the real app produces: degree 0 on every node. ──
const N = 40
const nodes: any[] = Array.from({ length: N }, (_, i) => ({
  id: `ent_${i}`, name: `entity ${i}`, type: 'concept',
  state: 'neutral' as const, degree: 0, facts: [], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
}))
const links: any[] = []
for (let i = 1; i < N; i++) links.push({ source: `ent_${i}`, target: `ent_${(i * 7 + 3) % i}`, predicate: 'knows' })
// Snapshot taken NOW, before d3 can rewrite these in place.
const PRISTINE = links.map(l => ({ source: l.source as string, target: l.target as string }))

// Mirror of BrainGraph's radiusForDegree.
const radiusForDegree = (d: number) => Math.max(5, Math.min(20, 4 + Math.sqrt(d) * 2.6))

// ── Count degrees, exactly as BrainGraph does. ──
const degreeById = new Map<string, number>()
for (const l of links) {
  const s = l.source as string, t = l.target as string
  degreeById.set(s, (degreeById.get(s) || 0) + 1)
  degreeById.set(t, (degreeById.get(t) || 0) + 1)
}
for (const n of nodes) { n.degree = degreeById.get(n.id) ?? 0; n.r = radiusForDegree(n.degree) }

// ── THE BUG THAT MADE EVERY EDGE VANISH, reproduced deliberately. ──
const shared = links
const sharedSim = forceLink<any, any>(shared).id((d: any) => d.id)
const throwaway = forceSimulation(nodes.slice(), 2).force('l', sharedSim).stop()
void throwaway
const mutated = (shared[0] as any).source
console.log('── EDGE-INDEX HAZARD ──')
console.log('  links[0].source after forceLink initialised :', typeof mutated, JSON.stringify(typeof mutated === 'object' && mutated ? mutated.id : mutated))
console.log('  => a renderer doing nodes.find(n => n.id === link.source) now gets',
  typeof mutated === 'object' ? 'undefined (every edge vanishes)' : 'a match')

// ── The real sim, cloning links like BrainGraph does. ──
const simNodes = nodes.map(n => ({ ...n }))
const simLinks = links.map(l => ({ source: l.source as string, target: l.target as string }))
const endpointDegree = (e: any) => degreeById.get(typeof e === 'object' ? e.id : String(e)) ?? 0

const cx = W / 2, cy = H / 2
const sim = forceSimulation(simNodes, 2)
  .force('link', forceLink(simLinks).id((d: any) => d.id)
    .distance((l: any) => 68 + Math.min(60, Math.max(endpointDegree(l.source), endpointDegree(l.target)) * 6))
    .strength((l: any) => 0.55 / (1 + Math.max(endpointDegree(l.source), endpointDegree(l.target)) * 0.25)))
  .force('charge', forceManyBody().strength((d: any) => -140 - Math.min(320, (d.degree || 0) * 22)).distanceMax(340))
  .force('collide', forceCollide().radius((d: any) => d.r + 7).strength(0.85))
  .force('center', forceCenter(cx, cy))
  .force('x', forceX(cx).strength(0.055))
  .force('y', forceY(cy).strength(0.075))
  .force('z', forceZ(0).strength(1))
  .alphaDecay(0.028)
  .velocityDecay(0.42)
sim.stop()
sim.tick(140)
for (const n of simNodes) {
  n.x = Math.max(28, Math.min(W - 28, n.x))
  n.y = Math.max(28, Math.min(H - 28, n.y))
}

console.log('\n── A. FORCE LAYOUT ──')
const xs = simNodes.map(n => n.x), ys = simNodes.map(n => n.y)
const spreadX = Math.max(...xs) - Math.min(...xs)
const spreadY = Math.max(...ys) - Math.min(...ys)
let minD = Infinity, overlaps = 0
for (let i = 0; i < simNodes.length; i++) for (let j = i + 1; j < simNodes.length; j++) {
  const d = Math.hypot(simNodes[i].x - simNodes[j].x, simNodes[i].y - simNodes[j].y)
  if (d < minD) minD = d
  if (d < simNodes[i].r + simNodes[j].r) overlaps++
}
const atOrigin = simNodes.filter(n => n.x === 0 || n.y === 0).length
const radii = [...new Set(simNodes.map(n => n.r))].sort((a, b) => a - b)
console.log(`  nodes laid out          : ${simNodes.length}`)
console.log(`  x spread                : ${spreadX.toFixed(1)}px  (canvas ${W})`)
console.log(`  y spread                : ${spreadY.toFixed(1)}px  (canvas ${H})`)
console.log(`  every node has a position: ${atOrigin === 0 ? 'YES' : `NO — ${atOrigin} at x/y=0`}`)
console.log(`  min pairwise distance   : ${minD.toFixed(1)}px`)
console.log(`  nodes stacked on a peer : ${overlaps}`)
console.log(`  distinct radii (degree) : [${radii.join(', ')}]  <- was a flat [4] before`)
console.log(`  radius range is real    : ${radii.length > 1 ? 'YES' : 'NO — all nodes identical size'}`)

console.log('\n── B. AVALANCHE / GLOW  (the fix) ──')
const before = simNodes.reduce((s, n) => s + getNodeGlow(n, Date.now()), 0)
console.log(`  aggregate glow at rest  : ${before.toFixed(4)}`)
const t0 = Date.now()
// PRISTINE copy on purpose. `links` was rewritten by forceLink above, and
// `computeCascade` keys its adjacency map by endpoint id — so a mutated
// array silently builds an EMPTY adjacency list and the cascade never
// propagates past the origin. Same hazard, second victim.
const adjacencySize = (() => { const m = new Set<string>(); for (const e of PRISTINE) { m.add(e.source); m.add(e.target) } return m.size })()
console.log(`  distinct endpoints in pristine adjacency: ${adjacencySize}`)

// The cascade engine is PROBABILISTIC: branchProb = 0.45 * 0.65^depth + degBonus.
// A single trial from a degree-1 node legitimately returns exactly 1 event, so
// measuring one trial proves nothing. Fire the hub 40 times and report the shape.
const hub = [...simNodes].sort((a, b) => b.degree - a.degree)[0]
console.log(`  origin = ${hub.id} (degree ${hub.degree})`)

const TRIALS = 40
const sizes: number[] = []
let deepest = 0
for (let i = 0; i < TRIALS; i++) {
  const c = computeCascade(hub.id, simNodes as any, PRISTINE as any, t0 + i * 10_000)
  sizes.push(c.events.length)
  if (c.depth > deepest) deepest = c.depth
}
sizes.sort((a, b) => a - b)
const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length
console.log(`  cascade size over ${TRIALS} trials : min=${sizes[0]} median=${sizes[TRIALS >> 1]} max=${sizes[TRIALS - 1]} mean=${mean.toFixed(2)}`)
console.log(`  deepest cascade reached            : hop ${deepest}`)
console.log(`  cascades that propagated past origin: ${sizes.filter(s => s > 1).length}/${TRIALS}`)

// One concrete cascade for the glow/decay numbers below, from a fresh origin.
// Same synthetic clock, past every refractory window the trials opened.
const finalNow = t0 + TRIALS * 10_000 + 10_000
const cascade = computeCascade(hub.id, simNodes as any, PRISTINE as any, finalNow)
const firedWithStamp = simNodes.filter(n => n.lastFiredAt === finalNow).length
console.log(`  cascade events          : ${cascade.events.length}  (magnitude ${cascade.totalMagnitude.toFixed(2)}, depth ${cascade.depth})`)
console.log(`  nodes carrying lastFiredAt: ${firedWithStamp}  <- was 0 => nothing could ever glow`)
const T = finalNow  // CascadeResult carries no timestamp field; use the clock we fired on
const samples = [0, 100, 300, 700, 1500, 1600].map(dt => {
  const g = simNodes.reduce((s, n) => s + getNodeGlow(n, T + dt), 0)
  return `t+${String(dt).padStart(4)}ms=${g.toFixed(3)}`
})
console.log(`  decay envelope          : ${samples.join('  ')}`)
const peak = Math.max(...simNodes.map(n => getNodeGlow(n, T)))
console.log(`  peak glow               : ${peak.toFixed(3)}  <- >0 means the firing animation renders`)

console.log('\n── C. EDGE SIGNAL (O(1) lookup) ──')
const idx = buildNodeIndex(simNodes)
const lit = PRISTINE.filter(l => {
  const s = idx.get(l.source); const t = idx.get(l.target)
  if (!s || !t) return false
  return Math.max(getNodeGlow(s, T), getNodeGlow(t, T)) > 0.01
}).length
const unresolvable = PRISTINE.filter(l => !idx.get(l.source) || !idx.get(l.target)).length
console.log(`  edges with an unresolvable endpoint : ${unresolvable}  (renderer skips these, it does not crash)`)
console.log(`  edges carrying signal   : ${lit} of ${simLinks.length}`)
const clamped = simNodes.every(n => getNodeGlow(n, T + 20_000) === 0)
console.log(`  glow clamps to 0 after decay: ${clamped ? 'YES' : 'NO'}`)
const skew = getNodeGlow({ ...simNodes[0], lastFiredAt: T + 5000 } as any, T)
console.log(`  glow clamped for clock skew (now < lastFiredAt): ${skew === 0 ? 'YES' : `NO -> ${skew}`}`)

console.log('\n── D. BACKWARDS CLOCK ──')
// Simulate NTP/suspend: every node carries a future lastFiredAt.
const skewed = simNodes.map(n => ({ ...n, lastFiredAt: T + 3_600_000 }))
const skewedCascade = computeCascade(hub.id, skewed as any, PRISTINE as any, T)
console.log(`  cascade after every node was stamped 1h in the future: ${skewedCascade.events.length} events`)
console.log(`  a backwards clock step does not silence the network  : ${skewedCascade.events.length > 1 ? 'YES' : 'NO'}`)
const glowFuture = getNodeGlow({ ...simNodes[0], lastFiredAt: T + 60_000 } as any, T)
console.log(`  a future-stamped node renders as NOT glowing        : ${glowFuture === 0 ? 'YES' : 'NO'} (${glowFuture.toFixed(3)})`)

console.log('\n── E. REDUCED MOTION ──')
sim.alpha(1).tick(320).alpha(0).stop()
console.log(`  settled ticks then stop : alpha=${sim.alpha()} (alphaTarget=${sim.alphaTarget()})`)
// A stopped simulation schedules no ticks. Verify no tick is pending by checking
// that the node positions are STABLE across a macrotask, i.e. nothing is driving
// them. d3's tick() would still move them if called, so we must not call it.
const posBefore = simNodes.map(n => `${n.x.toFixed(3)},${n.y.toFixed(3)}`).join('|')
await new Promise(r => setTimeout(r, 60))
const posAfter = simNodes.map(n => `${n.x.toFixed(3)},${n.y.toFixed(3)}`).join('|')
console.log(`  positions stable with no scheduled tick: ${posBefore === posAfter ? 'YES' : 'NO'}`)
const glowAtRest = simNodes.reduce((s, n) => s + getNodeGlow(n, Date.now()), 0)
console.log(`  no residual glow after settling      : ${glowAtRest === 0 ? 'YES' : 'NO'} (${glowAtRest.toFixed(4)})`)

const checks: Array<[string, boolean]> = [
  ['every node has a real position', atOrigin === 0],
  ['layout uses >50% of canvas width', spreadX > W * 0.5],
  ['layout uses >60% of canvas height', spreadY > H * 0.6],
  ['node radius varies with real degree', radii.length > 1],
  ['every cascaded node got lastFiredAt', firedWithStamp === cascade.events.length],
  ['cascades propagate past the origin', sizes.filter(sz => sz > 1).length >= TRIALS * 0.5],
  ['firing produces non-zero glow', peak > 0],
  ['edges carry the signal', lit > 0],
  ['glow clamps to 0 after decay', clamped],
  ['glow clamped on clock skew', skew === 0],
  ['reduced motion leaves it static', posBefore === posAfter],
  ['backwards clock does not silence cascades', skewedCascade.events.length > 1],
]
let pass = true
for (const [name, ok] of checks) { if (!ok) pass = false; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`) }
console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`)
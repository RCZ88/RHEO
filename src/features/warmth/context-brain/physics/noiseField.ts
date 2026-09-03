/**
 * noiseField.ts — Seeded curl-noise flow field (Bridson's technique).
 *
 * Divergence-free: particles never clump or fountain unnaturally.
 * Exposes sample(x, y, t) for flow direction and biasAt(x, y, strength)
 * for data-driven perturbation from live node positions.
 *
 * Zero dependencies — pure math.
 */

// ── Seeded RNG (LCG, same family as the old NeuralFlow) ──
let _seed = 42
export function setNoiseSeed(s: number) { _seed = s }
function rand(): number {
  _seed = (_seed * 16807) % 2147483647
  return (_seed - 1) / 2147483646
}

// ── Permutation table for gradient hashing ──
const PERM_SIZE = 256
const perm: number[] = []
const gradX: number[] = []
const gradY: number[] = []

function initTables() {
  for (let i = 0; i < PERM_SIZE; i++) {
    perm[i] = i
    gradX[i] = rand() * 2 - 1
    gradY[i] = rand() * 2 - 1
  }
  // Fisher-Yates shuffle
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp
  }
  // Duplicate for overflow
  for (let i = 0; i < PERM_SIZE; i++) {
    perm[PERM_SIZE + i] = perm[i]
  }
}
initTables()

// ── Smoothstep interpolation ──
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

// ── 2D gradient from hash ──
function grad(hash: number, x: number, y: number): [number, number] {
  const h = hash & (PERM_SIZE - 1)
  return [gradX[h] * x + gradY[h] * y, gradX[h] * y - gradY[h] * x]
}

/**
 * Raw Perlin-like noise value at (x, y).
 */
export function noise2D(x: number, y: number): number {
  const xi = Math.floor(x) & (PERM_SIZE - 1)
  const yi = Math.floor(y) & (PERM_SIZE - 1)
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)

  const aa = perm[perm[xi] + yi]
  const ab = perm[perm[xi] + yi + 1]
  const ba = perm[perm[xi + 1] + yi]
  const bb = perm[perm[xi + 1] + yi + 1]

  const g00 = grad(aa, xf, yf)
  const g10 = grad(ba, xf - 1, yf)
  const g01 = grad(ab, xf, yf - 1)
  const g11 = grad(bb, xf - 1, yf - 1)

  const n00 = g00[0] + g00[1]
  const n10 = g10[0] + g10[1]
  const n01 = g01[0] + g01[1]
  const n11 = g11[0] + g11[1]

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v)
}

/**
 * Curl of the noise field at (x, y, t).
 * Returns a divergence-free 2D vector [vx, vy].
 * This is what makes the flow look organic instead of particles drifting into clumps.
 */
export function curlNoise(x: number, y: number, t: number): [number, number] {
  const eps = 0.01
  const n1 = noise2D(x, y + eps, t)
  const n2 = noise2D(x, y - eps, t)
  const n3 = noise2D(x + eps, y, t)
  const n4 = noise2D(x - eps, y, t)

  // dN/dy and dN/dx
  const dNdy = (n1 - n2) / (2 * eps)
  const dNdx = (n3 - n4) / (2 * eps)

  // Curl in 2D: (dN/dy, -dN/dx)
  return [dNdy, -dNdx]
}

/**
 * Sample the flow field at a position and time.
 * Returns a normalized direction vector.
 */
export function sample(x: number, y: number, t: number): [number, number] {
  const [vx, vy] = curlNoise(x * 0.005, y * 0.005, t * 0.0004)
  const mag = Math.sqrt(vx * vx + vy * vy)
  if (mag < 0.0001) return [0, 0]
  return [vx / mag, vy / mag]
}

/**
 * Bias the flow field toward a data point.
 * Returns a strength value [0, 1] representing how much the field
 * should be perturbed near (px, py) — used to tie the ambient flow
 * to live node positions.
 */
export function biasAt(x: number, y: number, px: number, py: number, radius: number): number {
  const dx = x - px
  const dy = y - py
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > radius) return 0
  return (1 - dist / radius) * (1 - dist / radius) // quadratic falloff
}

/**
 * Aggregate bias from multiple data points (node positions).
 * Returns total bias strength at (x, y).
 */
export function aggregateBias(
  x: number, y: number,
  points: Array<{ x: number; y: number; strength: number }>,
  radius: number
): number {
  let total = 0
  for (const p of points) {
    total += biasAt(x, y, p.x, p.y, radius) * p.strength
  }
  return Math.min(total, 1)
}

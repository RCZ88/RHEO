/**
 * avalanche.ts — Self-Organized Criticality (SOC) cascade engine.
 *
 * Models neuronal avalanches (Beggs & Plenz 2003): when a node fires,
 * a signal propagates outward along edges with probabilistic branching.
 * Some fires die immediately; occasionally a cascade sweeps the network.
 *
 * Each node has a refractory window — a node that just fired can't
 * re-fire immediately. This keeps cascades from looping forever
 * and is biologically real.
 */

export interface AvalancheNode {
  id: string
  x: number
  y: number
  degree: number
  state: 'active' | 'blocked' | 'neutral'
  lastFiredAt?: number
  /** Peak magnitude of the most recent fire. Scales the glow envelope. */
  lastFiredPeak?: number
}

export interface AvalancheEdge {
  source: string
  target: string
}

export interface AvalancheEvent {
  nodeId: string
  magnitude: number
  timestamp: number
  depth: number // hops from origin
}

export interface CascadeResult {
  events: AvalancheEvent[]
  totalMagnitude: number
  depth: number
}

// ── Constants ──
const REFRACTORY_MS = 800 // window during which a node can't re-fire
const MAGNITUDE_DECAY = 0.65 // per-hop magnitude decay
const BRANCH_PROBABILITY_BASE = 0.45 // base probability of branching
const MIN_MAGNITUDE = 0.05 // below this, cascade dies

/**
 * How long a fired node's glow takes to decay to nothing. Exported because the
 * renderer needs the same constant to size the pulse envelope, and because the
 * reduced-motion path renders a static peak over exactly this window.
 */
export const GLOW_DECAY_MS = 1500

/**
 * Mark a single node as fired right now.
 *
 * THIS IS THE FUNCTION THE VISUAL SYSTEM WAS MISSING. `getNodeGlow` reads
 * `node.lastFiredAt`, and before this existed nothing ever *wrote* that field
 * — `computeCascade` built a list of `AvalancheEvent`s and threw it away, and
 * the Self page's state-diff poll stamped `lastFiredAt` onto a freshly-fetched
 * IPC object that was discarded on the next line. So `getNodeGlow` returned 0
 * for every node, permanently, and the entire suprathreshold regime — the
 * amber firing rim, the halo, the travelling edge signal — was dead code. The
 * animation did not "not look right"; it was never being asked to draw.
 *
 * Call this on the node objects you actually render.
 */
export function fireNode(node: AvalancheNode, now: number, magnitude = 1): AvalancheNode {
  node.lastFiredAt = now
  // Scale the peak by magnitude so a small fringe event is visibly weaker
  // than the origin of a large cascade.
  node.lastFiredPeak = Math.max(node.lastFiredPeak ?? 0, magnitude)
  return node
}

/** O(1) node lookup by id. The renderer builds one per frame instead of
 *  calling `Array.find` inside a per-edge loop (which was O(links x nodes)).
 *
 *  Generic in the node type so the result stays `SimNode` (with x/y/degree)
 *  rather than widening to the bare `AvalancheNode` shape. */
export function buildNodeIndex<T extends AvalancheNode>(
  nodes: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>()
  for (const n of nodes) index.set(n.id, n)
  return index
}

/**
 * Compute a cascade from a fire origin.
 * Uses BFS with probabilistic branching.
 */
export function computeCascade(
  originId: string,
  nodes: AvalancheNode[],
  edges: AvalancheEdge[],
  now: number,
  originMagnitude = 1.0
): CascadeResult {
  const nodeMap = new Map<string, AvalancheNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  // Build adjacency list
  const adjacency = new Map<string, string[]>()
  for (const n of nodes) adjacency.set(n.id, [])
  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target)
    adjacency.get(e.target)?.push(e.source)
  }

  const events: AvalancheEvent[] = []
  const fired = new Set<string>()
  const queue: Array<{ id: string; magnitude: number; depth: number }> = [
    { id: originId, magnitude: originMagnitude, depth: 0 }
  ]

  while (queue.length > 0) {
    const { id, magnitude, depth } = queue.shift()!
    const node = nodeMap.get(id)
    if (!node) continue
    if (fired.has(id)) continue

    // Refractory check.
    //
    // The `lastFired <= now` guard is load-bearing. A plain
    // `now - node.lastFiredAt < REFRACTORY_MS` also returns true when
    // `lastFiredAt` is in the FUTURE, and a future timestamp means the wall
    // clock moved backwards (NTP correction, resume from suspend) — at which
    // point every node looks perpetually refractory and NO cascade can ever
    // fire again. A future stamp is treated here as "has not fired".
    const lastFired = node.lastFiredAt ?? Number.NEGATIVE_INFINITY
    if (lastFired <= now && now - lastFired < REFRACTORY_MS) continue

    // Fire this node.
    //
    // The write to `node.lastFiredAt` is what makes the cascade VISIBLE. It is
    // the only bridge between the event engine and `getNodeGlow`, so without it
    // `computeCascade` produces a correct event list that nothing can ever see.
    fired.add(id)
    fireNode(node, now, magnitude)

    events.push({ nodeId: id, magnitude, timestamp: now, depth })

    // Try to propagate to neighbors
    const neighbors = adjacency.get(id) || []
    for (const neighborId of neighbors) {
      if (fired.has(neighborId)) continue

      // Branch probability decreases with depth and increases with degree
      const neighbor = nodeMap.get(neighborId)
      if (!neighbor) continue

      const degreeBonus = Math.min(neighbor.degree * 0.05, 0.2)
      const branchProb = BRANCH_PROBABILITY_BASE * Math.pow(MAGNITUDE_DECAY, depth) + degreeBonus

      if (Math.random() < branchProb) {
        const nextMagnitude = magnitude * MAGNITUDE_DECAY
        if (nextMagnitude > MIN_MAGNITUDE) {
          queue.push({ id: neighborId, magnitude: nextMagnitude, depth: depth + 1 })
        }
      }
    }
  }

  const totalMagnitude = events.reduce((sum, e) => sum + e.magnitude, 0)
  const depth = events.length > 0 ? Math.max(...events.map(e => e.depth)) : 0

  return { events, totalMagnitude, depth }
}

/**
 * Determine if a reheat should occur based on recent avalanche size.
 * Criticality-coupled: quiet unless perturbed, not on a wall clock.
 */
export function shouldReheat(
  lastCascadeMagnitude: number,
  lastReheatTime: number,
  now: number,
  baseInterval = 8000
): boolean {
  // Scale interval inversely with recent activity
  // Big cascade → shorter interval (network is "warm")
  // Small/no cascade → longer interval (network is "cool")
  const activityFactor = Math.max(0.2, 1 - lastCascadeMagnitude * 0.5)
  const interval = baseInterval * activityFactor
  return now - lastReheatTime > interval
}

/**
 * Get the current magnitude of a node's visual "glow" based on when it last fired.
 * Returns 0..1, decaying exponentially over ~1.5s.
 *
 * Two robustness fixes over the original:
 *  - the result is clamped to [0,1]. A negative `elapsed` (clock skew, or a
 *    `now` captured before the fire) made `Math.exp()` return a value >1, which
 *    upstream is used as a halo radius multiplier and blew the node up.
 *  - the envelope is scaled by `lastFiredPeak`, so a magnitude-0.3 fringe event
 *    reads as a fringe event instead of a full-strength spike.
 */
export function getNodeGlow(node: AvalancheNode, now: number): number {
  if (!node.lastFiredAt) return 0
  const elapsed = now - node.lastFiredAt
  if (elapsed > GLOW_DECAY_MS || elapsed < 0) return 0
  const envelope = Math.exp((-3 * elapsed) / GLOW_DECAY_MS)
  const peak = node.lastFiredPeak ?? 1
  return Math.max(0, Math.min(1, envelope * peak))
}

/**
 * Get the current magnitude of an edge's visual "signal" based on when its
 * source node last fired. Returns 0..1.
 *
 * `index` is an optional prebuilt id→node map from `buildNodeIndex`. Without it
 * this falls back to a linear scan, which is what the renderer used to do once
 * per edge per frame — quadratic in a 300-node graph at 60fps.
 */
export function getEdgeSignal(
  edge: AvalancheEdge,
  nodes: readonly AvalancheNode[],
  now: number,
  index?: Map<string, AvalancheNode>,
): number {
  const source = index ? index.get(edge.source) : nodes.find(n => n.id === edge.source)
  if (!source) return 0
  return getNodeGlow(source, now)
}

/**
 * True when anything anywhere in the graph is currently glowing.
 *
 * This replaces a heuristic that sampled "hottest node glow" on a 1s wall clock
 * to decide whether to keep the simulation warm. That was both a linear scan
 * and the wrong signal: what the physics needs to know is "did an avalanche
 * just happen", which is a discrete event, not a continuous quantity. Drive it
 * from the cascade result instead.
 */
export function graphIsHot<T extends AvalancheNode>(
  nodes: readonly T[],
  now: number,
): boolean {
  for (const n of nodes) if (getNodeGlow(n, now) > 0.01) return true
  return false
}

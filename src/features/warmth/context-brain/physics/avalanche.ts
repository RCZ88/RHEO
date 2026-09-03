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

    // Refractory check
    if (node.lastFiredAt && now - node.lastFiredAt < REFRACTORY_MS) continue

    // Fire this node
    fired.add(id)
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
 */
export function getNodeGlow(node: AvalancheNode, now: number): number {
  if (!node.lastFiredAt) return 0
  const elapsed = now - node.lastFiredAt
  const decayTime = 1500
  if (elapsed > decayTime) return 0
  return Math.exp(-3 * (elapsed / decayTime)) // fast rise, slow decay
}

/**
 * Get the current magnitude of an edge's visual "signal" based on when its
 * source node last fired. Returns 0..1.
 */
export function getEdgeSignal(
  edge: AvalancheEdge,
  nodes: AvalancheNode[],
  now: number
): number {
  const source = nodes.find(n => n.id === edge.source)
  if (!source) return 0
  return getNodeGlow(source, now)
}

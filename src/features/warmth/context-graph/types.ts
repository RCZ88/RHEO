export interface GraphNode {
  id: string
  name: string
  type: string
  state: 'active' | 'blocked' | 'neutral'
  degree: number
  facts: { predicate: string; value: string }[]
  source?: string
  // Physics positions (mutated by d3-force, read by R3F)
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /**
   * When this node last fired, in epoch ms. RUNTIME-ONLY and never persisted.
   *
   * This is the field the whole suprathreshold visual regime hangs off:
   * `getNodeGlow` reads it, and it is the ONLY bridge between the avalanche
   * engine (`computeCascade` / `fireNode` in `physics/avalanche.ts`) and
   * anything being drawn.
   *
   * It used to be absent from this type while three separate components read
   * and wrote it ad hoc, which is precisely why the firing animation was
   * permanently dead: `computeCascade` never stamped it, the Self page's poll
   * stamped it onto a throwaway IPC object, and `ActivityFeed.tsx` was reading
   * it off `GraphNode` with no such field declared — two standing type errors
   * that documented the bug. Declared here so the contract is honest.
   */
  lastFiredAt?: number
  /** Peak magnitude of the most recent fire. Scales the glow envelope. */
  lastFiredPeak?: number
}

export interface GraphLink {
  source: string
  target: string
  predicate: string
}

export const TYPE_COLORS: Record<string, string> = {
  goal: '#22c55e',
  project: '#3b82f6',
  deadline: '#ef4444',
  person: '#f59e0b',
  tool: '#8b5cf6',
  concept: '#06b6d4',
  life_phase: '#ec4899',
  default: '#71717a',
}

export const STATE_COLORS: Record<string, string> = {
  active: '#22c55e',
  blocked: '#ef4444',
  neutral: '#fafafa',
}

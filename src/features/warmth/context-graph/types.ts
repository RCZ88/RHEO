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

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
  /** G1 (RESULT-M6): true when the edge is inferred from co-occurrence, not a stored fact link. */
  synthetic?: boolean
}

export const TYPE_COLORS: Record<string, string> = {
  goal: '#22c55e',
  project: '#3b82f6',
  deadline: '#ef4444',
  person: '#f59e0b',
  tool: '#8b5cf6',
  concept: '#06b6d4',
  life_phase: '#ec4899',
  ai_provider: '#14b8a6',
  content_asset: '#eab308',
  lesson: '#84cc16',
  default: '#71717a',
}

export const STATE_COLORS: Record<string, string> = {
  active: '#22c55e',
  blocked: '#ef4444',
  neutral: '#fafafa',
}

// ── D6 (RESULT_PART2_3D.md) — shared 2D/3D constants ─────────────────────────
// Pinned to the literals BrainGraph.tsx actually draws with (via graphTokens.ts
// fallbacks, which mirror src/index.css): the selection ring is `P.labelStrong`
// = `--text-primary` (fallback [250,250,250] = #fafafa) at 0.95 alpha, and the
// firing halo is `P.spike` = `--color-amber-400` (fallback [245,158,11] =
// #f59e0b). 2D resolves these from live CSS per frame; 3D materials cannot, so
// they read these constants. If a token value changes, change these with it.
/** Selection ring hue — the ONE accent the graph surface uses (2D ring and 3D ring). */
export const SELECTION_ACCENT = '#fafafa'
/** Firing hue — amber. Amber appears ONLY on firing nodes, never on selection, never on chrome. */
export const FIRING_AMBER = '#f59e0b'
/** 3D caps — see WP-3D-I of RESULT_PART2_3D.md. */
export const CAP_3D_NODES = 150
export const CAP_3D_LINKS = 300
export const CAP_3D_LABELS = 12
export type GraphViewMode = '2d' | '3d'

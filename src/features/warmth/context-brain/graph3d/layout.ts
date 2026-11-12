/**
 * layout.ts — pure 3D layout + capping for the D6 brain view.
 *
 * ZERO `three` imports on purpose: this module is pure math so the numeric
 * probe (`agent/probes/brain-3d-layout.probe.mjs`) can execute it verbatim
 * after an esbuild compile, exactly like the WP-C probe pattern.
 *
 * Design (WP-3D-C of RESULT_PART2_3D.md — do not "fix" these choices):
 * - The payload's `x, y` are the spatial truth the user already knows from 2D.
 *   3D maps the normalized 2D plane onto the ground plane (z mirrors the 2D y
 *   sign so the plan-view orientation matches 2D exactly) and raises hubs by
 *   degree. There is NO force simulation in 3D v1 — a sim would re-derive a
 *   layout the user already has opinions about.
 * - Determinism is a hard requirement: identical input → identical output,
 *   including the degree/id tiebreak in `capFor3D`.
 */

import type { GraphNode, GraphLink } from '../../context-graph/types'
import { CAP_3D_NODES, CAP_3D_LINKS } from '../../context-graph/types'

export const WORLD_R = 10;      // normalized ground-plane radius
export const ELEV_H = 3.0;      // hub elevation amplitude (±)

export interface Capped3D {
  nodes: GraphNode[]; links: GraphLink[];
  droppedNodes: number; droppedLinks: number;
}

/** Degree-ranked node cap; links survive only with both endpoints; real links outrank synthetic. Deterministic (stable tiebreak: id asc). */
export function capFor3D(nodes: GraphNode[], links: GraphLink[],
                         maxNodes = CAP_3D_NODES, maxLinks = CAP_3D_LINKS): Capped3D {
  const kept = [...nodes]
    .sort((a, b) => (b.degree - a.degree) || (a.id < b.id ? -1 : 1))
    .slice(0, maxNodes);
  const ids = new Set(kept.map(n => n.id));
  const real: GraphLink[] = [], synth: GraphLink[] = [];
  for (const l of links) {
    if (!ids.has(l.source) || !ids.has(l.target)) continue;
    (l.synthetic ? synth : real).push(l);
  }
  const keptLinks = [...real, ...synth].slice(0, maxLinks);
  return {
    nodes: kept, links: keptLinks,
    droppedNodes: nodes.length - kept.length,
    droppedLinks: links.length - keptLinks.length,
  };
}

/**
 * Deterministic 3D placement from the payload:
 *   (x, y) 2D plane  ->  (x, -y) ground plane, normalized to WORLD_R
 *   y (up)           ->  degree elevation, hubs rise
 * Returns a flat [x,y,z, x,y,z, ...] array ordered like `nodes`.
 */
export function computeLayout3D(nodes: GraphNode[]): Float32Array {
  const pos = new Float32Array(nodes.length * 3);
  if (!nodes.length) return pos;
  const maxDeg = Math.max(1, ...nodes.map(n => n.degree));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const x = Number.isFinite(n.x) ? n.x : 0, y = Number.isFinite(n.y) ? n.y : 0;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(1e-6, maxX - minX), spanY = Math.max(1e-6, maxY - minY);
  const span = Math.max(spanX, spanY);
  nodes.forEach((n, i) => {
    const x = (Number.isFinite(n.x) ? n.x : 0) - (minX + maxX) / 2;
    const y = (Number.isFinite(n.y) ? n.y : 0) - (minY + maxY) / 2;
    const elev = ((n.degree / maxDeg) * 2 - 1) * ELEV_H;     // [-ELEV_H, +ELEV_H], hubs up
    pos[i * 3]     = (x / span) * 2 * WORLD_R;               // ground plane X
    pos[i * 3 + 1] = elev;                                   // up = degree
    pos[i * 3 + 2] = -(y / span) * 2 * WORLD_R;              // ground plane Z (mirror 2D chirality)
  });
  return pos;
}

/** Camera distance that frames the whole layout: R / tan(half the tighter fov) × 1.15, floored. */
export function framingDistance(radius: number, fovDeg: number, aspect: number, min = 8): number {
  const fovV = (fovDeg * Math.PI) / 180;
  const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
  return Math.max(min, (radius / Math.tan(Math.min(fovV, fovH) / 2)) * 1.15);
}

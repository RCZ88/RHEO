/**
 * workforceSceneModel.ts — the translation table and the animation machine.
 *
 * Integration plan §6, one row at a time:
 *
 *   PTY spawning, no `terminal:ready` → booting: ring only, no badge
 *   `agent:ready`                    → idle
 *   `agent:timeout`                  → error ring, "failed to start" in inspector
 *   events arriving                  → action, station, pose  (THIS FILE)
 *   terminal closed, session saved   → saved: dim ghost at its desk
 *   zero terminals open              → render nothing
 *
 * Everything in this file is PURE. `advanceFleet` is a function of
 * (fleet, dt, now) and returns a new fleet — no timers, no refs, no DOM. That
 * is what makes the timing rules below testable, and integration plan §8.9 is
 * only achievable because the tick is not entangled with rendering.
 */

import type { ActionEvent, ActionKind } from '../../../shared/workforceActivity';

/* ------------------------------------------------------------------ */
/* geometry                                                             */
/* ------------------------------------------------------------------ */

/**
 * The office is a GRID of TILES (integration plan visual reference:
 * "Tile 64x32"), and every position in it is expressed in tile coordinates
 * `(gx, gy)`. Keeping positions in tiles — not pixels — is what lets the
 * renderer scale the whole scene to any viewport and lets pathfinding work in
 * plain arithmetic.
 */
export const GRID = 8;

export const TILE_W = 32;
export const TILE_H = 16;

/** Isometric projection: grid → scene units. (The reference's `P`.) */
export function project(gx: number, gy: number): [number, number] {
  return [(gx - gy) * TILE_W, (gx + gy) * TILE_H];
}

/**
 * Depth key for painter's-algorithm draw order. Everything is sorted by
 * centre `x + y` once per frame — see `sortByDepth` and §8.9 for why we
 * re-sort ONLY when a worker crosses a tile rather than every frame.
 */
export function depthOf(gx: number, gy: number): number {
  return gx + gy;
}

/* ------------------------------------------------------------------ */
/* stations                                                            */
/* ------------------------------------------------------------------ */

export type StationId =
  | 'desk'
  | 'cab'
  | 'shelf'
  | 'bench'
  | 'test'
  | 'sw'
  | 'door'
  | 'wb'
  | 'rack'
  | 'vault'
  | 'easel'
  | 'bell';

/** What the station IS, described in the app's own vocabulary. */
export interface StationDef {
  id: StationId;
  name: string;
  /** grid position of the station's tile origin (grid units) */
  gx: number;
  gy: number;
  /** footprint in tiles */
  w: number;
  d: number;
  /** where a worker stands to USE this station */
  stand: readonly [number, number];
  /**
   * The real thing this station stands for. Copied from the visual
   * reference's MAPS, which lists the actual agent tools that route here.
   * Shown verbatim in the station inspector, so the scene is self-explaining
   * instead of decorative.
   */
  handles: string;
  /** altitude for the float-on-active affordance, in scene units */
  h: number;
  /**
   * The action whose icon is the station's standing sigil — what this piece of
   * equipment IS for, shown before anyone uses it. Derived from `handles`, and
   * kept as an explicit field rather than parsed out of that prose so a station
   * can never render an icon that disagrees with its own description.
   */
  handlesIcon: ActionKind;
}

export const STATIONS: readonly StationDef[] = [
  { id: 'desk', name: 'Desk', gx: 0, gy: 0, w: 0, d: 0, stand: [0, 0], h: 8, handles: 'Edit, Write, MultiEdit', handlesIcon: 'edit' },
  { id: 'cab', name: 'Filing cabinet', gx: 1, gy: 0, w: 1, d: 1, stand: [1.5, 1.45], h: 26, handles: 'Grep, Glob, rg, find, fd', handlesIcon: 'search' },
  { id: 'shelf', name: 'Bookshelf', gx: 2, gy: 0, w: 1, d: 1, stand: [2.5, 1.45], h: 34, handles: 'Read, cat, head, tail, git show', handlesIcon: 'read' },
  { id: 'bench', name: 'Workbench', gx: 3, gy: 0, w: 1, d: 1, stand: [3.5, 1.45], h: 14, handles: 'tsc, vite build, cargo build, make', handlesIcon: 'build' },
  { id: 'test', name: 'Test bench', gx: 4, gy: 0, w: 1, d: 1, stand: [4.5, 1.45], h: 14, handles: 'vitest, jest, pytest, go test', handlesIcon: 'test' },
  { id: 'sw', name: 'Switchboard', gx: 5, gy: 0, w: 1, d: 1, stand: [5.5, 1.45], h: 24, handles: 'mcp__server__tool calls', handlesIcon: 'mcp' },
  { id: 'door', name: 'Door', gx: 6, gy: 0, w: 1, d: 0.25, stand: [5.5, 1.45], h: 38, handles: 'WebFetch, WebSearch, curl, git push', handlesIcon: 'web' },
  { id: 'wb', name: 'Whiteboard', gx: 0, gy: 1, w: 0.25, d: 1, stand: [1.45, 1.5], h: 36, handles: 'Thinking, TodoWrite, plan mode', handlesIcon: 'think' },
  { id: 'rack', name: 'Server rack', gx: 0, gy: 2, w: 1, d: 1, stand: [1.45, 2.5], h: 42, handles: 'prisma, psql, sqlite3, migrations', handlesIcon: 'database' },
  { id: 'vault', name: 'Vault', gx: 0, gy: 3, w: 1, d: 1, stand: [1.45, 3.5], h: 22, handles: 'Checkpoints, git commit, backups', handlesIcon: 'commit' },
  { id: 'easel', name: 'Easel', gx: 0, gy: 4, w: 1, d: 1, stand: [1.45, 4.5], h: 30, handles: 'CSS, tailwind, design files', handlesIcon: 'edit' },
  { id: 'bell', name: 'Help bell', gx: 7, gy: 3, w: 1, d: 1, stand: [6.5, 3.5], h: 10, handles: 'AskUserQuestion, permission prompts', handlesIcon: 'blocked' },
];

export const STATION_BY_ID: Record<StationId, StationDef> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
) as Record<StationId, StationDef>;

/* ------------------------------------------------------------------ */
/* ActionKind → station, label, pose                                    */
/* ------------------------------------------------------------------ */

export interface ActionSpec {
  /** the real station this action happens at */
  station: StationId;
  /** one line, in the user's vocabulary, not the tool's */
  label: string;
  /** the arm/head pose the worker takes while doing it */
  pose: WorkerPose;
  /** SVG icon (16×16 box, stroke-based, `fill:none`) */
  icon: string;
}

/**
 * The translation table. INTEGRATION PLAN §6: "Events arriving → action,
 * station, pose from the translation table."
 *
 * A kind with no station still has one — it goes to the desk. There is no
 * "nowhere": the rule is that a worker is ALWAYS doing something observable at
 * an observable place, because a worker that silently vanishes when we cannot
 * classify it is indistinguishable from a worker that crashed.
 *
 * The icons are drawn in the same visual language as the visual reference
 * (16×16 box, `stroke:currentColor`, `stroke-width:1.4`, round caps) so the
 * badge, the station sigil and the inspector legend look like one set.
 */
export const ACTIONS: Record<ActionKind, ActionSpec> = {
  edit: { station: 'desk', label: 'Write code', pose: 'type', icon: '<path d="M-5 5l1-4 7-7 3 3-7 7z"/>' },
  read: { station: 'shelf', label: 'Read file', pose: 'read', icon: '<path d="M-6-4q3-1 6 1q3-2 6-1v9q-3-1-6 1q-3-2-6-1z"/><path d="M0-3v9"/>' },
  search: { station: 'cab', label: 'Search the tree', pose: 'flip', icon: '<circle cx="-1" cy="-1" r="4"/><path d="M2 2l4 4"/>' },
  look: { station: 'cab', label: 'List files', pose: 'flip', icon: '<path d="M-6-4h12M-6 0h12M-6 4h12"/><path d="M-4-6v12"/>' },
  think: { station: 'wb', label: 'Thinking', pose: 'think', icon: '<circle cx="-4" cy="0" r="1.2"/><circle cx="0" cy="0" r="1.2"/><circle cx="4" cy="0" r="1.2"/>' },
  plan: { station: 'wb', label: 'Planning', pose: 'think', icon: '<path d="M-5-5h10M-5 0h7M-5 5h4"/>' },
  build: { station: 'bench', label: 'Build', pose: 'hammer', icon: '<path d="M-5 5l5-5"/><path d="M-1-5l5 1 1 4-5-1z"/>' },
  test: { station: 'test', label: 'Run tests', pose: 'lab', icon: '<path d="M-2-6h4M-1-6v4l-4 7h10l-4-7v-4"/>' },
  lint: { station: 'test', label: 'Lint & typecheck', pose: 'lab', icon: '<path d="M-5 5l3-3M-2 2l3-3M1-1l3-3M-6 6l-2 2M2-4l-2 2M5-1l2 2"/>' },
  serve: { station: 'door', label: 'Start a server', pose: 'throw', icon: '<circle r="5.5"/><path d="M-5.5 0h11M0-5.5q-4 5.5 0 11q4-5.5 0-11"/>' },
  web: { station: 'door', label: 'Fetch URL', pose: 'throw', icon: '<circle r="5.5"/><path d="M-5.5 0h11M0-5.5q-4 5.5 0 11q4-5.5 0-11"/>' },
  remote: { station: 'door', label: 'Push / deploy', pose: 'throw', icon: '<path d="M-5 4h10M0-5v9M-3-2l3-3 3 3"/>' },
  mcp: { station: 'sw', label: 'MCP tool call', pose: 'phone', icon: '<path d="M-2-6v4M2-6v4M-4-2h8v3a4 4 0 01-8 0zM0 5v2"/>' },
  install: { station: 'bench', label: 'Install deps', pose: 'hammer', icon: '<path d="M-5-5v7a3 3 0 006 0v-7M0-2v7"/><path d="M-5-7h4M1-7h4"/>' },
  container: { station: 'rack', label: 'Container / cluster', pose: 'phone', icon: '<path d="M-6-2h12v6h-12zM-3-5h6v3M-4 1h1M1 1h1"/>' },
  database: { station: 'rack', label: 'Run a migration', pose: 'lab', icon: '<ellipse cy="-3.5" rx="5" ry="2"/><path d="M-5-3.5v7q5 3 10 0v-7"/>' },
  commit: { station: 'vault', label: 'Checkpoint', pose: 'carry', icon: '<rect x="-5" y="-5" width="10" height="10" rx="2"/><circle r="2"/>' },
  branch: { station: 'vault', label: 'Branch', pose: 'carry', icon: '<circle cx="-3" cy="4" r="2"/><circle cx="3" cy="-4" r="2"/><path d="M-3 2v-3a3 3 0 013-3h1"/>' },
  move: { station: 'shelf', label: 'Move a file', pose: 'carry', icon: '<path d="M-5-4h5v8h-5zM0-4h5v8H0zM1-1h3"/>' },
  delete: { station: 'vault', label: 'Delete', pose: 'carry', icon: '<path d="M-5-4h10M-2-4v-2h4v2M-4-4l1 9h6l1-9"/>' },
  delegate: { station: 'sw', label: 'Delegate to a subagent', pose: 'phone', icon: '<circle cy="-3" r="2.5"/><path d="M-5 5a5 5 0 0110 0"/>' },
  run: { station: 'bench', label: 'Run a command', pose: 'hammer', icon: '<path d="M-3-5l6 5-6 5z"/>' },
  command: { station: 'bench', label: 'Shell command', pose: 'hammer', icon: '<path d="M-4-5l-3 5 3 5M4-5l3 5-3 5M0-6l-2 12"/>' },
  blocked: { station: 'bell', label: 'Needs input', pose: 'raise', icon: '<path d="M-4 3q0-9 4-9t4 9zM-1.5 5.5h3"/>' },
  archived: { station: 'vault', label: 'Archive', pose: 'carry', icon: '<path d="M-6-5h12v3h-12zM-5-2h10v7h-10z"/>' },
  unknown: { station: 'desk', label: 'Working', pose: 'idle', icon: '<circle r="5"/><path d="M0-2v3M0 3h.01"/>' },
};

/* ------------------------------------------------------------------ */
/* §8.8 — pathfinding along corridors                                   */
/* ------------------------------------------------------------------ */

/**
 * Corridor coordinates (integration plan §8.8: "corridor rows (gx or gy equal
 * to 1 or 7)").
 *
 * WHY THIS EXISTS: the naive version walks a straight line from a worker to its
 * destination, and workers visibly walk THROUGH the filing cabinet and the
 * server rack. Furniture occupies the two back walls (gy = 0 and gx = 0), so a
 * path that stays inside gx ≥ 1, gy ≥ 1 cannot intersect it — and the cheapest
 * way to guarantee that is to route every multi-tile move through a corridor.
 */
export const CORRIDORS = [1, 7] as const;

/**
 * Free-standing obstacles — furniture that is NOT on a back wall.
 *
 * The wall test alone is not enough, and assuming it was is a bug I shipped
 * first: every stand point in STATIONS sits at gy/gx >= 1, so a wall-only test
 * NEVER fires and the corridor routing below is unreachable dead code. The
 * help bell at (7,3) is genuinely mid-floor, so a worker walking past it clips
 * straight through it. Obstacles are therefore declared, not inferred.
 */
export const OBSTACLES: ReadonlyArray<readonly [number, number, number, number]> = [
  // [gx, gy, width, depth] in tiles
  [7, 3, 1, 1], // help bell
];

/** True when the straight segment (a→b) passes through any furniture. */
export function crossesFurniture(a: readonly [number, number], b: readonly [number, number]): boolean {
  // Wall strips: the two back walls, where every cabinet/bench/rack lives.
  if (segmentEntersRegion(a, b, (x, y) => y < 1 || x < 1)) return true;
  // Free-standing obstacles, tested as rectangles with a small margin so a
  // worker brushing past the corner still detours.
  for (const [gx, gy, w, d] of OBSTACLES) {
    if (segmentEntersRegion(a, b, (x, y) => x > gx - 0.3 && x < gx + w + 0.3 && y > gy - 0.3 && y < gy + d + 0.3)) {
      return true;
    }
  }
  return false;
}

/** Sample the segment (a→b) and report whether any sample satisfies `hit`. */
function segmentEntersRegion(
  a: readonly [number, number],
  b: readonly [number, number],
  hit: (x: number, y: number) => boolean,
): boolean {
  const span = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  // 4 samples per tile is dense enough that a corner clip is always caught.
  const steps = Math.max(2, Math.ceil(span * 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (hit(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return true;
  }
  return false;
}

/** True when this tile is inside any declared obstacle (or the wall strips). */
export function pointInFurniture(x: number, y: number): boolean {
  if (y < 1 || x < 1) return true;
  for (const [gx, gy, w, d] of OBSTACLES) {
    if (x > gx - 0.3 && x < gx + w + 0.3 && y > gy - 0.3 && y < gy + d + 0.3) return true;
  }
  return false;
}

function manhattan(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function pathLength(path: Array<readonly [number, number]>): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += manhattan(path[i - 1], path[i]);
  return total;
}

/** Drop waypoints that duplicate the previous one, so a straight leg is one point. */
function compact(path: Array<readonly [number, number]>): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (const p of path) {
    const prev = out[out.length - 1];
    if (!prev || manhattan(prev, p) > 1e-6) out.push(p);
  }
  return out.length ? out : [path[path.length - 1]];
}

/**
 * Build the tile waypoints a worker walks between two positions.
 *
 * Returns 1 point when the straight line is clear, otherwise 2 — an L-shape
 * routed along a corridor.
 *
 * WHY WE GENERATE CANDIDATES INSTEAD OF PICKING ONE CORRIDOR: my first version
 * chose the corridor whose coordinate was numerically nearest the destination
 * and routed through it. For a worker heading to the help bell at (7,3) from
 * (7.5,5.5) that chose row 7 and put the corner at [7, 3.5] — INSIDE the bell.
 * The detour went through the very object it was avoiding, which looked like the
 * pathfinding was simply broken. Choosing among candidates and rejecting any
 * whose corner is inside furniture is both simpler to reason about and
 * actually correct.
 */
export function walkPath(
  from: readonly [number, number],
  to: readonly [number, number],
): Array<readonly [number, number]> {
  if (!crossesFurniture(from, to)) return [to];

  const candidates: Array<Array<readonly [number, number]>> = [];
  for (const c of CORRIDORS) {
    // vertical corridor: walk along x to it, then along y, then along x
    candidates.push(compact([[c, from[1]], [c, to[1]], to]));
    // horizontal corridor: the mirror image
    candidates.push(compact([[from[0], c], [to[0], c], to]));
  }

  const clear = candidates
    .filter((path) => path.every((p) => !pointInFurniture(p[0], p[1])))
    .filter((path) => !path.slice(0, -1).some((p, i) => crossesFurniture(p, path[i + 1])))
    .sort((a, b) => pathLength(a) - pathLength(b));

  // No clear corridor exists (fully walled in). Go direct rather than freeze —
  // a worker that stands still forever reads as a hang, and clipping one tile
  // is strictly less confusing than never arriving.
  return clear.length ? clear[0] : [to];
}

/** Do two positions resolve to the same tile? Used for the "skip the walk" rule. */
export function sameTile(a: readonly [number, number], b: readonly [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 0.25 && Math.abs(a[1] - b[1]) < 0.25;
}

/* ------------------------------------------------------------------ */
/* §8.3 — real event timing                                             */
/* ------------------------------------------------------------------ */

export const MIN_ACTION_MS = 800;
export const ACTION_QUEUE_MAX = 3;

/** How long a worker holds a given action before returning to its desk. */
export function actionDurationMs(kind: ActionKind): number {
  if (kind === 'blocked') return 6500; // a human prompt is genuinely slow
  if (kind === 'think' || kind === 'plan') return 2600;
  if (kind === 'test' || kind === 'build' || kind === 'lint') return 3200;
  return MIN_ACTION_MS;
}

/* ------------------------------------------------------------------ */
/* §8.6 — autonomy lanyard                                              */
/* ------------------------------------------------------------------ */

/**
 * Lanyard stripe count = autonomy level (1, 2 or 3). Rendered as short bars on
 * the worker's chest. Conductor-only: a plain terminal session has no declared
 * autonomy, and a missing value must render as "no lanyard", never as L1.
 */
export type AutonomyLevel = 1 | 2 | 3 | null;

export function lanyardStripes(level: AutonomyLevel): number {
  return typeof level === 'number' ? level : 0;
}

/* ------------------------------------------------------------------ */
/* the animation machine                                                */
/* ------------------------------------------------------------------ */

export type WorkerPhase = 'idle' | 'go' | 'do' | 'wait' | 'back';
export type WorkerPose = 'type' | 'flip' | 'read' | 'hammer' | 'lab' | 'phone' | 'throw' | 'think' | 'carry' | 'raise' | 'walk' | 'idle';

export interface WorkerAnim {
  sessionId: string;
  /** where it stands now (tiles) */
  x: number;
  y: number;
  /** where it is heading (tiles) */
  tx: number;
  ty: number;
  /** the tile it was born at — its desk */
  hx: number;
  hy: number;
  /** waypoints remaining for the current walk */
  path: Array<readonly [number, number]>;
  phase: WorkerPhase;
  /** the action being performed, if any */
  act: ActionKind | null;
  /** the event that caused it */
  ev: ActionEvent | null;
  /** ms timestamp the current phase began */
  phaseStart: number;
  /** depth key for painter's ordering */
  depth: number;
  /** lifecycle from plan §6 */
  lifecycle: 'booting' | 'idle' | 'action' | 'blocked' | 'error' | 'saved';
  /** autonomy, Conductor only */
  autonomy: AutonomyLevel;
}

export interface FleetAnim {
  workers: Record<string, WorkerAnim>;
  /** station id → the session currently using it. One worker per station. */
  occupancy: Partial<Record<StationId, string>>;
  /** station id → red failure lamp, until this timestamp */
  failedUntil: Partial<Record<StationId, number>>;
  /** station id → use tallies for the station inspector */
  usage: Partial<Record<StationId, { uses: number; ms: number; fails: number; by: Record<string, number>; last: string | null }>>;
}

/** A session's birth position — where its desk is. */
export interface WorkerSpawn {
  sessionId: string;
  /** desk tile; defaults are spread across the middle of the floor */
  hx?: number;
  hy?: number;
  autonomy?: AutonomyLevel;
}

export const EMPTY_FLEET: FleetAnim = { workers: {}, occupancy: {}, failedUntil: {}, usage: {} };

/** Pick a free desk tile for a worker, spreading them so they do not overlap. */
export function defaultDeskTile(index: number): readonly [number, number] {
  const cols = [2, 4, 6, 3, 5, 2, 4, 6, 3, 5, 7, 7];
  const rows = [3, 3, 3, 5, 5, 6, 6, 4, 6, 4, 6, 2];
  return [cols[index % cols.length], rows[index % rows.length]];
}

/** Insert an event into the queue for a worker, applying §8.3's rules. */
export function enqueue(queue: ActionEvent[], ev: ActionEvent): ActionEvent[] {
  const next = [...queue, ev];
  // "queue of 3, drop the oldest" — a burst of 40 edits in 200 ms must not
  // spend 13 seconds animating a backlog the user has already scrolled past.
  if (next.length > ACTION_QUEUE_MAX) return next.slice(next.length - ACTION_QUEUE_MAX);
  return next;
}

export interface AdvanceOptions {
  /** tiles per second */
  speed?: number;
}

/**
 * Advance every worker by `dt` ms and resolve the phase machine.
 * Returns a NEW FleetAnim; the input is not mutated.
 *
 * Reduced motion: the renderer passes `speed: Infinity`, which collapses every
 * walk to zero duration. The phase machine still runs, so the SCENE STATE is
 * identical with motion off — only the interpolation disappears. That is the
 * point of making this pure: the accessible mode is the same code path.
 */
export function advanceFleet(fleet: FleetAnim, dt: number, now: number, opts: AdvanceOptions = {}): FleetAnim {
  const speed = opts.speed ?? 2.4;

  const workers: Record<string, WorkerAnim> = {};
  const occupancy: FleetAnim['occupancy'] = { ...fleet.occupancy };
  const failedUntil = { ...fleet.failedUntil };
  const usage: FleetAnim['usage'] = { ...fleet.usage };

  // Occupancy from the PREVIOUS frame is authoritative for the "is it free"
  // test, so two workers cannot both claim the test bench in one tick.
  const busyNow = new Set(Object.values(fleet.occupancy).filter(Boolean) as string[]);

  for (const [id, w0] of Object.entries(fleet.workers)) {
    let w = w0;
    const maxStep = speed * (dt / 1000);
    let walking = false;

    // -- movement along the current waypoint ----------------------------
    const [wx, wy] = w.path[0] ?? [w.tx, w.ty];
    const dx = wx - w.x;
    const dy = wy - w.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.02 && Number.isFinite(maxStep)) {
      const stepLen = Math.min(dist, maxStep);
      w = { ...w, x: w.x + (dx / dist) * stepLen, y: w.y + (dy / dist) * stepLen };
      walking = true;
    } else {
      const next = w.path.slice(1);
      const arrived = next.length ? next[0] : [wx, wy];
      w = { ...w, x: arrived[0], y: arrived[1], path: next };
    }

    // -- phase transitions ---------------------------------------------
    if (w.phase === 'go' && !walking) {
      w = { ...w, phase: w.act === 'blocked' ? 'wait' : 'do', phaseStart: now };
    } else if ((w.phase === 'do' || w.phase === 'wait') && now - w.phaseStart > (w.act ? actionDurationMs(w.act) : MIN_ACTION_MS)) {
      // release the station and tally it
      if (w.act) {
        const st = ACTIONS[w.act].station;
        if (occupancy[st] === id) delete occupancy[st];
        const prev = usage[st] ?? { uses: 0, ms: 0, fails: 0, by: {}, last: null };
        const failed = w.ev?.exitCode !== undefined && w.ev.exitCode !== 0;
        usage[st] = {
          uses: prev.uses + 1,
          ms: prev.ms + (now - w.phaseStart),
          fails: prev.fails + (failed ? 1 : 0),
          by: { ...prev.by, [id]: (prev.by[id] ?? 0) + 1 },
          last: id,
        };
        // A failed test/build lights a red lamp that survives the worker leaving.
        if (failed && (w.act === 'test' || w.act === 'build' || w.act === 'lint')) {
          failedUntil[st] = now + 3200;
        }
      }
      busyNow.delete(id);
      w = { ...w, phase: 'back', act: null, ev: null, path: [[w.hx, w.hy]] };
    } else if (w.phase === 'back' && !walking) {
      w = { ...w, phase: 'idle', act: null, ev: null };
    }

    // -- state ring ------------------------------------------------------
    const ringState = deriveRing(w);
    const lifecycle =
      w.phase === 'idle' || w.phase === 'back'
        ? (w.lifecycle === 'saved' || w.lifecycle === 'error' || w.lifecycle === 'booting'
            ? w.lifecycle
            : 'idle')
        : ringState === 'blocked'
          ? 'blocked'
          : ringState === 'error'
            ? 'error'
            : 'action';

    workers[id] = { ...w, depth: w.x + w.y, lifecycle };
  }

  return { workers, occupancy, failedUntil, usage };
}

function deriveRing(w: WorkerAnim): 'working' | 'thinking' | 'blocked' | 'error' | 'idle' | 'saved' {
  if (w.lifecycle === 'saved') return 'saved';
  if (w.lifecycle === 'error') return 'error';
  if (w.lifecycle === 'booting') return 'idle';
  if (w.act === 'blocked') return 'blocked';
  if (w.ev && w.ev.exitCode !== undefined && w.ev.exitCode !== 0) return 'error';
  if (w.act === 'think' || w.act === 'plan') return 'thinking';
  return w.phase === 'idle' ? 'idle' : 'working';
}

/**
 * Start an action for a worker. Returns the fleet unchanged when the target
 * station is occupied — a queue for the station is handled by the caller's
 * event feed, which re-delivers later.
 */
export function startAction(fleet: FleetAnim, sessionId: string, ev: ActionEvent, now: number): FleetAnim {
  const w = fleet.workers[sessionId];
  if (!w || w.phase !== 'idle') return fleet;

  const spec = ACTIONS[ev.kind];
  const st = spec.station;

  if (st !== 'desk' && fleet.occupancy[st] && fleet.occupancy[st] !== sessionId) {
    return fleet; // busy — the feed will retry
  }

  const stand = STATION_BY_ID[st]?.stand ?? [w.hx, w.hy];
  const occupancy = { ...fleet.occupancy };
  if (st !== 'desk') occupancy[st] = sessionId;

  const path = walkPath([w.x, w.y], stand as readonly [number, number]);

  return {
    ...fleet,
    occupancy,
    workers: {
      ...fleet.workers,
      [sessionId]: {
        ...w,
        tx: stand[0],
        ty: stand[1],
        path: path.length ? [...path] : [stand],
        phase: 'go',
        act: ev.kind,
        ev,
        phaseStart: now,
        // Set lifecycle HERE, not only inside advanceFleet. Two writers to one
        // field with different timing means the value is briefly inconsistent
        // between the action that starts and the tick that follows it, and any
        // consumer that reads between those two points sees a worker walking
        // with a stale idle ring.
        lifecycle:
          ev.kind === 'blocked'
            ? 'blocked'
            : ev.exitCode !== undefined && ev.exitCode !== 0
              ? 'error'
              : 'action',
      },
    },
  };
}

/** Register a worker at its desk. Idempotent — re-registering does not reset it. */
export function ensureWorker(fleet: FleetAnim, spawn: WorkerSpawn, index: number): FleetAnim {
  if (fleet.workers[spawn.sessionId]) return fleet;
  const [hx, hy] = spawn.hx !== undefined && spawn.hy !== undefined
    ? [spawn.hx, spawn.hy]
    : defaultDeskTile(index);
  return {
    ...fleet,
    workers: {
      ...fleet.workers,
      [spawn.sessionId]: {
        sessionId: spawn.sessionId,
        x: hx, y: hy, tx: hx, ty: hy, hx, hy,
        path: [],
        phase: 'idle',
        act: null,
        ev: null,
        phaseStart: 0,
        depth: hx + hy,
        lifecycle: 'booting',
        autonomy: spawn.autonomy ?? null,
      },
    },
  };
}

/** §6: terminal closed, session saved → dim ghost at its desk. */
export function markSaved(fleet: FleetAnim, sessionId: string): FleetAnim {
  const w = fleet.workers[sessionId];
  if (!w) return fleet;
  const occupancy = { ...fleet.occupancy };
  for (const k of Object.keys(occupancy) as StationId[]) {
    if (occupancy[k] === sessionId) delete occupancy[k];
  }
  return {
    ...fleet,
    occupancy,
    workers: {
      ...fleet.workers,
      [sessionId]: { ...w, phase: 'idle', act: null, ev: null, lifecycle: 'saved', path: [], x: w.hx, y: w.hy },
    },
  };
}

/** §6: `agent:timeout` → error ring, "failed to start" in the inspector. */
export function markError(fleet: FleetAnim, sessionId: string): FleetAnim {
  const w = fleet.workers[sessionId];
  if (!w) return fleet;
  return { ...fleet, workers: { ...fleet.workers, [sessionId]: { ...w, lifecycle: 'error' } } };
}

/** §6: `agent:ready` received → idle. */
export function markReady(fleet: FleetAnim, sessionId: string): FleetAnim {
  const w = fleet.workers[sessionId];
  if (!w) return fleet;
  if (w.lifecycle === 'error') return fleet; // an errored session is not rescued by a late ready
  return { ...fleet, workers: { ...fleet.workers, [sessionId]: { ...w, lifecycle: 'idle' } } };
}

export function removeWorker(fleet: FleetAnim, sessionId: string): FleetAnim {
  if (!fleet.workers[sessionId]) return fleet;
  const workers = { ...fleet.workers };
  delete workers[sessionId];
  const occupancy = { ...fleet.occupancy };
  for (const k of Object.keys(occupancy) as StationId[]) {
    if (occupancy[k] === sessionId) delete occupancy[k];
  }
  return { ...fleet, workers, occupancy };
}

/* ------------------------------------------------------------------ */
/* §8.9 — draw order                                                    */
/* ------------------------------------------------------------------ */

export interface DepthItem<T> {
  depth: number;
  value: T;
}

/**
 * Painter's-algorithm sort. Call this ONCE per frame over a small array — the
 * reference re-sorted every node every frame, which is fine at 6 workers and a
 * waste at 14. We sort by a QUANTISED depth bucket so an unchanged worker does
 * not reorder when it merely bobs, and the caller can skip the sort entirely
 * on frames where nothing crossed a tile.
 */
export function sortByDepth<T>(items: Array<DepthItem<T>>): Array<DepthItem<T>> {
  return items.slice().sort((a, b) => a.depth - b.depth);
}

/** Quantised tile index — changes only when a worker crosses a tile boundary. */
export function depthBucket(gx: number, gy: number): number {
  return Math.floor(gx) + Math.floor(gy);
}
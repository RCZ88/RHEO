/**
 * workforceLayout.ts — workstation geometry + deterministic seat assignment.
 *
 * Positions are percentages of the stage box so the scene is responsive.
 *
 * Capacity tiers (spec: "dense but organized", workers never overlap):
 *   roomy  ≤7 workers  — 3 back homes + 2 front homes + 2 benches, full labels
 *   dense  8–12        — 3×4 staggered grid, short labels (OC·3)
 *   swarm  13–20       — 4×5 staggered grid, tiny scale, short labels
 *
 * Seats are stable: a worker keeps its seat while the tier stays the same.
 * Tier changes (crossing 8 / 13 workers, with hysteresis) re-seat everyone
 * in one visible, deliberate move — then the floor is stable again.
 */

export interface Station {
  /** horizontal center, % of stage width */
  x: number;
  /** floor line (bottom of the worker unit), % of stage height */
  y: number;
  /** stacking order; front rows paint over back rows */
  z: number;
  /** optional per-station depth scale (roomy tier back row sits smaller) */
  s?: number;
}

export type TierId = 'roomy' | 'dense' | 'swarm';

export interface Tier {
  id: TierId;
  seats: Station[];
  /** figure scale for this tier */
  scale: number;
  /** label rendering: full name / short tag / none */
  labelMode: 'full' | 'short';
  /** floor line heights, % of stage height */
  rows: number[];
}

/* ------------------------------------------------------------------ roomy */

const ROOMY_SEATS: Station[] = [
  { x: 17, y: 54, z: 1, s: 0.88 }, // 0 — back left   (gemini home)
  { x: 50, y: 51, z: 1, s: 0.92 }, // 1 — back center (opencode home, focal)
  { x: 83, y: 54, z: 1, s: 0.88 }, // 2 — back right  (aider home)
  { x: 31, y: 97, z: 3, s: 1 },    // 3 — front left  (claude home)
  { x: 69, y: 97, z: 3, s: 1 },    // 4 — front right (codex home)
  { x: 7,  y: 97, z: 2, s: 0.8 },  // 5 — bench left  (overflow)
  { x: 93, y: 97, z: 2, s: 0.8 },  // 6 — bench right (overflow)
];

/** home workstation per agent type in roomy tier (-1 = no home) */
export const ROOMY_HOMES: Record<string, number> = {
  gemini: 0,
  opencode: 1,
  aider: 2,
  claude: 3,
  codex: 4,
};

/* ------------------------------------------------------------------ dense */

function grid(rowsY: number[], colsX: number[], stagger: number): Station[] {
  const out: Station[] = [];
  rowsY.forEach((y, r) => {
    for (const x of colsX) {
      const shift = r % 2 === 1 ? stagger : 0;
      out.push({ x: Math.min(96, x + shift), y, z: r + 1 });
    }
  });
  return out;
}

const DENSE_SEATS = grid([38, 68, 97], [12, 37, 62, 87], 12);
const SWARM_SEATS = grid([26, 50, 74, 97], [10, 30, 50, 70, 90], 10);

export const TIERS: Record<TierId, Tier> = {
  roomy: {
    id: 'roomy',
    seats: ROOMY_SEATS,
    scale: 1,
    labelMode: 'full',
    rows: [52, 97],
  },
  dense: {
    id: 'dense',
    seats: DENSE_SEATS,
    scale: 0.66,
    labelMode: 'short',
    rows: [38, 68, 97],
  },
  swarm: {
    id: 'swarm',
    seats: SWARM_SEATS,
    scale: 0.5,
    labelMode: 'short',
    rows: [26, 50, 74, 97],
  },
};

/** tier choice with hysteresis so the floor never bounces around a boundary */
export function tierForCount(n: number, prev: TierId): TierId {
  switch (prev) {
    case 'roomy':
      return n >= 8 ? 'dense' : 'roomy';
    case 'dense':
      if (n >= 13) return 'swarm';
      if (n <= 5) return 'roomy';
      return 'dense';
    case 'swarm':
      return n <= 9 ? 'dense' : 'swarm';
    default:
      return 'roomy';
  }
}

/** Where a worker materializes before walking to its desk (% of stage). */
export const SPAWN_POINT = { x: 50, y: 122 };

/** Preferred overflow order in roomy tier: benches first, then free homes. */
const ROOMY_OVERFLOW = [5, 6, 0, 1, 2, 3, 4];

/**
 * Seat bookkeeping kept in a ref for the lifetime of the mount.
 * Deterministic: same session set in same order → same seats.
 */
export class StationAllocator {
  private seats = new Map<string, number>();
  private seen = new Map<string, number>();
  private seenCounter = 0;

  /**
   * Reconcile against the current session list.
   * @param sessions in list order, with optional roomy home seat
   * @param tier active layout tier
   * @returns session → station index (-1 = no seat left, shown as +N)
   */
  assign(
    sessions: Array<{ sessionId: string; home: number }>,
    tier: Tier,
  ): Map<string, number> {
    const present = new Set(sessions.map((s) => s.sessionId));
    for (const id of Array.from(this.seats.keys())) {
      if (!present.has(id)) this.seats.delete(id);
    }
    for (const id of Array.from(this.seen.keys())) {
      if (!present.has(id)) this.seen.delete(id);
    }
    for (const s of sessions) {
      if (!this.seen.has(s.sessionId)) {
        this.seen.set(s.sessionId, this.seenCounter++);
      }
    }

    const seatCount = tier.seats.length;
    const taken = new Set<number>();

    // 1 — keep existing seats when still valid in this tier
    for (const s of sessions) {
      const cur = this.seats.get(s.sessionId);
      if (cur !== undefined && cur >= 0 && cur < seatCount && !taken.has(cur)) {
        taken.add(cur);
      } else {
        this.seats.delete(s.sessionId);
      }
    }

    // 2 — seat the unseated: previous-seat order → arrival order (stable, minimal churn)
    const unseated = sessions
      .filter((s) => !this.seats.has(s.sessionId))
      .sort((a, b) => {
        const pa = this.seats.get(a.sessionId) ?? 999;
        const pb = this.seats.get(b.sessionId) ?? 999;
        if (pa !== pb) return pa - pb;
        return (this.seen.get(a.sessionId) ?? 0) - (this.seen.get(b.sessionId) ?? 0);
      });

    const freeIn = (order: number[]) => order.find((i) => !taken.has(i));

    for (const s of unseated) {
      let seat: number | undefined;
      if (tier.id === 'roomy') {
        if (s.home >= 0 && !taken.has(s.home)) seat = s.home;
        else seat = freeIn(ROOMY_OVERFLOW);
      } else {
        // grids fill row by row, left to right — reads like an office floor
        seat = freeIn(tier.seats.map((_, i) => i));
      }
      if (seat === undefined) {
        this.seats.set(s.sessionId, -1);
      } else {
        this.seats.set(s.sessionId, seat);
        taken.add(seat);
      }
    }

    return new Map(this.seats);
  }
}

/** Scene frame heights per density (px). Default stays compact — the terminal is the point. */
export const SCENE_HEIGHT: Record<'compact' | 'normal' | 'expanded', number> = {
  compact: 182,
  normal: 236,
  expanded: 300,
};

/** Global figure scale per density. */
export const DENSITY_SCALE: Record<'compact' | 'normal' | 'expanded', number> = {
  compact: 1,
  normal: 1.16,
  expanded: 1.34,
};

export type SceneDensity = keyof typeof SCENE_HEIGHT;

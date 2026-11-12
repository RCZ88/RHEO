/**
 * RHEO landing — corrected Vault/Layers driver (reference implementation).
 * Validated 2026-11-12 against the live figure at rheooo.netlify.app
 * (hairline@0.5.1): fresh-mount laps x3 opened at +212 / +244 ms after the
 * final pointerup; adaptive re-open from the open state (a0=40) verified;
 * layers sweep verified (gap +34 user units).
 *
 * WHY THE REWRITE (all measured):
 *  1. The old code dispatched PointerEvents on the panel container
 *     (`o.current`), but hairline's pointer() listeners live on the
 *     descendant [data-hairline] stage. Parent-targeted events never enter a
 *     child's propagation path: 0 mutations reached the figure. The deployed
 *     tour/tabs animate only crossfades + captions.
 *  2. The old orbit (center (200,162), R 12->25) does not enclose the true
 *     dial center (178.79, 180.56) — distance 28.2 > 25, winding 0 — the dial
 *     wobbles and coasts to detent 00. It never opens.
 *  3. The open condition (dist :5577-5579) is |wrap(a-40)| < 0.8 AND
 *     |w| < 6 — a fast crossing never fires. The dial must SETTLE on 40.
 *  4. WMAX2 = 150 dial-units/s caps travel at ~96 units per 640 ms; a
 *     full-turn catch (+110 from rest 30) needs >= 1.1 s.
 */

export type Pt = [number, number];

/** hairline's stage element for a figure mode, inside the panel. */
export function stageOf(panel: HTMLElement, mode: "vault" | "exploded"): HTMLElement | null {
  return panel.querySelector(`[data-hairline="${mode}"]`);
}

/** Dispatch one synthetic pointer event on the stage (hm semantics). */
export function dispatchPointer(
  stage: HTMLElement, type: "pointerdown" | "pointermove" | "pointerup" | "pointerleave", x: number, y: number,
): void {
  const r = stage.getBoundingClientRect();          // per event, like hm()
  const k = r.width / 400;                          // svg is inset:0 100% of the stage
  stage.dispatchEvent(new PointerEvent(type, {
    clientX: r.left + x * k, clientY: r.top + y * k,
    bubbles: true, cancelable: true,
    pointerId: 1, isPrimary: true, pointerType: "mouse",
    buttons: type === "pointerup" || type === "pointerleave" ? 0 : 1,
  }));
}

/* ------------------------------------------------------------------ */
/* Dial lap — measured constants (hairline@0.5.1, vault mount33)       */
/* ------------------------------------------------------------------ */

const DIAL_CENTER: Pt = [178.79, 180.56]; // tick-ring centroid, stage units
const R_MIN = 12, R_MAX = 30;             // grab radius -> orbit (gain ~0.9 at 30)
const DEG_PER_UNIT = 4.68;                // pointer degrees per dial unit (measured)
const UNITS_PER_STEP = 1.93;              // dial travel per 20ms step (clamp-limited, measured)
const OPEN_DETENT = 40;

/** velocity shape as a fraction of mean: accel .12 / hold .46 / decel .26 / creep .16 */
function vShape(t: number): number {
  if (t < 0.12) { const u = t / 0.12; return 0.5 * (1 - Math.cos(Math.PI * u)); }
  if (t < 0.58) return 1;
  if (t < 0.84) { const u = (t - 0.58) / 0.26; return 1 + (0.03 - 1) * 0.5 * (1 - Math.cos(Math.PI * u)); }
  return 0.03; // creep: ~3% of mean -> dial w converges under 6 units/s
}

/** normalized position p(t) in [0,1] (trapezoid integral, numerically normalized) */
function posAt(t: number): number {
  const M = 200, f = (x: number) => {
    let s = 0;
    for (let j = 0; j < M; j++) s += 0.5 * (vShape((x * j) / M) + vShape((x * (j + 1)) / M)) / M;
    return s * x;
  };
  return f(t) / f(1);
}

const orbit = (deg: number, rad: number): Pt => {
  const th = (deg * Math.PI) / 180;
  return [DIAL_CENTER[0] + rad * Math.cos(th), DIAL_CENTER[1] + rad * Math.sin(th)];
};

/**
 * Probe the dial's resting position: hover at the grab point (last2 === null
 * after a leave, so this moves nothing), wait two rAF (the read updates on
 * hairline's board tick), parse "dial NN" from the onRead stream.
 */
export async function probeDial(
  stage: HTMLElement, readRef: { current: string }, isPrm: boolean,
): Promise<number> {
  dispatchPointer(stage, "pointermove", ...orbit(180, R_MIN));
  if (!isPrm) await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  else await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const m = /dial (\d+)/.exec(readRef.current);
  return m ? parseInt(m[1], 10) : 30; // fresh mounts rest at REST16 = 30
}

/**
 * The dial lap. Adaptive full turn that creeps into detent 40 and lets the
 * settle spring snap the catch: setOpen fires ~+212..244ms after the last
 * pointer event (measured), bolts complete <= 800ms (stagger |i-from|*50 + 700ms tween).
 */
export async function dialLap(
  stage: HTMLElement, readRef: { current: string }, isPrm: boolean,
): Promise<void> {
  // normalize: if the user left the dial coasting, let it rest first
  dispatchPointer(stage, "pointerleave", ...orbit(180, R_MIN));
  const restDeadline = performance.now() + 2500;
  while (/dial/.test(readRef.current) && performance.now() < restDeadline) {
    await new Promise<void>((r) => setTimeout(r, 60));
  }
  const a0 = await probeDial(stage, readRef, isPrm);

  let delta = (OPEN_DETENT - a0 + 100) % 100; // dial units to travel
  if (delta < 60) delta += 100;               // guarantee a full-turn gesture
  const N = Math.max(31, Math.round(delta / UNITS_PER_STEP));
  const T = N * 20;                            // ms
  const theta = DEG_PER_UNIT * delta;          // pointer degrees, CW from 180deg
  const point = (i: number, t: number): Pt => {
    const rad = R_MIN + (R_MAX - R_MIN) * Math.min(1, i / 3); // grab, then orbit
    return orbit(180 + theta * posAt(t), rad);
  };

  if (isPrm) {
    // reduced motion: synchronous dispatch; the move handler snaps per move
    for (let i = 0; i <= N; i++) {
      const [x, y] = point(i, i / N);
      dispatchPointer(stage, i === 0 ? "pointerdown" : i === N ? "pointerup" : "pointermove", x, y);
    }
    dispatchPointer(stage, "pointerleave", ...point(N, 1));
    return;
  }

  const t0 = performance.now();
  let i = 0;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (i > N) { clearInterval(iv); resolve(); return; }
      // wall-clock t: interval jitter self-corrects
      const t = Math.min(1, (performance.now() - t0) / T);
      const [x, y] = point(i, t);
      dispatchPointer(stage, i === 0 ? "pointerdown" : i === N ? "pointerup" : "pointermove", x, y);
      i++;
    }, 20);
  });
  dispatchPointer(stage, "pointerleave", ...point(N, 1));
}

/**
 * Layers sweep — the deployed geometry is correct, only the target was wrong.
 * Validated: gap opens +34 user units (stack bbox 113.3 -> 147.3).
 */
export async function layersSweep(stage: HTMLElement, reverse: boolean, isPrm: boolean): Promise<void> {
  const N = reverse ? 24 : 32;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const x = reverse ? 360 - (320 * i) / N : 40 + (320 * i) / N;
    pts.push([x, 162]);
  }
  if (isPrm) {
    for (let i = 0; i <= N; i++) {
      dispatchPointer(stage, i === 0 ? "pointerdown" : i === N ? "pointerup" : "pointermove", pts[i][0], pts[i][1]);
    }
    dispatchPointer(stage, "pointerleave", 400, 162);
    return;
  }
  let i = 0;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (i > N) { clearInterval(iv); resolve(); return; }
      dispatchPointer(stage, i === 0 ? "pointerdown" : i === N ? "pointerup" : "pointermove", pts[i][0], pts[i][1]);
      i++;
    }, 20);
  });
  dispatchPointer(stage, "pointerleave", 400, 162);
}

/**
 * Q4 dev assert — the ONLY open signature: setOpen(true) -> light() toggles
 * class "hi" on the three moving-bolt silhouettes.
 *   open                -> stage.querySelectorAll('path.sil.hi').length === 3
 *   closed + hover      -> 1 (dial silhouette)
 *   closed + idle       -> 0 sil + 1 path.nf.hi (the 40 tick)
 * The onRead string ("dial 40 - open") is NOT stable at rest ("rest") — never assert on it.
 */
export function assertVaultOpens(stage: HTMLElement, msAfterLapEnd = 600): void {
  if (process.env.NODE_ENV === "production") return;
  setTimeout(() => {
    const n = stage.querySelectorAll("path.sil.hi").length;
    if (n !== 3) {
      // eslint-disable-next-line no-console
      console.error(`[hairline] vault did not open within ${msAfterLapEnd}ms of lap end (path.sil.hi = ${n}, expected 3)`);
    }
  }, msAfterLapEnd);
}

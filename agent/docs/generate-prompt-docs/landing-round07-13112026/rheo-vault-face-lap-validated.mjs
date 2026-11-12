// VALIDATED on the live deployed site (https://rheooo.netlify.app, 2026-11-13, probe CDP session).
// This lap opened the vault deterministically: read line "dial 41 · open" at +150ms,
// settles "dial 40 · open", path.sil.hi ×3 stable for 2.4s. Replace the rev-2 driver
// (dispatchPointer/figureStage/lap constants/dialLap) with this construction.
//
// WHY THE SHIPPED LAP FAILS (all measured against @lucasmarkes/hairline@0.5.1 dist):
//  1. DEG_PER_UNIT is 3.6, not 4.68. The dial converts pointer arc at
//     da = -(Δang)/3.6 * clamp(r/22, 0, 1) — face units. 4.68 overshoots ~29%.
//     Shipped lap: Δ=110 → 515° → ~143 real units + coast → detent 70/90. Never 40.
//  2. The orbit must be built in FACE space, not stage space. A stage-space circle
//     around the dial center maps to a face ELLIPSE (measured r 19.6–37.8, gear
//     varies 0.89–1.0). A face-space circle roundtrips exactly (measured 25.000..25.000).
//  3. The dial is VELOCITY-driven: spin.w = clamp(lerp(w, da/dt, .35), ±150), then it
//     COASTS after pointerup (exp decay, τ up to ~1.5s) and settles on the NEAREST
//     DETENT. A fast sweep + coast overshoots tens of units. Fix: ease-out so the
//     dial arrives at raw 41 with w≈0; the settle spring pulls it to 40 and the open
//     gate (|a−40|<0.8 && |w|<6) fires. Measured: open at +150ms.
//  4. hairline's board tick is gated by an IntersectionObserver. OFF-SCREEN = no
//     integration at all: dispatches set spin.w but nothing moves until the figure
//     scrolls into view, then the deferred w coasts the dial to a random detent
//     (measured: dial drifted 30→77→90 after a delayed scroll). The driver MUST
//     scrollIntoView (or wait for visibility) before any lap dispatch.
//  5. The read line ("dial NN") only flows when the stage is visible (same tick gate).
//     probeDial's a0 read is correct ONLY on-screen. Off-screen it silently falls
//     back to 30 — which is why the shipped lap calibrated against a lie.
//  Verified env details: stage rect k = rect.width/400 (x) and rect.height/320 (y);
//  vault svg viewBox "0 0 400 320"; pointer listeners sit ON [data-hairline="vault"];
//  no isTrusted gate (synthetic PointerEvents drive everything, bubbles:true).

// ── constants (hairline@0.5.1, verbatim from dist/index.js) ──
const rad = (d) => (d * Math.PI) / 180;

// ── replicate mount33's projection EXACTLY ──
function makeFaceMap() {
  const C = { az: rad(45), k: 0.5, S: 1.5, ox: 0, oy: 0 }; // Cam(45, 0.5, 1.5)
  const proj = (x, y, z) => {
    const c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - C.k * C.k);
    const X = x * c - y * s, Y = x * s + y * c;
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)];
  };
  // fit(C, [...], 200, 166) — verbatim fit points (WX0=-70, WX1=70, WZ1=130, WT2=14, KD=10)
  const pts = [[-70,-14,0],[70,-14,0],[-70,-14,130],[70,-14,130],[-70,10,0],[70,0,0],[-70,0,130],[70,0,130]];
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (const p of pts) { const q = proj(p[0], p[1], p[2]); a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }
  C.ox = 200 - (a + b) / 2; C.oy = 166 - (c + d) / 2;
  // onFace affine basis (p0 = P(0,DP,0), DP=14, ZC3=64) — face origin = dial center
  const p0 = proj(0, 14, 0), px = proj(1, 14, 0), pz = proj(0, 14, 1);
  const A = [px[0] - p0[0], px[1] - p0[1]], B = [pz[0] - p0[0], pz[1] - p0[1]];
  // face (u,v) → stage (svg viewBox units, 400×320)
  const toStage = (u, v) => [p0[0] + u * A[0] + (v + 64) * B[0], p0[1] + u * A[1] + (v + 64) * B[1]];
  return { toStage };
}

/**
 * The corrected lap. rf=25 face radius → clamp(25/22,0,1)=1 → gear exactly 1 →
 * dial units = pointer sweep° / 3.6. Cubic ease-out ends at w≈0 → dial rests at
 * raw 41 → settle spring → 40 → OPEN. Sweep direction: dial INCREASES as the
 * pointer angle DECREASES (da is negative-of-delta) → phi runs downward.
 */
export async function faceLap(vStage, readRef, opts = {}) {
  const { toStage } = makeFaceMap();
  const RF = 25, STEP_MS = 25, N = 50;
  const rect = () => vStage.getBoundingClientRect();
  const KX = () => rect().width / 400, KY = () => rect().height / 320;
  const dispatch = (type, sx, sy) => {
    const r = rect();
    vStage.dispatchEvent(new PointerEvent(type, {
      clientX: r.left + sx * KX(), clientY: r.top + sy * KY(),
      bubbles: true, cancelable: true, pointerId: 1, isPrimary: true,
      pointerType: "mouse", buttons: type === "pointerup" || type === "pointerleave" ? 0 : 1,
    }));
  };
  const readDial = () => {
    const m = /dial (\d+)/.exec(readRef.current);
    return m ? parseInt(m[1], 10) : null;
  };

  // VISIBILITY GUARD — hairline's tick is IO-gated; never dispatch off-screen.
  const vr = vStage.getBoundingClientRect();
  if (vr.bottom < 0 || vr.top > window.innerHeight) {
    vStage.scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 400));
  }

  // normalize + read a0 (hover keeps over=true → read shows "dial NN")
  const phi0 = 90;
  const [gx, gy] = toStage(RF * Math.cos(rad(phi0)), RF * Math.sin(rad(phi0)));
  dispatch("pointerleave", gx, gy);
  await new Promise((r) => setTimeout(r, 250));
  dispatch("pointermove", gx, gy);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await new Promise((r) => setTimeout(r, 150));
  const a0 = readDial();
  if (a0 === null) return { ok: false, reason: "a0 unreadable (stage not ticking?)" };

  const delta = (40 - a0 + 100) % 100;          // dial units to travel
  const sweepDeg = delta * 3.6 + 3.6;           // +1 unit so settle snaps ONto 40
  const phiEnd = phi0 - sweepDeg;               // dial increases as phi decreases
  dispatch("pointerdown", gx, gy);
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const ease = 1 - Math.pow(1 - t, 3);        // cubic ease-out → w≈0 at the end
    const phi = phi0 - sweepDeg * ease;
    const [sx, sy] = toStage(RF * Math.cos(rad(phi)), RF * Math.sin(rad(phi)));
    dispatch(i === N ? "pointerup" : "pointermove", sx, sy);
    await new Promise((r) => setTimeout(r, STEP_MS));
  }
  // open fires during settle: |a−40|<0.8 && |w|<6 → bolts draw (sil.hi ×3)
  return { ok: true, a0, delta, sweepDeg, phiEnd };
}

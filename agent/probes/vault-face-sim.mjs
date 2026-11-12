// Vault face-map simulation — ground truth from @lucasmarkes/hairline@0.5.1 dist.
// Replicates mount33's projection exactly and tests the shipped rev-2 lap
// orbit against the REAL dial drag math:
//   move: r=hypot(onFace(p)); if (r > R8+GAP3+KL+10=71) -> leave() (grab broken)
//   da = -(dAng)/3.6 * clamp(r/22,0,1)   [dial units]
//   spin.w = clamp(lerp(w, da/dt, .35), -150, 150); mode="coast"
//   coast: w *= exp(-h*1e3/coast) - 40*sin(a/10*2pi)*h ; settle -> nearest detent
// open: |wrap(a-40)| < 0.8 && |w| < 6
import { execSync } from "node:child_process";

const D = "landing/node_modules/@lucasmarkes/hairline/dist/index.js";
const src = execSync(`node -e "console.log(require('fs').readFileSync('${D}','utf8'))"`, { encoding: "utf8" });

// ---- pulled verbatim from dist/index.js ----
const rad = (d) => (d * Math.PI) / 180;
const wrap = (a) => ((a % 360) + 540) % 360 - 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

var Cam = (azDeg, k, S9) => ({ az: rad(azDeg), k, S: S9, ox: 0, oy: 0 });
function proj(C) {
  const c = Math.cos(C.az), s = Math.sin(C.az), zf = Math.sqrt(1 - C.k * C.k);
  return (x, y, z) => {
    const X = x * c - y * s, Y = x * s + y * c;
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * zf)];
  };
}
function fit(C, pts, cx, cy) {
  C.ox = 0; C.oy = 0;
  const P = proj(C);
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (const p of pts) { const q = P(p[0], p[1], p[2]); a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }
  C.ox = cx - (a + b) / 2; C.oy = cy - (c + d) / 2;
}

// vault constants (dist/index.js, mount33 scope)
const R8 = 40, DP = 14, ZC3 = 64, GAP3 = 10, KL = 11, COMBO = 40, REST16 = 30, WMAX2 = 150;
const WX0 = -70, WX1 = 70, WZ1 = 130, WT2 = 14;

const C = Cam(45, 0.5, 1.5);
fit(C, [[WX0, -WT2, 0], [WX1, -WT2, 0], [WX0, -WT2, WZ1], [WX1, -WT2, WZ1],
        [WX0, KD(), 0], [WX1, 0, 0], [WX0, 0, WZ1], [WX1, 0, WZ1]], 200, 166);
function KD() { return 10; } // KD = 10

const P = proj(C);
const p0 = P(0, DP, 0), px = P(1, DP, 0), pz = P(0, DP, 1);
const ax2 = [px[0] - p0[0], px[1] - p0[1]], az2 = [pz[0] - p0[0], pz[1] - p0[1]];
const det = ax2[0] * az2[1] - ax2[1] * az2[0];
function onFace([sx, sy]) {
  const qx = sx - p0[0], qy = sy - p0[1];
  return [(qx * az2[1] - qy * az2[0]) / det, (ax2[0] * qy - ax2[1] * qx) / det - ZC3];
}
// face -> stage (inverse of onFace): s = p0 + u*A + (v + ZC3)*B
function toStage(u, v) {
  return [p0[0] + u * ax2[0] + (v + ZC3) * az2[0], p0[1] + u * ax2[1] + (v + ZC3) * az2[1]];
}

console.log("p0 (dial center, stage units):", p0.map(n => +n.toFixed(2)), " driver claims [178.79, 180.56]");

// ---- 1. face radius along the SHIPPED orbit (stage circle r=30 around p0) ----
const SHIPPED_C = [178.79, 180.56], SHIPPED_R = 30;
let rMin = 1e9, rMax = -1e9, rOver71 = 0;
for (let i = 0; i <= 360; i += 1) {
  const th = rad(i);
  const s = [SHIPPED_C[0] + SHIPPED_R * Math.cos(th), SHIPPED_C[1] + SHIPPED_R * Math.sin(th)];
  const r = Math.hypot(...onFace(s));
  rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
  if (r > R8 + GAP3 + KL + 10) rOver71++;
}
console.log(`shipped stage-orbit face radius: min ${rMin.toFixed(1)} max ${rMax.toFixed(1)} | cutoff 71 | points over cutoff: ${rOver71}/361`);

// ---- 2. geometric dial travel of the shipped lap (57 steps, theta=515deg, vShape timing) ----
function vShape(t) {
  if (t < 0.12) return 0.5 * (1 - Math.cos(Math.PI * (t / 0.12)));
  if (t < 0.58) return 1;
  if (t < 0.84) return 1 + (0.03 - 1) * 0.5 * (1 - Math.cos(Math.PI * ((t - 0.58) / 0.26)));
  return 0.03;
}
function posAt(t) {
  const M = 200; const f = (x) => { let s = 0; for (let j = 0; j < M; j++) s += 0.5 * (vShape((x * j) / M) + vShape((x * (j + 1)) / M)) / M; return s * x; };
  return f(t) / f(1);
}
function shipLapStage(a0 = 30, delta = 110, N = 57) {
  const theta = 4.68 * delta;
  const orbit = (deg, r) => [SHIPPED_C[0] + r * Math.cos(rad(deg)), SHIPPED_C[1] + r * Math.sin(rad(deg))];
  let angPrev = 180, dial = a0, gearSum = 0;
  const per = [];
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const deg = 180 + theta * posAt(t);
    const [sx, sy] = orbit(deg, SHIPPED_R);
    const [u, v] = onFace([sx, sy]);
    const r = Math.hypot(u, v);
    const ang = Math.atan2(v, u) * 180 / Math.PI;
    const da = -((ang - angPrev + 540) % 360 - 180) / 3.6 * clamp(r / 22, 0, 1);
    dial += da; gearSum += clamp(r / 22, 0, 1); angPrev = ang;
    if (i <= 3 || i === N) per.push({ i, r: +r.toFixed(1), gear: +clamp(r / 22, 0, 1).toFixed(2), da: +da.toFixed(2) });
  }
  const land = ((dial % 100) + 100) % 100;
  console.log(`shipped lap: dial 30 + ${dial.toFixed(1)}u -> raw land ${(land).toFixed(1)} -> settles detent ${Math.round(land / 10) * 10 % 100} (needs 40) | mean gear ${(gearSum / N).toFixed(2)}`);
  return per;
}
shipLapStage();

// ---- 3. corrected orbit: FACE-space circle mapped to stage ----
for (const rf of [22, 25, 30]) {
  // full-turn face sweep: dial travel per pointer degree at gear min(rf/22,1)
  const gear = clamp(rf / 22, 0, 1);
  const degPerUnit = 3.6 / gear; // pointer degrees per dial unit
  const need = 110 * degPerUnit; // sweep for 110 units
  console.log(`face orbit r=${rf}: gear ${gear.toFixed(2)}, ${degPerUnit.toFixed(2)} deg/unit, 110u needs ${need.toFixed(0)}deg pointer sweep`);
  // face-circle stage footprint: is it inside cutoff 71? (constant r by construction)
  const st = toStage(rf, 0);
  console.log(`   face r=${rf} stage point (phi=0): [${st.map(n => n.toFixed(1))}]`);
}
// face radius extremes of a face circle mapped to stage then BACK (sanity: exact)
const rf0 = 25;
let backMin = 1e9, backMax = -1e9;
for (let i = 0; i < 360; i++) {
  const [sx, sy] = toStage(rf0 * Math.cos(rad(i)), rf0 * Math.sin(rad(i)));
  const r = Math.hypot(...onFace([sx, sy]));
  backMin = Math.min(backMin, r); backMax = Math.max(backMax, r);
}
console.log(`face r=${rf0} roundtrip: ${backMin.toFixed(3)}..${backMax.toFixed(3)} (must equal 25)`);

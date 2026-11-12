# CONTEXT BUNDLE — Round 07

## Files

| File | Role |
|---|---|
| `landing/src/components/rheo/Download.tsx` | All figure code. The rev-2 primitives block (~L433–L660: `dispatchPointer`, `figureStage`, sweep helpers, lap constants `DIAL_CENTER/R_MIN/R_MAX/DEG_PER_UNIT/UNITS_PER_STEP/OPEN_DETENT/STEP_MS`, `vShape`/`posAt`, `probeDial`, `dialLap`, `assertVaultOpens`), `runNarrative` (~L705–L746), tour button (~L874), sync-crossfade grid (~L808–L856), read line (~L937–L949: `narr ?? readout ?? defaultReadout`). |
| `landing/node_modules/@lucasmarkes/hairline/dist/index.js` | The library. Measured mechanics: `pointer()` wiring (~L14400), vault `mount33` (~L197991), constants (~L197210: `R8=40 DP=14 ZC3=64 GAP3=10 KL=11 COMBO=40 REST16=30 WMAX2=150`), `proj/fit/Cam/unproj` (~L3665–L4300), drag math + open gate + IO-gated board tick (~L199900–L200400). |
| `agent/docs/generate-prompt-docs/landing-round07-13112026/rheo-vault-face-lap-validated.mjs` | The live-validated replacement lap (opened the deployed vault: `"dial 40 · open"`, `path.sil.hi`×3, +150ms). |
| `agent/docs/generate-prompt-docs/landing-round05-12112026/rheo-vault-lap-reference.ts` | Your round-05 reference (now known to over-sweep: 4.68°/unit vs real 3.6; stage-space orbit vs face-space). |
| `agent/probes/vault-face-sim.mjs` | Offline simulation proving the shipped lap travels +165 units and settles detent 70. |

## Measured facts (hairline@0.5.1)

- Dial drag: `da = -(Δang)/3.6 * clamp(r/22, 0, 1)` (face units; r = face radius from `onFace`); `r > 71` → leave() (grab lost).
- Velocity: `spin.w = clamp(lerp(w, da/dt, 0.35), -150, 150)`, `mode="coast"`; coast decay `w *= exp(-h*1e3/coast)` + detent spring `-40*sin(a/10*2π)*h`; settle → `tgt = round((a + w*0.15)/10)*10`.
- Open: `|wrap(a-40)| < 0.8 && |w| < 6` → `setOpen(true)` → three bolts (`THETA=[72,26,-20]`) draw + `path.sil.hi`×3.
- Board tick registered per stage and gated by an IntersectionObserver — off-screen stages do not integrate and do not emit reads.
- Projection: `Cam(45, 0.5, 1.5)` + `fit(C, pts, 200, 166)`; face→stage via affine inverse of `p0=P(0,14,0), px=P(1,14,0), pz=P(0,14,1)` (ZC3=64 shift).
- Stage element: `[data-hairline="vault"]` inside `#figure-panel`; svg viewBox `0 0 400 320`; pointer listeners on the stage itself; no `isTrusted` gate.
- LAYERS side (unchanged, verified good): fan listener on `#figure-panel` (`stageRef`), `k = rect.width/400`.

## Live verification log (probe, 2026-11-13)

- Off-screen tab-switch/tour laps: `path.sil.hi` 0 at +4.2s/+3.6s (nothing integrated).
- ScrollIntoView → hover: read line `"dial 77"` (deferred coast from earlier dispatches); later settled 90.
- Shipped-geometry stage orbit, simulated: +165 units → detent 70.
- Face orbit r=25, 108° CW sweep: geometric +30 exact; coast +67 → detent 90 (exp-decay sample curve measured).
- Validated lap (face r=25, ease-out, Δ=50 → 184°): `"dial 41 · open"` at +150ms → `"dial 40 · open"`, sil.hi 3 stable 2.4s.
- Shipped narrative when visible: opened LATE (t≈1800ms, during crossfade) or at ~5s — unreliable timing vs the choreography (lap 1.14s + settle 400ms + crossfade 520ms).

## Environment

- Site: https://rheooo.netlify.app (Netlify). Deployed app chunk `1db636ojt19xu.js`.
- Probe: CDP-attached Chromium (headless, 780×437 viewport), synthetic PointerEvents (no isTrusted gate — all dispatches honored).
- hairline: `@lucasmarkes/hairline@0.5.1` (installed; dist read directly).

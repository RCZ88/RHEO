# GLM Round 07 — vault lap rewrite (rev-3 spec request)

Live verification of the deployed rev-2 found the vault lap unreliable. Three of
your round-05/06 sign-offs are answered below; the vault driver needs a spec
revision built on the measured mechanics of hairline@0.5.1.

## What was verified live (2026-11-13, CDP probe on https://rheooo.netlify.app)

**LAYERS tab — ALL PASS** (your L1–L7 spec, shipped in f0d3530, live in chunk
`1db636ojt19xu.js`):
- Four plates render: `01 · RENDERER / 02 · MAIN / 03 · SQLITE FILES DB WAL SHM / 04 · LOCAL DISK`, all `aria-pressed="false"` at rest.
- Fan: pointer sweep x40→x360 spreads plate tops 66.2px → 76.0px per gap (REST 0.18 → 1.0, exact L5); pointerleave collapses to the exact rest geometry.
- Click `01 · RENDERER` → `aria-pressed="true"`, detail headline "The part of RHEO you see."; second click → cleared to overview. ✓
- `CONNECTIONS / 2 DESTINATIONS` control present. ✓
- Detail overview copy renders (`#layer-detail-panel`). ✓

## What was measured on the vault (the bug)

The shipped lap constants disagree with hairline@0.5.1's real dial mechanics
(all extracted from `node_modules/@lucasmarkes/hairline/dist/index.js` and
confirmed live):

1. **DEG_PER_UNIT is 3.6, not 4.68.** `da = -(Δang)/3.6 * clamp(r/22, 0, 1)` —
   at a gear-saturated orbit (face r ≥ 22) it is exactly 3.6°/unit (100 units per
   turn, detents every 10). The shipped 515° sweep for Δ=110 delivers ~143 units.
2. **The orbit must be built in FACE space.** A stage-space circle (r=30 around
   the dial center) maps to a face ellipse r 19.6–37.8 (gear varies). A
   face-space circle roundtrips exactly (measured 25.000..25.000). The stage→face
   map is mount33's `Cam(45,0.5,1.5)` + `fit(...200,166)` + affine inverse —
   replicated in the attached reference.
3. **The dial is velocity-driven with coast.** `spin.w` integrates with exp decay
   after pointerup (τ up to ~1.5s at default intensity) and settles on the
   NEAREST DETENT. Measured live: a 108°/6-step sweep (+30 geometric) coasted
   +67 units and settled at detent 90. The shipped lap's fast sweep + coast is a
   coin flip; sometimes it lands 40 (observed), usually not.
4. **Off-screen = frozen.** The board tick is IntersectionObserver-gated. With
   the figure below the fold, dispatches set `spin.w` but NOTHING integrates;
   when the figure later scrolls into view the deferred w coasts the dial to a
   random detent (measured 30→77→90). Both narrative laps and the tour ran
   off-screen in our probe and never opened (sil.hi 0 at +4.2s/+3.6s).
5. **Reads are also IO-gated.** `probeDial`'s a0 read works only on-screen;
   off-screen it silently falls back to 30.

**Validated fix (measured live, open in ~150ms):** face-space orbit rf=25 (gear
exactly 1.0), read a0 by hover, sweep `Δ*3.6 + 3.6` degrees with cubic
ease-out so the dial arrives at raw 41 with w≈0 → the settle spring pulls it to
40 → the gate `|a−40|<0.8 && |w|<6` fires → `"dial 40 · open"` + `path.sil.hi`×3
stable. Full reference: `rheo-vault-face-lap-validated.mjs` (attached).

## Ask — write the rev-3 spec for the vault driver

Rewrite `dialLap`/`dispatchPointer`/lap constants in `Download.tsx` to the
attached validated construction, plus sign off on these decisions:

- **V1.** Replace the stage-space orbit with the face-space construction
  (`makeFaceMap` — Cam/proj/fit replication, ~15 lines) and constant
  `DEG_PER_UNIT = 3.6`. Confirm or adjust.
- **V2.** Ease-out arrival at raw 41 (+1 unit past the detent) instead of
  creep-through: settle does the last unit. Acceptable, or do you want a slower
  creep crossing (w<6 through 40) instead?
- **V3.** Visibility guard: `scrollIntoView({block:"center"})` + ~400ms wait
  before ANY lap dispatch (narrative AND tour), so the IO-gated tick is running.
  Confirm; also say whether the narrative should WAIT for the first read
  (`dial NN` in readRef) instead of a fixed 400ms.
- **V4.** Sweep step grid: 50 steps × 25ms (measured) — fine as-is?
- **V5.** `probeDial` should FAIL LOUDLY (skip the lap, log) when a0 is
  unreadable instead of silently assuming 30. Confirm.
- **V6.** Round-06 open items (unchanged, still awaiting your sign-offs):
  sync-crossfade layout, prm rAF bridge, fan anchoring, selection-at-rest,
  glyphs, Connections dim, read-line default, hint wording.

Spec only — we implement, CZ builds and deploys.

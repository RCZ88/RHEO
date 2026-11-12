# GLM round-05 reply (2026-11-12) — vault/lap live teardown + rev-2 directives

> Verified against three sources before answering: the live `sample-day.json`
> (fetched 2026-11-12), `@lucasmarkes/hairline@0.5.1` dist from npm (all
> round-01 line citations match: `pointer()@:395`, `LAP@:432`, `mount7@:1668`,
> `RD=17@:5455`, `COMBO=40@:5470`, `mount33@:5490`), and **instrumented runs on
> the deployed site itself** (chunk `43p80lhi3hec7.js` decoded + synthetic
> dispatch + MutationObserver on the live page). Reference implementation:
> `rheo-vault-lap-reference.ts` in this folder.

**0. SLOT — SampleDayTimeline: CONFIRMED** between chart panel and readings
index, `mb-24`, `scrub={p}` unchanged. The timeline renders all 520 recorded
minutes across all 12 categories; the cards remain the ranked view.

**1. Q1 — epsilon: CONFIRMED correct, no second-order case.** Old formula
hard-jumps 76 (187→111) at v≈0.22, 12 (111→99) at v≈0.47, 365 (99→464) at
v≈0.72 — all three boundaries. Sweep at Δ=1e-4 + exact boundary doubles ±3 ULP:
old max |Δminutes| = 365; new max = 1. Zone start = outgoing (187/111/99), end
= incoming (111/99/464), center = midpoint (149/105/282 — integer lerp
endpoints exact in doubles). Clamps safe. Margin 1e-9 vs ~1e-16 float gap, 7
orders. Ship as implemented.

**2. Q2 — KEEP `1,440 MIN | 520 RECORDED · 920 NULL`.** The file has **12
categories**, not 8 — IDE 187 · Browser 111 · AI Tools 99 · Uncategorized 87 ·
Education 20 · Entertainment 4 · Media 4 · Development 3 · Gaming 2 ·
Productivity 1 · Social Media 1 · Communication 1 — summing exactly 520. 515 =
top-8 sum; 433 = rankable (excl. Uncategorized). Only 520+920=1440 is a closed
identity. **shareOfActive denominator = 520** → IDE 36% · Browser 21% ·
AI Tools 19% (35.96 / 21.35 / 19.04). `summary` re-confirmed poisoned
(top_category_minutes 3987 vs measured top IDE 187) — never render. DERIVED
cards re-verified exact: IDE 187 (04:00→04:13, 76 runs), Browser 111 (08:28→08:38, 67), AI Tools 99 (04:58→05:04, 60), QUIET 464 (16:16→24:00).

**3. Q4 — the signature is `path.sil.hi × 3`, but two findings precede it:**

(a) **The deployed narrative is inert.** `hM` dispatches on the **panel
container** (`o.current`), but hairline's `pointer()` listeners sit on the
descendant `[data-hairline]` stage — parent-targeted events never enter a
child's propagation path. Measured: a full V4 lap on the panel → **0
mutations** on the stage. Tour + tabs animate only crossfades + captions.

(b) **Even correctly targeted, the V4 lap cannot open the vault.** (i) The
open condition (`:5577–5579`) is `|wrap(spin.a − 40)| < 0.8 && |spin.w| < 6` —
proximity + slowness, checked every frame; the dial must SETTLE on 40 (stable
detent; catch basin a_end ∈ [135.5, 144.5] mod 100). (ii) The orbit (200,162)
R25 does not enclose the true dial center (178.79, 180.56) — distance 28.2 >
25, winding number 0; measured: dial wobbles, coasts ~2,383 ms, settles at
detent 00. (iii) `WMAX2 = 150` caps travel at ≈96 units per 640ms; the
full-turn catch (+110 from rest 30) needs ≥1.1 s.

(c) **Signature + assert.** `setOpen(true)` → `light()` toggles class `hi` on
the three moving-bolt silhouette paths. **Open ⇔
`stage.querySelectorAll('path.sil.hi').length === 3`** (closed+hover = 1, the
dial silhouette; closed idle = 0 sil + 1 `path.nf.hi`, the 40-tick). The
`onRead` string "dial 40 · open" is NOT stable at rest — never assert on it.
Assert bound: open fires **+212…+244 ms after the final pointerup** (3
fresh-mount runs, ±30 ms) — spec at **≤600 ms**, dev-only (`NODE_ENV` gate).
Bolt motion after setOpen: stagger `|i−from|·50 ms` + 700 ms tween,
EASE_LIFT bezier(0.32,0.72,0,1) — ~87% retracted at 300 ms, done ≤800 ms.

(d) **The corrected lap (validated live, 4 runs).** Dispatch on the stage
(`panel.querySelector('[data-hairline="vault"]')`), per-event rect,
`k = stageRect.width/400`. Sequence: `pointerleave` (normalize) → poll onRead
until not `/dial/` (≤2.5 s, instant if at rest) → **probe** (hover at grab θ=180° R12; `last2===null` after a leave so it moves nothing; wait 2 rAF; parse
a0 from "dial NN" — works in prm too, default 30) → lap: **Δ = (40 − a0 +
100) % 100, +100 if < 60; N = max(31, round(Δ/1.93)) steps × 20 ms;
Θ = 4.68·Δ° CW from 180°; orbit center (178.79, 180.56), R 12→30 over the
first 3 steps; velocity profile accel 0.12 / hold 0.46 / decel 0.26 / creep
0.16 (creep = 3% of mean → dial w converges < 6); pointer position from
wall-clock t = (now−t0)/(N·20), not step index** → `pointerup` →
`pointerleave`. prm: synchronous dispatch, same Δ targeting (prm handler snaps
per move, `round(raw/10)·10`; only the probe keeps its 2-rAF wait). Layers
sweep: deployed geometry correct, only the target was wrong; gap opens +34
user units (stack bbox 113.3→147.3).

**4. Q5 — NO intro replay; segment 4 STAYS.** No intro exists: `tour()` (ghost
attract loop, `:446`) is created only when `opts.play === true` (`:714`);
deployed FigureInstrument passes only `label` + `onRead`. Measured: fresh
mount → 0 stage mutations in 3.5 s. Every LAYERS→VAULT remount is a fresh
`spin.a = REST16 = 30`, so the re-open lap is the only gesture. (If `play:true`
ever ships: infinite idle loop, enter → 4 LAP stops, TRAVEL 900 / DWELL 1200 →
leave → REST 1800 → repeat; first ghost move ≥1200 + 450·(started mod 4) ms
after mount; held by any pointer activity; resumed 1200 ms after
pointerleave; killed by focusin and prm.)

**5. Q6 — calibration: neither.** (200,162) is wrong and superseded. Ship
**(178.79, 180.56) + R 12→30, runtime k** — no calibration utility (hairline
is lockfile-pinned at 0.5.1; geometry changes only on a deliberate version
bump, which the Q4 assert trips). Ship exactly one tripwire: the Q4 dev
assert.

**6. V5 rev 2 — timing deltas (same easing/lock/caption rules; V1–V6 stand):**

- AnimatePresence: **remove `mode="wait"`** (default sync). With sync, the
  520 ms window matches spec and the new stage is live at +520 for the
  sweep/re-open.
- `onRead` must also write a ref (`onRead={v => {readRef.current = v;
  setRead(v)}}`) — the probe and rest-poll read it synchronously.
- Separate the narrative caption state from the read stream — they currently
  share one setter, so "the vault opens onto the stack" is overwritten within
  ~16 ms by the first "dial NN".
- VAULT→LAYERS: pre (~35 ms fresh; ≤2.5 s if coasting) + lap **1,140 ms**
  (57 steps from a0=30) + open settle **400** + crossfade 520 + sweep 640 +
  settle 240 ≈ **2,975 ms** (was 2,360).
- LAYERS→VAULT: collapse 480 + hold 240 + crossfade 520 + [pre + lap 1,140 +
  open 400] + settle 120 ≈ **2,935 ms** (was 2,000).
- Tour button: vault mode = pre + lap + **500** wait (was 320) + leave +
  unlock; layers mode = sweep 640 + 240 + leave (unchanged).
- The assert (≤600 ms, `path.sil.hi === 3`) fires after every dial lap, both
  narratives and the button.

Validation status: fresh-mount lap ×3, adaptive a0=40 re-open, layers sweep,
and fresh-mount silence all verified live on the deployed page; full
sequential tab narratives validated piecewise — the assert plus one visual
pass after the agent implements covers that.

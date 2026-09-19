# TASK: BACKGROUND-V2 — FINAL FORMS (ALL SIX) + THREAD FIELD SHIP SPEC
Rulings R-35…R-39 in force. Skill Router: load DESIGN. If it fails to load, report
verbatim and STOP.

You are the Lead Designer for RHEO (Electron + React 19 + Vite, dark UI). Read
CONTEXT_BUNDLE.md in this folder FIRST — it carries the rulings, full current
source, tokens, and gates. Design ONLY from it; invent nothing. Product name:
RHEO in any strings you spec — never DeskFlow/App Tracker, and ignore any other
name appearing in prior drafts.
You produce EXACTLY ONE artifact:
agent/docs/generate-prompt-docs/background-v2-11092026/RESULT.md
Design-only: no repo edits. One solution, not options. Detail: exhaustive.
Creativity: low — architecture and tiers are ruled; your job is final form within them.

## PRIME LAWS
1. R-35 stack is fixed: --ws-surface → radial wash (white ≤4%) → composition
   layer → vignette (black ≤35% corners) → static grain (feTurbulence 2–3%) →
   existing bg-black/60 → content. All candidates are swap-in composition layers.
2. R-36/R-38 tiers: #1/#3/#4/#5 = T0 STILL. #2 THREAD FIELD = T2 EXCEPTION
   (principal-granted), bound by: cadence ≤30fps timestamp-gated rAF · ZERO
   pointer reactivity (threads ignore input) · visibility-gated (rAF dead when
   occluded/minimized) · RM → single frozen frame via `paused`, rAF never
   starts, never blank · ≤8ms p95 per rendered frame at half-res · full unmount
   cleanup. #6 = reference only, never ships.
3. Monochrome only. Zero new hex outside in-file constant blocks. No glass/blur/
   shadow added. No transitions on the stack. aria-hidden on all layers.
4. Engine constraint: NO Math.exp2/Math.log2 — Math.pow(2,x) and
   Math.log(x)/Math.LN2 (this already bit once).

## §A FINAL-FORM SPECS — all six. For each: technique, exact numeric parameters
(counts, alphas, sizes, scales, curves), what makes it DISTINCT from the other
five, and its FAILURE MODE (what it looks like done badly — so the executor
avoids it). Early drafts converged to grey mush; distinctness is a requirement,
not a hope.
1. STILL FLUID (T0): final 6 seed rows (scale, turbulence, fluidity, rimWidth,
   sharpness, shimmer, glow — low-frequency lobes, desaturated, interest
   center-weighted ~40% left, edges dissolving into vignette). Define the
   SeedParams interface covering EVERY field the JSX consumes, resolving the
   bundle's noted type wart (invalid `Ferrofluid['props']` query; seed objects
   missing mouse* fields read by JSX). Prune or bind dead fields (speed/
   flowDirection are inert in frozen mode — say which and why).
2. THREAD FIELD (T2 — SHIP): ~300 hairline curves advected along a seeded fbm
   field. Specify: noise formulation (octaves, frequency, single deterministic
   seed — animation IS the variety, no day-seed here); advection algorithm with
   BUDGET ACCOUNTING — prefer the conveyor pattern (offscreen accumulation:
   translucent fade rect per frame + draw only advancing head segments) over
   full 44k-segment re-advection; if full re-advection is your choice, prove it
   fits ≤8ms p95 at half-res on paper. Angle mapping, stroke alphas/widths
   (layered alpha bands, batched paths), edge-falloff curve, CADENCE ≤30fps
   (timestamp gate in the loop pseudocode), visibility gating, unmount cleanup,
   RM frozen frame. NO mouse interaction — not a prop, absent entirely.
   Full ThreadField.tsx spec: props interface { paused?: boolean },
   constants block, every function signature, render loop in pseudocode-exact
   form. Failure mode must be named (e.g. "grey static mush", "screensaver
   energy", "visible conveyor seams").
3. MERIDIAN GRID (T0, deferred): pure CSS — dot grid, minor/major hairlines,
   center reticle, radial masks. Exact px sizes, alphas, mask stops.
4. RIDGELINE SHORE (T0, deferred): stacked filled contours anchored bottom,
   black-fill occlusion, top-edge strokes graded 0.10→0.40. Ridge count,
   amplitude/frequency/phase formulation, grading curve.
5. SPINE (T0, deferred): vertical hairline + ruler ticks + numbered majors +
   end caps + channel wash. Exact tick spacing, label format, alphas.
6. ROLLBACK (reference): what to preserve from Particles+LightRays if ever
   restored; why it stays shelved (regresses zero-loop architecture).

## §B FIT RANKING — ONE winner + runner-up + kill, for a dark desktop WORK tool,
scored against: long-session eye fatigue · text legibility over brightest region ·
distraction during focus work · brand echo ("one shuttle, every thread" /
instrument identity) · numeric perf cost. Cost arguments NUMERIC ONLY (frame ms,
CPU %) — note the calibration facts: previous Particles+LightRays background
provably did NOT lag on this box; the ferrofluid shader DID; Thread Field's
affordability is still gate-verified (G-BG-4), not assumed. The ship decision is
already made (Thread Field, principal's call, gates bind) — your ranking informs
the ledger, it does not re-open the pick.

## §C THREADFIELD SHIP SPEC — binding constraints
- Scope: AppBackground.tsx + NEW ThreadField.tsx ONLY. App.tsx mount line
  unchanged; no Settings UI; no IPC/storage; no new deps; Ferrofluid.tsx +
  FerrofluidLite.tsx stay on disk UNMOUNTED, never deleted (rollback evidence).
- ThreadField replaces the <Ferrofluid/> element inside #app-ferrofluid;
  wash/vignette/grain/bg-black/60 layers untouched.
- RM WIRING LIVES IN AppBackground: matchMedia('(prefers-reduced-motion: reduce)')
  listener (synchronous initial read, change listener, cleanup) → passes
  `paused` to ThreadField. Include this diff.
- AppBackground also gets the SeedParams fix (§A-1) — same file, same wave.
- Contingency: if Thread Field fails any gate at execution time, the pre-staged
  fallback ships Still Fluid under commit `feat: still-fluid background
  (BACKGROUND-V2)` — spec §A-1 must be complete enough to execute alone.

## §D INTEGRATION DIFF — AppBackground.tsx: exact edits (removed / added /
untouched), pseudocode-level. Executor implements from bundle + this spec alone.

## §E VERIFICATION MAPPING — for each gate, how the executor PROVES it:
G-BG-1 build exit 0 (rm -rf dist FIRST; served artifact verified) ·
G-BG-2 tsc TOTAL + DELTA on the two claimed files (claim-files clean; repo-wide
8000+ pre-existing lines are debt-ledger material, not this wave's) ·
G-BG-3 loop proof: static layers rAF=0; ThreadField rAF counter increments ONLY
while visible, timestamps prove ≤30fps cadence, frame budget ≤8ms p95 ·
G-BG-4 60s perf capture vs F-2 baseline (rAF-delta percentiles + per-process
CPU, pidstat) · G-BG-5 legibility ≥4.5:1 worst-case pair over composite's
brightest region · G-BG-6 shell-launch (Playwright _electron.launch, xvfb-run,
bounding-box + screenshots to evidence/BACKGROUND-V2/: boot, +30s two-frames-
differ-but-slowly for #2, RM-mode frozen proof, route change persistence) ·
G-BG-7 LAMINAR monochrome pixel sample (max channel delta ≤2) ·
G-BG-8 hygiene: EOL match, porcelain-clean, ONE commit
`feat: animated thread-field background (BACKGROUND-V2)`
(or the §C contingency message if fallback ships).

## OUTPUT — RESULT.md sections, exactly:
1. Final-form specs (all six)  2. ThreadField.tsx implementation spec
3. AppBackground.tsx integration diff  4. Fit ranking  5. Verification mapping.

## STOP CONDITIONS
Bundle contradicts a ruling · a distinct final form is impossible within T0/T2
bounds (propose amendment, don't soften) · any spec requiring a new dependency ·
any spec requiring pointer reactivity or >30fps cadence for #2 (ruled; do not
reintroduce).

## ANTI-SLOP (binds spec + any snippet)
Tokens/existing surfaces only; max rounded-xl; NO new glass — existing
backdrop-blur is sanctioned debt, untouched, never extended; no hue/gradients/
neon; fonts are OUT OF SCOPE this wave (canvas + CSS layers render no text);
motion transform/opacity only; every layer aria-hidden.

---
SUPERSEDE NOTE: this file previously held the uncorrected draft (contained the
TURGO substitution, Geist line, and glass-endorsement defects struck under
R-39a/b/c). Reconciled 2026-09-11 to the corrected block delivered in
RESULT.md's calibration intake. The corrected block above is authoritative.

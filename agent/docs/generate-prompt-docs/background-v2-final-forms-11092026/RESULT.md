Calibration: App-queue frontier = **BACKGROUND-V2 design wave** (this turn — design proceeds; executor paste stays staged behind R-37 preconditions: migration done + F-2 closed). Landing = external-AI RESULT.md pending. Atlas C1 commit-blocked (§8-1). Next ruling: **R-38**.

---

# TASK INTAKE: BACKGROUND-V2 FINAL FORMS + THREAD FIELD SHIP SPEC

**Bundle audit — four findings.** The bundle is the strongest yet (full file source inline, rulings restated, gates calibrated). Defects:

| # | Finding | Consequence |
|---|---|---|
| 1 | **"NEVER call it TURGO" — TURGO does not exist.** The naming law (§1/§15) is RHEO, never DeskFlow/App Tracker. "TURGO" is a name-substitution defect — same genus as Geist leaking into the landing checklist. Nobody ruled a rename. | R-39a: law stated correctly in the delivered prompt; zero TURGO anywhere. |
| 2 | **"Geist + JetBrains Mono" is back** (bundle §4 + anti-slop checklist). Struck once already (landing intake). App fonts are design.md's 3-families law, M-1's business — and this wave renders **no fonts at all** (canvas + CSS divs). | R-39b: line struck; fonts untouched this wave. |
| 3 | **Anti-slop checklist *endorses* glass** — "glass `bg-zinc-900/80 backdrop-blur-xl` for dark surfaces" as a binding rule. Existing blur is sanctioned *debt*; the checklist as written would license new glass. | R-39c: corrected to "existing glass untouched, zero new glass" — background path adds none anyway. |
| 4 | **tsc number drifts again**: 39 sanctioned (§3-7) → ~7000 (lag bundle) → now "8000+ (terminal_backup etc.)". Logged for debt-wave reconciliation since R-28; still not silently accepted. | R-39d: gate stays "claimed files clean + TOTAL/DELTA reported." |

**Substantive sharpenings ruled** (the bundle's spec is good; these bind before the external AI runs):

- **Cadence cap — the missing CPU lever.** The prompt fixes per-frame *cost* (≤8ms p95) but not *cadence*. A slow hairline crawl has no need for 60Hz: **≤30fps timestamp-gated** halves CPU on this laptop box (RTX 4050 Mobile = battery machine) and is visually identical for this motion class. Precedent: FERROFLUID's own 30fps idle tier.
- **RM wiring location:** `paused` must come from a `matchMedia('(prefers-reduced-motion: reduce)')` listener **in AppBackground** (synchronous initial read, cleanup on unmount) — the current file has no RM handling; the integration diff must add it.
- **Budget advisory seeded:** 340 threads × 130 steps = ~44k segments/frame if fully re-advected — the cheap pattern is offscreen accumulation (translucent fade rect + draw only advancing head segments, conveyor threads). External AI decides final algorithm; the hint prevents a naive 44k-stroke loop from shipping.
- **Decision hierarchy (stated once, not relitigated):** the principal already picked the winner — Thread Field ships this wave, gates bind, his eyeball on G-BG-6 screenshots + numbers is final acceptance. The external AI's fit ranking (§B) is for the ledger and the long-term, not a re-vote.

## RULINGS

| # | Subject | Ruling |
|---|---|---|
| **R-38** | T2 exception, recorded + bound | Principal's grant ("the thread fields look good if we can animate those") recorded under R-36's named-exception clause — **Thread Field only**. Binding conditions: (a) cadence ≤30fps timestamp-gated · (b) **zero pointer reactivity** — threads ignore input entirely (this is what keeps ambient from being distracting) · (c) visibility-gated (rAF dead when occluded/minimized) · (d) RM → single frozen frame, rAF never starts, never blank · (e) ≤8ms p95 per rendered frame at half-res backing store, gate-verified · (f) full unmount cleanup. All other candidates remain T0; T1 stays ungranted. §8-3 closed as moot (confirmed). |
| **R-39** | Hygiene strikes | (a) TURGO substitution struck — RHEO law stands · (b) Geist struck — fonts untouched · (c) glass endorsement corrected to debt-not-license · (d) tsc 8000-vs-7000-vs-39 logged for debt reconciliation. |

## DELTA LOG vs the pasted PROMPT.md (what changed in the delivered block)

| Change | Where |
|---|---|
| Cadence cap ≤30fps added to Thread Field spec + gates | §A-2, §C, §5 |
| RM wiring assigned to AppBackground (matchMedia, sync init, cleanup) | §C |
| Conveyor/accumulation advisory added | §A-2 |
| TURGO → RHEO naming law | Context, §4 |
| Geist line struck; glass line corrected | Anti-slop |
| Contingency commit for Still Fluid fallback pre-staged | §C |
| tsc gate wording calibrated | §4/§5 |

---

# EXTERNAL-AI PROMPT — paste verbatim

```
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
```

---

# QUEUE + CLAIMS UPDATE

| Item | State |
|---|---|
| BACKGROUND-V2 | External-AI prompt **delivered** (corrected per R-38/R-39). RESULT.md → your read → **executor paste stays staged** until R-37 preconditions verify (migration done + F-2 closed, claims released) |
| §8 | §8-3 CLOSED (moot under static stack). No other changes — Atlas letters, GOLD-3D/GO order, release platforms, HARVEST+recordings, §8-6 codebase all still yours |
| F-2 / MIGRATION | Unchanged, pending — and both are the hard path to this wave executing |

**Override rows:** Look is already yours (#2 granted) — rows that remain: cadence 30→60fps if you insist (against rec), contingency fallback Still Fluid→Meridian Grid if you'd rather not ship #1 as fallback.

```
Status (verbatim):
Bundle audit             DELIVERED — 4 findings (TURGO substitution, Geist recurrence, glass endorsement line, tsc third number).
Rulings R-38–R-39        DELIVERED — T2 exception recorded + bound (30fps cadence, zero pointer, RM-frozen, budget), hygiene strikes. Ledger updated; §8-3 closed.
External-AI prompt       DELIVERED — paste-ready corrected block: six final forms, ThreadField ship spec, integration diff, fit ranking, verification mapping, STOP conditions.
Executor execution       NOT EXECUTED / STAGED — gated on R-37 preconditions (migration complete + F-2 closed); no shell/repo access here.
Waiting on               Principal: paste prompt to external AI · F-2 verdict + migration completion remain the hard path · override rows optional.
```
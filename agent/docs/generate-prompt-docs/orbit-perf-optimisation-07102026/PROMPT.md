# PROMPT — Research, then design a performance optimisation plan for the DeskFlow Orbit (solar system) view

**Target AI:** Claude (or GPT-4 / Gemini — the brief is model-agnostic)
**Required output:** a single `RESULT.md`.

---

## Raw Request (verbatim — do not re-interpret)

> "maybe osme optimizations on the performance end?"

---

## Context — the "why" and the "where"

DeskFlow's Dashboard has a WebGL 3D view ("Orbit") showing tracked app usage as a
solar system, a galaxy of solar systems, and — new — a stratified orbital disc. It is the
most expensive surface in the app and the least instrumented: there is currently **no way to
measure, from inside the running app, what it costs or which part costs it.**

**Read `CONTEXT_BUNDLE.md` FIRST and treat it as the codebase.** You do not have this repo.
It carries the real source, ten numbered findings (F1–F10) with line numbers, the real
particle counts, and the hard constraints. Do not ask for files.

Two facts frame everything:

- **F1:** both galaxies render simultaneously while sitting **3,250 world units apart**, so
  roughly half the dust cost is for something the user cannot see.
- **F10:** there is no instrumentation. Any plan that starts with "optimise the hot path"
  without first making cost measurable is guessing.

---

## The Mandate

Act as **Lead Performance Engineer and Technical Artist** for this one surface. You own the
measurement strategy, the optimisation ordering, the visual-fidelity budget, and the
migration plan.

**Deliver ONE plan. Not a menu.** No "Option A / Option B". Pick the strongest sequence,
justify it against what you rejected in one line each, and specify it completely.

### Phase 0 — RESEARCH FIRST (explicitly requested: "think and research")

Before proposing anything, research and **cite** what you find:

- **Measuring WebGL from inside an app:** `renderer.info` (draw calls, triangles, textures,
  geometries, programs) and exactly which fields are trustworthy per frame; `EXT_disjoint_
  timer_query_webgl2` for GPU-side timing; Spector.js / Chrome DevTools' GPU panel; why
  `renderer.info.render.calls` resets per frame and how to sample it correctly.
- **Where react-three-fiber cost actually goes:** the reconciler vs the render loop;
  why `useFrame` subscription count matters independently of what each callback does;
  the cost of prop identity churn re-rendering a scene graph; `frameloop="demand"` and when
  it is appropriate for an interactive scene (and when it is not).
- **Points vs instancing vs impostors** at 1k–100k marks: additive-blended point fill cost
  and overdraw on integrated GPUs; `sizeAttenuation` trade-offs; `InstancedMesh` vs
  `BatchedMesh` vs a single merged `BufferGeometry` with a shader; and what `depthWrite:false`
  costs in an additive stack.
- **Resource lifetime in R3F:** when buffers/geometries/textures are actually disposed;
  why a `useMemo` with a stale dependency array leaks; the cost of a `key`-driven remount of
  a whole `<Canvas>`; and the correct pattern for regenerating typed arrays in place.
- **Practical ceilings:** draw calls, triangle counts and texture-memory budgets for an
  integrated GPU at 1080p, with real numbers rather than folklore.

Every claim traceable: name or link the source. Label anything that is general knowledge
rather than sourced.

### Phase 1 — Instrumentation before optimisation

Specify the measurement layer first. It must be:

- **Cheap enough to leave on in production** (no per-frame `readPixels`, no GPU stalls).
- **Attributable per subsystem** — dust, belts, stars, planets, moons, postprocessing,
  React/DOM overhead — not one aggregate number.
- **Visible in the app**, using the existing `FPSCounter` / `FPSLineGraph` in
  `OrbitControls.tsx` and the existing perf-overlay toggles, not a separate dev tool.
- Sampled on an interval, not per frame.

State precisely what to read (`renderer.info` fields, which ones, at what sampling rate),
what to display, and what the thresholds are that make a tier change worth triggering.
Include how to measure **React-side** cost separately from GPU cost, because F7 suggests a
meaningful share of the frame is JS, not drawing.

### Phase 2 — Fix what is measurably wrong, ordered by cost-per-risk

Address the findings, but **rank them by measured cost per unit of risk**, and say why that
is the order. At minimum, give a concrete design for:

- **F1 (invisible galaxy):** the mechanism to skip the off-screen galaxy. Consider and choose
  between mounting only the active galaxy, distance/frustum culling by group, toggling
  `visible` on the group, and `frameloop` changes. **State the transition cost**: switching
  galaxies flies the camera 3,250 units, so a mount/unmount must not stutter that animation.
- **F3 (tier change = full remount):** how to re-tune quality without tearing down the scene.
  **This is coupled to F2** — if you fix F3 you must fix F2 in the same change or the particle
  counts silently freeze. Say so and specify both.
- **F4 (tier gates almost nothing):** the full tier matrix. For each of
  `high | balanced | performance`, specify exactly what changes: particle counts, belts on/off,
  stars on/off and count, postprocessing chain, `dpr` cap, `antialias`, planet cap, texture
  resolution, moon count. Make the tiers meaningfully different rather than nominal.
- **F5/F6 (700 belt points + 5,000 stars, never gated):** whether these earn their cost at
  all, and what they should collapse to per tier.
- **F7 (16 `useFrame` callbacks, two of which bob a cloud ±0.3 units forever):** which
  subscriptions can be removed, merged, or made conditional on visibility — and what that does
  to frustum culling.
- **F8 (one mesh + three runtime canvas textures per planet):** the path to instancing, and the
  **texture disposal contract** that must survive it. A leak here kills the whole app window,
  so the disposal path is non-negotiable and must be specified exactly.
- **F9 (postprocessing always on):** what to drop on `performance`, and whether bloom is
  earning its full-screen pass.

### Phase 3 — Preserving the look

Every optimisation must state its **visual cost**, and the plan must include the case where
tier `performance` legitimately looks different. Specify:

- What the user sees change at each tier.
- Whether the degradation is disclosed in the UI, or silent. **Silent degradation is treated as
  a bug in this codebase.**
- How `prefers-reduced-motion` and `isPaused` interact with every optimisation — in
  particular, if motion is reduced, does the scene need its `useFrame` loop at all, and should
  `frameloop` become `demand`?

### Phase 4 — Migration plan

Staged, each stage independently shippable and independently measurable:

| Stage | Change | Expected saving | How you will know it worked |
|---|---|---|---|
| 0 | instrumentation only, no behaviour change | 0 | — establishes the baseline |
| 1 | … | … | … |

Order by risk-adjusted value. Name the stage that is safest to ship first and the one that
carries the most risk. For each stage, state the **rollback**.

### Phase 5 — What could make this worse

The three strongest arguments against your own plan, with mitigations. At minimum address:

- Culling the invisible galaxy can cause a **visible hitch** during the 3,250-unit camera
  flight between galaxies.
- Instancing + shared geometry can break per-planet picking, hover and the detail panel —
  `e.instanceId` must map back to the right `PlanetData`.
- Aggressive tiering can make the view look broken rather than fast, which reads as a
  regression.
- Removing per-frame callbacks can make things *slower* if it defeats frustum culling or
  causes re-renders elsewhere.

---

## Constraints (hard limits)

- **Do not delete any file.** RESULT.md proposed deleting `Planet.tsx`, `Ring.tsx`,
  `GalaxyDust.tsx` and `Moon.tsx`; that was refused and the user was told so. All three view
  modes must keep working. Any removal needs explicit user sign-off — list proposals in a
  separate section, do not assume them.
- **Do not change the database.** No trigger, schema or migration edits.
- **No new 3D dependency** without an explicit justification section.
- **Keep three honest tiers** (`high | balanced | performance`), persisted in
  `localStorage['deskflow-graphics-quality']`, keeping the automatic `onDecline` step-down.
- **Texture disposal must remain correct.** A WebGL context leak takes down the whole app
  window, not just this view.
- **Wayland:** the host is native Wayland with Electron forced to X11. Do not propose a
  transparent always-on-top window without addressing that.
- **Must remain verifiable without a GPU.** The engineer applying this cannot attach a
  debugger to the canvas, so prefer changes whose correctness is provable by static reasoning
  or by a numeric probe over changes that can only be judged by looking.

---

## Anti-slop checklist

1. No optimisation without a stated expected saving — "this is faster" is not a finding.
2. No measurement that costs more than the thing it measures (no per-frame `readPixels`).
3. No visual degradation that the UI does not disclose.
4. No duplicate source of truth for a constant — the repo already has an `ORBIT_CONFIG`
   defined twice with a `baseAngularSpeed` of `2.0` vs `0.001`; that is exactly how a 2000×
   discrepancy survived review.
5. No refactor that changes behaviour silently: if a `useMemo` dependency array is fixed, the
   thing it was masking must be fixed in the same change.
6. Every stage must be independently revertible.

---

## Skills to apply

- **Frontend Design** and **Human-Centric UX** — for the degraded-tier states and disclosure
  copy; the four states (loading/empty/error/populated) plus "degraded".
- **Motion — Bring the UI Alive** — liveliness levels and the `prefers-reduced-motion` path,
  since several optimisations interact with whether motion runs at all.
- **Impeccable** — interaction and UX-writing dimensions, particularly the degraded state.
- **UI UX Pro Max** — developer-tool and analytics-surface rules.
- **Design Taste System** — variance knobs, anti-repetition rules.

> **Honest limitation:** the agent writing this prompt had **no access to the shadcn / Magic
> UI / drei MCP servers**, so it could not paste a verified component inventory. Query them
> yourself and list the real APIs you rely on. Relevant here: `@react-three/drei`
> (`PerformanceMonitor`, `AdaptiveDpr`, `Detailed`, `Preload`, `useDetectGPU`,
> `Bvh`, `Instances`), `three` (`renderer.info`, `BatchedMesh`, `InstancedMesh`,
> `timer_query_webgl2`), and `@react-three/postprocessing` (`Bloom`, `ToneMapping`,
> `Vignette`, `SMAA`). **Verify the current API of anything you depend on rather than trusting
> this list** — and confirm each exists before recommending it.

---

## Output Format

One `RESULT.md` with these sections, in order:

1. **Research findings** — what you searched, what you found, with sources.
2. **Measurement layer** — exactly what to read, at what rate, displayed how, thresholds.
3. **Optimisation plan** — ranked, each item with mechanism, expected saving, visual cost.
4. **Tier matrix** — every knob, every tier, as a table.
5. **Texture & resource lifecycle** — the disposal contract, stated exactly.
6. **Migration plan** — staged table with verification and rollback per stage.
7. **Risks & mitigations** — including the three arguments against your own plan.
8. **Removals — needs explicit user confirmation** — if you propose any.

Then stop. Do not start writing code.

---

## Definition of done

An engineer can implement this without asking a clarifying question, and can prove each stage
worked without a GPU — because the instrumentation ships in stage 0 and every later stage has
a number attached to it.
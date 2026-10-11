# RESULT.md — DeskFlow Orbit view: measurement-first performance plan

**Surface:** Dashboard → Orbit (galaxy / solar-system / stratified-disc modes), `src/components/orbit/*`
**Reference box:** the host machine — native Wayland, Electron under XWayland, integrated GPU, 1080p, `dpr` 1.5. All targets below are quoted for this box.
**Author role:** Lead Performance Engineer & Technical Artist. One plan, no menus.

**Claim tags used throughout:** `[S]` = sourced (doc named), `[A]` = arithmetic derivation shown, `[G]` = general engineering knowledge, not benchmarked here, `[M]` = hypothesis to be confirmed by the Stage 0 probe, `[T]` = target. Nothing is claimed as measured, because nothing has been measured yet — that is F10, and Stage 0 exists to replace every `[M]` with a number.

**TL;DR:** Stage 0 makes cost visible per subsystem inside the running app. Then: stop simulating the galaxy the user isn't at (F1), stop rebooting the scene on tier change and fix the memo that the reboot was masking (F3+F2 as one change), make the three tiers actually different via one tier matrix (F4/F5/F6/F9), share geometry and instance moons (F8), put the scene on a frame-budget diet (F7), and drop to `frameloop="demand"` when the scene is paused or motion-reduced. No files deleted, no DB changes, no new dependencies, texture disposal contract unchanged and now provable by numeric probes.

---

## 1. Research findings

### 1.1 Measuring WebGL from inside the app

**`renderer.info` (three.js r183) `[S]`** — documented on the three.js `WebGLRenderer` page (threejs.org/docs/#api/en/renderers/WebGLRenderer, `.info` section):

| Field | Meaning | Trustworthy per frame? |
|---|---|---|
| `info.render.calls` | draw calls issued since last reset | yes **if** `info.autoReset = false` and we reset once per frame ourselves |
| `info.render.triangles` | triangles drawn since last reset | same caveat |
| `info.render.points` | POINTS draws since last reset | same caveat — this is the dust/belt/star currency of this scene |
| `info.render.lines` | line draws | same caveat — orbit paths/trails |
| `info.render.frame` | monotonic frame counter | always; used to detect "loop actually stopped" |
| `info.memory.geometries` / `info.memory.textures` | **live** resource counts, decremented on dispose | point-in-time; this is our leak detector, not a frame metric |
| `info.programs` | compiled shader programs | watch for growth = shader thrash; should be flat after warmup |

**Why `render.calls` resets per frame and how to sample correctly:** `info.autoReset` defaults to `true`, meaning the renderer resets the `render.*` counters on every internal `render()` call `[S — same docs page, autoReset]`. The Orbit view renders through `EffectComposer` (`@react-three/postprocessing`), which issues several `renderer.render()` calls per frame (scene pass, one or more effect passes, final blit). With `autoReset = true`, by the time anyone reads the value asynchronously, it reflects only the **last pass**, not the frame. Correct pattern, which Stage 0 specifies: set `renderer.info.autoReset = false` once in the Canvas `onCreated` callback; then one privileged per-frame sampler reads the accumulated counters, copies them into a preallocated ring buffer, and calls `renderer.info.reset()`. One frame of lag, zero stalls. The sampler runs as a priority-0 `useFrame`; the composer's render runs at priority 1 (`@react-three/postprocessing` takes over rendering that way), so the sampler always executes before that frame's draws and reads the previous frame's totals `[S — pmnd.rs r3f docs, useFrame renderPriority: "takes over the render loop"]`.

**`EXT_disjoint_timer_query_webgl2` `[S]`** — MDN documents it as the WebGL 2 GPU-timing extension; results are asynchronous (available frames later), availability is driver-dependent (Chrome on Windows/Linux commonly exposes it; Firefox does not; macOS/ANGLE generally does not). Per-pass timing would require bracketing the composer's internal passes — intrusive. **Decision: GPU timer queries are excluded from the always-on layer entirely.** They may be used once, manually, via a dev-only capture if a GPU-side question survives Stages 1–6. The in-app attribution strategy instead is *ablation* (§2.3), which costs nothing and works everywhere.

**Spector.js / Chrome DevTools `[S]`** — Spector (spector.babylonjs.com) captures and lists every draw call with CPU timings; Chrome DevTools' Performance panel has a GPU track (developer.chrome.com/docs/devtools/performance). Both are on-demand, developer-attached tools — explicitly *not* the production instrumentation, and neither is added as a dependency.

**`readPixels` is banned from the always-on path** — it forces a pipeline flush (anti-slop rule 2; also MDN WebGL best practices warn against mid-frame GPU→CPU reads) `[S/G]`.

### 1.2 Where react-three-fiber cost actually goes

- **The frame loop is not React.** Per frame, r3f runs its subscriber list (each `useFrame` callback, in priority order), then renders — or lets a priority>0 subscriber (the composer) render `[S — r3f docs]`. The reconciler only runs on React commits. So the 16 `useFrame` call sites in the bundle are a *floor* on per-frame JS, and the runtime subscription count is much higher than 16: the sites in `Planet.tsx` (2) and `Moon.tsx` (1) instantiate per planet and per moon — worst case ≈ 80×2 + 240 + belts + per-scene sites ≈ **400+ runtime subscriptions** `[A from bundle counts]`. The per-subscription call overhead itself is sub-microsecond `[G]` — the reason subscription *count* matters is (a) it multiplies whatever each body does, and (b) **callbacks run for invisible objects too**: r3f has no visibility check, and three's frustum culling skips the draw, not the callback.
- **Prop identity churn:** inline `position={[x,y,z]}`-style props allocate new arrays per render; r3f's reconciler treats a new identity as a changed prop and re-applies it, and the React commit itself diffs the whole 3D subtree `[G — consistent with r3f docs' guidance on memoising props]`. This is the mechanism behind F7's "meaningful share of the frame is JS" suspicion, together with any per-frame `setState` (suspect A5, §5).
- **`frameloop="demand"`** renders only on `invalidate()` `[S — r3f docs, frameloop]`. Appropriate when the scene is static or event-driven; **not** appropriate while orbital animation runs. It becomes correct exactly when the scene is paused or motion-reduced (§1.6, O7). Damping/controls need explicit invalidate-on-change wiring in demand mode — specified in O7.

### 1.3 Points vs instancing vs impostors at 1k–100k

- The dust **is already an impostor system** — `THREE.Points` are screen-aligned quads. The cost driver is not the vertex count (4,500–10,200 points is trivial vertex load) but **fill rate and overdraw**: additive blending with `depthWrite:false` means every overlapping fragment shades and blends, and additive blending is order-independent so no sorting is needed — the trade is unbounded overdraw `[G; MDN WebGL best practices discuss overdraw]`.
- **`sizeAttenuation` trade-off** `[S — three.js PointsMaterial docs]`: with attenuation on, `gl_PointSize ≈ size × (canvasHeight/2) / viewZ`. Derived for this scene: at 1080p (scale ≈ 540), a point of size 1–3 at the **far galaxy's distance (3,250 units)** is **0.17–0.5 px — sub-pixel** `[A]`. This number carries O1: the invisible galaxy is not just wasteful, at rest distance it is *optically negligible*, so hiding it cannot produce a visible hole (mid-flight is the exception — handled in O1).
- **`InstancedMesh`** `[S — three.js docs]`: one geometry + one material, N instances, per-instance matrix and colour; raycasting returns `intersection.instanceId`, which is the picking contract the brief worries about. **`BatchedMesh`** exists in r183 `[S]` but is for batching *many different geometries*; our planets share one sphere, so it is rejected in one line: InstancedMesh is strictly simpler and matches the pattern `OrbitalDisc.tsx` already uses.
- **Merged `BufferGeometry` + shader:** the right tool for *static* point fields; the dust is dynamic only in count, and in-place refills (§1.4) cover that without a new shader.

### 1.4 Resource lifetime in R3F

- r3f disposes objects created through JSX on unmount `[S — r3f docs, disposal]`; **resources created imperatively** (the `CanvasTexture`s from `acquirePlanetTextures`, `useMemo`-allocated `Float32Array`s) are **not** tracked — a `useMemo` whose dependency array omits what it reads (F2) leaves the old buffers orphaned but *also* keeps them alive via the geometry's attribute reference; the practical failure in this codebase is the inverse: the stale `[]` deps mean tier changes never rebuild at all.
- A `key`-driven `<Canvas>` remount (F3) destroys and recreates the **WebGL context**. Browsers cap live contexts (Chromium ≈ 16) and context creation re-compiles every program `[G]` — visible as first-frames jank and `info.programs` growth. Repeated tier flips churn contexts for no reason.
- **In-place typed-array regeneration** `[S — three.js BufferAttribute docs]`: keep the geometry, write into `attribute.array`, set `attribute.needsUpdate = true`, call `geometry.setDrawRange(0, count)` and `computeBoundingSphere()`. Zero reallocation, zero GC churn, count changes live. This is the F2 fix pattern.

### 1.5 Practical ceilings — integrated GPU at 1080p

No vendor benchmarks are cited (none verifiable from here); these are engineering **targets** with derivations, to be replaced by Stage 0 baseline numbers:

| Budget | Target | Derivation |
|---|---|---|
| Draw calls | ≤ 250 balanced / ≤ 150 performance | iGPU driver overhead of order 5–20 µs/call ⇒ 250 calls ≈ 1.5–5 ms CPU `[G]`; today's worst case (80 planets + 240 moons + trails/orbits + points + composer passes) is plausibly 400–700 `[A/M]` |
| Triangles | ≤ 250k | 80 spheres @ 32×24 segs ≈ 123k `[A]`; vertex load is not the problem here |
| Point primitives *submitted* | ≤ 5,500 balanced / ≤ 1,800 performance | matrix §4; today ≈ 10,200 allocated at balanced `[A from bundle]` |
| Full-screen-equivalent passes | ≤ 2 balanced / ≤ 1 performance | each 1080p pass ≈ 2.07M px; Bloom's mip chain ≈ 5–9 FS-equivalents ≈ 10–19M px-ops/frame — on an iGPU with fill in the low Gpx/s class that is **the** dominant GPU line item `[A + G]` |
| Scene JS per frame | ≤ 4 ms balanced | leaves headroom in a 16.6 ms frame `[T]` |
| Texture memory | ≤ 128 MB high / ≤ 96 MB balanced / ≤ 64 MB performance | 80 planets × 3 textures × (256² RGBA + mips ≈ 349 KB) ≈ 82 MB `[A — actual canvas sizes are audit A1]` |

### 1.6 Reduced motion and pause

`prefers-reduced-motion` is a standard media query `[S — MDN]`. Interaction design consequence: when motion is reduced or `isPaused`, **nothing in this scene needs a per-frame loop** — orbits, bob, twinkle and belts are the only time-driven things. That is the `frameloop="demand"` case (O7), and it matters more than any shader work for a dashboard that sits open all day: idle cost → ~0 `[A]`.

### 1.7 API verification ledger (verify at implementation time — re-check each signature before use)

| API relied on | Used by | What to re-verify |
|---|---|---|
| `renderer.info.render.{calls,triangles,points,lines,frame}`, `info.memory.{geometries,textures}`, `info.autoReset`, `info.reset()` | Stage 0 | field names in r183 `WebGLRenderer` docs/source |
| `useFrame(cb, renderPriority)` takeover semantics | Stage 0 | r3f docs |
| Canvas `frameloop` prop incl. live switching, `invalidate()` | O7 | r3f docs |
| drei `PerformanceMonitor` (`onDecline`, `flipflops`, `onFallback`) | O4 | drei docs (already imported in the file) |
| drei `Stars` props (`count`, `speed`, …) | O4 | drei docs (already imported) |
| drei `Html` behaviour inside a `visible:false` group | O1 | drei docs + one manual test |
| `InstancedMesh` raycast → `instanceId`, `setColorAt` | O5 | three docs |
| `BufferGeometry.setDrawRange`, `computeBoundingSphere`, `BufferAttribute.needsUpdate` | O2 | three docs |
| `gl.toneMapping` (renderer-level ACES) | O4 | three docs; screenshot parity check |
| `useDetectGPU` (drei) — optional, first-run default tier only | O4 | drei docs |
| `EffectComposer multisampling` prop | O4 | @react-three/postprocessing docs (already used) |

Already in the app and unchanged: `Bloom`, `ToneMapping`, `Vignette`, `OrbitControls`, `Html`. **No new dependency is introduced** — no `BatchedMesh`, no shader library, no Spector in the bundle. drei's `AdaptiveDpr`/`Detailed`/`Preload`/`Bvh`/`Instances` were evaluated and rejected: `AdaptiveDpr` would be a *second* dpr authority conflicting with the tier matrix (anti-slop rule 4); LOD/`Bvh` solve problems this scene doesn't have at ≤80 planets; `Preload` is unnecessary because O1 keeps both galaxies mounted; raw `InstancedMesh` matches the existing `OrbitalDisc` pattern with one fewer abstraction.

---

## 2. Measurement layer (Stage 0 — ships before any behaviour change)

### 2.1 Principles

1. Cheaper than the thing it measures: per-frame cost is a dozen integer property reads plus 2 × `performance.now()` per timed callback ≈ **single-digit µs/frame** `[A]` against a 16.6 ms budget. No `readPixels`, no GPU queries, no allocation per frame (preallocated ring buffers).
2. UI updates on a **2 Hz interval**, never per frame; per-frame work accumulates into plain arrays and the interval flushes one `setState` inside the HUD component only (never the scene's parent).
3. Attribution by **ablation**, not by GPU timers: every subsystem gets a switch that drives the *same gate variables the tiers use*; the before/after delta in `calls`, `points`, and scene-JS ms **is** that subsystem's measured cost. This is provable without a GPU and shippable.

### 2.2 What is read, at what rate

- **Per frame** (one priority-0 `useFrame`, the frame *sampler*): snapshot `render.calls`, `render.triangles`, `render.points`, `render.lines`, `render.frame` + frame interval (`performance.now()` delta vs. previous sampler run) into the ring buffer; then `renderer.info.reset()`. `renderer.info.autoReset = false` is set once in `onCreated` (and is why the numbers are frame-accurate under the composer — §1.1).
- **Per timed callback**: each scene `useFrame` site is migrated to a shared `useTimedFrame(name, cb)` hook that accumulates `performance.now()` deltas into a per-name bucket. Mechanical, behaviour-neutral, done in Stage 0 so every later stage has attribution for free. Buckets: `dust`, `belts`, `stars`, `planets`, `moons`, `disc`, `camera-rig`, `hud`.
- **Every 500 ms** (interval): compute p50/p95 frame-ms, mean calls/points/triangles, Σ scene-JS ms, React commits/s, and read once: `memory.geometries`, `memory.textures`, `programs.length`. Flush to HUD state. Texture **bytes** come from the `acquirePlanetTextures` registry (exact), cross-checked against `info.memory.textures` (count).

### 2.3 React-side vs GPU-side, separately

- **Scene-JS ms** = Σ timed callback buckets (JS, attributed per subsystem).
- **Frame ms** = rAF interval (total).
- **React commits/s** = a probe child of the scene root whose render body increments a module counter; flushed at 2 Hz. A proxy for "React is re-rendering the 3D tree", cost ≈ 0.
- Interpretation rule printed in the HUD tooltip: high frame-ms + low scene-JS + low calls ⇒ suspect GPU (ablate bloom first, then dpr) ; high frame-ms + high commits/s ⇒ suspect reconciler (confirm in dev with React Profiler); high scene-JS ⇒ ablate the named bucket.
- **Debug ablation row** (gated on `localStorage['deskflow-orbit-debug']`): toggles for dust / belts / stars / bloom / post-FX / moons / hidden-galaxy, each showing its own live delta badge, e.g. `dust −2,000 pts · −1.4 ms JS · −0 calls`. The badge numbers are the per-subsystem cost measurement the app has never had (F10).

### 2.4 Display

Extends the **existing** `FPSCounter` / `FPSLineGraph` overlay in `OrbitControls.tsx` — same container, same visual family; the FPS graph is re-fed from the ring buffer instead of its own `useFrame`. New collapsible "Perf" strip: FPS graph; `frame p50/p95`; `JS (scene)`; `calls`; `points`; `tris`; `textures (live)`; `geometries`; `programs`; `commits/s`; `tier · auto/manual`. Fixed-width numerals, one metric per row, 2 Hz. Dev-only: the ablation row.

### 2.5 Thresholds that trigger a tier change

- **Decline** (automatic, preserved behaviour): p95 frame-ms > 22 ms sustained over three consecutive 500 ms windows (≥3 s) **and** tier above `performance` ⇒ step down one tier, 30 s cooldown, always disclosed (toast, §4).
- **Incline**: never automatic; user-only. This replaces flip-flop with hysteresis.
- drei `PerformanceMonitor` stays mounted as the flip-flop/fallback guard (`flipflops={3}`, `onFallback` → pin `balanced` + disclose); the numeric decline rule above is the single authority for the decision itself, so there is exactly one decision-maker and one display layer (anti-slop rule 4).
- Baseline capture: Stage 0 records all HUD numbers for all three tiers on the reference box; every later stage's "expected saving" is checked against that sheet.

---

## 3. Optimisation plan — ranked by measured-or-derived cost per unit of risk

Each item: mechanism → expected saving → visual cost → rejected alternatives (one line each) → kill criterion. Order below is the ship order.

### O1 — F1: stop paying for the galaxy the user isn't at
**Mechanism:** keep both galaxies mounted (state, textures and buffers resident — no teardown ever), flip `visible` on the two groups: destination group `visible = true` **at flight start**, origin group `visible = false` **at flight completion**. drei `Html` children (the disc toggles) are conditionally rendered on `galaxyType` (React-conditional — drei `Html` is not guaranteed to respect group visibility). All galaxy-scoped `useFrame` work reads a module-level runtime flag (`runtimeFlags.activeGalaxy`, single writer = the same state that drives the camera target) and early-returns for the inactive galaxy. No `setState` in any per-frame path.
**Transition cost (mandated answer):** zero allocation, zero disposal during the 3,250-unit flight — both groups are visible mid-flight exactly as today for the 1–2 s the flight lasts; all flips happen at the endpoints, so the flight animation itself cannot stutter from this change. The origin's motion freezing at *arrival* (callbacks gate then) is sub-perceptual at recede distance `[A — dust is sub-pixel beyond ~1,200 units, §1.3]`.
**Expected saving:** ~½ of scene-graph traversal and culling work; all inactive-galaxy callback bodies (share quantified by the `dust`/`planets`/`moons` JS buckets in Stage 0) `[M]`; GPU draw delta ≈ 0 — the far galaxy is already frustum-culled when behind the camera; **this stage's honest prediction is a CPU win, and the HUD will record the truth about the GPU share** `[M]`.
**Visual cost:** none at rest (sub-pixel arithmetic, §1.3); none mid-flight (both visible).
**Rejected:** mount-only-active (remount during flight = texture/buffer rebuild hitch — exactly the stutter the brief forbids); manual per-frame distance/frustum culling (duplicates three's per-object culling and re-adds per-frame JS); `frameloop` changes (orthogonal — belongs to O7).
**Kill criterion:** if Stage 0 shows galaxy-scoped scene-JS < 0.3 ms, demote O1 to "keep, but never extend it" — the mechanism stays because it is nearly free and O5 depends on the flag.

### O2 — F3 + F2 as one change: de-key the Canvas, re-tune in place
**Mechanism:** remove `perfMode` from the `<Canvas>` `key` (keep `textureRefreshKey` — its user-triggered remount semantics are out of scope and preserved). Fix F2 **in the same change** (anti-slop rule 5): dust buffers allocated once at max tier size, refilled **in place** on count change (`needsUpdate`, `setDrawRange`, `computeBoundingSphere` — §1.4), so `particleCount` becomes a live prop with the memo reading a real dependency. Move the per-cloud particle ternaries out of `GalaxyDust.tsx` into the tier matrix (single source of truth) and pass counts as props. `dpr` is a live prop. `antialias` is a context-creation attribute — immutable after creation `[S — WebGL spec/MDN]` — and is **vestigial under the composer anyway** (the composer renders into its own targets; the canvas' own AA buffer is never presented), so it is set `false` at creation for all tiers with no visual change on any tier `[A]`; AA ownership moves entirely to composer `multisampling` (§4). Composer target recreation on `multisampling` change and bloom mount/unmount cause a bounded one-frame cost — acceptable, measured.
**Expected saving:** tier flips go from (full remount: new WebGL context, all programs recompiled, all planet canvas textures regenerated, hundreds of ms + GC) to (a handful of property changes, typically < 1 dropped frame) `[M]`; also removes context-cap churn `[G]`. This stage's real value: it is the precondition for the entire tier matrix.
**Visual cost:** none at any tier (AA reasoning above); **one disclosed behaviour change**: the camera no longer resets when the user changes tier (today's remount loses it) — an improvement, listed in §4 disclosure.
**Kill criterion / safety:** the flip test (§6 Stage 3) must show `memory.textures` and `programs` returning to baseline within one second of each flip. De-keying removes today's accidental "remount as garbage collector" — which is precisely why §5's contract audits land in the same stage.

### O3 — F4/F5/F6/F9: the tier matrix, for real
**Mechanism:** one constant (`ORBIT_TIERS`) is the single source of truth for every knob in §4; gates render conditionally per subsystem (mount/unmount of that subsystem only — no scene remount, O2 prerequisite). Belts: both (700 pts) / one (300) / off. Stars: 5,000 / 2,500 / 800, twinkle speed 0.08 / 0.04 / 0, keyed remount of the small drei `Stars` component on count change (r3f auto-disposes the old geometry). Bloom: on / on / **off** — at `performance` the composer holds only `ToneMapping`; better, unmount the composer entirely at `performance` and set `gl.toneMapping` (renderer-level ACES, zero extra passes), with a screenshot-parity check; if parity fails visibly, keep composer `ToneMapping` at `performance` (one pass) — the decision rule is the screenshot, not taste. Vignette: high only. Planet cap 80 / 48 / 32 (passed into the render-site slice; data pipeline untouched, no DB changes), moon cap 3 / 2 / 1, moon trails off at `performance`.
**Expected saving:** at `performance` vs today's `balanced`: submitted points 10,200 → ≤ 1,800 (−82 %) `[A]`; bloom chain removed ≈ 10–19M px-ops/frame `[A]`; final blit removed; dpr fill ×0.44 `[A]`. At `balanced` vs today: submitted points ≤ 5,300 (−48 %, with O1) `[A]`; one full-screen pass (vignette) removed. Exact numbers recorded per tier in Stage 0 baseline.
**Visual cost:** everything §4 says the user sees per tier — disclosed in UI, never silent (copy in §4).
**Rejected:** keeping bloom at `performance` (it is the single largest GPU line item `[A]`; baked glow sprites preserve the glow read); `SMAA` addition (new pass for a tier whose goal is fewer passes).
**Kill criterion:** none — the matrix *is* the product decision, signed off via §4/§8.

### O4 — F8 part 1: shared geometry, instanced moons
**Mechanism:** one shared `SphereGeometry` module singleton for all planets (segment counts from the matrix; rebuilt only on tier change — one resource, cheap); each planet keeps its **own material and textures and its own mesh** — picking, hover and the detail panel are untouched by design. Moons become one `InstancedMesh` per solar system with per-instance colour, matrices written by **one** timed callback per system (replacing one callback per moon — up to 240 runtime subscriptions collapse to per-system). Trails remain per-moon at high/balanced, off at performance. `instanceId` → moon record → parent planet mapping specified for any pointer need (audit A3 first — a 25-line `Moon.tsx` very likely has no pointer handlers; if it does, the mapping is implemented; if not, moons are decorative and the mapping is unnecessary).
**Expected saving:** draw calls −(moons − systems) ≈ −100–240 worst case `[A]`; `memory.geometries` from hundreds to single digits `[A]`; moon callback bodies collapse `[A/M]`.
**Visual cost:** none at high; moon counts per matrix at lower tiers (disclosed).
**Rejected:** full planet instancing + texture atlas (breaks per-planet picking and per-planet textures for modest call savings at ≤ 80 meshes — revisit only if the HUD shows calls > 250 at balanced after this stage).
**Sign-off gate:** if instancing is refused (§8), the stage still ships as shared-geometry-only with smaller savings.

### O5 — F7: the `useFrame` diet
**Mechanism and disposition of all 16 sites:** remove the two GalaxyDust bob callbacks outright (a ±0.3-unit drift on a 280-unit-radius cloud is sub-perceptual; they also ran for the invisible galaxy and defeated matrix caching by moving the object every frame — F7's own note). FPS sampling moves from its `useFrame` to the sampler's frame counter + 2 Hz flush. The three `OrbitScene` sites are classified in Stage 0 (audit A4): camera rig keeps its callback; galaxy-scoped ones get the `runtimeFlags` gate from O1. `Planet.tsx` rotation sites keep their callbacks, gated by visibility and reduced-motion. `Ring.tsx` belt/rotation sites are gated by belt on/off and visibility. Net: 16 sites → ~9, and — more importantly — runtime subscriptions stop scaling with the inactive galaxy.
**Expected saving:** −2 sites and their matrix writes immediately; per-bucket scene-JS deltas recorded `[M]`; combined with O1, target ≤ 4 ms scene-JS at balanced `[T]`.
**Visual cost:** dust no longer "breathes" (sign-off item, §8); otherwise none.
**Counter-risk honoured (from §7):** nothing here touches three-side visibility logic, and nothing introduces `setState` — verified by the commits/s probe not increasing (kill criterion).

### O6 — F9 residual: postprocessing accounting
Folded into O3 (bloom/vignette/MSAA/`gl.toneMapping`) — listed separately only to state what was *rejected*: no new postprocessing dependency, no custom pass; `ToneMapping` stays everywhere for colour consistency.

### O7 — reduced-motion & pause → `frameloop="demand"`
**Mechanism:** when `isPaused || prefers-reduced-motion` and no galaxy flight is in progress, set Canvas `frameloop="demand"`; explicit `invalidate()` wiring on: controls change, resize, pointer events (r3f raycasting is event-driven and works in demand mode), data updates, tier change, galaxy switch, HUD settings changes. Under reduced motion also: orbital motion, twinkle and belt rotation stop (speed 0 / gates). Resume restores `frameloop="always"`.
**Expected saving:** the view's idle cost drops from ~60 fps × full scene to ~0 rendered frames while paused/reduced `[A]` — for a dashboard left open all day this is plausibly the largest *real-world* win in the plan, and it costs one state machine.
**Visual cost:** frozen scene — **disclosed, never silent** ("Reduced motion is on…" / "Tracking paused…", §4).
**Rejected:** keeping `always` and skipping work inside callbacks (still wakes the GPU and the compositor every frame).
**Kill criterion:** if drei `Html` or controls damping misbehave in demand mode despite explicit invalidation (manual test), confine demand mode to `isPaused` only.

### O8 — housekeeping, pre-authorised: dead constants
Remove the dead second config block in `OrbitSystem.tsx:15-42` (the `ORBIT_CONFIG` with `baseAngularSpeed = 2.0` vs the live `0.001` — the exact 2000×-discrepancy class anti-slop rule 4 exists for; 10 `noUnusedLocals` errors disappear). `ORBIT_CONFIG` survives in exactly one place. Zero runtime change; scheduled last so it can never be entangled with a perf measurement.

---

## 4. Tier matrix — every knob, every tier

Persisted key unchanged: `localStorage['deskflow-graphics-quality']`; automatic `onDecline` step-down preserved (§2.5 thresholds). Single source: `ORBIT_TIERS`.

| Knob | high | balanced | performance |
|---|---|---|---|
| Dust particles — apps cloud | 6,000 | 2,500 | 1,000 |
| Dust particles — websites cloud | preserved from source (A8) | 2,000 | preserved from source (A8) |
| Hidden galaxy rendered | no | no | no |
| Asteroid belts | 2 (400+300 pts) | 1 (300 pts) | off |
| Starfield count / twinkle speed | 5,000 / 0.08 | 2,500 / 0.04 | 800 / 0 (static) |
| Planets cap (by activity) | 80 | 48 | 32 |
| Moons per planet | 3 | 2 | 1 |
| Moon orbit trails | on | on | off |
| Sphere segments (shared geometry) | 48×32 | 32×24 | 20×14 |
| Planet texture size | 256² | 256² | 256² |
| Bloom | on (current params) | on (current params) | **off** (baked glow sprites remain) |
| Vignette | on | off | off |
| ToneMapping | composer (current) | composer (current) | `gl.toneMapping` (composer unmounted)¹ |
| Composer `multisampling` | 4 | 0 | — (no composer) |
| Canvas `antialias` | false at creation | false | false |
| dpr cap | 1.5 | 1.5 | 1 |
| `frameloop` | always; demand when paused/reduced-motion | same | same |
| Auto-decline floor | — | — | `performance` |

¹ Screenshot-parity check decides composer-ToneMapping-vs-`gl.toneMapping` (O3). Texture resolution is deliberately identical across tiers in v1: a change regenerates every planet texture on flip (hitch) for minor fill saving — revisit only if Stage 0 shows a texture-bound profile.

**What the user sees change** (this text is the disclosure; shown under the quality selector and in the settings surface):
- **High:** "Full detail: both asteroid belts, bloom and vignette, 4× MSAA, all planets and moons."
- **Balanced:** "Recommended. One asteroid belt, half the stars, no vignette, up to 48 planets."
- **Performance:** "Fastest. No belts, no bloom, fewer stars and dust (~1,800 points), 1× resolution, up to 32 planets, one moon each."

**Degradation is never silent (constraint 7):** auto-decline toast — *"Graphics lowered to {tier} to keep the view smooth."* + `Settings` action; the quality pill reads `Performance · auto` while auto-stepped. When the planet cap truncates (user has more tracked entries than the cap), the HUD/legend shows *"Showing top {N} of {total} by activity"*; the planet whose detail panel is open is **exempt** from truncation.

**Motion levels** (Motion skill): *full* (high/balanced, motion enabled — everything animates), *tier-reduced* (fewer particles, same choreography), *paused* (frozen + "Tracking paused — the view is frozen."), *reduced-motion* (frozen + "Reduced motion is on. Orbits and twinkle are paused; you can still explore freely."). Four app states honoured: loading (scene init), empty (no tracked data — existing behaviour), error (**new:** `webglcontextlost` → "The 3D view lost its graphics context." + `Reload view`), populated, plus the degraded state above.

---

## 5. Texture & resource lifecycle — the disposal contract, exactly

1. **Single deleter:** `acquirePlanetTextures` / `releasePlanetTextures` / `disposeAllPlanetTextures` remain the only code path that creates or destroys planet textures. `disposeAllPlanetTextures` is called on OrbitScene unmount (audit A7 verifies the call site exists today; if it does not, this contract adds it — a missing call is a whole-app-window bug, not a cosmetic one).
2. **Acquire on mount, release on cleanup:** every consumer acquires in an effect and releases in the effect's cleanup — including after O4 (planets keep materials/textures, so the contract is unchanged by instancing).
3. **Tier changes never release.** After O2, tier flips allocate nothing and free nothing for planets. Invariant: `memory.textures` identical before and ≥1 s after a tier flip (± tier-only resources like `Stars` geometry).
4. **F2 buffers are permanent residents:** dust position/color arrays are allocated once at max size and refilled in place; the geometry is never disposed on tier change.
5. **Shared geometry singletons** (sphere, instanced moons) are disposed only by the scene-level teardown, never by tier changes; `InstancedMesh` instance buffers are JSX-owned so r3f disposes them on unmount.
6. **Keyed `Stars` remounts** rely on r3f auto-dispose of JSX-owned geometry — verified by the flat-counts probe.
7. **Leak probes, all GPU-free:** (a) unit tests on the registry itself — acquire ×N / release ×(N−1) ⇒ no dispose; ×N ⇒ dispose; pure JS, no renderer; (b) static check: no `new CanvasTexture` outside the registry (grep); (c) runtime: flip tiers ×10 and mount/unmount the view ×3 — `memory.textures`/`memory.geometries` must return to baseline each time (HUD numbers, no debugger).
8. **Context-loss handling:** `webglcontextlost` → the error state of §4, with reload. A leak's blast radius is the whole window; the error state at least makes it survivable and diagnosable.

**Audits folded into the contract stage:** A1 actual planet-canvas sizes (feeds the texture-memory line of the HUD); A2 `camera.far` vs `Stars radius=5000` (if the far plane can't see them, they are pure waste and the matrix numbers are conservative); A3 pointer handlers in `Moon.tsx`; A4 identity of the three `OrbitScene` `useFrame` sites; A5 `FPSCounter` `setState` cadence (must be interval-flushed, never per frame); A6 reference-box dpr/far recorded in the baseline sheet; A7 `disposeAllPlanetTextures` call site; A8 websites-cloud dust counts at high/performance read from source and preserved into `ORBIT_TIERS`.

---

## 6. Migration plan

| Stage | Change | Expected saving | How you know it worked (no GPU needed) | Rollback |
|---|---|---|---|---|
| **0** | Instrumentation only: sampler (`autoReset=false` + read-then-reset), `useTimedFrame` migration, 2 Hz HUD strip, debug ablation row, baseline sheet per tier | 0 — establishes the baseline | HUD shows calls/points/tris/textures/programs/frame p50-p95/scene-JS/commits-s; ablation badges produce per-subsystem numbers | Revert commit; purely additive |
| **1** | O5-lite: remove 2 dust bobs; FPS site → sampler counting | −0.2–0.5 ms scene-JS `[A]`; −2 sites | scene-JS ms ↓ ≥ 0.15 ms; commits/s unchanged; dust drift gone (sign-off §8) | Revert commit |
| **2** | O1: galaxy visibility flip + conditional `Html` + `runtimeFlags` gating | scene-JS −30–50 % of galaxy-scoped buckets `[M]`; traversal ~½ `[A]`; draw-call delta ≈ 0 (recorded truth) | HUD scene-JS ↓; calls/points delta logged (expect ≈ 0); flight test: no hitch, no pop at endpoints | Flag `GALAXY_CULLING=false`; revert commit |
| **3** | O2: de-key Canvas + F2 in-place buffers + `antialias:false` + `ORBIT_TIERS` plumbing | Tier flip: hundreds of ms + context churn → < 1 dropped frame typical `[M]` | Flip ×10: `memory.textures`/`programs` return to baseline ≤ 1 s; camera persists (disclosed change); F2 proof: tier change moves dust drawRange immediately | Revert commit (F2 fix is compatible with the old key and may stay) |
| **4** | O3/O6: full tier matrix + disclosure UI + decline thresholds + (optional, first-run only) `useDetectGPU` default | performance vs today-balanced: ≤1,800 submitted pts (−82 %), bloom −10–19M px-ops/frame, blit removed, dpr ×0.44 fill `[A]`; balanced: ≤5,300 pts, vignette off | Set each tier → HUD numbers match §4 exactly (numeric probe); disclosure toast/pill verified; synthetic load (dev CPU throttle) fires exactly one decline + toast + 30 s cooldown | Per-knob revert = restore old values in `ORBIT_TIERS` (single constant) |
| **5** | O4: shared sphere geometry + instanced moons per system (+ trail cap) | calls −100–240 worst case; `memory.geometries` → single digits `[A]` | HUD calls/`memory.geometries` deltas; hover + detail panel on planets unchanged (manual list); moon `instanceId` mapping test if A3 finds handlers | Revert commit; fallback = shared-geometry-only variant |
| **6** | O7: demand `frameloop` on paused/reduced-motion + motion disclosures | Idle: ~60 fps → ~0 rendered frames while paused `[A]` | Paused ⇒ `info.render.frame` counter freezes (HUD shows it); resume resumes; orbit/zoom responsive in demand mode (manual test) | Flag `DEMAND_FRAMeloop=false`; revert commit |
| **7** | O8: dead `OrbitSystem.tsx` constants removed (pre-authorised) | 0 runtime; kills the 2,000× discrepancy class; 10 TS errors → 0 | `tsc` clean; grep: exactly one `ORBIT_CONFIG` | Revert commit |

**Dependencies:** Stage 4 requires 3 (soft — the matrix functions with the old remount, just with the hitch); 2 requires 1 (flag infra); everything else independent, so reverting any stage never forces reverting an earlier one.
**Safest to ship first:** Stage 0 (additive, no behaviour), then Stage 1. **Most technically risky:** Stage 3 (de-keying removes the accidental remount-as-GC and can surface latent leaks — that is why the §5 probes ride in the same stage and why it ships behind one release of observation). **Most product-sensitive:** Stage 4 (visible, disclosed changes; needs the §4/§8 sign-off).

---

## 7. Risks & mitigations — including the case against this plan

1. **"Culling the invisible galaxy will hitch the 3,250-unit flight."** Mitigated structurally: nothing is mounted or disposed — visibility flips at flight endpoints, both galaxies visible mid-flight exactly as today; the flag gates JS only at arrival. Residual risk (a hole in the vista when orbiting toward the far galaxy) is answered by arithmetic: dust and planets at 3,250 units are sub-pixel (0.17–0.5 px) `[A]` — there is no visible vista to lose. Kill criterion in O1 keeps this honest.
2. **"Instancing breaks picking/hover/detail."** It doesn't, by construction: planets remain individual meshes with their own materials — the entire interactive path is untouched; only moons (decorative, pending audit A3) instance, with a specified `instanceId → parent planet` mapping if handlers exist. Fallback ships in the same stage.
3. **"Aggressive tiering will read as broken, not fast."** Floor values were chosen so `performance` still shows every core data element (all top-32 planets, glow via sprites, full colour pipeline); truncation is disclosed with counts ("top 32 of 80"); auto-decline is toasted; the pill says `auto`. Silent degradation is treated as a bug here, and the copy in §4 is part of the deliverable, not an afterthought.
4. **"Removing per-frame callbacks can make things slower — defeated culling or re-renders."** The plan removes *work*, never three-side visibility logic; the runtime flag is a module read, so no React re-renders are introduced; the HUD's commits/s probe must not increase (O5 kill criterion), and scene-JS ms must decrease — both numeric, both GPU-free.
5. **De-key exposes what remount used to hide.** Today's full remount is an accidental garbage collector; fixing F3 means any existing leak becomes permanent instead of per-flip. This is the strongest argument against Stage 3, and why §5's contract, the flip test, and the leak probes land *in* Stage 3 rather than "later". If the flip test fails, Stage 3 does not ship.
6. **`frameloop="demand"` interactions** (controls damping, drei `Html` freezing while paused): explicit invalidate wiring + the O7 kill criterion confining demand mode to `isPaused` if anything misbehaves.
7. **Platform/constraint compliance:** no overlay or transparent always-on-top window is proposed anywhere in this plan (Wayland/X11 untouched); no DB trigger/schema/migration is touched (data flow is read-only input); no new 3D dependency is added (§1.7 ledger); three honest tiers persist under the existing key with `onDecline` preserved; no file is deleted.

---

## 8. Removals — needs explicit user confirmation

No files are deleted. Three code-level removals/behaviour gates need a nod; the first is already pre-authorised by the brief:

1. **Dead config block, `OrbitSystem.tsx:15-42`** (Stage 7) — pre-authorised ("known-bad items you may fix"); listed for completeness since it is a removal of code. Fallback if refused: rename with a `DEAD_` prefix and `@deprecated`, keep the 10 type errors suppressed locally.
2. **The two dust-bob `useFrame` callbacks in `GalaxyDust.tsx`** (Stage 1) — visual change ≈ zero (±0.3-unit drift on a 280-unit cloud), but it is a behaviour change, so: sign-off requested.
3. **Per-moon `Moon` component usage replaced by per-system instancing** (Stage 5) — `Moon.tsx` the **file stays**; `OrbitTrail` stays in use; the per-moon mesh component would become unused if instancing lands. If refused, Stage 5 ships as shared-geometry-only (smaller saving). Additionally, the **content-visibility gates** in the tier matrix (planet caps 48/32, moon caps 2/1, trails off, belts off, bloom off at `performance`) are product-visible changes bundled into the §4 sign-off.

---

That is the whole plan: measure first, then fix in risk order, disclose every visual step, and prove each stage with numbers the app itself prints. Implementation stops here by design — no code is written until Stage 0's baseline sheet exists.

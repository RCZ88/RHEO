# PROMPT — Context Brain Visualization Redesign (v2)

> **Copy everything below this line into Claude / ChatGPT and send it.**
> It is self-contained: you do not need the repo to answer, though you may ask
> for the file list at the end if you want to read the current source.

---

## Role

You are a **Lead Design Engineer** specializing in real-time data visualization
and generative graphics. Ship a complete, production-quality design + engineering
spec for rebuilding a network graph visualization that currently looks and feels
like a 2004 desktop application.

## The problem, stated plainly

We have a visualization of a user's personal knowledge graph ("Context Brain").
The physics and the underlying idea are genuinely good. **The execution looks
like it was drawn in 1900 and does not appear to move.**

Concretely, what users report:

1. **It does not look alive.** The field renders essentially static. Users
   describe it as a still image, not a system.
2. **It looks like a 1900s app.** Uniform thin grey lines, flat filled circles,
   a legend, hard grid. It reads as engineering debug output, not a product.
3. **Zero depth.** There is a `z` coordinate computed by the force simulation
   that is immediately squashed into a size multiplier. There is no parallax,
   no perspective, no focus. Everything is on one flat plane.
4. **Ambient layer is disconnected wallpaper.** A separate particle field
   drifts behind the graph and knows nothing about it. It reads as two effects
   stacked, not one system.
5. **Repetition.** Uniform-width edges, uniform node sizes, uniform colors.
   Nothing has texture, variation, or hierarchy.

## What already exists (do not rebuild the physics)

The hard parts are written, correct, and must be preserved:

| File | What it is | Status |
|---|---|---|
| `physics/avalanche.ts` | Self-organized-criticality cascade engine. Computes propagation order, per-hop magnitude decay, per-node refractory period. Exports `computeCascade`, `shouldReheat`, `getNodeGlow`, `getEdgeSignal`. | Working. `shouldReheat` was NOT wired up until recently. |
| `physics/noiseField.ts` | Seeded divergence-free **curl noise** (Bridson). Exports `sample`, `noise2D`, `curlNoise`, `biasAt`, `aggregateBias`. | Working. Was completely unused; now consumed by the ambient layer. |
| `BrainGraph.tsx` | Canvas2D graph renderer. Consumes `getNodeGlow`/`getEdgeSignal` from the avalanche engine. | Works. Visually the problem. |
| `NeuralFlow.tsx` | Ambient flow field. Now consumes `sample` + `aggregateBias`. | Works. Too subtle to read. |
| `BrainVisualization.tsx` | Orchestrator. Owns the shared field + activity state, composes both layers, handles empty/loading/error/populated. | Works. |
| `ActivityFeed.tsx` | Avalanche readout list. | Works. |

**Constraint: keep `avalanche.ts` and `noiseField.ts` as-is.** They are the
substance. Your job is the *rendering*, the *composition*, and the *motion*.

## The conceptual spine you must honour

The one idea, which everything else serves:

> **The Context Brain is a network at criticality, and the visualization is the
> readout of that criticality — one generative system with two windows onto it.**

- **Subthreshold** (NeuralFlow): the resting hum, scale-free 1/f "pink noise"
  local field potential (Buzsáki). The same field the graph runs on, just below
  firing threshold. Never decorative noise.
- **Suprathreshold** (the graph): when an entity fires — `state` flips to
  `active`, a fact is queried, an episode lands — a signal propagates outward
  along real edges as a genuine **action potential**: fast depolarizing rise,
  slower decay (Hodgkin-Huxley *shape*, not the equations). Propagation
  **branches probabilistically**; some fires die immediately, occasionally a
  cascade sweeps half the map.

Those are two amplitude bands: a low continuous hum, and rare high-amplitude
transients. **The gap between the bands is the information.** A cascade must read
as an *event*, not blend into wallpaper.

## What we want it to feel like

- **Line quality: Ramón y Cajal's ink drawings.** Sparse, tapering, deliberate
  strokes. Never uniform-width grey wire. A resting edge should be nearly
  invisible; it should *earn* visibility by carrying signal.
- **Fired nodes: Greg Dunn's *Self Reflected*.** A micro-etched reflective
  gold-leaf work where neurons only become visible as light moves across it. In
  2D that means the node must catch light differently depending on depth — a
  specular/Fresnel term keyed to view angle, not a flat opacity tween.
- **Restraint.** This is a page someone reads for minutes. Constant maximal
  motion trains the eye to ignore all of it, including the moments that matter.

## Motion budget

Pick a liveliness level and justify it. We currently believe **L2** is correct
(L1 undersells a system that never cascades; L3 is wallpaper). Confirm or argue
against it.

| Layer | Type | Trigger | Amplitude |
|---|---|---|---|
| Flow-field drift | Ambient | continuous | low, near-constant |
| Node hover / select | Reactive | pointer | instant, local |
| Avalanche propagation | Transitional | data event | high, decays ~1–2s per hop |
| Layout settle after reheat | Transitional | sim alpha threshold | low, brief |

**Reduced motion must be honoured by a single `prefers-reduced-motion` check,
not per-component:** the flow field renders one static sampled frame; avalanches
become instant state snaps with no traveling pulse; hover/select are unaffected.

## The four states — all four, explicitly

- **Empty** — not a blank canvas with a caption. One still neuron in the Cajal
  line style, alone at center, breathing at the ambient rate. It should look like
  a network *waiting*, not an error.
- **Loading** — no bare spinner. The ambient field is procedural and needs zero
  data, so it renders **immediately**; nodes and edges compose in over it as
  `brain:get-entities` / `brain:get-facts` resolve. The brain warms up.
- **Error** — desaturate the substrate, freeze propagation (no new avalanches
  spawn), keep the last-known layout visible and static. A flatline, not a crash
  screen. Small inline retry, no red alarm iconography.
- **Populated** — full system, both layers live, stats overlay present.

## Palette

No new hues. The existing `ACCENTS` already contain the right split:

- **Substrate** (resting): `zinc-950` base, `purple #8b5cf6` at low alpha.
- **Spike** (firing): `amber #f59e0b`. A warm flash against the cool substrate is
  the cheapest, highest-contrast way to make "something just fired" unmistakable.
  **Amber is reserved exclusively for active propagation.** If a type color also
  uses amber, use amber only as an *additive overlay glow*, never as base fill.
- Everything else (`green`, `cyan`, `rose`, `slate`) stays exactly as
  `TYPE_COLORS` defines. Entity-type color is identity; spike-amber is event.

## Hard technical requirements

1. **The ambient layer must be data-driven.** Bias the curl-noise field by the
   settled node positions and their degree, recomputed **only when the simulation
   `alpha` drops below a threshold**, not every frame. Dense regions pull the
   flow harder. This is what makes the background *about* the data.
2. **Decouple physics tick rate from render rate.** Throttle `d3-force-3d` ticks
   to ~12–15fps and interpolate node positions so rendering stays smooth at 60fps.
   Physics does not need 60fps to look correct.
3. **Criticality-coupled reheat, never a wall clock.** Reheat the simulation
   proportional to recent avalanche size. `shouldReheat()` in `avalanche.ts`
   already implements this — use it. A self-organized-critical system is
   driven-dissipative: quiet unless perturbed, *not* perturbed every 8 seconds.
4. **Make `z` mean something.** Options, in preference order:
   - **Preferred:** migrate to WebGL via `@react-three/fiber` + `drei` +
     `@react-three/postprocessing`. Real GPU bloom on a selective layer, true
     camera-space depth with parallax, and a real specular term. `three`,
     `@react-three/fiber`, `@react-three/drei` and `@react-three/postprocessing`
     are **already dependencies** of this project — this is not a new dependency.
   - **Plan B (if WebGL is out of scope):** stay on Canvas2D — render the glow
     layer at half resolution, box-blur 2–3 passes, composite with
     `globalCompositeOperation = 'lighter'`. Works, known technique; no true
     depth-of-field or specular.
   State which you are specifying and why.
5. **Batch the edges.** One `InstancedMesh`/`Line2` batch under R3F, or a single
   path batch under Plan B — not a per-frame `ctx.stroke()` per edge with an
   O(n²) loop. Target 300+ nodes at 60fps.
6. **Scaling path.** Past ~300–500 nodes, the tick loop is a reasonable Web
   Worker candidate. Flag it, don't build it.

## Known problems to design around

- **WebGL is not available in every environment this ships to** (VMs, remote
  desktops, blocklisted drivers). `new WebGLRenderer()` throws *inside a
  commit-phase effect* and unwinds the React subtree. Whatever you specify must
  have a Canvas2D fallback that is **designed**, not a `return null`.
- There is a duplicate legacy `CanvasGraph.tsx` still in the tree. Delete it or
  fold it in; do not leave two renderers.

## Deliverable

Return a single markdown document, structured as:

1. **The one design idea** — stated in 2–3 sentences, and how it maps to
   subthreshold vs suprathreshold.
2. **Visual specification** — node treatment (resting / firing / selected /
   hovered), edge treatment (resting / carrying signal), ambient field, spacing,
   scale of the whole composition. Be specific enough that two engineers produce
   the same pixels.
3. **Motion spec** — liveliness level + justification, a table of
   layer/type/trigger/amplitude/decay, and the reduced-motion behavior.
4. **The four states**, each described visually.
5. **Technical architecture** — renderer choice (R3F or Plan B) with reasoning,
   component tree with props, data flow from `brain:get-entities` +
   `brain:get-facts` + `brain:stats` into `{ nodes, links }`, and the
   `activity: { nodeId, magnitude, timestamp }[]` diff that is the **only** input
   the avalanche engine needs.
6. **Implementation plan** — ordered, file-by-file, each step independently
   shippable and independently revertable.
7. **Risks / what could go wrong** — be honest about performance, the WebGL
   fallback, and what to cut first if it runs late.
8. **References** — the science and technique behind each choice.

**Do not write application code in this document.** Design + engineering spec
only, the way the previous version was.

## Requested output format

A markdown file you can save as `RESULT.md`. Follow the structure of the
previous spec (`brain-visualization-redesign-31082026/RESULT.md`) — it was
approved, so match its register: opinionated, specific, technically credible, no
filler.

---

### Optional: read the current source first

If you have repo access, these are the files that matter:

```
src/features/warmth/context-brain/BrainVisualization.tsx   orchestrator
src/features/warmth/context-brain/BrainGraph.tsx          graph renderer (the problem)
src/features/warmth/context-brain/NeuralFlow.tsx          ambient layer
src/features/warmth/context-brain/ActivityFeed.tsx        avalanche readout
src/features/warmth/context-brain/physics/avalanche.ts    KEEP AS-IS
src/features/warmth/context-brain/physics/noiseField.ts   KEEP AS-IS
src/features/warmth/context-graph/types.ts                TYPE_COLORS, GraphNode
```

You do not need them to produce the spec. You need them only to be specific.
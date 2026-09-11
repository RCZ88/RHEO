# Avalanche — A Criticality-Driven Brain Visualization

*Design + engineering spec for NeuralFlow + CanvasGraph, Life → Self page*

---

## 1. Design Concept — The One Idea

Real cortical networks don't hum along at a constant, decorative buzz. They sit at a **critical point** between order and chaos — mostly quiet, occasionally cascading. This is not a metaphor invented for this brief; it's a measured property of real brains, first characterized by Beggs & Plenz (2003) as **neuronal avalanches**: bursts of activity that propagate through a network with a *power-law* size distribution — many tiny ripples, a few sweeping cascades, almost never something in between. Systems poised at this critical point are the ones capable of both stability and rapid, network-wide information transfer. It's the physical reason your brain can idle and still snap to attention.

**The one idea: your Context Brain is a network at criticality, and the visualization is the readout of that criticality — not two effects, one generative system with two windows onto it.**

Concretely:

- **NeuralFlow** renders the *subthreshold* regime — the aggregate electrical hum of a resting network, the same phenomenon EEG measures as scale-free "pink noise" (1/f) local field potential (Buzsáki, *Rhythms of the Brain*). It should never be decorative noise; it's the same field the graph runs on, just below firing threshold.
- **CanvasGraph** renders the *suprathreshold* regime — when an entity actually fires (state flips to `active`, a fact is queried, an episode lands), a signal propagates outward along real edges as a genuine **action potential**: a fast depolarizing rise and a slower decay, not a linear fade. The propagation *branches* probabilistically along the graph — some fires die immediately, one in a while a cascade sweeps half the map. That's the avalanche, and it's what makes the graph feel alive instead of animated.

Both layers read the same noise field and the same activity state. That's the mechanism that turns "ambient backdrop + separate card" into one organism.

**Visual style reference, not just physics:** the line quality should borrow from Ramón y Cajal's ink drawings of neurons — sparse, tapering, deliberate strokes, not uniform-width grey wire. And the way a fired node should *look* — not just glow brighter, but catch light differently depending on depth — borrows from Greg Dunn's *Self Reflected*, a gold-leaf brain artwork micro-etched so individual neurons only become visible as light moves across it. In 3D that's a cheap trick (a specular term keyed to viewing angle); it reads as far more alive than a flat opacity tween.

---

## 2. Visual Spec

**Palette** — no new hues needed; the existing `ACCENTS` already contain the right split:
- **Substrate** (resting): `zinc-950` base, `purple #8b5cf6` at low alpha — the cool, quiet field.
- **Spike** (firing): `amber #f59e0b` — a warm flash against the cool substrate is the single highest-contrast, lowest-cost way to make "something just fired" unmistakable at a glance. Reserve amber *exclusively* for active propagation; if `TYPE_COLORS` also uses amber for `person` nodes, disambiguate by using amber only as an *additive overlay glow*, never as the base node fill.
- Everything else (`green`, `cyan`, `rose`, `slate`) stays exactly as `TYPE_COLORS` defines it — entity-type color is identity, spike-amber is event.

**Typography** — unchanged: Inter (body/labels), JetBrains Mono (stats, unchanged monospace treatment but see "populated state" below), Geist (page-level display heading only).

**Motion level: L2**, not L1 or L3.
- L1 (near-static) undersells the concept — a network at criticality that never cascades looks broken, not calm.
- L3 (constant high-amplitude motion) is wrong for a data page someone reads for minutes at a time; constant maximal motion trains the eye to ignore all of it, including the moments that matter.
- L2 gives you two clearly separated amplitude bands: a **low, continuous ambient layer** (the flow field's resting hum) and **rare, high-amplitude transients** (avalanches). The gap between those two bands *is* the information — it's what lets a real cascade read as an event instead of blending into visual wallpaper.

**Motion taxonomy mapping:**
| Layer | Type | Trigger | Amplitude |
|---|---|---|---|
| Flow field drift | Ambient | continuous | low, near-constant |
| Node hover / select | Reactive | pointer | instant, local |
| Avalanche propagation | Transitional | data event (query, new fact, state flip) | high, decays over ~1–2s per hop |
| Layout settle after reheat | Transitional | simulation alpha threshold | low, brief |

**Four states:**

- **Empty** — not a blank canvas with a caption. One still, single neuron rendered in the Cajal line style, alone at center, breathing at the ambient rate with nothing to connect to. It should look like a network *waiting*, not an error.
- **Loading** — no bare spinner. The ambient flow field is procedural and needs zero data, so it can render and fade in *immediately*; nodes and edges compose in over it as `brainGetEntities`/`brainGetFacts` resolve. The brain "warms up" rather than the UI stalling.
- **Error** — desaturate the substrate, freeze propagation (no new avalanches spawn), keep the last-known layout visible and static. The metaphor is a flatline, not a crash screen: quiet and legible, small inline retry, no red alarm iconography.
- **Populated** — full system, both layers live, stats overlay present.

**Reduced motion:** respected globally via a single `prefers-reduced-motion` check, not per-component:
- Flow field renders one static sampled frame of the noise function instead of animating it.
- Avalanches become instant state snaps (fired/not-fired) with a plain opacity or color transition — no traveling pulse.
- Hover/select reactive states are unaffected (they're already near-instantaneous and low-amplitude).

---

## 3. Technical Architecture

### Rendering strategy: migrate to WebGL via react-three-fiber

The current CanvasGraph already computes `z`/`vz` per node via `d3-force-3d` and throws it away — Known Gap #3 in the brief. Separately, this same project is already speccing a 3D neural-network context-graph rebuild on **R3F + drei + postprocessing** elsewhere in the codebase. Building *this* redesign as a second, disconnected 2D canvas system would mean shipping the 3D version twice, on two different rendering stacks, with two different bug surfaces. Build it once, on the stack you're already committing to.

That gets you three things essentially for free:
1. **Real bloom.** `@react-three/postprocessing`'s `<Bloom>` with a selective layer is actual GPU bloom on firing nodes — not a canvas double-buffer-and-blur hack.
2. **A depth axis that means something.** The `z` coordinate becomes camera-space depth with real parallax instead of a discarded number.
3. **A specular/Fresnel term** on node materials keyed to view angle — the Greg Dunn "catches the light" effect — is a few lines of shader material, not a new rendering pipeline.

If a WebGL migration is out of scope for this pass, **Plan B** keeps everything on Canvas2D with zero new dependencies: render the glow layer at half resolution, box-blur it 2–3 passes (cheap approximation of Gaussian blur), and composite with `globalCompositeOperation = 'lighter'` for additive glow. It works and it's a known technique — it just won't get true depth-of-field or the specular trick.

### Data flow

One hook, `useBrainGraph()`, composes `brain:stats` + `brain:get-entities` + `brain:get-facts` into the existing `{ nodes, links }` shape — no IPC changes needed, per the fixed-channel constraint.

A second, thin piece of derived state — `activity: { nodeId, magnitude, timestamp }[]` — is computed as a diff between the previous and current `state` field per entity (`neutral → active` is a fire event). This is the *only* input the avalanche engine needs; it never touches raw IPC data directly.

The ambient flow field reads a coarse spatial hash of settled node positions + degree (recomputed only when simulation `alpha` drops below threshold, not every frame) to bias noise locally near dense regions of the graph — this is what makes NeuralFlow actually *about* the brain data instead of independent decoration.

### Performance (300+ nodes, current O(n²) edge loop)

- Decouple physics tick rate from render rate: throttle `d3-force-3d` ticks to ~12–15fps (physics doesn't need 60fps to look correct), interpolate node positions for a smooth 60fps render regardless.
- If migrating to R3F: edges as one `InstancedMesh`/`Line2` batch, not a per-frame `ctx.stroke()` loop — GPU-batched, no O(n²) redraw cost.
- Replace the blind 8-second reheat `setInterval` with a **criticality-coupled reheat**: only reheat the simulation proportional to recent avalanche size. Real self-organized-critical systems are driven-dissipative — quiet unless perturbed, not perturbed on a wall clock. This ties the "breathing" motion to the physics concept instead of being an arbitrary timer, and it's also just fewer wasted ticks when nothing happened.
- If node count grows meaningfully past ~300–500, the `d3-force-3d` tick loop is a reasonable Web Worker candidate — flagging as a scaling path, not required now.

### Component API

```tsx
interface BrainVisualizationProps {
  nodes: GraphNode[]
  links: GraphLink[]
  activity?: { nodeId: string; magnitude: number; timestamp: number }[]
  width: number
  height: number
  state: 'empty' | 'loading' | 'error' | 'populated'
  livelinessLevel?: 'L1' | 'L2' | 'L3'   // default 'L2'
  reducedMotion?: boolean                // falls back to prefers-reduced-motion
  onNodeHover?: (node: GraphNode | null) => void
  onNodeClick?: (node: GraphNode) => void
  hoveredNode?: GraphNode | null
  selectedNode?: GraphNode | null
  selectionSet?: Set<string>
}
```

One orchestrator component owns the shared noise field and activity state and composes the ambient + graph layers underneath it — nothing external reaches into either layer independently, which is what actually enforces "one system" rather than just styling two things to match.

### Dependencies

`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` — flagged as the one exception to zero-new-deps, justified by the fact that they're being adopted elsewhere in this same codebase for the same underlying data. If that's not true yet in practice, this is the one dependency worth taking. Everything else in this spec (avalanche engine, curl-noise field, criticality-based reheat) is plain TypeScript/math, no libraries.

---

## 4. Implementation Plan

1. **`context-brain/physics/avalanche.ts`** *(new)* — SOC cascade engine. Given a fire origin + graph, computes propagation order, per-hop magnitude decay, and a refractory window per node (a node that just fired can't re-fire immediately — this is what keeps cascades from looping forever and is also biologically real).
2. **`context-brain/physics/noiseField.ts`** *(new)* — shared, seeded curl-noise flow field (divergence-free, so particles never clump or fountain unnaturally — see Bridson's curl noise technique in references). Exposes `sample(x, y, t)` and `biasAt(x, y, strength)` for the data-driven perturbation.
3. **`context-graph/types.ts`** — one additive, non-breaking field: `lastFiredAt?: number` on `GraphNode`, derived at runtime, never persisted.
4. **`context-brain/NeuralFlow.tsx`** — rewritten to consume `noiseField.ts` and bias from live node positions/degree, replacing the current disconnected procedural noise. If migrating renderer, becomes a GPU point field.
5. **`context-brain/CanvasGraph.tsx`** — consumes `avalanche.ts` for spike rendering; if migrating, becomes `BrainGraph.tsx` on R3F with instanced edges, actual `z` usage, and the bloom/specular material.
6. **`context-brain/BrainVisualization.tsx`** *(new)* — the orchestrator; owns the shared field + activity state, exposes the API in §3, composes both layers and all four states.
7. **`ContextGraphView.tsx`** — swap in `BrainVisualization`, wire the empty/loading/error/populated states through it.
8. **Verification pass** — `BrainGrowthChart`, `ContextRetrievalPanel`: confirm no shared canvas context, z-index, or paint-order conflicts. No code change expected here; this is a check, not a task.

---

## 5. MCP Component Table

| Need | Source | Component | Notes |
|---|---|---|---|
| Signal traveling along an edge | Magic UI | `AnimatedBeam` | re-time its curve to a fast-rise/slow-decay action-potential shape rather than the default linear/ease timing |
| Ambient particle reference | Magic UI | `Particles` | API shape reference only — actual field is the data-driven curl-noise system, not decorative particles |
| Populated-state entity/fact counts | 21st.dev (Data Visualization) | number ticker component | pairs with the existing JetBrains Mono stats overlay |
| 3D graph primitives | 21st.dev (3D React) / drei | `Line2`, instancing helpers | for the R3F edge/node batch |
| Bloom + selective glow | `@react-three/postprocessing` | `<Bloom>` on a selective layer | firing nodes only — resting nodes never bloom, which is what keeps the contrast meaningful |
| Empty/error iconography | Lucide | `Brain`, `ZapOff`, `AlertCircle` | consistent with existing icon usage; used sparingly, not as the primary empty/error visual |

---

## References — the science and technique behind the concept

- **Beggs, J. & Plenz, D. (2003)**, *Neuronal Avalanches in Neocortical Circuits* — the power-law cascade behavior this whole concept is built on.
- **Buzsáki, G.**, *Rhythms of the Brain* — resting-state 1/f ("pink noise") local field potential; the basis for the ambient layer's statistics.
- **Hodgkin, A. & Huxley, A. (1952)** — the original quantitative model of the action potential's fast-rise/slow-decay shape; use the *shape*, not the full differential equations, for the pulse timing curve.
- **FitzHugh–Nagumo model** — a simplified, cheap-to-compute excitable-media model; if the full Hodgkin–Huxley curve is too expensive per-frame, this is the standard real-time substitute and is what most "excitable media" shader art actually runs.
- **Bridson, R.**, *Curl Noise for Procedural Fluid Flow* (SIGGRAPH) — divergence-free noise fields; the correct math for a flow field that looks organic instead of particles drifting into clumps.
- **Ramón y Cajal, S.** — his ink drawings of neurons are the line-quality reference: sparse, tapering, intentional, never uniform-width wire.
- **Dunn, G.**, *Self Reflected* — micro-etched reflective gold-leaf brain artwork; the reference for view-angle-dependent shimmer on fired nodes.

No code has been written or modified — this is the design and architecture spec only, per the brief.
# Avalanche — A Criticality-Driven Brain Visualization

> Design + engineering spec for NeuralFlow + CanvasGraph, Life → Self page.
> Target: the Self subpage brain visualization.

---

## 1. Design Concept — The One Idea

Real cortical networks sit at a **critical point** between order and chaos — mostly quiet, occasionally cascading. This is a measured property of real brains (Beggs & Plenz 2003): **neuronal avalanches** — bursts of activity propagating through a network with a *power-law* size distribution. Systems poised at criticality are capable of both stability and rapid network-wide information transfer.

**The one idea: your Context Brain is a network at criticality, and the visualization is the readout of that criticality — one generative system with two windows onto it.**

- **NeuralFlow** renders the *subthreshold* regime — the resting aggregate hum, scale-free "pink noise" (1/f) local field potential (Buzsáki). Never decorative; it's the same field the graph runs on, just below firing threshold.
- **CanvasGraph** renders the *suprathreshold* regime — when an entity fires (state → `active`, fact queried, episode lands), a signal propagates along real edges as a genuine **action potential**: fast depolarizing rise, slower decay (not linear fade). Propagation *branches* probabilistically — some fires die immediately, one in a while a cascade sweeps half the map. That's the avalanche.

**Visual references:** Ramón y Cajal's ink drawings (sparse, tapering, deliberate strokes; not uniform grey wire); Greg Dunn's *Self Reflected* (a node catches light differently by depth — cheap specular term keyed to view angle, far more alive than flat opacity).

---

## 2. Visual Spec

**Palette** — no new hues; reuse existing `ACCENTS`:
- **Substrate** (resting): zinc-950 base, purple `#8b5cf6` at low alpha — cool quiet field.
- **Spike** (firing): amber `#f59e0b` — warm flash against cool substrate = highest-contrast "something fired." Reserve amber *exclusively* for active propagation (additive overlay glow, never base node fill) to disambiguate from `TYPE_COLORS` amber person nodes.
- Everything else (green, cyan, rose, slate) stays as `TYPE_COLORS` defines — entity-type color is identity, spike-amber is event.

**Typography** — unchanged: Inter (body/labels), JetBrains Mono (stats), Geist (page display heading).

**Motion level: L2** (not L1, not L3).
- L1 undersells — a network at criticality that never cascades looks broken.
- L3 wrong for a data page read for minutes — constant maximal motion teaches the eye to ignore everything.
- L2 gives two clearly separated amplitude bands: low continuous ambient layer + rare high-amplitude transients. **The gap between the bands is the information.**

**Motion taxonomy:**
| Layer | Type | Trigger | Amplitude |
|---|---|---|---|
| Flow field drift | Ambient | continuous | low, near-constant |
| Node hover / select | Reactive | pointer | instant, local |
| Avalanche propagation | Transitional | data event (query, fact, state flip) | high, decays ~1–2s per hop |
| Layout settle after reheat | Transitional | sim alpha threshold | low, brief |

**Four states:**
- **Empty** — one still Cajal-style neuron alone at center, breathing at the ambient rate. A network *waiting*, not an error.
- **Loading** — no bare spinner. Flow field renders/fades immediately (procedural, zero data); nodes/edges compose in as IPC resolves. Brain *warms up*.
- **Error** — desaturate substrate, freeze propagation, keep last-known layout static. A flatline, not a crash screen: quiet, legible, small inline retry.
- **Populated** — full system, both layers live, stats overlay.

**Reduced motion** — single global `prefers-reduced-motion` check:
- Flow field = one static sampled frame.
- Avalanches = instant state snaps (opacity/color transition, no traveling pulse).
- Hover/select unaffected (already near-instant, low-amplitude).

---

## 3. Technical Architecture

### Rendering strategy: migrate to WebGL via react-three-fiber

CanvasGraph already computes `z`/`vz` per node via `d3-force-3d` and discards it (Known Gap #3). The same project is speccing a 3D neural-network context graph on **R3F + drei + postprocessing**. Build this once, on the stack already being committed to — avoids shipping the 3D version twice on two bug surfaces.

Free wins:
1. **Real bloom** — `@react-three/postprocessing` `<Bloom>` on a *selective layer* (firing nodes only).
2. **A depth axis that means something** — `z` becomes camera-space depth with real parallax.
3. **Specular/Fresnel** on node materials keyed to view angle — the Greg Dunn effect in a few lines.

**Plan B (no WebGL):** keep Canvas2D, zero new deps — glow layer at half resolution, box-blur 2–3 passes, composite with `globalCompositeOperation = 'lighter'` for additive glow. No real depth-of-field or specular.

### Data flow

One hook `useBrainGraph()` composes `brain:stats` + `brain:get-entities` + `brain:get-facts` into `{ nodes, links }` — no IPC changes.

Derived `activity: { nodeId, magnitude, timestamp }[]` = diff of prior/current `state` per entity (`neutral → active` = fire). The **only** input the avalanche engine needs.

Ambient flow field reads a coarse spatial hash of settled node positions + degree (recomputed only when sim `alpha` drops below threshold) to bias noise near dense regions — makes NeuralFlow *about* the data.

### Performance (300+ nodes, current O(n²) edge loop)

- Decouple physics tick from render: throttle `d3-force-3d` ticks to ~12–15fps, interpolate positions for smooth 60fps.
- R3F: edges as one `InstancedMesh`/`Line2` batch, not per-frame `ctx.stroke()`.
- Replace blind 8-second reheat `setInterval` with **criticality-coupled reheat** — reheat proportional to recent avalanche size (driven-dissipative, not a wall clock).
- Past ~300–500 nodes, `d3-force-3d` tick loop is a Web Worker candidate (scaling path, not required now).

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

One orchestrator owns the shared noise field + activity state and composes both layers — nothing external reaches either layer independently (enforces "one system").

### Dependencies

`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` — the one exception to zero-new-deps, justified by adoption elsewhere in the codebase. Everything else (avalanche engine, curl-noise field, criticality reheat) is plain TS/math.

---

## 4. Implementation Plan

1. **`context-brain/physics/avalanche.ts`** *(new)* — SOC cascade engine: fire origin + graph → propagation order, per-hop magnitude decay, refractory window per node (fired node can't re-fire immediately — prevents infinite loops, biologically real).
2. **`context-brain/physics/noiseField.ts`** *(new)* — shared seeded curl-noise flow field (divergence-free — Bridson curl noise). `sample(x, y, t)` and `biasAt(x, y, strength)`.
3. **`context-graph/types.ts`** — one additive non-breaking field: `lastFiredAt?: number` on `GraphNode`, derived at runtime, never persisted.
4. **`context-brain/NeuralFlow.tsx`** — rewritten to consume `noiseField.ts` + bias from live node positions/degree. If migrating renderer → GPU point field.
5. **`context-brain/CanvasGraph.tsx`** — consumes `avalanche.ts` for spike rendering; if migrating → `BrainGraph.tsx` on R3F with instanced edges, real `z`, bloom/specular.
6. **`context-brain/BrainVisualization.tsx`** *(new)* — orchestrator; owns shared field + activity state, exposes the §3 API, composes both layers + all four states.
7. **`ContextGraphView.tsx`** — swap in `BrainVisualization`, wire empty/loading/error/populated through it.
8. **Verification pass** — `BrainGrowthChart`, `ContextRetrievalPanel`: confirm no shared canvas context, z-index, or paint-order conflicts. Check, not a task.

---

## 5. MCP Component Table

| Need | Source | Component | Notes |
|---|---|---|---|
| Signal traveling along an edge | Magic UI | `AnimatedBeam` | re-time to fast-rise/slow-decay action-potential shape |
| Ambient particle reference | Magic UI | `Particles` | API shape reference only — actual field is data-driven curl-noise |
| Populated-state entity/fact counts | 21st.dev (Data Visualization) | number ticker | pairs with JetBrains Mono stats overlay |
| 3D graph primitives | 21st.dev (3D React) / drei | `Line2`, instancing helpers | R3F edge/node batch |
| Bloom + selective glow | `@react-three/postprocessing` | `<Bloom>` selective layer | firing nodes only — resting nodes never bloom |
| Empty/error iconography | Lucide | `Brain`, `ZapOff`, `AlertCircle` | sparingly; not primary empty/error visual |

---

## References

- **Beggs & Plenz (2003)**, *Neuronal Avalanches in Neocortical Circuits* — power-law cascade behavior.
- **Buzsáki**, *Rhythms of the Brain* — resting 1/f pink-noise LFP; ambient layer statistics.
- **Hodgkin & Huxley (1952)** — action potential fast-rise/slow-decay shape (the *shape*, not full ODEs).
- **FitzHugh–Nagumo** — cheap excitable-media substitute if Hodgkin–Huxley too expensive per-frame.
- **Bridson**, *Curl Noise for Procedural Fluid Flow* (SIGGRAPH) — divergence-free noise.
- **Ramón y Cajal** — ink-drawing line quality: sparse, tapering, intentional.
- **Dunn**, *Self Reflected* — view-angle-dependent shimmer on fired nodes.

---

## Status

Spec saved. Implementation NOT started (pending verification of base brain render + design-skill load).

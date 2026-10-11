# PROMPT — Research, then design ONE comprehensive overhaul of the DeskFlow "Solar System" visualization

**Target AI:** Claude (or GPT-4 / Gemini — the brief is model-agnostic)
**Required output:** a single `RESULT.md`, described in §Output below.

---

## Raw Request (verbatim — this is the user's actual words, do not re-interpret or soften it)

> "instead of jut like using particals to repsent a whole solar sytem and stuf, i think we can do better then that idk? how cna we improve the solar system"

> "gneerate a prompt that can aks an ia to think and researhch abotu that"

Framing complaints from the same user, immediately before:

> "the things that is unsync is like hte isdbear with the dahsbaord also like the heatmap with teh actual data, and like other stuff lie the visualizaiton of the solar system shit"

---

## Context — the "why" and the "where"

DeskFlow is an Electron + React + SQLite desktop time tracker. Its Dashboard renders a
WebGL 3D **solar system**: every tracked app is a planet, every app *category* is its own
solar system, planet size = time spent, orbit radius = rank, colour = category family. The
user reaches it from one dashboard button, which opens a 500 px modal (or fullscreen).

Two things are wrong with it, and they are equally important:

1. **It is visually unsatisfying.** It reads as "a bunch of particles pretending to be a
   solar system". The user's own instinct is that the metaphor is being served by a
   cheap trick rather than by design.
2. **It is not trustworthy.** It aggregates from a different table, on a different clock,
   than the rest of the Dashboard. A visualization that looks impressive while disagreeing
   with the Activity page is worse than no visualization.

**Read `CONTEXT_BUNDLE.md` FIRST and treat it as the codebase.** You do not have this repo.
It contains the real source, the real numbers, the real data pipeline, the design
constitution, and a table of eight known-live defects. Do not ask for files. Do not invent
APIs that are not in the bundle.

---

## The Mandate

Act as **Lead Designer and Engineer** for this one surface. You own the whole solution:
the information design, the 3D art direction, the motion language, the interaction model,
the performance strategy, and the data-correctness plan.

**Deliver ONE design. Not a menu.** No "Option A / Option B / Option C", no
"here are three directions, pick one". Pick the strongest answer, justify it against the
alternatives you rejected in one line each, and specify it completely.

### Phase 0 — RESEARCH FIRST (do not skip; this is explicitly requested)

Before designing anything, spend real effort on outward research and **cite what you
found**. Use web search. Cover at least:

- **Metaphor alternatives to "solar system"** for hierarchical, time-weighted categorical
  data in 3D/2.5D. Consider and evaluate at minimum: gravitational/field layouts, radial
  "habitat rings", a treemap-in-3D, a "constellation" graph, an orbital
  **network/force** layout, isometric city/architecture, and layered concentric
  "depth" views. State which one you chose and why the solar system metaphor loses.
- **Real precedents** in serious data visualization that encode magnitude + hierarchy
  spatially. Name specific pieces of work (NASA/JPL visualisations, observablehq,
  Datawrapper, NYT/Guardian interactives, Kepler/HDR-era astronomy UI, flight-log
  viewers, IDE "activity universe" style views) and say what is *transferable* to this.
- **Technical:** instanced rendering for 10k–100k marks in three.js
  (`InstancedMesh` vs `BatchedMesh` vs `Points` vs GPU-driven), label decluttering and
  collision avoidance for spatial labels, picking at scale (GPU picking vs raycast),
  `@react-three/drei` / `three` / `@react-three/postprocessing` capabilities relevant to
  large scenes, and whether a **custom `ShaderMaterial`** is worth it here.
- **Motion & accessibility:** reduced-motion fallbacks for a continuously-animating
  scene, and how to make an orbiting scene legible without animation.
- **Colour:** perceptual/sequential/diverging colour systems for magnitude; how to keep a
  data scene legible in **both** dark and light themes.

Every research claim must be traceable: link or name the source. If you are reasoning from
general knowledge rather than a source, label it as such.

### Phase 1 — Data correctness plan (before any visual design)

The bundle's §2b and §7 list the defects. Produce a concrete plan that answers:

- **One clock.** The solar system must bucket days the same way the Dashboard heatmap
  does (local) or the heatmap must change — you choose, you justify, and you state the
  migration cost for `stats_daily`/`stats_hourly` (a SQLite trigger: `DATE(NEW.timestamp)`).
- **One table.** Decide whether the solar system reads raw `logs` or the pre-aggregated
  `stats_daily`, and what is lost/gained either way (per-planet session counts, per-hour
  data, and categories are only available in the aggregate path).
- **Truth guarantees.** Any number the user can read off this view must be reconcilable
  with the Activity page. Specify a **verification procedure** — a written check a
  developer can run that proves the two agree to the second, and what to do when they
  don't.
- **Honest empty/partial states.** What does the view do with 3 apps? 300 apps? One app
  with 40 hours and 200 apps with 4 minutes each? Design the **long tail** explicitly —
  the current model silently drops everything under `MIN_PLANET_TIME_SECONDS` (30 s).

### Phase 2 — Information design

- What is the primary question the user should be able to answer in 5 seconds by looking
  at this? (Currently: "how much time did I spend, split by app and category" — argue
  whether that is the right question for a *Dashboard*, and if not, what it should be.)
- Define every visual channel and exactly what it encodes. Give the mapping table.
- Specify how **magnitude** is encoded such that it survives greyscale, colour-vision
  deficiency, and a projector. (Guidance from the house design system: on data surfaces
  colour means *tier*, never *identity*; magnitude is opacity of one hue.)
- Specify typography, spatial hierarchy, and where labels live so they never collide.
- Design the **legend**, the **detail panel**, and the **tooltip/readout**.
- Specify **light mode**. A pure-black space scene must still be a first-class citizen.

### Phase 3 — Visual specification, pixel-exact

Do not describe it; specify it.

- Exact hex/rgb values (with the LAMINAR constraint: monochrome zinc chrome, one signal hue
  per surface; no decorative gradients or glow on chrome; radii 8/12/pill only;
  Inter + JetBrains Mono + Space Grotesk, max 2 families per view).
- Camera: default position, target, FOV, near/far planes, min/max distance, damping.
- Every object's geometry and scale, in world units, with the reasoning for the numbers.
- Materials: which, with parameters (roughness/metalness/emissive intensity/opacity/
  blending/depth-write). Be explicit about `AdditiveBlending` usage and its cost.
- Postprocessing chain: exact effects, parameters, and what is dropped in each `perfMode`
  tier. Note the existing chain is `Bloom + ToneMapping + Vignette` with
  `multisampling` gated to `high`.
- **All four states are mandatory:** loading, empty, error, populated. Give the real copy
  for each, matching the existing register (the current WebGL fallback at
  `OrbitSystem.tsx:193-205` explains rather than dead-ends — match that voice).
- Name every `@react-three/drei` / `@react-three/postprocessing` / `three` API you rely on.

### Phase 4 — Motion

- Pick a **liveliness level** and justify it. A developer tool must not be bouncy, and the
  app bans spring overshoot.
- Specify every animation with an easing curve and a duration: camera moves, object
  entry, focus transitions, filtering, search, period changes.
- **The existing three-phase Bezier** (`OrbitSystem.tsx:182`) is a bespoke curve — say
  whether to keep, replace, or standardise it, and with what.
- Specify the `prefers-reduced-motion` fallback precisely: what still moves, what stops,
  what the static composition looks like.
- State the frame budget and how you hit it (draw calls, triangle count, texture memory).

### Phase 5 — Interaction & UX flow

- The full click/hover/drag/scroll/keyboard map. Preserve "drag to orbit, click to focus"
  without stealing drags (the current implementation uses a 300 ms long-press discriminator
  at `OrbitSystem.tsx:124-144` — keep or replace, but say which).
- Search and filter behaviour, including what happens to the composition as results narrow.
- Period switching (`today | week | month | all`) and how the scene transitions.
- Full keyboard support and focus management for a canvas app (the current one has a
  `<canvas>` and little else — this is a real gap).
- Screen-reader story: a 3D scene is opaque to a screen reader. Specify the accessible
  equivalent and where it lives.
- Specify the **compact/inline variant** for the dashboard grid (today that slot is
  `component: () => null` and renders nothing).

### Phase 6 — Engineering plan

- Which files change, and what changes in each. Start from the bundle's file map and be
  honest about `OrbitScene.tsx` being 1 188 lines.
- Resolve the duplicate-component trap first: state which file owns `Starfield`,
  `WarpLines`, `PortalRing`, `AsteroidBelt`, `AtmosphericScattering` after the change, and
  that the loser gets deleted. (Editing only `Planet.tsx` changes nothing on screen.)
- Delete the dead second config set (`OrbitSystem.tsx:15-42`) and establish one source of
  truth for every numeric constant.
- Texture lifecycle: the existing ref-counted
  `acquirePlanetTextures` / `releasePlanetTextures` / `disposeAllPlanetTextures` must be
  preserved or replaced by a correct disposal path — a WebGL leak kills the whole app
  window.
- **Instancing plan**, with the migration order and the rollback.
- **Backend gap table**: for every number the new design displays, state whether it is
  already available in `appStats`/`websiteStats`, or needs new IPC/DB work. Nothing may be
  faked client-side from data that is not there. (Bundle §8 is the audit; extend it.)
- A staged rollout: which stage is shippable on its own, and how to verify each stage
  without a full-app rebuild.

### Phase 7 — What could make this worse

State the three strongest arguments against your own design, and the mitigation for each.
Include at least: GPU cost on integrated graphics, the long-tail data problem, and the risk
that a more beautiful view is *less* legible than the current one.

---

## Constraints (hard limits)

- **Must work with the existing stack**: `@react-three/fiber` + `@react-three/drei` +
  `@react-three/postprocessing` + `three@0.183.2`. Do not propose migrating to raw
  three.js, and do not propose a new 3D framework.
- **Must not add a new 3D dependency** without an explicit justification section.
- **Must not invent an IPC channel that does not exist.** If your design needs new data,
  put it in the backend gap table.
- **Must not break the single-writer SQLite model** or introduce a write path.
- **Must keep three honest `perfMode` tiers** (`high | balanced | performance`, persisted
  in `localStorage['deskflow-graphics-quality']`).
- **Must honour the LAMINAR design constitution** (bundle §5) — especially light mode, the
  two-family font limit, no spring/bounce, and `prefers-reduced-motion`.
- **Must not propose removing anything** without listing it under a "Removals — needs
  explicit user confirmation" heading. The user decides what gets deleted.
- Electron on this machine runs **native Wayland**; overlays force X11. Do not propose a
  transparent always-on-top window without addressing that.

---

## Anti-slop checklist (apply to every visual decision)

1. Re-skin everything to the DeskFlow tokens (`--bg-primary`, `--text-muted`,
   `--page-accent`, `--tier-productive/neutral/distracting`, `--ws-border`). No raw hex
   left in a component.
2. Radii: 8 / 12 / pill. Nothing else.
3. Inter + JetBrains Mono (+ Space Grotesk if needed) — **max 2 families in one view**.
4. No decorative glow or gradient on chrome. Glow, if any, belongs to the 3D subject, not
   the UI frame.
5. Every state covered: loading, empty, error, populated — plus partial (long tail) and
   degraded (`balanced`/`performance` tiers).
6. Motion is eased, never sprung; everything has a `prefers-reduced-motion` path.
7. Colour means tier. Magnitude is opacity/size of one hue — not twelve identity hues on a
   168-cell-equivalent field.
8. Text is never baked into a WebGL texture if it needs to be selectable, searchable or
   readable by a screen reader.
9. The scene must be legible at 500 px tall as well as fullscreen — that is the default
   size.

---

## Skills to apply (use your equivalents; these are the house skills)

- **Frontend Design** — DeskFlow tokens, component patterns, spacing, typography.
- **Human-Centric UX** — the six pillars: clarity, progressive disclosure, visual hierarchy,
  full state coverage, feedback, forgiveness.
- **Impeccable** — 7 dimensions (typography, colour, spatial, motion, interaction,
  responsive, UX writing) and its 27 anti-patterns.
- **Motion — Bring the UI Alive** — liveliness levels, motion taxonomy, recipes,
  reduced-motion fallback.
- **UI UX Pro Max** — industry rules for developer tools and analytics surfaces.
- **Design Taste System** — variance knobs, anti-repetition rules, decision tree.
- **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist.

> **Honest limitation:** the agent that wrote this prompt had **no access to the shadcn /
> Magic UI / drei MCP servers**, so it could not paste a verified component inventory.
> Query them yourself before finalising anything you intend to pull in, and list the real
> component names you used. The relevant ecosystem here is `@react-three/drei`
> (`OrbitControls`, `Stars`, `Html`, `PerformanceMonitor`, `Instances`, `Text`,
> `Billboard`, `Line`, `Points`) and `@react-three/postprocessing`
> (`Bloom`, `ToneMapping`, `Vignette`, `SSAO`, `N8AO`, `DepthOfField`, `SMAA`) — verify
> the current API of anything you depend on rather than trusting this list.

---

## Output Format

Produce a single **`RESULT.md`** with these sections, in this order:

1. **Research findings** — what you searched, what you found, with sources. Include a short
   "metaphors considered and rejected" table.
2. **The design** — the metaphor, the channel→meaning mapping table, and the reasoning.
3. **Visual specification** — pixel-exact: colours, camera, geometry, materials,
   postprocessing, all four states, light mode.
4. **Motion specification** — curves, durations, liveliness level, reduced-motion.
5. **Interaction & accessibility** — the full input map, keyboard, screen-reader equivalent.
6. **Data-correctness plan** — one clock, one table, verification procedure, empty/long-tail
   states.
7. **Engineering plan** — file-by-file, instancing migration, texture lifecycle, deletions,
   staged rollout.
8. **Backend gap table** — every displayed number: available today, or new work required.
9. **Risks & mitigations** — including the three arguments against your own design.
10. **Removals — needs explicit user confirmation** — anything you propose deleting.

Then stop and wait. Do not start writing code.

---

## Definition of done

The design is done when a developer with only `CONTEXT_BUNDLE.md` and `RESULT.md` can
implement it without asking a single clarifying question, and when every number the view
displays can be reconciled against the Activity page to the second.
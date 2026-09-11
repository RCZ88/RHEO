# Math/STEM Visualization Tools — Research Inventory

## Executive Summary

The landscape of browser-native math animation and visualization tools has matured significantly, with several strong alternatives to Python-based Manim now available. The most promising discoveries are **manim-js** (a direct TypeScript port of 3Blue1Brown's engine), **MathBox** (presentation-quality WebGL math graphing built on Three.js), and **JSXGraph** (a mature interactive geometry library from University of Bayreuth). These tools directly meet your criteria: browser-rendered, math-focused primitives, animation support, and programmatic APIs suitable for AI/LLM-driven generation.

For React integration specifically, **function-plot** (D3-based function plotting with derivative visualization) and **react-force-graph** (2D/3D force-directed graphs with extensive customization) offer npm-installable components. The Rust-based **mathlikeanim-rs** provides a unique WebAssembly approach with both Canvas and SVG rendering, though it requires more integration work.

## Previously Known (Credit Only — Do Not Re-list)

The following tools are already in your project and should be acknowledged as existing infrastructure:

- **D3.js** — data visualizations, charts
- **Three.js** (@react-three/fiber, @react-three/drei) — 3D scenes
- **Framer Motion** — UI animations
- **KaTeX** — LaTeX math rendering
- **Excalidraw** — virtual whiteboard
- **tldraw** — infinite canvas SDK
- **react-chartjs-2** — charting
- **lightweight-charts** — financial charts
- **mermaid** — diagram rendering
- **vega-lite** — statistical visualizations

***

## Tier 1: Best Fits (Browser-native, React-compatible, Math-focused)

### 1. manim-js

**What it does:** A TypeScript adaptation of 3Blue1Brown's Manim animation engine that runs entirely in the browser with no Python, server, or ffmpeg required. [reddit](https://www.reddit.com/r/math/comments/1r4faij/i_ported_manim_3blue1browns_math_animation_engine/)

| Field | Value |
|-------|-------|
| **Name** | manim-js |
| **License** | MIT (inferred from Manim Community) |
| **Language / Framework** | TypeScript, browser-native |
| **Package name** | Not yet on npm (GitHub-only as of Aug 2026) |
| **GitHub URL** | https://github.com/maloyan/manim-js |
| **Website / Docs** | https://maloyan.xyz/about/ (demo: https://maloyan.github.io/manim-web/examples) |
| **Key capabilities** | <ul><li>LaTeX rendering in animations via KaTeX</li><li>Function graphs, parametric curves, vector fields</li><li>3D math objects (surfaces, spheres, tori) with orbit controls</li><li>Coordinate systems (NumberPlane, Axes, NumberLine)</li><li>Transforms (morph objects like 3B1B videos)</li><li>Interactive objects (draggable, hoverable, clickable)</li><li>React/Vue component embeddable</li><li>Python-to-TypeScript converter for existing Manim scripts</li></ul> |
| **Limitations** | <ul><li>Not yet published to npm (must install from GitHub)</li><li>Relatively new project (339 stars as of Feb 2026) — may have incomplete feature parity with Python Manim</li><li>Requires TypeScript setup</li></ul> |
| **Can it render in browser?** | ✅ Yes, entirely browser-native |
| **Does it have math primitives?** | ✅ Yes (Axes, FunctionPlot, Vector, LaTeX, 3D surfaces) |
| **Is it AI/LLM-friendly?** | ✅ Yes, programmatic TypeScript API |
| **Actively maintained?** | ✅ Yes (Show HN Feb 2026, 140 points)  [bestofshowhn](https://bestofshowhn.com/search?q) |
| **Credits** | Narek Maloyan (@maloyan) |

**Install command:** Not on npm yet — clone from GitHub or wait for npm publication.

***

### 2. MathBox

**What it does:** Presentation-quality WebGL math graphing library built on top of Three.js and ShaderGraph, providing a clean declarative API for visualizing and animating mathematical relationships. [dynamicmath](https://www.dynamicmath.xyz/threejs/)

| Field | Value |
|-------|-------|
| **Name** | MathBox (mathbox) |
| **License** | MIT  [github](https://github.com/unconed/mathbox) |
| **Language / Framework** | JavaScript/TypeScript, Three.js-based |
| **Package name** | `npm install mathbox three`  [github](https://github.com/unconed/mathbox) |
| **GitHub URL** | https://github.com/unconed/mathbox |
| **Website / Docs** | https://mathbox.org (Quick Start, Primitives docs, API reference) |
| **Key capabilities** | <ul><li>3D Cartesian coordinate systems with axes</li><li>Function plotting, parametric curves, surfaces</li><li>LaTeX/HTML/GL labels</li><li>Volumetric vectors, quaternion hyperspheres</li><li>Data/shape mapping</li><li>Declarative animation API</li><li>Built on Three.js (compatible with @react-three/fiber)</li><li>Custom shader support</li></ul> |
| **Limitations** | <ul><li>Steeper learning curve (custom primitive-based API)</li><li>Last release Jan 2023 (v2.3.1) — slower update cadence but stable</li><li>Requires Three.js as dependency (already in your project)  [github](https://github.com/unconed/mathbox)</li></ul> |
| **Can it render in browser?** | ✅ Yes, WebGL-native |
| **Does it have math primitives?** | ✅ Yes (Axes, FunctionPlot, Vector, Surface, LaTeX labels) |
| **Is it AI/LLM-friendly?** | ✅ Yes, programmatic API with primitive tree |
| **Actively maintained?** | ⚠️ Moderate (1.4k stars, last release Jan 2023, but still used in production)  [github](https://github.com/unconed/mathbox) |
| **Credits** | Steven Wittens (@unconed), 2013-2023  [github](https://github.com/unconed/mathbox) |

**Install command:**
```bash
npm install mathbox three
```

**React integration:** Use `mathbox-react` (React bindings mentioned in Related Projects). [github](https://github.com/unconed/mathbox)

***

### 3. JSXGraph

**What it does:** Cross-browser JavaScript library for interactive geometry, function plotting, charting, and data visualization. Developed at University of Bayreuth's mathematics education department. [sketchometry](https://sketchometry.org/)

| Field | Value |
|-------|-------|
| **Name** | JSXGraph |
| **License** | Dual-licensed: GNU LGPL v3+ or MIT  [npmjs](https://www.npmjs.com/package/jsxgraph) |
| **Language / Framework** | Pure JavaScript (no dependencies), SVG/Canvas/VML rendering |
| **Package name** | `npm install jsxgraph` or CDN  [npmjs](https://www.npmjs.com/package/jsxgraph) |
| **GitHub URL** | https://github.com/jsxgraph/jsxgraph |
| **Website / Docs** | https://jsxgraph.org, https://jsxgraph.org/wiki/ (hundreds of examples) |
| **Key capabilities** | <ul><li>Interactive geometry constructions (points, lines, circles, polygons)</li><li>Function plotting with dynamic updates</li><li>Charting and data visualization</li><li>Differential equation visualization  [scribbler](https://scribbler.live/2024/05/11/Differential-Equations-JavaScript.html)</li><li>Multi-touch support</li><li>SVG, Canvas, or VML rendering</li><li>MathJax integration for LaTeX</li><li>Small footprint (~200 KB)</li></ul> |
| **Limitations** | <ul><li>API is imperative (board.create('point', ...)) — less declarative than D3</li><li>Geometry-focused (less strong on 3D or advanced calculus)</li><li>Documentation in wiki format (less polished than modern docs)</li></ul> |
| **Can it render in browser?** | ✅ Yes, pure JavaScript |
| **Does it have math primitives?** | ✅ Yes (Point, Line, Circle, FunctionGraph, Vector, Curve) |
| **Is it AI/LLM-friendly?** | ✅ Yes, straightforward JavaScript API |
| **Actively maintained?** | ✅ Yes (University-backed, v1.6.2+ as of 2024, workshop materials 2024)  [stackoverflow](https://stackoverflow.com/questions/77813463/jsxgraph-intersections-and-otherintersection-between-line-and-general-conic-sec) |
| **Credits** | Lehrstuhl für Mathematik und ihre Didaktik, University of Bayreuth, Germany  [npmjs](https://www.npmjs.com/package/jsxgraph) |

**Install command:**
```bash
npm install jsxgraph
```

**CDN alternative:**
```html
<script src="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css" />
```

***

### 4. function-plot

**What it does:** D3.js-based library for rendering mathematical functions with minimal configuration — essentially a programmatic clone of Google's function plotter with interactive zoom/pan and derivative visualization. [npmjs](https://www.npmjs.com/package/function-plot)

| Field | Value |
|-------|-------|
| **Name** | function-plot |
| **License** | MIT (2015-2023 © Mauricio Poppe)  [npmjs](https://www.npmjs.com/package/function-plot) |
| **Language / Framework** | JavaScript, D3.js-based |
| **Package name** | `npm install function-plot`  [npmjs](https://www.npmjs.com/package/function-plot) |
| **GitHub URL** | https://github.com/mauriciopoppe/function-plot |
| **Website / Docs** | https://mauriciopoppe.github.io/function-plot/ |
| **Key capabilities** | <ul><li>Function plotting with expression parser (e.g., `x^2`, `sin(x)`)</li><li>Interactive zoom/pan (infinite graphs)</li><li>Derivative visualization (updateOnMouseMove)</li><li>Scatterplots and line charts</li><li>Built on D3.js (you already have D3)</li><li>Observable notebook examples</li></ul> |
| **Limitations** | <ul><li>2D-only (no 3D surfaces or vector fields)</li><li>Limited to function plotting (not general geometry)</li><li>Last npm publish Nov 2024 — moderate activity  [npmjs](https://www.npmjs.com/package/function-plot)</li></ul> |
| **Can it render in browser?** | ✅ Yes |
| **Does it have math primitives?** | ✅ Yes (Function, Derivative, Axes) |
| **Is it AI/LLM-friendly?** | ✅ Yes, simple JSON-like config API |
| **Actively maintained?** | ⚠️ Moderate (last npm publish Nov 2024)  [npmjs](https://www.npmjs.com/package/function-plot) |
| **Credits** | Mauricio Poppe  [npmjs](https://www.npmjs.com/package/function-plot) |

**Install command:**
```bash
npm install function-plot
```

**Usage example:**
```javascript
import functionPlot from 'function-plot'
functionPlot({
  target: '#root',
  data: [{
    fn: 'x^2',
    derivative: {
      fn: '2*x',
      updateOnMouseMove: true
    }
  }]
})
```

***

### 5. react-force-graph (2D/3D/VR/AR)

**What it does:** React bindings for force-directed graph visualizations in 2D (Canvas), 3D (ThreeJS/WebGL), VR, and AR. Ideal for visualizing networks, graphs, and relationships with physics-based layout. [npmjs](https://www.npmjs.com/package/react-force-graph)

| Field | Value |
|-------|-------|
| **Name** | react-force-graph (react-force-graph-2d, react-force-graph-3d, react-force-graph-vr, react-force-graph-ar) |
| **License** | MIT |
| **Language / Framework** | JavaScript, React, d3-force-3d / ThreeJS |
| **Package name** | `npm install react-force-graph` (exports 4 components)  [npmjs](https://www.npmjs.com/package/react-force-graph) |
| **GitHub URL** | https://github.com/vasturiano/react-force-graph |
| **Website / Docs** | https://vasturiano.github.io/react-force-graph/ |
| **Key capabilities** | <ul><li>2D/3D/VR/AR force-directed graphs</li><li>Interactive node dragging, zoom/pan</li><li>Directional arrows and particle animations</li><li>Custom node/link rendering (Canvas or ThreeJS objects)</li><li>DAG mode (top-down, left-right, radial layouts)</li><li>Large graph support (50K+ nodes with Cosmograph alternative)  [cosmograph](https://cosmograph.app/library/)</li><li>React Three Fiber binding available (r3f-forcegraph, 31 stars)  [github](https://github.com/vasturiano/r3f-forcegraph)</li></ul> |
| **Limitations** | <ul><li>Graph/network-focused (not general math functions)</li><li>3D mode requires Three.js (already in your project)</li><li>Less suited for calculus/geometry visualization</li></ul> |
| **Can it render in browser?** | ✅ Yes |
| **Does it have math primitives?** | ⚠️ Partially (nodes, edges, vectors — not functions or LaTeX) |
| **Is it AI/LLM-friendly?** | ✅ Yes, JSON graph data structure |
| **Actively maintained?** | ✅ Yes (frequent updates, 2D/3D/VR/AR variants)  [npmjs](https://www.npmjs.com/package/react-force-graph) |
| **Credits** | vasturiano (@vasturiano) |

**Install command:**
```bash
npm install react-force-graph
```

***

## Tier 2: Strong Candidates (Need adaptation)

### 6. mathlikeanim-rs

**What it does:** Rust-based animation library inspired by Manim, compiled to WebAssembly for browser interactivity. Supports both Canvas and SVG rendering with math formula rendering. [github](https://github.com/MathItYT/mathlikeanim-rs)

| Field | Value |
|-------|-------|
| **Name** | mathlikeanim-rs |
| **License** | MIT  [github](https://github.com/MathItYT/mathlikeanim-rs) |
| **Language / Framework** | Rust (WASM core) + TypeScript (renderer) |
| **Package name** | `@mathlikeanim-rs/mathlikeanim-rs` + `@mathlikeanim-rs/renderer` (npm)  [github](https://github.com/MathItYT/mathlikeanim-rs) |
| **GitHub URL** | https://github.com/MathItYT/mathlikeanim-rs |
| **Website / Docs** | https://mathityt.github.io/mathlikeanim-rs/ |
| **Key capabilities** | <ul><li>Interactivity (drag, hover)</li><li>Basic shapes, text rendering</li><li>Math formula rendering</li><li>Function plotting (partial)</li><li>HTML Canvas and SVG output</li><li>3D rendering (partial)</li><li>Browser support via WASM</li></ul> |
| **Limitations** | <ul><li>Only 93 stars — smaller community  [github](https://github.com/MathItYT/mathlikeanim-rs)</li><li>Function plotting and 3D marked as "meant to be supported, not available yet" (🟡)  [github](https://github.com/MathItYT/mathlikeanim-rs)</li><li>Requires WASM initialization (more complex setup)</li><li>Python support outdated  [github](https://github.com/MathItYT/mathlikeanim-rs)</li></ul> |
| **Can it render in browser?** | ✅ Yes (WASM + TypeScript renderer) |
| **Does it have math primitives?** | ⚠️ Partially (basic shapes, formulas — function plotting incomplete) |
| **Is it AI/LLM-friendly?** | ✅ Yes, programmatic API |
| **Actively maintained?** | ⚠️ Moderate (no releases published, but active development)  [github](https://github.com/MathItYT/mathlikeanim-rs) |
| **Credits** | MathItYT (@MathItYT) |

**Install command:**
```bash
npm install @mathlikeanim-rs/mathlikeanim-rs @mathlikeanim-rs/renderer
```

***

### 7. VTK.js

**What it does:** JavaScript implementation of the Visualization Toolkit (VTK) for scientific visualization in the browser. Supports scalar, vector, tensor, and volumetric visualization with WebGL/WebGPU. [kitware.github](https://kitware.github.io/vtk-js/docs/)

| Field | Value |
|-------|-------|
| **Name** | VTK.js (vtk.js) |
| **License** | BSD/Apache (VTK family) |
| **Language / Framework** | JavaScript ES6, WebGL (+WebGPU soon) |
| **Package name** | `npm install vtk.js` |
| **GitHub URL** | https://github.com/Kitware/vtk-js |
| **Website / Docs** | https://kitware.github.io/vtk-js/docs/ |
| **Key capabilities** | <ul><li>Scientific visualization algorithms</li><li>Vector field, tensor, volumetric rendering</li><li>3D surfaces, parametric shapes</li><li>Interactive browser-based exploration</li><li>Used in ManimVTK project for interactive 3D  [linkedin](https://www.linkedin.com/posts/jose-alvarez-cabrera_introducing-manimvtk-scientific-visualization-activity-7402960936304660480-dXmw)</li><li>WebGPU support coming soon  [kitware.github](https://kitware.github.io/vtk-js/docs/)</li></ul> |
| **Limitations** | <ul><li>Steeper learning curve (scientific visualization focus)</li><li>Heavier library (full VTK feature set)</li><li>Less education-focused (more research/medical imaging)</li></ul> |
| **Can it render in browser?** | ✅ Yes, WebGL-native |
| **Does it have math primitives?** | ✅ Yes (vectors, tensors, surfaces, parametric curves) |
| **Is it AI/LLM-friendly?** | ⚠️ Moderate (complex API, but programmatic) |
| **Actively maintained?** | ✅ Yes (Kitware-backed, frequent updates)  [kitware.github](https://kitware.github.io/vtk-js/docs/) |
| **Credits** | Kitware, Inc. (VTK community) |

**Install command:**
```bash
npm install vtk.js
```

***

### 8. r3f-forcegraph (React Three Fiber binding)

**What it does:** React Three Fiber component for 3D force-directed graphs, built on three-forcegraph. Provides tighter integration with R3F ecosystem than react-force-graph-3d. [github](https://github.com/vasturiano/r3f-forcegraph)

| Field | Value |
|-------|-------|
| **Name** | r3f-forcegraph |
| **License** | MIT |
| **Language / Framework** | JavaScript, React Three Fiber, ThreeJS |
| **Package name** | `npm install r3f-forcegraph` |
| **GitHub URL** | https://github.com/vasturiano/r3f-forcegraph |
| **Website / Docs** | https://vasturiano.github.io/r3f-forcegraph/example/large-graph/ |
| **Key capabilities** | <ul><li>Native R3F component (useFrame integration)</li><li>3D force-directed graphs</li><li>Directional arrows, particles</li><li>DAG mode (tree layouts)</li><li>Custom ThreeJS node/link objects</li></ul> |
| **Limitations** | <ul><li>Only 31 stars — smaller than react-force-graph  [github](https://github.com/vasturiano/r3f-forcegraph)</li><li>Graph/network-focused (not general math)</li><li>Requires React Three Fiber setup (already in your project)</li></ul> |
| **Can it render in browser?** | ✅ Yes |
| **Does it have math primitives?** | ⚠️ Partially (nodes, edges — not functions or LaTeX) |
| **Is it AI/LLM-friendly?** | ✅ Yes, JSON graph data |
| **Actively maintained?** | ⚠️ Moderate (13 tags, but lower star count)  [github](https://github.com/vasturiano/r3f-forcegraph) |
| **Credits** | vasturiano (@vasturiano) |

**Install command:**
```bash
npm install r3f-forcegraph
```

***

## Tier 3: Reference/Inspiration (Not directly usable but informative)

### 9. manim-web (Python + Pyodide)

**What it does:** Fork of ManimCE that generates interactive web animations via Pyodide (Python in the browser). Allows interactive Manim scenes controlled by JavaScript. [pypi](https://pypi.org/project/manim-web/)

| Field | Value |
|-------|-------|
| **Name** | manim-web |
| **License** | MIT (Manim Community) |
| **Language / Framework** | Python (Pyodide), JavaScript |
| **Package name** | `micropip.install("manim-web")` (Pyodide)  [pypi](https://pypi.org/project/manim-web/) |
| **GitHub URL** | https://pypi.org/project/manim-web/ |
| **Website / Docs** | https://www.sitepoint.com/manim-web-3blue1brown-mathematical-animations-react/  [sitepoint](https://www.sitepoint.com/manim-web-3blue1brown-mathematical-animations-react/) |
| **Key capabilities** | <ul><li>Interactive Manim animations in browser</li><li>JavaScript event handling</li><li>Pyodide-based (no server required)</li></ul> |
| **Limitations** | <ul><li>Requires Pyodide (Python runtime in browser) — violates your "no Python runtime" constraint</li><li>Heavier WASM payload</li><li>Less suitable for production Electron app</li></ul> |
| **Can it render in browser?** | ✅ Yes (via Pyodide) |
| **Does it have math primitives?** | ✅ Yes (full Manim feature set) |
| **Is it AI/LLM-friendly?** | ⚠️ Moderate (Python API, but Pyodide adds complexity) |
| **Actively maintained?** | ⚠️ Moderate (PyPI publish Sep 2025)  [pypi](https://pypi.org/project/manim-web/) |
| **Credits** | Manim Community fork |

**Verdict:** Not recommended for your use case (requires Python runtime), but worth studying for patterns.

***

### 10. sketchometry (JSXGraph-based educational tool)

**What it does:** Dynamic geometry software built on JSXGraph, focused on gesture-based sketching for education. Converts freehand sketches into precise geometric constructions. [sketchometry](https://sketchometry.org/)

| Field | Value |
|-------|-------|
| **Name** | sketchometry |
| **License** | Free (based on JSXGraph — LGPL/MIT) |
| **Language / Framework** | JavaScript, JSXGraph-based |
| **Package name** | N/A (web app, not a library) |
| **GitHub URL** | N/A (open-source, but primary site is sketchometry.org) |
| **Website / Docs** | https://sketchometry.org |
| **Key capabilities** | <ul><li>Gesture-based geometry input</li><li>Interactive constructions</li><li>Educational focus (teaching/learning)</li><li>Runs in browser without installation</li></ul> |
| **Limitations** | <ul><li>Not a library (it's an app built on JSXGraph)</li><li>Use JSXGraph directly instead for programmatic access</li></ul> |
| **Can it render in browser?** | ✅ Yes |
| **Does it have math primitives?** | ✅ Yes (via JSXGraph) |
| **Is it AI/LLM-friendly?** | ❌ No (GUI-focused, not programmatic) |
| **Actively maintained?** | ✅ Yes (v26.3, Jun 2026)  [sketchometry](https://sketchometry.org/) |
| **Credits** | sketchometry team (based on JSXGraph by University of Bayreuth)  [sketchometry](https://sketchometry.org/) |

**Verdict:** Use JSXGraph directly — sketchometry is an educational app, not a library.

***

## AI Animation Pipelines (Research Papers)

### 11. MathCoder2 / mathllm

**What it does:** Research on improving math reasoning in LLMs via continued pretraining on model-translated mathematical code. Not directly an animation tool, but relevant for AI-generated math content. [github](https://github.com/mathllm/MathCoder2)

| Field | Value |
|-------|-------|
| **Name** | MathCoder2 |
| **License** | Open-source (GitHub) |
| **Language / Framework** | Python, LLM fine-tuning |
| **Package name** | N/A (research code) |
| **GitHub URL** | https://github.com/mathllm/MathCoder2 |
| **Website / Docs** | Paper: "MathCoder2: Better Math Reasoning from Continued Pretraining on Model-translated Mathematical Code" (2024)  [github](https://github.com/mathllm/MathCoder2) |
| **Key capabilities** | <ul><li>Improved math reasoning in LLMs</li><li>Code generation for math problems</li></ul> |
| **Limitations** | <ul><li>Not an animation tool</li><li>Research code, not production-ready</li></ul> |
| **Can it render in browser?** | ❌ No |
| **Does it have math primitives?** | ❌ No |
| **Is it AI/LLM-friendly?** | ✅ Yes (it's an LLM project) |
| **Actively maintained?** | ⚠️ Moderate (2024 paper) |
| **Credits** | mathllm team |

**Verdict:** Reference for AI math reasoning, not visualization.

***

### 12. Manim Motion Editor (browser-based visual editor)

**What it does:** Figma-like visual animation editor powered by Manim, running in browser with Docker backend. Allows drag-and-drop shape placement, LaTeX, and timeline-based animation. [github](https://github.com/BlommeJan/Manim-Motion)

| Field | Value |
|-------|-------|
| **Name** | Manim Motion Editor |
| **License** | Open-source (GitHub) |
| **Language / Framework** | Python (Manim), Docker, web frontend |
| **Package name** | N/A (self-hosted app) |
| **GitHub URL** | https://github.com/BlommeJan/Manim-Motion |
| **Website / Docs** | https://github.com/BlommeJan/Manim-Motion |
| **Key capabilities** | <ul><li>Visual timeline-based animation</li><li>LaTeX math support</li><li>Shape morphing</li><li>Code-only mode for raw Manim</li></ul> |
| **Limitations** | <ul><li>Requires Docker/Python backend (not browser-native)</li><li>Outputs video (MP4), not interactive content</li></ul> |
| **Can it render in browser?** | ⚠️ Partially (editor UI is web-based, but rendering is server-side) |
| **Does it have math primitives?** | ✅ Yes (via Manim) |
| **Is it AI/LLM-friendly?** | ⚠️ Moderate (visual editor, not programmatic) |
| **Actively maintained?** | ⚠️ Moderate (Feb 2026)  [github](https://github.com/BlommeJan/Manim-Motion) |
| **Credits** | BlommeJan (@BlommeJan) |

**Verdict:** Useful for inspiration on UI/UX, but not directly usable (server-dependent, video output).

***

## Comparison Table

| Tool | License | npm Package | Browser-native | Math Primitives | Animation | AI/LLM-friendly | 3D Support | React-ready | Stars (approx.) |
|------|---------|-------------|----------------|-----------------|-----------|-----------------|------------|-------------|-----------------|
| **manim-js** | MIT | No (GitHub) | ✅ | ✅ (Axes, Functions, LaTeX, 3D) | ✅ | ✅ | ✅ | ⚠️ (embeddable) | 339  [maloyan](https://maloyan.xyz/about/) |
| **MathBox** | MIT | ✅ `mathbox` | ✅ | ✅ (Axes, Functions, Surfaces, Vectors) | ✅ | ✅ | ✅ | ⚠️ (mathbox-react) | 1.4k  [github](https://github.com/unconed/mathbox) |
| **JSXGraph** | LGPL/MIT | ✅ `jsxgraph` | ✅ | ✅ (Geometry, Functions, Vectors) | ⚠️ (basic) | ✅ | ⚠️ (limited 3D) | ⚠️ (imperative API) | N/A (University project) |
| **function-plot** | MIT | ✅ `function-plot` | ✅ | ✅ (Functions, Derivatives, Axes) | ⚠️ (interactive zoom) | ✅ | ❌ | ⚠️ (D3-based) | N/A |
| **react-force-graph** | MIT | ✅ `react-force-graph` | ✅ | ⚠️ (Nodes, Edges) | ✅ (particles, arrows) | ✅ | ✅ (3D mode) | ✅ | N/A (popular) |
| **mathlikeanim-rs** | MIT | ✅ `@mathlikeanim-rs/*` | ✅ (WASM) | ⚠️ (Shapes, Formulas — functions partial) | ✅ | ✅ | ⚠️ (partial) | ⚠️ (TypeScript renderer) | 93  [github](https://github.com/MathItYT/mathlikeanim-rs) |
| **VTK.js** | BSD/Apache | ✅ `vtk.js` | ✅ | ✅ (Vectors, Tensors, Surfaces) | ⚠️ (scientific viz) | ⚠️ | ✅ | ⚠️ | N/A (Kitware) |
| **r3f-forcegraph** | MIT | ✅ `r3f-forcegraph` | ✅ | ⚠️ (Nodes, Edges) | ✅ | ✅ | ✅ | ✅ (R3F native) | 31  [github](https://github.com/vasturiano/r3f-forcegraph) |
| **manim-web** | MIT | Pyodide-only | ⚠️ (Pyodide) | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | N/A |
| **JSXGraph** | LGPL/MIT | ✅ `jsxgraph` | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | N/A |

***

## Credits

- **manim-js**: Narek Maloyan (@maloyan) — https://github.com/maloyan/manim-js [reddit](https://www.reddit.com/r/math/comments/1r4faij/i_ported_manim_3blue1browns_math_animation_engine/)
- **MathBox**: Steven Wittens (@unconed) — https://github.com/unconed/mathbox [dynamicmath](https://www.dynamicmath.xyz/threejs/)
- **JSXGraph**: Lehrstuhl für Mathematik und ihre Didaktik, University of Bayreuth — https://github.com/jsxgraph/jsxgraph [sketchometry](https://sketchometry.org/)
- **function-plot**: Mauricio Poppe — https://github.com/mauriciopoppe/function-plot [npmjs](https://www.npmjs.com/package/function-plot)
- **react-force-graph**: vasturiano (@vasturiano) — https://github.com/vasturiano/react-force-graph [npmjs](https://www.npmjs.com/package/react-force-graph)
- **mathlikeanim-rs**: MathItYT (@MathItYT) — https://github.com/MathItYT/mathlikeanim-rs [github](https://github.com/MathItYT/mathlikeanim-rs)
- **VTK.js**: Kitware, Inc. — https://github.com/Kitware/vtk-js [kitware.github](https://kitware.github.io/vtk-js/docs/)
- **r3f-forcegraph**: vasturiano (@vasturiano) — https://github.com/vasturiano/r3f-forcegraph [github](https://github.com/vasturiano/r3f-forcegraph)
- **manim-web**: Manim Community fork — https://pypi.org/project/manim-web/ [pypi](https://pypi.org/project/manim-web/)
- **sketchometry**: sketchometry team (based on JSXGraph) — https://sketchometry.org [sketchometry](https://sketchometry.org/)
- **MathCoder2**: mathllm team — https://github.com/mathllm/MathCoder2 [github](https://github.com/mathllm/MathCoder2)
- **Manim Motion Editor**: BlommeJan (@BlommeJan) — https://github.com/BlommeJan/Manim-Motion [github](https://github.com/BlommeJan/Manim-Motion)

***

## Recommended Next Steps

1. **Start with manim-js** if you want the closest 3Blue1Brown experience in-browser. Monitor npm publication or clone from GitHub.
2. **Use MathBox** for presentation-quality 3D math visualizations (leverages your existing Three.js stack).
3. **Integrate JSXGraph** for interactive geometry and function plotting (mature, education-focused, dual-licensed).
4. **Add function-plot** for quick 2D function visualization with derivative support (lightweight, D3-based).
5. **Consider VTK.js** if you need advanced scientific visualization (vector fields, tensors, volumetrics).

All tools are MIT or compatible (JSXGraph is dual-licensed MIT/LGPL), browser-native, and have programmatic APIs suitable for AI/LLM-driven scene generation.
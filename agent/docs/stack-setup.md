# Agent Instructions: Setting Up the Design & Animation Stack

## Current setup — overrides conflicting legacy examples below

- `design/design.md` governs all app styling; `src/index.css` supplies tokens.
- KokonutUI and Bklit UI are component registries, NOT npm animation libraries or separate MCP servers. Both are configured in `components.json`, alongside React Bits; shadcn core is built in. The existing `mcp.shadcn` server in `opencode.json` browses them all. Registry listing was verified through MCP on 2026-09-17.
- Search/read component source through shadcn MCP before choosing an implementation. Add only the chosen component with `npx shadcn@latest add @kokonutui/<name>` or `@bklit/<name>` after dependency review, backup and file claims. Do not reinitialize shadcn, overwrite `cn()`, or replace existing registries.
- KokonutUI: general UI. Bklit: new charts/data visualization. Preserve existing chart libraries unless migration is explicitly requested.
- Motion v12 is declared in package.json; React components import from `motion/react`. Existing `framer-motion` imports may remain. One animation engine per interaction.
- GSAP and Anime.js are not declared dependencies. References or examples below are not installation evidence. Do not install either without a concrete unmet requirement and approval. Use current official documentation or an available docs MCP, not an unreviewed community code generator.
- LAMINAR disallows spring/bounce, decorative glow/gradients and glass chrome, regardless of examples below. Honor reduced motion and use existing tokens.
- The legacy claims below that KokonutUI/Bklit belong to another project are superseded. A bare `shadcn add button` selects the core button, not React Bits.


This project uses these libraries. Everything is already installed. This doc tells you what exists and where.

## What is installed

| What you need | Library | Package name | Where it's used |
|---|---|---|---|
| UI components (cards, buttons, panels, inputs) | shadcn/ui + @react-bits registry | `npx shadcn@latest` | `src/components/ui/` |
| Layout and interaction animations | `motion` v12 | `motion` | Throughout `src/` |
| Legacy Framer Motion code | `framer-motion` | `framer-motion` | Some existing components |
| Timeline animations, scroll sequences | `gsap` | `gsap` | `src/services/design/MotionTemplates.ts` only |
| Charts for dashboard widgets | `chart.js` | `chart.js` | Dashboard area |
| Time-series / financial charts | `lightweight-charts` | `lightweight-charts` | Terminal widgets |
| 3D scenes | `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing` | those three packages | 3D widget area |
| Icons | `lucide-react` | `lucide-react` | Everywhere |
| Math rendering | `katex` | `katex` | Learn/Content Engine |
| Diagrams | `mermaid` | `mermaid` | Learn/Content Engine |

## What is NOT installed (do not install these)

- KokonutUI
- Bklit UI
- Anime.js

If a prompt or another agent mentions these, ignore it. They are from a different project.

---

## shadcn/ui + @react-bits — how to use

### Adding a component

Use the shadcn CLI. The @react-bits registry is already in `components.json`.

```bash
npx shadcn@latest add button
```

This installs from the @react-bits registry. The component lands in `src/components/ui/`.

### Available registries

`components.json` has:

```json
{
  "registries": {
    "@react-bits": "https://reactbits.dev/r/{name}.json"
  }
}
```

To add a component from @react-bits:

```bash
npx shadcn@latest add @react-bits/<component-name>
```

### MCP setup for browsing components

One shadcn MCP server handles both registries. Set it up once.

**Option A — CLI init:**

```bash
npx shadcn@latest mcp init --client claude
```

Replace `--client claude` with `cursor`, `vscode`, or `codex` depending on your agent.

**Option B — manual `.mcp.json`:**

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

After setup, the agent can browse components by natural language:

```
"Show me all available components in the @react-bits registry"
"Add @react-bits/particle-button to my project"
```

---

## motion (v12) — how to use

### Import

```js
import { motion, AnimatePresence } from "motion";
```

### Basic usage — animate a div

```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

### Mount/unmount — AnimatePresence

```jsx
<AnimatePresence>
  {show && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

### Scroll-linked — useScroll / useTransform

```jsx
import { useScroll, useTransform, motion } from "motion";

function ScrollComponent() {
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1.2]);
  
  return <motion.div style={{ scale }}>Sticky content</motion.div>;
}
```

### Springs for micro-interactions

```jsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  Click me
</motion.button>
```

### Do not mix with framer-motion on the same element

The project has both `motion` and `framer-motion` installed. Use `motion` for new code. Only touch `framer-motion` when editing existing components that already use it. Never wrap the same element with both.

---

## GSAP — how to use

### Where GSAP lives in this project

GSAP is NOT a general dependency. It is used in three places only:

1. `src/services/design/MotionTemplates.ts` — catalog of pre-built animations
2. `motion-lab/` — experimental playground (separate concern)
3. `rheo-landing/` — landing page prototype (separate concern)

### Adding a new GSAP animation to the main app

Add it to `MotionTemplates.ts` as a new template. Do NOT import `gsap` directly into a component.

The file structure in `MotionTemplates.ts`:

```ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export const MotionTemplates = {
  "gsap-fade-in": {
    id: "gsap-fade-in",
    init: (el: HTMLElement) => {
      gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
    },
  },
  // add new templates here
};
```

Each template has an `id` and an `init` function that receives the DOM element.

### Using a template in a component

```tsx
import { useMotionTemplate } from "@/services/design/MotionTemplates";

function MyComponent() {
  const ref = useRef<HTMLDivElement>(null);
  useMotionTemplate("gsap-fade-in", ref);
  return <div ref={ref}>Animated content</div>;
}
```

### If you must use GSAP directly (one-off)

```bash
npm install gsap
```

```js
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

// Timeline example
const tl = gsap.timeline();
tl.fromTo(".element", { opacity: 0 }, { opacity: 1, duration: 0.5 })
  .fromTo(".other", { y: 30 }, { y: 0, duration: 0.4 }, "-=0.2");
```

### ScrollTrigger example

```js
gsap.fromTo(".section", 
  { opacity: 0, y: 40 },
  { 
    opacity: 1, 
    y: 0, 
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".section",
      start: "top 85%",
      scrub: true,
    }
  }
);
```

### GSAP plugins available

All plugins are free. Register what you need:

```js
gsap.registerPlugin(ScrollTrigger, SplitText, MorphSVGPlugin, Draggable);
```

### MCP for GSAP

No official GSAP MCP server exists. Use a docs-lookup MCP (like Context7) to fetch current GSAP API docs when needed. Do not rely on training data for GSAP API details.

---

## chart.js — how to use

### Import

```js
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
```

Or import specific controllers/scales:

```js
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale } from "chart.js";
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale);
```

### Basic line chart

```jsx
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

function LineChart({ data }) {
  const ref = useRef(null);
  
  useEffect(() => {
    new Chart(ref.current, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [{
          label: "Metric",
          data: data.values,
          borderColor: "#3b82f6",
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
      },
    });
  }, [data]);
  
  return <canvas ref={ref} />;
}
```

### Chart types available

- `line` — line charts
- `bar` — bar charts
- `doughnut` — doughnut/pie
- `radar` — radar charts
- `polarArea` — polar area

### Destroy on unmount

```jsx
useEffect(() => {
  const chart = new Chart(ref.current, config);
  return () => chart.destroy();
}, []);
```

---

## lightweight-charts — how to use

### Import

```js
import { createChart, ColorType } from "lightweight-charts";
```

### Basic time-series chart

```jsx
import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

function TimeSeriesChart({ seriesData }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  
  useEffect(() => {
    const chart = createChart(ref.current, {
      layout: { background: { color: "#1a1a1a" }, textColor: "#d1d5db" },
      width: 600,
      height: 400,
    });
    
    const lineSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
    });
    
    lineSeries.setData(seriesData);
    
    chartRef.current = chart;
    
    return () => chart.remove();
  }, [seriesData]);
  
  return <div ref={ref} style={{ width: 600, height: 400 }} />;
}
```

### Candlestick

```js
const candleSeries = chart.addCandlestickSeries({
  upColor: "#22c55e",
  downColor: "#ef4444",
  borderVisible: false,
  wickUpColor: "#22c55e",
  wickDownColor: "#ef4444",
});
candleSeries.setData(candleData);
```

### Real-time updates

```js
// Update existing series
lineSeries.update({ time: newDate, value: newValue });

// Or set full data
lineSeries.setData(fullDataArray);
```

---

## @react-three — how to use

### Import

```jsx
import { Canvas } from "@react-three/fiber";
import { Stars, Environment, OrbitControls } from "@react-three/drei";
import { Bloom } from "@react-three/postprocessing";
```

### Basic 3D scene

```jsx
function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ambientLight intensity={0.5} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
```

### With post-processing (Bloom)

```jsx
import { EffectComposer, Bloom } from "@react-three/postprocessing";

function SceneWithBloom() {
  return (
    <Canvas>
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} />
      </EffectComposer>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>
    </Canvas>
  );
}
```

### Stars background

```jsx
<Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade={true} />
```

### Environment lighting

```jsx
<Environment preset="city" />
// or
<Environment preset="forest" />
// or
<Environment preset="apartment" />
```

---

## lucide-react — how to use

### Import

```jsx
import { Play, Pause, Settings, X } = "lucide-react";
```

### Usage

```jsx
<Play size={24} />
<Pause size={20} color="#3b82f6" />
```

---

## katex — how to use

### Import

```js
import katex from "katex";
import "katex/dist/katex.min.css";
```

### Render inline

```jsx
import katex from "katex";

function Equation({ formula }) {
  return (
    <span dangerouslySetInnerHTML={{ __html: katex.renderToString(formula, { throwOnError: false }) }} />
  );
}
```

Usage:

```jsx
<Equation formula="E = mc^2" />
<Equation formula="\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}" />
```

---

## mermaid — how to use

### Import

```js
import mermaid from "mermaid";
mermaid.initialize({ startOnLoad: false });
```

### Render a diagram

```jsx
import mermaid from "mermaid";

function Diagram({ graphDefinition }) {
  const ref = useRef(null);
  
  useEffect(() => {
    mermaid.render("uniqueId", graphDefinition)
      .then(({ svg }) => {
        ref.current.innerHTML = svg;
      });
  }, [graphDefinition]);
  
  return <div ref={ref} />;
}
```

Usage:

```jsx
<Diagram graphDefinition={`
graph TD;
  A-->B;
  A-->C;
  B-->D;
  C-->D;
`} />
```

---

## Rules

### One motion engine per element

If `motion` is animating an element, do not also use GSAP on that same element. Pick one.

If GSAP's ScrollTrigger is driving a section's scroll timeline, do not add `motion`'s `useScroll` to a child of that section.

### Find before you build

Before writing custom markup for UI, check if a shadcn/@react-bits component exists that covers your need. Use the MCP server or CLI to search:

```
"Show me all available components in the @react-bits registry"
```

Before adding a new chart library, check if `chart.js` or `lightweight-charts` already covers your need.

Before writing a Three.js helper from scratch, check what `@react-three/drei` provides.

### GSAP stays in MotionTemplates

New GSAP animations for the main app go into `src/services/design/MotionTemplates.ts`. Direct `import { gsap }` in a component is only for one-off experiments. Clean it up if it becomes a pattern.

### No anime.js

Anime.js is not installed. If you need a simple tween and `motion` feels too heavy, use a CSS transition or `motion`'s `animate` prop.

### Restraint

Do not add animations just because you can. One well-placed animation is better than five competing ones. If unsure whether an animation earns its place, cut it.

### Match intensity

Quick interactions (buttons, toggles, hover): 150-300ms, ease-out or low-bounce spring.

Hero/landing moments: 500ms+, expo/back/elastic eases, higher-bounce springs.

Never use a bouncy elastic ease on a settings toggle.

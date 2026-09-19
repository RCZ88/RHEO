# Agent Instructions: How To Use This Stack

## Current routing and design contract — overrides legacy examples below

Read `design/design.md` first, then the Skill Router and all eight required design skills. LAMINAR overrides any conflicting examples in this guide or registry source.

- General app UI: search `@kokonutui` through the existing shadcn MCP, then core `@shadcn`. Charts/data visualization: search `@bklit`. Keep existing implementations unless migration is requested. React Bits and Magic UI are optional sources, not reasons to add decoration.
- Registries provide source components; MCP provides agent discovery tools; npm libraries provide application runtime APIs. Configuring a registry does not install its components.
- Before selecting a component, read its source, dependencies and examples. Reuse existing primitives and `cn()`. Re-skin to `src/index.css` tokens; never copy a foreign palette or global stylesheet wholesale.
- For new React animation code use `import { motion, AnimatePresence } from 'motion/react'`. Preserve an existing Framer Motion integration where appropriate. Never combine engines on the same element or interaction.
- GSAP is for genuinely choreographed timelines; Anime.js is an optional alternative for isolated animations not already covered by Motion. Neither is currently declared in package.json. Require a concrete need and approval before installation; consult current official API documentation. Do not assume a dedicated MCP server is installed.
- Keep chrome flat zinc with one signal hue, Inter plus JetBrains Mono for a console view, 8px controls and 12px cards/dialogs. No decorative gradients, neon glow, glass chrome or spring/bounce. Use 150/250/400ms timing as appropriate and reduced-motion fallbacks.
- Check installed versions before using legacy snippets: lightweight-charts v5 uses `chart.addSeries(LineSeries, options)` rather than `addLineSeries`; React hooks come from `react`, not `mermaid`; cleanup must dispose only resources owned by the component.
- For this task, “terminal” means Penguin Console at `/penguin-console` under `src/terminal/`, NOT Terminal Workspace or its Handbook. Verify the route, visible navigation, command-execution path and persistence independently; source presence and builds do not prove feature behavior.

The old “KokonutUI/Bklit not in this project” section and conflicting animation/import examples below are superseded by this contract.

These are concrete rules for using each library in this project. Read this before writing UI or animation code.

---

## Quick decision table

| You need to... | Use this |
|---|---|
| Build a card, button, input, panel, dialog | `shadcn/ui` or `@react-bits` component from registry |
| Animate a component entering/exiting | `motion` (`<motion.div>` + `AnimatePresence`) |
| Animate on hover/tap/click | `motion` (`whileHover`, `whileTap`) |
| Scroll-linked animation | `motion` (`useScroll`/`useTransform`) OR GSAP `ScrollTrigger` |
| Timeline with multiple sequenced animations | GSAP (add to `MotionTemplates.ts`) |
| SVG morph, text split, drag/physics | GSAP |
| Line/bar/doughnut/radar chart | `chart.js` |
| Candlestick/time-series/financial chart | `lightweight-charts` |
| 3D scene | `@react-three/fiber` + `drei` |
| Icon | `lucide-react` |
| Math formula | `katex` |
| Flow diagram | `mermaid` |

---

## shadcn/ui + @react-bits

### Add a component

```bash
npx shadcn@latest add button
```

Component goes into `src/components/ui/` and is ready to import.

### Add a @react-bits component

```bash
npx shadcn@latest add @react-bits/<component-name>
```

### Browse available components (via MCP)

After setting up the shadcn MCP server (see `stack-setup.md` §1), ask:

```
"Show me all available components in the @react-bits registry"
```

Then pick one and add it:

```
"Add @react-bits/particle-button to my project"
```

### Import and use

```jsx
import { Button } from "@/components/ui/button";

function MyPage() {
  return <Button>Click me</Button>;
}
```

---

## motion (v12)

### Which to use: motion vs framer-motion

Use `motion` for new code. Only use `framer-motion` when editing existing components that already import from `framer-motion`. Never mix both on the same element.

### Import

```js
import { motion, AnimatePresence, useScroll, useTransform } from "motion";
```

### Entrance animation pattern

```jsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: "easeOut" }}
>
  Content fades and slides in
</motion.div>
```

### Exit animation pattern

```jsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

### Hover/tap micro-interaction pattern

```jsx
<motion.button
  whileHover={{ scale: 1.02, backgroundColor: "#3b82f6" }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  Hover me
</motion.button>
```

### Stagger children pattern

```jsx
import { motion } from "motion";

function StaggeredList({ items }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
        >
          {item.text}
        </motion.div>
      ))}
    </div>
  );
}
```

### Scroll-linked transform pattern

```jsx
function ScrollReveal() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [50, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  
  return (
    <motion.div style={{ y, opacity }}>
      Content moves with scroll
    </motion.div>
  );
}
```

### Variants for complex orchestrations

```jsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function StaggeredSection({ children }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      {React.Children.map(children, child => (
        <motion.div variants={item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
```

---

## GSAP

### Rule: add to MotionTemplates.ts, not inline

New GSAP animations for the main app go into:

```
src/services/design/MotionTemplates.ts
```

Do not write `import { gsap } from "gsap"` directly in a component unless it is a one-off experiment. Clean up one-offs if they multiply.

### The MotionTemplates pattern

```ts
// src/services/design/MotionTemplates.ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export const MotionTemplates = {
  "gsap-fade-in": {
    id: "gsap-fade-in",
    init: (el: HTMLElement) => {
      gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" });
    },
  },
  
  "gsap-stagger-children": {
    id: "gsap-stagger-children",
    init: (el: HTMLElement) => {
      const children = el.children;
      gsap.fromTo(children, 
        { opacity: 0, y: 16 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.4, 
          stagger: 0.08,
          ease: "power2.out",
          overwrite: "auto",
        }
      );
    },
  },
  
  "gsap-text-reveal": {
    id: "gsap-text-reveal",
    init: (el: HTMLElement) => {
      const words = el.querySelectorAll("span");
      gsap.fromTo(words,
        { opacity: 0, y: 20 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.3, 
          stagger: 0.05,
          ease: "power2.out",
        }
      );
    },
  },
  
  "gsap-parallax": {
    id: "gsap-parallax",
    init: (el: HTMLElement) => {
      gsap.to(el, {
        y: () => -(window.innerHeight * 0.3),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    },
  },
  
  // Add new templates here
};
```

### How to use a template in a component

```tsx
import { useMotionTemplate } from "@/services/design/MotionTemplates";
import { useRef, useEffect } from "react";

function MyAnimatedSection() {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const template = MotionTemplates["gsap-fade-in"];
    if (ref.current && template) {
      template.init(ref.current);
    }
  }, []);
  
  return <div ref={ref}>Fade in content</div>;
}
```

### Timeline example (for sequenced animations)

```ts
// Add as a new template in MotionTemplates.ts
"gsap-sequenced-reveal": {
  id: "gsap-sequenced-reveal",
  init: (el: HTMLElement) => {
    const tl = gsap.timeline();
    
    tl.fromTo(el.querySelector(".title") || el, 
      { opacity: 0, y: -20 }, 
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
    )
    .fromTo(el.querySelector(".subtitle") || el, 
      { opacity: 0, y: 10 }, 
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 
      "-=0.2"
    )
    .fromTo(el.querySelectorAll(".card"), 
      { opacity: 0, scale: 0.9 }, 
      { 
        opacity: 1, 
        scale: 1, 
        duration: 0.3, 
        stagger: 0.1, 
        ease: "back.out(1.7)", 
      }, 
      "-=0.1"
    );
  },
},
```

### ScrollTrigger scrub example

```ts
// New template
"gsap-scroll-scrub": {
  id: "gsap-scroll-scrub",
  init: (el: HTMLElement) => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          end: "top 40%",
          scrub: true,
        },
      }
    );
  },
},
```

### Cleanup — kill ScrollTriggers on unmount

```tsx
useEffect(() => {
  const template = MotionTemplates["gsap-parallax"];
  if (ref.current && template) {
    template.init(ref.current);
  }
  
  return () => {
    ScrollTrigger.getAll().forEach(st => st.kill());
  };
}, []);
```

---

## chart.js

### Register (do this once, at module level)

```js
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
```

### Line chart component

```jsx
import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler } from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

function LineChart({ labels, data, color = "#3b82f6" }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Series",
          data,
          borderColor: color,
          backgroundColor: color + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
        },
        scales: {
          x: { display: true, grid: { color: "#374151" } },
          y: { display: true, grid: { color: "#374151" } },
        },
      },
    });
    
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [labels, data, color]);
  
  return (
    <div className="w-full h-48">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

### Bar chart

```js
new Chart(ref, {
  type: "bar",
  data: {
    labels: ["A", "B", "C", "D"],
    datasets: [{
      label: "Value",
      data: [10, 20, 15, 25],
      backgroundColor: "#3b82f6",
      borderRadius: 4,
    }],
  },
});
```

### Doughnut chart

```js
new Chart(ref, {
  type: "doughnut",
  data: {
    labels: ["Used", "Free"],
    datasets: [{
      data: [65, 35],
      backgroundColor: ["#3b82f6", "#1f2937"],
      borderWidth: 0,
    }],
  },
  options: {
    cutout: "70%",
    plugins: { legend: { display: false } },
  },
});
```

---

## lightweight-charts

### Import

```js
import { createChart, LineSeries, CandlestickSeries } from "lightweight-charts";
```

### Time-series line chart

```jsx
import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

function TimeSeriesChart({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#1a1a1a" },
        textColor: "#d1d5db",
      },
      grid: {
        vertLines: { color: "#2a2a2a" },
        horzLines: { color: "#2a2a2a" },
      },
      width: containerRef.current.clientWidth,
      height: 300,
    });
    
    const lineSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
      priceAxis: { format: { type: "price", precision: 2 } },
      timeAxis: { format: { type: "time", minutesSeparator: ":", hoursDigitsEnabled: false } },
    });
    
    lineSeries.setData(data);
    
    chartRef.current = chart;
    
    return () => chart.remove();
  }, [data]);
  
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    }
  }, []);
  
  return <div ref={containerRef} className="w-full" />;
}
```

### Data format

```js
const data = [
  { time: "2024-01-01", value: 100.5 },
  { time: "2024-01-02", value: 102.3 },
  { time: "2024-01-03", value: 101.8 },
];

// For candlestick
const candleData = [
  { time: "2024-01-01", open: 100, high: 105, low: 98, close: 103 },
  { time: "2024-01-02", open: 103, high: 108, low: 101, close: 106 },
];
```

### Real-time update

```js
// In your component, call this when new data arrives
function updateChart(newDataPoint) {
  if (chartRef.current && lineSeriesRef.current) {
    lineSeriesRef.current.update(newDataPoint);
  }
}
```

---

## @react-three

### Basic scene

```jsx
import { Canvas } from "@react-three/fiber";

function MyScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      
      {/* Your 3D objects here */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      
    </Canvas>
  );
}
```

### Orbit controls (user can rotate/zoom)

```jsx
import { OrbitControls } from "@react-three/drei";

<Canvas>
  {/* objects */}
  <OrbitControls 
    enablePan={false}
    enableZoom={true}
    enableRotate={true}
    minDistance={3}
    maxDistance={20}
    autoRotate={true}
    autoRotateSpeed={1}
  />
</Canvas>
```

### Stars background

```jsx
import { Stars } from "@react-three/drei";

<Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
```

### Environment preset

```jsx
import { Environment } from "@react-three/drei";

<Environment preset="city" />
// presets: city, forest, apartment, park, dawn, dusk, midnight
```

### Post-processing (Bloom)

```jsx
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";

<EffectComposer>
  <SMAA />
  <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.5} />
</EffectComposer>
```

### Mesh with texture

```jsx
import { useTexture } from "@react-three/drei";

function TexturedMesh() {
  const map = useTexture("/textures/wood.jpg");
  
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial map={map} />
    </mesh>
  );
}
```

### Hooks from drei

```jsx
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture, useGLTF, useCursor } from "@react-three/drei";

// useFrame runs every render frame
function RotatingObject() {
  const ref = useRef();
  
  useFrame((state, delta) => {
    ref.current.rotation.x += delta * 0.5;
    ref.current.rotation.y += delta * 0.3;
  });
  
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" />
    </mesh>
  );
}
```

---

## lucide-react

### Import

```jsx
import { Play, Pause, Settings, X, ChevronRight, Menu } from "lucide-react";
```

### Usage

```jsx
<Play size={24} />
<Pause size={20} color="#3b82f6" />
<Settings size={16} strokeWidth={1.5} />
```

### In buttons

```jsx
<Button variant="ghost">
  <Settings size={18} />
  Settings
</Button>
```

---

## katex

### Import once at module level

```js
import katex from "katex";
import "katex/dist/katex.min.css";
```

### Inline equation

```jsx
function InlineEquation({ formula }) {
  return (
    <span 
      className="inline-block"
      dangerouslySetInnerHTML={{ 
        __html: katex.renderToString(formula, { 
          throwOnError: false,
          displayMode: false,
        }) 
      }} 
    />
  );
}
```

### Block equation

```jsx
function BlockEquation({ formula }) {
  return (
    <div 
      className="block my-4 text-center"
      dangerouslySetInnerHTML={{ 
        __html: katex.renderToString(formula, { 
          throwOnError: false,
          displayMode: true,
        }) 
      }} 
    />
  );
}
```

### Common formulas

```jsx
<InlineEquation formula="E = mc^2" />
<InlineEquation formula="\sum_{i=1}^{n} x_i" />
<BlockEquation formula="\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}" />
<BlockEquation formula="f(x) = \frac{1}{\sqrt{2\pi\sigma^2}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}" />
```

---

## mermaid

### Import once

```js
import mermaid from "mermaid";
mermaid.initialize({ 
  startOnLoad: false,
  theme: "dark",
  flowchart: { useMaxWidth: true },
});
```

### Render a diagram

```jsx
import { useEffect, useRef } from "mermaid";

function FlowDiagram({ definition }) {
  const svgRef = useRef(null);
  const idRef = useRef(0);
  
  useEffect(() => {
    const id = `flow-${idRef.current++}`;
    mermaid.render(id, definition).then(({ svg }) => {
      if (svgRef.current) {
        svgRef.current.innerHTML = svg;
      }
    });
  }, [definition]);
  
  return <div ref={svgRef} className="flex justify-center" />;
}
```

### Usage

```jsx
<FlowDiagram definition={`
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
  C --> E[End]
  D --> E
`} />
```

### Sequence diagram

```jsx
<FlowDiagram definition={`
sequenceDiagram
  participant User
  participant App
  participant API
  
  User->>App: Request
  App->>API: Forward
  API-->>App: Response
  App-->>User: Display
`} />
```

---

## Rules

### One motion engine per element — no exceptions

- `motion` animates the element → do not also GSAP it
- GSAP ScrollTrigger drives a section → do not add `motion` `useScroll` to a child of that section
- `framer-motion` on the element → do not also `motion` it
- Pick one. Not two.

### Find before you build

Before writing custom markup:
1. Check if shadcn/@react-bits has a component — use MCP or CLI to search
2. Check if `chart.js` or `lightweight-charts` covers your chart need
3. Check what `@react-three/drei` provides before writing Three.js helpers from scratch

### GSAP goes in MotionTemplates.ts

- New GSAP animation for the main app → add to `src/services/design/MotionTemplates.ts`
- Direct `import { gsap }` in a component → only for one-off experiments, clean up if it becomes a pattern

### No anime.js

- Not installed. Do not install it.
- Need a simple tween? Use `motion`'s `animate` prop or a CSS transition.

### Restraint — default to no animation

- If the brief does not call for animation, do not add one.
- Particle backgrounds, gradient blobs, staggered reveals — easy to overuse.
- One well-timed entrance beats five competing ones.
- If unsure whether an animation earns its place: cut it.

### Match intensity to the UI

- **Interactive feedback** (buttons, toggles, menus, hovers): 150-300ms, ease-out or low-bounce spring. Snappy.
- **Hero/landing moments**: 500ms+, expo/back/elastic eases, higher-bounce springs. Expressive.
- **Settings toggle**: do NOT use bouncy elastic.
- **Form input focus**: quick, 150ms or less.

### When unsure which tool

Go with whichever engine is already doing the most work on that page. Consistency beats picking the theoretically best tool in isolation.

- Page already uses `motion` for other animations → use `motion`
- Page already has GSAP ScrollTrigger on a section → keep using GSAP for that section
- Brand new page with no existing animation → default to `motion`

### Stale references — disregard

If any prompt, agent message, or older doc mentions these, ignore them:
- KokonutUI — not in this project
- Bklit UI — not in this project
- Anime.js — not in this project

If something is wrong with the instructions here, fix the files, not the code.

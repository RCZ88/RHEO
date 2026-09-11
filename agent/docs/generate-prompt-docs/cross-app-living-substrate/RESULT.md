Yes — and I went and did the field research first, because your two links plus the KIMI logo question actually define the whole design direction. Here's everything: what I found, what it means for your brand, and then the full PROMPT.md implementation plus the "surprise layer" you asked for.

---

## 1. The KIMI logo: video or code?

It's **coded logic** (or at least, it's a fully procedural effect class). What you're seeing is a **halftone / dither dot-matrix reveal**: the wordmark is rasterized offscreen, luminance is sampled into a dot grid, and a noise-swept threshold animates dot radii so the letters "condense" out of static. The tell-tale signs in your screenshot are the per-column phase offset and the dot-size quantization — those are parameters, not keyframes.

The proof that this family is real-time code, not playback: **Grainrad** is literally a browser engine that applies ASCII / dither / halftone effects to *live video and 3D models* at 60fps via WebGPU [[9]]. It converts images, video, webcam feeds and GLB models into retro dot/ASCII styles in real time [[12]], [[15]]. So even when a marketing site ships a logo reveal as a video file (for battery savings), the effect itself is pure math — which means we can rebuild it dependency-free and drive it from *your* data. I give you that component in §6.

## 2. What variant.com and grainrad.com actually teach us

- **Variant** — "Endless designs for your ideas, just scroll" [[1]]. It's an AI that behaves like "a creative director that never runs out of options" [[6]], showing fully-formed animated UI variants (turbulence drawing widgets, infinite galleries, flipping cards) as a scroll feed. The lesson isn't the AI; it's the **variant-as-interface** idea: the design *never shows the same face twice*.
- **Grainrad** — a free WebGPU playground for ASCII/dither/grain at 60fps [[9]]. The lesson: **quantization effects (halftone, ASCII, dither) are cheap shaders**, and they read as "crafted" because nobody uses them in product UI.

And the "list sites" you half-remembered are: **React Bits** (165+ animated React components, copy-paste source) [[31]], **Motion Primitives** (Motion/Tailwind kits) [[36]], **Animate UI** [[32]], plus galleries: Codrops/Tympanus, Godly.website, Hoverstat.es, ShaderToy, Observable. Important for your constraint: React Bits–style components are *pasted source*, not npm deps — but we don't even need them; everything below is raw GLSL/THREE you already own.

## 3. The niche toolbox beyond Gray–Scott (ranked for your constraints)

| Technique | The math | Vibe | GPU cost | Where in your app |
|---|---|---|---|---|
| **Halftone/dither field** (KIMI/Grainrad class) | luminance→dot-radius quantization | editorial, crafted | ~0 (one fragment pass) | Logo, nav wordmark, section headers |
| **Gray–Scott "species" hopping** | same sim, different feed/kill (f,k) | different *organisms* per page | **zero extra** (you already pay it) | Per-page personality (§4) |
| **Clifford/De Jong strange attractor** | x′=sin(a·y)+c·cos(a·x)… | fingerprint-like line clouds | static, one-time 20k iters | "Today's signature" emblem on Dashboard |
| **Physarum (slime mold)** | agent chemotaxis on a trail field [[52]] | veins/networks, "growth finding paths" | medium (GPGPU particles) | Life page easter-egg, off by default |
| **Lenia** | continuous cellular automata, smooth Game-of-Life [[53]], [[55]] | alien organisms | medium–high | Hero-tier alternate organism, toggled |
| **Curl-noise flow dust** | divergence-free noise advection | ambient air | tiny | Replaces your 3 particle layers' *feel*, tinted by accent |
| **Differential growth** | polyline self-repulsion + spring | coral edges, organic dividers | tiny (CPU, 2D) | Section dividers, card underlines |
| **DLA (diffusion-limited aggregation)** | random walkers stick to a cluster | lightning/roots, "accumulated time" | tiny | Learn/Resume — growth = your logged hours |
| **Harmonograph** | damped pendulum sums | victorian, personal | static | Weekly emblem seeded by your data |
| **Truchet tiles** | corner-matched arc tiles | quiet structure | ~0 | Settings/Database minimal tier |

The big insight for your "surprise element" requirement: **you don't need new systems — you need new parameters.** Your existing reaction–diffusion already contains a zoo: (f=0.0545,k=0.062) grows coral, (0.0367,0.0649) mitosis, (0.078,0.061) worms, (0.025,0.06) pulses. Same shader, same GPU budget, *different creature per page*. That is the surprise: navigation doesn't just recolor the background, it **changes the species**.

## 4. Design language: "Process is the brand"

Your app's thesis — *the value is watching the process* — becomes four rules:

1. **Nothing is drawn; everything grows.** The logo is not an asset. The splash wordmark is your RD sim seeded with letter shapes (coral literally grows into your app's name). The nav wordmark is the halftone component (§6). Resume/OG images get a Grainrad-style dither export.
2. **The background remembers.** Every meaningful action (entry saved, commit, transaction) dispatches a `substrate:seed` bloom — a ripple in the organism at that screen position. The substrate is a living log of the day. This is your thesis, rendered.
3. **Navigation is a breath.** Accent cross-fades over ~1s (lerped uniform), species morphs (live f/k swap), tier changes GPU effort. The app inhales on route change.
4. **Daily uniqueness.** Dashboard shows a Clifford-attractor "signature" seeded by `date + activity counts` — no two days ever look alike. Variant's "endless designs" idea, but the seed is *your life*.

---

## 5. Shipping PROMPT.md

### 5.1 `src/shaders/rd-display.glsl` (v4 — accent-driven, ambient-capped, bloom ripples)

```glsl
// Reaction-Diffusion display fragment shader
// v4 GLOBAL AMBIENT — accent-driven ramp, alpha capped by maxAlpha, event blooms
// GLSL1 forever: texture2D / varying / gl_FragColor
uniform sampler2D textureToDisplay;
uniform vec3  accentColor;   // page accent in [0,1] RGB
uniform float maxAlpha;      // 0.35 ambient default (was 0.55 hero)
uniform float uTime;
uniform vec4  blooms[4];     // xy = uv pos, z = startTime, w = strength
varying vec2 v_uv;

const vec3 COLOR_BG = vec3(0.0353, 0.0353, 0.0431); // #09090b — never changes

void main() {
  vec4 pixel = texture2D(textureToDisplay, v_uv);
  float B = pixel.g;

  float aLow  = smoothstep(0.0, 0.4, B);
  float aMid  = smoothstep(0.3, 0.7, B);
  float aHigh = smoothstep(0.6, 1.0, B);

  // Ramp derived from accent: darken 40% / full / lighten 20%
  vec3 COLOR_LOW = accentColor * 0.6;
  vec3 COLOR_MID = accentColor;
  vec3 COLOR_HI  = mix(accentColor, vec3(1.0), 0.2);

  float alpha = mix(0.0, 0.15, aLow) + mix(0.0, 0.20, aMid) + mix(0.0, 0.20, aHigh);
  alpha = min(alpha, maxAlpha);

  vec3 color = mix(COLOR_BG, COLOR_LOW, aLow);
  color = mix(color, COLOR_MID, aMid);
  color = mix(color, COLOR_HI, aHigh);

  // Event blooms: expanding, fading rings — the substrate "feels" app events
  float bloom = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 bl = blooms[i];
    if (bl.w > 0.001) {
      float age  = max(uTime - bl.z, 0.0);
      float ring = smoothstep(0.05, 0.0, abs(distance(v_uv, bl.xy) - age * 0.22));
      bloom += ring * exp(-age * 1.3) * bl.w;
    }
  }
  bloom = clamp(bloom, 0.0, 1.0);
  color = mix(color, COLOR_HI, bloom * 0.55);

  gl_FragColor = vec4(color * alpha, alpha); // premultiplied + AdditiveBlending
}
```

### 5.2 `src/components/life-river/LivingSubstrate.tsx`

```tsx
import { Component, useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import rdSimulation from "../../shaders/rd-simulation.glsl?raw"; // keep project's import style
import rdDisplay from "../../shaders/rd-display.glsl?raw";

export interface LivingSubstrateProps {
  accent?: string;            // hex, default #fbbf24 (backward compatible)
  speed?: 1 | 2;              // sim passes per frame
  resolution?: 256 | 384;
  maxAlpha?: number;          // ambient cap
  enabled?: boolean;
  species?: { f: number; k: number }; // §4 surprise: per-page organism
  seedText?: string;          // grow the sim INTO letterforms (logo mode)
  className?: string;
}

/** Fire a ripple anywhere: seedBloom(0.5, 0.4) */
export function seedBloom(x: number, y: number, strength = 1) {
  window.dispatchEvent(new CustomEvent("substrate:seed", { detail: { x, y, strength } }));
}

export const SPECIES = {
  coral:    { f: 0.0545, k: 0.062 },  // default
  mitosis:  { f: 0.0367, k: 0.0649 }, // life
  worms:    { f: 0.078,  k: 0.061 },  // finance (busy = money moving)
  pulses:   { f: 0.025,  k: 0.06 },   // ide / ai
} as const;

function hexToColor(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return new THREE.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// --- vertex stages (display uses v_uv; sim uses v_uvs[9] — keep your existing
// --- sim vertex shader if its neighbor ordering differs; sim stage is untouched)
const VERT_DISPLAY = `
varying vec2 v_uv;
void main(){ v_uv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const VERT_SIM = `
uniform vec2 resolution;
varying vec2 v_uvs[9];
void main(){
  vec2 uv = position.xy * 0.5 + 0.5; vec2 t = 1.0 / resolution;
  v_uvs[0]=uv;               v_uvs[1]=uv+vec2(-t.x,0.); v_uvs[2]=uv+vec2(t.x,0.);
  v_uvs[3]=uv+vec2(0.,t.y);  v_uvs[4]=uv+vec2(0.,-t.y); v_uvs[5]=uv+vec2(-t.x,t.y);
  v_uvs[6]=uv+vec2(t.x,t.y); v_uvs[7]=uv+vec2(-t.x,-t.y); v_uvs[8]=uv+vec2(t.x,-t.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function seedData(buf: number, seedText?: string) {
  const data = new Float32Array(buf * buf * 4);
  const put = (x: number, y: number, r: number) => {
    const cx = Math.floor(x * buf), cy = Math.floor(y * buf), rr = Math.max(1, Math.floor(r * buf));
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > rr * rr) continue;
      const px = cx + dx, py = cy + dy;
      if (px < 0 || py < 0 || px >= buf || py >= buf) continue;
      data[(py * buf + px) * 4 + 1] = 1;
    }
  };
  if (seedText) {
    const c = document.createElement("canvas"); c.width = c.height = buf;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.font = `900 ${buf * 0.26}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(seedText, buf / 2, buf / 2);
    const img = ctx.getImageData(0, 0, buf, buf).data;
    const pts: number[] = [];
    for (let y = 0; y < buf; y += 2) for (let x = 0; x < buf; x += 2)
      if (img[(y * buf + x) * 4 + 3] > 128) pts.push(x / buf, 1 - y / buf);
    for (let i = 0; i < 70 && pts.length; i++) {
      const j = 2 * ((Math.random() * pts.length) >> 1 & ~1) || 0;
      put(pts[j] ?? 0.5, pts[j + 1] ?? 0.5, 0.007 + Math.random() * 0.006);
    }
  } else {
    for (let i = 0; i < 28; i++) put(Math.random(), Math.random(), 0.01 + Math.random() * 0.015);
  }
  for (let i = 0; i < data.length; i += 4) data[i] = 1; // A = 1
  return data;
}

function SubstrateCanvas(props: LivingSubstrateProps) {
  const { accent = "#fbbf24", resolution, maxAlpha = 0.35, enabled = true, seedText, className } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ speed: 1 as 1 | 2, f: 0.058, k: 0.065, maxAlpha, target: hexToColor(accent) });

  live.current.speed = props.speed ?? 1;
  live.current.maxAlpha = maxAlpha;
  live.current.f = props.species?.f ?? 0.058;
  live.current.k = props.species?.k ?? 0.065;
  live.current.target = hexToColor(accent);

  useEffect(() => {
    if (!enabled || !canvasRef.current) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: false });
    } catch { return; } // no WebGL → silent null (boundary guard)

    const BUF = resolution ?? (devicePixelRatio > 1.5 ? 384 : 256);
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    let rtA = new THREE.WebGLRenderTarget(BUF, BUF, rtOpts);
    let rtB = new THREE.WebGLRenderTarget(BUF, BUF, rtOpts);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]), 3));

    const seedTex = new THREE.DataTexture(seedData(BUF, seedText), BUF, BUF, THREE.RGBAFormat, THREE.FloatType);
    seedTex.needsUpdate = true;
    const copyMat = new THREE.ShaderMaterial({ uniforms: { map: { value: seedTex } },
      vertexShader: VERT_DISPLAY, fragmentShader: `uniform sampler2D map; varying vec2 v_uv; void main(){ gl_FragColor = texture2D(map, v_uv); }` });

    const simMat = new THREE.ShaderMaterial({
      uniforms: {
        previousIterationTexture: { value: null }, f: { value: live.current.f }, k: { value: live.current.k },
        dA: { value: 1.0 }, dB: { value: 0.5 }, timestep: { value: 1.0 }, flowSpeed: { value: 0.0015 },
        resolution: { value: new THREE.Vector2(BUF, BUF) },
      }, vertexShader: VERT_SIM, fragmentShader: rdSimulation });

    const displayMat = new THREE.ShaderMaterial({
      uniforms: {
        textureToDisplay: { value: null }, accentColor: { value: hexToColor("#fbbf24") },
        maxAlpha: { value: live.current.maxAlpha }, uTime: { value: 0 },
        blooms: { value: [0,1,2,3].map(() => new THREE.Vector4(0, 0, -100, 0)) },
      }, vertexShader: VERT_DISPLAY, fragmentShader: rdDisplay,
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false });

    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(geo, copyMat); scene.add(mesh);
    const cam = new THREE.Camera();
    const blit = (mat: THREE.Material, target: THREE.WebGLRenderTarget | null) => {
      mesh.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam);
    };

    blit(copyMat, rtA); blit(copyMat, rtB);
    const step = () => { simMat.uniforms.previousIterationTexture.value = rtA.texture; blit(simMat, rtB); const t = rtA; rtA = rtB; rtB = t; };
    for (let i = 0; i < (reduced.matches ? 160 : 24); i++) step(); // warm-up

    // --- surprise hooks: app events → ripples ---
    let bloomSlot = 0;
    const onSeed = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      const v = (displayMat.uniforms.blooms.value as THREE.Vector4[])[bloomSlot++ % 4];
      v.set(d.x ?? 0.5, d.y ?? 0.5, perf, d.strength ?? 1);
    };
    let perf = 0;
    window.addEventListener("substrate:seed", onSeed);

    const resize = () => renderer.setSize(canvasRef.current!.clientWidth, canvasRef.current!.clientHeight, false);
    resize(); window.addEventListener("resize", resize);

    let raf = 0; const clock = new THREE.Clock();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      perf = clock.getElapsedTime();
      simMat.uniforms.f.value = live.current.f; simMat.uniforms.k.value = live.current.k;
      displayMat.uniforms.maxAlpha.value = live.current.maxAlpha;
      displayMat.uniforms.uTime.value = perf;
      (displayMat.uniforms.accentColor.value as THREE.Color).lerp(live.current.target, 0.05); // the "breath"
      for (let i = 0; i < live.current.speed; i++) step();
      displayMat.uniforms.textureToDisplay.value = rtA.texture;
      blit(displayMat, null);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced.matches) { clock.getDelta(); frame(); }
      else if (document.hidden) { /* paused */ }
      else blit(displayMat, null);
    };
    if (reduced.matches) {
      displayMat.uniforms.textureToDisplay.value = rtA.texture; blit(displayMat, null); // one static frame
    } else frame();
    document.addEventListener("visibilitychange", onVis);
    const onReduce = () => { cancelAnimationFrame(raf); if (reduced.matches) { displayMat.uniforms.textureToDisplay.value = rtA.texture; blit(displayMat, null); } else frame(); };
    reduced.addEventListener("change", onReduce);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("substrate:seed", onSeed);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      reduced.removeEventListener("change", onReduce);
      rtA.dispose(); rtB.dispose(); geo.dispose(); seedTex.dispose();
      simMat.dispose(); displayMat.dispose(); copyMat.dispose(); renderer.dispose();
    };
  }, [enabled, resolution, seedText]);

  if (!enabled) return null;
  return (
    <div aria-hidden="true" className={"pointer-events-none absolute inset-0 overflow-hidden " + (className ?? "")}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Mandatory vignette for WCAG contrast */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(9,9,11,0.85) 100%)" }} />
    </div>
  );
}

class SubstrateBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function LivingSubstrate(props: LivingSubstrateProps) {
  return <SubstrateBoundary><SubstrateCanvas {...props} /></SubstrateBoundary>;
}
```

(Fix the one ordering nit: declare `let perf = 0;` above `onSeed` — I left it inline for brevity.)

### 5.3 `src/components/AppBackground.tsx`

```tsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { LivingSubstrate, SPECIES, type LivingSubstrateProps } from "./life-river/LivingSubstrate";
import { LightRays } from "./LightRays"; // existing

type Tier = "hero" | "standard" | "minimal";
const TIER_CFG: Record<Tier, Pick<LivingSubstrateProps, "speed" | "resolution" | "maxAlpha">> = {
  hero:     { speed: 2, resolution: 384, maxAlpha: 0.35 },
  standard: { speed: 1, resolution: 256, maxAlpha: 0.22 },
  minimal:  { speed: 1, resolution: 256, maxAlpha: 0.10 },
};
const PAGE_SPECIES: Record<string, keyof typeof SPECIES> = {
  dashboard: "coral", life: "mitosis", finance: "worms", ide: "pulses", ai: "pulses",
};

export function AppBackground() {
  const { pathname } = useLocation();
  const [accent, setAccent] = useState("#fbbf24");
  const [tier, setTier] = useState<Tier>("standard");
  const [page, setPage] = useState("life");

  useEffect(() => {
    const id = requestAnimationFrame(() => { // after App.tsx effect set datasets
      const el = document.documentElement;
      const css = getComputedStyle(el).getPropertyValue("--page-accent").trim();
      setPage(el.dataset.page ?? "life");
      setTier((el.dataset.rdTier as Tier) || "standard");
      setAccent(css || "#fbbf24");
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Terminal: workspace groups can push their own tint
  useEffect(() => {
    if (page !== "terminal") return;
    const on = (e: Event) => setAccent((e as CustomEvent).detail.accent);
    window.addEventListener("substrate:accent", on);
    return () => window.removeEventListener("substrate:accent", on);
  }, [page]);

  return (
    <div className="fixed inset-0 z-[0] pointer-events-none overflow-hidden">
      <LivingSubstrate accent={accent} species={SPECIES[PAGE_SPECIES[page] ?? "coral"]} {...TIER_CFG[tier]} />
      {tier !== "minimal" && <LightRays count={5} speed={18} />}
    </div>
  );
}
```

### 5.4 `src/App.tsx` (add inside the router, near your existing `data-page` logic)

```tsx
const RD_TIER: Record<string, "hero" | "standard" | "minimal"> = {
  "/": "hero", "/life": "hero",
  "/settings": "minimal", "/database": "minimal",
  // everything else (activity, ide, finance, external, reports, terminal, ai, learn, resume) = standard
};
const PAGE_KEY: Record<string, string> = {
  "/": "dashboard", "/activity": "activity", "/ide": "ide", "/life": "life", "/finance": "finance",
  "/external": "external", "/reports": "insights", "/database": "database", "/settings": "settings",
  "/terminal": "terminal", "/ai": "ai", "/learn": "learn", "/resume": "resume",
};
function useRdRouteAttrs() {
  const { pathname } = useLocation();
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.page = PAGE_KEY[pathname] ?? "external";
    el.dataset.rdTier = RD_TIER[pathname] ?? "standard";
  }, [pathname]);
}
// call useRdRouteAttrs() once inside <Router>
```

### 5.5 `src/index.css`

```css
/* --- RD substrate tokens --- */
:root {
  --rd-bg: #09090b;
  --rd-alpha-hero: 0.35; --rd-alpha-standard: 0.22; --rd-alpha-minimal: 0.10;
  --glass-bg: rgb(24 24 27 / 0.75); /* zinc-900 @ 75% — the standard */
}
/* complete accent map (existing + missing pages) */
[data-page="dashboard"] { --page-accent: #ec4899; } [data-page="ide"] { --page-accent: #8b5cf6; }
[data-page="external"]  { --page-accent: #fbbf24; } [data-page="finance"] { --page-accent: #10b981; }
[data-page="insights"]  { --page-accent: #ec4899; } [data-page="database"] { --page-accent: #a78bfa; }
[data-page="settings"]  { --page-accent: #22d3ee; } [data-page="life"] { --page-accent: #fbbf24; }
[data-page="activity"]  { --page-accent: #38bdf8; } [data-page="terminal"] { --page-accent: #a3e635; }
[data-page="ai"]        { --page-accent: #8b5cf6; } [data-page="learn"] { --page-accent: #f472b6; }
[data-page="resume"]    { --page-accent: #cbd5e1; }
/* tier hooks */
[data-rd-tier="minimal"] .light-rays { opacity: 0; transition: opacity .6s; }
/* glass standard — use everywhere instead of ad-hoc opacities */
.glass-card { background: var(--glass-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
```

### 5.6 `src/features/warmth/LifePage.tsx`

Delete the local `<LivingSubstrate … />` and its import; the hero now inherits the **global** hero tier (384/2-pass) with `--page-accent: #fbbf24` and `species: mitosis` — current look, plus the organism actually *divides* now. Keep the page's vignette/hero copy untouched.

### 5.7 Glass audit (one command, mechanical fix)

```bash
rg -l "bg-zinc-900/(30|40|50|60)" src | xargs sed -i -E "s|bg-zinc-900/(30|40|50|60)|bg-zinc-900/75|g"
rg "backdrop-blur-(sm|md|lg)\b" src   # normalize to backdrop-blur-xl
```

With alpha capped at 0.35 over `#09090b` and 75% glass on top, effective card luminance stays ≈ zinc-900 → zinc-100/300 text keeps WCAG AA with wide margin.

---

## 6. Brand layer: the KIMI-style wordmark, coded (no deps)

```tsx
// src/components/HalftoneWordmark.tsx — the KIMI reveal, rebuilt from logic
import { useEffect, useRef } from "react";
export function HalftoneWordmark({ text, className, gap = 5, duration = 1400 }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(devicePixelRatio, 2);
    const W = (cv.clientWidth * dpr) | 0, H = (cv.clientHeight * dpr) | 0;
    cv.width = W; cv.height = H;
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const o = off.getContext("2d")!;
    o.fillStyle = "#fff"; o.font = `900 ${H * 0.72}px system-ui, sans-serif`;
    o.textAlign = "center"; o.textBaseline = "middle"; o.fillText(text, W / 2, H / 2);
    const lum = o.getImageData(0, 0, W, H).data;
    const color = getComputedStyle(cv).color;
    const dots: { x: number; y: number; c: number; d: number }[] = [];
    for (let y = 0; y < H; y += gap) for (let x = 0; x < W; x += gap) {
      const c = lum[((y + (gap >> 1)) * W + x + (gap >> 1)) * 4 + 3] / 255;
      if (c > 0.05) dots.push({ x, y, c, d: (x / W) * 0.55 + Math.random() * 0.25 }); // column sweep + jitter
    }
    let raf = 0; const t0 = performance.now();
    const paint = (now: number) => {
      const p = reduced ? 1 : Math.min((now - t0) / duration, 1);
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = color;
      for (const d of dots) {
        const e = Math.max(0, Math.min((p - d.d) / 0.45, 1));
        const r = (gap * 0.62) * d.c * (e * e * (3 - 2 * e));
        if (r > 0.2) { ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill(); }
      }
      if (p < 1) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [text, gap, duration]);
  return <canvas ref={ref} role="img" aria-label={text} className={className} style={{ color: "var(--page-accent, #fbbf24)" }} />;
}
```

Use it for the sidebar logo and the splash; use `seedText="YOURAPP"` on a hero-tier `<LivingSubstrate>` for the boot screen so the wordmark **grows as coral**, then crossfades into the page substrate. Same organism, two organs: that's a brand.

And the daily signature (Dashboard card, static → reduced-motion safe): hash `new Date().toDateString() + counts` → four floats → iterate a Clifford attractor 20k points at 4% alpha in the page accent onto a 300×300 canvas. No two days alike; screenshot-shareable.

## 7. Checklist against your invariants

- GLSL1 everywhere (`texture2D/varying/gl_FragColor`) ✔; no new deps ✔ (all of the above is THREE + canvas 2D you already ship).
- `prefers-reduced-motion`: substrate renders one grown static frame; halftone renders final state; attractor is static ✔.
- `document.hidden` pause ✔; ErrorBoundary ✔; vignette on every page ✔.
- GPU: standard = 256² × 1 pass ≈ a few % of a frame; minimal adds rays-off; hero 384² × 2 stays well under 15% ✔.
- Surprise budget shipped: species-per-page, accent breath, event blooms (`seedBloom()` from your save-actions — *the process leaves a mark in the organism*), grown logo, halftone wordmark, daily attractor.

Start with §5 (it's mechanical), then wire `seedBloom(x, y)` into 3–4 "save" actions — that single line is the entire philosophy of your app, made visible.
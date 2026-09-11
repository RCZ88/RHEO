# CONTEXT BUNDLE — Ferrofluid background lag (App Tracker / RHEO Electron app)

Task: fullscreen Ferrofluid WebGL background makes the app super laggy. Design a performance fix.
Docs folder: `agent/docs/generate-prompt-docs/ferrofluid-background-lag-09092026/`
Codebase root (Windows): `C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker\`

## 1. Current implementation — full source of every touched file

### src/components/AppBackground.tsx (lines 1-58, full file):
```tsx
import { useEffect, useState } from 'react';
import Ferrofluid from './Ferrofluid';

// Full-app background: fixed Ferrofluid canvas + dark overlay for readability.
// Ferrofluid listens for pointermove on its own canvas, so window-level moves
// are forwarded — otherwise content sitting above would swallow interaction.
// (Replaces the previous Particles + LightRays layer; see git history.)
export function AppBackground({ pathname: _pathname = '/' }: { pathname?: string }) {
  const [paused] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const fwd = (e: PointerEvent) => {
      const canvas = document.querySelector('#app-ferrofluid canvas');
      if (!canvas) return;
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: e.clientX,
          clientY: e.clientY,
          bubbles: false,
          cancelable: false,
        })
      );
    };
    window.addEventListener('pointermove', fwd, { passive: true });
    return () => window.removeEventListener('pointermove', fwd);
  }, []);

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden" aria-hidden="true">
      <div id="app-ferrofluid" className="absolute inset-0">
        <Ferrofluid
          colors={['#ffffff', '#ffffff', '#ffffff']}
          speed={0.1}
          scale={1.8}
          turbulence={1}
          fluidity={0.1}
          rimWidth={0.2}
          sharpness={1.5}
          shimmer={1.1}
          glow={1}
          flowDirection="down"
          opacity={1}
          mouseInteraction={true}
          mouseStrength={1}
          mouseRadius={0.3}
          paused={paused}
        />
      </div>
      {/* Readability overlay — canvas stays visible through glass panels */}
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
```

### src/components/Ferrofluid.tsx (lines 1-68, props + helpers + vertex/fragment head):
```tsx
import React, { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

export interface FerrofluidProps {
  className?: string;
  dpr?: number;
  paused?: boolean;
  colors?: string[];
  speed?: number;
  scale?: number;
  turbulence?: number;
  fluidity?: number;
  rimWidth?: number;
  sharpness?: number;
  shimmer?: number;
  glow?: number;
  flowDirection?: 'up' | 'down' | 'left' | 'right';
  opacity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  mouseRadius?: number;
  mouseDampening?: number;
  mixBlendMode?: string;
}

type RGB = [number, number, number];

const MAX_COLORS = 8;

const hexToRGB = (hex: string): RGB => {
  const c = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const prepColors = (input?: string[]) => {
  const base = (input && input.length ? input : ['#4F46E5', '#06B6D4', '#E0F2FE']).slice(0, MAX_COLORS);
  const count = base.length;
  const arr: RGB[] = [];
  for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
  const avg: RGB = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }
  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;
  return { arr, count, avg };
};

const flowVec = (d?: string): [number, number] => {
  switch (d) {
    case 'up':
      return [0, 1];
    case 'down':
      return [0, -1];
    case 'left':
      return [-1, 0];
    case 'right':
      return [1, 0];
    default:
      return [0, -1];
  }
};

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uMouseColor;
uniform vec2  uFlow;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;

varying vec2 vUv;

#define PI 3.14159265

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

float hash(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed));
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  float t = iTime;

  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  vec3 outc = col * ltn;
  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;
```

### src/components/Ferrofluid.tsx (lines 213-260, component open + renderer setup):
```tsx
const Ferrofluid: React.FC<FerrofluidProps> = ({
  className,
  dpr,
  paused = false,
  colors = ['#ffffff', '#ffffff', '#ffffff'],
  speed = 0.5,
  scale = 1.6,
  turbulence = 1,
  fluidity = 0.1,
  rimWidth = 0.2,
  sharpness = 2.5,
  shimmer = 1.5,
  glow = 2,
  flowDirection = 'down',
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 1,
  mouseRadius = 0.35,
  mouseDampening = 0.15,
  mixBlendMode
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<Program | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const geometryRef = useRef<Triangle | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
      alpha: true,
      antialias: true
    });
    rendererRef.current = renderer;
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.clearColor(0, 0, 0, 0);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);
```

### src/components/Ferrofluid.tsx (lines 292-404, uniforms, loop, cleanup, effect deps):
```tsx
    const program = new Program(gl, { vertex, fragment, uniforms });
    programRef.current = program;

    const geometry = new Triangle(gl);
    geometryRef.current = geometry;
    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sc = renderer.dpr || 1;
      const x = (e.clientX - rect.left) * sc;
      const y = (rect.height - (e.clientY - rect.top)) * sc;
      mouseTargetRef.current = [x, y];
      if (mouseDampening <= 0) {
        uniforms.iMouse.value = [x, y];
      }
    };
    if (mouseInteraction) {
      canvas.addEventListener('pointermove', onPointerMove);
    }

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      uniforms.iTime.value = t * 0.001;
      if (mouseDampening > 0) {
        if (!lastTimeRef.current) lastTimeRef.current = t;
        const dt = (t - lastTimeRef.current) / 1000;
        lastTimeRef.current = t;
        const tau = Math.max(1e-4, mouseDampening);
        let factor = 1 - Math.exp(-dt / tau);
        if (factor > 1) factor = 1;
        const target = mouseTargetRef.current;
        const cur = uniforms.iMouse.value as number[];
        cur[0] += (target[0] - cur[0]) * factor;
        cur[1] += (target[1] - cur[1]) * factor;
      } else {
        lastTimeRef.current = t;
      }
      if (!paused && programRef.current && meshRef.current) {
        try {
          renderer.render({ scene: meshRef.current });
        } catch (e) {
          console.error(e);
        }
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mouseInteraction) canvas.removeEventListener('pointermove', onPointerMove);
      ro.disconnect();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
      const callIfFn = (obj: unknown, key: string) => {
        const fn = obj && (obj as Record<string, unknown>)[key];
        if (typeof fn === 'function') {
          (fn as () => void).call(obj);
        }
      };
      callIfFn(programRef.current, 'remove');
      callIfFn(geometryRef.current, 'remove');
      callIfFn(meshRef.current, 'remove');
      callIfFn(rendererRef.current, 'destroy');
      programRef.current = null;
      geometryRef.current = null;
      meshRef.current = null;
      rendererRef.current = null;
    };
  }, [
    dpr, paused, colors, speed, scale, turbulence, fluidity,
    rimWidth, sharpness, shimmer, glow, flowDirection, opacity,
    mouseInteraction, mouseStrength, mouseRadius, mouseDampening
  ]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden relative ${className ?? ''}`}
      style={{
        ...(mixBlendMode && { mixBlendMode: mixBlendMode as React.CSSProperties['mixBlendMode'] })
      }}
    />
  );
};

export default Ferrofluid;
```

### src/App.tsx shell (lines 2658-2680, mount point):
```tsx
  return (
    <VoiceProvider>
    <TutorialProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-[#121212] text-white">
      <TitleBar />
      <AppBackground />
      <div className="flex flex-1 min-h-0 relative">
      {/* Sidebar hidden on workspace (/terminal) and during solar overlay */}
      {location.pathname !== '/terminal' && !solarOverlayActive && (
        <Sidebar ... />
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
```
- Import (line 42): `import { AppBackground } from './components/AppBackground';`

## 2. Dependencies / build
- `package.json`: `"ogl": "^1.0.11"`, `"electron": "^41.1.1"`, `"react": "^19.2.0"`, `"vite": "^7.3.1"`
- Scripts: `"build": "node scripts/build.mjs"` (all-in-one: renderer + preload + main + services). Dev: `npx vite --port <PORT> --host`. Start: `electron .`
- Last full build: exit 0. Renderer bundle `dist/assets/index.DIVCwDkT.js` contains `uMouseStrength` ×3, `app-ferrofluid` ×2.

## 3. Runtime environment (perf-relevant)
- Electron 41, launched with `--ozone-platform=x11`, main window opaque (`transparent: false`, `backgroundColor: '#101012'` in one path; boot splash uses `transparent: true`)
- Canvas is fullscreen `position: fixed; inset: 0` behind ALL routes, always mounted (never unmounted on route change)
- `dpr` prop NOT passed → renderer uses raw `window.devicePixelRatio` (uncapped — 2x/3x HiDPI = 4-9x pixels), `antialias: true`
- rAF loop runs forever once mounted: no `document.visibilitychange` handling, no IntersectionObserver, no frame-skip when tab/window occluded or minimized; `paused` is only true under `prefers-reduced-motion`
- Every `pointermove` anywhere in the app constructs + dispatches a synthetic `PointerEvent` to the canvas (AppBackground `fwd` listener, `{ passive: true }`)
- Fragment shader per-pixel cost: 2× `vn()` (4 hash each) + 2× `dbn()` (5 `vn()` calls each = 10 `vn`) + 1 shimmer `vn()` ≈ 13 value-noise evals + `exp2`/`log2` smooth-min + `pow()` + `exp()` mouse falloff, at `highp`, fullscreen, every frame
- Glass panels above canvas: `.glass` = `rgba(17,17,17,0.8)` + `backdrop-filter: blur(20px)` — backdrop blur over a constantly repainting WebGL canvas forces full-screen re-composites
- Previous background (Particles ×2 + LightRays, DOM/canvas 2D) did NOT lag; lag appeared only after the Ferrofluid swap

## 4. Design tokens in play
- Root: `bg-[#121212] text-white`; overlay: `bg-black/60` above canvas
- Glass: `background: rgba(17, 17, 17, 0.8); backdrop-filter: blur(20px); border: 1px solid #27272a`
- Fonts: Inter / Space Grotesk / JetBrains Mono (Google Fonts link in index.html)
- Dark mode only. Canvas colors: all `#ffffff` under a black 60% overlay.

## 5. State management (background only)
- Local `useState` for reduced-motion `paused`; no store, no IPC, no DB. Purely frontend — no backend gaps.

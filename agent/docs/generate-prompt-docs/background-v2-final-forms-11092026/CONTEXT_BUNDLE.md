# CONTEXT BUNDLE — BACKGROUND-V2 final forms + fit recommendation

Task: bring ALL SIX background candidates to their final best form, ship animated
Thread Field (#2), and recommend which candidate fits the RHEO app properly.
Target AI reads this file FIRST and designs from it only. Do not invent APIs,
files, or components not listed here.

## 1. Rulings in force (principal's constitution)

- **R-35 Architecture:** static depth stack, bottom→top: `--ws-surface` →
  radial luminance wash (white ≤4% alpha, centered ~35%/20%) → the composition
  layer (whichever candidate ships) → edge vignette (black →~35% at corners,
  luminance masking) → static grain (SVG feTurbulence ~2–3% opacity) →
  existing `bg-black/60` overlay untouched → content. Frozen frames monochrome.
- **R-36 Motion tier law:** T0 STILL = default. T1 INPUT-ONLY permitted only on
  conditions. T2 AMBIENT = rejected by default, grantable as named exception.
  **T2 EXCEPTION GRANTED by principal for candidate #2 (Thread Field) ONLY.**
  All other candidates ship T0. Reduced-motion → T0 always (RM-perfect).
- **R-37 Sequencing/scope:** claims on EXACTLY `src/components/AppBackground.tsx`
  + ONE new file `src/components/ThreadField.tsx`. FORBIDDEN: `src/App.tsx`
  (mount line unchanged), `src/pages/SettingsPage.tsx`, preload/main (read-only),
  `landing/**`, new npm deps. `Ferrofluid.tsx` + `FerrofluidLite.tsx` stay on
  disk, unmounted — DO NOT DELETE (rollback evidence).
- **§8-3 (R-5 glass-blur lever):** CLOSED as moot under static layers.
- **G-BG-7 (LAMINAR):** zero new hex outside in-file constant blocks, no
  glass/blur added, no transitions on the stack, monochrome frames only
  (pixel sample: max channel delta ≤2).

## 2. Current implementation — full source

### 2.1 src/components/AppBackground.tsx (236 lines, full file)

```tsx
import { memo, useEffect, useRef, useState } from 'react';
import Ferrofluid, { type FerrofluidHandle, type FerrofluidProps } from './Ferrofluid';

const BACKGROUND_COLORS = ['#ffffff', '#ffffff', '#ffffff'];

const SEEDS: Array<Ferrofluid['props']> = [
  { seed: 7,   speed: 0.5, scale: 2.4, turbulence: 0.6,  fluidity: 0.08, rimWidth: 0.28, sharpness: 2.2, shimmer: 0.8, glow: 2.4, flowDirection: 'down' },
  { seed: 23,  speed: 0.5, scale: 2.0, turbulence: 0.5,  fluidity: 0.1,  rimWidth: 0.3,  sharpness: 2.0, shimmer: 0.6, glow: 2.2, flowDirection: 'down' },
  { seed: 41,  speed: 0.5, scale: 2.8, turbulence: 0.4,  fluidity: 0.06, rimWidth: 0.32, sharpness: 1.8, shimmer: 0.4, glow: 2.6, flowDirection: 'down' },
  { seed: 88,  speed: 0.5, scale: 2.2, turbulence: 0.45, fluidity: 0.09, rimWidth: 0.25, sharpness: 2.4, shimmer: 0.5, glow: 2.0, flowDirection: 'down' },
  { seed: 112, speed: 0.5, scale: 1.8, turbulence: 0.55, fluidity: 0.12, rimWidth: 0.22, sharpness: 2.6, shimmer: 0.7, glow: 1.8, flowDirection: 'down' },
  { seed: 156, speed: 0.5, scale: 3.0, turbulence: 0.35, fluidity: 0.05, rimWidth: 0.35, sharpness: 1.6, shimmer: 0.3, glow: 2.8, flowDirection: 'down' },
];

const WARMUP_FRAMES = 10;

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
function pickSeed(): typeof SEEDS[number] {
  return SEEDS[dayOfYear() % SEEDS.length];
}

const WASH_ALPHA = 0.04;
const VIGNETTE_ALPHA = 0.35;
const GRAIN_OPACITY = 0.02;

const washStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: `radial-gradient(ellipse at 35% 20%, rgba(255,255,255,${WASH_ALPHA}) 0%, rgba(255,255,255,0) 65%)`,
};
const vignetteStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,${VIGNETTE_ALPHA}) 100%)`,
};
const grainStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none', opacity: GRAIN_OPACITY,
  backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")',
  backgroundSize: '200px 200px',
  mixBlendMode: 'overlay' as const,
};

export const AppBackground = memo(function AppBackground({ pathname: _pathname = '/' }: { pathname?: string }) {
  const ffRef = useRef<FerrofluidHandle>(null);
  const [seedInfo] = useState(() => pickSeed());
  const frozenLog = useRef(false);
  useEffect(() => { if (!frozenLog.current) { frozenLog.current = true; } }, [seedInfo.seed]);

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden" aria-hidden="true">
      <div style={washStyle} aria-hidden="true" />
      <div className="absolute inset-0" id="app-ferrofluid">
        <Ferrofluid ref={ffRef} colors={BACKGROUND_COLORS}
          seed={seedInfo.seed} warmupFrames={WARMUP_FRAMES} monochrome={true}
          mouseInteraction={seedInfo.mouseInteraction} mouseStrength={seedInfo.mouseStrength}
          mouseRadius={seedInfo.mouseRadius} {...seedInfo} />
      </div>
      <div style={vignetteStyle} aria-hidden="true" />
      <div style={grainStyle} aria-hidden="true" />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
});
```

NOTE — known type wart in the file above: `Array<Ferrofluid['props']>` is not a
valid type query (Ferrofluid is a value) and the seed objects carry no
`mouseInteraction`/`mouseStrength`/`mouseRadius` fields yet the JSX reads
`seedInfo.mouseInteraction` etc. The executor's spec must resolve this with a
proper `SeedParams` interface (all fields the JSX consumes) — see PROMPT.md.

### 2.2 src/components/Ferrofluid.tsx — ogl WebGL shader (623 lines, key sections)

Props interface (lines 4–37), incl. BACKGROUND-V2 additions:

```tsx
export interface FerrofluidProps {
  className?: string; dpr?: number; paused?: boolean; colors?: string[];
  speed?: number; scale?: number; turbulence?: number; fluidity?: number;
  rimWidth?: number; sharpness?: number; shimmer?: number; glow?: number;
  flowDirection?: 'up' | 'down' | 'left' | 'right'; opacity?: number;
  mouseInteraction?: boolean; mouseStrength?: number; mouseRadius?: number;
  mouseDampening?: number; mixBlendMode?: string; ref?: React.Ref<FerrofluidHandle>;
  seed?: number; warmupFrames?: number; monochrome?: boolean;   // [BACKGROUND-V2]
}
export interface FerrofluidHandle {
  setPointer: (clientX: number, clientY: number) => void;
  isFrozen: () => boolean;   // [BACKGROUND-V2] true after freeze + loseContext
}
```

BACKGROUND-V2 uniforms added alongside the existing ones:

```tsx
uMouseEnabled: { value: 0 }, uMouseStrength: { value: 0 },   // mouse killed in frozen mode
uSeed: { value: seed },
uMonochrome: { value: monochrome ? 1 : 0 },
uTimeFrozen: { value: 0 },
uLuminanceMix: { value: 1.0 },
uKillSwitch: { value: 0 },
```

Shader-side functions (GLSL): `hash(vec3 p3, float seed)`, `vn(vec2 p, float s,
float seed)`, `dbn(vec2 p, float s, float seed)` (4-tap, weights 2/1.5/1.25/1.25),
`mainImage` with kill-switch early bail (`if (uKillSwitch > 0.5)` → transparent
black), time select (`float t = uTimeFrozen > 0.5 ? 0.0 : iTime`), all noise
seeds uSeed-derived, monochrome mix
(`lum = dot(outc, vec3(0.2126, 0.7152, 0.0722)); outc = mix(outc, vec3(lum), uLuminanceMix);`).

JS loop (lines 489–548): warmup counter → at `warmupFrames` sets
`uTimeFrozen=1`, `uKillSwitch=1`, calls `gl.loseContext()`, sets
`killDoneRef=true`, logs `[RHEO] Background frozen (seed=N, frames=K)`, cancels
rAF permanently. `wakeRef` and `onVisibility` both gate on `killDoneRef` so the
dead canvas is never re-armed. Non-monochrome path keeps legacy 8s idle freeze.
Effect deps include `seed, warmupFrames, monochrome`. Renderer: `ogl` Renderer,
`dpr * 0.5` (RENDER_SCALE), `alpha: true, antialias: false`.

### 2.3 Mount point — src/App.tsx (READ-ONLY, unchanged)

- Line 42: `import { AppBackground } from './components/AppBackground';`
- Line 2676: `<AppBackground />` (no props — `pathname` defaults to `'/'`)
- Do NOT touch. The new ThreadField mounts INSIDE AppBackground.tsx only.

### 2.4 Preview reference — background-v2-preview.html (repo root, NOT shipped)

Single-file interactive preview with all 6 candidates toggleable + simulated app
UI overlay + 6 seed buttons for #1. Techniques used (mirror these in final form):
- #1: half-res pixel loop (dual fbm → smin → rim band → glow), upscale, wash,
  vignette, grain. NOTE: uses `Math.pow(2,x)`/`Math.log(x)/Math.LN2` NOT
  `Math.exp2`/`Math.log2` (target engine lacks them — same constraint applies
  to shipped JS).
- #2: 340 threads × 130 steps, angle = fbm * 4π, alpha 0.16 × edge fade.
- #3: pure CSS (minor 32px / major 160px / dots + reticle + masks).
- #4: 16 filled ridges, black fill occlusion, top-edge strokes 0.10→0.40.
- #5: canvas spine, ticks every 32px, numbered majors every 160px, caps.
- #6: 90 particles + 4 rays, rAF (rollback reference only — NOT shipped).

## 3. The six candidates (all under the R-35 stack)

| # | Name | Technique | Motion tier | Status |
|---|------|-----------|-------------|--------|
| 1 | STILL FLUID | frozen ferrofluid frame (existing Ferrofluid.tsx) | T0 | implemented, needs final-form polish spec |
| 2 | THREAD FIELD | NEW ThreadField.tsx canvas2D flow-field hairlines | T2 (exception granted) | SHIP THIS WAVE |
| 3 | MERIDIAN GRID | pure CSS grid + wash + grain | T0 | needs final-form spec (deferred) |
| 4 | RIDGELINE SHORE | one-shot SVG/canvas contours | T0 | needs final-form spec (deferred) |
| 5 | SPINE | hairline + ruler ticks | T0 | needs final-form spec (deferred) |
| 6 | ROLLBACK | Particles + LightRays from git history | animated legacy | reference only, never ships |

## 4. Design tokens + constraints

- App is RHEO (Electron + React 19 + Vite). NEVER call it TURGO.
- Overlay readability: `bg-black/60` sits above the background; glass cards use
  `bg-zinc-900/80 backdrop-blur-xl`, max `rounded-xl`. Fonts: Geist + JetBrains Mono.
- Legibility law (R-20, applied app-side): informational text over the composite's
  BRIGHTEST region ≥ 4.5:1 — executor measures worst-case pair (G-BG-5).
- No new npm deps. No new hex outside in-file constant blocks. No transitions on
  the stack. `aria-hidden="true"` on all background layers. `paused` prop honors
  `prefers-reduced-motion` (frozen frame, never blank).
- Verify: `node scripts/build.mjs` exit 0 (rm -rf dist FIRST, verify served
  artifact); `npx tsc --noEmit -p tsconfig.app.json` — TOTAL + DELTA (delta 0
  outside docs/debt.md). Note: repo has 8000+ pre-existing tsc lines in
  unrelated files (terminal_backup etc.) — only the two claimed files must be clean.

## 5. Gates (executor runs these verbatim, included for spec calibration)

G-BG-1 build exit 0 · G-BG-2 tsc clean on claimed files · G-BG-3 ZERO-LOOP PROOF
for static layers + bounded-rAF proof for ThreadField (frame budget ≤8ms p95,
rAF counter increments only while visible) · G-BG-4 60s PERF CAPTURE vs F-2
baseline (rAF-delta percentiles + per-process CPU) · G-BG-5 LEGIBILITY ≥4.5:1
worst-case · G-BG-6 SHELL-LAUNCH screenshots to evidence/BACKGROUND-V2/ ·
G-BG-7 LAMINAR (monochrome pixel sample max channel delta ≤2) · G-BG-8 HYGIENE
(one commit `feat: animated thread-field background (BACKGROUND-V2)`).

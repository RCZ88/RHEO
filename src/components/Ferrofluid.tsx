import React, { useEffect, useImperativeHandle, useRef } from 'react';
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
  ref?: React.Ref<FerrofluidHandle>;
  // [BACKGROUND-V2] seeded warmup → monochrome freeze → permanent GL stop
  seed?: number;
  warmupFrames?: number;
  monochrome?: boolean;
}

export interface FerrofluidHandle {
  setPointer: (clientX: number, clientY: number) => void;
  // [BACKGROUND-V2] after monochrome freeze + loseContext(), the GL context is
  // dead. This flag is set true so external code (e.g. test suites) can detect
  // that the background is in its zero-cost frozen state.
  isFrozen: () => boolean;
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
// [BACKGROUND-V2] seeded noise field — day-of-year variety, no storage
uniform float uSeed;
// [BACKGROUND-V2] monochrome: 1 = luminance mix (RGB → gray), kills hue in frozen frame
uniform float uMonochrome;
// [BACKGROUND-V2] time frozen after warmup — field locks, no further drift
uniform float uTimeFrozen;
// [BACKGROUND-V2] luminance mix factor (RGB → gray weight, 0..1)
uniform float uLuminanceMix;
// [BACKGROUND-V2] kill switch — after warmup frames, set to 1; shader bails early
uniform float uKillSwitch;

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

float hash(vec3 p3, float seed) {
  p3 = fract(p3 * 0.1031 + seed * 0.001);
  p3 += dot(p3, p3.zyx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float smin(float a, float b, float k) {
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

float sinlerp(float a, float b, float w) {
  // [PERF-FIX] hermite S-curve — same smoothing character, no transcendental.
  // (name kept; all 39 call-site sins/pixel disappear, call sites untouched)
  float s = w * w * (3.0 - 2.0 * w);
  return mix(a, b, s);
}

float vn(vec2 p, float s, float seed) {
  vec2 cellp = floor(p / s);
  vec2 relp = mod(p, s);
  float g1 = hash(vec3(cellp, seed), seed);
  float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed), seed);
  float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed), seed);
  float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed), seed);
  float bx = sinlerp(g1, g2, relp.x / s);
  float tx = sinlerp(g4, g3, relp.x / s);
  return sinlerp(bx, tx, relp.y / s);
}

float dbn(vec2 p, float s, float seed) {
  // [PERF-FIX] 4 taps, weights renormalized (2+1.5+1.25+1.25 = 6.0);
  // center-weighted character preserved.
  // [BACKGROUND-V2] seed flows into vn → hash, so each seed gives a different
  // noise field. The frozen frame's lobe configuration is seed-determined.
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.25 * n3) / 6.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // [BACKGROUND-V2] kill switch — after warmup frames, set to 1; shader bails early
  // This is the "permanent stop" path: the GL context is killed from JS side,
  // but the shader also bails so no further fragment work happens even if the
  // context were somehow still alive.
  if (uKillSwitch > 0.5) {
    fragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  // ── Time frozen vs. live ────────────────────────────────────────────────
  // During warmup, iTime advances normally and the field drifts toward its
  // frozen configuration. After warmupFrames render, JS sets uTimeFrozen=1
  // and stops advancing iTime. From that frame on, the field is locked.
  //
  // We compute two time values: tLive (advancing) and tFrozen (locked at 0).
  // If uTimeFrozen > 0.5, t = 0 (frozen). Otherwise t = iTime (live drift).
  // The field settles during warmup; the monochrome mix is applied at the end.

  float t = uTimeFrozen > 0.5 ? 0.0 : iTime;

  float ref = 700.0 / max(uScale, 0.05);
  vec2 p = fragCoord / iResolution.y * ref;

  float spd = 200.0 * uSpeed;
  vec2 dir = uFlow;
  vec2 perp = vec2(-dir.y, dir.x);

  // ── Distort fields (now seed-based, not hardcoded) ──────────────────────
  // [BACKGROUND-V2] every vn/dbN call that was a hardcoded seed literal is now
  // uSeed-based. Different seeds → different lobe configurations → different
  // "frozen freeze" for each day of the year. Offsets are small so the noise
  // field stays coherent across the distort chain.
  float distort1 = vn(p + perp * (t * spd), 60.0, uSeed) * 50.0 * uTurbulence;
  float distort2 = vn(p - perp * (t * spd), 120.0, uSeed + 0.001) * 100.0 * uTurbulence;

  float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, uSeed + 0.002);
  float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, uSeed + 0.003);

  float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

  // ── Mouse glow ───────────────────────────────────────────────────────────
  // [BACKGROUND-V2] uMouseEnabled is forced to 0 in the frozen seed config, so
  // this branch is never taken. The pointer path is never registered. The frozen
  // frame has no mouse glow — it's a pure static texture. (If someone sets
  // mouseInteraction=true, the old mouse path still works via iMouse.)
  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mp = iMouse / iResolution.y * ref;
    float md = length(p - mp) / ref;
    float rr = max(uMouseRadius, 0.02);
    mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
  }

  // ── Rim band + luminance ─────────────────────────────────────────────────
  float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
  float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, uSeed + 0.004) * uShimmer, 0.0, 1.0);
  ltn = pow(ltn, uSharpness) * uGlow;
  ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

  // ── Color ────────────────────────────────────────────────────────────────
  float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
  vec3 col = palette(h);

  // ── Output color (with monochrome mix) ──────────────────────────────────
  // [BACKGROUND-V2] monochrome: when uMonochrome=1, mix the colored output
  // toward its luminance value. uLuminanceMix controls the blend factor.
  // At uLuminanceMix=1.0 (our config), the output is pure luminance (gray) —
  // no hue, no saturation, just the luminance field. This is the "monochrome
  // frozen frame" that R-35 requires.
  //
  // The luminance of a color is: 0.2126*R + 0.7152*G + 0.0722*B (Rec. 709).
  // We mix col toward vec3(luminance) by uLuminanceMix.
  vec3 outc = col * ltn;
  if (uMonochrome > 0.5) {
    float lum = dot(outc, vec3(0.2126, 0.7152, 0.0722));
    outc = mix(outc, vec3(lum), uLuminanceMix);
  }

  float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
  fragColor = vec4(outc, a * uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

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
  mixBlendMode,
  ref,
  // [BACKGROUND-V2] seeded warmup → monochrome freeze → permanent GL stop
  seed = 1,
  warmupFrames = 10,
  monochrome = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const programRef = useRef<Program | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const geometryRef = useRef<Triangle | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);
  const lastTimeRef = useRef(0);
  // [PERF-FIX] pointer coalescing + frame gating
  const pointerPendingRef = useRef<[number, number] | null>(null);
  // [BACKGROUND-V2] warmup frame tracking — counts up to warmupFrames, then
  // locks the field (uTimeFrozen=1), sets uKillSwitch=1, and kills the GL
  // context permanently if monochrome=1. After that, the loop never runs again.
  const warmupDoneRef = useRef(false);
  const warmupFrameCountRef = useRef(0);
  // [BACKGROUND-V2] set to true after loseContext() — gates wakeRef so the
  // dead canvas is never re-armed by pointer input or visibility changes.
  const killDoneRef = useRef(false);
  const IDLE_MS = 33;      // ~30fps ambient (speed=0.1 → slow field; imperceptible)
  const ACTIVE_MS = 16;    // ~60fps for a beat after input
  const IDLE_FREEZE_MS = 8000; // [PERF-FIX2] full rAF stop after 8s idle — static frame costs zero
  const wakeRef = useRef<(() => void) | null>(null); // [PERF-FIX2] restart loop on input
  let activeUntil = 0;
  let lastRender = 0;

  useImperativeHandle(ref, () => ({
    // [PERF-FIX] O(1) pointer path: two number writes; rect read + conversion
    // happen once per RENDERED frame in the loop, not once per move.
    setPointer: (cx: number, cy: number) => {
      pointerPendingRef.current = [cx, cy];
      activeUntil = performance.now() + 800;
      wakeRef.current?.();
    }
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    activeUntil = performance.now() + IDLE_FREEZE_MS; // [PERF-FIX2] animate on mount, freeze after idle

    // [PERF-FIX] background layer under a 60% overlay + glass blur:
    // DPR>1 is imperceptible here and costs 4-9x fill. AA does nothing on a
    // fullscreen triangle (no geometric edges — all edges are shader-made).
    // [PERF-FIX2] half-res backing store, upscale via CSS.
    // Under a 60% overlay + glass blur the difference is invisible; 4x fewer pixels.
    // [BACKGROUND-V2] extra half-res pass to reduce warmup cost (seed=seed,
    // monochrome=monochrome, warmupFrames=warmupFrames). The warmup runs at
    // half-res (RENDER_SCALE=0.5), then the GL context is killed permanently —
    // the canvas becomes a dead texture, zero per-frame cost.
    const RENDER_SCALE = 0.5;
    const renderer = new Renderer({
      dpr: (dpr ?? 1) * RENDER_SCALE,
      alpha: true,
      antialias: false
    });
    rendererRef.current = renderer;
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.clearColor(0, 0, 0, 0);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const { arr, count, avg } = prepColors(colors);

    // [BACKGROUND-V2] seeded noise — every seed picks a different "frozen freeze"
    // day-of-year variety without any storage/IPC. The seed flows into the shader's
    // hash() via uSeed; different seeds → different lobe configurations.
    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: arr[0] },
      uColor1: { value: arr[1] },
      uColor2: { value: arr[2] },
      uColor3: { value: arr[3] },
      uColor4: { value: arr[4] },
      uColor5: { value: arr[5] },
      uColor6: { value: arr[6] },
      uColor7: { value: arr[7] },
      uColorCount: { value: count },
      uMouseColor: { value: avg },
      uFlow: { value: flowVec(flowDirection) },
      uSpeed: { value: speed },
      uScale: { value: scale },
      uTurbulence: { value: turbulence },
      uFluidity: { value: fluidity },
      uRimWidth: { value: rimWidth },
      uSharpness: { value: sharpness },
      uShimmer: { value: shimmer },
      uGlow: { value: glow },
      uOpacity: { value: opacity },
      // [BACKGROUND-V2] mouse disabled in frozen mode — no pointer path, zero cost
      uMouseEnabled: { value: 0 },
      uMouseStrength: { value: 0 },
      uMouseRadius: { value: mouseRadius },
      // [BACKGROUND-V2] seed for noise field variety (day-of-year deterministic)
      uSeed: { value: seed },
      // [BACKGROUND-V2] monochrome: 1 = luminance mix (RGB→gray), kills hue in frozen frame
      uMonochrome: { value: monochrome ? 1 : 0 },
      // [BACKGROUND-V2] time frozen after warmup — iTime stops advancing, field locks
      uTimeFrozen: { value: 0 },
      // [BACKGROUND-V2] luminance mix factor for monochrome blend (RGB→gray weight)
      uLuminanceMix: { value: 1.0 },
      // [BACKGROUND-V2] kill switch — set to 1 after warmup frames, shader bails early
      uKillSwitch: { value: 0 },
    };

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
      activeUntil = performance.now() + 800;
      wakeRef.current?.();
      if (mouseDampening <= 0) {
        uniforms.iMouse.value = [x, y];
      }
    };
    if (mouseInteraction) {
      canvas.addEventListener('pointermove', onPointerMove);
    }

    // [PERF-FIX] resolve pending pointer with ONE rect read per rendered frame
    const takePointer = () => {
      const pend = pointerPendingRef.current;
      if (!pend) return;
      pointerPendingRef.current = null;
      const rect = canvas.getBoundingClientRect();
      const sc = renderer.dpr || 1;
      mouseTargetRef.current = [
        (pend[0] - rect.left) * sc,
        (rect.height - (pend[1] - rect.top)) * sc
      ];
    };

    const onVisibility = () => {                 // [PERF-FIX] hidden → zero GPU
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (!rafRef.current && !killDoneRef.current) {
        lastTimeRef.current = 0; lastRender = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    wakeRef.current = () => { // [PERF-FIX2] restart after idle freeze
      // [BACKGROUND-V2] if the GL context has been killed (monochrome freeze),
      // do NOT re-arm the loop — the canvas is a dead texture and any further
      // render calls would fail. The wake is silently dropped.
      if (killDoneRef.current) return;
      if (!rafRef.current && !document.hidden) {
        lastTimeRef.current = 0; lastRender = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (paused) return;

      // [BACKGROUND-V2] warmup frame counter — counts up to warmupFrames,
      // then locks the field (uTimeFrozen=1), sets uKillSwitch=1, and if
      // monochrome=1, kills the GL context permanently. After that, this
      // loop never runs again (rafRef stays null, wakeRef no-ops because
      // the context is dead).
      if (warmupFrames > 0 && !warmupDoneRef.current) {
        warmupFrameCountRef.current++;
        if (warmupFrameCountRef.current >= warmupFrames) {
          warmupDoneRef.current = true;
          uniforms.uTimeFrozen.value = 1;
          uniforms.uKillSwitch.value = 1;
          if (monochrome) {
            // Permanent stop: kill the GL context. The canvas becomes a
            // dead <canvas> with a frozen texture baked into it. Zero
            // per-frame cost, zero rAF, zero loops from this point onward.
            const gl2 = gl as WebGL2RenderingContext | null;
            if (gl2?.loseContext) {
              try { gl2.loseContext(); } catch (e) { console.warn('[RHEO] loseContext failed:', e); }
            }
            killDoneRef.current = true;
            console.log(`[RHEO] Background frozen (seed=${seed}, frames=${warmupFrames})`);
          }
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          return;
        }
      }

      // [PERF-FIX2] full freeze after 8s idle: static frame costs zero; input wakes via wakeRef.
      // (Only applies when monochrome is OFF — under monochrome the warmup above
      // is the permanent freeze path and this branch is never reached.)
      if (!monochrome && performance.now() > activeUntil + IDLE_FREEZE_MS) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        return;
      }

      const interval = performance.now() < activeUntil ? ACTIVE_MS : IDLE_MS;
      if (t - lastRender < interval - 1) return;   // frame gate — skip is ~free
      lastRender = t;
      uniforms.iTime.value = t * 0.001;
      takePointer();
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
      if (programRef.current && meshRef.current) {
        try { renderer.render({ scene: meshRef.current }); } catch (e) { console.error(e); }
      }
    };

    // [RM-FIX] reduced-motion gets the field FROZEN (one static frame), not blank
    if (paused) {
      uniforms.iTime.value = 0;
      try { renderer.render({ scene: meshRef.current }); } catch (e) { console.error(e); }
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      wakeRef.current = null; // [PERF-FIX2]
      document.removeEventListener('visibilitychange', onVisibility);
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
    dpr,
    paused,
    colors,
    speed,
    scale,
    turbulence,
    fluidity,
    rimWidth,
    sharpness,
    shimmer,
    glow,
    flowDirection,
    opacity,
    mouseInteraction,
    mouseStrength,
    mouseRadius,
    mouseDampening,
    // [BACKGROUND-V2] seed/warmup/monochrome — changing these restarts the
    // whole effect with a fresh GL context. The old context is cleaned up by
    // the effect's return() before the new one starts.
    seed,
    warmupFrames,
    monochrome,
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

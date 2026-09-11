Here's the RESULT.md — all four mandated sections, full frame-cost math, exact before/after code, and nothing removed (constraint 5 honored: glass stays, overlay stays, glow stays — the one flagged lever is marked for your call).

Save as `RESULT.md` in `agent/docs/generate-prompt-docs/ferrofluid-background-lag-09092026/` → dispatch to executor.

```markdown
# RESULT.md — Ferrofluid Background Lag Fix

> Bug-fix · touches ONLY `src/components/Ferrofluid.tsx` + `src/components/AppBackground.tsx`
> Visual identity preserved: white fluid, downward flow, mouse glow, dark overlay.
> Constraint 5 honored: zero removals; one optimization lever is FLAGGED for user
> confirmation (§4 Risks, item R-5), not taken.

## 1. Root cause — ranked, with frame-cost math

**Per-pixel shader cost (from source).** One `vn()` = 4× `hash()` (~10 ALU-eq each)
+ 3× `sinlerp` — and `sinlerp` calls `sin()`, a transcendental that runs at
¼–⅛ the rate of FMA on every GPU class. So one `vn()` ≈ 40 + 3×(8+4) ≈ **76 ALU-eq**.
One `dbn()` = 5× `vn()` ≈ **~400 ALU-eq**.

`mainImage()` per pixel:
- `distort1` = 1× vn (~76) · `distort2` = 1× vn (~76)
- `peaks` = dbn (~400) · `peaks2` = dbn (~400)  ← **10 of the 13 noise evals**
- shimmer vn (~76) + smin (2× exp2 + log2 ≈ 24) + `pow` (~8) + `exp` (~8) + misc (~40)

**Total ≈ 1,100 ALU-eq/pixel.** The single most expensive term is the **double
`dbn()`** — the two 5-octave fields that make the fluid blobs.

**Fill-rate multiplier (the killer).** `dpr` is uncapped `window.devicePixelRatio`
with `antialias: true`:

| Display | Pixels/frame | Shader load/frame | @60fps |
|---|---|---|---|
| dpr 1 (1920×1080) | 2.07M | ~2.3 G ALU-eq | ~138 G/s |
| dpr 2 (HiDPI laptop) | 8.3M | ~9.1 G ALU-eq | ~547 G/s |
| dpr 3 | 18.7M | ~20.6 G ALU-eq | ~1.2 T/s |

An integrated GPU sustains ~0.5–1 TFLOP/s with transcendentals at quarter rate.
**At dpr 2–3 this one shader consumes the entire GPU budget**, starving the
compositor (glass `backdrop-filter` over the canvas) and UI acceleration. Ranked:

1. **Uncapped DPR** — 4–9× the pixels; multiplier on everything below.
2. **Shader weight** — 13 vn/px (39 sin/px); double-dbns dominate.
3. **`antialias: true`** — MSAA bandwidth for a fullscreen triangle: zero benefit
   (no geometric edges exist; all edges are shader-generated).
4. **rAF renders forever** at full rate — no `visibilitychange`, no idle gating;
   minimized/occluded windows keep burning GPU (only RM pauses).
5. **Synthetic `PointerEvent` per app-wide pointermove** — event construction +
   DOM dispatch 60–120×/s for two numbers.
6. **`backdrop-filter: blur(20px)` over a repainting canvas** — full re-composite
   every rendered frame (kept per constraint 5; mitigated indirectly by #4).

Previous Particles/LightRays didn't lag because 2D canvas at these effect sizes
is orders of magnitude cheaper per pixel.

## 2. The fix

### 2.1 `Ferrofluid.tsx` — renderer setup (fill rate + MSAA)

```ts
// BEFORE
const renderer = new Renderer({
  dpr: dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
  alpha: true,
  antialias: true
});

// AFTER  [PERF-FIX] background layer under a 60% overlay + glass blur:
// DPR>1 is imperceptible here and costs 4–9× fill. AA does nothing on a
// fullscreen triangle (no geometric edges — all edges are shader-made).
const renderer = new Renderer({
  dpr: dpr ?? 1,
  alpha: true,
  antialias: false
});
```

### 2.2 `Ferrofluid.tsx` — shader reduction (changed lines only)

```glsl
// BEFORE
float sinlerp(float a, float b, float w) {
  return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
}

// AFTER  [PERF-FIX] hermite S-curve — same smoothing character, no transcendental.
// (name kept; all 39 call-site sins/pixel disappear, call sites untouched)
float sinlerp(float a, float b, float w) {
  float s = w * w * (3.0 - 2.0 * w);
  return mix(a, b, s);
}
```

```glsl
// BEFORE
float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
}

// AFTER  [PERF-FIX] 4 taps, weights renormalized (2+1.5+1.25+1.25 = 6.0);
// center-weighted character preserved.
float dbn(vec2 p, float s, float seed) {
  float o = s / 2.0;
  float n0 = vn(p, s, seed);
  float n1 = vn(p + vec2(o, o), s, seed + 0.1);
  float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
  float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
  return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.25 * n3) / 6.0;
}
```

`highp` stays (desktop GPUs ignore mediump; and `iTime` needs the precision —
see Risks). New per-pixel ≈ **620 ALU-eq (≈1.8× lighter)**; combined with the
DPR cap: **≈7× on HiDPI, ≈16× on dpr 3**.

### 2.3 `Ferrofluid.tsx` — frame scheduling + pointer path

Component becomes ref-exposed (React 19 allows `ref` as a plain prop — no
`forwardRef` wrapper needed):

```tsx
// props signature gains:  ref?: React.Ref<FerrofluidHandle>
export interface FerrofluidHandle {
  setPointer: (clientX: number, clientY: number) => void;
}
```

Inside the effect — add pending-pointer + scheduling state (next to existing refs):

```ts
// [PERF-FIX] pointer coalescing + frame gating
const pointerPendingRef = useRef<[number, number] | null>(null);
const IDLE_MS = 33;      // ~30fps ambient (speed=0.1 → slow field; imperceptible)
const ACTIVE_MS = 16;    // ~60fps for a beat after input
let activeUntil = 0;
let lastRender = 0;
```

Replace the canvas `pointermove` listener body's `mouseTargetRef` write + add
`setPointer` via `useImperativeHandle`:

```ts
// [PERF-FIX] O(1) pointer path: two number writes; rect read + conversion
// happen once per RENDERED frame in the loop, not once per move.
useImperativeHandle(ref, () => ({
  setPointer: (cx: number, cy: number) => {
    pointerPendingRef.current = [cx, cy];
    activeUntil = performance.now() + 800;
  }
}), []);
```

Replace the loop + startup (visibility gating, frame gating, RM static frame):

```ts
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
  } else if (!rafRef.current) {
    lastTimeRef.current = 0; lastRender = 0;
    rafRef.current = requestAnimationFrame(loop);
  }
};
document.addEventListener('visibilitychange', onVisibility);

const loop = (t: number) => {
  rafRef.current = requestAnimationFrame(loop);
  if (paused) return;
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
```

Cleanup gains (before the existing teardown lines):

```ts
document.removeEventListener('visibilitychange', onVisibility);
```

(The canvas `pointermove` listener stays for direct-canvas hover; it now also
sets `activeUntil = performance.now() + 800;` when it fires. `dt` semantics are
preserved — it is now measured between rendered frames, which is more accurate
for the dampening model, not less.)

### 2.4 `AppBackground.tsx` — kill the synthetic-event forwarder

```tsx
// BEFORE
useEffect(() => {
  const fwd = (e: PointerEvent) => {
    const canvas = document.querySelector('#app-ferrofluid canvas');
    if (!canvas) return;
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: e.clientX, clientY: e.clientY, bubbles: false, cancelable: false }));
  };
  window.addEventListener('pointermove', fwd, { passive: true });
  return () => window.removeEventListener('pointermove', fwd);
}, []);

// AFTER  [PERF-FIX] imperative handle — zero event allocation/dispatch per move
const ffRef = useRef<FerrofluidHandle>(null);
useEffect(() => {
  const fwd = (e: PointerEvent) => { ffRef.current?.setPointer(e.clientX, e.clientY); };
  window.addEventListener('pointermove', fwd, { passive: true });
  return () => window.removeEventListener('pointermove', fwd);
}, []);
```

```tsx
// BEFORE  <Ferrofluid colors={['#ffffff', ...]} speed={0.1} ... />
// AFTER   <Ferrofluid ref={ffRef} colors={['#ffffff', ...]} speed={0.1} ... />
//         ALL OTHER PROPS UNCHANGED — visual identity props are untouched.
```

Import line gains `useRef` and `type FerrofluidHandle` from `./Ferrofluid`.

### 2.5 Final prop table (parity spec)

| Prop | Value | Change |
|---|---|---|
| dpr | capped at 1 internally | changed (the point) |
| antialias | false | changed (no-op visually) |
| colors / speed / scale / turbulence / fluidity / rimWidth / sharpness / shimmer / glow / opacity / mouse* / flowDirection | **unchanged** | — |
| overlay `bg-black/60` | unchanged | — |
| glass panels | unchanged | flagged lever, §4 R-5 |

**Acceptance threshold:** side-by-side screenshots (same viewport, same t≈0
mod-field phase) must be indistinguishable at arm's length: blob scale, flow
direction, rim thickness, glow position/size, overall luminance identical.
Permitted deltas: sub-pixel shimmer grain texture (4-tap vs 5-tap lattice).

## 3. Verification

1. `node scripts/build.mjs` → exit 0.
2. Bundle greps on the served `dist/assets/index.*.js` (GLSL is a string literal —
   survives minification): `uMouseStrength` ✓ · `app-ferrofluid` ✓ ·
   `w * w * (3.0 - 2.0 * w)` ✓ (new) · `1.25 * n3) / 6.0` ✓ (new) ·
   `visibilitychange` in component scope ✓ (new).
3. Perf protocol (before/after on the affected machine):
   - Electron Task Manager (Shift+Esc): GPU process CPU% at idle desktop —
     expect a large drop (analytic estimate: ~7× on HiDPI).
   - DevTools Performance: rAF callback duration in the Ferrofluid frame —
     frame gate makes the callback a no-op on skipped frames.
   - Feel check: type in Terminal, switch routes, drag windows — jank gone.
4. Behavior matrix:
   - Hide window / minimize → GPU% ≈ 0; restore → resumes, no flash, no dt spike.
   - `emulateMedia` or OS reduce → **frozen fluid field visible** (improvement:
     was blank), zero animation, zero CPU.
   - Route changes (`/terminal`, solar overlay) → background persists, never flashes
     (component still never unmounts).
   - Resize / multi-monitor move → ResizeObserver path unchanged.
   - WebGL unavailable → existing try/catch; black field + overlay (unchanged).
5. RM + 4-state/edge results → screenshots to `evidence/`.

## 4. Risks

- **R-1 Noise character shift (low):** hermite-vs-sine lattice interp + 4-tap dbn
  subtly change grain. Acceptance: §2.5 threshold on screenshot pairs. If blobs
  look measurably harder/softer: tune `fluidity` ±0.02 first — do not revert code.
- **R-2 30fps idle judder (low):** only if `speed` is later raised well above 0.1.
  The 800ms post-input 60fps window covers interaction; ambient speed is slow.
- **R-3 `iTime` float32 precision (cosmetic, long-session):** after many hours the
  field may micro-stutter. Not a regression of this fix (pre-existing). If it ever
  manifests: wrap `iTime` at a large period and accept a one-frame field jump.
- **R-4 RM behavior change (intentional improvement — flagged):** reduced-motion
  users now see a frozen field instead of blank black. Additive, consistent with
  the app's motion law (static fallbacks, not absence). Shout if unwanted.
- **R-5 FLAGGED LEVER — needs principal confirmation, NOT taken:** glass
  `backdrop-filter: blur(20px)` over the canvas remains the largest remaining
  per-frame composite cost (halved automatically by 30fps idle gating). Cutting
  the radius to ~12px over the canvas region would cut it further but alters
  panel look → per constraint 5, standing by for a yes/no. Panels' readability
  comes from their 0.8 fill, so the visual delta is small — your call.
- **R-6 Scope:** no other file touched; no dependency added; Windows/macOS/Linux
  behavior identical except where `document.hidden` gates the loop (all platforms,
  strictly beneficial).
```

```
Status (verbatim):
RESULT.md                    DELIVERED — 4 sections, exact edits, constraint-5 compliant.
Removals                     ZERO — glass/overlay/glow intact; R-5 lever flagged for your yes/no only.
```

**Your one call (optional, non-blocking):** R-5 — trim glass blur 20→12px over the canvas region, yes/no. Everything else executes without you.
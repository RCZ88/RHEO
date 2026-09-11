<aside>
🌆

**Lead Designer + Engineer answer to “make it look alive, not a black void.”** One comprehensive solution that stays inside `AICityscape.tsx` + `cityscape.utils.ts`, keeps buildings as a **single instanced draw call**, and wires up the unused `getWindowTexture` pool. The whole look hinges on **one trick**: bake the 5 window densities into a **texture atlas**, then drive per-building window/trim/glow via **InstancedBufferAttributes + an `onBeforeCompile` patch** — so 200 buildings with lit windows, neon edges, hover glow and a select-pulse all render in **one draw call**. JSX below is written with spaced `{ {` — copy as normal braces.

</aside>

# 0. TL;DR — what changes and why it'll look alive

1. **Buildings stop being flat boxes:** a patched `MeshStandardMaterial` samples a **window atlas** (emissive), adds a **procedural neon edge-trim**, and reads **per-instance** lit-ratio / hover / select — all in the existing single InstancedMesh.
2. **Ground stops being a void:** replaced with a **procedural neon grid + radial streets shader** (Tron-style “roads,” animated data pulses) — zero extra geometry, one draw call.
3. **Air stops being empty:** one **GPU-animated `Points`** system (rain + floating embers) animated entirely in the vertex shader (no per-frame JS array writes).
4. **Motion everywhere:** view-mode switch and time-lapse **morph** (lerp height/color/emissive in `useFrame`) instead of hard-swapping; hover **blooms**, selection **pulses**.
5. **Post stack tuned** for neon: keep selective Bloom, add subtle ChromaticAberration + film grain + SMAA.

---

# 1. Architecture changes (per file)

## `cityscape.utils.ts` (currently 255 lines) — **add**, don't rewrite

| Add | Signature | Purpose |
| --- | --- | --- |
| `buildWindowAtlas()` | `() => { texture: THREE.CanvasTexture; cols: number }` | Composite the 5 pooled `getWindowTexture` canvases side-by-side into ONE atlas texture (single GPU upload, single sampler). |
| `litRatioFor(b)` | `(b: PlacedBuilding) => number` | Map metric+active → 0.1–0.9 window density bucket. |
| `windowBucket(litRatio)` | `(r: number) => number` | Quantize 0.1–0.9 → atlas column index 0–4. |
| `tileRowsFor(height)` | `(h: number) => number` | Window rows ∝ building height so windows never stretch. |
| `GRID`, `PALETTE` | const objects | Centralize hex codes / spacing so the shader + JS agree. |

Keep `getWindowTexture` / `disposeWindowPool` as-is — `buildWindowAtlas` consumes the pool.

## `AICityscape.tsx` (currently 490 lines) — changed regions

| Region (approx) | Change |
| --- | --- |
| `<InstanceBuildings>` body material (~the `meshStandardMaterial color:'#0a0e18'`) | Replace with `<BuildingMaterial>` (patched standard material, §2.1) + attach 4 InstancedBufferAttributes (§3.2). |
| `<InstanceBuildings>` instance update loop | Write `aWin`, `aTile`, `aState`, plus drive **morph** targets; lerp in `useFrame` (§6). |
| Ground `<planeGeometry>`  • `meshStandardMaterial color:'#04060c'` | Replace material with `<NeonGround>` shader (§4). Keep the plane geometry (bump to 400×400). |
| New children in `<CityScene>` | `<Atmosphere>` (§5 particles), optional `<RoadRibbons>` (§4.2). |
| `<EffectComposer>` | Add ChromaticAberration + Noise + SMAA; retune Bloom (§5.3). |
| fog `fogExp2` | `#0a0c18`, density `0.025` (§5.1). |
| Roof-glow instancedMesh | Keep — it already blooms. Optionally add rooftop sign sprites (§2.4). |

**`IDEProjectsPage.tsx` is untouched** (constraint honored) — props stay `overview / metric / tokenDisplayMode / loading / agents`.

---

# 2. Material spec

## 2.1 Building body — patched `MeshStandardMaterial` (NOT a raw ShaderMaterial)

Why patch instead of replace: `MeshStandardMaterial` already gives you the lightformer IBL reflections, fog, and tone mapping for free. We only inject window + trim + state logic via `onBeforeCompile`. Keeps it one draw call and physically lit.

**Base config (exact values):**

```tsx
// diffuse shell: dark blue steel that CATCHES the neon env instead of swallowing it
color:           '#141826'   // was #0a0e18 — lifted so reflections read
metalness:       0.9
roughness:       0.28        // glossy enough to mirror the lightformers
envMapIntensity: 1.15        // pull in the cyan/pink/purple Environment
emissive:        '#ffffff'   // emissive COMES FROM the window atlas map
emissiveIntensity: 1.0       // per-instance multiplier rides on top (§3.2)
```

**What the patch adds (all per-instance, see §3.2):**

- **Windows:** sampled from the atlas column chosen by `aWin.x`, tiled `aTile` times, tinted by `instanceColor`, brightness scaled so lit windows exceed HDR 1 → they bloom.
- **Neon edge trim:** procedural — bright rim along vertical corners + roofline, colored by `instanceColor`. No extra geometry.
- **Hover glow / select pulse:** `aState.x` (hover 0–1) lifts emissive; `aState.y` (selected) adds a `sin(uTime)` pulse.

## 2.2 Ground — procedural neon shader (see §4 for full code)

```tsx
baseColor:   '#05070f'   // near-black wet asphalt
gridColor:   '#0bd7ff'   // cyan minor grid
streetColor: '#7c3aed'   // violet major streets / radial spokes
pulseColor:  '#ff3d81'   // pink data pulses travelling the lanes
metalness:   0.8  roughness: 0.5  (wet sheen; emissive grid added in shader)
```

## 2.3 Roof glow & neon trim colors

- Roof strip (existing): keep `#00eaff`, `toneMapped:false`, `AdditiveBlending`.
- Edge trim color = **the building's `instanceColor`** (agent/model identity), pushed to gain ×3.5 so it reads as neon. This makes each tower “wear” its identity at night.

## 2.4 Optional rooftop signs (cheap, high payoff)

For the tallest ~8 buildings only: a `Sprite` with an additive canvas-generated label texture (agent name). Capped count = negligible cost, huge “city” feel. Generate via the same canvas approach as `getWindowTexture`.

---

# 3. Texture strategy — wiring `getWindowTexture` into ONE draw call

## 3.1 The atlas (the key idea)

You can't give 200 instances 5 different textures with one material — unless they share **one** texture. So composite the existing 5-density pool into a single horizontal atlas, upload once:

```tsx
// cityscape.utils.ts — NEW
import * as THREE from 'three'
import { getWindowTexture } from './cityscape.utils' // (same file; shown for clarity)

export const WINDOW_LIT_STEPS = [0.12, 0.32, 0.52, 0.72, 0.9] as const

let _atlas: { texture: THREE.CanvasTexture; cols: number } | null = null

export function buildWindowAtlas(tint = '#bfe9ff') {
	if (_atlas) return _atlas
	const cell = { w: 64, h: 128 }
	const cols = WINDOW_LIT_STEPS.length
	const canvas = document.createElement('canvas')
	canvas.width = cell.w * cols
	canvas.height = cell.h
	const ctx = canvas.getContext('2d')!
	WINDOW_LIT_STEPS.forEach((ratio, i) => {
		// getWindowTexture returns a CanvasTexture whose .image is the source canvas
		const tex = getWindowTexture(ratio, tint)
		ctx.drawImage(tex.image as CanvasImageSource, i * cell.w, 0)
	})
	const texture = new THREE.CanvasTexture(canvas)
	texture.colorSpace = THREE.SRGBColorSpace
	texture.magFilter = THREE.NearestFilter // crisp window edges
	texture.minFilter = THREE.LinearMipmapLinearFilter
	texture.generateMipmaps = true
	_atlas = { texture, cols }
	return _atlas
}
```

## 3.2 Per-instance attributes (4 total, all tiny)

Attach these to the building `InstancedMesh.geometry` as `InstancedBufferAttribute`s. `instanceColor` already exists for the body/identity color — reuse it for trim + window tint.

| Attribute | Size | Encodes |
| --- | --- | --- |
| `aWin` | vec2 | x = atlas column (0–4) • y = lit boost (0.1–0.9) |
| `aTile` | vec2 | x = horizontal window cols (∝ footprint) • y = rows (∝ height) |
| `aState` | vec2 | x = hover (0–1, lerped) • y = selected (0/1) |
| `aEmis` | float | base emissive multiplier (active=1.0, idle=0.45) |

```tsx
// AICityscape.tsx — when (re)building instances
const N = buildings.length
const aWin   = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2)
const aTile  = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2)
const aState = new THREE.InstancedBufferAttribute(new Float32Array(N * 2), 2)
const aEmis  = new THREE.InstancedBufferAttribute(new Float32Array(N * 1), 1)

buildings.forEach((b, i) => {
	const lit = litRatioFor(b)                 // 0.1–0.9
	aWin.setXY(i, windowBucket(lit), lit)
	aTile.setXY(i, Math.max(2, Math.round(b.footprint * 2)), tileRowsFor(b.height))
	aState.setXY(i, 0, 0)
	aEmis.setX(i, b.active ? 1.0 : 0.45)
})
geom.setAttribute('aWin', aWin)
geom.setAttribute('aTile', aTile)
geom.setAttribute('aState', aState)
geom.setAttribute('aEmis', aEmis)
```

```tsx
// cityscape.utils.ts — helpers
export const windowBucket = (lit: number) =>
	Math.min(WINDOW_LIT_STEPS.length - 1, Math.floor(lit * WINDOW_LIT_STEPS.length))

export const tileRowsFor = (height: number) =>
	THREE.MathUtils.clamp(Math.round(height * 1.6), 3, 26)

export function litRatioFor(b: PlacedBuilding) {
	// active towers glow busier; otherwise scale with normalized metric
	const base = b.active ? 0.55 : 0.18
	const byData = THREE.MathUtils.clamp(b.height / 14, 0, 1) * 0.4
	return THREE.MathUtils.clamp(base + byData, 0.1, 0.9)
}
```

## 3.3 The shader patch (windows + neon trim + state) via `onBeforeCompile`

```tsx
// AICityscape.tsx
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { buildWindowAtlas } from './cityscape.utils'

function useBuildingMaterial() {
	const uniforms = useRef({ uTime: { value: 0 } })
	const material = useMemo(() => {
		const { texture, cols } = buildWindowAtlas()
		const mat = new THREE.MeshStandardMaterial({
			color: '#141826', metalness: 0.9, roughness: 0.28,
			envMapIntensity: 1.15, emissive: '#ffffff', emissiveIntensity: 1.0,
		})
		mat.onBeforeCompile = (shader) => {
			shader.uniforms.uTime = uniforms.current.uTime
			shader.uniforms.uWindowAtlas = { value: texture }
			shader.uniforms.uAtlasCols = { value: cols }

			shader.vertexShader = shader.vertexShader
				.replace('#include <common>', `#include <common>
					attribute vec2 aWin; attribute vec2 aTile;
					attribute vec2 aState; attribute float aEmis;
					varying vec2 vFaceUv; varying vec2 vWinUv;
					varying vec2 vWin; varying vec2 vState; varying float vEmis;`)
				.replace('#include <uv_vertex>', `#include <uv_vertex>
					vFaceUv = uv;
					vWinUv  = vec2(uv.x * aTile.x, uv.y * aTile.y);
					vWin = aWin; vState = aState; vEmis = aEmis;`)

			shader.fragmentShader = shader.fragmentShader
				.replace('#include <common>', `#include <common>
					uniform float uTime; uniform sampler2D uWindowAtlas; uniform float uAtlasCols;
					varying vec2 vFaceUv; varying vec2 vWinUv;
					varying vec2 vWin; varying vec2 vState; varying float vEmis;`)
				.replace('#include <emissivemap_fragment>', `
					// ---- WINDOWS: sample the chosen atlas column ----
					float colW = 1.0 / uAtlasCols;
					vec2 wuv = vec2((fract(vWinUv.x) * colW) + vWin.x * colW, fract(vWinUv.y));
					vec3 win = texture2D(uWindowAtlas, wuv).rgb;
					// tint windows toward identity color, keep warm core
					vec3 winTint = mix(vec3(1.0, 0.93, 0.75), diffuseColor.rgb * 3.0, 0.45);
					float litBoost = 1.4 + vWin.y * 1.6;          // brighter = busier (HDR > 1 => blooms)

					// ---- NEON EDGE TRIM: vertical corners + roofline ----
					float ex = min(vFaceUv.x, 1.0 - vFaceUv.x);   // dist to vertical corner
					float corner = smoothstep(0.045, 0.0, ex);
					float roof   = smoothstep(0.04, 0.0, 1.0 - vFaceUv.y);
					float trim   = max(corner, roof);
					vec3 trimCol = diffuseColor.rgb * 3.5;        // neon identity

					// ---- STATE: hover lift + selected pulse ----
					float pulse = 1.0 + vState.y * (0.5 + 0.5 * sin(uTime * 4.0));
					float glow  = (vEmis + vState.x * 0.8) * pulse;

					vec3 emissiveOut = win * winTint * litBoost * glow + trim * trimCol * (1.0 + vState.x);
					totalEmissiveRadiance = emissiveOut;
				`)
		}
		mat.customProgramCacheKey = () => 'ai-city-building-v1'
		return mat
	}, [])
	useFrame((s) => { uniforms.current.uTime.value = s.clock.elapsedTime })
	return material
}
```

> Box UVs already map each face 0..1, so windows tile cleanly on all four sides; the top face's windows sit under the roof-glow cap and the bottom is unseen — no custom BufferGeometry needed. This is why **patching the box beats rebuilding geometry**.
> 

---

# 4. Road geometry & ground

## 4.1 Recommendation: procedural “streets” in the ground shader (not grid/Voronoi geometry)

The layout is **golden-angle phyllotaxis** (organic spiral) — a rectangular road grid would cut through buildings and a Voronoi mesh is heavy. The cleanest, fastest, best-looking answer is a **procedural neon ground**: a cyan minor grid + **radial spokes & concentric rings** (which actually echo the spiral), plus **animated data pulses** running the lanes. Zero road geometry, one draw call, and it lines up with downtown because it's radial like the city.

```tsx
// AICityscape.tsx
function NeonGround() {
	const mat = useMemo(() => new THREE.ShaderMaterial({
		transparent: true, depthWrite: true,
		uniforms: {
			uTime:      { value: 0 },
			uBase:      { value: new THREE.Color('#05070f') },
			uGrid:      { value: new THREE.Color('#0bd7ff') },
			uStreet:    { value: new THREE.Color('#7c3aed') },
			uPulse:     { value: new THREE.Color('#ff3d81') },
			uGridScale: { value: 2.2 },   // matches spiral cell pitch
			uRings:     { value: 9.0 },
			uSpokes:    { value: 24.0 },
		},
		vertexShader: `
			varying vec2 vWorld;
			void main() {
				vec4 wp = modelMatrix * vec4(position, 1.0);
				vWorld = wp.xz;
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: `
			precision highp float;
			varying vec2 vWorld;
			uniform float uTime, uGridScale, uRings, uSpokes;
			uniform vec3 uBase, uGrid, uStreet, uPulse;
			float line(float x, float w) { return smoothstep(w, 0.0, abs(x)); }
			void main() {
				// minor square grid
				vec2 g = abs(fract(vWorld / uGridScale - 0.5) - 0.5) / fwidth(vWorld / uGridScale);
				float grid = 1.0 - min(min(g.x, g.y), 1.0);
				// radial streets: concentric rings + spokes
				float r = length(vWorld);
				float a = atan(vWorld.y, vWorld.x);
				float rings  = line(fract(r / (60.0 / uRings)) - 0.5, 0.02);
				float spokes = line(fract(a / (6.2831 / uSpokes)) - 0.5, 0.02);
				float street = max(rings, spokes);
				// data pulse travelling outward along rings
				float pulse = smoothstep(0.0, 0.04, fract(r * 0.05 - uTime * 0.25)) *
				              smoothstep(0.12, 0.0, fract(r * 0.05 - uTime * 0.25)) * street;
				// fade with distance so the horizon goes dark into fog
				float fade = smoothstep(140.0, 20.0, r);
				vec3 col = uBase;
				col += uGrid   * grid   * 0.5  * fade;
				col += uStreet * street * 0.9  * fade;
				col += uPulse  * pulse  * 2.2  * fade;   // > 1 => blooms
				gl_FragColor = vec4(col, 1.0);
			}`,
	}), [])
	useFrame((s) => { mat.uniforms.uTime.value = s.clock.elapsedTime })
	return (
		<mesh rotation={ [-Math.PI / 2, 0, 0] } position={ [0, 0, 0] } material={ mat }>
			<planeGeometry args={ [400, 400] } />
		</mesh>
	)
}
```

## 4.2 Optional raised road ribbons (if they want literal roads)

If actual geometry is wanted later: build **concentric ring ribbons** + radial spokes as thin `RingGeometry`/`PlaneGeometry` strips, `BufferGeometryUtils.mergeGeometries` into ONE mesh (one draw call), emissive lane material with procedural dashes. Positioning math = the same `uRings`/`uSpokes` constants so geometry and shader agree. **Default: skip it** — the shader streets read better and cost nothing.

## 4.3 Wet reflection (optional)

drei `MeshReflectorMaterial` is available, but it's a second scene render — risky on the 60fps-integrated-GPU lock. **Recommendation:** ship the emissive grid first; expose reflection behind the “Cinematic” quality toggle at `resolution={ 512 }`, `mirror={ 0.4 }`, auto-disable under 45fps.

---

# 5. Atmosphere spec

## 5.1 Fog

`fogExp2('#0a0c18', 0.025)` — slightly denser + bluer than current so neon bleeds into distance and the ground grid fades to a horizon.

## 5.2 Particles — ONE GPU-animated `Points` system (rain + embers)

Animate entirely in the vertex shader from a `uTime` uniform — **no per-frame JS writes** (fixes the perf cost of the array-rewrite rain pattern). Single draw call, additive, `toneMapped:false` so streaks catch bloom.

```tsx
function Atmosphere({ count = 1400 }) {
	const mat = useRef<THREE.ShaderMaterial>(null!)
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry()
		const seed = new Float32Array(count * 3)
		const kind = new Float32Array(count)      // 0 = rain, 1 = ember
		for (let i = 0; i < count; i++) {
			seed[i * 3 + 0] = (Math.random() - 0.5) * 160
			seed[i * 3 + 1] = Math.random() * 70
			seed[i * 3 + 2] = (Math.random() - 0.5) * 160
			kind[i] = Math.random() < 0.78 ? 0.0 : 1.0
		}
		g.setAttribute('position', new THREE.BufferAttribute(seed, 3))
		g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1))
		return g
	}, [count])
	useFrame((s) => { if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime })
	return (
		<points geometry={ geo }>
			<shaderMaterial
				ref={ mat }
				transparent depthWrite={ false }
				blending={ THREE.AdditiveBlending }
				uniforms={ { uTime: { value: 0 } } }
				vertexShader={ `
					attribute float aKind; uniform float uTime;
					varying float vKind;
					void main() {
						vKind = aKind;
						vec3 p = position;
						if (aKind < 0.5) {           // RAIN: fast fall, wrap
							p.y = mod(position.y - uTime * 22.0, 70.0);
						} else {                     // EMBER: slow rise + drift
							p.y = mod(position.y + uTime * 1.2, 60.0);
							p.x += sin(uTime * 0.3 + position.z) * 1.5;
						}
						vec4 mv = modelViewMatrix * vec4(p, 1.0);
						gl_PointSize = (aKind < 0.5 ? 2.0 : 3.5) * (60.0 / -mv.z);
						gl_Position = projectionMatrix * mv;
					}` }
				fragmentShader={ `
					varying float vKind;
					void main() {
						float d = length(gl_PointCoord - 0.5);
						if (d > 0.5) discard;
						vec3 rain  = vec3(0.5, 0.72, 1.0);
						vec3 ember = vec3(1.0, 0.42, 0.78);
						vec3 c = mix(rain, ember, vKind) * (vKind < 0.5 ? 1.2 : 2.0);
						gl_FragColor = vec4(c, (1.0 - d * 2.0) * (vKind < 0.5 ? 0.35 : 0.8));
					}` }
			/>
		</points>
	)
}
```

Optional **smog**: 2–3 drei `<Cloud>` at low opacity (0.05) between towers — add only on Cinematic quality.

## 5.3 Post-processing (retune)

```tsx
<EffectComposer multisampling={ 0 } disableNormalPass>
	<Bloom mipmapBlur luminanceThreshold={ 0.95 } luminanceSmoothing={ 0.2 } intensity={ 1.7 } radius={ 0.82 } />
	<ChromaticAberration offset={ [0.0007, 0.0011] } radialModulation modulationOffset={ 0.4 } />
	<Noise opacity={ 0.025 } premultiply />
	<Vignette offset={ 0.28 } darkness={ 0.92 } />
	<SMAA />
	<ToneMapping />
</EffectComposer>
```

- Keep `luminanceThreshold` ~0.95 so **only** HDR window/trim/pulse/grid (all pushed > 1) bloom — the dark shells stay crisp.
- **Skip Scanlines** as a global pass (reads cheesy/aliased on text); the procedural grid already gives the “tech” overlay. Film grain (`Noise`) hides banding in the dark gradients far better.

---

# 6. Interaction polish (all via the per-instance attributes — still one draw call)

## 6.1 Hover → emissive bloom (not flat color ×1.2)

Drive `aState.x` toward 1 on the hovered instance and lerp the rest back to 0 each frame. The shader turns that into a real glow lift + brighter trim.

```tsx
useFrame(() => {
	const arr = aStateRef.current.array as Float32Array
	for (let i = 0; i < count; i++) {
		const target = i === hoverId ? 1 : 0
		arr[i * 2] += (target - arr[i * 2]) * 0.18   // smooth hover in/out
	}
	aStateRef.current.needsUpdate = true
})
```

## 6.2 Select → animated pulse

Set `aState.y = 1` on the selected instance (0 otherwise). The shader's `sin(uTime*4.0)` term makes it breathe. Pair with the existing DetailPanel slide-in; camera does **not** yank.

## 6.3 View-mode switch & time-lapse → morph, don't snap

Store `current` and `target` arrays for **height, footprint, color, lit** per stable building id. On mode/metric/timeIndex change, recompute `target`; lerp `current` toward it in `useFrame` and rewrite `instanceMatrix` + `instanceColor` + `aWin`. Buildings that disappear scale to 0 then cull; new ones grow from 0.

```tsx
useFrame(() => {
	let moving = false
	for (let i = 0; i < count; i++) {
		const h = cur.h[i] + (tgt.h[i] - cur.h[i]) * 0.12
		if (Math.abs(h - cur.h[i]) > 0.001) moving = true
		cur.h[i] = h
		dummy.position.set(tgt.x[i], h / 2, tgt.z[i])
		dummy.scale.set(cur.f[i], h, cur.f[i])
		dummy.updateMatrix()
		mesh.current.setMatrixAt(i, dummy.matrix)
	}
	mesh.current.instanceMatrix.needsUpdate = true
	if (moving) invalidate()   // pairs with frameloop="demand"
})
```

This directly upgrades the current “full rebuild / instant swap” — time-lapse now **morphs** day-to-day and mode switches **tween**.

---

# 7. Performance budget (60fps on integrated GPU)

| Element | Draw calls | Notes / fallback |
| --- | --- | --- |
| Buildings (body) | **1** | InstancedMesh + atlas + attributes. The whole point — stays one call. |
| Roof glow | 1 | Existing instanced layer. |
| Ground | 1 | Single shader plane; `fwidth` AA grid, no geometry. |
| Atmosphere | 1 | One `Points`, GPU-animated; cap 1400, drop to 600 on Balanced. |
| Rooftop signs (opt) | ≤8 | Tallest only; sprites. |
| Bloom + post | fixed | Selective bloom; cost ~independent of building count. |
- **Total core = ~4 draw calls** regardless of city size.
- `frameloop="demand"`; `invalidate()` only while morphing / hovering / particles visible (particles need continuous loop — gate them to a quality flag, or accept continuous loop when atmosphere on).
- Atlas + all canvas textures generated once; call `disposeWindowPool()` + dispose atlas on unmount.
- **Quality toggle (Cinematic / Balanced / Performance):** flips particle count, ChromaticAberration, reflection, smog. Persist in `localStorage` (`try/catch`).

---

# Build order (each step independently visible)

1. **Atlas + window shader** (§3) — biggest single leap; buildings instantly read as towers with lit windows.
2. **Neon edge trim + hover/select** (§2.1, §6) — identity + interactivity.
3. **NeonGround shader** (§4) — kills the “black void,” adds roads/grid.
4. **Atmosphere particles + fog + post retune** (§5).
5. **Morph transitions** (§6.3) — makes it feel alive in motion.
6. Optional: rooftop signs, reflection, smog (behind quality toggle).

<aside>
🎯

**The one idea that makes this whole thing work:** a **window-texture atlas + per-instance attributes + an `onBeforeCompile` patch** lets every building have unique lit windows, identity-colored neon trim, hover-glow and a select-pulse — while staying a **single InstancedMesh draw call**. Everything else (ground grid, GPU particles, morph transitions) is layered on top without adding meaningful cost. Steps 1+3 alone take you from “black void” to “Blade-Runner skyline.”

</aside>
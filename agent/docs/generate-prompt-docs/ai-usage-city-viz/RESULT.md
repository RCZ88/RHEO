<aside>
🏙️

**One concrete design:** a dusk-lit 3D **skyline** on the AI Tools tab where each building is an AI agent — **height = tokens (log-scaled)**, **footprint = cost (sqrt-scaled)**, **color = agent identity**, **glowing roof = used in last 24h**. A pill row swaps between six “cities” (Agent / Project / Model / Time / Category / Weekday). Built on the R3F + drei already in the repo, instanced for >50 buildings, in its own component file. This plan follows the five required output sections.

</aside>

## 1. Data Assessment

**Primary source — `get-ide-projects-overview(period, dateOffset)` → `aiUsage.byTool`.** This single response powers four of six view modes with no extra IPC.

| Field (response path) | Use | Why |
| --- | --- | --- |
| `aiUsage.byTool[tool].tokens` | **Building height** (log10) | The headline metric; spans 0–100M so must be log-scaled. |
| `aiUsage.byTool[tool].cost` | **Footprint width/depth** (sqrt) | Cost ($0.0001–$100+) reads naturally as “mass/area”; sqrt keeps small towers visible. |
| `aiUsage.byTool[tool].messageCount` | **Window-row count** on facade | Cheap secondary encoding via emissive texture rows. |
| `aiUsage.byTool[tool].sessions` | Info panel + tooltip | Context, not geometry. |
| `aiUsage.byTool[tool].lastUsed` | **Glowing roof beacon** if < 24h | “Active city” signal. |
| `aiUsage.byTool[tool].models` / `modelBreakdown[]` | **Stacked tiers** within a building (By Model) | `modelBreakdown` gives per-model `tokens` for tier heights. |
| `aiUsage.byTool[tool].daily{date:{tokens,...}}` | **Time-lapse frames**  • **By Weekday** boroughs | Each date key is one snapshot; weekday derived via `new Date(date).getDay()`. |
| `aiUsage.byTool[tool].projects[]` | **By Project districts** | `{path, tokens, messageCount, sessions}` lets us regroup buildings into project blocks. |
| `aiUsage.totalTokens` / `totalCost` | Global normalization denominators | Stable scaling across modes (so a building's height means the same thing after a switch). |
| `projects[]` (top level) | District labels in By Project | `name`  • `primary_language` for legend/labels. |

**Secondary source — needed for one mode only.** `aiUsage.byTool` has **no session-category field**, so **By Session Category** must aggregate `get-terminal-sessions` (columns `agent`, `category`, `total_tokens`, `total_cost`) grouped by `category`. Fetch this lazily, only when the Category pill is first selected, and cache it.

**Explicitly excluded** (out of scope / wrong grain for a skyline): `terminal_messages.content` (raw markdown, huge), `session_parsed_items`, `workspace_problems`, `workspace_requests`, `get-prompt-history` (has `category` but no token totals). The prompt's “problems/decisions/messages” are richer than a height/width/color city can faithfully encode; surface them in the click-through info panel as counts rather than geometry.

**Model-family grouping (By Model):** normalize raw `model` strings (e.g. `claude-sonnet-4-20250514` → `claude-sonnet-4`, `gpt-4o-2024-...` → `gpt-4o`) by stripping trailing date/version suffixes with a regex; sum `modelBreakdown.tokens` across tools per family.

## 2. Visualization Design

### 2.1 Layout algorithm — “density spiral” downtown

Deterministic and overlap-free without a physics solver:

1. Compute each building's height; **sort descending by height**.
2. Place buildings on a square grid lattice walked as an **outward spiral** from the origin — tallest first → tallest cluster downtown, shorter toward the suburbs.
3. Cell pitch = `maxFootprint + GAP` (constant spacing, never overlaps).
4. **By Project / By Weekday** use the same spiral **per district**, with districts themselves laid on a coarse spiral; a thin road-gap separates districts. Districts get a faint ground label (drei `Text`).

### 2.2 Encoding scheme

- **Height:** `h = H_MIN + (H_MAX - H_MIN) * log10(tokens + 1) / log10(GLOBAL_MAX_TOKENS + 1)` with `H_MIN = 0.4`, `H_MAX = 14`. Zero/null tokens → **no building** (flat lot).
- **Footprint:** `w = d = W_MIN + (W_MAX - W_MIN) * sqrt(cost) / sqrt(GLOBAL_MAX_COST)`, `W_MIN = 0.8`, `W_MAX = 2.4`.
- **Tiers (By Model):** a building is split into stacked `BoxGeometry` segments proportional to each model's token share; each tier tinted a shade of the agent color.
- **Facade rows:** an emissive window texture whose lit-row fraction ≈ `messageCount / maxMessageCount` (one shared canvas texture per density bucket, not per building).

### 2.3 Color mapping

Fixed palette for known agents (stable across sessions), hashed-hue fallback for unknown ones:

- `claude` → `#D97757`, `opencode` → `#10B981`, `gpt`/`openai` → `#22D3EE`, `gemini` → `#A78BFA`, `cursor` → `#F59E0B`, `copilot` → `#60A5FA`.
- Fallback: `hue = hashString(name) % 360` → HSL at fixed S/L tuned for the dark theme.
- **By Category** recolors by category (bug-fix `#EF4444`, feature `#10B981`, research `#8B5CF6`, refactor `#F59E0B`, other `#6B7280`); building identity stays mapped via the legend.

### 2.4 Lighting & atmosphere (dusk)

- `color: #FDB87D` low warm directional “sun” (key) + cool `#1E3A8A` hemisphere fill; background fog `#0B1020` for depth.
- Per-building **emissive** intensity ∝ normalized tokens, so the skyline literally glows brighter where more compute went.
- Subtle ground reflection via a low-opacity mirror plane (drei `MeshReflectorMaterial` at low resolution to stay cheap). Particles/“data traffic” are explicitly **deferred** (perf risk, low value) — noted as a later enhancement, not built now.

### 2.5 Interaction model

- drei `OrbitControls`: left-drag rotate, scroll zoom, right-drag pan, with damping; clamp polar angle so you can't go under the ground.
- **Hover:** raise emissive + show a floating drei `Html` name label.
- **Click:** select → right-side detail panel (tool name, raw + scaled tokens, cost, models, lastUsed, sessions). Camera does **not** yank on click; only the panel slides in.
- **Mode switch:** camera tweens to a mode-specific vantage (By Agent = 35° hero; By Project = 55° overhead) and buildings **animate height/position** via a lerp in `useFrame`.

### 2.6 View-mode semantics (the six “cities”)

| Mode | Unit | Height | Color | Source |
| --- | --- | --- | --- | --- |
| By Agent (default) | 1 building / tool | tool tokens | agent | `byTool` |
| By Project | district / project, building / tool-in-project | tool tokens in project | agent | `byTool[].projects` |
| By Model | building / model family (or tiered tower) | model tokens | model family | `byTool[].modelBreakdown` |
| By Time | buildings animate over scrubbed day | that day's tokens | agent | `byTool[].daily` |
| By Category | building / category | category tokens | category | `get-terminal-sessions` |
| By Weekday | 7 boroughs (Mon–Sun) | tokens that weekday | agent | `byTool[].daily` → getDay() |

## 3. Implementation Approach

### 3.1 Component structure (proposed, not prescriptive)

A self-contained `AICityViz` in `src/components/` taking `{ overview, period, loading }` as props — **no IPC inside the component** (keeps it a pure derived view of data the page already fetches). Internally: a `<Canvas>` host, a scene subtree (lights, ground, instanced buildings, labels), a DOM overlay for pills/legend/detail-panel rendered as siblings (not inside Canvas).

### 3.2 Data pipeline (ingestion → transform → layout → render)

```
overview.aiUsage  --▶  selectByMode(mode)        // pick/aggregate rows for the active city
                  --▶  scale(rows)               // log height, sqrt footprint, color, emissive
                  --▶  layoutSpiral(scaled)      // deterministic x,z + per-district offset
                  --▶  CityModel { buildings[], districts[], legend[], bounds }
                  --▶  <InstancedBuildings model />
```

Memoize each stage with `useMemo` keyed by `(mode, period, timeIndex)`. Keep a `Map<mode, CityModel>` cache ref so re-selecting a mode is instant. Heavy transforms (By Time builds N daily frames) run in a `setTimeout`-chunked pass to avoid blocking the UI, matching the app's existing chunking pattern.

### 3.3 Three.js scene setup

- `<Canvas dpr={[1, 1.75]} camera={ position, fov: 45 }>` inside a `min-h-[400px]` flex container so it fills responsively.
- Lights per §2.4; one `MeshReflectorMaterial` ground plane; `fog` on the scene.
- **Buildings as a single `InstancedMesh`** (one `BoxGeometry`, one material): per-instance matrix encodes position + non-uniform scale (w, h, d); per-instance color via `instanceColor`. This is the key perf lever for >50 buildings. Tiered (By Model) towers use a second instanced mesh keyed by tier.
- Labels/tooltips via drei `Html` (occlusion-culled) so DOM text stays crisp.

### 3.4 Interaction wiring

- Use R3F instance raycasting: `onPointerMove`/`onClick` give `instanceId` → map back to the building record. Throttle hover to animation frames.
- Camera tweens: store a target `{ position, lookAt }` per mode; lerp in `useFrame` (no spring lib needed). Height/position morphs: store `current` and `target` scale per instance and lerp.
- Detail panel + pills are plain React/Tailwind/Framer Motion DOM over the canvas.

### 3.5 Performance strategy

- Single instanced draw call (target: 1–3 draws regardless of building count).
- Cap facade textures to a handful of shared canvases (bucketed by message density), never one-per-building.
- `frameloop="demand"` when idle (no time-lapse playing), invalidating on interaction; full loop only while scrubbing/animating.
- Reflector at reduced resolution; disable it automatically if instance count is high. Target 60fps, hard floor 30fps.

### 3.6 Integration with IDEProjectsPage

- In the AI Tools (`ai`) tab, mount `AICityViz` at the **top of the chart section**, fed by the existing `get-ide-projects-overview` result the page already holds. Keep the current Chart.js section directly below (augment, not delete) behind a small “City / Charts” toggle so nothing is removed. Wrap it in the app's `.glass` card (`bg-zinc-900/75 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-4`).
- Card chrome: top bar (title “AI City” + view pills + reset-camera), the canvas, bottom legend (colored dots → agent/category).
- Lazy-load the component (`React.lazy`) so Three.js only loads when the AI tab is opened.

## 4. Edge Cases & States

| State | Behavior |
| --- | --- |
| **Loading** | Skeleton city: a flat grid of low, **pulsing wireframe** boxes (opacity tween) while `loading` is true; pills disabled. |
| **Empty** (no `byTool` keys / all zero) | Flat reflective plane + centered drei `Html`: “No data yet — sync AI agents to build your city.” No buildings, no errors. |
| **Error** (IPC throws) | Same flat plane with a muted error line + Retry button (re-invokes the page's fetch). Never crash the canvas. |
| **Single building** | Skip the spiral; center the lone tower and frame the camera tighter so it isn't a speck. |
| **Null/zero values** | Produce a flat lot (no mesh), not a zero-height artifact; tooltip on the lot omitted. |
| **Mode transition** | Buildings lerp height/position; entering buildings grow from 0, exiting shrink to 0 then cull; camera tweens to the mode vantage; ~500–700ms. |
| **Time-lapse** | Slider over the sorted `daily` date range; on scrub, set `timeIndex` → buildings lerp to that day's heights/colors; play/pause auto-advances one day per ~400ms; missing day = flat (no building) for that tool. |
| **Category mode before fetch** | Show the skeleton city while `get-terminal-sessions` loads the first time, then cache. |
| **Accessibility** | Canvas wrapper `role="img"`  • dynamic `aria-label` (e.g. “AI usage city, By Agent: 7 tools, tallest claude at 4.2M tokens”). Pills are real buttons; buildings get a parallel keyboard path — arrow keys cycle a selected building, Enter opens its panel. |

## 5. Implementation Effort Estimate

| Phase | Scope | ~LOC | Complexity |
| --- | --- | --- | --- |
| **P1 — Static city (By Agent)** | Canvas, lights, ground, scaling, spiral layout, instanced buildings, legend, glass card wired into the tab | ~350–450 | Medium — the core; gets a usable skyline on screen |
| **P2 — Interaction** | Orbit controls, hover labels, click → detail panel, reset camera, empty/loading/error states | ~250–350 | Medium |
| **P3 — View modes** | By Project, By Model (tiers), By Weekday, By Category (+ terminal-sessions fetch), pill switcher, camera/height morph tweens | ~350–500 | Medium-High — aggregation + transitions |
| **P4 — Time-lapse** | Daily frame builder, slider + play/pause, per-frame lerp, demand frameloop tuning | ~200–300 | High — animation correctness + perf |
| **P5 — Polish** | Reflections, facade window textures, accessibility keyboard path, a11y labels, Charts/City toggle | ~200–300 | Medium |

**Total ~1,350–1,900 LOC**, shippable incrementally — P1+P2 alone is a complete, interactive single-mode city. Deferred (not in estimate): particle “data traffic,” worker-based geometry, organic (non-grid) layouts.

<aside>
⚠️

Grounded in the attached `CONTEXT_BUNDLE.md`. Two things to confirm against live data before P3/P4: (1) **By Category** truly needs `get-terminal-sessions` (category isn't in `aiUsage.byTool`); (2) the `daily` map's date coverage for the selected period determines how rich Time-lapse/Weekday look — sparse history = sparse frames.

</aside>

---

# Part B — Cyberpunk Night-City Art Direction (AAA-grade) + Code

<aside>
🌆

This part is the **high-fidelity visual spec**: exactly what to use, why, and copy-paste R3F code to make the skyline look like a Blade-Runner / *Cyberpunk 2077* night city — neon bloom, wet reflective streets, volumetric haze, holographic signage, and a cinematic post stack. All snippets use the libraries **already in your repo** (R3F + drei + postprocessing). Note: in JSX below I write `{ {` and `} }` with a space on purpose — copy it as normal / in your editor.

</aside>

## B0. What actually makes a neon city look “cool” (researched)

The recurring ingredients across the best web cyberpunk scenes (SynthCity, Cyber City Orion):

1. **HDR emissive + bloom is the #1 lever.** Neon is just materials whose color exceeds RGB 1, picked up by a bloom pass — the SynthCity author confirms the glow is “all thanks to additive blending mode and the bloom post-processing effect.”[[1]](https://discourse.threejs.org/t/synthcity-an-infinite-procedural-cyberpunk-city/59887)
2. **Wet, rain-slicked, reflective ground** doubles every light — the signature Blade-Runner sheen.[[2]](https://www.webgpu.com/showcase/cyber-city-orion-blade-runner-3d-city-browser/)
3. **Atmospheric haze/fog** so neon bleeds into distance and gives depth layering.
4. **A cold key + warm neon rim** color contrast (teal/magenta is the canonical cyberpunk duo).
5. **Density**: tall towers clustered downtown, glowing window grids, rooftop beacons, holographic billboards.
6. **A film-look post stack**: bloom → depth-of-field → chromatic aberration → vignette → grain. This is what separates “tech demo” from “game.”

**Applied to our data city:** taller building = more tokens already; we make the *brightness* of each tower scale with token volume, the neon trim color = agent identity, and active-in-24h towers get a pulsing rooftop beacon. The data drives the art.

## B1. Renderer & color pipeline (the foundation)

Get this wrong and nothing else matters — bloom needs HDR + ACES tone mapping + correct color space.

```tsx
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

<Canvas
	shadows
	dpr={ [1, 2] }						// retina, capped at 2 for perf
	gl={ {
		antialias: false,					// SMAA in post is cheaper + plays nice with bloom
		powerPreference: 'high-performance',
		toneMapping: THREE.ACESFilmicToneMapping,	// filmic rolloff = no blown-out neon
		toneMappingExposure: 1.05,
		outputColorSpace: THREE.SRGBColorSpace,
	} }
	camera={ { position: [22, 13, 22], fov: 38, near: 0.1, far: 500 } }
>
	{ /* scene */ }
</Canvas>
```

**Why each:** ACES filmic tone mapping compresses the bright neon so it glows instead of clipping to white; `fov: 38` is a slightly long cinematic lens (less distortion, more “film”); `far: 500` lets fog swallow the horizon.

## B2. Cinematic night lighting (3-tier + IBL)

```tsx
import { Environment, Lightformer } from '@react-three/drei'

{ /* 1. Ambient base: blue sky / near-black ground */ }
<hemisphereLight args={ ['#22305c', '#04050a', 0.4] } />

{ /* 2. Cold “moonlight” key (casts the shadows) */ }
<directionalLight
	position={ [-34, 46, -22] }
	intensity={ 0.55 }
	color={ '#6f8cff' }
	castShadow
	shadow-mapSize={ [2048, 2048] }
	shadow-bias={ -0.0004 }
/>

{ /* 3. Warm magenta rim from the opposite side = cyberpunk contrast */ }
<directionalLight position={ [28, 16, 26] } intensity={ 0.25 } color={ '#ff3d81' } />

{ /* 4. Image-based lighting from a tiny procedural neon env — huge realism gain, ~free */ }
<Environment resolution={ 64 } background={ false } frames={ 1 }>
	<Lightformer form="rect" intensity={ 2.2 } color="#00eaff" position={ [0, 7, -14] } scale={ [22, 7, 1] } />
	<Lightformer form="rect" intensity={ 1.6 } color="#ff2e88" position={ [-12, 4, 9] } scale={ [13, 4, 1] } />
	<Lightformer form="ring" intensity={ 1.2 } color="#a855f7" position={ [14, 9, -4] } scale={ [6, 6, 1] } />
</Environment>
```

**Why IBL via `Environment` + `Lightformer`:** real reflections/specular on the glass towers and wet ground come from this baked-once cubemap. `frames={ 1 }` renders it a single time — negligible cost. drcmda (R3F author) calls hand-built light environments “realistic studio lighting almost for free.”

## B3. Materials: building shell + neon that actually blooms

The core trick — **selective bloom is automatic**: keep the bloom `luminanceThreshold` at 1, and only materials whose color exceeds 1 (with `toneMapped={ false }`) will glow.[[3]](https://react-postprocessing.docs.pmnd.rs/effects/bloom)

```tsx
import * as THREE from 'three'

// Push any hex into HDR so the bloom pass picks it up. gain > 1 = glow strength.
export function neon(hex: string, gain = 4) {
	return new THREE.Color(hex).multiplyScalar(gain)
}

// 1. Building SHELL — dark, glassy, reflects the neon env (does NOT bloom)
<meshStandardMaterial
	color="#0a0e18"
	metalness={ 0.85 }
	roughness={ 0.32 }
	envMapIntensity={ 0.9 }
/>

// 2. Neon EDGE TRIM / rooftop signage — HDR + additive => blooms hard
<meshBasicMaterial
	toneMapped={ false }
	color={ neon('#00eaff', 5) }
	blending={ THREE.AdditiveBlending }
/>

// 3. WINDOW GRID — emissive map (see B7); emissiveIntensity scales with tokens
<meshStandardMaterial
	color="#05060a"
	emissive={ '#ffffff' }
	emissiveMap={ windowTex }
	emissiveIntensity={ 1.8 }	// raise per building by normalized tokens for brighter = busier
	toneMapped={ false }		// let the bright windows tip into bloom
/>
```

## B4. The post-processing stack (the “game look”)

Order matters. This single `EffectComposer` merges passes so the cost stays sane.

```tsx
import {
	EffectComposer, Bloom, DepthOfField, ChromaticAberration,
	Vignette, Noise, SMAA, ToneMapping,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'

<EffectComposer multisampling={ 0 } disableNormalPass>
	{ /* Neon glow — selective: only HDR (>1) materials bloom */ }
	<Bloom
		mipmapBlur
		luminanceThreshold={ 1 }
		luminanceSmoothing={ 0.18 }
		intensity={ 1.5 }
		radius={ 0.86 }
	/>
	{ /* Cinematic focus — sharp downtown, soft suburbs; refocus on the selected tower */ }
	<DepthOfField focusDistance={ 0.013 } focalLength={ 0.05 } bokehScale={ 3.2 } />
	{ /* Lens fringing on the edges — subtle, sells the “camera” feel */ }
	<ChromaticAberration blendFunction={ BlendFunction.NORMAL } offset={ new Vector2(0.0008, 0.0012) } radialModulation modulationOffset={ 0.45 } />
	{ /* Darken corners to focus the eye */ }
	<Vignette offset={ 0.26 } darkness={ 0.9 } />
	{ /* Fine film grain — hides banding in the dark gradients */ }
	<Noise opacity={ 0.035 } blendFunction={ BlendFunction.OVERLAY } />
	<SMAA />
	<ToneMapping />
</EffectComposer>
```

**Knobs that matter most:** `Bloom.intensity` + `radius` (the whole vibe), `DepthOfField.bokehScale` (how dreamy), `Vignette.darkness`. Expose these as the art-director sliders in B11.

## B5. Wet, rain-slicked reflective street

```tsx
import { MeshReflectorMaterial } from '@react-three/drei'

<mesh rotation={ [-Math.PI / 2, 0, 0] } position={ [0, 0, 0] } receiveShadow>
	<planeGeometry args={ [600, 600] } />
	<MeshReflectorMaterial
		resolution={ 1024 }			// 512 on weak GPUs (see perf budget)
		mirror={ 0.5 }				// 0.5 = wet asphalt, not a clean mirror
		mixStrength={ 1.3 }
		mixBlur={ 8 }				// blur distant reflections
		blur={ [320, 110] }
		roughness={ 1 }
		depthScale={ 1.1 }
		minDepthThreshold={ 0.4 }
		maxDepthThreshold={ 1.3 }
		color="#04060c"
		metalness={ 0.65 }
	/>
</mesh>
```

`MeshReflectorMaterial` extends `MeshStandardMaterial`, takes surface roughness into account, and supports blur/distortion — it's the drei-blessed way to get the rain-slicked look.[[4]](https://drei.docs.pmnd.rs/shaders/mesh-reflector-material) A faint **normal/distortion map** on it simulates rain ripples.

## B6. Atmosphere — haze, drifting smog, rain, light shafts

```tsx
import { Cloud, Clouds } from '@react-three/drei'
import * as THREE from 'three'

{ /* Exponential haze: neon bleeds into the distance (Blade-Runner depth) */ }
<fogExp2 attach="fog" args={ ['#080a14', 0.02] } />

{ /* Low drifting smog between towers */ }
<Clouds material={ THREE.MeshBasicMaterial }>
	<Cloud seed={ 1 } bounds={ [40, 5, 18] } volume={ 8 } opacity={ 0.06 } speed={ 0.15 } color="#1a2444" position={ [0, 7, -8] } />
</Clouds>
```

**Rain** (cheap, instanced streaks recycled in `useFrame` so nothing allocates per frame):

```tsx
function Rain({ count = 1200 }) {
	const ref = useRef<THREE.InstancedMesh>(null!)
	const dummy = useMemo(() => new THREE.Object3D(), [])
	const drops = useMemo(
		() => Array.from({ length: count }, () => ({
			x: (Math.random() - 0.5) * 120,
			y: Math.random() * 60,
			z: (Math.random() - 0.5) * 120,
			v: 0.6 + Math.random() * 0.8,
		})),
		[count],
	)
	useFrame(() => {
		drops.forEach((d, i) => {
			d.y -= d.v
			if (d.y < 0) d.y = 60			// recycle, never reallocate
			dummy.position.set(d.x, d.y, d.z)
			dummy.scale.set(0.02, 0.6, 0.02)
			dummy.updateMatrix()
			ref.current.setMatrixAt(i, dummy.matrix)
		})
		ref.current.instanceMatrix.needsUpdate = true
	})
	return (
		<instancedMesh ref={ ref } args={ [undefined, undefined, count] }>
			<boxGeometry />
			<meshBasicMaterial color={ neon('#7fb6ff', 1.4) } transparent opacity={ 0.35 } toneMapped={ false } />
		</instancedMesh>
	)
}
```

**Optional god-rays / light shafts** from rooftop beacons via `@react-three/postprocessing`'s `GodRays` effect pointed at a bright sprite — add only on high-end (it's a per-light pass).

## B7. Making the buildings themselves look AAA

A box is boring; these details sell it — all instance-friendly:

- **Lit window grid** via a tiny shared canvas texture (5 density buckets, **pooled + disposed** — do *not* create one per building, that was the exact leak pattern to avoid):

```tsx
function makeWindowTexture(litRatio: number, tint = '#bfe9ff') {
	const c = document.createElement('canvas')
	c.width = 64; c.height = 128
	const ctx = c.getContext('2d')!
	ctx.fillStyle = '#04060c'; ctx.fillRect(0, 0, 64, 128)
	const cols = 6, rows = 14, pad = 4
	const cw = (64 - pad * (cols + 1)) / cols
	const ch = (128 - pad * (rows + 1)) / rows
	for (let y = 0; y < rows; y++)
		for (let x = 0; x < cols; x++) {
			const lit = Math.random() < litRatio
			ctx.globalAlpha = lit ? 0.6 + Math.random() * 0.4 : 1
			ctx.fillStyle = lit ? tint : '#0a0f1a'
			ctx.fillRect(pad + x * (cw + pad), pad + y * (ch + pad), cw, ch)
		}
	const tex = new THREE.CanvasTexture(c)
	tex.colorSpace = THREE.SRGBColorSpace
	return tex
}

// Build a POOL once; key buildings to a bucket by messageCount density.
const WINDOW_POOL = [0.15, 0.35, 0.55, 0.75, 0.92].map((r) => makeWindowTexture(r))
// On unmount: WINDOW_POOL.forEach((t) => t.dispose())  // critical — avoid the texture leak
```

- **Glowing rooftop beacon** for active-in-24h tools: a small additive sphere/cone with a gentle `sin` pulse in `useFrame`.
- **Holographic billboards**: a transparent plane with an additive emissive agent-logo texture, slowly rotating, slight scanline shader — these read as “ads” in the skyline.
- **Emissive edge trim**: thin neon strips along building tops/corners (instanced lines or thin boxes) tinted to the agent color — this is what makes each tower “wear” its identity at night.
- **Antenna / spire lights**: tiny blinking point sprites on the tallest towers.

## B8. Camera & motion (cinematic feel)

```tsx
import { OrbitControls } from '@react-three/drei'

<OrbitControls
	enableDamping dampingFactor={ 0.06 }
	maxPolarAngle={ Math.PI / 2.15 }	// never go under the street
	minDistance={ 12 } maxDistance={ 90 }
/>

// Idle: slow orbital drift so the scene always feels alive
useFrame((state) => {
	if (!interacting && !selected) {
		const t = state.clock.elapsedTime
		state.camera.position.x = Math.sin(t * 0.04) * 26
		state.camera.position.z = Math.cos(t * 0.04) * 26
		state.camera.lookAt(0, 4, 0)
	}
})
```

On **building select**, tween `DepthOfField.target`/`focusDistance` to that tower so it snaps into focus while the rest goes dreamy.

## B9. Performance budget (so it stays 60fps in Electron)

| Effect | Cost | Tuning / fallback |
| --- | --- | --- |
| Bloom (mipmapBlur) | Medium | The non-negotiable one. Keep `radius` ≤ 0.9; it's selective so scene complexity barely matters. |
| MeshReflectorMaterial | High | `resolution` 1024→512 on weak GPU; it's a second scene render. Auto-disable if FPS < 40. |
| DepthOfField | Medium | Drop first on low-end; keep Bloom. |
| Rain / Clouds | Low–Med | Instanced; cap drops at ~1200. Toggle off on battery. |
| Buildings | Low | Single `InstancedMesh`  • `instanceColor`; one draw call regardless of count. |
| God rays | High | High-end only; per-light pass. |
- Use **`frameloop="demand"`** when idle isn't animating; switch to continuous only during drift/time-lapse/rain.
- Add a **“Graphics: Cinematic / Balanced / Performance”** toggle that flips reflector resolution, DoF, rain, and god-rays. Persist the choice in `localStorage` (wrapped in `try/catch`).
- **Dispose everything** on unmount (textures, geometries, reflector RT) — the same discipline that fixed the Solar-System leak.

## B10. Exact dependencies (all already in your repo)

| Package | Used for |
| --- | --- |
| `three` | Core: materials, `InstancedMesh`, `CanvasTexture`, fog, ACES tone mapping |
| `@react-three/fiber` | `<Canvas>`, `useFrame`, renderer config |
| `@react-three/drei` | `OrbitControls`, `Environment`  • `Lightformer`, `MeshReflectorMaterial`, `Cloud`/`Clouds`, `Html`, `Text` |
| `@react-three/postprocessing` | `EffectComposer`, `Bloom`, `DepthOfField`, `ChromaticAberration`, `Vignette`, `Noise`, `SMAA`, `GodRays` |

If `@react-three/postprocessing` isn't yet installed, it's the only add — it merges passes into one optimized chain, so it's the right call over hand-rolling `EffectComposer`.

## B11. Art-director tunables (expose as a debug panel)

| Param | Default | Effect |
| --- | --- | --- |
| `bloomIntensity` | 1.5 | Overall neon glow strength |
| `bloomRadius` | 0.86 | Glow spread (higher = dreamier halo) |
| `neonGain` | 4–5 | How far past HDR 1 the trim/signage pushes |
| `exposure` | 1.05 | Global brightness (ACES) |
| `fogDensity` | 0.02 | Haze depth / horizon falloff |
| `reflectorMirror` | 0.5 | Wetness of the street (0 dry → 1 mirror) |
| `bokehScale` | 3.2 | Depth-of-field softness |
| `vignetteDarkness` | 0.9 | Corner darkening |
| `keyColor` / `rimColor` | #6f8cff / #ff3d81 | Cold key vs warm rim contrast |

## B12. Revised effort (adds the cinematic layer)

| Phase | Adds | ~LOC |
| --- | --- | --- |
| **P6a — Render pipeline + lighting** | ACES/HDR Canvas config, 3-tier lights, procedural neon `Environment` | ~120–160 |
| **P6b — Post stack** | `EffectComposer`: Bloom + DoF + CA + Vignette + Noise + SMAA, graphics-quality toggle | ~150–220 |
| **P6c — Wet ground + atmosphere** | `MeshReflectorMaterial`, fog, smog clouds, instanced rain | ~180–250 |
| **P6d — Building detail** | Pooled window textures, neon edge trim, rooftop beacons, holo billboards | ~250–350 |

**Cinematic layer total ~700–980 LOC** on top of the functional city. Build order: get P1–P2 (functional city) shippable first, then layer P6a→P6d — each step is independently visible, so you can stop at any fidelity level.

<aside>
🎯

**The single most important takeaway:** the “game look” is 80% just three things working together — (1) HDR emissive materials (`toneMapped={ false }`, color × 4+), (2) a selective `Bloom` pass (`luminanceThreshold={ 1 }`), and (3) ACES tone mapping. Add the wet `MeshReflectorMaterial` floor and `fogExp2` haze and you're already 90% of the way to Blade Runner before any other detail.

</aside>

---

# Part C — Architect Decisions (answers to the agent's 8 questions)

<aside>
✅

Rulings below are binding for **this cycle**. Where I changed the agent's recommendation, it's flagged **⚠️ REVISED** with the reason. Net: most recommendations stand; the two real changes are **Q3 (no random jitter — use a deterministic spiral)** and **Q8 (add a play/pause, it's cheap)**.

</aside>

## Q1 — Replace or add to existing charts? → **ADD on top, collapse the redundant 4 behind a toggle. Don't hard-delete.**

- **City goes at the top** of the chart section (line ~2396 `AI Charts Section` forward) as the default view.
- The four redundant charts (Doughnut, Model Timeline, Multi-Agent Comparison, Per-Agent bars) are **replaced as the default** but kept behind a **“City / Charts” toggle** — keep the code, don't rip it out (lower risk, easy rollback).
- **KEEP always-visible:** summary bar (line ~2005), agent-cards grid (line ~2252), **StatsDashboard** (line ~2128), and the **Input/Output Ratio** card (line ~2532). Rationale: the city is *exploratory*; KPIs and the I/O ratio are *scannable truth* the city doesn't encode. They complement, not duplicate.
- So the agent's recommendation stands, with one correction: **do not replace** the I/O Ratio card or StatsDashboard — keep both.

## Q2 — Which modes ship this cycle? → **Agreed: Agent, Model, Time-lapse.**

- Strong yes. All three are powered by **`get-ide-projects-overview` alone** — no new IPC needed.
- Defer Project / Weekday (derivable later) and **Category** (the only one needing a second source, `get-terminal-sessions`). This keeps the cycle to one data dependency.
- Implement the mode switcher as an enum from day one so adding the other three later is additive, not a refactor.

## Q3 — Layout? → **⚠️ REVISED: radial/organic YES, random jitter NO. Use a deterministic seeded spiral.**

- Random jitter is the one thing to avoid: it (a) **re-rolls positions every render** unless seeded (buildings teleport on metric switch), (b) **risks overlap** → broken click targets, and (c) makes raycasting/labels flickery.
- **Decision:** the **“density spiral”** from §2.1 — sort buildings by the selected metric descending, place them on an outward spiral (phyllotaxis or square-spiral) so **tallest cluster downtown**, shorter toward the suburbs. It's organic-looking *and* deterministic *and* overlap-free (cell pitch ≥ `maxFootprint + GAP`).
- For **By Model**, give each model family an **angular wedge** and spiral within it (clean “districts” without random placement).
- If you want a touch of organic variety, apply a **seeded** per-building offset (hash of the name), never `Math.random()` at render time.

## Q4 — Height follows the selected metric? → **Agreed, emphatically.**

- Building **height + emissive intensity + panel values** all follow the active metric toggle (tokens / messages / sessions / cost, plus input/output sub-modes for tokens).
- Two requirements: (1) **normalize per metric** — use that metric's own max as the denominator so towers fill the height range in every mode; (2) **animate the change** — lerp heights/positions over ~400ms on metric switch (the data-linked “city rebuilds itself” moment is the wow factor).
- Persist the last-used metric in `localStorage` (wrapped in `try/catch`).

## Q5 — File strategy? → **Single component, but split pure helpers out from day one.**

- Start with `src/components/AICityscape.tsx` — agreed. But be realistic: with the cinematic layer (bloom, reflector, rain, window-texture pool, 3 modes, slide-in panel, time controls) this will land closer to **600–900 lines**, not 250–350.
- So from the start, put **pure, testable helpers** in a sibling `src/components/cityscape.utils.ts`: metric scaling, spiral layout, agent/model palette, and the window-texture pool. That keeps the component readable without a premature folder.
- Promote to a `cityscape/` subfolder only if/when a second cycle adds the remaining modes.

## Q6 — Share post-processing with OrbitSystem? → **Agreed, with one modernization.**

- Yes — reuse `@react-three/postprocessing` (`EffectComposer` + `Bloom` + `Vignette`) and **match OrbitSystem's ACES tone mapping** for a consistent house style across both 3D views.
- **⚠️ Modernize the bloom approach:** don't replicate the old UnrealBloomPass selective-layer juggling. Use **selective-by-default bloom** — `Bloom luminanceThreshold={ 1 }` + neon materials with `toneMapped={ false }` and HDR color (×4+). It's faster (no extra passes, no per-frame scene traversal) and is the current pmndrs-recommended pattern. (Worth back-porting to OrbitSystem later, but not required this cycle.)
- DoF is optional polish; ship Bloom + Vignette first.

## Q7 — Click → detail panel content? → **Agreed: reuse the `PlanetDetailPanel` slide-in, content tailored per mode.**

- Reuse the OrbitSystem slide-in pattern for consistency.
- **Agent mode:** tokens, messages, cost, sessions, avg-per-message, models used, last-used (same fields as the agent cards).
- **Model mode:** tokens, messages, sessions, cost for that model family + which agents use it.
- Always show **raw value + the scaled/normalized value** so the height encoding is legible.
- Camera must **not** yank on click — only the panel slides in (matches §2.5).

## Q8 — Time-lapse UX? → **⚠️ REVISED: ship slider + a single play/pause button.**

- Slider-only undersells the feature — and **play/pause is nearly free** (one boolean + a RAF/interval that advances `timeIndex` ~1 day per 400ms). The auto-advancing skyline is the entire point of “time-lapse,” so include it.
- The period selector (7D / 30D / All) **gates the date range**; the slider scrubs within it; play auto-advances through it.
- Sparse/missing days render as **flat lots** (no building) for that tool — don't interpolate across gaps.
- If the cycle runs out of time, slider-only is an acceptable fallback — but wire the `timeIndex` state so adding play later is a 10-line change.

<aside>
📋

**Net deltas from the agent's recommendations:** Q1 — also keep the I/O Ratio card + StatsDashboard (don't replace them); Q3 — deterministic seeded spiral instead of random jitter; Q5 — expect 600–900 lines, split helpers into `cityscape.utils.ts` now; Q6 — use selective `luminanceThreshold={ 1 }` bloom, not UnrealBloomPass layers; Q8 — add play/pause. Q2, Q4, Q7 approved as written.

</aside>
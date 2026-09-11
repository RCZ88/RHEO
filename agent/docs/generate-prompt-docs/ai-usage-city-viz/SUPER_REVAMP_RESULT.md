<aside>
🤖

**Read top-to-bottom before touching code.** This is the implementation brief for wiring the `cyber_assets` image folder into the existing `AICityscape`. It encodes the *real, per-asset status* (some are clean, some still carry a black background, some have a baked checkerboard, and the atmosphere set is unusable), how to handle each, and gives drop-in code per system. **Golden rule: the procedural backbone stays. Every asset is an optional layer — if a file is missing or unusable, fall back to the existing procedural path. The app must run identically with an empty `cyber_assets/` folder.**

</aside>

## 0. TL;DR for the AI

1. The assets live in a plain folder called **`cyber_assets`** (not zipped). Put it at `public/cyber_assets/` so files serve at `/cyber_assets/<id>.<ext>`. Files are named by doc ID: `1a.jpg`, `2b.png`, `4a.png`, `5a.png`, `10c.png`, etc.
2. Each asset has a **background status** that dictates rendering: `clean` (real alpha or full texture — use directly), `black` (glow on solid black → **additive blending**), `checkerboard` (fake-transparent, opaque → **strip to alpha first**), or `skip` (unusable → **generate in code**).
3. **Bake no lighting into assets.** Car underglow, bloom, shadows = code/shaders. Assets are flat inputs.
4. **Defensive loading everywhere.** A failed load returns `null` and the system keeps its procedural fallback.
5. **The atmosphere set (#6) is unusable** (baked checkerboard mess). Do **not** try to clean it — generate the rain/ember/fog sprites procedurally (§6.4). Cheaper and cleaner anyway.

---

## 1. Per-asset status (authoritative — from the actual files)

This overrides the prompt notes in the asset doc. Trust this table for *how each file actually arrived*.

| Section | IDs | Real status | Handling |
| --- | --- | --- | --- |
| 1 — Facades | 1a, 1b, 1c | **Clean, ready.** Full-frame JPGs. | Use directly as tiled `map` (Bucket C). No editing. |
| 2 — Windows | 2a–2h | **Clean, ready** (2b especially good). | Composite into the window atlas (Bucket C). No keying. |
| 3 — Ground | 3a, 3b | **Clean** full textures. | Tile under the NeonGround grid. 3c (lane glow) = black bg → additive overlay. |
| 4 — Cars | 4a, 4b, 4c | **Background removed (real alpha)**, with *some residual glow* baked in. | Use as transparent sprites; **add the real underglow in code** (don't rely on the baked glow). |
| 5 — Neon / holo | 5a / 5b, 5c | **5a still has a black background.** 5b, 5c are **cleanly cut (alpha).** | 5a → additive (black vanishes). 5b/5c → transparent sprites (optionally additive for extra glow). |
| 6 — Atmosphere | 6a, 6b, 6c | **Unusable.** Baked black-checkerboard, can't be cleanly removed. | **Skip the files. Generate rain/ember/fog sprites procedurally** (§6.4). |
| 7 — Sky | 7a, 7b | **Clean, high quality.** | 7a = equirect background; 7b = horizon band (Bucket C). |
| 8 — Street furniture | 8a, 8b, 8c | **Background already removed (real alpha)** — nice (despite doc saying otherwise). | Use as transparent upright sprites. |
| 9 — Vegetation | 9a, 9b | **Background already removed (real alpha).** | Use as transparent upright sprites. |
| 10 — FX overlays | 10a, 10c / 10b | **10a & 10c = black background. 10b = checkerboard** (fake transparent). | 10a/10c → additive. 10b → `stripCheckerboard()` to real alpha first. |

<aside>
💡

**The pack is still growing.** Some IDs may be absent at any moment. Never hard-require a file; the loader (§4) returns `null` on miss and each system keeps its procedural fallback.

</aside>

---

## 2. The four background statuses — and the rendering that matches each

| Status | What it is | Render / process |
| --- | --- | --- |
| `clean` | Real alpha cutout, or a full-frame texture with no transparency. | Use directly. Transparent material for cutouts; tiled `map` for textures. |
| `black` | Opaque PNG on solid `#000000` (a glow). | **`THREE.AdditiveBlending`** — black adds zero light and disappears. No editing. |
| `checkerboard` | Opaque PNG with a gray/white checkerboard *painted in* (fake alpha). **Never additive** — gray squares add light. | **`stripCheckerboard()`** → real alpha → then treat as `clean`. |
| `skip` | Unusable (e.g. #6: checkerboard + soft particles = uncleanable). | **Generate procedurally in code** (`makeRadialGlow`, §6.4). |

### 2.1 Shared utilities (`src/components/cityscape/cyberTextureUtils.ts`)

```tsx
import * as THREE from 'three'

/** Defensive loader: resolves to a Texture, or null if the file is missing. */
export function tryLoadTexture(url: string): Promise<THREE.Texture | null> {
	return new Promise((resolve) => {
		new THREE.TextureLoader().load(
			url,
			(t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t) },
			undefined,
			() => resolve(null), // 404 / decode error => graceful null
		)
	})
}

/** Load an <img> (needed when we must read pixels, e.g. de-checkerboard). */
function loadImage(url: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => resolve(img)
		img.onerror = () => resolve(null)
		img.src = url
	})
}

/**
 * Turn a baked gray/white CHECKERBOARD (fake transparency) into REAL alpha.
 * Samples the two checker tones from the corner and erases matching pixels.
 */
export async function loadCheckerboardAsAlpha(url: string): Promise<THREE.Texture | null> {
	const img = await loadImage(url)
	if (!img) return null
	const w = img.naturalWidth, h = img.naturalHeight
	const c = document.createElement('canvas'); c.width = w; c.height = h
	const ctx = c.getContext('2d', { willReadFrequently: true })!
	ctx.drawImage(img, 0, 0)
	const d = ctx.getImageData(0, 0, w, h); const p = d.data
	const at = (x: number, y: number) => { const i = (y * w + x) * 4; return [p[i], p[i+1], p[i+2]] }
	const t1 = at(0, 0), t2 = at(8, 0) // two checker tones (cell ~8px; adjust if needed)
	const near = (r: number, g: number, b: number, t: number[], tol = 22) =>
		Math.abs(r-t[0]) < tol && Math.abs(g-t[1]) < tol && Math.abs(b-t[2]) < tol
	for (let i = 0; i < p.length; i += 4) {
		const r = p[i], g = p[i+1], b = p[i+2]
		if (near(r, g, b, t1) || near(r, g, b, t2)) p[i+3] = 0
	}
	ctx.putImageData(d, 0, 0)
	const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
	return tex
}

/** Procedural soft radial sprite — replaces the unusable #6 particle assets. */
export function makeRadialGlow(size = 64, inner = '#ffffff'): THREE.CanvasTexture {
	const c = document.createElement('canvas'); c.width = c.height = size
	const ctx = c.getContext('2d')!
	const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
	g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)')
	ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
	return t
}
```

---

## 3. The manifest (single source of truth)

`src/components/cityscape/cyberAssets.ts`. The `bg` field drives rendering; `skip` files are intentionally never fetched.

```tsx
export type Bg = 'clean' | 'black' | 'checkerboard' | 'skip'
export type Bucket = 'glow' | 'opaque' | 'texture'

export interface AssetSpec {
	id: string; file: string; bucket: Bucket; bg: Bg; tile?: boolean; note: string
}

export const BASE = '/cyber_assets'

export const CYBER_ASSETS: Record<string, AssetSpec> = {
	// 1 — facades (clean full textures)
	'1a': { id:'1a', file:'1a.jpg', bucket:'texture', bg:'clean', tile:true, note:'Base facade' },
	'1b': { id:'1b', file:'1b.jpg', bucket:'texture', bg:'clean', tile:true, note:'Tall facade' },
	'1c': { id:'1c', file:'1c.jpg', bucket:'texture', bg:'clean', tile:true, note:'Low facade' },
	// 2 — window atlas inputs (clean)
	'2a': { id:'2a', file:'2a.png', bucket:'texture', bg:'clean', note:'Pattern 0' },
	'2b': { id:'2b', file:'2b.png', bucket:'texture', bg:'clean', note:'Pattern 1 (best)' },
	'2c': { id:'2c', file:'2c.png', bucket:'texture', bg:'clean', note:'Pattern 2' },
	'2d': { id:'2d', file:'2d.png', bucket:'texture', bg:'clean', note:'Lit 80%' },
	'2e': { id:'2e', file:'2e.png', bucket:'texture', bg:'clean', note:'Lit 60%' },
	'2f': { id:'2f', file:'2f.png', bucket:'texture', bg:'clean', note:'Lit 40%' },
	'2g': { id:'2g', file:'2g.png', bucket:'texture', bg:'clean', note:'Lit 20%' },
	'2h': { id:'2h', file:'2h.png', bucket:'texture', bg:'clean', note:'Lit 5%' },
	// 3 — ground (3a/3b clean texture, 3c neon overlay on black)
	'3a': { id:'3a', file:'3a.png', bucket:'texture', bg:'clean', tile:true, note:'Asphalt base' },
	'3b': { id:'3b', file:'3b.png', bucket:'texture', bg:'clean', tile:true, note:'Sidewalk' },
	'3c': { id:'3c', file:'3c.png', bucket:'glow', bg:'black', tile:true, note:'Neon lane markings' },
	// 4 — cars (clean alpha; residual baked glow ignored, real glow added in code)
	'4a': { id:'4a', file:'4a.png', bucket:'opaque', bg:'clean', note:'Car A' },
	'4b': { id:'4b', file:'4b.png', bucket:'opaque', bg:'clean', note:'Car B' },
	'4c': { id:'4c', file:'4c.png', bucket:'opaque', bg:'clean', note:'Truck' },
	// 5 — neon/holo (5a black bg; 5b/5c clean alpha)
	'5a': { id:'5a', file:'5a.png', bucket:'glow', bg:'black', note:'Neon sign base' },
	'5b': { id:'5b', file:'5b.png', bucket:'glow', bg:'clean', note:'Holo billboard' },
	'5c': { id:'5c', file:'5c.png', bucket:'glow', bg:'clean', note:'Neon arrow' },
	// 6 — atmosphere: UNUSABLE, generated in code instead
	'6a': { id:'6a', file:'6a.png', bucket:'glow', bg:'skip', note:'Rain  -> makeRadialGlow' },
	'6b': { id:'6b', file:'6b.png', bucket:'glow', bg:'skip', note:'Ember -> makeRadialGlow' },
	'6c': { id:'6c', file:'6c.png', bucket:'glow', bg:'skip', note:'Fog   -> makeRadialGlow' },
	// 7 — sky (clean)
	'7a': { id:'7a', file:'7a.png', bucket:'texture', bg:'clean', note:'Equirect sky' },
	'7b': { id:'7b', file:'7b.png', bucket:'texture', bg:'clean', note:'Horizon band' },
	// 8 — street furniture (clean alpha)
	'8a': { id:'8a', file:'8a.png', bucket:'opaque', bg:'clean', note:'Lamppost' },
	'8b': { id:'8b', file:'8b.png', bucket:'opaque', bg:'clean', note:'Traffic light' },
	'8c': { id:'8c', file:'8c.png', bucket:'opaque', bg:'clean', note:'Bench' },
	// 9 — vegetation (clean alpha)
	'9a': { id:'9a', file:'9a.png', bucket:'opaque', bg:'clean', note:'Tree' },
	'9b': { id:'9b', file:'9b.png', bucket:'opaque', bg:'clean', note:'Planter' },
	// 10 — fx (10a/10c black; 10b checkerboard)
	'10a': { id:'10a', file:'10a.png', bucket:'glow', bg:'black', note:'Lens flare' },
	'10b': { id:'10b', file:'10b.png', bucket:'glow', bg:'checkerboard', tile:true, note:'Rain streak overlay' },
	'10c': { id:'10c', file:'10c.png', bucket:'glow', bg:'black', tile:true, note:'Smoke wisps' },
}
```

---

## 4. The status-aware loader

`src/components/cityscape/loadCyberAssets.ts` — one call returns a map of ready textures. It routes each asset by its `bg`, skips `skip`, and never throws on a missing file.

```tsx
import * as THREE from 'three'
import { CYBER_ASSETS, BASE, type AssetSpec } from './cyberAssets'
import { tryLoadTexture, loadCheckerboardAsAlpha } from './cyberTextureUtils'

export type CyberTextures = Partial<Record<string, THREE.Texture>>

async function loadOne(spec: AssetSpec): Promise<THREE.Texture | null> {
	if (spec.bg === 'skip') return null // generated procedurally elsewhere
	const url = `${BASE}/${spec.file}`
	const tex = spec.bg === 'checkerboard'
		? await loadCheckerboardAsAlpha(url) // strip fake transparency first
		: await tryLoadTexture(url)          // clean / black load the same way
	if (tex && spec.tile) {
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping
	}
	return tex
}

export async function loadCyberAssets(): Promise<CyberTextures> {
	const out: CyberTextures = {}
	await Promise.all(
		Object.values(CYBER_ASSETS).map(async (spec) => {
			const t = await loadOne(spec)
			if (t) out[spec.id] = t
		}),
	)
	return out
}

/** Helper consumers use to pick the right blending without re-checking status. */
export function isAdditive(id: string): boolean {
	return CYBER_ASSETS[id]?.bg === 'black'
}
```

Load once near the top of `AICityscape` and thread the result down (or stash in a ref / context):

```tsx
const [tex, setTex] = React.useState<CyberTextures>({})
React.useEffect(() => { loadCyberAssets().then(setTex) }, [])
```

---

## 5. Per-system wiring

Each subsection: where it plugs into the existing code, the snippet, and the fallback when the texture is absent. **Keep all existing procedural code; only add the `if (tex) …` branch.**

### 5.1 Building facades (#1) — `AICityscape.tsx` instanced building material

Apply a tiled facade `map` to the instanced shell. Pick the variant by building height bucket (tall → 1b, short → 1c, else 1a). If none loaded, keep the flat `#141826` shell color.

```tsx
function facadeFor(b: PlacedBuilding, tex: CyberTextures): THREE.Texture | undefined {
	const pick = b.height > 60 ? '1b' : b.height < 25 ? '1c' : '1a'
	return tex[pick] ?? tex['1a']
}
// when building the material:
const facade = facadeFor(building, tex)
if (facade) {
	facade.wrapS = facade.wrapT = THREE.RepeatWrapping
	facade.repeat.set(1, Math.max(1, Math.round(building.height / 12))) // tile vertically
	mat.map = facade
} // else: existing shell color path, untouched
```

### 5.2 Window atlas (#2) — `cityscape.utils.ts → buildWindowAtlas()`

The atlas is a 5×3 grid. Composite the loaded window PNGs into the *same* atlas canvas cells the procedural code already uses. **Per-cell fallback:** if a given window PNG is missing, draw that cell the old (canvas) way so the atlas is always complete.

```tsx
// inside buildWindowAtlas(tex?: CyberTextures)
const patterns = ['2a', '2b', '2c']     // columns: pattern types
const ratios   = ['2h','2g','2f','2e','2d'] // rows: lit ratio 0..4
for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
	const id = c === 0 ? ratios[r] : patterns[c] // map cell -> available asset
	const img = tex?.[id]?.image as CanvasImageSource | undefined
	if (img) ctx.drawImage(img, c * cellW, r * cellH, cellW, cellH)
	else drawProceduralWindowCell(ctx, c, r, cellW, cellH) // existing fallback
}
```

<aside>
🧩

Keep the existing `onBeforeCompile` UV math that samples this atlas. You're only changing *how the atlas pixels are produced*, not how the shader reads them.

</aside>

### 5.3 Ground (#3) — `NeonGround` ShaderMaterial

3a/3b are a real surface *under* the glow; 3c is an additive neon overlay. Add two uniforms; keep every existing grid / avenue / traffic-dash line.

```glsl
// add to fragment uniforms
uniform sampler2D uAsphalt;  uniform float uHasAsphalt;
uniform sampler2D uLanes;    uniform float uHasLanes;
// near the start of main(), replace the flat base color:
vec3 base = uHasAsphalt > 0.5 ? texture2D(uAsphalt, vUv * 8.0).rgb : uBaseColor;
// … existing grid + avenue + traffic-dash glow accumulates into `glow` …
vec3 color = base + glow; // existing additive grid stays
if (uHasLanes > 0.5) color += texture2D(uLanes, vUv * 8.0).rgb; // 3c additive neon
```

```tsx
uniforms.uAsphalt = { value: tex['3a'] ?? null }
uniforms.uHasAsphalt = { value: tex['3a'] ? 1 : 0 }
uniforms.uLanes = { value: tex['3c'] ?? null }
uniforms.uHasLanes = { value: tex['3c'] ? 1 : 0 }
```

### 5.4 Atmosphere (#6) — generate, don't load

The #6 files are `skip`. Build the particle sprite in code and feed the existing `Points` system. Tint per type at the material level.

```tsx
import { makeRadialGlow } from './cyberTextureUtils'
const rainSprite  = makeRadialGlow(64, '#bcd4ff')
const emberSprite = makeRadialGlow(64, '#ffb15a')
const rainMat = new THREE.PointsMaterial({
	map: rainSprite, size: 2.2, transparent: true,
	blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
})
// rain looks like streaks by scaling the Points object on Y, not the texture:
pointsObject.scale.set(1, 2.4, 1)
```

Fog (6c) becomes a few large, slow, low-opacity additive sprites using the same `makeRadialGlow(512)`.

### 5.5 Neon & holo (#5) — rooftop sprites

5a is `black` (additive eats the bg); 5b/5c are `clean` alpha. Use `isAdditive(id)` to choose blending so you don't special-case by hand.

```tsx
function neonSprite(id: string, tex: CyberTextures) {
	const map = tex[id]; if (!map) return null // fallback: keep canvas agent-name sprite
	return new THREE.Sprite(new THREE.SpriteMaterial({
		map, transparent: true, depthWrite: false, toneMapped: false,
		blending: isAdditive(id) ? THREE.AdditiveBlending : THREE.NormalBlending,
	}))
}
```

### 5.6 Cars (#4) — clean body + code-driven underglow

The car PNGs are cut cleanly but carry a faint baked glow — ignore that and drive the *real* glow from code so it reacts to the scene. Body = transparent quad lying flat on the road; underglow = an additive radial blob just beneath, tinted per direction.

```tsx
const UNDERGLOW = { '4a': '#ff3d81', '4b': '#ffe066', '4c': '#0bd7ff' } as const
function makeCar(id: keyof typeof UNDERGLOW, tex: CyberTextures) {
	const body = tex[id]; if (!body) return null // fallback: keep shader traffic dashes
	const group = new THREE.Group()
	const quad = new THREE.Mesh(
		new THREE.PlaneGeometry(3, 3),
		new THREE.MeshBasicMaterial({ map: body, transparent: true, depthWrite: false }),
	)
	quad.rotation.x = -Math.PI / 2 // lie flat on the ground
	// real underglow, in code:
	const glow = new THREE.Mesh(
		new THREE.PlaneGeometry(4.2, 4.2),
		new THREE.MeshBasicMaterial({
			map: makeRadialGlow(128, UNDERGLOW[id]),
			blending: THREE.AdditiveBlending, transparent: true,
			depthWrite: false, toneMapped: false,
		}),
	)
	glow.rotation.x = -Math.PI / 2; glow.position.y = -0.05
	group.add(glow, quad)
	return group
}
```

Drive these along the *same* animated road paths the shader dashes used (reuse that path/time logic for instance positions).

### 5.7 Sky (#7)

```tsx
if (tex['7a']) {
	tex['7a'].mapping = THREE.EquirectangularReflectionMapping
	scene.background = tex['7a']
} // else: keep the existing #070912 void color
// 7b: a wide, faint billboard ring at the horizon behind the city (NormalBlending).
```

### 5.8 Street furniture (#8) + vegetation (#9)

Clean alpha already — just upright billboards on the ground plane. Scatter sparsely at block edges; skip silently if absent.

```tsx
function upright(id: string, tex: CyberTextures, h = 4) {
	const map = tex[id]; if (!map) return null
	const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }))
	s.scale.set(h * (map.image.width / map.image.height), h, 1)
	return s
}
```

### 5.9 FX overlays (#10)

10a/10c are `black` → additive; 10b is `checkerboard` → already converted to alpha by the loader, so render it as a normal transparent screen overlay.

```tsx
// 10a lens flare / 10c smoke: additive sprites in-scene
new THREE.SpriteMaterial({ map: tex['10a'], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })
// 10b rain streaks: full-screen tiled overlay (alpha already real after stripCheckerboard)
if (tex['10b']) { tex['10b'].wrapS = tex['10b'].wrapT = THREE.RepeatWrapping }
```

---

## 6. The mental model (why it's built this way)

- **Additive blending is the trick for every glow.** Output = source + destination; pure black adds nothing, so a black-bg glow needs no cutout and shows no halo. That's why `5a`, `3c`, `10a`, `10c` keep their black background and just blend.
- **A checkerboard is opaque paint, not transparency.** The image AI drew the "transparency" pattern as pixels. It has no alpha, so it must be keyed to real alpha (`10b`) — and it must **never** be additive-blended (the gray would glow).
- **Soft particles can't be cleanly keyed**, which is why #6 is unusable and we generate it in code with a radial gradient — cheaper, tintable, and artifact-free.
- **Lighting belongs in code.** Car underglow is a code-generated additive blob / light, not the baked glow in the PNG, so it spills onto the road and reacts to the scene.
- **Assets are 2D, mapped onto surfaces:** textures → `material.map` (tiled); glows → additive `Sprite`/`Points`; cutouts → transparent quads; sky → equirect `scene.background`. Nothing needs a 3D model.
- **The data still drives everything.** Layout, building heights, window-lit ratios, and time-lapse animation come from your usage data; the art only rides on top.

---

## 7. Definition of done

- [ ]  App runs unchanged with an **empty** `cyber_assets/` folder (every system falls back).
- [ ]  Facades (1), windows (2), ground (3a/3b), sky (7) render as real textures when present.
- [ ]  `5a`, `3c`, `10a`, `10c` use **additive** (no black box). `5b`, `5c`, `4*`, `8*`, `9*` render with clean transparency.
- [ ]  `10b` checkerboard is stripped to alpha before use.
- [ ]  `#6` is **generated in code** (no attempt to load the files).
- [ ]  Car underglow comes from code, not the baked PNG glow.
- [ ]  No procedural system deleted; no edits to `IDEProjectsPage.tsx`, `main.ts`, or `preload.ts`.

<aside>
🚫

**Do NOT:** additive-blend a checkerboard image · hard-cut a soft glow · bake car/scene lighting into a PNG · remove or bypass any procedural fallback · hard-require a file that may not exist yet.

</aside>
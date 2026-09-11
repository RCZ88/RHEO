<aside>
🧭

**Read this top-to-bottom.** I pulled apart your actual `src` (the real `AICityscape.tsx`, `cityscape/*`, and the asset manifest), cross-checked it against your screenshots, and found the *specific* lines causing each problem you described. This is not a guess — every item below points at real code. The plan has four parts: **(1)** what is actually broken and why, **(2)** a locked design intention (city view, not flat-earth), **(3)** a question list to hand your coding agent, and **(4)** the real fix code, including the decision to move the structural parts from flat 2D sprites to free CC0 3D models.

</aside>

## 0. The one-paragraph verdict

Your AI didn't fail at the *idea* — it failed at **plumbing and framing**. The textures are white because the image files are not being served at the URL the code requests (a path mismatch — they live in `docs/`, the code fetches `/cyber_assets/`). The "flat earth" is a literal **54-unit radius disc** (`circleGeometry`) with glowing edge rings and a cylinder skirt, with the city packed almost to its rim. The "police siren" is three additive neon rooftop colors (cyan / purple / pink) under a very strong bloom. The "papers colliding" is because **every prop is a camera-facing 2D sprite**. All of this is fixable, and the biggest visual upgrade is to stop faking structure with sprites and drop in **free CC0 3D building/prop models**. Details and code below.

---

## 1. What's actually broken (from YOUR code)

| Your words | Real root cause (in your source) | Fix (section) |
| --- | --- | --- |
| "none of the textures load, it's all just white shape" | **Path mismatch / assets not served.** The manifest uses `BASE = '/cyber_assets'` and fetches `/cyber_assets/1a.jpg`, but the files actually live at `docs/ai-usage-city-viz/cyber-assets/` (note: under `docs/`, folder spelled with a **hyphen**, and there is **no** `public/` folder in the build). Every fetch 404s → `tryLoadTexture` returns `null` → every system falls back to its white/procedural state. This is the #1 bug. | §5.1 |
| "the texture of the tower is still using the old one" | Two things. (a) The facade never loads (same 404). (b) The live **window-atlas re-build silently no-ops**: the update reads `(mat as any).__compiledShader`, but nothing ever assigns `__compiledShader`, so the new atlas is never pushed to the GPU. The facade uniform *is* shared by reference and would work once the file loads. | §5.1, §5.3 |
| "flat earth… the city takes 60% of the earth… why is the circle so big" | **`NeonGround` is a `circleGeometry` of `PLATFORM_RADIUS = 54`** lying flat, with two bright edge **rings**  • a **cylinder skirt** underneath. The camera orbits it (target `[0,4,0]`, distance 24–110) so you see the disc edge → reads as a flat planet. Buildings + cars populate out to ~r40, so the city fills most of the disc. | §5.2 |
| "there's a spaceship ball" | The soft glowing orb is an **`AtmosphereGlow` radial sprite** (a `makeRadialGlow` billboard placed at sky level) amplified by **Bloom intensity 1.7**. It floats in mid-scene with no anchor, so it looks like a UFO/sphere. | §5.2, §5.6 |
| "the checkerboard background on the rain is visible everywhere" | Asset `10b` is tagged `checkerboard` and rendered with **NormalBlending**, but the de-checkerboard helper is **buggy**: `idx(d,x,y)` hard-codes a **2048 stride** (`(y*2048+x)*4`), so on any image that isn't exactly 2048px wide it samples the wrong pixels and **fails to strip** the checker → the opaque checker squares render as-is. | §5.4, §5.5 |
| "green, purple, red — looks like a police siren" | The instanced **rooftops** are flat=`#00eaff` (cyan), pyramid=`#a855f7` (purple), antenna=`#ff3d81` (pink) — all `AdditiveBlending`, plus ground traffic `#ff3d81`/`#ffe066`/`#0bd7ff` and three colored `Lightformer`s — all blown out by **Bloom 1.7 / threshold 0.95**. Too many saturated primaries at full strength. | §5.6 |
| "a bunch of 2D papers colliding with one another" | Cars, street furniture, vegetation, and neon signs are all **`<sprite>`** (always face the camera) or flat planes, scattered/orbiting near the ground. Overlapping camera-facing quads at the base = the "floating papers" look. This is inherent to billboards; it cannot be fully styled away. | §5.7 + §4 |

<aside>
✅

**Good news:** the data pipeline, the instanced-building morphing, the window-atlas shader, the GPU rain points, and the post-processing stack are all fine. We are fixing *plumbing, framing, palette, and the 2D→3D decision* — not rebuilding the engine.

</aside>

---

## 2. Design intention — LOCKED

The single sentence the agent must obey:

<aside>
🌆

**This is a street-to-skyline CITY VIEW — a camera standing inside/above a neon city looking toward a horizon that dissolves into fog and sky. It is NOT a planet, NOT a hologram globe, NOT a disc floating in space.**

</aside>

Concrete rules that follow from that:

- **No visible ground edge.** The ground must read as "continues past what you can see." That means a large plane (or a disc far bigger than the city) whose far region is fully swallowed by fog *before* any rim is reached. **Delete the edge rings and the cylinder skirt.**
- **Horizon, not curvature.** The eye should meet a flat horizon line where ground fog meets sky, like a real skyline — never a curved disc edge.
- **The city is dense in the middle, sparse toward the edges, then fog.** Don't pack buildings to the rim.
- **Camera sits lower and looks outward**, slightly down — a drone hovering over downtown, not a god looking down at a coin.
- **One moon/orb max, parked in the sky** behind the skyline (small, distant), if you want a focal celestial object. Not a glowing ball hovering between buildings.

---

## 3. Questions to hand your coding agent

Paste these to your agent and require answers *before* it edits anything. They're ordered to surface the real bugs fast.

### A. Asset serving (most important)

1. At runtime, what is the **exact URL** the app requests for `1a.jpg`? Open DevTools → Network and paste the full request URL and its **status code** (200 vs 404).
2. Where on disk does the bundler serve static files from (the `public/` dir for Vite, or the packaged resources dir for Electron)? Does a `cyber_assets/` folder exist *there*, or only under `docs/`?
3. Is the app served from a sub-path (so `/cyber_assets/...` resolves wrong) or under a custom protocol (`file://`, `app://`) in Electron? What does `import.meta.env.BASE_URL` print?
4. Confirm the on-disk filenames **exactly** match the manifest, including extension and case (`1a.jpg` vs `1A.JPG` vs `1a.png`).

### B. Why towers stay white/old

1. After load, log `Object.keys(loadedTextures)` — which IDs actually resolved to a Texture, and which are missing?
2. Does `mat.onBeforeCompile` ever store the compiled shader so the window-atlas update can reach it? Where is `__compiledShader` assigned? (Answer: it isn't — that's the bug.)
3. Is `uHasFacade` ever `1` at draw time? Log it in `useFrame`.

### C. Framing / "flat earth"

1. What is `PLATFORM_RADIUS`, and what is the max radius any building or car is placed at? What is the ratio? (We want city radius ≪ ground radius.)
2. What are the camera `fov`, `position`, and `OrbitControls` `target`, `minDistance`, `maxDistance`, `minPolarAngle`, `maxPolarAngle`?
3. What `fog` type and density is set, and at what world distance does it reach ~100% opacity? Does it hide the ground edge?

### D. The glowing ball + siren palette

1. List every object using `AdditiveBlending` and every `Lightformer`/light with a saturated color. What are the Bloom `intensity`, `luminanceThreshold`, and `radius`?
2. What exactly is the bright sphere in the screenshot — which component renders it, at what position and scale?

### E. The 2D mess

1. Which props are `<sprite>` (billboards) vs real meshes? Cars, furniture, trees, signs?
2. Are you open to loading `.glb` 3D models via `GLTFLoader` + `InstancedMesh`, or must everything stay 2D? (Recommended: go 3D — see §4.)

---

## 4. The strategic call: go 3D for structure (free CC0 assets)

You asked the real question: *"is it fine that we're using 2D?"* **For flat backdrops and signs, yes. For buildings, cars, trees, and street furniture, no** — camera-facing sprites will always look like floating paper. The highest-leverage upgrade is to use **free, CC0 (no-attribution, commercial-OK) 3D models** for the structural props and keep 2D only where it genuinely works (sky dome, distant skyline band, billboard *faces* mapped onto real quads).

### Free 3D model sources (all usable, all free)

| Source | License | Best for | Format |
| --- | --- | --- | --- |
| Kenney — City Kit (Commercial / Suburban / Roads / Industrial) — kenney.nl | **CC0** (no credit needed) | Low-poly modular buildings, roads, props — perfect for instancing | glTF, FBX, OBJ |
| Quaternius — Cyberpunk Game Kit + Downtown City MegaKit — quaternius.com | **CC0** | Stylized cyberpunk buildings, neon props, vehicles; MegaKit has fake-window-interior shader | glTF, FBX, OBJ, BLEND |
| Poly Pizza — poly.pizza | CC0 + CC-BY | Individual low-poly cars, trees, lamps, benches — grab exactly what you need | glTF/GLB |
| Poly Haven — polyhaven.com | **CC0** | Hi-quality HDRIs (use as the sky/equirect background) + PBR textures | HDR, glTF, textures |
| ambientCG — ambientcg.com | **CC0** | Tileable PBR facade / asphalt / concrete textures (replace 2D facade guesses) | PNG/JPG + maps |
| OpenGameArt (filter CC0) + Sketchfab (filter "Downloadable" + CC license) | CC0 / CC-BY (check each) | One-off hero props; verify license per model | glTF, FBX, OBJ |

### Free tools (for cleaning/converting assets — all free)

| Tool | Use |
| --- | --- |
| **Blender** (blender.org) | Open any model, decimate polys, re-export optimized `.glb`. Free, open source. |
| **gltf-transform** CLI (`npm i -g @gltf-transform/cli`) | Compress/Draco/dedupe `.glb` for fast web load: `gltf-transform optimize in.glb out.glb`. |
| **gltfpack / meshopt** | Aggressive mesh + texture compression for the web. |
| **rembg** (`pip install rembg`) / **GIMP** "Color to Alpha" | If you keep any 2D cutouts, strip backgrounds to *real* alpha offline — never rely on runtime checkerboard stripping (see §5.5). |
| **ImageMagick** / **sharp** | Batch resize/convert textures; generate alpha from luminance for glow PNGs. |

<aside>
💡

**Hybrid rule going forward:** 3D `.glb` for buildings, cars, trees, lampposts, signs (real geometry). 2D only for: the sky (HDRI/equirect), a distant skyline silhouette band, and image *faces* on billboard quads that sit flush on a building wall. Nothing that needs to look solid should be a free-floating sprite.

</aside>

---

## 5. The fixes (actual code)

### 5.1 Fix asset serving — do this FIRST (nothing else matters until textures 200)

The app fetches `/cyber_assets/<file>` but the files are under `docs/ai-usage-city-viz/cyber-assets/`. Put them where the web server serves static files and match the name exactly.

```bash
# Vite/CRA: static files are served from the project's public/ folder at the web root.
# Copy the asset folder there with the EXACT name the manifest expects (underscore, not hyphen):
mkdir -p public/cyber_assets
cp docs/ai-usage-city-viz/cyber-assets/* public/cyber_assets/

# Verify the names line up with the manifest (1a.jpg, 2b.png, 4a.png, 7a.png, 10b.png, ...)
ls public/cyber_assets
```

For **Electron** the renderer often can't read `/cyber_assets` as a web root. Two safe options:

```tsx
// Option A (simplest): make BASE respect the bundler base URL.
// cyberAssets.ts
export const BASE = `${ import.meta.env.BASE_URL ?? '/' }cyber_assets`.replace(/\/+/g, '/')

// Option B (Electron packaged): copy assets into the build resources and load via a
// registered protocol or an absolute file URL resolved at runtime. Whatever you choose,
// the acceptance test is identical: the Network tab shows 200 for /cyber_assets/1a.jpg.
```

<aside>
🧪

**Acceptance test:** open DevTools → Network, reload, filter "cyber_assets". Every request must be **200**, not 404. Until that's true, do not touch anything else — the white city is *only* this.

</aside>

### 5.2 Kill the flat-earth — ground, fog, camera

Replace the disc-with-rings with a ground that fades into fog before any edge, drop the skirt + rings, lower the camera, and (optionally) park a single moon far in the sky.

```tsx
// --- NeonGround: enlarge the ground far beyond the city and remove the visible rim ---
const PLATFORM_RADIUS = 220        // was 54 — make it WAY bigger than the city (~r40)
// DELETE these three meshes entirely:
//   • the cyan edge ring  (ringGeometry, color #00eaff)
//   • the purple edge ring (ringGeometry, additive #7c3aed)
//   • the cylinder skirt   (cylinderGeometry under the disc)
// Keep ONLY the shader ground mesh. Better: use a plane so there is no circular edge:
<mesh rotation={ [-Math.PI / 2, 0, 0] } position={ [0, -0.01, 0] } raycast={ () => null }>
  <planeGeometry args={ [600, 600, 1, 1] } />
  {/* keep your existing NeonGround shaderMaterial, but drive the grid fade by DISTANCE */}
</mesh>
```

```glsl
// In the ground fragment shader, fade the grid AND the surface to the fog color with distance,
// so the ground visually dissolves into the horizon instead of ending at a rim:
float dist = length(vWorld);
float horizon = 1.0 - smoothstep(60.0, 200.0, dist); // fully faded by ~200u
col *= horizon;
gl_FragColor = vec4(col, horizon);                   // alpha goes to 0 at the horizon
```

```tsx
// --- Camera + controls: stand inside the city, look outward, not down at a coin ---
<Canvas camera={ { fov: 55, position: [0, 14, 46], near: 0.1, far: 600 } }>
...
<OrbitControls
  enableDamping
  dampingFactor={ 0.08 }
  target={ [0, 8, 0] }       // look at mid-building height, not the floor
  minDistance={ 30 }
  maxDistance={ 120 }
  minPolarAngle={ Math.PI / 3.2 }   // keep the camera fairly horizontal (skyline view)
  maxPolarAngle={ Math.PI / 2.05 }  // never look straight down onto the disc
/>
```

```tsx
// --- Fog: denser + matched to sky so the horizon is a soft line, not an edge ---
<fogExp2 attach="fog" args={ ['#0a0c18', 0.014] } /> // tune so buildings vanish ~r160
```

```tsx
// --- Optional single moon, parked far in the sky behind the skyline ---
function Moon() {
  const tex = useMemo(() => makeRadialGlow(256, '#cfe3ff'), [])
  return (
    <sprite position={ [40, 70, -180] } scale={ [40, 40, 1] } raycast={ () => null }>
      <spriteMaterial map={ tex } transparent depthWrite={ false } opacity={ 0.5 } />
    </sprite>
  )
}
// and REMOVE the free-floating AtmosphereGlow orbs that read as a UFO.
```

### 5.3 Buildings — fix the wiring now, move to 3D next

**Immediate (keep boxes, make textures actually apply):** store the compiled shader so the window-atlas update reaches the GPU.

```tsx
// in useBuildingMaterial(), inside onBeforeCompile:
mat.onBeforeCompile = (shader) => {
  shader.uniforms.uWindowAtlas = { value: texture }
  shader.uniforms.uFacade = uniforms.current.uFacade
  shader.uniforms.uHasFacade = uniforms.current.uHasFacade
  ;(mat as any).__compiledShader = shader   // <-- ADD THIS. Without it the atlas update no-ops.
}
```

**Upgrade (recommended): real 3D buildings via GLTF + instancing, WITH VARIETY.** Don't load just one model — load **several models per height tier** and assign one to each building *deterministically* (so a given building always gets the same model and never flickers on re-render). This is what makes a skyline look real instead of one tower copy-pasted.

```tsx
import { useMemo } from 'react'
import { useGLTF, Instances, Instance } from '@react-three/drei'

// 2–4 models per tier = lots of skyline variety. Add as many as you download.
const BUILDING_MODELS: Record<'low' | 'med' | 'tall', string[]> = {
  low:  ['/cyber_assets/models/building-low-a.glb',  '/cyber_assets/models/building-low-b.glb'],
  med:  ['/cyber_assets/models/building-med-a.glb',  '/cyber_assets/models/building-med-b.glb'],
  tall: ['/cyber_assets/models/building-tall-a.glb', '/cyber_assets/models/building-tall-b.glb', '/cyber_assets/models/building-tall-c.glb'],
}

// stable hash so a given building ALWAYS gets the same model + rotation (no flicker)
function hash(id: string, salt: number) {
  let h = salt
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}
function pick<T>(arr: T[], id: string): T { return arr[hash(id, 7) % arr.length] }
function tierFor(height: number): 'low' | 'med' | 'tall' {
  return height < 12 ? 'low' : height < 26 ? 'med' : 'tall'
}

// One <Instances> group per model URL = still just a handful of draw calls total.
function BuildingsForModel({ url, buildings }: { url: string; buildings: PlacedBuilding[] }) {
  const { nodes } = useGLTF(url) as any
  const mesh = Object.values(nodes).find((n: any) => n.isMesh) as any
  return (
    <Instances geometry={ mesh.geometry } material={ mesh.material } frustumCulled={ false }>
      { buildings.map((b) => (
        <Instance key={ b.id } position={ [b.x, 0, b.z] }
          scale={ [b.footprint, b.height / 10, b.footprint] }       // data still drives height
          rotation={ [0, (hash(b.id, 13) % 4) * Math.PI / 2, 0] }   // 90° spin = even more variety
          color={ b.active ? b.color : '#33384a' } />
      )) }
    </Instances>
  )
}

function Buildings3D({ buildings }: { buildings: PlacedBuilding[] }) {
  // assign each building a specific model, then group buildings by model URL
  const groups = useMemo(() => {
    const m = new Map<string, PlacedBuilding[]>()
    for (const b of buildings) {
      const url = pick(BUILDING_MODELS[tierFor(b.height)], b.id)
      const arr = m.get(url) ?? []
      if (!m.has(url)) m.set(url, arr)
      arr.push(b)
    }
    return [...m.entries()]
  }, [buildings])
  return <>{ groups.map(([url, bs]) => <BuildingsForModel key={ url } url={ url } buildings={ bs } />) }</>
}

// preload every model so there's no pop-in
Object.values(BUILDING_MODELS).flat().forEach((u) => useGLTF.preload(u))
```

With 2–3 models per tier plus the 90° rotation (and optional tiny footprint jitter), even a handful of models reads as a richly varied skyline. The kit models ship with baked windows/edges, so the "white shapeless box" problem disappears the moment they load. Apply ambientCG facade textures only if you want extra surface detail.

### 5.4 Rain — your "solid image + translucency in code" doctrine (and it's already half-done)

You were right, and the good news: **your rain is already procedural** (`Atmosphere` is a GPU `points` shader, no image needed). The checkerboard you see is **not** the rain mesh — it's the `10b` overlay sprite bleeding its un-stripped checker on top. So:

1. **Stop using `10b` as a rain overlay.** Delete the `10b` sprite from `FXOverlay`. The procedural points already *are* the rain.
2. Make the procedural rain read as streaks (it currently uses round points). Stretch each point vertically and bias the color cooler:

```glsl
// vertex: make rain points tall thin streaks instead of dots
gl_PointSize = (aKind < 0.5 ? 2.4 : 3.0) * (60.0 / -mv.z);
// fragment: shape the rain as a vertical streak via gl_PointCoord, translucency from CODE
if (vKind < 0.5) {
  vec2 pc = gl_PointCoord - 0.5;
  float streak = smoothstep(0.5, 0.0, abs(pc.x) * 6.0) * smoothstep(0.5, 0.0, abs(pc.y));
  gl_FragColor = vec4(vec3(0.6, 0.74, 1.0), streak * 0.35); // alpha = code-controlled translucency
}
```

**Doctrine for ALL future image assets (rain, glow, smoke, neon):** generate the source image **100% solid / opaque on a pure black field** (no AI-painted transparency, no checkerboard). Then create translucency in code: `AdditiveBlending` for anything glowing (black contributes zero light and vanishes), or a code-driven `opacity`/alpha mask for everything else. **Never** ask the image generator for "transparent background" again — that's what produced the checkerboard mess.

### 5.5 If you keep any 2D cutouts — fix or replace the checkerboard stripper

The runtime stripper is buggy (hard-coded `2048` stride). Best path: **strip backgrounds offline** with `rembg`/GIMP so the PNG has real alpha and you can treat it as `clean`. If you must strip at runtime, fix the stride to the real width and sample several corners:

```tsx
// FIX: stride must be the actual image width, not a hard-coded 2048.
function idx(d: Uint8ClampedArray, x: number, y: number, width: number) {
  const i = (y * width + x) * 4
  return { r: d[i], g: d[i + 1], b: d[i + 2] }
}
// then call idx(d, 0, 0, c.width) and sample a few cells (0,0)/(8,0)/(0,8) to learn both checker tones.
```

But honestly: **prefer offline alpha** + the solid-asset doctrine in §5.4 and retire `loadCheckerboardAsAlpha` entirely.

### 5.6 Kill the "police siren" — palette + bloom discipline

```tsx
// 1) Stop the rainbow rooftops. Tie rooftop color to the building's OWN agent color
//    (or a single accent), not three saturated primaries:
<meshBasicMaterial toneMapped={ false } blending={ THREE.AdditiveBlending } color="#39507a" />
// use ONE restrained accent for all roof types, or pass per-instance b.color * 0.6.

// 2) Calm the bloom so neon glows instead of screaming:
<Bloom mipmapBlur luminanceThreshold={ 1.05 } luminanceSmoothing={ 0.25 } intensity={ 0.9 } radius={ 0.7 } />

// 3) Reduce the colored Lightformers to a cohesive 2-color scheme (e.g. cyan key + magenta rim,
//    lower intensity), and drop the pink directionalLight to ~0.12.
```

Guiding principle: pick **one cool key (cyan/blue) + one warm accent (magenta or amber)** and let *data* decide where accents appear (active agents glow, idle ones stay dim). Saturated cyan+purple+pink+yellow all at once is the siren.

### 5.7 Kill the "papers colliding"

- **Cars** → you have **7 car models** (`car-1.glb` … `car-7.glb`). Define `const CAR_MODELS = ['/cyber_assets/models/car-1.glb', … , '/cyber_assets/models/car-7.glb']` and assign each car a model deterministically by its id (`pick(CAR_MODELS, id)`, same helper as the buildings) so traffic looks varied instead of cloned. Orient each along its travel direction (not a billboard), and add the underglow as a code additive blob beneath (you already have `makeRadialGlow`).
- **Street furniture + trees** → use the real models you downloaded: `StreetLight-1.glb`/`StreetLight-2.glb` (street lights), `Bench-1.glb`/`Bench-2.glb` (benches), `Tree-1.glb`/`Tree-2.glb`/`Tree-3.glb` (trees), and `road.glb` for road tiles. Pick per-instance with the same `pick(arr, id)` hash so they vary. Real geometry stands up correctly from every angle.
- **Neon signs / billboards** → map the 2D image onto a **flat quad fixed flush to a building wall** (a real plane with a fixed orientation), NOT a camera-facing `<sprite>`. A wall sign should stay on the wall when you orbit.
- Keep `<sprite>` only for genuinely point-like glows (the moon, distant light blooms).

---

## 6. Asset shopping list (what to download, from where)

Hand this to yourself or the agent as a checklist:

- [ ]  **Buildings:** Kenney *City Kit (Commercial)* + Quaternius *Downtown City MegaKit* → pick 3 building `.glb`s (short/mid/tall). Put in `public/cyber_assets/models/`.
- [ ]  **Cars (3–4):** Poly Pizza low-poly cars (`.glb`).
- [ ]  **Props:** lamppost, traffic light, bench, tree, planter from Poly Pizza / Kenney.
- [ ]  **Sky:** one night/dusk **HDRI** from Poly Haven → use as equirect `scene.background` (replaces the `7a` guess; far better horizon).
- [ ]  **Facade/road textures:** ambientCG tileable concrete/asphalt/`Facade` PBR sets (only if you keep box buildings).
- [ ]  Run every `.glb` through `gltf-transform optimize` before shipping.

---

## 7. Definition of done

- [ ]  Network tab shows **200** for every `/cyber_assets/*` request. No 404s.
- [ ]  No visible ground edge, rings, or skirt — the ground dissolves into fog at the horizon.
- [ ]  Camera reads as a **skyline/drone city view**, never a disc/planet.
- [ ]  Buildings are textured (or real 3D models) — no white shapeless boxes.
- [ ]  No checkerboard anywhere; rain is procedural streaks; `10b` overlay removed.
- [ ]  Palette is 1 cool + 1 warm accent, data-driven; bloom calmed; no siren.
- [ ]  Cars/furniture/trees are upright 3D (or wall-flush quads), not floating papers.
- [ ]  App still runs if a model/texture is missing (keep the `null` fallbacks).

<aside>
🚫

**Do NOT:** request "transparent background" images from the generator (causes checkerboards) · additive-blend a checkerboard · ship un-optimized `.glb` · pack buildings to the ground's rim · use camera-facing sprites for anything that should look solid · keep the edge rings / cylinder skirt · leave `__compiledShader` unset.

</aside>

---

## 8. What I need from you

1. Run the §3.A questions (especially #1 — the 200/404 check) and paste the answers. That confirms the path fix before anything else.
2. Tell me if you're good to go **3D** (download the CC0 kits) or want to stay 2D for now — it changes how much of §5.7 the agent does.
3. If you want, I can write the exact prompts to regenerate the rain/glow/smoke assets as **solid-on-black** images (per §5.4) so the next batch is clean by construction.

YOUR Asset Download Checklist (human-only) — exact sites, files, save paths

AI Agent Implementation Runbook — asset wiring + ordered build steps
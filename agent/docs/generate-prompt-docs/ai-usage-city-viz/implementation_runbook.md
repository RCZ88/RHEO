<aside>
📋

**Agent: this is your execution spec. Read it once, then work top-to-bottom.** It is written as an ordered runbook with a testable **DONE-WHEN** gate after every phase. Do not start a phase until the previous phase's gate is green. Where a phase says "see Overhaul §5.x", open the parent page *AICityscape Overhaul* for the full code; this page adds the **asset-specific wiring** (exact filenames → exact surfaces) that the overhaul page does not spell out. When you finish, fill in the **Output contract** at the bottom.

</aside>

## 0. Contract (how to run this)

- Execute Phases 1–9 **in order**. Each has a **DONE-WHEN** gate — a concrete, checkable condition. If a gate fails, fix it before moving on.
- **Never** invent asset filenames. Use only the IDs/files in §2. If an asset is missing, log a warning and keep the existing `null` fallback — do not crash.
- Keep every change behind the existing graceful-degradation pattern: a missing texture or model must never blank the scene.
- Answer the diagnostic questions in **Overhaul §3** as you go (paste answers into the Output contract).
- Treat `bg` in the manifest as law: `'black'` → additive glow, `'clean'` → normal texture, `'skip'` → generate in code (no fetch), `'checkerboard'` → **do not use**.

---

## 1. Inputs you have

**A. 2D images** (already in the repo) — copied to `public/cyber_assets/` in Phase 1. Manifest lives in `components/cityscape/cyberAssets.ts`; the canonical mapping is §2 below.

**B. 3D models + HDRI** (downloaded by the human) — in `public/cyber_assets/models/`, `public/cyber_assets/hdri/`, `public/cyber_assets/textures/`:

| File(s) | Use |
| --- | --- |
| **Buildings** — low: `building-low-a.glb`, `building-low-b.glb` · med: `building-med-a.glb`, `building-med-b.glb` · tall: `building-tall-a.glb`, `building-tall-b.glb`, `building-tall-c.glb` | Instanced buildings, picked per tier (Overhaul §5.3). Tier word is **med**, not mid. |
| **Cars (7)** — `car-1.glb` … `car-7.glb` | Traffic on the road grid |
| **Street** — `road.glb`, `StreetLight-1.glb`, `StreetLight-2.glb` | Road tiles + street lights (`StreetLight-*` replaces the old lamppost) |
| **Props** — `Bench-1.glb`, `Bench-2.glb`, `Tree-1.glb`, `Tree-2.glb`, `Tree-3.glb` | Street furniture / vegetation |
| `night_sky.hdr` | Sky environment + reflections (primary sky) |
| `Facade011_*.jpg` (optional) | PBR facade for any box buildings you keep |

<aside>
⚠️

**Use these EXACT filenames — hyphens, and the exact capitalization shown.** On Linux/Electron the case is significant: `tree-1.glb` will 404 because the file is `Tree-1.glb`. Buildings/cars/road are lowercase-hyphen (`building-med-a.glb`, `car-3.glb`); props are capitalized (`Bench-1.glb`, `StreetLight-1.glb`, `Tree-1.glb`). Note the building tier word is **med**, not mid. There is **no traffic-light model** — use `StreetLight-*` for street lights and just skip the 8b traffic-light slot.

</aside>

---

## 2. Asset application matrix (the core mapping)

This is the single source of truth for **what each 2D asset becomes**. `Status` legend: **USE** = wire it up · **REPLACED** = a 3D model now does this job, retire the 2D sprite · **GENERATED** = made in code, never fetched · **DROP** = do not use.

| ID | File | New role &amp; how it's applied | Blend / colorSpace | Status |
| --- | --- | --- | --- | --- |
| 1a | 1a.jpg | Base facade → facade map for **mid** box buildings, or detail overlay on 3D mid models | Normal · SRGB · tiled | USE |
| 1b | 1b.jpg | Tall facade → facade for **tall** buildings | Normal · SRGB · tiled | USE |
| 1c | 1c.jpg | Low facade → facade for **low** buildings | Normal · SRGB · tiled | USE |
| 2b | 2b.png | **Window-emissive atlas (primary)** → emissive map on building material; this is the lit-windows look | Normal · SRGB | USE |
| 2a,2c | 2a/2c.png | Alternate window patterns → use to vary windows across buildings (pick per building hash) | Normal · SRGB | USE |
| 2d–2h | 2d–2h.png | Window brightness states (80/60/40/20/5%) → drive emissive **intensity by building activity** (`b.active`, `messageCount`) | Normal · SRGB | USE |
| 3a | 3a.png | Asphalt → **ground/road albedo** (tiled) on the big ground plane | Normal · SRGB · tiled | USE |
| 3b | 3b.png | Sidewalk → sidewalk strips beside roads (tiled) | Normal · SRGB · tiled | USE |
| 3c | 3c.png | Neon lane markings → **additive overlay** on the road material | **Additive** · SRGB · tiled | USE |
| 4a,4b,4c | 4*.png | Cars/truck → **REPLACED** by `car-1.glb` … `car-7.glb`. Keep only as a flat fallback if a model fails to load. | — | REPLACED |
| 5a | 5a.png | Neon sign base → **additive emissive** mapped on a wall-flush quad | **Additive** · SRGB | USE |
| 5b | 5b.png | Holo billboard → standing/wall quad (real plane, fixed orientation) | Normal · SRGB | USE |
| 5c | 5c.png | Neon arrow → small wall-flush sign quad | Normal · SRGB | USE |
| 6a,6b,6c | — | Rain / ember / fog dot → **GENERATED** via `makeRadialGlow()`. `bg:'skip'` — never fetch a file. | Additive · — | GENERATED |
| 7a | 7a.png | Equirect sky → **fallback** sky only (use HDRI as primary). Map as equirect background. | Normal · SRGB · equirect | USE (fallback) |
| 7b | 7b.png | Horizon band → distant skyline silhouette plane behind the city, sitting in the fog line | Normal · SRGB | USE |
| 8a,8b,8c | 8*.png | Lamppost / traffic light / bench → **REPLACED** by `StreetLight-1.glb`/`StreetLight-2.glb`  • `Bench-1.glb`/`Bench-2.glb`. No traffic-light model exists — skip 8b. | — | REPLACED |
| 9a,9b | 9*.png | Tree / planter → **REPLACED** by `Tree-1.glb` / `Tree-2.glb` / `Tree-3.glb` | — | REPLACED |
| 10a | 10a.png | Lens flare → **additive** flare; point-like, so a `<sprite>` is acceptable here | **Additive** · SRGB | USE |
| 10b | 10b.png | Rain streak overlay → **DROP**. Checkerboard bg + buggy stripper; rain is procedural (Phase 6). | — | DROP |
| 10c | 10c.png | Smoke wisps → **additive** smoke on a few drifting quads near street level (tiled) | **Additive** · SRGB · tiled | USE |

---

## 3. Phase 1 — Asset serving (do FIRST)

Follow **Overhaul §5.1**. Concretely:

```bash
mkdir -p public/cyber_assets/models public/cyber_assets/hdri public/cyber_assets/textures
cp docs/ai-usage-city-viz/cyber-assets/* public/cyber_assets/   # the 2D images (1a.jpg, 2b.png, ...)
# the human places the .glb / .hdr files into models/ and hdri/ themselves
ls public/cyber_assets        # must list 1a.jpg, 1b.jpg, 1c.jpg, 2a-2h.png, 3a-3c.png, 5*.png, 7*.png, 10a/10c.png
```

If Electron can't serve `/cyber_assets` as a web root, apply **Overhaul §5.1 Option A** (`BASE = import.meta.env.BASE_URL + 'cyber_assets'`).

<aside>
🧪

**DONE-WHEN:** DevTools → Network, reload, filter `cyber_assets` → every request is **200** (not 404). Specifically `/cyber_assets/1a.jpg` and `/cyber_assets/models/building-tall-a.glb` both return 200.

</aside>

---

## 4. Phase 2 — Texture loader (manifest → ready textures)

Create one loader that turns the manifest into correctly-configured textures. It is the only place that reads `bg`/`tile`. Skip `skip` and `checkerboard`.

```tsx
// components/cityscape/loadCyberTextures.ts
import * as THREE from 'three'
import { CYBER_ASSETS, BASE, type LoadedTextures } from './cyberAssets'

const loader = new THREE.TextureLoader()

export async function loadCyberTextures(): Promise<LoadedTextures> {
  const out: LoadedTextures = {}
  await Promise.all(Object.values(CYBER_ASSETS).map(async (spec) => {
    if (spec.bg === 'skip' || spec.bg === 'checkerboard') return  // 6a/6b/6c generated; 10b dropped
    try {
      const tex = await loader.loadAsync(`${ BASE }/${ spec.file }`)
      tex.colorSpace = THREE.SRGBColorSpace                  // every asset here is a COLOR image
      if (spec.tile) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.anisotropy = 8
      out[spec.id] = tex
    } catch {
      console.warn('[cyber] missing/failed asset, keeping fallback:', spec.id)
    }
  }))
  return out
}

// Material factory that obeys the additive (bg:'black') convention.
export function makeAssetMaterial(id: string, tex: THREE.Texture) {
  const additive = CYBER_ASSETS[id]?.bg === 'black'
  return new THREE.MeshBasicMaterial({
    map: tex, transparent: true,
    depthWrite: !additive, toneMapped: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
}
```

<aside>
🧪

**DONE-WHEN:** on boot, `Object.keys(loadedTextures).length` ≥ the number of USE-status 2D assets, and the console shows **no** fetch attempts for `6a/6b/6c/10b`.

</aside>

---

## 5. Phase 3 — 3D structure (buildings, cars, props)

**First, normalize the downloaded models.** The human's files are already single-file `.glb`s (good — no packing needed). Just optimize them for fast load; keep the exact filenames:

```bash
npm i -g @gltf-transform/cli
# compress every model in place (smaller + faster load):
for f in public/cyber_assets/models/*.glb; do gltf-transform optimize "$f" "$f" --compress draco; done
```

(If a kit ever ships a multi-file `.gltf` + `.bin` + textures instead, pack it first with `gltf-transform copy in.gltf out.glb`, then optimize.) The exact files present are listed in §1; the `BUILDING_MODELS` / `CAR_MODELS` arrays reference them directly.

Implement exactly as **Overhaul §5.3** (multi-model instanced buildings with deterministic per-building pick + 90° rotation) and **§5.7** (cars = 3–5 `.glb` models assigned per car id; lamppost/tree/bench as real meshes). Also apply the **`__compiledShader` fix** from §5.3 so window-atlas updates reach the GPU.

Key rules:

- Group instances **by model URL** → a handful of draw calls total, not one per object.
- Building height still comes from data (`scale.y = b.height / 10`).
- A model that fails to load must fall back to the existing box mesh, not crash.

<aside>
🧪

**DONE-WHEN:** buildings and cars render as solid 3D geometry with visible variety (more than one shape), no white shapeless boxes, and no camera-facing "paper" props remain for cars/trees/benches/lampposts.

</aside>

---

## 6. Phase 4 — Apply the 2D assets to surfaces

Now wire each USE asset per §2. Snippets below; place geometry using your existing layout data.

**6.1 Facades + windows on buildings** (also lets any box-fallback buildings look right):

```tsx
// pick facade by tier, window pattern by hash; drive window glow by activity
const facadeFor = (tier: 'low'|'med'|'tall', t: LoadedTextures) =>
  ({ low: t['1c'], med: t['1a'], tall: t['1b'] } as const)[tier]
const windowPattern = (id: string, t: LoadedTextures) =>
  [t['2b'], t['2a'], t['2c']].filter(Boolean)[hash(id, 5) % 3] ?? t['2b']
// emissiveIntensity from activity: idle → dim (like 2h ~5%), active → bright (2d ~80%)
const windowGlow = (b: PlacedBuilding) => (b.active ? 0.9 : 0.12) + Math.min(b.messageCount, 20) / 60
```

Feed `facade` into the existing `uFacade` uniform (set `uHasFacade = 1`) and `windowPattern` into `uWindowAtlas`. Set `material.emissiveMap = windowPattern`, `material.emissiveIntensity = windowGlow(b)`.

**6.2 Ground + road + lane glow:**

```tsx
// ground plane (Overhaul §5.2 makes the plane); give it asphalt + additive neon lanes
ground.material.map = t['3a']; t['3a'] && (t['3a'].repeat.set(40, 40))
// sidewalks: separate thin planes beside roads using t['3b']
// neon lane markings as an additive overlay mesh sitting just above the road:
const lanes = new THREE.Mesh(roadGeo, makeAssetMaterial('3c', t['3c']!))
lanes.position.y += 0.02
```

**6.3 Signs/billboards — wall-flush quads, NOT sprites:**

```tsx
function WallSign({ tex, id, pos, rotY, w, h }: { tex: THREE.Texture; id: string; pos:[number,number,number]; rotY:number; w:number; h:number }) {
  return (
    <mesh position={ pos } rotation={ [0, rotY, 0] }>
      <planeGeometry args={ [w, h] } />
      <primitive object={ makeAssetMaterial(id, tex) } attach="material" />
    </mesh>
  )
}
// 5a additive neon on walls; 5b holo billboard standing near plazas; 5c small arrows. rotY = building face normal.
```

**6.4 Sky (HDRI primary, 7a fallback) + horizon band:**

```tsx
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
// primary: night_sky.hdr as background + environment
new RGBELoader().load('/cyber_assets/hdri/night_sky.hdr', (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping
  scene.background = hdr; scene.environment = hdr
}, undefined, () => {
  // fallback: 7a equirect if the HDRI is missing
  const sky = t['7a']; if (sky) { sky.mapping = THREE.EquirectangularReflectionMapping; scene.background = sky }
})
// 7b: a wide plane far behind the city, base sitting at the fog horizon line
```

**6.5 FX:** `10a` lens flare as an additive `<sprite>` near the brightest light (point-like → sprite OK); `10c` smoke as 2–3 additive drifting quads at street level. **Do not** load `10b`.

<aside>
🧪

**DONE-WHEN:** building windows light up (and brighten with activity), the ground shows asphalt + glowing lanes, at least one wall sign sits flush on a building and stays put when you orbit, and the sky is the HDRI (or 7a) — not a flat color.

</aside>

---

## 7. Phases 5–8 — Framing, rain, palette, cleanup

These are code-only (no new assets); implement straight from the overhaul page:

| Phase | Do | Source | DONE-WHEN |
| --- | --- | --- | --- |
| 5 — Ground/camera/fog | Plane ground (radius 220) fading into fog; delete edge rings + cylinder skirt; camera fov 55, pos [0,14,46], target [0,8,0]; remove floating AtmosphereGlow orb | Overhaul §5.2 | No visible ground edge/disc; reads as a skyline, not a planet |
| 6 — Rain | Remove the `10b` overlay; keep the procedural GPU points; shape them into vertical streaks with code-driven alpha | Overhaul §5.4 | No checkerboard anywhere; rain is thin translucent streaks |
| 7 — Palette/bloom | One cool key + one warm accent; rooftop color from `b.color`, not 3 primaries; `Bloom intensity 0.9, threshold 1.05` | Overhaul §5.6 | No "police siren"; neon glows without blowing out |
| 8 — Cleanup | Confirm no leftover sprite props for solid objects; retire 4*/8*/9* sprite paths (replaced by 3D) | Overhaul §5.7 | Nothing solid is a camera-facing sprite |

---

## 8. Phase 9 — Final verification

Run the full **Overhaul §7 Definition of Done** checklist. All boxes must pass. Then capture 2–3 screenshots (straight-on skyline, orbit 45°, close on one lit building) for the human.

---

## 9. Guardrails (do NOT)

<aside>
🚫

**Do NOT:** fetch `6a/6b/6c` or `10b` (generated / dropped) · use `AdditiveBlending` on `clean` textures or normal blending on `black` ones (follow §2) · hard-code a fixed model count (discover what exists) · use a `<sprite>` for cars/buildings/trees/benches/signs (only `10a` flare + point glows may be sprites) · leave `__compiledShader` unset · pack buildings to the ground rim · request "transparent background" images ever again (solid-on-black + code alpha only) · let a missing asset crash the scene — always keep the `null` fallback.

</aside>

---

## 10. Output contract (fill this in when done)

Report back to the human with:

1. **Asset resolution table:** for every ID in §2 → `resolved 200? (y/n)` · `applied to which surface` · `status`.
2. **Answers to Overhaul §3** questions (A1 the exact URL + status code is mandatory).
3. **The 3 screenshots** from Phase 9.
4. Any asset the human still needs to provide (missing models, missing HDRI), by exact filename.
5. Confirmation that all **Overhaul §7 DoD** boxes pass.
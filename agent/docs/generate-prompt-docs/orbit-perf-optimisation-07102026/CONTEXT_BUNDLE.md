# CONTEXT_BUNDLE — Orbit (Solar System) performance optimisation

> **You do not have this codebase. This file IS the codebase, for this surface.**
> Everything below is verbatim from the repo, with file paths and line numbers.
> Do not ask for files. Do not invent APIs that are not here.

---

## 0. TL;DR

The Orbit view is a react-three-fiber scene on the DeskFlow Dashboard. It has **two** views
(`galaxy` and `solarSystem`, plus my new `OrbitalDisc` mode) and **two galaxies 3,250 world
units apart**. It already has a three-tier quality setting (`high | balanced | performance`),
but that setting currently gates almost nothing, and several of the most expensive things in
the scene are paid for whether or not they are visible.

**Every claim below is measured or read from the source. Nothing is estimated.**

---

## 1. Stack (verified in `package.json`)

`three ^0.183.2`, `@react-three/fiber`, `@react-three/drei`,
`@react-three/postprocessing`, `postprocessing`.

```tsx
// src/components/orbit/OrbitScene.tsx:17-20
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls, Stars, Html, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
```

No `InstancedMesh`, no `BatchedMesh`, no custom `ShaderMaterial` anywhere in `src/components/orbit/`.

---

## 2. File map (2,411 lines + my additions)

| File | Lines | Role |
|---|---|---|
| `OrbitScene.tsx` | 1,246 | the whole scene, both views, all chrome |
| `Ring.tsx` | 378 | `PlanetRings, AsteroidBelt, Starfield, WarpLines, PortalRing, AtmosphericScattering` |
| `PlanetUtils.tsx` | 271 | data → planet maths, pure |
| `Planet.tsx` | 164 | `Sun, OrbitPath, TexturedPlanet, AsteroidBelt, Starfield, WarpLines, PortalRing`, procedural canvas textures |
| `OrbitControls.tsx` | 91 | `FPSCounter, FPSLineGraph` |
| `GalaxyDust.tsx` | 50 | `GalaxyDustCloud, WebsiteGalaxyDustCloud` |
| `Moon.tsx` | 25 | `Moon, OrbitTrail` |
| `OrbitalDisc.tsx` | 300 | **new** — instanced rings, the RESULT.md redesign |
| `dataIntegrity.ts` | 300 | **new** — pure reconciliation, not rendered |

---

## 3. The findings — the actual subject of this brief

### F1 — BOTH galaxies' dust clouds render at once, and they are 3,250 units apart

`OrbitScene.tsx:508-525`:
```tsx
      {/* Apps Galaxy (Blue/Purple theme) */}
      <group ref={appsGroupRef} position={APPS_GALAXY_POS}>
        <GalaxyDustCloud perfMode={perfMode} />
        {appSolarSystems.map((system, idx) => { ... renderSolarSystem(...) })}
      </group>

      {/* Websites Galaxy (Cyan/Violet theme - Electric Nebula) */}
      <group ref={websitesGroupRef} position={WEBSITES_GALAXY_POS}>
        <WebsiteGalaxyDustCloud perfMode={perfMode} />
        {websiteSolarSystems.map((system, idx) => { ... renderSolarSystem(...) })}
      </group>
```

Both groups are unconditional. The camera sits at one of them at a time — the user's
`galaxyType` state is `'apps' | 'websites'` and the camera flies 3,250 units to switch
(`OrbitSystem.tsx:110`: `const targetX = type === 'websites' ? 3250 : 0;`).

So at `balanced` the scene pays for **2,500 + 2,000 = 4,500** additive-blended, depth-write-off
particles, and at most ~2,500 are ever on screen. **Roughly half the dust cost is for
something the user cannot see.**

Both `renderSolarSystem(...)` bodies are also unconditional, so **every planet of both
galaxies** is built and submitted every frame.

### F2 — `GalaxyDust.tsx`'s memoised buffers depend on a value they don't declare

`GalaxyDust.tsx:8-13`:
```tsx
  const particleCount = perfMode === 'performance' ? 1000 : perfMode === 'balanced' ? 2500 : 6000;
  const maxRadius = 280;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    ...
    return pos;
  }, []);          // ← reads `particleCount`, declares nothing
```
Same for `colors`. The dependency array is `[]`, so the buffers are built once from whatever
`particleCount` was on first mount and never rebuilt.

**This is currently masked** by `OrbitScene.tsx:1045`:
```tsx
                key={`canvas-${textureRefreshKey}-${perfMode}`}
```
The `<Canvas>` is keyed on `perfMode`, so changing tier **tears down and rebuilds the entire
scene**. The memo bug cannot bite — at the cost of a full remount (see F3).

### F3 — a quality-tier change is a full scene teardown, not a re-tune

The `key` above means selecting a different quality tier unmounts every mesh, material,
geometry and texture in the scene and rebuilds from scratch. For the classic solar-system
view that includes re-running the procedural canvas texture generators
(`acquirePlanetTextures` → texture + normalMap + glowTexture per planet).

The intent of `perfMode` is a cheap re-tune. The implementation is a reboot. Both the cost
and the hitch are avoidable.

### F4 — `perfMode` gates almost nothing

Every use of `perfMode` in `OrbitScene.tsx`:
```
321:  perfMode = 'balanced',                                  ← default value
332:  perfMode?: string,                                      ← prop type
511:  <GalaxyDustCloud perfMode={perfMode} />                 ← passed through
521:  <WebsiteGalaxyDustCloud perfMode={perfMode} />          ← passed through
781:  perfMode: 'high' | 'balanced' | 'performance'; setPerfMode  ← state type
833:  destructure
988:  active-pill styling
1045: key={`canvas-${textureRefreshKey}-${perfMode}`}         ← remount (F3)
1050: antialias: perfMode === 'high',                         ← GATES
1056: dpr={Math.min(devicePixelRatio, perfMode === 'performance' ? 1 : 1.5)}  ← GATES
1061-62: onDecline → step the tier down                        ← GATES
```
Plus `OrbitScene.tsx:1019`: `<EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>`.

So a tier change affects **`antialias`, `dpr`, `multisampling`, and two particle counts**.
It does **not** affect: the number of planets, the per-planet texture generation, the
asteroid belts, the starfields, the bloom parameters, the moon count, or whether the
invisible galaxy is drawn (F1).

### F5 — two asteroid belts are hardcoded on, at 700 points

`OrbitScene.tsx:264-265`:
```tsx
      {showBelt && <AsteroidBelt radius={45} count={400} isPaused={isPaused} camera={camera} />}
      {showBelt && <AsteroidBelt radius={75} count={300} isPaused={isPaused} camera={camera} />}
```
and the only call site hardcodes it on — `OrbitScene.tsx:1132`: `showBelt={true}`.

700 additive points, on every tier, in a scene whose disc radius is ~116 world units while
the belts sit at radius 45 and 75. They are inside the data.

### F6 — a background starfield of 5,000 points at radius 5,000

`OrbitScene.tsx` galaxy branch:
```tsx
<Stars radius={5000} depth={250} count={5000} factor={7} fade speed={0.08} saturation={0.6} />
```
5,000 more points, always on, never tier-gated. Together with F1 and F5 the scene carries
**~10,200 point primitives at `balanced`**, of which the dust alone is ~4,500.

### F7 — 16 `useFrame` subscriptions, several doing almost nothing

`useFrame(` call counts: `Ring.tsx` 4, `OrbitScene.tsx` 3, `GalaxyDust.tsx` 2,
`Planet.tsx` 2, `Moon.tsx` 1, `OrbitControls.tsx` 1, `OrbitalDisc.tsx` 1.

Two of them (`GalaxyDust.tsx`, one per cloud) exist purely to bob the cloud:
```tsx
  useFrame((state) => { if (pointsRef.current) { const t = state.clock.elapsedTime; pointsRef.current.position.y = Math.sin(t * 0.1) * 0.3; } });
```
That writes a matrix on every frame, forever, for a ±0.3-unit drift — and it runs for the
invisible galaxy too (F1). It also defeats frustum culling's early-out, because a moving
object is always potentially visible.

### F8 — the classic scene is one mesh + three canvas textures per planet

`Planet.tsx:130` — `acquirePlanetTextures(color, category, seed)` returns
`{ texture, normalMap, glowTexture }`, all `CanvasTexture` generated at runtime, ref-counted by
`acquirePlanetTextures` / `releasePlanetTextures` / `disposeAllPlanetTextures`.

`PlanetUtils.tsx:195` caps the count:
```tsx
    .filter(([, a]) => a.reduce((s, l) => s + logSeconds(l), 0) >= MIN_PLANET_TIME_SECONDS)
    .slice(0, MAX_RENDERED_PLANETS)
```
with `MAX_RENDERED_PLANETS = 80` (`PlanetUtils.tsx:41`) and `MIN_PLANET_TIME_SECONDS = 30`
(`:42`).

Worst case: 80 planets × (1 mesh + 3 textures + up to 3 moons each) plus 700 belt points plus
5,000 stars. **There is no instancing in this path** — `OrbitalDisc.tsx` (the new disc) does
use one `InstancedMesh` per ring with a shared `IcosahedronGeometry`, which is the pattern to
generalise.

**WebGL context note:** a leak in texture disposal kills the whole app window, not just this
view. `disposeAllPlanetTextures` exists and must keep being called.

### F9 — the postprocessing chain is always on

`OrbitScene.tsx:1019-1036`:
```tsx
<EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>
```
containing `Bloom`, `ToneMapping`, `Vignette`. A full-screen pass costs more than most of the
geometry in the scene, and it is not dropped on the `performance` tier.

### F10 — there is no instrumentation to optimise against

`OrbitControls.tsx` exports `FPSCounter` and `FPSLineGraph`, and `PerformanceMonitor` is
imported (`OrbitScene.tsx:18`) with an `onDecline` that steps the tier down
(`:1061-1062`). But there is **no draw-call count, no triangle count, no texture-memory
figure, and no per-subsystem breakdown** — so "is this scene slow, and which part" currently
cannot be answered from inside the app.

---

## 4. Hard constraints

1. **Do not delete files.** RESULT.md proposed deleting `Planet.tsx`, `Ring.tsx`,
   `GalaxyDust.tsx` and `Moon.tsx`; that was **refused** and the disc ships *beside* the
   classic view with a toggle (`localStorage['deskflow-orbit-disc']`). Keep all three view
   modes working. Any removal needs explicit user sign-off.
2. **Do not change the database.** No trigger, schema or migration edits. `stats_daily` /
   `stats_hourly` are read-only inputs here.
3. **Keep three honest tiers** (`high | balanced | performance`), persisted in
   `localStorage['deskflow-graphics-quality']`, and keep the automatic `onDecline` step-down.
4. **No new 3D dependency** without an explicit justification section.
5. **Must work under Wayland/X11** — the box is native Wayland; Electron forces X11. Do not
   propose a transparent always-on-top window without addressing that.
6. **Texture disposal must stay correct.** A WebGL leak here takes down the whole app window.
7. **Visual output must not degrade silently.** If a tier drops detail, the UI must say so.

---

## 5. Data flow (unchanged by this work — context only)

```
stats_daily / stats_hourly  ──(UTC-bucketed)──▶  get-dashboard-aggregates
   (src/main.ts:24970)                            (src/preload.ts:212)
        │
        ▼  src/pages/dashboard/aggregateNormalizer.ts
   appStats / websiteStats
        │
        ▼  src/pages/DashboardPage.tsx:2545-2576   orbitLogs / orbitWebsiteLogs
        ▼  src/components/orbit/PlanetUtils.tsx     computeSolarSystems → PlanetData[]
        ▼  OrbitScene.tsx → SolarSystemScene / GalaxyView / StratifiedOrbitalDisc
```

`PlanetData` (`PlanetUtils.tsx:96`):
```tsx
export interface PlanetData {
  name: string; category: string; color: string;
  radius: number; orbitRadius: number;
  angularSpeed: number; orbitalPeriod: number;
  eccentricity: number; inclination: number; longitudeOfPerihelion: number;
  rotationSpeed: number;
  moons: PlanetMoon[]; rings: PlanetRing[];
  time: number; sessions: number; speed: number;
}
```

---

## 6. Known-bad items you may fix as part of this work

- `GalaxyDust.tsx` `useMemo(..., [])` reads `particleCount` (F2). Currently masked by F3; if
  you fix F3 you must fix F2 in the same change or the particle counts will silently freeze.
- `OrbitScene.tsx:197-227` — `SolarSystemScene`'s new `discMode` branch; `Html`-based toggle
  buttons sit at world-space `[±70, 0, 0]` with `distanceFactor={180}`.
- The dead second config set in `OrbitSystem.tsx:15-42` (`VIVID_PALETTE`,
  `CATEGORY_COLOR_FAMILIES`, `ORBIT_CONFIG`, `MAX_RENDERED_PLANETS`,
  `MIN_PLANET_TIME_SECONDS`) — 10 `noUnusedLocals` errors, and its `ORBIT_CONFIG.baseAngularSpeed`
  is `2.0` against `0.001` in the live `PlanetUtils.tsx:83`. Duplicated constants are how a
  2000× discrepancy survives review.
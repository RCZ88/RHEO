# CONTEXT_BUNDLE — Solar System Visualization (Dashboard "App Ecosystem")

> **You do not have this codebase. This file IS the codebase, for this feature.**
> Everything below is verbatim from the repo at commit-time. Do not ask for files; do not
> assume a file you were not given. If something you need is not here, say so explicitly
> and state the assumption you are proceeding under.

---

## 0. TL;DR — what this feature actually is

A **WebGL 3D "solar system" data visualization** on the Dashboard. Apps become planets,
categories become separate solar systems (a galaxy view holds several side by side; you
"enter" one to zoom into that category's system). Planet size encodes time spent, orbit
radius encodes rank, colour encodes category family.

It is built on **react-three-fiber + drei + @react-three/postprocessing** (NOT raw three.js,
NOT a particle-only hack — there are real meshes, rings, moons, asteroid belts, a starfield
and a postprocessing chain).

---

## 1. How the user reaches it

`src/pages/DashboardPage.tsx`

- **:1152** — modal state
  ```tsx
  const [expandedModal, setExpandedModalRaw] = useState<'heatmap' | 'solar' | null>(null);
  ```
- **:2774** — the only entry point (a widget/button in the dashboard grid)
  ```tsx
  onClick={() => setExpandedModal('solar')}
  ```
- **:3377–3411** — the modal + the real mount
  ```tsx
  {expandedModal === 'solar' && (
    ...
    <ErrorBoundary>
      <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingState variant="spinner" /></div>}>
        <div className={solarFullscreen ? 'w-full h-screen' : 'h-[500px] w-full'}>
          <OrbitSystem logs={orbitLogs} websiteLogs={orbitWebsiteLogs} appColors={appColors} categoryOverrides={categoryOverrides} selectedPeriod={selectedPeriod}
            onPeriodChange={(p) => { onSelectedPeriodChange?.(p as any); onDateOffsetChange?.(0); }} />
        </div>
      </Suspense>
    </ErrorBoundary>
  ```
  Note the container heights: **500 px** normally, `h-screen` in fullscreen. Fullscreen is
  toggled at **:3396-3400**.

### 1a. The dashboard-grid widget slot is a NULL STUB

`src/components/dashboard/registerWidgets.ts:206-217`
```tsx
WidgetRegistry.register({
  id: 'app-ecosystem',
  name: 'App Ecosystem',
  description: 'Compact orbit visualization of app usage',
  icon: 'Orbit',
  category: 'insights',
  defaultSize: { cols: 2, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 2, rows: 1 },
  component: () => null, // OrbitSystem is preserved untouched
  defaultVisible: false,
  sourcePage: 'dashboard',
});
```
`component: () => null` means the **widget in the dashboard grid renders nothing at all**.
The only live surface is the modal above. There is no compact/inline version today.

### 1b. A second, dead copy of the wrapper exists

`src/App.tsx:121-147` defines `OrbitSystemWrapper` (memo + Suspense + a
`key={logsCount-firstApp}` remount hack). **Nothing renders it** — the only other
reference in the whole repo is a docs array (`src/data/feature-specs.ts:121`). Treat
`src/components/OrbitSystem.tsx` + the DashboardPage mount as the single source of truth.

---

## 2. The data pipeline (this is the part most likely to be wrong)

### 2a. Solar system data does NOT come from the `logs` table

This is the single most important fact in this bundle.

```
stats_daily  ──(SQL, UTC-dated)──▶  get-dashboard-aggregates  ──▶  buildDashboardData()
                                                                      │
                                       src/pages/dashboard/aggregateNormalizer.ts
                                                                      │  appStats / websiteStats
                                                                      ▼
                        DashboardPage:2545-2576  orbitLogs / orbitWebsiteLogs
                                                                      │
                                                                      ▼
                        PlanetUtils.computeSolarSystems()  ──▶  OrbitScene
```

`src/pages/DashboardPage.tsx:2545-2576` — the adapter, verbatim:
```tsx
  // Transform dashboardData.appStats/websiteStats → ActivityLog[] for OrbitSystem
  //
  // NORMALIZER CONTRACT: `appStats` rows are `{ app, category, seconds }` and
  // `websiteStats` rows are `{ domain, seconds }` (aggregateNormalizer.ts:75).
  // These adapters used to read `s.totalSeconds` — a field that only exists on
  // `overview`. On appStats/websiteStats it is `undefined`, so `|| 0` silently
  // gave EVERY app a duration of 0; computePlanets then dropped every planet
  // below MIN_PLANET_TIME_SECONDS and the solar system rendered with zero
  // systems. A missing field on an aggregate is indistinguishable from "no time
  // spent", so the whole view was empty rather than erroring.
  const orbitSeconds = (s: any): number => {
    const candidates = [s?.seconds, s?.totalSeconds, s?.duration];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) return Math.round(c);
    }
    const ms = [s?.total_ms, s?.duration_ms].find(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
    return ms ? Math.round(ms / 1000) : 0;
  };

  const orbitLogs = useMemo(() => {
    if (!dashboardData?.appStats) return [];
    return dashboardData.appStats.map((s: any, i: number) => ({
      id: i,
      timestamp: new Date(),
      app: s.app || s.app_name || '',
      category: s.category || 'Other',
      duration: orbitSeconds(s),
    })).filter((l: any) => l.app);
  }, [dashboardData?.appStats]);
```

### 2b. The aggregates are bucketed by UTC day; the heatmap is bucketed by local day

`stats_daily` / `stats_hourly` are filled by an `AFTER INSERT` trigger on `logs` that uses
`DATE(NEW.timestamp)`. `timestamp` is stored as UTC ISO (`...Z`), so on a UTC+7 machine
everything between 00:00 and 07:00 local is stamped with **yesterday's** date.
`aggregateNormalizer.ts:86-90` passes that string straight through:

```tsx
const dayOf = (d: unknown) => {
  if (typeof d !== 'string' || !d) return '';
  const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
};
```

By contrast the Dashboard's Productivity Heatmap reads the raw `logs` rows and buckets with
`new Date(ts).getDay()` / `.getHours()` — i.e. **local** time. Measured on the live DB
(2026-10-06, WIB): `stats_daily` for `2026-10-04` = 447.7 min while the `logs` rows for
local Oct 4 = 473.2 min. **A ~25 min/day skew, and the day label can be off by one.**
So the solar system and the heatmap are two surfaces reading two different tables with two
different clocks. This is a known, unfixed defect — see §7.

### 2c. `PlanetData` — the shape every planet obeys

`src/components/orbit/PlanetUtils.tsx:87-96`
```tsx
export interface PlanetMoon { name: string; radius: number; orbitRadius: number; speed: number; color: string; }
export interface PlanetRing { innerRadius: number; outerRadius: number; opacity: number; color: string; tilt: number; }

export interface PlanetData {
  name: string; category: string; color: string;
  radius: number; orbitRadius: number;
  angularSpeed: number; orbitalPeriod: number;
  eccentricity: number; inclination: number; longitudeOfPerihelion: number;
  rotationSpeed: number;
  moons: PlanetMoon[]; rings: PlanetRing[];
  time: number; sessions: number; speed: number;   // `speed` is a legacy alias of angularSpeed
}
```

And the system shape, `PlanetUtils.tsx:222`:
```tsx
export function computeSolarSystems(logs, appColors?, categoryOverrides?): { category: string; planets: PlanetData[]; totalTime: number; sunSize: number }[]
```

### 2d. `computePlanets` — the encoding, verbatim (`PlanetUtils.tsx:184-220`)

```tsx
export function computePlanets(logs: ActivityLog[], appColors?: Record<string, string>, categoryOverrides?: Record<string, string>): PlanetData[] {
  const validLogs = (logs || []).filter((log: any) => log && log.app && typeof log.app === 'string' && log.app.trim().length > 0 && !log.is_browser_tracking);
  if (validLogs.length === 0) return [{ name: 'VS Code', category: 'IDE', color: '#FCD34D', time: 120, sessions: 5, radius: 0.8, orbitRadius: 12, /* …demo planet… */ }];
  const grouped: Record<string, any[]> = {};
  for (const log of validLogs) { const appName = log.app.trim(); if (!grouped[appName]) grouped[appName] = []; grouped[appName].push(log); }
  const maxTime = Math.max(...Object.values(grouped).map(l => l.reduce((s, x) => s + logSeconds(x), 0)), 1);
  const catCount: Record<string, number> = {};
  return Object.entries(grouped)
    .sort(([, a], [, b]) => b.reduce((s, l) => s + logSeconds(l), 0) - a.reduce((s, l) => s + logSeconds(l), 0))
    .filter(([, a]) => a.reduce((s, l) => s + logSeconds(l), 0) >= MIN_PLANET_TIME_SECONDS)
    .slice(0, MAX_RENDERED_PLANETS)
    .map(([appName, appLogs], idx) => {
      const category = categoryOverrides?.[appName.toLowerCase()] || appLogs.find((l) => l?.category)?.category || 'Other';
      const idxInCat = (catCount[category] = (catCount[category] || 0) + 1);
      const color = getCategoryColorLocal(category, idxInCat - 1);
      const appTime = appLogs.reduce((s, l) => s + logSeconds(l), 0);
      const radius = Math.max(0.3, Math.min(1.5, 0.5 + (appTime / maxTime) * 0.5));
      const orbitRadius = calculateOrbitRadiusLocal(idx, Object.keys(grouped).length);
      const eccentricity = computeEccentricityLocal(idx, Object.keys(grouped).length);
      const inclination = computeInclinationLocal(appName) * (Math.PI / 180);
      const longitudeOfPerihelion = seededRandom(idx * 31.7 + 7.1) * Math.PI * 2;
      const projects = [...new Set(appLogs.map((l) => l.project).filter((p) => p && typeof p === 'string'))];
      const moons = projects.slice(0, 3).map((proj, mIdx) => ({ name: proj, radius: 0.25, orbitRadius: 1.5 + mIdx * 0.3, speed: 1.2 + mIdx * 0.3, color: color + '88' }));
      const angularSpeed = calculateAngularSpeedLocal(orbitRadius);
      return { name: appName, category, color, time: appTime, sessions: appLogs.length, radius, orbitRadius, speed: angularSpeed, angularSpeed, rotationSpeed: angularSpeed * 2, orbitalPeriod: calculateOrbitalPeriodLocal(orbitRadius), eccentricity, inclination, longitudeOfPerihelion, moons, rings: [] };
    });
}
```

**Encoding summary (this is what a redesign must either keep or consciously replace):**

| Visual channel | Encodes | Range / curve |
|---|---|---|
| planet radius | time spent (linear vs the max app) | `0.5 … 1.0`, clamped to `[0.3, 1.5]` |
| orbit radius | rank by time (descending) | power curve, `spacingExponent` |
| angular speed | orbit radius (Kepler-ish `r^-1.5` + linear term) | `angularSpeed = max(min, base/r^1.5 + 0.25*(1 - r/max))` |
| planet colour | category family + index-in-category | 3-hue family per category, cycled |
| moons | up to 3 distinct `project` strings on that app | fixed 0.25 radius |
| orbit ellipse | `eccentricity` decreases with rank, `inclination` hashed from the app name | seeded, deterministic |

### 2e. Two different log-truncation behaviours

`computeSolarSystems` (`PlanetUtils.tsx:227`):
```tsx
const allPlanets = computePlanets((logs || []).length > 10000 ? (logs || []).slice(-10000) : (logs || []), appColors, categoryOverrides);
```
⚠ `slice(-10000)` keeps the **last** 10000 entries. The app's `get-logs` IPC returns rows
`ORDER BY id DESC` (**newest first**), so on a large database this keeps the **oldest**
10000 rows and discards all recent activity. The Dashboard modal is accidentally safe
(its `orbitLogs` are pre-aggregated to ~1 row per app), but any caller that passes raw
newest-first logs silently renders a stale solar system. Do not rely on this.

### 2f. Duplicated, contradictory config constants (dead code with a live smell)

`src/components/OrbitSystem.tsx:15-42` declares a **second** copy of everything, none of
which is read. Scoped `tsc` reports these as errors today:

```
src/components/OrbitSystem.tsx(8,52):  'computePlanets' is declared but its value is never read.
src/components/OrbitSystem.tsx(8,68):  'computeWebsitePlanets' …never read.
src/components/OrbitSystem.tsx(9,23):  'formatDurationSeconds' …never read.
src/components/OrbitSystem.tsx(9,46):  'getCategoryListFromSettings' …never read.
src/components/OrbitSystem.tsx(11,27): Import declaration conflicts with local declaration of 'ActivityLog'.
src/components/OrbitSystem.tsx(15,7):  'VIVID_PALETTE' …never read.
src/components/OrbitSystem.tsx(16,7):  'CATEGORY_COLOR_FAMILIES' …never read.
src/components/OrbitSystem.tsx(23,7):  'ORBIT_CONFIG' …never read.
src/components/OrbitSystem.tsx(41,7):  'MAX_RENDERED_PLANETS' …never read.
src/components/OrbitSystem.tsx(42,7):  'MIN_PLANET_TIME_SECONDS' …never read.
src/components/OrbitSystem.tsx(56,21): 'setIsVisible' …never read.
```
The two `ORBIT_CONFIG`s disagree by three orders of magnitude on speed:
- `OrbitSystem.tsx:23` → `{ minOrbitRadius: 10, maxOrbitRadius: 110, spacingExponent: 0.8, baseAngularSpeed: 2.0, minAngularSpeed: 0.08 }`
- `PlanetUtils.tsx:83` → `{ innerRadius: 5, outerRadius: 250, minOrbitRadius: 15, maxOrbitRadius: 200, baseOrbitSpeed: 0.001, speedMultiplier: 0.5 }`

**A redesign must have exactly one source of truth for these numbers.**

---

## 3. Rendering stack (all verified present in the repo)

`package.json`: `three ^0.183.2`, plus `@react-three/fiber`, `@react-three/drei`,
`@react-three/postprocessing`, `postprocessing`.

```tsx
// src/components/orbit/OrbitScene.tsx:17-20
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls, Stars, Html, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
```

Postprocessing chain, `OrbitScene.tsx:1019-1036`:
```tsx
<EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>
  {/* EffectComposer types `children` as `JSX.Element | JSX.Element[]`, … */}
</EffectComposer>
```

### 3a. Primitive census across `src/components/orbit/*.tsx`

| JSX primitive | count | Material | count |
|---|---|---|---|
| `<mesh` | 13 | `AdditiveBlending` | 10 |
| `<points` | 10 | `PointsMaterial` | 3 |
| `<group>` | 11 | `MeshBasicMaterial` | 2 |
| `<line>` | 2 | `MeshStandardMaterial` | 1 |
| `<pointLight>` | 2 | | |
| `<sprite>` | 1 | | |
| `<ambientLight>` / `<directionalLight>` / `<hemisphereLight>` | 1 each | | |
| `<fog>` | 1 | | |

So: **10 point clouds and 10 additive-blended layers** — this is where the "everything is
particles" impression comes from — but there are also 13 meshes, rings, moons and an
asteroid belt. There is **no** instancing (`InstancedMesh`) and **no** custom
`ShaderMaterial` anywhere in the folder. Every planet is its own `<mesh>` with its own
material, and every starfield is a separate `<points>` cloud.

### 3b. File map (`src/components/orbit/`, 2 411 lines total)

| File | Lines | Exports |
|---|---|---|
| `OrbitScene.tsx` | 1188 | `OrbitScene, OrbitSystem, GalaxyView, CategorySidebar, CategoryDropdown, PlanetLegend, PlanetDetailPanel, CameraTracker, PlanetTracker, SolarSystemScene, SystemTrail` |
| `Ring.tsx` | 378 | `PlanetRings, AsteroidBelt, Starfield, WarpLines, PortalRing, AtmosphericScattering` |
| `PlanetUtils.tsx` | 271 | data→planet maths (see §2) |
| `Planet.tsx` | 164 | `Sun, OrbitPath, TexturedPlanet, AsteroidBelt, Starfield, WarpLines, PortalRing, AtmosphericScattering`, `makeGlowTexture`, `acquirePlanetTextures`, `releasePlanetTextures`, `disposeAllPlanetTextures` |
| `OrbitControls.tsx` | 91 | `FPSCounter, FPSLineGraph` |
| `GalaxyDust.tsx` | 50 | `GalaxyDustCloud, WebsiteGalaxyDustCloud` |
| `Moon.tsx` | 25 | `Moon, OrbitTrail` |
| `index.ts` | 8 | the barrel |

### 3c. ⚠ THE BARREL SHADOWS THE GOOD COPY — duplicate component names

`AsteroidBelt`, `Starfield`, `WarpLines`, `PortalRing` **and** `AtmosphericScattering` each
exist in **both** `Planet.tsx` and `Ring.tsx`. `index.ts` re-exports them from **`./Ring`**:

```ts
export { PlanetRings, AsteroidBelt, Starfield, WarpLines, PortalRing, AtmosphericScattering } from './Ring';
```

And `Planet.tsx:102` is a literal stub:
```tsx
export function AtmosphericScattering({ color }: { color: string }) { return null; }
```

So `grep "export function AtmosphericScattering"` reports success in **both** files while
one of them renders nothing. **A redesign must first decide which file owns each name, then
delete the loser.** Editing only `Planet.tsx` will change nothing on screen.

`index.ts` also exports `OrbitSystem` from `./OrbitScene` — a **second** `OrbitSystem`
symbol, distinct from the `src/components/OrbitSystem.tsx` default export that is actually
imported. Be careful which one you are editing.

---

## 4. State, controls and interaction (all in `src/components/OrbitSystem.tsx`)

| Line | State | Notes |
|---|---|---|
| 48 | `isPaused` | |
| 49 | `speed` | options `[0.25, 0.5, 1, 2, 4]` (passed at :210) |
| 50 | `selectedPlanet` | |
| 51 | `textureRefreshKey` | forces planet texture regeneration |
| 52 | `viewMode` | `'galaxy' \| 'solarSystem'` |
| 53 | `galaxyType` | `'apps' \| 'websites'` |
| 54-55 | `perfMode` | `'high' \| 'balanced' \| 'performance'`, persisted in `localStorage['deskflow-graphics-quality']`, default `'balanced'` |
| 60 | `currentCategory` | which solar system is open; default `'Other'` |
| 61-62 | `selectedPeriod` / `activePeriod` | `activePeriod = externalPeriod \|\| selectedPeriod` |
| 64 | `legendExpanded` | |
| 65-66 | `showPerf`, `showInfo` | FPS overlay + info overlay |
| 67 | `minTimeFilter` | seconds |
| 68 | `searchQuery` | |
| 69 | `animationSpeed` | `'slow' \| 'normal' \| 'instant'` from `localStorage['deskflow-animation-speed']` |
| — | `viewMode` default | **`'galaxy'`** — the user lands on the galaxy, never directly in a system |

### 4a. Camera choreography

- Default camera `[0, 100, 200]` (**:57**).
- The two galaxies sit **3 250 world units apart**: apps at `x = 0`, websites at `x = 3250`
  (**:110**, **:157**). Switching galaxy type flies the camera 3 250 units sideways.
- `animateCamera` (**:176-185**) hand-rolls a **three-phase Bezier** easing:
  ```tsx
  const threePhaseBezier = (t: number): number => {
    if (t < 0.15) return 0.08 * t * t * t;
    else if (t < 0.7) return 0.08 + 0.84 * (t - 0.15) / 0.55;
    else return (0.92 + 0.08 * (1 - Math.pow(1 - (t - 0.7) / 0.3, 3))) * (1.02 + 0.03 * Math.sin(((t - 0.7) / 0.3) * Math.PI * 2));
  };
  ```
  Durations: `{ slow: 2500, normal: 1200, instant: 0 }` ms (**:14**).
- Click-to-focus: `camOffset = Math.max(radius * 6, 12)` (**:131**, **:141**, **:171**).
- Entering a system: `animateCamera(new THREE.Vector3(0, 30, 60), new THREE.Vector3(0,0,0), …)` then a `portalKey` bump triggers `PortalRing` (**:150**).

### 4b. Click handling is a 300 ms long-press

**:124-144** — a click is distinguished from a drag by a 300 ms timer plus elapsed-time
comparison; the long-press path also sets `trackedPlanetRef` and flies the camera. Any
redesign must preserve "drag to orbit, click to focus" without stealing drags.

### 4c. WebGL guard

**OrbitSystem.tsx:193-205** returns an explanatory panel when `webglSupported()` is false
(`src/lib/webgl`). The comment notes the verdict is cached per page session, so it cannot
change without an app restart, and the copy tells the user to relaunch with `DESKFLOW_GPU=1`.
**Any new fallback/empty state must match this register — explain, don't dead-end.**

---

## 5. Design constraints (non-negotiable, from `design/design.md` "LAMINAR")

1. **Monochrome zinc surfaces.** One signal hue per surface. No decorative gradients or glow
   on chrome.
2. **Radii: 8 / 12 / pill only.**
3. **Type: Inter + JetBrains Mono + Space Grotesk — max 2 families per view.**
4. **No glassmorphism on chrome.** No spring/bounce. Eased transitions only.
5. **`prefers-reduced-motion` must be honoured** (the codebase already reads it, e.g.
   `useReducedMotion()` in the heatmap).
6. **Colour must mean TIER, never identity** where the surface is a data surface — the same
   principle the dashboard heatmap uses (one hue, opacity = magnitude).
7. **Light mode must work.** The app is not dark-only; DashboardPage mixes
   `light:bg-stone-100`, `light:text-[var(--text-muted)]`, `light:hover:border-[var(--ws-border)]`
   and a `.light` class. A pure-black-space 3D scene is a real design problem here.
8. **GPU:** this box runs native **Wayland** (KDE Plasma). Electron overlays must force X11
   (`ELECTRON_OZONE_PLATFORM_HINT=x11`); `transparent: true` is unsafe. The app already
   launches with `--ozone-platform=x11`.

---

## 6. Performance budget (hard constraint)

- Target: **60 fps at 1920×1080 on integrated graphics**; degrade, never stutter.
- `perfMode` (`high | balanced | performance`) already gates `multisampling`
  (`:1019`) and is user-selectable + persisted. A redesign must keep three honest tiers and
  must not make `high` mandatory for the feature to look correct.
- `PerformanceMonitor` from drei is already imported (`OrbitScene.tsx:18`) — use it.
- There is an FPS overlay already (`FPSCounter`, `FPSLineGraph` in `OrbitControls.tsx`).
- Current worst case: 80 planets (`MAX_RENDERED_PLANETS`, enforced in `PlanetUtils.tsx:195`),
  each its own `<mesh>` + material + 3 canvas textures
  (`acquirePlanetTextures` → texture / normalMap / glowTexture), each with up to 3 moons and
  a procedural glow sprite. **No instancing.** Texture acquisition is ref-counted
  (`acquire`/`release`/`disposeAllPlanetTextures`) so a redesign must preserve that or
  introduce a real disposal path — a WebGL context leak here kills the whole app window.

---

## 7. Known-broken, must be addressed or explicitly preserved

| # | Defect | Evidence |
|---|---|---|
| 1 | Solar system reads **UTC-bucketed** `stats_daily`; the heatmap reads **local-bucketed** `logs`. ~25 min/day skew, day labels can be off by one. | §2b |
| 2 | Dashboard-grid widget is `component: () => null` — no compact surface exists. | §1a |
| 3 | Duplicate component names across `Planet.tsx` / `Ring.tsx`; the barrel picks `Ring`, and `Planet.tsx`'s `AtmosphericScattering` is `return null`. | §3c |
| 4 | Dead second config set in `OrbitSystem.tsx:15-42` with a `baseAngularSpeed` 2000× off. | §2f |
| 5 | `slice(-10000)` on newest-first logs keeps the OLDEST rows. | §2e |
| 6 | `OrbitSystemWrapper` (`src/App.tsx:121`) is never mounted. | §1b |
| 7 | `filterLogsByPeriod('today')` compares `toISOString().split('T')[0]` — a UTC day string — so "today" is wrong for most of the day outside UTC. (`PlanetUtils.tsx:160`) | §2 |
| 8 | Every planet is a separate mesh + 3 procedural canvas textures; no instancing. | §6 |

---

## 8. Backend audit (Rule 5 — do not design against a stub)

| Feature | IPC channel | Handler | Service | DB | Status |
|---|---|---|---|---|---|
| Aggregate rows feeding the solar system | `get-dashboard-aggregates` (`src/preload.ts:212`) | `src/main.ts:24970` | none (inline SQL) | `stats_daily`, `stats_hourly` | ✅ real |
| Per-app time for planets | same call → `buildDashboardData().appStats` | — | `src/pages/dashboard/aggregateNormalizer.ts` | — | ✅ real |
| Raw per-session logs (alternate path) | `get-logs` (`src/preload.ts`) | `src/main.ts:6623` → `getLogs()` at `:4881` | none | `logs` | ✅ real |
| Tier assignments (colour families) | none | — | — | `localStorage['deskflow-tier-assignments']` | ✅ real (renderer-only) |
| User app colours | `categoryOverrides` prop | — | — | passed from App/Settings | ✅ real |
| Planet textures | none | — | — | generated on a `<canvas>` at runtime | ✅ real |

**There is no stub in this pipeline.** Any new capability the design needs (e.g. per-hour
data for a time-of-day ring, session counts per planet, category-level rollups) must be
flagged as a **backend gap** and specified separately — do not fake it in the renderer from
data that isn't already in `appStats`.

---

## 9. What the user actually asked for (verbatim, do not re-interpret)

> "instead of jut like using particals to repsent a whole solar sytem and stuf, i think we can do better then that idk? how cna we improve the solar system"

> "gneerate a prompt that can aks an ia to think and researhch abotu that"

Two prior complaints that frame the bar:
> "the things that is unsync is like hte isdbear with the dahsbaord also like the heatmap with teh actual data, and like other stuff lie the visualizaiton of the solar system shit"

So the bar is: **it must be beautiful AND it must not lie about the data.**
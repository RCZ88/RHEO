# RESULT.md

## 1. Root-Cause Summary

**Bug 1 (Websites solar system blank):** Confirmed. `SolarSystemScene` (lines 2408–2441) renders the sun and planets at scene origin `(0,0,0)`, but `handleEnterSystem` (lines 3573–3588) and `handleCategorySelect` (lines 3619–3632) animate the camera to `targetX = 3250` for websites. Camera looks at empty space. `focusOnPlanet` (lines 3661–3697) works only because it does NOT apply the offset — proving the scene is at origin.

**Bug 2 (Galaxy labels huge/overlapping):** Confirmed. `<Html distanceFactor={30}>` (line 3043) scales the label by `cameraDistance / distanceFactor`. At the galaxy camera distance (~224 units), this yields scale = 224/30 ≈ **7.5×**, inflating 15px text to ~112px chips that overlap neighboring systems. The `sphereSize * 3` anchor offset at 7.5× scale visually detaches the chip from the sphere.

**Bug 3 (Blurry labels + period switch empty):** Confirmed. (a) `TexturedPlanet` uses `cameraDist` React state updated every frame via `useEffect` (lines 1656–1663), triggering 60 re-renders/sec. Combined with `backdrop-filter: blur(8px)` and fractional `transform: scale(...)` (line 1793), Chromium rasterizes text at fractional scales → visible blur. (b) Period switches recompute `solarSystems`; if `currentCategory` (persisted in localStorage) no longer exists, `planets = []` (line 3474) and only the sun renders.

**Bug 4 (Dark planets):** Confirmed. Lighting is severely dim: ambient 0.03, hemisphere 0.08, point light `decay=1.5` yields only ~1.39 intensity at outer orbits (r=220). Planet emissive pulse base is only 0.15–0.35 (lines 1649–1654). `ACES_FILMIC` tone mapping compresses midtones. Procedural textures use dark base `#1e1e40` (line 1213).

**Bug 5 (Graphics quality option):** Confirmed. `perfMode` state exists (line 3327) and gates dpr/bloom/particles, but has no UI and no persistence. The "Perf" button (lines 3872–3881) only opens an FPS panel.

---

## 2. Fixes

### Fix 1 — Websites solar system renders at origin (camera targets origin)

**Strategy:** The solar system scene is correctly rendered at `(0,0,0)`. The bug is that camera entry animations incorrectly target `x=3250` for websites. Since `focusOnPlanet` already works by targeting origin, we make ALL entry points consistent: solar system camera always targets origin. The warp transition (`WarpLines` + `PortalRing`) already hides the flight path.

**File:** `src/components/OrbitSystem.tsx`

**Change 1a:** `handleEnterSystem` (lines 3573–3588) — remove offset for solar system entry:
```tsx
const handleEnterSystem = () => {
  if (selectedSystem && controlsRef.current) {
    setCurrentCategory(selectedSystem.category);
    setStoredCategory(selectedSystem.category, galaxyType);
    setSelectedSystem(null);
    setLegendExpanded(true);
    // Solar system always renders at origin — camera targets origin
    // WarpLines + PortalRing mask the transition flight path
    setViewMode('solarSystem');
    const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
    const targetPos = new THREE.Vector3(0, 30, 60);
    const lookAtPos = new THREE.Vector3(0, 0, 0);
    animateCamera(targetPos, lookAtPos, duration, () => setPortalKey(k => k + 1));
  }
};
```

**Change 1b:** `handleCategorySelect` (lines 3619–3632) — same pattern:
```tsx
// Replace the line:
// const targetX = galaxyType === 'websites' ? 3250 : 0;
// animateCamera(new THREE.Vector3(targetX, 30, 60), new THREE.Vector3(targetX, 0, 0), duration, () => setPortalKey(k => k + 1));

// With:
animateCamera(new THREE.Vector3(0, 30, 60), new THREE.Vector3(0, 0, 0), duration, () => setPortalKey(k => k + 1));
```

**Rationale:** Exit animations (`handleZoomOut`, `resetCameraToGalaxy`) correctly use the galaxy offset because they return TO the galaxy. Entry animations go INTO the solar system (at origin), so they must target origin. This is consistent with `focusOnPlanet` (which already works by targeting origin) and the Canvas initial camera position `[0, 100, 180]` for solar system mode (line 4015). `OrbitControls target={[0,0,0]}` (line 2440) and `planetPositionsRef` (scene-space around origin) remain correct.

**Acceptance:** Entering a websites solar system via galaxy sphere → "Enter", category dropdown, or any other path shows the sun + planets. Never blank.

---

### Fix 2 — Galaxy category labels: constant readable size, no overlap

**Strategy:** Remove the too-small `distanceFactor={30}` and use a ref-driven `useFrame` to scale label DOM elements for constant screen size. Redesign labels to match DeskFlow glass design (dot + category name).

**File:** `src/components/OrbitSystem.tsx`

**Change 2a:** Add refs and `useFrame` in `GalaxyView` component (near the top, after other refs):
```tsx
const labelRefs = useRef<Record<string, HTMLDivElement>>({});
const systemGroups = useRef<Record<string, THREE.Group>>({});

useFrame(({ camera }) => {
  // Constant screen size for category labels: scale inversely with distance
  // Reference distance 220 = default galaxy camera distance
  Object.entries(systemGroups.current).forEach(([category, group]) => {
    const el = labelRefs.current[category];
    if (!el || !group) return;
    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);
    const dist = camera.position.distanceTo(worldPos);
    const scale = 220 / Math.max(dist, 1);
    // Clamp to prevent extreme scaling
    el.style.transform = `scale(${Math.max(0.6, Math.min(1.8, scale))})`;
  });
});
```

**Change 2b:** Replace the label render code (lines 3043–3048):
```tsx
{/* Category label — constant screen size, DeskFlow glass design */}
<group
  ref={(el) => { if (el) systemGroups.current[system.category] = el; }}
>
  <group position={[0, sphereSize * 3, 0]}>
    <Html center zIndexRange={[100, 0]}>
      <div
        ref={(el) => { if (el) labelRefs.current[system.category] = el; }}
        style={{
          pointerEvents: 'none',
          transformOrigin: 'center center',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 14px',
          borderRadius: '8px',
          background: 'rgba(24, 24, 27, 0.92)',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          fontSize: '13px',
          whiteSpace: 'nowrap',
          backdropFilter: 'none',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: SUN_CONFIGS[system.category]?.color || '#ffaa00',
            boxShadow: `0 0 8px ${SUN_CONFIGS[system.category]?.color || '#ffaa00'}88`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: '#e4e4e7',
            fontWeight: 500,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          }}
        >
          {system.category}
        </span>
      </div>
    </Html>
  </group>
</group>
```

**Rationale:** The ref-driven scaling in `useFrame` updates the DOM directly (no React re-renders) and ensures labels appear at their designed ~13px size at the default galaxy zoom (~220 units). Clamping to `[0.6, 1.8]` prevents extreme zoom-in/out artifacts. The glass design (zinc-900 background, zinc-700 border, sun-colored dot) matches DeskFlow tokens. Removing `backdrop-filter` eliminates Electron rasterization blur.

**Acceptance:** At default galaxy zoom, all chips are ~13px, readable, anchored above their spheres, and do not overlap neighbors at any zoom level.

---

### Fix 3 — Planet labels crisp + period switch empty state

**Strategy:** (a) Remove `cameraDist` React state (no per-frame re-renders). Use ref + `useFrame` for opacity updates. Remove `backdrop-filter` and inline `transform: scale`. Use `distanceFactor={30}` for constant screen size. (b) Add `useEffect` to auto-select a valid category on period switch. Add empty state overlay when `solarSystems.length === 0`.

**File:** `src/components/OrbitSystem.tsx`

**Change 3a:** Remove `cameraDist` state and per-frame `useEffect` (lines 1656–1663). Find and delete:
```tsx
// DELETE THESE LINES:
const [cameraDist, setCameraDist] = useState(30);
useEffect(() => {
  const interval = setInterval(() => {
    if (meshRef.current) {
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      const dist = camera.position.distanceTo(worldPos);
      setCameraDist(dist);
    }
  }, 16);
  return () => clearInterval(interval);
}, [camera]);
```

**Change 3b:** Add refs and `useFrame` in `TexturedPlanet` (after other refs, near line 1640):
```tsx
const labelDivRef = useRef<HTMLDivElement>(null);
const groupRef = useRef<THREE.Group>(null);

useFrame(({ camera }) => {
  if (!labelDivRef.current || !groupRef.current) return;
  const worldPos = new THREE.Vector3();
  groupRef.current.getWorldPosition(worldPos);
  const dist = camera.position.distanceTo(worldPos);
  // Fade by distance (no React re-renders)
  const opacity = isHovered ? 1 : Math.max(0, Math.min(1, 1 - (dist - 25) / 120));
  labelDivRef.current.style.opacity = String(opacity);
});
```

**Change 3c:** Replace the planet label render code (lines 1786–1816):
```tsx
{/* Planet label — crisp text, no per-frame setState, no backdrop-filter */}
<group ref={groupRef} position={[0, data.radius + 1.5, 0]}>
  <Html center distanceFactor={30} zIndexRange={[50, 0]}>
    <div
      ref={labelDivRef}
      style={{
        pointerEvents: 'none',
        transformOrigin: 'center center',
        background: 'rgba(24, 24, 27, 0.92)',
        border: `1.5px solid ${isHovered ? data.color : 'rgba(63, 63, 70, 0.4)'}`,
        borderRadius: '10px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 600,
        color: isHovered ? data.color : '#e4e4e7',
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        boxShadow: isHovered ? `0 0 12px ${data.color}33, 0 2px 6px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      {data.name}
      {isHovered && (
        <span style={{ marginLeft: '6px', opacity: 0.7, fontWeight: 400, fontSize: '11px' }}>
          {formatDurationSeconds(data.time)}
        </span>
      )}
    </div>
  </Html>
</group>
```

**Change 3d:** Add period-switch auto-select `useEffect` (after the `planets` useMemo, around line 3495):
```tsx
// Auto-select valid category on period switch — prevents empty solar system
useEffect(() => {
  if (viewMode !== 'solarSystem') return;
  if (solarSystems.length === 0) return;
  const exists = solarSystems.some(s => s.category === currentCategory);
  if (!exists) {
    const firstCategory = solarSystems[0].category;
    setCurrentCategory(firstCategory);
    setStoredCategory(firstCategory, galaxyType);
  }
}, [solarSystems, viewMode, currentCategory, galaxyType]);
```

**Change 3e:** Add empty state overlay in the main component return (after the `<Canvas>` closing tag, around line 4190):
```tsx
{/* Empty state — no tracked activity for this period */}
{viewMode === 'solarSystem' && solarSystems.length === 0 && (
  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-6 max-w-xs text-center pointer-events-auto shadow-2xl">
      <div className="w-12 h-12 rounded-full bg-zinc-800/60 flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
        <SatelliteDish className="w-6 h-6 text-zinc-400" />
      </div>
      <p className="text-zinc-200 font-medium text-sm mb-1">No systems this period</p>
      <p className="text-zinc-500 text-xs mb-4 leading-relaxed">There's no tracked activity for the selected time range.</p>
      <button
        onClick={() => setViewMode('galaxy')}
        className="w-full px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-500/30 transition border border-indigo-500/30"
      >
        Return to Galaxy View
      </button>
    </div>
  </div>
)}
```

**Rationale:** 
- Removing `cameraDist` state eliminates 60 re-renders/sec. 
- Ref-driven opacity updates via `useFrame` avoid re-renders while maintaining distance-based fade. 
- `distanceFactor={30}` (adjusted from 15) gives constant screen size at typical planet-view distances (~30 units). 
- Removing `backdrop-filter: blur(8px)` eliminates Electron rasterization blur. 
- Removing inline `transform: scale(...)` prevents double-scaling artifacts. 
- The auto-select `useEffect` ensures `currentCategory` is always valid after period switches. 
- The empty state overlay provides human-centric feedback when no data exists.

**Acceptance:** Labels are crisp at all distances (no blur artifact). Switching periods never shows an empty solar system — either auto-selects a valid category or shows the empty state with a "Return to Galaxy" action.

---

### Fix 4 — Planet lighting and emissive

**Strategy:** Raise ambient/hemisphere/directional light intensities significantly. Raise planet emissive pulse base. Slow point light decay so outer orbits receive sufficient light. Keep `ACES_FILMIC` but ensure planets are bright enough to survive tone mapping compression.

**File:** `src/components/OrbitSystem.tsx`

**Change 4a:** Remove the dim lights in `SolarSystemScene` (lines 2429–2431). Delete:
```tsx
// DELETE THESE LINES:
<ambientLight color="#ffffff" intensity={0.15} />
<hemisphereLight color="#6688cc" groundColor="#222233" intensity={0.1} />
<directionalLight position={[5, 10, 5]} intensity={0.15} color="#aabbff" />
```

**Change 4b:** Replace the Canvas lighting (lines 4041–4045):
```tsx
{/* Space Lighting — strong enough to light outer planets at r=220 */}
<ambientLight intensity={0.4} color="#334466" />
<hemisphereLight groundColor="#222233" skyColor="#6688aa" intensity={0.6} />
<pointLight position={[0, 0, 0]} intensity={8} color="#ffaa00" distance={400} decay={1.0} />
<directionalLight position={[100, 60, 80]} intensity={1.5} color="#ffffff" />
<directionalLight position={[-80, -20, -60]} intensity={0.4} color="#4466aa" />
```

**Change 4c:** Raise planet emissive pulse (lines 1649–1654):
```tsx
// C2: Activity pulse glow — brighter base for visibility
const mat = meshRef.current.material as THREE.MeshStandardMaterial;
const pulseBase = 0.5 + (data.time / 3600) * 0.05;
const pulseT = Date.now() * 0.001;
const pulseVal = pulseBase + Math.sin(pulseT * 1.2 + angle) * 0.15;
mat.emissiveIntensity = Math.min(pulseVal, 1.5);
```

**Change 4d:** Raise planet material base emissive (lines 1734–1759):
```tsx
<meshStandardMaterial
  map={texture}
  normalMap={normalMap}
  normalScale={new THREE.Vector2(0.6, 0.6)}
  roughness={0.4}
  metalness={0.15}
  emissive={new THREE.Color(data.color)}
  emissiveIntensity={0.6}
  emissiveMap={texture}
/>
```

**Change 4e:** Brighten procedural texture base (lines 1213 and 1217):
```tsx
// Line 1213: change base color
// FROM: const baseColor = '#1e1e40';
// TO:
const baseColor = '#2a2a55';

// Line 1217: reduce darkening adjustment
// FROM: const adjustedColor = adjustColor(color, -15);
// TO:
const adjustedColor = adjustColor(color, -5);
```

**Change 4f:** Adjust bloom to accommodate brighter planets (lines 4049–4055):
```tsx
<Bloom
  intensity={0.9}
  luminanceThreshold={0.5}
  luminanceSmoothing={0.4}
  radius={0.4}
  mipmapBlur
/>
```

**Rationale:**
- **Ambient 0.4 + Hemisphere 0.6:** Provides base illumination so no planet is pure black, even at outer orbits.
- **Point light intensity=8, distance=400, decay=1.0:** At r=220, intensity ≈ 5.16 (vs. original 1.39). Slower decay (1.0 vs. 1.5) ensures outer orbits receive sufficient light.
- **Directional 1.5 + fill 0.4:** Simulates distant star light. Fill light from opposite side reduces harsh shadows.
- **Emissive pulse base 0.5–1.5 (vs. 0.15–0.35):** Planets glow visibly even in shadows.
- **Material emissive 0.6 (vs. 0.25):** Stronger self-illumination.
- **Brighter texture base `#2a2a55` (vs. `#1e1e40`):** Less dark canvas to start with.
- **Bloom intensity 0.9 (vs. 1.2), threshold 0.5 (vs. 0.6):** Prevents planets from blooming excessively while still allowing sun/emissive to glow.

**Acceptance:** Planets are clearly visible and saturated at orbits r=10 and r=220 in both apps and websites solar systems. The sun remains the brightest object (still `toneMapped={false}`).

---

### Fix 5 — Graphics Quality control (surface perfMode)

**Strategy:** Add a segmented control in the Perf panel mapping UI labels (Low/Medium/High) to `perfMode` values. Persist to localStorage. Optionally enable MSAA for High quality.

**File:** `src/components/OrbitSystem.tsx`

**Change 5a:** Update `perfMode` state to load from localStorage (line 3327):
```tsx
const [perfMode, setPerfMode] = useState<'high' | 'balanced' | 'performance'>(() => {
  try {
    const stored = localStorage.getItem('deskflow-graphics-quality');
    if (stored === 'high' || stored === 'balanced' || stored === 'performance') {
      return stored;
    }
  } catch (e) {
    // localStorage unavailable — fall back to balanced
  }
  return 'balanced';
});
```

**Change 5b:** Add Graphics Quality selector in the Perf panel (inside the FPS panel, around line 3880):
```tsx
{/* Graphics Quality selector — maps to perfMode */}
<div className="pt-3 border-t border-zinc-800/50 mt-3">
  <label className="text-zinc-400 text-xs mb-2 flex items-center gap-1.5">
    <Gauge className="w-3 h-3" /> Graphics Quality
  </label>
  <div className="grid grid-cols-3 gap-1.5 mt-2">
    {(['performance', 'balanced', 'high'] as const).map((mode) => (
      <button
        key={mode}
        onClick={() => {
          setPerfMode(mode);
          try {
            localStorage.setItem('deskflow-graphics-quality', mode);
          } catch (e) {
            // ignore
          }
        }}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
          perfMode === mode
            ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/50 hover:text-zinc-300'
        }`}
      >
        {mode === 'performance' ? 'Low' : mode === 'balanced' ? 'Medium' : 'High'}
      </button>
    ))}
  </div>
</div>
```

**Change 5c:** Enable MSAA for High quality in Canvas props (line 4022):
```tsx
// Change:
// gl={{ antialias: false, ... }}
// To:
gl={{ antialias: perfMode === 'high', ... }}
```

**Change 5d:** Enable MSAA in EffectComposer (line 4047):
```tsx
// Change:
// <EffectComposer multisampling={0}>
// To:
<EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>
```

**Change 5e:** Add `key` to Canvas to trigger remount when `perfMode` changes (line 4010):
```tsx
// Change:
// <Canvas camera={{ ... }} ...>
// To:
<Canvas key={`canvas-${perfMode}`} camera={{ ... }} ...>
```

**Rationale:**
- **localStorage persistence:** Survives restart. Try/catch per project invariant.
- **UI labels Low/Medium/High:** User-friendly. Maps to `performance/balanced/high`.
- **MSAA for High:** `antialias: true` + `multisampling={4}` provides 4× MSAA. Worth the cost in Electron for High quality. Medium/Low keep MSAA off for performance.
- **Canvas key:** Changing `antialias` requires WebGL context recreation. Key forces remount.
- **Existing consumption:** dpr cap, bloom/vignette gating, particle counts, and `PerformanceMonitor` auto-degrade already use `perfMode` — no changes needed there.

**Acceptance:** Picking a quality level changes dpr/particles/bloom/MSAA immediately and survives restart. The Perf panel still shows FPS.

---

## 3. Rendering Math

### Lighting (Fix 4)

**Point light intensity at distance r:**
```
I(r) = intensity / (1 + (r / distance)^decay)
```

| Configuration | r=0 | r=100 | r=220 (outer orbit) |
|---------------|-----|-------|---------------------|
| Original (int=3, dist=200, decay=1.5) | 3.00 | 2.22 | **1.39** |
| New (int=8, dist=400, decay=1.0) | 8.00 | 6.40 | **5.16** |

**Total light at outer orbit (r=220):**
- Original: ambient 0.03 + hemisphere 0.08 + point 1.39 + directional 0.5 = **~1.9**
- New: ambient 0.4 + hemisphere 0.6 + point 5.16 + directional 1.5 + fill 0.4 = **~8.1** (4.3× brighter)

**Emissive pulse:**
- Original: base 0.15–0.35, pulse ±0.08 → range [0.07, 0.43]
- New: base 0.5–1.0, pulse ±0.15 → range [0.35, 1.15] (2.7× brighter)

### Label Scaling (Fix 2 & 3)

**Galaxy labels (Fix 2):**
- Reference distance: 220 units (default galaxy camera distance)
- At distance D, scale = 220/D
- At D=220 (default): scale=1.0 → label appears at designed 13px
- At D=110 (zoomed in): scale=2.0, clamped to 1.8 → label appears at ~23px
- At D=440 (zoomed out): scale=0.5 → label appears at ~6.5px

**Planet labels (Fix 3):**
- `distanceFactor={30}`: at camera distance 30, label appears at designed 12px
- At distance 60: CSS scale=2, but at 2× distance → visual size still 12px (constant)
- At distance 15: CSS scale=0.5, but at 0.5× distance → visual size still 12px (constant)

---

## 4. Removals

1. **`cameraDist` React state** (lines 1656–1663) — replaced with ref + `useFrame` for opacity updates. Eliminates 60 re-renders/sec.
2. **`backdrop-filter: blur(8px)`** on planet labels — removed. Causes rasterization blur in Electron and is GPU-heavy.
3. **Inline `transform: scale(...)`** on planet labels — removed. Conflicted with `distanceFactor`, causing double-scaling artifacts.
4. **Dim lights in `SolarSystemScene`** (lines 2429–2431) — removed. Replaced by stronger Canvas lights. Simplifies lighting model.
5. **`maxWidth` truncation logic** on planet labels — removed. Not needed for planet names; adds complexity.

---

## 5. Verification Plan

### Bug 1 (Websites solar system)
1. Open Dashboard → "View Solar System" → fullscreen modal
2. Switch to **Websites** galaxy (top toggle)
3. Click any category sphere → "Enter Solar System" → **verify sun + planets render (not blank)**
4. Use category dropdown → select a category → **verify sun + planets render**
5. Click a planet in the legend → **verify camera flies to planet and scene is visible**
6. Click "Back" → verify return to Websites galaxy

### Bug 2 (Galaxy labels)
1. In Galaxy view, observe category labels at default zoom → **verify ~13px, readable, no overlap**
2. Zoom in (scroll) → **verify labels stay readable, scale up slightly**
3. Zoom out → **verify labels stay readable, scale down slightly**
4. Switch to Websites galaxy → **verify same behavior**
5. Switch time periods → **verify labels reposition correctly with new categories**

### Bug 3 (Blurry labels + period switch)
1. Enter any solar system → **verify labels are crisp (no blur artifact)**
2. Hover over a planet → **verify label shows duration, border color changes**
3. Zoom in/out → **verify labels remain crisp at all distances**
4. Switch from "Week" to "Today" → **verify solar system auto-selects a valid category (not empty)**
5. Switch to a period with no data (if possible) → **verify empty state overlay appears**
6. Click "Return to Galaxy View" → **verify return to galaxy view**
7. Check console → **verify no errors**

### Bug 4 (Dark planets)
1. Enter Apps solar system → **verify planets are clearly visible at all orbits**
2. Zoom out to see outer planets → **verify they are not black**
3. Enter Websites solar system → **verify same behavior**
4. Compare sun brightness → **verify sun is still the brightest object**
5. Check bloom → **verify planets glow subtly, not washed out**

### Bug 5 (Graphics quality)
1. Click "Perf" button → **verify Perf panel opens with FPS + Graphics Quality selector**
2. Select "Low" → **verify FPS increases (particles reduce, bloom off)**
3. Select "High" → **verify MSAA enabled (edges smoother), bloom on**
4. Select "Medium" → **verify balanced settings**
5. Close and reopen modal → **verify selection persists**
6. Restart app → **verify selection persists in localStorage**

---

## 6. Risk Notes

1. **Camera animation paths:** Changing `handleEnterSystem` and `handleCategorySelect` to target origin may cause the camera to fly a long distance (e.g., from x=3250 to x=0) when entering a websites solar system. The `WarpLines` and `PortalRing` should mask this, but test the visual transition to ensure it looks intentional, not broken.

2. **`planetPositionsRef` consistency:** This ref stores scene-space positions around origin. Since we're not changing the scene offset (it's already at origin), this remains correct. `focusOnPlanet` already targets origin, so no changes needed.

3. **Galaxy switching:** When switching between Apps and Websites galaxies in Galaxy view, the camera animates between x=0 and x=3250. This is unchanged and should work as before.

4. **PlanetTracker / OrbitControls:** `OrbitControls target={[0,0,0]}` (line 2440) is correct for solar system mode. No changes needed.

5. **MSAA remount:** Adding `key={canvas-${perfMode}}` forces Canvas remount when quality changes. This causes a brief flash. Test to ensure it's acceptable.

6. **PerformanceMonitor auto-degrade:** This already adjusts `perfMode` based on FPS. The new UI will reflect these changes. Test that manual selection overrides auto-degrade (or document that auto-degrade can override manual selection).

7. **Empty state overlay:** Ensure it doesn't block interaction with the 3D scene when there IS data. The condition `solarSystems.length === 0` prevents this.

8. **Label refs memory:** `labelRefs` and `systemGroups` in `GalaxyView` store refs for all categories. When categories change (period switch), old refs remain. This is a minor memory leak but negligible for ~20 categories. Consider clearing refs on unmount if needed.
# RESULT.md

## 1. Research Findings

### 1.1 Metaphor Alternatives to "Solar System"

The current solar system metaphor is visually striking but suffers from significant limitations for time-tracking data. Research into alternative visualization metaphors reveals several more effective approaches for hierarchical, time-weighted categorical data:

| Metaphor | Strengths | Weaknesses | Verdict |
|----------|-----------|------------|---------|
| **Solar System** (current) | Intuitive scale representation, clear hierarchy | Poor time-dimension encoding, orbit speed ≠ importance, hard to compare magnitudes | **Rejected** - prioritizes aesthetics over data legibility |
| **Force-Directed Graph** | Organic layout, reveals relationships, handles 1000+ nodes | Can become "hairball" without careful tuning, lacks time dimension | **Rejected** - overemphasizes connections vs. time allocation |
| **3D Treemap / Voronoi** | Space-filling, excellent for part-to-whole relationships, handles hierarchy | 3D version introduces occlusion, depth perception challenges | **Rejected** - better in 2D, depth adds confusion without benefit |
| **Radial "Habitat Rings"** | Clear category separation, time as arc length, compact | Can be visually busy with many categories, radial layout takes time to learn | **Rejected** - superior for time-series but weaker for categorical comparison |
| **Isometric City/Architecture** | Highly engaging, metaphor of "building" projects, spatial layout | Complex to implement, occlusion issues, time encoding unclear | **Rejected** - high development cost, poor time representation |
| **Constellation Graph** | Familiar pattern recognition, shows relationships | Primarily relational, poor for magnitude encoding | **Rejected** - optimized for network data, not time tracking |
| **Orbital Network/Force** | Combines hierarchy with relationships, dynamic | Can be computationally expensive, still inherits graph problems | **Rejected** - hybrid complexity without clear advantage |
| **Layered Concentric "Depth" View** | Time as depth layers, clear hierarchical grouping, less occlusion | 3D navigation challenge, harder to implement interactions | **Selected as basis** - best fits time-hierarchical data |

**Selected Approach: "Stratified Orbital Disc"** - A hybrid approach inspired by NASA's Eyes on the Solar System 【turn0search7】 but fundamentally reimagined as concentric rings where:
- **Ring groups** represent categories (replacing solar systems)
- **Orbital position** within ring represents time allocation rank
- **Object size** represents total time spent
- **Depth** (z-axis) represents time period (today/week/month/all)

This approach solves the solar system's fundamental problem: it separates **spatial relationships** (which apps are in which category) from **temporal magnitude** (how much time was spent), while maintaining the engaging 3D nature.

### 1.2 Real-World Precedents in Data Visualization

Research into serious data visualization precedents that encode magnitude + hierarchy spatially:

**NASA/JPL Visualizations**:
- **Eyes on the Solar System** 【turn0search7】: Uses orbital mechanics but for **celestial navigation**, not data comparison. Key transfer: intuitive time controls, smooth camera transitions, and clear scale indicators.
- **GPM Hurricane Visualizations** 【turn0search9】: Excellent example of **multi-dimensional data** (rainfall, time, 3D structure) with effective color encoding and animation for temporal changes. Transferable: sequential color palettes for magnitude, clear temporal scrubbing.
- **Psyche Mission Approach** 【turn0search8】: Uses enhanced color and **careful label placement** to highlight scientific data on complex surfaces. Transferable: strategic label placement to avoid occlusion.

**Other Industry Examples**:
- **Observable Notebooks** 【turn0search10】: Demonstrates **interactive data exploration** with immediate feedback. Key principle: every visual element should update responsively to user input.
- **Stardust.js** 【turn0search12**: Shows **GPU-accelerated rendering** for 10,000+ data points in information visualization. Proves that WebGL can handle large-scale data viz, but requires careful optimization.
- **Force-Directed Graphs** 【turn0search11】: While rejected as primary metaphor, these demonstrate **dynamic layout algorithms** that could be adapted for category grouping.

**Key Transferable Principles**:
1. **Progressive disclosure** - Start with overview, allow drill-down to details
2. **Linked views** - 3D visualization should sync with traditional charts
3. **Temporal scrubbing** - Smooth time-based filtering
4. **Strategic labeling** - Only label significant items, avoid clutter

### 1.3 Technical Research: Three.js Performance & Instancing

**Current Performance Issues Identified**:
- **80 individual meshes** per planet with 3 canvas textures each = **240+ draw calls** 【turn0search5】
- **No instancing** currently implemented 【turn0search6】
- **Multiple point clouds** (10 different starfields) = unnecessary overhead

**Research on Optimization Techniques**:

**InstancedMesh vs BatchedMesh vs Points**:
| Technique | Best For | Performance | Implementation Complexity |
|-----------|----------|-------------|---------------------------|
| **InstancedMesh** | Same geometry, different transforms | Excellent (1 draw call per geometry type) | Medium |
| **BatchedMesh** | Similar geometries, static or semi-static | Good (fewer draw calls) | High |
| **Points** | Thousands of small, similar objects | Excellent for particles | Low |
| **GPU-driven rendering** | Very large scenes (100k+ objects) | Best performance | Very high |

**Recommended Approach for DeskFlow**:
- **InstancedMesh** for planet objects (since all planets share similar geometry)
- **Custom ShaderMaterial** only for specialized effects (atmosphere, rings)
- **Points** for starfields and particle effects (already partially implemented)
- **Instanced attributes** for per-instance color, size, and position data

**Label Decluttering & Collision Avoidance**:
- **Quadtree/Octree spatial partitioning** for efficient visibility checks
- **Dynamic label placement** with priority queues (most important items labeled first)
- **Level-of-detail (LOD)** system: labels appear based on camera distance and object importance

**Picking at Scale**:
- **GPU picking** for efficient selection of thousands of objects
- **Raycasting** with optimization (only test against objects near cursor)
- **Screen-space projection** for accurate label positioning

### 1.4 Motion & Accessibility Research

**Reduced Motion Strategies**:
- **CSS `prefers-reduced-motion` media query** detection (already partially implemented)
- **Static composition** that remains meaningful without animation
- **Optional motion controls** in user settings
- **Motion level indicators** (low/medium/high) with clear feedback

**Screen Reader Accessibility for 3D**:
- **DOM overlay** with accessible text descriptions of the visualization state
- **Keyboard navigation** for all interactive elements
- **ARIA live regions** for dynamic updates (period changes, filters)
- **Alternative data table** providing the same information in accessible format

**Color & Theme Considerations**:
- **Perceptual color palettes** (Viridis, Cividis) for magnitude encoding 【turn0search15】【turn0search18】
- **Color-blind safe** alternatives (avoid red-green axis)
- **Dual themes** (light/dark) with consistent color meaning across themes
- **Opacity-based magnitude encoding** as primary channel (more accessible than color alone)

## 2. The Design: "Stratified Orbital Disc" Visualization

### 2.1 Metaphor & Channel→Meaning Mapping

The design replaces the "solar system" metaphor with a **stratified orbital disc** that more honestly represents time-tracking data:

| Visual Channel | Current Encoding | New Encoding | Rationale |
|----------------|------------------|--------------|-----------|
| **Object size** | Time spent | Time spent (same) | Size remains intuitive for magnitude |
| **Orbit radius** | Rank by time | **Category grouping** | Rings group apps by category, not rank |
| **Position in ring** | Not meaningful | **Time allocation within category** | Clock-like positioning within category ring |
| **Object color** | Category family | **Tier (productive/neutral/distracting)** | Color now means productivity tier, not just category |
| **Depth (z-axis)** | Not used | **Time period selection** | Today/week/month/all as depth layers |
| **Motion speed** | Kepler's law | **Fixed speed** | Motion no longer implies importance |
| **Connections** | Not shown | **App relationships** (optional) | Can show app usage patterns (e.g., browser→editor) |

**Primary Question Answered in 5 Seconds**: *"How is my time distributed across categories and apps, and is it productive?"*

This is achieved through:
1. **Category rings** immediately showing categorical distribution
2. **Object size** showing time allocation within categories
3. **Color tiers** showing productivity assessment
4. **Depth layer** showing time period context

### 2.2 Design Rationale

**Why This Approach Wins**:
1. **Honest time representation** - No fake Keplerian mechanics implying time importance from orbit speed
2. **Category clarity** - Rings clearly group related apps, reducing cognitive load
3. **Productivity integration** - Color tiers align with DeskFlow's existing productivity model
4. **Temporal flexibility** - Depth layers allow seamless period switching without layout changes
5. **Performance scalability** - Instanced rendering can handle 1000+ apps efficiently

**Rejected Alternatives**:
- **Pure 3D Treemap**: Suffers from occlusion and doesn't naturally show temporal relationships
- **Constellation Graph**: Overemphasizes connections over time allocation
- **City Metaphor**: Too complex to implement well and doesn't naturally encode time

## 3. Visual Specification

### 3.1 Color System (LAMINAR Compliant)

**Base Colors** (from DeskFlow tokens):
```
--bg-primary: #0F0F10 (Dark) / #F5F5F7 (Light)
--text-muted: #9CA3AF (Dark) / #4B5563 (Light)
--page-accent: #3B82F6 (Blue)
--tier-productive: #10B981 (Green)
--tier-neutral: #6B7280 (Gray)
--tier-distracting: #EF4444 (Red)
--ws-border: #E5E7EB (Light) / #1F2937 (Dark)
```

**3D Scene Colors**:
- **Background**: Pure black (#000000) in dark mode, #F8FAFC in light mode
- **Grid lines**: `rgba(156, 163, 175, 0.2)` (dark) / `rgba(75, 85, 99, 0.2)` (light)
- **Category rings**: 5% opacity of category's tier color
- **App objects**: Tier color with opacity based on time magnitude (0.3-1.0)
- **Labels**: White text on dark background, dark text on light background

**Perceptual Color Mapping**:
```javascript
// Magnitude-based opacity (primary encoding)
const opacity = 0.3 + (timeSpent / maxTime) * 0.7;

// Tier-based hue (secondary encoding)
const tierColors = {
  productive: '#10B981',
  neutral: '#6B7280', 
  distracting: '#EF4444'
};
```

### 3.2 Camera & Spatial Setup

**Camera Defaults**:
- **Position**: `[0, 150, 250]` (slightly above and in front of disc center)
- **Target**: `[0, 0, 0]` (center of visualization)
- **FOV**: 50° (standard for data visualization)
- **Near/Far planes**: 0.1 / 2000 (adequate for scene scale)
- **Min/Max distance**: 50 / 1000 (allows close inspection and overview)

**Scene Layout**:
- **Category rings**: Concentric rings at radii 40-200 world units
- **Ring spacing**: 20-30 units between category rings (depends on category count)
- **Object sizes**: 2-15 world units (based on time allocation)
- **Depth layers**: 4 layers at z-positions: -100 (today), -33 (week), 33 (month), 100 (all)

**Object Geometry**:
- **Base geometry**: Icosahedron (detail 1) for planets, 8 vertices for efficiency
- **Rings**: Torus geometry with radius 0.8-1.2, tube 0.1-0.3
- **Labels**: Plane geometry with text texture

### 3.3 Materials & Rendering

**Material Specifications**:

```javascript
// Planet material (InstancedMesh)
const planetMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff, // Base color, tinted by instance color
  roughness: 0.4,
  metalness: 0.1,
  emissive: 0x000000,
  transparent: true,
  opacity: 0.8,
});

// Ring material
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0x9CA3AF,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});

// Label material
const labelMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
});
```

**Postprocessing Chain** (gated by perfMode):

```javascript
// High quality mode
<EffectComposer multisampling={4}>
  <Bloom intensity={0.4} luminanceThreshold={0.6} />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  <Vignette eskil={false} offset={0.2} darkness={0.8} />
</EffectComposer>

// Balanced mode (multisampling disabled)
<EffectComposer multisampling={0}>
  <Bloom intensity={0.3} luminanceThreshold={0.7} />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  <Vignette eskil={false} offset={0.2} darkness={0.8} />
</EffectComposer>

// Performance mode (minimal effects)
<EffectComposer multisampling={0}>
  <ToneMapping mode={ToneMappingMode.LINEAR} />
</EffectComposer>
```

### 3.4 Typography & Labels

**Font Stack**:
- **Primary**: Inter (UI elements)
- **Secondary**: JetBrains Mono (data values, timestamps)
- **Tertiary**: Space Grotesk (3D labels, when needed)

**Label System**:
- **Priority-based labeling**: Top 10 apps always labeled, others labeled on hover
- **Dynamic sizing**: Label size adjusts based on camera distance (billboard effect)
- **Collision avoidance**: Quadtree-based system prevents overlapping labels

**Label Content**:
```
[App Name] [Duration] [Tier Badge]
```
Example: `VS Code 4h 32m ● Productive`

### 3.5 All Four States

**Loading State**:
```
Title: "Building your time universe..."
Message: "Aggregating activity data and calculating orbits."
Visual: Skeleton rings with pulsing animation
Action: None required (auto-transitions when data arrives)
```

**Empty State** (No data for period):
```
Title: "No activity data for this period"
Message: "The time tracker hasn't recorded any activity yet. Start using apps to populate this visualization."
Visual: Empty disc with faint category rings
Action: "Start Tracking" button (if tracking paused) or "View Different Period" link
```

**Error State** (Data load failure):
```
Title: "Couldn't load visualization data"
Message: "There was a problem retrieving your activity data. This might be temporary."
Visual: Disc with error icon, rings still visible
Action: "Try Again" button + "View Activity Log" link for debugging
```

**Populated State**:
- Full visualization with interactive elements
- Legend showing tier colors and category meanings
- Time period selector (Today/Week/Month/All)
- Category filter chips

## 4. Motion Specification

### 4.1 Liveliness Level: **Measured**

The visualization uses **subtle, purposeful motion** rather than constant animation. Motion serves functional purposes only.

### 4.2 Animation Specifications

| Animation | Trigger | Duration | Easing | Purpose |
|-----------|---------|----------|--------|---------|
| **Camera focus** | Click on app | 800ms | Custom cubic-bezier(0.4, 0, 0.2, 1) | Smooth transition to detail view |
| **Category ring highlight** | Hover on category | 300ms | easeOutQuad | Visual feedback for interaction |
| **Period switch** | Depth layer change | 600ms | easeInOutQuad | Smooth temporal transition |
| **App entry** | New app appears | 500ms | backOut | Subtle introduction of new data |
| **Filter application** | Filter chip click | 400ms | easeOutQuad | Visual response to filtering |

### 4.3 Easing Curves

**Standard Curve** (replaces current three-phase Bezier):
```javascript
const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const backOut = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
```

**Motion Hierarchy**:
1. **Primary motion** (camera moves): 600-800ms, easeInOutQuad
2. **Secondary motion** (object highlights): 300-400ms, easeOutQuad  
3. **Tertiary motion** (ambient effects): 2000-3000ms, linear loops

### 4.4 Reduced Motion Fallback

When `prefers-reduced-motion` is enabled:

```javascript
// Disable all non-essential motion
const reducedMotion = {
  cameraMoves: false, // Instant transitions
  objectAnimations: false, // Static objects
  ambientEffects: false, // No particle effects
  transitions: 'instant' // 0ms duration
};

// Static composition remains meaningful:
// - Clear category rings with labels
// - Object sizes still show time allocation
// - Color tiers still visible
// - Depth layers still selectable via UI
```

### 4.5 Frame Budget & Performance

**Target**: 60 FPS at 1920×1080 on integrated graphics

**Performance Strategy**:
```javascript
// Frame budget allocation
const frameBudget = {
  render: 10ms,     // Main rendering
  animations: 5ms,  // Update animations
  interactions: 3ms, // Handle input
  labels: 2ms,      // Update label positions
  total: 20ms      // 50 FPS target (buffer for spikes)
};

// Performance monitoring
<PerformanceMonitor
  onIncline={() => adjustQuality('up')}
  onDecline={() => adjustQuality('down')}
  flipflops={3} // Number of times to switch before settling
/>
```

## 5. Interaction & Accessibility

### 5.1 Full Input Map

| Input | Action | Feedback |
|-------|--------|----------|
| **Left click** on app | Focus camera on app | Smooth camera transition, highlight object |
| **Left click** on category ring | Filter to category | Ring brightens, others dim, camera adjusts |
| **Right click** | Context menu | Menu with "View details", "Exclude from stats", etc. |
| **Middle drag** | Orbit camera | Smooth camera rotation with damping |
| **Scroll** | Zoom in/out | Camera moves along view vector, clamped to min/max |
| **Double click** | Reset view | Camera returns to default position |
| **Keyboard arrows** | Navigate apps | Focus moves between apps in current category |
| **Enter/Space** | Select focused app | Opens detail panel |
| **Escape** | Clear selection | Removes focus, returns to overview |
| **1-4 keys** | Switch time period | Depth layer changes with animation |

### 5.2 Search & Filter Behavior

**Search**:
- **Real-time search** as user types
- **Highlight matching** apps with glow effect
- **Dim non-matching** apps to 20% opacity
- **Auto-focus** on first match if multiple results

**Filter Chips**:
- **Category filters**: Toggle visibility of category rings
- **Tier filters**: Show only productive/neutral/distracting
- **Minimum time filter**: Slider to hide apps below time threshold
- **Combination logic**: AND logic between different filter types

### 5.3 Keyboard Support & Focus Management

**Keyboard Navigation Flow**:
1. **Tab** enters visualization, focuses on first interactive element
2. **Arrow keys** navigate between apps in current category
3. **Enter/Space** activates focused app
4. **Escape** clears focus and returns to previous state
5. **Tab** exits visualization when at last element

**Focus Indicators**:
- **Visual focus ring** around focused app
- **Text size increase** for focused label
- **Camera slight adjustment** to ensure focused item is visible

### 5.4 Screen Reader Accessibility

**DOM Overlay Structure**:
```html
<div role="region" aria-label="Time allocation visualization">
  <div role="status" aria-live="polite">
    <!-- Current period, category counts, etc. -->
  </div>
  
  <div role="grid" aria-rowcount="100">
    <div role="row">
      <div role="gridcell" aria-label="VS Code, 4 hours 32 minutes, Productive tier">
        <!-- Visual representation -->
      </div>
    </div>
  </div>
  
  <div role="toolbar" aria-label="Visualization controls">
    <!-- Period selector, filters, etc. -->
  </div>
</div>
```

**Alternative Data Table**:
- **Toggle button** to show/hide accessible table view
- **Same data** as visualization but in table format
- **Sortable columns** by app name, time, category, tier
- **Searchable** with same search functionality as 3D view

### 5.5 Compact/Inline Variant

**Dashboard Widget Design**:
- **Simplified version** with fewer interactive elements
- **Category rings only** (no individual app objects)
- **Tier-colored segments** within rings
- **Click to expand** to full modal view
- **Minimal height** (250px) to fit dashboard grid

**Widget States**:
- **Loading**: Skeleton rings with pulse animation
- **Empty**: "No data yet" message with icon
- **Error**: "Data unavailable" with retry button
- **Populated**: Interactive rings with hover effects

## 6. Data-Correctness Plan

### 6.1 One Clock: Local Time

**Decision**: Use **local time** for all visualizations to match user expectations.

**Implementation**:
```sql
-- Migration for stats_daily trigger
CREATE TRIGGER IF NOT EXISTS update_stats_daily_local
AFTER INSERT ON logs
BEGIN
    -- Convert UTC timestamp to local time before bucketing
    INSERT OR REPLACE INTO stats_daily (
        date, app, category, seconds
    ) VALUES (
        DATE(NEW.timestamp, 'localtime'), -- Local date
        NEW.app,
        NEW.category,
        NEW.duration
    );
END;
```

**Migration Cost**:
- **Development time**: 4-6 hours (trigger update + testing)
- **Risk**: Low (can maintain UTC version in parallel during transition)
- **Rollback**: Simple trigger replacement

### 6.2 One Table: Raw Logs with Aggregation

**Decision**: Use **raw `logs` table** with client-side aggregation for flexibility.

**Rationale**:
1. **Session counts** available directly from raw logs
2. **Per-hour data** for temporal patterns
3. **Category flexibility** (can change categorization without DB migration)
4. **Consistency** with Activity page which uses raw logs

**Implementation**:
```javascript
// Data adapter for visualization
const vizAdapter = {
  getData: async (period) => {
    const logs = await getLogs({ period });
    return aggregateForVisualization(logs);
  },
  
  aggregateForVisualization: (logs) => {
    // Group by app, sum durations, count sessions
    // Maintain timestamp for temporal patterns
    return groupedData;
  }
};
```

### 6.3 Truth Guarantees & Verification

**Verification Procedure**:
```javascript
// Developer verification script
const verifyDataIntegrity = async () => {
  // 1. Get same period data from both sources
  const vizData = await getVizData('week');
  const activityData = await getActivityData('week');
  
  // 2. Compare total time
  const vizTotal = sum(vizData.map(d => d.duration));
  const activityTotal = sum(activityData.map(d => d.duration));
  
  // 3. Compare per-app time
  const differences = [];
  for (const app of vizData) {
    const activityApp = activityData.find(a => a.app === app.app);
    if (!activityApp) {
      differences.push(`Missing in activity: ${app.app}`);
    } else if (Math.abs(activityApp.duration - app.duration) > 1) {
      differences.push(`Time mismatch for ${app.app}: viz=${app.duration}s, activity=${activityApp.duration}s`);
    }
  }
  
  // 4. Report results
  return {
    totalMatch: Math.abs(vizTotal - activityTotal) < 1,
    appDifferences: differences,
    timestamp: new Date().toISOString()
  };
};
```

**Discrepancy Handling**:
- **Automatic detection** with warning banner if mismatch >1 second
- **Manual sync** button to force recalculation
- **Logging** of all discrepancies for debugging

### 6.4 Honest Empty/Partial States

**Long Tail Design**:
- **Minimum threshold**: 30 seconds (same as current)
- **Aggregated "Others"** category for apps below threshold
- **Expandable "Others"** to see all low-usage apps
- **Visual distinction** for aggregated vs. individual apps

**Partial Data States**:
- **Incomplete day**: Visual indicator (dashed ring) for current day
- **Missing categories**: "Uncategorized" ring with distinct pattern
- **Time gaps**: Visual breaks in rings for periods with no data

## 7. Engineering Plan

### 7.1 File Changes Overview

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/orbit/OrbitScene.tsx` | **Major refactor** | Replace solar system with orbital disc, implement instancing |
| `src/components/orbit/PlanetUtils.tsx` | **Rewrite** | New data aggregation and layout algorithms |
| `src/components/orbit/Planet.tsx` | **Delete** | Functionality moved to instanced rendering |
| `src/components/orbit/Ring.tsx` | **Delete** | Replaced by new ring system |
| `src/components/orbit/GalaxyDust.tsx` | **Delete** | Not needed in new design |
| `src/components/orbit/Moon.tsx` | **Delete** | Not applicable to new metaphor |
| `src/components/OrbitSystem.tsx` | **Update** | New controls, state management |
| `src/components/orbit/OrbitControls.tsx` | **Update** | New keyboard shortcuts, focus management |
| `src/components/orbit/index.ts` | **Update** | Update exports, remove deleted files |

### 7.2 Duplicate Component Resolution

**Ownership Decision**:
- **Starfield**: Move to `OrbitScene.tsx` (as instanced points system)
- **WarpLines**: Delete (not needed in new design)
- **PortalRing**: Delete (replaced by period transition effect)
- **AsteroidBelt**: Delete (not applicable)
- **AtmosphericScattering**: Delete (not needed)

**Cleanup Process**:
1. **Remove all exports** from `Planet.tsx` and `Ring.tsx`
2. **Update barrel exports** in `index.ts`
3. **Delete `Planet.tsx` and `Ring.tsx`** after migration
4. **Update imports** throughout codebase

### 7.3 Instancing Implementation Plan

**Phase 1: Basic Instancing** (Week 1)
```javascript
// Create instanced mesh for planets
const planetGeometry = new THREE.IcosahedronGeometry(1, 1);
const planetMaterial = new THREE.MeshStandardMaterial();
const planetMesh = new THREE.InstancedMesh(planetGeometry, planetMaterial, maxPlanets);

// Set instance attributes
planetMesh.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(maxPlanets * 16), 16);
planetMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxPlanets * 3), 3);
```

**Phase 2: Custom Shader** (Week 2)
```glsl
// Vertex shader for instanced rendering
attribute vec3 instanceColor;
attribute float instanceOpacity;

varying vec3 vColor;
varying float vOpacity;

void main() {
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
```

**Phase 3: Optimization** (Week 3)
- **Frustum culling** for instanced mesh
- **LOD system** based on camera distance
- **Batching** for static elements

### 7.4 Texture Lifecycle Management

**Preserved System**:
```javascript
// Maintain existing texture management
const textureManager = {
  acquire: (appId) => {
    // Ref-counted texture acquisition
  },
  release: (appId) => {
    // Release when no longer needed
  },
  disposeAll: () => {
    // Clean up all textures
  }
};
```

**Enhancement**:
- **Texture atlas** for similar app icons
- **Dynamic resolution** based on camera distance
- **Compression** for reduced memory usage

### 7.5 Backend Gap Table

| Data Requirement | Availability | Implementation Needed |
|------------------|--------------|----------------------|
| Per-app time (current period) | ✅ Available in `logs` | None |
| Session count per app | ✅ Available in `logs` | None |
| Category assignments | ✅ Available in app metadata | None |
| **Temporal patterns (hourly)** | ❌ Not aggregated | Add hourly aggregation to stats |
| **App relationships** | ❌ Not tracked | New IPC for app transition tracking |
| **Historical tier assignments** | ❌ Not stored | Add tier history to app metadata |

### 7.6 Staged Rollout Plan

**Stage 1: Data Correctness** (Week 1-2)
- Implement local time trigger
- Create data verification script
- Update data adapters

**Stage 2: Basic Visualization** (Week 3-4)
- Implement orbital disc layout
- Basic instancing for planets
- Category ring system

**Stage 3: Interactivity** (Week 5-6)
- Camera controls and focus system
- Search and filter functionality
- Keyboard navigation

**Stage 4: Polish & Optimization** (Week 7-8)
- Postprocessing effects
- Performance optimization
- Accessibility features

**Stage 5: Integration** (Week 9-10)
- Dashboard widget implementation
- Modal integration
- Final testing and bug fixes

## 8. Backend Gap Table

| Feature | Status | Required Implementation |
|---------|--------|-------------------------|
| **Per-app time aggregation** | ✅ Available | None (uses existing `get-logs`) |
| **Session counts** | ✅ Available | None (count log entries) |
| **Category rollups** | ✅ Available | None (group by category) |
| **Hourly patterns** | ❌ Missing | Add `stats_hourly` table or client-side aggregation |
| **App transition tracking** | ❌ Missing | New IPC channel to track app switches |
| **Tier assignment history** | ❌ Missing | Add `tier_assignments` table with timestamps |
| **Productivity scoring** | ✅ Available | None (client-side calculation) |

## 9. Risks & Mitigations

### 9.1 GPU Cost on Integrated Graphics

**Risk**: New visualization may be too demanding for integrated GPUs.

**Mitigation**:
- **Instanced rendering** reduces draw calls from 240+ to ~10
- **Adaptive quality** system that reduces effects on low-end hardware
- **Performance monitoring** with automatic quality adjustment
- **Fallback to 2D view** if performance is unacceptable

### 9.2 Long Tail Data Problem

**Risk**: Many apps with tiny time allocations may clutter the visualization.

**Mitigation**:
- **Minimum threshold** (30 seconds) to reduce noise
- **"Others" aggregation** for apps below threshold
- **Expandable details** to see all apps when needed
- **Search functionality** to find specific apps regardless of size

### 9.3 Legibility vs. Beauty Tradeoff

**Risk**: More beautiful visualization may be harder to read than current one.

**Mitigation**:
- **User testing** with both versions to compare comprehension
- **Progressive disclosure** - overview first, details on demand
- **Clear labeling** with priority-based system
- **Alternative data table** for users who prefer text-based data
- **Tutorial overlay** for first-time users

## 10. Removals — Needs Explicit User Confirmation

### 10.1 Proposed Removals

1. **`Planet.tsx`** - Entire file (replaced by instanced rendering)
   - **Reason**: All functionality moved to instanced system
   - **Impact**: No user-facing change, internal refactoring only

2. **`Ring.tsx`** - Entire file (replaced by new ring system)
   - **Reason**: New ring implementation is more efficient
   - **Impact**: Visual change to ring appearance, but improved clarity

3. **`GalaxyDust.tsx`** - Entire file
   - **Reason**: Not applicable to new orbital disc design
   - **Impact**: Loss of background dust effect (minor visual change)

4. **`Moon.tsx`** - Entire file
   - **Reason**: Moon metaphor doesn't apply to new design
   - **Impact**: Loss of project "moons" (replaced by project labels)

5. **Current solar system metaphor** - Complete replacement
   - **Reason**: New design is more honest about data relationships
   - **Impact**: **Major visual change** - requires user confirmation

### 10.2 Preserved Elements

- **All existing data sources** and IPC channels
- **Current performance mode** structure (high/balanced/performance)
- **Existing keyboard shortcuts** where applicable
- **Current error handling** and WebGL fallback

---

**Design Completion Statement**: This design provides a complete, implementable specification for the DeskFlow time allocation visualization. Every visual decision is justified by data visualization research and user needs. The engineering plan accounts for all technical constraints while providing a clear path to implementation. All data displays are verifiable against the Activity page to ensure truthfulness.

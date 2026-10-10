// ── OrbitScene: the 3D presentation layer for the Orbit / Solar System view ──
//
// WHY THIS FILE IS SHAPED THIS WAY (do not "simplify" it back into stubs):
//
// On 2026-09-21, commit 1fdeab6 ("refactor: TerminalPage and OrbitSystem breakup
// complete") split this component out of OrbitSystem.tsx. Every component body
// was replaced with a `return null` placeholder while only the signatures were
// kept, so OrbitSystem still type-checked, esbuild still resolved, and the build
// still went green - but the Dashboard's "App Ecosystem" button opened a modal
// containing NOTHING, because every render path below resolved to null.
//
// The bodies below are restored from 3476073, the last commit in which this
// logic was self-contained and actually rendered. Do not replace a body with a
// stub to "fix" a type error - that is precisely the bug this comment exists
// to prevent. See agent/state/opencode-solarfix-20261004.md.
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls, Stars, Html, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, RefreshCw, X, ChevronDown, ChevronUp, Clock, Activity, Gauge, SatelliteDish } from 'lucide-react';
import type { PlanetData } from './PlanetUtils';
import { formatDurationSeconds, getCategoryListFromSettings } from './PlanetUtils';
import { GalaxyDustCloud, WebsiteGalaxyDustCloud } from './GalaxyDust';
import { StratifiedOrbitalDisc } from './OrbitalDisc';
import { perfProbe } from './perfProbe';
import { PerfSampler, PerfFlush, PerfStrip } from './PerfStrip';
import { FPSCounter, FPSLineGraph } from './OrbitControls';
import { Sun, OrbitPath, TexturedPlanet } from './Planet';
import { AsteroidBelt, Starfield, WarpLines, PortalRing } from './Ring';

type AnimationSpeed = 'slow' | 'normal' | 'instant';

// Refcounted planet-texture cache owner. GLCleanup consults this so a shared,
// cached texture is never disposed out from under a planet still using it.
const cacheOwnedTextures = new WeakSet<THREE.Texture>();

// Disposes WebGL resources on unmount.
function GLCleanup() {
  const { gl, scene } = useThree();
  useEffect(() => {
    return () => {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => {
                if (material.map && !cacheOwnedTextures.has(material.map)) material.map.dispose();
                if (material.normalMap && !cacheOwnedTextures.has(material.normalMap)) material.normalMap.dispose();
                if (material.emissiveMap && !cacheOwnedTextures.has(material.emissiveMap)) material.emissiveMap.dispose();
                if (material.alphaMap) material.alphaMap.dispose();
                material.dispose();
              });
            } else {
              const material = object.material as any;
              if (material.map && !cacheOwnedTextures.has(material.map)) material.map.dispose();
              if (material.normalMap && !cacheOwnedTextures.has(material.normalMap)) material.normalMap.dispose();
              if (material.emissiveMap && !cacheOwnedTextures.has(material.emissiveMap)) material.emissiveMap.dispose();
              if (material.alphaMap) material.alphaMap.dispose();
              material.dispose();
            }
          }
        }
      });
      gl.dispose();
      console.log('[OrbitSystem] WebGL context lost - cleanup complete');
    };
  }, [gl, scene]);
  return null;
}

// Sun Configuration for each category
const SUN_CONFIGS: Record<string, { color: string; emissive: string; sizeRange: [number, number] }> = {
  'IDE': { color: '#ffaa33', emissive: '#ff8800', sizeRange: [4, 5.5] },
  'AI Tools': { color: '#aa66ff', emissive: '#8833ff', sizeRange: [4, 5.5] },
  'Browser': { color: '#44aaff', emissive: '#2299ff', sizeRange: [4, 5.5] },
  'Entertainment': { color: '#ff44aa', emissive: '#ff3399', sizeRange: [4, 5.5] },
  'Communication': { color: '#33ccaa', emissive: '#22aa88', sizeRange: [4, 5.5] },
  'Design': { color: '#ff66aa', emissive: '#ff4499', sizeRange: [4, 5.5] },
  'Productivity': { color: '#ffeecc', emissive: '#ffdd99', sizeRange: [4, 5.5] },
  'Tools': { color: '#ff8833', emissive: '#ff6622', sizeRange: [4, 5.5] },
  'Other': { color: '#aaaaaa', emissive: '#888888', sizeRange: [4, 5.5] },
};

// Default sun config
const DEFAULT_SUN_CONFIG = { color: '#ffcc44', emissive: '#ffaa22', sizeRange: [4, 5.5] as [number, number] };

// Website category map - maps website categories to visual configs (Electric Nebula theme)
const WEBSITE_SUN_CONFIGS: Record<string, { color: string; emissive: string; sizeRange: [number, number] }> = {
  'Social Media': { color: '#ff00ff', emissive: '#cc00cc', sizeRange: [4, 5.5] },
  'Entertainment': { color: '#ff44aa', emissive: '#cc3388', sizeRange: [4, 5.5] },
  'Productivity': { color: '#00ffaa', emissive: '#00cc88', sizeRange: [4, 5.5] },
  'Search Engine': { color: '#00ccff', emissive: '#0099cc', sizeRange: [4, 5.5] },
  'News': { color: '#aa66ff', emissive: '#8844cc', sizeRange: [4, 5.5] },
  'Shopping': { color: '#ffaa00', emissive: '#cc8800', sizeRange: [4, 5.5] },
  'Communication': { color: '#00ffff', emissive: '#00cccc', sizeRange: [4, 5.5] },
  'Education': { color: '#66ffff', emissive: '#44cccc', sizeRange: [4, 5.5] },
  'Developer Tools': { color: '#8866ff', emissive: '#6644cc', sizeRange: [4, 5.5] },
  'Uncategorized': { color: '#88aacc', emissive: '#6688aa', sizeRange: [4, 5.5] },
  'Other': { color: '#aabbcc', emissive: '#8899aa', sizeRange: [4, 5.5] },
};

const DEFAULT_WEBSITE_SUN_CONFIG = { color: '#00c6ff', emissive: '#0099cc', sizeRange: [4, 5.5] as [number, number] };
// Planet Detail Panel
export function PlanetDetailPanel({ planet, onClose }: { planet: PlanetData | null; onClose: () => void }) {
  if (!planet) return null;
  const hours = Math.floor(planet.time / 3600);
  const mins = Math.floor((planet.time % 3600) / 60);
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="absolute top-4 right-4 w-80 glass rounded-xl p-5 z-[var(--z-overlay)] border border-white/10">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle, ${planet.color}55, transparent)`, border: `2px solid ${planet.color}` }}>
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: planet.color }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">{planet.name}</div>
            <div className="text-sm" style={{ color: planet.color }}>{planet.category}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-zinc-800"><span className="text-zinc-400">Total Focus Time</span><span className="font-mono text-xl tabular-nums text-white">{hours}h {mins}m</span></div>
          <div className="flex justify-between items-center py-3 border-b border-zinc-800"><span className="text-zinc-400">Sessions</span><span className="font-mono text-lg text-emerald-400">{planet.sessions}</span></div>
          <div className="flex justify-between items-center py-3 border-b border-zinc-800"><span className="text-zinc-400">Orbital Speed</span><span className="font-mono text-sm text-zinc-400">{planet.speed.toFixed(2)} rad/s</span></div>
          <div className="flex justify-between items-center py-3 border-b border-zinc-800"><span className="text-zinc-400">Rotation Speed</span><span className="font-mono text-sm text-zinc-400">{(planet.rotationSpeed || 1.5).toFixed(1)} rad/s</span></div>
          <div className="flex justify-between items-center py-3 border-b border-zinc-800"><span className="text-zinc-400">Orbit Distance</span><span className="font-mono text-sm text-zinc-400">{planet.orbitRadius.toFixed(1)} AU</span></div>
          <div className="flex justify-between items-center py-3 border-b border-zinc-800"><span className="text-zinc-400">Eccentricity</span><span className="font-mono text-sm text-zinc-400">{planet.eccentricity?.toFixed(2) || '0.10'}</span></div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Camera Position Tracker - uses ref instead of state to avoid re-renders
export function CameraTracker({ cameraPosRef }: { cameraPosRef: React.MutableRefObject<[number, number, number]> }) {
  useFrame(({ camera }) => {
    cameraPosRef.current = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}

export function PlanetTracker({
  controlsRef,
  planetPositionsRef,
  trackedPlanetRef,
  cameraPosRef,
  isAnimatingRef,
}: {
  controlsRef: React.MutableRefObject<any>;
  planetPositionsRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
  trackedPlanetRef: React.MutableRefObject<string | null>;
  cameraPosRef: React.MutableRefObject<[number, number, number]>;
  isAnimatingRef: React.MutableRefObject<boolean>;
}) {
  const lastPlanetPosRef = useRef<THREE.Vector3 | null>(null);
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());

  useFrame(() => {
    const name = trackedPlanetRef.current;
    if (!name || !controlsRef.current) return;
    if (isAnimatingRef.current) return; // Don't track during camera animation
    const planetPos = planetPositionsRef.current.get(name);
    if (!planetPos) return;

    // On first frame of tracking, calculate the offset between camera and planet
    if (!lastPlanetPosRef.current) {
      const camPos = controlsRef.current.object.position;
      cameraOffsetRef.current.subVectors(camPos, planetPos);
      lastPlanetPosRef.current = planetPos.clone();
      return;
    }

    const currentTarget = controlsRef.current.target;
    const prevPlanetPos = lastPlanetPosRef.current;

    // Update target to track planet
    currentTarget.lerp(planetPos, 0.08);

    // Move camera position to follow planet while maintaining offset
    const camPos = controlsRef.current.object.position;
    const offset = cameraOffsetRef.current.clone();
    const newCamPos = planetPos.clone().add(offset);
    camPos.lerp(newCamPos, 0.06);

    lastPlanetPosRef.current = planetPos.clone();
  });

  useEffect(() => {
    lastPlanetPosRef.current = null;
  }, [trackedPlanetRef.current]);

  return null;
}

// Main Scene Component
export function SolarSystemScene({ planets, isPaused, speed, onPlanetClick, controlsRef, onPlanetPositionUpdate, category = 'Other', sunSize, portalKey, isAnimating, showBelt, discMode = false, onDiscToggle }: { planets: PlanetData[]; isPaused: boolean; speed: number; onPlanetClick: (data: PlanetData) => void; controlsRef: any; onPlanetPositionUpdate?: (name: string, position: THREE.Vector3) => void; category?: string; sunSize?: number; portalKey?: number; isAnimating?: boolean; showBelt?: boolean; discMode?: boolean; onDiscToggle?: () => void }) {
  const { camera } = useThree();
  const [showPortal, setShowPortal] = useState(portalKey ? true : false);

  useEffect(() => {
    if (portalKey) {
      setShowPortal(true);
    }
  }, [portalKey]);

  // ── Stratified Orbital Disc: all categories as concentric rings at once.
  // The toggle lives here rather than in a settings panel because this is the
  // only place that knows a disc rendering is available for this data.
  if (discMode) {
    return (
      <>
        <StratifiedOrbitalDisc
          planets={planets}
          isPaused={isPaused}
          speed={speed}
          onPlanetClick={onPlanetClick}
        />
        <DreiOrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          minDistance={20}
          maxDistance={400}
          autoRotate={false}
          target={[0, 0, 0]}
        />
        <Html position={[-70, 0, 0]} center distanceFactor={180}>
          <button
            onClick={onDiscToggle}
            className="whitespace-nowrap rounded-lg border border-[var(--ws-border-strong)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            Classic orbits
          </button>
        </Html>
      </>
    );
  }

  return (
    <>
      {onDiscToggle && planets.length > 0 && (
        <Html position={[70, 0, 0]} center distanceFactor={180}>
          <button
            onClick={onDiscToggle}
            className="whitespace-nowrap rounded-lg border border-[var(--ws-border-strong)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
          >
            Orbital disc
          </button>
        </Html>
      )}
      {showPortal && (
        <PortalRing
          key={portalKey}
          sunColor={SUN_CONFIGS[category]?.color || '#ffaa00'}
          onComplete={() => setShowPortal(false)}
        />
      )}
      <WarpLines active={!!isAnimating} />
      <Sun category={category} size={sunSize} />
      {planets.filter((p) => p && p.name && (p.category || p.color)).map((planetData) => (<OrbitPath key={`orbit-${planetData.name}`} planet={planetData} />))}
      {planets.filter((p) => { if (!p) return false; if (!p.name) return false; if (!p.category && !p.color) return false; return true; }).map((planetData) => (<TexturedPlanet key={planetData.name} data={planetData} isPaused={isPaused} speedMultiplier={speed} onClick={onPlanetClick} onPositionUpdate={onPlanetPositionUpdate} />))}
      {showBelt && <AsteroidBelt radius={45} count={400} isPaused={isPaused} camera={camera} />}
      {showBelt && <AsteroidBelt radius={75} count={300} isPaused={isPaused} camera={camera} />}
      <Starfield />
      <Stars radius={300} depth={80} count={400} factor={2} fade speed={0.05} saturation={0.5} />
      <DreiOrbitControls ref={controlsRef} enablePan={true} enableZoom={true} minDistance={8} maxDistance={200} autoRotate={!isPaused} autoRotateSpeed={0.06} target={[0, 0, 0]} />
    </>
  );
}

// Generate trail positions helper
function generateTrailPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 2 + i * 0.4;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle * 0.5) * 0.3;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  return positions;
}

// Trail particles component
export function SystemTrail({ color, positions }: { color: string; positions: Float32Array }) {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={30}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.8}
        color={color}
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Galaxy View Component - shows TWO galaxies: Apps (blue/purple) and Websites (cyan/violet)
export function GalaxyView({ 
  appSolarSystems, 
  websiteSolarSystems,
  appSunConfigs,
  websiteSunConfigs,
  defaultSunConfig,
  galaxyType,
  onSelectSystem, 
  viewMode,
  animationSpeed,
  perfMode = 'balanced',
}: { 
  appSolarSystems: { category: string; totalTime: number; sunSize: number }[];
  websiteSolarSystems: { category: string; totalTime: number; sunSize: number }[];
  appSunConfigs: Record<string, { color: string; emissive: string; sizeRange: [number, number] }>;
  websiteSunConfigs: Record<string, { color: string; emissive: string; sizeRange: [number, number] }>;
  defaultSunConfig: { color: string; emissive: string; sizeRange: [number, number] };
  galaxyType: 'apps' | 'websites';
  onSelectSystem: (category: string) => void; 
  viewMode: string;
  animationSpeed: AnimationSpeed;
  perfMode?: string;
}) {
  const appsGroupRef = useRef<THREE.Group>(null!);
  const websitesGroupRef = useRef<THREE.Group>(null!);
  // Fix 2: label refs for constant-screen-size scaling (both galaxies render simultaneously,
  // so keys must be galaxy-scoped to avoid category collisions between apps & websites)
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const systemGroups = useRef<Record<string, THREE.Group | null>>({});
  const labelWorldPos = useMemo(() => new THREE.Vector3(), []);
  
  // Apps galaxy position: (0, 0, 0)
  // Websites galaxy position: (3250, 0, 0) - 5x galaxy widths apart
  const APPS_GALAXY_POS: [number, number, number] = [0, 0, 0];
  const WEBSITES_GALAXY_POS: [number, number, number] = [3250, 0, 0];
  
  // Generate trail positions
  const appTrailPositions = useMemo(() => 
    appSolarSystems.map(() => generateTrailPositions(30)), 
  [appSolarSystems]);
  
  const websiteTrailPositions = useMemo(() => 
    websiteSolarSystems.map(() => generateTrailPositions(30)), 
  [websiteSolarSystems]);
  
  // Galaxy rotation speeds based on animationSpeed setting
  const rotationSpeeds: Record<AnimationSpeed, { apps: number; websites: number }> = {
    slow: { apps: 0.00005, websites: 0.00004 },
    normal: { apps: 0.00015, websites: 0.00012 },
    instant: { apps: 0, websites: 0 },
  };
  
  useFrame((state) => {
    if (viewMode === 'galaxy') {
      const speeds = rotationSpeeds[animationSpeed] || rotationSpeeds.normal;
      // Each galaxy rotates around its own center at different speeds
      if (appsGroupRef.current) {
        appsGroupRef.current.rotation.y += speeds.apps;
      }
      if (websitesGroupRef.current) {
        websitesGroupRef.current.rotation.y += speeds.websites;
      }
    }
    // Fix 2: constant-screen-size labels — scale each label to compensate for camera distance
    for (const key of Object.keys(systemGroups.current)) {
      const group = systemGroups.current[key];
      const label = labelRefs.current[key];
      if (!group || !label) continue;
      group.getWorldPosition(labelWorldPos);
      const dist = state.camera.position.distanceTo(labelWorldPos);
      const scale = Math.min(1.8, Math.max(0.6, 220 / dist));
      const current = parseFloat(label.dataset.scale || '0');
      if (Math.abs(current - scale) > 0.01) {
        label.dataset.scale = String(scale);
        label.style.transform = `scale(${scale})`;
      }
    }
  });
  
  // Seeded random function for stable positions
  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // Calculate positions in a scattered radial pattern within galaxy bounds
  const getSystemPosition = (index: number, total: number, offsetX: number = 0): [number, number, number] => {
    // Use golden angle distribution for more natural, scattered look
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399 radians
    const radiusScale = 180; // Maximum radius within galaxy (galaxy dust cloud radius is ~280)
    
    // Distribute using golden spiral for even but random-looking coverage
    const angle = index * goldenAngle;
    // Use sqrt for more central concentration (like real galaxies)
    const normalizedIdx = total > 1 ? index / (total - 1) : 0.5;
    const radius = Math.sqrt(normalizedIdx) * radiusScale * (0.3 + seededRandom(index * 4) * 0.4);
    
    // Add some offset for more natural scattering (seeded for stability)
    const jitterX = (seededRandom(index * 4 + 1) - 0.5) * 40;
    const jitterY = (seededRandom(index * 4 + 2) - 0.5) * 20;
    const jitterZ = (seededRandom(index * 4 + 3) - 0.5) * 40;
    
    return [
      Math.cos(angle) * radius + jitterX + offsetX,
      jitterY,
      Math.sin(angle) * radius + jitterZ,
    ];
  };
  
  // Render a single solar system with hover detection area
  const renderSolarSystem = (
    system: typeof appSolarSystems[0],
    idx: number,
    config: typeof appSunConfigs[string],
    trailPos: Float32Array,
    basePos: [number, number, number],
    scope: 'apps' | 'websites'
  ) => {
    const pos = getSystemPosition(idx, 0, 0); // Will be recalculated
    const brightness = Math.min(1, system.totalTime / 60);
    // Small sphere ~same visual weight as dust particles (size 2.5)
    const sphereSize = 1.2;
    const hitboxSize = sphereSize * 7;
    
    return (
      <group key={`solar-${system.category}`} position={basePos}>
        {/* Trail */}
        <SystemTrail color={config.color} positions={trailPos} />
        
        {/* Clickable hitbox - larger than visual for easier selection */}
        <mesh 
          onClick={(e) => {
            e.stopPropagation();
            onSelectSystem(system.category);
          }}
        >
          <sphereGeometry args={[hitboxSize, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        
        {/* Visual core sphere - small, like a bright star cluster.
            Also clickable (both sphere AND label open the system —
            previously only the label did in the websites galaxy) */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelectSystem(system.category);
          }}
        >
          <sphereGeometry args={[sphereSize, 16, 16]} />
          <meshBasicMaterial
            color={config.color}
            toneMapped={false}
          />
        </mesh>
        
        {/* Soft glow aura */}
        <sprite scale={[sphereSize * 5, sphereSize * 5, 1]}>
          <spriteMaterial
            color={config.color}
            transparent
            opacity={0.35 * (0.6 + brightness * 0.4)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
        
        {/* Fix 2: Constant-screen-size label — scaled per-frame by camera distance,
            glass chip styling (no distanceFactor scaling, no backdrop-filter) */}
        <group ref={(el) => { if (el) systemGroups.current[`${scope}__${system.category}`] = el; }}>
          <group position={[0, sphereSize * 3, 0]}>
            <Html center zIndexRange={[40, 0]}>
              <div
                ref={(el) => { if (el) labelRefs.current[`${scope}__${system.category}`] = el; }}
                className="px-3 py-1.5 rounded-lg text-white font-bold whitespace-nowrap cursor-pointer select-none"
                onClick={() => onSelectSystem(system.category)}
                title={`Open ${system.category}`}
                style={{
                  pointerEvents: 'auto',
                  fontSize: '13px',
                  background: 'rgba(8, 8, 24, 0.85)',
                  border: `1.5px solid ${config.color}66`,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  transformOrigin: 'center center',
                  willChange: 'transform',
                }}
              >
                {system.category}
              </div>
            </Html>
          </group>
        </group>
      </group>
    );
  };
  
    return (
    <>
      {/* Apps Galaxy (Blue/Purple theme) */}
      <group ref={appsGroupRef} position={APPS_GALAXY_POS}>
        <GalaxyDustCloud perfMode={perfMode} />
        {appSolarSystems.map((system, idx) => {
          const config = appSunConfigs[system.category] || DEFAULT_SUN_CONFIG;
          const pos = getSystemPosition(idx, appSolarSystems.length, 0);
          return renderSolarSystem(system, idx, config, appTrailPositions[idx], [pos[0], pos[1], pos[2]], 'apps');
        })}
      </group>
      
      {/* Websites Galaxy (Cyan/Violet theme - Electric Nebula) */}
      <group ref={websitesGroupRef} position={WEBSITES_GALAXY_POS}>
        <WebsiteGalaxyDustCloud perfMode={perfMode} />
        {websiteSolarSystems.map((system, idx) => {
          const config = websiteSunConfigs[system.category] || DEFAULT_WEBSITE_SUN_CONFIG;
          const pos = getSystemPosition(idx, websiteSolarSystems.length, 0);
          return renderSolarSystem(system, idx, config, websiteTrailPositions[idx], [pos[0], pos[1], pos[2]], 'websites');
        })}
      </group>
    </>
  );
}

// Category Sidebar Panel - shows stats when solar system is selected in galaxy view
export function CategorySidebar({ 
  system, 
  onClose, 
  onEnter,
  onPlanetClick,
}: { 
  system: { category: string; planets: PlanetData[]; totalTime: number; sunSize: number };
  onClose: () => void;
  onEnter: () => void;
  onPlanetClick: (planet: PlanetData) => void;
}) {
  if (!system) return null;
  
  const hours = Math.floor(system.totalTime / 3600);
  const mins = Math.floor((system.totalTime % 3600) / 60);
  const config = SUN_CONFIGS[system.category] || DEFAULT_SUN_CONFIG;
  
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        className="absolute top-4 right-4 w-72 glass rounded-xl p-5 z-[var(--z-overlay)] border border-white/10 max-h-[560px] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-zinc-400 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ 
              background: `radial-gradient(circle, ${config.color}44, transparent)`,
              border: `2px solid ${config.color}`
            }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.color }} />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight">{system.category}</div>
            <div className="text-xs text-zinc-500">Solar System</div>
          </div>
        </div>
        
        <div className="space-y-3 border-t border-zinc-800 pt-3 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 flex items-center gap-2"><Clock className="w-3.5 h-3.5" />Total Time</span>
            <span className="font-mono text-lg text-white">{hours}h {mins}m</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Planets</span>
            <span className="font-mono text-lg text-emerald-400">{system.planets.length}</span>
          </div>
        </div>
        
        <div className="border-t border-zinc-800 pt-3">
          <div className="text-xs text-zinc-500 mb-2">Planets / Apps</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {system.planets.map((p, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-800/50 cursor-pointer group"
                onClick={() => onPlanetClick(p)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-xs text-zinc-300 group-hover:text-white">{p.name}</span>
                </div>
                <span className="text-[10px] text-zinc-500">
                    {Math.floor(p.time / 3600) > 0 ? `${Math.floor(p.time / 3600)}h ` : ''}
                    {Math.floor((p.time % 3600) / 60)}m
                  </span>
              </div>
            ))}
          </div>
        </div>
        
        <button
          onClick={onEnter}
          className="w-full mt-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition text-sm font-medium border border-indigo-500/30"
        >
          Enter Solar System →
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// Category Dropdown - collapsible on left side
// Shows all categories that exist in both settings AND planet data
export function CategoryDropdown({ 
  currentCategory, 
  onSelect,
  isExpanded,
  onToggle,
  additionalCategories = [],
}: { 
  currentCategory: string;
  onSelect: (cat: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  additionalCategories?: string[];
}) {
  // Get categories from settings
  const settingsCategories = getCategoryListFromSettings();
  // Combine settings categories with any additional categories from data
  const allCategories = [...new Set([...settingsCategories, ...additionalCategories])];
  
  return (
    <div className="relative z-20">
      <button
        onClick={onToggle}
        className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium hover:text-white transition"
      >
        <span className="text-zinc-300">{currentCategory}</span>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-2 glass rounded-xl py-2 min-w-[160px] shadow-xl border border-zinc-700"
        >
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`w-full px-4 py-2 text-left text-xs transition flex items-center gap-2 ${
                currentCategory === cat 
                  ? 'bg-indigo-500/20 text-indigo-300' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: SUN_CONFIGS[cat]?.color || '#888' }} 
              />
              {cat}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Collapsible Planet Legend
export function PlanetLegend({ 
  planets, 
  isExpanded, 
  onToggle, 
  onPlanetClick,
  showCategoryHeaders = true,
  allCategories = [],
}: { 
  planets: PlanetData[];
  isExpanded: boolean;
  onToggle: () => void;
  onPlanetClick: (planet: PlanetData) => void;
  showCategoryHeaders?: boolean;
  allCategories?: { category: string; totalTime: number; planets: PlanetData[] }[];
}) {
  const totalPlanets = planets.length;
  const totalTime = planets.reduce((sum, p) => sum + p.time, 0);
  const hours = Math.floor(totalTime / 3600);
  const mins = Math.floor((totalTime % 3600) / 60);
  
  // Group by category
  const groupedPlanets = useMemo(() => {
    const groups: Record<string, PlanetData[]> = {};
    for (const p of planets) {
      const cat = p.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [planets]);
  
  // Use dynamic categories from settings
  const settingsCategories = getCategoryListFromSettings();
  const allCategoriesFromData = [...new Set([...settingsCategories, ...Object.keys(groupedPlanets)])];
  const categoryOrder = allCategoriesFromData.filter(c => groupedPlanets[c]?.length > 0);
  
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 bg-zinc-950/95 border-t border-zinc-800 flex items-center justify-between text-xs hover:bg-zinc-900/95 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-300 font-medium">
            {showCategoryHeaders ? 'All Categories' : 'Planets'}: {totalPlanets} apps
          </span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400">{hours}h {mins}m total</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>
      
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-950/98 border-t border-zinc-800 max-h-48 overflow-y-auto px-4 py-3"
        >
          <div className="space-y-3">
            {categoryOrder.map(cat => (
              <div key={cat}>
                {showCategoryHeaders && (
                  <div className="text-xs text-zinc-500 mb-1">{cat}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  {groupedPlanets[cat]?.map((p, i) => (
                    <div 
                      key={i}
                      onClick={() => onPlanetClick(p)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900/50 hover:bg-zinc-800 cursor-pointer group"
                    >
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs text-zinc-400 group-hover:text-white">{p.name}</span>
                      <span className="text-[10px] text-zinc-600">{formatDurationSeconds(p.time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
// ── Main OrbitScene wrapper ──
// Presentational only: ALL data/derived state is owned by the orchestrator in
// OrbitSystem.tsx and handed down as props. The two `useState` calls below are
// pure view-local UI toggles with no data meaning (dropdown open, stats expanded).
export interface OrbitSceneProps {
  isPaused: boolean; setIsPaused: (v: boolean) => void;
  speed: number; setSpeed: (v: number) => void; speedOptions: number[];
  selectedPlanet: PlanetData | null; setSelectedPlanet: (p: PlanetData | null) => void;
  textureRefreshKey: number; setTextureRefreshKey: (k: number) => void;
  viewMode: 'galaxy' | 'solarSystem'; setViewMode: (v: 'galaxy' | 'solarSystem') => void;
  galaxyType: 'apps' | 'websites'; setGalaxyType: (v: 'apps' | 'websites') => void;
  perfMode: 'high' | 'balanced' | 'performance'; setPerfMode: (v: 'high' | 'balanced' | 'performance') => void;
  isVisible: boolean;
  cameraPosRef: React.MutableRefObject<[number, number, number]>;
  fpsDisplayRef: React.MutableRefObject<HTMLDivElement | null>;
  fpsHistoryRef: React.MutableRefObject<number[]>;
  currentCategory: string; setCurrentCategory: (c: string) => void;
  selectedPeriod: 'today' | 'week' | 'month' | 'all'; setSelectedPeriod: (p: 'today' | 'week' | 'month' | 'all') => void;
  activePeriod: 'today' | 'week' | 'month' | 'all';
  selectedSystem: any; setSelectedSystem: (s: any) => void;
  legendExpanded: boolean; setLegendExpanded: (v: boolean) => void;
  showPerf: boolean; setShowPerf: (v: boolean) => void;
  showInfo: boolean; setShowInfo: (v: boolean) => void;
  minTimeFilter: number; setMinTimeFilter: (v: number) => void;
  searchQuery: string; setSearchQuery: (v: string) => void;
  animationSpeed: AnimationSpeed;
  controlsRef: React.MutableRefObject<any>;
  trackedPlanetRef: React.MutableRefObject<string | null>;
  isAnimatingRef: React.MutableRefObject<boolean>;
  portalKey: number; setPortalKey: (k: number) => void;
  planetPositionsRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
  isMountedRef: React.MutableRefObject<boolean>;
  appSolarSystems: any[]; websiteSolarSystems: any[]; solarSystems: any[];
  currentSunConfigs: Record<string, { color: string; emissive: string; sizeRange: [number, number] }>;
  defaultSunConfig: { color: string; emissive: string; sizeRange: [number, number] };
  planets: PlanetData[]; allPlanets: PlanetData[]; planetCategories: string[];
  currentSunSize: number; onSwitchToGalaxy: (t: 'apps' | 'websites') => void;
  onPlanetPointerDown: (p: PlanetData) => void; onPlanetPointerUp: (p: PlanetData) => void;
  onPlanetClick: (p: PlanetData) => void; onSelectSystem: (c: string) => void;
  onEnterSystem: () => void; onCloseSystem: () => void;
  onZoomOut: () => void; onRefreshTextures: () => void;
  onCategorySelect: (c: string) => void; onFocusPlanet: (p: PlanetData) => void;
  onPeriodChange?: (p: 'today' | 'week' | 'month' | 'all') => void;
  animateCamera: (pos: THREE.Vector3, look: THREE.Vector3, dur: number, done?: () => void) => void;
  handlePlanetPositionUpdate: (name: string, pos: THREE.Vector3) => void;
}

export function OrbitScene(props: OrbitSceneProps) {
  // Stratified Orbital Disc on/off. `false` keeps the classic solar system, so
  // the previous view is never deleted — it is one click away, which is also how
  // CZ can A/B them without a rebuild.
  const [discMode, setDiscMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('deskflow-orbit-disc') === '1';
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('deskflow-orbit-disc', discMode ? '1' : '0'); } catch { /* ignore */ }
  }, [discMode]);
  const onDiscToggle = useCallback(() => setDiscMode((m) => !m), []);
  const {
    isPaused, setIsPaused, speed, setSpeed, speedOptions,
    selectedPlanet, setSelectedPlanet, textureRefreshKey,
    viewMode, setViewMode, galaxyType, perfMode, setPerfMode, isVisible,
    cameraPosRef, fpsDisplayRef, fpsHistoryRef,
    currentCategory, setCurrentCategory, selectedPeriod, setSelectedPeriod, activePeriod,
    selectedSystem, setSelectedSystem, legendExpanded, setLegendExpanded,
    showPerf, setShowPerf, showInfo, setShowInfo,
    minTimeFilter, setMinTimeFilter, searchQuery, setSearchQuery, animationSpeed,
    controlsRef, trackedPlanetRef, isAnimatingRef, portalKey, planetPositionsRef,
    appSolarSystems, websiteSolarSystems, solarSystems, defaultSunConfig,
    planets, allPlanets, planetCategories, currentSunSize, onSwitchToGalaxy,
    onPlanetClick, onSelectSystem, onEnterSystem, onCloseSystem,
    onZoomOut, onRefreshTextures, onCategorySelect, onFocusPlanet, onPeriodChange,
    handlePlanetPositionUpdate,
  } = props;

  // View-local UI toggles (no data meaning, so they belong here not in the orchestrator).
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [perfExpanded, setPerfExpanded] = useState(false);

  return (
    <div className="relative w-full h-full rounded-none overflow-visible flex flex-col">
      {/* Galaxy type indicator - shows which galaxy user is viewing */}
      <div className="absolute top-4 left-4 z-20">
        <div className={`text-xs font-semibold tracking-wider px-3 py-1.5 rounded-lg border ${
          galaxyType === 'apps'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
        }`}>
          {galaxyType === 'apps' ? 'APPS GALAXY' : 'WEBSITES GALAXY'}
        </div>
      </div>

      {/* Filter & Search bar — solar-system view only */}
      {viewMode === 'solarSystem' && (
        <div className="absolute top-16 left-4 z-20 flex flex-col gap-2">
          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search planets..."
              className="bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none w-28"
            />
          </div>
          <div className="glass rounded-xl px-3 py-2 flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">Min time</span>
              <span className="text-zinc-400 font-mono">{formatDurationSeconds(minTimeFilter)}</span>
            </div>
            <input
              type="range" min={0} max={36000} step={300}
              value={minTimeFilter}
              onChange={(e) => setMinTimeFilter(Number(e.target.value))}
              className="w-full h-1"
            />
          </div>
        </div>
      )}

      {/* Control buttons - below filter/search */}
      <div className="absolute top-16 left-4 z-20 flex flex-col gap-2" style={{ marginTop: viewMode === 'solarSystem' ? '110px' : '0px' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSwitchToGalaxy(galaxyType === 'apps' ? 'websites' : 'apps')}
            className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition ${
              galaxyType === 'apps' ? 'text-blue-400 hover:text-blue-300' : 'text-cyan-400 hover:text-cyan-300'
            }`}
            title={galaxyType === 'apps' ? 'Switch to Websites Galaxy' : 'Switch to Apps Galaxy'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            {galaxyType === 'apps' ? 'Web' : 'Apps'}
          </button>

          {viewMode === 'solarSystem' && (
            <button onClick={onZoomOut} className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Galaxy
            </button>
          )}
          <CategoryDropdown
            currentCategory={currentCategory}
            onSelect={onCategorySelect}
            isExpanded={categoryDropdownOpen}
            onToggle={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            additionalCategories={planetCategories}
          />
        </div>

        {/* Timeline / Period Selector */}
        <div className="flex items-center gap-1 self-start">
          {(['today', 'week', 'month', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setSelectedPeriod(p); onPeriodChange?.(p); }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${
                activePeriod === p ? 'bg-indigo-500/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowPerf(!showPerf)}
          className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition self-start ${
            showPerf ? 'text-emerald-400 bg-emerald-500/20' : 'hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />Perf
        </button>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition self-start ${
            showInfo ? 'text-cyan-400 bg-cyan-500/20' : 'hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          Info
        </button>

        {/* FPS Stats panel */}
        {showPerf && (
          <div className="glass rounded-xl px-3 py-2 text-xs font-mono space-y-2 w-[200px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span ref={fpsDisplayRef} className="text-emerald-400">-- FPS</span>
              </div>
              <button onClick={() => setPerfExpanded(!perfExpanded)} className="text-zinc-500 hover:text-white transition">
                {perfExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <FPSLineGraph fpsHistoryRef={fpsHistoryRef} width={176} height={48} />

            {/* Stage 0 (perf): per-subsystem attribution. Same panel, one display
                layer — the counters and the strip read the same probe, so there
                is never a disagreement between what the graph shows and what the
                numbers say. */}
            <div className="border-t border-zinc-700 pt-2 mt-2">
              <PerfStrip
                open={perfExpanded}
                onToggle={() => setPerfExpanded(!perfExpanded)}
                tier={perfMode}
              />
            </div>

            {/* Graphics Quality — persisted segmented control */}
            <div className="border-t border-zinc-700 pt-2 mt-2">
              <div className="flex items-center gap-1.5 mb-1.5 text-zinc-400">
                <Gauge className="w-3 h-3 text-indigo-400" /><span>Graphics Quality</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['high', 'balanced', 'performance'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setPerfMode(q)}
                    className={`px-1.5 py-1 rounded-md text-[10px] font-medium transition ${
                      perfMode === q ? 'bg-indigo-500/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                    title={q === 'high' ? 'Max particles, MSAA 4x, Bloom' : q === 'balanced' ? 'Balanced quality & performance' : 'Reduced particles, no Bloom'}
                  >
                    {q === 'high' ? 'High' : q === 'performance' ? 'Low' : 'Balanced'}
                  </button>
                ))}
              </div>
            </div>

            {perfExpanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2 mt-2 border-t border-zinc-700 space-y-1">
                <div className="flex justify-between text-zinc-400"><span>GPU</span><span className="text-zinc-300">--</span></div>
                <div className="flex justify-between text-zinc-400"><span>Memory</span><span className="text-zinc-300">--</span></div>
                <div className="flex justify-between text-zinc-400">
                  <span>Frame Time</span>
                  <span ref={(el) => {
                    if (el && fpsDisplayRef.current) {
                      el.textContent = fpsDisplayRef.current.getAttribute('data-frame-time') || '--ms';
                    }
                  }}>--ms</span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Info Panel - Planet Physics Explanation */}
        {showInfo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass rounded-xl px-3 py-3 text-xs space-y-2 w-[220px]">
            <div className="text-cyan-400 font-semibold border-b border-zinc-700 pb-2 mb-2">Planet Physics Guide</div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-zinc-400">Planet Size</span><span className="text-zinc-300">= Total Usage Time</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Orbit Distance</span><span className="text-zinc-300">= ln(time) scaling</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Orbit Speed</span><span className="text-zinc-300">Further = Slower!</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Moons</span><span className="text-zinc-300">= Projects</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Rings</span><span className="text-zinc-300">~40% chance</span></div>
            </div>
            <div className="border-t border-zinc-700 pt-2 mt-2">
              <div className="text-zinc-500 text-[10px]">Planets scaled with cube root to prevent extreme values</div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Canvas sized by R3F itself (resize={{ offsetSize: true }}). A manual
          ResizeObserver here RACES R3F's gl.setSize: it writes the backing store
          with an unclamped dpr AFTER R3F set its viewport, so the GL viewport stays
          smaller than the CSS box -> scene shrinks into the top-left with gaps and
          Html labels mis-project. */}
      <div className="w-full flex-1 bg-transparent">
        {(() => {
          try {
            return (
              <Canvas
                resize={{ scroll: false, offsetSize: true }}
                style={{ width: '100%', height: '100%' }}
                key={`canvas-${textureRefreshKey}-${perfMode}`}
                camera={{ position: viewMode === 'galaxy' ? (galaxyType === 'websites' ? [3250, 100, 200] : [0, 100, 200]) : [0, 100, 180], fov: 45, near: 0.1, far: 10000 }}
                onCreated={({ gl }) => {
                  gl.setClearColor('#0a0a14', 0);
                  // Stage 0 (perf): `autoReset = false` is REQUIRED for
                  // `renderer.info` to be readable at all under EffectComposer —
                  // the composer issues several `render()` calls per frame and the
                  // auto-reset would leave only the last pass's counters. One
                  // reader (PerfSampler, priority 0) then owns the reset.
                  perfProbe.install(gl as never);
                }}
                gl={{
                  powerPreference: 'high-performance',
                  antialias: perfMode === 'high',
                  alpha: false,
                  stencil: false,
                  depth: true,
                  preserveDrawingBuffer: false,
                }}
                dpr={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, perfMode === 'performance' ? 1 : 1.5)}
                frameloop={isVisible ? 'always' : 'demand'}
              >
                <PerformanceMonitor
                  onDecline={() => {
                    if (perfMode === 'high') setPerfMode('balanced');
                    else if (perfMode === 'balanced') setPerfMode('performance');
                  }}
                >
                  <GLCleanup />
                  <color attach="background" args={['#0a0a14']} />
                  <fog attach="fog" args={['#0a0a14', 1500, 4500]} />

                  {/* Space Lighting - balanced so planets at orbit ~220 stay visible */}
                  <ambientLight intensity={0.13} color="#3a4a6e" />
                  <hemisphereLight args={['#b8d0f0', '#10131c', 0.18]} />
                  <pointLight position={[0, 0, 0]} intensity={8} color="#ffdd99" distance={400} decay={1.0} />
                  <directionalLight position={[-80, -20, -60]} intensity={0.4} color="#cfe0ff" />

                  <EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>
                    {/* EffectComposer types `children` as `JSX.Element | JSX.Element[]`,
                        which does not admit the `null` a conditional guard produces, so
                        each slot is type-checked in isolation and any conditional child
                        fails. Collecting the effects into one array and casting once is
                        sound: React never reconciles a `null` child, so it never reaches
                        the `__r3f.children` walk that builds the passes, and R3F
                        flattens the array exactly as it would sibling JSX. */}
                    {([
                      perfMode !== 'performance'
                        ? <Bloom key="bloom" intensity={1.6} luminanceThreshold={0.4} luminanceSmoothing={0.5} radius={0.8} mipmapBlur />
                        : null,
                      <ToneMapping key="tone" mode={ToneMappingMode.ACES_FILMIC} />,
                      perfMode !== 'performance'
                        ? <Vignette key="vignette" offset={0.25} darkness={0.5} blendFunction={BlendFunction.NORMAL} />
                        : null,
                    ].filter(Boolean) as React.ReactElement[])}
                  </EffectComposer>

                  {showPerf && <FPSCounter fpsDisplayRef={fpsDisplayRef} fpsHistoryRef={fpsHistoryRef} />}
                  {/* Stage 0 (perf): the single privileged reader of renderer.info,
                      mounted at priority 0 so it runs before the composer's
                      priority-1 render. The 500 ms flush publishes to the strip. */}
                  <PerfSampler />
                  <PerfFlush />

                  {viewMode === 'galaxy' ? (
                    <>
                      <GalaxyView
                        appSolarSystems={appSolarSystems}
                        websiteSolarSystems={websiteSolarSystems}
                        appSunConfigs={SUN_CONFIGS}
                        websiteSunConfigs={WEBSITE_SUN_CONFIGS}
                        defaultSunConfig={defaultSunConfig}
                        galaxyType={galaxyType}
                        onSelectSystem={onSelectSystem}
                        viewMode={viewMode}
                        animationSpeed={animationSpeed}
                        perfMode={perfMode}
                      />
                      <CameraTracker cameraPosRef={cameraPosRef} />
                      <Stars radius={5000} depth={250} count={5000} factor={7} fade speed={0.08} saturation={0.6} />
                      <DreiOrbitControls
                        ref={controlsRef}
                        enablePan enableZoom
                        minDistance={50} maxDistance={5000} autoRotate={false}
                        target={galaxyType === 'websites' ? [3250, 0, 0] : [0, 0, 0]}
                      />
                    </>
                  ) : (
                    <>
                      <SolarSystemScene
                        planets={discMode ? allPlanets : planets}
                        isPaused={isPaused}
                        speed={speed}
                        onPlanetClick={onPlanetClick}
                        controlsRef={controlsRef}
                        onPlanetPositionUpdate={handlePlanetPositionUpdate}
                        category={currentCategory}
                        sunSize={currentSunSize}
                        portalKey={portalKey}
                        isAnimating={isAnimatingRef.current}
                        showBelt={true}
                        discMode={discMode}
                        onDiscToggle={onDiscToggle}
                      />
                      <PlanetTracker
                        controlsRef={controlsRef}
                        planetPositionsRef={planetPositionsRef}
                        trackedPlanetRef={trackedPlanetRef}
                        cameraPosRef={cameraPosRef}
                        isAnimatingRef={isAnimatingRef}
                      />
                    </>
                  )}
                </PerformanceMonitor>
              </Canvas>
            );
          } catch (e) {
            console.error('[OrbitSystem] Canvas render error:', e);
            return (
              <div className="h-[600px] flex items-center justify-center bg-zinc-900/50 rounded-xl">
                <div className="text-zinc-400">3D visualization error. Check console for details.</div>
              </div>
            );
          }
        })()}
      </div>

      {/* Friendly empty state - never a silent blank view */}
      {viewMode === 'solarSystem' && planets.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-xl px-6 py-5 flex flex-col items-center gap-3 text-center max-w-xs pointer-events-auto">
            <SatelliteDish className="w-8 h-8 text-indigo-400" />
            <div className="text-sm text-zinc-300 font-medium">No activity here yet</div>
            <div className="text-xs text-zinc-500 leading-relaxed">
              Nothing was tracked in this category for the selected period. Pick another category or head back to the galaxy.
            </div>
            <button
              onClick={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; setViewMode('galaxy'); }}
              className="mt-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition"
            >
              Back to galaxy
            </button>
          </div>
        </div>
      )}

      {/* Category sidebar - when system selected in galaxy view */}
      {selectedSystem && viewMode === 'galaxy' && (
        <CategorySidebar
          system={selectedSystem}
          onClose={onCloseSystem}
          onEnter={onEnterSystem}
          onPlanetClick={(p) => { onPlanetClick(p); setSelectedSystem(null); }}
        />
      )}

      <PlanetDetailPanel
        planet={selectedPlanet}
        onClose={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; }}
      />

      {/* Controls overlay - top-right */}
      <div className="absolute top-4 right-4 z-10">
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-3">
          <button onClick={() => setIsPaused(!isPaused)} className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition">
            <Play className="w-3.5 h-3.5" />{isPaused ? 'Resume' : 'Pause'}
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          <button
            onClick={onRefreshTextures}
            className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition"
            title="Reset camera"
          >
            <RotateCcw className="w-3.5 h-3.5" />Reset
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          <button onClick={onRefreshTextures} className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition" title="Refresh textures">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          {speedOptions.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs transition ${speed === s ? 'bg-indigo-500/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Planet Legend - bottom */}
      <PlanetLegend
        planets={viewMode === 'solarSystem' ? planets : allPlanets}
        isExpanded={legendExpanded}
        onToggle={() => setLegendExpanded(!legendExpanded)}
        onPlanetClick={onFocusPlanet}
        showCategoryHeaders={true}
        allCategories={solarSystems}
      />

      {viewMode === 'galaxy' && (
        <div className="absolute bottom-24 left-0 right-0 text-center">
          <div className="text-xs text-zinc-500">Click a solar system to explore • Drag to rotate • Scroll to zoom</div>
        </div>
      )}
    </div>
  );
}

// Back-compat alias: the barrel historically re-exported an `OrbitSystem` from
// this module. Nothing imports it (DashboardPage imports the orchestrator at
// ../OrbitSystem), but index.ts re-exports the name, so keep it resolvable.
export const OrbitSystem = OrbitScene;

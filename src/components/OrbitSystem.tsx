import { useState, useMemo, useRef, useEffect } from 'react';
import {
  OrbitScene, OrbitSystem, GalaxyView, CategorySidebar, CategoryDropdown,
  PlanetLegend, PlanetDetailPanel, CameraTracker, PlanetTracker,
  SolarSystemScene, GLCleanup, FPSCounter, FPSLineGraph, Stars
} from './orbit';
import {
  computeSolarSystems, computeWebsiteSolarSystems, computePlanets, computeWebsitePlanets,
  filterLogsByPeriod, formatDurationSeconds, getCategoryListFromSettings
} from './orbit/PlanetUtils';
import type { PlanetData, ActivityLog } from './orbit/PlanetUtils';

type AnimationSpeed = 'slow' | 'normal' | 'instant';
const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = { slow: 2500, normal: 1200, instant: 0 };
const VIVID_PALETTE = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16', '#e879f9', '#22d3ee'];
const CATEGORY_COLOR_FAMILIES: Record<string, string[]> = {
  'IDE': ['#6366f1', '#8b5cf6', '#7c3aed'], 'AI Tools': ['#8b5cf6', '#a78bfa', '#c084fc'],
  'Browser': ['#3b82f6', '#06b6d4', '#22d3ee'], 'Entertainment': ['#ec4899', '#f43f5e', '#f97316'],
  'Communication': ['#14b8a6', '#06b6d4', '#10b981'], 'Design': ['#a855f7', '#e879f9', '#ec4899'],
  'Productivity': ['#10b981', '#84cc16', '#22c55e'], 'Tools': ['#f59e0b', '#f97316', '#fb923c'],
  'Other': ['#64748b', '#94a3b8', '#78716c'],
};
const ORBIT_CONFIG = { minOrbitRadius: 10, maxOrbitRadius: 110, spacingExponent: 0.8, baseAngularSpeed: 2.0, minAngularSpeed: 0.08 };
const SUN_CONFIGS: Record<string, { color: string; emissive: string; sizeRange: [number, number] }> = {
  'IDE': { color: '#ffaa33', emissive: '#ff8800', sizeRange: [4, 5.5] }, 'AI Tools': { color: '#aa66ff', emissive: '#8833ff', sizeRange: [4, 5.5] },
  'Browser': { color: '#44aaff', emissive: '#2299ff', sizeRange: [4, 5.5] }, 'Entertainment': { color: '#ff44aa', emissive: '#ff3399', sizeRange: [4, 5.5] },
  'Communication': { color: '#33ccaa', emissive: '#22aa88', sizeRange: [4, 5.5] }, 'Design': { color: '#ff66aa', emissive: '#ff4499', sizeRange: [4, 5.5] },
  'Productivity': { color: '#ffeecc', emissive: '#ffdd99', sizeRange: [4, 5.5] }, 'Tools': { color: '#ff8833', emissive: '#ff6622', sizeRange: [4, 5.5] },
  'Other': { color: '#aaaaaa', emissive: '#888888', sizeRange: [4, 5.5] },
};
const DEFAULT_SUN_CONFIG = { color: '#ffcc44', emissive: '#ffaa22', sizeRange: [4, 5.5] as [number, number] };
const WEBSITE_SUN_CONFIGS: Record<string, { color: string; emissive: string; sizeRange: [number, number] }> = {
  'Social Media': { color: '#ff00ff', emissive: '#cc00cc', sizeRange: [4, 5.5] }, 'Entertainment': { color: '#ff44aa', emissive: '#cc3388', sizeRange: [4, 5.5] },
  'Productivity': { color: '#00ffaa', emissive: '#00cc88', sizeRange: [4, 5.5] }, 'Search Engine': { color: '#00ccff', emissive: '#0099cc', sizeRange: [4, 5.5] },
  'News': { color: '#aa66ff', emissive: '#8844cc', sizeRange: [4, 5.5] }, 'Shopping': { color: '#ffaa00', emissive: '#cc8800', sizeRange: [4, 5.5] },
  'Communication': { color: '#00ffff', emissive: '#00cccc', sizeRange: [4, 5.5] }, 'Education': { color: '#66ffff', emissive: '#44cccc', sizeRange: [4, 5.5] },
  'Developer Tools': { color: '#8866ff', emissive: '#6644cc', sizeRange: [4, 5.5] }, 'Uncategorized': { color: '#88aacc', emissive: '#6688aa', sizeRange: [4, 5.5] },
  'Other': { color: '#aabbcc', emissive: '#8899aa', sizeRange: [4, 5.5] },
};
const DEFAULT_WEBSITE_SUN_CONFIG = { color: '#00c6ff', emissive: '#0099cc', sizeRange: [4, 5.5] as [number, number] };
const MAX_RENDERED_PLANETS = 80;
const MIN_PLANET_TIME_SECONDS = 30;

interface ActivityLog { id: number; timestamp: Date; app: string; category: string; duration: number; title?: string; project?: string; is_browser_tracking?: boolean; domain?: string; url?: string; duration_ms?: number; }
interface OrbitSystemProps { logs: ActivityLog[]; websiteLogs?: ActivityLog[]; appColors?: Record<string, string>; categoryOverrides?: Record<string, string>; websiteColors?: Record<string, string>; websiteCategoryOverrides?: Record<string, string>; selectedPeriod?: 'today' | 'week' | 'month' | 'all'; onPeriodChange?: (period: 'today' | 'week' | 'month' | 'all') => void; }

export default function OrbitSystem({ logs, appColors, categoryOverrides, websiteLogs, websiteColors, websiteCategoryOverrides, selectedPeriod: externalPeriod, onPeriodChange }: OrbitSystemProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [textureRefreshKey, setTextureRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'galaxy' | 'solarSystem'>('galaxy');
  const [galaxyType, setGalaxyType] = useState<'apps' | 'websites'>('apps');
  const [perfMode, setPerfMode] = useState<'high' | 'balanced' | 'performance'>(() => { try { const stored = localStorage.getItem('deskflow-graphics-quality'); if (stored === 'high' || stored === 'balanced' || stored === 'performance') return stored; } catch {} return 'balanced'; });
  useEffect(() => { try { localStorage.setItem('deskflow-graphics-quality', perfMode); } catch {} }, [perfMode]);
  const [isVisible, setIsVisible] = useState(true);
  const cameraPosRef = useRef<[number, number, number]>([0, 100, 200]);
  const fpsDisplayRef = useRef<HTMLDivElement | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('Other');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const activePeriod = externalPeriod || selectedPeriod;
  const [selectedSystem, setSelectedSystem] = useState<any>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [minTimeFilter, setMinTimeFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [animationSpeed] = useState<AnimationSpeed>(() => { try { return (localStorage.getItem('deskflow-animation-speed') as AnimationSpeed) || 'normal'; } catch { return 'normal'; } });
  const controlsRef = useRef<any>(null);
  const trackedPlanetRef = useRef<string | null>(null);
  const isAnimatingRef = useRef(false);
  const [portalKey, setPortalKey] = useState(0);
  const planetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; planetPositionsRef.current.clear(); }; }, []);

  const filteredLogs = useMemo(() => externalPeriod ? logs || [] : filterLogsByPeriod(logs, activePeriod), [logs, activePeriod, externalPeriod]);
  const filteredWebsiteLogs = useMemo(() => externalPeriod ? websiteLogs || [] : filterLogsByPeriod(websiteLogs || [], activePeriod), [websiteLogs, activePeriod, externalPeriod]);
  const appSolarSystems = useMemo(() => galaxyType !== 'apps' ? [] : computeSolarSystems(filteredLogs, appColors, categoryOverrides), [filteredLogs, appColors, categoryOverrides, galaxyType]);
  const websiteSolarSystems = useMemo(() => galaxyType !== 'websites' ? [] : computeWebsiteSolarSystems(filteredWebsiteLogs, websiteColors, websiteCategoryOverrides), [filteredWebsiteLogs, websiteColors, websiteCategoryOverrides, galaxyType]);
  const solarSystems = galaxyType === 'apps' ? appSolarSystems : websiteSolarSystems;
  const currentSunConfigs = galaxyType === 'apps' ? SUN_CONFIGS : WEBSITE_SUN_CONFIGS;
  const defaultSunConfig = galaxyType === 'apps' ? DEFAULT_SUN_CONFIG : DEFAULT_WEBSITE_SUN_CONFIG;
  const planets = useMemo(() => {
    const system = solarSystems.find(s => s.category === currentCategory);
    let filtered = system?.planets || [];
    if (minTimeFilter > 0) filtered = filtered.filter(p => p.time >= minTimeFilter);
    if (searchQuery.trim()) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.trim()));
    return filtered;
  }, [solarSystems, currentCategory, minTimeFilter, searchQuery]);
  const allPlanets = useMemo(() => solarSystems.flatMap(s => s.planets), [solarSystems]);
  const planetCategories = useMemo(() => [...new Set(allPlanets.map(p => p.category).filter(Boolean))], [allPlanets]);

  const isInteractingRef = useRef(false);
  useEffect(() => {
    const handleStart = () => { isInteractingRef.current = true; };
    const handleEnd = () => { isInteractingRef.current = false; };
    window.addEventListener('pointerdown', handleStart); window.addEventListener('pointerup', handleEnd);
    window.addEventListener('wheel', handleStart); window.addEventListener('wheel', handleEnd);
    return () => { window.removeEventListener('pointerdown', handleStart); window.removeEventListener('pointerup', handleEnd); window.removeEventListener('wheel', handleStart); window.removeEventListener('wheel', handleEnd); };
  }, []);

  const switchToGalaxy = (type: 'apps' | 'websites') => {
    if (type === galaxyType) return;
    setGalaxyType(type); trackedPlanetRef.current = null;
    if (viewMode === 'galaxy' && controlsRef.current && animationSpeed !== 'instant') {
      const duration = ANIMATION_DURATIONS[animationSpeed];
      const targetX = type === 'websites' ? 3250 : 0;
      const targetPos = new THREE.Vector3(targetX, 100, 200);
      const lookAtPos = new THREE.Vector3(targetX, 0, 0);
      const startPos = controlsRef.current.object.position.clone();
      const startTarget = controlsRef.current.target.clone();
      const startTime = Date.now();
      const animate = () => { const elapsed = Date.now() - startTime; const t = Math.min(elapsed / duration, 1); const eased = 1 - Math.pow(1 - t, 3); controlsRef.current.object.position.lerpVectors(startPos, targetPos, eased); controlsRef.current.target.lerpVectors(startTarget, lookAtPos, eased); if (t < 1) requestAnimationFrame(animate); };
      animate();
    }
  };

  const clickStartTimeRef = useRef(0);
  const clickTargetRef = useRef<PlanetData | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePlanetPointerDown = (data: PlanetData) => {
    clickStartTimeRef.current = Date.now(); clickTargetRef.current = data;
    clickTimerRef.current = setTimeout(() => {
      if (clickTargetRef.current) {
        const pd = clickTargetRef.current;
        setSelectedPlanet(pd); setCurrentCategory(pd.category); setViewMode('solarSystem'); setSelectedSystem(null);
        const trackedPos = planetPositionsRef.current.get(pd.name);
        if (trackedPos) { trackedPlanetRef.current = pd.name; const camOffset = Math.max(pd.radius * 6, 12); const camPos = new THREE.Vector3(trackedPos.x + camOffset, trackedPos.y + camOffset * 0.6, trackedPos.z + camOffset); animateCamera(camPos, trackedPos, ANIMATION_DURATIONS[animationSpeed]); }
      } clickTargetRef.current = null;
    }, 300);
  };
  const handlePlanetPointerUp = (data: PlanetData) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    const elapsed = Date.now() - clickStartTimeRef.current;
    if (elapsed < 300 && clickTargetRef.current === data) {
      setSelectedPlanet(data); setCurrentCategory(data.category); setViewMode('solarSystem'); setSelectedSystem(null);
      const trackedPos = planetPositionsRef.current.get(data.name);
      if (trackedPos) { const camOffset = Math.max(data.radius * 6, 12); const camPos = new THREE.Vector3(trackedPos.x + camOffset, trackedPos.y + camOffset * 0.6, trackedPos.z + camOffset); animateCamera(camPos, trackedPos, ANIMATION_DURATIONS[animationSpeed]); }
    } clickTargetRef.current = null;
  };
  const handlePlanetClick = (data: PlanetData) => { handlePlanetPointerDown(data); handlePlanetPointerUp(data); };
  const handleSelectSystem = (category: string) => { setSelectedSystem(solarSystems.find(s => s.category === category) || null); };
  const handleEnterSystem = () => {
    if (selectedSystem && controlsRef.current) {
      setCurrentCategory(selectedSystem.category); setViewMode('solarSystem'); setSelectedSystem(null); setLegendExpanded(true);
      const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
      animateCamera(new THREE.Vector3(0, 30, 60), new THREE.Vector3(0, 0, 0), duration, () => setPortalKey(k => k + 1));
    }
  };
  const handleCloseSystem = () => { setSelectedSystem(null); trackedPlanetRef.current = null; };
  const handleZoomOut = () => {
    if (controlsRef.current) {
      setSelectedPlanet(null); setSelectedSystem(null); trackedPlanetRef.current = null; setViewMode('galaxy');
      const targetX = galaxyType === 'websites' ? 3250 : 0;
      animateCamera(new THREE.Vector3(targetX, 100, 200), new THREE.Vector3(targetX, 0, 0), animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed]);
    }
  };
  const handleRefreshTextures = () => { setTextureRefreshKey(k => k + 1); setSelectedPlanet(null); trackedPlanetRef.current = null; if (controlsRef.current) controlsRef.current.reset(); };
  const handleCategorySelect = (cat: string) => { setCurrentCategory(cat); setSelectedPlanet(null); trackedPlanetRef.current = null; if (controlsRef.current) { setViewMode('solarSystem'); const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed]; animateCamera(new THREE.Vector3(0, 30, 60), new THREE.Vector3(0, 0, 0), duration, () => setPortalKey(k => k + 1)); } };
  const focusOnPlanet = (planet: PlanetData) => {
    setCurrentCategory(planet.category); setViewMode('solarSystem'); setSelectedPlanet(planet); trackedPlanetRef.current = planet.name;
    if (controlsRef.current) {
      let planetPos: THREE.Vector3;
      const trackedPos = planetPositionsRef.current.get(planet.name);
      if (trackedPos) { planetPos = trackedPos; }
      else { const semiLatusRectum = planet.orbitRadius * (1 - (planet.eccentricity || 0.1) ** 2); const angle = Math.random() * Math.PI * 2; const lonPer = planet.longitudeOfPerihelion || 0; const dist = semiLatusRectum / (1 + (planet.eccentricity || 0.1) * Math.cos(angle + lonPer)); const inc = planet.inclination || 0; planetPos = new THREE.Vector3(Math.cos(angle + lonPer) * dist, Math.sin(angle + lonPer) * dist * Math.sin(inc) * 0.3, Math.sin(angle + lonPer) * dist * Math.cos(inc)); }
      const camOffset = Math.max(planet.radius * 6, 12);
      animateCamera(new THREE.Vector3(planetPos.x + camOffset, planetPos.y + camOffset * 0.6, planetPos.z + camOffset), planetPos, ANIMATION_DURATIONS[animationSpeed]);
    }
  };
  const currentSunSize = useMemo(() => currentSunConfigs[currentCategory]?.sizeRange[0] || 3.5, [currentCategory, currentSunConfigs]);

  const animateCamera = (targetPos: THREE.Vector3, lookAtPos: THREE.Vector3, duration: number, onComplete?: () => void) => {
    if (!controlsRef.current) return;
    isAnimatingRef.current = true;
    const startPos = controlsRef.current.object.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const startTime = Date.now();
    const threePhaseBezier = (t: number): number => { if (t < 0.15) return 0.08 * t * t * t; else if (t < 0.7) return 0.08 + 0.84 * (t - 0.15) / 0.55; else return (0.92 + 0.08 * (1 - Math.pow(1 - (t - 0.7) / 0.3, 3))) * (1.02 + 0.03 * Math.sin(((t - 0.7) / 0.3) * Math.PI * 2)); };
    const animate = () => { const elapsed = Date.now() - startTime; const t = Math.min(elapsed / duration, 1); const eased = threePhaseBezier(t); controlsRef.current.object.position.lerpVectors(startPos, targetPos, Math.min(eased, 1)); controlsRef.current.target.lerpVectors(startTarget, lookAtPos, Math.min(eased, 1)); if (t < 1) requestAnimationFrame(animate); else { isAnimatingRef.current = false; onComplete?.(); } };
    animate();
  };
  const handlePlanetPositionUpdate = (name: string, position: THREE.Vector3) => { if (!isMountedRef.current) return; planetPositionsRef.current.set(name, position.clone()); };

  // Delegate all rendering to OrbitScene sub-component
  return <OrbitSceneView
    isPaused={isPaused} setIsPaused={setIsPaused} speed={speed} setSpeed={setSpeed}
    speedOptions={[0.25, 0.5, 1, 2, 4]} selectedPlanet={selectedPlanet} setSelectedPlanet={setSelectedPlanet}
    textureRefreshKey={textureRefreshKey} setTextureRefreshKey={setTextureRefreshKey}
    viewMode={viewMode} setViewMode={setViewMode} galaxyType={galaxyType} setGalaxyType={setGalaxyType}
    perfMode={perfMode} setPerfMode={setPerfMode} isVisible={isVisible}
    cameraPosRef={cameraPosRef} fpsDisplayRef={fpsDisplayRef} fpsHistoryRef={fpsHistoryRef}
    currentCategory={currentCategory} setCurrentCategory={setCurrentCategory}
    selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod} activePeriod={activePeriod}
    selectedSystem={selectedSystem} setSelectedSystem={setSelectedSystem}
    categoryDropdownOpen={categoryDropdownOpen} setCategoryDropdownOpen={setCategoryDropdownOpen}
    legendExpanded={legendExpanded} setLegendExpanded={setLegendExpanded}
    showPerf={showPerf} setShowPerf={setShowPerf} perfExpanded={perfExpanded} setPerfExpanded={setPerfExpanded}
    showInfo={showInfo} setShowInfo={setShowInfo} minTimeFilter={minTimeFilter} setMinTimeFilter={setMinTimeFilter}
    searchQuery={searchQuery} setSearchQuery={setSearchQuery} animationSpeed={animationSpeed}
    controlsRef={controlsRef} trackedPlanetRef={trackedPlanetRef} isAnimatingRef={isAnimatingRef}
    portalKey={portalKey} setPortalKey={setPortalKey} planetPositionsRef={planetPositionsRef} isMountedRef={isMountedRef}
    appSolarSystems={appSolarSystems} websiteSolarSystems={websiteSolarSystems}
    solarSystems={solarSystems} currentSunConfigs={currentSunConfigs} defaultSunConfig={defaultSunConfig}
    planets={planets} allPlanets={allPlanets} planetCategories={planetCategories}
    currentSunSize={currentSunSize} onSwitchToGalaxy={switchToGalaxy}
    onPlanetPointerDown={handlePlanetPointerDown} onPlanetPointerUp={handlePlanetPointerUp}
    onPlanetClick={handlePlanetClick} onSelectSystem={handleSelectSystem}
    onEnterSystem={handleEnterSystem} onCloseSystem={handleCloseSystem}
    onZoomOut={handleZoomOut} onRefreshTextures={handleRefreshTextures}
    onCategorySelect={handleCategorySelect} onFocusPlanet={focusOnPlanet}
    onPeriodChange={onPeriodChange} animateCamera={animateCamera}
    handlePlanetPositionUpdate={handlePlanetPositionUpdate}
  />;
}

// ── Thin render wrapper ──
function OrbitSceneView(props: any) {
  return <>{props.viewMode === 'galaxy' ? <GalaxyView {...props} /> : <SolarSystemScene {...props} />}</>;
}

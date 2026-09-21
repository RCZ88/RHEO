import { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, X, RefreshCw, Globe, ChevronDown, ChevronUp, Clock, Settings, Activity, Gauge, SatelliteDish } from 'lucide-react';
import { maxOf, maxBy } from '../utils/safeMath';
// ── Sub-components (orchestrated from ./orbit/) ──
import { OrbitSystem as OrbitScene } from './orbit/OrbitScene';
import { GalaxyDustCloud, WebsiteGalaxyDustCloud } from './orbit/GalaxyDust';
import { FPSCounter, FPSLineGraph } from './orbit/OrbitControls';
import { GLCleanup } from './orbit/Planet';
import { PlanetRings, Moon, OrbitTrail, AsteroidBelt, Starfield, WarpLines, PortalRing, AtmosphericScattering } from './orbit/Ring';
import { getDistinctColor, getCategoryColor, hashString, getPlanetColor, calculateOrbitRadius } from './orbit/PlanetUtils';
import type { PlanetData, ActivityLog } from './orbit/PlanetUtils';
import {
  GalaxyView, CategorySidebar, CategoryDropdown, PlanetLegend,
  PlanetDetailPanel, CameraTracker, PlanetTracker, SolarSystemScene,
  SystemTrail, AsteroidBelt as AsteroidBeltComponent, Starfield as StarfieldComponent,
  WarpLines as WarpLinesComponent, PortalRing as PortalRingComponent
} from './orbit/OrbitScene';

// ── Constants & Helpers ──
type AnimationSpeed = 'slow' | 'normal' | 'instant';
const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = { slow: 2500, normal: 1200, instant: 0 };
const APP_CATEGORIES: Record<string, { cat: string; color: string }> = {
  'VS Code': { cat: 'IDE', color: '#4f46e5' }, 'PyCharm': { cat: 'IDE', color: '#10b981' },
  'IntelliJ IDEA': { cat: 'IDE', color: '#10b981' }, 'Obsidian': { cat: 'IDE', color: '#7c3aed' },
  'Claude': { cat: 'AI Tools', color: '#8b5cf6' }, 'ChatGPT': { cat: 'AI Tools', color: '#8b5cf6' },
  'Chrome': { cat: 'Browser', color: '#3b82f6' }, 'Firefox': { cat: 'Browser', color: '#f97316' },
  'YouTube': { cat: 'Entertainment', color: '#ef4444' }, 'Slack': { cat: 'Communication', color: '#14b8a6' },
  'Figma': { cat: 'Design', color: '#a855f7' }, 'Terminal': { cat: 'Productivity', color: '#64748b' },
  'Wispr Flow': { cat: 'Tools', color: '#f59e0b' }, 'Google Chrome': { cat: 'Browser', color: '#3b82f6' },
  'Windows Explorer': { cat: 'Productivity', color: '#64748b' }, 'Microsoft Edge': { cat: 'Browser', color: '#3b82f6' },
  'Notion': { cat: 'Productivity', color: '#10b981' }, 'Discord': { cat: 'Communication', color: '#14b8a6' },
  'Spotify': { cat: 'Entertainment', color: '#ec4899' }, 'Netflix': { cat: 'Entertainment', color: '#ef4444' },
};
const VIVID_PALETTE = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16', '#e879f9', '#22d3ee'];
const CATEGORY_COLOR_FAMILIES: Record<string, string[]> = {
  'IDE': ['#6366f1', '#8b5cf6', '#7c3aed'], 'AI Tools': ['#8b5cf6', '#a78bfa', '#c084fc'],
  'Browser': ['#3b82f6', '#06b6d4', '#22d3ee'], 'Entertainment': ['#ec4899', '#f43f5e', '#f97316'],
  'Communication': ['#14b8a6', '#06b6d4', '#10b981'], 'Design': ['#a855f7', '#e879f9', '#ec4899'],
  'Productivity': ['#10b981', '#84cc16', '#22c55e'], 'Tools': ['#f59e0b', '#f97316', '#fb923c'],
  'Other': ['#64748b', '#94a3b8', '#78716c'],
};
const ORBIT_CONFIG = { minOrbitRadius: 10, maxOrbitRadius: 110, spacingExponent: 0.8, baseAngularSpeed: 2.0, minAngularSpeed: 0.08, sunRadius: 5, sunGlowSize: 6 };
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
const WEBSITE_CATEGORY_LIST = ['Social Media', 'Entertainment', 'Productivity', 'Search Engine', 'News', 'Shopping', 'Communication', 'Education', 'Developer Tools', 'Uncategorized', 'Other'];
const DEFAULT_CATEGORY_LIST = ['IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication', 'Design', 'Productivity', 'Tools', 'Other'];
const MAX_RENDERED_PLANETS = 80;
const MIN_PLANET_TIME_SECONDS = 30;

function hashStringLocal(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h);
}
function getPlanetColorLocal(category: string, planetName: string): string {
  const family = CATEGORY_COLOR_FAMILIES[category] || CATEGORY_COLOR_FAMILIES['Other'];
  const seed = hashStringLocal(planetName) % 1000;
  const hueShift = ((seed / 1000) - 0.5) * 24;
  const satShift = ((seed / 1000) - 0.5) * 16;
  const h = ((family.h + hueShift) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, family.s + satShift));
  return `hsl(${h}, ${s}%, ${family.l}%)`;
}
function calculateOrbitRadiusLocal(planetIndex: number, totalPlanets: number): number {
  const t = totalPlanets > 1 ? planetIndex / (totalPlanets - 1) : 0.5;
  return ORBIT_CONFIG.minOrbitRadius + (ORBIT_CONFIG.maxOrbitRadius - ORBIT_CONFIG.minOrbitRadius) * Math.pow(t, ORBIT_CONFIG.spacingExponent);
}
function calculateAngularSpeedLocal(radius: number): number {
  return Math.max(ORBIT_CONFIG.minAngularSpeed, ORBIT_CONFIG.baseAngularSpeed / Math.pow(radius, 1.5) + 0.25 * (1 - radius / ORBIT_CONFIG.maxOrbitRadius));
}
function calculateOrbitalPeriodLocal(radius: number): number {
  return (2 * Math.PI / ORBIT_CONFIG.baseAngularSpeed) * Math.pow(radius, 1.5);
}
function computeEccentricityLocal(planetIndex: number, totalPlanets: number): number {
  const t = planetIndex / Math.max(totalPlanets - 1, 1);
  const noise = (seededRandom(planetIndex * 7.3 + 13.7) - 0.5) * 0.03;
  return 0.15 - 0.12 * t + noise;
}
function computeInclinationLocal(planetName: string): number {
  const seed = hashStringLocal(planetName) % 1000;
  return (seed / 1000) * 6;
}
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
function createSeededRandom(seed: number): () => number {
  let s = seed; return () => { s = Math.sin(s) * 10000; return s - Math.floor(s); };
}
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 128, g: 128, b: 128 };
}
function getCategoryColor(category: string, indexInCategory: number): string {
  const family = CATEGORY_COLOR_FAMILIES[category] || CATEGORY_COLOR_FAMILIES['Other'];
  return family[indexInCategory % family.length];
}
function getDistinctColorLocal(index: number): string {
  return VIVID_PALETTE[index % VIVID_PALETTE.length];
}
function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return s > 0 ? `${m}m ${s}s` : `${m}m`; }
  const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function filterLogsByPeriod(logs: ActivityLog[], period: 'today' | 'week' | 'month' | 'all'): ActivityLog[] {
  if (period === 'all' || !logs || logs.length === 0) return logs;
  const now = Date.now();
  if (period === 'today') { const todayStr = new Date().toISOString().split('T')[0]; return logs.filter(log => (log.timestamp instanceof Date ? log.timestamp.toISOString().split('T')[0] : typeof log.timestamp === 'string' ? log.timestamp.split('T')[0] : '') === todayStr); }
  const cutoff = period === 'week' ? now - 7 * 24 * 60 * 60 * 1000 : now - 30 * 24 * 60 * 60 * 1000;
  return logs.filter(log => new Date(log.timestamp).getTime() >= cutoff);
}
function getCategoryListFromSettings(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORY_LIST;
  try { const tierAssignments = localStorage.getItem('deskflow-tier-assignments'); if (tierAssignments) { const tiers = JSON.parse(tierAssignments); return [...(tiers.productive || []), ...(tiers.neutral || []), ...(tiers.distracting || [])].length > 0 ? [...(tiers.productive || []), ...(tiers.neutral || []), ...(tiers.distracting || [])] : DEFAULT_CATEGORY_LIST; } } catch { /* ignore */ }
  return DEFAULT_CATEGORY_LIST;
}

// ── Props ──
interface ActivityLog { id: number; timestamp: Date; app: string; category: string; duration: number; title?: string; project?: string; is_browser_tracking?: boolean; domain?: string; url?: string; duration_ms?: number; }
interface OrbitSystemProps { logs: ActivityLog[]; websiteLogs?: ActivityLog[]; appColors?: Record<string, string>; categoryOverrides?: Record<string, string>; websiteColors?: Record<string, string>; websiteCategoryOverrides?: Record<string, string>; selectedPeriod?: 'today' | 'week' | 'month' | 'all'; onPeriodChange?: (period: 'today' | 'week' | 'month' | 'all') => void; }

// ── GLCleanup (delegated to ./orbit/Planet) ──
// Duplicate GLCleanup removed — now imported from './orbit/Planet'

// ── Main Export Component ──
export default function OrbitSystem({ logs, appColors, categoryOverrides, websiteLogs, websiteColors, websiteCategoryOverrides, selectedPeriod: externalPeriod, onPeriodChange }: OrbitSystemProps) {
  // State management (kept from original)
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedOptions = [0.25, 0.5, 1, 2, 4];
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [textureRefreshKey, setTextureRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'galaxy' | 'solarSystem'>('galaxy');
  const [galaxyType, setGalaxyType] = useState<'apps' | 'websites'>('apps');
  const [perfMode, setPerfMode] = useState<'high' | 'balanced' | 'performance'>(() => { try { const stored = localStorage.getItem('deskflow-graphics-quality'); if (stored === 'high' || stored === 'balanced' || stored === 'performance') return stored; } catch { /* ignore */ } return 'balanced'; });
  useEffect(() => { try { localStorage.setItem('deskflow-graphics-quality', perfMode); } catch { /* ignore */ } }, [perfMode]);
  const [isVisible, setIsVisible] = useState(true);
  const cameraPosRef = useRef<[number, number, number]>([0, 100, 200]);
  const fpsDisplayRef = useRef<HTMLDivElement | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('Other');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const activePeriod = externalPeriod || selectedPeriod;
  const [selectedSystem, setSelectedSystem] = useState<{ category: string; planets: PlanetData[]; totalTime: number; sunSize: number } | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [perfExpanded, setPerfExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [minTimeFilter, setMinTimeFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [animationSpeed] = useState<AnimationSpeed>(() => { try { return (localStorage.getItem('deskflow-animation-speed') as AnimationSpeed) || 'normal'; } catch { return 'normal'; } });
  const controlsRef = useRef<any>(null);
  const galaxyTypeRef = useRef(galaxyType);
  const trackedPlanetRef = useRef<string | null>(null);
  const isAnimatingRef = useRef(false);
  const [portalKey, setPortalKey] = useState(0);
  const planetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const isMountedRef = useRef(true);

  // Visibility change → pause 3D rendering when tab hidden
  useEffect(() => { const handleVisibility = () => setIsVisible(!document.hidden); document.addEventListener('visibilitychange', handleVisibility); return () => document.removeEventListener('visibilitychange', handleVisibility); }, []);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; planetPositionsRef.current.clear(); }; }, []);

  // Filter logs by selected period
  const filteredLogs = useMemo(() => { if (externalPeriod) return logs || []; return filterLogsByPeriod(logs, activePeriod); }, [logs, activePeriod, externalPeriod]);
  const filteredWebsiteLogs = useMemo(() => { if (externalPeriod) return websiteLogs || []; return filterLogsByPeriod(websiteLogs || [], activePeriod); }, [websiteLogs, activePeriod, externalPeriod]);

  // App galaxy solar systems
  const appSolarSystems = useMemo(() => {
    if (galaxyType !== 'apps') return [];
    const result = computeSolarSystems(filteredLogs, appColors, categoryOverrides);
    return result;
  }, [filteredLogs, appColors, categoryOverrides, galaxyType]);

  // Website galaxy solar systems
  const websiteSolarSystems = useMemo(() => {
    if (galaxyType !== 'websites') return [];
    const result = computeWebsiteSolarSystems(filteredWebsiteLogs, websiteColors, websiteCategoryOverrides);
    return result;
  }, [filteredWebsiteLogs, websiteColors, websiteCategoryOverrides, galaxyType]);

  // Interaction tracking
  const isInteractingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  const INTERACTION_COOLDOWN = 1000;
  useEffect(() => {
    const handleInteractionStart = () => { isInteractingRef.current = true; };
    const handleInteractionEnd = () => { lastInteractionTimeRef.current = Date.now(); isInteractingRef.current = false; };
    window.addEventListener('pointerdown', handleInteractionStart);
    window.addEventListener('pointerup', handleInteractionEnd);
    window.addEventListener('wheel', handleInteractionStart);
    window.addEventListener('wheel', handleInteractionEnd);
    return () => { window.removeEventListener('pointerdown', handleInteractionStart); window.removeEventListener('pointerup', handleInteractionEnd); window.removeEventListener('wheel', handleInteractionStart); window.removeEventListener('wheel', handleInteractionEnd); };
  }, []);

  // Galaxy switching
  const switchToGalaxy = (type: 'apps' | 'websites') => {
    if (type === galaxyType) return;
    setGalaxyType(type);
    trackedPlanetRef.current = null;
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

  const solarSystems = galaxyType === 'apps' ? appSolarSystems : websiteSolarSystems;
  const currentSunConfigs = galaxyType === 'apps' ? SUN_CONFIGS : WEBSITE_SUN_CONFIGS;
  const defaultSunConfig = galaxyType === 'apps' ? DEFAULT_SUN_CONFIG : DEFAULT_WEBSITE_SUN_CONFIG;

  const planets = useMemo(() => {
    const system = solarSystems.find(s => s.category === currentCategory);
    let filtered = system?.planets || [];
    if (minTimeFilter > 0) filtered = filtered.filter(p => p.time >= minTimeFilter);
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase().trim(); filtered = filtered.filter(p => p.name.toLowerCase().includes(q)); }
    return filtered;
  }, [solarSystems, currentCategory, minTimeFilter, searchQuery]);

  const allPlanets = useMemo(() => { return solarSystems.flatMap(s => s.planets); }, [solarSystems]);

  useEffect(() => {
    if (viewMode !== 'solarSystem') return;
    const found = solarSystems.find((s) => s.category === currentCategory);
    if (!found && solarSystems.length > 0) { const newCat = solarSystems[0].category; setCurrentCategory(newCat); }
  }, [solarSystems, currentCategory, viewMode]);

  const planetCategories = useMemo(() => { return [...new Set(allPlanets.map(p => p.category).filter(Boolean))]; }, [allPlanets]);

  // Click/double-click distinction
  const clickStartTimeRef = useRef(0);
  const clickTargetRef = useRef<PlanetData | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlanetPointerDown = (data: PlanetData) => {
    clickStartTimeRef.current = Date.now();
    clickTargetRef.current = data;
    clickTimerRef.current = setTimeout(() => {
      if (clickTargetRef.current) {
        const pd = clickTargetRef.current;
        setSelectedPlanet(pd);
        setCurrentCategory(pd.category);
        setViewMode('solarSystem');
        setSelectedSystem(null);
        const trackedPos = planetPositionsRef.current.get(pd.name);
        if (trackedPos) {
          trackedPlanetRef.current = pd.name;
          const camOffset = Math.max(pd.radius * 6, 12);
          const camPos = new THREE.Vector3(trackedPos.x + camOffset, trackedPos.y + camOffset * 0.6, trackedPos.z + camOffset);
          animateCamera(camPos, trackedPos, ANIMATION_DURATIONS[animationSpeed]);
        }
      }
      clickTargetRef.current = null;
    }, 300);
  };

  const handlePlanetPointerUp = (data: PlanetData) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    const elapsed = Date.now() - clickStartTimeRef.current;
    if (elapsed < 300 && clickTargetRef.current === data) {
      setSelectedPlanet(data); setCurrentCategory(data.category); setViewMode('solarSystem'); setSelectedSystem(null);
      const trackedPos = planetPositionsRef.current.get(data.name);
      if (trackedPos) { const camOffset = Math.max(data.radius * 6, 12); const camPos = new THREE.Vector3(trackedPos.x + camOffset, trackedPos.y + camOffset * 0.6, trackedPos.z + camOffset); animateCamera(camPos, trackedPos, ANIMATION_DURATIONS[animationSpeed]); }
    }
    clickTargetRef.current = null;
  };

  const handlePlanetClick = (data: PlanetData) => { handlePlanetPointerDown(data); handlePlanetPointerUp(data); };

  const handleSelectSystem = (category: string) => { const system = solarSystems.find(s => s.category === category); setSelectedSystem(system || null); };
  const handleEnterSystem = () => {
    if (selectedSystem && controlsRef.current) {
      setCurrentCategory(selectedSystem.category);
      setViewMode('solarSystem');
      setSelectedSystem(null);
      setLegendExpanded(true);
      const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
      const targetPos = new THREE.Vector3(0, 30, 60);
      const lookAtPos = new THREE.Vector3(0, 0, 0);
      animateCamera(targetPos, lookAtPos, duration, () => setPortalKey(k => k + 1));
    }
  };
  const handleCloseSystem = () => { setSelectedSystem(null); trackedPlanetRef.current = null; };
  const handleZoomOut = () => {
    if (controlsRef.current) {
      setSelectedPlanet(null); setSelectedSystem(null); trackedPlanetRef.current = null; setViewMode('galaxy');
      const targetX = galaxyType === 'websites' ? 3250 : 0;
      const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
      const targetPos = new THREE.Vector3(targetX, 100, 200);
      const lookAtPos = new THREE.Vector3(targetX, 0, 0);
      animateCamera(targetPos, lookAtPos, duration);
    }
  };
  const handleRefreshTextures = () => { setTextureRefreshKey(k => k + 1); setSelectedPlanet(null); trackedPlanetRef.current = null; if (controlsRef.current) controlsRef.current.reset(); };
  const handleCategorySelect = (cat: string) => {
    setCurrentCategory(cat); setSelectedPlanet(null); trackedPlanetRef.current = null;
    if (controlsRef.current) { setViewMode('solarSystem'); const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed]; const targetPos = new THREE.Vector3(0, 30, 60); const lookAtPos = new THREE.Vector3(0, 0, 0); animateCamera(targetPos, lookAtPos, duration, () => setPortalKey(k => k + 1)); }
  };

  const currentSunSize = useMemo(() => { const config = currentSunConfigs[currentCategory]; return config?.sizeRange[0] || 3.5; }, [currentCategory, currentSunConfigs]);

  // Camera animation helper
  const animateCamera = (targetPos: THREE.Vector3, lookAtPos: THREE.Vector3, duration: number, onComplete?: () => void) => {
    if (!controlsRef.current) return;
    isAnimatingRef.current = true;
    const startPos = controlsRef.current.object.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const startTime = Date.now();
    const threePhaseBezier = (t: number): number => {
      if (t < 0.15) { const p = t / 0.15; return 0.08 * p * p * p; }
      else if (t < 0.7) { const p = (t - 0.15) / 0.55; return 0.08 + 0.84 * p; }
      else { const p = (t - 0.7) / 0.3; return (0.92 + 0.08 * (1 - Math.pow(1 - p, 3))) * (1.02 + 0.03 * Math.sin(p * Math.PI * 2)); }
    };
    const animate = () => {
      const elapsed = Date.now() - startTime; const t = Math.min(elapsed / duration, 1); const eased = threePhaseBezier(t);
      controlsRef.current.object.position.lerpVectors(startPos, targetPos, Math.min(eased, 1));
      controlsRef.current.target.lerpVectors(startTarget, lookAtPos, Math.min(eased, 1));
      if (t < 1) requestAnimationFrame(animate); else { isAnimatingRef.current = false; onComplete?.(); }
    };
    animate();
  };

  const resetCameraToGalaxy = () => {
    const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
    const targetX = galaxyType === 'websites' ? 3250 : 0;
    const targetPos = new THREE.Vector3(targetX, 100, 200);
    const lookAtPos = new THREE.Vector3(targetX, 0, 0);
    animateCamera(targetPos, lookAtPos, duration);
  };

  // Called when a planet reports its position each frame
  const handlePlanetPositionUpdate = (name: string, position: THREE.Vector3) => {
    if (!isMountedRef.current) return;
    planetPositionsRef.current.set(name, position.clone());
  };

  // Focus on a planet
  const focusOnPlanet = (planet: PlanetData) => {
    setCurrentCategory(planet.category); setViewMode('solarSystem'); setSelectedPlanet(planet); trackedPlanetRef.current = planet.name;
    if (controlsRef.current) {
      let planetPos: THREE.Vector3;
      const trackedPos = planetPositionsRef.current.get(planet.name);
      if (trackedPos) { planetPos = trackedPos; }
      else {
        const semiLatusRectum = planet.orbitRadius * (1 - (planet.eccentricity || 0.1) ** 2);
        const angle = Math.random() * Math.PI * 2; const lonPer = planet.longitudeOfPerihelion || 0;
        const dist = semiLatusRectum / (1 + (planet.eccentricity || 0.1) * Math.cos(angle + lonPer));
        const inc = planet.inclination || 0;
        const px = Math.cos(angle + lonPer) * dist; const py = Math.sin(angle + lonPer) * dist * Math.sin(inc) * 0.3; const pz = Math.sin(angle + lonPer) * dist * Math.cos(inc);
        planetPos = new THREE.Vector3(px, py, pz);
      }
      const camOffset = Math.max(planet.radius * 6, 12);
      const camPos = new THREE.Vector3(planetPos.x + camOffset, planetPos.y + camOffset * 0.6, planetPos.z + camOffset);
      animateCamera(camPos, planetPos, ANIMATION_DURATIONS[animationSpeed]);
    }
  };

  // ── Main Render (orchestrated) ──
  return (
    <div className="relative w-full h-full rounded-none overflow-visible flex flex-col">
      {/* Galaxy type indicator */}
      <div className="absolute top-4 left-4 z-20">
        <div className={`text-xs font-semibold tracking-wider px-3 py-1.5 rounded-lg border ${galaxyType === 'apps' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'}`}>
          {galaxyType === 'apps' ? 'APPS GALAXY' : 'WEBSITES GALAXY'}
        </div>
      </div>

      {/* Filter & Search bar */}
      {viewMode === 'solarSystem' && (
        <div className="absolute top-16 left-4 z-20 flex flex-col gap-2">
          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search planets..." className="bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none w-28" />
          </div>
          <div className="glass rounded-xl px-3 py-2 flex flex-col gap-1">
            <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Min time</span><span className="text-zinc-400 font-mono">{formatDurationSeconds(minTimeFilter)}</span></div>
            <input type="range" min={0} max={36000} step={300} value={minTimeFilter} onChange={(e) => setMinTimeFilter(Number(e.target.value))} className="w-full h-1 accent-indigo-500" />
          </div>
        </div>
      )}

      {/* Control buttons */}
      <div className="absolute top-16 left-4 z-20 flex flex-col gap-2" style={{ marginTop: viewMode === 'solarSystem' ? '110px' : '0px' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => switchToGalaxy(galaxyType === 'apps' ? 'websites' : 'apps')} className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition ${galaxyType === 'apps' ? 'text-blue-400 hover:text-blue-300' : 'text-cyan-400 hover:text-cyan-300'}`} title={galaxyType === 'apps' ? 'Switch to Websites Galaxy' : 'Switch to Apps Galaxy'}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            {galaxyType === 'apps' ? 'Web' : 'Apps'}
          </button>
          {viewMode === 'solarSystem' && (
            <button onClick={handleZoomOut} className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium hover:text-white transition"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Galaxy</button>
          )}
          <CategoryDropdown currentCategory={currentCategory} onSelect={handleCategorySelect} isExpanded={categoryDropdownOpen} onToggle={() => setCategoryDropdownOpen(!categoryDropdownOpen)} additionalCategories={planetCategories} />
        </div>
        <div className="flex items-center gap-1 self-start">
          {(['today', 'week', 'month', 'all'] as const).map((p) => (
            <button key={p} onClick={() => { setSelectedPeriod(p); onPeriodChange?.(p); }} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${activePeriod === p ? 'bg-indigo-500/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPerf(!showPerf)} className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition self-start ${showPerf ? 'text-emerald-400 bg-emerald-500/20' : 'hover:text-white'}`}><Activity className="w-4 h-4" />Perf</button>
        <button onClick={() => setShowInfo(!showInfo)} className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition self-start ${showInfo ? 'text-cyan-400 bg-cyan-500/20' : 'hover:text-white'}`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>Info</button>
      </div>

      {/* FPS Stats panel */}
      {showPerf && (
        <div className="glass rounded-xl px-3 py-2 text-xs font-mono space-y-2 w-[200px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Activity className="w-3 h-3 text-emerald-400" /><span ref={fpsDisplayRef} className="text-emerald-400">-- FPS</span></div>
            <button onClick={() => setPerfExpanded(!perfExpanded)} className="text-zinc-500 hover:text-white transition">{perfExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</button>
          </div>
          <FPSLineGraph fpsHistoryRef={fpsHistoryRef} width={176} height={48} />
          <div className="border-t border-zinc-700 pt-2 mt-2">
            <div className="flex items-center gap-1.5 mb-1.5 text-zinc-400"><Gauge className="w-3 h-3 text-indigo-400" /><span>Graphics Quality</span></div>
            <div className="grid grid-cols-3 gap-1">
              {(['high', 'balanced', 'performance'] as const).map((q) => (
                <button key={q} onClick={() => setPerfMode(q)} className={`px-1.5 py-1 rounded-md text-[10px] font-medium transition ${perfMode === q ? 'bg-indigo-500/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`} title={q === 'high' ? 'Max particles, MSAA 4x, Bloom' : q === 'balanced' ? 'Balanced quality & performance' : 'Reduced particles, no Bloom'}>
                  {q === 'high' ? 'High' : q === 'performance' ? 'Low' : 'Balanced'}
                </button>
              ))}
            </div>
          </div>
          {perfExpanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2 mt-2 border-t border-zinc-700 space-y-1">
              <div className="flex justify-between text-zinc-400"><span>GPU</span><span className="text-zinc-300">--</span></div>
              <div className="flex justify-between text-zinc-400"><span>Memory</span><span className="text-zinc-300">--</span></div>
              <div className="flex justify-between text-zinc-400"><span>Frame Time</span><span className="text-zinc-300">--</span></div>
            </motion.div>
          )}
        </div>
      )}

      {/* Info Panel */}
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
          <div className="border-t border-zinc-700 pt-2 mt-2"><div className="text-zinc-500 text-[10px]">Planets scaled with cube root to prevent extreme values</div></div>
        </motion.div>
      )}

      {/* 3D Canvas */}
      <div className="w-full flex-1 bg-transparent">
        <Canvas resize={{ scroll: false, offsetSize: true }} style={{ width: '100%', height: '100%' }} key={`canvas-${textureRefreshKey}-${perfMode}`} camera={{ position: viewMode === 'galaxy' ? (galaxyType === 'websites' ? [3250, 100, 200] : [0, 100, 200]) : [0, 100, 180], fov: 45, near: 0.1, far: 10000 }} onError={(e) => console.error('[OrbitSystem] Canvas error:', e)} onCreated={({ gl }) => { gl.setClearColor('#0a0a14', 0); }} gl={{ powerPreference: 'high-performance', antialias: perfMode === 'high', alpha: false, stencil: false, depth: true, preserveDrawingBuffer: false }} dpr={Math.min(window.devicePixelRatio, perfMode === 'performance' ? 1 : 1.5)} frameloop={isVisible ? 'always' : 'demand'}>
          <PerformanceMonitor onDecline={() => { if (perfMode === 'high') setPerfMode('balanced'); else if (perfMode === 'balanced') setPerfMode('performance'); }}>
            <GLCleanup />
            <color attach="background" args={['#0a0a14']} />
            <fog attach="fog" args={['#0a0a14', 1500, 4500]} />
            <ambientLight intensity={0.13} color="#3a4a6e" />
            <hemisphereLight groundColor="#10131c" skyColor="#b8d0f0" intensity={0.18} />
            <pointLight position={[0, 0, 0]} intensity={8} color="#ffdd99" distance={400} decay={1.0} />
            <directionalLight position={[-80, -20, -60]} intensity={0.4} color="#cfe0ff" />
            <EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>
              {perfMode !== 'performance' && <Bloom intensity={1.6} luminanceThreshold={0.4} luminanceSmoothing={0.5} radius={0.8} mipmapBlur />}
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
              {perfMode !== 'performance' && <Vignette offset={0.25} darkness={0.5} blendFunction={BlendFunction.NORMAL} />}
            </EffectComposer>
            {showPerf && <FPSCounter fpsDisplayRef={fpsDisplayRef} fpsHistoryRef={fpsHistoryRef} />}
            {viewMode === 'galaxy' ? (
              <>
                <GalaxyView appSolarSystems={appSolarSystems} websiteSolarSystems={websiteSolarSystems} appSunConfigs={SUN_CONFIGS} websiteSunConfigs={WEBSITE_SUN_CONFIGS} defaultSunConfig={defaultSunConfig} galaxyType={galaxyType} onSelectSystem={handleSelectSystem} viewMode={viewMode} animationSpeed={animationSpeed} perfMode={perfMode} />
                <CameraTracker cameraPosRef={cameraPosRef} />
                <Stars radius={5000} depth={250} count={5000} factor={7} fade speed={0.08} saturation={0.6} />
                <OrbitControls ref={controlsRef} enablePan enableZoom minDistance={50} maxDistance={5000} autoRotate={false} target={galaxyType === 'websites' ? [3250, 0, 0] : [0, 0, 0]} />
              </>
            ) : (
              <>
                <SolarSystemScene planets={planets} isPaused={isPaused} speed={speed} onPlanetClick={handlePlanetClick} controlsRef={controlsRef} onPlanetPositionUpdate={handlePlanetPositionUpdate} category={currentCategory} sunSize={currentSunSize} portalKey={portalKey} isAnimating={isAnimatingRef.current} showBelt={true} />
                <PlanetTracker controlsRef={controlsRef} planetPositionsRef={planetPositionsRef} trackedPlanetRef={trackedPlanetRef} cameraPosRef={cameraPosRef} isAnimatingRef={isAnimatingRef} />
              </>
            )}
          </PerformanceMonitor>
        </Canvas>
      </div>

      {/* Empty state */}
      {viewMode === 'solarSystem' && planets.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-xl px-6 py-5 flex flex-col items-center gap-3 text-center max-w-xs pointer-events-auto">
            <SatelliteDish className="w-8 h-8 text-indigo-400" />
            <div className="text-sm text-zinc-300 font-medium">No activity here yet</div>
            <div className="text-xs text-zinc-500 leading-relaxed">Nothing was tracked in this category for the selected period. Pick another category or head back to the galaxy.</div>
            <button onClick={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; setViewMode('galaxy'); }} className="mt-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition">Back to galaxy</button>
          </div>
        </div>
      )}

      {/* Category sidebar */}
      {selectedSystem && viewMode === 'galaxy' && (
        <CategorySidebar system={selectedSystem} onClose={handleCloseSystem} onEnter={handleEnterSystem} onPlanetClick={(p) => { handlePlanetClick(p); setSelectedSystem(null); }} />
      )}

      {/* Planet detail panel */}
      <PlanetDetailPanel planet={selectedPlanet} onClose={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; }} />

      {/* Controls overlay */}
      <div className="absolute top-4 right-4 z-10">
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-3">
          <button onClick={() => setIsPaused(!isPaused)} className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition"><Play className="w-3.5 h-3.5" />{isPaused ? 'Resume' : 'Pause'}</button>
          <div className="w-px h-4 bg-zinc-700" />
          <button onClick={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; if (controlsRef.current) controlsRef.current.reset(); }} className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition"><RotateCcw className="w-3.5 h-3.5" />Reset</button>
          <div className="w-px h-4 bg-zinc-700" />
          <button onClick={handleRefreshTextures} className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition" title="Refresh textures"><RefreshCw className="w-3.5 h-3.5" /></button>
          <div className="w-px h-4 bg-zinc-700" />
          {speedOptions.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`px-2 py-0.5 rounded text-xs transition ${speed === s ? 'bg-indigo-500/30 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}>{s}x</button>
          ))}
        </div>
      </div>

      {/* Planet Legend */}
      <PlanetLegend planets={viewMode === 'solarSystem' ? planets : allPlanets} isExpanded={legendExpanded} onToggle={() => setLegendExpanded(!legendExpanded)} onPlanetClick={focusOnPlanet} showCategoryHeaders={true} allCategories={solarSystems} />

      {/* Galaxy hint */}
      {viewMode === 'galaxy' && (
        <div className="absolute bottom-24 left-0 right-0 text-center"><div className="text-xs text-zinc-500">Click a solar system to explore • Drag to rotate • Scroll to zoom</div></div>
      )}
    </div>
  );
}
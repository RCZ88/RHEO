import { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, X, RefreshCw, Globe, ChevronDown, ChevronUp, Clock, Settings, Activity } from 'lucide-react';
import { maxOf, maxBy } from '../utils/safeMath';

// Cleanup component to properly dispose of WebGL resources
function GLCleanup() {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    return () => {
      // Dispose of all geometries in the scene
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
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

      // Dispose cache-owned textures (refcounted, single owner)
      disposeAllPlanetTextures();
      
      // Dispose of render targets
      if (gl.getRenderTarget) {
        const renderTarget = gl.getRenderTarget();
        if (renderTarget) {
          renderTarget.dispose();
        }
      }
      
      // Clear the animation frame request
      gl.dispose();
      
      // Set context lost handler to prevent errors
      const canvas = gl.domElement;
      const handleContextLost = (event: Event) => {
        event.preventDefault();
        console.log('[OrbitSystem] WebGL context lost - cleanup complete');
      };
      canvas.addEventListener('webglcontextlost', handleContextLost, { once: true });
    };
  }, [gl, scene]);
  
  return null;
}

// ── Refcounted planet-texture cache (single owner of all planet textures) ──
const cacheOwnedTextures = new WeakSet<THREE.Texture>();

type CachedPlanetTextures = {
  texture: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  glowTexture: THREE.CanvasTexture;
  refs: number;
};
const planetTextureCache = new Map<string, CachedPlanetTextures>();

function makeGlowTexture(): THREE.CanvasTexture {
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 128;
  const ctx = glowCanvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(glowCanvas);
}

let _texGenCount = 0;
let _texLogTime = 0;
function acquirePlanetTextures(color: string, category: string, seed: number) {
  const key = color + '|' + category + '|' + seed;
  let entry = planetTextureCache.get(key);
  if (!entry) {
    const t = performance.now();
    const texture = createProceduralTexture(color, category, seed);
    const normalMap = createProceduralNormalMap(color, category, seed);
    const glowTexture = makeGlowTexture();
    _texGenCount++;
    _texLogTime += performance.now() - t;
    if (_texGenCount === 1 || _texGenCount % 10 === 0) {
      console.log(`[FROZEN-DBG] Texture gen #${_texGenCount} done, cumulative ${Math.round(_texLogTime)}ms, key=${key.substring(0,30)}`);
    }
    cacheOwnedTextures.add(texture);
    cacheOwnedTextures.add(normalMap);
    cacheOwnedTextures.add(glowTexture);
    entry = { texture, normalMap, glowTexture, refs: 0 };
    planetTextureCache.set(key, entry);
  }
  entry.refs += 1;
  return { key, texture: entry.texture, normalMap: entry.normalMap, glowTexture: entry.glowTexture };
}

function releasePlanetTextures(key: string) {
  const entry = planetTextureCache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.texture.dispose();
    entry.normalMap.dispose();
    entry.glowTexture.dispose();
    planetTextureCache.delete(key);
  }
}

function disposeAllPlanetTextures() {
  for (const entry of planetTextureCache.values()) {
    entry.texture.dispose();
    entry.normalMap.dispose();
    entry.glowTexture.dispose();
  }
  planetTextureCache.clear();
}

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Seeded random as function factory (for code that needs sequential random)
function createSeededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

// Galaxy dust cloud component - creates a realistic 3D spiral galaxy with multiple arms
function GalaxyDustCloud({ perfMode = 'balanced' }: { perfMode?: string }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particleCount = perfMode === 'performance' ? 1000 : perfMode === 'balanced' ? 2500 : 6000;
  const maxRadius = 280;
  
  // Generate particle positions with seed-based random for stability
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const armCount = 3;
    const armSeparation = (Math.PI * 2) / armCount;
    
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 0.1;
      const baseAngle = seededRandom(seed) * Math.PI * 2;
      const onArm = seededRandom(seed + 1) < 0.45;
      
      let finalAngle: number;
      let radius: number;
      
      if (onArm) {
        const armIndex = Math.floor(seededRandom(seed + 2) * armCount);
        const armOffset = armIndex * armSeparation + (seededRandom(seed + 3) - 0.5) * 0.3;
        const logRadius = Math.pow(seededRandom(seed + 4), 0.4) * maxRadius;
        const spiralAngle = logRadius * 0.022 + armOffset;
        const armWidth = 0.2 + logRadius * 0.003;
        finalAngle = spiralAngle + (seededRandom(seed + 5) - 0.5) * armWidth;
        radius = logRadius;
      } else {
        const r = Math.pow(seededRandom(seed + 4), 0.55) * maxRadius;
        const armPhase = Math.sin(r * 0.02 + baseAngle * 0.5) * 0.3;
        finalAngle = baseAngle + armPhase + (seededRandom(seed + 5) - 0.5) * 0.5;
        radius = r;
      }
      
      const normalizedR = radius / maxRadius;
      const ySpread = 2.5 + normalizedR * 10;
      const y = (seededRandom(seed + 6) - 0.5) * ySpread;
      const scatter = seededRandom(seed + 7) * 3 * (1 - normalizedR * 0.4);
      
      pos[i * 3] = (radius + scatter) * Math.cos(finalAngle);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = (radius + scatter) * Math.sin(finalAngle);
    }
    return pos;
  }, []);
  
  // Generate colors based on radius position using seed for stability
  const colors = useMemo(() => {
    const col = new Float32Array(particleCount * 3);
    const colorPalette = [
      '#fff5d4', '#ffefb8', '#f7d36a', '#f0c84a', '#e8b82a', '#d9a31a', '#c89010',
      '#e84a9a', '#d63a8a', '#c73a8a', '#b52d7d', '#a32070', '#911363', '#7a0d56',
      '#6b2a96', '#5b2a86', '#4f2477', '#431e68', '#371859', '#2b124a',
      '#1a2a6c', '#152460', '#101e54', '#0b1848', '#0b1026',
    ];
    
    for (let i = 0; i < particleCount; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      const r = Math.sqrt(x * x + z * z);
      const normalizedR = Math.min(r / maxRadius, 1);
      
      // Use seed for color variation
      const colorSeed = i * 0.2 + 100;
      let colorIndex: number;
      if (normalizedR < 0.15) {
        colorIndex = seededRandom(colorSeed) * 3;
      } else if (normalizedR < 0.3) {
        colorIndex = 2 + seededRandom(colorSeed) * 4;
      } else if (normalizedR < 0.5) {
        colorIndex = 6 + seededRandom(colorSeed) * 6;
      } else if (normalizedR < 0.75) {
        colorIndex = 12 + seededRandom(colorSeed) * 5;
      } else {
        colorIndex = 17 + seededRandom(colorSeed) * 3;
      }
      
      const finalIndex = Math.floor(Math.min(colorIndex, colorPalette.length - 1));
      const color = new THREE.Color(colorPalette[finalIndex]);
      const brightness = 1.0 - normalizedR * 0.15;
      col[i * 3] = color.r * brightness;
      col[i * 3 + 1] = color.g * brightness;
      col[i * 3 + 2] = color.b * brightness;
    }
    return col;
  }, [positions]);
  
  // Subtle particle animation - removed internal rotation since parent group handles it
  useFrame((state) => {
    if (pointsRef.current) {
      const t = state.clock.elapsedTime;
      // Gentle floating motion only - no rotation, group handles that
      pointsRef.current.position.y = Math.sin(t * 0.1) * 0.3;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={2.5}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Website Galaxy Dust Cloud - Electric Nebula style with dispersed particles
function WebsiteGalaxyDustCloud({ perfMode = 'balanced' }: { perfMode?: string }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particleCount = perfMode === 'performance' ? 800 : perfMode === 'balanced' ? 2000 : 5000;
  const maxRadius = 280;

  // Generate nebula-style positions with seed
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const seed = i * 0.15 + 500;
      const theta = seededRandom(seed) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(seed + 1) - 1);

      const r = maxRadius * Math.pow(seededRandom(seed + 2), 0.6);
      const r2 = maxRadius * seededRandom(seed + 3) * 0.5 + 0.7 * maxRadius;
      const useOuter = seededRandom(seed + 4) > 0.4;
      const finalR = useOuter ? r2 : r;

      const distortion = 1 + seededRandom(seed + 5) * 0.3;
      const x = finalR * Math.sin(phi) * Math.cos(theta) * distortion;
      const y = (seededRandom(seed + 6) - 0.5) * maxRadius * 0.6;
      const z = finalR * Math.sin(phi) * Math.sin(theta) * distortion;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    return pos;
  }, []);

  // Colors for website galaxy
  const colors = useMemo(() => {
    const col = new Float32Array(particleCount * 3);
    const colorPalette = [
      '#0b0f1e', '#12182e', '#1a2340',
      '#4a1a8c', '#6a11cb', '#8b2fc9',
      '#0077b6', '#00b4d8', '#00c6ff',
      '#90e0ef', '#caf0f8', '#e6f7ff',
    ];

    for (let i = 0; i < particleCount; i++) {
      const x = positions[i * 3];
      const z = positions[i * 3 + 2];
      const r = Math.sqrt(x * x + z * z);
      const normalizedR = Math.min(r / maxRadius, 1);

      const colorSeed = i * 0.2 + 600;
      let colorIndex: number;
      if (normalizedR < 0.2) {
        colorIndex = 10 + seededRandom(colorSeed) * 2;
      } else if (normalizedR < 0.5) {
        colorIndex = 5 + seededRandom(colorSeed) * 4;
      } else {
        colorIndex = 2 + seededRandom(colorSeed) * 6;
      }

      const finalIndex = Math.floor(Math.min(colorIndex, colorPalette.length - 1));
      const color = new THREE.Color(colorPalette[finalIndex]);
      const brightness = 0.85 + normalizedR * 0.15;
      col[i * 3] = color.r * brightness;
      col[i * 3 + 1] = color.g * brightness;
      col[i * 3 + 2] = color.b * brightness;
    }
    return col;
  }, [positions]);

  // Slower, more ethereal animation - removed internal rotation since parent group handles it
  useFrame((state) => {
    if (pointsRef.current) {
      const t = state.clock.elapsedTime;
      // Gentle floating motion only - no rotation, group handles that
      pointsRef.current.position.y = Math.sin(t * 0.08) * 0.5;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        size={2.5} // Slightly larger particles for cloud effect
      />
    </points>
  );
}

// Animation speed settings
type AnimationSpeed = 'slow' | 'normal' | 'instant';
const ANIMATION_DURATIONS: Record<AnimationSpeed, number> = {
  slow: 2500,
  normal: 1200,
  instant: 0,
};

// LocalStorage helpers
const getStoredCategory = (): string => {
  if (typeof window === 'undefined') return 'Other';
  return localStorage.getItem('deskflow-last-category') || 'Other';
};
const setStoredCategory = (cat: string, type: 'apps' | 'websites' = 'apps') => {
  const key = `deskflow-last-category-${type}`;
  console.log('[StorageDebug] Saving category to localStorage:', cat, 'key:', key);
  if (typeof window !== 'undefined') localStorage.setItem(key, cat);
};
const getStoredAnimationSpeed = (): AnimationSpeed => {
  if (typeof window === 'undefined') return 'normal';
  return (localStorage.getItem('deskflow-animation-speed') as AnimationSpeed) || 'normal';
};
const setStoredAnimationSpeed = (speed: AnimationSpeed) => {
  if (typeof window !== 'undefined') localStorage.setItem('deskflow-animation-speed', speed);
};

interface ActivityLog {
  id: number;
  timestamp: Date;
  app: string;
  category: string;
  duration: number;
  title?: string;
  project?: string;
  is_browser_tracking?: boolean;
  domain?: string;
  url?: string;
  duration_ms?: number;
}

interface PlanetData {
  name: string;
  category: string;
  color: string;
  time: number; // minutes
  sessions: number;
  radius: number;
  orbitRadius: number; // semi-major axis
  speed: number; // orbit speed
  orbitalPeriod?: number; // orbital period (from Kepler's 3rd Law)
  rotationSpeed?: number; // self-rotation speed
  eccentricity?: number; // orbital eccentricity (0 = circle, 0.9 = very elliptical)
  inclination?: number; // orbital tilt in radians
  longitudeOfPerihelion?: number; // where closest approach occurs
  moons: MoonData[];
  rings?: RingData[];
}

interface RingData {
  innerRadius: number;
  outerRadius: number;
  opacity: number;
  color: string;
  tilt: number;
}

interface MoonData {
  name: string;
  radius: number;
  orbitRadius: number;
  speed: number;
  color: string;
}

interface OrbitSystemProps {
  logs: ActivityLog[];
  websiteLogs?: ActivityLog[];
  appColors?: Record<string, string>;
  categoryOverrides?: Record<string, string>;
  websiteColors?: Record<string, string>;
  websiteCategoryOverrides?: Record<string, string>;
  selectedPeriod?: 'today' | 'week' | 'month' | 'all';
  onPeriodChange?: (period: 'today' | 'week' | 'month' | 'all') => void;
}

// FPS Counter + History component - tracks FPS over time and stores in ref for graph
function FPSCounter({ fpsDisplayRef, fpsHistoryRef }: { fpsDisplayRef: React.RefObject<HTMLDivElement | null>; fpsHistoryRef: React.MutableRefObject<number[]> }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  
  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / delta);
      if (fpsDisplayRef.current) {
        fpsDisplayRef.current.textContent = `${fps} FPS`;
        const frameTime = Math.round(1000 / fps);
        fpsDisplayRef.current.setAttribute('data-frame-time', `${frameTime}ms`);
      }
      // Store in history (keep last 60 samples = 60 seconds)
      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > 60) {
        fpsHistoryRef.current.shift();
      }
      frameCount.current = 0;
      lastTime.current = now;
    }
  });
  
  return null;
}

// FPS Line Graph component - renders SVG sparkline from history data
// NOTE: must NOT use useFrame/useThree (R3F hooks) — rendered outside <Canvas>
function FPSLineGraph({ fpsHistoryRef, width = 160, height = 40 }: { fpsHistoryRef: React.MutableRefObject<number[]>; width?: number; height?: number }) {
  const pathRef = useRef<string>('');
  const [path, setPath] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      const history = fpsHistoryRef.current;
      if (history.length < 2) return;
      
      const maxFps = 60;
      const points = history.map((fps, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - (Math.min(fps, maxFps) / maxFps) * height;
        return `${x},${y}`;
      });
      
      const newPath = `M ${points.join(' L ')}`;
      if (newPath !== pathRef.current) {
        pathRef.current = newPath;
        setPath(newPath);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [fpsHistoryRef, width, height]);
  
  if (fpsHistoryRef.current.length < 2) {
    return <div className="text-zinc-500 text-xs">Collecting data...</div>;
  }
  
  const latestFps = fpsHistoryRef.current[fpsHistoryRef.current.length - 1] || 0;
  const avgFps = Math.round(fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Trend (60s)</span>
        <span className="text-emerald-400 font-mono">{avgFps} avg</span>
      </div>
      <svg width={width} height={height} className="bg-zinc-800/50 rounded">
        {/* Grid lines */}
        <line x1="0" y1={height * 0.33} x2={width} y2={height * 0.33} stroke="#3f3f46" strokeWidth="1" />
        <line x1="0" y1={height * 0.66} x2={width} y2={height * 0.66} stroke="#3f3f46" strokeWidth="1" />
        {/* FPS line */}
        <path d={path} fill="none" stroke={latestFps >= 50 ? '#10b981' : latestFps >= 30 ? '#f59e0b' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Area fill */}
        <path d={`${path} L ${width},${height} L 0,${height} Z`} fill={latestFps >= 50 ? 'rgba(16,185,129,0.1)' : latestFps >= 30 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'} />
      </svg>
    </div>
  );
}

const APP_CATEGORIES: Record<string, { cat: string; color: string }> = {
  'VS Code': { cat: 'IDE', color: '#4f46e5' },
  'PyCharm': { cat: 'IDE', color: '#10b981' },
  'IntelliJ IDEA': { cat: 'IDE', color: '#10b981' },
  'Obsidian': { cat: 'IDE', color: '#7c3aed' },
  'Claude': { cat: 'AI Tools', color: '#8b5cf6' },
  'ChatGPT': { cat: 'AI Tools', color: '#8b5cf6' },
  'Chrome': { cat: 'Browser', color: '#3b82f6' },
  'Firefox': { cat: 'Browser', color: '#f97316' },
  'YouTube': { cat: 'Entertainment', color: '#ef4444' },
  'Slack': { cat: 'Communication', color: '#14b8a6' },
  'Figma': { cat: 'Design', color: '#a855f7' },
  'Terminal': { cat: 'Productivity', color: '#64748b' },
  'Wispr Flow': { cat: 'Tools', color: '#f59e0b' },
  'Google Chrome': { cat: 'Browser', color: '#3b82f6' },
  'Windows Explorer': { cat: 'Productivity', color: '#64748b' },
  'Microsoft Edge': { cat: 'Browser', color: '#3b82f6' },
  'Notion': { cat: 'Productivity', color: '#10b981' },
  'Discord': { cat: 'Communication', color: '#14b8a6' },
  'Spotify': { cat: 'Entertainment', color: '#ec4899' },
  'Netflix': { cat: 'Entertainment', color: '#ef4444' },
};

// Predefined vivid palette — guaranteed distinct, no red dominance
const VIVID_PALETTE = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#84cc16', // Lime
  '#e879f9', // Fuchsia
  '#22d3ee', // Sky cyan
];

// Category color map — each category has a primary hue family
const CATEGORY_COLOR_FAMILIES: Record<string, string[]> = {
  'IDE': ['#6366f1', '#8b5cf6', '#7c3aed'], // Indigo/Violet family
  'AI Tools': ['#8b5cf6', '#a78bfa', '#c084fc'], // Purple family
  'Browser': ['#3b82f6', '#06b6d4', '#22d3ee'], // Blue/Cyan family
  'Entertainment': ['#ec4899', '#f43f5e', '#f97316'], // Pink/Orange family
  'Communication': ['#14b8a6', '#06b6d4', '#10b981'], // Teal/Green family
  'Design': ['#a855f7', '#e879f9', '#ec4899'], // Purple/Pink family
  'Productivity': ['#10b981', '#84cc16', '#22c55e'], // Green family
  'Tools': ['#f59e0b', '#f97316', '#fb923c'], // Amber/Orange family
  'Other': ['#64748b', '#94a3b8', '#78716c'], // Slate family
};

// Generate a distinct vivid color for each app index
function getDistinctColor(index: number): string {
  return VIVID_PALETTE[index % VIVID_PALETTE.length];
}

// Get a color from the category family, varied by index within category
function getCategoryColor(category: string, indexInCategory: number): string {
  const family = CATEGORY_COLOR_FAMILIES[category] || CATEGORY_COLOR_FAMILIES['Other'];
  return family[indexInCategory % family.length];
}

// Compute planet data from logs with optional custom colors and category overrides
// Includes all desktop apps including browsers, only excludes browser-tracked websites

// ============================================
// ORBITAL MECHANICS - Based on Kepler's Laws
// ============================================

// Configuration constants - Realism-enhanced orbital physics
const ORBIT_CONFIG = {
  minOrbitRadius: 10,
  maxOrbitRadius: 110,
  spacingExponent: 0.8,
  baseAngularSpeed: 2.0,
  minAngularSpeed: 0.08,
  sunRadius: 5,
  sunGlowSize: 6,
};
const SUN_RENDER_SIZE = 4;

const PLANET_COLOR_FAMILIES: Record<string, { h: number; s: number; l: number }> = {
  'IDE': { h: 38, s: 85, l: 55 },
  'AI Tools': { h: 270, s: 75, l: 60 },
  'Browser': { h: 217, s: 80, l: 58 },
  'Entertainment': { h: 347, s: 85, l: 55 },
  'Communication': { h: 173, s: 75, l: 55 },
  'Design': { h: 348, s: 80, l: 50 },
  'Productivity': { h: 50, s: 80, l: 55 },
  'Tools': { h: 25, s: 85, l: 53 },
  'Other': { h: 240, s: 10, l: 55 },
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getPlanetColor(category: string, planetName: string): string {
  const family = PLANET_COLOR_FAMILIES[category] || PLANET_COLOR_FAMILIES['Other'];
  const seed = hashString(planetName) % 1000;
  const hueShift = ((seed / 1000) - 0.5) * 24;
  const satShift = ((seed / 1000) - 0.5) * 16;
  const h = ((family.h + hueShift) % 360 + 360) % 360;
  const s = Math.max(0, Math.min(100, family.s + satShift));
  return `hsl(${h}, ${s}%, ${family.l}%)`;
}

function calculateOrbitRadius(planetIndex: number, totalPlanets: number): number {
  const t = totalPlanets > 1 ? planetIndex / (totalPlanets - 1) : 0.5;
  const { minOrbitRadius, maxOrbitRadius, spacingExponent } = ORBIT_CONFIG;
  return minOrbitRadius + (maxOrbitRadius - minOrbitRadius) * Math.pow(t, spacingExponent);
}

function calculateAngularSpeed(radius: number): number {
  const { baseAngularSpeed, minAngularSpeed, maxOrbitRadius } = ORBIT_CONFIG;
  const keplerSpeed = baseAngularSpeed / Math.pow(radius, 1.5);
  const visualBoost = Math.max(0, 0.25 * (1 - radius / maxOrbitRadius));
  return Math.max(keplerSpeed + visualBoost, minAngularSpeed);
}

function calculateOrbitalPeriod(radius: number): number {
  const { baseAngularSpeed } = ORBIT_CONFIG;
  return (2 * Math.PI / baseAngularSpeed) * Math.pow(radius, 1.5);
}

function computeEccentricity(planetIndex: number, totalPlanets: number): number {
  const t = planetIndex / Math.max(totalPlanets - 1, 1);
  const noise = (seededRandom(planetIndex * 7.3 + 13.7) - 0.5) * 0.03;
  return 0.15 - 0.12 * t + noise;
}

function computeInclination(planetName: string): number {
  const seed = hashString(planetName) % 1000;
  return (seed / 1000) * 6;
}

const MAX_RENDERED_PLANETS = 80;
const MIN_PLANET_TIME_SECONDS = 30;

function computePlanets(logs: ActivityLog[], appColors?: Record<string, string>, categoryOverrides?: Record<string, string>): PlanetData[] {
  // Fallback: load category overrides directly from localStorage to ensure sync
  let effectiveOverrides = categoryOverrides;
  if (!effectiveOverrides || Object.keys(effectiveOverrides).length === 0) {
    try {
      const saved = localStorage.getItem('deskflow-app-category-overrides');
      if (saved) {
        effectiveOverrides = JSON.parse(saved);
      }
    } catch { /* ignore */ }
  }

  // Filter: include all apps including browsers, only exclude browser-tracked websites
  const validLogs = (logs || []).filter((log: any) =>
    log && log.app && typeof log.app === 'string' && log.app.trim().length > 0 &&
    !log.is_browser_tracking // Exclude websites but include all desktop apps including browsers
  );

  if (validLogs.length === 0) {
    // Return demo data with CLEAR spacing from sun
    // Planet 1: radius 12 (close to sun)
    // Planet 2: radius 35 (middle)
    // Planet 3: radius 60 (far)
    // Planet 4: radius 80 (furthest)
    return [
      { name: 'VS Code', category: 'IDE', color: '#FCD34D', time: 120, sessions: 5, radius: 0.8, orbitRadius: 12, speed: calculateAngularSpeed(12), orbitalPeriod: calculateOrbitalPeriod(12), eccentricity: 0.05, inclination: 0.05, longitudeOfPerihelion: 0, moons: [], rings: [{ innerRadius: 2.2, outerRadius: 3.8, opacity: 0.45, color: '#6366f1', tilt: 0.2 }] },
      { name: 'Chrome', category: 'Browser', color: '#F97316', time: 45, sessions: 3, radius: 0.6, orbitRadius: 35, speed: calculateAngularSpeed(35), orbitalPeriod: calculateOrbitalPeriod(35), eccentricity: 0.08, inclination: 0.1, longitudeOfPerihelion: 1.2, moons: [], rings: [] },
      { name: 'Claude', category: 'AI Tools', color: '#10B981', time: 60, sessions: 4, radius: 0.7, orbitRadius: 60, speed: calculateAngularSpeed(60), orbitalPeriod: calculateOrbitalPeriod(60), eccentricity: 0.1, inclination: 0.15, longitudeOfPerihelion: 2.1, moons: [], rings: [] },
      { name: 'Slack', category: 'Communication', color: '#06B6D4', time: 30, sessions: 2, radius: 0.5, orbitRadius: 80, speed: calculateAngularSpeed(80), orbitalPeriod: calculateOrbitalPeriod(80), eccentricity: 0.06, inclination: 0.08, longitudeOfPerihelion: 0.5, moons: [], rings: [] },
    ];
  }

  // Calculate stats for meaningful planet properties
  const totalTime = validLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
  const maxTime = maxOf(Object.values(
    validLogs.reduce((acc: Record<string, number>, log) => {
      acc[log.app] = (acc[log.app] || 0) + (log.duration || 0);
      return acc;
    }, {})
  ), 1);

  // Group by app name
  const grouped: Record<string, any[]> = {};
  for (const log of validLogs) {
    const appName = log.app.trim();
    if (!grouped[appName]) grouped[appName] = [];
    grouped[appName].push(log);
  }

  // Sort by time ASCENDING: least used = closest to sun, most used = furthest
  const sortedApps = Object.entries(grouped)
    .sort(([, a], [, b]) => {
      const timeA = a.reduce((sum, l) => sum + (l.duration || 0), 0);
      const timeB = b.reduce((sum, l) => sum + (l.duration || 0), 0);
      return timeA - timeB; // ascending: smallest first (closest to sun)
    })
    // Performance cap: exclude trivial apps (< 30s) and limit to top 80
    .filter(([, a]) => {
      const time = a.reduce((sum, l) => sum + (l.duration || 0), 0);
      return time >= MIN_PLANET_TIME_SECONDS;
    })
    .slice(-MAX_RENDERED_PLANETS);

  const categoryCount: Record<string, number> = {};

  // Use map() as per the full spec
  const planets: PlanetData[] = sortedApps.map(([appName, appLogs], idx) => {
    // Priority: user override → database category → fallback dict → 'Other'
    const dbCategory = appLogs[0]?.category;
    const catInfo = APP_CATEGORIES[appName] || { cat: 'Other', color: '#64748b' };
    const category = effectiveOverrides?.[appName.toLowerCase()] || dbCategory || catInfo.cat || 'Other';

    // Check for user override colors first
    const customColor = appColors?.[appName];

    // Assign color: custom override > category family color > fallback palette
    const idxInCategory = categoryCount[category] || 0;
    categoryCount[category] = idxInCategory + 1;
    const color = customColor || getCategoryColor(category, idxInCategory);

    // Planet physics calculations
    const appTime = appLogs.reduce((sum: number, l: any) => sum + (l.duration || 0), 0);
    const sessions = appLogs.length;
    const avgSessionLength = appTime / sessions;

    // Planet size based on usage (more usage = larger)
    const timeRatio = maxTime > 0 ? appTime / maxTime : 0.5;
    const baseSize = 0.3;
    const sizeMultiplier = 0.5 + timeRatio * 0.5;
    const radius = Math.max(0.3, Math.min(1.5, baseSize * sizeMultiplier));

    // Orbit radius - power-law spacing for realistic distribution
    const orbitRadius = calculateOrbitRadius(idx, sortedApps.length);

    // Angular speed using Kepler's 3rd Law
    const angularSpeed = calculateAngularSpeed(orbitRadius);
    const orbitalPeriod = calculateOrbitalPeriod(orbitRadius);

    // Eccentricity — outer planets more eccentric
    const eccentricity = computeEccentricity(idx, sortedApps.length);

    // Inclination — deterministic by name hash, ~0–6°
    const inclination = computeInclination(appName) * (Math.PI / 180);

    // Longitude of perihelion (where in orbit planet starts) — deterministic by index
    const longitudeOfPerihelion = seededRandom(idx * 31.7 + 7.1) * Math.PI * 2;

    // Planet rotation speed (based on session length)
    const rotationRatio = maxTime > 0 ? avgSessionLength / (maxTime + 1) : 0.5;
    const rotationSpeed = 0.5 + rotationRatio * 1.5;

    // Moons (projects)
    const projects = [...new Set(appLogs.map((l: any) => l.project).filter((p: any) => p && typeof p === 'string'))] as string[];
    const moons = projects.slice(0, 3).map((proj: string, mIdx: number) => ({
      name: proj,
      radius: 0.25,
      orbitRadius: 1.5 + mIdx * 0.3,
      speed: 1.2 + mIdx * 0.3,
      color: color + '88'
    }));

    // Rings (C1) — top 25% of apps by total time get determined rings
    const rings: RingData[] = [];
    const totalApps = sortedApps.length;
    const top25Threshold = Math.ceil(totalApps * 0.75);
    const isTop25 = idx >= top25Threshold;
    if (isTop25) {
      const rgb = hexToRgb(color);
      const ringColor = `#${((1 << 24) + (Math.min(255, Math.floor(rgb.r * 0.85) + 30) << 16) + (Math.min(255, Math.floor(rgb.g * 0.85) + 30) << 8) + Math.min(255, Math.floor(rgb.b * 0.85) + 30)).toString(16).slice(1)}`;
      const tilt = ((idx / totalApps) * 0.6) - 0.3;
      rings.push({
        innerRadius: radius * 2.2,
        outerRadius: radius * 3.5,
        opacity: 0.3 + (idx - top25Threshold) / (totalApps - top25Threshold) * 0.2,
        color: ringColor,
        tilt: tilt,
      });
    }

    return {
      name: appName,
      category: category,
      color: getPlanetColor(category, appName),
      time: appTime,
      sessions: sessions,
      radius: radius,
      orbitRadius: orbitRadius,
      speed: angularSpeed,
      orbitalPeriod: orbitalPeriod,
      rotationSpeed: rotationSpeed,
      eccentricity: eccentricity,
      inclination: inclination,
      longitudeOfPerihelion: longitudeOfPerihelion,
      moons: moons,
      rings: rings,
    };
  });

return planets;
}

// Helper: parse hex color to RGB
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 128, g: 128, b: 128 };
}

// Helper: lighten/darken hex color
function adjustColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const factor = 1 + percent / 100;
  const r = Math.min(255, Math.max(0, Math.floor(rgb.r * factor)));
  const g = Math.min(255, Math.max(0, Math.floor(rgb.g * factor)));
  const b = Math.min(255, Math.max(0, Math.floor(rgb.b * factor)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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

// Sun Component — multi-layer realistic star with corona, animated surface, lens flare
function Sun({ category = 'Other', size = 3.5 }: { category?: string; size?: number }) {
  const innerGlowRef = useRef<THREE.Sprite>(null!);
  const outerCoronaRef = useRef<THREE.Sprite>(null!);
  const lensFlare1Ref = useRef<THREE.Sprite>(null!);
  const lensFlare2Ref = useRef<THREE.Sprite>(null!);
  const surfaceMatRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Animated solar surface texture (granulation / convection cells)
  const { surfaceTexture, glowTexture, coronaTexture } = useMemo(() => {
    // Surface texture — granulation pattern like real sun photosphere
    const surfCanvas = document.createElement('canvas');
    surfCanvas.width = 512;
    surfCanvas.height = 256;
    const surfCtx = surfCanvas.getContext('2d')!;

    const drawSurface = () => {
      // Base yellow-white
      surfCtx.fillStyle = '#fff8e1';
      surfCtx.fillRect(0, 0, 512, 256);

      // Granulation cells — darker patches simulating convection
      const rng = createSeededRandom(42);
      for (let i = 0; i < 600; i++) {
        const x = rng() * 512;
        const y = rng() * 256;
        const r = 3 + rng() * 12;
        const brightness = 200 + Math.floor(rng() * 55);
        const warmth = Math.floor(rng() * 40);
        surfCtx.fillStyle = `rgba(${brightness + warmth}, ${brightness + Math.floor(warmth * 0.6)}, ${brightness - warmth}, ${0.08 + rng() * 0.15})`;
        surfCtx.beginPath();
        surfCtx.arc(x, y, r, 0, Math.PI * 2);
        surfCtx.fill();
      }

      // Bright spots (faculae)
      for (let i = 0; i < 80; i++) {
        const x = rng() * 512;
        const y = rng() * 256;
        const r = 2 + rng() * 6;
        surfCtx.fillStyle = `rgba(255, 255, 240, ${0.1 + rng() * 0.2})`;
        surfCtx.beginPath();
        surfCtx.arc(x, y, r, 0, Math.PI * 2);
        surfCtx.fill();
      }
    };
    drawSurface();

    const surfTex = new THREE.CanvasTexture(surfCanvas);
    surfTex.wrapS = THREE.RepeatWrapping;
    surfTex.wrapT = THREE.RepeatWrapping;
    surfTex.needsUpdate = true;

    // Middle glow — rich solar gradient
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 512;
    glowCanvas.height = 512;
    const glowCtx = glowCanvas.getContext('2d')!;
    const grad = glowCtx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, 'rgba(255, 255, 230, 1.0)');
    grad.addColorStop(0.08, 'rgba(255, 240, 120, 0.85)');
    grad.addColorStop(0.2, 'rgba(255, 200, 50, 0.55)');
    grad.addColorStop(0.4, 'rgba(255, 160, 20, 0.25)');
    grad.addColorStop(0.6, 'rgba(255, 120, 10, 0.08)');
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    glowCtx.fillStyle = grad;
    glowCtx.fillRect(0, 0, 512, 512);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.needsUpdate = true;

    // Outer corona — large faint heat radiation halo
    const coronaCanvas = document.createElement('canvas');
    coronaCanvas.width = 512;
    coronaCanvas.height = 512;
    const coronaCtx = coronaCanvas.getContext('2d')!;
    const cGrad = coronaCtx.createRadialGradient(256, 256, 30, 256, 256, 256);
    cGrad.addColorStop(0, 'rgba(255, 200, 80, 0.18)');
    cGrad.addColorStop(0.25, 'rgba(255, 160, 40, 0.08)');
    cGrad.addColorStop(0.5, 'rgba(255, 120, 20, 0.03)');
    cGrad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    coronaCtx.fillStyle = cGrad;
    coronaCtx.fillRect(0, 0, 512, 512);
    const coronaTex = new THREE.CanvasTexture(coronaCanvas);
    coronaTex.needsUpdate = true;

    return { surfaceTexture: surfTex, glowTexture: glowTex, coronaTexture: coronaTex };
  }, []);

  // Lens flare textures
  const { flareTex1, flareTex2 } = useMemo(() => {
    const makeFlare = (color: string, size: number) => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      return t;
    };
    return {
      flareTex1: makeFlare('rgba(255, 255, 200, 0.4)', 64),
      flareTex2: makeFlare('rgba(255, 180, 80, 0.15)', 128),
    };
  }, []);

  useFrame(() => {
    const t = Date.now() * 0.001;

    // Animate surface texture offset for shifting granulation
    if (surfaceMatRef.current && surfaceMatRef.current.map) {
      surfaceMatRef.current.map.offset.x = Math.sin(t * 0.05) * 0.02;
      surfaceMatRef.current.map.offset.y = Math.cos(t * 0.07) * 0.01;
    }

    // Inner glow pulsation
    if (innerGlowRef.current) {
      const pulse = 1 + Math.sin(t * 1.5) * 0.04 + Math.sin(t * 3.7) * 0.02;
      innerGlowRef.current.scale.set(12 * pulse, 12 * pulse, 1);
    }

    // Outer corona slow breathing
    if (outerCoronaRef.current) {
      const breathe = 1 + Math.sin(t * 0.8) * 0.06;
      outerCoronaRef.current.scale.set(25 * breathe, 25 * breathe, 1);
    }

    // Lens flares
    if (lensFlare1Ref.current) {
      const p1 = 1 + Math.sin(t * 2.1) * 0.15;
      lensFlare1Ref.current.scale.set(8 * p1, 8 * p1, 1);
      lensFlare1Ref.current.material.opacity = 0.3 + Math.sin(t * 1.8) * 0.1;
    }
    if (lensFlare2Ref.current) {
      const p2 = 1 + Math.sin(t * 1.3 + 1) * 0.2;
      lensFlare2Ref.current.scale.set(16 * p2, 16 * p2, 1);
      lensFlare2Ref.current.material.opacity = 0.15 + Math.sin(t * 0.9) * 0.05;
    }
  });

  const sunConfig = SUN_CONFIGS[category] || DEFAULT_SUN_CONFIG;
  const sunRadius = size || 3.5;

  // Update sprite scales to match sun radius
  useEffect(() => {
    if (innerGlowRef.current) innerGlowRef.current.scale.set(sunRadius * 4, sunRadius * 4, 1);
    if (outerCoronaRef.current) outerCoronaRef.current.scale.set(sunRadius * 7, sunRadius * 7, 1);
  }, [sunRadius]);

  return (
    <group>
      {/* Core sphere — size based on category config */}
      <mesh>
        <sphereGeometry args={[sunRadius, 64, 64]} />
        <meshStandardMaterial
          map={surfaceTexture}
          ref={surfaceMatRef}
          emissive={new THREE.Color(sunConfig.emissive)}
          emissiveIntensity={2.5}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Inner glow / corona — bright halo */}
      <sprite ref={innerGlowRef} scale={[sunRadius * 4, sunRadius * 4, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.95}
          toneMapped={false}
        />
      </sprite>

      {/* Middle corona layer */}
      <sprite scale={[sunRadius * 5.5, sunRadius * 5.5, 1]}>
        <spriteMaterial
          map={coronaTexture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.6}
          toneMapped={false}
        />
      </sprite>

      {/* Outer corona — large heat radiation halo */}
      <sprite ref={outerCoronaRef} scale={[sunRadius * 7, sunRadius * 7, 1]}>
        <spriteMaterial
          map={coronaTexture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.4}
          toneMapped={false}
        />
      </sprite>

      {/* Lens flare artifacts — simulate bright light scattering */}
      <sprite ref={lensFlare1Ref} position={[8, 5, 10]}>
        <spriteMaterial
          map={flareTex1}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.4}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={lensFlare2Ref} position={[-6, -4, 8]}>
        <spriteMaterial
          map={flareTex2}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.2}
          toneMapped={false}
        />
      </sprite>

      {/* Primary point light — tinted by category color */}
      <pointLight
        position={[0, 0, 0]}
        color={sunConfig.color}
        intensity={8.0}
        distance={500}
        decay={2}
      />

      {/* Secondary softer light — ambient warmth */}
      <pointLight
        position={[0, 0, 0]}
        color={sunConfig.color}
        intensity={3.0}
        distance={300}
        decay={2}
      />
    </group>
  );
}

// Make a canvas texture tile seamlessly left-to-right on a sphere.
// Blends a strip from the right edge into the left edge (and vice versa)
// so the horizontal boundary has no visible color jump.
function makeSeamlessHorizontal(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const blendWidth = 60; // px to blend

  // Step 1: Draw right-edge strip onto left edge with decreasing opacity
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = blendWidth;
  stripCanvas.height = h;
  const stripCtx = stripCanvas.getContext('2d')!;
  stripCtx.drawImage(ctx.canvas, w - blendWidth, 0, blendWidth, h, 0, 0, blendWidth, h);

  // Fade out the strip
  const fadeGrad = stripCtx.createLinearGradient(0, 0, blendWidth, 0);
  fadeGrad.addColorStop(0, 'rgba(0,0,0,1)');
  fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
  stripCtx.globalCompositeOperation = 'destination-in';
  stripCtx.fillStyle = fadeGrad;
  stripCtx.fillRect(0, 0, blendWidth, h);
  stripCtx.globalCompositeOperation = 'source-over';

  // Paint faded right strip onto left edge
  ctx.drawImage(stripCanvas, 0, 0);

  // Step 2: Same thing in reverse — left strip onto right edge
  const leftStrip = document.createElement('canvas');
  leftStrip.width = blendWidth;
  leftStrip.height = h;
  const leftCtx = leftStrip.getContext('2d')!;
  leftCtx.drawImage(ctx.canvas, 0, 0, blendWidth, h, 0, 0, blendWidth, h);

  const fadeGrad2 = leftCtx.createLinearGradient(0, 0, blendWidth, 0);
  fadeGrad2.addColorStop(0, 'rgba(0,0,0,0)');
  fadeGrad2.addColorStop(1, 'rgba(0,0,0,1)');
  leftCtx.globalCompositeOperation = 'destination-in';
  leftCtx.fillStyle = fadeGrad2;
  leftCtx.fillRect(0, 0, blendWidth, h);
  leftCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(leftStrip, w - blendWidth, 0);
}

// Create bold procedural texture based on category with unique seed-based variation
// Phase 2 Batch 2: Proper planet patterns (bands, spirals, spots, networks)
// Reference: ORBITAL_IMPROVEMENTS.md → Issue #3 + Texture Variety
function createProceduralTexture(color: string, category: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallback = document.createElement('canvas');
    fallback.width = 64;
    fallback.height = 64;
    const fCtx = fallback.getContext('2d')!;
    fCtx.fillStyle = color;
    fCtx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(fallback);
    tex.needsUpdate = true;
    return tex;
  }

  const rand = createSeededRandom(seed);

  // Brighter space base for visibility against black space
  ctx.fillStyle = '#1e1e40';
  ctx.fillRect(0, 0, 512, 256);

  const baseColor = color;
  const darkColor = adjustColor(color, -15);  // Less darkening
  const lightColor = adjustColor(color, 70);   // Brighter highlights
  const lighterColor = adjustColor(color, 130); // More vivid highlights

  if (category === 'IDE' || category === 'Productivity') {
    // Gas giant bands like Jupiter
    const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
    baseGrad.addColorStop(0, darkColor);
    baseGrad.addColorStop(0.5, baseColor);
    baseGrad.addColorStop(1, darkColor);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Multiple colored bands
    const bandCount = 8 + Math.floor(rand() * 5);
    for (let i = 0; i < bandCount; i++) {
      const y = rand() * 480;
      const h = 30 + rand() * 50;
      const c = rand() > 0.5 ? lightColor : lighterColor;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.7 + rand() * 0.3;
      ctx.fillRect(0, y, 512, h);
    }
    ctx.globalAlpha = 1;

    // Turbulence lines
    for (let i = 0; i < 25; i++) {
      const y = rand() * 256;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 + rand() * 4;
      ctx.globalAlpha = 0.3 + rand() * 0.3;
      ctx.beginPath();
      const phase = rand() * Math.PI * 2;
      for (let x = 0; x < 512; x += 8) {
        const offset = Math.sin(x * 0.015 + phase) * (8 + rand() * 8);
        if (x === 0) ctx.moveTo(x, y + offset);
        else ctx.lineTo(x, y + offset);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

  } else if (category === 'AI Tools') {
    // Spiral galaxy pattern
    const centerX = 200 + rand() * 624;
    const centerY = 100 + rand() * 312;
    
    const bgGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 400);
    bgGrad.addColorStop(0, lighterColor);
    bgGrad.addColorStop(0.5, baseColor);
    bgGrad.addColorStop(1, '#1e1e40');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Spiral arms
    const armCount = 3 + Math.floor(rand() * 3);
    const rotationOffset = rand() * Math.PI * 2;
    for (let arm = 0; arm < armCount; arm++) {
      const offset = (arm / armCount) * Math.PI * 2 + rotationOffset;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 + rand() * 6;
      ctx.globalAlpha = 0.6 + rand() * 0.4;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 4; angle += 0.08) {
        const radius = angle * (15 + rand() * 8);
        const x = centerX + Math.cos(angle + offset) * radius;
        const y = centerY + Math.sin(angle + offset) * radius * 0.6;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Glowing nodes
    const nodeCount = 20 + Math.floor(rand() * 25);
    for (let i = 0; i < nodeCount; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 8 + rand() * 15;
      const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glowGrad.addColorStop(0, '#ffffff');
      glowGrad.addColorStop(0.3, lightColor);
      glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (category === 'Browser' || category === 'Entertainment') {
    // Spotted/swirled pattern
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(1, '#1a1a40');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Colorful spots
    const spotCount = 25 + Math.floor(rand() * 30);
    for (let i = 0; i < spotCount; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 40 + rand() * 80;
      const spotColor = rand() > 0.5 ? lighterColor : lightColor;
      const spotGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
      spotGrad.addColorStop(0, spotColor);
      spotGrad.addColorStop(0.6, spotColor + '88');
      spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flow lines
    for (let i = 0; i < 10; i++) {
      const startY = rand() * 256;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 + rand() * 5;
      ctx.globalAlpha = 0.3 + rand() * 0.3;
      ctx.beginPath();
      for (let x = 0; x < 512; x += 8) {
        const y = startY + Math.sin(x * 0.01 + rand() * Math.PI * 2) * 30;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

  } else if (category === 'Communication') {
    // Network nodes pattern
    ctx.fillStyle = '#1a1a40';
    ctx.fillRect(0, 0, 512, 256);

    const nodes: {x: number, y: number, r: number}[] = [];
    const nodeCount = 30 + Math.floor(rand() * 30);
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({ x: rand() * 256, y: rand() * 256, r: 8 + rand() * 15 });
    }

    // Connections
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Bright nodes
    for (const node of nodes) {
      const nodeGrad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 2.5);
      nodeGrad.addColorStop(0, '#ffffff');
      nodeGrad.addColorStop(0.4, lightColor);
      nodeGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = nodeGrad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else {
    // Other: Noise pattern
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(1, '#222248');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    for (let i = 0; i < 1000; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.4})`;
      ctx.fillRect(x, y, 4 + rand() * 4, 4 + rand() * 4);
    }
  }

  // ── Seamless horizontal wrap ──
  // Blend left and right edges so there's no visible seam when wrapped on a sphere.
  // The leftmost column (x=0) and rightmost column (x=1024) become the same color.
  makeSeamlessHorizontal(ctx, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // RepeatWrapping for both S and T to properly tile around sphere
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

// Procedural normal map generator for surface depth
// Reference: ORBITAL_IMPROVEMENTS.md → Normal Maps
function createProceduralNormalMap(color: string, category: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const rand = createSeededRandom(seed);
  // Neutral normal map base (RGB = 0.5, 0.5, 1.0)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 256);

  if (category === 'IDE' || category === 'Productivity') {
    // Horizontal grooves for bands
    for (let i = 0; i < 18; i++) {
      const y = rand() * 256;
      ctx.fillStyle = '#4040c0'; // darker = depression
      ctx.fillRect(0, y, 512, 20 + rand() * 25);
    }
  } else if (category === 'AI Tools') {
    // Node bumps
    for (let i = 0; i < 50; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 15 + rand() * 30;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, '#c0c0ff');
      grad.addColorStop(1, '#8080ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (category === 'Browser' || category === 'Entertainment') {
    // Craters/spots
    for (let i = 0; i < 60; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 20 + rand() * 40;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, '#a0a0e0');
      grad.addColorStop(1, '#8080ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (category === 'Communication') {
    // Grid bumps
    for (let i = 0; i < 40; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const r = 10 + rand() * 20;
      ctx.fillStyle = '#9090ee';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Noise for Other
    for (let i = 0; i < 600; i++) {
      const x = rand() * 256;
      const y = rand() * 256;
      ctx.fillStyle = `rgba(${128 + rand() * 40 - 20}, ${128 + rand() * 40 - 20}, 255, 0.3)`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  const normalTexture = new THREE.CanvasTexture(canvas);
  normalTexture.colorSpace = THREE.NoColorSpace; // Normal maps must stay linear
  normalTexture.needsUpdate = true;
  return normalTexture;
}

// Elliptical Orbit Path Component
// Uses the exact same Keplerian formula as the planet's useFrame calculation
// Reference: ORBITAL_IMPROVEMENTS.md → Issue #2 → Visible elliptical orbit paths
function OrbitPath({ planet }: { planet: PlanetData }) {
  const points = useMemo(() => {
    const curvePoints: THREE.Vector3[] = [];
    const segments = 256;
    const eccentricity = planet.eccentricity || 0.1;
    const semiMajorAxis = planet.orbitRadius;
    const inclination = planet.inclination || 0;
    const longitudeOfPerihelion = planet.longitudeOfPerihelion || 0;
    const semiLatusRectum = semiMajorAxis * (1 - eccentricity * eccentricity);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const distance = semiLatusRectum / (1 + eccentricity * Math.cos(angle + longitudeOfPerihelion));
      const x = Math.cos(angle + longitudeOfPerihelion) * distance;
      const z = Math.sin(angle + longitudeOfPerihelion) * distance * Math.cos(inclination);
      const y = Math.sin(angle + longitudeOfPerihelion) * distance * Math.sin(inclination) * 0.3;
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    return curvePoints;
  }, [planet.orbitRadius, planet.eccentricity, planet.inclination, planet.longitudeOfPerihelion]);

  return (
    <Line
      points={points}
      color={planet.color}
      lineWidth={1.5}
      transparent
      opacity={0.17}
      renderOrder={-1}
    />
  );
}

// Textured Planet Component
function TexturedPlanet({
  data,
  isPaused,
  speedMultiplier,
  onClick,
  onPositionUpdate,
}: {
  data: PlanetData;
  isPaused: boolean;
  speedMultiplier: number;
  onClick: (data: PlanetData) => void;
  onPositionUpdate?: (name: string, position: THREE.Vector3) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);
  const hologramRef = useRef<THREE.Mesh>(null!);
  const labelRef = useRef<THREE.Group>(null!);
  const glowRef = useRef<THREE.Sprite>(null!);
  // Use seeded angle based on name so position is stable across component remounts
  // This prevents glitches when component remounts unexpectedly
  const initialAngle = useMemo(() => {
    const seed = hashString(data.name);
    return (seed / 1000000) * Math.PI * 2;
  }, [data.name]);
  const angleRef = useRef(initialAngle);
  const [isHovered, setIsHovered] = useState(false);
  const labelPosRef = useRef(new THREE.Vector3());
  const [cameraDist, setCameraDist] = useState(30);
  const distScaleRef = useRef(15);
  // C1: LOD geometry
  const { geometry: lodGeo, setDetail: setLODDetail, detail: lodDetail } = useLODGeometry(data.radius);
  const lastLODDetailRef = useRef(0);

  const texRef = useRef<{ disposer: (() => void) | null }>({ disposer: null });
  const { texture, normalMap, glowTexture } = useMemo(() => {
    texRef.current.disposer?.();
    const seed = hashString(data.name);
    const acquired = acquirePlanetTextures(data.color, data.category, seed);
    texRef.current.disposer = () => releasePlanetTextures(acquired.key);
    return { texture: acquired.texture, normalMap: acquired.normalMap, glowTexture: acquired.glowTexture };
  }, [data.name, data.color, data.category]);
  useEffect(() => () => texRef.current.disposer?.(), []);

  // Hologram wireframe geometry
  const hologramRef2 = useRef<{ disposer: (() => void) | null }>({ disposer: null });
  const hologramGeo = useMemo(() => {
    hologramRef2.current.disposer?.();
    const geo = new THREE.IcosahedronGeometry(data.radius * 1.6, 1);
    hologramRef2.current.disposer = () => geo.dispose();
    return geo;
  }, [data.radius]);
  useEffect(() => () => hologramRef2.current.disposer?.(), []);

  useFrame(({ camera }, delta) => {
    if (!meshRef.current) return;

    // Self-rotation
    const rotSpeed = data.rotationSpeed || 1.5;
    meshRef.current.rotation.y += (isPaused ? 0 : delta * rotSpeed * 2);

    // C1: Update LOD detail based on camera distance
    if (camera) {
      const worldPos = new THREE.Vector3();
      meshRef.current.getWorldPosition(worldPos);
      const dist = camera.position.distanceTo(worldPos);
      let nd: number;
      if (dist < 40) nd = 64;
      else if (dist < 80) nd = 32;
      else if (dist < 150) nd = 16;
      else nd = 8;
      if (nd !== lastLODDetailRef.current) {
        lastLODDetailRef.current = nd;
        setLODDetail(nd);
      }
    }

    // Orbital motion
    const dt = isPaused ? 0 : delta * speedMultiplier;
    angleRef.current += dt * data.speed * 2;
    const angle = angleRef.current;

    const eccentricity = data.eccentricity || 0.1;
    const semiMajorAxis = data.orbitRadius;
    const inclination = data.inclination || 0;
    const longitudeOfPerihelion = data.longitudeOfPerihelion || 0;
    const semiLatusRectum = semiMajorAxis * (1 - eccentricity * eccentricity);

    const distance = semiLatusRectum / (1 + eccentricity * Math.cos(angle + longitudeOfPerihelion));
    const x = Math.cos(angle + longitudeOfPerihelion) * distance;
    const z = Math.sin(angle + longitudeOfPerihelion) * distance * Math.cos(inclination);
    const y = Math.sin(angle + longitudeOfPerihelion) * distance * Math.sin(inclination) * 0.3;

    meshRef.current.position.set(x, y, z);

    // B13: Shadow mesh — rotate dark side to face away from sun (origin)
    if (shadowRef.current) {
      shadowRef.current.position.set(x, y, z);
      shadowRef.current.lookAt(new THREE.Vector3(x * 2, y * 2, z * 2));
    }

    // Report current position to parent for camera tracking
    if (onPositionUpdate) {
      onPositionUpdate(data.name, new THREE.Vector3(x, y, z));
    }

    // Position glow sprite at planet location
    if (glowRef.current) {
      glowRef.current.position.set(x, y, z);
      const t = Date.now() * 0.002;
      const pulse = 1 + Math.sin(t) * 0.1;
      const glowSize = data.radius * 4 * pulse;
      glowRef.current.scale.set(glowSize, glowSize, 1);
    }

    // C2: Activity pulse glow — emissive intensity pulses based on usage
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const pulseBase = 0.15 + (data.time / 3600) * 0.02;
    const pulseT = Date.now() * 0.001;
    const pulseVal = pulseBase + Math.sin(pulseT * 1.2 + angle) * 0.08;
    mat.emissiveIntensity = pulseVal;

    // B14: Distance-scaled labels — scale based on camera distance
    const camPos = camera.position;
    const dx = camPos.x - x;
    const dy = camPos.y - y;
    const dz = camPos.z - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    distScaleRef.current = dist;
    setCameraDist(dist);

    // Update label world position
    labelPosRef.current.set(x, y - data.radius - 1.0, z);
    if (labelRef.current) {
      labelRef.current.position.copy(labelPosRef.current);
    }

    // Position hologram shell at planet location
    if (hologramRef.current) {
      hologramRef.current.position.set(x, y, z);
    }

    // Hologram shell animation
    if (hologramRef.current) {
      const targetOpacity = isHovered ? 0.45 : 0;
      const hMat = hologramRef.current.material as THREE.MeshBasicMaterial;
      hMat.opacity += (targetOpacity - hMat.opacity) * Math.min(delta * 6, 1);
      hologramRef.current.rotation.y += delta * 0.5;
      hologramRef.current.rotation.x += delta * 0.2;
      const targetScale = isHovered ? 1.0 : 0.95;
      const cs = hologramRef.current.scale.x;
      const ns = cs + (targetScale - cs) * Math.min(delta * 5, 1);
      hologramRef.current.scale.setScalar(ns);
    }
  });

  return (
    <>
      {/* Glow sprite — always visible, helps see planet from far away */}
      <sprite ref={glowRef}>
        <spriteMaterial
          map={glowTexture}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.7}
        />
      </sprite>

      {/* B7: Orbit trail */}
      <OrbitTrail orbitRadius={data.orbitRadius} color={data.color} opacity={0.12} />

      {/* B9: Atmospheric scattering glow */}
      <AtmosphericScattering radius={data.radius} color={data.color} />

      {/* Moons */}
      {data.moons.map((moon) => (
        <Moon key={moon.name} moon={moon} parentRef={meshRef} isPaused={isPaused} speedMultiplier={speedMultiplier} />
      ))}
      
      {/* Rings */}
      {data.rings && data.rings.length > 0 && (
        <PlanetRings rings={data.rings} parentRef={meshRef} />
      )}

      {/* Hex-grid hologram shell on hover */}
      <mesh
        ref={hologramRef}
        geometry={hologramGeo}
        renderOrder={10}
      >
        <meshBasicMaterial
          color={data.color}
          wireframe
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* C1: LOD planet mesh - sphere detail depends on camera distance */}
      <mesh
        ref={meshRef}
        onClick={() => onClick(data)}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setIsHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <primitive object={lodGeo} attach="geometry" />
        <meshStandardMaterial
          map={texture}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.6, 0.6)}
          roughness={0.4}
          metalness={0.15}
          emissive={new THREE.Color(data.color)}
          emissiveIntensity={0.25}
          emissiveMap={texture}
        />
      </mesh>

      {/* B11/B13: Terminator shadow — dark side hemisphere overlay for eclipse effect */}
      <mesh ref={shadowRef}>
        <sphereGeometry args={[data.radius * 1.002, 32, 32]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.35}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Atmospheric glow (B8) — back-face translucent shell */}
      <mesh>
        <sphereGeometry args={[data.radius * 1.08, 48, 48]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* B14: Distance-scaled label — opacity/size scales with camera distance */}
      <group ref={labelRef}>
        <Html center distanceFactor={15}>
          <div
            style={{
              pointerEvents: 'none',
              opacity: isHovered ? 1 : Math.min(1, Math.max(0.3, 1 - (cameraDist - 15) / 120)),
              transform: `scale(${isHovered ? 1 : Math.min(1.2, Math.max(0.6, 20 / cameraDist + 0.5))})`,
              transition: 'opacity 0.2s ease',
              transformOrigin: 'center center',
              background: 'rgba(8, 8, 24, 0.95)',
              backdropFilter: 'blur(8px)',
              border: `1.5px solid ${isHovered ? data.color : 'rgba(255,255,255,0.18)'}`,
              borderRadius: '10px',
              padding: '5px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: isHovered ? data.color : '#ececec',
              whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
              boxShadow: isHovered ? `0 0 16px ${data.color}44` : '0 2px 8px rgba(0,0,0,0.4)',
              maxWidth: isHovered ? '200px' : `${Math.max(60, Math.min(200, 200 - (cameraDist - 15) * 2))}px`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data.name}{isHovered && <span style={{ marginLeft: '8px', opacity: 0.7, fontWeight: 400 }}>{formatDurationSeconds(data.time)}</span>}
          </div>
        </Html>
      </group>
    </>
  );
}

// C1: LOD geometry hook - returns { detail, geometry } with disposal
function useLODGeometry(radius: number) {
  const [detail, setDetail] = useState(32);
  const ref = useRef<{ lastDetail: number; disposer: (() => void) | null }>({ lastDetail: 0, disposer: null });

  const geometry = useMemo(() => {
    ref.current.disposer?.();
    const geo = new THREE.SphereGeometry(radius, detail, detail);
    ref.current.lastDetail = detail;
    const dispose = () => geo.dispose();
    ref.current.disposer = dispose;
    return geo;
  }, [radius, detail]);

  useEffect(() => () => ref.current.disposer?.(), []);

  return { geometry, setDetail, detail };
}

// Moon component orbiting around its parent planet
function Moon({
  moon,
  parentRef,
  isPaused,
  speedMultiplier,
}: {
  moon: MoonData;
  parentRef: React.MutableRefObject<THREE.Mesh>;
  isPaused: boolean;
  speedMultiplier: number;
}) {
  const moonRef = useRef<THREE.Mesh>(null!);
  const moonAngleRef = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    if (!moonRef.current || !parentRef.current) return;
    const dt = isPaused ? 0 : delta * speedMultiplier;
    moonAngleRef.current += dt * moon.speed * 0.5;

    const x = Math.cos(moonAngleRef.current) * moon.orbitRadius;
    const z = Math.sin(moonAngleRef.current) * moon.orbitRadius;
    const y = Math.sin(moonAngleRef.current * 0.7) * moon.orbitRadius * 0.3;

    moonRef.current.position.set(
      parentRef.current.position.x + x,
      parentRef.current.position.y + y,
      parentRef.current.position.z + z
    );
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[moon.radius, 16, 16]} />
      <meshStandardMaterial color={moon.color} roughness={0.8} metalness={0.2} />
    </mesh>
  );
}

// Planet Rings Component
function PlanetRings({
  rings,
  parentRef,
}: {
  rings: RingData[];
  parentRef: React.MutableRefObject<THREE.Mesh>;
}) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!groupRef.current || !parentRef.current) return;
    // Follow parent planet position
    groupRef.current.position.copy(parentRef.current.position);
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => {
        // Create ring geometry as a flat disc with inner/outer radius
        const shape = new THREE.Shape();
        const outerSegments = 128;
        const innerSegments = 128;

        // Outer circle (clockwise)
        for (let j = 0; j <= outerSegments; j++) {
          const angle = (j / outerSegments) * Math.PI * 2;
          const x = Math.cos(angle) * ring.outerRadius;
          const y = Math.sin(angle) * ring.outerRadius;
          if (j === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        }

        // Inner circle (counter-clockwise hole)
        const holePath = new THREE.Path();
        for (let j = 0; j <= innerSegments; j++) {
          const angle = (j / innerSegments) * Math.PI * 2;
          const x = Math.cos(angle) * ring.innerRadius;
          const y = Math.sin(angle) * ring.innerRadius;
          if (j === 0) holePath.moveTo(x, y);
          else holePath.lineTo(x, y);
        }
        shape.holes.push(holePath);

        const geometry = new THREE.ShapeGeometry(shape, 1);
        // Rotate to lie flat on XZ plane
        geometry.rotateX(-Math.PI / 2);

        return (
          <mesh
            key={i}
            geometry={geometry}
            rotation={[ring.tilt, 0, 0.1]}
          >
            <meshStandardMaterial
              color={ring.color}
              transparent
              opacity={ring.opacity}
              side={THREE.DoubleSide}
              roughness={0.8}
              metalness={0.1}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// B7: Orbit trail with fading opacity
function OrbitTrail({ orbitRadius, color, opacity = 0.15 }: { orbitRadius: number; color: string; opacity?: number }) {
  const trailRef = useRef<any>(null);
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([Math.cos(a) * orbitRadius, 0, Math.sin(a) * orbitRadius]);
    }
    return pts;
  }, [orbitRadius]);

  return (
    <Line
      ref={trailRef}
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={opacity}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  );
}

// B9: Simplified atmospheric scattering (Nishita-style)
function AtmosphericScattering({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.08, 32, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.08}
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// C2: Reduced particle count for performance - adaptive based on camera distance
function AsteroidBelt({
  radius,
  count,
  isPaused,
  camera,
}: {
  radius: number;
  count: number;
  isPaused: boolean;
  camera?: THREE.Camera;
}) {
  const groupRef = useRef<THREE.Group>(null!);

  // Compute adaptive particle count based on distance
  const effectiveCount = useMemo(() => {
    if (!camera) return count;
    // Simple approximation: if camera is far, reduce particles
    // Use distance from origin as proxy for camera distance
    const camDist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const ratio = Math.min(1, Math.max(0.2, 1 - camDist / 500));
    return Math.max(10, Math.floor(count * ratio));
  }, [count, camera]);

  useFrame((_, delta) => {
    if (groupRef.current && !isPaused) {
      groupRef.current.rotation.y += delta * 0.02;
    }
  });

  const asteroids = useMemo(() => {
    return Array.from({ length: effectiveCount }, (_, i) => {
      const angle = (i / effectiveCount) * Math.PI * 2;
      const r = radius + (Math.random() - 0.5) * 3;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = (Math.random() - 0.5) * 1.5;
      const scale = 0.1 + Math.random() * 0.15;
      return { position: [x, y, z] as [number, number, number], scale };
    });
  }, [radius, effectiveCount]);

  return (
    <group ref={groupRef}>
      {asteroids.map((a, i) => (
        <mesh key={i} position={a.position} scale={a.scale}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#666666" roughness={0.9} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// Starfield background (B9) - deep space background with two-layer parallax
function Starfield() {
  const starsRef = useRef<THREE.Points>(null!);
  const starsRefFar = useRef<THREE.Points>(null!);

  const { positions, sizes } = useMemo(() => {
    const count = 6000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i0 = (i + 0.5) / count;
      const theta = 2 * Math.PI * i * 0.618033988749895;
      const phi = Math.acos(1 - 2 * i0);
      const r = 200 + Math.random() * 100;
      // Ecliptic bias: compress toward equator
      const bias = 0.7;
      const adjustedPhi = phi * (1 - bias) + (Math.PI / 2) * bias;
      positions[i * 3] = r * Math.sin(adjustedPhi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(adjustedPhi) * 0.4;
      positions[i * 3 + 2] = r * Math.sin(adjustedPhi) * Math.sin(theta);
      sizes[i] = 0.2 + Math.random() * 0.8;
    }
    return { positions, sizes };
  }, []);

  const starTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame(({ clock }) => {
    if (!starsRef.current || !starsRefFar.current) return;
    const t = clock.getElapsedTime();
    const mat = starsRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.7 + Math.sin(t * 0.6) * 0.15;
    // Slow rotation for parallax feel
    starsRef.current.rotation.y += 0.00008;
    starsRefFar.current.rotation.y += 0.00002;
  });

  return (
    <group>
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial
          size={0.8}
          map={starTexture}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {/* Far layer — dimmer, slower */}
      <points ref={starsRefFar}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions.map((v, i) => {
              if (i % 3 === 2) return v * 2.5;
              return v * 2.5;
            })}
            itemSize={3}
          />
          <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes.map(s => s * 1.5)} itemSize={1} />
        </bufferGeometry>
        <pointsMaterial
          size={0.4}
          map={starTexture}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// Warp Streak Lines (B1/B2) — appears during camera travel
function WarpLines({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 400;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1 + Math.random() * 60;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
      pos[i * 3 + 2] = r * Math.cos(phi);
      const speed = 15 + Math.random() * 35;
      vel[i * 3] = -Math.sin(phi) * Math.cos(theta) * speed;
      vel[i * 3 + 1] = -Math.sin(phi) * Math.sin(theta) * speed * 0.3;
      vel[i * 3 + 2] = -Math.cos(phi) * speed;
    }
    return { positions: pos, velocities: vel };
  }, []);

  const velRef = useRef(velocities);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += velRef.current[i * 3] * delta;
      arr[i * 3 + 1] += velRef.current[i * 3 + 1] * delta;
      arr[i * 3 + 2] += velRef.current[i * 3 + 2] * delta;
      if (Math.abs(arr[i * 3]) > 80 || Math.abs(arr[i * 3 + 2]) > 80) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1 + Math.random() * 10;
        arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
        arr[i * 3 + 2] = r * Math.cos(phi);
      }
    }
    pos.needsUpdate = true;
    const mat = ref.current.material as THREE.PointsMaterial;
    const targetOpacity = active ? 0.6 : 0;
    mat.opacity += (targetOpacity - mat.opacity) * Math.min(delta * 4, 1);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.4}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// System Entry Portal Ring (B5) — expands on arrival at a solar system
function PortalRing({ sunColor, onComplete }: { sunColor: string; onComplete: () => void }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const particlesRef = useRef<THREE.Points>(null!);
  const startTime = useRef(Date.now());
  const doneRef = useRef(false);

  // Particle burst geometry
  const particlePositions = useMemo(() => {
    const pos = new Float32Array(90);
    for (let i = 0; i < 30; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.1;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  const particleVelocities = useRef<THREE.Vector3[]>(
    Array.from({ length: 30 }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 5 + Math.random() * 10;
      return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed * 0.3,
        Math.cos(phi) * speed
      );
    })
  );

  const particleOpacities = useRef<Float32Array>(new Float32Array(30).fill(1));

  useFrame(() => {
    const elapsed = Date.now() - startTime.current;
    const t = Math.min(elapsed / 800, 1);

    // Ring scale with easeOutBack overshoot
    if (ringRef.current) {
      const overshoot = 1.1;
      const easeOutBack = (x: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };
      const scale = easeOutBack(t) * 8;
      ringRef.current.scale.setScalar(scale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
      mat.opacity = 0.7 * (1 - easeOutQuad(t));
    }

    // Light flash
    if (lightRef.current) {
      const intensity = t < 0.5 ? t * 10 : (1 - t) * 10;
      lightRef.current.intensity = Math.max(0, intensity);
    }

    // Particle burst
    if (particlesRef.current) {
      const pos = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const array = pos.array as Float32Array;
      for (let i = 0; i < 30; i++) {
        const v = particleVelocities.current[i];
        array[i * 3] += v.x * 0.016;
        array[i * 3 + 1] += v.y * 0.016;
        array[i * 3 + 2] += v.z * 0.016;
        particleOpacities.current[i] = Math.max(0, 1 - (elapsed / 600));
      }
      pos.needsUpdate = true;
      const pMat = particlesRef.current.material as THREE.PointsMaterial;
      pMat.opacity = maxOf(Array.from(particleOpacities.current));
    }

    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      <mesh ref={ringRef}>
        <ringGeometry args={[2, 8, 64]} />
        <meshBasicMaterial color={sunColor} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight ref={lightRef} color="#ffffff" intensity={0} distance={20} />
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={30} array={particlePositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.2}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// Planet Detail Panel
function PlanetDetailPanel({ planet, onClose }: { planet: PlanetData | null; onClose: () => void }) {
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
function CameraTracker({ cameraPosRef }: { cameraPosRef: React.MutableRefObject<[number, number, number]> }) {
  useFrame(({ camera }) => {
    cameraPosRef.current = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}

function PlanetTracker({
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
function SolarSystemScene({ planets, isPaused, speed, onPlanetClick, controlsRef, onPlanetPositionUpdate, category = 'Other', sunSize, portalKey, isAnimating, showBelt }: { planets: PlanetData[]; isPaused: boolean; speed: number; onPlanetClick: (data: PlanetData) => void; controlsRef: any; onPlanetPositionUpdate?: (name: string, position: THREE.Vector3) => void; category?: string; sunSize?: number; portalKey?: number; isAnimating?: boolean; showBelt?: boolean }) {
  const { camera } = useThree();
  const [showPortal, setShowPortal] = useState(portalKey ? true : false);

  useEffect(() => {
    if (portalKey) {
      setShowPortal(true);
    }
  }, [portalKey]);

  return (
    <>
      {showPortal && (
        <PortalRing
          key={portalKey}
          sunColor={SUN_CONFIGS[category]?.color || '#ffaa00'}
          onComplete={() => setShowPortal(false)}
        />
      )}
      <WarpLines active={!!isAnimating} />
      <Sun category={category} size={sunSize} />
      <ambientLight color="#ffffff" intensity={0.15} />
      <hemisphereLight color="#6688cc" groundColor="#222233" intensity={0.1} />
      <directionalLight position={[5, 10, 5]} intensity={0.15} color="#aabbff" />
      {planets.filter((p) => p && p.name && (p.category || p.color)).map((planetData) => (<OrbitPath key={`orbit-${planetData.name}`} planet={planetData} />))}
      {planets.filter((p) => { if (!p) return false; if (!p.name) return false; if (!p.category && !p.color) return false; return true; }).map((planetData) => (<TexturedPlanet key={planetData.name} data={planetData} isPaused={isPaused} speedMultiplier={speed} onClick={onPlanetClick} onPositionUpdate={onPlanetPositionUpdate} />))}
      {showBelt && <AsteroidBelt radius={45} count={400} isPaused={isPaused} camera={camera} />}
      {showBelt && <AsteroidBelt radius={75} count={300} isPaused={isPaused} camera={camera} />}
      <Starfield />
      <Stars radius={300} depth={80} count={400} factor={2} fade speed={0.05} saturation={0.5} />
      <OrbitControls ref={controlsRef} enablePan={true} enableZoom={true} minDistance={8} maxDistance={200} autoRotate={!isPaused} autoRotateSpeed={0.06} target={[0, 0, 0]} />
    </>
  );
}

// Category list for solar systems - loaded from localStorage settings
const DEFAULT_CATEGORY_LIST = ['IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication', 'Design', 'Productivity', 'Tools', 'Other'];

// Get categories from settings tier assignments
function getCategoryListFromSettings(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORY_LIST;
  try {
    const tierAssignments = localStorage.getItem('deskflow-tier-assignments');
    if (tierAssignments) {
      const tiers = JSON.parse(tierAssignments);
      const allCategories = [
        ...(tiers.productive || []),
        ...(tiers.neutral || []),
        ...(tiers.distracting || [])
      ];
      if (allCategories.length > 0) return allCategories;
    }
  } catch { /* ignore */ }
  return DEFAULT_CATEGORY_LIST;
}

// Category list constant - uses settings categories if available
const CATEGORY_LIST = getCategoryListFromSettings();

// Filter logs by time period helper
function filterLogsByPeriod(logs: ActivityLog[], period: 'today' | 'week' | 'month' | 'all'): ActivityLog[] {
  if (period === 'all' || !logs || logs.length === 0) return logs;
  const now = Date.now();
  if (period === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    return logs.filter(log => {
      const logDate = log.timestamp instanceof Date 
        ? log.timestamp.toISOString().split('T')[0]
        : typeof log.timestamp === 'string' 
          ? log.timestamp.split('T')[0] 
          : '';
      return logDate === todayStr;
    });
  }
  const cutoff = period === 'week' 
    ? now - 7 * 24 * 60 * 60 * 1000 
    : now - 30 * 24 * 60 * 60 * 1000;
  return logs.filter(log => new Date(log.timestamp).getTime() >= cutoff);
}

// Format duration in seconds to human-readable string
function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Compute planets from appStats (more accurate - uses database totals)
function computePlanetsFromStats(
  appStats: { app: string; category: string; total_ms: number; sessions: number }[],
  appColors?: Record<string, string>,
  categoryOverrides?: Record<string, string>
): PlanetData[] {
  if (!appStats || appStats.length === 0) {
    return computePlanets([], appColors, categoryOverrides);
  }

  // Group by app name and sum up total time
  const grouped: Record<string, { total_ms: number; sessions: number; category: string }> = {};
  for (const stat of appStats) {
    const appName = stat.app.trim();
    if (!grouped[appName]) {
      // Use user-defined category override from settings, otherwise use default category from stat
      // Normalize to lowercase to match how SettingsPage saves overrides
      grouped[appName] = { total_ms: 0, sessions: 0, category: categoryOverrides?.[appName.toLowerCase()] || stat.category || 'Other' };
    }
    grouped[appName].total_ms += stat.total_ms || 0;
    grouped[appName].sessions += stat.sessions || 0;
    // Use the first non-'Other' category we find, unless user has override
    if (!categoryOverrides?.[appName.toLowerCase()] && grouped[appName].category === 'Other' && stat.category && stat.category !== 'Other') {
      grouped[appName].category = stat.category;
    }
  }

  // Convert to planets
  const planets: PlanetData[] = [];
  const sortedApps = Object.entries(grouped)
    .map(([appName, data]) => ({
      appName,
      total_ms: data.total_ms,
      sessions: data.sessions,
      category: data.category,
      // Convert ms to seconds for the planet time
      time: Math.floor(data.total_ms / 1000)
    }))
    .sort((a, b) => a.time - b.time) // ascending: smallest first (closest to sun)
    // Performance cap: exclude trivial apps (< 30s) and limit to top 80
    .filter(a => a.time >= MIN_PLANET_TIME_SECONDS)
    .slice(-MAX_RENDERED_PLANETS);

  const maxTime = maxBy(sortedApps, a => a.time, 1);

  // Count apps per category for color assignment
  const categoryCount: Record<string, number> = {};

  for (let idx = 0; idx < sortedApps.length; idx++) {
    const app = sortedApps[idx];
    const appName = app.appName;
    const category = app.category || 'Other';

    // Get color - use custom color from appColors if available, otherwise use category color
    const color = appColors?.[appName] || getCategoryColor(category, categoryCount[category] || 0);
    categoryCount[category] = (categoryCount[category] || 0) + 1;

    // Calculate size based on time (normalized)
    const timeRatio = maxTime > 0 ? app.time / maxTime : 0.5;
    const radius = 0.8 + timeRatio * 1.2;

    // Calculate orbit radius using power-law spacing
    const orbitRadius = calculateOrbitRadius(idx, sortedApps.length);

    // Speed based on Keplerian formula
    const speed = calculateAngularSpeed(orbitRadius);

    // Deterministic eccentricity, inclination, and longitude
    const eccentricity = computeEccentricity(idx, sortedApps.length);
    const inclination = computeInclination(appName);
    const longitudeOfPerihelion = seededRandom(idx * 31.7 + 7.1) * Math.PI * 2;

    // Rings (C1) — top 25% of apps by total time get deterministic rings
    const totalApps = sortedApps.length;
    const top25Threshold = Math.ceil(totalApps * 0.75);
    const isTop25 = idx >= top25Threshold;
    const planetRings: RingData[] = [];
    if (isTop25) {
      const rgb = hexToRgb(color);
      const ringColor = `#${((1 << 24) + (Math.min(255, Math.floor(rgb.r * 0.85) + 30) << 16) + (Math.min(255, Math.floor(rgb.g * 0.85) + 30) << 8) + Math.min(255, Math.floor(rgb.b * 0.85) + 30)).toString(16).slice(1)}`;
      const tilt = ((idx / totalApps) * 0.6) - 0.3;
      planetRings.push({
        innerRadius: radius * 2.2,
        outerRadius: radius * 3.5,
        opacity: 0.3 + (idx - top25Threshold) / (totalApps - top25Threshold) * 0.2,
        color: ringColor,
        tilt: tilt,
      });
    }

    // C4: Moons from sub-apps/projects (sample from dataset)
    const projectMoons: MoonData[] = [];
    // Use correlated random based on name for deterministic mooons
    const moonSeed = hashString(appName);
    const moonCount = moonSeed % 4; // 0-3 moons
    for (let m = 0; m < moonCount; m++) {
      const mHue = (moonSeed * (m + 1)) % 360;
      projectMoons.push({
        name: `${appName}-m${m}`,
        radius: 0.12 + (moonSeed * (m + 7)) % 5 * 0.04,
        orbitRadius: 0.8 + m * 0.35,
        speed: 1.0 + (moonSeed * (m + 3)) % 10 * 0.15,
        color: `hsl(${mHue}, 60%, 65%)`,
      });
    }

    planets.push({
      name: appName,
      category,
      color,
      time: app.time,
      sessions: app.sessions,
      radius,
      orbitRadius,
      speed,
      eccentricity,
      inclination,
      longitudeOfPerihelion,
      moons: projectMoons,
      rings: planetRings,
    });
  }

  return planets;
}

// Compute solar systems from logs (grouped by category)
// Dynamically builds category list from settings + data
function computeSolarSystems(
  logs: ActivityLog[], 
  appColors?: Record<string, string>,
  categoryOverrides?: Record<string, string>
): { category: string; planets: PlanetData[]; totalTime: number; sunSize: number }[] {
  // Guard against undefined logs
  const safeLogs = logs || [];
  
  // Get categories from settings tier assignments (dynamic, reads from localStorage each time)
  const settingsCategories = getCategoryListFromSettings();
  
  // Group planets by category
  const categoryGroups: Record<string, PlanetData[]> = {};
  const categoryTimes: Record<string, number> = {};
  
  // Initialize with settings categories
  for (const cat of settingsCategories) {
    categoryGroups[cat] = [];
    categoryTimes[cat] = 0;
  }
  
  // Compute planets for each category
  const allPlanets = computePlanets(safeLogs, appColors, categoryOverrides);
  
  for (const planet of allPlanets) {
    let cat = planet.category || 'Other';
    if (!categoryGroups[cat]) {
      // New category found in data - add it dynamically
      categoryGroups[cat] = [];
      categoryTimes[cat] = 0;
    }
    categoryGroups[cat].push(planet);
    categoryTimes[cat] += planet.time;
  }
  
  // Build solar systems array - include ALL categories that have data
  const allCategories = [...new Set([...settingsCategories, ...Object.keys(categoryGroups)])];
  
  return allCategories.map(cat => ({
    category: cat,
    planets: categoryGroups[cat] || [],
    totalTime: categoryTimes[cat] || 0,
    sunSize: SUN_CONFIGS[cat]?.sizeRange[0] || 3.5,
  })).filter(ss => ss.planets.length > 0 || ss.totalTime > 0)
     .sort((a, b) => {
       // Sort by settings order, then by time descending
       const aIdx = settingsCategories.indexOf(a.category);
       const bIdx = settingsCategories.indexOf(b.category);
       if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
       if (aIdx !== -1) return -1;
       if (bIdx !== -1) return 1;
       return b.totalTime - a.totalTime;
      });
}

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

// Website category list
const WEBSITE_CATEGORY_LIST = ['Social Media', 'Entertainment', 'Productivity', 'Search Engine', 'News', 'Shopping', 'Communication', 'Education', 'Developer Tools', 'Uncategorized', 'Other'];

// Compute website planets from website logs
function computeWebsitePlanets(
  websiteLogs: ActivityLog[],
  websiteColors?: Record<string, string>,
  websiteCategoryOverrides?: Record<string, string>
): PlanetData[] {
  // Fallback: load website category overrides directly from localStorage
  let effectiveWebsiteOverrides = websiteCategoryOverrides;
  if (!effectiveWebsiteOverrides || Object.keys(effectiveWebsiteOverrides).length === 0) {
    try {
      const saved = localStorage.getItem('deskflow-domain-category-overrides');
      if (saved) {
        effectiveWebsiteOverrides = JSON.parse(saved);
      }
    } catch { /* ignore */ }
  }
  const safeLogs = websiteLogs || [];
  
  const validLogs = safeLogs.filter((log: any) =>
    log && log.app && typeof log.app === 'string' && log.app.trim().length > 0
  );

  if (validLogs.length === 0) {
    return [];
  }

  const grouped: Record<string, any[]> = {};

  for (const log of validLogs) {
    // For browser logs, use domain field if available, otherwise use app
    const domainName = (log as any).domain?.trim() || (log as any).app?.trim() || 'Unknown';
    if (!grouped[domainName]) grouped[domainName] = [];
    grouped[domainName].push(log);
  }

  const planets: PlanetData[] = [];
  
  const sortedApps = Object.entries(grouped)
    .sort(([, a], [, b]) => {
      const timeA = a.reduce((sum, l) => sum + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0);
      const timeB = b.reduce((sum, l) => sum + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0);
      return timeA - timeB;
    })
    // Performance: exclude trivial domains (< 30s), limit to top 80
    .filter(([, a]) => {
      const time = a.reduce((sum, l) => sum + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0);
      return time >= MIN_PLANET_TIME_SECONDS;
    })
    .slice(-MAX_RENDERED_PLANETS);

  const categoryCount: Record<string, number> = {};
  // Pre-compute maxTime once (O(n)) instead of recalculating per planet (O(n²))
  const wsMaxTime = sortedApps.length > 0 ? maxBy(sortedApps, ([, domainLogs]) =>
    (domainLogs as any[]).reduce((sum: number, l: any) => sum + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0), 1
  ) : 1;

  for (let idx = 0; idx < sortedApps.length; idx++) {
    const [domainName, domainLogs] = sortedApps[idx];

    // Priority: user override → database category → fallback dict → 'Uncategorized'
    const dbCategory = domainLogs[0]?.category;
    const category = effectiveWebsiteOverrides?.[domainName] || dbCategory || 'Uncategorized';
    const color = websiteColors?.[domainName] || getCategoryColor(category, categoryCount[category] || 0);
    categoryCount[category] = (categoryCount[category] || 0) + 1;

    const appTime = domainLogs.reduce((sum: number, l: any) => {
      const raw = (l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0;
      return sum + raw;
    }, 0);
    const sessions = domainLogs.length;
    
     // LN-based orbit spacing for websites (wider range than app planets)
    const wsMinR = 24;
    const wsMaxR = 220;
    const wsT = sortedApps.length > 1 ? idx / (sortedApps.length - 1) : 0.5;
    const orbitRadius = wsMinR + (wsMaxR - wsMinR) * Math.pow(wsT, 0.8);
    
    // Calculate time ratio for planet size (use pre-computed maxTime)
    const timeRatio = appTime / wsMaxTime;
    
    // Cube root for gentle scaling
    const gentleRatio = Math.pow(timeRatio, 1/3);
    
    const radius = 0.8 + gentleRatio * 1.2;
    
    // Orbit speed using Kepler-like physics
    const speed = calculateAngularSpeed(orbitRadius) * 0.1; // Scale down for slower website orbits
    
    const eccentricity = computeEccentricity(idx, sortedApps.length);
    const inclination = computeInclination(domainName);
    const longitudeOfPerihelion = seededRandom(idx * 7.3) * Math.PI * 2;

    planets.push({
      name: domainName,
      category: category,
      color: color,
      time: appTime,
      sessions: sessions,
      radius,
      orbitRadius,
      speed,
      eccentricity,
      inclination,
      longitudeOfPerihelion,
      moons: [],
      rings: radius > 1.5 ? [{ innerRadius: radius * 1.4, outerRadius: radius * 2.2, opacity: 0.2 + seededRandom(idx * 7.4) * 0.3, color, tilt: (seededRandom(idx * 7.5) - 0.5) * 0.5 }] : []
    });
  }

  return planets;
}

// Compute website solar systems from website logs (grouped by category)
function computeWebsiteSolarSystems(
  websiteLogs: ActivityLog[],
  websiteColors?: Record<string, string>,
  websiteCategoryOverrides?: Record<string, string>
): { category: string; planets: PlanetData[]; totalTime: number; sunSize: number }[] {
  const safeLogs = websiteLogs || [];
  
  const categoryGroups: Record<string, PlanetData[]> = {};
  const categoryTimes: Record<string, number> = {};
  
  for (const cat of WEBSITE_CATEGORY_LIST) {
    categoryGroups[cat] = [];
    categoryTimes[cat] = 0;
  }
  
  const allPlanets = computeWebsitePlanets(safeLogs, websiteColors, websiteCategoryOverrides);
  for (const planet of allPlanets) {
    let cat = planet.category || 'Uncategorized';
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = [];
      categoryTimes[cat] = 0;
    }
    categoryGroups[cat].push(planet);
    categoryTimes[cat] += planet.time;
  }
  
  const allCategories = [...new Set([...WEBSITE_CATEGORY_LIST, ...Object.keys(categoryGroups)])];
  
  return allCategories.map(cat => ({
    category: cat,
    planets: categoryGroups[cat] || [],
    totalTime: categoryTimes[cat] || 0,
    sunSize: WEBSITE_SUN_CONFIGS[cat]?.sizeRange[0] || 3.5,
  })).filter(ss => ss.planets.length > 0 || ss.totalTime > 0)
     .sort((a, b) => {
       const aIdx = WEBSITE_CATEGORY_LIST.indexOf(a.category);
       const bIdx = WEBSITE_CATEGORY_LIST.indexOf(b.category);
       if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
       if (aIdx !== -1) return -1;
       if (bIdx !== -1) return 1;
       return b.totalTime - a.totalTime;
     });
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
function SystemTrail({ color, positions }: { color: string; positions: Float32Array }) {
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
function GalaxyView({ 
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
    basePos: [number, number, number]
  ) => {
    const pos = getSystemPosition(idx, 0, 0); // Will be recalculated
    const brightness = Math.min(1, system.totalTime / 60);
    // Small sphere ~same visual weight as dust particles (size 2.5)
    const sphereSize = 1.2;
    const hitboxSize = sphereSize * 5;
    
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
        
        {/* Visual core sphere - small, like a bright star cluster */}
        <mesh>
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
        
        {/* Always visible label */}
        <Html center distanceFactor={30} position={[0, sphereSize * 3, 0]} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1.5 rounded-lg bg-black/90 text-white font-bold text-sm whitespace-nowrap border-2 border-white/40" style={{ fontSize: '15px', textShadow: '0 0 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>
            {system.category}
          </div>
        </Html>
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
          return renderSolarSystem(system, idx, config, appTrailPositions[idx], [pos[0], pos[1], pos[2]]);
        })}
      </group>
      
      {/* Websites Galaxy (Cyan/Violet theme - Electric Nebula) */}
      <group ref={websitesGroupRef} position={WEBSITES_GALAXY_POS}>
        <WebsiteGalaxyDustCloud perfMode={perfMode} />
        {websiteSolarSystems.map((system, idx) => {
          const config = websiteSunConfigs[system.category] || DEFAULT_WEBSITE_SUN_CONFIG;
          const pos = getSystemPosition(idx, websiteSolarSystems.length, 0);
          return renderSolarSystem(system, idx, config, websiteTrailPositions[idx], [pos[0], pos[1], pos[2]]);
        })}
      </group>
    </>
  );
}

// Category Sidebar Panel - shows stats when solar system is selected in galaxy view
function CategorySidebar({ 
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
function CategoryDropdown({ 
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
function PlanetLegend({ 
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

// Main Export Component
export default function OrbitSystem({ logs, appColors, categoryOverrides, websiteLogs, websiteColors, websiteCategoryOverrides, selectedPeriod: externalPeriod, onPeriodChange }: OrbitSystemProps) {
  
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedOptions = [0.25, 0.5, 1, 2, 4];
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [textureRefreshKey, setTextureRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'galaxy' | 'solarSystem'>('galaxy');
  const [galaxyType, setGalaxyType] = useState<'apps' | 'websites'>('apps');
  const [perfMode, setPerfMode] = useState<'high' | 'balanced' | 'performance'>('balanced');
  const [isVisible, setIsVisible] = useState(true);
  const cameraPosRef = useRef<[number, number, number]>([0, 100, 200]);
  const fpsDisplayRef = useRef<HTMLDivElement | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('Other');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  
  // Sync with external period if provided (drives backend refetch via parent)
  const activePeriod = externalPeriod || selectedPeriod;
  
  // Load saved category on mount after galaxyType is determined
  useEffect(() => {
    const key = `deskflow-last-category-${galaxyType}`;
    try {
      const stored = localStorage.getItem(key);
      
      if (stored) setCurrentCategory(stored);
    } catch { /* ignore */ }
  }, [galaxyType]);

  // Visibility change → pause 3D rendering when tab hidden
  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const [selectedSystem, setSelectedSystem] = useState<{ category: string; planets: PlanetData[]; totalTime: number; sunSize: number } | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [perfExpanded, setPerfExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  // D3: Filter slider — min usage threshold (seconds)
  const [minTimeFilter, setMinTimeFilter] = useState(0);
  // D4: Search query
  const [searchQuery, setSearchQuery] = useState('');
  const [animationSpeed] = useState<AnimationSpeed>(() => {
    try {
      return (localStorage.getItem('deskflow-animation-speed') as AnimationSpeed) || 'normal';
    } catch { return 'normal'; }
  });
  const controlsRef = useRef<any>(null);
  const galaxyTypeRef = useRef(galaxyType);
  const trackedPlanetRef = useRef<string | null>(null);
  const isAnimatingRef = useRef(false);
  const [portalKey, setPortalKey] = useState(0);
  
  // Filter logs by selected period
  // NOTE: when externalPeriod is provided (from parent), data is already pre-filtered from backend
  // So skip client-side filter to avoid redundant O(n) pass on potentially large arrays
  const filteredLogs = useMemo(() => {
    if (externalPeriod) return logs || [];
    return filterLogsByPeriod(logs, activePeriod);
  }, [logs, activePeriod, externalPeriod]);
  const filteredWebsiteLogs = useMemo(() => {
    if (externalPeriod) return websiteLogs || [];
    return filterLogsByPeriod(websiteLogs || [], activePeriod);
  }, [websiteLogs, activePeriod, externalPeriod]);
  
  // App galaxy solar systems (period-filtered) — only compute active galaxy
  const appSolarSystems = useMemo(() => {
    if (galaxyType !== 'apps') return [];
    const t = performance.now();
    const result = computeSolarSystems(filteredLogs, appColors, categoryOverrides);
    console.log('[FROZEN-DBG] computeSolarSystems took', Math.round(performance.now() - t), 'ms, categories:', result.length, 'logs:', filteredLogs?.length);
    return result;
  }, [filteredLogs, appColors, categoryOverrides, galaxyType]);
  
  // Website galaxy solar systems (period-filtered) — only compute active galaxy
  const websiteSolarSystems = useMemo(() => {
    if (galaxyType !== 'websites') return [];
    const t = performance.now();
    const result = computeWebsiteSolarSystems(filteredWebsiteLogs, websiteColors, websiteCategoryOverrides);
    console.log('[FROZEN-DBG] computeWebsiteSolarSystems took', Math.round(performance.now() - t), 'ms, categories:', result.length, 'logs:', filteredWebsiteLogs?.length);
    return result;
  }, [filteredWebsiteLogs, websiteColors, websiteCategoryOverrides, galaxyType]);
  
  // Refs to track interaction state - prevent glitches during user interaction
  const isInteractingRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  const INTERACTION_COOLDOWN = 1000; // 1 second cooldown after interaction

  // Track when user starts/stops interacting with OrbitControls
  useEffect(() => {
    const handleInteractionStart = () => {
      isInteractingRef.current = true;
    };
    const handleInteractionEnd = () => {
      lastInteractionTimeRef.current = Date.now();
      isInteractingRef.current = false;
    };

    window.addEventListener('pointerdown', handleInteractionStart);
    window.addEventListener('pointerup', handleInteractionEnd);
    window.addEventListener('wheel', handleInteractionStart);
    window.addEventListener('wheel', handleInteractionEnd);

    return () => {
      window.removeEventListener('pointerdown', handleInteractionStart);
      window.removeEventListener('pointerup', handleInteractionEnd);
      window.removeEventListener('wheel', handleInteractionStart);
      window.removeEventListener('wheel', handleInteractionEnd);
    };
  }, []);

  // Manual galaxy type switching - no auto-switch based on camera position (causes glitches)
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

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);

        controlsRef.current.object.position.lerpVectors(startPos, targetPos, eased);
        controlsRef.current.target.lerpVectors(startTarget, lookAtPos, eased);

        if (t < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  };
  
  // Current galaxy solar systems based on type
  const solarSystems = galaxyType === 'apps' ? appSolarSystems : websiteSolarSystems;
  
  
  // Current sun configs based on galaxy type
  const currentSunConfigs = galaxyType === 'apps' ? SUN_CONFIGS : WEBSITE_SUN_CONFIGS;
  const defaultSunConfig = galaxyType === 'apps' ? DEFAULT_SUN_CONFIG : DEFAULT_WEBSITE_SUN_CONFIG;
  
  const planets = useMemo(() => {
    const system = solarSystems.find(s => s.category === currentCategory);
    let filtered = system?.planets || [];
    
    // D3: Apply min time filter
    if (minTimeFilter > 0) {
      filtered = filtered.filter(p => p.time >= minTimeFilter);
    }
    
    // D4: Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    
    return filtered;
  }, [solarSystems, currentCategory, minTimeFilter, searchQuery]);
  
  // All planets for legend (from all categories)
  const allPlanets = useMemo(() => {
    return solarSystems.flatMap(s => s.planets);
  }, [solarSystems]);
  
  // Extract unique categories from planet data for dropdown
  const planetCategories = useMemo(() => {
    return [...new Set(allPlanets.map(p => p.category).filter(Boolean))];
  }, [allPlanets]);
  
  // D2: Click vs select distinction
  const clickStartTimeRef = useRef(0);
  const clickTargetRef = useRef<PlanetData | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlanetPointerDown = (data: PlanetData) => {
    clickStartTimeRef.current = Date.now();
    clickTargetRef.current = data;
    // Start a timer — if held > 300ms, it becomes a "select" (track + fly to)
    clickTimerRef.current = setTimeout(() => {
      if (clickTargetRef.current) {
        const pd = clickTargetRef.current;
        // Long press = select: fly to planet + track
        setSelectedPlanet(pd);
        setCurrentCategory(pd.category);
        setViewMode('solarSystem');
        setSelectedSystem(null);
        const trackedPos = planetPositionsRef.current.get(pd.name);
        if (trackedPos) {
          trackedPlanetRef.current = pd.name;
          const camOffset = Math.max(pd.radius * 6, 12);
          const camPos = new THREE.Vector3(
            trackedPos.x + camOffset,
            trackedPos.y + camOffset * 0.6,
            trackedPos.z + camOffset
          );
          animateCamera(camPos, trackedPos, ANIMATION_DURATIONS[animationSpeed]);
        }
      }
      clickTargetRef.current = null;
    }, 300);
  };

  const handlePlanetPointerUp = (data: PlanetData) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const elapsed = Date.now() - clickStartTimeRef.current;
    // Brief click (< 300ms) = quick view (show detail panel, no tracking)
    if (elapsed < 300 && clickTargetRef.current === data) {
      setSelectedPlanet(data);
      setCurrentCategory(data.category);
      setViewMode('solarSystem');
      setSelectedSystem(null);
      // Brief click: show detail panel but don't track; position camera nearby
      const trackedPos = planetPositionsRef.current.get(data.name);
      if (trackedPos) {
        const camOffset = Math.max(data.radius * 6, 12);
        const camPos = new THREE.Vector3(
          trackedPos.x + camOffset,
          trackedPos.y + camOffset * 0.6,
          trackedPos.z + camOffset
        );
        animateCamera(camPos, trackedPos, ANIMATION_DURATIONS[animationSpeed]);
      }
    }
    clickTargetRef.current = null;
  };

  const handlePlanetClick = (data: PlanetData) => { 
    // D2: Delegate to pointer down/up handlers
    handlePlanetPointerDown(data);
    handlePlanetPointerUp(data);
  };
  
  const handleSelectSystem = (category: string) => {
    const system = solarSystems.find(s => s.category === category);
    setSelectedSystem(system || null);
  };

  const handleEnterSystem = () => {
    if (selectedSystem && controlsRef.current) {
      setCurrentCategory(selectedSystem.category);
      setStoredCategory(selectedSystem.category, galaxyType);
      setSelectedSystem(null);
      setLegendExpanded(true);
      
      // Animate into the solar system (zoom in close to sun)
      setViewMode('solarSystem');
      const targetX = galaxyType === 'websites' ? 3250 : 0;
      const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
      const targetPos = new THREE.Vector3(targetX, 30, 60); // Close to sun
      const lookAtPos = new THREE.Vector3(targetX, 0, 0); // Look at sun
      animateCamera(targetPos, lookAtPos, duration, () => setPortalKey(k => k + 1));
    }
  };

  const handleCloseSystem = () => {
    setSelectedSystem(null);
    trackedPlanetRef.current = null;
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      setSelectedPlanet(null);
      setSelectedSystem(null);
      trackedPlanetRef.current = null;
      setViewMode('galaxy');
      
      // Animate back to galaxy view
      const targetX = galaxyType === 'websites' ? 3250 : 0;
      const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
      const targetPos = new THREE.Vector3(targetX, 100, 200); // Galaxy view position
      const lookAtPos = new THREE.Vector3(targetX, 0, 0); // Look at galaxy center
      animateCamera(targetPos, lookAtPos, duration);
    }
  };

  const handleRefreshTextures = () => {
    setTextureRefreshKey(k => k + 1);
    setSelectedPlanet(null);
    trackedPlanetRef.current = null;
    if (controlsRef.current) controlsRef.current.reset();
  };
  
// Handle category selection from dropdown — animate to solar system view
  const handleCategorySelect = (cat: string) => {
    setCurrentCategory(cat);
    setStoredCategory(cat, galaxyType);
    setSelectedPlanet(null);
    trackedPlanetRef.current = null;
    if (controlsRef.current) {
      setViewMode('solarSystem');
      const targetX = galaxyType === 'websites' ? 3250 : 0;
      const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
      const targetPos = new THREE.Vector3(targetX, 30, 60);
      const lookAtPos = new THREE.Vector3(targetX, 0, 0);
      animateCamera(targetPos, lookAtPos, duration, () => setPortalKey(k => k + 1));
    }
  };

  // Track current planet positions for camera navigation
  const planetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  
  // Cleanup flag to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Cleanup effect for Three.js resources on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear planet positions cache
      planetPositionsRef.current.clear();
      // Force a small delay to let Three.js clean up before React fully unmounts
      setTimeout(() => {
        // The Canvas component handles WebGL cleanup, this just helps ensure
        // no pending state updates fire after unmount
      }, 50);
    };
  }, []);

  // Called when a planet reports its position each frame
  const handlePlanetPositionUpdate = (name: string, position: THREE.Vector3) => {
    if (!isMountedRef.current) return;
    planetPositionsRef.current.set(name, position.clone());
  };

  // Called when user clicks a legend item — fly camera to that planet + start tracking
  const focusOnPlanet = (planet: PlanetData) => {
    setCurrentCategory(planet.category);
    setStoredCategory(planet.category, galaxyType);
    setViewMode('solarSystem');
    setSelectedPlanet(planet);
    trackedPlanetRef.current = planet.name;
    
    // Then animate to planet position
    if (controlsRef.current) {
      let planetPos: THREE.Vector3;
      
      const trackedPos = planetPositionsRef.current.get(planet.name);
      if (trackedPos) {
        planetPos = trackedPos;
      } else {
        const semiLatusRectum = planet.orbitRadius * (1 - (planet.eccentricity || 0.1) ** 2);
        const angle = Math.random() * Math.PI * 2;
        const lonPeri = planet.longitudeOfPerihelion || 0;
        const dist = semiLatusRectum / (1 + (planet.eccentricity || 0.1) * Math.cos(angle + lonPeri));
        const inc = planet.inclination || 0;
        const px = Math.cos(angle + lonPeri) * dist;
        const py = Math.sin(angle + lonPeri) * dist * Math.sin(inc) * 0.3;
        const pz = Math.sin(angle + lonPeri) * dist * Math.cos(inc);
        planetPos = new THREE.Vector3(px, py, pz);
      }

      const camOffset = Math.max(planet.radius * 6, 12);
      const camPos = new THREE.Vector3(
        planetPos.x + camOffset,
        planetPos.y + camOffset * 0.6,
        planetPos.z + camOffset
      );

      animateCamera(camPos, planetPos, ANIMATION_DURATIONS[animationSpeed]);
    }
  };

  const currentSunSize = useMemo(() => {
    const config = currentSunConfigs[currentCategory];
    return config?.sizeRange[0] || 3.5;
  }, [currentCategory, currentSunConfigs]);

  // Helper to animate camera to target position smoothly (B1/B2)
  // Uses 3-phase bezier curve: easeIn → fast travel → easeOut + overshoot
  const animateCamera = (targetPos: THREE.Vector3, lookAtPos: THREE.Vector3, duration: number, onComplete?: () => void) => {
    if (!controlsRef.current) return;

    isAnimatingRef.current = true;
    const startPos = controlsRef.current.object.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const startTime = Date.now();
    const totalDist = startPos.distanceTo(targetPos);

    // 3-phase bezier: anticipate (0-0.15), fast travel (0.15-0.7), settle (0.7-1.0)
    const threePhaseBezier = (t: number): number => {
      if (t < 0.15) {
        // Phase 1: ease in (anticipation)
        const p = t / 0.15;
        return 0.08 * p * p * p;
      } else if (t < 0.7) {
        // Phase 2: fast travel (nearly linear with slight acceleration)
        const p = (t - 0.15) / 0.55;
        return 0.08 + 0.84 * p;
      } else {
        // Phase 3: ease out with overshoot
        const p = (t - 0.7) / 0.3;
        const overshoot = 1.02 + 0.03 * Math.sin(p * Math.PI * 2);
        return (0.92 + 0.08 * (1 - Math.pow(1 - p, 3))) * overshoot;
      }
    };

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = threePhaseBezier(t);
      const clamped = Math.min(eased, 1);

      controlsRef.current.object.position.lerpVectors(startPos, targetPos, clamped);
      controlsRef.current.target.lerpVectors(startTarget, lookAtPos, clamped);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
        onComplete?.();
      }
    };
    animate();
  };

  // Reset camera to current galaxy's default view position
  const resetCameraToGalaxy = () => {
    const duration = animationSpeed === 'instant' ? 100 : ANIMATION_DURATIONS[animationSpeed];
    const targetX = galaxyType === 'websites' ? 3250 : 0;
    const targetPos = new THREE.Vector3(targetX, 100, 200);
    const lookAtPos = new THREE.Vector3(targetX, 0, 0);
    animateCamera(targetPos, lookAtPos, duration);
  };

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
      
      {/* D3/D4: Filter & Search bar */}
      {viewMode === 'solarSystem' && (
        <div className="absolute top-16 left-4 z-20 flex flex-col gap-2">
          {/* Search input */}
          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search planets..."
              className="bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none w-28"
            />
          </div>
          {/* Min time slider */}
          <div className="glass rounded-xl px-3 py-2 flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">Min time</span>
              <span className="text-zinc-400 font-mono">{formatDurationSeconds(minTimeFilter)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={36000}
              step={300}
              value={minTimeFilter}
              onChange={(e) => setMinTimeFilter(Number(e.target.value))}
              className="w-full h-1 accent-indigo-500"
            />
          </div>
        </div>
      )}
      
      {/* Control buttons - below filter/search */}
      <div className="absolute top-16 left-4 z-20 flex flex-col gap-2" style={{ marginTop: viewMode === 'solarSystem' ? '110px' : '0px' }}>
        {/* Top row: Galaxy + Category buttons */}
        <div className="flex items-center gap-2">
          {/* Switch between Apps and Websites galaxy */}
          <button
            onClick={() => switchToGalaxy(galaxyType === 'apps' ? 'websites' : 'apps')}
            className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition ${
              galaxyType === 'apps' 
                ? 'text-blue-400 hover:text-blue-300' 
                : 'text-cyan-400 hover:text-cyan-300'
            }`}
            title={galaxyType === 'apps' ? 'Switch to Websites Galaxy' : 'Switch to Apps Galaxy'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <path d="M7 23l-4-4 4-4"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            {galaxyType === 'apps' ? 'Web' : 'Apps'}
          </button>
          
          {/* Zoom out button - only visible in solar system view */}
          {viewMode === 'solarSystem' && (
            <button
              onClick={handleZoomOut}
              className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium hover:text-white transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              Galaxy
            </button>
          )}
          <CategoryDropdown 
            currentCategory={currentCategory}
            onSelect={handleCategorySelect}
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
              onClick={() => {
                setSelectedPeriod(p);
                onPeriodChange?.(p);
              }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${
                activePeriod === p 
                  ? 'bg-indigo-500/30 text-indigo-300' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All'}
            </button>
          ))}
        </div>
        
        {/* Perf toggle button */}
        <button
          onClick={() => setShowPerf(!showPerf)}
          className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition self-start ${
            showPerf ? 'text-emerald-400 bg-emerald-500/20' : 'hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          Perf
        </button>
        
        {/* Info button */}
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-medium transition self-start ${
            showInfo ? 'text-cyan-400 bg-cyan-500/20' : 'hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
          Info
        </button>
        
        {/* FPS Stats panel - directly below Perf button when expanded */}
        {showPerf && (
          <div className="glass rounded-xl px-3 py-2 text-xs font-mono space-y-2 w-[200px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span ref={fpsDisplayRef} className="text-emerald-400">
                  -- FPS
                </span>
              </div>
              <button
                onClick={() => setPerfExpanded(!perfExpanded)}
                className="text-zinc-500 hover:text-white transition"
              >
                {perfExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            
            {/* FPS Line Graph - always visible when perf is shown */}
            <FPSLineGraph fpsHistoryRef={fpsHistoryRef} width={176} height={48} />
            
            {/* Expanded stats */}
            {perfExpanded && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2 mt-2 border-t border-zinc-700 space-y-1"
              >
                <div className="flex justify-between text-zinc-400">
                  <span>GPU</span>
                  <span className="text-zinc-300">--</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Memory</span>
                  <span className="text-zinc-300">--</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Frame Time</span>
                  <span ref={(el) => {
                    if (el && fpsDisplayRef.current) {
                      const frameTime = fpsDisplayRef.current.getAttribute('data-frame-time') || '--ms';
                      el.textContent = frameTime;
                    }
                  }}>--ms</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
        
        {/* Info Panel - Planet Physics Explanation */}
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass rounded-xl px-3 py-3 text-xs space-y-2 w-[220px]"
          >
            <div className="text-cyan-400 font-semibold border-b border-zinc-700 pb-2 mb-2">
              Planet Physics Guide
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Planet Size</span>
                <span className="text-zinc-300">= Total Usage Time</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Orbit Distance</span>
                <span className="text-zinc-300">= ln(time) scaling</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Orbit Speed</span>
                <span className="text-zinc-300">Further = Slower!</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Moons</span>
                <span className="text-zinc-300">= Projects</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Rings</span>
                <span className="text-zinc-300">~40% chance</span>
              </div>
            </div>
            
            <div className="border-t border-zinc-700 pt-2 mt-2">
              <div className="text-zinc-500 text-[10px]">
                Planets scaled with cube root to prevent extreme values
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      <div ref={(el) => {
          if (el) {
            const ro = new ResizeObserver((entries) => {
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const canvas = el.querySelector('canvas');
                if (canvas) {
                  canvas.width = width * window.devicePixelRatio;
                  canvas.height = height * window.devicePixelRatio;
                  canvas.style.width = width + 'px';
                  canvas.style.height = height + 'px';
                }
              }
            });
            ro.observe(el);
          }
        }} className="w-full flex-1 bg-transparent">
        {(() => {
          try {
            return (
              <Canvas
                resize={{ scroll: false, offsetSize: true }}
                style={{ width: '100%', height: '100%' }} 
                key={`canvas-${textureRefreshKey}`} 
                camera={{ position: viewMode === 'galaxy' ? (galaxyType === 'websites' ? [3250, 100, 200] : [0, 100, 200]) : [0, 100, 180], fov: 45, near: 0.1, far: 10000 }} 
                onError={(e) => console.error('[OrbitSystem] Canvas error:', e)}
                onCreated={({ gl }) => {
                  gl.setClearColor('#0a0a14', 0);
                }}
                gl={{
                  powerPreference: 'high-performance',
                  antialias: false,
                  alpha: false,
                  stencil: false,
                  depth: true,
                  preserveDrawingBuffer: false,
                }}
                dpr={Math.min(window.devicePixelRatio, perfMode === 'performance' ? 1 : 1.5)}
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
                  
                  {/* Space Lighting */}
                  <ambientLight intensity={0.03} color="#1a1a2e" />
                  <hemisphereLight groundColor="#000000" skyColor="#0d1b2a" intensity={0.08} />
                  <pointLight position={[0, 0, 0]} intensity={3} color="#ffaa00" distance={200} decay={1.5} />
                  <directionalLight position={[50, 30, 50]} intensity={0.5} color="#fff5e6" />
                  
                  {/* Post-Processing Effects - disabled in performance mode */}
                  <EffectComposer multisampling={0}>
                    {perfMode !== 'performance' && (
                      <Bloom 
                        intensity={1.2} 
                        luminanceThreshold={0.6} 
                        luminanceSmoothing={0.5}
                        radius={0.5}
                        mipmapBlur 
                      />
                    )}
                    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
                    {perfMode !== 'performance' && (
                      <Vignette offset={0.25} darkness={0.5} blendFunction={BlendFunction.NORMAL} />
                    )}
                  </EffectComposer>
                  
                  {/* FPS Counter - uses ref instead of state to avoid re-renders */}
                  {showPerf && <FPSCounter fpsDisplayRef={fpsDisplayRef} fpsHistoryRef={fpsHistoryRef} />}
                  
                {viewMode === 'galaxy' ? (
                  <>
                    <GalaxyView 
                      appSolarSystems={appSolarSystems}
                      websiteSolarSystems={websiteSolarSystems}
                      appSunConfigs={SUN_CONFIGS}
                      websiteSunConfigs={WEBSITE_SUN_CONFIGS}
                      defaultSunConfig={defaultSunConfig}
                      galaxyType={galaxyType}
                      onSelectSystem={handleSelectSystem} 
                      viewMode={viewMode}
                      animationSpeed={animationSpeed}
                      perfMode={perfMode}
                    />
                    <CameraTracker cameraPosRef={cameraPosRef} />
                    <Stars radius={5000} depth={250} count={5000} factor={7} fade speed={0.08} saturation={0.6} />
                    <OrbitControls 
                      ref={controlsRef}
                      enablePan={true} 
                      enableZoom={true} 
                      minDistance={50} 
                      maxDistance={5000} 
                      autoRotate={false}
                      target={galaxyType === 'websites' ? [3250, 0, 0] : [0, 0, 0]}
                    />
                  </>
                  ) : (
                  <>
                    <SolarSystemScene
                      planets={planets}
                      isPaused={isPaused}
                      speed={speed}
                      onPlanetClick={handlePlanetClick}
                      controlsRef={controlsRef}
                      onPlanetPositionUpdate={handlePlanetPositionUpdate}
                      category={currentCategory}
                      sunSize={currentSunSize}
                      portalKey={portalKey}
                      isAnimating={isAnimatingRef.current}
                      showBelt={true}
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
      
      {/* Category sidebar - when system selected in galaxy view */}
      {selectedSystem && viewMode === 'galaxy' && (
        <CategorySidebar 
          system={selectedSystem}
          onClose={handleCloseSystem}
          onEnter={handleEnterSystem}
          onPlanetClick={(p) => {
            handlePlanetClick(p);
            setSelectedSystem(null);
          }}
        />
      )}
      
      <PlanetDetailPanel planet={selectedPlanet} onClose={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; }} />

      {/* Controls overlay — top-right */}
      <div className="absolute top-4 right-4 z-10">
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-3">
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition"
          >
            <Play className="w-3.5 h-3.5" />
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          <button 
            onClick={() => { setSelectedPlanet(null); trackedPlanetRef.current = null; if (controlsRef.current) controlsRef.current.reset(); }} 
            className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          <button 
            onClick={handleRefreshTextures} 
            className="flex items-center gap-1.5 text-xs font-medium hover:text-white transition"
            title="Refresh textures"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          {speedOptions.map((s) => (
            <button 
              key={s} 
              onClick={() => setSpeed(s)} 
              className={`px-2 py-0.5 rounded text-xs transition ${
                speed === s 
                  ? 'bg-indigo-500/30 text-indigo-300' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Planet Legend — bottom - shows apps in current view */}
      <PlanetLegend 
        planets={viewMode === 'solarSystem' ? planets : allPlanets}
        isExpanded={legendExpanded}
        onToggle={() => setLegendExpanded(!legendExpanded)}
        onPlanetClick={focusOnPlanet}
        showCategoryHeaders={true}
        allCategories={solarSystems}
      />
      
      {/* Galaxy hint text */}
      {viewMode === 'galaxy' && (
        <div className="absolute bottom-24 left-0 right-0 text-center">
          <div className="text-xs text-zinc-500">Click a solar system to explore • Drag to rotate • Scroll to zoom</div>
        </div>
      )}
    </div>
  );
}

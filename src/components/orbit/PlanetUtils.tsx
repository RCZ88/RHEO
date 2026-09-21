import { useMemo } from 'react';
import * as THREE from 'three';
import { maxOf, maxBy } from '../utils/safeMath';

const APP_CATEGORIES = ['IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication', 'Design', 'Productivity', 'Tools', 'Other'];
const VIVID_PALETTE = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#f368e0', '#ee5a24', '#eccc68'];
const CATEGORY_COLOR_FAMILIES: Record<string, string[]> = {
  IDE: ['#3b82f6', '#6366f1', '#8b5cf6'],
  'AI Tools': ['#06b6d4', '#14b8a6', '#22d3ee'],
  Browser: ['#f97316', '#ef4444', '#f43f5e'],
  Entertainment: ['#ec4899', '#8b5cf6', '#a855f7'],
  Communication: ['#22c55e', '#14b8a6', '#06b6d4'],
  Design: ['#f43f5e', '#fb923c', '#f97316'],
  Productivity: ['#3b82f6', '#6366f1', '#8b5cf6'],
  Tools: ['#64748b', '#94a3b8', '#cbd5e1'],
  Other: ['#94a3b8', '#64748b', '#475569'],
};

export function getDistinctColor(index: number): string {
  return VIVID_PALETTE[index % VIVID_PALETTE.length];
}

export function getCategoryColor(category: string, index: number = 0): string {
  const family = CATEGORY_COLOR_FAMILIES[category] || CATEGORY_COLOR_FAMILIES['Other'];
  return family[index % family.length];
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPlanetColor(category: string, seed: number): string {
  const family = CATEGORY_COLOR_FAMILIES[category] || CATEGORY_COLOR_FAMILIES['Other'];
  const hueShift = seed * 30;
  const satShift = (seed % 3) * 10;
  const baseColor = family[Math.floor(seed) % family.length];
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + hueShift)}, ${Math.min(255, g + satShift)}, ${Math.min(255, b + hueShift / 2)})`;
}

export function calculateOrbitRadius(orbitIndex: number, baseRadius: number = 20): number {
  return baseRadius * (1 + orbitIndex * 0.8);
}

export function calculateAngularSpeed(orbitRadius: number): number {
  const keplerSpeed = Math.pow(orbitRadius, -1.5) * 0.5;
  const visualBoost = 0.3;
  return Math.max(0.01, keplerSpeed + visualBoost);
}

export function calculateOrbitalPeriod(orbitRadius: number): number {
  return (2 * Math.PI * Math.pow(orbitRadius, 1.5)) / Math.max(0.01, calculateAngularSpeed(orbitRadius));
}

export function computeEccentricity(seed: number): number {
  const noise = Math.sin(seed * 100) * 0.5 + 0.5;
  return 0.05 + noise * 0.25;
}

export function computeInclination(seed: number): number {
  return (Math.sin(seed * 73) * 0.5 + 0.5) * Math.PI * 0.15;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 128, g: 128, b: 128 };
  return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) };
}

export function adjustColor(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.max(0, Math.round(r * factor)))}, ${Math.min(255, Math.max(0, Math.round(g * factor)))}, ${Math.min(255, Math.max(0, Math.round(b * factor)))})`;
}

export const ORBIT_CONFIG = { innerRadius: 5, outerRadius: 250, minOrbitRadius: 15, maxOrbitRadius: 200, baseOrbitSpeed: 0.001, speedMultiplier: 0.5 };
export const SUN_RENDER_SIZE = 8;
export const PLANET_COLOR_FAMILIES = CATEGORY_COLOR_FAMILIES;

export interface PlanetData { name: string; category: string; color: string; radius: number; orbitRadius: number; angularSpeed: number; orbitalPeriod: number; eccentricity: number; inclination: number; longitudeOfPerihelion: number; rotationSpeed: number; moons: number; time: number; sessions: number; speed: number; }
export interface ActivityLog { app: string; category: string; timestamp: string | Date; total_ms: number; }
export interface OrbitSystemProps { logs: ActivityLog[]; appColors?: Record<string, string>; categoryOverrides?: Record<string, string>; websiteLogs?: ActivityLog[]; websiteColors?: Record<string, string>; websiteCategoryOverrides?: Record<string, string>; selectedPeriod?: string; onPeriodChange?: (period: string) => void; }

// ── Computation helpers (extracted from orchestrator) ──
const ORBIT_CONFIG_LOCAL = { minOrbitRadius: 10, maxOrbitRadius: 110, spacingExponent: 0.8, baseAngularSpeed: 2.0, minAngularSpeed: 0.08 };
const MAX_RENDERED_PLANETS = 80;
const MIN_PLANET_TIME_SECONDS = 30;
const CATEGORY_COLOR_FAMILIES_LOCAL: Record<string, string[]> = {
  IDE: ['#6366f1', '#8b5cf6', '#7c3aed'], 'AI Tools': ['#8b5cf6', '#a78bfa', '#c084fc'],
  Browser: ['#3b82f6', '#06b6d4', '#22d3ee'], 'Entertainment': ['#ec4899', '#f43f5e', '#f97316'],
  Communication: ['#14b8a6', '#06b6d4', '#10b981'], 'Design': ['#a855f7', '#e879f9', '#ec4899'],
  Productivity: ['#10b981', '#84cc16', '#22c55e'], 'Tools': ['#f59e0b', '#f97316', '#fb923c'],
  Other: ['#64748b', '#94a3b8', '#78716c'],
};
const SUN_CONFIGS_LOCAL: Record<string, { color: string; emissive: string; sizeRange: [number, number] }> = {
  IDE: { color: '#ffaa33', emissive: '#ff8800', sizeRange: [4, 5.5] }, 'AI Tools': { color: '#aa66ff', emissive: '#8833ff', sizeRange: [4, 5.5] },
  Browser: { color: '#44aaff', emissive: '#2299ff', sizeRange: [4, 5.5] }, 'Entertainment': { color: '#ff44aa', emissive: '#ff3399', sizeRange: [4, 5.5] },
  Communication: { color: '#33ccaa', emissive: '#22aa88', sizeRange: [4, 5.5] }, 'Design': { color: '#ff66aa', emissive: '#ff4499', sizeRange: [4, 5.5] },
  Productivity: { color: '#ffeecc', emissive: '#ffdd99', sizeRange: [4, 5.5] }, 'Tools': { color: '#ff8833', emissive: '#ff6622', sizeRange: [4, 5.5] },
  Other: { color: '#aaaaaa', emissive: '#888888', sizeRange: [4, 5.5] },
};
const DEFAULT_SUN_CONFIG_LOCAL = { color: '#ffcc44', emissive: '#ffaa22', sizeRange: [4, 5.5] as [number, number] };
const WEBSITE_SUN_CONFIGS_LOCAL: Record<string, { color: string; emissive: string; sizeRange: [number, number] }> = {
  'Social Media': { color: '#ff00ff', emissive: '#cc00cc', sizeRange: [4, 5.5] }, 'Entertainment': { color: '#ff44aa', emissive: '#cc3388', sizeRange: [4, 5.5] },
  'Productivity': { color: '#00ffaa', emissive: '#00cc88', sizeRange: [4, 5.5] }, 'Search Engine': { color: '#00ccff', emissive: '#0099cc', sizeRange: [4, 5.5] },
  'News': { color: '#aa66ff', emissive: '#8844cc', sizeRange: [4, 5.5] }, 'Shopping': { color: '#ffaa00', emissive: '#cc8800', sizeRange: [4, 5.5] },
  'Communication': { color: '#00ffff', emissive: '#00cccc', sizeRange: [4, 5.5] }, 'Education': { color: '#66ffff', emissive: '#44cccc', sizeRange: [4, 5.5] },
  'Developer Tools': { color: '#8866ff', emissive: '#6644cc', sizeRange: [4, 5.5] }, 'Uncategorized': { color: '#88aacc', emissive: '#6688aa', sizeRange: [4, 5.5] },
  'Other': { color: '#aabbcc', emissive: '#8899aa', sizeRange: [4, 5.5] },
};
const DEFAULT_WEBSITE_SUN_CONFIG_LOCAL = { color: '#00c6ff', emissive: '#0099cc', sizeRange: [4, 5.5] as [number, number] };

export function hashStringLocal(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); }

export function calculateOrbitalPeriodLocal(radius: number): number { return (2 * Math.PI / ORBIT_CONFIG_LOCAL.baseAngularSpeed) * Math.pow(radius, 1.5); }

export function calculateAngularSpeedLocal(radius: number): number { return Math.max(ORBIT_CONFIG_LOCAL.minAngularSpeed, ORBIT_CONFIG_LOCAL.baseAngularSpeed / Math.pow(radius, 1.5) + 0.25 * (1 - radius / ORBIT_CONFIG_LOCAL.maxOrbitRadius)); }

export function computeEccentricityLocal(planetIndex: number, totalPlanets: number): number { const t = planetIndex / Math.max(totalPlanets - 1, 1); const noise = (seededRandom(planetIndex * 7.3 + 13.7) - 0.5) * 0.03; return 0.15 - 0.12 * t + noise; }

export function computeInclinationLocal(planetName: string): number { return (hashStringLocal(planetName) % 1000) / 1000 * 6; }

export function formatDurationSeconds(seconds: number): string { if (seconds < 60) return `${Math.floor(seconds)}s`; if (seconds < 3600) { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return s > 0 ? `${m}m ${s}s` : `${m}m`; } const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); return m > 0 ? `${h}h ${m}m` : `${h}h`; }

export function filterLogsByPeriod(logs: ActivityLog[], period: string): ActivityLog[] { if (period === 'all' || !logs || logs.length === 0) return logs; const now = Date.now(); if (period === 'today') { const todayStr = new Date().toISOString().split('T')[0]; return logs.filter(log => (log.timestamp instanceof Date ? log.timestamp.toISOString().split('T')[0] : typeof log.timestamp === 'string' ? log.timestamp.split('T')[0] : '') === todayStr); } const cutoff = period === 'week' ? now - 7 * 24 * 60 * 60 * 1000 : now - 30 * 24 * 60 * 60 * 1000; return logs.filter(log => new Date(log.timestamp).getTime() >= cutoff); }

export function getCategoryListFromSettings(): string[] { if (typeof window === 'undefined') return ['IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication', 'Design', 'Productivity', 'Tools', 'Other']; try { const t = localStorage.getItem('deskflow-tier-assignments'); if (t) { const tiers = JSON.parse(t); const all = [...(tiers.productive || []), ...(tiers.neutral || []), ...(tiers.distracting || [])]; if (all.length > 0) return all; } } catch { /* ignore */ } return ['IDE', 'AI Tools', 'Browser', 'Entertainment', 'Communication', 'Design', 'Productivity', 'Tools', 'Other']; }

export function getCategoryColorLocal(category: string, indexInCategory: number): string { const family = CATEGORY_COLOR_FAMILIES_LOCAL[category] || CATEGORY_COLOR_FAMILIES_LOCAL['Other']; return family[indexInCategory % family.length]; }

export function getDistinctColorLocal(index: number): string { const VIVID_PALETTE = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16', '#e879f9', '#22d3ee']; return VIVID_PALETTE[index % VIVID_PALETTE.length]; }

export function computePlanets(logs: ActivityLog[], appColors?: Record<string, string>, categoryOverrides?: Record<string, string>): PlanetData[] {
  const validLogs = (logs || []).filter((log: any) => log && log.app && typeof log.app === 'string' && log.app.trim().length > 0 && !log.is_browser_tracking);
  if (validLogs.length === 0) return [{ name: 'VS Code', category: 'IDE', color: '#FCD34D', time: 120, sessions: 5, radius: 0.8, orbitRadius: 12, speed: calculateAngularSpeedLocal(12), orbitalPeriod: calculateOrbitalPeriodLocal(12), eccentricity: 0.05, inclination: 0.05, longitudeOfPerihelion: 0, moons: [], rings: [{ innerRadius: 2.2, outerRadius: 3.8, opacity: 0.45, color: '#6366f1', tilt: 0.2 }] }];
  const grouped: Record<string, any[]> = {};
  for (const log of validLogs) { const appName = log.app.trim(); if (!grouped[appName]) grouped[appName] = []; grouped[appName].push(log); }
  const maxTime = Math.max(...Object.values(grouped).map(l => l.reduce((s: number, ll: any) => s + (ll.duration || 0), 0)), 1);
  const catCount: Record<string, number> = {};
  return Object.entries(grouped).sort(([, a], [, b]) => b.reduce((s: number, l: any) => s + (l.duration || 0), 0) - a.reduce((s: number, l: any) => s + (l.duration || 0), 0)).filter(([, a]) => a.reduce((s: number, l: any) => s + (l.duration || 0), 0) >= MIN_PLANET_TIME_SECONDS).slice(-MAX_RENDERED_PLANETS).map(([appName, appLogs], idx) => {
    const category = categoryOverrides?.[appName.toLowerCase()] || 'Other';
    const idxInCat = (catCount[category] = (catCount[category] || 0) + 1);
    const color = getCategoryColorLocal(category, idxInCat - 1);
    const appTime = appLogs.reduce((s: number, l: any) => s + (l.duration || 0), 0);
    const radius = Math.max(0.3, Math.min(1.5, 0.5 + (appTime / maxTime) * 0.5));
    const orbitRadius = calculateOrbitRadiusLocal(idx, Object.keys(grouped).length);
    const eccentricity = computeEccentricityLocal(idx, Object.keys(grouped).length);
    const inclination = computeInclinationLocal(appName) * (Math.PI / 180);
    const longitudeOfPerihelion = seededRandom(idx * 31.7 + 7.1) * Math.PI * 2;
    const projects = [...new Set(appLogs.map((l: any) => l.project).filter((p: any) => p && typeof p === 'string'))] as string[];
    const moons = projects.slice(0, 3).map((proj: string, mIdx: number) => ({ name: proj, radius: 0.25, orbitRadius: 1.5 + mIdx * 0.3, speed: 1.2 + mIdx * 0.3, color: color + '88' }));
    const rings: any[] = [];
    return { name: appName, category, color, time: appTime, sessions: appLogs.length, radius, orbitRadius, speed: calculateAngularSpeedLocal(orbitRadius), orbitalPeriod: calculateOrbitalPeriodLocal(orbitRadius), eccentricity, inclination, longitudeOfPerihelion, moons, rings };
  });
}

export function computeSolarSystems(logs: ActivityLog[], appColors?: Record<string, string>, categoryOverrides?: Record<string, string>): { category: string; planets: PlanetData[]; totalTime: number; sunSize: number }[] {
  const settingsCategories = getCategoryListFromSettings();
  const categoryGroups: Record<string, PlanetData[]> = {};
  const categoryTimes: Record<string, number> = {};
  for (const cat of settingsCategories) { categoryGroups[cat] = []; categoryTimes[cat] = 0; }
  const allPlanets = computePlanets((logs || []).length > 10000 ? (logs || []).slice(-10000) : (logs || []), appColors, categoryOverrides);
  for (const planet of allPlanets) { let cat = planet.category || 'Other'; if (!categoryGroups[cat]) { categoryGroups[cat] = []; categoryTimes[cat] = 0; } categoryGroups[cat].push(planet); categoryTimes[cat] += planet.time; }
  const allCategories = [...new Set([...settingsCategories, ...Object.keys(categoryGroups)])];
  return allCategories.map(cat => ({ category: cat, planets: categoryGroups[cat] || [], totalTime: categoryTimes[cat] || 0, sunSize: SUN_CONFIGS_LOCAL[cat]?.sizeRange[0] || 3.5 })).filter(ss => ss.planets.length > 0 || ss.totalTime > 0).sort((a, b) => { const aIdx = settingsCategories.indexOf(a.category); const bIdx = settingsCategories.indexOf(b.category); if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx; if (aIdx !== -1) return -1; if (bIdx !== -1) return 1; return b.totalTime - a.totalTime; });
}

export function computeWebsitePlanets(websiteLogs: ActivityLog[], websiteColors?: Record<string, string>, websiteCategoryOverrides?: Record<string, string>): PlanetData[] {
  const validLogs = (websiteLogs || []).filter((log: any) => log && log.app && typeof log.app === 'string' && log.app.trim().length > 0);
  if (validLogs.length === 0) return [];
  const grouped: Record<string, any[]> = {};
  for (const log of validLogs) { const domainName = (log as any).domain?.trim() || (log as any).app?.trim() || 'Unknown'; if (!grouped[domainName]) grouped[domainName] = []; grouped[domainName].push(log); }
  const planets: PlanetData[] = [];
  const sortedApps = Object.entries(grouped).sort(([, a], [, b]) => b.reduce((s: number, l: any) => s + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0) - a.reduce((s: number, l: any) => s + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0)).filter(([, a]) => a.reduce((s: number, l: any) => s + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0) >= MIN_PLANET_TIME_SECONDS).slice(-MAX_RENDERED_PLANETS);
  const catCount: Record<string, number> = {};
  const wsMaxTime = sortedApps.length > 0 ? Math.max(...sortedApps.map(([, d]) => d.reduce((s: number, l: any) => s + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0)), 1) : 1;
  for (let idx = 0; idx < sortedApps.length; idx++) {
    const [domainName, domainLogs] = sortedApps[idx];
    const category = websiteCategoryOverrides?.[domainName] || domainLogs[0]?.category || 'Uncategorized';
    const color = websiteColors?.[domainName] || getCategoryColorLocal(category, catCount[category] || 0);
    catCount[category] = (catCount[category] || 0) + 1;
    const appTime = domainLogs.reduce((s: number, l: any) => s + ((l as any).duration_ms ? (l as any).duration_ms / 1000 : (l as any).duration || 0), 0);
    const orbitRadius = 24 + (220 - 24) * Math.pow(idx / Math.max(sortedApps.length - 1, 1), 0.8);
    planets.push({ name: domainName, category, color, time: appTime, sessions: domainLogs.length, radius: 0.8 + Math.pow(appTime / wsMaxTime, 1/3) * 1.2, orbitRadius, speed: calculateAngularSpeedLocal(orbitRadius) * 0.1, eccentricity: computeEccentricityLocal(idx, sortedApps.length), inclination: computeInclinationLocal(domainName) * (Math.PI / 180), longitudeOfPerihelion: seededRandom(idx * 7.3) * Math.PI * 2, moons: [], rings: orbitRadius > 1.5 ? [{ innerRadius: orbitRadius * 1.4, outerRadius: orbitRadius * 2.2, opacity: 0.2 + seededRandom(idx * 7.4) * 0.3, color, tilt: (seededRandom(idx * 7.5) - 0.5) * 0.5 }] : [] });
  }
  return planets;
}

export function computeWebsiteSolarSystems(websiteLogs: ActivityLog[], websiteColors?: Record<string, string>, websiteCategoryOverrides?: Record<string, string>): { category: string; planets: PlanetData[]; totalTime: number; sunSize: number }[] {
  const safeLogs = websiteLogs || [];
  const categoryGroups: Record<string, PlanetData[]> = {};
  const categoryTimes: Record<string, number> = {};
  for (const cat of ['Social Media', 'Entertainment', 'Productivity', 'Search Engine', 'News', 'Shopping', 'Communication', 'Education', 'Developer Tools', 'Uncategorized', 'Other']) { categoryGroups[cat] = []; categoryTimes[cat] = 0; }
  const allPlanets = computeWebsitePlanets(safeLogs, websiteColors, websiteCategoryOverrides);
  for (const planet of allPlanets) { let cat = planet.category || 'Uncategorized'; if (!categoryGroups[cat]) { categoryGroups[cat] = []; categoryTimes[cat] = 0; } categoryGroups[cat].push(planet); categoryTimes[cat] += planet.time; }
  const allCategories = [...new Set([...['Social Media', 'Entertainment', 'Productivity', 'Search Engine', 'News', 'Shopping', 'Communication', 'Education', 'Developer Tools', 'Uncategorized', 'Other'], ...Object.keys(categoryGroups)])];
  return allCategories.map(cat => ({ category: cat, planets: categoryGroups[cat] || [], totalTime: categoryTimes[cat] || 0, sunSize: WEBSITE_SUN_CONFIGS_LOCAL[cat]?.sizeRange[0] || 3.5 })).filter(ss => ss.planets.length > 0 || ss.totalTime > 0).sort((a, b) => { const aIdx = ['Social Media', 'Entertainment', 'Productivity', 'Search Engine', 'News', 'Shopping', 'Communication', 'Education', 'Developer Tools', 'Uncategorized', 'Other'].indexOf(a.category); const bIdx = ['Social Media', 'Entertainment', 'Productivity', 'Search Engine', 'News', 'Shopping', 'Communication', 'Education', 'Developer Tools', 'Uncategorized', 'Other'].indexOf(b.category); if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx; if (aIdx !== -1) return -1; if (bIdx !== -1) return 1; return b.totalTime - a.totalTime; });
}

function seededRandom(seed: number): number { return (Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1; }

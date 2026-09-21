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

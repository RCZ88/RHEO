import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Galaxy Dust Cloud ──

export function GalaxyDustCloud({ perfMode = 'balanced' }: { perfMode?: string }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particleCount = perfMode === 'performance' ? 1000 : perfMode === 'balanced' ? 2500 : 6000;
  const maxRadius = 280;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const armCount = 3; const armSeparation = (Math.PI * 2) / armCount;
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 0.1; const baseAngle = seededRandom(seed) * Math.PI * 2; const onArm = seededRandom(seed + 1) < 0.45;
      let finalAngle: number; let radius: number;
      if (onArm) { const armIndex = Math.floor(seededRandom(seed + 2) * armCount); const armOffset = armIndex * armSeparation + (seededRandom(seed + 3) - 0.5) * 0.3; const logRadius = Math.pow(seededRandom(seed + 4), 0.4) * maxRadius; const spiralAngle = logRadius * 0.022 + armOffset; const armWidth = 0.2 + logRadius * 0.003; finalAngle = spiralAngle + (seededRandom(seed + 5) - 0.5) * armWidth; radius = logRadius; }
      else { const r = Math.pow(seededRandom(seed + 4), 0.55) * maxRadius; const armPhase = Math.sin(r * 0.02 + baseAngle * 0.5) * 0.3; finalAngle = baseAngle + armPhase + (seededRandom(seed + 5) - 0.5) * 0.5; radius = r; }
      const normalizedR = radius / maxRadius; const ySpread = 2.5 + normalizedR * 10; const y = (seededRandom(seed + 6) - 0.5) * ySpread; const scatter = seededRandom(seed + 7) * 3 * (1 - normalizedR * 0.4);
      pos[i * 3] = (radius + scatter) * Math.cos(finalAngle); pos[i * 3 + 1] = y; pos[i * 3 + 2] = (radius + scatter) * Math.sin(finalAngle);
    }
    return pos;
  }, []);
  const colors = useMemo(() => {
    const col = new Float32Array(particleCount * 3);
    const colorPalette = ['#fff5d4', '#ffefb8', '#f7d36a', '#f0c84a', '#e8b82a', '#d9a31a', '#c89010', '#e84a9a', '#d63a8a', '#c73a8a', '#b52d7d', '#a32070', '#911363', '#7a0d56', '#6b2a96', '#5b2a86', '#4f2477', '#431e68', '#371859', '#2b124a', '#1a2a6c', '#152460', '#101e54', '#0b1848', '#0b1026'];
    for (let i = 0; i < particleCount; i++) { const x = positions[i * 3]; const z = positions[i * 3 + 2]; const r = Math.sqrt(x * x + z * z); const normalizedR = Math.min(r / maxRadius, 1); const colorSeed = i * 0.2 + 100; let colorIndex: number; if (normalizedR < 0.15) colorIndex = seededRandom(colorSeed) * 3; else if (normalizedR < 0.3) colorIndex = 2 + seededRandom(colorSeed) * 4; else if (normalizedR < 0.5) colorIndex = 6 + seededRandom(colorSeed) * 6; else if (normalizedR < 0.75) colorIndex = 12 + seededRandom(colorSeed) * 5; else colorIndex = 17 + seededRandom(colorSeed) * 3; const finalIndex = Math.floor(Math.min(colorIndex, colorPalette.length - 1)); const color = new THREE.Color(colorPalette[finalIndex]); const brightness = 1.0 - normalizedR * 0.15; col[i * 3] = color.r * brightness; col[i * 3 + 1] = color.g * brightness; col[i * 3 + 2] = color.b * brightness; }
    return col;
  }, [positions]);
  useFrame((state) => { if (pointsRef.current) { const t = state.clock.elapsedTime; pointsRef.current.position.y = Math.sin(t * 0.1) * 0.3; } });
  return <points ref={pointsRef}><bufferGeometry><bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} /><bufferAttribute attach="attributes-color" count={particleCount} array={colors} itemSize={3} /></bufferGeometry><pointsMaterial size={2.5} vertexColors transparent opacity={0.95} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} /></points>;
}

// ── Website Galaxy Dust Cloud ──

export function WebsiteGalaxyDustCloud({ perfMode = 'balanced' }: { perfMode?: string }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particleCount = perfMode === 'performance' ? 800 : perfMode === 'balanced' ? 2000 : 5000;
  const maxRadius = 280;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) { const seed = i * 0.15 + 500; const theta = seededRandom(seed) * Math.PI * 2; const phi = Math.acos(2 * seededRandom(seed + 1) - 1); const r = maxRadius * Math.pow(seededRandom(seed + 2), 0.6); const r2 = maxRadius * seededRandom(seed + 3) * 0.5 + 0.7 * maxRadius; const useOuter = seededRandom(seed + 4) > 0.4; const finalR = useOuter ? r2 : r; const distortion = seededRandom(seed + 5) * 0.15; const x = finalR * Math.cos(theta + distortion); const y = (seededRandom(seed + 6) - 0.5) * 20 * (finalR / maxRadius); const z = finalR * Math.sin(theta + distortion); pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }
    return pos;
  }, []);
  const colors = useMemo(() => { const col = new Float32Array(particleCount * 3); const colorPalette = ['#a855f7', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#22c55e', '#f97316', '#ef4444', '#f43f5e']; for (let i = 0; i < particleCount; i++) { const x = positions[i * 3]; const z = positions[i * 3 + 2]; const r = Math.sqrt(x * x + z * z); const normalizedR = Math.min(r / maxRadius, 1); const colorSeed = i * 0.2 + 100; const colorIndex = Math.floor(seededRandom(colorSeed) * colorPalette.length); const color = new THREE.Color(colorPalette[colorIndex]); const brightness = 1.0 - normalizedR * 0.15; col[i * 3] = color.r * brightness; col[i * 3 + 1] = color.g * brightness; col[i * 3 + 2] = color.b * brightness; } return col; }, [positions]);
  useFrame((state) => { if (pointsRef.current) { const t = state.clock.elapsedTime; pointsRef.current.position.y = Math.sin(t * 0.1) * 0.3; } });
  return <points ref={pointsRef}><bufferGeometry><bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} /><bufferAttribute attach="attributes-color" count={particleCount} array={colors} itemSize={3} /></bufferGeometry><pointsMaterial size={2.5} vertexColors transparent opacity={0.95} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} /></points>;
}

function seededRandom(seed: number): number { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

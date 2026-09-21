import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetData } from './PlanetUtils';

// ── Sun Component ──

export function Sun({ category = 'Other', size = 8 }: { category?: string; size?: number }) {
  const innerGlowRef = useRef<THREE.Mesh>(null!);
  const outerCoronaRef = useRef<THREE.Mesh>(null!);
  const surfaceMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [surfCanvas, setSurfCanvas] = useState<HTMLCanvasElement | null>(null);
  const sunConfig = SUN_CONFIGS[category] || DEFAULT_SUN_CONFIG;
  const sunRadius = Math.max(0.1, size || SUN_RENDER_SIZE);

  useEffect(() => { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512; const ctx = canvas.getContext('2d')!; const rng = seededRandom(42); for (let x = 0; x < 512; x++) { for (let y = 0; y < 512; y++) { const dx = x - 256; const dy = y - 256; const r = Math.sqrt(dx*dx + dy*dy); if (r > 256) continue; const brightness = 1.0 - (r / 256); const noise = (rng() - 0.5) * 0.1 * brightness; const c = new THREE.Color(sunConfig.color).multiplyScalar(brightness + noise); ctx.fillStyle = `rgb(${Math.min(1,c.r)*255},${Math.min(1,c.g)*255},${Math.min(1,c.b)*255})`; ctx.fillRect(x, y, 1, 1); } } setSurfCanvas(canvas); }, [category, sunRadius]);

  return (
    <group>
      <mesh ref={innerGlowRef}><sphereGeometry args={[sunRadius * 0.8, 32, 32]} /><meshBasicMaterial color={sunConfig.color} /></mesh>
      <mesh ref={outerCoronaRef}><sphereGeometry args={[sunRadius * 1.5, 32, 32]} /><meshBasicMaterial color={sunConfig.color} transparent opacity={0.2} />
      </mesh>
      {surfCanvas && <mesh ref={surfaceMatRef}><sphereGeometry args={[sunRadius, 32, 32]} /><meshStandardMaterial map={new THREE.CanvasTexture(surfCanvas)} emissiveMap={new THREE.CanvasTexture(surfCanvas)} emissiveIntensity={0.5} /></mesh>}
    </group>
  );
}

// ── Orbit Path ──

export function OrbitPath({ planet }: { planet: PlanetData }) {
  const points = useMemo(() => { const curvePoints = []; const segments = 128; const ecc = planet.eccentricity || 0; const a = planet.orbitRadius; const b = a * Math.sqrt(Math.max(0.01, 1 - ecc * ecc)); for (let i = 0; i <= segments; i++) { const t = (i / segments) * Math.PI * 2; const x = a * Math.cos(t); const z = b * Math.sin(t); curvePoints.push(new THREE.Vector3(x, 0, z)); } return curvePoints; }, [planet]);
  return <Line points={points} color={planet.color} lineWidth={1} />;
}

// ── Textured Planet ──

export function TexturedPlanet({ data, isPaused, speedMultiplier, onClick, onPositionUpdate }: { data: PlanetData; isPaused: boolean; speedMultiplier: number; onClick: (data: PlanetData) => void; onPositionUpdate?: (name: string, position: THREE.Vector3) => void }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [initialAngle] = useState(seededRandom(hashString(data.name)) * Math.PI * 2);
  const [seed] = useState(hashString(data.name));
  const angleRef = useRef(initialAngle);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => { const { texture, normalMap, glowTexture } = acquirePlanetTextures(data.color, data.category, seed); texRef.current = texture; }, [data.name, data.color, data.category, seed]);

  useFrame(() => { if (!isPaused) { angleRef.current += data.angularSpeed * speedMultiplier; } const dt = 0.016; const angle = angleRef.current; const ecc = data.eccentricity || 0; const a = data.orbitRadius; const b = a * Math.sqrt(Math.max(0.01, 1 - ecc * ecc)); const x = a * Math.cos(angle); const z = b * Math.sin(angle); const y = 0; if (meshRef.current) { meshRef.current.position.set(x, y, z); } if (onPositionUpdate) onPositionUpdate(data.name, new THREE.Vector3(x, y, z)); });

  return (
    <group>
      <mesh ref={meshRef} onClick={() => onClick(data)}>
        <sphereGeometry args={[Math.max(0.1, data.radius), 32, 32]} />
        <meshStandardMaterial map={texRef.current} />
      </mesh>
    </group>
  );
}

// ── Asteroid Belt ──

export function AsteroidBelt({ radius, count, isPaused, camera }: { radius: number; count: number; isPaused: boolean; camera: THREE.Camera }) {
  const groupRef = useRef<THREE.Group>(null!);
  const effectiveCount = Math.min(count, 1000);
  const asteroids = useMemo(() => { const result: { x: number; y: number; z: number; scale: number }[] = []; for (let i = 0; i < effectiveCount; i++) { const angle = Math.random() * Math.PI * 2; const r = radius + (Math.random() - 0.5) * 20; const x = Math.cos(angle) * r; const z = Math.sin(angle) * r; const y = (Math.random() - 0.5) * 2; const scale = 0.1 + Math.random() * 0.3; result.push({ x, y, z, scale }); } return result; }, [effectiveCount, radius]);
  const meshes = useMemo(() => asteroids.map((a, i) => <mesh key={i} position={[a.x, a.y, a.z]}><sphereGeometry args={[Math.max(0.01, a.scale), 4, 4]} /><meshStandardMaterial color="#888888" roughness={0.8} /></mesh>), [asteroids]);
  return <group ref={groupRef}>{meshes}</group>;
}

// ── Starfield ──

export function Starfield() {
  const starsRef = useRef<THREE.Points>(null!);
  const count = 3000;
  const positions = useMemo(() => { const pos = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); const r = 100 + Math.random() * 400; pos[i*3] = r * Math.sin(phi) * Math.cos(theta); pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta); pos[i*3+2] = r * Math.cos(phi); } return pos; }, []);
  const starTexture = useMemo(() => { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gradient.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas); }, []);
  return <points ref={starsRef}><bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} /></bufferGeometry><pointsMaterial map={starTexture} size={0.5} transparent opacity={0.8} sizeAttenuation depthWrite={false} /></points>;
}

// ── Warp Lines ──

export function WarpLines({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 500;
  const pos = useMemo(() => { const positions = new Float32Array(count * 3); const vel = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); const r = 50 + Math.random() * 200; positions[i*3] = r * Math.sin(phi) * Math.cos(theta); positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta); positions[i*3+2] = r * Math.cos(phi); vel[i*3] = (Math.random() - 0.5) * 0.1; vel[i*3+1] = (Math.random() - 0.5) * 0.1; vel[i*3+2] = (Math.random() - 0.5) * 0.1; } return positions; }, []);
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={pos} itemSize={3} /></bufferGeometry><pointsMaterial color={0x4488ff} size={0.5} transparent opacity={active ? 0.5 : 0} blending={THREE.AdditiveBlending} depthWrite={false} /></points>;
}

// ── Portal Ring ──

export function PortalRing({ sunColor, onComplete }: { sunColor: string; onComplete: () => void }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const startTime = useRef(Date.now());
  const [done, setDone] = useState(false);
  const duration = 2000;
  const geometry = useMemo(() => new THREE.TorusGeometry(30, 1, 16, 64), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: sunColor, transparent: true, opacity: 0.8 }), [sunColor]);
  useFrame(() => { if (!done && ringRef.current) { const elapsed = Date.now() - startTime.current; const t = Math.min(elapsed / duration, 1); const overshoot = 1.2; const easeOutBack = (t: number) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }; const scale = t < 0.5 ? easeOutBack(t * 2) * overshoot : 1 + (1 - easeOutBack((t - 0.5) * 2)) * (overshoot - 1); ringRef.current.scale.set(scale, scale, scale); ringRef.current.material.opacity = 1 - t; if (t >= 1) { setDone(true); setTimeout(onComplete, 100); } } });
  return <mesh ref={ringRef} geometry={geometry} material={material} />;
}

// ── Atmospheric Scattering ──

export function AtmosphericScattering({ color }: { color: string }) { return null; }

// ── Constants ──

const SUN_CONFIGS: Record<string, { color: string; size: number }> = {
  IDE: { color: '#3b82f6', size: 8 }, 'AI Tools': { color: '#06b6d4', size: 8 },
  Browser: { color: '#f97316', size: 8 }, Entertainment: { color: '#ec4899', size: 8 },
  Communication: { color: '#22c55e', size: 8 }, Design: { color: '#f43f5e', size: 8 },
  Productivity: { color: '#3b82f6', size: 8 }, Tools: { color: '#64748b', size: 8 },
  Other: { color: '#94a3b8', size: 8 },
};
const DEFAULT_SUN_CONFIG = { color: '#ffaa00', size: 8 };

export { SUN_CONFIGS, DEFAULT_SUN_CONFIG };

// ── Texture Utilities ──

const cacheOwnedTextures = new WeakSet<THREE.Texture>();
type CachedPlanetTextures = { texture: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; glowTexture: THREE.CanvasTexture; refs: number; };
const planetTextureCache = new Map<string, CachedPlanetTextures>();

export function makeGlowTexture(): THREE.CanvasTexture {
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = 128; glowCanvas.height = 128;
  const ctx = glowCanvas.getContext('2d');
  if (ctx) { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); }
  return new THREE.CanvasTexture(glowCanvas);
}

export function acquirePlanetTextures(color: string, category: string, seed: number): { key: string; texture: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; glowTexture: THREE.CanvasTexture } {
  const key = color + '|' + category + '|' + seed;
  let entry = planetTextureCache.get(key);
  if (!entry) { const texture = createProceduralTexture(color, category, seed); const normalMap = createProceduralNormalMap(color, category, seed); const glowTexture = makeGlowTexture(); cacheOwnedTextures.add(texture); cacheOwnedTextures.add(normalMap); cacheOwnedTextures.add(glowTexture); entry = { texture, normalMap, glowTexture, refs: 0 }; planetTextureCache.set(key, entry); }
  entry.refs += 1;
  return { key, texture: entry.texture, normalMap: entry.normalMap, glowTexture: entry.glowTexture };
}

export function releasePlanetTextures(key: string) { const entry = planetTextureCache.get(key); if (!entry) return; entry.refs -= 1; if (entry.refs <= 0) { entry.texture.dispose(); entry.normalMap.dispose(); entry.glowTexture.dispose(); planetTextureCache.delete(key); } }

export function disposeAllPlanetTextures() { for (const entry of planetTextureCache.values()) { entry.texture.dispose(); entry.normalMap.dispose(); entry.glowTexture.dispose(); } planetTextureCache.clear(); }

function createProceduralTexture(color: string, category: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d')!;
  const baseColor = new THREE.Color(color); const darkColor = baseColor.clone().multiplyScalar(0.3); const lightColor = baseColor.clone().multiplyScalar(1.5);
  const bgGrad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128); bgGrad.addColorStop(0, '#ffffff'); bgGrad.addColorStop(0.3, '#e8e8f0'); bgGrad.addColorStop(1, '#3a3a5c');
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, 256, 256);
  const armCount = 3; const rotationOffset = seed * 0.5;
  for (let i = 0; i < armCount; i++) { const offset = rotationOffset + (i / armCount) * Math.PI * 2; const armRadius = 40 + (i % 3) * 20; const armWidth = 15 + (i % 2) * 10; ctx.beginPath(); ctx.strokeStyle = `rgba(${Math.round(baseColor.r*255)}, ${Math.round(baseColor.g*255)}, ${Math.round(baseColor.b*255)}, 0.3)`; ctx.lineWidth = armWidth; for (let a = 0; a < Math.PI * 2; a += 0.05) { const r = armRadius + Math.sin(a * 2 + offset) * 15; const x = 128 + Math.cos(a + offset) * r; const y = 128 + Math.sin(a + offset) * r * 0.6; if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  const nodeCount = 20; for (let i = 0; i < nodeCount; i++) { const angle = seededRandom(seed + i * 0.1) * Math.PI * 2; const r = seededRandom(seed + i * 0.2 + 100) * 100; const x = 128 + Math.cos(angle) * r; const y = 128 + Math.sin(angle) * r * 0.6; const nodeGrad = ctx.createRadialGradient(x, y, 0, x, y, 20); nodeGrad.addColorStop(0, `rgba(${Math.round(lightColor.r*255)}, ${Math.round(lightColor.g*255)}, ${Math.round(lightColor.b*255)}, 0.8)`); nodeGrad.addColorStop(1, `rgba(${Math.round(darkColor.r*255)}, ${Math.round(darkColor.g*255)}, ${Math.round(darkColor.b*255)}, 0)`); ctx.fillStyle = nodeGrad; ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill(); }
  const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; return tex;
}

function createProceduralNormalMap(color: string, category: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d')!;
  const baseColor = new THREE.Color(color); const r = Math.round(baseColor.r * 255); const g = Math.round(baseColor.g * 255); const b = Math.round(baseColor.b * 255);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) { for (let x = 0; x < 256; x += 8) { const grad = ctx.createLinearGradient(x, y, x+8, y+8); grad.addColorStop(0, 'rgba(0,0,0,0.3)'); grad.addColorStop(1, 'rgba(255,255,255,0.3)'); ctx.fillStyle = grad; ctx.fillRect(x, y, 8, 8); } }
  const normalTexture = new THREE.CanvasTexture(canvas); normalTexture.wrapS = THREE.RepeatWrapping; normalTexture.wrapT = THREE.RepeatWrapping; return normalTexture;
}

function seededRandom(seed: number): number { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function hashString(str: string): number { let hash = 0; for (let i = 0; i < str.length; i++) { const char = str.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; } return Math.abs(hash); }

import { Line } from '@react-three/drei';

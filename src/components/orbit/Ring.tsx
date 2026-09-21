// Ring component - orbit ring rendering
import { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { PlanetData } from './PlanetUtils';

export function PlanetRings({ planet }: { planet: PlanetData }) {
  const groupRef = useRef<THREE.Group>(null!);
  const [geometry] = useState(() => new THREE.TorusGeometry(Math.max(0.1, planet.radius * 1.35), 0.05, 16, 64));
  return (
    <mesh ref={groupRef} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[Math.max(0.1, planet.radius * 1.35), 0.05, 16, 64]} />
      <meshStandardMaterial color={planet.color} transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Ring Utilities ──

export function makeSeamlessHorizontal(stripWidth: number) {
  const blendWidth = 2;
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = stripWidth; stripCanvas.height = 256;
  const stripCtx = stripCanvas.getContext('2d');
  if (!stripCtx) return stripCanvas;
  const fadeGrad = stripCtx.createLinearGradient(0, 0, blendWidth, 0);
  fadeGrad.addColorStop(0, 'rgba(0,0,0,1)'); fadeGrad.addColorStop(1, 'rgba(0,0,0,0)');
  const leftStrip = document.createElement('canvas');
  leftStrip.width = blendWidth; leftStrip.height = 256;
  const leftCtx = leftStrip.getContext('2d');
  if (leftCtx) { const fadeGrad2 = leftCtx.createLinearGradient(0, 0, blendWidth, 0); fadeGrad2.addColorStop(0, 'rgba(0,0,0,1)'); fadeGrad2.addColorStop(1, 'rgba(0,0,0,0)'); leftCtx.fillStyle = fadeGrad2; leftCtx.fillRect(0, 0, blendWidth, 256); }
  return stripCanvas;
}

// ── Asteroid Belt ──

export function AsteroidBelt({ radius, count, isPaused, camera }: { radius: number; count: number; isPaused: boolean; camera: THREE.Camera }) {
  const groupRef = useRef<THREE.Group>(null!);
  const effectiveCount = Math.min(count, 1000);
  const camDist = camera.position.length();
  const ratio = Math.max(0.1, Math.min(1, (camDist - radius + 50) / 200));
  const asteroids = useMemo(() => {
    const result = [];
    for (let i = 0; i < effectiveCount; i++) { const angle = Math.random() * Math.PI * 2; const r = radius + (Math.random() - 0.5) * 20; const x = Math.cos(angle) * r; const z = Math.sin(angle) * r; const y = (Math.random() - 0.5) * 2; const scale = 0.1 + Math.random() * 0.3; result.push({ x, y, z, scale }); }
    return result;
  }, [effectiveCount, radius]);
  return <group ref={groupRef} />;
}

// ── Starfield ──

export function Starfield() {
  const starsRef = useRef<THREE.Points>(null!);
  const starsRefFar = useRef<THREE.Points>(null!);
  const count = 3000; const countFar = 1000;
  const positions = useMemo(() => { const pos = new Float32Array(count * 3); const posFar = new Float32Array(countFar * 3); for (let i = 0; i < count; i++) { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); const r = 100 + Math.random() * 400; pos[i*3] = r * Math.sin(phi) * Math.cos(theta); pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta); pos[i*3+2] = r * Math.cos(phi); } for (let i = 0; i < countFar; i++) { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); const r = 500 + Math.random() * 1000; posFar[i*3] = r * Math.sin(phi) * Math.cos(theta); posFar[i*3+1] = r * Math.sin(phi) * Math.sin(theta); posFar[i*3+2] = r * Math.cos(phi); } return { pos, posFar }; }, []);
  const starTexture = useMemo(() => { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gradient.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas); }, []);
  return null;
}

// ── Warp Lines ──

export function WarpLines({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 500;
  const pos = useMemo(() => { const positions = new Float32Array(count * 3); const vel = new Float32Array(count * 3); for (let i = 0; i < count; i++) { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); const r = 50 + Math.random() * 200; positions[i*3] = r * Math.sin(phi) * Math.cos(theta); positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta); positions[i*3+2] = r * Math.cos(phi); vel[i*3] = (Math.random() - 0.5) * 0.1; vel[i*3+1] = (Math.random() - 0.5) * 0.1; vel[i*3+2] = (Math.random() - 0.5) * 0.1; } return positions; }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: 0x4488ff, size: 0.5, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  return null;
}

// ── Portal Ring ──

export function PortalRing({ sunColor, onComplete }: { sunColor: string; onComplete: () => void }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const particlesRef = useRef<THREE.Points>(null!);
  const startTime = useRef(Date.now());
  const [done, setDone] = useState(false);
  const duration = 2000;
  const particlePositions = useMemo(() => { const positions = new Float32Array(200 * 3); const particleVelocities = new Float32Array(200 * 3); for (let i = 0; i < 200; i++) { const angle = Math.random() * Math.PI * 2; const r = 20 + Math.random() * 30; const speed = 0.05 + Math.random() * 0.1; particlePositions[i*3] = Math.cos(angle) * r; particlePositions[i*3+1] = (Math.random() - 0.5) * 5; particlePositions[i*3+2] = Math.sin(angle) * r; particleVelocities[i*3] = Math.cos(angle) * speed; particleVelocities[i*3+1] = (Math.random() - 0.5) * 0.05; particleVelocities[i*3+2] = Math.sin(angle) * speed; } return positions; }, []);
  const particleOpacities = useMemo(() => new Float32Array(200).fill(1), []);
  if (!done) { const elapsed = Date.now() - startTime.current; const t = Math.min(elapsed / duration, 1); const overshoot = 1.2; const easeOutBack = (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }; const scale = t < 0.5 ? easeOutBack(t * 2) * overshoot : 1 + (1 - easeOutBack((t - 0.5) * 2)) * (overshoot - 1); if (ringRef.current) ringRef.current.scale.set(scale, scale, scale); if (t >= 1) { setDone(true); setTimeout(onComplete, 100); } }
  return null;
}

// ── Atmospheric Scattering ──

export function AtmosphericScattering({ color }: { color: string }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
          gl_FragColor = vec4(uColor, fresnel * uIntensity);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  return null;
}

// ── Compass / Planet Detail Panel ──

export function PlanetDetailPanel({ planet, onClose }: { planet: PlanetData | null; onClose: () => void }) { if (!planet) return null; const hours = Math.floor(planet.time / 3600); const mins = Math.floor((planet.time % 3600) / 60); return null; }

import { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PlanetData } from './PlanetUtils';

function seededRandom(seed: number): number { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

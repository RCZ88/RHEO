import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetData } from './PlanetUtils';

// ── Moon Component ──

export function Moon({ planet, isPaused, speedMultiplier }: { planet: PlanetData; isPaused: boolean; speedMultiplier: number }) {
  const moonRef = useRef<THREE.Mesh>(null!);
  const moonAngleRef = useRef(seededRandom(hashString(planet.name + '-moon')) * Math.PI * 2);
  useFrame(() => { if (!isPaused) { moonAngleRef.current += planet.angularSpeed * speedMultiplier * 3; } const dt = planet.orbitRadius * 0.3; const x = Math.cos(moonAngleRef.current) * dt; const z = Math.sin(moonAngleRef.current) * dt; const y = Math.sin(moonAngleRef.current * 2) * 2; if (moonRef.current) { moonRef.current.position.set(x, y, z); } });
  return <mesh ref={moonRef}><sphereGeometry args={[Math.max(0.1, planet.radius * 0.15), 16, 16]} /><meshStandardMaterial color={planet.color} roughness={0.8} /></mesh>;
}

function seededRandom(seed: number): number { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function hashString(str: string): number { let hash = 0; for (let i = 0; i < str.length; i++) { const char = str.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; } return Math.abs(hash); }

// ── OrbitTrail ──

export function OrbitTrail({ planet }: { planet: PlanetData }) {
  const trailRef = useRef<THREE.Points>(null!);
  const segments = 100;
  const points = useMemo(() => { const pos = new Float32Array(segments * 3); const pts = []; for (let i = 0; i < segments; i++) { const angle = (i / segments) * Math.PI * 2; const ecc = planet.eccentricity || 0; const a = planet.orbitRadius; const b = a * Math.sqrt(Math.max(0.01, 1 - ecc * ecc)); const x = a * Math.cos(angle); const z = b * Math.sin(angle); pos[i*3] = x; pos[i*3+1] = 0; pos[i*3+2] = z; } return pos; }, [planet]);
  return <points ref={trailRef}><bufferGeometry><bufferAttribute attach="attributes-position" count={segments} array={points} itemSize={3} /></bufferGeometry><pointsMaterial color={planet.color} size={0.2} transparent opacity={0.5} /></points>;
}

// Ring component - orbit ring rendering
//
// WARNING (2026-10-05, agent opencode-solarfix-20261004): AsteroidBelt, Starfield,
// WarpLines and PortalRing were all `return null` stubs here. The Dashboard's
// "App Ecosystem" button opened a modal that rendered NOTHING, because
// SolarSystemScene's scene graph is built almost entirely from these four. Their
// bodies are restored from 3476073 (the last commit in which the orbit view
// rendered). Do not reintroduce a stub to satisfy a type error.
import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { maxOf } from '../../utils/safeMath';
import type { PlanetData } from './PlanetUtils';

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

// ── Atmospheric Scattering (Nishita-style fresnel rim) ──

export function AtmosphericScattering({ radius, color }: { radius: number; color: string }) {
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
export function AsteroidBelt({
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
export function Starfield() {
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
export function WarpLines({ active }: { active: boolean }) {
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
export function PortalRing({ sunColor, onComplete }: { sunColor: string; onComplete: () => void }) {
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

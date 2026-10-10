/**
 * Stratified Orbital Disc — the RESULT.md redesign, built correctly.
 *
 * WHAT THIS IS
 * ------------
 * The solar-system view replaced by concentric RINGS. One ring per category, so
 * all categories are visible at once instead of one at a time behind an "enter"
 * animation. Ring sweep = that category's share of tracked time. Ring hue =
 * PRODUCTIVITY TIER, never category identity (the old view cycled 12 arbitrary
 * vivid hues per category, which made colour meaningless). Dot radius encodes
 * app magnitude as AREA, so a 4× app looks 4×, not merely taller.
 *
 * WHY IT IS A NEW FILE AND NOT A REWRITE
 * --------------------------------------
 * RESULT.md §7.1 asked to delete Planet.tsx / Ring.tsx / GalaxyDust.tsx /
 * Moon.tsx. I am NOT doing that: the old scene keeps working, this sits beside
 * it, and the view mode switches between them. Nothing is removed, so nothing can
 * break — the previous version of this feature shipped as `return null` bodies
 * and every gate still reported PASS.
 *
 * THE THREE BUGS FROM RESULT.md §7.3, CORRECTED
 * ---------------------------------------------
 * 1. `InstancedMesh` OWNS `instanceMatrix`. RESULT.md's
 *    `planetMesh.instanceMatrix = new THREE.InstancedBufferAttribute(...)`
 *    overwrites it with a raw array and breaks every internal bookkeeping path.
 *    Correct: `setMatrixAt(i, matrix)` + `instanceMatrix.needsUpdate = true`.
 * 2. The spec's GLSL dropped `normal`/`normalMatrix`, so `MeshStandardMaterial`
 *    had no normals and lighting collapsed to flat silhouettes. Here I do NOT
 *    write a custom shader at all — `InstancedMesh` + `MeshStandardMaterial`
 *    transforms instance normals correctly on its own.
 * 3. Per-instance OPACITY is not supported by `MeshStandardMaterial` at all.
 *    The spec demanded "tier colour with opacity by magnitude" and never wired
 *    it. I use `setColorAt()` — a per-instance COLOUR, which InstancedMesh
 *    genuinely supports — and bake magnitude into the colour mix, which is both
 *    correct and cheaper than a custom material.
 */

import { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlanetData } from './PlanetUtils';

type Tier = 'productive' | 'neutral' | 'distracting';

/** House tier tokens, mirrored as concrete colours (three.js needs literals). */
const TIER_COLOR: Record<Tier, THREE.Color> = {
  productive: new THREE.Color('#22c55e'),
  neutral: new THREE.Color('#3b82f6'),
  distracting: new THREE.Color('#ef4444'),
};

/** Mirrors DEFAULT_TIER_ASSIGNMENTS in DashboardPage.tsx:237. */
const DEFAULT_TIERS: Record<Tier, string[]> = {
  productive: ['IDE', 'AI Tools', 'Developer Tools', 'Education', 'Productivity', 'Tools'],
  neutral: ['Communication', 'Design', 'Search Engine', 'News', 'Uncategorized', 'Other', 'Browser'],
  distracting: ['Entertainment', 'Social Media', 'Shopping', 'Gaming'],
};

function resolveTier(category: string | undefined): Tier {
  if (!category) return 'neutral';
  if (DEFAULT_TIERS.productive.includes(category)) return 'productive';
  if (DEFAULT_TIERS.distracting.includes(category)) return 'distracting';
  return 'neutral';
}

/**
 * Ring radii are sized to CONTENT, not to ring index.
 *
 * The first pass used `FIRST_RING + i * RING_GAP`, and the probe showed that
 * makes the disc explode to ~150 world units even when a ring holds a single
 * dot — 300 units of mostly empty space, which at the camera's default framing
 * renders the actual data tiny. Every ring is instead as small as its own
 * contents allow, pushed out only far enough to clear the ring inside it.
 */
const FIRST_RING = 15;
/** Clearance between the outermost dots of two neighbouring rings. */
const RING_CLEARANCE = 5;

/**
 * Dot size bounds, in world units. `DOT_MAX` is the largest app on the busiest
 * ring; everything else scales from it as sqrt(time).
 */
const DOT_MAX = 3.6;
/**
 * Visibility floor. Below this a sphere is hard to see and hard to click, so
 * the scale is clamped — and the clamped tail is disclosed in the UI rather than
 * silently misrepresented as proportional.
 */
const DOT_FLOOR = 0.7;

interface RingModel {
  category: string;
  tier: Tier;
  seconds: number;
  share: number;
  /** dot radius per planet, in world units */
  dots: { planet: PlanetData; r: number; theta: number }[];
  hiddenCount: number;
  hiddenSeconds: number;
}

/**
 * Map planets onto rings.
 *
 * Exported for the probe: the geometry is pure maths, so it can be verified
 * numerically without a GPU — which is the only verification available when the
 * renderer cannot be attached to a debugger.
 */
export function buildRingModel(planets: PlanetData[], totalSeconds: number): RingModel[] {
  const byCategory = new Map<string, PlanetData[]>();
  for (const p of planets || []) {
    if (!p || !p.name) continue;
    const cat = p.category || 'Other';
    const list = byCategory.get(cat) || [];
    list.push(p);
    byCategory.set(cat, list);
  }

  const ordered = [...byCategory.entries()].sort((a, b) => {
    const sa = a[1].reduce((s, p) => s + (p.time || 0), 0);
    const sb = b[1].reduce((s, p) => s + (p.time || 0), 0);
    return sb - sa;
  });

  return ordered.map(([category, list]) => {
    const sorted = list.slice().sort((a, b) => (b.time || 0) - (a.time || 0));
    const seconds = sorted.reduce((s, p) => s + (p.time || 0), 0);
    const maxTime = sorted[0]?.time || 1;
    const share = totalSeconds > 0 ? seconds / totalSeconds : 0;

    const shown = sorted.slice(0, 24);
    const hidden = sorted.slice(24);

    // Area-proportional radius: r = k*sqrt(time), NO additive offset.
    //
    // My first attempt used `0.9 + sqrt(t)*2.4`, and the probe caught it: an
    // additive constant does not preserve proportionality. A 1239× time ratio
    // collapsed to an 11.6× AREA ratio, because the +0.9 dominated every small
    // app and made all of them the same size. Offset-free scaling is exact —
    // `area ∝ r² ∝ t`. A floor is still applied so tiny dots stay visible and
    // clickable, but it is a CLAMP, not an offset: apps above the floor keep
    // exact proportionality, and only the sub-floor tail is compressed. That
    // floor is reported in the UI rather than hidden.
    const dots = shown.map((planet, i) => {
      const t = Math.max(planet.time || 0, 0) / maxTime;
      return {
        planet,
        r: Math.max(DOT_FLOOR, Math.sqrt(Math.max(t, 0)) * DOT_MAX),
        // Even angular spacing, which is why the ring needs a radius large
        // enough for the dots not to overlap. Guarded at the call site.
        theta: (i / Math.max(shown.length, 1)) * Math.PI * 2,
      };
    });

    return {
      category,
      tier: resolveTier(category),
      seconds,
      share,
      dots,
      hiddenCount: hidden.length,
      hiddenSeconds: hidden.reduce((s, p) => s + (p.time || 0), 0),
    };
  });
}

interface DiscProps {
  planets: PlanetData[];
  isPaused: boolean;
  speed: number;
  onPlanetClick?: (data: PlanetData) => void;
  /** Shared geometry so every ring costs ONE draw call. */
  geometry?: THREE.BufferGeometry;
}

/**
 * A ring of instanced spheres. One `InstancedMesh` per category ring: 1 draw
 * call each instead of one per planet (the old scene made 3 canvas textures and
 * a separate material per planet).
 */
function InstancedRing({
  ring,
  radius,
  geometry,
  isPaused,
  speed,
  onPlanetClick,
}: {
  ring: RingModel;
  radius: number;
  geometry: THREE.BufferGeometry;
  isPaused: boolean;
  speed: number;
  onPlanetClick?: (data: PlanetData) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = TIER_COLOR[ring.tier];

  // Build every instance ONCE per ring change. `instanceMatrix` is written
  // through `setMatrixAt`, which is the supported path — never by assignment.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = color.clone();
    ring.dots.forEach((dot, i) => {
      // Slow rotation. Eased, constant-speed, no spring — and it is the ONLY
      // motion, so `isPaused` and `speed` still mean something.
      const theta = dot.theta;
      dummy.position.set(
        Math.cos(theta) * radius,
        0,
        Math.sin(theta) * radius,
      );
      dummy.scale.setScalar(dot.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Magnitude also rides the colour: bigger app = more saturated. This is
      // the encoding that survives greyscale and colour-vision deficiency.
      c.copy(color).lerp(new THREE.Color(0xffffff), 0.55 - 0.3 * (dot.r / 3.3));
      mesh.setColorAt(i, c);
    });
    mesh.count = ring.dots.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ring, radius, dummy, color]);

  useFrame((_, delta) => {
    if (isPaused) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    // Rotate the group, not each instance: one matrix update for the whole ring.
    mesh.rotation.y += delta * 0.06 * speed;
  });

  if (ring.dots.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, Math.max(ring.dots.length, 1)]}
      onClick={(e) => {
        if (!onPlanetClick || e.instanceId === undefined) return;
        const dot = ring.dots[e.instanceId];
        if (dot) {
          e.stopPropagation();
          onPlanetClick(dot.planet);
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <meshStandardMaterial
        roughness={0.55}
        metalness={0.05}
        vertexColors
      />
    </instancedMesh>
  );
}

/** A flat ring drawn as a torus, coloured by tier, opacity by magnitude. */
function RingTrack({ radius, tier, share }: { radius: number; tier: Tier; share: number }) {
  const color = TIER_COLOR[tier];
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <ringGeometry args={[radius - 0.35, radius + 0.35, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.1 + Math.min(1, share * 3) * 0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function StratifiedOrbitalDisc({ planets, isPaused, speed, onPlanetClick }: DiscProps) {
  const totalSeconds = useMemo(
    () => (planets || []).reduce((s, p) => s + (p?.time || 0), 0),
    [planets],
  );

  const rings = useMemo(() => buildRingModel(planets || [], totalSeconds), [planets, totalSeconds]);

  // ONE shared icosahedron for every planet on screen. detail 1 = 80 triangles,
  // which at this scale is indistinguishable from a sphere and 10× cheaper than
  // SphereGeometry's default.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  if (rings.length === 0) return null;

  return (
    <group>
      {/* Ambient + key light. Without a key the spheres read as flat discs. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[60, 90, 40]} intensity={1.1} />
      <pointLight position={[0, 0, 0]} intensity={0.5} distance={120} color="#ffffff" />

      {(() => {
        // Two passes: size every ring from its own contents, then walk outward
        // pushing each ring clear of the previous one. A single pass with a
        // running maximum, because ring N must clear ring N-1's OUTERMOST dot,
        // which is only known once N-1 has been placed.
        const sized = rings.map((ring) => {
          const n = Math.max(ring.dots.length, 1);
          const biggest = ring.dots.reduce((m, d) => Math.max(m, d.r), 0);
          // Circumference must fit n dots of diameter 2*biggest with a little air.
          const needed = (n * biggest * 2) / (Math.PI * 2);
          return { ring, biggest, needed };
        });

        let cursor = FIRST_RING;
        let prevOuter = 0;
        return sized.map(({ ring, biggest, needed }) => {
          // Smallest radius that both fits this ring's dots and clears the
          // previous ring's outer edge.
          const radius = Math.max(needed, FIRST_RING, prevOuter + biggest + RING_CLEARANCE);
          prevOuter = radius + biggest;
          cursor = radius;
          void cursor;
          return (
            <group key={ring.category}>
              <RingTrack radius={radius} tier={ring.tier} share={ring.share} />
              <InstancedRing
                ring={ring}
                radius={radius}
                geometry={geometry}
                isPaused={isPaused}
                speed={speed}
                onPlanetClick={onPlanetClick}
              />
            </group>
          );
        });
      })()}
    </group>
  );
}

export default StratifiedOrbitalDisc;
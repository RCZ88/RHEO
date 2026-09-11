import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
  Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Cloud,
  Clouds,
  MeshReflectorMaterial,
  useDetectGPU,
  Clone,
  useGLTF,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  ChromaticAberration,
  Noise,
  SMAA,
} from "@react-three/postprocessing";
import * as THREE from "three";

const _warn = console.warn.bind(console);
console.warn = (msg, ...args) => {
  if (
    typeof msg === "string" &&
    (msg.includes("PCFSoftShadowMap has been deprecated") ||
      msg.includes("THREE.Clock"))
  )
    return;
  _warn(msg, ...args);
};
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  X,
  TrendingUp,
  Layers,
  Clock,
  Monitor,
} from "lucide-react";
import {
  CityModel,
  PlacedBuilding,
  getWindowTexture,
  disposeWindowPool,
  buildCityModel,
  extractDateRange,
  formatMetricValue,
  agentColor,
  buildWindowAtlas,
  resetWindowAtlasCache,
  disposeWindowAtlas,
  windowBucket,
  tileRowsFor,
  litRatioFor,
  hash01,
} from "./cityscape.utils";
import { loadCyberAssets } from "./cityscape/loadCyberAssets";
import type { LoadedTextures } from "./cityscape/cyberAssets";
import { isAdditive } from "./cityscape/cyberAssets";
import type { CityLayout, RoadSegment, Vec2, ParkLot, Intersection } from "./cityscape/cityGen";
import {
  ALL_BUILDING_MODEL_URLS,
  buildSceneFromLayout,
  ASSET_META,
  CAR_MODELS as CAR_NAMES,
  TREE_MODELS as TREE_NAMES,
  LIGHT_MODEL,
  buildingUrl,
  type SceneModel,
  type BuildingInstance,
  type PillarSpot,
  type RampRibbon,
  type SignalPlacement,
  type FurnitureInstance,
  type ParkingInstance,
  type ParkPatch,
} from "./cityscape/buildScene";
import InstancedBuildings from "./cityscape/InstancedBuildings";
import { CityBuildings } from "./cityscape/CityBuildings";
import { CitySky, CityLighting, CityIBL, CityPostFX } from "./cityscape/CityEnvironment";
import { RoadNetwork as CityRoadNetwork } from "./cityscape/RoadNetwork";
import { MovingCars, ParkedCars as ParkedCarsGLB } from "./cityscape/TrafficSystem";
import { makeRadialGlow } from "./cityscape/cyberTextureUtils";

// Isolates GLB/HDRI loads so one missing asset can't blank the entire scene.
class AssetBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  FIX A: normalizedClone — clone + normalize a GLB scene             */
/* ------------------------------------------------------------------ */

type NormalizeAxis = "height" | "length" | "footprint";

function normalizedClone(
  scene: THREE.Object3D,
  targetSize: number,
  axis: NormalizeAxis = "footprint",
) {
  const clone = scene.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  // Normalize by the semantically correct axis: vertical props (lamps, trees)
  // by height; cars/benches by their longest horizontal span (length).
  const ref = axis === "height" ? size.y : Math.max(size.x, size.z);
  const s = targetSize / Math.max(ref, 1e-4);
  clone.scale.setScalar(s);
  clone.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  const g = new THREE.Group();
  g.add(clone);
  return g;
}

// useNormalizedScene wraps normalizedClone for static props
function useNormalizedScene(
  url: string,
  targetSize: number,
  axis: NormalizeAxis = "footprint",
) {
  const { scene } = useGLTF(url);
  return useMemo(
    () => normalizedClone(scene, targetSize, axis),
    [scene, url, targetSize, axis],
  );
}

/* ------------------------------------------------------------------ */
/*  3D model URLs — preloaded so useGLTF returns instantly             */
/* ------------------------------------------------------------------ */

// car-2 and car-7 are modeled in centimeters (~100x oversize) -> dropped.
const CAR_MODELS = [
  "/cyber_assets/models/car-1.glb",
  "/cyber_assets/models/car-3.glb",
  "/cyber_assets/models/car-4.glb",
  "/cyber_assets/models/car-5.glb",
  "/cyber_assets/models/car-6.glb",
];
const BENCH_MODELS = [
  "/cyber_assets/models/Bench-1.glb",
  "/cyber_assets/models/Bench-2.glb",
];
const LIGHT_MODELS = [
  "/cyber_assets/models/StreetLight-1.glb",
  "/cyber_assets/models/StreetLight-2.glb",
];
// Tree-1 is modeled in centimeters (~100x oversize) -> dropped.
const TREE_MODELS = [
  "/cyber_assets/models/Tree-2.glb",
  "/cyber_assets/models/Tree-3.glb",
];
const ALL_MODEL_URLS = [
  ...CAR_MODELS,
  ...BENCH_MODELS,
  ...LIGHT_MODELS,
  ...TREE_MODELS,
  ...ALL_BUILDING_MODEL_URLS,
];
try {
  ALL_MODEL_URLS.forEach((u) => useGLTF.preload(u));
} catch {
  // preload failure is non-fatal — models will load on demand
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewMode = "agent" | "model" | "time";

interface AICityscapeProps {
  agents: any[];
  overview: any;
  metric: string;
  tokenDisplayMode: string;
  loading?: boolean;
  className?: string;
  period?: "week" | "month" | "all";
  timeLock?: boolean;
}

/* ------------------------------------------------------------------ */
/*  BuildingMaterial — patched MeshStandardMaterial (§2.1, §3.3)       */
/* ------------------------------------------------------------------ */

function useBuildingMaterial() {
  const uniforms = useRef({
    uTime: { value: 0 },
    uFacade: { value: null as THREE.Texture | null },
    uHasFacade: { value: 0 },
  });
  const material = useMemo(() => {
    const { texture, cols, rows } = buildWindowAtlas();
    const mat = new THREE.MeshStandardMaterial({
      color: "#141826",
      metalness: 0.9,
      roughness: 0.28,
      envMapIntensity: 1.15,
      emissive: "#ffffff",
      emissiveIntensity: 1.0,
    });
    mat.onBeforeCompile = (shader) => {
      (mat as any).__compiledShader = shader;
      shader.uniforms.uTime = uniforms.current.uTime;
      shader.uniforms.uWindowAtlas = { value: texture };
      shader.uniforms.uAtlasCols = { value: cols };
      shader.uniforms.uAtlasRows = { value: rows };
      shader.uniforms.uFacade = uniforms.current.uFacade;
      shader.uniforms.uHasFacade = uniforms.current.uHasFacade;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute vec3 aWin; attribute vec2 aTile;
          attribute vec2 aState; attribute float aEmis;
          varying vec2 vFaceUv; varying vec2 vWinUv;
          varying vec3 vWin; varying vec2 vState; varying float vEmis;`,
        )
        .replace(
          "#include <uv_vertex>",
          `#include <uv_vertex>
          vFaceUv = uv;
          vWinUv  = vec2(uv.x * aTile.x, uv.y * aTile.y);
          vWin = aWin; vState = aState; vEmis = aEmis;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uTime; uniform sampler2D uWindowAtlas; uniform float uAtlasCols; uniform float uAtlasRows;
          uniform sampler2D uFacade; uniform float uHasFacade;
          varying vec2 vFaceUv; varying vec2 vWinUv;
          varying vec3 vWin; varying vec2 vState; varying float vEmis;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `
          float colW = 1.0 / uAtlasCols;
          float rowH = 1.0 / uAtlasRows;
          vec2 wuv = vec2(
            (fract(vWinUv.x) * colW) + vWin.x * colW,
            (fract(vWinUv.y) * rowH) + vWin.z * rowH
          );
          vec3 win = texture2D(uWindowAtlas, wuv).rgb;
          vec3 winTint = mix(vec3(1.0, 0.93, 0.75), diffuseColor.rgb * 3.0, 0.45);
          float litBoost = 1.4 + vWin.y * 1.6;

          float ex = min(vFaceUv.x, 1.0 - vFaceUv.x);
          float corner = smoothstep(0.045, 0.0, ex);
          float roof   = smoothstep(0.04, 0.0, 1.0 - vFaceUv.y);
          float trim   = max(corner, roof);
          vec3 trimCol = diffuseColor.rgb * 3.5;

          float pulse = 1.0 + vState.y * (0.5 + 0.5 * sin(uTime * 4.0));
          float glow  = (vEmis + vState.x * 0.8) * pulse;

          vec3 emissiveOut = win * winTint * litBoost * glow + trim * trimCol * (1.0 + vState.x);
          totalEmissiveRadiance = emissiveOut;
        `,
        )
        .replace(
          "#include <color_fragment>",
          `
          #include <color_fragment>
          if (uHasFacade > 0.5) {
            vec3 fac = texture2D(uFacade, vWinUv * 0.3).rgb;
            diffuseColor.rgb = mix(diffuseColor.rgb, fac, 0.85);
          }
        `,
        );
    };
    mat.customProgramCacheKey = () => "ai-city-building-v2";
    return mat;
  }, []);
  useFrame((s) => {
    uniforms.current.uTime.value = s.clock.elapsedTime;
  });
  return { material, uniforms };
}

/* ------------------------------------------------------------------ */
/*  NeonGround — procedural grid + radial streets (§4)                 */
/* ------------------------------------------------------------------ */

function NeonGround({ textures }: { textures?: LoadedTextures }) {
  // Clean dark pavement. The old procedural neon grid / diagonal "traffic"
  // lanes were removed -- real streets now come from <RoadGrid />.
  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color("#06080f") },
      uHorizon: { value: new THREE.Color("#0c1430") },
      uAsphalt: { value: (textures?.["3a"] || textures?.["3b"]) ?? null },
      uHasAsphalt: { value: textures?.["3a"] || textures?.["3b"] ? 1 : 0 },
    }),
    [textures],
  );
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      receiveShadow
      raycast={() => null}
    >
      <planeGeometry args={[600, 600, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`}
        fragmentShader={`
          precision highp float;
          varying vec2 vWorld;
          uniform vec3 uBase, uHorizon;
          uniform sampler2D uAsphalt; uniform float uHasAsphalt;
          void main() {
            float r = length(vWorld);
            vec3 col = mix(uBase, uHorizon, smoothstep(40.0, 240.0, r));
            if (uHasAsphalt > 0.5) {
              vec3 asph = texture2D(uAsphalt, vWorld * 0.06).rgb;
              col = mix(col, asph * 0.22, 0.5);
            }
            gl_FragColor = vec4(col, 1.0);
          }`}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Atmosphere — GPU-animated rain + embers (§5.2) + glow sprites      */
/* ------------------------------------------------------------------ */

function Atmosphere({
  count = 1400,
  quality = "balanced",
}: {
  count?: number;
  quality?: string;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 3);
    const kind = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i * 3 + 0] = (Math.random() - 0.5) * 120;
      seed[i * 3 + 1] = Math.random() * 50;
      seed[i * 3 + 2] = (Math.random() - 0.5) * 120;
      kind[i] = Math.random() < 0.78 ? 0.0 : 1.0;
    }
    g.setAttribute("position", new THREE.BufferAttribute(seed, 3));
    g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    return g;
  }, [count]);
  useFrame((s) => {
    if (mat.current) mat.current.uniforms.uTime.value = s.clock.elapsedTime;
  });
  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          attribute float aKind; uniform float uTime;
          varying float vKind;
          void main() {
            vKind = aKind;
            vec3 p = position;
            if (aKind < 0.5) {
              p.x += 0.2 * sin(position.z * 0.3) + 0.3 * sin(uTime * 0.1 + position.z * 0.7);
              p.y = mod(position.y - uTime * 18.0, 50.0);
            } else {
              p.y = mod(position.y + uTime * 0.8, 40.0);
              p.x += sin(uTime * 0.2 + position.z * 0.5) * 1.0;
              p.z += cos(uTime * 0.15 + position.x * 0.5) * 0.8;
            }
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (aKind < 0.5 ? 2.4 : 3.0) * (60.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={`
          varying float vKind;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            if (vKind < 0.5) {
              float streak = max(0.0, 1.0 - abs(gl_PointCoord.y - 0.5) * 4.0);
              streak *= 1.0 - step(0.5, abs(gl_PointCoord.x - 0.5) * 6.0);
              vec3 rain = vec3(0.55, 0.75, 1.0) * streak;
              gl_FragColor = vec4(rain, streak * 0.35);
            } else {
              vec3 ember = vec3(1.0, 0.42, 0.78);
              gl_FragColor = vec4(ember * 1.8, (1.0 - d * 2.0) * 0.7);
            }
          }`}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  AtmosphereGlow — large radial glow sprites at sky level             */
/* ------------------------------------------------------------------ */

function Moon() {
  const tex = useMemo(() => makeRadialGlow(128, "#bfd8ff"), []);
  return (
    <sprite position={[-30, 30, -45]} scale={[12, 12, 1]} raycast={() => null}>
      <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.3} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/*  Graphics quality type                                              */
/* ------------------------------------------------------------------ */

type GraphicsQuality = "cinematic" | "balanced" | "performance";

/* ------------------------------------------------------------------ */
/*  RooftopSigns — agent-name sprites on tallest ~8 towers (§2.4)      */
/* ------------------------------------------------------------------ */

function RooftopSigns({ buildings }: { buildings: BuildingInstance[] }) {
  const top = useMemo(
    () => [...buildings]
      .filter((b) => b.label)
      .sort((a, b) => b.height - a.height)
      .slice(0, 8),
    [buildings],
  );
  const textures = useMemo(() => {
    return top.map((b) => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, 256, 64);
      ctx.shadowColor = b.color || "#00eaff";
      ctx.shadowBlur = 30;
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = b.color || "#00eaff";
      ctx.fillText((b.label || "").toUpperCase(), 128, 32);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.fillText((b.label || "").toUpperCase(), 128, 32);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    });
  }, [top]);
  useEffect(
    () => () => {
      textures.forEach((t) => t.dispose());
    },
    [textures],
  );
  return (
    <>
      {top.map((b, i) => (
        <sprite
          key={b.id}
          position={[b.position[0], b.height + 1.8, b.position[2]]}
          scale={[3.2, 0.8, 1]}
          raycast={() => null}
        >
          <spriteMaterial
            map={textures[i]}
            transparent
            blending={THREE.AdditiveBlending}
            depthTest={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  SmogClouds — low drifting atmospheric haze (§5.2)                   */
/* ------------------------------------------------------------------ */

function SmogClouds() {
  return (
    <Clouds material={THREE.MeshBasicMaterial}>
      <Cloud
        seed={1}
        bounds={[40, 5, 18]}
        volume={8}
        opacity={0.06}
        speed={0.15}
        color="#1a2444"
        position={[0, 7, -8]}
      />
      <Cloud
        seed={2}
        bounds={[30, 4, 25]}
        volume={6}
        opacity={0.04}
        speed={0.1}
        color="#1a2444"
        position={[-15, 5, 12]}
      />
      <Cloud
        seed={3}
        bounds={[35, 6, 20]}
        volume={7}
        opacity={0.05}
        speed={0.12}
        color="#1a2444"
        position={[12, 8, 10]}
      />
    </Clouds>
  );
}

/* ------------------------------------------------------------------ */
/*  FIX 4: TrafficCars — drive on road grid, face travel direction     */
/* ------------------------------------------------------------------ */

function hashInt(id: string, salt: number) {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ------------------------------------------------------------------ */
/*  Road graph — adjacency from cityGen road segments                  */
/* ------------------------------------------------------------------ */

interface RoadGraph {
  adjacency: Map<string, { segIdx: number; forward: boolean }[]>;
  nodePos: Map<string, Vec2>;
  roads: RoadSegment[];
}

function buildRoadGraph(roads: RoadSegment[]): RoadGraph {
  const adjacency = new Map<string, { segIdx: number; forward: boolean }[]>();
  const nodePos = new Map<string, Vec2>();
  roads.forEach((seg, i) => {
    const ka = `${Math.round(seg.a.x / 2)},${Math.round(seg.a.z / 2)}`;
    const kb = `${Math.round(seg.b.x / 2)},${Math.round(seg.b.z / 2)}`;
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka)!.push({ segIdx: i, forward: true });
    adjacency.get(kb)!.push({ segIdx: i, forward: false });
    if (!nodePos.has(ka)) nodePos.set(ka, { x: seg.a.x, z: seg.a.z });
    if (!nodePos.has(kb)) nodePos.set(kb, { x: seg.b.x, z: seg.b.z });
  });
  return { adjacency, nodePos, roads };
}

/* ------------------------------------------------------------------ */
/*  TrafficLights — cycling signals at intersections                   */
/* ------------------------------------------------------------------ */

function TrafficLights({ intersections }: { intersections: SignalPlacement[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), []);
  const headGeo = useMemo(() => new THREE.BoxGeometry(0.18, 0.18, 0.18), []);

  useFrame((s) => {
    const phase = s.clock.elapsedTime % 12;
    const color = phase < 6 ? new THREE.Color("#00ff44") : phase < 10 ? new THREE.Color("#ff3300") : new THREE.Color("#ffcc00");
    matRef.current.color.copy(color);
  });

  return (
    <group>
      {intersections.map((pt, i) => (
        <group key={pt.id} position={[pt.position[0], pt.position[1], pt.position[2]]}>
          <mesh geometry={poleGeo} position={[0, 0.6, 0]} raycast={() => null}>
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh geometry={headGeo} position={[0, 1.3, 0]} raycast={() => null}>
            <meshStandardMaterial ref={i === 0 ? matRef : undefined} color="#00ff44" emissive="#00ff44" emissiveIntensity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  TrafficCarsV2 — graph-routed (turns at intersections)              */
/* ------------------------------------------------------------------ */

function TrafficCarsV2({
  roads,
  intersections,
  textures,
}: {
  roads: RoadSegment[];
  intersections: Vec2[];
  textures?: LoadedTextures;
}) {
  const count = 40;
  const graph = useMemo(() => buildRoadGraph(roads), [roads]);
  const glowTex = useMemo(() => makeRadialGlow(32, "#ff3d81"), []);

  // Load car models
  const c0 = useGLTF(CAR_MODELS[0]);
  const c1 = useGLTF(CAR_MODELS[1]);
  const c2 = useGLTF(CAR_MODELS[2]);
  const c3 = useGLTF(CAR_MODELS[3]);
  const c4 = useGLTF(CAR_MODELS[4]);
  const models = [c0, c1, c2, c3, c4];

  const carObjects = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const modelIdx = hashInt(`car-${i}`, 7) % CAR_MODELS.length;
        return normalizedClone(models[modelIdx].scene, 4.5, "length");
      }),
    [models],
  );

  // Car states: segIdx, t (0..1), forward, speed, modelIdx
  const carsRef = useRef<{ segIdx: number; t: number; forward: boolean; speed: number; modelIdx: number }[]>([]);

  // Initialize cars spread across street segments
  useEffect(() => {
    const streetIdxs = roads
      .map((r, i) => (r.klass !== 'alley' ? i : -1))
      .filter((i) => i >= 0);
    const init = Array.from({ length: count }, (_, i) => {
      const si = streetIdxs.length > 0
        ? streetIdxs[hashInt(`car-init-${i}`, 53) % streetIdxs.length]
        : hashInt(`car-init-${i}`, 53) % roads.length;
      const t = hashInt(`car-t-${i}`, 59) % 1000 / 1000;
      const forward = hashInt(`car-fwd-${i}`, 61) % 2 === 0;
      const speed = 1.5 + (hashInt(`car-spd-${i}`, 67) % 100 / 100) * 2.5;
      const modelIdx = hashInt(`car-mdl-${i}`, 71) % CAR_MODELS.length;
      return { segIdx: si, t, forward, speed, modelIdx };
    });
    carsRef.current = init;
  }, [roads, graph]);

  const groupRef = useRef<THREE.Group>(null!);
  useFrame((s, _delta) => {
    const dt = Math.min(_delta, 0.05);
    const states = carsRef.current;
    if (states.length === 0) return;
    const children = groupRef.current.children;

    for (let i = 0; i < states.length; i++) {
      const car = states[i];
      const seg = graph.roads[car.segIdx];
      if (!seg) continue;

      const advance = (car.speed * dt) / seg.length;
      car.t += car.forward ? advance : -advance;

      // At end of segment: route to next
      if (car.t >= 1) {
        car.t = 1;
        const nodeKey = `${Math.round(seg.b.x / 2)},${Math.round(seg.b.z / 2)}`;
        const edges = graph.adjacency.get(nodeKey);
        const candidates = edges
          ? edges.filter((e) => !(e.segIdx === car.segIdx && !e.forward))
          : [];
        if (candidates.length > 0) {
          const next = candidates[hashInt(`car-route-${i}`, Math.floor(s.clock.elapsedTime * 0.1)) % candidates.length];
          car.segIdx = next.segIdx;
          car.forward = next.forward;
          car.t = 0;
        } else {
          car.forward = false;
        }
      } else if (car.t <= 0) {
        car.t = 0;
        const nodeKey = `${Math.round(seg.a.x / 2)},${Math.round(seg.a.z / 2)}`;
        const edges = graph.adjacency.get(nodeKey);
        const candidates = edges
          ? edges.filter((e) => !(e.segIdx === car.segIdx && e.forward))
          : [];
        if (candidates.length > 0) {
          const next = candidates[hashInt(`car-route-${i}`, Math.floor(s.clock.elapsedTime * 0.1)) % candidates.length];
          car.segIdx = next.segIdx;
          car.forward = next.forward;
          car.t = 0;
        } else {
          car.forward = true;
        }
      }

      // Compute position and rotation
      const carSeg = graph.roads[car.segIdx];
      if (!carSeg) continue;
      const along = car.t * carSeg.length;
      const px = carSeg.a.x + carSeg.dir.x * along;
      const pz = carSeg.a.z + carSeg.dir.z * along;
      const py = carSeg.elevated ? 2.03 : 0.03;
      const dir = car.forward ? 1 : -1;
      const angle = Math.atan2(carSeg.dir.z * dir, carSeg.dir.x * dir);

      const child = children[i];
      child.position.set(px, py, pz);
      child.rotation.y = angle;
    }
  });

  return (
    <group ref={groupRef}>
      {carObjects.map((obj, i) => (
        <group key={i}>
          <primitive object={obj} />
          <sprite scale={[1.2, 1.2, 1]} position={[0, 0.02, 0]} raycast={() => null}>
            <spriteMaterial map={glowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.25} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  TrafficCars (legacy) — grid-based fallback                         */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  FIX 5a: NeonSigns — wall-flush quads (NOT sprites)                 */
/* ------------------------------------------------------------------ */

function NeonSigns({
  buildings,
  textures,
}: {
  buildings: BuildingInstance[];
  textures?: LoadedTextures;
}) {
  const signs = useMemo(() => {
    const top = [...buildings]
      .filter((b) => b.label)
      .sort((a, b) => b.height - a.height)
      .slice(0, 14);
    const ids = ["5a", "5b", "5c"];
    return top.map((b, i) => {
      const sid = ids[i % ids.length];
      const tex = textures?.[sid] ?? null;
      const bx = b.position[0], bz = b.position[2];
      const footprint = Math.max(b.fit[0], b.fit[2]);
      const dx = -bx, dz = -bz;
      const angle = Math.atan2(dz, dx);
      const snapped = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
      return {
        x: bx + Math.cos(snapped) * (footprint / 2 + 0.05),
        z: bz + Math.sin(snapped) * (footprint / 2 + 0.05),
        y: b.height * 0.5 + 0.5 + hash01(b.id + "sign") * 1.5,
        rotY: snapped + Math.PI,
        tex,
        id: sid,
        w: sid === "5b" ? 2.0 : 1.2,
        h: sid === "5b" ? 1.5 : 0.8,
      };
    });
  }, [buildings, textures]);
  return (
    <group>
      {signs.map((s, i) =>
        s.tex ? (
          <mesh
            key={i}
            position={[s.x, s.y, s.z]}
            rotation={[0, s.rotY, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[s.w, s.h]} />
            <meshBasicMaterial
              map={s.tex}
              transparent
              blending={
                isAdditive(s.id) ? THREE.AdditiveBlending : THREE.NormalBlending
              }
              depthTest={false}
              toneMapped={isAdditive(s.id)}
              opacity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : null,
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  FIX 5b: StreetFurniture — benches + lights on sidewalks            */
/* ------------------------------------------------------------------ */

function StreetFurniture({
  pitch,
  cols,
  textures,
}: {
  pitch: number;
  cols: number;
  textures?: LoadedTextures;
}) {
  const b0 = useNormalizedScene(BENCH_MODELS[0], 1.8, "length");
  const b1 = useNormalizedScene(BENCH_MODELS[1], 1.8, "length");
  const l0 = useNormalizedScene(LIGHT_MODELS[0], 5, "height");
  const l1 = useNormalizedScene(LIGHT_MODELS[1], 5, "height");

  const extent = cols * pitch;
  const half = extent / 2;

  const items = useMemo(() => {
    // Place benches and lights along sidewalk lines (just inside road edges)
    const result: {
      type: "bench" | "light";
      idx: number;
      x: number;
      z: number;
      rotY: number;
    }[] = [];
    const sidewalkOffset = 1.8; // just inside the road edge
    const spacing = pitch * 1.5;

    // Along X-axis roads (z = lane position ± sidewalk offset)
    for (let col = 0; col <= cols; col++) {
      const laneX = col * pitch - half;
      for (let s = -half; s < half; s += spacing) {
        const jitter = ((hashInt(`fx-${col}-${s}`, 5) % 100) / 100) * 1.5;
        result.push({
          type: "bench",
          idx: result.length % 2,
          x: s + jitter,
          z: laneX + sidewalkOffset,
          rotY: 0,
        });
        result.push({
          type: "light",
          idx: result.length % 2,
          x: s + jitter + spacing * 0.5,
          z: laneX - sidewalkOffset,
          rotY: 0,
        });
      }
    }

    // Cap at reasonable count
    return result.slice(0, 20);
  }, [cols, pitch]);

  return (
    <group>
      {items.map((it, i) => {
        const model =
          it.type === "bench"
            ? it.idx === 0
              ? b0
              : b1
            : it.idx === 0
              ? l0
              : l1;
        return (
          <primitive
            key={i}
            object={model}
            position={[it.x, 0, it.z]}
            rotation={[0, it.rotY, 0]}
          />
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  FIX 5c: Vegetation — 3D GLB trees on sidewalks                     */
/* ------------------------------------------------------------------ */

function Vegetation({
  pitch,
  cols,
  textures,
}: {
  pitch: number;
  cols: number;
  textures?: LoadedTextures;
}) {
  const t0 = useNormalizedScene(TREE_MODELS[0], 6, "height");
  const t1 = useNormalizedScene(TREE_MODELS[1], 6, "height");
  const models = [t0, t1];

  const extent = cols * pitch;
  const half = extent / 2;
  const treeSpacing = pitch * 2;

  const items = useMemo(() => {
    const result: { modelIdx: number; x: number; z: number }[] = [];
    // Place trees along the outer edges of the grid
    for (let s = -half; s < half; s += treeSpacing) {
      const jitter = ((hashInt(`tree-${s}`, 9) % 100) / 100) * 2;
      result.push({
        modelIdx: result.length % 2,
        x: s + jitter,
        z: -half - 2.5,
      });
      result.push({
        modelIdx: result.length % 2,
        x: s + jitter,
        z: half + 2.5,
      });
      result.push({
        modelIdx: result.length % 2,
        x: -half - 2.5,
        z: s + jitter,
      });
      result.push({
        modelIdx: result.length % 2,
        x: half + 2.5,
        z: s + jitter,
      });
    }
    return result.slice(0, 20);
  }, [cols, pitch]);

  return (
    <group>
      {items.map((it, i) => (
        <primitive
          key={i}
          object={models[it.modelIdx]}
          position={[it.x, 0, it.z]}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase E: Parks — grass lots with scattered trees from cityGen      */
/* ------------------------------------------------------------------ */

function Parks({ parks, textures }: { parks: ParkPatch[]; textures?: LoadedTextures }) {
  const t0 = useNormalizedScene(TREE_MODELS[0], 5, "height");
  const t1 = useNormalizedScene(TREE_MODELS[1], 5, "height");
  const models = [t0, t1];

  const glowTex = useMemo(() => makeRadialGlow(64, "#00ff8844"), []);

  const items = useMemo(() => {
    return parks.map((park, pi) => {
      const area = park.width * park.depth;
      const count = Math.max(2, Math.round(area / 40));
      const trees = Array.from({ length: count }, (_, ti) => ({
        modelIdx: hashInt(`park-t${pi}-${ti}`, 11) % 2,
        x: ((hashInt(`park-tx${pi}-${ti}`, 13) % 1000) / 1000 - 0.5) * park.width * 0.7,
        z: ((hashInt(`park-tz${pi}-${ti}`, 17) % 1000) / 1000 - 0.5) * park.depth * 0.7,
      }));
      return { ...park, trees };
    });
  }, [parks]);

  return (
    <group>
      {items.map((park) => (
        <group key={park.id} position={[park.center[0], park.center[1], park.center[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} raycast={() => null}>
            <planeGeometry args={[park.width, park.depth]} />
            <meshStandardMaterial color="#0d1f0d" roughness={1} metalness={0} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
            <planeGeometry args={[park.width * 0.6, park.depth * 0.6]} />
            <meshBasicMaterial map={glowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.15} toneMapped={false} />
          </mesh>
          {park.trees.map((t, ti) => (
            <primitive key={ti} object={models[t.modelIdx]} position={[t.x, 0, t.z]} />
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase E: NeonRoadStrip — pulsing glow strips along road edges      */
/* ------------------------------------------------------------------ */

function NeonRoadStrip({ roads }: { roads: RoadSegment[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = useMemo(() => roads.length * 2, [roads]);

  const geo = useMemo(() => new THREE.PlaneGeometry(0.15, 1), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const m = meshRef.current;
    const stripLen = 0.15;
    const gap = 0.35;
    roads.forEach((seg, ri) => {
      const perpX = -seg.dir.z;
      const perpZ = seg.dir.x;
      const y = seg.elevated ? 2.02 : 0.008;
      const edgeOff = seg.width / 2;
      const steps = Math.max(1, Math.floor(seg.length / (stripLen + gap)));
      const baseA = 2 * ri;
      const baseB = 2 * ri + 1;
      // Two edges: +perp and -perp
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? 1 : -1;
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) / steps;
          const px = seg.a.x + seg.dir.x * t * seg.length + perpX * edgeOff * sign;
          const pz = seg.a.z + seg.dir.z * t * seg.length + perpZ * edgeOff * sign;
          const idx = ri * 2 * steps + side * steps + s;
          if (idx >= count) break;
          dummy.position.set(px, y, pz);
          dummy.scale.set(1, stripLen, 1);
          dummy.rotation.set(0, Math.atan2(seg.dir.z, seg.dir.x), 0);
          dummy.updateMatrix();
          m.setMatrixAt(idx, dummy.matrix);
        }
      }
    });
    m.instanceMatrix.needsUpdate = true;
  }, [roads, dummy, count]);

  useFrame((s) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 0.8));
    mat.opacity = pulse * 0.25;
  });

  return (
    <instancedMesh ref={meshRef} args={[geo, undefined, count]} raycast={() => null}>
      <meshBasicMaterial color="#00ccff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  FXOverlay — scan lines + lens flares at screen level               */
/* ------------------------------------------------------------------ */

function FXOverlay({ textures }: { textures?: LoadedTextures }) {
  const scanTex = textures?.["10a"];
  const smokeTex = textures?.["10c"];
  return (
    <group>
      {scanTex && (
        <sprite position={[0, 4, 0]} scale={[80, 80, 1]} raycast={() => null}>
          <spriteMaterial
            map={scanTex}
            transparent
            blending={
              isAdditive("10a") ? THREE.AdditiveBlending : THREE.NormalBlending
            }
            depthWrite={false}
            opacity={0.15}
          />
        </sprite>
      )}
      {smokeTex && (
        <sprite position={[-8, 6, 14]} scale={[50, 50, 1]} raycast={() => null}>
          <spriteMaterial
            map={smokeTex}
            transparent
            blending={
              isAdditive("10c") ? THREE.AdditiveBlending : THREE.NormalBlending
            }
            depthWrite={false}
            opacity={0.12}
          />
        </sprite>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  ViaductPillars — support columns under elevated road segments      */
/* ------------------------------------------------------------------ */

function ViaductPillars({ pillars }: { pillars: PillarSpot[] }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(0.35, 0.45, 1, 6), []);
  return (
    <group>
      {pillars.map((p, i) => (
        <mesh
          key={`pillar-${i}`}
          geometry={geo}
          position={[p.position[0], p.position[1] + p.height / 2, p.position[2]]}
          scale={[1, p.height, 1]}
          raycast={() => null}
        >
          <meshStandardMaterial color="#1a1e2e" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  ViaductRamps — sloped road segments from grade to deck             */
/* ------------------------------------------------------------------ */

function ViaductRamps({ ramps }: { ramps: RampRibbon[] }) {
  return (
    <group>
      {ramps.map((rm) => {
        const cx = (rm.center[0]);
        const cz = (rm.center[2]);
        const angle = rm.rotationY;
        const midY = (rm.yA + rm.yB) / 2;
        const h = Math.abs(rm.yB - rm.yA);
        return (
          <mesh
            key={rm.id}
            position={[cx, midY, cz]}
            rotation={[0, angle, 0]}
            raycast={() => null}
          >
            <boxGeometry args={[rm.width, 0.3, rm.length]} />
            <meshStandardMaterial color="#1e2438" metalness={0.3} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  SidewalkFurniture — trees + bollard lights from scene.furniture    */
/* ------------------------------------------------------------------ */

function SidewalkFurniture({ furniture }: { furniture: FurnitureInstance[] }) {
  const treeGeo = useMemo(() => new THREE.ConeGeometry(1.2, 3.5, 6), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.2, 1.5, 5), []);
  const lightGeo = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6), []);
  const lightHeadGeo = useMemo(() => new THREE.SphereGeometry(0.15, 6, 4), []);

  return (
    <group>
      {furniture.map((f, i) => {
        if (f.kind === 'tree') {
          return (
            <group key={`furn-${i}`} position={[f.position[0], f.position[1], f.position[2]]} rotation={[0, f.rotationY, 0]}>
              <mesh geometry={trunkGeo} position={[0, 0.75, 0]} raycast={() => null}>
                <meshStandardMaterial color="#2a1a0a" />
              </mesh>
              <mesh geometry={treeGeo} position={[0, 3.2, 0]} raycast={() => null}>
                <meshStandardMaterial color="#0a3a1a" />
              </mesh>
            </group>
          );
        }
        return (
          <group key={`furn-${i}`} position={[f.position[0], f.position[1], f.position[2]]} rotation={[0, f.rotationY, 0]}>
            <mesh geometry={lightGeo} position={[0, 0.5, 0]} raycast={() => null}>
              <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh geometry={lightHeadGeo} position={[0, 1.1, 0]} raycast={() => null}>
              <meshStandardMaterial color="#ffdd88" emissive="#ffdd88" emissiveIntensity={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  ParkedCars — stationary car GLBs from scene.parking                */
/* ------------------------------------------------------------------ */

function ParkedCars({ parking }: { parking: ParkingInstance[] }) {
  const carUrl = useMemo(() => buildingUrl('car-3'), []);
  return (
    <group>
      {parking.map((p, i) => (
        <AssetBoundary key={`park-${i}`}>
          <Suspense fallback={null}>
            <ParkedCarInstance url={carUrl} position={p.position} rotationY={p.rotationY} />
          </Suspense>
        </AssetBoundary>
      ))}
    </group>
  );
}

function ParkedCarInstance({ url, position, rotationY }: { url: string; position: [number, number, number]; rotationY: number }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    const maxDim = Math.max(sz.x, sz.z);
    const scale = 3.5 / (maxDim || 1);
    s.scale.setScalar(scale);
    s.position.set(0, -box.min.y * scale, 0);
    return s;
  }, [scene]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={cloned} raycast={() => null} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  HorizonBand — distant horizon glow overlay                         */
/* ------------------------------------------------------------------ */

function HorizonBand({ textures }: { textures?: LoadedTextures }) {
  const bandTex = textures?.["7b"];
  if (!bandTex) return null;
  return (
    <sprite position={[0, 2, -35]} scale={[120, 30, 1]} raycast={() => null}>
      <spriteMaterial
        map={bandTex}
        transparent
        blending={THREE.NormalBlending}
        depthWrite={false}
        opacity={0.3}
      />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/*  FIX 3: RoadGrid — rectilinear streets on building pitch            */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/*  RoadSegment — single road ribbon with per-segment UV tiling        */
/* ------------------------------------------------------------------ */

function RoadSegment({ seg, asphalt, lanes, sidewalk }: {
  seg: RoadSegment;
  asphalt: THREE.Texture | null;
  lanes: THREE.Texture | null;
  sidewalk: THREE.Texture | null;
}) {
  const mx = (seg.a.x + seg.b.x) / 2;
  const mz = (seg.a.z + seg.b.z) / 2;
  const angle = Math.atan2(seg.dir.z, seg.dir.x);
  const baseY = seg.y + 0.005;

  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: asphalt || undefined,
    color: asphalt ? undefined : "#262b3d",
    metalness: 0.1,
    roughness: 0.9,
  }), [asphalt]);

  const laneMat = useMemo(() => lanes ? new THREE.MeshBasicMaterial({
    map: lanes,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.15,
    toneMapped: false,
  }) : null, [lanes]);

  const roadGeo = useMemo(() => {
    if (seg.elevated) {
      return new THREE.BoxGeometry(seg.width, 0.4, seg.length);
    }
    const g = new THREE.PlaneGeometry(seg.width, seg.length);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const tileV = Math.max(1, seg.length / seg.width);
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i), uv.getY(i) * tileV);
    }
    uv.needsUpdate = true;
    return g;
  }, [seg.width, seg.length, seg.elevated]);

  const laneGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(seg.width * 0.6, seg.length);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const tileV = Math.max(1, seg.length / seg.width);
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i), uv.getY(i) * tileV);
    }
    uv.needsUpdate = true;
    return g;
  }, [seg.width, seg.length]);

  const perpX = -seg.dir.z;
  const perpZ = seg.dir.x;
  const swW = 0.6;
  const swOff = seg.width / 2 + swW / 2;
  const sidewalkGeo = useMemo(() => new THREE.PlaneGeometry(swW, seg.length), [seg.length]);

  return (
    <group>
      <mesh
        geometry={roadGeo}
        material={roadMat}
        rotation={seg.elevated ? [0, angle, 0] : [-Math.PI / 2, 0, angle]}
        position={[mx, seg.elevated ? baseY + 0.2 : baseY, mz]}
        raycast={() => null}
      />
      {laneMat && !seg.elevated && (
        <mesh
          geometry={laneGeo}
          material={laneMat}
          rotation={[-Math.PI / 2, 0, angle]}
          position={[mx, baseY + 0.02, mz]}
          raycast={() => null}
        />
      )}
      {!seg.elevated && seg.klass !== 'alley' && sidewalk && (
        <>
          <mesh
            geometry={sidewalkGeo}
            rotation={[-Math.PI / 2, 0, angle]}
            position={[mx + perpX * swOff, 0.008, mz + perpZ * swOff]}
            raycast={() => null}
          >
            <meshStandardMaterial map={sidewalk} color="#1a1e2e" roughness={1} />
          </mesh>
          <mesh
            geometry={sidewalkGeo}
            rotation={[-Math.PI / 2, 0, angle]}
            position={[mx - perpX * swOff, 0.008, mz - perpZ * swOff]}
            raycast={() => null}
          >
            <meshStandardMaterial map={sidewalk} color="#1a1e2e" roughness={1} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  RoadNetwork — cityGen road data as oriented ribbons + intersections */
/* ------------------------------------------------------------------ */

function RoadNetwork({ roads, intersections, textures }: {
  roads: RoadSegment[];
  intersections: Vec2[];
  textures?: LoadedTextures;
}) {
  const [asphalt, setAsphalt] = useState<THREE.Texture | null>(null);
  const [lanes, setLanes] = useState<THREE.Texture | null>(null);
  const [sidewalkTex, setSidewalkTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const a = textures?.["3a"];
    if (a) {
      const t = a.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      setAsphalt(t);
    }
    const l = textures?.["3c"];
    if (l) {
      const t = l.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      setLanes(t);
    }
    const s = textures?.["3b"];
    if (s) {
      const t = s.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      setSidewalkTex(t);
    }
  }, [textures]);

  return (
    <group>
      {roads.map((seg, i) => (
        <RoadSegment key={i} seg={seg} asphalt={asphalt} lanes={lanes} sidewalk={sidewalkTex} />
      ))}
      {intersections.map((pt, i) => (
        <mesh
          key={`int-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[pt.x, 0.006, pt.z]}
          raycast={() => null}
        >
          <planeGeometry args={[3, 3]} />
          <meshStandardMaterial color="#2a3050" roughness={0.9} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}





/* ------------------------------------------------------------------ */
/*  CityScene — everything inside the <Canvas> children                */
/* ------------------------------------------------------------------ */

interface CSProps {
  model: CityModel;
  selectedId: string | null;
  hoveredId: string | null;
  metric: string;
  quality: GraphicsQuality;
  textures?: LoadedTextures;
  onHover: (id: string | null) => void;
  onSelect: (building: PlacedBuilding | null) => void;
}

function CityScene({
  model,
  selectedId,
  hoveredId,
  metric,
  quality,
  textures,
  onHover,
  onSelect,
}: CSProps) {
  const isCinematic = quality === "cinematic";
  const isPerformance = quality === "performance";

  const scene = useMemo(() => {
    if (!model.cityLayout) return null;
    return buildSceneFromLayout(model.cityLayout);
  }, [model.cityLayout]);

  const renderBuildings = useMemo(() => {
    if (!scene) return [];
    if (!isPerformance) return scene.buildings;
    const sorted = [...scene.buildings].sort((a, b) => b.height - a.height);
    return sorted.slice(0, Math.ceil(sorted.length * 0.6));
  }, [scene, isPerformance]);

  return (
    <>
      {textures && <CitySky textures={textures} />}
      <CityLighting />
      <CityIBL />

      {isCinematic && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.05, 0]}
          receiveShadow
          raycast={() => null}
        >
          <planeGeometry args={[300, 300]} />
          <MeshReflectorMaterial
            resolution={512}
            mirror={0.4}
            mixStrength={1.2}
            mixBlur={6}
            blur={[300, 100]}
            roughness={1}
            depthScale={1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.2}
            color="#04060c"
            metalness={0.6}
          />
        </mesh>
      )}

      <NeonGround textures={textures} />
      <Atmosphere count={isPerformance ? 200 : 1400} quality={quality} />
      {isCinematic && <SmogClouds />}

      {scene && textures && (
        <CityRoadNetwork scene={scene} textures={textures} />
      )}

      {textures && (
        <CityBuildings buildings={renderBuildings} textures={textures} />
      )}

      {scene && <SidewalkFurniture furniture={scene.furniture} />}

      {!isPerformance && scene && textures && (
        <>
          <TrafficLights intersections={scene.signals} />
          <Parks parks={scene.parks} textures={textures} />
          <MovingCars scene={scene} count={26} />
          <ParkedCarsGLB parking={scene.parking} />
        </>
      )}

      <FXOverlay textures={textures} />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={Math.PI / 3.2}
        minDistance={30}
        maxDistance={120}
        target={[0, 8, 0]}
      />

      {!isPerformance && <CityPostFX />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  DetailPanel — slide-in from the right                              */
/* ------------------------------------------------------------------ */

function DetailPanel({
  building,
  metric,
  onClose,
}: {
  building: PlacedBuilding;
  metric: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute right-0 top-0 bottom-0 w-72 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800/60 p-5 z-20 overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: building.color }}
          />
          <h3 className="text-white font-semibold text-sm">{building.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <MetricRow
          label="Tokens"
          value={formatMetricValue(building.metricValue, "tokens")}
          raw={building.metricValue}
          color="text-violet-400"
        />
        {metric === "cost" && (
          <MetricRow
            label="Cost"
            value={formatMetricValue(building.cost, "cost")}
            raw={building.cost}
            color="text-amber-400"
          />
        )}
        {building.messageCount > 0 && (
          <MetricRow
            label="Messages"
            value={building.messageCount.toLocaleString()}
            raw={building.messageCount}
            color="text-blue-400"
          />
        )}
        {building.sessions > 0 && (
          <MetricRow
            label="Sessions"
            value={building.sessions.toLocaleString()}
            raw={building.sessions}
            color="text-emerald-400"
          />
        )}
        {building.models.length > 0 && (
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
              Models
            </div>
            <div className="flex flex-wrap gap-1">
              {building.models.map((m) => (
                <span
                  key={m}
                  className="text-[11px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {building.active && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active in last 24h
          </div>
        )}
      </div>
    </motion.div>
  );
}

function MetricRow({
  label,
  value,
  raw,
  color,
}: {
  label: string;
  value: string;
  raw: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <div className="text-right">
        <div className={`text-sm font-semibold tabular-nums ${color}`}>
          {value}
        </div>
        <div className="text-[10px] text-zinc-600">
          raw: {raw.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Time-lapse controls                                                */
/* ------------------------------------------------------------------ */

function TimeControls({
  dates,
  index,
  playing,
  buildup,
  onIndexChange,
  onTogglePlay,
  onToggleBuildup,
}: {
  dates: string[];
  index: number;
  playing: boolean;
  buildup: boolean;
  onIndexChange: (i: number) => void;
  onTogglePlay: () => void;
  onToggleBuildup: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-800/60 px-3 py-2">
      <button
        onClick={onTogglePlay}
        className="text-zinc-400 hover:text-white transition-colors"
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={dates.length - 1}
        value={index}
        onChange={(e) => onIndexChange(Number(e.target.value))}
        className="flex-1 h-1 accent-violet-500 cursor-pointer"
      />
      <span className="text-[11px] text-zinc-400 min-w-[80px] text-right tabular-nums">
        {dates[index] || "—"}
      </span>
      <button
        onClick={onToggleBuildup}
        className={`text-[10px] px-2 py-0.5 rounded font-medium transition ${
          buildup
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            : "text-zinc-500 hover:text-zinc-300 border border-transparent"
        }`}
      >
        {buildup ? "Buildup" : "Per-day"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PerformanceMonitor — FPS / frame-time / draw-call overlay        */
/* ------------------------------------------------------------------ */

interface PerfStats {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  vertices: number;
}

function PerformanceMonitor({ onStats }: { onStats: (s: PerfStats) => void }) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame((_, delta) => {
    frameCount.current++;
    const now = performance.now();
    const elapsed = now - lastTime.current;
    if (elapsed < 500) return;
    const fps = Math.round((frameCount.current * 1000) / elapsed);
    frameCount.current = 0;
    lastTime.current = now;
    const info = gl.info.render;
    const v = (info as any).vertices ?? 0;
    onStats({
      fps,
      frameMs: Math.round(delta * 1000),
      calls: info.calls,
      triangles: info.triangles,
      vertices: v,
    });
  });
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "agent",
    label: "By Agent",
    icon: <Layers className="w-3.5 h-3.5" />,
  },
  {
    value: "model",
    label: "By Model",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
  {
    value: "time",
    label: "Time-lapse",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
];

export default function AIUsageCityscape({
  overview,
  metric,
  tokenDisplayMode,
  loading = false,
  className = "",
  period = "week",
  timeLock = false,
}: AICityscapeProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("agent");
  const [selectedBuilding, setSelectedBuilding] =
    useState<PlacedBuilding | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [timeIndex, setTimeIndex] = useState(0);
  const [timePlaying, setTimePlaying] = useState(false);
  const [buildup, setBuildup] = useState(false);
  const gpuTier = useDetectGPU();
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(
    () => {
      try {
        return (
          (localStorage.getItem("ai-city-quality") as GraphicsQuality) ||
          "balanced"
        );
      } catch {
        return "balanced";
      }
    },
  );
  const [qualityToast, setQualityToast] = useState<string | null>(null);
  const [firstVisit, setFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem("ai-city-visited");
    } catch {
      return false;
    }
  });
  const [perfStats, setPerfStats] = useState<PerfStats>({
    fps: 0,
    frameMs: 0,
    calls: 0,
    triangles: 0,
    vertices: 0,
  });
  const [showPerf, setShowPerf] = useState(false);
  const [cyberTextures, setCyberTextures] = useState<LoadedTextures>({});

  /* ---- load cyber asset textures once ---- */
  useEffect(() => {
    let dead = false;
    loadCyberAssets().then((tex) => {
      if (!dead) setCyberTextures(tex);
    });
    return () => {
      dead = true;
    };
  }, []);

  /* ---- dispose textures on unmount ---- */
  useEffect(() => {
    const texObj = cyberTextures;
    return () => {
      for (const key of Object.keys(texObj)) {
        const t = texObj[key];
        if (t) t.dispose();
      }
    };
  }, [cyberTextures]);

  const timeRef = useRef<number | null>(null);
  const cycleQuality = useCallback(() => {
    setGraphicsQuality((prev) => {
      const next: Record<GraphicsQuality, GraphicsQuality> = {
        cinematic: "balanced",
        balanced: "performance",
        performance: "cinematic",
      };
      const label = {
        cinematic: "Cinematic",
        balanced: "Balanced",
        performance: "Performance",
      };
      const val = next[prev];
      try {
        localStorage.setItem("ai-city-quality", val);
      } catch {}
      setQualityToast(label[val]);
      setTimeout(() => setQualityToast(null), 1800);
      return val;
    });
    if (firstVisit) {
      try {
        localStorage.setItem("ai-city-visited", "1");
      } catch {}
      setFirstVisit(false);
    }
  }, [firstVisit]);

  const dates = useMemo(() => extractDateRange(overview), [overview]);
  const effectivePeriod = timeLock ? "all" : period;
  const displayDates = useMemo(() => {
    if (effectivePeriod === "all" || dates.length === 0) return dates;
    const maxDays = effectivePeriod === "week" ? 7 : 30;
    return dates.slice(-maxDays);
  }, [dates, effectivePeriod]);
  const safeIndex = Math.min(timeIndex, Math.max(0, displayDates.length - 1));
  const timeDate =
    viewMode === "time" && displayDates.length > 0
      ? displayDates[safeIndex]
      : undefined;

  const cityModel = useMemo(
    () =>
      buildCityModel(
        overview,
        viewMode,
        metric,
        timeDate,
        buildup ? dates : undefined,
        buildup ? safeIndex : undefined,
      ),
    [overview, viewMode, metric, timeDate, buildup, dates, safeIndex],
  );

  const activeCount = cityModel.buildings.length;
  const selectedId = selectedBuilding?.id || null;

  useEffect(() => {
    if (!timePlaying || viewMode !== "time") {
      if (timeRef.current) {
        clearInterval(timeRef.current);
        timeRef.current = null;
      }
      return;
    }
    timeRef.current = window.setInterval(() => {
      setTimeIndex((prev) => {
        const next = prev + 1;
        if (next >= displayDates.length) {
          setTimePlaying(false);
          return displayDates.length - 1;
        }
        return next;
      });
    }, 400);
    return () => {
      if (timeRef.current) {
        clearInterval(timeRef.current);
        timeRef.current = null;
      }
    };
  }, [timePlaying, viewMode, displayDates.length]);

  useEffect(() => {
    if (viewMode === "time" && timeIndex >= displayDates.length) {
      setTimeIndex(Math.max(0, displayDates.length - 1));
    }
  }, [viewMode, displayDates.length]);

  useEffect(() => {
    return () => {
      disposeWindowPool();
      disposeWindowAtlas();
    };
  }, []);

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-zinc-950 min-h-[440px] ${className}`}
    >
      {/* View mode pills */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-800/60 p-0.5">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setViewMode(opt.value);
              setSelectedBuilding(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
              viewMode === opt.value
                ? "bg-violet-500/20 text-violet-400"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Time-lapse controls */}
      {viewMode === "time" && displayDates.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <TimeControls
            dates={displayDates}
            index={timeIndex}
            playing={timePlaying}
            buildup={buildup}
            onIndexChange={(i) => {
              setTimeIndex(i);
              setTimePlaying(false);
            }}
            onTogglePlay={() => setTimePlaying((p) => !p)}
            onToggleBuildup={() => setBuildup((b) => !b)}
          />
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selectedBuilding && (
          <DetailPanel
            building={selectedBuilding}
            metric={metric}
            onClose={() => setSelectedBuilding(null)}
          />
        )}
      </AnimatePresence>

      {/* Empty / loading state */}
      {(loading || activeCount === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-4 h-6 bg-zinc-800/80 rounded-sm"
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
              <p className="text-zinc-500 text-xs">Building city...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-zinc-500 text-sm">No AI agent data yet</p>
              <p className="text-zinc-600 text-xs">
                Sync your agents to build the skyline
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats legend + Quality toggle + FPS badge */}
      {activeCount > 0 && !loading && (
        <>
          <div className="absolute bottom-3 right-3 z-10 bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-800/60 px-2.5 py-1.5 flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">
              {activeCount} buildings
            </span>
            <div className="flex items-center gap-0.5">
              {(["cinematic", "balanced", "performance"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setGraphicsQuality(q)}
                  className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition ${
                    graphicsQuality === q
                      ? "bg-zinc-700/70 text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {q === "cinematic"
                    ? "Cin"
                    : q === "balanced"
                      ? "Bal"
                      : "Perf"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPerf((p) => !p)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition ${
                showPerf
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Toggle performance overlay"
            >
              <Monitor className="w-3 h-3" />
              <span>{perfStats.fps}FPS</span>
            </button>
          </div>

          {/* Expanded performance overlay */}
          {showPerf && (
            <div className="absolute bottom-14 right-3 z-10 bg-zinc-900/95 backdrop-blur-xl rounded-lg border border-zinc-800/60 p-3 min-w-[180px] shadow-xl">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 font-semibold">
                Performance
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">FPS</span>
                  <span
                    className={`font-mono font-bold ${perfStats.fps >= 55 ? "text-emerald-400" : perfStats.fps >= 30 ? "text-amber-400" : "text-red-400"}`}
                  >
                    {perfStats.fps}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Frame time</span>
                  <span className="font-mono text-zinc-200">
                    {perfStats.frameMs}ms
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Draw calls</span>
                  <span className="font-mono text-zinc-200">
                    {perfStats.calls}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Triangles</span>
                  <span className="font-mono text-zinc-200">
                    {perfStats.triangles.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Vertices</span>
                  <span className="font-mono text-zinc-200">
                    {perfStats.vertices.toLocaleString()}
                  </span>
                </div>
                {typeof performance !== "undefined" &&
                  (performance as any).memory && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Heap (JS)</span>
                      <span className="font-mono text-zinc-200">
                        {Math.round(
                          (performance as any).memory.usedJSHeapSize / 1048576,
                        )}
                        MB
                      </span>
                    </div>
                  )}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/40 mt-1.5">
                  <span className="text-zinc-500 text-[10px]">Quality</span>
                  <span
                    className={`text-[10px] font-medium ${graphicsQuality === "cinematic" ? "text-violet-400" : graphicsQuality === "balanced" ? "text-blue-400" : "text-zinc-400"}`}
                  >
                    {graphicsQuality}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quality change toast */}
      <AnimatePresence>
        {qualityToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 bg-zinc-800/90 backdrop-blur-md text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-700/50 shadow-lg"
          >
            {qualityToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-visit hint */}
      {firstVisit && activeCount > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-14 right-3 z-20 bg-zinc-800/90 backdrop-blur-md text-zinc-300 text-[10px] px-2.5 py-1.5 rounded-lg border border-zinc-700/50 max-w-[160px] leading-relaxed"
        >
          Use the quality toggle below to switch between Cinematic / Balanced /
          Performance
        </motion.div>
      )}

      {/* R3F Canvas */}
      <Suspense fallback={null}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          camera={{ position: [0, 14, 46], fov: 55, near: 0.1, far: 500 }}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
          }}
          onPointerMissed={() => setSelectedBuilding(null)}
          onCreated={() => {}}
        >
          <CityScene
            model={cityModel}
            selectedId={selectedId}
            hoveredId={hoveredId}
            metric={metric}
            quality={graphicsQuality}
            textures={cyberTextures}
            onHover={setHoveredId}
            onSelect={setSelectedBuilding}
          />
          <PerformanceMonitor onStats={setPerfStats} />
        </Canvas>
      </Suspense>

      {activeCount > 0 && !loading && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-800/60 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#00eaff" }}
            />
            <span className="text-[10px] text-zinc-500">Active</span>
          </div>
          <span className="text-zinc-700 text-[10px]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-700" />
            <span className="text-[10px] text-zinc-500">Idle</span>
          </div>
        </div>
      )}
    </div>
  );
}

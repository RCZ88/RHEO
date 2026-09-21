import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PlanetData } from './PlanetUtils';

// ── Main OrbitScene Component ──

export function OrbitScene({ logs, appColors, categoryOverrides, websiteLogs, websiteColors, websiteCategoryOverrides, selectedPeriod, onPeriodChange }: { logs: any[]; appColors?: Record<string, string>; categoryOverrides?: Record<string, string>; websiteLogs?: any[]; websiteColors?: Record<string, string>; websiteCategoryOverrides?: Record<string, string>; selectedPeriod?: string; onPeriodChange?: (period: string) => void }) {
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedOptions = [0.25, 0.5, 1, 2, 4];
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [textureRefreshKey, setTextureRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<'galaxy' | 'solarSystem'>('galaxy');
  const [galaxyType, setGalaxyType] = useState<'apps' | 'websites'>('apps');
  const [perfMode, setPerfMode] = useState<'high' | 'balanced' | 'performance'>(() => { try { const stored = localStorage.getItem('deskflow-graphics-quality'); if (stored === 'high' || stored === 'balanced' || stored === 'performance') return stored; } catch {} return 'balanced'; });
  useEffect(() => { try { localStorage.setItem('deskflow-graphics-quality', perfMode); } catch {} }, [perfMode]);
  const [isVisible, setIsVisible] = useState(true);
  const cameraPosRef = useRef<[number, number, number]>([0, 100, 200]);
  const fpsDisplayRef = useRef<HTMLDivElement | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string>('Other');
  const [selectedSystem, setSelectedSystem] = useState<any>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [minTimeFilter, setMinTimeFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [portalKey, setPortalKey] = useState(0);
  const controlsRef = useRef<any>(null);
  const galaxyTypeRef = useRef(galaxyType);
  const trackedPlanetRef = useRef<string | null>(null);
  const isAnimatingRef = useRef(false);
  
  const activePeriod = selectedPeriod || 'all';
  const filteredLogs = useMemo(() => logs || [], [logs]);
  const filteredWebsiteLogs = useMemo(() => websiteLogs || [], [websiteLogs]);
  
  return (
    <div className="relative w-full h-full">
      <Canvas resize={{ scroll: false, offsetSize: true }} style={{ width: '100%', height: '100%' }} key={`canvas-${textureRefreshKey}-${perfMode}`} camera={{ position: viewMode === 'galaxy' ? (galaxyType === 'websites' ? [3250, 100, 200] : [0, 100, 200]) : [0, 100, 180], fov: 45, near: 0.1, far: 10000 }} onError={(e) => console.error('[OrbitSystem] Canvas error:', e)} onCreated={({ gl }) => { gl.setClearColor('#0a0a14', 0); }} gl={{ powerPreference: 'high-performance', antialias: perfMode === 'high', alpha: false, stencil: false, depth: true, preserveDrawingBuffer: false }} dpr={Math.min(window.devicePixelRatio, perfMode === 'performance' ? 1 : 1.5)} frameloop={isVisible ? 'always' : 'demand'}>
        <PerformanceMonitor onDecline={() => { if (perfMode === 'high') setPerfMode('balanced'); else if (perfMode === 'balanced') setPerfMode('performance'); }}>
          <GLCleanup />
          <color attach="background" args={['#0a0a14']} />
          <fog attach="fog" args={['#0a0a14', 1500, 4500]} />
          <ambientLight intensity={0.13} color="#3a4a6e" />
          <hemisphereLight groundColor="#10131c" skyColor="#b8d0f0" intensity={0.18} />
          <pointLight position={[0, 0, 0]} intensity={8} color="#ffdd99" distance={400} decay={1.0} />
          <directionalLight position={[-80, -20, -60]} intensity={0.4} color="#cfe0ff" />
          <EffectComposer multisampling={perfMode === 'high' ? 4 : 0}>
            {perfMode !== 'performance' && <Bloom intensity={1.6} luminanceThreshold={0.4} luminanceSmoothing={0.5} radius={0.8} mipmapBlur />}
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            {perfMode !== 'performance' && <Vignette offset={0.25} darkness={0.5} blendFunction={BlendFunction.NORMAL} />}
          </EffectComposer>
          {showPerf && <FPSCounter fpsDisplayRef={fpsDisplayRef} fpsHistoryRef={fpsHistoryRef} />}
          {viewMode === 'galaxy' ? (
            <>
              <GalaxyView appSolarSystems={[]} websiteSolarSystems={[]} appSunConfigs={{}} websiteSunConfigs={{}} defaultSunConfig={{}} galaxyType={galaxyType} onSelectSystem={() => {}} viewMode={viewMode} animationSpeed="normal" perfMode={perfMode} />
              <CameraTracker cameraPosRef={cameraPosRef} />
              <Stars radius={5000} depth={250} count={5000} factor={7} fade speed={0.08} saturation={0.6} />
              <OrbitControls ref={controlsRef} enablePan enableZoom minDistance={50} maxDistance={5000} autoRotate={false} target={galaxyType === 'websites' ? [3250, 0, 0] : [0, 0, 0]} />
            </>
          ) : (
            <>
              <SolarSystemScene planets={[]} isPaused={isPaused} speed={speed} onPlanetClick={() => {}} controlsRef={controlsRef} onPlanetPositionUpdate={() => {}} category={currentCategory} sunSize={10} portalKey={portalKey} isAnimating={isAnimatingRef.current} showBelt={true} />
              <PlanetTracker controlsRef={controlsRef} planetPositionsRef={null as any} trackedPlanetRef={trackedPlanetRef} cameraPosRef={cameraPosRef} isAnimatingRef={isAnimatingRef} />
            </>
          )}
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}

// ── Helper Components ──

function GalaxyView({ appSolarSystems, websiteSolarSystems, appSunConfigs, websiteSunConfigs, defaultSunConfig, galaxyType, onSelectSystem, viewMode, animationSpeed, perfMode }: any) { return null; }
function CameraTracker({ cameraPosRef }: { cameraPosRef: React.MutableRefObject<[number, number, number]> }) { useFrame(({ camera }) => { cameraPosRef.current = [camera.position.x, camera.position.y, camera.position.z]; }); return null; }
function SolarSystemScene({ planets, isPaused, speed, onPlanetClick, controlsRef, onPlanetPositionUpdate, category, sunSize, portalKey, isAnimating, showBelt }: any) { return null; }
function PlanetTracker({ controlsRef, planetPositionsRef, trackedPlanetRef, cameraPosRef, isAnimatingRef }: any) { return null; }

import { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, BlendFunction } from 'postprocessing';
import { GLCleanup } from './Planet';
import { FPSCounter } from './OrbitControls';
import { PlanetUtils } from './PlanetUtils';

export function OrbitSystem(props: any) { return <OrbitScene {...props} />; }

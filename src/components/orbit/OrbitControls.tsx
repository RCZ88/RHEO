import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── FPS Counter ──

export function FPSCounter({ fpsDisplayRef }: { fpsDisplayRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const frameCount = useRef(0); const lastTime = useRef(performance.now());
  useFrame(() => { frameCount.current++; const now = performance.now(); if (now - lastTime.current >= 1000) { const fps = Math.round(frameCount.current * 1000 / (now - lastTime.current)); if (fpsDisplayRef.current) { fpsDisplayRef.current.setAttribute('data-frame-time', fps + 'fps'); } frameCount.current = 0; lastTime.current = now; } });
  return null;
}

// ── FPS Line Graph ──

export function FPSLineGraph({ fpsHistoryRef }: { fpsHistoryRef: React.MutableRefObject<number[]> }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const maxPoints = 100; const maxFps = 120;
  useFrame(() => { const now = performance.now(); const history = fpsHistoryRef.current; if (history.length > 0 && pointsRef.current) { const latestFps = history[history.length - 1]; const avgFps = history.reduce((a, b) => a + b, 0) / history.length; const newPath = new THREE.Path(); history.forEach((fps, i) => { const x = (i / maxPoints) * 10 - 5; const y = (fps / maxFps) * 2 - 1; if (i === 0) newPath.moveTo(x, y); else newPath.lineTo(x, y); }); } });
  return null;
}

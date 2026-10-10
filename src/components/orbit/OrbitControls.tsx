// FPS instrumentation for the Orbit view.
//
// WARNING (2026-10-05, agent opencode-solarfix-20261004): both components here
// were gutted alongside the rest of the orbit/ split. The stub FPSCounter wrote
// only the `data-frame-time` attribute and never set `textContent`, so the "Perf"
// panel showed "-- FPS" forever; the stub FPSLineGraph built a THREE.Path inside
// useFrame, never rendered it, and returned null. Restored from 3476073.
import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

// ── FPS Counter ──
// Lives INSIDE <Canvas> (it uses useFrame). It only writes to a ref — the text
// node is owned by the HTML overlay in OrbitScene, so this never re-renders React.
export function FPSCounter({ fpsDisplayRef, fpsHistoryRef }: { fpsDisplayRef: React.RefObject<HTMLDivElement | null>; fpsHistoryRef: React.MutableRefObject<number[]> }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / delta);
      if (fpsDisplayRef.current) {
        fpsDisplayRef.current.textContent = `${fps} FPS`;
        const frameTime = Math.round(1000 / fps);
        fpsDisplayRef.current.setAttribute('data-frame-time', `${frameTime}ms`);
      }
      // Keep the last 60 samples (60 seconds) for the sparkline.
      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > 60) fpsHistoryRef.current.shift();
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

// ── FPS Line Graph ──
// NOTE: must NOT use useFrame/useThree — this renders OUTSIDE <Canvas>, in the
// HTML overlay, so it polls on an interval instead of a render frame.
export function FPSLineGraph({ fpsHistoryRef, width = 160, height = 40 }: { fpsHistoryRef: React.MutableRefObject<number[]>; width?: number; height?: number }) {
  const pathRef = useRef<string>('');
  const [path, setPath] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const history = fpsHistoryRef.current;
      if (history.length < 2) return;

      const maxFps = 60;
      const points = history.map((fps, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - (Math.min(fps, maxFps) / maxFps) * height;
        return `${x},${y}`;
      });

      const newPath = `M ${points.join(' L ')}`;
      if (newPath !== pathRef.current) {
        pathRef.current = newPath;
        setPath(newPath);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [fpsHistoryRef, width, height]);

  if (fpsHistoryRef.current.length < 2) {
    return <div className="text-zinc-500 text-xs">Collecting data...</div>;
  }

  const latestFps = fpsHistoryRef.current[fpsHistoryRef.current.length - 1] || 0;
  const avgFps = Math.round(fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length);
  const stroke = latestFps >= 50 ? '#10b981' : latestFps >= 30 ? '#f59e0b' : '#ef4444';
  const fill = latestFps >= 50 ? 'rgba(16,185,129,0.1)' : latestFps >= 30 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">Trend (60s)</span>
        <span className="text-emerald-400 font-mono">{avgFps} avg</span>
      </div>
      <svg width={width} height={height} className="bg-zinc-800/50 rounded">
        <line x1="0" y1={height * 0.33} x2={width} y2={height * 0.33} stroke="#3f3f46" strokeWidth="1" />
        <line x1="0" y1={height * 0.66} x2={width} y2={height * 0.66} stroke="#3f3f46" strokeWidth="1" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${path} L ${width},${height} L 0,${height} Z`} fill={fill} />
      </svg>
    </div>
  );
}
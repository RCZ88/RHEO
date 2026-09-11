import React, { useEffect, useImperativeHandle, useRef } from 'react';

// FERROFLUID_LITE — our own background fluid. Same visual identity as the
// Ferrofluid shader (white blobs, downward drift, mouse glow, dark overlay
// applied by the parent) drawn with a handful of pre-blurred canvas2D sprites
// instead of a per-pixel noise shader. On software rasterizers this is ~100x
// cheaper: ~30 drawImage calls/frame vs 2.6M shaded pixels.

export interface FerrofluidLiteProps {
  className?: string;
  paused?: boolean;
  colors?: string[];
  speed?: number;
  opacity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  mouseRadius?: number; // fraction of min(canvas w, h)
  flowDirection?: 'up' | 'down' | 'left' | 'right';
  ref?: React.Ref<FerrofluidLiteHandle>;
}

export interface FerrofluidLiteHandle {
  setPointer: (clientX: number, clientY: number) => void;
}

interface Blob {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  ph: number;
  ci: number;
  base: number;
}

const RENDER_SCALE = 0.5; // backing store scale; CSS upscales (invisible under overlay+blur)
const IDLE_MS = 66; // ~15fps ambient — slow drift needs no more
const ACTIVE_MS = 33; // ~30fps for a beat after input
const IDLE_FREEZE_MS = 8000; // full stop after 8s idle; input wakes instantly

const dirVec = (d?: string): [number, number] => {
  switch (d) {
    case 'up':
      return [0, -1];
    case 'left':
      return [-1, 0];
    case 'right':
      return [1, 0];
    case 'down':
    default:
      return [0, 1];
  }
};

const FerrofluidLite: React.FC<FerrofluidLiteProps> = ({
  className,
  paused = false,
  colors = ['#ffffff'],
  speed = 0.1,
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 1,
  mouseRadius = 0.3,
  flowDirection = 'down',
  ref,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerRef = useRef<[number, number] | null>(null);
  const targetRef = useRef<[number, number] | null>(null); // resolved backing-px target; mouse glides toward it
  const mouseRef = useRef<[number, number]>([0, 0]);
  const lastTimeRef = useRef(0);
  const wakeRef = useRef<(() => void) | null>(null);
  let activeUntil = 0;
  let lastRender = 0;

  useImperativeHandle(
    ref,
    () => ({
      setPointer: (cx: number, cy: number) => {
        pointerRef.current = [cx, cy];
        activeUntil = performance.now() + 800;
        wakeRef.current?.();
      },
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;
    activeUntil = performance.now() + IDLE_FREEZE_MS;

    // One pre-blurred sprite per color — per-frame work is just drawImage.
    const palette = (colors && colors.length ? colors : ['#ffffff']).slice(0, 4);
    const sprites: HTMLCanvasElement[] = palette.map((hex) => {
      const s = document.createElement('canvas');
      s.width = 128;
      s.height = 128;
      const c = s.getContext('2d');
      if (c) {
        const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
        c.globalCompositeOperation = 'source-in';
        c.fillStyle = hex;
        c.fillRect(0, 0, 128, 128);
      }
      return s;
    });

    let W = 2;
    let H = 2;
    let blobs: Blob[] = [];
    const [dx, dy] = dirVec(flowDirection);
    const pxPerSec = 260 * speed;

    const seedBlobs = () => {
      const n = Math.max(14, Math.min(34, Math.round((W * H) / 22000)));
      const m = Math.min(W, H);
      blobs = [];
      for (let i = 0; i < n; i++) {
        const r = m * (0.06 + Math.random() * 0.13);
        blobs.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r,
          vx: dx * pxPerSec * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5) * 8,
          vy: dy * pxPerSec * (0.6 + Math.random() * 0.8) + (Math.random() - 0.5) * 8,
          ph: Math.random() * Math.PI * 2,
          ci: i % sprites.length,
          base: 0.5 + Math.random() * 0.5,
        });
      }
      // center-weighted glow blob follows the pointer
      mouseRef.current = [W / 2, H / 2];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(2, Math.round(rect.width * RENDER_SCALE));
      H = Math.max(2, Math.round(rect.height * RENDER_SCALE));
      canvas.width = W;
      canvas.height = H;
      seedBlobs();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const takePointer = () => {
      const pend = pointerRef.current;
      if (!pend) return;
      pointerRef.current = null;
      const rect = canvas.getBoundingClientRect();
      targetRef.current = [
        (pend[0] - rect.left) * RENDER_SCALE,
        (pend[1] - rect.top) * RENDER_SCALE,
      ];
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
      } else if (!rafRef.current && !paused) {
        lastTimeRef.current = 0;
        lastRender = 0;
        schedule(0);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    wakeRef.current = () => {
      if (!document.hidden && !paused) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        lastTimeRef.current = 0;
        lastRender = 0;
        if (!rafRef.current) schedule(0);
      }
    };

    // The effect only needs to render at 15–30 FPS. Scheduling a callback for
    // every display frame and discarding most of them still wakes the renderer
    // ~60 times/sec, which is noticeable when the app is under load.
    const schedule = (delay: number) => {
      if (rafRef.current || timerRef.current || document.hidden || paused) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!document.hidden && !paused) rafRef.current = requestAnimationFrame(loop);
      }, delay);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const time = t * 0.001;
      for (const b of blobs) {
        // shimmer: slow alpha breathing per blob
        const a = b.base * (0.72 + 0.28 * Math.sin(time * 0.7 + b.ph)) * opacity;
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        const s = sprites[b.ci];
        ctx.drawImage(s, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      if (mouseInteraction && mouseStrength > 0) {
        const rr = Math.max(40, Math.min(W, H) * mouseRadius * 1.6);
        ctx.globalAlpha = Math.min(1, 0.55 * mouseStrength) * opacity;
        const s = sprites[0];
        const [mx, my] = mouseRef.current;
        ctx.drawImage(s, mx - rr, my - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const step = (dt: number) => {
      takePointer();
      const mgn = Math.max(W, H) * 0.25;
      for (const b of blobs) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (dx !== 0) {
          if (b.x < -mgn) b.x = W + mgn;
          else if (b.x > W + mgn) b.x = -mgn;
          if (b.y < -b.r) b.y = H + b.r;
          else if (b.y > H + b.r) b.y = -b.r;
        } else {
          if (b.y < -mgn) b.y = H + mgn;
          else if (b.y > H + mgn) b.y = -mgn;
          if (b.x < -b.r) b.x = W + b.r;
          else if (b.x > W + b.r) b.x = -b.r;
        }
      }
      // damp resolved pointer toward stored target for glow glide
      const cur = mouseRef.current;
      const tgt = targetRef.current;
      if (tgt) {
        const tx = tgt[0];
        const ty = tgt[1];
        const tau = Math.max(1e-4, 0.15);
        let f = 1 - Math.exp(-dt / tau);
        if (f > 1) f = 1;
        cur[0] += (tx - cur[0]) * f;
        cur[1] += (ty - cur[1]) * f;
      }
    };

    const loop = (t: number) => {
      rafRef.current = null;
      if (paused) return;
      const now = performance.now();
      if (now > activeUntil + IDLE_FREEZE_MS) {
        return;
      }
      const interval = now < activeUntil ? ACTIVE_MS : IDLE_MS;
      lastRender = t;
      if (!lastTimeRef.current) lastTimeRef.current = t;
      const dt = Math.min(0.1, (t - lastTimeRef.current) / 1000);
      lastTimeRef.current = t;
      step(dt);
      draw(t);
      schedule(interval);
    };

    if (paused) {
      draw(0);
    } else {
      schedule(0);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      wakeRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
    };
  }, [colors, speed, opacity, mouseInteraction, mouseStrength, mouseRadius, flowDirection, paused]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className ?? ''}`}
    />
  );
};

export default FerrofluidLite;

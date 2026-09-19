import React, { useEffect, useRef } from 'react';

// ── THREAD FIELD — BACKGROUND-V2 candidate #2 (T2 exception, R-38 bound) ────
//
// ~300 monochrome hairline curves advected along a seeded fbm flow-field,
// continuous slow crawl. Binding conditions (R-38):
//   (a) cadence ≤30fps, timestamp-gated
//   (b) ZERO pointer reactivity — threads ignore input entirely (no prop, absent)
//   (c) visibility-gated — rAF dead when occluded/minimized
//   (d) RM → single frozen frame via `paused`, rAF never starts, never blank
//   (e) ≤8ms p95 per rendered frame at half-res backing store (CSS upscale)
//   (f) full unmount cleanup
// Engine constraint: NO Math.exp2/Math.log2 — Math.pow(2,x), Math.log(x)/Math.LN2.

export interface ThreadFieldProps {
  className?: string;
  paused?: boolean; // prefers-reduced-motion → one frozen frame, no loop
  threadCount?: number; // default 280
  speed?: number; // default 1.0 — slow crawl multiplier
}

const RENDER_SCALE = 0.5; // half-res backing store, CSS upscale
const FRAME_MS = 33; // ≤30fps timestamp gate (R-38a)
const FIELD_SEED = 99; // single deterministic seed — animation IS the variety
const STEPS = 70; // advection steps per thread per frame
const STEP_PX = 4.5; // px per step at full-res scale (scaled by RENDER_SCALE below)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (x: number) => x - Math.floor(x);

function hash2(px: number, py: number, seed: number): number {
  return fract(Math.sin(px * 127.1 + py * 311.7 + seed * 0.731) * 43758.5453);
}
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2(ix, iy, seed);
  const n10 = hash2(ix + 1, iy, seed);
  const n01 = hash2(ix, iy + 1, seed);
  const n11 = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}
function fbm(x: number, y: number, seed: number, oct: number): number {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f, y * f, seed + i * 7.3);
    tot += amp; amp *= 0.55; f *= 2.03;
  }
  return v / tot;
}

interface Thread {
  x: number; // full-res coords (scaled at draw time)
  y: number;
  off: number; // per-thread phase offset
}

const ThreadField: React.FC<ThreadFieldProps> = ({
  className,
  paused = false,
  threadCount = 280,
  speed = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    let W = 2; // backing-store px
    let H = 2;
    let FW = 2; // full-res px (for thread coords)
    let FH = 2;
    let threads: Thread[] = [];
    let phase = 0;
    let lastFrame = 0;
    let lastTs = 0;
    let dead = false; // set on unmount — loop never re-arms

    const seedThreads = () => {
      // Deterministic layout: mulberry32 so every boot draws the same field.
      let a = 20260911;
      const rnd = () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      threads = [];
      for (let i = 0; i < threadCount; i++) {
        threads.push({ x: rnd() * FW, y: rnd() * FH, off: i * 0.37 });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      FW = Math.max(2, Math.round(rect.width));
      FH = Math.max(2, Math.round(rect.height));
      W = Math.max(2, Math.round(FW * RENDER_SCALE));
      H = Math.max(2, Math.round(FH * RENDER_SCALE));
      canvas.width = W;
      canvas.height = H;
      seedThreads();
      // Redraw immediately after resize so no blank frame shows.
      draw(phase);
    };

    // Draw the full field at the given phase. Monochrome white-on-dark.
    const draw = (ph: number) => {
      ctx.clearRect(0, 0, W, H);
      const sx = W / FW; // full-res → backing-store scale
      const step = STEP_PX * RENDER_SCALE;
      ctx.lineWidth = 1;
      for (const t of threads) {
        const ex = Math.max(t.x / FW, 1 - t.x / FW, t.y / FH, 1 - t.y / FH);
        const fade = clamp(1 - ex * ex * 1.5, 0.08, 1);
        ctx.beginPath();
        let px = t.x * sx, py = t.y * sx;
        ctx.moveTo(px, py);
        for (let s = 0; s < STEPS; s++) {
          // Sample the field in full-res space so density is resolution-independent.
          const fx = px / sx / FW;
          const fy = py / sx / FH;
          const ang = fbm(fx * 3 + t.off + ph, fy * 3 + t.off * 1.7 + ph * 0.6, FIELD_SEED, 2) * Math.PI * 4;
          px += Math.cos(ang) * step;
          py += Math.sin(ang) * step;
          if (px < -10 || px > W + 10 || py < -10 || py > H + 10) break;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(255,255,255,${(0.16 * fade).toFixed(3)})`;
        ctx.stroke();
      }
    };

    const loop = (ts: number) => {
      rafRef.current = null;
      if (dead || paused || document.hidden) return;
      // Timestamp gate — ≤30fps cadence (R-38a). Skip is ~free.
      if (ts - lastFrame < FRAME_MS - 1) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastFrame = ts;
      const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;
      phase += dt * 0.12 * speed; // slow crawl
      draw(phase);
      rafRef.current = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTs = 0;
      } else if (!dead && !paused && !rafRef.current) {
        lastFrame = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);

    if (paused) {
      draw(0); // RM: single frozen frame, rAF never starts (R-38d)
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      dead = true; // (R-38f)
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
    };
  }, [paused, threadCount, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block ${className ?? ''}`}
    />
  );
};

export default ThreadField;

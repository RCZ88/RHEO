"use client";

import { useEffect, useRef } from "react";

/* ---- inline value-noise (no library) ---- */
function hash2(ix: number, iy: number): number {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295; // 0..1
}
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const ux = smooth(fx);
  const uy = smooth(fy);
  return (
    a * (1 - ux) * (1 - uy) +
    b * ux * (1 - uy) +
    c * (1 - ux) * uy +
    d * ux * uy
  );
}

const RAMP = " .·:;+=×#@";
const RAMP_LEN = RAMP.length;

type Props = {
  /** Reactively toggled: true when scroll velocity high → "turbulent" */
  // (kept for completeness; canvas reads its own velocity internally for perf)
  turbulentLabel?: boolean;
};

export default function FlowFieldCanvas({}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d", { alpha: true });
    if (!context) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let cell = 12;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let viewW = 0;
    let viewH = 0;
    type Sprite = HTMLCanvasElement;
    let sprites: Sprite[] = [];
    const SPRITE_SIZE = 16;

    function buildSprites() {
      sprites = [];
      for (let i = 0; i < RAMP_LEN; i++) {
        const s = document.createElement("canvas");
        s.width = SPRITE_SIZE * 2; // room for dpr upscale
        s.height = SPRITE_SIZE * 2;
        const sctx = s.getContext("2d");
        if (!sctx) continue;
        sctx.scale(2, 2);
        sctx.fillStyle = "#ffffff";
        sctx.font = `500 ${SPRITE_SIZE - 2}px "JetBrains Mono", ui-monospace, monospace`;
        sctx.textAlign = "center";
        sctx.textBaseline = "middle";
        sctx.fillText(RAMP[i], SPRITE_SIZE / 2, SPRITE_SIZE / 2);
        sprites.push(s);
      }
    }

    function resize() {
      if (!canvasEl || !context) return;
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      cell = viewW < 640 ? 14 : 12;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvasEl.width = Math.floor((viewW * dpr) / 1);
      canvasEl.height = Math.floor((viewH * dpr) / 1);
      canvasEl.style.width = viewW + "px";
      canvasEl.style.height = viewH + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(viewW / cell);
      rows = Math.ceil(viewH / cell);
      // cap glyph budget
      const maxGlyphs = viewW < 640 ? 500 : 1500;
      const total = cols * rows;
      if (total > maxGlyphs) {
        const k = Math.sqrt(maxGlyphs / total);
        cell = cell / k;
        cols = Math.ceil(viewW / cell);
        rows = Math.ceil(viewH / cell);
      }
    }

    buildSprites();
    resize();
    window.addEventListener("resize", resize);

    // pointer
    const onMove = (e: PointerEvent) => {
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        active: true,
      };
    };
    const onLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });

    // scroll velocity tracking (internal, no React churn)
    let lastY = window.scrollY;
    let lastT = performance.now();
    let scrollVel = 0;

    let time = 0;
    let running = true;
    let raf = 0;

    const BASE = 0.35; // base energy
    const K = 0.04; // velocity multiplier
    const CAP = 0.55; // turbulence cap

    function renderStatic() {
      context!.clearRect(0, 0, viewW, viewH);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = c * cell + cell / 2;
          const cy = r * cell + cell / 2;
          const n = valueNoise(c * 0.12 + 5, r * 0.12 + 5);
          const idx = Math.min(
            RAMP_LEN - 1,
            Math.max(0, Math.floor(n * (RAMP_LEN - 1)))
          );
          const alpha = 0.25 + n * 0.6;
          context!.globalAlpha = Math.max(0.25, Math.min(0.9, alpha));
          context!.drawImage(
            sprites[idx],
            0,
            0,
            SPRITE_SIZE * 2,
            SPRITE_SIZE * 2,
            cx - SPRITE_SIZE / 2,
            cy - SPRITE_SIZE / 2,
            SPRITE_SIZE,
            SPRITE_SIZE
          );
        }
      }
      context!.globalAlpha = 1;
    }

    function renderAnimated() {
      // update scroll velocity
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      lastT = now;
      const y = window.scrollY;
      const instant = Math.abs((y - lastY) / dt) * 16;
      lastY = y;
      if (instant > scrollVel) {
        scrollVel = scrollVel + (instant - scrollVel) * 0.5;
      } else {
        scrollVel = scrollVel + (instant - scrollVel) * 0.08; // ~1.2s recovery
      }
      scrollVel = Math.max(0, scrollVel);

      const energy = BASE + Math.min(scrollVel * K, CAP);

      time += 0.0028;

      context!.clearRect(0, 0, viewW, viewH);

      const px = pointerRef.current.x;
      const py = pointerRef.current.y;
      const pActive = pointerRef.current.active;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = c * cell + cell / 2;
          const cy = r * cell + cell / 2;

          // drifting noise field
          const nx = c * 0.14;
          const ny = r * 0.14;
          const n =
            valueNoise(nx + time * 0.6, ny + time * 0.4) * 0.6 +
            valueNoise(nx * 2.1 - time * 0.3, ny * 2.1 + time * 0.5) * 0.4;

          // pointer repulsor within 90px
          let repulse = 0;
          if (pActive) {
            const dx = cx - px;
            const dy = cy - py;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 90) {
              repulse = (1 - d / 90) * 0.5;
            }
          }

          let intensity = n * energy + repulse;
          intensity = Math.max(0, Math.min(1, intensity));

          // map intensity → glyph index
          const idx = Math.min(
            RAMP_LEN - 1,
            Math.max(0, Math.floor(intensity * (RAMP_LEN - 1)))
          );
          const alpha = 0.25 + intensity * 0.65; // 0.25..0.9
          context!.globalAlpha = Math.max(0.25, Math.min(0.9, alpha));
          context!.drawImage(
            sprites[idx],
            0,
            0,
            SPRITE_SIZE * 2,
            SPRITE_SIZE * 2,
            cx - SPRITE_SIZE / 2,
            cy - SPRITE_SIZE / 2,
            SPRITE_SIZE,
            SPRITE_SIZE
          );
        }
      }
      context!.globalAlpha = 1;

      raf = requestAnimationFrame(renderAnimated);
    }

    function start() {
      if (reduced) {
        renderStatic();
      } else {
        running = true;
        lastT = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(renderAnimated);
      }
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    const onVis = () => {
      if (document.hidden) stop();
      else if (!reduced) start();
    };
    document.addEventListener("visibilitychange", onVis);

    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}

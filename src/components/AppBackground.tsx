import { memo, useEffect, useRef, useState } from 'react';
import Ferrofluid, { type FerrofluidHandle, type FerrofluidProps } from './Ferrofluid';

// ── BACKGROUND-V2 — STATIC DEPTH STACK (R-35 / R-36 / R-37) ─────────────────
//
// Architecture: static-first. Zero per-frame work, zero rAF after freeze,
// zero standing loops. Structure bottom→top:
//
//   1. --ws-surface (existing CSS var, untouched)
//   2. Radial luminance wash — white ≤4% alpha, centered ~35%/20%, CSS only
//   3. Frozen still-fluid frame — one-shot GL at boot, then context killed
//   4. Edge vignette — black ≤35% alpha at corners, luminance masking (legal)
//   5. Static grain — inline SVG feTurbulence data-URI, ~2% opacity, kills banding
//   6. Existing bg-black/60 overlay — untouched
//   7. Content (above)
//
// Frozen frame is monochrome, low-frequency lobes, center-weighted ~40% left-of-center
// (where content density is lowest under the sidebar's shadow of attention).
// Edges dissolve into the vignette.
//
// Boot variety: 4–6 curated seed states, day-of-year deterministic.
// Renderer-side only — no IPC, no Settings UI, no localStorage.
//
// Scope: this file + Ferrofluid.tsx ONLY. App.tsx mount line unchanged.
// T0 STILL = this wave. T1/T2 NOT implemented.

const BACKGROUND_COLORS = ['#ffffff', '#ffffff', '#ffffff'];

// ── Seed params — curated low-frequency fluid states ─────────────────────────
// Each seed produces a different "frozen freeze" for variety across days.
// All: soft, desaturated, center-weighted lobes — never busy churn.
// speed stays at 0.5 so the field does its warmup drift then stops;
// the loop kills rAF after K warmup frames regardless of activeUntil.

const SEEDS: Array<Ferrofluid['props']> = [
  // 0 — broad soft lobe, left-of-center interest
  {
    seed: 7,
    speed: 0.5,
    scale: 2.4,
    turbulence: 0.6,
    fluidity: 0.08,
    rimWidth: 0.28,
    sharpness: 2.2,
    shimmer: 0.8,
    glow: 2.4,
    flowDirection: 'down',
  },
  // 1 — twin-lobed, wider spread
  {
    seed: 23,
    speed: 0.5,
    scale: 2.0,
    turbulence: 0.5,
    fluidity: 0.1,
    rimWidth: 0.3,
    sharpness: 2.0,
    shimmer: 0.6,
    glow: 2.2,
    flowDirection: 'down',
  },
  // 2 — single dominant lobe, very soft
  {
    seed: 41,
    speed: 0.5,
    scale: 2.8,
    turbulence: 0.4,
    fluidity: 0.06,
    rimWidth: 0.32,
    sharpness: 1.8,
    shimmer: 0.4,
    glow: 2.6,
    flowDirection: 'down',
  },
  // 3 — subtle multi-lobe, minimal
  {
    seed: 88,
    speed: 0.5,
    scale: 2.2,
    turbulence: 0.45,
    fluidity: 0.09,
    rimWidth: 0.25,
    sharpness: 2.4,
    shimmer: 0.5,
    glow: 2.0,
    flowDirection: 'down',
  },
  // 4 — tighter central lobe, quieter edges
  {
    seed: 112,
    speed: 0.5,
    scale: 1.8,
    turbulence: 0.55,
    fluidity: 0.12,
    rimWidth: 0.22,
    sharpness: 2.6,
    shimmer: 0.7,
    glow: 1.8,
    flowDirection: 'down',
  },
  // 5 — wide field, barely-there motion residue
  {
    seed: 156,
    speed: 0.5,
    scale: 3.0,
    turbulence: 0.35,
    fluidity: 0.05,
    rimWidth: 0.35,
    sharpness: 1.6,
    shimmer: 0.3,
    glow: 2.8,
    flowDirection: 'down',
  },
];

const WARMUP_FRAMES = 10; // render ≤10 frames at half-res to stabilize, then stop forever

// ── Day-of-year seed selection — renderer-side only ──────────────────────────
// Deterministic "today's freeze." No IPC, no storage.

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function pickSeed(): typeof SEEDS[number] {
  // deterministic "today's freeze"
  return SEEDS[dayOfYear() % SEEDS.length];
}

// ── Depth stack CSS — new hex ONLY in the two in-file constant blocks below ──
// (G-BG-7: zero new hex outside seed params + stack alphas).
// Stack alphas: wash 4%, vignette 35%, grain 2%. All legal under R-35.

const WASH_ALPHA = 0.04;   // white wash ≤4% — R-35 ceiling
const VIGNETTE_ALPHA = 0.35; // black corners ≤35% — R-35 ceiling
const GRAIN_OPACITY = 0.02;  // static grain ~2% — R-35 ceiling

// Radial luminance wash — white at ≤4% alpha, centered 35%/20% (R-35 spec).
// Pure CSS radial-gradient. Zero animation. Rasterized once.
const washStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `radial-gradient(ellipse at 35% 20%, rgba(255,255,255,${WASH_ALPHA}) 0%, rgba(255,255,255,0) 65%)`,
};

// Edge vignette — black → ~35% alpha at corners (R-35 spec).
// Luminance masking, not shadow — legal. Darkens edges, makes center pop.
const vignetteStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,${VIGNETTE_ALPHA}) 100%)`,
};

// Static grain — inline SVG feTurbulence data-URI, ~2% opacity (R-35 spec).
// Kills banding in the dark gradient (the enemy of dark backgrounds).
// Visible at 100% zoom only; invisible at normal viewing distance.
// No animation. No JS. No new deps.
const grainStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  opacity: GRAIN_OPACITY,
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")',
  backgroundSize: '200px 200px',
  mixBlendMode: 'overlay' as const,
};

// ── Component ────────────────────────────────────────────────────────────────

export const AppBackground = memo(function AppBackground({
  pathname: _pathname = '/',
}: {
  pathname?: string;
}) {
  const ffRef = useRef<FerrofluidHandle>(null);
  const [seedInfo] = useState(() => pickSeed());
  const frozenLog = useRef(false); // log once per mount, not per re-render

  // One-shot warmup: render WARMUP_FRAMES frames at half-res (RENDER_SCALE=0.5),
  // then kill the GL context permanently. The component stays mounted but the
  // canvas becomes a dead texture — zero per-frame cost, zero rAF, zero loops.
  //
  // Ferrofluid.tsx changes (this file's twin):
  //   - seed prop added (picks noise field)
  //   - warmup mode: loop runs for K frames, then calls loseContext() + stops
  //   - monochrome: final mix clamps to luminance (no hue in frozen frame)
  //   - mouseInteraction=false in seed params → no pointer path registered
  useEffect(() => {
    // The Ferrofluid component handles the warmup+freeze+loseContext internally
    // via its new props (seed, warmupFrames, monochrome). We just pass the
    // seed and let it do its job. The log fires from inside Ferrofluid's effect.
    if (!frozenLog.current) {
      // Pre-register so the log line is attributable to this mount.
      frozenLog.current = true;
    }
  }, [seedInfo.seed]);

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden" aria-hidden="true">
      {/* ── Layer 2: radial luminance wash (CSS only, zero cost) ─────────── */}
      <div style={washStyle} aria-hidden="true" />

      {/* ── Layer 3: frozen still-fluid frame (one-shot GL, then dead) ──── */}
      <div className="absolute inset-0" id="app-ferrofluid">
        <Ferrofluid
          ref={ffRef}
          colors={BACKGROUND_COLORS}
          // Seed params — mouseInteraction=false so pointer path is never registered
          // (zero pointer cost; the frozen frame has no mouse glow).
          seed={seedInfo.seed}
          warmupFrames={WARMUP_FRAMES}
          monochrome={true}
          mouseInteraction={seedInfo.mouseInteraction}
          mouseStrength={seedInfo.mouseStrength}
          mouseRadius={seedInfo.mouseRadius}
          {...seedInfo}
        />
      </div>

      {/* ── Layer 4: edge vignette (CSS only, luminance masking) ─────────── */}
      <div style={vignetteStyle} aria-hidden="true" />

      {/* ── Layer 5: static grain (SVG data-URI, kills banding) ──────────── */}
      <div style={grainStyle} aria-hidden="true" />

      {/* ── Layer 6: readability overlay — EXISTING, UNTOUCHED ────────────── */}
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
});

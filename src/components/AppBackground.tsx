import { memo, useEffect, useState } from 'react';
import ThreadField from './ThreadField';

// ── BACKGROUND-V2 — THREAD FIELD SHIP (R-35…R-39) ───────────────────────────
// Candidate #2, T2 exception granted (R-38). Static depth stack bottom→top:
//   1. --ws-surface (existing CSS var, untouched)
//   2. Radial luminance wash — white ≤4% alpha, centered ~35%/20%, CSS only
//   3. ThreadField canvas — the ONE animated layer (R-38 bound: ≤30fps,
//      zero pointer reactivity, visibility-gated, RM-frozen, half-res)
//   4. Edge vignette — black ≤35% alpha at corners, luminance masking
//   5. Static grain — inline SVG feTurbulence data-URI, ~2% opacity
//   6. Existing bg-black/60 overlay — untouched
//   7. Content (above)
// Ferrofluid.tsx + FerrofluidLite.tsx stay on disk, unmounted (rollback
// evidence + Still Fluid contingency fallback). RM wiring lives HERE per R-38
// sharpening: matchMedia sync init + change listener + cleanup → `paused`.

const WASH_ALPHA = 0.04; // R-35 ceiling
const VIGNETTE_ALPHA = 0.35; // R-35 ceiling
const GRAIN_OPACITY = 0.02; // R-35 ceiling

const washStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `radial-gradient(ellipse at 35% 20%, rgba(255,255,255,${WASH_ALPHA}) 0%, rgba(255,255,255,0) 65%)`,
};

const vignetteStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,${VIGNETTE_ALPHA}) 100%)`,
};

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

function readReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const AppBackground = memo(function AppBackground({
  pathname: _pathname = '/',
}: {
  pathname?: string;
}) {
  // Synchronous initial read — first frame is already correct, no flash.
  const [paused, setPaused] = useState<boolean>(readReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPaused(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none" aria-hidden="true">
      {/* ── Layer 2: radial luminance wash (CSS only, zero cost) ─────────── */}
      <div style={washStyle} aria-hidden="true" className="light:opacity-0"/>

      {/* ── Layer 3: animated thread field (R-38 bound, RM → frozen) ────── */}
      <div className="absolute inset-0 light:opacity-0" id="app-ferrofluid">
        <ThreadField paused={paused} />
      </div>

      {/* ── Layer 4: edge vignette (CSS only, luminance masking) ─────────── */}
      <div style={vignetteStyle} aria-hidden="true" className="light:opacity-0"/>

      {/* ── Layer 5: static grain (SVG data-URI, kills banding) ──────────── */}
      <div style={grainStyle} aria-hidden="true" className="light:opacity-0"/>

      {/* ── Layer 6: readability overlay — dark-mode only; dissolve on light ────────────── */}
      <div className="absolute inset-0 bg-black/60 light:bg-transparent" />
    </div>
  );
});

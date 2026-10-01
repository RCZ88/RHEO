import { memo, useEffect, useState } from 'react';
import {
  getAmbientPrefs,
  getPageAccent,
  ambientGradient,
  type AmbientPrefs,
} from '../lib/ambient';

// ── APP BACKGROUND — static depth stack ──────────────────────────────────────
// The animated ThreadField (squiggly advected hairlines) was removed at user
// request; a new background design is pending. Static stack bottom→top:
//   1. --ws-surface (existing CSS var, untouched)
//   2. Ambient tinted wash — NEW. Per-page hue from --page-accent, tunable.
//   3. Radial luminance wash — white ≤4% alpha, centered ~35%/20%, CSS only
//   4. Edge vignette — black ≤35% alpha at corners, luminance masking
//   5. Static grain — inline SVG feTurbulence data-URI, ~2% opacity
//   6. Existing bg-black/60 overlay — untouched
//   7. Content (above)
// ThreadField.tsx stays on disk, unmounted (rollback evidence).
//
// The ambient wash is the effect that previously only existed on the terminal
// page, where it was a hardcoded pair of radial gradients over the terminal's
// own theme. It now applies to every route and takes its hue from whichever
// --page-accent the current page declares, so each screen gets a subtly
// different tint with no per-page wiring. Settings → Appearance controls it
// (on/off, intensity, spread) via src/lib/ambient.ts.
//
// It is layer 2 — under the luminance wash, vignette, grain and the
// readability overlay — so the contrast guarantees those layers provide are
// unchanged. A tint that lifted text contrast would be a bug, not a feature.

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

export const AppBackground = memo(function AppBackground({
  pathname: _pathname = '/',
}: {
  pathname?: string;
}) {
  const [prefs, setPrefs] = useState<AmbientPrefs>(getAmbientPrefs);
  const [accent, setAccent] = useState<string | null>(null);

  // The hue comes from whichever [data-page] element is mounted, so it has to
  // be re-read after every navigation rather than captured once on mount.
  useEffect(() => {
    const sync = () => setAccent(getPageAccent());
    sync();
    const t = window.setTimeout(sync, 0);
    return () => window.clearTimeout(t);
  }, [prefs.enabled, prefs.intensity, prefs.spread]);

  useEffect(() => {
    const onChange = () => setPrefs(getAmbientPrefs());
    window.addEventListener('ambient-prefs-changed', onChange);
    return () => window.removeEventListener('ambient-prefs-changed', onChange);
  }, []);

  const ambient = prefs.enabled && prefs.intensity > 0 ? ambientGradient(prefs, accent) : null;

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none" aria-hidden="true">
      {/* ── Layer 2: ambient tinted wash, per-page hue, user-tunable ───────── */}
      {ambient && ambient !== 'none' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: ambient }} />
      )}

      {/* ── Layer 3: radial luminance wash (CSS only, zero cost) ──────────── */}
      <div style={washStyle} aria-hidden="true" className="light:opacity-0"/>

      {/* ── Layer 4: edge vignette (CSS only, luminance masking) ───────────── */}
      <div style={vignetteStyle} aria-hidden="true" className="light:opacity-0"/>

      {/* ── Layer 5: static grain (SVG data-URI, kills banding) ────────────── */}
      <div style={grainStyle} aria-hidden="true" className="light:opacity-0"/>

      {/* ── Readability overlay — dark-mode only; dissolve on light ───────── */}
      <div className="absolute inset-0 bg-black/60 light:bg-transparent" />
    </div>
  );
});

import { memo, useEffect, useState } from 'react';
import {
  getAmbientPrefs,
  getPageAccent,
  ambientGradient,
  ambientAppliesTo,
  ambientTheme,
  type AmbientPrefs,
  type AmbientTheme,
} from '../lib/ambient';

// ── APP BACKGROUND — static depth stack ──────────────────────────────────────
// The animated ThreadField (squiggly advected hairlines) was removed at user
// request; a new background design is pending. Static stack bottom→top:
//   1. --ws-surface (existing CSS var, untouched)
//   2. Ambient tinted wash — per-page hue from --page-accent, tunable, per-page scope
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
// (on/off, intensity, spread, which pages) via src/lib/ambient.ts.
//
// It is layer 2 in the STACK ORDER but paints LAST in the DOM, because it has
// to sit on top of the darkened base: underneath `bg-black/60` it was multiplied
// down to roughly a third of its alpha, so it read as though the feature were
// off. Page content sits above all of this, so legibility is unaffected.
//
// ── WHY THE OTHER THREE LAYERS ARE THEME-RESOLVED, NOT DELETED ON LIGHT ─────
// The wash, vignette and grain used to carry `light:opacity-0`, i.e. the decor
// was switched OFF on paper. That was wrong, because the three layers do not
// subtract light — they *build depth*, and paper has depth too. On a `#f5f2ec`
// field the same three jobs re-resolve to warm values instead of vanishing:
// a white sheen is light falling on the sheet, a low-ink vignette is the sheet
// curving away, and the grain is the fibre of the paper. Deleting them left
// light mode as a flat field with no surface at all — which is the bug, not the
// design. They now read `--ws-bg-*`, declared per theme in index.css, so dark
// mode is byte-identical to before and light mode keeps the decor intact while
// still staying "warm paper, not snow" (design.md §11): the vignette peaks at
// 5.5% ink, nowhere near a wash.
//
// The readability scrim below is the ONE layer that still carries
// `light:opacity-0`, because it is not decor — it is a dark veil whose only job
// is to push content away from the field behind it, and there is nothing to
// push away from on paper.

const washStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: 'var(--ws-bg-wash)',
};

const vignetteStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: 'var(--ws-bg-vignette)',
};

const grainStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  opacity: 'var(--ws-bg-grain-opacity)',
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")',
  backgroundSize: '200px 200px',
  mixBlendMode: 'overlay' as const,
};

export const AppBackground = memo(function AppBackground({
  pathname = '/',
}: {
  pathname?: string;
}) {
  const [prefs, setPrefs] = useState<AmbientPrefs>(getAmbientPrefs);
  const [accent, setAccent] = useState<string | null>(null);
  const [theme, setTheme] = useState<AmbientTheme>(() => ambientTheme());

  /* The route id the wash scopes itself to.
   *
   * `App.tsx` derives `data-page` from `location.pathname` and writes it onto
   * `<html>`, and it uses the same expression AppBackground's `pathname` prop
   * already receives. Deriving it here from the prop rather than reading the
   * attribute means the scope check cannot disagree with the accent lookup,
   * which reads that very attribute on the next tick. */
  const pageId = pathname === '/' ? 'dashboard' : pathname.replace(/^\//, '') || 'dashboard';

  // The hue comes from whichever [data-page] element is mounted, so it has to
  // be re-read after every navigation rather than captured once on mount.
  // `pathname` is the re-sync trigger. Without it this component is memoised,
  // receives no changing props, and nothing re-runs on navigation — so the tint
  // would stay frozen on whichever page happened to mount first, which is the
  // whole point of a per-page accent. App.tsx must therefore pass `pathname`.
  useEffect(() => {
    const sync = () => setAccent(getPageAccent());
    sync();
    // data-page is set on <html> by an effect that runs after this one, so read
    // it once more on the next tick rather than capturing a stale value.
    const t = window.setTimeout(sync, 0);
    return () => window.clearTimeout(t);
  }, [pathname, prefs.enabled, prefs.intensity, prefs.spread]);

  /* Re-read the theme whenever `<html>`'s class changes.
   *
   * `ambientGradient` takes the theme as a PARAMETER because the peak alpha
   * differs per field — 0.19 on the dark base, 0.13 on warm paper. Without this
   * observer, flipping to light mode left the dark-mode alpha painted over
   * paper: too strong, and visibly so. Observed rather than pushed, so it fires
   * for whichever writer owns the class (manual toggle, `system` media query,
   * a startup restore) without this file having to know about any of them. */
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || !document.documentElement) return;
    const mo = new MutationObserver(() => setTheme(ambientTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setPrefs(getAmbientPrefs());
    window.addEventListener('ambient-prefs-changed', onChange);
    return () => window.removeEventListener('ambient-prefs-changed', onChange);
  }, []);

  // `ambientAppliesTo` is the single gate for scope + enabled + intensity, so the
  // picker, the layer and the preview cannot each apply a different subset of the
  // rules and quietly disagree.
  const ambient = ambientAppliesTo(pageId, prefs) ? ambientGradient(prefs, accent, theme) : null;

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none" aria-hidden="true">
      {/* ── Layer 3: radial luminance wash — theme-resolved (see header) ──── */}
      <div style={washStyle} aria-hidden="true"/>

      {/* ── Layer 4: edge vignette, luminance masking ──────────────────────── */}
      <div style={vignetteStyle} aria-hidden="true"/>

      {/* ── Layer 5: static grain (SVG data-URI, kills banding) ────────────── */}
      <div style={grainStyle} aria-hidden="true"/>

      {/* ── Readability overlay — dark-mode only; dissolve on light ─────────
          `light:opacity-0`, NOT `light:bg-transparent`.

          This was the grey wash over every page in light mode. The blanket net
          in index.css remaps ANY `[class*="bg-black/60"]` to `--ws-scrim`
          (rgb(28 25 23 / 0.32)), and it beats `light:bg-transparent`: both
          selectors are (0,1,0), and the net is emitted LATER in the cascade
          (it sits below the `@import "tailwindcss"` output), so it wins on
          source order. Measured in Chromium with this exact markup:
            dark  -> rgba(0, 0, 0, 0.6)
            light -> rgba(28, 25, 23, 0.32)   <- the scrim, NOT transparent
          A 32%-alpha near-black veil over the whole viewport is the grey.

          `light:opacity-0` sidesteps the net entirely: it sets an ALPHA on the
          element, and the net only ever rewrites `background-color`, so there
          is nothing left for it to override. The dark theme is unaffected. */}
      <div className="absolute inset-0 bg-black/60 light:opacity-0" />

      {/* ── Layer 2: ambient tinted wash, per-page hue, per-page scope ───────
          LAST in this stack, and that is load-bearing rather than cosmetic.

          The wash is deliberately subtle. Painted *underneath* the bg-black/60
          readability overlay it was multiplied down to roughly a third of that,
          so it read as though the feature were off — it has to sit on top of the
          darkened base for the alpha the user dialled in to be the alpha they
          actually get.

          It stays inside this fixed z-0 layer, so page content is untouched.

          NO `light:opacity-0` here, deliberately — see the header comment. The
          three layers above keep theirs because they subtract light; this one
          adds colour, which is what warm paper is allowed to carry. */}
      {ambient && ambient !== 'none' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: ambient }} data-ambient-hue={accent ?? undefined} />
      )}
    </div>
  );
});

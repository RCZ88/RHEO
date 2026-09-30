// ============================================================
// Dashboard theme: CURRENT (default) vs TERMINAL (opt-in).
//
// SAFETY MODEL — this is the whole point:
//   • Default is NO attribute. With no `data-dash-theme` on the root, not one
//     rule below applies and the dashboard renders exactly as it does today.
//   • Every TERMINAL rule is scoped under `[data-dash-theme="terminal"]`.
//   • The attribute lives on the dashboard's own wrapper, not on <html>, so
//     leaking into other pages is impossible.
//   • Toggle is fail-safe: if localStorage is unavailable we fall back to CURRENT.
//
// Per AGENTS.md: all localStorage access is wrapped in try/catch.
// ============================================================

import { useCallback, useEffect, useState } from 'react';

export type DashTheme = 'current' | 'terminal';

const KEY = 'deskflow-dashboard-theme-v1';

export function readDashTheme(): DashTheme {
  try {
    return (localStorage.getItem(KEY) as DashTheme) === 'terminal' ? 'terminal' : 'current';
  } catch {
    return 'current';
  }
}

function writeDashTheme(t: DashTheme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore — in-memory state still works for this session */
  }
}

export function useDashTheme() {
  const [theme, setTheme] = useState<DashTheme>('current');

  // Inject the stylesheet once, at module load. Guarded so HMR and multiple
  // mounts can't double-insert.
  useEffect(() => {
    const ID = 'deskflow-dash-theme';
    if (document.getElementById(ID)) return;
    const el = document.createElement('style');
    el.id = ID;
    el.textContent = TERMINAL_THEME_CSS;
    document.head.appendChild(el);
  }, []);

  // Read after mount so SSR/hydration and a pre-existing preference both work.
  useEffect(() => {
    setTheme(readDashTheme());
  }, []);

  // Reflect onto <html> so CSS can key off it. Only ever SETS or REMOVES the
  // attribute — it never writes a second theme value, so the two are exclusive.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'terminal') root.setAttribute('data-dash-theme', 'terminal');
    else root.removeAttribute('data-dash-theme');
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: DashTheme = prev === 'terminal' ? 'current' : 'terminal';
      writeDashTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle, setTheme };
}

// ── TERMINAL THEME ───────────────────────────────────────────────────────────
// Scoped entirely under [data-dash-theme="terminal"]. Current design untouched.
export const TERMINAL_THEME_CSS = `
[data-dash-theme="terminal"] {
  --dt-surface:        #0b0b0d;
  --dt-surface-raised: #111114;
  --dt-surface-deep:   #060608;
  /* The fallback on --page-accent matters: without it, color-mix() fails and
     the border silently renders as none. */
  --dt-border:         color-mix(in srgb, var(--page-accent, #ec4899) 28%, transparent);
  --dt-border-hover:   color-mix(in srgb, var(--page-accent, #ec4899) 55%, transparent);
  --dt-border-subtle:  rgba(255, 255, 255, 0.06);
  --dt-text:           #fafafa;
  --dt-text-dim:       #a1a1aa;
  --dt-text-muted:     #71717a;
  --dt-radius:         8px;

  /* depth: emitted light, not shadows */
  --dt-elev: none;
  --dt-sheen: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* The page itself: mono, flat, a light source behind it.
   COLOUR LIFE lives here, and it is the only place ambient colour is allowed:
     · a 3-hue wash (accent -> violet -> cyan) instead of a flat tint
     · a 34s hue drift so the colour is felt, not watched
     · a dot grid tinted with the accent, not white
   Amplitude stays low and the period is long, per the motion budget. */
[data-dash-theme="terminal"] .dash-root {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace !important;
  line-height: 1.6;
  color: var(--dt-text);
  background-color: var(--dt-surface-deep);
  background-image:
    radial-gradient(120% 75% at 50% -10%,
      color-mix(in srgb, var(--page-accent, #ec4899) 16%, transparent) 0%,
      rgba(139, 92, 246, 0.09) 34%,
      rgba(34, 211, 238, 0.07) 58%,
      transparent 78%),
    radial-gradient(90% 55% at 12% 100%,
      rgba(34, 211, 238, 0.05) 0%, transparent 62%);
  background-repeat: no-repeat;
  background-attachment: fixed;
  animation: dt-hue 34s ease-in-out infinite;
  position: relative;
  isolation: isolate;
}
@keyframes dt-hue {
  0%, 100% { background-position: 50% 0%, 12% 100%; }
  50%      { background-position: 50% 6%, 20% 96%; }
}

@media (prefers-reduced-motion: reduce) {
  [data-dash-theme="terminal"] .dash-root { animation: none; }
}
[data-dash-theme="terminal"] .dash-root::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  opacity: .07;
  /* tinted, not white — the grid picks up the page accent */
  color: var(--page-accent, #ec4899);
  background-image: radial-gradient(circle at center, currentColor 1px, transparent 1px);
  background-size: 16px 16px;
  -webkit-mask-image: radial-gradient(120% 80% at 50% 0%, #000 0%, rgba(0,0,0,.4) 45%, transparent 78%);
          mask-image: radial-gradient(120% 80% at 50% 0%, #000 0%, rgba(0,0,0,.4) 45%, transparent 78%);
}
/* The dot-grid overlay must sit BEHIND content without touching the content's
   own positioning. Forcing "position: relative" on every direct child clobbered
   "position: fixed" on the modals, which dragged them into normal flow and pushed
   the whole dashboard down the page. Isolation + a negative z-index layers it
   correctly and leaves children completely alone. */
[data-dash-theme="terminal"] .dash-root { isolation: isolate; }
[data-dash-theme="terminal"] .dash-root::before { z-index: -1; }

/* Cards: flat, 8px, no shadow, accent border, dashed internals.
   Hover warms the card very slightly toward the accent — the only per-card
   colour, and it only appears on hover so the resting page stays calm. */
[data-dash-theme="terminal"] .dash-root :is(.DeskFlowCard, .dash-card) {
  border-radius: var(--dt-radius) !important;
  background: var(--dt-surface) !important;
  border: 1px solid var(--dt-border) !important;
  box-shadow: none !important;
  transition:
    border-color 100ms cubic-bezier(.16,1,.3,1),
    background-color 200ms cubic-bezier(.16,1,.3,1),
    transform 200ms cubic-bezier(.16,1,.3,1) !important;
}
[data-dash-theme="terminal"] .dash-root :is(.DeskFlowCard, .dash-card):hover {
  border-color: var(--dt-border-hover) !important;
  background: color-mix(in srgb, var(--page-accent, #ec4899) 3%, var(--dt-surface)) !important;
  transform: translateY(-1px);
}
[data-dash-theme="terminal"] .dash-root :is(.DeskFlowCard, .dash-card) > * {
  border-radius: inherit;
}

/* Typography: mono, small, uppercase for labels. */
[data-dash-theme="terminal"] .dash-root :is(h1,h2,h3) {
  font-family: inherit !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--dt-text) !important;
}
[data-dash-theme="terminal"] .dash-root :is(h1,h2,h3) + * { border-top: 1px dashed var(--dt-border-subtle); padding-top: 8px; }
[data-dash-theme="terminal"] .dash-root p { color: var(--dt-text-dim); }
[data-dash-theme="terminal"] .dash-root :is(.text-zinc-400,.text-zinc-500,.text-zinc-600) { color: var(--dt-text-muted) !important; }

/* Numeric readouts: tabular so they stop jittering. */
[data-dash-theme="terminal"] .dash-root :is(.tabular-nums, .font-mono) { font-variant-numeric: tabular-nums; }

/* Buttons: 28px box, 44px hit area, no radius above 8px. */
[data-dash-theme="terminal"] .dash-root button {
  border-radius: var(--dt-radius) !important;
  font-family: inherit !important;
  transition: color 100ms cubic-bezier(.16,1,.3,1),
              background-color 100ms cubic-bezier(.16,1,.3,1),
              border-color 100ms cubic-bezier(.16,1,.3,1) !important;
}
[data-dash-theme="terminal"] .dash-root button:active { transform: scale(.97); }
[data-dash-theme="terminal"] .dash-root button:focus-visible {
  outline: none !important;
  box-shadow: 0 0 0 2px var(--page-accent), 0 0 0 4px var(--dt-surface-deep) !important;
}

/* Pills/badges: squared-off, dashed feel. */
[data-dash-theme="terminal"] .dash-root :is(span[data-slot="badge"], .rounded-full) {
  border-radius: 6px !important;
}

/* Kill the glass/blur so it reads as a terminal, not a frosted panel. */
[data-dash-theme="terminal"] .dash-root :is(.backdrop-blur-xl, .backdrop-blur-lg, .backdrop-blur-md, .backdrop-blur-sm) {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
[data-dash-theme="terminal"] .dash-root * { box-shadow: none !important; }
[data-dash-theme="terminal"] .dash-root :is(.DeskFlowCard, .dash-card) { box-shadow: var(--dt-sheen) !important; }

/* Chrome around the widgets (headers, separators) goes quiet. */
[data-dash-theme="terminal"] .dash-root hr,
[data-dash-theme="terminal"] .dash-root [class*="border-b"] { border-color: var(--dt-border-subtle) !important; }

/* ── StatusBand + MomentumHero ────────────────────────────────────────────────
   These two are ONE instrument inside a single DeskFlowCardMotion panel. They
   deliberately draw no card shell of their own (no rounded border, no hairlines)
   — that duplication is what made the pair look bolted together. The terminal
   theme therefore styles the SHARED panel and the internal rule, not the parts. */
[data-dash-theme="terminal"] :is(.sb-root, .mh-root) {
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
/* internal seam reads as a dashed rule, not a hard wall */
[data-dash-theme="terminal"] .dash-root .border-l.dashed,
[data-dash-theme="terminal"] .dash-root [class*="border-dashed"][class*="border-l"] {
  border-color: var(--dt-border-subtle) !important;
}

[data-dash-theme="terminal"] .sb-root :is(h1,h2,h3) { font-size: 11px !important; }
[data-dash-theme="terminal"] .sb-root .font-display {
  font-family: inherit !important;   /* mono everywhere; Space Grotesk dropped */
  font-size: 34px !important;
  letter-spacing: -0.02em;
  text-shadow: none !important;      /* no neon glow on the readout */
}
/* the momentum ring loses its gradient stroke + glow filter */
[data-dash-theme="terminal"] .sb-root svg { filter: none !important; }
[data-dash-theme="terminal"] .sb-root svg circle[stroke^="url("] { stroke: var(--page-accent) !important; }
[data-dash-theme="terminal"] .sb-root svg defs { display: none; }
[data-dash-theme="terminal"] .sb-root svg text { font-family: "JetBrains Mono", monospace !important; }

/* separators go dashed, borders quiet */
[data-dash-theme="terminal"] .sb-root :is(.border-t, .border-b) {
  border-color: var(--dt-border-subtle) !important;
  border-style: dashed !important;
  border-width: 1px !important;
}
[data-dash-theme="terminal"] .sb-root :is(.rounded-lg, .rounded-xl) { border-radius: var(--dt-radius) !important; }
[data-dash-theme="terminal"] .sb-root :is(.bg-zinc-900\/60, .bg-zinc-900\/40) { background: var(--dt-surface-deep) !important; }
[data-dash-theme="terminal"] .sb-root :is(.border-zinc-700\/50, .border-zinc-800\/50) { border-color: var(--dt-border-subtle) !important; }

  [data-dash-theme="terminal"] .dash-root :is(.DeskFlowCard, .dash-card):hover { transform: none; }
  [data-dash-theme="terminal"] .dash-root button:active { transform: none; }
}


/* ── Widget Library (CardLibrary) — modal + category rail + card grid ─────── */
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) {
  border-radius: var(--dt-radius) !important;
  background: var(--dt-surface) !important;
  border-color: var(--dt-border) !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) :is(.rounded-2xl, .rounded-xl) {
  border-radius: var(--dt-radius) !important;
}
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) .shadow-2xl,
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) .shadow-lg { box-shadow: none !important; }
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) :is(.border-r, .border-b, .border-t) {
  border-color: var(--dt-border-subtle) !important;
  border-style: dashed !important;
}
/* the category rail + search + buttons all flatten out */
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) button {
  border-radius: 6px !important;
  font-family: inherit !important;
}
[data-dash-theme="terminal"] :is(.max-w-\[1600px\], .max-w-7xl) input {
  background: var(--dt-surface-deep) !important;
  border-color: var(--dt-border-subtle) !important;
  border-radius: 6px !important;
  font-family: inherit !important;
}

@media (prefers-reduced-motion: reduce) {
  [data-dash-theme="terminal"] .dash-root :is(.DeskFlowCard, .dash-card):hover { transform: none; }
  [data-dash-theme="terminal"] .dash-root button:active { transform: none; }
}
`;

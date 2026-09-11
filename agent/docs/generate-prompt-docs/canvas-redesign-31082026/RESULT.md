# Canvas Mode Redesign — "Deep Field"

## 1. Design Direction

I went with a direction I'm calling **Deep Field**: the canvas is treated as a night-sky instrument panel — a near-black field (lifted off pure black to kill banding) with a slowly-breathing aurora tint and film grain, where every card is a frosted slab carrying exactly **one accent light** in its header that bleeds into the glass like light refracting through an edge. All 14 card types share a single neutral chrome but pull their color from one formalized type-spectrum (the same palette already drives your minimap and drawer, so the whole app becomes chromatically coherent). Depth is now a strict hierarchy — heavy glass for command surfaces (input bar, palette, manager, drawer), medium for cards, light for navigation chrome (minimap, save pill, zoom) — and motion is springy-but-restrained: light *responds* (glow intensifies on hover/drag/focus) rather than things bouncing around. The input bar is the flagship: a Raycast-grade command slab with an ambient underglow that breathes when idle and sharpens when focused. Everything ships as CSS-only drop-in files; the two optional TSX hooks (below) unlock per-type skeletons and progress rings but the design degrades gracefully without them.

**Import order matters:** `design-tokens.css` → `canvas.css` → `cards.css`.

---

## 2. CSS Files

### `src/components/ai/design-tokens.css`

```css
/* ============================================================================
   RHEO / DeskFlow — Design Tokens · "Deep Field"
   Single source of truth: color, glass, depth, motion, type primitives.
   All legacy --dk-* token names preserved. New tokens appended.
   ========================================================================== */

:root {
  /* ---- Surfaces ---------------------------------------------------------- */
  --dk-bg-deep: #050507;              /* lifted off pure black — grain + aurora need it to avoid banding */
  --dk-bg-base: #09090b;
  --dk-bg-surface: rgba(9, 9, 11, 0.80);
  --dk-bg-raised: rgba(24, 24, 27, 0.65);
  --dk-bg-input: rgba(24, 24, 27, 0.85);

  /* ---- Text --------------------------------------------------------------- */
  --dk-text-primary: #fafafa;
  --dk-text-secondary: #a1a1aa;
  --dk-text-muted: #71717a;

  /* ---- Hairlines ------------------------------------------------------------ */
  --dk-border-subtle: rgba(255, 255, 255, 0.06);
  --dk-border-default: rgba(255, 255, 255, 0.09);
  --dk-border-strong: rgba(255, 255, 255, 0.14);

  /* ---- Global accent ---------------------------------------------------------- */
  --dk-accent: #fafafa;
  --dk-success: #22c55e;
  --dk-warning: #eab308;
  --dk-danger: #ef4444;

  /* ---- Card type spectrum ------------------------------------------------------
     The one chromatic system. Cards, minimap rects, drawer tiles, palette icons,
     and group accents all pull from here. */
  --dk-type-focus: #f472b6;
  --dk-type-plan: #a78bfa;
  --dk-type-reflect: #c084fc;
  --dk-type-finance: #34d399;
  --dk-type-digest: #22d3ee;
  --dk-type-approval: #fbbf24;
  --dk-type-transient: #71717a;
  --dk-type-annotation: #fb923c;
  --dk-type-response: #60a5fa;
  --dk-type-group: #818cf8;
  --dk-type-connectors: #2dd4bf;
  --dk-type-schedule: #f87171;
  --dk-type-deadlines: #f97316;
  --dk-type-planner: #38bdf8;
  --dk-type-automation: #e879f9;   /* new — fuchsia was unused in the spectrum */

  /* ---- Depth ladder -------------------------------------------------------------- */
  --dk-elev-1: 0 1px 2px rgba(0, 0, 0, 0.35), 0 8px 24px -10px rgba(0, 0, 0, 0.50);
  --dk-elev-2: 0 2px 4px rgba(0, 0, 0, 0.35), 0 16px 40px -12px rgba(0, 0, 0, 0.60);
  --dk-elev-3: 0 4px 8px rgba(0, 0, 0, 0.40), 0 28px 64px -16px rgba(0, 0, 0, 0.70);
  --dk-elev-4: 0 8px 16px rgba(0, 0, 0, 0.50), 0 40px 90px -20px rgba(0, 0, 0, 0.80);

  /* ---- Legacy shadow tokens (names preserved, values refined) ---------------------- */
  --dk-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --dk-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.45), 0 12px 32px -12px rgba(0, 0, 0, 0.50), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --dk-shadow-lg: 0 8px 20px rgba(0, 0, 0, 0.50), 0 28px 64px -18px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  --dk-shadow-glow: 0 0 0 1px rgba(250, 250, 250, 0.12), 0 0 24px -4px rgba(250, 250, 250, 0.18);

  /* ---- Glass plumbing ---------------------------------------------------------------- */
  --dk-sheen: rgba(255, 255, 255, 0.10);
  --dk-blur-sm: 14px;
  --dk-blur-md: 28px;
  --dk-blur-lg: 48px;

  /* Monochrome film grain (self-alpha ≈ 4% baked into the rect) */
  --dk-noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");

  /* ---- Motion -------------------------------------------------------------------------- */
  --dk-ease: cubic-bezier(0.16, 1, 0.3, 1);            /* legacy name, kept */
  --dk-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --dk-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dk-dur-fast: 140ms;
  --dk-dur-base: 220ms;
  --dk-dur-slow: 420ms;
  --dk-dur-ambient: 26s;

  /* ---- Shape / grid ------------------------------------------------------------------------ */
  --dk-radius-sm: 6px;
  --dk-radius-md: 10px;
  --dk-radius-lg: 12px;
  --dk-radius-xl: 16px;                                /* new */
  --dk-radius-pill: 999px;                             /* new */
  --dk-cell: 40px;

  /* ---- Typography ---------------------------------------------------------------------------- */
  --dk-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --dk-display: 'Space Grotesk', var(--dk-sans);
  --dk-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
  --dk-text-2xs: 10px;
  --dk-text-xs: 11px;
  --dk-text-sm: 12px;
  --dk-text-base: 13px;
  --dk-text-md: 15px;
  --dk-text-lg: 18px;
  --dk-text-xl: 24px;
  --dk-text-2xl: 32px;
  --dk-tracking-wide: 0.12em;
  --dk-tracking-tight: -0.02em;
}

/* Animatable custom properties (Chromium — degrades gracefully elsewhere) */
@property --dk-ring-p {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

/* ============================================================================
   ACCENT WIRING — any element carrying data-card-type / data-type picks up
   its accent light. Selector values must match your CardType union literals
   exactly (casing included); adjust here if your union differs.
   ========================================================================== */
[data-card-type="focus"],           [data-type="focus"]           { --card-accent: var(--dk-type-focus); }
[data-card-type="plan"],            [data-type="plan"]            { --card-accent: var(--dk-type-plan); }
[data-card-type="reflect"],         [data-type="reflect"]         { --card-accent: var(--dk-type-reflect); }
[data-card-type="finance"],         [data-type="finance"]         { --card-accent: var(--dk-type-finance); }
[data-card-type="digest"],          [data-type="digest"]          { --card-accent: var(--dk-type-digest); }
[data-card-type="approval"],        [data-type="approval"]        { --card-accent: var(--dk-type-approval); }
[data-card-type="annotation"],      [data-type="annotation"]      { --card-accent: var(--dk-type-annotation); }
[data-card-type="response"],        [data-type="response"]        { --card-accent: var(--dk-type-response); }
[data-card-type="group"],           [data-type="group"]           { --card-accent: var(--dk-type-group); }
[data-card-type="connectors"],      [data-type="connectors"]      { --card-accent: var(--dk-type-connectors); }
[data-card-type="weeklySchedule"],  [data-type="schedule"]        { --card-accent: var(--dk-type-schedule); }
[data-card-type="deadlineTracker"], [data-type="deadlines"]       { --card-accent: var(--dk-type-deadlines); }
[data-card-type="dailyPlanner"],    [data-type="planner"]         { --card-accent: var(--dk-type-planner); }
[data-card-type="automation"],      [data-type="automation"]      { --card-accent: var(--dk-type-automation); }
[data-card-type="dynamic"],         [data-type="transient"]       { --card-accent: var(--dk-type-transient); }

/* ============================================================================
   GLASS SYSTEM — same class names, richer internals.
   Every surface gets a top-edge light ("the sheen") so all glass reads as
   lit from above. Combine with component classes freely; they're additive.
   ========================================================================== */

.dk-glass {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0) 32%),
    rgba(18, 18, 22, 0.55);
  -webkit-backdrop-filter: blur(20px) saturate(1.7);
  backdrop-filter: blur(20px) saturate(1.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.dk-glass-heavy {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 28%),
    rgba(14, 14, 17, 0.82);
  -webkit-backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    0 0 0 1px rgba(0, 0, 0, 0.40),
    var(--dk-elev-4);
}

.dk-glass-card {
  border-radius: var(--dk-radius-lg);
  background:
    linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.028) 46%, transparent 52%),
    linear-gradient(168deg, rgba(30, 30, 35, 0.74) 0%, rgba(12, 12, 14, 0.55) 55%, rgba(9, 9, 11, 0.62) 100%);
  -webkit-backdrop-filter: blur(var(--dk-blur-md)) saturate(1.75);
  backdrop-filter: blur(var(--dk-blur-md)) saturate(1.75);
  border: 1px solid rgba(255, 255, 255, 0.085);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.30),
    0 2px 6px rgba(0, 0, 0, 0.28),
    0 14px 34px -12px rgba(0, 0, 0, 0.55);
}

/* ============================================================================
   TYPE PRIMITIVES
   ========================================================================== */

.dk-display { font-family: var(--dk-display); letter-spacing: var(--dk-tracking-tight); }

.dk-num {
  font-family: var(--dk-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  font-weight: 600;
}

.dk-mono { font-family: var(--dk-mono); font-variant-numeric: tabular-nums; }

.dk-eyebrow {
  font: 600 var(--dk-text-2xs)/1 var(--dk-sans);
  letter-spacing: var(--dk-tracking-wide);
  text-transform: uppercase;
  color: var(--dk-text-muted);
}

/* ============================================================================
   SHARED CONTROLS (used across canvas, cards, panels)
   ========================================================================== */

.dk-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--dk-radius-md);
  font: 500 var(--dk-text-sm)/1 var(--dk-sans);
  color: var(--dk-text-primary);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--dk-border-default);
  cursor: pointer;
  user-select: none;
  transition:
    background var(--dk-dur-fast) var(--dk-ease-out),
    border-color var(--dk-dur-fast) var(--dk-ease-out),
    translate var(--dk-dur-fast) var(--dk-ease-out),
    scale var(--dk-dur-fast) var(--dk-ease-out),
    filter var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-btn:hover  { background: rgba(255, 255, 255, 0.10); border-color: var(--dk-border-strong); translate: 0 -1px; }
.dk-btn:active { translate: 0 0; scale: 0.97; }

.dk-btn--primary {
  background: linear-gradient(180deg, #ffffff, #d7d7dc);
  color: #0a0a0c;
  border-color: transparent;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.dk-btn--primary:hover { filter: brightness(1.05); background: linear-gradient(180deg, #ffffff, #d7d7dc); }

.dk-btn--ghost { background: transparent; border-color: transparent; color: var(--dk-text-secondary); }
.dk-btn--ghost:hover { background: rgba(255, 255, 255, 0.06); color: var(--dk-text-primary); }

.dk-btn--danger { color: var(--dk-danger); }
.dk-btn--danger:hover { background: color-mix(in srgb, var(--dk-danger) 12%, transparent); border-color: color-mix(in srgb, var(--dk-danger) 35%, transparent); }

.dk-btn--approve {
  color: var(--dk-success);
  background: color-mix(in srgb, var(--dk-success) 14%, transparent);
  border-color: color-mix(in srgb, var(--dk-success) 32%, transparent);
}
.dk-btn--approve:hover { background: color-mix(in srgb, var(--dk-success) 24%, transparent); border-color: color-mix(in srgb, var(--dk-success) 48%, transparent); }

.dk-btn--deny {
  color: var(--dk-danger);
  background: color-mix(in srgb, var(--dk-danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--dk-danger) 30%, transparent);
}
.dk-btn--deny:hover { background: color-mix(in srgb, var(--dk-danger) 22%, transparent); border-color: color-mix(in srgb, var(--dk-danger) 45%, transparent); }

.dk-icon-btn {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--dk-radius-sm);
  background: transparent;
  color: var(--dk-text-muted);
  cursor: pointer;
  transition:
    background var(--dk-dur-fast) var(--dk-ease-out),
    color var(--dk-dur-fast) var(--dk-ease-out),
    scale var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-icon-btn:hover  { background: rgba(255, 255, 255, 0.08); color: var(--dk-text-primary); }
.dk-icon-btn:active { scale: 0.86; }
.dk-icon-btn--active {
  color: var(--card-accent, var(--dk-accent));
  background: color-mix(in srgb, var(--card-accent, #ffffff) 14%, transparent);
}

.dk-kbd {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 5px;
  border-radius: 5px;
  font: 500 10px/1 var(--dk-mono);
  color: var(--dk-text-muted);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.35);
}

/* ============================================================================
   SCROLLBARS / SELECTION / FOCUS
   ========================================================================== */

.dk-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.14) transparent; }
.dk-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.dk-scroll::-webkit-scrollbar-track { background: transparent; }
.dk-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.10);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.dk-scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.20); }

::selection { background: rgba(250, 250, 250, 0.22); }

:focus-visible {
  outline: 2px solid rgba(250, 250, 250, 0.55);
  outline-offset: 2px;
}

/* ============================================================================
   SHARED KEYFRAMES
   ========================================================================== */

@keyframes dk-fade-in   { from { opacity: 0; } }
@keyframes dk-rise      { from { opacity: 0; translate: 0 10px; scale: 0.97; } }
@keyframes dk-pop       { from { opacity: 0; scale: 0.92; } }
@keyframes dk-card-enter{ 0% { opacity: 0; scale: 0.93; translate: 0 12px; } 60% { opacity: 1; } 100% { opacity: 1; scale: 1; translate: 0 0; } }
@keyframes dk-breathe   { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.95; } }
@keyframes dk-float-slow{ 0%, 100% { translate: 0 0; } 50% { translate: 0 -5px; } }
@keyframes dk-spin      { to { rotate: 360deg; } }
@keyframes dk-dash      { to { stroke-dashoffset: -34; } }
@keyframes dk-ping      { 0% { scale: 0.6; opacity: 0.8; } 80%, 100% { scale: 2.2; opacity: 0; } }
@keyframes dk-shimmer   { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes dk-bar-grow  { from { scale: 1 0; } }
@keyframes dk-check-pop { 0% { scale: 0.4; opacity: 0; } 60% { scale: 1.2; } 100% { scale: 1; opacity: 1; } }
@keyframes dk-shake     { 0%, 100% { translate: 0 0; } 25% { translate: -3px 0; } 50% { translate: 3px 0; } 75% { translate: -2px 0; } }
@keyframes dk-caret     { 0%, 45% { opacity: 1; } 50%, 95% { opacity: 0; } }
@keyframes dk-voice-ring{ from { scale: 1; opacity: 0.7; } to { scale: 2.1; opacity: 0; } }
@keyframes dk-aurora {
  0%   { transform: translate3d(-3%, -2%, 0) scale(1); }
  50%  { transform: translate3d(3%, 3%, 0) scale(1.08); }
  100% { transform: translate3d(-2%, 2%, 0) scale(1.02); }
}

/* ============================================================================
   REDUCED MOTION
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### `src/components/ai/canvas/canvas.css`

```css
/* ============================================================================
   RHEO / DeskFlow — Canvas chrome · "Deep Field"
   Atmosphere, grid, minimap, manager panel, drawer, palette, input bar,
   save indicator, find arrow, zoom controls, interaction chrome.

   NOTE: if your TSX uses legacy class names for any of these, either update
   the class strings (cheap) or append the legacy name to the selector —
   e.g.  .dk-minimap, .canvas-minimap { … }
   ========================================================================== */

/* ----------------------------------------------------------------------------
   1. CANVAS ROOT — the deep field
   ---------------------------------------------------------------------------- */

.dk-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  background-color: var(--dk-bg-deep);
  /* grain sits directly in the field; translucent glass picks it up */
  background-image:
    var(--dk-noise),
    radial-gradient(1200px 800px at 50% 36%, rgba(120, 120, 150, 0.06), transparent 60%),
    radial-gradient(900px 700px at 84% 88%, rgba(94, 234, 212, 0.035), transparent 65%),
    radial-gradient(1000px 800px at 10% 92%, rgba(167, 139, 250, 0.045), transparent 65%);
  background-size: 160px 160px, auto, auto, auto;
}
.dk-canvas:active { cursor: grabbing; }

/* Aurora — two slow color fields drifting behind the world */
.dk-canvas::before {
  content: "";
  position: absolute;
  inset: -20%;
  pointer-events: none;
  background:
    radial-gradient(640px 420px at 24% 22%, rgba(139, 92, 246, 0.07), transparent 70%),
    radial-gradient(760px 520px at 78% 72%, rgba(45, 212, 191, 0.05), transparent 70%),
    radial-gradient(560px 420px at 70% 16%, rgba(244, 114, 182, 0.04), transparent 70%);
  animation: dk-aurora var(--dk-dur-ambient) ease-in-out infinite alternate;
}

/* Vignette — sits above content, darkens the horizon line */
.dk-canvas::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 70;
  pointer-events: none;
  background: radial-gradient(130% 100% at 50% 42%, transparent 55%, rgba(0, 0, 0, 0.42) 100%);
}

/* Optional filmic grain OVER everything (comment the vignette's z-index
   conflict away — if you enable this, drop the noise layer from the root):
.dk-grain-top {
  position: absolute; inset: 0; z-index: 80; pointer-events: none;
  background-image: var(--dk-noise); background-size: 160px 160px;
}
*/

/* ----------------------------------------------------------------------------
   2. WORLD + GRID
   ---------------------------------------------------------------------------- */

.dk-canvas-world {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.dk-canvas-grid {
  position: absolute;
  pointer-events: none;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1.4px),
    radial-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1.4px);
  background-size:
    calc(var(--dk-cell) * 5) calc(var(--dk-cell) * 5),
    var(--dk-cell) var(--dk-cell);
  -webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 45%, #000 40%, transparent 100%);
  mask-image: radial-gradient(ellipse 90% 80% at 50% 45%, #000 40%, transparent 100%);
}

/* Empty canvas — an invitation, not a void */
.dk-canvas-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 5;
}
.dk-canvas-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
  animation: dk-rise 600ms var(--dk-ease-out) backwards;
}
.dk-canvas-empty-icon {
  position: relative;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--dk-text-muted);
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.14);
  animation: dk-float-slow 7s ease-in-out infinite;
}
.dk-canvas-empty-icon::after {
  content: "";
  position: absolute;
  inset: -10px;
  border-radius: 26px;
  border: 1px dashed rgba(255, 255, 255, 0.07);
  animation: dk-spin 24s linear infinite;
}
.dk-canvas-empty-title {
  font: 500 var(--dk-text-md)/1.3 var(--dk-display);
  letter-spacing: var(--dk-tracking-tight);
  color: var(--dk-text-secondary);
}
.dk-canvas-empty-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--dk-text-xs);
  color: var(--dk-text-muted);
}

/* ----------------------------------------------------------------------------
   3. INTERACTION CHROME — marquee, snap guides, drag
   ---------------------------------------------------------------------------- */

.dk-marquee {
  position: absolute;
  pointer-events: none;
  z-index: 20;
  border: 1px solid rgba(250, 250, 250, 0.45);
  border-radius: 4px;
  background: rgba(250, 250, 250, 0.05);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.35);
}

.dk-snap-guide {
  position: absolute;
  pointer-events: none;
  z-index: 25;
  background: linear-gradient(90deg, transparent, rgba(250, 250, 250, 0.6), transparent);
  box-shadow: 0 0 6px rgba(250, 250, 250, 0.35);
}
.dk-snap-guide--v { width: 1px; top: 0; bottom: 0; }
.dk-snap-guide--h { height: 1px; left: 0; right: 0; background: linear-gradient(0deg, transparent, rgba(250, 250, 250, 0.6), transparent); }

/* ----------------------------------------------------------------------------
   4. MINIMAP — premium navigation, not a debug tool
   ---------------------------------------------------------------------------- */

.dk-minimap {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 30;
  padding: 10px;
  border-radius: var(--dk-radius-lg);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0) 40%),
    rgba(12, 12, 15, 0.62);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), var(--dk-elev-2);
}
.dk-minimap svg { display: block; overflow: visible; }
.dk-minimap rect {
  rx: 3px;
  ry: 3px;
  stroke: rgba(255, 255, 255, 0.16);
  stroke-width: 0.5;
  transition: filter var(--dk-dur-fast) var(--dk-ease-out), opacity var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-minimap rect:hover { filter: brightness(1.35); }

.dk-minimap-viewport {
  fill: rgba(250, 250, 250, 0.05);
  stroke: rgba(250, 250, 250, 0.50);
  stroke-width: 1;
  rx: 4px;
  transition: x 180ms var(--dk-ease-out), y 180ms var(--dk-ease-out),
              width 180ms var(--dk-ease-out), height 180ms var(--dk-ease-out);
}

/* ----------------------------------------------------------------------------
   5. MANAGER PANEL — premium palette, not a settings menu
   ---------------------------------------------------------------------------- */

.dk-manager {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 35;
  width: 300px;
  display: flex;
  flex-direction: column;
  border-radius: 0 var(--dk-radius-xl) var(--dk-radius-xl) 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0) 26%),
    rgba(13, 13, 16, 0.86);
  -webkit-backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  border-right: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: var(--dk-elev-4);
  transition: translate var(--dk-dur-slow) var(--dk-ease), opacity var(--dk-dur-slow) var(--dk-ease);
}
.dk-manager--closed { translate: calc(-100% - 16px) 0; opacity: 0; pointer-events: none; }

.dk-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 12px;
}
.dk-manager-title {
  font: 600 var(--dk-text-md)/1 var(--dk-display);
  letter-spacing: var(--dk-tracking-tight);
  color: var(--dk-text-primary);
}

.dk-manager-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dk-manager-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 9px 14px;
  border-radius: var(--dk-radius-md);
  cursor: pointer;
  transition: background var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-manager-item:hover { background: rgba(255, 255, 255, 0.045); }
.dk-manager-item--active { background: rgba(255, 255, 255, 0.06); }
.dk-manager-item--active::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: var(--dk-accent);
  box-shadow: 0 0 8px rgba(250, 250, 250, 0.35);
}
.dk-manager-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 500 var(--dk-text-sm)/1.3 var(--dk-sans);
  color: var(--dk-text-secondary);
}
.dk-manager-item--active .dk-manager-item-name { color: var(--dk-text-primary); }
.dk-manager-item-meta {
  font: 400 10px/1 var(--dk-mono);
  color: var(--dk-text-muted);
  white-space: nowrap;
}

.dk-manager-input {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--dk-radius-md);
  border: 1px solid var(--dk-border-default);
  background: var(--dk-bg-input);
  color: var(--dk-text-primary);
  font: 400 var(--dk-text-sm)/1 var(--dk-sans);
  outline: none;
  transition: border-color var(--dk-dur-fast) var(--dk-ease-out), box-shadow var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-manager-input:focus {
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 0 0 3px rgba(250, 250, 250, 0.06);
}

.dk-manager-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--dk-border-subtle);
}

.dk-manager-empty {
  margin: 12px;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: var(--dk-radius-lg);
  color: var(--dk-text-muted);
  font-size: var(--dk-text-xs);
}

/* ----------------------------------------------------------------------------
   6. CARD DRAWER — the storefront
   ---------------------------------------------------------------------------- */

.dk-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 45;
  width: 340px;
  display: flex;
  flex-direction: column;
  border-radius: var(--dk-radius-xl) 0 0 var(--dk-radius-xl);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0) 26%),
    rgba(13, 13, 16, 0.86);
  -webkit-backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: var(--dk-elev-4);
  transform: translateX(calc(100% + 32px));
  transition: transform 460ms var(--dk-ease);
}
.dk-drawer--open { transform: translateX(0); }

.dk-drawer-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 16px 12px;
  border-bottom: 1px solid var(--dk-border-subtle);
}
.dk-drawer-title {
  font: 600 var(--dk-text-md)/1 var(--dk-display);
  letter-spacing: var(--dk-tracking-tight);
  color: var(--dk-text-primary);
}

.dk-drawer-search { position: relative; }
.dk-drawer-search svg,
.dk-drawer-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  translate: 0 -50%;
  color: var(--dk-text-muted);
  pointer-events: none;
}
.dk-drawer-search input {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 32px;
  border-radius: var(--dk-radius-md);
  border: 1px solid var(--dk-border-default);
  background: var(--dk-bg-input);
  color: var(--dk-text-primary);
  font: 400 var(--dk-text-sm)/1 var(--dk-sans);
  outline: none;
  transition: border-color var(--dk-dur-fast) var(--dk-ease-out), box-shadow var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-drawer-search input:focus {
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 0 0 3px rgba(250, 250, 250, 0.06);
}

.dk-drawer-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 14px 16px 18px;
  align-content: start;
}

.dk-drawer-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--dk-radius-lg);
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--dk-border-subtle);
  cursor: pointer;
  overflow: hidden;
  transition:
    translate var(--dk-dur-base) var(--dk-ease-out),
    border-color var(--dk-dur-base) var(--dk-ease-out),
    background var(--dk-dur-base) var(--dk-ease-out);
  animation: dk-rise 400ms var(--dk-ease-out) backwards;
}
/* staggered entrance */
.dk-drawer-tile:nth-child(1)  { animation-delay: 20ms; }
.dk-drawer-tile:nth-child(2)  { animation-delay: 50ms; }
.dk-drawer-tile:nth-child(3)  { animation-delay: 80ms; }
.dk-drawer-tile:nth-child(4)  { animation-delay: 110ms; }
.dk-drawer-tile:nth-child(5)  { animation-delay: 140ms; }
.dk-drawer-tile:nth-child(6)  { animation-delay: 170ms; }
.dk-drawer-tile:nth-child(7)  { animation-delay: 200ms; }
.dk-drawer-tile:nth-child(8)  { animation-delay: 230ms; }
.dk-drawer-tile:nth-child(9)  { animation-delay: 260ms; }
.dk-drawer-tile:nth-child(10) { animation-delay: 290ms; }
.dk-drawer-tile:nth-child(11) { animation-delay: 320ms; }
.dk-drawer-tile:nth-child(12) { animation-delay: 350ms; }
.dk-drawer-tile:nth-child(13) { animation-delay: 380ms; }
.dk-drawer-tile:nth-child(14) { animation-delay: 410ms; }

.dk-drawer-tile::after {
  /* accent glow rising from the tile floor on hover */
  content: "";
  position: absolute;
  left: -20%;
  right: -20%;
  bottom: -40%;
  height: 60%;
  pointer-events: none;
  background: radial-gradient(50% 100% at 50% 100%,
    color-mix(in srgb, var(--card-accent, #a1a1aa) 32%, transparent), transparent 70%);
  opacity: 0;
  transition: opacity var(--dk-dur-base) var(--dk-ease-out);
}
.dk-drawer-tile:hover {
  translate: 0 -2px;
  border-color: color-mix(in srgb, var(--card-accent, #ffffff) 35%, rgba(255, 255, 255, 0.10));
  background: rgba(255, 255, 255, 0.05);
}
.dk-drawer-tile:hover::after { opacity: 1; }

.dk-drawer-tile-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--card-accent, var(--dk-text-secondary));
  background: color-mix(in srgb, var(--card-accent, #ffffff) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--card-accent, #ffffff) 20%, transparent);
}
.dk-drawer-tile-name {
  font: 600 var(--dk-text-sm)/1.2 var(--dk-sans);
  color: var(--dk-text-primary);
}
.dk-drawer-tile-desc {
  font: 400 var(--dk-text-2xs)/1.5 var(--dk-sans);
  color: var(--dk-text-muted);
}

/* Mini faux-card preview (optional to render; pure CSS, no assets) */
.dk-mini {
  position: relative;
  width: 100%;
  height: 52px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.dk-mini::before {
  content: "";
  position: absolute;
  top: 8px;
  left: 8px;
  width: 26px;
  height: 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--card-accent, #a1a1aa) 70%, transparent);
}
.dk-mini::after {
  content: "";
  position: absolute;
  top: 20px;
  left: 8px;
  width: 72%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: 0 8px 0 -0.5px rgba(255, 255, 255, 0.09), 0 16px 0 -1px rgba(255, 255, 255, 0.05);
}

/* ----------------------------------------------------------------------------
   7. COMMAND PALETTE
   ---------------------------------------------------------------------------- */

.dk-palette-backdrop {
  position: absolute;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.45);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  animation: dk-fade-in 180ms var(--dk-ease);
}

.dk-palette {
  position: absolute;
  left: 50%;
  top: 18%;
  translate: -50% 0;
  z-index: 61;
  width: min(580px, calc(100% - 64px));
  border-radius: var(--dk-radius-xl);
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0) 30%),
    rgba(13, 13, 16, 0.90);
  -webkit-backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.11);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.10), var(--dk-elev-4), var(--dk-shadow-glow);
  animation: dk-pop 260ms var(--dk-ease-spring) backwards;
}

.dk-palette-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--dk-border-subtle);
}
.dk-palette-input svg,
.dk-palette-input-icon { color: var(--dk-text-muted); flex-shrink: 0; }
.dk-palette-input input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  font: 400 var(--dk-text-md)/1.4 var(--dk-sans);
  color: var(--dk-text-primary);
  caret-color: #fafafa;
}
.dk-palette-input input::placeholder { color: var(--dk-text-muted); }

.dk-palette-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dk-palette-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--dk-radius-md);
  cursor: pointer;
  transition: background var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-palette-item:hover { background: rgba(255, 255, 255, 0.04); }
.dk-palette-item--active,
.dk-palette-item[data-active="true"] { background: rgba(255, 255, 255, 0.07); }
.dk-palette-item--active::before,
.dk-palette-item[data-active="true"]::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--card-accent, var(--dk-accent));
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent, #fafafa) 60%, transparent);
}
.dk-palette-item-icon {
  display: grid;
  place-items: center;
  color: var(--card-accent, var(--dk-text-secondary));
}
.dk-palette-item-label { flex: 1; font: 400 var(--dk-text-sm)/1.3 var(--dk-sans); color: var(--dk-text-primary); }
.dk-palette-item-hint { display: flex; gap: 4px; }

.dk-palette-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--dk-border-subtle);
  color: var(--dk-text-muted);
  font-size: var(--dk-text-2xs);
}
.dk-palette-footer .dk-kbd { margin-right: 2px; }

/* ----------------------------------------------------------------------------
   8. INPUT BAR — the command center
   ---------------------------------------------------------------------------- */

.dk-input-bar {
  position: absolute;
  left: 50%;
  bottom: 28px;
  translate: -50% 0;
  z-index: 40;
  width: min(660px, calc(100% - 64px));
}

/* ambient underglow — breathes when idle, sharpens on focus */
.dk-input-bar::before {
  content: "";
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -12px;
  height: 28px;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(50% 100% at 50% 0%, rgba(250, 250, 250, 0.22), transparent 70%);
  filter: blur(14px);
  opacity: 0.5;
  animation: dk-breathe 6s var(--dk-ease) infinite;
  transition: opacity var(--dk-dur-slow) var(--dk-ease);
}
.dk-input-bar:focus-within::before { opacity: 1; animation-play-state: paused; }

.dk-input-shell {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 10px 16px;
  border-radius: var(--dk-radius-xl);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 30%),
    rgba(14, 14, 17, 0.84);
  -webkit-backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  backdrop-filter: blur(var(--dk-blur-lg)) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 0 0 1px rgba(0, 0, 0, 0.35), var(--dk-elev-3);
  transition:
    border-color var(--dk-dur-base) var(--dk-ease-out),
    box-shadow var(--dk-dur-base) var(--dk-ease-out),
    scale var(--dk-dur-base) var(--dk-ease-out);
}
.dk-input-shell:focus-within {
  scale: 1.008;
  border-color: rgba(255, 255, 255, 0.20);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.40),
    0 4px 12px rgba(0, 0, 0, 0.40),
    0 32px 70px -18px rgba(0, 0, 0, 0.80);
}

.dk-input-prefix { color: var(--dk-text-muted); flex-shrink: 0; }

.dk-input-field {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: 0;
  font: 400 var(--dk-text-md)/1.4 var(--dk-sans);
  color: var(--dk-text-primary);
  caret-color: #fafafa;
}
.dk-input-field::placeholder { color: var(--dk-text-muted); }

.dk-input-voice {
  position: relative;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--dk-radius-pill);
  background: transparent;
  color: var(--dk-text-muted);
  cursor: pointer;
  transition: background var(--dk-dur-fast) var(--dk-ease-out), color var(--dk-dur-fast) var(--dk-ease-out), scale var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-input-voice:hover { background: rgba(255, 255, 255, 0.08); color: var(--dk-text-primary); }
.dk-input-voice:active { scale: 0.92; }

.dk-input-voice--rec { color: var(--dk-danger); }
.dk-input-voice--rec::before,
.dk-input-voice--rec::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--dk-danger);
  pointer-events: none;
  animation: dk-voice-ring 1.6s var(--dk-ease-out) infinite;
}
.dk-input-voice--rec::after { animation-delay: 0.8s; }

.dk-input-send {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--dk-radius-pill);
  background: linear-gradient(180deg, #ffffff, #d4d4d8);
  color: #09090b;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: filter var(--dk-dur-fast) var(--dk-ease-out), translate var(--dk-dur-fast) var(--dk-ease-out), scale var(--dk-dur-fast) var(--dk-ease-out), opacity var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-input-send:hover  { filter: brightness(1.06); translate: 0 -1px; }
.dk-input-send:active { scale: 0.90; translate: 0 0; }
.dk-input-send:disabled {
  background: rgba(255, 255, 255, 0.08);
  color: var(--dk-text-muted);
  box-shadow: none;
  cursor: default;
  filter: none;
  translate: 0 0;
}

.dk-input-send--stop {
  position: relative;
  background: linear-gradient(180deg, #f87171, #dc2626);
  color: #fff;
}
.dk-input-send--stop::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--dk-danger);
  pointer-events: none;
  animation: dk-ping 1.8s var(--dk-ease-out) infinite;
}

/* suggestion chips floating above the bar */
.dk-input-chips {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  animation: dk-rise var(--dk-dur-slow) var(--dk-ease-out);
}
.dk-input-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--dk-radius-pill);
  font: 400 var(--dk-text-xs)/1 var(--dk-sans);
  color: var(--dk-text-secondary);
  background: rgba(20, 20, 24, 0.70);
  border: 1px solid var(--dk-border-default);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: border-color var(--dk-dur-fast) var(--dk-ease-out), color var(--dk-dur-fast) var(--dk-ease-out), translate var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-input-chip:hover {
  translate: 0 -1px;
  color: var(--dk-text-primary);
  border-color: rgba(255, 255, 255, 0.22);
}

/* ----------------------------------------------------------------------------
   9. SAVE INDICATOR
   ---------------------------------------------------------------------------- */

.dk-save-indicator {
  position: absolute;
  top: 16px;
  left: 50%;
  translate: -50% 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border-radius: var(--dk-radius-pill);
  font: 500 var(--dk-text-xs)/1 var(--dk-sans);
  color: var(--dk-text-secondary);
  background: rgba(14, 14, 17, 0.72);
  -webkit-backdrop-filter: blur(14px) saturate(1.6);
  backdrop-filter: blur(14px) saturate(1.6);
  border: 1px solid var(--dk-border-subtle);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), var(--dk-shadow-sm);
  transition: opacity var(--dk-dur-slow) var(--dk-ease);
}
.dk-save-dot {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dk-text-muted);
}
.dk-save-indicator--saving .dk-save-dot { background: var(--dk-warning); }
.dk-save-indicator--saving .dk-save-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--dk-warning);
  animation: dk-ping 1.2s var(--dk-ease-out) infinite;
}
.dk-save-indicator--saved .dk-save-dot {
  background: var(--dk-success);
  box-shadow: 0 0 8px color-mix(in srgb, var(--dk-success) 60%, transparent);
}
.dk-save-indicator--error .dk-save-dot {
  background: var(--dk-danger);
  box-shadow: 0 0 8px color-mix(in srgb, var(--dk-danger) 60%, transparent);
}

/* ----------------------------------------------------------------------------
   10. FIND-CARDS ARROW
   ---------------------------------------------------------------------------- */

.dk-find-arrow path,
.dk-find-arrow line {
  stroke: var(--dk-accent);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 4 6;
  animation: dk-dash 1.1s linear infinite;
  filter: drop-shadow(0 0 5px rgba(250, 250, 250, 0.40));
}
.dk-find-arrow polygon { fill: var(--dk-accent); filter: drop-shadow(0 0 5px rgba(250, 250, 250, 0.40)); }
.dk-find-target {
  fill: none;
  stroke: var(--dk-accent);
  transform-box: fill-box;
  transform-origin: center;
  animation: dk-ping 1.8s var(--dk-ease-out) infinite;
}

/* ----------------------------------------------------------------------------
   11. ZOOM CONTROLS (optional chrome)
   ---------------------------------------------------------------------------- */

.dk-zoom-controls {
  position: absolute;
  left: 20px;
  bottom: 20px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: var(--dk-radius-pill);
  background: rgba(12, 12, 15, 0.62);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), var(--dk-shadow-sm);
}
.dk-zoom-level {
  min-width: 46px;
  text-align: center;
  font: 500 var(--dk-text-xs)/1 var(--dk-mono);
  color: var(--dk-text-secondary);
}

/* ----------------------------------------------------------------------------
   12. MISC
   ---------------------------------------------------------------------------- */

.dk-canvas-hint {
  position: absolute;
  left: 20px;
  bottom: 64px;
  z-index: 10;
  pointer-events: none;
  font: 400 10px/1 var(--dk-mono);
  color: rgba(113, 113, 122, 0.7);
  letter-spacing: 0.04em;
}
```

---

### `src/components/ai/canvas/cards/cards.css`

```css
/* ============================================================================
   RHEO / DeskFlow — Cards · "Deep Field"
   The main event. One neutral glass chassis, one accent light per card,
   per-type treatments layered on top. Works with zero TSX changes; the
   optional data-card-type hook on CardFrame unlocks the full per-type set.
   ========================================================================== */

/* ----------------------------------------------------------------------------
   1. CARD CHASSIS — depth, light, motion
   Uses `translate` / `scale` (independent transform properties) so nothing
   collides with inline `transform` positioning if you use it.
   ---------------------------------------------------------------------------- */

.dk-card {
  --card-accent: #a1a1aa; /* fallback when no data-card-type hook is present */
  position: absolute;
  border-radius: var(--dk-radius-lg);
  color: var(--dk-text-primary);
  background:
    linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.028) 46%, transparent 52%),
    linear-gradient(168deg, rgba(30, 30, 35, 0.74) 0%, rgba(12, 12, 14, 0.55) 55%, rgba(9, 9, 11, 0.62) 100%);
  -webkit-backdrop-filter: blur(var(--dk-blur-md)) saturate(1.75);
  backdrop-filter: blur(var(--dk-blur-md)) saturate(1.75);
  border: 1px solid rgba(255, 255, 255, 0.085);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.30),
    0 2px 6px rgba(0, 0, 0, 0.28),
    0 14px 34px -12px rgba(0, 0, 0, 0.55);
  transition:
    border-color var(--dk-dur-base) var(--dk-ease-out),
    box-shadow var(--dk-dur-base) var(--dk-ease-out),
    translate var(--dk-dur-base) var(--dk-ease-out),
    scale var(--dk-dur-base) var(--dk-ease-out),
    filter var(--dk-dur-base) var(--dk-ease-out);
  animation: dk-card-enter 480ms var(--dk-ease-spring) backwards;
}

/* accent light bleeding through the glass from the header — the signature */
.dk-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(160px 60px at 24px 0,
    color-mix(in srgb, var(--card-accent) 20%, transparent), transparent 70%);
  opacity: 0.5;
  transition: opacity var(--dk-dur-base) var(--dk-ease-out);
}
.dk-card:hover::before { opacity: 0.9; }

.dk-card:hover:not(.dk-card--dragging) {
  translate: 0 -2px;
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    0 0 0 1px rgba(0, 0, 0, 0.30),
    0 4px 10px rgba(0, 0, 0, 0.30),
    0 20px 44px -14px rgba(0, 0, 0, 0.62);
}

/* Dragging — the slab lifts off the field */
.dk-card--dragging,
.dk-card[data-dragging="true"] {
  translate: 0 0;
  scale: 1.02;
  z-index: 10;
  cursor: grabbing;
  filter: saturate(1.1) brightness(1.04);
  border-color: color-mix(in srgb, var(--card-accent) 45%, rgba(255, 255, 255, 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 0 0 1px color-mix(in srgb, var(--card-accent) 30%, transparent),
    0 0 24px -6px color-mix(in srgb, var(--card-accent) 40%, transparent),
    var(--dk-elev-4);
  transition-duration: var(--dk-dur-fast);
}

/* Selected — accent ring + halo */
.dk-card--selected {
  border-color: color-mix(in srgb, var(--card-accent) 50%, rgba(255, 255, 255, 0.12));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    0 0 0 1.5px color-mix(in srgb, var(--card-accent) 65%, transparent),
    0 0 28px -6px color-mix(in srgb, var(--card-accent) 40%, transparent),
    var(--dk-elev-2);
}

/* Pinned — the accent owns the top edge */
.dk-card--pinned { border-color: color-mix(in srgb, var(--card-accent) 30%, rgba(255, 255, 255, 0.09)); }
.dk-card--pinned::before { opacity: 0.9; }

/* Status whispers */
.dk-card[data-status="error"] {
  border-color: color-mix(in srgb, var(--dk-danger) 32%, rgba(255, 255, 255, 0.08));
}
.dk-card[data-status="loading"] { filter: saturate(0.85); }

/* Resize grip */
.dk-card-resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity var(--dk-dur-fast) var(--dk-ease-out);
  background-image: radial-gradient(rgba(255, 255, 255, 0.6) 1px, transparent 1.3px);
  background-size: 4px 4px;
  background-position: 2px 2px;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}
.dk-card:hover .dk-card-resize { opacity: 1; }

/* ----------------------------------------------------------------------------
   2. HEADER — type identity lives here
   ---------------------------------------------------------------------------- */

.dk-card-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 8px;
  /* light seam: accent hairline fading right, like refraction at the edge */
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--card-accent) 28%, transparent) 0,
    transparent 55%) bottom left / 100% 1px no-repeat;
}

.dk-card-icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: var(--dk-radius-sm);
  color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--card-accent) 22%, transparent);
}

.dk-card-dot {
  width: 5px;
  height: 5px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--card-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--card-accent) 70%, transparent);
}
.dk-card:hover .dk-card-dot { animation: dk-breathe 2.4s ease-in-out infinite; }

.dk-card-title {
  font: 600 var(--dk-text-2xs)/1 var(--dk-sans);
  letter-spacing: var(--dk-tracking-wide);
  text-transform: uppercase;
  color: color-mix(in srgb, var(--card-accent) 55%, #fafafa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-card-meta {
  font: 400 10px/1 var(--dk-mono);
  color: var(--dk-text-muted);
  white-space: nowrap;
}

.dk-card-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  translate: 3px 0;
  transition: opacity var(--dk-dur-fast) var(--dk-ease-out), translate var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-card:hover .dk-card-actions,
.dk-card--pinned .dk-card-actions,
.dk-card:focus-within .dk-card-actions { opacity: 1; translate: 0 0; }

/* ----------------------------------------------------------------------------
   3. BODY + FOOTER
   ---------------------------------------------------------------------------- */

.dk-card-body {
  padding: 6px 12px 12px;
  font: 400 var(--dk-text-base)/1.55 var(--dk-sans);
  color: var(--dk-text-secondary);
  overflow: auto;
}
.dk-card-body--fade {
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 18px), transparent);
  mask-image: linear-gradient(180deg, #000 calc(100% - 18px), transparent);
}

.dk-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--dk-border-subtle);
}

.dk-card-divider { height: 1px; background: var(--dk-border-subtle); margin: 8px 0; border: 0; }

/* ----------------------------------------------------------------------------
   4. SHARED PRIMITIVES
   ---------------------------------------------------------------------------- */

.dk-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--dk-radius-pill);
  font: 500 10px/1 var(--dk-mono);
  color: var(--dk-text-secondary);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
}
.dk-chip--accent {
  color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 13%, transparent);
  border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
}

.dk-badge { display: inline-flex; align-items: center; gap: 6px; font: 500 10px/1 var(--dk-sans); }
.dk-badge i {
  width: 6px; height: 6px; border-radius: 50%; position: relative; font-style: normal;
}
.dk-badge--success { color: var(--dk-success); } .dk-badge--success i { background: var(--dk-success); }
.dk-badge--warning { color: var(--dk-warning); } .dk-badge--warning i { background: var(--dk-warning); }
.dk-badge--danger  { color: var(--dk-danger); }  .dk-badge--danger i  { background: var(--dk-danger); }
.dk-badge--pulse i::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; background: currentColor;
  animation: dk-ping 1.4s var(--dk-ease-out) infinite;
}

.dk-delta-up   { color: var(--dk-success); font-family: var(--dk-mono); font-size: var(--dk-text-xs); }
.dk-delta-down { color: var(--dk-danger);  font-family: var(--dk-mono); font-size: var(--dk-text-xs); }

/* Progress bar — set --p (0–100) inline, or leave off for indeterminate */
.dk-bar {
  position: relative;
  height: 4px;
  border-radius: var(--dk-radius-pill);
  background: rgba(255, 255, 255, 0.07);
  overflow: hidden;
}
.dk-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--p, 0) * 1%);
  border-radius: inherit;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--card-accent) 55%, transparent),
    var(--card-accent));
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 40%, transparent);
  transition: width 600ms var(--dk-ease-out);
}
.dk-bar-fill--indet {
  width: 40%;
  animation: dk-shimmer 1.4s linear infinite;
  background: linear-gradient(90deg, transparent, var(--card-accent), transparent);
  background-size: 200% 100%;
}

/* Progress ring — set --dk-ring-p (0–100) inline; animates via @property */
.dk-ring {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: conic-gradient(from -90deg,
    var(--card-accent) calc(var(--dk-ring-p, 0) * 1%),
    rgba(255, 255, 255, 0.07) 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--card-accent) 25%, transparent));
  transition: --dk-ring-p 700ms var(--dk-ease-out);
}
.dk-ring-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

/* Checklist row + custom check */
.dk-check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background var(--dk-dur-fast) var(--dk-ease-out), border-color var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-check[data-checked="true"] {
  background: var(--card-accent);
  border-color: transparent;
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 40%, transparent);
}
.dk-check[data-checked="true"]::after {
  content: "";
  width: 4px;
  height: 8px;
  margin-top: -2px;
  border-right: 2px solid #0b0b0d;
  border-bottom: 2px solid #0b0b0d;
  rotate: 45deg;
  animation: dk-check-pop 240ms var(--dk-ease-spring);
}

.dk-list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 4px 2px;
  border-bottom: 1px solid var(--dk-border-subtle);
  transition: background var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-list-row:last-child { border-bottom: 0; }
.dk-list-row:hover { background: rgba(255, 255, 255, 0.03); border-radius: var(--dk-radius-sm); }

/* Toggle */
.dk-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  border-radius: var(--dk-radius-pill);
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.10);
  cursor: pointer;
  transition: background var(--dk-dur-base) var(--dk-ease-out);
}
.dk-toggle::after {
  content: "";
  position: absolute;
  top: 1px;
  left: 1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e4e4e7;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: translate var(--dk-dur-base) var(--dk-ease-spring);
}
.dk-toggle[data-on="true"] { background: color-mix(in srgb, var(--card-accent) 75%, transparent); border-color: transparent; }
.dk-toggle[data-on="true"]::after { translate: 14px 0; }

/* Skeletons — shimmer sweep, composable shapes */
.dk-skel {
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.055);
}
.dk-skel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.09) 50%, transparent 80%);
  background-size: 200% 100%;
  animation: dk-shimmer 1.6s linear infinite;
}
.dk-skel--title { height: 12px; width: 45%; }
.dk-skel--line  { height: 9px; width: 100%; }
.dk-skel--block { height: 48px; width: 100%; border-radius: var(--dk-radius-md); }
.dk-skel--chart {
  height: 52px;
  border-radius: var(--dk-radius-md);
  background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 10px, transparent 10px 16px);
}
.dk-skel-row { display: flex; flex-direction: column; gap: 8px; }

/* ----------------------------------------------------------------------------
   5. STATE VIEWS — invitations, not dead ends
   ---------------------------------------------------------------------------- */

.dk-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
}
.dk-state--empty { animation: dk-fade-in var(--dk-dur-slow) var(--dk-ease); }

.dk-state-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--card-accent, var(--dk-text-muted));
  border: 1px dashed rgba(255, 255, 255, 0.15);
  animation: dk-float-slow 6s ease-in-out infinite;
}
.dk-state--empty .dk-state-icon::after {
  content: "";
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  border: 1px dashed color-mix(in srgb, var(--card-accent, #ffffff) 30%, transparent);
  animation: dk-spin 14s linear infinite;
}

.dk-state-title  { font: 500 var(--dk-text-sm)/1.4 var(--dk-sans); color: var(--dk-text-secondary); }
.dk-state-hint   { font: 400 var(--dk-text-xs)/1.6 var(--dk-sans); color: var(--dk-text-muted); max-width: 22ch; }
.dk-state--error .dk-state-icon {
  color: var(--dk-danger);
  border-color: color-mix(in srgb, var(--dk-danger) 40%, transparent);
  animation: dk-shake 320ms var(--dk-ease-out) 1;
}
.dk-state-retry { margin-top: 2px; }

.dk-state--loading .dk-skel-row { width: 100%; }

/* ----------------------------------------------------------------------------
   6. PER-TYPE TREATMENTS
   ---------------------------------------------------------------------------- */

/* -- FOCUS · pink · the timer is the hero ---------------------------------- */
.dk-focus-timer {
  font: 600 var(--dk-text-2xl)/1 var(--dk-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--dk-text-primary);
  text-shadow: 0 0 24px color-mix(in srgb, var(--card-accent) 30%, transparent);
}
.dk-focus-live { display: inline-flex; align-items: center; gap: 6px; font: 500 10px/1 var(--dk-mono); color: var(--card-accent); }
.dk-focus-live i { position: relative; width: 6px; height: 6px; border-radius: 50%; background: var(--card-accent); font-style: normal; }
.dk-focus-live i::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--card-accent);
  animation: dk-ping 1.6s var(--dk-ease-out) infinite;
}

/* -- PLAN · violet · checklist with springy checks --------------------------- */
.dk-plan-row { justify-content: flex-start; }
.dk-plan-row[data-done="true"] .dk-plan-label {
  color: var(--dk-text-muted);
  text-decoration: line-through;
  text-decoration-color: rgba(255, 255, 255, 0.25);
}
.dk-plan-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.dk-plan-progress .dk-bar { flex: 1; }
.dk-plan-count { font: 500 10px/1 var(--dk-mono); color: var(--dk-text-muted); }

/* -- FINANCE · emerald · big number + growing bars ---------------------------- */
.dk-fin-balance {
  font: 600 var(--dk-text-xl)/1 var(--dk-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--dk-text-primary);
}
.dk-fin-bars { display: flex; align-items: flex-end; gap: 3px; height: 46px; margin-top: 10px; }
.dk-fin-bars > i {
  flex: 1;
  min-height: 3px;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, var(--card-accent), color-mix(in srgb, var(--card-accent) 25%, transparent));
  transform-origin: bottom;
  animation: dk-bar-grow 500ms var(--dk-ease-out) backwards;
  transition: filter var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-fin-bars > i:hover { filter: brightness(1.35); }
.dk-fin-bars > i:nth-child(1)  { animation-delay: 30ms; }
.dk-fin-bars > i:nth-child(2)  { animation-delay: 60ms; }
.dk-fin-bars > i:nth-child(3)  { animation-delay: 90ms; }
.dk-fin-bars > i:nth-child(4)  { animation-delay: 120ms; }
.dk-fin-bars > i:nth-child(5)  { animation-delay: 150ms; }
.dk-fin-bars > i:nth-child(6)  { animation-delay: 180ms; }
.dk-fin-bars > i:nth-child(7)  { animation-delay: 210ms; }
.dk-fin-bars > i:nth-child(8)  { animation-delay: 240ms; }
.dk-fin-bars > i:nth-child(9)  { animation-delay: 270ms; }
.dk-fin-bars > i:nth-child(10) { animation-delay: 300ms; }
.dk-fin-bars > i:nth-child(11) { animation-delay: 330ms; }
.dk-fin-bars > i:nth-child(12) { animation-delay: 360ms; }
.dk-fin-row { font-family: var(--dk-mono); font-size: var(--dk-text-xs); }

/* -- DIGEST · cyan · timeline gutter -------------------------------------------- */
.dk-digest-time {
  flex-shrink: 0;
  width: 36px;
  font: 400 10px/1 var(--dk-mono);
  color: var(--dk-text-muted);
}
.dk-digest-title { font: 500 var(--dk-text-sm)/1.4 var(--dk-sans); color: var(--dk-text-secondary); }
.dk-digest-row { position: relative; }
.dk-digest-row--unread .dk-digest-title { color: var(--dk-text-primary); }
.dk-digest-row--unread::before {
  content: "";
  position: absolute;
  left: -8px;
  top: 50%;
  translate: 0 -50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--card-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--card-accent) 60%, transparent);
}

/* -- REFLECT · purple · quiet editorial ------------------------------------------- */
.dk-reflect-prompt {
  padding-left: 10px;
  border-left: 2px solid var(--card-accent);
  font-style: italic;
  color: color-mix(in srgb, var(--card-accent) 60%, #fafafa);
}
.dk-reflect-entry { font-size: var(--dk-text-base); line-height: 1.65; color: var(--dk-text-secondary); }
.dk-mood { display: flex; gap: 6px; }
.dk-mood > i {
  width: 10px; height: 10px; border-radius: 50%; font-style: normal;
  border: 1px solid rgba(255, 255, 255, 0.22);
  cursor: pointer;
  transition: background var(--dk-dur-fast) var(--dk-ease-out), border-color var(--dk-dur-fast) var(--dk-ease-out), box-shadow var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-mood > i:hover,
.dk-mood > i[data-on="true"] {
  background: var(--card-accent);
  border-color: transparent;
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 55%, transparent);
}

/* -- APPROVAL · amber · decision surface -------------------------------------------- */
.dk-approval-box {
  padding: 10px;
  border-radius: var(--dk-radius-md);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--dk-border-subtle);
}
.dk-approval-actions { display: flex; gap: 8px; margin-top: 10px; }
.dk-approval-actions .dk-btn { flex: 1; }

/* -- ANNOTATION · orange · warm paper ------------------------------------------------- */
.dk-card[data-card-type="annotation"] {
  background:
    linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.03) 46%, transparent 52%),
    linear-gradient(170deg, rgba(44, 34, 26, 0.78) 0%, rgba(18, 14, 11, 0.62) 100%);
}
.dk-card[data-card-type="annotation"] mark {
  background: color-mix(in srgb, var(--card-accent) 30%, transparent);
  color: inherit;
  border-radius: 3px;
  padding: 0 3px;
}

/* -- RESPONSE · blue · conversation ------------------------------------------------------ */
.dk-bubble {
  max-width: 88%;
  padding: 8px 10px;
  font-size: var(--dk-text-sm);
  line-height: 1.55;
}
.dk-bubble--ai {
  border-radius: var(--dk-radius-md) var(--dk-radius-md) var(--dk-radius-md) 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--dk-border-subtle);
}
.dk-bubble--user {
  margin-left: auto;
  border-radius: var(--dk-radius-md) var(--dk-radius-md) 4px var(--dk-radius-md);
  background: color-mix(in srgb, var(--card-accent) 13%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-accent) 26%, transparent);
  color: var(--dk-text-primary);
}
.dk-code {
  font: 400 11px/1.6 var(--dk-mono);
  padding: 8px 10px;
  border-radius: var(--dk-radius-sm);
  background: rgba(0, 0, 0, 0.40);
  border: 1px solid var(--dk-border-subtle);
  overflow-x: auto;
}
.dk-caret {
  display: inline-block;
  width: 7px;
  height: 14px;
  translate: 0 2px;
  background: var(--card-accent);
  animation: dk-caret 1s steps(1) infinite;
}

/* -- WEEKLY SCHEDULE · red · 7-day strip --------------------------------------------------- */
.dk-sched-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.dk-sched-day {
  padding: 4px 0 6px;
  border-radius: var(--dk-radius-sm);
  text-align: center;
  font: 500 10px/1 var(--dk-mono);
  color: var(--dk-text-muted);
  transition: background var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-sched-day--today {
  color: var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--card-accent) 30%, transparent);
}
.dk-sched-event {
  height: 3px;
  margin: 3px 2px 0;
  border-radius: 2px;
  background: color-mix(in srgb, var(--card-accent) 60%, transparent);
}
.dk-sched-event--dense {
  background: var(--card-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--card-accent) 50%, transparent);
}

/* -- DEADLINE TRACKER · orange · urgency reads instantly ----------------------- */
.dk-dd-count {
  font: 600 var(--dk-text-2xl)/1 var(--dk-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--dk-text-primary);
}
.dk-dd-unit { font: 500 10px/1 var(--dk-mono); color: var(--dk-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.dk-card[data-urgency="safe"]     { --card-accent: var(--dk-success); }
.dk-card[data-urgency="soon"]     { --card-accent: var(--dk-type-deadlines); }
.dk-card[data-urgency="critical"] { --card-accent: var(--dk-danger); }
.dk-card[data-urgency="critical"]::before { opacity: 1; animation: dk-breathe 2.2s ease-in-out infinite; }

/* -- DAILY PLANNER · sky · the now-line -------------------------------------------- */
.dk-planner { position: relative; }
.dk-planner-hour {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  border-bottom: 1px solid var(--dk-border-subtle);
  font: 400 10px/1 var(--dk-mono);
  color: var(--dk-text-muted);
}
.dk-planner-block {
  padding: 6px 8px;
  border-radius: var(--dk-radius-sm);
  border-left: 2px solid var(--card-accent);
  background: color-mix(in srgb, var(--card-accent) 16%, transparent);
  font-size: var(--dk-text-xs);
  color: var(--dk-text-secondary);
  transition: background var(--dk-dur-fast) var(--dk-ease-out);
}
.dk-planner-block:hover { background: color-mix(in srgb, var(--card-accent) 24%, transparent); }
.dk-planner-now {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--now-pct, 50%);
  height: 1px;
  background: linear-gradient(90deg, var(--card-accent), transparent 80%);
  pointer-events: none;
}
.dk-planner-now::after {
  content: "";
  position: absolute;
  left: -3px;
  top: -2.5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--card-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--card-accent) 70%, transparent);
  animation: dk-breathe 2s ease-in-out infinite;
}

/* -- DYNAMIC · gray · ephemerality -------------------------------------------------- */
.dk-card[data-card-type="dynamic"] { border-style: dashed; filter: saturate(0.9); }
.dk-chip--transient { color: var(--dk-text-muted); border-style: dashed; }

/* -- AUTOMATION · fuchsia · running machinery --------------------------------------- */
.dk-auto-row { gap: 8px; }
.dk-auto-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; position: relative;
  background: var(--dk-text-muted);
}
.dk-auto-dot[data-run="running"] { background: var(--card-accent); }
.dk-auto-dot[data-run="running"]::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--card-accent);
  animation: dk-ping 1.4s var(--dk-ease-out) infinite;
}
.dk-auto-dot[data-run="ok"]     { background: var(--dk-success); }
.dk-auto-dot[data-run="error"]  { background: var(--dk-danger); }
.dk-log { font: 400 10.5px/1.7 var(--dk-mono); color: var(--dk-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dk-log--err  { color: var(--dk-danger); }
.dk-log--ok   { color: var(--dk-success); }
.dk-log--time { color: rgba(113, 113, 122, 0.7); margin-right: 6px; }

/* ----------------------------------------------------------------------------
   7. GROUPS — the container glows from within
   --group-color is set inline by your color picker; fallback provided.
   ---------------------------------------------------------------------------- */

.dk-group {
  --gc: var(--group-color, var(--dk-type-group));
  position: absolute;
  border-radius: var(--dk-radius-xl);
  border: 1px solid color-mix(in srgb, var(--gc) 30%, transparent);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--gc) 9%, transparent) 0%,
    color-mix(in srgb, var(--gc) 4%, transparent) 55%,
    transparent 100%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--gc) 20%, transparent),
    inset 0 0 44px -18px color-mix(in srgb, var(--gc) 24%, transparent),
    0 20px 50px -20px rgba(0, 0, 0, 0.55);
  transition: border-color var(--dk-dur-base) var(--dk-ease-out), box-shadow var(--dk-dur-base) var(--dk-ease-out);
}
.dk-group:hover {
  border-color: color-mix(in srgb, var(--gc) 48%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--gc) 26%, transparent),
    inset 0 0 54px -16px color-mix(in srgb, var(--gc) 30%, transparent),
    0 24px 56px -20px rgba(0, 0, 0, 0.60);
}
.dk-group--collapsed { border-style: dashed; }

.dk-group-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  cursor: grab;
}
.dk-group-bar:active { cursor: grabbing; }

.dk-group-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 20px;
  padding: 0 9px;
  border-radius: var(--dk-radius-pill);
  font: 600 10px/1 var(--dk-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--gc) 65%, #fafafa);
  background: color-mix(in srgb, var(--gc) 14%, rgba(10, 10, 12, 0.6));
  border: 1px solid color-mix(in srgb, var(--gc) 30%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
.dk-group-label::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gc);
  box-shadow: 0 0 6px color-mix(in srgb, var(--gc) 70%, transparent);
}

.dk-group-count { font: 400 10px/1 var(--dk-mono); color: var(--dk-text-muted); }

/* ----------------------------------------------------------------------------
   8. CONNECTORS — neural pathways
   Double-path technique: a faint base path + a short animated "pulse" path
   on top. Single-path cards can just use .dk-connector--flow.
   ---------------------------------------------------------------------------- */

.dk-connectors {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.dk-connector {
  fill: none;
  stroke: color-mix(in srgb, var(--dk-type-connectors) 50%, transparent);
  stroke-width: 1.5;
  stroke-linecap: round;
  transition: stroke var(--dk-dur-base) var(--dk-ease-out);
}
.dk-connector--active { stroke: var(--dk-type-connectors); }
.dk-connector--flow {
  stroke: var(--dk-type-connectors);
  stroke-dasharray: 4 8;
  animation: dk-dash 1.2s linear infinite;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--dk-type-connectors) 60%, transparent));
}

.dk-connector-pulse {
  fill: none;
  stroke: var(--dk-type-connectors);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-dasharray: 3 14;
  animation: dk-dash 1.4s linear infinite;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--dk-type-connectors) 65%, transparent));
}

.dk-connector-arrow { fill: var(--dk-type-connectors); }

.dk-connector-dot {
  fill: #0b0b0d;
  stroke: var(--dk-type-connectors);
  stroke-width: 1.5;
}

.dk-connector-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 12;
  pointer-events: stroke;
  cursor: pointer;
}
```

---

## 3. TSX Changes

**No full-file TSX replacements are required** — the redesign works on existing markup. Two optional one-line hooks unlock the full per-type system. Both are additive and safe to skip.

### Optional Hook A — `src/components/ai/canvas/shared/CardFrame.tsx`

**What changed:** expose `card.type` and `card.status` to CSS on the frame root so the accent-light system, per-type treatments, urgency tiers, and status whispers activate. If your root already renders `data-card-type`, skip this entirely.

```tsx
// CardFrame.tsx — root element only. Everything else in the file is untouched.
<div
  className={[
    'dk-card',
    isDragging ? 'dk-card--dragging' : '',
    isSelected ? 'dk-card--selected' : '',
    isPinned ? 'dk-card--pinned' : '',
    className ?? '',
  ].filter(Boolean).join(' ')}
  data-card-type={card.type}        // ← ADD: activates per-type accent + treatments
  data-status={card.status}         // ← ADD: activates status whispers
  style={{ left: card.x * 40, top: card.y * 40, width: card.w * 40, height: card.h * 40, ...style }}
>
  {children}
</div>
```

**Important:** the selector values in `design-tokens.css` (`[data-card-type="weeklySchedule"]`, etc.) must match your `CardType` union literals exactly — adjust casing there if your union uses different strings.

### Optional Hook B — `src/components/ai/canvas/shared/StateView.tsx`

**What changed:** forward the card type into state wrappers so empty states and skeletons can be type-specific, and adopt the composable skeleton primitives (or keep your existing skeleton markup — the generic `.dk-skel` shimmer is available either way).

```tsx
// StateView.tsx — wrapper divs only:
<div className="dk-state dk-state--empty" data-card-type={type}>
  <div className="dk-state-icon"><Sparkle size={18} /></div>
  <div className="dk-state-title">Nothing here yet</div>
  <div className="dk-state-hint">Ask below, or press / for commands</div>
</div>

// Loading, per-type skeleton example (finance):
<div className="dk-state dk-state--loading" data-card-type={type}>
  <div className="dk-skel-row">
    <div className="dk-skel dk-skel--title" />
    <div className="dk-skel dk-skel--chart" />
    <div className="dk-skel dk-skel--line" />
    <div className="dk-skel dk-skel--line" style={{ width: '70%' }} />
  </div>
</div>
```

### Data bindings for animated primitives (when you adopt them)

These primitives read values from inline CSS variables — set them wherever you render the element:

```tsx
// Progress ring: <div className="dk-ring" style={{ '--dk-ring-p': pct } as React.CSSProperties} />
// Progress bar: <div className="dk-bar"><div className="dk-bar-fill" style={{ '--p': pct } as React.CSSProperties} /></div>
// Planner now-line: <div className="dk-planner-now" style={{ '--now-pct': `${pct}%` } as React.CSSProperties} />
// Deadline urgency: <Frame data-urgency={urgency} ... />  // "safe" | "soon" | "critical"
```

### Class-name compatibility

I preserved every class name surfaced in your spec (`dk-glass`, `dk-glass-heavy`, `dk-glass-card`, all `--dk-*` tokens). For markup I couldn't see: either update the class strings in your TSX to the new `dk-` names, or append legacy names to the new selectors (e.g. `.dk-minimap, .canvas-minimap { … }`). Both are five-minute jobs with a grep.

---

## 4. New CSS Classes Introduced

**Tokens & primitives** (`design-tokens.css`): `--dk-type-*` (15 type colors incl. new `automation`), `--dk-elev-1..4`, `--dk-sheen`, `--dk-blur-sm/md/lg`, `--dk-noise`, `--dk-ease-out`, `--dk-ease-spring`, `--dk-dur-*`, `--dk-radius-xl/pill`, `--dk-text-*` scale, `--dk-tracking-*` · `.dk-display` `.dk-num` `.dk-mono` `.dk-eyebrow` · `.dk-btn` (+ `--primary` `--ghost` `--danger` `--approve` `--deny`) · `.dk-icon-btn` (+ `--active`) · `.dk-kbd` · `.dk-scroll` · `@property --dk-ring-p` · accent wiring via `[data-card-type]` / `[data-type]`

**Canvas chrome** (`canvas.css`): `.dk-canvas` `.dk-canvas-world` `.dk-canvas-grid` `.dk-canvas-empty(-inner/-icon/-title/-hint)` `.dk-grain-top` (optional) · `.dk-marquee` `.dk-snap-guide(--v/--h)` · `.dk-minimap` `.dk-minimap-viewport` · `.dk-manager(-closed/-header/-title/-list/-item(--active)/-name/-meta/-input/-footer/-empty)` · `.dk-drawer(--open/-header/-title/-search/-grid/-tile/-tile-icon/-tile-name/-tile-desc)` `.dk-mini` · `.dk-palette-backdrop` `.dk-palette(-input/-input-icon/-list/-item(--active)/-item-icon/-item-label/-item-hint/-footer)` · `.dk-input-bar` `.dk-input-shell` `.dk-input-prefix` `.dk-input-field` `.dk-input-voice(--rec)` `.dk-input-send(--stop)` `.dk-input-chips` `.dk-input-chip` · `.dk-save-indicator(--saving/--saved/--error)` `.dk-save-dot` · `.dk-find-arrow` `.dk-find-target` · `.dk-zoom-controls` `.dk-zoom-level` `.dk-canvas-hint`

**Cards** (`cards.css`): `.dk-card(--dragging/--selected/--pinned)` `.dk-card-resize` · header: `.dk-card-header/-icon/-dot/-title/-meta/-actions` · `.dk-card-body(--fade)` `.dk-card-footer` `.dk-card-divider` · primitives: `.dk-chip(--accent)` `.dk-badge(--success/--warning/--danger/--pulse)` `.dk-delta-up/-down` `.dk-bar(-fill(--indet))` `.dk-ring` `.dk-ring-label` `.dk-check` `.dk-list-row` `.dk-toggle` `.dk-skel(--title/--line/--block/--chart)` `.dk-skel-row` · states: `.dk-state(--empty/--loading/--error)` `.dk-state-icon/-title/-hint/-retry` · per-type: `.dk-focus-timer` `.dk-focus-live` · `.dk-plan-row` `.dk-plan-progress` `.dk-plan-count` `.dk-plan-label` · `.dk-fin-balance` `.dk-fin-bars` `.dk-fin-row` · `.dk-digest-row(--unread)` `.dk-digest-time` `.dk-digest-title` · `.dk-reflect-prompt` `.dk-reflect-entry` `.dk-mood` · `.dk-approval-box/-actions/-pending` · `.dk-bubble(--ai/--user)` `.dk-code` `.dk-caret` · `.dk-sched-grid/-day(--today)/-event(--dense)` · `.dk-dd-count` `.dk-dd-unit` · `.dk-planner(-hour/-block/-now)` · `.dk-auto-row` `.dk-auto-dot` `.dk-log(--err/--ok/--time)` · groups: `.dk-group(--collapsed)` `.dk-group-bar` `.dk-group-label` `.dk-group-count` · connectors: `.dk-connectors` `.dk-connector(--active/--flow)` `.dk-connector-pulse` `.dk-connector-arrow` `.dk-connector-dot` `.dk-connector-hit`
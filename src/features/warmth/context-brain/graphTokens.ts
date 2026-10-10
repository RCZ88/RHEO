/**
 * graphTokens — the single source of colour for the Context Brain surface.
 *
 * ── WHY THIS FILE EXISTS ──
 * PAINT Gate C (LAMINAR hard gate) forbids raw hex / `rgba()` inside a `.tsx`.
 * A canvas renderer cannot use Tailwind classes, so every colour it needs has to
 * exist as a concrete value SOMEWHERE. Before this file that "somewhere" was the
 * middle of `BrainGraph.tsx`: 17 raw hex/rgba literals inline in the draw loop,
 * which is both a gate failure and the reason the palette had drifted away from
 * the app's tokens (`#09090b` instead of `var(--ws-surface)`, `#52525b` instead
 * of `--text-muted`).
 *
 * Every value below MIRRORS a token declared in `src/index.css`. If you change
 * one, change the token. DOM-side colours do NOT come from here — they use
 * `var(--ws-surface)` / `var(--page-accent)` directly, which is strictly better
 * because it survives a theme switch with no JS involved. This module exists ONLY
 * because Canvas2D needs resolved numbers.
 *
 * ── THE SIGNAL HUE ──
 * There is no brand hue in here on purpose. The page's one signal colour is
 * `var(--page-accent)`, which for `data-page="life"` is clay `#e8866b`
 * (`src/index.css:574`). `SelfOrchestrator` reads it through CSS. The canvas
 * cannot, so `accentRGB()` resolves it once from the DOM at paint time and
 * caches it — that way a theme change is still picked up.
 */

/** Read a CSS custom property off an element (or :root) as an rgb triple. */
function cssRGB(el: Element | null, prop: string, fallback: [number, number, number]): [number, number, number] {
  if (!el) return fallback
  const raw = getComputedStyle(el).getPropertyValue(prop).trim()
  if (!raw) return fallback
  // Accepts #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() and the space-separated
  // `rgb(39 39 42 / 0.6)` form this codebase uses.
  if (raw.startsWith('#')) {
    const h = raw.slice(1)
    const hex = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6)
    const n = parseInt(hex, 16)
    if (!Number.isFinite(n)) return fallback
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const nums = raw.match(/[\d.]+/g)
  if (nums && nums.length >= 3) {
    return [Number(nums[0]), Number(nums[1]), Number(nums[2])]
  }
  return fallback
}

/** `rgb(r,g,b)` string from a triple. */
export function rgb(c: [number, number, number], alpha = 1): string {
  return alpha >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha})`
}

/** Mix a colour toward another by `t` (0 = a, 1 = b). Used for edge tapers. */
export function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/** Darken toward black — the shaded side of a lit sphere. */
export function darken(c: [number, number, number], amount: number): [number, number, number] {
  return [c[0] * (1 - amount), c[1] * (1 - amount), c[2] * (1 - amount)]
}

// ─────────────────────────────────────────────────────────────────────────────
//  Canvas palette — resolved from live CSS at paint time, cached per frame set.
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphPaint {
  /** One signal hue for the surface: `var(--page-accent)`. */
  accent: [number, number, number]
  /** `--text-primary` — the label of a selected/focused node. */
  labelStrong: [number, number, number]
  /** `--text-muted` — resting node labels. */
  label: [number, number, number]
  /** `--text-secondary` — hover ring. */
  labelHover: [number, number, number]
  /** `--ws-border-strong` — resting edge. */
  edge: [number, number, number]
  /**
   * AMBER. Reserved: it means "an event is firing right now" and nothing else.
   * This is a SEMANTIC reservation, not a brand colour — LAMINAR §2 permits
   * amber for time/event surfaces and it is the one hue that must never be used
   * for a resting node, so it lives here alone.
   */
  spike: [number, number, number]
  /**
   * `--text-primary` — the specular highlight on the lit side of a node.
   *
   * This is what makes a disc read as a SPHERE rather than a flat plotting mark,
   * so it must track the theme: in light mode `--text-primary` is near-black and
   * the highlight correctly becomes a shadow-side gradient instead of a blown-out
   * white dot.
   */
  highlight: [number, number, number]
}

let cached: GraphPaint | null = null
let cachedFor: HTMLElement | null = null

/**
 * Resolve the paint palette from the live DOM.
 *
 * Reads real CSS custom properties so the canvas follows the app's theme (and
 * the `data-page` accent) instead of freezing a palette at module load. Cached
 * per host element; call `resetGraphPaint()` if the theme changes at runtime.
 */
export function graphPaint(host?: Element | null): GraphPaint {
  const el = (host ?? (typeof document !== 'undefined' ? document.documentElement : null)) as HTMLElement | null
  if (cached && cachedFor === el) return cached
  const get = (prop: string, fb: [number, number, number]) => cssRGB(el, prop, fb)
  cachedFor = el
  cached = {
    accent: get('--page-accent', [232, 134, 107]),
    labelStrong: get('--text-primary', [250, 250, 250]),
    label: get('--text-muted', [161, 161, 170]),
    labelHover: get('--text-secondary', [212, 212, 216]),
    edge: get('--ws-border-strong', [82, 82, 91]),
    spike: get('--color-amber-400', [245, 158, 11]),
    highlight: get('--text-primary', [250, 250, 250]),
  }
  return cached
}

/** Drop the cache — call after a theme or `data-page` change. */
export function resetGraphPaint(): void {
  cached = null
  cachedFor = null
}

/** Hex → rgb triple. Used to read the shared `TYPE_COLORS` table. */
export function hexRGB(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6)
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return [113, 113, 122]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Categorical colour for a node type.
 *
 * Resolves through the SHARED `TYPE_COLORS` table rather than keeping a canvas
 * copy, because the single most important property of a categorical encoding is
 * that the legend and the marks agree — and that is exactly what broke when the
 * renderer and the legend each had their own palette. Per-frame this is one
 * `parseInt`; the callers memoise per node, not per pixel.
 */
export function typeRGB(type: string, table: Record<string, string>): [number, number, number] {
  return hexRGB(table[type] || table.default || '')
}

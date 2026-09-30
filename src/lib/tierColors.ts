// ============================================================
// TIER COLORS — the single source of truth
// ============================================================
//
// Before this file, each of the 9 places that colour a productivity
// tier had its own hardcoded value, and they DISAGREED:
//
//   Settings / Productivity  neutral = #3b82f6 (blue)
//   dashboard StatusBand     neutral = #71717a (zinc)
//   TierBreakdownStrip       neutral = #fbbf24 (amber)
//   WidgetSummaries          neutral = --warning (amber)
//
// StatusBand was internally inconsistent too: its accent used red
// #ef4444 for `distracting` while its timer used --resume-warning
// (amber #f59e0b) for the same tier.
//
// Everything now reads from the `--tier-*` CSS custom properties
// declared in index.css, which the user can override from
// Settings → Colors. `tierColor()` is the JS mirror for the places
// that need a raw hex (canvas, SVG fills, inline styles).
// ============================================================

export type Tier = 'productive' | 'neutral' | 'distracting';

export const TIERS: Tier[] = ['productive', 'neutral', 'distracting'];

export const TIER_LABELS: Record<Tier, string> = {
  productive: 'Productive',
  neutral: 'Neutral',
  distracting: 'Distracting',
};

/** Fallback hexes. These mirror the `:root` values in index.css. */
export const TIER_FALLBACK: Record<Tier, string> = {
  productive: '#22c55e',
  neutral: '#3b82f6',
  distracting: '#ef4444',
};

const STORAGE_KEY = 'deskflow-tier-colors';

/**
 * Read the live CSS variable, falling back to the hardcoded hex.
 * SSR/renderer-safe: wraps in try/catch because a missing
 * localStorage (private mode) or an unparsed document must never
 * take the dashboard down.
 */
export function tierColor(tier: Tier | string | null | undefined): string {
  const t = (tier ?? 'neutral') as Tier;
  const fallback = TIER_FALLBACK[t] ?? TIER_FALLBACK.neutral;
  try {
    if (typeof document === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(`--tier-${t}`)
      .trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/** Every tier colour the user has overridden, if any. */
export function getTierColorOverrides(): Partial<Record<Tier, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Partial<Record<Tier, string>> = {};
    for (const t of TIERS) {
      const v = (parsed as Record<string, unknown>)[t];
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) out[t] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Push the user's tier colours onto `:root` as `--tier-*` so every
 * consumer (CSS, Tailwind arbitrary values, inline styles) updates
 * at once. Passing `null` for a tier resets it to the fallback.
 */
export function applyTierColors(colors: Partial<Record<Tier, string>>): void {
  try {
    const root = document.documentElement;
    for (const t of TIERS) {
      const v = colors[t];
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) {
        root.style.setProperty(`--tier-${t}`, v);
        // The -muted variants are declared in index.css as color-mix() against
        // the *literal* fallback hex, so overriding --tier-X alone would leave
        // them stale. Recompute them here or the backgrounds would keep the
        // old tier's hue.
        root.style.setProperty(`--tier-${t}-muted`, `color-mix(in srgb, ${v} 12%, transparent)`);
      } else {
        root.style.removeProperty(`--tier-${t}`);
        root.style.removeProperty(`--tier-${t}-muted`);
      }
    }
  } catch {
    /* non-fatal */
  }
}

/** Persist + apply. The single entry point the Settings UI should call. */
export function setTierColor(tier: Tier, hex: string): void {
  const next = { ...getTierColorOverrides(), [tier]: hex };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — the colour still applies for this session */
  }
  applyTierColors(next);
}

export function resetTierColors(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
  applyTierColors({});
}

/**
 * Tailwind-safe class fragments. These cannot be built from a runtime
 * value (Tailwind only sees literal class names in the source), so
 * the three tiers map to a fixed literal set and the hex comes from
 * the CSS variable via an arbitrary value.
 */
export function tierClasses(tier: Tier | string | null | undefined) {
  const t = ((tier ?? 'neutral') as Tier) in TIER_FALLBACK ? (tier as Tier) : 'neutral';
  switch (t) {
    case 'productive':
      return {
        text: 'text-[var(--tier-productive)]',
        bg: 'bg-[var(--tier-productive)]/[0.07]',
        bgStrong: 'bg-[var(--tier-productive)]',
        border: 'border-[var(--tier-productive)]/30',
        hex: tierColor('productive'),
      };
    case 'distracting':
      return {
        text: 'text-[var(--tier-distracting)]',
        bg: 'bg-[var(--tier-distracting)]/[0.07]',
        bgStrong: 'bg-[var(--tier-distracting)]',
        border: 'border-[var(--tier-distracting)]/30',
        hex: tierColor('distracting'),
      };
    default:
      return {
        text: 'text-[var(--tier-neutral)]',
        bg: 'bg-[var(--tier-neutral)]/[0.07]',
        bgStrong: 'bg-[var(--tier-neutral)]',
        border: 'border-[var(--tier-neutral)]/30',
        hex: tierColor('neutral'),
      };
  }
}

/**
 * Darken/lighten a hex by a percentage. Needed for the SVG gradient
 * stops the stopwatch used to hardcode. Kept dependency-free so it
 * works in the renderer and in the main process.
 */
export function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

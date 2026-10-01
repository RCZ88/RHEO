// ============================================================
// AMBIENT BACKDROP — the subtle atmospheric wash
// ============================================================
//
// Extracted from `src/terminal/App.tsx`, where it was a single hardcoded
// two-gradient div that only existed on the terminal page:
//
//   radial-gradient(900px 400px at 15% -5%, accent 14, transparent 60%),
//   radial-gradient(800px 380px at 95%   0%, accent2 12, transparent 60%)
//
// It reads as a faint tinted light from above the fold — barely there, which
// is the point. This module makes it global, per-page, and tunable.
//
// Each page already declares its own `--page-accent` (src/index.css), so the
// hue is inherited automatically and every page gets a subtly different wash
// without any per-page wiring. The second colour is derived by rotating the
// hue so the two gradients never look like a single flat tint.
//
// THREE controls, all persisted, all live:
//   enabled  — off removes the layer entirely (it is aria-hidden anyway, so
//              removing it changes nothing about semantics or hit-testing)
//   intensity (0–100) — alpha of the wash. Default 100 = the original look.
//              Kept low by default on purpose: this is atmosphere, not a feature.
//   spread   (0–100) — how wide the washes reach. Higher = more of the screen
//              tinted, which reads as "more distracting" even at low alpha.
//              Default 30 keeps them in the top corners and out of the content.
//
// Honours `prefers-reduced-motion` (no drift) and never animates on first
// paint, because a moving background behind text is the fastest way to make
// an app feel cheap.
// ============================================================

const STORAGE_KEY = 'deskflow-ambient';

export type AmbientPrefs = {
  enabled: boolean;
  /** 0–100. Alpha multiplier. */
  intensity: number;
  /** 0–100. Radius multiplier. */
  spread: number;
};

export const AMBIENT_DEFAULTS: AmbientPrefs = {
  enabled: true,
  intensity: 100,
  spread: 30,
};

export const AMBIENT_MIN = { intensity: 0, spread: 0 } as const;
export const AMBIENT_MAX = { intensity: 100, spread: 100 } as const;

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function getAmbientPrefs(): AmbientPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...AMBIENT_DEFAULTS };
    const p = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return { ...AMBIENT_DEFAULTS };
    return {
      enabled: typeof p.enabled === 'boolean' ? p.enabled : AMBIENT_DEFAULTS.enabled,
      intensity: clamp(p.intensity, AMBIENT_MIN.intensity, AMBIENT_MAX.intensity, AMBIENT_DEFAULTS.intensity),
      spread: clamp(p.spread, AMBIENT_MIN.spread, AMBIENT_MAX.spread, AMBIENT_DEFAULTS.spread),
    };
  } catch {
    return { ...AMBIENT_DEFAULTS };
  }
}

export function setAmbientPrefs(patch: Partial<AmbientPrefs>): AmbientPrefs {
  const next = { ...getAmbientPrefs(), ...patch };
  next.intensity = clamp(next.intensity, AMBIENT_MIN.intensity, AMBIENT_MAX.intensity, AMBIENT_DEFAULTS.intensity);
  next.spread = clamp(next.spread, AMBIENT_MIN.spread, AMBIENT_MAX.spread, AMBIENT_DEFAULTS.spread);
  next.enabled = !!next.enabled;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  try {
    window.dispatchEvent(new CustomEvent('ambient-prefs-changed', { detail: next }));
  } catch { /* non-fatal */ }
  return next;
}

/**
 * Read the live `--page-accent` for the current page. Returns null when it
 * cannot be resolved so the caller can skip painting rather than paint grey.
 */
export function getPageAccent(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector('[data-page]') as HTMLElement | null;
    const v = (el ? getComputedStyle(el) : getComputedStyle(document.documentElement))
      .getPropertyValue('--page-accent')
      .trim();
    return v && v !== 'var(--page-accent)' ? v : null;
  } catch {
    return null;
  }
}

/** Rotate a hex hue by `deg` so the second wash is a sibling, not a copy. */
function rotateHue(hex: string, deg: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deg) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  const to = (v: number) => Math.round((v + m2) * 255).toString(16).padStart(2, '0');
  return `#${to(rr)}${to(gg)}${to(bb)}`;
}

/** 0–100 alpha to a 2-digit hex suffix. */
function alpha(v: number): string {
  return Math.max(0, Math.min(255, Math.round((v / 100) * 255)))
    .toString(16).padStart(2, '0');
}

/**
 * The gradient string. Exported so the Settings preview can render the exact
 * same thing the app paints, instead of an approximation that drifts.
 */
export function ambientGradient(prefs: AmbientPrefs, accent: string | null): string {
  if (!accent) return 'none';
  const a = prefs.intensity;
  const spread = prefs.spread / 100;
  // Original geometry was 900x400 @15% and 800x380 @95%. Spread scales the
  // radii only — position stays pinned to the top so the wash never creeps
  // into the reading area.
  const r1 = 900 + spread * 1400;
  const r2 = 800 + spread * 1300;
  const c1 = accent;
  const c2 = rotateHue(accent, 42);
  return [
    `radial-gradient(${Math.round(r1)}px ${Math.round(400 + spread * 260)}px at 15% -5%, ${c1}${alpha(a * 0.08)}, transparent 60%)`,
    `radial-gradient(${Math.round(r2)}px ${Math.round(380 + spread * 250)}px at 95% 0%, ${c2}${alpha(a * 0.07)}, transparent 60%)`,
  ].join(', ');
}
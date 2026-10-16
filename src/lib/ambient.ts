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
// FOUR controls, all persisted, all live:
//   enabled  — off removes the layer entirely (it is aria-hidden anyway, so
//              removing it changes nothing about semantics or hit-testing)
//   intensity (0–100) — alpha of the wash. Default 100 = the original look.
//              Kept low by default on purpose: this is atmosphere, not a feature.
//   spread   (0–100) — how wide the washes reach. Higher = more of the screen
//              tinted, which reads as "more distracting" even at low alpha.
//              Default 30 keeps them in the top corners and out of the content.
//   scope + pages — WHICH pages wear the wash. `all` (the default) or an
//              explicit list of `data-page` ids.
//
// Honours `prefers-reduced-motion` (no drift) and never animates on first
// paint, because a moving background behind text is the fastest way to make
// an app feel cheap.
// ============================================================

const STORAGE_KEY = 'deskflow-ambient';

export type AmbientScope = 'all' | 'selected';

export type AmbientPrefs = {
  enabled: boolean;
  /** 0–100. Alpha multiplier. */
  intensity: number;
  /** 0–100. Radius multiplier. */
  spread: number;
  /** `all` = every route. `selected` = only the ids in `pages`. */
  scope: AmbientScope;
  /** `data-page` ids the wash is limited to when `scope === 'selected'`. */
  pages: string[];
};

/**
 * The routes the wash can appear on.
 *
 * These are `data-page` values, and `data-page` is what `App.tsx` derives from
 * `location.pathname` and writes onto `<html>`. It is NOT derived from the page
 * registry: `index.css` declares accents for ids the registry has no manifest
 * for, and the registry has manifests for ids that never reach `data-page`.
 * Listing the ids the app can actually produce is the only list that cannot
 * drift from what paints.
 *
 * Kept as data rather than scraped from the DOM so the picker is stable across
 * routes and so a page cannot appear in the list only while you are already on it.
 *
 * ── THIS LIST IS CHECKED AGAINST index.css, DO NOT EDIT BY HAND ────────────────
 * The first version of this list was typed from memory and had 15 entries while
 * `index.css` declares 21. The six omissions (`guide`, `labs`, `rankings`,
 * `documentation`, `stt`, `penguin-console`) were silently unselectable: under
 * `scope: 'selected'` those routes could never wear the wash and nothing said so.
 * `agent/probes/ambient-logic-probe.mjs` now extracts every `[data-page="…"]`
 * selector out of `src/index.css` and fails if this list and that set differ, so
 * adding a page to the app without adding it here is now a failing check rather
 * than a silent gap.
 */
export const AMBIENT_PAGES: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'activity', label: 'Activity' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'ide', label: 'IDE Projects' },
  { id: 'learn', label: 'Learn' },
  { id: 'life', label: 'Life' },
  { id: 'finance', label: 'Finance' },
  { id: 'insights', label: 'Insights' },
  { id: 'resume', label: 'Resume' },
  { id: 'studio', label: 'Studio' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'penguin-console', label: 'Penguin Console' },
  { id: 'database', label: 'Database' },
  { id: 'profiler', label: 'Profiler' },
  { id: 'external', label: 'External' },
  { id: 'guide', label: 'Guide' },
  { id: 'labs', label: 'Labs' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'documentation', label: 'Documentation' },
  { id: 'stt', label: 'Speech to Text' },
  { id: 'settings', label: 'Settings' },
];

export const AMBIENT_DEFAULTS: AmbientPrefs = {
  enabled: true,
  intensity: 100,
  spread: 30,
  scope: 'all',
  pages: [],
};

export const AMBIENT_MIN = { intensity: 0, spread: 0 } as const;
export const AMBIENT_MAX = { intensity: 100, spread: 100 } as const;

/** Every id the wash knows about, in picker order. */
export const ALL_AMBIENT_PAGE_IDS: string[] = AMBIENT_PAGES.map(p => p.id);

/**
 * Should the wash paint on this route?
 *
 * An empty `pages` list under `selected` is treated as "nothing selected" rather
 * than "everything selected", because the alternative is a control the user has
 * turned on that appears to do nothing — the exact failure this whole module is
 * being repaired for. The picker seeds a fresh list from `ALL_AMBIENT_PAGE_IDS`,
 * so the empty case is only reachable by clearing every box, which is honest.
 */
export function ambientAppliesTo(pageId: string | null, prefs: AmbientPrefs): boolean {
  if (!prefs.enabled) return false;
  if (prefs.intensity <= 0) return false;
  if (prefs.scope === 'all') return true;
  if (!pageId) return false;
  return prefs.pages.includes(pageId);
}

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
      scope: p.scope === 'selected' ? 'selected' : AMBIENT_DEFAULTS.scope,
      pages: Array.isArray(p.pages) ? uniqIds(p.pages) : [],
    };
  } catch {
    return { ...AMBIENT_DEFAULTS };
  }
}

/** Keep only known ids, de-duplicated, in the canonical picker order. */
function uniqIds(input: unknown[]): string[] {
  const wanted = new Set(input.filter(v => typeof v === 'string') as string[]);
  return ALL_AMBIENT_PAGE_IDS.filter(id => wanted.has(id));
}

export function setAmbientPrefs(patch: Partial<AmbientPrefs>): AmbientPrefs {
  const next = { ...getAmbientPrefs(), ...patch };
  next.intensity = clamp(next.intensity, AMBIENT_MIN.intensity, AMBIENT_MAX.intensity, AMBIENT_DEFAULTS.intensity);
  next.spread = clamp(next.spread, AMBIENT_MIN.spread, AMBIENT_MAX.spread, AMBIENT_DEFAULTS.spread);
  next.enabled = !!next.enabled;
  next.scope = patch.scope === 'selected' || next.scope === 'selected' ? 'selected' : 'all';
  next.pages = uniqIds(next.pages);

  /* Seed the list ONLY on the transition INTO `selected`.
   *
   * The first version of this ran on every call, which silently broke the "Clear"
   * button in the picker: clearing every box re-seeded all 21 pages on the very
   * next write, so the control snapped the list back and the user could never
   * express "off everywhere but I turned the feature on". That is the specific
   * failure this module exists to prevent — a control that says one thing and does
   * another — so the guard is keyed on the TRANSITION, not on the resulting value.
   * `patch.scope === 'selected'` means the caller just picked "Only some pages";
   * `pages.length === 0` alone does not, because an existing selection may
   * legitimately have been emptied. */
  const enteredSelected = patch.scope === 'selected' && next.scope === 'selected';
  if (enteredSelected && next.pages.length === 0) {
    next.pages = [...ALL_AMBIENT_PAGE_IDS];
  }

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  try {
    window.dispatchEvent(new CustomEvent('ambient-prefs-changed', { detail: next }));
  } catch { /* non-fatal */ }
  return next;
}

/**
 * Read the live hue for the current page.
 *
 * `--page-accent` is the page's own tint and is preferred whenever it is an
 * actual hue. But `[data-page="settings"]` sets `--page-accent: var(--text-primary)`
 * on purpose — the settings page is deliberately monochrome, so "selection" there
 * reads as contrast rather than colour. That made this function return `#fafafa`
 * on dark and `#1c1917` on light, and the "per-page tinted wash" painted a grey
 * haze: literally no tint, on every theme.
 *
 * So an achromatic accent is not an accent. When the resolved value has no
 * meaningful saturation we fall back to `--ws-accent`, the app's one signal hue,
 * which is what every other page's tint is derived from anyway.
 */
export function getPageAccent(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector('[data-page]') as HTMLElement | null;
    const style = el ? getComputedStyle(el) : getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();

    const accent = read('--page-accent');
    // `getPropertyValue` resolves `var()`, so a literal `var(--page-accent)`
    // here means the token was never defined on this element at all.
    if (accent && accent !== 'var(--page-accent)' && isHueful(accent)) return accent;

    const fallback = read('--ws-accent');
    if (fallback && !fallback.startsWith('var(')) return fallback;

    return accent && accent !== 'var(--page-accent)' ? accent : null;
  } catch {
    return null;
  }
}

/**
 * Is this colour a HUE rather than a shade of grey?
 *
 * `#fafafa` (dark `--text-primary`) and `#1c1917` (light `--text-primary`) are
 * both effectively neutral; treating either as an accent is what made the wash
 * invisible. Saturation is read straight off the hex so the answer does not
 * depend on a colour library being present.
 */
function isHueful(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  let body = m[1];
  if (body.length === 3) body = body.split('').map(c => c + c).join('');
  const n = parseInt(body, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // HSL saturation. 0.12 is comfortably above the near-neutrals this codebase
  // uses (#fafafa, #1c1917, #09090b) and below every real accent it declares.
  if (max === min) return false;
  const l = (max + min) / 2;
  const s = (max - min) / (1 - Math.abs(2 * l - 1));
  return s >= 0.12;
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
 * Peak alpha, as a fraction, per theme.
 *
 * The old code had ONE ceiling of 0.08 and applied it to both themes, which is
 * why the wash read as "off" on dark and could never be made to read on light.
 * A single alpha cannot serve two fields that far apart in luminance: 8% of a
 * mid-saturation hue over `#09090b` is a ~1.5% luminance lift, which is below
 * what a person can see at a glance behind text. The same 8% over `#f5f2ec` is
 * similarly imperceptible.
 *
 * The two ceilings are measured, not guessed — see `agent/probes/ambient-probe.mjs`,
 * which composites each one against the real surface tokens and prints the
 * resulting ΔRGB.
 *
 * ── WHY BOTH FIELDS NOW SIT AT 0.08 ───────────────────────────────────────────
 * The history, because it explains the number rather than just asserting it:
 * light was once 0.13, chosen because the wash "did nothing" at 0.08. That was
 * the honest mistake — treating one number as right for two fields. Measured
 * against every light page accent, 0.13 removed **16-20% of the page's
 * luminance**: paper `#f5f2ec` became `#edd5d9` on activity/dashboard/insights.
 * That is not atmosphere, it is a different colour — and because the wash
 * paints the whole viewport, it shifts the field on pages whose own source was
 * completely clean. That is why "clean" pages still read as dark.
 *
 * So light came DOWN to 0.08. Dark was then brought down to match, and this
 * comment previously still claimed 0.19 — prose describing a value the code
 * did not have, which is how the next agent ends up "restoring" a ceiling that
 * was measured and deliberately removed.
 *
 * Re-measured at 0.08 against the real fields, peak intensity:
 *   dark  #09090b -> #1c180d under amber  (a large RELATIVE lift, because a
 *         near-black field has its whole range below it to move into)
 *   light #f5f2ec -> #f4e4e5 under pink   (-9.66% luminance; still a tint,
 *         still paper)
 * Both read as atmosphere. Neither reads as a repaint.
 *
 * IF YOU RAISE ONE, MEASURE THE OTHER. The trap is not the number, it is
 * assuming a field that is 1/30th the luminance of the other behaves the same.
 */
const PEAK_ALPHA = { dark: 0.08, light: 0.08 } as const;

export type AmbientTheme = keyof typeof PEAK_ALPHA;

/** Which field this wash is being composited onto. */
export function ambientTheme(): AmbientTheme {
  try {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * The gradient string. Exported so the Settings preview can render the exact
 * same thing the app paints, instead of an approximation that drifts.
 *
 * `theme` is a PARAMETER, not ambient state, for the same reason
 * `metricHistory(db, anchor, …)` is: the answer depends on it, so the caller has
 * to name it and the compiler can find every call site that has to think about it.
 */
export function ambientGradient(
  prefs: AmbientPrefs,
  accent: string | null,
  theme: AmbientTheme = 'dark',
): string {
  if (!accent) return 'none';
  const peak = PEAK_ALPHA[theme] ?? PEAK_ALPHA.dark;
  const a = (prefs.intensity / 100) * peak * 100; // 0–100, for `alpha()`
  const spread = prefs.spread / 100;
  // Original geometry was 900x400 @15% and 800x380 @95%. Spread scales the
  // radii only — position stays pinned to the top so the wash never creeps
  // into the reading area.
  //
  // Reach was raised (radii + falloff, NOT alpha) because "the ambient should
  // affect the background more" was asked for at a point where the alpha had
  // already been measured down to 0.08 — see the PEAK_ALPHA history above for
  // why alpha is not the lever. Raising alpha is what tinted clean pages; the
  // same visible weight comes from covering more area at the same alpha.
  const r1 = 1100 + spread * 2000;
  const r2 = 1000 + spread * 1900;
  const c1 = accent;
  const c2 = rotateHue(accent, 42);
  // Falloff stop moved 62% -> 78%: at 62% most of each gradient was already
  // fully transparent, so the peak alpha only reached a small fraction of the
  // radius and the wash read as a hotspot rather than a background tint.
  return [
    `radial-gradient(${Math.round(r1)}px ${Math.round(520 + spread * 380)}px at 15% -5%, ${c1}${alpha(a)}, transparent 78%)`,
    `radial-gradient(${Math.round(r2)}px ${Math.round(500 + spread * 360)}px at 95% 0%, ${c2}${alpha(a * 0.82)}, transparent 78%)`,
  ].join(', ');
}
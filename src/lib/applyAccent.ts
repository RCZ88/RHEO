/**
 * Global accent colour.
 *
 * `--page-accent` is defined per-page in src/index.css (`[data-page="…"]`), so a
 * user override has to be an INLINE style on <html> to win over those rules —
 * a stylesheet rule of equal specificity loses, and no amount of extra CSS
 * specificity in index.css is as reliable as an inline custom property.
 *
 * `--color-primary` is mirrored because index.css:458 derives the page accent
 * from it, so components that reference either token follow the user's choice.
 *
 * ── WHY THERE ARE TWO COLOURS PER SWATCH ───────────────────────────────────
 * The nine swatches were calibrated as fills on the DARK field (#09090b) and
 * were reused verbatim on cream. Measured, all nine FAIL as a fill under a
 * white label in light mode — 2.15:1 (Amber) to 4.76:1 (Slate), i.e. every one
 * of them below the 4.5:1 body threshold. Amber, Cyan and Emerald were the
 * worst at 2.15:1 / 2.43:1 / 2.54:1: a white label on a cream page.
 *
 * An inline custom property on <html> outranks every `html.light` rule, so this
 * is not fixable from the stylesheet — the light value has to be chosen HERE,
 * at the moment the override is written. Hence LIGHT_ACCENTS below.
 *
 * Every light value REUSES a hex the app already ships for that hue family
 * (ide/cyan, resume/indigo, ai/violet, dashboard/pink, external/amber,
 * learn/emerald, --error/rose), so a chosen accent matches the app's own
 * palette instead of introducing a near-miss colour that appears nowhere else.
 * All nine clear 4.5:1 for a white label AND as accent text on card/paper.
 *
 * Both are stored under the SAME key as the swatch NAME, not its hex, so a
 * user who picks Pink and then switches to light mode gets the light Pink.
 * Storing the hex would pin one theme's value for both.
 */

const KEY = 'deskflow-accent-color';

function isHex(v: string | null | undefined): v is string {
  return !!v && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/**
 * The label colour that goes ON the accent fill.
 *
 * `--color-primary-foreground` is near-black in the dark theme and white in
 * light, which is right for the DEFAULT accent and wrong for most others: the
 * dark swatches are bright fills, so a near-black label is the only thing that
 * clears 4.5:1 on them (Cyan 8.19:1, Amber 9.26:1, Emerald 7.84:1), while the
 * light swatches are deep, so they need white (5.02:1 to 7.90:1).
 *
 * Two swatches are the exception and are why this table exists per swatch
 * rather than as one global rule:
 *   Slate  #64748b — near-black is 4.18:1, white is 4.76:1  -> white wins
 *   Indigo #5e61e6 — near-black is 4.10:1, white is 4.85:1  -> white wins
 *
 * Indigo was ALSO the one accent no label colour could rescue: the original
 * #6366f1 measured 4.45:1 against near-black and 4.47:1 against white — both
 * under 4.5:1. It is nudged 5% toward the dark field to #5e61e6, which keeps
 * it clearly indigo next to Violet #8b5cf6 and gives white 4.85:1.
 *
 * Every value below was measured, not eyeballed. If you change a fill, measure
 * its label — do not assume the previous pairing still holds.
 */
export const ACCENT_SWATCHES = [
  { name: 'Cyan', dark: '#06b6d4', light: '#0e7490', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Blue', dark: '#3b82f6', light: '#1d4ed8', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Indigo', dark: '#5e61e6', light: '#4338ca', onDark: '#ffffff', onLight: '#ffffff' },
  { name: 'Violet', dark: '#8b5cf6', light: '#6d28d9', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Pink', dark: '#ec4899', light: '#be185d', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Amber', dark: '#f59e0b', light: '#b45309', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Emerald', dark: '#10b981', light: '#047857', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Rose', dark: '#f43f5e', light: '#b91c1c', onDark: '#09090b', onLight: '#ffffff' },
  { name: 'Slate', dark: '#64748b', light: '#475569', onDark: '#ffffff', onLight: '#ffffff' },
] as const;

export type AccentName = (typeof ACCENT_SWATCHES)[number]['name'];

/** The stored preference is a NAME, so it can resolve per theme. */
function isAccentName(v: string | null | undefined): v is AccentName {
  return !!v && ACCENT_SWATCHES.some((s) => s.name === v);
}

/**
 * Legacy fallback: older builds stored a raw hex. Resolve it to a swatch name
 * where possible so those users also get a light variant. An unknown hex is
 * kept as-is — better a slightly-off colour in light mode than losing the
 * user's choice entirely.
 */
function hexToName(hex: string): AccentName | null {
  const norm = hex.trim().toLowerCase();
  // Indigo's shipped hex changed from #6366f1 to #5e61e6, so the old value is
  // still recognised here or those users would silently lose their accent.
  if (norm === '#6366f1') return 'Indigo';
  const hit = ACCENT_SWATCHES.find(
    (s) => s.dark.toLowerCase() === norm || s.light.toLowerCase() === norm,
  );
  return hit ? hit.name : null;
}

export function isLightMode(): boolean {
  try {
    return document.documentElement.classList.contains('light');
  } catch {
    return false;
  }
}

/** Resolve a stored preference to the hex this theme should use. */
export function resolveAccentValue(stored: string | null): string | null {
  if (!stored) return null;
  const light = isLightMode();
  if (isAccentName(stored)) {
    const s = ACCENT_SWATCHES.find((x) => x.name === stored)!;
    return light ? s.light : s.dark;
  }
  // Legacy hex, or a name from a future version we don't know.
  const named = hexToName(stored);
  if (named) {
    const s = ACCENT_SWATCHES.find((x) => x.name === named)!;
    return light ? s.light : s.dark;
  }
  return isHex(stored) ? stored.trim() : null;
}

/**
 * The label colour for the CURRENT accent. Written alongside the fill so
 * `<Button>`'s `text-primary-foreground` can never end up the same value as
 * its own `bg-primary` — which is what "the text is invisible on the button"
 * actually is.
 */
export function resolveAccentForeground(stored: string | null): string | null {
  if (!stored) return null;
  const light = isLightMode();
  const name = isAccentName(stored) ? stored : hexToName(stored);
  if (!name) return null; // unknown hex: leave the theme's own default alone
  const s = ACCENT_SWATCHES.find((x) => x.name === name)!;
  return light ? s.onLight : s.onDark;
}

export function getStoredAccent(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** The hex actually in effect right now (for swatch highlighting in Settings). */
export function getEffectiveAccent(): string | null {
  return resolveAccentValue(getStoredAccent());
}

export function applyAccent(stored?: string | null): string | null {
  if (typeof document === 'undefined') return null;
  const root = document.documentElement;
  const raw = stored !== undefined ? stored : getStoredAccent();
  const value = resolveAccentValue(raw);
  const fg = resolveAccentForeground(raw);
  if (!value) {
    root.style.removeProperty('--page-accent');
    root.style.removeProperty('--color-primary');
    root.style.removeProperty('--accent-primary');
    root.style.removeProperty('--color-primary-foreground');
    delete root.dataset.accentOverride;
    return null;
  }
  root.style.setProperty('--page-accent', value);
  root.style.setProperty('--color-primary', value);
  root.style.setProperty('--accent-primary', value);
  // The label colour must be written too, or `<Button>` paints
  // `text-primary-foreground` over `bg-primary` using the THEME's default
  // foreground — which is near-black in dark mode and is unreadable on 7 of
  // the 9 bright dark-mode fills.
  if (fg) root.style.setProperty('--color-primary-foreground', fg);
  root.dataset.accentOverride = value;
  return value;
}

export function setAccent(hexOrName: string | null): void {
  try {
    if (hexOrName === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, hexOrName);
  } catch {
    /* private mode / storage disabled — the visual override still applies */
  }
  applyAccent(hexOrName);
}

/**
 * Call once at app boot so the choice survives a reload.
 * Also re-applies on every theme change, because the correct hex is
 * theme-dependent — see the note at the top of this file.
 */
export function initAccent(): void {
  applyAccent();
  if (typeof window === 'undefined') return;
  const reapply = () => applyAccent();
  window.addEventListener('df-theme-changed', reapply);
  // The Halo island is a separate document with its own <html>; mirror the
  // accent there too or the island keeps the previous theme's value.
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) applyAccent();
    });
  } catch {
    /* ignore */
  }
}
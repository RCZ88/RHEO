/**
 * Rewind card themes — each theme defines the visual identity of full-mode
 * InsightCards inside the RewindPlayer. Compact cards keep their per-kind
 * theming; these themes only affect the full "story" view.
 */

export interface RewindTheme {
  id: string;
  name: string;
  icon: string;           // emoji for the picker
  bg: string;             // card background Tailwind class
  bgHex: string;          // card background hex (for ShareCard export)
  glow: string;           // radial-gradient overlay class
  border: string;         // border Tailwind class
  borderHex: string;      // border hex
  accent: string;         // primary accent Tailwind text class
  accentHex: string;      // accent hex for inline styles
  accentBg: string;       // accent background Tailwind class
  headline: string;       // headline text class
  subtext: string;        // subtext class
  label: string;          // kind/domain label class
  value: string;          // big number class
  muted: string;          // muted text class
  divider: string;        // divider/border-t class
  pillUp: string;         // direction pill (up) class
  pillDown: string;       // direction pill (down) class
  pillText: string;       // pill text (direction label) class
  progressBg: string;     // progress bar track class
  progressFill: string;   // progress bar fill gradient class
  headerBg: string;       // player header background
  navBg: string;          // player nav background
  spinner: string;        // loading spinner color
}


/* ═══════════════════════════════════════════════════════════════════════════
 * LIGHT-MODE DERIVATION
 *
 * This file shipped six hand-picked CINEMATIC palettes and ZERO light handling.
 * Every value is a deliberate dark-theme choice — `headline: 'text-zinc-100'` on
 * `headerBg: 'bg-[#09090b]/95'` — which is correct in isolation and broken in
 * practice, because two other things conspire:
 *
 *   1. index.css remaps BARE `text-zinc-100` to DARK ink for light mode. The
 *      player keeps its near-black surface, so a correctly-remediated headline
 *      landed on near-black: **2:1, black on black.**
 *   2. `bg-[#09090b]/95` is an ARBITRARY value, so no class-based net can reach
 *      it either. The surface stayed dark while everything painted on it flipped.
 *
 * That is the same failure as the Lecture pages, one layer up: a deliberately
 * dark surface must not inherit light-mode TEXT tokens.
 *
 * Rather than hand-author a second palette per theme (24 fields x 6 palettes), the
 * light values are DERIVED from each palette's own `accentHex`, so every palette
 * keeps its identity and simply gets re-chroma'd the way index.css re-chromas a
 * page accent for light. The hue ramps below are the same ones index.css already
 * uses for its own light remaps (#be185d / #6d28d9 / #0e7490 / #86198f / #92400e /
 * #166534) — consistency with the rest of the app, not a new palette.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** The fields a light palette must override. Anything not listed keeps its value. */
export type RewindThemeLight = Partial<
  Pick<
    RewindTheme,
    | 'bg' | 'bgHex' | 'glow' | 'border' | 'borderHex' | 'accent' | 'accentHex'
    | 'accentBg' | 'headline' | 'subtext' | 'label' | 'value' | 'muted'
    | 'divider' | 'pillText' | 'progressBg' | 'headerBg' | 'navBg' | 'spinner'
  >
>;

/**
 * Per-palette light values, keyed by id. The accent hue is re-chroma'd from the
 * dark value using the light ramp; the surfaces become the Warm Paper ladder.
 */
const LIGHT_OVERRIDES: Record<string, RewindThemeLight> = {
  midnight: {
    bg: 'bg-[var(--ws-surface-raised)]', bgHex: '#fcfbf8',
    border: 'border-[var(--ws-border)]', borderHex: 'rgba(28,25,23,0.10)',
    accent: 'text-[#6d28d9]', accentHex: '#6d28d9', accentBg: 'bg-[#6d28d9]/10',
    headline: 'text-[var(--text-primary)]', subtext: 'text-[var(--text-secondary)]',
    label: 'text-[#6d28d9]/75', value: 'text-[var(--text-primary)]',
    muted: 'text-[var(--text-muted)]', divider: 'border-[var(--ws-border)]',
    pillText: 'text-[var(--text-secondary)]', progressBg: 'bg-[var(--ws-surface-sunken)]',
    headerBg: 'bg-[var(--ws-surface-95)]', navBg: 'bg-[var(--ws-surface-95)]',
  },
  ember: {
    bg: 'bg-[var(--ws-surface-raised)]', bgHex: '#fcfbf8',
    border: 'border-[var(--ws-border)]', borderHex: 'rgba(28,25,23,0.10)',
    accent: 'text-[#93331d]', accentHex: '#93331d', accentBg: 'bg-[#93331d]/10',
    headline: 'text-[var(--text-primary)]', subtext: 'text-[var(--text-secondary)]',
    label: 'text-[#93331d]/75', value: 'text-[var(--text-primary)]',
    muted: 'text-[var(--text-muted)]', divider: 'border-[var(--ws-border)]',
    pillText: 'text-[var(--text-secondary)]', progressBg: 'bg-[var(--ws-surface-sunken)]',
    headerBg: 'bg-[var(--ws-surface-95)]', navBg: 'bg-[var(--ws-surface-95)]',
  },
  frost: {
    bg: 'bg-[var(--ws-surface-raised)]', bgHex: '#fcfbf8',
    border: 'border-[var(--ws-border)]', borderHex: 'rgba(28,25,23,0.10)',
    accent: 'text-[#0e7490]', accentHex: '#0e7490', accentBg: 'bg-[#0e7490]/10',
    headline: 'text-[var(--text-primary)]', subtext: 'text-[var(--text-secondary)]',
    label: 'text-[#0e7490]/75', value: 'text-[var(--text-primary)]',
    muted: 'text-[var(--text-muted)]', divider: 'border-[var(--ws-border)]',
    pillText: 'text-[var(--text-secondary)]', progressBg: 'bg-[var(--ws-surface-sunken)]',
    headerBg: 'bg-[var(--ws-surface-95)]', navBg: 'bg-[var(--ws-surface-95)]',
  },
  neon: {
    bg: 'bg-[var(--ws-surface-raised)]', bgHex: '#fcfbf8',
    border: 'border-[var(--ws-border)]', borderHex: 'rgba(28,25,23,0.10)',
    accent: 'text-[#86198f]', accentHex: '#86198f', accentBg: 'bg-[#86198f]/10',
    headline: 'text-[var(--text-primary)]', subtext: 'text-[var(--text-secondary)]',
    label: 'text-[#86198f]/75', value: 'text-[var(--text-primary)]',
    muted: 'text-[var(--text-muted)]', divider: 'border-[var(--ws-border)]',
    pillText: 'text-[var(--text-secondary)]', progressBg: 'bg-[var(--ws-surface-sunken)]',
    headerBg: 'bg-[var(--ws-surface-95)]', navBg: 'bg-[var(--ws-surface-95)]',
  },
  sunset: {
    bg: 'bg-[var(--ws-surface-raised)]', bgHex: '#fcfbf8',
    border: 'border-[var(--ws-border)]', borderHex: 'rgba(28,25,23,0.10)',
    accent: 'text-[#92400e]', accentHex: '#92400e', accentBg: 'bg-[#92400e]/10',
    headline: 'text-[var(--text-primary)]', subtext: 'text-[var(--text-secondary)]',
    label: 'text-[#92400e]/75', value: 'text-[var(--text-primary)]',
    muted: 'text-[var(--text-muted)]', divider: 'border-[var(--ws-border)]',
    pillText: 'text-[var(--text-secondary)]', progressBg: 'bg-[var(--ws-surface-sunken)]',
    headerBg: 'bg-[var(--ws-surface-95)]', navBg: 'bg-[var(--ws-surface-95)]',
  },
  terminal: {
    bg: 'bg-[var(--ws-surface-raised)]', bgHex: '#fcfbf8',
    border: 'border-[var(--ws-border)]', borderHex: 'rgba(28,25,23,0.10)',
    accent: 'text-[#166534]', accentHex: '#166534', accentBg: 'bg-[#166534]/10',
    headline: 'text-[var(--text-primary)]', subtext: 'text-[var(--text-secondary)]',
    label: 'text-[#166534]/75', value: 'text-[var(--text-primary)]',
    muted: 'text-[var(--text-muted)]', divider: 'border-[var(--ws-border)]',
    pillText: 'text-[var(--text-secondary)]', progressBg: 'bg-[var(--ws-surface-sunken)]',
    headerBg: 'bg-[var(--ws-surface-95)]', navBg: 'bg-[var(--ws-surface-95)]',
  },
};

/** Is light mode currently on? Read from <html>, the same source index.css keys off. */
export function isLightTheme(): boolean {
  try {
    return typeof document !== 'undefined'
      && document.documentElement.classList.contains('light');
  } catch {
    return false;
  }
}

/**
 * Resolve a palette for the ACTIVE theme.
 *
 * Dark returns the palette object untouched — byte-for-byte the shipped look, so
 * this cannot regress dark mode. Light returns it merged with that palette's
 * derived warm values, keyed on id so an unknown id falls back to itself rather
 * than to another palette's hues.
 */
export function resolveRewindTheme(theme: RewindTheme, light = isLightTheme()): RewindTheme {
  if (!light) return theme;
  const over = LIGHT_OVERRIDES[theme.id];
  if (!over) return theme;
  // `glow` and `spinner` stay: the glow is an accent radial that reads on both,
  // and the spinner border pair is already token-adjacent.
  return { ...theme, ...over };
}

/** Convenience: resolve straight from the palette map. */
export function resolveRewindThemeById(
  id: string,
  map: Record<string, RewindTheme>,
  light = isLightTheme(),
): RewindTheme {
  const t = map[id] || map.midnight;
  return resolveRewindTheme(t, light);
}

export const REWIND_THEMES: RewindTheme[] = [
  // ── 1. Midnight (default) ──────────────────────────────
  {
    id: 'midnight',
    name: 'Midnight',
    icon: '🌙',
    bg: 'bg-[#0c0c14]',
    bgHex: '#0c0c14',
    glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.10)_0%,transparent_65%)]',
    border: 'border-violet-500/15',
    borderHex: 'rgba(139,92,246,0.15)',
    accent: 'text-violet-400',
    accentHex: '#a78bfa',
    accentBg: 'bg-violet-500/10',
    headline: 'text-zinc-100',
    subtext: 'text-zinc-400',
    label: 'text-violet-400/70',
    value: 'text-zinc-50',
    muted: 'text-zinc-500',
    divider: 'border-zinc-800/40',
    pillUp: 'bg-emerald-500/10',
    pillDown: 'bg-red-500/10',
    pillText: 'text-zinc-300',
    progressBg: 'bg-zinc-800/60',
    progressFill: 'bg-gradient-to-r from-violet-500 to-violet-400',
    headerBg: 'bg-[#09090b]/95',
    navBg: 'bg-[#09090b]/95',
    spinner: 'border-violet-500/30 border-t-violet-500',
  },

  // ── 2. Warm Ember ──────────────────────────────────────
  {
    id: 'ember',
    name: 'Warm Ember',
    icon: '🔥',
    bg: 'bg-[#120e0a]',
    bgHex: '#120e0a',
    glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,134,107,0.12)_0%,transparent_65%)]',
    border: 'border-[var(--color-clay-500)]/15',
    borderHex: 'rgba(232,134,107,0.15)',
    accent: 'text-[var(--color-clay-400)]',
    accentHex: '#e8866b',
    accentBg: 'bg-[var(--color-clay-500-10)]',
    headline: 'text-[#f0e6dc]',
    subtext: 'text-[#b8a89a]',
    label: 'text-[var(--color-clay-400)]/70',
    value: 'text-[#f5ece4]',
    muted: 'text-[#8a7c70]',
    divider: 'border-[#2a221c]/60',
    pillUp: 'bg-[#6fb38f]/10',
    pillDown: 'bg-[#d96846]/10',
    pillText: 'text-[#d4c4b4]',
    progressBg: 'bg-[#1e1814]',
    progressFill: 'bg-gradient-to-r from-[#d96846] to-[#e8866b]',
    headerBg: 'bg-[#0e0b08]/95',
    navBg: 'bg-[#0e0b08]/95',
    spinner: 'border-[var(--color-clay-500)]/30 border-t-[#e8866b]',
  },

  // ── 3. Nordic Frost ────────────────────────────────────
  {
    id: 'frost',
    name: 'Nordic Frost',
    icon: '❄️',
    bg: 'bg-[#0a1014]',
    bgHex: '#0a1014',
    glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.10)_0%,transparent_65%)]',
    border: 'border-cyan-500/15',
    borderHex: 'rgba(34,211,238,0.15)',
    accent: 'text-cyan-400',
    accentHex: '#22d3ee',
    accentBg: 'bg-cyan-500/10',
    headline: 'text-[#e8f4f8]',
    subtext: 'text-cyan-100/50',
    label: 'text-cyan-400/60',
    value: 'text-[#f0fbfd]',
    muted: 'text-cyan-800',
    divider: 'border-cyan-900/30',
    pillUp: 'bg-emerald-500/10',
    pillDown: 'bg-rose-500/10',
    pillText: 'text-cyan-200/70',
    progressBg: 'bg-cyan-950/40',
    progressFill: 'bg-gradient-to-r from-cyan-500 to-sky-400',
    headerBg: 'bg-[#070d10]/95',
    navBg: 'bg-[#070d10]/95',
    spinner: 'border-cyan-500/30 border-t-cyan-500',
  },

  // ── 4. Neon Pulse ──────────────────────────────────────
  {
    id: 'neon',
    name: 'Neon Pulse',
    icon: '⚡',
    bg: 'bg-[#08080e]',
    bgHex: '#08080e',
    glow: 'bg-[radial-gradient(ellipse_at_30%_20%,rgba(168,85,247,0.15)_0%,transparent_50%),radial-gradient(ellipse_at_70%_80%,rgba(236,72,153,0.08)_0%,transparent_50%)]',
    border: 'border-fuchsia-500/20',
    borderHex: 'rgba(232,121,249,0.20)',
    accent: 'text-fuchsia-400',
    accentHex: '#e879f9',
    accentBg: 'bg-fuchsia-500/10',
    headline: 'text-fuchsia-50',
    subtext: 'text-zinc-400',
    label: 'text-fuchsia-400/70',
    value: 'text-white',
    muted: 'text-zinc-500',
    divider: 'border-fuchsia-500/10',
    pillUp: 'bg-emerald-500/10',
    pillDown: 'bg-red-500/10',
    pillText: 'text-fuchsia-200/70',
    progressBg: 'bg-zinc-800/60',
    progressFill: 'bg-gradient-to-r from-fuchsia-500 to-pink-500',
    headerBg: 'bg-[#06060a]/95',
    navBg: 'bg-[#06060a]/95',
    spinner: 'border-fuchsia-500/30 border-t-fuchsia-500',
  },

  // ── 5. Sunset ──────────────────────────────────────────
  {
    id: 'sunset',
    name: 'Sunset',
    icon: '🌅',
    bg: 'bg-[#100c0a]',
    bgHex: '#100c0a',
    glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.10)_0%,transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(244,114,182,0.06)_0%,transparent_50%)]',
    border: 'border-amber-500/15',
    borderHex: 'rgba(251,191,36,0.15)',
    accent: 'text-amber-400',
    accentHex: '#fbbf24',
    accentBg: 'bg-amber-500/10',
    headline: 'text-amber-50',
    subtext: 'text-amber-100/50',
    label: 'text-amber-400/60',
    value: 'text-amber-50',
    muted: 'text-amber-900',
    divider: 'border-amber-500/10',
    pillUp: 'bg-emerald-500/10',
    pillDown: 'bg-rose-500/10',
    pillText: 'text-amber-200/70',
    progressBg: 'bg-amber-950/30',
    progressFill: 'bg-gradient-to-r from-amber-500 to-orange-400',
    headerBg: 'bg-[#0c0906]/95',
    navBg: 'bg-[#0c0906]/95',
    spinner: 'border-amber-500/30 border-t-amber-500',
  },

  // ── 6. Terminal ────────────────────────────────────────
  {
    id: 'terminal',
    name: 'Terminal',
    icon: '💻',
    bg: 'bg-[#0a0a0a]',
    bgHex: '#0a0a0a',
    glow: 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,197,94,0.08)_0%,transparent_65%)]',
    border: 'border-green-500/15',
    borderHex: 'rgba(34,197,94,0.15)',
    accent: 'text-green-400',
    accentHex: '#4ade80',
    accentBg: 'bg-green-500/10',
    headline: 'text-green-50',
    subtext: 'text-green-100/50',
    label: 'text-green-500/60',
    value: 'text-green-300',
    muted: 'text-green-900',
    divider: 'border-green-500/10',
    pillUp: 'bg-green-500/10',
    pillDown: 'bg-red-500/10',
    pillText: 'text-green-300/70',
    progressBg: 'bg-green-950/30',
    progressFill: 'bg-gradient-to-r from-green-500 to-emerald-400',
    headerBg: 'bg-[#060606]/95',
    navBg: 'bg-[#060606]/95',
    spinner: 'border-green-500/30 border-t-green-500',
  },
];

export const REWIND_THEME_MAP: Record<string, RewindTheme> = Object.fromEntries(
  REWIND_THEMES.map(t => [t.id, t])
);

export const DEFAULT_THEME_ID = 'midnight';

const STORAGE_KEY = 'deskflow-rewind-theme';

export function loadRewindTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && REWIND_THEME_MAP[stored]) return stored;
  } catch { /* ignore */ }
  return DEFAULT_THEME_ID;
}

export function saveRewindTheme(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
}

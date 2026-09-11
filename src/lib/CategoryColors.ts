// Single source of categorical color for the app.
// Re-exports the canonical map from src/components/CategoryColors.tsx and adds a
// stable accessor. New charts MUST pull category colors from here (LAMINAR §5).
// Legacy chart.js / Tableau-10 palettes are frozen and must not be expanded.

export type CategoryStyle = {
  bg: string;
  text: string;
  border: string;
};

export { CATEGORY_COLORS, getCategoryStyle } from '../components/CategoryColors';

/** Resolve a category name to its style, falling back to "Other". */
export function getCategoryColor(category: string): CategoryStyle {
  return getCategoryStyle(category);
}

/** Semantic colors for cross-feature relationship chrome. Keep these as utility
 * classes so entity identity stays consistent across the Gold page. */
export const ENTITY_COLORS = {
  goal: { text: 'text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-500/10', bar: 'bg-amber-400' },
  ltg: { text: 'text-yellow-300', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', bar: 'bg-yellow-400' },
  habit: { text: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', bar: 'bg-emerald-400' },
  deadline: { text: 'text-rose-300', border: 'border-rose-500/30', bg: 'bg-rose-500/10', bar: 'bg-rose-400' },
  schedule: { text: 'text-cyan-300', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', bar: 'bg-cyan-400' },
  note: { text: 'text-violet-300', border: 'border-violet-500/30', bg: 'bg-violet-500/10', bar: 'bg-violet-400' },
  todo: { text: 'text-zinc-300', border: 'border-zinc-600/50', bg: 'bg-zinc-800/60', bar: 'bg-zinc-400' },
} as const;

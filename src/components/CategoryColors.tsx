// Canonical shape of a category's Tailwind classes. This is re-exported as a
// type by src/lib/CategoryColors.ts, so it has to be exported from here.
export type CategoryStyle = { bg: string; text: string; border: string };

export const CATEGORY_COLORS: Record<string, CategoryStyle & { lightBg?: string; lightText?: string; lightBorder?: string }> = {
  'IDE':             { bg: 'bg-violet-500/15',   text: 'text-violet-400',   border: 'border-violet-500/20', lightBg: 'bg-violet-500/10', lightText: 'text-violet-600', lightBorder: 'border-violet-500/30' },
  'Browser':         { bg: 'bg-sky-500/15',      text: 'text-sky-400',      border: 'border-sky-500/20', lightBg: 'bg-sky-500/10', lightText: 'text-sky-600', lightBorder: 'border-sky-500/30' },
  'AI Tools':        { bg: 'bg-pink-500/15',     text: 'text-pink-400',     border: 'border-pink-500/20', lightBg: 'bg-pink-500/10', lightText: 'text-pink-600', lightBorder: 'border-pink-500/30' },
  'Entertainment':   { bg: 'bg-red-500/15',      text: 'text-red-400',      border: 'border-red-500/20', lightBg: 'bg-red-500/10', lightText: 'text-red-600', lightBorder: 'border-red-500/30' },
  'Communication':   { bg: 'bg-blue-500/15',     text: 'text-blue-400',     border: 'border-blue-500/20', lightBg: 'bg-blue-500/10', lightText: 'text-blue-600', lightBorder: 'border-blue-500/30' },
  'Design':          { bg: 'bg-fuchsia-500/15',  text: 'text-fuchsia-400',  border: 'border-fuchsia-500/20', lightBg: 'bg-fuchsia-500/10', lightText: 'text-fuchsia-600', lightBorder: 'border-fuchsia-500/30' },
  'Productivity':    { bg: 'bg-emerald-500/15',  text: 'text-emerald-400',  border: 'border-emerald-500/20', lightBg: 'bg-emerald-500/10', lightText: 'text-emerald-600', lightBorder: 'border-emerald-500/30' },
  'Developer Tools': { bg: 'bg-cyan-500/15',     text: 'text-cyan-400',     border: 'border-cyan-500/20', lightBg: 'bg-cyan-500/10', lightText: 'text-cyan-600', lightBorder: 'border-cyan-500/30' },
  'Tools':           { bg: 'bg-amber-500/15',    text: 'text-amber-400',    border: 'border-amber-500/20', lightBg: 'bg-amber-500/10', lightText: 'text-amber-600', lightBorder: 'border-amber-500/30' },
  'News':            { bg: 'bg-orange-500/15',   text: 'text-orange-400',   border: 'border-orange-500/20', lightBg: 'bg-orange-500/10', lightText: 'text-orange-600', lightBorder: 'border-orange-500/30' },
  'Shopping':        { bg: 'bg-rose-500/15',     text: 'text-rose-400',     border: 'border-rose-500/20', lightBg: 'bg-rose-500/10', lightText: 'text-rose-600', lightBorder: 'border-rose-500/30' },
  'Social Media':    { bg: 'bg-pink-500/15',     text: 'text-pink-400',     border: 'border-pink-500/20', lightBg: 'bg-pink-500/10', lightText: 'text-pink-600', lightBorder: 'border-pink-500/30' },
  'Uncategorized':   { bg: 'bg-zinc-500/15',     text: 'text-zinc-400',     border: 'border-zinc-500/20', lightBg: 'bg-stone-500/10', lightText: 'text-stone-600', lightBorder: 'border-stone-500/30' },
  'Other':           { bg: 'bg-zinc-500/15',     text: 'text-zinc-400',     border: 'border-zinc-500/20', lightBg: 'bg-stone-500/10', lightText: 'text-stone-600', lightBorder: 'border-stone-500/30' },
};

export function getCategoryStyle(category: string): CategoryStyle & { lightBg?: string; lightText?: string; lightBorder?: string } {
  // User-defined categories are registered at runtime (they live in
  // categoryConfig.customCategories, not in this static map). Without this they
  // all fell through to 'Other' and rendered grey everywhere in the app.
  if (!CATEGORY_COLORS[category]) {
    const generated = generatedStyle(category);
    if (generated) return generated;
  }
  const base = CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'];
  return {
    bg: base.bg,
    text: base.text,
    border: base.border,
    lightBg: base.lightBg,
    lightText: base.lightText,
    lightBorder: base.lightBorder,
  };
}

// ── User-defined categories ────────────────────────────────────────────────
// The static map above cannot hold categories the user creates at runtime, so
// they get a stable style derived from their name. Deterministic = the same
// category always looks the same, with no persistence needed.

// Tailwind classes are extracted by a BUILD-TIME scanner. A template literal
// like `bg-${tone}-500/15` is never seen by it, so the rule would not exist in
// the stylesheet. Every class below is written out in full, literally.
const CUSTOM_PALETTE: Array<CategoryStyle & { lightBg: string; lightText: string; lightBorder: string }> = [
  { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/20',  lightBg: 'bg-violet-500/10',  lightText: 'text-violet-600',  lightBorder: 'border-violet-500/30' },
  { bg: 'bg-sky-500/15',     text: 'text-sky-400',     border: 'border-sky-500/20',     lightBg: 'bg-sky-500/10',     lightText: 'text-sky-600',     lightBorder: 'border-sky-500/30' },
  { bg: 'bg-teal-500/15',    text: 'text-teal-400',    border: 'border-teal-500/20',    lightBg: 'bg-teal-500/10',    lightText: 'text-teal-600',    lightBorder: 'border-teal-500/30' },
  { bg: 'bg-lime-500/15',    text: 'text-lime-400',    border: 'border-lime-500/20',    lightBg: 'bg-lime-500/10',    lightText: 'text-lime-600',    lightBorder: 'border-lime-500/30' },
  { bg: 'bg-indigo-500/15',  text: 'text-indigo-400',  border: 'border-indigo-500/20',  lightBg: 'bg-indigo-500/10',  lightText: 'text-indigo-600',  lightBorder: 'border-indigo-500/30' },
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', lightBg: 'bg-fuchsia-500/10', lightText: 'text-fuchsia-600', lightBorder: 'border-fuchsia-500/30' },
  { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/20',  lightBg: 'bg-orange-500/10',  lightText: 'text-orange-600',  lightBorder: 'border-orange-500/30' },
  { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/20',    lightBg: 'bg-blue-500/10',    lightText: 'text-blue-600',    lightBorder: 'border-blue-500/30' },
];
const customCache = new Map<string, CategoryStyle & { lightBg: string; lightText: string; lightBorder: string }>();

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function generatedStyle(category: string) {
  if (!category) return null;
  const hit = customCache.get(category);
  if (hit) return hit;
  const style = CUSTOM_PALETTE[hashName(category) % CUSTOM_PALETTE.length];
  customCache.set(category, style);
  return style;
}

/**
 * Register the user's categories so every consumer of getCategoryStyle() renders
 * them with a real colour instead of the grey 'Other' fallback. Called by
 * SettingsPage once it hydrates customCategories from the main process.
 */
export function registerCustomCategories(names: string[] | undefined | null): string[] {
  if (!Array.isArray(names)) return [...customCache.keys()];
  const next: string[] = [];
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name || CATEGORY_COLORS[name]) continue;
    generatedStyle(name);
    next.push(name);
  }
  return next;
}

export function getCustomCategoryNames(): string[] {
  return [...customCache.keys()];
}

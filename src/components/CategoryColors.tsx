export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
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

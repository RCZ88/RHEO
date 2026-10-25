import type { GroupAccent, MemoryGroup } from './types';

export const GROUP_ACCENTS: Record<GroupAccent, string> = {
  rose:    'var(--color-mem-400)',   // #e879a0
  amber:   'var(--color-clay-400)',  // #f59e0b
  emerald: '#10b981',
  blue:    '#3b82f6',
  violet:  '#8b5cf6',
  pink:    '#ec4899',
  teal:    '#14b8a6',
  orange:  '#f97316',
};

export const ACCENT_ORDER: GroupAccent[] =
  ['rose', 'amber', 'emerald', 'blue', 'violet', 'pink', 'teal', 'orange'];

export function nextAccent(existing: MemoryGroup[]): GroupAccent {
  const used = new Map<GroupAccent, number>();
  for (const g of existing) used.set(g.accent, (used.get(g.accent) ?? 0) + 1);
  return ACCENT_ORDER.reduce((best, a) =>
    (used.get(a) ?? 0) < (used.get(best) ?? 0) ? a : best, 'rose');
}

export function accentFor(name: string): GroupAccent {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ACCENT_ORDER[Math.abs(h) % ACCENT_ORDER.length];
}
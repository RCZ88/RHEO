import type { WarmColorKey } from './types';

export const WARM_COLORS: Record<WarmColorKey, { hex: string; text: string; bg: string; border: string; ring: string }> = {
  clay:  { hex: '#e8866b', text: 'text-[var(--color-clay-400)]', bg: 'bg-[var(--color-clay-500-15)]', border: 'border-[var(--color-clay-500)]/30', ring: 'stroke-[#e8866b]' },
  sage:  { hex: '#6fb38f', text: 'text-[#6fb38f]', bg: 'bg-[#6fb38f]/15', border: 'border-[#6fb38f]/30', ring: 'stroke-[#6fb38f]' },
  amber: { hex: '#fbbf24', text: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/15', border: 'border-[#fbbf24]/30', ring: 'stroke-[#fbbf24]' },
  sky:   { hex: '#5ab0c9', text: 'text-[#5ab0c9]', bg: 'bg-[#5ab0c9]/15', border: 'border-[#5ab0c9]/30', ring: 'stroke-[#5ab0c9]' },
};

export const WARM_COLOR_KEYS: WarmColorKey[] = ['clay', 'sage', 'amber', 'sky'];

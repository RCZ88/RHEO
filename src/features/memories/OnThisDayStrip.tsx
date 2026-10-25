import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { LoadedMemory } from './useMemories';

interface OnThisDayStripProps {
  items: LoadedMemory[];
  onOpen: (memory: LoadedMemory) => void;
}

export function OnThisDayStrip({ items, onOpen }: OnThisDayStripProps) {
  if (items.length === 0) return null;

  // At most two strips (two most recent years)
  const byYear = new Map<string, LoadedMemory[]>();
  for (const m of items) {
    const year = (m.meta.date || '').slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(m);
  }
  const years = [...byYear.keys()].sort().reverse().slice(0, 2);

  return (
    <div className="space-y-3">
      {years.map(year => {
        const yearItems = byYear.get(year) || [];
        const now = new Date();
        const yearsAgo = now.getFullYear() - Number(year);
        return (
          <motion.div
            key={year}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-xl border border-[var(--color-mem-400)]/25 bg-[var(--color-mem-400)]/[0.06] p-3"
          >
            <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-[var(--color-mem-400)]">
              <Clock className="w-3.5 h-3.5" />
              {yearsAgo} {yearsAgo === 1 ? 'year' : 'years'} ago today
              <span className="font-['JetBrains_Mono'] text-[10px] text-[var(--text-muted)] ml-1">
                {year}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto ws-scroll pb-1">
              {yearItems.map(m => (
                <button
                  key={m.meta.id}
                  onClick={() => onOpen(m)}
                  className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-zinc-700/40 hover:border-[var(--color-mem-400)]/40 transition-colors"
                >
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
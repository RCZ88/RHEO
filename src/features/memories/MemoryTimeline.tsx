import { motion } from 'framer-motion';
import type { LoadedMemory } from './useMemories';

interface MemoryTimelineProps {
  groups: [string, LoadedMemory[]][];
  onOpen: (memory: LoadedMemory) => void;
}

function monthLabel(key: string): string {
  if (key === 'Undated') return 'Undated';
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const groupInitial = { opacity: 0, y: 16 };
const groupWhileInView = { opacity: 1, y: 0 };
const groupViewport = { once: true, margin: '-10%' };
const groupTransition = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };

export function MemoryTimeline({ groups, onOpen }: MemoryTimelineProps) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-[var(--color-mem-400)]/40 via-zinc-700/40 to-transparent" />
      <div className="space-y-8">
        {groups.map(([key, items]) => (
          <motion.div
            key={key}
            initial={groupInitial}
            whileInView={groupWhileInView}
            viewport={groupViewport}
            transition={groupTransition}
            className="relative"
          >
            <div className="absolute -left-6 top-1 w-[19px] h-[19px] rounded-full bg-zinc-950 light:bg-[var(--ws-surface)] border-2 border-[var(--color-mem-400)]/50 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-mem-400)]" />
            </div>
            <h3 className="warmth-serif text-[15px] text-[var(--text-primary)] mb-3">{monthLabel(key)}</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {items.map(m => (
                <button
                  key={m.meta.id}
                  onClick={() => onOpen(m)}
                  className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800/50 hover:border-[var(--color-mem-400)]/40 transition-colors"
                >
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

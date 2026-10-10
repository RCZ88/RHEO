import { motion } from 'framer-motion';
import type { LoadedMemory } from './useMemories';
import { MemoryCard } from './MemoryCard';

interface MemoryCollageGridProps {
  items: LoadedMemory[];
  onOpen: (memory: LoadedMemory) => void;
}

const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const tileVariants = { hidden: { opacity: 0, y: 10, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } };

export function MemoryCollageGrid({ items, onOpen }: MemoryCollageGridProps) {
  return (
    <motion.div
      className="grid grid-cols-3 sm:grid-cols-4 gap-2 auto-rows-[minmax(0,1fr)]"
      initial="hidden"
      animate="show"
      variants={gridVariants}
    >
      {items.map((m, i) => {
        /* Feature a photo for a REASON. `i % 7` was positional: nothing about
           the 7th photo earned double size. A photo earns the large tile when
           it is the FIRST from its month, so the collage reads as a calendar
           rather than a lottery. */
        const month = (m.meta.date || '').slice(0, 7);
        const prev = items[i - 1];
        const prevMonth = prev ? (prev.meta.date || '').slice(0, 7) : null;
        const big = month !== '' && month !== prevMonth && i < items.length - 1;
        return (
          <motion.div
            key={m.meta.id}
            variants={tileVariants}
            className={big ? 'col-span-2 row-span-2' : ''}
          >
            <MemoryCard memory={m} onOpen={() => onOpen(m)} span={big ? 'lg' : 'sm'} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

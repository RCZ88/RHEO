import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Feather, Shuffle } from 'lucide-react';
import { WarmCard } from '../warmth/WarmCard';
import { getPromptForDate, listPromptPacks } from './prompts';
import { todayStr } from './storage';

interface ReflectionPromptCardProps {
  onReflect: (promptText: string) => void;
}

const textMotion = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

export function ReflectionPromptCard({ onReflect }: ReflectionPromptCardProps) {
  const packs = useMemo(() => listPromptPacks(), []);
  const [packId, setPackId] = useState(packs[0]?.id);
  const prompt = useMemo(() => getPromptForDate(todayStr(), packId), [packId]);

  return (
    <WarmCard ambient className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          <Feather className="w-3.5 h-3.5 text-[var(--color-clay-400)]" />
          Today's reflection - {prompt.source}
        </div>
        {packs.length > 1 && (
          <button
            onClick={() => {
              const idx = packs.findIndex(p => p.id === packId);
              setPackId(packs[(idx + 1) % packs.length].id);
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            title="Switch prompt source"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <motion.p
        key={prompt.id}
        initial={textMotion.initial}
        animate={textMotion.animate}
        transition={textMotion.transition}
        className="warmth-serif text-[17px] leading-relaxed text-[var(--text-primary)]"
      >
        {prompt.text}
      </motion.p>
      <button
        onClick={() => onReflect(prompt.text)}
        className="mt-3 text-[12px] text-[var(--color-clay-400)] hover:text-[#f0a892] transition-colors"
      >
        Write about this &rarr;
      </button>
    </WarmCard>
  );
}

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, RefreshCw, X } from 'lucide-react';
import { loadJournal, todayStr } from './storage';

function daysAgoLabel(dateStr: string): string {
  const then = new Date(dateStr + 'T00:00:00').getTime();
  const now = new Date(todayStr() + 'T00:00:00').getTime();
  const days = Math.round((now - then) / 86400000);
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'a week ago';
  if (days < 45) return `${Math.round(days / 7)} weeks ago`;
  if (days < 400) return `${Math.round(days / 30)} months ago`;
  return 'a while ago';
}

const enter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

export function ReflectionEcho() {
  const past = useMemo(() => {
    const today = todayStr();
    return loadJournal()
      .filter(j => j.text && j.text.trim().length > 12 && j.date !== today)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (past.length === 0 || dismissed) return null;
  const entry = past[idx % past.length];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={entry.date}
        initial={enter.initial}
        animate={enter.animate}
        exit={enter.exit}
        transition={enter.transition}
        className="relative overflow-hidden rounded-xl border border-[var(--color-mem-400)]/20 bg-[var(--color-mem-400)]/[0.05] p-4"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--color-mem-400)]">
            <Quote className="w-3.5 h-3.5" />
            {daysAgoLabel(entry.date)}, you wrote
          </div>
          <div className="flex items-center gap-1">
            {past.length > 1 && (
              <button
                onClick={() => setIdx(i => i + 1)}
                title="Show another"
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              title="Dismiss"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="warmth-serif text-[15px] leading-relaxed text-[var(--text-primary)] line-clamp-4">
          {entry.text}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

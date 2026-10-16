import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sunrise } from 'lucide-react';
import { pickGraceLine } from './covenantCopy';

interface GraceResetMomentProps {
  commitmentId: string;
  commitmentName: string;
  onDone: () => void;
}

const wrapMotion = {
  initial: { opacity: 0, height: 0, y: -8 },
  animate: { opacity: 1, height: 'auto', y: 0 },
  exit: { opacity: 0, height: 0, y: -8 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

const glowStyle = {
  background: 'radial-gradient(60% 60% at 20% 0%, rgba(232,134,107,0.35), transparent 70%)',
};
const glowMotion = {
  initial: { opacity: 0 },
  animate: { opacity: [0, 1, 0.4] },
  transition: { duration: 1.4, ease: 'easeOut' as const },
};

export function GraceResetMoment({ commitmentId, commitmentName, onDone }: GraceResetMomentProps) {
  const reduce = useReducedMotion();
  const line = pickGraceLine(commitmentId + commitmentName);

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        initial={wrapMotion.initial}
        animate={wrapMotion.animate}
        exit={wrapMotion.exit}
        transition={wrapMotion.transition}
        className="relative overflow-hidden rounded-xl border border-[var(--color-clay-500)]/25 bg-[var(--color-clay-500)]/[0.06] p-4 mb-3"
      >
        {!reduce && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={glowStyle}
            initial={glowMotion.initial}
            animate={glowMotion.animate}
            transition={glowMotion.transition}
          />
        )}
        <div className="relative z-10 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-clay-500-15)] flex items-center justify-center text-[var(--color-clay-400)] shrink-0">
            <Sunrise className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="warmth-serif text-[14px] text-[var(--text-primary)] leading-snug">{line}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{commitmentName} - total practice stays exactly as it was</p>
          </div>
          <button
            onClick={onDone}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

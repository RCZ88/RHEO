import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { celebrateMilestone } from '../warmth/celebrate';
import { milestoneLine } from './covenantCopy';

interface MilestoneCelebrationProps {
  commitmentName: string;
  milestone: number;
  onClose: () => void;
}

const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } };
const cardMotion = {
  initial: { opacity: 0, scale: 0.9, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: 6 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
};
const auroraStyle = { opacity: 0.12 };
const badgeTransition = { duration: 0.6, ease: 'easeOut' as const };

export function MilestoneCelebration({ commitmentName, milestone, onClose }: MilestoneCelebrationProps) {
  const reduce = useReducedMotion();
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    celebrateMilestone(badgeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={overlayMotion.initial}
        animate={overlayMotion.animate}
        exit={overlayMotion.initial}
        transition={overlayMotion.transition}
        onClick={onClose}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={cardMotion.initial}
          animate={cardMotion.animate}
          exit={cardMotion.exit}
          transition={cardMotion.transition}
          className="relative max-w-sm w-full rounded-xl border border-[#fbbf24]/30 bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-6 text-center overflow-hidden"
        >
          <div className="warmth-aurora" style={auroraStyle} />
          <motion.div
            ref={badgeRef}
            className="relative z-10 mx-auto mb-4 w-16 h-16 rounded-full bg-[#fbbf24]/15 border border-[#fbbf24]/30 flex items-center justify-center"
            animate={reduce ? undefined : { rotate: [0, -8, 8, -4, 0] }}
            transition={badgeTransition}
          >
            <Sparkles className="w-7 h-7 text-[#fbbf24]" />
          </motion.div>
          <p className="relative z-10 text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{commitmentName}</p>
          <h3 className="relative z-10 warmth-serif text-xl text-[var(--text-primary)] mb-2">{milestone} days</h3>
          <p className="relative z-10 text-[13px] text-[var(--text-secondary)] leading-relaxed">{milestoneLine(milestone)}</p>
          <button
            onClick={onClose}
            className="relative z-10 mt-5 px-5 py-2 rounded-lg bg-[#fbbf24]/15 text-[#fbbf24] text-xs font-medium hover:bg-[#fbbf24]/25 transition-colors"
          >
            Keep going
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

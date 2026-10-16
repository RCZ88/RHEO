import { motion } from 'framer-motion';
import { PHASE_NAMES } from '../../../types/resume';
import { Rocket, Briefcase, FolderOpen, Code2, TrendingUp, Search, FileText } from 'lucide-react';

interface PhaseNavigatorProps {
  currentPhase: number;
  phaseStatus: Record<number, string>;
  onPhaseClick: (phase: number) => void;
  phaseCompletion?: Record<number, number>;
}

const phaseIcons: Record<number, any> = {
  1: Rocket,
  2: Briefcase,
  3: FolderOpen,
  4: Code2,
  5: TrendingUp,
  6: Search,
  7: FileText,
};

export function PhaseNavigator({ currentPhase, phaseStatus, onPhaseClick, phaseCompletion }: PhaseNavigatorProps) {
  const getCompletionDot = (phase: number) => {
    const status = phaseStatus[phase] || 'locked';
    const completion = phaseCompletion?.[phase] || 0;

    if (status === 'complete') return 'bg-emerald-400';
    if (completion >= 50) return 'bg-emerald-400';
    if (completion > 0) return 'bg-amber-400';
    if (status === 'in_progress') return 'bg-amber-400';
    return 'bg-zinc-600';
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
      {Array.from({ length: 7 }, (_, i) => {
        const phase = i + 1;
        const status = phaseStatus[phase] || 'locked';
        const isActive = phase === currentPhase;
        const Icon = phaseIcons[phase] || FileText;
        const dotColor = getCompletionDot(phase);

        return (
          <motion.button
            key={phase}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPhaseClick(phase)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              isActive
                ? 'bg-[var(--page-accent-20)] text-[var(--page-accent)] ring-1 ring-[var(--page-accent)]/30'
                : status === 'complete'
                ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15'
                : 'bg-zinc-800/50 text-zinc-400 ring-1 ring-zinc-700/30 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span className="hidden sm:inline">{PHASE_NAMES[phase]?.split(' ')[0]}</span>
            <span className="sm:hidden">{phase}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          </motion.button>
        );
      })}
    </div>
  );
}

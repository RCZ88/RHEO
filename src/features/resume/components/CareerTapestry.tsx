import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Briefcase, FolderOpen, Code2, TrendingUp, Search, FileText } from 'lucide-react';

interface CareerTapestryProps {
  phaseStatus: Record<number, 'locked' | 'in_progress' | 'complete'>;
  currentPhase: number;
  onPhaseClick?: (phase: number) => void;
  compact?: boolean;
}

const phaseIcons: Record<number, any> = {
  1: Rocket, 2: Briefcase, 3: FolderOpen, 4: Code2,
  5: TrendingUp, 6: Search, 7: FileText,
};

const phaseLabels: Record<number, string> = {
  1: 'Foundation', 2: 'Experience', 3: 'Projects', 4: 'Skills',
  5: 'Impact', 6: 'Objective', 7: 'Assembly',
};

export function CareerTapestry({ phaseStatus, currentPhase, onPhaseClick, compact = false }: CareerTapestryProps) {
  const total = 7;
  const completedCount = Object.values(phaseStatus).filter(s => s === 'complete').length;
  const allComplete = completedCount === total;
  const hasStarted = Object.keys(phaseStatus).length > 0 && (completedCount > 0 || phaseStatus[currentPhase]);

  const getNodeState = (phase: number) => phaseStatus[phase] || 'locked';
  const isNodeActive = (phase: number) => phase === currentPhase;
  const isNodeComplete = (phase: number) => getNodeState(phase) === 'complete';
  const isNodeLocked = (phase: number) => getNodeState(phase) === 'locked';

  const nodeSize = compact ? 32 : 48;
  const iconSize = compact ? 14 : 20;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-zinc-800/60 ${compact ? 'px-4 py-2' : 'px-6 py-6'}`}
      style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(251, 191, 36, 0.04) 50%, rgba(99, 102, 241, 0.02) 100%)' }}
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-[10%] w-[200px] h-[200px] bg-[var(--page-accent-5)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-[20%] w-[150px] h-[150px] bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      {/* Empty state */}
      {!hasStarted && !compact && (
        <div className="relative z-10 flex flex-col items-center justify-center py-6">
          <p className="text-sm text-zinc-400 mb-3">Your career journey awaits</p>
          {onPhaseClick && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPhaseClick(1)}
              className="px-5 py-2 rounded-lg bg-[var(--page-accent-20)] text-[var(--page-accent)] font-medium text-sm hover:bg-[var(--page-accent-30)] transition-colors border border-[var(--page-accent)]/20"
            >
              Begin Journey
            </motion.button>
          )}
        </div>
      )}

      {/* Tapestry content */}
      {hasStarted && (
        <div className="relative">
          {/* Nodes row */}
          <div className="flex items-center justify-between relative" style={{ height: compact ? '40px' : '60px' }}>
            {Array.from({ length: total }, (_, i) => {
              const phase = i + 1;
              const state = getNodeState(phase);
              const active = isNodeActive(phase);
              const complete = isNodeComplete(phase);
              const locked = isNodeLocked(phase);
              const Icon = phaseIcons[phase] || FileText;

              return (
                <div key={phase} className="flex-1 flex flex-col items-center justify-center relative" style={{ minWidth: 0 }}>
                  <motion.button
                    whileHover={onPhaseClick && !locked ? { scale: 1.12, y: -2 } : undefined}
                    whileTap={onPhaseClick && !locked ? { scale: 0.95 } : undefined}
                    onClick={() => !locked && onPhaseClick?.(phase)}
                    disabled={locked}
                    className={`relative flex items-center justify-center rounded-full transition-all duration-200 ${
                      locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      width: active && !compact ? nodeSize + 6 : nodeSize,
                      height: active && !compact ? nodeSize + 6 : nodeSize,
                      background: complete
                        ? 'radial-gradient(circle, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.1) 60%, #0c0c10 100%)'
                        : active
                        ? 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.1) 60%, #0c0c10 100%)'
                        : '#0c0c10',
                      border: `2px solid ${complete ? 'rgba(251,191,36,0.6)' : active ? 'rgba(99,102,241,0.6)' : '#3f3f46'}`,
                      boxShadow: complete
                        ? '0 0 16px rgba(251,191,36,0.3), inset 0 0 8px rgba(251,191,36,0.1)'
                        : active
                        ? '0 0 16px rgba(99,102,241,0.4), inset 0 0 8px rgba(99,102,241,0.1)'
                        : 'none',
                    }}
                  >
                    {/* Pulse ring for active */}
                    {active && !compact && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-[var(--page-accent)]/30"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    <Icon
                      size={iconSize}
                      className={complete ? 'text-amber-400' : active ? 'text-[var(--page-accent)]' : 'text-zinc-600'}
                    />

                    {/* Checkmark for complete */}
                    {complete && !compact && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border border-zinc-900">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </motion.button>

                  {/* Label */}
                  {!compact && (
                    <span className={`mt-2 text-[10px] font-medium uppercase tracking-wider text-center truncate w-full px-1 ${
                      complete ? 'text-amber-400' : active ? 'text-[var(--page-accent)]' : 'text-zinc-600'
                    }`}>
                      {phaseLabels[phase]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confetti */}
      <AnimatePresence>
        {allComplete && !compact && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {Array.from({ length: 24 }, (_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-sm"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: '50%',
                  backgroundColor: ['#fbbf24', '#6366f1', '#34d399', '#f472b6', '#38bdf8'][i % 5],
                }}
                initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
                animate={{
                  y: -100 - Math.random() * 80,
                  x: (Math.random() - 0.5) * 200,
                  opacity: 0,
                  rotate: Math.random() * 720 - 360,
                  scale: 0,
                }}
                transition={{ duration: 1.5 + Math.random(), delay: i * 0.03, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

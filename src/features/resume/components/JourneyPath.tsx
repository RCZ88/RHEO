import { useNavigate } from 'react-router-dom';
import { Upload, Rocket, Eye, Download, CheckCircle, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface JourneyPathProps {
  versionsCount: number;
  hasBuilderProgress: boolean;
}

const steps = [
  { key: 'import', label: 'Import', desc: 'Extract from chats & docs', path: '/resume/import', icon: Upload, color: 'emerald' as const, from: 'from-emerald-500/20', to: 'to-emerald-600/5', ring: 'ring-emerald-500/30', text: 'text-emerald-400' },
  { key: 'build', label: 'Build', desc: 'Answer questions with AI', path: '/resume/build', icon: Rocket, color: 'indigo' as const, from: 'from-[var(--page-accent)]/20', to: 'to-indigo-600/5', ring: 'ring-[var(--page-accent)]/30', text: 'text-[var(--page-accent)]' },
  { key: 'preview', label: 'Preview', desc: 'See your live resume', path: '/resume/preview', icon: Eye, color: 'blue' as const, from: 'from-blue-500/20', to: 'to-blue-600/5', ring: 'ring-blue-500/30', text: 'text-blue-400' },
  { key: 'export', label: 'Export', desc: 'PDF, Markdown, JSON', path: '/resume/export', icon: Download, color: 'amber' as const, from: 'from-amber-500/20', to: 'to-amber-600/5', ring: 'ring-amber-500/30', text: 'text-amber-400' },
];

export function JourneyPath({ versionsCount, hasBuilderProgress }: JourneyPathProps) {
  const navigate = useNavigate();

  const getStepStatus = (key: string) => {
    if (key === 'import') return versionsCount > 0 ? 'done' : 'available';
    if (key === 'build') return hasBuilderProgress ? 'done' : 'available';
    if (key === 'preview') return versionsCount > 0 ? 'available' : 'locked';
    if (key === 'export') return versionsCount > 0 ? 'available' : 'locked';
    return 'locked';
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Your Journey</h3>
      <div className="flex items-stretch gap-3">
        {steps.map((step, i) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;
          const isLocked = status === 'locked';
          const isDone = status === 'done';

          return (
            <div key={step.key} className="flex items-stretch gap-3 flex-1">
              <motion.button
                whileHover={!isLocked ? { y: -3 } : undefined}
                whileTap={!isLocked ? { scale: 0.97 } : undefined}
                onClick={() => !isLocked && navigate(step.path)}
                disabled={isLocked}
                className={`relative overflow-hidden flex-1 rounded-xl border p-4 text-left transition-all duration-200 ${
                  isLocked
                    ? 'border-zinc-800/40 opacity-40 cursor-not-allowed bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]'
                    : isDone
                    ? `border-${step.color}-500/30 bg-gradient-to-br ${step.from} ${step.to} backdrop-blur-xl cursor-pointer hover:border-${step.color}-500/50`
                    : `border-zinc-800/60 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl cursor-pointer hover:border-[var(--page-accent)]/30`
                }`}
              >
                {/* Status glow for done */}
                {isDone && (
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-${step.color}-500/10 rounded-full blur-2xl pointer-events-none`} />
                )}

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDone ? `bg-${step.color}-500/15 ring-1 ${step.ring}` : 'bg-zinc-800/50 ring-1 ring-zinc-700/30'
                    }`}>
                      {isDone ? (
                        <CheckCircle className={`w-5 h-5 ${step.text}`} />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4 text-zinc-600" />
                      ) : (
                        <Icon className={`w-5 h-5 ${step.text}`} />
                      )}
                    </div>
                    {!isLocked && (
                      <ArrowRight className={`w-4 h-4 ${isDone ? step.text : 'text-zinc-600'}`} />
                    )}
                  </div>
                  <p className={`text-sm font-semibold mb-0.5 ${isDone ? 'text-white' : 'text-zinc-300'}`}>{step.label}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{step.desc}</p>
                </div>
              </motion.button>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex items-center">
                  <div className={`w-6 h-px ${isDone ? 'bg-gradient-to-r from-emerald-500/50 to-zinc-700' : 'bg-zinc-800'}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { SectionHeader } from '../SectionHeader';

interface MasteryRingMiniProps {
  mastered?: number;
  total?: number;
}

export function MasteryRingMini({ mastered = 0, total = 1 }: MasteryRingMiniProps) {
  const pct = Math.round((mastered / Math.max(total, 1)) * 100);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference * (1 - mastered / Math.max(total, 1));

  return (
    <div className="relative rounded-xl overflow-hidden
      bg-[rgba(24,24,27,0.80)] backdrop-blur-xl
      border border-[rgba(63,63,70,0.50)] p-5
      hover:border-[rgba(82,82,91,0.80)] transition-all duration-250 h-full">

      <div className="absolute top-0 left-4 right-4 h-px
        bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-60 pointer-events-none" />

      <SectionHeader title="Mastery" icon={<Brain size={14} />} />

      <div className="flex items-center gap-4 mt-2">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#27272a" strokeWidth="4" />
            <motion.circle
              cx="32" cy="32" r="28" fill="none"
              stroke="url(#masteryGradient)" strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            />
            <defs>
              <linearGradient id="masteryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[13px] font-mono font-bold text-cyan-400">{pct}%</span>
          </div>
        </div>

        <div>
          <div className="text-[13px] text-zinc-300">
            <span className="font-mono font-bold text-cyan-400">{mastered}</span>
            <span className="text-zinc-600"> / {total}</span> nodes
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Proficiency level &ge; 4</div>
        </div>
      </div>
    </div>
  );
}

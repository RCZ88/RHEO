// RHEO Dashboard — Learn Widget
// 3×2 widget showing learn stats from Lyceum
// LAMINAR: solid token surface, hairline, radius 10
import { motion } from 'motion/react';
import { BookOpen, Target, Clock } from 'lucide-react';

interface LearnWidgetProps {
  stats?: {
    dueCount: number;
    masteryPercent: number;
    streak: number;
    nextLesson: string | null;
  };
  loading?: boolean;
  error?: string | null;
}

export function LearnWidget({ stats, loading, error }: LearnWidgetProps) {
  const dueCount = stats?.dueCount ?? 0;
  const masteryPercent = stats?.masteryPercent ?? 0;
  const streak = stats?.streak ?? 0;
  const nextLesson = stats?.nextLesson ?? null;

  if (loading) {
    return (
      <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-20 rounded bg-zinc-800" />
        <div className="flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <BookOpen size={14} />
          <span>Learn</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[12px] text-zinc-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full relative">
      <div className="absolute top-0 left-[2px] right-[2px] h-[1px] -z-10 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent rounded-t-[10px]" />
      <div className="absolute inset-0 -z-10 rounded-[10px] pointer-events-none" style={{
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 0 rgba(0,0,0,0.2)',
      }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <BookOpen size={14} className="text-amber-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">Learn</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Due</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{dueCount}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Mastery</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{masteryPercent}%</div>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Streak</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{streak}d</div>
        </div>
      </div>

      {nextLesson && (
        <div className="pt-2 border-t border-[var(--ws-border)]">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={10} className="text-amber-400" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Next</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={10} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-300 truncate">{nextLesson}</span>
          </div>
        </div>
      )}
    </div>
  );
}

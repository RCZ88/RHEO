import * as Icons from 'lucide-react';
import type { StreakStats } from './types';

interface TotalPracticeStatProps {
  stats: StreakStats;
}

export function TotalPracticeStat({ stats }: TotalPracticeStatProps) {
  const Icon = Icons.Flame;
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      <div className="text-center py-2 rounded-lg bg-zinc-800/40">
        <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">
          <Icon className="w-3.5 h-3.5 text-[var(--color-clay-400)]" />
          {stats.current}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Current</div>
      </div>
      <div className="text-center py-2 rounded-lg bg-zinc-800/40">
        <div className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{stats.longest}</div>
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Longest</div>
      </div>
      <div className="text-center py-2 rounded-lg bg-zinc-800/40">
        <div className="text-lg font-bold tabular-nums text-[var(--color-mem-400)]">{stats.totalCompletions}</div>
        <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Total practice</div>
      </div>
    </div>
  );
}

import { Target } from 'lucide-react';
import { MetricCard } from './ai/MetricCard';

interface ContextSummaryCardProps {
  unfinishedCount: number;
  completedThisWeek: number;
  weeklyTotal?: number;
  loading?: boolean;
  error?: string | null;
  updatedAt?: number;
  onRefresh?: () => void;
}

const circumference = 2 * Math.PI * 22;

export function ContextSummaryCard({ unfinishedCount, completedThisWeek, weeklyTotal = 0, loading, error, updatedAt = Date.now(), onRefresh }: ContextSummaryCardProps) {
  const ratio = weeklyTotal > 0 ? completedThisWeek / weeklyTotal : 0;
  const strokeDashoffset = circumference * (1 - Math.min(ratio, 1));
  const pct = Math.round(ratio * 100);

  return (
    <MetricCard
      accent="amber"
      icon={Target}
      label="Context"
      value={completedThisWeek}
      valueUnit={weeklyTotal > 0 ? `/ ${weeklyTotal} this week` : 'done this week'}
      valueFormatter={(n) => `${n}`}
      loading={!!loading}
      error={error}
      updatedAt={updatedAt}
      onRefresh={onRefresh}
    >
      <div className="flex items-center gap-3">
        <svg className="w-12 h-12 -rotate-90 shrink-0" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="22" fill="none" stroke="#3f3f46" strokeWidth="4" />
          <circle
            cx="25" cy="25" r="22" fill="none"
            stroke="#f59e0b"
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 400ms ease' }}
          />
        </svg>
        <div className="text-[11px] text-zinc-500">
          <span className="tabular-nums text-zinc-300 font-medium">{unfinishedCount}</span> pending
        </div>
      </div>
    </MetricCard>
  );
}

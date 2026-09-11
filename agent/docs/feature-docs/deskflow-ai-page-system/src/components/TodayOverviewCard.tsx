import { Clock } from 'lucide-react';
import { MetricCard } from './ai/MetricCard';

interface TodayOverviewCardProps {
  totalSeconds: number;
  sessionCount: number;
  topApp?: string;
  loading?: boolean;
  error?: string | null;
  updatedAt?: number;
  onRefresh?: () => void;
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function TodayOverviewCard({ totalSeconds, sessionCount, topApp, loading, error, updatedAt = Date.now(), onRefresh }: TodayOverviewCardProps) {
  return (
    <MetricCard
      accent="pink"
      icon={Clock}
      label="Tracked today"
      value={Math.floor(totalSeconds / 60)}
      valueUnit="minutes"
      valueFormatter={() => fmtDuration(totalSeconds)}
      loading={!!loading}
      error={error}
      updatedAt={updatedAt}
      onRefresh={onRefresh}
    >
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span>{sessionCount} sessions</span>
        {topApp && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="truncate max-w-[120px]">{topApp}</span>
          </>
        )}
      </div>
    </MetricCard>
  );
}

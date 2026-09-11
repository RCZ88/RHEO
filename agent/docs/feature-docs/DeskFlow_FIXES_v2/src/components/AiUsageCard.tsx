import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { MetricCard } from './ai/MetricCard';

interface AiUsageCardProps {
  totalTokens: number;
  totalCost: number;
  toolCount: number;
  topTool?: string;
  trendPct?: number;
  loading?: boolean;
  error?: string | null;
  updatedAt?: number;
  onRefresh?: () => void;
}

const fmtTokens = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};

export function AiUsageCard({ totalTokens, totalCost, toolCount, topTool, trendPct, loading, error, updatedAt = Date.now(), onRefresh }: AiUsageCardProps) {
  return (
    <MetricCard
      accent="violet"
      icon={Zap}
      label="AI usage"
      value={totalTokens}
      valueFormatter={fmtTokens}
      loading={!!loading}
      error={error}
      updatedAt={updatedAt}
      onRefresh={onRefresh}
    >
      <div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
        <span className="tabular-nums">${totalCost.toFixed(4)}</span>
        {toolCount > 0 && (
          <>
            <span className="text-zinc-700">·</span>
            <span>{toolCount} tools</span>
          </>
        )}
        {trendPct !== undefined && trendPct !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${trendPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendPct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(trendPct)}%
          </span>
        )}
      </div>
      {/* Mini bar chart for top tools */}
      {topTool && (
        <div className="mt-2 flex items-end gap-[2px] h-6">
          {Array.from({ length: 5 }).map((_, i) => {
            const h = 20 - i * 3;
            return (
              <div
                key={i}
                className="w-2.5 rounded-t-sm"
                style={{
                  height: `${Math.max(4, h)}px`,
                  background: i === 0
                    ? 'linear-gradient(to top, rgba(167,139,250,0.6), rgba(244,114,182,0.4))'
                    : `rgba(167,139,250,${0.15 - i * 0.025})`,
                }}
              />
            );
          })}
        </div>
      )}
    </MetricCard>
  );
}

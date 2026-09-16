import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

interface CostTrackerProps {
  total: number
  daily: { date: string; cost: number }[]
  period: 'week' | 'month' | 'year'
  onPeriodChange: (period: 'week' | 'month' | 'year') => void
}

export function CostTracker({ total, daily, period, onPeriodChange }: CostTrackerProps) {
  const trend = daily.length >= 2
    ? ((daily[daily.length - 1].cost - daily[0].cost) / daily[0].cost) * 100
    : 0

  return (
    <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Cost Tracker</h3>
        <div className="flex gap-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`rounded-[6px] px-2 py-1 text-xs transition-colors duration-150 ${
                period === p
                  ? 'bg-[var(--page-accent)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-emerald-500/10">
          <DollarSign className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            ${total.toFixed(2)}
          </div>
          <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}% vs last {period}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-end gap-1">
        {daily.slice(-14).map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px] bg-[var(--page-accent)]/30 transition-all duration-200 hover:bg-[var(--page-accent)]/60"
            style={{ height: `${Math.max(4, (d.cost / Math.max(...daily.map(x => x.cost))) * 40)}px` }}
            title={`${d.date}: $${d.cost.toFixed(2)}`}
          />
        ))}
      </div>
    </div>
  )
}

import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

interface CostTrackerProps {
  total?: number
  daily?: { date: string; cost: number }[]
  period?: 'week' | 'month' | 'year'
  onPeriodChange?: (period: 'week' | 'month' | 'year') => void
}

const DEFAULT_DAILY = Array.from({ length: 7 }, (_, i) => ({
  date: `Day ${i + 1}`,
  cost: Math.floor(Math.random() * 50) + 10,
}))

export function CostTracker({
  total = 245.80,
  daily = DEFAULT_DAILY,
  period = 'week',
  onPeriodChange = () => {},
}: CostTrackerProps) {
  const trend = daily.length >= 2
    ? ((daily[daily.length - 1].cost - daily[0].cost) / daily[0].cost) * 100
    : 0
  const isPositive = trend > 0

  return (
    <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Cost Tracker</h3>
        <div className="flex gap-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`rounded-[6px] px-2 py-1 text-xs capitalize ${
                period === p
                  ? 'bg-[var(--page-accent)] text-[var(--text-muted)]'
                  : 'bg-transparent text-[var(--text-muted)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-[var(--page-accent)]" />
        <span className="text-xl font-semibold text-[var(--text-primary)]">${total.toFixed(2)}</span>
        {daily.length >= 2 && (
          <span className={`flex items-center gap-1 text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

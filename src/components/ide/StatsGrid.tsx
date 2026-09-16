import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: number
  trendLabel?: string
}

export function StatCard({ label, value, icon: Icon, trend, trendLabel }: StatCardProps) {
  const isPositive = trend && trend > 0
  const isNegative = trend && trend < 0

  return (
    <div
      className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4 transition-colors duration-200 hover:bg-[var(--color-card-sunken)]"
      tabIndex={0}
      role="img"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--page-accent)]/10">
          <Icon className="h-5 w-5 text-[var(--page-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
          <div className="text-xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              <span className={isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-[var(--text-muted)]'}>
                {isPositive ? '↑' : isNegative ? '↓' : '→'} {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-[var(--text-muted)]">{trendLabel}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface StatsGridProps {
  stats: StatCardProps[]
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}

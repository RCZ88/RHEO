import { useMemo } from 'react'

interface DayData {
  date: string
  count: number
}

interface CommitHeatmapProps {
  data: DayData[]
  weeks?: number
}

const INTENSITY_COLORS = [
  'bg-[var(--color-card-sunken)]',
  'bg-[var(--page-accent)]/20',
  'bg-[var(--page-accent)]/40',
  'bg-[var(--page-accent)]/60',
  'bg-[var(--page-accent)]/80',
]

function getIntensity(count: number): string {
  if (count === 0) return INTENSITY_COLORS[0]
  if (count <= 2) return INTENSITY_COLORS[1]
  if (count <= 5) return INTENSITY_COLORS[2]
  if (count <= 10) return INTENSITY_COLORS[3]
  return INTENSITY_COLORS[4]
}

export function CommitHeatmap({ data, weeks = 12 }: CommitHeatmapProps) {
  const totalCommits = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data])

  return (
    <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Commit Activity</h3>
        <span className="text-xs text-[var(--text-muted)]">{totalCommits} commits</span>
      </div>
      <div className="mt-4 flex gap-[2px] overflow-x-auto">
        {Array.from({ length: weeks }).map((_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((_, dayIdx) => {
              const dataIdx = weekIdx * 7 + dayIdx
              const day = data[dataIdx]
              return (
                <div
                  key={dayIdx}
                  className={`h-3 w-3 rounded-[2px] ${day ? getIntensity(day.count) : INTENSITY_COLORS[0]} transition-colors duration-150`}
                  title={day ? `${day.date}: ${day.count} commits` : 'No data'}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <span>Less</span>
        {INTENSITY_COLORS.map((color, i) => (
          <div key={i} className={`h-2 w-2 rounded-[2px] ${color}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

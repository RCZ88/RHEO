import { useRef, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler)

interface LanguageChartProps {
  data: { language: string; count: number; percentage: number }[]
}

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1']

export function LanguageChart({ data }: LanguageChartProps) {
  const chartData = {
    labels: data.map(d => d.language),
    datasets: [{
      data: data.map(d => d.count),
      backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 0,
      hoverOffset: 4,
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        titleColor: '#fafafa',
        bodyColor: '#a1a1aa',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const item = data[ctx.dataIndex]
            return `${item.language}: ${item.percentage}% (${item.count} files)`
          }
        }
      }
    }
  }

  return (
    <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)]">Language Breakdown</h3>
      <div className="mt-4 h-48">
        <Doughnut data={chartData} options={options} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.slice(0, 6).map((item, i) => (
          <div key={item.language} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-[var(--text-secondary)]">{item.language}</span>
            <span className="ml-auto tabular-nums text-[var(--text-muted)]">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

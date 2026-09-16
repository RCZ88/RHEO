import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface AIUsageChartProps {
  data: { date: string; tokens: number }[]
}

export function AIUsageChart({ data }: AIUsageChartProps) {
  const chartData = {
    labels: data.map(d => d.date),
    datasets: [{
      label: 'Tokens',
      data: data.map(d => d.tokens),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#06b6d4',
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        titleColor: '#fafafa',
        bodyColor: '#a1a1aa',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => `${ctx.parsed.y.toLocaleString()} tokens`
        }
      }
    },
    scales: {
      x: { display: false },
      y: { display: false }
    },
    interaction: { intersect: false, mode: 'index' }
  }

  return (
    <div className="rounded-[12px] border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">AI Usage</h3>
        <span className="text-xs text-[var(--text-muted)]">Last 30 days</span>
      </div>
      <div className="mt-4 h-32">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface AIUsageChartProps {
  data?: { date: string; tokens: number }[]
}

const DEFAULT_DATA = Array.from({ length: 30 }, (_, i) => ({
  date: `Day ${i + 1}`,
  tokens: Math.floor(Math.random() * 50000) + 10000,
}))

export function AIUsageChart({ data = DEFAULT_DATA }: AIUsageChartProps) {
  const chartData = useMemo(() => ({
    labels: data.map(d => d.date),
    datasets: [{
      label: 'Tokens',
      data: data.map(d => d.tokens),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    }],
  }), [data])

  return (
    <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--color-card)] p-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">AI Usage (Last 30 Days)</h3>
      <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
    </div>
  )
}

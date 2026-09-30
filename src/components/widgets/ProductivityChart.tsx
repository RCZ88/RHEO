import { WidgetCard, type WidgetCategory } from "./WidgetCard";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useState } from "react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CATEGORY: WidgetCategory = "analytics";

type Period = "7" | "14" | "30";

const COLORS = {
  productive: "rgba(236,72,153,0.7)",
  distracting: "rgba(251,191,36,0.55)",
  grid: "rgba(63,63,70,0.4)",
  text: "#a1a1aa",
};

const POWER_USERS = {
  "7": { label: "7D", days: 7 },
  "14": { label: "14D", days: 14 },
  "30": { label: "30D", days: 30 },
};

interface ProductivityChartProps {
  data: Array<{ date: string; productive: number; distracting: number }>;
}

export function ProductivityChart({ data }: ProductivityChartProps) {
  const [period, setPeriod] = useState<Period>("7");

  const labels = data.slice(0, POWER_USERS[period].days).map((d) => d.date);
  const productive = data.slice(0, POWER_USERS[period].days).map((d) => d.productive);
  const distracting = data.slice(0, POWER_USERS[period].days).map((d) => d.distracting);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Focus",
        data: productive,
        backgroundColor: COLORS.productive,
        borderColor: "transparent",
        borderWidth: 0,
        borderRadius: 2,
      },
      {
        label: "Distracted",
        data: distracting,
        backgroundColor: COLORS.distracting,
        borderColor: "transparent",
        borderWidth: 0,
        borderRadius: 2,
      },
    ],
  };

  const totalFocus = productive.reduce((a, b) => a + b, 0);
  const dailyAvg = totalFocus / Math.max(labels.length, 1);
  const bestDay = Math.max(...productive, 0);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "#18181b",
        titleColor: "#fafafa",
        bodyColor: "#a1a1aa",
        borderColor: "#3f3f46",
        borderWidth: 1,
        padding: 8,
        titleFont: { family: "JetBrains Mono", size: 11 },
        bodyFont: { family: "JetBrains Mono", size: 11 },
        displayColors: true,
        boxPadding: 4,
      },
      title: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: COLORS.text,
          font: { family: "JetBrains Mono", size: 10 },
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid: {
          color: COLORS.grid,
          drawBorder: false,
        },
        ticks: {
          color: COLORS.text,
          font: { family: "JetBrains Mono", size: 10 },
          padding: 4,
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  return (
    <WidgetCard category={CATEGORY} className="xl:col-span-2">
      {/* Kicker */}
      <div className="mb-4">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-400">
          ANALYTICS
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-semibold text-zinc-100 mb-4">Focus Distribution</h3>

      {/* Period selector */}
      <div className="flex gap-1 mb-4">
        {(["7", "14", "30"] as Period[]).map((p) => (
          <button
            key={p}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors duration-150 ${
              period === p
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() => setPeriod(p)}
          >
            {POWER_USERS[p].label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[160px] mb-4">
        <Bar data={chartData} options={options} />
      </div>

      {/* Custom legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.productive }} />
          <span className="text-[11px] text-zinc-400">Focus</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.distracting }} />
          <span className="text-[11px] text-zinc-400">Distracted</span>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
          <div className="text-[11px] font-medium text-zinc-500">Total Focus</div>
          <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
            {Math.round(totalFocus)}m
          </div>
        </div>
        <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
          <div className="text-[11px] font-medium text-zinc-500">Daily Avg</div>
          <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
            {Math.round(dailyAvg)}m
          </div>
        </div>
        <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
          <div className="text-[11px] font-medium text-zinc-500">Best Day</div>
          <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
            {Math.round(bestDay)}m
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}

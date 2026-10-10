// ============================================================================
// CashFlowRunway.tsx
// src/components/finance/CashFlowRunway.tsx
// ============================================================================
// "How many months can I survive?" — Financial fuel gauge with projections.
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Fuel, Flame, TrendingDown, AlertTriangle, Gauge } from 'lucide-react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Tooltip, Legend, Filler
);

interface ProjectedBalance {
  month: number;
  projectedBalance: number;
  isNegative: boolean;
}

interface DailyExpense {
  date: string;
  amount: number;
}

interface RunwayData {
  runwayMonths: number;
  dailyBurnRate: number;
  monthlyBurnRate: number;
  committedMonthly: number;
  totalMonthlyBurn: number;
  liquidNetWorth: number;
  breakEvenMonth: number | null;
  trendDirection: number;
  projectedBalances: ProjectedBalance[];
  dailyExpenseHistory: DailyExpense[];
}

export default function CashFlowRunway() {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await (window as any).deskflowAPI?.financeGetCashflowRunway();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load runway data');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    const s = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return showNumbers ? s : maskNumber(s, maskMode, maskFixedValue);
  };

  const getRunwayColor = (months: number) => {
    if (months >= 6) return 'text-emerald-400';
    if (months >= 3) return 'text-amber-400';
    return 'text-red-400';
  };

  const getGaugeColor = (months: number) => {
    if (months >= 6) return '#10b981';
    if (months >= 3) return '#f59e0b';
    return '#ef4444';
  };

  // Projection line chart
  const projectionChartData: ChartData<'line'> = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };
    return {
      labels: data.projectedBalances.map(b => `M${b.month}`),
      datasets: [{
        label: 'Projected Balance',
        data: data.projectedBalances.map(b => b.projectedBalance),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: data.projectedBalances.map(b => b.isNegative ? '#ef4444' : '#3b82f6'),
        pointBorderColor: 'transparent',
      }],
    };
  }, [data]);

  const projectionOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#fafafa',
        bodyColor: '#e4e4e7',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => `Balance: ${formatCurrency(ctx.raw as number)}`,
        },
      },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line',
            yMin: 0,
            yMax: 0,
            borderColor: '#ef4444',
            borderWidth: 1,
            borderDash: [5, 5],
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717a', font: { size: 10 } },
      },
      y: {
        grid: { color: '#27272a', drawBorder: false },
        ticks: {
          color: '#71717a',
          font: { size: 10 },
          callback: (value) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return num;
          },
        },
      },
    },
  };

  // Daily burn sparkline
  const sparklineData: ChartData<'bar'> = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };
    const recent = data.dailyExpenseHistory.slice(-30);
    return {
      labels: recent.map(d => d.date.slice(5)), // MM-DD
      datasets: [{
        data: recent.map(d => d.amount),
        backgroundColor: recent.map(d => d.amount > data.dailyBurnRate * 2 ? '#ef4444' : '#3b82f6'),
        borderRadius: 2,
        barThickness: 4,
      }],
    };
  }, [data]);

  const sparklineOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800 animate-pulse">
        <div className="h-6 w-40 bg-zinc-800 rounded mb-4"></div>
        <div className="h-40 bg-zinc-800/50 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
        <div className="text-center py-8">
          <Gauge size={32} className="text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">Need more data for runway calculation</p>
          <p className="text-xs text-zinc-600 mt-1">Track expenses for 30+ days to see your financial runway</p>
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
      <div className="flex items-center gap-2 mb-3">
        <Fuel size={18} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-zinc-100">Cash Flow Runway</h3>
      </div>
      <p className="text-xs text-zinc-500">Not enough transaction history to project runway. Keep tracking!</p>
    </div>
  );

  const runwayColor = getRunwayColor(data.runwayMonths);
  const gaugeColor = getGaugeColor(data.runwayMonths);

  return (
    <div className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl rounded-xl p-5 border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Fuel size={18} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Cash Flow Runway</h3>
        </div>
        {data.breakEvenMonth && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle size={12} />
            <span>Break-even in M{data.breakEvenMonth}</span>
          </div>
        )}
      </div>

      {/* Main Gauge */}
      <div className="flex items-center gap-5 mb-5">
        {/* Semi-circle gauge */}
        <div className="relative w-32 h-16 flex-shrink-0">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${Math.min(data.runwayMonths, 12) / 12 * 126} 126`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <div className={`text-xl font-bold ${runwayColor}`}>{data.runwayMonths.toFixed(1)}</div>
            <div className="text-[10px] text-zinc-500">months</div>
          </div>
        </div>

        {/* Burn Stats */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 flex items-center gap-1">
              <Flame size={12} className="text-orange-400" />
              Daily burn
            </span>
            <span className="text-zinc-200 font-mono">{formatCurrency(data.dailyBurnRate)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Monthly burn</span>
            <span className="text-zinc-200 font-mono">{formatCurrency(data.monthlyBurnRate)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Committed (subs)</span>
            <span className="text-zinc-200 font-mono">{formatCurrency(data.committedMonthly)}</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-zinc-800 pt-1">
            <span className="text-zinc-500">Total monthly</span>
            <span className="text-zinc-200 font-mono font-semibold">{formatCurrency(data.totalMonthlyBurn)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Liquid net worth</span>
            <span className="text-emerald-400 font-mono">{formatCurrency(data.liquidNetWorth)}</span>
          </div>
        </div>
      </div>

      {/* Trend indicator */}
      <div className={`flex items-center gap-1 text-xs mb-4 ${data.trendDirection > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        {data.trendDirection > 0 ? <TrendingDown size={12} /> : <TrendingDown size={12} className="rotate-180" />}
        <span>
          Spending {data.trendDirection > 0 ? 'up' : 'down'} {Math.abs(data.trendDirection).toFixed(1)}% vs last month
        </span>
      </div>

      {/* Projection Chart */}
      <div className="h-40 mb-4">
        <Line data={projectionChartData} options={projectionOptions} />
      </div>

      {/* Daily Sparkline */}
      <div className="border-t border-zinc-800 pt-3">
        <div className="text-xs text-zinc-500 mb-1">Daily spend (last 30 days)</div>
        <div className="h-12">
          <Bar data={sparklineData} options={sparklineOptions} />
        </div>
      </div>
    </div>
  );
}

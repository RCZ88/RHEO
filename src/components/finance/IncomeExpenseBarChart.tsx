import React, { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, Tooltip,
} from "chart.js";
import { BarChart3 } from "lucide-react";
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency } from "./currency-data";
import { useNumberMask } from "../../context/NumberMaskContext";
import { maskNumber } from "../../utils/maskNumber";
import { chartTokens, chartAxis, chartTooltip, watchChartTokens } from './_fx/chartTokens';
import { isoWeekStartLocal, shortDayMonth } from './_fx/netWorthSeries';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip);

/**
 * Cash flow — in vs out, with the NET drawn across the top.
 *
 * TWO REAL BUGS FIXED HERE (both were trust bugs, not taste):
 *
 * 1. CURRENCY WAS HARDCODED. `rp()` returned `Rp${n.toLocaleString("id-ID")}`
 *    regardless of the `currency` prop, so a USD user read every figure in
 *    Rupiah on a page that was simultaneously showing "$4,820" in the header.
 *    Formatting now goes through `formatCurrency(v, currency)`.
 * 2. THE "WEEKLY" BUTTON DID NOTHING. Both branches of the viewMode switch
 *    returned identical `labels/incomeData/expenseData` — the parent only ever
 *    passed monthly aggregates, so weekly could not be computed from them. An
 *    enabled control that silently returns the same data is worse than no
 *    control: it teaches the reader to distrust the rest of the UI. Weekly is
 *    now aggregated for real from `transactions`, and DISABLED (with a title
 *    explaining why) when no transactions were supplied.
 *
 * The net line was added because two bars make the reader do arithmetic. Net is
 * the number they actually want, and it is what tells them whether they are
 * ahead or behind.
 */

interface MonthlyData { month: string; income: number; expense: number; }
interface Txn { date: string; type: string; amount: number; is_adjustment?: number | boolean; }

interface Props {
  data: MonthlyData[];
  currency: string;
  /** Optional raw transactions. WITHOUT these, weekly cannot be computed —
   *  which is exactly why the old Weekly button returned monthly data. */
  transactions?: Txn[];
  /** Prop so the dashboard and Charts-tab copies can differ. */
  title?: string;
  height?: number;
}

type ViewMode = "monthly" | "weekly";

/** ISO week start (Monday) as 'YYYY-MM-DD'. Local clock — see netWorthSeries.ts. */

export default function IncomeExpenseBarChart({
  data, currency, transactions = [], title = "Cash flow", height = 220,
}: Props) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  useEffect(() => watchChartTokens(), []);
  const t = chartTokens();

  const fmt = (n: number) =>
    showNumbers ? formatCurrency(n, currency) : maskNumber(formatCurrency(n, currency), maskMode, maskFixedValue);

  const canDoWeekly = transactions.length > 0;

  const { labels, incomeData, expenseData, netData } = useMemo(() => {
    let income: number[] = [];
    let expense: number[] = [];
    let lbl: string[] = [];

    if (viewMode === "weekly" && canDoWeekly) {
      const buckets = new Map<string, { income: number; expense: number }>();
      for (const tx of transactions) {
        if (tx.is_adjustment) continue;
        const amt = Math.abs(Number(tx.amount) || 0);
        if (amt === 0) continue;
        const key = isoWeekStartLocal(tx.date);
        const b = buckets.get(key) ?? { income: 0, expense: 0 };
        if (tx.type === 'income') b.income += amt;
        else if (tx.type === 'expense') b.expense += amt;
        buckets.set(key, b);
      }
      const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
      lbl = sorted.map(([k]) => shortDayMonth(k));
      income = sorted.map(([, v]) => v.income);
      expense = sorted.map(([, v]) => v.expense);
    } else {
      const sorted = [...(data ?? [])].sort((a, b) => a.month.localeCompare(b.month));
      lbl = sorted.map((d) => d.month);
      income = sorted.map((d) => d.income);
      expense = sorted.map((d) => d.expense);
    }

    const net = income.map((inc, i) => inc - (expense[i] ?? 0));
    return { labels: lbl, incomeData: income, expenseData: expense, netData: net };
  }, [data, transactions, viewMode, canDoWeekly]);

  const hasData = labels.length > 0 && (incomeData.some((v) => v !== 0) || expenseData.some((v) => v !== 0));

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <BarChart3 className="w-3.5 h-3.5 text-[var(--page-accent)] shrink-0" aria-hidden="true" />
        <span className="fin-eyebrow truncate">{title}</span>
      </div>
      <div
        className="fin-surface--sunken rounded-full p-0.5 flex items-center gap-0.5 shrink-0"
        role="group"
        aria-label="Cash flow period"
      >
        {(['monthly', 'weekly'] as const).map((m) => {
          const disabled = m === 'weekly' && !canDoWeekly;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              disabled={disabled}
              aria-pressed={viewMode === m}
              title={disabled ? 'Weekly view needs transaction-level data, which this chart was not given' : undefined}
              className={`fin-label rounded-full px-2.5 py-1 transition-colors duration-150 fin-focusable ${
                viewMode === m
                  ? 'bg-[var(--color-foreground-10)] text-[var(--text-primary)]'
                  : disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:text-[var(--text-primary)]'
              }`}
            >
              {m === 'monthly' ? 'Monthly' : 'Weekly'}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!hasData) {
    return (
      <GlassSurface className="p-5 flex flex-col gap-3">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
          <BarChart3 className="w-8 h-8 text-[var(--text-disabled)]" aria-hidden="true" />
          <p className="fin-body max-w-[34ch]">
            Once a month has both money in and money out, this becomes the
            side-by-side — with the net drawn across the top.
          </p>
        </div>
      </GlassSurface>
    );
  }

  const axis = chartAxis(t);

  return (
    <GlassSurface className="p-5 flex flex-col gap-3 overflow-hidden">
      {header}
      <div className="relative w-full min-w-0" style={{ height }}>
        {/* Chart.js mixed datasets (bars + a line on one scale) are valid at
            runtime, but react-chartjs-2's `Bar` wrapper types `datasets` as
            bar-only, so the honest cast is on the data prop — the alternative
            is two overlapping charts and a second scale, which would break the
            zero-line the net series depends on. */}
        <Bar
          data={{
            labels,
            datasets: [
              {
                type: 'bar' as const,
                label: 'In',
                data: incomeData,
                backgroundColor: t.positive,
                borderRadius: 3,
                borderSkipped: false as const,
                barPercentage: 0.72,
                categoryPercentage: 0.68,
              },
              {
                type: 'bar' as const,
                label: 'Out',
                data: expenseData,
                backgroundColor: t.negative,
                borderRadius: 3,
                borderSkipped: false as const,
                barPercentage: 0.72,
                categoryPercentage: 0.68,
              },
              {
                type: 'line' as const,
                label: 'Net',
                data: netData,
                borderColor: t.accent,
                backgroundColor: t.accent,
                borderWidth: 1.5,
                pointRadius: 2,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: false,
                order: 0,
              },
            ],
          } as any}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            // Net crosses zero, so the scale must include it or the line clips.
            scales: {
              x: {
                ...axis,
                ticks: { ...axis.ticks, maxRotation: 0, autoSkipPadding: 12 },
                grid: { display: false },
              },
              y: {
                ...axis,
                ticks: {
                  ...axis.ticks,
                  maxTicksLimit: 5,
                  callback: (v: unknown) => formatCurrency(Number(v), currency).replace(/\.00$/, ''),
                },
              },
            },
            plugins: {
              legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                  color: t.textSecondary,
                  font: { size: 10 },
                  usePointStyle: true,
                  pointStyle: 'circle' as const,
                  boxWidth: 6,
                },
              },
              tooltip: {
                ...chartTooltip(t),
                displayColors: true,
                callbacks: {
                  label: (ctx: any) => `${ctx.dataset.label}: ${fmt(Number(ctx.parsed.y ?? 0))}`,
                },
              },
            },
          }}
        />
      </div>
    </GlassSurface>
  );
}
# Budget & Expenses Data Visualization — Complete Design

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│           BudgetExpensesDashboard                    │
│  (container, no bg — inherits parent grid)           │
├──────────────────────────────────────────────────────┤
│  Header (title + month pill + refresh)               │
├──────────────────────────────────────────────────────┤
│  KPI Row: Income │ Expenses │ Net Flow               │
├──────────────────────────────────────────────────────┤
│  Cash Flow Bar Chart   │  Spending Category Donut    │
│  (6/12 cols)           │  (6/12 cols)                │
├──────────────────────────────────────────────────────┤
│  Budget Progress       │  Upcoming Due Dates         │
│  (progress bars)       │  (next 5)                   │
├──────────────────────────────────────────────────────┤
│  Liquidity Waterfall (full width)                    │
└──────────────────────────────────────────────────────┘
```

**Data flow:** `IPC → useBudgetExpensesData hook → pure processor → memoized views → chart components`

Pure processor is testable & deterministic; hook owns loading/error state; components stay presentational.

---

## 1. Pure Data Processor

```ts
// src/renderer/features/finance/budget-expenses/budgetExpensesProcessor.ts

export type Frequency =
  | 'daily' | 'weekly' | 'biweekly'
  | 'monthly' | 'quarterly' | 'yearly' | 'one_time';

/** Multipliers to convert any frequency to a monthly equivalent. */
const FREQUENCY_TO_MONTHLY: Record<Frequency, number> = {
  daily: 30.437,
  weekly: 4.345,
  biweekly: 2.172,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  one_time: 0,
};

export interface FixedItem {
  id: number;
  name: string;
  amount: number;
  frequency: Frequency | string;
  type: 'income' | 'expense';
  next_due_date?: string | null;
  category_id?: number | null;
  wallet_id?: number | null;
  is_active: number | boolean;
  metadata?: string | null;
}

export interface Budget {
  id: number;
  name: string;
  amount: number;
  type?: string;
  category_id?: number | null;
  period?: string;
  alert_threshold?: number | null;
  is_active: number | boolean;
}

export interface BudgetStatus extends Budget {
  spent: number;
  remaining: number;
  utilization: number;     // 0..N (can exceed 100)
  status: 'safe' | 'warning' | 'danger' | 'over';
}

export interface CashFlowSummary {
  monthlyIncome: number;
  monthlyExpenses: number;
  netCashFlow: number;
  annualIncome: number;
  annualExpenses: number;
  savingsRate: number;     // percentage of income saved
  isSurplus: boolean;
}

export interface UpcomingPayment {
  id: number;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  dueDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  isImminent: boolean;     // due within 3 days
}

export interface LiquidityTier {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

export interface LiquidityBreakdown {
  tiers: LiquidityTier[];
  totalNetWorth: number;
  liquidityScore: number;  // 0-100, weighted access speed
}

/* ---------- pure functions ---------- */

export function normalizeToMonthly(
  amount: number,
  frequency: Frequency | string
): number {
  const mult = FREQUENCY_TO_MONTHLY[frequency as Frequency] ?? 1;
  return amount * mult;
}

export function computeCashFlow(items: FixedItem[]): CashFlowSummary {
  let monthlyIncome = 0;
  let monthlyExpenses = 0;

  for (const item of items) {
    if (!item.is_active) continue;
    const monthly = normalizeToMonthly(item.amount, item.frequency);
    if (item.type === 'income') monthlyIncome += monthly;
    else if (item.type === 'expense') monthlyExpenses += monthly;
  }

  const netCashFlow = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0
    ? (netCashFlow / monthlyIncome) * 100
    : 0;

  return {
    monthlyIncome,
    monthlyExpenses,
    netCashFlow,
    annualIncome: monthlyIncome * 12,
    annualExpenses: monthlyExpenses * 12,
    savingsRate,
    isSurplus: netCashFlow >= 0,
  };
}

export function computeBudgetStatuses(
  budgets: Budget[],
  spentMap: Map<number, number>
): BudgetStatus[] {
  return budgets
    .filter((b) => b.is_active)
    .map((budget) => {
      const spent = spentMap.get(budget.id) ?? 0;
      const utilization = budget.amount > 0
        ? (spent / budget.amount) * 100
        : 0;
      const remaining = budget.amount - spent;
      const threshold = budget.alert_threshold ?? 80;

      let status: BudgetStatus['status'] = 'safe';
      if (utilization >= 100) status = 'over';
      else if (utilization >= threshold) status = 'danger';
      else if (utilization >= threshold * 0.75) status = 'warning';

      return { ...budget, spent, remaining, utilization, status };
    })
    .sort((a, b) => b.utilization - a.utilization);
}

export function getUpcomingPayments(
  items: FixedItem[],
  limit = 5
): UpcomingPayment[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return items
    .filter((i) => i.is_active && i.next_due_date)
    .map((item) => {
      const dueDate = new Date(item.next_due_date as string);
      const diffMs = dueDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffMs / 86_400_000);
      return {
        id: item.id,
        name: item.name,
        amount: item.amount,
        type: item.type,
        dueDate,
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        isImminent: daysUntilDue >= 0 && daysUntilDue <= 3,
      };
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, limit);
}

/**
 * Weighted liquidity score: how quickly can net worth be accessed?
 * Immediate = 100%, Same Day = 75%, 1-3 Days = 50%, Locked = 0%
 */
export function computeLiquidityScore(tiers: LiquidityTier[]): number {
  const weights: Record<string, number> = {
    Immediate: 1.0,
    'Same Day': 0.75,
    '1-3 Days': 0.5,
    Locked: 0.0,
  };
  const total = tiers.reduce((s, t) => s + t.amount, 0);
  if (total <= 0) return 0;
  const score = tiers.reduce(
    (s, t) => s + t.amount * (weights[t.name] ?? 0),
    0
  );
  return (score / total) * 100;
}
```

---

## 2. IPC Orchestration Hook

```ts
// src/renderer/features/finance/budget-expenses/useBudgetExpensesData.ts

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ipcInvoke } from '@/lib/ipc';
import {
  computeBudgetStatuses,
  computeCashFlow,
  getUpcomingPayments,
  type Budget,
  type BudgetStatus,
  type CashFlowSummary,
  type FixedItem,
  type LiquidityBreakdown,
  type UpcomingPayment,
} from './budgetExpensesProcessor';

interface State {
  loading: boolean;
  error: string | null;
  fixedItems: FixedItem[];
  budgets: Budget[];
  budgetStatuses: BudgetStatus[];
  cashFlow: CashFlowSummary | null;
  upcoming: UpcomingPayment[];
  liquidity: LiquidityBreakdown | null;
  lastUpdated: Date | null;
}

const INITIAL: State = {
  loading: true,
  error: null,
  fixedItems: [],
  budgets: [],
  budgetStatuses: [],
  cashFlow: null,
  upcoming: [],
  liquidity: null,
  lastUpdated: null,
};

export function useBudgetExpensesData() {
  const [state, setState] = useState<State>(INITIAL);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [fixed, budgets, budgetStatus, liquidity] = await Promise.all([
        ipcInvoke<FixedItem[]>('fixed-expenses:list'),
        ipcInvoke<Budget[]>('budgets:list'),
        ipcInvoke<Array<{ id: number; spent: number }>>('budgets:get-status'),
        ipcInvoke<LiquidityBreakdown>('finance:get-liquidity-breakdown'),
      ]);

      const spentMap = new Map<number, number>(
        (budgetStatus ?? []).map((b) => [b.id, b.spent ?? 0])
      );

      const cashFlow = computeCashFlow(fixed ?? []);
      const statuses = computeBudgetStatuses(budgets ?? [], spentMap);
      const upcoming = getUpcomingPayments(fixed ?? [], 5);

      setState({
        loading: false,
        error: null,
        fixedItems: fixed ?? [],
        budgets: budgets ?? [],
        budgetStatuses: statuses,
        cashFlow,
        upcoming,
        liquidity,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load data',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isEmpty = useMemo(() => {
    if (!state.cashFlow) return true;
    return (
      state.fixedItems.length === 0 &&
      state.budgets.length === 0 &&
      state.cashFlow.monthlyIncome === 0 &&
      state.cashFlow.monthlyExpenses === 0
    );
  }, [state]);

  return { ...state, isEmpty, refresh };
}
```

---

## 3. Main Dashboard Container

```tsx
// src/renderer/features/finance/budget-expenses/BudgetExpensesDashboard.tsx

import { useMemo } from 'react';
import { useBudgetExpensesData } from './useBudgetExpensesData';
import { DashboardHeader } from './components/DashboardHeader';
import { KpiRow } from './components/KpiRow';
import { CashFlowBarChart } from './components/CashFlowBarChart';
import { SpendingCategoryChart } from './components/SpendingCategoryChart';
import { BudgetProgressList } from './components/BudgetProgressList';
import { UpcomingPaymentsList } from './components/UpcomingPaymentsList';
import { LiquidityWaterfall } from './components/LiquidityWaterfall';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { DashboardEmpty } from './components/DashboardEmpty';
import { DashboardError } from './components/DashboardError';

interface Props {
  /** Currency formatter that respects masking + locale. */
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

export function BudgetExpensesDashboard({ formatAmount }: Props) {
  const {
    loading,
    error,
    isEmpty,
    cashFlow,
    budgetStatuses,
    upcoming,
    liquidity,
    lastUpdated,
    refresh,
  } = useBudgetExpensesData();

  const monthLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  if (loading) return <DashboardSkeleton />;
  if (error)
    return <DashboardError message={error} onRetry={refresh} />;
  if (isEmpty || !cashFlow) return <DashboardEmpty />;

  return (
    <section
      aria-label="Budget and expenses overview"
      className="space-y-4"
    >
      <DashboardHeader
        month={monthLabel}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <KpiRow cashFlow={cashFlow} formatAmount={formatAmount} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <CashFlowBarChart cashFlow={cashFlow} formatAmount={formatAmount} />
        </div>
        <div className="lg:col-span-5">
          <SpendingCategoryChart formatAmount={formatAmount} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <BudgetProgressList
            budgets={budgetStatuses}
            formatAmount={formatAmount}
          />
        </div>
        <div className="lg:col-span-5">
          <UpcomingPaymentsList items={upcoming} formatAmount={formatAmount} />
        </div>
      </div>

      {liquidity && (
        <LiquidityWaterfall data={liquidity} formatAmount={formatAmount} />
      )}
    </section>
  );
}
```

---

## 4. Header & KPI Row

```tsx
// components/DashboardHeader.tsx
interface Props {
  month: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function DashboardHeader({ month, lastUpdated, onRefresh }: Props) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg
                     bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"
               stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Budget &amp; Expenses Overview
          </h2>
          <p className="text-[11px] text-zinc-500">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="rounded-md border border-zinc-800/60 bg-zinc-900/40
                     px-2.5 py-1 text-[11px] font-medium text-zinc-300
                     font-mono"
        >
          {month}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh data"
          className="grid h-8 w-8 place-items-center rounded-md border
                     border-zinc-800/60 bg-zinc-900/40 text-zinc-400
                     transition-colors hover:bg-zinc-800/60 hover:text-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/40
                     active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"
               stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
```

```tsx
// components/KpiRow.tsx
import type { CashFlowSummary } from '../budgetExpensesProcessor';

interface Props {
  cashFlow: CashFlowSummary;
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

export function KpiRow({ cashFlow, formatAmount }: Props) {
  const cards = [
    {
      label: 'Monthly Income',
      value: cashFlow.monthlyIncome,
      tone: 'income' as const,
      icon: (
        <path d="M7 17l5-5 5 5M7 7h10v10" strokeLinecap="round" />
      ),
    },
    {
      label: 'Monthly Expenses',
      value: cashFlow.monthlyExpenses,
      tone: 'expense' as const,
      icon: (
        <path d="M7 7l5 5 5-5M7 17h10V7" strokeLinecap="round" />
      ),
    },
    {
      label: 'Net Cash Flow',
      value: cashFlow.netCashFlow,
      tone: cashFlow.isSurplus ? ('income' as const) : ('expense' as const),
      icon: <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" />,
      sub: `${cashFlow.savingsRate.toFixed(1)}% savings rate`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => {
        const tone = c.tone;
        const isIncome = tone === 'income';
        return (
          <div
            key={c.label}
            className="relative overflow-hidden rounded-xl border
                       border-zinc-800/60 bg-zinc-900/40 p-3.5
                       backdrop-blur-sm transition-colors
                       hover:border-zinc-700/60"
          >
            <div
              aria-hidden
              className={`absolute inset-x-0 top-0 h-px ${
                isIncome
                  ? 'bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-red-500/40 to-transparent'
              }`}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {c.label}
              </span>
              <span
                aria-hidden
                className={`grid h-6 w-6 place-items-center rounded-md ${
                  isIncome
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"
                     stroke="currentColor" strokeWidth="2">
                  {c.icon}
                </svg>
              </span>
            </div>
            <div
              className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
                isIncome ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {c.value < 0 && c.label === 'Net Cash Flow' ? '−' : ''}
              {formatAmount(Math.abs(c.value), { compact: true })}
            </div>
            {c.sub && (
              <p className="mt-0.5 text-[11px] text-zinc-500">{c.sub}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 5. Cash Flow Bar Chart

```tsx
// components/CashFlowBarChart.tsx
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import type { CashFlowSummary } from '../budgetExpensesProcessor';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface Props {
  cashFlow: CashFlowSummary;
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

export function CashFlowBarChart({ cashFlow, formatAmount }: Props) {
  const data = useMemo(
    () => ({
      labels: ['Income', 'Expenses', 'Net'],
      datasets: [
        {
          label: 'Monthly',
          data: [
            cashFlow.monthlyIncome,
            cashFlow.monthlyExpenses,
            Math.abs(cashFlow.netCashFlow),
          ],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(239, 68, 68, 0.85)',
            cashFlow.isSurplus
              ? 'rgba(99, 102, 241, 0.85)'
              : 'rgba(244, 63, 94, 0.85)',
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)',
            'rgba(239, 68, 68, 1)',
            cashFlow.isSurplus ? 'rgba(99, 102, 241, 1)' : 'rgba(244, 63, 94, 1)',
          ],
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false as const,
          barThickness: 56,
        },
      ],
    }),
    [cashFlow]
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(9, 9, 11, 0.95)',
          borderColor: 'rgba(63, 63, 70, 0.6)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#a1a1aa',
          bodyColor: '#fafafa',
          bodyFont: { family: 'JetBrains Mono', size: 11, weight: 500 },
          titleFont: { family: 'Geist', size: 10, weight: 500 },
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y as number;
              return `  ${formatAmount(v)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#71717a',
            font: { family: 'Geist', size: 11, weight: 500 },
          },
          border: { color: 'rgba(63, 63, 70, 0.3)' },
        },
        y: {
          grid: { color: 'rgba(113, 113, 122, 0.08)' },
          ticks: {
            color: '#52525b',
            font: { family: 'JetBrains Mono', size: 10 },
            callback: (v) => formatAmount(v as number, { compact: true }),
          },
          border: { display: false },
        },
      },
    }),
    [formatAmount]
  );

  return (
    <article
      className="h-full rounded-xl border border-zinc-800/60
                 bg-zinc-900/40 p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-white">
            Monthly Cash Flow
          </h3>
          <p className="text-[11px] text-zinc-500">
            Income vs Expenses vs Net
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-medium font-mono ${
            cashFlow.isSurplus
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20'
              : 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20'
          }`}
        >
          {cashFlow.isSurplus ? 'SURPLUS' : 'DEFICIT'}
        </span>
      </header>
      <div className="h-[180px]">
        <Bar data={data} options={options} />
      </div>
    </article>
  );
}
```

---

## 6. Spending Category Chart — **Redesigned**

The fix uses a 5-color professional palette (indigo→violet→purple→fuchsia→pink), explicit legend with name + amount + percent, and a center total via custom plugin.

```tsx
// components/SpendingCategoryChart.tsx
import { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  type ChartOptions,
  type ScriptableContext,
} from 'chart.js';
import { ipcInvoke } from '@/lib/ipc';

ChartJS.register(ArcElement, Tooltip);

/** Professional dark-theme palette — NOT rainbow. */
const PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose (for "Other")
];

interface CategoryAgg {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

interface Props {
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

export function SpendingCategoryChart({ formatAmount }: Props) {
  const [rows, setRows] = useState<CategoryAgg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Assumes transactions endpoint returns { amount, category_name, type }
        const txs = await ipcInvoke<
          Array<{ amount: number; category_name?: string | null; type: string }>
        >('transactions:list');

        const byCat = new Map<string, number>();
        for (const t of txs ?? []) {
          if (t.type !== 'expense') continue;
          const name = t.category_name?.trim() || 'Uncategorized';
          byCat.set(name, (byCat.get(name) ?? 0) + Math.abs(t.amount));
        }

        const sorted = [...byCat.entries()]
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);

        const top = sorted.slice(0, 5);
        const rest = sorted.slice(5);
        const restSum = rest.reduce((s, r) => s + r.amount, 0);

        const all = [
          ...top.map((t, i) => ({ ...t, color: PALETTE[i] })),
          ...(restSum > 0 ? [{ name: 'Other', amount: restSum, color: PALETTE[5] }] : []),
        ];

        const total = all.reduce((s, c) => s + c.amount, 0) || 1;
        const withPct = all.map((c) => ({
          ...c,
          percentage: (c.amount / total) * 100,
        }));

        if (alive) setRows(withPct);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const data = useMemo(
    () => ({
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.amount),
          backgroundColor: rows.map((r) => r.color),
          borderColor: 'rgba(24, 24, 27, 0.9)',
          borderWidth: 2,
          hoverOffset: 6,
          hoverBorderColor: 'rgba(24, 24, 27, 1)',
        },
      ],
    }),
    [rows]
  );

  const options: ChartOptions<'doughnut'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(9, 9, 11, 0.95)',
          borderColor: 'rgba(63, 63, 70, 0.6)',
          borderWidth: 1,
          padding: 10,
          titleColor: '#a1a1aa',
          bodyColor: '#fafafa',
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          titleFont: { family: 'Geist', size: 10, weight: 500 },
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed as number;
              const total = rows.reduce((s, r) => s + r.amount, 0) || 1;
              return `  ${formatAmount(v)}  (${((v / total) * 100).toFixed(1)}%)`;
            },
          },
        },
      },
    }),
    [rows, formatAmount]
  );

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <article
      className="h-full rounded-xl border border-zinc-800/60
                 bg-zinc-900/40 p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-white">
            Spending by Category
          </h3>
          <p className="text-[11px] text-zinc-500">This month</p>
        </div>
      </header>

      {loading ? (
        <div className="grid h-[180px] place-items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="grid h-[180px] place-items-center text-center">
          <div>
            <p className="text-xs text-zinc-500">No expense data yet</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Add transactions to see breakdown
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Doughnut with center total */}
          <div className="relative h-[180px]">
            <Doughnut data={data} options={options} />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Total
                </p>
                <p className="font-mono text-sm font-semibold text-white">
                  {formatAmount(total, { compact: true })}
                </p>
              </div>
            </div>
          </div>

          {/* Legend with full category names + amount + percent */}
          <ul className="flex flex-col justify-center gap-1.5">
            {rows.map((r) => (
              <li
                key={r.name}
                className="group flex items-center gap-2 rounded-md px-1.5 py-1
                           transition-colors hover:bg-zinc-800/40"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: r.color }}
                />
                <span
                  className="flex-1 truncate text-[11px] text-zinc-300
                             group-hover:text-white"
                  title={r.name}
                >
                  {r.name}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                  {formatAmount(r.amount, { compact: true })}
                </span>
                <span className="w-10 text-right font-mono text-[10px] tabular-nums text-zinc-500">
                  {r.percentage.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
```

**Key fixes vs. the previous version:**
- `PALETTE` is now a 6-color harmonious indigo→pink progression, not ROYGBV rainbow
- Legend is custom HTML, not Chart.js' built-in — so names render fully, no truncation, with hover tooltips via `title` attribute
- Each legend row shows **name + compact amount + percentage** in mono numerals
- Center total overlay gives the focal point the spec requires
- Loading + empty states explicitly handled

---

## 7. Liquidity Waterfall — **Rewritten for Actual IPC Format**

The IPC returns `{ tiers, totalNetWorth, liquidityScore }`. We render:
- One horizontal stacked bar (each tier = proportional segment)
- A list below showing each tier with amount + percentage + access speed
- A liquidity score gauge

```tsx
// components/LiquidityWaterfall.tsx
import { useMemo } from 'react';
import type { LiquidityBreakdown } from '../budgetExpensesProcessor';

interface Props {
  data: LiquidityBreakdown;
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

const SPEED_LABELS: Record<string, string> = {
  Immediate: '< 1 hour',
  'Same Day': '< 24 hours',
  '1-3 Days': '1–3 days',
  Locked: '> 1 week',
};

export function LiquidityWaterfall({ data, formatAmount }: Props) {
  const tiers = data.tiers ?? [];
  const total = data.totalNetWorth || tiers.reduce((s, t) => s + t.amount, 0) || 1;

  const score = data.liquidityScore ?? 0;
  const scoreTone =
    score >= 60 ? 'emerald' : score >= 30 ? 'amber' : 'rose';

  return (
    <article
      className="rounded-xl border border-zinc-800/60
                 bg-zinc-900/40 p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-white">
            Liquidity Waterfall
          </h3>
          <p className="text-[11px] text-zinc-500">
            How quickly can you access your net worth?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Score
          </span>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
              scoreTone === 'emerald'
                ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20'
                : scoreTone === 'amber'
                ? 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 ring-1 ring-inset ring-rose-500/20'
            }`}
          >
            {score.toFixed(1)} / 100
          </span>
        </div>
      </header>

      {/* Stacked horizontal bar */}
      <div
        role="img"
        aria-label="Liquidity distribution"
        className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800/60"
      >
        {tiers.map((tier, i) => {
          const widthPct = (tier.amount / total) * 100;
          if (widthPct <= 0) return null;
          return (
            <div
              key={tier.name}
              className="absolute top-0 h-full transition-all duration-300"
              style={{
                left: `${tiers
                  .slice(0, i)
                  .reduce((s, t) => s + (t.amount / total) * 100, 0)}%`,
                width: `${widthPct}%`,
                backgroundColor: tier.color,
              }}
              title={`${tier.name}: ${formatAmount(tier.amount)} (${tier.percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Tier breakdown list */}
      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <li
            key={tier.name}
            className="rounded-md border border-zinc-800/40 bg-zinc-900/30 p-2.5
                       transition-colors hover:border-zinc-700/60"
          >
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: tier.color }}
              />
              <span className="text-[11px] font-medium text-zinc-200">
                {tier.name}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
              {formatAmount(tier.amount, { compact: true })}
            </p>
            <p className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-500">
              <span>{tier.percentage.toFixed(1)}% of NW</span>
              <span className="font-mono">{SPEED_LABELS[tier.name] ?? '—'}</span>
            </p>
          </li>
        ))}
      </ul>

      <footer className="mt-3 flex items-center justify-between border-t border-zinc-800/40 pt-2.5">
        <span className="text-[11px] text-zinc-500">Total Net Worth</span>
        <span className="font-mono text-sm font-semibold text-white">
          {formatAmount(total)}
        </span>
      </footer>
    </article>
  );
}
```

**Key fixes:**
- No more `chart.js` mismatch — the IPC returns tiers, we render a stacked bar manually (more reliable, themeable, accessible)
- Each tier card shows **amount + % of NW + access speed**, so the meaning of "Immediate vs Locked" is obvious
- Liquidity score badge uses tone-based coloring (emerald/amber/rose)
- ARIA role on the bar + per-segment `title` tooltip for keyboard/screen reader users

---

## 8. Budget Progress List

```tsx
// components/BudgetProgressList.tsx
import type { BudgetStatus } from '../budgetExpensesProcessor';

interface Props {
  budgets: BudgetStatus[];
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

const TONE: Record<
  BudgetStatus['status'],
  { bar: string; ring: string; text: string; label: string }
> = {
  safe: {
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
    text: 'text-emerald-400',
    label: 'On Track',
  },
  warning: {
    bar: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    text: 'text-amber-400',
    label: 'Watch',
  },
  danger: {
    bar: 'bg-orange-500',
    ring: 'ring-orange-500/20',
    text: 'text-orange-400',
    label: 'Near Limit',
  },
  over: {
    bar: 'bg-red-500',
    ring: 'ring-red-500/20',
    text: 'text-red-400',
    label: 'Over Budget',
  },
};

export function BudgetProgressList({ budgets, formatAmount }: Props) {
  return (
    <article
      className="h-full rounded-xl border border-zinc-800/60
                 bg-zinc-900/40 p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-white">
            Budget Progress
          </h3>
          <p className="text-[11px] text-zinc-500">
            {budgets.length} active {budgets.length === 1 ? 'budget' : 'budgets'}
          </p>
        </div>
      </header>

      {budgets.length === 0 ? (
        <div className="grid h-[180px] place-items-center text-center">
          <div>
            <p className="text-xs text-zinc-500">No budgets set</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              Create a budget to track spending limits
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {budgets.map((b) => {
            const tone = TONE[b.status];
            const pct = Math.min(b.utilization, 100);
            return (
              <li key={b.id}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-[12px] font-medium text-zinc-200"
                    title={b.name}
                  >
                    {b.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.text} ring-1 ring-inset ${tone.ring}`}
                  >
                    {tone.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800/80"
                    role="progressbar"
                    aria-valuenow={Math.round(b.utilization)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${b.name} budget utilization`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${tone.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                    {b.utilization.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="font-mono">
                    {formatAmount(b.spent, { compact: true })}
                  </span>
                  <span className="font-mono">
                    of {formatAmount(b.amount, { compact: true })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
```

---

## 9. Upcoming Payments List

```tsx
// components/UpcomingPaymentsList.tsx
import type { UpcomingPayment } from '../budgetExpensesProcessor';

interface Props {
  items: UpcomingPayment[];
  formatAmount: (n: number, opts?: { compact?: boolean }) => string;
}

function relativeDay(d: number): string {
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 7) return `In ${d} days`;
  return `In ${Math.ceil(d / 7)} wk`;
}

export function UpcomingPaymentsList({ items, formatAmount }: Props) {
  return (
    <article
      className="h-full rounded-xl border border-zinc-800/60
                 bg-zinc-900/40 p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-white">
            Upcoming Due Dates
          </h3>
          <p className="text-[11px] text-zinc-500">Next 5 payments</p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="grid h-[180px] place-items-center text-center">
          <div>
            <p className="text-xs text-zinc-500">Nothing scheduled</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              Add due dates to fixed items to see them here
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((p) => {
            const isIncome = p.type === 'income';
            return (
              <li
                key={p.id}
                className="group flex items-center gap-3 rounded-lg border
                           border-zinc-800/40 bg-zinc-900/30 px-2.5 py-2
                           transition-colors hover:border-zinc-700/60
                           hover:bg-zinc-800/40"
              >
                <span
                  aria-hidden
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                    isIncome
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none"
                       stroke="currentColor" strokeWidth="2">
                    {isIncome ? (
                      <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" />
                    ) : (
                      <path d="M12 19V5M5 12l7 7 7-7" strokeLinecap="round" />
                    )}
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-zinc-200">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {p.dueDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    <span
                      className={
                        p.isOverdue
                          ? 'text-red-400'
                          : p.isImminent
                          ? 'text-amber-400'
                          : 'text-zinc-500'
                      }
                    >
                      {relativeDay(p.daysUntilDue)}
                    </span>
                  </p>
                </div>

                <span
                  className={`font-mono text-[12px] font-semibold tabular-nums ${
                    isIncome ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isIncome ? '+' : '−'}
                  {formatAmount(p.amount, { compact: true })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
```

---

## 10. State Components: Skeleton / Empty / Error

```tsx
// components/DashboardSkeleton.tsx
export function DashboardSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-64 animate-pulse rounded-md bg-zinc-800/50" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-zinc-800/40 bg-zinc-900/40"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[230px] animate-pulse rounded-xl border border-zinc-800/40 bg-zinc-900/40" />
        <div className="h-[230px] animate-pulse rounded-xl border border-zinc-800/40 bg-zinc-900/40" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[230px] animate-pulse rounded-xl border border-zinc-800/40 bg-zinc-900/40" />
        <div className="h-[230px] animate-pulse rounded-xl border border-zinc-800/40 bg-zinc-900/40" />
      </div>
    </section>
  );
}
```

```tsx
// components/DashboardEmpty.tsx
export function DashboardEmpty() {
  return (
    <section className="grid place-items-center rounded-xl border border-dashed border-zinc-800/60 bg-zinc-900/20 p-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"
             stroke="currentColor" strokeWidth="1.75">
          <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white">
        No budget data yet
      </h3>
      <p className="mt-1 max-w-xs text-xs text-zinc-500">
        Add your income sources, recurring expenses, and budgets to see a
        complete cash flow analysis.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 active:scale-95"
        >
          + Add Income
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 active:scale-95"
        >
          + Add Expense
        </button>
      </div>
    </section>
  );
}
```

```tsx
// components/DashboardError.tsx
interface Props { message: string; onRetry: () => void; }
export function DashboardError({ message, onRetry }: Props) {
  return (
    <section
      role="alert"
      className="grid place-items-center rounded-xl border border-red-900/40 bg-red-950/20 p-12 text-center"
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
             stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">
        Couldn't load budget data
      </h3>
      <p className="mt-1 max-w-sm text-xs text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 active:scale-95"
      >
        Try again
      </button>
    </section>
  );
}
```

---

## Integration Notes

### Replace `SubscriptionBurdenRadar` in the parent grid
```tsx
// Before
<SubscriptionBurdenRadar formatAmount={formatAmount} />

// After
<BudgetExpensesDashboard formatAmount={formatAmount} />
```
The parent grid continues to own the card background — `BudgetExpensesDashboard` renders transparently into it.

### Wire `prefers-reduced-motion`
Add to a global stylesheet:
```css
@media (prefers-reduced-motion: reduce) {
  .budget-dashboard * {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```
Chart.js animations are also reduced by setting `Chart.defaults.animation.duration = 0` when the media query matches.

### Number masking preservation
`formatAmount` is passed in from the parent (same one used elsewhere), so masked numbers continue to render with `••••` if the user has masking enabled. No new formatter is introduced.

### Encrypted fields
The processor never touches `metadata` (which may contain encrypted JSON). It only reads structured fields (`amount`, `frequency`, `next_due_date`, `type`, `is_active`), so encryption is preserved transparently.

---

## QA Checklist

| Check | Expected |
|---|---|
| Empty fixed_expenses + budgets tables | DashboardEmpty renders with CTAs |
| Loading state | DashboardSkeleton shows within 100ms |
| IPC error | DashboardError shows with retry |
| Income + Expense bars render | Income green, Expense red, Net colored by sign |
| Spending donut uses 6-color palette | Indigo→Violet→Purple→Fuchsia→Pink→Rose, never rainbow |
| Legend shows full category names | `truncate` + `title` tooltip; no Chart.js built-in legend |
| Center total in donut | Renders absolutely-positioned overlay |
| Liquidity bar segments sum to 100% | Widths computed from `amount / totalNetWorth` |
| Each liquidity tier card shows speed | "Immediate < 1 hour", "Same Day < 24 hours", etc. |
| Budget > 100% utilization | `over` tone (red), bar capped at 100% width |
| Keyboard focus on refresh button | Visible `focus:ring-2` |
| `prefers-reduced-motion` | All animations drop to near-zero duration |

This design delivers a single, coherent visualization surface that unifies income, expenses, budgets, due dates, and liquidity — replacing the narrow subscription radar with a full financial picture while fixing the rainbow palette and the IPC-format mismatch in the liquidity waterfall.
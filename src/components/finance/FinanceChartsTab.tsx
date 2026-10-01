import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, LinearScale, BarElement, 
  PointElement, LineElement, ArcElement, Tooltip, Legend, Filler 
} from 'chart.js';
import { GlassSurface } from './_fx/GlassSurface';
import { pageContainer, riseItem } from './_fx/financeMotion';
import SpendingCategoryChart from './SpendingCategoryChart';
import IncomeExpenseBarChart from './IncomeExpenseBarChart';
import { NetWorthLineChart } from './NetWorthLineChart';
import { convertAmount } from './currency-data';
import type { 
  FinanceSpendingByCategory, 
  FinanceMonthlyTrend, 
  FinanceTransaction 
} from './finance-types';
import LiquidityWaterfall from './LiquidityWaterfall';
import CashFlowRunway from './CashFlowRunway';
import SubscriptionBurdenRadar from './SubscriptionBurdenRadar';
import WalletHealthScorecards from './WalletHealthScorecards';
import TransferCostMatrix from './TransferCostMatrix';
import WalletBreakdownChart from './WalletBreakdownChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

interface FinanceChartsTabProps {
  spendingByCategory: FinanceSpendingByCategory[];
  monthlyTrends: FinanceMonthlyTrend[];
  allTransactions?: FinanceTransaction[];
  wallets?: Array<{ id: number; type: string; balance?: number; initial_balance?: number; currency?: string; metadata?: any }>;
  displayCurrency: string;
  baseCurrency: string;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function FinanceChartsTab({
  spendingByCategory,
  monthlyTrends,
  allTransactions = [],
  wallets = [],
  displayCurrency,
  baseCurrency,
  loading,
  error,
  onRetry,
}: FinanceChartsTabProps) {
  const [nwPeriod, setNwPeriod] = useState<'day' | 'month' | 'auto'>('day');

  const netWorthSeries = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const t of allTransactions) {
      if (t.is_adjustment) continue; // Exclude historical adjustments from chart
      let signed: number;
      if (t.type === 'income') {
        signed = Math.abs(t.amount);
      } else if (t.type === 'expense') {
        signed = -Math.abs(t.amount);
      } else if (t.type === 'transfer') {
        signed = -(t.fee || 0);
      } else {
        signed = 0;
      }
      const converted = convertAmount(signed, baseCurrency, displayCurrency);
      dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + converted);
    }

    // Seed with wallet initial balances as starting point
    const startingBalance = wallets.reduce((sum, w) => {
      const initial = (w.type === 'crypto' || w.type === 'investment')
        ? (w.balance || 0)  // Available fiat for crypto wallets
        : (w.initial_balance || 0);
      return sum + convertAmount(initial, w.currency || baseCurrency, displayCurrency);
    }, 0);

    const sorted = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (sorted.length === 0) return [];

    let run = startingBalance;
    const series: { month: string; value: number }[] = [];
    for (const [date, net] of sorted) {
      run += net;
      series.push({ month: date, value: run });
    }

    if (nwPeriod === 'month') {
      const monthMap = new Map<string, number>();
      for (const point of series) {
        const monthKey = point.month.slice(0, 7);
        monthMap.set(monthKey, point.value);
      }
      return [...monthMap.entries()].map(([month, value]) => ({ month, value }));
    }

    return series;
  }, [allTransactions, baseCurrency, displayCurrency, nwPeriod, wallets]);

  const barChartData = useMemo(() => {
    return monthlyTrends.slice(-6).map(m => ({
      month: m.month,
      income: convertAmount(m.income, baseCurrency, displayCurrency),
      expense: convertAmount(m.expense, baseCurrency, displayCurrency),
    }));
  }, [monthlyTrends, baseCurrency, displayCurrency]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="animate-pulse bg-zinc-800/60 rounded-xl h-64" />
        <div className="animate-pulse bg-zinc-800/60 rounded-xl h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          {onRetry && (
            <button onClick={onRetry} className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-violet-500/40 via-violet-500/10 to-transparent" />
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-violet-500/70">Financial Analytics</span>
        <div className="h-px flex-1 bg-gradient-to-l from-violet-500/40 via-violet-500/10 to-transparent" />
      </div>

      <motion.div
        variants={pageContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        {/* Net Worth Trend */}
        <motion.div variants={riseItem}>
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/50 p-5 h-full hover:border-zinc-600/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-500">Net worth trend</span>
              <div className="flex items-center gap-0.5 bg-zinc-900/50 p-0.5 rounded-full">
                {(['day', 'month', 'auto'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setNwPeriod(p)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors capitalize ${
                      nwPeriod === p ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1">
              {netWorthSeries.length > 0 ? (
                <NetWorthLineChart data={netWorthSeries} currency={displayCurrency} />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
                  <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                  <span className="text-xs">Not enough history yet</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Spending Categories */}
        <motion.div variants={riseItem}>
          <SpendingCategoryChart
            data={spendingByCategory}
            baseCurrency={baseCurrency}
            displayCurrency={displayCurrency}
            convertAmount={convertAmount}
            allTransactions={allTransactions}
          />
        </motion.div>

        {/* Cashflow Bar Chart */}
        <motion.div variants={riseItem} className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/50 p-5 h-full hover:border-zinc-600/30 transition-colors">
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-500">Cashflow · last 6 months</span>
            <div className="mt-3">
              {monthlyTrends.length > 0 ? (
                <IncomeExpenseBarChart data={barChartData} currency={displayCurrency} />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
                  <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                  <span className="text-xs">No cashflow data this period</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Per-Wallet Monthly Breakdown */}
        <motion.div variants={riseItem} className="lg:col-span-2">
          <WalletBreakdownChart
            transactions={allTransactions}
            wallets={wallets.map(w => {
              const typeLabels: Record<string, string> = {
                bank: 'Bank', debit_card: 'Debit Card', credit_card: 'Credit Card',
                crypto: 'Crypto', cash: 'Cash', physical: 'Physical', ewallet: 'E-Wallet', other: 'Other',
              };
              return { id: w.id, name: `${typeLabels[w.type] || w.type} #${w.id}`, type: w.type };
            })}
            displayCurrency={displayCurrency}
            baseCurrency={baseCurrency}
          />
        </motion.div>

        {/* Advanced Analytics */}
        <motion.div variants={riseItem}>
          <LiquidityWaterfall />
        </motion.div>
        <motion.div variants={riseItem}>
          <CashFlowRunway />
        </motion.div>
        <motion.div variants={riseItem} className="lg:col-span-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SubscriptionBurdenRadar />
            <WalletHealthScorecards />
          </div>
        </motion.div>
        <motion.div variants={riseItem} className="lg:col-span-2">
          <TransferCostMatrix />
        </motion.div>
      </motion.div>
    </div>
  );
}

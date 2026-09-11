import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, BarChart3 } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { SectionHeader } from '../SectionHeader';
import { EmptyState } from '../EmptyState';
import { Loader2 } from 'lucide-react';
import { formatCurrency, convertAmount } from '../finance/currency-data';

interface DashFinanceData {
  summary: { totalIncome: number; totalExpense: number; netBalance: number };
  recentTransactions: any[];
  monthlyTrends: any[];
  spendingByCategory: any[];
  subscriptionCount: number;
}

export function FinanceOverviewSection() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashFinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.deskflowAPI?.financeGetDisplayCurrency?.().then((currencyResult) => {
      if (cancelled) return null;
      const currency = currencyResult?.currency || 'USD';
      setDisplayCurrency(currency);
      return window.deskflowAPI?.financeGetDashboardOverview?.(currency);
    }).then((financeData) => {
      if (cancelled) return;
      if (financeData) setData(financeData as DashFinanceData);
      return (window as any).deskflowAPI?.financeLastTransactionDate?.();
    }).then((lastDate: any) => {
      if (cancelled) return;
      if (lastDate?.lastDate) setLastActivity(lastDate.lastDate);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const fmt = (v: number) => formatCurrency(v, displayCurrency);

  const netWorth = data?.summary?.netBalance ?? 0;
  const income = data?.summary?.totalIncome ?? 0;
  const expense = data?.summary?.totalExpense ?? 0;

  const topCategories = useMemo(() => {
    if (!data?.spendingByCategory) return [];
    const total = data.spendingByCategory.reduce((s: number, c: any) => s + c.amount, 0);
    return data.spendingByCategory.slice(0, 3).map((c: any) => ({
      name: c.categoryName,
      amount: c.amount,
      pct: total > 0 ? (c.amount / total) * 100 : 0,
      color: c.categoryColor,
    }));
  }, [data?.spendingByCategory]);

  const trendDir = netWorth >= 0 ? 'up' : 'down';
  const trendColor = trendDir === 'up' ? 'text-emerald-400' : 'text-[#fb7185]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <GlassCard data-section="dash.finance">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Finance" icon={<Wallet className="w-5 h-5" />} />
          <button
            onClick={() => navigate('/finance')}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800/40"
          >
            Full overview
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : !data || !data.summary ? (
          <EmptyState
            icon={<Wallet className="w-8 h-8" />}
            title="Finance not set up"
            description="Create accounts in the Finance page to see your overview here"
            action={{ label: 'Go to Finance', onClick: () => navigate('/finance') }}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/60 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Net Worth</span>
                <p className={`text-lg font-bold tabular-nums mt-1 ${trendColor}`}>{fmt(netWorth)}</p>
              </div>
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/60 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Income</span>
                <p className="text-lg font-bold tabular-nums mt-1 text-emerald-400">{fmt(income)}</p>
              </div>
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/60 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Spending</span>
                <p className="text-lg font-bold tabular-nums mt-1 text-[#fb7185]">{fmt(expense)}</p>
              </div>
            </div>

            {topCategories.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 block mb-2">Top spending</span>
                <div className="space-y-1.5">
                  {topCategories.map((c) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-xs text-zinc-400 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-zinc-300 tabular-nums">{fmt(c.amount)}</span>
                      <span className="text-[10px] text-zinc-600 w-8 text-right tabular-nums">{c.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.subscriptionCount > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/40">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] text-zinc-500">
                  {data.subscriptionCount} active subscription{data.subscriptionCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {lastActivity && (
              <div className="pt-2 border-t border-zinc-800/40">
                <span className="text-[11px] text-zinc-500">
                  Last transaction: {new Date(lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

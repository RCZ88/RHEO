import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, Handshake, Bell, ArrowUpRight, ArrowDownLeft, Repeat, HelpCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { pageContainer, riseItem } from './_fx/financeMotion';
import { EmptyState } from './EmptyState';
import { Sparkline } from './_fx/Sparkline';
import { FinanceInsightsCard } from './FinanceInsightsCard';
import { RecentTxnsCard } from './RecentTxnsCard';
import { SpendingSplitCard } from './SpendingSplitCard';
import { RepaymentModal } from './RepaymentModal';
import { groupByPerson } from '../../lib/receivables';
import { formatCurrency as fc, convertAmount, getCurrencyInfo, COMMON_CURRENCIES } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import type {
  FinanceAccount, FinanceWallet, FinanceCategory, FinanceTransaction,
  FinanceSummary, FinanceSpendingByCategory, FinanceMonthlyTrend,
} from './finance-types';



interface OverviewTabProps {
  summary: FinanceSummary | null;
  spendingByCategory: FinanceSpendingByCategory[];
  monthlyTrends: FinanceMonthlyTrend[];
  accounts: FinanceAccount[];
  recentTransactions: FinanceTransaction[];
  allTransactions?: FinanceTransaction[];
  categories: FinanceCategory[];
  wallets: FinanceWallet[];
  subscriptions?: any[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  displayCurrency: string;
  baseCurrency: string;
  currentNetWorth?: number;
  onCreateAccount?: (data: {
    name: string; type: FinanceAccount['type']; description?: string;
    icon?: string; color?: string;
  }) => Promise<boolean>;
  onDeleteTransaction?: (id: number) => Promise<boolean>;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  onBehalfOfSummary?: { totalExpense: number; breakdown: { label: string; total: number; count: number }[] } | null;
  onRecordFtRepayment?: (data: {
    originalTxId: number; personId?: number; amount: number; date: string;
    walletId?: number; description?: string; isOverpayment?: boolean;
  }) => Promise<boolean>;
  ftPersons?: { id: number; name: string; email?: string | null; phone?: string | null }[];
}

export function OverviewTab({

  summary, spendingByCategory, monthlyTrends, accounts, recentTransactions,
  allTransactions = [], categories, wallets, subscriptions = [], loading, error, onRetry, displayCurrency, baseCurrency,
  onCreateAccount, onDeleteTransaction, onVerifyPassword, onBehalfOfSummary, currentNetWorth, onRecordFtRepayment, ftPersons = [],
}: OverviewTabProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [showFT, setShowFT] = useState(false);
  const [repaymentModal, setRepaymentModal] = useState<{
    personName: string; txIds: number[]; totalAmount: number;
  } | null>(null);

  // Format an amount that is ALREADY in displayCurrency (no second conversion).
  const fmtMoney = (v: number) =>
    showNumbers ? fc(v, displayCurrency) : maskNumber(fc(v, displayCurrency), maskMode, maskFixedValue);

  const activeAccounts = useMemo(() => accounts.filter(a => !a.is_archived), [accounts]);
  const activeWallets = useMemo(() => wallets.filter(w => !w.is_archived), [wallets]);

  const income = convertAmount(summary?.totalIncome ?? 0, baseCurrency, displayCurrency);
  const expense = convertAmount(summary?.totalExpense ?? 0, baseCurrency, displayCurrency);

  // Personal spending = total expense (excl FT already filtered in summary) minus FT
  const personalExpense = expense - (onBehalfOfSummary?.totalExpense ?? 0);

  // Net worth total — use explicit prop if given, else fall back to summary + receivable
  const totalNetWorth = currentNetWorth ?? convertAmount(summary?.netBalance ?? 0, baseCurrency, displayCurrency);

  // Monthly net flow
  const netFlowSeries = useMemo(
    () => monthlyTrends.map(m => convertAmount(m.net, baseCurrency, displayCurrency)),
    [monthlyTrends, baseCurrency, displayCurrency],
  );
  const latestNet = netFlowSeries.length ? netFlowSeries[netFlowSeries.length - 1] : 0;
  const momDelta = netFlowSeries.length >= 2 ? latestNet - netFlowSeries[netFlowSeries.length - 2] : null;

  // Net worth shown across several currencies (base currency comes from Settings).
  const currencyBalances = useMemo(() => {
    const codes = [baseCurrency, ...COMMON_CURRENCIES.filter(c => c !== baseCurrency)].slice(0, 6);
    const baseNet = summary?.netBalance ?? 0;
    return codes.map(code => ({
      code,
      symbol: getCurrencyInfo(code).symbol,
      formatted: fc(convertAmount(baseNet, baseCurrency, code), code),
    }));
  }, [summary, baseCurrency]);

  // Follow Through MoM change + trend
  const ftMomChangePct = useMemo(() => {
    if (monthlyTrends.length < 2) return null;
    // Approximate FT from total minus personal (personal is onBehalfOf=0)
    // Since monthlyTrends already excludes FT, we can't derive FT from it directly.
    // Use the summary-based approach: totalExpense includes all, summary filters FT.
    // For now, return null until we have FT-specific monthly data.
    return null;
  }, [monthlyTrends]);

  const ftTrend = useMemo(() => {
    // Placeholder: last 6 months of FT spending (0s until we have FT monthly breakdown)
    return monthlyTrends.slice(-6).map(() => 0);
  }, [monthlyTrends]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 animate-pulse bg-zinc-800/60 rounded-[20px] h-40" />
        <div className="lg:col-span-2 animate-pulse bg-zinc-800/60 rounded-[20px] h-40" />
        <div className="lg:col-span-4 animate-pulse bg-zinc-800/60 rounded-[20px] h-28" />
        <div className="lg:col-span-2 animate-pulse bg-zinc-800/60 rounded-[20px] h-64" />
        <div className="lg:col-span-2 animate-pulse bg-zinc-800/60 rounded-[20px] h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-[20px] p-5 text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!activeAccounts.length) {
    return (
      <EmptyState
        icon={<Wallet className="w-12 h-12" />}
        title="No accounts yet"
        description="Create your first account to start tracking your finances"
        action={onCreateAccount ? { label: 'Create Account', onClick: () => onCreateAccount({ name: 'New Account', type: 'personal' }) } : undefined}
      />
    );
  }

  const personalAccounts = activeAccounts.filter(a => a.type !== 'custodial');
  const custodialAccounts = activeAccounts.filter(a => a.type === 'custodial');
  const hasTrends = monthlyTrends.length > 0;

  return (
    <>
    {/* ═══ SECTION 1: Quick Stats ═══ */}
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 via-emerald-500/10 to-transparent" />
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-emerald-500/70">Quick Stats</span>
        <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/40 via-emerald-500/10 to-transparent" />
      </div>
      <motion.div
        variants={pageContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {/* Income */}
        <motion.div variants={riseItem}>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4 h-full flex flex-col hover:border-emerald-500/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </span>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-emerald-500/70">Income</span>
            </div>
            <p className="text-white text-lg font-bold mt-auto">{fmtMoney(income)}</p>
          </div>
        </motion.div>

        {/* Expense */}
        <motion.div variants={riseItem}>
          <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 h-full flex flex-col hover:border-red-500/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ArrowDownLeft className="w-3.5 h-3.5 text-red-400" />
              </span>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-red-500/70">Expense</span>
            </div>
            <p className="text-white text-lg font-bold mt-auto">{fmtMoney(expense)}</p>
          </div>
        </motion.div>

        {/* Spending Split */}
        <motion.div variants={riseItem}>
          <SpendingSplitCard
            personalExpense={personalExpense}
            ftExpense={onBehalfOfSummary?.totalExpense ?? 0}
            currency={displayCurrency}
          />
        </motion.div>
      </motion.div>
    </div>

    {/* ═══ SECTION 2: Deep Dive ═══ */}
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-amber-500/40 via-amber-500/10 to-transparent" />
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-amber-500/70">Deep Dive</span>
        <div className="h-px flex-1 bg-gradient-to-l from-amber-500/40 via-amber-500/10 to-transparent" />
      </div>
      <motion.div
        variants={pageContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-3"
      >
        {/* Receivables */}
        <motion.div variants={riseItem}>
          <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-5 h-full hover:border-amber-500/20 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Handshake className="w-3.5 h-3.5 text-amber-400" />
              </span>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-amber-500/70">Receivables</span>
            </div>
            {(() => {
              const receivablePeople = groupByPerson(allTransactions);
              if (receivablePeople.length === 0) return <p className="text-xs text-zinc-600">No outstanding receivables</p>;
              return (
                <div className="space-y-1.5">
                  {receivablePeople.map(p => (
                    <div key={p.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-800/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-amber-400">{p.name[0]?.toUpperCase()}</span>
                        </div>
                        <span className="text-xs font-medium text-zinc-200 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold tabular-nums text-amber-400">{fmtMoney(p.totalOwed)}</span>
                        <button
                          onClick={() => setRepaymentModal({ personName: p.name, txIds: p.txIds, totalAmount: p.totalOwed })}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-colors duration-150"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Repaid
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </motion.div>

        {/* Net Flow Hero */}
        <motion.div variants={riseItem} className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-700/30 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-5 h-full flex flex-col justify-between hover:border-zinc-600/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-500">Net flow this month</span>
                <p className={`text-money font-bold text-[28px] leading-[32px] mt-1 ${latestNet >= 0 ? 'text-emerald-400' : 'text-[#fb7185]'}`}>
                  {fmtMoney(latestNet)}
                </p>
              </div>
              {netFlowSeries.length >= 2 && (
                <Sparkline
                  data={netFlowSeries}
                  color={latestNet >= 0 ? '#34d399' : '#fb7185'}
                  width={120}
                  height={48}
                  className="shrink-0 mt-1"
                />
              )}
            </div>
            {momDelta !== null ? (
              <div className="flex items-center gap-1.5 mt-4">
                {momDelta >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-[#fb7185]" />
                )}
                <span className={`text-xs font-semibold tabular-nums ${momDelta >= 0 ? 'text-emerald-400' : 'text-[#fb7185]'}`}>
                  {momDelta >= 0 ? '+' : ''}{fmtMoney(momDelta)}
                </span>
                <span className="text-[11px] text-zinc-500">vs last month</span>
              </div>
            ) : (
              <span className="text-[11px] text-zinc-600 mt-4">Not enough history yet</span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>

    {/* ═══ SECTION 3: Insights ═══ */}
    <div className="mb-2">
      <FinanceInsightsCard
        summary={summary}
        spendingByCategory={spendingByCategory}
        monthlyTrends={monthlyTrends}
        displayCurrency={displayCurrency}
        baseCurrency={baseCurrency}
        convertAmount={convertAmount}
      />
    </div>

    {/* ═══ SECTION 4: Cashflow + Accounts ═══ */}
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/40 via-cyan-500/10 to-transparent" />
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-cyan-500/70">Cashflow & Accounts</span>
        <div className="h-px flex-1 bg-gradient-to-l from-cyan-500/40 via-cyan-500/10 to-transparent" />
      </div>
      <motion.div
        variants={pageContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        <motion.div variants={riseItem}>
          <RecentTxnsCard
            transactions={recentTransactions}
            displayCurrency={displayCurrency}
            baseCurrency={baseCurrency}
            accounts={accounts}
            categories={categories}
            wallets={wallets}
            onDeleteTransaction={onDeleteTransaction}
            onVerifyPassword={onVerifyPassword}
          />
        </motion.div>
        <motion.div variants={riseItem}>
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/50 p-5 h-full hover:border-zinc-600/30 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
              </span>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-blue-500/70">Accounts</span>
            </div>
            <div className="space-y-2">
              {personalAccounts.map(account => {
                const accountWallets = activeWallets.filter(w => w.account_id === account.id);
                const walletBalance = (w: FinanceWallet) =>
                  (w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations
                    ? (Array.isArray(w.metadata.denominations)
                        ? w.metadata.denominations.reduce((sx: number, d: any) => sx + (d.value || 0) * (d.count || 0), 0)
                        : (w.balance ?? 0))
                    : (w.balance ?? 0);
                const convertedBalance = accountWallets.reduce((sum, w) => sum + convertAmount(walletBalance(w), w.currency, displayCurrency), 0);
                return (
                  <div key={account.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{account.name}</p>
                      <span className="text-[10px] text-zinc-500 uppercase">{account.type}</span>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-white shrink-0">{fmtMoney(convertedBalance)}</p>
                  </div>
                );
              })}
              {personalAccounts.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4">No accounts yet</p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>

    {/* Repayment Modal */}
    <RepaymentModal
        open={repaymentModal !== null}
        onClose={() => setRepaymentModal(null)}
        personName={repaymentModal?.personName ?? ''}
        totalAmount={repaymentModal?.totalAmount ?? 0}
        txIds={repaymentModal?.txIds ?? []}
        wallets={activeWallets}
        displayCurrency={displayCurrency}
        onConfirm={async (data) => {
          let success = true;
          const personId = ftPersons.find(p => p.name === data.personName)?.id;
          for (const txId of data.txIds) {
            const ok = await onRecordFtRepayment?.({
              originalTxId: txId,
              personId,
              amount: data.amount / data.txIds.length,
              date: data.date,
              walletId: data.walletId,
              description: data.description,
            });
            if (!ok) { success = false; break; }
          }
          if (success) setRepaymentModal(null);
          return success;
        }}
      />
    </>
  );
}

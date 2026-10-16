import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { pageContainer, riseItem } from './_fx/financeMotion';
import { GlassSurface } from './_fx/GlassSurface';
import { EmptyState } from './EmptyState';
import { Sparkline } from './_fx/Sparkline';
import { FinStat } from './_fx/FinStat';
import { FinSection } from './_fx/FinSection';
import { TopSpendingBars } from './SpendingCategoryChart';
import { NetWorthLineChart } from './NetWorthLineChart';
import IncomeExpenseBarChart from './IncomeExpenseBarChart';
import { BudgetBurnMeter } from './BudgetBurnMeter';
import { RecentTxnsCard } from './RecentTxnsCard';
import { RepaymentModal } from './RepaymentModal';
import { groupByPerson } from '../../lib/receivables';
import { buildNetWorthSeries } from './_fx/netWorthSeries';
import { walletBalance } from './_fx/walletBalance';
import { formatCurrency as fc, convertAmount } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import type {
  FinanceAccount, FinanceWallet, FinanceCategory, FinanceTransaction,
  FinanceSummary, FinanceSpendingByCategory, FinanceMonthlyTrend, BudgetStatus,
} from './finance-types';

/**
 * OverviewTab — the /finance dashboard, restructured as A LEDGER.
 *
 * THE IDEA: money is a record, and a record has a reading order — what you have,
 * what came in, what went out, what you are owed, what you did. So this is a
 * single 12-column ledger with that order and exactly one structural hue.
 *
 * WHAT WAS WRONG WITH THE PREVIOUS VERSION (measured, not guessed):
 *  1. SIX accent hues on one surface — emerald-500 x14, amber-500 x11, red-500
 *     x9, cyan-500 x5, blue-500 x2 in this file alone, plus violet/indigo from
 *     the cards it renders. LAMINAR §7.2 hard-gate fail; colour had stopped
 *     carrying meaning.
 *  2. FOUR decorative gradient hairline bands (emerald / amber / cyan) — a
 *     §7.1 ban — costing ~108px of vertical budget to announce four labels.
 *  3. A type scale with a hole in the middle: 11x text-[10px], 6x text-xs,
 *     3x text-sm, 2x text-lg, 1x text-[28px], and nothing between 12 and 18px.
 *  4. `grid-cols-2 lg:grid-cols-3` with EXACTLY THREE children, so between
 *     768px and 1023px the third card wrapped alone onto a full-width row.
 *  5. ZERO full-size charts. The only chart was a 120x48 sparkline, while six
 *     real charts sat behind a separate tab — one of which (`budgetsGetStatus`)
 *     was fetched into FinancePage state and rendered by nothing at all.
 *  6. Dead code: `GlassSurface` imported and never rendered; `totalNetWorth`,
 *     `currencyBalances`, `custodialAccounts`, `ftMomChangePct` and `ftTrend`
 *     all computed and never read.
 *  7. `onAddTransaction` was passed by FinancePage and NOT declared in the props
 *     interface, so it was silently dropped.
 *
 * NOTHING WAS REMOVED FROM THE READER'S VIEW. The information in the old
 * SpendingSplitCard is now the Follow-Through bar in TopSpendingBars; the old
 * FinanceInsightsCard's savings rate is a KPI tile and its top-spend is the
 * ranked chart; its daily average survives as a tile caption.
 */

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
  /** Consumed by BudgetBurnMeter. Was fetched by FinancePage and read by nothing. */
  budgetStatus?: BudgetStatus | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  displayCurrency: string;
  baseCurrency: string;
  /** Intentionally unused: net worth is owned by FinanceStickyHeader. Kept in
   *  the interface so FinancePage's existing prop doesn't become an excess
   *  property, with the reason recorded where it is dropped. */
  currentNetWorth?: number;
  onCreateAccount?: (data: {
    name: string; type: FinanceAccount['type']; description?: string;
    icon?: string; color?: string;
  }) => Promise<boolean>;
  /** Previously passed by FinancePage but never declared — it was dropped. */
  onAddTransaction?: (data: any) => Promise<boolean>;
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
  allTransactions = [], categories, wallets, budgetStatus,
  loading, error, onRetry, displayCurrency, baseCurrency,
  onCreateAccount, onDeleteTransaction, onVerifyPassword, onBehalfOfSummary,
  onRecordFtRepayment, ftPersons = [],
}: OverviewTabProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [repaymentModal, setRepaymentModal] = useState<{
    personName: string; txIds: number[]; totalAmount: number;
  } | null>(null);

  /** Formats a value ALREADY in displayCurrency — never converts a second time. */
  const fmtMoney = (v: number) =>
    showNumbers ? fc(v, displayCurrency) : maskNumber(fc(v, displayCurrency), maskMode, maskFixedValue);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.is_archived), [accounts]);
  const activeWallets = useMemo(() => wallets.filter((w) => !w.is_archived), [wallets]);

  const income = convertAmount(summary?.totalIncome ?? 0, baseCurrency, displayCurrency);
  const expense = convertAmount(summary?.totalExpense ?? 0, baseCurrency, displayCurrency);
  const personalExpense = expense - (onBehalfOfSummary?.totalExpense ?? 0);

  /* Net worth is NOT rendered here. The sticky header above owns it (34px,
     with the MoM trend), so computing a second copy in this tab produced two
     cards showing the same figure at the same size, stacked — the "too near the
     top" complaint. The header is the single source; the hero chart below shows
     its TREND, which is a different fact, not a restatement. */

  /* The hero series comes from the shared builder, so the dashboard and the
     Charts tab can never show two different net-worth trends. */
  const nwSeries = useMemo(
    () => buildNetWorthSeries({
      transactions: allTransactions, wallets: activeWallets,
      baseCurrency, displayCurrency, period: 'month',
    }),
    [allTransactions, activeWallets, baseCurrency, displayCurrency],
  );

  const netFlowSeries = useMemo(
    () => monthlyTrends.map((m) => convertAmount(m.net, baseCurrency, displayCurrency)),
    [monthlyTrends, baseCurrency, displayCurrency],
  );
  const latestNet = netFlowSeries.length ? netFlowSeries[netFlowSeries.length - 1] : 0;
  const momDelta = netFlowSeries.length >= 2 ? latestNet - netFlowSeries[netFlowSeries.length - 2] : null;

  /* Savings rate is the single most useful derived number here, and it used to
     live inside a card that also drew two other stats. It gets its own tile. */
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : null;

  const avgDaily = useMemo(() => {
    if (monthlyTrends.length === 0) return null;
    const totalExp = monthlyTrends.reduce(
      (s, m) => s + convertAmount(m.expense, baseCurrency, displayCurrency), 0);
    return totalExp / (monthlyTrends.length * 30);
  }, [monthlyTrends, baseCurrency, displayCurrency]);

  const cashflow = useMemo(
    () => monthlyTrends.slice(-6).map((m) => ({
      month: m.month,
      income: convertAmount(m.income, baseCurrency, displayCurrency),
      expense: convertAmount(m.expense, baseCurrency, displayCurrency),
    })),
    [monthlyTrends, baseCurrency, displayCurrency],
  );

  const receivables = useMemo(() => groupByPerson(allTransactions), [allTransactions]);

  /* ── States (Gate D): every branch returns a real, different surface ───── */

  if (loading) return <OverviewSkeleton />;

  if (error) {
    return (
      <div className="p-5">
        <GlassError error={error} onRetry={onRetry} />
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

  return (
    <>
      <motion.div
        variants={pageContainer}
        initial="hidden"
        animate="show"
        className="fin-ledger"
      >
        {/* ── RAIL: in, out, kept ────────────────────────────────────────────
            THREE tiles, and deliberately NOT net worth. The sticky header above
            already renders net worth at 34px and owns it — repeating the same
            figure at the same size directly beneath it read as a duplicate card,
            which is what "too near the top" actually was. The rail starts with
            the month's flows instead, and the net worth TREND lives in the hero
            chart below, which complements the header rather than restating it.

            Exactly three children in a three-column grid, so nothing orphans at
            the 768-1023px band where the old two-of-three layout wrapped. */}
        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FinStat
            label="In"
            value={fmtMoney(income)}
            caption="this month"
            tone="pos"
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          />
          <FinStat
            label="Out"
            value={fmtMoney(expense)}
            caption={`${fmtMoney(personalExpense)} yours`}
            tone="neg"
            icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
          />
          <FinStat
            label="Saved"
            value={savingsRate === null ? '—' : `${savingsRate >= 0 ? '+' : ''}${savingsRate.toFixed(1)}%`}
            caption={avgDaily !== null ? `${fmtMoney(avgDaily)}/day average` : 'of money in'}
            tone={savingsRate === null ? 'flat' : savingsRate >= 0 ? 'pos' : 'neg'}
            aside={
              netFlowSeries.length >= 2 ? (
                <Sparkline data={netFlowSeries} width={72} height={26} className="shrink-0" />
              ) : undefined
            }
            delta={
              momDelta !== null
                ? { text: `${momDelta >= 0 ? '+' : ''}${fmtMoney(momDelta)}`, tone: momDelta >= 0 ? 'pos' : 'neg' }
                : undefined
            }
          />
        </div>

        {/* ── ROW 1: the hero trend, and the ranking that explains it ─────────
            Hero left at 7 columns because a time series needs horizontal room
            to be readable; the ranked list is naturally narrow. */}
        <div className="col-span-12 lg:col-span-7">
          <FinCard title="Net worth over time" hint="Month-end balance">
            {nwSeries.length > 0 ? (
              <NetWorthLineChart data={nwSeries} currency={displayCurrency} height={236} />
            ) : (
              <ChartEmpty
                label="Not enough history yet"
                body="Once there are transactions across more than one month, this becomes your balance curve."
              />
            )}
          </FinCard>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <TopSpendingBars
            data={spendingByCategory}
            baseCurrency={baseCurrency}
            displayCurrency={displayCurrency}
            convertAmount={convertAmount}
            allTransactions={allTransactions}
          />
        </div>

        {/* ── ROW 2: in vs out, and the thing you are owed ────────────────────
            Receivables sits beside cash flow because both answer "what is mine
            vs what isn't" — the ledger's next reading step. */}
        <div className="col-span-12 lg:col-span-7">
          <IncomeExpenseBarChart
            data={cashflow}
            currency={displayCurrency}
            transactions={allTransactions}
            title="Cash flow"
            height={220}
          />
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <FinCard title="Receivables" hint="money you fronted">
            {receivables.length === 0 ? (
              <ChartEmpty
                label="Nothing outstanding"
                body="When you cover spending for someone else, they show up here until it's repaid."
              />
            ) : (
              <ul className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {receivables.map((p) => (
                  <li
                    key={p.name}
                    className="fin-surface--sunken rounded-lg px-3 py-2 flex items-center justify-between gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="fin-avatar" aria-hidden="true">
                        {p.name[0]?.toUpperCase()}
                      </span>
                      <span className="fin-body-strong truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="fin-figure text-[13px] fin-owed">{fmtMoney(p.totalOwed)}</span>
                      <button
                        type="button"
                        onClick={() => setRepaymentModal({ personName: p.name, txIds: p.txIds, totalAmount: p.totalOwed })}
                        className="fin-label flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--color-border)] hover:border-[var(--page-accent)] transition-colors duration-150 fin-focusable"
                      >
                        <RotateCcw className="w-3 h-3" aria-hidden="true" />
                        Mark repaid
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </FinCard>

          <BudgetBurnMeter
            data={budgetStatus ?? null}
            displayCurrency={displayCurrency}
            baseCurrency={baseCurrency}
            convertAmount={convertAmount}
          />
        </div>

        {/* ── ROW 3: the ledger's last line — what actually happened ─────────── */}
        <div className="col-span-12">
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
        </div>

        {/* ── ROW 4: accounts, last, because it is reference not reading ────── */}
        <div className="col-span-12">
          <FinCard title="Accounts" hint="balance per account">
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {activeAccounts.filter((a) => a.type !== 'custodial').map((account) => {
                /* Uses the SHARED derivation — see _fx/walletBalance.ts for why
                   this cannot be re-inlined. The previous inline version read
                   `.denominations` off a `string`, so the cash/physical branch
                   never ran and disagreed with the sticky header. */
                const converted = activeWallets
                  .filter((w) => w.account_id === account.id)
                  .reduce((sum, w) => sum + convertAmount(walletBalance(w), w.currency, displayCurrency), 0);
                return (
                  <li key={account.id} className="fin-surface--sunken rounded-lg px-3 py-2 flex items-center justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="fin-body-strong truncate">{account.name}</p>
                      <span className="fin-label uppercase">{account.type}</span>
                    </div>
                    <p className="fin-figure text-[15px] shrink-0">{fmtMoney(converted)}</p>
                  </li>
                );
              })}
            </ul>
          </FinCard>
        </div>
      </motion.div>

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
          const personId = ftPersons.find((p) => p.name === data.personName)?.id;
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

/* ── Local surfaces ─────────────────────────────────────────────────────────
   Small wrappers rather than four more bespoke cards, so the surface recipe
   stays in ONE place. A "loading" state that does not match the shape of the
   loaded state is the reason skeletons read as fake. */

function FinCard({ title, hint, children, action }: {
  title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <GlassSurface className="p-5 flex flex-col gap-4 h-full">
      <FinSection title={title} hint={hint} action={action} />
      {children}
    </GlassSurface>
  );
}

function ChartEmpty({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
      <p className="fin-body-strong">{label}</p>
      <p className="fin-body max-w-[40ch]">{body}</p>
    </div>
  );
}

function GlassError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive-10)] p-5 flex flex-col items-center text-center gap-3"
    >
      <AlertTriangle className="w-6 h-6 fin-neg" aria-hidden="true" />
      {/* Gate F: "[Thing] [verb] because [reason]. [Action]." — not "Oops". */}
      <p className="fin-body max-w-[46ch]">{error}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="fin-body-strong px-4 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--page-accent)] transition-colors duration-150 fin-focusable"
        >
          Reload finance data
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton mirrors the LOADED silhouette: 4-tile rail, hero, side, wide row.
 * A generic spinner here is why "loading" felt slower than it was.
 */
function OverviewSkeleton() {
  return (
    <div className="fin-ledger" aria-busy="true" aria-label="Loading finance overview">
      <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fin-surface p-5 h-[124px] animate-pulse" />
        ))}
      </div>
      <motion.div variants={riseItem} className="col-span-12 lg:col-span-7">
        <div className="fin-surface p-5 h-[300px] animate-pulse" />
      </motion.div>
      <div className="col-span-12 lg:col-span-5">
        <div className="fin-surface p-5 h-[300px] animate-pulse" />
      </div>
      <div className="col-span-12 lg:col-span-7">
        <div className="fin-surface p-5 h-[260px] animate-pulse" />
      </div>
      <div className="col-span-12 lg:col-span-5">
        <div className="fin-surface p-5 h-[260px] animate-pulse" />
      </div>
      <div className="col-span-12">
        <div className="fin-surface p-5 h-[180px] animate-pulse" />
      </div>
    </div>
  );
}
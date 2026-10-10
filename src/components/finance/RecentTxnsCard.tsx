import { useState, useMemo } from 'react';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { TransactionDetailModal } from './TransactionDetailModal';
import { Handshake, CircleCheck, Bell } from 'lucide-react';
import { getRepaymentStatus, getFtPerson } from '../../lib/receivables';
import type { FinanceTransaction, FinanceAccount, FinanceCategory, FinanceWallet } from '../finance/finance-types';

type TxFilter = 'personal' | 'follow-through' | 'all';

interface RecentTxnsCardProps {
  transactions: FinanceTransaction[];
  displayCurrency: string;
  baseCurrency?: string;
  accounts?: FinanceAccount[];
  categories?: FinanceCategory[];
  wallets?: FinanceWallet[];
  onDeleteTransaction?: (id: number) => Promise<boolean>;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  onRecordFtRepayment?: (data: { originalTxId: number; personId?: number; amount: number; date: string; walletId?: number; description?: string; isOverpayment?: boolean }) => Promise<boolean>;
}

export function RecentTxnsCard({
  transactions, displayCurrency, baseCurrency = displayCurrency,
  accounts = [], categories = [], wallets = [],
  onDeleteTransaction, onVerifyPassword, onRecordFtRepayment,
}: RecentTxnsCardProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [detailTxn, setDetailTxn] = useState<FinanceTransaction | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>('personal');

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const filteredTxns = useMemo(() => {
    if (txFilter === 'personal') return transactions.filter(tx => !tx.on_behalf_of);
    if (txFilter === 'follow-through') return transactions.filter(tx => tx.on_behalf_of);
    return transactions;
  }, [transactions, txFilter]);

  const recent = filteredTxns.slice(0, 5);

  const followThroughCount = useMemo(() => transactions.filter(tx => tx.on_behalf_of).length, [transactions]);

  return (
    <GlassSurface className="p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-zinc-500">
          Recent
        </span>
        <span className="text-[11px] text-zinc-600 cursor-default">View all</span>
      </div>

      {/* Follow Through filter toggle */}
      {followThroughCount > 0 && (
        <div className="flex items-center gap-1 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] p-1 rounded-xl mb-1">
          {([
            { key: 'personal' as TxFilter, label: 'Personal' },
            { key: 'follow-through' as TxFilter, label: 'Follow Through' },
            { key: 'all' as TxFilter, label: 'All' },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setTxFilter(opt.key)}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                txFilter === opt.key
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.key === 'follow-through' && <Handshake className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
              {opt.label}
              {opt.key === 'follow-through' && followThroughCount > 0 && (
                <span className="ml-1 text-amber-400">({followThroughCount})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {recent.length === 0 ? (
        <p className="text-xs text-zinc-600 py-4 text-center">
          {txFilter === 'personal' ? 'No personal activity yet' : txFilter === 'follow-through' ? 'No follow through activity' : 'No activity yet'}
        </p>
      ) : (
        recent.map((tx, i) => {
          const isFT = tx.on_behalf_of === 1 && tx.type === 'expense';
          const isHistorical = tx.is_adjustment === 1;
          const isSubscription = tx.description?.startsWith('Subscription:') || tx.note?.startsWith('Subscription:');
          const ftPerson = isFT ? getFtPerson(tx) : null;
          const repayment = isFT ? getRepaymentStatus(tx, transactions) : null;
          return (
          <div
            key={tx.id}
            onClick={() => setDetailTxn(tx)}
            className={`flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] rounded-lg -mx-2 px-2 transition-colors cursor-pointer ${isFT ? 'border-l-2 border-l-amber-400 -ml-2 pl-3' : isSubscription ? 'border-l-2 border-l-indigo-400 -ml-2 pl-3' : isHistorical ? 'border-l-2 border-l-violet-400 -ml-2 pl-3' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isFT ? (
                  <Handshake className="w-3 h-3 text-amber-400 shrink-0" />
                ) : isSubscription ? (
                  <Bell className="w-3 h-3 text-indigo-400 shrink-0" />
                ) : isHistorical ? (
                  <span className="w-3 h-3 text-violet-400 shrink-0 text-[10px] font-bold">H</span>
                ) : null}
                <p className="text-sm font-semibold text-zinc-200 truncate">{tx.description || 'Transaction'}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[11px] text-zinc-500">{getTimeAgo(tx.date)}</p>
                {tx.fee > 0 && (
                  <span className="text-[9px] text-zinc-500">fee: {formatCurrency(tx.fee, displayCurrency)}</span>
                )}
                {isFT && ftPerson && (
                  <span className="text-[9px] px-1 py-0 rounded bg-amber-500/15 text-amber-400 font-medium">for {ftPerson}</span>
                )}
                {isFT && repayment?.repaid && (
                  <CircleCheck className="w-2.5 h-2.5 text-emerald-400" />
                )}
                {isFT && repayment && !repayment.repaid && (
                  <span className="text-[9px] text-amber-400/60">owed</span>
                )}
                {isSubscription && (
                  <span className="text-[9px] px-1 py-0 rounded bg-indigo-500/15 text-indigo-400 font-medium">recurring</span>
                )}
                {isHistorical && (
                  <span className="text-[9px] px-1 py-0 rounded bg-violet-500/15 text-violet-400 font-medium">historical</span>
                )}
                {tx.merchant && (
                  <span className="text-[9px] text-zinc-500">{tx.merchant}</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {(() => {
                if (tx.metadata) {
                  try {
                    const m = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
                    if ((m.coinId || m.coin_id) && m.qty) {
                      const sym = (m.symbol || '').toUpperCase();
                      const qty = Number(m.qty);
                      const price = Number(m.price) || 0;
                      const fiatVal = qty * price;
                      const sign = (tx.amount ?? 0) >= 0 ? '+' : '−';
                      return (
                        <>
                          <p className={`text-sm font-semibold tabular-nums ${(tx.amount ?? 0) >= 0 ? 'text-emerald-400' : 'text-[#fb7185]'}`}>
                            {sign}{qty.toFixed(8).replace(/\.?0+$/, '')} <span className="text-[#8B5CF6]">{sym}</span>
                          </p>
                          {fiatVal > 0 && (
                            <p className="text-[10px] text-zinc-500 tabular-nums">≈ {formatCurrency(fiatVal, displayCurrency)}</p>
                          )}
                        </>
                      );
                    }
                  } catch { /* ignore */ }
                }
                return (
                  <span className={`text-money text-sm font-semibold shrink-0 ${
                    (tx.amount ?? 0) >= 0 ? 'text-emerald-400' : 'text-[#fb7185]'
                  }`}>
                    {(tx.amount ?? 0) >= 0 ? '+' : '−'}
                    {showNumbers
                      ? formatCurrency(Math.abs(tx.amount ?? 0), displayCurrency)
                      : maskNumber(formatCurrency(Math.abs(tx.amount ?? 0), displayCurrency), maskMode, maskFixedValue)}
                  </span>
                );
              })()}
            </div>
          </div>
          );
        })
      )}

      <TransactionDetailModal
        transaction={detailTxn}
        accounts={accounts}
        categories={categories}
        wallets={wallets}
        allTransactions={transactions}
        displayCurrency={displayCurrency}
        baseCurrency={baseCurrency}
        onClose={() => setDetailTxn(null)}
        onDelete={onDeleteTransaction}
        onVerifyPassword={onVerifyPassword}
        onRecordFtRepayment={onRecordFtRepayment}
      />
    </GlassSurface>
  );
}

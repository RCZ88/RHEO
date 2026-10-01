import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowUpRight, ArrowDownRight, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { getCurrencyInfo } from './currency-data';
import { modalBackdrop, modalPanel, scaleItem } from './_fx/financeMotion';

export interface RecalculateBreakdown {
  transactionId: number;
  description: string;
  amount: number;
  delta: number;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  runningBalance: number;
  is_adjustment?: number;
  cryptoQty?: number;
  cryptoSymbol?: string;
}

interface RecalculateBalanceModalProps {
  open: boolean;
  onClose: () => void;
  walletName: string;
  initialBalance: number;
  currentBalance: number;
  computedBalance: number;
  breakdown: RecalculateBreakdown[];
  displayCurrency: string;
  onApply: () => Promise<void>;
}

const typeIcon = {
  income: ArrowUpRight,
  expense: ArrowDownRight,
  transfer: ArrowLeftRight,
};

const typeColor = {
  income: 'text-emerald-400',
  expense: 'text-red-400',
  transfer: 'text-amber-400',
};

const typeBg = {
  income: 'bg-emerald-500/10',
  expense: 'bg-red-500/10',
  transfer: 'bg-amber-500/10',
};

const typeLabel = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

export function RecalculateBalanceModal({
  open, onClose, walletName, initialBalance, currentBalance, computedBalance, breakdown, displayCurrency, onApply,
}: RecalculateBalanceModalProps) {
  const currencyInfo = getCurrencyInfo(displayCurrency);
  const symbol = currencyInfo?.symbol || '$';
  const diff = computedBalance - currentBalance;
  const diffAbs = Math.abs(diff);

  const { incomeTotal, expenseTotal, incomeCount, expenseCount } = useMemo(() => {
    let inc = 0, exp = 0, incC = 0, expC = 0;
    for (const t of breakdown) {
      const amt = Number(t.amount) || Number(t.delta) || 0;
      if (t.type === 'income') { inc += amt; incC++; }
      else if (t.type === 'expense') { exp += amt; expC++; }
      else if (t.type === 'transfer') {
        if (t.cryptoQty != null) {
          if (amt < 0) { exp += Math.abs(amt); expC++; }
          else { inc += amt; incC++; }
        } else {
          if (amt > 0) inc += amt; else exp += Math.abs(amt);
          incC++;
        }
      }
    }
    return { incomeTotal: inc, expenseTotal: Math.abs(exp), incomeCount: incC, expenseCount: expC };
  }, [breakdown]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" variants={modalBackdrop} initial="hidden" animate="show" exit="hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-zinc-900/95 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden"
            variants={modalPanel} initial="hidden" animate="show" exit="exit"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700/30 shrink-0">
              <h2 className="text-sm font-semibold text-white">Recalculate Balance</h2>
              <button onClick={onClose} className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Current</div>
                  <div className="text-lg font-bold text-white">{(currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Current stored balance</div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/30">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Computed</div>
                  <div className="text-lg font-bold" style={{ color: diff === 0 ? '#a3e635' : diff > 0 ? '#34d399' : '#f87171' }}>
                    {computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">From transaction history</div>
                </div>
                <div className="rounded-xl p-3 border" style={{
                  backgroundColor: diff === 0 ? 'rgba(163,230,53,0.08)' : diff > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                  borderColor: diff === 0 ? 'rgba(163,230,53,0.2)' : diff > 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                }}>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Difference</div>
                  <div className="text-lg font-bold" style={{ color: diff === 0 ? '#a3e635' : diff > 0 ? '#34d399' : '#f87171' }}>
                    {diff >= 0 ? '+' : ''}{diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: diff === 0 ? '#a3e635' : diff > 0 ? '#34d399' : '#f87171' }}>
                    {diff === 0 ? 'Balanced' : diff > 0 ? `${symbol}${diffAbs.toLocaleString()} under-counted` : `${symbol}${diffAbs.toLocaleString()} over-counted`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 px-3 py-2 bg-zinc-800/30 rounded-lg text-xs text-zinc-400">
                <span>Initial balance: <span className="text-white font-medium">{initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                <span className="text-zinc-600">|</span>
                <span>Income: <span className="text-emerald-400 font-medium">+{incomeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                <span className="text-zinc-600">|</span>
                <span>Expenses: <span className="text-red-400 font-medium">{expenseTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                <span className="text-zinc-600">|</span>
                <span><span className="text-zinc-500">{incomeCount + expenseCount}</span> transactions</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 px-1 py-1">
                  <span>Transaction Breakdown</span>
                  <span>Running total</span>
                </div>
                <div className="space-y-0.5 max-h-[320px] overflow-y-auto pr-1">
                  {breakdown.map((txn) => (
                    <motion.div key={txn.transactionId} variants={scaleItem} initial="hidden" animate="show" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-800/20 hover:bg-zinc-800/40 transition-colors">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${typeBg[txn.type]}`}>
                        {(() => { const Icon = typeIcon[txn.type]; return <Icon className={`w-3.5 h-3.5 ${typeColor[txn.type]}`} />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white truncate">{txn.description || `Transaction #${txn.transactionId}`}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeBg[txn.type]} ${typeColor[txn.type]}`}>{typeLabel[txn.type]}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500">{txn.date}</div>
                      </div>
                      <div className="text-right">
                        {txn.cryptoQty != null ? (
                          <div className={`text-xs font-medium ${txn.cryptoQty >= 0 ? 'text-violet-400' : 'text-red-400'}`}>
                            {txn.cryptoQty >= 0 ? '+' : ''}{txn.cryptoQty.toFixed(8)} {txn.cryptoSymbol}
                          </div>
                        ) : (
                          <div className={`text-xs font-medium ${(txn.delta || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(txn.delta || 0) >= 0 ? '+' : ''}{(txn.delta || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                        <div className="text-[10px] text-zinc-500">{(txn.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {diff !== 0 && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-300/90">
                    The computed balance differs from the stored balance by <strong>{symbol}{diffAbs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>.
                    This can happen if transactions were added, edited, or deleted without updating the wallet balance.
                    Click <strong>Apply Computed Balance</strong> to sync.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-700/30 shrink-0 bg-zinc-900/50">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={onApply}
                disabled={diff === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: diff === 0 ? 'rgba(163,230,53,0.15)' : 'rgba(52,211,153,0.2)',
                  color: diff === 0 ? '#a3e635' : '#34d399',
                }}
              >
                <Check className="w-3.5 h-3.5" />
                {diff === 0 ? 'Already Balanced' : 'Apply Computed Balance'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

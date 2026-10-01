import { useState, useMemo, useCallback } from 'react';
import { X, Wallet, Check, AlertCircle, ArrowLeft, Calculator, Calendar } from 'lucide-react';
import type { FinanceFtPerson, FinanceTransaction, FinanceWallet } from './finance-types';
import { CurrencyInput } from './CurrencyInput';
import { computeAllocation, buildRepaymentDescription } from '../../lib/paymentAllocation';
import { getRepaymentStatus } from '../../lib/receivables';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

interface PaymentAllocationModalProps {
  open: boolean;
  onClose: () => void;
  person: FinanceFtPerson;
  transactions: FinanceTransaction[];
  wallets: FinanceWallet[];
  displayCurrency: string;
  onRefresh: () => void;
}

export function PaymentAllocationModal({
  open, onClose, person, transactions, wallets, displayCurrency, onRefresh
}: PaymentAllocationModalProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? v.toFixed(2) : maskNumber(v.toFixed(2), maskMode, maskFixedValue);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedWallet, setSelectedWallet] = useState<number | null>(wallets[0]?.id ?? null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [autoMode, setAutoMode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const personTxns = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.ft_person_id === person.id) return true;
      if (tx.on_behalf_of_label === person.name) return true;
      return false;
    }).filter(tx => tx.type === 'expense' && tx.on_behalf_of === 1)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, person]);

  const unpaidTxs = useMemo(() => {
    return personTxns.map(tx => {
      const status = getRepaymentStatus(tx, transactions);
      const remaining = Math.abs(tx.amount) - status.totalRepaid;
      return { tx, remaining: Math.max(0, remaining), isRepaid: status.repaid };
    }).filter(({ remaining, isRepaid }) => !isRepaid && remaining > 0);
  }, [personTxns, transactions]);

  const numericAmount = parseFloat(amount) || 0;

  const allocation = useMemo(() => {
    if (numericAmount <= 0 || unpaidTxs.length === 0) return null;
    const txIds = autoMode ? undefined : Array.from(selectedTxIds);
    return computeAllocation(numericAmount, personTxns, transactions, txIds);
  }, [numericAmount, unpaidTxs, personTxns, transactions, autoMode, selectedTxIds]);

  const toggleTxSelection = useCallback((txId: number) => {
    setAutoMode(false);
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId); else next.add(txId);
      return next;
    });
  }, []);

  const handleAutoMode = useCallback(() => {
    setAutoMode(true);
    setSelectedTxIds(new Set());
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!allocation || numericAmount <= 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      for (const item of allocation.items) {
        if (item.status === 'none') continue;
        const isOverpayment = item.status === 'full' && allocation.overpaymentAmount > 0 &&
          item.txId === allocation.items[allocation.items.length - 1].txId;
        const result = await (window as any).deskflowAPI?.financeRecordFtRepayment({
          originalTxId: item.txId, personId: person.id, amount: item.allocatedAmount,
          date: date, walletId: selectedWallet || undefined,
          accountId: personTxns[0]?.account_id,
          description: buildRepaymentDescription(person.name, allocation),
          isOverpayment: isOverpayment && allocation.overpaymentAmount > 0,
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to record repayment');
      }
      onRefresh();
      onClose();
    } catch (err: any) { setError(err.message || 'Failed to process payment'); }
    finally { setIsSubmitting(false); }
  }, [allocation, numericAmount, person, selectedWallet, personTxns, onRefresh, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="flex-shrink-0 p-5 border-b border-zinc-800/60">
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h2 className="text-sm font-semibold text-zinc-100">Record Payment</h2>
            <div className="w-8" />
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 text-center">From {person.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold pointer-events-none">{displayCurrency}</span>
              <CurrencyInput value={amount} onChange={(v) => setAmount(String(v))} placeholder="0.00"
                className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 pl-8 pr-3 py-2.5 text-sm font-bold text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500/50 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Deposit to Wallet</label>
            <select value={selectedWallet ?? ''} onChange={e => setSelectedWallet(Number(e.target.value) || null)}
              className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-amber-500/50 transition-colors">
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({displayCurrency}{fmtMoney(w.balance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Date received</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 pl-8 pr-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-amber-500/50 transition-colors" />
            </div>
          </div>

          {allocation && numericAmount > 0 && (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
              <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                <Calculator className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Auto-allocation preview</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Covers {allocation.coveredTxIds.length} transaction(s) fully
                {allocation.partialTxIds.length > 0 && `, ${allocation.partialTxIds.length} partially`}
                {allocation.overpaymentAmount > 0 && ` · ${displayCurrency}${fmtMoney(allocation.overpaymentAmount)} overpayment credit`}
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Select transactions to cover</label>
              <button onClick={handleAutoMode}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors ${autoMode ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-zinc-400'}`}>
                Auto
              </button>
            </div>
            {unpaidTxs.length === 0 ? (
              <div className="rounded-xl bg-zinc-800/30 border border-zinc-800/60 p-4 text-center">
                <Check className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-zinc-400">All transactions repaid!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unpaidTxs.map(({ tx, remaining }) => {
                  const isSelected = selectedTxIds.has(tx.id) || autoMode;
                  const allocItem = allocation?.items.find(i => i.txId === tx.id);
                  const willBeCovered = allocItem && (allocItem.status === 'full' || allocItem.status === 'partial');
                  return (
                    <button key={tx.id} onClick={() => toggleTxSelection(tx.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-all duration-150 ${isSelected && !autoMode ? 'bg-amber-500/5 border-amber-500/30' : 'bg-zinc-800/30 border-zinc-800/60 hover:border-zinc-700/60'} ${willBeCovered ? 'ring-1 ring-emerald-500/20' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'}`}>
                            {isSelected && <Check className="w-3 h-3 text-black" />}
                          </div>
                          <span className="text-xs font-medium text-zinc-200">{tx.description || 'Expense'}</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-300">{displayCurrency}{fmtMoney(Math.abs(tx.amount))}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 ml-6">
                        <span className="text-[10px] text-zinc-500">
                          {new Date(tx.date).toLocaleDateString()} · {displayCurrency}{fmtMoney(remaining)} remaining
                        </span>
                        {willBeCovered && allocItem && (
                          <span className={`text-[10px] font-medium ${allocItem.status === 'full' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {allocItem.status === 'full' ? 'Fully covered' : `Partial: ${displayCurrency}${fmtMoney(allocItem.allocatedAmount)}`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-red-400">{error}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 p-5 border-t border-zinc-800/60 space-y-2">
          <button onClick={handleSubmit} disabled={!allocation || numericAmount <= 0 || isSubmitting}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-xs py-3 transition-colors flex items-center justify-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
          </button>
          <button onClick={onClose} className="w-full py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

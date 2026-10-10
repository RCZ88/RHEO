import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Handshake, Calendar, AlertTriangle, Check, RotateCcw, Info } from 'lucide-react';
import { getCurrencyInfo } from './currency-data';
import { CurrencyInput } from './CurrencyInput';
import type { FinanceTransaction, FinanceWallet } from './finance-types';

interface RepaymentModalProps {
  open: boolean;
  onClose: () => void;
  personName: string;
  personId?: number;
  totalAmount: number;
  amountOwed?: number;
  txIds: number[];
  originalTx?: FinanceTransaction;
  wallets: FinanceWallet[];
  displayCurrency: string;
  onConfirm: (data: {
    personName: string;
    personId?: number;
    amount: number;
    date: string;
    walletId: number;
    description: string;
    txIds: number[];
    isOverpayment?: boolean;
  }) => Promise<boolean>;
}

export function RepaymentModal({
  open, onClose, personName, personId, totalAmount, amountOwed, txIds, originalTx, wallets, displayCurrency, onConfirm,
}: RepaymentModalProps) {
  const [amount, setAmount] = useState(String(amountOwed ?? totalAmount));
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [walletId, setWalletId] = useState<number>(wallets.find(w => !w.is_archived)?.id ?? 0);
  const [description, setDescription] = useState(`Repayment from ${personName}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [partial, setPartial] = useState(false);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setAmount(String(amountOwed ?? totalAmount));
      setDate(new Date().toISOString().split('T')[0]);
      setWalletId(wallets.find(w => !w.is_archived)?.id ?? 0);
      setDescription(`Repayment from ${personName}`);
      setSaving(false);
      setError(null);
      setSuccess(false);
      setPartial(false);
    }
    prevOpen.current = open;
  }, [open, personName, totalAmount, amountOwed, wallets]);

  const handleConfirm = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!walletId) { setError('Select a wallet'); return; }
    const owed = amountOwed ?? totalAmount;
    const isOverpayment = amt > owed;
    setSaving(true);
    setError(null);
    try {
      const ok = await onConfirm({
        personName, personId, amount: amt, date, walletId, description, txIds, isOverpayment,
      });
      if (ok) {
        setSuccess(true);
        setTimeout(() => onClose(), 1000);
      } else {
        setError('Failed to record repayment');
      }
    } catch { setError('An error occurred'); }
    finally { setSaving(false); }
  };

  const symbol = getCurrencyInfo(displayCurrency).symbol;
  const owed = amountOwed ?? totalAmount;
  const amtNum = parseFloat(amount) || 0;
  const isOverpayment = amtNum > owed;

  return (
    <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-4 ${open ? '' : 'hidden'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Handshake className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Record Repayment</h3>
            <p className="text-[10px] text-zinc-500">{personName} paid you back</p>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-10">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white">Repayment Recorded</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {/* Amount owed info */}
            {owed > 0 && amountOwed !== undefined && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 text-[11px] text-zinc-400">
                <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Amount still owed: <strong className="text-zinc-200">{symbol}{owed.toFixed(2)}</strong></span>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
                Amount repaid
                {owed > 0 && amountOwed !== undefined && (
                  <button
                    onClick={() => { setPartial(!partial); if (!partial) setAmount(''); }}
                    className="ml-2 text-[10px] text-amber-400/70 hover:text-amber-400"
                  >
                    {partial ? 'Full amount' : 'Partial?'}
                  </button>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">{symbol}</span>
                <CurrencyInput
                  value={amount}
                  onChange={(v) => setAmount(String(v))}
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Overpayment warning */}
            {isOverpayment && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-[11px]">
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                Overpayment — {symbol}{(amtNum - owed).toFixed(2)} above owed amount will be tracked separately
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Date received</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              </div>
            </div>

            {/* Wallet */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Deposit to wallet</label>
              <select value={walletId} onChange={e => setWalletId(Number(e.target.value))}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                <option value={0} disabled>Select wallet</option>
                {wallets.filter(w => !w.is_archived).map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Check className="w-3.5 h-3.5" /> Record Repayment</>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

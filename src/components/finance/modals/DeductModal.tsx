import { useState } from 'react';
import { X, Minus } from 'lucide-react';

interface DeductModalProps {
  open: boolean;
  onClose: () => void;
  personName: string;
  personId: number;
  currentBalance: number;
  displayCurrency: string;
  onSubmit: (data: { personId: number; amount: number; description?: string }) => Promise<{ success: boolean; error?: string }>;
  onDone: () => void;
}

export function DeductModal({ open, onClose, personName, personId, currentBalance, displayCurrency, onSubmit, onDone }: DeductModalProps) {
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
  const canSubmit = amount > 0 && amount <= currentBalance && !saving;

  const formatWithCommas = (value: string) => {
    const raw = value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    if (parts.length > 2) return amountStr;
    if (parts[1] && parts[1].length > 2) return amountStr;
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const result = await onSubmit({ personId, amount, description: description.trim() || undefined });
      if (result.success) {
        onDone();
      } else {
        setError(result.error || 'Failed to deduct');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to deduct');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Deduct from Balance</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Reduce {personName}&apos;s stored balance</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current balance */}
          <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3 flex items-center justify-between">
            <span className="text-[11px] text-violet-400/80">Current Balance</span>
            <span className="text-sm font-bold text-violet-400 tabular-nums">{displayCurrency}{currentBalance.toFixed(2)}</span>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1.5 block">Amount to Deduct</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{displayCurrency}</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={e => setAmountStr(formatWithCommas(e.target.value))}
                placeholder="0.00"
                autoFocus
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 pl-8 pr-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
            {amount > currentBalance && (
              <p className="text-[10px] text-red-400/80 mt-1">Amount exceeds available balance</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1.5 block">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Used for groceries"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{error}</p>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose}
            className="flex-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs py-2.5 hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex-1 rounded-lg bg-amber-500 text-black text-xs py-2.5 font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Minus className="w-3.5 h-3.5" />
            {saving ? 'Deducting...' : 'Deduct'}
          </button>
        </div>
      </div>
    </div>
  );
}

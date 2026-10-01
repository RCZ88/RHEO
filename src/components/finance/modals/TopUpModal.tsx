import { useState, useMemo } from 'react';
import { X, Wallet, Calendar, ChevronDown, Check } from 'lucide-react';
import type { FinanceWallet } from './finance-types';

const getTodayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  personName: string;
  personId: number;
  wallets: FinanceWallet[];
  displayCurrency: string;
  onSubmit: (data: { personId: number; walletId: number; amount: number; description?: string; date?: string }) => Promise<{ success: boolean; error?: string }>;
  onDone: () => void;
}

export function TopUpModal({ open, onClose, personName, personId, wallets, displayCurrency, onSubmit, onDone }: TopUpModalProps) {
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  const activeWallets = useMemo(() => wallets.filter(w => !w.is_archived), [wallets]);
  const selectedWallet = activeWallets.find(w => w.id === selectedWalletId);
  const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
  const canSubmit = selectedWalletId !== null && amount > 0 && !saving;

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
      const result = await onSubmit({ personId, walletId: selectedWalletId, amount, description: description.trim() || undefined, date });
      if (result.success) {
        onDone();
      } else {
        setError(result.error || 'Failed to top up');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to top up');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Top Up Balance</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Add funds for {personName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Wallet Picker */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1.5 block">From Wallet</label>
            <div className="relative">
              <button
                onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                className="w-full flex items-center justify-between rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2.5 text-xs text-left transition-colors hover:border-zinc-600"
              >
                {selectedWallet ? (
                  <span className="text-zinc-200">{selectedWallet.name} — {displayCurrency}{(selectedWallet.balance ?? 0).toFixed(2)}</span>
                ) : (
                  <span className="text-zinc-600">Select a wallet...</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${walletDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {walletDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700/60 shadow-xl py-1 max-h-48 overflow-y-auto">
                  {activeWallets.map(w => (
                    <button
                      key={w.id}
                      onClick={() => { setSelectedWalletId(w.id); setWalletDropdownOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors"
                    >
                      <span className="text-zinc-200">{w.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 tabular-nums">{displayCurrency}{(w.balance ?? 0).toFixed(2)}</span>
                        {w.id === selectedWalletId && <Check className="w-3 h-3 text-emerald-400" />}
                      </div>
                    </button>
                  ))}
                  {activeWallets.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-600">No wallets available</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1.5 block">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{displayCurrency}</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={e => setAmountStr(formatWithCommas(e.target.value))}
                placeholder="0.00"
                autoFocus
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 pl-8 pr-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            {selectedWallet && amount > (selectedWallet.balance ?? 0) && (
              <p className="text-[10px] text-amber-400/80 mt-1">Amount exceeds wallet balance</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1.5 block">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Lunch money, taxi fare..."
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1.5 block">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/60 pl-9 pr-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose}
            className="flex-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs py-2.5 hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex-1 rounded-lg bg-emerald-500 text-black text-xs py-2.5 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            {saving ? 'Topping up...' : 'Top Up'}
          </button>
        </div>
      </div>
    </div>
  );
}

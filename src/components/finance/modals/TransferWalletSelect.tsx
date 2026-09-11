import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Landmark, Wallet, Banknote, CreditCard, PiggyBank, WalletCards, ChevronDown, Nfc } from 'lucide-react';
import type { FinanceWallet, FinanceAccount } from '../finance-types';
import { convertAmount, formatCurrency as fmtCurrency } from '../currency-data';

const walletMeta: Record<string, { icon: any; color: string }> = {
  bank: { icon: Landmark, color: '#3B82F6' },
  debit_card: { icon: CreditCard, color: '#10B981' },
  credit_card: { icon: CreditCard, color: '#F59E0B' },
  crypto: { icon: Wallet, color: '#8B5CF6' },
  cash: { icon: PiggyBank, color: '#EC4899' },
  physical: { icon: WalletCards, color: '#F97316' },
  ewallet: { icon: Banknote, color: '#06B6D4' },
  prepaid_card: { icon: Nfc, color: '#22D3EE' },
  other: { icon: Wallet, color: '#6B7280' },
};

interface TransferWalletSelectProps {
  wallets: FinanceWallet[];
  accounts: FinanceAccount[];
  excludeWalletId: number;
  selectedWalletId: number | null;
  onSelect: (walletId: number) => void;
  displayCurrency: string;
}

export function TransferWalletSelect({
  wallets, accounts, excludeWalletId, selectedWalletId, onSelect, displayCurrency,
}: TransferWalletSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const available = useMemo(() => {
    let list = wallets.filter(w => w.id !== excludeWalletId && !w.is_archived);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.provider || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [wallets, excludeWalletId, search]);

  const grouped = useMemo(() => {
    const map: Record<number, { account: FinanceAccount; wallets: FinanceWallet[] }> = {};
    for (const w of available) {
      const acct = accounts.find(a => a.id === w.account_id);
      if (!acct) continue;
      if (!map[acct.id]) map[acct.id] = { account: acct, wallets: [] };
      map[acct.id].wallets.push(w);
    }
    return Object.values(map).sort((a, b) => a.account.name.localeCompare(b.account.name));
  }, [available, accounts]);

  const selected = wallets.find(w => w.id === selectedWalletId);
  const selectedMeta = selected ? (walletMeta[selected.type] || walletMeta.other) : null;
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropAbove, setDropAbove] = useState(false);

  useEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    setDropAbove(spaceBelow < 320 && spaceAbove > spaceBelow);
  }, [open]);

  const fc = (amount: number, currency: string) =>
    fmtCurrency(convertAmount(amount, currency, displayCurrency), displayCurrency);

  return (
    <div className="relative" ref={triggerRef}>
      <label className="block text-[11px] text-zinc-500 mb-1">Destination wallet</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${
          open ? 'border-zinc-600 bg-zinc-800/50' : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600'
        } ${!selected ? 'text-zinc-500' : 'text-white'}`}
      >
        {selected && selectedMeta ? (
          <>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${selectedMeta.color}18` }}>
              <selectedMeta.icon className="w-3.5 h-3.5" style={{ color: selectedMeta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{selected.name}</p>
              <p className="text-[10px] text-zinc-500">
                {fc(selected.balance, selected.currency || displayCurrency)}
              </p>
            </div>
          </>
        ) : (
          <span className="text-sm text-zinc-500">Select a wallet...</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute left-0 right-0 z-20 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-xl overflow-hidden max-h-60 ${
              dropAbove ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            {/* Search */}
            <div className="relative border-b border-zinc-800">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search wallets..."
                className="w-full bg-transparent pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 outline-none"
                autoFocus
              />
            </div>

            {/* Wallet list grouped by account */}
            <div className="overflow-y-auto max-h-48">
              {grouped.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  {search ? 'No matching wallets' : 'No other wallets available'}
                </div>
              ) : (
                grouped.map(({ account, wallets: sectionWallets }) => (
                  <div key={account.id}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider bg-zinc-900/80">
                      {account.name}
                    </div>
                    {sectionWallets.map(w => {
                      const meta = walletMeta[w.type] || walletMeta.other;
                      const Icon = meta.icon;
                      const isSelected = w.id === selectedWalletId;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => { onSelect(w.id); setOpen(false); setSearch(''); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800 ${
                            isSelected ? 'bg-zinc-800/80' : ''
                          }`}
                        >
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
                            <Icon className="w-3 h-3" style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs font-medium truncate ${isSelected ? 'text-emerald-400' : 'text-zinc-200'}`}>
                                {w.name}
                              </p>
                              <span className="text-[9px] px-1 py-0.5 rounded-full bg-zinc-800 text-zinc-500 shrink-0">
                                {w.type.replace('_card', '').replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              {fc((w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations
                                ? (Array.isArray(w.metadata.denominations)
                                    ? w.metadata.denominations.reduce((sx: number, d: any) => sx + (d.value || 0) * (d.count || 0), 0)
                                    : (w.balance ?? 0))
                                : (w.balance ?? 0), w.currency || displayCurrency)}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

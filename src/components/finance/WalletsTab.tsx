import { useState, useMemo, useEffect, useRef } from 'react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Wallet, Banknote, CreditCard, Landmark, PiggyBank, X, Edit3, Archive, Trash2, ArchiveRestore, Search, WalletCards, ChevronDown, Filter, AlertTriangle, Nfc } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { TabHeader } from './_fx/TabHeader';
import { EmptyState } from './EmptyState';
import { getCurrencyInfo, convertAmount, formatCurrency as fmtCurrency } from './currency-data';
import type { FinanceAccount, FinanceWallet } from './finance-types';
import { CreateAccountModal, CreateWalletModal, EditWalletModal } from './AccountsTab';

const walletMeta: Record<string, { icon: any; label: string; color: string }> = {
  bank: { icon: Landmark, label: 'Bank', color: '#3B82F6' },
  debit_card: { icon: CreditCard, label: 'Debit Card', color: '#10B981' },
  credit_card: { icon: CreditCard, label: 'Credit Card', color: '#F59E0B' },
  crypto: { icon: Wallet, label: 'Crypto', color: '#8B5CF6' },
  cash: { icon: PiggyBank, label: 'Cash', color: '#EC4899' },
  physical: { icon: WalletCards, label: 'Physical', color: '#F97316' },
  ewallet: { icon: Banknote, label: 'E-Wallet', color: '#06B6D4' },
  prepaid_card: { icon: Nfc, label: 'Prepaid Card', color: '#22D3EE' },
  other: { icon: Wallet, label: 'Other', color: '#6B7280' },
};

const walletTypes = Object.keys(walletMeta);

const accountTypeLabels: Record<string, string> = {
  personal: 'Personal',
  joint: 'Joint',
  custodial: 'Holding',
  business: 'Business',
};

const accountTypeAccent: Record<string, { bg: string; text: string }> = {
  personal: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  joint: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  custodial: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  business: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
};

interface WalletsTabProps {
  accounts: FinanceAccount[];
  wallets: FinanceWallet[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  displayCurrency: string;
  onCreateAccount: (data: {
    name: string; type: FinanceAccount['type']; description?: string;
    icon?: string; color?: string;
  }) => Promise<boolean>;
  onCreateWallet: (data: {
    account_id: number; name: string; type: string; provider?: string;
    last_four?: string; balance?: number; currency?: string;
    metadata?: Record<string, any>;
  }) => Promise<boolean>;
  onArchiveWallet: (id: number) => Promise<boolean>;
  onUpdateWallet: (data: { id: number; name: string; type: string; provider?: string; last_four?: string; balance?: number; currency?: string }) => Promise<boolean>;
  onDeleteAccount?: (id: number) => Promise<boolean>;
  onDeleteWallet?: (id: number) => Promise<boolean>;
  onViewArchived?: () => void;
  archivedCount?: number;
  onWalletClick?: (id: number) => void;
}

export function WalletsTab({
  accounts, wallets, loading, error, onRetry, displayCurrency,
  onCreateAccount, onCreateWallet, onArchiveWallet, onUpdateWallet,
  onDeleteAccount, onDeleteWallet, onViewArchived, archivedCount, onWalletClick,
}: WalletsTabProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState<number | null>(null);
  const [showEditWallet, setShowEditWallet] = useState<FinanceWallet | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({});
  const cryptoPriceFetchRef = useRef(false);

  const formatConverted = (amount: number, fromCurrency: string) => {
    return fmtCurrency(convertAmount(amount, fromCurrency, displayCurrency), displayCurrency);
  };

  const maskedCurrency = (amount: number, fromCurrency: string) => {
    const formatted = formatConverted(amount, fromCurrency);
    return showNumbers ? formatted : maskNumber(formatted, maskMode, maskFixedValue);
  };

  useEffect(() => {
    const cryptoWallets = wallets.filter(w => w.type === 'crypto' && !w.is_archived);
    if (cryptoWallets.length === 0) return;
    const coinIds: string[] = [];
    for (const w of cryptoWallets) {
      if (!w.metadata) continue;
      try {
        const meta = typeof w.metadata === 'string' ? JSON.parse(w.metadata) : w.metadata;
        const assets = meta.assets || [];
        for (const a of assets) {
          const cid = a.coin_id || a.coinId || a.asset;
          if (cid && !coinIds.includes(cid)) coinIds.push(cid);
        }
      } catch { /* skip */ }
    }
    if (coinIds.length === 0) return;
    if (cryptoPriceFetchRef.current) return;
    cryptoPriceFetchRef.current = true;
    (async () => {
      try {
        const prices = await (window as any).deskflowAPI?.financeFetchCryptoPrices(coinIds, displayCurrency) || [];
        const map: Record<string, number> = {};
        for (const p of prices) { map[p.coin_id] = p.current_price; }
        setCryptoPrices(map);
      } catch { /* best-effort */ }
      finally { cryptoPriceFetchRef.current = false; }
    })();
  }, [wallets, displayCurrency]);

  const needsAccount = accounts.filter(a => !a.is_archived).length === 0;

  const filteredWallets = useMemo(() => {
    let result = wallets.filter(w => !w.is_archived);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.provider || '').toLowerCase().includes(q) ||
        (w.last_four || '').includes(q)
      );
    }
    if (typeFilter) {
      result = result.filter(w => w.type === typeFilter);
    }
    return result;
  }, [wallets, search, typeFilter]);

  const activeAccounts = useMemo(() => accounts.filter(a => !a.is_archived), [accounts]);

  const accountSections = useMemo(() => {
    return activeAccounts.map(account => {
      const sectionWallets = filteredWallets.filter(w => w.account_id === account.id);
      const totalBalance = sectionWallets.reduce((sum, w) => {
        const wb = (w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations
          ? (Array.isArray(w.metadata.denominations)
              ? w.metadata.denominations.reduce((s: number, d: any) => s + (d.value || 0) * (d.count || 0), 0)
              : (w.balance ?? 0))
          : (w.balance ?? 0);
        let total = convertAmount(wb, w.currency || displayCurrency, displayCurrency);
        // For crypto wallets: add live market value of crypto holdings
        if (w.type === 'crypto' && w.metadata?.assets) {
          try {
            const assets = typeof w.metadata.assets === 'string' ? JSON.parse(w.metadata.assets) : w.metadata.assets;
            if (Array.isArray(assets)) {
              const cryptoMarketValue = assets.reduce((s: number, a: any) => {
                const qty = Number(a.amount) || 0;
                const cid = a.coin_id || a.coinId || a.asset || '';
                const price = cryptoPrices[cid];
                if (price) return s + (qty * price);
                const costBasis = Number(a.avg_buy_price || a.avgBuyPrice) || 0;
                return s + (qty * costBasis);
              }, 0);
              total += cryptoMarketValue;
            }
          } catch {}
        }
        return sum + total;
      }, 0);
      return { account, wallets: sectionWallets, totalBalance };
    }).filter(s => s.wallets.length > 0 || !search && !typeFilter);
  }, [activeAccounts, filteredWallets, displayCurrency, cryptoPrices]);

  if (error) {
    return (
      <div className="p-5 space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">
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

  if (loading) {
    return (
      <div className="space-y-3 p-5">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="animate-pulse bg-zinc-800/60 rounded-xl h-20" />
        ))}
      </div>
    );
  }

  if (needsAccount) {
    return (
      <div className="p-5">
        <EmptyState
          icon={<Wallet className="w-12 h-12" />}
          title="No accounts"
          description="Create an account to start adding wallets"
          action={{ label: 'Create Account', onClick: () => setShowCreate(true) }}
        />
        {showCreate && (
          <CreateAccountModal
            onClose={() => setShowCreate(false)}
            onSave={onCreateAccount}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <TabHeader
        title="Wallets"
        icon={<Wallet className="w-4 h-4" />}
        action={
          <div className="flex items-center gap-2">
            {onViewArchived && (
              <button
                onClick={onViewArchived}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                {(archivedCount ?? 0) > 0 ? `Archived (${archivedCount})` : 'Archived'}
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-700/60 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            >
              <Plus className="w-3.5 h-3.5" />
              New Account
            </button>
            <button
              onClick={() => setShowCreateWallet(activeAccounts[0]?.id || null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            >
              <Plus className="w-3.5 h-3.5" />
              New Wallet
            </button>
          </div>
        }
      />

      {/* Search + type filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallets..."
            className="w-full bg-zinc-800/60 border border-zinc-700/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowTypeFilter(!showTypeFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
              typeFilter ? 'bg-zinc-700/60 text-zinc-200 ring-1 ring-zinc-500/40' : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {typeFilter ? walletMeta[typeFilter]?.label || typeFilter : 'Type'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showTypeFilter && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTypeFilter(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <button
                  onClick={() => { setTypeFilter(null); setShowTypeFilter(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-800 ${!typeFilter ? 'text-emerald-400' : 'text-zinc-400'}`}
                >
                  All types
                </button>
                {walletTypes.map(key => {
                  const m = walletMeta[key];
                  return (
                    <button
                      key={key}
                      onClick={() => { setTypeFilter(key); setShowTypeFilter(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors hover:bg-zinc-800 ${typeFilter === key ? 'text-emerald-400' : 'text-zinc-400'}`}
                    >
                      <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Account sections */}
      {accountSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Wallet className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm text-zinc-500">
            {search || typeFilter ? 'No wallets match your search' : 'No wallets yet'}
          </p>
          {!search && !typeFilter && (
            <button
              onClick={() => setShowCreateWallet(activeAccounts[0]?.id || null)}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Wallet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {accountSections.map(({ account, wallets: sectionWallets, totalBalance }) => {
            const accent = accountTypeAccent[account.type] || accountTypeAccent.personal;
            return (
              <div key={account.id}>
                {/* Account header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${account.color}20` }}>
                      <Wallet className="w-4.5 h-4.5" style={{ color: account.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{account.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${accent.bg} ${accent.text}`}>
                          {accountTypeLabels[account.type] || account.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {sectionWallets.length} wallet{sectionWallets.length !== 1 ? 's' : ''}
                        {totalBalance !== 0 && ` \u00b7 Total ${maskedCurrency(totalBalance, displayCurrency)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowCreateWallet(account.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50"
                      title="Add wallet to this account"
                    >
                      <Plus className="w-3 h-3" />
                      Wallet
                    </button>
                  </div>
                </div>

                {/* Wallet cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectionWallets.map(w => {
                    const meta = walletMeta[w.type] || walletMeta.other;
                    const WalletIcon = meta.icon;
                    let effectiveBalance = (w.type === 'physical' || w.type === 'cash') && w.metadata?.denominations
                      ? (Array.isArray(w.metadata.denominations)
                          ? w.metadata.denominations.reduce((s: number, d: any) => s + (d.value || 0) * (d.count || 0), 0)
                          : (w.balance ?? 0))
                      : (w.balance ?? 0);
                    // For crypto wallets: wallet.balance is the available fiat (buys already deducted).
                    // Add crypto market value to show total wallet value.
                    let alreadyConverted = false;
                    if (w.type === 'crypto' && w.metadata?.assets) {
                      try {
                        const assets = typeof w.metadata.assets === 'string' ? JSON.parse(w.metadata.assets) : w.metadata.assets;
                        if (Array.isArray(assets)) {
                          const cryptoMarketValue = assets.reduce((s: number, a: any) => {
                            const qty = Number(a.amount) || 0;
                            const cid = a.coin_id || a.coinId || a.asset || '';
                            const price = cryptoPrices[cid];
                            if (price) return s + (qty * price);
                            const costBasis = Number(a.avg_buy_price || a.avgBuyPrice) || 0;
                            return s + (qty * costBasis);
                          }, 0);
                          effectiveBalance = convertAmount(effectiveBalance, w.currency || displayCurrency, displayCurrency) + cryptoMarketValue;
                          alreadyConverted = true;
                        }
                      } catch {}
                    }
                    const balanceNum = alreadyConverted ? effectiveBalance : convertAmount(effectiveBalance, w.currency || displayCurrency, displayCurrency);
                    return (
                      <motion.div
                        key={w.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <GlassSurface
                          onClick={() => onWalletClick?.(w.id)}
                          className="!p-4 cursor-pointer transition-all hover:bg-zinc-800/70 hover:ring-1 hover:ring-zinc-600/30 flex flex-col gap-3"
                        >
                          {/* Top row: icon + name + actions */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
                                <WalletIcon className="w-4.5 h-4.5" style={{ color: meta.color }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-zinc-200 truncate">{w.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500">{meta.label}</span>
                                  {(() => {
                                    const isPhys = w.type === 'physical' || w.type === 'cash';
                                    if (!isPhys || !w.metadata?.denominations || !Array.isArray(w.metadata.denominations)) return null;
                                    const denomTotal = w.metadata.denominations.reduce((s: number, d: any) => s + (d.value || 0) * (d.count || 0), 0);
                                    if (Math.abs(denomTotal - (w.balance ?? 0)) <= 0.01) return null;
                                    return (
                                      <span className="flex items-center gap-0.5 text-[9px] text-amber-400" title="Denominations don't match balance">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Sync
                                      </span>
                                    );
                                  })()}
                                  {w.last_four && (
                                    <span className="text-[10px] text-zinc-600">&bull;&bull;&bull;&bull;{w.last_four}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Always-visible action buttons */}
                            <div className="flex items-center gap-0.5 shrink-0 ml-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowEditWallet(w); }}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors focus-visible:ring-2 ring-emerald-500/50"
                                title="Edit wallet"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async (e) => { e.stopPropagation(); await onArchiveWallet(w.id); }}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors focus-visible:ring-2 ring-emerald-500/50"
                                title="Archive wallet"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteWallet && (
                                <button
                                  onClick={async (e) => { e.stopPropagation(); if (await onDeleteWallet(w.id)) {} }}
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:ring-2 ring-emerald-500/50"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Balance */}
                          <div>
                            <p className={`text-lg font-bold tabular-nums ${balanceNum >= 0 ? 'text-zinc-100' : 'text-red-400'}`}>
                              {showNumbers
                                ? (alreadyConverted ? fmtCurrency(effectiveBalance, displayCurrency) : formatConverted(effectiveBalance, w.currency || displayCurrency))
                                : maskNumber(alreadyConverted ? fmtCurrency(effectiveBalance, displayCurrency) : formatConverted(effectiveBalance, w.currency || displayCurrency), maskMode, maskFixedValue)
                              }
                            </p>
                            {/* Provider/description line */}
                            <div className="flex items-center gap-2 mt-1">
                              {w.provider && (
                                <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{w.provider}</span>
                              )}
                              {(() => {
                                try {
                                  const md = typeof w.metadata === 'string' ? JSON.parse(w.metadata) : (w.metadata || {});
                                  const desc = md.description || md.notes || '';
                                  return desc ? (
                                    <span className="text-[10px] text-zinc-600 truncate max-w-[140px]">{desc}</span>
                                  ) : null;
                                } catch { return null; }
                              })()}
                            </div>
                          </div>
                        </GlassSurface>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onSave={onCreateAccount}
        />
      )}

      {showCreateWallet && (
        <CreateWalletModal
          accountId={showCreateWallet}
          onClose={() => setShowCreateWallet(null)}
          onSave={onCreateWallet}
          displayCurrency={displayCurrency}
        />
      )}

      {showEditWallet && (
        <EditWalletModal
          wallet={showEditWallet}
          onClose={() => setShowEditWallet(null)}
          onSave={onUpdateWallet}
          displayCurrency={displayCurrency}
        />
      )}
    </div>
  );
}

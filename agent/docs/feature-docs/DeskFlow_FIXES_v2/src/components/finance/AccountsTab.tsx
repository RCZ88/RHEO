import { useState } from 'react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Wallet, Banknote, CreditCard, Landmark, PiggyBank, X, Edit3, Archive, Trash2, ArchiveRestore, ChevronDown, ChevronRight, WalletCards } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { TabHeader } from './_fx/TabHeader';
import { EmptyState } from './EmptyState';
import { getCurrencyInfo, convertAmount, formatCurrency as fmtCurrency } from './currency-data';
import { formatWithCommas, stripFormatting } from './modals/modalParts';
import type { FinanceAccount, FinanceWallet } from './finance-types';

interface AccountsTabProps {
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

const accountTypeLabels: Record<string, string> = {
  personal: 'Personal',
  joint: 'Joint',
  custodial: 'Holding',
  business: 'Business',
};

const accountTypeColor: Record<string, string> = {
  personal: 'emerald',
  joint: 'pink',
  custodial: 'amber',
  business: 'pink',
};

const walletMeta: Record<string, { icon: any; label: string; color: string }> = {
  bank: { icon: Landmark, label: 'Bank', color: '#3B82F6' },
  debit_card: { icon: CreditCard, label: 'Debit Card', color: '#10B981' },
  credit_card: { icon: CreditCard, label: 'Credit Card', color: '#F59E0B' },
  crypto: { icon: Wallet, label: 'Crypto', color: '#8B5CF6' },
  cash: { icon: PiggyBank, label: 'Cash', color: '#EC4899' },
  physical: { icon: WalletCards, label: 'Physical', color: '#F97316' },
  ewallet: { icon: Banknote, label: 'E-Wallet', color: '#06B6D4' },
  other: { icon: Wallet, label: 'Other', color: '#6B7280' },
};

export function AccountsTab({ accounts, wallets, loading, error, onRetry, displayCurrency, onCreateAccount, onCreateWallet, onArchiveWallet, onUpdateWallet, onDeleteAccount, onDeleteWallet, onViewArchived, archivedCount, onWalletClick }: AccountsTabProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState<number | null>(null);
  const [showEditWallet, setShowEditWallet] = useState<FinanceWallet | null>(null);
  const [swipingWallet, setSwipingWallet] = useState<number | null>(null);

  const formatConverted = (amount: number, fromCurrency: string) => {
    return fmtCurrency(convertAmount(amount, fromCurrency, displayCurrency), displayCurrency);
  };

  const handleSwipeArchive = async (w: FinanceWallet) => {
    await onArchiveWallet(w.id);
    setSwipingWallet(null);
  };

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
        {[1,2,3].map(i => (
          <div key={i} className="animate-pulse bg-zinc-800/60 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="p-5">
        <EmptyState
          icon={<Wallet className="w-12 h-12" />}
          title="No accounts"
          description="Create an account to start tracking your wallets"
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
    <div className="p-5 space-y-4">
      <TabHeader
        title="Accounts"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            >
              <Plus className="w-3.5 h-3.5" />
              New Account
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.filter(a => !a.is_archived).map(account => {
          const accountWallets = wallets.filter(w => w.account_id === account.id && !w.is_archived);
          const isExpanded = expandedId === account.id;
          const accent = accountTypeColor[account.type] as any;
          const computedBalance = accountWallets.reduce((sum, w) => sum + convertAmount(w.balance, w.currency || account.currency, displayCurrency), 0);

          return (
            <motion.div
              key={account.id}
              layout={false}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <GlassSurface
                onClick={() => setExpandedId(isExpanded ? null : account.id)}
                className="!p-4 w-full text-left cursor-pointer transition-colors hover:bg-zinc-800/70"
              >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${account.color}20` }}>
                        <Wallet className="w-5 h-5" style={{ color: account.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{account.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            accent === 'custodial' ? 'bg-amber-500/10 text-amber-400' :
                            accent === 'business' ? 'bg-blue-500/10 text-blue-400' :
                            accent === 'joint' ? 'bg-purple-500/10 text-purple-400' :
                            'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {accountTypeLabels[account.type] || account.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          {accountWallets.length} wallet{accountWallets.length !== 1 ? 's' : ''}
                          {account.description && ` \u00b7 ${account.description}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`text-base font-semibold tabular-nums ${computedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {showNumbers ? fmtCurrency(computedBalance, displayCurrency) : maskNumber(fmtCurrency(computedBalance, displayCurrency), maskMode, maskFixedValue)}
                        </p>
                      </div>
                      {onDeleteAccount && (
                        <button
                          onClick={async (e) => { e.stopPropagation(); if (await onDeleteAccount(account.id)) { setExpandedId(null); } }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                          title="Delete account permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-zinc-700/30 mt-3 pt-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Wallets</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowCreateWallet(account.id); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors focus-visible:ring-2 ring-emerald-500/50"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Add
                          </button>
                        </div>
                        {accountWallets.length === 0 ? (
                          <p className="text-xs text-zinc-500 text-center py-3">No wallets yet</p>
                        ) : (
                          accountWallets.map(w => {
                            const meta = walletMeta[w.type] || walletMeta.other;
                            const WalletIcon = meta.icon;
                            return (
                              <div
                                key={w.id}
                                className="group relative overflow-hidden rounded-lg"
                              >
                                <div
                                  onClick={() => onWalletClick?.(w.id)}
                                  className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors duration-150 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
                                      <WalletIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-zinc-300 truncate">{w.name}</span>
                                        <span className="text-[9px] px-1 rounded-full bg-zinc-800 text-zinc-500">{meta.label}</span>
                                      </div>
                                      {w.last_four && <span className="text-[10px] text-zinc-500">\u2022\u2022\u2022{w.last_four}</span>}
                                      {(() => {
                                        try {
                                          const md = typeof w.metadata === 'string' ? JSON.parse(w.metadata) : (w.metadata || {});
                                          const desc = md.description || md.notes || '';
                                          return desc ? <span className="block text-[9px] text-zinc-600 truncate max-w-[160px]">{desc}</span> : null;
                                        } catch { return null; }
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs font-medium tabular-nums ${w.balance >= 0 ? 'text-zinc-200' : 'text-red-400'}`}>
                                      {showNumbers ? formatConverted(w.balance, w.currency || account.currency) : maskNumber(formatConverted(w.balance, w.currency || account.currency), maskMode, maskFixedValue)}
                                    </span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowEditWallet(w); }}
                                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                                        title="Edit wallet"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={async (e) => { e.stopPropagation(); await onArchiveWallet(w.id); }}
                                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                                        title="Archive wallet"
                                      >
                                        <Archive className="w-3 h-3" />
                                      </button>
                                      {onDeleteWallet && (
                                        <button
                                          onClick={async (e) => { e.stopPropagation(); if (await onDeleteWallet(w.id)) { /* done */ } }}
                                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                                          title="Delete wallet permanently"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassSurface>
            </motion.div>
          );
        })}
      </div>

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

export function CreateAccountModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: {
    name: string; type: FinanceAccount['type']; description?: string;
    icon?: string; color?: string;
  }) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FinanceAccount['type']>('personal');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await onSave({ name, type, description: description || undefined });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">New Account</h3>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name"
            autoFocus
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          />

          <div className="flex gap-1.5">
            {(['personal', 'joint', 'custodial', 'business'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
                  type === t ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          />
        </div>

        {type === 'custodial' && (
          <p className="text-[10px] text-amber-400/70 mt-3 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
            Custodial balances are excluded from Net Worth calculations
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CreateWalletModal({ accountId, onClose, onSave, displayCurrency }: {
  accountId: number;
  onClose: () => void;
  onSave: (data: {
    account_id: number; name: string; type: string; provider?: string;
    last_four?: string; balance?: number; currency?: string;
  }) => Promise<boolean>;
  displayCurrency: string;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [provider, setProvider] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await onSave({
      account_id: accountId, name, type,
      provider: provider || undefined,
      last_four: lastFour || undefined,
      balance: balance ? parseFloat(stripFormatting(balance)) : 0,
      currency: displayCurrency,
    });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">New Wallet</h3>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wallet name"
            autoFocus
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          />

          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(walletMeta).map(([key, def]) => {
              const Icon = def.icon;
              return (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
                    type === key ? 'bg-zinc-700/60 ring-1 ring-zinc-500/50' : 'bg-zinc-800/60 hover:bg-zinc-700/40 text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" style={{ color: type === key ? def.color : undefined }} />
                  <span className="text-[9px] leading-tight text-center">{def.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider (e.g. Chase)"
              className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            />
            <input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Last 4"
              maxLength={4}
              className="w-20 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            />
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 font-medium">
              {getCurrencyInfo(displayCurrency).symbol}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={formatWithCommas(balance)}
              onChange={(e) => setBalance(stripFormatting(e.target.value))}
              placeholder="0.00"
              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            />
          </div>

          {type === 'crypto' && (
            <div className="rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#8B5CF6]/20 flex items-center justify-center">
                  <Wallet className="w-3 h-3 text-[#8B5CF6]" />
                </div>
                <span className="text-[11px] font-medium text-[#A78BFA]">Portfolio Wallet</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                A crypto wallet holds <strong className="text-zinc-300">multiple coins</strong> (e.g. Bitcoin, Ethereum, Solana). After creating this wallet, open it to add the coins you own. Live prices are fetched automatically from CoinGecko.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function EditWalletModal({ wallet, onClose, onSave, displayCurrency }: {
  wallet: FinanceWallet;
  onClose: () => void;
  onSave: (data: {
    id: number; name: string; type: string; provider?: string;
    last_four?: string; balance?: number; currency?: string;
  }) => Promise<boolean>;
  displayCurrency: string;
}) {
  const [name, setName] = useState(wallet.name);
  const [type, setType] = useState(wallet.type);
  const [provider, setProvider] = useState(wallet.provider || '');
  const [lastFour, setLastFour] = useState(wallet.last_four || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await onSave({
      id: wallet.id, name, type,
      provider: provider || undefined,
      last_four: lastFour || undefined,
      currency: wallet.currency || 'USD',
    });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Edit Wallet</h3>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wallet name"
            autoFocus
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          />

          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(walletMeta).map(([key, def]) => {
              const Icon = def.icon;
              return (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950 ${
                    type === key ? 'bg-zinc-700/60 ring-1 ring-zinc-500/50' : 'bg-zinc-800/60 hover:bg-zinc-700/40 text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" style={{ color: type === key ? def.color : undefined }} />
                  <span className="text-[9px] leading-tight text-center">{def.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider"
              className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            />
            <input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Last 4"
              maxLength={4}
              className="w-20 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
            />
          </div>

          <div className="space-y-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-medium">
                {getCurrencyInfo(displayCurrency).symbol}
              </span>
              <input
                type="text"
                value={Number(wallet.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                readOnly
                disabled
                tabIndex={-1}
                className="w-full bg-zinc-800/40 border border-zinc-700/30 rounded-lg pl-8 pr-3 py-2.5 text-sm text-zinc-400 tabular-nums cursor-not-allowed"
              />
            </div>
            <p className="text-[10px] text-zinc-500 pl-1">Balance changes only through transactions</p>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, RotateCcw, Trash2, Wallet, Landmark, CreditCard, PiggyBank, Banknote, Lock as LockIcon, Nfc, WalletCards } from 'lucide-react';
import type { FinanceAccount, FinanceWallet } from './finance-types';

interface ArchivedItemsModalProps {
  open: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  wallets: FinanceWallet[];
  onUnarchiveAccount: (id: number) => Promise<boolean>;
  onUnarchiveWallet: (id: number) => Promise<boolean>;
  onDeleteAccount: (id: number) => Promise<boolean>;
  onDeleteWallet: (id: number) => Promise<boolean>;
  hasPassword: boolean;
  onVerifyPassword: (password: string) => Promise<boolean>;
  passwordRequired: boolean;
}

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

export function ArchivedItemsModal({
  open, onClose, accounts, wallets,
  onUnarchiveAccount, onUnarchiveWallet,
  onDeleteAccount, onDeleteWallet,
  hasPassword, onVerifyPassword, passwordRequired,
}: ArchivedItemsModalProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'unarchive' | 'delete'; kind: 'account' | 'wallet'; id: number } | null>(null);

  if (!open) return null;

  const executePendingAction = async (action: typeof pendingAction) => {
    if (!action) return;
    setBusyId(`${action.type}-${action.kind}-${action.id}`);
    try {
      if (action.type === 'unarchive') {
        if (action.kind === 'account') await onUnarchiveAccount(action.id);
        else await onUnarchiveWallet(action.id);
      } else {
        if (action.kind === 'account') await onDeleteAccount(action.id);
        else await onDeleteWallet(action.id);
      }
    } finally {
      setBusyId(null);
      setPendingAction(null);
    }
  };

  const handlePasswordSubmit = async () => {
    const ok = await onVerifyPassword(passwordInput);
    if (ok) {
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError('');
      if (pendingAction) await executePendingAction(pendingAction);
      else setPendingAction(null);
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordPrompt(false);
    setPasswordInput('');
    setPasswordError('');
    setPendingAction(null);
  };

  const handleUnarchive = (type: 'account' | 'wallet', id: number) => {
    if (passwordRequired && hasPassword) {
      setPendingAction({ type: 'unarchive', kind: type, id });
      setShowPasswordPrompt(true);
    } else {
      setBusyId(`unarchive-${type}-${id}`);
      (type === 'account' ? onUnarchiveAccount(id) : onUnarchiveWallet(id)).finally(() => setBusyId(null));
    }
  };

  const handleDelete = (type: 'account' | 'wallet', id: number) => {
    if (passwordRequired && hasPassword) {
      setPendingAction({ type: 'delete', kind: type, id });
      setShowPasswordPrompt(true);
    } else {
      setBusyId(`delete-${type}-${id}`);
      (type === 'account' ? onDeleteAccount(id) : onDeleteWallet(id)).finally(() => setBusyId(null));
    }
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
        className="w-full max-w-lg bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white">Archived Items</h3>
          </div>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-3 flex-1">
          {accounts.length === 0 && wallets.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">No archived items</p>
          ) : (
            <>
              {accounts.map(acc => (
                <div key={`acc-${acc.id}`} className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}18` }}>
                      <Wallet className="w-3.5 h-3.5" style={{ color: acc.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-300 truncate">{acc.name}</p>
                      <p className="text-[10px] text-zinc-500">Account</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleUnarchive('account', acc.id)}
                      disabled={busyId === `unarchive-account-${acc.id}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                      title="Restore account"
                    >
                      {busyId === `unarchive-account-${acc.id}` ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete('account', acc.id)}
                      disabled={busyId === `delete-account-${acc.id}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      title="Permanently delete account"
                    >
                      {busyId === `delete-account-${acc.id}` ? <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
              {wallets.map(w => {
                const meta = walletMeta[w.type] || walletMeta.other;
                const WalletIcon = meta.icon;
                return (
                  <div key={`wal-${w.id}`} className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
                        <WalletIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{w.name}</p>
                        <p className="text-[10px] text-zinc-500">Wallet</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleUnarchive('wallet', w.id)}
                      disabled={busyId === `unarchive-wallet-${w.id}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                      title="Restore wallet"
                    >
                      {busyId === `unarchive-wallet-${w.id}` ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete('wallet', w.id)}
                        disabled={busyId === `delete-wallet-${w.id}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        title="Permanently delete wallet"
                      >
                        {busyId === `delete-wallet-${w.id}` ? <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <AnimatePresence>
          {showPasswordPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-zinc-700/50 pt-4 mt-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-3">
                <LockIcon className="w-3.5 h-3.5 text-red-400" />
                <p className="text-[11px] text-zinc-400">Password required to {pendingAction?.type === 'delete' ? 'delete' : 'restore'} this item</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                  placeholder="Enter finance password"
                  autoFocus
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  onClick={handlePasswordSubmit}
                  className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={handlePasswordCancel}
                  className="px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
              {passwordError && <p className="text-[11px] text-red-400 mt-2">{passwordError}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

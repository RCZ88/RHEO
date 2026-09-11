import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Calendar, Clock, Wallet, Landmark, Tag, RefreshCw,
  FileText, Hash, Trash2, Lock as LockIcon, Pencil,
  ShoppingCart, Home, Car, Heart, Book, Coffee, Zap, Gift,
  Plane, Smartphone, Shirt, Utensils, Music, Gamepad, Monitor,
  Dumbbell, Droplets, Leaf, Wifi, Film, Train, Briefcase,
  DollarSign, PiggyBank, CreditCard, Banknote, Gem,
  Receipt, TrendingUp, TrendingDown, Check, X as XIcon,
  Handshake, CircleCheck, BadgePercent, Users,
} from 'lucide-react';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { convertAmount, formatCurrency as fmtCurrency } from './currency-data';
import { CurrencyInput } from './CurrencyInput';
import { FTPersonCombobox } from './FTPersonCombobox';
import { MerchantCombobox } from './MerchantCombobox';
import type {
  FinanceTransaction, FinanceAccount, FinanceCategory, FinanceWallet,
} from './finance-types';
import { getRepaymentStatus, getFtPerson, ftRepaidTag } from '../../lib/receivables';
import { RepaymentModal } from './RepaymentModal';

interface TransactionDetailModalProps {
  transaction: FinanceTransaction | null;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  wallets: FinanceWallet[];
  allTransactions?: FinanceTransaction[];
  displayCurrency: string;
  baseCurrency: string;
  onClose: () => void;
  onDelete?: (id: number) => Promise<boolean>;
  onUpdate?: (id: number, data: Record<string, any>) => Promise<boolean>;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  onRecordFtRepayment?: (data: { originalTxId: number; personId?: number; amount: number; date: string; walletId?: number; description?: string; isOverpayment?: boolean }) => Promise<boolean>;
  onNotify?: (msg: string, type?: 'success' | 'error') => void;
  ftPersons?: { id: number; name: string; email?: string | null; phone?: string | null }[];
  onAddFtPerson?: (name: string) => void;
  onGoToTransactions?: (txId: number) => void;
}

const ease = [0.16, 1, 0.3, 1];

const typeMeta: Record<string, { label: string; color: string; bg: string }> = {
  income: { label: 'Income', color: '#22c55e', bg: 'bg-emerald-500/15' },
  expense: { label: 'Expense', color: '#ef4444', bg: 'bg-red-500/15' },
  transfer: { label: 'Transfer', color: '#f59e0b', bg: 'bg-amber-500/15' },
};

function formatDateTime(dateStr: string, timeStr: string | null) {
  const d = new Date(dateStr + 'T00:00:00');
  const datePart = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (!timeStr) return datePart;
  return `${datePart} at ${timeStr}`;
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const CAT_ICONS: Record<string, React.ComponentType<any>> = {
  ShoppingCart, Home, Car, Heart, Book, Coffee, Zap, Gift,
  Plane, Smartphone, Shirt, Utensils, Music, Gamepad, Monitor,
  Dumbbell, Droplets, Leaf, Wifi, Film, Train, Briefcase,
  DollarSign, PiggyBank, CreditCard, Banknote, Landmark, Gem,
  Receipt, Wallet, TrendingUp, TrendingDown,
};

/* ── Inline edit row ─────────────────────────────────────────── */
function InlineRow({ label, icon: Icon, iconColor, bgClass, children }: {
  label: string; icon: React.ComponentType<any>; iconColor?: string; bgClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg ${bgClass || 'bg-zinc-800/40'}`}>
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={iconColor ? { backgroundColor: `${iconColor}18` } : undefined}>
        <Icon className="w-3.5 h-3.5" style={iconColor ? { color: iconColor } : undefined} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-zinc-500">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function TransactionDetailModal({
  transaction,
  accounts,
  categories,
  wallets,
  allTransactions = [],
  displayCurrency,
  baseCurrency,
  onClose,
  onDelete,
  onUpdate,
  onVerifyPassword,
  onRecordFtRepayment,
  onNotify,
  ftPersons = [],
   onAddFtPerson,
   onGoToTransactions,
  }: TransactionDetailModalProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [mounted, setMounted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const [merchants, setMerchants] = useState<{id: number; name: string; account_id?: number | null}[]>([]);

  useEffect(() => { (window as any).deskflowAPI?.financeGetMerchants?.().then((m: any[]) => setMerchants(m || [])).catch(() => {}) }, []);

  useEffect(() => {
    if (transaction) {
      setEditing(false);
      setEditData({});
      setConfirmDelete(false);
      const t = window.setTimeout(() => setMounted(true), 16);
      return () => window.clearTimeout(t);
    }
    setMounted(false);
  }, [transaction]);

  const close = useCallback(() => {
    setMounted(false);
    setConfirmDelete(false);
    setDeletePassword('');
    setDeletePasswordError('');
    window.setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const handleDelete = async () => {
    if (!transaction || !onDelete) return;
    setDeleting(true);
    await onDelete(transaction.id);
    setDeleting(false);
    close();
  };

  const handlePasswordDelete = async () => {
    if (!transaction || !onVerifyPassword || !deletePassword) return;
    setDeletePasswordError('');
    const valid = await onVerifyPassword(deletePassword);
    if (!valid) { setDeletePasswordError('Incorrect password'); setDeleting(false); return; }
    setDeletePassword('');
    await handleDelete();
  };

  const startEditing = useCallback(() => {
    if (!transaction) return;
    setEditData({
      account_id: transaction.account_id,
      wallet_id: transaction.wallet_id,
      category_id: transaction.category_id,
      type: transaction.type,
      amount: Math.abs(transaction.amount),
      description: transaction.description || '',
      note: transaction.note || '',
      date: transaction.date,
      time: transaction.time || '',
      on_behalf_of: transaction.on_behalf_of || 0,
      on_behalf_of_label: transaction.on_behalf_of_label || '',
      ft_person_id: (transaction as any).ft_person_id || null,
      tags: transaction.tags || '',
      fee: transaction.fee || 0,
      merchant: transaction.merchant || '',
      merchant_id: (transaction as any).merchant_id || null,
    });
    setEditing(true);
    setTimeout(() => amountRef.current?.focus(), 100);
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction || !onUpdate) return;
    setSaving(true);
    const payload: Record<string, any> = { ...editData };
    if (payload.amount != null) {
      const amt = Math.abs(Number(payload.amount));
      payload.amount = transaction.type === 'expense' ? -amt : amt;
    }
    // Handle person name → convert to tag
    if (payload.personName !== undefined) {
      const personName = payload.personName.trim();
      delete payload.personName;
      const tags = payload.tags ? payload.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : (transaction.tags ? JSON.parse(transaction.tags || '[]') : []);
      // Remove old person tag
      const filteredTags = tags.filter((t: string) => !t.startsWith('person:'));
      // Add new person tag if name provided
      if (personName) filteredTags.push(`person:${personName}`);
      payload.tags = JSON.stringify(filteredTags);
    }
    const ok = await onUpdate(transaction.id, payload);
    setSaving(false);
    if (ok) { setEditing(false); onNotify?.('Transaction updated', 'success'); close(); }
    else { onNotify?.('Failed to update transaction', 'error'); }
  };

  const set = (key: string, val: any) => setEditData(p => ({ ...p, [key]: val }));

  if (!transaction) return null;

  const category = categories.find(c => c.id === (editing ? editData.category_id : transaction.category_id));
  const account = accounts.find(a => a.id === (editing ? editData.account_id : transaction.account_id));
  const wallet = (editing ? editData.wallet_id : transaction.wallet_id)
    ? wallets.find(w => w.id === (editing ? editData.wallet_id : transaction.wallet_id))
    : null;
  const type = typeMeta[transaction.type] || typeMeta.expense;
  const amountAbs = Math.abs(editing ? Number(editData.amount) || 0 : transaction.amount);
  const amountDisplay = convertAmount(amountAbs, baseCurrency, displayCurrency);
  const sign = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : '';
  const fc = (v: number) => fmtCurrency(v, displayCurrency);
  const masked = (v: number) => showNumbers ? fc(v) : maskNumber(fc(v), maskMode, maskFixedValue);

  // Check if this is a crypto transaction
  let cryptoDisplay: { symbol: string; qty: number; fiatHint: number } | null = null;
  if (transaction.metadata) {
    try {
      const m = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : transaction.metadata;
      if ((m.coinId || m.coin_id) && m.qty) {
        const qty = Number(m.qty);
        const price = Number(m.price) || 0;
        cryptoDisplay = { symbol: (m.symbol || '').toUpperCase(), qty, fiatHint: qty * price };
      }
    } catch { /* ignore */ }
  }
  const tags = (editing ? (editData.tags || '') : (transaction.tags || '')).split(',').map((s: string) => s.trim()).filter(Boolean);
  const displayNote = editing ? editData.note : transaction.note;
  const displayDate = editing ? editData.date : transaction.date;
  const displayTime = editing ? editData.time : transaction.time;

  return (
    <AnimatePresence>
      {transaction && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: mounted ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Transaction details"
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={mounted ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.25, ease }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl overflow-hidden flex flex-col"
          >
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_40%)]" />

            <div className="relative p-5 overflow-y-auto flex-1 min-h-0">
              {/* ── Header ── */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type.bg}`}>
                    {transaction.type === 'income' && <ArrowUpRight className="w-4 h-4" style={{ color: type.color }} />}
                    {transaction.type === 'expense' && <ArrowDownRight className="w-4 h-4" style={{ color: type.color }} />}
                    {transaction.type === 'transfer' && <ArrowLeftRight className="w-4 h-4" style={{ color: type.color }} />}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${type.color}18`, color: type.color }}>
                    {type.label}
                  </span>
                  {transaction.is_adjustment === 1 && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                      Historical
                    </span>
                  )}
                </div>
                <button onClick={close} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Hero: amount + description + date (inline editable) ── */}
              <div className="mb-6">
                {editing ? (
                  <>
                    <div className="relative mb-1">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-bold pointer-events-none" style={{ color: type.color }}>{sign}</span>
                      <CurrencyInput
                        ref={amountRef}
                        value={editData.amount ?? ''}
                        onChange={(v) => set('amount', v)}
                        className="w-full bg-transparent border-b-2 border-zinc-600 focus:border-zinc-400 outline-none text-3xl font-bold tracking-tight pl-5 pr-2 py-0.5 tabular-nums transition-colors"
                        style={{ color: type.color }}
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    <input
                      value={editData.description || ''}
                      onChange={e => set('description', e.target.value)}
                      placeholder="Description"
                      className="w-full bg-transparent border-b border-zinc-700/50 focus:border-zinc-500 outline-none text-sm text-white font-medium py-1 mb-0.5 placeholder-zinc-600 transition-colors"
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="date"
                        value={editData.date || ''}
                        onChange={e => set('date', e.target.value)}
                        className="bg-transparent border-b border-zinc-700/50 focus:border-zinc-500 outline-none text-xs text-zinc-400 py-0.5 transition-colors"
                      />
                      <input
                        type="time"
                        value={editData.time || ''}
                        onChange={e => set('time', e.target.value)}
                        className="bg-transparent border-b border-zinc-700/50 focus:border-zinc-500 outline-none text-xs text-zinc-400 py-0.5 transition-colors"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold tracking-tight mb-1" style={{ color: type.color }}>
                      {cryptoDisplay ? (
                        <>{sign}{cryptoDisplay.qty.toFixed(8).replace(/\.?0+$/, '')} <span className="text-[#8B5CF6] text-xl">{cryptoDisplay.symbol}</span></>
                      ) : (
                        <>{sign}{masked(amountDisplay)}</>
                      )}
                    </p>
                    {cryptoDisplay && cryptoDisplay.fiatHint > 0 && (
                      <p className="text-xs text-zinc-500">≈ {fc(cryptoDisplay.fiatHint)}</p>
                    )}
                    <p className="text-sm text-white font-medium">
                      {transaction.description || category?.name || 'Transaction'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatDateTime(transaction.date, transaction.time)}
                    </p>
                  </>
                )}
              </div>

              {/* ── Context section ── */}
              <div className="space-y-2 mb-5">
                {/* Category */}
                {editing ? (
                  <InlineRow label="Category" icon={Tag} iconColor={category?.color} bgClass="bg-zinc-800/40">
                    <div className="flex flex-wrap gap-1 mt-1">
                      {editData.category_id !== null && (
                        <button type="button" onClick={() => set('category_id', null)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                          × None
                        </button>
                      )}
                      {categories.filter(c => c.type === transaction.type).map(cat => {
                        const CatIcon = CAT_ICONS[cat.icon as string] || Tag;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => set('category_id', editData.category_id === cat.id ? null : cat.id)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-colors ${
                              editData.category_id === cat.id
                                ? 'ring-1 ring-white/20 text-white'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                            style={editData.category_id === cat.id ? { backgroundColor: `${cat.color}20`, color: cat.color } : undefined}
                          >
                            <CatIcon className="w-3 h-3" />
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </InlineRow>
                ) : category && (
                  <InlineRow label="Category" icon={CAT_ICONS[category.icon as string] || Tag} iconColor={category.color} bgClass="bg-zinc-800/40">
                    <p className="text-xs text-zinc-200 font-medium">{category.name}</p>
                  </InlineRow>
                )}

                {/* Account */}
                {editing ? (
                  <InlineRow label="Account" icon={Landmark} bgClass="bg-zinc-800/40">
                    <select
                      value={editData.account_id ?? ''}
                      onChange={e => set('account_id', Number(e.target.value))}
                      className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                    >
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </InlineRow>
                ) : account && (
                  <InlineRow label="Account" icon={Landmark} bgClass="bg-zinc-800/40">
                    <p className="text-xs text-zinc-200 font-medium">{account.name}</p>
                  </InlineRow>
                )}

                {/* Wallet */}
                {editing ? (
                  <InlineRow label="Wallet" icon={Wallet} bgClass="bg-zinc-800/40">
                    <select
                      value={editData.wallet_id ?? ''}
                      onChange={e => set('wallet_id', Number(e.target.value) || null)}
                      className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
                    >
                      <option value="">None</option>
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </InlineRow>
                ) : wallet && (
                  <InlineRow label="Wallet" icon={Wallet} bgClass="bg-zinc-800/40">
                    <p className="text-xs text-zinc-200 font-medium">{wallet.name}</p>
                  </InlineRow>
                )}

                {/* Transfer paired wallet */}
                {!editing && transaction.transfer_id && (() => {
                  const partnerWalletId = (transaction as any).to_wallet_id || (transaction as any).from_wallet_id;
                  const isSource = (transaction as any).amount < 0;
                  const partner = wallets.find(w => w.id === partnerWalletId);
                  if (!partner) return null;
                  return (
                    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-amber-400/80">{isSource ? 'Sent to' : 'Received from'}</p>
                        <p className="text-xs text-zinc-200 font-medium">{partner.name}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Details section (merchant, note, fee) ── */}
              <div className="mb-5 space-y-3">
                {/* Merchant */}
                {editing ? (
                  <InlineRow label="Merchant" icon={ShoppingCart} bgClass="bg-zinc-800/40">
                    <MerchantCombobox
                      merchants={merchants}
                      value={editData.merchant_id || null}
                      onChange={(id, name) => { set('merchant_id', id); set('merchant', name); }}
                      onAddMerchant={async (name) => { try { const res = await (window as any).deskflowAPI?.financeCreateMerchant?.({ name, account_id: transaction?.account_id }); if (res?.id) { setMerchants(prev => [...prev, res].sort((a, b) => a.name.localeCompare(b.name))); return res.id; } } catch {} return null; }}
                      placeholder="e.g. Netflix, Starbucks"
                    />
                  </InlineRow>
                ) : transaction.merchant ? (
                  <InlineRow label="Merchant" icon={ShoppingCart} bgClass="bg-zinc-800/40">
                    <p className="text-xs text-zinc-300">{transaction.merchant}</p>
                  </InlineRow>
                ) : null}

                {/* Person Attribution */}
                {(() => {
                  const txnTags = (() => { try { return JSON.parse(transaction.tags || '[]'); } catch { return []; } })();
                  const personTag = txnTags.find((t: string) => t.startsWith('person:'));
                  const transactionPersonName = personTag ? personTag.slice(7) : null;

                  if (editing) {
                    return (
                      <InlineRow label="Person" icon={Users} bgClass="bg-zinc-800/40">
                        <FTPersonCombobox
                          persons={ftPersons}
                          value={ftPersons.find(p => p.name.toLowerCase() === (editData.personName || transactionPersonName || '').toLowerCase())?.id ?? null}
                          onChange={(_id, personName) => set('personName', personName)}
                          onAddPerson={(name) => { set('personName', name); onAddFtPerson?.(name); }}
                          placeholder="Who? (e.g. John, Mom)"
                        />
                      </InlineRow>
                    );
                  } else if (transactionPersonName) {
                    return (
                      <InlineRow label="Person" icon={Users} bgClass="bg-zinc-800/40">
                        <p className="text-xs text-zinc-300">{transactionPersonName}</p>
                      </InlineRow>
                    );
                  }
                  return null;
                })()}

                {/* Note */}
                {editing ? (
                  <InlineRow label="Note" icon={FileText} bgClass="bg-zinc-800/40">
                    <textarea
                      value={editData.note || ''}
                      onChange={e => set('note', e.target.value)}
                      rows={2}
                      placeholder="Add a note..."
                      className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 resize-none mt-1"
                    />
                  </InlineRow>
                ) : displayNote ? (
                  <InlineRow label="Note" icon={FileText} bgClass="bg-zinc-800/40">
                    <p className="text-xs text-zinc-300 leading-relaxed">{displayNote}</p>
                  </InlineRow>
                ) : null}

                {/* Fee */}
                {editing ? (
                  <InlineRow label="Fee" icon={BadgePercent} bgClass="bg-zinc-800/40">
                    <CurrencyInput
                      value={editData.fee ?? 0}
                      onChange={(v) => set('fee', v)}
                      className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500 tabular-nums"
                      placeholder="0.00"
                    />
                  </InlineRow>
                ) : transaction.fee > 0 ? (
                  <InlineRow label="Fee" icon={BadgePercent} bgClass="bg-zinc-800/40">
                    <p className="text-xs font-medium tabular-nums text-red-400">−{fmtCurrency(transaction.fee, displayCurrency)}</p>
                  </InlineRow>
                ) : null}

                {/* Denominations (read-only) */}
                {!editing && (() => {
                  if (!transaction.metadata) return null;
                  try {
                    const m = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : transaction.metadata;
                    if (!m.denominations || typeof m.denominations !== 'object') return null;
                    const parts = Object.entries(m.denominations).filter(([, n]) => (n as number) > 0);
                    if (parts.length === 0) return null;
                    return (
                      <InlineRow label="Denominations counted" icon={Banknote} iconColor="#f59e0b" bgClass="bg-zinc-800/40">
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {parts.map(([val, n]) => (
                            <span key={val} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/10 font-mono">
                              {fmtCurrency(+val, displayCurrency)} × {n}
                            </span>
                          ))}
                        </div>
                        {m.change_kept != null && (
                          <p className="text-[10px] text-zinc-500 mt-1">Change kept: {fmtCurrency(m.change_kept, displayCurrency)}</p>
                        )}
                      </InlineRow>
                    );
                  } catch { return null; }
                })()}

                {/* Crypto transfer details */}
                {!editing && transaction.type === 'transfer' && (() => {
                  if (!transaction.metadata) return null;
                  try {
                    const m = typeof transaction.metadata === 'string' ? JSON.parse(transaction.metadata) : transaction.metadata;
                    if (!m.coinId && !m.coin_id) return null;
                    const coinSymbol = (m.symbol || '').toUpperCase();
                    const coinName = m.coinId || m.coin_id || '';
                    const qty = Number(m.qty) || 0;
                    const price = Number(m.price) || 0;
                    const feeQty = Number(m.fee) || 0;
                    const cryptoReceived = Number(m.cryptoReceived) || (qty - feeQty);
                    const isSource = transaction.amount < 0;
                    return (
                      <InlineRow label={isSource ? 'Sent' : 'Received'} icon={Gem} iconColor="#8B5CF6" bgClass="bg-[#8B5CF6]/10">
                        <div className="space-y-1.5 mt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#8B5CF6] px-1.5 py-0.5 rounded bg-[#8B5CF6]/15">{coinSymbol}</span>
                            <span className="text-[11px] text-zinc-300">{coinName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-mono">
                            <span className="text-zinc-400">{isSource ? 'Sent' : 'Received'}: <span className="text-white">{qty.toFixed(8).replace(/\.?0+$/, '')} {coinSymbol}</span></span>
                            {feeQty > 0 && (
                              <span className="text-red-400">Fee: −{feeQty.toFixed(8).replace(/\.?0+$/, '')} {coinSymbol}</span>
                            )}
                          </div>
                          {isSource && feeQty > 0 && (
                            <p className="text-[10px] text-zinc-500">Destination received {cryptoReceived.toFixed(8).replace(/\.?0+$/, '')} {coinSymbol} (after fee)</p>
                          )}
                          {price > 0 && (
                            <p className="text-[10px] text-zinc-500">At price {fmtCurrency(price, displayCurrency)}/{coinSymbol} = {fmtCurrency(qty * price, displayCurrency)}</p>
                          )}
                        </div>
                      </InlineRow>
                    );
                  } catch { return null; }
                })()}

                {/* Tags */}
                {tags.length > 0 && (
                  <InlineRow label="Tags" icon={Tag} bgClass="bg-zinc-800/40">
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 border border-white/5">{tag}</span>
                      ))}
                    </div>
                  </InlineRow>
                )}

                {/* Recurring */}
                {!editing && transaction.is_recurring && (
                  <InlineRow label="Recurring" icon={RefreshCw} bgClass="bg-zinc-800/40">
                    <p className="text-xs text-zinc-300">Repeats {transaction.recurring_interval || 'periodically'}</p>
                  </InlineRow>
                )}
              </div>

              {/* ── Follow Through (edit mode) ── */}
              {editing && transaction.type === 'expense' && (
                <div className="mb-5">
                  <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-zinc-800/40">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-amber-500/10">
                      <Handshake className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => set('on_behalf_of', editData.on_behalf_of ? 0 : 1)}
                          className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 ${editData.on_behalf_of ? 'bg-amber-500' : 'bg-zinc-700/60'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${editData.on_behalf_of ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                        <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors">
                          <span className="text-amber-400 font-medium">Follow Through</span> — for someone else?
                        </span>
                      </label>
                      {editData.on_behalf_of === 1 && (
                        <div className="mt-1.5">
                          <FTPersonCombobox
                            persons={ftPersons}
                            value={editData.ft_person_id ?? null}
                            onChange={(personId, personName) => {
                              set('ft_person_id', personId);
                              set('on_behalf_of_label', personName);
                            }}
                            onAddPerson={(name) => onAddFtPerson?.(name)}
                            placeholder="Who? (e.g. Mom's groceries)"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Repayment status ── */}
              {!editing && transaction.on_behalf_of === 1 && transaction.type === 'expense' && (() => {
                const ftPerson = getFtPerson(transaction);
                const repayment = getRepaymentStatus(transaction, allTransactions);
                const handleUnmarkRepaid = async () => {
                  if (!onUpdate || repayment.repaymentTxs.length === 0) return;
                  const lastRepay = repayment.repaymentTxs[repayment.repaymentTxs.length - 1];
                  const rTags = lastRepay.tags ?? '';
                  const newTags = rTags.split(',').filter(t => t.trim() !== ftRepaidTag(transaction.id) && !t.trim().startsWith('ft_overpayment:')).join(',');
                  await onUpdate(lastRepay.id, { tags: newTags });
                };
                return (
                  <div className="border-t border-white/5 pt-4 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Handshake className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Repayment Status</span>
                    </div>
                    {(() => {
                      const stillOwed = Math.abs(transaction.amount) - repayment.totalRepaid;
                      if (repayment.repaid) {
                        return (
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CircleCheck className="w-4 h-4 text-emerald-400" />
                              <span className="text-sm font-medium text-emerald-400">Repaid</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                              {repayment.repaymentTxs.length === 1
                                ? <>Repaid on {formatTimestamp(repayment.repaymentTxs[0].date)}{ftPerson ? ` by ${ftPerson}` : ''} — {fmtCurrency(repayment.totalRepaid, displayCurrency)}</>
                                : <>Repaid in {repayment.repaymentTxs.length} payments ({fmtCurrency(repayment.totalRepaid, displayCurrency)})</>
                              }
                            </p>
                            {onUpdate && (
                              <button onClick={handleUnmarkRepaid} className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 underline">Undo last repayment</button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-sm font-medium text-amber-400">Awaiting repayment</span>
                          </div>
                          {repayment.totalRepaid > 0 && (
                            <p className="text-[11px] text-zinc-400 mb-1">
                              {fmtCurrency(repayment.totalRepaid, displayCurrency)} repaid — {fmtCurrency(stillOwed, displayCurrency)} still owed
                            </p>
                          )}
                          {ftPerson && (
                            <p className="text-[11px] text-zinc-400 mb-2">{ftPerson} owes you {fmtCurrency(stillOwed, displayCurrency)}</p>
                          )}
                          {onRecordFtRepayment && (
                            <button onClick={() => setRepaymentOpen(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors font-medium">
                              Record Repayment
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* ── Meta section ── */}
              {!editing && (
                <div className="border-t border-white/5 pt-4 mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3 text-zinc-600" />
                      <div>
                        <p className="text-[10px] text-zinc-600">ID</p>
                        <p className="text-[10px] text-zinc-400 font-mono">#{transaction.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-zinc-600" />
                      <div>
                        <p className="text-[10px] text-zinc-600">Created</p>
                        <p className="text-[10px] text-zinc-400">{formatTimestamp(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <div>
                        <p className="text-[10px] text-zinc-600">Updated</p>
                        <p className="text-[10px] text-zinc-400">{formatTimestamp(transaction.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Repayment modal ── */}
              {repaymentOpen && transaction && (
                <RepaymentModal
                  open={repaymentOpen}
                  onClose={() => setRepaymentOpen(false)}
                  personName={getFtPerson(transaction) ?? 'Someone'}
                  totalAmount={Math.abs(transaction.amount)}
                  amountOwed={Math.abs(transaction.amount) - (getRepaymentStatus(transaction, allTransactions).totalRepaid ?? 0)}
                  txIds={[transaction.id]}
                  originalTx={transaction}
                  wallets={wallets}
                  displayCurrency={displayCurrency}
                  onConfirm={async (data) => {
                    const ok = await onRecordFtRepayment?.({
                      originalTxId: transaction.id,
                      personId: data.personId,
                      amount: data.amount,
                      date: data.date,
                      walletId: data.walletId,
                      description: data.description,
                      isOverpayment: data.isOverpayment,
                    });
                    if (ok) setRepaymentOpen(false);
                    return ok ?? false;
                  }}
                />
              )}
            </div>

            {/* ── Bottom actions ── */}
            <div className="border-t border-white/5 px-5 py-3 shrink-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {onUpdate && !confirmDelete && (
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <AnimatePresence mode="popLayout">
                      {confirmDelete ? (
                        <motion.div
                          key="confirm"
                          initial={{ opacity: 0, x: 4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 4 }}
                          transition={{ duration: 0.15, ease }}
                          className="flex items-center gap-2 flex-1"
                        >
                          {onVerifyPassword ? (
                            <div className="flex items-center gap-2 flex-1">
                              <div className="relative flex-1">
                                <input
                                  type="password"
                                  value={deletePassword}
                                  onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(''); }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && deletePassword) handlePasswordDelete();
                                    if (e.key === 'Escape') { setConfirmDelete(false); setDeletePassword(''); setDeletePasswordError(''); }
                                  }}
                                  placeholder="Password"
                                  autoFocus
                                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                />
                                {deletePasswordError && (
                                  <p className="absolute top-full left-0 text-[9px] text-red-400 mt-0.5">{deletePasswordError}</p>
                                )}
                              </div>
                              <button onClick={handlePasswordDelete} disabled={deleting || !deletePassword} className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40">
                                {deleting ? '...' : 'Confirm'}
                              </button>
                              <button onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeletePasswordError(''); }} className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40">
                                {deleting ? 'Deleting...' : 'Confirm Delete'}
                              </button>
                              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                                Cancel
                              </button>
                            </>
                          )}
                        </motion.div>
                      ) : (
                        <motion.button
                          key="delete"
                          layout
                          onClick={() => setConfirmDelete(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </motion.button>
                      )}
                    </AnimatePresence>
                  )}
                    {onGoToTransactions && transaction && (
                      <button onClick={() => onGoToTransactions(transaction.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        View in Transactions
                      </button>
                    )}
                    <button onClick={close} className="ml-auto px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80 transition-colors">
                      Close
                    </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

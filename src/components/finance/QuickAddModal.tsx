import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Check } from 'lucide-react';
import { getCurrencyInfo } from './currency-data';
import { CurrencyInput } from './CurrencyInput';
import { DUR } from './_fx/financeMotion';
import type { FinanceAccount, FinanceCategory, FinanceWallet } from './finance-types';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  wallets: FinanceWallet[];
  displayCurrency: string;
  /** The user's main/base currency from Settings. New transactions are entered in this currency by default. */
  baseCurrency?: string;
  onSave: (data: {
    account_id: number;
    wallet_id: number | null;
    category_id: number;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description: string;
    note: string;
    date: string;
  }) => Promise<boolean>;
}

const typeConfig = {
  income: { icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', label: 'Income' },
  expense: { icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'Expense' },
  transfer: { icon: ArrowLeftRight, color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Transfer' },
};

const stagger = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 * i, duration: DUR.BASE, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function QuickAddModal({ open, onClose, accounts, categories, wallets, displayCurrency, baseCurrency, onSave }: QuickAddModalProps) {
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<number | null>(null);
  const [fromWalletId, setFromWalletId] = useState<number | null>(null);
  const [toWalletId, setToWalletId] = useState<number | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [success, setSuccess] = useState(false);
  const [onBehalfOf, setOnBehalfOf] = useState(false);
  const [onBehalfOfLabel, setOnBehalfOfLabel] = useState('');

  useEffect(() => {
    if (open) {
      setType('expense');
      setAmount('');
      setDescription('');
      setNote('');
      setCategoryId(null);
      setAccountId(accounts[0]?.id ?? null);
      setWalletId(null);
      setFromWalletId(null);
      setToWalletId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setShowNote(false);
      setSaving(false);
      setSuccess(false);
      setOnBehalfOf(false);
      setOnBehalfOfLabel('');
    }
  }, [open, accounts]);

  const selectedAccount = accounts.find(a => a.id === accountId);
  // Input is keyed to the account's own currency, else the main/base currency from Settings.
  // displayCurrency (the finance page "view in" currency) must NOT drive data entry.
  const accountCurrency = selectedAccount?.currency || baseCurrency || displayCurrency;
  const filteredCategories = categories.filter(c => c.type === type && !c.is_archived);
  const accountWallets = wallets.filter(w => w.account_id === accountId && !w.is_archived);
  const cfg = typeConfig[type];

  const handleSave = async () => {
    if (!amount) return;
    if (type === 'transfer') {
      if (!fromWalletId || !toWalletId) return;
      setSaving(true);
      const amt = Math.abs(parseFloat(amount));
      const srcWallet = wallets.find(w => w.id === fromWalletId);
      const dstWallet = wallets.find(w => w.id === toWalletId);
      if (!srcWallet || !dstWallet) { setSaving(false); return; }
      const transferId = `txfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const desc = description ? `: ${description}` : '';
      const ok1 = await onSave({
        account_id: srcWallet.account_id, wallet_id: fromWalletId,
        category_id: categoryId || 0, type: 'expense', amount: -amt,
        description: `Transfer to ${dstWallet.name}${desc}`, note, date,
        to_wallet_id: toWalletId, transfer_id: transferId,
      });
      const ok2 = await onSave({
        account_id: dstWallet.account_id, wallet_id: toWalletId,
        category_id: categoryId || 0, type: 'income', amount: amt,
        description: `Transfer from ${srcWallet.name}${desc}`, date,
        from_wallet_id: fromWalletId, transfer_id: transferId,
      });
      if (ok1 && ok2) {
        setSaving(false); setSuccess(true);
        setTimeout(() => onClose(), 800);
      } else { setSaving(false); }
      return;
    }
    if (!categoryId || !accountId) return;
    setSaving(true);
    const ok = await onSave({
      account_id: accountId,
      wallet_id: walletId,
      category_id: categoryId,
      type,
      amount: type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
      description,
      note,
      date,
      on_behalf_of: onBehalfOf ? 1 : 0,
      on_behalf_of_label: onBehalfOf && onBehalfOfLabel.trim() ? onBehalfOfLabel.trim() : null,
      use_person_balance: 0,
    });
    if (ok) {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => onClose(), 800);
    } else {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-5 pt-5 pb-3 border-b ${cfg.border} transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Add Transaction</h3>
                </div>
                <button
                  onClick={onClose}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-1.5">
                {(Object.keys(typeConfig) as Array<'income' | 'expense' | 'transfer'>).map((t) => {
                  const c = typeConfig[t];
                  return (
                    <button
                      key={t}
                      onClick={() => { setType(t); setCategoryId(null); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                        type === t ? `${c.bg} ${c.color}` : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <c.icon className="w-3.5 h-3.5" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center py-12"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                    <Check className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-white">Transaction Added</p>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-5 space-y-3"
                >
                  <motion.div variants={stagger} custom={0} initial="hidden" animate="show" className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
                      {getCurrencyInfo(accountCurrency).symbol}
                    </span>
                    <CurrencyInput
                      value={amount}
                      onChange={(v) => setAmount(String(v))}
                      placeholder="0.00"
                      autoFocus
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg pl-7 pr-3 py-3 text-lg font-semibold text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </motion.div>

                  <motion.div variants={stagger} custom={1} initial="hidden" animate="show">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <FieldAIButton
                        fieldName="description"
                        label="Transaction Description"
                        value={description}
                        onUpdate={setDescription}
                        allFields={{ description, note, type }}
                        category="finance"
                        context={`This is a ${type} transaction${categoryId ? ' (category selected)' : ''}. Write a short, clear description.`}
                      />
                    </div>
                  </motion.div>

                  {type === 'transfer' ? (
                    <motion.div variants={stagger} custom={2} initial="hidden" animate="show" className="space-y-2">
                      <select value={fromWalletId ?? ''} onChange={e => { const v = Number(e.target.value); setFromWalletId(v); if (v === toWalletId) setToWalletId(null); }}
                        className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                        <option value="" disabled>From wallet...</option>
                        {wallets.filter(w => !w.is_archived && w.id !== toWalletId).map(w => (<option key={w.id} value={w.id}>{w.name} ({w.type})</option>))}
                      </select>
                      <ArrowLeftRight className="w-4 h-4 mx-auto text-zinc-600" />
                      <select value={toWalletId ?? ''} onChange={e => { const v = Number(e.target.value); setToWalletId(v); if (v === fromWalletId) setFromWalletId(null); }}
                        className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                        <option value="" disabled>To wallet...</option>
                        {wallets.filter(w => !w.is_archived && w.id !== fromWalletId).map(w => (<option key={w.id} value={w.id}>{w.name} ({w.type})</option>))}
                      </select>
                    </motion.div>
                  ) : (
                    <motion.div variants={stagger} custom={2} initial="hidden" animate="show" className="flex gap-2">
                      <select
                        value={accountId ?? ''}
                        onChange={(e) => { setAccountId(Number(e.target.value)); setWalletId(null); }}
                        className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      >
                        <option value="" disabled>Account</option>
                        {accounts.filter(a => !a.is_archived).map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>

                      {accountWallets.length > 0 && (
                        <select
                          value={walletId ?? ''}
                          onChange={(e) => setWalletId(e.target.value ? Number(e.target.value) : null)}
                          className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="">Wallet (opt)</option>
                          {accountWallets.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      )}
                    </motion.div>
                  )}

                  <motion.div variants={stagger} custom={3} initial="hidden" animate="show">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </motion.div>

                  {type === 'expense' && (
                    <motion.div variants={stagger} custom={3.5} initial="hidden" animate="show">
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <div onClick={(e) => { e.stopPropagation(); setOnBehalfOf(v => !v); }}
                          className={`w-8 h-4 rounded-full transition-colors duration-200 relative shrink-0 ${onBehalfOf ? 'bg-amber-500' : 'bg-zinc-700/60'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${onBehalfOf ? 'left-[16px]' : 'left-0.5'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors">
                            <span className="text-amber-400 font-medium">Follow Through</span> — paid for someone else?
                          </div>
                          {onBehalfOf && (
                            <input value={onBehalfOfLabel} onChange={e => setOnBehalfOfLabel(e.target.value)}
                              placeholder="Who? (e.g. Mom's groceries)"
                              className="mt-1 w-full rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-amber-500/50" />
                          )}
                        </div>
                      </label>
                    </motion.div>
                  )}

                  <motion.div variants={stagger} custom={4} initial="hidden" animate="show">
                    <div className="flex flex-wrap gap-1.5">
                      {filteredCategories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoryId(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            categoryId === cat.id
                              ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                              : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  <motion.button
                    variants={stagger}
                    custom={5}
                    initial="hidden"
                    animate="show"
                    onClick={() => setShowNote(!showNote)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showNote ? 'Hide notes' : '+ Add notes'}
                  </motion.button>

                  {showNote && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">Notes</span>
                        <FieldAIButton
                          fieldName="note"
                          label="Transaction Note"
                          value={note}
                          onUpdate={setNote}
                          allFields={{ description, note, type }}
                          category="finance"
                          context={`This is a ${type} transaction. Add a useful note (context, receipt link, reason).`}
                        />
                      </div>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Notes..."
                        rows={2}
                        className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                      />
                    </motion.div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={onClose}
                      className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !amount || (type === 'transfer' ? (!fromWalletId || !toWalletId) : (!categoryId || !accountId))}
                      className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Add</>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

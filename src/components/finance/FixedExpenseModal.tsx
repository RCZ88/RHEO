import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Receipt, X, Save, Wallet, Tag, Calendar } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { CurrencyInput } from './CurrencyInput';
import type { FinanceFixedExpense, FinanceWallet, FinanceCategory } from './finance-types';

interface Props {
  expense: FinanceFixedExpense | null;
  wallets: FinanceWallet[];
  categories: FinanceCategory[];
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
}

const INITIAL = {
  wallet_id: 0, name: '', description: '', amount: '', currency: 'USD',
  category_id: null as number | null, billing_day: 1,
  is_active: 1, auto_create_transaction: 0,
};

export function FixedExpenseModal({ expense, wallets, categories, onClose, onSave }: Props) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtBalance = (w: FinanceWallet) => showNumbers ? formatCurrency(w.balance, w.currency) : maskNumber(formatCurrency(w.balance, w.currency), maskMode, maskFixedValue);
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (expense && expense.id) {
      setForm({
        wallet_id: expense.wallet_id, name: expense.name, description: expense.description || '',
        amount: String(expense.amount), currency: expense.currency || 'USD',
        category_id: expense.category_id, billing_day: expense.billing_day,
        is_active: expense.is_active, auto_create_transaction: expense.auto_create_transaction,
      });
    } else if (expense) {
      setForm(f => ({ ...f, wallet_id: expense.wallet_id || wallets[0]?.id || 0 }));
    }
  }, [expense, wallets]);

  const handleSave = async () => {
    if (!form.name || !form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    await onSave({ ...form, amount: Number(form.amount) });
    setSaving(false);
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}>
        <GlassSurface className="w-full max-w-md p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-zinc-100 font-semibold text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" />
              {expense?.id ? 'Edit Fixed Expense' : 'New Fixed Expense'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. University Parking"
                className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Amount</label>
                <CurrencyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))}
                  currency={form.currency} className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Billing Day</label>
                <select value={form.billing_day} onChange={e => setForm(f => ({ ...f, billing_day: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Wallet
                </label>
                <select value={form.wallet_id} onChange={e => setForm(f => ({ ...f, wallet_id: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50">
                  <option value={0}>Select wallet...</option>
                  {wallets.filter(w => !w.is_archived).map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({fmtBalance(w)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Category
                </label>
                <select value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: Number(e.target.value) || null }))}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50">
                  <option value="">None</option>
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !form.name || !form.amount}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-amber-500 text-zinc-950 font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </GlassSurface>
      </motion.div>
    </motion.div>
  );
}

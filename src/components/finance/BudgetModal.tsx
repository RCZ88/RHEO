import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, X, Save, Tag } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { CurrencyInput } from './CurrencyInput';
import type { FinanceBudget, FinanceCategory } from './finance-types';

interface Props {
  budget: FinanceBudget | null;
  categories: FinanceCategory[];
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
}

const INITIAL = {
  name: '', type: 'total' as 'total' | 'category', category_id: null as number | null,
  amount: '', currency: 'USD', period: 'monthly' as const, alert_threshold: 80,
};

export function BudgetModal({ budget, categories, onClose, onSave }: Props) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const [form, setForm] = useState(INITIAL);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (budget?.id) {
      setForm({
        name: budget.name, type: budget.type, category_id: budget.category_id,
        amount: String(budget.amount), currency: budget.currency || 'USD',
        period: budget.period, alert_threshold: budget.alert_threshold,
      });
    }
  }, [budget]);

  const handleSave = async () => {
    if (!form.name || !form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    await onSave({ ...form, amount: Number(form.amount) });
    setSaving(false);
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const thresholdAmount = Number(form.amount) > 0 ? (Number(form.amount) * form.alert_threshold) / 100 : 0;

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
              <Target className="w-4 h-4 text-amber-500" />
              {budget?.id ? 'Edit Budget' : 'New Budget'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Monthly Budget"
                className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'total' | 'category', category_id: e.target.value === 'total' ? null : f.category_id }))}
                  className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50">
                  <option value="total">Total Budget</option>
                  <option value="category">Category Budget</option>
                </select>
              </div>
              {form.type === 'category' && (
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Category
                  </label>
                  <select value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: Number(e.target.value) || null }))}
                    className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50">
                    <option value="">Select...</option>
                    {expenseCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Budget Amount</label>
              <CurrencyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))}
                currency={form.currency} className="w-full px-3 py-2 text-sm bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500/50" />
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
                Alert at {form.alert_threshold}% — {form.amount ? `warn when spending exceeds ${showNumbers ? formatCurrency(thresholdAmount) : maskNumber(formatCurrency(thresholdAmount), maskMode, maskFixedValue)}` : 'set amount first'}
              </label>
              <input type="range" min={50} max={100} step={5} value={form.alert_threshold}
                onChange={e => setForm(f => ({ ...f, alert_threshold: Number(e.target.value) }))}
                className="w-full accent-amber-500" />
              <div className="flex justify-between text-[9px] text-zinc-600">
                <span>50%</span><span>75%</span><span>100%</span>
              </div>
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

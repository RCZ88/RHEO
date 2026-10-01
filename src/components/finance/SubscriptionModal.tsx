import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, Calendar, DollarSign, Globe, Link2, Wallet, AlertTriangle, Save, Tag } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency, getCurrencyInfo, COMMON_CURRENCIES } from './currency-data';
import { CurrencyInput } from './CurrencyInput';
import type { FinanceSubscription, FinanceWallet, FinanceCategory } from './finance-types';

interface Props {
  subscription: FinanceSubscription | null;
  wallets: FinanceWallet[];
  categories?: FinanceCategory[];
  displayCurrency: string;
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
  onMoveTransaction?: (subscriptionId: number, newWalletId: number) => Promise<boolean>;
}

const BILLING_CYCLES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' },
];

const STATUSES = [
  { value: 'active', label: 'Active', color: '#22c55e' },
  { value: 'paused', label: 'Paused', color: '#eab308' },
  { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
  { value: 'expired', label: 'Expired', color: '#52525b' },
];

const INITIAL = {
  wallet_id: 0,
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  billing_interval: 1,
  start_date: '',
  next_renewal_date: '',
  cancel_url: '',
  cancel_reminder_days: 7,
  reminder_note: '',
  status: 'active',
  subscription_type: 'recurring_autodebet',
  category_id: null as number | null,
};

export function SubscriptionModal({ subscription, wallets, categories = [], displayCurrency, onClose, onSave, onMoveTransaction }: Props) {
  const [form, setForm] = useState({ ...INITIAL, currency: displayCurrency || 'USD' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onBehalfOf, setOnBehalfOf] = useState(false);
  const [onBehalfOfLabel, setOnBehalfOfLabel] = useState('');
  const [moveLastPayment, setMoveLastPayment] = useState(false);
  const [originalWalletId, setOriginalWalletId] = useState<number | null>(null);

  useEffect(() => {
    if (subscription) {
      setForm({
        wallet_id: subscription.wallet_id,
        name: subscription.name,
        description: subscription.description,
        price: String(subscription.price),
        currency: subscription.currency || displayCurrency || 'USD',
        billing_cycle: subscription.billing_cycle,
        billing_interval: subscription.billing_interval,
        start_date: subscription.start_date || '',
        next_renewal_date: subscription.next_renewal_date || '',
        cancel_url: subscription.cancel_url,
        cancel_reminder_days: subscription.cancel_reminder_days,
        reminder_note: subscription.reminder_note,
        status: subscription.status,
        subscription_type: subscription.subscription_type || 'recurring_autodebet',
        category_id: (subscription as any).category_id || null,
      });
      setOriginalWalletId(subscription.wallet_id);
      setOnBehalfOf(subscription.on_behalf_of === 1);
      setOnBehalfOfLabel(subscription.on_behalf_of_label || '');
    } else {
      const firstWallet = wallets.find(w => !w.is_archived);
      setForm({ ...INITIAL, wallet_id: firstWallet?.id || 0, currency: displayCurrency || 'USD' });
      setOnBehalfOf(false);
      setOnBehalfOfLabel('');
    }
  }, [subscription, wallets, displayCurrency]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Auto-calculate next_renewal_date from start_date + billing_cycle
  const computeNextRenewal = useCallback((startDate: string, cycle: string, interval: number) => {
    if (!startDate) return '';
    const d = new Date(startDate);
    const n = interval || 1;
    switch (cycle) {
      case 'weekly': d.setDate(d.getDate() + 7 * n); break;
      case 'monthly': d.setMonth(d.getMonth() + n); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3 * n); break;
      case 'yearly': d.setFullYear(d.getFullYear() + n); break;
      default: d.setMonth(d.getMonth() + n); break;
    }
    return d.toISOString().slice(0, 10);
  }, []);

  // When editing a NEW subscription (not editing existing), auto-set next_renewal_date
  useEffect(() => {
    if (subscription) return; // Don't overwrite when editing existing
    if (!form.start_date) return;
    const next = computeNextRenewal(form.start_date, form.billing_cycle, form.billing_interval);
    if (next && next !== form.next_renewal_date) {
      setForm(prev => ({ ...prev, next_renewal_date: next }));
    }
  }, [form.start_date, form.billing_cycle, form.billing_interval, subscription]);

  const handleSubmit = async () => {
    setError(null);
    if (!form.wallet_id) { setError('Please select a wallet'); return; }
    if (!form.name.trim()) { setError('Please enter a name'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setError('Please enter a valid price'); return; }
    setSaving(true);
    try {
      const ok = await onSave({
        ...form,
        price,
        on_behalf_of: onBehalfOf ? 1 : 0,
        on_behalf_of_label: onBehalfOf && onBehalfOfLabel.trim() ? onBehalfOfLabel.trim() : null,
      });
      // Move last payment if checkbox checked and wallet changed
      if (ok && moveLastPayment && subscription && originalWalletId && form.wallet_id !== originalWalletId) {
        await onMoveTransaction?.(subscription.id, form.wallet_id);
      }
    } catch { setError('Failed to save subscription'); }
    finally { setSaving(false); }
  };

  const fields = [
    { id: 'name', label: 'Name', type: 'text', placeholder: 'Netflix, Spotify, AWS...', required: true },
    { id: 'price', label: 'Price', type: 'number', placeholder: '0.00', required: true, step: 'any', min: '0' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{subscription ? 'Edit' : 'Add'} Subscription</h3>
              <p className="text-[10px] text-zinc-500">{subscription ? 'Update subscription details' : 'Track a recurring payment'}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Name + Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Name</label>
              <input value={form.name} onChange={e => handleChange('name', e.target.value)}
                placeholder="Subscription name" autoFocus
                className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-zinc-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Price</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium pointer-events-none">{getCurrencyInfo(form.currency).symbol}</span>
                <CurrencyInput value={form.price} onChange={(v) => handleChange('price', String(v))}
                  placeholder="0.00" className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 pl-7 pr-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-zinc-500 tabular-nums transition-colors" />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Currency</label>
            <select value={form.currency} onChange={e => handleChange('currency', e.target.value)}
              className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 transition-colors">
              {COMMON_CURRENCIES.map(code => (
                <option key={code} value={code}>{code} — {getCurrencyInfo(code).symbol}</option>
              ))}
            </select>
          </div>

          {/* Wallet */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Payment Wallet</label>
            <select value={form.wallet_id} onChange={e => handleChange('wallet_id', Number(e.target.value))}
              className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 transition-colors">
              <option value={0} disabled>Select wallet</option>
              {wallets.filter(w => !w.is_archived).map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
              ))}
            </select>
            {/* Move last payment checkbox — only when editing and wallet changed */}
            {subscription && originalWalletId !== null && form.wallet_id !== originalWalletId && form.wallet_id !== 0 && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                <div onClick={() => setMoveLastPayment(v => !v)}
                  className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${moveLastPayment ? 'bg-indigo-500 border-indigo-400' : 'border-zinc-600 bg-zinc-800 group-hover:border-zinc-500'}`}>
                  {moveLastPayment && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  Move last payment to this wallet
                </span>
              </label>
            )}
          </div>

          {/* Subscription Type */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'recurring_autodebet', label: 'Auto-debit', desc: 'Charged automatically', icon: '⚡' },
                { value: 'recurring_manual', label: 'Manual', desc: 'Pay each period', icon: '✋' },
                { value: 'one_time', label: 'One-time', desc: 'No renewal', icon: '1️⃣' },
              ].map(t => (
                <button key={t.value} type="button" onClick={() => handleChange('subscription_type', t.value)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    form.subscription_type === t.value
                      ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300'
                      : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-400 hover:border-zinc-600'
                  }`}>
                  <div className="text-sm mb-0.5">{t.icon}</div>
                  <div className="text-[11px] font-medium">{t.label}</div>
                  <div className="text-[9px] text-zinc-500">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Billing cycle — hidden for one-time */}
          {form.subscription_type !== 'one_time' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Billing cycle</label>
              <select value={form.billing_cycle} onChange={e => handleChange('billing_cycle', e.target.value)}
                className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 transition-colors">
                {BILLING_CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {form.billing_cycle === 'custom' && (
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Every (months)</label>
                <input type="number" min="1" value={form.billing_interval} onChange={e => handleChange('billing_interval', parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 tabular-nums transition-colors" />
              </div>
            )}
          </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Start date</label>
              <input type="date" value={form.start_date} onChange={e => handleChange('start_date', e.target.value)}
                className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Next renewal</label>
              <input type="date" value={form.next_renewal_date} onChange={e => handleChange('next_renewal_date', e.target.value)}
                className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 transition-colors" />
            </div>
          </div>

          {/* Cancel URL + Reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Cancel URL</label>
              <div className="relative">
                <input type="url" value={form.cancel_url} onChange={e => handleChange('cancel_url', e.target.value)}
                  placeholder="https://..." className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 pl-7 pr-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-zinc-500 transition-colors" />
                <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Reminder (days before)</label>
              <input type="number" min="0" max="90" value={form.cancel_reminder_days}
                onChange={e => handleChange('cancel_reminder_days', parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 tabular-nums transition-colors" />
            </div>
          </div>

          {/* Reminder note */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Reminder note</label>
            <textarea value={form.reminder_note} onChange={e => handleChange('reminder_note', e.target.value)}
              placeholder="e.g., Call to cancel, account number..."
              rows={2} className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2 outline-none placeholder:text-zinc-600 focus:border-zinc-500 transition-colors resize-none" />
          </div>

          {/* Follow Through */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div onClick={(e) => { e.stopPropagation(); setOnBehalfOf(v => !v); }}
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${onBehalfOf ? 'bg-amber-500' : 'bg-zinc-700/60'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${onBehalfOf ? 'left-[18px]' : 'left-0.5'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  <span className="text-amber-400 font-medium">Follow Through</span> — Is this for someone else? They'll pay me back
                </div>
                {onBehalfOf && (
                  <input value={onBehalfOfLabel} onChange={e => setOnBehalfOfLabel(e.target.value)}
                    placeholder="Who? (e.g. Mom's Netflix)"
                    className="mt-1.5 w-full rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-amber-500/50" />
                )}
              </div>
            </label>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button key={s.value} onClick={() => handleChange('status', s.value)}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    backgroundColor: form.status === s.value ? `${s.color}20` : 'rgba(82,82,91,0.2)',
                    color: form.status === s.value ? s.color : '#a1a1aa',
                    border: `1px solid ${form.status === s.value ? s.color : 'transparent'}`,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
                <Tag className="w-3 h-3" /> Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.filter(c => c.type === 'expense').map(c => (
                  <button key={c.id} onClick={() => handleChange('category_id', form.category_id === c.id ? null : c.id)}
                    className="text-[11px] px-2.5 py-1 rounded-full transition-colors border"
                    style={{
                      backgroundColor: form.category_id === c.id ? `${c.color}20` : 'transparent',
                      color: form.category_id === c.id ? c.color : '#71717a',
                      borderColor: form.category_id === c.id ? c.color : 'transparent',
                    }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Preview */}
          {parseFloat(form.price) > 0 && (
            <div className="px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-zinc-500 mb-1">Preview</p>
              <p className="text-xs text-zinc-300">
                <span className="font-semibold text-white">{formatCurrency(parseFloat(form.price), form.currency)}</span>
                <span className="text-zinc-500">/{form.billing_cycle === 'monthly' ? 'mo' : form.billing_cycle === 'yearly' ? 'yr' : form.billing_cycle === 'weekly' ? 'wk' : form.billing_cycle === 'quarterly' ? 'qtr' : `${form.billing_interval}mo`}</span>
                {form.billing_cycle !== 'monthly' && (
                  <span className="text-zinc-600"> · <span className="text-zinc-500">{formatCurrency(parseFloat(form.price) / (form.billing_cycle === 'yearly' ? 12 : form.billing_cycle === 'quarterly' ? 3 : form.billing_cycle === 'weekly' ? 0.231 : form.billing_interval), form.currency)}</span>/mo</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3 border-t border-zinc-800">
          <button onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
            {saving ? <><Save className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> {subscription ? 'Update' : 'Add'} Subscription</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

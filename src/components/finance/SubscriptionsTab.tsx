import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit3, Trash2, ExternalLink, Bell, BellOff, Calendar, Wallet, CreditCard, RefreshCw, X, Check, AlertTriangle, DollarSign, ArrowUpRight, History, Zap, RotateCcw, CircleCheck, XCircle, Clock, Nfc } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { formatCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { SubscriptionModal } from './SubscriptionModal';
import type { FinanceSubscription, FinanceWallet, FinanceTransaction, FinanceCategory } from './finance-types';

interface Props {
  subscriptions: FinanceSubscription[];
  wallets: FinanceWallet[];
  categories?: FinanceCategory[];
  transactions?: FinanceTransaction[];
  displayCurrency: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreate: (data: any) => Promise<boolean>;
  onUpdate: (data: any) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onRecordPayment?: (sub: FinanceSubscription) => Promise<void>;
  onNavigateToPage?: () => void;
  onGenerateTransactions?: () => Promise<{ created: number; subscriptions: any[] }>;
  onRefresh?: () => void;
  onMoveTransaction?: (subscriptionId: number, newWalletId: number) => Promise<boolean>;
  onRetryPayment?: (subscriptionId: number, walletId?: number, date?: string) => Promise<{ success: boolean; error?: string }>;
  onToggleAutodebet?: (id: number) => Promise<boolean>;
  onRecordPaymentManual?: (subscriptionId: number, walletId?: number, amount?: number, date?: string) => Promise<boolean>;
  onGetPaymentHistory?: (subscriptionId: number) => Promise<any>;
  onCancelPayment?: (subscriptionId: number, transactionId: number, reason?: string) => Promise<boolean>;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function getRenewalUrgency(days: number): { color: string; bg: string; label: string } {
  if (days < 0) return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Overdue' };
  if (days <= 3) return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: `${days}d` };
  if (days <= 7) return { color: '#f97316', bg: 'rgba(249,115,22,0.1)', label: `${days}d` };
  if (days <= 14) return { color: '#eab308', bg: 'rgba(234,179,8,0.1)', label: `${days}d` };
  if (days <= 30) return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: `${days}d` };
  return { color: '#52525b', bg: 'rgba(82,82,91,0.08)', label: `${days}d` };
}

function getWalletIcon(walletType: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    bank: <Wallet className="w-3.5 h-3.5" />,
    debit_card: <CreditCard className="w-3.5 h-3.5" />,
    credit_card: <CreditCard className="w-3.5 h-3.5" />,
    ewallet: <CreditCard className="w-3.5 h-3.5" />,
    prepaid_card: <Nfc className="w-3.5 h-3.5" />,
  };
  return icons[walletType] || <Wallet className="w-3.5 h-3.5" />;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  paused: { label: 'Paused', color: '#eab308', bg: 'rgba(234,179,8,0.08)' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  expired: { label: 'Expired', color: '#52525b', bg: 'rgba(82,82,91,0.08)' },
};

function computeMonthlyCost(sub: FinanceSubscription): number {
  const base = sub.price;
  switch (sub.billing_cycle) {
    case 'weekly': return base * 4.33;
    case 'monthly': return base;
    case 'quarterly': return base / 3;
    case 'yearly': return base / 12;
    case 'custom': return (base / (sub.billing_interval || 1));
    default: return base;
  }
}

export function SubscriptionsTab({ subscriptions, wallets, categories = [], transactions = [], displayCurrency, loading, error, onRetry, onCreate, onUpdate, onDelete, onRecordPayment, onNavigateToPage, onGenerateTransactions, onRefresh, onMoveTransaction, onRetryPayment, onToggleAutodebet, onRecordPaymentManual, onGetPaymentHistory, onCancelPayment, onNotify }: Props) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number) => showNumbers ? formatCurrency(v, displayCurrency) : maskNumber(formatCurrency(v, displayCurrency), maskMode, maskFixedValue);
  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<FinanceSubscription | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Payment History Modal state
  const [historySub, setHistorySub] = useState<FinanceSubscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Record Payment Modal state
  const [recordPaySub, setRecordPaySub] = useState<FinanceSubscription | null>(null);
  const [recordPayDate, setRecordPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordPayWallet, setRecordPayWallet] = useState<number>(0);
  const [recordPayAmount, setRecordPayAmount] = useState('');
  const [recordPayError, setRecordPayError] = useState('');

  const walletMap = useMemo(() => {
    const m = new Map<number, FinanceWallet>();
    wallets.forEach(w => m.set(w.id, w));
    return m;
  }, [wallets]);

  const totalMonthly = useMemo(() =>
    subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + computeMonthlyCost(s), 0),
    [subscriptions]
  );

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return subscriptions;
    return subscriptions.filter(s => s.status === filterStatus);
  }, [subscriptions, filterStatus]);

  const grouped = useMemo(() => {
    const groups: Record<string, FinanceSubscription[]> = {};
    const order = ['active', 'paused', 'cancelled', 'expired'];
    order.forEach(st => {
      const items = filtered.filter(s => s.status === st);
      if (items.length > 0) groups[st] = items;
    });
    return groups;
  }, [filtered]);

  useEffect(() => { setConfirmDelete(null); }, [editingSub]);

  // Load payment history for a subscription
  const loadHistory = async (sub: FinanceSubscription) => {
    setHistorySub(sub);
    setHistoryLoading(true);
    setPaymentHistory([]);
    try {
      if (onGetPaymentHistory) {
        const result = await onGetPaymentHistory(sub.id);
        if (result?.success) setPaymentHistory(result.paymentHistory || []);
      }
    } catch {} finally { setHistoryLoading(false); }
  };

  // Open record payment modal with smart defaults
  const openRecordPayment = (sub: FinanceSubscription) => {
    const startDate = sub.start_date ? new Date(sub.start_date) : new Date();
    const day = startDate.getDate();
    const today = new Date();
    const defaultDate = new Date(today.getFullYear(), today.getMonth(), day);
    if (defaultDate > today) defaultDate.setMonth(defaultDate.getMonth() - 1);
    setRecordPaySub(sub);
    setRecordPayDate(defaultDate.toISOString().slice(0, 10));
    setRecordPayWallet(sub.wallet_id || 0);
    setRecordPayAmount(String(sub.price));
    setRecordPayError('');
  };

  // Submit record payment
  const submitRecordPayment = async () => {
    if (!recordPaySub) return;
    if (!recordPayDate) { setRecordPayError('Select a date'); return; }
    if (!recordPayWallet) { setRecordPayError('Select a wallet'); return; }
    const amt = parseFloat(recordPayAmount);
    if (isNaN(amt) || amt <= 0) { setRecordPayError('Enter a valid amount'); return; }
    const wallet = walletMap.get(recordPayWallet);
    if (wallet && (wallet.balance || 0) < amt) {
      setRecordPayError(showNumbers ? `Insufficient balance — need ${formatCurrency(amt, displayCurrency)}, have ${formatCurrency(wallet.balance || 0, displayCurrency)}` : `Insufficient balance — need ${maskNumber(formatCurrency(amt, displayCurrency), maskMode, maskFixedValue)}, have ${maskNumber(formatCurrency(wallet.balance || 0, displayCurrency), maskMode, maskFixedValue)}`);
      return;
    }
    try {
      const ok = await onRecordPaymentManual?.(recordPaySub.id, recordPayWallet, amt, recordPayDate);
      if (ok) { onNotify?.('Payment recorded', 'success'); setRecordPaySub(null); onRefresh?.(); }
      else { setRecordPayError('Failed to record payment'); }
    } catch { setRecordPayError('Error recording payment'); }
  };

  if (loading) {
    return (
      <GlassSurface className="p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading subscriptions...</span>
        </div>
      </GlassSurface>
    );
  }

  if (error) {
    return (
      <GlassSurface className="p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-zinc-400 mb-3">{error}</p>
        <button onClick={onRetry} className="text-xs px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
          Retry
        </button>
      </GlassSurface>
    );
  }

  return (
    <motion.div variants={{ enter: { opacity: 1, y: 0 }, center: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } }}
      initial="enter" animate="center" exit="exit" transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Subscriptions</h2>
        <div className="flex items-center gap-2">
          {onGenerateTransactions && (
            <button onClick={async () => {
              setSyncing(true);
              try {
                const result = await onGenerateTransactions();
                if (result && result.created > 0) {
                  onNotify?.(`Synced ${result.created} payment${result.created > 1 ? 's' : ''} — backfilled from start dates`, 'success');
                  onRefresh?.();
                } else {
                  onNotify?.('All subscriptions up to date — no missing payments', 'info');
                }
              } catch {
                onNotify?.('Sync failed — try again', 'error');
              } finally { setSyncing(false); }
            }}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing...' : 'Sync Payments'}
            </button>
          )}
          {onNavigateToPage && (
            <button onClick={onNavigateToPage}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
              <ArrowUpRight className="w-3 h-3" /> View all
            </button>
          )}
          <button onClick={() => { setEditingSub(null); setShowModal(true); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Monthly summary */}
      <GlassSurface className="p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Monthly spend</p>
            <p className="text-lg font-semibold text-white tabular-nums mt-0.5">{fmtMoney(totalMonthly)}<span className="text-xs text-zinc-500 font-normal">/mo</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Yearly</p>
            <p className="text-sm font-medium text-zinc-300 tabular-nums mt-0.5">{fmtMoney(totalMonthly * 12)}<span className="text-xs text-zinc-500 font-normal">/yr</span></p>
          </div>
        </div>
      </GlassSurface>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All', count: subscriptions.length },
          ...Object.entries(statusConfig).map(([k, v]) => ({ key: k, label: v.label, count: subscriptions.filter(s => s.status === k).length })),
        ].filter(x => x.count > 0 || x.key === 'all').map(opt => (
          <button key={opt.key} onClick={() => setFilterStatus(opt.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${filterStatus === opt.key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {opt.label}{opt.count > 0 && opt.key !== 'all' ? ` (${opt.count})` : ''}
          </button>
        ))}
      </div>

      {/* Subscription list */}
      {subscriptions.length === 0 ? (
        <GlassSurface className="p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-5 h-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-400 mb-1">No subscriptions yet</p>
          <p className="text-[11px] text-zinc-600 mb-4">Track your recurring payments and get cancel reminders</p>
          <button onClick={() => { setEditingSub(null); setShowModal(true); }}
            className="text-xs px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            Add your first subscription
          </button>
        </GlassSurface>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([status, items]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusConfig[status]?.color }} />
                <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">{statusConfig[status]?.label || status}</span>
                <span className="text-[10px] text-zinc-600">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map(sub => {
                  const wallet = walletMap.get(sub.wallet_id);
                  const renewalDays = sub.next_renewal_date ? daysUntil(sub.next_renewal_date) : null;
                  const urgency = renewalDays !== null ? getRenewalUrgency(renewalDays) : null;
                  const isActive = sub.status === 'active';
                  return (
                    <GlassSurface key={sub.id} className="p-3.5 group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{sub.name}</span>
                            {sub.cancel_reminder_days > 0 && isActive && (
                              <Bell className="w-3 h-3 text-zinc-500 shrink-0" title={`Reminder ${sub.cancel_reminder_days} days before renewal`} />
                            )}
                            {sub.cancel_reminder_days === 0 && isActive && (
                              <BellOff className="w-3 h-3 text-zinc-600 shrink-0" title="No reminder" />
                            )}
                            {sub.subscription_type === 'one_time' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">One-time</span>
                            )}
                            {sub.subscription_type === 'recurring_manual' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">Manual</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {wallet && (
                              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                                {getWalletIcon(wallet.type)}
                                {wallet.name}
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-600">{sub.description || sub.billing_cycle}</span>
                          </div>
                          {sub.next_renewal_date && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <Calendar className="w-3 h-3 text-zinc-600" />
                              <span className="text-[11px] text-zinc-500">Renews {formatDate(sub.next_renewal_date)}</span>
                              {renewalDays !== null && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: urgency?.color, backgroundColor: urgency?.bg }}>
                                  {urgency?.label}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Payment status */}
                          {sub.payment_status && sub.payment_status !== 'pending' && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {sub.payment_status === 'paid' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Paid {sub.last_payment_date ? formatDate(sub.last_payment_date) : ''}
                                </span>
                              )}
                              {sub.payment_status === 'failed' && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium inline-flex items-center gap-1 w-fit">
                                    <XCircle size={10} /> Failed
                                  </span>
                                  {(() => {
                                    let failedDates: string[] = [];
                                    try { failedDates = JSON.parse(sub.metadata || '{}').failed_dates || []; } catch {}
                                    if (failedDates.length > 0) {
                                      return (
                                        <div className="flex flex-wrap gap-1">
                                          {failedDates.map(fd => (
                                            <button key={fd} onClick={async (e) => {
                                              e.stopPropagation();
                                              const r = await onRetryPayment?.(sub.id, undefined, fd);
                                              if (r?.success) { onNotify?.(`Paid ${formatDate(fd)}`, 'success'); onRefresh?.(); }
                                              else onNotify?.(r?.error || 'Retry failed', 'error');
                                            }} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors font-medium">
                                              Retry {formatDate(fd)}
                                            </button>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return (
                                      <button onClick={async (e) => {
                                        e.stopPropagation();
                                        const result = await onRetryPayment(sub.id);
                                        if (result?.success) { onNotify?.('Payment retried successfully', 'success'); onRefresh?.(); }
                                        else onNotify?.(result?.error || 'Retry failed', 'error');
                                      }}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors font-medium w-fit">
                                        Retry
                                      </button>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                          {sub.cancel_url && isActive && (
                            <a href={sub.cancel_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 mt-1 transition-colors"
                              onClick={e => e.stopPropagation()}>
                              <ExternalLink className="w-3 h-3" /> Cancel link
                            </a>
                          )}
                          {/* Transaction history for this subscription */}
                          {(() => {
                            const subTxns = transactions.filter(t => t.description?.includes(sub.name) && t.type === 'expense');
                            if (subTxns.length === 0) return null;
                            return (
                              <div className="mt-2 pt-2 border-t border-zinc-700/30">
                                <div className="text-[10px] text-zinc-600 mb-1">{subTxns.length} payment{subTxns.length > 1 ? 's' : ''}</div>
                                <div className="space-y-0.5 max-h-[60px] overflow-y-auto">
                                  {subTxns.slice(-4).reverse().map(t => (
                                    <div key={t.id} className="flex items-center justify-between text-[10px]">
                                      <span className="text-zinc-500">{t.date}</span>
                                      <span className="text-zinc-400 tabular-nums">{fmtMoney(Math.abs(t.amount))}</span>
                                    </div>
                                  ))}
                                  {subTxns.length > 4 && <div className="text-[9px] text-zinc-600">+{subTxns.length - 4} more</div>}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-white tabular-nums">
                            {fmtMoney(sub.price)}
                            <span className="text-[10px] text-zinc-500 font-normal">
                              /{sub.billing_cycle === 'monthly' ? 'mo' : sub.billing_cycle === 'yearly' ? 'yr' : sub.billing_cycle === 'weekly' ? 'wk' : sub.billing_cycle === 'quarterly' ? 'qtr' : `${sub.billing_interval}x`}
                            </span>
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Autodebet toggle */}
                            {isActive && onToggleAutodebet && (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                onToggleAutodebet(sub.id).then(ok => {
                                  onNotify?.(ok ? (sub.autodebet ? 'Autodebet off' : 'Autodebet on') : 'Toggle failed', ok ? 'success' : 'error');
                                  onRefresh?.();
                                });
                              }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${sub.autodebet ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                                title={sub.autodebet ? 'Autodebet ON — click to disable' : 'Autodebet OFF — click to enable'}>
                                {sub.autodebet ? '⚡ Auto' : '⏸ Manual'}
                              </button>
                            )}
                            {/* Record payment */}
                            {isActive && onRecordPaymentManual && (
                              <button onClick={(e) => { e.stopPropagation(); openRecordPayment(sub); }}
                                className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-zinc-500 hover:text-emerald-400 transition-colors"
                                title="Record manual payment">
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Payment history */}
                            {onGetPaymentHistory && (
                              <button onClick={(e) => { e.stopPropagation(); loadHistory(sub); }}
                                className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Payment history">
                                <History className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => { setEditingSub(sub); setShowModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDelete === sub.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={async () => {
                                  const ok = await onDelete(sub.id);
                                  setConfirmDelete(null);
                                  onNotify?.(ok ? 'Subscription deleted' : 'Delete failed', ok ? 'success' : 'error');
                                }}
                                  className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(sub.id)}
                                className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassSurface>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <SubscriptionModal
            subscription={editingSub}
            wallets={wallets}
            categories={categories}
            displayCurrency={displayCurrency}
            onClose={() => { setShowModal(false); setEditingSub(null); }}
            onSave={async (data) => {
              try {
                const ok = editingSub
                  ? await onUpdate({ ...data, id: editingSub.id })
                  : await onCreate(data);
                if (ok) {
                  onNotify?.(editingSub ? 'Subscription updated' : 'Subscription created', 'success');
                  setShowModal(false); setEditingSub(null);
                } else {
                  onNotify?.('Failed to save — try again', 'error');
                }
                return ok;
              } catch {
                onNotify?.('Failed to save — try again', 'error');
                return false;
              }
            }}
            onMoveTransaction={onMoveTransaction}
          />
        )}
      </AnimatePresence>

      {/* Payment History Modal */}
      <AnimatePresence>
        {historySub && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-4"
            onClick={() => setHistorySub(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700/50 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">{historySub.name}</h3>
                  <p className="text-[11px] text-zinc-500">{fmtMoney(historySub.price)} / {historySub.billing_cycle}</p>
                </div>
                <button onClick={() => setHistorySub(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {historyLoading ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">Loading...</div>
                ) : paymentHistory.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">No payment history</div>
                ) : paymentHistory.map((record, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${
                    record.status === 'paid' ? 'border-emerald-900/30 bg-emerald-950/20' :
                    record.status === 'failed' ? 'border-red-900/30 bg-red-950/20' :
                    record.status === 'unpaid' ? 'border-zinc-800/30 bg-zinc-800/20' :
                    'border-blue-900/30 bg-blue-950/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      {record.status === 'paid' ? <CircleCheck size={14} className="text-emerald-400" /> :
                       record.status === 'failed' ? <XCircle size={14} className="text-red-400" /> :
                       <Clock size={14} className="text-zinc-500" />}
                      <div>
                        <div className="text-xs font-medium text-zinc-200">{formatDate(record.date)}</div>
                        <div className="text-[10px] text-zinc-500 capitalize">{record.status}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-zinc-200">{fmtMoney(record.amount)}</div>
                      {record.status === 'unpaid' && onRetryPayment && (
                        <button onClick={async () => {
                          const r = await onRetryPayment(historySub.id, undefined, record.date);
                          if (r?.success) { onNotify?.('Payment retried', 'success'); loadHistory(historySub); onRefresh?.(); }
                          else onNotify?.(r?.error || 'Retry failed', 'error');
                        }} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                          <RotateCcw size={10} /> Retry
                        </button>
                      )}
                      {record.status === 'paid' && record.txnId && onCancelPayment && (
                        <button onClick={async () => {
                          const ok = await onCancelPayment(historySub.id, record.txnId, 'User cancelled');
                          if (ok) { onNotify?.('Payment cancelled', 'success'); loadHistory(historySub); onRefresh?.(); }
                        }} className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1">
                          <XCircle size={10} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-zinc-800 grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-emerald-400">{paymentHistory.filter(h => h.status === 'paid').length}</div>
                  <div className="text-[10px] text-zinc-500">Paid</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-red-400">{paymentHistory.filter(h => h.status === 'failed').length}</div>
                  <div className="text-[10px] text-zinc-500">Failed</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-zinc-400">{paymentHistory.filter(h => h.status === 'unpaid').length}</div>
                  <div className="text-[10px] text-zinc-500">Unpaid</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Payment Modal */}
      <AnimatePresence>
        {recordPaySub && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[var(--z-modal)] flex items-center justify-center p-4"
            onClick={() => setRecordPaySub(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700/50 rounded-xl w-full max-w-sm">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">Record Payment</h3>
                  <p className="text-[11px] text-zinc-500">{recordPaySub.name}</p>
                </div>
                <button onClick={() => setRecordPaySub(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block flex items-center gap-1"><Calendar size={10} /> Payment Date</label>
                  <input type="date" value={recordPayDate} onChange={e => setRecordPayDate(e.target.value)}
                    className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block">Amount</label>
                  <input type="number" value={recordPayAmount} onChange={e => setRecordPayAmount(e.target.value)}
                    className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500 tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block flex items-center gap-1"><Wallet size={10} /> Pay From</label>
                  <select value={recordPayWallet} onChange={e => setRecordPayWallet(Number(e.target.value))}
                    className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 px-3 py-2.5 outline-none focus:border-zinc-500">
                    <option value={0}>Select wallet</option>
                    {wallets.filter(w => !w.is_archived).map(w => (
                      <option key={w.id} value={w.id}>{w.name} — {fmtMoney(w.balance || 0)}</option>
                    ))}
                  </select>
                  {recordPayWallet > 0 && (() => {
                    const w = walletMap.get(recordPayWallet);
                    const amt = parseFloat(recordPayAmount) || 0;
                    const ok = w && (w.balance || 0) >= amt;
                    return (
                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ok ? <Check size={10} /> : <AlertTriangle size={10} />}
                        {ok ? 'Sufficient balance' : showNumbers ? `Need ${formatCurrency(amt, displayCurrency)}, have ${formatCurrency(w?.balance || 0, displayCurrency)}` : `Need ${maskNumber(formatCurrency(amt, displayCurrency), maskMode, maskFixedValue)}, have ${maskNumber(formatCurrency(w?.balance || 0, displayCurrency), maskMode, maskFixedValue)}`}
                      </div>
                    );
                  })()}
                </div>
                {recordPayError && (
                  <div className="text-[11px] text-red-400 bg-red-500/10 rounded-lg p-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {recordPayError}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-zinc-800">
                <button onClick={() => setRecordPaySub(null)} className="text-xs px-3 py-1.5 text-zinc-400 hover:text-zinc-200">Cancel</button>
                <button onClick={submitRecordPayment}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium transition-colors">
                  <Check size={12} /> Record
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

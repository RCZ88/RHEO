import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import {
  CalendarClock, Plus, Edit3, Trash2, ExternalLink, Bell, BellOff, Calendar,
  Wallet, CreditCard, RefreshCw, X, Check, AlertTriangle, Search,
  ArrowUpRight, DollarSign, Clock, Pause, Play, ArrowLeft, Nfc
} from 'lucide-react';
import { GlassSurface } from '../components/finance/_fx/GlassSurface';
import { pageContainer, riseItem } from '../components/finance/_fx/financeMotion';
import { formatCurrency } from '../components/finance/currency-data';
import { useNumberMask } from '../context/NumberMaskContext';
import { maskNumber } from '../utils/maskNumber';
import { SubscriptionModal } from '../components/finance/SubscriptionModal';
import type { FinanceSubscription, FinanceWallet, FinanceTransaction, FinanceCategory } from '../components/finance/finance-types';

function daysUntil(dateStr: string): number {
  if (!dateStr) return NaN;
  const now = new Date();
  const target = new Date(dateStr.length > 10 ? dateStr.slice(0, 10) + 'T00:00:00' : dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return NaN;
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

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', icon: <Play className="w-3 h-3" /> },
  paused: { label: 'Paused', color: '#eab308', bg: 'rgba(234,179,8,0.08)', icon: <Pause className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: <X className="w-3 h-3" /> },
  expired: { label: 'Expired', color: '#52525b', bg: 'rgba(82,82,91,0.08)', icon: <Clock className="w-3 h-3" /> },
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

interface SubscriptionsPageViewProps {
  subscriptions: FinanceSubscription[];
  wallets: FinanceWallet[];
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  displayCurrency: string;
  baseCurrency: string;
  onBack: () => void;
  onCreate: (data: any) => Promise<boolean>;
  onUpdate: (data: any) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onRecordPayment: (sub: FinanceSubscription) => Promise<void>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function SubscriptionsPageView({
  subscriptions, wallets, transactions, categories, displayCurrency, baseCurrency,
  onBack, onCreate, onUpdate, onDelete, onRecordPayment, loading, error, onRetry,
}: SubscriptionsPageViewProps) {
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmtMoney = (v: number, currency?: string) =>
    showNumbers ? formatCurrency(v, currency ?? displayCurrency) : maskNumber(formatCurrency(v, currency ?? displayCurrency), maskMode, maskFixedValue);

  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<FinanceSubscription | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'renewal' | 'price' | 'name'>('renewal');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [expandedSub, setExpandedSub] = useState<number | null>(null);
  const [recordingPayment, setRecordingPayment] = useState<number | null>(null);

  const walletMap = useMemo(() => {
    const m = new Map<number, FinanceWallet>();
    wallets.forEach(w => m.set(w.id, w));
    return m;
  }, [wallets]);

  const totalMonthly = useMemo(() =>
    subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + computeMonthlyCost(s), 0),
    [subscriptions]
  );

  const totalYearly = totalMonthly * 12;

  const upcomingRenewals = useMemo(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return subscriptions.filter(s =>
      s.status === 'active' && s.next_renewal_date &&
      new Date(s.next_renewal_date) <= endOfMonth && new Date(s.next_renewal_date) >= now
    );
  }, [subscriptions]);

  const filtered = useMemo(() => {
    let items = subscriptions;
    if (filterStatus !== 'all') items = items.filter(s => s.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        walletMap.get(s.wallet_id)?.name.toLowerCase().includes(q)
      );
    }
    items = [...items].sort((a, b) => {
      if (sortBy === 'renewal') return (a.next_renewal_date || '9999').localeCompare(b.next_renewal_date || '9999');
      if (sortBy === 'price') return computeMonthlyCost(b) - computeMonthlyCost(a);
      return a.name.localeCompare(b.name);
    });
    return items;
  }, [subscriptions, filterStatus, searchQuery, sortBy, walletMap]);

  const getSubPayments = (sub: FinanceSubscription) => {
    return transactions.filter(tx =>
      tx.wallet_id === sub.wallet_id && tx.type === 'expense' &&
      tx.description?.includes(sub.name)
    ).slice(0, 6);
  };

  const handleRecordPayment = async (sub: FinanceSubscription) => {
    setRecordingPayment(sub.id);
    try {
      await onRecordPayment(sub);
    } finally {
      setRecordingPayment(null);
    }
  };

  return (
    <motion.div variants={pageContainer} initial="hidden" animate="show" className="space-y-4">
      {/* Back button + header */}
      <motion.div variants={riseItem} className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Subscriptions</h1>
            <p className="text-[11px] text-zinc-500">Manage recurring payments</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingSub(null); setShowModal(true); }}
          className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Subscription
        </button>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={riseItem} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassSurface className="p-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Monthly spend</div>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">{fmtMoney(totalMonthly)}<span className="text-xs text-zinc-500 font-normal">/mo</span></p>
        </GlassSurface>
        <GlassSurface className="p-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Yearly</div>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">{fmtMoney(totalYearly)}<span className="text-xs text-zinc-500 font-normal">/yr</span></p>
        </GlassSurface>
        <GlassSurface className="p-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Upcoming renewals</div>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">
            {upcomingRenewals.length}
            <span className="text-xs text-zinc-500 font-normal ml-1">this month</span>
          </p>
          {upcomingRenewals.length > 0 && (
            <p className="text-[10px] text-amber-400 mt-1">
              {fmtMoney(upcomingRenewals.reduce((s, sub) => s + sub.price, 0))} total
            </p>
          )}
        </GlassSurface>
      </motion.div>

      {/* Search + filters + sort */}
      <motion.div variants={riseItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <VoiceInputWrapper>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search subscriptions..."
              className="w-full bg-zinc-800/60 text-sm text-white rounded-lg border border-zinc-700/50 pl-9 pr-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-zinc-500 transition-colors"
            />
          </VoiceInputWrapper>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All', count: subscriptions.length },
            ...Object.entries(statusConfig).map(([k, v]) => ({
              key: k, label: v.label, count: subscriptions.filter(s => s.status === k).length
            })),
          ].filter(x => x.count > 0 || x.key === 'all').map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilterStatus(opt.key)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                filterStatus === opt.key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.label}{opt.count > 0 && opt.key !== 'all' ? ` (${opt.count})` : ''}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="bg-zinc-800/60 text-xs text-zinc-300 rounded-lg border border-zinc-700/50 px-3 py-2 outline-none"
        >
          <option value="renewal">Sort: Renewal date</option>
          <option value="price">Sort: Price</option>
          <option value="name">Sort: Name</option>
        </select>
      </motion.div>

      {/* Subscription cards */}
      <motion.div variants={riseItem}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-zinc-800/60 rounded-xl h-48" />
            ))}
          </div>
        ) : error ? (
          <GlassSurface className="p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 mb-3">{error}</p>
            <button onClick={onRetry} className="text-xs px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
              Retry
            </button>
          </GlassSurface>
        ) : filtered.length === 0 ? (
          <GlassSurface className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
              <CalendarClock className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-sm text-zinc-400 mb-1">
              {searchQuery ? 'No subscriptions match your search' : 'No subscriptions yet'}
            </p>
            <p className="text-[11px] text-zinc-600 mb-4">Track your recurring payments and never miss a renewal</p>
            <button
              onClick={() => { setEditingSub(null); setShowModal(true); }}
              className="text-xs px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors"
            >
              Add your first subscription
            </button>
          </GlassSurface>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map(sub => {
                const wallet = walletMap.get(sub.wallet_id);
                const renewalDays = sub.next_renewal_date ? daysUntil(sub.next_renewal_date) : null;
                const urgency = renewalDays !== null ? getRenewalUrgency(renewalDays) : null;
                const isActive = sub.status === 'active';
                const isExpanded = expandedSub === sub.id;
                const payments = getSubPayments(sub);
                const monthlyCost = computeMonthlyCost(sub);

                return (
                  <motion.div
                    key={sub.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <GlassSurface className="p-4 group hover:border-indigo-500/20 transition-colors h-full flex flex-col">
                      {/* Top row: name + status + actions */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white truncate">{sub.name}</span>
                            {sub.cancel_reminder_days > 0 && isActive && (
                              <Bell className="w-3 h-3 text-indigo-400 shrink-0" title={`Reminder ${sub.cancel_reminder_days}d before`} />
                            )}
                          </div>
                          {sub.description && (
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5">{sub.description}</p>
                          )}
                        </div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0"
                          style={{ color: statusConfig[sub.status]?.color, backgroundColor: statusConfig[sub.status]?.bg }}
                        >
                          {statusConfig[sub.status]?.icon}
                          {statusConfig[sub.status]?.label}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="mb-3">
                        <p className="text-xl font-bold tabular-nums text-white">
                          {fmtMoney(sub.price, sub.currency)}
                          <span className="text-xs text-zinc-500 font-normal ml-1">
                            /{sub.billing_cycle === 'monthly' ? 'mo' : sub.billing_cycle === 'yearly' ? 'yr' : sub.billing_cycle === 'weekly' ? 'wk' : sub.billing_cycle === 'quarterly' ? 'qtr' : `${sub.billing_interval}x`}
                          </span>
                        </p>
                        {sub.billing_cycle !== 'monthly' && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">≈ {fmtMoney(monthlyCost)}/mo</p>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-2 flex-1">
                        {sub.start_date && (
                          <div className="flex items-center gap-2 text-[11px]">
                            <Calendar className="w-3 h-3 text-zinc-600" />
                            <span className="text-zinc-500">Started {formatDate(sub.start_date)}</span>
                          </div>
                        )}
                        {sub.next_renewal_date && (
                          <div className="flex items-center gap-2 text-[11px]">
                            <RefreshCw className="w-3 h-3 text-zinc-600" />
                            <span className="text-zinc-500">Renews {formatDate(sub.next_renewal_date)}</span>
                            {urgency && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: urgency.color, backgroundColor: urgency.bg }}>
                                {urgency.label}
                              </span>
                            )}
                          </div>
                        )}
                        {wallet && (
                          <div className="flex items-center gap-2 text-[11px]">
                            {getWalletIcon(wallet.type)}
                            <span className="text-zinc-500">{wallet.name}</span>
                          </div>
                        )}
                        {sub.cancel_url && isActive && (
                          <a
                            href={sub.cancel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" /> Cancel link
                          </a>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-800">
                        {isActive && (
                          <button
                            onClick={() => handleRecordPayment(sub)}
                            disabled={recordingPayment === sub.id}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] px-2.5 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                          >
                            {recordingPayment === sub.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <DollarSign className="w-3 h-3" />
                            )}
                            Record Payment
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingSub(sub); setShowModal(true); }}
                          className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDelete === sub.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => { await onDelete(sub.id); setConfirmDelete(null); }}
                              className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(sub.id)}
                            className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Payment history (expandable) */}
                      {payments.length > 0 && (
                        <button
                          onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                          className="mt-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors text-left"
                        >
                          {isExpanded ? 'Hide' : 'Show'} {payments.length} payment{payments.length !== 1 ? 's' : ''}
                        </button>
                      )}
                      <AnimatePresence>
                        {isExpanded && payments.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 space-y-1 pt-2 border-t border-zinc-800/50">
                              {payments.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between text-[10px]">
                                  <span className="text-zinc-500">{formatDate(tx.date)}</span>
                                  <span className="tabular-nums text-zinc-400">{fmtMoney(Math.abs(tx.amount))}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassSurface>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <SubscriptionModal
            subscription={editingSub}
            wallets={wallets}
            displayCurrency={displayCurrency}
            onClose={() => { setShowModal(false); setEditingSub(null); }}
            onSave={async (data) => {
              const ok = editingSub
                ? await onUpdate({ ...data, id: editingSub.id })
                : await onCreate(data);
              if (ok) { setShowModal(false); setEditingSub(null); }
              return ok;
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

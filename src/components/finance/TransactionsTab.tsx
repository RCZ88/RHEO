import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Search, Trash2, Lock as LockIcon, Calendar, X, Handshake, CircleCheck, Bell, ArrowUpDown, Clock, Tag, ChevronDown, Check } from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { TabHeader } from './_fx/TabHeader';
import { EmptyState } from './EmptyState';
import { TransactionDetailModal } from './TransactionDetailModal';
import { convertAmount, formatCurrency as fmtCurrency } from './currency-data';
import type { FinanceTransaction, FinanceAccount, FinanceCategory, FinanceWallet } from './finance-types';
import { useTransactionSelection } from './_fx/useTransactionSelection';
import { useSelectionAggregate } from './_fx/useSelectionAggregate';
import { TransactionCheckbox } from './_fx/TransactionCheckbox';
import { useDragSelect } from './_fx/useDragSelect';
import { SelectionAggregatePanel } from './SelectionAggregatePanel';
import { BatchRecategorizeModal } from './modals/BatchRecategorizeModal';
import { exportTransactionsCsv } from './csvExport';
import { getRepaymentStatus, getFtPerson } from '../../lib/receivables';

function HistoricalReorderPanel({ transactions, displayCurrency, baseCurrency, onOrderChanged }: {
  transactions: FinanceTransaction[]; displayCurrency: string; baseCurrency: string; onOrderChanged: () => void;
}) {
  const fc = (v: number) => fmtCurrency(convertAmount(v, baseCurrency, displayCurrency), displayCurrency);
  const [order, setOrder] = useState<FinanceTransaction[]>(() =>
    [...transactions].sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0))
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
    setDirty(true);
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (idx: number) => {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      moveItem(dragIdx.current, idx);
    }
    dragIdx.current = null;
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = order.map((t, i) => ({ id: t.id, sort_order: i + 1 }));
    await (window as any).deskflowAPI?.financeUpdateTransactionSortOrder(updates);
    setSaving(false);
    setDirty(false);
    if (onOrderChanged) onOrderChanged();
    else window.location.reload();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] text-zinc-500">Drag to reorder chronological order</span>
        <button onClick={handleSave} disabled={!dirty || saving}
          className="text-[10px] px-2 py-0.5 rounded-full transition-colors disabled:opacity-40"
          style={{ background: dirty ? 'rgba(139,92,246,0.2)' : 'transparent', color: dirty ? '#8B5CF6' : '#71717a' }}>
          {saving ? 'Saving...' : dirty ? 'Sync Order' : 'No changes'}
        </button>
      </div>
      {order.map((txn, idx) => {
        let cryptoLabel: string | null = null;
        let cryptoSymbol: string | null = null;
        if (txn.metadata) {
          try {
            const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
            if (m.coinId || m.coin_id) {
              cryptoSymbol = (m.symbol || '').toUpperCase();
              const qty = Number(m.qty) || 0;
              cryptoLabel = `${qty.toFixed(8).replace(/\.?0+$/, '')} ${cryptoSymbol}`;
            }
          } catch {}
        }
        const wallet = txn.wallet_id;
        return (
          <div key={txn.id} draggable onDragStart={() => handleDragStart(idx)}
            onDragOver={handleDragOver} onDrop={() => handleDrop(idx)}
            className="flex items-center gap-2 py-2 px-3 rounded-lg bg-violet-500/[0.06] border-l-2 border-l-violet-500/40 hover:bg-violet-500/10 transition-colors cursor-grab active:cursor-grabbing">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveItem(idx, idx - 1)} className="text-zinc-600 hover:text-zinc-300"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg></button>
              <button onClick={() => moveItem(idx, idx + 1)} className="text-zinc-600 hover:text-zinc-300"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-violet-400/60 tabular-nums w-4 text-right">{idx + 1}</span>
                <span className="text-[13px] text-zinc-300 truncate">{txn.description || 'Untitled'}</span>
                {idx === 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">Earliest</span>}
                {idx === order.length - 1 && order.length > 1 && <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">Latest</span>}
              </div>
              {cryptoLabel && <div className="text-[10px] text-[#8B5CF6]/70 mt-0.5 font-mono ml-5">{cryptoLabel}</div>}
            </div>
            <div className="text-right shrink-0">
              {cryptoLabel ? (
                <p className="text-[13px] font-semibold tabular-nums text-[#8B5CF6]">{cryptoLabel}</p>
              ) : (
                <p className={`text-[13px] font-semibold tabular-nums ${txn.type === 'income' ? 'text-emerald-400' : txn.type === 'transfer' ? 'text-amber-400' : 'text-red-400'}`}>
                  {txn.type === 'expense' ? '-' : txn.type === 'income' ? '+' : ''}{fc(Math.abs(txn.amount))}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TransactionsTabProps {
  transactions: FinanceTransaction[];
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  wallets: FinanceWallet[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  displayCurrency: string;
  baseCurrency: string;
  onAddTransaction: (data: {
    account_id: number; wallet_id: number | null; category_id: number;
    type: 'income' | 'expense' | 'transfer'; amount: number;
    description: string; note: string; date: string;
  }) => Promise<boolean>;
  onDeleteTransaction: (id: number) => Promise<boolean>;
  onUpdateTransaction?: (id: number, data: Record<string, any>) => Promise<boolean>;
  onVerifyPassword?: (password: string) => Promise<boolean>;
  onRecordFtRepayment?: (data: { originalTxId: number; personId?: number; amount: number; date: string; walletId?: number; description?: string; isOverpayment?: boolean }) => Promise<boolean>;
  ftPersons?: { id: number; name: string; email?: string | null; phone?: string | null }[];
  onAddFtPerson?: (name: string) => void;
  scrollToTransactionId?: number | null;
  onScrollToTransactionDone?: () => void;
}

const formatDateLabel = (dateStr: string) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const typeFilters = [
  { key: 'all' as const, label: 'All' },
  { key: 'income' as const, label: 'Income', color: 'emerald' },
  { key: 'expense' as const, label: 'Expense', color: 'red' },
  { key: 'transfer' as const, label: 'Transfer', color: 'amber' },
  { key: 'ft' as const, label: 'Follow Through', color: 'amber' },
  { key: 'historical' as const, label: 'Historical', color: 'violet' },
];

const typeColors: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  income: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500/40', text: 'text-emerald-400' },
  expense: { icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-l-red-500/40', text: 'text-red-400' },
  transfer: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-l-amber-500/40', text: 'text-amber-400' },
  historical: { icon: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-l-violet-500/40', text: 'text-violet-400' },
};

const WALLET_TYPE_LABEL: Record<string, string> = {
  bank: 'Bank', debit_card: 'Debit', credit_card: 'Credit', crypto: 'Crypto',
  cash: 'Cash', physical: 'Physical', ewallet: 'E-Wallet', other: 'Other',
};
const WALLET_TYPE_COLOR: Record<string, string> = {
  bank: '#3B82F6', debit_card: '#10B981', credit_card: '#F59E0B', crypto: '#8B5CF6',
  cash: '#EC4899', physical: '#F97316', ewallet: '#06B6D4', other: '#6B7280',
};

export function TransactionsTab({ transactions, accounts, categories, wallets, loading, error, onRetry, displayCurrency, baseCurrency, onAddTransaction, onDeleteTransaction, onUpdateTransaction, onVerifyPassword, ftPersons = [], onAddFtPerson, scrollToTransactionId, onScrollToTransactionDone }: TransactionsTabProps) {
  const historicalRef = useRef<HTMLDivElement>(null);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const jumpToHistorical = () => {
    historicalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<ReturnType<typeof setTimeout>>();
  const [typeFilter, setTypeFilter] = useState<string[]>(['all']);
  const [categoryFilter, setCategoryFilter] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [deletePasswordTarget, setDeletePasswordTarget] = useState<number | null>(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [detailTxn, setDetailTxn] = useState<FinanceTransaction | null>(null);
  const [showReorder, setShowReorder] = useState(false);
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 200);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  const filtered = useMemo(() => {
    let list = transactions;
    // Multi-select type filter
    const showAll = typeFilter.includes('all');
    if (!showAll && typeFilter.length > 0) {
      list = list.filter(t => {
        for (const f of typeFilter) {
          if (f === 'ft' && t.on_behalf_of === 1 && t.type === 'expense') return true;
          if (f === 'historical' && t.is_adjustment === 1) return true;
          if (f === t.type) return true;
        }
        return false;
      });
    }
    // Multi-select category filter
    if (categoryFilter.length > 0) {
      list = list.filter(t => categoryFilter.includes(t.category_id));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(t => (t.description?.toLowerCase() || '').includes(q));
    }
    if (dateStart) list = list.filter(t => (t.date || '') >= dateStart);
    if (dateEnd) list = list.filter(t => (t.date || '') <= dateEnd);
    const dir = sortDir === 'desc' ? -1 : 1;
    return list.sort((a, b) => {
      if (sortBy === 'date') return dir * (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'amount') return dir * (Math.abs(a.amount) - Math.abs(b.amount));
      if (sortBy === 'name') return dir * (a.description || '').localeCompare(b.description || '');
      return 0;
    });
  }, [transactions, typeFilter, categoryFilter, debouncedSearch, dateStart, dateEnd, sortBy, sortDir]);

  // Separate historical from regular, then group regular by date
  const { regularGrouped, historicalTxns } = useMemo(() => {
    const regularTxns = filtered.filter(t => !t.is_adjustment);
    const histTxns = filtered.filter(t => t.is_adjustment);

    const groups: Record<string, { dateStr: string; txns: FinanceTransaction[]; netTotal: number }> = {};
    for (const t of regularTxns) {
      const key = t.date || 'Unknown';
      if (!groups[key]) {
        groups[key] = { dateStr: key, txns: [], netTotal: 0 };
      }
      groups[key].txns.push(t);
      groups[key].netTotal += t.type === 'income' ? t.amount : t.type === 'transfer' ? t.amount : -t.amount;
    }
    return { regularGrouped: groups, historicalTxns: histTxns };
  }, [filtered]);

  // Show jump button when historical section is off-screen
  useEffect(() => {
    const el = historicalRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowJumpBtn(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-100px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [historicalTxns.length]);

  // Scroll to a specific transaction when scrollToTransactionId changes
  useEffect(() => {
    if (!scrollToTransactionId) return;
    const el = document.querySelector(`[data-tx-id="${scrollToTransactionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-500/60', 'rounded-xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-500/60', 'rounded-xl');
      }, 3000);
    }
    onScrollToTransactionDone?.();
  }, [scrollToTransactionId, onScrollToTransactionDone]);

  // Build ordered list with year separators
  const orderedGroups = useMemo(() => {
    const sortedKeys = Object.keys(regularGrouped).sort((a, b) => b.localeCompare(a));
    const result: { type: 'year' | 'group'; key: string; year?: string; group?: typeof regularGrouped[string] }[] = [];
    let lastYear = '';
    for (const key of sortedKeys) {
      const year = key.substring(0, 4);
      if (year !== lastYear) {
        result.push({ type: 'year', key: `year-${year}`, year });
        lastYear = year;
      }
      result.push({ type: 'group', key, group: regularGrouped[key] });
    }
    return result;
  }, [regularGrouped]);

  const fc = (amount: number) => fmtCurrency(convertAmount(amount, baseCurrency, displayCurrency), displayCurrency);

  const getCategory = (id: number) => categories.find(c => c.id === id);
  const getAccount = (id: number) => accounts.find(a => a.id === id);
  const getWallet = (id: number | null) => id ? wallets.find(w => w.id === id) : null;

  // ── Selection state (multi-select + aggregate) ──
  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered])
  const visibleOrder = filteredIds
  const { derived, derivedSelectedIds, api } = useTransactionSelection(filteredIds)

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets])
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const aggMeta = useMemo(
    () => ({
      categoryName: (id: number) => categoryMap.get(id)?.name ?? 'Uncategorized',
      categoryColor: (id: number) => categoryMap.get(id)?.color ?? '#6B7280',
      categoryIcon: (id: number) => categoryMap.get(id)?.icon ?? 'circle',
      walletName: (id: number | null) => id == null ? 'Unassigned' : walletMap.get(id)?.name ?? 'Unknown',
    }),
    [categoryMap, walletMap],
  )

  const aggregate = useSelectionAggregate(transactions, derivedSelectedIds, aggMeta, filteredIds.length, derived.isMixed)
  const selectionActive = derived.count > 0

  const drag = useDragSelect((id) => api.selectOne(id))
  const panelOpen = selectionActive && !drag.dragging

  const [recatOpen, setRecatOpen] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)

  const requestBatchDelete = async () => {
    const ids = [...derivedSelectedIds]
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} transaction${ids.length === 1 ? '' : 's'}?`)) return
    setBatchBusy(true)
    const failed: number[] = []
    for (const id of ids) {
      const ok = await onDeleteTransaction(id)
      if (!ok) failed.push(id)
    }
    setBatchBusy(false)
    if (failed.length) {
      alert(`${failed.length} couldn't be deleted — try again`)
    } else {
      api.clear()
    }
  }

  const applyRecategorize = async (categoryId: number) => {
    const ids = [...derivedSelectedIds]
    setBatchBusy(true)
    const res = await window.deskflowAPI.financeBatchUpdateCategory(ids, categoryId)
    setBatchBusy(false)
    setRecatOpen(false)
    if (res?.success) {
      api.clear()
    } else {
      alert('Recategorize failed — try again')
    }
  }

  const applyFollowThrough = async (value: 0 | 1) => {
    const ids = [...derivedSelectedIds]
    if (!onUpdateTransaction || ids.length === 0) return
    setBatchBusy(true)
    let ok = 0
    for (const id of ids) {
      const r = await onUpdateTransaction(id, { on_behalf_of: value })
      if (r) ok++
    }
    setBatchBusy(false)
    if (ok > 0) api.clear()
  }

  const applyMarkRepaid = async () => {
    const ids = [...derivedSelectedIds].filter(id => {
      const tx = transactions.find(t => t.id === id)
      return tx && tx.on_behalf_of === 1 && tx.type === 'expense'
    })
    if (!onUpdateTransaction || ids.length === 0) return
    setBatchBusy(true)
    let ok = 0
    for (const id of ids) {
      const tx = transactions.find(t => t.id === id)
      if (!tx) continue
      const currentTags = tx.tags ?? ''
      const repaidTag = `ft_repaid:${id}`
      const newTags = currentTags ? `${currentTags},${repaidTag}` : repaidTag
      const r = await onUpdateTransaction(id, { tags: newTags })
      if (r) ok++
    }
    setBatchBusy(false)
    if (ok > 0) api.clear()
  }

  const hasUnrepaidFT = useMemo(() => {
    return transactions.some(t => t.on_behalf_of === 1 && t.type === 'expense' && derivedSelectedIds.has(t.id))
  }, [transactions, derivedSelectedIds])

  const handleExport = () => {
    const rows = transactions.filter((t) => derivedSelectedIds.has(t.id))
    exportTransactionsCsv(rows, {
      categoryName: (id) => categoryMap.get(id)?.name ?? 'Uncategorized',
      walletName: (id) => (id == null ? 'Unassigned' : walletMap.get(id)?.name ?? 'Unknown'),
      accountName: (id) => accountMap.get(id)?.name ?? 'Account',
    })
  }

  // keyboard shortcuts — scoped to the tab, ignored while typing in an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        api.selectAllFiltered()
      } else if (e.key === 'Escape' && selectionActive) {
        api.clear()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectionActive) {
        e.preventDefault()
        requestBatchDelete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [api, selectionActive])

  const handleDelete = async (id: number) => {
    setDeleting(true);
    await onDeleteTransaction(id);
    setConfirmingDeleteId(null);
    setDeleting(false);
  };

  const handlePasswordDelete = async (id: number) => {
    if (!onVerifyPassword || !deletePassword) return;
    setDeletePasswordError('');
    const valid = await onVerifyPassword(deletePassword);
    if (!valid) {
      setDeletePasswordError('Incorrect password');
      return;
    }
    setDeletePassword('');
    setDeletePasswordTarget(null);
    await handleDelete(id);
  };

  const hasActiveFilters = debouncedSearch || !typeFilter.includes('all') || categoryFilter.length > 0 || dateStart || dateEnd;

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
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse bg-zinc-800/60 rounded-xl h-14" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <TabHeader
        title="Transactions"
        icon={<ArrowUpRight className="w-4 h-4" />}
      />

      {/* Filter bar — glass card, not full-bleed */}
      <GlassSurface className="p-3 space-y-3">
        {/* Search + type pills */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-zinc-600 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {typeFilters.map(tf => {
              const active = typeFilter.includes(tf.key);
              const isAll = tf.key === 'all';
              const selected = isAll ? typeFilter.includes('all') : active;
              return (
                <button
                  key={tf.key}
                  onClick={() => {
                    if (isAll) {
                      setTypeFilter(['all']);
                    } else {
                      setTypeFilter(prev => {
                        const withoutAll = prev.filter(k => k !== 'all');
                        if (withoutAll.includes(tf.key)) {
                          const next = withoutAll.filter(k => k !== tf.key);
                          return next.length === 0 ? ['all'] : next;
                        }
                        return [...withoutAll, tf.key];
                      });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 border ${
                    selected
                      ? isAll
                        ? 'bg-zinc-700/60 text-white border-zinc-600/50 shadow-sm'
                        : tf.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : tf.color === 'red' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : tf.color === 'amber' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : tf.color === 'violet' ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                        : 'bg-zinc-700/60 text-white border-zinc-600/50'
                      : 'bg-transparent text-zinc-500 border-zinc-700/30 hover:text-zinc-300 hover:border-zinc-600/50'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
          {/* Category Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                const el = document.getElementById('category-filter-dropdown');
                if (el) el.classList.toggle('hidden');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                categoryFilter.length > 0
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : 'bg-transparent text-zinc-500 border-zinc-700/30 hover:text-zinc-300 hover:border-zinc-600/50'
              }`}
            >
              <Tag className="w-3 h-3" />
              {categoryFilter.length > 0 ? `${categoryFilter.length} category${categoryFilter.length > 1 ? 's' : ''}` : 'Category'}
              <ChevronDown className="w-3 h-3" />
            </button>
            <div id="category-filter-dropdown" className="hidden absolute z-20 mt-1 w-56 rounded-xl bg-zinc-800 border border-zinc-700/60 shadow-xl py-1 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setCategoryFilter([]); document.getElementById('category-filter-dropdown')?.classList.add('hidden'); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors flex items-center gap-2"
              >
                <span className={`w-2 h-2 rounded-full ${categoryFilter.length === 0 ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
                <span className={categoryFilter.length === 0 ? 'text-indigo-400' : 'text-zinc-400'}>All Categories</span>
              </button>
              {categories.map(cat => {
                const selected = categoryFilter.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategoryFilter(prev => {
                        if (prev.includes(cat.id)) return prev.filter(id => id !== cat.id);
                        return [...prev, cat.id];
                      });
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700/50 transition-colors flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#6B7280' }} />
                    <span className={selected ? 'text-white' : 'text-zinc-400'}>{cat.name}</span>
                    {selected && <Check className="w-3 h-3 text-indigo-400 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
          {selectionActive && (
            <button
              type="button"
              onClick={() => api.selectAllFiltered()}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors shrink-0"
            >
              {derived.headerState === 'all' ? 'Deselect all' : `Select all ${filtered.length}`}
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-zinc-600 shrink-0" />
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="flex-1 bg-zinc-800/40 border border-zinc-700/30 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-colors"
          />
          <span className="text-[10px] text-zinc-600">to</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="flex-1 bg-zinc-800/40 border border-zinc-700/30 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-colors"
          />
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setTypeFilter(['all']); setCategoryFilter([]); setDateStart(''); setDateEnd(''); }}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3 h-3 text-zinc-600 shrink-0" />
          <span className="text-[10px] text-zinc-600">Sort:</span>
          {(['date', 'amount', 'name'] as const).map(s => (
            <button key={s} onClick={() => { if (sortBy === s) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortBy(s); setSortDir('desc'); } }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${sortBy === s ? 'bg-zinc-700/60 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {s === 'date' ? 'Date' : s === 'amount' ? 'Amount' : 'Name'}
              {sortBy === s && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}
            </button>
          ))}
        </div>
      </GlassSurface>

      {/* Transaction groups */}
      {orderedGroups.length === 0 && historicalTxns.length === 0 ? (
        <EmptyState
          icon={<ArrowUpRight className="w-12 h-12" />}
          title={hasActiveFilters ? 'No matches' : 'No transactions yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Add your first transaction to start tracking'
          }
          action={undefined}
        />
      ) : (
        <div className="space-y-5">
          {orderedGroups.map((entry) => {
            if (entry.type === 'year') {
              return (
                <div key={entry.key} className="flex items-center gap-3 pt-2 pb-1 px-1">
                  <div className="h-px flex-1 bg-zinc-700/50" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{entry.year}</span>
                  <div className="h-px flex-1 bg-zinc-700/50" />
                </div>
              );
            }
            const group = entry.group!;
            const dateStr = group.dateStr;
              return (
              <div key={dateStr}>
              {/* Date header — clean separator */}
              <div className="flex items-center justify-between mb-3 px-1 group">
                <div className="flex items-center gap-1.5">
                  <TransactionCheckbox
                    checked={
                      group.txns.every((t) => api.isSelected(t.id)) ? true
                        : group.txns.some((t) => api.isSelected(t.id)) ? 'indeterminate'
                          : false
                    }
                    ariaLabel="Select all in this date group"
                    onToggle={() => api.toggleGroup(group.txns.map((t) => t.id))}
                  />
                  <div className="w-1 h-3 rounded-full bg-zinc-700" />
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {formatDateLabel(dateStr)}
                  </p>
                </div>
                <p className={`text-[11px] font-semibold tabular-nums ${group.netTotal >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                  {group.netTotal >= 0 ? '+' : ''}{showNumbers ? fc(group.netTotal) : maskNumber(fc(group.netTotal), maskMode, maskFixedValue)}
                </p>
              </div>

              {/* Transaction rows — proper spacing */}
              <div className="flex flex-col gap-3">
                  {group.txns.map(txn => {
                    const cat = getCategory(txn.category_id);
                    const acct = getAccount(txn.account_id);
                    const wallet = getWallet(txn.wallet_id);
                    const tc = typeColors[txn.type] || typeColors.expense;
                    const { onPointerDown, onPointerEnter } = drag.getRowHandlers(txn.id)
                    const isFT = txn.on_behalf_of === 1 && txn.type === 'expense';
                    const isHistorical = txn.is_adjustment === 1;
                    const isSubscription = txn.description?.startsWith('Subscription:') || txn.note?.startsWith('Subscription:');
                    const ftPerson = isFT ? getFtPerson(txn) : null;
                    const repayment = isFT ? getRepaymentStatus(txn, transactions) : null;
                    return (
                    <GlassSurface
                      key={txn.id}
                      data-tx-id={txn.id}
                      interactive
                      onPointerDown={onPointerDown}
                      onPointerEnter={onPointerEnter}
                      onClick={(e: React.MouseEvent) => {
                        if (drag.wasDragging()) return
                        // Don't open detail modal if clicking a real button/input inside the row
                        const target = e.target as HTMLElement;
                        const closest = target.closest('button, input, a, select, textarea');
                        if (closest) return;
                        setDetailTxn(txn)
                      }}
                      className={`!p-3.5 border-l-2 ${isFT ? 'border-l-amber-400 bg-amber-500/[0.03]' : isSubscription ? 'border-l-indigo-400 bg-indigo-500/[0.03]' : isHistorical ? 'border-l-violet-400 bg-violet-500/[0.03]' : tc.border} mx-0.5 transition-all duration-150 group relative`}
                    >
                      {/* Checkbox — absolutely positioned so it NEVER pushes content */}
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10">
                        <TransactionCheckbox
                          checked={api.isSelected(txn.id)}
                          ariaLabel={`Select ${txn.description || txn.type}`}
                          onToggle={(e) => {
                            if (e.shiftKey) api.selectRangeTo(txn.id, visibleOrder)
                            else if (e.ctrlKey || e.metaKey) api.toggleWithCtrl(txn.id)
                            else api.toggleOne(txn.id)
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-3 pl-7">
                        {/* Type icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isFT ? 'bg-amber-500/15' : isSubscription ? 'bg-indigo-500/15' : isHistorical ? 'bg-violet-500/15' : tc.bg}`}>
                          {isFT ? (
                            <Handshake className="w-4 h-4 text-amber-400" />
                          ) : isSubscription ? (
                            <Bell className="w-4 h-4 text-indigo-400" />
                          ) : isHistorical ? (
                            <ArrowUpRight className="w-4 h-4 text-violet-400" />
                          ) : txn.type === 'income' ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          ) : txn.type === 'expense' ? (
                            <ArrowDownRight className="w-4 h-4 text-red-400" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                          )}
                        </div>

                        {/* Wallet title + description + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <p className="text-[13px] font-semibold text-zinc-100 truncate">
                              {wallet ? wallet.name : (txn.description || cat?.name || 'Transaction')}
                            </p>
                            {wallet && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                                style={{ backgroundColor: `${WALLET_TYPE_COLOR[wallet.type] || '#6B7280'}18`, color: WALLET_TYPE_COLOR[wallet.type] || '#6B7280' }}>
                                {WALLET_TYPE_LABEL[wallet.type] || wallet.type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {wallet && txn.description && (
                              <span className="text-[10px] text-zinc-300 truncate max-w-[120px]">
                                {txn.description}
                              </span>
                            )}
                            {cat && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                                {cat.name}
                              </span>
                            )}
                            {isFT ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-400">
                                {ftPerson ? `for ${ftPerson}` : 'Follow Through'}
                              </span>
                            ) : null}
                            {isSubscription && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-400">
                                recurring
                              </span>
                            )}
                            {isHistorical && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-500/15 text-violet-400">
                                historical
                              </span>
                            )}
                            {isFT && repayment && (
                              repayment.repaid ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-400 inline-flex items-center gap-0.5">
                                  <CircleCheck className="w-2.5 h-2.5" /> Repaid
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400/60">
                                  Awaiting repayment
                                </span>
                              )
                            )}
                            <span className="text-[10px] text-zinc-600">
                              {acct?.name}
                            </span>
                            {txn.time && (
                              <span className="text-[10px] text-zinc-600">
                                {txn.time}
                              </span>
                            )}
                            {(() => {
                              if (txn.fee > 0) {
                                let cryptoFee: string | null = null;
                                if (txn.metadata) {
                                  try {
                                    const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
                                    if (m.fee && (m.coinId || m.coin_id) && m.symbol) {
                                      const fv = Number(m.fee);
                                      if (fv > 0) cryptoFee = `fee: ${fv.toFixed(8).replace(/\.?0+$/, '')} ${(m.symbol || '').toUpperCase()}`;
                                    }
                                  } catch { /* ignore */ }
                                }
                                if (cryptoFee) {
                                  return <span className="text-[10px] text-red-400/70">{cryptoFee}</span>;
                                }
                                return <span className="text-[10px] text-zinc-500">fee: {fc(txn.fee)}</span>;
                              }
                              return null;
                            })()}
                            {txn.merchant && (
                              <span className="text-[10px] text-zinc-500">{txn.merchant}</span>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          {(() => {
                            let cryptoInfo: { symbol: string; qty: number } | null = null;
                            if (txn.metadata) {
                              try {
                                const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
                                if ((m.coinId || m.coin_id) && m.qty) {
                                  cryptoInfo = { symbol: (m.symbol || '').toUpperCase(), qty: Number(m.qty) };
                                }
                              } catch { /* ignore */ }
                            }
                            if (cryptoInfo) {
                              const sign = txn.amount < 0 ? '−' : '+';
                              const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
                              const fiatVal = (Number(m.qty) || 0) * (Number(m.price) || 0);
                              return (
                                <>
                                  <p className={`text-[13px] font-semibold tabular-nums ${tc.text}`}>
                                    {sign}{cryptoInfo.qty.toFixed(8).replace(/\.?0+$/, '')} <span className="text-[#8B5CF6]">{cryptoInfo.symbol}</span>
                                  </p>
                                  {fiatVal > 0 && (
                                    <p className="text-[10px] text-zinc-500 tabular-nums">
                                      ≈ {fc(fiatVal)}
                                    </p>
                                  )}
                                </>
                              );
                            }
                            return (
                              <p className={`text-[13px] font-semibold tabular-nums ${tc.text}`}>
                                {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                                {showNumbers ? fc(Math.abs(txn.amount)) : maskNumber(fc(Math.abs(txn.amount)), maskMode, maskFixedValue)}
                              </p>
                            );
                          })()}
                        </div>

                        {/* Delete */}
                        <AnimatePresence mode="popLayout">
                          {confirmingDeleteId === txn.id ? (
                            <motion.div
                              key="confirm"
                              initial={{ opacity: 0, x: 4 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 4 }}
                              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                              className="flex items-center gap-1.5 shrink-0"
                            >
                              {deletePasswordTarget === txn.id ? (
                                <div className="flex items-center gap-1.5">
                                  {txn.type === 'transfer' && txn.transfer_id && (
                                    <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-300 whitespace-nowrap">
                                      This will delete both sides of the transfer
                                    </div>
                                  )}
                                  <div className="relative">
                                    <input
                                      type="password"
                                      value={deletePassword}
                                      onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(''); }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && deletePassword) handlePasswordDelete(txn.id);
                                        if (e.key === 'Escape') { setDeletePasswordTarget(null); setDeletePassword(''); setDeletePasswordError(''); }
                                      }}
                                      placeholder="Password"
                                      autoFocus
                                      className="w-24 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1 text-[10px] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                    />
                                    {deletePasswordError && (
                                      <p className="absolute top-full left-0 text-[9px] text-red-400 mt-0.5 whitespace-nowrap">{deletePasswordError}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePasswordDelete(txn.id); }}
                                    disabled={deleting || !deletePassword}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40 focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                                  >
                                    {deleting ? '...' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => { setDeletePasswordTarget(null); setDeletePassword(''); setDeletePasswordError(''); }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {txn.type === 'transfer' && txn.transfer_id && (
                                    <span className="text-[9px] text-amber-400 whitespace-nowrap">Both sides will be deleted</span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onVerifyPassword) {
                                        setDeletePasswordTarget(txn.id);
                                        setDeletePassword('');
                                        setDeletePasswordError('');
                                      } else {
                                        handleDelete(txn.id);
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                                  >
                                    <LockIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          ) : (
                            <div
                              key="trash"
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(txn.id); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfirmingDeleteId(txn.id); } }}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer focus-visible:ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-zinc-950"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    </GlassSurface>
                  );
                })}
              </div>
            </div>
          );
          })}

          {/* ── Historical Data section (bottom) ── */}
          {historicalTxns.length > 0 && (
            <div ref={historicalRef}>
              <div className="flex items-center gap-3 pt-2 pb-1 px-1">
                <div className="h-px flex-1 bg-violet-500/30" />
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Historical Data</span>
                <span className="text-[10px] text-violet-400/60 tabular-nums">{historicalTxns.length}</span>
                <button onClick={() => setShowReorder(v => !v)}
                  className="text-[9px] px-2 py-0.5 rounded-full transition-colors shrink-0"
                  style={{ background: showReorder ? 'rgba(139,92,246,0.2)' : 'transparent', color: showReorder ? '#8B5CF6' : '#71717a' }}>
                  {showReorder ? 'Done' : 'Reorder'}
                </button>
                <div className="h-px flex-1 bg-violet-500/30" />
              </div>
              {showReorder ? (
                <HistoricalReorderPanel transactions={historicalTxns} displayCurrency={displayCurrency} baseCurrency={baseCurrency}
                  onOrderChanged={() => { setShowReorder(false); onRetry?.(); }} />
              ) : (
                <div className="flex flex-col gap-3">
                {historicalTxns.map(txn => {
                  const cat = getCategory(txn.category_id);
                  const acct = getAccount(txn.account_id);
                  const wallet = getWallet(txn.wallet_id);
                  const tc = typeColors[txn.type] || typeColors.expense;
                  const { onPointerDown, onPointerEnter } = drag.getRowHandlers(txn.id);
                  return (
                    <GlassSurface
                      key={txn.id}
                      interactive
                      onPointerDown={onPointerDown}
                      onPointerEnter={onPointerEnter}
                      onClick={(e: React.MouseEvent) => {
                        if (drag.wasDragging()) return;
                        const target = e.target as HTMLElement;
                        const closest = target.closest('button, input, a, select, textarea');
                        if (closest) return;
                        setDetailTxn(txn);
                      }}
                      className="!p-3.5 border-l-2 border-l-violet-400 bg-violet-500/[0.03] mx-0.5 transition-all duration-150 group relative"
                    >
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10">
                        <TransactionCheckbox
                          checked={api.isSelected(txn.id)}
                          onToggle={() => api.toggleOne(txn.id)}
                          ariaLabel={`Select transaction ${txn.description}`}
                        />
                      </div>
                      <div className="flex items-start gap-6 pl-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] text-zinc-300 truncate">{txn.description || 'Untitled'}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-500/15 text-violet-400">historical</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {cat && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>{cat.name}</span>
                            )}
                            <span className="text-[10px] text-zinc-600">{acct?.name}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {(() => {
                            let cryptoInfo: { symbol: string; qty: number } | null = null;
                            if (txn.metadata) {
                              try {
                                const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
                                if ((m.coinId || m.coin_id) && m.qty) {
                                  cryptoInfo = { symbol: (m.symbol || '').toUpperCase(), qty: Number(m.qty) };
                                }
                              } catch { /* ignore */ }
                            }
                            if (cryptoInfo) {
                              const sign = txn.amount < 0 ? '−' : '+';
                              const m = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
                              const fiatVal = (Number(m.qty) || 0) * (Number(m.price) || 0);
                              return (
                                <>
                                  <p className={`text-[13px] font-semibold tabular-nums ${tc.text}`}>
                                    {sign}{cryptoInfo.qty.toFixed(8).replace(/\.?0+$/, '')} <span className="text-[#8B5CF6]">{cryptoInfo.symbol}</span>
                                  </p>
                                  {fiatVal > 0 && (
                                    <p className="text-[10px] text-zinc-500 tabular-nums">
                                      ≈ {fc(fiatVal)}
                                    </p>
                                  )}
                                </>
                              );
                            }
                            return (
                              <p className={`text-[13px] font-semibold tabular-nums ${tc.text}`}>
                                {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                                {showNumbers ? fc(Math.abs(txn.amount)) : maskNumber(fc(Math.abs(txn.amount)), maskMode, maskFixedValue)}
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    </GlassSurface>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </div>
      )}

      <SelectionAggregatePanel
        open={panelOpen}
        data={aggregate}
        currency={displayCurrency}
        busy={batchBusy}
        onClear={api.clear}
        onDelete={requestBatchDelete}
        onRecategorize={() => setRecatOpen(true)}
        onExport={handleExport}
        onSetFollowThrough={applyFollowThrough}
        onMarkRepaid={applyMarkRepaid}
        hasUnrepaidFT={hasUnrepaidFT}
      />

      <BatchRecategorizeModal
        open={recatOpen}
        count={derived.count}
        categories={categories}
        busy={batchBusy}
        onCancel={() => setRecatOpen(false)}
        onConfirm={applyRecategorize}
      />

      <TransactionDetailModal
        transaction={detailTxn}
        accounts={accounts}
        categories={categories}
        wallets={wallets}
        allTransactions={transactions}
        displayCurrency={displayCurrency}
        baseCurrency={baseCurrency}
        onClose={() => setDetailTxn(null)}
        onDelete={onDeleteTransaction}
        onUpdate={onUpdateTransaction}
        onVerifyPassword={onVerifyPassword}
        ftPersons={ftPersons}
        onAddFtPerson={onAddFtPerson}
      />

      {/* Floating Jump to Historical button — portal avoids framer-motion transform containing block */}
      {showJumpBtn && historicalTxns.length > 0 && createPortal(
        <button
          onClick={jumpToHistorical}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/90 text-white text-xs font-medium shadow-lg shadow-violet-500/20 hover:bg-violet-400 transition-colors backdrop-blur-sm"
        >
          <Clock className="w-3.5 h-3.5" />
          Jump to Historical ({historicalTxns.length})
        </button>,
        document.body
      )}
    </div>
  );
}

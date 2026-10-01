import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt, Plus, CheckCircle, Clock, AlertTriangle, SkipForward,
  ChevronLeft, ChevronRight, Trash2, Edit3, Zap, Target, Wallet,
  ArrowDownRight, ArrowUpRight, TrendingUp, Calendar, RefreshCw
} from 'lucide-react';
import { GlassSurface } from './_fx/GlassSurface';
import { pageContainer, riseItem } from './_fx/financeMotion';
import { formatCurrency } from './currency-data';
import { useNumberMask } from '../../context/NumberMaskContext';
import { maskNumber } from '../../utils/maskNumber';

interface FixedExpense {
  id: number; name: string; amount: number; frequency: string;
  category_id?: number; wallet_id?: number; next_due_date?: string;
  is_active: number; type: 'expense' | 'income';
  metadata?: string;
}

interface Budget {
  id: number; name: string; amount: number; spent: number;
  category_id?: number; period: string; type: string;
}

interface Props {
  expenses: FixedExpense[];
  budgets: Budget[];
  wallets: any[];
  categories: any[];
  onRefresh: () => void;
  onNotify?: (msg: string, type?: string) => void;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 2, 1).toISOString().slice(0, 7);
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 1).toISOString().slice(0, 7);
}

export function BudgetFixedExpensesTab({ expenses, budgets, wallets, categories, onRefresh, onNotify }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [editingItem, setEditingItem] = useState<any>(null);
  const { showNumbers } = useNumberMask();
  const api = (window as any).deskflowAPI;

  const fmt = (v: number) => showNumbers ? formatCurrency(v) : maskNumber(v);

  // Separate income and expenses
  const fixedIncome = useMemo(() => expenses.filter(e => e.type === 'income' && e.is_active), [expenses]);
  const fixedExpenses = useMemo(() => expenses.filter(e => e.type === 'expense' && e.is_active), [expenses]);

  const totalIncome = useMemo(() => fixedIncome.reduce((s, e) => s + e.amount, 0), [fixedIncome]);
  const totalExpenses = useMemo(() => fixedExpenses.reduce((s, e) => s + e.amount, 0), [fixedExpenses]);
  const netFlow = totalIncome - totalExpenses;

  // Budget status
  const totalBudget = useMemo(() => budgets.reduce((s, b) => s + (b.amount || 0), 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((s, b) => s + (b.spent || 0), 0), [budgets]);
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const handleAdd = async (data: any) => {
    try {
      if (editingItem?.id) {
        await api?.fixedExpensesUpdate?.({ ...data, id: editingItem.id });
        onNotify?.('Updated', 'success');
      } else {
        await api?.fixedExpensesCreate?.(data);
        onNotify?.('Created', 'success');
      }
      setShowAddModal(false);
      setEditingItem(null);
      onRefresh();
    } catch { onNotify?.('Failed', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    await api?.fixedExpensesDelete?.(id);
    onRefresh();
  };

  const handleToggle = async (id: number, active: boolean) => {
    await api?.fixedExpensesUpdate?.({ id, is_active: active ? 1 : 0 });
    onRefresh();
  };

  return (
    <motion.div variants={pageContainer} initial="hidden" animate="show" className="space-y-5 p-5">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-white">Budget & Fixed Expenses</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedMonth(prevMonth(selectedMonth))} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs font-medium text-zinc-300 min-w-[100px] text-center">{formatMonth(selectedMonth)}</span>
          <button onClick={() => setSelectedMonth(nextMonth(selectedMonth))} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassSurface className="p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-zinc-500 uppercase">Fixed Income</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">{fmt(totalIncome)}</p>
          <p className="text-[10px] text-zinc-600">{fixedIncome.length} sources</p>
        </GlassSurface>
        <GlassSurface className="p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight className="w-4 h-4 text-red-400" />
            <span className="text-[10px] text-zinc-500 uppercase">Fixed Expenses</span>
          </div>
          <p className="text-lg font-bold text-red-400">{fmt(totalExpenses)}</p>
          <p className="text-[10px] text-zinc-600">{fixedExpenses.length} bills</p>
        </GlassSurface>
        <GlassSurface className="p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] text-zinc-500 uppercase">Net Flow</span>
          </div>
          <p className={`text-lg font-bold ${netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netFlow >= 0 ? '+' : ''}{fmt(netFlow)}
          </p>
          <p className="text-[10px] text-zinc-600">{netFlow >= 0 ? 'Surplus' : 'Deficit'}</p>
        </GlassSurface>
        <GlassSurface className="p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] text-zinc-500 uppercase">Budget</span>
          </div>
          <p className="text-lg font-bold text-amber-400">{budgets.length > 0 ? `${budgetPct.toFixed(0)}%` : '—'}</p>
          <p className="text-[10px] text-zinc-600">{fmt(totalSpent)} of {fmt(totalBudget)}</p>
        </GlassSurface>
      </div>

      {/* Fixed Income Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Fixed Income
          </h3>
          <button onClick={() => { setAddType('income'); setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
            <Plus className="w-3 h-3" /> Add Income
          </button>
        </div>
        {fixedIncome.length === 0 ? (
          <GlassSurface className="p-6 rounded-xl text-center">
            <Wallet className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No fixed income sources yet</p>
            <p className="text-[10px] text-zinc-600">Add salary, freelance, or recurring income</p>
          </GlassSurface>
        ) : (
          <div className="space-y-2">
            {fixedIncome.map(item => (
              <GlassSurface key={item.id} className="p-3 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{item.name}</p>
                    <p className="text-[10px] text-zinc-500">{item.frequency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-400">{fmt(item.amount)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingItem(item); setAddType('income'); setShowAddModal(true); }} className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300"><Edit3 className="w-3 h-3" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </GlassSurface>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Expenses Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> Fixed Expenses
          </h3>
          <button onClick={() => { setAddType('expense'); setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
            <Plus className="w-3 h-3" /> Add Expense
          </button>
        </div>
        {fixedExpenses.length === 0 ? (
          <GlassSurface className="p-6 rounded-xl text-center">
            <Receipt className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No fixed expenses yet</p>
            <p className="text-[10px] text-zinc-600">Add rent, subscriptions, or recurring bills</p>
          </GlassSurface>
        ) : (
          <div className="space-y-2">
            {fixedExpenses.map(item => (
              <GlassSurface key={item.id} className="p-3 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-200">{item.name}</p>
                    <p className="text-[10px] text-zinc-500">{item.frequency} • {item.next_due_date || 'No date'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-400">{fmt(item.amount)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingItem(item); setAddType('expense'); setShowAddModal(true); }} className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300"><Edit3 className="w-3 h-3" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </GlassSurface>
            ))}
          </div>
        )}
      </div>

      {/* Budget Section */}
      {budgets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Target className="w-3.5 h-3.5 text-amber-400" /> Budgets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {budgets.map(b => {
              const pct = b.amount > 0 ? ((b.spent || 0) / b.amount) * 100 : 0;
              const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'ok';
              return (
                <GlassSurface key={b.id} className="p-4 rounded-xl relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: status === 'over' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981' }} />
                  <div className="pl-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-zinc-200">{b.name}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${status === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : status === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-sm font-bold text-zinc-100">{fmt(b.spent || 0)}</span>
                      <span className="text-[10px] text-zinc-500">of {fmt(b.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: status === 'over' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981' }} />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">{pct.toFixed(0)}% used</p>
                  </div>
                </GlassSurface>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AddItemModal type={addType} item={editingItem} onClose={() => { setShowAddModal(false); setEditingItem(null); }} onSave={handleAdd} />
      )}
    </motion.div>
  );
}

function AddItemModal({ type, item, onClose, onSave }: { type: 'expense' | 'income'; item: any; onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [frequency, setFrequency] = useState(item?.frequency || 'monthly');
  const [nextDue, setNextDue] = useState(item?.next_due_date || new Date().toISOString().slice(0, 10));

  const isIncome = type === 'income';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-4">{item ? 'Edit' : 'Add'} {isIncome ? 'Income' : 'Expense'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Salary, Netflix"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-xs text-white outline-none focus:border-zinc-500" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-xs text-white outline-none focus:border-zinc-500" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)}
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-xs text-white outline-none">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          {!isIncome && (
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Next Due Date</label>
              <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3 py-2 text-xs text-white outline-none" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs py-2.5 hover:bg-zinc-700">Cancel</button>
          <button onClick={() => onSave({ name, amount: parseFloat(amount) || 0, frequency, type, next_due_date: nextDue, is_active: 1 })} disabled={!name || !amount}
            className={`flex-1 rounded-lg text-xs py-2.5 font-medium text-white disabled:opacity-40 ${isIncome ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'}`}>
            {item ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

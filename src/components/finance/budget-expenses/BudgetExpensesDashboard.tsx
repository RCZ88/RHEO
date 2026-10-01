import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar } from 'react-chartjs-2';
import {
  Plus, Target, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Wallet, Calendar, Edit3, Trash2, DollarSign, PiggyBank,
  Droplets, CreditCard, Banknote, Receipt, AlertTriangle,
  CheckCircle2, Clock, Loader2
} from 'lucide-react';
import { computeCashFlow, computeBudgetStatuses, getUpcomingPayments, type FixedItem, type Budget, type BudgetStatus, type CashFlowSummary, type UpcomingPayment, type LiquidityBreakdown } from './budgetExpensesProcessor';
import { formatCurrency } from '../currency-data';
import { useNumberMask } from '../../../context/NumberMaskContext';
import { maskNumber } from '../../../utils/maskNumber';
import { MagicCard } from '../../ui/magic-card';
import { Progress } from '../../ui/progress';
import { Skeleton } from '../../ui/skeleton';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { NumberTicker } from '../../ui/number-ticker';

interface Props { displayCurrency: string; }

const ACCENT_COLORS = {
  emerald: { bg: 'rgba(16,185,129,0.10)', icon: '#34d399', text: '#34d399', border: 'rgba(16,185,129,0.20)' },
  red: { bg: 'rgba(239,68,68,0.10)', icon: '#f87171', text: '#f87171', border: 'rgba(239,68,68,0.20)' },
  blue: { bg: 'rgba(59,130,246,0.10)', icon: '#60a5fa', text: '#60a5fa', border: 'rgba(59,130,246,0.20)' },
  amber: { bg: 'rgba(245,158,11,0.10)', icon: '#fbbf24', text: '#fbbf24', border: 'rgba(245,158,11,0.20)' },
} as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 18 } }
};

function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date(new Date().toISOString().slice(0, 10));
  return d < today;
}

export default function BudgetExpensesDashboard({ displayCurrency }: Props) {
  const [fixedItems, setFixedItems] = useState<FixedItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetSpent, setBudgetSpent] = useState<Map<number, number>>(new Map());
  const [liquidity, setLiquidity] = useState<LiquidityBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemType, setAddItemType] = useState<'income' | 'expense'>('expense');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const api = (window as any).deskflowAPI;
  const { showNumbers, maskMode, maskFixedValue } = useNumberMask();
  const fmt = (v: number) => showNumbers ? formatCurrency(v, displayCurrency) : maskNumber(formatCurrency(v, displayCurrency), maskMode, maskFixedValue);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [fixed, buds, budStatus, liq] = await Promise.all([
        api?.fixedExpensesList?.() || [],
        api?.budgetsList?.() || [],
        api?.budgetsGetStatus?.() || null,
        api?.financeGetLiquidityBreakdown?.() || null,
      ]);
      setFixedItems(Array.isArray(fixed) ? fixed : []);
      setBudgets(Array.isArray(buds) ? buds : []);
      if (budStatus?.budgets) {
        const map = new Map<number, number>();
        budStatus.budgets.forEach((b: any) => map.set(b.id, b.spent || 0));
        setBudgetSpent(map);
      }
      if (liq?.success) setLiquidity(liq.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const cashFlow = useMemo(() => computeCashFlow(fixedItems), [fixedItems]);
  const budgetStatuses = useMemo(() => computeBudgetStatuses(budgets, budgetSpent), [budgets, budgetSpent]);
  const upcoming = useMemo(() => getUpcomingPayments(fixedItems, 5), [fixedItems]);

  const fixedIncome = useMemo(() => fixedItems.filter(e => e.type === 'income' && e.is_active), [fixedItems]);
  const fixedExpenses = useMemo(() => fixedItems.filter(e => e.type === 'expense' && e.is_active), [fixedItems]);

  const handleAddItem = async (data: any) => {
    try {
      if (editingItem?.id) { await api?.fixedExpensesUpdate?.({ ...data, id: editingItem.id }); }
      else { await api?.fixedExpensesCreate?.(data); }
      setShowAddItem(false); setEditingItem(null); refresh();
    } catch { /* ignore */ }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    await api?.fixedExpensesDelete?.(id); refresh();
  };

  const handleAddBudget = async (data: any) => {
    try {
      if (editingBudget?.id) { await api?.budgetsUpdate?.({ ...data, id: editingBudget.id }); }
      else { await api?.budgetsCreate?.(data); }
      setShowAddBudget(false); setEditingBudget(null); refresh();
    } catch { /* ignore */ }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('Delete this budget?')) return;
    await api?.budgetsDelete?.(id); refresh();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1,2,3].map(i => (
            <Skeleton key={i} className="h-28 rounded-xl bg-zinc-800/60" />
          ))}
        </div>
        <Skeleton className="h-44 rounded-xl bg-zinc-800/60" />
        <Skeleton className="h-52 rounded-xl bg-zinc-800/60" />
      </div>
    );
  }

  return (
    <div className="min-h-0">
      <motion.div className="space-y-4 p-1" variants={containerVariants} initial="hidden" animate="visible">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { key: 'income', label: 'Fixed Income', value: cashFlow.monthlyIncome, sub: `${fixedIncome.length} sources`, accent: 'emerald' as const, icon: ArrowUpRight },
            { key: 'expenses', label: 'Fixed Expenses', value: cashFlow.monthlyExpenses, sub: `${fixedExpenses.length} bills`, accent: 'red' as const, icon: ArrowDownRight },
            { key: 'net', label: 'Net Cash Flow', value: cashFlow.netCashFlow, sub: `${cashFlow.savingsRate.toFixed(1)}% savings rate`, accent: (cashFlow.isSurplus ? 'blue' : 'red') as 'blue' | 'red', icon: cashFlow.isSurplus ? TrendingUp : TrendingDown },
          ].map(kpi => {
            const accent = ACCENT_COLORS[kpi.accent];
            return (
              <motion.div key={kpi.key} variants={itemVariants}>
                <MagicCard className="rounded-xl p-5">
                  <div className="relative z-40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent.bg }}>
                        <kpi.icon className="w-3.5 h-3.5" style={{ color: accent.icon }} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight" style={{ color: accent.text }}>
                      {showNumbers
                        ? <><NumberTicker value={Math.abs(kpi.value)} decimals={2} />{displayCurrency}</>
                        : <span>{maskNumber(formatCurrency(Math.abs(kpi.value), displayCurrency), maskMode, maskFixedValue)}</span>}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-1">{kpi.sub}</p>
                  </div>
                </MagicCard>
              </motion.div>
            );
          })}
        </div>

        <motion.div variants={itemVariants}>
          <MagicCard className="rounded-xl p-5">
            <div className="relative z-40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT_COLORS.emerald.bg }}>
                    <ArrowUpRight className="w-4 h-4" style={{ color: ACCENT_COLORS.emerald.icon }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Fixed Income</h3>
                    <p className="text-[9px] text-zinc-600">{fixedIncome.length} active sources</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="h-7 text-[10px] border"
                  style={{ backgroundColor: ACCENT_COLORS.emerald.bg, color: ACCENT_COLORS.emerald.text, borderColor: ACCENT_COLORS.emerald.border }}
                  onClick={() => { setAddItemType('income'); setEditingItem(null); setShowAddItem(true); }}>
                  <Plus className="w-3 h-3 mr-1" /> Add Income
                </Button>
              </div>
              <AnimatePresence mode="wait">
                {fixedIncome.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-zinc-600">
                    <PiggyBank className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-[11px]">No fixed income sources yet</p>
                    <p className="text-[9px] mt-1">Add your salary, freelance income, or other recurring earnings</p>
                  </motion.div>
                ) : (
                  <motion.div className="space-y-1.5" initial="hidden" animate="visible">
                    {fixedIncome.map((item, idx) => (
                      <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-zinc-800/40 border border-zinc-800/50 group hover:bg-zinc-800/60 hover:border-zinc-700/50 transition-all"
                        onMouseEnter={() => setHoveredCard(`income-${item.id}`)} onMouseLeave={() => setHoveredCard(null)}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT_COLORS.emerald.bg }}>
                            <DollarSign className="w-4 h-4" style={{ color: ACCENT_COLORS.emerald.icon }} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-zinc-200">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-zinc-800/60 text-zinc-400 border-zinc-700/40">{item.frequency}</Badge>
                              {item.next_due_date && <span className="text-[9px] text-zinc-600">Due {item.next_due_date}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT_COLORS.emerald.text }}>{fmt(item.amount)}</span>
                          <div className={`flex items-center gap-1 transition-all duration-200 ${hoveredCard === `income-${item.id}` ? 'opacity-100' : 'opacity-0'}`}>
                            <button onClick={() => { setEditingItem(item); setAddItemType('income'); setShowAddItem(true); }}
                              className="p-1.5 rounded-md hover:bg-zinc-700/60 text-zinc-600 hover:text-zinc-200 transition-colors">
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </MagicCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <MagicCard className="rounded-xl p-5">
            <div className="relative z-40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT_COLORS.red.bg }}>
                    <ArrowDownRight className="w-4 h-4" style={{ color: ACCENT_COLORS.red.icon }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Fixed Expenses</h3>
                    <p className="text-[9px] text-zinc-600">{fixedExpenses.length} active bills</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="h-7 text-[10px] border"
                  style={{ backgroundColor: ACCENT_COLORS.red.bg, color: ACCENT_COLORS.red.text, borderColor: ACCENT_COLORS.red.border }}
                  onClick={() => { setAddItemType('expense'); setEditingItem(null); setShowAddItem(true); }}>
                  <Plus className="w-3 h-3 mr-1" /> Add Expense
                </Button>
              </div>
              <AnimatePresence mode="wait">
                {fixedExpenses.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-zinc-600">
                    <Receipt className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-[11px]">No fixed expenses yet</p>
                    <p className="text-[9px] mt-1">Add rent, subscriptions, insurance, or other recurring bills</p>
                  </motion.div>
                ) : (
                  <motion.div className="space-y-1.5" initial="hidden" animate="visible">
                    {fixedExpenses.map((item, idx) => (
                      <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-zinc-800/40 border border-zinc-800/50 group hover:bg-zinc-800/60 hover:border-zinc-700/50 transition-all"
                        onMouseEnter={() => setHoveredCard(`expense-${item.id}`)} onMouseLeave={() => setHoveredCard(null)}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT_COLORS.red.bg }}>
                            <Receipt className="w-4 h-4" style={{ color: ACCENT_COLORS.red.icon }} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-zinc-200">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-zinc-800/60 text-zinc-400 border-zinc-700/40">{item.frequency}</Badge>
                              {item.next_due_date && (
                                <span className={`text-[9px] flex items-center gap-0.5 ${isOverdue(item.next_due_date) ? 'text-red-500' : 'text-zinc-600'}`}>
                                  <Clock className="w-2.5 h-2.5" /> {item.next_due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tabular-nums" style={{ color: ACCENT_COLORS.red.text }}>{fmt(item.amount)}</span>
                          <div className={`flex items-center gap-1 transition-all duration-200 ${hoveredCard === `expense-${item.id}` ? 'opacity-100' : 'opacity-0'}`}>
                            <button onClick={() => { setEditingItem(item); setAddItemType('expense'); setShowAddItem(true); }}
                              className="p-1.5 rounded-md hover:bg-zinc-700/60 text-zinc-600 hover:text-zinc-200 transition-colors">
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </MagicCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <MagicCard className="rounded-xl p-5">
            <div className="relative z-40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT_COLORS.amber.bg }}>
                    <Target className="w-4 h-4" style={{ color: ACCENT_COLORS.amber.icon }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Budgets</h3>
                    <p className="text-[9px] text-zinc-600">{budgetStatuses.length} active</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="h-7 text-[10px] border"
                  style={{ backgroundColor: ACCENT_COLORS.amber.bg, color: ACCENT_COLORS.amber.text, borderColor: ACCENT_COLORS.amber.border }}
                  onClick={() => { setEditingBudget(null); setShowAddBudget(true); }}>
                  <Plus className="w-3 h-3 mr-1" /> Add Budget
                </Button>
              </div>
              <AnimatePresence mode="wait">
                {budgetStatuses.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-zinc-600">
                    <Target className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-[11px]">No budgets set</p>
                    <p className="text-[9px] mt-1">Create spending budgets to track your financial goals</p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {budgetStatuses.map(b => (
                      <motion.div key={b.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl border border-zinc-800 p-4 relative overflow-hidden group hover:border-zinc-700/60 transition-all bg-zinc-900/60"
                        onMouseEnter={() => setHoveredCard(`budget-${b.id}`)} onMouseLeave={() => setHoveredCard(null)}>
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{
                          backgroundColor: b.status === 'over' ? '#ef4444' : b.status === 'danger' ? '#f97316' : b.status === 'warning' ? '#eab308' : '#10b981'
                        }} />
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-200 truncate">{b.name}</p>
                            <p className="text-[9px] text-zinc-600 mt-0.5 capitalize">{b.type || 'total'} budget</p>
                          </div>
                          <Badge className="text-[9px] px-2 py-0.5 ml-2 flex-shrink-0 border" style={{
                            backgroundColor: b.status === 'over' ? 'rgba(239,68,68,0.15)' : b.status === 'danger' ? 'rgba(249,115,22,0.15)' : b.status === 'warning' ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)',
                            color: b.status === 'over' ? '#ef4444' : b.status === 'danger' ? '#f97316' : b.status === 'warning' ? '#eab308' : '#10b981',
                            borderColor: b.status === 'over' ? 'rgba(239,68,68,0.2)' : b.status === 'danger' ? 'rgba(249,115,22,0.2)' : b.status === 'warning' ? 'rgba(234,179,8,0.2)' : 'rgba(16,185,129,0.2)',
                          }}>
                            {b.utilization.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="flex items-baseline justify-between mb-2.5">
                          <span className="text-lg font-bold text-zinc-100 tabular-nums">{fmt(b.spent || 0)}</span>
                          <span className="text-[10px] text-zinc-500">of {fmt(b.amount)}</span>
                        </div>
                        <Progress value={b.utilization} className="h-2 rounded-full bg-zinc-800" />
                        <div className="flex items-center justify-end gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingBudget(b); setShowAddBudget(true); }}
                            className="p-1.5 rounded-md hover:bg-zinc-700/60 text-zinc-600 hover:text-zinc-200 transition-colors">
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDeleteBudget(b.id)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </MagicCard>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div variants={itemVariants}>
            <MagicCard className="rounded-xl p-5">
                <div className="relative z-40">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/15 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Upcoming Due Dates</h3>
                    <p className="text-[9px] text-zinc-600">{upcoming.length} pending</p>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {upcoming.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-zinc-600">
                      <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500/40" />
                      <p className="text-[11px]">All caught up</p>
                      <p className="text-[9px] mt-1">No upcoming or overdue payments</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {upcoming.map(p => (
                        <div key={p.id} className={`flex items-center justify-between py-2.5 px-3 rounded-lg border transition-all ${
                          p.isOverdue ? 'bg-red-500/5 border-red-500/15' :
                          p.isImminent ? 'bg-amber-500/5 border-amber-500/15' :
                          'bg-zinc-800/40 border-zinc-800/50'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                              {p.type === 'income'
                                ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                                : <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                              }
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-zinc-200">{p.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {p.isOverdue ? (
                                  <Badge className="text-[8px] px-1.5 h-4 bg-red-500/15 text-red-400 border-red-500/20">Overdue</Badge>
                                ) : p.isImminent ? (
                                  <Badge className="text-[8px] px-1.5 h-4 bg-amber-500/15 text-amber-400 border-amber-500/20">Due in {p.daysUntilDue}d</Badge>
                                ) : (
                                  <span className="text-[9px] text-zinc-600">Due in {p.daysUntilDue} days</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[12px] font-bold tabular-nums ${p.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </MagicCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <MagicCard className="rounded-xl p-5">
                <div className="relative z-40">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Droplets className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Liquidity Waterfall</h3>
                      <p className="text-[9px] text-zinc-600">How quickly you can access your money</p>
                    </div>
                  </div>
                  {liquidity && (
                    <Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {liquidity.liquidityScore.toFixed(1)}% liquid
                    </Badge>
                  )}
                </div>
                {liquidity && liquidity.tiers ? (
                  <div className="h-[140px]">
                    <Bar data={{
                      labels: liquidity.tiers.map(t => t.name),
                      datasets: [{
                        data: liquidity.tiers.map(t => t.amount),
                        backgroundColor: liquidity.tiers.map(t => t.color),
                        borderRadius: 6, borderSkipped: false,
                        barThickness: 24
                      }]
                    }} options={{
                      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: 'rgba(24,24,27,0.95)',
                          titleColor: '#a1a1aa', bodyColor: '#fff',
                          borderColor: 'rgba(63,63,70,0.5)', borderWidth: 1, padding: 10,
                          callbacks: {
                            label: (ctx) => `  ${fmt(ctx.parsed.x as number)} (${liquidity.tiers[ctx.dataIndex]?.percentage.toFixed(1)}%)`
                          }
                        }
                      },
                      scales: {
                        x: {
                          grid: { color: 'rgba(113,113,122,0.08)' },
                          ticks: { color: '#52525b', font: { size: 10 }, callback: (v) => showNumbers ? formatCurrency(Number(v), displayCurrency, { compact: true }) : maskNumber(formatCurrency(Number(v), displayCurrency, { compact: true }), maskMode, maskFixedValue) }
                        },
                        y: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 11, weight: 'bold' as const } } }
                      }
                    }} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[140px] text-zinc-600">
                    <Droplets className="w-8 h-8 opacity-30" />
                  </div>
                )}
              </div>
            </MagicCard>
          </motion.div>
        </div>

        <AnimatePresence>
          {showAddItem && (
            <AddItemModal
              type={addItemType}
              item={editingItem}
              onClose={() => { setShowAddItem(false); setEditingItem(null); }}
              onSave={handleAddItem}
            />
          )}
          {showAddBudget && (
            <AddBudgetModal
              budget={editingBudget}
              onClose={() => { setShowAddBudget(false); setEditingBudget(null); }}
              onSave={handleAddBudget}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function AddItemModal({ type, item, onClose, onSave }: { type: 'expense' | 'income'; item: any; onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [frequency, setFrequency] = useState(item?.frequency || 'monthly');
  const [nextDue, setNextDue] = useState(item?.next_due_date || new Date().toISOString().slice(0, 10));
  const isIncome = type === 'income';
  const accent = isIncome ? ACCENT_COLORS.emerald : ACCENT_COLORS.red;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-xl bg-zinc-900/95 border border-zinc-800/80 shadow-2xl p-6 backdrop-blur-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent.bg }}>
            {isIncome ? <ArrowUpRight className="w-5 h-5" style={{ color: accent.icon }} /> : <ArrowDownRight className="w-5 h-5" style={{ color: accent.icon }} />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{item ? 'Edit' : 'Add'} {isIncome ? 'Income' : 'Expense'}</h3>
            <p className="text-[10px] text-zinc-600">{isIncome ? 'Recurring earning source' : 'Recurring bill or payment'}</p>
          </div>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={isIncome ? 'e.g. Salary, Freelance' : 'e.g. Rent, Netflix'}
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 focus:bg-zinc-800/80 transition-all placeholder:text-zinc-700" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 focus:bg-zinc-800/80 transition-all" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value)}
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 transition-all">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          {!isIncome && (
            <div>
              <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Next Due Date</label>
              <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 transition-all" />
            </div>
          )}
        </div>
        <div className="flex gap-2.5 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1 h-9 text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700/50">
            Cancel
          </Button>
          <Button onClick={() => onSave({ name, amount: parseFloat(amount) || 0, frequency, type, next_due_date: nextDue, is_active: 1 })}
            disabled={!name || !amount}
            className="flex-1 h-9 text-xs font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: accent.text }}
          >
            {item ? 'Update' : 'Add'} {isIncome ? 'Income' : 'Expense'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddBudgetModal({ budget, onClose, onSave }: { budget: any; onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState(budget?.name || '');
  const [amount, setAmount] = useState(budget?.amount?.toString() || '');
  const [type, setType] = useState(budget?.type || 'total');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-xl bg-zinc-900/95 border border-zinc-800/80 shadow-2xl p-6 backdrop-blur-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ACCENT_COLORS.amber.bg }}>
            <Target className="w-5 h-5" style={{ color: ACCENT_COLORS.amber.icon }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{budget ? 'Edit' : 'Add'} Budget</h3>
            <p className="text-[10px] text-zinc-600">Set a spending limit to track your finances</p>
          </div>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Budget"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 focus:bg-zinc-800/80 transition-all placeholder:text-zinc-700" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Amount</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 focus:bg-zinc-800/80 transition-all" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-1.5 block font-medium tracking-wider uppercase">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-lg bg-zinc-800/60 border border-zinc-700/50 px-3.5 py-2.5 text-xs text-white outline-none focus:border-zinc-500 transition-all">
              <option value="total">Total Budget</option>
              <option value="category">Category Budget</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2.5 mt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1 h-9 text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700/50">
            Cancel
          </Button>
          <Button onClick={() => onSave({ name, amount: parseFloat(amount) || 0, type, is_active: 1 })}
            disabled={!name || !amount}
            className="flex-1 h-9 text-xs font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: ACCENT_COLORS.amber.text }}
          >
            {budget ? 'Update' : 'Add'} Budget
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

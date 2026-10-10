import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, X, Check, Trash2, Edit3, Clock, Flame, TrendingUp,
  Play, Pause, Zap, ArrowRight, Calendar, BarChart3, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle, Sparkles, Link2, Timer
} from 'lucide-react';
import { NumberTicker } from '../components/ui/number-ticker';
import { AnimatedShinyText } from '../components/ui/animated-shiny-text';
import { BorderBeam } from '../components/ui/border-beam';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectItem } from '../components/ui/select';
import { useLocation } from 'react-router-dom';
import { FocusGroupSelect, useFocusGroups, describeMatchCategory } from '../components/goals/FocusGroupSelect';
import { LTGPicker } from '../components/goals/CriteriaBuilder';
import { confetti } from '../components/ui/confetti';
import type { Goal, GoalCategory, GoalPeriod, LongTermGoal, TargetType } from '../components/dashboard/types';

const CATEGORIES: { value: GoalCategory; label: string; color: string; icon: string }[] = [
  { value: 'work', label: 'Work', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', icon: '💼' },
  { value: 'personal', label: 'Personal', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: '🏠' },
  { value: 'health', label: 'Health', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: '💪' },
  { value: 'learning', label: 'Learning', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: '📚' },
  { value: 'finance', label: 'Finance', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '💰' },
  { value: 'relationships', label: 'Relationships', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: '❤️' },
];

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TARGET_TYPES = [
  { value: 'completion', label: 'Complete a task', icon: Check },
  { value: 'time', label: 'Spend time tracking', icon: Clock },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getUrgencyColor(deadline: string) {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'text-red-400';
  if (days <= 1) return 'text-orange-400';
  if (days <= 3) return 'text-amber-400';
  return 'text-zinc-400';
}

export default function FocusPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [goalProgress, setGoalProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<'goals' | 'stats' | 'history'>('goals');
  const focusLocation = useLocation();
  useEffect(() => {
    const tab = (focusLocation.state as any)?.tab;
    if (tab === 'goals' || tab === 'stats' || tab === 'history') setActiveTab(tab);
  }, []);

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'work' as GoalCategory,
    period: 'daily' as GoalPeriod,
    targetType: 'completion' as TargetType,
    targetHours: 0,
    targetMinutes: 30,
    matchCategory: '',
    parentIds: [] as string[],
  });

  const [editForm, setEditForm] = useState<Partial<Goal>>({});

  const api = (window as any).deskflowAPI;
  const focusGroups = useFocusGroups();
  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const [goalsRes, ltgRes, progressRes] = await Promise.all([
        api.getGoals?.(today).catch(() => ({ goals: [] })),
        api.getLongtermGoals?.().catch(() => ({ goals: [] })),
        api.getDailyGoalProgress?.(today, []).catch(() => ({})),
      ]);
      setGoals(goalsRes?.goals || []);
      setLongTermGoals(ltgRes?.goals || []);
      setGoalProgress(progressRes || {});
    } catch (err) {
      console.error('[FocusPage] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [api, today]);

  useEffect(() => { loadData(); }, [loadData]);

  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'done'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.status === 'done'), [goals]);

  const handleAdd = async () => {
    if (!newGoal.title.trim()) return;
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: newGoal.title.trim(),
      description: newGoal.description.trim() || undefined,
      category: newGoal.category,
      target: {
        type: newGoal.targetType,
        targetSeconds: newGoal.targetType === 'time' ? (newGoal.targetHours * 3600) + (newGoal.targetMinutes * 60) : undefined,
        matchCategory: newGoal.matchCategory || undefined,
      },
      period: newGoal.period,
      status: 'active',
      date: today,
      source: 'manual',
      links: [],
      parentIds: newGoal.parentIds,
      parentId: newGoal.parentIds[0] || undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      await api?.saveGoal?.(today, goal);
      setGoals(prev => [goal, ...prev]);
      setIsAdding(false);
      resetForm();
    } catch (err) {
      console.error('[FocusPage] Add goal error:', err);
    }
  };

  const handleToggle = async (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newStatus = goal.status === 'done' ? 'active' : 'done';
    const patch = {
      status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
      streak: newStatus === 'done' ? (goal.streak || 0) + 1 : goal.streak,
    };
    try {
      await api?.saveGoal?.(today, { ...goal, ...patch });
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
      if (newStatus === 'done') {
        confetti({ particleCount: 50, spread: 80, colors: ['#ec4899', '#a78bfa', '#34d399'] });
      }
    } catch (err) {
      console.error('[FocusPage] Toggle error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId === id) {
      try {
        await api?.deleteGoal?.(id);
        setGoals(prev => prev.filter(g => g.id !== id));
        setDeleteConfirmId(null);
      } catch (err) {
        console.error('[FocusPage] Delete error:', err);
      }
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Goal>) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    try {
      await api?.saveGoal?.(today, { ...goal, ...patch });
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      console.error('[FocusPage] Update error:', err);
    }
  };

  const resetForm = () => {
    setNewGoal({
      title: '', description: '', category: 'work', period: 'daily',
      targetType: 'completion', targetHours: 0, targetMinutes: 30,
      matchCategory: '', parentIds: [],
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <AnimatedShinyText className="text-[24px] font-bold" gradientFrom="#ec4899" gradientTo="#f472b6">
              Focus & Goals
            </AnimatedShinyText>
            <p className="text-[13px] text-zinc-500 font-sans mt-1">
              Set goals, track progress, build consistency
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadData}
              className="w-9 h-9 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors text-[13px] font-medium"
            >
              <Plus size={14} />
              New Goal
            </motion.button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] border border-zinc-800/50 mb-6 w-fit">
          {[
            { key: 'goals', label: 'Goals', icon: Target },
            { key: 'stats', label: 'Stats', icon: BarChart3 },
            { key: 'history', label: 'History', icon: Clock },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Add Goal Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="relative rounded-xl overflow-hidden bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/50 p-6">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />
                <h3 className="text-[15px] font-semibold text-zinc-100 mb-4 font-sans">Create New Goal</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Input
                      value={newGoal.title}
                      onChange={e => setNewGoal(p => ({ ...p, title: e.target.value }))}
                      placeholder="What do you want to achieve?"
                      className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-10 font-sans"
                    />
                    <Input
                      value={newGoal.description}
                      onChange={e => setNewGoal(p => ({ ...p, description: e.target.value }))}
                      placeholder="Add details (optional)"
                      className="bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-10 font-sans"
                    />
                    <div className="flex items-center gap-2">
                      <Select value={newGoal.category} onValueChange={v => setNewGoal(p => ({ ...p, category: v as GoalCategory }))} className="flex-1">
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </Select>
                      <Select value={newGoal.period} onValueChange={v => setNewGoal(p => ({ ...p, period: v as GoalPeriod }))} className="w-[100px]">
                        {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-zinc-500 font-sans mb-1 block">Goal Type</label>
                      <div className="flex gap-2">
                        {TARGET_TYPES.map(t => (
                          <button
                            key={t.value}
                            onClick={() => setNewGoal(p => ({ ...p, targetType: t.value as TargetType }))}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all flex-1 ${
                              newGoal.targetType === t.value
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/30'
                                : 'bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] text-zinc-400 border-zinc-800/50 hover:border-zinc-700/50'
                            }`}
                          >
                            <t.icon size={13} />
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newGoal.targetType === 'time' && (
                      <div>
                        <label className="text-[11px] text-zinc-500 font-sans mb-1 block">Target Duration</label>
                        <div className="flex items-center gap-2">
                          <Input type="number" min={0} max={23} value={newGoal.targetHours}
                            onChange={e => setNewGoal(p => ({ ...p, targetHours: parseInt(e.target.value) || 0 }))}
                            className="w-20 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 text-[13px] h-9 font-mono" />
                          <span className="text-[11px] text-zinc-500">hours</span>
                          <Input type="number" min={0} max={59} value={newGoal.targetMinutes}
                            onChange={e => setNewGoal(p => ({ ...p, targetMinutes: parseInt(e.target.value) || 0 }))}
                            className="w-20 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] border-zinc-700/50 text-[13px] h-9 font-mono" />
                          <span className="text-[11px] text-zinc-500">min</span>
                        </div>
                      </div>
                    )}

                    {newGoal.targetType === 'time' && (
                      <div>
                        <FocusGroupSelect
                          label="Track time spent in focus group"
                          value={newGoal.matchCategory}
                          onValueChange={v => setNewGoal(p => ({ ...p, matchCategory: v }))}
                          className="w-full"
                        />
                        <p className="text-[10px] text-zinc-600 mt-1 font-sans">
                          Progress counts completed focus sessions of the group
                        </p>
                      </div>
                    )}

                    {longTermGoals.length > 0 && (
                      <LTGPicker
                        longTermGoals={longTermGoals}
                        value={newGoal.parentIds}
                        onChange={ids => setNewGoal(p => ({ ...p, parentIds: ids }))}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800/50">
                  <Button onClick={handleAdd} className="bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-[12px] h-9">
                    <Plus size={12} className="mr-1" /> Create Goal
                  </Button>
                  <Button variant="ghost" onClick={() => { resetForm(); setIsAdding(false); }} className="text-zinc-400 hover:text-white text-[12px] h-9">
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="space-y-3" data-section="focus.goals">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : activeGoals.length === 0 ? (
              <div className="text-center py-16">
                <Target size={32} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-[14px] text-zinc-500 font-sans">No active goals</p>
                <p className="text-[12px] text-zinc-600 mt-1 font-sans">Create your first goal to start tracking progress</p>
              </div>
            ) : (
              activeGoals.map((goal, i) => {
                const progress = goalProgress[goal.id];
                const progressPct = progress?.percentComplete || 0;
                const progressSec = progress?.progressSeconds || 0;
                const targetSec = goal.target?.targetSeconds || 0;
                const isTimeBased = goal.target?.type === 'time';
                const parentIds = goal.parentIds?.length ? goal.parentIds : (goal.parentId ? [goal.parentId] : []);
                const parents = parentIds.map(pid => longTermGoals.find(ltg => ltg.id === pid)).filter(Boolean) as LongTermGoal[];
                const catMeta = CATEGORIES.find(c => c.value === goal.category);

                return (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative rounded-xl overflow-hidden bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/50 p-5 hover:border-zinc-700/50 transition-colors"
                  >
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/20 via-transparent to-transparent" />

                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleToggle(goal.id)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                          goal.status === 'done'
                            ? 'bg-violet-500 border-violet-500'
                            : 'border-zinc-600 hover:border-violet-400/50'
                        }`}
                      >
                        {goal.status === 'done' && <Check size={12} className="text-white" strokeWidth={3} />}
                      </motion.button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[15px] font-semibold text-zinc-100 font-sans">{goal.title}</span>
                          {catMeta && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-sans ${catMeta.color}`}>
                              {catMeta.label}
                            </span>
                          )}
                        </div>

                        {goal.description && (
                          <p className="text-[12px] text-zinc-500 font-sans mb-2">{goal.description}</p>
                        )}

                        {parents.length > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Link2 size={10} className="text-zinc-600" />
                            <span className="text-[11px] text-zinc-600 font-sans">Serves: {parents.map(p => p.title).join(', ')}</span>
                          </div>
                        )}

                        {/* Progress bar for time-based goals */}
                        {isTimeBased && targetSec > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-zinc-500 font-sans">
                                {formatTime(progressSec)} / {formatTime(targetSec)}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{progressPct}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, progressPct)}%` }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                              />
                            </div>
                            {goal.target?.matchCategory && (
                              <p className="text-[10px] text-zinc-600 mt-1 font-sans">
                                Tracking: {describeMatchCategory(focusGroups.groups, goal.target.matchCategory)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-zinc-600 font-sans flex items-center gap-1">
                            <RefreshCw size={8} /> {goal.period}
                          </span>
                          {goal.streak && goal.streak > 1 && (
                            <span className="text-[10px] text-pink-400 font-mono font-semibold tabular-nums flex items-center gap-0.5">
                              <Flame size={8} /> {goal.streak}d streak
                            </span>
                          )}
                          {goal.target?.matchCategory && (
                            <span className="text-[10px] text-sky-400 font-sans flex items-center gap-0.5">
                              <Link2 size={8} /> Auto-tracked
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => { setEditingId(goal.id); setEditForm({ ...goal }); }}
                          className="w-8 h-8 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50 flex items-center justify-center transition-colors"
                        >
                          <Edit3 size={13} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(goal.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            deleteConfirmId === goal.id
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-zinc-800/50 text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          {deleteConfirmId === goal.id ? <Check size={13} /> : <Trash2 size={13} />}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}

            {/* Completed Section */}
            {completedGoals.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors font-sans"
                >
                  {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {completedGoals.length} completed goals
                  <span className="font-mono text-emerald-400/70 tabular-nums">
                    {goals.length > 0 ? Math.round((completedGoals.length / goals.length) * 100) : 0}% completion
                  </span>
                </button>
                <AnimatePresence>
                  {showCompleted && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="space-y-2">
                        {completedGoals.map(goal => (
                          <div key={goal.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/20 light:bg-[var(--ws-surface-raised)] border border-zinc-800/30 opacity-60">
                            <Check size={14} className="text-emerald-500" />
                            <span className="text-[13px] text-zinc-500 line-through font-sans flex-1">{goal.title}</span>
                            <span className="text-[10px] text-zinc-600 font-sans">{goal.period}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-section="focus.stats">
            <div className="relative rounded-xl overflow-hidden bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/50 p-5">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <Target size={14} className="text-violet-400" />
                <span className="text-[12px] text-zinc-500 font-sans">Total Goals</span>
              </div>
              <span className="font-mono text-[28px] font-bold text-zinc-100 tabular-nums">
                <NumberTicker value={goals.length} delay={200} duration={600} />
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/50 p-5">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <Check size={14} className="text-emerald-400" />
                <span className="text-[12px] text-zinc-500 font-sans">Completed</span>
              </div>
              <span className="font-mono text-[28px] font-bold text-emerald-400 tabular-nums">
                <NumberTicker value={completedGoals.length} delay={300} duration={600} />
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-zinc-800/50 p-5">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-pink-500/30 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <Flame size={14} className="text-pink-400" />
                <span className="text-[12px] text-zinc-500 font-sans">Best Streak</span>
              </div>
              <span className="font-mono text-[28px] font-bold text-pink-400 tabular-nums">
                <NumberTicker value={Math.max(...goals.map(g => g.streak || 0), 0)} delay={400} duration={600} />
              </span>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="text-center py-16" data-section="focus.history">
            <Clock size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-[14px] text-zinc-500 font-sans">Goal history coming soon</p>
            <p className="text-[12px] text-zinc-600 mt-1 font-sans">Track your progress over weeks and months</p>
          </div>
        )}
      </div>
    </div>
  );
}

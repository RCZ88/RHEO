// ============================================================
// DeskFlow Dashboard — GoalsCard (Revamped v2)
// Skills: Human-Centric UX (empty/loading/error states, forgiveness),
//         Impeccable Design (8px grid, HSL opacity, 44px targets),
//         MCP (SpotlightCard from ReactBits, NumberTicker from Magic UI,
//              AnimatedShinyText, Confetti from Magic UI),
//         Signature Design (micro-detail layer: confetti on complete)
// ============================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Check, Plus, X, Edit3, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Zap,
  Sparkles, ArrowRight, Flame, AlertCircle,
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedShinyText } from '../ui/animated-shiny-text';
import { NumberTicker } from '../ui/number-ticker';
import { confetti } from '../ui/confetti';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectItem } from '../ui/select';
import { LTGPicker } from '../goals/CriteriaBuilder';
import type { Goal, GoalCategory, GoalPeriod, LongTermGoal, TargetType } from './types';

const CATEGORIES: { value: GoalCategory; label: string; color: string }[] = [
  { value: 'work', label: 'Work', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20 light:bg-pink-500/15 light:text-pink-700 light:border-pink-500/30' },
  { value: 'personal', label: 'Personal', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20 light:bg-violet-500/15 light:text-violet-700 light:border-violet-500/30' },
  { value: 'health', label: 'Health', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 light:bg-emerald-500/15 light:text-emerald-700 light:border-emerald-500/30' },
  { value: 'learning', label: 'Learning', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 light:bg-cyan-500/15 light:text-cyan-700 light:border-cyan-500/30' },
  { value: 'finance', label: 'Finance', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 light:bg-amber-500/15 light:text-amber-700 light:border-amber-500/30' },
  { value: 'relationships', label: 'Relationships', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20 light:bg-rose-500/15 light:text-rose-700 light:border-rose-500/30' },
  { value: 'reflection', label: 'Reflection', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 light:bg-indigo-500/15 light:text-indigo-700 light:border-indigo-500/30' },
];

const PERIODS: { value: GoalPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TARGET_TYPES: { value: TargetType; label: string }[] = [
  { value: 'completion', label: 'Complete it' },
  { value: 'time', label: 'Spend time' },
  { value: 'external', label: 'External activity' },
];

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2 } },
};

const formVariants = {
  hidden: { height: 0, opacity: 0 },
  show: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.25 } },
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getCategoryMeta(cat: GoalCategory) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
}

interface GoalsCardProps {
  goals: Goal[];
  longTermGoals: LongTermGoal[];
  suggestions: Goal[];
  insights: { streak: number; completionRate: number; momentum: number };
  loading?: boolean;
  error?: string | null;
  onToggle: (id: string) => void;
  onAdd: (goal: Omit<Goal, 'id' | 'date' | 'createdAt' | 'status' | 'source'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onStartFocus?: (goalId: string) => void;
  onAcceptSuggestion: (suggestion: Goal) => void;
  onDismissSuggestion: (id: string) => void;
  onGenerateSuggestions: () => void;
}

export function GoalsCard({
  goals,
  longTermGoals,
  suggestions,
  insights,
  loading = false,
  error = null,
  onToggle,
  onAdd,
  onDelete,
  onUpdate,
  onStartFocus,
  onAcceptSuggestion,
  onDismissSuggestion,
  onGenerateSuggestions,
}: GoalsCardProps) {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [newGoal, setNewGoal] = useState<{
    title: string;
    description: string;
    category: GoalCategory;
    period: GoalPeriod;
    targetType: TargetType;
    targetHours: number;
    targetMinutes: number;
    parentIds: string[];
  }>({
    title: '', description: '', category: 'work', period: 'daily',
    targetType: 'completion', targetHours: 0, targetMinutes: 30, parentIds: [],
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Goal>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeGoals = useMemo(
    () => goals.filter(g => g.status !== 'done' && g.period !== 'longterm' && !g.isHabit),
    [goals]
  );
  const completedGoals = useMemo(
    () => goals.filter(g => g.status === 'done' && g.period !== 'longterm' && !g.isHabit),
    [goals]
  );

  const handleAdd = () => {
    if (!newGoal.title.trim()) return;
    const targetSeconds = newGoal.targetType === 'time'
      ? (newGoal.targetHours * 3600) + (newGoal.targetMinutes * 60)
      : undefined;
    onAdd({
      title: newGoal.title.trim(),
      description: newGoal.description.trim() || undefined,
      category: newGoal.category,
      period: newGoal.period,
      target: { type: newGoal.targetType, targetSeconds },
      parentIds: newGoal.parentIds,
      parentId: newGoal.parentIds[0] || undefined,
      links: [],
    });
    resetAddForm();
    setIsAdding(false);
  };

  const resetAddForm = () => {
    setNewGoal({
      title: '', description: '', category: 'work', period: 'daily',
      targetType: 'completion', targetHours: 0, targetMinutes: 30, parentIds: [],
    });
  };

  const startEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setEditForm({ ...goal });
  };

  const saveEdit = () => {
    if (editingId && editForm.title?.trim()) {
      onUpdate(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleToggle = (id: string, isCompleted: boolean) => {
    if (!isCompleted) {
      confetti({
        particleCount: 60,
        spread: 90,
        startVelocity: 40,
        colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#34d399', '#fbbf24'],
      });
    }
    onToggle(id);
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) {
      onDelete(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000);
    }
  };

  // ─── Loading Skeleton ───
  if (loading) {
    return (
      <SpotlightCard spotlightColor="rgba(139, 92, 246, 0.08)" className="rounded-xl h-full">
        <div className="relative rounded-xl overflow-hidden p-5 h-full">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />
          <div className="animate-pulse space-y-4">
            <div className="h-5 light:bg-white light:border-[var(--ws-border-strong)] rounded w-1/3" />
            <div className="h-3 light:bg-[var(--ws-surface-sunken)] rounded w-1/2" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 light:bg-[var(--ws-surface-sunken)] rounded-lg" />
            ))}
          </div>
        </div>
      </SpotlightCard>
    );
  }

  // ─── Error State ───
  if (error) {
    return (
      <SpotlightCard spotlightColor="rgba(139, 92, 246, 0.08)" className="rounded-xl h-full">
        <div className="relative rounded-xl overflow-hidden p-5 h-full flex flex-col items-center justify-center text-center">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />
          <div className="w-14 h-14 rounded-full bg-zinc-800/50 light:bg-[var(--ws-surface-sunken)] flex items-center justify-center mb-3">
            <AlertCircle size={24} className="light:text-stone-400" />
          </div>
          <p className="text-[14px] font-medium light:text-stone-400">Could not load goals</p>
          <p className="text-[12px] light:text-stone-400 mt-1 max-w-[220px]">{error}</p>
        </div>
      </SpotlightCard>
    );
  }

  return (
      <SpotlightCard spotlightColor="rgba(139, 92, 246, 0.08)" className="rounded-xl h-full">
      <div className="relative rounded-xl overflow-hidden p-5 flex flex-col h-full">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/life')}
              className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center hover:bg-violet-500/20 transition-colors"
              title="View all goals"
            >
              <Target size={15} className="text-violet-400" />
            </button>
            <div>
              <button onClick={() => navigate('/life')} className="hover:opacity-80 transition-opacity text-left">
                <h2 className="text-[15px] font-semibold light:text-stone-900">Routines</h2>
                <p className="text-[11px] light:text-stone-400">
                  {activeGoals.length} active · {completedGoals.length} done
                </p>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {insights.streak > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
              >
                <Flame size={12} />
                <span className="text-[11px] font-medium">{insights.streak}d streak</span>
              </motion.div>
            )}
            {suggestions.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
              >
                <Sparkles size={12} />
                {suggestions.length} AI
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsAdding(!isAdding)}
              className="w-8 h-8 rounded-md light:bg-[var(--ws-surface-sunken)] hover:light:border-[var(--ws-border-strong)] flex items-center justify-center light:text-stone-400 hover:light:text-stone-900 transition-colors"
              aria-label={isAdding ? 'Cancel adding goal' : 'Add new goal'}
            >
              {isAdding ? <X size={14} /> : <Plus size={14} />}
            </motion.button>
          </div>
        </div>

        {/* Add Goal Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div variants={formVariants} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
              <div className="p-3 rounded-lg light:bg-white light:border-[var(--ws-border-strong)] border light:border-[var(--ws-border)] space-y-2.5 mb-3">
                <Input
                  value={newGoal.title}
                  onChange={e => setNewGoal(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  placeholder="What do you want to achieve today?"
                  autoFocus
                  className="light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-violet-500/50 text-[13px] h-9"
                />
                <Input
                  value={newGoal.description}
                  onChange={e => setNewGoal(p => ({ ...p, description: e.target.value }))}
                  placeholder="Add details (optional)"
                  className="light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-violet-500/50 text-[13px] h-9"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={newGoal.category} onValueChange={v => setNewGoal(p => ({ ...p, category: v as GoalCategory }))} className="w-[110px]">
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </Select>
                  <Select value={newGoal.period} onValueChange={v => setNewGoal(p => ({ ...p, period: v as GoalPeriod }))} className="w-[100px]">
                    {PERIODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </Select>
                  <Select value={newGoal.targetType} onValueChange={v => setNewGoal(p => ({ ...p, targetType: v as TargetType }))} className="w-[130px]">
                    {TARGET_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <AnimatePresence>
                  {newGoal.targetType === 'time' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 overflow-hidden"
                    >
                      <span className="text-[11px] light:text-stone-400">Target:</span>
                      <Input type="number" min={0} max={23} value={newGoal.targetHours}
                        onChange={e => setNewGoal(p => ({ ...p, targetHours: parseInt(e.target.value) || 0 }))}
                        className="w-16 light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] text-[13px] h-8" />
                      <span className="text-[11px] light:text-stone-400">h</span>
                      <Input type="number" min={0} max={59} value={newGoal.targetMinutes}
                        onChange={e => setNewGoal(p => ({ ...p, targetMinutes: parseInt(e.target.value) || 0 }))}
                        className="w-16 light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] text-[13px] h-8" />
                      <span className="text-[11px] light:text-stone-400">m</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {longTermGoals.length > 0 && (
                  <LTGPicker
                    longTermGoals={longTermGoals}
                    value={newGoal.parentIds}
                    onChange={ids => setNewGoal(p => ({ ...p, parentIds: ids }))}
                  />
                )}

                <div className="flex items-center gap-2 pt-1">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="sm" onClick={handleAdd} className="bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-[12px] h-8">
                      <Plus size={12} className="mr-1" /> Add Goal
                    </Button>
                  </motion.div>
                  <Button size="sm" variant="ghost" onClick={() => { resetAddForm(); setIsAdding(false); }} className="light:text-stone-400 hover:light:text-stone-900 text-[12px] h-8">
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Suggestions */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div variants={formVariants} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
              <div className="p-3 rounded-lg bg-violet-500/[0.04] border border-violet-500/20 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-violet-400" />
                    <span className="text-[11px] text-violet-400 font-medium">AI Suggested Goals</span>
                  </div>
                  <button onClick={() => setShowSuggestions(false)} className="light:text-stone-400 hover:light:text-stone-900/80 p-1 rounded">
                    <X size={12} />
                  </button>
                </div>
                <div className="space-y-2">
                  {suggestions.map((suggestion, i) => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-2.5 rounded-md light:bg-white light:border-[var(--ws-border-strong)] border light:border-[var(--ws-border-strong)]/40 hover:light:border-[var(--ws-border-strong)] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles size={12} className="text-violet-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[13px] light:text-stone-900/80 truncate block">{suggestion.title}</span>
                          {suggestion.parentId && longTermGoals.find(l => l.id === suggestion.parentId) && (
                            <span className="text-[10px] light:text-stone-400 truncate block">
                              Serves: {longTermGoals.find(l => l.id === suggestion.parentId)?.title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onAcceptSuggestion(suggestion)}
                          className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                          title="Accept suggestion"
                        >
                          <Check size={12} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onDismissSuggestion(suggestion.id)}
                          className="w-7 h-7 rounded-md light:bg-[var(--ws-surface-sunken)] light:text-stone-400 hover:light:border-[var(--ws-border-strong)] flex items-center justify-center transition-colors"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Goals List */}
        <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
          <AnimatePresence>
            {activeGoals.map((goal) => (
              <motion.div
                key={goal.id}
                variants={itemVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="group"
              >
                {editingId === goal.id ? (
                  <div className="p-3 rounded-lg light:bg-white light:border-[var(--ws-border-strong)] border light:border-[var(--ws-border)] space-y-2">
                    <Input
                      value={editForm.title || ''}
                      onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                      className="light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-violet-500/50 text-[13px] h-9"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={editForm.category} onValueChange={v => setEditForm(p => ({ ...p, category: v as GoalCategory }))} className="w-[110px]">
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </Select>
                      <Select value={editForm.period} onValueChange={v => setEditForm(p => ({ ...p, period: v as GoalPeriod }))} className="w-[100px]">
                        {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button size="sm" onClick={saveEdit} className="bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-[12px] h-8">
                          Save
                        </Button>
                      </motion.div>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditForm({}); }} className="light:text-stone-400 hover:light:text-stone-900 text-[12px] h-8">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-lg border light:border-[var(--ws-border-strong)]/30 hover:light:border-[var(--ws-border)] light:bg-[var(--ws-surface-raised)] light:border-[var(--ws-border-strong)]/20 hover:light:bg-white light:border-[var(--ws-border-strong)]/40 transition-all duration-200 group/card">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleToggle(goal.id, goal.status === 'done')}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-200 ${
                        goal.status === 'done'
                          ? 'bg-violet-500 border-violet-500 text-[var(--resume-success)]'
                          : 'border-zinc-600 hover:border-violet-400/50 light:border-[var(--ws-border-strong)]'
                      }`}
                      aria-label={goal.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {goal.status === 'done' && <Check size={12} className="light:text-[var(--resume-success)]" strokeWidth={3} />}
                    </motion.button>

                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] truncate transition-colors ${
                        goal.status === 'done' ? 'light:text-stone-400 line-through' : 'light:text-stone-900/90'
                      }`}>
                        {goal.title}
                      </div>

                      {goal.description && (
                        <p className="text-[11px] light:text-stone-400 mt-0.5 line-clamp-1">{goal.description}</p>
                      )}

                      {(() => {
                        const parentIds = goal.parentIds?.length ? goal.parentIds : (goal.parentId ? [goal.parentId] : []);
                        const parents = parentIds.map(pid => longTermGoals.find(ltg => ltg.id === pid)).filter(Boolean) as LongTermGoal[];
                        return parents.length > 0 ? (
                          <div className="flex items-center gap-1 mt-1">
                            <ArrowRight size={8} className="light:text-stone-400 shrink-0" />
                            <span className="text-[10px] light:text-stone-400 truncate">Serves: {parents.map(p => p.title).join(', ')}</span>
                          </div>
                        ) : null;
                      })()}

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge className={`text-[10px] px-1.5 py-0.5 ${getCategoryMeta(goal.category).color}`}>
                          {getCategoryMeta(goal.category).label}
                        </Badge>
                        <span className="text-[10px] light:bg-[var(--ws-surface-sunken)] light:text-stone-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <RefreshCw size={8} />{goal.period}
                        </span>
                        {goal.target.type === 'time' && goal.target.targetSeconds && (
                          <span className="text-[10px] light:text-stone-400">
                            {formatTime(goal.progressSeconds || 0)} / {formatTime(goal.target.targetSeconds)}
                          </span>
                        )}
                        {goal.streak && goal.streak > 1 && (
                          <span className="text-[10px] text-amber-500/80 flex items-center gap-0.5">
                            <Flame size={8} /> {goal.streak}
                          </span>
                        )}
                      </div>

                      {goal.target.type === 'time' && goal.target.targetSeconds && (
                        <div className="mt-2 h-1 rounded-full bg-zinc-800 light:bg-[var(--ws-surface-sunken)] overflow-hidden">
                          <motion.div
                            className="h-full bg-violet-500/60 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, ((goal.progressSeconds || 0) / goal.target.targetSeconds) * 100)}%` }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {onStartFocus && goal.target.type === 'time' && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); onStartFocus(goal.id); }}
                          className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                          title="Start focus session"
                        >
                          <Zap size={12} />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); startEdit(goal); }}
                        className="w-7 h-7 rounded-md light:bg-[var(--ws-surface-sunken)] light:text-stone-400 hover:light:border-[var(--ws-border-strong)] hover:light:text-stone-900 flex items-center justify-center transition-colors"
                        title="Edit goal"
                      >
                        <Edit3 size={12} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          deleteConfirmId === goal.id
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'light:bg-[var(--ws-surface-sunken)] light:text-stone-400 hover:bg-red-500/20 hover:text-red-400'
                        }`}
                        title={deleteConfirmId === goal.id ? 'Click again to confirm delete' : 'Delete goal'}
                      >
                        <Trash2 size={12} />
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {goals.length === 0 && !isAdding && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-10"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-800/50 light:bg-[var(--ws-surface-sunken)] flex items-center justify-center mb-3">
                <Target size={24} className="text-zinc-600 light:text-stone-400" />
              </div>
              <p className="text-[14px] font-medium light:text-stone-400">No routines yet</p>
              <p className="text-[12px] light:text-stone-400 mt-1 max-w-[200px]">
                Add a daily or weekly routine, or let AI suggest one from your long-term plans
              </p>
              <div className="flex items-center gap-2 mt-3">
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsAdding(true)}
                  className="px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors text-[12px] font-medium"
                >
                  <Plus size={12} className="inline mr-1" />
                  Add Goal
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onGenerateSuggestions}
                  className="px-3 py-1.5 rounded-lg light:bg-[var(--ws-surface-sunken)] light:text-stone-400 border light:border-[var(--ws-border)] hover:light:border-[var(--ws-border-strong)] hover:light:text-stone-900 transition-colors text-[12px] font-medium"
                >
                  <Sparkles size={12} className="inline mr-1" />
                  AI Suggest
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Completed Goals Section */}
        {completedGoals.length > 0 && (
          <div className="mt-3 pt-3 border-t light:border-[var(--ws-border)] shrink-0">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-[11px] light:text-stone-400 hover:light:text-stone-900/80 transition-colors w-full py-1"
            >
              {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{completedGoals.length} completed</span>
              <span className="ml-auto text-emerald-400 font-mono">
                <NumberTicker value={insights.completionRate} suffix="%" delay={200} duration={800} />
              </span>
            </button>

            <AnimatePresence>
              {showCompleted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 mt-2">
                    {completedGoals.map(goal => (
                      <motion.div
                        key={goal.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-2 rounded-md light:bg-white light:border-[var(--ws-border-strong)] opacity-50 hover:opacity-80 transition-opacity"
                      >
                        <Check size={12} className="text-emerald-500" />
                        <span className="text-[12px] light:text-stone-400 line-through flex-1">{goal.title}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onToggle(goal.id)}
                          className="light:text-stone-400 hover:light:text-stone-400 p-1 rounded"
                          title="Undo completion"
                        >
                          <RefreshCw size={10} />
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

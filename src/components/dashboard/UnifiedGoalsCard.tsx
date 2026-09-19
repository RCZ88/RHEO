import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Plus, Sparkles, Loader2, Clock, Link2, X, Trash2 } from 'lucide-react';
import { AnimatedShinyText } from '../ui/animated-shiny-text';
import { NumberTicker } from '../ui/number-ticker';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectItem } from '../ui/select';
import { confetti } from '../ui/confetti';
import type { Goal, GoalCategory, LongTermGoal } from './types';

const CATEGORIES: { value: GoalCategory; label: string; color: string }[] = [
  { value: 'work', label: 'Work', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { value: 'personal', label: 'Personal', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  { value: 'health', label: 'Health', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'learning', label: 'Learning', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { value: 'finance', label: 'Finance', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { value: 'relationships', label: 'Relationships', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
];

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.15 } },
};

interface UnifiedGoalsCardProps {
  goals: Goal[];
  longTermGoals: LongTermGoal[];
  schedule: any[];
  loading?: boolean;
  onToggle: (id: string) => void;
  onAdd: (goal: Omit<Goal, 'id' | 'date' | 'createdAt' | 'status' | 'source'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onGenerate: () => void;
  onAcceptSuggestion: (suggestion: Goal) => void;
  onDismissSuggestion: (id: string) => void;
  suggestions: Goal[];
}

export function UnifiedGoalsCard({
  goals, longTermGoals, schedule, loading, onToggle, onAdd, onDelete, onUpdate,
  onGenerate, onAcceptSuggestion, onDismissSuggestion, suggestions,
}: UnifiedGoalsCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<GoalCategory>('work');

  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'done' && g.status !== 'failed'), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.status === 'done'), [goals]);
  const doneCount = completedGoals.length;
  const totalGoals = goals.length;

  const handleGenerate = async () => {
    setIsGenerating(true);
    await onGenerate();
    setIsGenerating(false);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({ title: newTitle.trim(), category: newCategory, target: { type: 'completion' }, period: 'daily', links: [] });
    setNewTitle('');
    setIsAdding(false);
  };

  const handleToggle = (id: string, isCompleted: boolean) => {
    if (!isCompleted) {
      confetti({ particleCount: 40, spread: 70, startVelocity: 30, colors: ['#ec4899', '#a78bfa', '#34d399', '#fbbf24'] });
    }
    onToggle(id);
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) { onDelete(id); setDeleteConfirmId(null); }
    else { setDeleteConfirmId(id); setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000); }
  };

  if (loading) {
    return (
      <div className="relative rounded-xl overflow-hidden  p-5 min-h-[400px]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-zinc-800 rounded w-1/3" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-zinc-800/30 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden  p-5 min-h-[400px] flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Check size={14} className="text-violet-400" />
          </div>
          <div>
            <AnimatedShinyText className="text-[14px] font-semibold" gradientFrom="#8b5cf6" gradientTo="#a78bfa">
              Today&apos;s Goals
            </AnimatedShinyText>
            <p className="text-[11px] text-zinc-500 font-sans">
              <span className="font-mono text-zinc-400 tabular-nums">{doneCount}</span>/{totalGoals} done
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {suggestions.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
              {suggestions.length} AI
            </span>
          )}
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleGenerate} disabled={isGenerating}
            className="w-7 h-7 rounded-md bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-violet-400 transition-colors disabled:opacity-50">
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsAdding(!isAdding)}
            className="w-7 h-7 rounded-md bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
            {isAdding ? <X size={13} /> : <Plus size={13} />}
          </motion.button>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 space-y-2">
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="What do you want to achieve?" autoFocus className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-violet-500/50 text-[13px] h-8 font-sans" />
              <div className="flex items-center gap-2">
                <Select value={newCategory} onValueChange={v => setNewCategory(v as GoalCategory)} className="w-[100px]">
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </Select>
                <Button size="sm" onClick={handleAdd} className="bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 text-[11px] h-7">
                  <Plus size={10} className="mr-1" /> Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setNewTitle(''); setIsAdding(false); }} className="text-zinc-400 hover:text-white text-[11px] h-7">Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <div className="p-2.5 rounded-lg bg-violet-500/[0.04] border border-violet-500/20">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={11} className="text-violet-400" />
                <AnimatedShinyText className="text-[11px] font-medium" gradientFrom="#8b5cf6" gradientTo="#c084fc">AI Suggestions</AnimatedShinyText>
              </div>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-2 rounded-md bg-zinc-900/60 border border-zinc-800/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles size={10} className="text-violet-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[12px] text-zinc-300 truncate block font-sans">{s.title}</span>
                        {s.linkedScheduleId && <span className="text-[10px] text-sky-400 flex items-center gap-0.5 font-mono"><Clock size={8} /> Schedule-linked</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onAcceptSuggestion(s)} className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><Check size={10} /></button>
                      <button onClick={() => onDismissSuggestion(s.id)} className="w-6 h-6 rounded bg-zinc-800/50 text-zinc-400 flex items-center justify-center"><X size={10} /></button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals list */}
      <div className="flex-1 space-y-1.5 min-h-0 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activeGoals.length === 0 && !isAdding && suggestions.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-[13px] text-zinc-500 mb-2 font-sans">No goals yet today</p>
              <Button onClick={handleGenerate} variant="outline" className="border-zinc-700 hover:bg-zinc-800/50 text-[12px] h-8">
                <Sparkles size={11} className="mr-1.5 text-violet-400" /> Generate Daily Plan
              </Button>
            </motion.div>
          )}
          {activeGoals.map(goal => (
            <motion.div key={goal.id} variants={itemVariants} initial="hidden" animate="show" exit="exit" layout className="group">
              <div className="flex items-center gap-2.5 p-2 rounded-lg border border-transparent hover:bg-zinc-800/30 hover:border-zinc-700/30 transition-all duration-150">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggle(goal.id, goal.status === 'done')}
                  className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${goal.status === 'done' ? 'bg-violet-500 border-violet-500' : 'border-zinc-600 hover:border-violet-400/50'}`}>
                  {goal.status === 'done' && <Check size={10} className="text-white" strokeWidth={3} />}
                </motion.button>
                <div className="flex-1 min-w-0">
                  <span className={`text-[13px] truncate block font-sans ${goal.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{goal.title}</span>
                  {(() => {
                    const parentIds = goal.parentIds?.length ? goal.parentIds : (goal.parentId ? [goal.parentId] : []);
                    const parents = parentIds.map(pid => longTermGoals.find(ltg => ltg.id === pid)).filter(Boolean) as LongTermGoal[];
                    return parents.length > 0 ? <span className="text-[10px] text-zinc-600 flex items-center gap-0.5 font-sans truncate"><Link2 size={8} className="shrink-0" /> {parents.map(p => p.title).join(', ')}</span> : null;
                  })()}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {goal.linkedScheduleId && <Clock size={10} className="text-sky-400/70" />}
                  {goal.streak && goal.streak > 1 && <span className="text-[10px] font-semibold text-pink-400/80 font-mono tabular-nums">{goal.streak}d</span>}
                  <span className={`text-[9px] px-1 py-0 rounded ${CATEGORIES.find(c => c.value === goal.category)?.color || ''}`}>{goal.category}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    <button onClick={() => handleDelete(goal.id)} className={`w-5 h-5 rounded flex items-center justify-center ${deleteConfirmId === goal.id ? 'bg-red-500/20 text-red-400' : 'text-zinc-600 hover:text-red-400'}`}>
                      {deleteConfirmId === goal.id ? <Check size={9} /> : <Trash2 size={9} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {completedGoals.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-sans">
            <Check size={9} className="text-emerald-500" />
            <span className="font-mono tabular-nums">{completedGoals.length} completed</span>
          </div>
        </div>
      )}
    </div>
  );
}

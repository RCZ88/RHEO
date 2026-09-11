import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, Loader2, ChevronDown,
  Sparkles, Flag, ArrowUp, ArrowDown, Trash2, FileText, Brain, AlertCircle,
  CheckSquare, Square, Upload
} from 'lucide-react';
import { generateUUID } from '../lib/uuid';
import { GlassCard, SectionHead, StateShell, IconButton, StatusDot, MOTION } from '../components/ai';
import type { ViewState } from '../components/ai/StateShell';

interface LongTermGoal {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  target_seconds?: number;
  priority: number;
}

interface ParsedGoal {
  title: string;
  description?: string;
  category: string;
}

const CATEGORIES = ['work', 'personal', 'health', 'learning', 'finance', 'relationships'];

const categoryConfig: Record<string, { color: string; dot: string; bg: string }> = {
  work: { color: 'text-violet-300', dot: 'bg-violet-500', bg: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20' },
  personal: { color: 'text-cyan-300', dot: 'bg-cyan-500', bg: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20' },
  health: { color: 'text-emerald-300', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20' },
  learning: { color: 'text-amber-300', dot: 'bg-amber-500', bg: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20' },
  finance: { color: 'text-rose-300', dot: 'bg-rose-500', bg: 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20' },
  relationships: { color: 'text-pink-300', dot: 'bg-pink-500', bg: 'bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20' },
};

export function LongTermPlanCard() {
  const [goals, setGoals] = useState<LongTermGoal[]>([]);
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('work');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  const [mode, setMode] = useState<'manual' | 'bulk'>('manual');

  const [bulkText, setBulkText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedGoals, setParsedGoals] = useState<(ParsedGoal & { selected: boolean })[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);

  useEffect(() => { loadGoals(); }, []);

  async function loadGoals() {
    setState({ status: 'loading' });
    try {
      const r = await window.deskflowAPI!.getLongtermGoals();
      if (r?.success) {
        setGoals(r.goals || []);
        setState({ status: 'ready', data: r.goals || [] });
      } else {
        setState({ status: 'error', message: r?.error || 'Failed to load', retry: loadGoals });
      }
    } catch (err: any) {
      setState({ status: 'error', message: err.message, retry: loadGoals });
    }
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const goal = {
        id: generateUUID(),
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        category: newCategory,
        target: { type: 'completion' },
        status: 'pending',
        period: 'longterm',
        source: 'manual',
        links: [],
        priority: goals.length,
      };
      await window.deskflowAPI!.saveGoal('', goal);
      setNewTitle('');
      setNewDescription('');
      setShowAdd(false);
      await loadGoals();
    } catch {}
    setSaving(false);
  }

  async function handleToggle(goal: LongTermGoal) {
    const newStatus = goal.status === 'completed' ? 'pending' : 'completed';
    try {
      await window.deskflowAPI!.saveGoal('', {
        ...goal,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
      });
      await loadGoals();
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await window.deskflowAPI!.deleteGoal(id);
      await loadGoals();
    } catch {}
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const reordered = [...goals];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    try {
      for (let i = 0; i < reordered.length; i++) {
        await window.deskflowAPI!.saveGoal('', { ...reordered[i], priority: i });
      }
      setGoals(reordered);
    } catch {}
  }

  async function handleMoveDown(index: number) {
    if (index === goals.length - 1) return;
    const reordered = [...goals];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    try {
      for (let i = 0; i < reordered.length; i++) {
        await window.deskflowAPI!.saveGoal('', { ...reordered[i], priority: i });
      }
      setGoals(reordered);
    } catch {}
  }

  async function handleAnalyze() {
    if (!bulkText.trim() || bulkText.trim().length < 10) {
      setBulkError('Please write at least a few sentences about your goals.');
      return;
    }
    setAnalyzing(true);
    setBulkError(null);
    setParsedGoals([]);
    try {
      const r = await window.deskflowAPI!.parseGoalDump(bulkText.trim());
      if (r?.success && Array.isArray(r.goals)) {
        const withSel = r.goals.map((g: ParsedGoal) => ({ ...g, selected: true }));
        if (withSel.length === 0) {
          setBulkError('AI could not extract any clear goals from your text. Try being more specific about what you want to achieve.');
        }
        setParsedGoals(withSel);
      } else {
        setBulkError(r?.error || 'Analysis failed. Try again.');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Connection error. Check your AI provider settings.');
    }
    setAnalyzing(false);
  }

  async function handleImportSelected() {
    const selected = parsedGoals.filter(g => g.selected);
    if (selected.length === 0) return;
    setImporting(true);
    try {
      const batch = selected.map((g, i) => ({
        id: generateUUID(),
        title: g.title,
        description: g.description || null,
        category: g.category || 'work',
        target: { type: 'completion' },
        status: 'pending',
        period: 'longterm',
        source: 'ai-import',
        links: [],
        priority: goals.length + i,
      }));
      await window.deskflowAPI!.saveGoalsBatch(batch);
      setImportCount(selected.length);
      setParsedGoals([]);
      setBulkText('');
      await loadGoals();
    } catch {}
    setImporting(false);
  }

  function handleRetry() {
    setParsedGoals([]);
    setBulkError(null);
  }

  const pending = goals.filter(g => g.status !== 'completed');
  const done = goals.filter(g => g.status === 'completed');

  return (
    <GlassCard accent="emerald">
      <SectionHead
        accent="amber"
        title="Long-term Plan"
        desc={`${pending.length} active \u00B7 ${done.length} done`}
        right={
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-zinc-800/60 ring-1 ring-zinc-700/40">
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                mode === 'manual'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Plus className="w-3 h-3" />
              Manual
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                mode === 'bulk'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Bulk
            </button>
          </div>
        }
      />

      <StateShell state={state} skeleton={
        <div className="space-y-3 py-2">
          <div className="h-10 w-full rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-10 w-full rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-10 w-2/3 rounded-lg bg-zinc-800/40 animate-pulse" />
        </div>
      } empty={null}>
        {() => (mode === 'manual' ? (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
          >
            {/* Add button */}
            <div className="flex items-center justify-end mb-3">
              <IconButton
                icon={Plus}
                label="Add goal"
                onClick={() => setShowAdd(!showAdd)}
                className="text-amber-400 hover:bg-amber-500/15"
              />
            </div>

            {/* Add form */}
            <AnimatePresence>
              {showAdd && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: MOTION.normal, ease: MOTION.ease }}
                  className="overflow-hidden mb-4"
                >
                  <div className="rounded-xl p-3.5 bg-zinc-900/40 ring-1 ring-zinc-800/60 space-y-2.5">
                    <input
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
                      placeholder="What do you want to achieve?"
                      className="w-full bg-zinc-950/60 ring-1 ring-zinc-800/60 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:outline-none"
                      autoFocus
                    />
                    <textarea
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder="Optional description or notes..."
                      rows={2}
                      className="w-full bg-zinc-950/60 ring-1 ring-zinc-800/60 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:outline-none resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        className="flex-1 bg-zinc-950/60 ring-1 ring-zinc-800/60 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:outline-none"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button
                        onClick={handleAdd}
                        disabled={!newTitle.trim() || saving}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Goal'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {goals.length === 0 && !showAdd && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/40 ring-1 ring-zinc-700/40 flex items-center justify-center mb-3">
                  <Flag className="w-5 h-5 text-zinc-500" />
                </div>
                <p className="text-sm font-medium text-zinc-400">No long-term goals yet</p>
                <p className="text-xs text-zinc-600 mt-0.5">Click + to add your first goal</p>
              </div>
            )}

            {/* Goals list */}
            {pending.length > 0 && (
              <div className="space-y-1.5">
                {pending.map((goal, i) => {
                  const cat = categoryConfig[goal.category] || categoryConfig.work;
                  return (
                    <motion.div
                      key={goal.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: MOTION.fast, delay: Math.min(i * MOTION.stagger, 0.3) }}
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-zinc-800/30 transition-colors group"
                    >
                      <button
                        onClick={() => handleToggle(goal)}
                        className="mt-0.5 w-[18px] h-[18px] rounded-full ring-2 ring-zinc-600 shrink-0 flex items-center justify-center hover:ring-emerald-400 transition-all duration-200"
                      >
                        <div className={`w-2 h-2 rounded-full transition-all duration-200 ${cat.dot}`} />
                      </button>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-200 font-medium truncate group-hover:text-white transition-colors">{goal.title}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider shrink-0 ${cat.bg}`}>
                            {goal.category}
                          </span>
                        </div>
                        {goal.description && (
                          <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{goal.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                        <button onClick={() => handleMoveUp(i)} disabled={i === 0} className="p-1 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 hover:bg-zinc-800 transition-all">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleMoveDown(i)} disabled={i === pending.length - 1} className="p-1 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 hover:bg-zinc-800 transition-all">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(goal.id)} className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Completed section */}
            {done.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-800/60">
                <button
                  onClick={() => setCompletedOpen(!completedOpen)}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors font-medium"
                >
                  <Check className="w-3 h-3 text-emerald-500" />
                  Completed ({done.length})
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${completedOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {completedOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: MOTION.normal, ease: MOTION.ease }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 mt-2">
                        {done.map(goal => {
                          const cat = categoryConfig[goal.category] || categoryConfig.work;
                          return (
                            <motion.div
                              key={goal.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/10"
                            >
                              <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              </div>
                              <span className="text-xs text-zinc-500 line-through flex-1">{goal.title}</span>
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider shrink-0 ${cat.bg}`}>
                                {goal.category}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="bulk"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
            className="space-y-3"
          >
            {/* No goals yet from import */}
            {parsedGoals.length === 0 && !analyzing && !bulkError && (
              <>
                <div className="relative">
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder="Paste your thoughts, notes, or a brain dump here...&#10;&#10;Example:&#10;'I want to learn TypeScript deeply this quarter, finish my portfolio site, start running 3x a week, save $5000 for a trip to Japan, and read 12 books this year. Also need to improve my relationship with my family by having weekly dinners.'"
                    rows={8}
                    className="w-full bg-zinc-950/60 ring-1 ring-zinc-800/60 rounded-xl px-3.5 py-3 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:outline-none resize-none"
                  />
                  <div className="absolute bottom-3 right-3 text-[9px] text-zinc-600">
                    {bulkText.length} chars
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={bulkText.trim().length < 10}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                >
                  <Brain className="w-3.5 h-3.5" />
                  Analyze with AI
                </button>

                <p className="text-[10px] text-zinc-600 text-center">
                  AI will extract goals, categories, and descriptions from your text
                </p>
              </>
            )}

            {/* Analyzing state */}
            {analyzing && (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <span className="flex w-4 h-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-40" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500/30" />
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-zinc-200 mb-1">Analyzing your goals...</p>
                <p className="text-[11px] text-zinc-500">Extracting actionable items from your text</p>
                <div className="flex gap-1 mt-4">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-amber-500/50"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Bulk error */}
            {bulkError && !analyzing && (
              <div className="rounded-lg bg-red-500/8 ring-1 ring-red-500/15 p-3 text-xs text-red-400">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-300">{bulkError}</p>
                    <button
                      onClick={handleRetry}
                      className="mt-2 text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Parsed goals preview */}
            {parsedGoals.length > 0 && !analyzing && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400 font-medium">
                    <FileText className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {parsedGoals.length} goal{parsedGoals.length !== 1 ? 's' : ''} detected
                  </p>
                  <button
                    onClick={handleRetry}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Clear & retry
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
                  {parsedGoals.map((g, i) => {
                    const cat = categoryConfig[g.category] || categoryConfig.work;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: MOTION.fast, delay: Math.min(i * MOTION.stagger, 0.3) }}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg ring-1 transition-all duration-200 cursor-pointer ${
                          g.selected
                            ? 'bg-zinc-800/40 ring-zinc-700/50 hover:bg-zinc-800/60'
                            : 'bg-zinc-800/10 ring-zinc-800/40 opacity-50 hover:opacity-80'
                        }`}
                        onClick={() => {
                          const updated = [...parsedGoals];
                          updated[i] = { ...updated[i], selected: !updated[i].selected };
                          setParsedGoals(updated);
                        }}
                      >
                        <button className="mt-0.5 shrink-0">
                          {g.selected
                            ? <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                            : <Square className="w-3.5 h-3.5 text-zinc-600" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-200 font-medium truncate">{g.title}</span>
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider shrink-0 ${cat.bg}`}>
                              {g.category}
                            </span>
                          </div>
                          {g.description && (
                            <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{g.description}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <button
                  onClick={handleImportSelected}
                  disabled={importing || parsedGoals.filter(g => g.selected).length === 0}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  {importing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Import {parsedGoals.filter(g => g.selected).length} goal{parsedGoals.filter(g => g.selected).length !== 1 ? 's' : ''}
                </button>
              </>
            )}

            {/* Success toast */}
            <AnimatePresence>
              {importCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: MOTION.normal }}
                  className="p-3 rounded-xl bg-emerald-500/6 ring-1 ring-emerald-500/20 flex items-center gap-2.5"
                >
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-emerald-300 font-medium">
                      {importCount} goal{importCount !== 1 ? 's' : ''} imported successfully!
                    </p>
                    <p className="text-[10px] text-emerald-500/70 mt-0.5">They've been added to your plan below.</p>
                  </div>
                  <button
                    onClick={() => setImportCount(0)}
                    className="p-1 rounded-md hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </StateShell>
    </GlassCard>
  );
}

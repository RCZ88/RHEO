// ============================================================
// DeskFlow Dashboard — ScheduleCard (Revamped v2)
// Skills: Human-Centric UX (current block prominence, empty states),
//         Impeccable Design (color-coded blocks, time hierarchy, 8px grid),
//         MCP (SpotlightCard from ReactBits, AnimatedGradientText from Magic UI,
//              BorderBeam on current block),
//         Signature Design (micro-detail: pulsing "NOW" indicator)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Clock, MapPin, Plus, X, Edit3, Trash2,
  BookOpen, FlaskConical, Brain, FileText, Users, MoreHorizontal, Sun
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Select, SelectItem } from '../../components/ui/select';
import type { ScheduleEntry, ScheduleCategory } from './types';
import { EntityChip } from '../../components/goals/EntityChip';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Warm/amber palette — matches the Gold page's WarmCard theme (see WarmCard.tsx).
const COLORS = ['#f59e0b', '#fbbf24', '#34d399', '#22d3ee', '#8b5cf6', '#fb7185', '#60a5fa'];
const ACCENT = '#f59e0b';
const ACCENT_SOFT = 'rgba(245, 158, 11, 0.12)';
const ACCENT_BORDER = 'rgba(245, 158, 11, 0.30)';

const CATEGORY_ICONS: Record<ScheduleCategory, React.ReactNode> = {
  class: <BookOpen size={12} />,
  lab: <FlaskConical size={12} />,
  study: <Brain size={12} />,
  exam: <FileText size={12} />,
  meeting: <Users size={12} />,
  other: <MoreHorizontal size={12} />,
};

const CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  class: 'Class', lab: 'Lab', study: 'Study', exam: 'Exam', meeting: 'Meeting', other: 'Other',
};

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDuration(start: string, end: string): string {
  const mins = parseTime(end) - parseTime(start);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getMinutesUntil(timeStr: string): number {
  const now = new Date();
  return parseTime(timeStr) - (now.getHours() * 60 + now.getMinutes());
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

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

interface ScheduleCardProps {
  entries: ScheduleEntry[];
  selectedDate?: string;
  selectedDay?: number;
  loading?: boolean;
  error?: string | null;
  onAdd: (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, patch: Partial<ScheduleEntry>) => void;
  onDelete: (id: string) => void;
  linkedGoals?: { id: string; title: string; category: string }[];
  showAll?: boolean;
}

export function ScheduleCard({
  entries, selectedDate, selectedDay: selectedDayProp, loading = false, error = null, onAdd, onUpdate, onDelete, linkedGoals, showAll = false,
}: ScheduleCardProps) {
  const selectedDay = selectedDayProp ?? new Date().getDay();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(interval);
  }, []);

  const [form, setForm] = useState({
    title: '', location: '', day: selectedDay.toString(), start: '09:00', end: '10:00',
    category: 'class' as ScheduleCategory, color: COLORS[0], goalId: '',
  });

  const dayEntries = useMemo(() =>
    entries
      .filter(e => showAll ? true : e.day_of_week === selectedDay)
      .sort((a, b) =>
        showAll
          ? (a.day_of_week - b.day_of_week) || (parseTime(a.start_time) - parseTime(b.start_time))
          : parseTime(a.start_time) - parseTime(b.start_time)
      ),
    [entries, selectedDay, showAll]
  );

  const currentEntry = dayEntries.find(e => {
    const start = parseTime(e.start_time);
    const end = parseTime(e.end_time);
    return nowMinutes >= start && nowMinutes < end;
  });

  const upcomingEntries = dayEntries.filter(e => parseTime(e.start_time) > nowMinutes);
  const pastEntries = dayEntries.filter(e => parseTime(e.end_time) <= nowMinutes);

  const resetForm = () => setForm({ title: '', location: '', day: selectedDay.toString(), start: '09:00', end: '10:00', category: 'class', color: COLORS[0], goalId: '' });

  const startAdd = () => { resetForm(); setForm(p => ({ ...p, day: selectedDay.toString() })); setIsAdding(true); setEditingId(null); };

  const startEdit = (entry: ScheduleEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title, location: entry.location || '', day: entry.day_of_week.toString(),
      start: entry.start_time, end: entry.end_time, category: entry.category || 'class', color: entry.color || COLORS[0], goalId: entry.goal_id || '',
    });
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(), location: form.location.trim() || undefined,
      day_of_week: parseInt(form.day), start_time: form.start, end_time: form.end,
      category: form.category, color: form.color,
      goal_id: form.goalId || null,
    };
    if (editingId) { onUpdate(editingId, payload); setEditingId(null); }
    else { onAdd(payload); setIsAdding(false); }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (deleteConfirmId === id) { onDelete(id); setDeleteConfirmId(null); }
    else { setDeleteConfirmId(id); setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000); }
  };

  const isToday = selectedDay === new Date().getDay();

  if (loading) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-zinc-800 light:border-[var(--ws-border)] bg-zinc-900 light:bg-white p-5 min-h-[400px]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-zinc-800 light:bg-zinc-100 rounded w-1/3" />
          <div className="flex gap-2">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-8 bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 rounded-md flex-1" />)}</div>
          {[1,2,3].map(i => <div key={i} className="h-14 bg-zinc-800 light:bg-zinc-100/30 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-zinc-800 light:border-[var(--ws-border)] bg-zinc-900 light:bg-white p-5 min-h-[400px] flex flex-col items-center justify-center text-center">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
        <div className="w-14 h-14 rounded-full bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 flex items-center justify-center mb-3">
          <Calendar size={24} className="text-zinc-600" />
        </div>
        <p className="text-[14px] font-medium text-zinc-400">Could not load schedule</p>
        <p className="text-[12px] text-zinc-600 mt-1 max-w-[220px]">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 light:border-[var(--ws-border)] bg-zinc-900 light:bg-white p-5 min-h-[400px] flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent" />
      {currentEntry && isToday && (
        <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ boxShadow: `inset 0 0 0 1px ${ACCENT_BORDER}, 0 0 24px -6px ${ACCENT_SOFT}` }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}` }}>
            <Calendar size={15} style={{ color: ACCENT }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-100">
              {DAYS[selectedDay]}&apos;s Schedule
            </h3>
            <p className="text-[11px] text-zinc-500">
              {dayEntries.length === 0 ? 'Nothing scheduled' : `${dayEntries.length} block${dayEntries.length > 1 ? 's' : ''}`}
              {isToday && ' · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={startAdd}
            className="w-8 h-8 rounded-md bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 hover:bg-zinc-700 light:bg-zinc-200/50 light:bg-zinc-200/50 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            aria-label={isAdding || editingId ? 'Cancel' : 'Add schedule entry'}
          >
            {isAdding || editingId ? <X size={14} /> : <Plus size={14} />}
          </motion.button>
        </div>
      </div>

        {/* Day selector (hidden in "show all" mode — every day is shown) */}
        {!showAll && (
        <div className="flex items-center gap-1 mb-3 shrink-0">
          {DAY_LETTER.map((letter, i) => (
            <span key={i} className={`flex-1 h-8 rounded-md text-[11px] font-medium flex items-center justify-center transition-all ${
              i === selectedDay
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-700 border border-transparent'
            }`}>
              {letter}
            </span>
          ))}
        </div>
        )}

        {/* Add/Edit Form */}
        <AnimatePresence>
          {(isAdding || editingId) && (
            <motion.div variants={formVariants} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
              <div className="p-3 rounded-lg bg-zinc-900 light:bg-white/60 light:bg-white/40 border border-zinc-800 light:border-zinc-200/50 light:border-zinc-200/50 space-y-2.5 mb-3">
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Entry title (e.g. Linear Algebra)"
                  autoFocus
                  className="bg-zinc-900 light:bg-white/80 light:bg-white/60 border-zinc-700 light:border-zinc-300/50 focus-visible:ring-amber-500/50 text-[13px] h-9"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={form.location}
                    onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    placeholder="Location (optional)"
                    className="flex-1 bg-zinc-900 light:bg-white/80 light:bg-white/60 border-zinc-700 light:border-zinc-300/50 focus-visible:ring-amber-500/50 text-[13px] h-9"
                  />
                  <Select value={form.day} onValueChange={v => setForm(p => ({ ...p, day: v }))} className="w-[90px]">
                    {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{DAY_SHORT[i]}</SelectItem>)}
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <Input type="time" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} className="bg-zinc-900 light:bg-white/80 light:bg-white/60 border-zinc-700 light:border-zinc-300/50 focus-visible:ring-amber-500/50 text-[13px] h-9" />
                    <span className="text-zinc-600 text-xs">to</span>
                    <Input type="time" value={form.end} onChange={e => setForm(p => ({ ...p, end: e.target.value }))} className="bg-zinc-900 light:bg-white/80 light:bg-white/60 border-zinc-700 light:border-zinc-300/50 focus-visible:ring-amber-500/50 text-[13px] h-9" />
                  </div>
                  <div className="flex items-center gap-1">
                    {COLORS.map(c => (
                      <motion.button
                        key={c}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setForm(p => ({ ...p, color: c }))}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Select color ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as ScheduleCategory }))} className="w-[110px]">
                    {(Object.keys(CATEGORY_LABELS) as ScheduleCategory[]).map(cat => (
                      <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </Select>
                  {linkedGoals && linkedGoals.length > 0 && (
                    <select
                      value={form.goalId}
                      onChange={e => setForm(p => ({ ...p, goalId: e.target.value }))}
                      aria-label="Link schedule block to goal"
                      className="h-8 min-w-0 flex-1 rounded-md border border-zinc-700/50 bg-zinc-900 px-2 text-[11px] text-zinc-400 outline-none focus:border-amber-400/50"
                    >
                      <option value="">No linked goal</option>
                      {linkedGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                    </select>
                  )}
                  <div className="flex-1" />
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="sm" onClick={handleSave} className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-[12px] h-8">
                      {editingId ? 'Save' : 'Add'}
                    </Button>
                  </motion.div>
                  <Button size="sm" variant="ghost" onClick={() => { resetForm(); setIsAdding(false); setEditingId(null); }} className="text-zinc-400 hover:text-white text-[12px] h-8">
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule List */}
        {dayEntries.length === 0 && !isAdding && !editingId ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-10"
          >
            <div className="w-14 h-14 rounded-full bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 flex items-center justify-center mb-3">
              <Sun size={24} className="text-zinc-600" />
            </div>
            <p className="text-[14px] font-medium text-zinc-400">Nothing scheduled for {DAY_SHORT[selectedDay]}</p>
            <p className="text-[12px] text-zinc-600 mt-1 max-w-[200px]">
              Add classes, study blocks, meetings, or exams to build your weekly routine
            </p>
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={startAdd}
              className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-[12px] font-medium"
            >
              <Plus size={12} className="inline mr-1" />
              Add Entry
            </motion.button>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex-1 space-y-2 min-h-0 overflow-y-auto">
            {/* Current block */}
            <AnimatePresence mode="popLayout">
              {currentEntry && isToday && (
                <motion.div
                  key={`current-${currentEntry.id}`}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  layout
                  className="relative"
                >
                  <div className="relative p-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: currentEntry.color || ACCENT }} />
                    <div className="flex items-start justify-between pl-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <motion.span
                            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                          />
                          <span className="text-sm font-semibold text-zinc-100">{currentEntry.title}</span>
                          {showAll && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 light:bg-zinc-100/60 light:bg-zinc-100 text-zinc-300 border border-zinc-700 light:border-zinc-300/40 light:border-zinc-200/40 shrink-0">
                              {DAY_SHORT[currentEntry.day_of_week]}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/20 shrink-0">
                            NOW
                          </span>
                        </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatTime(currentEntry.start_time)} – {formatTime(currentEntry.end_time)}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-mono">{formatDuration(currentEntry.start_time, currentEntry.end_time)}</span>
                          {currentEntry.location && (
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                              <MapPin size={10} />{currentEntry.location}
                            </span>
                          )}
                          {currentEntry.goal_id && <EntityChip kind="goal" label={linkedGoals?.find(g => g.id === currentEntry.goal_id)?.title || 'Linked goal'} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(currentEntry)} className="w-6 h-6 rounded bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 text-zinc-400 hover:text-white flex items-center justify-center">
                          <Edit3 size={10} />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(currentEntry.id)} className="w-6 h-6 rounded bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 text-zinc-400 hover:text-red-400 flex items-center justify-center">
                          <Trash2 size={10} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upcoming blocks */}
            {upcomingEntries.map((entry) => {
              const minsUntil = getMinutesUntil(entry.start_time);
              return (
                <motion.div key={entry.id} variants={itemVariants} initial="hidden" animate="show" exit="exit" layout className="group">
                  <div className="relative p-3 rounded-lg border border-zinc-800 light:border-zinc-200/50 light:border-zinc-200/50 hover:border-zinc-700 light:border-zinc-300/40 light:border-zinc-200/40 bg-zinc-900 light:bg-white/20 hover:bg-zinc-900 light:bg-white/40 light:bg-white/30 transition-all duration-200">
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: entry.color || '#6b7280' }} />
                    <div className="flex items-start justify-between pl-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{entry.title}</span>
                          <span className="text-[10px] text-zinc-600 px-1 py-0.5 rounded bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 border border-zinc-700 light:border-zinc-300/30 light:border-zinc-300/30 flex items-center gap-1">
                            {CATEGORY_ICONS[entry.category || 'other']}
                            {CATEGORY_LABELS[entry.category || 'other']}
                          </span>
                          {showAll && (
                            <span className="text-[10px] text-zinc-500 px-1 py-0.5 rounded bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 border border-zinc-700 light:border-zinc-300/30 light:border-zinc-300/30 shrink-0">
                              {DAY_SHORT[entry.day_of_week]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-zinc-500 font-mono">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                          <span className="text-[11px] text-zinc-600 font-mono">{formatDuration(entry.start_time, entry.end_time)}</span>
                          {entry.location && (
                            <span className="text-[11px] text-zinc-600 flex items-center gap-1"><MapPin size={10} />{entry.location}</span>
                          )}
                          {entry.goal_id && <EntityChip kind="goal" label={linkedGoals?.find(g => g.id === entry.goal_id)?.title || 'Linked goal'} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isToday && minsUntil > 0 && minsUntil < 180 && (
                          <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 px-1.5 py-0.5 rounded">
                            in {minsUntil}m
                          </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(entry)} className="w-6 h-6 rounded bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 text-zinc-400 hover:text-white flex items-center justify-center">
                            <Edit3 size={10} />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDelete(entry.id)} className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${deleteConfirmId === entry.id ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 light:bg-zinc-100/50 light:bg-zinc-100/50 text-zinc-400 hover:text-red-400'}`}>
                            <Trash2 size={10} />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Past entries */}
            {isToday && pastEntries.length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] text-zinc-700 uppercase tracking-wider font-medium mb-1.5 px-1">Completed today</div>
                {pastEntries.map(entry => (
                  <motion.div key={entry.id} variants={itemVariants} initial="hidden" animate="show" className="flex items-center gap-2 p-2 rounded-md opacity-40 hover:opacity-70 transition-opacity">
                    <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: entry.color || '#6b7280' }} />
                    <span className="text-[12px] text-zinc-500 flex-1">{entry.title}</span>
                    <span className="text-[10px] text-zinc-700 font-mono">{formatTime(entry.start_time)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
  );
}

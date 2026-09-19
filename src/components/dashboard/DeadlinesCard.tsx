// ============================================================
// DeskFlow Dashboard — DeadlinesCard (v3 — Deadlines + Reminders)
// Unified card for deadlines AND reminders with proper datetime input
// ============================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Clock, CheckCircle2, Plus, X, Edit3, Trash2,
  Bell, ChevronDown, ChevronUp, AlertTriangle, RotateCcw
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { Reminder } from './types';
import { Select, SelectItem } from '../ui/select';
import { VoiceInputWrapper } from '../VoiceInputWrapper';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { format } from 'date-fns';
import type { Deadline, Priority, DeadlineCategory } from './types';

type EntryType = 'deadline' | 'reminder';

const PRIORITIES: { value: Priority; label: string; color: string; dot: string }[] = [
  { value: 'critical', label: 'Critical', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: '#f87171' },
  { value: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: '#fb923c' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: '#fbbf24' },
  { value: 'low', label: 'Low', color: 'light:bg-stone-500/5 light:text-stone-400 light:border-[var(--ws-border)]', dot: '#6b7280' },
];

const CATEGORIES: { value: DeadlineCategory; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'work', label: 'Work' },
  { value: 'personal', label: 'Personal' },
  { value: 'health', label: 'Health' },
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

function getDaysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr.length > 10 ? dateStr.slice(0, 10) + 'T00:00:00' : dateStr + 'T00:00:00');
  if (isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgency(daysLeft: number | null): 'overdue' | 'urgent' | 'critical' | 'soon' | 'normal' {
  if (daysLeft === null) return 'normal';
  if (daysLeft < 0) return 'overdue';
  if (daysLeft === 0) return 'urgent';
  if (daysLeft <= 2) return 'critical';
  if (daysLeft <= 5) return 'soon';
  return 'normal';
}

const URGENCY_META = {
  overdue: { color: '#ef4444', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', label: 'Overdue' },
  urgent: { color: '#f87171', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', label: 'Today' },
  critical: { color: '#fb923c', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', label: 'Soon' },
  soon: { color: '#fbbf24', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Upcoming' },
  normal: { color: '#6b7280', bg: 'light:bg-[var(--ws-surface-sunken)]', text: 'light:text-stone-400', border: 'light:border-[var(--ws-border)]', label: 'Later' },
};

function isReminder(dl: Deadline): boolean {
  return !!dl.remind_at;
}

function formatRemindAt(remindAt: string): string {
  try {
    const d = new Date(remindAt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeStr = format(d, 'h:mm a');
    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    return format(d, 'MMM d') + ' ' + timeStr;
  } catch {
    return remindAt;
  }
}

function getRemindAtMinutesUntil(remindAt: string): number {
  const now = Date.now();
  const target = new Date(remindAt).getTime();
  return Math.ceil((target - now) / 60000);
}

interface DeadlinesCardProps {
  deadlines: Deadline[];
  reminders?: Reminder[];
  loading?: boolean;
  error?: string | null;
  onAdd: (dl: Omit<Deadline, 'id' | 'createdAt' | 'status'>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Deadline>) => void;
  onComplete: (id: string) => void;
  onToggleReminder?: (id: string, done: boolean) => void;
  onDeleteReminder?: (id: string) => void;
  goalOptions?: { id: string; title: string; isHabit?: boolean }[];
}

export function DeadlinesCard({
  deadlines,
  reminders = [],
  loading = false,
  error = null,
  onAdd,
  onDelete,
  onUpdate,
  onComplete,
  onToggleReminder,
  onDeleteReminder,
  goalOptions = [],
}: DeadlinesCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addType, setAddType] = useState<EntryType>('deadline');
  const [newDl, setNewDl] = useState<{
    title: string;
    dueDate: Date | undefined;
    priority: Priority;
    category: DeadlineCategory | '';
    description: string;
    remindAtDate: Date | undefined;
    remindAtTime: string;
    hasReminder: boolean;
    goalId: string;
  }>({
    title: '', dueDate: undefined, priority: 'medium', category: '', description: '',
    remindAtDate: undefined, remindAtTime: '09:00', hasReminder: false, goalId: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Deadline>>({});
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editRemindAtDate, setEditRemindAtDate] = useState<Date | undefined>(undefined);
  const [editRemindAtTime, setEditRemindAtTime] = useState('09:00');
  const [editHasReminder, setEditHasReminder] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const sortedPending = useMemo(() => {
    const pending = deadlines.filter(d => d.status !== 'completed');
    return pending.sort((a, b) => {
      const aTime = isReminder(a) && a.remind_at ? new Date(a.remind_at).getTime() : new Date(a.due_date).getTime();
      const bTime = isReminder(b) && b.remind_at ? new Date(b.remind_at).getTime() : new Date(b.due_date).getTime();
      return aTime - bTime;
    });
  }, [deadlines]);

  const completed = useMemo(() => deadlines.filter(d => d.status === 'completed'), [deadlines]);
  const deadlineReminders = useMemo(() => sortedPending.filter(d => isReminder(d)), [sortedPending]);
  const deadlineItems = useMemo(() => sortedPending.filter(d => !isReminder(d)), [sortedPending]);
  const urgentCount = useMemo(() =>
    deadlineItems.filter(d => getDaysUntil(d.due_date) <= 2).length +
    deadlineReminders.filter(d => {
      const mins = getRemindAtMinutesUntil(d.remind_at!);
      return mins >= 0 && mins <= 120;
    }).length,
    [deadlineItems, reminders]
  );

  const resetAddForm = () => {
    setNewDl({
      title: '', dueDate: undefined, priority: 'medium', category: '', description: '',
      remindAtDate: undefined, remindAtTime: '09:00', hasReminder: false, goalId: '',
    });
    setAddType('deadline');
  };

  const handleAdd = () => {
    if (!newDl.title.trim()) return;

    const dueDate = addType === 'deadline' && newDl.dueDate
      ? newDl.dueDate.toISOString()
      : addType === 'reminder' && newDl.remindAtDate
        ? newDl.remindAtDate.toISOString()
        : new Date().toISOString();

    let remindAt: string | undefined;
    if (addType === 'reminder' && newDl.remindAtDate) {
      const [h, m] = (newDl.remindAtTime || '09:00').split(':').map(Number);
      const dt = new Date(newDl.remindAtDate);
      dt.setHours(h, m, 0, 0);
      remindAt = dt.toISOString();
    } else if (addType === 'deadline' && newDl.hasReminder && newDl.remindAtDate) {
      const [h, m] = (newDl.remindAtTime || '09:00').split(':').map(Number);
      const dt = new Date(newDl.remindAtDate);
      dt.setHours(h, m, 0, 0);
      remindAt = dt.toISOString();
    }

    onAdd({
      title: newDl.title.trim(),
      due_date: dueDate,
      priority: newDl.priority,
      category: newDl.category || undefined,
      description: newDl.description.trim() || undefined,
      remind_at: remindAt,
      goal_id: newDl.goalId || null,
    });
    resetAddForm();
    setIsAdding(false);
  };

  const startEdit = (dl: Deadline) => {
    setEditingId(dl.id);
    setEditForm({ ...dl });
    setEditDate(new Date(dl.due_date));
    if (dl.remind_at) {
      const rd = new Date(dl.remind_at);
      setEditRemindAtDate(rd);
      setEditRemindAtTime(format(rd, 'HH:mm'));
      setEditHasReminder(true);
    } else {
      setEditRemindAtDate(undefined);
      setEditRemindAtTime('09:00');
      setEditHasReminder(false);
    }
  };

  const saveEdit = () => {
    if (editingId && editForm.title?.trim()) {
      const patch: Partial<Deadline> = { ...editForm };
      if (editDate) patch.due_date = editDate.toISOString();
      if (editHasReminder && editRemindAtDate) {
        const [h, m] = editRemindAtTime.split(':').map(Number);
        const dt = new Date(editRemindAtDate);
        dt.setHours(h, m, 0, 0);
        patch.remind_at = dt.toISOString();
      } else {
        patch.remind_at = undefined;
      }
      onUpdate(editingId, patch);
      setEditingId(null);
      setEditForm({});
      setEditDate(undefined);
      setEditRemindAtDate(undefined);
      setEditHasReminder(false);
    }
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

  if (loading) {
    return (
      <SpotlightCard spotlightColor="rgba(244, 63, 94, 0.08)" className="rounded-xl h-full">
        <div className="relative rounded-xl overflow-hidden  p-5 h-full">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-transparent" />
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

  if (error) {
    return (
      <SpotlightCard spotlightColor="rgba(244, 63, 94, 0.08)" className="rounded-xl h-full">
        <div className="relative rounded-xl overflow-hidden  p-5 h-full flex flex-col items-center justify-center text-center">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-transparent" />
          <div className="w-14 h-14 rounded-full bg-zinc-800/50 light:bg-[var(--ws-surface-sunken)] flex items-center justify-center mb-3">
            <AlertCircle size={24} className="light:text-stone-400" />
          </div>
          <p className="text-[14px] font-medium light:text-stone-400">Could not load items</p>
          <p className="text-[12px] light:text-stone-400 mt-1 max-w-[220px]">{error}</p>
        </div>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard spotlightColor="rgba(244, 63, 94, 0.08)" className="rounded-xl h-full">
      <div className="relative rounded-xl overflow-hidden  p-5 flex flex-col h-full">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <AlertCircle size={15} className="text-rose-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold light:text-stone-900">Upcoming</h2>
              <p className="text-[11px] light:text-stone-400">
                {deadlineItems.length} deadline{deadlineItems.length !== 1 ? 's' : ''} · {deadlineReminders.length} reminder{deadlineReminders.length !== 1 ? 's' : ''} · {completed.length} done
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20"
              >
                <AlertTriangle size={12} />
                <span className="text-[11px] font-medium">{urgentCount} urgent</span>
              </motion.div>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsAdding(!isAdding)}
              className="w-8 h-8 rounded-md light:bg-[var(--ws-surface-sunken)] hover:light:border-[var(--ws-border-strong)] flex items-center justify-center light:text-stone-400 hover:light:text-stone-900 transition-colors"
              aria-label={isAdding ? 'Cancel adding' : 'Add new item'}
            >
              {isAdding ? <X size={14} /> : <Plus size={14} />}
            </motion.button>
          </div>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div variants={formVariants} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
              <div className="p-3 rounded-lg light:bg-white light:border-[var(--ws-border-strong)] border light:border-[var(--ws-border)] space-y-2.5 mb-3">
                {/* Type Toggle */}
                <div className="flex gap-1 p-0.5 rounded-lg light:bg-[var(--ws-surface-sunken)] border light:border-[var(--ws-border)]">
                  <button
                    onClick={() => setAddType('deadline')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                      addType === 'deadline'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                        : 'light:text-stone-400 hover:light:text-stone-900/70'
                    }`}
                  >
                    <Clock size={12} />
                    Deadline
                  </button>
                  <button
                    onClick={() => setAddType('reminder')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                      addType === 'reminder'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                        : 'light:text-stone-400 hover:light:text-stone-900/70'
                    }`}
                  >
                    <Bell size={12} />
                    Reminder
                  </button>
                </div>

                <VoiceInputWrapper className="w-full">
                  <Input
                    value={newDl.title}
                    onChange={e => setNewDl(p => ({ ...p, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={addType === 'deadline' ? "What's due?" : "What to remind about?"}
                    autoFocus
                    className="light:bg-white light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-rose-500/50 text-[13px] h-9"
                  />
                </VoiceInputWrapper>
                <VoiceInputWrapper className="w-full">
                  <Input
                    value={newDl.description}
                    onChange={e => setNewDl(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description (optional)"
                    className="light:bg-white light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-rose-500/50 text-[13px] h-9"
                  />
                </VoiceInputWrapper>

                {addType === 'deadline' ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-9 px-3 text-xs flex-1 justify-start rounded-md light:bg-white light:border-[var(--ws-border-strong)]/80 border light:border-[var(--ws-border-strong)] light:text-stone-400 hover:light:text-stone-900 hover:border-zinc-600 transition-colors text-left min-w-[140px]">
                            {newDl.dueDate ? format(newDl.dueDate, 'PPP') : "Pick due date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 light:bg-white light:border-[var(--ws-border-strong)] light:border-[var(--ws-border-strong)]">
                          <CalendarComponent
                            mode="single"
                            selected={newDl.dueDate}
                            onSelect={date => setNewDl(p => ({ ...p, dueDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Select value={newDl.priority} onValueChange={v => setNewDl(p => ({ ...p, priority: v as Priority }))} className="w-[100px]">
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </Select>
                    </div>

                    {/* Optional reminder for deadlines */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setNewDl(p => ({ ...p, hasReminder: !p.hasReminder }))}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                          newDl.hasReminder
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                            : 'light:bg-[var(--ws-surface-sunken)] light:text-stone-400 light:border-[var(--ws-border)] hover:light:text-stone-400'
                        }`}
                      >
                        <Bell size={10} />
                        {newDl.hasReminder ? 'Remind me' : 'Add reminder'}
                      </button>
                    </div>

                    {newDl.hasReminder && (
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="h-8 px-2 text-[11px] flex-1 justify-start rounded-md light:bg-white light:border-[var(--ws-border-strong)]/80 border light:border-[var(--ws-border-strong)] light:text-stone-400 hover:light:text-stone-900 hover:border-zinc-600 transition-colors text-left min-w-[120px]">
                              {newDl.remindAtDate ? format(newDl.remindAtDate, 'MMM d') : "Remind date"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 light:bg-white light:border-[var(--ws-border-strong)] light:border-[var(--ws-border-strong)]">
                            <CalendarComponent
                              mode="single"
                              selected={newDl.remindAtDate}
                              onSelect={date => setNewDl(p => ({ ...p, remindAtDate: date }))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          value={newDl.remindAtTime}
                          onChange={e => setNewDl(p => ({ ...p, remindAtTime: e.target.value }))}
                          className="h-8 w-[90px] light:bg-white light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-amber-500/50 text-[11px]"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  /* Reminder mode — date + time picker */
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="h-9 px-3 text-xs flex-1 justify-start rounded-md light:bg-white light:border-[var(--ws-border-strong)]/80 border light:border-[var(--ws-border-strong)] light:text-stone-400 hover:light:text-stone-900 hover:border-zinc-600 transition-colors text-left min-w-[140px]">
                          {newDl.remindAtDate ? format(newDl.remindAtDate, 'PPP') : "Pick remind date"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 light:bg-white light:border-[var(--ws-border-strong)] light:border-[var(--ws-border-strong)]">
                        <CalendarComponent
                          mode="single"
                          selected={newDl.remindAtDate}
                          onSelect={date => setNewDl(p => ({ ...p, remindAtDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={newDl.remindAtTime}
                      onChange={e => setNewDl(p => ({ ...p, remindAtTime: e.target.value }))}
                      className="h-9 w-[100px] light:bg-white light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-amber-500/50 text-[13px]"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Select value={newDl.category} onValueChange={v => setNewDl(p => ({ ...p, category: v as DeadlineCategory }))} className="w-[120px]">
                    <SelectItem value="" disabled>Category</SelectItem>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </Select>
                  {goalOptions.length > 0 && (
                    <select
                      value={newDl.goalId}
                      onChange={e => setNewDl(p => ({ ...p, goalId: e.target.value }))}
                      aria-label="Link deadline to goal or habit"
                      className="h-8 min-w-0 flex-1 rounded-md border border-zinc-700/50 bg-zinc-900 px-2 text-[11px] text-zinc-400 outline-none focus:border-rose-400/50"
                    >
                      <option value="">No linked goal</option>
                      {goalOptions.map(goal => <option key={goal.id} value={goal.id}>{goal.isHabit ? 'Habit · ' : ''}{goal.title}</option>)}
                    </select>
                  )}
                  <div className="flex-1" />
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button size="sm" onClick={handleAdd} className={`${
                      addType === 'deadline'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                    } text-[12px] h-8`}>
                      <Plus size={12} className="mr-1" /> Add
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

        {/* Items List */}
        <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
          <AnimatePresence>
            {sortedPending.map((dl) => {
              const reminder = isReminder(dl);
              const daysLeft = reminder ? 0 : getDaysUntil(dl.due_date);
              const urgency = reminder ? 'normal' as const : getUrgency(daysLeft);
              const meta = reminder
                ? { color: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Reminder' }
                : URGENCY_META[urgency];
              const priorityMeta = PRIORITIES.find(p => p.value === dl.priority) || PRIORITIES[2];
              const isEditing = editingId === dl.id;

              if (isEditing) {
                const editIsReminder = !!editForm.remind_at;
                return (
                  <motion.div
                    key={dl.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="p-3 rounded-lg light:bg-white light:border-[var(--ws-border-strong)] border light:border-[var(--ws-border)] space-y-2"
                  >
                    <Input
                      value={editForm.title || ''}
                      onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                      className="light:bg-white light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-rose-500/50 text-[13px] h-9"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-9 px-3 text-xs flex-1 justify-start rounded-md light:bg-white light:border-[var(--ws-border-strong)]/80 border light:border-[var(--ws-border-strong)] light:text-stone-400 hover:light:text-stone-900 hover:border-zinc-600 transition-colors text-left">
                            {editDate ? format(editDate, 'PPP') : "Pick due date"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 light:bg-white light:border-[var(--ws-border-strong)] light:border-[var(--ws-border-strong)]">
                          <CalendarComponent mode="single" selected={editDate} onSelect={setEditDate} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <Select value={editForm.priority} onValueChange={v => setEditForm(p => ({ ...p, priority: v as Priority }))} className="w-[100px] light:bg-[var(--ws-surface-sunken)] light:border-[var(--ws-border)]">
                        {PRIORITIES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditHasReminder(!editHasReminder)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all border ${
                          editHasReminder
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                            : 'light:bg-[var(--ws-surface-sunken)] light:text-stone-400 light:border-[var(--ws-border)] hover:light:text-stone-400'
                        }`}
                      >
                        <Bell size={10} />
                        {editHasReminder ? 'Remind me' : 'Add reminder'}
                      </button>
                    </div>
                    {editHasReminder && (
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="h-8 px-2 text-[11px] flex-1 justify-start rounded-md light:bg-white light:border-[var(--ws-border-strong)]/80 border light:border-[var(--ws-border-strong)] light:text-stone-400 hover:light:text-stone-900 hover:border-zinc-600 transition-colors text-left min-w-[120px]">
                              {editRemindAtDate ? format(editRemindAtDate, 'MMM d') : "Remind date"}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 light:bg-white light:border-[var(--ws-border-strong)] light:border-[var(--ws-border-strong)]">
                            <CalendarComponent mode="single" selected={editRemindAtDate} onSelect={setEditRemindAtDate} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <Input
                          type="time"
                          value={editRemindAtTime}
                          onChange={e => setEditRemindAtTime(e.target.value)}
                          className="h-8 w-[90px] light:bg-white light:border-[var(--ws-border-strong)]/80 light:border-[var(--ws-border-strong)] focus-visible:ring-amber-500/50 text-[11px]"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button size="sm" onClick={saveEdit} className="bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-[12px] h-8">
                          Save
                        </Button>
                      </motion.div>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditForm({}); setEditDate(undefined); setEditRemindAtDate(undefined); setEditHasReminder(false); }} className="light:text-stone-400 hover:light:text-stone-900 text-[12px] h-8">
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={dl.id}
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="group"
                >
                  <div className={`relative p-3 rounded-lg border transition-all duration-200 ${
                    !reminder && urgency === 'overdue' ? 'border-rose-500/30 bg-rose-500/[0.03]' : 'light:border-[var(--ws-border-strong)]/30 hover:light:border-[var(--ws-border)] light:bg-white light:border-[var(--ws-border-strong)]/20 hover:light:bg-white light:border-[var(--ws-border-strong)]/40'
                  }`}>
                    {/* Indicator bar */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: meta.color }} />
                    {!reminder && urgency === 'overdue' && (
                      <motion.div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                        style={{ backgroundColor: meta.color }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}

                    <div className="flex items-start justify-between pl-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {reminder ? <Bell size={12} className="text-amber-400 shrink-0" /> : null}
                          <span className="text-[13px] light:text-stone-900/90 truncate">{dl.title}</span>
                          {!reminder && urgency === 'overdue' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-400 border border-rose-500/20">
                              OVERDUE
                            </span>
                          )}
                        </div>

                        {dl.description && (
                          <p className="text-[11px] light:text-stone-400 mt-0.5 line-clamp-1">{dl.description}</p>
                        )}

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge className={`text-[10px] px-1.5 py-0.5 ${priorityMeta.color}`}>
                            <span className="w-1 h-1 rounded-full mr-1 inline-block" style={{ backgroundColor: priorityMeta.dot }} />
                            {dl.priority}
                          </Badge>
                          {dl.category && (
                            <Badge className="text-[10px] px-1.5 py-0.5 light:bg-[var(--ws-surface-sunken)] light:text-stone-400 light:border-[var(--ws-border)]">
                              {dl.category}
                            </Badge>
                          )}
                          {dl.course && (
                            <span className="text-[10px] light:text-stone-400">{dl.course}</span>
                          )}
                          {dl.goal_id && <span className="text-[10px] rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">{goalOptions.find(goal => goal.id === dl.goal_id)?.isHabit ? 'Habit' : 'Goal'} · {goalOptions.find(goal => goal.id === dl.goal_id)?.title || 'Unlinked'}</span>}
                          {reminder && dl.remind_at ? (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                              <Bell size={11} />
                              {formatRemindAt(dl.remind_at)}
                            </span>
                          ) : (
                            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
                              <Clock size={11} />
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d ago` :
                               daysLeft === 0 ? 'Today' :
                               daysLeft === 1 ? '1d' :
                               `${daysLeft}d`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onComplete(dl.id)}
                            className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                            title="Mark complete"
                          >
                            <CheckCircle2 size={12} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => startEdit(dl)}
                            className="w-7 h-7 rounded-md light:bg-[var(--ws-surface-sunken)] light:text-stone-400 hover:light:border-[var(--ws-border-strong)] hover:light:text-stone-900 flex items-center justify-center transition-colors"
                            title="Edit"
                          >
                            <Edit3 size={12} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(dl.id)}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                              deleteConfirmId === dl.id
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'light:bg-[var(--ws-surface-sunken)] light:text-stone-400 hover:bg-red-500/20 hover:text-red-400'
                            }`}
                            title={deleteConfirmId === dl.id ? 'Click again to confirm delete' : 'Delete'}
                          >
                            <Trash2 size={12} />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty State */}
          {deadlines.length === 0 && !isAdding && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-10"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-800/50 light:bg-[var(--ws-surface-sunken)] flex items-center justify-center mb-3">
                <CheckCircle2 size={24} className="light:text-stone-400" />
              </div>
              <p className="text-[14px] font-medium light:text-stone-400">Nothing upcoming</p>
              <p className="text-[12px] light:text-stone-400 mt-1 max-w-[200px]">
                Add deadlines, exams, or reminders to stay on top of your schedule
              </p>
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsAdding(true)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors text-[12px] font-medium"
              >
                <Plus size={12} className="inline mr-1" />
                Add Item
              </motion.button>
            </motion.div>
          )}

          {/* Reminders from reminders table */}
          {reminders.length > 0 && !isAdding && (
            <div className="mt-3 pt-3 border-t light:border-[var(--ws-border)]">
              <div className="flex items-center gap-1.5 mb-2">
                <Bell size={11} className="text-amber-400" />
                <span className="text-[11px] uppercase tracking-wider light:text-stone-400">Reminders</span>
                <span className="text-[10px] light:text-stone-500">{reminders.filter(r => !r.done).length}</span>
              </div>
              <div className="space-y-1">
                {reminders.filter(r => !r.done).slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-md light:bg-white light:border-[var(--ws-border-strong)] hover:light:bg-white light:border-[var(--ws-border-strong)]/50 transition-colors group">
                    <button
                      onClick={() => onToggleReminder?.(r.id, true)}
                      className="w-4 h-4 rounded border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center justify-center"
                    >
                      <CheckCircle2 size={10} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <span className="text-[12px] light:text-stone-900/70 flex-1 truncate">{r.text}</span>
                    {r.due_date && <span className="text-[10px] text-amber-400/60 font-mono">{r.due_date.slice(5)}</span>}
                    <button
                      onClick={() => onDeleteReminder?.(r.id)}
                      className="light:text-stone-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Completed Section */}
        {completed.length > 0 && (
          <div className="mt-3 pt-3 border-t light:border-[var(--ws-border)] shrink-0">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-[11px] light:text-stone-400 hover:light:text-stone-900/80 transition-colors w-full py-1"
            >
              {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{completed.length} completed</span>
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
                    {completed.map(dl => (
                      <motion.div
                        key={dl.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-2 rounded-md light:bg-white light:border-[var(--ws-border-strong)] opacity-50 hover:opacity-80 transition-opacity"
                      >
                        {isReminder(dl) ? <Bell size={12} className="text-amber-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                        <span className="text-[12px] light:text-stone-400 line-through flex-1">{dl.title}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onUpdate(dl.id, { status: 'pending' })}
                          className="light:text-stone-400 hover:light:text-stone-400 p-1 rounded"
                          title="Reopen"
                        >
                          <RotateCcw size={10} />
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

// ============================================================
// RHEO Dashboard — ScheduleCard (de-slopped 2026-09-12)
// L1 COMPOSED: WidgetCard chrome, token colors, no glow,
// no stagger, no pulsing, no rainbow. Flat data tool.
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from "motion/react";
import {
  Calendar, Clock, MapPin, Plus, X, Edit3, Trash2,
  BookOpen, FlaskConical, Brain, FileText, Users, MoreHorizontal
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Select, SelectItem } from '../../components/ui/select';
import { WidgetCard } from '../../components/dashboard/WidgetCard';
import { getWidgetTheme } from '../../components/dashboard/widgetTheme';
import type { ScheduleEntry, ScheduleCategory } from './types';
import { EntityChip } from '../../components/goals/EntityChip';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  showAll?: false;
  onDayChange?: (day: number) => void;
}

export function ScheduleCard({
  entries, selectedDate, selectedDay: selectedDayProp, loading = false, error = null, onAdd, onUpdate, onDelete, linkedGoals, showAll = false, onDayChange,
}: ScheduleCardProps) {
  const theme = getWidgetTheme('schedule-hero');
  const selectedDay = selectedDayProp ?? new Date().getDay();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDayClick = (i: number) => {
    if (onDayChange) onDayChange(i);
  };

  const [form, setForm] = useState({
    title: '', location: '', day: selectedDay.toString(), start: '09:00', end: '10:00',
    category: 'class' as ScheduleCategory, goalId: '',
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

  const resetForm = () => setForm({ title: '', location: '', day: selectedDay.toString(), start: '09:00', end: '10:00', category: 'class', goalId: '' });

  const startAdd = () => { resetForm(); setForm(p => ({ ...p, day: selectedDay.toString() })); setIsAdding(true); setEditingId(null); };

  const startEdit = (entry: ScheduleEntry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title, location: entry.location || '', day: entry.day_of_week.toString(),
      start: entry.start_time, end: entry.end_time, category: entry.category || 'class', goalId: entry.goal_id || '',
    });
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(), location: form.location.trim() || undefined,
      day_of_week: parseInt(form.day), start_time: form.start, end_time: form.end,
      category: form.category, color: theme.accent, goal_id: form.goalId || null,
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

  return (
    <WidgetCard
      widgetId="schedule-hero"
      title={`${DAYS[selectedDay]}'s Schedule`}
      icon={Calendar}
      accent={theme.accent}
      kicker={theme.kicker}
      loading={loading}
      error={error}
      errorMessage="Could not load schedule"
      empty={dayEntries.length === 0 && !isAdding && !editingId}
      emptyMessage={`Nothing scheduled for ${DAY_SHORT[selectedDay]}`}
      emptyIcon={<Calendar size={24} className="opacity-30" />}
      footer={
        <button
          onClick={startAdd}
          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          + Add entry
        </button>
      }
    >
      <div className="flex flex-col gap-3 min-h-[320px]">
        {/* Day selector (hidden in showAll mode) */}
        {!showAll && (
          <div className="flex items-center gap-1 shrink-0">
            {DAY_LETTER.map((letter, i) => (
              <span
                key={i}
                onClick={() => handleDayClick(i)}
                className={`flex-1 h-8 rounded-md text-[11px] font-medium flex items-center justify-center transition-colors cursor-pointer ${
                  i === selectedDay
                    ? 'border border-[var(--border-subtle)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] border border-transparent hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {letter}
              </span>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        <AnimatePresence>
          {(isAdding || editingId) && (
            <div className="border border-[var(--border-subtle)] rounded-lg p-3 space-y-2.5 mb-1">
              <Input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Entry title (e.g. Linear Algebra)"
                autoFocus
                className="bg-[var(--color-card)] border-[var(--border-subtle)] text-[13px] h-9"
              />
              <div className="flex items-center gap-2">
                <Input
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="Location (optional)"
                  className="flex-1 bg-[var(--color-card)] border-[var(--border-subtle)] text-[13px] h-9"
                />
                <Select value={form.day} onValueChange={v => setForm(p => ({ ...p, day: v }))} className="w-[90px]">
                  {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{DAY_SHORT[i]}</SelectItem>)}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <Input type="time" value={form.start} onChange={e => setForm(p => ({ ...p, start: e.target.value }))} className="bg-[var(--color-card)] border-[var(--border-subtle)] text-[13px] h-9" />
                  <span className="text-[var(--text-muted)] text-xs">to</span>
                  <Input type="time" value={form.end} onChange={e => setForm(p => ({ ...p, end: e.target.value }))} className="bg-[var(--color-card)] border-[var(--border-subtle)] text-[13px] h-9" />
                </div>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as ScheduleCategory }))} className="w-[110px]">
                  {(Object.keys(CATEGORY_LABELS) as ScheduleCategory[]).map(cat => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </Select>
              </div>
              {linkedGoals && linkedGoals.length > 0 && (
                <select
                  value={form.goalId}
                  onChange={e => setForm(p => ({ ...p, goalId: e.target.value }))}
                  aria-label="Link schedule block to goal"
                  className="h-8 min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--color-card)] px-2 text-[11px] text-[var(--text-secondary)] outline-none"
                >
                  <option value="">No linked goal</option>
                  {linkedGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                </select>
              )}
              <div className="flex items-center gap-2 justify-end">
                <Button size="sm" onClick={handleSave} className="text-[12px] h-8 border border-[var(--border-subtle)] hover:border-[var(--page-accent)]/40">
                  {editingId ? 'Save' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { resetForm(); setIsAdding(false); setEditingId(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px] h-8">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Schedule List */}
        <div className="flex-1 space-y-2 min-h-0 overflow-y-auto">
          {/* Current block */}
          {currentEntry && isToday && (
            <div className="relative p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-muted)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: theme.accent }} />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{currentEntry.title}</span>
                    {showAll && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
                        {DAY_SHORT[currentEntry.day_of_week]}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] shrink-0">
                      NOW
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {formatTime(currentEntry.start_time)} – {formatTime(currentEntry.end_time)}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatDuration(currentEntry.start_time, currentEntry.end_time)}</span>
                    {currentEntry.location && (
                      <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                        <MapPin size={10} />{currentEntry.location}
                      </span>
                    )}
                    {currentEntry.goal_id && <EntityChip kind="goal" label={linkedGoals?.find(g => g.id === currentEntry.goal_id)?.title || 'Linked goal'} />}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(currentEntry)} className="w-6 h-6 rounded border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
                    <Edit3 size={10} />
                  </button>
                  <button onClick={() => handleDelete(currentEntry.id)} className={`w-6 h-6 rounded flex items-center justify-center transition-colors border ${deleteConfirmId === currentEntry.id ? 'border-[var(--error)] text-[var(--error)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--error)]'}`}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming blocks */}
          {upcomingEntries.map((entry) => {
            const minsUntil = getMinutesUntil(entry.start_time);
            return (
              <div key={entry.id} className="group p-3 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)] flex items-center gap-1">
                        {CATEGORY_ICONS[entry.category || 'other']}
                        {CATEGORY_LABELS[entry.category || 'other']}
                      </span>
                      {showAll && (
                        <span className="text-[10px] text-[var(--text-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)] shrink-0">
                          {DAY_SHORT[entry.day_of_week]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatDuration(entry.start_time, entry.end_time)}</span>
                      {entry.location && (
                        <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1"><MapPin size={10} />{entry.location}</span>
                      )}
                      {entry.goal_id && <EntityChip kind="goal" label={linkedGoals?.find(g => g.id === entry.goal_id)?.title || 'Linked goal'} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isToday && minsUntil > 0 && minsUntil < 180 && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono border border-[var(--border-subtle)] px-1.5 py-0.5 rounded">
                        in {minsUntil}m
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(entry)} className="w-6 h-6 rounded border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors">
                        <Edit3 size={10} />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className={`w-6 h-6 rounded flex items-center justify-center transition-colors border ${deleteConfirmId === entry.id ? 'border-[var(--error)] text-[var(--error)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--error)]'}`}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Past entries */}
          {isToday && pastEntries.length > 0 && (
            <div className="pt-2">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium mb-1.5 px-1">Completed today</div>
              {pastEntries.map(entry => (
                <div key={entry.id} className="flex items-center gap-2 p-2 rounded-md opacity-50">
                  <div className="w-1 h-1 rounded-full shrink-0 bg-[var(--text-muted)]" />
                  <span className="text-[12px] text-[var(--text-muted)] flex-1">{entry.title}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{formatTime(entry.start_time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}

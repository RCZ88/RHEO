// ============================================================
// DeskFlow — MonthWall (3D Month Calendar)
// Gold Page → Life Phases → Schedule section
// Single unified calendar: goals, deadlines, reminders, schedule
// LAMINAR: depth-as-brightness, gloss-as-behavior (moving specular)
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, X, CalendarDays, Sun,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { CATEGORY_COLORS, getCategoryColor } from '../../lib/CategoryColors';
import { Select, SelectItem } from '../ui/select';
import type { Goal, Deadline, Reminder, ScheduleEntry } from '../../../components/dashboard/types';


const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STORAGE_KEY = 'df-monthwall-events';

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function localDateKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return localDateKey(d);
}

export interface WallEvent {
  id: string;
  date: string;
  title: string;
  category: string;
  time?: string;
  source: 'manual' | 'goal' | 'deadline' | 'reminder' | 'schedule';
  createdAt: string;
}

export interface MonthWallProps {
  onMonthChange?: (month: string) => void;
  goals?: Goal[];
  deadlines?: Deadline[];
  reminders?: Reminder[];
  schedule?: ScheduleEntry[];
  longTermGoals?: import('../../../types/goals').LongTermGoal[];
  onAddGoal?: (title: string, dueDate?: string) => void;
  onAddReminder?: (text: string, dueDate?: string) => void;
  renderDay?: (dayData: { date: string; events: WallEvent[]; isToday: boolean; isPast: boolean }) => React.ReactNode;
}

function loadEvents(): WallEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) => e && typeof e.title === 'string' && typeof e.date === 'string');
  } catch { return []; }
}

function saveEvents(events: WallEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch { /* silent */ }
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function getEventsForDay(events: WallEvent[], date: string): WallEvent[] {
  return events.filter(e => e.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

function deriveEvents(goals: Goal[], deadlines: Deadline[], reminders: Reminder[], schedule: ScheduleEntry[], longTermGoals: any[]): WallEvent[] {
  const events: WallEvent[] = [];
  for (const g of goals) {
    const d = g.deadline || g.date;
    if (!d) continue;
    events.push({ id: `g-${g.id}`, date: localDateKeyFromDate(d), title: g.title, category: g.category || 'work', time: undefined, source: 'goal', createdAt: g.createdAt });
  }
  for (const d of deadlines) {
    if (!d.due_date || d.status === 'completed') continue;
    events.push({ id: `dl-${d.id}`, date: localDateKeyFromDate(d.due_date), title: d.title, category: 'work', time: undefined, source: 'deadline', createdAt: d.createdAt });
  }
  for (const r of reminders) {
    if (!r.due_date || r.done) continue;
    events.push({ id: `rm-${r.id}`, date: localDateKeyFromDate(r.due_date), title: r.text, category: 'personal', time: undefined, source: 'reminder', createdAt: r.created_at });
  }
  for (const s of schedule) {
    const d = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    events.push({ id: `sc-${s.id}`, date: d, title: `${s.title} ${s.start_time}-${s.end_time}`, category: s.category || 'work', time: s.start_time, source: 'schedule', createdAt: s.createdAt });
  }
  for (const l of longTermGoals) {
    if (!l.deadline) continue;
    events.push({ id: `ltg-${l.id}`, date: localDateKeyFromDate(l.deadline), title: l.title, category: l.category || 'work', time: undefined, source: 'goal', createdAt: '' });
  }
  return events;
}

export function MonthWall({ onMonthChange, renderDay, goals = [], deadlines = [], reminders = [], schedule = [], longTermGoals = [] }: MonthWallProps) {
  const [userEvents, setUserEvents] = useState<WallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', category: 'work', time: '' });
  const undoRef = useRef<WallEvent | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const wallRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 3D tilt — flat resting, drag-orbit earns tilt
  // Write transforms directly to DOM via refs+rAF so Vite never bundles
  // template literals as static strings.
  const [tiltX, setTiltX] = useState(4);
  const [tiltY, setTiltY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showFlat, setShowFlat] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const tiltRef = useRef({ x: 4, y: 0 });
  const rafRef = useRef<number>(0);

  // reduced motion
  const reducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches; };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Derive real-data events every render
  const realEvents = useMemo(() => deriveEvents(goals, deadlines, reminders, schedule, longTermGoals), [goals, deadlines, reminders, schedule, longTermGoals]);

  // Merge real + user events (user events override same-source by id)
  const events = useMemo(() => {
    const map = new Map<string, WallEvent>();
    for (const e of realEvents) { if (!map.has(e.id)) map.set(e.id, e); }
    for (const e of userEvents) { map.set(e.id, e); }
    return Array.from(map.values());
  }, [realEvents, userEvents]);

  useEffect(() => {
    try { setUserEvents(loadEvents()); setError(null); } catch (e: any) { setError(e?.message || 'Could not load month events'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!undoId) return; const t = setTimeout(() => setUndoId(null), 5000); return () => clearTimeout(t); }, [undoId]);
  useEffect(() => { if (openDate) { const t = setTimeout(() => inputRef.current?.focus(), 60); return () => clearTimeout(t); } }, [openDate]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  useEffect(() => { onMonthChange?.(`${year}-${String(month + 1).padStart(2, '0')}`); }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const todayKey = localDateKey(new Date());

  const eventsByDate = useMemo(() => {
    const map: Record<string, WallEvent[]> = {};
    for (const e of events) { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return map;
  }, [events]);

  const nav = (dir: number) => setViewDate(new Date(year, month + dir, 1));
  const goToday = () => setViewDate(new Date());

  const addEvent = useCallback(() => {
    if (!openDate || !form.title.trim()) return;
    const ev: WallEvent = { id: crypto.randomUUID(), date: openDate, title: form.title.trim(), category: form.category || 'work', time: form.time || undefined, source: 'manual', createdAt: new Date().toISOString() };
    const next = [...userEvents, ev];
    setUserEvents(next);
    saveEvents(next);
    setForm({ title: '', category: 'work', time: '' });
    setOpenDate(null);
  }, [openDate, form, userEvents]);

  const deleteEvent = useCallback((id: string) => {
    const target = events.find(e => e.id === id);
    if (target) undoRef.current = target;
    setUndoId(id);
    const next = events.filter(e => e.id !== id);
    setUserEvents(next);
    saveEvents(next);
  }, [events]);

  const undoDelete = useCallback(() => {
    const target = undoRef.current;
    if (target) { const next = [...userEvents, target]; setUserEvents(next); saveEvents(next); }
    setUndoId(null);
    undoRef.current = null;
  }, [userEvents]);

  const openDay = (date: string) => { setOpenDate(date); setForm({ title: '', category: 'work', time: '' }); };
  const dayEvents = openDate ? getEventsForDay(events, openDate) : [];

  const hueFor = useCallback((category: string): string => {
    const style = getCategoryColor(category);
    return style?.bg || style?.border || 'var(--color-muted-foreground)';
  }, []);

  const applyTilt = useCallback((nx: number, ny: number) => {
    tiltRef.current = { x: nx, y: ny };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const { x, y } = tiltRef.current;
      if (containerRef.current) {
        containerRef.current.style.transform = showFlat ? 'none' : `rotateX(${x}deg) rotateY(${y}deg)`;
      }
      setTiltX(x);
      setTiltY(y);
    });
  }, [showFlat]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (showFlat) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const ny = Math.max(-35, Math.min(35, tiltRef.current.y + dx * 0.1));
    const nx = Math.max(0, Math.min(30, tiltRef.current.x - dy * 0.1));
    applyTilt(nx, ny);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setShowReset(Math.abs(nx) > 8 || Math.abs(ny) > 8);
  }, [isDragging, applyTilt]);

  const onPointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStart.current = null;
  };

  const resetTilt = () => {
    tiltRef.current = { x: 4, y: 0 };
    applyTilt(4, 0);
    setShowReset(false);
    setShowFlat(false);
  };

  // Sync flat→perspective toggle and initial tilt to DOM on mount/toggle
  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transform = showFlat ? 'none' : `rotateX(${tiltRef.current.x}deg) rotateY(${tiltRef.current.y}deg)`;
    }
  }, [showFlat]);




  const reactiveTransition = reducedMotion.current
    ? '0ms'
    : 'background-color 140ms cubic-bezier(0.16,1,0.3,1), border-color 140ms cubic-bezier(0.16,1,0.3,1)';
  // TODO(M-1): unify with app motion-preference

  const dots = dayEvents.slice(0, 2);
  const overflow = dayEvents.length - dots.length;
  const renderCell = (day: Date, key: string, isToday: boolean, isPast: boolean, list: WallEvent[]) => {
    if (renderDay) return renderDay({ date: key, events: list, isToday, isPast });
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => openDay(key)}
        className="relative h-11 rounded-[8px] border flex flex-col items-center justify-center cursor-pointer"
        style={{ transition: reactiveTransition }}
        aria-label={day.toLocaleDateString()}
      >
        <span className={`text-[11px] leading-none tabular-nums ${isToday ? 'font-bold' : 'font-medium'}`}>{day.getDate()}</span>
        {list.length > 0 ? (
          <div className="flex items-center gap-0.5 mt-1">
            {dots.map(d => (
              <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hueFor(d.category) }} />
            ))}
            {overflow > 0 && <span className="text-[9px] leading-none text-zinc-500">+{overflow}</span>}
          </div>
        ) : (
          <span className="mt-1 h-1.5 w-1.5 rounded-full opacity-0 group-hover:opacity-60" style={{ backgroundColor: 'var(--page-accent)' }} />
        )}
      </motion.button>
    );
  };

  return (
    <div
      data-monthwall="wall"
      className="relative rounded-[12px] overflow-hidden border border-zinc-800/50 bg-zinc-900/30 p-5"

    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--page-accent)' }}>
            <CalendarDays size={15} style={{ color: 'var(--page-accent)' }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-100">Month Wall</h3>
            <p className="text-[11px] text-zinc-500">{events.length === 0 ? 'Tap a day to add an event' : `${events.length} event${events.length > 1 ? 's' : ''} on this view`}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <motion.button whileTap={{ scale: 0.9 }} onClick={goToday}
            className="h-8 px-2 rounded-[8px] bg-zinc-800/50 text-[11px] text-zinc-300 hover:text-white border border-zinc-700/50 hover:border-zinc-600">
            Today
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => nav(-1)}
            className="w-8 h-8 rounded-[8px] bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white border border-zinc-700/50" aria-label="Previous month">
            <ChevronLeft size={14} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => nav(1)}
            className="w-8 h-8 rounded-[8px] bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white border border-zinc-700/50" aria-label="Next month">
            <ChevronRight size={14} />
          </motion.button>

        </div>
      </div>

      {/* Month nav */}
      <nav aria-label="Month" className="flex items-center justify-center gap-2 mb-3">
        <button onClick={() => nav(-1)} aria-label="Previous month" className="h-7 w-7 rounded-[6px] border border-zinc-800 text-zinc-400 hover:text-white">‹</button>
        <span className="text-[13px] font-semibold text-zinc-200 tabular-nums">{MONTHS[month]} {year}</span>
        <button onClick={() => nav(1)} aria-label="Next month" className="h-7 w-7 rounded-[6px] border border-zinc-800 text-zinc-400 hover:text-white">›</button>
      </nav>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="flex items-center gap-1 text-[9px] text-zinc-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: hueFor('deadline') }} />Deadline</span>
        <span className="flex items-center gap-1 text-[9px] text-zinc-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: hueFor('reminder') }} />Reminder</span>
        <span className="flex items-center gap-1 text-[9px] text-zinc-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: hueFor('goal') }} />Goal</span>
        <span className="flex items-center gap-1 text-[9px] text-zinc-500"><span className="w-1.5 h-1.5 rounded-full" style={{ background: hueFor('schedule') }} />Schedule</span>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-[10px] mb-1">
        {DAY_LETTER.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-zinc-600 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* States */}
      {loading ? (
        <div className="space-y-1.5" data-monthwall-state="loading">
          <div className="grid grid-cols-7 gap-[10px]">{Array.from({ length: 42 }).map((_, i) => <div key={i} className="h-11 rounded-[8px] bg-zinc-800/40" />)}</div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-10 text-center" data-monthwall-state="error">
          <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-2"><CalendarDays size={22} className="text-zinc-600" /></div>
          <p className="text-[13px] font-medium text-zinc-400">Could not load month</p>
          <p className="text-[11px] text-zinc-600 mt-1 max-w-[240px]">{error}</p>
        </div>
      ) : (
        <div ref={wallRef} className="relative" aria-label="Month calendar"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            ref={containerRef}
            className="relative"
            style={{ transformStyle: 'preserve-3d' }}
            onPointerDown={onPointerDown}
          >
            <div className="grid grid-cols-7 gap-[10px]" style={{ transformStyle: 'preserve-3d', padding: 10 }}>
              {grid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-11" />;
                const key = localDateKey(day);
                const isToday = key === todayKey;
                const isPast = key < todayKey;
                const row = Math.floor(idx / 7);
                const rowOffset = row - 2.5;
                const z = Math.max(-64, 48 - Math.abs(rowOffset) * 16);
                const brightness = isPast ? 0.75 : isToday ? 1 : 0.55;
                const list = eventsByDate[key] || [];

                return (
                  <Popover key={key} open={openDate === key} onOpenChange={(o) => (o ? openDay(key) : setOpenDate(null))}>
                    <PopoverTrigger asChild>
                      <div
                        style={{
                          transform: showFlat ? 'none' : `translateZ(${z}px)`,
                          zIndex: Math.round(100 - Math.abs(rowOffset)),
                          transition: reactiveTransition,
                        }}
                        className={`h-11 rounded-[8px] border cursor-pointer
                          ${isToday ? 'border-zinc-700/60' : isPast ? 'border-zinc-800/50' : 'border-zinc-800/40'}`}
                      >
                        <div className="relative h-full rounded-[8px] flex flex-col items-center justify-center p-1"
                          style={{
                            background: isPast ? 'var(--color-card)' : 'var(--color-background)',
                          }}>
                          <span className={`text-[11px] leading-none tabular-nums ${isToday ? 'font-bold text-zinc-100' : isPast ? 'text-zinc-500' : 'text-zinc-400'}`}>{day.getDate()}</span>
                          {list.length > 0 ? (
                            <div className="flex items-center gap-0.5 mt-0.5 flex-wrap justify-center">
                              {dots.map(d => (
                                <span key={d.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hueFor(d.category) }} />
                              ))}
                              {overflow > 0 && <span className="text-[8px] text-zinc-500">+{overflow}</span>}
                            </div>
                          ) : (
                            <span className="mt-0.5 h-1 w-1 rounded-full opacity-0 group-hover:opacity-40" style={{ backgroundColor: 'var(--page-accent)' }} />
                          )}
                        </div>
                        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'var(--hairline)' }} />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-zinc-900 border-zinc-800 text-zinc-200">
                      <DayPanel date={day} events={getEventsForDay(events, key)} hueFor={hueFor} form={form} setForm={setForm} onSave={addEvent} onDelete={deleteEvent} inputRef={inputRef} />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty CTA */}
      {!loading && !error && events.length === 0 && (
        <div className="mt-3 flex justify-center">
          <button onClick={() => openDay(todayKey)} className="px-3 py-1.5 rounded-[8px] border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors text-[11px] font-medium flex items-center gap-1">
            <Plus size={11} /> Add today's event
          </button>
        </div>
      )}

      {/* Undo pill */}
      <AnimatePresence>
        {undoId && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3 py-2 rounded-[12px] bg-zinc-800 border border-zinc-700">
            <span className="text-[11px] text-zinc-300">Event deleted</span>
            <button onClick={undoDelete} className="text-[11px] font-medium text-zinc-200 hover:text-white">Undo</button>
            <button onClick={() => setUndoId(null)} className="text-zinc-500 hover:text-zinc-300"><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Day popover panel ── */
interface DayPanelProps {
  date: Date;
  events: WallEvent[];
  hueFor: (cat: string) => string;
  form: { title: string; category: string; time: string };
  setForm: (f: any) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function DayPanel({ date, events, hueFor, form, setForm, onSave, onDelete, inputRef }: DayPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const monthName = MONTHS[date.getMonth()];
  const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });
  const categoryKeys = Object.keys(CATEGORY_COLORS as Record<string, string>);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-zinc-100">{dayName}</p>
          <p className="text-[11px] text-zinc-500">{monthName} {date.getDate()}</p>
        </div>
        {events.length > 0 && <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded-[8px]">{events.length} event{events.length > 1 ? 's' : ''}</span>}
      </div>
      {events.length === 0 ? (
        <div className="py-2 flex items-center justify-center"><div className="flex items-center gap-1.5 text-zinc-600 text-[11px]"><Sun size={12} /> No events — add one below</div></div>
      ) : (
        <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
          {events.map(e => (
            <div key={e.id} className="group flex items-center gap-2 p-2 rounded-[8px] bg-zinc-900/60 border border-zinc-800/60">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hueFor(e.category) }} />
              <span className="flex-1 min-w-0"><span className="block text-[12px] text-zinc-200 truncate">{e.title}</span>
                <span className="text-[9px] text-zinc-500 uppercase">{e.source}</span>
                {e.time && <span className="block text-[10px] text-zinc-500 font-mono">{e.time}</span>}
              </span>
              <button onClick={() => { if (deletingId === e.id) { onDelete(e.id); setDeletingId(null); } else { setDeletingId(e.id); setTimeout(() => setDeletingId(p => p === e.id ? null : p), 3000); } }}
                className={`w-6 h-6 rounded flex items-center justify-center ${deletingId === e.id ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800/50 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100'}`} aria-label={`Delete ${e.title}`}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="pt-2 border-t border-zinc-800/60 space-y-2">
        <input ref={inputRef} value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') onSave(); }} placeholder="Event title" className="w-full h-8 px-2 rounded-[8px] bg-zinc-900/80 border border-zinc-700/50 focus:border-zinc-600 outline-none text-[12px] text-zinc-200 placeholder:text-zinc-600" />
        <div className="flex items-center gap-2">
          <Select value={form.category} onValueChange={(v: any) => setForm((p: any) => ({ ...p, category: v }))} className="flex-1 h-8">
            {categoryKeys.map(cat => <SelectItem key={cat} value={cat}><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: hueFor(cat) }} />{cat}</span></SelectItem>)}
          </Select>
          <input type="time" value={form.time || ''} onChange={e => setForm((p: any) => ({ ...p, time: e.target.value }))} className="h-8 px-2 rounded-[8px] bg-zinc-900/80 border border-zinc-700/50 outline-none text-[11px] text-zinc-300 w-[72px]" aria-label="Event time (optional)" />
        </div>
        <button onClick={onSave} disabled={!form.title.trim()} className="w-full h-8 rounded-[8px] flex items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-40 bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-zinc-600">
          <Plus size={12} /> Add event
        </button>
      </div>
    </div>
  );
}

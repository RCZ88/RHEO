"use client"

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { WarmCard } from '../../features/warmth/WarmCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Calendar, Clock, MapPin, Plus, X, Trash2, Pencil, ChevronLeft, ChevronRight,
  BookOpen, FlaskConical, Brain, FileText, Users, MoreHorizontal, GripVertical,
  Link2, Target, Zap, ExternalLink, Sun, Moon, Sunrise
} from 'lucide-react'

type ScheduleCategory = 'class' | 'lab' | 'study' | 'exam' | 'meeting' | 'other'

interface ScheduleEntry {
  id: string
  title: string
  location?: string
  day_of_week: number
  start_time: string
  end_time: string
  category?: ScheduleCategory
  color?: string
  goal_id?: string
  createdAt: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const COLORS = ['#22d3ee', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']

const CATEGORY_CONFIG: Record<ScheduleCategory, { icon: React.ReactNode; label: string; color: string }> = {
  class: { icon: <BookOpen size={12} />, label: 'Class', color: '#22d3ee' },
  lab: { icon: <FlaskConical size={12} />, label: 'Lab', color: '#10b981' },
  study: { icon: <Brain size={12} />, label: 'Study', color: '#8b5cf6' },
  exam: { icon: <FileText size={12} />, label: 'Exam', color: '#ef4444' },
  meeting: { icon: <Users size={12} />, label: 'Meeting', color: '#f59e0b' },
  other: { icon: <MoreHorizontal size={12} />, label: 'Other', color: '#71717a' },
}

const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => i + 6) // 6AM to 11PM

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDuration(start: string, end: string): string {
  const mins = parseTime(end) - parseTime(start)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function getTimeIcon(hour: number): React.ReactNode {
  if (hour < 12) return <Sunrise size={12} className="text-amber-400" />
  if (hour < 17) return <Sun size={12} className="text-amber-300" />
  return <Moon size={12} className="text-indigo-400" />
}

// ── Entry Form ──
function EntryForm({ open, onOpenChange, initial, onSave, goals }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: ScheduleEntry | null
  onSave: (data: Omit<ScheduleEntry, 'id' | 'createdAt'>) => void
  goals: { id: string; title: string }[]
}) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [day, setDay] = useState(0)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [category, setCategory] = useState<ScheduleCategory>('class')
  const [color, setColor] = useState(COLORS[0])
  const [goalId, setGoalId] = useState('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setTitle(initial.title)
      setLocation(initial.location || '')
      setDay(initial.day_of_week)
      setStart(initial.start_time)
      setEnd(initial.end_time)
      setCategory(initial.category || 'class')
      setColor(initial.color || COLORS[0])
      setGoalId(initial.goal_id || '')
    } else {
      setTitle('')
      setLocation('')
      setDay(new Date().getDay())
      setStart('09:00')
      setEnd('10:00')
      setCategory('class')
      setColor(COLORS[0])
      setGoalId('')
    }
  }, [open, initial])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      location: location.trim() || undefined,
      day_of_week: day,
      start_time: start,
      end_time: end,
      category,
      color,
      goal_id: goalId || undefined,
    })
    onOpenChange(false)
  }

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity", open ? "opacity-100" : "opacity-0 pointer-events-none")} onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-lg bg-zinc-900/95 border border-zinc-700 rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-100 mb-4">{initial ? 'Edit entry' : 'New entry'}</h3>
        <div className="space-y-3.5">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="text-[14px]" />
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" className="text-[13px]" />

          {/* Day picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Day</label>
            <div className="flex gap-1">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => setDay(i)} className={cn("flex-1 h-9 rounded-lg text-[11px] font-medium transition-colors", day === i ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:text-zinc-200")}>
                  {DAY_LETTER[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">Start</label>
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} className="text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">End</label>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="text-[13px]" />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORY_CONFIG) as ScheduleCategory[]).map(cat => (
                <button key={cat} onClick={() => { setCategory(cat); setColor(CATEGORY_CONFIG[cat].color) }} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors", category === cat ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-300")}>
                  {CATEGORY_CONFIG[cat].icon}
                  {CATEGORY_CONFIG[cat].label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-500">Color</label>
            <div className="flex gap-1.5">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className={cn("w-7 h-7 rounded-full border-2 transition-all", color === c ? "border-white scale-110" : "border-transparent hover:scale-105")} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Goal link */}
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">Link to Goal</label>
              <select value={goalId} onChange={e => setGoalId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 text-[13px] focus:outline-none focus:ring-1 focus:ring-amber-500/50">
                <option value="">None</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => onOpenChange(false)} className="h-9 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim()} className="h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-4 text-sm text-amber-100 disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Weekly Calendar Grid ──
function WeeklyGrid({ entries, selectedDay, onEdit, onDelete, nowMinutes }: {
  entries: ScheduleEntry[]
  selectedDay: number
  onEdit: (entry: ScheduleEntry) => void
  onDelete: (id: string) => void
  nowMinutes: number
}) {
  const dayEntries = useMemo(() =>
    entries.filter(e => e.day_of_week === selectedDay).sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)),
    [entries, selectedDay]
  )

  const currentEntry = dayEntries.find(e => {
    const start = parseTime(e.start_time)
    const end = parseTime(e.end_time)
    return nowMinutes >= start && nowMinutes < end
  })

  return (
    <div className="relative">
      {/* Time indicator */}
      {selectedDay === new Date().getDay() && (
        <div className="absolute left-0 right-0 z-10 flex items-center gap-2 pointer-events-none" style={{ top: `${((nowMinutes - 360) / (18 * 60)) * 100}%` }}>
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="h-px flex-1 bg-amber-400/40" />
        </div>
      )}

      {/* Time slots */}
      <div className="space-y-0">
        {TIME_SLOTS.map(hour => {
          const slotEntries = dayEntries.filter(e => {
            const start = parseTime(e.start_time)
            const end = parseTime(e.end_time)
            return start < (hour + 1) * 60 && end > hour * 60
          })

          return (
            <div key={hour} className="flex gap-3 min-h-[60px] group">
              {/* Time label */}
              <div className="w-16 shrink-0 flex items-start justify-end gap-1.5 pt-1">
                {getTimeIcon(hour)}
                <span className="text-[11px] text-zinc-500 font-mono">{formatTime(`${hour}:00`)}</span>
              </div>

              {/* Slot content */}
              <div className="flex-1 border-t border-zinc-800/40 relative">
                {slotEntries.map(entry => {
                  const start = parseTime(entry.start_time)
                  const end = parseTime(entry.end_time)
                  const top = ((start - hour * 60) / 60) * 60
                  const height = Math.max(((end - start) / 60) * 60, 30)
                  const cat = CATEGORY_CONFIG[entry.category || 'other']
                  const isCurrent = currentEntry?.id === entry.id

                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn("absolute left-0 right-2 rounded-lg border p-2 cursor-pointer group/card transition-all hover:ring-1 hover:ring-white/20", isCurrent && "ring-2 ring-amber-400/50")}
                      style={{ top, height, backgroundColor: `${entry.color || cat.color}15`, borderColor: `${entry.color || cat.color}30` }}
                      onClick={() => onEdit(entry)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-zinc-100 truncate">{entry.title}</p>
                          {entry.location && <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1"><MapPin size={9} />{entry.location}</p>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="opacity-0 group-hover/card:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity shrink-0">
                          <X size={12} />
                        </button>
                      </div>
                      {height > 40 && (
                        <p className="text-[10px] text-zinc-500 mt-1">{formatDuration(entry.start_time, entry.end_time)} · {cat.label}</p>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ScheduleTab ──
export function ScheduleTab() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [nowMinutes, setNowMinutes] = useState(new Date().getHours() * 60 + new Date().getMinutes())
  const [goals, setGoals] = useState<{ id: string; title: string }[]>([])
  const [viewMode, setViewMode] = useState<'week' | 'day'>('day')

  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(new Date().getHours() * 60 + new Date().getMinutes()), 60000)
    return () => clearInterval(interval)
  }, [])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const api = (window as any).deskflowAPI
      const res = await api?.getSchedule?.()
      if (res?.entries) setEntries(res.entries)
    } catch {}
    setLoading(false)
  }, [])

  const loadGoals = useCallback(async () => {
    try {
      const api = (window as any).deskflowAPI
      const res = await api?.getLongtermGoals?.()
      if (res?.goals) setGoals(res.goals.map((g: any) => ({ id: g.id, title: g.title || 'Untitled Goal' })))
    } catch {}
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])
  useEffect(() => { loadGoals() }, [loadGoals])

  const handleAdd = async (data: Omit<ScheduleEntry, 'id' | 'createdAt'>) => {
    const api = (window as any).deskflowAPI
    await api?.addScheduleEntry?.(data)
    loadEntries()
  }

  const handleUpdate = async (id: string, patch: Partial<ScheduleEntry>) => {
    const api = (window as any).deskflowAPI
    await api?.updateScheduleEntry?.(id, patch)
    loadEntries()
  }

  const handleDelete = async (id: string) => {
    if (deleteConfirmId === id) {
      const api = (window as any).deskflowAPI
      await api?.deleteScheduleEntry?.(id)
      setDeleteConfirmId(null)
      loadEntries()
    } else {
      setDeleteConfirmId(id)
      setTimeout(() => setDeleteConfirmId(prev => prev === id ? null : prev), 3000)
    }
  }

  const handleSave = (data: Omit<ScheduleEntry, 'id' | 'createdAt'>) => {
    if (editingEntry) { handleUpdate(editingEntry.id, data) }
    else { handleAdd(data) }
    setEditingEntry(null)
  }

  // Stats
  const totalEntries = entries.length
  const todayEntries = entries.filter(e => e.day_of_week === new Date().getDay()).length
  const weekEntries = entries.length
  const categoryStats = useMemo(() => {
    const map = new Map<ScheduleCategory, number>()
    entries.forEach(e => { const cat = e.category || 'other'; map.set(cat, (map.get(cat) || 0) + 1) })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [entries])

  return (
    <div className="space-y-4" data-lifephase="schedule-tab">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-pink-400/10"><Calendar size={14} className="text-pink-400" /></div>
          <h2 className="warmth-serif text-lg text-zinc-200">Schedule</h2>
          <span className="text-[11px] text-zinc-600">{totalEntries} entries</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-zinc-700/50 overflow-hidden">
            <button onClick={() => setViewMode('day')} className={cn("px-3 py-1.5 text-[11px] font-medium transition-colors", viewMode === 'day' ? "bg-amber-500/20 text-amber-300" : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200")}>Day</button>
            <button onClick={() => setViewMode('week')} className={cn("px-3 py-1.5 text-[11px] font-medium transition-colors", viewMode === 'week' ? "bg-amber-500/20 text-amber-300" : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-200")}>Week</button>
          </div>
          <button onClick={() => { setEditingEntry(null); setEditorOpen(true) }} className="flex items-center gap-1.5 h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 px-3 text-sm text-amber-100 hover:bg-amber-400/25 transition-colors"><Plus size={13} /> New</button>
        </div>
      </div>

      {/* Day selector */}
      <div className="flex gap-1.5">
        {DAYS.map((d, i) => {
          const dayCount = entries.filter(e => e.day_of_week === i).length
          const isToday = i === new Date().getDay()
          return (
            <button key={i} onClick={() => setSelectedDay(i)} className={cn("flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium transition-all border", selectedDay === i ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "border-zinc-700/30 bg-zinc-900/30 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30")}>
              <span className={cn("text-[10px]", isToday && "text-amber-400")}>{DAY_SHORT[i]}</span>
              <span className="text-[18px] font-semibold leading-none">{i === new Date().getDay() ? new Date().getDate() : '·'}</span>
              {dayCount > 0 && <span className="text-[9px] text-zinc-600">{dayCount}</span>}
            </button>
          )
        })}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        <span>{todayEntries} today</span>
        <span>·</span>
        <span>{weekEntries} this week</span>
        <span>·</span>
        {categoryStats.slice(0, 3).map(([cat, count]) => (
          <span key={cat} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_CONFIG[cat].color }} />
            {count}
          </span>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 animate-pulse rounded-lg border border-zinc-800/50 bg-zinc-900/40" />)}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-[13px] text-zinc-500">No schedule entries yet</p>
          <p className="text-[11px] text-zinc-600 mt-1">Add your first entry to start planning</p>
        </div>
      ) : viewMode === 'day' ? (
        <WeeklyGrid entries={entries} selectedDay={selectedDay} onEdit={(e) => { setEditingEntry(e); setEditorOpen(true) }} onDelete={handleDelete} nowMinutes={nowMinutes} />
      ) : (
        // Week view - show all days
        <div className="space-y-4">
          {DAYS.map((d, i) => {
            const dayEntries = entries.filter(e => e.day_of_week === i).sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time))
            if (dayEntries.length === 0) return null
            const isToday = i === new Date().getDay()
            return (
              <div key={i} className={cn("rounded-xl border p-3", isToday ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800/40 bg-zinc-900/20")}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-[12px] font-medium", isToday ? "text-amber-300" : "text-zinc-300")}>{d}</span>
                  <span className="text-[10px] text-zinc-600">{dayEntries.length} entries</span>
                </div>
                <div className="space-y-1.5">
                  {dayEntries.map(entry => {
                    const cat = CATEGORY_CONFIG[entry.category || 'other']
                    return (
                      <div key={entry.id} onClick={() => { setEditingEntry(entry); setEditorOpen(true) }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer hover:bg-zinc-800/30 transition-colors" style={{ borderColor: `${entry.color || cat.color}20` }}>
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: entry.color || cat.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">{entry.title}</p>
                          <p className="text-[10px] text-zinc-500">{formatTime(entry.start_time)} - {formatTime(entry.end_time)} · {cat.label}</p>
                        </div>
                        {entry.location && <MapPin size={10} className="text-zinc-600 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor */}
      {editorOpen && <EntryForm open={editorOpen} onOpenChange={(open) => { if (!open) setEditingEntry(null); setEditorOpen(open) }} initial={editingEntry} onSave={handleSave} goals={goals} />}
    </div>
  )
}

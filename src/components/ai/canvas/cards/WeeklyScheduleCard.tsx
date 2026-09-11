import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Goal } from '../../../services/GoalStore'
import { Calendar, Clock, CheckCircle2, Plus, Trash2, X } from 'lucide-react'

interface WeeklyScheduleCardProps { weekOffset?: number }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CATEGORY_COLORS: Record<string, string> = { work: '#22d3ee', personal: '#4ade80', health: '#f87171', learning: '#a78bfa', class: '#fbbf24', lab: '#fb923c' }
const CATEGORY_OPTIONS = Object.keys(CATEGORY_COLORS)

export function WeeklyScheduleCard({ weekOffset = 0 }: WeeklyScheduleCardProps) {
  const [schedule, setSchedule] = useState<any[]>([])
  const [goalsByDay, setGoalsByDay] = useState<Record<string, Goal[]>>({})
  const [loading, setLoading] = useState(true)
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newEntry, setNewEntry] = useState({ title: '', start_time: '09:00', end_time: '10:00', category: 'class', location: '' })

  const weekDates = useMemo(() => {
    const now = new Date(); now.setDate(now.getDate() - now.getDay() + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10) })
  }, [weekOffset])

  const reloadSchedule = useCallback(() => {
    const api = (window as any).deskflowAPI; if (!api) return
    api.getSchedule?.().then((r: any) => {
      setSchedule(r?.entries || (Array.isArray(r) ? r : []))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const api = (window as any).deskflowAPI; if (!api) { setLoading(false); return }
    Promise.all([
      api.getSchedule?.().then((r: any) => r?.entries || (Array.isArray(r) ? r : [])).catch(() => []),
      api.getGoalsBatch?.(weekDates[0], weekDates[6]).then((r: any) => {
        if (r?.days) { const m: Record<string, Goal[]> = {}; for (const d of r.days) m[d.date] = d.goals || []; return m }
        if (typeof r === 'object' && !Array.isArray(r)) return r; return {}
      }).catch(() => ({})),
    ]).then(([s, g]) => { setSchedule(s); setGoalsByDay(g); setLoading(false) })
  }, [weekDates])

  const handleAddEntry = useCallback(async (dayOfWeek: number) => {
    if (!newEntry.title.trim()) return
    const api = (window as any).deskflowAPI; if (!api?.addScheduleEntry) return
    const color = CATEGORY_COLORS[newEntry.category] || '#a1a1aa'
    const result = await api.addScheduleEntry({
      title: newEntry.title.trim(),
      location: newEntry.location.trim() || null,
      day_of_week: dayOfWeek,
      start_time: newEntry.start_time,
      end_time: newEntry.end_time,
      category: newEntry.category,
      color,
    })
    if (result?.success) {
      setNewEntry({ title: '', start_time: '09:00', end_time: '10:00', category: 'class', location: '' })
      setAddingDay(null)
      reloadSchedule()
    }
  }, [newEntry, reloadSchedule])

  const handleDeleteEntry = useCallback(async (id: string) => {
    const api = (window as any).deskflowAPI; if (!api?.deleteScheduleEntry) return
    const result = await api.deleteScheduleEntry(id)
    if (result?.success) reloadSchedule()
  }, [reloadSchedule])

  const dayColumns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return weekDates.map(date => {
      const dayIdx = new Date(date).getDay()
      const daySchedule = schedule.filter((s: any) => s.day_of_week === dayIdx)
      const dayGoals = goalsByDay[date] || []
      const completed = dayGoals.filter(g => g.status === 'completed').length
      const total = dayGoals.length
      const timeGoals = dayGoals.filter(g => g.target?.type === 'time')
      const totalProgress = timeGoals.reduce((s, g) => s + (g.progressSeconds || 0), 0)
      const totalTarget = timeGoals.reduce((s, g) => s + (g.target?.targetSeconds || 3600), 0)
      const dayPct = totalTarget > 0 ? Math.min(100, Math.round((totalProgress / totalTarget) * 100)) : 0
      return { date, dayIdx, dayName: DAYS[dayIdx], isToday: date === today, schedule: daySchedule, goals: dayGoals, completed, total, dayPct }
    })
  }, [weekDates, schedule, goalsByDay])

  if (loading) return (
    <div className="dk-card dk-weekly-schedule">
      <div className="dk-card-header"><div className="dk-skeleton dk-skeleton-title" style={{ width: 140 }} /></div>
      <div className="dk-card-body"><div className="dk-weekly-grid">{Array.from({ length: 7 }).map((_, i) => (<div key={i} className="dk-weekly-day"><div className="dk-skeleton" style={{ width: '100%', height: 16, marginBottom: 8 }} /><div className="dk-skeleton" style={{ width: '80%', height: 32, marginBottom: 6 }} /><div className="dk-skeleton" style={{ width: '60%', height: 32 }} /></div>))}</div></div>
    </div>
  )

  return (
    <div className="dk-card dk-weekly-schedule">
      <div className="dk-card-header">
        <div className="dk-card-header-left"><Calendar size={16} color="var(--dk-accent)" /><span className="dk-card-title">Weekly Overview</span></div>
        <span className="dk-card-subtitle">{weekDates[0]} — {weekDates[6]}</span>
      </div>
      <div className="dk-card-body">
        <div className="dk-weekly-grid">
          {dayColumns.map(col => (
            <div key={col.date} className={`dk-weekly-day ${col.isToday ? 'today' : ''}`}>
              <div className="dk-weekly-day-header"><span className="dk-weekly-day-name">{col.dayName}</span><span className="dk-weekly-day-date">{col.date.slice(5)}</span></div>
              {col.total > 0 && (<div className="dk-weekly-day-progress"><div className="dk-progress-track-sm"><div className="dk-progress-fill-sm" style={{ transform: `scaleX(${col.total ? (col.completed / col.total) : 0})` }} /></div><span className="dk-weekly-day-progress-label">{col.completed}/{col.total}</span></div>)}
              <div className="dk-weekly-day-schedule">
                {col.schedule.map((s: any) => (
                  <div key={s.id} className="dk-weekly-block group/block" style={{ '--block-color': s.color || CATEGORY_COLORS[s.category] || '#a1a1aa' } as React.CSSProperties}>
                    <span className="dk-weekly-block-time"><Clock size={8} />{s.start_time}–{s.end_time}</span>
                    <span className="dk-weekly-block-title">{s.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEntry(s.id) }}
                      className="ml-auto opacity-0 group-hover/block:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 flex-shrink-0 light:text-stone-400"
                      title="Delete entry"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {col.schedule.length === 0 && addingDay !== col.dayIdx && <span className="dk-weekly-empty">No schedule</span>}

                {addingDay === col.dayIdx ? (
                  <div className="dk-weekly-add-form" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0' }}>
                    <input
                      value={newEntry.title}
                      onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
                      placeholder="Entry title..."
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleAddEntry(col.dayIdx); if (e.key === 'Escape') setAddingDay(null) }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#e4e4e7', outline: 'none', width: '100%' }}
                    />
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="time"
                        value={newEntry.start_time}
                        onChange={e => setNewEntry(p => ({ ...p, start_time: e.target.value }))}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 4px', fontSize: 10, color: '#a1a1aa', outline: 'none', width: 'fit-content' }}
                      />
                      <span style={{ fontSize: 10, color: '#52525b' }}>-</span>
                      <input
                        type="time"
                        value={newEntry.end_time}
                        onChange={e => setNewEntry(p => ({ ...p, end_time: e.target.value }))}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 4px', fontSize: 10, color: '#a1a1aa', outline: 'none', width: 'fit-content' }}
                      />
                    </div>
                    <select
                      value={newEntry.category}
                      onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '3px 6px', fontSize: 10, color: '#a1a1aa', outline: 'none' }}
                    >
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleAddEntry(col.dayIdx)}
                        disabled={!newEntry.title.trim()}
                        style={{ flex: 1, padding: '4px 0', borderRadius: 4, fontSize: 10, fontWeight: 600, background: newEntry.title.trim() ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)', color: newEntry.title.trim() ? '#22d3ee' : '#52525b', border: 'none', cursor: newEntry.title.trim() ? 'pointer' : 'default' }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAddingDay(null)}
                        style={{ padding: '4px 8px', borderRadius: 4, fontSize: 10, background: 'rgba(255,255,255,0.04)', color: '#71717a', border: 'none', cursor: 'pointer' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingDay(col.dayIdx)}
                    className="dk-weekly-add-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, fontSize: 10, color: '#52525b', background: 'transparent', border: '1px dashed rgba(255,255,255,0.08)', cursor: 'pointer', width: '100%', justifyContent: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)'; e.currentTarget.style.color = '#22d3ee' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#52525b' }}
                  >
                    <Plus size={10} /> Add
                  </button>
                )}
              </div>
              {col.goals.length > 0 && (<div className="dk-weekly-day-goals">{col.goals.map(g => (<div key={g.id} className={`dk-weekly-goal-pill ${g.status === 'completed' ? 'done' : ''}`} style={{ '--pill-color': CATEGORY_COLORS[g.category] || '#a1a1aa' } as React.CSSProperties} title={g.title}>{g.status === 'completed' && <CheckCircle2 size={8} />}<span className="dk-weekly-goal-pill-text">{g.title}</span></div>))}</div>)}
              {col.dayPct > 0 && <span className="dk-weekly-day-pct">{col.dayPct}% time</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

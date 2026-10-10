import { useState, useEffect, useCallback } from 'react'
import { DeadlineItem } from './DeadlineItem'
import type { Goal } from '../../../services/GoalStore'
import { CalendarClock, Plus, X } from 'lucide-react'

interface Deadline { id: string; title: string; course?: string; due_date: string; priority: string; status: string; description?: string; category?: string }

export function DeadlineTrackerCard({ days = 14 }: { days?: number }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [linkedMap, setLinkedMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newDeadline, setNewDeadline] = useState({ title: '', due_date: '', priority: 'medium', course: '', description: '' })

  const reload = useCallback(() => {
    const api = (window as any).deskflowAPI; if (!api) { setLoading(false); return }
    Promise.all([
      api.getDeadlines?.({ days }).then((r: any) => r?.deadlines || (Array.isArray(r) ? r : [])).catch(() => []),
      api.getGoals?.(new Date().toISOString().slice(0, 10)).then((r: any) => r?.goals || (Array.isArray(r) ? r : [])).catch(() => []),
    ]).then(([dl, gl]) => {
      setDeadlines(dl); setGoals(gl)
      const map: Record<string, string> = {}
      for (const g of gl) { if (!g.links) continue; try { const links = Array.isArray(g.links) ? g.links : JSON.parse(g.links || '[]'); for (const l of links) { if (l.label) { const match = dl.find((d: Deadline) => d.title === l.label); if (match) map[match.id] = g.id } } } catch {} }
      setLinkedMap(map); setLoading(false)
    })
  }, [days])

  useEffect(() => { reload() }, [reload])

  const handleAddDeadline = useCallback(async () => {
    if (!newDeadline.title.trim() || !newDeadline.due_date) return
    const api = (window as any).deskflowAPI; if (!api?.addDeadline) return
    try {
      const result = await api.addDeadline({
        title: newDeadline.title.trim(),
        due_date: newDeadline.due_date,
        priority: newDeadline.priority,
        course: newDeadline.course.trim() || undefined,
        description: newDeadline.description.trim() || undefined,
        status: 'pending',
      })
      if (result?.success !== false) {
        setNewDeadline({ title: '', due_date: '', priority: 'medium', course: '', description: '' })
        setShowAdd(false)
        reload()
      }
    } catch { setError('Failed to add deadline'); setTimeout(() => setError(null), 3000) }
  }, [newDeadline, reload])

  const createGoalFromDeadline = useCallback(async (deadlineTitle: string) => {
    const api = (window as any).deskflowAPI; if (!api?.saveGoal) return
    const dl = deadlines.find(d => d.title === deadlineTitle); if (!dl) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      await api.saveGoal(today, { title: `Prepare for: ${dl.title}`, description: `Deadline: ${dl.title}${dl.course ? ` (${dl.course})` : ''}`, category: dl.course ? 'work' : 'learning', target: { type: 'completion' }, status: 'pending', source: 'ai', links: [{ label: dl.title, url: '' }] })
      const updated = await api.getGoals?.(today); const updatedGoals = updated?.goals || (Array.isArray(updated) ? updated : []); setGoals(updatedGoals)
      const map: Record<string, string> = {}
      for (const g of updatedGoals) { if (!g.links) continue; try { const links = Array.isArray(g.links) ? g.links : JSON.parse(g.links || '[]'); for (const l of links) { if (l.label) { const match = deadlines.find(d => d.title === l.label); if (match) map[match.id] = g.id } } } catch {} }
      setLinkedMap(map)
    } catch { setError('Failed to create goal'); setTimeout(() => setError(null), 3000) }
  }, [deadlines])

  const sorted = [...deadlines].filter(d => d.status !== 'done').sort((a, b) => {
    const pa = { high: 0, medium: 1, low: 2 }[a.priority] ?? 99; const pb = { high: 0, medium: 1, low: 2 }[b.priority] ?? 99
    if (pa !== pb) return pa - pb; return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  if (loading) return (
    <div className="dk-card dk-deadline-tracker">
      <div className="dk-card-header"><div className="dk-skeleton dk-skeleton-title" style={{ width: 100 }} /></div>
      <div className="dk-card-body"><div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} /><div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} /><div className="dk-skeleton" style={{ width: '90%', height: 48 }} /></div>
    </div>
  )

  return (
    <div className="dk-card dk-deadline-tracker">
      <div className="dk-card-header">
        <div className="dk-card-header-left"><CalendarClock size={16} color="var(--dk-accent)" /><span className="dk-card-title">Deadlines</span></div>
        <div className="dk-card-header-right">
          <span className="dk-card-badge">{sorted.length} upcoming</span>
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 10px', borderRadius: 6, fontSize: 11, color: showAdd ? '#f87171' : '#52525b', background: showAdd ? 'rgba(248,113,113,0.1)' : 'transparent', border: '1px solid var(--dk-chip-edge)', cursor: 'pointer', transition: 'all 0.15s', marginLeft: 8 }}
          >
            {showAdd ? <X size={11} /> : <Plus size={11} />}
            {showAdd ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>
      <div className="dk-card-body">
        {showAdd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', marginBottom: 12, borderBottom: '1px solid var(--dk-chip)' }}>
            <input
              value={newDeadline.title}
              onChange={e => setNewDeadline(p => ({ ...p, title: e.target.value }))}
              placeholder="Deadline title..."
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddDeadline(); if (e.key === 'Escape') setShowAdd(false) }}
              style={{ background: 'var(--dk-chip)', border: '1px solid var(--dk-chip-edge)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#e4e4e7', outline: 'none', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                value={newDeadline.due_date}
                onChange={e => setNewDeadline(p => ({ ...p, due_date: e.target.value }))}
                style={{ background: 'var(--dk-chip)', border: '1px solid var(--dk-chip-edge)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#a1a1aa', outline: 'none' }}
              />
              <select
                value={newDeadline.priority}
                onChange={e => setNewDeadline(p => ({ ...p, priority: e.target.value }))}
                style={{ background: 'var(--dk-chip)', border: '1px solid var(--dk-chip-edge)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#a1a1aa', outline: 'none' }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={newDeadline.course}
                onChange={e => setNewDeadline(p => ({ ...p, course: e.target.value }))}
                placeholder="Course / category (optional)"
                style={{ background: 'var(--dk-chip)', border: '1px solid var(--dk-chip-edge)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#a1a1aa', outline: 'none', flex: 1 }}
              />
              <button
                onClick={handleAddDeadline}
                disabled={!newDeadline.title.trim() || !newDeadline.due_date}
                style={{ padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: (newDeadline.title.trim() && newDeadline.due_date) ? 'rgba(248,113,113,0.15)' : 'var(--dk-chip-edge)', color: (newDeadline.title.trim() && newDeadline.due_date) ? '#f87171' : '#52525b', border: 'none', cursor: (newDeadline.title.trim() && newDeadline.due_date) ? 'pointer' : 'default', transition: 'all 0.15s' }}
              >
                Add Deadline
              </button>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="dk-empty-state"><CalendarClock size={28} color="var(--dk-text-faint)" /><p>No upcoming deadlines.</p>
            <button
              onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Plus size={12} /> Add your first deadline
            </button>
          </div>
        ) : (
          <div className="dk-deadline-list">
            {sorted.map(dl => {
              const linkedGoalId = linkedMap[dl.id]
              const linkedGoal = linkedGoalId ? goals.find(g => g.id === linkedGoalId) : undefined
              return <DeadlineItem key={dl.id} id={dl.id} title={dl.title} course={dl.course} dueDate={dl.due_date} priority={dl.priority} status={dl.status} linkedGoalStatus={linkedGoal?.status} onCreateGoal={createGoalFromDeadline} />
            })}
          </div>
        )}
        {error && <span className="dk-error-text">{error}</span>}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { GoalTimeline } from './GoalTimeline'
import { GoalItem } from './GoalItem'
import { useGoalProgress } from '../../../../hooks/useGoalProgress'
import { useFocusGoals } from '../../../../hooks/useFocusGoals'
import { ExternalAIBridgeField } from '../../../../features/content-engine/components/ExternalAIBridgeField'
import { useFocusGroups } from '../../../../hooks/useFocusGroups'
import { setActiveGroup } from '../../../../hooks/useActiveFocusGroup'
import type { Goal } from '../../../../services/GoalStore'
import { CalendarDays, Sparkles, ChevronDown, ChevronRight, Target, AlertCircle, Loader2, Plus, X } from 'lucide-react'

interface DailyPlannerCardProps { date?: string }

export function DailyPlannerCard({ date = new Date().toISOString().slice(0, 10) }: DailyPlannerCardProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [review, setReview] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalCategory, setNewGoalCategory] = useState('work')
  const [newGoalTargetMinutes, setNewGoalTargetMinutes] = useState(60)

  const { progressMap, refetch: refetchProgress } = useGoalProgress(date, goals)
  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals)
  const { selected: selectedGroup } = useFocusGroups()

  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) { setLoading(false); return }
    Promise.all([
      api.getGoals?.(date).then((r: any) => r?.goals || (Array.isArray(r) ? r : [])).catch(() => []),
      api.getSchedule?.().then((r: any) => r?.entries || (Array.isArray(r) ? r : [])).catch(() => []),
      api.getDeadlines?.({ days: 7 }).then((r: any) => r?.deadlines || (Array.isArray(r) ? r : [])).catch(() => []),
      api.getGoalReview?.(date).then((r: any) => r?.review_summary || null).catch(() => null),
    ]).then(([g, s, d, r]) => { setGoals(g); setSchedule(s); setDeadlines(d); setReview(r); setLoading(false) })
  }, [date])

  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.saveGoal) return
    const approaching = deadlines.filter((d: any) => { const days = (new Date(d.due_date).getTime() - Date.now()) / 86400000; return days > 0 && days <= 3 && d.status !== 'done' })
    const pendingCount = goals.filter(g => g.status === 'pending' || g.status === 'in-progress').length
    for (const dl of approaching) {
      const exists = goals.some(g => g.links?.some((l: any) => l.label === dl.title))
      if (exists || pendingCount >= 5) continue
      api.saveGoal(date, { title: `Prepare for: ${dl.title}`, description: `Deadline: ${dl.title}`, category: dl.course ? 'work' : 'learning', target: { type: 'completion' }, status: 'suggested', source: 'ai', links: [{ label: dl.title, url: '' }] }).catch(() => {})
    }
  }, [deadlines, goals, date])

  const toggleGoal = useCallback(async (goal: Goal) => {
    const api = (window as any).deskflowAPI
    if (!api?.saveGoal) return
    const isDone = goal.status === 'completed'
    const newStatus = isDone ? 'in-progress' : 'completed'
    try {
      await api.saveGoal(goal.date, { ...goal, status: newStatus, completedAt: !isDone ? new Date().toISOString() : undefined })
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: newStatus } : g))
      refetchProgress()
    } catch { setError('Failed to update goal'); setTimeout(() => setError(null), 3000) }
  }, [date, refetchProgress])

  const startFocus = useCallback((goal: Goal) => {
    const api = (window as any).deskflowAPI
    if (!api?.focus?.start) return
    const remaining = Math.max(60, (goal.target?.targetSeconds || 3600) - (goal.progressSeconds || 0))
    if (selectedGroup && api.focusGroup?.startWith) {
      api.focusGroup.startWith(selectedGroup.id, remaining, 'distracting').then((r: any) => {
        if (r?.sessionId != null) {
          setActiveGroup({
            sessionId: Number(r.sessionId),
            groupId: selectedGroup.id,
            allowedCategories: (selectedGroup.allowed_categories || []).map(String),
            startedAt: Date.now(),
          })
        }
      })
    } else {
      api.focus.start({ durationSec: remaining, strictness: 'distracting' })
    }
  }, [selectedGroup])

  const handleSuggest = useCallback(async () => {
    if (!canRequestSuggestion()) { setError('Rate limited. Try again later.'); setTimeout(() => setError(null), 3000); return }
    setSuggesting(true); setError(null)
    try {
      const api = (window as any).deskflowAPI
      const ctx = await buildSuggestionContext(date, api)
      const result = await api.suggestGoals?.(date, ctx)
      const suggestions = result?.suggestions || (Array.isArray(result) ? result : [])
      if (suggestions.length) {
        for (const sg of suggestions) await api.saveGoal?.(date, { ...sg, status: 'suggested', source: 'ai' })
        const updated = await api.getGoals?.(date)
        setGoals(updated?.goals || (Array.isArray(updated) ? updated : []))
      }
    } catch (e: any) { setError(e.message || 'Failed to suggest goals') } finally { setSuggesting(false) }
  }, [date])

  const handleAddManualGoal = useCallback(async () => {
    if (!newGoalTitle.trim()) return
    const api = (window as any).deskflowAPI; if (!api?.saveGoal) return
    const goal = {
      title: newGoalTitle.trim(),
      category: newGoalCategory,
      status: 'in-progress' as const,
      source: 'manual',
      target: { type: 'time' as const, targetSeconds: newGoalTargetMinutes * 60 },
    }
    try {
      await api.saveGoal(date, goal)
      const updated = await api.getGoals?.(date)
      setGoals(updated?.goals || (Array.isArray(updated) ? updated : []))
      setNewGoalTitle('')
      setShowAddGoal(false)
    } catch { setError('Failed to add goal'); setTimeout(() => setError(null), 3000) }
  }, [date, newGoalTitle, newGoalCategory, newGoalTargetMinutes])

  const handleDeleteGoal = useCallback(async (goalId: string) => {
    const api = (window as any).deskflowAPI; if (!api?.deleteGoal) return
    try {
      await api.deleteGoal(goalId)
      const updated = await api.getGoals?.(date)
      setGoals(updated?.goals || (Array.isArray(updated) ? updated : []))
    } catch { setError('Failed to delete goal'); setTimeout(() => setError(null), 3000) }
  }, [date])

  const todaySchedule = useMemo(() => { const d = new Date(date).getDay(); return schedule.filter((s: any) => s.day_of_week === d) }, [schedule, date])
  const completedCount = goals.filter(g => g.status === 'completed').length
  const totalGoals = goals.length
  const overallPct = totalGoals ? Math.round((completedCount / totalGoals) * 100) : 0

  if (loading) return (
    <div className="dk-card dk-daily-planner">
      <div className="dk-card-header"><div className="dk-skeleton dk-skeleton-title" style={{ width: 120 }} /><div className="dk-skeleton" style={{ width: 60, height: 14 }} /></div>
      <div className="dk-card-body"><div className="dk-skeleton" style={{ width: '100%', height: 200, marginBottom: 12 }} /><div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} /><div className="dk-skeleton" style={{ width: '100%', height: 48 }} /></div>
    </div>
  )

  if (error && !goals.length && !schedule.length) return (
    <div className="dk-card dk-daily-planner">
      <div className="dk-card-header"><span className="dk-card-title"><CalendarDays size={16} /> Daily Planner</span></div>
      <div className="dk-card-body"><div className="dk-empty-state"><AlertCircle size={32} color="var(--dk-danger)" /><p>Failed to load planner data.</p><button className="dk-btn-secondary" onClick={() => window.location.reload()}>Retry</button></div></div>
    </div>
  )

  return (
    <div className="dk-card dk-daily-planner">
      <div className="dk-card-header">
        <div className="dk-card-header-left">
          <CalendarDays size={16} color="var(--dk-accent)" />
          <span className="dk-card-title">Daily Planner</span>
          <span className="dk-card-subtitle">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>
        <div className="dk-card-header-right">
          <div className="dk-planner-stats"><Target size={12} /><span>{completedCount}/{totalGoals}</span></div>
          {focusState?.isActive && !focusState.isBroken && <span className="dk-focus-indicator"><span className="dk-focus-dot" />Focusing</span>}
        </div>
      </div>

      <div className="dk-planner-overall">
        <div className="dk-progress-track"><div className="dk-progress-fill" style={{ transform: `scaleX(${overallPct / 100})` }} /></div>
        <span className="dk-progress-label">{overallPct}% done</span>
      </div>

      <div className="dk-card-section">
        <span className="dk-section-label">Timeline</span>
        <GoalTimeline schedule={todaySchedule} goals={[]} currentTime={new Date()} />
      </div>

      <div className="dk-card-section">
        <div className="dk-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Goals</span>
          <button
            onClick={() => setShowAddGoal(!showAddGoal)}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4, fontSize: 10, color: showAddGoal ? '#22d3ee' : '#52525b', background: showAddGoal ? 'rgba(34,211,238,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {showAddGoal ? <X size={10} /> : <Plus size={10} />}
            {showAddGoal ? 'Cancel' : 'Add Goal'}
          </button>
        </div>

        {showAddGoal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={newGoalTitle}
              onChange={e => setNewGoalTitle(e.target.value)}
              placeholder="What do you want to accomplish?"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddManualGoal(); if (e.key === 'Escape') setShowAddGoal(false) }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#e4e4e7', outline: 'none', width: '100%' }}
            />
            <ExternalAIBridgeField
              fieldName="title"
              label="Goal"
              value={newGoalTitle}
              onUpdate={setNewGoalTitle}
              allFields={{ title: newGoalTitle, category: newGoalCategory, targetMinutes: String(newGoalTargetMinutes) }}
              category="goals"
              context="Help define a clear daily goal with measurable outcome"
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={newGoalCategory}
                onChange={e => setNewGoalCategory(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#a1a1aa', outline: 'none' }}
              >
                <option value="work">Work</option>
                <option value="learning">Learning</option>
                <option value="personal">Personal</option>
                <option value="health">Health</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min={5}
                  max={300}
                  step={5}
                  value={newGoalTargetMinutes}
                  onChange={e => setNewGoalTargetMinutes(Number(e.target.value))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 6px', fontSize: 11, color: '#a1a1aa', outline: 'none', width: 50 }}
                />
                <span style={{ fontSize: 10, color: '#52525b' }}>min</span>
              </div>
              <button
                onClick={handleAddManualGoal}
                disabled={!newGoalTitle.trim()}
                style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: newGoalTitle.trim() ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)', color: newGoalTitle.trim() ? '#22d3ee' : '#52525b', border: 'none', cursor: newGoalTitle.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {goals.length === 0 ? (
          <div className="dk-empty-state"><Target size={28} color="var(--dk-text-faint)" /><p>No goals yet.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="dk-btn-primary" onClick={() => setShowAddGoal(true)}>
                <Plus size={14} /> Add Goal
              </button>
              <button className="dk-btn-primary" onClick={handleSuggest} disabled={suggesting}>
                {suggesting ? <Loader2 size={14} className="dk-spin" /> : <Sparkles size={14} />}
                {suggesting ? 'Thinking...' : 'Suggest Goals'}
              </button>
            </div>
          </div>
        ) : (
          <div className="dk-goal-list">
            {goals.map(goal => (
              <GoalItem key={goal.id} goal={goal}
                progressSeconds={(progressMap[goal.id]?.progressSeconds || 0) + getAccumulatedSeconds(goal.id)}
                isActive={activeGoalIds.includes(goal.id)}
                onToggle={toggleGoal}
                onFocus={goal.target?.type === 'time' && goal.target?.matchCategory ? startFocus : undefined}
                onDelete={handleDeleteGoal} />
            ))}
          </div>
        )}
      </div>

      {goals.length > 0 && (
        <div className="dk-card-footer">
          <button className="dk-btn-primary" onClick={() => setShowAddGoal(true)}>
            <Plus size={14} /> Add Goal
          </button>
          <button className="dk-btn-primary" onClick={handleSuggest} disabled={suggesting}>
            {suggesting ? <Loader2 size={14} className="dk-spin" /> : <Sparkles size={14} />}
            {suggesting ? 'Thinking...' : 'Suggest Goals'}
          </button>
          {error && <span className="dk-error-text">{error}</span>}
        </div>
      )}

      {review && (
        <div className="dk-card-section">
          <button className="dk-review-toggle" onClick={() => setShowReview(!showReview)}>
            <span>End-of-Day Review</span>{showReview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showReview && <div className="dk-review-content">{review}</div>}
        </div>
      )}
    </div>
  )
}

function canRequestSuggestion(): boolean {
  try {
    const key = 'df_goal_suggest_requests'; const raw = localStorage.getItem(key)
    const requests: number[] = raw ? JSON.parse(raw) : []; const now = Date.now()
    const recent = requests.filter(t => t > now - 3600000)
    if (recent.length >= 10) return false; recent.push(now); localStorage.setItem(key, JSON.stringify(recent)); return true
  } catch { return true }
}

async function buildSuggestionContext(date: string, api: any): Promise<string> {
  const parts: string[] = [`Today is ${date}.`]
  try { const s = await api.getSchedule(); const d = new Date(date).getDay(); const today = s.filter((x: any) => x.day_of_week === d); if (today.length) { parts.push("Today's schedule:"); for (const x of today) parts.push(`- ${x.start_time}-${x.end_time}: ${x.title}`) } } catch {}
  try { const dl = await api.getDeadlines({ days: 7 }); const approaching = dl.filter((d: any) => { const days = (new Date(d.due_date).getTime() - Date.now()) / 86400000; return days > 0 && days <= 3 }); if (approaching.length) { parts.push('Approaching deadlines:'); for (const d of approaching) parts.push(`- ${d.title} (due ${d.due_date.slice(0, 10)})`) } } catch {}
  parts.push('Suggest 3-5 daily goals that fit the schedule, address deadlines, and balance categories. Each goal should have a realistic time target (30min to 3h).')
  return parts.join('\n')
}

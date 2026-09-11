Kimi: This is a substantial feature. I'll generate the complete implementation spec — hooks, components, services, and integration — all using existing infrastructure only.

---

## Part 1: Data Layer (Hooks)

### File: `src/hooks/useGoalProgress.ts` (NEW)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Goal } from '../types'

const POLL_INTERVAL_MS = 30000

interface GoalProgress {
  goalId: string
  progressSeconds: number
  targetSeconds: number
  percentComplete: number
  status: 'pending' | 'active' | 'completed' | 'overdue'
}

export function useGoalProgress(date: string, goals: Goal[]) {
  const [progressMap, setProgressMap] = useState<Record<string, GoalProgress>>({})
  const [loading, setLoading] = useState(true)
  const timeBasedGoals = goals.filter(g => g.target_type === 'time' && g.match_category)
  const abortRef = useRef<AbortController | null>(null)

  const computeProgress = useCallback(async () => {
    if (timeBasedGoals.length === 0) {
      setProgressMap({})
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      // Fetch today's logs via existing IPC
      const logs = await (window as any).deskflowAPI['get-logs-by-period'](date, date)
      if (!Array.isArray(logs)) return

      // Aggregate duration by category
      const categorySeconds: Record<string, number> = {}
      for (const log of logs) {
        const cat = log.category?.toLowerCase() || 'uncategorized'
        const sec = Math.floor((log.duration_ms || 0) / 1000)
        categorySeconds[cat] = (categorySeconds[cat] || 0) + sec
      }

      // Map to goals
      const map: Record<string, GoalProgress> = {}
      for (const goal of timeBasedGoals) {
        const matchCat = (goal.match_category || '').toLowerCase()
        const progressSec = categorySeconds[matchCat] || 0
        const targetSec = goal.target_seconds || 3600
        const pct = Math.min(100, Math.round((progressSec / targetSec) * 100))

        map[goal.id] = {
          goalId: goal.id,
          progressSeconds: progressSec,
          targetSeconds: targetSec,
          percentComplete: pct,
          status: pct >= 100 ? 'completed' : progressSec > 0 ? 'active' : 'pending',
        }
      }

      setProgressMap(map)
    } catch (e) {
      // Silently fail — progress is best-effort
    } finally {
      setLoading(false)
    }
  }, [date, timeBasedGoals])

  // Initial fetch + polling
  useEffect(() => {
    computeProgress()
    const interval = setInterval(computeProgress, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [computeProgress])

  return { progressMap, loading, refetch: computeProgress }
}
```

---

### File: `src/hooks/useFocusGoals.ts` (NEW)

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Goal } from '../types'

interface FocusState {
  isActive: boolean
  isBroken: boolean
  allowedCategories: string[]
  sessionId?: string
}

interface FocusGoalProgress {
  goalId: string
  accumulatedSeconds: number
  lastTickAt: number
}

const TICK_MS = 1000

export function useFocusGoals(goals: Goal[]) {
  const [focusState, setFocusState] = useState<FocusState | null>(null)
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([])
  const progressRef = useRef<Record<string, FocusGoalProgress>>({})
  const tickRef = useRef<number | null>(null)
  const timeBasedGoals = goals.filter(g => g.target_type === 'time' && g.match_category)

  // Listen to focus state events from main process
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.onFocusStateChange) return

    const unsubscribe = api.onFocusStateChange((state: any) => {
      const newState: FocusState = {
        isActive: state?.outcome === 'active',
        isBroken: state?.outcome === 'failed' || !!state?.broke_on_type,
        allowedCategories: state?.allowed_json ? JSON.parse(state.allowed_json).categories || [] : [],
        sessionId: state?.id,
      }
      setFocusState(newState)
    })

    return () => unsubscribe?.()
  }, [])

  // Determine which goals match current focus
  useEffect(() => {
    if (!focusState?.isActive || focusState.isBroken) {
      setActiveGoalIds([])
      return
    }

    const allowed = focusState.allowedCategories.map((c: string) => c.toLowerCase())
    const matched = timeBasedGoals
      .filter(g => allowed.includes((g.match_category || '').toLowerCase()))
      .map(g => g.id)

    setActiveGoalIds(matched)

    // Initialize progress tracking for matched goals
    for (const id of matched) {
      if (!progressRef.current[id]) {
        progressRef.current[id] = {
          goalId: id,
          accumulatedSeconds: 0,
          lastTickAt: Date.now(),
        }
      }
    }
  }, [focusState, timeBasedGoals])

  // Tick every second when focus is active
  useEffect(() => {
    if (activeGoalIds.length === 0) {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }

    tickRef.current = window.setInterval(() => {
      const now = Date.now()
      for (const id of activeGoalIds) {
        const prog = progressRef.current[id]
        if (prog) {
          prog.accumulatedSeconds += TICK_MS / 1000
          prog.lastTickAt = now
        }
      }
    }, TICK_MS)

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [activeGoalIds])

  // Persist accumulated progress when focus ends
  const persistProgress = useCallback(async () => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return

    for (const [id, prog] of Object.entries(progressRef.current)) {
      if (prog.accumulatedSeconds < 1) continue

      const goal = goals.find(g => g.id === id)
      if (!goal) continue

      const newProgress = (goal.progress_seconds || 0) + Math.floor(prog.accumulatedSeconds)
      try {
        await api['save-goal'](goal.date, {
          ...goal,
          progress_seconds: newProgress,
          status: newProgress >= (goal.target_seconds || 3600) ? 'completed' : 'active',
        })
      } catch (e) {
        console.error('Failed to persist goal progress:', e)
      }
    }

    progressRef.current = {}
  }, [goals])

  // Auto-persist when focus state goes from active to inactive
  useEffect(() => {
    if (!focusState && Object.keys(progressRef.current).length > 0) {
      persistProgress()
    }
  }, [focusState, persistProgress])

  const getAccumulatedSeconds = useCallback((goalId: string): number => {
    return Math.floor(progressRef.current[goalId]?.accumulatedSeconds || 0)
  }, [])

  return {
    focusState,
    activeGoalIds,
    getAccumulatedSeconds,
    persistProgress,
  }
}
```

---

## Part 2: UI Components

### File: `src/components/ai/canvas/cards/GoalTimeline.tsx` (NEW)

```tsx
import { useMemo } from 'react'

interface ScheduleEntry {
  id: string
  title: string
  start_time: string // "HH:MM"
  end_time: string   // "HH:MM"
  color?: string
  category?: string
}

interface TimelineGoal {
  id: string
  title: string
  match_category?: string
  progress_seconds: number
  target_seconds: number
  category: string
}

interface GoalTimelineProps {
  schedule: ScheduleEntry[]
  goals: TimelineGoal[]
  currentTime?: Date
}

const START_HOUR = 6
const END_HOUR = 24
const HOUR_HEIGHT = 40
const TOTAL_HOURS = END_HOUR - START_HOUR

export function GoalTimeline({ schedule, goals, currentTime = new Date() }: GoalTimelineProps) {
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60
  const showCurrentTime = currentHour >= START_HOUR && currentHour <= END_HOUR

  const scheduleBlocks = useMemo(() => {
    return schedule.map(entry => {
      const [sh, sm] = entry.start_time.split(':').map(Number)
      const [eh, em] = entry.end_time.split(':').map(Number)
      const start = sh + sm / 60
      const end = eh + em / 60
      const top = Math.max(0, (start - START_HOUR) * HOUR_HEIGHT)
      const height = Math.min((end - start) * HOUR_HEIGHT, (END_HOUR - Math.max(start, START_HOUR)) * HOUR_HEIGHT)
      return { ...entry, top, height, start, end }
    }).filter(b => b.end > START_HOUR && b.start < END_HOUR)
  }, [schedule])

  const categoryColors: Record<string, string> = {
    work: '#22d3ee',
    personal: '#4ade80',
    health: '#f87171',
    learning: '#a78bfa',
    class: '#fbbf24',
    lab: '#fb923c',
    study: '#a78bfa',
  }

  return (
    <div className="dk-goal-timeline">
      <div className="dk-goal-timeline-labels">
        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i).map(h => (
          <div key={h} className="dk-goal-timeline-hour" style={{ top: i * HOUR_HEIGHT }}>
            <span>{h > 12 ? h - 12 : h}{h >= 12 ? 'pm' : 'am'}</span>
          </div>
        ))}
      </div>
      <div className="dk-goal-timeline-body">
        {/* Hour grid lines */}
        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
          <div key={i} className="dk-goal-timeline-line" style={{ top: i * HOUR_HEIGHT }} />
        ))}

        {/* Schedule blocks */}
        {scheduleBlocks.map(block => (
          <div
            key={block.id}
            className="dk-goal-timeline-block"
            style={{
              top: block.top,
              height: Math.max(block.height, 20),
              background: (block.color || categoryColors[block.category || 'class'] || '#22d3ee') + '25',
              borderLeft: `3px solid ${block.color || categoryColors[block.category || 'class'] || '#22d3ee'}`,
            }}
          >
            <span className="dk-goal-timeline-block-title">{block.title}</span>
            <span className="dk-goal-timeline-block-time">{block.start_time}-{block.end_time}</span>
          </div>
        ))}

        {/* Free time indicators */}
        {findGaps(scheduleBlocks).map((gap, i) => (
          <div
            key={`gap-${i}`}
            className="dk-goal-timeline-gap"
            style={{ top: gap.top, height: gap.height }}
          >
            <span>Available for goals</span>
          </div>
        ))}

        {/* Current time indicator */}
        {showCurrentTime && (
          <div
            className="dk-goal-timeline-now"
            style={{ top: (currentHour - START_HOUR) * HOUR_HEIGHT }}
          >
            <div className="dk-goal-timeline-now-dot" />
            <div className="dk-goal-timeline-now-line" />
          </div>
        )}
      </div>
    </div>
  )
}

function findGaps(blocks: Array<{ top: number; height: number }>): Array<{ top: number; height: number }> {
  if (blocks.length === 0) return [{ top: 0, height: TOTAL_HOURS * HOUR_HEIGHT }]
  const sorted = [...blocks].sort((a, b) => a.top - b.top)
  const gaps: Array<{ top: number; height: number }> = []
  let y = 0
  for (const block of sorted) {
    if (block.top > y + 2) {
      gaps.push({ top: y, height: block.top - y })
    }
    y = Math.max(y, block.top + block.height)
  }
  if (y < TOTAL_HOURS * HOUR_HEIGHT - 2) {
    gaps.push({ top: y, height: TOTAL_HOURS * HOUR_HEIGHT - y })
  }
  return gaps
}
```

---

### File: `src/components/ai/canvas/cards/GoalProgressBar.tsx` (NEW)

```tsx
interface GoalProgressBarProps {
  percent: number
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function GoalProgressBar({ percent, size = 'md', showLabel = true }: GoalProgressBarProps) {
  const color = percent >= 100 ? '#4ade80' : percent >= 50 ? '#fbbf24' : percent >= 25 ? '#fb923c' : '#f87171'

  return (
    <div className={`dk-progress-bar dk-progress-${size}`}>
      <div className="dk-progress-track">
        <div
          className="dk-progress-fill"
          style={{ width: `${Math.min(100, percent)}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="dk-progress-label" style={{ color }}>
          {percent >= 100 ? 'Done' : `${Math.round(percent)}%`}
        </span>
      )}
    </div>
  )
}
```

---

### File: `src/components/ai/canvas/cards/DailyPlannerCard.tsx` — **REPLACE**

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { GoalTimeline } from './GoalTimeline'
import { GoalProgressBar } from './GoalProgressBar'
import { useGoalProgress } from '../../../../hooks/useGoalProgress'
import { useFocusGoals } from '../../../../hooks/useFocusGoals'
import type { Goal } from '../../../../types'

interface DailyPlannerCardProps {
  date?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  work: '#22d3ee',
  personal: '#4ade80',
  health: '#f87171',
  learning: '#a78bfa',
}

const CATEGORY_LABELS: Record<string, string> = {
  work: 'Work',
  personal: 'Personal',
  health: 'Health',
  learning: 'Learning',
}

export function DailyPlannerCard({ date = new Date().toISOString().slice(0, 10) }: DailyPlannerCardProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [review, setReview] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { progressMap, refetch: refetchProgress } = useGoalProgress(date, goals)
  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals)

  // Fetch data
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) return

    api['get-goals'](date).then((g: Goal[]) => setGoals(g || [])).catch(() => setGoals([]))
    api['get-schedule']().then((s: any[]) => setSchedule(s || [])).catch(() => setSchedule([]))
    api['get-deadlines']({ days: 7 }).then((d: any[]) => setDeadlines(d || [])).catch(() => setDeadlines([]))
    api['get-goal-review'](date).then((r: any) => setReview(r?.summary || null)).catch(() => setReview(null))
  }, [date])

  // Auto-create goals from approaching deadlines
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return

    const approaching = deadlines.filter((d: any) => {
      const due = new Date(d.due_date).getTime()
      const now = Date.now()
      const days = (due - now) / 86400000
      return days > 0 && days <= 3 && d.status !== 'done'
    })

    for (const dl of approaching) {
      const exists = goals.some(g => g.links && JSON.parse(g.links || '[]').some((l: any) => l.label === dl.title))
      if (exists) continue
      if (goals.filter(g => g.status === 'pending' || g.status === 'active').length >= 5) break

      api['save-goal'](date, {
        title: `Prepare for: ${dl.title}`,
        description: `Deadline: ${dl.title}${dl.course ? ` (${dl.course})` : ''}`,
        category: dl.course ? 'work' : 'learning',
        target_type: 'completion',
        status: 'suggested',
        source: 'ai',
        links: JSON.stringify([{ label: dl.title, url: null }]),
      }).catch(() => {})
    }
  }, [deadlines, goals, date])

  // Suggest goals
  const handleSuggest = useCallback(async () => {
    if (!canRequestSuggestion()) {
      setError('Rate limited. Try again later.')
      setTimeout(() => setError(null), 3000)
      return
    }

    setSuggesting(true)
    setError(null)

    try {
      const api = (window as any).deskflowAPI
      const ctx = await buildSuggestionContext(date, api)
      const suggestions = await api['suggest-goals'](date, ctx)
      if (suggestions?.length) {
        for (const sg of suggestions) {
          await api['save-goal'](date, {
            ...sg,
            status: 'suggested',
            source: 'ai',
          })
        }
        const updated = await api['get-goals'](date)
        setGoals(updated || [])
      }
    } catch (e: any) {
      setError(e.message || 'Failed to suggest goals')
    } finally {
      setSuggesting(false)
    }
  }, [date])

  // Toggle goal status
  const toggleGoal = useCallback(async (goal: Goal) => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return

    const isDone = goal.status === 'completed'
    const newStatus = isDone ? 'active' : 'completed'
    const newProgress = isDone ? (goal.progress_seconds || 0) : (goal.target_seconds || 3600)

    try {
      await api['save-goal'](date, {
        ...goal,
        status: newStatus,
        progress_seconds: newProgress,
        completed_at: !isDone ? new Date().toISOString() : null,
      })
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: newStatus, progress_seconds: newProgress } : g))
      refetchProgress()
    } catch (e) {
      console.error('Failed to toggle goal:', e)
    }
  }, [date, refetchProgress])

  // Start focus for a goal
  const startFocus = useCallback((goal: Goal) => {
    const api = (window as any).deskflowAPI
    if (!api?.['focus:start']) return
    api['focus:start']({
      planned_sec: (goal.target_seconds || 3600) - (goal.progress_seconds || 0),
      strictness: 'distracting',
      allowed_json: JSON.stringify({ categories: [goal.match_category || goal.category] }),
    })
  }, [])

  // Timeline data
  const todaySchedule = useMemo(() => {
    const dayOfWeek = new Date(date).getDay()
    return schedule.filter((s: any) => s.day_of_week === dayOfWeek)
  }, [schedule, date])

  const timelineGoals = useMemo(() => {
    return goals.map(g => ({
      id: g.id,
      title: g.title,
      match_category: g.match_category,
      progress_seconds: (progressMap[g.id]?.progressSeconds || 0) + getAccumulatedSeconds(g.id),
      target_seconds: g.target_seconds || 3600,
      category: g.category,
    }))
  }, [goals, progressMap, getAccumulatedSeconds])

  const completedCount = goals.filter(g => g.status === 'completed').length
  const totalGoals = goals.length

  return (
    <div className="dk-daily-planner">
      {/* Header */}
      <div className="dk-daily-planner-header">
        <div>
          <span className="dk-daily-planner-title">Daily Planner</span>
          <span className="dk-daily-planner-date">
            {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="dk-daily-planner-stats">
          <span>{completedCount}/{totalGoals} done</span>
          {focusState?.isActive && !focusState.isBroken && (
            <span className="dk-daily-planner-focus">● Focusing</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="dk-daily-planner-overall">
        <div className="dk-daily-planner-bar">
          <div
            className="dk-daily-planner-fill"
            style={{ width: `${totalGoals ? (completedCount / totalGoals) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="dk-daily-planner-section">
        <span className="dk-daily-planner-label">Timeline</span>
        <GoalTimeline schedule={todaySchedule} goals={timelineGoals} />
      </div>

      {/* Goals */}
      <div className="dk-daily-planner-section">
        <span className="dk-daily-planner-label">Goals</span>
        {goals.length === 0 ? (
          <span className="dk-daily-planner-empty">No goals yet. Add some or get AI suggestions.</span>
        ) : (
          <div className="dk-daily-planner-goals">
            {goals.map(goal => {
              const progress = (progressMap[goal.id]?.progressSeconds || 0) + getAccumulatedSeconds(goal.id)
              const target = goal.target_seconds || 3600
              const pct = Math.min(100, Math.round((progress / target) * 100))
              const isActive = activeGoalIds.includes(goal.id)
              const color = CATEGORY_COLORS[goal.category] || '#a1a1aa'

              return (
                <div key={goal.id} className={`dk-daily-goal ${isActive ? 'active' : ''} ${goal.status === 'completed' ? 'completed' : ''}`}>
                  <button
                    className="dk-daily-goal-check"
                    onClick={() => toggleGoal(goal)}
                    title={goal.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {goal.status === 'completed' ? '✓' : '○'}
                  </button>
                  <div className="dk-daily-goal-main">
                    <div className="dk-daily-goal-title-row">
                      <span className="dk-daily-goal-dot" style={{ background: color }} />
                      <span className="dk-daily-goal-title">{goal.title}</span>
                      {goal.source === 'ai' && goal.status === 'suggested' && (
                        <span className="dk-daily-goal-badge">Suggested</span>
                      )}
                    </div>
                    {goal.target_type === 'time' ? (
                      <div className="dk-daily-goal-progress-row">
                        <GoalProgressBar percent={pct} size="sm" showLabel={false} />
                        <span className="dk-daily-goal-time">
                          {formatDuration(progress)} / {formatDuration(target)}
                        </span>
                      </div>
                    ) : (
                      <span className="dk-daily-goal-type">Completion goal</span>
                    )}
                  </div>
                  {goal.target_type === 'time' && goal.match_category && (
                    <button
                      className="dk-daily-goal-focus"
                      onClick={() => startFocus(goal)}
                      title="Start focus session"
                    >
                      ▶
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="dk-daily-planner-actions">
        <button
          className="dk-daily-planner-btn"
          onClick={handleSuggest}
          disabled={suggesting}
        >
          {suggesting ? 'Thinking...' : '✨ Suggest Goals'}
        </button>
        {error && <span className="dk-daily-planner-error">{error}</span>}
      </div>

      {/* Review */}
      {review && (
        <div className="dk-daily-planner-section">
          <button className="dk-daily-planner-review-toggle" onClick={() => setShowReview(!showReview)}>
            <span>End-of-Day Review</span>
            <span>{showReview ? '▾' : '▸'}</span>
          </button>
          {showReview && (
            <div className="dk-daily-planner-review">
              {review}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helpers
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const SUGGESTION_RATE_LIMIT_MS = 3600000
const SUGGESTION_MAX_PER_WINDOW = 10

function canRequestSuggestion(): boolean {
  const key = 'df_goal_suggest_requests'
  const raw = localStorage.getItem(key)
  const requests: number[] = raw ? JSON.parse(raw) : []
  const now = Date.now()
  const windowStart = now - SUGGESTION_RATE_LIMIT_MS
  const recent = requests.filter(t => t > windowStart)
  if (recent.length >= SUGGESTION_MAX_PER_WINDOW) return false
  recent.push(now)
  localStorage.setItem(key, JSON.stringify(recent))
  return true
}

async function buildSuggestionContext(date: string, api: any): Promise<string> {
  const parts: string[] = []
  parts.push(`Today is ${date}.`)

  // Schedule
  try {
    const schedule = await api['get-schedule']()
    const dayOfWeek = new Date(date).getDay()
    const todaySchedule = schedule.filter((s: any) => s.day_of_week === dayOfWeek)
    if (todaySchedule.length) {
      parts.push('Today\'s schedule:')
      for (const s of todaySchedule) {
        parts.push(`- ${s.start_time}-${s.end_time}: ${s.title}`)
      }
    } else {
      parts.push('No schedule entries for today.')
    }
  } catch { /* ignore */ }

  // Deadlines
  try {
    const deadlines = await api['get-deadlines']({ days: 7 })
    const approaching = deadlines.filter((d: any) => {
      const days = (new Date(d.due_date).getTime() - Date.now()) / 86400000
      return days > 0 && days <= 3
    })
    if (approaching.length) {
      parts.push('Approaching deadlines:')
      for (const d of approaching) {
        parts.push(`- ${d.title} (due ${d.due_date.slice(0, 10)})`)
      }
    }
  } catch { /* ignore */ }

  // Past productivity
  try {
    const lastWeek = await api['get-productivity-range'](
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      date
    )
    if (lastWeek) {
      parts.push('Past 7-day productivity patterns available.')
    }
  } catch { /* ignore */ }

  parts.push('Suggest 3-5 daily goals that fit the schedule, address deadlines, and balance categories. Each goal should have a realistic time target (30min to 3h).')

  return parts.join('\n')
}
```

---

 Here's the **completed Part 3 CSS** that picks up exactly where the previous AI cut off (mid-rule at `.dk-daily-planner-review { font-size:`), plus all the additional styles needed for the components I generated in the continuation:

---

## Part 3: CSS Additions (Completed)

Add to `src/components/ai/canvas/canvas.css`:

```css
/* ═══ Daily Planner Card (continued from cutoff) ═══ */

.dk-daily-planner-review {
  padding: 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* ═══ Goal Timeline (additional responsive rules) ═══ */

.dk-goal-timeline-body::-webkit-scrollbar {
  width: 4px;
}

.dk-goal-timeline-body::-webkit-scrollbar-track {
  background: transparent;
}

.dk-goal-timeline-body::-webkit-scrollbar-thumb {
  background: var(--dk-border-subtle);
  border-radius: 2px;
}

/* ═══ Goal Completion Animation ═══ */

@keyframes dk-goal-complete {
  0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
  100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}

.dk-daily-goal.completed {
  animation: dk-goal-complete 0.6s ease-out;
}

/* ═══ Skeleton Shimmer for AI Loading ═══ */

@keyframes dk-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.dk-skeleton {
  background: linear-gradient(
    90deg,
    var(--dk-bg-raised) 25%,
    var(--dk-bg-surface) 50%,
    var(--dk-bg-raised) 75%
  );
  background-size: 200% 100%;
  animation: dk-shimmer 1.5s infinite;
  border-radius: var(--dk-radius-sm);
}

.dk-skeleton-text {
  height: 12px;
  margin-bottom: 8px;
}

.dk-skeleton-text:last-child {
  width: 60%;
}

/* ═══ Focus Active Indicator ═══ */

.dk-daily-goal.focus-active {
  border-color: var(--dk-accent);
  background: rgba(34, 211, 238, 0.05);
}

.dk-daily-goal.focus-active .dk-daily-goal-title {
  color: var(--dk-accent);
}

/* ═══ Tooltip for Focus Button ═══ */

.dk-daily-goal-focus {
  position: relative;
}

.dk-daily-goal-focus::after {
  content: attr(title);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: var(--dk-bg-surface);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-sm);
  font-size: 10px;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dk-fast) var(--dk-ease);
  z-index: 10;
}

.dk-daily-goal-focus:hover::after {
  opacity: 1;
}

/* ═══ Weekly Schedule Card ═══ */
.dk-weekly-schedule {
  display: flex;
  flex-direction: column;
  gap: var(--dk-space-3);
}

.dk-weekly-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-weekly-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dk-text-primary);
}

.dk-weekly-range {
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-weekly-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.dk-weekly-day {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  min-height: 120px;
}

.dk-weekly-day.today {
  border-color: var(--dk-accent);
  background: rgba(34, 211, 238, 0.05);
}

.dk-weekly-day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-weekly-day-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--dk-text-secondary);
  text-transform: uppercase;
}

.dk-weekly-day-date {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-weekly-day-bar {
  height: 3px;
  background: var(--dk-border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.dk-weekly-day-fill {
  height: 100%;
  background: var(--dk-success);
  border-radius: 2px;
  transition: width var(--dk-normal) var(--dk-ease);
}

.dk-weekly-day-schedule {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.dk-weekly-block {
  padding: 4px 6px;
  background: rgba(63, 63, 70, 0.15);
  border-radius: var(--dk-radius-sm);
  border-left: 3px solid var(--dk-border-default);
  font-size: 10px;
  line-height: 1.3;
}

.dk-weekly-block-time {
  display: block;
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-weekly-block-title {
  display: block;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-weekly-empty {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-style: italic;
  text-align: center;
  padding: 8px 0;
}

.dk-weekly-day-goals {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.dk-weekly-goal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  opacity: 0.6;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-weekly-goal-dot.done {
  opacity: 1;
  box-shadow: 0 0 4px currentColor;
}

.dk-weekly-day-pct {
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
  text-align: right;
}

/* ═══ Deadline Tracker Card ═══ */
.dk-deadline-tracker {
  display: flex;
  flex-direction: column;
  gap: var(--dk-space-3);
}

.dk-deadline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-deadline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dk-text-primary);
}

.dk-deadline-count {
  font-size: 11px;
  color: var(--dk-text-faint);
}

.dk-deadline-loading,
.dk-deadline-empty {
  font-size: 12px;
  color: var(--dk-text-faint);
  font-style: italic;
  padding: var(--dk-space-3) 0;
}

.dk-deadline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dk-deadline-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-deadline-item:hover {
  border-color: var(--dk-border-default);
}

.dk-deadline-item.urgent {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.05);
}

.dk-deadline-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dk-deadline-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dk-deadline-priority {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dk-deadline-priority.high { background: #f87171; }
.dk-deadline-priority.medium { background: #fbbf24; }
.dk-deadline-priority.low { background: #4ade80; }

.dk-deadline-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-deadline-course {
  font-size: 10px;
  color: var(--dk-text-faint);
  background: var(--dk-bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.dk-deadline-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dk-deadline-due {
  font-size: 11px;
  font-weight: 500;
  color: var(--dk-text-muted);
}

.dk-deadline-item.urgent .dk-deadline-due {
  color: #f87171;
}

.dk-deadline-date {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-deadline-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dk-deadline-goal-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 4px;
}

.dk-deadline-goal-badge.completed {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.dk-deadline-goal-badge.active {
  background: rgba(34, 211, 238, 0.15);
  color: #22d3ee;
}

.dk-deadline-goal-badge.suggested {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.dk-deadline-goal-badge.dismissed {
  background: var(--dk-bg-surface);
  color: var(--dk-text-faint);
}

.dk-deadline-link-btn {
  padding: 4px 10px;
  background: var(--dk-accent-dim);
  border: none;
  border-radius: var(--dk-radius-sm);
  color: var(--dk-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-deadline-link-btn:hover {
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
}

/* ═══ Responsive Adjustments ═══ */

@media (max-width: 480px) {
  .dk-goal-timeline {
    height: 600px;
  }

  .dk-goal-timeline-hour span {
    font-size: 9px;
  }

  .dk-daily-goal {
    padding: 8px 10px;
  }

  .dk-daily-goal-title {
    font-size: 12px;
  }

  .dk-weekly-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .dk-weekly-day:nth-child(n+5) {
    display: none;
  }
}

/* ═══ Reduced Motion ═══ */

@media (prefers-reduced-motion: reduce) {
  .dk-daily-planner-fill,
  .dk-progress-fill,
  .dk-weekly-day-fill,
  .dk-daily-goal,
  .dk-daily-goal-check,
  .dk-daily-goal-focus,
  .dk-daily-planner-btn,
  .dk-daily-planner-review-toggle,
  .dk-deadline-item,
  .dk-deadline-link-btn {
    transition: none !important;
    animation: none !important;
  }

  .dk-daily-planner-focus {
    animation: none !important;
    opacity: 1 !important;
  }

  .dk-skeleton {
    animation: none !important;
    background: var(--dk-bg-raised) !important;
  }
}

/* ═══ High Contrast Mode Support ═══ */

@media (prefers-contrast: high) {
  .dk-daily-goal {
    border-color: var(--dk-border-strong);
  }

  .dk-daily-goal.completed .dk-daily-goal-check {
    border-width: 3px;
  }

  .dk-progress-track {
    height: 6px;
  }

  .dk-goal-timeline-now-line {
    height: 3px;
  }
}

/* ═══ Print Styles ═══ */

@media print {
  .dk-daily-planner-actions,
  .dk-daily-goal-focus,
  .dk-daily-planner-review-toggle,
  .dk-deadline-link-btn {
    display: none !important;
  }

  .dk-goal-timeline {
    height: auto;
    overflow: visible;
  }

  .dk-daily-goal {
    break-inside: avoid;
  }
}
```

---

### What was fixed/completed:

| Issue | Fix |
|-------|-----|
| **Cutoff at `font-size:`** | Completed the `.dk-daily-planner-review` rule with `12px`, `color`, `line-height`, `white-space` |
| **Missing scrollbar styles** | Added thin custom scrollbar for timeline body |
| **Missing completion animation** | Added `dk-goal-complete` keyframe + pulse animation |
| **Missing skeleton shimmer** | Added `dk-shimmer` keyframe for AI loading states |
| **Missing focus-active state** | Added `.focus-active` variant for goals during active focus |
| **Missing tooltip** | Added CSS tooltip on hover for focus button |
| **Missing WeeklyScheduleCard styles** | Added all `.dk-weekly-*` rules |
| **Missing DeadlineTrackerCard styles** | Added all `.dk-deadline-*` rules |
| **Missing responsive** | Added mobile breakpoint (`max-width: 480px`) |
| **Missing accessibility** | Added `prefers-reduced-motion`, `prefers-contrast: high` |
| **Missing print styles** | Added `@media print` to hide interactive elements |

## Part 4: Fixed & Enhanced Hooks

### File: `src/hooks/useFocusGoals.ts` (FIXED — replaces previous version)

The previous AI used `onFocusStateChange` which doesn't exist in the IPC bundle. Fixed to use polling via `focus:get-state`.

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Goal } from '../types'

interface FocusState {
  isActive: boolean
  isBroken: boolean
  allowedCategories: string[]
  sessionId?: string
  startedAt?: string
}

interface FocusGoalProgress {
  goalId: string
  accumulatedSeconds: number
  lastTickAt: number
}

const TICK_MS = 1000
const POLL_MS = 2000

export function useFocusGoals(goals: Goal[]) {
  const [focusState, setFocusState] = useState<FocusState | null>(null)
  const [activeGoalIds, setActiveGoalIds] = useState<string[]>([])
  const progressRef = useRef<Record<string, FocusGoalProgress>>({})
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeBasedGoals = goals.filter(g => g.target_type === 'time' && g.match_category)

  // Poll focus state every 2 seconds
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.['focus:get-state']) return

    const checkState = async () => {
      try {
        const state = await api['focus:get-state']()
        if (!state) {
          // Focus ended — persist if we have accumulated progress
          if (focusState?.isActive && Object.keys(progressRef.current).length > 0) {
            await persistProgress()
          }
          setFocusState(null)
          return
        }

        const newState: FocusState = {
          isActive: state.outcome === 'active',
          isBroken: state.outcome === 'failed' || !!state.broke_on_type,
          allowedCategories: state.allowed_json
            ? (() => {
                try {
                  return JSON.parse(state.allowed_json).categories || []
                } catch {
                  return []
                }
              })()
            : [],
          sessionId: String(state.id),
          startedAt: state.started_at,
        }

        setFocusState(prev => {
          // If transitioning from active to inactive, persist progress
          if (prev?.isActive && !newState.isActive) {
            persistProgress()
          }
          return newState
        })
      } catch {
        // Silently fail — focus state is best-effort
      }
    }

    checkState()
    pollRef.current = setInterval(checkState, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [goals]) // re-bind when goals change so persistProgress has latest goals

  // Determine which goals match current focus
  useEffect(() => {
    if (!focusState?.isActive || focusState.isBroken) {
      setActiveGoalIds([])
      return
    }

    const allowed = focusState.allowedCategories.map((c: string) => c.toLowerCase())
    const matched = timeBasedGoals
      .filter(g => allowed.includes((g.match_category || '').toLowerCase()))
      .map(g => g.id)

    setActiveGoalIds(matched)

    // Initialize progress tracking for matched goals
    for (const id of matched) {
      if (!progressRef.current[id]) {
        progressRef.current[id] = {
          goalId: id,
          accumulatedSeconds: 0,
          lastTickAt: Date.now(),
        }
      }
    }
  }, [focusState, timeBasedGoals])

  // Tick every second when focus is active and not broken
  useEffect(() => {
    if (activeGoalIds.length === 0 || focusState?.isBroken) {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }

    tickRef.current = setInterval(() => {
      const now = Date.now()
      for (const id of activeGoalIds) {
        const prog = progressRef.current[id]
        if (prog) {
          prog.accumulatedSeconds += TICK_MS / 1000
          prog.lastTickAt = now
        }
      }
    }, TICK_MS)

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [activeGoalIds, focusState?.isBroken])

  // Persist accumulated progress to DB
  const persistProgress = useCallback(async () => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return

    for (const [id, prog] of Object.entries(progressRef.current)) {
      if (prog.accumulatedSeconds < 1) continue

      const goal = goals.find(g => g.id === id)
      if (!goal) continue

      const newProgress = (goal.progress_seconds || 0) + Math.floor(prog.accumulatedSeconds)
      const targetSec = goal.target_seconds || 3600

      try {
        await api['save-goal'](goal.date, {
          ...goal,
          progress_seconds: Math.min(newProgress, targetSec),
          status: newProgress >= targetSec ? 'completed' : 'active',
        })
      } catch (e) {
        console.error('Failed to persist goal progress:', e)
      }
    }

    progressRef.current = {}
  }, [goals])

  // Persist on unmount if there's pending progress
  useEffect(() => {
    return () => {
      if (Object.keys(progressRef.current).length > 0) {
        persistProgress()
      }
    }
  }, [persistProgress])

  const getAccumulatedSeconds = useCallback((goalId: string): number => {
    return Math.floor(progressRef.current[goalId]?.accumulatedSeconds || 0)
  }, [])

  return {
    focusState,
    activeGoalIds,
    getAccumulatedSeconds,
    persistProgress,
  }
}
```

---

## Part 5: Main Process IPC Handlers

### File: `src/main.ts` — Add these IPC handlers (insert alongside existing goal IPCs around line 2706 area)

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// DAILY GOAL PROGRESS & TIMELINE IPC
// ═══════════════════════════════════════════════════════════════════════════════

import { ipcMain, IpcMainInvokeEvent } from 'electron'

// Security: All SQL uses parameterized queries (? placeholders)
// No string interpolation into SQL. All user input validated.

/**
 * get-daily-goal-progress
 * Computes real-time progress for time-based goals by aggregating log sessions.
 * 
 * Params: { date: string, goals: Goal[] }
 * Returns: Record<goalId, GoalProgress>
 */
ipcMain.handle('get-daily-goal-progress', async (_event: IpcMainInvokeEvent, date: string, goals: any[]) => {
  // Input validation
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
  }
  if (!Array.isArray(goals)) {
    throw new Error('Goals must be an array.')
  }

  const timeBasedGoals = goals.filter(
    (g: any) => g?.target_type === 'time' && typeof g?.match_category === 'string' && g.match_category.length > 0
  )

  if (timeBasedGoals.length === 0) {
    return {}
  }

  const db = getDatabase() // existing DB accessor
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`

  // Parameterized query — NO string concatenation
  const rows = db.prepare(`
    SELECT category, duration_ms
    FROM logs
    WHERE timestamp >= ? AND timestamp <= ?
  `).all(startOfDay, endOfDay) as Array<{ category: string; duration_ms: number }>

  // Aggregate duration by category (case-insensitive)
  const categorySeconds: Record<string, number> = {}
  for (const row of rows) {
    const cat = (row.category || 'uncategorized').toLowerCase()
    const sec = Math.floor((row.duration_ms || 0) / 1000)
    categorySeconds[cat] = (categorySeconds[cat] || 0) + sec
  }

  // Map to goals
  const result: Record<string, {
    goalId: string
    progressSeconds: number
    targetSeconds: number
    percentComplete: number
    status: 'pending' | 'active' | 'completed' | 'overdue'
  }> = {}

  for (const goal of timeBasedGoals) {
    const matchCat = (goal.match_category || '').toLowerCase()
    const progressSec = categorySeconds[matchCat] || 0
    const targetSec = Math.min(Math.max(Number(goal.target_seconds) || 3600, 1), 86400)
    const pct = Math.min(100, Math.round((progressSec / targetSec) * 100))

    result[goal.id] = {
      goalId: goal.id,
      progressSeconds: progressSec,
      targetSeconds: targetSec,
      percentComplete: pct,
      status: pct >= 100 ? 'completed' : progressSec > 0 ? 'active' : 'pending',
    }
  }

  return result
})

/**
 * get-goal-timeline
 * Returns schedule blocks + goal progress overlay data for a given date.
 * 
 * Params: { date: string }
 * Returns: { schedule: ScheduleEntry[], goals: TimelineGoal[] }
 */
ipcMain.handle('get-goal-timeline', async (_event: IpcMainInvokeEvent, date: string) => {
  // Input validation
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.')
n  }

  const db = getDatabase()

  // Fetch schedule entries for this day of week
  const dayOfWeek = new Date(date).getDay() // 0 = Sunday
  const schedule = db.prepare(`
    SELECT id, title, location, day_of_week, start_time, end_time, category, color
    FROM schedule_entries
    WHERE day_of_week = ? AND is_recurring = 1
    ORDER BY start_time
  `).all(dayOfWeek) as Array<{
    id: string; title: string; location: string | null
    day_of_week: number; start_time: string; end_time: string
    category: string; color: string
  }>

  // Fetch goals for this date
  const goals = db.prepare(`
    SELECT id, title, category, target_type, target_seconds, match_category, progress_seconds, status
    FROM goals
    WHERE date = ? AND status IN ('pending', 'active', 'completed')
  `).all(date) as Array<{
    id: string; title: string; category: string
    target_type: string; target_seconds: number | null
    match_category: string | null; progress_seconds: number | null
    status: string
  }>

  // Aggregate log durations by category for progress
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`
  const logRows = db.prepare(`
    SELECT category, duration_ms
    FROM logs
    WHERE timestamp >= ? AND timestamp <= ?
  `).all(startOfDay, endOfDay) as Array<{ category: string; duration_ms: number }>

  const categorySeconds: Record<string, number> = {}
  for (const row of logRows) {
    const cat = (row.category || 'uncategorized').toLowerCase()
    const sec = Math.floor((row.duration_ms || 0) / 1000)
    categorySeconds[cat] = (categorySeconds[cat] || 0) + sec
  }

  // Build timeline goals with computed progress
  const timelineGoals = goals.map(g => {
    const matchCat = (g.match_category || '').toLowerCase()
    const progressSec = g.target_type === 'time'
      ? (categorySeconds[matchCat] || 0) + (g.progress_seconds || 0)
      : (g.progress_seconds || 0)
    const targetSec = Math.min(Math.max(Number(g.target_seconds) || 3600, 1), 86400)
    const pct = g.target_type === 'time'
      ? Math.min(100, Math.round((progressSec / targetSec) * 100))
      : g.status === 'completed' ? 100 : 0

    return {
      id: g.id,
      title: g.title,
      category: g.category,
      targetType: g.target_type,
      matchCategory: g.match_category,
      progressSeconds: progressSec,
      targetSeconds: targetSec,
      percentComplete: pct,
      status: g.status,
    }
  })

  return {
    schedule: schedule.map(s => ({
      id: s.id,
      title: s.title,
      location: s.location,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      category: s.category,
      color: s.color,
    })),
    goals: timelineGoals,
  }
})
```

---

## Part 6: Preload Bridge

### File: `src/preload.ts` — Add to existing `deskflowAPI` object

```typescript
// Add these to the existing contextBridge.exposeInMainWorld('deskflowAPI', { ... }) call

'get-daily-goal-progress': (date: string, goals: any[]) =>
  ipcRenderer.invoke('get-daily-goal-progress', date, goals),

'get-goal-timeline': (date: string) =>
  ipcRenderer.invoke('get-goal-timeline', date),
```

---

## Part 7: GoalStore Service Enhancement

### File: `src/services/GoalStore.ts` — Add these methods to the existing class

```typescript
import type { Goal } from '../types'

const STORAGE_KEY = 'deskflow_goals'

interface GoalDay {
  date: string
  goals: Goal[]
  lastSynced: number
}

/**
 * Add real-time progress accumulation methods to GoalStore.
 * These work alongside the DB-backed progress for offline resilience.
 */
export class GoalStore {
  private static getStore(): Record<string, GoalDay> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  private static setStore(store: Record<string, GoalDay>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }

  // ── Existing methods (preserve) ──
  static getDay(date: string): GoalDay | undefined {
    return this.getStore()[date]
  }

  static setDay(date: string, goals: Goal[]) {
    const store = this.getStore()
    store[date] = { date, goals, lastSynced: Date.now() }
    this.setStore(store)
  }

  static getGoal(date: string, goalId: string): Goal | undefined {
    return this.getDay(date)?.goals.find(g => g.id === goalId)
  }

  // ── New: Real-time progress accumulation ──

  /**
   * Accumulate seconds for a goal during an active focus session.
   * Stores in-memory + localStorage for resilience.
   */
  static accumulateProgress(goalId: string, seconds: number): void {
    const key = `df_goal_accum_${goalId}`
    const current = parseInt(localStorage.getItem(key) || '0', 10)
    localStorage.setItem(key, String(current + Math.floor(seconds)))
  }

  /**
   * Get accumulated progress for a goal (not yet persisted to DB).
   */
  static getAccumulated(goalId: string): number {
    const key = `df_goal_accum_${goalId}`
    return parseInt(localStorage.getItem(key) || '0', 10)
  }

  /**
   * Clear accumulated progress after successful DB persist.
   */
  static clearAccumulated(goalId: string): void {
    const key = `df_goal_accum_${goalId}`
    localStorage.removeItem(key)
  }

  /**
   * Apply accumulated progress to a goal object (for UI rendering).
   * Does NOT mutate the original goal.
   */
  static applyAccumulated(goal: Goal): Goal {
    const extra = this.getAccumulated(goal.id)
    if (extra <= 0) return goal
    const newProgress = (goal.progress_seconds || 0) + extra
    const target = goal.target_seconds || 3600
    return {
      ...goal,
      progress_seconds: Math.min(newProgress, target),
      status: newProgress >= target ? 'completed' : goal.status,
    }
  }

  /**
   * Batch apply accumulated progress to all goals for a date.
   */
  static applyAccumulatedToDay(date: string): Goal[] {
    const day = this.getDay(date)
    if (!day) return []
    return day.goals.map(g => this.applyAccumulated(g))
  }

  /**
   * Clear ALL accumulated progress (e.g., on session end or app restart).
   */
  static clearAllAccumulated(): void {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('df_goal_accum_')) keys.push(k)
    }
    for (const k of keys) localStorage.removeItem(k)
  }

  // ── New: Focus session linkage ──

  /**
   * Track which goal is currently linked to an active focus session.
   */
  static setFocusLinkedGoal(goalId: string | null): void {
    if (goalId) {
      localStorage.setItem('df_focus_linked_goal', goalId)
    } else {
      localStorage.removeItem('df_focus_linked_goal')
    }
  }

  static getFocusLinkedGoal(): string | null {
    return localStorage.getItem('df_focus_linked_goal')
  }

  // ── New: Suggestion rate limiting (client-side guard) ──

  static canRequestSuggestion(): boolean {
    const key = 'df_goal_suggest_requests'
    const raw = localStorage.getItem(key)
    const requests: number[] = raw ? JSON.parse(raw) : []
    const now = Date.now()
    const windowStart = now - 3600000 // 1 hour
    const recent = requests.filter(t => t > windowStart)
    if (recent.length >= 10) return false
    recent.push(now)
    localStorage.setItem(key, JSON.stringify(recent))
    return true
  }
}
```

---

## Part 8: AiPage Integration

### File: `src/pages/AiPage.tsx` — Add DailyPlannerCard to canvas seeding

Find the existing canvas card seeding logic (likely around where cards are initialized) and add:

```tsx
import { DailyPlannerCard } from '../components/ai/canvas/cards/DailyPlannerCard'

// In the canvas seeding / card registry section, add:
const DEFAULT_CARDS = [
  // ... existing cards ...
  {
    id: 'daily-planner',
    type: 'daily-planner',
    title: 'Daily Planner',
    component: DailyPlannerCard,
    defaultSize: { width: 380, height: 520 },
    defaultPosition: { x: 20, y: 20 }, // or appropriate grid position
  },
  // ... other cards ...
]

// In the card renderer switch/map:
const renderCard = (card: CanvasCard) => {
  switch (card.type) {
    // ... existing cases ...
    case 'daily-planner':
      return <DailyPlannerCard date={new Date().toISOString().slice(0, 10)} />
    // ... other cases ...
  }
}
```

If AiPage uses a dynamic card system with a registry, add to the registry map:

```tsx
const CARD_COMPONENTS: Record<string, React.FC<any>> = {
  // ... existing ...
  'daily-planner': DailyPlannerCard,
  'weekly-schedule': WeeklyScheduleCard,
  'deadline-tracker': DeadlineTrackerCard,
  // ...
}
```

---

## Part 9: WeeklyScheduleCard Goal Overlay

### File: `src/components/ai/canvas/cards/WeeklyScheduleCard.tsx` — Enhance with goal overlay

```tsx
import { useState, useEffect, useMemo } from 'react'
import { useGoalProgress } from '../../../../hooks/useGoalProgress'
import type { Goal } from '../../../../types'

interface WeeklyScheduleCardProps {
  weekOffset?: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CATEGORY_COLORS: Record<string, string> = {
  work: '#22d3ee',
  personal: '#4ade80',
  health: '#f87171',
  learning: '#a78bfa',
}

export function WeeklyScheduleCard({ weekOffset = 0 }: WeeklyScheduleCardProps) {
  const [schedule, setSchedule] = useState<any[]>([])
  const [goalsByDay, setGoalsByDay] = useState<Record<string, Goal[]>>({})

  // Compute week range
  const weekDates = useMemo(() => {
    const now = new Date()
    now.setDate(now.getDate() - now.getDay() + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }, [weekOffset])

  // Fetch schedule once
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.['get-schedule']) return
    api['get-schedule']().then((s: any[]) => setSchedule(s || [])).catch(() => setSchedule([]))
  }, [])

  // Fetch goals for each day of the week
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.['get-goals-batch']) return

    const start = weekDates[0]
    const end = weekDates[6]
    api['get-goals-batch'](start, end)
      .then((batch: Record<string, Goal[]>) => setGoalsByDay(batch || {}))
      .catch(() => setGoalsByDay({}))
  }, [weekDates])

  // Build day columns
  const dayColumns = useMemo(() => {
    return weekDates.map(date => {
      const dayIdx = new Date(date).getDay()
      const daySchedule = schedule.filter((s: any) => s.day_of_week === dayIdx)
      const dayGoals = goalsByDay[date] || []

      // Compute completion stats
      const completed = dayGoals.filter((g: Goal) => g.status === 'completed').length
      const total = dayGoals.length
      const timeGoals = dayGoals.filter((g: Goal) => g.target_type === 'time')
      const totalProgress = timeGoals.reduce((sum, g) => sum + (g.progress_seconds || 0), 0)
      const totalTarget = timeGoals.reduce((sum, g) => sum + (g.target_seconds || 3600), 0)
      const dayPct = totalTarget > 0 ? Math.min(100, Math.round((totalProgress / totalTarget) * 100)) : 0

      return {
        date,
        dayName: DAYS[dayIdx],
        schedule: daySchedule,
        goals: dayGoals,
        completed,
        total,
        dayPct,
      }
    })
  }, [weekDates, schedule, goalsByDay])

  return (
    <div className="dk-weekly-schedule">
      <div className="dk-weekly-header">
        <span className="dk-weekly-title">Weekly Overview</span>
        <span className="dk-weekly-range">
          {weekDates[0]} — {weekDates[6]}
        </span>
      </div>

      <div className="dk-weekly-grid">
        {dayColumns.map(col => (
          <div key={col.date} className={`dk-weekly-day ${col.date === new Date().toISOString().slice(0, 10) ? 'today' : ''}`}>
            <div className="dk-weekly-day-header">
              <span className="dk-weekly-day-name">{col.dayName}</span>
              <span className="dk-weekly-day-date">{col.date.slice(5)}</span>
            </div>

            {/* Goal completion mini-bar */}
            {col.total > 0 && (
              <div className="dk-weekly-day-bar">
                <div
                  className="dk-weekly-day-fill"
                  style={{ width: `${col.total ? (col.completed / col.total) * 100 : 0}%` }}
                />
              </div>
            )}

            {/* Schedule blocks */}
            <div className="dk-weekly-day-schedule">
              {col.schedule.map((s: any) => (
                <div
                  key={s.id}
                  className="dk-weekly-block"
                  style={{ borderLeftColor: s.color || CATEGORY_COLORS[s.category] || '#a1a1aa' }}
                >
                  <span className="dk-weekly-block-time">{s.start_time}-{s.end_time}</span>
                  <span className="dk-weekly-block-title">{s.title}</span>
                </div>
              ))}
              {col.schedule.length === 0 && (
                <span className="dk-weekly-empty">No schedule</span>
              )}
            </div>

            {/* Goal dots */}
            {col.goals.length > 0 && (
              <div className="dk-weekly-day-goals">
                {col.goals.map((g: Goal) => (
                  <div
                    key={g.id}
                    className={`dk-weekly-goal-dot ${g.status === 'completed' ? 'done' : ''}`}
                    style={{ background: CATEGORY_COLORS[g.category] || '#a1a1aa' }}
                    title={`${g.title}${g.status === 'completed' ? ' ✓' : ''}`}
                  />
                ))}
              </div>
            )}

            {/* Time progress */}
            {col.dayPct > 0 && (
              <span className="dk-weekly-day-pct">{col.dayPct}% time</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Add to `canvas.css`:

```css
/* ═══ Weekly Schedule Card ═══ */
.dk-weekly-schedule {
  display: flex;
  flex-direction: column;
  gap: var(--dk-space-3);
}

.dk-weekly-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-weekly-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dk-text-primary);
}

.dk-weekly-range {
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-weekly-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.dk-weekly-day {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  min-height: 120px;
}

.dk-weekly-day.today {
  border-color: var(--dk-accent);
  background: rgba(34, 211, 238, 0.05);
}

.dk-weekly-day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-weekly-day-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--dk-text-secondary);
  text-transform: uppercase;
}

.dk-weekly-day-date {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-weekly-day-bar {
  height: 3px;
  background: var(--dk-border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.dk-weekly-day-fill {
  height: 100%;
  background: var(--dk-success);
  border-radius: 2px;
  transition: width var(--dk-normal) var(--dk-ease);
}

.dk-weekly-day-schedule {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.dk-weekly-block {
  padding: 4px 6px;
  background: rgba(63, 63, 70, 0.15);
  border-radius: var(--dk-radius-sm);
  border-left: 3px solid var(--dk-border-default);
  font-size: 10px;
  line-height: 1.3;
}

.dk-weekly-block-time {
  display: block;
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-weekly-block-title {
  display: block;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-weekly-empty {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-style: italic;
  text-align: center;
  padding: 8px 0;
}

.dk-weekly-day-goals {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.dk-weekly-goal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  opacity: 0.6;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-weekly-goal-dot.done {
  opacity: 1;
  box-shadow: 0 0 4px currentColor;
}

.dk-weekly-day-pct {
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
  text-align: right;
}
```

---

## Part 10: DeadlineTrackerCard Goal Linking

### File: `src/components/ai/canvas/cards/DeadlineTrackerCard.tsx` — Add goal linking

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { Goal } from '../../../../types'

interface Deadline {
  id: string
  title: string
  course?: string
  due_date: string
  priority: string
  status: string
  description?: string
  category?: string
}

interface DeadlineTrackerCardProps {
  days?: number
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function DeadlineTrackerCard({ days = 14 }: DeadlineTrackerCardProps) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [linkedMap, setLinkedMap] = useState<Record<string, string>>({}) // deadlineId -> goalId
  const [loading, setLoading] = useState(true)

  // Fetch deadlines and goals
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) return

    Promise.all([
      api['get-deadlines']({ days }).catch(() => []),
      api['get-goals'](new Date().toISOString().slice(0, 10)).catch(() => []),
    ]).then(([dl, gl]) => {
      setDeadlines(dl || [])
      setGoals(gl || [])
      // Build link map from goal.links
      const map: Record<string, string> = {}
      for (const g of gl || []) {
        if (!g.links) continue
        try {
          const links = JSON.parse(g.links)
          for (const l of links) {
            if (l.label && l.url === null) {
              // Find deadline by title match
              const match = (dl || []).find((d: Deadline) => d.title === l.label)
              if (match) map[match.id] = g.id
            }
          }
        } catch {
          // ignore malformed links
        }
      }
      setLinkedMap(map)
      setLoading(false)
    })
  }, [days])

  // Create a goal from a deadline
  const createGoalFromDeadline = useCallback(async (deadline: Deadline) => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return

    const today = new Date().toISOString().slice(0, 10)
    const goal: Partial<Goal> = {
      title: `Prepare for: ${deadline.title}`,
      description: `Deadline: ${deadline.title}${deadline.course ? ` (${deadline.course})` : ''}`,
      category: deadline.course ? 'work' : 'learning',
      target_type: 'completion',
      status: 'pending',
      source: 'ai',
      date: today,
      links: JSON.stringify([{ label: deadline.title, url: null }]),
    }

    try {
      await api['save-goal'](today, goal)
      // Refresh goals
      const updated = await api['get-goals'](today)
      setGoals(updated || [])
      // Update link map
      const newGoal = (updated || []).find((g: Goal) => {
        if (!g.links) return false
        try {
          return JSON.parse(g.links).some((l: any) => l.label === deadline.title)
        } catch {
          return false
        }
      })
      if (newGoal) {
        setLinkedMap(prev => ({ ...prev, [deadline.id]: newGoal.id }))
      }
    } catch (e) {
      console.error('Failed to create goal from deadline:', e)
    }
  }, [])

  // Dismiss an auto-suggested goal
  const dismissGoal = useCallback(async (goalId: string) => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    try {
      await api['save-goal'](goal.date, { ...goal, status: 'dismissed' })
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: 'dismissed' } : g))
    } catch (e) {
      console.error('Failed to dismiss goal:', e)
    }
  }, [goals])

  const sortedDeadlines = [...deadlines]
    .filter(d => d.status !== 'done')
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99
      const pb = PRIORITY_ORDER[b.priority] ?? 99
      if (pa !== pb) return pa - pb
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  return (
    <div className="dk-deadline-tracker">
      <div className="dk-deadline-header">
        <span className="dk-deadline-title">Deadlines</span>
        <span className="dk-deadline-count">{sortedDeadlines.length} upcoming</span>
      </div>

      {loading ? (
        <div className="dk-deadline-loading">Loading...</div>
      ) : sortedDeadlines.length === 0 ? (
        <span className="dk-deadline-empty">No upcoming deadlines.</span>
      ) : (
        <div className="dk-deadline-list">
          {sortedDeadlines.map(dl => {
            const linkedGoalId = linkedMap[dl.id]
            const linkedGoal = linkedGoalId ? goals.find(g => g.id === linkedGoalId) : undefined
            const daysLeft = Math.ceil((new Date(dl.due_date).getTime() - Date.now()) / 86400000)

            return (
              <div key={dl.id} className={`dk-deadline-item ${daysLeft <= 3 ? 'urgent' : ''}`}>
                <div className="dk-deadline-main">
                  <div className="dk-deadline-title-row">
                    <span className={`dk-deadline-priority ${dl.priority}`} />
                    <span className="dk-deadline-name">{dl.title}</span>
                    {dl.course && <span className="dk-deadline-course">{dl.course}</span>}
                  </div>
                  <div className="dk-deadline-meta">
                    <span className="dk-deadline-due">
                      {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                    </span>
                    <span className="dk-deadline-date">{dl.due_date.slice(0, 10)}</span>
                  </div>
                </div>

                <div className="dk-deadline-actions">
                  {linkedGoal ? (
                    <div className={`dk-deadline-goal-badge ${linkedGoal.status}`}>
                      {linkedGoal.status === 'completed' ? '✓ Done' :
                       linkedGoal.status === 'dismissed' ? 'Dismissed' :
                       linkedGoal.status === 'suggested' ? 'Suggested' : 'Active'}
                    </div>
                  ) : daysLeft > 0 && daysLeft <= 3 ? (
                    <button
                      className="dk-deadline-link-btn"
                      onClick={() => createGoalFromDeadline(dl)}
                      title="Create goal for this deadline"
                    >
                      + Goal
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

Add to `canvas.css`:

```css
/* ═══ Deadline Tracker Card ═══ */
.dk-deadline-tracker {
  display: flex;
  flex-direction: column;
  gap: var(--dk-space-3);
}

.dk-deadline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-deadline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dk-text-primary);
}

.dk-deadline-count {
  font-size: 11px;
  color: var(--dk-text-faint);
}

.dk-deadline-loading,
.dk-deadline-empty {
  font-size: 12px;
  color: var(--dk-text-faint);
  font-style: italic;
  padding: var(--dk-space-3) 0;
}

.dk-deadline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dk-deadline-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-deadline-item:hover {
  border-color: var(--dk-border-default);
}

.dk-deadline-item.urgent {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.05);
}

.dk-deadline-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dk-deadline-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dk-deadline-priority {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dk-deadline-priority.high { background: #f87171; }
.dk-deadline-priority.medium { background: #fbbf24; }
.dk-deadline-priority.low { background: #4ade80; }

.dk-deadline-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-deadline-course {
  font-size: 10px;
  color: var(--dk-text-faint);
  background: var(--dk-bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.dk-deadline-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dk-deadline-due {
  font-size: 11px;
  font-weight: 500;
  color: var(--dk-text-muted);
}

.dk-deadline-item.urgent .dk-deadline-due {
  color: #f87171;
}

.dk-deadline-date {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-deadline-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dk-deadline-goal-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 4px;
}

.dk-deadline-goal-badge.completed {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.dk-deadline-goal-badge.active {
  background: rgba(34, 211, 238, 0.15);
  color: #22d3ee;
}

.dk-deadline-goal-badge.suggested {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.dk-deadline-goal-badge.dismissed {
  background: var(--dk-bg-surface);
  color: var(--dk-text-faint);
}

.dk-deadline-link-btn {
  padding: 4px 10px;
  background: var(--dk-accent-dim);
  border: none;
  border-radius: var(--dk-radius-sm);
  color: var(--dk-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dk-fast) var(--dk-ease);
}

.dk-deadline-link-btn:hover {
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
}
```

---

## Part 11: CSS Completion (fixes cutoff from previous AI)

Add the missing closing to `canvas.css` from where the previous AI cut off:

```css
.dk-daily-planner-review {
  padding: 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}
```

---

## Part 12: Security Hardening Summary

All security requirements from the prompt have been addressed:

| Requirement | Implementation |
|-------------|----------------|
| **SQL Injection Prevention** | All new SQL in `main.ts` uses `?` parameterized queries. No string interpolation. |
| **XSS Prevention** | All goal titles rendered via React default escaping (no `dangerouslySetInnerHTML`). AI suggestions schema-validated. |
| **Input Validation** | `target_seconds` clamped to 1-86400. `category` restricted to enum. `date` regex-validated (`YYYY-MM-DD`). |
| **Rate Limiting** | `GoalStore.canRequestSuggestion()` enforces max 10 AI suggestions/hour via localStorage. |
| **Data Exposure** | No secrets/PII in goal data. Error messages are generic. |
| **Configuration** | No hardcoded API keys. AI calls use existing `suggest-goals` IPC (env-based). |
| **Cascade Deletes** | Goal deletion uses existing `delete-goal` IPC which handles DB cascade. |

---

## Integration Checklist

- [x] `useGoalProgress.ts` — Polls `get-logs-by-period`, computes progress by category
- [x] `useFocusGoals.ts` — Polls `focus:get-state`, accumulates real-time progress, persists on end
- [x] `GoalTimeline.tsx` — Visual 6am-12am timeline with schedule blocks + gaps + current time
- [x] `GoalProgressBar.tsx` — Color-coded progress indicator
- [x] `DailyPlannerCard.tsx` — Unified planner with timeline, goals, suggestions, review
- [x] `main.ts` IPC — `get-daily-goal-progress` + `get-goal-timeline` (parameterized SQL)
- [x] `preload.ts` — Bridge methods for new IPCs
- [x] `GoalStore.ts` — Accumulated progress tracking, focus linkage, rate limiting
- [x] `AiPage.tsx` — DailyPlannerCard seeded into canvas
- [x] `WeeklyScheduleCard.tsx` — 7-day grid with goal overlay dots + completion bars
- [x] `DeadlineTrackerCard.tsx` — Auto-create goals from deadlines, link tracking, dismiss
- [x] `canvas.css` — All styles for planner, timeline, progress bars, weekly grid, deadlines
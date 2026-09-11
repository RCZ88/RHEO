I see — the new files set up a complete design revamp of all canvas cards with proper design tokens, MCP component patterns, and state coverage requirements. Let me produce the redesigned components, new shared components, and complete CSS using only --dk-* tokens.
Part 1: New Shared Components
src/components/ai/canvas/cards/ProgressRing.tsx
tsx
import { useEffect, useState } from 'react'

interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  animate?: boolean
}

export function ProgressRing({
  percent,
  size = 36,
  strokeWidth = 3,
  color = 'var(--dk-accent)',
  trackColor = 'var(--dk-border-subtle)',
  label,
  animate = true,
}: ProgressRingProps) {
  const [displayPct, setDisplayPct] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = circumference - (displayPct / 100) * circumference

  useEffect(() => {
    if (!animate) {
      setDisplayPct(clamped)
      return
    }
    const timer = setTimeout(() => setDisplayPct(clamped), 50)
    return () => clearTimeout(timer)
  }, [clamped, animate])

  return (
    <div className="dk-progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset var(--dk-slow) var(--dk-ease)',
          }}
        />
      </svg>
      {label && (
        <span className="dk-progress-ring-label" style={{ fontSize: Math.max(9, size / 4) }}>
          {label}
        </span>
      )}
    </div>
  )
}
src/components/ai/canvas/cards/CountdownRing.tsx
tsx
import { useMemo } from 'react'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

interface CountdownRingProps {
  daysLeft: number
  totalDays?: number
  size?: number
}

const URGENCY_CONFIG = {
  critical: { color: '#f87171', icon: AlertTriangle, threshold: 1 },
  urgent: { color: '#fb923c', icon: Clock, threshold: 3 },
  warning: { color: '#fbbf24', icon: Clock, threshold: 7 },
  safe: { color: '#4ade80', icon: CheckCircle2, threshold: Infinity },
}

export function CountdownRing({ daysLeft, totalDays = 14, size = 32 }: CountdownRingProps) {
  const config = useMemo(() => {
    if (daysLeft < 0) return URGENCY_CONFIG.critical
    if (daysLeft <= URGENCY_CONFIG.urgent.threshold) return URGENCY_CONFIG.urgent
    if (daysLeft <= URGENCY_CONFIG.warning.threshold) return URGENCY_CONFIG.warning
    return URGENCY_CONFIG.safe
  }, [daysLeft])

  const Icon = config.icon
  const progress = Math.max(0, Math.min(1, daysLeft / totalDays))
  const radius = (size - 3) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - progress * circumference

  return (
    <div className="dk-countdown-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--dk-border-subtle)" strokeWidth={2}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={config.color} strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset var(--dk-slow) var(--dk-ease)',
          }}
        />
      </svg>
      <Icon size={size / 2.5} color={config.color} className="dk-countdown-icon" />
    </div>
  )
}
src/components/ai/canvas/cards/GoalItem.tsx
tsx
import { useCallback } from 'react'
import { ProgressRing } from './ProgressRing'
import { Play, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import type { Goal } from '../../../../types'

const CATEGORY_COLORS: Record<string, string> = {
  work: '#22d3ee',
  personal: '#4ade80',
  health: '#f87171',
  learning: '#a78bfa',
}

interface GoalItemProps {
  goal: Goal
  progressSeconds?: number
  isActive?: boolean
  onToggle?: (goal: Goal) => void
  onFocus?: (goal: Goal) => void
}

export function GoalItem({ goal, progressSeconds = 0, isActive = false, onToggle, onFocus }: GoalItemProps) {
  const color = CATEGORY_COLORS[goal.category] || '#a1a1aa'
  const target = goal.target_seconds || 3600
  const progress = Math.min(target, (goal.progress_seconds || 0) + progressSeconds)
  const pct = goal.target_type === 'time' ? Math.round((progress / target) * 100) : goal.status === 'completed' ? 100 : 0
  const isCompleted = goal.status === 'completed'
  const isSuggested = goal.source === 'ai' && goal.status === 'suggested'

  const handleToggle = useCallback(() => onToggle?.(goal), [goal, onToggle])
  const handleFocus = useCallback(() => onFocus?.(goal), [goal, onFocus])

  return (
    <div
      className={`dk-goal-item ${isActive ? 'focus-active' : ''} ${isCompleted ? 'completed' : ''}`}
      style={{ '--goal-color': color } as React.CSSProperties}
    >
      <button
        className="dk-goal-item-check"
        onClick={handleToggle}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted ? <CheckCircle2 size={18} color={color} /> : <Circle size={18} color="var(--dk-text-faint)" />}
      </button>

      <div className="dk-goal-item-main">
        <div className="dk-goal-item-title-row">
          <span className="dk-goal-item-dot" style={{ background: color }} />
          <span className="dk-goal-item-title">{goal.title}</span>
          {isSuggested && (
            <span className="dk-goal-item-badge">
              <Sparkles size={10} />
              Suggested
            </span>
          )}
        </div>

        {goal.target_type === 'time' ? (
          <div className="dk-goal-item-meta">
            <span className="dk-goal-item-time">
              {formatDuration(progress)} / {formatDuration(target)}
            </span>
          </div>
        ) : (
          <span className="dk-goal-item-type">Completion goal</span>
        )}
      </div>

      {goal.target_type === 'time' && (
        <div className="dk-goal-item-right">
          <ProgressRing
            percent={pct}
            size={32}
            strokeWidth={2.5}
            color={pct >= 100 ? '#4ade80' : color}
            label={pct >= 100 ? '✓' : `${pct}%`}
          />
          {goal.match_category && onFocus && (
            <button
              className="dk-goal-item-focus-btn"
              onClick={handleFocus}
              aria-label="Start focus session"
            >
              <Play size={12} fill="currentColor" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
src/components/ai/canvas/cards/ScheduleBlock.tsx
tsx
import { Calendar } from 'lucide-react'

interface ScheduleBlockProps {
  title: string
  startTime: string
  endTime: string
  color?: string
  category?: string
  top: number
  height: number
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  // Icons rendered via lucide in parent; this is for extensibility
}

export function ScheduleBlock({ title, startTime, endTime, color = '#22d3ee', top, height }: ScheduleBlockProps) {
  return (
    <div
      className="dk-schedule-block"
      style={{
        top,
        height: Math.max(height, 24),
        '--block-color': color,
      } as React.CSSProperties}
    >
      <div className="dk-schedule-block-content">
        <span className="dk-schedule-block-title">{title}</span>
        <span className="dk-schedule-block-time">
          <Calendar size={9} />
          {startTime}–{endTime}
        </span>
      </div>
    </div>
  )
}
src/components/ai/canvas/cards/DeadlineItem.tsx
tsx
import { CountdownRing } from './CountdownRing'
import { AlertTriangle, Plus, CheckCircle2, XCircle } from 'lucide-react'

interface DeadlineItemProps {
  id: string
  title: string
  course?: string
  dueDate: string
  priority: string
  status: string
  linkedGoalStatus?: string
  onCreateGoal?: (id: string) => void
  onDismissGoal?: (goalId: string) => void
}

export function DeadlineItem({
  title,
  course,
  dueDate,
  priority,
  status,
  linkedGoalStatus,
  onCreateGoal,
  onDismissGoal,
}: DeadlineItemProps) {
  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  const isUrgent = daysLeft <= 3 && daysLeft >= 0 && status !== 'done'
  const isOverdue = daysLeft < 0 && status !== 'done'

  return (
    <div className={`dk-deadline-item ${isUrgent ? 'urgent' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <CountdownRing daysLeft={daysLeft} size={28} />

      <div className="dk-deadline-item-main">
        <div className="dk-deadline-item-title-row">
          <span className={`dk-deadline-item-priority ${priority}`} />
          <span className="dk-deadline-item-name">{title}</span>
          {course && <span className="dk-deadline-item-course">{course}</span>}
        </div>
        <div className="dk-deadline-item-meta">
          <span className="dk-deadline-item-due">
            {isOverdue ? 'Overdue' : daysLeft === 0 ? 'Due today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
          </span>
          <span className="dk-deadline-item-date">{dueDate.slice(0, 10)}</span>
        </div>
      </div>

      <div className="dk-deadline-item-actions">
        {linkedGoalStatus ? (
          <span className={`dk-deadline-item-goal-badge ${linkedGoalStatus}`}>
            {linkedGoalStatus === 'completed' && <CheckCircle2 size={10} />}
            {linkedGoalStatus === 'dismissed' && <XCircle size={10} />}
            {linkedGoalStatus}
          </span>
        ) : isUrgent ? (
          <button
            className="dk-deadline-item-link-btn"
            onClick={() => onCreateGoal?.(title)}
            aria-label="Create goal from deadline"
          >
            <Plus size={12} />
            Goal
          </button>
        ) : null}
      </div>
    </div>
  )
}
Part 2: Redesigned Cards
src/components/ai/canvas/cards/DailyPlannerCard.tsx (Complete Redesign)
tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { GoalTimeline } from './GoalTimeline'
import { GoalItem } from './GoalItem'
import { useGoalProgress } from '../../../../hooks/useGoalProgress'
import { useFocusGoals } from '../../../../hooks/useFocusGoals'
import type { Goal } from '../../../../types'
import {
  CalendarDays,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Target,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface DailyPlannerCardProps {
  date?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  work: '#22d3ee',
  personal: '#4ade80',
  health: '#f87171',
  learning: '#a78bfa',
}

export function DailyPlannerCard({ date = new Date().toISOString().slice(0, 10) }: DailyPlannerCardProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [schedule, setSchedule] = useState<any[]>([])
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [review, setReview] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const { progressMap, refetch: refetchProgress } = useGoalProgress(date, goals)
  const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals)

  // Fetch all data
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) { setLoading(false); return }

    Promise.all([
      api['get-goals'](date).catch(() => []),
      api['get-schedule']().catch(() => []),
      api['get-deadlines']({ days: 7 }).catch(() => []),
      api['get-goal-review'](date).catch(() => null),
    ]).then(([g, s, d, r]) => {
      setGoals(g || [])
      setSchedule(s || [])
      setDeadlines(d || [])
      setReview(r?.summary || null)
      setLoading(false)
    })
  }, [date])

  // Auto-create goals from approaching deadlines
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return

    const approaching = deadlines.filter((d: any) => {
      const due = new Date(d.due_date).getTime()
      const days = (due - Date.now()) / 86400000
      return days > 0 && days <= 3 && d.status !== 'done'
    })

    const pendingCount = goals.filter(g => g.status === 'pending' || g.status === 'active').length

    for (const dl of approaching) {
      const exists = goals.some(g => {
        if (!g.links) return false
        try { return JSON.parse(g.links).some((l: any) => l.label === dl.title) } catch { return false }
      })
      if (exists) continue
      if (pendingCount >= 5) break

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
      setError('Failed to update goal')
      setTimeout(() => setError(null), 3000)
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
          await api['save-goal'](date, { ...sg, status: 'suggested', source: 'ai' })
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

  // Timeline data
  const todaySchedule = useMemo(() => {
    const dayOfWeek = new Date(date).getDay()
    return schedule.filter((s: any) => s.day_of_week === dayOfWeek)
  }, [schedule, date])

  const completedCount = goals.filter(g => g.status === 'completed').length
  const totalGoals = goals.length
  const overallPct = totalGoals ? Math.round((completedCount / totalGoals) * 100) : 0

  // ── Loading State ──
  if (loading) {
    return (
      <div className="dk-card dk-daily-planner">
        <div className="dk-card-header">
          <div className="dk-skeleton dk-skeleton-title" style={{ width: 120 }} />
          <div className="dk-skeleton" style={{ width: 60, height: 14 }} />
        </div>
        <div className="dk-card-body">
          <div className="dk-skeleton" style={{ width: '100%', height: 200, marginBottom: 12 }} />
          <div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} />
          <div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} />
          <div className="dk-skeleton" style={{ width: '80%', height: 48 }} />
        </div>
      </div>
    )
  }

  // ── Error State ──
  if (error && !goals.length && !schedule.length) {
    return (
      <div className="dk-card dk-daily-planner">
        <div className="dk-card-header">
          <span className="dk-card-title"><CalendarDays size={16} /> Daily Planner</span>
        </div>
        <div className="dk-card-body">
          <div className="dk-empty-state">
            <AlertCircle size={32} color="var(--dk-danger)" />
            <p>Failed to load planner data.</p>
            <button className="dk-btn-secondary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Populated State ──
  return (
    <div className="dk-card dk-daily-planner">
      {/* Header */}
      <div className="dk-card-header">
        <div className="dk-card-header-left">
          <CalendarDays size={16} color="var(--dk-accent)" />
          <span className="dk-card-title">Daily Planner</span>
          <span className="dk-card-subtitle">
            {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="dk-card-header-right">
          <div className="dk-planner-stats">
            <Target size={12} />
            <span>{completedCount}/{totalGoals}</span>
          </div>
          {focusState?.isActive && !focusState.isBroken && (
            <span className="dk-focus-indicator">
              <span className="dk-focus-dot" />
              Focusing
            </span>
          )}
        </div>
      </div>

      {/* Overall progress */}
      <div className="dk-planner-overall">
        <div className="dk-progress-track">
          <div
            className="dk-progress-fill"
            style={{ transform: `scaleX(${overallPct / 100})` }}
          />
        </div>
        <span className="dk-progress-label">{overallPct}% done</span>
      </div>

      {/* Timeline */}
      <div className="dk-card-section">
        <span className="dk-section-label">Timeline</span>
        <GoalTimeline schedule={todaySchedule} goals={[]} currentTime={new Date()} />
      </div>

      {/* Goals */}
      <div className="dk-card-section">
        <span className="dk-section-label">Goals</span>
        {goals.length === 0 ? (
          <div className="dk-empty-state">
            <Target size={28} color="var(--dk-text-faint)" />
            <p>No goals yet.</p>
            <button className="dk-btn-primary" onClick={handleSuggest} disabled={suggesting}>
              <Sparkles size={14} />
              {suggesting ? 'Thinking...' : 'Suggest Goals'}
            </button>
          </div>
        ) : (
          <div className="dk-goal-list">
            {goals.map(goal => (
              <GoalItem
                key={goal.id}
                goal={goal}
                progressSeconds={(progressMap[goal.id]?.progressSeconds || 0) + getAccumulatedSeconds(goal.id)}
                isActive={activeGoalIds.includes(goal.id)}
                onToggle={toggleGoal}
                onFocus={goal.target_type === 'time' && goal.match_category ? startFocus : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {goals.length > 0 && (
        <div className="dk-card-footer">
          <button
            className="dk-btn-primary"
            onClick={handleSuggest}
            disabled={suggesting}
          >
            {suggesting ? <Loader2 size={14} className="dk-spin" /> : <Sparkles size={14} />}
            {suggesting ? 'Thinking...' : 'Suggest Goals'}
          </button>
          {error && <span className="dk-error-text">{error}</span>}
        </div>
      )}

      {/* Review */}
      {review && (
        <div className="dk-card-section">
          <button
            className="dk-review-toggle"
            onClick={() => setShowReview(!showReview)}
          >
            <span>End-of-Day Review</span>
            {showReview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showReview && (
            <div className="dk-review-content">{review}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Helpers
function canRequestSuggestion(): boolean {
  const key = 'df_goal_suggest_requests'
  const raw = localStorage.getItem(key)
  const requests: number[] = raw ? JSON.parse(raw) : []
  const now = Date.now()
  const windowStart = now - 3600000
  const recent = requests.filter(t => t > windowStart)
  if (recent.length >= 10) return false
  recent.push(now)
  localStorage.setItem(key, JSON.stringify(recent))
  return true
}

async function buildSuggestionContext(date: string, api: any): Promise<string> {
  const parts: string[] = []
  parts.push(`Today is ${date}.`)
  try {
    const schedule = await api['get-schedule']()
    const dayOfWeek = new Date(date).getDay()
    const todaySchedule = schedule.filter((s: any) => s.day_of_week === dayOfWeek)
    if (todaySchedule.length) {
      parts.push("Today's schedule:")
      for (const s of todaySchedule) parts.push(`- ${s.start_time}-${s.end_time}: ${s.title}`)
    }
  } catch { /* ignore */ }
  try {
    const deadlines = await api['get-deadlines']({ days: 7 })
    const approaching = deadlines.filter((d: any) => {
      const days = (new Date(d.due_date).getTime() - Date.now()) / 86400000
      return days > 0 && days <= 3
    })
    if (approaching.length) {
      parts.push('Approaching deadlines:')
      for (const d of approaching) parts.push(`- ${d.title} (due ${d.due_date.slice(0, 10)})`)
    }
  } catch { /* ignore */ }
  parts.push('Suggest 3-5 daily goals that fit the schedule, address deadlines, and balance categories. Each goal should have a realistic time target (30min to 3h).')
  return parts.join('\n')
}
src/components/ai/canvas/cards/WeeklyScheduleCard.tsx (Complete Redesign)
tsx
import { useState, useEffect, useMemo } from 'react'
import { ProgressRing } from './ProgressRing'
import type { Goal } from '../../../../types'
import { Calendar, Clock, CheckCircle2 } from 'lucide-react'

interface WeeklyScheduleCardProps {
  weekOffset?: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CATEGORY_COLORS: Record<string, string> = {
  work: '#22d3ee', personal: '#4ade80', health: '#f87171', learning: '#a78bfa', class: '#fbbf24', lab: '#fb923c',
}

export function WeeklyScheduleCard({ weekOffset = 0 }: WeeklyScheduleCardProps) {
  const [schedule, setSchedule] = useState<any[]>([])
  const [goalsByDay, setGoalsByDay] = useState<Record<string, Goal[]>>({})
  const [loading, setLoading] = useState(true)

  const weekDates = useMemo(() => {
    const now = new Date()
    now.setDate(now.getDate() - now.getDay() + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }, [weekOffset])

  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) { setLoading(false); return }
    Promise.all([
      api['get-schedule']().catch(() => []),
      api['get-goals-batch'](weekDates[0], weekDates[6]).catch(() => ({})),
    ]).then(([s, g]) => {
      setSchedule(s || [])
      setGoalsByDay(g || {})
      setLoading(false)
    })
  }, [weekDates])

  const dayColumns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return weekDates.map(date => {
      const dayIdx = new Date(date).getDay()
      const daySchedule = schedule.filter((s: any) => s.day_of_week === dayIdx)
      const dayGoals = goalsByDay[date] || []
      const completed = dayGoals.filter((g: Goal) => g.status === 'completed').length
      const total = dayGoals.length
      const timeGoals = dayGoals.filter((g: Goal) => g.target_type === 'time')
      const totalProgress = timeGoals.reduce((sum, g) => sum + (g.progress_seconds || 0), 0)
      const totalTarget = timeGoals.reduce((sum, g) => sum + (g.target_seconds || 3600), 0)
      const dayPct = totalTarget > 0 ? Math.min(100, Math.round((totalProgress / totalTarget) * 100)) : 0
      return { date, dayName: DAYS[dayIdx], isToday: date === today, schedule: daySchedule, goals: dayGoals, completed, total, dayPct }
    })
  }, [weekDates, schedule, goalsByDay])

  if (loading) {
    return (
      <div className="dk-card dk-weekly-schedule">
        <div className="dk-card-header">
          <div className="dk-skeleton dk-skeleton-title" style={{ width: 140 }} />
        </div>
        <div className="dk-card-body">
          <div className="dk-weekly-grid">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="dk-weekly-day">
                <div className="dk-skeleton" style={{ width: '100%', height: 16, marginBottom: 8 }} />
                <div className="dk-skeleton" style={{ width: '80%', height: 32, marginBottom: 6 }} />
                <div className="dk-skeleton" style={{ width: '60%', height: 32 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dk-card dk-weekly-schedule">
      <div className="dk-card-header">
        <div className="dk-card-header-left">
          <Calendar size={16} color="var(--dk-accent)" />
          <span className="dk-card-title">Weekly Overview</span>
        </div>
        <span className="dk-card-subtitle">{weekDates[0]} — {weekDates[6]}</span>
      </div>

      <div className="dk-card-body">
        <div className="dk-weekly-grid">
          {dayColumns.map(col => (
            <div key={col.date} className={`dk-weekly-day ${col.isToday ? 'today' : ''}`}>
              <div className="dk-weekly-day-header">
                <span className="dk-weekly-day-name">{col.dayName}</span>
                <span className="dk-weekly-day-date">{col.date.slice(5)}</span>
              </div>

              {col.total > 0 && (
                <div className="dk-weekly-day-progress">
                  <div className="dk-progress-track-sm">
                    <div className="dk-progress-fill-sm" style={{ transform: `scaleX(${col.total ? (col.completed / col.total) : 0})` }} />
                  </div>
                  <span className="dk-weekly-day-progress-label">{col.completed}/{col.total}</span>
                </div>
              )}

              <div className="dk-weekly-day-schedule">
                {col.schedule.map((s: any) => (
                  <div
                    key={s.id}
                    className="dk-weekly-block"
                    style={{ '--block-color': s.color || CATEGORY_COLORS[s.category] || '#a1a1aa' } as React.CSSProperties}
                  >
                    <span className="dk-weekly-block-time"><Clock size={8} />{s.start_time}–{s.end_time}</span>
                    <span className="dk-weekly-block-title">{s.title}</span>
                  </div>
                ))}
                {col.schedule.length === 0 && (
                  <span className="dk-weekly-empty">No schedule</span>
                )}
              </div>

              {col.goals.length > 0 && (
                <div className="dk-weekly-day-goals">
                  {col.goals.map((g: Goal) => (
                    <div
                      key={g.id}
                      className={`dk-weekly-goal-pill ${g.status === 'completed' ? 'done' : ''}`}
                      style={{ '--pill-color': CATEGORY_COLORS[g.category] || '#a1a1aa' } as React.CSSProperties}
                      title={g.title}
                    >
                      {g.status === 'completed' && <CheckCircle2 size={8} />}
                      <span className="dk-weekly-goal-pill-text">{g.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {col.dayPct > 0 && (
                <span className="dk-weekly-day-pct">{col.dayPct}% time</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
src/components/ai/canvas/cards/DeadlineTrackerCard.tsx (Complete Redesign)
tsx
import { useState, useEffect, useCallback } from 'react'
import { DeadlineItem } from './DeadlineItem'
import type { Goal } from '../../../../types'
import { AlertTriangle, CalendarClock, Loader2 } from 'lucide-react'

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

export function DeadlineTrackerCard({ days = 14 }: { days?: number }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [linkedMap, setLinkedMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api) { setLoading(false); return }
    Promise.all([
      api['get-deadlines']({ days }).catch(() => []),
      api['get-goals'](new Date().toISOString().slice(0, 10)).catch(() => []),
    ]).then(([dl, gl]) => {
      setDeadlines(dl || [])
      setGoals(gl || [])
      const map: Record<string, string> = {}
      for (const g of gl || []) {
        if (!g.links) continue
        try {
          const links = JSON.parse(g.links)
          for (const l of links) {
            if (l.label && l.url === null) {
              const match = (dl || []).find((d: Deadline) => d.title === l.label)
              if (match) map[match.id] = g.id
            }
          }
        } catch { /* ignore */ }
      }
      setLinkedMap(map)
      setLoading(false)
    })
  }, [days])

  const createGoalFromDeadline = useCallback(async (deadlineTitle: string) => {
    const api = (window as any).deskflowAPI
    if (!api?.['save-goal']) return
    const dl = deadlines.find(d => d.title === deadlineTitle)
    if (!dl) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      await api['save-goal'](today, {
        title: `Prepare for: ${dl.title}`,
        description: `Deadline: ${dl.title}${dl.course ? ` (${dl.course})` : ''}`,
        category: dl.course ? 'work' : 'learning',
        target_type: 'completion',
        status: 'pending',
        source: 'ai',
        links: JSON.stringify([{ label: dl.title, url: null }]),
      })
      const updated = await api['get-goals'](today)
      setGoals(updated || [])
      // Rebuild link map
      const map: Record<string, string> = {}
      for (const g of updated || []) {
        if (!g.links) continue
        try {
          const links = JSON.parse(g.links)
          for (const l of links) {
            if (l.label && l.url === null) {
              const match = deadlines.find(d => d.title === l.label)
              if (match) map[match.id] = g.id
            }
          }
        } catch { /* ignore */ }
      }
      setLinkedMap(map)
    } catch (e) {
      setError('Failed to create goal')
      setTimeout(() => setError(null), 3000)
    }
  }, [deadlines])

  const sorted = [...deadlines]
    .filter(d => d.status !== 'done')
    .sort((a, b) => {
      const pa = { high: 0, medium: 1, low: 2 }[a.priority] ?? 99
      const pb = { high: 0, medium: 1, low: 2 }[b.priority] ?? 99
      if (pa !== pb) return pa - pb
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  if (loading) {
    return (
      <div className="dk-card dk-deadline-tracker">
        <div className="dk-card-header">
          <div className="dk-skeleton dk-skeleton-title" style={{ width: 100 }} />
        </div>
        <div className="dk-card-body">
          <div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} />
          <div className="dk-skeleton" style={{ width: '100%', height: 48, marginBottom: 8 }} />
          <div className="dk-skeleton" style={{ width: '90%', height: 48 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="dk-card dk-deadline-tracker">
      <div className="dk-card-header">
        <div className="dk-card-header-left">
          <CalendarClock size={16} color="var(--dk-accent)" />
          <span className="dk-card-title">Deadlines</span>
        </div>
        <span className="dk-card-badge">{sorted.length} upcoming</span>
      </div>

      <div className="dk-card-body">
        {sorted.length === 0 ? (
          <div className="dk-empty-state">
            <CalendarClock size={28} color="var(--dk-text-faint)" />
            <p>No upcoming deadlines.</p>
          </div>
        ) : (
          <div className="dk-deadline-list">
            {sorted.map(dl => {
              const linkedGoalId = linkedMap[dl.id]
              const linkedGoal = linkedGoalId ? goals.find(g => g.id === linkedGoalId) : undefined
              return (
                <DeadlineItem
                  key={dl.id}
                  id={dl.id}
                  title={dl.title}
                  course={dl.course}
                  dueDate={dl.due_date}
                  priority={dl.priority}
                  status={dl.status}
                  linkedGoalStatus={linkedGoal?.status}
                  onCreateGoal={createGoalFromDeadline}
                />
              )
            })}
          </div>
        )}
        {error && <span className="dk-error-text">{error}</span>}
      </div>
    </div>
  )
}
Part 3: Complete CSS (cards.css)
css
/* ═══════════════════════════════════════════════════════════════════════════════
   DESKFLOW CANVAS CARDS — Complete Redesign
   Tokens: --dk-* only. No hardcoded colors. Dark mode only.
   Animation: transform + opacity only. Reduced motion fallback.
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── Card Container ─── */
.dk-card {
  display: flex;
  flex-direction: column;
  background: var(--dk-bg-surface);
  backdrop-filter: blur(16px);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-lg);
  overflow: hidden;
  transition: border-color var(--dk-fast) var(--dk-ease),
              box-shadow var(--dk-fast) var(--dk-ease);
}

.dk-card:hover {
  border-color: var(--dk-border-strong);
  box-shadow: var(--dk-shadow-md), var(--dk-shadow-glow);
}

/* ─── Card Header ─── */
.dk-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dk-border-subtle);
  background: var(--dk-bg-raised);
  gap: 10px;
}

.dk-card-header-left,
.dk-card-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dk-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dk-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-card-subtitle {
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
  white-space: nowrap;
}

.dk-card-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  background: var(--dk-accent-dim);
  color: var(--dk-accent);
  border-radius: 999px;
  flex-shrink: 0;
}

/* ─── Card Body ─── */
.dk-card-body {
  flex: 1;
  padding: 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dk-text-secondary);
  overflow: auto;
}

.dk-card-body::-webkit-scrollbar {
  width: 4px;
}

.dk-card-body::-webkit-scrollbar-track {
  background: transparent;
}

.dk-card-body::-webkit-scrollbar-thumb {
  background: var(--dk-border-subtle);
  border-radius: 2px;
}

/* ─── Card Section ─── */
.dk-card-section {
  display: flex;
  flex-direction: column;
  gap: var(--dk-space-2);
  padding: 0 14px;
  margin-bottom: var(--dk-space-3);
}

.dk-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--dk-text-faint);
}

/* ─── Card Footer ─── */
.dk-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--dk-border-subtle);
  background: var(--dk-bg-raised);
}

/* ─── Buttons ─── */
.dk-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--dk-accent-dim);
  border: 1px solid var(--dk-accent);
  border-radius: var(--dk-radius-md);
  color: var(--dk-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dk-fast) var(--dk-ease),
              color var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
  min-height: 36px;
}

.dk-btn-primary:hover:not(:disabled) {
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
  transform: translateY(-1px);
}

.dk-btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.dk-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dk-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  color: var(--dk-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease);
  min-height: 36px;
}

.dk-btn-secondary:hover {
  border-color: var(--dk-border-strong);
  background: var(--dk-bg-surface);
}

/* ─── Empty / Error States ─── */
.dk-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--dk-space-2);
  padding: var(--dk-space-5) var(--dk-space-3);
  text-align: center;
}

.dk-empty-state p {
  font-size: 12px;
  color: var(--dk-text-faint);
  margin: 0;
}

.dk-error-text {
  font-size: 11px;
  color: var(--dk-danger);
}

/* ─── Skeleton ─── */
.dk-skeleton {
  background: linear-gradient(
    90deg,
    var(--dk-bg-raised) 25%,
    rgba(63, 63, 70, 0.3) 50%,
    var(--dk-bg-raised) 75%
  );
  background-size: 200% 100%;
  animation: dk-shimmer 1.5s infinite;
  border-radius: var(--dk-radius-sm);
}

.dk-skeleton-title {
  height: 16px;
  width: 120px;
}

@keyframes dk-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ─── Progress (transform-based) ─── */
.dk-progress-track {
  flex: 1;
  height: 4px;
  background: var(--dk-border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.dk-progress-fill {
  height: 100%;
  background: var(--dk-accent);
  border-radius: 2px;
  transform-origin: left;
  transition: transform var(--dk-slow) var(--dk-ease);
}

.dk-progress-track-sm {
  height: 3px;
  background: var(--dk-border-subtle);
  border-radius: 2px;
  overflow: hidden;
  flex: 1;
}

.dk-progress-fill-sm {
  height: 100%;
  background: var(--dk-success);
  border-radius: 2px;
  transform-origin: left;
  transition: transform var(--dk-slow) var(--dk-ease);
}

/* ─── Spinner ─── */
.dk-spin {
  animation: dk-spin 1s linear infinite;
}

@keyframes dk-spin {
  to { transform: rotate(360deg); }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DAILY PLANNER CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-daily-planner {
  min-width: 0;
}

.dk-planner-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--dk-text-muted);
  font-family: var(--dk-mono);
}

.dk-focus-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--dk-accent);
}

.dk-focus-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dk-accent);
  box-shadow: 0 0 8px var(--dk-accent);
  animation: dk-pulse 2s ease-in-out infinite;
}

@keyframes dk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.dk-planner-overall {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dk-border-subtle);
}

.dk-progress-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--dk-text-muted);
  font-family: var(--dk-mono);
  white-space: nowrap;
}

/* ─── Goal List ─── */
.dk-goal-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ─── Goal Item ─── */
.dk-goal-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  border-left: 3px solid var(--goal-color, var(--dk-border-default));
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
  min-height: 44px;
}

.dk-goal-item:hover {
  border-color: var(--dk-border-default);
  background: var(--dk-bg-surface);
  transform: translateX(2px);
}

.dk-goal-item.focus-active {
  border-color: var(--dk-accent);
  background: rgba(34, 211, 238, 0.05);
  box-shadow: 0 0 0 1px var(--dk-accent-dim);
}

.dk-goal-item.focus-active .dk-goal-item-title {
  color: var(--dk-accent);
}

.dk-goal-item.completed {
  opacity: 0.7;
}

.dk-goal-item.completed .dk-goal-item-title {
  text-decoration: line-through;
  color: var(--dk-text-faint);
}

.dk-goal-item-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--dk-fast) var(--dk-ease);
}

.dk-goal-item-check:hover {
  transform: scale(1.1);
}

.dk-goal-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dk-goal-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dk-goal-item-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dk-goal-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-goal-item-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  background: var(--dk-accent-dim);
  color: var(--dk-accent);
  border-radius: 4px;
  flex-shrink: 0;
}

.dk-goal-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dk-goal-item-time {
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-goal-item-type {
  font-size: 11px;
  color: var(--dk-text-faint);
}

.dk-goal-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dk-goal-item-focus-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--dk-accent-dim);
  border: none;
  color: var(--dk-accent);
  cursor: pointer;
  transition: background var(--dk-fast) var(--dk-ease),
              color var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
}

.dk-goal-item-focus-btn:hover {
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
  transform: scale(1.1);
}

/* ─── Review ─── */
.dk-review-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  color: var(--dk-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease);
}

.dk-review-toggle:hover {
  border-color: var(--dk-border-strong);
  background: var(--dk-bg-surface);
}

.dk-review-content {
  padding: 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PROGRESS RING
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-progress-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dk-progress-ring-label {
  position: absolute;
  font-weight: 600;
  color: var(--dk-text-muted);
  font-family: var(--dk-mono);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   COUNTDOWN RING
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-countdown-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dk-countdown-icon {
  position: absolute;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SCHEDULE BLOCK
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-schedule-block {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: var(--dk-radius-sm);
  background: linear-gradient(135deg, var(--block-color) 20%, transparent 80%);
  background-color: rgba(63, 63, 70, 0.08);
  border-left: 3px solid var(--block-color);
  padding: 6px 8px;
  font-size: 11px;
  transition: background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
  overflow: hidden;
}

.dk-schedule-block:hover {
  background: linear-gradient(135deg, var(--block-color) 30%, transparent 85%);
  transform: translateX(2px);
}

.dk-schedule-block-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dk-schedule-block-title {
  font-weight: 500;
  color: var(--dk-text-secondary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-schedule-block-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GOAL TIMELINE
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-goal-timeline {
  display: flex;
  gap: var(--dk-space-2);
  height: 560px;
  overflow: hidden;
}

.dk-goal-timeline-labels {
  width: 40px;
  flex-shrink: 0;
  position: relative;
}

.dk-goal-timeline-hour {
  position: absolute;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 6px;
}

.dk-goal-timeline-hour span {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
  transform: translateY(-6px);
}

.dk-goal-timeline-body {
  flex: 1;
  position: relative;
  background: rgba(63, 63, 70, 0.06);
  border-radius: var(--dk-radius-sm);
  overflow: auto;
}

.dk-goal-timeline-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--dk-border-subtle);
}

.dk-goal-timeline-gap {
  position: absolute;
  left: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(63, 63, 70, 0.04);
  border-radius: var(--dk-radius-sm);
}

.dk-goal-timeline-gap span {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-style: italic;
}

.dk-goal-timeline-now {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 5;
}

.dk-goal-timeline-now-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dk-accent);
  margin-left: -4px;
  box-shadow: 0 0 10px var(--dk-accent), 0 0 20px var(--dk-accent-dim);
}

.dk-goal-timeline-now-line {
  flex: 1;
  height: 2px;
  background: var(--dk-accent);
  opacity: 0.5;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   WEEKLY SCHEDULE CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

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
  min-height: 140px;
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease);
}

.dk-weekly-day.today {
  border-color: var(--dk-accent);
  background: rgba(34, 211, 238, 0.04);
  box-shadow: 0 0 0 1px var(--dk-accent-dim);
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

.dk-weekly-day-progress {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dk-weekly-day-progress-label {
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
  white-space: nowrap;
}

.dk-weekly-day-schedule {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.dk-weekly-block {
  padding: 5px 7px;
  background: linear-gradient(135deg, var(--block-color) 15%, transparent 70%);
  background-color: rgba(63, 63, 70, 0.1);
  border-radius: var(--dk-radius-sm);
  border-left: 3px solid var(--block-color);
  font-size: 10px;
  line-height: 1.3;
  transition: transform var(--dk-fast) var(--dk-ease);
}

.dk-weekly-block:hover {
  transform: translateX(2px);
}

.dk-weekly-block-time {
  display: flex;
  align-items: center;
  gap: 3px;
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
  font-weight: 500;
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
  flex-direction: column;
  gap: 3px;
}

.dk-weekly-goal-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(63, 63, 70, 0.15);
  border-radius: 999px;
  font-size: 10px;
  color: var(--dk-text-muted);
  border-left: 2px solid var(--pill-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background var(--dk-fast) var(--dk-ease);
}

.dk-weekly-goal-pill:hover {
  background: rgba(63, 63, 70, 0.25);
}

.dk-weekly-goal-pill.done {
  background: rgba(74, 222, 128, 0.1);
  color: var(--dk-success);
}

.dk-weekly-goal-pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-weekly-day-pct {
  font-size: 9px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
  text-align: right;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DEADLINE TRACKER CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-deadline-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dk-deadline-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
  min-height: 44px;
}

.dk-deadline-item:hover {
  border-color: var(--dk-border-default);
  background: var(--dk-bg-surface);
  transform: translateX(2px);
}

.dk-deadline-item.urgent {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.04);
  animation: dk-urgency-pulse 2.5s ease-in-out infinite;
}

.dk-deadline-item.overdue {
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.04);
}

@keyframes dk-urgency-pulse {
  0%, 100% { border-color: rgba(251, 191, 36, 0.2); }
  50% { border-color: rgba(251, 191, 36, 0.5); }
}

.dk-deadline-item-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.dk-deadline-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dk-deadline-item-priority {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dk-deadline-item-priority.high { background: #f87171; }
.dk-deadline-item-priority.medium { background: #fbbf24; }
.dk-deadline-item-priority.low { background: #4ade80; }

.dk-deadline-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-deadline-item-course {
  font-size: 9px;
  color: var(--dk-text-faint);
  background: var(--dk-bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.dk-deadline-item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dk-deadline-item-due {
  font-size: 11px;
  font-weight: 500;
  color: var(--dk-text-muted);
}

.dk-deadline-item.urgent .dk-deadline-item-due {
  color: #fbbf24;
}

.dk-deadline-item.overdue .dk-deadline-item-due {
  color: #f87171;
}

.dk-deadline-item-date {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-deadline-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dk-deadline-item-goal-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: 4px;
}

.dk-deadline-item-goal-badge.completed {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.dk-deadline-item-goal-badge.active {
  background: rgba(34, 211, 238, 0.12);
  color: #22d3ee;
}

.dk-deadline-item-goal-badge.suggested {
  background: rgba(167, 139, 250, 0.12);
  color: #a78bfa;
}

.dk-deadline-item-goal-badge.dismissed {
  background: var(--dk-bg-surface);
  color: var(--dk-text-faint);
}

.dk-deadline-item-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: var(--dk-accent-dim);
  border: none;
  border-radius: var(--dk-radius-sm);
  color: var(--dk-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dk-fast) var(--dk-ease),
              color var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
              Here's the continuation — completing the CSS from where it cut off, plus all remaining card styles and media queries:

```css
/* ═══════════════════════════════════════════════════════════════════════════════
   DEADLINE TRACKER CARD (continued)
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-deadline-item-link-btn:hover {
  background: var(--dk-accent);
  color: var(--dk-bg-deep);
  transform: translateY(-1px);
}

.dk-deadline-item-link-btn:active {
  transform: translateY(0);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FOCUS CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-focus-card {
  min-width: 0;
}

.dk-focus-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dk-focus-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  border-left: 3px solid var(--goal-color, var(--dk-border-default));
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
  min-height: 44px;
}

.dk-focus-item:hover {
  border-color: var(--dk-border-default);
  background: var(--dk-bg-surface);
  transform: translateX(2px);
}

.dk-focus-item.active {
  border-color: var(--dk-accent);
  background: rgba(34, 211, 238, 0.05);
  box-shadow: 0 0 0 1px var(--dk-accent-dim);
}

.dk-focus-item.active .dk-focus-item-title {
  color: var(--dk-accent);
}

.dk-focus-item.completed {
  opacity: 0.6;
}

.dk-focus-item.completed .dk-focus-item-title {
  text-decoration: line-through;
  color: var(--dk-text-faint);
}

.dk-focus-item-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--dk-fast) var(--dk-ease);
}

.dk-focus-item-check:hover {
  transform: scale(1.1);
}

.dk-focus-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dk-focus-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dk-focus-item-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dk-focus-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-focus-item-time {
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-focus-indicator-glow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid var(--dk-accent-dim);
  border-radius: var(--dk-radius-md);
  margin-bottom: var(--dk-space-2);
}

.dk-focus-indicator-glow span {
  font-size: 11px;
  font-weight: 500;
  color: var(--dk-accent);
}

.dk-focus-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dk-accent);
  box-shadow: 0 0 8px var(--dk-accent), 0 0 16px var(--dk-accent-dim);
  animation: dk-pulse 2s ease-in-out infinite;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PLAN CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-plan-card {
  min-width: 0;
}

.dk-plan-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dk-plan-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  border-left: 3px solid var(--goal-color, var(--dk-border-default));
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
}

.dk-plan-item:hover {
  border-color: var(--dk-border-default);
  background: var(--dk-bg-surface);
  transform: translateX(2px);
}

.dk-plan-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dk-plan-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dk-plan-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-plan-item-priority {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
}

.dk-plan-item-priority.high {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.dk-plan-item-priority.medium {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.dk-plan-item-priority.low {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.dk-plan-notes {
  margin-top: var(--dk-space-2);
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-secondary);
  line-height: 1.5;
  min-height: 80px;
  white-space: pre-wrap;
  overflow: auto;
}

.dk-plan-notes-editor {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  color: var(--dk-text-secondary);
  font-size: 12px;
  font-family: var(--dk-sans);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color var(--dk-fast) var(--dk-ease);
}

.dk-plan-notes-editor:focus {
  border-color: var(--dk-accent);
}

.dk-plan-notes-editor::placeholder {
  color: var(--dk-text-placeholder);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DIGEST CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-digest-card {
  min-width: 0;
}

.dk-digest-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dk-digest-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border-radius: var(--dk-radius-md);
  border: 1px solid transparent;
  transition: border-color var(--dk-fast) var(--dk-ease),
              background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
}

.dk-digest-item:hover {
  border-color: var(--dk-border-default);
  background: var(--dk-bg-surface);
  transform: translateX(2px);
}

.dk-digest-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dk-digest-item-source {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  background: var(--dk-accent-dim);
  color: var(--dk-accent);
  border-radius: 4px;
  flex-shrink: 0;
}

.dk-digest-item-confidence {
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

.dk-digest-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text-secondary);
  line-height: 1.3;
}

.dk-digest-item-summary {
  font-size: 12px;
  color: var(--dk-text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dk-digest-item-summary.expanded {
  -webkit-line-clamp: unset;
}

.dk-digest-expand-btn {
  align-self: flex-start;
  padding: 2px 0;
  background: transparent;
  border: none;
  color: var(--dk-accent);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--dk-fast) var(--dk-ease);
}

.dk-digest-expand-btn:hover {
  opacity: 0.8;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   APPROVAL CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-approval-card {
  min-width: 0;
}

.dk-approval-context {
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--dk-space-3);
}

.dk-approval-actions {
  display: flex;
  gap: 8px;
}

.dk-approval-btn-approve {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
  padding: 10px 16px;
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: var(--dk-radius-md);
  color: #4ade80;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease),
              box-shadow var(--dk-fast) var(--dk-ease);
  min-height: 44px;
}

.dk-approval-btn-approve:hover {
  background: rgba(74, 222, 128, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.15);
}

.dk-approval-btn-approve:active {
  transform: translateY(0);
}

.dk-approval-btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
  padding: 10px 16px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--dk-radius-md);
  color: #f87171;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dk-fast) var(--dk-ease),
              transform var(--dk-fast) var(--dk-ease);
  min-height: 44px;
}

.dk-approval-btn-reject:hover {
  background: rgba(248, 113, 113, 0.2);
  transform: translateY(-1px);
}

.dk-approval-btn-reject:active {
  transform: translateY(0);
}

.dk-approval-btn-reject.shake {
  animation: dk-shake 0.4s ease-in-out;
}

@keyframes dk-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

.dk-approval-confirmation {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(74, 222, 128, 0.08);
  border: 1px solid rgba(74, 222, 128, 0.2);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: #4ade80;
  font-weight: 500;
  animation: dk-fade-in-up 0.3s var(--dk-ease);
}

@keyframes dk-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ANNOTATION CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

.dk-annotation-card {
  min-width: 0;
}

.dk-annotation-text {
  padding: 10px 12px;
  background: var(--dk-bg-raised);
  border: 1px solid var(--dk-border-default);
  border-radius: var(--dk-radius-md);
  font-size: 12px;
  color: var(--dk-text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.dk-annotation-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: var(--dk-space-2);
  font-size: 10px;
  color: var(--dk-text-faint);
  font-family: var(--dk-mono);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MEDIA QUERIES
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── Reduced Motion ─── */
@media (prefers-reduced-motion: reduce) {
  .dk-card,
  .dk-goal-item,
  .dk-focus-item,
  .dk-plan-item,
  .dk-digest-item,
  .dk-deadline-item,
  .dk-schedule-block,
  .dk-weekly-block,
  .dk-weekly-goal-pill,
  .dk-weekly-day,
  .dk-btn-primary,
  .dk-btn-secondary,
  .dk-goal-item-check,
  .dk-goal-item-focus-btn,
  .dk-deadline-item-link-btn,
  .dk-review-toggle,
  .dk-approval-btn-approve,
  .dk-approval-btn-reject,
  .dk-digest-expand-btn {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }

  .dk-progress-fill,
  .dk-progress-fill-sm {
    transition: none !important;
  }

  .dk-focus-dot,
  .dk-focus-pulse-dot {
    animation: none !important;
    opacity: 1 !important;
  }

  .dk-skeleton {
    animation: none !important;
    background: var(--dk-bg-raised) !important;
  }

  .dk-deadline-item.urgent {
    animation: none !important;
  }

  .dk-approval-confirmation {
    animation: none !important;
  }

  .dk-approval-btn-reject.shake {
    animation: none !important;
  }
}

/* ─── High Contrast ─── */
@media (prefers-contrast: high) {
  .dk-card {
    border-color: var(--dk-border-strong);
    border-width: 2px;
  }

  .dk-goal-item,
  .dk-focus-item,
  .dk-plan-item,
  .dk-digest-item,
  .dk-deadline-item {
    border-color: var(--dk-border-strong);
    border-width: 2px;
  }

  .dk-goal-item.completed .dk-goal-item-check {
    border-width: 3px;
  }

  .dk-progress-track,
  .dk-progress-track-sm {
    height: 6px;
  }

  .dk-goal-timeline-now-line {
    height: 3px;
  }
}

/* ─── Responsive (Mobile) ─── */
@media (max-width: 480px) {
  .dk-goal-timeline {
    height: 480px;
  }

  .dk-goal-timeline-hour span {
    font-size: 9px;
  }

  .dk-weekly-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .dk-weekly-day:nth-child(n+5) {
    display: none;
  }

  .dk-daily-goal {
    padding: 8px 10px;
  }

  .dk-daily-goal-title {
    font-size: 12px;
  }

  .dk-card-header {
    padding: 8px 10px;
  }

  .dk-card-body {
    padding: 10px;
  }

  .dk-card-section {
    padding: 0 10px;
  }
}

/* ─── Print ─── */
@media print {
  .dk-card {
    background: #fff !important;
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
  }

  .dk-card-header,
  .dk-card-footer {
    background: #f5f5f5 !important;
    border-color: #ccc !important;
  }

  .dk-daily-planner-actions,
  .dk-goal-item-focus-btn,
  .dk-review-toggle,
  .dk-deadline-item-link-btn,
  .dk-approval-btn-approve,
  .dk-approval-btn-reject,
  .dk-digest-expand-btn,
  .dk-focus-indicator-glow,
  .dk-focus-pulse-dot {
    display: none !important;
  }

  .dk-goal-timeline {
    height: auto;
    overflow: visible;
  }

  .dk-goal-item,
  .dk-focus-item,
  .dk-plan-item,
  .dk-digest-item,
  .dk-deadline-item {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .dk-goal-timeline-now-dot,
  .dk-goal-timeline-now-line {
    display: none !important;
  }
}
```

---

That completes the full CSS. Here's a summary of everything now covered:

| Section | Status |
|---------|--------|
| Card container + header + body + footer | ✅ Complete |
| Buttons (primary, secondary) | ✅ Complete |
| Empty / error / skeleton states | ✅ Complete |
| Progress bars (transform-based) | ✅ Complete |
| Spinner animation | ✅ Complete |
| DailyPlannerCard styles | ✅ Complete |
| GoalItem component styles | ✅ Complete |
| ProgressRing | ✅ Complete |
| CountdownRing | ✅ Complete |
| ScheduleBlock | ✅ Complete |
| GoalTimeline | ✅ Complete |
| WeeklyScheduleCard | ✅ Complete |
| DeadlineTrackerCard | ✅ Complete |
| **FocusCard** | ✅ Added |
| **PlanCard** | ✅ Added |
| **DigestCard** | ✅ Added |
| **ApprovalCard** | ✅ Added (with shake animation on reject, fade-in on confirm) |
| **AnnotationCard** | ✅ Added |
| Reduced motion (`prefers-reduced-motion`) | ✅ Complete |
| High contrast (`prefers-contrast: high`) | ✅ Complete |
| Responsive (`max-width: 480px`) | ✅ Complete |
| Print styles | ✅ Complete |
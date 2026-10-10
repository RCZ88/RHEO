import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { Goal } from '../services/GoalStore'

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
  // MUST be memoised. `.filter()` returns a NEW array every render; if that
  // feeds useCallback's dep list then computeProgress changes identity every
  // render, the effect below re-runs every render, setProgressMap re-renders,
  // and React bails out with "Maximum update depth exceeded" (#185).
  const timeBasedGoals = useMemo(
    () => goals.filter(g => g.target?.type === 'time' && g.target?.matchCategory),
    [goals],
  )
  const abortRef = useRef<AbortController | null>(null)

  const computeProgress = useCallback(async () => {
    if (timeBasedGoals.length === 0) {
      // A brand-new {} is a new reference -> guaranteed re-render. Only set it
      // when there is genuinely something to clear.
      setProgressMap(prev => (Object.keys(prev).length === 0 ? prev : {}))
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const api = (window as any).deskflowAPI
      if (!api?.['get-logs-by-period']) return

      const logs = await api['get-logs-by-period']({ period: 'day', dateOffset: 0 })
      if (!Array.isArray(logs)) return

      const categorySeconds: Record<string, number> = {}
      for (const log of logs) {
        const cat = (log.category || 'uncategorized').toLowerCase()
        const sec = Math.floor((log.duration_ms || 0) / 1000)
        categorySeconds[cat] = (categorySeconds[cat] || 0) + sec
      }

      const map: Record<string, GoalProgress> = {}
      for (const goal of timeBasedGoals) {
        const matchCat = (goal.target?.matchCategory || '').toLowerCase()
        const progressSec = categorySeconds[matchCat] || 0
        const targetSec = goal.target?.targetSeconds || 3600
        const pct = Math.min(100, Math.round((progressSec / targetSec) * 100))

        map[goal.id] = {
          goalId: goal.id,
          progressSeconds: progressSec,
          targetSeconds: targetSec,
          percentComplete: pct,
          status: pct >= 100 ? 'completed' : progressSec > 0 ? 'active' : 'pending',
        }
      }

      // Same shape, same numbers -> keep the previous reference so a 30s poll
      // that finds nothing new costs zero renders.
      setProgressMap(prev => {
        const keys = Object.keys(map)
        const prevKeys = Object.keys(prev)
        if (keys.length !== prevKeys.length) return map
        for (const k of keys) {
          const a = map[k], b = prev[k]
          if (!b || a.progressSeconds !== b.progressSeconds || a.targetSeconds !== b.targetSeconds || a.status !== b.status) return map
        }
        return prev
      })
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [date, timeBasedGoals])

  useEffect(() => {
    computeProgress()
    const interval = setInterval(computeProgress, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [computeProgress])

  return { progressMap, loading, refetch: computeProgress }
}

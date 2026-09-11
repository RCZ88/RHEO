import { useState, useEffect, useRef, useCallback } from 'react'
import type { Goal } from '../services/GoalStore'
import { GoalStore } from '../services/GoalStore'
import { useActiveFocusGroup, setActiveGroup, type ActiveFocusGroup } from './useActiveFocusGroup'
import { useFocusSession } from './useFocusSession'

interface FocusState {
  isActive: boolean
  isBroken: boolean
  allowedCategories: string[]
  sessionId?: string
}

export function matchGoalIds(goals: Goal[], allowedCategories: string[], activeGroupIds?: number[] | null): string[] {
  const allowed = allowedCategories.map(c => String(c).toLowerCase())
  const ids = (activeGroupIds ?? []).map(id => Number(id))
  return goals
    .filter(g => g.target?.type === 'time' && g.target?.matchCategory)
    .filter(g => {
      const matchCat = String(g.target?.matchCategory).toLowerCase()
      if (matchCat.startsWith('fg:')) {
        const gid = parseInt(matchCat.slice(3), 10)
        return ids.length > 0 && ids.includes(gid)
      }
      if (allowed.length === 0) return true
      return allowed.includes(matchCat)
    })
    .map(g => g.id)
}

export function useFocusGoals(goals: Goal[]) {
  const active = useActiveFocusGroup()
  const { state } = useFocusSession()
  const [tick, setTick] = useState(0)
  const goalsRef = useRef(goals)
  goalsRef.current = goals
  const wasActiveRef = useRef(false)
  const mountedRef = useRef(false)

  const sessionActive = !!state?.active
  const matchedIds = active
    ? matchGoalIds(goals, active.allowedCategories, active.groupIds ?? [active.groupId])
    : []

  const focusState: FocusState | null =
    active && sessionActive
      ? { isActive: true, isBroken: false, allowedCategories: active.allowedCategories, sessionId: String(active.sessionId) }
      : null

  const activeGoalIds = active && sessionActive ? matchedIds : []

  const flushAndClear = useCallback((grp: ActiveFocusGroup | null) => {
    if (!grp) return
    const ids = matchGoalIds(goalsRef.current, grp.allowedCategories, grp.groupIds ?? [grp.groupId])
    let flushed = false
    for (const gid of ids) {
      const goal = goalsRef.current.find(g => g.id === gid)
      if (!goal) continue
      const applied = GoalStore.applyAccumulated(goal)
      if ((applied.progressSeconds || 0) > (goal.progressSeconds || 0)) {
        const api = (window as any).deskflowAPI
        api?.saveGoal?.(applied.date, applied).catch((e: any) => console.error('[FocusGoals] save failed:', e))
        flushed = true
      }
      GoalStore.clearAccumulated(gid)
    }
    if (flushed) console.log('[FocusGoals] flushed accumulated focus time to goals')
    setActiveGroup(null)
  }, [])

  useEffect(() => {
    if (!active || !sessionActive || matchedIds.length === 0) return
    const id = setInterval(() => {
      for (const gid of matchedIds) GoalStore.accumulateProgress(gid, 1)
      setTick(t => t + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [active, sessionActive, matchedIds])

  useEffect(() => {
    if (sessionActive) {
      wasActiveRef.current = true
      return
    }
    if (!wasActiveRef.current) return
    wasActiveRef.current = false
    flushAndClear(active)
  }, [sessionActive, active, flushAndClear])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    if (active && !sessionActive) flushAndClear(active)
  }, [active, sessionActive, flushAndClear])

  const getAccumulatedSeconds = useCallback((goalId: string): number => {
    return GoalStore.getAccumulated(goalId)
  }, [])

  return { focusState, activeGoalIds, getAccumulatedSeconds, tick, matchedGoalIds: matchedIds }
}

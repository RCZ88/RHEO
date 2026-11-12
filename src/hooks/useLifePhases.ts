"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

import type { LifePhase } from '@/lib/riverMath'
import { sortPhases } from '@/lib/riverMath'

const api = () => window.deskflowAPI

export interface LifePhasesState {
  phases: LifePhase[]
  loading: boolean
  error: string | null
  summary: string | null
  summaryUpdatedAt: string | null
  /** D3: how many phases the current reflection was generated against. */
  summaryPhaseCount: number | null
}

/** D3 — the summary payload may be the new {text, at, phaseCount} object or a
 *  legacy bare string; accept both so old stored data keeps rendering. */
function parseSummaryPayload(data: unknown): { text: string | null; at: string | null; phaseCount: number | null } {
  if (!data) return { text: null, at: null, phaseCount: null }
  if (typeof data === 'string') return { text: data, at: null, phaseCount: null }
  const obj = data as { text?: unknown; at?: unknown; phaseCount?: unknown }
  const text = typeof obj.text === 'string' ? obj.text : null
  const at = typeof obj.at === 'string' ? obj.at : null
  const phaseCount = typeof obj.phaseCount === 'number' && Number.isFinite(obj.phaseCount) ? obj.phaseCount : null
  return { text, at, phaseCount }
}

export function useLifePhases() {
  const [phases, setPhases] = useState<LifePhase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<string | null>(null)
  const [summaryPhaseCount, setSummaryPhaseCount] = useState<number | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    try {
      setError(null)
      const [phasesRes, summaryRes] = await Promise.all([
        api().lifePhaseGet(),
        api().lifePhaseGetSummary(),
      ])
      if (!mounted.current) return
      setPhases(sortPhases((phasesRes.data as LifePhase[]) ?? []))
      const parsed = parseSummaryPayload(summaryRes.data)
      setSummary(parsed.text)
      setSummaryUpdatedAt(parsed.at)
      setSummaryPhaseCount(parsed.phaseCount)
      setLoading(false)
    } catch (e) {
      if (!mounted.current) return
      setError(e instanceof Error ? e.message : 'Failed to load life phases')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* Optimistic upsert — the river re-renders immediately, then we persist. */
  const savePhase = useCallback(
    async (phase: LifePhase, opts?: { silent?: boolean }): Promise<boolean> => {
      setError(null)
      setPhases(prev => sortPhases(prev.some(p => p.id === phase.id)
        ? prev.map(p => (p.id === phase.id ? { ...p, ...phase } : p))
        : [...prev, phase]))
      try {
        const res = await api().lifePhaseSave(phase)
        if (!mounted.current) return false
        if (!res.ok) {
          setError(res.error ?? 'Failed to save phase')
          if (opts?.silent) return false
        }
        return true
      } catch (e) {
        if (!mounted.current) return false
        setError(e instanceof Error ? e.message : 'Failed to save phase')
        return false
      }
    },
    []
  )

  const deletePhase = useCallback(async (phaseId: string): Promise<boolean> => {
    setError(null)
    setPhases(prev =>
      sortPhases(
        prev
          .filter(p => p.id !== phaseId)
          .map(p => (p.connections.includes(phaseId)
            ? { ...p, connections: p.connections.filter(c => c !== phaseId) }
            : p))
      )
    )
    try {
      const res = await api().lifePhaseDelete(phaseId)
      if (!mounted.current) return false
      if (!res.ok) {
        setError(res.error ?? 'Failed to delete phase')
        return false
      }
      return true
    } catch (e) {
      if (!mounted.current) return false
      setError(e instanceof Error ? e.message : 'Failed to delete phase')
      return false
    }
  }, [])

  const saveAll = useCallback(
    async (all: LifePhase[]): Promise<boolean> => {
      setPhases(sortPhases(all))
      try {
        const res = await api().lifePhaseSaveAll(all)
        if (!mounted.current) return false
        if (!res.ok) {
          setError(res.error ?? 'Failed to save phases')
          return false
        }
        return true
      } catch (e) {
        if (!mounted.current) return false
        setError(e instanceof Error ? e.message : 'Failed to save phases')
        return false
      }
    },
    []
  )

  /* Local echo for in-canvas renames — the drawer save persists the rest. */
  const renameLocal = useCallback((phaseId: string, title: string) => {
    setPhases(prev => sortPhases(prev.map(p => (p.id === phaseId ? { ...p, title } : p))))
  }, [])

  const reflect = useCallback(
    async (phase: LifePhase, answers: string[], variation?: string, captions?: { headerImageCaption: string; photoCaptions: string[]; milestonePhotoCaptions: string[] }): Promise<{ title?: string | null; text: string; confidence: 'grounded' | 'sparse' } | null> => {
      try {
        const res = await api().lifePhaseAiReflect({
          phaseId: phase.id,
          title: phase.title,
          category: phase.category,
          story: phase.description,
          milestones: phase.milestones ?? [],
          people: phase.people ?? [],
          moodStart: phase.moodStart ?? null,
          moodEnd: phase.moodEnd ?? null,
          moodTags: phase.moodTags ?? [],
          feelingsNote: phase.feelingsNote ?? null,
          lessonsLearned: phase.lessonsLearned ?? null,
          impactNotes: phase.impactNotes ?? null,
          variation: variation ?? null,
          headerImageCaption: captions?.headerImageCaption ?? '',
          photoCaptions: captions?.photoCaptions ?? [],
          milestonePhotoCaptions: captions?.milestonePhotoCaptions ?? [],
        })
        if (!res.ok) {
          setError(res.error ?? 'Reflection failed')
          return null
        }
        const text = (res.data?.reflection ?? res.data?.text ?? '') as string
        const title = (res.data?.title ?? null) as string | null
        const confidence = (res.data?.confidence === 'sparse' ? 'sparse' : 'grounded') as 'grounded' | 'sparse'
        setPhases(prev => sortPhases(prev.map(p => (p.id === phase.id ? { ...p, reflection: text, reflectionTitle: title, reflectionSource: 'ai', reflectionGeneratedAt: new Date().toISOString() } : p))))
        return { title, text, confidence }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Reflection failed')
        return null
      }
    },
    []
  )

  const eraTrends = useCallback(
    async (phase: LifePhase): Promise<string | null> => {
      try {
        const res = await api().lifePhaseAiEraTrends({
          startYear: phase.startYear,
          endYear: phase.endYear && phase.endYear > 0 ? phase.endYear : null,
          title: phase.title,
        })
        if (!res.ok) {
          setError(res.error ?? 'Era trends failed')
          return null
        }
        const text = (res.data as string) ?? ''
        setPhases(prev => sortPhases(prev.map(p => (p.id === phase.id ? { ...p, eraTrends: text } : p))))
        return text
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Era trends failed')
        return null
      }
    },
    []
  )

  const summarize = useCallback(async (): Promise<string | null> => {
    try {
      const res = await api().lifePhaseAiSummarize(phases)
      if (!res.ok) {
        setError(res.error ?? 'Summary failed')
        return null
      }
      const text = (res.data as string) ?? ''
      setSummary(text)
      // D3 meta is optimistic here (phaseCount from the phases we sent; the
      // canonical values land in life_timeline_meta via the handler).
      setSummaryUpdatedAt(new Date().toISOString())
      setSummaryPhaseCount(phases.length)
      return text
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Summary failed')
      return null
    }
  }, [phases])

  return {
    phases,
    loading,
    error,
    summary,
    summaryUpdatedAt,
    summaryPhaseCount,
    setSummary,
    load,
    savePhase,
    deletePhase,
    saveAll,
    renameLocal,
    reflect,
    eraTrends,
    summarize,
  }
}

export type LifePhasesStore = ReturnType<typeof useLifePhases>

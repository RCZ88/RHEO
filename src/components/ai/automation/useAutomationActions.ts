import { useCallback, useEffect, useState } from 'react'
import type { CompositionRule, ExecutionStatus } from '../compositions/types'

const API = (window as any).deskflowAPI

export function useAutomationActions() {
  const [rules, setRules] = useState<CompositionRule[]>([])
  const [statuses, setStatuses] = useState<Map<string, ExecutionStatus>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([API?.compositionsList(), API?.compositionsStatus()])
      if (r) setRules(r)
      if (s) {
        const m = new Map<string, ExecutionStatus>()
        s.forEach((row: any) => m.set(row.rule_id, row))
        setStatuses(m)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createRule = useCallback(async (data: any) => {
    const res = await API?.compositionsCreate({ id: crypto.randomUUID(), name: data.name, category: data.category, lifecycle: data.lifecycle, priority: data.priority, dsl_source: data.dsl_source, enabled: data.enabled ?? 1 })
    await load()
    return res
  }, [load])

  const updateRule = useCallback(async (id: string, data: any) => {
    const res = await API?.compositionsUpdate(id, { ...data, changelog: 'updated' })
    await load()
    return res
  }, [load])

  const deleteRule = useCallback(async (id: string) => {
    const res = await API?.compositionsDelete(id)
    await load()
    return res
  }, [load])

  const evaluateRule = useCallback(async (id: string, context?: any) => {
    return API?.compositionsEvaluate(id, context || {})
  }, [])

  const validateDsl = useCallback(async (dsl: string, name?: string) => {
    try { return await API?.compositionsValidate(dsl, name || 'preview') } catch { return null }
  }, [])

  const getHistory = useCallback(async (ruleId?: string, limit = 50) => {
    try { return await API?.compositionsHistory(ruleId || null, limit) } catch { return [] }
  }, [])

  return {
    rules, statuses, loading, load,
    createRule, updateRule, deleteRule, evaluateRule, validateDsl, getHistory,
  }
}

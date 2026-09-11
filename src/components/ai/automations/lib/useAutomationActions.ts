import { useState, useCallback, useEffect } from 'react'
import { actionBus } from '../../lib/actionBus'
import { generateDsl, generateSummary } from './dslGenerator'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'
import type { AutomationConfig, AutomationCardData } from '../../../types/automation'

interface RuleShape {
  id: string
  name: string
  description: string
  dsl_source: string
  enabled: number
  priority: number
  category: string
  lifecycle: string
}

interface RuleStatusShape {
  rule_id: string
  last_run_at?: string | null
  last_status?: string | null
}

interface AutomationApi {
  compositionsList?: () => Promise<RuleShape[] | null>
  compositionsStatus?: () => Promise<RuleStatusShape[] | null>
  compositionsCreate?: (rule: Omit<RuleShape, 'description'> & { description: string }) => Promise<unknown>
  compositionsGet?: (id: string) => Promise<RuleShape | null>
  compositionsUpdate?: (id: string, patch: Partial<RuleShape>) => Promise<unknown>
  compositionsDelete?: (id: string) => Promise<unknown>
  compositionsEvaluate?: (id: string, payload: Record<string, unknown>) => Promise<unknown>
  compositionsValidate?: (dslSource: string, manifestId: string) => Promise<{ valid: boolean; errors?: { line: number; col: number; message: string; code: string }[] } | null>
}

const API: AutomationApi | undefined = window.deskflowAPI as unknown as AutomationApi | undefined

export function useAutomationActions() {
  const [automations, setAutomations] = useState<AutomationCardData[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const rules = await API?.compositionsList()
      const statuses = await API?.compositionsStatus()
      const statusMap = new Map<string, RuleStatusShape>()
      if (statuses) statuses.forEach(s => statusMap.set(s.rule_id, s))

      if (rules) {
        setAutomations(rules.map((r: RuleShape) => ({
          id: r.id,
          ruleId: r.id,
          name: r.name,
          triggerSource: parseTriggerSource(r.dsl_source) as DataSourceName,
          triggerEvent: parseTriggerEvent(r.dsl_source),
          triggerLabel: r.name,
          actionName: parseActionName(r.dsl_source),
          actionLabel: r.name,
          summary: r.description || `Automation: ${r.name}`,
          enabled: !!r.enabled,
          lifecycle: r.lifecycle,
          priority: r.priority,
          lastFired: statusMap.get(r.id)?.last_run_at ?? null,
          lastStatus: statusMap.get(r.id)?.last_status ?? null,
        })))
      }
    } catch { /* bridge unavailable — leave list empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const createAutomation = useCallback(async (config: AutomationConfig) => {
    const dsl = generateDsl(config)
    const summary = generateSummary(config)
    const actionId = actionBus.start('composition-create', `Creating "${config.name}"…`)

    const report = await validateDsl(dsl, config.name)
    if (!report.valid) {
      actionBus.fail(actionId, report.errors[0] || 'DSL validation failed')
      return false
    }

    try {
      await API?.compositionsCreate({
        id: crypto.randomUUID(),
        name: config.name,
        description: summary,
        dsl_source: dsl,
        enabled: config.enabled ? 1 : 0,
        priority: config.priority,
        category: config.category,
        lifecycle: config.lifecycle,
      })
      actionBus.complete(actionId)
      await load()
      return true
    } catch (err) {
      actionBus.fail(actionId, errMessage(err))
      return false
    }
  }, [load])

  const toggleAutomation = useCallback(async (id: string, currentEnabled: boolean) => {
    const actionId = actionBus.start('composition-evaluate', currentEnabled ? 'Pausing automation…' : 'Enabling automation…')
    try {
      const rule = await API?.compositionsGet(id)
      await API?.compositionsUpdate(id, { ...rule, enabled: currentEnabled ? 0 : 1 })
      actionBus.complete(actionId)
      await load()
    } catch (err) {
      actionBus.fail(actionId, errMessage(err))
    }
  }, [load])

  const deleteAutomation = useCallback(async (id: string, name: string) => {
    const actionId = actionBus.start('composition-delete', `Deleting "${name}"…`)
    try {
      await API?.compositionsDelete(id)
      actionBus.complete(actionId)
      await load()
    } catch (err) {
      actionBus.fail(actionId, errMessage(err))
    }
  }, [load])

  const testRun = useCallback(async (id: string, name: string) => {
    const actionId = actionBus.start('composition-evaluate', `Testing "${name}"…`)
    try {
      await API?.compositionsEvaluate(id, {})
      actionBus.complete(actionId)
      await load()
    } catch (err) {
      actionBus.fail(actionId, errMessage(err))
    }
  }, [load])

  return { automations, loading, createAutomation, toggleAutomation, deleteAutomation, testRun, reload: load }
}

// ─── DSL Parsing Helpers ──────────────────────────────────

export interface DslValidationReport {
  valid: boolean
  errors: string[]
}

/**
 * Runs the generated DSL through the engine's full validation chain
 * (lex → parse → scope check) via `compositions:validate` IPC.
 * Returns { valid: true } when the bridge is unavailable — the backend
 * chain is the authority, and a missing bridge must not block saving.
 */
export async function validateDsl(dsl: string, name: string): Promise<DslValidationReport> {
  try {
    const report = await API?.compositionsValidate(dsl, name || 'preview')
    if (!report) return { valid: true, errors: [] }
    return {
      valid: !!report.valid,
      errors: (report.errors ?? []).map(e => e.message),
    }
  } catch {
    return { valid: true, errors: [] }
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function parseTriggerSource(dsl: string): string {
  const match = dsl.match(/^on\s+(\w+)\./)
  return match?.[1] ?? 'system'
}

function parseTriggerEvent(dsl: string): string {
  const match = dsl.match(/^on\s+\w+\.(\w+(?:\.\w+)?)/)
  return match?.[1] ?? 'unknown'
}

function parseActionName(dsl: string): string {
  const match = dsl.match(/do\s+([\w:]+)/)
  return match?.[1] ?? 'unknown'
}
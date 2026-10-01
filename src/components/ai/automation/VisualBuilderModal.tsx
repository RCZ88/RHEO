import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Loader2, Plus, Trash2, Sparkles, Zap, CalendarClock, Shield, CheckCircle, XCircle, ChevronRight, ArrowLeft } from 'lucide-react'
import type { AutomationDef, ConditionConfig, ConditionOperator, ValueType, TriggerConfig, ActionConfig, ActionParamLegacy as ActionParam } from '../../../types/automation'
import { emptyAutomationDef } from '../../../types/automation'
import { EVENT_SOURCES, INTERVAL_UNITS, FIELD_OPTIONS, OPERATOR_OPTIONS } from './triggerRegistry'
import { ACTION_DEFS } from './actionRegistry'
import { toDsl } from './dslGenerator'
import { parseNaturalLanguage } from './nlParser'
import { dialogVariants } from '../lib/motion'
import type { CompositionRule } from '../compositions/types'

const API = (window as any).deskflowAPI

interface VisualBuilderModalProps {
  rule: CompositionRule | null
  onClose: () => void
  onSaved: () => void
}

type Step = 'trigger' | 'conditions' | 'actions' | 'review'

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: 'trigger', label: 'Trigger', icon: Zap },
  { id: 'conditions', label: 'Conditions', icon: Shield },
  { id: 'actions', label: 'Actions', icon: Sparkles },
  { id: 'review', label: 'Review', icon: CheckCircle },
]

const ACCENT = {
  text: 'text-cyan-300',
  pill: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20',
  bg: 'bg-cyan-600 hover:bg-cyan-500',
  border: 'border-cyan-500/20 focus:border-cyan-500/50',
  dot: 'bg-cyan-400',
}

const inputCls = 'w-full bg-zinc-900 light:bg-white border border-zinc-800 light:border-[var(--ws-border)] rounded-xl px-3 py-2 text-sm text-zinc-200 light:text-stone-800 outline-none transition-colors'

function parseExisting(dsl: string): AutomationDef {
  const def = emptyAutomationDef()
  const evt = dsl.match(/on\s+([a-z.]+)/i)?.[1]
  const sch = dsl.match(/every\s+(\d+)\s+([a-z]+)/i)
  if (evt) {
    const [source, event] = evt.split('.')
    def.trigger = { kind: 'event', source: source || 'system', event: event ? evt : 'app.launched' }
  } else if (sch) {
    def.trigger = { kind: 'schedule', interval: parseInt(sch[1]), intervalUnit: sch[2] }
  }
  const conds = (dsl.match(/(?:^|\s)([a-z_]+)\s*(==|!=|>=|<=|>|<)\s*('[^']*'|[^ ]+)/gi) || []).map(c => c.trim())
  def.conditions = conds.map((c, i) => {
    const m = c.match(/^([a-z_]+)\s*(==|!=|>=|<=|>|<)\s*(.*)$/i)
    if (!m) return null
    const value = m[3].replace(/^'|'$/g, '')
    const opToken = m[2]
    const op: ConditionOperator = { '==': 'eq', '!=': 'neq', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' }[opToken] as ConditionOperator || 'eq'
    const isNum = !Number.isNaN(Number(value)) && value !== ''
    return {
      id: crypto.randomUUID(),
      field: m[1],
      operator: op,
      value,
      valueType: (isNum ? 'number' : value === 'true' || value === 'false' ? 'boolean' : 'string') as ValueType,
      join: 'and',
    }
  }).filter(Boolean) as ConditionConfig[]
  const actions: ActionConfig[] = []
  for (const m of dsl.matchAll(/(?:^|\s)([a-z]+):((?:[^|>]|>)*?)(?=\s+\w+:|$)/gi)) {
    const name = m[1]
    const params = m[2].split(',').map(s => s.trim()).filter(Boolean)
    if (ACTION_DEFS.some(a => a.id === name)) {
      actions.push({
        id: crypto.randomUUID(),
        name,
        params: params.map((p, j) => {
          const [k, ...rest] = p.split('=')
          const v = rest.join('=').replace(/^'|'$/g, '')
          const isNum = !Number.isNaN(Number(v)) && v !== ''
          return { key: k, value: v, valueType: (isNum ? 'number' : v === 'true' || v === 'false' ? 'boolean' : 'string') as ValueType } as ActionParam
        }),
      })
    }
  }
  if (actions.length === 0 && /\bdo\b/i.test(dsl)) {
    const bare = dsl.split(/\bdo\b/i)[1]?.trim().split('|>')[0]?.trim()
    if (bare) actions.push({ id: crypto.randomUUID(), name: bare, params: [] })
  }
  def.actions = actions.length ? actions : emptyAutomationDef().actions
  return def
}

function ActionEditor({ action, onChange, onRemove }: { action: ActionConfig; onChange: (a: ActionConfig) => void; onRemove: () => void }) {
  const def = ACTION_DEFS.find(a => a.id === action.name)
  if (!def) return null
  const setParam = (key: string, value: string) => {
    const pd = def.params.find(p => p.key === key)
    const valueType: ValueType = pd?.type === 'number' ? 'number' : pd?.type === 'boolean' ? 'boolean' : 'string'
    const existing = action.params.find(p => p.key === key)
    const next = existing ? action.params.map(p => p.key === key ? { ...p, value, valueType } : p) : [...action.params, { key, value, valueType }]
    onChange({ ...action, params: next })
  }
  return (
    <div className="bg-zinc-900/60 ring-1 ring-violet-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full">{def.label}</span>
          <span className="text-[10px] text-zinc-500">{def.description}</span>
        </div>
        <button onClick={onRemove} className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {def.params.map(p => {
          const val = action.params.find(a => a.key === p.key)?.value ?? ''
          if (p.options) {
            return (
              <div key={p.key}>
                <label className="text-[10px] text-zinc-500 mb-1 block">{p.label}</label>
                <select value={val} onChange={e => setParam(p.key, e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {p.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )
          }
          return (
            <div key={p.key}>
              <label className="text-[10px] text-zinc-500 mb-1 block">{p.label}</label>
              <input value={val} onChange={e => setParam(p.key, e.target.value)} placeholder={p.placeholder} className={inputCls} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function VisualBuilderModal({ rule, onClose, onSaved }: VisualBuilderModalProps) {
  const [def, setDef] = useState<AutomationDef>(() => rule?.dsl_source ? { ...parseExisting(rule.dsl_source), name: rule.name, category: rule.category, lifecycle: rule.lifecycle, priority: rule.priority, enabled: !!rule.enabled } : emptyAutomationDef())
  const [step, setStep] = useState<Step>('trigger')
  const [nl, setNl] = useState('')
  const [nlBusy, setNlBusy] = useState(false)
  const [validation, setValidation] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dsl = useMemo(() => {
    try { return toDsl(def) } catch { return '' }
  }, [def])

  const triggerDef = (t: TriggerConfig) => setDef({ ...def, trigger: t })

  const applyNl = async () => {
    if (!nl.trim()) return
    setNlBusy(true); setError(null)
    try {
      const parsed = parseNaturalLanguage(nl)
      const next: AutomationDef = { ...parsed, name: def.name || parsed.name || 'Automation', category: def.category, lifecycle: def.lifecycle, priority: def.priority, enabled: def.enabled }
      setDef(next)
      setStep('review')
      setValidation(null)
    } catch (e: any) {
      setError(e?.message || 'Could not parse that description')
    } finally { setNlBusy(false) }
  }

  const validate = async () => {
    try { setValidation(await API?.compositionsValidate(dsl, def.name || 'preview')) } catch {}
  }

  const save = async () => {
    if (!def.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = { name: def.name, category: def.category, lifecycle: def.lifecycle, priority: def.priority, dsl_source: dsl, enabled: def.enabled ? 1 : 0 }
      if (rule) await API?.compositionsUpdate(rule.id, { ...payload, changelog: 'updated' })
      else await API?.compositionsCreate({ id: crypto.randomUUID(), ...payload })
      onSaved()
    } catch (e: any) { setError(e?.message || 'Save failed') } finally { setSaving(false) }
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} variants={dialogVariants} initial="hidden" animate="show" exit="exit">
      <div className="bg-[rgba(24,24,27,0.95)] backdrop-blur-xl border border-zinc-800 rounded-xl w-[760px] max-h-[86vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${ACCENT.dot}`} />
            <h2 className="text-sm font-medium text-white">{rule ? 'Edit Automation' : 'New Automation'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Sparkles className="absolute left-3 top-2.5 w-4 h-4 text-cyan-400" />
            <input
              value={nl}
              onChange={e => setNl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyNl() }}
              placeholder="Describe it in plain words — e.g. “notify me when a transaction over $100 is recorded”"
              className="w-full bg-zinc-900/80 border border-cyan-500/20 focus:border-cyan-500/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white outline-none transition-colors"
            />
            <button onClick={applyNl} disabled={nlBusy || !nl.trim()} className="absolute right-2 top-2 flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-40">
              {nlBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Create
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-5 pt-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = step === s.id
            const done = i < stepIndex
            return (
              <button key={s.id} onClick={() => setStep(s.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${active ? ACCENT.pill : done ? 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <Icon className="w-3 h-3" />
                {s.label}
                {done && <CheckCircle className="w-3 h-3 text-emerald-400" />}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl p-3 mb-4">{error}</div>}

          {step === 'trigger' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button onClick={() => triggerDef({ kind: 'event', source: def.trigger.source, event: def.trigger.event })} className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-colors ${def.trigger.kind === 'event' ? ACCENT.pill : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>
                  <Zap className="w-4 h-4" /> When an event happens
                </button>
                <button onClick={() => triggerDef({ kind: 'schedule', interval: def.trigger.interval || 5, intervalUnit: def.trigger.intervalUnit || 'minutes' })} className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-colors ${def.trigger.kind === 'schedule' ? ACCENT.pill : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>
                  <CalendarClock className="w-4 h-4" /> On a schedule
                </button>
              </div>
              {def.trigger.kind === 'event' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Source</label>
                    <select value={def.trigger.source} onChange={e => {
                      const src = EVENT_SOURCES.find(s => s.id === e.target.value)
                      triggerDef({ kind: 'event', source: e.target.value, event: src?.events[0]?.id || 'app.launched' })
                    }} className={inputCls}>
                      {EVENT_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Event</label>
                    <select value={def.trigger.event} onChange={e => triggerDef({ kind: 'event', source: def.trigger.source, event: e.target.value })} className={inputCls}>
                      {EVENT_SOURCES.find(s => s.id === def.trigger.source)?.events.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-400 mb-1 block">Every</label>
                    <input type="number" min={1} value={def.trigger.interval} onChange={e => triggerDef({ kind: 'schedule', interval: parseInt(e.target.value) || 1, intervalUnit: def.trigger.intervalUnit })} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-400 mb-1 block">Unit</label>
                    <select value={def.trigger.intervalUnit} onChange={e => triggerDef({ kind: 'schedule', interval: def.trigger.interval, intervalUnit: e.target.value })} className={inputCls}>
                      {INTERVAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'conditions' && (
            <div className="space-y-3">
              {def.conditions.length === 0 && (
                <div className="text-center text-xs text-zinc-500 py-8 bg-zinc-900/40 rounded-xl ring-1 ring-zinc-800">
                  No conditions — this will run on every matching trigger. Add one to narrow it down.
                </div>
              )}
              {def.conditions.map((c, i) => {
                const fields = FIELD_OPTIONS[def.trigger.source || 'system'] || FIELD_OPTIONS.system
                return (
                  <div key={c.id} className="flex items-center gap-3 bg-zinc-900/60 ring-1 ring-amber-500/20 rounded-xl p-3">
                    <span className="text-[10px] text-zinc-500 w-4">{i + 1}</span>
                    <select value={c.field} onChange={e => {
                      const f = fields.find(x => x.id === e.target.value)
                      const conds = def.conditions.map(x => x.id === c.id ? { ...x, field: e.target.value, valueType: f?.type || 'string' } : x)
                      setDef({ ...def, conditions: conds })
                    }} className={`${inputCls} w-40`}>
                      {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                    <select value={c.operator} onChange={e => setDef({ ...def, conditions: def.conditions.map(x => x.id === c.id ? { ...x, operator: e.target.value as ConditionOperator } : x) })} className={`${inputCls} w-36`}>
                      {OPERATOR_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.token} {o.label}</option>)}
                    </select>
                    <input value={c.value} onChange={e => {
                      const isNum = !Number.isNaN(Number(e.target.value)) && e.target.value !== ''
                      setDef({ ...def, conditions: def.conditions.map(x => x.id === c.id ? { ...x, value: e.target.value, valueType: isNum ? 'number' : 'string' } : x) })
                    }} className={`${inputCls} flex-1`} placeholder="value" />
                    <button onClick={() => setDef({ ...def, conditions: def.conditions.filter(x => x.id !== c.id) })} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )
              })}
              <button
                onClick={() => {
                  const fields = FIELD_OPTIONS[def.trigger.source || 'system'] || FIELD_OPTIONS.system
                  setDef({ ...def, conditions: [...def.conditions, { id: crypto.randomUUID(), field: fields[0]?.id || 'amount', operator: 'gt', value: '', valueType: fields[0]?.type || 'string', join: 'and' }] })
                }}
                className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/20 hover:bg-amber-500/20 rounded-xl px-3 py-2 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add condition
              </button>
            </div>
          )}

          {step === 'actions' && (
            <div className="space-y-3">
              {def.actions.map(a => (
                <ActionEditor key={a.id} action={a} onRemove={() => setDef({ ...def, actions: def.actions.filter(x => x.id !== a.id) })} onChange={next => setDef({ ...def, actions: def.actions.map(x => x.id === a.id ? next : x) })} />
              ))}
              <div className="flex items-center gap-2">
                <select value="" onChange={e => {
                  if (!e.target.value) return
                  const ad = ACTION_DEFS.find(x => x.id === e.target.value)
                  setDef({ ...def, actions: [...def.actions, { id: crypto.randomUUID(), name: ad!.id, params: ad!.params.map(p => ({ key: p.key, value: '', valueType: p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : 'string' as ValueType })) }] })
                }} className={`${inputCls} w-48`}>
                  <option value="">Add action…</option>
                  {ACTION_DEFS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <span className="text-[10px] text-zinc-600">Actions run left to right</span>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Name</label>
                  <input value={def.name} onChange={e => setDef({ ...def, name: e.target.value })} className={inputCls} placeholder="My automation" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                  <select value={def.category} onChange={e => setDef({ ...def, category: e.target.value })} className={inputCls}>
                    {['general', 'finance', 'focus', 'goals', 'learning', 'ide', 'system'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Lifecycle</label>
                  <select value={def.lifecycle} onChange={e => setDef({ ...def, lifecycle: e.target.value })} className={inputCls}>
                    {['manual', 'forever', 'once', 'schedule'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Priority</label>
                  <input type="number" value={def.priority} onChange={e => setDef({ ...def, priority: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-zinc-400">Generated DSL</label>
                  <button onClick={validate} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"><Shield className="w-3 h-3" /> Validate</button>
                </div>
                <pre className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-300 whitespace-pre-wrap min-h-[64px]">{dsl}</pre>
              </div>
              {validation && (
                <div className={`rounded-xl p-3 text-xs ${validation.valid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {validation.valid
                    ? <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> Valid — {validation.warnings?.length || 0} warning(s)</div>
                    : <div>
                        <div className="flex items-center gap-2 mb-1"><XCircle className="w-3.5 h-3.5" /> {validation.errors?.length || 0} error(s)</div>
                        {validation.errors?.map((e: any, i: number) => <div key={i} className="text-red-400/70 ml-5">[{e.code}] {e.message}</div>)}
                      </div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
          <button onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)} disabled={stepIndex === 0} className="flex items-center gap-1.5 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-xl disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-xl">Cancel</button>
            {stepIndex < STEPS.length - 1 ? (
              <button onClick={() => setStep(STEPS[stepIndex + 1].id)} className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {rule ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

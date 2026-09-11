import { motion, useReducedMotion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { getOperatorsForType } from '../data/operatorMap'
import type { TriggerSelection, ConditionRow } from '../../../types/automation'

interface StepConditionsProps {
  trigger: TriggerSelection | null
  conditions: ConditionRow[]
  logic: 'and' | 'or'
  onConditionsChange: (rows: ConditionRow[]) => void
  onLogicChange: (logic: 'and' | 'or') => void
}

export function StepConditions({ trigger, conditions, logic, onConditionsChange, onLogicChange }: StepConditionsProps) {
  const reduce = useReducedMotion()

  if (!trigger) return <p className="text-[12px] text-zinc-500 light:text-stone-500">Select a trigger first.</p>

  const addRow = () => {
    onConditionsChange([...conditions, { id: crypto.randomUUID(), field: '', operator: 'eq', value: '' }])
  }

  const updateRow = (id: string, patch: Partial<ConditionRow>) => {
    onConditionsChange(conditions.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const removeRow = (id: string) => {
    onConditionsChange(conditions.filter(r => r.id !== id))
  }

  return (
    <motion.div initial={reduce ? undefined : { opacity: 0, y: 8 }} animate={reduce ? undefined : { opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Set Conditions</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>Optional. Add filters to control when the action fires.</p>
      </div>

      {conditions.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-700/60 light:border-stone-300 p-6 text-center">
          <p className="text-[11px] text-zinc-500 light:text-stone-500 mb-3">No conditions. The action fires on every trigger event.</p>
        </div>
      )}

      {conditions.map((row, i) => {
        const fieldDef = trigger.fields.find(f => f.name === row.field)
        const operators = fieldDef ? getOperatorsForType(fieldDef.type) : []

        return (
          <div key={row.id} className="flex items-center gap-2">
            {/* Logic toggle between rows */}
            {i > 0 && (
              <button
                onClick={() => onLogicChange(logic === 'and' ? 'or' : 'and')}
                className="shrink-0 rounded-md bg-zinc-800 light:bg-stone-200 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-300 hover:bg-zinc-700 light:hover:bg-stone-200 transition-colors"
              >
                {logic.toUpperCase()}
              </button>
            )}

            {/* Field select */}
            <select
              value={row.field}
              onChange={e => updateRow(row.id, { field: e.target.value, operator: 'eq', value: '' })}
              className="flex-1 rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 light:text-stone-400 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
            >
              <option value="">Field…</option>
              {trigger.fields.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
            </select>

            {/* Operator select */}
            <select
              value={row.operator}
              onChange={e => updateRow(row.id, { operator: e.target.value as ConditionRow['operator'] })}
              className="w-32 rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 light:text-stone-400 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
            >
              {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>

            {/* Value input */}
            {row.operator !== 'exists' && row.operator !== 'not_exists' && (
              <input
                type={fieldDef?.type === 'number' ? 'number' : fieldDef?.type === 'date' ? 'date' : 'text'}
                value={String(row.value)}
                onChange={e => updateRow(row.id, { value: fieldDef?.type === 'number' ? Number(e.target.value) : e.target.value })}
                placeholder="Value"
                className="flex-1 rounded-lg bg-zinc-800/60 px-2 py-1.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-stone-500"
              />
            )}

            {/* Remove */}
            <button onClick={() => removeRow(row.id)} className="shrink-0 p-1 rounded-md text-zinc-500 light:text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <X size={13} />
            </button>
          </div>
        )
      })}

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-700/60 px-3 py-2 text-[11px] text-zinc-400 light:text-stone-500 hover:text-zinc-200 hover:border-zinc-600 light:border-stone-400 transition-colors"
      >
        <Plus size={13} /> Add Condition
      </button>
    </motion.div>
  )
}
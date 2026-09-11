import { ArrowRight, Zap, GitBranch, GitCommit } from 'lucide-react'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import { SOURCE_META } from '../data/triggerRegistry'
import { getActionById } from '../data/actionRegistry'
import type { TriggerSelection, ConditionRow, ActionSelection } from '../../../types/automation'

interface BuilderPreviewProps {
  name: string
  trigger: TriggerSelection | null
  conditions: ConditionRow[]
  conditionLogic: 'and' | 'or'
  action: ActionSelection | null
  actionParams: Record<string, string | number | boolean>
}

export function BuilderPreview({ name, trigger, conditions, conditionLogic, action, actionParams }: BuilderPreviewProps) {
  const validConditions = conditions.filter(c => c.field && c.operator)
  const actionDef = action ? getActionById(action.name) : null

  return (
    <div className="space-y-4">
      <h4 className={cn("text-[11px] font-semibold uppercase tracking-wider", TEXT.muted)}>Live Preview</h4>

      {/* Name */}
      {name && (
        <div className="rounded-lg bg-zinc-800 light:bg-stone-200/40 p-3">
          <span className="text-[10px] text-zinc-500 light:text-stone-500 block">Name</span>
          <span className="text-[13px] font-medium text-zinc-200">{name}</span>
        </div>
      )}

      {/* Flow visualization */}
      <div className="space-y-2">
        {/* Trigger */}
        <div className={cn(
          "rounded-lg p-3 ring-1",
          trigger ? "bg-zinc-900/60 ring-zinc-700/60" : "bg-zinc-900/30 ring-zinc-800/40 border border-dashed"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-amber-400" />
            <span className="text-[10px] font-medium text-zinc-400 light:text-stone-500 uppercase">Trigger</span>
          </div>
          {trigger ? (
            <span className="text-[12px] text-zinc-200">
              {SOURCE_META[trigger.source]?.label}.{trigger.event}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-600 light:text-stone-500 italic">Not selected</span>
          )}
        </div>

        {/* Conditions */}
        {validConditions.length > 0 && (
          <>
            <div className="flex items-center gap-1 pl-4">
              <div className="h-3 w-px bg-zinc-700" />
              <ArrowRight size={10} className="text-zinc-600 light:text-stone-500" />
            </div>
            <div className="rounded-lg bg-zinc-900/60 light:bg-stone-200 ring-1 ring-zinc-700/60 p-3">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={12} className="text-violet-400" />
                <span className="text-[10px] font-medium text-zinc-400 light:text-stone-500 uppercase">
                  {validConditions.length} Condition{validConditions.length > 1 ? 's' : ''} ({conditionLogic.toUpperCase()})
                </span>
              </div>
              {validConditions.map((c, i) => (
                <p key={c.id} className="text-[11px] text-zinc-300 light:text-stone-400">
                  {i > 0 && <span className="text-violet-400 font-bold">{conditionLogic.toUpperCase()} </span>}
                  {c.field} {c.operator} {c.value}
                </p>
              ))}
            </div>
          </>
        )}

        {/* Action */}
        <div className="flex items-center gap-1 pl-4">
          <div className="h-3 w-px bg-zinc-700" />
          <ArrowRight size={10} className="text-zinc-600 light:text-stone-500" />
        </div>
        <div className={cn(
          "rounded-lg p-3 ring-1",
          action ? "bg-zinc-900/60 ring-zinc-700/60" : "bg-zinc-900/30 ring-zinc-800/40 border border-dashed"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <GitCommit size={12} className="text-emerald-400" />
            <span className="text-[10px] font-medium text-zinc-400 light:text-stone-500 uppercase">Action</span>
          </div>
          {actionDef ? (
            <>
              <span className="text-[12px] text-zinc-200">{actionDef.label}</span>
              {Object.entries(actionParams).filter(([, v]) => v).map(([k, v]) => (
                <p key={k} className="text-[10px] text-zinc-500 light:text-stone-500 mt-0.5">
                  {k}: {String(v).slice(0, 40)}{String(v).length > 40 ? '…' : ''}
                </p>
              ))}
            </>
          ) : (
            <span className="text-[11px] text-zinc-600 light:text-stone-500 italic">Not selected</span>
          )}
        </div>
      </div>

      {/* Human-readable summary */}
      {trigger && action && (
        <div className="rounded-lg bg-emerald-500/5 ring-1 ring-emerald-500/20 p-3 mt-4">
          <span className="text-[10px] text-emerald-400 block mb-1">Plain English</span>
          <span className="text-[11px] text-emerald-200 leading-relaxed">
            "When {trigger.source}.{trigger.event} fires
            {validConditions.length > 0 && `, if ${validConditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(` ${conditionLogic} `)}`}
            , then {actionDef?.label ?? action.name}."
          </span>
        </div>
      )}
    </div>
  )
}
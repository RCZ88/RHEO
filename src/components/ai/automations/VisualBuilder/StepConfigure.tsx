import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { TEXT } from '../../tokens'
import type { ActionSelection } from '../../../types/automation'

interface StepConfigureProps {
  action: ActionSelection | null
  params: Record<string, string | number | boolean>
  onParamsChange: (params: Record<string, string | number | boolean>) => void
}

export function StepConfigure({ action, params, onParamsChange }: StepConfigureProps) {
  const reduce = useReducedMotion()

  if (!action) return <p className="text-[12px] text-zinc-500 light:text-stone-500">Select an action first.</p>

  const update = (name: string, value: string | number | boolean) => {
    onParamsChange({ ...params, [name]: value })
  }

  return (
    <motion.div initial={reduce ? undefined : { opacity: 0, y: 8 }} animate={reduce ? undefined : { opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h3 className={cn("text-[13px] font-semibold mb-1", TEXT.primary)}>Configure Action</h3>
        <p className={cn("text-[11px]", TEXT.muted)}>Fill in the details for "{action.name}".</p>
      </div>

      <div className="space-y-3">
        {action.params.map(param => (
          <div key={param.name}>
            <label className="block text-[11px] text-zinc-400 light:text-stone-500 mb-1">
              {param.label}{param.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {param.type === 'select' ? (
              <select
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 light:text-stone-400 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
              >
                <option value="">Select…</option>
                {param.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : param.type === 'date' ? (
              <input
                type="datetime-local"
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 light:text-stone-400 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60"
              />
            ) : param.name === 'message' || param.name === 'body' ? (
              <textarea
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, e.target.value)}
                placeholder={param.placeholder}
                rows={3}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-stone-500 resize-none"
              />
            ) : (
              <input
                type={param.type === 'number' ? 'number' : 'text'}
                value={params[param.name] ?? ''}
                onChange={e => update(param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={param.placeholder}
                className="w-full rounded-lg bg-zinc-800/60 px-3 py-2 text-[12px] text-zinc-300 ring-1 ring-zinc-700/60 outline-none focus:ring-zinc-500/60 placeholder:text-zinc-600 light:text-stone-500"
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
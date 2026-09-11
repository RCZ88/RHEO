import { useState } from 'react'
import { X, Save, Loader2, Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { dialogVariants } from '../lib/motion'
import type { CompositionRule } from './types'

const API = (window as any).deskflowAPI

interface CompositionEditorModalProps {
  rule: CompositionRule | null
  onClose: () => void
  onSaved: () => void
}

export function CompositionEditorModal({ rule, onClose, onSaved }: CompositionEditorModalProps) {
  const [name, setName] = useState(rule?.name || '')
  const [category, setCategory] = useState(rule?.category || 'general')
  const [lifecycle, setLifecycle] = useState(rule?.lifecycle || 'manual')
  const [priority, setPriority] = useState(rule?.priority || 500)
  const [dsl, setDsl] = useState(rule?.dsl_source || `# on <source>.<event> if <condition> do <action>:<params>\n`)
  const [validation, setValidation] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = async () => {
    try { setValidation(await API?.compositionsValidate(dsl, name || 'preview')) } catch {}
  }

  const save = async () => {
    if (!name.trim() || !dsl.trim()) { setError('Name and DSL required'); return }
    setSaving(true); setError(null)
    try {
      if (rule) { await API?.compositionsUpdate(rule.id, { name, category, lifecycle, priority, dsl_source: dsl, changelog: 'updated' }) }
      else { await API?.compositionsCreate({ id: crypto.randomUUID(), name, category, lifecycle, priority, dsl_source: dsl, enabled: 1 }) }
      onSaved()
    } catch (e: any) { setError(e.message || 'Failed') } finally { setSaving(false) }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} variants={dialogVariants} initial="hidden" animate="show" exit="exit">
      <div className="bg-[rgba(24,24,27,0.95)] backdrop-blur-xl border border-[rgba(63,63,70,0.50)] rounded-2xl w-[680px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-white">{rule ? 'Edit Rule' : 'New Rule'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors" placeholder="My Rule" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors">
                {['general', 'finance', 'focus', 'goals', 'learning', 'ide', 'system'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Lifecycle</label>
              <select value={lifecycle} onChange={e => setLifecycle(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors">
                {['manual', 'forever', 'once', 'schedule'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Priority</label>
              <input type="number" value={priority} onChange={e => setPriority(parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-400">DSL Source</label>
              <button onClick={validate} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"><Shield className="w-3 h-3" /> Validate</button>
            </div>
            <textarea value={dsl} onChange={e => setDsl(e.target.value)} className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 outline-none focus:border-emerald-500/50 transition-colors resize-none" />
          </div>
          {validation && (
            <div className={`rounded-xl p-3 text-xs ${validation.valid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {validation.valid ? <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5" /> Valid — {validation.warnings?.length || 0} warnings</div>
                : <div><div className="flex items-center gap-2 mb-1"><XCircle className="w-3.5 h-3.5" /> {validation.errors?.length || 0} error(s)</div>
                    {validation.errors?.map((e: any, i: number) => <div key={i} className="text-red-400/70 ml-5">[{e.code}] {e.message}</div>)}</div>}
            </div>
          )}
          {error && <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl p-3"><AlertTriangle className="w-3.5 h-3.5" /> {error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {rule ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

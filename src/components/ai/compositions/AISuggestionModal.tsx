import { useState } from 'react'
import { Sparkles, X, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { TEXT } from '../tokens'

interface SuggestResult {
  ok: boolean
  name: string
  description: string
  dsl_source: string
  validation?: { valid: boolean; errors?: { line: number; col: number; message: string; code: string }[]; warnings?: { line: number; col: number; message: string; code: string }[] }
  raw?: string
  error?: string
}

interface CompositionsApi {
  compositionsSuggest?: (request: string) => Promise<SuggestResult | null>
  compositionsAcceptSuggestion?: (data: any) => Promise<{ ok: boolean; id?: string; error?: string } | null>
}

const API = window.deskflowAPI as unknown as CompositionsApi

export function AISuggestionModal({ onClose }: { onClose: () => void }) {
  const [request, setRequest] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestResult | null>(null)
  const [dsl, setDsl] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const generate = async () => {
    if (!request.trim()) return
    setLoading(true)
    setCreateError(null)
    setResult(null)
    try {
      const res = await API?.compositionsSuggest?.(request)
      if (!res) {
        setResult({ ok: false, name: '', description: '', dsl_source: '', error: 'No response from engine' })
        return
      }
      setResult(res)
      setDsl(res.dsl_source || '')
    } catch (err: any) {
      setResult({ ok: false, name: '', description: '', dsl_source: '', error: err?.message ?? String(err) })
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    if (!result) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await API?.compositionsAcceptSuggestion?.({
        name: result.name,
        description: result.description,
        dsl_source: dsl,
        category: 'general',
        enabled: true,
      })
      if (!res || !res.ok) {
        setCreateError(res?.error ?? 'Failed to create automation')
        return
      }
      onClose()
    } catch (err: any) {
      setCreateError(err?.message ?? String(err))
    } finally {
      setCreating(false)
    }
  }

  const validation = result?.validation
  const hasErrors = validation?.errors && validation.errors.length > 0

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#18181b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-400" />
            <h3 className={cn('text-[14px] font-semibold', TEXT.primary)}>Generate automation with AI</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className={cn('mb-1.5 block text-[12px]', TEXT.muted)}>Describe the automation you want</label>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              placeholder="e.g. When I log a transaction over $500, notify me"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-violet-500/60"
            />
            <button
              onClick={generate}
              disabled={loading || !request.trim()}
              className="mt-2 flex items-center gap-2 rounded-xl bg-violet-600/80 px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-violet-500/80 disabled:opacity-40"
            >
              <Sparkles size={14} /> {loading ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {result?.error && !result.dsl_source && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {result.error}
            </div>
          )}

          {result && result.dsl_source && (
            <div className="space-y-3">
              <div>
                <div className={cn('text-[13px] font-medium', TEXT.primary)}>{result.name}</div>
                <p className={cn('text-[11px]', TEXT.muted)}>{result.description}</p>
              </div>

              <div>
                <label className={cn('mb-1.5 block text-[12px]', TEXT.muted)}>Composition DSL (editable)</label>
                <textarea
                  value={dsl}
                  onChange={(e) => setDsl(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] text-emerald-300 outline-none focus:border-violet-500/60"
                />
              </div>

              {validation && (
                <div className="flex items-start gap-2 text-[12px]">
                  {hasErrors ? (
                    <div className="flex w-full items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <div>
                        {validation.errors!.map((e, i) => (
                          <div key={i}>Line {e.line}: {e.message}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-300">
                      <CheckCircle2 size={14} /> Valid composition
                    </div>
                  )}
                </div>
              )}

              {createError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {createError}
                </div>
              )}

              <button
                onClick={create}
                disabled={creating || !dsl.trim()}
                className="flex items-center gap-2 rounded-xl bg-emerald-600/80 px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-emerald-500/80 disabled:opacity-40"
              >
                <Plus size={14} /> {creating ? 'Creating…' : 'Create automation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

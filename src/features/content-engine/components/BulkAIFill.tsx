import { useState } from 'react'
import { Wand2, Check, X } from 'lucide-react'
import { AmberButton, GhostButton } from './ui'
import { cn } from '@/lib/utils'

const extApi = () => (window as any).deskflowAPI?.extensionQueueCommand

interface BulkAIFillProps {
  /** All available fields with their current values */
  fields: Array<{
    id: string
    label: string
    value: string
    placeholder?: string
    type?: 'text' | 'textarea' | 'select'
    options?: string[]
  }>
  /** Callback when fields are filled */
  onFill: (updates: Record<string, string>) => void
  /** Category for prompt building */
  category: 'content-engine' | 'learn' | 'goals' | 'resume' | 'general'
  /** Additional context */
  context?: string
  /** Class name */
  className?: string
}

/**
 * Bulk AI Fill — select which fields to fill, AI fills them all in one prompt.
 * Appears as a floating action that opens a field selector.
 */
export function BulkAIFill({ fields, onFill, category, context, className }: BulkAIFillProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(fields.filter(f => !f.value).map(f => f.id))
  const [sending, setSending] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasteValue, setPasteValue] = useState('')

  const toggleField = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const selectAll = () => setSelected(fields.map(f => f.id))
  const selectEmpty = () => setSelected(fields.filter(f => !f.value).map(f => f.id))
  const selectNone = () => setSelected([])

  const buildBulkPrompt = (): string => {
    const selectedFields = fields.filter(f => selected.includes(f.id))
    const contextBlock = context ? `\nContext: ${context}\n` : ''

    // Build JSON schema with selected fields
    const schema = selectedFields.map(f => {
      if (f.type === 'select' && f.options) {
        return `  "${f.id}": "${f.value || f.options[0]}" // one of: ${f.options.join(', ')}`
      }
      return `  "${f.id}": "${f.value || '[FILL THIS]'}"`
    }).join(',\n')

    // Include non-selected fields as context
    const otherFields = fields.filter(f => !selected.includes(f.id) && f.value)
    const contextFields = otherFields.length > 0
      ? `\nExisting fields (keep these values):\n${otherFields.map(f => `  "${f.id}": "${f.value}"`).join(',\n')}\n`
      : ''

    return `Based on our conversation above, fill in the following fields.
${contextBlock}${contextFields}
Return ONLY this JSON with ALL selected fields filled:
{
${schema}
}

Rules:
- Fill each "[FILL THIS]" field with the best value from the conversation
- Keep existing field values unchanged
- Return ONLY this JSON (no explanation, no markdown)
- Every selected field is mandatory`
  }

  const sendToAI = async () => {
    if (selected.length === 0) return
    setSending(true)
    try {
      const ext = extApi()
      if (ext) {
        const res = await ext({
          type: 'CONTENT_ENGINE_INJECT',
          promptType: 'bulk-fill',
          text: buildBulkPrompt()
        })
        if (res?.ok) { setSending(false); setPasting(true); return }
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(buildBulkPrompt())
      setSending(false)
      setPasting(true)
    } catch { setSending(false) }
  }

  const importResponse = () => {
    if (!pasteValue.trim()) return
    try {
      let cleaned = pasteValue.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const updates: Record<string, string> = {}
        for (const f of fields) {
          if (selected.includes(f.id) && parsed[f.id] !== undefined) {
            updates[f.id] = String(parsed[f.id])
          }
        }
        if (Object.keys(updates).length > 0) {
          onFill(updates)
          setOpen(false)
          setPasting(false)
          setPasteValue('')
        }
      }
    } catch {}
  }

  return (
    <div className={cn('relative', className)}>
      <GhostButton
        onClick={() => setOpen(!open)}
        className="h-7 gap-1.5 text-[10px]"
      >
        <Wand2 size={11} />
        Fill with AI
      </GhostButton>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-80 rounded-xl border border-white/[0.08] bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
            <span className="text-[11px] font-medium text-zinc-200">
              Select fields for AI to fill
            </span>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
              <X size={12} />
            </button>
          </div>

          {/* Quick selects */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/[0.04]">
            <button onClick={selectAll} className="rounded px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]">All</button>
            <button onClick={selectEmpty} className="rounded px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]">Empty</button>
            <button onClick={selectNone} className="rounded px-2 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]">None</button>
            <span className="ml-auto text-[9px] text-zinc-600">{selected.length}/{fields.length}</span>
          </div>

          {/* Field checkboxes */}
          <div className="max-h-60 overflow-y-auto px-3 py-2 space-y-1">
            {fields.map(f => {
              const on = selected.includes(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  className={cn(
                    'flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left transition-colors',
                    on ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  )}
                >
                  <div className={cn(
                    'w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors flex-shrink-0',
                    on ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'
                  )}>
                    {on && <Check size={9} className="text-black" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-zinc-300">{f.label}</div>
                    <div className="text-[9px] text-zinc-600 truncate">
                      {f.value ? `"${f.value.slice(0, 40)}${f.value.length > 40 ? '...' : ''}"` : 'empty'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Action */}
          <div className="px-3 py-2 border-t border-white/[0.06]">
            {pasting ? (
              <div className="space-y-2">
                <textarea
                  value={pasteValue}
                  onChange={(e) => setPasteValue(e.target.value)}
                  placeholder="Paste AI response..."
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 text-[11px] text-zinc-200 resize-none font-mono"
                  rows={4}
                />
                <div className="flex gap-1">
                  <AmberButton onClick={importResponse} className="h-6 px-3 text-[10px]">
                    <Check size={10} /> Import
                  </AmberButton>
                  <GhostButton onClick={() => { setPasting(false); setPasteValue('') }} className="h-6 px-2 text-[10px]">
                    Cancel
                  </GhostButton>
                </div>
              </div>
            ) : (
              <AmberButton
                onClick={sendToAI}
                disabled={selected.length === 0 || sending}
                className="w-full h-7 text-[11px]"
              >
                <Wand2 size={11} />
                {sending ? 'Sending...' : `Send ${selected.length} fields to AI`}
              </AmberButton>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { ArrowRight, Check, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPreferredTransport, gatewayAvailability, sendViaGateway, extractField } from '@/services/externalAiTransport'

const api = () => (window as any).deskflowAPI
const extApi = () => (window as any).deskflowAPI?.extensionQueueCommand

interface ExternalAIBridgeFieldProps {
  /** The field name for the prompt schema */
  fieldName: string
  /** Human-readable label */
  label: string
  /** The current field value */
  value: string
  /** Callback when value is updated from AI */
  onUpdate: (value: string) => void
  /** All form fields (for context in the prompt) */
  allFields: Record<string, string>
  /** Prompt type category */
  category: 'learn' | 'content-engine' | 'goals' | 'resume' | 'general'
  /** Additional context for the prompt */
  context?: string
  /** CSS class */
  className?: string
}

/**
 * Reusable External AI Bridge for ANY form field.
 * Adds a "Send to AI" button next to any input.
 * The AI fills in the field based on conversation context.
 */
export function ExternalAIBridgeField({
  fieldName,
  label,
  value,
  onUpdate,
  allFields,
  category,
  context,
  className
}: ExternalAIBridgeFieldProps) {
  const [sending, setSending] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [lastResult, setLastResult] = useState<'success' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Build a field-specific prompt
  const buildFieldPrompt = (): string => {
    const fieldContext = Object.entries(allFields)
      .filter(([k, v]) => v && k !== fieldName)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')

    const contextBlock = context ? `\nAdditional context: ${context}` : ''
    const fieldList = Object.keys(allFields).map(k => `  "${k}": "${k === fieldName ? '[FILL THIS]' : allFields[k] || ''}"`).join(',\n')

    return `Based on our conversation above, fill in the "${label}" field for this ${category} entry.

${fieldContext ? `Existing fields:\n${fieldContext}\n` : ''}${contextBlock}

Return ONLY this JSON with ALL fields filled:
{
${fieldList}
}

Rules:
- Fill in "${fieldName}" with the best value based on the conversation context
- Keep existing field values unless they need updating
- Return ONLY this JSON (no explanation, no markdown)
- Every field is mandatory`
  }

  const sendToAI = async () => {
    // Gateway is opt-in: only used when the user has signed in AND switched to it.
    if (getPreferredTransport() === 'gateway') {
      const avail = await gatewayAvailability()
      if (avail.ready) {
        setSending(true)
        const res = await sendViaGateway(buildFieldPrompt())
        setSending(false)
        if (res.ok) {
          const { values, error } = extractField(res.text!, [fieldName])
          const incoming = values[fieldName]
          if (incoming !== undefined) { onUpdate(incoming); setLastResult('success'); return }
          setError(error || `The response did not include "${fieldName}".`)
          return
        }
        setError(res.error || 'The provider did not answer.')
        return
      }
      setError(avail.reason || 'No AI provider is signed in yet.')
      return
    }
    setSending(true)
    try {
      // Try extension injection first
      const ext = extApi()
      if (ext) {
        const res = await ext({
          type: 'CONTENT_ENGINE_INJECT',
          promptType: 'field-fill',
          text: buildFieldPrompt(),
          fields: allFields
        })
        if (res?.ok) {
          setSending(false)
          setPasting(true)
          return
        }
      }
    } catch {}
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(buildFieldPrompt())
      setSending(false)
      setPasting(true)
    } catch {
      setSending(false)
    }
  }

  const importValue = () => {
    if (!pasteValue.trim()) return
    try {
      // Try to parse as JSON and extract the field
      const cleaned = pasteValue.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed[fieldName]) {
          onUpdate(parsed[fieldName])
          setLastResult('success')
          setPasting(false)
          setPasteValue('')
          setTimeout(() => setLastResult(null), 2000)
          return
        }
      }
      // If not JSON, use raw text
      onUpdate(pasteValue.trim())
      setLastResult('success')
      setPasting(false)
      setPasteValue('')
      setTimeout(() => setLastResult(null), 2000)
    } catch {
      // Use raw text as fallback
      onUpdate(pasteValue.trim())
      setLastResult('success')
      setPasting(false)
      setPasteValue('')
      setTimeout(() => setLastResult(null), 2000)
    }
  }

  if (pasting) {
    return (
      <div className={cn('mt-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2', className)}>
        <div className="text-[9px] text-zinc-500 mb-1">Paste AI response for "{label}":</div>
        <textarea
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          className="w-full rounded border border-white/[0.06] bg-white/[0.03] p-1.5 text-[11px] text-zinc-200 resize-none"
          rows={3}
          placeholder="Paste the AI response here..."
        />
        <div className="flex gap-1 mt-1">
          <button
            onClick={importValue}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#f5c518]/25 transition-colors"
          >
            <Check size={9} /> Import
          </button>
          <button
            onClick={() => { setPasting(false); setPasteValue('') }}
            className="rounded px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={sendToAI}
      disabled={sending}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors',
        lastResult === 'success'
          ? 'text-emerald-400'
          : 'text-zinc-500 hover:text-[#f5c518] hover:bg-[#f5c518]/10',
        className
      )}
      title={`Send "${label}" to external AI (ChatGPT/Claude)`}
    >
      {sending ? (
        <Wand2 size={8} className="animate-pulse" />
      ) : lastResult === 'success' ? (
        <Check size={8} />
      ) : (
        <ArrowRight size={8} />
      )}
      {sending ? 'Sending...' : lastResult === 'success' ? 'Done' : 'AI'}
    </button>
  )
}

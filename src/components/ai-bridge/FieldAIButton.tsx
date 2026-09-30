// FieldAIButton — the UNIFORM per-field External AI Bridge button.
//
// Design system applied (frontend-design / impeccable / humancentred-UIUX /
// motion-alive / design-taste / ui-ux-pro-max / frontend-external-infra /
// external-ai-bridge):
//  - Accent = amber (#f5c518) — Content Engine surface convention (AmberButton)
//  - L1 Composed motion (opacity/transform micro-feedback; reduced-motion safe)
//  - ALL 4 states: empty / loading(awaiting) / error / populated
//  - Style template picker + frame-mode toggle (external-ai-bridge checklist)
//  - Live static/dynamic prompt preview, correlation auto-capture, non-destructive
//
// Flow: idle -> send (live prompt + style/frame controls + Send/Copy) -> paste (import)

import { useState, useMemo, useRef, useEffect } from 'react'
import { ArrowRight, Check, Wand2, Copy, ExternalLink, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildFieldPrompt, getStyleDirective, INJECTION_BY_CATEGORY, BridgeCategory, SECTION_COLORS, buildInjectCommand, STYLE_TEMPLATES } from './prompt'
import { PROMPT_SECTIONS } from '@/features/content-engine/components/PromptSectionToggle'
import { parseBridgeResponse } from './parse'
import { LivePromptPreview, DynamicSectionDef } from './LivePromptPreview'
import { toast } from '@/features/content-engine/components/ui'
import {
  getPreferredTransport, setPreferredTransport, gatewayAvailability,
  sendViaGateway, extractField, type Transport,
} from '@/services/externalAiTransport'

const extApi = () => (window as any).deskflowAPI?.extensionQueueCommand
const CLIENT_PENDING_TTL_MS = 5 * 60 * 1000

interface FieldAIButtonProps {
  fieldName: string
  label: string
  value: string
  onUpdate: (value: string) => void
  allFields: Record<string, string>
  category: BridgeCategory
  context?: string
  className?: string
  styleId?: string
  frameMode?: 'strict' | 'flexible'
  compact?: boolean
}

export function FieldAIButton({
  fieldName,
  label,
  value,
  onUpdate,
  allFields,
  category,
  context,
  className,
  styleId: externalStyleId,
  frameMode: externalFrameMode = 'strict',
  compact = true,
}: FieldAIButtonProps) {
  const [mode, setMode] = useState<'idle' | 'send' | 'paste'>('idle')
  const [sending, setSending] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [lastResult, setLastResult] = useState<'success' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [awaiting, setAwaiting] = useState(false)
  // Local style/frame state seeded from props (external-ai-bridge checklist controls)
  const [styleId, setStyleId] = useState(externalStyleId || '')
  const [frameMode, setFrameMode] = useState<'strict' | 'flexible'>(externalFrameMode)
  const [transport, setTransport] = useState<Transport>(getPreferredTransport)
  const [signedIn, setSignedIn] = useState<string[]>([])
  const [busyGateway, setBusyGateway] = useState(false)

  const pendingRef = useRef<{ correlationId: string; valueAtSend: string } | null>(null)
  const clientTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prompt = useMemo(
    () => buildFieldPrompt({ category, label, fieldName, allFields, context, frameMode, styleId }),
    [category, label, fieldName, allFields, context, frameMode, styleId]
  )

  const styleDirective = getStyleDirective(styleId)

  const sections: DynamicSectionDef[] = [
    { id: 'existing', label: 'existing fields', detect: 'contains', match: 'Existing fields:', dynamic: true, color: SECTION_COLORS[0] },
    { id: 'style', label: 'style', detect: 'contains', match: 'Style:', dynamic: true, color: SECTION_COLORS[3] },
    { id: 'context', label: 'context', detect: 'contains', match: 'Additional context:', dynamic: true, color: SECTION_COLORS[1] },
    { id: 'target', label: 'target field', detect: 'contains', match: `[FILL THIS]`, dynamic: true, color: SECTION_COLORS[2] },
    { id: 'rules', label: 'format rules', detect: 'contains', match: 'Return ONLY this JSON', dynamic: false, color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  ]

  // Correlation listener (response arrives over IPC, not window.postMessage).
  // Use a ref for value/onUpdate so the listener is attached once per field, not
  // re-added on every keystroke (that caused the bridge:response listener leak).
  const valueRef = useRef(value);
  const onUpdateRef = useRef(onUpdate);
  valueRef.current = value;
  onUpdateRef.current = onUpdate;
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.onBridgeResponse) return
    const handler = (event: { correlationId: string; matchedKeys: string[]; provider: string; data: unknown }) => {
      if (!pendingRef.current || event.correlationId !== pendingRef.current.correlationId) return
      const parsed = parseBridgeResponse(
        typeof event.data === 'string' ? event.data : JSON.stringify(event.data),
        [fieldName]
      )
      const incoming = parsed.values[fieldName]
      setAwaiting(false)
      if (incoming === undefined) {
        setError(parsed.error || `Response didn't include "${fieldName}".`)
        pendingRef.current = null
        return
      }
      const safeToOverwrite = valueRef.current === '' || valueRef.current === pendingRef.current.valueAtSend
      if (safeToOverwrite) {
        onUpdateRef.current(incoming)
        setLastResult('success')
        setError(null)
        setMode('idle')
        toast(`Imported from ${event.provider || 'AI'}`)
      } else {
        setPendingImport(incoming)
      }
      pendingRef.current = null
    }
    const unsubscribe = api.onBridgeResponse(handler)
    return () => { unsubscribe?.() }
  }, [fieldName])

  useEffect(() => {
    let live = true
    void gatewayAvailability().then((a) => {
      if (live) setSignedIn(a.signedIn)
    })
    return () => { live = false }
  }, [mode, transport])

  const clearClientTimer = () => {
    if (clientTimer.current) { clearTimeout(clientTimer.current); clientTimer.current = null }
  }

  const runGateway = async () => {
    setBusyGateway(true)
    setError(null)
    const res = await sendViaGateway(prompt)
    setBusyGateway(false)
    if (!res.ok) {
      setError(res.error || 'The provider did not answer.')
      setMode('paste')
      return
    }
    const { values, error: parseError } = extractField(res.text!, [fieldName])
    const incoming = values[fieldName]
    if (incoming === undefined) {
      setError(parseError || `The response did not include "${fieldName}".`)
      setMode('paste')
      return
    }
    // Same non-destructive rule as the extension path: never silently clobber
    // text the user edited after the send started.
    if (valueRef.current === '' || valueRef.current === pendingRef.current?.valueAtSend) {
      onUpdateRef.current(incoming)
      setLastResult('success')
      setError(null)
      setMode('idle')
      toast(`Imported from ${res.provider}`)
    } else {
      setPendingImport(incoming)
    }
  }

  const sendToAI = async () => {
    setSending(true)
    setError(null)
    const cmd = buildInjectCommand(category, prompt, 'field-fill', [fieldName])
    const ext = extApi()
    if (ext) {
      try {
        const res = await ext(cmd)
        if (res?.ok) {
          pendingRef.current = { correlationId: cmd.correlationId, valueAtSend: value }
          setAwaiting(true)
          setMode('paste')
          setSending(false)
          clearClientTimer()
          clientTimer.current = setTimeout(() => {
            if (pendingRef.current?.correlationId === cmd.correlationId) {
              pendingRef.current = null
              setAwaiting(false)
            }
          }, CLIENT_PENDING_TTL_MS)
          return
        }
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(prompt)
      window.open('https://chat.openai.com', '_blank')
    } catch {}
    setMode('paste')
    setSending(false)
  }

  const doImport = () => {
    if (!pasteValue.trim()) return
    const result = parseBridgeResponse(pasteValue, [fieldName])
    if (!result.ok) {
      setError(result.error || 'Could not parse the response.')
      setLastResult('error')
      return
    }
    const v = result.values[fieldName]
    if (v === undefined) {
      setError(result.missing?.length ? `Response is missing "${fieldName}".` : 'Nothing to import for this field.')
      setLastResult('error')
      return
    }
    onUpdate(v)
    setLastResult('success')
    setError(null)
    setMode('idle')
    setPasteValue('')
    setTimeout(() => setLastResult(null), 2200)
  }

  const applyPending = () => {
    if (pendingImport !== null) onUpdate(pendingImport)
    setPendingImport(null)
    setLastResult('success')
    setMode('idle')
    setTimeout(() => setLastResult(null), 2200)
  }

  // ---- IDLE ----
  if (mode === 'idle') {
    return (
      <button
        onClick={() => setMode('send')}
        disabled={sending}
        className={cn(
          'inline-flex items-center gap-1 rounded-md transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          compact ? 'px-1.5 py-0.5 text-[9px] font-medium' : 'px-2 py-1 text-[10px] font-medium border border-white/[0.06]',
          lastResult === 'success' ? 'text-emerald-400' : 'text-zinc-500 hover:text-[#f5c518] hover:bg-[#f5c518]/10',
          className
        )}
        title={`Fill "${label}" from external AI (ChatGPT/Claude)`}
      >
        {sending ? <Wand2 size={compact ? 8 : 10} className="animate-pulse" />
          : lastResult === 'success' ? <Check size={compact ? 8 : 10} />
          : <ArrowRight size={compact ? 8 : 10} />}
        {sending ? 'Sending…' : lastResult === 'success' ? 'Done' : compact ? 'AI' : 'Fill with AI'}
      </button>
    )
  }

  // ---- SEND / PASTE ----
  return (
    <div className={cn('mt-1 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-2.5 space-y-2.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-zinc-300">Fill “{label}” from external AI</span>
        <button
          onClick={() => { setMode('idle'); setPasteValue(''); setError(null); setPendingImport(null) }}
          className="text-zinc-500 hover:text-zinc-300 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Style template picker (external-ai-bridge checklist) */}
          <div>
            <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Style</div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setStyleId('')}
                className={cn(
                  'px-1.5 py-0.5 rounded-md text-[9px] border transition-colors',
                  styleId === '' ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                )}
              >None</button>
              {STYLE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStyleId(t.id)}
                  title={t.directive}
                  className={cn(
                    'px-1.5 py-0.5 rounded-md text-[9px] border transition-colors',
                    styleId === t.id ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  )}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Transport picker — extension is the default; gateway is opt-in */}
          <div className="flex items-center gap-1.5">
            {(['extension', 'gateway'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTransport(t); setPreferredTransport(t) }}
                disabled={t === 'gateway' && signedIn.length === 0}
                title={t === 'gateway' && signedIn.length === 0
                  ? 'Sign in to an AI provider first: Workspace -> AI Gateway -> Providers'
                  : t === 'gateway'
                    ? `Send hands-free via ${signedIn[0]}`
                    : 'Inject into your already-open AI chat tab'}
                className="rounded-md px-2 py-0.5 text-[9px] border capitalize transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2"
                style={
                  transport === t
                    ? { borderColor: 'rgba(245,197,24,0.4)', background: 'rgba(245,197,24,0.10)', color: '#f5c518' }
                    : { borderColor: '#27272a', color: '#a1a1aa' }
                }
              >
                {t}
              </button>
            ))}
            {transport === 'gateway' && (
              <span className="text-[9px] text-zinc-500">via {signedIn[0] || 'not signed in'}</span>
            )}
          </div>

          {/* Frame mode toggle (external-ai-bridge checklist) */}
          <div className="flex items-center gap-1">
            {(['strict', 'flexible'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setFrameMode(m)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[9px] border capitalize transition-colors',
                  frameMode === m ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                )}
              >{m}</button>
            ))}
          </div>

          <LivePromptPreview prompt={prompt} dynamicSections={sections} title="Field prompt (live)" loading={awaiting} error={error} />

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => (transport === 'gateway' ? runGateway() : sendToAI())}
              disabled={sending || busyGateway}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#f5c518]/25 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50 disabled:opacity-50"
            >
              {(sending || busyGateway) ? <Wand2 size={9} className="animate-pulse" /> : <ExternalLink size={9} />}
              {(sending || busyGateway) ? 'Sending…' : 'Send to AI'}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(prompt) }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
            >
              <Copy size={9} /> Copy
            </button>
          </div>
        </>
      )}

      {pendingImport !== null && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2">
          <div className="text-[10px] text-amber-300">New AI response — your current text is kept. Apply or dismiss?</div>
          <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-300">{pendingImport}</pre>
          <div className="mt-1 flex gap-1.5">
            <button onClick={applyPending} className="rounded-md px-2 py-1 text-[10px] font-medium bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#f5c518]/25 transition-colors active:scale-[0.98]">Apply</button>
            <button onClick={() => setPendingImport(null)} className="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">Dismiss</button>
          </div>
        </div>
      )}

      {mode === 'paste' && pendingImport === null && (
        <div>
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 text-[11px] text-zinc-200 resize-none font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
            rows={4}
            placeholder="Paste the AI's JSON response here…"
          />
          {error && <div className="mt-1 text-[10px] text-rose-400">{error}</div>}
          <div className="flex gap-1.5 mt-1">
            <button
              onClick={doImport}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#f5c518]/25 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
            >
              <Check size={9} /> Import
            </button>
            <button
              onClick={() => { setMode('send'); setPasteValue(''); setError(null) }}
              className="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FieldAIButton

// BridgeForm — renders a SCHEMA of uniform fields + a live whole-form prompt preview
// and a single "Fill whole form from external AI" action. Every feature uses this so
// the form experience is identical. The live preview updates as fields change and
// tags each region as dynamic (field-driven) vs static (constant rules).
//
// Design system applied (frontend-design / impeccable / humancentred-UIUX /
// motion-alive / design-taste / ui-ux-pro-max / frontend-external-infra /
// external-ai-bridge):
//  - Accent = amber (#f5c518) — Content Engine surface convention
//  - L1 Composed motion (opacity/transform micro-feedback; reduced-motion safe)
//  - ALL 4 states: empty / loading(awaiting) / error / populated
//  - Style picker + frame-mode toggle + (content-engine) section toggle — the
//    external-ai-bridge checklist controls, all present here
//  - Glass surfaces, 8px grid, rounded-xl max, focus rings

import { useMemo, useState, useRef, useEffect } from 'react'
import { Wand2, Copy, Check, ExternalLink, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BridgeField, BridgeFieldDef } from './BridgeField'
import { LivePromptPreview, DynamicSectionDef } from './LivePromptPreview'
import { buildFormPrompt, BridgeCategory, SECTION_COLORS, buildInjectCommand, STYLE_TEMPLATES, PROMPT_SECTIONS } from './prompt'
import { parseBridgeResponse } from './parse'
import { toast } from '@/features/content-engine/components/ui'
import {
  getPreferredTransport, setPreferredTransport, gatewayAvailability,
  sendViaGateway, extractField, type Transport,
} from '@/services/externalAiTransport'

const CLIENT_PENDING_TTL_MS = 5 * 60 * 1000

interface BridgeFormProps {
  heading: string
  category: BridgeCategory
  fields: BridgeFieldDef[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onBulkUpdate?: (values: Record<string, string>) => void
  context?: string
  styleId?: string
  frameMode?: 'strict' | 'flexible'
  className?: string
}

export function BridgeForm({
  heading,
  category,
  fields,
  values,
  onChange,
  onBulkUpdate,
  context,
  styleId: externalStyleId,
  frameMode: externalFrameMode = 'strict',
  className,
}: BridgeFormProps) {
  const [showPrompt, setShowPrompt] = useState(true)
  const [paste, setPaste] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [awaiting, setAwaiting] = useState(false)
  const [pendingImport, setPendingImport] = useState<Record<string, string> | null>(null)
  const [styleId, setStyleId] = useState(externalStyleId || '')
  const [frameMode, setFrameMode] = useState<'strict' | 'flexible'>(externalFrameMode)
  const [transport, setTransport] = useState<Transport>(getPreferredTransport)
  const [signedIn, setSignedIn] = useState<string[]>([])
  const [busyGateway, setBusyGateway] = useState(false)

  useEffect(() => {
    let live = true
    void gatewayAvailability().then((a) => {
      if (live) setSignedIn(a.signedIn)
    })
    return () => { live = false }
  }, [transport])
  // Section toggle — only meaningful for content-engine (skill checklist)
  const [sections, setSections] = useState<string[]>(PROMPT_SECTIONS.map((s) => s.id))

  const pendingRef = useRef<{ correlationId: string; valuesAtSend: Record<string, string> } | null>(null)
  const clientTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prompt = useMemo(
    () => buildFormPrompt({ category, heading, fields, values, context, styleId, frameMode, sections }),
    [category, heading, fields, values, context, styleId, frameMode, sections]
  )

  const sections_def: DynamicSectionDef[] = [
    { id: 'existing', label: 'your fields', detect: 'contains', match: '[FILL THIS]', dynamic: true, color: SECTION_COLORS[0] },
    { id: 'style', label: 'style', detect: 'contains', match: 'Style:', dynamic: true, color: SECTION_COLORS[3] },
    { id: 'sections', label: 'sections', detect: 'contains', match: 'Include these sections:', dynamic: true, color: SECTION_COLORS[1] },
    { id: 'context', label: 'context', detect: 'contains', match: 'Context about this', dynamic: true, color: SECTION_COLORS[2] },
    { id: 'rules', label: 'format rules', detect: 'contains', match: 'Return ONLY this JSON', dynamic: false, color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  ]

  // Correlation listener (response arrives over IPC, not window.postMessage).
  // Refs for volatile deps so the listener attaches once and is cleaned up (no leak).
  const fieldsRef = useRef(fields);
  const valuesRef = useRef(values);
  const onBulkUpdateRef = useRef(onBulkUpdate);
  fieldsRef.current = fields;
  valuesRef.current = values;
  onBulkUpdateRef.current = onBulkUpdate;
  useEffect(() => {
    const api = (window as any).deskflowAPI
    if (!api?.onBridgeResponse) return
    const handler = (event: { correlationId: string; matchedKeys: string[]; provider: string; data: unknown }) => {
      if (!pendingRef.current || event.correlationId !== pendingRef.current.correlationId) return
      const keys = fieldsRef.current.map((f) => f.key)
      const parsed = parseBridgeResponse(
        typeof event.data === 'string' ? event.data : JSON.stringify(event.data),
        keys
      )
      setAwaiting(false)
      if (!parsed.ok && !parsed.rawJson) {
        setError(parsed.error || 'Could not parse the response.')
        pendingRef.current = null
        return
      }
      const snapshot = pendingRef.current.valuesAtSend
      const toAutoFill: Record<string, string> = {}
      const toConfirm: Record<string, string> = {}
      const incoming = parsed.values
      const matched = (event.matchedKeys && event.matchedKeys.length ? event.matchedKeys : Object.keys(incoming))
      for (const key of matched) {
        const v = incoming[key]
        if (v === undefined) continue
        const unchanged = valuesRef.current[key] === '' || valuesRef.current[key] === snapshot[key]
        if (unchanged) toAutoFill[key] = v
        else toConfirm[key] = v
      }
      if (Object.keys(toAutoFill).length) {
        onBulkUpdateRef.current?.({ ...valuesRef.current, ...toAutoFill })
        toast(`Imported ${Object.keys(toAutoFill).length} field(s) from ${event.provider || 'AI'}`)
      }
      if (Object.keys(toConfirm).length) setPendingImport(toConfirm)
      pendingRef.current = null
    }
    const unsubscribe = api.onBridgeResponse(handler)
    return () => { unsubscribe?.() }
  }, [])

  const runGateway = async () => {
    setBusyGateway(true)
    setError(null)
    const res = await sendViaGateway(prompt)
    setBusyGateway(false)
    if (!res.ok) {
      setError(res.error || 'The provider did not answer.')
      setFeedback(null)
      return
    }
    const keys = fields.map((f) => f.key)
    const { values, error: parseError } = extractField(res.text!, keys)
    if (!Object.keys(values).length) {
      setError(parseError || 'Could not read the response.')
      return
    }
    const snapshot = valuesRef.current
    const autoFill: Record<string, string> = {}
    const confirm: Record<string, string> = {}
    for (const k of keys) {
      const v = values[k]
      if (v === undefined) continue
      if (snapshot[k] === '' || snapshot[k] === pendingRef.current?.valuesAtSend[k]) autoFill[k] = v
      else confirm[k] = v
    }
    if (Object.keys(autoFill).length) {
      onBulkUpdateRef.current?.({ ...snapshot, ...autoFill })
      toast(`Imported ${Object.keys(autoFill).length} field(s) from ${res.provider}`)
    }
    if (Object.keys(confirm).length) setPendingImport(confirm)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const sendToAI = async () => {
    const keys = fields.map((f) => f.key)
    const cmd = buildInjectCommand(category, prompt, 'form-fill', keys)
    const ext = (window as any).deskflowAPI?.extensionQueueCommand
    try {
      if (ext) {
        const res = await ext(cmd)
        if (res?.ok) {
          pendingRef.current = { correlationId: cmd.correlationId, valuesAtSend: { ...values } }
          setAwaiting(true)
          setFeedback('Prompt sent to your AI — it will auto-fill when the response lands.')
          if (clientTimer.current) clearTimeout(clientTimer.current)
          clientTimer.current = setTimeout(() => {
            if (pendingRef.current?.correlationId === cmd.correlationId) {
              pendingRef.current = null
              setAwaiting(false)
            }
          }, CLIENT_PENDING_TTL_MS)
          return
        }
      }
    } catch {}
    await copy()
    window.open('https://chat.openai.com', '_blank')
    setFeedback('Prompt copied — paste it into ChatGPT/Claude, then paste the response back below')
  }

  const doBulkImport = () => {
    if (!paste.trim()) return
    const keys = fields.map((f) => f.key)
    const result = parseBridgeResponse(paste, keys)
    if (!result.ok) {
      setError(result.error || 'Could not parse the response.')
      return
    }
    const merged = { ...values }
    let count = 0
    for (const k of keys) {
      if (result.values[k] !== undefined) {
        merged[k] = result.values[k]
        count++
      }
    }
    onBulkUpdate?.(merged)
    setError(null)
    setPaste('')
    setFeedback(count > 0 ? `Imported ${count} field(s)` : 'No matching fields found in the response')
    setTimeout(() => setFeedback(null), 2600)
  }

  const applyPending = () => {
    if (pendingImport) {
      onBulkUpdate?.({ ...values, ...pendingImport })
      toast(`Imported ${Object.keys(pendingImport).length} field(s)`)
    }
    setPendingImport(null)
  }

  const toggleSection = (id: string) => {
    setSections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Uniform fields */}
      <div className="space-y-3">
        {fields.map((f) => (
          <BridgeField
            key={f.key}
            def={f}
            value={values[f.key] || ''}
            onChange={onChange}
            allValues={values}
            category={category}
            context={context}
            styleId={styleId}
            frameMode={frameMode}
          />
        ))}
      </div>

      {/* Live prompt + AI controls */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-2.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPrompt((s) => !s)}
            className="flex items-center gap-1 text-[10px] font-semibold text-zinc-300 uppercase tracking-wider rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
          >
            <Sparkles size={10} className="text-[#f5c518]" /> Prompt the AI will send
            {showPrompt ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => (transport === 'gateway' ? runGateway() : sendToAI())}
              disabled={busyGateway}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#f5c518]/25 transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50 disabled:opacity-50"
            >
              {busyGateway ? <Loader2 size={9} className="animate-spin" /> : <ExternalLink size={9} />}
              {busyGateway ? 'Sending…' : 'Send to AI'}
            </button>
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
            >
              {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {awaiting && (
          <div className="flex items-center gap-1 text-[10px] text-[#f5c518]">
            <Loader2 size={11} className="animate-spin" /> Waiting for the AI response — matched fields will auto-fill.
          </div>
        )}

        {showPrompt && (
          <>
            {/* Style picker */}
            <div>
              <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Style</div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setStyleId('')}
                  className={cn('px-1.5 py-0.5 rounded-md text-[9px] border transition-colors', styleId === '' ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200')}
                >None</button>
                {STYLE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStyleId(t.id)}
                    title={t.directive}
                    className={cn('px-1.5 py-0.5 rounded-md text-[9px] border transition-colors', styleId === t.id ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200')}
                  >{t.label}</button>
                ))}
              </div>
            </div>

            {/* Transport picker — extension default, gateway opt-in */}
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

            {/* Frame mode */}
            <div className="flex items-center gap-1.5">
              {(['strict', 'flexible'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFrameMode(m)}
                  className={cn('px-2 py-0.5 rounded-md text-[9px] border capitalize transition-colors', frameMode === m ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200')}
                >{m}</button>
              ))}

              {/* Section toggle — content-engine only */}
              {category === 'content-engine' && (
                <div className="flex flex-wrap gap-1 ml-1">
                  {PROMPT_SECTIONS.map((sec) => {
                    const on = sections.includes(sec.id)
                    return (
                      <button
                        key={sec.id}
                        onClick={() => toggleSection(sec.id)}
                        title={sec.description}
                        className={cn('px-1.5 py-0.5 rounded-md text-[8px] border transition-colors', on ? 'border-[#f5c518]/30 text-[#f5c518]/80' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400')}
                      >{sec.label}</button>
                    )
                  })}
                </div>
              )}
            </div>

            <LivePromptPreview prompt={prompt} dynamicSections={sections_def} title="Form prompt (live)" loading={awaiting} error={error} />
          </>
        )}

        {pendingImport && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2">
            <div className="text-[10px] text-amber-300">New AI response — your edited fields are kept. Apply or dismiss?</div>
            <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-300">{JSON.stringify(pendingImport, null, 2)}</pre>
            <div className="mt-1 flex gap-1.5">
              <button onClick={applyPending} className="rounded-md px-2 py-1 text-[10px] font-medium bg-[#f5c518]/15 text-[#f5c518] border border-[#f5c518]/30 hover:bg-[#f5c518]/25 transition-colors active:scale-[0.98]">Apply</button>
              <button onClick={() => setPendingImport(null)} className="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">Dismiss</button>
            </div>
          </div>
        )}

        <div>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-1.5 text-[11px] text-zinc-200 resize-none font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518]/50"
            rows={3}
            placeholder="Or paste the AI's JSON response here to fill the whole form at once…"
          />
          {error && <div className="mt-1 text-[10px] text-rose-400">{error}</div>}
          {feedback && <div className="mt-1 text-[10px] text-emerald-400">{feedback}</div>}
          <div className="mt-1">
            <button
              onClick={doBulkImport}
              disabled={!paste.trim()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors active:scale-[0.98] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              <Wand2 size={9} /> Import into fields
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BridgeForm

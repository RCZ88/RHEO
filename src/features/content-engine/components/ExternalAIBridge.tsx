import { useState, useEffect, useCallback } from 'react'
import { Wand2, Copy, Check, ExternalLink, ChevronDown, ChevronRight, Zap, ArrowRight } from 'lucide-react'
import { AmberButton, Card, GhostButton, TextArea, toast } from './ui'
import { PromptSectionToggle, PROMPT_SECTIONS, STYLE_TEMPLATES } from './PromptSectionToggle'
import { cn } from '@/lib/utils'
import DynamicPromptPreview from '@/components/DynamicPromptPreview'
import { getPreferredTransport, gatewayAvailability, sendViaGateway } from '@/services/externalAiTransport'

const api = () => (window as any).deskflowAPI?.contentEngine
const extApi = () => (window as any).deskflowAPI?.extensionQueueCommand

// Prompt type registry — maps prompt types to their build/import handlers
const PROMPT_REGISTRY: Record<string, {
  label: string
  description: string
  build: (params: any) => Promise<any>
  import: (params: any) => Promise<any>
  responseSignature: string[]
}> = {
  classify: {
    label: 'Classify Thought',
    description: 'Route a raw thought to the right destination',
    build: (p) => api()?.externalBuildClassifyPrompt(p),
    import: (p) => api()?.externalImportClassify(p),
    responseSignature: ['destination', 'category']
  },
  synthesize: {
    label: 'Synthesize Ideas',
    description: 'Generate content ideas from context',
    build: (p) => api()?.externalBuildSynthesizePrompt(p),
    import: (p) => api()?.externalImportSynthesize(p),
    responseSignature: ['content_ideas', 'idea_title']
  },
  script: {
    label: 'Generate Script',
    description: 'Write frames with retention evidence',
    build: (p) => api()?.externalBuildScriptPrompt(p),
    import: (p) => api()?.externalImportScript(p),
    responseSignature: ['script_frames', 'retention_evidence']
  },
  gates: {
    label: 'Validate Gates',
    description: 'Check scroll-stop, hard-cut, asset-ready',
    build: (p) => api()?.externalBuildGatesPrompt(p),
    import: (p) => api()?.externalImportGates(p),
    responseSignature: ['gate_results', 'scroll_stop']
  },
  seo: {
    label: 'Inject SEO',
    description: 'Generate hidden keyword phrases',
    build: (p) => api()?.externalBuildSeoPrompt(p),
    import: (p) => api()?.externalImportSeo(p),
    responseSignature: ['seo_keywords', 'keyword_phrases']
  },
  analytics: {
    label: 'Analytics Insights',
    description: 'Analyze performance data',
    build: (p) => api()?.externalBuildAnalyticsPrompt(p),
    import: (p) => api()?.externalImportAnalytics(p),
    responseSignature: ['performance_metrics', 'retention_curve']
  },
  lessons: {
    label: 'Extract Lessons',
    description: 'Pull durable rules from performance',
    build: (p) => api()?.externalBuildLessonsPrompt(p),
    import: (p) => api()?.externalImportLessons(p),
    responseSignature: ['durable_rules', 'lesson_text']
  },
  reflection: {
    label: 'Reflection Analysis',
    description: 'Analyze creator intuition vs data',
    build: (p) => api()?.externalBuildReflectionPrompt(p),
    import: (p) => api()?.externalImportReflection(p),
    responseSignature: ['creator_intuition', 'contradictions']
  },
  frameworks: {
    label: 'Framework Update',
    description: 'Extract new framework rules',
    build: (p) => api()?.externalBuildFrameworksPrompt(p),
    import: (p) => api()?.externalImportFrameworks(p),
    responseSignature: ['framework_rules', 'rule_text']
  },
}

interface ExternalAIBridgeProps {
  episodeId?: number
  thought?: string
  templateIds?: string[]
  frameMode?: 'strict' | 'flexible'
  promptType: string
  onImport?: (rawJson: string) => void
  className?: string
}

export function ExternalAIBridge({
  episodeId,
  thought,
  templateIds = [],
  frameMode = 'strict',
  promptType,
  onImport,
  className
}: ExternalAIBridgeProps) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [paste, setPaste] = useState('')
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastImport, setLastImport] = useState<'success' | 'error' | null>(null)
  const [extensionActive, setExtensionActive] = useState(false)
  const [waitingForResponse, setWaitingForResponse] = useState(false)
  const [enabledSections, setEnabledSections] = useState<string[]>(
    PROMPT_SECTIONS.filter(s => s.defaultOn).map(s => s.id)
  )
  const [selectedStyle, setSelectedStyle] = useState('')
  const [frameMode, setFrameMode] = useState<'strict' | 'flexible'>('strict')

  const config = PROMPT_REGISTRY[promptType] || PROMPT_REGISTRY.classify

  // Check if extension is available
  useEffect(() => {
    const check = async () => {
      try {
        const ext = extApi()
        if (ext) {
          setExtensionActive(true)
        }
      } catch {}
    }
    check()
  }, [])

  // Listen for auto-detected CE responses from the extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'DESKFLOW_CE_RESPONSE' && event.data.promptType === promptType) {
        setWaitingForResponse(false)
        setPaste(event.data.data)
        toast('AI response detected — ready to import')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [promptType])

  const buildPrompt = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await config.build({
        episodeId, thought, templateIds, frameMode,
        sections: enabledSections,
        style: selectedStyle ? STYLE_TEMPLATES.find(t => t.id === selectedStyle)?.directive : undefined
      })
      if (res?.ok && res.prompt) {
        setPrompt(res.prompt)
      } else {
        setError(res?.error || 'Failed to build prompt')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to build prompt')
    } finally {
      setGenerating(false)
    }
  }

  // 2-click flow: send prompt to AI tab via extension
  const sendToAI = async () => {
    if (!prompt) return
    // Gateway is opt-in: only when the user signed in AND switched to it.
    if (getPreferredTransport() === 'gateway') {
      const avail = await gatewayAvailability()
      if (avail.ready) {
        setWaitingForResponse(true)
        const res = await sendViaGateway(prompt)
        setWaitingForResponse(false)
        if (!res.ok) { setError(res.error || 'The provider did not answer.'); return }
        setPaste(res.text!)
        setImporting(true)
        return
      }
      setError(avail.reason || 'No AI provider is signed in yet.')
      return
    }
    // Try extension injection
    try {
      const ext = extApi()
      if (ext) {
        const res = await ext({
          type: 'CONTENT_ENGINE_INJECT',
          promptType,
          text: prompt,
          episodeId
        })
        if (res?.ok) {
          setWaitingForResponse(true)
          toast('Prompt sent — paste the AI response when ready')
          return
        }
      }
    } catch {}
    // Fallback: clipboard + open
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    window.open('https://chatgpt.com', '_blank')
    toast('Prompt copied — paste into ChatGPT/Claude')
  }

  const copyToClipboard = async () => {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast('Prompt copied')
  }

  const importResponse = async () => {
    if (!paste.trim()) { toast('Paste the AI response first', 'error'); return }
    setImporting(true)
    setLastImport(null)
    try {
      const res = await config.import({ episodeId, rawJson: paste.trim() })
      if (res?.ok) {
        setLastImport('success')
        setPaste('')
        toast('Response imported')
        onImport?.(paste.trim())
      } else {
        setLastImport('error')
        setError(res?.error || 'Import failed')
      }
    } catch (e: any) {
      setLastImport('error')
      setError(e?.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f5c518]/15">
            <Wand2 size={12} className="text-[#f5c518]" />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-200">{config.label}</div>
            <div className="text-[10px] text-zinc-500">{config.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!prompt && !generating && (
            <AmberButton onClick={buildPrompt} className="h-6 px-2 text-[10px]">
              <Zap size={10} /> Build
            </AmberButton>
          )}
          {prompt && (
            <>
              <GhostButton onClick={copyToClipboard} className="h-6 px-1.5 text-[10px]">
                {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy'}
              </GhostButton>
              <GhostButton onClick={sendToAI} className="h-6 px-1.5 text-[10px]">
                <ArrowRight size={10} /> Send
              </GhostButton>
            </>
          )}
          {expanded ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
          {/* Prompt section toggles — dynamic/static control */}
          <PromptSectionToggle
            promptType={promptType}
            enabledSections={enabledSections}
            onSectionsChange={setEnabledSections}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            frameMode={frameMode}
            onFrameModeChange={setFrameMode}
          />

          {generating && (
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#f5c518] border-t-transparent" />
              <span className="text-[11px] text-zinc-400">Building prompt...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-[11px] text-rose-400">
              {error}
            </div>
          )}

          {prompt && !generating && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                  Prompt
                </span>
                <span className="text-[9px] text-zinc-600">{prompt.length} chars</span>
              </div>
              <TextArea
                rows={10}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="font-mono text-[11px] leading-relaxed"
              />
              <DynamicPromptPreview
                prompt={prompt}
                title={`${config.label} (live)`}
                dynamicSections={[
                  { id: 'based', label: 'leverages conversation', detect: 'contains', match: 'Based on our conversation', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                  { id: 'schema', label: 'JSON schema', detect: 'contains', match: 'Return ONLY this JSON', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
                  { id: 'style', label: 'style directive', detect: 'contains', match: 'TONE:', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                  { id: 'series', label: 'series rules', detect: 'contains', match: 'SERIES RULES', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                ]}
              />
            </div>
          )}

          {/* Paste area */}
          {prompt && !generating && (
            <div>
              <div className="mb-1 text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                {waitingForResponse ? 'Waiting for AI response...' : 'Paste AI Response'}
              </div>
              <TextArea
                rows={6}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={waitingForResponse ? 'Extension will auto-detect the response...' : 'Paste the JSON output from ChatGPT/Claude here...'}
              />
              <div className="mt-2 flex items-center gap-2">
                <AmberButton onClick={importResponse} disabled={!paste.trim() || importing} className="h-7 text-[11px]">
                  {importing ? <Zap size={12} className="animate-pulse" /> : <Zap size={12} />}
                  {importing ? 'Importing...' : 'Import Response'}
                </AmberButton>
                {lastImport === 'success' && (
                  <span className="text-[10px] text-emerald-400">Imported</span>
                )}
              </div>
            </div>
          )}

          {!prompt && !generating && (
            <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
              <div className="text-[11px] text-zinc-500">
                Click &ldquo;Build&rdquo; to generate the format instruction for this step.
              </div>
              <AmberButton onClick={buildPrompt} className="mt-3 h-7 text-[11px]">
                <Zap size={12} /> Build Prompt
              </AmberButton>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

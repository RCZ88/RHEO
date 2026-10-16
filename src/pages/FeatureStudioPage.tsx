import { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Check, ChevronRight, Clipboard, ClipboardCheck, Download, FileJson, Film, Info, Layers, Loader2, Pause, Play, Plus, RefreshCcw, Sparkles, Upload, Wand2, X } from 'lucide-react'
import { PROMPT_CUT_PLANNER, PROMPT_SCENE_DSL } from '../lib/overlayPrompts'
import { extractJson, validateCutPlan, validateSceneDSL, allPassed, passedCount, generateRepairPrompt } from '../lib/overlayParser'

const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

// ─── Sample transcript (generic, not SVM-specific) ───────────────────────────
const SAMPLE_TRANSCRIPT = {
  video_id: 'sample_tutorial',
  duration: 320.5,
  segments: [
    { id: 0, start: 0.0, end: 5.2, text: 'Welcome to this tutorial. Today we are going to cover three important concepts.' },
    { id: 1, start: 5.5, end: 15.8, text: 'The first concept is the foundation. Without understanding this, everything else falls apart.' },
    { id: 2, start: 16.2, end: 28.0, text: 'Let me show you a comparison between the old approach and the new approach.' },
    { id: 3, start: 28.5, end: 42.0, text: 'Now let me explain how this works in practice. You can see the results here.' },
    { id: 4, start: 42.5, end: 58.0, text: 'The key metric to watch is the efficiency ratio. When this number goes up, performance improves.' },
    { id: 5, start: 58.5, end: 75.0, text: 'In summary, these three concepts form the basis of everything we will cover in this series.' },
  ]
}

// ─── Validation Checklist ───────────────────────────────────────────────────
function ValidationChecklist({ checks }: { checks: Array<{ rule: string; message: string; passed: boolean }> }) {
  const { passed, total } = passedCount(checks)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-300">Validation</span>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${passed === total ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{passed}/{total} passed</span>
      </div>
      {checks.map((c, i) => (
        <div key={i} className="flex items-start gap-2.5 text-[11px] py-1">
          <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{c.passed ? '✓' : '✗'}</span>
          <div className="min-w-0 flex-1">
            <span className={`font-medium ${c.passed ? 'text-zinc-400' : 'text-red-300'}`}>{c.rule}</span>
            {!c.passed && <span className="text-zinc-500 ml-1.5">— {c.message}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tool Card ──────────────────────────────────────────────────────────────
function ToolCard({ icon: Icon, title, description, status, onClick }: {
  icon: typeof Film; title: string; description: string; status: string; onClick: () => void
}) {
  return (
    <motion.button whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left rounded-xl border border-zinc-700/30 bg-zinc-800/30 p-4 hover:border-[#ec4899]/30 hover:bg-zinc-800/50 transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#ec4899]/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[#ec4899]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-200">{title}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{description}</div>
        </div>
        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
          status === 'ready' ? 'bg-emerald-500/15 text-emerald-400' :
          status === 'needs-setup' ? 'bg-amber-500/15 text-amber-400' :
          'bg-zinc-700/30 text-zinc-500'
        }`}>{status === 'ready' ? 'Ready' : status === 'needs-setup' ? 'Setup' : 'Available'}</span>
      </div>
    </motion.button>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
type View = 'dashboard' | 'upload' | 'transcript' | 'cutplan' | 'visualize' | 'bridge' | 'export'

export function FeatureStudioPage() {
  const [view, setView] = useState<View>('dashboard')

  // ── Transcript (supports multiple videos) ──
  const [transcripts, setTranscripts] = useState<any[]>([])
  const [activeTranscript, setActiveTranscript] = useState<any>(null)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  // ── Cut Plan ──
  const [cutPlan, setCutPlan] = useState<any>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // ── Scene DSL ──
  const [sceneDsl, setSceneDsl] = useState<any>(null)

  // ── Manual Bridge ──
  const [bridgeStep, setBridgeStep] = useState<'prompt' | 'paste' | 'validate'>('prompt')
  const [bridgeMode, setBridgeMode] = useState<'cutplan' | 'scenedsl'>('cutplan')
  const [copied, setCopied] = useState(false)
  const [pastedResponse, setPastedResponse] = useState('')
  const [bridgeChecks, setBridgeChecks] = useState<Array<{ rule: string; message: string; passed: boolean }>>([])
  const [bridgeError, setBridgeError] = useState<string | null>(null)

  // ── Environment ──
  const [envStatus, setEnvStatus] = useState<{ffmpeg: boolean; fasterwhisper: boolean; ollama: boolean}>({ffmpeg: false, fasterwhisper: false, ollama: false})

  // ── Load sample ──
  const loadSample = useCallback(() => {
    const sample = { ...SAMPLE_TRANSCRIPT, id: uid(), name: 'sample_tutorial.mp4' }
    setTranscripts([sample])
    setActiveTranscript(sample)
    setView('transcript')
  }, [])

  // ── Handle multiple transcript uploads ──
  const handleTranscriptUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    let loaded = 0
    const newTranscripts: any[] = []
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result))
          if (!data.segments?.length) throw new Error(`${file.name}: missing segments`)
          newTranscripts.push({ ...data, id: uid(), name: file.name })
        } catch (err: any) { setTranscriptError(err.message) }
        loaded++
        if (loaded === files.length) {
          setTranscripts(prev => [...prev, ...newTranscripts])
          if (newTranscripts.length > 0 && !activeTranscript) {
            setActiveTranscript(newTranscripts[0])
            setView('transcript')
          }
        }
      }
      reader.readAsText(file)
    })
  }, [activeTranscript])

  // ── Handle video upload (simulated) ──
  const handleVideoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    setUploadProgress(`Processing ${files.length} video(s)...`)
    // In production: spawn Python backend per file
    setTimeout(() => {
      setUploading(false)
      setUploadProgress('')
      setTranscriptError('Video transcription requires ffmpeg (not installed). Install ffmpeg or upload transcript.json files instead.')
    }, 2000)
  }, [])

  // ── Prompts ──
  const cutPlanPrompt = useMemo(() => activeTranscript ? PROMPT_CUT_PLANNER + '\n\n================ INPUT DATA ================\nvideo_id: ' + activeTranscript.video_id + '\ntranscript:\n' + JSON.stringify(activeTranscript, null, 2) : '', [activeTranscript])
  const sceneDslPrompt = useMemo(() => {
    if (!activeTranscript) return ''
    const kept = cutPlan?.kept?.map((k: any) => activeTranscript.segments?.find((s: any) => s.id === k.segment_id)).filter(Boolean) || activeTranscript.segments
    return PROMPT_SCENE_DSL + '\n\n================ INPUT DATA ================\nvideo_id: ' + activeTranscript.video_id + '\nkept_transcript:\n' + JSON.stringify({ video_id: activeTranscript.video_id, segments: kept }, null, 2)
  }, [activeTranscript, cutPlan])

  const activePrompt = bridgeMode === 'cutplan' ? cutPlanPrompt : sceneDslPrompt

  const copyPrompt = useCallback(async () => {
    try { await navigator.clipboard.writeText(activePrompt) } catch { const ta = document.createElement('textarea'); ta.value = activePrompt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [activePrompt])

  const validateResponse = useCallback(() => {
    if (!pastedResponse.trim()) { setBridgeError('Paste the AI response first.'); return }
    setBridgeError(null)
    try {
      const parsed = extractJson(pastedResponse)
      const checks = bridgeMode === 'cutplan' ? validateCutPlan(parsed, activeTranscript) : validateSceneDSL(parsed, activeTranscript)
      setBridgeChecks(checks); setBridgeStep('validate')
      if (allPassed(checks)) {
        if (bridgeMode === 'cutplan') { setCutPlan(parsed); setView('cutplan') }
        else { setSceneDsl(parsed); setView('visualize') }
      }
    } catch (err: any) { setBridgeError(err.message); setBridgeChecks([{ rule: 'Valid JSON', message: err.message, passed: false }]); setBridgeStep('validate') }
  }, [pastedResponse, bridgeMode, activeTranscript])

  const repairPrompt = useMemo(() => !bridgeChecks.length || allPassed(bridgeChecks) ? '' : generateRepairPrompt(pastedResponse, bridgeChecks), [bridgeChecks, pastedResponse])
  const copyRepair = useCallback(async () => { try { await navigator.clipboard.writeText(repairPrompt) } catch {} }, [repairPrompt])

  const startBridge = useCallback((mode: 'cutplan' | 'scenedsl') => {
    setBridgeMode(mode); setBridgeStep('prompt'); setPastedResponse(''); setBridgeChecks([]); setBridgeError(null); setView('bridge')
  }, [])

  return (
    <div className="min-h-full text-zinc-100" data-page="studio">
      <div className="mx-auto max-w-[1800px] w-full flex flex-col gap-5 p-5">
        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#ec4899]/15 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-[#ec4899]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">Overlay Studio</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {transcripts.length > 0
                  ? `${transcripts.length} video${transcripts.length > 1 ? 's' : ''} loaded · ${activeTranscript ? fmt(activeTranscript.duration) : 'no selection'}`
                  : 'Upload videos or transcripts to get started'}
              </p>
            </div>
          </div>
          {transcripts.length > 0 && (
            <button onClick={() => setView('dashboard')} className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-zinc-800/50">
              Dashboard
            </button>
          )}
        </header>

        {/* ═══════════════ DASHBOARD VIEW ═══════════════ */}
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
              className="flex-1 grid gap-4" style={{ gridTemplateColumns: transcripts.length > 0 ? '280px 1fr' : '1fr' }}>

              {/* Video Library sidebar (if videos loaded) */}
              {transcripts.length > 0 && (
                <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-zinc-300">Videos ({transcripts.length})</span>
                    <label className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                      + Add
                      <input type="file" accept=".json" multiple className="hidden" onChange={handleTranscriptUpload} />
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    {transcripts.map(t => (
                      <button key={t.id} onClick={() => { setActiveTranscript(t); setView('transcript') }}
                        className={`w-full text-left rounded-lg p-2.5 transition-all duration-150 ${activeTranscript?.id === t.id ? 'bg-[#ec4899]/10 border border-[#ec4899]/20' : 'hover:bg-zinc-800/50 border border-transparent'}`}>
                        <div className="text-xs font-medium text-zinc-200 truncate">{t.name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{t.segments?.length || 0} segments · {fmt(t.duration || 0)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main area */}
              <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-6">
                {transcripts.length === 0 ? (
                  /* Empty state — upload first */
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-14 h-14 rounded-xl bg-[#ec4899]/10 flex items-center justify-center mb-4">
                      <Film size={24} className="text-[#ec4899]" />
                    </div>
                    <h2 className="text-base font-semibold text-zinc-100 mb-1">Start with your videos</h2>
                    <p className="text-xs text-zinc-500 mb-6 max-w-md text-center leading-relaxed">
                      Upload video files for transcription, or transcript.json files if you already have them.
                      The system works with <span className="text-zinc-300">any topic</span> — not just tutorials.
                    </p>
                    <div className="flex gap-3">
                      <label className="inline-flex items-center gap-2 rounded-xl bg-[#ec4899] px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-[#db2777] active:scale-[0.97] transition-all duration-150 cursor-pointer min-h-[44px] shadow-lg shadow-[#ec4899]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50">
                        <Upload size={14} /> Upload videos
                        <input type="file" accept="video/*" multiple className="hidden" onChange={handleVideoUpload} />
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-5 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50">
                        <FileJson size={14} /> Upload transcripts
                        <input type="file" accept=".json" multiple className="hidden" onChange={handleTranscriptUpload} />
                      </label>
                      <button onClick={loadSample} className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-5 py-2.5 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/30 active:scale-[0.97] transition-all duration-150 min-h-[44px]">
                        Load sample
                      </button>
                    </div>
                    {uploading && <div className="mt-5 flex items-center gap-2 text-xs text-[#22d3ee]"><Loader2 size={14} className="animate-spin" /> {uploadProgress}</div>}
                    {transcriptError && (
                      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3.5 text-xs text-amber-300 max-w-md" role="alert">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {transcriptError}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Tool grid — show all available features */
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-300 mb-3">Pipeline Tools</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <ToolCard icon={Film} title="Transcript Viewer"
                          description="View and edit timestamps, segments, and word-level timing."
                          status={activeTranscript ? 'ready' : 'needs-setup'}
                          onClick={() => setView('transcript')} />
                        <ToolCard icon={Wand2} title="AI Cut Planner"
                          description="AI selects which segments to keep (90–180s) with reasons."
                          status={cutPlan ? 'ready' : activeTranscript ? 'available' : 'needs-setup'}
                          onClick={() => activeTranscript && startBridge('cutplan')} />
                        <ToolCard icon={Sparkles} title="Scene Visualizer"
                          description="AI generates diagrams, equations, charts, cards for each moment."
                          status={sceneDsl ? 'ready' : cutPlan ? 'available' : 'needs-setup'}
                          onClick={() => cutPlan && startBridge('scenedsl')} />
                        <ToolCard icon={Layers} title="Export Manager"
                          description="Export PNGs, timeline.json, CapCut package, or composite MP4."
                          status={sceneDsl ? 'ready' : 'needs-setup'}
                          onClick={() => sceneDsl && setView('export')} />
                      </div>
                    </div>

                    {/* Status bar */}
                    <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/20 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-300">Pipeline Status</span>
                        <div className="flex items-center gap-4 text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${activeTranscript ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                            Transcript
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${cutPlan ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                            Cut Plan
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${sceneDsl ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                            Scenes
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${sceneDsl ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                            Export
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════ TRANSCRIPT VIEW ═══════════════ */}
        {view === 'transcript' && activeTranscript && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 320px' }}>
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 overflow-auto min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-300">Transcript — {activeTranscript.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => startBridge('cutplan')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#ec4899] px-3 py-1.5 text-[10px] font-semibold text-zinc-950 hover:bg-[#db2777] transition-colors min-h-[44px]">
                    <Wand2 size={12} /> Generate Cut Plan
                  </button>
                  <button onClick={() => setView('dashboard')} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">Back</button>
                </div>
              </div>
              <div className="space-y-1">
                {activeTranscript.segments?.map((seg: any) => {
                  const kept = cutPlan?.kept?.find((k: any) => k.segment_id === seg.id)
                  return (
                    <div key={seg.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${kept ? 'bg-emerald-500/[0.06] border border-emerald-500/20' : cutPlan ? 'bg-zinc-800/20 border border-transparent opacity-50' : 'hover:bg-zinc-800/40 border border-transparent'}`}>
                      <span className="text-[9px] text-zinc-600 font-mono w-8 shrink-0 pt-0.5">#{seg.id}</span>
                      <span className="text-[9px] text-[#22d3ee] font-mono w-20 shrink-0 pt-0.5">{fmt(seg.start)} – {fmt(seg.end)}</span>
                      <span className="text-[11px] text-zinc-300 leading-relaxed flex-1">{seg.text}</span>
                      {kept && <span className="text-[8px] text-emerald-400 font-semibold shrink-0 pt-0.5 uppercase tracking-wider">{kept.role || kept.intent}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-4 overflow-auto">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3">Actions</h3>
              <div className="space-y-2">
                <button onClick={() => startBridge('cutplan')} className="w-full text-left rounded-lg border border-zinc-700/30 bg-zinc-800/30 p-3 hover:border-[#ec4899]/30 transition-all min-h-[44px]">
                  <div className="text-xs font-medium text-zinc-200">Generate Cut Plan</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">AI selects segments to keep</div>
                </button>
                <button onClick={() => startBridge('scenedsl')} disabled={!cutPlan}
                  className="w-full text-left rounded-lg border border-zinc-700/30 bg-zinc-800/30 p-3 hover:border-[#ec4899]/30 transition-all min-h-[44px] disabled:opacity-40">
                  <div className="text-xs font-medium text-zinc-200">Generate Scenes</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">AI plans visualizations</div>
                </button>
                <button onClick={() => setView('dashboard')} className="w-full text-left rounded-lg border border-zinc-800 p-3 hover:bg-zinc-800/30 transition-all min-h-[44px]">
                  <div className="text-xs font-medium text-zinc-400">Back to Dashboard</div>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ MANUAL BRIDGE VIEW ═══════════════ */}
        {view === 'bridge' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Left: Prompt + paste */}
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 flex flex-col min-h-0">
              <div className="mb-3 shrink-0">
                <h2 className="text-sm font-medium">AI Bridge — {bridgeMode === 'cutplan' ? 'Cut Planner' : 'Scene DSL'}</h2>
                <p className="mt-1 text-[10px] text-zinc-500">Copy the prompt → paste into any AI → paste the response back.</p>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-3 shrink-0">
                {(['prompt', 'paste', 'validate'] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${bridgeStep === s ? 'bg-[#ec4899] text-zinc-950' : (['prompt', 'paste', 'validate'].indexOf(bridgeStep) > i ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500')}`}>
                      {['prompt', 'paste', 'validate'].indexOf(bridgeStep) > i ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] ${bridgeStep === s ? 'text-zinc-200' : 'text-zinc-500'}`}>{s === 'prompt' ? 'Copy' : s === 'paste' ? 'Paste' : 'Check'}</span>
                    {i < 2 && <div className="w-4 h-px bg-zinc-700" />}
                  </div>
                ))}
              </div>
              <AnimatePresence mode="wait">
                {bridgeStep === 'prompt' && (
                  <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 rounded-lg border border-zinc-700/30 bg-zinc-950 light:bg-[var(--ws-surface-60)] p-3 overflow-auto">
                      <pre className="text-[9px] text-zinc-500 leading-relaxed whitespace-pre-wrap font-mono">{activePrompt.slice(0, 2000)}{activePrompt.length > 2000 ? '\n\n...' : ''}</pre>
                    </div>
                    <div className="flex items-center justify-between mt-2 shrink-0">
                      <span className="text-[9px] text-zinc-600">{activePrompt.length} chars</span>
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={copyPrompt}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#ec4899] px-3 py-2 text-[10px] font-semibold text-zinc-950 hover:bg-[#db2777] transition-colors min-h-[44px]">
                          {copied ? <ClipboardCheck size={12} /> : <Clipboard size={12} />} {copied ? 'Copied!' : 'Copy Prompt'}
                        </motion.button>
                        <button onClick={() => setBridgeStep('paste')} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-[10px] text-zinc-300 hover:bg-zinc-700/50 transition-colors min-h-[44px]">Next →</button>
                      </div>
                    </div>
                  </motion.div>
                )}
                {bridgeStep === 'paste' && (
                  <motion.div key="pa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                    <textarea value={pastedResponse} onChange={e => setPastedResponse(e.target.value)} placeholder="Paste the AI's JSON response here..."
                      className="flex-1 min-h-0 w-full resize-none rounded-lg border border-zinc-700/30 bg-zinc-950 light:bg-[var(--ws-surface-60)] p-3 font-mono text-[10px] leading-relaxed text-zinc-300 placeholder-zinc-600 outline-none transition-all duration-150 focus:border-[#ec4899]/60 focus:ring-2 focus:ring-[#ec4899]/20" />
                    {bridgeError && <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] p-2.5 text-[10px] text-red-300" role="alert"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {bridgeError}</div>}
                    <div className="flex gap-2 mt-2 shrink-0">
                      <motion.button whileTap={{ scale: 0.95 }} onClick={validateResponse} disabled={!pastedResponse.trim()}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#ec4899] px-4 py-2.5 text-[10px] font-semibold text-zinc-950 hover:bg-[#db2777] disabled:opacity-40 transition-colors min-h-[44px]">Validate</motion.button>
                      <button onClick={() => setBridgeStep('prompt')} className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2.5 text-[10px] text-zinc-300 hover:bg-zinc-700/50 transition-colors min-h-[44px]">←</button>
                    </div>
                  </motion.div>
                )}
                {bridgeStep === 'validate' && (
                  <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 rounded-lg border border-zinc-700/30 bg-zinc-950 light:bg-[var(--ws-surface-60)] p-3 overflow-auto">
                      <ValidationChecklist checks={bridgeChecks} />
                    </div>
                    {allPassed(bridgeChecks) ? (
                      <div className="mt-2 text-[10px] text-emerald-400 text-center py-2 font-medium">All checks passed! Result applied.</div>
                    ) : (
                      <div className="flex gap-2 mt-2 shrink-0">
                        {repairPrompt && <motion.button whileTap={{ scale: 0.95 }} onClick={copyRepair} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500/[0.12] border border-amber-500/25 px-3 py-2.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/[0.18] transition-colors min-h-[44px]"><Clipboard size={12} /> Copy Repair Prompt</motion.button>}
                        <button onClick={() => { setBridgeStep('paste'); setBridgeChecks([]); setBridgeError(null) }} className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2.5 text-[10px] text-zinc-300 hover:bg-zinc-700/50 transition-colors min-h-[44px]">← Back</button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Right: Result preview */}
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 flex flex-col min-h-0 overflow-auto">
              <h2 className="text-sm font-medium mb-3">Result Preview</h2>
              {!cutPlan && !sceneDsl ? (
                <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950 light:bg-[var(--ws-surface-30)] text-center">
                  <FileJson size={28} className="mb-3 text-zinc-600" />
                  <p className="text-sm text-zinc-400">No result yet</p>
                  <p className="mt-1 text-[10px] text-zinc-500">Complete the bridge steps to see results here.</p>
                </div>
              ) : cutPlan && bridgeMode === 'cutplan' ? (
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-500 mb-2">Kept: {cutPlan.kept?.length || 0} · Cut: {cutPlan.cut?.length || 0}</div>
                  {cutPlan.kept?.map((k: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-2.5">
                      <Check size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-emerald-400 font-medium">{k.role || k.intent} · {fmt(k.start)} – {fmt(k.end)}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{k.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : sceneDsl ? (
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-500 mb-2">Scenes: {sceneDsl.scenes?.length || 0}</div>
                  {sceneDsl.scenes?.map((s: any, i: number) => (
                    <div key={i} className="rounded-lg bg-zinc-800/30 border border-zinc-700/20 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-[#22d3ee] font-semibold">{s.renderer}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">{fmt(s.start_time)} – {fmt(s.end_time)}</span>
                      </div>
                      <div className="text-[10px] text-zinc-300 font-medium mt-0.5">{s.title}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* ═══════════════ CUT PLAN VIEW ═══════════════ */}
        {view === 'cutplan' && activeTranscript && cutPlan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 320px' }}>
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 overflow-auto min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-300">Cut Plan</h3>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 transition-all min-h-[44px] min-w-[44px]">
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <span className="text-[10px] text-zinc-500 font-mono">{fmt(currentTime)} / {fmt(activeTranscript.duration)}</span>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${(() => { const t = cutPlan.kept?.reduce((s: number, k: any) => s + (k.end - k.start), 0) || 0; return t >= 90 && t <= 180 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400' })()}`}>
                    Kept: {fmt(cutPlan.kept?.reduce((s: number, k: any) => s + (k.end - k.start), 0) || 0)}
                  </span>
                  <button onClick={() => setView('dashboard')} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">Back</button>
                </div>
              </div>
              {/* Timeline */}
              <div className="relative h-11 rounded-lg bg-zinc-800/40 border border-zinc-700/30 mb-4">
                {activeTranscript.segments?.map((seg: any) => {
                  const kept = cutPlan.kept?.find((k: any) => k.segment_id === seg.id)
                  return (
                    <div key={seg.id}
                      className={`absolute top-1 bottom-1 rounded transition-all duration-150 ${kept ? 'bg-emerald-500/20 border-l-2 border-emerald-400' : 'bg-zinc-700/20 border-l-2 border-zinc-600 opacity-40'}`}
                      style={{ left: `${(seg.start / activeTranscript.duration) * 100}%`, width: `${((seg.end - seg.start) / activeTranscript.duration) * 100}%` }} />
                  )
                })}
                <div className="absolute top-0 bottom-0 w-0.5 bg-[#22d3ee] pointer-events-none z-10" style={{ left: `${(currentTime / activeTranscript.duration) * 100}%` }}>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#22d3ee] rounded-full shadow-lg shadow-[#22d3ee]/30" />
                </div>
              </div>
              {/* Segment list */}
              <div className="space-y-1">
                {activeTranscript.segments?.map((seg: any) => {
                  const kept = cutPlan.kept?.find((k: any) => k.segment_id === seg.id)
                  return (
                    <div key={seg.id} className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${kept ? 'bg-emerald-500/[0.06] border border-emerald-500/20' : 'bg-zinc-800/20 border border-transparent opacity-50'}`}>
                      <span className="text-[9px] text-zinc-600 font-mono w-8 shrink-0 pt-0.5">#{seg.id}</span>
                      <span className="text-[9px] text-[#22d3ee] font-mono w-20 shrink-0 pt-0.5">{fmt(seg.start)} – {fmt(seg.end)}</span>
                      <span className="text-[11px] text-zinc-300 leading-relaxed flex-1">{seg.text}</span>
                      {kept && <span className="text-[8px] text-emerald-400 font-semibold shrink-0 pt-0.5">{kept.role || kept.intent}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-4 overflow-auto">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3">Cut Plan Details</h3>
              <div className="space-y-2">
                {cutPlan.kept?.map((k: any, i: number) => (
                  <div key={i} className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-2.5">
                    <div className="text-[10px] text-emerald-400 font-medium">{k.role || k.intent} · {fmt(k.start)} – {fmt(k.end)}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{k.reason}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => startBridge('scenedsl')} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#ec4899] px-3 py-2.5 text-[10px] font-semibold text-zinc-950 hover:bg-[#db2777] transition-colors min-h-[44px]">
                  <Sparkles size={12} /> Generate Scenes
                </button>
                <button onClick={() => setView('dashboard')} className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2.5 text-[10px] text-zinc-300 hover:bg-zinc-700/50 transition-colors min-h-[44px]">Back</button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ VISUALIZE VIEW ═══════════════ */}
        {view === 'visualize' && sceneDsl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: '1fr 300px' }}>
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-5 overflow-auto min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-300">Generated Scenes ({sceneDsl.scenes?.length || 0})</h3>
                <button onClick={() => setView('dashboard')} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">Back</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {sceneDsl.scenes?.map((s: any, i: number) => (
                  <div key={i} className="rounded-lg bg-zinc-800/30 border border-zinc-700/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-[#22d3ee] font-semibold">{s.renderer}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">{fmt(s.start_time)} – {fmt(s.end_time)}</span>
                    </div>
                    <div className="text-[10px] text-zinc-300 font-medium mb-1">{s.title}</div>
                    <pre className="text-[9px] text-zinc-500 whitespace-pre-wrap font-mono leading-relaxed max-h-[60px] overflow-auto">{s.source}</pre>
                    {s.emphasis_words?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.emphasis_words.map((w: string, j: number) => (
                          <span key={j} className="text-[8px] px-1 py-0.5 rounded bg-[#22d3ee]/10 text-[#22d3ee]">{w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* 9:16 Preview */}
            <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl p-4 flex flex-col items-center min-h-0">
              <h3 className="text-xs font-semibold text-zinc-300 mb-2">9:16 Preview</h3>
              <div className="relative rounded-lg overflow-hidden border border-zinc-700/50" style={{ width: 270, height: 480, background: 'var(--ws-surface-raised)' }}>
                <div className="absolute border border-dashed border-red-500/30 bg-red-500/5 rounded pointer-events-none" style={{ left: 190, top: 380, width: 80, height: 100 }} />
                <div className="absolute bottom-1 right-1 text-[7px] text-[var(--text-muted)] pointer-events-none">face cam</div>
                {sceneDsl.scenes?.filter((s: any) => currentTime >= s.start_time && currentTime <= s.end_time).map((s: any, i: number) => (
                  <div key={i} className="absolute px-3 py-2 rounded-lg max-w-[85%] pointer-events-none" style={{ top: '20%', left: '8%', right: '8%', background: 'rgba(13,17,23,0.85)', border: '1px solid #22d3ee40' }}>
                    <div className="text-[9px] text-[#22d3ee] font-medium mb-0.5">{s.renderer}</div>
                    <div className="text-white text-[11px] leading-snug font-medium">{s.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

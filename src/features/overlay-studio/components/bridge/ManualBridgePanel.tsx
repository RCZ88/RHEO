import React, { useMemo, useState, useCallback } from 'react'
import { useStudio } from '../../state/StudioProvider'
import { AlertTriangle, Check, Clipboard, ClipboardCheck, Eye, FileJson, X } from 'lucide-react'
import { BlurFade } from '../ui'
import { motion, AnimatePresence } from 'framer-motion'
import { PROMPT_CUT_PLANNER, PROMPT_SCENE_DSL } from '../../../../lib/overlayPrompts'
import { extractJson, validateCutPlan, validateSceneDSL, allPassed, passedCount } from '../../../../lib/overlayParser'
import { buildVisualBridgePrompt, validateVisualDigestJson, setDigest } from '../../vision/services/visualAnalysisService'

export function ManualBridgePanel() {
  const { state, dispatch, activeSession } = useStudio()
  const { bridge } = state
  const [copied, setCopied] = useState(false)

  const activePrompt = useMemo(() => {
    const videoName = activeSession?.sourceVideoName || 'untitled'
    if (bridge.mode === 'visual-digest') {
      return buildVisualBridgePrompt(videoName, activeSession?.transcript, null)
    }
    const basePrompt = bridge.mode === 'cut-plan' ? PROMPT_CUT_PLANNER : PROMPT_SCENE_DSL
    const header = '\n\n================ INPUT DATA ================\nvideo_id: ' + videoName + '\n'
    if (activeSession?.transcript) {
      const dataLabel = bridge.mode === 'cut-plan' ? 'transcript' : 'kept_transcript'
      return basePrompt + header + dataLabel + ':\n' + JSON.stringify(activeSession.transcript, null, 2)
    }
    return basePrompt + header + '(Paste your transcript JSON here)\n\n{\n  "video_id": "' + videoName + '",\n  "duration": 0,\n  "segments": [\n    { "id": 0, "start": 0.0, "end": 5.0, "text": "Your transcript segment here..." }\n  ]\n}'
  }, [activeSession, bridge.mode])

  const copyPrompt = useCallback(async () => {
    try { await navigator.clipboard.writeText(activePrompt) } catch { const ta = document.createElement('textarea'); ta.value = activePrompt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [activePrompt])

  const validateResponse = useCallback(() => {
    if (!bridge.rawResponse.trim()) return
    try {
      const parsed = extractJson(bridge.rawResponse)
      let checks: Array<{ rule: string; message: string; passed: boolean }> = []
      if (bridge.mode === 'cut-plan') checks = validateCutPlan(parsed, activeSession?.transcript)
      else if (bridge.mode === 'scene-dsl') checks = validateSceneDSL(parsed, activeSession?.transcript)
      else checks = validateVisualDigestJson(parsed)
      dispatch({ type: 'VALIDATE_BRIDGE_SUCCESS', checks })
    } catch (err: any) {
      dispatch({ type: 'VALIDATE_BRIDGE_ERROR', error: err.message })
    }
  }, [bridge.rawResponse, bridge.mode, activeSession, dispatch])

  const handleAccept = useCallback(() => {
    if (bridge.mode === 'visual-digest' && activeSession) {
      try { const parsed = extractJson(bridge.rawResponse); setDigest(activeSession.sourceVideoName, parsed); dispatch({ type: 'SET_DIGEST', sessionId: activeSession.id, digest: parsed }) } catch {}
    }
    dispatch({ type: 'ACCEPT_BRIDGE_RESULT' })
    if (bridge.mode === 'visual-digest') dispatch({ type: 'SET_STAGE', stage: 'visual-evidence' })
    else if (bridge.mode === 'cut-plan') dispatch({ type: 'SET_STAGE', stage: 'cut-plan' })
    else dispatch({ type: 'SET_STAGE', stage: 'scene-plan' })
  }, [bridge.mode, activeSession, dispatch])

  const modeLabel = bridge.mode === 'cut-plan' ? 'Cut Planner' : bridge.mode === 'scene-dsl' ? 'Scene DSL' : 'Visual Digest'

  return (
    <div className="p-5 space-y-4">
      <BlurFade>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-200">Manual Bridge — {modeLabel}</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Copy the prompt → paste into any AI → paste the response back.</p>
          </div>
          <button onClick={() => dispatch({ type: 'CLOSE_BRIDGE' })} className="studio-btn-ghost rounded-md"><X size={14} /></button>
        </div>
      </BlurFade>

      {!activeSession?.transcript && bridge.mode !== 'visual-digest' && (
        <BlurFade delay={0.1}>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-[11px] text-amber-300">
            <strong>No transcript loaded.</strong> The prompt includes full system instructions. Add transcript data for a complete prompt.
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.15}>
        <div className="flex items-center gap-2">
          {(['prompt', 'paste', 'validate'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${bridge.step === s ? 'bg-white/20 text-white' : (['prompt', 'paste', 'validate'].indexOf(bridge.step) > i ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500')}`}>
                {['prompt', 'paste', 'validate'].indexOf(bridge.step) > i ? '✓' : i + 1}
              </div>
              <span className={`text-[11px] ${bridge.step === s ? 'text-zinc-200' : 'text-zinc-500'}`}>{s === 'prompt' ? 'Copy' : s === 'paste' ? 'Paste' : 'Check'}</span>
              {i < 2 && <div className="w-4 h-px bg-zinc-700" />}
            </div>
          ))}
        </div>
      </BlurFade>

      <AnimatePresence mode="wait">
        {bridge.step === 'prompt' && (
          <motion.div key="prompt" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="space-y-2">
            <div className="rounded-xl border border-white/[0.08] bg-zinc-950 light:bg-[var(--ws-surface)]/60 p-3 max-h-[400px] overflow-auto">
              <pre className="text-[11px] text-zinc-500 leading-relaxed whitespace-pre-wrap font-mono">{activePrompt.slice(0, 4000)}{activePrompt.length > 4000 ? '\n\n...(truncated)' : ''}</pre>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-600">{activePrompt.length} chars</span>
              <div className="flex gap-2">
                <button onClick={copyPrompt} className="studio-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px]">{copied ? <ClipboardCheck size={12} /> : <Clipboard size={12} />} {copied ? 'Copied!' : 'Copy Prompt'}</button>
                <button onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: 'paste' })} className="studio-btn-secondary rounded-lg px-3 py-2 text-[11px]">Next →</button>
              </div>
            </div>
          </motion.div>
        )}

        {bridge.step === 'paste' && (
          <motion.div key="paste" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="space-y-2">
            <textarea value={bridge.rawResponse} onChange={e => dispatch({ type: 'SET_BRIDGE_RESPONSE', rawResponse: e.target.value })}
              placeholder={bridge.mode === 'visual-digest' ? 'Paste the visual analysis JSON from your vision AI here.\n\nExample:\n```json\n{"gist": "...", "keywords": [...], "frames": [...]}\n```' : 'Paste the raw JSON response from your AI model here.'}
              className="h-[250px] w-full resize-none rounded-xl border border-white/[0.08] bg-zinc-950 light:bg-[var(--ws-surface)]/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 placeholder-zinc-600 outline-none transition-all duration-150 focus:border-white/[0.15]" />
            <div className="flex gap-2">
              <button onClick={validateResponse} disabled={!bridge.rawResponse.trim()} className="studio-btn-primary flex-1 rounded-lg px-4 py-2.5 text-[11px]">Validate</button>
              <button onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: 'prompt' })} className="studio-btn-secondary rounded-lg px-3 py-2.5 text-[11px]">← Back</button>
            </div>
          </motion.div>
        )}

        {bridge.step === 'validate' && (
          <motion.div key="validate" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="space-y-2">
            <div className="rounded-xl border border-white/[0.08] bg-zinc-950 light:bg-[var(--ws-surface)]/60 p-3 max-h-[300px] overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-zinc-300">Validation</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${allPassed(bridge.validationChecks) ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{passedCount(bridge.validationChecks).passed}/{passedCount(bridge.validationChecks).total} passed</span>
              </div>
              {bridge.validationChecks.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] py-1">
                  <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{c.passed ? '✓' : '✗'}</span>
                  <span className={`font-medium ${c.passed ? 'text-zinc-400' : 'text-red-300'}`}>{c.rule}</span>
                </div>
              ))}
            </div>
            {allPassed(bridge.validationChecks) ? (
              <button onClick={handleAccept} className="w-full studio-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[11px]"><Check size={12} /> Accept Result</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { dispatch({ type: 'SET_BRIDGE_STEP', step: 'paste' }); dispatch({ type: 'VALIDATE_BRIDGE_ERROR', error: '' }) }} className="studio-btn-secondary rounded-lg px-3 py-2.5 text-[11px]">← Back</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {bridge.lastError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] p-2.5 text-[11px] text-red-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {bridge.lastError}
        </div>
      )}
    </div>
  )
}

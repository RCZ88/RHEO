Below are the complete drop-in replacement files for the four broken Overlay Studio files.

---

## `src/features/overlay-studio/components/bridge/ManualBridgePanel.tsx`

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useStudio } from '../../state/StudioProvider'
import {
  AlertTriangle,
  Check,
  Clipboard,
  ClipboardCheck,
  FileJson,
  Loader2,
} from 'lucide-react'
import {
  PROMPT_CUT_PLANNER,
  PROMPT_SCENE_DSL,
} from '../../../../lib/overlayPrompts'
import {
  extractJson,
  validateCutPlan,
  validateSceneDSL,
  allPassed,
  passedCount,
} from '../../../../lib/overlayParser'
import type { DirectorCut } from '../../../../types/overlayStudio'

type BridgeStep = 'prompt' | 'paste' | 'validate'

const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ManualBridgePanel() {
  const { state, dispatch, activeSession } = useStudio()
  const { bridge } = state

  const [copied, setCopied] = useState(false)
  const [isParsing, setIsParsing] = useState(false)

  const activePrompt = useMemo(() => {
    const basePrompt =
      bridge.mode === 'cut-plan' ? PROMPT_CUT_PLANNER : PROMPT_SCENE_DSL

    const inputData = activeSession?.transcript
      ? `

================ INPUT DATA ================
video_id: ${activeSession.sourceVideoName}
${bridge.mode === 'cut-plan' ? 'transcript' : 'kept_transcript'}:
${JSON.stringify(activeSession.transcript, null, 2)}`
      : `

================ INPUT DATA ================
No transcript loaded yet.

Use this template with a transcript JSON object.

Expected transcript shape:
{
  "video_id": "string",
  "duration": 0,
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.5,
      "text": "..."
    }
  ]
}`

    return basePrompt + inputData
  }, [activeSession, bridge.mode])

  useEffect(() => {
    dispatch({
      type: 'SET_BRIDGE_PROMPT',
      prompt: activePrompt,
    })
  }, [activePrompt, dispatch])

  const promptText = bridge.prompt || activePrompt

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = promptText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)

      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }, [promptText])

  const handleValidate = useCallback(() => {
    if (!bridge.rawResponse.trim()) {
      dispatch({
        type: 'VALIDATE_BRIDGE_ERROR',
        error: 'Paste an AI response before validating.',
      })
      return
    }

    setIsParsing(true)
    dispatch({ type: 'SET_BRIDGE_STEP', step: 'validate' })

    window.setTimeout(() => {
      try {
        const parsed = extractJson(bridge.rawResponse)

        if (!parsed) {
          throw new Error('No JSON found in the pasted response.')
        }

        const checks =
          bridge.mode === 'cut-plan'
            ? validateCutPlan(parsed, activeSession?.transcript)
            : validateSceneDSL(parsed, activeSession?.transcript)

        dispatch({
          type: 'VALIDATE_BRIDGE_SUCCESS',
          checks,
        })
      } catch (error) {
        dispatch({
          type: 'VALIDATE_BRIDGE_ERROR',
          error:
            error instanceof Error
              ? error.message
              : 'Validation failed. Check the pasted JSON response.',
        })
      } finally {
        setIsParsing(false)
      }
    }, 0)
  }, [bridge.rawResponse, bridge.mode, activeSession?.transcript, dispatch])

  const canAccept =
    bridge.validationChecks.length > 0 && allPassed(bridge.validationChecks)

  const handleAccept = useCallback(() => {
    try {
      const parsed = extractJson(bridge.rawResponse)

      if (!parsed) {
        dispatch({
          type: 'VALIDATE_BRIDGE_ERROR',
          error: 'Could not accept result because no valid JSON was found.',
        })
        return
      }

      let sessionId = activeSession?.id

      if (!sessionId) {
        sessionId = uid()

        dispatch({
          type: 'CREATE_SESSION',
          session: {
            id: sessionId,
            name:
              bridge.mode === 'cut-plan'
                ? 'manual-cut-plan-session'
                : 'manual-scene-plan-session',
            sourceVideoPath: 'manual-bridge',
            sourceVideoName:
              bridge.mode === 'cut-plan'
                ? 'manual-cut-plan-session'
                : 'manual-scene-plan-session',
            durationSec: 0,
            status: 'created',
            missingSource: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        })
      }

      if (bridge.mode === 'cut-plan') {
        dispatch({
          type: 'SET_CUT_PLAN',
          sessionId,
          cutPlan: parsed,
        })

        dispatch({
          type: 'SET_STAGE',
          stage: 'cut-plan',
        })
      } else {
        dispatch({
          type: 'SET_SCENE_PLAN',
          sessionId,
          scenePlan: parsed as DirectorCut,
        })

        dispatch({
          type: 'SET_STAGE',
          stage: 'scene-plan',
        })
      }

      dispatch({
        type: 'ACCEPT_BRIDGE_RESULT',
      })
    } catch (error) {
      dispatch({
        type: 'VALIDATE_BRIDGE_ERROR',
        error:
          error instanceof Error
            ? error.message
            : 'Could not accept the Manual Bridge result.',
      })
    }
  }, [activeSession?.id, bridge.mode, bridge.rawResponse, dispatch])

  const steps: Array<{ key: BridgeStep; label: string }> = [
    { key: 'prompt', label: 'Copy Prompt' },
    { key: 'paste', label: 'Paste Response' },
    { key: 'validate', label: 'Validate' },
  ]

  const { passed, total } = passedCount(bridge.validationChecks)

  return (
    <div className="p-5 space-y-5 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#ec4899] mb-1">
          <FileJson size={14} />
          Manual Bridge
        </div>

        <h1 className="text-lg font-semibold text-zinc-100">
          {bridge.mode === 'cut-plan' ? 'Cut Plan Bridge' : 'Scene DSL Bridge'}
        </h1>

        <p className="text-[11px] text-zinc-500 mt-1">
          Copy the system prompt, paste the AI response, then validate and
          accept the result.
        </p>
      </div>

      {!activeSession && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="text-[11px] text-amber-200/90 leading-relaxed">
            No session is selected. The prompt template is still available.
            Accepting a valid result will create a Manual Bridge session.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: 'OPEN_BRIDGE', mode: 'cut-plan' })}
          className={`px-3 py-2 rounded-lg text-[11px] font-medium border transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 active:scale-[0.98] ${
            bridge.mode === 'cut-plan'
              ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/25'
              : 'bg-zinc-900/50 text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          Cut Plan
        </button>

        <button
          onClick={() => dispatch({ type: 'OPEN_BRIDGE', mode: 'scene-dsl' })}
          className={`px-3 py-2 rounded-lg text-[11px] font-medium border transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 active:scale-[0.98] ${
            bridge.mode === 'scene-dsl'
              ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/25'
              : 'bg-zinc-900/50 text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          Scene DSL
        </button>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isActive = bridge.step === step.key
          const isComplete = index < steps.findIndex(s => s.key === bridge.step)

          return (
            <button
              key={step.key}
              onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: step.key })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 active:scale-[0.98] ${
                isActive
                  ? 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/25'
                  : isComplete
                    ? 'bg-emerald-500/5 text-emerald-300 border-emerald-500/20'
                    : 'bg-zinc-900/50 text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                  isActive
                    ? 'border-[#ec4899]/40 text-[#ec4899]'
                    : isComplete
                      ? 'border-emerald-500/30 text-emerald-300'
                      : 'border-zinc-700 text-zinc-500'
                }`}
              >
                {index + 1}
              </span>
              {step.label}
            </button>
          )
        })}
      </div>

      {bridge.step === 'prompt' && (
        <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/70 backdrop-blur-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-zinc-200">
                System Prompt
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                Copy this prompt into any AI model. It must never be empty.
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="studio-btn-secondary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs min-h-[44px]"
            >
              {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
              {copied ? 'Copied' : 'Copy Prompt'}
            </button>
          </div>

          <textarea
            readOnly
            value={promptText}
            className="w-full h-80 rounded-lg border border-zinc-700/40 bg-zinc-950/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50"
          />

          <div className="flex justify-end">
            <button
              onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: 'paste' })}
              className="studio-btn-primary rounded-lg px-4 py-2 text-xs min-h-[44px]"
            >
              Next: Paste Response
            </button>
          </div>
        </div>
      )}

      {bridge.step === 'paste' && (
        <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/70 backdrop-blur-xl p-4 space-y-3">
          <div>
            <div className="text-[13px] font-semibold text-zinc-200">
              Paste AI Response
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              Paste the raw JSON response returned by the AI model.
            </div>
          </div>

          <textarea
            value={bridge.rawResponse}
            onChange={event =>
              dispatch({
                type: 'SET_BRIDGE_RESPONSE',
                rawResponse: event.target.value,
              })
            }
            placeholder="Paste the AI JSON response here..."
            className="w-full h-80 rounded-lg border border-zinc-700/40 bg-zinc-950/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50"
          />

          {bridge.lastError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-red-300 leading-relaxed">
                {bridge.lastError}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: 'prompt' })}
              className="studio-btn-secondary rounded-lg px-4 py-2 text-xs min-h-[44px]"
            >
              Back
            </button>

            <button
              onClick={handleValidate}
              disabled={!bridge.rawResponse.trim() || isParsing}
              className="studio-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isParsing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Validate Response
            </button>
          </div>
        </div>
      )}

      {bridge.step === 'validate' && (
        <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/70 backdrop-blur-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-zinc-200">
                Validation Checklist
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {total > 0
                  ? `${passed}/${total} checks passed.`
                  : 'No validation checks have been run yet.'}
              </div>
            </div>

            {bridge.validationChecks.length > 0 && (
              <span
                className={`text-[11px] font-medium px-2 py-1 rounded-full border ${
                  allPassed(bridge.validationChecks)
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-300 border-red-500/20'
                }`}
              >
                {allPassed(bridge.validationChecks) ? 'Valid' : 'Invalid'}
              </span>
            )}
          </div>

          {bridge.lastError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-red-300 leading-relaxed">
                {bridge.lastError}
              </span>
            </div>
          )}

          {bridge.validationChecks.length === 0 && !bridge.lastError && (
            <div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-950/30 p-6 text-center">
              <FileJson size={22} className="mx-auto mb-2 text-zinc-600" />
              <p className="text-[11px] text-zinc-500">
                Paste a response and click Validate Response.
              </p>
            </div>
          )}

          {bridge.validationChecks.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
              {bridge.validationChecks.map((check, index) => (
                <div
                  key={`${check.rule}-${index}`}
                  className={`rounded-lg border p-3 flex items-start gap-2 ${
                    check.passed
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  {check.passed ? (
                    <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div
                      className={`text-[11px] font-semibold ${
                        check.passed ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {check.rule}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      {check.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: 'paste' })}
              className="studio-btn-secondary rounded-lg px-4 py-2 text-xs min-h-[44px]"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => dispatch({ type: 'SET_BRIDGE_STEP', step: 'prompt' })}
                className="studio-btn-secondary rounded-lg px-4 py-2 text-xs min-h-[44px]"
              >
                Edit Prompt
              </button>

              <button
                onClick={handleAccept}
                disabled={!canAccept}
                className="studio-btn-primary rounded-lg px-4 py-2 text-xs min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## `src/features/overlay-studio/components/dashboard/DashboardView.tsx`

```tsx
import React from 'react'
import { useStudio } from '../../state/StudioProvider'
import {
  AlertTriangle,
  FileJson,
  Film,
  Layers,
  Play,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { motion } from 'framer-motion'

const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const SAMPLE_TRANSCRIPT = {
  video_id: 'sample_tutorial',
  duration: 320.5,
  segments: [
    {
      id: 0,
      start: 0.0,
      end: 5.2,
      text: 'Welcome to this tutorial. Today we are going to cover three important concepts.',
    },
    {
      id: 1,
      start: 5.5,
      end: 15.8,
      text: 'The first concept is the foundation. Without understanding this, everything else falls apart.',
    },
    {
      id: 2,
      start: 16.2,
      end: 28.0,
      text: 'Let me show you a comparison between the old approach and the new approach.',
    },
    {
      id: 3,
      start: 28.5,
      end: 42.0,
      text: 'Now let me explain how this works in practice. You can see the results here.',
    },
    {
      id: 4,
      start: 42.5,
      end: 58.0,
      text: 'The key metric to watch is the efficiency ratio. When this number goes up, performance improves.',
    },
    {
      id: 5,
      start: 58.5,
      end: 75.0,
      text: 'In summary, these three concepts form the basis of everything we will cover in this series.',
    },
  ],
}

function ToolCard({
  icon: Icon,
  title,
  description,
  status,
  onClick,
  delay = 0,
}: {
  icon: React.FC<{ size?: number }>
  title: string
  description: string
  status: string
  onClick: () => void
  delay?: number
}) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="w-full text-left rounded-xl border border-zinc-700/30 bg-zinc-800/30 p-4 hover:border-[#ec4899]/30 hover:bg-zinc-800/50 transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#ec4899]/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[#ec4899]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-zinc-200">{title}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
            {description}
          </div>
        </div>

        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
            status === 'ready'
              ? 'bg-emerald-500/15 text-emerald-400'
              : status === 'needs-setup'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-zinc-700/30 text-zinc-500'
          }`}
        >
          {status === 'ready' ? 'Ready' : status === 'needs-setup' ? 'Setup' : 'Available'}
        </span>
      </div>
    </motion.button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-5">
      <div className="space-y-2">
        <div className="h-5 w-48 bg-zinc-800/50 rounded-lg animate-pulse" />
        <div className="h-3 w-80 bg-zinc-800/30 rounded-lg animate-pulse" />
      </div>

      <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/70 p-4">
        <div className="h-4 w-40 bg-zinc-800/50 rounded animate-pulse mb-2" />
        <div className="h-3 w-60 bg-zinc-800/30 rounded animate-pulse" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(item => (
          <div key={item} className="h-24 bg-zinc-800/30 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
        <AlertTriangle size={20} className="text-red-400" />
      </div>

      <p className="text-sm font-medium text-zinc-300">{message}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 studio-btn-primary px-4 py-2 rounded-lg text-xs min-h-[44px]"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function DashboardView() {
  const { state, dispatch, activeSession, handleImport } = useStudio()
  const asyncState = state.async

  if (asyncState.sessions.state === 'loading') {
    return <LoadingSkeleton />
  }

  if (asyncState.sessions.state === 'error') {
    return (
      <ErrorState
        message={asyncState.sessions.error || 'Failed to load sessions'}
        onRetry={() => dispatch({ type: 'LOAD_SESSIONS_START' })}
      />
    )
  }

  const loadSample = () => {
    dispatch({
      type: 'CREATE_SESSION',
      session: {
        id: uid(),
        name: 'sample_tutorial.mp4',
        sourceVideoPath: 'sample_tutorial.mp4',
        sourceVideoName: 'sample_tutorial.mp4',
        durationSec: SAMPLE_TRANSCRIPT.duration,
        transcript: SAMPLE_TRANSCRIPT,
        status: 'transcript_ready',
        missingSource: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#ec4899] mb-1">
          <Sparkles size={14} />
          Overlay Studio
        </div>

        <h1 className="text-lg font-semibold text-zinc-100">
          Video Overlay Suggestion Studio
        </h1>

        <p className="text-[11px] text-zinc-500 mt-1">
          Analyze videos, generate cut plans, preview overlays, and export
          suggestion plans.
        </p>
      </div>

      {activeSession ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-zinc-700/30 bg-zinc-900/70 backdrop-blur-xl p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-zinc-200">
                {activeSession.sourceVideoName}
              </div>

              <div className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[400px]">
                {activeSession.sourceVideoPath}
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    activeSession.transcript
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-zinc-700/30 text-zinc-500'
                  }`}
                >
                  {activeSession.transcript ? 'Transcript ready' : 'No transcript'}
                </span>

                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    activeSession.cutPlan
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-zinc-700/30 text-zinc-500'
                  }`}
                >
                  {activeSession.cutPlan ? 'Cut plan ready' : 'No cut plan'}
                </span>

                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    activeSession.scenePlan
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-zinc-700/30 text-zinc-500'
                  }`}
                >
                  {activeSession.scenePlan ? 'Scene plan ready' : 'No scene plan'}
                </span>
              </div>
            </div>

            <button
              onClick={() =>
                dispatch({
                  type: 'SET_STAGE',
                  stage: activeSession.transcript ? 'transcript' : 'source',
                })
              }
              className="studio-btn-primary rounded-lg px-4 py-2 text-xs min-h-[44px] shrink-0"
            >
              Continue
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 p-8 text-center"
        >
          <Film size={28} className="mx-auto mb-3 text-zinc-600" />

          <p className="text-[13px] font-medium text-zinc-400">
            No active video session
          </p>

          <p className="text-[11px] text-zinc-500 mt-1 mb-4">
            Import a video to begin analyzing and generating overlays, or load
            the sample transcript to test the pipeline.
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handleImport}
              className="studio-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs min-h-[44px]"
            >
              <Plus size={14} />
              Import Video
            </button>

            <button
              onClick={loadSample}
              className="studio-btn-secondary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs min-h-[44px]"
            >
              <FileJson size={14} />
              Load Sample
            </button>
          </div>
        </motion.div>
      )}

      <div>
        <h3 className="text-[13px] font-semibold text-zinc-300 mb-3">
          Pipeline Tools
        </h3>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ToolCard
            icon={Film}
            title="Import Video"
            description="Add a local video file or transcript JSON."
            status={activeSession ? 'ready' : 'available'}
            onClick={handleImport}
            delay={0}
          />

          <ToolCard
            icon={FileJson}
            title="Transcript"
            description="View and edit transcript segments."
            status={
              activeSession?.transcript
                ? 'ready'
                : activeSession
                  ? 'needs-setup'
                  : 'available'
            }
            onClick={() => {
              if (activeSession?.transcript) {
                dispatch({ type: 'SET_STAGE', stage: 'transcript' })
              } else if (activeSession) {
                dispatch({ type: 'OPEN_BRIDGE', mode: 'cut-plan' })
              } else {
                dispatch({ type: 'SET_STAGE', stage: 'source' })
              }
            }}
            delay={0.05}
          />

          <ToolCard
            icon={Wand2}
            title="Manual Bridge"
            description="Generate prompts and paste AI responses."
            status="ready"
            onClick={() => dispatch({ type: 'OPEN_BRIDGE', mode: 'cut-plan' })}
            delay={0.1}
          />

          <ToolCard
            icon={Layers}
            title="Cut Planner"
            description="AI selects which segments to keep."
            status={
              activeSession?.cutPlan
                ? 'ready'
                : activeSession
                  ? 'needs-setup'
                  : 'available'
            }
            onClick={() => {
              if (activeSession?.cutPlan) {
                dispatch({ type: 'SET_STAGE', stage: 'cut-plan' })
              } else if (activeSession) {
                dispatch({ type: 'OPEN_BRIDGE', mode: 'cut-plan' })
              } else {
                dispatch({ type: 'SET_STAGE', stage: 'source' })
              }
            }}
            delay={0.15}
          />

          <ToolCard
            icon={Sparkles}
            title="Scene DSL"
            description="AI plans visual overlays for each moment."
            status={
              activeSession?.scenePlan
                ? 'ready'
                : activeSession
                  ? 'needs-setup'
                  : 'available'
            }
            onClick={() => {
              if (activeSession?.scenePlan) {
                dispatch({ type: 'SET_STAGE', stage: 'scene-plan' })
              } else if (activeSession) {
                dispatch({ type: 'OPEN_BRIDGE', mode: 'scene-dsl' })
              } else {
                dispatch({ type: 'SET_STAGE', stage: 'source' })
              }
            }}
            delay={0.2}
          />

          <ToolCard
            icon={Play}
            title="Scene Visualizer"
            description="Preview overlays on a 9:16 canvas."
            status={
              activeSession?.scenePlan
                ? 'ready'
                : activeSession
                  ? 'needs-setup'
                  : 'available'
            }
            onClick={() => {
              if (activeSession?.scenePlan) {
                dispatch({ type: 'SET_STAGE', stage: 'visualizer' })
              } else if (activeSession) {
                dispatch({ type: 'OPEN_BRIDGE', mode: 'scene-dsl' })
              } else {
                dispatch({ type: 'SET_STAGE', stage: 'source' })
              }
            }}
            delay={0.25}
          />
        </div>
      </div>
    </div>
  )
}
```

---

## `src/features/overlay-studio/components/shell/StudioShell.tsx`

```tsx
import React from 'react'
import { StudioSidebar } from './StudioSidebar'
import { StudioWorkspace } from './StudioWorkspace'
import { StudioInspector } from './StudioInspector'

export function StudioShell() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <StudioSidebar />
      <StudioWorkspace />
      <StudioInspector />
    </div>
  )
}
```

---

## `src/features/overlay-studio/components/shell/StudioSidebar.tsx`

```tsx
import React from 'react'
import { useStudio } from '../../state/StudioProvider'
import { PIPELINE_STEPS } from '../../constants/studioConstants'
import {
  Film,
  FileText,
  Eye,
  Scissors,
  Layers,
  Play,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const ICONS: Record<string, React.FC<{ size?: number }>> = {
  Film,
  FileText,
  Eye,
  Scissors,
  Layers,
  Play,
  Download,
}

function getStepStatus(
  stepKey: string,
  activeStage: string,
  sessionStatus: string
): 'complete' | 'active' | 'pending' | 'blocked' | 'error' {
  const stageOrder = [
    'source',
    'transcript',
    'visual-evidence',
    'cut-plan',
    'scene-plan',
    'visualizer',
    'export',
  ]

  if (stepKey === activeStage) return 'active'

  if (activeStage === 'bridge') return 'pending'

  const activeIdx = stageOrder.indexOf(activeStage)
  const stepIdx = stageOrder.indexOf(stepKey)

  if (activeIdx >= 0 && stepIdx < activeIdx) return 'complete'

  if (sessionStatus.includes('error')) return 'error'

  return 'pending'
}

export function StudioSidebar() {
  const { state, dispatch, activeSession } = useStudio()
  const { activeStage, sessions, ui } = state

  return (
    <div
      className="flex flex-col h-full border-r border-[rgba(63,63,70,0.50)] bg-[rgba(24,24,27,0.85)] backdrop-blur-xl"
      style={{
        width: ui.sidebarCollapsed ? 72 : 280,
        transition: 'width 200ms ease-out',
      }}
    >
      <div className="px-3 py-4 space-y-1">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
          Pipeline
        </div>

        {PIPELINE_STEPS.map(step => {
          const Icon = ICONS[step.icon] || Film
          const status = activeSession
            ? getStepStatus(step.key, activeStage, activeSession.status)
            : 'blocked'

          return (
            <button
              key={step.key}
              onClick={() => {
                if (!activeSession) {
                  dispatch({ type: 'SET_STAGE', stage: 'dashboard' })
                  return
                }

                dispatch({ type: 'SET_STAGE', stage: step.key as any })
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 active:scale-[0.98] ${
                status === 'active'
                  ? 'bg-[#ec4899]/10 text-[#ec4899] border border-[#ec4899]/20'
                  : status === 'complete'
                    ? 'text-emerald-400 hover:bg-emerald-500/5'
                    : status === 'error'
                      ? 'text-red-400 hover:bg-red-500/5'
                      : 'text-zinc-500 hover:bg-zinc-800/50'
              }`}
            >
              <Icon size={14} />

              {!ui.sidebarCollapsed && <span>{step.label}</span>}

              {!ui.sidebarCollapsed && status === 'complete' && (
                <span className="ml-auto text-[10px]">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {!ui.sidebarCollapsed && (
        <div className="flex-1 overflow-auto px-3 py-2 border-t border-zinc-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Sessions
            </span>

            <button
              onClick={() => dispatch({ type: 'SET_STAGE', stage: 'source' })}
              className="studio-btn p-1 rounded-md hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Import video"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-1">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() =>
                  dispatch({ type: 'SET_ACTIVE_SESSION', sessionId: session.id })
                }
                className={`w-full text-left rounded-lg p-2.5 transition-all duration-150 min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 active:scale-[0.98] ${
                  state.activeSessionId === session.id
                    ? 'bg-[#ec4899]/8 border border-[#ec4899]/20'
                    : 'hover:bg-zinc-800/50 border border-transparent'
                }`}
              >
                <div className="text-[13px] font-medium text-zinc-200 truncate">
                  {session.sourceVideoName}
                </div>

                <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                  {session.sourceVideoPath}
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                      session.status.includes('ready') ||
                      session.status.includes('approved')
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : session.status.includes('error')
                          ? 'bg-red-500/15 text-red-400'
                          : session.status === 'created'
                            ? 'bg-zinc-700/30 text-zinc-500'
                            : 'bg-[#ec4899]/10 text-[#ec4899]'
                    }`}
                  >
                    {session.status.replace(/_/g, ' ')}
                  </span>

                  {session.missingSource && (
                    <span className="text-[11px] text-amber-400">⚠ Missing</span>
                  )}
                </div>
              </button>
            ))}

            {sessions.length === 0 && (
              <div className="text-[10px] text-zinc-600 text-center py-4">
                No sessions yet
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        className="p-2 border-t border-zinc-800/50 text-zinc-500 hover:text-zinc-300 transition-colors min-h-[44px] flex items-center justify-center"
      >
        {ui.sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </div>
  )
}
```
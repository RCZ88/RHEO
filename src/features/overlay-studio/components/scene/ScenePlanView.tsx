import React from 'react'
import { useStudio } from '../../state/StudioProvider'
import { FileJson, Play, Sparkles, Zap, Target, Clock } from 'lucide-react'
import { BlurFade, NumberTicker } from '../ui'

export function ScenePlanView() {
  const { state, dispatch, activeSession } = useStudio()
  const asyncState = state.async

  if (asyncState.scenePlan.state === 'loading') return (
    <div className="p-5 space-y-3"><div className="h-4 w-48 bg-zinc-800/50 rounded-lg animate-pulse" /><div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map(i => <div key={i} className="h-32 bg-zinc-800/30 rounded-xl animate-pulse" />)}</div></div>
  )

  if (!activeSession) return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <FileJson size={28} className="mb-3 text-zinc-600" />
      <p className="text-[13px] font-medium text-zinc-400">No session selected</p>
      <p className="text-[11px] text-zinc-500 mt-1">Overlay sessions always belong to an episode. Select one from the sidebar.</p>
    </div>
  )

  const overlays = activeSession.overlayPlan?.overlays || activeSession.scenePlan?.overlays || []

  if (overlays.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <FileJson size={28} className="mb-3 text-zinc-600" />
      <p className="text-[13px] font-medium text-zinc-400">No scene plan yet</p>
      <p className="text-[11px] text-zinc-500 mt-1 mb-4">Generate a scene DSL from the approved cut plan.</p>
      <button onClick={() => dispatch({ type: 'OPEN_BRIDGE', mode: 'scene-dsl' })} className="studio-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs"><Sparkles size={14} /> Open Manual Bridge</button>
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      <BlurFade>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-200">Scene Plan</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5"><NumberTicker value={overlays.length} fontSize={11} /> overlays for episode #{activeSession.episodeId}</p>
          </div>
          <button onClick={() => dispatch({ type: 'SET_STAGE', stage: 'visualizer' })} className="studio-btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]"><Play size={12} /> Preview</button>
        </div>
      </BlurFade>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overlays.map((overlay: any, i: number) => (
          <BlurFade key={i} delay={i * 0.03}>
            <div className="group relative rounded-xl border border-white/[0.08] bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] p-4 hover:border-white/[0.15] transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    {overlay.type === 'hook' ? <Zap size={13} className="text-white/70" /> : overlay.type === 'cta' ? <Target size={13} className="text-white/70" /> : <Sparkles size={13} className="text-white/70" />}
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider">{overlay.type || 'card'}</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {Math.floor(overlay.start_time / 60)}:{(overlay.start_time % 60).toFixed(1).padStart(4, '0')} – {Math.floor(overlay.end_time / 60)}:{(overlay.end_time % 60).toFixed(1).padStart(4, '0')}
                </span>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed mb-2">{overlay.text?.slice(0, 80)}{overlay.text?.length > 80 ? '...' : ''}</p>
              {overlay.emphasis_words?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {overlay.emphasis_words.slice(0, 3).map((w: string, j: number) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">{w}</span>
                  ))}
                </div>
              )}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-6 h-6 rounded-md bg-white/[0.08] flex items-center justify-center hover:bg-white/[0.15]">
                  <Play size={10} className="text-white/70" />
                </button>
              </div>
            </div>
          </BlurFade>
        ))}
      </div>
    </div>
  )
}

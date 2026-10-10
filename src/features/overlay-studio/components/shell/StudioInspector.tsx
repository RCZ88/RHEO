import React from 'react'
import { useStudio } from '../../state/StudioProvider'
import { ChevronLeft, ChevronRight, Film, Layers, Sparkles, AlertTriangle, Check, X } from 'lucide-react'
import { BlurFade } from '../ui'

export function StudioInspector() {
  const { state, activeSession, dispatch } = useStudio()
  const { ui, bridge, playback, selection } = state

  return (
    <div className="flex flex-col h-full border-l border-white/[0.08] bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-auto" style={{ width: ui.inspectorCollapsed ? 56 : 360, transition: 'width 200ms ease-out' }}>
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.08]">
        {!ui.inspectorCollapsed && <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Inspector</span>}
        <button onClick={() => dispatch({ type: 'TOGGLE_INSPECTOR' })} className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
          {ui.inspectorCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {!ui.inspectorCollapsed && (
        <div className="flex-1 p-3 space-y-4 overflow-auto">
          {/* Bridge state */}
          {state.activeStage === 'bridge' && (
            <BlurFade>
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">Manual Bridge</h3>
                <div className="text-[10px] text-zinc-500">Mode: {bridge.mode === 'cut-plan' ? 'Cut Planner' : bridge.mode === 'scene-dsl' ? 'Scene DSL' : 'Visual Digest'}</div>
                <div className="text-[10px] text-zinc-500">Step: {bridge.step}</div>
                {bridge.lastError && <div className="text-[10px] text-red-400">{bridge.lastError}</div>}
              </div>
            </BlurFade>
          )}

          {/* Selection details */}
          {selection && (
            <BlurFade delay={0.05}>
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">Selected</h3>
                <div className="text-[10px] text-zinc-500">{selection.type}: {selection.id}</div>
                {selection.type === 'motion-asset' && (
                  <div className="rounded-lg border border-white/[0.08] bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] p-2 text-[10px] text-zinc-400">
                    <div>Motion asset properties</div>
                    <div className="text-zinc-500 mt-1">Timing, layout, blend mode</div>
                  </div>
                )}
                {selection.type === 'overlay' && activeSession?.overlayPlan?.overlays && (
                  <div className="rounded-lg border border-white/[0.08] bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] p-2 space-y-1">
                    {(activeSession.overlayPlan.overlays as any[]).filter((_, i) => i === parseInt(selection.id)).map((o: any, i: number) => (
                      <div key={i} className="text-[10px] text-zinc-400">
                        <div className="text-zinc-200 font-medium">{o.type || 'card'}</div>
                        <div>{Math.floor(o.start_time / 60)}:{(o.start_time % 60).toFixed(1).padStart(4, '0')} – {Math.floor(o.end_time / 60)}:{(o.end_time % 60).toFixed(1).padStart(4, '0')}</div>
                        <div className="text-zinc-500 mt-1">{o.text?.slice(0, 60)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </BlurFade>
          )}

          {/* Playback state */}
          {state.activeStage === 'visualizer' && (
            <BlurFade delay={0.1}>
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">Playback</h3>
                <div className="text-[10px] text-zinc-500">Time: {playback.currentTime.toFixed(1)}s / {playback.duration.toFixed(1)}s</div>
                <div className="text-[10px] text-zinc-500">Playing: {playback.isPlaying ? 'Yes' : 'No'}</div>
                <div className="text-[10px] text-zinc-500">Rate: {playback.playbackRate}x</div>
              </div>
            </BlurFade>
          )}

          {/* Session details */}
          {activeSession && (
            <BlurFade delay={0.15}>
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">Session</h3>
                <div className="rounded-lg border border-white/[0.08] bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <Film size={11} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-300 truncate">{activeSession.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers size={11} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">EP #{activeSession.episodeId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={11} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">{activeSession.overlayPlan?.overlays?.length || 0} overlays</span>
                  </div>
                  {activeSession.missingSource && (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle size={11} />
                      <span className="text-[10px]">Missing source</span>
                    </div>
                  )}
                </div>
              </div>
            </BlurFade>
          )}

          {/* Safe zones info */}
          {state.activeStage === 'visualizer' && (
            <BlurFade delay={0.2}>
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">Safe Zones</h3>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Text Safe</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Face Cam</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">Captions</span>
                </div>
              </div>
            </BlurFade>
          )}

          {/* Empty state */}
          {!selection && state.activeStage !== 'bridge' && state.activeStage !== 'visualizer' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-[10px] text-zinc-600">Select an item to inspect.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

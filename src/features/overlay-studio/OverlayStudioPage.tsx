import React, { useEffect, useCallback, useRef, useState } from 'react'
import { StudioProvider, useStudio } from './state/StudioProvider'
import { StudioShell } from './components/shell/StudioShell'
import { ContentEngineWorkspace } from '../content-engine/ContentEngineWorkspace'
import { PresentationWorkspace } from '@/features/presentation/PresentationWorkspace'
import { studioHandoff } from './handoffBus'
import { Sparkles, Presentation } from 'lucide-react'
import type { StudioSession, StudioAction } from './state/studioTypes'

function uid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

// File-level import handler — uses a ref for dispatch (set by StudioPageInner).
// OVERLAY SESSIONS ALWAYS BELONG TO AN EPISODE — import requires selecting one.
const dispatchRef = { current: null as React.Dispatch<StudioAction> | null }
const overlayApi = () => (window as any).deskflowAPI?.contentEngine

async function fetchEpisodes(): Promise<any[]> {
  try {
    const list = await overlayApi()?.episodesList?.()
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

async function handleImport() {
  const api = (window as any).deskflowAPI
  if (!dispatchRef.current) return
  const dispatch = dispatchRef.current

  // Open the native dialog (returns a real filesystem path).
  const dlg = await api?.dialogOpenFile?.()
  if (!dlg || dlg.canceled || !dlg.filePath) return
  const filePath: string = dlg.filePath
  const fileName = filePath.split(/[\\/]/).pop() || filePath

  // OVERLAY SESSIONS ALWAYS BELONG TO AN EPISODE — fetch episodes and require selection
  const episodes = await fetchEpisodes()
  if (episodes.length === 0) {
    dispatch({ type: 'SET_STAGE', stage: 'dashboard' })
    return
  }

  // Pick the most recently updated episode as default (or could show a picker)
  // For now, use the latest episode; the session will be linked to it.
  const targetEpisode = episodes[0]
  const episodeId = targetEpisode.id

  if (fileName.toLowerCase().endsWith('.json')) {
    if (!api?.overlayStudioReadTranscript) {
      dispatch({ type: 'SET_STAGE', stage: 'transcript' })
      return
    }
    const res = await api.overlayStudioReadTranscript({ filePath })
    if (res?.ok && res.transcript) {
      const data = res.transcript
      const session: StudioSession = {
        id: uid(), name: fileName, episodeId,
        sourceVideoPath: filePath, sourceVideoName: fileName,
        durationSec: data.duration, transcript: data, status: 'transcript_ready', missingSource: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      dispatch({ type: 'CREATE_SESSION', session })
      // Persist link to backend
      await overlayApi()?.overlaySessionCreate?.({ episodeId, name: fileName, sourceVideoPath: filePath, sourceVideoName: fileName, durationSec: data.duration }).catch(() => null)
    } else {
      console.warn('[OverlayStudio] Transcript import failed:', res?.error)
      dispatch({ type: 'SET_STAGE', stage: 'transcript' })
    }
    return
  }

  // Video/audio — create session linked to the episode
  const session: StudioSession = {
    id: uid(), name: fileName, episodeId,
    sourceVideoPath: filePath, sourceVideoName: fileName,
    status: 'transcribing', missingSource: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  dispatch({ type: 'CREATE_SESSION', session })
  await overlayApi()?.overlaySessionCreate?.({ episodeId, name: fileName, sourceVideoPath: filePath, sourceVideoName: fileName }).catch(() => null)

  if (api?.overlayStudioTranscribe) {
    api.overlayStudioTranscribe({ filePath }).then((result: any) => {
      if (result?.ok && result.transcript) {
        dispatch({ type: 'SET_TRANSCRIPT', sessionId: session.id, transcript: result.transcript })
      } else {
        console.warn('[OverlayStudio] Auto-transcription failed:', result?.error)
        dispatch({ type: 'REMOVE_SESSION', sessionId: session.id })
        dispatch({ type: 'SET_STAGE', stage: 'transcript' })
      }
    }).catch((err: any) => {
      console.warn('[OverlayStudio] Transcription error:', err)
      dispatch({ type: 'REMOVE_SESSION', sessionId: session.id })
      dispatch({ type: 'SET_STAGE', stage: 'transcript' })
    })
  } else {
    dispatch({ type: 'SET_STAGE', stage: 'transcript' })
  }
}

function StudioPageInner() {
  const { dispatch } = useStudio()
  const [mode, setMode] = useState<'studio' | 'engine' | 'presentation'>('studio')

  // Set the dispatch ref for the file-level handleImport
  useEffect(() => { dispatchRef.current = dispatch }, [dispatch])

  // Subscribe to the Content Engine → Overlay Studio handoff bus. When AssembleView
  // emits a handoff, switch into Studio mode and link the episode as a session.
  useEffect(() => {
    const unsub = studioHandoff.subscribe((payload) => {
      dispatch({ type: 'LINK_EPISODE', payload })
      setMode('studio')
    })
    return unsub
  }, [dispatch])

  // Load sessions from backend on mount (overlay sessions always belong to episodes)
  useEffect(() => {
    dispatch({ type: 'LOAD_SESSIONS_START' })
    const load = async () => {
      try {
        const sessions = await overlayApi()?.overlaySessionList?.() ?? []
        dispatch({ type: 'LOAD_SESSIONS_SUCCESS', sessions: Array.isArray(sessions) ? sessions : [] })
      } catch {
        // Fallback to localStorage
        try {
          const raw = localStorage.getItem('rheo-overlay-studio-sessions')
          const sessions = raw ? JSON.parse(raw) : []
          dispatch({ type: 'LOAD_SESSIONS_SUCCESS', sessions })
        } catch {
          dispatch({ type: 'LOAD_SESSIONS_ERROR', error: 'Failed to load sessions' })
        }
      }
    }
    load()
  }, [dispatch])

  return (
    <div className="flex flex-col h-full" data-page="studio">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(63,63,70,0.50)] bg-[rgba(24,24,27,0.60)] backdrop-blur-sm shrink-0 min-h-[44px]">
        <div className="w-6 h-6 rounded-md bg-[#ec4899]/15 flex items-center justify-center"><Sparkles size={12} className="text-[#ec4899]" /></div>
        <span className="text-xs font-semibold text-zinc-200">{mode === 'studio' ? 'Overlay Studio' : mode === 'engine' ? 'Content Engine' : 'Presentations'}</span>
        <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-0.5">
          <button onClick={() => setMode('studio')} className={mode === 'studio' ? 'h-6 rounded-full bg-[#ec4899]/15 px-2.5 text-[10px] font-semibold text-[#ec4899]' : 'h-6 rounded-full px-2.5 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300'}>Overlay Studio</button>
          <button onClick={() => setMode('engine')} className={mode === 'engine' ? 'h-6 rounded-full bg-[#f5c518]/15 px-2.5 text-[10px] font-semibold text-[#f5c518]' : 'h-6 rounded-full px-2.5 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300'}>Content Engine</button>
          <button onClick={() => setMode('presentation')} className={mode === 'presentation' ? 'h-6 rounded-full bg-[#10b981]/15 px-2.5 text-[10px] font-semibold text-[#10b981] flex items-center gap-1' : 'h-6 rounded-full px-2.5 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300 flex items-center gap-1'}><Presentation size={10} /> Presentations</button>
        </div>
        <span className="text-[9px] text-zinc-500">— {mode === 'studio' ? 'Video Overlay Studio (episode-linked)' : mode === 'engine' ? 'Content Creation Pipeline' : 'Interactive HTML Slide Generator'}</span>
      </div>
      <div className="flex-1 min-h-0">
        {mode === 'engine' ? <ContentEngineWorkspace /> : mode === 'presentation' ? <PresentationWorkspace /> : <StudioShell />}
      </div>
    </div>
  )
}

export function FeatureStudioPage() {
  return (
    <StudioProvider handleImport={handleImport}>
      <StudioPageInner />
    </StudioProvider>
  )
}

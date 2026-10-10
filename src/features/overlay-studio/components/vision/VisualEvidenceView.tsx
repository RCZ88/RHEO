import React, { useState, useCallback, useRef } from 'react'
import { useStudio } from '../../state/StudioProvider'
import { Camera, Film, Plus, Trash2, Eye, AlertTriangle, Check, MousePointer } from 'lucide-react'
import { motion } from 'framer-motion'

type MarkType = 'face' | 'text' | 'object'
interface ManualMark {
  id: string
  type: MarkType
  label: string
  box: { x: number; y: number; w: number; h: number }
  frameIndex: number
}

interface CapturedFrame {
  id: string
  timestampSec: number
  dataUrl: string
  marks: ManualMark[]
}

export function VisualEvidenceView() {
  const { state, dispatch, activeSession } = useStudio()
  const [frames, setFrames] = useState<CapturedFrame[]>([])
  const [selectedFrame, setSelectedFrame] = useState<CapturedFrame | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [markMode, setMarkMode] = useState<MarkType | null>(null)
  const [markLabel, setMarkLabel] = useState('')
  const [showFilmstrip, setShowFilmstrip] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const captureFrame = useCallback(async () => {
    if (!activeSession?.sourceVideoPath) return
    setCapturing(true)
    try {
      // Use browser-based frame capture via hidden video element
      const video = document.createElement('video')
      video.src = activeSession.sourceVideoPath
      video.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve()
        video.onerror = () => reject(new Error('Video not playable'))
        setTimeout(() => reject(new Error('Timeout')), 5000)
      })
      video.currentTime = state.playback.currentTime
      await new Promise(r => setTimeout(r, 200))

      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)

      const newFrame: CapturedFrame = {
        id: `frame-${Date.now()}`,
        timestampSec: state.playback.currentTime,
        dataUrl,
        marks: [],
      }
      setFrames(prev => [...prev, newFrame])
      setSelectedFrame(newFrame)
    } catch (e: any) {
      console.warn('[VisualEvidence] Frame capture failed:', e?.message)
    } finally {
      setCapturing(false)
    }
  }, [activeSession?.sourceVideoPath, state.playback.currentTime])

  const addMark = useCallback((frameId: string, box: { x: number; y: number; w: number; h: number }) => {
    if (!markMode || !markLabel.trim()) return
    const newMark: ManualMark = {
      id: `mark-${Date.now()}`,
      type: markMode,
      label: markLabel.trim(),
      box,
      frameIndex: frames.findIndex(f => f.id === frameId),
    }
    setFrames(prev => prev.map(f => f.id === frameId ? { ...f, marks: [...f.marks, newMark] } : f))
    setSelectedFrame(prev => prev?.id === frameId ? { ...prev, marks: [...prev.marks, newMark] } : prev)
    setMarkLabel('')
  }, [markMode, markLabel, frames])

  const removeFrame = (id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id))
    if (selectedFrame?.id === id) setSelectedFrame(null)
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Film size={28} className="mb-3 text-zinc-600" />
        <p className="text-[13px] font-medium text-zinc-400">No session selected</p>
        <p className="text-[11px] text-zinc-500 mt-1">Overlay sessions always belong to an episode. Select one from the sidebar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
        <button onClick={captureFrame} disabled={capturing || !activeSession.sourceVideoPath}
          className="studio-btn-primary inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]">
          <Camera size={12} /> {capturing ? 'Capturing…' : 'Capture Frame'}
        </button>
        <div className="flex items-center gap-1">
          {(['face', 'text', 'object'] as MarkType[]).map(type => (
            <button key={type} onClick={() => setMarkMode(markMode === type ? null : type)}
              className={`studio-btn rounded-lg px-2 py-1 text-[10px] ${markMode === type ? 'bg-[#ec4899]/15 text-[#ec4899]' : 'bg-zinc-800/50 text-zinc-500'}`}>
              {type}
            </button>
          ))}
        </div>
        {markMode && (
          <input value={markLabel} onChange={e => setMarkLabel(e.target.value)} placeholder="Label..."
            className="h-6 rounded-md border border-zinc-700 bg-zinc-900 light:bg-[var(--ws-surface-raised)] px-2 text-[10px] text-zinc-200 outline-none focus:border-[#ec4899]/40" />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">{frames.length} frames</span>
          <button onClick={() => setShowFilmstrip(!showFilmstrip)} className={`studio-btn rounded-lg px-2 py-1 text-[10px] ${showFilmstrip ? 'text-[#22d3ee]' : 'text-zinc-500'}`}>
            <Film size={11} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Frame preview */}
        <div className="flex-1 flex items-center justify-center bg-[#09090b]">
          {selectedFrame ? (
            <div className="relative">
              <img src={selectedFrame.dataUrl} alt={`Frame at ${selectedFrame.timestampSec.toFixed(1)}s`}
                className="max-w-full max-h-[60vh] rounded-lg border border-zinc-700/50" />
              {selectedFrame.marks.map(mark => (
                <div key={mark.id} className="absolute border-2 pointer-events-none"
                  style={{
                    left: `${mark.box.x * 100}%`, top: `${mark.box.y * 100}%`,
                    width: `${mark.box.w * 100}%`, height: `${mark.box.h * 100}%`,
                    borderColor: mark.type === 'face' ? '#f43f5e' : mark.type === 'text' ? '#f59e0b' : '#22d3ee',
                  }}>
                  <span className="absolute -top-4 left-0 text-[8px] font-mono px-1 rounded"
                    style={{ background: mark.type === 'face' ? '#f43f5e' : mark.type === 'text' ? '#f59e0b' : '#22d3ee', color: '#000' }}>
                    {mark.label}
                  </span>
                </div>
              ))}
              <div className="absolute bottom-2 left-2 text-[9px] font-mono text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded">
                {selectedFrame.timestampSec.toFixed(1)}s
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Camera size={28} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-[13px] text-zinc-400">No frame selected</p>
              <p className="text-[11px] text-zinc-500 mt-1">Capture a frame or select one from the filmstrip</p>
            </div>
          )}
        </div>

        {/* Filmstrip */}
        {showFilmstrip && (
          <div className="w-48 border-l border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-auto p-2 space-y-1">
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-2">Filmstrip</div>
            {frames.map(frame => (
              <button key={frame.id} onClick={() => setSelectedFrame(frame)}
                className={`w-full rounded-md border p-1 transition-colors ${selectedFrame?.id === frame.id ? 'border-[#ec4899]/40' : 'border-zinc-700/30 hover:border-zinc-600/50'}`}>
                <img src={frame.dataUrl} alt="" className="w-full h-12 object-cover rounded" />
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[8px] font-mono text-zinc-500">{frame.timestampSec.toFixed(1)}s</span>
                  {frame.marks.length > 0 && <span className="text-[8px] text-[#22d3ee]">{frame.marks.length}</span>}
                </div>
              </button>
            ))}
            {frames.length === 0 && (
              <p className="text-[9px] text-zinc-600 text-center py-4">No frames captured</p>
            )}
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

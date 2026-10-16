import React, { useState } from 'react'
import { useStudio } from '../../state/StudioProvider'
import { Download, FileJson, Check, Copy } from 'lucide-react'
import { BlurFade } from '../ui'

export function ExportView() {
  const { activeSession, dispatch } = useStudio()
  const [copied, setCopied] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'srt' | 'edl'>('json')

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <FileJson size={28} className="mb-3 text-zinc-600" />
        <p className="text-[13px] font-medium text-zinc-400">No session selected</p>
      </div>
    )
  }

  const overlays = activeSession.overlayPlan?.overlays || activeSession.scenePlan?.overlays || []
  const hasOverlays = overlays.length > 0

  const generateExport = () => {
    if (exportFormat === 'json') {
      return JSON.stringify({
        episode_id: activeSession.episodeId,
        session_id: activeSession.id,
        name: activeSession.name,
        source_video: activeSession.sourceVideoPath,
        duration: activeSession.durationSec,
        overlays: overlays,
        caption_track: activeSession.captionTrack,
        exported_at: new Date().toISOString(),
      }, null, 2)
    }
    if (exportFormat === 'srt') {
      const track = activeSession.captionTrack
      if (!track?.lines) return 'No caption track'
      return track.lines.map((l: any, i: number) => {
        const f = (t: number) => {
          const m = Math.floor(t / 60)
          const s = (t % 60).toFixed(2).padStart(5, '0')
          return `${String(m).padStart(2, '0')}:${s.replace('.', ',')}`
        }
        return `${i + 1}\n${f(l.start)} --> ${f(l.end)}\n${l.text}`
      }).join('\n\n')
    }
    // EDL format
    return overlays.map((o: any, i: number) => {
      return `TITLE: Overlay ${i + 1}\nFCM: NON-DROP FRAME\n${i + 1}  AX       V     C        ${formatTimecode(o.start_time)} ${formatTimecode(o.end_time)} ${formatTimecode(o.start_time)} ${formatTimecode(o.end_time)}\n* FROM CLIP NAME: ${o.type || 'card'}\n* COMMENT: ${o.text?.slice(0, 80)}`
    }).join('\n\n')
  }

  const formatTimecode = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const f = Math.floor((sec % 1) * 30)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
  }

  const exportContent = hasOverlays ? generateExport() : ''

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const downloadExport = () => {
    const blob = new Blob([exportContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `overlay-export-${activeSession.episodeId}.${exportFormat === 'json' ? 'json' : exportFormat === 'srt' ? 'srt' : 'edl'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 space-y-4">
      <BlurFade>
        <div>
          <h2 className="text-[13px] font-semibold text-zinc-200">Export</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Export overlay plan for episode #{activeSession.episodeId}</p>
        </div>
      </BlurFade>

      {!hasOverlays ? (
        <BlurFade delay={0.1}>
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-zinc-950 light:bg-[var(--ws-surface-30)] p-8 text-center">
            <FileJson size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-[13px] font-medium text-zinc-400">Nothing to export yet</p>
            <p className="text-[11px] text-zinc-500 mt-1">Generate an overlay plan first.</p>
          </div>
        </BlurFade>
      ) : (
        <>
          <BlurFade delay={0.1}>
            <div className="flex items-center gap-2">
              {(['json', 'srt', 'edl'] as const).map(fmt => (
                <button key={fmt} onClick={() => setExportFormat(fmt)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] transition-colors ${exportFormat === fmt ? 'bg-white/[0.08] text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {fmt.toUpperCase()}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                <button onClick={copyExport} className="studio-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px]">
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={downloadExport} className="studio-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px]">
                  <Download size={11} /> Download
                </button>
              </div>
            </div>
          </BlurFade>

          <BlurFade delay={0.15}>
            <div className="rounded-xl border border-white/[0.08] bg-zinc-950 light:bg-[var(--ws-surface-60)] p-3 max-h-[60vh] overflow-auto">
              <pre className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono">{exportContent}</pre>
            </div>
          </BlurFade>

          <BlurFade delay={0.2}>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 border-t border-white/[0.06] pt-3">
              <span>{overlays.length} overlays</span>
              <span>·</span>
              <span>{activeSession.captionTrack?.lines?.length || 0} caption lines</span>
              <span>·</span>
              <span>{exportContent.length} chars</span>
            </div>
          </BlurFade>
        </>
      )}
    </div>
  )
}

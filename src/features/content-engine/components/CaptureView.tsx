import { useCallback, useEffect, useState } from 'react'
import { FileVideo, FileAudio, PlayCircle, Trash2, Upload, Wand2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, AmberButton, GhostButton, ConfirmIconButton, EmptyState, ErrorState, LoadingBlock, StatusChip, TextInput, FieldLabel, Spinner, toast } from './ui'
import { SegmentTimeline } from './SegmentTimeline'
import { BulkAIFill } from './BulkAIFill'

const api = () => (window as any).deskflowAPI?.contentEngine

const TAKE_STATUS_COLORS: Record<string, string> = {
  imported: 'border-[#00d4ff]/25 bg-[#00d4ff]/10 text-[#00d4ff]',
  transcribing: 'border-[#f5c518]/25 bg-[#f5c518]/10 text-[#f5c518]',
  transcribed: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  evaluated: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
  failed: 'border-rose-500/25 bg-rose-500/10 text-rose-400',
}

function takeColorClass(status?: string) {
  return TAKE_STATUS_COLORS[status || ''] || 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400'
}

function fmtSec(s?: number | null) {
  if (s == null || !Number.isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface CaptureViewProps {
  episodeId: number
  onPhaseChange: (phase: string) => void
}

export function CaptureView({ episodeId, onPhaseChange }: CaptureViewProps) {
  const [takes, setTakes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Import form
  const [filePath, setFilePath] = useState('')
  const [duration, setDuration] = useState('')
  const [importing, setImporting] = useState(false)

  // Expanded take
  const [expandedTakeId, setExpandedTakeId] = useState<number | null>(null)
  const [segments, setSegments] = useState<any[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(false)

  // Evaluate
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<any>(null)

  const loadTakes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api()?.takesList({ episodeId })
      setTakes(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load takes')
    } finally {
      setLoading(false)
    }
  }, [episodeId])

  useEffect(() => { loadTakes() }, [loadTakes])

  const importTake = async () => {
    if (importing || !filePath.trim()) return
    setImporting(true)
    try {
      const dur = duration ? Number(duration) : undefined
      const res = await api()?.takeImport({ episodeId, filePath: filePath.trim(), duration: dur })
      if (res?.ok) {
        toast(`Take #${res.take_number ?? '?'} imported`)
        setFilePath('')
        setDuration('')
        loadTakes()
      } else {
        toast(res?.error || 'Import failed', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  const transcribe = async (takeId: number) => {
    try {
      const res = await api()?.takeTranscribe({ takeId })
      if (res?.ok) {
        toast('Transcription started')
        loadTakes()
      } else {
        toast(res?.error || 'Transcription failed', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Transcription failed', 'error')
    }
  }

  const deleteTake = async (id: number) => {
    try {
      const res = await api()?.takeDelete(id)
      if (res?.ok) {
        toast('Take deleted')
        if (expandedTakeId === id) setExpandedTakeId(null)
        loadTakes()
      } else {
        toast(res?.error || 'Delete failed', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Delete failed', 'error')
    }
  }

  const expandTake = async (takeId: number) => {
    if (expandedTakeId === takeId) {
      setExpandedTakeId(null)
      return
    }
    setExpandedTakeId(takeId)
    setSegments([])
    setEvaluation(null)
    setSegmentsLoading(true)
    try {
      const segs = await api()?.takeSegments({ takeId })
      setSegments(Array.isArray(segs) ? segs : [])
    } catch (e: any) {
      toast(e?.message || 'Failed to load segments', 'error')
    } finally {
      setSegmentsLoading(false)
    }
  }

  const toggleKeep = async (segId: number, keep: boolean) => {
    setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, keep } : s))
    if (expandedTakeId) {
      try {
        await api()?.takeSelect({ takeId: expandedTakeId, segments: [{ id: segId, keep }] })
      } catch (e: any) {
        toast(e?.message || 'Failed to update segment', 'error')
      }
    }
  }

  const evaluateTake = async (takeId: number) => {
    setEvaluating(true)
    setEvaluation(null)
    try {
      const res = await api()?.takeEvaluate({ takeId })
      if (res?.ok && res.evaluation) {
        setEvaluation(res.evaluation)
        toast(`Evaluation: ${res.evaluation.verdict ?? 'done'}`)
        loadTakes()
      } else {
        toast(res?.error || 'Evaluation failed', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Evaluation failed', 'error')
    } finally {
      setEvaluating(false)
    }
  }

  const advanceToAssemble = async () => {
    try {
      const res = await api()?.episodeSave({ id: episodeId, phase: 'assemble', status: 'assembled' })
      if (res?.ok) {
        toast('Phase advanced to Assemble')
        onPhaseChange('assemble')
      } else {
        toast(res?.error || 'Failed to advance', 'error')
      }
    } catch (e: any) {
      toast(e?.message || 'Failed to advance', 'error')
    }
  }

  const expandedTake = takes.find((t) => t.id === expandedTakeId)

  return (
    <div className="space-y-4">
      {/* Import form */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Upload size={14} className="text-[#f5c518]" />
          <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Import Take</span>
          <BulkAIFill
            fields={[
              { id: 'filePath', label: 'File Path', value: filePath, placeholder: 'C:\\Videos\\episode.mp4' },
              { id: 'duration', label: 'Duration (seconds)', value: duration, placeholder: '120' },
            ]}
            onFill={(updates) => { if (updates.filePath) setFilePath(updates.filePath); if (updates.duration) setDuration(updates.duration); }}
            category="content-engine"
            context="Help fill in video take metadata"
          />
        </div>
        <div className="grid grid-cols-[1fr_100px_auto] items-end gap-3">
          <div>
            <FieldLabel>File path</FieldLabel>
            <TextInput
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="C:\Videos\episode1_take3.mp4"
            />
          </div>
          <div>
            <FieldLabel>Duration (sec)</FieldLabel>
            <TextInput
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="120"
              min={1}
            />
          </div>
          <AmberButton onClick={importTake} disabled={importing || !filePath.trim()}>
            {importing ? <Spinner size={12} /> : <Upload size={13} />}
            {importing ? 'Importing…' : 'Import'}
          </AmberButton>
        </div>
      </Card>

      {/* Loading / Error states */}
      {loading && <LoadingBlock label="Loading takes…" />}
      {error && <ErrorState message={error} onRetry={loadTakes} />}

      {/* Empty state */}
      {!loading && !error && takes.length === 0 && (
        <EmptyState
          icon={<FileVideo size={28} />}
          title="No takes yet"
          hint="Import a video or audio file to start the Capture phase."
        />
      )}

      {/* Take list */}
      {!loading && !error && takes.length > 0 && (
        <div className="space-y-2">
          {takes.map((take) => {
            const expanded = expandedTakeId === take.id
            return (
              <div key={take.id} className="space-y-0">
                {/* Take row */}
                <Card
                  className={cn(
                    'flex cursor-pointer items-center gap-3 p-3.5 transition-colors',
                    expanded ? 'border-[#f5c518]/25' : 'hover:border-white/[0.12]',
                  )}
                  onClick={() => expandTake(take.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                    <FileVideo size={14} className="text-[#00d4ff]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-200">
                        Take #{take.take_number}
                      </span>
                      <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase', takeColorClass(take.status))}>
                        {take.status || 'imported'}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-zinc-500">
                      {take.file_path && (
                        <span className="truncate max-w-[200px]">{take.file_path.split(/[/\\]/).pop()}</span>
                      )}
                      {take.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock size={9} /> {fmtSec(take.duration_seconds)}
                        </span>
                      )}
                      {take.notes && <span className="italic truncate max-w-[120px]">{take.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(take.status === 'imported' || take.status === 'transcribed') && (
                      <GhostButton
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => transcribe(take.id)}
                      >
                        <Wand2 size={11} /> Transcribe
                      </GhostButton>
                    )}
                    {take.status === 'transcribed' && (
                      <GhostButton
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => evaluateTake(take.id)}
                        disabled={evaluating}
                      >
                        {evaluating ? <Spinner size={11} /> : <PlayCircle size={11} />}
                        {evaluating ? '…' : 'Evaluate'}
                      </GhostButton>
                    )}
                    <ConfirmIconButton
                      onConfirm={() => deleteTake(take.id)}
                      icon={<Trash2 size={11} />}
                      label="Delete take"
                    />
                  </div>
                  {expanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                </Card>

                {/* Expanded segment view */}
                {expanded && (
                  <div className="ml-4 mt-1">
                    <SegmentTimeline
                      takeId={take.id}
                      duration={take.duration_seconds ?? 0}
                      segments={segments}
                      loading={segmentsLoading}
                      onToggleKeep={toggleKeep}
                    />

                    {/* Evaluation result */}
                    {evaluation && (
                      <Card className="mt-2 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Blueprint Evaluation</span>
                          <span className={cn(
                            'inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase',
                            evaluation.verdict === 'match'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                              : evaluation.verdict === 'deviation'
                              ? 'border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]'
                              : 'border-rose-500/40 bg-rose-500/10 text-rose-400',
                          )}>
                            {evaluation.verdict ?? 'unknown'}
                          </span>
                        </div>
                        {evaluation.match_score != null && (
                          <div className="mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    evaluation.match_score >= 0.7 ? 'bg-emerald-500' : evaluation.match_score >= 0.4 ? 'bg-[#f5c518]' : 'bg-rose-500',
                                  )}
                                  style={{ width: `${Math.max(0, Math.min(1, evaluation.match_score)) * 100}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-zinc-400">{Math.round(evaluation.match_score * 100)}%</span>
                            </div>
                          </div>
                        )}
                        {Array.isArray(evaluation.deviations) && evaluation.deviations.length > 0 && (
                          <div className="space-y-1">
                            {evaluation.deviations.map((d: string, i: number) => (
                              <div key={i} className="text-[11px] text-zinc-400">· {d}</div>
                            ))}
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Advance to Assemble */}
      {!loading && takes.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <AmberButton onClick={advanceToAssemble}>
            Advance to Assemble
          </AmberButton>
        </div>
      )}
    </div>
  )
}

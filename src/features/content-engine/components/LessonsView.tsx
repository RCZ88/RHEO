import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Card, Chip, EmptyState, ErrorState, LoadingBlock, SectionHeader, toast } from './ui'
import { cn } from '@/lib/utils'
import { BlurFade, BentoCard, StatusChip } from './ui-laminar'

const api = () => (window as any).deskflowAPI?.contentEngine

const LESSON_STATUS = [
  { id: 'active', label: 'Active' },
  { id: 'applied', label: 'Applied' },
  { id: 'dismissed', label: 'Dismissed' },
]

export function LessonsView() {
  const [lessons, setLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try { const list = await api()?.lessonsList(); setLessons(Array.isArray(list) ? list : []) }
    catch (e: any) { setError(e?.message || 'Failed to load lessons.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const setStatus = async (lesson: any, status: string) => {
    try { const res = await api()?.lessonSave({ ...lesson, status }); if (res?.ok) { toast(`Lesson marked ${status}`); load() } else toast(res?.error || 'Failed to update lesson', 'error') }
    catch (e: any) { toast(e?.message || 'Failed to update lesson', 'error') }
  }

  const setConfidence = async (lesson: any, confidence: number) => {
    try { await api()?.lessonSave({ ...lesson, confidence }); load() }
    catch (e: any) { toast(e?.message || 'Failed to update confidence', 'error') }
  }

  return (
    <section className="space-y-6 p-6">
      <SectionHeader label="Content Engine / 06" title="Lessons" icon={<GraduationCap size={14} className="text-white/70" />}
        action={<Chip className="border-amber-500/25 bg-amber-500/10 text-amber-400">Extracted from your videos</Chip>}
      />

      {loading && <LoadingBlock label="Loading lessons…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && lessons.length === 0 && (
        <EmptyState icon={<GraduationCap size={28} />} title="No lessons extracted yet" hint="Open a video in Analytics and hit Extract Lessons — proven patterns get saved here for future scripts." />
      )}

      {!loading && !error && lessons.length > 0 && (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <BentoCard key={lesson.id ?? lesson.lesson} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">{lesson.lesson}</div>
                  {lesson.applies_to && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[lesson.applies_to].flat().map((a: string, i: number) => (
                        <Chip key={i} className="border-cyan-500/25 bg-cyan-500/10 text-cyan-400">{a}</Chip>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] tracking-wider text-zinc-500 uppercase">Confidence</span>
                    <span className="font-mono text-[10px] text-zinc-400">{lesson.confidence != null ? `${Math.round(lesson.confidence * 100)}%` : '—'}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05} value={lesson.confidence ?? 0.5} onChange={(e) => setConfidence(lesson, Number(e.target.value))} className="h-1 w-28 cursor-pointer" />
                </div>
              </div>

              {Array.isArray(lesson.evidence) && lesson.evidence.length > 0 && (
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                  <div className="mb-1 text-[9px] tracking-wider text-zinc-500 uppercase">Evidence</div>
                  <ul className="space-y-1">
                    {lesson.evidence.slice(0, 4).map((ev: any, i: number) => (
                      <li key={i} className="text-[11px] text-zinc-400">{typeof ev === 'string' ? ev : String(ev?.observation ?? ev?.evidence ?? JSON.stringify(ev))}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-1.5 border-t border-white/[0.08] pt-2.5">
                {LESSON_STATUS.map((s) => (
                  <button key={s.id} onClick={() => setStatus(lesson, s.id)}
                    className={cn('inline-flex h-6 items-center rounded-md px-2 text-[10px] font-semibold tracking-wide uppercase transition-colors',
                      (lesson.status || 'active') === s.id ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300')}>
                    {s.label}
                  </button>
                ))}
              </div>
            </BentoCard>
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-500">Active lessons will be injected into future script prompts as proven retention rules.</p>
    </section>
  )
}

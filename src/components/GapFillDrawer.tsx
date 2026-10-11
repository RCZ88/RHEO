import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, ExternalLink, Monitor, Plus, Sparkles, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import type { ConfirmFill, Gap } from '../types/gaps'

const DRAWER_HEIGHT = 'max-h-[80%]'
const MIN_SEGMENT_SECONDS = 60

const periods = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All' },
] as const

type Period = (typeof periods)[number]['key']

interface PickableActivity {
  id: string
  name: string
  category: string
  color: string
  type: 'app' | 'external'
}

interface GapSegment {
  id: number
  activityId: string | null
  activityName: string
  category: string
  durationSeconds: number
}

interface GapState {
  gap: Gap
  segments: GapSegment[]
  expanded: boolean
}

const drawerVariants = { hidden: { y: '100%' }, visible: { y: 0 } }
const drawerSpring = { type: 'spring', duration: 0.4, bounce: 0.25 }
const fade0 = { opacity: 0 }
const fade1 = { opacity: 1 }

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${day} ${date} · ${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function fmtMin(s: number): string {
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r > 0 ? `${h}h ${r}m` : `${h}h`
}

function fmtElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

const api = () => (window as unknown as { deskflowAPI: Record<string, any> }).deskflowAPI

export function GapFillDrawer({
  open,
  onClose,
  onFilled,
}: {
  open: boolean
  onClose: () => void
  onFilled?: () => void
}) {
  const [period, setPeriod] = useState<Period>('week')
  const [gaps, setGaps] = useState<Gap[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gapStates, setGapStates] = useState<GapState[]>([])
  const [knownApps, setKnownApps] = useState<PickableActivity[]>([])
  const [externalActivities, setExternalActivities] = useState<PickableActivity[]>([])
  const [busy, setBusy] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [pickingFor, setPickingFor] = useState<{ gapId: number; segId: number } | null>(null)
  const segCounter = useRef(1)

  const fetchGaps = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      const list: Gap[] = await api().detectUsageGaps({ period: p, minGapMinutes: 5 })
      const arr = Array.isArray(list) ? list : []
      setGaps(arr)
      setGapStates(arr.map((g) => ({
        gap: g,
        segments: [{ id: segCounter.current++, activityId: null, activityName: '', category: '', durationSeconds: g.durationSeconds }],
        expanded: false,
      })))
    } catch {
      setError('Could not load gaps')
      setGaps([])
      setGapStates([])
    }
    setLoading(false)
  }, [])

  const fetchActivities = useCallback(async () => {
    try {
      const [apps, ext] = await Promise.all([
        api().getKnownApps().then((r: any[]) => r || []),
        api().getExternalActivities().then((r: any[]) => r || []),
      ])
      setKnownApps(apps.map((a: any) => ({
        id: 'app:' + a.app,
        name: a.app,
        category: a.category || 'Other',
        color: '#6366f1',
        type: 'app' as const,
      })))
      setExternalActivities(ext.filter((a: any) => a.name !== 'AFK' && a.type !== 'sleep').map((a: any) => ({
        id: 'ext:' + a.id,
        name: a.name,
        category: 'External',
        color: a.color || '#6b7280',
        type: 'external' as const,
      })))
    } catch {
      /* non-critical */
    }
  }, [])

  const allActivities = useCallback(() => {
    return [...knownApps, ...externalActivities]
  }, [knownApps, externalActivities])

  const autofillGap = useCallback(async (gapIdx: number) => {
    const gs = gapStates[gapIdx]
    if (!gs) return
    setAutoFilling(true)
    try {
      const result = await api().predictGapFill(gs.gap.start, gs.gap.end, 'combined')
      if (result?.gaps?.[0]?.slots) {
        const slots = result.gaps[0].slots
        const acts = allActivities()
        const segments: GapSegment[] = slots.map((slot: any, si: number) => {
          const top = slot.predictions?.[0]
          const act = top ? acts.find(a => a.name === top.app) : null
          return {
            id: segCounter.current + si,
            activityId: act?.id || null,
            activityName: act?.name || top?.app || '',
            category: act?.category || top?.category || '',
            durationSeconds: slot.durationSeconds,
          }
        })
        segCounter.current += slots.length
        setGapStates(prev => prev.map((g, i) => i === gapIdx ? { ...g, segments, expanded: true } : g))
      }
    } catch {
      setError('Prediction failed')
    }
    setAutoFilling(false)
  }, [gapStates, allActivities])

  const autofillAll = useCallback(async () => {
    setAutoFilling(true)
    try {
      const acts = allActivities()
      const newStates = await Promise.all(gapStates.map(async (gs, idx) => {
        try {
          const result = await api().predictGapFill(gs.gap.start, gs.gap.end, 'combined')
          if (result?.gaps?.[0]?.slots) {
            const slots = result.gaps[0].slots
            const segments: GapSegment[] = slots.map((slot: any) => {
              const top = slot.predictions?.[0]
              const act = top ? acts.find(a => a.name === top.app) : null
              return {
                id: segCounter.current++,
                activityId: act?.id || null,
                activityName: act?.name || top?.app || '',
                category: act?.category || top?.category || '',
                durationSeconds: slot.durationSeconds,
              }
            })
            return { ...gs, segments, expanded: true }
          }
        } catch { /* skip */ }
        return gs
      }))
      setGapStates(newStates)
    } catch {
      setError('Prediction failed')
    }
    setAutoFilling(false)
  }, [gapStates, allActivities])

  useEffect(() => {
    if (!open) return
    fetchGaps(period)
    fetchActivities()
  }, [open, period, fetchGaps, fetchActivities])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setPickingFor(null)
  }, [open])

  const getActivity = useCallback((id: string | null): PickableActivity | undefined => {
    if (!id) return undefined
    return allActivities().find((a) => a.id === id)
  }, [allActivities])

  const toggleExpand = useCallback((idx: number) => {
    setGapStates((prev) => prev.map((gs, i) => i === idx ? { ...gs, expanded: !gs.expanded } : gs))
    setPickingFor(null)
  }, [])

  const redistributeEven = useCallback((total: number, count: number): number[] => {
    if (count === 0) return []
    const per = Math.floor(total / count)
    const rem = total - per * count
    return Array.from({ length: count }, (_, i) => per + (i === count - 1 ? rem : 0))
  }, [])

  const addSegment = useCallback((gapIdx: number) => {
    segCounter.current += 1
    setGapStates((prev) => prev.map((gs, i) => {
      if (i !== gapIdx) return gs
      const counts = redistributeEven(gs.gap.durationSeconds, gs.segments.length + 1)
      return {
        ...gs,
        segments: [...gs.segments, { id: segCounter.current, activityId: null, activityName: '', category: '', durationSeconds: 0 }]
          .map((s, si) => ({ ...s, durationSeconds: counts[si] })),
      }
    }))
  }, [redistributeEven])

  const removeSegment = useCallback((gapIdx: number, segId: number) => {
    setGapStates((prev) => prev.map((gs, i) => {
      if (i !== gapIdx) return gs
      const filtered = gs.segments.filter((s) => s.id !== segId)
      if (filtered.length === 0) return gs
      const counts = redistributeEven(gs.gap.durationSeconds, filtered.length)
      return { ...gs, segments: filtered.map((s, si) => ({ ...s, durationSeconds: counts[si] })) }
    }))
    setPickingFor((prev) => prev?.segId === segId ? null : prev)
  }, [redistributeEven])

  const reorderSegment = useCallback((gapIdx: number, fromIdx: number, toIdx: number) => {
    setGapStates((prev) => prev.map((gs, i) => {
      if (i !== gapIdx) return gs
      const segs = [...gs.segments]
      const [moved] = segs.splice(fromIdx, 1)
      segs.splice(toIdx, 0, moved)
      return { ...gs, segments: segs }
    }))
  }, [])

  const clearAllActivities = useCallback((gapIdx: number) => {
    setGapStates((prev) => prev.map((gs, i) => {
      if (i !== gapIdx) return gs
      return {
        ...gs,
        segments: gs.segments.map((s) => ({ ...s, activityId: null, activityName: '', category: '' })),
      }
    }))
    setPickingFor(null)
  }, [])

  const setSegmentDuration = useCallback((gapIdx: number, segId: number, newSeconds: number) => {
    setGapStates((prev) => prev.map((gs, i) => {
      if (i !== gapIdx) return gs
      const segments = gs.segments
      const otherCount = segments.length - 1
      if (otherCount === 0) {
        return { ...gs, segments: segments.map((s) => s.id === segId ? { ...s, durationSeconds: Math.max(MIN_SEGMENT_SECONDS, Math.round(newSeconds)) } : s) }
      }
      const maxAllowed = gs.gap.durationSeconds - otherCount * MIN_SEGMENT_SECONDS
      const clamped = Math.max(MIN_SEGMENT_SECONDS, Math.min(maxAllowed, Math.round(newSeconds)))
      const remaining = gs.gap.durationSeconds - clamped
      const perOther = Math.floor(remaining / otherCount)
      const remainder = remaining - perOther * otherCount
      let remainderAssigned = false
      return {
        ...gs,
        segments: segments.map((s) => {
          if (s.id === segId) return { ...s, durationSeconds: clamped }
          if (!remainderAssigned) {
            remainderAssigned = true
            return { ...s, durationSeconds: perOther + remainder }
          }
          return { ...s, durationSeconds: perOther }
        }),
      }
    }))
  }, [])

  const pickActivity = useCallback((gapIdx: number, segId: number, activity: PickableActivity) => {
    setGapStates((prev) => prev.map((gs, i) => {
      if (i !== gapIdx) return gs
      return {
        ...gs,
        segments: gs.segments.map((s) => s.id === segId ? {
          ...s,
          activityId: activity.id,
          activityName: activity.name,
          category: activity.category,
        } : s),
      }
    }))
    setPickingFor(null)
  }, [])

  const onDividerMouseDown = useCallback((gapIdx: number, segIdx: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const bar = document.getElementById('gap-timeline-bar-' + gapIdx)
    if (!bar) return
    const gapState = gapStates[gapIdx]
    if (!gapState) return
    const totalSec = gapState.gap.durationSeconds

    function onMouseMove(ev: MouseEvent) {
      const rect = bar.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      setGapStates((prev) => {
        const gs = prev[gapIdx]
        if (!gs || segIdx >= gs.segments.length - 1) return prev
        const sumPrev = gs.segments.slice(0, segIdx).reduce((s, seg) => s + seg.durationSeconds, 0)
        const pairTotal = gs.segments[segIdx].durationSeconds + gs.segments[segIdx + 1].durationSeconds
        const midRaw = Math.round(pct * totalSec - sumPrev)
        const clamped = Math.max(MIN_SEGMENT_SECONDS, Math.min(pairTotal - MIN_SEGMENT_SECONDS, midRaw))
        return prev.map((gs2, i) => {
          if (i !== gapIdx) return gs2
          return {
            ...gs2,
            segments: gs2.segments.map((s, si) => {
              if (si === segIdx) return { ...s, durationSeconds: clamped }
              if (si === segIdx + 1) return { ...s, durationSeconds: pairTotal - clamped }
              return s
            }),
          }
        })
      })
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [gapStates])

  const acceptAll = async () => {
    const fills: ConfirmFill[] = []
    for (const gs of gapStates) {
      let cursor = new Date(gs.gap.start).getTime()
      for (const seg of gs.segments) {
        if (!seg.activityId) continue
        const segEnd = new Date(cursor + seg.durationSeconds * 1000)
        fills.push({
          slotStart: new Date(cursor).toISOString(),
          slotEnd: segEnd.toISOString(),
          app: seg.activityName,
          category: seg.category,
          activityId: seg.activityId,
        })
        cursor = segEnd.getTime()
      }
    }
    if (!fills.length) return

    setBusy(true)
    try {
      await api().confirmGapFill(fills)
      onFilled?.()
      fetchGaps(period)
    } catch {
      setError('Could not save fills')
    }
    setBusy(false)
  }

  const filledCount = gapStates.reduce((sum, gs) => sum + gs.segments.filter((s) => s.activityId).length, 0)
  const totalSegments = gapStates.reduce((sum, gs) => sum + gs.segments.length, 0)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={drawerVariants}
          initial='hidden'
          animate='visible'
          exit='hidden'
          transition={drawerSpring}
          role='dialog'
          aria-label='Gap Fill'
          className={'absolute inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-zinc-700/50 bg-zinc-900/95 shadow-2xl backdrop-blur ' + DRAWER_HEIGHT}
        >
          <div className='h-[2px] w-full shrink-0 bg-gradient-to-r from-indigo-500/40 via-emerald-500/40 to-indigo-500/40' />

          {/* Header */}
          <div className='flex items-center justify-between px-4 py-3 shrink-0'>
            <div className='flex items-center gap-2'>
              <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20'>
                <Clock className='h-4 w-4 text-indigo-300' />
              </div>
              <div>
                <div className='text-sm font-medium text-zinc-100'>Fill Time Gaps</div>
                <div className='text-xs text-zinc-500'>
                  {gapStates.length} gap{gapStates.length === 1 ? '' : 's'} found
                </div>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              {gapStates.length > 0 && (
                <button
                  onClick={autofillAll}
                  disabled={autoFilling}
                  className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition disabled:opacity-50'
                >
                  <Sparkles className={`h-3.5 w-3.5 ${autoFilling ? 'animate-pulse' : ''}`} />
                  {autoFilling ? 'Predicting...' : 'Auto-fill all'}
                </button>
              )}
              <button onClick={onClose} aria-label='Close' className='rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors'>
                <X className='h-4 w-4' />
              </button>
            </div>
          </div>

          {/* Period selector */}
          <div className='flex gap-1 px-4 pb-3 shrink-0'>
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ' +
                  (period === p.key
                    ? 'bg-zinc-700 text-zinc-200 shadow-sm border border-zinc-600/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50')
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Data requirement notice for out-of-field gaps */}
          {period === 'all' && (
            <div className='px-4 pb-3 shrink-0'>
              <div className='rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2'>
                <p className='text-[11px] text-amber-300/80'>
                  <span className='font-medium'>Out-of-field accuracy:</span> At least 1 month of tracking data is recommended for reliable gap predictions.
                </p>
              </div>
            </div>
          )}

          {/* Scrollable gap list */}
          <div className='flex-1 overflow-y-auto px-4 pb-4'>
            {loading && <LoadingSkeleton />}
            {error && <ErrorRow message={error} onRetry={() => fetchGaps(period)} />}
            {!loading && !error && gapStates.length === 0 && <AllAccounted />}

            {!loading && !error && gapStates.map((gs, gi) => (
              <div key={gs.gap.start} className='mb-2 rounded-xl border border-zinc-700/20 bg-zinc-800/30 overflow-hidden'>
                {/* Gap header */}
                <button
                  onClick={() => toggleExpand(gi)}
                  className='flex w-full items-center justify-between px-3 py-2.5 text-left'
                >
                  <span className='flex items-center gap-2'>
                    <Clock className='h-3.5 w-3.5 text-zinc-500' />
                    <span className='font-mono text-xs text-zinc-300'>
                      {fmtTime(new Date(gs.gap.start).getTime())}–{fmtTime(new Date(gs.gap.end).getTime())}
                    </span>
                    <span className='text-xs text-zinc-500'>{fmtMin(gs.gap.durationSeconds)} untracked</span>
                  </span>
                  <div className='flex items-center gap-2'>
                    {gs.segments.filter((s) => s.activityId).length > 0 && (
                      <span className='rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300'>
                        {gs.segments.filter((s) => s.activityId).length}
                      </span>
                    )}
                    {gs.segments.some((s) => s.activityId) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (window.confirm('Clear all activity selections for this gap?')) clearAllActivities(gi); }}
                        className='p-1 rounded-md text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition'
                        title='Clear all selections'
                      >
                        <svg className='h-3.5 w-3.5' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14'/></svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); autofillGap(gi); }}
                      disabled={autoFilling}
                      className='p-1 rounded-md text-zinc-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition disabled:opacity-50'
                      title='Auto-fill this gap'
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${autoFilling ? 'animate-pulse' : ''}`} />
                    </button>
                    <ChevronDown className={'h-4 w-4 text-zinc-500 transition-transform ' + (gs.expanded ? 'rotate-180' : '')} />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {gs.expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className='overflow-hidden'>
                      <div className='px-3 pb-3 space-y-3'>
                        {/* Timeline bar */}
                        <div
                          id={'gap-timeline-bar-' + gi}
                          className='flex h-7 rounded-lg overflow-hidden bg-zinc-800 select-none'
                        >
                          {gs.segments.flatMap((seg, si) => {
                            const act = getActivity(seg.activityId)
                            const pct = gs.gap.durationSeconds > 0 ? (seg.durationSeconds / gs.gap.durationSeconds) : 0
                            const elems = [
                              <div
                                key={seg.id}
                                className='h-full flex items-center justify-center text-[10px] font-medium text-white/80 truncate px-1 transition-colors'
                                style={{ flex: `${pct} 1 0%`, backgroundColor: act?.color || seg.activityId ? (act?.color || '#6366f1') : '#52525b' }}
                              >
                                <span className='truncate'>{pct > 0.1 ? fmtElapsed(seg.durationSeconds) : ''}</span>
                              </div>,
                            ]
                            if (si < gs.segments.length - 1) {
                              elems.push(
                                <div
                                  key={`d${seg.id}`}
                                  className='w-[7px] cursor-col-resize shrink-0 flex items-center justify-center hover:bg-white/[0.07] active:bg-white/[0.12] transition-colors'
                                  onMouseDown={(e) => onDividerMouseDown(gi, si, e)}
                                >
                                  <div className='w-px h-4 rounded-full bg-white/25 pointer-events-none' />
                                </div>,
                              )
                            }
                            return elems
                          })}
                        </div>

                        {/* Edge times */}
                        <div className='relative text-[10px] text-zinc-500 h-3'>
                          {(() => {
                            const total = gs.gap.durationSeconds
                            const gapStart = new Date(gs.gap.start).getTime()
                            const edges: { time: string; pct: number }[] = []
                            edges.push({ time: fmtTime(gapStart), pct: 0 })
                            let cum = 0
                            for (let i = 0; i < gs.segments.length - 1; i++) {
                              cum += gs.segments[i].durationSeconds
                              edges.push({ time: fmtTime(gapStart + cum * 1000), pct: total > 0 ? (cum / total) * 100 : 0 })
                            }
                            edges.push({ time: fmtTime(new Date(gs.gap.end).getTime()), pct: 100 })
                            return edges.map((e, i) => (
                              <span
                                key={i}
                                className={`absolute ${i === 0 ? 'text-left' : i === edges.length - 1 ? 'text-right' : 'text-center'}`}
                                style={{ left: `${e.pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                              >
                                {e.time}
                              </span>
                            ))
                          })()}
                        </div>

                        {/* Segments */}
                        <div className='space-y-2'>
                          {gs.segments.map((seg, segIdx) => {
                            const act = getActivity(seg.activityId)
                            const isPicking = pickingFor?.gapId === gi && pickingFor?.segId === seg.id
                            return (
                              <div
                                key={seg.id}
                                draggable
                                onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(segIdx)); e.dataTransfer.effectAllowed = 'move' }}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                                onDrop={(e) => { e.preventDefault(); const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(fromIdx) && fromIdx !== segIdx) reorderSegment(gi, fromIdx, segIdx) }}
                              >
                                <div className='flex items-center gap-1.5 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/30 cursor-grab active:cursor-grabbing'>
                                  {/* Drag handle + up/down */}
                                  <div className='flex flex-col items-center shrink-0'>
                                    <GripVertical className='w-3 h-3 text-zinc-600' />
                                    <div className='flex flex-col -space-y-0.5'>
                                      <button
                                        onClick={() => { if (segIdx > 0) reorderSegment(gi, segIdx, segIdx - 1) }}
                                        disabled={segIdx === 0}
                                        className='p-0.5 rounded hover:bg-zinc-600/50 text-zinc-500 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition'
                                        title='Move up'
                                      >
                                        <ChevronUp className='w-3 h-3' />
                                      </button>
                                      <button
                                        onClick={() => { if (segIdx < gs.segments.length - 1) reorderSegment(gi, segIdx, segIdx + 1) }}
                                        disabled={segIdx === gs.segments.length - 1}
                                        className='p-0.5 rounded hover:bg-zinc-600/50 text-zinc-500 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition'
                                        title='Move down'
                                      >
                                        <ChevronDown className='w-3 h-3' />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Duration control */}
                                  <div className='flex items-center gap-1 w-[5rem] shrink-0'>
                                    <button
                                      onClick={() => setSegmentDuration(gi, seg.id, seg.durationSeconds - 60)}
                                      className='p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition'
                                    >
                                      <svg className='w-3 h-3' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><line x1='5' y1='12' x2='19' y2='12'/></svg>
                                    </button>
                                    <input
                                      type='number'
                                      min={1}
                                      max={Math.floor(gs.gap.durationSeconds / 60)}
                                      value={Math.round(seg.durationSeconds / 60)}
                                      onChange={(e) => {
                                        const mins = parseInt(e.target.value) || 1
                                        setSegmentDuration(gi, seg.id, mins * 60)
                                      }}
                                      className='w-12 text-center text-[11px] text-zinc-400 font-mono tabular-nums bg-transparent border border-zinc-700/30 rounded px-1 py-0.5 focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                                    />
                                    <span className='text-[10px] text-zinc-600 w-5'>min</span>
                                    <button
                                      onClick={() => setSegmentDuration(gi, seg.id, seg.durationSeconds + 60)}
                                      className='p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition'
                                    >
                                      <Plus className='w-3 h-3' />
                                    </button>
                                  </div>

                                  {/* Activity picker button */}
                                  <button
                                    onClick={() => setPickingFor(isPicking ? null : { gapId: gi, segId: seg.id })}
                                    className='flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700/60 transition text-left'
                                  >
                                    <div className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: act?.color || '#52525b' }} />
                                    <span className={`text-xs ${act ? 'text-zinc-200' : 'text-zinc-500 italic'}`}>
                                      {act ? act.name : 'Choose activity'}
                                    </span>
                                    {seg.category && act && (
                                      <span className='ml-auto rounded-full bg-zinc-700/40 px-1.5 py-0.5 text-[10px] text-zinc-400'>
                                        {seg.category}
                                      </span>
                                    )}
                                  </button>

                                  {gs.segments.length > 1 && (
                                    <button onClick={() => removeSegment(gi, seg.id)} className='p-1 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition shrink-0'>
                                      <X className='w-3.5 h-3.5' />
                                    </button>
                                  )}
                                </div>

                                {/* Inline activity picker */}
                                {isPicking && (
                                  <ActivityPickerGrid
                                    knownApps={knownApps}
                                    externalActivities={externalActivities}
                                    currentId={seg.activityId}
                                    onPick={(act) => pickActivity(gi, seg.id, act)}
                                    onClose={() => setPickingFor(null)}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Add segment */}
                        <button
                          onClick={() => addSegment(gi)}
                          className='w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition border border-dashed border-zinc-700/40'
                        >
                          <Plus className='w-3.5 h-3.5' />
                          <span>Split time</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          {!loading && !error && gapStates.length > 0 && (
            <div className='shrink-0 border-t border-zinc-800/60 px-4 py-3'>
              <button
                onClick={acceptAll}
                disabled={filledCount === 0 || busy}
                className='w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-medium text-white hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all'
              >
                {busy ? 'Saving…' : (
                  <span className='flex items-center justify-center gap-2'>
                    <Check className='w-4 h-4' />
                    Fill {filledCount} {filledCount === 1 ? 'segment' : 'segments'}
                  </span>
                )}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ActivityPickerGrid({
  knownApps,
  externalActivities,
  currentId,
  onPick,
  onClose,
}: {
  knownApps: PickableActivity[]
  externalActivities: PickableActivity[]
  currentId: string | null
  onPick: (act: PickableActivity) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const lq = query.toLowerCase()

  const filteredApps = knownApps.filter((a) => a.name.toLowerCase().includes(lq))
  const filteredExt = externalActivities.filter((a) => a.name.toLowerCase().includes(lq))

  return (
    <motion.div
      initial={fade0}
      animate={fade1}
      exit={fade0}
      className='mt-1.5 ml-14 pl-3 border-l-2 border-zinc-700/40'
    >
      <div className='p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/30'>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search activities…'
          className='w-full rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 mb-2'
          autoFocus
        />

        {filteredExt.length > 0 && (
          <>
            <div className='flex items-center gap-1.5 mb-1 px-1'>
              <ExternalLink className='w-3 h-3 text-amber-400' />
              <span className='text-[10px] font-medium text-zinc-500 uppercase tracking-wider'>Activities</span>
            </div>
            <div className='grid grid-cols-2 gap-1 mb-2'>
              {filteredExt.map((act) => (
                <button
                  key={act.id}
                  onClick={() => onPick(act)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition text-xs ${
                    currentId === act.id
                      ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30'
                      : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: act.color }} />
                  <span className='truncate'>{act.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {filteredApps.length > 0 && (
          <>
            <div className='flex items-center gap-1.5 mb-1 px-1'>
              <Monitor className='w-3 h-3 text-indigo-400' />
              <span className='text-[10px] font-medium text-zinc-500 uppercase tracking-wider'>Tracked Apps</span>
            </div>
            <div className='grid grid-cols-2 gap-1 max-h-40 overflow-y-auto'>
              {filteredApps.map((act) => (
                <button
                  key={act.id}
                  onClick={() => onPick(act)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition text-xs ${
                    currentId === act.id
                      ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30'
                      : 'hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: act.color }} />
                  <span className='truncate'>{act.name}</span>
                  <span className='ml-auto rounded-full bg-zinc-700/40 px-1.5 py-0.5 text-[10px] text-zinc-500'>
                    {act.category}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {filteredExt.length === 0 && filteredApps.length === 0 && (
          <p className='text-xs text-zinc-600 py-3 text-center'>No matching activities</p>
        )}
      </div>
    </motion.div>
  )
}

const shimmer = 'animate-pulse rounded-xl bg-zinc-800/30'
function LoadingSkeleton() {
  return (
    <div className='space-y-2'>
      {[0, 1, 2].map((i) => (
        <div key={i} className='space-y-1.5'>
          <div className={shimmer + ' h-10'} />
          <div className={shimmer + ' h-16 ml-4'} />
        </div>
      ))}
    </div>
  )
}

function AllAccounted() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className='flex flex-col items-center gap-2 py-10 text-zinc-500'
    >
      <div className='w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20'>
        <Check className='h-6 w-6 text-emerald-400' />
      </div>
      <span className='text-sm font-medium text-zinc-300'>All time accounted for</span>
      <span className='text-xs text-zinc-600'>No gaps found in this period</span>
    </motion.div>
  )
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className='mb-2 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300/80'
    >
      <span>{message}</span>
      <button onClick={onRetry} className='text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors'>Retry</button>
    </motion.div>
  )
}

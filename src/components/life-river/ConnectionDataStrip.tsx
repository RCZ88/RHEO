"use client"

import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'

import type { LoadedMemory } from '../../features/memories/useMemories'
import { useCovenant } from '../../features/covenant/useCovenant'
import { cn } from '@/lib/utils'
import { ChevronDown, Clock, FolderHeart, Sparkles, Target } from 'lucide-react'

interface PeriodContext {
  goals: { completedCount: number; longTermGoalTitles: string[] }
  focusGroups: { name: string; totalMs: number }[]
  externalActivities: { label: string; totalMs: number }[]
  memories: { id: string; date: string; thumbnailUrl: string }[]
  appUsage?: { topApps: { name: string; totalMs: number }[] } | null
  covenantCompletionRate?: number | null
}

interface ConnectionDataStripProps {
  phaseId: string
  startYear: number
  endYear: number | null
  memories: LoadedMemory[]
}

const fmtHours = (ms: number) => {
  const h = ms / 3600000
  if (h >= 100) return `${Math.round(h)}h`
  return `${h.toFixed(1)}h`
}

export function ConnectionDataStrip({ phaseId, startYear, endYear, memories }: ConnectionDataStripProps) {
  const [open, setOpen] = useState(false)
  const [ctx, setCtx] = useState<PeriodContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const covenant = useCovenant()

  const now = new Date().getFullYear()
  const endY = endYear && endYear > 0 ? endYear : now
  const range = useCallback(() => {
    const start = `${startYear}-01-01`
    const end = `${endY}-12-31`
    return { startDate: start, endDate: end }
  }, [startYear, endY])

  // Renderer-side covenant rate for the range (covenant lives in localStorage, not SQLite).
  const covenantRate = React.useMemo(() => {
    const { startDate, endDate } = range()
    const inRange = covenant.completions.filter(c => c.date >= startDate && c.date <= endDate)
    const days = new Set(inRange.map(c => c.date)).size
    const possible = covenant.commitments.length
    if (possible === 0 || days === 0) return null
    return Math.min(1, inRange.length / (possible * days))
  }, [covenant.completions, covenant.commitments, range])

  const load = useCallback(async () => {
    if (loading || ctx) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.deskflowAPI.lifePhaseGetPeriodContext(range())
      if (res.ok && res.data) {
        const periodMemories = memories
          .filter(m => {
            const y = parseInt((m.meta.date || '').slice(0, 4), 10)
            return Number.isFinite(y) && y >= startYear && y <= endY
          })
          .map(m => ({ id: m.meta.id, date: m.meta.date || '', thumbnailUrl: m.url }))
        setCtx({ ...res.data, memories: periodMemories, covenantCompletionRate: covenantRate })
      } else {
        setError(res.error ?? 'Failed to load period context')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load period context')
    } finally {
      setLoading(false)
    }
  }, [loading, ctx, range, memories, startYear, endY, covenantRate])

  useEffect(() => {
    if (open && !ctx && !loading) load()
  }, [open, ctx, loading, load])

  const maxFocusMs = Math.max(1, ...(ctx?.focusGroups || []).map(f => f.totalMs))

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30" data-lifephase="connection-strip">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/30"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
          <Clock size={11} className="text-zinc-600" /> What I was doing then
        </span>
        <ChevronDown size={13} className={cn('text-zinc-600 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-800/50 px-3 py-3">
          {loading && (
            <p className="flex items-center gap-2 text-[12px] text-zinc-500">
              <Sparkles size={12} className="animate-pulse text-amber-400/70" /> Listening to that period…
            </p>
          )}
          {error && <p className="text-[12px] text-zinc-600">{error}</p>}

          {!loading && ctx && (
            <>
              {/* Goals */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-zinc-600">
                  <Target size={10} /> During this chapter
                </p>
                {ctx.goals.completedCount > 0 || ctx.goals.longTermGoalTitles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                      {ctx.goals.completedCount} goal{ctx.goals.completedCount === 1 ? '' : 's'} completed
                    </span>
                    {ctx.goals.longTermGoalTitles.slice(0, 3).map(t => (
                      <span key={t} className="rounded-full bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 text-[11px] text-zinc-400">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-zinc-600">No goals tracked yet during this period</p>
                )}
              </div>

              {/* Focus groups */}
              {ctx.focusGroups.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-zinc-600">
                    <FolderHeart size={10} /> Deep focus
                  </p>
                  <div className="space-y-1">
                    {ctx.focusGroups.map(f => (
                      <div key={f.name} className="flex items-center gap-2">
                        <span className="w-24 truncate text-[11px] text-zinc-400">{f.name}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400/70"
                            style={{ width: `${Math.max(3, (f.totalMs / maxFocusMs) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500">{fmtHours(f.totalMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External activities */}
              {ctx.externalActivities.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10.5px] uppercase tracking-wider text-zinc-600">Life outside the screen</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ctx.externalActivities.slice(0, 3).map(a => (
                      <span key={a.label} className="flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[11px] text-indigo-300">
                        {a.label}
                        <span className="font-mono text-[10px] text-indigo-400/70">{fmtHours(a.totalMs)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Memories in range */}
              {ctx.memories.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10.5px] uppercase tracking-wider text-zinc-600">From this time</p>
                  <div className="flex gap-1.5">
                    {ctx.memories.slice(0, 5).map(m => (
                      <div key={m.id} className="h-10 w-10 overflow-hidden rounded-md border border-zinc-800 bg-zinc-800/60">
                        <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                    {ctx.memories.length > 5 && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-800/60 text-[10px] text-zinc-500">
                        +{ctx.memories.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* App usage */}
              {ctx.appUsage && ctx.appUsage.topApps.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10.5px] uppercase tracking-wider text-zinc-600">Apps I lived in</p>
                  <div className="flex items-end gap-1.5">
                    {ctx.appUsage.topApps.slice(0, 3).map(a => (
                      <div key={a.name} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-mono text-zinc-500">{fmtHours(a.totalMs)}</span>
                        <div
                          className="w-full rounded-t-md bg-sky-400/50"
                          style={{ height: `${Math.max(6, (a.totalMs / ctx.appUsage!.topApps[0].totalMs) * 34)}px` }}
                        />
                        <span className="w-full truncate text-center text-[9.5px] text-zinc-500">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Covenant rate */}
              {ctx.covenantCompletionRate != null && (
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] uppercase tracking-wider text-zinc-600">Covenant kept</span>
                  <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400/80"
                      style={{ width: `${Math.round(ctx.covenantCompletionRate * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-amber-300/80">{Math.round(ctx.covenantCompletionRate * 100)}%</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

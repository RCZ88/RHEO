/**
 * profiler/MemoryTrend.tsx — "is it getting worse?", and the leak detector.
 *
 * "It gets laggy after an hour" is a leak, and a leak is the one performance
 * complaint that no frame-time number will ever reveal — the frames stay smooth
 * right up until the heap crosses a GC threshold. So this panel reports the heap
 * SLOPE, not just the heap level, and the slope is signed: a negative number is
 * a collection, and showing it as "−4.2 MB/min" rather than hiding it is the
 * difference between a useful reading and a reassuring one.
 *
 * RENDERER heap, deliberately. `console:metrics` also reports `appHeapMB`, but
 * that is the MAIN process. The renderer is the process that runs out of memory
 * and the process whose GC pauses produce the jank, so conflating the two would
 * make this panel confidently wrong.
 */
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TraceSample } from '../../shared/perfTypes'
import { formatElapsed, formatMb, formatSlope } from '../../shared/perfTypes'
import { NothingYet, Pill } from './primitives'

const AXIS = 'var(--color-muted-foreground)'
const GRID = 'var(--color-border)'
const ACCENT = 'var(--page-accent)'

/** Treated as a leak worth naming once it sustains this much growth. */
const LEAK_MB_PER_MIN = 4

export function MemoryTrend({
  trace,
  heapUsedMB,
  heapLimitMB,
  slope,
}: {
  trace: TraceSample[]
  heapUsedMB: number | null
  heapLimitMB: number | null
  slope: number
}) {
  const series = useMemo(
    () =>
      trace
        .filter((s) => s.source === 'memory')
        .map((s) => ({ t: s.t, mb: s.value })),
    [trace],
  )

  if (heapUsedMB == null) {
    return (
      <NothingYet
        title="Renderer heap is not exposed in this build"
        because="`performance.memory` is a non-standard Chromium API. It is available in the shipped Electron renderer, but if this reads as unavailable the build has it disabled — the host panel below still reports main-process memory."
      />
    )
  }

  const leaking = slope >= LEAK_MB_PER_MIN
  const pctOfLimit = heapLimitMB ? Math.min(100, (heapUsedMB / heapLimitMB) * 100) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={leaking ? 'warn' : 'neutral'} title="Least-squares slope of heap over the window">
          {formatSlope(slope)}
        </Pill>
        <Pill>{formatMb(heapUsedMB)} used</Pill>
        {pctOfLimit != null ? <Pill title="V8 heap ceiling for this renderer">of {pctOfLimit.toFixed(1)}% of limit</Pill> : null}
        <span className="ml-auto text-[11px] text-[var(--color-muted-foreground)]">
          Renderer JS heap, sampled every 2s.
        </span>
      </div>

      {series.length < 2 ? (
        <NothingYet
          title="Collecting heap samples"
          because="Two samples are needed before a growth rate means anything. Stay on this page for a few seconds and the curve appears."
        />
      ) : (
        <div className="h-[140px] w-full max-w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="pf-heap-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => formatElapsed(Math.max(0, v))}
                tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: GRID }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2 font-mono text-[11px] [font-variant-numeric:tabular-nums]">
                      <div className="text-[var(--color-muted-foreground)]">+{formatElapsed(Number(label))}</div>
                      <div className="text-[var(--color-foreground)]">{payload[0].value} MB</div>
                    </div>
                  ) : null
                }
              />
              {/* A flat line at the ceiling, so "nearly out" is legible before it
                  happens rather than inferred from a number off-screen. */}
              {heapLimitMB ? (
                <ReferenceLine y={heapLimitMB} stroke="var(--color-destructive)" strokeDasharray="4 3" ifOverflow="hidden" />
              ) : null}
              <Area
                dataKey="mb"
                name="renderer heap"
                type="monotone"
                stroke={ACCENT}
                strokeWidth={1.5}
                fill="url(#pf-heap-fill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {leaking ? (
        <p className="text-[11px] leading-relaxed text-[var(--color-amber-400)]">
          The renderer heap is sustained at {formatSlope(slope)}. Sustained growth like this across a long
          session is a retained-state leak, not garbage — check the Heap Δ column in the ledger for which
          page owns it.
        </p>
      ) : null}
    </div>
  )
}
/**
 * profiler/FrameScope.tsx — the centrepiece.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT LOOKS LIKE AN OSCILLOSCOPE AND NOT A DASHBOARD
 *
 * A dashboard summarises and hides. A scope shows the SHAPE OF TIME. Lag is not
 * a number, it is an interruption in an otherwise-continuous trace — so the
 * spine of this component is a continuous time axis that runs for the whole
 * session, and everything else on the page is a lens onto a slice of it.
 *
 * Three deliberate, non-obvious choices:
 *
 * 1. THE TWO BANDS ARE THE POINT. A shaded band from the 16.7ms frame budget up
 *    to the 50ms long-task line means "you are losing frames but not frozen", and
 *    everything above 50ms means "the UI was frozen here". Those two numbers
 *    turn a squiggle into a verdict. They are drawn as BANDS rather than as thin
 *    reference lines because a line is easy to miss when a bar crosses it, and
 *    the crossing is the entire finding.
 *
 * 2. BLOCKING TIME IS BARS, FRAME TIME IS A LINE. They are different kinds of
 *    thing: a long task is a discrete event with a duration, a frame is a
 *    continuous sample. Averaging them into one series would smooth away the
 *    exact 300ms spike the user came here to see.
 *
 * 3. THE ROUTE RIBBON. Without it the scope cannot answer "was that spike
 *    navigation, or something on the page I was already on?" — and that
 *    distinction is usually the whole answer. Route ids are read from the page
 *    registry so the ribbon shows real page names, not route slugs.
 *
 * SOURCE NOTE (PAINT P3): this is a ComposedChart (line + bar on one shared
 * scale) with ReferenceArea threshold bands — the same two concepts as
 * `@bklit`'s `composed-chart` and `reference-area`. Those registry components
 * require `@visx/*` (4 alpha packages) which is not a dependency of this
 * project, and `reference-area` additionally pulls the whole visx
 * `chart-context` scale infrastructure. `recharts@3.10.1` is already installed,
 * already the repo's charting idiom (3 call sites), and provides both concepts
 * natively. See the cycle report for the full deviation note.
 */
import { useCallback, useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  type TraceBucket,
  FRAME_BUDGET_MS,
  LONG_TASK_MS,
  formatElapsed,
  formatMs,
} from '../../shared/perfTypes'
import { Pill } from './primitives'

const AXIS = 'var(--color-muted-foreground)'
const GRID = 'var(--color-border)'
const ACCENT = 'var(--page-accent)'
const AMBER = 'var(--color-amber-400)'

/** Band fills derived from tokens, never literal rgba. */
const BAND_OVER_BUDGET = `color-mix(in oklch, ${AMBER} 7%, transparent)`
const BAND_FROZEN = `color-mix(in oklch, ${AMBER} 16%, transparent)`

function ScopeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const b: TraceBucket = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2.5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        +{formatElapsed(b.t)} into window
      </div>
      <dl className="space-y-0.5 font-mono text-[11px] [font-variant-numeric:tabular-nums]">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--color-muted-foreground)]">worst frame</dt>
          <dd className="text-[var(--color-foreground)]">{b.frameMs ? formatMs(b.frameMs) : '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--color-muted-foreground)]">blocked</dt>
          <dd className={b.blockMs > LONG_TASK_MS ? 'text-[var(--color-amber-400)]' : 'text-[var(--color-foreground)]'}>
            {b.blockMs ? formatMs(b.blockMs) : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[var(--color-muted-foreground)]">tasks</dt>
          <dd className="text-[var(--color-foreground)]">{b.tasks || '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

export function FrameScope({
  buckets,
  sessionMs,
  routeLabels,
  filterRoute,
}: {
  buckets: TraceBucket[]
  sessionMs: number
  routeLabels: (route: string | null) => string
  filterRoute: string | null
}) {
  /**
   * The x axis is the bucket INDEX (a category axis), not the timestamp.
   *
   * The buckets are already fixed 1s slices, so the index is a perfectly good
   * category — and it is the axis type recharts supports most reliably for bars.
   * A numeric time axis with a `Bar` inside is workable but position-sensitive,
   * and this page cannot be visually regression-tested in CI, so the robust path
   * wins. `elapsedFor` maps the index back to wall-clock for the tick labels, so
   * nothing is lost.
   */
  const data = useMemo(() => {
    const base = buckets.map((b, i) => ({ ...b, idx: i }))
    if (!filterRoute) return base
    return base.map((b) =>
      b.route === filterRoute ? b : { ...b, frameMs: 0, blockMs: 0, tasks: 0 },
    )
  }, [buckets, filterRoute])

  /** Wall-clock ms at the START of slice `idx`, for tick labels. */
  const elapsedFor = useCallback(
    (idx: number): number => {
      const b = data[idx]
      return b ? b.t : 0
    },
    [data],
  )

  const { peakFrame, peakBlock, ribbonRoutes } = useMemo(() => {
    let pf = 0
    let pb = 0
    const routes = new Set<string>()
    for (const b of data) {
      if (b.frameMs > pf) pf = b.frameMs
      if (b.blockMs > pb) pb = b.blockMs
      if (b.route) routes.add(b.route)
    }
    return { peakFrame: pf, peakBlock: pb, ribbonRoutes: [...routes].slice(0, 8) }
  }, [data])

  const top = Math.max(LONG_TASK_MS * 2, Math.ceil(Math.max(peakFrame, peakBlock) / 25) * 25)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="accent" title="One frame at 60Hz. Exceed it and a frame is dropped.">
          budget {FRAME_BUDGET_MS}ms
        </Pill>
        <Pill tone="warn" title="Chromium's own Long Tasks boundary. Above this the UI is frozen.">
          frozen {LONG_TASK_MS}ms+
        </Pill>
        <Pill title="The scope is bucketed to 1s slices. The task list below has exact durations.">
          1s slices
        </Pill>
        {filterRoute ? (
          <Pill tone="accent" title="Clear the ledger selection to see every route">
            filtered to {routeLabels(filterRoute)}
          </Pill>
        ) : null}
        <span className="ml-auto font-mono text-[10px] text-[var(--color-muted-foreground)]">
          peak {formatMs(peakBlock)} blocked
        </span>
      </div>

      <div className="h-[200px] w-full max-w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }} barCategoryGap={0}>
            {/* The two bands. Drawn UNDER everything so a spike crossing them
                stays fully visible — a band over the data would hide the very
                crossing it exists to reveal. */}
            <ReferenceArea y1={FRAME_BUDGET_MS} y2={LONG_TASK_MS} fill={BAND_OVER_BUDGET} ifOverflow="hidden" />
            <ReferenceArea y1={LONG_TASK_MS} y2={top} fill={BAND_FROZEN} ifOverflow="hidden" />

            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />

            <XAxis
              dataKey="idx"
              tickFormatter={(idx: number) => formatElapsed(elapsedFor(Number(idx)))}
              tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[0, top]}
              tickFormatter={(v: number) => `${v}`}
              tick={{ fill: AXIS, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={46}
              label={{
                value: 'ms',
                position: 'insideTopLeft',
                fill: AXIS,
                fontSize: 9,
                offset: -2,
              }}
            />
            <Tooltip content={<ScopeTooltip />} cursor={{ stroke: GRID }} />

            {/* Blocking time: bars, because a stall is an event with a duration. */}
            <Bar dataKey="blockMs" name="blocked" fill={AMBER} fillOpacity={0.55} isAnimationActive={false} radius={[2, 2, 0, 0]} />
            {/* Worst frame per slice: a line, because frames are continuous. */}
            <Line
              dataKey="frameMs"
              name="worst frame"
              type="monotone"
              stroke={ACCENT}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />

            <ReferenceLine
              y={FRAME_BUDGET_MS}
              stroke={ACCENT}
              strokeDasharray="4 3"
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
            <ReferenceLine y={LONG_TASK_MS} stroke={AMBER} strokeDasharray="4 3" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* The route ribbon: which page owned each stretch of the trace. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          routes seen
        </span>
        {ribbonRoutes.length ? (
          ribbonRoutes.map((r) => (
            <span key={r} className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--page-accent)]" />
              {routeLabels(r)}
            </span>
          ))
        ) : (
          <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
            none in this window
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[var(--color-muted-foreground)]">
          {Math.round(sessionMs / 1000)}s window
        </span>
      </div>
    </div>
  )
}
/**
 * profiler/primitives.tsx — the small vocabulary the profiler page is built from.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE DECISION IN HERE: `Provenance`
 *
 * A profiler shows numbers. A number without its origin is a rumour. "120ms"
 * could have come from Chromium's Long Tasks API, from React's commit phase, or
 * from the host OS clock — and chasing the wrong one is the single most common
 * way a performance investigation wastes an afternoon.
 *
 * So the origin is a VISIBLE ELEMENT next to every number, not fine print in a
 * tooltip. `Provenance` is that element, and it is required by every tile rather
 * than offered as an option.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAMINAR COMPLIANCE (design/design.md §2–§7)
 * - Signal hue: `var(--page-accent)` only. Amber means exactly one thing on this
 *   page — "past the frame budget". Rose is reserved for destructive actions.
 * - Radius: `rounded-lg` (8px) on data and code, `rounded-xl` (12px) on cards.
 * - Two fonts: Inter for prose, JetBrains Mono for every number.
 * - No raw hex/rgba here or in any sibling file; all colour resolves to a token
 *   or a `color-mix()` over a token.
 */
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Which layer produced a number. Rendered, never implied.
 *
 * Keys are IDENTICAL to `PerfCapabilities` in `shared/perfTypes.ts`, so a status
 * panel can index `capabilities[layer]` directly. An earlier draft also had
 * `'derived'` here — a label no tile ever used, which both left a status that
 * could never be reported and made the indexing need a cast that would have
 * hidden exactly the kind of key drift it was meant to catch.
 */
export type Layer = 'longtask' | 'frame' | 'memory' | 'ipc' | 'host' | 'react'

export const LAYER_LABEL: Record<Layer, string> = {
  longtask: 'Long Tasks API',
  frame: 'rAF sampling',
  memory: 'V8 heap',
  ipc: 'IPC round-trip',
  host: 'host OS',
  react: 'React commit',
}

/** One-line explanation of what the layer actually measures. */
export const LAYER_MEANS: Record<Layer, string> = {
  longtask: 'Chromium reports one entry per main-thread block over 50ms.',
  frame: 'requestAnimationFrame deltas. Says nothing about what caused them.',
  memory: 'Renderer JS heap. The main-process heap is a different number.',
  ipc: 'Full renderer → main → renderer round trip, including main-thread queueing.',
  host: 'CPU, memory and GPU as the operating system reports them.',
  react: 'React commit duration. Stripped from production React builds.',
}

/**
 * The provenance tag. Small, mono, muted — it must never compete with the
 * number it explains, but it must be impossible to miss.
 */
export function Provenance({ layer, className = '' }: { layer: Layer; className?: string }) {
  return (
    <span
      title={LAYER_MEANS[layer]}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 font-mono text-[9px] uppercase leading-none tracking-wider text-[var(--color-muted-foreground)] ${className}`}
    >
      {LAYER_LABEL[layer]}
    </span>
  )
}

/**
 * A stat tile. The alignment grid is fixed — 32px icon tile, 11px uppercase
 * label, mono value — because a column of numbers that changes every 250ms must
 * not reflow while you are trying to read it.
 */
export function StatTile({
  icon,
  label,
  value,
  unit,
  layer,
  detail,
  tone = 'neutral',
  span = false,
}: {
  icon: ReactNode
  label: string
  value: string
  unit?: string
  layer: Layer
  detail?: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
  span?: boolean
}) {
  // Tone is expressed as BORDER + a text token, never as a bare coloured dot,
  // because meaning carried by colour alone fails for colourblind users and in
  // a screenshot printed in greyscale.
  const valueTone =
    tone === 'good'
      ? 'text-[var(--color-foreground)]'
      : tone === 'warn'
        ? 'text-[var(--color-amber-400)]'
        : tone === 'bad'
          ? 'text-[var(--color-destructive)]'
          : 'text-[var(--color-foreground)]'

  const edgeTone =
    tone === 'warn'
      ? 'before:bg-[var(--color-amber-400)]'
      : tone === 'bad'
        ? 'before:bg-[var(--color-destructive)]'
        : 'before:bg-[var(--page-accent)]'

  return (
    <div
      className={`relative flex flex-col gap-2 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:content-[''] ${edgeTone} ${span ? 'sm:col-span-2' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--page-accent)]"
          >
            {icon}
          </span>
          <span className="truncate text-[11px] font-medium uppercase leading-tight tracking-wide text-[var(--color-muted-foreground)]">
            {label}
          </span>
        </div>
        <Provenance layer={layer} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl font-semibold leading-none [font-variant-numeric:tabular-nums] ${valueTone}`}>
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{unit}</span>
        ) : null}
      </div>
      {detail ? (
        <div className="text-[11px] leading-snug text-[var(--color-muted-foreground)]">{detail}</div>
      ) : null}
    </div>
  )
}

/**
 * The "past budget" marker. Amber is used for this and NOTHING else on the page,
 * which is what lets the eye read the scope without a legend.
 */
export function OverBudgetMark({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-amber-400)]">
      <AlertTriangle size={11} aria-hidden strokeWidth={2.5} />
      {children}
    </span>
  )
}

/** A labelled pill for counts and states. */
export function Pill({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'warn' | 'bad'
  title?: string
}) {
  const toneCls =
    tone === 'accent'
      ? 'border-[color-mix(in_oklch,var(--page-accent)_35%,transparent)] text-[var(--page-accent)]'
      : tone === 'warn'
        ? 'border-[color-mix(in_oklch,var(--color-amber-400)_35%,transparent)] text-[var(--color-amber-400)]'
        : tone === 'bad'
          ? 'border-[color-mix(in_oklch,var(--color-destructive)_35%,transparent)] text-[var(--color-destructive)]'
          : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] leading-none ${toneCls}`}
    >
      {children}
    </span>
  )
}

/**
 * Empty state. Says what WOULD be here and why it is not — never "No data".
 * The action is passed in rather than hardcoded so the caller decides what
 * recovery means for its own section.
 */
export function NothingYet({
  title,
  because,
  action,
}: {
  title: string
  because: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
      <p className="text-sm font-medium text-[var(--color-foreground)]">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-[var(--color-muted-foreground)]">{because}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}

/**
 * Skeleton shaped like the content it replaces. A bare spinner would be wrong
 * here: these are numeric readouts, and a spinner communicates "unknown" when
 * the truth is "not collected yet".
 */
export function TileSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="h-[104px] animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}

/**
 * A pure-SVG sparkline. Mirrors the one in the Penguin Console's MetricsPanel —
 * established in-repo precedent for dense dev-tool micro-charts, and it needs no
 * chart library because it is a trend indicator, not a chart.
 */
export function Spark({
  values,
  max,
  height = 20,
  label,
}: {
  values: number[]
  max?: number
  height?: number
  label: string
}) {
  if (values.length < 2) {
    return (
      <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]" aria-label={label}>
        —
      </span>
    )
  }
  const w = 100
  const peak = max ?? Math.max(...values, 0.0001)
  const step = w / (values.length - 1)
  let d = ''
  values.forEach((v, i) => {
    const x = i * step
    const y = height - (Math.max(0, Math.min(peak, v)) / peak) * (height - 2) - 1
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `
  })
  const lastX = (values.length - 1) * step
  const lastY = height - (Math.max(0, Math.min(peak, values[values.length - 1])) / peak) * (height - 2) - 1
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      className="w-full"
      role="img"
      aria-label={label}
    >
      <path
        d={d}
        fill="none"
        stroke="var(--page-accent)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill="var(--page-accent)" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
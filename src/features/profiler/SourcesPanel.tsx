/**
 * profiler/SourcesPanel.tsx — which channel produced what, and what is missing.
 *
 * This panel exists because of one specific failure mode. A profiler that
 * renders an unavailable measurement as `0` teaches the reader a false fact: they
 * conclude "no long tasks" when the truth is "long-task reporting is not
 * available here". So every channel states its own status, and the React row
 * states its limitation in plain language instead of showing a column of zeros.
 *
 * The React row is the one worth reading. React strips `<Profiler onRender>`
 * from production builds — verified against `react-dom-client.production.js`,
 * where `onRender` appears zero times. So component-level attribution is
 * genuinely unavailable in the shipped app, and the correct behaviour is to say
 * so rather than to ship a beautiful empty table.
 */
import { Check, Minus } from 'lucide-react'
import type { PerfCapabilities } from '../../shared/perfTypes'
import { LAYER_LABEL, LAYER_MEANS, Pill, type Layer } from './primitives'

const CHANNELS: Array<{ layer: Layer; used: string }> = [
  { layer: 'longtask', used: 'Blocking %, p95, worst, the task list, and the amber bars in the scope.' },
  { layer: 'frame', used: 'Frames per second, median frame time, and the accent line in the scope.' },
  { layer: 'memory', used: 'Heap panel, heap Δ per page, and the leak slope.' },
  { layer: 'ipc', used: 'IPC round-trip per page in the ledger.' },
  { layer: 'host', used: 'CPU and memory pressure in the host readout.' },
  { layer: 'react', used: 'Component commit timings — NOT available in production builds.' },
]

export function SourcesPanel({ capabilities }: { capabilities: PerfCapabilities }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-2xl text-[12px] leading-relaxed text-[var(--color-muted-foreground)]">
        Every number above is tagged with the layer that produced it. A measurement without its
        origin is a rumour — the same 120ms can mean a blocked renderer, a slow database, or a busy
        main process, and chasing the wrong one is how a performance investigation wastes an afternoon.
      </p>

      <ul className="mt-1 flex flex-col divide-y divide-[var(--color-border)]">
        {CHANNELS.map(({ layer, used }) => {
          const on = capabilities[layer]
          return (
            <li key={layer} className="flex items-start gap-3 py-2">
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  on
                    ? 'border-[color-mix(in_oklch,var(--page-accent)_40%,transparent)] text-[var(--page-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'
                }`}
              >
                {on ? <Check size={11} strokeWidth={3} /> : <Minus size={11} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-foreground)]">
                    {LAYER_LABEL[layer]}
                  </span>
                  <Pill tone={on ? 'accent' : 'neutral'}>{on ? 'live' : 'unavailable'}</Pill>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-muted-foreground)]">
                  {LAYER_MEANS[layer]}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-foreground)]">{used}</p>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
        <p className="text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
          <span className="text-[var(--color-foreground)]">Why there is no per-component table.</span>{' '}
          React removes <code className="font-mono text-[var(--color-foreground)]">&lt;Profiler
          onRender&gt;</code> from production builds, so component timings cannot be collected in the
          app you are running — only under the dev server. Rather than ship a table of zeros that reads
          as &ldquo;nothing is slow&rdquo;, this page measures at the levels the platform will actually
          report on: whole-frame, blocking-task, heap, and round-trip.
        </p>
      </div>
    </div>
  )
}
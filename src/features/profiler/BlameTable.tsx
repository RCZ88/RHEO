/**
 * profiler/BlameTable.tsx — "where did the time go", by declared operation.
 *
 * The task list answers "which freeze was worst". This answers the question you
 * actually act on: across the whole run, which operations cost the most, and how
 * many times each was called.
 *
 * Rows are sorted by TOTAL time, not by per-call time, because the question is
 * where the time went rather than what was slowest — an operation called 200
 * times at 3ms costs more wall-clock than one called once at 40ms, and only the
 * total tells you which to fix first.
 *
 * The `unattributed` row is the important one and is NOT hidden: it is the time
 * the profiler could not blame on anything. A large value here means the app's
 * expensive code is not instrumented yet, which is actionable in a way a missing
 * number is not.
 */
import { useMemo } from 'react'
import type { LongTaskRecord, MarkRecord } from '../../shared/perfTypes'
import { LONG_TASK_MS, attributeTask, formatMs, markTotals } from '../../shared/perfTypes'
import { NothingYet, Pill, Provenance } from './primitives'

export function BlameTable({
  marks,
  tasks,
}: {
  marks: MarkRecord[]
  tasks: LongTaskRecord[]
}) {
  const { totals, attributedMs, unattributedMs, unattributedCount } = useMemo(() => {
    const t = markTotals(marks)
    let attributed = 0
    let unattributed = 0
    let unattributedCount = 0
    for (const task of tasks) {
      const blame = attributeTask({ t: task.t, durationMs: task.durationMs }, marks)
      if (blame) attributed += blame.overlapMs
      else {
        unattributed += task.durationMs
        unattributedCount++
      }
    }
    return { totals: t, attributedMs: attributed, unattributedMs: unattributed, unattributedCount }
  }, [marks, tasks])

  if (!totals.length && !tasks.length) {
    return (
      <NothingYet
        title="Nothing to attribute yet"
        because="Every IPC call is timed automatically, so this fills in as soon as the app talks to its own main process. To name work that is not an IPC call — a heavy render or a big computation — wrap it with perfMark('label', fn) from lib/perfRecorder."
      />
    )
  }

  const totalBlockMs = attributedMs + unattributedMs
  const pct = (n: number) => (totalBlockMs > 0 ? Math.round((n / totalBlockMs) * 100) : 0)
  const top = Math.max(1, ...totals.map((t) => t.totalMs))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={unattributedMs > attributedMs ? 'warn' : 'accent'}>
          {pct(attributedMs)}% attributed
        </Pill>
        <Pill tone={unattributedMs > 0 ? 'warn' : 'neutral'}>
          {pct(unattributedMs)}% unattributed ({unattributedCount})
        </Pill>
        <Provenance layer="longtask" className="ml-auto" />
      </div>

      {totals.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th scope="col" className="py-2 pr-2 font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Operation
                </th>
                <th scope="col" className="w-[88px] px-2 py-2 text-right font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Total
                </th>
                <th scope="col" className="w-[64px] px-2 py-2 text-right font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Calls
                </th>
                <th scope="col" className="w-[80px] px-2 py-2 text-right font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  Mean
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.slice(0, 14).map((r) => (
                <tr key={r.label} className="border-b border-[var(--color-border)]">
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--color-foreground)]">
                        {r.label}
                      </span>
                      <span aria-hidden className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-border)] sm:block">
                        <span
                          className="block h-full rounded-full bg-[var(--page-accent)]"
                          style={{ width: `${Math.max(2, (r.totalMs / top) * 100)}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-mono text-[12px] [font-variant-numeric:tabular-nums] ${
                      r.totalMs >= LONG_TASK_MS ? 'text-[var(--color-amber-400)]' : 'text-[var(--color-foreground)]'
                    }`}
                  >
                    {formatMs(r.totalMs)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[12px] text-[var(--color-foreground)] [font-variant-numeric:tabular-nums]">
                    {r.calls}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[12px] text-[var(--color-muted-foreground)] [font-variant-numeric:tabular-nums]">
                    {formatMs(r.calls ? r.totalMs / r.calls : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {unattributedCount ? (
        <p className="text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
          <span className="text-[var(--color-amber-400)]">{formatMs(unattributedMs)}</span> of blocking time
          happened while no declared operation was running, so the profiler cannot name a cause for it. That is
          almost always render or layout work rather than an IPC handler — wrap the suspect function with{' '}
          <code className="font-mono text-[var(--color-foreground)]">perfMark(&apos;label&apos;, fn)</code> and
          it will be named here next run.
        </p>
      ) : null}
    </div>
  )
}
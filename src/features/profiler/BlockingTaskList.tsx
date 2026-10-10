/**
 * profiler/BlockingTaskList.tsx — "exactly what", with honest attribution.
 *
 * The scope answers WHEN. This answers WHAT. Every row is one real
 * `PerformanceLongTaskTiming` entry.
 *
 * WHY THE ATTRIBUTION COLUMN ADMITS IGNORANCE: Chromium's
 * `PerformanceTaskAttributionTiming` reports a `containerType`/`containerName`
 * that is genuinely useful for cross-origin iframes and genuinely empty for
 * same-document JavaScript, which is all this is. In a same-document app it
 * usually reads "unknown" or "self". Printing that verbatim is the honest
 * option; inventing a component name from it would be fabrication, and a
 * fabricated culprit sends a developer to fix the wrong file.
 */
import { useState } from 'react'
import type { ErrorRecord, LongTaskRecord, MarkRecord } from '../../shared/perfTypes'
import { LONG_TASK_MS, attributeTask, formatMs } from '../../shared/perfTypes'
import { NothingYet, Pill } from './primitives'

export function BlockingTaskList({
  tasks,
  marks,
  errors,
  routeLabels,
}: {
  tasks: LongTaskRecord[]
  /** Declared regions of work, used to blame each freeze on an operation. */
  marks: MarkRecord[]
  errors: ErrorRecord[]
  routeLabels: (route: string | null) => string
}) {
  const [showAll, setShowAll] = useState(false)
  const limit = 25
  const visible = showAll ? tasks : tasks.slice(-limit).reverse()

  if (tasks.length === 0) {
    return (
      <NothingYet
        title="No blocking tasks recorded"
        because={`Nothing has blocked the main thread for more than ${LONG_TASK_MS}ms since the profiler was armed. If the app still feels slow, the cost is spread across many sub-50ms tasks — the ledger's share-of-wall-clock column will show that even when this list is empty.`}
      />
    )
  }

  const worst = tasks.reduce((m, t) => Math.max(m, t.durationMs), 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={worst >= 200 ? 'warn' : 'neutral'}>{tasks.length} recorded</Pill>
        <Pill tone="warn" title={`Chromium only reports tasks over ${LONG_TASK_MS}ms`}>
          worst {formatMs(worst)}
        </Pill>
        <span className="ml-auto text-[11px] text-[var(--color-muted-foreground)]">
          Newest first. Attribution is Chromium’s, reported verbatim.
        </span>
      </div>

      {/* `flex-wrap` plus a `min-w-0` route cell: the row carries three fixed-width
          columns (timestamp, duration, magnitude bar), so on a narrow viewport
          the row's min-content width is the sum of those plus the longest route
          name. Without `min-w-0` on the name cell that sum becomes the page's
          min-content width and travels up through every flex ancestor. */}
      <ul className="flex flex-col divide-y divide-[var(--color-border)]">
        {visible.map((t) => {
          const severe = t.durationMs >= LONG_TASK_MS * 4
          // THE COLUMN THAT ANSWERS "WHERE IS IT COMING FROM": whichever declared
          // operation overlaps this stall the most. `null` is a legitimate,
          // displayed answer — nothing declared was running — and it is shown as
          // such rather than replaced with a guess.
          const blame = attributeTask({ t: t.t, durationMs: t.durationMs }, marks)
          const near = errors.find((e) => e.t >= t.t && e.t <= t.t + t.durationMs)
          return (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 font-mono text-[12px] [font-variant-numeric:tabular-nums]"
            >
              <span className="w-[64px] shrink-0 text-[10px] text-[var(--color-muted-foreground)]">
                +{(t.t / 1000).toFixed(1)}s
              </span>
              <span
                className={`w-[62px] shrink-0 text-right font-semibold ${
                  severe ? 'text-[var(--color-amber-400)]' : 'text-[var(--color-foreground)]'
                }`}
              >
                {formatMs(t.durationMs)}
              </span>
              {/* A bar so the eye can compare magnitudes without reading every
                  number. Scaled to this session's own worst task, so the scale
                  is always meaningful rather than an arbitrary 100ms ceiling. */}
              <span aria-hidden className="hidden h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-[var(--color-border)] sm:block">
                <span
                  className="block h-full rounded-full bg-[var(--color-amber-400)]"
                  style={{ width: `${Math.max(3, (t.durationMs / Math.max(1, worst)) * 100)}%` }}
                />
              </span>
              <span className="min-w-0 flex-1 basis-24 truncate text-[var(--color-foreground)]">
                {routeLabels(t.route)}
              </span>
              {/* The blame. Amber = attributed; muted = honestly unattributed. */}
              {blame ? (
                <span
                  title={`${blame.overlapMs}ms of this ${t.durationMs}ms stall was inside ${blame.label}`}
                  className="shrink-0 rounded-md border border-[color-mix(in_oklch,var(--color-amber-400)_35%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--color-amber-400)]"
                >
                  {blame.label} · {blame.sharePct}%
                </span>
              ) : (
                <span
                  title="No declared operation overlapped this stall. It came from code that is not instrumented — wrap it with perfMark() to name it next time."
                  className="shrink-0 text-[10px] text-[var(--color-muted-foreground)]"
                >
                  unattributed
                </span>
              )}
              {near ? (
                <span
                  title={`${near.kind}: ${near.message}${near.stack ? `\n\n${near.stack}` : ''}`}
                  className="shrink-0 rounded-md border border-[color-mix(in_oklch,var(--color-destructive)_45%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--color-destructive)]"
                >
                  error here
                </span>
              ) : null}
              <span
                className="hidden shrink-0 text-[10px] text-[var(--color-muted-foreground)] md:inline"
                title="PerformanceTaskAttributionTiming — usually empty for same-document script"
              >
                {t.containerType}/{t.attribution}
              </span>
            </li>
          )
        })}
      </ul>

      {tasks.length > limit ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] transition-colors duration-150 hover:border-[var(--page-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
        >
          {showAll ? 'show newest 25' : `show all ${tasks.length}`}
        </button>
      ) : null}
    </div>
  )
}
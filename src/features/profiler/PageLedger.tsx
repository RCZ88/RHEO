/**
 * profiler/PageLedger.tsx — "which page is slow", ranked.
 *
 * This is the artefact the whole page exists to produce. The scope answers
 * WHEN; this answers WHERE. Neither is useful alone, which is why they sit on
 * the same screen rather than behind tabs.
 *
 * THE RANKING IS BY BLOCKING SHARE, NOT BY TOTAL. Ten 51ms stalls and ten
 * 400ms stalls are both "10 tasks", but the second freezes the user for four
 * seconds instead of half a second. Ranking by count would put them adjacent and
 * tell the developer nothing. Ranking by `blockMs / observedMs` makes every row
 * comparable, which is the only property that makes an ordering mean anything.
 *
 * ROWS WITH NO DATA SINK. A page seen for 200ms has no blockPct yet, and 0.0%
 * would outrank a page that genuinely blocked 12% of its time. `observedMs <= 0`
 * sorts last regardless of the number, so "not measured yet" can never masquerade
 * as "measured and perfect".
 */
import { useMemo, useState } from 'react'
import { ArrowUpDown, ChevronRight } from 'lucide-react'
import type { PageLedgerRow } from '../../shared/perfTypes'
import { formatMs, prettifyRoute } from '../../shared/perfTypes'
import { NothingYet, Pill, Spark } from './primitives'

type SortKey = 'blockPct' | 'worstMs' | 'totalBlockingMs' | 'avgBlockMs' | 'p95BlockMs' | 'heapDeltaMB' | 'observedMs'

const COLUMNS: Array<{ key: SortKey; label: string; title: string; numeric: boolean }> = [
  { key: 'blockPct', label: 'Blocked', title: 'Share of this page’s observed wall-clock spent inside blocking tasks. The ranking key.', numeric: true },
  { key: 'worstMs', label: 'Worst', title: 'The single longest blocking task on this page.', numeric: true },
  { key: 'p95BlockMs', label: 'p95', title: '95th percentile of this page’s blocking tasks.', numeric: true },
  { key: 'totalBlockingMs', label: 'Total', title: 'All blocking time summed across every visit.', numeric: true },
  { key: 'avgBlockMs', label: 'Mean', title: 'Mean blocking task duration on this page.', numeric: true },
  { key: 'heapDeltaMB', label: 'Heap Δ', title: 'Renderer heap change from the first visit to now. Repeated growth here is the classic leak signature.', numeric: true },
  { key: 'observedMs', label: 'Watched', title: 'How long this page was actually observed while armed.', numeric: true },
]

export function PageLedger({
  rows,
  routeLabels,
  filterRoute,
  onSelect,
  knownRoutes,
}: {
  rows: PageLedgerRow[]
  routeLabels: (route: string) => string
  filterRoute: string | null
  onSelect: (route: string | null) => void
  /** Every navigable route in the app, so unmeasured pages are enumerable. */
  knownRoutes: ReadonlyArray<{ id: string; label: string }>
}) {
  const [sort, setSort] = useState<SortKey>('blockPct')
  const [asc, setAsc] = useState(false)
  const [showUnmeasured, setShowUnmeasured] = useState(false)

  /**
   * Split into measured vs never-observed.
   *
   * A row with `observedMs <= 0` has no numbers at all — it is not "0% blocked",
   * it is "not watched". Merging those into the ranking would put an unmeasured
   * page next to one that genuinely blocked 12% of its time, and the two are not
   * comparable, so they get their own list behind a disclosure.
   */
  const { measured, unmeasured } = useMemo(() => {
    const seen = new Set(rows.map((r) => r.route))
    const m = rows.filter((r) => r.observedMs > 0)
    const u = knownRoutes
      .filter((k) => !seen.has(k.id))
      .map((k) => ({ id: k.id, label: k.label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return { measured: m, unmeasured: u }
  }, [rows, knownRoutes])

  const sorted = useMemo(() => {
    const list = [...measured]
    list.sort((a, b) => {
      const av = a[sort] as number
      const bv = b[sort] as number
      return asc ? av - bv : bv - av
    })
    return list
  }, [measured, sort, asc])

  const measuredCount = measured.length

  if (measuredCount === 0 && unmeasured.length === 0) {
    return (
      <NothingYet
        title="No pages observed yet"
        because="The ledger fills in as you use the app while the profiler is armed. Navigate between two or three pages and the ranking appears here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={measuredCount ? 'accent' : 'neutral'}>
          {measuredCount} of {measuredCount + unmeasured.length} pages measured
        </Pill>
        {filterRoute ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] transition-colors duration-150 hover:border-[var(--page-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]"
          >
            clear filter
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-[var(--color-muted-foreground)]">
          Ranked by share of wall-clock blocked.
        </span>
      </div>

      {/* `max-w-full` + `min-w-0` on the scroller, and a min-width on the table
          rather than a fixed width. A FIXED width here would set the page's
          min-content width, and because every ancestor is a flex item with the
          default `min-width: auto`, that number propagates all the way up and
          pushes the page wider than the window — the right-hand columns end up
          off-screen with no way to reach them. `min-w` still guarantees the
          columns never crush, while `max-w-full` keeps the scroller itself
          inside its parent so it can actually scroll. */}
      <div className="min-w-0 max-w-full overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th scope="col" className="py-2 pr-2 font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Page
              </th>
              <th scope="col" className="w-[68px] px-2 font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Trend
              </th>
              {COLUMNS.map((c) => {
                const active = sort === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    title={c.title}
                    aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}
                    className="px-2 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (active) setAsc((v) => !v)
                        else {
                          setSort(c.key)
                          setAsc(false)
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-md px-1 py-1 font-mono text-[9px] font-medium uppercase tracking-wider transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] ${
                        active
                          ? 'text-[var(--page-accent)]'
                          : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                      }`}
                    >
                      {c.label}
                      <ArrowUpDown size={9} aria-hidden className={active ? '' : 'opacity-40'} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const unmeasured = r.observedMs <= 0
              const selected = filterRoute === (r.route || '__chrome__')
              const leaking = !unmeasured && r.heapDeltaMB > 8
              return (
                <tr
                  key={r.route || '__chrome__'}
                  onClick={() => onSelect(selected ? null : r.route || '__chrome__')}
                  aria-selected={selected}
                  className={`cursor-pointer border-b border-[var(--color-border)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--page-accent)] ${
                    selected ? 'bg-[color-mix(in_oklch,var(--page-accent)_10%,transparent)]' : 'hover:bg-[color-mix(in_oklch,var(--color-foreground)_3%,transparent)]'
                  }`}
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      <ChevronRight
                        size={12}
                        aria-hidden
                        className={`shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-150 ${selected ? 'rotate-90 text-[var(--page-accent)]' : ''}`}
                      />
                      <span className="truncate text-[13px] text-[var(--color-foreground)]">
                        {routeLabels(r.route)}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                        ×{r.visits}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    {unmeasured ? (
                      <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">—</span>
                    ) : (
                      <Spark values={r.trend} max={100} label={`blocking trend for ${routeLabels(r.route)}`} />
                    )}
                  </td>
                  {COLUMNS.map((c) => {
                    const raw = r[c.key] as number
                    const isPct = c.key === 'blockPct'
                    const show = unmeasured && c.key !== 'observedMs' ? '—' : isPct ? `${raw}%` : c.key === 'heapDeltaMB' ? `${raw > 0 ? '+' : ''}${raw}` : formatMs(raw)
                    const overBudget = (isPct && raw >= 4) || (!isPct && c.key !== 'heapDeltaMB' && c.key !== 'observedMs' && raw >= 50)
                    const leakCell = c.key === 'heapDeltaMB' && leaking
                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-2 font-mono text-[12px] [font-variant-numeric:tabular-nums] ${
                          overBudget || leakCell
                            ? 'text-[var(--color-amber-400)]'
                            : 'text-[var(--color-foreground)]'
                        }`}
                      >
                        {show}
                        {c.key === 'heapDeltaMB' ? <span className="ml-0.5 text-[10px] opacity-70">MB</span> : null}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {unmeasured.length ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setShowUnmeasured((v) => !v)}
            aria-expanded={showUnmeasured}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] transition-colors duration-150 hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--page-accent)]"
          >
            <ChevronRight
              size={12}
              aria-hidden
              className={`shrink-0 transition-transform duration-150 ${showUnmeasured ? 'rotate-90' : ''}`}
            />
            {unmeasured.length} pages not measured
            <span className="ml-auto normal-case tracking-normal text-[11px]">
              the profiler ranks what it watched — visit a page while armed to add it
            </span>
          </button>
          {showUnmeasured ? (
            <ul className="flex flex-wrap gap-1.5 border-t border-[var(--color-border)] p-3">
              {unmeasured.map((k) => (
                <li
                  key={k.id}
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[10px] text-[var(--color-muted-foreground)]"
                >
                  {k.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {sorted.some((r) => r.heapDeltaMB > 8) ? (
        <p className="text-[11px] leading-relaxed text-[var(--color-amber-400)]">
          {sorted.filter((r) => r.heapDeltaMB > 8).map((r) => prettifyRoute(r.route)).join(', ')}{' '}
          grew its heap by more than 8MB across visits. Check whether that is retained state or a leak
          before trusting the other columns.
        </p>
      ) : null}
    </div>
  )
}
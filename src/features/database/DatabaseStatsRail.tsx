/**
 * DatabaseStatsRail — "what is actually in here", at a glance.
 *
 * DESIGN INTENT (agent/skills/paint/SKILL.md §0.3)
 *   Idea: the database browser used to open on a wall of table names with a number
 *   in the corner. The genuinely interesting facts — 206 tables, 70k rows, a 122MB
 *   file, 194 indexes — were all present in the DB and shown NOWHERE. This rail is
 *   the answer to "is it worth looking at?", and it doubles as the scale legend for
 *   the row-size bars underneath it.
 *
 *   HUE MEANS TIER, NOT DECORATION (LAMINAR §2): one accent — `--page-accent`,
 *   violet for /database — carries the numbers, and the row-size bars use that same
 *   single hue at descending alpha. Nothing here invents a colour to look pretty;
 *   a longer bar is the only thing that changes.
 *
 *   P2 signature-design: SKIPPED. `signature-design` says skip for dense internal
 *   tools, and a schema browser is the definition of one. No hero element.
 */

import { useMemo } from 'react';
import { Table2, Rows3, Link2, Gauge, HardDrive, Activity } from 'lucide-react';

export interface DbStats {
  totalRows: number;
  indexCount: number;
  fkCount: number;
  dbBytes: number;
}

function fmtCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '—';
  const mb = b / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export function DatabaseStatsRail({
  stats,
  tableCount,
  counts,
  trackingDays,
  rowsPerDay,
  loading,
}: {
  stats: DbStats;
  tableCount: number;
  counts: Record<string, number>;
  /** days the `logs` table actually spans, for the "rate" fact */
  trackingDays?: number;
  rowsPerDay?: number;
  loading?: boolean;
}) {
  // The headline "fun fact": where the mass actually sits. Top 5 tables only —
  // a full treemap of 206 rects is noise, and the point is the shape of the top.
  const top = useMemo(() => {
    const rows = Object.entries(counts || {})
      .map(([name, n]) => ({ name, n }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    const max = rows[0]?.n ?? 1;
    return { rows, max };
  }, [counts]);

  const busiestShare = stats.totalRows > 0 && top.rows[0]
    ? Math.round((top.rows[0].n / stats.totalRows) * 100)
    : 0;

  const tiles = [
    { id: 'tables', label: 'Tables', value: fmtCount(tableCount), sub: 'in the schema', Icon: Table2 },
    { id: 'rows', label: 'Rows', value: fmtCount(stats.totalRows), sub: 'total stored', Icon: Rows3 },
    { id: 'size', label: 'On disk', value: fmtBytes(stats.dbBytes), sub: 'SQLite file', Icon: HardDrive },
    { id: 'idx', label: 'Indexes', value: fmtCount(stats.indexCount), sub: 'declared', Icon: Gauge },
    { id: 'fk', label: 'Relations', value: fmtCount(stats.fkCount), sub: 'foreign keys', Icon: Link2 },
  ];

  return (
    <div className="shrink-0 flex flex-col gap-2.5" data-section="database.stats">
      {/* ── the numbers ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(t => (
          <div
            key={t.id}
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: 'var(--ws-border)', backgroundColor: 'var(--ws-surface-raised)' }}
          >
            <div className="flex items-center gap-1.5">
              <t.Icon className="h-3 w-3 shrink-0" style={{ color: 'var(--page-accent)' }} />
              <span className="truncate text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t.label}
              </span>
            </div>
            {loading ? (
              <div className="mt-1 h-6 w-16 animate-pulse rounded bg-[var(--bg-secondary)]" />
            ) : (
              <div
                className="mt-0.5 font-mono text-lg font-semibold leading-tight tabular-nums"
                style={{ color: 'var(--text-primary)' }}
              >
                {t.value}
              </div>
            )}
            <div className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* ── the fun fact: where the mass sits ── */}
      {!loading && top.rows.length > 0 && (
        <div
          className="rounded-lg border px-3 py-2.5"
          style={{ borderColor: 'var(--ws-border)', backgroundColor: 'var(--ws-surface-raised)' }}
        >
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3" style={{ color: 'var(--page-accent)' }} />
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Where the rows live
              </span>
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {rowsPerDay ? `${fmtCount(rowsPerDay)} rows/day tracked` : ''}
              {trackingDays ? ` over ${fmtDuration(trackingDays * 86400)}` : ''}
            </span>
          </div>

          <div className="space-y-1">
            {top.rows.map(r => {
              const pct = Math.round((r.n / top.max) * 100);
              return (
                <div key={r.name} className="flex items-center gap-2">
                  <span
                    className="w-[130px] shrink-0 truncate font-mono text-[10px]"
                    style={{ color: 'var(--text-secondary)' }}
                    title={r.name}
                  >
                    {r.name}
                  </span>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        // One hue, descending alpha — length is the only signal.
                        backgroundColor: `color-mix(in srgb, var(--page-accent) ${30 + (pct * 0.6)}%, var(--bg-secondary))`,
                      }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {fmtCount(r.n)}
                  </span>
                </div>
              );
            })}
          </div>

          {busiestShare > 0 && (
            <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{top.rows[0].name}</span> alone holds{' '}
              <span style={{ color: 'var(--page-accent)' }}>{busiestShare}%</span> of everything stored — pick it
              first if you only have a minute.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Per-table count bar, used inside the scrollable list. */
export function RowCountBar({ count, max, accent }: { count: number; max: number; accent: string }) {
  if (!count || count <= 0) {
    return <span className="text-[9px]" style={{ color: 'var(--text-disabled)' }}>empty</span>;
  }
  const pct = Math.max(3, Math.round((count / Math.max(max, 1)) * 100));
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-10 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: `color-mix(in srgb, ${accent} 65%, var(--bg-secondary))` }}
        />
      </span>
      <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {fmtCount(count)}
      </span>
    </span>
  );
}

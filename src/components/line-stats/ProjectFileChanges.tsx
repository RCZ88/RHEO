import { useEffect, useMemo, useRef, useState } from 'react';
import { useFileChanges } from './useFileChanges';
import type { FileChangeResult } from '../../types/line-stats';

interface Props {
  projectId: string;
  projectPath: string;
}

type SortKey = 'file' | 'added' | 'removed' | 'total';

function truncateMiddle(s: string, max = 48): string {
  if (s.length <= max) return s;
  const keep = Math.floor((max - 1) / 2);
  return s.slice(0, keep) + '…' + s.slice(s.length - (max - keep - 1));
}

function formatAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)} min ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectFileChanges({ projectId, projectPath }: Props) {
  const fc = useFileChanges(projectId, projectPath);
  const { data, isScanning, error, ingestStatus, autoScan, setAutoScan } = fc;

  const [sortKey, setSortKey] = useState<SortKey>('added');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!liveOpen) return;
    const onDown = (e: MouseEvent) => {
      if (liveRef.current && !liveRef.current.contains(e.target as Node)) setLiveOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [liveOpen]);

  const rows = useMemo(() => {
    const base = (data?.files || []).map((f) => ({ ...f }));
    const dir = sortDir === 'asc' ? 1 : -1;
    base.sort((a, b) => {
      if (sortKey === 'file') return a.filePath.localeCompare(b.filePath) * dir;
      const va = sortKey === 'added' ? a.added : sortKey === 'removed' ? a.removed : a.totalLines;
      const vb = sortKey === 'added' ? b.added : sortKey === 'removed' ? b.removed : b.totalLines;
      if (vb !== va) return (vb - va) * dir;
      return a.filePath.localeCompare(b.filePath);
    });
    return base;
  }, [data?.files, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const isGit = !!data?.baselineCommit;
  const scannedAt = data?.lastScanAt || data?.scannedAt || null;
  const isIdle = !scannedAt;
  const isEmpty = !!scannedAt && (data?.files?.length || 0) === 0;

  const visibleRows = showAll ? rows : rows.slice(0, 200);
  const liveActive = !!ingestStatus && (ingestStatus.sources?.length || 0) > 0 &&
    ingestStatus.sources.some((s) => {
      const ls = new Date(s.lastSeenAt).getTime();
      return Date.now() - ls < 120000;
    });

  return (
    <div className="space-y-3">
      {/* section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Changes</h3>
          <p className="text-xs text-[var(--text-muted)]">
            {isGit ? 'via working-tree ledger' : 'via content snapshots'}
            {scannedAt ? ` · last scan ${formatAgo(scannedAt)}` : ''}
            {data?.lastEventAt ? ` · last event ${formatAgo(data.lastEventAt)}` : ''}
            {autoScan ? ' · auto' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fc.scan(false)}
            disabled={isScanning || !projectPath}
            className="px-3 py-1.5 text-xs bg-[var(--ws-surface-sunken)] hover:bg-[var(--ws-surface-recess-deep)] text-[var(--text-secondary)] rounded-lg border border-[var(--ws-border-strong)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60"
          >
            {isScanning ? 'Scanning…' : 'Scan'}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScan}
              onChange={(e) => setAutoScan(e.target.checked)}
              className="accent-[var(--page-accent)]"
            />
            Auto
          </label>
          {/* Live pill */}
          <div className="relative" ref={liveRef}>
            <button
              type="button"
              onClick={() => setLiveOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--ws-border-strong)] bg-[var(--ws-surface-sunken)] hover:bg-[var(--ws-surface-recess-deep)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: liveActive ? 'var(--page-accent)' : 'var(--text-muted)' }}
              />
              <span className="text-[var(--text-secondary)]">
                {liveActive ? `Live · ${ingestStatus?.sources?.[0]?.source || 'editor'}` : 'Live · off'}
              </span>
            </button>
            {liveOpen && (
              <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-xl border border-[var(--ws-border-strong)] bg-[var(--ws-surface-sunken)] p-3 shadow-xl space-y-2">
                <div className="text-xs font-medium text-[var(--text-primary)]">Ingest status</div>
                <div className="text-[11px] font-mono text-[var(--text-muted)] break-all">
                  {ingestStatus?.ingestPath || '—'}
                </div>
                {ingestStatus && (
                  <>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                      <span className="text-[var(--text-muted)]">received</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.received}</span>
                      <span className="text-[var(--text-muted)]">ingested</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.ingested}</span>
                      <span className="text-[var(--text-muted)]">unchanged</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.unchanged}</span>
                      <span className="text-[var(--text-muted)]">dropped (malformed)</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.droppedMalformed}</span>
                      <span className="text-[var(--text-muted)]">dropped (unknown project)</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.droppedUnknownProject}</span>
                      <span className="text-[var(--text-muted)]">dropped (escape)</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.droppedEscape}</span>
                      <span className="text-[var(--text-muted)]">dropped (version)</span>
                      <span className="text-[var(--text-primary)] text-right">{ingestStatus.counters.droppedVersion}</span>
                    </div>
                    {ingestStatus.sources?.length ? (
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {ingestStatus.sources.map((s) => (
                          <div key={s.source}>{s.source} · {formatAgo(s.lastSeenAt)}</div>
                        ))}
                      </div>
                    ) : null}
                    {ingestStatus.counters.droppedUnknownProject > 0 && (
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {ingestStatus.counters.droppedUnknownProject} event(s) from folders not added as projects. Add the folder in Projects to track it.
                      </div>
                    )}
                    {!liveActive && (
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Install the RHEO extension to stream saves live — see docs.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-[var(--ws-surface-sunken)] border border-[var(--ws-border-strong)] p-3 text-xs">
          <div className="text-[var(--text-primary)] font-medium mb-1">Couldn't scan</div>
          <div className="text-[var(--text-secondary)] mb-2">
            {/ENOENT/i.test(error) ? 'Folder not found — check the project path.'
              : /EACCES|permission/i.test(error) ? 'Permission denied.'
              : error}
          </div>
          <button
            type="button"
            onClick={() => void fc.scan(false)}
            className="text-[var(--page-accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Idle state */}
      {isIdle && !isScanning && !error && (
        <div className="rounded-xl bg-[var(--ws-surface-sunken)] p-4 space-y-2">
          <div className="text-sm font-medium text-[var(--text-primary)]">Track line changes</div>
          <div className="text-xs text-[var(--text-secondary)]">
            Per-file +added/−removed, git-style. Works in git and non-git folders; editor extensions stream saves live.
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Your first scan sets the baseline; changes appear as you work.
          </div>
          <button
            type="button"
            onClick={() => void fc.scan(false)}
            disabled={!projectPath}
            className="mt-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--page-accent-fill)] text-[var(--page-accent-on-fill)] hover:opacity-90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/60"
          >
            Run first scan
          </button>
        </div>
      )}

      {/* Loading state */}
      {isScanning && (
        <div className="space-y-1.5">
          <div className="h-9 rounded-lg bg-[var(--ws-surface-sunken)]" />
          <div className="h-9 rounded-lg bg-[var(--ws-surface-sunken)]" />
          <div className="h-9 rounded-lg bg-[var(--ws-surface-sunken)]" />
          <div className="h-9 rounded-lg bg-[var(--ws-surface-sunken)]" />
          <div className="h-9 rounded-lg bg-[var(--ws-surface-sunken)]" />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isScanning && !error && (
        <div className="text-xs text-[var(--text-muted)] py-2">No changes since the last scan.</div>
      )}

      {/* Populated state */}
      {!isIdle && !isEmpty && !isScanning && !error && data && (
        <>
          {/* summary strip */}
          <div className="flex items-stretch divide-x divide-[var(--ws-veil)] rounded-xl bg-[var(--ws-surface-sunken)] p-3">
            <div className="flex-1 px-3 first:pl-0">
              <div className="font-mono text-xl text-[var(--text-primary)] leading-none">
                <span className="text-[var(--page-accent)]">+</span>{data.summary.added}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">added</div>
            </div>
            <div className="flex-1 px-3">
              <div className="font-mono text-xl text-[var(--text-secondary)] leading-none">
                <span className="text-[var(--text-muted)]">−</span>{data.summary.removed}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">removed</div>
            </div>
            <div className="flex-1 px-3">
              <div className="font-mono text-xl text-[var(--text-primary)] leading-none">{data.summary.filesChanged}</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">files touched</div>
              {data.rebaselined ? (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">re-baselined: {data.rebaselined}</div>
              ) : null}
            </div>
          </div>

          {/* table */}
          <div className="rounded-lg border border-[var(--ws-border-strong)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[var(--ws-surface-sunken)] text-[var(--text-muted)]">
                <tr>
                  {([
                    ['file', 'FILE'],
                    ['added', 'ADDED'],
                    ['removed', 'REMOVED'],
                    ['total', 'TOTAL'],
                  ] as [SortKey, string][]).map(([k, label]) => (
                    <th
                      key={k}
                      aria-sort={sortKey === k ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                      className={`px-3 py-1.5 font-medium tracking-wide uppercase text-[11px] cursor-pointer select-none ${k === 'file' ? 'text-left' : 'text-right'} ${sortKey === k ? 'text-[var(--page-accent)]' : ''}`}
                      onClick={() => toggleSort(k)}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((f: FileChangeResult) => (
                  <tr
                    key={f.filePath}
                    className="border-t border-[var(--ws-veil)] hover:bg-[var(--ws-surface-recess-deep)] transition-colors"
                    title={`${f.filePath} · ${new Date((data.lastScanAt || data.scannedAt) as string).toLocaleString()}`}
                  >
                    <td className="px-3 py-2 font-mono text-[13px] text-[var(--text-primary)] truncate max-w-[260px]" title={f.filePath}>
                      {f.approx ? '~' : ''}{truncateMiddle(f.filePath)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[13px] text-[var(--text-primary)]">
                      <span className="text-[var(--page-accent)]">+</span>{f.added}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[13px] text-[var(--text-secondary)]">
                      <span className="text-[var(--text-muted)]">−</span>{f.removed}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[13px] text-[var(--text-secondary)]">{f.totalLines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full py-2 text-xs text-[var(--page-accent)] hover:bg-[var(--ws-surface-recess-deep)] transition-colors border-t border-[var(--ws-veil)]"
              >
                Show all {rows.length}
              </button>
            )}
          </div>
          {data.engine === 'approx' && (
            <div className="text-[11px] text-[var(--text-muted)]">
              ~ counts are approximated (file over 512KB or evicted content).
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Copy, Download, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Bug, Check, FileJson, AlertTriangle, X,
} from 'lucide-react';

console.log('%c[DebugVaultPanel] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

// PAINT P4: the Insights strip is CHROME, so its colour comes from the page
// accent token rather than five hardcoded Tailwind hues. [data-page="ai"]
// resolves --page-accent to #8b5cf6; a literal would drift on accent change.
const INS_ACCENT = 'text-[var(--page-accent)]';

interface DebugEventRow {
  id: number; ts: string; epochMs: number; source: string; event: string;
  feature?: string; provider?: string; model?: string; contextId?: string; role?: string;
  tokensIn: number; tokensOut: number; payload?: string;
  // AI observability additions — null means "not recorded", never 0.
  traceId?: string; latencyMs?: number; costUsd?: number | null;
  httpStatus?: number | null; errorKind?: string; attemptIndex?: number; parseOk?: boolean;
}
interface VaultInsightGroup {
  calls: number; errors: number; errorRate: number;
  p50: number | null; p95: number | null;
  totalCostUsd: number; pricedCalls: number;
}
interface VaultInsights {
  calls: number; errors: number; errorRate: number;
  p50: number | null; p95: number | null;
  totalCostUsd: number; meanCostUsd: number | null; unpricedCalls: number;
  totalTokens: number;
  byProvider: Record<string, VaultInsightGroup>;
  byFeature: Record<string, VaultInsightGroup>;
  error?: string;
}
const fmtMs = (n?: number | null) => n == null ? '—' : n < 1000 ? `${n.toFixed(0)}ms` : `${(n / 1000).toFixed(2)}s`;
const fmtUsd = (n?: number | null) => n == null ? '—' : `$${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}`;
interface VaultStats {
  total: number; bySource: Record<string, number>; byEvent: Record<string, number>;
  oldestMs: number | null; newestMs: number | null;
  capturePoints: Array<{ source: string; where: string; captures: string }>;
}
interface CapturePoint { source: string; where: string; captures: string }

const SOURCES = ['ai-assistant', 'ai-chat', 'provider-router', 'route-prompt', 'terminal-agent', 'renderer'];
const EVENTS = ['prompt', 'thinking', 'output', 'parsed', 'chunk', 'state', 'error', 'attempt', 'route-decision'];

const SOURCE_COLORS: Record<string, string> = {
  'ai-assistant': 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  'ai-chat': 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  'provider-router': 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  'route-prompt': 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  'terminal-agent': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  'renderer': 'text-amber-300 bg-amber-500/10 border-amber-500/20',
};
const EVENT_COLORS: Record<string, string> = {
  prompt: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  thinking: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  output: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  parsed: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  chunk: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  state: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  error: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  attempt: 'text-[var(--page-accent)] bg-[color-mix(in_srgb,var(--page-accent)_10%,transparent)] border-[color-mix(in_srgb,var(--page-accent)_20%,transparent)]',
  'route-decision': 'text-zinc-200 bg-zinc-500/10 border-zinc-500/20',
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function prettyJson(raw: string | undefined): string {
  if (!raw) return '(no payload)';
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

export function DebugVaultPanel({ open }: { open: boolean }) {
  const api = window.deskflowAPI;
  const [events, setEvents] = useState<DebugEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [eventsFilter, setEventsFilter] = useState<Set<string>>(new Set());
  const [searchDraft, setSearchDraft] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);
  const [insights, setInsights] = useState<VaultInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!api?.aiDebugStats) return;
    try { const s = await api.aiDebugStats(); if (s) setStats(s as VaultStats); } catch {}
  }, [api]);

  const fetchEvents = useCallback(async (off: number, lim: number) => {
    if (!api?.aiDebugQuery) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.aiDebugQuery({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
        search: search.trim() || undefined,
        limit: lim, offset: off,
      });
      if (res?.error) setError(res.error);
      setEvents(res?.events || []);
      setTotal(res?.total || 0);
    } catch (e: any) { setError(e?.message || 'Failed to load events'); }
    finally { setLoading(false); }
  }, [api, sources, eventsFilter, search]);

  useEffect(() => { if (open) { fetchStats(); fetchEvents(offset, limit); } }, [open, fetchStats, offset, limit]);

  useEffect(() => { if (!open) return; const iv = window.setInterval(fetchStats, 6000); return () => window.clearInterval(iv); }, [open, fetchStats]);

  useEffect(() => {
    if (!open) return;
    setOffset(0);
    fetchEvents(0, limit);
  }, [sources, eventsFilter, search]);

  // Insights aggregates only `attempt` rows (the router emits one per provider
  // try), so a 3-provider chain reads as 3 calls with 2 errors — the real
  // reliability signal. Filtering to event='output' would report 100% success.
  const fetchInsights = useCallback(async () => {
    if (!api?.aiDebugInsights) return;
    setInsightsLoading(true);
    try {
      const res = await api.aiDebugInsights({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
        search: search.trim() || undefined,
      });
      setInsights(res && !res.error ? res as VaultInsights : null);
    } catch { setInsights(null); }
    finally { setInsightsLoading(false); }
  }, [api, sources, eventsFilter, search]);

  useEffect(() => { if (open) fetchInsights(); }, [open, fetchInsights]);

  const onSearchChange = useCallback((v: string) => {
    setSearchDraft(v);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => { setSearch(v); setOffset(0); }, 450);
  }, []);

  const toggle = useCallback((setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) => {
    setter(prev => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; });
    setOffset(0);
  }, []);

  const refresh = useCallback(() => { fetchStats(); fetchEvents(offset, limit); fetchInsights(); }, [fetchStats, fetchEvents, fetchInsights, offset, limit]);

  const doExport = useCallback(async (mode: 'copy' | 'download') => {
    if (!api?.aiDebugExport) return;
    setExporting(mode);
    try {
      const res = await api.aiDebugExport({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
        search: search.trim() || undefined,
        limit: 3000,
      });
      if (res?.error) { setError(res.error); return; }
      if (mode === 'copy') {
        const ok = await copyText(res?.markdown || '');
        if (ok) { setCopied('export'); window.setTimeout(() => setCopied(null), 2000); }
      } else {
        const blob = new Blob([res?.markdown || ''], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deskflow-ai-debug-vault-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e: any) { setError(e?.message || 'Export failed'); }
    finally { setExporting(null); }
  }, [api, sources, eventsFilter, search]);

  const doClear = useCallback(async () => {
    if (!clearArmed) { setClearArmed(true); window.setTimeout(() => setClearArmed(false), 3000); return; }
    if (!api?.aiDebugClear) return;
    try {
      const res = await api.aiDebugClear({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
      });
      setClearArmed(false); refresh();
      if (res?.error) setError(res.error);
    } catch (e: any) { setError(e?.message || 'Clear failed'); }
  }, [api, clearArmed, sources, eventsFilter, refresh]);

  const copyRow = useCallback(async (row: DebugEventRow) => {
    const md = [
      `#${row.id} — ${row.ts} — \`${row.source}/${row.event}\``,
      row.provider ? `- provider: ${row.provider}` : '',
      row.model ? `- model: ${row.model}` : '',
      row.feature ? `- feature: ${row.feature}` : '',
      row.contextId ? `- context: ${row.contextId}` : '',
      row.role ? `- role: ${row.role}` : '',
      row.tokensIn || row.tokensOut ? `- tokens in/out: ${row.tokensIn}/${row.tokensOut}` : '',
      row.traceId ? `- trace: ${row.traceId}` : '',
      row.latencyMs != null ? `- latency: ${fmtMs(row.latencyMs)}` : '',
      row.costUsd != null ? `- cost: ${fmtUsd(row.costUsd)}` : '',
      row.errorKind ? `- error_kind: ${row.errorKind}` : '',
      row.attemptIndex != null ? `- attempt_index: ${row.attemptIndex}` : '',
      '', '```json', prettyJson(row.payload), '```',
    ].filter(l => l !== '').join('\n');
    const ok = await copyText(md);
    if (ok) { setCopied(String(row.id)); window.setTimeout(() => setCopied(null), 2000); }
  }, []);

  const newestAge = useMemo(() => {
    if (!stats?.newestMs) return null;
    const mins = Math.max(0, Math.round((Date.now() - stats.newestMs) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }, [stats?.newestMs]);

  if (!open) return null;

    return (
    <div className="h-full overflow-y-auto bg-zinc-950 light:bg-white/40 px-4 py-3 space-y-3 text-xs">
      {/* Collapsible capture-points */}
      <button onClick={() => setShowCapture(v => !v)} className="flex items-center gap-2 text-zinc-400 light:text-[var(--text-muted)] hover:text-zinc-300 light:text-[var(--text-secondary)] transition-colors">
        {showCapture ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Bug className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-medium text-zinc-200">AI Debug Vault</span>
        <span className="text-[10px] text-zinc-600 light:text-[var(--text-muted)] border border-zinc-800 light:border-[var(--ws-border)] rounded-full px-1.5 py-0.5">super-debug</span>
        {stats && <span className="ml-1 text-[10px] text-zinc-500 light:text-[var(--text-muted)]">{stats.total.toLocaleString()} events</span>}
      </button>
      {showCapture && (
        <div className="space-y-2 pl-5">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Total</p>
              <p className="text-lg font-bold text-amber-300 font-mono">{stats ? stats.total.toLocaleString() : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Sources</p>
              <p className="text-lg font-bold text-sky-300 font-mono">{stats ? Object.keys(stats.bySource).length : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Errors</p>
              <p className="text-lg font-bold text-rose-300 font-mono">{stats ? (stats.byEvent['error'] || 0) : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Newest</p>
              <p className="text-lg font-bold text-zinc-100 font-mono">{newestAge ?? '—'}</p>
            </div>
          </div>

          {/* Insights — aggregation over per-attempt rows */}
          <div className="grid grid-cols-5 gap-2">
            {[
              // One signal hue for the chrome metrics; semantic hues only where
              // the number IS a verdict (error rate, cost-of-failures).
              { label: 'p50 Latency', value: fmtMs(insights?.p50), tone: INS_ACCENT },
              { label: 'p95 Latency', value: fmtMs(insights?.p95), tone: INS_ACCENT },
              { label: 'Error Rate', value: insightsLoading ? '…' : insights ? `${(insights.errorRate * 100).toFixed(1)}%` : '—', tone: 'text-rose-300' },
              { label: 'Total Cost', value: insightsLoading ? '…' : fmtUsd(insights?.totalCostUsd), tone: INS_ACCENT },
              { label: 'Attempts', value: insightsLoading ? '…' : insights ? insights.calls.toLocaleString() : '—', tone: INS_ACCENT },
            ].map(c => (
              <div key={c.label} className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">{c.label}</p>
                <p className={`text-lg font-bold font-mono ${c.tone}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {insights && insights.unpricedCalls > 0 && (
            <div className="text-[9px] text-zinc-500 light:text-[var(--text-muted)]">
              {insights.unpricedCalls.toLocaleString()} of {insights.calls.toLocaleString()} attempts used a model with no price on file — total cost is a floor, not the full figure.
            </div>
          )}

          {insights && Object.keys(insights.byProvider).length > 0 && (
            <div className="bg-zinc-900 light:bg-white/30 border border-zinc-800/30 light:border-[var(--ws-border)] rounded-lg overflow-hidden">
              <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)] border-b border-zinc-800/40 light:border-[var(--ws-border)]/30">
                Per provider
              </div>
              {Object.entries(insights.byProvider).map(([id, g]) => (
                <div key={id} className="px-2.5 py-1 flex items-center gap-2 text-[10px] border-b border-zinc-800/20 light:border-[var(--ws-border)]/15 last:border-0">
                  <span className="font-mono text-zinc-300 light:text-[var(--text-secondary)] truncate max-w-[140px]">{id}</span>
                  <span className="text-zinc-500 light:text-[var(--text-muted)]">{g.calls} calls</span>
                  <span className={g.errorRate > 0 ? 'text-rose-300' : 'text-zinc-600 light:text-[var(--text-muted)]'}>
                    {(g.errorRate * 100).toFixed(0)}% err
                  </span>
                  <span className="ml-auto font-mono text-zinc-400 light:text-[var(--text-muted)]">{fmtMs(g.p50)} / {fmtMs(g.p95)}</span>
                  <span className="font-mono text-[var(--page-accent)]/80 w-16 text-right">{fmtUsd(g.totalCostUsd)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Capture points */}
          <div className="bg-zinc-900 light:bg-white/30 border border-zinc-800/30 light:border-[var(--ws-border)] rounded-lg p-2.5 space-y-1">
            {(stats?.capturePoints || []).map((cp: CapturePoint) => (
              <div key={cp.source} className="flex items-center gap-2 text-[10px] text-zinc-400 light:text-[var(--text-muted)] py-0.5 border-b border-zinc-800 light:border-[var(--ws-border)]/20 last:border-0">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${SOURCE_COLORS[cp.source] || ''}`}>{cp.source}</span>
                <span>{cp.where}</span>
                <span className="ml-auto shrink-0 text-[9px] text-zinc-600 light:text-[var(--text-muted)]">{cp.captures}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white border border-zinc-800/50 light:border-[var(--ws-border)] rounded px-2 py-1 w-48">
              <Search className="w-3 h-3 text-zinc-500 light:text-[var(--text-muted)]" />
              <input value={searchDraft} onChange={e => onSearchChange(e.target.value)}
                placeholder="Search…"
                className="bg-transparent text-[10px] text-zinc-200 outline-none w-full placeholder:text-zinc-600 light:text-[var(--text-muted)]" />
              {searchDraft && <button onClick={() => onSearchChange('')} className="text-zinc-500 light:text-[var(--text-muted)] hover:text-zinc-300 light:text-[var(--text-secondary)]"><X className="w-3 h-3" /></button>}
            </div>
            {SOURCES.map(s => (
              <button key={s} onClick={() => toggle(setSources, s)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${sources.has(s) ? SOURCE_COLORS[s] : 'text-zinc-600 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border-zinc-800/40 hover:text-zinc-400'}`}>
                {s}
              </button>
            ))}
            <span className="text-[9px] text-zinc-600 light:text-[var(--text-muted)] mx-0.5">|</span>
            {EVENTS.map(e => (
              <button key={e} onClick={() => toggle(setEventsFilter, e)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${eventsFilter.has(e) ? EVENT_COLORS[e] : 'text-zinc-600 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border-zinc-800/40 hover:text-zinc-400'}`}>
                {e}
              </button>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-300 light:text-[var(--text-secondary)] bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] border border-zinc-700 light:border-[color-mix(in_srgb,var(--ws-border)_30%,transparent)] hover:bg-zinc-700 light:hover:bg-stone-200/40 transition-colors">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => doExport('copy')} disabled={exporting !== null}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
              {copied === 'export' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {exporting === 'copy' ? 'Exporting…' : 'Copy'}
            </button>
            <button onClick={() => doExport('download')} disabled={exporting !== null}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
              <Download className="w-3 h-3" /> {exporting === 'download' ? 'Exporting…' : 'Download'}
            </button>
            <button onClick={doClear}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${clearArmed ? 'text-white bg-rose-600 border-rose-500' : 'text-rose-300 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'}`}>
              <Trash2 className="w-3 h-3" /> {clearArmed ? 'Confirm?' : 'Clear'}
            </button>
            <span className="ml-auto text-[9px] text-zinc-600 light:text-[var(--text-muted)]">{total.toLocaleString()} matching</span>
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setOffset(0); }}
              className="bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 rounded px-1.5 py-0.5 text-[9px] text-zinc-400 light:text-[var(--text-muted)] outline-none">
              {[25, 50, 100, 250].map(l => <option key={l} value={l}>{l}/page</option>)}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
            </div>
          )}

          {/* Event list */}
          <div className="border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg overflow-hidden">
            {loading && events.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-zinc-500 light:text-[var(--text-muted)] text-[10px]">Loading…</div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-zinc-500 light:text-[var(--text-muted)] gap-1">
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>No events yet — talk to the AI Assistant and come back.</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/30">
                {events.map(row => {
                  const isOpen = expandedId === row.id;
                  return (
                    <div key={row.id} className="hover:bg-zinc-800 light:bg-[var(--ws-surface-sunken)]/15 transition-colors">
                      <button onClick={() => setExpandedId(isOpen ? null : row.id)}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-left">
                        {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500 light:text-[var(--text-muted)] shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 light:text-[var(--text-muted)] shrink-0" />}
                        <span className="font-mono text-[10px] text-zinc-500 light:text-[var(--text-muted)] w-12 shrink-0">#{row.id}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${SOURCE_COLORS[row.source] || ''}`}>{row.source}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${EVENT_COLORS[row.event] || ''}`}>{row.event}</span>
                        {row.provider && <span className="text-[10px] text-zinc-400 light:text-[var(--text-muted)] truncate max-w-[100px]">{row.provider}</span>}
                        {row.model && <span className="text-[10px] text-zinc-500 light:text-[var(--text-muted)] truncate max-w-[100px] hidden md:inline">{row.model}</span>}
                        {row.latencyMs != null && <span className="text-[10px] text-[var(--page-accent)] font-mono shrink-0">{fmtMs(row.latencyMs)}</span>}
                        {row.costUsd != null && <span className="text-[10px] text-[var(--page-accent)]/80 font-mono shrink-0">{fmtUsd(row.costUsd)}</span>}
                        <span className="ml-auto text-[9px] text-zinc-600 light:text-[var(--text-muted)] font-mono shrink-0">{row.ts.slice(11, 19)}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-2 pl-10 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-zinc-500 light:text-[var(--text-muted)]">
                            <span className="font-mono">{row.ts}</span>
                            {row.model && <span>model: {row.model}</span>}
                            {row.feature && <span>feature: {row.feature}</span>}
                            {(row.tokensIn || row.tokensOut) && <span>tokens: {row.tokensIn}/{row.tokensOut}</span>}
                            {row.latencyMs != null && <span>latency: {fmtMs(row.latencyMs)}</span>}
                            {row.costUsd != null && <span>cost: {fmtUsd(row.costUsd)}</span>}
                            {row.errorKind && <span className="text-rose-300">error: {row.errorKind}</span>}
                            {row.httpStatus != null && <span>http: {row.httpStatus}</span>}
                            {row.attemptIndex != null && <span>attempt #{row.attemptIndex}</span>}
                            {row.traceId && <span className="font-mono" title="Trace id — every row from one call shares it">trace: {row.traceId.slice(0, 8)}</span>}
                            <button onClick={e => { e.stopPropagation(); copyRow(row); }}
                              className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                              {copied === String(row.id) ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                              {copied === String(row.id) ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre className="text-[10px] leading-relaxed text-zinc-300 light:text-[var(--text-secondary)] bg-black/20 border border-zinc-800/30 light:border-[var(--ws-border)] rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words font-mono">
                            {prettyJson(row.payload)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between text-[10px] text-zinc-500 light:text-[var(--text-muted)]">
              <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
                  className="px-2 py-0.5 rounded border border-zinc-800/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-300 light:text-[var(--text-secondary)] hover:bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] disabled:opacity-40 transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}
                  className="px-2 py-0.5 rounded border border-zinc-800/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-300 light:text-[var(--text-secondary)] hover:bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] disabled:opacity-40 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
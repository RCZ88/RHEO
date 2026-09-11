import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Copy, Download, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Bug, Check, FileJson, AlertTriangle, X,
} from 'lucide-react';

console.log('%c[DebugVaultPanel] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

interface DebugEventRow {
  id: number; ts: string; epochMs: number; source: string; event: string;
  feature?: string; provider?: string; model?: string; contextId?: string; role?: string;
  tokensIn: number; tokensOut: number; payload?: string;
}
interface VaultStats {
  total: number; bySource: Record<string, number>; byEvent: Record<string, number>;
  oldestMs: number | null; newestMs: number | null;
  capturePoints: Array<{ source: string; where: string; captures: string }>;
}
interface CapturePoint { source: string; where: string; captures: string }

const SOURCES = ['ai-assistant', 'ai-chat', 'provider-router', 'route-prompt', 'terminal-agent', 'renderer'];
const EVENTS = ['prompt', 'thinking', 'output', 'parsed', 'chunk', 'state', 'error'];

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

  const onSearchChange = useCallback((v: string) => {
    setSearchDraft(v);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => { setSearch(v); setOffset(0); }, 450);
  }, []);

  const toggle = useCallback((setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) => {
    setter(prev => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; });
    setOffset(0);
  }, []);

  const refresh = useCallback(() => { fetchStats(); fetchEvents(offset, limit); }, [fetchStats, fetchEvents, offset, limit]);

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
      '', '```json', prettyJson(row.payload), '```',
    ].filter(l => l !== '' || l === '```json').join('\n');
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
      <button onClick={() => setShowCapture(v => !v)} className="flex items-center gap-2 text-zinc-400 light:text-stone-500 hover:text-zinc-300 light:text-stone-700 transition-colors">
        {showCapture ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Bug className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-medium text-zinc-200">AI Debug Vault</span>
        <span className="text-[10px] text-zinc-600 light:text-stone-500 border border-zinc-800 light:border-[var(--ws-border)] rounded-full px-1.5 py-0.5">super-debug</span>
        {stats && <span className="ml-1 text-[10px] text-zinc-500 light:text-stone-500">{stats.total.toLocaleString()} events</span>}
      </button>
      {showCapture && (
        <div className="space-y-2 pl-5">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-stone-500">Total</p>
              <p className="text-lg font-bold text-amber-300 font-mono">{stats ? stats.total.toLocaleString() : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-stone-500">Sources</p>
              <p className="text-lg font-bold text-sky-300 font-mono">{stats ? Object.keys(stats.bySource).length : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-stone-500">Errors</p>
              <p className="text-lg font-bold text-rose-300 font-mono">{stats ? (stats.byEvent['error'] || 0) : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-stone-500">Newest</p>
              <p className="text-lg font-bold text-zinc-100 font-mono">{newestAge ?? '—'}</p>
            </div>
          </div>

          {/* Capture points */}
          <div className="bg-zinc-900 light:bg-white/30 border border-zinc-800/30 light:border-[var(--ws-border)] rounded-lg p-2.5 space-y-1">
            {(stats?.capturePoints || []).map((cp: CapturePoint) => (
              <div key={cp.source} className="flex items-center gap-2 text-[10px] text-zinc-400 light:text-stone-500 py-0.5 border-b border-zinc-800 light:border-[var(--ws-border)]/20 last:border-0">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${SOURCE_COLORS[cp.source] || ''}`}>{cp.source}</span>
                <span>{cp.where}</span>
                <span className="ml-auto shrink-0 text-[9px] text-zinc-600 light:text-stone-500">{cp.captures}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-zinc-900/50 light:bg-white border border-zinc-800/50 light:border-[var(--ws-border)] rounded px-2 py-1 w-48">
              <Search className="w-3 h-3 text-zinc-500 light:text-stone-500" />
              <input value={searchDraft} onChange={e => onSearchChange(e.target.value)}
                placeholder="Search…"
                className="bg-transparent text-[10px] text-zinc-200 outline-none w-full placeholder:text-zinc-600 light:text-stone-500" />
              {searchDraft && <button onClick={() => onSearchChange('')} className="text-zinc-500 light:text-stone-500 hover:text-zinc-300 light:text-stone-700"><X className="w-3 h-3" /></button>}
            </div>
            {SOURCES.map(s => (
              <button key={s} onClick={() => toggle(setSources, s)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${sources.has(s) ? SOURCE_COLORS[s] : 'text-zinc-600 bg-zinc-900/30 border-zinc-800/40 hover:text-zinc-400'}`}>
                {s}
              </button>
            ))}
            <span className="text-[9px] text-zinc-600 light:text-stone-500 mx-0.5">|</span>
            {EVENTS.map(e => (
              <button key={e} onClick={() => toggle(setEventsFilter, e)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${eventsFilter.has(e) ? EVENT_COLORS[e] : 'text-zinc-600 bg-zinc-900/30 border-zinc-800/40 hover:text-zinc-400'}`}>
                {e}
              </button>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-300 light:text-stone-700 bg-zinc-800 light:bg-stone-200/40 border border-zinc-700 light:border-stone-400/30 hover:bg-zinc-700 light:hover:bg-stone-200/40 transition-colors">
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
            <span className="ml-auto text-[9px] text-zinc-600 light:text-stone-500">{total.toLocaleString()} matching</span>
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setOffset(0); }}
              className="bg-zinc-900/40 border border-zinc-800/40 rounded px-1.5 py-0.5 text-[9px] text-zinc-400 light:text-stone-500 outline-none">
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
              <div className="flex items-center justify-center py-6 text-zinc-500 light:text-stone-500 text-[10px]">Loading…</div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-zinc-500 light:text-stone-500 gap-1">
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>No events yet — talk to the AI Assistant and come back.</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/30">
                {events.map(row => {
                  const isOpen = expandedId === row.id;
                  return (
                    <div key={row.id} className="hover:bg-zinc-800 light:bg-stone-200/15 transition-colors">
                      <button onClick={() => setExpandedId(isOpen ? null : row.id)}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-left">
                        {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500 light:text-stone-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 light:text-stone-500 shrink-0" />}
                        <span className="font-mono text-[10px] text-zinc-500 light:text-stone-500 w-12 shrink-0">#{row.id}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${SOURCE_COLORS[row.source] || ''}`}>{row.source}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${EVENT_COLORS[row.event] || ''}`}>{row.event}</span>
                        {row.provider && <span className="text-[10px] text-zinc-400 light:text-stone-500 truncate max-w-[100px]">{row.provider}</span>}
                        {row.model && <span className="text-[10px] text-zinc-500 light:text-stone-500 truncate max-w-[100px] hidden md:inline">{row.model}</span>}
                        <span className="ml-auto text-[9px] text-zinc-600 light:text-stone-500 font-mono shrink-0">{row.ts.slice(11, 19)}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-2 pl-10 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-zinc-500 light:text-stone-500">
                            <span className="font-mono">{row.ts}</span>
                            {row.model && <span>model: {row.model}</span>}
                            {row.feature && <span>feature: {row.feature}</span>}
                            {(row.tokensIn || row.tokensOut) && <span>tokens: {row.tokensIn}/{row.tokensOut}</span>}
                            <button onClick={e => { e.stopPropagation(); copyRow(row); }}
                              className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                              {copied === String(row.id) ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                              {copied === String(row.id) ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre className="text-[10px] leading-relaxed text-zinc-300 light:text-stone-700 bg-black/20 border border-zinc-800/30 light:border-[var(--ws-border)] rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words font-mono">
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
            <div className="flex items-center justify-between text-[10px] text-zinc-500 light:text-stone-500">
              <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
                  className="px-2 py-0.5 rounded border border-zinc-800/40 bg-zinc-900/40 text-zinc-300 light:text-stone-700 hover:bg-zinc-800 light:bg-stone-200/40 disabled:opacity-40 transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}
                  className="px-2 py-0.5 rounded border border-zinc-800/40 bg-zinc-900/40 text-zinc-300 light:text-stone-700 hover:bg-zinc-800 light:bg-stone-200/40 disabled:opacity-40 transition-colors">
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
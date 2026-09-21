import { useState, useCallback, useEffect } from 'react';
import { Settings, Cpu, ChevronDown } from 'lucide-react';
import { SESSION_CATEGORIES, SESSION_STATUS_STYLES, CategoryBadge } from './TerminalGrid';

export function ModelSwitcher({ terminalId, agent }: { terminalId: string; agent: string }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ installed: boolean; source: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const api: any = (window as any).deskflowAPI;
      const r = await api?.detectModels?.(agent);
      if (r?.success) { setModels(r.models || []); setMeta({ installed: !!r.installed, source: r.source || 'fallback' }); }
    } catch (e) {} finally { setLoading(false); }
  }, [agent]);
  useEffect(() => {
    const api: any = (window as any).deskflowAPI;
    if (!api?.onModelChanged) return;
    const unsub = api.onModelChanged((d: any) => { if (d && d.terminalId === terminalId && d.model) setCurrent(d.model); });
    return typeof unsub === 'function' ? unsub : undefined;
  }, [terminalId]);
  const pick = useCallback(async (m: string) => {
    setOpen(false);
    setCurrent(m);
    try { await (window as any).deskflowAPI?.setSessionModel?.(terminalId, m, agent); } catch (e) {}
  }, [terminalId, agent]);
  return (
    <div className="relative">
      <button
        onClick={() => { const n = !open; setOpen(n); if (n && models.length === 0) load(); }}
        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-zinc-800/70 ring-1 ring-inset ring-zinc-700 text-zinc-300 hover:ring-[color:var(--page-accent)]/50 hover:text-white transition-colors duration-150"
        title="Switch model for this session"
      >
        <Cpu className="w-3 h-3" />
        <span className="max-w-[140px] truncate">{current || 'Model'}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-1 z-50 w-56 max-h-72 overflow-auto rounded-xl bg-zinc-900 ring-1 ring-inset ring-zinc-700 shadow-none p-1">
          <div className="flex items-center justify-between px-2 py-1 text-[10px] text-zinc-500">
            <span>{loading ? 'Detecting...' : (meta ? (meta.source === 'detected' ? 'Detected' : 'Suggested') : 'Models')}</span>
            {meta && !meta.installed ? <span className="text-amber-400">CLI not found</span> : null}
          </div>
          {models.length === 0 && !loading ? (
            <div className="px-2 py-2 text-[11px] text-zinc-500">No models found</div>
          ) : null}
          {models.map((m) => (
            <button
              key={m}
              onClick={() => pick(m)}
              className={'w-full text-left px-2 py-1.5 text-[11px] rounded-md hover:bg-zinc-800 transition-colors ' + (m === current ? 'text-[color:var(--page-accent)]' : 'text-zinc-300')}
            >
              {m}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ConfigGenerator({ agent, baseDir }: { agent: string; baseDir: string }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'project' | 'global' | 'custom'>('project');
  const [customDir, setCustomDir] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const run = async () => {
    const api: any = (window as any).deskflowAPI;
    if (!api || !api.generateAgentConfigs) { setResult('Config API unavailable'); return; }
    setBusy(true); setResult(null);
    try {
      const r = await api.generateAgentConfigs({ agent: agent || 'all', scope: scope, baseDir: baseDir, customDir: customDir || undefined });
      if (r && r.success) {
        const written = (r.files || []).filter((f: any) => f.status === 'written').length;
        const skipped = (r.files || []).filter((f: any) => f.status === 'skipped').length;
        setResult('Wrote ' + written + ', skipped ' + skipped + ' -> ' + (r.root || '?'));
      } else { setResult((r && r.error) || 'Failed'); }
    } catch (e: any) { setResult(String((e && e.message) || e)); }
    setBusy(false);
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-zinc-800/70 ring-1 ring-inset ring-zinc-700 text-zinc-300 hover:ring-[color:var(--page-accent)]/50 hover:text-white transition-colors duration-150" title="Generate CLI config files (opencode.json, GEMINI.md, CLAUDE.md, codex)">
        <Settings className="w-3 h-3" />
        <span>Configs</span>
      </button>
      {open ? (
        <div className="absolute bottom-full mb-1 right-0 z-50 w-64 rounded-xl ring-1 ring-inset ring-zinc-700 bg-zinc-900 p-3 shadow-none">
          <div className="text-[11px] font-semibold text-zinc-200 mb-2">Generate CLI configs</div>
          <div className="flex flex-col gap-1 mb-2">
            {(['project', 'global', 'custom'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                <input type="radio" name="cfg-scope" checked={scope === s} onChange={() => setScope(s)} />
                <span>{s === 'project' ? 'Project (this repo)' : s === 'global' ? 'Global (home dir)' : 'Custom directory'}</span>
              </label>
            ))}
          </div>
          {scope === 'custom' ? (
            <input value={customDir} onChange={(e) => setCustomDir(e.target.value)} placeholder="/path/to/dir" className="w-full mb-2 px-2 py-1 text-[11px] rounded bg-zinc-800 border border-zinc-700 text-zinc-200" />
          ) : null}
          <button onClick={run} disabled={busy} className="w-full px-2 py-1 rounded-md text-[11px] font-semibold text-white bg-[color:var(--page-accent)] hover:opacity-90 disabled:opacity-50 transition-opacity">
            {busy ? 'Generating...' : 'Generate for ' + (agent || 'all')}
          </button>
          {result ? <div className="mt-2 text-[10px] text-zinc-400 break-words">{result}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

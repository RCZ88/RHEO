import { useState, useEffect, useCallback } from 'react';
import { Bot, Globe, Info, RefreshCw, AlertTriangle } from 'lucide-react';
import { listProviderTemplates } from '../../services/providers/templates';

// ── WHY THIS PANEL IS READ-ONLY ─────────────────────────────────────────────
// Provider configuration has exactly ONE canonical implementation:
//
//   src/services/providers/templates.ts   ← the catalogue (this file reads it)
//   src/services/providers/router.ts      ← dispatch (buildChain / runWithFallback)
//   Settings → Integrations & AI          ← the only editor, backed by
//                                            saveAiProviders / getAiProviders
//
// This panel used to carry a second, hand-maintained provider list
// (opencode/claude/gemini/codex/custom) with its own endpoint and model defaults,
// and wrote to `conductor_configs.config_type='agent_provider'`.
//
// Two facts, both verified by grep, make that a trap rather than a feature:
//   1. `agent_provider` rows are read by NOTHING outside src/main.ts:22766-22788
//      (register/list/delete). No dispatch path consults them.
//   2. `IntegrationSection.tsx` — the other provider UI — is a 67-line stub that
//      ignores all 48 of its props and renders the literal text
//      "Integration and AI settings content".
//
// So the old editor wrote secrets into a table nothing read, from a provider list
// that had drifted from the real one. It is now a read-only view: it shows what
// conductor holds, derives every label from the canonical catalogue, and tells
// you where the real configuration lives. See REPORT §4 for the two edits needed
// outside this file's slice.
interface ConductorProviderRow {
  id?: string;
  provider?: string;
  templateId?: string;
  name?: string;
  model?: string;
  isDefault?: boolean;
  capabilities?: string[];
  endpoint?: string;
  maxTokens?: number;
}

export function AgentProviderPanel() {
  const [rows, setRows] = useState<ConductorProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived from the canonical catalogue, never hand-listed here.
  const templates = listProviderTemplates();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bridge = (window as any).deskflowAPI;
      if (typeof bridge?.conductorListProviders !== 'function') {
        setError('window.deskflowAPI.conductorListProviders is missing — the preload bridge predates conductor provider config.');
        setLoading(false);
        return;
      }
      const r = await bridge.conductorListProviders();
      // Branch on the payload: the handlers return {success:false}, they do not throw.
      if (r?.success) {
        setRows(Array.isArray(r.data) ? r.data : []);
        setError(null);
      } else {
        setRows([]);
        setError(r?.error || 'conductor:list-providers reported failure with no message');
      }
    } catch (e: any) {
      setRows([]);
      setError(e?.message || String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const labelFor = (r: ConductorProviderRow) => {
    const tid = r.templateId || r.provider || '';
    return templates.find((t) => t.id === tid)?.label || (tid || r.name || 'unknown');
  };

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 min-w-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">AI Providers</h3>
        <button
          onClick={load}
          title="Reload"
          aria-label="Reload providers"
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-lg bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/60 p-2.5 flex items-start gap-2 min-w-0">
        <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-zinc-500 leading-relaxed min-w-0">
          Read-only. Provider credentials, models, endpoints and budgets are configured in
          {' '}<span className="text-zinc-300">Settings → Integrations &amp; AI</span>, which is backed by the
          canonical catalogue in <span className="font-mono text-zinc-400">src/services/providers/templates.ts</span>.
          This list shows what Conductor currently holds.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 flex items-start gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-red-300 font-mono break-words whitespace-pre-wrap">{error}</p>
            <button onClick={load} className="mt-1.5 text-[11px] text-red-200 underline underline-offset-2">Retry</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-zinc-500 py-3 text-center">Loading providers…</p>
      ) : rows.length === 0 && !error ? (
        <div className="rounded-xl bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/60 p-4 text-center">
          <Globe className="w-4 h-4 text-zinc-600 mx-auto mb-2" />
          <p className="text-[11px] text-zinc-400">No Conductor provider overrides</p>
          <p className="text-[10px] text-zinc-500 mt-1 max-w-[320px] mx-auto">
            Conductor is using the app-wide provider routing. Add or change providers in
            Settings → Integrations &amp; AI.
          </p>
        </div>
      ) : (
        rows.map((p, i) => (
          <div
            key={p.id || `${p.provider}-${i}`}
            className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-3 min-w-0"
          >
            <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className={`w-4 h-4 shrink-0 ${p.isDefault ? 'text-rose-400' : 'text-zinc-500'}`} />
                <span className="text-xs font-medium text-zinc-200 truncate">{p.name || labelFor(p)}</span>
                {p.isDefault && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-medium shrink-0">
                    Default
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 font-mono shrink-0 truncate max-w-[45%]">
                {p.templateId || p.provider || '—'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 flex-wrap">
              {p.model && <span className="truncate">{p.model}</span>}
              {typeof p.maxTokens === 'number' && <span>{p.maxTokens.toLocaleString()} tokens</span>}
              {p.endpoint && <span className="truncate break-all">{p.endpoint}</span>}
            </div>
            {p.capabilities?.length ? (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {p.capabilities.map((c: string) => (
                  <span key={c} className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-[10px] text-zinc-400">{c}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
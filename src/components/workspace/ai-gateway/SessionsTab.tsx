// AI Gateway — SessionsTab: session validity + recent run history.
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Globe } from 'lucide-react';
import { WorkspaceSection, WorkspaceCard } from '../_ds/containers';
import { EmptyState } from '../_ds/primitives';
import { gatewayApi, coerceAdapters, coerceRuns, type GatewayAdapterInfo, type GatewayRunRecord } from './gatewayApi';

function fmtTime(iso: string | null): string {
  if (!iso) return 'never';
  // SQLite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC with no timezone
  // marker; Date parses that as LOCAL time on some engines, so normalise it.
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(iso);
  const d = m ? new Date(`${m[1]}T${m[2]}Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function SessionsTab({ providerId, onProviderChange }: {
  providerId: string;
  onProviderChange: (id: string) => void;
}) {
  const [adapters, setAdapters] = useState<GatewayAdapterInfo[]>([]);
  const [runs, setRuns] = useState<GatewayRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);

  const load = useCallback(async (pid: string) => {
    setLoading(true);
    const [a, r] = await Promise.all([
      gatewayApi.listProviders(),
      gatewayApi.recentRuns(pid, 20),
    ]);
    if (a.success) {
      setAdapters(coerceAdapters(a.data));
      setListError(null);
    } else {
      setListError(a.error || `${a.channel} returned an unusable payload`);
    }
    // aigateway:recent-runs returns a BARE ARRAY (main.ts:7859-7861). The old
    // `if (r.success) setRuns(...)` therefore NEVER ran and this tab was stuck on
    // "No runs yet" for the life of the app, rows or no rows.
    if (r.success) {
      setRuns(coerceRuns(r.data));
      setRunsError(null);
    } else {
      setRunsError(r.error || `${r.channel} returned an unusable payload`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(providerId); }, [load, providerId]);

  const adapter = adapters.find((x) => x.id === providerId) || adapters[0];
  const effId = adapter?.id || providerId;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <WorkspaceSection
        title="Runs"
        action={
          <button onClick={() => load(effId)} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      >
        <select
          value={effId}
          onChange={(e) => onProviderChange(e.target.value)}
          disabled={adapters.length === 0}
          aria-label="Provider"
          className="w-full min-w-0 mb-2 bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 disabled:opacity-50"
        >
          {adapters.length === 0
            ? <option value="">Loading providers…</option>
            : adapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        {listError ? (
          <p className="text-[11px] text-red-300 font-mono break-words whitespace-pre-wrap py-2">{listError}</p>
        ) : runsError ? (
          <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 p-3">
            <p className="text-[11px] text-amber-200 font-mono break-words whitespace-pre-wrap">{runsError}</p>
            <button onClick={() => load(effId)} className="mt-1.5 text-[11px] text-amber-100 underline underline-offset-2">Retry</button>
          </div>
        ) : loading ? (
          <p className="text-[11px] text-zinc-500 py-4 text-center">Loading runs…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={<Globe className="w-5 h-5" />}
            title="No runs yet"
            hint="Send a prompt from the Chat tab to see history here."
          />
        ) : (
          <div className="flex flex-col gap-1.5 min-w-0">
            {runs.map((r) => (
              <WorkspaceCard key={r.id} variant="default" className="!p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {r.status === 'ok'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <span className="text-[11px] text-zinc-300 truncate">
                    {r.prompt_len} → {r.response_len} chars
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono ml-auto shrink-0">
                    {(r.duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500 min-w-0">
                  <span className="shrink-0">{fmtTime(r.created_at)}</span>
                  {r.detection_strategy && <span className="truncate">· {r.detection_strategy.replace(/_/g, ' ')}</span>}
                  {r.error && <span className="text-red-300/90 truncate">· {r.error}</span>}
                </div>
              </WorkspaceCard>
            ))}
          </div>
        )}
      </WorkspaceSection>
    </div>
  );
}
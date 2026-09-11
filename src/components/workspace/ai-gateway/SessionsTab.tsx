// AI Gateway — SessionsTab: session validity + recent run history.
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { WorkspaceSection, WorkspaceCard } from '../_ds/containers';
import { EmptyState } from '../_ds/primitives';
import { gatewayApi, type GatewayAdapterInfo, type GatewayRunRecord } from './gatewayApi';

function fmtTime(iso: string | null): string {
  if (!iso) return 'never';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function SessionsTab({ providerId, onProviderChange }: {
  providerId: string;
  onProviderChange: (id: string) => void;
}) {
  const [adapters, setAdapters] = useState<GatewayAdapterInfo[]>([]);
  const [runs, setRuns] = useState<GatewayRunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (pid: string) => {
    setLoading(true);
    const [a, r] = await Promise.all([
      gatewayApi.listProviders(),
      gatewayApi.recentRuns(pid, 20),
    ]);
    if (a.success) setAdapters(a.data || []);
    if (r.success) setRuns(r.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(providerId); }, [load, providerId]);

  const adapter = adapters.find((x) => x.id === providerId) || adapters[0];
  const effId = adapter?.id || providerId;

  return (
    <div className="flex flex-col gap-3">
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
          className="w-full mb-2 bg-zinc-950 border border-zinc-800/70 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        >
          {adapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        {loading ? (
          <p className="text-[11px] text-zinc-500 py-4 text-center">Loading runs…</p>
        ) : runs.length === 0 ? (
          <EmptyState title="No runs yet" hint="Send a prompt from the Chat tab to see history here." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {runs.map((r) => (
              <WorkspaceCard key={r.id} variant="default" className="!p-2.5">
                <div className="flex items-center gap-2">
                  {r.status === 'ok'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <span className="text-[11px] text-zinc-300">
                    {r.prompt_len} → {r.response_len} chars
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                    {(r.duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                  <span>{fmtTime(r.created_at)}</span>
                  {r.detection_strategy && <span>· {r.detection_strategy.replace('_', ' ')}</span>}
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

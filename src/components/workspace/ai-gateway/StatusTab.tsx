// AI Gateway — StatusTab: fleet dashboard (all providers, playwright state).
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { WorkspaceSection } from '../_ds/containers';
import { EmptyState, Skeleton } from '../_ds/primitives';
import { listContainer, riseItem } from '../_ds/motion';
import { gatewayApi, type GatewayAdapterInfo, type GatewayStatusReport } from './gatewayApi';
import { ProviderCard } from './ProviderCard';

export function StatusTab({ onSelectProvider }: { onSelectProvider: (id: string) => void }) {
  const [adapters, setAdapters] = useState<GatewayAdapterInfo[]>([]);
  const [reports, setReports] = useState<Record<string, GatewayStatusReport>>({});
  const [pw, setPw] = useState<{ available: boolean; error: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [a, s, p] = await Promise.all([
      gatewayApi.listProviders(),
      gatewayApi.allStatuses(),
      gatewayApi.playwrightStatus(),
    ]);
    if (!a.success) { setError(a.error || 'Failed to load providers'); setLoading(false); return; }
    setAdapters(a.data || []);
    const map: Record<string, GatewayStatusReport> = {};
    for (const r of s.data || []) map[r.provider] = r;
    setReports(map);
    if (p.success && p.data) setPw(p.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const off1 = gatewayApi.onProviderStatus(() => refresh());
    const off2 = gatewayApi.onSessionExpired(() => refresh());
    return () => { try { off1(); } catch {} try { off2(); } catch {} };
  }, [refresh]);

  if (loading) {
    return (
      <WorkspaceSection title="Provider status">
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
        </div>
      </WorkspaceSection>
    );
  }

  if (error) {
    return (
      <WorkspaceSection title="Provider status">
        <div className="rounded-xl bg-red-500/10 ring-1 ring-red-500/20 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[11px] text-red-300">{error}</p>
            <button onClick={refresh} className="mt-1.5 text-[11px] text-red-200 underline underline-offset-2">Retry</button>
          </div>
        </div>
      </WorkspaceSection>
    );
  }

  if (adapters.length === 0) {
    return (
      <WorkspaceSection title="Provider status">
        <EmptyState title="No providers configured" hint="The gateway service did not return any provider adapters." />
      </WorkspaceSection>
    );
  }

  const ready = Object.values(reports).filter((r) => r.status === 'ready').length;

  return (
    <div className="flex flex-col gap-3">
      {pw && !pw.available && (
        <div className="rounded-xl bg-orange-500/10 ring-1 ring-orange-500/20 p-3 flex items-start gap-2">
          <WifiOff className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-orange-200">
            Browser automation unavailable{pw.error ? `: ${pw.error}` : ''}. Chat and Setup need
            the <span className="font-mono">playwright</span> package plus a browser.
            The External AI Bridge (format-only prompts) still works from other tabs.
          </p>
        </div>
      )}
      <WorkspaceSection
        title={`Providers · ${ready}/${adapters.length} ready`}
        action={
          <button onClick={refresh} className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300" title="Refresh statuses">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      >
        <motion.div variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-2">
          {adapters.map((a) => (
            <motion.div key={a.id} variants={riseItem}>
              <ProviderCard adapter={a} report={reports[a.id]} onSelect={() => onSelectProvider(a.id)} />
            </motion.div>
          ))}
        </motion.div>
      </WorkspaceSection>
    </div>
  );
}

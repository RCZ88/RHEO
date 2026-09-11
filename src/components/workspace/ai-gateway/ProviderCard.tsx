// AI Gateway — ProviderCard: per-provider health card (workspace _ds styling).
import { Globe, CheckCircle2, AlertTriangle, Clock, Ban, WifiOff, Loader2 } from 'lucide-react';
import { WorkspaceCard } from '../_ds/containers';
import type { GatewayStatusReport, GatewayAdapterInfo } from './gatewayApi';

const STATUS_META: Record<string, { cls: string; dot: string; label: string }> = {
  ready:          { cls: 'text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30', dot: 'bg-emerald-500', label: 'Ready' },
  needs_setup:    { cls: 'text-zinc-300 bg-zinc-500/15 ring-1 ring-zinc-500/30', dot: 'bg-zinc-500', label: 'Needs setup' },
  authenticating: { cls: 'text-cyan-300 bg-cyan-500/15 ring-1 ring-cyan-500/30', dot: 'bg-cyan-500 animate-pulse', label: 'Working' },
  rate_limited:   { cls: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30', dot: 'bg-amber-500', label: 'Rate limited' },
  error:          { cls: 'text-red-300 bg-red-500/15 ring-1 ring-red-500/30', dot: 'bg-red-500', label: 'Error' },
  disabled:       { cls: 'text-zinc-500 bg-zinc-800/60 ring-1 ring-zinc-700/50', dot: 'bg-zinc-600', label: 'Disabled' },
  unavailable:    { cls: 'text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/30', dot: 'bg-orange-500', label: 'Unavailable' },
};

export function statusMeta(status: string) {
  return STATUS_META[status] || STATUS_META.needs_setup;
}

export function ProviderCard({
  adapter, report, selected, onSelect,
}: {
  adapter: GatewayAdapterInfo;
  report?: GatewayStatusReport;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const meta = statusMeta(report?.status || 'needs_setup');
  const Icon =
    report?.status === 'ready' ? CheckCircle2 :
    report?.status === 'error' ? AlertTriangle :
    report?.status === 'disabled' ? Ban :
    report?.status === 'unavailable' ? WifiOff :
    report?.status === 'authenticating' ? Loader2 :
    report?.status === 'needs_setup' ? Clock : Globe;

  return (
    <WorkspaceCard
      variant="default"
      accent={selected ? 'cyan' : undefined}
      className={`!p-0 overflow-hidden transition-all duration-150 ${selected ? 'ring-1 ring-cyan-500/40' : ''}`}
    >
      <button onClick={onSelect} className="w-full text-left p-3" disabled={!onSelect}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
            <span className="text-[12px] font-medium text-zinc-200">{adapter.name}</span>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.cls}`}>
            <Icon className={`w-3 h-3 ${report?.status === 'authenticating' ? 'animate-spin' : ''}`} />
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="font-mono">{adapter.id}</span>
          {report?.browserRunning && <span className="text-cyan-400">· window open</span>}
          {report?.requestsRemaining != null && <span>· {report.requestsRemaining} left today</span>}
          {report?.queueDepth ? <span className="text-amber-300">· {report.queueDepth} queued</span> : null}
        </div>
        {report?.lastError && (
          <p className="text-[10px] text-red-300/90 mt-1.5 line-clamp-2">{report.lastError}</p>
        )}
      </button>
    </WorkspaceCard>
  );
}

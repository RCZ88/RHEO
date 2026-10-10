import { useState, useEffect } from 'react';
import { Coins, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';

export function BudgetDashboard({ missionId }: { missionId: string }) {
  const [budget, setBudget] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    if (!missionId) return;
    (window as any).deskflowAPI?.conductorGetBudget?.(missionId).then((r: any) => {
      if (r?.success) setBudget(r.data);
    });
    (window as any).deskflowAPI?.conductorGetMetrics?.(missionId).then((r: any) => {
      if (r?.success) setMetrics(r.data || []);
    });
  }, [missionId]);

  if (!missionId) return <p className="text-xs text-zinc-500 py-8 text-center">Select a mission to view budget</p>;
  if (!budget) return <p className="text-xs text-zinc-500 py-8 text-center">Loading budget...</p>;

  const tokenPct = budget.totalTokens > 0 ? (budget.usedTokens / budget.totalTokens) * 100 : 0;
  const costPct = budget.totalCost > 0 ? (budget.usedCost / budget.totalCost) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Budget</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500 uppercase">Tokens</span>
            <span className={`text-[10px] font-medium ${tokenPct > 90 ? 'text-red-400' : tokenPct > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>{tokenPct.toFixed(1)}%</span>
          </div>
          <p className="text-lg font-semibold text-zinc-100">{(budget.usedTokens || 0).toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500">of {(budget.totalTokens || 0).toLocaleString()}</p>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
            <div className={`h-full rounded-full transition-all ${tokenPct > 90 ? 'bg-red-500' : tokenPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(tokenPct, 100)}%` }} />
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500 uppercase">Cost</span>
            <span className={`text-[10px] font-medium ${costPct > 90 ? 'text-red-400' : costPct > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>{costPct.toFixed(1)}%</span>
          </div>
          <p className="text-lg font-semibold text-zinc-100">${(budget.usedCost || 0).toFixed(2)}</p>
          <p className="text-[10px] text-zinc-500">of ${(budget.totalCost || 0).toFixed(2)}</p>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
            <div className={`h-full rounded-full transition-all ${costPct > 90 ? 'bg-red-500' : costPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(costPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {budget.alerts?.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 ring-1 ring-inset ring-amber-500/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-200">Budget Alerts</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {budget.alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center gap-2 text-[11px] text-amber-300/80">
                <span className={`w-1.5 h-1.5 rounded-full ${alert.type === 'exceeded' ? 'bg-red-500' : alert.type === 'critical' ? 'bg-amber-500' : 'bg-yellow-500'}`} />
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-300">Per-Agent Breakdown</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {metrics.length === 0 && <p className="text-[10px] text-zinc-500">No agent metrics yet</p>}
          {metrics.map((m) => (
            <div key={m.nodeId} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface)]/50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.role === 'director' ? '#8b5cf6' : m.role === 'worker' ? '#22d3ee' : '#71717a' }} />
                <span className="text-[11px] text-zinc-300">{m.role}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500">{(m.tokensUsed || 0).toLocaleString()} tok</span>
                <span className="text-[10px] text-zinc-500">${(m.cost || 0).toFixed(2)}</span>
                <span className="text-[10px] text-zinc-500">{(m.successRate || 0).toFixed(0)}% success</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

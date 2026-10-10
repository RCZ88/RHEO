import { useState } from 'react';
import { Save, Shield, Zap, GitMerge, Clock } from 'lucide-react';

export function ConductorConfigPanel() {
  const [config, setConfig] = useState({
    autoAuditInterval: 30,
    mergeStrategy: 'sequential',
    conflictResolution: 'auto-resolver',
    maxConcurrentAgents: 5,
    timeoutDefaultMin: 30,
    retryPolicy: 'exponential',
    notifyOnComplete: true,
    defaultBudgetTokens: 1000000,
    defaultBudgetCost: 50.0,
    defaultAutonomy: 3,
  });

  const saveConfig = async () => {
    await (window as any).deskflowAPI?.conductorSaveConfig?.('conductor_defaults', 'global', config);
  };

  return (
    <div className="flex flex-col gap-3 p-3 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Conductor Settings</h3>
        <button onClick={saveConfig} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[11px] font-medium hover:bg-rose-500/25">
          <Save className="w-3 h-3" /> Save
        </button>
      </div>

      <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-4">
        <h4 className="text-xs font-medium text-zinc-300 mb-3 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Behavior
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Auto-Audit Interval</label>
            <div className="flex items-center gap-2">
              <input type="number" value={config.autoAuditInterval} onChange={e => setConfig({ ...config, autoAuditInterval: Number(e.target.value) })} className="w-20 bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
              <span className="text-[10px] text-zinc-500">seconds</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Max Concurrent Agents</label>
            <input type="number" value={config.maxConcurrentAgents} onChange={e => setConfig({ ...config, maxConcurrentAgents: Number(e.target.value) })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Merge Strategy</label>
            <select value={config.mergeStrategy} onChange={e => setConfig({ ...config, mergeStrategy: e.target.value })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40">
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
              <option value="smart">Smart (Auto)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Conflict Resolution</label>
            <select value={config.conflictResolution} onChange={e => setConfig({ ...config, conflictResolution: e.target.value })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40">
              <option value="manual">Manual</option>
              <option value="auto-resolver">Auto-Resolver</option>
              <option value="abort">Abort Mission</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 p-4">
        <h4 className="text-xs font-medium text-zinc-300 mb-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" /> Defaults
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Default Budget (tokens)</label>
            <input type="number" value={config.defaultBudgetTokens} onChange={e => setConfig({ ...config, defaultBudgetTokens: Number(e.target.value) })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Default Budget ($)</label>
            <input type="number" step="0.5" value={config.defaultBudgetCost} onChange={e => setConfig({ ...config, defaultBudgetCost: Number(e.target.value) })} className="w-full bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Default Autonomy</label>
            <input type="range" min={1} max={5} value={config.defaultAutonomy} onChange={e => setConfig({ ...config, defaultAutonomy: Number(e.target.value) })} className="w-full" />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
              <span>Strict</span>
              <span>{config.defaultAutonomy}/5</span>
              <span>Full</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase mb-1 block">Timeout</label>
            <div className="flex items-center gap-2">
              <input type="number" value={config.timeoutDefaultMin} onChange={e => setConfig({ ...config, timeoutDefaultMin: Number(e.target.value) })} className="w-20 bg-zinc-950 light:bg-[var(--ws-surface)] border border-zinc-800/70 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
              <span className="text-[10px] text-zinc-500">min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

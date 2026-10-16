import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Cpu, HardDrive, Gauge, Server, Terminal, MonitorDot } from 'lucide-react';
import { motion } from 'framer-motion';
import { WorkspaceCard, WorkspaceSection } from './_ds/containers';
import { listContainer, riseItem, DUR, EASE_OUT } from './_ds/motion';
import { Skeleton } from './_ds/primitives';

interface SystemStats {
  totalMemMB: number;
  freeMemMB: number;
  usedMemMB: number;
  /** 0-100 already. Do NOT multiply by 100 when rendering. */
  memPct: number;
  /** total - MemAvailable, i.e. memory actually unavailable to new allocations. */
  availableMemMB?: number;
  swapTotalMB?: number;
  swapUsedMB?: number;
  swapUsedPct?: number;
  cpuCount: number;
  cpuModel: string;
  uptime: number;
  platform: string;
  arch: string;
  gpuName?: string;
  gpuMemMB?: number;
}

interface TerminalResourceStats {
  pid: number | null;
  alive: boolean;
  /**
   * RSS summed over the process tree, MB. This is NOT the machine's real cost:
   * pages shared between the CLI and its children are counted once per sharer.
   * `pssMB` is the additive-correct number.
   */
  memMB: number;
  /** Sum of per-process PSS over the tree, MB. Prefer this. null = not measured yet. */
  pssMB: number | null;
  /** Per-process swap over the tree, MB. null = not measured yet. */
  swapMB: number | null;
  /** Percent of ONE CPU core, a true inter-sample rate. Not percent of the machine. */
  cpuPct: number;
  cpuUserPct: number | null;
  cpuSysPct: number | null;
  processCount: number;
  threadCount: number;
  /** active | idle | shell_exited | orphaned | unattributed | terminated */
  state: string;
  eventLoopLagMs: number;
  ts: number;
}

/** Clamp any percentage to 0-100 so a bad upstream value cannot render "9312%". */
function clampPct(n: number | null | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>; label: string;
  value: string; sub?: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };
  const cls = colorMap[color] || colorMap.cyan;

  return (
    <motion.div variants={riseItem}>
      <WorkspaceCard variant="inset" className="h-full">
        <div className="flex items-center gap-2 mb-2">
          <div className={`grid w-6 h-6 place-items-center rounded-md ${cls}`}>
            <Icon className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-lg font-semibold text-zinc-100 tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{sub}</p>}
      </WorkspaceCard>
    </motion.div>
  );
}

/**
 * Per-workspace row.
 *
 * Column meanings, stated in the header rather than implied:
 *   CPU  - percent of ONE core over the sampling interval (a rate, not a
 *          lifetime average; may exceed 100% on a multi-threaded CLI)
 *   PSS  - additive-correct memory attribution for the whole tree
 *   RSS  - sum of resident sets, which double-counts shared pages
 *   /S   - swap held by the tree
 */
function TerminalRow({ id, stats }: { id: string; stats: TerminalResourceStats }) {
  const formatMem = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  const laggy = (stats.eventLoopLagMs || 0) > 100;
  // `alive` means "not terminated". A workspace whose shell exited but whose
  // descendants survive is still holding memory and must not look like a dead
  // grey dot next to a 0.
  const isShellGone = stats.state === 'shell_exited' || stats.state === 'orphaned' || stats.state === 'unattributed';
  const dot = stats.state === 'terminated' ? 'bg-zinc-600'
    : isShellGone ? 'bg-amber-500'
    : stats.alive ? 'bg-emerald-500' : 'bg-zinc-600';
  const hasPss = typeof stats.pssMB === 'number';

  return (
    <motion.div variants={riseItem} className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-950 light:bg-[var(--ws-surface-50)] hover:bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] transition-colors duration-150">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} title={stats.state || undefined} />
        <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[140px]">{id}</span>
        {stats.processCount > 0 && (
          <span className="text-[9px] text-zinc-600 tabular-nums font-mono shrink-0" title="processes / threads">
            {stats.processCount}p/{stats.threadCount}t
          </span>
        )}
        {isShellGone && (
          <span className="text-[9px] text-amber-400/90 shrink-0" title="The PTY shell exited but surviving processes were re-attributed and are still charged here.">
            shell gone
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-cyan-300 tabular-nums font-mono" title="percent of ONE cpu core">
          {(stats.cpuPct ?? 0).toFixed(1)}%
        </span>
        <span className="text-[10px] text-emerald-300 tabular-nums font-mono" title={hasPss ? 'Workspace PSS - shared pages divided among sharers' : 'PSS not measured yet'}>
          {hasPss ? formatMem(stats.pssMB as number) : '—'}
        </span>
        <span className="text-[10px] text-zinc-500 tabular-nums font-mono" title="RSS sum - overstates when pages are shared">
          {formatMem(stats.memMB || 0)}
        </span>
        {typeof stats.swapMB === 'number' && stats.swapMB > 0 && (
          <span className="text-[10px] text-rose-300/90 tabular-nums font-mono" title="Swap held by this process tree">
            {formatMem(stats.swapMB)}/S
          </span>
        )}
        <span className={`text-[10px] tabular-nums font-mono ${laggy ? 'text-rose-300' : 'text-zinc-500'}`} title="DeskFlow main-process event-loop lag (not this workspace)">
          {stats.eventLoopLagMs || 0}ms
        </span>
      </div>
    </motion.div>
  );
}

export default function PerformanceMetricsPanel({ projectId, projectPath }: { projectId?: string; projectPath?: string }) {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [terminalStats, setTerminalStats] = useState<Record<string, TerminalResourceStats>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchSystemStats = useCallback(async () => {
    if (!window.deskflowAPI?.getSystemStats) return;
    const result = await (window.deskflowAPI as any).getSystemStats();
    if (result?.success && result.data) {
      setSystemStats(result.data);
    }
  }, []);

  useEffect(() => {
    fetchSystemStats();
    intervalRef.current = setInterval(fetchSystemStats, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchSystemStats]);

  useEffect(() => {
    if (!window.deskflowAPI?.onResourceStats) return;
    const unsub = window.deskflowAPI.onResourceStats((stats: any) => {
      setTerminalStats(stats || {});
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatMem = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  const terminalEntries = Object.entries(terminalStats);
  const totalCpu = terminalEntries.reduce((sum, [, s]) => sum + (s.cpuPct || 0), 0);
  const totalMem = terminalEntries.reduce((sum, [, s]) => sum + (s.memMB || 0), 0);
  // PSS is additive-correct across every process, so it is the number to trust.
  // Falling back to RSS only when no workspace has a PSS sample yet.
  const pssValues = terminalEntries.map(([, s]) => s.pssMB).filter((v): v is number => typeof v === 'number');
  const totalPss = pssValues.length ? pssValues.reduce((a, b) => a + b, 0) : totalMem;
  const aliveCount = terminalEntries.filter(([, s]) => s.alive).length;

  return (
    <div className="flex flex-col gap-4 p-3 min-h-0 overflow-y-auto ws-scroll">
      <WorkspaceSection title="System Performance" icon={Activity} accent="purple">
        {systemStats ? (
          <motion.div
            className="grid grid-cols-2 gap-2"
            variants={listContainer} initial="hidden" animate="show"
          >
            <StatCard icon={Cpu} label="CPU" value={`${systemStats.cpuCount} cores`} sub={systemStats.cpuModel} color="cyan" />
            {/* memPct already arrives as a 0-100 number from `terminal:get-system-stats`
                (main.ts rounds `((total-free)/total)*100`). Multiplying by 100 here
                rendered values like "9312%". Do not scale it again. */}
            <StatCard icon={HardDrive} label="System RAM" value={formatMem(systemStats.usedMemMB)} sub={`${Math.round(clampPct(systemStats.memPct))}% used · MemAvailable ${formatMem(systemStats.availableMemMB ?? 0)}`} color="emerald" />
            <StatCard icon={HardDrive} label="System Swap" value={formatMem(systemStats.swapUsedMB ?? 0)} sub={systemStats.swapTotalMB ? `${clampPct(systemStats.swapUsedPct).toFixed(0)}% of ${formatMem(systemStats.swapTotalMB)} used` : 'not reported'} color={systemStats.swapUsedPct >= 90 ? 'rose' : 'amber'} />
            <StatCard icon={MonitorDot} label="GPU" value={systemStats.gpuName || 'Unknown'} sub={systemStats.gpuMemMB ? `${systemStats.gpuMemMB} MB VRAM` : 'Detection unavailable'} color="blue" />
            <StatCard icon={Gauge} label="Workspaces" value={`${totalCpu.toFixed(1)}% of one core`} sub={`${aliveCount}/${terminalEntries.length} live · ${formatMem(totalMem)} RSS sum (${formatMem(totalPss)} PSS)`} color="rose" />
            <div className="col-span-2">
              <StatCard icon={Server} label="Platform" value={systemStats.platform} sub={`${systemStats.arch} · Up ${formatUptime(systemStats.uptime)}`} color="amber" />
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}
      </WorkspaceSection>

      <WorkspaceSection title="Per-Terminal Resources" icon={Terminal} accent="purple">
        {terminalEntries.length === 0 ? (
          <p className="text-[11px] text-zinc-500 py-6 text-center">No terminal resource data available</p>
        ) : (
          <motion.div
            className="flex flex-col gap-1"
            variants={listContainer} initial="hidden" animate="show"
          >
            {terminalEntries.map(([id, stats]) => (
              <TerminalRow key={id} id={id} stats={stats} />
            ))}
          </motion.div>
        )}
      </WorkspaceSection>
    </div>
  );
}

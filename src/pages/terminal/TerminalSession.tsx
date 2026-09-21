import { SESSION_STATUS_STYLES } from './TerminalGrid';

export function SessionResourceStats({ stats }: { stats?: { pid: number | null; alive: boolean; memMB: number; cpuPct: number; eventLoopLagMs: number; ts: number } }) {
  if (!stats || !stats.alive) return null;
  const laggy = stats.eventLoopLagMs > 200 || stats.cpuPct > 90;
  const warm = !laggy && (stats.cpuPct > 60 || stats.memMB > 1500);
  const healthColor = laggy ? 'text-red-400' : warm ? 'text-amber-400' : 'text-emerald-400';
  const dotColor = laggy ? 'bg-red-500' : warm ? 'bg-amber-500' : 'bg-emerald-500';
  const memLabel = stats.memMB >= 1024 ? (stats.memMB / 1024).toFixed(1) + ' GB' : Math.round(stats.memMB) + ' MB';
  return (
    <div className="flex items-center gap-2 mt-1" title={'PID ' + (stats.pid != null ? stats.pid : '?') + '  |  event-loop lag ' + Math.round(stats.eventLoopLagMs) + 'ms'}>
      <span className={'flex items-center gap-1 text-[10px] font-medium ' + healthColor}>
        <span className={'w-1.5 h-1.5 rounded-full ' + dotColor + (laggy ? ' animate-pulse' : '')} />
        {laggy ? 'Laggy' : warm ? 'Busy' : 'Smooth'}
      </span>
      <span className="text-[10px] text-zinc-500 font-mono">{Math.round(stats.cpuPct)}% CPU</span>
      <span className="text-[10px] text-zinc-500 font-mono">{memLabel}</span>
    </div>
  );
}

// RHEO Dashboard — Console Widget
// 4×2 widget showing terminal stats from /penguin-console
// LAMINAR: solid token surface, hairline, radius 10
import { Terminal, Hash, CheckCircle2, BookOpen } from 'lucide-react';
import { WidgetJumpButton } from './WidgetJumpButton';

interface ConsoleWidgetProps {
  stats?: {
    commandCount: number;
    activeSessions: number;
    handbookCompleted: number;
    handbookTotal: number;
  };
  loading?: boolean;
  error?: string | null;
}

export function ConsoleWidget({ stats, loading, error }: ConsoleWidgetProps) {
  const commandCount = stats?.commandCount ?? 0;
  const activeSessions = stats?.activeSessions ?? 0;
  const handbookCompleted = stats?.handbookCompleted ?? 0;
  const handbookTotal = stats?.handbookTotal ?? 0;
  const handbookPct = handbookTotal > 0 ? Math.round((handbookCompleted / handbookTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-zinc-800" />
          <div className="h-10 rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Terminal size={14} />
          <span>Console</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[12px] text-zinc-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full relative">
      <div className="absolute top-0 left-[2px] right-[2px] h-[1px] -z-10 bg-gradient-to-r from-white/[0.06] via-white/[0.02] to-transparent rounded-t-lg" />
      <div className="absolute inset-0 -z-10 rounded-lg pointer-events-none" style={{
        boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 -1px 0 0 rgba(0,0,0,0.2)',
      }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Terminal size={14} className="text-cyan-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">Console</span>
        </div>
        <WidgetJumpButton widgetId="console-widget" iconOnly />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Commands</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{commandCount.toLocaleString()}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Active</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{activeSessions}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Handbook</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{handbookPct}%</div>
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--ws-border)]">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={10} className="text-cyan-400" />
          <span className="text-[10px] text-zinc-500">Handbook progress</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-cyan-500/60 rounded-full transition-colors duration-500" style={{ width: `${handbookPct}%` }} />
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5 text-right">{handbookCompleted}/{handbookTotal} sections</div>
      </div>
    </div>
  );
}

// RHEO Dashboard — Covenant Widget
// 3×2 widget showing CovenantPage stats
// LAMINAR: solid token surface, hairline, radius 10
import { motion } from 'motion/react';
import { Shield, CheckCircle2, Clock, Target } from 'lucide-react';
import { WidgetJumpButton } from './WidgetJumpButton';

interface CovenantWidgetProps {
  stats?: {
    active: number;
    completionPercent: number;
    nextDue: string | null;
  };
  loading?: boolean;
  error?: string | null;
}

export function CovenantWidget({ stats, loading, error }: CovenantWidgetProps) {
  const active = stats?.active ?? 0;
  const completionPercent = stats?.completionPercent ?? 0;
  const nextDue = stats?.nextDue ?? null;

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Shield size={14} />
          <span>Covenant</span>
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
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Shield size={14} className="text-rose-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">Covenant</span>
        </div>
        <WidgetJumpButton widgetId="covenant-widget" iconOnly />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Active</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{active}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Complete</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">{completionPercent}%</div>
        </div>
        <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Next Due</div>
          <div className="text-[18px] font-display font-bold text-zinc-100 tabular-nums">
            {nextDue ? new Date(nextDue).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--ws-border)]">
        <div className="flex items-center gap-2 mb-1">
          <Target size={10} className="text-rose-400" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Progress</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-rose-500/60 rounded-full" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

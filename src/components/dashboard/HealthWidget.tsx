// RHEO Dashboard — Health Widget
// 6×2 widget showing sleep/health stats
// LAMINAR: solid token surface, hairline, radius 10
import { motion } from 'motion/react';
import { Moon, Droplets, Heart, Wind, Activity } from 'lucide-react';
import { WidgetJumpButton } from './WidgetJumpButton';

interface HealthWidgetProps {
  stats?: {
    lastNightHours: number;
    consistencyPercent: number;
    gapCount: number;
    hoursData: number[];
    stepGoal: number;
    stepsToday: number;
    restingHeartRate: number;
  };
  loading?: boolean;
  error?: string | null;
}

export function HealthWidget({ stats, loading, error }: HealthWidgetProps) {
  const lastNightHours = stats?.lastNightHours ?? 0;
  const consistencyPercent = stats?.consistencyPercent ?? 0;
  const gapCount = stats?.gapCount ?? 0;
  const hoursData = stats?.hoursData ?? [];
  const stepGoal = stats?.stepGoal ?? 8000;
  const stepsToday = stats?.stepsToday ?? 0;
  const restingHeartRate = stats?.restingHeartRate ?? 70;

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-zinc-800" />
          <div className="h-10 rounded bg-zinc-800" />
        </div>
        <div className="h-16 rounded bg-zinc-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--ws-border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center gap-2 text-[13px] text-zinc-400">
          <Moon size={14} />
          <span>Health</span>
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
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <Moon size={14} className="text-sky-400" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200">Health</span>
        </div>
        <WidgetJumpButton widgetId="health-widget" iconOnly />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets size={12} className="text-sky-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Night</span>
            </div>
            <div className="text-[20px] font-display font-bold text-zinc-100 tabular-nums">
              {lastNightHours.toFixed(1)} <span className="text-[11px] text-zinc-500">hrs</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Heart size={12} className="text-rose-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Resting HR</span>
            </div>
            <div className="text-[20px] font-display font-bold text-zinc-100 tabular-nums">
              {restingHeartRate} <span className="text-[11px] text-zinc-500">bpm</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-emerald-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Gaps</span>
            </div>
            <div className="text-[20px] font-display font-bold text-zinc-100 tabular-nums">{gapCount}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Wind size={12} className="text-teal-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Consistency</span>
            </div>
            <div className="text-[20px] font-display font-bold text-zinc-100 tabular-nums">{consistencyPercent}%</div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={12} className="text-amber-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Steps</span>
            </div>
            <div className="text-[20px] font-display font-bold text-zinc-100 tabular-nums">
              {stepsToday.toLocaleString()} <span className="text-[11px] text-zinc-500">/{stepGoal.toLocaleString()}</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Moon size={12} className="text-indigo-400" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">6d Avg</span>
            </div>
            <div className="text-[20px] font-display font-bold text-zinc-100 tabular-nums">
              {(hoursData.reduce((a, b) => a + b, 0) / (hoursData.length || 1)).toFixed(1)} <span className="text-[11px] text-zinc-500">hrs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

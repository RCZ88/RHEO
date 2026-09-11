import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DeepFocusPanel } from '../../components/focus/DeepFocusPanel';
import { FocusRankingsCard } from '../../components/focus/FocusRankingsCard';
import { DrillDownCard } from '../../components/dashboard/DrillDownCard';
import { GlassCard } from '../../components/GlassCard';
import { Trophy, TrendingUp, Calendar, Flame, Clock } from 'lucide-react';

interface FocusSession {
  id: string;
  started_at: Date;
  planned_sec: number;
  duration_seconds: number;
  outcome: 'completed' | 'failed' | 'aborted';
  broke_on_name?: string;
  mode?: 'timer' | 'stopwatch';
}

interface ProductivityFocusZoneProps {
  focusState: {
    active: boolean;
    endsAt: number | null;
    remainingSec: number;
    strictness: 'distracting' | 'non_allowed';
    paused: boolean;
  };
  focusHistory: FocusSession[];
  focusRankings: {
    todayBest: number;
    todayTotal: number;
    weekBest: number;
    weekTotal: number;
    allTimeBest: number;
  };
  heatmapPreview?: React.ReactNode;
  ecosystemPreview?: React.ReactNode;
  onOpenHeatmap: () => void;
  onOpenOrbit: () => void;
  onStartFocus: (durationSec: number, strictness: 'distracting' | 'non_allowed') => void;
  onEndFocus: () => void;
}

export function ProductivityFocusZone({
  focusState,
  focusHistory,
  focusRankings,
  heatmapPreview,
  ecosystemPreview,
  onOpenHeatmap,
  onOpenOrbit,
  onStartFocus,
  onEndFocus,
}: ProductivityFocusZoneProps) {
  const reduce = useReducedMotion();

  const insights = useMemo(() => {
    const completed = focusHistory.filter(s => s.outcome === 'completed');
    const total = focusHistory.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    
    const bestSession = completed.length > 0 
      ? completed.reduce((best, s) => s.duration_seconds > best.duration_seconds ? s : best)
      : null;

    const thisWeek = completed.filter(s => {
      const date = new Date(s.started_at);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    });
    const weekMinutes = Math.round(thisWeek.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);

    return { completionRate, bestSession, weekMinutes, totalCompleted: completed.length };
  }, [focusHistory]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: reduce ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="text-[15px] font-semibold text-zinc-100 mb-4">Productivity &amp; Focus</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-5">
          <DeepFocusPanel
            state={focusState}
            history={focusHistory}
            onStart={onStartFocus}
            onEnd={onEndFocus}
          />

          <div className="grid grid-cols-2 gap-4">
            <DrillDownCard
              kind="heatmap"
              title="Productivity"
              subtitle="Weekly heatmap of your focus"
              preview={heatmapPreview}
              onView={onOpenHeatmap}
            />
            <DrillDownCard
              kind="ecosystem"
              title="App Ecosystem"
              subtitle="Your top tools in orbit"
              preview={ecosystemPreview}
              onView={onOpenOrbit}
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <FocusRankingsCard rankings={focusRankings} />
          
          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-zinc-200">Focus Insights</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Flame, label: 'Completion', value: `${insights.completionRate}%`, color: '#f97316', bg: 'from-orange-500/20 to-orange-600/5' },
                { icon: Clock, label: 'This Week', value: `${insights.weekMinutes}m`, color: '#ec4899', bg: 'from-pink-500/20 to-pink-600/5' },
                { icon: Trophy, label: 'Best Session', value: insights.bestSession ? `${Math.round(insights.bestSession.duration_seconds / 60)}m` : '--', color: '#eab308', bg: 'from-yellow-500/20 to-yellow-600/5' },
                { icon: Calendar, label: 'Total Sessions', value: `${insights.totalCompleted}`, color: '#10b981', bg: 'from-emerald-500/20 to-emerald-600/5' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="relative p-3.5 rounded-xl border border-zinc-700 light:border-zinc-300/40 light:border-zinc-200/40 text-center overflow-hidden group"
                  style={{ background: `linear-gradient(135deg, ${stat.color}10, rgba(9,9,11,0.8))` }}
                >
                  {/* Top edge glow */}
                  <div
                    className="absolute top-0 left-0 right-0 h-px opacity-50"
                    style={{ background: `linear-gradient(90deg, transparent, ${stat.color}50, transparent)` }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                      <span className="text-[10px] text-zinc-400 font-medium">{stat.label}</span>
                    </div>
                    <div className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>
                      {stat.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}

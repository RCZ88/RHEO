import { useState } from 'react';
import { useFocusSession } from '../../hooks/useFocusSession';
import { GlassCard } from '../GlassCard';
import { Badge } from '../ui/badge';
import { AnimatedCircularProgressBar } from '../ui/animated-circular-progress-bar';
import { Particles } from '../ui/particles';
import { NumberTicker } from '../ui/number-ticker';
import { motion, AnimatePresence } from 'framer-motion';
import { Focus, Play, Square, Clock, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { fmtClock, fmtDuration } from '../../features/focus/focusHelpers';
import { cn } from '@/lib/utils';

const PRESETS = [
  { label: '25m', sec: 25 * 60 },
  { label: '50m', sec: 50 * 60 },
  { label: '90m', sec: 90 * 60 },
];

const OUTCOME_META: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400' },
  failed: { icon: XCircle, color: 'text-rose-400' },
  aborted: { icon: AlertTriangle, color: 'text-amber-400' },
};

const crossfade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

const tapScale = { scale: 0.96 };

interface RecentSessionRowProps {
  h: {
    id: number;
    outcome: string;
    started_at: string;
    ended_at?: string;
    planned_sec: number;
    actual_sec?: number;
    strictness?: string;
    broke_on_name?: string;
    return_count?: number;
  };
}

function RecentSessionRow({ h }: RecentSessionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = OUTCOME_META[h.outcome] || { icon: Clock, color: 'text-zinc-500' };
  const Icon = meta.icon;
  const pct = h.planned_sec > 0 ? Math.min(100, Math.round((h.actual_sec || h.planned_sec) / h.planned_sec * 100)) : 100;
  const startTime = new Date(h.started_at);
  const dateStr = startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = startTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const endTime = h.ended_at ? new Date(h.ended_at) : null;
  const endTimeStr = endTime ? endTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <div className="rounded-md bg-zinc-800/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between text-[11px] px-2 py-1.5 text-left hover:bg-zinc-800/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-zinc-500 min-w-0">
          <Icon className="w-3 h-3 shrink-0" />
          <span className="truncate">{dateStr} &middot; {Math.round(h.planned_sec / 60)}m</span>
        </div>
        <span className="flex items-center gap-1 shrink-0">
          <span className={cn('font-medium', meta.color)}>
            {h.outcome === 'failed' ? `broke on ${h.broke_on_name ?? '?'}` : h.outcome}
          </span>
          <ChevronRight className={cn('w-3 h-3 text-zinc-600 transition-transform', expanded && 'rotate-90')} />
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-1">
              <div className="rounded bg-zinc-800/40 border border-zinc-800/40 p-2 space-y-1.5">
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-zinc-500">Start: <span className="text-zinc-300">{timeStr}</span></span>
                  {endTimeStr && <span className="text-zinc-500">End: <span className="text-zinc-300">{endTimeStr}</span></span>}
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-zinc-500">Planned: <span className="text-zinc-300">{fmtDuration(h.planned_sec)}</span></span>
                  <span className="text-zinc-500">Actual: <span className="text-zinc-300">{h.actual_sec ? fmtDuration(h.actual_sec) : '—'}</span></span>
                  <span className="text-zinc-500">{pct}%</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">{h.outcome}</span>
                  {h.strictness === 'non_allowed' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">strict</span>
                  )}
                  {h.return_count != null && h.return_count > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 text-zinc-400">{h.return_count}x returns</span>
                  )}
                </div>
                {h.outcome === 'failed' && h.broke_on_name && (
                  <div className="text-[10px] text-rose-300/80">Broke on: {h.broke_on_name}</div>
                )}
                <div className="text-[8px] text-zinc-600 font-mono">Session #{h.id}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FocusSessionCard() {
  const { state, history, start, stop } = useFocusSession();
  const [mins, setMins] = useState(25);
  const [strict, setStrict] = useState<'distracting' | 'non_allowed'>('distracting');
  const active = !!state?.active;

  const plannedSec = mins * 60;
  const remainingSec = active ? state!.remainingSec : plannedSec;
  const progressPct = active ? Math.max(0, Math.min(100, (remainingSec / plannedSec) * 100)) : 0;

  return (
    <GlassCard variant="default" accent="pink" className="col-span-full lg:col-span-1 relative overflow-hidden">
      {active && <Particles className="opacity-50" quantity={14} color="#ec4899" opacity={0.14} />}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Focus className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Deep Focus</h3>
          </div>
          <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Idle'}</Badge>
        </div>

        <div className="flex flex-col items-center mb-4">
          <AnimatedCircularProgressBar
            value={active ? progressPct : 100}
            size={112}
            strokeWidth={8}
            gaugePrimaryColor={active ? '#ec4899' : 'rgba(236,72,153,0.35)'}
            gaugeSecondaryColor="color-mix(in srgb, var(--color-foreground) 14%, transparent)"
            linear={active}
            linearDurationMs={1000}
          >
            <NumberTicker
              value={remainingSec}
              duration={active ? 600 : 200}
              formatter={fmtClock}
              className="text-2xl font-bold tabular-nums font-mono text-white"
            />
          </AnimatedCircularProgressBar>
        </div>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="active"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="text-center"
            >
              <p className="text-xs text-zinc-500 mb-4">
                Distracting {state!.strictness === 'non_allowed' ? '& neutral ' : ''}apps/sites will prompt you.
              </p>
              <motion.button
                whileTap={tapScale}
                onClick={stop}
                className="flex items-center gap-2 mx-auto text-xs px-4 py-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
              >
                <Square className="w-3 h-3" />
                End session
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
            >
              <div className="flex gap-2 mb-3">
                {PRESETS.map(p => (
                  <motion.button
                    key={p.sec}
                    whileTap={tapScale}
                    onClick={() => setMins(p.sec / 60)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      mins === p.sec / 60
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800/40 hover:bg-zinc-800'
                    }`}
                  >
                    {p.label}
                  </motion.button>
                ))}
              </div>
              <button
                onClick={() => setStrict(strict === 'non_allowed' ? 'distracting' : 'non_allowed')}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800/40 mb-3 text-left"
              >
                <span className="flex items-center gap-2 text-[11px] text-zinc-300">
                  {strict === 'non_allowed' ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-500" />}
                  Strict mode
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${strict === 'non_allowed' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {strict === 'non_allowed' ? 'Only productive' : 'Block distracting'}
                </span>
              </button>
              <motion.button
                whileTap={tapScale}
                onClick={() => start(mins * 60, strict)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start {mins}-min focus
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {history.length > 0 && (
          <div className="mt-5 border-t border-zinc-800/50 pt-3 space-y-1.5">
            <div className="text-[10px] text-zinc-600 mb-2 font-medium uppercase tracking-wider">Recent</div>
            {history.slice(0, 5).map(h => (
              <RecentSessionRow key={h.id} h={h} />
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-800/30">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Soft-block overlay -- not enforcement. Your choice is always logged.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

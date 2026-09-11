import { useState, useEffect } from 'react';
import { GlassCard } from '../../components/GlassCard';
import { Badge } from '../../components/ui/badge';
import { AnimatedCircularProgressBar } from '../../components/ui/animated-circular-progress-bar';
import { Particles } from '../../components/ui/particles';
import { NumberTicker } from '../../components/ui/number-ticker';
import { motion, AnimatePresence } from 'framer-motion';
import { Focus, Play, Square, Clock, Timer, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { fmtClock } from '../../features/focus/focusHelpers';

type FocusMode = 'timer' | 'stopwatch';

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

interface DeepFocusPanelProps {
  state: {
    active: boolean;
    endsAt: number | null;
    remainingSec: number;
    strictness: 'distracting' | 'non_allowed';
    paused: boolean;
  };
  history: Array<{
    id: string;
    started_at: Date;
    planned_sec: number;
    duration_seconds: number;
    outcome: 'completed' | 'failed' | 'aborted';
    broke_on_name?: string;
  }>;
  onStart: (durationSec: number, strictness: 'distracting' | 'non_allowed') => void;
  onEnd: () => void;
}

export function DeepFocusPanel({ state, history, onStart, onEnd }: DeepFocusPanelProps) {
  const [mins, setMins] = useState(25);
  const [strict, setStrict] = useState<'distracting' | 'non_allowed'>('distracting');
  const [mode, setMode] = useState<FocusMode>('timer');
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);

  const active = state.active;
  const plannedSec = mins * 60;
  const remainingSec = active ? state.remainingSec : plannedSec;
  const progressPct = active ? Math.max(0, Math.min(100, (remainingSec / plannedSec) * 100)) : 0;

  useEffect(() => {
    if (!active || mode !== 'stopwatch') return;
    const interval = setInterval(() => {
      setStopwatchElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [active, mode]);

  useEffect(() => {
    if (!active) setStopwatchElapsed(0);
  }, [active]);

  return (
    <GlassCard variant="default" accent="pink" className="relative overflow-hidden">
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
            gaugeSecondaryColor="rgba(255,255,255,0.06)"
            linear={active}
            linearDurationMs={1000}
          >
            <NumberTicker
              value={active && mode === 'stopwatch' ? stopwatchElapsed : remainingSec}
              duration={active ? 600 : 200}
              formatter={fmtClock}
              className="text-2xl font-bold tabular-nums font-mono text-white"
            />
          </AnimatedCircularProgressBar>
          <span className="text-[10px] text-zinc-500 mt-2">
            {active ? (mode === 'stopwatch' ? 'elapsed' : 'remaining') : mode === 'stopwatch' ? 'count up' : 'count down'}
          </span>
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
                Distracting {state.strictness === 'non_allowed' ? '& neutral ' : ''}apps/sites will prompt you.
              </p>
              <motion.button
                whileTap={tapScale}
                onClick={onEnd}
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
              <div className="flex gap-1 mb-3 p-1 bg-zinc-800/40 rounded-lg">
                <motion.button
                  whileTap={tapScale}
                  onClick={() => setMode('timer')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === 'timer'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Timer
                </motion.button>
                <motion.button
                  whileTap={tapScale}
                  onClick={() => setMode('stopwatch')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === 'stopwatch'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  Challenge
                </motion.button>
              </div>
              
              {mode === 'timer' && (
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
              )}
              <button
                onClick={() => setStrict(strict === 'non_allowed' ? 'distracting' : 'non_allowed')}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800/40 mb-3 text-left"
              >
                <span className="flex items-center gap-2 text-[11px] text-zinc-300">
                  {strict === 'non_allowed' ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" strokeWidth="3" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.1" strokeWidth="3" />
                      <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3" />
                    </svg>
                  )}
                  Strict mode
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${strict === 'non_allowed' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {strict === 'non_allowed' ? 'Only productive' : 'Block distracting'}
                </span>
              </button>
              <motion.button
                whileTap={tapScale}
                onClick={() => onStart(mode === 'stopwatch' ? 0 : mins * 60, strict)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                <Play className="w-4 h-4" />
                {mode === 'stopwatch' ? 'Start challenge' : `Start ${mins}-min focus`}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {history.length > 0 && (
          <div className="mt-5 border-t border-zinc-800/50 pt-3 space-y-1.5">
            <div className="text-[10px] text-zinc-600 mb-2 font-medium uppercase tracking-wider">Recent</div>
            {history.slice(0, 5).map(h => {
              const meta = OUTCOME_META[h.outcome] || { icon: Clock, color: 'text-zinc-500' };
              const Icon = meta.icon;
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-md bg-zinc-800/30"
                >
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(h.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      &middot; {Math.round(h.planned_sec / 60)}m
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" />
                    {h.outcome === 'failed' ? `broke on ${h.broke_on_name ?? '?'}` : h.outcome}
                  </span>
                </div>
              );
            })}
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
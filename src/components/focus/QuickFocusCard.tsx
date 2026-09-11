import { useState, useEffect } from 'react';
import { MagicCard } from '../../components/ui/magic-card';
import { Badge } from '../../components/ui/badge';
import { AnimatedCircularProgressBar } from '../../components/ui/animated-circular-progress-bar';
import { Particles } from '../../components/ui/particles';
import { NumberTicker } from '../../components/ui/number-ticker';
import { AuroraText } from '../../components/ui/aurora-text';
import { motion, AnimatePresence } from 'framer-motion';
import { Focus, Play, Square, Clock, Timer } from 'lucide-react';
import { fmtClock } from '../../features/focus/focusHelpers';

type FocusMode = 'timer' | 'stopwatch';

const PRESETS = [
  { label: '25m', sec: 25 * 60 },
  { label: '50m', sec: 50 * 60 },
  { label: '90m', sec: 90 * 60 },
];

const crossfade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

const tapScale = { scale: 0.96 };

interface QuickFocusCardProps {
  state: {
    active: boolean;
    endsAt: number | null;
    remainingSec: number;
    strictness: 'distracting' | 'non_allowed';
    paused: boolean;
  };
  onStart: (durationSec: number, strictness: 'distracting' | 'non_allowed') => void;
  onEnd: () => void;
}

export function QuickFocusCard({ state, onStart, onEnd }: QuickFocusCardProps) {
  const [mins, setMins] = useState(25);
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
    <MagicCard className="rounded-xl h-full" gradientFrom="#8b5cf6" gradientTo="#6366f1" gradientColor="rgba(139,92,246,0.06)">
      <div className="relative overflow-hidden bg-[rgba(24,24,27,0.60)] light:bg-white/90 backdrop-blur-xl border border-zinc-800/60 light:border-[var(--ws-border)] rounded-xl p-5 h-full">
        {/* Aurora Effect */}
        <div className="absolute top-[-50%] left-[-10%] right-[-10%] h-[200px]
                        bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.15)_0%,_transparent_70%)]
                        blur-2xl pointer-events-none" />
        {active && <Particles className="opacity-40" quantity={14} color="#8b5cf6" />}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Focus className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white light:text-stone-900">Deep Focus</h3>
          </div>
          <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Idle'}</Badge>
        </div>

        <AnimatedCircularProgressBar
          value={active ? progressPct : 100}
          size={112}
          strokeWidth={8}
          gaugePrimaryColor={active ? '#8b5cf6' : 'rgba(139,92,246,0.35)'}
          gaugeSecondaryColor="rgba(128,128,128,0.18)"
          linear={active}
          linearDurationMs={1000}
        >
          <NumberTicker
            value={active && mode === 'stopwatch' ? stopwatchElapsed : remainingSec}
            duration={active ? 600 : 200}
            formatter={fmtClock}
            className="text-2xl font-bold tabular-nums font-mono text-white light:text-stone-900"
          />
        </AnimatedCircularProgressBar>
        <span className="text-[10px] text-white/50 light:text-stone-500">
          {active ? (mode === 'stopwatch' ? 'elapsed' : 'remaining') : mode === 'stopwatch' ? 'count up' : 'count down'}
        </span>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="active"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="w-full text-center"
            >
              <p className="text-xs text-white/50 light:text-stone-500 mb-4">
                Distracting {state.strictness === 'non_allowed' ? '& neutral ' : ''}apps/sites will prompt you.
              </p>
              <motion.button
                whileTap={tapScale}
                onClick={onEnd}
                className="flex items-center justify-center gap-2 mx-auto text-xs px-4 py-2 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors w-full"
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
              className="w-full"
            >
              <div className="flex gap-1 mb-3 p-1 bg-zinc-800/40 light:bg-stone-100 rounded-lg">
                <motion.button
                  whileTap={tapScale}
                  onClick={() => setMode('timer')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    mode === 'timer'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'text-white/50 hover:text-white/60 light:text-stone-500 hover:light:text-stone-800'
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
                      : 'text-white/50 hover:text-white/60 light:text-stone-500 hover:light:text-stone-800'
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
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-zinc-800/60 light:bg-stone-100 text-white/60 light:text-stone-600 border border-zinc-800/40 light:border-[var(--ws-border)] hover:bg-zinc-800 hover:light:bg-stone-200/60'
                      }`}
                    >
                      {p.label}
                    </motion.button>
                  ))}
                </div>
              )}
              
              <motion.button
                whileTap={tapScale}
                onClick={() => onStart(mode === 'stopwatch' ? 0 : mins * 60, state.strictness)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                <Play className="w-4 h-4" />
                {mode === 'stopwatch' ? 'Start challenge' : `Start ${mins}-min focus`}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-1 pt-3 border-t border-zinc-800/30 light:border-[var(--ws-border)] w-full">
          <p className="text-[10px] text-white/40 light:text-stone-500 leading-relaxed text-center">
            Soft-block overlay — not enforcement. Your choice is always logged.
          </p>
        </div>
      </div>
      </div>
    </MagicCard>
  );
}

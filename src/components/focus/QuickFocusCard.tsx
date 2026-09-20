import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedCircularProgressBar } from '../../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../../components/ui/number-ticker';
import { motion, AnimatePresence } from "motion/react";
import { Focus, Play, Square, Clock, Timer } from "lucide-react";
import { fmtClock } from "../../features/focus/focusHelpers";

type FocusMode = 'timer' | 'stopwatch';

const PRESETS = [
  { label: '25m', sec: 25 * 60 },
  { label: '50m', sec: 50 * 60 },
  { label: '90m', sec: 90 * 60 },
];

const tapScale = { scale: 0.96 };

const crossfade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

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
    <Card className="rounded-[10px] h-full overflow-hidden">
      <CardHeader className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Focus className="w-4 h-4 text-[var(--page-accent)]" />
            <CardTitle>Deep Focus</CardTitle>
          </div>
          <Badge variant={active ? 'default' : 'secondary'}>{active ? 'Active' : 'Idle'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-2 flex-1 flex flex-col items-center gap-4 relative">
        <div className="relative z-10 flex flex-col items-center gap-4 w-full">
          <AnimatedCircularProgressBar
            value={active ? progressPct : 100}
            size={112}
            strokeWidth={8}
            gaugePrimaryColor={active ? 'var(--page-accent)' : 'var(--ws-border)'}
            gaugeSecondaryColor="var(--ws-border)"
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
              <div
                key="active"
                className="w-full text-center"
                style={{ animation: 'fadeIn 200ms ease-out' }}
              >
                <p className="text-xs text-white/50 light:text-stone-500 mb-4">
                  Distracting {state.strictness === 'non_allowed' ? '& neutral ' : ''}apps/sites will prompt you.
                </p>
                <Button
                  onClick={onEnd}
                  whileTap={tapScale}
                  className="flex items-center justify-center gap-2 mx-auto text-xs px-4 py-2 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-colors w-full"
                  variant="ghost"
                >
                  <Square className="w-3 h-3" />
                  End session
                </Button>
              </div>
            ) : (
              <div
                key="idle"
                className="w-full"
                style={{ animation: 'fadeIn 200ms ease-out' }}
              >
                <div className="flex gap-1 mb-3 p-1 bg-zinc-800/40 light:bg-stone-100 rounded-lg">
                  <Button
                    onClick={() => setMode('timer')}
                    whileTap={tapScale}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === 'timer'
                        ? 'bg-[var(--page-accent)]/20 text-[var(--page-accent)]'
                        : 'text-white/50 hover:text-white/60 light:text-stone-500 hover:light:text-stone-800'
                    }`}
                    variant="ghost"
                    size="sm"
                  >
                    <Clock className="w-3 h-3" />
                    Timer
                  </Button>
                  <Button
                    onClick={() => setMode('stopwatch')}
                    whileTap={tapScale}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      mode === 'stopwatch'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-white/50 hover:text-white/60 light:text-stone-500 hover:light:text-stone-800'
                    }`}
                    variant="ghost"
                    size="sm"
                  >
                    <Timer className="w-3 h-3" />
                    Challenge
                  </Button>
                </div>

                {mode === 'timer' && (
                  <div className="flex gap-2 mb-3">
                    {PRESETS.map(p => (
                      <Button
                        key={p.sec}
                        onClick={() => setMins(p.sec / 60)}
                        whileTap={tapScale}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          mins === p.sec / 60
                            ? 'bg-[var(--page-accent)]/20 text-[var(--page-accent)]'
                            : 'bg-zinc-800/60 light:bg-stone-100 text-white/60 light:text-stone-600 hover:bg-zinc-800 hover:light:bg-stone-200/60'
                        }`}
                        variant="ghost"
                        size="sm"
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                )}

                <Button
                  whileTap={tapScale}
                  onClick={() => onStart(mode === 'stopwatch' ? 0 : mins * 60, state.strictness)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {mode === 'stopwatch' ? 'Start challenge' : `Start ${mins}-min focus`}
                </Button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
      <CardFooter className="px-5 pb-4 pt-1">
        <p className="text-[10px] text-white/40 light:text-stone-500 leading-relaxed text-center w-full">
          Soft-block overlay — not enforcement. Your choice is always logged.
        </p>
      </CardFooter>
    </Card>
  );
}

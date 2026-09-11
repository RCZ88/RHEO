import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Target, Eye, EyeOff, Clock, Timer } from 'lucide-react';
import { AnimatedCircularProgressBar } from '../../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../../components/ui/number-ticker';
import { GlassCard } from '../../components/GlassCard';
import { Badge } from '../../components/ui/badge';
import type { FocusPublicState } from '../../hooks/useFocusSession';
import type { FocusGroup } from '../../hooks/useFocusGroups';
import { DragDurationBar } from './DragDurationBar';
import { fmtClock } from './focusHelpers';
import { cn } from '@/lib/utils';

const PRESETS = [
  { label: '5m', sec: 5 * 60 },
  { label: '10m', sec: 10 * 60 },
  { label: '15m', sec: 15 * 60 },
  { label: '25m', sec: 25 * 60 },
  { label: '50m', sec: 50 * 60 },
  { label: '90m', sec: 90 * 60 },
];

type FocusMode = 'timer' | 'stopwatch';

interface FocusTimerProps {
  state: FocusPublicState | null | undefined;
  mins: number;
  onMinsChange: (mins: number) => void;
  strict: 'distracting' | 'non_allowed';
  onStrictChange: (s: 'distracting' | 'non_allowed') => void;
  onStart: () => void;
  onStop: () => void;
  justCompleted: boolean;
  mode?: FocusMode;
  onModeChange?: (mode: FocusMode) => void;
  stopwatchElapsed?: number;
  groups?: FocusGroup[];
  selectedGroupIds?: number[];
  activeGroup?: FocusGroup | null;
  onStartWithGroup?: (groupId: number, durationSec: number, strictness: 'distracting' | 'non_allowed') => void;
  onStartWithGroups?: (groupIds: number[], durationSec: number, strictness: 'distracting' | 'non_allowed') => void;
  onDurationDrag?: (sec: number) => void;
}

const tapScale = { scale: 0.95 };
const crossfade = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
};

export function FocusTimer({
  state, mins, onMinsChange, strict, onStrictChange, onStart, onStop,
  justCompleted, mode = 'timer', onModeChange, stopwatchElapsed = 0,
  groups = [], selectedGroupIds = [], activeGroup = null,
  onStartWithGroup, onStartWithGroups, onDurationDrag,
}: FocusTimerProps) {
  const active = !!state?.active;
  const plannedSec = mins * 60;

  const [localRemaining, setLocalRemaining] = useState(state?.remainingSec ?? 0);
  const lastServerUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (state?.active && typeof state.remainingSec === 'number') {
      setLocalRemaining(state.remainingSec);
      lastServerUpdateRef.current = Date.now();
    } else if (!state?.active) {
      setLocalRemaining(plannedSec);
    }
  }, [state?.active, state?.remainingSec, state?.endsAt, plannedSec]);

  useEffect(() => {
    if (!active || mode === 'stopwatch') return;
    const interval = setInterval(() => {
      setLocalRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, mode]);

  const remainingSec = active ? localRemaining : plannedSec;
  const progressPct = active ? Math.max(0, Math.min(100, (remainingSec / plannedSec) * 100)) : 0;

  const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));

  const statusLabel = active ? 'Active' : justCompleted ? 'Completed' : 'Idle';
  const statusVariant = active ? 'default' : justCompleted ? 'default' : 'secondary';

  const ringPrimary = active
    ? (mode === 'stopwatch' ? 'var(--amber-400)' : 'var(--clay-400)')
    : justCompleted
      ? 'var(--success)'
      : 'rgba(232,134,107,0.3)';

  const ringAccent = active
    ? (mode === 'stopwatch' ? 'var(--amber-400)' : 'var(--clay-300)')
    : justCompleted
      ? 'var(--success)'
      : 'var(--clay-300)';

  const clockFormatter = useMemo(() => (v: number) => fmtClock(v), []);

  const [stopwatchSec, setStopwatchSec] = useState(0);

  useEffect(() => {
    if (active && mode === 'stopwatch') {
      const interval = setInterval(() => {
        setStopwatchSec(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (!active) {
      setStopwatchSec(0);
    }
  }, [active, mode]);

  const startLabel = mode === 'stopwatch'
    ? 'Start challenge'
    : selectedGroupIds.length === 1
      ? `Start ${groups.find(g => g.id === selectedGroupIds[0])?.name ?? 'group'} focus`
      : selectedGroupIds.length > 1
        ? `Start combined (${selectedGroupIds.length})`
        : `Start ${mins}-min focus`;

  return (
    <GlassCard className="relative overflow-hidden h-full">
      {/* Active-session ambient glow — subtle, not noisy */}
      {active && mode === 'timer' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${ringAccent}08 0%, transparent 70%)`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col gap-4">
        {/* Header: title + status + active group chip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--page-accent)]/10 border border-[var(--page-accent)]/20 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-[var(--page-accent)]" />
            </div>
            <span className="text-[14px] font-semibold text-zinc-200">Session control</span>
          </div>
          <Badge variant={statusVariant as 'default' | 'secondary'} className="font-mono text-[10px]">
            {statusLabel}
          </Badge>
        </div>

        {/* Radial clock — the hero */}
        <div className="flex justify-center py-2">
          <AnimatedCircularProgressBar
            value={active
              ? (mode === 'stopwatch' ? Math.min(100, (stopwatchSec / 3600) * 100) : progressPct)
              : 100}
            size={172}
            strokeWidth={10}
            gaugePrimaryColor={ringPrimary}
            gaugeSecondaryColor="rgba(255,255,255,0.05)"
            linear={active}
            linearDurationMs={1000}
            className="drop-shadow-lg"
          >
            <div className="flex flex-col items-center">
              <NumberTicker
                value={mode === 'stopwatch' ? stopwatchSec : remainingSec}
                duration={active ? 600 : 200}
                formatter={clockFormatter}
                className="text-[3rem] font-bold tabular-nums font-mono text-white leading-none"
              />
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">
                {active
                  ? (mode === 'stopwatch' ? 'elapsed' : 'remaining')
                  : `${mins}m session`}
              </span>
            </div>
          </AnimatedCircularProgressBar>
        </div>

        {/* Mode pills */}
        <div className="flex gap-2 justify-center">
          <motion.button
            whileTap={tapScale}
            onClick={() => onModeChange?.('timer')}
            className={cn(
              'flex-1 max-w-[120px] flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-colors',
              mode === 'timer'
                ? 'bg-clay-500/15 text-clay-300 border border-clay-500/30'
                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800/40 hover:bg-zinc-800'
            )}
          >
            <Timer className="w-3 h-3" />
            Timer
          </motion.button>
          <motion.button
            whileTap={tapScale}
            onClick={() => onModeChange?.('stopwatch')}
            className={cn(
              'flex-1 max-w-[120px] flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-colors',
              mode === 'stopwatch'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800/40 hover:bg-zinc-800'
            )}
          >
            <Clock className="w-3 h-3" />
            Challenge
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="active-controls"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="flex flex-col gap-3"
            >
              {/* Strictness label */}
              <p className="text-center text-[10px] text-zinc-500">
                {state!.strictness === 'non_allowed'
                  ? 'Strict — only group apps & sites allowed'
                  : 'Lenient — exact list + category buffer'}
              </p>

              {/* Selected group chips */}
              {selectedGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 justify-center">
                  {selectedGroups.map(g => {
                    const accent = (g as any).accent as string || 'var(--accent-primary)';
                    return (
                      <span
                        key={g.id}
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          background: `${accent}12`,
                          color: accent,
                          borderColor: `${accent}25`,
                        }}
                      >
                        {g.name}
                      </span>
                    );
                  })}
                </div>
              )}

              <button
                onClick={onStop}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors text-sm font-semibold"
              >
                <Square className="w-4 h-4" />
                End session
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle-controls"
              initial={crossfade.initial}
              animate={crossfade.animate}
              exit={crossfade.exit}
              transition={crossfade.transition}
              className="flex flex-col gap-3"
            >
              {/* Selected group chip */}
              {selectedGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 justify-center">
                  {selectedGroups.map(g => {
                    const accent = (g as any).accent as string || 'var(--accent-primary)';
                    return (
                      <span
                        key={g.id}
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          background: `${accent}12`,
                          color: accent,
                          borderColor: `${accent}25`,
                        }}
                      >
                        {g.name}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Duration drag bar (timer mode only) */}
              {mode === 'timer' && onDurationDrag && (
                <DragDurationBar valueSec={mins * 60} onChange={onDurationDrag} />
              )}

              {/* Preset pills */}
              {mode === 'timer' && (
                <div className="flex gap-1.5 justify-center flex-wrap">
                  {PRESETS.map(p => (
                    <motion.button
                      key={p.sec}
                      whileTap={tapScale}
                      onClick={() => onMinsChange(p.sec / 60)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-colors',
                        mins === p.sec / 60
                          ? 'bg-clay-500/15 text-clay-300 border border-clay-500/30'
                          : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800/40 hover:bg-zinc-800 hover:text-zinc-300'
                      )}
                    >
                      <Target className="w-3 h-3 opacity-60" />
                      {p.label}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Strictness toggle */}
              <button
                onClick={() => onStrictChange(strict === 'non_allowed' ? 'distracting' : 'non_allowed')}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800/40 text-left"
              >
                <span className="flex items-center gap-2 text-[12px] text-zinc-300">
                  {strict === 'non_allowed' ? (
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  Strict mode
                </span>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full',
                  strict === 'non_allowed'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-zinc-800 text-zinc-500'
                )}>
                  {strict === 'non_allowed' ? 'Exact only' : 'Allowed + buffer'}
                </span>
              </button>

              {strict === 'non_allowed' ? (
                <p className="text-[10px] text-amber-400/60 leading-relaxed text-center">
                  Hard whitelist: only the group's exact apps & sites are allowed — the category buffer is blocked.
                  Everything else triggers a focus reminder overlay.
                </p>
              ) : selectedGroups.some(g => (g.allowed_categories?.length || 0) > 0) ? (
                <p className="text-[10px] text-emerald-400/60 leading-relaxed text-center">
                  Category buffer tolerated: apps from your selected group's categories are allowed alongside the exact list.
                </p>
              ) : null}

              <button
                onClick={() => {
                  if (mode !== 'stopwatch' && selectedGroupIds.length > 0) {
                    if (selectedGroupIds.length === 1 && onStartWithGroup) {
                      onStartWithGroup(selectedGroupIds[0], mins * 60, strict);
                    } else if (onStartWithGroups) {
                      onStartWithGroups(selectedGroupIds, mins * 60, strict);
                    } else {
                      onStart();
                    }
                  } else {
                    onStart();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-clay-500/15 text-clay-200 border border-clay-500/30 hover:bg-clay-500/25 transition-colors text-sm font-semibold"
              >
                <Play className="w-4 h-4" />
                {startLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-zinc-600 leading-relaxed text-center">
          Soft-block overlay — not enforcement. Your choice is always logged.
        </p>
      </div>
    </GlassCard>
  );
}

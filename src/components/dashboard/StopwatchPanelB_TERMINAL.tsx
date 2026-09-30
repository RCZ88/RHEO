// ============================================================
// RHEO Dashboard — Stopwatch Panel PROTOTYPE B: "TERMINAL CHIC"
// Flat gunmetal panel. 52px mono timer. Terminal aesthetic.
// Border color = category signal (pink when productive, rose when distracted).
// ============================================================

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Square, RotateCw, Flame, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import type { WidgetCardProps } from './WidgetCardB_TERMINAL';
import { WidgetCardB } from './WidgetCardB_TERMINAL';

interface StopwatchPanelProps {
  productiveMs: number;
  distractingMs: number;
  isPaused: boolean;
  lastTier: 'productive' | 'neutral' | 'distracting' | null;
  onPauseToggle: () => void;
  onStop: () => void;
  onReset: () => void;
  streak: number;
  score: number;
  className?: string;
}

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtShort(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StopwatchPanelB({
  productiveMs,
  distractingMs,
  isPaused,
  lastTier,
  onPauseToggle,
  onStop,
  onReset,
  streak,
  score,
  className = '',
}: StopwatchPanelProps) {
  const isProductive = lastTier === 'productive' && !isPaused;
  const isDistracting = lastTier === 'distracting' && !isPaused;
  const borderColor = isDistracting ? 'border-rose-500/50' : isProductive ? 'border-pink-500/50' : 'border-zinc-700';

  return (
    <WidgetCardB
      widgetId="status-band"
      title="Session Timer"
      icon={Zap}
      accent="#ec4899"
      className={`${className} ${borderColor} transition-colors duration-200`}
      empty={productiveMs === 0 && distractingMs === 0}
      emptyMessage="No session active — click Resume to start"
      emptyIcon={<Zap size={16} />}
    >
      {/* Timer — 52px mono, largest element */}
      <div className="text-center py-2">
        <div className="text-[52px] font-mono font-bold tabular-nums leading-none tracking-tight text-zinc-100">
          <NumberTicker value={productiveMs} formatter={fmtTime} delay={0} duration={600} />
        </div>
        <div className="text-[14px] font-mono text-zinc-500 mt-1 tabular-nums">
          {fmtShort(productiveMs)}
        </div>
      </div>

      {/* Status line — mono uppercase */}
      <div className="flex items-center justify-center gap-2 py-2 border-t border-zinc-800/30">
        <div className={`w-2 h-2 rounded-full ${isProductive ? 'bg-emerald-400 animate-pulse' : isDistracting ? 'bg-rose-400' : 'bg-zinc-600'}`} style={{ animationDuration: isProductive ? '2s' : '0' }} />
        <span className="text-[11px] font-mono uppercase tracking-wider" style={{
          color: isProductive ? '#34d399' : isDistracting ? '#f43f5e' : '#71717a'
        }}>
          {isProductive ? 'RUNNING — In focus session' : isDistracting ? 'DISTRACTED — Switch away' : isPaused ? 'PAUSED — Take a break' : 'IDLE — Not tracking'}
        </span>
      </div>

      {/* Buttons — compact 36px, icon-only with aria-label */}
      <div className="flex items-center justify-center gap-1 mt-3">
        {!isPaused && lastTier !== null ? (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPauseToggle}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150"
              aria-label="Pause timer"
            >
              <Pause size={14} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStop}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150"
              aria-label="Stop timer"
            >
              <Square size={14} />
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPauseToggle}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-pink-500/30 bg-pink-500/5 text-pink-400 hover:bg-pink-500/10 hover:border-pink-400/50 active:scale-[0.97] transition-all duration-150"
            aria-label="Resume timer"
          >
            <Play size={14} />
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/50 text-zinc-600 hover:border-zinc-500 hover:bg-zinc-700/50 active:scale-[0.97] transition-all duration-150"
          aria-label="Reset timer"
        >
          <RotateCw size={14} />
        </motion.button>
      </div>

      {/* Bottom meta — 2-column mono, aligned */}
      <div className="flex items-center justify-between border-t border-zinc-800/30 pt-3 mt-2">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Productive</span>
            <span className="text-[13px] font-mono text-zinc-300 tabular-nums">{fmtShort(productiveMs)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Distracted</span>
            <span className="text-[13px] font-mono text-rose-400/70 tabular-nums">{fmtShort(distractingMs)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Streak</span>
            <span className="text-[13px] font-mono text-orange-400/80 tabular-nums">{streak}d</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">Score</span>
            <span className="text-[13px] font-mono text-pink-400/80 tabular-nums">{score}/100</span>
          </div>
        </div>
      </div>
    </WidgetCardB>
  );
}

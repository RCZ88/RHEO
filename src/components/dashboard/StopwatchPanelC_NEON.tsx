// ============================================================
// RHEO Dashboard — Stopwatch Panel PROTOTYPE C: "NEON GLASS"
// Dark glass panel. 44px pink-tinted mono timer.
// Pulsing status ring when active. Neon border on hover.
// ============================================================

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Square, RotateCw, Flame, Zap } from 'lucide-react';
import { NumberTicker } from '../ui/number-ticker';
import { BorderBeam } from '../ui/border-beam';
import type { WidgetCardProps } from './WidgetCardC_NEON';
import { WidgetCardC } from './WidgetCardC_NEON';

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

export function StopwatchPanelC({
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
  const neonColor = isDistracting ? '#f43f5e' : isProductive ? '#ec4899' : '#ec4899';
  const timerTextColor = isProductive ? '#f9a8d4' : '#fafafa';

  return (
    <WidgetCardC
      widgetId="status-band"
      title="Stopwatch"
      icon={Zap}
      neonColor={neonColor}
      kicker="SESSION TIMER"
      className={className}
      empty={productiveMs === 0 && distractingMs === 0}
      emptyMessage="No active session — click Resume to start tracking"
      emptyIcon={<Zap size={24} />}
    >
      {/* Timer — 44px mono, pink-tinted when productive */}
      <div className="text-center mb-4">
        <div className="text-[44px] font-mono font-bold tabular-nums leading-none tracking-tight" style={{ color: timerTextColor }}>
          <NumberTicker value={productiveMs} formatter={fmtTime} delay={0} duration={800} />
        </div>
        <div className="text-[13px] font-mono text-zinc-500 mt-1 tabular-nums">
          {fmtShort(productiveMs)}
        </div>
      </div>

      {/* Status pill with pulsing ring */}
      <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-xl bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50">
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${isProductive ? 'bg-emerald-400' : isDistracting ? 'bg-rose-400' : 'bg-zinc-600'}`} />
          {isProductive && (
            <motion.div
              className="absolute inset-2 rounded-full border-2"
              style={{ borderColor: 'rgba(52, 211, 153, 0.3)' }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {isDistracting && (
            <motion.div
              className="absolute inset-2 rounded-full border-2"
              style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
        <span className="text-[11px] font-mono uppercase tracking-wider" style={{
          color: isProductive ? '#34d399' : isDistracting ? '#f43f5e' : '#71717a'
        }}>
          {isProductive ? 'RUNNING — In focus' : isDistracting ? 'DISTRACTED — Switch apps' : isPaused ? 'PAUSED — Take a break' : 'IDLE — Not tracking'}
        </span>
      </div>

      {/* Action buttons — glass style with neon hover */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {!isPaused && lastTier !== null ? (
          <>
            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onPauseToggle}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-300 hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_16px_-4px_rgba(236,72,153,0.15)] transition-all duration-300"
            >
              <Pause size={14} />
              <span className="text-[11px] font-mono uppercase">Pause</span>
            </motion.button>
            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStop}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-300 hover:border-rose-500/30 hover:bg-rose-500/5 hover:shadow-[0_0_16px_-4px_rgba(244,63,94,0.15)] transition-all duration-300"
            >
              <Square size={14} />
              <span className="text-[11px] font-mono uppercase">Stop</span>
            </motion.button>
          </>
        ) : (
          <motion.button
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPauseToggle}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/5 text-pink-300 hover:bg-pink-500/10 hover:border-pink-400/50 hover:shadow-[0_0_20px_-4px_rgba(236,72,153,0.2)] transition-all duration-300"
          >
            <Play size={14} />
            <span className="text-[11px] font-mono uppercase">Resume</span>
          </motion.button>
        )}
        <motion.button
          whileHover={{ y: -1, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onReset}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm text-zinc-500 hover:border-zinc-600 hover:shadow-[0_0_12px_-4px_rgba(113,113,122,0.1)] transition-all duration-300"
        >
          <RotateCw size={14} />
          <span className="text-[11px] font-mono uppercase">Reset</span>
        </motion.button>
      </div>

      {/* Bottom meta — glass pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Today</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-500">Productive</span>
            <span className="text-[13px] font-mono font-medium text-emerald-400 tabular-nums">{fmtShort(productiveMs)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-mono text-zinc-500">Distracted</span>
            <span className="text-[13px] font-mono font-medium text-rose-400 tabular-nums">{fmtShort(distractingMs)}</span>
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Tracked</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <Flame size={10} className="text-orange-400" /> Streak
            </span>
            <span className="text-[13px] font-mono font-medium text-orange-400 tabular-nums">{streak} days</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-mono text-zinc-500">Score</span>
            <span className="text-[13px] font-mono font-medium text-pink-300 tabular-nums">{score}/100</span>
          </div>
        </div>
      </div>

      {/* BorderBeam on productive */}
      {isProductive && <BorderBeam size={120} duration={8} colorFrom="#ec4899" colorTo="#f472b6" />}
    </WidgetCardC>
  );
}

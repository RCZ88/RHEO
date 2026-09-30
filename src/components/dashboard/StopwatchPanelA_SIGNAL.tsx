// ============================================================
// RHEO Dashboard — Stopwatch Panel PROTOTYPE A: "SIGNAL"
// Spec-compliant rewrite: 40px mono timer, 2-col grid,
// status dot + label, 3 stat wells, Start/Pause + Reset.
// L1 composed. NO NumberTicker, NO BorderBeam, NO pulsing.
// ============================================================

import { useMemo } from "react";
import { motion } from "motion/react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { WidgetCardA, type WidgetCategory, CardEntrance } from "./WidgetCardA_SIGNAL";

const CATEGORY: WidgetCategory = "productivity";

// ── Format ms → hh:mm:ss ───────────────────────────────
function fmtSec(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Status config ───────────────────────────────────────
const STATUS_CONFIG = {
  productive: { dot: "bg-emerald-500", label: "PRODUCTIVE" },
  distracting: { dot: "bg-amber-500", label: "DISTRACTING" },
  neutral: { dot: "bg-zinc-500", label: "IDLE" },
  paused: { dot: "bg-zinc-600", label: "PAUSED" },
  idle: { dot: "bg-zinc-600", label: "NO ACTIVITY DETECTED" },
};

// ── Props ───────────────────────────────────────────────
interface StopwatchPanelProps {
  productiveMs: number;
  distractingMs: number;
  isPaused: boolean;
  lastTier: "productive" | "neutral" | "distracting" | null;
  onPauseToggle: () => void;
  onStop: () => void;
  onReset: () => void;
  streak: number;
  score: number;
  className?: string;
}

// ── Panel ───────────────────────────────────────────────
export function StopwatchPanelA({
  productiveMs,
  distractingMs,
  isPaused,
  lastTier,
  onPauseToggle,
  onStop,
  onReset,
  streak,
  score,
  className = "",
}: StopwatchPanelProps) {
  const display = fmtSec(productiveMs);
  const status = lastTier ? STATUS_CONFIG[lastTier] : STATUS_CONFIG.idle;

  return (
    <CardEntrance index={0}>
      <WidgetCardA category={CATEGORY} className="xl:col-span-2">
        <div className="grid grid-cols-[auto_1fr] gap-6">
          {/* LEFT: Timer block */}
          <div className="flex flex-col">
            {/* Kicker — only place besides bar where category color appears as text */}
            <div className="mb-3">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-500">
                SESSION
              </span>
            </div>

            {/* Timer display — 40px mono, colons static, digits zinc-100 */}
            <div className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {display}
            </div>

            {/* Status line — 8px dot + label */}
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${status.dot}`}
                aria-label={status.label}
              />
              <span className="text-[12px] font-medium text-zinc-400">
                {status.label}
              </span>
              {lastTier === "paused" && (
                <Pause className="ml-auto text-[12px] text-zinc-600" size={12} />
              )}
            </div>

            {/* Actions — bottom-right of left column */}
            <div className="mt-6 flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-pink-500 text-zinc-950 text-[12px] font-semibold hover:bg-pink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50 transition-colors duration-150"
                onClick={isPaused ? onStop : onPauseToggle}
                aria-label={isPaused ? "Resume session" : "Pause session"}
              >
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                {isPaused ? "Resume" : "Pause"}
              </motion.button>

              <button
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-zinc-700 text-zinc-400 text-[12px] hover:text-zinc-100 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50 transition-colors duration-150"
                onClick={onReset}
                aria-label="Reset session"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>

          {/* RIGHT: Today's stats — three inner wells */}
          <div className="grid grid-cols-3 gap-3">
            {/* Focused */}
            <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
              <div className="text-[11px] font-medium text-zinc-500">Focused</div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
                {productiveMs > 0 ? fmtSec(productiveMs) : "--"}
              </div>
            </div>

            {/* Distracted */}
            <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
              <div className="text-[11px] font-medium text-zinc-500">Distracted</div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
                {distractingMs > 0 ? fmtSec(distractingMs) : "--"}
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
              <div className="text-[11px] font-medium text-zinc-500">Sessions</div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
                {streak > 0 ? streak : "--"}
              </div>
            </div>
          </div>
        </div>
      </WidgetCardA>
    </CardEntrance>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { WidgetCard, type WidgetCategory } from "./WidgetCard";

const CATEGORY: WidgetCategory = "productivity";

export function fmtSec(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type Tier = "productive" | "distracting" | "neutral" | "paused" | null;

interface UseStopwatchReturn {
  display: string;
  tier: Tier;
  currentProductiveMs: number;
  currentDistractingMs: number;
  sessionCount: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
}

export function useStopwatch(): UseStopwatchReturn {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tier, setTier] = useState<Tier>(null);
  const [currentProductiveMs, setProductive] = useState(0);
  const [currentDistractingMs, setDistracting] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (running && !paused) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1000);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, paused]);

  const start = useCallback(() => {
    setRunning(true);
    setPaused(false);
    setTier("neutral");
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setPaused(false);
    setTier(null);
    setProductive(0);
    setDistracting(0);
    setSessionCount(0);
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const tick = useCallback(() => {
    // Simulate tier change for prototype demo
    setTier((t) => {
      if (t === null) return "productive";
      if (t === "productive") return "distracting";
      if (t === "distracting") return "neutral";
      return "productive";
    });
  }, []);

  return {
    display: fmtSec(elapsed),
    tier,
    currentProductiveMs,
    currentDistractingMs,
    sessionCount,
    running,
    start,
    pause,
    reset,
    tick,
  };
}

const statusConfig = {
  productive: { dot: "bg-emerald-500", label: "PRODUCTIVE" },
  distracting: { dot: "bg-amber-500", label: "DISTRACTING" },
  neutral: { dot: "bg-zinc-500", label: "IDLE" },
  paused: { dot: "bg-zinc-600", label: "PAUSED" },
  null: { dot: "bg-zinc-600", label: "NO ACTIVITY DETECTED" },
};

export function StatusBand() {
  const sw = useStopwatch();
  const reduce = useReducedMotion();
  const status = statusConfig[sw.tier];

  return (
    <WidgetCard category={CATEGORY} className="xl:col-span-2">
      <div className="grid grid-cols-[auto_1fr] gap-6">
        {/* LEFT: Timer block */}
        <div className="flex flex-col">
          {/* Kicker */}
          <div className="mb-3">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-500">
              SESSION
            </span>
          </div>

          {/* Timer display */}
          <div className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono']">
            {sw.display}
          </div>

          {/* Status line */}
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${status.dot}`}
              aria-label={status.label}
            />
            <span className="text-[12px] font-medium text-zinc-400">
              {status.label}
            </span>
            {sw.tier === "paused" && (
              <Pause className="ml-auto text-[12px] text-zinc-600" size={12} />
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-pink-500 text-zinc-950 text-[12px] font-semibold hover:bg-pink-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50 transition-colors duration-150"
              onClick={sw.running ? sw.pause : sw.start}
              style={{ padding: "8px 16px", minHeight: "44px" }}
            >
              {sw.running && !sw.paused ? (
                <Pause size={14} />
              ) : (
                <Play size={14} />
              )}
              {sw.running && !sw.paused ? "Pause" : "Start"}
            </motion.button>

            <button
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-zinc-700 text-zinc-400 text-[12px] hover:text-zinc-100 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500/50 transition-colors duration-150"
              onClick={sw.reset}
              style={{ padding: "8px 12px", minHeight: "44px" }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </div>

        {/* RIGHT: Today's stats */}
        <div className="grid grid-cols-3 gap-3">
          {/* Focused */}
          <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
            <div className="text-[11px] font-medium text-zinc-500">Focused</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {sw.currentProductiveMs > 0 ? fmtSec(sw.currentProductiveMs) : "--"}
            </div>
          </div>

          {/* Distracted */}
          <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
            <div className="text-[11px] font-medium text-zinc-500">Distracted</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {sw.currentDistractingMs > 0 ? fmtSec(sw.currentDistractingMs) : "--"}
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-lg px-4 py-3">
            <div className="text-[11px] font-medium text-zinc-500">Sessions</div>
            <div className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono']">
              {sw.sessionCount > 0 ? sw.sessionCount : "--"}
            </div>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}

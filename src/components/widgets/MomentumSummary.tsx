import { WidgetCard, type WidgetCategory } from "./WidgetCard";
import { useRef } from "react";
import { motion } from "motion";

const CATEGORY: WidgetCategory = "productivity";

interface MomentumSummaryProps {
  score: number;
  trend: number; // positive = up, negative = down, 0 = flat
}

const BAND_COLORS = {
  emerald: "#34d399",
  sky: "#38bdf8",
  amber: "#fbbf24",
  orange: "#fb923c",
  red: "#f87171",
};

function bandForScore(score: number): string {
  if (score >= 80) return "emerald";
  if (score >= 60) return "sky";
  if (score >= 40) return "amber";
  if (score >= 20) return "orange";
  return "red";
}

export function MomentumSummary({ score, trend }: MomentumSummaryProps) {
  const reduce = useRef(false);
  // In real impl, use useReducedMotion() — simplified here
  const band = bandForScore(score);
  const color = BAND_COLORS[band];

  const breakdown = [
    { label: "Goals", pct: 40, value: 72 },
    { label: "Schedule", pct: 30, value: 55 },
    { label: "Streak", pct: 30, value: 80 },
  ];

  return (
    <WidgetCard category={CATEGORY} className="xl:col-span-2">
      {/* Kicker */}
      <div className="mb-4">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-500">
          MOMENTUM
        </span>
      </div>

      {/* Score display + segment bar */}
      <div className="flex items-center gap-4 mb-5">
        {/* 20-segment bar */}
        <div className="flex gap-[3px] h-6 flex-1 max-w-[240px]">
          {Array.from({ length: 20 }).map((_, i) => {
            const filled = i < Math.round((score / 100) * 20);
            return (
              <div
                key={i}
                className={`h-6 w-[6px] rounded-sm transition-colors duration-300 ${
                  filled ? "bg-zinc-800" : "bg-zinc-800"
                }`}
                style={
                  filled
                    ? {
                        backgroundColor: color,
                        boxShadow: `0 0 6px ${color}40`,
                      }
                    : undefined
                }
              />
            );
          })}
        </div>

        {/* Score number */}
        <div className="flex items-baseline gap-1">
          <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono']">
            {score}
          </span>
          <span className="text-[13px] font-medium text-zinc-500">/100</span>
        </div>
      </div>

      {/* Trend */}
      <div className="flex items-center gap-2 mb-5">
        {trend > 0 && (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
            >
              <path d="M6 2l4 6-4 2" />
            </svg>
            <span className="text-[11px] font-medium text-emerald-400">
              {trend} vs yesterday
            </span>
          </>
        )}
        {trend < 0 && (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
            >
              <path d="M6 10l-4-6 4-2" />
            </svg>
            <span className="text-[11px] font-medium text-red-400">
              {Math.abs(trend)} vs yesterday
            </span>
          </>
        )}
        {trend === 0 && (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="2"
            >
              <path d="M3 6h6" />
            </svg>
            <span className="text-[11px] font-medium text-zinc-500">flat</span>
          </>
        )}
      </div>

      {/* Breakdown rows */}
      <div className="space-y-3">
        {breakdown.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium text-zinc-400 w-[80px]">
              {row.label}
            </span>

            {/* Mini track bar */}
            <div className="flex-1 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}40` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: row.pct / 100 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: "left" }}
              />
            </div>

            <span className="text-[13px] font-semibold tabular-nums text-zinc-100 font-['JetBrains_Mono'] w-[40px] text-right">
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Weight legend */}
      <div className="mt-4 pt-3 border-t border-zinc-800/50">
        <div className="flex items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-wider">
          <span>Goals 40%</span>
          <span>Schedule 30%</span>
          <span>Streak 30%</span>
        </div>
      </div>
    </WidgetCard>
  );
}

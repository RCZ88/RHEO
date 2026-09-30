import { WidgetCard, type WidgetCategory } from "./WidgetCard";
import { motion } from "motion";

const CATEGORY: WidgetCategory = "activity";

interface StreakCardProps {
  streak: number;
  days: Array<{ done: boolean; isToday: boolean }>;
}

export function StreakCard({ streak, days }: StreakCardProps) {
  return (
    <WidgetCard category={CATEGORY}>
      {/* Kicker */}
      <div className="mb-3 flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2"
        >
          <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.092-2.118-1-3-1-3l-1 3H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6h-2l-1 3c0 1.38-1 3-1 3l.5-1.5z" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400">
          FOLLOW-THROUGH
        </span>
      </div>

      {/* Streak number */}
      <div className="text-[40px] font-bold leading-none tracking-tight tabular-nums text-zinc-100 font-['JetBrains_Mono'] mb-4">
        {streak}
      </div>

      {/* 7-day dot strip */}
      <div className="flex items-center gap-2">
        {days.map((day, i) => (
          <div
            key={i}
            className={`inline-block h-2 w-2 rounded-full ${
              day.done
                ? "bg-emerald-500"
                : day.isToday
                ? "ring-1 ring-pink-500 bg-zinc-800"
                : "bg-zinc-700"
            }`}
            title={day.isToday ? "Today" : day.done ? "Done" : "Missed"}
          />
        ))}
      </div>

      {/* Day labels */}
      <div className="mt-2 flex items-center gap-2 text-[9px] text-zinc-600 uppercase tracking-wider">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </WidgetCard>
  );
}

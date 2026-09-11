import type { MonthlyDayData } from "@/lib/external/timelines";
import { GlassCard } from "@/components/GlassCard";
import { NumberTicker } from "@/components/ui/number-ticker";

function formatHoursShort(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 10) return `${Math.round(hours)}h`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

export function MonthlyTimeline({
  days,
  summary,
  onDayClick,
}: {
  days: MonthlyDayData[];
  summary: {
    totalTrackedSeconds: number;
    activeDays: number;
    dailyAverageSeconds: number;
  };
  onDayClick?: (day: MonthlyDayData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const topColor = day.topActivities[0]?.activity.color;

          return (
            <button
              key={day.date.toISOString()}
              onClick={() => onDayClick?.(day)}
              className={`relative min-h-[108px] rounded-xl border p-3 text-left transition-colors bg-zinc-900/60 backdrop-blur-xl ${
                day.inMonth
                  ? "border-white/10 hover:border-white/20"
                  : "border-white/5 opacity-40"
              } ${day.isToday ? "border-white/25 ring-1 ring-white/20" : ""}`}
            >
              {day.trackedSeconds > 0 && topColor && (
                <div
                  className="absolute inset-x-3 top-0 h-[3px] rounded-b-full"
                  style={{ backgroundColor: topColor }}
                />
              )}

              <div className="text-sm text-zinc-300">
                {day.date.getDate()}
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
                <div className="flex h-full">
                  <div
                    className="h-full"
                    style={{
                      width: `${day.trackedPct * 100}%`,
                      backgroundColor: topColor ?? "#71717a",
                    }}
                  />
                  <div className="h-full flex-1 gap-stripes opacity-70" />
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                {day.trackedSeconds > 0
                  ? formatHoursShort(day.trackedSeconds)
                  : "No tracking"}
              </div>

              <div className="mt-2 flex gap-1">
                {day.topActivities.slice(0, 3).map(({ activity }) => (
                  <span
                    key={activity.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: activity.color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <GlassCard className="p-4">
          <div className="text-sm text-zinc-500">Total tracked</div>
          <div className="mt-2 text-2xl text-zinc-100">
            <NumberTicker value={Math.round(summary.totalTrackedSeconds / 3600)} />h
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-sm text-zinc-500">Active days</div>
          <div className="mt-2 text-2xl text-zinc-100">
            <NumberTicker value={summary.activeDays} />
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="text-sm text-zinc-500">Daily average</div>
          <div className="mt-2 text-2xl text-zinc-100">
            <NumberTicker value={Math.round(summary.dailyAverageSeconds / 60)} />m
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

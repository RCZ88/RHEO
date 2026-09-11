import type {
  TimelineGapBlock as GapBlockData,
  WeeklyDayData,
} from "@/lib/external/timelines";
import { TimelineGapBlock } from "./TimelineGapBlock";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
  });
}

export function WeeklyTimeline({
  days,
  onGapClick,
}: {
  days: WeeklyDayData[];
  onGapClick?: (gap: GapBlockData) => void;
}) {
  if (!days.length) {
    return (
      <EmptyState
        title="No weekly data"
        description="Weekly activity timelines will appear here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      {days.map((day) => (
        <GlassCard
          key={day.date.toISOString()}
          className={`p-3 ${day.isToday ? "border-white/25 ring-1 ring-white/20" : ""}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-zinc-300">
              {formatDayLabel(day.date)}
            </div>

            <div
              className={`h-2 w-2 rounded-full ${day.trackedSeconds > 0 ? "bg-emerald-400" : "bg-zinc-700"}`}
            />
          </div>

          <div className="relative h-80 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] timeline-hour-lines-vertical">
            {day.gaps.map((gap) => (
              <TimelineGapBlock
                key={gap.id}
                gap={gap}
                orientation="vertical"
                onClick={onGapClick}
              />
            ))}

            {day.blocks.map((block) => (
              <div
                key={block.id}
                title={`${block.activityName} • ${block.durationSeconds}s`}
                className="absolute left-1 right-1 rounded-md opacity-80 transition-opacity hover:opacity-100"
                style={{
                  top: `${block.startPct}%`,
                  height: `${Math.max(0.75, block.endPct - block.startPct)}%`,
                  backgroundColor: block.color,
                }}
              />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

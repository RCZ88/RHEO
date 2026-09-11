import type {
  DailyTimelineData,
  TimelineGapBlock as GapBlockData,
} from "@/lib/external/timelines";
import { TimelineGapBlock } from "./TimelineGapBlock";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";

function formatDuration(seconds: number): string {
  const hours = seconds / 3600;

  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }

  return `${Math.round(seconds / 60)}m`;
}

export function DailyTimeline({
  data,
  onGapClick,
}: {
  data: DailyTimelineData;
  onGapClick?: (gap: GapBlockData) => void;
}) {
  if (!data.lanes.length && !data.gaps.length) {
    return (
      <EmptyState
        title="No activity for this day"
        description="Tracked sessions and gaps will appear here."
      />
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="space-y-4">
        {/* Hour labels */}
        <div
          className="grid items-center gap-2"
          style={{
            gridTemplateColumns: "80px repeat(24, minmax(0, 1fr))",
          }}
        >
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-[10px] text-zinc-500">
              {hour % 3 === 0 ? `${hour}:00` : ""}
            </div>
          ))}
        </div>

        {/* Activity lanes */}
        {data.lanes.map((lane) => (
          <div
            key={lane.activity.id}
            className="grid items-center gap-2"
            style={{
              gridTemplateColumns: "80px repeat(24, minmax(0, 1fr))",
            }}
          >
            <div className="truncate text-xs text-zinc-400">
              {lane.activity.name}
            </div>

            <div
              className="relative col-span-24 h-8 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] timeline-hour-lines"
            >
              {lane.blocks.map((block) => (
                <div
                  key={block.id}
                  title={`${block.activityName} • ${formatDuration(block.durationSeconds)}`}
                  className="absolute top-1 bottom-1 rounded-md opacity-80 transition-opacity hover:opacity-100"
                  style={{
                    left: `${block.startPct}%`,
                    width: `${Math.max(0.35, block.endPct - block.startPct)}%`,
                    backgroundColor: block.color,
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Gap lane */}
        <div
          className="grid items-center gap-2"
          style={{
            gridTemplateColumns: "80px repeat(24, minmax(0, 1fr))",
          }}
        >
          <div className="text-xs text-zinc-500">Gaps</div>

          <div className="relative col-span-24 h-10 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] timeline-hour-lines">
            {data.gaps.map((gap) => (
              <TimelineGapBlock
                key={gap.id}
                gap={gap}
                orientation="horizontal"
                onClick={onGapClick}
              />
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

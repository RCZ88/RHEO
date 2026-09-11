import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { computeActivityGridLayout } from "@/lib/external/grid";
import type { Hierarchy, ScaleMode } from "@/lib/external/grid";
import { SCALE_MODES } from "@/lib/external/grid";
import type { ExternalActivity, ExternalSession, ExternalStats } from "@/types/external";
import { ActivityMosaicCard } from "./ActivityMosaicCard";
import { EmptyState } from "@/components/EmptyState";

const HIERARCHY_KEY = "external-mosaic-hierarchy";
const SCALE_KEY = "external-mosaic-scale";

function readStoredHierarchy(): Hierarchy {
  try {
    const stored = localStorage.getItem(HIERARCHY_KEY);
    if (stored === "subtle" || stored === "dramatic" || stored === "balanced") {
      return stored;
    }
  } catch {
    // localStorage unavailable — fall through to default
  }
  return "balanced";
}

function readStoredScale(): ScaleMode {
  try {
    const stored = localStorage.getItem(SCALE_KEY);
    if (stored === "gentle" || stored === "soft" || stored === "natural" || stored === "true") {
      return stored;
    }
  } catch {
    // localStorage unavailable — fall through to default
  }
  return "gentle";
}

const SCALE_LABELS: Record<ScaleMode, { label: string; title: string }> = {
  gentle: {
    label: "Gentle",
    title: "Log-compressed — huge differences flattened, every card stays legible",
  },
  soft: {
    label: "Soft",
    title: "Mild compression — a step closer to the real scale",
  },
  natural: {
    label: "Natural",
    title: "Light compression — sizes mostly match real time",
  },
  true: {
    label: "True",
    title: "Directly proportional — no log, no processing. A dominant activity takes its real share",
  },
};

export function ActivityMosaic({
  activities,
  stats,
  sessions = [],
  getIcon,
  selectedActivityId,
  onSelectActivity,
}: {
  activities: ExternalActivity[];
  stats: ExternalStats;
  sessions?: ExternalSession[];
  getIcon?: (iconName: string) => LucideIcon;
  selectedActivityId?: string | null;
  onSelectActivity?: (activity: ExternalActivity) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [hierarchy, setHierarchy] = useState<Hierarchy>(readStoredHierarchy);
  const [scale, setScale] = useState<ScaleMode>(readStoredScale);

  const handleHierarchyChange = (next: Hierarchy) => {
    setHierarchy(next);
    try {
      localStorage.setItem(HIERARCHY_KEY, next);
    } catch {
      // localStorage unavailable — hierarchy just won't persist
    }
  };

  const handleScaleChange = (next: ScaleMode) => {
    setScale(next);
    try {
      localStorage.setItem(SCALE_KEY, next);
    } catch {
      // localStorage unavailable — scale just won't persist
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;

      if (width >= 1200) {
        setAspect(16 / 9);
      } else if (width >= 768) {
        setAspect(4 / 3);
      } else {
        setAspect(3 / 4);
      }
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    return computeActivityGridLayout({
      activities,
      stats,
      aspect,
      width: 1200,
      hierarchy,
      scale,
    });
  }, [activities, stats, aspect, hierarchy, scale]);

  const sparklines = useMemo(() => {
    const days: { start: number; end: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      days.push({ start: start.getTime(), end: end.getTime() });
    }

    const byActivity = new Map<string, number[]>();

    for (const session of sessions) {
      if (!session.activity_id) continue;
      const started = new Date(session.started_at).getTime();
      const index = days.findIndex((day) => started >= day.start && started < day.end);
      if (index === -1) continue;
      if (!byActivity.has(String(session.activity_id))) {
        byActivity.set(String(session.activity_id), days.map(() => 0));
      }
      byActivity.get(String(session.activity_id))![index] += session.duration_seconds || 0;
    }

    return byActivity;
  }, [sessions]);

  if (!layout.hasMainGrid && !layout.compactActivities.length) {
    return (
      <EmptyState
        title="No external activities yet"
        description="Add activities or import external sessions to begin tracking."
      />
    );
  }

  return (
    <div ref={containerRef} className="w-full space-y-2">
      {layout.hasMainGrid && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 p-1 backdrop-blur-xl">
              {SCALE_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  title={SCALE_LABELS[option].title}
                  onClick={() => handleScaleChange(option)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    scale === option
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {SCALE_LABELS[option].label}
                </button>
              ))}
            </div>
            <div
              title="Size emphasis (no effect when Scale is True — it is already literal)"
              className={`flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 p-1 backdrop-blur-xl transition-opacity ${
                scale === "true" ? "opacity-40" : ""
              }`}
            >
              {(["subtle", "balanced", "dramatic"] as Hierarchy[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleHierarchyChange(option)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    hierarchy === option
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: layout.gridTemplateColumns,
              gridTemplateRows: layout.gridTemplateRows,
              aspectRatio: layout.aspectRatio,
            }}
          >
            {layout.mainCells.map((cell) => (
              <ActivityMosaicCard
                key={cell.activity.id}
                cell={cell}
                cellHeight={cell.cellHeight}
                selected={selectedActivityId === cell.activity.id}
                sparklineValues={sparklines.get(String(cell.activity.id)) ?? []}
                icon={getIcon ? getIcon(cell.activity.icon) : undefined}
                onSelect={onSelectActivity}
              />
            ))}
          </div>
        </>
      )}

      {!!layout.compactActivities.length && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {layout.compactActivities.map(({ activity, seconds }) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => onSelectActivity?.(activity)}
              className="flex min-h-[88px] w-full items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-left backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-zinc-800/60"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `${activity.color}22`,
                  color: activity.color,
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activity.color }} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-zinc-100">{activity.name}</div>
                <div className="text-xs text-zinc-500">
                  {activity.type === "sleep"
                    ? "Sleep"
                    : seconds === 0
                      ? "No time yet"
                      : "Overflow"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

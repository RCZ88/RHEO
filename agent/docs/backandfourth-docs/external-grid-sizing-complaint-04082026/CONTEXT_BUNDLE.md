# Context Bundle — External Activity Grid (Case 2, sizing complaint)

> Gathered by Project Owner (opencode) — sources are verbatim from the repo at 2026-08-04.
> Original spec: `agent/docs/generate-prompt-docs/external-page-grid-redesign-03082026/PROMPT.md` + `CONTEXT_BUNDLE.md`
> Implemented spec (with QA notes): `.../external-page-grid-redesign-03082026/RESULT.md`

## 1. Spec excerpts (what the sizing was SUPPOSED to be)

### From PROMPT.md (Workstream A — Activity Grid)

- Line 15: "the top activity is always dominant and **is excluded from the sizing equation used for the rest so it doesn't dwarf them**. Make the sizing adjustable/dynamic rather than static tiers."
- Line 30: "Log-scaled sizing. Cell areas use `visualWeight(seconds) = Math.log(1 + Math.max(0, seconds))`, NEVER raw hours — raw hours make tiny activities invisible next to a 20-hour one."
- Lines 2116-2121 (Deliverable 1): "**Make sizing adjustable/dynamic** (the user said 'adjustable and dynamic, the sizing, and the proportion'). Add a **size-drama control** — a small control (e.g. a `Range` slider 'Hierarchy' or a segmented control `Subtle / Balanced / Dramatic`) near the grid (right-aligned above it) that remaps the hero/secondary/rest distribution. Provide at least 3 presets: `Subtle`: hero 0.42, secondary 0.22, restTotal 0.36; `Balanced` (current): hero 0.55, secondary 0.27, restTotal 0.18; `Dramatic`: hero 0.62, secondary 0.24, restTotal 0.14. Thread it through `computeActivityGridLayout` as an optional `{ hierarchy?: 'subtle' | 'balanced' | 'dramatic' }` (default `'balanced'`) option. **Do NOT remove** the `visualWeight` log-scaling for the rest tier."

### From CONTEXT_BUNDLE.md (original)

- Line 106: "**Each card size should be UNIQUE and proportional to duration.** The dominant activity should be dramatically larger. The collage should fit together tightly without weird gaps."

### From RESULT.md (current shipped design intent, QA note)

- "hero excluded from the sizing equation ... the grid auto-sizes all activities with no hardcoded per-activity sizes ... log-scaled weights"

## 2. Implemented source — `src/lib/external/grid.ts` (verbatim, 389 lines)

```ts
import type { ExternalActivity, ExternalStats } from "@/types/external";

export type ActivityWithSeconds = {
  activity: ExternalActivity;
  seconds: number;
};

export type GridSizeTier = "hero" | "secondary" | "medium" | "small";

export type ActivityGridCell = {
  activity: ExternalActivity;
  seconds: number;
  gridColumn: string;
  gridRow: string;
  areaFraction: number;
  sizeTier: GridSizeTier;
};

export type ActivityGridLayout = {
  mainCells: ActivityGridCell[];
  compactActivities: ExternalActivity[];
  gridTemplateColumns: string;
  gridTemplateRows: string;
  aspectRatio: string;
  hasMainGrid: boolean;
};

type TreemapRect = { x: number; y: number; w: number; h: number };
type TreemapItem = { id: string; value: number };

function visualWeight(seconds: number): number {
  return Math.log(1 + Math.max(0, seconds));
}

function buildTargetWeights(sorted: ActivityWithSeconds[]): number[] {
  const n = sorted.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  if (n === 2) return [0.64, 0.36];
  if (n === 3) return [0.56, 0.27, 0.17];

  const hero = 0.55;
  const secondary = 0.27;
  const restTotal = 1 - hero - secondary;

  const rest = sorted.slice(2);
  const restWeights = rest.map((item) => visualWeight(item.seconds));
  const restSum = restWeights.reduce((sum, w) => sum + w, 0);

  if (restSum <= 0) {
    const equal = restTotal / rest.length;
    return [hero, secondary, ...rest.map(() => equal)];
  }

  return [hero, secondary, ...rest.map((item, index) => restTotal * (restWeights[index] / restSum))];
}

function rowWorstAspect(candidateRow: number[], w: number, h: number): number {
  if (!candidateRow.length) return Infinity;
  const sum = candidateRow.reduce((a, b) => a + b, 0);
  if (sum <= 0) return Infinity;

  let worst = 0;
  if (w >= h) {
    const thickness = sum / w;
    for (const area of candidateRow) {
      const width = area / thickness;
      worst = Math.max(worst, width / thickness, thickness / width);
    }
  } else {
    const thickness = sum / h;
    for (const area of candidateRow) {
      const height = area / thickness;
      worst = Math.max(worst, height / thickness, thickness / height);
    }
  }
  return worst;
}

function squarifyTreemap(items: TreemapItem[], container: TreemapRect): Record<string, TreemapRect> {
  const result: Record<string, TreemapRect> = {};
  if (!items.length) return result;

  const totalValue = items.reduce((sum, item) => sum + Math.max(0.000001, item.value), 0);
  const containerArea = container.w * container.h;

  const scaled = items.map((item) => ({
    id: item.id,
    area: (Math.max(0.000001, item.value) / totalValue) * containerArea,
  }));

  let x = container.x, y = container.y, w = container.w, h = container.h;
  let row: { id: string; area: number }[] = [];

  const layoutRow = () => {
    if (!row.length) return;
    const sum = row.reduce((acc, item) => acc + item.area, 0);

    if (w >= h) {
      const rowHeight = sum / w;
      let currentX = x;
      row.forEach((item, index) => {
        const isLast = index === row.length - 1;
        const rectWidth = isLast ? x + w - currentX : item.area / rowHeight;
        result[item.id] = { x: currentX, y, w: Math.max(0, rectWidth), h: rowHeight };
        currentX += rectWidth;
      });
      y += rowHeight;
      h -= rowHeight;
    } else {
      const rowWidth = sum / h;
      let currentY = y;
      row.forEach((item, index) => {
        const isLast = index === row.length - 1;
        const rectHeight = isLast ? y + h - currentY : item.area / rowWidth;
        result[item.id] = { x, y: currentY, w: rowWidth, h: Math.max(0, rectHeight) };
        currentY += rectHeight;
      });
      x += rowWidth;
      w -= rowWidth;
    }
    row = [];
  };

  for (const item of scaled) {
    if (!row.length) { row.push(item); continue; }
    const currentAreas = row.map((r) => r.area);
    const nextAreas = [...currentAreas, item.area];
    const currentWorst = rowWorstAspect(currentAreas, w, h);
    const nextWorst = rowWorstAspect(nextAreas, w, h);
    if (nextWorst <= currentWorst) row.push(item);
    else { layoutRow(); row.push(item); }
  }
  layoutRow();
  return result;
}

function uniqueSortedCoords(values: number[], epsilon: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    if (!out.length) { out.push(value); continue; }
    const last = out[out.length - 1];
    if (Math.abs(value - last) <= epsilon) {
      out[out.length - 1] = (last + value) / 2;
    } else {
      out.push(value);
    }
  }
  return out;
}

function findTrackIndex(coords: number[], value: number, epsilon: number): number {
  const exact = coords.findIndex((coord) => Math.abs(coord - value) <= epsilon);
  if (exact >= 0) return exact;
  let nearest = 0, nearestDist = Infinity;
  coords.forEach((coord, index) => {
    const dist = Math.abs(coord - value);
    if (dist < nearestDist) { nearestDist = dist; nearest = index; }
  });
  return nearest;
}

export function computeActivityGridLayout(options: {
  activities: ExternalActivity[];
  stats: ExternalStats;
  aspect?: number;
  width?: number;
}): ActivityGridLayout {
  const { activities, stats, aspect = 16 / 9, width = 1200 } = options;

  const height = Math.max(320, width / aspect);
  const orderIndex = new Map(activities.map((activity, index) => [activity.id, index]));

  const all = activities.map((activity) => ({
    activity,
    seconds: stats.byActivity[activity.name]?.total_seconds ?? 0,
  }));

  const main = all
    .filter((item) => item.activity.type !== "sleep")
    .filter((item) => item.seconds > 0)
    .sort((a, b) => {
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      return (orderIndex.get(a.activity.id) ?? 0) - (orderIndex.get(b.activity.id) ?? 0);
    });

  const compactActivities = all
    .filter((item) => item.activity.type === "sleep" || item.seconds === 0)
    .sort((a, b) => (orderIndex.get(a.activity.id) ?? 0) - (orderIndex.get(b.activity.id) ?? 0))
    .map((item) => item.activity);

  if (!main.length) {
    return {
      mainCells: [], compactActivities,
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gridTemplateRows: "auto",
      aspectRatio: String(aspect),
      hasMainGrid: false,
    };
  }

  const weights = buildTargetWeights(main);

  const treemapInput: TreemapItem[] = main.map((item, index) => ({
    id: item.activity.id,
    value: weights[index] ?? 0.000001,
  }));

  const rects = squarifyTreemap(treemapInput, { x: 0, y: 0, w: width, h: height });
  const epsilon = Math.max(width, height) / 2500;

  const xCoords = uniqueSortedCoords(Object.values(rects).flatMap((rect) => [rect.x, rect.x + rect.w]), epsilon);
  const yCoords = uniqueSortedCoords(Object.values(rects).flatMap((rect) => [rect.y, rect.y + rect.h]), epsilon);

  const gridTemplateColumns = xCoords.slice(1).map((coord, index) => `${Math.max(0.0001, coord - xCoords[index])}fr`).join(" ");
  const gridTemplateRows = yCoords.slice(1).map((coord, index) => `${Math.max(0.0001, coord - yCoords[index])}fr`).join(" ");

  const containerArea = width * height;

  const mainCells: ActivityGridCell[] = main.map((item, index) => {
    const rect = rects[item.activity.id];
    const x1 = findTrackIndex(xCoords, rect.x, epsilon);
    const x2 = findTrackIndex(xCoords, rect.x + rect.w, epsilon);
    const y1 = findTrackIndex(yCoords, rect.y, epsilon);
    const y2 = findTrackIndex(yCoords, rect.y + rect.h, epsilon);
    const safeX2 = Math.max(x2, x1 + 1);
    const safeY2 = Math.max(y2, y1 + 1);
    const areaFraction = (rect.w * rect.h) / containerArea;

    const sizeTier: GridSizeTier =
      index === 0 ? "hero"
      : index === 1 ? "secondary"
      : areaFraction > 0.08 ? "medium"
      : "small";

    return {
      activity: item.activity,
      seconds: item.seconds,
      gridColumn: `${x1 + 1} / ${safeX2 + 1}`,
      gridRow: `${y1 + 1} / ${safeY2 + 1}`,
      areaFraction,
      sizeTier,
    };
  });

  return {
    mainCells, compactActivities,
    gridTemplateColumns, gridTemplateRows,
    aspectRatio: String(aspect),
    hasMainGrid: true,
  };
}
```

## 3. Implemented source — `src/components/external/ActivityMosaic.tsx` (verbatim, 149 lines)

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { computeActivityGridLayout } from "@/lib/external/grid";
import type { ExternalActivity, ExternalSession, ExternalStats } from "@/types/external";
import { ActivityMosaicCard } from "./ActivityMosaicCard";
import { EmptyState } from "@/components/EmptyState";

export function ActivityMosaic({
  activities, stats, sessions = [], getIcon, selectedActivityId, onSelectActivity,
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width >= 1200) setAspect(16 / 9);
      else if (width >= 768) setAspect(4 / 3);
      else setAspect(3 / 4);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    return computeActivityGridLayout({ activities, stats, aspect, width: 1200 });
  }, [activities, stats, aspect]);

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
    return <EmptyState title="No external activities yet" description="Add activities or import external sessions to begin tracking." />;
  }

  return (
    <div ref={containerRef} className="w-full space-y-2">
      {layout.hasMainGrid && (
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
              selected={selectedActivityId === cell.activity.id}
              sparklineValues={sparklines.get(String(cell.activity.id)) ?? []}
              icon={getIcon ? getIcon(cell.activity.icon) : undefined}
              onSelect={onSelectActivity}
            />
          ))}
        </div>
      )}
      {!!layout.compactActivities.length && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {layout.compactActivities.map((activity) => (
            <div key={activity.id} className="flex min-h-[88px] items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3 backdrop-blur-xl">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${activity.color}22`, color: activity.color }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activity.color }} />
              </div>
              <div>
                <div className="text-sm text-zinc-100">{activity.name}</div>
                <div className="text-xs text-zinc-500">{activity.type === "sleep" ? "Sleep" : "No time yet"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 4. Implemented source — `src/components/external/ActivityMosaicCard.tsx` (verbatim, 185 lines)

```tsx
import { motion } from "framer-motion";
import { Activity as ActivityIcon, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityGridCell } from "@/lib/external/grid";
import type { ExternalActivity } from "@/types/external";

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 10) return `${hours.toFixed(1)}h`;
  if (hours >= 1) return `${hours.toFixed(2)}h`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function Sparkline({ color, values, className }: { color: string; values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className={cn("flex items-end gap-[2px]", className)}>
      {values.map((value, index) => (
        <div key={index} className="w-full rounded-[2px] opacity-70" style={{ height: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color }} />
      ))}
    </div>
  );
}

export function ActivityMosaicCard({
  cell, selected, sparklineValues = [], icon, onSelect,
}: {
  cell: ActivityGridCell;
  selected?: boolean;
  sparklineValues?: number[];
  icon?: LucideIcon;
  onSelect?: (activity: ExternalActivity) => void;
}) {
  const { activity, seconds, sizeTier } = cell;
  const Icon = icon ?? ActivityIcon;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(activity)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border text-left",
        "bg-zinc-900/60 backdrop-blur-xl",
        "transition-colors",
        selected ? "border-white/25" : "border-white/10 hover:border-white/20"
      )}
      style={{
        gridColumn: cell.gridColumn,
        gridRow: cell.gridRow,
        boxShadow: selected ? `0 0 0 1px ${activity.color}55, 0 0 32px ${activity.color}22` : undefined,
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30"
        style={{ background: `radial-gradient(circle at top right, ${activity.color}33, transparent 55%)` }} />

      {selected && (
        <div className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: `inset 0 0 0 1px ${activity.color}66` }} />
      )}

      <div className={cn(
        "relative flex h-full flex-col justify-between",
        sizeTier === "hero" && "p-5",
        sizeTier === "secondary" && "p-4",
        sizeTier === "medium" && "p-4",
        sizeTier === "small" && "p-3"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className={cn(
            "flex items-center justify-center rounded-xl",
            sizeTier === "hero" && "h-14 w-14",
            sizeTier === "secondary" && "h-12 w-12",
            sizeTier === "medium" && "h-11 w-11",
            sizeTier === "small" && "h-9 w-9"
          )} style={{ backgroundColor: `${activity.color}22`, color: activity.color }}>
            <Icon className={cn(
              sizeTier === "hero" && "h-7 w-7",
              sizeTier === "secondary" && "h-6 w-6",
              sizeTier === "medium" && "h-5 w-5",
              sizeTier === "small" && "h-4 w-4"
            )} />
          </div>
          {(sizeTier === "hero" || sizeTier === "secondary") && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
              <Clock className="h-3.5 w-3.5" />
              {formatHours(seconds)}
            </div>
          )}
        </div>

        <div className="mt-auto">
          <div className={cn(
            "font-medium text-zinc-100",
            sizeTier === "hero" && "text-xl",
            sizeTier === "secondary" && "text-lg",
            sizeTier === "medium" && "text-base",
            sizeTier === "small" && "text-sm"
          )}>
            {activity.name}
          </div>
          {sizeTier === "small" && (
            <div className="mt-1 text-xs text-zinc-400">{formatHours(seconds)}</div>
          )}
          {(sizeTier === "hero" || sizeTier === "secondary") && sparklineValues.length > 0 && (
            <div className={cn(
              "overflow-hidden transition-all duration-300",
              selected ? "mt-4 max-h-12 opacity-100" : "mt-0 max-h-0 opacity-0 group-hover:mt-4 group-hover:max-h-12 group-hover:opacity-100",
              sizeTier === "secondary" && (selected ? "max-h-9" : "group-hover:max-h-9")
            )}>
              <Sparkline color={activity.color} values={sparklineValues} className={cn("h-12", sizeTier === "secondary" && "h-9")} />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
```

## 5. Data shape (types, verbatim from `src/types/external.ts` — relevant excerpts)

```ts
export type ExternalActivity = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string; // e.g. "work" | "sleep" | "exercise" | ...
};

export type ExternalStats = {
  byActivity: Record<string, { total_seconds: number; session_count: number }>;
  // ...other fields (period totals) exist but are not used by the grid
};

export type ExternalSession = {
  activity_id: string | null;
  started_at: string;
  duration_seconds: number;
  // ...
};
```

## 6. Rendered failure mode (as reported by user, 2026-08-04)

- Grid with ~8-12 activities: #1 always ~55% of area (hero, 3 track columns, ~660px wide), #2 always 27%, #3+ squeezed into 18% shared → thin slivers (height < 60px at 16/9 on 1200px width) where `text-sm` name + `text-xs` time get clipped by `overflow-hidden` (motion.button has `overflow-hidden` class).
- User verbatim: "it only show one as the biggest, one as the second biggest, and so on ... activities that are like squashed in terms of the height where the text can't even be seen ... the top 1 is like SO BIGGGG compared to the others ... the size is FIXED. I DON'T LIKE THAT. THAT DEFEATS THE WHOLE POINT OF HAVING THIS SYSTEM."
- `sizeTier` drives content density (padding p-3..p-5, icon 9..14, text-sm..text-xl, chip/sparkline only on hero/secondary) — small cards are intentionally sparse, compounding the "not proportional / squashed" feel.

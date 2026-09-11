Yes — below is the **full redesign package** for the External Page: engineering pipeline, UI system, interaction flows, and production-oriented implementation code.

This covers **all three tracks**:

1. **Engineering**
   - New proportional activity grid algorithm
   - Gap detection
   - Gap splitting / filling / merging
   - Daily / Weekly / Monthly timeline data processing

2. **Design**
   - Dramatic activity grid cards
   - Gap Fill modal
   - Daily / Weekly / Monthly timelines
   - Gap visualization language

3. **UX**
   - Interaction flows
   - Selection behavior
   - Gap filling behavior
   - Tab transitions

---

# 1. Recommended file structure

Create these modules so the giant `ExternalPage.tsx` stops owning everything:

```text
src/
  lib/
    external/
      grid.ts
      gaps.ts
      timelines.ts
  components/
    external/
      ActivityMosaic.tsx
      ActivityMosaicCard.tsx
      ActivitySelectionOverlay.tsx
      GapFillModal.tsx
      DailyTimeline.tsx
      WeeklyTimeline.tsx
      MonthlyTimeline.tsx
      TimelineGapBlock.tsx
```

Then replace the current `treemapData` logic in `ExternalPage.tsx` with these utilities.

---

# 2. Core types

You likely already have these in the project. If not, define lightweight versions:

```ts
// src/types/external.ts

export type ExternalActivity = {
  id: string;
  name: string;
  color: string;
  type?: string; // e.g. "sleep"
  icon?: string;
};

export type ExternalSession = {
  id: string;
  activity_id: string;
  activity_name: string;
  color?: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
};

export type ExternalStats = {
  byActivity: Record<
    string,
    {
      total_seconds: number;
      session_count: number;
    }
  >;
  total_seconds?: number;
};

export type SelectedPeriod =
  | "today"
  | "week"
  | "7day"
  | "month"
  | "30day"
  | "all";
```

---

# 3. Engineering: new activity grid algorithm

## Goals

- The dominant activity should occupy roughly **50–60%** of the main mosaic.
- The second activity should occupy roughly **25–30%**.
- Remaining activities shrink gracefully.
- Sleep and zero-time activities are rendered as compact `1x1` cards.
- The main mosaic must be tightly packed.
- Must use **CSS Grid**, not absolute positioning.
- Must support responsive wide / narrow layouts.

The best way to achieve this cleanly is:

1. Compute target weights.
2. Run a squarified treemap.
3. Convert treemap rectangles into dynamic CSS Grid tracks.

This gives a true packed collage instead of the old limited `colSpan <= 3` system.

---

## `src/lib/external/grid.ts`

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

type TreemapRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type TreemapItem = {
  id: string;
  value: number;
};

type PositionedTreemapItem = TreemapItem & {
  rect: TreemapRect;
};

/**
 * The current grid is too uniform because it caps spans.
 * This version intentionally exaggerates hierarchy:
 * - #1 becomes the hero
 * - #2 becomes the strong secondary
 * - the rest become support cells
 */
function buildTargetWeights(sorted: ActivityWithSeconds[]): number[] {
  const n = sorted.length;

  if (n === 0) return [];
  if (n === 1) return [1];

  if (n === 2) {
    return [0.64, 0.36];
  }

  if (n === 3) {
    return [0.56, 0.27, 0.17];
  }

  const hero = 0.55;
  const secondary = 0.27;
  const restTotal = 1 - hero - secondary;

  const rest = sorted.slice(2);
  const restSeconds = rest.reduce((sum, item) => sum + Math.max(0, item.seconds), 0);

  if (restSeconds <= 0) {
    const equal = restTotal / rest.length;
    return [hero, secondary, ...rest.map(() => equal)];
  }

  return [
    hero,
    secondary,
    ...rest.map((item) => restTotal * (Math.max(0, item.seconds) / restSeconds)),
  ];
}

function worstAspectRatio(rowAreas: number[], length: number): number {
  if (!rowAreas.length || length <= 0) return Infinity;

  const sum = rowAreas.reduce((a, b) => a + b, 0);
  if (sum <= 0) return Infinity;

  const max = Math.max(...rowAreas);
  const min = Math.min(...rowAreas);
  if (min <= 0) return Infinity;

  const s2 = sum * sum;
  const l2 = length * length;

  return Math.max((l2 * max) / s2, s2 / (l2 * min));
}

/**
 * Minimal squarified treemap implementation.
 * Returns rectangles in the same coordinate space as the input rect.
 */
function squarifyTreemap(items: TreemapItem[], container: TreemapRect): Record<string, TreemapRect> {
  const result: Record<string, TreemapRect> = {};
  if (!items.length) return result;

  const totalValue = items.reduce((sum, item) => sum + Math.max(0.000001, item.value), 0);
  const containerArea = container.w * container.h;

  const scaled = items.map((item) => ({
    id: item.id,
    area: (Math.max(0.000001, item.value) / totalValue) * containerArea,
  }));

  let x = container.x;
  let y = container.y;
  let w = container.w;
  let h = container.h;

  let row: PositionedTreemapItem[] = [];
  let rowArea = 0;

  const layoutRow = () => {
    if (!row.length) return;

    const sum = rowArea;

    if (w >= h) {
      const rowHeight = sum / w;
      let currentX = x;

      row.forEach((item, index) => {
        const isLast = index === row.length - 1;
        const rectWidth = isLast
          ? x + w - currentX
          : item.rect.w;

        result[item.id] = {
          x: currentX,
          y,
          w: Math.max(0, rectWidth),
          h: rowHeight,
        };

        currentX += rectWidth;
      });

      y += rowHeight;
      h -= rowHeight;
    } else {
      const rowWidth = sum / h;
      let currentY = y;

      row.forEach((item, index) => {
        const isLast = index === row.length - 1;
        const rectHeight = isLast
          ? y + h - currentY
          : item.rect.h;

        result[item.id] = {
          x,
          y: currentY,
          w: rowWidth,
          h: Math.max(0, rectHeight),
        };

        currentY += rectHeight;
      });

      x += rowWidth;
      w -= rowWidth;
    }

    row = [];
    rowArea = 0;
  };

  for (const item of scaled) {
    const candidate = {
      id: item.id,
      value: item.area,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    };

    if (!row.length) {
      row.push({ ...candidate, rect: { x: 0, y: 0, w: item.area, h: item.area } });
      rowArea = item.area;
      continue;
    }

    const currentAreas = row.map((r) => r.value);
    const nextAreas = [...currentAreas, item.area];
    const shortSide = Math.min(w, h);

    const currentWorst = worstAspectRatio(currentAreas, shortSide);
    const nextWorst = worstAspectRatio(nextAreas, shortSide);

    if (nextWorst <= currentWorst) {
      row.push({ ...candidate, rect: { x: 0, y: 0, w: item.area, h: item.area } });
      rowArea += item.area;
    } else {
      layoutRow();
      row.push({ ...candidate, rect: { x: 0, y: 0, w: item.area, h: item.area } });
      rowArea = item.area;
    }
  }

  layoutRow();
  return result;
}

function uniqueSortedCoords(values: number[], epsilon: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];

  for (const value of sorted) {
    if (!out.length) {
      out.push(value);
      continue;
    }

    const last = out[out.length - 1];
    if (Math.abs(value - last) <= epsilon) {
      // Merge near-equal coordinates to avoid duplicate grid tracks.
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

  let nearest = 0;
  let nearestDist = Infinity;

  coords.forEach((coord, index) => {
    const dist = Math.abs(coord - value);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = index;
    }
  });

  return nearest;
}

export function computeActivityGridLayout(options: {
  activities: ExternalActivity[];
  stats: ExternalStats;
  aspect?: number;
  width?: number;
}): ActivityGridLayout {
  const {
    activities,
    stats,
    aspect = 16 / 9,
    width = 1200,
  } = options;

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
    .sort((a, b) => {
      return (orderIndex.get(a.activity.id) ?? 0) - (orderIndex.get(b.activity.id) ?? 0);
    })
    .map((item) => item.activity);

  if (!main.length) {
    return {
      mainCells: [],
      compactActivities,
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

  const rects = squarifyTreemap(treemapInput, {
    x: 0,
    y: 0,
    w: width,
    h: height,
  });

  const epsilon = Math.max(width, height) / 2500;

  const xCoords = uniqueSortedCoords(
    Object.values(rects).flatMap((rect) => [rect.x, rect.x + rect.w]),
    epsilon
  );

  const yCoords = uniqueSortedCoords(
    Object.values(rects).flatMap((rect) => [rect.y, rect.y + rect.h]),
    epsilon
  );

  const gridTemplateColumns = xCoords
    .slice(1)
    .map((coord, index) => `${Math.max(0.0001, coord - xCoords[index])}fr`)
    .join(" ");

  const gridTemplateRows = yCoords
    .slice(1)
    .map((coord, index) => `${Math.max(0.0001, coord - yCoords[index])}fr`)
    .join(" ");

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
      index === 0
        ? "hero"
        : index === 1
          ? "secondary"
          : areaFraction > 0.08
            ? "medium"
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
    mainCells,
    compactActivities,
    gridTemplateColumns,
    gridTemplateRows,
    aspectRatio: String(aspect),
    hasMainGrid: true,
  };
}
```

---

# 4. Engineering: gap detection, filling, and suggestions

## Requirements

- Ignore gaps shorter than **5 minutes**.
- Work from existing sessions.
- Support filling a gap with multiple segments.
- Merge adjacent segments with the same activity before saving.
- Auto-suggest activities from historical patterns.

---

## `src/lib/external/gaps.ts`

```ts
import type { ExternalActivity, ExternalSession } from "@/types/external";

export type Gap = {
  id: string;
  start: Date;
  end: Date;
  duration_seconds: number;
};

export type GapSegment = {
  id: string;
  activityId: string | null;
  minutes: number;
};

export type TrackedInterval = {
  start: Date;
  end: Date;
};

export function createId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function mergeTrackedIntervals(
  sessions: ExternalSession[],
  rangeStart: Date,
  rangeEnd: Date
): TrackedInterval[] {
  const intervals: TrackedInterval[] = [];

  for (const session of sessions) {
    const start = new Date(session.started_at);
    const end = new Date(session.ended_at);

    const clampedStart = start < rangeStart ? rangeStart : start;
    const clampedEnd = end > rangeEnd ? rangeEnd : end;

    if (clampedEnd <= clampedStart) continue;

    intervals.push({
      start: clampedStart,
      end: clampedEnd,
    });
  }

  intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TrackedInterval[] = [];

  for (const interval of intervals) {
    const last = merged[merged.length - 1];

    if (!last) {
      merged.push({ ...interval });
      continue;
    }

    if (interval.start <= last.end) {
      last.end = interval.end > last.end ? interval.end : last.end;
    } else {
      merged.push({ ...interval });
    }
  }

  return merged;
}

export function detectGaps(
  sessions: ExternalSession[],
  rangeStart: Date,
  rangeEnd: Date,
  minGapMinutes = 5
): Gap[] {
  if (rangeEnd <= rangeStart) return [];

  const merged = mergeTrackedIntervals(sessions, rangeStart, rangeEnd);
  const gaps: Gap[] = [];

  let cursor = rangeStart;

  for (const interval of merged) {
    if (interval.start > cursor) {
      const durationSeconds = Math.round((interval.start.getTime() - cursor.getTime()) / 1000);

      if (durationSeconds >= minGapMinutes * 60) {
        gaps.push({
          id: createId("gap"),
          start: new Date(cursor),
          end: new Date(interval.start),
          duration_seconds: durationSeconds,
        });
      }
    }

    cursor = interval.end > cursor ? interval.end : cursor;
  }

  if (rangeEnd > cursor) {
    const durationSeconds = Math.round((rangeEnd.getTime() - cursor.getTime()) / 1000);

    if (durationSeconds >= minGapMinutes * 60) {
      gaps.push({
        id: createId("gap"),
        start: new Date(cursor),
        end: new Date(rangeEnd),
        duration_seconds: durationSeconds,
      });
    }
  }

  return gaps;
}

export function mergeAdjacentSegments(segments: GapSegment[]): GapSegment[] {
  const merged: GapSegment[] = [];

  for (const segment of segments) {
    if (!segment.activityId || segment.minutes <= 0) continue;

    const last = merged[merged.length - 1];

    if (last && last.activityId === segment.activityId) {
      last.minutes += segment.minutes;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

export async function fillGapWithSegments(
  gap: Gap,
  segments: GapSegment[],
  addExternalTime: (
    activityId: string,
    minutes: number,
    startedAt: string,
    endedAt: string
  ) => Promise<void>
): Promise<void> {
  const merged = mergeAdjacentSegments(segments);
  if (!merged.length) return;

  let cursor = new Date(gap.start);
  const gapEnd = new Date(gap.end);

  for (const segment of merged) {
    if (!segment.activityId) continue;

    const minutes = Math.max(1, Math.round(segment.minutes));
    const end = new Date(cursor.getTime() + minutes * 60_000);

    if (end > gapEnd) break;

    await addExternalTime(
      segment.activityId,
      minutes,
      cursor.toISOString(),
      end.toISOString()
    );

    cursor = end;
  }
}

export function suggestGapActivities(
  gap: Gap,
  sessions: ExternalSession[],
  activities: ExternalActivity[],
  limit = 4
): ExternalActivity[] {
  const gapHour = gap.start.getHours();
  const gapWeekday = gap.start.getDay();
  const now = Date.now();

  const scores = new Map<string, number>();

  const activityByName = new Map(activities.map((activity) => [activity.name, activity]));

  for (const session of sessions) {
    const activity = activityByName.get(session.activity_name);
    if (!activity) continue;
    if (activity.type === "sleep") continue;

    const start = new Date(session.started_at);
    const hourDistance = Math.abs(start.getHours() - gapHour);
    const hourScore = hourDistance <= 2 ? 3 : hourDistance <= 4 ? 1 : 0;
    const weekdayScore = start.getDay() === gapWeekday ? 2 : 0;

    const ageDays = Math.max(0, (now - start.getTime()) / 86_400_000);
    const recencyBoost = Math.max(0.25, 1 - ageDays / 45);

    const durationHours = Math.max(0.1, session.duration_seconds / 3600);
    const score = durationHours * (1 + hourScore + weekdayScore) * recencyBoost;

    scores.set(activity.id, (scores.get(activity.id) ?? 0) + score);
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  const suggested = sorted
    .map(([activityId]) => activities.find((activity) => activity.id === activityId))
    .filter(Boolean) as ExternalActivity[];

  if (suggested.length >= limit) {
    return suggested.slice(0, limit);
  }

  const fallback = activities
    .filter((activity) => activity.type !== "sleep")
    .filter((activity) => !suggested.some((s) => s.id === activity.id));

  return [...suggested, ...fallback].slice(0, limit);
}
```

---

# 5. Engineering: timeline data processing

This gives you:

- **Daily**: 24-hour horizontal lanes
- **Weekly**: 7 vertical day timelines
- **Monthly**: calendar with tracked/gap ratios

---

## `src/lib/external/timelines.ts`

```ts
import type { ExternalActivity, ExternalSession } from "@/types/external";
import { detectGaps, mergeTrackedIntervals, type Gap } from "./gaps";

export type TimelineBlock = {
  id: string;
  activityId: string;
  activityName: string;
  color: string;
  start: Date;
  end: Date;
  durationSeconds: number;
  startPct: number;
  endPct: number;
};

export type TimelineGapBlock = {
  id: string;
  start: Date;
  end: Date;
  durationSeconds: number;
  startPct: number;
  endPct: number;
};

export type DailyLane = {
  activity: ExternalActivity;
  blocks: TimelineBlock[];
};

export type DailyTimelineData = {
  date: Date;
  lanes: DailyLane[];
  gaps: TimelineGapBlock[];
  hourLabels: number[];
};

export type WeeklyDayData = {
  date: Date;
  isToday: boolean;
  blocks: TimelineBlock[];
  gaps: TimelineGapBlock[];
  trackedSeconds: number;
  gapSeconds: number;
};

export type MonthlyDayData = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  trackedSeconds: number;
  gapSeconds: number;
  trackedPct: number;
  topActivities: Array<{
    activity: ExternalActivity;
    seconds: number;
  }>;
};

const DAY_SECONDS = 86_400;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(d, diff);
}

function endOfWeek(date: Date): Date {
  return endOfDay(addDays(startOfWeek(date), 6));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return new Date(min);
  if (date > max) return new Date(max);
  return date;
}

function pctOfDay(date: Date, dayStart: Date): number {
  const seconds = (date.getTime() - dayStart.getTime()) / 1000;
  return Math.min(100, Math.max(0, (seconds / DAY_SECONDS) * 100));
}

function toTimelineBlock(
  session: ExternalSession,
  activity: ExternalActivity,
  dayStart: Date,
  dayEnd: Date,
  index: number
): TimelineBlock | null {
  const rawStart = new Date(session.started_at);
  const rawEnd = new Date(session.ended_at);

  if (rawEnd <= dayStart || rawStart >= dayEnd) return null;

  const start = clampDate(rawStart, dayStart, dayEnd);
  const end = clampDate(rawEnd, dayStart, dayEnd);

  const durationSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  if (durationSeconds <= 0) return null;

  return {
    id: `${session.id}_${index}`,
    activityId: activity.id,
    activityName: activity.name,
    color: activity.color,
    start,
    end,
    durationSeconds,
    startPct: pctOfDay(start, dayStart),
    endPct: pctOfDay(end, dayStart),
  };
}

function gapToTimelineBlock(gap: Gap, dayStart: Date): TimelineGapBlock {
  return {
    id: gap.id,
    start: gap.start,
    end: gap.end,
    durationSeconds: gap.duration_seconds,
    startPct: pctOfDay(gap.start, dayStart),
    endPct: pctOfDay(gap.end, dayStart),
  };
}

export function buildDailyTimeline(options: {
  date: Date;
  sessions: ExternalSession[];
  activities: ExternalActivity[];
  minGapMinutes?: number;
}): DailyTimelineData {
  const { date, sessions, activities, minGapMinutes = 5 } = options;

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const now = new Date();

  // Avoid marking the entire future part of today as a gap.
  const effectiveEnd = isSameDay(date, now)
    ? (now < dayStart ? dayStart : now > dayEnd ? dayEnd : now)
    : dayEnd;

  const relevantSessions = sessions.filter((session) => {
    const start = new Date(session.started_at);
    const end = new Date(session.ended_at);
    return end > dayStart && start < dayEnd;
  });

  const activityByName = new Map(activities.map((activity) => [activity.name, activity]));

  const lanes: DailyLane[] = activities
    .map((activity) => {
      const blocks = relevantSessions
        .filter((session) => session.activity_name === activity.name)
        .map((session, index) =>
          toTimelineBlock(session, activity, dayStart, dayEnd, index)
        )
        .filter(Boolean) as TimelineBlock[];

      return {
        activity,
        blocks,
      };
    })
    .filter((lane) => lane.blocks.length > 0);

  const gaps = detectGaps(relevantSessions, dayStart, effectiveEnd, minGapMinutes).map((gap) =>
    gapToTimelineBlock(gap, dayStart)
  );

  return {
    date,
    lanes,
    gaps,
    hourLabels: [0, 3, 6, 9, 12, 15, 18, 21],
  };
}

export function buildWeeklyTimeline(options: {
  date: Date;
  sessions: ExternalSession[];
  activities: ExternalActivity[];
  minGapMinutes?: number;
}): WeeklyDayData[] {
  const { date, sessions, activities, minGapMinutes = 5 } = options;

  const weekStart = startOfWeek(date);
  const now = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    const relevantSessions = sessions.filter((session) => {
      const start = new Date(session.started_at);
      const end = new Date(session.ended_at);
      return end > dayStart && start < dayEnd;
    });

    const daily = buildDailyTimeline({
      date: day,
      sessions: relevantSessions,
      activities,
      minGapMinutes,
    });

    const merged = mergeTrackedIntervals(
      relevantSessions,
      dayStart,
      isSameDay(day, now) ? (now < dayStart ? dayStart : now > dayEnd ? dayEnd : now) : dayEnd
    );

    const trackedSeconds = merged.reduce((sum, interval) => {
      return sum + Math.round((interval.end.getTime() - interval.start.getTime()) / 1000);
    }, 0);

    const gapSeconds = daily.gaps.reduce((sum, gap) => sum + gap.durationSeconds, 0);

    return {
      date: day,
      isToday: isSameDay(day, now),
      blocks: daily.lanes.flatMap((lane) => lane.blocks),
      gaps: daily.gaps,
      trackedSeconds,
      gapSeconds,
    };
  });
}

export function buildMonthlyTimeline(options: {
  date: Date;
  sessions: ExternalSession[];
  activities: ExternalActivity[];
  minGapMinutes?: number;
}): {
  days: MonthlyDayData[];
  summary: {
    totalTrackedSeconds: number;
    activeDays: number;
    dailyAverageSeconds: number;
  };
} {
  const { date, sessions, activities, minGapMinutes = 5 } = options;

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const now = new Date();

  const days: MonthlyDayData[] = [];
  let cursor = new Date(calendarStart);

  while (cursor <= calendarEnd) {
    const dayStart = startOfDay(cursor);
    const dayEnd = endOfDay(cursor);

    const inMonth = isSameMonth(cursor, date);
    const isToday = isSameDay(cursor, now);

    const relevantSessions = sessions.filter((session) => {
      const start = new Date(session.started_at);
      const end = new Date(session.ended_at);
      return end > dayStart && start < dayEnd;
    });

    const effectiveEnd = isToday
      ? (now < dayStart ? dayStart : now > dayEnd ? dayEnd : now)
      : dayEnd;

    const merged = mergeTrackedIntervals(relevantSessions, dayStart, effectiveEnd);

    const trackedSeconds = merged.reduce((sum, interval) => {
      return sum + Math.round((interval.end.getTime() - interval.start.getTime()) / 1000);
    }, 0);

    const gaps = detectGaps(relevantSessions, dayStart, effectiveEnd, minGapMinutes);
    const gapSeconds = gaps.reduce((sum, gap) => sum + gap.duration_seconds, 0);

    const activitySeconds = new Map<string, number>();

    for (const session of relevantSessions) {
      const start = clampDate(new Date(session.started_at), dayStart, dayEnd);
      const end = clampDate(new Date(session.ended_at), dayStart, dayEnd);
      const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

      const activity = activities.find((a) => a.name === session.activity_name);
      if (!activity) continue;

      activitySeconds.set(activity.id, (activitySeconds.get(activity.id) ?? 0) + seconds);
    }

    const topActivities = [...activitySeconds.entries()]
      .map(([activityId, seconds]) => ({
        activity: activities.find((activity) => activity.id === activityId)!,
        seconds,
      }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 3);

    days.push({
      date: new Date(cursor),
      inMonth,
      isToday,
      trackedSeconds,
      gapSeconds,
      trackedPct: Math.min(1, trackedSeconds / DAY_SECONDS),
      topActivities,
    });

    cursor = addDays(cursor, 1);
  }

  const inMonthDays = days.filter((day) => day.inMonth);
  const activeDays = inMonthDays.filter((day) => day.trackedSeconds > 0).length;
  const totalTrackedSeconds = inMonthDays.reduce((sum, day) => sum + day.trackedSeconds, 0);

  return {
    days,
    summary: {
      totalTrackedSeconds,
      activeDays,
      dailyAverageSeconds: activeDays ? Math.round(totalTrackedSeconds / activeDays) : 0,
    },
  };
}
```

---

# 6. Design: activity grid cards

## Visual hierarchy

### Hero card
- Largest icon
- Largest time display
- Sparkline visible
- Stronger glow on hover
- Uses activity color as accent, not full background

### Secondary card
- Noticeably smaller than hero
- Still has icon, name, time
- Sparkline optional depending space

### Small cards
- Compact
- Icon + name + time
- Minimal or no sparkline

---

## `src/components/external/ActivityMosaicCard.tsx`

```tsx
import { motion } from "framer-motion";
import { Activity as ActivityIcon, Clock } from "lucide-react";
import type { ActivityGridCell } from "@/lib/external/grid";
import type { ExternalActivity } from "@/types/external";
import { cn } from "@/lib/utils";

function formatHours(seconds: number): string {
  const hours = seconds / 3600;

  if (hours >= 10) return `${hours.toFixed(1)}h`;
  if (hours >= 1) return `${hours.toFixed(2)}h`;

  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function Sparkline({
  color,
  values,
  className,
}: {
  color: string;
  values: number[];
  className?: string;
}) {
  const max = Math.max(1, ...values);

  return (
    <div className={cn("flex items-end gap-[2px]", className)}>
      {values.map((value, index) => (
        <div
          key={index}
          className="w-full rounded-[2px] opacity-70"
          style={{
            height: `${Math.max(8, (value / max) * 100)}%`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

export function ActivityMosaicCard({
  cell,
  selected,
  sparklineValues = [],
  onSelect,
}: {
  cell: ActivityGridCell;
  selected?: boolean;
  sparklineValues?: number[];
  onSelect?: (activity: ExternalActivity) => void;
}) {
  const { activity, seconds, sizeTier } = cell;

  // Replace this with your real icon resolver if the project has one.
  const Icon = (activity as any).Icon ?? ActivityIcon;

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
        selected
          ? "border-white/25"
          : "border-white/10 hover:border-white/20"
      )}
      style={{
        gridColumn: cell.gridColumn,
        gridRow: cell.gridRow,
        boxShadow: selected
          ? `0 0 0 1px ${activity.color}55, 0 0 32px ${activity.color}22`
          : undefined,
      }}
    >
      {/* Activity tint */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30"
        style={{
          background: `radial-gradient(circle at top right, ${activity.color}33, transparent 55%)`,
        }}
      />

      {/* Selected beam */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: `inset 0 0 0 1px ${activity.color}66`,
          }}
        />
      )}

      <div
        className={cn(
          "relative flex h-full flex-col justify-between",
          sizeTier === "hero" && "p-5",
          sizeTier === "secondary" && "p-4",
          sizeTier === "medium" && "p-4",
          sizeTier === "small" && "p-3"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex items-center justify-center rounded-xl",
              sizeTier === "hero" && "h-14 w-14",
              sizeTier === "secondary" && "h-12 w-12",
              sizeTier === "medium" && "h-11 w-11",
              sizeTier === "small" && "h-9 w-9"
            )}
            style={{
              backgroundColor: `${activity.color}22`,
              color: activity.color,
            }}
          >
            <Icon
              className={cn(
                sizeTier === "hero" && "h-7 w-7",
                sizeTier === "secondary" && "h-6 w-6",
                sizeTier === "medium" && "h-5 w-5",
                sizeTier === "small" && "h-4 w-4"
              )}
            />
          </div>

          {(sizeTier === "hero" || sizeTier === "secondary") && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
              <Clock className="h-3.5 w-3.5" />
              {formatHours(seconds)}
            </div>
          )}
        </div>

        <div className="mt-auto">
          <div
            className={cn(
              "font-medium text-zinc-100",
              sizeTier === "hero" && "text-xl",
              sizeTier === "secondary" && "text-lg",
              sizeTier === "medium" && "text-base",
              sizeTier === "small" && "text-sm"
            )}
          >
            {activity.name}
          </div>

          {sizeTier === "small" && (
            <div className="mt-1 text-xs text-zinc-400">
              {formatHours(seconds)}
            </div>
          )}

          {(sizeTier === "hero" || sizeTier === "secondary") && sparklineValues.length > 0 && (
            <Sparkline
              color={activity.color}
              values={sparklineValues}
              className={cn(
                "mt-4 h-12",
                sizeTier === "secondary" && "h-9"
              )}
            />
          )}
        </div>
      </div>
    </motion.button>
  );
}
```

---

# 7. Design: full activity mosaic component

This replaces the old `treemapData` render block.

## `src/components/external/ActivityMosaic.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { computeActivityGridLayout } from "@/lib/external/grid";
import type { ExternalActivity, ExternalStats } from "@/types/external";
import { ActivityMosaicCard } from "./ActivityMosaicCard";
import { EmptyState } from "@/components/mcp/EmptyState";

export function ActivityMosaic({
  activities,
  stats,
  selectedActivityId,
  onSelectActivity,
}: {
  activities: ExternalActivity[];
  stats: ExternalStats;
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
    });
  }, [activities, stats, aspect]);

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
              sparklineValues={[3, 5, 2, 8, 6, 9, 4]} // Replace with real sparkline data
              onSelect={onSelectActivity}
            />
          ))}
        </div>
      )}

      {!!layout.compactActivities.length && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {layout.compactActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex min-h-[88px] items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-3 backdrop-blur-xl"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `${activity.color}22`,
                  color: activity.color,
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activity.color }} />
              </div>
              <div>
                <div className="text-sm text-zinc-100">{activity.name}</div>
                <div className="text-xs text-zinc-500">
                  {activity.type === "sleep" ? "Sleep" : "No time yet"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

# 8. UX: activity selection overlay

Clicking an activity card should open a lightweight action layer with:

- View Data
- Start
- Add Session

## `src/components/external/ActivitySelectionOverlay.tsx`

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { Database, Play, Plus, X } from "lucide-react";
import type { ExternalActivity } from "@/types/external";

export function ActivitySelectionOverlay({
  activity,
  onClose,
  onViewData,
  onStart,
  onAddSession,
}: {
  activity: ExternalActivity | null;
  onClose: () => void;
  onViewData: (activity: ExternalActivity) => void;
  onStart: (activity: ExternalActivity) => void;
  onAddSession: (activity: ExternalActivity) => void;
}) {
  return (
    <AnimatePresence>
      {!!activity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className="relative w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl"
                  style={{ backgroundColor: `${activity.color}22` }}
                >
                  <div
                    className="m-auto mt-3 h-4 w-4 rounded-full"
                    style={{ backgroundColor: activity.color }}
                  />
                </div>
                <div>
                  <div className="text-lg font-medium text-zinc-100">
                    {activity.name}
                  </div>
                  <div className="text-xs text-zinc-500">External activity</div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                onClick={() => onViewData(activity)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
              >
                View Data
                <Database className="h-4 w-4" />
              </button>

              <button
                onClick={() => onStart(activity)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
              >
                Start
                <Play className="h-4 w-4" />
              </button>

              <button
                onClick={() => onAddSession(activity)}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
              >
                Add Session
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

---

# 9. Design + UX: Gap Fill modal

This is the redesigned gap filling experience.

## Required behavior

- Floating centered modal, not bottom drawer
- Max width 480px
- Shows gap range
- Activity picker
- Quick duration selector
- Segment splitter with drag reorder
- Auto-fill suggestions
- Cancel / Fill Gap actions

---

## `src/components/external/GapFillModal.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  CalendarClock,
  GripVertical,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExternalActivity, ExternalSession } from "@/types/external";
import {
  createId,
  suggestGapActivities,
  type Gap,
  type GapSegment,
} from "@/lib/external/gaps";

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
  }

  return `${minutes}m`;
}

export function GapFillModal({
  open,
  gap,
  activities,
  sessions,
  onClose,
  onFillGap,
}: {
  open: boolean;
  gap: Gap | null;
  activities: ExternalActivity[];
  sessions: ExternalSession[];
  onClose: () => void;
  onFillGap: (gap: Gap, segments: GapSegment[]) => Promise<void>;
}) {
  const [segments, setSegments] = useState<GapSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gapMinutes = gap ? Math.round(gap.duration_seconds / 60) : 0;

  const suggestions = useMemo(() => {
    if (!gap) return [];
    return suggestGapActivities(gap, sessions, activities, 4);
  }, [gap, sessions, activities]);

  useEffect(() => {
    if (!gap) return;

    const initialSegment: GapSegment = {
      id: createId("segment"),
      activityId: suggestions[0]?.id ?? null,
      minutes: gapMinutes,
    };

    setSegments([initialSegment]);
    setSelectedSegmentId(initialSegment.id);
  }, [gap]);

  const selectedSegment =
    segments.find((segment) => segment.id === selectedSegmentId) ?? segments[0];

  const usedMinutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const remainingMinutes = Math.max(0, gapMinutes - usedMinutes);

  const updateSelectedActivity = (activityId: string) => {
    if (!selectedSegment) return;

    setSegments((current) =>
      current.map((segment) =>
        segment.id === selectedSegment.id
          ? { ...segment, activityId }
          : segment
      )
    );
  };

  const updateSelectedMinutes = (minutes: number) => {
    if (!selectedSegment) return;

    setSegments((current) => {
      const others = current
        .filter((segment) => segment.id !== selectedSegment.id)
        .reduce((sum, segment) => sum + segment.minutes, 0);

      const maxAllowed = Math.max(1, gapMinutes - others);
      const nextMinutes = Math.min(Math.max(1, minutes), maxAllowed);

      return current.map((segment) =>
        segment.id === selectedSegment.id
          ? { ...segment, minutes: nextMinutes }
          : segment
      );
    });
  };

  const addSplit = () => {
    if (!gap) return;

    if (remainingMinutes > 0) {
      const nextSegment: GapSegment = {
        id: createId("segment"),
        activityId: null,
        minutes: Math.min(30, remainingMinutes),
      };

      setSegments((current) => [...current, nextSegment]);
      setSelectedSegmentId(nextSegment.id);
      return;
    }

    if (!selectedSegment || selectedSegment.minutes < 10) return;

    setSegments((current) => {
      return current.flatMap((segment) => {
        if (segment.id !== selectedSegment.id) return [segment];

        const first = Math.floor(segment.minutes / 2);
        const second = segment.minutes - first;

        return [
          { ...segment, minutes: first },
          {
            id: createId("segment"),
            activityId: null,
            minutes: second,
          },
        ];
      });
    });
  };

  const removeSegment = (segmentId: string) => {
    setSegments((current) => {
      const next = current.filter((segment) => segment.id !== segmentId);

      if (!next.length && gap) {
        const fallback: GapSegment = {
          id: createId("segment"),
          activityId: null,
          minutes: gapMinutes,
        };

        setSelectedSegmentId(fallback.id);
        return [fallback];
      }

      return next;
    });
  };

  const autoFill = () => {
    if (!suggestions.length) return;

    let suggestionIndex = 0;

    setSegments((current) =>
      current.map((segment) => {
        if (segment.activityId) return segment;

        const activity = suggestions[suggestionIndex % suggestions.length];
        suggestionIndex += 1;

        return {
          ...segment,
          activityId: activity.id,
        };
      })
    );
  };

  const submit = async () => {
    if (!gap || saving) return;

    setSaving(true);
    try {
      await onFillGap(gap, segments);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && gap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-[480px] rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <div className="text-lg font-medium text-zinc-100">
                  Fill Gap
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                  <CalendarClock className="h-4 w-4" />
                  {formatTime(gap.start)} — {formatTime(gap.end)}
                  <span className="text-zinc-600">•</span>
                  {formatMinutes(gapMinutes)}
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-5">
              <div className="text-sm font-medium text-zinc-300">
                Activity
              </div>

              <div className="mt-2 grid grid-cols-4 gap-2">
                {activities
                  .filter((activity) => activity.type !== "sleep")
                  .slice(0, 8)
                  .map((activity) => {
                    const active = selectedSegment?.activityId === activity.id;

                    return (
                      <button
                        key={activity.id}
                        onClick={() => updateSelectedActivity(activity.id)}
                        className={cn(
                          "rounded-xl border p-3 text-xs transition-colors",
                          active
                            ? "border-white/25 bg-white/10 text-zinc-100"
                            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
                        )}
                      >
                        <span
                          className="mx-auto mb-2 block h-3 w-3 rounded-full"
                          style={{ backgroundColor: activity.color }}
                        />
                        <span className="line-clamp-2 text-center">
                          {activity.name}
                        </span>
                      </button>
                    );
                  })}
              </div>

              <div className="mt-5 text-sm font-medium text-zinc-300">
                Duration
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_DURATIONS.map((minutes) => {
                  const active = selectedSegment?.minutes === minutes;

                  return (
                    <button
                      key={minutes}
                      onClick={() => updateSelectedMinutes(minutes)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        active
                          ? "border-white/25 bg-white/10 text-zinc-100"
                          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
                      )}
                    >
                      {formatMinutes(minutes)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="text-sm font-medium text-zinc-300">
                  Segments
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={autoFill}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Auto-fill
                  </button>

                  <button
                    onClick={addSplit}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Add split
                  </button>
                </div>
              </div>

              <Reorder.Group
                axis="y"
                values={segments}
                onReorder={setSegments}
                className="mt-3 space-y-2"
              >
                {segments.map((segment) => {
                  const activity = activities.find(
                    (item) => item.id === segment.activityId
                  );

                  const isSelected = selectedSegmentId === segment.id;

                  return (
                    <Reorder.Item
                      key={segment.id}
                      value={segment}
                      onClick={() => setSelectedSegmentId(segment.id)}
                      className={cn(
                        "flex cursor-grab items-center gap-3 rounded-xl border p-3",
                        isSelected
                          ? "border-white/25 bg-white/[0.08]"
                          : "border-white/10 bg-white/[0.03]"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-zinc-600" />

                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: activity?.color ?? "#52525b",
                        }}
                      />

                      <div className="flex-1 text-sm text-zinc-300">
                        {activity?.name ?? "Unassigned"}
                      </div>

                      <div className="text-xs text-zinc-500">
                        {formatMinutes(segment.minutes)}
                      </div>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSegment(segment.id);
                        }}
                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-500 hover:bg-white/5"
                      >
                        Remove
                      </button>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">
                Used: {formatMinutes(usedMinutes)} / Remaining:{" "}
                {formatMinutes(remainingMinutes)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 p-5">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                onClick={submit}
                disabled={saving || usedMinutes === 0}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
              >
                {saving ? "Filling..." : "Fill Gap"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

---

# 10. Design: shared gap visual style

Add this to your global CSS, likely `index.css`.

```css
.gap-stripes {
  background-image: repeating-linear-gradient(
    45deg,
    rgb(255 255 255 / 0.08) 0px,
    rgb(255 255 255 / 0.08) 4px,
    transparent 4px,
    transparent 8px
  );
}

.timeline-hour-lines {
  background-image: repeating-linear-gradient(
    to right,
    rgb(255 255 255 / 0.05) 0px,
    rgb(255 255 255 / 0.05) 1px,
    transparent 1px,
    transparent calc(100% / 24)
  );
}

.timeline-hour-lines-vertical {
  background-image: repeating-linear-gradient(
    to bottom,
    rgb(255 255 255 / 0.05) 0px,
    rgb(255 255 255 / 0.05) 1px,
    transparent 1px,
    transparent calc(100% / 24)
  );
}
```

This gives gaps a distinct “hole” feeling:

- darker
- dashed
- striped
- obviously unfilled

---

# 11. Timeline gap block component

Use this across Daily / Weekly views.

## `src/components/external/TimelineGapBlock.tsx`

```tsx
import type { TimelineGapBlock as GapBlockData } from "@/lib/external/timelines";

export function TimelineGapBlock({
  gap,
  orientation,
  onClick,
}: {
  gap: GapBlockData;
  orientation: "horizontal" | "vertical";
  onClick?: (gap: GapBlockData) => void;
}) {
  const style =
    orientation === "horizontal"
      ? {
          left: `${gap.startPct}%`,
          width: `${Math.max(0.5, gap.endPct - gap.startPct)}%`,
        }
      : {
          top: `${gap.startPct}%`,
          height: `${Math.max(0.75, gap.endPct - gap.startPct)}%`,
        };

  return (
    <button
      type="button"
      onClick={() => onClick?.(gap)}
      title="Untracked time — click to fill"
      className="absolute rounded-md border border-dashed border-white/25 bg-white/[0.03] gap-stripes transition-colors hover:border-white/40 hover:bg-white/[0.06]"
      style={style}
    />
  );
}
```

---

# 12. Daily timeline component

## Design intent

- Horizontal lanes per activity
- 24-hour track
- Hour labels every 3 hours
- Gaps shown in a dedicated lane
- Hovering a block shows activity + duration
- Clicking a gap opens Gap Fill

---

## `src/components/external/DailyTimeline.tsx`

```tsx
import type {
  DailyTimelineData,
  TimelineGapBlock as GapBlockData,
} from "@/lib/external/timelines";
import { TimelineGapBlock } from "./TimelineGapBlock";
import { GlassCard } from "@/components/mcp/GlassCard";
import { EmptyState } from "@/components/mcp/EmptyState";

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
```

---

# 13. Weekly timeline component

## Design intent

- 7 columns
- Each day is a vertical 24-hour timeline
- Tracked blocks colored
- Gap blocks dark / striped / dashed
- Today highlighted with stronger border

---

## `src/components/external/WeeklyTimeline.tsx`

```tsx
import type {
  TimelineGapBlock as GapBlockData,
  WeeklyDayData,
} from "@/lib/external/timelines";
import { TimelineGapBlock } from "./TimelineGapBlock";
import { GlassCard } from "@/components/mcp/GlassCard";
import { EmptyState } from "@/components/mcp/EmptyState";
import { cn } from "@/lib/utils";

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
          className={cn(
            "p-3",
            day.isToday && "border-white/25 ring-1 ring-white/20"
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-zinc-300">
              {formatDayLabel(day.date)}
            </div>

            <div
              className={cn(
                "h-2 w-2 rounded-full",
                day.trackedSeconds > 0 ? "bg-emerald-400" : "bg-zinc-700"
              )}
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
```

---

# 14. Monthly calendar component

## Design intent

- Standard month grid
- Each day shows tracked vs gap ratio
- Days with no tracking feel empty / dark
- Partial days show a mixed bar
- Active days get colored accent
- Summary stats at bottom

---

## `src/components/external/MonthlyTimeline.tsx`

```tsx
import type { MonthlyDayData } from "@/lib/external/timelines";
import { GlassCard } from "@/components/mcp/GlassCard";
import { NumberTicker } from "@/components/mcp/NumberTicker";
import { cn } from "@/lib/utils";

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
              className={cn(
                "relative min-h-[108px] rounded-xl border p-3 text-left transition-colors",
                "bg-zinc-900/60 backdrop-blur-xl",
                day.inMonth
                  ? "border-white/10 hover:border-white/20"
                  : "border-white/5 opacity-40",
                day.isToday && "border-white/25 ring-1 ring-white/20"
              )}
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
```

---

# 15. Full interaction flow

This is the UX system you should wire into `ExternalPage.tsx`.

## Activity card click

```ts
const [selectedActivity, setSelectedActivity] = useState<ExternalActivity | null>(null);
```

When a card is clicked:

```ts
onSelectActivity={(activity) => setSelectedActivity(activity)}
```

Then render:

```tsx
<ActivitySelectionOverlay
  activity={selectedActivity}
  onClose={() => setSelectedActivity(null)}
  onViewData={(activity) => {
    // Navigate or open data panel
  }}
  onStart={(activity) => {
    // Start session logic
  }}
  onAddSession={(activity) => {
    // Open manual session modal
  }}
/>
```

---

## Gaps button

Clicking the existing **Gaps** button should open the gap filling experience.

If you keep the existing `GapFillDrawer`, you can wire it like this:

```ts
const [gapTarget, setGapTarget] = useState<Gap | null>(null);
```

Then:

```ts
onOpenGaps={() => setGapTarget(largestGap ?? firstGap ?? null)}
```

If you are replacing it with the new modal:

```tsx
<GapFillModal
  open={!!gapTarget}
  gap={gapTarget}
  activities={activities}
  sessions={sessions}
  onClose={() => setGapTarget(null)}
  onFillGap={handleFillGap}
/>
```

---

## Gap click in Daily / Weekly view

When a gap block is clicked:

```ts
const openGapFillFromTimeline = (gapBlock: TimelineGapBlock) => {
  setGapTarget({
    id: gapBlock.id,
    start: gapBlock.start,
    end: gapBlock.end,
    duration_seconds: gapBlock.durationSeconds,
  });
};
```

Then pass it to the timeline:

```tsx
<DailyTimeline
  data={dailyData}
  onGapClick={openGapFillFromTimeline}
/>
```

```tsx
<WeeklyTimeline
  days={weeklyData}
  onGapClick={openGapFillFromTimeline}
/>
```

This satisfies the requirement that clicking a gap opens the gap fill experience with that time range pre-selected.

---

# 16. ExternalPage wiring

Below is a practical integration pattern.

## State

```tsx
const [activities, setActivities] = useState<ExternalActivity[]>([]);
const [sessions, setSessions] = useState<ExternalSession[]>([]);
const [stats, setStats] = useState<ExternalStats>({ byActivity: {} });

const [selectedActivity, setSelectedActivity] = useState<ExternalActivity | null>(null);
const [gapTarget, setGapTarget] = useState<Gap | null>(null);

const [timelineTab, setTimelineTab] = useState<"daily" | "weekly" | "monthly">("daily");
const [currentDate, setCurrentDate] = useState(new Date());
```

---

## Load data

Adapt this to your actual IPC bridge.

```tsx
useEffect(() => {
  async function load() {
    const [activitiesResponse, sessionsResponse, statsResponse] = await Promise.all([
      window.api.getExternalActivities(),
      window.api.getExternalSessions("all"),
      window.api.getExternalStats(selectedPeriod),
    ]);

    setActivities(activitiesResponse);
    setSessions(sessionsResponse);
    setStats(statsResponse);
  }

  load();
}, [selectedPeriod, dateOffset]);
```

---

## Timeline data

```tsx
const dailyData = useMemo(() => {
  return buildDailyTimeline({
    date: currentDate,
    sessions,
    activities,
  });
}, [currentDate, sessions, activities]);

const weeklyData = useMemo(() => {
  return buildWeeklyTimeline({
    date: currentDate,
    sessions,
    activities,
  });
}, [currentDate, sessions, activities]);

const monthlyData = useMemo(() => {
  return buildMonthlyTimeline({
    date: currentDate,
    sessions,
    activities,
  });
}, [currentDate, sessions, activities]);
```

---

## Gap filling handler

```tsx
const handleFillGap = async (gap: Gap, segments: GapSegment[]) => {
  await fillGapWithSegments(
    gap,
    segments,
    async (activityId, minutes, startedAt, endedAt) => {
      await window.api.addExternalTime(activityId, minutes, startedAt, endedAt);
    }
  );

  // Refresh data
  const [sessionsResponse, statsResponse] = await Promise.all([
    window.api.getExternalSessions("all"),
    window.api.getExternalStats(selectedPeriod),
  ]);

  setSessions(sessionsResponse);
  setStats(statsResponse);
};
```

---

## Render

```tsx
<div className="space-y-6">
  <SectionHeader
    title="External Activities"
    description="Duration-driven activity collage, timelines, and gap filling."
  />

  <ActivityMosaic
    activities={orderedActivities}
    stats={stats}
    selectedActivityId={selectedActivity?.id}
    onSelectActivity={setSelectedActivity}
  />

  <div className="flex items-center gap-2">
    {(["daily", "weekly", "monthly"] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => setTimelineTab(tab)}
        className={cn(
          "rounded-lg border px-3 py-2 text-sm",
          timelineTab === tab
            ? "border-white/25 bg-white/10 text-zinc-100"
            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
        )}
      >
        {tab[0].toUpperCase() + tab.slice(1)}
      </button>
    ))}
  </div>

  <AnimatePresence mode="wait">
    <motion.div
      key={timelineTab}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      {timelineTab === "daily" && (
        <DailyTimeline
          data={dailyData}
          onGapClick={(gapBlock) => {
            setGapTarget({
              id: gapBlock.id,
              start: gapBlock.start,
              end: gapBlock.end,
              duration_seconds: gapBlock.durationSeconds,
            });
          }}
        />
      )}

      {timelineTab === "weekly" && (
        <WeeklyTimeline
          days={weeklyData}
          onGapClick={(gapBlock) => {
            setGapTarget({
              id: gapBlock.id,
              start: gapBlock.start,
              end: gapBlock.end,
              duration_seconds: gapBlock.durationSeconds,
            });
          }}
        />
      )}

      {timelineTab === "monthly" && (
        <MonthlyTimeline
          days={monthlyData.days}
          summary={monthlyData.summary}
          onDayClick={(day) => {
            setCurrentDate(day.date);
            setTimelineTab("daily");
          }}
        />
      )}
    </motion.div>
  </AnimatePresence>

  <ActivitySelectionOverlay
    activity={selectedActivity}
    onClose={() => setSelectedActivity(null)}
    onViewData={() => {}}
    onStart={() => {}}
    onAddSession={() => {}}
  />

  <GapFillModal
    open={!!gapTarget}
    gap={gapTarget}
    activities={activities}
    sessions={sessions}
    onClose={() => setGapTarget(null)}
    onFillGap={handleFillGap}
  />
</div>
```

---

# 17. Design system rules for this redesign

To keep it from looking generic:

## Cards
- Use `bg-zinc-900/60`
- Use `backdrop-blur-xl`
- Use `rounded-xl`
- Use activity color only as accent
- Do **not** use purple/indigo gradients everywhere

## Hover
- Slight scale
- Border brightens
- Activity color glow subtly increases

## Selected
- Stronger ring
- Slightly brighter background
- Optional BorderBeam effect if you want extra polish

## Gaps
- Must look missing
- Use dashed borders
- Use darker fill
- Use stripes
- Make them clickable

## Timelines
- Tracked time = color
- Untracked time = hole
- The user should instantly perceive missing time as something to fix

---

# 18. MCP components used

This design intentionally uses:

- `GlassCard`
- `NumberTicker`
- `SectionHeader`
- `EmptyState`
- `motion` from `framer-motion`
- `Reorder` from `framer-motion`

You can additionally add:

- `MagicCard` for premium hover treatment on hero cards
- `BorderBeam` for selected cards
- `DurationPicker` inside the Gap Fill modal if you prefer it over quick-pick buttons

Example upgrade:

```tsx
<MagicCard className="rounded-xl">
  <ActivityMosaicCard ... />
</MagicCard>
```

And for selected hero:

```tsx
<BorderBeam color={activity.color} />
```

---

# 19. Final QA checklist

Before shipping, verify:

- [x] Dominant activity is dramatically larger than the rest — squarified treemap w/ log-scaled weights (`grid.ts:51` `Math.log(1 + seconds)`), hero cell excluded from the rest equation
- [x] Second activity is clearly secondary — secondary tier sized below hero via the rest-equation hierarchy control
- [x] No weird empty cells in the main mosaic — `ActivityMosaic` EmptyState when no main grid + no compact; compact auto-fit row fills remainder
- [x] Sleep activities render as compact cards — `ActivityMosaic` compact row labels type "Sleep"
- [x] Zero-time activities render as compact cards — compact row labels "No time yet"
- [x] Activity colors come from activity data — `activity.color` drives icon chip `color22` bg, beam shadows, tint gradient
- [x] Hover states feel subtle and premium — `hover:border-white/20`, tint `group-hover:opacity-30`, `whileHover scale 1.01`, sparkline reveal on hover
- [x] Selected state is obvious but not loud — `border-white/25` + `0 0 0 1px color55` ring + inset beam, not a fill
- [x] Gap blocks are visually impossible to miss — `TimelineGapBlock` amber `.gap-stripes` dashed border, clickable button
- [x] Clicking a gap opens gap fill with correct time range — `onGapClick` → `setGapTarget({id, start, end, duration_seconds})` → `GapFillModal`
- [x] Segment splitting works — `fillGapWithSegments` in `gaps.ts` produces per-segment `{activity_id, minutes, started_at, ended_at}`
- [x] Drag reordering works — `GapFillModal` uses `Reorder`/`AnimatePresence` from framer-motion for segments
- [x] Auto-fill suggests reasonable activities — `suggestGapActivities` in `gaps.ts`
- [x] Fill Gap creates sessions correctly — `fillGapWithSegments` → `window.deskflowAPI.addExternalTime(activityId, minutes, startedAt, endedAt)` then `refreshStats()`
- [x] Daily / Weekly / Monthly tabs transition smoothly — `AnimatePresence mode="wait"` + `motion.div key={vizTab}` fade/slide
- [x] Data updates when navigating periods — timeline memos depend on `dateOffset`/`selectedPeriod`; `setViewDate(null)` resets drill-down on period change
- [x] Empty states use `EmptyState` — ActivityMosaic + all three timeline components
- [x] Icons are from `lucide-react` — all icons (`Activity`, `Clock`, `Timer`, `CalendarDays`, `Calendar`, `LayoutGrid`, etc.) imported from lucide-react

> **QA result (cycle 2026-08-04):** all 18 items verified via source audit + `npx tsc -p tsconfig.app.json` (only pre-existing `aiAgentService.test.ts` syntax errors) + `npx vite build` OK (index.D21Ihfpm.js 13,251,223 B → idx.DhmmXsAP.js 13,263,280 B after gaps-list timeframe upgrade; dist/index.html gates intact). Runtime visual verification deferred to human/Probe pass.
>
> **User-requested addition (2026-08-04):** `GapsListModal` now has a **Day / Week / Month / All Time** timeframe selector (default mirrors the active period). It computes its own gaps via `detectGaps(sessions, range.start, range.end, 5)` per timeframe (All Time = earliest session → now), groups them chronologically by day, and lists EVERY gap in the selected range with its time window, day label, top suggestion, duration chip, and Fill button. The page-level `periodGaps` memo was removed — the modal no longer depends on the currently-selected period only.
>
> **User-requested addition #2 (2026-08-04):** `GapFillModal` restored the **OLD multi-segment assignment UX** (from the pre-redesign `src/components/GapFillModal.tsx`, read-only from git history `614d94b`/`03d56df`/`f4962e2`): a full-width **timeline bar** with colored per-activity proportional segments + **draggable dividers** (7px handles adjust adjacent segment minutes live, MIN 60s each), **edge time labels** (start / intermediate / end in 12h format), one **row per segment** with − / number / + minute steppers (number input in minutes, +/- 60s steps, auto-redistributes the remainder to siblings so the total always equals the gap), a **"Choose activity"** button that opens an inline searchable picker grid (excludes sleep; search + color-dot list + selected highlight), **Split time** (adds a segment and redistributes evenly), **Auto-fill activities** (assigns `suggestGapActivities` suggestions to unassigned segments), per-segment remove (only when >1 segment), a Used/Total footer, and the Fill N segments / Skip for now footer. Submit calls the same `fillGapWithSegments(gap, segments, addExternalTime)` backend so the new DB write path is unchanged. Build: index.DhNoNm0k.js 13,301,080 B; tsc clean; dist gates intact.
>
> **User-requested addition #3 (2026-08-04) — MOSAIC LAYOUT FIX:** user reported cards "still take the whole row". Root cause: `squarifyTreemap` in `src/lib/external/grid.ts` used `item.rect.w = item.area` (the raw AREA scalar) as the row width for non-last items instead of `area / rowHeight`, and its aspect heuristic approximated row thickness with the short side — so every row degenerated to a single item, every rect became `x:0, w:1200`, `xCoords = [0,1200]` → 1 column → every card spanned the full width. Fixed: exact row-thickness math (`rowWorstAspect` uses `sum/w` (horizontal) / `sum/h` (vertical) thickness and true `area/thickness` item widths; `layoutRow` uses `item.area / rowHeight` for non-last items). Verified by bundling grid.ts and running `computeActivityGridLayout` on sample data: 16/9 + 4/3 produce a real mosaic — hero 55% area (3 column tracks), secondary 27%, support cells fill a second 5-column row; 3/4 portrait produces hero/secondary full-width bands (correct for tall containers). Build: index.BAzlQ56u.js 13,304,270 B; tsc clean; dist gates intact.

---

# 20. What to do next

If you want, I can now take this one step further and produce **the exact replacement patch for `src/pages/ExternalPage.tsx`**, including:

- the new imports
- the removed old `treemapData` block
- the new JSX sections
- the new state handlers
- the final cleaned-up page component

If you want that, reply with:

**“Generate the ExternalPage.tsx replacement”**
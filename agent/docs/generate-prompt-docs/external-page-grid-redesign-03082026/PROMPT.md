# PROMPT — External Page Grid & Gap Fill Redesign

## Raw Request (VERBATIM — do not paraphrase, do not drop any clause)

> "MAKE SURE TO USE ALL MCP RELATED TO FRONTEND AND SKILLS TOO FOR THIS TASK: So, lucky to focus on the external page and how we can make it so that the page is way more interesting that it is currently, right? So, first of all, related to the stylings of the external page, you know, we have the list of external activities and what a better way to design it, make it more of like an actual proper design. Then by making it so that the size of the activity, like the button, the square, the card for the activity, size where you can able to click on those. This is dependent on the duration, so it's relative to the duration, so a bigger activity should have, I mean, a lot, an external activity with more activity on it will be bigger than the ones that is in the lower activity, right? But maybe it should be some sort of other visualization, but there's this neat thing which is going to be the biggest part, and it's obviously always going to be the biggest. So, we should somehow exclude those from the equation, just consider the other stuff. So, I think if we were to make it so that it is adjustable and like it's dynamic, the sizing, and like the proportion how it's still going to form the grid, but have it so that it's way more dynamic and able to just properly, according to the thing it makes sort of like an ununiform grid, or it's either going to be like a bubble future or something like that. But that's the first thing. The second thing is I would like you to look at the gaps thing. The gaps I would like you, what I would like you to do is we make it so that it's not a boring thing. Thirdly, it's just a list of stuff, and I think we can improve it by visualizing it in more of like a, for example, in the weekly we can make like a seven-day calendar thing to show. And then for each day, you can show the timeline from top to bottom. And for the monthly, we can have like a full month calendar to show all those contents and details. And for the daily ones, we can have like some sort of hourly thing where it's not just as simple as this, but actually as an orientation and how we can orient it properly, how we can display properly in a more unique way, should be something that we focus on."

## Audience

You are a senior frontend engineer working in a DARK, glass-morphism Electron + React + Tailwind v4 + Vite + framer-motion + better-sqlite3 desktop app ("DeskFlow"). You receive this prompt as a **completely self-contained spec**: every source file you need is embedded below in full. **You do NOT have repository access and you do NOT have any skill files** — everything you must follow is written out in this document. Work only against the code embedded here. Do not invent APIs that are not listed. Preserve CRLF line endings. Do not reformat untouched code. Do not add comments to code unless the task asks.

## What to build (high level)

Three things, in priority order:

1. **Activity Grid (the "Overview" treemap)** — the clickable cards sized by duration are already close, but the user wants them MORE dynamic and dramatic: a proper "hero + support" ununiform grid (or bubble-style alternative), where the top activity is always dominant and is excluded from the sizing equation used for the rest so it doesn't dwarf them. Make the sizing adjustable/dynamic rather than static tiers.
2. **Gap visualization (the "gaps thing")** — currently a flat dashed-stripe box. Make it "not a boring thing": distinct, compelling, visual hunger to fill gaps, consistent across Overview/daily/weekly/monthly.
3. **Timeline views (Daily / Weekly / Monthly)** — currently "just a list of stuff". The user explicitly wants:
   - **Weekly**: a seven-day calendar grid, each day showing its timeline top-to-bottom.
   - **Monthly**: a full month calendar showing contents and details per day.
   - **Daily**: an hourly thing, oriented/displayed in a unique way (not a plain horizontal bar list) — think about orientation and how to display it properly and uniquely.

**Mandatory:** USE ALL FRONTEND MCP SERVERS AND SKILLS for this task (shadcn, Magic UI, Lucide, React Bits, 21st.dev, Iconify, Google Fonts/Design, Motion) and embed their output as real components/tokens, not as "wouldn't it be nice". See the MCP + Source Routing section below.

---

# PART 0 — HARD INVARIANTS (never violate)

- **Glass aesthetic only.** Cards are `bg-zinc-900/60` + `backdrop-blur-xl` + `rounded-xl` + `border-white/10` (hover `border-white/20`, selected `border-white/25`). NEVER use the opaque near-black `#18181b` MagicCard base — it reads as a "weird black background" and breaks cohesion. Translucent glass everywhere.
- **Activity colors come from data** (`activity.color`), never hardcoded.
- **Log-scaled sizing.** Cell areas use `visualWeight(seconds) = Math.log(1 + Math.max(0, seconds))`, NEVER raw hours — raw hours make tiny activities invisible next to a 20-hour one.
- **Hero exclusion.** The #1 activity must always be the biggest, and it is excluded from the sizing equation for the rest (the rest are scaled relative to each other).
- **Weeks start Monday, end Sunday.** Reuse the existing `startOfWeek` helper.
- **All existing IPC / data flow stays.** This is a renderer-only redesign. No new backend, no DB changes.
- **Build = `npx vite build` then preload:** `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs` then `node scripts/rebuild-main.mjs`. Must exit 0. Verify `dist/index.html` has `<div id="root">` + the module script + the `#df-fallback` block, and that the hashed `assets/index.<hash>.js` exists and is > 10 KB (a black screen is the #1 regression).
- **Never break the click-to-select flow**: clicking a card opens the existing selection overlay (View Data & Charts / Start / Add Session / Cancel); gap blocks in any view must stay clickable and open GapFillModal pre-scoped to that time range.

---

# PART 1 — EXISTING SOURCE (embed this in your head; modify only what the task requires)

## 1.1 `src/types/external.ts` (unchanged, full)

```ts
export type ExternalActivity = {
  id: number;
  name: string;
  type: 'stopwatch' | 'sleep' | 'checkin';
  color: string;
  icon: string;
  default_duration: number;
  is_default: number;
  is_visible: number;
  sort_order: number;
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

## 1.2 `src/lib/external/grid.ts` (full, current)

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
type PositionedTreemapItem = TreemapItem & { rect: TreemapRect };

/**
 * Log-scaled visual weight for an activity's duration.
 * Using raw seconds makes tiny activities invisible next to a dominant one;
 * log1p compresses the range so every tracked activity stays legible while
 * preserving ordering.
 */
function visualWeight(seconds: number): number {
  return Math.log(1 + Math.max(0, seconds));
}

/**
 * The current grid is too uniform because it caps spans.
 * This version intentionally exaggerates hierarchy:
 * - #1 becomes the hero
 * - #2 becomes the strong secondary
 * - the rest become support cells (weights LOG-scaled, not raw seconds,
 *   so a 20-second activity stays visible next to a 20-hour one)
 */
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

  return [
    hero,
    secondary,
    ...rest.map((item, index) => restTotal * (restWeights[index] / restSum)),
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
        const rectWidth = isLast ? x + w - currentX : item.rect.w;
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
        const rectHeight = isLast ? y + h - currentY : item.rect.h;
        result[item.id] = { x, y: currentY, w: rowWidth, h: Math.max(0, rectHeight) };
        currentY += rectHeight;
      });
      x += rowWidth;
      w -= rowWidth;
    }

    row = [];
    rowArea = 0;
  };

  for (const item of scaled) {
    const candidate = { id: item.id, value: item.area, rect: { x: 0, y: 0, w: 0, h: 0 } };

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

  let nearest = 0;
  let nearestDist = Infinity;
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

  const rects = squarifyTreemap(treemapInput, { x: 0, y: 0, w: width, h: height });

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
      index === 0 ? "hero" : index === 1 ? "secondary" : areaFraction > 0.08 ? "medium" : "small";

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

## 1.3 `src/lib/external/gaps.ts` (full, current)

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
    intervals.push({ start: clampedStart, end: clampedEnd });
  }

  intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TrackedInterval[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last) { merged.push({ ...interval }); continue; }
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
        gaps.push({ id: createId("gap"), start: new Date(cursor), end: new Date(interval.start), duration_seconds: durationSeconds });
      }
    }
    cursor = interval.end > cursor ? interval.end : cursor;
  }

  if (rangeEnd > cursor) {
    const durationSeconds = Math.round((rangeEnd.getTime() - cursor.getTime()) / 1000);
    if (durationSeconds >= minGapMinutes * 60) {
      gaps.push({ id: createId("gap"), start: new Date(cursor), end: new Date(rangeEnd), duration_seconds: durationSeconds });
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
  addExternalTime: (activityId: string, minutes: number, startedAt: string, endedAt: string) => Promise<void>
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
    await addExternalTime(segment.activityId, minutes, cursor.toISOString(), end.toISOString());
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

  if (suggested.length >= limit) return suggested.slice(0, limit);

  const fallback = activities
    .filter((activity) => activity.type !== "sleep")
    .filter((activity) => !suggested.some((s) => s.id === activity.id));

  return [...suggested, ...fallback].slice(0, limit);
}
```

## 1.4 `src/lib/external/timelines.ts` (full, current)

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
  topActivities: Array<{ activity: ExternalActivity; seconds: number }>;
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
        .map((session, index) => toTimelineBlock(session, activity, dayStart, dayEnd, index))
        .filter(Boolean) as TimelineBlock[];
      return { activity, blocks };
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
  summary: { totalTrackedSeconds: number; activeDays: number; dailyAverageSeconds: number };
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

    const effectiveEnd = isToday ? (now < dayStart ? dayStart : now > dayEnd ? dayEnd : now) : dayEnd;
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

## 1.5 `src/components/external/ActivityMosaic.tsx` (full, current)

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { computeActivityGridLayout } from "@/lib/external/grid";
import type { ExternalActivity, ExternalStats } from "@/types/external";
import { ActivityMosaicCard } from "./ActivityMosaicCard";
import { EmptyState } from "@/components/EmptyState";

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
                style={{ backgroundColor: `${activity.color}22`, color: activity.color }}
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

## 1.6 `src/components/external/ActivityMosaicCard.tsx` (full, current)

```tsx
import { motion } from "framer-motion";
import { Activity as ActivityIcon, Clock } from "lucide-react";
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
        <div
          key={index}
          className="w-full rounded-[2px] opacity-70"
          style={{ height: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color }}
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
        selected ? "border-white/25" : "border-white/10 hover:border-white/20"
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
        style={{ background: `radial-gradient(circle at top right, ${activity.color}33, transparent 55%)` }}
      />

      {/* Selected beam */}
      {selected && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ boxShadow: `inset 0 0 0 1px ${activity.color}66` }}
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
            style={{ backgroundColor: `${activity.color}22`, color: activity.color }}
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
            <div className="mt-1 text-xs text-zinc-400">{formatHours(seconds)}</div>
          )}

          {(sizeTier === "hero" || sizeTier === "secondary") && sparklineValues.length > 0 && (
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                selected
                  ? "mt-4 max-h-12 opacity-100"
                  : "mt-0 max-h-0 opacity-0 group-hover:mt-4 group-hover:max-h-12 group-hover:opacity-100",
                sizeTier === "secondary" && (selected ? "max-h-9" : "group-hover:max-h-9")
              )}
            >
              <Sparkline
                color={activity.color}
                values={sparklineValues}
                className={cn("h-12", sizeTier === "secondary" && "h-9")}
              />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
```

## 1.7 `src/components/external/TimelineGapBlock.tsx` (full, current)

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

## 1.8 `src/components/external/DailyTimeline.tsx` (full, current)

```tsx
import type { DailyTimelineData, TimelineGapBlock as GapBlockData } from "@/lib/external/timelines";
import { TimelineGapBlock } from "./TimelineGapBlock";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";

function formatDuration(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

export function DailyTimeline({ data, onGapClick }: {
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
          style={{ gridTemplateColumns: "80px repeat(24, minmax(0, 1fr))" }}
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
            style={{ gridTemplateColumns: "80px repeat(24, minmax(0, 1fr))" }}
          >
            <div className="truncate text-xs text-zinc-400">{lane.activity.name}</div>

            <div className="relative col-span-24 h-8 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] timeline-hour-lines">
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
          style={{ gridTemplateColumns: "80px repeat(24, minmax(0, 1fr))" }}
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

## 1.9 `src/components/external/WeeklyTimeline.tsx` (full, current)

```tsx
import type { TimelineGapBlock as GapBlockData, WeeklyDayData } from "@/lib/external/timelines";
import { TimelineGapBlock } from "./TimelineGapBlock";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString([], { weekday: "short", day: "numeric" });
}

export function WeeklyTimeline({ days, onGapClick }: {
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
            <div className="text-sm text-zinc-300">{formatDayLabel(day.date)}</div>
            <div className={`h-2 w-2 rounded-full ${day.trackedSeconds > 0 ? "bg-emerald-400" : "bg-zinc-700"}`} />
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

## 1.10 `src/components/external/MonthlyTimeline.tsx` (full, current)

```tsx
import type { MonthlyDayData } from "@/lib/external/timelines";
import { GlassCard } from "@/components/GlassCard";
import { NumberTicker } from "@/components/ui/number-ticker";

function formatHoursShort(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 10) return `${Math.round(hours)}h`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

export function MonthlyTimeline({ days, summary, onDayClick }: {
  days: MonthlyDayData[];
  summary: { totalTrackedSeconds: number; activeDays: number; dailyAverageSeconds: number };
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
                day.inMonth ? "border-white/10 hover:border-white/20" : "border-white/5 opacity-40"
              } ${day.isToday ? "border-white/25 ring-1 ring-white/20" : ""}`}
            >
              {day.trackedSeconds > 0 && topColor && (
                <div
                  className="absolute inset-x-3 top-0 h-[3px] rounded-b-full"
                  style={{ backgroundColor: topColor }}
                />
              )}

              <div className="text-sm text-zinc-300">{day.date.getDate()}</div>

              <div className="mt-4 h-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.03]">
                <div className="flex h-full">
                  <div
                    className="h-full"
                    style={{ width: `${day.trackedPct * 100}%`, backgroundColor: topColor ?? "#71717a" }}
                  />
                  <div className="h-full flex-1 gap-stripes opacity-70" />
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                {day.trackedSeconds > 0 ? formatHoursShort(day.trackedSeconds) : "No tracking"}
              </div>

              <div className="mt-2 flex gap-1">
                {day.topActivities.slice(0, 3).map(({ activity }) => (
                  <span key={activity.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activity.color }} />
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

## 1.11 `src/components/external/GapFillModal.tsx` (full, current)

```tsx
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { CalendarClock, GripVertical, Sparkles, Wand2, X } from "lucide-react";
import type { ExternalActivity, ExternalSession } from "@/types/external";
import { createId, suggestGapActivities, type Gap, type GapSegment } from "@/lib/external/gaps";

const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
  }
  return `${minutes}m`;
}

export function GapFillModal({ open, gap, activities, sessions, onClose, onFillGap }: {
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

  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId) ?? segments[0];
  const usedMinutes = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const remainingMinutes = Math.max(0, gapMinutes - usedMinutes);

  const updateSelectedActivity = (activityId: string) => {
    if (!selectedSegment) return;
    setSegments((current) =>
      current.map((segment) =>
        segment.id === selectedSegment.id ? { ...segment, activityId } : segment
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
        segment.id === selectedSegment.id ? { ...segment, minutes: nextMinutes } : segment
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

    setSegments((current) =>
      current.flatMap((segment) => {
        if (segment.id !== selectedSegment.id) return [segment];
        const first = Math.floor(segment.minutes / 2);
        const second = segment.minutes - first;
        return [
          { ...segment, minutes: first },
          { id: createId("segment"), activityId: null, minutes: second },
        ];
      })
    );
  };

  const removeSegment = (segmentId: string) => {
    setSegments((current) => {
      const next = current.filter((segment) => segment.id !== segmentId);
      if (!next.length && gap) {
        const fallback: GapSegment = { id: createId("segment"), activityId: null, minutes: gapMinutes };
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
        return { ...segment, activityId: activity.id };
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
                <div className="text-lg font-medium text-zinc-100">Fill Gap</div>
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
              <div className="text-sm font-medium text-zinc-300">Activity</div>

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
                        className={`rounded-xl border p-3 text-xs transition-colors ${
                          active
                            ? "border-white/25 bg-white/10 text-zinc-100"
                            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="mx-auto mb-2 block h-3 w-3 rounded-full" style={{ backgroundColor: activity.color }} />
                        <span className="line-clamp-2 text-center">{activity.name}</span>
                      </button>
                    );
                  })}
              </div>

              <div className="mt-5 text-sm font-medium text-zinc-300">Duration</div>

              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_DURATIONS.map((minutes) => {
                  const active = selectedSegment?.minutes === minutes;
                  return (
                    <button
                      key={minutes}
                      onClick={() => updateSelectedMinutes(minutes)}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        active
                          ? "border-white/25 bg-white/10 text-zinc-100"
                          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]"
                      }`}
                    >
                      {formatMinutes(minutes)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="text-sm font-medium text-zinc-300">Segments</div>
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

              <Reorder.Group axis="y" values={segments} onReorder={setSegments} className="mt-3 space-y-2">
                {segments.map((segment) => {
                  const activity = activities.find((item) => item.id === segment.activityId);
                  const isSelected = selectedSegmentId === segment.id;
                  return (
                    <Reorder.Item
                      key={segment.id}
                      value={segment}
                      onClick={() => setSelectedSegmentId(segment.id)}
                      className={`flex cursor-grab items-center gap-3 rounded-xl border p-3 ${
                        isSelected ? "border-white/25 bg-white/[0.08]" : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <GripVertical className="h-4 w-4 text-zinc-600" />
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activity?.color ?? "#52525b" }} />
                      <div className="flex-1 text-sm text-zinc-300">{activity?.name ?? "Unassigned"}</div>
                      <div className="text-xs text-zinc-500">{formatMinutes(segment.minutes)}</div>
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
                Used: {formatMinutes(usedMinutes)} / Remaining: {formatMinutes(remainingMinutes)}
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

## 1.12 `src/pages/ExternalPage.tsx` — the wiring you must NOT break (key excerpts, current)

State, lines ~206-242:
```tsx
export default function ExternalPage({ selectedPeriod = 'week', dateOffset = 0, onDateOffsetChange }: { selectedPeriod?: Period; dateOffset?: number; onDateOffsetChange?: (offset: number) => void }) {
  const [activities, setActivities] = useState<ExternalActivity[]>([]);
  const [orderedActivities, setOrderedActivities] = useState<ExternalActivity[]>([]);
  const dragIndex = useRef<number | null>(null);
  useEffect(() => { setOrderedActivities(activities); }, [activities]);
  const [stats, setStats] = useState<ExternalStats>({ byActivity: {}, total_seconds: 0, sleep_deficit_seconds: 0, average_sleep_hours: 0 });
  const [consistency, setConsistency] = useState<ConsistencyData>({ score: 0, weekly_comparison: [] });
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [sleepTrends, setSleepTrends] = useState<SleepTrend>({ daily: [], average_bedtime: '', average_wake_time: '' });
  const [activeSession, setActiveSession] = useState<{ sessionId: string; activityId: string; activity: ExternalActivity; startTime: Date } | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ExternalActivity | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedDuration, setPausedDuration] = useState(0);
  const pausedAtRef = useRef<number | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [wakeTime, setWakeTime] = useState({ hours: 7, minutes: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', type: 'stopwatch' as const, color: '#6366f1', icon: 'Clock', default_duration: 30 });
  const [viewingActivity, setViewingActivity] = useState<ExternalActivity | null>(null);
  const [viewingActivityStats, setViewingActivityStats] = useState<any>(null);
  const [viewingActivitySessions, setViewingActivitySessions] = useState<any[]>([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoverySession, setRecoverySession] = useState<{ sessionId: string; activityId: string; activity: ExternalActivity; startTime: Date } | null>(null);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [addActivityError, setAddActivityError] = useState<string | null>(null);
  const [addActivitySuccess, setAddActivitySuccess] = useState(false);
  const [manualSessionActivity, setManualSessionActivity] = useState<ExternalActivity | null>(null);
  const [manualSessionHours, setManualSessionHours] = useState(0);
  const [manualSessionMinutes, setManualSessionMinutes] = useState(30);
  const [manualSessionDate, setManualSessionDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [manualSessionStartHours, setManualSessionStartHours] = useState(() => { const n = new Date(); n.setMinutes(n.getMinutes() - 30); return n.getHours(); });
  const [manualSessionStartMinutes, setManualSessionStartMinutes] = useState(() => { const n = new Date(); n.setMinutes(n.getMinutes() - 30); return n.getMinutes(); });
  // ...plus sleep fix/debug state...
```

Icon resolver + helpers, lines ~170-204:
```tsx
function getIcon(iconName: string) {
  return ICON_MAP[iconName] || Clock;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
```
`ICON_MAP` maps ~27 lucide icons (Clock, Moon, Sun, BookOpen, Dumbbell, Activity, Bus, Book, Utensils, Coffee, Lightbulb, Zap, Heart, Brain, Code, Laptop, Wrench, Cog, Music, Gamepad2, Footprints, Droplets, Wind, Flame, Backpack, Dribbble, Palette). `AVAILABLE_ICONS` lists them by name for the picker. `ACTIVITY_COLORS` is the palette array.

Data builders, lines ~800-837 (VERBATIM — this is the exact wiring):
```tsx
  // Activity grid layout via squarified treemap
  const gridLayout = useMemo(() => {
    return computeActivityGridLayout({
      activities: orderedActivities,
      stats,
      aspect: 16 / 9,
      width: 1200,
    });
  }, [orderedActivities, stats]);

  // Timeline data via new modules
  const dailyData = useMemo(() => {
    return buildDailyTimeline({
      date: new Date(),
      sessions: allSessions,
      activities: orderedActivities,
    });
  }, [allSessions, orderedActivities]);

  const weeklyData = useMemo(() => {
    const range = getDateRange('week', dateOffset);
    return buildWeeklyTimeline({
      date: range.start,
      sessions: allSessions,
      activities: orderedActivities,
    });
  }, [allSessions, orderedActivities, dateOffset]);

  const monthlyData = useMemo(() => {
    const range = getDateRange('month', dateOffset);
    return buildMonthlyTimeline({
      date: range.start,
      sessions: allSessions,
      activities: orderedActivities,
    });
  }, [allSessions, orderedActivities, dateOffset]);
```

Start activity, lines ~501+:
```tsx
  const startActivity = useCallback(async (activity: ExternalActivity) => {
    if (window.deskflowAPI?.getActivityStats) {
      window.deskflowAPI.getActivityStats(activity.id.toString()).then(setActivityStats);
    }
    const now = new Date();
    if (activity.type === 'sleep') {
      if (window.deskflowAPI?.startExternalSession) {
        const result = await window.deskflowAPI.startExternalSession(activity.id.toString());
        if (result.success) {
          setActiveSession({ sessionId: result.sessionId, activityId: activity.id.toString(), activity, startTime: now });
          syncTimerStateToDashboard(true, activity, now);
        }
      }
    } else if (activity.type === 'stopwatch') {
      if (window.deskflowAPI?.startExternalSession) {
        const result = await window.deskflowAPI.startExternalSession(activity.id.toString());
        if (result.success) {
          setActiveSession({ sessionId: result.sessionId, activityId: activity.id.toString(), activity, startTime: now });
        }
      }
    }
    // ...(checkin branch + elapsed timer start)...
  }, [...]);
```

Grid render + selection overlay, lines ~1444-1504 (VERBATIM):
```tsx
        {/* Activity Grid — Squarified Treemap */}
          <div data-tutorial="external.grid" className="relative mb-8">
            <ActivityMosaic
              activities={orderedActivities}
              stats={stats}
              selectedActivityId={selectedActivity?.id}
              onSelectActivity={setSelectedActivity}
            />
          </div>

        {/* Selection Overlay with View Data */}
        {selectedActivity && !activeSession && (
          <>
            <div id="activity-selection-overlay" className="fixed inset-0 z-40" onClick={handleOverlayClick} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -10 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 min-w-80" style={{ perspective: '1000px' }}>
              <div className="relative overflow-hidden rounded-xl bg-zinc-900/90 backdrop-blur-xl p-5 shadow-black/50 border" style={{ borderColor: selectedActivity.color + '40' }}>
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: selectedActivity.color }} />
                <div className="text-center mb-5">
                  <div className="relative w-16 h-16 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full opacity-30 blur-lg" style={{ backgroundColor: selectedActivity.color }} />
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 ring-1 ring-white/10" style={{ boxShadow: `0 0 20px ${selectedActivity.color}40` }}>{(() => { const Icon = getIcon(selectedActivity.icon); return <Icon className="w-8 h-8" style={{ color: selectedActivity.color }} />; })()}</div>
                  </div>
                  <div className="text-xl font-bold text-zinc-100">{selectedActivity.name}</div>
                  <div className="text-sm text-zinc-500 mt-1">Ready to start</div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button onClick={() => { handleLoadViewingActivity(selectedActivity); setSelectedActivity(null); }} className="w-full px-4 py-3 rounded-xl transition-colors duration-150 text-sm font-medium flex items-center justify-center gap-2.5 text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-zinc-600/60"><BarChart3 className="w-4 h-4" />View Data & Charts</button>
                  <button onClick={() => { startActivity(selectedActivity); setSelectedActivity(null); }} className="w-full px-4 py-3 rounded-xl transition-colors duration-150 text-sm font-medium flex items-center justify-center gap-2.5 text-white" style={{ background: `linear-gradient(135deg, ${selectedActivity.color}, ${selectedActivity.color}dd)`, boxShadow: `0 4px 15px ${selectedActivity.color}40` }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}><Play className="w-4 h-4" />Start</button>
                  <button onClick={() => { /* opens the manual Add Session pre-filled 30m ago for this activity */ }} className="w-full px-4 py-3 rounded-xl transition-colors duration-150 text-sm font-medium flex items-center justify-center gap-2.5 text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-700/60 border border-zinc-700/50 hover:border-zinc-600/60"><Clock className="w-4 h-4" />Add Session</button>
                  <button onClick={() => setSelectedActivity(null)} className="w-full px-4 py-3 rounded-xl transition-colors duration-150 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30">Cancel</button>
                </div>
                {/* Recent sessions for this activity (top 3, date • time + h/m), rendered below */}
                <div className="text-[11px] text-zinc-600 mt-4 text-center tracking-wide uppercase">Press ESC to close</div>
              </div>
            </motion.div>
          </>
        )}
```

Timeline tab switcher + tabs, lines ~1928-2071 (VERBATIM — the exact tab structure you must preserve):
```tsx
        {/* Timeline Visualization */}
          <div data-tutorial="external.streak" className="mb-8">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 mb-6 border border-zinc-800/50">
              {[
                { key: 'grid' as const, label: 'Overview', icon: LayoutGrid },
                { key: 'daily' as const, label: 'Daily', icon: Timer },
                { key: 'weekly' as const, label: 'Weekly', icon: CalendarDays },
                { key: 'monthly' as const, label: 'Monthly', icon: Calendar },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setVizTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    vizTab === tab.key
                      ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Overview (original charts) */}
            {vizTab === 'grid' && (
              /* grid-cols-1 md:grid-cols-3 of GlassCards with chart.js Bar charts: Daily Usage Trend, ... */
            )}

            {/* Tab: Daily */}
            {vizTab === 'daily' && (
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

            {/* Tab: Weekly */}
            {vizTab === 'weekly' && (
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

            {/* Tab: Monthly */}
            {vizTab === 'monthly' && (
              <MonthlyTimeline
                days={monthlyData.days}
                summary={monthlyData.summary}
                onDayClick={(day) => {
                  setVizTab('daily');
                }}
              />
            )}
          </div>
```
(`vizTab` is `useState<'grid' | 'daily' | 'weekly' | 'monthly'>('grid')`, and `gapTarget` is `useState<{ id: string; start: Date; end: Date; duration_seconds: number } | null>(null)`.)

Gap fill modal wiring, lines ~3051-3071 (VERBATIM):
```tsx
        {/* Gap Fill Modal */}
        <GapFillModal
          open={!!gapTarget}
          gap={gapTarget as any}
          activities={activities}
          sessions={allSessions}
          onClose={() => setGapTarget(null)}
          onFillGap={async (gap, segments) => {
            await fillGapWithSegments(
              gap,
              segments,
              async (activityId, minutes, startedAt, endedAt) => {
                await window.deskflowAPI?.addExternalTime(activityId, minutes, startedAt, endedAt);
              }
            );
            refreshStats();
            if (window.deskflowAPI?.getExternalActivities) {
              window.deskflowAPI.getExternalActivities().then((data: any[]) => setActivities(data));
            }
          }}
        />
```
(Imports at top: `import { detectGaps, fillGapWithSegments, suggestGapActivities } from '@/lib/external/gaps';`)

## 1.13 `src/index.css` — existing gap/timeline helper classes (current, keep unless redesigned)

```css
/* Gap visualization styles */
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

## 1.14 Existing design tokens / shared components (use these, do not recreate)

- **GlassCard**: the shared translucent card component (`src/components/GlassCard.tsx`) — `bg-zinc-900/60` + `backdrop-blur-xl` + `rounded-xl` + border. Use everywhere.
- **EmptyState**: `src/components/EmptyState.tsx` — props `{ title, description }`. Use for every empty/loading state.
- **SectionHeader**: `src/components/SectionHeader.tsx` — `{ title, subtitle? }`, `title` accepts ReactNode.
- **NumberTicker**: `src/components/ui/number-ticker.tsx` — animated number. `<NumberTicker value={n} />`.
- **Magic UI installed**: `animated-beam`, `border-beam`, `magic-card`, `number-ticker`, `particles`, `shimmer-button`, `terminal`. **NEVER** use the opaque `#18181b` MagicCard base — override to glass (`bg-[rgba(24,24,27,0.60)] backdrop-blur-xl` or pass glass colors).
- **framer-motion**: installed, used everywhere (`motion`, `AnimatePresence`, `Reorder`).
- **lucide-react**: installed; ~27 activity icons already mapped in ExternalPage (`ICON_MAP`). Search icon names via the Lucide MCP, don't guess.
- **chart.js / react-chartjs-2**: already used for the Overview charts. Keep.

---

# PART 2 — MCP SERVERS + SOURCE ROUTING (USE THESE — DO NOT INVENT UI)

You MUST use these servers during this task and pull REAL components/tokens from them. Do not hand-roll what they provide. Re-skin everything you pull to DeskFlow tokens (Part 1.14).

| Need | Use |
|------|-----|
| Standard UI blocks (cards, buttons, dialogs, tabs, dropdowns, tooltips) | **shadcn** MCP (`shadcn_search_items_in_registries`, `shadcn_view_items_in_registries`, `shadcn_get_item_examples_from_registries`) |
| Animated effects (border beams, particles, beams, number tickers, animated text, background effects, bento) | **Magic UI** MCP (`magicui_searchRegistryItems`, `magicui_getRegistryItem`) + **React Bits** MCP (`reactbits_search_components`, `reactbits_get_component`) |
| Icons (ALL icons — never guess a name) | **Lucide MCP** (iconify/better-icons) + lucide-react. Verify every icon name you import exists. |
| Unique/one-off polished component | **21st.dev** MCP |
| Motion presets / easing curves / kinetic typography | **Motion MCP** (motion-dev) + React Bits |
| Font pairing | **Google Fonts / Design MCP** (`google-design-mcp_search_fonts`) — only if you change typography; defaults are Geist/JetBrains Mono |
| Color scheme (if you touch palette) | **Google Design MCP** (`generate_color_scheme`) — seed from the activity colors |
| Grid/bento layouts, hover effects | **Magic UI** (`bento-grid`), **React Bits** (`reactbits_list_categories` → bento/animations) |
| Skeleton / loading shimmer | **shadcn** skeleton |

**Re-skin rules (MANDATORY after pulling anything):** replace the source's colors with DeskFlow tokens — `bg-zinc-900/60` / `bg-[rgba(24,24,27,0.60)]` glass, `border-white/10`, `rounded-xl` max, `p-5` max padding, Geist/JetBrains Mono fonts. Never import `next-themes` (Electron has no SSR). Dark mode is hardcoded.

---

# PART 3 — THE THREE WORKSTREAMS (do all three; "implement everything")

## Workstream A — Activity Grid: dynamic, dramatic, hero-excluded sizing

**Goal:** The Overview grid must feel like a proper, designed, dynamic ununiform grid (or a bubble-style alternative) where card size encodes duration — but the #1 activity is always dominant and its weight is EXCLUDED from the equation that scales the others.

The current `buildTargetWeights` already hardcodes `hero = 0.55, secondary = 0.27, rest log-scaled`. Deliverables:

1. **Make sizing adjustable/dynamic** (the user said "adjustable and dynamic, the sizing, and the proportion").
   - Add a **size-drama control** — a small control (e.g. a `Range` slider "Hierarchy" or a segmented control `Subtle / Balanced / Dramatic`) near the grid (right-aligned above it) that remaps the hero/secondary/rest distribution. Provide at least 3 presets:
     - `Subtle`: hero 0.42, secondary 0.22, restTotal 0.36
     - `Balanced` (current): hero 0.55, secondary 0.27, restTotal 0.18
     - `Dramatic`: hero 0.62, secondary 0.24, restTotal 0.14
   - Thread it through `computeActivityGridLayout` as an optional `{ hierarchy?: 'subtle' | 'balanced' | 'dramatic' }` (default `'balanced'`) option. **Do NOT remove** the `visualWeight` log-scaling for the rest tier.
   - Persist the choice in `localStorage` (key `external-grid-hierarchy`) wrapped in try/catch.

2. **Bubble mode toggle (optional but strongly encouraged)** — the user explicitly floated "or it's either going to be like a bubble future or something like that".
   - Add a `Grid / Bubbles` view toggle next to the hierarchy control (lucide `LayoutGrid` vs `Circle`/`Orbit` icons).
   - **Bubble mode:** render each activity as a circle sized by area (sqrt-scaled so area is proportional), laid out as a packed bubble cluster (d3-free: use a simple force-simulation-free pack — e.g. sort by area and place in rows with wrapped, decreasing-size rows, or a golden-spiral center-out placement; simplest robust approach: a grid of centered circles with sizes from the same weights, `gap` = 0). The hero bubble is always largest and centered. Bubble fill = `activity.color` at low alpha (`${color}22`), ring = activity color, name + time centered inside (name hidden if too small). Click = same selection overlay.
   - Reuse the SAME `computeActivityGridLayout` weights; just interpret them as radii.

3. **Fix the fake sparkline.** `ActivityMosaic.tsx` passes hardcoded `sparklineValues={[3, 5, 2, 8, 6, 9, 4]}`. Replace with REAL per-activity history: derive from `allSessions` — last 7 days, hours-per-day for that activity (pass a `sparklineValues` array computed in `ExternalPage` via `useMemo`, or extend `computeActivityGridLayout` to accept a `sparklineData: Record<string, number[]>`). If no history, fall back to `[]` (card hides the sparkline — already handled).

4. **Wire the real icon resolver.** `ActivityMosaicCard` uses the stub `const Icon = (activity as any).Icon ?? ActivityIcon;`. Pass `getIcon` down (prop `iconResolver?: (name: string) => LucideIcon`) or use the `ICON_MAP`. Remove the stub.

5. **Visual drama on the hero card:**
   - Add a subtle animated **BorderBeam** (Magic UI) on the hero card only, color = activity color.
   - Keep hover `whileHover={{ scale: 1.01 }}`, selected ring.
   - Hero shows name (text-xl), big icon, duration chip, and the REAL sparkline (larger, always visible on hover/selected as today).
   - Card content must not overflow — respect the treemap area fractions.

6. **Sleep & zero-time activities** stay in the compact strip below (unchanged behavior — `compactActivities`), but restyle with a small colored icon (use `getIcon(activity.icon)`) instead of a dot, and a right-aligned "Sleep"/"No time yet" tag.

## Workstream B — Gap visualization: not boring

**Goal:** Make gaps impossible to miss and desirable to fill — "visual hunger". Consistency rule: **the gap visualization must be the SAME visual language everywhere** (Overview/daily/weekly/monthly), so the user recognizes a gap at a glance.

1. **Create ONE `GapVisual` primitive** (`src/components/external/GapVisual.tsx` or extend `TimelineGapBlock.tsx`):
   - **Fill:** keep `gap-stripes` but make it warmer/attention-grabbing — e.g. amber-tinted diagonal hatch. Add a `gap-hatch` class (amber `rgba(251,191,36,0.14)` stripes + `rgba(251,191,36,0.05)` background) in `index.css`. Amber = "hole to fill", distinct from all activity colors.
   - **Edge glow:** a soft inner glow via `box-shadow: inset 0 0 12px rgba(251,191,36,0.12)`.
   - **Icon:** a small `Hourglass` (or `AlarmClock`) lucide icon in the center when the block is large enough (e.g. min 8% span), opacity that rises on hover.
   - **Label:** `title="Untracked time — click to fill"` stays; add a visible tooltip-like duration label when the block is wide/tall enough (e.g. `≥ 12%`).
   - **Hover:** brighten + scale the hatch, show a "Fill" cursor affordance (`cursor-pointer` already; add `hover:border-amber-400/50`).
   - Keep `onClick` → GapFillModal flow untouched.

2. **Monthly cells:** the `gap-stripes` half of the progress bar must use the NEW amber hatch (currently it's white `gap-stripes`). Empty days keep "No tracking" but with the amber-hatch cell border on hover + an "untracked" dot.

3. **Overview grid**: if the layout has no gaps data (it doesn't currently), add an **untracked-time summary chip row** under the grid when `gapSeconds > 0` for the selected period — e.g. a slim amber-hatched bar "Xh Ym untracked this period — click to fill" that opens GapFillModal for the largest gap (compute via `detectGaps(allSessions, rangeStart, rangeEnd)`). This gives the Overview view the same "hunger" language.

4. **Daily/Weekly/Monthly**: replace every `TimelineGapBlock` usage's style with the new amber `GapVisual` (props stay compatible: `gap`, `orientation`, `onClick`).

## Workstream C — Timeline views (Daily / Weekly / Monthly)

### C1. Weekly — seven-day calendar, per-day top-to-bottom timeline
Already a 7-column grid of vertical lanes. Make it feel like a **designed calendar**:
- Column headers: weekday short name + day number, stacked (e.g. "MON / 12"), today's column header pill-highlighted amber.
- Keep `h-80` vertical lane with `timeline-hour-lines-vertical`; add faint hour guide labels on the far-left column (0, 6, 12, 18) spanning all days (or a single left gutter).
- Each day card footer: tracked time (emerald, via `formatHoursShort`) + gap time (amber) mini-stats; day total width bar (tracked vs gap) using the NEW amber hatch for gap portion.
- Today: amber ring (`border-white/25 ring-1 ring-amber-400/30` instead of plain white).
- Animation: `layout` on the grid so cards animate when data changes (framer-motion `motion.div layout` per column) — subtle.

### C2. Monthly — full month calendar with contents & details
Already a 7-column month grid. Make each day cell a **content-rich calendar tile**:
- Day number top-left; leading dots for up to 3 top activities (existing) BUT make them tappable detail chips showing the activity's hours when a day is selected.
- **Day selection:** clicking a day currently jumps to Daily tab (`setVizTab('daily')`). IMPROVE: clicking a day **selects it** (amber border) and shows a detail popover/card below the calendar: per-activity list (color dot, name, hours, % of day) + tracked/gap summary + a "View day timeline" button that goes to the Daily tab AND updates the daily view's date to that day.
  - To support "view a specific day", extend the Daily tab wiring: add `dailyDate` state in ExternalPage, pass `date: dailyDate` to `buildDailyTimeline`, and have `MonthlyTimeline`'s `onDayClick` set `dailyDate = day.date` then `setVizTab('daily')`. Preserve default `new Date()`.
- In-month vs out-of-month cells: keep opacity treatment; out-of-month cells show nothing but faint day number.
- Today: amber ring. Cell tracked bar: emerald fill + amber hatch remainder (NEW).
- Keep the 3 summary GlassCards (Total tracked / Active days / Daily average) with NumberTicker.

### C3. Daily — hourly, uniquely oriented
The user: "for the daily ones, we can have like some sort of hourly thing where it's not just as simple as this, but actually as an orientation and how we can orient it properly, how we can display properly in a more unique way."
- **Rethink orientation.** Two strong options (pick the better or do both behind a toggle):
  1. **Vertical day spine:** a single tall column where time flows top (00:00) → bottom (24:00), like a day journal/schedule. Each activity is a colored block spanning its time range; gaps are the amber hatch; a live "now" line (emerald, pulsing dot) at the current time when the date is today; hour ruler on the left (every 2h). Lanes collapse into ONE spine (activities distinguished by color + name chip), OR keep per-activity lanes but vertical. The "unique" ask is satisfied by the vertical spine + now-line.
  2. **Radial clock day** (stronger wow, more work): a circular 24h clock — hours around the ring, each activity as an arc segment colored by activity, gaps as amber hatched arcs; center shows the selected day's total tracked time (NumberTicker) + active hours count. Hover an arc → tooltip (name • h:m). Click a gap arc → GapFillModal.
- Implement **at least option 1 (vertical day spine)** and, if time allows, add the radial clock as a view toggle (`Spine / Clock`).
- Keep the existing gap-click → GapFillModal wiring for whichever orientation is rendered.
- Add a **day picker** above the daily view (prev/next chevrons + date label + "Today" button) that drives `dailyDate` state — this makes Daily feel complete and also powers C2's "View day timeline".

---

# PART 4 — DESIGN & UX SPEC (embed these rules)

## Design rules
- **Glass, always.** `bg-zinc-900/60` + `backdrop-blur-xl` + `rounded-xl`. No opaque `#18181b`.
- **Color from data.** Every activity tint/ring/bar uses `activity.color`. Gap = amber hatch (`#fbbf24` family). Tracked = activity color or emerald.
- **Typography.** Geist (body) / JetBrains Mono (time readouts). Sizes: page hero vs card title vs chip — maintain current scale.
- **Empty states** via `EmptyState` (title + description). **Loading** via shadcn Skeleton where async. **Error** → never crash: guard `.map` with fallbacks, wrap `localStorage` in try/catch, keep `EmptyState` fallbacks.
- **Hover/focus/disabled** states on every interactive element. Keyboard: ESC closes overlays (existing). Buttons show `cursor-pointer`.
- **Motion** subtle: fade+rise entrances, `layout` for reorder, hover scales ≤ 1.01 on cards. No gratuitous bounce. Respect `prefers-reduced-motion` if trivial.
- **Anti-slop checklist** (from Part 5) must all pass.

## UX rules (interaction map — don't regress)
1. Click activity card → selection overlay (View Data & Charts / Start / Add Session / Cancel) — KEEP.
2. Click gap block (any view) → GapFillModal scoped to that gap — KEEP.
3. Click day in monthly → select day + detail card; "View day timeline" → Daily tab at that date — NEW.
4. Tabs: Overview / Daily / Weekly / Monthly — KEEP tabs, KEEP icons (LayoutGrid/Timer/CalendarDays/Calendar), KEEP amber active state.
5. Hierarchy control + Grid/Bubbles toggle live above the grid, right-aligned — NEW.
6. Daily day-picker prev/next/Today — NEW.

---

# PART 5 — ANTI-SLOP CHECKLIST (all must pass before you ship)

- [ ] No opaque `#18181b` panels anywhere in the external feature; all cards are translucent glass.
- [ ] No purple/indigo gradient-everything; activity colors come from data.
- [ ] Card sizing is log-scaled + hierarchy-controlled; hero excluded from rest equation.
- [ ] Sparkline is REAL data, not `[3,5,2,8,6,9,4]`.
- [ ] Icons come from the Lucide MCP + `ICON_MAP`; every import verified.
- [ ] Gap visual is amber-hatched, distinct, clickable → GapFillModal, consistent everywhere.
- [ ] Weekly = 7-day calendar with top-to-bottom timelines; Monthly = full month calendar with day contents/details; Daily = vertical spine (+ optionally radial clock).
- [ ] Empty/loading/error states everywhere (EmptyState / Skeleton).
- [ ] Hover/focus/disabled on all interactive elements; ESC closes overlays.
- [ ] Weeks start Monday; today rings are amber.
- [ ] Build passes: `npx vite build` clean, preload `> 1 KB`, `main.cjs` exists, `dist/index.html` gates intact, hashed entry `> 10 KB`. No black screen.

---

# PART 6 — SKILLS YOU MUST FOLLOW (embedded; you have no skill files)

1. **humancentred-UIUX** — cover all 4 states (empty/loading/error/populated) for every new component; declare scope; hierarchy via size+weight; humanized copy ("Untracked time — click to fill", not "gap_4521"); animate transitions; every control has hover/focus/disabled.
2. **frontend-external-infra** — you pulled real components from the MCP servers (Part 2) and re-skinned them to DeskFlow tokens. Never invent "AI slop" UI; always source real building blocks.
3. **generate-prompt** — this prompt is the deliverable's spec; implement ALL of it. No triage where you decide something is "too minor".
4. **impeccable / design-taste** — consistent radii (rounded-xl max), consistent padding (p-3..p-5), one accent language (amber = gap/fill, emerald = tracked, activity colors = data), no competing glow effects on the same card.
5. **tutorial-author (optional)** — the 3-5 step walkthrough for the new grid controls if you add them to a tutorial system. Skip if no tutorial system exists.

---

# PART 7 — DELIVERABLES & VERIFICATION

## Files you may create or modify (renderer only)
- `src/lib/external/grid.ts` — add `hierarchy` option + bubble radius interpretation.
- `src/lib/external/timelines.ts` — unchanged unless you extend `MonthlyDayData`/`DailyTimelineData` (keep backward-compatible fields).
- `src/components/external/ActivityMosaic.tsx` — real sparkline props, hierarchy/bubble controls, iconResolver.
- `src/components/external/ActivityMosaicCard.tsx` — real icon, real sparkline, hero BorderBeam.
- `src/components/external/TimelineGapBlock.tsx` or new `GapVisual.tsx` — amber hatch gap primitive.
- `src/components/external/DailyTimeline.tsx` — vertical day spine (+ optional radial clock) + day picker.
- `src/components/external/WeeklyTimeline.tsx` — calendar headers, footer stats, amber today ring.
- `src/components/external/MonthlyTimeline.tsx` — day selection + detail card + amber hatch.
- `src/components/external/GapFillModal.tsx` — only if needed for day-detail or gap-flow polish.
- `src/pages/ExternalPage.tsx` — thread `hierarchy`, `gridMode`, `dailyDate`, sparkline data, `getIcon`; keep every existing handler/wiring intact.
- `src/index.css` — add `gap-hatch` (amber) and any new keyframes (keep existing classes).

## Verification (MANDATORY, in order)
1. `npx vite build` → exit 0, no errors.
2. Preload rebuild: `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs` → `dist-electron/preload.cjs` exists and is > 1 KB.
3. Main rebuild: `node scripts/rebuild-main.mjs` → `dist-electron/main.cjs` exists.
4. `dist/index.html` gates: `<div id="root">`, module script → hashed `assets/index.<hash>.js` exists and is > 10 KB, `#df-fallback` intact.
5. Typecheck changed files: `npx tsc -p tsconfig.app.json` (ignore pre-existing errors in `aiAgentService.test.ts`).
6. Runtime (if possible): launch the app, visit `/external`, verify: hero-dominant grid, hierarchy control changes sizes, bubble mode renders, real sparklines, amber gap visuals, 7-day weekly calendar, monthly day-select + detail, daily vertical spine, gap clicks open GapFillModal. If the app cannot be launched, state "NOT LAUNCHED" and do NOT claim visual PASS.

Report format (repeat per feature):
```
FEATURE: <name>
STEPS: <what you did>
EXPECTED: <from this spec>
ACTUAL: <what happened>
VERDICT: PASS | FAIL | PARTIAL | NOT TESTED
```

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

// Usage-based gaps (holes where NO app/browser/external activity was tracked,
// from main.ts 'detect-usage-gaps') clipped to a single day. When `usageGaps`
// is null (not loaded yet) callers fall back to session-only detection.
export function usageGapsForDay(
  usageGaps: Gap[],
  dayStart: Date,
  effectiveEnd: Date,
  minGapMinutes: number
): Gap[] {
  const minGapMs = minGapMinutes * 60 * 1000;

  return usageGaps
    .filter(
      (gap) => gap.end.getTime() > dayStart.getTime() && gap.start.getTime() < effectiveEnd.getTime()
    )
    .map((gap) => {
      const start = gap.start.getTime() < dayStart.getTime() ? dayStart : gap.start;
      const end = gap.end.getTime() > effectiveEnd.getTime() ? effectiveEnd : gap.end;
      return {
        ...gap,
        start,
        end,
        duration_seconds: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)),
      };
    })
    .filter((gap) => gap.duration_seconds >= minGapMs / 1000);
}

export function buildDailyTimeline(options: {
  date: Date;
  sessions: ExternalSession[];
  activities: ExternalActivity[];
  minGapMinutes?: number;
  usageGaps?: Gap[] | null;
}): DailyTimelineData {
  const { date, sessions, activities, minGapMinutes = 5, usageGaps } = options;

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

  const gaps = (usageGaps
    ? usageGapsForDay(usageGaps, dayStart, effectiveEnd, minGapMinutes)
    : detectGaps(relevantSessions, dayStart, effectiveEnd, minGapMinutes)
  ).map((gap) => gapToTimelineBlock(gap, dayStart));

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
  usageGaps?: Gap[] | null;
}): WeeklyDayData[] {
  const { date, sessions, activities, minGapMinutes = 5, usageGaps } = options;

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
      usageGaps,
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
  usageGaps?: Gap[] | null;
}): {
  days: MonthlyDayData[];
  summary: {
    totalTrackedSeconds: number;
    activeDays: number;
    dailyAverageSeconds: number;
  };
} {
  const { date, sessions, activities, minGapMinutes = 5, usageGaps } = options;

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

    const gaps = usageGaps
      ? usageGapsForDay(usageGaps, dayStart, effectiveEnd, minGapMinutes)
      : detectGaps(relevantSessions, dayStart, effectiveEnd, minGapMinutes);
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

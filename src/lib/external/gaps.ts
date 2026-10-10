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

/**
 * Stable-ish id for a detected gap.
 *
 * RESTORED. This was deleted as "dead code" because no other module imported it
 * — but `detectGaps` calls it internally, twice. The audit that justified the
 * deletion only looked at cross-file imports and never checked intra-module use,
 * so removing it turned every `detectGaps()` call into
 * `ReferenceError: createId is not defined` and took down the whole External page.
 *
 * LESSON, written down so it does not repeat: a symbol with zero importers can
 * still be load-bearing INSIDE its own module. Grep the file itself, not just
 * the importers, before deleting anything.
 */
export function createId(prefix = 'id'): string {
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

/**
 * Rescale a set of segments to fit a different gap length, keeping their
 * PROPORTIONS.
 *
 * Reinstated because the consolidation that removed `GapFillModal` removed this
 * with it. Without it, filling a day of gaps means answering the same question
 * once per gap; with it, one answer covers all of them.
 *
 * Minutes are floored at 1 and the remainder lands on the last slot so the
 * segments always add up to exactly the target — a scaled set that came up short
 * would leave the tail of every gap unfilled and re-appear in gap detection.
 */
export function scaleSegmentsToGap(segments: GapSegment[], targetSeconds: number): GapSegment[] {
  const active = segments.filter((segment) => segment.activityId);
  if (!active.length) return [];

  const targetMinutes = Math.max(1, Math.round(targetSeconds / 60));
  const referenceMinutes = active.reduce((sum, segment) => sum + Math.max(1, segment.minutes), 0);
  if (referenceMinutes <= 0) return active.map((segment) => ({ ...segment, minutes: 1 }));

  let assigned = 0;
  return active.map((segment, index) => {
    if (index === active.length - 1) {
      return { ...segment, minutes: Math.max(1, targetMinutes - assigned) };
    }
    const minutes = Math.max(1, Math.floor((Math.max(1, segment.minutes) * targetMinutes) / referenceMinutes));
    assigned += minutes;
    return { ...segment, minutes };
  });
}

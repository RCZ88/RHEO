import type { Commitment, DayCompletion, DayViolation, StreakStats } from './types';
import { daysBetween, todayStr } from './storage';

function isDueOnDate(commitment: Commitment, dateStr: string): boolean {
  if (commitment.cadence === 'daily') return true;
  const weekday = new Date(dateStr + 'T00:00:00').getDay();
  return commitment.weeklyTargetDays.includes(weekday);
}

export function computeStreakStats(
  commitment: Commitment,
  completions: DayCompletion[],
  violations: DayViolation[] = [],
): StreakStats {
  const done = new Set(
    completions.filter(c => c.commitmentId === commitment.id).map(c => c.date),
  );
  const violated = new Set(
    violations.filter(v => v.commitmentId === commitment.id).map(v => v.date),
  );
  const isAvoidance = commitment.detection?.mode === 'avoidance';

  const totalCompletions = done.size;
  const sortedDates = [...done].sort();
  const lastCompletedDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : null;

  let longest = 0;
  let running = 0;
  const earliest = sortedDates[0] ?? todayStr();
  const totalDaySpan = Math.max(0, daysBetween(earliest, todayStr())) + 1;
  for (let i = 0; i < totalDaySpan; i++) {
    const d = new Date(earliest + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!isDueOnDate(commitment, dateStr)) continue;
    const success = isAvoidance ? !violated.has(dateStr) : done.has(dateStr);
    if (success) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  let current = 0;
  let justReset = false;
  let cursor = todayStr();
  const todayDue = isDueOnDate(commitment, cursor);
  const todayGood = isAvoidance ? !violated.has(cursor) : done.has(cursor);
  if (todayDue && !todayGood) {
    cursor = todayStr(-1);
  }
  for (let guard = 0; guard < 3650; guard++) {
    if (!isDueOnDate(commitment, cursor)) {
      cursor = shiftDate(cursor, -1);
      continue;
    }
    const good = isAvoidance ? !violated.has(cursor) : done.has(cursor);
    if (good) {
      current += 1;
      cursor = shiftDate(cursor, -1);
    } else {
      break;
    }
  }

  if (totalCompletions > 0 && current === 0) {
    const prevDue = previousDueDateBeforeToday(commitment);
    if (prevDue && !(isAvoidance ? !violated.has(prevDue) : done.has(prevDue))) {
      justReset = true;
    }
  }

  return { current, longest, totalCompletions, lastCompletedDate, justReset };
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previousDueDateBeforeToday(commitment: Commitment): string | null {
  let cursor = shiftDate(todayStr(), -1);
  for (let guard = 0; guard < 14; guard++) {
    if (isDueOnDate(commitment, cursor)) return cursor;
    cursor = shiftDate(cursor, -1);
  }
  return null;
}

export const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

export function nextMilestone(totalCompletions: number): number | null {
  return MILESTONES.find(m => m > totalCompletions) ?? null;
}

export function justHitMilestone(totalCompletions: number): number | null {
  return MILESTONES.includes(totalCompletions) ? totalCompletions : null;
}

export function targetProgress(totalCompletions: number, targetDays: number): number {
  if (targetDays <= 0) return 0;
  return Math.min(100, Math.round((totalCompletions / targetDays) * 100));
}

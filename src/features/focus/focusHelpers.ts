export interface FocusHistoryRow {
  id: number;
  started_at: string;
  ended_at?: string | null;
  planned_sec: number;
  actual_sec?: number | null;
  outcome: 'active' | 'completed' | 'failed' | 'aborted';
  strictness: 'distracting' | 'non_allowed';
  broke_on_type?: string | null;
  broke_on_name?: string | null;
  return_count?: number;
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

const GROUP_ACCENTS = [
  '#ec4899',
  '#a855f7',
  '#38bdf8',
  '#34d399',
  '#f59e0b',
  '#f43f5e',
  '#22d3ee',
  '#fbbf24',
];

export function groupAccent(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GROUP_ACCENTS[h % GROUP_ACCENTS.length];
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function todaysSessions(history: FocusHistoryRow[]): FocusHistoryRow[] {
  const today = new Date().toDateString();
  return history.filter(h => dayKey(h.started_at) === today);
}

export interface TodayStats {
  focusSec: number;
  sessionCount: number;
  completedCount: number;
  completionRate: number;
}

export function computeTodayStats(history: FocusHistoryRow[]): TodayStats {
  const today = todaysSessions(history);
  const completed = today.filter(h => h.outcome === 'completed');
  const focusSec = completed.reduce((sum, h) => sum + (h.actual_sec || 0), 0);
  const completionRate = today.length > 0 ? Math.round((completed.length / today.length) * 100) : 0;
  return { focusSec, sessionCount: today.length, completedCount: completed.length, completionRate };
}

export function computeStreak(history: FocusHistoryRow[]): number {
  const completedDays = new Set(
    history.filter(h => h.outcome === 'completed').map(h => dayKey(h.started_at)),
  );
  if (completedDays.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  if (!completedDays.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let guard = 0; guard < 3650; guard++) {
    if (completedDays.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export interface DayTrendPoint {
  label: string;
  date: string;
  focusSec: number;
}

export function computeWeeklyTrend(history: FocusHistoryRow[]): DayTrendPoint[] {
  const days: DayTrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const focusSec = history
      .filter(h => h.outcome === 'completed' && dayKey(h.started_at) === key)
      .reduce((sum, h) => sum + (h.actual_sec || 0), 0);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), date: key, focusSec });
  }
  return days;
}

export function computeBestHour(history: FocusHistoryRow[]): { hour: number; label: string } | null {
  const completed = history.filter(h => h.outcome === 'completed');
  if (completed.length === 0) return null;
  const byHour = new Map<number, number>();
  for (const h of completed) {
    const hour = new Date(h.started_at).getHours();
    byHour.set(hour, (byHour.get(hour) || 0) + (h.actual_sec || 0));
  }
  let bestHour = 0;
  let bestSec = -1;
  for (const [hour, sec] of byHour) {
    if (sec > bestSec) { bestSec = sec; bestHour = hour; }
  }
  const suffix = bestHour >= 12 ? 'PM' : 'AM';
  const hour12 = bestHour === 0 ? 12 : bestHour > 12 ? bestHour - 12 : bestHour;
  return { hour: bestHour, label: `${hour12}:00 ${suffix}` };
}

export function computeAvgSessionLength(history: FocusHistoryRow[]): number {
  const completed = history.filter(h => h.outcome === 'completed' && h.actual_sec);
  if (completed.length === 0) return 0;
  return completed.reduce((sum, h) => sum + (h.actual_sec || 0), 0) / completed.length;
}

export interface ScheduleActivitySeries {
  seriesId: string;
  title: string;
  category: 'class' | 'club' | 'sport' | 'other';
  sessions: ScheduleSession[];
  startDate: string;
  endDate: string | null;
  location?: string;
  instructor?: string;
  linkedPhaseId?: string;
  linkedGoalIds?: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSession {
  id: string;
  dayOfWeek: number;        // 0=Sun..6=Sat
  startTime: string;        // HH:MM
  endTime: string;          // HH:MM
  exceptions: string[];     // skipped dates (YYYY-MM-DD)
  location?: string;
  instructor?: string;
}

export interface Semester {
  name: string;
  startDate: string;
  endDate: string;
}

export type ActivityRange = 'month' | 'semester' | 'all';
export type ActivityView = 'timetable' | 'list';
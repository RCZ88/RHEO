// ============================================================
// DeskFlow Dashboard — Shared Types
// Goal-related types re-exported from src/types/goals.ts (canonical)
// ============================================================

export type {
  GoalCategory, GoalPeriod, GoalStatus, GoalSource, TargetType,
  GoalLink, GoalTarget, Goal, LongTermGoal,
  TrackingMode, CompletionLogic, CadenceConfig, CrossFeatureLink,
} from '../../types/goals';
export { mapLegacyStatus, goalDefaults, goalToRow, rowToGoal } from '../../types/goals';

// Dashboard-only types (not goal-related)
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type DeadlineStatus = 'pending' | 'completed' | 'overdue';
export type DeadlineCategory = 'academic' | 'work' | 'personal' | 'health';
export type ScheduleCategory = 'class' | 'lab' | 'study' | 'exam' | 'meeting' | 'other';

export interface Deadline {
  id: string;
  title: string;
  due_date: string;
  status: DeadlineStatus;
  course?: string;
  priority: Priority;
  description?: string;
  category?: DeadlineCategory;
  recurrence?: string;
  remind_at?: string;
  goal_id?: string | null;
  createdAt: string;
}

export interface Reminder {
  id: string;
  text: string;
  due_date: string | null;
  /** Optional time-of-day 'HH:mm'. Separate from due_date so date-keyed
   *  calendar grids keep working. Null = all-day reminder. */
  due_time?: string | null;
  goal_id: string | null;
  done: boolean;
  created_at: string;
}

export interface ScheduleEntry {
  id: string;
  title: string;
  location?: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  category?: ScheduleCategory;
  color?: string;
  goal_id?: string; // linked goal
  createdAt: string;
}

export interface CategoryBalance {
  category: GoalCategory;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardInsights {
  streak: number;
  longestStreak: number;
  momentum: number; // 0-100
  categoryBalance: CategoryBalance[];
  completionRate: number;
  urgentDeadlines: number;
  focusTimeMinutes: number;
  aiSuggestionCount: number;
}

export interface MomentumScore {
  score: number; // 0-100
  streak: number;
  consistency: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  completionRate: number;
  scheduleAdherence: number;
  /**
   * Setup signals. A breakdown row is only shown when the underlying feature is
   * actually configured — a user with no goals should not see "Goals completed
   * today: 0%". Absent = treated as "not set up" (fail-safe for old callers).
   */
  hasGoals?: boolean;
  hasSchedule?: boolean;
}

export interface DashboardState {
  goals: Goal[];
  deadlines: Deadline[];
  schedule: ScheduleEntry[];
  longTermGoals: LongTermGoal[];
  suggestions: Goal[];
  insights: DashboardInsights;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

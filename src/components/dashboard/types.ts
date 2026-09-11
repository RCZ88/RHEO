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

// IPC API shape (augmented in global scope)
declare global {
  interface Window {
    deskflowAPI?: {
      getGoals: (date: string) => Promise<{ goals: Goal[] }>;
      saveGoal: (date: string, goal: Goal) => Promise<{ success: boolean; id?: string }>;
      deleteGoal: (goalId: string) => Promise<{ success: boolean }>;
      getLongtermGoals: () => Promise<{ goals: LongTermGoal[] }>;
      suggestGoals: (date: string, ctx: unknown) => Promise<{ suggestions: Goal[] }>;
      getDeadlines: (params: { days?: number }) => Promise<{ deadlines: Deadline[] }>;
      addDeadline: (dl: Omit<Deadline, 'id'>) => Promise<{ success: boolean; id: string }>;
      updateDeadline: (id: string, patch: Partial<Deadline>) => Promise<{ success: boolean }>;
      deleteDeadline: (id: string) => Promise<{ success: boolean }>;
      getSchedule: () => Promise<{ entries: ScheduleEntry[] }>;
      addScheduleEntry: (entry: Omit<ScheduleEntry, 'id'>) => Promise<{ success: boolean; id: string }>;
      updateScheduleEntry: (id: string, patch: Partial<ScheduleEntry>) => Promise<{ success: boolean }>;
      deleteScheduleEntry: (id: string) => Promise<{ success: boolean }>;
      getMomentumScore: (date?: string) => Promise<MomentumScore>;
    };
  }
}

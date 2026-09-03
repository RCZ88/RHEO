// ============================================================
// DeskFlow Goals — Canonical Type Definitions
// Single source of truth. All other files re-export from here.
// ============================================================

export type GoalCategory = 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'relationships' | 'reflection';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'longterm';
export type GoalStatus = 'active' | 'done' | 'archived' | 'failed' | 'missed';
export type GoalSource = 'manual' | 'ai' | 'system';
export type TargetType = 'time' | 'completion' | 'external' | 'app' | 'habit' | 'cross_feature';
export type TrackingMode = 'system' | 'manual' | 'hybrid';

export interface CompletionLogic {
  lateAllowed: boolean;
  gracePeriodMinutes: number;
  partialCredit: boolean;
  /** When partialCredit is on, the goal counts as done once it reaches this % of target (1–99). Derived from hours. */
  partialCreditThreshold?: number;
  streakOnMiss: 'reset' | 'continue' | 'pause';
}

export const DEFAULT_COMPLETION_LOGIC: CompletionLogic = {
  lateAllowed: false,
  gracePeriodMinutes: 0,
  partialCredit: false,
  partialCreditThreshold: 80,
  streakOnMiss: 'reset',
};

export interface CadenceConfig {
  type: 'fixed' | 'rolling' | 'flexible';
  fixedDays: number[]; // 0-6 (Sun-Sat)
  rollingTarget: number; // e.g., 3 times per week
  flexibleWindowDays: number; // e.g., any 5 of 7 days
}

export const DEFAULT_CADENCE_CONFIG: CadenceConfig = {
  type: 'fixed',
  fixedDays: [],
  rollingTarget: 1,
  flexibleWindowDays: 7,
};

export interface CrossFeatureLink {
  feature: 'learn' | 'finance' | 'external' | 'ide' | 'focus' | 'schedule' | 'deadline' | 'reminder' | 'note' | 'browser' | 'sleep' | 'brain' | 'composition';
  entityId: string;
  label: string;
}

export interface GoalTarget {
  type: TargetType;
  targetSeconds?: number;
  maxExternalSeconds?: number;
  matchCategory?: string;
  matchApps?: string[];
  done?: boolean;
}

export interface GoalLink {
  label: string;
  url: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus;
  date: string;
  source: GoalSource;
  links: GoalLink[];
  progressSeconds?: number;
  completedAt?: string;
  createdAt: string;

  // Existing extended fields
  parentId?: string;
  parentIds?: string[];
  streak?: number;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: {
    enabled: boolean;
    mode: 'positive' | 'avoidance';
    keywords: string[];
    minMinutes: number;
  };
  linkedScheduleId?: string;
  journalText?: string;
  slippedCount?: number;
  deadline?: string;

  // NEW: Unified fields (Phase 1+)
  // Optional in the migration window; hydrated goals receive defaults.
  trackingMode?: TrackingMode;
  completionLogic?: CompletionLogic;
  cadenceConfig?: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
  externalActivityId?: number | null;
}

export interface LongTermGoal {
  id: string;
  title: string;
  category: GoalCategory;
  description?: string;
  deadline?: string;
  progress?: number;
  priority?: number;
  status?: string;
  source?: string;
  links?: GoalLink[];
}

// Legacy GoalStore status mapping
export function mapLegacyStatus(status: string): GoalStatus {
  const map: Record<string, GoalStatus> = {
    'suggested': 'active',
    'pending': 'active',
    'in-progress': 'active',
    'completed': 'done',
    'overdue': 'missed',
    'slipped': 'missed',
    'dismissed': 'archived',
  };
  return map[status] || (status as GoalStatus);
}

// Helper: create a Goal with sensible defaults for new fields
export function goalDefaults(partial: Partial<Goal>): Goal {
  return {
    id: partial.id || '',
    title: partial.title || '',
    category: partial.category || 'work',
    target: partial.target || { type: 'completion' },
    period: partial.period || 'daily',
    status: partial.status || 'active',
    date: partial.date || new Date().toISOString().slice(0, 10),
    source: partial.source || 'manual',
    links: partial.links || [],
    createdAt: partial.createdAt || new Date().toISOString(),
    trackingMode: partial.trackingMode || 'manual',
    completionLogic: partial.completionLogic || DEFAULT_COMPLETION_LOGIC,
    cadenceConfig: partial.cadenceConfig || DEFAULT_CADENCE_CONFIG,
    ...partial,
  } as Goal;
}

// Helper: serialize Goal for DB storage (JSON columns)
export function goalToRow(goal: Partial<Goal>): Record<string, unknown> {
  return {
    id: goal.id,
    date: goal.date,
    title: goal.title,
    description: goal.description || null,
    category: goal.category || 'work',
    target_type: goal.target?.type || 'completion',
    target_seconds: goal.target?.targetSeconds || null,
    match_category: goal.target?.matchCategory || null,
    match_apps: goal.target?.matchApps && goal.target.matchApps.length ? JSON.stringify(goal.target.matchApps) : null,
    status: goal.status || 'active',
    period: goal.period || 'daily',
    source: goal.source || 'manual',
    links: JSON.stringify(goal.links || []),
    progress_seconds: goal.progressSeconds || 0,
    completed_at: goal.completedAt || null,
    priority: goal.priority ?? 0,
    parent_id: goal.parentId || null,
    parent_ids: JSON.stringify(goal.parentIds || []),
    deadline: goal.deadline || null,
    is_habit: goal.isHabit ? 1 : 0,
    cadence: goal.cadence || null,
    weekly_target_days: JSON.stringify(goal.weeklyTargetDays || []),
    detection: goal.detection ? JSON.stringify(goal.detection) : null,
    linked_schedule_id: goal.linkedScheduleId || null,
    journal_text: goal.journalText || null,
    slipped_count: goal.slippedCount || 0,
    completion_config: JSON.stringify(goal.completionLogic || DEFAULT_COMPLETION_LOGIC),
    tracking_mode: goal.trackingMode || 'manual',
    cadence_config: JSON.stringify(goal.cadenceConfig || DEFAULT_CADENCE_CONFIG),
    cross_feature_link: goal.crossFeatureLink ? JSON.stringify(goal.crossFeatureLink) : null,
    external_activity_id: goal.externalActivityId || null,
  };
}

// Helper: hydrate DB row to Goal
export function rowToGoal(row: Record<string, unknown>): Goal {
  const parseJson = (raw: unknown, fallback: unknown = undefined) => {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return fallback; }
    }
    return raw ?? fallback;
  };
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    description: row.description ? String(row.description) : undefined,
    category: (row.category || 'work') as GoalCategory,
    target: {
      type: (row.target_type || 'completion') as TargetType,
      targetSeconds: row.target_seconds ? Number(row.target_seconds) : undefined,
      matchCategory: row.match_category ? String(row.match_category) : undefined,
      matchApps: parseJson(row.match_apps, []),
    },
    period: (row.period || 'daily') as GoalPeriod,
    status: (row.status || 'active') as GoalStatus,
    date: String(row.date || ''),
    source: (row.source || 'manual') as GoalSource,
    links: parseJson(row.links, []),
    progressSeconds: row.progress_seconds ? Number(row.progress_seconds) : 0,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at || ''),
    parentId: row.parent_id ? String(row.parent_id) : undefined,
    parentIds: parseJson(row.parent_ids, []),
    streak: row.streak ? Number(row.streak) : undefined,
    isHabit: row.is_habit === 1,
    cadence: row.cadence ? String(row.cadence) as 'daily' | 'weekly' : undefined,
    weeklyTargetDays: parseJson(row.weekly_target_days, []),
    detection: parseJson(row.detection, undefined),
    linkedScheduleId: row.linked_schedule_id ? String(row.linked_schedule_id) : undefined,
    journalText: row.journal_text ? String(row.journal_text) : undefined,
    slippedCount: row.slipped_count ? Number(row.slipped_count) : undefined,
    deadline: row.deadline ? String(row.deadline) : undefined,
    trackingMode: (row.tracking_mode || 'manual') as TrackingMode,
    completionLogic: parseJson(row.completion_logic || row.completion_config, DEFAULT_COMPLETION_LOGIC),
    cadenceConfig: parseJson(row.cadence_config, DEFAULT_CADENCE_CONFIG),
    crossFeatureLink: row.cross_feature_link ? parseJson(row.cross_feature_link, null) : null,
    externalActivityId: row.external_activity_id ? Number(row.external_activity_id) : null,
  };
}

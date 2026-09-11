# CONTEXT_BUNDLE — Gold Page 3D Calendar Layout Revamp

**Date:** 2026-09-04  
**Session:** current  
**Task:** Redesign Life/Gold page Schedule/Life Phases area with exhaustive layout/formatting/function/human-centric detail.

---

## 1. TYPES (FULL SOURCE)

### 1.1 `src/types/goals.ts` (canonical Goal/LongTermGoal)
```typescript
// Lines 1-235
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
  partialCreditThreshold?: number;
  streakOnMiss: 'reset' | 'continue' | 'pause';
}

export const DEFAULT_COMPLETION_LOGIC: CompletionLogic = {
  lateAllowed: false, gracePeriodMinutes: 0, partialCredit: false, partialCreditThreshold: 80, streakOnMiss: 'reset',
};

export interface CadenceConfig {
  type: 'fixed' | 'rolling' | 'flexible';
  fixedDays: number[];
  rollingTarget: number;
  flexibleWindowDays: number;
}

export const DEFAULT_CADENCE_CONFIG: CadenceConfig = {
  type: 'fixed', fixedDays: [], rollingTarget: 1, flexibleWindowDays: 7,
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

export interface GoalLink { label: string; url: string; }

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
  parentId?: string;
  parentIds?: string[];
  streak?: number;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: { enabled: boolean; mode: 'positive' | 'avoidance'; keywords: string[]; minMinutes: number };
  linkedScheduleId?: string;
  journalText?: string;
  slippedCount?: number;
  deadline?: string;
  priority?: number;
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

export function mapLegacyStatus(status: string): GoalStatus { /* ... */ }
export function goalDefaults(partial: Partial<Goal>): Goal { /* ... */ }
export function goalToRow(goal: Partial<Goal>): Record<string, unknown> { /* ... */ }
export function rowToGoal(row: Record<string, unknown>): Goal { /* ... */ }
```

### 1.2 `src/components/dashboard/types.ts` (Deadline, Reminder, ScheduleEntry)
```typescript
// Lines 1-114
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
  day_of_week: number;
  start_time: string;
  end_time: string;
  category?: ScheduleCategory;
  color?: string;
  goal_id?: string;
  createdAt: string;
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
```

---

## 2. EXISTING COMPONENT SOURCES (FULL)

### 2.1 `src/components/MonthWall/MonthWall.tsx` (454 lines)
Already loaded in working tree. Key exports:
- `localDateKey(d: Date): string`
- `localDateKeyFromDate(dateStr: string): string`
- `getEventsForDay(events: WallEvent[], date: string): WallEvent[]`
- `MonthWall` component with props: `onMonthChange`, `renderDay`, `goals`, `deadlines`, `reminders`, `schedule`, `longTermGoals`
- Internal: `deriveEvents(...)` maps real data → `WallEvent[]`; `loadEvents()`/`saveEvents()` localStorage; 3D tilt via `useRef` + `requestAnimationFrame`; `prefers-reduced-motion` guard; keyboard `PageUp/PageDown`; no wheel hijack.

### 2.2 `src/features/warmth/gold/GoldPage.tsx` (1677 lines)
Already loaded. Key sections:
- Lines 1-200: helpers, types, `criteriaToGoal`, `RadarMark`
- Lines 223-304: `StatPill`, `DayRing`, `GoldHeader`
- Lines 306-400: `WeekBoard`
- Lines 402-508: `DeadlineRadar` — mini month calendar + countdown list
- Lines 511-670: `TheVault` — LTG progress rings + add/edit form
- Lines 747-950: `BellBoard` — reminders as amber tickets
- Lines 1497+: right column mount currently unified MonthWall only
- Imports at top include `MonthWall`, `ScheduleCard`, `CalendarStrip`, `TodoList`, `WeeklyGoalsView`, `WarmCard`

### 2.3 `src/components/goals/TodoList.tsx` (124 lines)
Already loaded. Props: `todos`, `onAdd`, `onToggle`, `onDelete`. States: empty, populated, showAll done toggle.

### 2.4 `src/pages/dashboard/ScheduleCard.tsx` (465 lines)
Already loaded. Props: `entries`, `selectedDate`, `selectedDay`, `loading`, `error`, `onAdd`, `onUpdate`, `onDelete`, `linkedGoals`, `showAll`. Has loading/error/populated states. Current block emphasis + NOW indicator.

### 2.5 `src/components/goals/CalendarStrip.tsx` (105 lines)
Already loaded. Props: `selectedDate`, `onDateChange`, `goalDates`, `marks`, `weekGoals`. 14-day strip.

### 2.6 `src/components/goals/WeeklyGoalsView.tsx` (143 lines)
Already loaded. Props: `weekGoals`, `weekDates`, `selectedDate`, `onToggle`, `onEdit`, `onDelete`.

### 2.7 `src/features/warmth/WarmCard.tsx` (18 lines)
Already loaded. Props: `children`, `className`, `ambient`.

### 2.8 `src/components/CategoryColors.tsx` (20 lines)
Already loaded. Exports `CATEGORY_COLORS`, `getCategoryStyle`.

### 2.9 `src/lib/CategoryColors.ts` (17 lines)
Already loaded. Re-exports + `getCategoryColor(category)` wrapper.

### 2.10 `src/components/dashboard/DeadlinesCard.tsx` (815 lines)
Already loaded. Unified deadlines + reminders with urgency, add/edit/delete, show completed.

### 2.11 `src/components/dashboard/ScheduleSyncCard.tsx` (121 lines)
Already loaded. Today's schedule with active/past/upcoming, linked goals.

---

## 3. DESIGN TOKENS (LAMINAR — `design/design.md`)

- Base: `#09090b`, `#18181b`, `#27272a`
- Hairlines: `rgba(255,255,255,0.08)`
- Signal hues: amber `#fbbf24`, pink `#ec4899`, cyan `#06b6d4`, emerald `#34d399`, rose `#ef4444`
- Fonts: Inter/Geist UI, Space Grotesk display, JetBrains Mono numeric
- Radii: `8px` sm, `12px` card max, `9999px` pill
- Motion: `cubic-bezier(0.19,1,0.22,1)` or `cubic-bezier(0.16,1,0.3,1)`, 150/250/400ms
- No decorative infinite loops
- `prefers-reduced-motion` required
- Typography scale: badge 11px/500, meta 12px/400, body 13px/400, card title 13px/600, section 15px/600, page 18px/600
- Card padding: `p-5` standard
- Z-index: 0 base, 10 elevated, 20 dropdown, 30 modal, 40 toast, 50 overlay, 100 max

---

## 4. CURRENT RENDER FLOW (GoldPage right column)

Current right column at lines 1650-1668:
```tsx
<div className="space-y-4">
  <MonthWall
    accent="#f59e0b"
    goals={goals}
    deadlines={deadlines}
    reminders={reminders}
    schedule={schedule}
    longTermGoals={longTermGoals}
  />
</div>
```

Data sources: `goals`, `deadlines`, `reminders`, `schedule`, `longTermGoals` from parent state/hooks.

---

## 5. IMPLEMENTATION NOTES

- No new backend/IPC. All data flows from existing GoldPage state.
- MonthWall manual events: localStorage `df-monthwall-events`, try/catch.
- Remove: `DeadlineRadar`, `BellBoard`, `TheVault` from right column.
- Keep: `ScheduleSyncCard`, `DeadlinesCard`, `TodoList`, `WeeklyGoalsView`, `CalendarStrip`, `WeekBoard`, `GoldHeader`, `ReflectionCard`, `WeekReview`, `LifeRiver`.
- LAMINAR grep gates must pass after changes.

---

## 6. SKILL ROUTE

DESIGN category → MANDATORY skills in order:
1. `frontend-external-infra`
2. `frontend-design`
3. `Human-Centric UX`
4. `Impeccable`
5. `Motion — Bring the UI Alive`
6. `Design Taste System`
7. `UI UX Pro Max`
8. `Taste Skill`

Plus `generate-prompt` skill format requirements for prompt generation.

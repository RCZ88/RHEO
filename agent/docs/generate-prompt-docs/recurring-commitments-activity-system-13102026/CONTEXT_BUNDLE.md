# CONTEXT_BUNDLE — Recurring Commitments / Activity System

> Self-contained codebase reference. The receiving AI has NO access to this repo.
> Every code excerpt below is verbatim with real file paths and line numbers.

---

## 1. The Idea (User's Verbatim Request)

> "like i would like to hae like lessons or like occuring stuff. its like part and similar to a phase, butl like its specific more like the clubs that we joined , the classes that we take, etc"

**Parsed intent**: A system for **recurring commitments/activities** — clubs, classes, lessons, recurring appointments — that:
- Are *similar to phases* (long-horizon, meaningful chapters) but **more specific and scheduled**
- Have **recurrence patterns** (weekly on Tuesdays, monthly on 1st, etc.)
- Show on the **calendar/schedule** as repeating events
- Can be **linked to goals/habits/phases** for tracking
- Are distinct from: habits (daily streaks), goals (targets with deadlines), phases (multi-year life chapters), schedule entries (single appointments)

---

## 2. Existing Systems This Touches

### A. Life Phases (`src/components/life-river/`, `life_phases` table)

```sql
-- src/main.ts:3615
CREATE TABLE IF NOT EXISTS life_phases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'growth',
  start_month INTEGER NOT NULL,
  start_year INTEGER NOT NULL,
  end_month INTEGER, end_year INTEGER,
  magnitude INTEGER NOT NULL DEFAULT 50 CHECK (magnitude BETWEEN 0 AND 100),
  color TEXT,
  reflection TEXT NOT NULL DEFAULT '',
  era_trends TEXT NOT NULL DEFAULT '',
  impact_notes TEXT NOT NULL DEFAULT '',
  milestones TEXT NOT NULL DEFAULT '[]',
  connections TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- newer nullable columns:
  people TEXT DEFAULT NULL,
  mood_start INTEGER DEFAULT NULL,
  mood_end INTEGER DEFAULT NULL,
  mood_tags TEXT DEFAULT NULL,
  feelings_note TEXT DEFAULT NULL,
  lessons_learned TEXT DEFAULT NULL,
  header_image_memory_id TEXT DEFAULT NULL,
  color_source TEXT DEFAULT 'category',
  reflection_source TEXT DEFAULT NULL,
  reflection_generated_at TEXT DEFAULT NULL,
  status TEXT DEFAULT 'complete',
  start_date TEXT DEFAULT NULL,
  end_date TEXT DEFAULT NULL,
  scale TEXT DEFAULT NULL,
);
```

**PhaseFormDialog** (`src/components/life-river/phase-form-dialog.tsx:213`):
```tsx
export function PhaseFormDialog({ open, onOpenChange, initial, allPhases = [], onSave, onDelete }: PhaseFormDialogProps)
```

Phases are **multi-year life chapters** with reflection, mood tracking, milestones, connections.

---

### B. Goals (`goals` table, `src/infrastructure/ipc/goal-handlers.ts`)

```sql
-- src/main.ts:3549
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,              -- the day this goal belongs to
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'work',
  target_type TEXT NOT NULL DEFAULT 'time',
  target_seconds INTEGER,
  match_category TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  period TEXT NOT NULL DEFAULT 'daily',   -- daily | weekly | longterm
  source TEXT NOT NULL DEFAULT 'manual',
  links TEXT DEFAULT '[]',
  progress_seconds INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
```

**Goal type** (`src/types/goals.ts:64`):
```ts
export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;        // 'daily' | 'weekly' | 'longterm'
  status: GoalStatus;
  date: string;              // the specific day
  source: GoalSource;
  links: GoalLink[];
  progressSeconds?: number;
  completedAt?: string;
  createdAt: string;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: { ... };
  linkedScheduleId?: string;
}
```

Goals are **per-day targets** with `period` = daily/weekly/longterm. Habits are goals with `isHabit: true`.

---

### C. Schedule System (`src/features/warmth/schedule/layout.ts`)

```ts
// Engine: pure logic, zero UI
export type PanelId = 'calendar' | 'agenda' | 'upcoming' | 'todos';
export type ViewMode = 'day' | 'week' | 'month';
export type PresetId = 'calendar-first' | 'today-first' | 'week-first' | 'focus';

export interface ScheduleLayout {
  preset: PresetId;
  slots: SlotMap;                    // panel → slot assignment
  hidden: Partial<Record<PanelId, boolean>>;
  sizes: Partial<Record<string, number>>;
}

export const PRESET_SLOTS: Record<PresetId, string[]> = {
  'calendar-first': ['left', 'right-top', 'right-mid', 'right-bottom'],
  'today-first': ['left', 'right-top', 'right-bottom-left', 'right-bottom-right'],
  'week-first': ['top', 'bottom-left', 'bottom-mid', 'bottom-right'],
  focus: ['stage', 'drawer-1', 'drawer-2', 'drawer-3'],
};
```

**SchedulePage** (`src/features/warmth/schedule/SchedulePage.tsx`) renders: `MonthWall` + `WeekBoard` + `TodosCard`.

**Calendar components**: `MonthWall` (flat 2D), `WeekBoard` (7 columns), `CalendarSidebar`.

---

### D. Schedule Entries (`schedule_entries` table)

```sql
-- src/main.ts:3883
CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,   -- 0=Sun..6=Sat
  start_time TEXT NOT NULL,        -- HH:MM
  end_time TEXT NOT NULL,
  color TEXT,
  category TEXT,
  goal_id TEXT,                   -- links to goals
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Current schedule entries are WEEKLY RECURRING** (by `day_of_week`). No monthly, custom, or date-range recurrence.

---

### E. Design Tokens (`src/lib/CategoryColors.ts`)

```ts
export const ENTITY_COLORS = {
  goal:     { text: 'text-amber-300',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   bar: 'bg-amber-400', light: {...} },
  ltg:      { text: 'text-yellow-300',  border: 'border-yellow-500/30',  bg: 'bg-yellow-500/10',  bar: 'bg-yellow-400',  light: {...} },
  habit:    { text: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', bar: 'bg-emerald-400', light: {...} },
  deadline: { text: 'text-rose-300',    border: 'border-rose-500/30',    bg: 'bg-rose-500/10',    bar: 'bg-rose-400',    light: {...} },
  schedule: { text: 'text-cyan-300',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10',    bar: 'bg-cyan-400',    light: {...} },
  note:     { text: 'text-violet-300',  border: 'border-violet-500/30',  bg: 'bg-violet-500/10',  bar: 'bg-violet-400',  light: {...} },
  todo:     { text: 'text-zinc-300',    border: 'border-zinc-600/50',    bg: 'bg-zinc-800/60',    bar: 'bg-zinc-400',    light: {...} },
} as const;
```

**New entity needs its own color** in this map.

---

### F. WarmCard Shell (`src/features/warmth/WarmCard.tsx:43`)

```tsx
interface WarmCardProps {
  children: ReactNode;
  className?: string;
  ambient?: boolean;       // quieter tier for nested surfaces
  interactive?: boolean;   // raises border on hover
}
```

All warmth surfaces use this card shell.

---

### G. IPC Pattern (from `src/preload.ts`)

```ts
// Goal IPC
getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
getGoalsBatch: (startDate: string, endDate: string) => ipcRenderer.invoke('get-goals-batch', startDate, endDate),
getLongtermGoals: () => ipcRenderer.invoke('get-longterm-goals'),
saveGoal: (date: string, goal: any) => ipcRenderer.invoke('save-goal', date, goal),
saveGoalsBatch: (goals: any[]) => ipcRenderer.invoke('save-goals-batch', goals),

// Phase IPC
lifePhaseGet: () => ipcRenderer.invoke('lifePhase:get'),
lifePhaseGetSummary: () => ipcRenderer.invoke('lifePhase:getSummary'),
lifePhaseSave: (phase: any) => ipcRenderer.invoke('lifePhase:save', phase),
lifePhaseDelete: (phaseId: string) => ipcRenderer.invoke('lifePhase:delete', phaseId),
lifePhaseSaveAll: (phases: any[]) => ipcRenderer.invoke('lifePhase:saveAll', phases),
```

**Pattern**: `ipcRenderer.invoke('channel', payload)` → `src/infrastructure/ipc/goal-handlers.ts` handles.

---

### H. Todo Groups (Recently Added — Pattern to Follow)

```sql
-- src/main.ts:3958 (migration pattern)
ALTER TABLE todos ADD COLUMN group_id TEXT;
CREATE TABLE IF NOT EXISTS todo_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

```ts
// src/infrastructure/ipc/goal-handlers.ts (newly added)
ipcMain.handle('todoGroup:list', ...);
ipcMain.handle('todoGroup:create', ...);
ipcMain.handle('todoGroup:update', ...);
ipcMain.handle('todoGroup:delete', ...);
```

```ts
// src/preload.ts (newly added)
todoGroupList: () => ipcRenderer.invoke('todoGroup:list'),
todoGroupCreate: (data: { name: string; color?: string; sortOrder?: number }) => ...,
```

---

## 3. Where This Feature Lives

| Aspect | Location |
|---|---|
| **Calendar display** | `MonthWall`, `WeekBoard`, `SchedulePage` |
| **Phase UI** | `LifePage` (River mode), `GoldPage` (Phases sub-view) |
| **Goal UI** | `GoldPage` (Today sub-view), `HabitsPage` |
| **Schedule UI** | `SchedulePage` (4 presets) |
| **DB** | `life_phases`, `goals`, `schedule_entries` tables |
| **IPC** | `src/infrastructure/ipc/goal-handlers.ts` |
| **Preload** | `src/preload.ts` (deskflowAPI) |
| **Design tokens** | `src/lib/CategoryColors.ts` (ENTITY_COLORS) |

---

## 4. Critical Constraints

1. **No new IPC unless necessary** — reuse existing patterns
2. **No schema change to `Goal` or `life_phases`** — this is a NEW entity type
3. **Must integrate with calendar** — show on MonthWall, WeekBoard, SchedulePage presets
4. **Must link to existing entities** — phases, goals, habits, notes
5. **Recurrence must be more flexible than `schedule_entries`** — which only does weekly by day-of-week
6. **Color must come from `ENTITY_COLORS`** — add new entry following existing pattern
7. **Card shell must be `WarmCard`** — consistent with Gold/Schedule/Habits
8. **Spacing scale: 4 / 8 / 12 / 16 / 24. Radius: up to rounded-xl.**
9. **Light/dark theme must work** — use `ENTITY_COLORS.light` variants
10. **Tailwind v4 scans ALL files** — including markdown. Only write valid classes.

---

## 5. Files the Solution Will Touch

```
src/main.ts                                    (DB migration + new table)
src/infrastructure/ipc/goal-handlers.ts        (new IPC handlers)
src/preload.ts                                 (expose new IPC)
src/lib/CategoryColors.ts                      (add ENTITY_COLORS entry)
src/types/recurring-activity.ts                (new type definitions)
src/components/recurring-activity/             (new component folder)
  ├── RecurringActivityCard.tsx
  ├── RecurringActivityForm.tsx
  ├── RecurringActivityList.tsx
src/features/warmth/schedule/                  (calendar integration)
src/features/warmth/gold/GoldPage.tsx          (sub-view integration)
src/components/life-river/                     (phase linking)
src/pages/registry/                            (page manifest if new route)
```

---

## 6. Backend Audit (All Existing — No Stubs)

| Feature | IPC Channel | Handler | Real? |
|---|---|---|---|
| Life phases | `lifePhase:*` | ✅ | ✅ |
| Goals | `get-goals` / `save-goal` | ✅ | ✅ |
| Schedule entries | (none yet for recurring) | — | ❌ |
| Todo groups | `todoGroup:*` | ✅ | ✅ (just added) |
| Category colors | — | — | ✅ (token file) |

**The only missing backend is the recurring activity CRUD itself** — everything else exists.
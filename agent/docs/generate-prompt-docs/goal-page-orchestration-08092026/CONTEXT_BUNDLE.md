# CONTEXT_BUNDLE.md — Goal Page Orchestration (Life → Gold → Interconnected Systems)

> **Folder:** `agent/docs/generate-prompt-docs/goal-page-orchestration-08092026/`
> **Date:** 2026-09-08
> **Target AI:** Lead Designer AND Engineer → produces `RESULT.md`
> **Hands & Eyes:** opencode (this repo's agent)

---

## 1. DB SCHEMAS (verbatim from src/main.ts)

### goals table (main.ts lines ~2919-2949 + ALTER migrations)
```sql
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                -- YYYY-MM-DD (daily goal)
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'work',
  target_type TEXT NOT NULL DEFAULT 'time',
  target_seconds INTEGER,
  match_category TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  period TEXT NOT NULL DEFAULT 'daily',
  source TEXT NOT NULL DEFAULT 'manual',
  links TEXT DEFAULT '[]',
  progress_seconds INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

-- ALTER TABLE additions (guarded, main.ts ~2938-3020):
ALTER TABLE goals ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN parent_id TEXT;
ALTER TABLE goals ADD COLUMN parent_ids TEXT;          -- JSON array for multi-parent
ALTER TABLE goals ADD COLUMN is_habit INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN cadence TEXT;             -- 'daily' | 'weekly'
ALTER TABLE goals ADD COLUMN weekly_target_days TEXT;  -- JSON array
ALTER TABLE goals ADD COLUMN detection TEXT;           -- JSON
ALTER TABLE goals ADD COLUMN linked_schedule_id TEXT;
ALTER TABLE goals ADD COLUMN journal_text TEXT;
ALTER TABLE goals ADD COLUMN slipped_count INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN deadline TEXT;            -- YYYY-MM-DD
ALTER TABLE goals ADD COLUMN completion_config TEXT;   -- JSON
ALTER TABLE goals ADD COLUMN tracking_mode TEXT DEFAULT 'manual';
ALTER TABLE goals ADD COLUMN cadence_config TEXT;      -- JSON
ALTER TABLE goals ADD COLUMN cross_feature_link TEXT;  -- JSON: { feature, entityId, label }
ALTER TABLE goals ADD COLUMN external_activity_id INTEGER;
```

### goals table — type hydration (src/types/goals.ts:192-235)
```typescript
export interface Goal {
  id: string; title: string; description?: string;
  category: GoalCategory; target: GoalTarget; period: GoalPeriod;
  status: GoalStatus; date: string; source: GoalSource;
  links: GoalLink[]; progressSeconds?: number; completedAt?: string;
  createdAt: string;
  // Hierarchy
  parentId?: string;
  parentIds?: string[];
  // Habit fields
  streak?: number; isHabit?: boolean; cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  // Detection
  detection?: { enabled: boolean; mode: 'positive' | 'avoidance'; keywords: string[]; minMinutes: number };
  // Links to other systems
  linkedScheduleId?: string;
  journalText?: string; slippedCount?: number; deadline?: string;
  priority?: number;
  // New unified fields
  trackingMode?: TrackingMode;
  completionLogic?: CompletionLogic;
  cadenceConfig?: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
  externalActivityId?: number | null;
}

export interface CrossFeatureLink {
  feature: 'learn' | 'finance' | 'external' | 'ide' | 'focus' | 'schedule' | 'deadline' | 'reminder' | 'note' | 'browser' | 'sleep' | 'brain' | 'composition';
  entityId: string;
  label: string;
}
```

### long_term_goals — same `goals` table, filtered by `period = 'longterm'` (main.ts:18521)
```sql
-- No separate table. Long-term goals are goals with period='longterm'.
-- Retrieved via: SELECT * FROM goals WHERE period = 'longterm' ORDER BY priority ASC, created_at ASC
-- They have: id, title, category, description, deadline, priority, status, source, links
```

### deadlines table (main.ts:3242-3258)
```sql
CREATE TABLE IF NOT EXISTS deadlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  course TEXT,
  due_date TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',   -- 'low'|'medium'|'high'|'urgent'
  status TEXT DEFAULT 'pending',    -- 'pending'|'done'|'snoozed'|'overdue'
  description TEXT,
  reminder_sent INTEGER DEFAULT 0,
  notified_at TEXT DEFAULT '{}',
  snoozed_until TEXT,
  recurrence TEXT,
  recurrence_end TEXT,
  category TEXT,
  remind_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### schedule_entries table (main.ts:3228-3239)
```sql
CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,    -- "HH:MM" format
  end_time TEXT NOT NULL,      -- "HH:MM" format
  category TEXT DEFAULT 'class',
  color TEXT DEFAULT '#22d3ee',
  is_recurring INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```
**GAP:** `schedule_entries` has NO `goal_id` column. The `add-schedule-entry` IPC handler (main.ts:20392-20398) does NOT insert `goal_id` even though the renderer's `ScheduleTab` EntryForm (ScheduleTab.tsx:92, 127) collects it. The `ScheduleCard` in GoldPage (GoldPage.tsx:1485-1494) passes `linkedGoals` as a prop but this is a renderer-side only association — it is NOT persisted.

### notes table (main.ts:3102-3111 — migrated columns)
```sql
-- notes table has these columns (from migrations):
-- id, title, content, tags, group_name, deadline, deadline_time,
-- reminder ('none'|'at_time'|'15min'|'1hour'|'1day'), status, is_draft,
-- links (JSON array of {type, id} cross-links), group_color, tag_colors
```

### reminders table (main.ts:2728-2738)
```sql
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  due_date TEXT,
  goal_id TEXT,              -- EXISTS but rarely used
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```
**GAP:** `reminders.goal_id` exists but the `create-reminder` IPC (main.ts) does not prominently surface the goal link in the UI.

### context_episodes / context_entities / context_facts (main.ts:3172-3180, 3131-3142)
```sql
CREATE TABLE IF NOT EXISTS context_episodes (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, source_ref TEXT,
  content TEXT NOT NULL, occurred_at TEXT NOT NULL, ingested_at TEXT NOT NULL, metadata TEXT
);

CREATE TABLE IF NOT EXISTS context_entities (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
  aliases TEXT, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_facts (
  id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, predicate TEXT NOT NULL,
  object_literal TEXT, object_id TEXT, valid_from TEXT NOT NULL,
  valid_to TEXT, source_episode_id TEXT, confidence REAL DEFAULT 1.0
);
```
**GAP:** `episodeWriters.writeGoalEpisode()` creates entities for goals and deadlines. NO episode writer exists for `schedule_entries` (noted in gold-page-orchestration CONTEXT_BUNDLE §5).

---

## 2. IPC ENDPOINTS (verbatim from src/preload.ts + src/main.ts)

### Goals
| Channel | Handler (main.ts) | Returns |
|---------|-------------------|---------|
| `get-goals-batch` | ~18463 | `{ success, days: [{date, reviewSummary, goals[]}] }` |
| `save-goal` | ~18496 | `{ success }` — persists ALL goal fields including parent_id, deadline, linked_schedule_id, is_habit, cadence, etc. |
| `save-goals-batch` | ~18530 | `{ success }` |
| `get-longterm-goals` | ~18521 | `{ success, goals: LongTermGoal[] }` — period='longterm' |
| `get-goal` | ~19934 | `{ success, goal }` — single goal by ID |
| `get-child-goals` | (preload only — not in main.ts handler list, may be stub) | `{ success, children[] }` |
| `goal:get-habits` | ~19333 | habits (goals where is_habit=1) |
| `goal:toggle-habit-day` | (preload declared, handler TBD) | — |
| `get-daily-goal-progress` | ~19177 | `{ [goalId]: {progressSeconds, targetSeconds, percentComplete, status} }` |
| `link-goal-to-entity` | ~20006 | `{ success }` — links to problem/request only |
| `unlink-goal-from-entity` | ~20006 | `{ success }` |

### Schedule
| Channel | Handler (main.ts) | Returns |
|---------|-------------------|---------|
| `get-schedule` | ~20385 | `{ success, entries: ScheduleEntry[] }` |
| `add-schedule-entry` | ~20392 | `{ success, id }` — **DOES NOT save goal_id** (gap) |
| `update-schedule-entry` | ~20408 | `{ success }` |
| `delete-schedule-entry` | ~20401 | `{ success }` |
| `get-schedule-templates` | ~20488 | `{ success, templates }` |
| `apply-schedule-template` | ~20495 | `{ success, count }` |
| `save-schedule-template` | ~20511 | `{ success, id }` |
| `parse-schedule` | ~20369 | parsed schedule object |

### Deadlines
| Channel | Handler (main.ts) | Returns |
|---------|-------------------|---------|
| `get-deadlines` | ~20420 | `{ success, deadlines[] }` — filtered by due_date + remind_at |
| `add-deadline` | ~20432 | `{ success, id }` — normalizes dates to YYYY-MM-DD |
| `update-deadline-status` | ~20445 | `{ success }` — handles recurrence re-scheduling |
| `delete-deadline` | ~20460 | `{ success }` |
| `update-deadline` | ~20467 | `{ success }` — allowed fields: title, course, due_date, priority, description, category, recurrence, status, remind_at |
| `snooze-deadline` | ~20479 | `{ success }` |

### Notes
| Channel | Handler (main.ts) | Returns |
|---------|-------------------|---------|
| `notes:list` | ~19467 | `{ notes[] }` |
| `notes:create` | ~19505 | `{ success, id }` |
| `notes:update` | ~19519 | `{ success }` |
| `notes:delete` | ~19550 | `{ success }` |

### Preload bridges (src/preload.ts:1070-1177 — verbatim)
```typescript
// Goals
getGoals: (date: string) => ipcRenderer.invoke('get-goals', date),
getGoalsBatch: (startDate: string, endDate: string) => ipcRenderer.invoke('get-goals-batch', startDate, endDate),
getLongtermGoals: () => ipcRenderer.invoke('get-longterm-goals'),
saveGoal: (date: string, goal: any) => ipcRenderer.invoke('save-goal', date, goal),
deleteGoal: (goalId: string) => ipcRenderer.invoke('delete-goal', goalId),
saveGoalReview: (date: string, reviewSummary: string) => ipcRenderer.invoke('save-goal-review', date, reviewSummary),
getDailyReflection: (date: string) => ipcRenderer.invoke('get-daily-reflection', date),
getGoal: (goalId: string) => ipcRenderer.invoke('get-goal', goalId),
getChildGoals: (parentId: string) => ipcRenderer.invoke('get-child-goals', parentId),
saveGoalsBatch: (goals: any[]) => ipcRenderer.invoke('save-goals-batch', goals),
linkGoalToEntity: (goalId: string, link: { type: 'problem' | 'request'; id: string; label?: string }) => ipcRenderer.invoke('link-goal-to-entity', goalId, link),
getDailyGoalProgress: (date: string, goals: any[]) => ipcRenderer.invoke('get-daily-goal-progress', date, goals),
getGoalTimeline: (date: string) => ipcRenderer.invoke('get-goal-timeline', date),

// Schedule & Planning
getSchedule: () => ipcRenderer.invoke('get-schedule'),
addScheduleEntry: (entry: any) => ipcRenderer.invoke('add-schedule-entry', entry),
deleteScheduleEntry: (id: string) => ipcRenderer.invoke('delete-schedule-entry', id),
updateScheduleEntry: (id: string, patch: any) => ipcRenderer.invoke('update-schedule-entry', id, patch),
getDeadlines: (opts?: { days?: number; course?: string }) => ipcRenderer.invoke('get-deadlines', opts),
addDeadline: (dl: any) => ipcRenderer.invoke('add-deadline', dl),
updateDeadlineStatus: (id: string, status: string) => ipcRenderer.invoke('update-deadline-status', id, status),
deleteDeadline: (id: string) => ipcRenderer.invoke('delete-deadline', id),
updateDeadline: (id: string, patch: any) => ipcRenderer.invoke('update-deadline', id, patch),
snoozeDeadline: (id: string, minutes: number) => ipcRenderer.invoke('snooze-deadline', id, minutes),

// Notes
notesList: () => ipcRenderer.invoke('notes:list'),
notesCreate: (data: any) => ipcRenderer.invoke('notes:create', data),
notesUpdate: (id: string, data: any) => ipcRenderer.invoke('notes:update', id, data),
notesDelete: (id: string) => ipcRenderer.invoke('notes:delete', id),

// Reminders
getReminders: () => ipcRenderer.invoke('get-reminders'),
createReminder: (data: { text: string; due_date?: string; goal_id?: string }) => ipcRenderer.invoke('create-reminder', data),
toggleReminder: (id: string, done: boolean) => ipcRenderer.invoke('toggle-reminder', id, done),
deleteReminder: (id: string) => ipcRenderer.invoke('delete-reminder', id),
```

---

## 3. EXISTING UI COMPONENTS (verbatim source)

### GoldPage.tsx (src/features/warmth/gold/GoldPage.tsx — 1679 lines)
The Gold page is the goal hub inside LifePage (`pageTab === 'gold'`). Key structures:

**State (GoldPage.tsx:1108-1113):**
```typescript
const [showWeekSchedule, setShowWeekSchedule] = useState(false);
const [todos, setTodos] = useState<{ id: string; text: string; done: boolean; createdAt: string; goalId?: string }[]>([]);
const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
const { focusState, activeGoalIds, getAccumulatedSeconds } = useFocusGoals(goals);
```

**Todo handlers (GoldPage.tsx:1410-1419) — LOCAL STATE ONLY, NO BACKEND:**
```typescript
const addTodo = (text: string) => {
  setTodos(prev => [...prev, { id: `todo_${Date.now()}`, text, done: false, createdAt: new Date().toISOString() }]);
};
const toggleTodo = (id: string) => {
  setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
};
const deleteTodo = (id: string) => {
  setTodos(prev => prev.filter(t => t.id !== id));
};
```
**GAP:** Todos are purely local state. They reset on unmount. No persistence, no goal linking, no deadline linking.

**Schedule handlers (GoldPage.tsx — uses IPC):**
```typescript
const addScheduleEntry = async (data: Omit<ScheduleEntry, 'id' | 'createdAt'>) => {
  // calls api.addScheduleEntry(data) → IPC → main.ts add-schedule-entry
  // BUT main.ts handler does NOT persist goal_id (gap)
};
const updateScheduleEntry = async (id: string, patch: Partial<ScheduleEntry>) => {
  // calls api.updateScheduleEntry(id, patch)
};
const deleteScheduleEntry = async (id: string) => {
  // calls api.deleteScheduleEntry(id)
};
```

**Radar marks (GoldPage.tsx:1397-1408) — DEADLINES + REMINDERS + LTG DEADLINES:**
```typescript
const radarMarks = useMemo(() => {
  const m = new Map<string, RadarMark[]>();
  const push = (date: string, mark: RadarMark) => {
    if (!m.has(date)) m.set(date, []);
    m.get(date)!.push(mark);
  };
  deadlines.forEach(d => { if (d.due_date && d.status !== 'completed') push(d.due_date, { color: '#f43f5e', label: d.title }); });
  reminders.forEach(r => { if (r.due_date) push(r.due_date, { color: '#fbbf24', label: r.text }); });
  longTermGoals.forEach(l => { if (l.deadline) push(l.deadline, { color: '#a78bfa', label: l.title }); });
  return m;
}, [deadlines, reminders, longTermGoals]);
```

**Layout (GoldPage.tsx:1446-1495):**
```
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  LEFT (lg:col-span-2):
    Stat Pills (Active/Sealed/Streak/Tracked)
    WeeklyGoalsView (weekly goals overview)
    TodoList (Quick Todos — local state, no linking)
    ScheduleCard (entries + linkedGoals prop, but linking not persisted)
  RIGHT:
    (DeadlineRadar/BellBoard were removed per code comment at line 1497)
```

### ScheduleTab.tsx (src/components/life-river/ScheduleTab.tsx — 473 lines)
The ScheduleTab is rendered inside LifePage's `pageTab === 'schedule'`. Separate from GoldPage's ScheduleCard.

**ScheduleEntry interface (ScheduleTab.tsx:20-31):**
```typescript
interface ScheduleEntry {
  id: string
  title: string
  location?: string
  day_of_week: number
  start_time: string
  end_time: string
  category?: ScheduleCategory    // 'class' | 'lab' | 'study' | 'exam' | 'meeting' | 'other'
  color?: string
  goal_id?: string               // COLLECTED in form but NEVER persisted (gap)
  createdAt: string
}
```

**EntryForm (ScheduleTab.tsx:78-130):**
- Has `goalId` state (line 92)
- Passes `goal_id` in `onSave` (line 127)
- But the backend `add-schedule-entry` handler ignores it

### ScheduleCard.tsx (src/pages/dashboard/ScheduleCard.tsx — 465 lines)
Used in GoldPage (GoldPage.tsx:1485). Has `linkedGoals` prop (line 96) but does NOT write goal_id to DB.

```typescript
interface ScheduleCardProps {
  entries: ScheduleEntry[];
  selectedDate?: string;
  selectedDay?: number;
  onAdd: (entry: Omit<ScheduleEntry, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, patch: Partial<ScheduleEntry>) => void;
  onDelete: (id: string) => void;
  linkedGoals?: { id: string; title: string; category: string }[];  // renderer-side only
  showAll?: boolean;
}
```

### TodoList.tsx (src/components/goals/TodoList.tsx — 124 lines)
```typescript
interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  goalId?: string;          // FIELD EXISTS but never set/persisted
}

interface TodoListProps {
  todos: Todo[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}
```
**GAP:** `goalId` field is in the interface but GoldPage's `addTodo` handler (line 1411-1413) does NOT accept or set it. Todos are disconnected from goals, deadlines, and schedules.

### HabitTracker.tsx (src/components/goals/HabitTracker.tsx)
Renders habits in a weekly grid. Calls `goal:get-habits` IPC. Used in GoldPage.

### GoalCard.tsx (src/components/goals/GoalCard.tsx — 251 lines)
Renders individual goal with checkbox, progress bar, category badge, linked schedule indicator, deadline countdown, LTG parent link.

### CriteriaBuilder.tsx (src/components/goals/CriteriaBuilder.tsx — 321 lines)
Goal creation form. Has: title, description, category, period, targetType, time config, detection, LTG picker. Does NOT have: cadence config, completion logic, tracking mode, cross-feature link picker, external activity picker.

---

## 4. TYPE DEFINITIONS (canonical — src/types/goals.ts)

```typescript
export type GoalCategory = 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'relationships' | 'reflection';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'longterm';
export type GoalStatus = 'active' | 'done' | 'archived' | 'failed' | 'missed';
export type GoalSource = 'manual' | 'ai' | 'system';
export type TargetType = 'time' | 'completion' | 'external' | 'habit' | 'cross_feature';
export type TrackingMode = 'system' | 'manual' | 'hybrid';

export interface CompletionLogic {
  lateAllowed: boolean;
  gracePeriodMinutes: number;
  partialCredit: boolean;
  partialCreditThreshold?: number;
  streakOnMiss: 'reset' | 'continue' | 'pause';
}

export interface CadenceConfig {
  type: 'fixed' | 'rolling' | 'flexible';
  fixedDays: number[];
  rollingTarget: number;
  flexibleWindowDays: number;
}

export interface CrossFeatureLink {
  feature: 'learn' | 'finance' | 'external' | 'ide' | 'focus' | 'schedule' | 'deadline' | 'reminder' | 'note' | 'browser' | 'sleep' | 'brain' | 'composition';
  entityId: string;
  label: string;
}

export interface Goal {
  id: string; title: string; description?: string;
  category: GoalCategory; target: GoalTarget; period: GoalPeriod;
  status: GoalStatus; date: string; source: GoalSource;
  links: GoalLink[]; progressSeconds?: number; completedAt?: string;
  createdAt: string;
  parentId?: string; parentIds?: string[];
  streak?: number; isHabit?: boolean; cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: { enabled: boolean; mode: 'positive' | 'avoidance'; keywords: string[]; minMinutes: number };
  linkedScheduleId?: string; journalText?: string; slippedCount?: number; deadline?: string;
  priority?: number;
  trackingMode?: TrackingMode;
  completionLogic?: CompletionLogic;
  cadenceConfig?: CadenceConfig;
  crossFeatureLink?: CrossFeatureLink | null;
  externalActivityId?: number | null;
}
```

---

## 5. CROSS-FEATURE LINKS — WHAT EXISTS vs WHAT'S MISSING

### What EXISTS today
| Link | Where | Direction | Backed by DB? |
|------|-------|-----------|---------------|
| Goal → Long-term goal (parent) | `goals.parent_id` / `goals.parent_ids` | Many-to-one | ✅ Yes |
| Goal → Schedule block | `goals.linked_schedule_id` | One-to-one | ✅ Yes (column exists) |
| Goal → Deadline (date) | `goals.deadline` (text date) | One-to-one (date only) | ✅ Yes (column exists) |
| Goal → Problem/Request | `goals.links` JSON array | Many-to-many | ✅ Yes |
| Goal → Context Brain | `episodeWriters.writeGoalEpisode()` | One-way | ✅ Yes (episodes/entities/facts) |
| Deadline → Context Brain | `episodeWriters.writeDeadlineEpisode()` | One-way | ✅ Yes |
| Note → Anything | `notes.links` JSON array | Many-to-many | ✅ Yes |
| Schedule → Context Brain | **NONE** | — | ❌ GAP |
| Todo → Anything | **NONE** | — | ❌ GAP (local state only) |
| Reminder → Goal | `reminders.goal_id` | One-to-one | ✅ Yes (column exists, but rarely used) |

### What's MISSING (the orchestration gaps)
1. **Schedule entries don't persist `goal_id`** — the form collects it, but the IPC handler drops it
2. **Todos are local state only** — no persistence, no goal/deadline/schedule linking
3. **Deadlines don't link to goals** — `deadlines` table has no `goal_id` column
4. **Deadlines don't link to habits** — no connection between deadline completion and habit tracking
5. **No hierarchical CRUD for schedule entries** — schedule blocks can't be children of goals or parents of other blocks
6. **No visual connection explorer** — clicking a goal doesn't show its schedule blocks, deadlines, notes, or parent LTG in one view
7. **No "today" unified view** — GoldPage shows goals, schedule, todos, and radar marks as separate sections
8. **Notes' `links` JSON is free-form** — no structured linking to specific goal/schedule/deadline IDs with validation
9. **`cross_feature_link` exists on goals but has no UI** — it's a JSON column with no picker
10. **`reminders.goal_id` exists but isn't surfaced** — creating a reminder doesn't offer goal linking in the UI

---

## 6. DESIGN TOKENS (binding — src/index.css + component conventions)

```css
[data-page="life"] { --page-accent: #e8866b; }
```

**Gold page specific (from GoldPage.tsx):**
- Warm palette: amber-400 (#fbbf24) primary, amber-300 (#fcd34d) secondary
- Glass cards: `bg-[rgba(24,24,27,0.60)] backdrop-blur-xl border border-[rgba(63,63,70,0.40)]`
- Fonts: Geist body 13px, JetBrains Mono for data, warmth-serif for headings (custom font)
- Border radius: `rounded-xl` max
- Padding: `p-4` to `p-5`

**MCP component inventory (from frontend-external-infra skill):**
| Component | Source | Use for |
|-----------|--------|---------|
| card, dialog, input, select, tabs, badge, separator, skeleton, switch, tooltip | shadcn/ui v4 | Base UI |
| number-ticker | Magic UI | Stat counters |
| border-beam | Magic UI | Active/urgent card glow (conditional only — see MEMORY §2026-08-15) |
| confetti | vendored | Goal completion celebration |
| LoaderCircle, CheckCircle2, Flame, Target, Clock, Calendar, CalendarDays, Bell, Trash2, Plus, Pencil, X, ChevronDown, ChevronUp, Sparkles, Lightbulb, Timer, Code2, Activity, Link2, ArrowRight | lucide-react | Icons |
| 135+ animated components | React Bits | Motion variations |
| 200k+ icons | Iconify | Fallback |

**Anti-slop rules (from MEMORY + skills):**
- BorderBeam on content cards = bug (mask-composite fails in this Electron build) — use top-edge h-px gradient instead
- Never put `onClick={close}` on modal backdrop
- Todos/delete must use explicit X button, not backdrop click
- All new components need console stamp: `console.log('%c[ComponentName] vX.Y loaded', 'color: #fbbf24; font-weight: bold')`

---

## 7. EXISTING PROMPT PACKAGES (reference — do NOT duplicate)

- `agent/docs/generate-prompt-docs/gold-page-orchestration-26082026/` — Self Page Orchestration (6 systems: Schedule, Deadlines, Goals, Notes, Context Brain, Identity). PROMPT.md tasks AI with unified orchestration layer + Today View + Connection Explorer.
- `agent/docs/generate-prompt-docs/goals-customization-overhaul-26082026/` — Goals Customization Overhaul (cadence, completion logic, cross-feature links, tracking mode, habits, AI monitor). Full RESULT.md exists.
- `agent/docs/generate-prompt-docs/ai-schedule-planning-overhaul/` — Schedule/Planning/Reminder system. Focuses on CalDAV + reminders + daily goals.

**This prompt is DIFFERENT:** it focuses specifically on the Goal page as a sub-page of Life, with hierarchical parent-child relationships across ALL entity types (todo→deadline→goal→habit→schedule), and the UI visualization of those connections.

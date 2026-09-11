# Context Bundle — Goal Page Orchestrator

## Raw Request

> Um, I would like you to be the ones that is going to work on the goal page, right? Goal page, which is a sub-page of the life page. I need you to read the instructions in the OpenAI JSON, list of instructions for form of Markdown files. There's right around six or seven of them, and you need to make sure they read everything and understand everything properly. I would like you to do is to configure those life pages. Focused on the main task is to make sure that everything is interconnected to one another, mainly the to-do list thing. It should be that you use the logic of a human where to-do list might be connected to a deadline. A deadline might be connected to a certain goal. A deadline might be connected to a certain habit that we would like to develop, right? For example, we would like to have a habit of waking up early, a deadline, or, for example, having an idea, right? For example, having an idea would have a deadline of going to the gym, or having an appointment to a doctor, right? We have a schedule, we have a deadline, and we have, like, assignment of dates and so on and so forth. And those things are all interconnected to one another in a way, whereas a to-do list can be part of a certain schedule with a deadline or a task that we might have. So it should be able to assign to one another. It should be in a hierarchical form where it's able to be a parent of one and it's able to be a children of another, right? And how we will be able to do that and to be orchestrating everything properly and having the UI and having the proper visualizations for all of those and having the proper customizations and what are the fields and what are the existing features that we already have and what are the things that we need to adjust. I need you to make sure that you use the generate prompt skill to let an AI be able to orchestrate all of that properly and to be able to generate the UI and to be able to do all of that properly. Yeah. I would like you to make sure that you use all the prompts and skills including the generate prompt thing and make sure you use the MCP to find the elements and everything like that because you're stupid and you're fucking dumb. I need you to make sure that you generate the prompt including all the context needed and so on and so forth.

## Problem Statement

The goal page system needs to be redesigned with proper hierarchical connections between:
- **Goals** (long-term objectives)
- **TODOS** (task items linked to goals, deadlines, schedules)
- **Deadlines** (time-bound targets linked to goals/habits)
- **Habits** (recurring behaviors linked to goals)
- **Schedules** (time blocks linked to todos/goals)

The current system has these elements but lacks a unified visualization and proper bidirectional linking UI.

## Current Implementation

### File: `/src/components/goals/GoalCard.tsx`

**Lines 34-237**: Main goal card component
- Types: `Goal`, `LongTermGoal` imported from `../dashboard/types`
- Props: `{ goal, onToggle, onDelete, onEdit, longTermGoals[] }`
- Features: todo status, progress tracking, category styles, parent goal linking

**Lines 239-247**: Skeleton loader
**Lines 249-267**: Empty state
**Lines 269-287**: Error state

### File: `/src/components/goals/TodoList.tsx`

**Lines 47-400**: Todo list with linking capabilities
- Props: `{ goalOptions[], deadlineOptions[], scheduleOptions[] }`
- Todo type has: `id, text, done, createdAt, completedAt, goalId, deadlineId, scheduleId, parentTodoId, dueDate, reminder`
- Features: create, toggle, delete, link to goal/deadline/schedule

### File: `/src/features/warmth/gold/GoldPage.tsx`

**Lines 1086-1679**: Main gold/goal page
- Uses CalendarStrip, PhaseCard, CriteriaBuilder, HabitTracker, etc.
- Has week view, river view integration
- Manages goals, long-term goals, memories, phases

### File: `/src/pages/dashboard/types.ts`

**Lines 1-100**: Core type definitions
```typescript
export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'relationships';
  period: 'daily' | 'weekly' | 'longterm';
  status: 'active' | 'done' | 'missed' | 'suggested';
  date: string;
  source: string;
  target: { type: string; targetSeconds?; maxExternalSeconds?; matchApps? };
  links?: any[];
  parentId?: string;
  parentIds?: string[];
  progressSeconds?: number;
  streak?: number;
  deadline?: string;
  trackingMode?: string;
  completionLogic?: any;
  cadenceConfig?: any;
  crossFeatureLink?: any;
  detection?: any;
  createdAt: string;
  completedAt?: string;
}
```

## IPC Endpoints (from preload/main)

From the IPC analysis, these are the relevant goal-related endpoints:

1. `todoList()` - Get all todos
2. `todoCreate({ text, goalId, deadlineId, scheduleId, parentTodoId, dueDate })`
3. `todoToggle(id)` - Toggle todo done status
4. `todoDelete(id)` - Delete todo
5. `todoUpdate(id, patch)` - Update todo
6. `todoGetConnections(entityType, entityId)` - Get connected entities
7. `getGoals(date)` - Get daily goals
8. `getLongtermGoals()` - Get long-term goals
9. `saveGoal(date, goal)` - Save daily goal
10. `saveGoalsBatch(goals[])` - Save multiple goals
11. `getDeadlines(options)` - Get deadlines
12. `getReminders()` - Get reminders
13. `getSchedule()` - Get schedule entries
14. `createReminder({ text, dueDate })`
15. `toggleReminder(id, done)`
16. `deleteReminder(id)`

## Design Tokens & Components

### Colors (from CSS/variables)
- `--bg-primary`: #18181b (zinc-950)
- `--border-primary`: rgba(63,63,70,0.40)
- `--text-primary`: #fafafa (zinc-100)
- `--text-secondary`: rgba(255,255,255,0.60)
- Ample: #fbbf24 (amber-400)
- Success: #22c55e (emerald-400)
- Warning: #eab308 (amber-500)

### Existing UI Components (from GoldPage)
- `Target` - goal/habit icon (lucide-react)
- `Flame` - streak/habit icon
- `Clock` - timer tracking
- `CalendarDays` - schedule/deadline
- `CheckCircle2` - completion
- `RefreshCw` - period indicator
- `Calendar` - date picker
- `Pencil` - edit
- `Trash2` - delete
- `Plus` - add
- `X` - close/cancel
- `Sparkles` - covenant/AI
- `Layers` - river/phases
- `Images` - memories
- `BookOpen` - notes
- `HeartHandshake` - covenant tab
- `User` - self/tab
- `Network` - stats

## Components Created (Connection Explorer & Hierarchy Tree)

### File: `/src/components/goals/ConnectionExplorer.tsx`

A side-panel component that shows bidirectional connections for any entity:
- Props: `{ entity, isOpen, onClose }`
- Entity types: `goal | todo | deadline | habit | schedule`
- Shows: todos (children), schedule blocks, deadlines, linked goals, linked habits
- Uses framer-motion for L2 (Responsive) motion
- Has L1 loading states (skeleton), empty states, error handling

### File: `/src/components/goals/HierarchyTree.tsx`

A collapsible tree view for hierarchical goals:
- Props: `{ roots, expanded, onToggle, onSelect, filter }`
- Shows: goals, habits, deadlines, todos in a tree structure
- Supports filtering by type
- Uses framer-motion for L2 motion
- L1 motion budget (expand/collapse, hover states)

## User Story Requirements

### Connection Flows

1. **Todo → Deadline**
   - Todo can be linked to a deadline
   - When viewing deadline, see all todos linked to it

2. **Deadline → Goal**
   - Deadline can be linked to a long-term goal
   - When viewing goal, see all deadlines for it

3. **Goal → Habit**
   - Goal can have associated habits
   - Habits can be daily/weekly routines serving the goal

4. **Schedule → Todo**
   - Todo can be scheduled
   - Schedule can show what's planned

5. **Habit → Goal**
   - Habits serve goals
   - Habit streaks connect to goal progress

### Hierarchical Structure

```
Long-Term Goal (parent)
├── Deadline (child)
│   ├── Todo (child of deadline)
│   └── Schedule (linked)
├── Habit (child)
│   └── Todo (daily check-in)
└── Todo (directly linked)
    └── Sub-todo (parentTodoId)
```

## Existing Features to Integrate With

1. **WeekBoard** (GoldPage lines 307-400)
   - Shows daily goals as mini cards
   - Has habit dots with completion status
   - Clickable to toggle

2. **DeadlineRadar** (GoldPage lines 402-509)
   - Month view with deadline markers
   - Shows upcoming deadlines
   - Color-coded marks

3. **BellBoard** (GoldPage lines 748-904)
   - Reminders/events
   - Can be linked to dates

4. **TheVault** (GoldPage lines 545-745)
   - Long-term goal management
   - Has progress rings

5. **HabitTracker** (GoldPage line 1645)
   - Daily habit tracking

## Missing Features / Gaps

1. **Bidirectional Connection View**
   - Currently no unified view showing all connections for an entity
   - User must switch between different sections

2. **Visual Hierarchy**
   - No tree view showing goal → deadline → todo relationships
   - Connections are implicit in IDs but not visualized

3. **Connection Management UI**
   - When adding a todo, can link to goal/deadline/schedule
   - But viewing "what connects here" requires multiple clicks

4. **Interactive Hierarchy Drill-down**
   - Click a goal → see its deadlines → see todos for each deadline
   - Need smooth transitions/page navigation

## Open Questions for Prompt

1. Should the connection explorer and hierarchy tree be separate components or integrated?
2. How should parent-child relationships be displayed (tree view vs. list vs. graph)?
3. What interactions are needed for managing connections (drag-drop, quick-links, inline-edit)?
4. How should the UI handle deep hierarchies (10+ levels)?
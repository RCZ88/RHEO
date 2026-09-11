# PROMPT.md — Goal Page Orchestration (Life Page Sub-Page)

> **Generated:** 2026-09-08 | **Skill:** generate-prompt v2.0.0 | **Target AI:** Lead Designer AND Engineer → produces `RESULT.md`
> **Context bundle:** `CONTEXT_BUNDLE.md` (same folder — read it fully FIRST, it is self-contained with verbatim source)
> **Hands & Eyes agent:** opencode (this repo's agent) — will apply your RESULT.md, build, and verify

---

## 1. RAW REQUEST (verbatim — do not paraphrase)

> "Um, I would like you to be the ones that is going to work on the goal page, right? Goal page, which is a sub-page of the life page. I need you to read the instructions in the OpenAI JSON, list of instructions for form of Markdown files. There's right around six or seven of them, and you need to make sure they read everything and understand everything properly. I would like you to do is to configure those life pages. Focused on the main task is to make sure that everything is interconnected to one another, mainly the to-do list thing. It should be that you use the logic of a human where to-do list might be connected to a deadline. A deadline might be connected to a certain goal. A deadline might be connected to a certain habit that we would like to develop, right? For example, we would like to have a habit of waking up early, a deadline, or, for example, having an idea, right? For example, having an idea would have a deadline of going to the gym, or having an appointment to a doctor, right? We have a schedule, we have a deadline, and we have, like, assignment of dates and so on and so forth. And those things are all interconnected to one another in a way, whereas a to-do list can be part of a certain schedule with a deadline or a task that we might have. So it should be able to assign to one another. It should be in a hierarchical form where it's able to be a parent of one and it's able to be a children of another, right? And how we will be able to do that and to be orchestrating everything properly and having the UI and having the proper visualizations for all of those and having the proper customizations and what are the fields and what are the existing features that we already have and what are the things that we need to adjust. I need you to make sure that you use the generate prompt skill to let an AI be able to orchestrate all of that properly and to be able to generate the UI and to be able to do all of that properly. Yeah. I would like you to make sure that you use all the prompts and skills including the generate prompt thing and make sure you use the MCP to find the elements and everything like that because you're stupid and you're fucking dumb. I need you to make sure that you generate the prompt including all the context needed and so on and so forth."

---

## 2. PROBLEM STATEMENT

### What the user wants (exact words, interpreted)
The **Goal page** is a sub-page of the **Life page**. The user wants ALL entities on this page — todos, deadlines, goals, habits, schedules, long-term goals — to be **fully interconnected in a hierarchy** where:
- A **todo** can be part of a **schedule** block, have a **deadline**, serve a **goal**, or develop a **habit**
- A **deadline** can belong to a **goal**, relate to a **habit**, fall within a **schedule** block
- A **goal** can have **child todos**, a **parent long-term goal**, a **deadline**, be served by **schedule** blocks
- A **habit** (like "wake up early") can have **deadlines**, be linked to **goals**, appear in the **schedule**
- A **schedule** block (like "go to gym") can be tied to a **goal**, have a **deadline**, be the parent of **todos**
- Everything can be a **parent** of some things and a **child** of others — bidirectional hierarchy

### Current state (what exists)
The Gold page (`src/features/warmth/gold/GoldPage.tsx`, rendered as `pageTab === 'gold'` inside LifePage) already has:
- **Goals** — full CRUD, categories, periods, targets, habits (is_habit), deadlines (deadline field), parent linking (parent_id/parent_ids), linked_schedule_id, tracking modes, completion logic, cadence config, cross-feature links
- **Schedule** — ScheduleCard + ScheduleTab with entries (title, day_of_week, start/end time, category). The form collects `goal_id` but the backend DOES NOT persist it
- **Deadlines** — full CRUD with due dates, priorities, recurrence, categories
- **Todos** — TodoList component with local state only. **NOT persisted to DB. NOT linked to anything.**
- **Long-term goals** — The Vault, full CRUD with deadlines
- **Habits** — tracked via is_habit flag + HabitTracker component
- **Notes** — separate tab, has links JSON array for cross-referencing
- **Context Brain** — episodes/entities/facts that auto-track goals and deadlines

### Critical gaps (what MUST be built)
1. **Todos are not real** — they're local state in GoldPage. Need a `todos` DB table with full linkage fields
2. **Schedule entries don't persist goal_id** — the form collects it, the IPC handler drops it. Need to add `goal_id` column to `schedule_entries` and update the handler
3. **Deadlines don't link to goals or habits** — the `deadlines` table has no `goal_id` or `habit_id` column. A deadline like "go to gym" should link to a goal or habit
4. **No hierarchical plan system** — todos should be able to be children of goals, deadlines, habits, or other todos. Need a `parent_id` + `entity_type` on todos
5. **No unified "connection view"** — clicking any entity should show ALL its connections across systems
6. **No visual hierarchy tree** — the user wants to SEE the parent-child relationships visually
7. **Cross-feature linking is defined in types but not wired** — `crossFeatureLink` field exists on Goal type but has no UI picker or backend resolution

---

## 3. MANDATE — Lead Designer AND Engineer → RESULT.md

You are the **Lead Designer AND Lead Engineer** for the Goal Page Orchestration system. Your output is a single, comprehensive `RESULT.md` that the Hands & Eyes agent (opencode) will use to implement the full feature set.

The Goal page is a **sub-page of the Life page** (`/life?tab=gold`). Everything you design must fit within this context — it is NOT a standalone page.

### What you must produce:
1. **DB schema changes** — new `todos` table, ALTERs to `schedule_entries` and `deadlines` for linkage
2. **IPC endpoints** — full CRUD for todos, updated schedule/deadline handlers with linkage, cross-feature resolution
3. **Type unification** — ensure the types in `src/types/goals.ts` cover ALL entities consistently
4. **TodoList redesign** — persistent, linkable todos with parent/child hierarchy
5. **Schedule linkage** — persist goal_id on schedule entries, show linked goals in ScheduleCard/ScheduleTab
6. **Deadline linkage** — link deadlines to goals/habits, show in GoldPage radar and goal cards
7. **Connection Explorer UI** — a view where clicking any entity shows all its connections
8. **Hierarchy visualization** — tree/graph view of parent-child relationships across entity types
9. **MCP component sourcing** — use shadcn, Magic UI, Lucide components (listed below), re-skinned to DeskFlow tokens
10. **All 4 states** for every new component (empty/loading/error/populated)

---

## 4. ENGINEERING TASKS

### Engineering A — Todo System: DB + IPC + Persistence
**Goal:** Turn todos from local state into a real, linkable, persistent entity.

**DB:** Create `todos` table:
```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  goal_id TEXT,              -- parent: this todo serves this goal
  deadline_id TEXT,          -- parent: this todo is due by this deadline
  habit_id TEXT,             -- parent: this todo develops this habit
  schedule_id TEXT,          -- parent: this todo is part of this schedule block
  parent_todo_id TEXT,       -- parent: this todo is a subtask of another todo
  child_todo_ids TEXT,       -- JSON array of child todo IDs (for bidirectional hierarchy)
  deadline_text TEXT,        -- optional explicit deadline text (when not linked to a deadline row)
  due_date TEXT,             -- YYYY-MM-DD
  reminder TEXT DEFAULT 'none',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
```

**IPC channels needed:**
- `todo:list` — get todos for a date range, with all linkage fields hydrated
- `todo:create` — create a todo with optional links to goal/deadline/habit/schedule/parent_todo
- `todo:update` — update text, done status, links
- `todo:delete` — delete with cascade (orphan child todos? or reassign?)
- `todo:toggle` — toggle done + set completed_at
- `todo:get-connections` — given a todo ID, return ALL connected entities (goal, deadline, habit, schedule, parent/child todos, notes)

**Parent-child hierarchy rules:**
- A todo can have ONE primary parent from: goal, deadline, habit, schedule, or another todo
- A todo can have MULTIPLE child todos
- Bidirectional: setting `parent_todo_id` on child should update `child_todo_ids` on parent
- When a parent goal is deleted, todos linked to it should be handled (reassign? delete? flag?)

### Engineering B — Schedule → Goal Linkage (backend fix)
**Goal:** Persist `goal_id` on schedule entries so schedule blocks can be linked to goals.

**Changes:**
1. ALTER TABLE `schedule_entries` ADD COLUMN `goal_id TEXT`
2. Update `add-schedule-entry` handler to accept and persist `goal_id`
3. Update `update-schedule-entry` handler to allow updating `goal_id`
4. Update `get-schedule` handler to return `goal_id`
5. Update preload bridge to pass `goal_id` in entry payloads

### Engineering C — Deadline → Goal/Habit Linkage (backend fix)
**Goal:** Link deadlines to goals and habits so "go to gym" deadline connects to "exercise 3x/week" habit or "get fit" goal.

**Changes:**
1. ALTER TABLE `deadlines` ADD COLUMN `goal_id TEXT`
2. ALTER TABLE `deadlines` ADD COLUMN `habit_id TEXT` (or reference habit via goal_id since habits are goals with is_habit=1)
3. Update `add-deadline` handler to accept `goal_id` and `habit_id`
4. Update `update-deadline` handler to allow updating these fields
5. Update preload bridge

### Engineering D — Connection Explorer (unified view)
**Goal:** A UI where clicking any entity (todo, goal, deadline, habit, schedule block) shows ALL its connections across every system.

**Data flow:** Given an entity type + ID, query all related entities:
- Todo → goal, deadline, habit, schedule, parent/child todos, notes referencing it
- Goal → parent LTG, child goals, todos serving it, schedule blocks linked to it, deadlines linked to it, notes referencing it, context brain entities
- Deadline → linked goal, linked habit, schedule blocks during it, todos due by it, notes referencing it
- Schedule → linked goal, todos in it, deadlines during it
- Habit → parent goal (if any), deadlines, schedule blocks, child goals

**UI:** A detail panel/modal that shows the entity header + a "Connections" section with cards for each related entity type.

### Engineering E — Hierarchy Tree Visualization
**Goal:** A visual tree/graph showing the parent-child hierarchy across ALL entity types.

**Design:** A collapsible tree where:
- Root nodes are long-term goals (or unscheduled entities)
- Children can be goals, deadlines, habits, schedule blocks, todos
- Color-coded by entity type (goal=amber, deadline=rose, habit=green, schedule=cyan, todo=white)
- Click a node to open the Connection Explorer for that entity

### Engineering F — GoldPage Integration
**Goal:** Update the GoldPage to show the interconnected nature of entities.

**Changes to existing sections:**
1. **TodoList** — replace local state with persistent, linkable todos. Add "Link to" dropdown when creating/editing a todo (goal/deadline/habit/schedule/parent todo)
2. **ScheduleCard/ScheduleTab** — show linked goal on each schedule entry. When creating/editing, allow selecting a goal to link
3. **GoalCard** — show linked schedule blocks, linked deadlines, child todos count, parent LTG
4. **CalendarStrip/radar marks** — already shows deadlines, goals, LTG deadlines. Add habit markers and todo due dates
5. **New section: Connection Explorer** — accessible by clicking any entity or from a "Connections" button

---

## 5. DESIGN / UX TASKS

### Todo Creation/Editing UI
- Inline expansion (not a separate modal) — click "+ Add todo" → inline form appears
- Fields: text (required), link type dropdown (none/goal/deadline/habit/schedule/parent todo), entity selector (filtered by link type), due date (optional), reminder (optional)
- When linked to a goal, show the goal's title + category badge on the todo
- When linked to a deadline, show countdown on the todo
- Drag to reorder within a parent (optional — low priority)

### Connection Explorer Panel
- Slide-in panel (right side) or modal — your choice, but must be accessible from any entity
- Header: entity type icon + name + status
- Sections (collapsible):
  - "Serves" (child entities: todos, sub-goals)
  - "Linked to" (parent entities: goal, deadline, habit, schedule)
  - "Co-occurs with" (schedule blocks during a deadline, deadlines during a schedule block)
  - "Notes" (notes that reference this entity)
  - "Context Brain" (entities/facts from context brain about this entity)
- Empty states for each section ("No linked goals", "No schedule blocks", etc.)
- CTA buttons to create links ("Link to goal", "Add deadline", etc.)

### Hierarchy Tree View
- Toggleable panel in GoldPage (collapsible sidebar or bottom sheet)
- Tree structure with expand/collapse
- Color coding per entity type
- Click to navigate to entity detail
- Filter by type (show only goals + children, only schedule + children, etc.)

### Visual Language
- Entity type colors:
  - Goal: amber (#fbbf24) — matches GoldPage theme
  - Long-term goal: gold/amber darker (#d97706)
  - Habit: emerald (#34d399)
  - Deadline: rose (#f43f5e)
  - Schedule block: cyan (#22d3ee)
  - Todo: white/zinc (#fafafa)
  - Note: violet (#a78bfa)
- Connection lines: thin, muted, dotted for weak links, solid for strong links
- Parent → child arrows or indentation (tree style)

### State Coverage (mandatory for every component)
- **Empty:** "No todos yet — add one below" / "No connections yet — link this to a goal to get started"
- **Loading:** skeleton matching content shape
- **Error:** clear message + retry action
- **Populated:** full view

---

## 6. MCP INVENTORY + SKILLS (MANDATORY for frontend prompts)

### A. Design skills (in load order — ALL 8 MANDATORY for UI work)
1. **frontend-external-infra** — source routing, real component inventory, re-skin rules
2. **frontend-design** — DeskFlow component patterns, tokens, spacing, typography
3. **humancentred-UIUX** — empty/loading/error states, progressive disclosure, visual hierarchy
4. **Impeccable** — 7 design dimensions, 27 anti-patterns
5. **Motion — Bring the UI Alive** — Liveliness Level L2 (responsive), motion taxonomy
6. **Design Taste System** — master dispatcher, variance/motion/density knobs
7. **UI UX Pro Max** — industry-specific rules (productivity/developer tools)
8. **Taste Skill** — 3 tunable knobs, anti-repetition rules

### B. Real MCP component inventory
| Component | Source | Use for |
|-----------|--------|---------|
| card, dialog, input, select, textarea, tabs, badge, separator, skeleton, switch, tooltip, collapsible, accordion | shadcn/ui v4 | Base UI structure |
| number-ticker | Magic UI | Stat counters on goal cards |
| border-beam | Magic UI | **CONDITIONAL ONLY** — active/urgent state glow (see MEMORY 2026-08-15: mask-composite fails in Electron, use top-edge gradient on content cards instead) |
| animated-beam | Magic UI | Connection lines between entities |
| confetti | vendored | Goal completion celebration |
| LoaderCircle, CheckCircle2, Flame, Target, Clock, Calendar, CalendarDays, Bell, Trash2, Plus, Pencil, X, ChevronDown, ChevronUp, Sparkles, Lightbulb, Timer, Code2, Activity, Link2, ArrowRight, GripVertical, Monitor, AlertCircle, Zap, BookOpen, Users, FileText, Brain, Sun, Moon, Sunrise, TrendingUp, NotebookPen | lucide-react | All icons |
| 135+ animated components | React Bits | Motion variations for hover/transition |
| 200k+ icons | Iconify | Fallback if lucide lacks an icon |

### C. Anti-Slop Checklist (from generate-prompt skill + frontend-external-infra)
1. Re-skin to DeskFlow tokens (`--bg-primary`, `--accent-primary`, `--text-primary`, `--page-accent`)
2. Max `rounded-xl` (12px), `p-5` padding
3. Dark mode only — strip any light variants
4. Geist body (13px) + JetBrains Mono code + warmth-serif headings (Gold page only)
5. Glass layer: `bg-[rgba(24,24,27,0.60)] backdrop-blur-xl`
6. Connection lines use `animated-beam` from Magic UI, re-skinned to entity type colors
7. Every view has 4 states (empty/loading/error/populated)
8. All icons from lucide-react — no emoji as UI icons
9. Focus-visible rings use `--page-accent` pattern
10. Modal backdrop must NOT have `onClick={close}` — only X button closes

---

## 7. CONSTRAINTS (hard limits)

1. **Read CONTEXT_BUNDLE.md fully first** — it contains ALL existing source code, DB schemas, IPC handlers, types, and component sources
2. **No new DB tables unless absolutely necessary** — prefer ALTER TABLE + JSON columns (pattern already established). The `todos` table IS necessary (no existing table covers it).
3. **Reuse existing IPC patterns** — `feature:action` naming, guarded ALTER TABLE, preload bridge in `src/preload.ts`
4. **Schedule entries `goal_id` must be persisted** — this is a bug fix, not a new feature. The form already collects it.
5. **Todos must be hierarchical** — parent_id + child_todo_ids for todo-to-todo hierarchy. Entity type + entity ID for cross-entity hierarchy.
6. **Bidirectional links** — when you set parent_id on a child, update child_ids on the parent. Both directions must be queryable.
7. **The Goal page is a sub-page of Life** — fit within GoldPage's existing layout. Don't create a standalone route.
8. **No new npm dependencies** — use existing: framer-motion, lucide-react, react, tailwind, better-sqlite3
9. **Console stamp on every new component** — `console.log('%c[ComponentName] vX.Y loaded', 'color: #fbbf24; font-weight: bold')`
10. **TypeScript strict mode** — all new code must type-check. Use the canonical types from `src/types/goals.ts`.
11. **Files are CRLF** — preserve line endings; don't mass-reformat.
12. **All localStorage access wrapped in try/catch** — existing convention.

---

## 8. OUTPUT FORMAT — RESULT.md (mandatory structure)

Your RESULT.md MUST contain these sections in this order:

### 8.1 Executive Summary
One paragraph: what this orchestration delivers, why the hierarchical interconnection matters, what changes for the user.

### 8.2 System Architecture
ASCII data-flow diagram showing:
- DB tables (existing + new: todos, schedule_entries with goal_id, deadlines with goal_id)
- IPC layer (existing + new channels)
- Renderer components (GoldPage, TodoList, ScheduleCard, ScheduleTab, GoalCard, ConnectionExplorer, HierarchyTree)
- How entities link to each other (parent-child, cross-feature)

### 8.3 DB Schema Specification
For EACH table:
- Full CREATE TABLE / ALTER TABLE statement (verbatim SQL)
- Every column, type, default, constraint
- Migration path (guarded ALTER pattern)
- Indexes needed

### 8.4 IPC Specification
For EACH channel (existing + new):
- Channel name
- Request payload (exact shape)
- Response shape
- DB queries involved
- Error handling

### 8.5 Type Specification
- Unified entity type that covers todo, goal, deadline, habit, schedule, long-term goal with all linkage fields
- How the existing `Goal` type in `src/types/goals.ts` extends to cover the new entities
- Type helpers for hierarchy traversal (getParent, getChildren, getConnections)

### 8.6 UI Specification
For EACH component (new + modified):
- Component tree (parent → children)
- Props interface
- State management
- Render structure (JSX outline)
- All 4 states (empty/loading/error/populated)
- Console stamp location
- Design tokens used
- Which MCP component sourced it

### 8.7 Interaction & UX Specification
Step-by-step user journeys for:
1. Creating a todo linked to a goal + deadline
2. Creating a schedule block linked to a goal
3. Creating a deadline linked to a habit
4. Viewing all connections of a goal (Connection Explorer)
5. Viewing the hierarchy tree of all entities
6. Toggling a todo done → updates parent goal progress
7. Deleting a goal → what happens to linked todos, schedule blocks, deadlines

### 8.8 Implementation Phases
Ordered, independently buildable phases:
- Phase 1: DB schema (todos table + ALTERs) + IPC handlers
- Phase 2: TodoList redesign (persistent, linkable)
- Phase 3: Schedule linkage (goal_id persistence + UI)
- Phase 4: Deadline linkage (goal_id/habit_id + UI)
- Phase 5: Connection Explorer
- Phase 6: Hierarchy Tree Visualization
- Phase 7: GoldPage integration pass (update all existing sections)

### 8.9 Verification Checklist
For each phase:
- Build: `node scripts/build.mjs` (or vite + esbuild steps)
- Typecheck: `tsc -p tsconfig.app.json`
- Runtime: IPC calls return expected shapes, UI renders, no console errors
- Cross-check: linking a todo to a goal → goal card shows todo count → connection explorer shows both directions

### 8.10 Known Risks & Invariants
- Todo deletion cascade behavior (delete children? reassign?)
- Schedule entry goal_id: what happens when the linked goal is deleted?
- Deadline goal_id: same question
- Bidirectional link consistency (parent_id + child_ids must stay in sync)
- Performance: connection explorer queries must not be N+1

### 8.11 Deferred Items
- Drag-and-drop reordering of todos (Phase 2+)
- Automatic deadline generation from goal dates (AI-powered)
- Natural language todo creation ("add a todo to buy groceries by Friday linked to household goal")
- Calendar view integration (todos + deadlines + schedule on one calendar)

---

## 9. ANTI-REGRESSION CHECKLIST

These existing behaviors MUST NOT break:
- [ ] Goals still create/toggle/delete correctly in GoldPage
- [ ] Long-term goals (TheVault) still work
- [ ] Schedule entries still create/edit/delete in ScheduleTab and ScheduleCard
- [ ] Deadlines still create/edit/delete/toggle status
- [ ] HabitTracker still shows habit grid
- [ ] CalendarStrip still shows goal dates + deadline marks
- [ ] WeeklyGoalsView still shows weekly goal overview
- [ ] FocusGoals integration still works (useFocusGoals hook)
- [ ] Context Brain episodes still fire on goal events
- [ ] GoldPage tab switching (covenant/memories/gold/notes/schedule/self) still works
- [ ] LifePage river view still works
- [ ] TodoList still renders in GoldPage (even if behavior changes)
- [ ] ScheduleCard linkedGoals prop still works (even if backend linkage is added)

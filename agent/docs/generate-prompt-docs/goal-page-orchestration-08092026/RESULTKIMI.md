# RESULT.md — Goal Page Orchestration (Life → Gold → Interconnected Systems)

> **Amended per ruling ledger:** GO-1–GO-13 · LAMINAR (design/design.md) · §15 naming · ENTITY_COLORS · dependency freeze · migration backup gate
> **Supersedes:** `gold-page-orchestration-26082026` overlapping sections
> **Queue position:** Phases 1–7 land AFTER LINUX-TRACKING P0 clears (main.ts/preload.ts hot-file serialization, §7)
> **Evidence base:** CONTEXT_BUNDLE.md schema dumps + IPC tables (verified facts, unchanged)

---

## 8.1 Executive Summary

The Goal page (`/life?tab=gold`) becomes the hub where todos, deadlines, goals, habits, long-term goals, and schedule blocks form one navigable hierarchy: a todo serves a goal, a deadline serves a habit (habits are goals), a schedule block serves a goal, and every entity can be explored from any other through a Connection Explorer and a Hierarchy Tree. Todos graduate from local `useState` to a real DB entity with a single hierarchy parent edge. Schedule and deadline linkages that the forms already collected but the backend dropped are fixed as bug fixes. The user change: nothing on the Gold page is an island — every card shows what it serves and what serves it, in hairline-LAMINAR chrome, with zero hex literals and zero cascade deletes.

---

## 8.2 System Architecture

```
┌────────────────────────────── RENDERER (GoldPage + Life sub-tab) ─────────────────────────────┐
│                                                                                               │
│  TodoList ──▶ LinkPicker (shared: type select + entity select)                                │
│  GoalCard ──▶ EntityChip (todo count / schedule / deadline / parent LTG)                      │
│  ScheduleCard/ScheduleTab ──▶ linked-goal chip + form LinkPicker                              │
│  ConnectionExplorer (slide-in panel, hairline SVG mini-graph, NO animated-beam)               │
│  HierarchyTree (collapsible, hairline SVG, ENTITY_COLORS chips)                               │
│  Radar marks ◀── deadlines + reminders + LTG deadlines + (new) todo due dates                 │
│                                                                                               │
├────────────────────────────── PRELOAD BRIDGE (src/preload.ts) ────────────────────────────────┤
│  todo:list · todo:create · todo:update · todo:toggle · todo:delete · todo:get-connections    │
│  goal:get-connections                                                                         │
│  (updated) add-schedule-entry · update-schedule-entry · get-schedule   ◀── now carry goal_id │
│  (updated) add-deadline · update-deadline · get-deadlines              ◀── now carry goal_id │
│  BRIDGE AUDIT: every new preload pair must have a live main.ts handler (grep-verified)        │
│                                                                                               │
├────────────────────────────── MAIN PROCESS (src/main.ts) ─────────────────────────────────────┤
│  Handlers for all channels above · guarded ALTER migrations · backup gate (Phase 1)           │
│  NO synthetic events · NO cascade deletes (orphan + "Unlinked" badge)                         │
│                                                                                               │
├────────────────────────────── SQLITE ─────────────────────────────────────────────────────────┤
│  todos (NEW)          ── CHECK: ≤1 of {goal_id, schedule_id, parent_todo_id}                  │
│                         deadline_id = relationship edge OUTSIDE the check                     │
│                         NO child_todo_ids (children derived) · NO habit_id (habits = goals)   │
│  schedule_entries     ── + goal_id (BUG FIX: form collected, handler dropped)                 │
│  deadlines            ── + goal_id                                                            │
│  goals                ── unchanged (parent_id/parent_ids/is_habit/linked_schedule_id exist)   │
│  notes.links          ── unchanged (free-form JSON, validated on read)                        │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8.3 DB Schema Specification

### 8.3.1 NEW TABLE: `todos`

```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  goal_id TEXT,                 -- hierarchy edge: serves this goal (habits included: habits are goals)
  schedule_id TEXT,             -- hierarchy edge: belongs to this schedule block
  parent_todo_id TEXT,          -- hierarchy edge: subtask of this todo
  deadline_id TEXT,             -- RELATIONSHIP edge (outside the CHECK; may coexist with any hierarchy edge)
  due_date TEXT,                -- YYYY-MM-DD (free date, no deadline row required)
  reminder TEXT DEFAULT 'none', -- 'none'|'at_time'|'15min'|'1hour'|'1day'
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  CHECK (
    (goal_id IS NULL) + (schedule_id IS NULL) + (parent_todo_id IS NULL) >= 2
  )
);

CREATE INDEX IF NOT EXISTS idx_todos_goal      ON todos(goal_id);
CREATE INDEX IF NOT EXISTS idx_todos_schedule  ON todos(schedule_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent    ON todos(parent_todo_id);
CREATE INDEX IF NOT EXISTS idx_todos_deadline  ON todos(deadline_id);
CREATE INDEX IF NOT EXISTS idx_todos_due       ON todos(due_date);
```

**Design rulings baked in:**
- `CHECK ((goal_id IS NULL) + (schedule_id IS NULL) + (parent_todo_id IS NULL) >= 2)` enforces **at most ONE hierarchy parent** at the DB level — no code path can create a todo serving two goals.
- `deadline_id` is deliberately **outside** the CHECK: a todo may serve a goal AND be due by a deadline simultaneously.
- **NO `child_todo_ids` column** — children are derived: `SELECT * FROM todos WHERE parent_todo_id = ?`. Stored child arrays desync; derived queries cannot.
- **NO `habit_id` column** — habits ARE goals (`is_habit = 1`). Link via `goal_id`; the UI renders the habit styling from the goal row.

### 8.3.2 ALTER: `schedule_entries` — BUG FIX

```sql
-- Guarded migration (existing repo pattern):
-- try { ALTER TABLE schedule_entries ADD COLUMN goal_id TEXT }
-- catch (e) { if (!String(e).includes('duplicate column name')) throw e }
```

The renderer's `EntryForm` (ScheduleTab) already collects `goal_id`; the `add-schedule-entry` handler drops it. Persisting it completes the loop — this is a bug fix, not a feature.

### 8.3.3 ALTER: `deadlines`

```sql
-- Guarded migration (same pattern):
-- try { ALTER TABLE deadlines ADD COLUMN goal_id TEXT }
-- catch (e) { if (!String(e).includes('duplicate column name')) throw e }
CREATE INDEX IF NOT EXISTS idx_deadlines_goal ON deadlines(goal_id);
```

### 8.3.4 Migration gate (Phase 1, blocking)

Per governance addition: DB migrations on the live user DB require, before any ALTER:
1. **File backup** of the user DB to a timestamped sibling path (e.g. `<db>.bak-YYYYMMDD-HHMMSS`).
2. **Row-count report** (printed to console/log): `todos`-relevant counts — `schedule_entries`, `deadlines`, `goals` — before and after migration. Numbers must match pre/post (no row loss).
3. Migration runs only after backup verified to exist on disk.

---

## 8.4 IPC Specification

All channels follow the existing `feature:action` naming and return `{ success: boolean, ... }`. All new preload functions must have a grep-verified main.ts handler — dead pairs are reported and block the phase.

### Todos (all NEW)

| Channel | Payload | Response | DB work |
|---|---|---|---|
| `todo:list` | `{ scope?: { dateFrom?, dateTo? } \| { parentType: 'goal'\|'schedule'\|'todo', parentId: string } }` | `{ success, todos: Todo[] }` | SELECT with optional WHERE on due_date or the parent edge; hydrate goal/schedule/deadline titles in ONE query each (no N+1) |
| `todo:create` | `Omit<Todo,'id'\|'createdAt'\|'completedAt'>` | `{ success, id }` | INSERT; CHECK enforced by DB |
| `todo:update` | `{ id, patch: Partial<Todo> }` | `{ success }` | UPDATE whitelisted fields only (text, due_date, reminder, sort_order, deadline_id) |
| `todo:toggle` | `{ id, done }` | `{ success, completedAt }` | UPDATE done + completed_at = done ? now : NULL |
| `todo:delete` | `{ id }` | `{ success, orphaned: number }` | **NO cascade.** Children (`parent_todo_id = id`) are orphaned → surfaced with "Unlinked" badge + bulk re-link UI. Return orphan count (empty ≠ zero: report `0` explicitly). |
| `todo:get-connections` | `{ id }` | `{ success, goal?, deadline?, schedule?, parent?, children: Todo[], notes: NoteRef[] }` | One query per relation type; batched |

### Goals (NEW)

| Channel | Payload | Response |
|---|---|---|
| `goal:get-connections` | `{ goalId }` | `{ success, parentLtgs: Goal[], childGoals: Goal[], todos: Todo[], schedules: ScheduleEntry[], deadlines: Deadline[], notes: NoteRef[], brainEntities: { id, name, type }[] }` |

### Updated existing channels

| Channel | Change |
|---|---|
| `add-schedule-entry` | Accept + persist `goal_id` (bug fix) |
| `update-schedule-entry` | Allow patching `goal_id` (set or clear) |
| `get-schedule` | Return `goal_id` on every entry |
| `add-deadline` | Accept + persist `goal_id` |
| `update-deadline` | Allow patching `goal_id` |
| `get-deadlines` | Return `goal_id` on every row |

### Preload additions (src/preload.ts — content-anchor: `// Reminders` block)

```typescript
// Todos
todoList: (scope?: any) => ipcRenderer.invoke('todo:list', scope),
todoCreate: (data: any) => ipcRenderer.invoke('todo:create', data),
todoUpdate: (id: string, patch: any) => ipcRenderer.invoke('todo:update', { id, patch }),
todoToggle: (id: string, done: boolean) => ipcRenderer.invoke('todo:toggle', { id, done }),
todoDelete: (id: string) => ipcRenderer.invoke('todo:delete', { id }),
todoGetConnections: (id: string) => ipcRenderer.invoke('todo:get-connections', { id }),
goalGetConnections: (goalId: string) => ipcRenderer.invoke('goal:get-connections', { goalId }),
```

`window.deskflowAPI` naming stays as-is (sanctioned debt; rename to `rheoAPI` is a separate task). Update the existing `addScheduleEntry` / `addDeadline` preload signatures to pass the new fields — no new bridge names needed.

**Error handling:** every handler wraps in try/catch returning `{ success: false, error: String(e) }`; renderer renders the error state (never silently swallows).

---

## 8.5 Type Specification

### New: `Todo` (src/types/goals.ts append)

```typescript
export type TodoReminder = 'none' | 'at_time' | '15min' | '1hour' | '1day';

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  // hierarchy edge — at most ONE is set (DB CHECK enforced)
  goalId?: string;        // serves this goal (habits included — habits are goals)
  scheduleId?: string;    // belongs to this schedule block
  parentTodoId?: string;  // subtask of this todo
  // relationship edge — independent of the hierarchy edge
  deadlineId?: string;    // due by this deadline
  dueDate?: string;       // YYYY-MM-DD, free date without a deadline row
  reminder: TodoReminder;
  sortOrder: number;
  createdAt: string;
  completedAt?: string;
}
```

### ScheduleEntry / Deadline extension

```typescript
// Add to existing ScheduleEntry interface:
goal_id?: string;   // now persisted

// Add to existing Deadline interface:
goal_id?: string;
```

### Hierarchy helpers (src/types/goals.ts or src/lib/)

```typescript
export type TodoParent = { type: 'goal' | 'schedule' | 'todo'; id: string } | null;

export function getTodoParent(todo: Todo): TodoParent {
  if (todo.goalId) return { type: 'goal', id: todo.goalId };
  if (todo.scheduleId) return { type: 'schedule', id: todo.scheduleId };
  if (todo.parentTodoId) return { type: 'todo', id: todo.parentTodoId };
  return null;
}
// getChildren: derived query (todos WHERE parent edge = id) — NEVER a stored array.
// getConnections(entityType, id): dispatcher to todo:get-connections / goal:get-connections.
```

**Invariant (v1):** todo completion NEVER writes goal progress. Toggling a todo done updates only the todo row. Goal progress remains governed by existing tracking logic. (Amends PROMPT.md §8.7 journey 6.)

---

## 8.6 UI Specification

All components: LAMINAR chrome — radii {6 controls / 10 cards / 16 page}, hairlines not shadows, solid surfaces (NO glass/backdrop-blur), zero hex literals, data colors only via `ENTITY_COLORS` from `src/lib/CategoryColors.ts`, transform/opacity-only motion at 140ms reactive, entrances ≤400ms one-shot, `prefers-reduced-motion` honored (expansions become instant state swaps). Console stamp on every new component per repo convention.

### ENTITY_COLORS (binding — GO ruling)

```typescript
// src/lib/CategoryColors.ts — export added:
export const ENTITY_COLORS = {
  goal:     <token>,   // orange
  ltg:      <token>,   // yellow
  habit:    <token>,   // green
  deadline: <token>,   // red
  schedule: <token>,   // teal
  note:     <token>,   // purple
  todo:     <token>,   // chrome (neutral)
} as const;
```

Every entity chip, tree node, radar mark, and connection line consumes `ENTITY_COLORS` — no literal hex anywhere in new code.

### New components

**1. `LinkPicker`** (shared control) — props: `{ value: { type: 'none'|'goal'|'deadline'|'schedule'|'todo', id?: string }, goals: Goal[], schedules: ScheduleEntry[], todos: Todo[], deadlines: Deadline[], onChange }`. Two-step select: link-type Select (radius 6) → entity Select filtered by type. Enforces single hierarchy edge in the type list (`deadline` is a relationship, not a hierarchy parent). States: all four.

**2. `EntityChip`** — props: `{ kind: keyof typeof ENTITY_COLORS, label: string, onClick?, onRemove? }`. Hairline border, 6 radius, token background, left 6px color bar from `ENTITY_COLORS[kind]`. Tabular-nums for counts.

**3. `ConnectionExplorer`** — slide-in right panel (width ~360px, radius 10 card, hairline). Header: entity icon + name + status chip. Collapsible sections (shadcn `collapsible` re-skinned): "Serves" (children), "Linked to" (parents), "Notes", "Context Brain". Mini-graph: **hairline SVG** lines from header node to section nodes — NO animated-beam, NO Magic UI motion components (MCP slop bans). Empty sections render explicit empty strings ("No linked goals") — **empty ≠ zero**. Footer CTAs: "Link to goal" / "Add deadline" open LinkPicker flows.

**4. `HierarchyTree`** — collapsible panel in GoldPage. Tree rendered as indented rows + hairline SVG connectors (vertical/horizontal 1px token-grey lines, square joins). Node = EntityChip + expand chevron. Expand/collapse = instant height/opacity transition 140ms (RM: instant). Filter bar: chip toggles per entity kind. Click node → opens ConnectionExplorer for it.

### Modified components

**5. `TodoList`** — replaces local state with `todo:list` IPC. Inline expand create/edit (no modal). Create form: text input + LinkPicker + due date + reminder. Linked rows render EntityChips (goal/habit chip from goal row's is_habit; deadline chip shows countdown; schedule chip shows block time). "Unlinked" badge (chrome, hairline) on orphaned todos + bulk re-link affordance (multi-select → LinkPicker applies parent to all). Sort by sort_order; explicit X delete button (no backdrop click).

**6. `ScheduleCard` / `ScheduleTab`** — each entry row gains a linked-goal EntityChip; EntryForm gains LinkPicker (goal type only) — its `goal_id` now persists (bug fix completes). Clearing the link sets `goal_id = NULL`.

**7. `GoalCard`** — additions: child-todo count (tabular-nums, `todo:count` derivation — shows `0` explicitly when zero), linked schedule/deadline chips, parent LTG chip (existing). No layout reflow beyond one chip row.

**8. Radar marks (GoldPage)** — add todo due-date marks in `ENTITY_COLORS.todo` (chrome). Existing deadline/reminder/LTG marks unchanged.

**9-state matrix:** every new/modified component implements empty / loading (skeleton matching content shape) / error (message + retry) / populated.

---

## 8.7 Interaction & UX Specification

1. **Create todo linked to goal + deadline:** "+ Add todo" → inline form → text → LinkPicker type `goal` → pick goal → LinkPicker type `deadline` (relationship, stacks) → pick/set → save → row renders goal chip + deadline chip with countdown.
2. **Create schedule block linked to goal:** ScheduleTab EntryForm → fill fields → LinkPicker `goal` → save → `goal_id` persisted (verify with `get-schedule` round-trip) → row renders goal chip.
3. **Create deadline linked to habit:** add-deadline form → LinkPicker-equivalent goal select → pick the habit goal (is_habit row, rendered with habit styling) → save → deadline renders habit-colored chip; habit's goal card shows the deadline chip.
4. **Connection Explorer:** click any entity chip anywhere → panel slides in (140ms translate) → sections populated via `todo:get-connections` / `goal:get-connections` → empty sections explicit → "Link to goal" CTA opens LinkPicker → link writes DB → both endpoints re-render.
5. **Hierarchy Tree:** toggle panel → tree of LTG roots → expand → mixed-type children by derived queries → filter chips → click node → ConnectionExplorer.
6. **Toggle todo done:** checkbox → `todo:toggle` → completed_at stamped → row strike/opacity state → **goal progress untouched (v1 invariant)**.
7. **Delete goal with linked entities:** NO cascade. Linked todos/schedules/deadlines keep rows; their goal references are nulled (or kept as dangling refs rendered as "Unlinked" — implement null-on-delete for schedule/deadline goal_id; todos keep `goal_id`? NO — nulled too, surfaced as "Unlinked" with bulk re-link). Orphan count reported in the delete confirmation.

---

## 8.8 Implementation Phases

> One commit per phase, exact messages, nothing unrelated rides. Hot files: main.ts, preload.ts, GoldPage.tsx — file-claims before edits; content anchors (grep), never line numbers.

| Phase | Scope | Commit message |
|---|---|---|
| **1 — Schema + IPC** | Backup gate → `todos` CREATE + indexes → guarded ALTERs ×2 → handlers → preload bridge → bridge audit report | `feat: todos persistence + entity linkage schema (GO Phase 1)` |
| **2 — Persistent TodoList** | TodoList rewrite on IPC + LinkPicker + EntityChip + Unlinked flow | `feat: persistent linkable todos (GO Phase 2)` |
| **3 — Schedule linkage** | goal_id persistence verified + chips in ScheduleCard/ScheduleTab | `feat: schedule-goal linkage persistence (GO Phase 3)` |
| **4 — Deadline linkage** | deadlines.goal_id + habit/goal chips in GoldPage + radar | `feat: deadline-goal linkage (GO Phase 4)` |
| **5 — Connection Explorer** | Panel + hairline SVG mini-graph + get-connections endpoints wired | `feat: connection explorer (GO Phase 5)` |
| **6 — Hierarchy Tree** | Tree panel + filters + SVG connectors | `feat: hierarchy tree (GO Phase 6)` |
| **7 — Integration pass** | GoldPage wiring sweep + anti-regression checklist run + EOL audit | `feat: goal page orchestration integration (GO Phase 7)` |

---

## 8.9 Verification Checklist (per phase)

- **Build:** `node scripts/build.mjs` exits 0 (app codebase).
- **Typecheck:** `tsc -p tsconfig.app.json` — **zero errors outside docs/debt.md**; report total + delta (sanctioned: RAGService 39-error cascade, pre-existing test/main.ts).
- **Migration gate (Phase 1 only):** backup file exists on disk pre-ALTER; row-count report shows zero row loss; report printed verbatim.
- **IPC round-trips (Phases 1–5):** create → list → update → delete → connections for each entity type; response shapes asserted field-by-field.
- **CHECK enforcement (Phase 1):** attempt todo insert with two hierarchy parents → must fail; error surfaced verbatim, never swallowed.
- **Shell-launch proof (Phases 2–7, UI-touching):** Playwright `_electron.launch` + bounding-box assertions + screenshots of GoldPage with linked entities rendered. Renderer-attach is NOT a gate. Linux: `xvfb-run` preferred; `--no-sandbox` conditional (logged).
- **Empty ≠ zero:** delete all todos → list returns explicit empty state, not fabricated zeros; counts render `0` where zero.
- **Served-artifact check:** verify the launcher serves `dist/` (never dist-tmp/); delete stale dist first.
- **EOL audit:** zero EOL-only diff lines per file; match existing endings.
- **Anti-regression checklist (Phase 7):** every box in §Anti-Regression verified by evidence.

---

## 8.10 Known Risks & Invariants

| Risk | Mitigation |
|---|---|
| CHECK constraint rejected by old SQLite in Electron | Verify better-sqlite3/SQLite version supports boolean arithmetic in CHECK (3.37+ does); fallback: enforce in handler + test |
| Orphan sprawl after deletes | "Unlinked" badge + bulk re-link; orphan count always reported |
| N+1 in Connection Explorer | One batched query per relation type; hydrate titles in SQL JOINs |
| Derived-children drift | No stored child arrays — impossible by construction |
| Todo completion accidentally driving goal progress | v1 invariant: toggle handler touches only todos table; audit grep for `progress` in todo handlers = 0 |
| Bridge dead pairs | Grep audit in Phase 1 gate; any preload without handler blocks the commit |
| Live-DB migration damage | Backup gate (8.3.4) — no backup, no migration |
| Hex literals / glass / animated-beam slipping in from the old prompt | M-1-style audit grep: `backdrop-blur`, hex color regex, `animated-beam`, `BorderBeam` in new files = 0 |

---

## 8.11 Deferred Items

- Drag-to-reorder todos (sort_order column reserved; UI later)
- AI natural-language todo creation ("add a todo to buy groceries by Friday linked to household goal")
- Todo completion → goal progress (v2 — needs principal ruling on credit model)
- Deadline auto-generation from goal dates
- Calendar-strip unification (todos + deadlines + schedule in one calendar view)
- `rheoAPI` rename (sanctioned debt, separate task)

---

## Anti-Regression Checklist (Phase 7 gate — evidence, not self-report)

- [ ] Goals create/toggle/delete in GoldPage (shell-launch screenshot)
- [ ] Long-term goals (TheVault) CRUD intact
- [ ] Schedule entries CRUD in ScheduleTab AND ScheduleCard
- [ ] Deadlines CRUD + status toggle + recurrence re-scheduling intact
- [ ] HabitTracker weekly grid renders habits
- [ ] CalendarStrip goal dates + radar marks (deadline/reminder/LTG + new todo marks)
- [ ] WeeklyGoalsView overview intact
- [ ] `useFocusGoals` / focus integration intact
- [ ] Context Brain episodes still fire on goal events
- [ ] LifePage tab switching (covenant/memories/gold/notes/schedule/self) intact
- [ ] LifePage river view intact
- [ ] TodoList renders in GoldPage (now persistent)
- [ ] ScheduleCard renders with real linked-goal data (not the old renderer-only prop)
```

*Amendments folded in vs. the 2026-09-08 PROMPT.md: DeskFlow→RHEO naming (§15) · glass→solid LAMINAR · radii 6/10/16 · ENTITY_COLORS replaces all hexes · hairline SVG replaces animated-beam/BorderBeam · CHECK ≤1 hierarchy edge · child_todo_ids removed (derived) · habit_id removed (habits are goals) · deadline_id as relationship edge · no cascade deletes (Unlinked + bulk re-link) · todo completion never writes goal progress (v1) · migration backup gate · bridge audit · per-phase commits.*

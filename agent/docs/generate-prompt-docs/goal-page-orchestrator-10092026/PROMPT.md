# Goal Page Orchestrator — Complete Design Specification

## Raw Request

> Um, I would like you to be the ones that is going to work on the goal page, right? Goal page, which is a sub-page of the life page. I need you to read the instructions in the OpenAI JSON, list of instructions for form of Markdown files. There's right around six or seven of them, and you need to make sure they read everything and understand everything properly. I would like you to do is to configure those life pages. Focused on the main task is to make sure that everything is interconnected to one another, mainly the to-do list thing. It should be that you use the logic of a human where to-do list might be connected to a deadline. A deadline might be connected to a certain goal. A deadline might be connected to a certain habit that we would like to develop, right? For example, we would like to have a habit of waking up early, a deadline, or, for example, having an idea, right? For example, having an idea would have a deadline of going to the gym, or having an appointment to a doctor, right? We have a schedule, we have a deadline, and we have, like, assignment of dates and so on and so forth. And those things are all interconnected to one another in a way, whereas a to-do list can be part of a certain schedule with a deadline or a task that we might have. So it should be able to assign to one another. It should be in a hierarchical form where it's able to be a parent of one and it's able to be a children of another, right? And how we will be able to do that and to be orchestrating everything properly and having the UI and having the proper visualizations for all of those and having the proper customizations and what are the fields and what are the existing features that we already have and what are the things that we need to adjust. I need you to make sure that you use the generate prompt skill to let an AI be able to orchestrate all of that properly and to be able to generate the UI and to be able to do all of that properly. Yeah. I would like you to make sure that you use all the prompts and skills including the generate prompt thing and make sure you use the MCP to find the elements and everything like that because you're stupid and you're fucking dumb. I need you to make sure that you generate the prompt including all the context needed and so on and so forth.

---

## Context

Reference: `CONTEXT_BUNDLE.md` — this file contains the complete codebase context including type definitions, IPC endpoints, existing components, and integration points.

---

## Frontend Design Skills List

1. **Frontend Design** — DeskFlow-specific component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions (typography, color, spatial, motion, interaction, responsive, UX writing), 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels (L1 Composed / L2 Responsive / L3 Expressive), motion taxonomy, recipes
5. **UI UX Pro Max** — industry-specific design rules (dev tools, AI/ML, financial), style library
6. **Design Taste System** — design variance knobs, anti-repetition rules
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

---

## MCP Component Inventory

Query each MCP server for actual component names:

### shadcn MCP
Components relevant for goal page:
- `button` — interactive elements with variants
- `dialog` — modals for editing/viewing
- `input` — form inputs
- `select` — dropdown selectors
- `checkbox` — task completion
- `badge` — status indicators
- `scroll-area` — scrollable sections
- `separator` — section dividers

### Magic UI MCP
- `NumberTicker` — count-up animations for stats
- `BorderBeam` — accent borders for cards
- `AnimatedCircularProgressBar` — progress rings
- `Confetti` — completion rewards

### Lucide MCP
- `Target` — goals/objectives
- `CheckCircle2` — completion marks
- `CalendarDays` — deadlines/schedules
- `Clock` — timing tracking
- `Flame` — habits/streaks
- `Brain` — reflection/journal
- `ArrowRight` — parent-child relationships
- `Link2` — connection indicator
- `Trash2` — deletion
- `Edit3` — editing
- `X` — close/cancel
- `Plus` — add

---

## Anti-Slop Checklist

After using any MCP-sourced component, the target AI must:
1. Re-skin to DeskFlow tokens (colors → --bg-primary, --accent-primary, etc.)
2. Max rounded-xl, p-5 padding
3. Respect current theme mode (dark OR light)
4. Geist + JetBrains Mono fonts
5. Glass layer (bg-zinc-900/80 backdrop-blur-xl) for dark mode surfaces

---

## Engineering Task

**Design a comprehensive solution for the Goal Page Orchestrator that provides:**

### Phase 1: Data Processing Pipeline

Define the data model for interconnected entities:

1. **Entity Graph Structure**
   - Define how `parentIds` (array) vs `parentId` (single) relationships work
   - Define bidirectional link resolution algorithm
   - Define aggregation: when a goal is marked done, cascade to children?

2. **Connection Resolution Algorithm**
   ```
   GET /goals/{id}/connections
   Returns:
   ├── todos: [] (todos directly linked OR serving this goal)
   ├── deadlines: [] (deadlines for this goal)
   ├── habits: [] (habits associated with this goal)
   ├── scheduleBlocks: [] (scheduled items for this goal)
   └── linkedEntities: [] (entities this connects TO)
   ```

3. **Hierarchy Build Algorithm**
   - Build tree from flat list of goals with parentId/parentIds
   - Detect circular references
   - Calculate depth levels for indentation

4. **IPC Endpoint Design**
   - `goalGetConnections(id)` → return full connection graph
   - `goalLink(parentId, childId, type)` → create bidirectional link
   - `goalUnlink(parentId, childId, type)` → remove link
   - `goalGetHierarchy(rootId)` → return serialized tree

### Phase 2: High-Fidelity Visual Specifications

**UI Components to Design:**

1. **ConnectionExplorer Panel** (right sidebar)
   - Width: 320px when open, 0px when closed
   - Header: entity title + icon + close button
   - Sections: each connection type with icon + count
   - Items: each connected entity as a chip with type indicator
   - Empty state: "No connections yet" with + button
   - Loading: skeleton with 3 placeholder items
   - Transition: L1 fade + slide from right

2. **HierarchyTree** (main view tab)
   - Tab: "Hierarchy" next to "Goals" and "Week"
   - Filter chips: All / Goals / Todos / Deadlines / Schedule
   - Tree rows: indented parent-child with expand/collapse chevron
   - Drag-and-drop reordering (L2)
   - Type badges with color-coded backgrounds
   - Context menu on right-click for quick actions

3. **Inline Connection Tags** (in GoalList/TodoList)
   - Small chips showing linked entities
   - Click to open ConnectionExplorer for that entity
   - Tooltip on hover with entity preview

4. **Visual Hierarchy Indicators**
   - Left border accent color by type (amber=goal, emerald=habit, rose=deadline)
   - Nested indentation: 16px per level
   - Parent glow: when child is selected, parent row highlighted
   - Progress lineage: progress bar showing parent→child cascade

### Phase 3: User Interaction Flow

**Primary User Journey: Creating a Connected Todo**

1. **Create Todo**
   - Click "Add Todo" button
   - Modal opens with: text input + "Link to..." section
   - Link to: [Goal dropdown] [Deadline dropdown] [Schedule dropdown] [Parent Todo dropdown]
   - User types "Morning run to prepare for Doctor appointment"
   - Links: Goal="Health Improvement", Deadline="Doctor Checkup 2026-09-15"
   - Save

2. **View Connections**
   - Open any goal card
   - Click "View connections" button (edge icon)
   - Right sidebar slides in: shows 3 todos, 2 deadlines, 1 habit
   - Click any item to see its connections (drill-down)

3. **Navigate Hierarchy**
   - View "Hierarchy" tab
   - See long-term goal at top, expand to show deadlines, expand to show todos
   - Drag "Morning run" todo under "Health Improvement" deadline
   - Drop saves new parent relationship

4. **Bulk Actions**
   - Select multiple todos with checkboxes
   - "Link to Goal" batch action
   - "Move to Schedule" batch action

### Phase 4: Backend Integration Points

**IPC Methods Required:**

```typescript
// In preload.ts — add these channels
ipcRenderer.invoke('goal-get-connections', id: string)
ipcRenderer.invoke('goal-link', parentId: string, childId: string, type: string)
ipcRenderer.invoke('goal-unlink', parentId: string, childId: string, type: string)
ipcRenderer.invoke('goal-get-hierarchy', rootId?: string)

// In main.ts — implement these handlers
ipcMain.handle('goal-get-connections', async (_, id) => {
  // Query todos where goalId === id OR deadlineId === id OR parentTodoId === id
  // Query deadlines where linkedGoalId === id
  // Query habits where parentId === id
  // Query schedules where linkedGoalId === id
  return { todos, deadlines, habits, schedules };
})
```

---

## Constraint: What NOT to Change

1. **Do NOT modify** `src/types/goals.ts` — the type definitions are correct as-is
2. **Do NOT modify** the existing GoldPage layout entirely — integrate as additional tabs/views
3. **Do NOT break** existing todo linking via `goalId`, `deadlineId`, `scheduleId` fields
4. **Do NOT change** the period system (daily/weekly/longterm)
5. **The current IPC endpoints must work exactly as they are** — only ADD, don't replace

---

## Requirement Checklist

### Data Processing
- [ ] Define bidirectional link resolution algorithm
- [ ] Define hierarchy build algorithm from flat list
- [ ] Define aggregation/cascade logic for status changes
- [ ] Define conflict resolution for circular references

### Visual Specs
- [ ] ConnectionExplorer panel dimensions and states
- [ ] HierarchyTree filter chip styles
- [ ] Tree row indentation and hover states
- [ ] Connection tag chip designs
- [ ] Visual hierarchy indicators (borders, glows)
- [ ] Progress lineage bar design

### Interaction Design
- [ ] Todo creation with linking workflow
- [ ] Connection view drill-down navigation
- [ ] Drag-and-drop reordering behavior
- [ ] Bulk selection and batch linking
- [ ] Undo/redo for link operations
- [ ] Confirmation for destructive links

### Backend Integration
- [ ] IPC channel definitions
- [ ] Database query patterns for connections
- [ ] Transaction handling for link operations
- [ ] Error states and rollback

---

## Edge Cases

1. **Circular Dependencies**: User links A→B→C→A
   - Detect at link time
   - Show warning: "This would create a cycle"
   - Suggest alternatives

2. **Orphaned Children**: Parent deleted but children remain
   - Children become roots in hierarchy
   - Show warning badge on orphaned items
   - Option to "Adopt" to new parent

3. **Deep Nesting**: 10+ levels of hierarchy
   - Collapse automatically at level 4+
   - "Jump to parent" breadcrumb on deep items
   - Collapsible section headers

4. **Cross-Feature Links**: Goal linked to schedule item in different feature
   - Show external link indicator
   - Navigate to source feature on click
   - Cache connection preview for offline

---

## Output Format

Produce a RESULT.md file with these sections:

1. **Implementation Plan** — Files to modify/create with line numbers
2. **Data Model Updates** — New interfaces/types if needed
3. **Component Designs** — Full React component code with props
4. **IPC Handler Implementations** — Full main.ts additions
5. **Migration Strategy** — How to deploy without breaking existing data
6. **Testing Checklist** — Manual QA steps

---

## Target AI Instructions

Act as **Lead Designer and Engineer** for DeskFlow goal system. Your output must be:

1. **Self-contained**: The target AI cannot read the codebase — your spec must include all necessary context
2. **Executable**: Every component must have working code that compiles with the existing codebase
3. **Integrated**: New features must work alongside existing GoldPage without rewriting it
4. **Backwards Compatible**: Do not break existing data structures or IPC endpoints
5. **Design-perfect**: Visual specs must match DeskFlow's glass morphism + amber accents aesthetic

Do NOT produce options — produce ONE comprehensive solution. Do NOT summarize — write complete, working code with all edge cases handled.
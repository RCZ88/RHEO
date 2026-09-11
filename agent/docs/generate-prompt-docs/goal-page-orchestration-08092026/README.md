# Files created for Goal Page Orchestration prompt package

## Prompt package location
`agent/docs/generate-prompt-docs/goal-page-orchestration-08092026/`

### Files
1. `CONTEXT_BUNDLE.md` — Self-contained code context for the target AI (24.5 KB)
   - DB schemas (goals, deadlines, schedule_entries, notes, reminders, context brain — verbatim from main.ts)
   - IPC endpoints table (goals, schedule, deadlines, notes, reminders — with line numbers)
   - Type definitions (canonical Goal type from src/types/goals.ts)
   - Cross-feature links matrix (what exists vs what's missing)
   - Design tokens + MCP component inventory
   - Existing prompt packages reference (gold-page-orchestration, goals-customization, ai-schedule-planning)

2. `PROMPT.md` — High-fidelity design+engineering prompt for the target AI (23 KB)
   - Raw request verbatim
   - Problem statement: todos are local state, schedule blocks don't persist goal_id, deadlines don't link to goals/habits, no hierarchy, no connection explorer
   - 6 engineering tasks: Todo DB+IPC, Schedule→Goal linkage fix, Deadline→Goal/Habit linkage fix, Connection Explorer, Hierarchy Tree, GoldPage integration
   - UX tasks: Todo creation with linking, Connection Explorer panel, Hierarchy Tree view, entity color coding
   - 8 design skills listed verbatim + real MCP component inventory table
   - 12 hard constraints
   - RESULT.md output format with 11 mandatory sections
   - Anti-regression checklist (13 existing behaviors that must not break)

## What this prompt asks the target AI to produce
A `RESULT.md` that covers:
- New `todos` DB table with full parent/child + cross-entity linkage
- ALTER TABLE fixes for `schedule_entries.goal_id` and `deadlines.goal_id`
- Full IPC CRUD for todos + connection resolution queries
- Connection Explorer UI (slide-in panel showing all links for any entity)
- Hierarchy Tree visualization (collapsible, color-coded by entity type)
- Redesigned TodoList (persistent, linkable, with goal/deadline/habit/schedule parent picker)
- Updated ScheduleCard/ScheduleTab (show + persist linked goals)
- Updated GoalCard (show linked schedule blocks, deadlines, child todos)
- All components with 4-state coverage (empty/loading/error/populated)

## Key gaps this prompt targets
1. **Todos are not real** — local state only, no DB, no persistence, `goalId` field never set
2. **Schedule→Goal broken** — form collects `goal_id`, backend drops it
3. **Deadlines isolated** — no link to goals or habits
4. **No hierarchy** — nothing is a parent/child of anything across entity types
5. **No connection view** — can't see all relationships from one place

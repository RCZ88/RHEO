# Design Prompt — Gold Page Layout Reorganization

## Raw Request

> "gold page is a whole messs, WH IS THERE NO BUTTON TO SET OR ADD FOR ANY OF THE FEATURES?? I CANT ADD A GOAL, I CANT ADD A HABIT I CANT ADD a schedule i cant add a deadline. WHERE EVEN IS THE DEADLINE CARD ON THE GOLD PAGE? also, like the gold and the schedule page is kind of similar in a sense both does show the schedule and shit. but the gold page is VERY VERY CROWDED. plan how we can arrange things so maybe split some into the other page and some into like the gold and some into the schedule page. idk how to arrange the features so that its not too crowded in to one place."

---

## Problem Statement

`src/features/warmth/gold/GoldPage.tsx` (1792 lines) has ~15 features crammed into one scrollable page: Stat Pills, WeeklyGoalsView, TodoList, Goal hierarchy, ScheduleCard, Add Goal, MissedGoalRecoveryBanner, Active/Completed Goals, HabitTracker, AI Goal Coach, CalendarSidebar, ScheduleSyncCard, DeadlinesCard. The page is too crowded, users cannot find action buttons, and the features are conceptually mixed (goals + schedules + habits all on one page).

---

## Context Bundle Reference

Read `CONTEXT_BUNDLE.md` in this folder as the source of truth for code structure, data shapes, and architecture.

## Engineering Task: Data Processing Pipeline

Design the feature redistribution logic:
- Which features move to which page (Gold / Schedule / Life)
- How the navigation between pages works (sidebar tabs, route changes)
- How state is preserved when features move between pages
- The data flow for each feature in its new location

## Design Task: High-Fidelity Visual Specs

Design the layout for each target page:
- **Gold Page** (focus: TODAY'S GOALS + quick actions): Stat Pills, WeeklyGoalsView, Active Goals, Add Goal button, CalendarSidebar (new, 3D entrance), MissedGoalRecoveryBanner, AI Goal Coach. Clean, focused, not crowded.
- **Schedule Page** (focus: TIME MANAGEMENT): ScheduleCard (week view), ScheduleSyncCard, DeadlinesCard, TodoList. Time-based features grouped.
- **Life Page** (focus: LONG-TERM HABITS + growth): HabitTracker, Goal hierarchy/analytics, ConnectionExplorer. Long-term growth features.

Visual specs must follow design.md: `cubic-bezier(0.16,1,0.3,1)` easing, zinc-950 base / zinc-900 elevated / pink-500 accent, rounded-xl, Inter + JetBrains Mono fonts, no glassmorphism on chrome, no decorative glow/gradients, `prefers-reduced-motion` honored.

## UX Task: Interaction Flow

Design the interaction flow:
- Side toggle on CalendarSidebar must work WITHOUT page refresh (preference persists in `window.deskflowAPI` store)
- Add Goal button must be clearly visible on Gold page
- Schedule, Deadlines, Todo features must have clear Add buttons on their respective pages
- Navigation between pages must be intuitive
- Empty states, loading states, error states for each page
- All 4 states covered (empty/loading/error/populated)

## Constraints

- DO NOT remove the CalendarSidebar from GoldPage (it was just implemented per RESULT.md R-59-R-64)
- DO NOT break the preference store persistence (side toggle must work without page refresh)
- DO NOT break the 3D entrance choreography (80ms hold → 520ms turn → 600ms lock)
- All existing features must remain accessible (no data loss)
- Keep MonthWall frozen (R-60)
- The GoldPage is embedded in LifePage's gold tab (`<LifePage key="gold"><GoldPage/></LifePage>`)
- All features are frontend-only (local state + localStorage), no new IPC channels needed
- `window.deskflowAPI.getPreferences()` / `setPreference()` exist and work

## Anti-Slop Checklist

After any MCP-sourced component, MUST:
1. Re-skin to DeskFlow tokens (zinc-950 base, zinc-900 elevated, pink-500 accent, rounded-xl)
2. Max rounded-xl, p-5 padding
3. Dark mode only
4. Geist + JetBrains Mono fonts (max 2 per view)
5. Glass layer (bg-zinc-900/80 backdrop-blur-xl) where appropriate
6. No spring/bounce animations
7. `prefers-reduced-motion` honored

## MCP Inventory

| Component | Source | Use for |
|-----------|--------|---------|
| shadcn Card | shadcn | Feature cards on each page |
| shadcn Button | shadcn | Add buttons, navigation |
| shadcn Tabs | shadcn | Page tabs (if needed) |
| Magic UI BorderBeam | magicui | Visual accents |
| Lucide icons | lucide-react | CalendarDays, Plus, Target, Clock, etc. |
| react-bits | reactbits | Animated backgrounds (if applicable) |

## Output Format

markdown

## Sections to Include

1. **Gold Page layout** — exact component order, spacing, visual hierarchy
2. **Schedule Page layout** — exact component order, spacing, visual hierarchy
3. **Life Page layout** — exact component order, spacing, visual hierarchy
4. **Navigation structure** — how users move between pages
5. **Component redistribution map** — which file moves to which page
6. **State management** — how each page manages its features
7. **Responsive behavior** — mobile/desktop layouts

## Detail Level

8/10 — comprehensive but not exhaustive

## Creativity

20/100 — precise, follow design.md constraints

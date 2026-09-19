# CONTEXT_BUNDLE — Gold Page Layout Reorganization

> Generated 2026-09-19 for external AI design prompt.
> Purpose: redistribute ~15 features currently crammed into src/features/warmth/gold/GoldPage.tsx
> across Gold / Schedule / Life subpages so each page has a clear focus and isn't overcrowded.

---

## 1. The Problem

`src/features/warmth/gold/GoldPage.tsx` (1792 lines) contains ALL of these features in one scrollable page:
- Stat Pills (Active/Sealed/Streak/Tracked)
- WeeklyGoalsView
- TodoList
- Goal hierarchy (HierarchyTree + ConnectionExplorer)
- ScheduleCard (today/week toggle)
- Add Goal (AI LanguageParser + CriteriaBuilder)
- MissedGoalRecoveryBanner
- Active Goals list + Completed Goals toggle
- HabitTracker
- AI Goal Coach
- CalendarSidebar (just added, 156 lines)
- ScheduleSyncCard (just restored)
- DeadlinesCard (just restored)

**Result**: the Gold page is very crowded. Users cannot find action buttons. The page is overloaded.

---

## 2. Current File Structure

```
src/features/warmth/
├── gold/
│   └── GoldPage.tsx          ← the overloaded page (1792 lines)
├── LifePage.tsx              ← has gold tab (now w-full, no max-w-5xl cap)
src/components/goals/
├── CalendarSidebar.tsx        ← new sidebar (156 lines, 3D entrance)
├── CalendarStrip.tsx          ← day strip
├── MonthWall/                 ← frozen, rendered inside CalendarSidebar
src/components/dashboard/
├── ScheduleSyncCard.tsx      ← schedule sync status
├── DeadlinesCard.tsx         ← deadlines + reminders list
src/pages/dashboard/
└── ScheduleCard.tsx          ← schedule grid (today/week toggle)
```

---

## 3. Key Source Code (GoldPage render structure)

The render is a flex layout:
```tsx
<div className="w-full max-w-[1600px] mx-auto">
  <CalendarStrip ... />                          {/* top strip */}
  <AnimatePresence>...</AnimatePresence>          {/* focus banner */}
  <div className={`flex flex-col lg:flex-row gap-4 ${side==='left'?'lg:flex-row-reverse':''}`}>
    <div className="lg:flex-2 min-w-0 space-y-4"> {/* LEFT: ALL features */}
      {/* Stat Pills */}
      <WeeklyGoalsView ... />
      <TodoList ... />
      {/* Goal hierarchy */}
      <WarmCard ambient> <HierarchyTree ... /> </WarmCard>
      {/* ScheduleCard */}
      <WarmCard ambient> <ScheduleCard ... /> </WarmCard>
      {/* Add Goal (AI parser + CriteriaBuilder) */}
      {/* MissedGoalRecoveryBanner */}
      {/* Active Goals + Completed Goals */}
      {/* HabitTracker */}
      {/* AI Goal Coach */}
    </div>
    <CalendarSidebar side={side} onToggleSide={toggleSide} ... />
  </div>
  {/* Bottom full-width */}
  <ReflectionCard ... />
  <WeekReview ... />
  <LifeRiver />
  <ConnectionExplorer ... />
</div>
```

---

## 4. CalendarSidebar Component (156 lines)

Props interface:
```tsx
export interface CalendarSidebarProps {
  side: CalendarSide;           // 'left' | 'right' — persisted in preference store
  onToggleSide: () => void;     // toggles side preference
  selectedDate: string;
  onDateChange: (d: string) => void;
  weekGoals: Record<string, any[]>;
  marks: Map<string, { color: string; label: string }[]>;
  goalDates: Set<string>;
  goals: any[]; deadlines: any[]; reminders: any[];
  schedule: any[]; longTermGoals: any[];
}
```

- Renders: header strip (CalendarDays label + PanelLeft/PanelRight toggle buttons) → 3D scene (MonthWall frozen + CalendarStrip)
- Entrance: 80ms hold → 520ms turn → 600ms lock via CSS class swap
- Preference store key: `gold_calendar_side`, schemaVersion 1
- Uses `window.deskflowAPI.getPreferences()` / `setPreference()`
- Cursor tilt ±4° on pointermove (disabled during entrance)
- `cubic-bezier(0.16,1,0.3,1)` easing, `perspective: 1100px`, `preserve-3d`

---

## 5. Preference Store Pattern

```tsx
// Read:
const prefs = await (window as any).deskflowAPI.getPreferences();
const side = prefs?.['gold_calendar_side']?.side; // 'left' | 'right'

// Write:
await (window as any).deskflowAPI.setPreference('gold_calendar_side', { schemaVersion: 1, side: 'left' });
```

---

## 6. LifePage Gold Tab

`src/features/warmth/LifePage.tsx` line 552:
```tsx
<motion.div key="gold" {...crossfade} className="w-full">
  <GoldPage embedded={...} />
</motion.div>
```
Previously had `max-w-5xl mx-auto` (now removed per layout fix).

---

## 7. Design Tokens (from design/design.md)

- Easing: `cubic-bezier(0.16,1,0.3,1)` — "fast departure, long settle"
- Colors: zinc-950 base, zinc-900/80 elevated, pink-500 accent, rounded-xl
- Fonts: Inter + JetBrains Mono + Space Grotesk (max 2 per view)
- No glassmorphism on chrome, no decorative glow/gradients
- `prefers-reduced-motion` honored

---

## 8. Feature Inventory (what to redistribute)

| Feature | Current Location | Suggested Target | Rationale |
|---------|-----------------|------------------|-----------|
| Stat Pills | GoldPage | GoldPage (keep) | Daily snapshot belongs on Gold |
| WeeklyGoalsView | GoldPage | GoldPage (keep) | Today's core goals |
| Active/Completed Goals | GoldPage | GoldPage (keep) | Core goal management |
| Add Goal (AI + CriteriaBuilder) | GoldPage | GoldPage (keep) | Quick-add belongs on Gold |
| CalendarSidebar | GoldPage | GoldPage (keep) | Just added, part of Gold |
| TodoList | GoldPage | Schedule page | Todos are time-based |
| Goal hierarchy + ConnectionExplorer | GoldPage | Goals page or sidebar | Analytics/relationship view |
| ScheduleCard | GoldPage | Schedule page | Schedule belongs on Schedule |
| ScheduleSyncCard | GoldPage | Schedule page | Sync is schedule concern |
| DeadlinesCard | GoldPage | Schedule page | Deadlines are time-based |
| MissedGoalRecoveryBanner | GoldPage | GoldPage (keep) | Recovery is goal-concerned |
| HabitTracker | GoldPage | Life page | Habits are long-term |
| AI Goal Coach | GoldPage | GoldPage (keep) | Coaching is goal-concerned |
| WeeklyGoalsView | GoldPage | GoldPage (keep) | Already on Gold |
| Stat Pills | GoldPage | GoldPage (keep) | Already on Gold |

---

## 9. Target Pages After Redistribution

### Gold Page (focus: TODAY'S GOALS + quick actions)
- Stat Pills, WeeklyGoalsView, Active Goals, Add Goal, CalendarSidebar, MissedGoalRecoveryBanner, AI Goal Coach
- Clean, focused, ~600 lines

### Schedule Page (focus: TIME MANAGEMENT)
- ScheduleCard (week view), ScheduleSyncCard, DeadlinesCard, TodoList
- Time-based features grouped

### Life Page (focus: LONG-TERM HABITS + growth)
- HabitTracker, Goal hierarchy/analytics, ConnectionExplorer
- Long-term growth features

---

## 10. Navigation Architecture

The app already has a sidebar/router. The Gold page is at route `/warmth/gold` or similar. The Schedule page likely exists at `/warmth/schedule` or `/schedule`. Check `src/pages/` for existing page files.

The GoldPage is embedded in LifePage's gold tab (`<LifePage><GoldPage/></LifePage>`). After redistribution, the Schedule features should either:
- Stay in LifePage's schedule sub-tab, OR
- Move to a dedicated Schedule page

---

## 11. IPC / Backend Notes

- All features are frontend-only (local state + localStorage). No new IPC channels needed.
- `window.deskflowAPI.getPreferences()` / `setPreference()` exist and are tested.
- `src/components/dashboard/types.ts` defines `Goal, LongTermGoal, GoalCategory, Deadline, Reminder, ScheduleEntry`.

---

## 12. Constraints

- DO NOT remove the CalendarSidebar from GoldPage (it was just implemented per RESULT.md R-59-R-64)
- DO NOT break the preference store persistence (side toggle must work without page refresh)
- DO NOT break the 3D entrance choreography (already verified)
- All existing features must remain accessible (no data loss)
- Keep MonthWall frozen (R-60)
- Design: `cubic-bezier(0.16,1,0.3,1)`, zinc palette, no glassmorphism, `prefers-reduced-motion`

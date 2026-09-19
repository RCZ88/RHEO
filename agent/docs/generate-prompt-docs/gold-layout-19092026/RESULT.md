# Gold Page Layout Reorganization — RESULT.md

> **Generated:** 2026-09-19 | **Status:** Design Specification — Ready for Implementation
> **Scope:** Redistribute ~15 features from overloaded `GoldPage.tsx` (1792 lines) across three focused surfaces

---

## 1. Executive Summary

`GoldPage.tsx` has become a dumping ground for every feature remotely related to productivity. The result: users cannot find action buttons, the page scrolls forever, and conceptually different features (daily goals vs. weekly schedule vs. long-term habits) are mashed together without hierarchy.

**The fix:** Split into three focused pages, each with a single mental model:

| Page | Mental Model | Features |
|------|-------------|----------|
| **Gold** | *"What do I do today?"* | Goals, recovery, AI coach, daily reflection, weekly overview, vault context |
| **Schedule** | *"How do I spend my time?"* | Calendar blocks, deadlines, reminders, todos |
| **Habits** | *"Who am I becoming?"* | Habit grids, goal hierarchy, life river, weekly recap |

Each page gets a **primary action button** that is impossible to miss. No page exceeds 800 lines. No feature is lost.

---

## 2. Feature Redistribution Map

### 2.1 Moving OFF GoldPage

| Feature | Destination | Rationale |
|---------|------------|-----------|
| `TodoList` | **Schedule Page** | Todos are time-bounded tasks, not life goals |
| `ScheduleCard` | **Schedule Page** | Schedule grid belongs with time management |
| `ScheduleSyncCard` | **Schedule Page** | Sync status is a schedule concern |
| `DeadlinesCard` | **Schedule Page** | Deadlines are calendar/time events |
| `BellBoard` (reminders) | **Schedule Page** | Reminders are time-based alerts |
| `DeadlineRadar` | **Schedule Page** | Month-calendar radar is schedule context |
| `HierarchyTree` | **Habits Page** | Goal relationships are analytical, not daily-action |
| `ConnectionExplorer` | **Habits Page** | Network view is long-term insight |
| `HabitTracker` | **Habits Page** | Habits are tracked over weeks/months |
| `WeekReview` | **Habits Page** | Weekly recap is retrospective, not planning |
| `LifeRiver` | **Habits Page** | Life phases are long-term narrative |

### 2.2 Staying ON GoldPage

| Feature | Rationale |
|---------|-----------|
| `Stat Pills` | Daily snapshot — belongs on daily page |
| `WeeklyGoalsView` | Today's core goals — the point of the page |
| `WeekBoard` | Weekly habit overview for planning context |
| `CalendarSidebar` | Constraint: just implemented, keep on Gold |
| `MissedGoalRecoveryBanner` | Recovery is goal-concerned |
| `Active/Completed Goals` | Core goal management |
| `Add Goal` (AI + CriteriaBuilder) | Quick-add belongs on daily page |
| `AI Goal Coach` | Coaching is goal-concerned |
| `TheVault` | Long-term context while planning today |
| `ReflectionCard` | Daily journal — end-of-day ritual |

### 2.3 File Moves

```
BEFORE (all in GoldPage.tsx):
  src/features/warmth/gold/GoldPage.tsx (1792 lines)
    → StatPills, WeeklyGoalsView, TodoList, HierarchyTree,
    → ScheduleCard, ScheduleSyncCard, DeadlinesCard,
    → MissedGoalRecoveryBanner, ActiveGoals, CompletedGoals,
    → HabitTracker, AI Goal Coach, CalendarSidebar,
    → ReflectionCard, WeekReview, LifeRiver, ConnectionExplorer

AFTER:
  src/features/warmth/gold/GoldPage.tsx (~650 lines)
    → StatPills, WeeklyGoalsView, WeekBoard, CalendarSidebar,
    → MissedGoalRecoveryBanner, ActiveGoals, CompletedGoals,
    → AddGoal, AI Goal Coach, TheVault, ReflectionCard

  src/features/warmth/schedule/SchedulePage.tsx (~500 lines) [NEW or EXISTING]
    → ScheduleCard, ScheduleSyncCard, DeadlinesCard,
    → TodoList, BellBoard, DeadlineRadar

  src/features/warmth/habits/HabitsPage.tsx (~450 lines) [NEW]
    → HabitTracker, HierarchyTree, ConnectionExplorer,
    → WeekReview, LifeRiver
```

---

## 3. Gold Page Layout

### 3.1 Mental Model
*"I sit down in the morning and decide what matters today. I see my streak, my missed goals, my long-term context, and I add or complete goals. In the evening, I reflect."*

### 3.2 Visual Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GOLD PAGE — "Today"                                                        │
│  Route: /warmth/gold (LifePage gold tab)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ CalendarSidebar (3D entrance, left or right) ────────────────────────┐  │
│  │  [MonthWall frozen] + [CalendarStrip]                                 │  │
│  │  Toggle: [PanelLeft] [PanelRight]                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Stat Pills Row ──────────────────────────────────────────────────────┐  │
│  │  [Active 3]  [Sealed 2]  [🔥 4d]  [2h 14m]                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ WeeklyGoalsView ─────────────────────────────────────────────────────┐  │
│  │  Today's priority goals (compact, 2-3 items max)                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ WeekBoard ───────────────────────────────────────────────────────────┐  │
│  │  Mon Tue Wed Thu Fri Sat Sun                                          │  │
│  │  ·  ·  ●  ·  ·  ·  ·   Meditation                                     │  │
│  │  ●  ●  ·  ·  ·  ·  ·   Exercise                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ MissedGoalRecoveryBanner (if any) ──────────────────────────────────┐  │
│  │  ⚠️ 1 goal missed — [Mark Late] [Reschedule] [Dismiss]               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Goal Controls ───────────────────────────────────────────────────────┐  │
│  │  [+ Add Goal]        [✨ AI Parse]        [Show: All ▼]              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Add Goal Form (collapsible) ────────────────────────────────────────┐  │
│  │  [CriteriaBuilder or GoalLanguageParser]                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Active Goals ────────────────────────────────────────────────────────┐  │
│  │  □ Complete project draft    Work · completion · Scheduled            │  │
│  │  □ Read 30 min               Learning · time · 15m/30m                │  │
│  │  □ Call mom                  Relationships · completion               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ▼ Sealed (2) ───────────────────────────────────────────────────────────    │
│     ✓ Morning routine                                                       │
│     ✓ Email backlog                                                         │
│                                                                             │
│  ┌─ AI Goal Coach ───────────────────────────────────────────────────────┐  │
│  │  [✨ Run AI Health Check]                                             │  │
│  │  or: "All goals look healthy!" / "Adjust target for 'Read 30 min'"   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ The Vault ───────────────────────────────────────────────────────────┐  │
│  │  [○ 45%] Become a senior engineer    90d left                         │  │
│  │  [○ 12%] Save $10k emergency fund    180d left                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Reflection ──────────────────────────────────────────────────────────┐  │
│  │  [Productive 4h] [Coding 2h] [Goals 2/3] [Habits 1/2] [🔥 4d]        │  │
│  │  How did the day go...                                                │  │
│  │  [prompt: You spent 4h productive — where did it go?]                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Component Specifications

#### Stat Pills Row
```tsx
<div className="grid grid-cols-4 gap-3">
  <StatPill icon={<Target size={16} />} label="Active" value={3} accent="pink" />
  <StatPill icon={<CheckCircle2 size={16} />} label="Sealed" value={2} accent="emerald" />
  <StatPill icon={<Flame size={16} />} label="Streak" value="4d" accent="amber" />
  <StatPill icon={<Clock size={16} />} label="Tracked" value="2h 14m" accent="cyan" />
</div>
```
- **Card:** `bg-zinc-900/80 rounded-xl p-4` (no glassmorphism on chrome)
- **Icon:** 16px, colored by accent
- **Value:** `text-[20px] font-semibold text-zinc-100 tabular-nums`
- **Label:** `text-[11px] text-zinc-500 uppercase tracking-wider`
- **Spacing:** `gap-3` between pills
- **Hover:** `hover:bg-zinc-800/80 transition-colors duration-200`

#### WeeklyGoalsView
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `text-[13px] font-semibold text-zinc-200` + "Today's Focus"
- **Items:** Max 3 goals, each with checkbox + title + category badge
- **Empty:** "No focus goals set — add one above"

#### WeekBoard
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Grid:** 7 columns (Mon-Sun), 1fr + 36px×7
- **Day headers:** `text-[10px] text-zinc-500 uppercase`
- **Habit dots:** 8px squares, colored by category, filled if done
- **Click:** Toggle habit for that day

#### Goal Controls
- **Container:** `flex items-center justify-between py-2`
- **Left:** Date label `text-[13px] font-semibold text-zinc-200`
- **Right:** Button group with `gap-2`
- **Add Goal button:**
  ```
  bg-pink-500/15 text-pink-400 border border-pink-500/25
  hover:bg-pink-500/25 px-4 py-2 rounded-xl text-[12px] font-medium
  flex items-center gap-1.5
  ```
- **AI Parse button:**
  ```
  bg-zinc-900/60 text-zinc-400 border border-zinc-700/50
  hover:border-zinc-600 px-3 py-2 rounded-xl text-[12px]
  ```
- **Filter dropdown:** `text-[11px] text-zinc-500` — All / Work / Personal / Health / Learning / Finance / Relationships

#### Active Goals List
- **Container:** `space-y-2`
- **GoalCard:** `bg-zinc-900/80 rounded-xl p-4 border border-zinc-800/50`
- **Checkbox:** 20px square, `border-2 border-zinc-600`, fills `bg-pink-500` on done
- **Title:** `text-[13px] text-zinc-200` (line-through + `text-zinc-500` if done)
- **Meta row:** category badge + period + target type + progress
- **Hover:** `hover:border-zinc-700/60 transition-all duration-200`
- **Actions:** Edit (pencil) + Delete (trash) appear on hover, `opacity-0 group-hover:opacity-100`

#### Completed Goals Collapsible
- **Trigger:** `flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300`
- **Count:** `text-zinc-400 tabular-nums`
- **Content:** Same GoalCard styling but reduced opacity (`opacity-60`)
- **Animation:** `AnimatePresence` with `height: auto` transition, `duration: 0.25`, `ease: [0.16,1,0.3,1]`

#### AI Goal Coach
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `Sparkles` icon + "AI Goal Coach" + `text-[13px] font-semibold`
- **Button:** Full-width, `bg-violet-500/10 text-violet-400 border border-violet-500/20`
- **Proposal cards:** Colored by action type (reschedule=cyan, adjust=amber, split=violet, retire=rose, celebrate=emerald)

#### The Vault
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `TrendingUp` icon + "The Vault" + `text-[13px] font-semibold`
- **Add button:** `ml-auto p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20`
- **Goal rows:** Progress ring (38px) + title + category dot + days-left badge
- **Progress ring:** Amber stroke `#fbbf24`, zinc-800 track

#### Reflection Card
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `NotebookPen` icon + "Reflect on [date]"
- **Stats strip:** 5 tiles in grid, each with icon + label + value
- **Textarea:** Warmth-serif, lined paper background (`repeating-linear-gradient`)
- **Prompts:** Collapsible, amber-accented buttons that append text to textarea
- **Save button:** Appears only when dirty, amber accent

### 3.4 Empty States

| Feature | Empty State |
|---------|------------|
| Stat Pills | Show zeros: "Active 0", "Sealed 0", "Streak 0", "Tracked 0m" |
| WeeklyGoalsView | "No focus goals set. Add your first goal above." + pink Add button |
| WeekBoard | "No habits this week. Create a weekly goal to see it here." |
| Active Goals | "No goals for today. What's the one thing that matters?" + large pink Add button |
| Completed Goals | Collapsible hidden when count=0 |
| AI Coach | "Run AI Health Check to analyze your goals" |
| The Vault | "No long-term goals yet. Tap + to set a direction." |
| Reflection | Stats show zeros. Prompt: "Start with one thing — even small." |

### 3.5 Loading States

| Feature | Loading State |
|---------|--------------|
| Goals | 3 skeleton rows: `h-16 bg-zinc-800/50 rounded-xl animate-pulse` |
| WeekBoard | 3 skeleton rows: `h-10 bg-zinc-800/50 rounded-lg animate-pulse` |
| Vault | 2 skeleton rows with circular pulse for rings |
| Reflection | Stats tiles pulse, textarea shows shimmer |

### 3.6 Error States

| Feature | Error State |
|---------|------------|
| Goals | `bg-rose-500/5 border border-rose-500/20 rounded-xl p-6 text-center` + retry button |
| WeekBoard | Inline error banner: `text-rose-300 text-[11px]` + retry |
| Vault | Same pattern |
| Reflection | Same pattern |

---

## 4. Schedule Page Layout

### 4.1 Mental Model
*"I manage my time. I see my calendar blocks, upcoming deadlines, reminders, and todos. I add, edit, and reschedule."*

### 4.2 Visual Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SCHEDULE PAGE — "Time"                                                     │
│  Route: /warmth/schedule (LifePage schedule tab)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Page Header ─────────────────────────────────────────────────────────┐  │
│  │  [CalendarDays] This Week              [+ Add Block] [+ Add Deadline] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Two-Column Layout (lg:grid-cols-3) ─────────────────────────────────┐  │
│  │                                                                         │  │
│  │  LEFT COLUMN (lg:col-span-2)                                            │  │
│  │  ┌─ ScheduleCard (Week View) ───────────────────────────────────────┐  │  │
│  │  │  Mon        Tue        Wed        Thu        Fri        Sat/Sun  │  │
│  │  │  ━━━━━━━   ━━━━━━━   ━━━━━━━   ━━━━━━━   ━━━━━━━   ────────     │  │
│  │  │  9:00 Math 9:00 Code 9:00 Gym   9:00 Math 9:00 Code  (empty)    │  │
│  │  │  11:00 Gym  11:00 Mtg 11:00 Rd  11:00 Gym  11:00 Mtg            │  │
│  │  │  ────────  ────────  ────────  ────────  ────────               │  │
│  │  │  14:00 Rd  14:00 Rd  14:00 Rd  14:00 Rd  14:00 Rd               │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ TodoList ───────────────────────────────────────────────────────┐  │  │
│  │  │  [input: What needs to get done?]  [+ Add]                      │  │
│  │  │  □ Buy groceries                          [delete]              │  │
│  │  │  □ Review PR #342                         [delete]              │  │
│  │  │  □ Schedule dentist appointment           [delete]              │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ ScheduleSyncCard ───────────────────────────────────────────────┐  │  │
│  │  │  🔄 Last synced 2m ago · 12 blocks · 3 deadlines                  │  │
│  │  │  [Sync Now] [Auto-sync: ON]                                       │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  RIGHT COLUMN (lg:col-span-1)                                           │  │
│  │  ┌─ DeadlineRadar ──────────────────────────────────────────────────┐  │  │
│  │  │  [mini month grid with deadline dots]                             │  │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                               │  │
│  │  │  ● Project due in 3d                                              │  │
│  │  │  ● Exam in 7d                                                     │  │
│  │  │  ● Rent payment in 12d                                            │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ BellBoard (Reminders) ──────────────────────────────────────────┐  │  │
│  │  │  [input: What's happening?] [date picker] [+ Add]                 │  │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                               │  │
│  │  │  ○ Call dentist (Tomorrow)                           [done] [×]  │  │
│  │  │  ○ Submit report (in 3d)                             [done] [×]  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ DeadlinesCard ───────────────────────────────────────────────────┐  │  │
│  │  │  Upcoming Deadlines                                               │  │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                               │  │
│  │  │  [rose] Project milestone — Sep 22                                │  │
│  │  │  [rose] Final exam — Sep 28                                       │  │
│  │  │  [amber] Team meeting — Sep 20                                    │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Component Specifications

#### Page Header
- **Container:** `flex items-center justify-between mb-6`
- **Left:** `CalendarDays` icon (16px, pink-500) + `text-[15px] font-semibold text-zinc-200`
- **Right:** Button group with `gap-2`
- **Add Block button:**
  ```
  bg-pink-500/15 text-pink-400 border border-pink-500/25
  hover:bg-pink-500/25 px-4 py-2 rounded-xl text-[12px] font-medium
  flex items-center gap-1.5
  ```
- **Add Deadline button:**
  ```
  bg-rose-500/15 text-rose-400 border border-rose-500/25
  hover:bg-rose-500/25 px-4 py-2 rounded-xl text-[12px] font-medium
  flex items-center gap-1.5
  ```

#### ScheduleCard (Week View)
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Layout:** 5-column grid (Mon-Fri) + 1 column (Sat/Sun combined)
- **Day headers:** `text-[11px] text-zinc-500 uppercase tracking-wider`
- **Time blocks:** Vertical stack per day, colored left rail (4px)
- **Block styling:**
  ```
  bg-zinc-800/40 rounded-lg p-3 border-l-4
  hover:bg-zinc-800/60 transition-colors duration-200
  ```
- **Current block:** Amber border + pulsing dot + "NOW" badge
- **Block color:** Inherits from linked goal category or explicit color
- **Block content:** Title (13px semibold) + time range (11px mono) + duration + location
- **Empty day:** "Free" in `text-zinc-700 text-[12px] italic`
- **Add form:** Inline, collapsible, same styling as CriteriaBuilder

#### TodoList
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `CheckSquare` icon + "Tasks" + count badge
- **Input:** Full-width, `bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-3 py-2`
- **Add button:** Pink accent, inline with input
- **Items:** Checkbox + title + delete (hover-reveal)
- **Done items:** Strikethrough, `text-zinc-600`, moved to bottom
- **Empty:** "No tasks. Add one above to get started."

#### ScheduleSyncCard
- **Card:** `bg-zinc-900/80 rounded-xl p-4`
- **Content:** Sync status icon + last sync time + stats row
- **Actions:** "Sync Now" button + toggle for auto-sync
- **Status colors:** Green (synced), Amber (pending), Rose (error)

#### DeadlineRadar
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Month grid:** 7 columns, day numbers with colored dots beneath
- **Navigation:** Chevron arrows for month switching
- **Countdown list:** Sorted by date, rose/amber badges for urgency
- **Overdue:** Pulsing red badge

#### BellBoard
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `Bell` icon + "Reminders" + active count badge
- **Input:** Text + date picker (always visible) + quick chips (Today/Tomorrow/Next week)
- **Add button:** Amber accent
- **Items:** Left border color (amber for active, zinc for done, rose for overdue)
- **Actions:** Toggle checkbox + delete (hover-reveal)

#### DeadlinesCard
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `AlertCircle` icon + "Upcoming Deadlines"
- **Items:** Color dot + title + date + days-left badge
- **Urgency:** `<3d = rose pulse`, `<7d = amber`, `>7d = zinc`
- **Add button:** Bottom of card, rose accent

### 4.4 Empty States

| Feature | Empty State |
|---------|------------|
| ScheduleCard | "Nothing scheduled this week. Add your first time block." + large Add button |
| TodoList | "No tasks yet. What needs to get done?" |
| DeadlineRadar | "Nothing on the horizon." |
| BellBoard | "No reminders. Add one to get started." |
| DeadlinesCard | "No upcoming deadlines. You're clear!" |

### 4.5 Loading States

| Feature | Loading State |
|---------|--------------|
| ScheduleCard | 5-day skeleton grid with pulse blocks |
| TodoList | 3 skeleton rows |
| DeadlineRadar | Month grid shimmer + list skeleton |
| BellBoard | 2 skeleton reminder rows |
| DeadlinesCard | 2 skeleton deadline rows |

---

## 5. Habits Page Layout

### 5.1 Mental Model
*"I look at who I'm becoming. I see my habit streaks, my goal relationships, my life phases, and my weekly trends. This is the long view."*

### 5.2 Visual Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HABITS PAGE — "Growth"                                                     │
│  Route: /warmth/habits (LifePage habits tab)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Page Header ─────────────────────────────────────────────────────────┐  │
│  │  [TrendingUp] Habits & Growth                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ Two-Column Layout (lg:grid-cols-3) ─────────────────────────────────┐  │
│  │                                                                         │  │
│  │  LEFT COLUMN (lg:col-span-2)                                            │  │
│  │  ┌─ HabitTracker (Full Grid) ───────────────────────────────────────┐  │  │
│  │  │  [+ Add Habit]                                                     │  │
│  │  │                                                                     │  │
│  │  │  This Week    Mon  Tue  Wed  Thu  Fri  Sat  Sun  Streak           │  │
│  │  │  Meditation   ✓    ✓    ○    ✓    ○    ○    ○    🔥 2d           │  │
│  │  │  Exercise     ✓    ✓    ✓    ✓    ○    ○    ○    🔥 4d           │  │
│  │  │  Read 30min   ✓    ✓    ✓    ○    ○    ○    ○    🔥 3d           │  │
│  │  │  Code 1hr     ○    ✓    ✓    ✓    ○    ○    ○    🔥 3d           │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ WeekReview ──────────────────────────────────────────────────────┐  │  │
│  │  │  This week, at a glance                                            │  │
│  │  │  Mon ████████ 4h 2 goals 🔥                                       │  │
│  │  │  Tue ██████ 3h 1 goal  🔥                                         │  │
│  │  │  Wed ██████████ 5h 3 goals 🔥                                     │  │
│  │  │  ...                                                               │  │
│  │  │  Avg 4h/day · 12 goals sealed · 8 habits kept · 🔥 4d streak      │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ Goal Hierarchy ──────────────────────────────────────────────────┐  │  │
│  │  │  [Tree view: Long-term goals → Weekly goals → Daily goals]        │  │
│  │  │  Become senior engineer                                           │  │
│  │  │  ├── Complete system design course                                │  │
│  │  │  ├── Read 2 technical books/month                                 │  │
│  │  │  └── Practice LeetCode 3x/week                                    │  │
│  │  │                                                                     │  │
│  │  │  Save $10k                                                        │  │
│  │  │  ├── Track expenses daily                                         │  │
│  │  │  └── Cook at home 5x/week                                         │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ ConnectionExplorer ──────────────────────────────────────────────┐  │  │
│  │  │  [Network graph: goals connected by category, parent, schedule]   │  │
│  │  │  Interactive nodes, zoomable, filterable by category              │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  RIGHT COLUMN (lg:col-span-1)                                           │  │
│  │  ┌─ LifeRiver ───────────────────────────────────────────────────────┐  │  │
│  │  │  [River of years visualization]                                   │  │
│  │  │  Childhood → School → University → Career → ...                   │  │
│  │  │  Clickable phases with goals attached                             │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  ┌─ Habit Stats ─────────────────────────────────────────────────────┐  │  │
│  │  │  Consistency Score: 78%                                           │  │
│  │  │  [Progress bar]                                                   │  │
│  │  │  Best streak: 12 days (Exercise)                                  │  │
│  │  │  Weakest habit: Meditation (54%)                                  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Component Specifications

#### Page Header
- **Container:** `mb-6`
- **Content:** `TrendingUp` icon (16px, emerald-400) + `text-[15px] font-semibold text-zinc-200`
- **Subtitle:** `text-[12px] text-zinc-500` — "Track habits, explore goals, see your growth"

#### HabitTracker (Full Grid)
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `Flame` icon + "Weekly Habits" + `+ Add Habit` button (emerald accent)
- **Grid:** 8 columns (habit name + Mon-Sun + streak)
- **Day cells:** 36px square buttons, rounded-lg
  - Done: `bg-emerald-500/20 border-emerald-500/40 text-emerald-400`
  - Today (not done): `bg-zinc-800/60 border-zinc-600/50 text-zinc-400 hover:border-zinc-500`
  - Other days (not done): `bg-zinc-900/30 border-zinc-800/40 text-zinc-600`
- **Streak column:** Flame icon + count, amber color
- **Toggle:** `whileTap={{ scale: 0.85 }}`
- **Category colors:** Each habit row has a subtle left border in its category color

#### WeekReview
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `TrendingUp` icon + "This week, at a glance" + warmth-serif italic subtitle
- **Bars:** One per day (Mon-Sun), height = productive time, max = week's max
  - Bar: `h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400`
  - Track: `h-2 rounded-full bg-zinc-800/60`
- **Day row:** DOW label + date + bar + time + goal count + covenant flame
- **Footer:** Avg/day, total goals, total habits, streak — `text-[11px] text-zinc-500`

#### Goal Hierarchy (HierarchyTree)
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `GitBranch` icon + "Goal Hierarchy"
- **Tree:** Collapsible nodes, indent levels
- **Node styling:**
  - Long-term: `text-[13px] font-semibold text-zinc-200`
  - Weekly: `text-[12px] text-zinc-300 ml-4`
  - Daily: `text-[11px] text-zinc-400 ml-8`
- **Expand/collapse:** Chevron icon, rotates 90°
- **Connection lines:** `border-l border-zinc-800/50` vertical, `border-t` horizontal
- **Category dots:** 6px circle before each node

#### ConnectionExplorer
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `Network` icon + "Connections"
- **View:** Force-directed graph or radial layout
- **Nodes:** Goals as circles, sized by importance, colored by category
- **Edges:** Lines connecting parent→child, goal→schedule, goal→deadline
- **Interactivity:** Hover to highlight connections, click to navigate to goal
- **Filters:** Category toggles, connection type toggles
- **Empty:** "No connections yet. Link goals to schedules or long-term goals to see the network."

#### LifeRiver
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Header:** `Waves` icon + "River of Years"
- **Visualization:** Horizontal river flow, phases as segments
- **Phases:** Childhood, School, University, Career, etc.
- **Goals:** Attached to phases as floating markers
- **Interactivity:** Click phase to see attached goals, hover for details
- **Styling:** Subtle gradient backgrounds per phase, no decorative glow

#### Habit Stats (Sidebar)
- **Card:** `bg-zinc-900/80 rounded-xl p-5`
- **Consistency Score:** Large number + progress bar
  - Score: `text-[28px] font-semibold text-emerald-400 tabular-nums`
  - Bar: `h-2 rounded-full bg-zinc-800`, fill `bg-emerald-500`
- **Best streak:** Flame icon + habit name + count
- **Weakest habit:** Warning icon + habit name + percentage
- **Insights:** `text-[11px] text-zinc-500` tips based on data

### 5.4 Empty States

| Feature | Empty State |
|---------|------------|
| HabitTracker | "No habits tracked yet. Add your first habit to build consistency." + emerald Add button |
| WeekReview | "No data for this week yet. Complete some goals to see your recap." |
| HierarchyTree | "No goal hierarchy yet. Link daily goals to long-term goals in The Vault." |
| ConnectionExplorer | "No connections yet. Link goals to see the network." |
| LifeRiver | "No life phases defined yet. Add phases and attach goals to build your river." |

### 5.5 Loading States

| Feature | Loading State |
|---------|--------------|
| HabitTracker | Grid skeleton: 4 rows × 8 columns of pulsing squares |
| WeekReview | 7 skeleton bar rows |
| HierarchyTree | Nested skeleton lines with circular pulses |
| ConnectionExplorer | Central pulse node with radiating lines |
| LifeRiver | River shape shimmer |

---

## 6. Navigation Structure

### 6.1 Tab Bar (within LifePage)

```tsx
<div className="flex items-center gap-1 mb-6 border-b border-zinc-800/50 pb-1">
  <TabButton
    active={activeTab === 'gold'}
    onClick={() => setActiveTab('gold')}
    icon={<Target size={14} />}
    label="Gold"
    description="Today's goals"
  />
  <TabButton
    active={activeTab === 'schedule'}
    onClick={() => setActiveTab('schedule')}
    icon={<CalendarDays size={14} />}
    label="Schedule"
    description="Time & deadlines"
  />
  <TabButton
    active={activeTab === 'habits'}
    onClick={() => setActiveTab('habits')}
    icon={<TrendingUp size={14} />}
    label="Habits"
    description="Growth & insights"
  />
</div>
```

**TabButton styling:**
```
flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-[12px] font-medium
border-b-2 transition-all duration-200

Active:
  text-pink-400 border-pink-500 bg-pink-500/5
Inactive:
  text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/40
```

### 6.2 Tab Content

```tsx
<AnimatePresence mode="wait">
  {activeTab === 'gold' && (
    <motion.div key="gold" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}>
      <GoldPage />
    </motion.div>
  )}
  {activeTab === 'schedule' && (
    <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}>
      <SchedulePage />
    </motion.div>
  )}
  {activeTab === 'habits' && (
    <motion.div key="habits" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}>
      <HabitsPage />
    </motion.div>
  )}
</AnimatePresence>
```

### 6.3 URL Routing

| Tab | Route | Persistence |
|-----|-------|-------------|
| Gold | `/warmth?tab=gold` | `localStorage.setItem('warmth_active_tab', 'gold')` |
| Schedule | `/warmth?tab=schedule` | `localStorage.setItem('warmth_active_tab', 'schedule')` |
| Habits | `/warmth?tab=habits` | `localStorage.setItem('warmth_active_tab', 'habits')` |

On mount, read `localStorage` and default to 'gold'. Update URL query param on tab change.

### 6.4 Cross-Page Navigation

From **Gold** → **Schedule**:
- Clicking a goal's "Scheduled" badge navigates to Schedule tab + highlights the block
- Clicking "View in Schedule" on a deadline reminder navigates to Schedule tab

From **Schedule** → **Gold**:
- Clicking a schedule block's linked goal navigates to Gold tab + that goal's date
- Clicking a deadline's related goal navigates to Gold tab

From **Habits** → **Gold**:
- Clicking a habit in the grid navigates to Gold tab + that habit's date
- Clicking a hierarchy node navigates to Gold tab + that goal

---

## 7. State Management

### 7.1 Per-Page State

Each page manages its own local state. No global state manager needed (all features are frontend-only).

**GoldPage state:**
```ts
const [selectedDate, setSelectedDate] = useState(todayStr());
const [goals, setGoals] = useState<Goal[]>([]);
const [weekGoals, setWeekGoals] = useState<Record<string, Goal[]>>({});
const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
const [reminders, setReminders] = useState<Reminder[]>([]);
const [reviewSummary, setReviewSummary] = useState('');
const [reflection, setReflection] = useState<DailyReflection>(emptyReflection);
const [isAdding, setIsAdding] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);
const [showCompleted, setShowCompleted] = useState(false);
const [showLangParser, setShowLangParser] = useState(false);
const [side, setSide] = useState<CalendarSide>('right'); // CalendarSidebar
```

**SchedulePage state:**
```ts
const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
const [deadlines, setDeadlines] = useState<Deadline[]>([]);
const [reminders, setReminders] = useState<Reminder[]>([]);
const [todos, setTodos] = useState<Todo[]>([]);
const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
const [isAddingBlock, setIsAddingBlock] = useState(false);
const [isAddingDeadline, setIsAddingDeadline] = useState(false);
const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
```

**HabitsPage state:**
```ts
const [habits, setHabits] = useState<Habit[]>([]);
const [weekReflections, setWeekReflections] = useState<Record<string, DailyReflection>>({});
const [hierarchyData, setHierarchyData] = useState<HierarchyNode[]>([]);
const [connectionData, setConnectionData] = useState<ConnectionGraph>({ nodes: [], edges: [] });
const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
const [isAddingHabit, setIsAddingHabit] = useState(false);
```

### 7.2 Shared Data

Data that crosses page boundaries is fetched independently per page. No shared cache needed (localStorage is the source of truth).

| Data | Used By | Fetch Strategy |
|------|---------|---------------|
| Goals | Gold, Habits | Fetch on mount + on date change |
| Schedule | Schedule | Fetch on mount + on week change |
| Deadlines | Schedule | Fetch on mount |
| Reminders | Gold, Schedule | Fetch on mount |
| Long-term goals | Gold, Habits | Fetch on mount |
| Habits | Habits | Fetch on mount + on week change |

### 7.3 CalendarSidebar Persistence

The CalendarSidebar's side preference is stored via `window.deskflowAPI`:

```ts
// Read on mount
const prefs = await window.deskflowAPI.getPreferences();
const savedSide = prefs?.['gold_calendar_side']?.side ?? 'right';
setSide(savedSide);

// Write on toggle
await window.deskflowAPI.setPreference('gold_calendar_side', {
  schemaVersion: 1,
  side: newSide
});
```

This persists across page refreshes and tab switches.

### 7.4 Tab Persistence

Active tab is stored in `localStorage`:

```ts
const [activeTab, setActiveTab] = useState(() => {
  const saved = localStorage.getItem('warmth_active_tab');
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  return urlTab || saved || 'gold';
});

useEffect(() => {
  localStorage.setItem('warmth_active_tab', activeTab);
  const url = new URL(window.location.href);
  url.searchParams.set('tab', activeTab);
  window.history.replaceState({}, '', url);
}, [activeTab]);
```

---

## 8. Responsive Behavior

### 8.1 Desktop (≥1024px)

- **Gold:** Two-column layout (2/3 goals, 1/3 sidebar). CalendarSidebar on left or right.
- **Schedule:** Two-column layout (2/3 schedule+todos, 1/3 radar+reminders+deadlines).
- **Habits:** Two-column layout (2/3 habits+review+hierarchy, 1/3 river+stats).
- **CalendarSidebar:** Full 3D entrance, 520ms turn, 600ms lock.

### 8.2 Tablet (768–1023px)

- **All pages:** Single column, full width.
- **Gold:** CalendarSidebar stacks above content. Stat pills in 2×2 grid.
- **Schedule:** ScheduleCard shows 3 days (Mon-Wed) with horizontal scroll for Thu-Sun.
- **Habits:** HabitTracker shows Mon-Sun in scrollable horizontal container.

### 8.3 Mobile (<768px)

- **All pages:** Single column, `px-4` padding.
- **Gold:**
  - Stat pills: 2×2 grid
  - CalendarSidebar: Hidden or collapsed to a button that opens a drawer
  - Goal cards: Full width, reduced metadata
  - Add buttons: Sticky bottom bar with primary action
- **Schedule:**
  - ScheduleCard: Single day view (today) with day selector tabs
  - TodoList: Full width
  - Sidebar cards: Stack vertically
- **Habits:**
  - HabitTracker: Horizontal scroll for days, habit names truncated
  - WeekReview: Bars only (no day details)
  - HierarchyTree: Single level visible, tap to expand
  - ConnectionExplorer: Simplified list view instead of graph

### 8.4 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- CalendarSidebar 3D entrance: Skip turn animation, show immediately
- AnimatePresence transitions: Instant swap
- NumberTicker: Show final value immediately
- Confetti: Disable entirely
- BorderBeam: Static border color

---

## 9. Action Buttons — Visibility Requirements

Every primary action must be visible within 1 second of page load. No hunting.

### Gold Page
| Action | Location | Visibility |
|--------|----------|------------|
| Add Goal | Top-right of goal list, pink button | Always visible |
| AI Parse | Next to Add Goal, violet button | Always visible |
| Toggle Goal | Left side of each goal card | Always visible |
| Edit Goal | Hover-reveal on goal card | On hover |
| Delete Goal | Hover-reveal on goal card | On hover |
| Add to Vault | Top-right of Vault card | Always visible |
| Write Reflection | Textarea, always present | Always visible |
| Run AI Coach | Full-width button in AI card | Always visible |

### Schedule Page
| Action | Location | Visibility |
|--------|----------|------------|
| Add Block | Top-right of page header | Always visible |
| Add Deadline | Top-right of page header | Always visible |
| Add Todo | Inline with todo input | Always visible |
| Add Reminder | Inline with reminder input | Always visible |
| Toggle Todo | Left side of todo item | Always visible |
| Delete Todo | Right side of todo item | On hover |
| Sync Schedule | In ScheduleSyncCard | Always visible |

### Habits Page
| Action | Location | Visibility |
|--------|----------|------------|
| Add Habit | Top-right of HabitTracker | Always visible |
| Toggle Habit | Day cell in grid | Always visible |
| Expand Hierarchy | Chevron on tree node | Always visible |
| Filter Connections | Button group above graph | Always visible |

---

## 10. Implementation Order

### Phase 1: Extract Schedule Features (2–3 hours)
1. Create `src/features/warmth/schedule/SchedulePage.tsx`
2. Move `ScheduleCard`, `ScheduleSyncCard`, `DeadlinesCard` from GoldPage
3. Move `TodoList` from GoldPage
4. Move `BellBoard` and `DeadlineRadar` from GoldPage
5. Wire up local state and handlers in SchedulePage
6. Add SchedulePage to LifePage tabs

### Phase 2: Extract Habits Features (2–3 hours)
1. Create `src/features/warmth/habits/HabitsPage.tsx`
2. Move `HabitTracker` from GoldPage
3. Move `HierarchyTree` and `ConnectionExplorer` from GoldPage
4. Move `WeekReview` and `LifeRiver` from GoldPage
5. Wire up local state and handlers in HabitsPage
6. Add HabitsPage to LifePage tabs

### Phase 3: Clean GoldPage (1–2 hours)
1. Remove all moved features from GoldPage.tsx
2. Remove unused imports
3. Verify GoldPage renders correctly with remaining features
4. Ensure CalendarSidebar still works (constraint)
5. Ensure 3D entrance still works (constraint)
6. Ensure preference persistence still works (constraint)

### Phase 4: Navigation & Polish (1–2 hours)
1. Implement tab bar in LifePage
2. Add URL query param sync
3. Add localStorage persistence
4. Test cross-page navigation (goal → schedule, etc.)
5. Verify all empty/loading/error states
6. Test responsive layouts
7. Test prefers-reduced-motion

### Phase 5: Verification (30 min)
1. GoldPage < 800 lines
2. SchedulePage < 600 lines
3. HabitsPage < 600 lines
4. All action buttons visible
5. No console errors
6. All features functional

---

## 11. Verification Checklist

### Architecture
- [ ] GoldPage.tsx < 800 lines
- [ ] SchedulePage.tsx exists and < 600 lines
- [ ] HabitsPage.tsx exists and < 600 lines
- [ ] CalendarSidebar remains in GoldPage
- [ ] MonthWall remains frozen in CalendarSidebar
- [ ] 3D entrance choreography works (80ms → 520ms → 600ms)
- [ ] Preference store persists side toggle without refresh
- [ ] No features lost (all 15 features accessible somewhere)

### Navigation
- [ ] Three tabs visible in LifePage: Gold, Schedule, Habits
- [ ] Tab switch animates with crossfade (0.2s, cubic-bezier(0.16,1,0.3,1))
- [ ] Active tab persisted in localStorage
- [ ] URL query param updates on tab change
- [ ] Deep linking works (`/warmth?tab=schedule` loads Schedule)

### Gold Page
- [ ] Stat Pills visible at top
- [ ] WeeklyGoalsView visible
- [ ] WeekBoard visible
- [ ] Add Goal button clearly visible (pink, top-right)
- [ ] AI Parse button visible next to Add Goal
- [ ] Active Goals list renders with checkboxes
- [ ] Completed Goals collapsible works
- [ ] MissedGoalRecoveryBanner appears when applicable
- [ ] AI Goal Coach renders with Run button
- [ ] TheVault renders with progress rings
- [ ] ReflectionCard renders with stats and textarea
- [ ] All empty states render correctly
- [ ] All loading states render correctly
- [ ] All error states render correctly

### Schedule Page
- [ ] ScheduleCard renders week view (Mon-Sun)
- [ ] Add Block button visible in header
- [ ] Add Deadline button visible in header
- [ ] TodoList renders with input and add button
- [ ] ScheduleSyncCard renders with sync status
- [ ] DeadlineRadar renders month grid + countdown
- [ ] BellBoard renders reminders with add input
- [ ] DeadlinesCard renders upcoming deadlines
- [ ] All empty states render correctly
- [ ] All loading states render correctly
- [ ] All error states render correctly

### Habits Page
- [ ] HabitTracker renders full week grid
- [ ] Add Habit button visible
- [ ] WeekReview renders 7-day bars
- [ ] HierarchyTree renders collapsible nodes
- [ ] ConnectionExplorer renders network/graph
- [ ] LifeRiver renders phase visualization
- [ ] Habit Stats sidebar renders score + streaks
- [ ] All empty states render correctly
- [ ] All loading states render correctly
- [ ] All error states render correctly

### Responsive
- [ ] Desktop: Two-column layouts work
- [ ] Tablet: Single column, no overflow
- [ ] Mobile: Single column, touch-friendly targets (min 44px)
- [ ] prefers-reduced-motion: All animations disabled

### Design Tokens
- [ ] zinc-950 base background
- [ ] zinc-900/80 elevated cards
- [ ] pink-500 accent for primary actions
- [ ] rounded-xl on all cards
- [ ] p-5 padding on all cards
- [ ] Inter + JetBrains Mono fonts only
- [ ] No glassmorphism on chrome
- [ ] No decorative glow/gradients
- [ ] cubic-bezier(0.16,1,0.3,1) on all transitions

---

*End of specification. Ready for implementation.*

 # Lyceum Learn Stats & Motivation Overhaul — Design Specification

---

## 1. Data Model

### New Tables

```sql
-- Goals system
CREATE TABLE learn_goals (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL CHECK(type IN ('daily','weekly','custom')),
  metric TEXT NOT NULL CHECK(metric IN ('study_minutes','cards_reviewed','nodes_completed','lessons_completed','quizzes_passed','mastery_points')),
  target INTEGER NOT NULL,
  current INTEGER NOT NULL DEFAULT 0,
  period_start TEXT NOT NULL,  -- ISO date, e.g. "2026-07-29"
  period_end TEXT,             -- NULL for ongoing daily/weekly
  deadline TEXT,               -- for custom goals
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learn_goals_period ON learn_goals(period_start, type);

-- Streak tracking (separate from goals for reliability)
CREATE TABLE learn_streaks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,        -- "2026-07-29"
  streak_freezes INTEGER NOT NULL DEFAULT 0, -- loss aversion mechanic
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Achievements / badges
CREATE TABLE learn_achievements (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL DEFAULT 1,
  badge_key TEXT NOT NULL,     -- e.g. "first_card", "streak_7", "master_10"
  earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  viewed_at TEXT               -- NULL until user sees it (for "new" dot)
);

-- Per-lesson analytics (materialized for performance)
CREATE TABLE learn_lesson_stats (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL,
  total_study_seconds INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  quizzes_taken INTEGER NOT NULL DEFAULT 0,
  quizzes_correct INTEGER NOT NULL DEFAULT 0,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  cards_created INTEGER NOT NULL DEFAULT 0,
  mastery_gained REAL NOT NULL DEFAULT 0,
  last_studied_at TEXT,
  first_studied_at TEXT,
  UNIQUE(lesson_id)
);

-- Timer event queue (offline resilience)
CREATE TABLE learn_timer_queue (
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL CHECK(event_type IN ('start','pause','resume','stop')),
  lesson_id INTEGER,
  timestamp TEXT NOT NULL,
  duration_delta INTEGER,      -- seconds accumulated at this event
  synced INTEGER NOT NULL DEFAULT 0
);

-- Velocity snapshots (computed nightly or on-demand, cached)
CREATE TABLE learn_velocity (
  id INTEGER PRIMARY KEY,
  computed_at TEXT NOT NULL,
  cards_per_day REAL,
  nodes_per_week REAL,
  mastery_per_week REAL,
  avg_session_minutes REAL,
  study_days_per_week REAL
);
```

### Modified Existing Tables

```sql
-- Add lesson linkage to sessions
ALTER TABLE learn_sessions ADD COLUMN lesson_id INTEGER;
ALTER TABLE learn_sessions ADD COLUMN paused_seconds INTEGER DEFAULT 0; -- time spent paused
ALTER TABLE learn_sessions ADD COLUMN focus_mode INTEGER DEFAULT 0; -- pomodoro flag

-- Add confidence computation source
ALTER TABLE learn_progress ADD COLUMN confidence_history TEXT DEFAULT '[]'; -- JSON array of {date, belief}
```

---

## 2. Component Architecture

```
src/
├── components/
│   └── learn/
│       ├── stats/
│       │   ├── StudyTimer.tsx              # Core floating timer pill
│       │   ├── PomodoroTimer.tsx           # 25/5 cycle overlay
│       │   ├── GoalCard.tsx                # Individual goal ring
│       │   ├── GoalDashboard.tsx           # Grid of goals
│       │   ├── StreakCounter.tsx           # Fire + number
│       │   ├── AchievementBadge.tsx        # Single badge display
│       │   ├── AchievementGallery.tsx      # Grid of all badges
│       │   ├── VelocityCard.tsx            # Cards/day, nodes/week
│       │   ├── SessionHistoryList.tsx      # Past sessions log
│       │   ├── SessionHistoryItem.tsx      # Single session row
│       │   ├── PerLessonStats.tsx          # Stats overlay for lesson
│       │   ├── EncouragementToast.tsx      # Context-aware nudge
│       │   └── ComparisonBar.tsx           # This week vs last week
│       ├── analytics/
│       │   ├── AnalyticsDashboard.tsx      # Main analytics page
│       │   ├── OverviewCards.tsx           # 4 top stat cards
│       │   ├── StudyHeatmapEnhanced.tsx    # Heatmap + tooltips
│       │   ├── TimeDistributionChart.tsx   # Bar chart by day
│       │   ├── MasteryProgressionChart.tsx # Line chart over time
│       │   ├── PerLessonTable.tsx          # Sortable lesson grid
│       │   └── AITutorStats.tsx            # Questions/confidence
│       └── study/
│           └── StudyTimerOverlay.tsx       # Timer integrated into StudyView
├── hooks/
│   ├── useStudyTimer.ts                    # Core timer logic + auto-pause
│   ├── useGoals.ts                         # Fetch + mutate goals
│   ├── useStreak.ts                        # Streak data
│   ├── useAchievements.ts                  # Badge data
│   ├── useVelocity.ts                      # Computed velocity
│   └── useLessonStats.ts                   # Per-lesson analytics
├── services/
│   ├── TimerService.ts                     # Start/stop/pause + queue
│   ├── GoalService.ts                      # CRUD goals
│   ├── StreakService.ts                    # Streak computation
│   ├── AchievementService.ts               # Badge evaluation
│   ├── AnalyticsService.ts                 # Aggregate queries
│   └── VelocityService.ts                  # Trend calculations
└── ipc/
    └── handlers/
        ├── learnTimer.ts
        ├── learnGoals.ts
        ├── learnStreaks.ts
        ├── learnAchievements.ts
        ├── learnAnalytics.ts
        └── learnVelocity.ts
```

### Component Hierarchy

```
AnalyticsDashboard (page)
├── OverviewCards
│   ├── StatCard (total time)
│   ├── StatCard (cards reviewed)
│   ├── StatCard (nodes mastered)
│   └── StatCard (current streak)
├── GoalDashboard
│   └── GoalCard × N
├── StudyHeatmapEnhanced
├── TimeDistributionChart (recharts)
├── MasteryProgressionChart (recharts)
├── VelocityCard
├── PerLessonTable
├── AITutorStats
│   ├── QuestionCount
│   └── ConfidenceTrend
└── AchievementGallery
    └── AchievementBadge × N

StudyView (existing, enhanced)
├── StudyTimerOverlay
│   ├── StudyTimer (pill)
│   └── PomodoroTimer (modal overlay)
└── PerLessonStats (slide-in panel)
```

---

## 3. IPC Endpoints

### Timer
| Endpoint | Payload | Returns |
|---|---|---|
| `learnTimerStart` | `{ lessonId: number }` | `{ sessionId: number, startedAt: string }` |
| `learnTimerPause` | `{ sessionId: number, reason: 'user' \| 'blur' }` | `{ pausedAt: string }` |
| `learnTimerResume` | `{ sessionId: number }` | `{ resumedAt: string }` |
| `learnTimerStop` | `{ sessionId: number, nodesSeen: number[], quizzesTaken: number, cardsReviewed: number, masteryGained: number }` | `{ duration: number, sessionLogged: boolean }` |
| `learnTimerGetState` | `{}` | `{ activeSession: SessionState \| null }` |

### Goals
| Endpoint | Payload | Returns |
|---|---|---|
| `learnGetGoals` | `{ type?: 'daily' \| 'weekly' \| 'custom', date?: string }` | `Goal[]` |
| `learnSetGoal` | `{ type, metric, target, periodStart, periodEnd?, deadline? }` | `Goal` |
| `learnUpdateGoalProgress` | `{ goalId: number, delta: number }` | `Goal` |
| `learnGetGoalSuggestions` | `{}` | `Suggestion[]` |

### Streaks
| Endpoint | Payload | Returns |
|---|---|---|
| `learnGetStreak` | `{}` | `{ current: number, longest: number, lastStudyDate: string, freezes: number }` |
| `learnCheckStreak` | `{ date: string }` | `{ extended: boolean, broken: boolean }` |

### Achievements
| Endpoint | Payload | Returns |
|---|---|---|
| `learnGetAchievements` | `{ viewed?: boolean }` | `Achievement[]` |
| `learnCheckAchievements` | `{ trigger: string, metadata?: object }` | `NewAchievement[]` |
| `learnMarkAchievementViewed` | `{ badgeKey: string }` | `boolean` |

### Analytics
| Endpoint | Payload | Returns |
|---|---|---|
| `learnGetAnalytics` | `{ period: 'week' \| 'month' \| 'year' }` | `AnalyticsBundle` |
| `learnGetLessonStats` | `{ lessonId: number }` | `LessonStats` |
| `learnGetSessionHistory` | `{ limit?: number, offset?: number, lessonId?: number }` | `Session[]` |
| `learnGetVelocity` | `{}` | `VelocityMetrics` |

### Offline Sync
| Endpoint | Payload | Returns |
|---|---|---|
| `learnSyncTimerQueue` | `{ events: TimerEvent[] }` | `{ processed: number, conflicts: number }` |

---

## 4. UI Specifications

### A. Study Timer (Core Infrastructure)

**`StudyTimer.tsx`** — Floating pill in StudyView header.

```
Position: fixed, top-right of StudyView header
Size: h-8, rounded-full
States:
  - Idle:     bg-bg-secondary, text-muted, "Start Studying"
  - Running:  bg-accent-primary/20, text-amber, animated pulse
  - Paused:   bg-clay/20, text-clay, "Paused"
  - Break:    bg-sage/20, text-sage, "Break 04:59"

Content:
  [PlayIcon] 00:42:15 [PauseIcon]
  
Click behavior:
  - Click timer → toggle pause/resume
  - Right-click/long-press → open Pomodoro menu

Animation:
  - Entry: scale(0.8) → scale(1), spring(stiffness: 300, damping: 20)
  - Pulse on running: opacity 0.8 → 1.0, 2s ease-in-out infinite
```

**Auto-pause logic (`useStudyTimer.ts`)**:
```typescript
useEffect(() => {
  const handleBlur = () => {
    if (timerState === 'running') {
      ipc.learnTimerPause({ sessionId, reason: 'blur' });
      setTimerState('paused');
      setPauseReason('You stepped away — timer paused');
    }
  };
  const handleFocus = () => {
    if (timerState === 'paused' && pauseReason === 'blur') {
      ipc.learnTimerResume({ sessionId });
      setTimerState('running');
      setPauseReason(null);
    }
  };
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  return () => { window.removeEventListener('blur', handleBlur); window.removeEventListener('focus', handleFocus); };
}, [timerState]);
```

**Pomodoro overlay** (`PomodoroTimer.tsx`):
```
Trigger: User selects "Focus Mode" from timer menu

Visual:
  - Full-screen semi-transparent overlay (bg-black/40 backdrop-blur-sm)
  - Centered circular progress ring
  - 25:00 countdown with large mono font
  - Below: "Focus on your lesson. Break in 25 min."
  - Progress ring: 300px diameter, stroke-amber, animated with framer-motion

Transitions:
  - Work → Break: ring color shifts amber → sage, gentle chime
  - Break → Work: sage → amber, soft pulse notification

Controls:
  - [Skip Break] [End Session] buttons at bottom
```

---

### B. Goal System

**`GoalCard.tsx`** — Progress ring card.

```
Layout: w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]
Card: glass-card (bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5)

Structure:
  ┌─────────────────────────────┐
  │  [Ring]  Title              │
  │  18/30 min        60%       │
  │  ───────────────            │
  │  "Study 30 min today"       │
  │  [ +5 ] [Complete]          │
  └─────────────────────────────┘

Ring specs:
  - Size: 56px
  - Stroke: 6px
  - Track: bg-white/10
  - Fill: 
      • study_minutes → amber
      • cards_reviewed → sky
      • nodes_completed → sage
      • lessons_completed → clay
  - Animation: stroke-dashoffset, 0.8s ease-out, triggered on mount

Smart suggestion chip:
  Position: below goal card, when suggestion exists
  Style: text-xs, bg-accent-primary/10, text-amber, rounded-full px-3 py-1
  Text: "Based on your pace, you could master 3 nodes this week →"
```

**`GoalDashboard.tsx`**:
```
Layout: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
Sections:
  1. Daily goals (always visible)
  2. Weekly goals (collapsible, default open)
  3. Custom goals (collapsible, default closed)

Empty state:
  "No goals set. Let's fix that."
  [Set a daily goal] CTA button
```

---

### C. Analytics Dashboard

**`AnalyticsDashboard.tsx`** — New route `/learn/analytics`.

```
Layout:
  ┌──────────────────────────────────────────────┐
  │  📊 Analytics                    [Period ▼]  │
  ├──────────────────────────────────────────────┤
  │  [Total Time] [Cards] [Nodes] [Streak]       │
  ├──────────────────────────────────────────────┤
  │  🔥 Streak Counter    │  Goals Progress     │
  ├──────────────────────────────────────────────┤
  │  📅 Study Heatmap (full width)               │
  ├──────────────────────────────────────────────┤
  │  ⏱ Time Distribution   │  📈 Mastery Trend   │
  ├──────────────────────────────────────────────┤
  │  🚀 Learning Velocity  │  🤖 AI Tutor Stats  │
  ├──────────────────────────────────────────────┤
  │  📚 Per-Lesson Breakdown (table)             │
  ├──────────────────────────────────────────────┤
  │  🏆 Achievements                             │
  └──────────────────────────────────────────────┘
```

**Overview Cards** (`OverviewCards.tsx`):
```
4 cards in a row, gap-4
Each card:
  - Icon (lucide) in top-left, colored by metric
  - Large number (font-serif, text-3xl, text-white)
  - Label (font-mono, text-xs, uppercase tracking-wider, text-white/50)
  - Trend indicator: "+12% vs last week" in sage or "-5%" in clay
  - Sparkline (mini line chart, 60px wide) showing last 7 data points

Card colors:
  - Total Time: amber icon, sparkline amber
  - Cards: sky icon, sparkline sky
  - Nodes: sage icon, sparkline sage
  - Streak: clay icon, sparkline clay
```

**Study Heatmap Enhanced** (`StudyHeatmapEnhanced.tsx`):
```
Builds on existing HeatmapBlock
Enhancements:
  - Tooltip on hover: "Jul 29: 45 min studying, 3 nodes, 12 cards"
  - Click cell → opens day detail modal with session list
  - Color scale: 0 = bg-white/5, 1-30min = amber/20, 30-60 = amber/40, 60+ = amber/60
  - Legend below: "Less ← → More"
```

**Time Distribution Chart** (`TimeDistributionChart.tsx`):
```
Library: recharts
Type: BarChart
Data: 7 days, minutes studied each day
X-axis: Mon, Tue, Wed... (font-mono, text-xs, text-white/50)
Y-axis: hidden
Bars: rounded-t-md, fill=amber, hover fill=amber/80
Active bar: stroke=white, strokeWidth=2
Empty day: bg-white/5 placeholder bar (height=4px) so grid stays aligned

Tooltip:
  Custom glass tooltip
  "Tuesday, Jul 29"
  "45 minutes"
  "2 sessions"
```

**Mastery Progression Chart** (`MasteryProgressionChart.tsx`):
```
Library: recharts
Type: AreaChart
Data: Array of { date, level1, level2, level3, level4, level5 }
Stacked areas with opacity 0.6
Colors per level:
  level1: white/20
  level2: clay/40
  level3: amber/50
  level4: sage/60
  level5: sky/70

X-axis: weekly ticks
Y-axis: node count
Legend: bottom, horizontal, small dots
```

**Per-Lesson Table** (`PerLessonTable.tsx`):
```
Table headers: Lesson | Time | Quizzes | Mastery | Cards | Last Studied
Row styling:
  - hover:bg-white/5
  - border-b border-white/5
  - Last studied: relative time ("2 days ago")

Sortable columns with chevron indicators
Filter: search input, "Show only in progress" toggle

Row click: navigates to lesson with stats panel open
```

**AI Tutor Stats** (`AITutorStats.tsx`):
```
Two mini-cards side by side:

[Questions Asked]
  Number: large serif
  Trend: sparkline of questions per day
  "You asked 12 questions this week"

[Confidence Trend]
  Number: avg confidence % (computed from belief data, no longer hardcoded)
  Mini line chart: confidence over last 30 days
  "↑ 0.05 from last month"
```

---

### D. Motivation Features

**`StreakCounter.tsx`**:
```
Layout: centered, py-8
Visual:
  [FireIcon] 12 [FireIcon]
  "day streak"
  
Fire animation:
  - CSS keyframes: scale 1 → 1.1 → 1, rotate -2deg → 2deg → -2deg
  - Duration: 0.6s, infinite when streak > 0
  - Color: gradient from amber-400 to clay-500

Messaging:
  - Streak < 3: "Keep going! Build that habit."
  - Streak 3-6: "Don't break the chain! 🔥"
  - Streak 7+: "You're on fire! {streak} days strong."
  - Streak about to break (no study today, >20h since last): 
    "Study 5 minutes to keep your streak alive!"

Streak freeze indicator:
  - Small shield icon if freezes > 0
  - Tooltip: "1 streak freeze available"
```

**`AchievementBadge.tsx`**:
```
Size: 80px × 80px badge
States:
  - Earned: full color, subtle glow, checkmark corner
  - Locked: grayscale/30%, lock icon, title visible, description hidden

Hover (earned):
  - Scale 1.1, spring
  - Tooltip: badge name, description, earned date
  - "Earned Jul 15, 2026"

Badge categories:
  - 🌱 Starter: "First Steps", "First Card", "First Quiz"
  - 🔥 Streak: "Week Warrior", "Month Master", "Unstoppable"
  - 📚 Volume: "100 Cards", "500 Cards", "1000 Cards"
  - 🎯 Mastery: "Node Novice", "Knowledge Keeper", "Sage Scholar"
  - 🤖 AI: "Curious Mind", "Deep Diver", "Socratic Student"

New badge animation:
  - On earn: fly-in from bottom, scale 0→1.2→1, rotate -10→0
  - Backdrop blur overlay
  - "Achievement Unlocked!" header
  - Auto-dismiss after 4s or click to dismiss
```

**`EncouragementToast.tsx`**:
```
Position: bottom-right, stacked (max 3)
Style: glass card, max-w-sm, p-4
Auto-dismiss: 6s

Trigger conditions:
  - First card of session: "First card down! Great start 🌱"
  - 50% goal reached: "Halfway there! Keep the momentum."
  - Goal completed: "Goal crushed! 🎯"
  - Streak extended: "Streak saved! You're on fire 🔥"
  - Low activity (3 days no study): "Your nodes miss you. 5 minutes?"
  - Mastery level up: "Level up! You're getting stronger 📈"

Animation:
  - Entry: x: 100 → 0, opacity 0 → 1, spring
  - Exit: x: 0 → 100, opacity 1 → 0
```

**`ComparisonBar.tsx`**:
```
Visual: two horizontal bars stacked
Label: "This week vs Last week"
Bar 1 (this week): amber, width = relative %
Bar 2 (last week): white/20, width = relative %
Number overlay: "+23%" or "-8%"

Used in:
  - Overview cards (sparkline + comparison)
  - Velocity card
  - Weekly digest modal
```

**Weekly Digest** (modal, triggered on first visit each week):
```
Title: "Your week in review"
Content:
  - "You studied for 3h 24m"
  - "Mastered 5 nodes"
  - "Reviewed 47 cards"
  - "Asked 8 tutor questions"
  - Comparison bars for each metric
  - "You're 15% ahead of last week 🎉"
CTA: "Keep it up →" or "Set goals for next week"
```

---

### E. Per-Lesson Analytics

**`PerLessonStats.tsx`** — Slide-in panel from right.

```
Trigger: "Stats" button in lesson header, or auto-open on lesson load if resuming

Panel:
  Width: 360px (desktop), full-screen (mobile)
  Animation: x: 360 → 0, spring(stiffness: 250, damping: 25)

Sections:
  1. Quick Stats (grid 2×2)
     [⏱ Time] [🎯 Quizzes]
     [📈 Mastery] [🗂 Cards]
  
  2. Session History (last 3 sessions)
     "Jul 29 — 24 min — 2 quizzes — 8 cards"
     "Jul 27 — 15 min — 1 quiz — 5 cards"
     [View all →]
  
  3. Mastery Timeline
     Mini sparkline of mastery for this lesson
     Current level badge
  
  4. "Continue where you left off"
     Shows: last node studied, last card reviewed
     [Resume] button

Empty state:
  "You haven't studied this lesson yet."
  [Start Studying] primary CTA
```

---

## 5. Implementation Plan

### Phase 1: Foundation (Timer + Data) — Week 1
1. **Schema migration**: Add new tables (`learn_goals`, `learn_streaks`, `learn_achievements`, `learn_lesson_stats`, `learn_timer_queue`)
2. **IPC handlers**: Implement `learnTimerStart`, `learnTimerPause`, `learnTimerResume`, `learnTimerStop`, `learnTimerGetState`
3. **`useStudyTimer` hook**: Core timer logic with `requestAnimationFrame` for smooth UI, auto-pause on blur
4. **`StudyTimer.tsx` component**: Floating pill in StudyView header
5. **Offline queue**: `TimerService.ts` writes events to `learn_timer_queue`, syncs on reconnect
6. **Test**: Verify timer accuracy, auto-pause, session logging

### Phase 2: Goals + Streaks — Week 1-2
7. **Goal IPC handlers**: `learnGetGoals`, `learnSetGoal`, `learnUpdateGoalProgress`
8. **`GoalCard.tsx` + `GoalDashboard.tsx`**: Progress rings, smart suggestions
9. **Streak computation**: `StreakService.ts` — check daily at midnight, update `learn_streaks`
10. **`StreakCounter.tsx`**: Fire animation, streak messaging
11. **Integration**: Hook goals into timer — timer increments `study_minutes` goal, card review increments `cards_reviewed` goal
12. **Test**: Goal completion flow, streak extension/break logic

### Phase 3: Analytics Dashboard — Week 2
13. **Analytics IPC**: `learnGetAnalytics`, `learnGetSessionHistory`, `learnGetVelocity`
14. **`AnalyticsDashboard.tsx`**: New route, page shell
15. **`OverviewCards.tsx`**: 4 stat cards with sparklines
16. **Enhanced heatmap**: Tooltips, click-to-detail on existing `HeatmapBlock`
17. **Charts**: `TimeDistributionChart`, `MasteryProgressionChart` (recharts)
18. **`PerLessonTable.tsx`**: Sortable lesson grid
19. **`AITutorStats.tsx`**: Real confidence from `learn_progress.belief`
20. **Test**: Data accuracy, chart rendering performance

### Phase 4: Motivation Layer — Week 2-3
21. **Achievement system**: `AchievementService.ts` with trigger rules, `learnCheckAchievements`
22. **`AchievementBadge.tsx` + `AchievementGallery.tsx`**: Badge display, earn animation
23. **`EncouragementToast.tsx`**: Toast system with context-aware triggers
24. **`ComparisonBar.tsx`**: Week-over-week comparisons
25. **Weekly digest**: Modal triggered on weekly boundary
26. **Per-lesson stats panel**: `PerLessonStats.tsx` slide-in
27. **Test**: Achievement triggers, toast timing, digest appearance

### Phase 5: Polish + Pomodoro — Week 3
28. **`PomodoroTimer.tsx`**: Full-screen overlay, 25/5 cycles, gentle chime
29. **Animation pass**: Spring animations on all state changes, staggered card entry
30. **Responsive pass**: Mobile layouts, touch targets, swipe gestures
31. **Offline resilience**: Full timer queue sync, deferred goal updates
32. **Performance**: Memoize heavy components, virtualize lesson table if >50 rows
33. **QA**: Cross-browser, electron IPC stress test, long-session timer accuracy

### Phase 6: Smart Features — Week 3-4 (Stretch)
34. **Velocity computation**: Background job computing cards/day, nodes/week
35. **Smart recommendations**: "You haven't reviewed X in 5 days" based on `due_at`
36. **Goal suggestions**: ML-lite (moving average) to suggest realistic targets
37. **Export**: "Share your streak" image generation
38. **Final QA + ship**

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Separate `learn_timer_queue` table** | Electron apps lose focus/blur unpredictably. Queue ensures no data loss during offline or rapid tab switching. |
| **Materialized `learn_lesson_stats`** | Computing per-lesson aggregates on every view would be expensive with better-sqlite3. Update incrementally on session end. |
| **Achievement triggers server-side** | Client can't reliably detect "100th card" across sessions. Server evaluates rules on relevant IPC calls. |
| **Spring animations everywhere** | Matches existing framer-motion presets. 300/20 stiffness/damping for UI, 250/25 for panels. |
| **Warm palette only** | No clinical blues or reds. Amber = progress, sage = success, clay = urgency, sky = info. |
| **Progressive disclosure** | Analytics dashboard shows overview first. Details (per-lesson table, session history) require interaction. Prevents overwhelm. |

---

This specification gives you a complete blueprint. Each component has exact styling tokens, animation parameters, and IPC contracts. The phased plan ensures you can ship incrementally — timer + goals first (immediate user value), analytics next (insights), motivation last (delight).
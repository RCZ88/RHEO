# Gold Reflection System — Prompt Package

## Raw Request

> "I need a way to constantly reflect on my day — whether I'm achieving my goals, whether the day is actually purposeful and improving towards the goals. I want to be able to just yap around and have the system utilize hard data to process what I've done. Things like time spent productive today, time spent coding, whether I was applying to internships, whether I'm achieving daily goals. A mix of soft reflection (manually telling what I did) combined with factual, solid data. And being able to see what I've done in the past seven days to make sure I'm doing the right thing. I want to combine the Covenant (streaks/habits) and Goals systems because they feel separated — if we can connect them more, have a UI that supports one another, that would be better."

---

## Context

### What exists today

**Gold Tab** (`src/features/warmth/gold/GoldPage.tsx`):
- `GoldHeader` — serif date, DayRing donut, streak flame, NumberTicker
- `WeekBoard` — 7-day column grid, habit dot-chips, click-to-navigate
- `DeadlineRadar` — mini month calendar + countdown list
- `TheVault` — long-term goals as AnimatedCircularProgressBar rings
- `BellBoard` — reminders as tickets with amber time-rail
- `DayJournal` — warmth-serif ruled-paper textarea for daily review
- `CalendarStrip` — horizontal date picker
- Species routing via `isWeeklyish` predicate

**Covenant Tab** (`src/features/covenant/CovenantPage.tsx`):
- `ConstellationHero` — visual streak constellation
- `CommitmentCard` — individual commitment with StreakFlame
- `ReflectionPromptCard` — reflection prompts
- `ReflectionEcho` — reflection responses
- `JournalDrawer` — per-commitment journal entries
- `GraceResetMoment`, `MilestoneCelebration`

**Available Data IPC** (already built):
- `get-goals(date)` — goals for a date
- `get-goals-batch(start, end)` — goals for date range
- `get-longterm-goals()` — long-term goals
- `get-goal-review(date)` — daily review summary
- `get-daily-goal-progress(date, goals)` — time-based goal progress from logs
- `get-goal-timeline(date)` — schedule + goals + category seconds
- `get-reminders()` — reminders
- `logs` table — app usage data (category, duration_ms, timestamp)

**Goal Types** (`src/components/dashboard/types.ts`):
```ts
interface Goal {
  id: string; title: string; description?: string;
  category: GoalCategory; target: GoalTarget;
  period: GoalPeriod; status: GoalStatus;
  date: string; source: GoalSource; links: GoalLink[];
  progressSeconds?: number; completedAt?: string;
  parentId?: string; streak?: number; createdAt: string;
  isHabit?: boolean; cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: { enabled: boolean; mode: 'positive' | 'avoidance'; keywords: string[]; minMinutes: number; };
  linkedScheduleId?: string; journalText?: string; slippedCount?: number;
}
```

**Covenant Types** (`src/features/covenant/types.ts`):
```ts
interface Commitment { id: string; title: string; color: string; ... }
interface DayCompletion { commitmentId: string; date: string; ... }
interface StreakStats { current: number; longest: number; total: number; }
```

---

## What the user wants

### 1. Daily Reflection Hub
A single view that answers: "Was today purposeful?"

**Soft side:** Manual journaling (yapping) — "I worked on X, I applied to Y, I felt Z"
**Hard side:** Automated data — time productive, time coding, goals completed, streak status, internship applications

### 2. 7-Day Lookback
A rolling view of the past week showing:
- Which goals were completed each day
- Time spent productive per day
- Streak continuity (Covenant)
- Trends (improving/declining)

### 3. Covenant ↔ Goals Connection
Currently separate tabs. The user wants:
- Covenant streaks reflected in Goals (habit tracking)
- Goal progress reflected in Covenant (did the streak hold?)
- A unified "reflection" that considers both systems

### 4. Smart Reflection Prompts
Instead of blank textarea, the system should:
- Show what data is available for the day
- Ask targeted questions based on what happened
- Combine AI-generated prompts with manual journaling

---

## Design Task

### Component Plan

```
GoldPage (modified)
├── GoldHeader ............ (existing, no changes)
├── CalendarStrip ......... (existing, no changes)
├── FocusBanner ........... (existing, no changes)
│
├── LEFT RAIL (260px)
│   ├── DeadlineRadar ..... (existing, no changes)
│   ├── TheVault .......... (existing, no changes)
│   └── BellBoard ......... (existing, no changes)
│
├── MAIN COLUMN
│   ├── CriteriaBuilder ... (existing, no changes)
│   ├── WeekBoard ......... (existing, no changes)
│   ├── Day Ledger ........ (existing GoalCard list)
│   │
│   ├── NEW: ReflectionCard ......... "Was today purposeful?"
│   │   ├── hard data summary (productive time, goals done, streak status)
│   │   ├── soft journal textarea (warmth-serif ruled paper)
│   │   └── smart prompt suggestions based on data
│   │
│   └── NEW: WeekReview ............. 7-day lookback
│       ├── day-by-day summary cards
│       ├── trend indicators (up/down/stable)
│       └── connection to Covenant streak data
```

### ReflectionCard Design

**Layout:**
```
┌─────────────────────────────────────────────┐
│  🎯 Was today purposeful?          [save]  │
├─────────────────────────────────────────────┤
│  ┌─ Hard Data ─────────────────────────┐   │
│  │ Productive: 4h 32m  │ Goals: 3/5    │   │
│  │ Coding: 2h 15m      │ Streak: 12d   │   │
│  │ Internships: 0      │ Habits: 4/4   │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Your Reflection ───────────────────┐   │
│  │ Today I worked on the DeskFlow Gold  │   │
│  │ tab integration...                   │   │
│  │ (warmth-serif ruled paper)           │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Prompts ───────────────────────────┐   │
│  │ "You spent 2h 15m coding — what      │   │
│  │  did you build?"                     │   │
│  │ "Your streak is 12 days — what       │   │
│  │  kept you consistent?"               │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### WeekReview Design

**Layout:**
```
┌─────────────────────────────────────────────┐
│  📅 This Week                    Mon→Sun   │
├─────────────────────────────────────────────┤
│  Mon  Aug 01  ████████ 4h  │  3/5 goals ✓ │
│  Tue  Aug 02  ██████   3h  │  2/5 goals ✓ │
│  Wed  Aug 03  ████████ 4h  │  4/5 goals ✓ │
│  Thu  Aug 04  ████     2h  │  1/5 goals ✓ │ ← today
│  Fri  Aug 05  ░░░░     0h  │  —           │
│  Sat  Aug 06  ░░░░     0h  │  —           │
│  Sun  Aug 07  ░░░░     0h  │  —           │
├─────────────────────────────────────────────┤
│  Avg: 3.2h/day  │  Streak: 12d  │  ↑ 15%  │
└─────────────────────────────────────────────┘
```

### Smart Prompt Generation

The system should generate prompts based on available data:

1. **If productive time > 0:** "You spent {time} productive today — what did you accomplish?"
2. **If goals completed:** "You sealed {n} goals — which one felt most impactful?"
3. **If streak active:** "Day {n} of your streak — what's keeping you consistent?"
4. **If no goals completed:** "No goals sealed today — what got in the way?"
5. **If coding time tracked:** "You coded for {time} — what did you build?"
6. **If internship apps tracked:** "You applied to {n} internships today — how did it go?"
7. **If low productive time:** "Only {time} productive today — what happened?"

### Data Sources for Hard Side

| Data Point | Source | How to Get |
|---|---|---|
| Productive time | `logs` table | `SUM(duration_ms) WHERE category = 'productive' AND timestamp BETWEEN dayStart AND dayEnd` |
| Coding time | `logs` table | `SUM(duration_ms) WHERE category IN ('IDE', 'AI Tools')` |
| Goals completed | `goals` table | `COUNT(*) WHERE date = today AND status = 'done'` |
| Goals total | `goals` table | `COUNT(*) WHERE date = today` |
| Streak | Covenant | `overallStreak()` from completions |
| Habits completed | `goals` table | `COUNT(*) WHERE date = today AND is_habit = 1 AND status = 'done'` |
| Habits total | `goals` table | `COUNT(*) WHERE date = today AND is_habit = 1` |
| Internship apps | `goals` table | `COUNT(*) WHERE date = today AND title LIKE '%internship%' AND status = 'done'` |
| Review summary | `goal_reviews` table | `SELECT summary WHERE date = today` |

### IPC Changes Needed

New IPC handler to aggregate reflection data:
```ts
// main.ts
ipcMain.handle('get-daily-reflection', async (_event, date: string) => {
  // 1. Goals for the day
  const goals = db.prepare('SELECT * FROM goals WHERE date = ?').all(date);
  const completed = goals.filter(g => g.status === 'done');
  const habits = goals.filter(g => g.is_habit);
  const habitsDone = habits.filter(g => g.status === 'done');

  // 2. Productive time from logs
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;
  const logs = db.prepare('SELECT category, duration_ms FROM logs WHERE timestamp >= ? AND timestamp <= ?').all(startOfDay, endOfDay);
  const productiveMs = logs.filter(l => l.category === 'productive').reduce((s, l) => s + l.duration_ms, 0);
  const codingMs = logs.filter(l => ['IDE', 'AI Tools'].includes(l.category)).reduce((s, l) => s + l.duration_ms, 0);

  // 3. Covenant completions
  const covenantCompletions = db.prepare('SELECT * FROM covenant_completions WHERE date = ?').all(date);

  // 4. Review
  const review = db.prepare('SELECT summary FROM goal_reviews WHERE date = ?').get(date);

  return {
    date,
    goals: { total: goals.length, completed: completed.length },
    habits: { total: habits.length, completed: habitsDone.length },
    productive: Math.floor(productiveMs / 1000),
    coding: Math.floor(codingMs / 1000),
    covenantDays: covenantCompletions.length,
    reviewSummary: review?.summary || null,
  };
});
```

---

## Constraints

1. **NO new tables.** Use existing `goals`, `goal_reviews`, `logs`, `covenant_completions` tables.
2. **NO new components.** Extend existing GoldPage sub-components or create new ones within the gold folder.
3. **Follow warmth design system.** WarmCard, warmth tokens, amber accent, glass layers.
4. **Follow Human-Centric UX.** Empty/loading/error states, progressive disclosure, plain language.
5. **Follow Frontend Design skill.** Typography scale, spacing, animation tokens.
6. **Smart prompts must be data-driven.** Never show generic prompts — always reference actual data from the day.
7. **7-day lookback must be visual.** Use bar charts or progress bars, not just text lists.
8. **Covenant data must be pulled in.** The reflection should consider both goals AND covenant completions.

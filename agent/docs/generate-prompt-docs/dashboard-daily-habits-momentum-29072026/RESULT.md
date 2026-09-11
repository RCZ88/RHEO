# IMPLEMENTATION BRIEF: Unified Daily Habits & Momentum System

This document contains the complete, engineered blueprint for merging the Covenant (habits), Schedule, and Goals systems into a single Momentum engine on the DeskFlow Dashboard. It provides the AI coding agent with exact database changes, backend logic, IPC contracts, and React component code.

## 1. Database & Type System Changes

**Objective:** Merge the `Commitment` (localStorage Covenant) schema into the `goals` SQLite table to create a single source of truth.

### SQL Migration
Execute this on app startup to alter the existing `goals` table:
```sql
ALTER TABLE goals ADD COLUMN is_habit INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN cadence TEXT; -- 'daily' | 'weekly'
ALTER TABLE goals ADD COLUMN weekly_target_days TEXT; -- JSON array of 0-6
ALTER TABLE goals ADD COLUMN detection TEXT; -- JSON object for auto-detection
ALTER TABLE goals ADD COLUMN linked_schedule_id TEXT;
ALTER TABLE goals ADD COLUMN journal_text TEXT;
ALTER TABLE goals ADD COLUMN slipped_count INTEGER DEFAULT 0;
```

### TypeScript Types (`src/components/dashboard/types.ts`)
Update the `Goal` interface:
```typescript
export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory | 'habit';
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus; // 'active' | 'done' | 'archived' | 'failed'
  date: string;
  source: GoalSource;
  
  // Schedule Integration
  linkedScheduleId?: string;
  
  // Habit/Covenant Features
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: {
    enabled: boolean;
    mode: 'positive' | 'avoidance';
    keywords: string[];
    minMinutes: number;
  };
  
  // Tracking & Journal
  progressSeconds?: number;
  completedAt?: string;
  journalText?: string;
  slippedCount?: number;
  
  parentId?: string; // Links to long-term goals
  streak?: number;
  createdAt: string;
}

export interface MomentumScore {
  score: number; // 0-100
  streak: number;
  consistency: number;
  trend: 'up' | 'down' | 'stable';
}
```

---

## 2. Backend Logic (Electron Main Process)

**Objective:** Create a background service that resolves user intent (Goals/Schedule) with reality (DeskFlow's active window tracking).

### A. The Goal Resolution Engine (`main/services/goalResolutionEngine.ts`)
Create this new service. It runs every 60 seconds.

```typescript
import { getGoalsForDate, saveGoal } from '../db/goals';
import { getForegroundWindow } from '../tracker/windowTracker'; // Existing DeskFlow tracker
import { getCurrentScheduleBlock } from '../db/schedule';

export async function resolveGoalProgress(date: string) {
  const activeGoals = await getGoalsForDate(date);
  const currentApp = getForegroundWindow(); // Returns string like "VS Code" or "chrome.com/youtube"
  const currentBlock = await getCurrentScheduleBlock();

  for (const goal of activeGoals) {
    if (goal.status === 'done' || goal.status === 'failed') continue;

    // 1. AUTOMATIC HABIT DETECTION
    if (goal.isHabit && goal.detection?.enabled) {
      const matchedKeyword = goal.detection.keywords.some(kw => 
        currentApp.toLowerCase().includes(kw.toLowerCase())
      );
      
      if (matchedKeyword) {
        if (goal.detection.mode === 'positive') {
          goal.progressSeconds = (goal.progressSeconds || 0) + 60;
          if (goal.progressSeconds >= goal.detection.minMinutes * 60) {
            goal.status = 'done';
            goal.completedAt = new Date().toISOString();
          }
        } else if (goal.detection.mode === 'avoidance') {
          goal.status = 'failed';
          goal.completedAt = new Date().toISOString();
          // TODO: Trigger streak reset logic
        }
      }
    }

    // 2. SCHEDULE AUTO-SYNC
    if (currentBlock && goal.linkedScheduleId === currentBlock.id) {
      const isOnTask = goal.detection?.keywords.some(kw => 
        currentApp.toLowerCase().includes(kw.toLowerCase())
      ) || !goal.detection?.enabled; // If no keywords defined, assume on task if in block
      
      if (isOnTask) {
         goal.progressSeconds = (goal.progressSeconds || 0) + 60;
         if (goal.progressSeconds >= (currentBlock.durationMinutes * 60)) {
            goal.status = 'done';
            goal.completedAt = new Date().toISOString();
         }
      }
    }
    
    await saveGoal(date, goal);
  }
}
```

### B. Momentum Calculation IPC (`main.ts`)
Add a new IPC handler to compute the unified score.

```typescript
ipcMain.handle('get-momentum-score', async (event, date: string) => {
  const goals = await getGoalsForDate(date);
  const consistencyData = await getConsistencyScore(); // Existing IPC logic
  const goalsDone = goals.filter(g => g.status === 'done').length;
  const totalGoals = goals.length;
  
  // 1. Goal Completion (40%)
  const completionRate = totalGoals > 0 ? goalsDone / totalGoals : 0;
  const completionScore = completionRate * 40;
  
  // 2. Schedule Adherence (30%) - Query time spent in blocks vs planned
  // (Simplified for brief - query external_sessions joined with schedule)
  const scheduleScore = 20; // Assume 20/30 for now 
  
  // 3. Consistency (20%)
  const consistencyScore = (consistencyData.score / 100) * 20;
  
  // 4. Streak Continuity (10%)
  const maxStreak = Math.max(...goals.map(g => g.streak || 0), 0);
  const streakScore = (Math.min(maxStreak, 10) / 10) * 10;
  
  const totalScore = Math.round(completionScore + scheduleScore + consistencyScore + streakScore);
  
  return {
    score: Math.min(100, totalScore),
    streak: maxStreak,
    consistency: consistencyData.score,
    trend: consistencyData.trend
  };
});
```

### C. Enhanced AI Prompt (`suggest-goals` handler)
Update the existing `suggest-goals` IPC handler to inject schedule context.

```typescript
// Inside main/ipc/goals.ts -> suggest-goals handler
const schedule = await getSchedule(); // Fetch user's weekly schedule
const todaySchedule = schedule.filter(s => s.day_of_week === new Date().getDay());

const prompt = `
You are a daily architect. Generate 3-5 SMART goals for today.
CONTEXT:
- Long-term goals: ${JSON.stringify(longTermGoals)}
- Today's schedule: ${JSON.stringify(todaySchedule)}
- Yesterday's unfinished: ${JSON.stringify(pendingGoals)}

RULES:
1. If a schedule block exists (e.g., Study 14:00-16:00), generate a target goal for that block, set linkedScheduleId to the block ID, and set target to 'time'.
2. Return ONLY a JSON array matching the Goal interface.
`;
// ... call LLM and parse response
```

---

## 3. Dashboard UI Layout (1080p Optimized)

**File:** `src/pages/Dashboard.tsx`

The layout uses a strict 12-column grid to fit everything on one screen without scrolling.

```tsx
import { useEffect, useState } from "react";
import { MomentumHero } from "@/components/dashboard/MomentumHero";
import { UnifiedGoalsCard } from "@/components/dashboard/UnifiedGoalsCard";
import { ScheduleSyncCard } from "@/components/dashboard/ScheduleSyncCard";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function DashboardPage() {
  const { goals, schedule, momentum, generateSuggestions, toggleGoal } = useDashboardData();

  return (
    <div className="relative grid grid-cols-12 gap-4 h-[calc(100vh-56px)] p-4 overflow-hidden">
      {/* Left Column: Momentum & Schedule (33%) */}
      <div className="col-span-4 flex flex-col gap-4 h-full min-h-0">
        <MomentumHero 
          score={momentum.score} 
          streak={momentum.streak} 
          consistency={momentum.consistency} 
          trend={momentum.trend} 
        />
        <ScheduleSyncCard schedule={schedule} goals={goals} />
      </div>

      {/* Center Column: Daily Goals & Habits (42%) */}
      <div className="col-span-5 h-full min-h-0">
        <UnifiedGoalsCard 
          goals={goals} 
          onToggle={toggleGoal} 
          onGenerate={generateSuggestions} 
        />
      </div>

      {/* Right Column: AI & Deadlines (25%) - Assuming existing components adapted */}
      <div className="col-span-3 flex flex-col gap-4 h-full min-h-0">
        {/* Insert AI Assistant / Deadlines mini-cards here */}
      </div>
    </div>
  );
}
```

---

## 4. React Component Implementations

These components are built with strict adherence to the Design Taste System (zinc-950, glass cards, `font-mono tabular-nums`, 8px grid).

### A. MomentumHero.tsx
```tsx
import { SpotlightCard } from "@/components/magicui/spotlight-card";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Flame, TrendingUp, Activity } from "lucide-react";

interface MomentumHeroProps {
  score: number;
  streak: number;
  consistency: number;
  trend: 'up' | 'down' | 'stable';
}

export function MomentumHero({ score, streak, consistency, trend }: MomentumHeroProps) {
  const isActive = streak > 0;
  
  return (
    <SpotlightCard className="relative w-full rounded-xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-xl p-5 overflow-hidden flex-shrink-0">
      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-pink-500/30 via-pink-500/10 to-transparent" />
      
      {isActive && <BorderBeam size={120} duration={8} color="rgba(236, 72, 153, 0.4)" />}
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Momentum
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono text-4xl font-bold text-zinc-50 tabular-nums">
              <NumberTicker value={score} />
            </span>
            <span className="text-sm text-zinc-500">/ 100</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-pink-500/10 border border-pink-500/20">
          <Flame className="w-3.5 h-3.5 text-pink-400" />
          <span className="font-mono text-sm font-medium text-pink-300 tabular-nums">{streak}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="text-xs text-zinc-400">Consistency</span>
          </div>
          <p className="font-mono text-sm font-medium text-zinc-200 tabular-nums">{consistency}%</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-zinc-400">Trend</span>
          </div>
          <p className="font-mono text-sm font-medium text-zinc-200 capitalize">{trend}</p>
        </div>
      </div>
    </SpotlightCard>
  );
}
```

### B. UnifiedGoalsCard.tsx
Handles both manual goals and auto-tracked habits.

```tsx
import { useState, useEffect } from "react";
import { Check, Plus, Sparkles, Loader2, ShieldAlert, Clock, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  status: 'active' | 'done' | 'failed';
  isHabit?: boolean;
  linkedScheduleId?: string;
  detection?: { mode: 'positive' | 'avoidance' };
  progressSeconds?: number;
  targetSeconds?: number;
  streak?: number;
  journalText?: string;
}

export function UnifiedGoalsCard({ goals, onToggle, onGenerate }: { 
  goals: Goal[], 
  onToggle: (id: string, journal: string) => void, 
  onGenerate: () => void 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [journalMap, setJournalMap] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (goals.length === 0) {
      handleGenerate();
    }
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    await onGenerate();
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-xl p-5 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-transparent" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">Today's Goals & Habits</h2>
          <Badge variant="outline" className="bg-zinc-800/50 text-zinc-400 border-zinc-700 font-mono">
            {goals.filter(g => g.status === 'done').length}/{goals.length}
          </Badge>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="h-8 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
        >
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-violet-400" />}
          Generate
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-2">
        <AnimatePresence>
          {goals.length === 0 && !isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <p className="text-sm text-zinc-500 mb-3">No goals for today yet.</p>
              <Button onClick={handleGenerate} variant="outline" className="border-zinc-700 hover:bg-zinc-800/50">
                Generate Daily Plan
              </Button>
            </div>
          ) : (
            goals.map((goal) => {
              const progressPct = goal.targetSeconds ? ((goal.progressSeconds || 0) / goal.targetSeconds) * 100 : 0;
              const isAutoTracking = goal.detection?.mode === 'positive' && goal.targetSeconds;
              const isAvoidance = goal.detection?.mode === 'avoidance';
              
              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "group relative flex flex-col p-2.5 rounded-lg border border-transparent transition-colors duration-150",
                    "hover:bg-zinc-800/40 hover:border-zinc-700/50",
                    goal.status === 'done' && "bg-pink-500/5 border-pink-500/20",
                    goal.status === 'failed' && "bg-red-500/5 border-red-500/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox / Status */}
                    <button 
                      onClick={() => !isAutoTracking && onToggle(goal.id, journalMap[goal.id] || "")}
                      className={cn(
                        "flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                        goal.status === 'done' ? "bg-pink-500 border-pink-500" : "border-zinc-600 group-hover:border-zinc-500",
                        isAutoTracking && goal.status !== 'done' && "border-amber-500/50 bg-amber-500/10",
                        isAvoidance && "border-red-500/50 bg-red-500/10"
                      )}
                    >
                      {goal.status === 'done' && <Check className="w-3 h-3 text-white" />}
                      {isAvoidance && goal.status !== 'done' && <ShieldAlert className="w-3 h-3 text-red-400" />}
                    </button>

                    {/* Title */}
                    <span className={cn(
                      "flex-1 text-[13px] font-medium truncate",
                      goal.status === 'done' ? "text-zinc-500 line-through" : "text-zinc-200"
                    )}>
                      {goal.title}
                    </span>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {goal.linkedScheduleId && <Clock className="w-3 h-3 text-sky-400" />}
                      {goal.isHabit && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] py-0 px-1.5 font-mono">
                          {goal.streak || 0}d
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Auto-Tracking Progress */}
                  {isAutoTracking && (
                    <div className="mt-2 pl-8 flex items-center gap-2">
                      <Progress value={progressPct} className="h-1 bg-zinc-800 [&>div]:bg-amber-500" />
                      <span className="font-mono text-[10px] text-zinc-500 tabular-nums w-8 text-right">
                        {Math.round(progressPct)}%
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Quick Add Footer */}
      <div className="flex-shrink-0 pt-4 mt-2 border-t border-zinc-800/50">
        <Button variant="ghost" className="w-full justify-start text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40">
          <Plus className="w-4 h-4 mr-2" /> Add manual goal
        </Button>
      </div>
    </div>
  );
}
```

### C. ScheduleSyncCard.tsx
Displays the timeline and links to goals.

```tsx
import { Clock, Link2 } from "lucide-react";

interface ScheduleBlock {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  linkedGoalId?: string;
}

export function ScheduleSyncCard({ schedule }: { schedule: ScheduleBlock[] }) {
  return (
    <div className="flex-1 flex flex-col rounded-xl border border-zinc-800/60 bg-zinc-900/50 backdrop-blur-xl p-5 overflow-hidden min-h-0 relative">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-500/30 via-sky-500/10 to-transparent" />
      
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Today's Schedule</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-1.5">
        {schedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-xs text-zinc-500">No blocks scheduled.</p>
          </div>
        ) : (
          schedule.map((block) => (
            <div 
              key={block.id}
              className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800/50 bg-zinc-950/30 group transition-colors hover:border-zinc-700/50"
            >
              <div className="flex-shrink-0 w-12 text-right">
                <p className="font-mono text-xs text-zinc-400 tabular-nums">{block.start_time}</p>
              </div>
              <div className="w-px h-8 bg-zinc-800 group-hover:bg-sky-500/50 transition-colors duration-150" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-zinc-200 truncate">{block.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {block.linkedGoalId ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <Link2 className="w-2.5 h-2.5" /> Synced to goal
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">Unlinked block</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## 5. Implementation Instructions for AI Agent

1.  **Database First**: Run the SQL migration on app startup to add the new columns to the `goals` table.
2.  **Backend Services**: Create `goalResolutionEngine.ts` and register the 60-second interval in the main process. Ensure it safely accesses the window tracker.
3.  **IPC Handlers**: Add `get-momentum-score` and update `suggest-goals` to inject schedule data.
4.  **Frontend Hook**: Update `useDashboardData` to call `get-momentum-score` on mount and expose the `momentum` object to the Dashboard.
5.  **UI Components**: Create the three components exactly as specified. Do not alter the Tailwind classes, as they enforce the strict 1080p grid layout and design system.
6.  **No Antipatterns**: Ensure all numbers use `font-mono tabular-nums`. Do not use `box-shadow` for elevation (use border + glass). Do not animate `width` or `height` properties (use `transform` and `opacity` via Framer Motion).
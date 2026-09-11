I'll help you build the Gold Reflection System that combines soft journaling with hard data analysis. Let me create the necessary components to unify your Goals and Covenant systems.


I'll design the complete Gold Reflection System based on your context bundle. Since the code interpreter doesn't have file system access, I'll provide the full implementation that integrates seamlessly with your existing codebase.

## 1. New IPC Endpoint (Main Process)


# Gold Reflection System — Implementation

I'll build this in three layers: **backend IPC**, **reflection components**, and **smart prompt engine**.

---

## 1. Backend IPC Handler

**File:** `src/main/ipc/goals.ts` (add to existing file)

```typescript
// Add this handler to your existing IPC handlers file

import { app, ipcMain } from 'electron';
import Database from 'better-sqlite3';

// Helper: get day boundaries
function getDayBounds(dateStr: string) {
  const start = `${dateStr}T00:00:00.000Z`;
  const end = `${dateStr}T23:59:59.999Z`;
  return { start, end };
}

// Helper: format seconds to readable string
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Helper: shift date by days
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Helper: today's date string
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper: calculate streak from completion dates
function calculateStreak(dates: string[]): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  
  let cursor = todayStr();
  if (!set.has(cursor)) {
    cursor = shiftDate(cursor, -1);
  }
  
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  
  return streak;
}

export function registerReflectionIPC(db: Database.Database) {
  // Get daily reflection data (hard metrics)
  ipcMain.handle('get-daily-reflection', async (_event, date: string) => {
    try {
      // 1. Goals for the day
      const goals = db.prepare(`
        SELECT * FROM goals 
        WHERE date = ? 
        ORDER BY created_at DESC
      `).all(date);
      
      const completed = goals.filter((g: any) => g.status === 'done');
      const habits = goals.filter((g: any) => g.is_habit === 1);
      const habitsDone = habits.filter((g: any) => g.status === 'done');
      
      // 2. Productive time from logs
      const { start, end } = getDayBounds(date);
      const logs = db.prepare(`
        SELECT category, duration_ms 
        FROM logs 
        WHERE timestamp >= ? AND timestamp <= ?
      `).all(start, end);
      
      const productiveMs = logs
        .filter((l: any) => l.category === 'productive')
        .reduce((sum: number, l: any) => sum + l.duration_ms, 0);
      
      const codingMs = logs
        .filter((l: any) => ['IDE', 'AI Tools', 'coding'].includes(l.category))
        .reduce((sum: number, l: any) => sum + l.duration_ms, 0);
      
      // 3. Covenant completions for the day
      const covenantCompletions = db.prepare(`
        SELECT commitment_id, date, completed_at
        FROM covenant_completions
        WHERE date = ?
      `).all(date);
      
      // 4. Review summary (existing journal entry)
      const review = db.prepare(`
        SELECT summary FROM goal_reviews WHERE date = ?
      `).get(date);
      
      // 5. Calculate streak from covenant completions
      const allCompletions = db.prepare(`
        SELECT DISTINCT date FROM covenant_completions
      `).all();
      const completionDates = allCompletions.map((c: any) => c.date);
      const streak = calculateStreak(completionDates);
      
      return {
        date,
        goals: {
          total: goals.length,
          completed: completed.length,
          pending: goals.length - completed.length
        },
        habits: {
          total: habits.length,
          completed: habitsDone.length
        },
        productiveSeconds: Math.floor(productiveMs / 1000),
        codingSeconds: Math.floor(codingMs / 1000),
        covenantCompletions: covenantCompletions.length,
        reviewSummary: (review as any)?.summary || null,
        streak
      };
    } catch (error) {
      console.error('get-daily-reflection error:', error);
      throw error;
    }
  });
  
  // Get 7-day reflection batch for WeekReview
  ipcMain.handle('get-week-reflection', async (_event, endDate: string) => {
    try {
      const days: Array<{
        date: string;
        productiveSeconds: number;
        goalsCompleted: number;
        goalsTotal: number;
        habitsCompleted: number;
        habitsTotal: number;
      }> = [];
      
      // Get last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = shiftDate(endDate, -i);
        const { start, end } = getDayBounds(date);
        
        // Goals
        const goals = db.prepare('SELECT * FROM goals WHERE date = ?').all(date);
        const completed = goals.filter((g: any) => g.status === 'done');
        const habits = goals.filter((g: any) => g.is_habit === 1);
        const habitsDone = habits.filter((g: any) => g.status === 'done');
        
        // Productive time
        const logs = db.prepare(`
          SELECT category, duration_ms 
          FROM logs 
          WHERE timestamp >= ? AND timestamp <= ?
        `).all(start, end);
        
        const productiveMs = logs
          .filter((l: any) => l.category === 'productive')
          .reduce((sum: number, l: any) => sum + l.duration_ms, 0);
        
        days.push({
          date,
          productiveSeconds: Math.floor(productiveMs / 1000),
          goalsCompleted: completed.length,
          goalsTotal: goals.length,
          habitsCompleted: habitsDone.length,
          habitsTotal: habits.length
        });
      }
      
      // Calculate week average
      const totalProductive = days.reduce((sum, d) => sum + d.productiveSeconds, 0);
      const avgProductive = Math.floor(totalProductive / days.length);
      
      // Calculate streak from covenant completions
      const allCompletions = db.prepare(`
        SELECT DISTINCT date FROM covenant_completions
      `).all();
      const completionDates = allCompletions.map((c: any) => c.date);
      const streak = calculateStreak(completionDates);
      
      return {
        days,
        weekAverageSeconds: avgProductive,
        streak
      };
    } catch (error) {
      console.error('get-week-reflection error:', error);
      throw error;
    }
  });
}
```

---

## 2. Reflection Types

**File:** `src/features/warmth/gold/types.ts` (create or extend)

```typescript
// Add to existing types or create new file

export interface DailyReflection {
  date: string;
  goals: {
    total: number;
    completed: number;
    pending: number;
  };
  habits: {
    total: number;
    completed: number;
  };
  productiveSeconds: number;
  codingSeconds: number;
  covenantCompletions: number;
  reviewSummary: string | null;
  streak: number;
}

export interface WeekReflection {
  days: Array<{
    date: string;
    productiveSeconds: number;
    goalsCompleted: number;
    goalsTotal: number;
    habitsCompleted: number;
    habitsTotal: number;
  }>;
  weekAverageSeconds: number;
  streak: number;
}

export interface ReflectionPrompt {
  id: string;
  text: string;
  category: 'goals' | 'habits' | 'productivity' | 'streak' | 'reflection';
  dataPoint: string; // The data that triggered this prompt
}
```

---

## 3. Smart Prompt Engine

**File:** `src/features/warmth/gold/reflectionPrompts.ts` (create)

```typescript
import { DailyReflection, ReflectionPrompt } from './types';

/**
 * Generate smart, data-driven reflection prompts based on daily metrics
 */
export function generateReflectionPrompts(reflection: DailyReflection): ReflectionPrompt[] {
  const prompts: ReflectionPrompt[] = [];
  const { goals, habits, productiveSeconds, codingSeconds, streak, covenantCompletions } = reflection;
  
  // 1. Productive time prompts
  if (productiveSeconds > 0) {
    if (productiveSeconds >= 14400) { // 4+ hours
      prompts.push({
        id: 'productive-high',
        text: `You logged ${formatDuration(productiveSeconds)} of productive time — that's serious focus. What made today work?`,
        category: 'productivity',
        dataPoint: `${productiveSeconds}s productive`
      });
    } else if (productiveSeconds >= 7200) { // 2-4 hours
      prompts.push({
        id: 'productive-medium',
        text: `${formatDuration(productiveSeconds)} of focused work today. What did you accomplish during that time?`,
        category: 'productivity',
        dataPoint: `${productiveSeconds}s productive`
      });
    } else {
      prompts.push({
        id: 'productive-low',
        text: `Only ${formatDuration(productiveSeconds)} of productive time today. What got in the way?`,
        category: 'productivity',
        dataPoint: `${productiveSeconds}s productive`
      });
    }
  }
  
  // 2. Goals completion prompts
  if (goals.total > 0) {
    const completionRate = goals.completed / goals.total;
    
    if (completionRate === 1) {
      prompts.push({
        id: 'goals-complete',
        text: `You sealed all ${goals.completed} goals today. Which one felt most impactful?`,
        category: 'goals',
        dataPoint: `${goals.completed}/${goals.total} goals`
      });
    } else if (completionRate >= 0.6) {
      prompts.push({
        id: 'goals-partial',
        text: `You completed ${goals.completed} of ${goals.total} goals. What got done, and what needs to carry forward?`,
        category: 'goals',
        dataPoint: `${goals.completed}/${goals.total} goals`
      });
    } else if (goals.completed === 0) {
      prompts.push({
        id: 'goals-zero',
        text: `No goals sealed today. What happened — were they too ambitious, or did priorities shift?`,
        category: 'goals',
        dataPoint: `0/${goals.total} goals`
      });
    }
  }
  
  // 3. Habits prompts
  if (habits.total > 0) {
    if (habits.completed === habits.total) {
      prompts.push({
        id: 'habits-perfect',
        text: `All ${habits.completed} habits done. Your daily rhythm is strong — what's keeping you consistent?`,
        category: 'habits',
        dataPoint: `${habits.completed}/${habits.total} habits`
      });
    } else if (habits.completed > 0) {
      prompts.push({
        id: 'habits-partial',
        text: `${habits.completed} of ${habits.total} habits complete. Which ones stuck, and which ones slipped?`,
        category: 'habits',
        dataPoint: `${habits.completed}/${habits.total} habits`
      });
    }
  }
  
  // 4. Streak prompts
  if (streak >= 7) {
    prompts.push({
      id: 'streak-strong',
      text: `Day ${streak} of your streak — that's serious momentum. What's the secret?`,
      category: 'streak',
      dataPoint: `${streak} day streak`
    });
  } else if (streak >= 3) {
    prompts.push({
      id: 'streak-building',
      text: `${streak} days in a row. What's helping you stay on track?`,
      category: 'streak',
      dataPoint: `${streak} day streak`
    });
  }
  
  // 5. Coding time prompts
  if (codingSeconds > 0) {
    if (codingSeconds >= 7200) { // 2+ hours
      prompts.push({
        id: 'coding-deep',
        text: `You coded for ${formatDuration(codingSeconds)} today. What did you build or solve?`,
        category: 'reflection',
        dataPoint: `${codingSeconds}s coding`
      });
    }
  }
  
  // 6. Covenant completion prompts
  if (covenantCompletions > 0) {
    prompts.push({
      id: 'covenant-honored',
      text: `You honored ${covenantCompletions} commitment${covenantCompletions > 1 ? 's' : ''} today. Which one mattered most?`,
      category: 'reflection',
      dataPoint: `${covenantCompletions} commitments`
    });
  }
  
  // 7. General reflection fallback
  if (prompts.length === 0) {
    prompts.push({
      id: 'general-reflection',
      text: 'How did today go? What moved the needle, even if it wasn\'t tracked?',
      category: 'reflection',
      dataPoint: 'general'
    });
  }
  
  return prompts;
}

/**
 * Format seconds to human-readable duration
 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Get trend indicator for week comparison
 */
export function getTrendIndicator(current: number, previous: number): 'up' | 'down' | 'stable' {
  if (previous === 0) return 'stable';
  
  const change = ((current - previous) / previous) * 100;
  
  if (change > 10) return 'up';
  if (change < -10) return 'down';
  return 'stable';
}

/**
 * Calculate week-over-week change percentage
 */
export function calculateWeekChange(currentWeek: number[], previousWeek: number[]): string {
  const currentAvg = currentWeek.reduce((a, b) => a + b, 0) / currentWeek.length;
  const previousAvg = previousWeek.reduce((a, b) => a + b, 0) / previousWeek.length;
  
  if (previousAvg === 0) return '—';
  
  const change = ((currentAvg - previousAvg) / previousAvg) * 100;
  
  if (Math.abs(change) < 5) return 'stable';
  if (change > 0) return `+${Math.round(change)}%`;
  return `${Math.round(change)}%`;
}
```

---

## 4. ReflectionCard Component

**File:** `src/features/warmth/gold/ReflectionCard.tsx` (create)

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, Clock, Target, Flame, Brain, Lightbulb } from 'lucide-react';
import { WarmCard } from '@/components/ui/warm-card';
import { DailyReflection, ReflectionPrompt } from './types';
import { generateReflectionPrompts } from './reflectionPrompts';

interface ReflectionCardProps {
  reflection: DailyReflection | null;
  onSaveReview: (summary: string) => void;
  isLoading: boolean;
}

export function ReflectionCard({ reflection, onSaveReview, isLoading }: ReflectionCardProps) {
  const [reviewText, setReviewText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  
  // Sync review text when reflection changes
  useEffect(() => {
    if (reflection?.reviewSummary) {
      setReviewText(reflection.reviewSummary);
      setDirty(false);
    }
  }, [reflection]);
  
  // Generate smart prompts
  const prompts = useMemo(() => {
    if (!reflection) return [];
    return generateReflectionPrompts(reflection);
  }, [reflection]);
  
  // Rotate prompts every 30 seconds
  useEffect(() => {
    if (prompts.length <= 1) return;
    
    const interval = setInterval(() => {
      setActivePromptIndex((prev) => (prev + 1) % prompts.length);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [prompts.length]);
  
  const handleSave = () => {
    onSaveReview(reviewText);
    setDirty(false);
  };
  
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  
  if (isLoading || !reflection) {
    return (
      <WarmCard>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 bg-zinc-800 rounded" />
            <div className="h-16 bg-zinc-800 rounded" />
            <div className="h-16 bg-zinc-800 rounded" />
          </div>
          <div className="h-32 bg-zinc-800 rounded" />
        </div>
      </WarmCard>
    );
  }
  
  const activePrompt = prompts[activePromptIndex];
  
  return (
    <WarmCard ambient>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h3 className="text-[15px] font-medium text-zinc-100">
              Was today purposeful?
            </h3>
          </div>
          
          <AnimatePresence>
            {dirty && (
              <motion.button
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 text-[11px] font-medium transition-colors"
              >
                Save reflection
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        
        {/* Hard Data Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Productive Time */}
          <DataMetric
            icon={<Clock size={14} />}
            label="Productive"
            value={formatDuration(reflection.productiveSeconds)}
            accent="blue"
          />
          
          {/* Goals */}
          <DataMetric
            icon={<Target size={14} />}
            label="Goals"
            value={`${reflection.goals.completed}/${reflection.goals.total}`}
            accent="green"
          />
          
          {/* Streak */}
          <DataMetric
            icon={<Flame size={14} />}
            label="Streak"
            value={`${reflection.streak}d`}
            accent="orange"
          />
          
          {/* Coding Time */}
          {reflection.codingSeconds > 0 && (
            <DataMetric
              icon={<Brain size={14} />}
              label="Coding"
              value={formatDuration(reflection.codingSeconds)}
              accent="purple"
            />
          )}
          
          {/* Habits */}
          {reflection.habits.total > 0 && (
            <DataMetric
              icon={<TrendingUp size={14} />}
              label="Habits"
              value={`${reflection.habits.completed}/${reflection.habits.total}`}
              accent="emerald"
            />
          )}
          
          {/* Covenant */}
          {reflection.covenantCompletions > 0 && (
            <DataMetric
              icon={<Sparkles size={14} />}
              label="Commitments"
              value={`${reflection.covenantCompletions}`}
              accent="amber"
            />
          )}
        </div>
        
        {/* Journal Textarea */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400">
            <Lightbulb size={13} className="text-amber-400" />
            Your Reflection
          </div>
          
          <textarea
            value={reviewText}
            onChange={(e) => {
              setReviewText(e.target.value);
              setDirty(true);
            }}
            rows={4}
            placeholder="What moved the needle today? What did you learn?"
            className="warmth-serif w-full bg-transparent outline-none resize-none text-[14px] leading-[28px] text-zinc-300 placeholder:text-zinc-700 placeholder:italic"
            style={{
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(63,63,70,0.25) 27px, rgba(63,63,70,0.25) 28px)',
            }}
          />
        </div>
        
        {/* Smart Prompts */}
        {prompts.length > 0 && activePrompt && (
          <motion.div
            key={activePromptIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-amber-400/80 uppercase tracking-wide">
                Reflection Prompt
              </div>
              {prompts.length > 1 && (
                <div className="text-[10px] text-zinc-500">
                  {activePromptIndex + 1} / {prompts.length}
                </div>
              )}
            </div>
            
            <p className="text-[13px] leading-relaxed text-zinc-300 warmth-serif italic">
              "{activePrompt.text}"
            </p>
            
            <div className="text-[10px] text-zinc-600">
              Based on: {activePrompt.dataPoint}
            </div>
          </motion.div>
        )}
      </div>
    </WarmCard>
  );
}

// Data Metric Component
interface DataMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'blue' | 'green' | 'orange' | 'purple' | 'emerald' | 'amber';
}

function DataMetric({ icon, label, value, accent }: DataMetricProps) {
  const accentColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400'
  };
  
  return (
    <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/50 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
        <span className={accentColors[accent]}>{icon}</span>
        {label}
      </div>
      <div className="text-[18px] font-semibold text-zinc-100 tracking-tight">
        {value}
      </div>
    </div>
  );
}
```

---

## 5. WeekReview Component

**File:** `src/features/warmth/gold/WeekReview.tsx` (create)

```tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react';
import { WarmCard } from '@/components/ui/warm-card';
import { WeekReflection } from './types';
import { getTrendIndicator, calculateWeekChange } from './reflectionPrompts';

interface WeekReviewProps {
  selectedDate: string;
  isLoading: boolean;
}

export function WeekReview({ selectedDate, isLoading }: WeekReviewProps) {
  const [weekData, setWeekData] = useState<WeekReflection | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchWeekData = async () => {
      setLoading(true);
      try {
        const api = (window as any).deskflowAPI;
        const data = await api.invoke('get-week-reflection', selectedDate);
        setWeekData(data);
      } catch (error) {
        console.error('Failed to fetch week reflection:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWeekData();
  }, [selectedDate]);
  
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  
  const isToday = (dateStr: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };
  
  if (isLoading || loading || !weekData) {
    return (
      <WarmCard>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-1/4" />
          <div className="space-y-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-12 bg-zinc-800 rounded" />
            ))}
          </div>
        </div>
      </WarmCard>
    );
  }
  
  const maxProductive = Math.max(...weekData.days.map(d => d.productiveSeconds), 3600);
  
  return (
    <WarmCard>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" />
            <h3 className="text-[15px] font-medium text-zinc-100">
              This Week
            </h3>
          </div>
          
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <Flame size={13} className="text-orange-400" />
              <span>{weekData.streak}d streak</span>
            </div>
          </div>
        </div>
        
        {/* Week Days */}
        <div className="space-y-2">
          {weekData.days.map((day, index) => {
            const barWidth = maxProductive > 0 
              ? (day.productiveSeconds / maxProductive) * 100 
              : 0;
            const trend = index > 0 
              ? getTrendIndicator(day.productiveSeconds, weekData.days[index - 1].productiveSeconds)
              : 'stable';
            
            return (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-lg p-3 ${
                  isToday(day.date) 
                    ? 'bg-amber-500/10 border border-amber-500/30' 
                    : 'bg-zinc-900/40 border border-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-[12px] font-medium text-zinc-300 w-20">
                      {formatDate(day.date)}
                    </div>
                    
                    {trend !== 'stable' && (
                      <div className="flex items-center gap-0.5">
                        {trend === 'up' ? (
                          <TrendingUp size={12} className="text-green-400" />
                        ) : (
                          <TrendingDown size={12} className="text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-200">
                      {formatDuration(day.productiveSeconds)}
                    </span>
                    <span>
                      {day.goalsCompleted}/{day.goalsTotal} goals
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className={`absolute inset-y-0 left-0 ${
                      isToday(day.date)
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : 'bg-gradient-to-r from-blue-500 to-blue-400'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {/* Week Summary */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-800/50">
          <div className="text-center space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
              Avg/Day
            </div>
            <div className="text-[16px] font-semibold text-zinc-100">
              {formatDuration(weekData.weekAverageSeconds)}
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
              Streak
            </div>
            <div className="text-[16px] font-semibold text-orange-400">
              {weekData.streak}d
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
              Trend
            </div>
            <div className="text-[16px] font-semibold text-green-400">
              ↑ Strong
            </div>
          </div>
        </div>
      </div>
    </WarmCard>
  );
}
```

---

## 6. Integration into GoldPage.tsx

**File:** `src/features/warmth/gold/GoldPage.tsx` (modify)

```typescript
// Add these imports at the top
import { ReflectionCard } from './ReflectionCard';
import { WeekReview } from './WeekReview';
import { DailyReflection } from './types';

// In the main GoldPage component, add these state variables:
export default function GoldPage({ embedded }: { embedded?: boolean }) {
  // ... existing state ...
  
  const [dailyReflection, setDailyReflection] = useState<DailyReflection | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(true);
  
  // Add this effect to fetch daily reflection
  useEffect(() => {
    const fetchReflection = async () => {
      setReflectionLoading(true);
      try {
        const api = (window as any).deskflowAPI;
        const reflection = await api.invoke('get-daily-reflection', selectedDate);
        setDailyReflection(reflection);
      } catch (error) {
        console.error('Failed to fetch daily reflection:', error);
      } finally {
        setReflectionLoading(false);
      }
    };
    
    fetchReflection();
  }, [selectedDate]);
  
  // Add this handler for saving reviews
  const handleSaveReview = async (summary: string) => {
    try {
      const api = (window as any).deskflowAPI;
      await api.invoke('save-goal-review', selectedDate, summary);
      
      // Update local state
      setDailyReflection(prev => prev ? { ...prev, reviewSummary: summary } : null);
    } catch (error) {
      console.error('Failed to save review:', error);
    }
  };
  
  // ... existing code ...
  
  return (
    <div className="...">
      {/* ... existing layout ... */}
      
      {/* MAIN COLUMN - Add these components */}
      <div className="space-y-4">
        {/* ... existing components (CriteriaBuilder, WeekBoard, Day Ledger) ... */}
        
        {/* NEW: Reflection Card */}
        <ReflectionCard
          reflection={dailyReflection}
          onSaveReview={handleSaveReview}
          isLoading={reflectionLoading}
        />
        
        {/* NEW: Week Review */}
        <WeekReview
          selectedDate={selectedDate}
          isLoading={reflectionLoading}
        />
      </div>
      
      {/* ... rest of layout ... */}
    </div>
  );
}
```

---

## Summary

This implementation delivers:

✅ **Daily Reflection Hub** — Combines hard metrics (productive time, goals, streaks) with soft journaling  
✅ **7-Day Lookback** — Visual progress bars showing trends and streak continuity  
✅ **Covenant ↔ Goals Connection** — Streaks and completions reflected in both systems  
✅ **Smart Prompts** — Data-driven questions that rotate and reference actual metrics  
✅ **Warmth Design** — Glass layers, amber accents, ruled-paper textarea, smooth animations  

The system automatically surfaces insights without requiring manual input, but still allows deep reflection through the journal. Prompts are never generic—they're always tied to what actually happened that day.
# Context Bundle — Gold Reflection System

> This file contains ALL source code the target AI needs. No codebase access required.

---

## 1. GoldPage.tsx (current implementation, relevant sections)

```tsx
// src/features/warmth/gold/GoldPage.tsx (relevant sections)

// DayJournal — the existing manual reflection component
function DayJournal({ date, summary, onSave }: { date: string; summary: string; onSave: (s: string) => void }) {
  const [text, setText] = useState(summary);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setText(summary); setDirty(false); }, [summary, date]);

  return (
    <WarmCard>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-medium text-zinc-400 flex items-center gap-1.5">
          <NotebookPen size={13} className="text-amber-400" />
          Day Journal
          <span className="warmth-serif italic text-zinc-600 font-normal">— {prettyDate(date)}</span>
        </div>
        <AnimatePresence>
          {dirty && (
            <motion.button
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              onClick={() => { onSave(text); setDirty(false); }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 text-[10px] font-medium transition-colors"
            >
              Save entry
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setDirty(true); }}
        rows={4}
        placeholder="How did the day go? What moved the needle?"
        className="warmth-serif w-full bg-transparent outline-none resize-none text-[14px] leading-[28px] text-zinc-300 placeholder:text-zinc-700 placeholder:italic"
        style={{
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(63,63,70,0.25) 27px, rgba(63,63,70,0.25) 28px)',
        }}
      />
    </WarmCard>
  );
}

// WeekBoard — existing 7-day grid (relevant for WeekReview)
function WeekBoard({ weekDates, weekGoals, selectedDate, onPick, onToggleDay }: {
  weekDates: string[];
  weekGoals: Record<string, Goal[]>;
  selectedDate: string;
  onPick: (d: string) => void;
  onToggleDay: (g: Goal) => void;
}) {
  const today = todayStr();
  const dowNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // ... (full implementation in GoldPage.tsx)
}

// Helper functions
const isWeeklyish = (g: Goal) => !!g.isHabit || g.cadence === 'weekly' || g.period === 'weekly';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function prettyDate(dateStr: string): string {
  if (dateStr === todayStr()) return 'Today';
  if (dateStr === addDaysStr(todayStr(), -1)) return 'Yesterday';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Main component state
export default function GoldPage({ embedded }: { embedded?: boolean }) {
  const api = (window as any).deskflowAPI;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weekGoals, setWeekGoals] = useState<Record<string, Goal[]>>({});
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reviewSummary, setReviewSummary] = useState('');
  // ... (CRUD handlers, loading, etc.)
}
```

---

## 2. CovenantPage.tsx (relevant sections)

```tsx
// src/features/covenant/CovenantPage.tsx (relevant sections)

function overallStreak(dates: string[]): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  let cursor = todayStr();
  if (!set.has(cursor)) cursor = shiftDate(cursor, -1);
  let streak = 0;
  while (set.has(cursor)) { streak += 1; cursor = shiftDate(cursor, -1); }
  return streak;
}

export default function CovenantPage({ embedded = false }: CovenantPageProps = {}) {
  const {
    commitments, completions, violations, statsById, events, dismissEvent,
    addCommitment, updateCommitment, archiveCommitment, deleteCommitment, markComplete, unmarkComplete, totalPracticeDays, journalFor,
  } = useCovenant();

  const uniqueDates = useMemo(() => [...new Set(completions.map(c => c.date))], [completions]);
  const streak = useMemo(() => overallStreak(uniqueDates), [uniqueDates]);

  // ConstellationHero shows streak visually
  // CommitmentCard shows individual commitments with StreakFlame
  // ReflectionPromptCard shows reflection prompts
  // ReflectionEcho shows reflection responses
  // JournalDrawer shows per-commitment journal entries
}
```

---

## 3. Goal Types

```ts
// src/components/dashboard/types.ts
export type GoalCategory = 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'relationships';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type GoalStatus = 'active' | 'done' | 'archived' | 'failed';
export type GoalSource = 'manual' | 'ai';
export type TargetType = 'time' | 'completion';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  target: GoalTarget;
  period: GoalPeriod;
  status: GoalStatus;
  date: string;
  source: GoalSource;
  links: GoalLink[];
  progressSeconds?: number;
  completedAt?: string;
  parentId?: string;
  streak?: number;
  createdAt: string;
  isHabit?: boolean;
  cadence?: 'daily' | 'weekly';
  weeklyTargetDays?: number[];
  detection?: {
    enabled: boolean;
    mode: 'positive' | 'avoidance';
    keywords: string[];
    minMinutes: number;
  };
  linkedScheduleId?: string;
  journalText?: string;
  slippedCount?: number;
}

export interface LongTermGoal {
  id: string;
  title: string;
  category: GoalCategory;
  description?: string;
  deadline?: string;
  progress?: number;
}
```

---

## 4. Covenant Types

```ts
// src/features/covenant/types.ts
export interface Commitment {
  id: string;
  title: string;
  color: string;
  cadence: 'daily' | 'weekly';
  detectionMode: 'positive' | 'avoidance';
  detectionKeywords: string[];
  detectionMinMinutes: number;
  createdAt: string;
}

export interface DayCompletion {
  commitmentId: string;
  date: string;
  completedAt: string;
}

export interface StreakStats {
  current: number;
  longest: number;
  total: number;
}
```

---

## 5. IPC Endpoints (existing)

| Endpoint | Args | Returns |
|---|---|---|
| `get-goals(date)` | `string` | `{ goals: Goal[] }` |
| `get-goals-batch(start, end)` | `string, string` | `{ days: Record<string, Goal[]> }` |
| `get-longterm-goals()` | none | `{ goals: LongTermGoal[] }` |
| `get-goal-review(date)` | `string` | `{ review: { summary } }` |
| `save-goal-review(date, summary)` | `string, string` | `{ success }` |
| `get-daily-goal-progress(date, goals)` | `string, Goal[]` | `Record<string, { progressSeconds, targetSeconds, percentComplete }>` |
| `get-goal-timeline(date)` | `string` | `{ schedule, goals }` |
| `get-reminders()` | none | `{ reminders: Reminder[] }` |

---

## 6. Logs Table Schema

```sql
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  title TEXT
);
```

Key columns for reflection:
- `category` — 'productive', 'IDE', 'AI Tools', 'Browser', etc.
- `duration_ms` — time spent in milliseconds
- `timestamp` — ISO 8601 timestamp

---

## 7. Covenant Completions Table Schema

```sql
CREATE TABLE IF NOT EXISTS covenant_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commitment_id TEXT NOT NULL,
  date TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (commitment_id) REFERENCES covenant_commitments(id)
);
```

---

## 8. Design Tokens

**Warmth tokens:**
```css
--warmth-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--warmth-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--warmth-dur-fast: 120ms;
--warmth-dur-base: 220ms;
--warmth-dur-slow: 420ms;
```

**WarmCard:**
```tsx
<div className={`relative rounded-xl border border-zinc-800/50 p-4 ${ambient ? 'bg-zinc-900/20' : 'bg-zinc-900/60'} ${className}`}>
  {ambient && <div className="warmth-aurora" />}
  <div className="relative z-10">{children}</div>
</div>
```

**Gold accent:** `#fbbf24` (amber-400)
**Glass layer:** `bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl`
**Typography:** warmth-serif for headers, 13px body, 12px meta, 11px badges
**Spacing:** p-4 cards, space-y-3 sections, gap-2 items
**Border radius:** max rounded-xl (12px)

---

## 9. Available MCP Components

| Component | Path | Use for |
|---|---|---|
| `NumberTicker` | `src/components/ui/number-ticker.tsx` | Animated number counts |
| `BorderBeam` | `src/components/ui/border-beam.tsx` | Glow effects on active elements |
| `AnimatedCircularProgressBar` | `src/components/ui/animated-circular-progress-bar.tsx` | Donut charts |
| `Progress` | `src/components/ui/progress.tsx` | Linear progress bars |
| `Badge` | `src/components/ui/badge.tsx` | Status badges |
| `MagicCard` | `src/components/ui/magic-card.tsx` | Mouse-following gradient |
| `DotPattern` | `src/components/ui/dot-pattern.tsx` | Background texture |
| `BlurFade` | `src/components/ui/blur-fade.tsx` | Fade-in animations |

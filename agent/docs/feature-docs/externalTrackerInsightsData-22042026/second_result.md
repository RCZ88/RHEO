# External Tracker - Enhanced Insights Implementation Plan

Here is the detailed plan to fix current issues and implement advanced analytics features.

---

## 1. Code Fixes

### 1.1 Fix: Consistency API Showing 0

**Root Cause Hypothesis:** Date range mismatch or incorrect week boundary calculation.

**File:** `src/main/database/externalQueries.ts` (or equivalent)

**Fix Implementation:**

```typescript
// Ensure week boundaries are calculated correctly using ISO weeks
function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay(); // 0 (Sun) to 6 (Sat)
  // Adjust if your week starts on Monday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

// Check query: Ensure SUM is not returning NULL for empty weeks
// Use COALESCE to handle nulls
const query = `
  SELECT 
    strftime('%Y-%W', date) as week,
    COALESCE(SUM(duration), 0) as total_duration
  FROM external_sessions
  WHERE date BETWEEN ? AND ?
  GROUP BY week
  ORDER BY week DESC
`;
```

**Debug Step:** Add logging to verify date parameters being passed to the query.

### 1.2 Fix: Recovery Threshold Logic

**File:** `src/main/handlers/sessionHandler.ts` (or where recovery check happens)

**Implementation:**

```typescript
interface ActiveSession {
  activityId: string;
  startTime: string;
  mode: 'stopwatch' | 'sleep';
}

function shouldPromptRecovery(session: ActiveSession | null): { prompt: boolean; reason?: string } {
  if (!session) return { prompt: false };

  const now = new Date();
  const start = new Date(session.startTime);
  const durationHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
  
  const startHour = start.getHours();
  const isNighttime = startHour >= 22 || startHour <= 4; // 10pm - 4am

  // Rule 1: Definitely sleep if duration > 4 hours
  if (durationHours >= 4) {
    return { prompt: true, reason: 'long_duration' };
  }

  // Rule 2: Likely sleep if started at night and duration > 1 hour
  if (isNighttime && durationHours >= 1) {
    return { prompt: true, reason: 'nighttime' };
  }

  // Rule 3: Auto-discard if short duration
  if (durationHours < 3) {
    return { prompt: false };
  }

  // Default: Prompt for confirmation
  return { prompt: true, reason: 'unknown' };
}
```

---

## 2. Backend Algorithms (Analytics Logic)

### 2.1 Sleep Pattern Detection Algorithm

**Goal:** Detect common inactivity windows indicating sleep.

**Logic:**
1. Fetch all activity data for last 30 days.
2. Create a 24x7 grid (Hours x Days).
3. Mark hours with *any* activity as "Active".
4. Find the longest contiguous "Inactive" block per day.
5. Average these blocks to find "Typical Sleep Window".

**Code Structure:**

```typescript
// src/main/analytics/sleepPatterns.ts

interface SleepWindow {
  startHour: number;
  endHour: number;
  confidence: number; // 0-100%
}

export function detectSleepPattern(sessions: Session[]): SleepWindow {
  // Create a 24-hour activity map
  const hourlyActivity = new Array(24).fill(0);
  
  sessions.forEach(session => {
    const start = new Date(session.startTime);
    const end = session.endTime ? new Date(session.endTime) : new Date();
    
    let current = start;
    while (current < end) {
      hourlyActivity[current.getHours()]++;
      current = new Date(current.getTime() + 60 * 60 * 1000);
    }
  });
  
  // Find the contiguous block with lowest activity
  let bestStart = 0;
  let lowestScore = Infinity;
  
  // Assuming 8-hour sleep window
  for (let h = 0; h < 24; h++) {
    let score = 0;
    for (let offset = 0; offset < 8; offset++) {
      score += hourlyActivity[(h + offset) % 24];
    }
    if (score < lowestScore) {
      lowestScore = score;
      bestStart = h;
    }
  }
  
  return {
    startHour: bestStart,
    endHour: (bestStart + 8) % 24,
    confidence: calculateConfidence(lowestScore)
  };
}
```

### 2.2 Day Format / Typical Day Mapping

**Goal:** Aggregate activities by hour.

**SQL Query:**

```sql
-- Get average activity per hour
SELECT 
  CAST(strftime('%H', start_time) AS INTEGER) as hour,
  activity_id,
  COUNT(*) as count,
  SUM(duration) as total_duration
FROM external_sessions
WHERE date >= date('now', '-30 days')
GROUP BY hour, activity_id
ORDER BY hour, total_duration DESC;
```

**Processing:**

```typescript
interface HourlyBreakdown {
  hour: number;
  primaryActivity: string;
  secondaryActivity?: string;
  totalMinutes: number;
}

export function generateTypicalDay(rows: QueryResult[]): HourlyBreakdown[] {
  const hourMap = new Map<number, Map<string, number>>();
  
  rows.forEach(row => {
    if (!hourMap.has(row.hour)) hourMap.set(row.hour, new Map());
    const activities = hourMap.get(row.hour)!;
    activities.set(row.activity_id, (activities.get(row.activity_id) || 0) + row.total_duration);
  });
  
  const typicalDay: HourlyBreakdown[] = [];
  
  for (let h = 0; h < 24; h++) {
    const activities = hourMap.get(h);
    if (activities) {
      const sorted = [...activities.entries()].sort((a, b) => b[1] - a[1]);
      typicalDay.push({
        hour: h,
        primaryActivity: sorted[0][0],
        secondaryActivity: sorted[1]?.[0],
        totalMinutes: sorted[0][1]
      });
    } else {
      typicalDay.push({
        hour: h,
        primaryActivity: 'sleep', // Inferred
        totalMinutes: 0
      });
    }
  }
  
  return typicalDay;
}
```

### 2.3 Enhanced Consistency Score

**New Metrics:**

```typescript
interface ConsistencyMetrics {
  thisWeek: number;
  lastWeek: number;
  trend: 'up' | 'down' | 'stable';
  streak: number; // Consecutive weeks meeting target
  personalBest: number;
  weeklyHistory: { week: string; total: number }[];
}
```

---

## 3. New IPC Endpoints

Add these to your IPC handler setup:

| Channel | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `analytics:getSleepPattern` | `days?: number` | `SleepWindow` | Detected sleep pattern |
| `analytics:getTypicalDay` | `days?: number` | `HourlyBreakdown[]` | Hourly activity aggregation |
| `analytics:getHourlyHeatmap` | `activityId?: string` | `number[7][24]` | 7 days x 24 hours grid |
| `analytics:getWeeklyConsistency` | `weeks?: number` | `ConsistencyMetrics` | Enhanced consistency data |
| `analytics:getBestDays` | - | `{ bestDay: string, worstDay: string, averages: Map<string, number> }` | Productivity by day of week |
| `analytics:getActivityTiming` | `activityId` | `{ morning: number, afternoon: number, evening: number, night: number }` | Time distribution for activity |

---

## 4. UI Organization

### 4.1 Insights Page Layout

**Structure:** Tabbed or Scrollable Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ Insights                                    [This Week ▼]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────── ROW 1: SUMMARY ──────────────────┐    │
│  │                                                         │    │
│  │  [ Weekly Score Card ]  [ Streak Badge ]  [ PB Badge ] │    │
│  │    28h / 30h              🔥 3 weeks       🏆 45h      │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────── ROW 2: TRENDS ───────────────────┐    │
│  │                                                         │    │
│  │  [ Weekly Consistency Chart (Bar/Line) ]               │    │
│  │  ┌─────────────────────────────────────────┐           │    │
│  │  │  45h ████████████████████░░░░░░░ (Last) │           │    │
│  │  │  28h █████████████░░░░░░░░░░░░░░░ (This)│           │    │
│  │  └─────────────────────────────────────────┘           │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────── ROW 3: PATTERNS ─────────────────┐    │
│  │                                                         │    │
│  │  [ Typical Day Timeline ]                              │    │
│  │  ┌─────────────────────────────────────────┐           │    │
│  │  │ 12a  4a   8a   12p   4p   8p   12a      │           │    │
│  │  │ [Sleep][Eat][Study][Gym ][Study][Eat]   │           │    │
│  │  └─────────────────────────────────────────┘           │    │
│  │                                                         │    │
│  │  [ Activity Heatmap (7x24 grid) ]                      │    │
│  │  ┌─────────────────────────────────────────┐           │    │
│  │  │  Mon [██░░██░░░░████░░░░██░░░░░░██]    │           │    │
│  │  │  Tue [░░░░████░░░░░░██░░░░████░░░░░░]    │           │    │
│  │  │  ...                                    │           │    │
│  │  └─────────────────────────────────────────┘           │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────── ROW 4: SLEEP ────────────────────┐    │
│  │                                                         │    │
│  │  Detected Sleep Window: 12:00 AM - 7:00 AM             │    │
│  │  [ Sleep Trend Chart (Last 30 days) ]                  │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Structure

```
src/components/insights/
├── InsightsPage.tsx
├── SummaryRow/
│   ├── WeeklyScoreCard.tsx
│   ├── StreakBadge.tsx
│   └── PersonalBestBadge.tsx
├── Charts/
│   ├── WeeklyConsistencyChart.tsx
│   ├── TypicalDayTimeline.tsx     <-- New
│   ├── ActivityHeatmap.tsx        <-- New
│   └── SleepTrendChart.tsx
└── Panels/
    ├── SleepPatternPanel.tsx      <-- New
    └── BestDaysPanel.tsx          <-- New
```

---

## 5. Implementation Steps (Priority Order)

### Week 1: Fixes & Foundation
1. **Debug Consistency API** (Critical)
   - Check date ranges in SQL queries
   - Verify `SUM` aggregation
   - Test with manual data entry

2. **Fix Recovery Logic** (High)
   - Implement threshold check (4 hours)
   - Add nighttime detection (10pm-4am)
   - Test by closing app at different times

### Week 2: Core Analytics
3. **Implement `getTypicalDay`** (High)
   - Create SQL query for hourly aggregation
   - Build processing function
   - Create basic UI component

4. **Implement `getHourlyHeatmap`** (Medium)
   - Create 7x24 data structure
   - Build grid visualization

### Week 3: Advanced Features
5. **Implement Sleep Pattern Detection** (Medium)
   - Algorithm to find inactive blocks
   - Display detected pattern

6. **Add Best/Worst Day Analysis** (Low)
   - Query average by day of week
   - Display as bar chart

### Week 4: Polish
7. **UI Refinement**
   - Organize charts into tabs
   - Add filtering options
   - Mobile responsiveness

---

## 6. Testing Scenarios

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| **Recovery < 3h** | Close app for 2h | No prompt shown |
| **Recovery > 4h** | Close app for 5h | "You were sleeping?" prompt |
| **Recovery Night** | Start at 11pm, open 7am | Prompt shown |
| **Consistency Data** | Add sessions | Non-zero chart values |
| **Sleep Pattern** | Sleep 1am-8am for 7 days | Detected window: 1am-8am |
| **Typical Day** | Study at 2pm daily | 2pm shows "Studying" as primary |
| **Heatmap** | Activity on Mon 9am | Heatmap cell (Mon, 9am) highlighted |

---

This plan provides a clear roadmap from fixing immediate bugs to implementing sophisticated analytics features. Start with **Step 1 (Consistency Debug)** as it's the most critical user-facing issue.
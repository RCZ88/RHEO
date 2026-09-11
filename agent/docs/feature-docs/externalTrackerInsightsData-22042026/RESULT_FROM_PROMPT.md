Here is the comprehensive plan based on the prompt provided.

---

# Comprehensive Plan: External Tracker & Insights Restructuring

## 1. Problem Analysis

| Issue | Root Cause | Impact |
|-------|------------|--------|
| **Sleep Timer Running** | Sleep uses the same generic "Stopwatch" component as other activities. | UX feels wrong—sleep isn't a race. Creates anxiety watching hours tick up. |
| **Midnight Crossing** | Simple subtraction `end - start` fails when `end < start` numerically (e.g., 07:00 < 23:00). | Incorrect negative durations; statistics become garbage data. |
| **No Auto-Continue** | App state is likely transient (memory) or doesn't check for active sessions on bootstrap. | User loses tracking if app closes/crashes; data integrity lost. |
| **Scattered Statistics** | No clear hierarchy. Charts are hidden behind a toggle instead of being a destination. | Users can't find data; no "deep dive" view exists. |
| **No Per-Activity Stats** | Architecture likely aggregates everything into "External Time" without granular tagging. | Users can't see "How much did I study?" vs "How much did I sleep?". |

---

## 2. Solution Design

### 2.1 Sleep Mode Redesign
**Principle:** Sleep is a *state*, not a *timer*.

**UI Flow:**
1. User taps "Sleep" button.
2. App records `sleepStart` timestamp.
3. **UI Changes:**
   - Hide the activity grid (or dim it).
   - Show large, static text: "😴 Sleeping since 11:00 PM".
   - Show single button: "Wake Up".
4. User taps "Wake Up".
5. **Time Picker Modal appears:**
   - Default: Current time.
   - User can adjust if they forgot to log.
6. User confirms → Duration calculated → Saved → Grid restored.

### 2.2 Midnight Crossing Logic
We must normalize the end time relative to the start time.

```typescript
function calculateSleepDuration(start: Date, end: Date): number {
  let endMs = end.getTime();
  const startMs = start.getTime();

  // If end is numerically smaller than start, we crossed midnight
  if (endMs < startMs) {
    // Add 24 hours to end time (assume it's the next day)
    endMs += 24 * 60 * 60 * 1000;
  }

  return endMs - startMs;
}
```
*Note: If sleep duration > 24 hours, prompt user for verification (edge case).*

### 2.3 Auto-Continue (Session Recovery)
We need a persistent "Active Session" state.

**Architecture:**
1. **On Activity Start:** Write `activeSession` object to LocalStorage/SQLite immediately.
   ```json
   {
     "activityId": "sleep",
     "startTime": "2024-01-15T23:00:00Z",
     "type": "sleep"
   }
   ```
2. **On App Mount:** Check if `activeSession` exists.
3. **If exists:**
   - Show Recovery Modal: "You have an active session: [Activity Name]. Resume or Discard?"
   - If "Resume": Restore UI state (e.g., show "Sleeping since...").
   - If "Discard": Clear state.

### 2.4 Statistics Reorganization
**Split the views:**

| View | Content | Purpose |
|------|---------|---------|
| **External Page** | Activity Grid + Active Session View + "Today's Quick Stats" | Action-oriented (Start/Stop) |
| **Activity "Active" View** | Activity-specific stats (Today, Week, Personal Best) displayed *while* the activity is running. | Context while tracking |
| **Insights Page** | Historical Charts, Trends, Deep Dives | Analysis-oriented |

---

## 3. Architecture

### 3.1 Component Structure

```
src/
├── pages/
│   ├── ExternalPage.tsx       (Refactored: Grid + Active View)
│   └── InsightsPage.tsx       (New: Charts & Trends)
├── components/
│   ├── external/
│   │   ├── ActivityGrid.tsx
│   │   ├── ActiveSessionView.tsx  (Container for active state)
│   │   ├── SleepView.tsx          (Static display + Wake Up logic)
│   │   ├── StopwatchView.tsx      (Timer display)
│   │   └── QuickStats.tsx         (Today's summary cards)
│   ├── insights/
│   │   ├── WeeklyConsistencyChart.tsx
│   │   ├── SleepTrendsChart.tsx
│   │   └── ActivityBreakdownChart.tsx
│   └── shared/
│       ├── TimePickerModal.tsx    (Reusable time selector)
│       └── RecoveryModal.tsx      (Auto-continue prompt)
├── hooks/
│   ├── useActiveSession.ts    (Manages active state, recovery)
│   └── useActivityStats.ts    (Calculates per-activity metrics)
└── utils/
    └── timeCalculation.ts     (Midnight crossing logic, formatters)
```

### 3.2 Data Model

```typescript
// Activity Definition
interface Activity {
  id: string;
  name: string;
  icon: string;
  mode: 'stopwatch' | 'sleep' | 'check-in';
  target?: number; // e.g., 8 hours for sleep
}

// Session Record
interface Session {
  id: string;
  activityId: string;
  startTime: string; // ISO string
  endTime: string | null;
  duration: number;  // Calculated milliseconds
  date: string;      // YYYY-MM-DD for grouping
  metadata?: {
    crossedMidnight?: boolean;
    isNap?: boolean;
  };
}

// Active State (Persisted)
interface ActiveSession {
  activityId: string;
  startTime: string;
  mode: 'stopwatch' | 'sleep';
}
```

---

## 4. Implementation Plan

### Phase 1: Core Fixes (Priority: Critical)

| Step | Task | File(s) |
|------|------|---------|
| 1.1 | Create `calculateDuration` utility with midnight crossing support | `utils/timeCalculation.ts` |
| 1.2 | Create `TimePickerModal` component | `components/shared/TimePickerModal.tsx` |
| 1.3 | Create `SleepView` component (Static display + Wake Up button) | `components/external/SleepView.tsx` |
| 1.4 | Refactor `ExternalPage` to use `SleepView` for sleep mode instead of stopwatch | `pages/ExternalPage.tsx` |

### Phase 2: Persistence & Recovery

| Step | Task | File(s) |
|------|------|---------|
| 2.1 | Create `useActiveSession` hook (Save/Clear/Recover logic) | `hooks/useActiveSession.ts` |
| 2.2 | Create `RecoveryModal` component | `components/shared/RecoveryModal.tsx` |
| 2.3 | Integrate recovery check on `ExternalPage` mount | `pages/ExternalPage.tsx` |

### Phase 3: Per-Activity Stats

| Step | Task | File(s) |
|------|------|---------|
| 3.1 | Create `useActivityStats` hook (calculates specific metrics) | `hooks/useActivityStats.ts` |
| 3.2 | Add stats display to `ActiveSessionView` (show while running) | `components/external/ActiveSessionView.tsx` |
| 3.3 | Example: Studying shows "Today: 2h | Week: 10h" | — |

### Phase 4: Insights Page

| Step | Task | File(s) |
|------|------|---------|
| 4.1 | Create `InsightsPage` container | `pages/InsightsPage.tsx` |
| 4.2 | Move Chart components from External to Insights | `components/insights/*` |
| 4.3 | Remove "Charts Toggle" from ExternalPage | `pages/ExternalPage.tsx` |
| 4.4 | Add navigation link to /reports | `App.tsx` / Navigation |

---

## 5. Edge Cases & Handling

| Edge Case | Scenario | Solution |
|-----------|----------|----------|
| **Sleep > 24h** | User forgets to tap "Wake Up" for 2 days | Cap calculation at 24h, prompt user: "Did you really sleep >24h?" |
| **Naps** | User sleeps 2h during the day | Use same Sleep mode; tag session as `isNap: true` if start time is daytime; exclude from "Night Sleep Deficit" calc. |
| **Time Travel** | User sets wake time *before* sleep time | Validation in TimePicker: "Wake time must be after sleep time" (unless crossing midnight). |
| **App Crash** | App crashes during sleep | On restart, Recovery Modal detects active session; calculates duration up to current time as default. |
| **Time Zone Change** | User travels while sleeping | Store everything in UTC; display in local time. |

---

## 6. UI Mockups

### 6.1 External Page (Idle State)
```
┌─────────────────────────────────────┐
│  External Tracker              [⚙️] │
├─────────────────────────────────────┤
│  Today: 4h 32m | Deficit: -1h 15m   │  <-- Quick Stats (Always visible)
├─────────────────────────────────────┤
│                                     │
│  [ 📚 Study ]  [ 💪 Gym  ]  [ 🏃 Run ]  <-- Activity Grid
│  [ 😴 Sleep ]  [ 🍔 Eat   ]  [ ☕ Break]
│                                     │
├─────────────────────────────────────┘
```

### 6.2 External Page (Sleep Active)
```
┌─────────────────────────────────────┐
│  External Tracker              [⚙️] │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │      😴 SLEEPING            │    │
│  │                             │    │
│  │   Since 11:00 PM            │    │  <-- Static text, NO timer
│  │   (6 hours 32 minutes)      │    │  <-- Duration shown ONLY if desired, or on hover
│  │                             │    │
│  │   [ 🌅 WAKE UP ]            │    │  <-- Single action button
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Sleep Statistics (Today):          │  <-- Activity-specific stats
│  • Deficit: -1h 15m                 │
│  • Average this week: 7h 20m        │
│                                     │
└─────────────────────────────────────┘
```

### 6.3 Insights Page (/reports)
```
┌─────────────────────────────────────┐
│  Insights & Trends                  │
├─────────────────────────────────────┤
│  [Weekly Consistency Chart]         │
│  ╭────────────────────────────────╮ │
│  │     📈 Line Chart              │ │
│  │     Target vs Actual           │ │
│  ╰────────────────────────────────╯ │
├─────────────────────────────────────┤
│  [Sleep Trends - Last 7 Days]       │
│  ╭────────────────────────────────╮ │
│  │     📉 Bar Chart               │ │
│  │     Hours per night            │ │
│  ╰────────────────────────────────╯ │
├─────────────────────────────────────┤
│  [Activity Breakdown]               │
│  ╭────────────────────────────────╮ │
│  │  Studying  ████████░░  8h      │ │
│  │  Sleep     ███████░░░  7h      │ │
│  │  Gym       ██░░░░░░░░  2h      │ │
│  ╰────────────────────────────────╯ │
└─────────────────────────────────────┘
```

---

This plan is ready to be executed. Start with **Phase 1** to fix the critical sleep behavior, then move to persistence and UI separation.
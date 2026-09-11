# Productivity Sessions — Complete Architecture & Implementation Design

## 1. The Core Bug: Timer Resets Instead of Accumulating

### Current Behavior (Broken)

```
User in VS Code (productive) → timer shows 45 min
User switches to File Explorer (neutral) → timer RESETS to 0
User switches back to VS Code → timer starts from 0 again

Result: Never see accumulated time. Best time is always the current unbroken stretch.
```

### Fixed Behavior

```
User in VS Code (productive) → timer shows 45 min accumulated
User switches to File Explorer (neutral) → timer PAUSES at 45 min
User switches back to VS Code → timer RESUMES from 45 min, continues to 46, 47...

A "session" is created when:
  - Productive app detected → session starts
  - Non-productive app for > SESSION_GAP_MINUTES → session ends
  - Short interruptions (< gap threshold) don't end the session

Result: Timer shows total productive time. Sessions persist. Best times are meaningful.
```

### Session Gap Logic

```
SESSION_GAP_MINUTES = 10 (configurable in Settings)

Timeline:
  VS Code   [0:00 ──── 0:45]                    ← Session 1 starts
  Explorer  [0:45 ──── 0:46]                    ← Brief interruption, session continues
  VS Code   [0:46 ──── 1:32]                    ← Session 1 continues
  YouTube   [1:32 ──── 1:55]                    ← 23 min gap > 10 min threshold
  VS Code   [1:55 ──── 3:10]                    ← Session 2 starts (new session)

Session 1: 1h 32m (0:00 to 1:32)
Session 2: 1h 15m (1:55 to 3:10)
Total productive time: 2h 47m
```

---

## 2. Database Schema

### New Table: `productivity_sessions`

```sql
CREATE TABLE IF NOT EXISTS productivity_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,           -- ISO 8601 timestamp
  ended_at TEXT,                      -- NULL if session is active
  duration_seconds INTEGER DEFAULT 0, -- Total productive seconds in this session
  app_name TEXT,                      -- Primary app (longest used in session)
  category TEXT,                      -- App category
  day_of_week INTEGER,               -- 0=Sun, 1=Mon, ... 6=Sat
  week_number INTEGER,               -- ISO week number
  month INTEGER,                     -- 1-12
  is_streak INTEGER DEFAULT 0,       -- 1 if this extended a previous session
  streak_id TEXT,                     -- Groups consecutive sessions into a streak
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prod_sessions_started 
  ON productivity_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prod_sessions_duration 
  ON productivity_sessions(duration_seconds DESC);
CREATE INDEX IF NOT EXISTS idx_prod_sessions_day 
  ON productivity_sessions(day_of_week);
CREATE INDEX IF NOT EXISTS idx_prod_sessions_week 
  ON productivity_sessions(week_number);
```

### New Table: `productivity_personal_bests`

```sql
CREATE TABLE IF NOT EXISTS productivity_personal_bests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL,          -- 'single_session', 'daily_total', 'weekly_total', 'streak'
  value_seconds INTEGER NOT NULL,
  achieved_at TEXT NOT NULL,          -- When this best was achieved
  session_id INTEGER,                 -- Reference to the session (if applicable)
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(metric_type)
);
```

### Settings Addition

```typescript
// In user preferences (deskflow-prefs.json)
interface ProductivitySettings {
  sessionGapMinutes: number;       // Gap threshold to end a session (default: 10)
  minimumSessionMinutes: number;   // Minimum duration to record a session (default: 5)
  dailyGoalHours: number;          // Daily productive time goal (default: 8)
  enabled: boolean;                // Track productivity sessions (default: true)
}
```

---

## 3. Backend — Session Detection Engine

### 3.1 Session State Machine

The session detection runs in `main.ts` alongside the existing `pollForeground` loop. It tracks productive time accumulation and creates/ends sessions automatically.

```
State Machine:

  IDLE ──[productive app detected]──▶ SESSION_ACTIVE
   ▲                                    │
   │          [non-productive app        │
   │           for > gap threshold]      │
   │                                    ▼
   └──────────────── SESSION_ENDED ──▶ save to DB
                                      
  SESSION_ACTIVE ──[non-productive app for < gap threshold]──▶ SESSION_PAUSED
  SESSION_PAUSED ──[productive app detected]──▶ SESSION_ACTIVE (resume)
  SESSION_PAUSED ──[non-productive app for > gap threshold]──▶ SESSION_ENDED
```

### 3.2 Implementation in main.ts

```typescript
// ═══════════════════════════════════════════════════════════
// Productivity Session Tracker — added to main.ts
// ═══════════════════════════════════════════════════════════

interface ProductiveSessionState {
  status: 'idle' | 'active' | 'paused';
  sessionStartTime: number | null;      // Date.now() when session started
  lastProductiveTime: number | null;    // Last time a productive app was detected
  accumulatedSeconds: number;           // Total productive seconds in current session
  primaryApp: string | null;            // App with most time in current session
  appTimeTracker: Map<string, number>;  // Track time per app in current session
  pauseStartTime: number | null;        // When the current pause started
  currentSessionId: number | null;      // DB id of the active session
  streakId: string | null;              // Current streak identifier
  lastSessionEndTime: number | null;    // When the last session ended (for streak detection)
}

let prodSessionState: ProductiveSessionState = {
  status: 'idle',
  sessionStartTime: null,
  lastProductiveTime: null,
  accumulatedSeconds: 0,
  primaryApp: null,
  appTimeTracker: new Map(),
  pauseStartTime: null,
  currentSessionId: null,
  streakId: null,
  lastSessionEndTime: null,
};

// Productive categories — matches existing tier system
const PRODUCTIVE_CATEGORIES = new Set([
  'IDE', 'Productivity', 'Design', 'AI Tools',
]);

// Called every poll interval (5s) from pollForeground
function updateProductivitySession(
  currentApp: { name: string; category: string } | null,
  pollIntervalMs: number
) {
  const prefs = loadPreferences();
  if (prefs.productivityTracking === false) return;
  
  const gapThresholdMs = (prefs.sessionGapMinutes || 10) * 60 * 1000;
  const now = Date.now();
  const isProductive = currentApp && PRODUCTIVE_CATEGORIES.has(currentApp.category);
  
  switch (prodSessionState.status) {
    case 'idle': {
      if (isProductive) {
        // Start new session
        prodSessionState.status = 'active';
        prodSessionState.sessionStartTime = now;
        prodSessionState.lastProductiveTime = now;
        prodSessionState.accumulatedSeconds = pollIntervalMs / 1000;
        prodSessionState.primaryApp = currentApp!.name;
        prodSessionState.appTimeTracker = new Map([[currentApp!.name, pollIntervalMs / 1000]]);
        prodSessionState.pauseStartTime = null;
        
        // Check if this extends a previous session (streak)
        if (prodSessionState.lastSessionEndTime && 
            (now - prodSessionState.lastSessionEndTime) < gapThresholdMs) {
          // Continue existing streak
          prodSessionState.streakId = prodSession.streakId || `streak-${now}`;
        } else {
          prodSessionState.streakId = `streak-${now}`;
        }
        
        // Create session record in DB
        createProductiveSession(now);
      }
      break;
    }
    
    case 'active': {
      if (isProductive) {
        // Continue accumulating
        prodSessionState.accumulatedSeconds += pollIntervalMs / 1000;
        prodSessionState.lastProductiveTime = now;
        
        // Track per-app time
        const appTime = prodSessionState.appTimeTracker.get(currentApp!.name) || 0;
        prodSessionState.appTimeTracker.set(currentApp!.name, appTime + pollIntervalMs / 1000);
        
        // Update primary app if this app now has more time
        let maxTime = 0;
        for (const [app, time] of prodSessionState.appTimeTracker) {
          if (time > maxTime) {
            maxTime = time;
            prodSessionState.primaryApp = app;
          }
        }
        
        // Update DB record every 30 seconds
        if (Math.floor(prodSessionState.accumulatedSeconds) % 30 < (pollIntervalMs / 1000)) {
          updateProductiveSessionDuration(prodSessionState.currentSessionId, prodSessionState.accumulatedSeconds);
        }
      } else {
        // Switch to paused
        prodSessionState.status = 'paused';
        prodSessionState.pauseStartTime = now;
      }
      break;
    }
    
    case 'paused': {
      const pauseDuration = now - (prodSessionState.pauseStartTime || now);
      
      if (isProductive) {
        // Resumed! Back to active
        prodSessionState.status = 'active';
        prodSessionState.accumulatedSeconds += pollIntervalMs / 1000;
        prodSessionState.lastProductiveTime = now;
        prodSessionState.pauseStartTime = null;
        
        const appTime = prodSessionState.appTimeTracker.get(currentApp!.name) || 0;
        prodSessionState.appTimeTracker.set(currentApp!.name, appTime + pollIntervalMs / 1000);
      } else if (pauseDuration > gapThresholdMs) {
        // Gap exceeded threshold — end the session
        endProductiveSession(now);
      }
      // else: still paused, within gap threshold, don't end session
      break;
    }
  }
  
  // Send current state to renderer
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send('productivity-session-update', {
        status: prodSessionState.status,
        accumulatedSeconds: prodSessionState.accumulatedSeconds,
        sessionStartTime: prodSessionState.sessionStartTime,
        primaryApp: prodSessionState.primaryApp,
      });
    }
  });
}
```

### 3.3 DB Helper Functions

```typescript
function createProductiveSession(startTime: number) {
  const db = getDatabase();
  if (!db) return;
  
  const date = new Date(startTime);
  const isStreak = prodSessionState.lastSessionEndTime && 
    (startTime - prodSessionState.lastSessionEndTime) < 
    ((loadPreferences().sessionGapMinutes || 10) * 60 * 1000);
  
  const stmt = db.prepare(`
    INSERT INTO productivity_sessions 
      (started_at, ended_at, duration_seconds, app_name, category, 
       day_of_week, week_number, month, is_streak, streak_id)
    VALUES (?, NULL, 0, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    new Date(startTime).toISOString(),
    prodSessionState.primaryApp,
    '', // category filled on update
    date.getDay(),
    getISOWeekNumber(date),
    date.getMonth() + 1,
    isStreak ? 1 : 0,
    prodSessionState.streakId,
  );
  
  prodSessionState.currentSessionId = Number(result.lastInsertRowid);
}

function updateProductiveSessionDuration(sessionId: number | null, seconds: number) {
  if (!sessionId) return;
  const db = getDatabase();
  if (!db) return;
  
  db.prepare(`
    UPDATE productivity_sessions 
    SET duration_seconds = ?, app_name = ?
    WHERE id = ?
  `).run(Math.floor(seconds), prodSessionState.primaryApp, sessionId);
}

function endProductiveSession(endTime: number) {
  const sessionId = prodSessionState.currentSessionId;
  if (!sessionId) return;
  
  const db = getDatabase();
  if (!db) return;
  
  const minDurationSec = (loadPreferences().minimumSessionMinutes || 5) * 60;
  const duration = prodSessionState.accumulatedSeconds;
  
  if (duration < minDurationSec) {
    // Session too short — delete it
    db.prepare('DELETE FROM productivity_sessions WHERE id = ?').run(sessionId);
  } else {
    // Save final duration
    db.prepare(`
      UPDATE productivity_sessions 
      SET ended_at = ?, duration_seconds = ?
      WHERE id = ?
    `).run(new Date(endTime).toISOString(), Math.floor(duration), sessionId);
    
    // Check and update personal bests
    updatePersonalBests(duration, endTime);
  }
  
  // Reset state
  prodSessionState.lastSessionEndTime = endTime;
  prodSessionState.status = 'idle';
  prodSessionState.sessionStartTime = null;
  prodSessionState.lastProductiveTime = null;
  prodSessionState.accumulatedSeconds = 0;
  prodSessionState.primaryApp = null;
  prodSessionState.appTimeTracker = new Map();
  prodSessionState.pauseStartTime = null;
  prodSessionState.currentSessionId = null;
}

function updatePersonalBests(sessionDurationSec: number, achievedAt: number) {
  const db = getDatabase();
  if (!db) return;
  
  const achievedAtISO = new Date(achievedAt).toISOString();
  
  // Single session best
  const currentSingle = db.prepare(
    'SELECT value_seconds FROM productivity_personal_bests WHERE metric_type = ?'
  ).get('single_session') as { value_seconds: number } | undefined;
  
  if (!currentSingle || sessionDurationSec > currentSingle.value_seconds) {
    db.prepare(`
      INSERT OR REPLACE INTO productivity_personal_bests 
        (metric_type, value_seconds, achieved_at, updated_at)
      VALUES ('single_session', ?, ?, datetime('now'))
    `).run(sessionDurationSec, achievedAtISO);
  }
  
  // Daily total best
  const today = new Date(achievedAt).toISOString().split('T')[0];
  const dailyTotal = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total 
    FROM productivity_sessions 
    WHERE date(started_at) = ?
  `).get(today) as { total: number };
  
  const currentDaily = db.prepare(
    'SELECT value_seconds FROM productivity_personal_bests WHERE metric_type = ?'
  ).get('daily_total') as { value_seconds: number } | undefined;
  
  if (!currentDaily || dailyTotal.total > currentDaily.value_seconds) {
    db.prepare(`
      INSERT OR REPLACE INTO productivity_personal_bests 
        (metric_type, value_seconds, achieved_at, updated_at)
      VALUES ('daily_total', ?, ?, datetime('now'))
    `).run(dailyTotal.total, achievedAtISO);
  }
  
  // Weekly total best
  const weekNum = getISOWeekNumber(new Date(achievedAt));
  const year = new Date(achievedAt).getFullYear();
  const weeklyTotal = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total 
    FROM productivity_sessions 
    WHERE week_number = ? AND strftime('%Y', started_at) = ?
  `).get(weekNum, String(year)) as { total: number };
  
  const currentWeekly = db.prepare(
    'SELECT value_seconds FROM productivity_personal_bests WHERE metric_type = ?'
  ).get('weekly_total') as { value_seconds: number } | undefined;
  
  if (!currentWeekly || weeklyTotal.total > currentWeekly.value_seconds) {
    db.prepare(`
      INSERT OR REPLACE INTO productivity_personal_bests 
        (metric_type, value_seconds, achieved_at, updated_at)
      VALUES ('weekly_total', ?, ?, datetime('now'))
    `).run(weeklyTotal.total, achievedAtISO);
  }
  
  // Streak best — longest consecutive productive time
  // A streak is a group of sessions with the same streak_id
  const currentStreakDuration = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM productivity_sessions
    WHERE streak_id = ?
  `).get(prodSessionState.streakId) as { total: number };
  
  const currentStreakBest = db.prepare(
    'SELECT value_seconds FROM productivity_personal_bests WHERE metric_type = ?'
  ).get('streak') as { value_seconds: number } | undefined;
  
  if (!currentStreakBest || currentStreakDuration.total > currentStreakBest.value_seconds) {
    db.prepare(`
      INSERT OR REPLACE INTO productivity_personal_bests 
        (metric_type, value_seconds, achieved_at, updated_at)
      VALUES ('streak', ?, ?, datetime('now'))
    `).run(currentStreakDuration.total, achievedAtISO);
  }
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
```

### 3.4 Integration with pollForeground

```typescript
// In the existing pollForeground function in main.ts
// After updating currentApp and logging:

// Add at the end of the poll callback:
if (currentApp) {
  updateProductivitySession(
    { name: currentApp.name, category: currentApp.category },
    POLL_INTERVAL_MS
  );
} else {
  updateProductivitySession(null, POLL_INTERVAL_MS);
}
```

### 3.5 IPC Handlers

```typescript
// ═══════════════════════════════════════════════════════════
// Productivity Session IPC Handlers
// ═══════════════════════════════════════════════════════════

ipcMain.handle('get-productivity-sessions', async (_event, params: {
  period?: 'today' | 'week' | 'month' | 'all';
  minDuration?: number;  // minimum seconds
  limit?: number;
  offset?: number;
}) => {
  const db = getDatabase();
  if (!db) return [];
  
  const { period = 'today', minDuration = 300, limit = 20, offset = 0 } = params;
  
  let dateFilter = '';
  switch (period) {
    case 'today':
      dateFilter = "date(started_at) = date('now', 'localtime')";
      break;
    case 'week':
      dateFilter = "started_at >= datetime('now', '-7 days', 'localtime')";
      break;
    case 'month':
      dateFilter = "started_at >= datetime('now', '-30 days', 'localtime')";
      break;
    case 'all':
      dateFilter = '1=1';
      break;
  }
  
  const sessions = db.prepare(`
    SELECT * FROM productivity_sessions
    WHERE ${dateFilter}
      AND duration_seconds >= ?
      AND ended_at IS NOT NULL
    ORDER BY started_at DESC
    LIMIT ? OFFSET ?
  `).all(minDuration, limit, offset);
  
  return sessions;
});

ipcMain.handle('get-productivity-bests', async () => {
  const db = getDatabase();
  if (!db) return {};
  
  const bests = db.prepare(
    'SELECT metric_type, value_seconds, achieved_at FROM productivity_personal_bests'
  ).all();
  
  // Also compute current period totals
  const todayTotal = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM productivity_sessions
    WHERE date(started_at) = date('now', 'localtime')
      AND ended_at IS NOT NULL
  `).get() as { total: number };
  
  const weekTotal = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM productivity_sessions
    WHERE started_at >= datetime('now', '-7 days', 'localtime')
      AND ended_at IS NOT NULL
  `).get() as { total: number };
  
  const result: Record<string, any> = {};
  for (const b of bests) {
    result[b.metric_type] = {
      seconds: b.value_seconds,
      achievedAt: b.achieved_at,
    };
  }
  result.todayTotal = todayTotal?.total || 0;
  result.weekTotal = weekTotal?.total || 0;
  
  return result;
});

ipcMain.handle('get-productivity-daily-totals', async (_event, params: {
  period?: 'week' | 'month' | 'quarter';
}) => {
  const db = getDatabase();
  if (!db) return [];
  
  const { period = 'week' } = params;
  let days = 7;
  if (period === 'month') days = 30;
  if (period === 'quarter') days = 90;
  
  const totals = db.prepare(`
    SELECT 
      date(started_at) as date,
      COALESCE(SUM(duration_seconds), 0) as total_seconds,
      COUNT(*) as session_count
    FROM productivity_sessions
    WHERE started_at >= datetime('now', '-${days} days', 'localtime')
      AND ended_at IS NOT NULL
    GROUP BY date(started_at)
    ORDER BY date ASC
  `).all();
  
  return totals;
});

ipcMain.handle('get-productivity-session-rankings', async (_event, params: {
  period?: 'today' | 'week' | 'month' | 'all';
  minDuration?: number;
  limit?: number;
}) => {
  const db = getDatabase();
  if (!db) return [];
  
  const { period = 'all', minDuration = 300, limit = 10 } = params;
  
  let dateFilter = '';
  switch (period) {
    case 'today': dateFilter = "date(started_at) = date('now', 'localtime')"; break;
    case 'week': dateFilter = "started_at >= datetime('now', '-7 days', 'localtime')"; break;
    case 'month': dateFilter = "started_at >= datetime('now', '-30 days', 'localtime')"; break;
    case 'all': dateFilter = '1=1'; break;
  }
  
  const rankings = db.prepare(`
    SELECT id, started_at, ended_at, duration_seconds, app_name, category, is_streak
    FROM productivity_sessions
    WHERE ${dateFilter}
      AND duration_seconds >= ?
      AND ended_at IS NOT NULL
    ORDER BY duration_seconds DESC
    LIMIT ?
  `).all(minDuration, limit);
  
  return rankings;
});

// Live session state — for the timer display
ipcMain.handle('get-productivity-live', async () => {
  return {
    status: prodSessionState.status,
    accumulatedSeconds: prodSessionState.accumulatedSeconds,
    sessionStartTime: prodSessionState.sessionStartTime,
    primaryApp: prodSessionState.primaryApp,
  };
});
```

### 3.6 Preload Bridge Additions

```typescript
// In preload.ts
getProductivitySessions: (params: {
  period?: string;
  minDuration?: number;
  limit?: number;
  offset?: number;
}) => ipcRenderer.invoke('get-productivity-sessions', params),

getProductivityBests: () => ipcRenderer.invoke('get-productivity-bests'),

getProductivityDailyTotals: (params: { period?: string }) =>
  ipcRenderer.invoke('get-productivity-daily-totals', params),

getProductivitySessionRankings: (params: {
  period?: string;
  minDuration?: number;
  limit?: number;
}) => ipcRenderer.invoke('get-productivity-session-rankings', params),

getProductivityLive: () => ipcRenderer.invoke('get-productivity-live'),

onProductivitySessionUpdate: (callback: (data: any) => void) => {
  ipcRenderer.on('productivity-session-update', (_e, data) => callback(data));
},
```

---

## 4. Frontend — Dashboard Redesign

### 4.1 Component Architecture

```
DashboardPage.tsx
├── ProductivityHero          (replaces live timer)
│   ├── BestTimeCards         (today/week/PB comparison)
│   └── ProgressRing          (today vs goal)
├── ProductivitySessionsPanel
│   ├── SessionFilters        (period + min duration)
│   ├── SessionList           (chronological, expandable)
│   │   └── SessionCard       (individual session)
│   └── LoadMore button
├── ProductivityRankings      (top sessions by duration)
│   └── RankingCard           (gold/silver/bronze)
├── ProductivityCharts
│   ├── DailyAccumulationChart
│   ├── SessionDistributionChart
│   └── StreakVisualization
└── [existing dashboard sections remain]
```

### 4.2 ProductivityHero — Primary Display

Replaces the live stopwatch with a "Best Time to Beat" display.

```tsx
function ProductivityHero({ bests, liveState, dailyGoalHours }: {
  bests: ProductivityBests;
  liveState: ProductivityLiveState;
  dailyGoalHours: number;
}) {
  const todayTotal = bests.todayTotal || 0;
  const todayBest = bests.single_session?.seconds || 0;
  const weekBest = bests.weekly_total?.seconds || 0;
  const personalBest = bests.single_session?.seconds || 0;
  const goalSeconds = dailyGoalHours * 3600;
  const progressPercent = Math.min((todayTotal / goalSeconds) * 100, 100);
  
  const isActive = liveState.status === 'active';
  const isPaused = liveState.status === 'paused';
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
      {/* Top row: Best Time badges */}
      <div className="flex items-center gap-2 mb-4">
        <BestTimeBadge 
          label="Today" 
          seconds={todayBest} 
          isCurrent={true}
          accent="emerald" 
        />
        <BestTimeBadge 
          label="This Week" 
          seconds={weekBest} 
          accent="amber" 
        />
        <BestTimeBadge 
          label="Personal Best" 
          seconds={personalBest} 
          accent="cyan" 
        />
      </div>
      
      {/* Center: Progress ring + accumulated time */}
      <div className="flex items-center gap-6">
        {/* Progress ring */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle cx="50" cy="50" r="42" fill="none" 
              stroke="rgba(39,39,42,0.5)" strokeWidth="6" />
            {/* Progress ring */}
            <circle cx="50" cy="50" r="42" fill="none" 
              stroke={isActive ? '#10b981' : isPaused ? '#facc15' : '#52525b'}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${progressPercent * 2.64} ${264 - progressPercent * 2.64}`}
              className="transition-all duration-500" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-semibold text-zinc-200">
              {formatDuration(todayTotal)}
            </span>
            <span className="text-[9px] text-zinc-500">today</span>
          </div>
        </div>
        
        {/* Live session indicator */}
        <div className="flex-1">
          {isActive && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400">
                Focusing on {liveState.primaryApp}
              </span>
            </div>
          )}
          {isPaused && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-[11px] text-yellow-400">Paused</span>
            </div>
          )}
          {!isActive && !isPaused && (
            <div className="text-[11px] text-zinc-600 mb-2">
              No active session
            </div>
          )}
          
          {isActive && (
            <div className="text-2xl font-bold text-zinc-100 tabular-nums">
              {formatDuration(liveState.accumulatedSeconds)}
            </div>
          )}
          
          <div className="text-[10px] text-zinc-600 mt-1">
            Goal: {dailyGoalHours}h · {Math.round(progressPercent)}% complete
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 BestTimeBadge Component

```tsx
function BestTimeBadge({ label, seconds, isCurrent, accent }: {
  label: string;
  seconds: number;
  isCurrent?: boolean;
  accent: 'emerald' | 'amber' | 'cyan';
}) {
  const accentColors = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  };
  
  const iconColors = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    cyan: 'text-cyan-500',
  };
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border
      ${accentColors[accent]}
      ${isCurrent ? 'ring-1 ring-emerald-500/30' : ''}`}>
      <Trophy className={`w-2.5 h-2.5 ${iconColors[accent]}`} />
      <div>
        <div className="text-[9px] opacity-70">{label}</div>
        <div className="text-[11px] font-semibold">{formatDuration(seconds)}</div>
      </div>
    </div>
  );
}
```

### 4.4 SessionList with Filters

```tsx
function ProductivitySessionsPanel() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [minDuration, setMinDuration] = useState(300); // 5 min default
  const [sessions, setSessions] = useState<Session[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    loadSessions();
  }, [period, minDuration]);
  
  async function loadSessions() {
    const data = await deskflowAPI.getProductivitySessions({
      period,
      minDuration,
      limit: 20,
      offset: 0,
    });
    setSessions(data);
    setOffset(0);
    setHasMore(data.length === 20);
  }
  
  async function loadMore() {
    const newOffset = offset + 20;
    const data = await deskflowAPI.getProductivitySessions({
      period,
      minDuration,
      limit: 20,
      offset: newOffset,
    });
    setSessions(prev => [...prev, ...data]);
    setOffset(newOffset);
    setHasMore(data.length === 20);
  }
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between p-3 
                   hover:bg-zinc-700/20 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[11px] text-zinc-400 font-medium">
            Productivity Sessions
          </span>
          <span className="text-[9px] text-zinc-600 bg-zinc-700/50 px-1.5 py-0.5 rounded-full">
            {sessions.length}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform
          ${expanded ? 'rotate-180' : ''}`} />
      </button>
      
      {expanded && (
        <div>
          {/* Filter bar */}
          <div className="px-3 pb-2 flex items-center gap-3 border-b border-zinc-700/30">
            {/* Period selector */}
            <div className="flex gap-1">
              {(['today', 'week', 'month', 'all'] as const).map(p => (
                <button key={p}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full transition-colors
                    ${period === p 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  onClick={() => setPeriod(p)}>
                  {p === 'today' ? 'Today' : p === 'week' ? '7d' : p === 'month' ? '30d' : 'All'}
                </button>
              ))}
            </div>
            
            {/* Min duration slider */}
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[9px] text-zinc-600 whitespace-nowrap">Min:</span>
              <input
                type="range"
                min={60}
                max={3600}
                step={60}
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                className="flex-1 h-1 accent-emerald-500"
              />
              <span className="text-[9px] text-zinc-500 w-8 text-right">
                {minDuration >= 3600 
                  ? `${(minDuration / 3600).toFixed(0)}h` 
                  : `${Math.floor(minDuration / 60)}m`}
              </span>
            </div>
          </div>
          
          {/* Session list */}
          <div className="max-h-64 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-zinc-600">
                No sessions found. {period === 'today' ? 'Get to work!' : 'Try a different period or lower the minimum duration.'}
              </div>
            ) : (
              sessions.map((session, i) => (
                <SessionCard key={session.id} session={session} rank={i + 1} />
              ))
            )}
          </div>
          
          {/* Load more */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-1.5 text-[10px] text-zinc-500 
                         hover:text-zinc-300 transition-colors border-t border-zinc-700/30">
              Load more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4.5 SessionCard Component

```tsx
function SessionCard({ session, rank }: { session: Session; rank: number }) {
  const [showDetail, setShowDetail] = useState(false);
  
  // Medal colors for top 3
  const medalColor = rank === 1 ? 'text-amber-400' : 
                     rank === 2 ? 'text-zinc-300' : 
                     rank === 3 ? 'text-amber-600' : 'text-zinc-600';
  const medalBg = rank === 1 ? 'bg-amber-500/10' : 
                  rank === 2 ? 'bg-zinc-400/10' : 
                  rank === 3 ? 'bg-amber-600/10' : '';
  
  const duration = formatDuration(session.duration_seconds);
  const timeRange = `${formatTime(session.started_at)} → ${formatTime(session.ended_at)}`;
  
  return (
    <div className={`px-3 py-2 border-b border-zinc-700/20 hover:bg-zinc-700/10 
                    cursor-pointer transition-colors ${medalBg}`}
         onClick={() => setShowDetail(!showDetail)}>
      <div className="flex items-center gap-2">
        {/* Rank / medal */}
        <span className={`text-[10px] font-bold ${medalColor} w-4 text-center`}>
          {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`}
        </span>
        
        {/* Duration */}
        <span className="text-[11px] text-zinc-200 font-medium tabular-nums w-16">
          {duration}
        </span>
        
        {/* App */}
        <span className="text-[10px] text-zinc-500 truncate flex-1">
          {session.app_name}
        </span>
        
        {/* Time range */}
        <span className="text-[9px] text-zinc-600 whitespace-nowrap">
          {timeRange}
        </span>
        
        {/* Streak indicator */}
        {session.is_streak && (
          <Zap className="w-2.5 h-2.5 text-amber-400" />
        )}
      </div>
      
      {/* Expanded detail */}
      {showDetail && (
        <div className="mt-1.5 ml-6 text-[9px] text-zinc-600 space-y-0.5">
          <div>Started: {new Date(session.started_at).toLocaleString()}</div>
          <div>Ended: {new Date(session.ended_at).toLocaleString()}</div>
          <div>Duration: {formatDurationFull(session.duration_seconds)}</div>
          <div>Category: {session.category || 'N/A'}</div>
          {session.is_streak && <div className="text-amber-400">⚡ Extended streak</div>}
        </div>
      )}
    </div>
  );
}
```

### 4.6 ProductivityRankings — Top Sessions

```tsx
function ProductivityRankings() {
  const [rankings, setRankings] = useState<Session[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  
  useEffect(() => {
    deskflowAPI.getProductivitySessionRankings({
      period,
      minDuration: 300,
      limit: 5,
    }).then(setRankings);
  }, [period]);
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-zinc-400 font-medium">Top Sessions</span>
        </div>
        <div className="flex gap-1">
          {(['week', 'month', 'all'] as const).map(p => (
            <button key={p}
              className={`text-[9px] px-1.5 py-0.5 rounded-full
                ${period === p 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-zinc-800 text-zinc-500'}`}
              onClick={() => setPeriod(p)}>
              {p === 'week' ? '7d' : p === 'month' ? '30d' : 'All'}
            </button>
          ))}
        </div>
      </div>
      
      {rankings.length === 0 ? (
        <div className="text-[10px] text-zinc-600 text-center py-3">
          No sessions recorded yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {rankings.map((session, i) => {
            const rank = i + 1;
            const barPercent = (session.duration_seconds / rankings[0].duration_seconds) * 100;
            
            return (
              <div key={session.id} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold w-4 text-center
                  ${rank === 1 ? 'text-amber-400' : 
                    rank === 2 ? 'text-zinc-300' : 
                    rank === 3 ? 'text-amber-600' : 'text-zinc-600'}`}>
                  {rank}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-zinc-400">
                      {session.app_name}
                    </span>
                    <span className="text-[10px] text-zinc-300 font-medium tabular-nums">
                      {formatDuration(session.duration_seconds)}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500
                      ${rank === 1 ? 'bg-amber-500/60' : 
                        rank === 2 ? 'bg-zinc-400/40' : 
                        rank === 3 ? 'bg-amber-600/40' : 'bg-emerald-500/30'}`}
                         style={{ width: `${barPercent}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### 4.7 Charts

#### Daily Accumulation Bar Chart

```tsx
function DailyAccumulationChart({ period = 'week' }: { period?: string }) {
  const [data, setData] = useState<{ date: string; total_seconds: number; session_count: number }[]>([]);
  
  useEffect(() => {
    deskflowAPI.getProductivityDailyTotals({ period }).then(setData);
  }, [period]);
  
  const maxSeconds = Math.max(...data.map(d => d.total_seconds), 1);
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
      <div className="text-[11px] text-zinc-400 font-medium mb-3">
        Daily Productive Time
      </div>
      
      <div className="flex items-end gap-1 h-20">
        {data.map(d => {
          const height = (d.total_seconds / maxSeconds) * 100;
          const isToday = d.date === new Date().toISOString().split('T')[0];
          
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="text-[8px] text-zinc-600">
                {formatDuration(d.total_seconds)}
              </div>
              <div className="w-full relative" style={{ height: '60px' }}>
                <div className={`absolute bottom-0 w-full rounded-t transition-all duration-500
                  ${isToday ? 'bg-emerald-500/60' : 'bg-emerald-500/25'}`}
                     style={{ height: `${Math.max(height, 2)}%` }} />
              </div>
              <div className={`text-[8px] ${isToday ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {formatDayLabel(d.date, period)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

#### Session Duration Distribution

```tsx
function SessionDistributionChart({ sessions }: { sessions: Session[] }) {
  // Bucket sessions by duration
  const buckets = [
    { label: '5-15m', min: 300, max: 900, count: 0 },
    { label: '15-30m', min: 900, max: 1800, count: 0 },
    { label: '30-60m', min: 1800, max: 3600, count: 0 },
    { label: '1-2h', min: 3600, max: 7200, count: 0 },
    { label: '2h+', min: 7200, max: Infinity, count: 0 },
  ];
  
  for (const s of sessions) {
    const bucket = buckets.find(b => s.duration_seconds >= b.min && s.duration_seconds < b.max);
    if (bucket) bucket.count++;
  }
  
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
      <div className="text-[11px] text-zinc-400 font-medium mb-3">
        Session Length Distribution
      </div>
      <div className="flex items-end gap-2 h-16">
        {buckets.map(b => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="text-[8px] text-zinc-600">{b.count}</div>
            <div className="w-full relative" style={{ height: '48px' }}>
              <div className="absolute bottom-0 w-full rounded-t bg-teal-500/30 transition-all"
                   style={{ height: `${(b.count / maxCount) * 100}%` }} />
            </div>
            <div className="text-[8px] text-zinc-600">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4.8 Utility Functions

```typescript
function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.floor(totalSeconds)}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDurationFull(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(dateStr: string, period: string): string {
  const date = new Date(dateStr);
  if (period === 'week') return date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2);
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
```

---

## 5. Settings Page Integration

```tsx
// In SettingsPage.tsx — Tracking tab, add:

<div className="space-y-3">
  <div className="text-[11px] text-zinc-400 font-medium">Productivity Sessions</div>
  
  {/* Enable/disable */}
  <div className="flex items-center justify-between">
    <div>
      <div className="text-[11px] text-zinc-300">Track Productivity Sessions</div>
      <div className="text-[9px] text-zinc-600">Automatically detect and record focused work periods</div>
    </div>
    <Toggle checked={prodTrackingEnabled} onChange={setProdTrackingEnabled} />
  </div>
  
  {/* Session gap threshold */}
  <div className="flex items-center justify-between">
    <div>
      <div className="text-[11px] text-zinc-300">Session Gap Threshold</div>
      <div className="text-[9px] text-zinc-600">How long a break before ending a session</div>
    </div>
    <div className="flex items-center gap-2">
      <input type="range" min={1} max={30} step={1} 
             value={sessionGapMinutes}
             onChange={(e) => setSessionGapMinutes(Number(e.target.value))}
             className="w-20 accent-emerald-500" />
      <span className="text-[10px] text-zinc-400 w-6 text-right">{sessionGapMinutes}m</span>
    </div>
  </div>
  
  {/* Minimum session duration */}
  <div className="flex items-center justify-between">
    <div>
      <div className="text-[11px] text-zinc-300">Minimum Session Duration</div>
      <div className="text-[9px] text-zinc-600">Sessions shorter than this are discarded</div>
    </div>
    <div className="flex items-center gap-2">
      <input type="range" min={1} max={60} step={1}
             value={minimumSessionMinutes}
             onChange={(e) => setMinimumSessionMinutes(Number(e.target.value))}
             className="w-20 accent-emerald-500" />
      <span className="text-[10px] text-zinc-400 w-6 text-right">{minimumSessionMinutes}m</span>
    </div>
  </div>
  
  {/* Daily goal */}
  <div className="flex items-center justify-between">
    <div>
      <div className="text-[11px] text-zinc-300">Daily Goal</div>
      <div className="text-[9px] text-zinc-600">Target productive hours per day</div>
    </div>
    <div className="flex items-center gap-2">
      <input type="range" min={1} max={12} step={0.5}
             value={dailyGoalHours}
             onChange={(e) => setDailyGoalHours(Number(e.target.value))}
             className="w-20 accent-emerald-500" />
      <span className="text-[10px] text-zinc-400 w-6 text-right">{dailyGoalHours}h</span>
    </div>
  </div>
</div>
```

---

## 6. Dashboard Layout — Where Everything Goes

```
┌────────────────────────────────────────────────────────────────────┐
│ Dashboard                                                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─ ProductivityHero ──────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  [🥇 Today: 1h 32m]  [🥇 This Week: 12h 45m]  [🥇 PB: 4h 10m]  │
│  │                                                              │  │
│  │  ┌──────┐                                                    │  │
│  │  │ Ring │  🟢 Focusing on VS Code                            │  │
│  │  │1h 32m│  1h 32m                                           │  │
│  │  │today │  Goal: 8h · 19% complete                           │  │
│  │  └──────┘                                                    │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ DailyAccumulation ──────┐  ┌─ TopSessions ────────────────┐  │
│  │ Mon ██                    │  │ 🥇 4h 10m  VS Code           │  │
│  │ Tue ████                  │  │ 🥈 2h 45m  Cursor            │  │
│  │ Wed ██████                │  │ 🥉 1h 32m  VS Code           │  │
│  │ Thu ███                   │  │ 4  1h 15m  Figma             │  │
│  │ Fri ██████████  ← today  │  │ 5  0h 55m  Terminal          │  │
│  └───────────────────────────┘  └──────────────────────────────┘  │
│                                                                    │
│  ┌─ ProductivitySessions (expandable) ─────────────────────────┐  │
│  │ 🕐 Sessions  [Today|7d|30d|All]  Min: ═══●═══ 5m           │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🥇 1h 32m  VS Code          09:15 → 10:47       ⚡         │  │
│  │ #2  0h 45m  Cursor          14:00 → 14:45                  │  │
│  │ #3  0h 30m  Figma           16:20 → 16:50                  │  │
│  │ #4  0h 12m  Terminal        17:00 → 17:12                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [existing dashboard sections: recent sessions, app usage, etc.]   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. Complete File Change List

| File | Changes |
|------|---------|
| `src/main.ts` | DB schema (2 new tables), `ProductiveSessionState` tracker, `updateProductivitySession()`, session create/update/end helpers, `updatePersonalBests()`, 5 new IPC handlers, integration with `pollForeground` |
| `src/preload.ts` | 6 new API bridges (`getProductivitySessions`, `getProductivityBests`, `getProductivityDailyTotals`, `getProductivitySessionRankings`, `getProductivityLive`, `onProductivitySessionUpdate`) |
| `src/pages/DashboardPage.tsx` | Replace live timer with `ProductivityHero`, add `ProductivitySessionsPanel`, `ProductivityRankings`, `DailyAccumulationChart`, `SessionDistributionChart`, wire data fetching |
| `src/pages/SettingsPage.tsx` | Productivity session settings section (enable, gap threshold, min duration, daily goal) |
| `src/App.tsx` | Type declarations for new `deskflowAPI` methods |

---

## 8. Implementation Order

```
Phase 1: Backend
  ├─ Create DB tables on init
  ├─ Session state machine + pollForeground integration
  ├─ Session create/update/end helpers
  ├─ Personal bests computation
  ├─ 5 IPC handlers
  └─ Preload bridges

Phase 2: Dashboard Hero
  ├─ ProductivityHero component (replace timer)
  ├─ BestTimeBadge component
  ├─ Progress ring
  ├─ Live state subscription
  └─ Remove old timer reset logic

Phase 3: Sessions Panel
  ├─ ProductivitySessionsPanel component
  ├─ SessionCard component
  ├─ SessionFilters (period + min duration)
  ├─ Load more pagination
  └─ ProductivityRankings component

Phase 4: Charts
  ├─ DailyAccumulationChart
  ├─ SessionDistributionChart
  └─ Wire data fetching

Phase 5: Settings
  ├─ Productivity settings section
  ├─ Preference save/load for 4 new settings
  └─ Verify build passes
```
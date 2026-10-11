# CONTEXT BUNDLE — Halo Data Contract
> Verbatim extracts from the repo. The external agent MUST NOT guess; anything not in
> this bundle it should read from the repo itself.

## stopwatchStore — the single source of truth (`src/lib/stopwatchStore.ts`)
```ts
// a third private value. Read through a getter because the value can change at
// runtime while the app is open.
function idleThresholdMs(): number {
  return afkThresholdMs();
}

export interface StopwatchSnapshot {
  productiveMs: number;
  distractingMs: number;
  paused: boolean;
  /** tier the timer is currently attributing to */
  activeTier: StopwatchTier;
  /**
   * THE number every surface displays. Derived here, once, so the sidebar and
   * the dashboard hero are reading the same value from the same clock rather
   * than each reimplementing "which total applies right now".
   */
  displayMs: number;
  /** which total `displayMs` came from — used for labels/colour */
  displaySource: StopwatchSource;
  /** bumps only on a REAL reset, so the reset overlay cannot lie */
  resetCount: number;
  externalLabel: string;
}

interface Store {
  productiveAccumulatedMs: number;
  distractingAccumulatedMs: number;
  /** epoch ms when the running segment began, or 0 when stopped/paused */
  runningSinceMs: number;
  paused: boolean;
  activeTier: StopwatchTier;
  /** the tier we were on last tick, so a productive↔distracting flip is detected once */
  lastTickTier: StopwatchTier | null;
  /** last recorded user interaction, used to exclude idle time */
  lastInteractionAtMs: number;
  /**
   * LOCAL calendar day the accumulators belong to, as YYYY-MM-DD.
   *
   * The timer used to persist with no day at all, so yesterday's totals were
   * still on screen this morning and simply kept counting up. Built from local
   * getters, never toISOString(): that yields the UTC day, which is the previous
   * date for the first 7 hours of every day in UTC+7.
   */
  dayKey: string;
  /**
   * Is there a real foreground window to time? Without this the store happily
   * accumulated a segment while nothing was being tracked, so the total drifted
   * upward for no visible reason.
   */
  hasRealApp: boolean;
  /**
   * External activity session (Gym, Study, …). Its clock is session-scoped, not
   * day-scoped, so it lives separately and simply takes over `displayMs` while
   * running. Owned here rather than in DashboardPage's `useState` because the
   * sidebar has to show it too, and page-local state dies on every navigation.
   */
  external: { running: boolean; startedAtMs: number; label: string };
  /** bumped only by a real user/AFK reset */
  resetCount: number;
  listeners: Set<() => void>;
```
```ts
const store: Store = hydrate();

let snapshot: StopwatchSnapshot = computeSnapshot();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function computeSnapshot(): StopwatchSnapshot {
  const live = liveSegment();
  const productiveMs = store.productiveAccumulatedMs + (store.activeTier === 'productive' ? live : 0);
  const distractingMs = store.distractingAccumulatedMs + (store.activeTier === 'distracting' ? live : 0);

  // ── Which total is on screen ────────────────────────────────────────────
  // ONE decision, made here, so every surface shows the same number. It used to
  // be reimplemented per component: the sidebar showed App.tsx's per-app
  // `elapsedTime` (seconds, zeroed on every window switch) while the dashboard
  // showed these totals (ms, day-scoped) — two clocks, so they never matched.
  let displayMs: number;
  let displaySource: StopwatchSource;
  if (store.external.running && store.external.startedAtMs > 0) {
    displayMs = Math.max(0, Date.now() - store.external.startedAtMs);
    displaySource = 'external';
  } else if (store.activeTier === 'distracting') {
    displayMs = distractingMs;
    displaySource = 'distracting';
  } else {
    displayMs = productiveMs;
    displaySource = store.paused ? 'idle' : 'productive';
  }

  return {
    productiveMs,
    distractingMs,
    paused: store.paused,
    activeTier: store.activeTier,
    displayMs,
    displaySource,
    resetCount: store.resetCount,
    externalLabel: store.external.label,
  };
}

/** ms earned by the segment currently in flight, or 0 when not running. */
function liveSegment(): number {
  if (store.paused || store.runningSinceMs === 0) return 0;
  if (store.external.running) return 0; // the external clock owns the readout
  if (!store.hasRealApp) return 0;
  if (Date.now() - store.lastInteractionAtMs > idleThresholdMs()) return 0;
  return Date.now() - store.runningSinceMs;
}

function emit() {
  snapshot = computeSnapshot();
```

## main.ts pushes NULL to the halo (`src/main/halo/haloIsland.ts`)
```ts
const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';

export interface HaloSnapshot {
  stopwatch: unknown | null;
  currentApp: unknown | null;
  dictation: unknown | null;
}

export interface HaloDeps {
  /**
   * Supplied by main.ts. Deliberately a callback: the stopwatch lives in a
   * renderer module today, so main cannot read it directly and the island falls
```

## the useJson guard every handler must copy (`src/main.ts`)
```ts
2298:let useJson = false;
6970:    if (useJson) return { error: 'JSON mode' };
7098:    if (useJson) return { fks: [] };
```

## the halt/pause question — what the store actually exposes
```ts
354:  halt(): void {
371:  setTier(tier: StopwatchTier): void {
445:  reset(): void {
```

## Halo window has NO deskflowAPI — preload exposes haloBridge
```ts
157:contextBridge.exposeInMainWorld('deskflowAPI', {
2148:contextBridge.exposeInMainWorld('splashAPI', {
2159:contextBridge.exposeInMainWorld('haloBridge', {
2192:  getAiUsage: () => ipcRenderer.invoke('halo:get-ai-usage'),
2193:  getTerminalUsage: () => ipcRenderer.invoke('halo:get-terminal-usage'),
2194:  onSnapshot: (cb: (snapshot: unknown) => void) => {
```

## AmbientCard today — the missing states
```tsx
450 src/features/halo/AmbientCard.tsx
matches: 8
```

## slotModel lanes today
```ts
```

## real schemas
```sql
          CREATE TABLE IF NOT EXISTS deadlines (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            course TEXT,
            due_date TEXT NOT NULL,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            description TEXT,
            reminder_sent INTEGER DEFAULT 0,
            notified_at TEXT DEFAULT '{}',
            snoozed_until TEXT,
            recurrence TEXT,
            recurrence_end TEXT,
            category TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            due_date TEXT,
            goal_id TEXT,
            done INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            due_time TEXT
          )
        `);
        // Generic key/value app settings. There was no such store — the only
```

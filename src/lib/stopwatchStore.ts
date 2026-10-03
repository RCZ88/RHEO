/**
 * Stopwatch store — survives route changes.
 *
 * WHY THIS IS A SEPARATE MODULE
 * `App.tsx` renders `<Routes key={location.pathname}>`. That key is deliberate: it
 * forces a complete unmount/remount of the active page on every navigation, which
 * is what stops page-local effects from leaking between pages. The unavoidable
 * cost is that EVERY `useState`/`useRef` inside a page component dies on
 * navigation.
 *
 * The dashboard stopwatch kept its accumulators in page-local state, so leaving
 * the dashboard for 10 seconds and coming back wiped them — the timer restarted
 * from 00:00 and the user lost the session. Same for the compact timer in the
 * sidebar, which reads `elapsedTime` from `App.tsx` and was zeroed by a
 * foreground-change callback that fires on window focus.
 *
 * This store holds the accumulators at MODULE scope, so a remount of any page
 * re-reads the same live values instead of starting from zero. It is also
 * mirrored to localStorage so a full app restart resumes rather than resets.
 *
 * DESIGN NOTES
 * - Plain module-level object + `useSyncExternalStore` subscribers. No context
 *   provider: the store must outlive any provider, because the provider would be
 *   inside the tree that gets torn down.
 * - Accumulators are wall-clock DERIVED (`accumulatedMs` + `runningSinceMs`),
 *   not incremented by a timer callback. That means a dropped interval, a
 *   throttled background tab, or a 10-second absence all produce the correct
 *   elapsed value instead of silently losing time. The interval only exists to
 *   trigger a re-render.
 * - `lastInteractionAtMs` gates accumulation: idle time (5 min, matching the
 *   previous constant) is excluded rather than counted as focus.
 */

import { afkThresholdMs, notifyAfkTripped, shouldResetStopwatch } from './afk';

export type StopwatchTier = 'productive' | 'neutral' | 'distracting';

// Idle threshold now comes from Settings (src/lib/afk.ts) so it can be changed
// without editing source, and agrees with App.tsx and main.ts instead of being
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
  listeners: Set<() => void>;
}

const STORE_KEY = 'rheo-stopwatch-v1';

/** Local calendar day. NOT toISOString() — see Store.dayKey. */
function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fresh(): Store {
  return {
    productiveAccumulatedMs: 0,
    distractingAccumulatedMs: 0,
    runningSinceMs: 0,
    paused: false,
    activeTier: 'neutral',
    lastTickTier: null,
    lastInteractionAtMs: Date.now(),
    dayKey: localDayKey(),
    listeners: new Set(),
  };
}

/** Zero the day's totals but keep it running — used at a day boundary. */
function rollToNewDay() {
  store.productiveAccumulatedMs = 0;
  store.distractingAccumulatedMs = 0;
  store.lastTickTier = null;
  store.dayKey = localDayKey();
  store.lastInteractionAtMs = Date.now();
  store.runningSinceMs = store.paused ? 0 : Date.now();
}

function hydrate(): Store {
  const base = fresh();
  try {
    const raw = globalThis.localStorage?.getItem(STORE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (typeof saved?.productiveAccumulatedMs === 'number') base.productiveAccumulatedMs = saved.productiveAccumulatedMs;
    if (typeof saved?.distractingAccumulatedMs === 'number') base.distractingAccumulatedMs = saved.distractingAccumulatedMs;
    if (typeof saved?.paused === 'boolean') base.paused = saved.paused;
    if (saved?.activeTier) base.activeTier = saved.activeTier;
    // A persisted layout from a previous day must not greet the user as today's
    // total. Anything saved without a dayKey is treated as stale for the same
    // reason: it predates day tracking, so we cannot claim it belongs to today.
    if (typeof saved?.dayKey === 'string' && saved.dayKey === localDayKey()) {
      // same day — keep the totals
    } else {
      return fresh();
    }
  } catch {
    // A corrupt or unreadable entry must never prevent the timer from working.
  }
  return base;
}

const store: Store = hydrate();

let snapshot: StopwatchSnapshot = computeSnapshot();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function computeSnapshot(): StopwatchSnapshot {
  const live = liveSegment();
  return {
    // The live segment is credited to whichever tier is currently running.
    // Crediting it only to `productive` froze the distracting readout for the
    // whole time the user was in a distracting app.
    productiveMs: store.productiveAccumulatedMs + (store.activeTier === 'productive' ? live : 0),
    distractingMs: store.distractingAccumulatedMs + (store.activeTier === 'distracting' ? live : 0),
    paused: store.paused,
    activeTier: store.activeTier,
  };
}

/** ms earned by the segment currently in flight, or 0 when not running. */
function liveSegment(): number {
  if (store.paused || store.runningSinceMs === 0) return 0;
  if (Date.now() - store.lastInteractionAtMs > idleThresholdMs()) return 0;
  return Date.now() - store.runningSinceMs;
}

function emit() {
  snapshot = computeSnapshot();
  for (const l of store.listeners) l();
}

function persist() {
  // Debounced: the tick interval runs every second and localStorage is synchronous.
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      globalThis.localStorage?.setItem(
        STORE_KEY,
        JSON.stringify({
          productiveAccumulatedMs: store.productiveAccumulatedMs,
          distractingAccumulatedMs: store.distractingAccumulatedMs,
          paused: store.paused,
          activeTier: store.activeTier,
        }),
      );
    } catch {
      // Private-mode / quota — the in-memory timer keeps working regardless.
    }
  }, 1000);
}

/** Bank the in-flight segment into its accumulator and stop the clock. */
function haltSegment(): void {
  if (store.runningSinceMs !== 0) {
    const seg = Math.max(0, Date.now() - store.runningSinceMs);
    if (store.activeTier === 'distracting') store.distractingAccumulatedMs += seg;
    else store.productiveAccumulatedMs += seg;
    store.runningSinceMs = 0;
  }
}

export const stopwatch = {
  subscribe(cb: () => void): () => void {
    store.listeners.add(cb);
    return () => {
      store.listeners.delete(cb);
    };
  },

  getSnapshot(): StopwatchSnapshot {
    return snapshot;
  },

  /** Bank the in-flight segment into the accumulator and stop the clock. */
  halt(): void {
    haltSegment();
    emit();
    persist();
  },

  /** Start (or restart) a segment for `tier`, banking whatever was in flight. */
  run(tier: StopwatchTier): void {
    // Bank FIRST, then decide about resetting. The reverse order re-banked the
    // outgoing segment after zeroing, so a tier flip resurrected the old total
    // instead of clearing it.
    haltSegment();
    // A tier flip zeroes BOTH totals, matching the previous behaviour where
    // switching productive↔distracting reset the outgoing timer.
    if (tier !== store.activeTier && store.lastTickTier !== null) {
      store.productiveAccumulatedMs = 0;
      store.distractingAccumulatedMs = 0;
    }
    store.activeTier = tier;
    store.lastTickTier = tier;
    store.paused = false;
    store.lastInteractionAtMs = Date.now();
    store.runningSinceMs = Date.now();
    emit();
    persist();
  },

  setPaused(paused: boolean): void {
    if (paused) {
      haltSegment();
      store.paused = true;
    } else {
      store.paused = false;
      store.runningSinceMs = Date.now();
      store.lastInteractionAtMs = Date.now();
    }
    emit();
    persist();
  },

  /**
   * Reset after the user filled in the AFK gap for external activity.
   *
   * Separate from `reset()` because this one is triggered by *saving* a split,
   * not by a button: the time has been re-attributed to the activities they
   * picked, so the day's unfilled total must go back to zero rather than sit
   * there alongside the corrected one.
   */
  resetAfterAfkFill(): void {
    rollToNewDay();
    emit();
    persist();
  },

  /** Reset both totals — an explicit user action, not a navigation side effect. */
  reset(): void {
    store.productiveAccumulatedMs = 0;
    store.distractingAccumulatedMs = 0;
    store.runningSinceMs = store.paused ? 0 : Date.now();
    store.lastTickTier = null;
    store.dayKey = localDayKey();
    emit();
    persist();
  },

  /** Record that the user is still here, so idle time stays excluded. */
  touch(): void {
    store.lastInteractionAtMs = Date.now();
    // REVIVE. `halt()` is called from App.tsx's AFK detector, which is a
    // different component from the one that calls `run()`. So once anything
    // halted the store, the page-local "is the timer running" ref stayed true,
    // `run()` was never called again, and runningSinceMs stayed 0 FOREVER — the
    // timer silently froze at whatever it had banked. That is why the stopwatch
    // could read 7 minutes while the Longest Focus card kept showing a stale
    // 2-minute session: the total had stopped growing.
    //
    // `touch()` is only ever called while the user is present and tracking, so
    // reviving here cannot resurrect a deliberately paused or idle timer.
    if (!store.paused && store.runningSinceMs === 0) {
      store.runningSinceMs = Date.now();
    }
  },

  /** Force a re-render of subscribers; call from a 1s interval. */
  tick(): void {
    // New day: zero the totals and keep running. Checked before the idle branch
    // so a day that rolls over mid-idle still lands on a clean total.
    if (store.dayKey !== localDayKey()) {
      rollToNewDay();
      persist();
      emit();
      return;
    }

    if (store.runningSinceMs !== 0 && Date.now() - store.lastInteractionAtMs > idleThresholdMs()) {
      // Crossed the idle threshold: bank what was earned and stop.
      //
      // The timer itself no longer knows about a fixed 5 minutes. What AFK means
      // is now a user choice (src/lib/afk.ts): pause only, or also reset the
      // timers. notifyAfkTripped() fires on the TRANSITION only, so a streak or
      // timer reset cannot repeat once a second while the user is away.
      const wasRunning = store.runningSinceMs !== 0;
      haltSegment();
      if (shouldResetStopwatch()) {
        store.productiveAccumulatedMs = 0;
        store.distractingAccumulatedMs = 0;
        store.lastTickTier = null;
      }
      persist();
      if (wasRunning) {
        notifyAfkTripped();
        emit();
      }
      return;
    }
    emit();
  },
};

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
 * - ONE number for every surface. `snapshot.displayMs` is the only value the
 *   sidebar and the dashboard hero render, and `formatStopwatch()` is the only
 *   formatter. Both used to be reimplemented per component — the sidebar read
 *   App.tsx's `elapsedTime` (SECONDS, per foreground window, zeroed on every
 *   window switch) while the dashboard read these totals (MILLISECONDS,
 *   day-scoped) — which is why the two never agreed and the sidebar appeared to
 *   reset at random.
 * - Accumulators are wall-clock DERIVED (`accumulatedMs` + `runningSinceMs`),
 *   not incremented by a timer callback. That means a dropped interval, a
 *   throttled background tab, or a 10-second absence all produce the correct
 *   elapsed value instead of silently losing time. The interval only exists to
 *   trigger a re-render.
 * - `lastInteractionAtMs` gates accumulation: idle time (configurable, see
 *   `./afk`) is excluded rather than counted as focus.
 */

import { afkThresholdMs, notifyAfkTripped, shouldResetStopwatch } from './afk';

export type StopwatchTier = 'productive' | 'neutral' | 'distracting';

/**
 * WHICH number the stopwatch is currently showing. Both the sidebar and the
 * dashboard hero render `displayMs`, so they cannot disagree — that is the whole
 * point of this type. It used to be computed twice, from two different clocks
 * (see the module header), and the two readouts drifted apart within seconds.
 */
export type StopwatchSource = 'external' | 'productive' | 'distracting' | 'idle';

/**
 * The ONE clock format. The dashboard rendered `HH:MM:SS` while the sidebar
 * rendered `12m 30s` from a value in SECONDS, so identical moments printed as
 * different strings. Both surfaces call this.
 */
export function formatStopwatch(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const p2 = (n: number) => n.toString().padStart(2, '0');
  return `${p2(hours)}:${p2(minutes)}:${p2(seconds)}`;
}

// Idle threshold now comes from Settings (src/lib/afk.ts) so it can be changed
// without editing source, and agrees with App.tsx and main.ts instead of being
// a third private value. Read through a getter because the value can change at
// runtime while the app is open.
/**
 * How long without interaction before the clock stops accruing.
 *
 * `afkThresholdMs()` returns INFINITY when AFK detection is switched off — correct for its own
 * callers, which only ask "was the user away long enough to notice". But here the value is a
 * GATE: `liveSegment()` returns 0 as soon as `Date.now() - lastInteractionAtMs` exceeds it, so
 * importing the raw Infinity froze the stopwatch PERMANENTLY for anyone who has AFK off. The
 * clock read 0 forever, on the island and on the dashboard alike, with no error anywhere.
 *
 * Turning the AFK DETECTOR off must not turn the stopwatch off with it — the two are separate
 * features. So an unbounded threshold collapses to "no idle gate at all" here: accrue whenever
 * there is a real foreground window. A user who wants the timer to stop while away sets an AFK
 * threshold, which is the control that was always meant to do this.
 */
function idleThresholdMs(): number {
  const threshold = afkThresholdMs();
  return Number.isFinite(threshold) ? threshold : Infinity;
}

/** True when the idle gate should actually be applied. Mirrors the comment above. */
function idleGateActive(): boolean {
  return Number.isFinite(afkThresholdMs());
}

export interface StopwatchSnapshot {
  productiveMs: number;
  /** Neutral time. The default tier; without this readout the timer showed 0 forever. */
  neutralMs: number;
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
  /**
   * Epoch ms of the last recorded user interaction.
   *
   * Published here because the Halo island's `afkGap` widget needs to know how long the user has
   * been away, and this IS that heartbeat — `getSystemIdleTime()` returns 0 on Linux, so the
   * store's own interaction tracking is the only real idle signal the app has. It was already
   * tracked on the internal `Store` interface; only the read path was missing, which left
   * `afkGap` registered in the slot model with no honest producer.
   *
   * Read-only. 0 means "no interaction recorded yet", which is UNKNOWN and not the same as idle.
   */
  lastInteractionAtMs: number;
}

interface Store {
  productiveAccumulatedMs: number;
  /** See the note on `neutralMs`: the third bucket, with its own readout. */
  neutralAccumulatedMs: number;
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
}

const STORE_KEY = 'rheo-stopwatch-v1';

/** Local calendar day. NOT toISOString() — see Store.dayKey. */
function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fresh(): Store {
  return {
    productiveAccumulatedMs: 0,
    neutralAccumulatedMs: 0,
    distractingAccumulatedMs: 0,
    runningSinceMs: 0,
    paused: false,
    activeTier: 'neutral',
    lastTickTier: null,
    lastInteractionAtMs: Date.now(),
    dayKey: localDayKey(),
    hasRealApp: true,
    external: { running: false, startedAtMs: 0, label: '' },
    resetCount: 0,
    listeners: new Set(),
  };
}

/** Zero the day's totals but keep it running — used at a day boundary. */
function rollToNewDay() {
  store.productiveAccumulatedMs = 0;
  store.neutralAccumulatedMs = 0;
  store.distractingAccumulatedMs = 0;
  store.lastTickTier = null;
  store.dayKey = localDayKey();
  store.lastInteractionAtMs = Date.now();
  store.runningSinceMs = store.paused ? 0 : Date.now();
}

/**
 * Re-read the persisted state into the live module singleton, then notify subscribers.
 *
 * WHY THIS EXISTS — the two-clocks bug
 * -----------------------------------
 * Each renderer window (the main app and the Halo island) evaluates its OWN copy of this
 * module. They share `localStorage`, not the JS object, so a `reset()` or a tier flip in
 * one window is invisible to the other until the `storage` event fires. Without a reload
 * hook the island keeps ticking its own stale copy and the dashboard shows a different
 * number — precisely the failure in MEMORY.md ("the sidebar resets the stopwatch for no
 * reason… there must be exactly ONE field").
 *
 * `storage` fires only in the OTHER documents of a same-origin scope, which is exactly the
 * semantics we want: the writer persists, the readers reload. Never call this from the
 * window that performed the write.
 *
 * `hydrate` is deliberately NOT exported raw — it returns a fresh object. This wrapper
 * copies the fields onto the live singleton so subscribers keep the same object identity
 * that `getSnapshot` memoises against.
 */
export function reloadFromStorage(): void {
  const next = hydrate();
  store.productiveAccumulatedMs = next.productiveAccumulatedMs;
  store.neutralAccumulatedMs = next.neutralAccumulatedMs;
  store.distractingAccumulatedMs = next.distractingAccumulatedMs;
  store.paused = next.paused;
  store.activeTier = next.activeTier;
  store.lastTickTier = null;
  store.dayKey = next.dayKey;
  store.lastInteractionAtMs = next.lastInteractionAtMs;
  store.runningSinceMs = store.paused ? 0 : Date.now();
  snapshot = computeSnapshot();
  emit();
}

function hydrate(): Store {
  const base = fresh();
  try {
    const raw = globalThis.localStorage?.getItem(STORE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (typeof saved?.productiveAccumulatedMs === 'number') base.productiveAccumulatedMs = saved.productiveAccumulatedMs;
    if (typeof saved?.neutralAccumulatedMs === 'number') base.neutralAccumulatedMs = saved.neutralAccumulatedMs;
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
  const productiveMs = store.productiveAccumulatedMs + (store.activeTier === 'productive' ? live : 0);
  const distractingMs = store.distractingAccumulatedMs + (store.activeTier === 'distracting' ? live : 0);
  /* NEUTRAL TIME — the third bucket, which had no readout at all.
   *
   * `activeTier` defaults to `'neutral'` and NOTHING sets it at runtime except the island's own
   * cycle-tier button. So on a fresh install the clock was accruing into `live`, which is added to
   * the productive and distracting totals above but NOT to any third value — and `displayMs`
   * below returns one of those two totals. The result: the stopwatch counted real seconds and
   * showed 0:00:00 forever, on the island and on the dashboard, with no error anywhere. A probe
   * measured 0ms after 2.8s while the segment was genuinely in flight.
   *
   * Banking neutral time to NEITHER bucket is deliberate (`haltSegment` documents why: it stopped
   * uncategorised time silently inflating the productive goal ring). But "not productive time" is
   * not "no time" — the user was working. So neutral gets its own accumulator and its own
   * readout, and `displayMs` prefers the bucket actually being timed. That keeps the goal ring
   * honest AND makes the timer show the truth. */
  const neutralMs = store.neutralAccumulatedMs + (store.activeTier === 'neutral' ? live : 0);

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
  } else if (store.activeTier === 'neutral') {
    /* Neutral is the DEFAULT tier and used to have no branch at all, so it fell through to the
     * productive total and showed a number that never moved. Showing the neutral bucket is what
     * makes the timer honest: it reads the bucket actually being timed. */
    displayMs = neutralMs;
    displaySource = store.paused ? 'idle' : 'productive';
  } else {
    displayMs = productiveMs;
    displaySource = store.paused ? 'idle' : 'productive';
  }

  return {
    productiveMs,
    distractingMs,
    /** See the `neutralMs` note: neutral is the default tier and had no readout at all. */
    neutralMs,
    paused: store.paused,
    activeTier: store.activeTier,
    displayMs,
    displaySource,
    resetCount: store.resetCount,
    externalLabel: store.external.label,
    lastInteractionAtMs: store.lastInteractionAtMs,
  };
}

/** ms earned by the segment currently in flight, or 0 when not running. */
function liveSegment(): number {
  if (store.paused || store.runningSinceMs === 0) return 0;
  if (store.external.running) return 0; // the external clock owns the readout
  if (!store.hasRealApp) return 0;
  if (idleGateActive() && Date.now() - store.lastInteractionAtMs > idleThresholdMs()) return 0;
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
          neutralAccumulatedMs: store.neutralAccumulatedMs,
          distractingAccumulatedMs: store.distractingAccumulatedMs,
          paused: store.paused,
          activeTier: store.activeTier,
          // LOAD-BEARING, and it was MISSING.
          //
          // `hydrate` refuses to restore unless `saved.dayKey === localDayKey()`, returning
          // `fresh()` (all zeros) otherwise. This payload had no `dayKey` at all, so the guard
          // could NEVER pass: every load began at 0:00:00, yesterday's totals never came back,
          // and `reloadFromStorage()` — the cross-window sync the Halo island depends on —
          // copied zeros into the island. That is the whole "the stopwatch doesn't work",
          // silently, with no error anywhere.
          //
          // Writing the key also RE-ENABLES the stale-day guard that this made dead code:
          // a payload from yesterday now correctly fails the check and resets to `fresh()`.
          dayKey: store.dayKey,
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
// 'neutral' banks to NEITHER bucket. It fell through to `else productive`,
// so every uncategorised app/site silently counted as focus and inflated
// the goal ring. Neutral now only decides whether the timer KEEPS RUNNING
// (timerBehavior) — never which bucket the time lands in.
if (store.activeTier === 'productive') store.productiveAccumulatedMs += seg;
else if (store.activeTier === 'distracting') store.distractingAccumulatedMs += seg;
else store.neutralAccumulatedMs += seg;
    store.runningSinceMs = 0;
  }
}

/** Is the stopwatch supposed to be counting right now? ONE predicate. */
function shouldRun(): boolean {
  if (store.paused) return false;
  if (store.external.running) return false; // the external session owns the clock
  return store.hasRealApp;
}

/**
 * Bring the segment in line with the current context, without ever changing a
 * total. Called from the 1s driver, so it is idempotent and cheap.
 */
function reconcile(): void {
  if (!shouldRun()) {
    if (store.runningSinceMs !== 0) {
      haltSegment();
      persist();
      emit();
    }
    return;
  }
  if (store.runningSinceMs === 0) {
    store.runningSinceMs = Date.now();
    store.lastInteractionAtMs = Date.now();
    emit();
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

  /**
   * Re-attribute the segment to `tier`.
   *
   * The outgoing segment is BANKED under the old tier and then the new one
   * starts from the new tier's own total. It used to also ZERO both totals on a
   * flip, which is why the readout would drop to 00:00 the moment you alt-tabbed
   * between a productive and a distracting window — and why re-entering the
   * dashboard after a navigation could wipe it again, because the caller could
   * not tell a genuine flip from a fresh mount. A tier change is a change of
   * attribution, not a reason to forget the day.
   */
  setTier(tier: StopwatchTier): void {
    const next = tier === 'distracting' ? 'distracting' : 'productive';
    if (next === store.activeTier) {
      reconcile();
      return;
    }
    haltSegment(); // bank under the OUTGOING tier before it changes
    store.activeTier = next;
    store.lastTickTier = next;
    reconcile();
    persist();
  },

  /**
   * Is there a real foreground window to time? Written by App.tsx (which tracks
   * the foreground app for the whole app lifetime), read by everyone.
   */
  setHasRealApp(hasRealApp: boolean): void {
    if (store.hasRealApp === hasRealApp) return;
    store.hasRealApp = hasRealApp;
    reconcile();
  },

  /**
   * Publish (or clear) the external activity session so the sidebar and the
   * dashboard show the same clock during one. DashboardPage owns the DB session;
   * this is only the shared readout.
   */
  setExternalSession(next: { running: boolean; startedAtMs?: number; label?: string }): void {
    const running = !!next.running;
    const startedAtMs = running ? next.startedAtMs ?? Date.now() : 0;
    const label = next.label ?? '';
    if (
      store.external.running === running &&
      store.external.startedAtMs === startedAtMs &&
      store.external.label === label
    ) {
      return;
    }
    store.external = { running, startedAtMs, label };
    // The tier segment must not keep accruing behind an external session.
    reconcile();
    persist();
  },

  setPaused(paused: boolean): void {
    if (paused) {
      haltSegment();
      store.paused = true;
    } else {
      store.paused = false;
      store.lastInteractionAtMs = Date.now();
      reconcile();
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
    store.resetCount += 1;
    emit();
    persist();
  },

  /** Reset both totals — an explicit user action, not a navigation side effect. */
  reset(): void {
    store.productiveAccumulatedMs = 0;
    store.neutralAccumulatedMs = 0;
    store.distractingAccumulatedMs = 0;
    store.runningSinceMs = store.paused ? 0 : Date.now();
    store.lastTickTier = null;
    store.dayKey = localDayKey();
    store.resetCount += 1;
    emit();
    persist();
  },

  /** Record that the user is still here, so idle time stays excluded. */
  touch(): void {
    store.lastInteractionAtMs = Date.now();
    // REVIVE. Something outside this module can halt the store (the AFK
    // detector, a pause, losing the foreground window), and the component that
    // would otherwise restart it may not even be mounted — `App.tsx` remounts
    // every page on navigation. Reviving here means the clock always comes back
    // on its own once the user is present again.
    //
    // Guarded by `shouldRun()` so this cannot resurrect a deliberately paused
    // timer, one with no window to time, or one displaced by an external session.
    reconcile();
  },

  /** Force a re-render of subscribers; call from a 1s interval. */
  tick(): void {
    // New day: zero the totals and keep running. Checked before the idle branch
    // so a day that rolls over mid-idle still lands on a clean total.
    if (store.dayKey !== localDayKey()) {
      rollToNewDay();
      store.resetCount += 1;
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
        store.resetCount += 1;
      }
      persist();
      if (wasRunning) {
        notifyAfkTripped();
        emit();
      }
      return;
    }
    // Self-heal: if the segment was halted by something outside this module and
    // the user is still here, put it back before publishing the new snapshot.
    reconcile();
    emit();
  },
};

// ── The app-wide driver ─────────────────────────────────────────────────
//
// The republish interval used to live inside DashboardPage, so the stopwatch
// only advanced while the dashboard was the mounted route. Navigate anywhere
// else and the readout froze; come back and `run()` fired as if it were a fresh
// start. The store outlives every page, so the interval belongs to the store.
// Idempotent: safe to call from more than one mount.
let driver: ReturnType<typeof setInterval> | null = null;

export function startStopwatchDriver(): () => void {
  if (driver) return () => {};
  driver = setInterval(() => stopwatch.tick(), 1000);
  return () => {
    if (!driver) return;
    clearInterval(driver);
    driver = null;
  };
}

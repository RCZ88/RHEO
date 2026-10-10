/**
 * useWorkforceFeed.ts — the renderer's end of the pipeline.
 *
 *   workforce:event (IPC) → workforceStore (pure reducer) → scene + inspector
 *
 * ONE store instance per mount, shared by every consumer via context. Creating
 * the store inside a component body would reset all stats on every re-render,
 * and creating one per consumer would give the scene and the inspector two
 * different views of the same worker — which is precisely the class of bug this
 * whole feature exists to remove.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createWorkforceStore, type WorkforceStore } from './workforceStore';
import {
  advanceFleet,
  ensureWorker,
  markError,
  markReady,
  markSaved,
  removeWorker,
  startAction,
  EMPTY_FLEET,
  type AutonomyLevel,
  type FleetAnim,
  type WorkerAnim,
} from './workforceSceneModel';
import type { ActionEvent, ActionKind } from '../../../shared/workforceActivity';

/* ------------------------------------------------------------------ */
/* the context                                                         */
/* ------------------------------------------------------------------ */

interface WorkforceFeedValue {
  store: WorkforceStore;
}

const FeedContext = createContext<WorkforceFeedValue | null>(null);

export interface WorkforceProviderProps {
  children: ReactNode;
  /** override the transport (tests, replay). Defaults to the real IPC feed. */
  subscribe?: (handler: (events: ActionEvent[]) => void) => (() => void) | void;
}

/**
 * Owns the store and feeds it. Wrap the scene (and anything else that reads
 * workforce data) in this exactly once.
 */
export function WorkforceProvider({ children, subscribe }: WorkforceProviderProps) {
  const store = useMemo(() => createWorkforceStore(), []);
  const value = useMemo(() => ({ store }), [store]);

  useEffect(() => {
    const sub =
      subscribe ??
      ((handler: (events: ActionEvent[]) => void) => {
        const api = (globalThis as any).deskflowAPI;
        if (!api?.onWorkforceEvent) return undefined;
        return api.onWorkforceEvent(handler);
      });
    const unsub = sub((events) => store.ingest(events));
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [store, subscribe]);

  return createElement(FeedContext.Provider, { value }, children);
}

function useFeedStore(): WorkforceStore {
  const ctx = useContext(FeedContext);
  if (!ctx) {
    // A missing provider is a wiring mistake, not a runtime condition. Throwing
    // here surfaces it at the component that forgot the wrapper, instead of a
    // scene that silently renders nothing forever.
    throw new Error('useWorkforceFeed must be used inside <WorkforceProvider>');
  }
  return ctx.store;
}

/* ------------------------------------------------------------------ */
/* store subscription                                                  */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to the store. Uses `useSyncExternalStore` so the value is always
 * consistent with what the store holds — reading `store.getState()` during
 * render without this produces tearing under concurrent rendering.
 */
export function useWorkforceStats() {
  const store = useFeedStore();
  // The store replaces its state object on every batch, so identity comparison
  // is both correct and cheap. Reading getState() during render without this
  // tears under concurrent rendering — the scene would show last batch's ring
  // next to this batch's stats.
  return useSyncExternalStore(
    (cb: () => void) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
}

/* ------------------------------------------------------------------ */
/* lifecycle feed                                                      */
/* ------------------------------------------------------------------ */

export interface WorkforceSessionLike {
  id: string;
  agent?: string | null;
  status?: string | null;
  topic?: string | null;
  terminalId?: string | null;
  /** Conductor only — the autonomy level behind the lanyard (§8.6) */
  autonomy?: number | null;
}

/**
 * Drive the animation machine from the store.
 *
 * Registers one worker per live session (plan §6), applies `agent:ready` /
 * `agent:timeout` / close to the right worker, and runs the tick loop.
 *
 * The tick is a real `requestAnimationFrame` loop rather than a setInterval so
 * it pauses automatically when the tab is hidden — a hidden tab burning a 60 Hz
 * loop while 10 other agents work is how this box's node count climbs.
 *
 * §8.9: the RAF loop only re-renders when the fleet actually changed. The
 * reference re-sorted and re-appended every node every frame; here the sort key
 * is quantised to whole tiles (`depthBucket`), so a worker that is merely
 * animating in place does not reorder the DOM.
 */
export function useWorkforceAnimation(
  sessions: WorkforceSessionLike[],
  opts: { reducedMotion?: boolean; onSelect?: (sessionId: string) => void } = {},
) {
  const store = useFeedStore();
  const [, bump] = useState(0);
  const fleetRef = useRef<FleetAnim>(EMPTY_FLEET);
  const queueRef = useRef<Record<string, ActionEvent[]>>({});
  const seenRef = useRef<Set<string>>(new Set());
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // -- register / unregister workers when the session list changes --------
  useEffect(() => {
    let f = fleetRef.current;
    const live = new Set<string>();

    sessions.forEach((s, i) => {
      if (!s?.id) return;
      live.add(s.id);
      const level: AutonomyLevel =
        s.autonomy === 1 || s.autonomy === 2 || s.autonomy === 3 ? s.autonomy : null;
      const before = f;
      f = ensureWorker(f, { sessionId: s.id, autonomy: level }, i);
      if (f !== before) seenRef.current.add(s.id);
    });

    // Closed sessions become dim ghosts (§6) rather than vanishing, but a
    // session that is gone AND was never seen is dropped so a stale id cannot
    // haunt the floor forever.
    for (const id of Array.from(seenRef.current)) {
      if (live.has(id)) continue;
      if (fleetRef.current.workers[id]?.lifecycle === 'idle') {
        f = markSaved(f, id);
      } else if (seenRef.current.size > 40) {
        f = removeWorker(f, id);
        seenRef.current.delete(id);
      }
    }
    fleetRef.current = f;
  }, [sessions]);

  // -- lifecycle events ---------------------------------------------------
  useEffect(() => {
    const api = (globalThis as any).deskflowAPI;
    if (!api) return;
    const offReady = api.onAgentReady?.((d: { terminalId: string }) => {
      const id = sessionIdForTerminal(sessions, d.terminalId);
      if (id) fleetRef.current = markReady(fleetRef.current, id);
    });
    const offTimeout = api.onAgentTimeout?.((d: { terminalId: string }) => {
      const id = sessionIdForTerminal(sessions, d.terminalId);
      if (id) fleetRef.current = markError(fleetRef.current, id);
    });
    return () => {
      offReady?.();
      offTimeout?.();
    };
  }, [sessions]);

  // -- the tick -----------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let running = true;

    const loop = (t: number) => {
      if (!running) return;
      const dt = Math.min(50, t - last);
      last = t;

      // 1. drain new events into queued actions (§8.3: queue of 3, drop oldest)
      let queuedThisFrame = false;
      const state = store.getState();
      for (const ev of state.lastEvent ? Object.values(state.lastEvent) : []) {
        const q = queueRef.current[ev.sessionId] ?? [];
        if (q[q.length - 1]?.ts === ev.ts) continue; // already queued
        q.push(ev);
        queuedThisFrame = true;
        if (q.length > 3) q.shift();
        queueRef.current[ev.sessionId] = q;
      }

      // 2. try to start an action for every idle worker with a queued event
      let f = fleetRef.current;
      for (const id of Object.keys(f.workers)) {
        const w = f.workers[id];
        if (w.phase !== 'idle') continue;
        const q = queueRef.current[id];
        if (!q || !q.length) continue;
        const ev = q[0];
        const next = startAction(f, id, ev, t);
        if (next !== f) {
          f = next;
          q.shift();
        } else if (ev.kind === 'blocked') {
          // The bell is occupied. Do NOT spin: requeue and retry next tick, so a
          // blocked prompt is never silently dropped when two agents need a
          // human at once.
          q.unshift(ev);
        }
      }

      // 3. advance
      f = advanceFleet(f, dt, t, {
        speed: optsRef.current.reducedMotion ? Number.POSITIVE_INFINITY : 2.4,
      });
      fleetRef.current = f;

      // ── Only re-render when the scene can actually look different ──────
      // This bump() used to fire unconditionally on EVERY frame, forcing a
      // full re-render of the isometric SVG tree at 60 Hz even when every
      // worker was parked at its tile doing nothing. When the fleet is
      // settled -- nobody walking (x===tx, y===ty), nobody acting (act===null)
      // -- the rendered output is byte-identical to the previous frame, so the
      // render is pure waste.
      //
      // The loop still runs (so a queued event is picked up on the very next
      // frame) and still advances the phase timers; it just does not publish a
      // state change for a frame that changed nothing. This is the difference
      // between an idle workspace costing ~0 renders/second and costing a
      // constant 60 it can never use.
      let sceneMoved = false;
      for (const w of Object.values(f.workers)) {
        if (w.act !== null || w.x !== w.tx || w.y !== w.ty) { sceneMoved = true; break; }
      }
      if (sceneMoved || queuedThisFrame) bump((n) => (n + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [store]);

  return fleetRef.current;
}

function sessionIdForTerminal(sessions: WorkforceSessionLike[], terminalId: string): string | null {
  const hit = sessions.find((s) => s.terminalId === terminalId);
  return hit?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* selectors                                                           */
/* ------------------------------------------------------------------ */

/** Workers ordered for painter's-algorithm rendering. */
export function orderedWorkers(fleet: FleetAnim): WorkerAnim[] {
  return Object.values(fleet.workers).sort((a, b) => a.depth - b.depth);
}

/** Workers that should be visible: live plus saved ghosts (§6). */
export function visibleWorkers(fleet: FleetAnim): WorkerAnim[] {
  return orderedWorkers(fleet).filter((w) => w.lifecycle !== 'error' || w.act);
}

/** The worker whose badge is worth surfacing in the scene header: blocked first. */
export function escalationWorker(fleet: FleetAnim): WorkerAnim | null {
  const workers = Object.values(fleet.workers);
  return workers.find((w) => w.lifecycle === 'blocked') ?? null;
}

/** The action badge for a worker, or null when we have no signal (§8.4). */
export function badgeFor(w: WorkerAnim): ActionKind | null {
  if (w.lifecycle === 'saved' || w.lifecycle === 'booting') return null;
  return w.act;
}
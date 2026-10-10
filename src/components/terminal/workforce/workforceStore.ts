/**
 * workforceStore.ts — the renderer half of the contract. Pure reducer plus a
 * tiny subscribe-able store so the scene and the inspector read ONE value.
 *
 * Per integration plan §4 this is MEMORY ONLY. Nothing here writes to the
 * database. Transcripts are already persisted by main.ts's existing
 * `flushTranscriptToDb` path — a second persistence route would double-write
 * the same lines.
 *
 * Why a store and not a `useState` in the scene: the event stream is batched at
 * 100 ms and a busy agent produces dozens of events per batch. A reducer inside
 * a component re-runs the whole fleet derivation on every batch and the
 * inspector re-renders with the scene. Splitting "recompute stats" from
 * "re-render" is what keeps a 14-worker scene smooth (integration plan §8.9).
 *
 * NO REACT IMPORTS. This file is plain TS so it can be exercised from a bare
 * `node` process, and so the reducer can be proven correct without a DOM.
 */

import {
  classifyAction,
  type ActionEvent,
  type ActionKind,
} from '../../../shared/workforceActivity';
import type { WorkerLifecycle } from '../../../shared/workforceActivity';

/* ------------------------------------------------------------------ */
/* §4 — the shape                                                       */
/* ------------------------------------------------------------------ */

export interface FileTouch {
  touches: number;
  added?: number;
  removed?: number;
}

export interface WorkerStats {
  /** per-ActionKind call counts. Absent kinds are absent, never 0-filled. */
  calls: Partial<Record<ActionKind, number>>;
  /** skill name → times its SKILL.md was read */
  skills: Record<string, number>;
  /** file path → touch stats. Names come from the agent; never synthesised. */
  files: Record<string, FileTouch>;
  lastCommand?: string;
  /**
   * Last exit code. `undefined` means "the agent never printed one" — the
   * inspector must render `?`, not `0` (integration plan §5).
   */
  lastExit?: number;
  /** Ring buffer of the last 30 events, newest first. */
  recent: ActionEvent[];
}

export type WorkforceStats = Record<string, WorkerStats>;

export const EMPTY_WORKER_STATS: WorkerStats = {
  calls: {},
  skills: {},
  files: {},
  recent: [],
};

/** Ring buffer bound from integration plan §4. */
export const RECENT_LIMIT = 30;

/**
 * Extract a skill name from a read path.
 * Tolerates both separators because a Windows agent prints `agent\skills\x`.
 */
export function skillFromPath(target: string | undefined): string | undefined {
  if (!target) return undefined;
  const m = target.match(/skills[\\/]([^\\/]+)[\\/]SKILL\.md/i);
  return m ? m[1] : undefined;
}

/* ------------------------------------------------------------------ */
/* §4 — the reducer                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fold one event into the fleet stats. PURE: same input, same output, no
 * mutation of the argument.
 *
 * Every field is derived from something the agent actually printed. In
 * particular `counts.added/removed` only move when the agent printed a diff
 * stat — there is no `git diff` here on purpose, because guessing a line
 * count would put a wrong number in front of the user (plan §5).
 */
export function reduce(s: WorkforceStats, ev: ActionEvent): WorkforceStats {
  const prev = s[ev.sessionId] ?? EMPTY_WORKER_STATS;

  // counts
  const calls: Partial<Record<ActionKind, number>> = {
    ...prev.calls,
    [ev.kind]: (prev.calls[ev.kind] ?? 0) + 1,
  };

  // skills — a read of agent/skills/<name>/SKILL.md. No extra capture needed.
  const skill = skillFromPath(ev.target);
  const skills = skill
    ? { ...prev.skills, [skill]: (prev.skills[skill] ?? 0) + 1 }
    : prev.skills;

  // files — only `edit` events name a file we know was modified.
  let files = prev.files;
  if (ev.kind === 'edit' && ev.target) {
    const f = prev.files[ev.target] ?? { touches: 0 };
    files = {
      ...prev.files,
      [ev.target]: {
        touches: f.touches + 1,
        added: (f.added ?? 0) + (ev.counts?.added ?? 0),
        removed: (f.removed ?? 0) + (ev.counts?.removed ?? 0),
      },
    };
  }

  return {
    ...s,
    [ev.sessionId]: {
      calls,
      skills,
      files,
      // `?? prev` rather than a truthy test: an agent that legitimately printed
      // exit code 0 must not clear the previous run's failure.
      lastCommand: ev.command ?? prev.lastCommand,
      lastExit: ev.exitCode ?? prev.lastExit,
      recent: [ev, ...prev.recent].slice(0, RECENT_LIMIT),
    },
  };
}

/** Fold a batch (what actually arrives over IPC). */
export function reduceAll(s: WorkforceStats, evs: ActionEvent[]): WorkforceStats {
  let out = s;
  for (const ev of evs) out = reduce(out, ev);
  return out;
}

/** Drop sessions that are no longer present (terminal closed and pruned). */
export function prune(s: WorkforceStats, liveIds: Iterable<string>): WorkforceStats {
  const keep = new Set(liveIds);
  let changed = false;
  const out: WorkforceStats = {};
  for (const [id, w] of Object.entries(s)) {
    if (keep.has(id)) out[id] = w;
    else changed = true;
  }
  return changed ? out : s;
}

/* ------------------------------------------------------------------ */
/* fleet roll-ups (plan §5 "never show a made up number")              */
/* ------------------------------------------------------------------ */

export interface FleetTotals {
  /** number of sessions we have seen at least one event from */
  workers: number;
  totalCalls: number;
  totalTokens: number;
  /**
   * True only when at least one session actually printed a token count.
   * The inspector renders "unknown" when this is false — showing 0 would be a
   * fabricated number.
   */
  tokensKnown: boolean;
  calls: Partial<Record<ActionKind, number>>;
}

export function fleetTotals(s: WorkforceStats): FleetTotals {
  let totalCalls = 0;
  let totalTokens = 0;
  let tokensKnown = false;
  const calls: Partial<Record<ActionKind, number>> = {};

  for (const w of Object.values(s)) {
    for (const [k, v] of Object.entries(w.calls)) {
      const kind = k as ActionKind;
      calls[kind] = (calls[kind] ?? 0) + (v as number);
      totalCalls += v as number;
    }
    // `recent` is the only place a printed token count survives the ring, so
    // sum what each session actually printed within it.
    for (const ev of w.recent) {
      if (typeof ev.tokens === 'number') {
        totalTokens += ev.tokens;
        tokensKnown = true;
      }
    }
  }

  return { workers: Object.keys(s).length, totalCalls, totalTokens, tokensKnown, calls };
}

/* ------------------------------------------------------------------ */
/* §6 — lifecycle                                                       */
/* ------------------------------------------------------------------ */

export interface LifecycleInput {
  /** PTY spawned, `terminal:ready` not yet seen */
  booting?: boolean;
  /** `agent:ready` received */
  ready?: boolean;
  /** `agent:timeout` */
  timeout?: boolean;
  /** terminal closed and the session was saved */
  closed?: boolean;
}

export function deriveLifecycle(i: LifecycleInput): WorkerLifecycle {
  if (i.closed) return 'saved';
  if (i.timeout) return 'error';
  if (i.booting) return 'booting';
  if (i.ready) return 'idle';
  return 'idle';
}

/**
 * Integrate plan §6: which worker state a session should be shown in, given its
 * lifecycle AND its most recent event.
 *
 * `no signal ⇒ idle pose and no badge` is a hard rule (plan §8.4): we do not
 * invent activity. A worker whose last event was 90 seconds ago is idle, even
 * though its ring buffer is full of old calls.
 */
export function workerStateFrom(
  lifecycle: WorkerLifecycle,
  lastEvent: ActionEvent | undefined,
  nowMs: number,
  opts: { staleAfterMs?: number } = {},
): {
  ring: 'working' | 'thinking' | 'blocked' | 'error' | 'idle' | 'saved';
  badge: ActionKind | null;
} {
  const staleAfter = opts.staleAfterMs ?? 8000;

  if (lifecycle === 'saved') return { ring: 'saved', badge: null };
  if (lifecycle === 'error') return { ring: 'error', badge: null };
  if (lifecycle === 'booting') return { ring: 'idle', badge: null };

  if (!lastEvent) return { ring: 'idle', badge: null };

  // Exit code 0 is the ONLY success signal we accept. Absent ⇒ unknown ⇒ we do
  // not claim success and we do not claim failure.
  if (lastEvent.exitCode !== undefined && lastEvent.exitCode !== 0) {
    return { ring: 'error', badge: null };
  }
  if (lastEvent.kind === 'blocked') return { ring: 'blocked', badge: 'blocked' };
  if (nowMs - lastEvent.ts > staleAfter) return { ring: 'idle', badge: null };
  if (lastEvent.kind === 'think' || lastEvent.kind === 'plan') {
    return { ring: 'thinking', badge: lastEvent.kind };
  }
  return { ring: 'working', badge: lastEvent.kind };
}

/* ------------------------------------------------------------------ */
/* the store                                                            */
/* ------------------------------------------------------------------ */

/** A read-only cross-session file lock, piped in from the live sync context. */
export interface FileLockInfo {
  path: string;
  sessionId: string;
  acquiredAt?: number;
}

export interface WorkforceStoreState {
  stats: WorkforceStats;
  /** last event per session — what the ring and badge are derived from */
  lastEvent: Record<string, ActionEvent>;
  /** read-only cross-session file locks (plan §5, Configs tab source) */
  locks: FileLockInfo[];
}

export const EMPTY_STORE_STATE: WorkforceStoreState = {
  stats: {},
  lastEvent: {},
  locks: [],
};

export interface WorkforceStore {
  getState(): WorkforceStoreState;
  subscribe(listener: () => void): () => void;
  /** fold one event, or a batch */
  ingest(ev: ActionEvent | ActionEvent[]): void;
  /** replace the live file-lock list (read-only from the sync context) */
  setLocks(locks: FileLockInfo[]): void;
  /** forget sessions that are gone */
  retainOnly(ids: Iterable<string>): void;
  reset(): void;
}

/**
 * Minimal subscribe-able store. Listeners are notified with the new state; no
 * selector machinery, no equality checks, no React. Deliberately dull.
 */
export function createWorkforceStore(initial: WorkforceStoreState = EMPTY_STORE_STATE): WorkforceStore {
  let state = initial;
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const l of listeners) {
      try {
        l();
      } catch {
        /* one bad listener must not stop the others */
      }
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ingest(ev) {
      const evs = Array.isArray(ev) ? ev : [ev];
      if (!evs.length) return;

      let changed = false;
      let stats = state.stats;
      const lastEvent = { ...state.lastEvent };
      for (const e of evs) {
        // Defensive: a malformed event from an older/newer build must not
        // poison the whole fleet view.
        if (!e || typeof e.sessionId !== 'string' || !e.sessionId) continue;
        const kind = e.kind ?? classifyAction({ tool: e.tool, command: e.command, target: e.target });
        if (!kind) continue;
        const normalised: ActionEvent = { ...e, kind };
        stats = reduce(stats, normalised);
        lastEvent[normalised.sessionId] = normalised;
        changed = true;
      }
      if (!changed) return;
      state = { ...state, stats, lastEvent };
      emit();
    },
    setLocks(locks) {
      state = { ...state, locks: locks ?? [] };
      emit();
    },
    retainOnly(ids) {
      const keep = new Set(ids);
      const nextStats: WorkforceStats = {};
      const nextLast: Record<string, ActionEvent> = {};
      let changed = false;
      for (const [id, w] of Object.entries(state.stats)) {
        if (keep.has(id)) nextStats[id] = w;
        else changed = true;
      }
      for (const [id, e] of Object.entries(state.lastEvent)) {
        if (keep.has(id)) nextLast[id] = e;
        else changed = true;
      }
      if (!changed) return;
      state = { ...state, stats: nextStats, lastEvent: nextLast };
      emit();
    },
    reset() {
      state = { ...EMPTY_STORE_STATE, locks: state.locks };
      emit();
    },
  };
}

/* ------------------------------------------------------------------ */
/* display formatting                                                  */
/* ------------------------------------------------------------------ */

/**
 * Format a token count. Returns 'unknown' when the agent never printed one —
 * never '0', because 0 is a claim we cannot support (plan §5).
 */
export function formatTokens(tokens: number | undefined, known: boolean): string {
  if (!known || typeof tokens !== 'number' || !Number.isFinite(tokens)) return 'unknown';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

/** Exit code for display. '?' when the agent never printed one. */
export function formatExit(code: number | undefined): string {
  return typeof code === 'number' ? String(code) : '?';
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  }
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
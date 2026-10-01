/**
 * useVisualAgents.ts — the only place that turns RHEO data into render data.
 *
 *   sessions (existing state)  ─┐
 *   phases prop (optional)     ─┼─→  VisualAgent[]  (+ seat assignments)
 *   subscribe feed (optional)  ─┘
 *
 * Event priority per spec §18: specific agent:* phase events refine the
 * session-status-derived state. Without a feed, the hook still works purely
 * from session records — no provider needs advanced telemetry first.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMY_HOMES, StationAllocator, TIERS, tierForCount, type Tier, type TierId } from './workforceLayout';
import {
  deriveVisualState,
  normalizeAgentId,
  type AgentPhaseInput,
  type AgentSessionInput,
  type PhaseMap,
  type VisualAgent,
} from './workforceTypes';

export interface AgentSessionSeed {
  id: string;
  agent: string;
  known: boolean;
  topic: string | null;
  terminalId: string | null;
  status: string | null;
}

export interface UseVisualAgentsResult {
  /** workers with seats, ordered back row → front row for stable DOM/z paint */
  agents: Array<VisualAgent & { station: number }>;
  /** sessions that exist but ran out of seats (shown as a "+N" chip) */
  hiddenCount: number;
  /** active-ish worker count for the scene header */
  activeCount: number;
  /** active layout tier (roomy / dense / swarm) */
  tier: Tier;
}

export interface UseVisualAgentsOptions {
  sessions: AgentSessionInput[] | undefined;
  /** controlled phase overlay, keyed by sessionId or terminalId */
  phases?: PhaseMap;
  /**
   * optional live feed adapter. Return an unsubscribe function.
   * Events may be raw IPC payloads — normalizePhaseEvent below is tolerant
   * of the documented shapes; adjust it if your payloads differ.
   */
  subscribe?: (handler: (event: unknown) => void) => (() => void) | void;
}

/* ------------------------------------------------------------------ */
/* tolerant event normalization (documented agent:* event vocabulary)  */
/* ------------------------------------------------------------------ */

interface NormalizedPhaseEvent {
  keys: string[];
  input: AgentPhaseInput;
}

function pick(obj: Record<string, unknown>, names: string[]): unknown {
  for (const n of names) {
    const v = obj[n];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Maps a raw agent event onto { keys, phase input }. `keys` are the ids the
 * phase should be stored under (sessionId and/or terminalId).
 *
 * Known event names (from RHEO's agent detector):
 *   agent:ready, agent:idle, agent:timeout, agent:init-error,
 *   agent:write-verified, agent:write-failed, agent:status
 */
export function normalizePhaseEvent(raw: unknown): NormalizedPhaseEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const sessionRaw = pick(e, ['sessionId', 'session_id', 'id']);
  const terminalRaw = pick(e, ['terminalId', 'terminal_id', 'terminal']);
  const keys: string[] = [];
  if (typeof sessionRaw === 'string' && sessionRaw) keys.push(sessionRaw);
  else if (typeof sessionRaw === 'number') keys.push(String(sessionRaw));
  if (typeof terminalRaw === 'string' && terminalRaw) keys.push(terminalRaw);
  else if (typeof terminalRaw === 'number') keys.push(String(terminalRaw));
  if (keys.length === 0) return null;

  const typeRaw = pick(e, ['type', 'event', 'channel', 'kind']);
  let type = typeof typeRaw === 'string' ? typeRaw.toLowerCase() : '';
  if (type.startsWith('agent:')) type = type.slice('agent:'.length);

  const phaseRaw = pick(e, ['phase', 'status', 'state']);
  const activityRaw = pick(e, ['activity', 'tool', 'action', 'toolName']);
  const topicRaw = pick(e, ['topic', 'title']);

  let phase: string | null =
    typeof phaseRaw === 'string' ? phaseRaw.toLowerCase() : null;

  // event name itself carries the phase for the fixed detector events
  const NAME_MAP: Record<string, string> = {
    ready: 'ready',
    idle: 'idle',
    timeout: 'timeout',
    'init-error': 'init-error',
    'write-verified': 'write-verified',
    'write-failed': 'write-failed',
  };
  if (NAME_MAP[type]) phase = NAME_MAP[type];
  // agent:status → trust the payload phase/status field

  if (!phase && !NAME_MAP[type]) return null;

  return {
    keys,
    input: {
      phase,
      activity: typeof activityRaw === 'string' ? activityRaw : null,
      topic: typeof topicRaw === 'string' ? topicRaw : null,
    },
  };
}

function samePhase(a: AgentPhaseInput | undefined, b: AgentPhaseInput): boolean {
  return (
    !!a && a.phase === b.phase && a.activity === b.activity && a.topic === b.topic
  );
}

/* ------------------------------------------------------------------ */
/* hook                                                                */
/* ------------------------------------------------------------------ */

export function useVisualAgents({
  sessions,
  phases,
  subscribe,
}: UseVisualAgentsOptions): UseVisualAgentsResult {
  // live feed (only used when no controlled `phases` prop is supplied)
  const [feedPhases, setFeedPhases] = useState<PhaseMap>({});

  useEffect(() => {
    if (!subscribe) return;
    const handler = (event: unknown) => {
      const norm = normalizePhaseEvent(event);
      if (!norm) return;
      setFeedPhases((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const key of norm.keys) {
          if (!samePhase(next[key], norm.input)) {
            next[key] = norm.input;
            changed = true;
          }
        }
        return changed ? next : prev; // duplicate events → no re-render
      });
    };
    const unsub = subscribe(handler);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [subscribe]);

  const effectivePhases = phases ?? feedPhases;
  const allocatorRef = useRef<StationAllocator | null>(null);
  if (!allocatorRef.current) allocatorRef.current = new StationAllocator();
  const tierRef = useRef<TierId>('roomy');
  // stable per-type instance numbers (never re-used while mounted)
  const tagsRef = useRef<Map<string, number>>(new Map());
  const tagCountersRef = useRef<Record<string, number>>({});

  return useMemo(() => {
    // 1 — normalize + filter to agent sessions (plain terminals get no worker)
    const seeds: AgentSessionSeed[] = [];
    for (const s of sessions ?? []) {
      if (!s || typeof s.id !== 'string' || !s.id) continue;
      const hasPhase =
        !!effectivePhases[s.id] ||
        (s.terminalId != null && !!effectivePhases[String(s.terminalId)]);
      const { id: agent, known } = normalizeAgentId(s.agent);
      if (!s.agent && !hasPhase) continue; // not an agent session
      seeds.push({
        id: s.id,
        agent,
        known,
        topic: typeof s.topic === 'string' && s.topic ? s.topic : null,
        terminalId: s.terminalId == null ? null : String(s.terminalId),
        status: typeof s.status === 'string' ? s.status : null,
      });
    }

    // per-type instance counts + stable tags
    const typeCounts: Record<string, number> = {};
    for (const s of seeds) typeCounts[s.agent] = (typeCounts[s.agent] ?? 0) + 1;
    const tags = tagsRef.current;
    for (const id of Array.from(tags.keys())) {
      if (!seeds.some((s) => s.id === id)) tags.delete(id);
    }
    for (const s of seeds) {
      if (!tags.has(s.id)) {
        const counters = tagCountersRef.current;
        counters[s.agent] = (counters[s.agent] ?? 0) + 1;
        tags.set(s.id, counters[s.agent]);
      }
    }

    // 2 — layout tier (hysteresis, iterated to a fixed point so a fresh
    // mount with 14 sessions lands straight on swarm, not dense+overflow)
    let tierId = tierRef.current;
    for (let i = 0; i < 4; i++) {
      const next = tierForCount(seeds.length, tierId);
      if (next === tierId) break;
      tierId = next;
    }
    tierRef.current = tierId;
    const tier = TIERS[tierId];
    const seatMap = allocatorRef.current!.assign(
      seeds.map((s) => ({
        sessionId: s.id,
        home: ROOMY_HOMES[s.agent] ?? -1,
      })),
      tier,
    );

    // 3 — derive visual state (phase events refine session status)
    const seated: Array<VisualAgent & { station: number }> = [];
    let hiddenCount = 0;
    let activeCount = 0;

    for (const s of seeds) {
      const station = seatMap.get(s.id) ?? -1;
      if (station < 0 || station >= tier.seats.length) {
        hiddenCount++;
        continue;
      }
      const phaseEntry =
        effectivePhases[s.id] ??
        (s.terminalId != null ? effectivePhases[s.terminalId] : undefined);
      const { state, activity } = deriveVisualState(
        s.status,
        phaseEntry?.phase,
        phaseEntry?.activity,
      );
      if (state === 'busy' || state === 'thinking') activeCount++;
      seated.push({
        key: s.id,
        sessionId: s.id,
        terminalId: s.terminalId,
        agent: s.agent,
        known: s.known,
        state,
        activity,
        topic: phaseEntry?.topic ?? s.topic,
        tag: tags.get(s.id) ?? 1,
        multi: (typeCounts[s.agent] ?? 0) > 1,
        station,
      });
    }

    // paint order: back rows first, then benches, then front (stable within row)
    seated.sort((a, b) => a.station - b.station);

    return { agents: seated, hiddenCount, activeCount, tier };
    // allocator/tags/tier are mutable refs but deterministic given inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, effectivePhases]);
}

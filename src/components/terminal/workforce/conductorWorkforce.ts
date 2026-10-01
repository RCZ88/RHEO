/**
 * conductorWorkforce.ts — bridges RHEO's Conductor (the multi-agent
 * orchestrator that assigns coworkers/subagents) into the Agent Workforce
 * visualization's provider-neutral VisualAgent model.
 *
 * WHY THIS FILE EXISTS
 * The workforce renderer knows nothing about missions, roles or autonomy. The
 * Conductor knows everything about them but only exposes `summarize()` (mission
 * level) through IPC. This module is the single place that flattens
 *
 *     terminal_sessions rows   (what the workforce hook already consumes)
 *   + conductor mission nodes  (role / hierarchy / autonomy)
 *   + conductor status         (running / blocked / awaiting-review / …)
 *
 * into one list, so the scene can show a worker *and* what it is doing in the
 * org: which mission it belongs to, its role, and its depth in the tree.
 *
 * It stays pure: no IPC, no store, no React. Callers pass already-fetched data.
 */

import {
  deriveVisualState,
  normalizeAgentId,
  type ActivityKind,
  type VisualState,
} from './workforceTypes';

/** Mirrors ConductorStatus in src/services/conductor/ConductorService.ts */
export type ConductorStatus =
  | 'pending'
  | 'spawning'
  | 'running'
  | 'blocked'
  | 'awaiting-review'
  | 'done'
  | 'failed'
  | 'killed';

/** Mirrors ConductorRole in the service — kept as a string union for safety. */
export type ConductorRole =
  | 'director'
  | 'planner'
  | 'worker'
  | 'qa'
  | 'auditor'
  | 'resolver';

export interface ConductorNodeInput {
  id: string;
  missionId: string;
  parentId: string | null;
  role: ConductorRole | string;
  agentType: string;
  terminalId: string;
  objective?: string;
  status: ConductorStatus | string;
  depth?: number;
  retries?: number;
  boundaries?: string[];
  createdAt?: number;
  lastActivityAt?: number;
}

export interface ConductorMissionInput {
  id: string;
  objective?: string;
  status?: string;
  autonomyLevel?: string;
  nodeCount?: number;
  activeCount?: number;
  pendingEscalations?: number;
}

/** One worker row handed to the scene. */
export interface WorkforceWorker {
  /** stable key — conductor node id when present, else the session id */
  key: string;
  sessionId: string | null;
  terminalId: string | null;
  agent: string;
  known: boolean;
  state: VisualState;
  activity: ActivityKind;
  topic: string | null;
  tag: number;
  multi: boolean;

  // ── conductor enrichment (absent for non-conductor terminals) ────────────
  /** true when this worker is a Conductor coworker rather than a plain terminal */
  conductor: boolean;
  missionId: string | null;
  missionObjective: string | null;
  role: ConductorRole | string | null;
  /** 0 for the director, increasing for children; null when unknown */
  depth: number | null;
  parentId: string | null;
  autonomyLevel: string | null;
  /** true when the mission is holding an escalation the human must resolve */
  needsEscalation: boolean;
}

/**
 * Conductor status → workforce visual state.
 *
 * Note the two states the Conductor has that a session has no equivalent for:
 *   blocked         → 'attention'  (a human has to unblock it)
 *   awaiting-review → 'attention'  (a human has to approve it)
 * Collapsing both to attention is deliberate: the workforce has no
 * "waiting-on-review" glyph, and 'attention' already means "this needs you".
 */
export function conductorStatusToVisualState(status: string | null | undefined): VisualState {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'pending':     return 'launching';
    case 'spawning':    return 'launching';
    case 'running':     return 'busy';
    case 'blocked':     return 'attention';
    case 'awaiting-review': return 'attention';
    case 'done':        return 'completed';
    case 'failed':      return 'error';
    case 'killed':      return 'inactive';
    default:            return 'idle';
  }
}

/** Conduct or role → the activity the activity strip should show. */
export function conductorRoleToActivity(role: string | null | undefined): ActivityKind {
  switch ((role ?? '').trim().toLowerCase()) {
    case 'auditor':  return 'research';
    case 'planner':  return 'thinking';
    case 'resolver': return 'terminal';
    default:         return 'working';
  }
}

/** Human label for a conductor status — the scene shows this, not the raw enum. */
export function conductorStatusWord(status: string | null | undefined): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'pending':         return 'queued';
    case 'spawning':        return 'booting';
    case 'running':         return 'working';
    case 'blocked':         return 'blocked';
    case 'awaiting-review': return 'needs review';
    case 'done':            return 'done';
    case 'failed':          return 'failed';
    case 'killed':          return 'stopped';
    default:                return 'idle';
  }
}

/**
 * Per-agent-type instance numbering, so two workers of the same agent get the
 * OC·1 / OC·2 badge the way the base workforce renderer does.
 */
function tagAgents(workers: WorkforceWorker[]): WorkforceWorker[] {
  const counters: Record<string, number> = {};
  const totals: Record<string, number> = {};
  for (const w of workers) totals[w.agent] = (totals[w.agent] ?? 0) + 1;

  // Stable ordering: conductor workers first (they have structure worth showing),
  // then plain terminals — keeps seat assignment from reshuffling on phase change.
  const ordered = [...workers].sort((a, b) => {
    if (a.conductor !== b.conductor) return a.conductor ? -1 : 1;
    if (a.conductor && b.conductor) {
      const da = a.depth ?? 99;
      const db = b.depth ?? 99;
      if (da !== db) return da - db;
      return a.key.localeCompare(b.key);
    }
    return a.key.localeCompare(b.key);
  });

  for (const w of ordered) {
    counters[w.agent] = (counters[w.agent] ?? 0) + 1;
    w.tag = counters[w.agent];
    w.multi = (totals[w.agent] ?? 0) > 1;
  }
  return ordered;
}

export interface BuildWorkforceInput {
  /** terminal_sessions rows the page already holds */
  sessions: Array<{
    id: string;
    agent?: string | null;
    status?: string | null;
    topic?: string | null;
    terminal_id?: string | null;
  }>;
  /** conductor nodes, from conductor:get-snapshot */
  nodes?: ConductorNodeInput[];
  /** conductor missions, from conductor:list-missions */
  missions?: ConductorMissionInput[];
  /** currently focused terminal id, so the scene can highlight it */
  activeTerminalId?: string | null;
}

/**
 * Build the merged worker list.
 *
 * Precedence, highest first:
 *   1. a conductor node — it is authoritative about state (running/blocked) and
 *      carries the role + hierarchy the session row does not have
 *   2. a terminal_sessions row — normal agent lifecycle
 *   3. nothing — a plain shell terminal is deliberately NOT a worker
 *
 * A terminal that has both a session row and a conductor node is emitted ONCE,
 * as the conductor version. Duplicating it would show the same PTY twice.
 */
export function buildWorkforceWorkers({
  sessions,
  nodes = [],
  missions = [],
  activeTerminalId = null,
}: BuildWorkforceInput): WorkforceWorker[] {
  const missionById = new Map(missions.map((m) => [m.id, m]));
  const workers: WorkforceWorker[] = [];
  const consumedTerminals = new Set<string>();

  // ── 1. conductor coworkers ────────────────────────────────────────────────
  for (const node of nodes) {
    if (!node || !node.id) continue;
    const { id: agent, known } = normalizeAgentId(node.agentType);
    // The conductor's own status wins over the session row's status.
    const state = conductorStatusToVisualState(node.status);
    const activity =
      state === 'busy' ? conductorRoleToActivity(node.role) : 'none';

    workers.push({
      key: `conductor:${node.id}`,
      sessionId: null,
      terminalId: node.terminalId ?? null,
      agent,
      known,
      state,
      activity,
      topic: node.objective || null,
      tag: 1,
      multi: false,
      conductor: true,
      missionId: node.missionId ?? null,
      missionObjective: node.missionId
        ? missionById.get(node.missionId)?.objective ?? null
        : null,
      role: node.role ?? null,
      depth: typeof node.depth === 'number' ? node.depth : null,
      parentId: node.parentId ?? null,
      autonomyLevel: node.missionId
        ? missionById.get(node.missionId)?.autonomyLevel ?? null
        : null,
      needsEscalation:
        (missionById.get(node.missionId ?? '')?.pendingEscalations ?? 0) > 0,
    });

    if (node.terminalId) consumedTerminals.add(String(node.terminalId));
  }

  // ── 2. plain agent sessions (skip ones already shown as conductor workers) ─
  for (const s of sessions ?? []) {
    if (!s || typeof s.id !== 'string' || !s.id) continue;
    const terminalId = s.terminal_id == null ? null : String(s.terminal_id);
    if (terminalId && consumedTerminals.has(terminalId)) continue;

    const { id: agent, known } = normalizeAgentId(s.agent);
    // No agent AND no conductor node → a plain shell terminal, not a worker.
    if (!s.agent && !known) continue;

    const { state, activity } = deriveVisualState(s.status, null, null);
    workers.push({
      key: `session:${s.id}`,
      sessionId: s.id,
      terminalId,
      agent,
      known,
      state,
      activity,
      topic: typeof s.topic === 'string' && s.topic ? s.topic : null,
      tag: 1,
      multi: false,
      conductor: false,
      missionId: null,
      missionObjective: null,
      role: null,
      depth: null,
      parentId: null,
      autonomyLevel: null,
      needsEscalation: false,
    });
  }

  const tagged = tagAgents(workers);

  // Focus: mark the row whose terminal is currently active.
  if (activeTerminalId) {
    for (const w of tagged) {
      if (w.terminalId === String(activeTerminalId)) w.state = 'busy';
    }
  }

  return tagged;
}

/** Counts for a scene header: how many are working vs waiting on a human. */
export function summarizeWorkforce(workers: WorkforceWorker[]): {
  total: number;
  working: number;
  needsHuman: number;
  conductor: number;
  missions: number;
} {
  const missionIds = new Set(
    workers.map((w) => w.missionId).filter((m): m is string => !!m)
  );
  return {
    total: workers.length,
    working: workers.filter(
      (w) => w.state === 'busy' || w.state === 'thinking'
    ).length,
    needsHuman: workers.filter(
      (w) => w.state === 'attention' || w.state === 'error'
    ).length,
    conductor: workers.filter((w) => w.conductor).length,
    missions: missionIds.size,
  };
}
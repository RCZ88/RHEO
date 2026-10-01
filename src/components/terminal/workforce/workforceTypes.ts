/**
 * workforceTypes.ts — provider-neutral types + pure derivation helpers
 * for the Agent Workforce ambient visualization.
 *
 * The visual layer only ever sees these normalized shapes. Provider-specific
 * data (claude / opencode / codex / gemini / aider, IPC payload quirks) is
 * normalized here and in useVisualAgents — never inside render components.
 */

export const KNOWN_AGENT_IDS = [
  'opencode',
  'claude',
  'codex',
  'gemini',
  'aider',
] as const;

export type KnownAgentId = (typeof KNOWN_AGENT_IDS)[number];

/** Visual lifecycle states the scene can render (derived, not persisted). */
export type VisualState =
  | 'launching'
  | 'ready'
  | 'busy'
  | 'thinking'
  | 'attention'
  | 'error'
  | 'idle'
  | 'completed'
  | 'inactive';

/** Coarse activity classification — only as specific as observable data allows. */
export type ActivityKind =
  | 'coding'
  | 'research'
  | 'terminal'
  | 'thinking'
  | 'waiting'
  | 'working'
  | 'none';

/**
 * Minimal session shape the visualization needs. Structurally compatible
 * with RHEO's terminal_sessions records; extra fields are ignored.
 */
export interface AgentSessionInput {
  id: string;
  agent?: string | null;
  status?: string | null;
  topic?: string | null;
  terminalId?: string | number | null;
  /** unused by the renderer today; kept so callers can pass records as-is */
  updatedAt?: string | number | null;
}

/** Normalized phase overlay coming from agent:* events (optional refinement). */
export interface AgentPhaseInput {
  phase?: string | null;
  /** raw activity/tool hint from the event payload, classified later */
  activity?: string | null;
  topic?: string | null;
}

/** Keyed by sessionId or terminalId — lookups try both. */
export type PhaseMap = Record<string, AgentPhaseInput>;

/** One renderable worker. Everything AgentCharacter needs, nothing more. */
export interface VisualAgent {
  key: string;
  sessionId: string;
  terminalId: string | null;
  agent: string;
  known: boolean;
  state: VisualState;
  activity: ActivityKind;
  topic: string | null;
  /** per-type instance number (1-based, stable for the session's lifetime) */
  tag: number;
  /** true when more than one session of this agent type is present */
  multi: boolean;
}

export interface DerivedState {
  state: VisualState;
  activity: ActivityKind;
}

export function isKnownAgentId(agent: string): agent is KnownAgentId {
  return (KNOWN_AGENT_IDS as readonly string[]).includes(agent);
}

export function normalizeAgentId(raw: string | null | undefined): {
  id: string;
  known: boolean;
} {
  const id = (raw ?? '').trim().toLowerCase();
  return { id: id || 'unknown', known: isKnownAgentId(id) };
}

/**
 * Map a raw activity/tool hint from an event payload onto a coarse visual
 * activity. Deliberately conservative: when in doubt, we do not claim to
 * know what the agent is doing.
 */
export function classifyActivity(raw: string | null | undefined): ActivityKind | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/(wait|permission|approv|confirm|input|ask)/.test(s)) return 'waiting';
  if (/(bash|shell|exec|command|terminal|script|run)/.test(s)) return 'terminal';
  if (/(write|edit|patch|apply|create|multiedit|file)/.test(s)) return 'coding';
  if (/(read|search|grep|glob|find|list|view|browse|investigat|research|fetch)/.test(s))
    return 'research';
  if (/(think|reason|process|plan)/.test(s)) return 'thinking';
  return null;
}

function normalizePhaseString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  if (s.startsWith('agent:')) s = s.slice('agent:'.length);
  return s || null;
}

/**
 * Derive the visual state for one worker.
 *
 * Priority (per spec §18):
 *   1. specific agent phase event (agent:ready / agent:idle / agent:timeout /
 *      agent:init-error / agent:write-verified / agent:write-failed / agent:status …)
 *   2. existing session status (active / idle / completed / error / cancelled / inactive)
 *   3. generic fallback
 */
export function deriveVisualState(
  status: string | null | undefined,
  phaseRaw: string | null | undefined,
  activityRaw: string | null | undefined,
): DerivedState {
  const phase = normalizePhaseString(phaseRaw);
  const activity = classifyActivity(activityRaw);

  if (phase) {
    // -- specific event names emitted by RHEO's agent detector --
    if (phase === 'timeout' || phase === 'init-error' || phase === 'write-failed') {
      return { state: 'error', activity: 'none' };
    }
    if (phase === 'write-verified' || phase === 'idle') {
      return { state: 'idle', activity: 'none' };
    }
    if (phase === 'ready') {
      return { state: 'ready', activity: 'none' };
    }
    // -- generic phase vocabulary (agent:status payloads, forwards-compatible) --
    if (/(launch|spawn|boot|init|start)/.test(phase)) {
      return { state: 'launching', activity: 'none' };
    }
    if (/(permission|attention|needs?-?input|waiting-?input|ask)/.test(phase)) {
      return { state: 'attention', activity: activity ?? 'waiting' };
    }
    if (/(fail|error|crash|reject)/.test(phase)) {
      return { state: 'error', activity: 'none' };
    }
    if (/(complet|finish|done)/.test(phase)) {
      return { state: 'completed', activity: 'none' };
    }
    if (/(think|process|reason)/.test(phase)) {
      return { state: 'thinking', activity: 'thinking' };
    }
    if (/(busy|work|active|stream|run)/.test(phase)) {
      return { state: 'busy', activity: activity ?? 'working' };
    }
    if (/(wait)/.test(phase)) {
      return { state: 'attention', activity: 'waiting' };
    }
    if (/(cancel|inactive|closed|ended|stopped)/.test(phase)) {
      return { state: 'inactive', activity: 'none' };
    }
    // unknown phase string → fall through to session status
  }

  const s = (status ?? '').trim().toLowerCase();
  switch (s) {
    case 'active':
      // No observable tool information → generic working, never a guess.
      return { state: 'busy', activity: activity ?? 'working' };
    case 'idle':
      return { state: 'idle', activity: 'none' };
    case 'completed':
      return { state: 'completed', activity: 'none' };
    case 'error':
      return { state: 'error', activity: 'none' };
    case 'cancelled':
    case 'inactive':
      return { state: 'inactive', activity: 'none' };
    default:
      // Session exists but status is unknown/unset → present but quiet.
      return { state: 'idle', activity: 'none' };
  }
}

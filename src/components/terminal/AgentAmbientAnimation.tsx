/**
 * AgentAmbientAnimation.tsx — public entry point for the Agent Workforce
 * ambient visualization in the /terminal workspace.
 *
 * Integration is intentionally tiny: pass the session records the page
 * already has; optionally refine with live agent:* phase events.
 *
 *   <AgentAmbientAnimation sessions={sessions} onSelectSession={focusSession} />
 *
 * Data flow (spec §21):
 *   existing RHEO session / agent state
 *     → useVisualAgents (normalize + derive + seat assignment)
 *       → WorkforceScene
 *         → AgentCharacter
 *
 * The renderer never queries the database and owns no business logic.
 * Remove-ability: delete this folder + one JSX line to remove the feature.
 */

import { useVisualAgents } from './workforce/useVisualAgents';
import WorkforceScene from './workforce/WorkforceScene';
import type { SceneDensity } from './workforce/workforceLayout';
import type {
  AgentPhaseInput,
  AgentSessionInput,
  PhaseMap,
} from './workforce/workforceTypes';
import './workforce/workforce.css';

export interface AgentAmbientAnimationProps {
  /**
   * Live agent-session records (the terminal_sessions rows the page already
   * keeps in state). Non-agent terminals and null entries are ignored.
   */
  sessions?: AgentSessionInput[];

  /**
   * Optional controlled phase overlay keyed by sessionId or terminalId,
   * e.g. { [sessionId]: { phase: 'ready' } }. Use this when the page
   * already tracks agent phases in state.
   */
  phases?: PhaseMap;

  /**
   * Optional live-feed adapter for agent:* IPC events
   * (agent:ready / agent:idle / agent:timeout / agent:init-error /
   * agent:write-verified / agent:write-failed / agent:status).
   * Return an unsubscribe function. Payload shapes are normalized
   * tolerantly — see normalizePhaseEvent in useVisualAgents.ts.
   *
   * When `phases` is provided it takes precedence over the feed.
   */
  subscribeAgentEvents?: (handler: (event: unknown) => void) => (() => void) | void;

  /** currently focused terminal session, if the page knows it */
  selectedSessionId?: string | null;

  /** clicking a worker should focus/select its real terminal session */
  onSelectSession?: (sessionId: string) => void;

  /** compact (default — sidebar ambient), normal, or expanded */
  density?: SceneDensity;

  /** force reduced-motion rendering (default: prefers-reduced-motion media query) */
  reducedMotion?: boolean;

  className?: string;
}

export function AgentAmbientAnimation({
  sessions,
  phases,
  subscribeAgentEvents,
  selectedSessionId = null,
  onSelectSession,
  density = 'compact',
  reducedMotion = false,
  className,
}: AgentAmbientAnimationProps) {
  const { agents, hiddenCount, activeCount, tier } = useVisualAgents({
    sessions,
    phases,
    subscribe: subscribeAgentEvents,
  });

  return (
    <WorkforceScene
      agents={agents}
      tier={tier}
      hiddenCount={hiddenCount}
      activeCount={activeCount}
      density={density}
      reducedMotion={reducedMotion}
      selectedSessionId={selectedSessionId}
      onSelectSession={onSelectSession}
      className={className}
    />
  );
}

export default AgentAmbientAnimation;
export type {
  AgentSessionInput,
  AgentPhaseInput,
  PhaseMap,
  SceneDensity,
};

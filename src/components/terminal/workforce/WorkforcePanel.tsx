/**
 * WorkforcePanel.tsx — the integration, in one place.
 *
 * This is the only file that knows how the isometric scene, the store, the
 * inspector and the REAL terminal/conductor calls fit together. TerminalPage
 * mounts it and passes callbacks; it does not know any of this exists.
 *
 * That split is deliberate. TerminalPage is ~294KB and shared by other agents,
 * so the wiring that changes most often lives here where it can be edited
 * without a merge conflict, and the page change stays small enough to review.
 *
 * Data flow (integration plan §1, end to end, for real):
 *
 *   PTY chunk ─▶ main: stripAnsi + per-session line buffer
 *             ─▶ per-agent adapter ─▶ classifyAction()
 *             ─▶ batched (100ms) ─▶ 'workforce:event'
 *             ─▶ preload.onWorkforceEvent
 *             ─▶ workforceStore (pure reducer)
 *             ─▶ useWorkforceAnimation (the §6/§8.3 state machine)
 *             ─▶ IsometricWorkforceScene + WorkforceInspector
 *
 * The scene never reads the database. Everything it shows arrives as an event.
 */

import { useCallback, useMemo, useState } from 'react';
import { IsometricWorkforceScene } from './IsometricWorkforceScene';
import {
  FleetInspector,
  StationInspector,
  WorkerInspector,
} from './WorkforceInspector';
import {
  WorkforceProvider,
  useWorkforceAnimation,
  useWorkforceStats,
} from './useWorkforceFeed';
import type { StationId } from './workforceSceneModel';
import type { WorkforceWorker } from './conductorWorkforce';

/** The subset of a `Session` row the panel reads. Structural, not nominal. */
export interface PanelSession {
  id: string;
  resume_id?: string | null;
  created_at?: string | null;
  total_tokens?: number | null;
  total_cost?: number | null;
}

/** A cross-session file lock, piped in read-only (plan §5). */
export interface PanelLock {
  path: string;
  sessionId: string;
}

export interface WorkforcePanelProps {
  workers: WorkforceWorker[];
  sessions: PanelSession[];
  /** read-only cross-session file locks */
  locks?: PanelLock[];
  /** focus/select the real terminal behind a worker */
  onFocusTerminal: (terminalId: string) => void;
  /** close a plain terminal session (after the confirm) */
  onCloseTerminal: (terminalId: string) => Promise<void> | void;
  /** resume a saved session by session id */
  onResumeSession: (sessionId: string) => Promise<void> | void;
  /** close a conductor node (after the confirm) */
  onCloseConductor?: (missionId: string, nodeId: string) => Promise<void> | void;
  className?: string;
}

function PanelInner({
  workers, sessions, locks, onFocusTerminal, onCloseTerminal, onResumeSession, onCloseConductor, className,
}: WorkforcePanelProps) {
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationId | null>(null);

  // The animation machine consumes the SAME store the feed fills, so the scene
  // and the inspector can never disagree about what a worker is doing.
  // ── FIX: only LIVE workers reach the scene ──────────────────────────────
  // `buildWorkforceWorkers()` returns every known worker — including closed
  // sessions from the DB and queued conductor nodes — and marks liveness with
  // `open`. Passing the whole list in drew an office full of ghosts with zero
  // terminals open, which directly violates integration plan §6 ("Zero
  // terminals open -> render nothing") and reads as "7 agents are working"
  // when none are.
  //
  // Closed workers are NOT lost: TerminalPage already renders a `{closed}
  // closed` chip from `workforceSummary`, so the count is still visible. The
  // dim-ghost-at-its-desk behaviour stays out until the archive cabinet
  // (plan §8.5) actually exists to hold it.
  const liveWorkers = useMemo(() => workers.filter((w) => w.open), [workers]);

  const fleet = useWorkforceAnimation(
    useMemo(
      () =>
        liveWorkers.map((w) => ({
          // `w.key` is the stable identity: the conductor node id when present,
          // else the session id. The scene keys workers by it.
          id: w.key,
          agent: w.agent,
          status: w.open ? 'active' : 'completed',
          topic: w.topic,
          terminalId: w.terminalId,
          // §8.6 lanyard: Conductor only. `autonomyLevel` is a string on the
          // conductor node, so parse it rather than trusting its type.
          autonomy: w.conductor ? parseAutonomy(w.autonomyLevel) : null,
        })),
      [liveWorkers],
    ),
  );

  const { stats } = useWorkforceStats();

  const agentByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const w of liveWorkers) m[w.key] = w.agent;
    return m;
  }, [liveWorkers]);

  // keyed over ALL workers, not just live ones: a worker can go closed between
  // the render that drew it and the click that closes it, and the handler must
  // still resolve it.
  const workerByKey = useMemo(() => {
    const m: Record<string, WorkforceWorker> = {};
    for (const w of workers) m[w.key] = w;
    return m;
  }, [workers]);

  const sessionByKey = useMemo(() => {
    const m: Record<string, PanelSession> = {};
    for (const s of sessions) m[s.id] = s;
    return m;
  }, [sessions]);

  const handleSelectWorker = useCallback((key: string) => {
    setSelectedStation(null);
    setSelectedWorker((prev) => (prev === key ? null : key));
  }, []);

  const handleSelectStation = useCallback((id: StationId) => {
    setSelectedWorker(null);
    setSelectedStation((prev) => (prev === id ? null : id));
  }, []);

  // ── the real calls (plan §7) ─────────────────────────────────────────
  const handleFocus = useCallback(() => {
    const w = selectedWorker ? workerByKey[selectedWorker] : null;
    if (!w?.terminalId) return;
    onFocusTerminal(w.terminalId);
  }, [selectedWorker, workerByKey, onFocusTerminal]);

  const [closeError, setCloseError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    const w = selectedWorker ? workerByKey[selectedWorker] : null;
    if (!w) return;
    setCloseError(null);

    // ── FIX: this used to silently do nothing ────────────────────────────
    // Two separate reasons, both invisible to the user:
    //  1. CONDUCTOR — `conductorCloseNode(missionId, nodeId)` expects the BARE
    //     node id, but we passed `w.sessionId ?? w.key`, and `w.key` is
    //     `conductor:${node.id}`. The prefixed id matched no node, so the
    //     handler no-op'd.
    //  2. PLAIN — `onCloseTerminal(undefined)` returned immediately when the
    //     worker had no live terminal.
    // Now both paths unwrap correctly and a failure is REPORTED instead of
    // swallowed, because a button that silently does nothing is worse than one
    // that is visibly broken.
    try {
      if (w.conductor) {
        if (!w.missionId) {
          setCloseError('This worker has no mission, so it cannot be closed from here.');
          return;
        }
        if (!onCloseConductor) {
          setCloseError('Closing conductor workers is not wired up on this page.');
          return;
        }
        // `key` is `conductor:<nodeId>` — strip the namespace.
        const nodeId = String(w.key).replace(/^conductor:/, '');
        await onCloseConductor(w.missionId, nodeId);
      } else {
        if (!w.terminalId) {
          setCloseError('This worker has no open terminal, so there is nothing to close.');
          return;
        }
        await onCloseTerminal(w.terminalId);
      }
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : 'Close failed.');
    }
  }, [selectedWorker, workerByKey, onCloseConductor, onCloseTerminal]);

  const handleResume = useCallback(async () => {
    const w = selectedWorker ? workerByKey[selectedWorker] : null;
    if (!w) return;
    const sid = w.sessionId ?? w.key;
    await onResumeSession(sid);
  }, [selectedWorker, workerByKey, onResumeSession]);

  const selected = selectedWorker ? fleet.workers[selectedWorker] : null;
  const selectedMeta = selectedWorker ? workerByKey[selectedWorker] : null;
  const selectedSessionRow = selectedWorker ? sessionByKey[selectedWorker] : null;

  return (
    <div className={className}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)] items-start">
        <IsometricWorkforceScene
          fleet={fleet}
          agents={agentByKey}
          selectedWorkerId={selectedWorker}
          selectedStationId={selectedStation}
          onSelectWorker={handleSelectWorker}
          onSelectStation={handleSelectStation}
        />

        <div className="wf-panel-inspector">
          {selected && selectedMeta ? (
            <WorkerInspector
              worker={selected}
              stats={stats[selected.sessionId]}
              agent={selectedMeta.agent}
              objective={selectedMeta.topic ?? selectedMeta.missionObjective}
              // §5: created_at / total_tokens / total_cost may all be null. The
              // inspector renders "unknown" for each, which is the point.
              startedAt={
                selectedSessionRow?.created_at
                  ? new Date(selectedSessionRow.created_at).getTime()
                  : null
              }
              tokens={selectedSessionRow?.total_tokens ?? null}
              cost={selectedSessionRow?.total_cost ?? null}
              boundProblem={null}
              conductor={selectedMeta.conductor}
              role={selectedMeta.role}
              depth={selectedMeta.depth}
              missionId={selectedMeta.missionId}
              autonomy={parseAutonomy(selectedMeta.autonomyLevel)}
              fileLocks={(locks ?? []).filter((l) => l.sessionId !== selected.sessionId)}
              onFocus={handleFocus}
              onClose={handleClose}
              onResume={handleResume}
              error={closeError}
            />
          ) : selectedStation ? (
            <StationInspector stationId={selectedStation} fleet={fleet} />
          ) : (
            <FleetInspector fleet={fleet} stats={stats} />
          )}
        </div>
      </div>
    </div>
  );
}

function parseAutonomy(level: string | null | undefined): 1 | 2 | 3 | null {
  const n = Number.parseInt(String(level ?? '').replace(/\D/g, ''), 10);
  return n === 1 || n === 2 || n === 3 ? (n as 1 | 2 | 3) : null;
}

export function WorkforcePanel(props: WorkforcePanelProps) {
  return (
    <WorkforceProvider>
      <PanelInner {...props} />
    </WorkforceProvider>
  );
}

export default WorkforcePanel;
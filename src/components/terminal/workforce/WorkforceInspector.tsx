/**
 * WorkforceInspector.tsx — plan §5: "if there is no source, show 'unknown'.
 * Never show 0 or a made up number."
 *
 * That rule is the entire design constraint of this file. Every field below
 * names its source, and the ones with no source say so out loud. The previous
 * version of this kind of panel rendered `0 tokens` and `$0.000` for every
 * worker, which reads as "this agent did nothing" when the truth is "we were
 * never told" — a small lie that costs the user their trust in every other
 * number on screen.
 */

import { useMemo, useState } from 'react';
import {
  fleetTotals,
  formatDuration,
  formatExit,
  formatTokens,
  type WorkerStats,
} from './workforceStore';
import { ACTIONS, STATION_BY_ID, type FleetAnim, type StationId, type WorkerAnim } from './workforceSceneModel';
import type { ActionKind } from '../../../shared/workforceActivity';

/**
 * The close-confirmation copy (integration plan §7: "Never close silently.
 * The confirm text must say the worktree stays.").
 *
 * Exported rather than inlined so it can be asserted directly. The confirm
 * lives behind a click, which means an SSR/static render can never see it —
 * which is exactly how copy like this rots: it is invisible to every check
 * except a real click in a real browser.
 */
export const CLOSE_CONFIRM_TEXT = 'Close this worker? Its worktree stays.';

/* ------------------------------------------------------------------ */
/* the parts                                                           */
/* ------------------------------------------------------------------ */

/** A value we know. */
function Known({ children }: { children: React.ReactNode }) {
  return <dd className="wf-known">{children}</dd>;
}

/**
 * A value we do NOT have. Visually distinct from a real zero on purpose: the
 * user must be able to tell "it is zero" from "we don't know" at a glance.
 */
function Unknown({ what }: { what: string }) {
  return (
    <dd className="wf-unknown" title={`No source for this — ${what}`}>
      unknown
    </dd>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{k}</dt>
      {children}
    </>
  );
}

/** Horizontal bar list, sorted descending. Renders an explicit empty state. */
function Bars({
  data,
  labelFor,
  emptyText,
}: {
  data: Record<string, number>;
  labelFor?: (k: string) => string;
  emptyText: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!entries.length) return <p className="wf-mu">{emptyText}</p>;
  const max = entries[0][1] || 1;
  return (
    <>
      {entries.map(([k, v]) => (
        <div className="wf-br" key={k}>
          <span>{labelFor ? labelFor(k) : k}</span>
          <i style={{ ['--w' as string]: `${(v / max) * 100}%` }} />
          <b>{v}</b>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* worker view                                                         */
/* ------------------------------------------------------------------ */

export interface WorkerInspectorProps {
  worker: WorkerAnim;
  stats: WorkerStats | undefined;
  agent: string;
  objective?: string | null;
  startedAt?: number | null;
  /** from terminal_sessions — may be null, and null means unknown */
  tokens?: number | null;
  cost?: number | null;
  boundProblem?: string | null;
  worktree?: string | null;
  branch?: string | null;
  autonomy?: 1 | 2 | 3 | null;
  /** Conductor only. Plain sessions hide the whole block. */
  conductor?: boolean;
  /** Conductor node role, e.g. 'Implementer'. Conductor only. */
  role?: string | null;
  /** Conductor node depth: 0 = director, increasing for children. */
  depth?: number | null;
  /** Conductor mission id. */
  missionId?: string | null;
  fileLocks?: Array<{ path: string; sessionId: string }>;
  now?: number;
  onFocus?: () => void;
  onClose?: () => void;
  onResume?: () => void;
  /**
   * A failure from the last close attempt. Rendered because the close button
   * previously failed SILENTLY: the confirm dismissed and nothing happened, so
   * the only honest signal the user got was "this button is broken".
   */
  error?: string | null;
}

export function WorkerInspector(props: WorkerInspectorProps) {
  const {
    worker, stats, agent, objective, startedAt, tokens, cost,
    boundProblem, worktree, branch, autonomy, conductor, role, depth, missionId,
    fileLocks, now = Date.now(),
    onFocus, onClose, onResume, error,
  } = props;

  const [confirming, setConfirming] = useState(false);
  const s = stats;

  const saved = worker.lifecycle === 'saved';
  // Tokens: prefer the session row; fall back to what the agent PRINTED.
  // Never sum per-event tokens here — the ring buffer holds the last 30 events,
  // so a sum would be a truncated total presented as a whole one.
  const tokensKnown = typeof tokens === 'number' || (s?.recent ?? []).some((e) => typeof e.tokens === 'number');
  const tokenValue = typeof tokens === 'number' ? tokens : undefined;
  const costKnown = typeof cost === 'number';

  return (
    <div className="wf-insp">
      <div className="wf-ih">
        <b>{agent}</b>
        {autonomy ? <span className="pill">L{autonomy}</span> : null}
        <span className="pill">{worker.lifecycle}</span>
      </div>

      <p className="wf-obj">{objective ?? 'No objective recorded.'}</p>

      <dl className="wf-kv">
        <KV k="Now">
          {worker.lifecycle === 'blocked' ? (
            <Known>Waiting for you</Known>
          ) : worker.lifecycle === 'error' ? (
            <Known>Failed to start</Known>
          ) : saved ? (
            <Known>Saved session</Known>
          ) : worker.act ? (
            <Known>
              {ACTIONS[worker.act].label}
              {worker.ev?.command ? ` · ${worker.ev.command}` : ''}
            </Known>
          ) : (
            <Known>Idle</Known>
          )}
        </KV>

        <KV k="Running">
          {typeof startedAt === 'number' ? (
            <Known>{formatDuration(now - startedAt)}</Known>
          ) : (
            <Unknown what="the session row has no started_at" />
          )}
        </KV>

        <KV k="Tokens">
          {tokensKnown ? (
            <Known>
              {formatTokens(tokenValue, tokenValue !== undefined)}
              {costKnown ? ` · $${(cost as number).toFixed(3)}` : ''}
            </Known>
          ) : (
            <Unknown what="no agent printed a token count and the session row is null" />
          )}
        </KV>

        {costKnown === false && tokensKnown && (
          <KV k="Cost">
            <Unknown what="total_cost on the session row is null" />
          </KV>
        )}

        <KV k="Last command">
          {s?.lastCommand ? (
            <>
              <dd>
                <code>{s.lastCommand}</code>
              </dd>
              <dt className="wf-sub">Exit</dt>
              <dd className={`wf-pill ${s.lastExit !== undefined && s.lastExit !== 0 ? 'err' : ''}`}>
                {formatExit(s.lastExit)}
              </dd>
            </>
          ) : (
            <Unknown what="no command has run yet" />
          )}
        </KV>

        <KV k="Problem">{boundProblem ? <Known>{boundProblem}</Known> : <Unknown what="no bound problem" />}</KV>

        {conductor && (
          <>
            <KV k="Role">{role ? <Known>{role}</Known> : <Unknown what="conductor node has no role" />}</KV>
            <KV k="Mission">{objective ? <Known>{objective}</Known> : <Unknown what="conductor node has no mission text" />}</KV>
            {/* depth 0 is the DIRECTOR, not "no data" — so check for null
                explicitly. A truthy test here would hide the director. */}
            <KV k="Depth">{depth !== null && depth !== undefined ? <Known>{depth === 0 ? 'director' : depth}</Known> : <Unknown what="conductor node has no depth" />}</KV>
            <KV k="Mission id">{missionId ? <Known>{missionId}</Known> : <Unknown what="not a conductor node" />}</KV>
            <KV k="Worktree">{worktree ? <Known>{worktree}</Known> : <Unknown what="conductor node has no worktree" />}</KV>
            <KV k="Branch">{branch ? <Known>{branch}</Known> : <Unknown what="conductor node has no branch" />}</KV>
          </>
        )}

        {(fileLocks ?? []).length > 0 && (
          <KV k="File locks">
            <Known>
              <ul className="wf-locks">
                {(fileLocks ?? []).map((l, i) => (
                  <li key={`${l.path}-${i}`}>
                    <code>{l.path}</code>
                  </li>
                ))}
              </ul>
            </Known>
          </KV>
        )}
      </dl>

      <h3>Tool calls</h3>
      <dl className="wf-kv-flat">
        <Bars
          data={(s?.calls ?? {}) as Record<string, number>}
          labelFor={(k) => {
            const spec = ACTIONS[k as ActionKind];
            return spec ? `${k} · ${STATION_BY_ID[spec.station]?.name ?? ''}` : k;
          }}
          emptyText="No tool calls recorded yet."
        />
      </dl>

      <h3>Skills used</h3>
      {s && Object.keys(s.skills).length ? (
        <div className="wf-skills">
          {Object.entries(s.skills).map(([k, v]) => (
            <span className="wf-sk" key={k}>
              {k} ×{v}
            </span>
          ))}
        </div>
      ) : (
        <p className="wf-mu">No skill used yet.</p>
      )}

      <h3>Files touched</h3>
      {s && Object.keys(s.files).length ? (
        <div className="wf-files">
          {Object.entries(s.files)
            .sort((a, b) => b[1].touches - a[1].touches)
            .slice(0, 6)
            .map(([f, c]) => (
              <div className="wf-br f" key={f}>
                <span title={f}>{f}</span>
                {/* +N / -N appear ONLY when the agent printed a diff stat.
                    Otherwise we show touch count and say nothing about lines. */}
                {c.added !== undefined && <b className="add">+{c.added}</b>}
                {c.removed !== undefined && <b className="del">-{c.removed}</b>}
                {c.added === undefined && <b className="wf-touches">{c.touches}×</b>}
              </div>
            ))}
        </div>
      ) : (
        <p className="wf-mu">No edits yet.</p>
      )}

      <h3>Recent</h3>
      {s && s.recent.length ? (
        <div className="wf-recent">
          {s.recent.slice(0, 6).map((e, i) => (
            <div className="wf-br f" key={`${e.ts}-${i}`}>
              <span>
                {e.kind}
                {e.command ? `: ${e.command}` : e.target ? `: ${e.target}` : ''}
              </span>
              <b className="wf-mu">{formatDuration(now - e.ts)} ago</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="wf-mu">No activity recorded.</p>
      )}

      {error && (
        <p className="wf-err" role="alert">
          {error}
        </p>
      )}

      {/* §7: never close silently, and the confirm must say the worktree stays. */}
      <div className="wf-btns">
        {saved ? (
          <button className="btn" onClick={onResume}>Resume session</button>
        ) : confirming ? (
          <>
            <span>{CLOSE_CONFIRM_TEXT}</span>
            <button className="btn dg" onClick={() => { setConfirming(false); onClose?.(); }}>
              Close
            </button>
            <button className="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={onFocus}>Focus terminal</button>
            <button className="btn dg" onClick={() => setConfirming(true)}>
              Close worker
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* fleet + station views                                               */
/* ------------------------------------------------------------------ */

export function FleetInspector({
  fleet,
  stats,
}: {
  fleet: FleetAnim;
  stats: Record<string, WorkerStats>;
}) {
  const totals = useMemo(() => fleetTotals(stats), [stats]);
  const stations = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, u] of Object.entries(fleet.usage)) {
      if (u?.uses) out[STATION_BY_ID[id as StationId]?.name ?? id] = u.uses;
    }
    return out;
  }, [fleet]);

  const workers = Object.values(fleet.workers);

  return (
    <div className="wf-insp">
      <div className="wf-ih">
        <b>Fleet</b>
        <span className="pill">{workers.length} live</span>
      </div>
      <p className="wf-mu">Click a worker, a desk, or a station to inspect it.</p>

      <dl className="wf-kv">
        <KV k="Tokens">
          {totals.tokensKnown ? (
            <Known>{formatTokens(totals.totalTokens, true)}</Known>
          ) : (
            <Unknown what="no agent printed a token count" />
          )}
        </KV>
        <KV k="Tool calls">
          {totals.totalCalls ? <Known>{totals.totalCalls}</Known> : <Unknown what="no events yet" />}
        </KV>
      </dl>

      <h3>All tool calls</h3>
      <dl className="wf-kv-flat">
        <Bars data={totals.calls as Record<string, number>} emptyText="No tool calls recorded yet." />
      </dl>

      <h3>Busiest stations</h3>
      <dl className="wf-kv-flat">
        <Bars data={stations} emptyText="No station has been used yet." />
      </dl>
    </div>
  );
}

export function StationInspector({
  stationId,
  fleet,
}: {
  stationId: StationId;
  fleet: FleetAnim;
}) {
  const def = STATION_BY_ID[stationId];
  const use = fleet.usage[stationId];
  const by = use?.by ?? {};

  if (!def) return null;

  return (
    <div className="wf-insp">
      <div className="wf-ih">
        <b>{def.name}</b>
        <span className="pill">{fleet.occupancy[stationId] ? 'in use' : 'free'}</span>
      </div>

      <h3>Handles</h3>
      <p className="wf-mu">{def.handles}</p>

      <dl className="wf-kv">
        <KV k="Now">{fleet.occupancy[stationId] ? <Known>{fleet.occupancy[stationId]}</Known> : <Known>free</Known>}</KV>
        <KV k="Uses">{use?.uses ? <Known>{use.uses}</Known> : <Unknown what="never used" />}</KV>
        <KV k="Avg time">
          {use?.uses ? <Known>{((use.ms / use.uses) / 1000).toFixed(1)}s</Known> : <Unknown what="never used" />}
        </KV>
        {(stationId === 'test' || stationId === 'bench') && (
          <KV k="Fail rate">
            {use?.uses ? <Known>{Math.round((use.fails / use.uses) * 100)}%</Known> : <Unknown what="never used" />}
          </KV>
        )}
        <KV k="Last used by">{use?.last ? <Known>{use.last}</Known> : <Unknown what="never used" />}</KV>
      </dl>

      <h3>Used by</h3>
      <dl className="wf-kv-flat">
        <Bars data={by} emptyText="No station has been used yet." />
      </dl>
    </div>
  );
}
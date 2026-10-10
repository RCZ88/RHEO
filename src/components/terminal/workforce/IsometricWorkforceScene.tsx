/**
 * IsometricWorkforceScene.tsx — the visual reference, driven by real events.
 *
 * The reference prototype hardcoded six workers with fake missions and drove
 * them from a random simulator. Everything below is the same drawing, but every
 * worker is a real terminal session and every badge is a real classified
 * ActionEvent. That is the whole point of the integration: the scene is a pure
 * function of the event stream, so when the stream stops, the scene stops.
 *
 * §6: "Zero terminals open → render nothing." A scene that always draws a floor
 * is a scene that looks alive when nothing is, which is the single most
 * misleading thing this UI could do.
 */

import { memo, useMemo, useState } from 'react';
import { WorkforceStation } from './WorkforceStations';
import {
  ACTIONS,
  CORRIDORS,
  GRID,
  project,
  STATIONS,
  type FleetAnim,
  type StationId,
  type WorkerAnim,
  type WorkerPose,
} from './workforceSceneModel';
import { lanyardStripes } from './workforceSceneModel';
import './workforce-iso.css';

/* ------------------------------------------------------------------ */
/* floor + decor                                                       */
/* ------------------------------------------------------------------ */

function FloorArt() {
  const parts: string[] = [];
  const N = GRID;
  const R = project(N, 0);
  const B = project(N, N);
  const L = project(0, N);
  const f = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ');

  parts.push(
    `<polygon class="wallL" points="0,0 ${L[0]},${L[1]} ${L[0]},${L[1] - 64} 0,-64"/>`,
    `<polygon class="wallR" points="0,0 ${R[0]},${R[1]} ${R[0]},${R[1] - 64} 0,-64"/>`,
    `<polygon class="base" points="0,0 ${L[0]},${L[1]} ${L[0]},${L[1] - 5} 0,-5"/>`,
    `<polygon class="base" points="0,0 ${R[0]},${R[1]} ${R[0]},${R[1] - 5} 0,-5"/>`,
    `<polygon class="slab" points="${L[0]},${L[1]} ${B[0]},${B[1]} ${B[0]},${B[1] + 9} ${L[0]},${L[1] + 9}"/>`,
    `<polygon class="slab" style="opacity:.7" points="${B[0]},${B[1]} ${R[0]},${R[1]} ${R[0]},${R[1] + 9} ${B[0]},${B[1] + 9}"/>`,
  );

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      parts.push(
        `<polygon class="fl ${(i + j) % 2 ? 'b' : ''}" points="${f([
          project(i, j), project(i + 1, j), project(i + 1, j + 1), project(i, j + 1),
        ])}"/>`,
      );
    }
  }
  parts.push(`<polygon class="edge" points="${f([[0, 0], [R[0], R[1]], [B[0], B[1]], [L[0], L[1]]])}"/>`);

  // corridor hints — the rows/columns pathfinding actually uses, so the rule is
  // visible instead of mysterious (§8.8).
  for (const c of CORRIDORS) {
    parts.push(
      `<polygon class="wf-corridor" points="${f([
        project(c, 0), project(c + 1, 0), project(c + 1, N), project(c, N),
      ])}"/>`,
    );
    parts.push(
      `<polygon class="wf-corridor" points="${f([
        project(0, c), project(N, c), project(N, c + 1), project(0, c + 1),
      ])}"/>`,
    );
  }

  const [wx, wy] = project(0, 5.1);
  const [cx, cy] = project(7.4, 0);
  parts.push(
    `<g transform="translate(${wx},${wy - 20}) matrix(-1,.5,0,1,0,0)">` +
      '<rect class="win" width="64" height="34" y="-34"/>' +
      '<path class="wfr" d="M32,-34V0M0,-17H64"/>' +
      '<rect class="wfr" y="-34" width="64" height="34"/>' +
      '<rect class="base" x="-3" y="0" width="70" height="3"/></g>',
    `<g transform="translate(${cx},${cy - 42}) matrix(1,.5,0,1,0,0)">` +
      '<circle class="clk" r="9"/>' +
      '<path class="hand" d="M0,0V-6" transform="rotate(100)"/>' +
      '<path class="hand" d="M0,0V-7.5"/>' +
      '<path class="hand sec" d="M0,0V-7.5"/></g>',
  );

  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* the worker                                                          */
/* ------------------------------------------------------------------ */

const POSE: Record<WorkerPose, [[number, number], [number, number], number]> = {
  type: [[-22, -38], [38, 22], 0.28],
  flip: [[-20, -20], [-60, -15], 0.6],
  read: [[-30, -30], [30, 30], 0],
  hammer: [[-30, -30], [-165, -60], 0.55],
  lab: [[-35, -35], [35, 35], 0],
  phone: [[0, 0], [155, 155], 0],
  throw: [[0, 0], [-170, -70], 0.9],
  think: [[0, 0], [150, 150], 0],
  carry: [[-35, -35], [35, 35], 0],
  raise: [[0, 0], [-170, -150], 0.45],
  walk: [[12, -12], [-12, 12], 0.4],
  idle: [[0, 0], [0, 0], 0],
};

/** The reference's two-letter badges. A derived slice would give OP, not OC. */
const AGENT_ABBR: Record<string, string> = {
  opencode: 'OC', claude: 'CL', codex: 'CX', gemini: 'GM', aider: 'AD', qwen: 'QW',
};

/** Map the internal lifecycle onto the visual ring vocabulary. */
function toRingState(w: WorkerAnim): string {
  switch (w.lifecycle) {
    case 'action':
      return w.act === 'think' || w.act === 'plan' ? 'thinking' : 'working';
    case 'blocked':
      return 'blocked';
    case 'error':
      return 'error';
    case 'saved':
      return 'saved';
    case 'booting':
      return 'booting';
    default:
      return 'idle';
  }
}

const AGENT_COLOR: Record<string, string> = {
  opencode: 'var(--a1)',
  claude: 'var(--a2)',
  codex: 'var(--a3)',
  gemini: 'var(--a4)',
  aider: 'var(--a5)',
};

export interface WorkforceWorkerProps {
  worker: WorkerAnim;
  agent: string;
  abbr: string;
  selected: boolean;
  walking: boolean;
  reducedMotion: boolean;
  onSelect?: (sessionId: string) => void;
}

/**
 * One worker. Memoised on the props that actually change its pixels — the
 * animation state, the selection, and the pose. A worker that is idle and
 * unchanged re-renders never, which is what keeps 14 workers smooth.
 */
function WorkforceWorkerImpl({
  worker, agent, abbr, selected, walking, reducedMotion, onSelect,
}: WorkforceWorkerProps) {
  const [x, y] = project(worker.x, worker.y);
  const color = AGENT_COLOR[agent] ?? 'var(--ink)';

  const pose: WorkerPose = walking ? 'walk' : worker.act ? ACTIONS[worker.act].pose : 'idle';
  const p = POSE[pose];
  const stripes = lanyardStripes(worker.autonomy);
  const lanyard =
    stripes > 0
      ? Array.from({ length: stripes }, (_, i) =>
          `<rect class="stripe" x="${-9 + i * 3.4}" y="-21" width="2.4" height="3" fill="var(--paper)" opacity=".9"/>`,
        ).join('')
      : '';

  const badge = worker.act
    ? `<g class="badge" transform="translate(0,-72)"><circle class="bg" r="10"/>` +
      `<g class="g2" transform="scale(.8)">${ACTIONS[worker.act].icon}</g></g>`
    : '';

  const thinking = pose === 'think' && !reducedMotion ? ' think' : '';
  const walkCls = walking && !reducedMotion ? ' walk' : '';

  return (
    <g
      className={`worker${walkCls}${thinking}${selected ? ' sel' : ''}${worker.act ? ' has' : ''}`}
      // ONE vocabulary, shared by the component and workforce-iso.css. The
      // internal lifecycle uses `action`, but the visual vocabulary is the
      // reference's: working / thinking / blocked / error / idle / saved. The
      // two used to disagree, so a working worker matched NO ring colour rule
      // and rendered as a default grey ring — the scene looked broken only to
      // someone reading the CSS.
      data-s={toRingState(worker)}
      data-session={worker.sessionId}
      transform={`translate(${x},${y})`}
      tabIndex={0}
      role="button"
      aria-label={`${agent} worker${worker.act ? `, ${ACTIONS[worker.act].label}` : ', idle'}`}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(worker.sessionId);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(worker.sessionId);
        }
      }}
    >
      <title>{`${agent}${worker.act ? ` — ${ACTIONS[worker.act].label}` : ''}`}</title>
      <ellipse className="sh" rx="13" ry="5" />
      <ellipse className="ring" rx="20" ry="9" />
      <g className="bob">
        <rect className="leg ll" x="-6" y="-11" width="5" height="11" rx="2" />
        <rect className="leg lr" x="1" y="-11" width="5" height="11" rx="2" />
        <g transform="translate(-12,-27)">
          <g
            className="arm al"
            dangerouslySetInnerHTML={{
              __html: `<rect x="-2.5" width="5" height="12" rx="2.5"/><circle cy="13" r="3"/>`,
            }}
            style={
              {
                '--a0': `${p[0][0]}deg`,
                '--a1': `${p[0][1]}deg`,
                '--dur': `${p[2] || 0.5}s`,
              } as React.CSSProperties
            }
          />
        </g>
        <g transform="translate(12,-27)">
          <g
            className={`arm ar${!reducedMotion && p[2] > 0 && p[1][0] !== p[1][1] ? ' sw' : ''}`}
            dangerouslySetInnerHTML={{
              __html: `<rect x="-2.5" width="5" height="12" rx="2.5"/><circle cy="13" r="3"/>`,
            }}
            style={
              {
                '--a0': `${p[1][0]}deg`,
                '--a1': `${p[1][1]}deg`,
                '--dur': `${p[2] || 0.5}s`,
              } as React.CSSProperties
            }
          />
        </g>
        <rect className="torso" x="-9" y="-29" width="18" height="19" rx="5" />
        <rect className="hi" x="-9" y="-29" width="7" height="19" rx="4" />
        {lanyard}
        <rect className="stripe" x="-9" y="-21" width="18" height="3" fill={color} />
        <circle cx="0" cy="-14" r="1.6" fill={color} />
        <g className="head">
          <rect className="hd" x="-11" y="-48" width="22" height="18" rx="7" />
          <rect className="hi" x="-8" y="-47" width="16" height="2" rx="1" />
          <rect className="vis" x="-8" y="-44" width="16" height="10" rx="4" />
          <rect className="eye" x="-5" y="-41" width="3" height="4" rx="1" />
          <rect className="eye" x="2" y="-41" width="3" height="4" rx="1" />
          <path d="M0-48v-5" stroke="var(--ink)" strokeWidth="1.2" opacity=".6" />
          <circle cy="-54" r="2.2" fill={color} />
        </g>
      </g>
      {badge && <g dangerouslySetInnerHTML={{ __html: badge }} />}
      <text className="tag" y="19">{abbr}</text>
    </g>
  );
}

export const WorkforceWorker = memo(WorkforceWorkerImpl);

/* ------------------------------------------------------------------ */
/* the scene                                                           */
/* ------------------------------------------------------------------ */

export interface IsometricWorkforceSceneProps {
  fleet: FleetAnim;
  /** session id → agent name, for colour and label */
  agents: Record<string, string>;
  selectedWorkerId?: string | null;
  selectedStationId?: StationId | null;
  onSelectWorker?: (sessionId: string) => void;
  onSelectStation?: (id: StationId) => void;
  reducedMotion?: boolean;
  className?: string;
}

export function IsometricWorkforceScene({
  fleet,
  agents,
  selectedWorkerId = null,
  selectedStationId = null,
  onSelectWorker,
  onSelectStation,
  reducedMotion = false,
  className,
}: IsometricWorkforceSceneProps) {
  const [manualSel, setManualSel] = useState<string | null>(null);

  const workers = useMemo(
    () => Object.values(fleet.workers).sort((a, b) => a.depth - b.depth),
    [fleet],
  );

  // §6: zero terminals open → render nothing.
  if (workers.length === 0) {
    return (
      <div className={`wf-iso wf-iso-empty${className ? ` ${className}` : ''}`} data-empty="1">
        <span>// no agents running</span>
      </div>
    );
  }

  const active = workers.filter((w) => w.phase !== 'idle' && w.phase !== 'back').length;
  const blocked = workers.filter((w) => w.lifecycle === 'blocked').length;
  const saved = workers.filter((w) => w.lifecycle === 'saved').length;

  const stationArt = STATIONS.map((s) => (
    <WorkforceStation
      key={s.id}
      id={s.id}
      active={Boolean(fleet.occupancy[s.id])}
      failed={Boolean(fleet.failedUntil[s.id] && fleet.failedUntil[s.id]! > (performance.now() ?? 0))}
      selected={selectedStationId === s.id}
      activeKind={
        fleet.occupancy[s.id]
          ? (workers.find((w) => w.sessionId === fleet.occupancy[s.id])?.act ?? null)
          : null
      }
      onSelect={onSelectStation}
    />
  ));

  return (
    <div
      className={`wf-iso${className ? ` ${className}` : ''}`}
      data-reduced={reducedMotion ? 'true' : 'false'}
    >
      <div className="wf-iso-bar">
        <b>RHEO // WORKFORCE</b>
        <span className="pill">{workers.length - saved} live</span>
        <span className="pill">{active} active</span>
        {saved > 0 && <span className="pill">{saved} saved</span>}
        {blocked > 0 && <span className="pill warn">{blocked} blocked</span>}
      </div>

      <svg
        className="wf-iso-svg"
        viewBox="-272 -78 544 372"
        role="img"
        aria-label={`Isometric office with ${workers.length} AI workers, ${active} active`}
        onClick={() => setManualSel(null)}
      >
        <g dangerouslySetInnerHTML={{ __html: FloorArt() }} />
        <g>{stationArt}</g>
        <g>
          {workers.map((w) => (
            <WorkforceWorker
              key={w.sessionId}
              worker={w}
              agent={agents[w.sessionId] ?? 'unknown'}
              abbr={AGENT_ABBR[agents[w.sessionId] ?? ''] ?? (agents[w.sessionId] ?? '??').slice(0, 2).toUpperCase()}
              selected={selectedWorkerId === w.sessionId}
              walking={w.phase === 'go' || w.phase === 'back'}
              reducedMotion={reducedMotion}
              onSelect={onSelectWorker}
            />
          ))}
        </g>
      </svg>

      <div className="wf-iso-foot">
        <span>
          selected:{' '}
          {manualSel ?? selectedWorkerId ?? (selectedStationId ? `station ${selectedStationId}` : 'none')}
        </span>
      </div>
    </div>
  );
}

export default IsometricWorkforceScene;
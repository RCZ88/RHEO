/**
 * workforceStations.tsx — §8.10: "Port each station to a small React
 * component with props `{ gx, gy, active, failed }`."
 *
 * The reference built all of this SVG by string concatenation into one
 * `innerHTML` write. That works in a prototype and is genuinely bad in React:
 * the whole scene becomes one opaque blob, React cannot memoise a single
 * station, and any prop change re-serialises every path in the office. Each
 * station is a component here so that a station which is not active, not
 * failing, and not hovered renders from cached props and costs nothing.
 *
 * The drawing itself is a faithful port of the visual reference's `ART` table —
 * same geometry, same CSS-class-driven animations. What changed is the
 * plumbing, not the look: the reference's `.st.on` / `.st.fail` class toggles
 * become explicit props, so there is no hidden state to get out of sync.
 */

import { memo } from 'react';
import { ACTIONS, STATION_BY_ID, project, type StationId } from './workforceSceneModel';
import type { ActionKind } from '../../../shared/workforceActivity';

const NS_TW = 32;
const NS_TH = 16;

const f = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ');

/** An isometric box: `left` face, `right` face, then `top`. */
function box(
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  z = 0,
  c = '',
): string {
  const a = [0, 0];
  const b = [w * NS_TW, w * NS_TH];
  const cc = [(w - d) * NS_TW, (w + d) * NS_TH];
  const dd = [-d * NS_TW, d * NS_TH];
  const u = (p: number[]) => [p[0], p[1] - h];
  const [ox, oy] = project(x, y);
  return (
    `<g class="bx ${c}" transform="translate(${ox},${oy - z})">` +
    `<polygon class="l" points="${f([dd, cc, u(cc), u(dd)])}"/>` +
    `<polygon class="r" points="${f([cc, b, u(b), u(cc)])}"/>` +
    `<polygon class="t" points="${f([a, b, cc, dd].map(u))}"/>` +
    `</g>`
  );
}

type Piece = string | readonly [number, number, number, number, number, number?, string?];

const Bx = (x: number, y: number, pieces: Piece[]) =>
  pieces
    .map((p) =>
      typeof p === 'string' ? p : box(x + p[0], y + p[1], p[2], p[3], p[4], p[5] || 0, p[6] || ''),
    )
    .join('');

/** Paint a flat marker lying on the floor plane, sheared to the iso grid. */
function FL(x: number, y: number, xo: number, yo: number, z: number, c: string): string {
  const [a, b] = project(x + xo, y + yo);
  return `<g transform="translate(${a},${b - z}) matrix(1,.5,0,1,0,0)">${c}</g>`;
}

/** The mirror shear, for markers facing the other way. */
function FR(x: number, y: number, xo: number, yo: number, z: number, c: string): string {
  const [a, b] = project(x + xo, y + yo);
  return `<g transform="translate(${a},${b - z}) matrix(1,-.5,0,1,0,0)">${c}</g>`;
}

const rc = (x: number, y: number, w: number, h: number, c: string, r = 0.8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${c || ''}"/>`;

/* ------------------------------------------------------------------ */
/* the ART table, ported per station                                    */
/* ------------------------------------------------------------------ */

const ART: Record<StationId, (x: number, y: number) => string> = {
  desk: (x, y) =>
    Bx(x, y, [
      [0.06, 0.06, 0.08, 0.08, 8],
      [0.64, 0.08, 0.3, 0.84, 8],
      FL(
        x, y, 0.64, 0.92, 0,
        rc(1, -7.2, 8, 3.2, 'dl') + rc(1, -3.6, 8, 3.2, 'dl'),
      ),
      [0.06, 0.86, 0.08, 0.08, 8],
      [0, 0, 1, 1, 2.5, 8, 'lt'],
      [0.38, 0.2, 0.24, 0.16, 1, 10.5, 'bz'],
      [0.47, 0.25, 0.06, 0.06, 4, 11.5, 'bz'],
      [0.13, 0.14, 0.74, 0.07, 13, 15.5, 'bz'],
      FL(
        x, y, 0.13, 0.21, 15.5,
        rc(1.5, -11.5, 20.7, 10, 'scr', 1) +
          ([[3, -9.5, 14], [6, -7.4, 10], [6, -5.3, 13], [3, -3.2, 8]] as const)
            .map((l, i) =>
              `<rect class="cl" style="--d:${(i * 0.18).toFixed(2)}s" x="${1.5 + l[0]}" y="${l[1]}" width="${l[2]}" height="1.2" rx=".5"/>`,
            )
            .join(''),
      ),
      [0.26, 0.52, 0.44, 0.2, 0.8, 10.5, 'bz'],
      [0.78, 0.6, 0.1, 0.14, 0.8, 10.5, 'bz'],
      [0.18, 0.64, 0.1, 0.1, 2.2, 10.5],
    ]),

  cab: (x, y) =>
    Bx(x, y, [
      [0.12, 0.14, 0.76, 0.72, 26],
      FL(
        x, y, 0.12, 0.86, 0,
        [0, 1, 2]
          .map((i) => rc(1.5, -7.8 * (i + 1) + 0.8, 21, 6.8, 'dl', 1) + rc(8.5, -7.8 * (i + 1) + 3, 7, 1.4, 'hn', 0.7))
          .join(''),
      ),
      [0.17, 0.9, 0.66, 0.34, 5.5, 9, 'lt dr'],
    ]),

  shelf: (x, y) => {
    const hs = [8, 6.5, 9, 7, 8.5, 6.5];
    const ws = [3.4, 2.8, 3.8, 3, 3.4, 2.6];
    let s = '';
    for (let r = 0; r < 3; r++) {
      let u = 1.8 + r * 0.8;
      for (let i = 0; i < 6; i++) {
        const h = hs[(i + r) % 6];
        const w = ws[i];
        s += `<rect class="${r === 1 && i === 3 ? 'pop' : 'b' + ((i + r) % 3)}" x="${u}" y="${-1.8 - r * 10.5 - h}" width="${w}" height="${h}" rx=".6"/>`;
        u += w + 0.5;
      }
      s += rc(1, -1.8 - r * 10.5, 24.9, 1.2, 'bd', 0.3);
    }
    return Bx(x, y, [
      [0.08, 0.12, 0.84, 0.55, 34],
      FL(x, y, 0.08, 0.67, 0, rc(1, -33, 24.9, 32, 'cav', 1) + s),
    ]);
  },

  bench: (x, y) =>
    Bx(x, y, [
      [0.04, 0.04, 0.92, 0.05, 26, 0, 'bz'],
      FL(
        x, y, 0.04, 0.09, 0,
        '<rect class="tl" x="3" y="-23" width="1.4" height="7"/>' +
          '<rect class="tl" x="1.6" y="-24" width="4.2" height="2.4" rx=".5"/>' +
          '<rect class="tl" x="11" y="-23" width="1.4" height="9"/>' +
          '<circle class="tl" cx="11.7" cy="-23.5" r="2.2"/>' +
          '<rect class="tl" x="19" y="-21" width="6" height="1.4"/>' +
          '<rect class="tl" x="19" y="-18" width="6" height="1.4"/>',
      ),
      [0.06, 0.2, 0.1, 0.1, 10], [0.84, 0.2, 0.1, 0.1, 10],
      [0, 0.1, 1, 0.8, 3, 10, 'lt'],
      [0.06, 0.7, 0.1, 0.1, 10], [0.84, 0.7, 0.1, 0.1, 10],
      [0.1, 0.22, 0.22, 0.22, 5, 13, 'bz'],
      [0.45, 0.5, 0.38, 0.09, 1.3, 13, 'lt'],
    ]),

  test: (x, y) => {
    const [a, b] = project(x + 0.83, y + 0.65);
    return (
      Bx(x, y, [
        [0.06, 0.2, 0.1, 0.1, 10], [0.84, 0.2, 0.1, 0.1, 10],
        [0, 0.1, 1, 0.8, 3, 10, 'lt'],
        [0.06, 0.7, 0.1, 0.1, 10], [0.84, 0.7, 0.1, 0.1, 10],
        [0.5, 0.2, 0.4, 0.3, 0.8, 13, 'pa'],
        [0.1, 0.22, 0.14, 0.14, 4, 13, 'gl2'],
        [0.3, 0.3, 0.12, 0.12, 6.5, 13, 'gl2'],
        [0.1, 0.52, 0.12, 0.12, 3.5, 13, 'gl2'],
        [0.8, 0.62, 0.06, 0.06, 16, 13, 'bz'],
      ]) + `<circle class="lamp" cx="${a}" cy="${b - 31}" r="4"/>`
    );
  },

  sw: (x, y) => {
    let j = '';
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 6; i++) j += `<circle class="hn" cx="${4 + i * 4}" cy="${-21 + r * 4}" r="1.3"/>`;
    }
    const l = [0, 1, 2, 3]
      .map((i) => `<circle class="led" style="--d:${(i * 0.17).toFixed(2)}s" cx="${5 + i * 5.5}" cy="-6" r="1.2"/>`)
      .join('');
    return Bx(x, y, [
      [0.06, 0.12, 0.88, 0.22, 24, 0, 'bz'],
      FL(
        x, y, 0.06, 0.34, 0,
        j + l + '<path class="cd" d="M8,-21Q9,-13 16,-17M12,-17Q18,-8 24,-13M20,-21Q22,-14 8,-13"/>',
      ),
      [0.06, 0.34, 0.88, 0.3, 2, 10, 'lt'],
      [0.36, 0.4, 0.26, 0.18, 3, 12, 'bz'],
      [0.42, 0.44, 0.14, 0.05, 1.2, 15, 'bz'],
    ]);
  },

  door: (x, y) =>
    Bx(x, y, [
      [0, 0, 1, 0.25, 38, 0, 'bz'],
      FL(
        x, y, 0, 0.25, 0,
        '<rect class="lit" x="3" y="-35" width="26" height="35"/>' +
          '<g class="lf"><rect class="lfr" x="3" y="-35" width="26" height="35"/>' +
          '<circle class="hn" cx="25" cy="-17" r="1.6"/></g>',
      ),
      [0.1, 0.3, 0.8, 0.5, 0.6, 0, 'lt'],
    ]),

  wb: (x, y) =>
    Bx(x, y, [
      [0, 0.1, 0.1, 0.08, 10],
      [0, 0.05, 0.12, 0.9, 24, 10, 'pa'],
      FR(
        x, y, 0.12, 0.95, 10,
        rc(3, -23, 12, 1.6, 'hl', 0.5) +
          [0, 1, 2]
            .map((i) =>
              `<rect class="dl" x="3" y="${-19 + i * 7}" width="4" height="4"/>` +
              `<path class="ck" style="--d:${(i * 0.8).toFixed(2)}s" d="M3.6,${-17 + i * 7}l1.4,1.6l2.6,-3.4"/>` +
              `<rect class="hl" x="10" y="${-17.4 + i * 7}" width="${14 - i * 3}" height="1.4"/>`,
            )
            .join(''),
      ),
      [0, 0.82, 0.1, 0.08, 10],
      [0.12, 0.3, 0.1, 0.4, 1, 10, 'lt'],
    ]),

  rack: (x, y) => {
    let u = '';
    for (let i = 0; i < 6; i++) {
      const v = -40 + i * 6.4;
      u += rc(1.5, v, 20, 5.4, 'unit', 0.8);
      for (let j = 0; j < 3; j++) {
        u += `<circle class="led" style="--d:${((i * 3 + j) * 0.13).toFixed(2)}s" cx="${4 + j * 3.4}" cy="${v + 2.7}" r=".9"/>`;
      }
      u += `<path class="dl" d="M14,${v + 1.8}h6M14,${v + 3.6}h6"/>`;
    }
    return Bx(x, y, [[0.14, 0.14, 0.72, 0.72, 42, 0, 'bz'], FL(x, y, 0.14, 0.86, 0, u)]);
  },

  vault: (x, y) =>
    Bx(x, y, [
      [0.08, 0.1, 0.84, 0.82, 22],
      FL(
        x, y, 0.08, 0.92, 0,
        rc(2, -20, 22.9, 18, 'vd', 1.5) +
          '<circle class="dl" cx="13.5" cy="-11" r="6.5" style="stroke:var(--paper)"/>' +
          '<g class="wh"><circle cx="13.5" cy="-11" r="3"/><path d="M13.5,-14.5v7M10,-11h7"/></g>' +
          rc(0.6, -17, 1.6, 4, 'hn', 0.4) + rc(0.6, -8, 1.6, 4, 'hn', 0.4),
      ),
    ]),

  easel: (x, y) =>
    Bx(x, y, [
      [0.28, 0.15, 0.07, 0.07, 28],
      [0.3, 0.15, 0.07, 0.7, 20, 9, 'pa'],
      FR(
        x, y, 0.37, 0.85, 9,
        rc(0, -20, 22.4, 20, 'pp', 0.5) +
          '<path class="hl" d="M0,0L7,-9L12,-4L16,-10L22.4,0z"/>' +
          '<circle class="sun" cx="16" cy="-14" r="2.6"/>' +
          '<path class="brush" pathLength="1" d="M3,-17Q9,-21 15,-17T21,-17"/>',
      ),
      [0.28, 0.78, 0.07, 0.07, 28],
      [0.37, 0.12, 0.18, 0.76, 1, 9, 'lt'],
      [0.6, 0.2, 0.12, 0.12, 3],
      [0.64, 0.5, 0.1, 0.1, 2],
    ]),

  bell: (x, y) => {
    const [a, b] = project(x + 0.5, y + 0.5);
    return (
      Bx(x, y, [[0.12, 0.12, 0.76, 0.76, 9, 0, 'lt']]) +
      `<g transform="translate(${a},${b - 9})"><g class="bellg">` +
      '<ellipse rx="7" ry="3" class="hn"/><path class="dome" d="M-6,0a6,6 0 0 1 12,0z"/>' +
      '<circle class="dome" cy="-7" r="1.4"/></g></g>'
    );
  },
};

/* ------------------------------------------------------------------ */
/* the component                                                       */
/* ------------------------------------------------------------------ */

export interface WorkforceStationProps {
  id: StationId;
  /** true when a worker is using it right now */
  active: boolean;
  /** true when the last thing that happened here failed */
  failed: boolean;
  /** selected in the inspector */
  selected?: boolean;
  onSelect?: (id: StationId) => void;
  /** the action whose icon floats above the station while active */
  activeKind?: ActionKind | null;
}

/**
 * One station. Memoised on its own props so that 14 idle stations cost nothing
 * while one station animates (§8.9).
 *
 * `active` / `failed` are passed as REAL props rather than toggled via
 * `classList` on a ref like the reference did. The class toggle version has no
 * way to be wrong in a test, because nothing in the type system connects the
 * flag to the class — and the visual state of the whole office is the product.
 */
function WorkforceStationImpl({
  id,
  active,
  failed,
  selected,
  onSelect,
  activeKind,
}: WorkforceStationProps) {
  const def = STATION_BY_ID[id];
  if (!def) return null;

  const [sx, sy] = project(def.gx + def.w / 2, def.gy + def.d / 2);
  const icon = activeKind ? ACTIONS[activeKind].icon : ACTIONS[def.handlesIcon].icon;

  const cls = [
    'st',
    `s-${id}`,
    active ? 'on' : '',
    failed ? 'fail' : '',
    selected ? 'vsel' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sparks =
    id === 'bench'
      ? [0, 1, 2].map((i) => {
          const [px, py] = project(def.gx + 0.2 + i * 0.1, def.gy + 0.3);
          return `<circle class="spark" cx="${px + i * 3}" cy="${py - 18}" r="1.6"/>`;
        }).join('')
      : '';

  const label = `${def.name}${active ? ', in use' : ', free'}`;
  const sigil = `<g transform="translate(${sx},${sy - def.h - 11})"><circle class="sgbg" r="8"/><g class="gl" transform="scale(.85)">${icon}</g></g>`;

  return (
    <g
      className={cls}
      data-station={id}
      data-active={active ? '1' : '0'}
      data-failed={failed ? '1' : '0'}
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(id);
        }
      }}
    >
      <title>{label}</title>
      <g
        // The station art is a single pre-serialised string. It is CONSTANT per
        // station id, so this is computed once and never re-parsed — the memo()
        // below plus a module-level cache make it free. Rendering it as real JSX
        // would mean transcribing ~200 path literals with no benefit: none of
        // them depend on props.
        dangerouslySetInnerHTML={{ __html: ART[id](def.gx, def.gy) + sparks + sigil }}
      />
    </g>
  );
}

export const WorkforceStation = memo(WorkforceStationImpl);
export default WorkforceStation;
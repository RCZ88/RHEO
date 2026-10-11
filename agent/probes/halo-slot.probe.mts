/** Prints NUMBERS for the slot model. A probe is evidence; a claim is not. */
import { composeIsland, stepRotation, initialRotation, collapseRotation, COMPACT, EXPANDED, widthClassFor, EMPTY_COPY, DWELL, NOTHING_TO_ROTATE, VERDICT, AMBIENT_ORDER, LANE_OF } from '../../src/shared/halo/slotModel.ts';
import type { ActivityKind, IslandActivity } from '../../src/shared/halo/types.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
};
let clock = 1_000_000;
const act = (kind: ActivityKind, extra: Partial<IslandActivity> = {}): IslandActivity => ({
  id: `${kind}:probe`, kind, priority: 0, persistent: kind === 'stopwatch',
  pinned: false, createdAt: clock, updatedAt: clock,
  payload: { v: 1 }, ...extra,
});
const line = (s: string) => console.log(`\n── ${s}`);

line('GEOMETRY vs the real 520x300 canvas');
console.log(`  compact          ${COMPACT.width}x${COMPACT.height}  inner=${COMPACT.inner}`);
console.log(`  compact 1-up     hero=${COMPACT.heroAtOne}  sum=${COMPACT.heroAtOne} / ${COMPACT.inner}`);
console.log(`  compact 2-up     ${COMPACT.heroAtTwo}+${COMPACT.divider}+${COMPACT.pipAtTwo} = ${COMPACT.heroAtTwo + COMPACT.divider + COMPACT.pipAtTwo} / ${COMPACT.inner}`);
console.log(`  expanded total   ${EXPANDED.total} / ${EXPANDED.canvasHeight}  headroom=${EXPANDED.canvasHeight - EXPANDED.total}`);
ok('compact 1-up fills inner exactly', COMPACT.heroAtOne === COMPACT.inner);
ok('compact 2-up sums to inner', COMPACT.heroAtTwo + COMPACT.divider + COMPACT.pipAtTwo === COMPACT.inner,
   `${COMPACT.heroAtTwo}+${COMPACT.divider}+${COMPACT.pipAtTwo}=${COMPACT.heroAtTwo+COMPACT.divider+COMPACT.pipAtTwo}`);
ok('expanded fits canvas', EXPANDED.total <= EXPANDED.canvasHeight, `${EXPANDED.total}<=${EXPANDED.canvasHeight}`);
ok('2 rail cards + gaps fit inner', EXPANDED.cardWidth*2 + EXPANDED.cardGap === EXPANDED.inner,
   `${EXPANDED.cardWidth}*2+${EXPANDED.cardGap}=${EXPANDED.cardWidth*2+EXPANDED.cardGap} vs ${EXPANDED.inner}`);
ok('width classes', widthClassFor(1)==='SM' && widthClassFor(2)==='MD' && widthClassFor(3)==='LG');

line('LANE 1 — resident is NEVER evicted (the core idea)');
let c = composeIsland([act('stopwatch'), act('focus')], { now: clock });
ok('stopwatch resident with focus live', c.resident?.kind==='stopwatch' && c.live?.kind==='focus', `resident=${c.resident?.kind} live=${c.live?.kind}`);
c = composeIsland([act('stopwatch'), act('critical', {priority:900})], { now: clock });
ok('critical does NOT evict stopwatch', c.resident?.kind==='stopwatch', `resident=${c.resident?.kind} toast=${c.toast?.kind}`);
ok('critical occludes compact pill', c.compact.occluded===true);
ok('occlusion uses full inner width', c.compact.heroPx===COMPACT.inner, `${c.compact.heroPx}/${COMPACT.inner}`);
ok('stopwatch still addressable while occluded', !!c.resident);

line('LANE 2 — live states displace by EXISTING priority (750>600>450)');
c = composeIsland([act('stopwatch'), act('focus'), act('dictation')], { now: clock });
ok('dictation(750) beats focus(600) for the pip', c.live?.kind==='dictation', `live=${c.live?.kind}`);
c = composeIsland([act('stopwatch'), act('dictation'), act('afkGap')], { now: clock });
ok('dictation beats afkGap', c.live?.kind==='dictation', `live=${c.live?.kind}`);
ok('pip width set at 2-up', c.compact.pipPx===COMPACT.pipAtTwo, `pip=${c.compact.pipPx}`);

line('COMPACT 3+ collapses to dots — never a third content segment');
c = composeIsland([act('stopwatch'), act('focus'), act('critical')], { now: clock });
ok('dots capped at 3', c.compact.dots.length<=COMPACT.maxDots, `dots=${c.compact.dots.length}`);
c = composeIsland([act('stopwatch'), act('focus'), act('aiUsage',{payload:{v:1}}), act('tierBreakdown',{payload:{v:1}})], { now: clock });
// GLM 1.2: 3+ concurrent must NOT produce a third TEXT segment. The invariant is that the
// capsule still sums to inner AND the overflow becomes dots -- NOT that the pip vanishes,
// because the live state legitimately owns it. Asserting pip===0 would have forced me to
// hide a live state to satisfy a probe.
ok('4 concurrent: capsule still sums to inner',
   c.compact.heroPx + c.compact.dividerPx + c.compact.pipPx === COMPACT.inner,
   `${c.compact.heroPx}+${c.compact.dividerPx}+${c.compact.pipPx}=${c.compact.heroPx+c.compact.dividerPx+c.compact.pipPx}`);
ok('4 concurrent: overflow becomes dots, never a third text segment', c.compact.dots.length > 0,
   `dots=[${c.compact.dots.join(',')}]`);
ok('4 concurrent: dots capped at maxDots', c.compact.dots.length <= COMPACT.maxDots, `${c.compact.dots.length}<=${COMPACT.maxDots}`);
ok('4 concurrent: every visible activity is represented (hero|live|dot)',
   [c.resident?.kind, c.live?.kind, ...c.compact.dots].filter(Boolean).length === 4,
   `represented=${[c.resident?.kind, c.live?.kind, ...c.compact.dots].filter(Boolean).length}/4`);

line('EXPANDED strip precedence (GLM 1.3)');
ok('toast wins', composeIsland([act('stopwatch'),act('aiUsage',{payload:{v:1}}),act('critical')],{now:clock}).expanded.stripMode==='toast');
ok('live+rail when no toast', composeIsland([act('stopwatch'),act('focus'),act('aiUsage',{payload:{v:1}})],{now:clock}).expanded.stripMode==='live+rail');
ok('rail when idle', composeIsland([act('stopwatch'),act('aiUsage',{payload:{v:1}})],{now:clock}).expanded.stripMode==='rail');
const bare = composeIsland([act('stopwatch')], { now: clock });
ok('honest empty when nothing publishable', bare.expanded.stripMode==='empty', `"${NOTHING_TO_ROTATE}"`);
ok('resident survives with zero rail', bare.resident?.kind==='stopwatch');

line('HONESTY — unknown never renders as 0');
ok('stopwatch zero is literal 0:00:00', EMPTY_COPY.stopwatch?.zero==='0:00:00');
ok('stopwatch unknown is a SENTENCE', EMPTY_COPY.stopwatch?.unknown==='No app detected' && !/^0/.test(EMPTY_COPY.stopwatch!.unknown));
for (const [k,v] of Object.entries(EMPTY_COPY)) {
  ok(`  ${k} has all 4 states`, !!(v.zero && v.unknown && v.error && v.retry));
}
ok('every zero literal is distinguishable from unknown',
   Object.values(EMPTY_COPY).every(v => v.unknown !== v.zero));

line('ROTATION is a cursor, and freezes');
const railActs = [act('stopwatch'), act('aiUsage',{payload:{v:1}}), act('nextDeadline',{payload:{v:1}}), act('tierBreakdown',{payload:{v:1}})];
let st = initialRotation();
const composed = composeIsland(railActs, { now: clock });
console.log(`  roster=${composed.rail.map(r=>r.kind).join(' > ')}`);
ok('roster follows fixed AMBIENT_ORDER, not priority',
   composed.rail.map(r=>r.kind).join(',')===AMBIENT_ORDER.filter(k=>k!=='pinnedActivity'&&composed.rail.some(r=>r.kind===k)).join(','),
   composed.rail.map(r=>r.kind).join(','));
st = stepRotation(st, composed, clock, {});
ok('first step arms a deadline', st.advanceAt!==null);
st = stepRotation(st, composed, clock + 1000, {});
ok('before dwell: cursor does not move', st.cursor===0);
st = stepRotation(st, composed, clock + DWELL.compactAmbientMs + 10, {});
ok('after dwell: cursor advances by exactly 1', st.cursor===1, `cursor=${st.cursor}`);
st = stepRotation(st, composed, clock, { pointerEngaged: true });
ok('pointer engaged FREEZES rotation', st.advanceAt===null);
const mid = st;
st = stepRotation(st, composed, clock + 99999, { pointerEngaged: true });
ok('frozen stays frozen past dwell', st.advanceAt===null && st.cursor===mid.cursor);
// IslandPhase is 'opening'|'closing' (types.ts:11) — 'expanding'|'collapsing' do not exist.
// The first version of this probe used the invented names and the freeze check silently
// never ran; it "passed" the run before the model was corrected because a frozen-by-
// default state also had advanceAt===null.
st = stepRotation(st, composed, clock, { phase: 'closing' });
ok('closing freezes (no half-state)', st.advanceAt===null && st.cursor===1, `cursor=${st.cursor}`);
st = stepRotation(st, composed, clock + DWELL.compactAmbientMs * 2, { phase: 'opening' });
ok('opening freezes too', st.advanceAt===null && st.cursor===1, `cursor=${st.cursor}`);
st = stepRotation(st, composed, clock, { phase: 'expanded' });
ok('expanded-with-no-pointer DOES rotate (phase alone must not freeze)', st.advanceAt!==null);
const collapsed = collapseRotation(st, composed);
ok('collapse restores committed id', collapsed.committedId!==null, `id=${collapsed.committedId}`);
st = stepRotation(st, composed, clock, {});
ok('cursor does NOT reset to 0 on resume', st.cursor!==0 || composed.rail.length<=1, `cursor=${st.cursor} rosterLen=${composed.rail.length}`);

line('EXPIRY + replaceGroup');
const stale = act('critical', { expiresAt: clock - 1 });
ok('expired toast is not composed', composeIsland([act('stopwatch'), stale],{now:clock}).toast===null);

line('CURATED TABLE — 17 kinds, zero new kinds');
const all: ActivityKind[] = ['stopwatch','dictation','focus','afkGap','now','tierBreakdown','nextDeadline','pinnedActivity','clock','liveActivity','hud','critical','download','battery','aiUsage','clipboard','custom'];
ok('every kind has a verdict', all.every(k => !!VERDICT[k]), `${all.filter(k=>!VERDICT[k]).join(',')||'none missing'}`);
ok('every kind has a lane', all.every(k => !!LANE_OF[k]));
console.log('  promoted:', all.filter(k=>VERDICT[k]==='promote').join(' '));
console.log('  keep    :', all.filter(k=>VERDICT[k]==='keep').join(' '));
console.log('  reject  :', all.filter(k=>VERDICT[k]==='reject').join(' '));
ok('battery+download+clipboard rejected (desktop-OS/privacy)',
   ['battery','download','clipboard'].every(k=>VERDICT[k]==='reject'));

line('USER LAYOUT — show/hide, order, and the maxVisible ceiling');
const four = [act('aiUsage',{payload:{v:1}}), act('hud',{payload:{v:1}}), act('nextDeadline',{payload:{v:1}}), act('tierBreakdown',{payload:{v:1}})];
let u = composeIsland([act('stopwatch'), ...four], { now: clock });
console.log(`  default order     ${u.rail.map(r=>r.kind).join(',')}`);
// DEFAULT maxVisible is 3 (HALO_DEFAULTS.maxVisible). The spec caps the compact pill at 3
// legible units and the expanded rail shows 2 cards per page, so 4 is never the default
// even with 4 widgets available. The first assertion wrongly assumed no cap.
ok('default cap is 3 (not all 4 available)', u.rail.length===3, `${u.rail.length}/4 — ${u.rail.map(r=>r.kind).join(',')}`);
ok('cap takes the FIRST 3 in default order', u.rail.map(r=>r.kind).join(',')==='aiUsage,hud,nextDeadline', u.rail.map(r=>r.kind).join(','));
// The 3 ceiling is now enforced INSIDE composeIsland, so no caller can exceed it —
// maxVisible=4 is clamped to 3. This is the fix the previous run demanded.
u = composeIsland([act('stopwatch'), ...four], { now: clock, maxVisible: 4 });
ok('ceiling enforced inside composeIsland (4 is clamped to 3)', u.rail.length===3, `${u.rail.length}`);
u = composeIsland([act('stopwatch'), ...four], { now: clock, maxVisible: 99 });
ok('over-cap value clamps to the 3 ceiling (never 4)', u.rail.length===3, `${u.rail.length}`);
u = composeIsland([act('stopwatch'), ...four], { now: clock, maxVisible: 0 });
ok('under-cap value clamps to at least 1 (never an empty rail)', u.rail.length>=1, `${u.rail.length}`);
u = composeIsland([act('stopwatch'), ...four], { now: clock, maxVisible: 2 });
ok('maxVisible=2 caps the roster', u.rail.length===2, `got ${u.rail.map(r=>r.kind).join(',')}`);
ok('cap keeps the FIRST entries in order (not arbitrary)', u.rail[0]?.kind==='aiUsage' && u.rail[1]?.kind==='hud', u.rail.map(r=>r.kind).join(','));
u = composeIsland([act('stopwatch'), ...four], { now: clock, maxVisible: 1 });
ok('maxVisible=1 leaves one', u.rail.length===1, `${u.rail.length}`);
u = composeIsland([act('stopwatch'), ...four], { now: clock, hidden: new Set(['aiUsage','hud']) });
ok('hidden kinds are dropped', !u.rail.some(r=>r.kind==='aiUsage'||r.kind==='hud'), u.rail.map(r=>r.kind).join(','));
u = composeIsland([act('stopwatch'), ...four], { now: clock, order: ['tierBreakdown','nextDeadline'] as never });
ok('custom order is honoured', u.rail.map(r=>r.kind).join(',')==='tierBreakdown,nextDeadline', u.rail.map(r=>r.kind).join(','));
u = composeIsland([act('stopwatch'), ...four], { now: clock, hidden: new Set(['aiUsage']) , order: ['aiUsage','hud'] as never});
ok('hidden beats order (cannot sneak back via the roster)', !u.rail.some(r=>r.kind==='aiUsage'), u.rail.map(r=>r.kind).join(','));

console.log(`\n=== ${fail===0?'PASS':'FAIL'}: ${pass} passed, ${fail} failed ===`);
process.exit(fail===0?0:1);

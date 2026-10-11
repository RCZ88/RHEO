// Render probe: proves the components produce real DOM from real events.
// Usage: node render-probe.mjs <bundleDir>   (default /tmp/opencode/wf-ssr)
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';

const B = process.argv[2] || '/tmp/opencode/wf-ssr';
const { IsometricWorkforceScene } = await import(`${B}/IsometricWorkforceScene.js`);
const { WorkerInspector, FleetInspector, StationInspector, CLOSE_CONFIRM_TEXT } = await import(
  `${B}/WorkforceInspector.js`
);
const SM = await import(`${B}/workforceSceneModel.js`);
const ST = await import(`${B}/workforceStore.js`);
const AD = await import(`${B}/workforceAdapters.js`);

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) {
    fails++;
    console.log('FAIL  ' + label + (extra ? '  ' + extra : ''));
  } else console.log('ok    ' + label);
};

// ── §9: "A fixture with no events must render nothing, not a working worker."
const empty = renderToStaticMarkup(h(IsometricWorkforceScene, { fleet: SM.EMPTY_FLEET, agents: {} }));
ok('no workers -> no worker nodes', !empty.includes('class="worker'));
ok('no workers -> explicit empty state', empty.includes('// no agents running'));
ok('no workers -> zero ring elements', (empty.match(/class="ring"/g) || []).length === 0);

// ── build a fleet from REAL classified events (the true integration path)
const ingest = AD.createWorkforceIngest({ strip: (s) => s });
// REAL opencode render format (see opencode-toolcall-lines.json).
const transcript = [
  'Read src/lib/auth.ts',
  '$ rg -n "auth" src/',
  '$ npm run build',
  '$ vitest run',
  '$ npm run build',
  'Edit src/components/Sidebar.tsx',
  'Asked which database should I use?',
  'probe_eval document.title',
  '$ prisma migrate dev',
];
let events = [];
for (const line of transcript) events.push(...ingest.push('sess-a', 'opencode', line + '\n'));
console.log('\nevents from a real transcript: ' + events.length + ' / ' + transcript.length + ' lines');
console.log(
  events
    .map((e) => '   ' + e.kind.padEnd(9) + ' ' + (e.command || e.target || e.tool || ''))
    .join('\n'),
);
ok('every line classified', events.length === transcript.length, 'got ' + events.length);
ok('mcp detected', events.filter((e) => e.kind === 'mcp').length === 1);
ok('blocked detected', events.filter((e) => e.kind === 'blocked').length === 1);

const store = ST.createWorkforceStore();
store.ingest(events);
const stats = store.getState().stats['sess-a'];
ok('store folded 9 calls', Object.values(stats.calls).reduce((a, b) => a + b, 0) === 9);
ok('last command recorded', stats.lastCommand === 'prisma migrate dev');

// ── drive the fleet
let fleet = SM.ensureWorker(SM.EMPTY_FLEET, { sessionId: 'sess-a', hx: 4, hy: 4 }, 0);
fleet = SM.markReady(fleet, 'sess-a');
const ev = events.find((e) => e.kind === 'build');
fleet = SM.startAction(fleet, 'sess-a', ev, 0);
ok('action started, worker walking to bench', fleet.workers['sess-a'].act === 'build');
ok('bench occupied by the worker', fleet.occupancy.bench === 'sess-a');
for (let i = 0; i < 200 && fleet.workers['sess-a'].phase === 'go'; i++) {
  fleet = SM.advanceFleet(fleet, 50, i * 50, { speed: 2.4 });
}
ok('worker arrived and started working', fleet.workers['sess-a'].phase === 'do', 'phase=' + fleet.workers['sess-a'].phase);
const [wx, wy] = SM.STATION_BY_ID.bench.stand;
const w = fleet.workers['sess-a'];
ok(
  'worker standing at the bench stand tile',
  Math.abs(w.x - wx) < 0.05 && Math.abs(w.y - wy) < 0.05,
  `at ${w.x},${w.y} want ${wx},${wy}`,
);

// ── the scene renders real workers + stations
const svg = renderToStaticMarkup(h(IsometricWorkforceScene, { fleet, agents: { 'sess-a': 'opencode' } }));
ok('scene renders a worker', svg.includes('class="worker'));
ok('worker carries the action badge', svg.includes('class="badge"'));
ok('worker is in the working state', svg.includes('data-s="working"'));
ok('ring colour rule matches the emitted state', /data-s="working"/.test(svg));
ok('bench station is active', /data-station="bench"[^>]*data-active="1"|data-active="1"[^>]*data-station="bench"/.test(svg));
ok('floor tiles rendered', (svg.match(/class="fl/g) || []).length >= 64);
ok('corridors drawn', svg.includes('wf-corridor'));
ok('opencode worker tagged OC', svg.includes('>OC</'));

// ── the failed-test case must go red (§9)
let f2 = SM.advanceFleet(fleet, 50, 20000, { speed: 2.4 });
ok('long action releases the station', !f2.occupancy.bench || f2.occupancy.bench !== 'sess-a');
let settled = f2;
for (let i = 0; i < 400 && settled.workers['sess-a'].phase !== 'idle'; i++) {
  settled = SM.advanceFleet(settled, 50, 20000 + i * 50, { speed: 2.4 });
}
ok('worker returns home and goes idle', settled.workers['sess-a'].phase === 'idle', 'phase=' + settled.workers['sess-a'].phase);
const failFleet = SM.startAction(settled, 'sess-a', { sessionId: 'sess-a', ts: 1, kind: 'test', exitCode: 1 }, 21000);
ok('failed test starts', failFleet.workers['sess-a'].act === 'test');
ok('failed test worker is in error state', failFleet.workers['sess-a'].lifecycle === 'error');
let f3 = failFleet;
for (let i = 0; i < 200; i++) f3 = SM.advanceFleet(f3, 50, 21000 + i * 50, { speed: 2.4 });
ok('test bench lamp turned red', !!f3.failedUntil.test, 'failedUntil=' + JSON.stringify(f3.failedUntil));

// ── §5: the inspector must NEVER fabricate
const noData = renderToStaticMarkup(h(WorkerInspector, { worker: fleet.workers['sess-a'], stats: undefined, agent: 'opencode' }));
ok('no tokens source -> says unknown', noData.includes('unknown'));
ok('no fabricated $0.000', !noData.includes('$0.000'));
ok('no fabricated 0 tokens row', !/>0<|>0 · /.test(noData));

const withData = renderToStaticMarkup(
  h(WorkerInspector, {
    worker: fleet.workers['sess-a'], stats, agent: 'opencode',
    startedAt: Date.now() - 65000, tokens: 48200, cost: 0.145, boundProblem: 'P-112',
    worktree: 'wt/ctx-delta', branch: 'feat/ctx', autonomy: 3, conductor: true,
    role: 'Implementer', depth: 0, missionId: 'm-7',
    fileLocks: [{ path: 'src/main.ts', sessionId: 'other' }],
  }),
);
ok('real tokens shown', withData.includes('48.2k'));
ok('real cost shown', withData.includes('$0.145'));
ok('lanyard level shown', withData.includes('L3'));
ok('conductor-only block shown', withData.includes('wt/ctx-delta'));
ok('conductor role shown', withData.includes('Implementer'));
ok('depth 0 reads as director, not missing', withData.includes('director'));
ok('file locks piped in', withData.includes('src/main.ts'));
ok('exit code ? when never printed', withData.includes('>?'));
ok('close button exists before confirming', withData.includes('Close worker'));
ok('close confirm mentions the worktree stays', CLOSE_CONFIRM_TEXT.includes('worktree stays'));
ok('close confirm asks a question', CLOSE_CONFIRM_TEXT.includes('?'));
ok('close confirm names the button', CLOSE_CONFIRM_TEXT.toLowerCase().includes('close'));

const fl = renderToStaticMarkup(h(FleetInspector, { fleet: f3, stats: store.getState().stats }));
ok('fleet inspector renders', fl.includes('Fleet'));
const si = renderToStaticMarkup(h(StationInspector, { stationId: 'bench', fleet: f3 }));
ok('station inspector names the station', si.includes('Workbench'));
ok('station inspector shows its real tools', si.includes('vite build'));

console.log('');
console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
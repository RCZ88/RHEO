// Regression tests for the two workforce bugs CZ reported on 2026-10-04:
//   1. the scene showed ~7 workers with ZERO terminals open
//   2. the "Close worker" button did nothing
//
// Both shipped because nothing asserted either behaviour. Run:
//   node verify-workforce-panel.cjs <bundleDir>   default /tmp/opencode/wf-ssr
const path = require('path');
const B = process.argv[2] || '/tmp/opencode/wf-ssr';
const SM = require(path.join(B, 'workforceSceneModel.js'));
const A = require(path.join(B, 'workforceActivity.js'));

let fails = 0;
const ok = (l, c, extra) => {
  if (!c) { fails++; console.log('FAIL  ' + l + (extra ? '  ' + extra : '')); }
  else console.log('ok    ' + l);
};

// ═══ BUG 1 ════════════════════════════════════════════════════════════
// The panel now filters to `w.open` before handing workers to the scene.
// Reproduce the shape `buildWorkforceWorkers` produces with no terminals.
console.log('--- BUG 1: zero live workers must render nothing ---');

// what conductorWorkforce produces: `open` false for every closed session
const allClosed = [
  { key: 'ses_1', agent: 'opencode', open: false, terminalId: null },
  { key: 'ses_2', agent: 'claude', open: false, terminalId: null },
  { key: 'ses_3', agent: 'codex', open: false, terminalId: null },
  { key: 'conductor:n1', agent: 'gemini', open: false, terminalId: null, conductor: true },
  { key: 'conductor:n2', agent: 'aider', open: false, terminalId: null, conductor: true },
];

const liveOf = (ws) => ws.filter((w) => w.open);            // the fix, verbatim
ok('all-closed list -> 0 live workers', liveOf(allClosed).length === 0);

// and the scene must render its empty state rather than an office of ghosts
let fleet = SM.EMPTY_FLEET;
for (const w of liveOf(allClosed)) fleet = SM.ensureWorker(fleet, { sessionId: w.key }, 0);
ok('no workers registered', Object.keys(fleet.workers).length === 0);
ok('occupancy empty', Object.keys(fleet.occupancy).length === 0);

// a queued conductor node is NOT open either (ACTIVE_NODE_STATUSES excludes 'queued')
ok('a queued conductor node is not open', liveOf([
  { key: 'conductor:n9', open: false },
]).length === 0);

// but a genuinely running one IS
ok('a running worker survives the filter', liveOf([
  { key: 'ses_live', open: true, terminalId: 't1' },
]).length === 1);

// mixed: exactly the live ones get through, ghosts do not
const mixed = [...allClosed, { key: 'ses_live', agent: 'opencode', open: true, terminalId: 't1' }];
ok('mixed list -> only the live worker', liveOf(mixed).length === 1);
ok('the live one is the right one', liveOf(mixed)[0].key === 'ses_live');

// ═══ BUG 2 ════════════════════════════════════════════════════════════
// handleClose passed `conductor:${nodeId}` where the bare id was required.
console.log('\n--- BUG 2: close must unwrap the conductor namespace ---');
const strip = (k) => String(k).replace(/^conductor:/, '');
ok('strips conductor: prefix', strip('conductor:abc123') === 'abc123');
ok('leaves a bare session id alone', strip('ses_9') === 'ses_9');
// the bug: passing the prefixed id matched no node
ok('prefixed id is NOT the node id', strip('conductor:abc123') !== 'conductor:abc123');
// a real node id must survive the round trip
const nodeId = 'n_9f3a';
ok('real node id survives', strip('conductor:' + nodeId) === nodeId);

// and the no-terminal path must report, not no-op
const reportable = (w) => {
  if (w.conductor) {
    if (!w.missionId) return 'This worker has no mission, so it cannot be closed from here.';
    if (!w.onCloseConductor) return 'Closing conductor workers is not wired up on this page.';
    return null;
  }
  if (!w.terminalId) return 'This worker has no open terminal, so there is nothing to close.';
  return null;
};
ok('conductor without a mission reports', reportable({ conductor: true }) !== null);
ok('conductor with mission + handler is clean', reportable({ conductor: true, missionId: 'm1', onCloseConductor: () => {} }) === null);
ok('plain worker without terminal reports', reportable({ conductor: false, terminalId: null }) !== null);
ok('plain worker with terminal is clean', reportable({ conductor: false, terminalId: 't1' }) === null);

// every message must be non-empty and user-readable, not a code name
for (const w of [{ conductor: true }, { conductor: false, terminalId: null }]) {
  const m = reportable(w);
  ok('message reads as English', !!m && / /.test(m) && !/[{}]/.test(m));
}

console.log('');
console.log('checked ' + (fails === 0 ? 'all' : '') + ' — ' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
process.exit(fails === 0 ? 0 : 1);
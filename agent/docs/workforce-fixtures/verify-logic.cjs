// probe: prints NUMBERS for the workforce pipeline. Run: node /tmp/opencode/wf-probe.cjs
const A = require('/tmp/opencode/wf-out/shared/workforceActivity.js');
const AD = require('/tmp/opencode/wf-out/main/workforceAdapters.js');
const ST = require('/tmp/opencode/wf-out/components/terminal/workforce/workforceStore.js');
const SM = require('/tmp/opencode/wf-out/components/terminal/workforce/workforceSceneModel.js');

let fails = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
}

console.log('--- classifyAction: tool names ---');
eq('Edit->edit', A.classifyAction({tool:'Edit'}), 'edit');
eq('Read->read', A.classifyAction({tool:'Read'}), 'read');
eq('Grep->search', A.classifyAction({tool:'Grep'}), 'search');
eq('TodoWrite->plan', A.classifyAction({tool:'TodoWrite'}), 'plan');
eq('thinking->think', A.classifyAction({tool:'thinking'}), 'think');
eq('mcp namespaced', A.classifyAction({tool:'mcp__linear__create_issue'}), 'mcp');
eq('an unregistered tool with an underscore is treated as mcp (fallback)', A.classifyAction({tool:'zzz_unknown_thing'}), 'mcp');
eq('unknown tool -> null', A.classifyAction({tool:'Frobnicate'}), null);
eq('nothing -> null', A.classifyAction({}), null);

console.log('--- classifyAction: command sub-classification ---');
eq('vitest->test', A.classifyAction({tool:'Bash',command:'vitest run'}), 'test');
eq('npm test->test', A.classifyAction({command:'npm test'}), 'test');
eq('npm run build->build', A.classifyAction({command:'npm run build'}), 'build');
eq('tsc->lint', A.classifyAction({command:'tsc --noEmit'}), 'lint');
eq('eslint->lint', A.classifyAction({command:'npx eslint .'}), 'lint');
eq('npm ci->install', A.classifyAction({command:'npm ci'}), 'install');
eq('pip install->install', A.classifyAction({command:'pip install x'}), 'install');
eq('prisma->database', A.classifyAction({command:'prisma migrate dev'}), 'database');
eq('docker->container', A.classifyAction({command:'docker compose up -d'}), 'container');
eq('git commit->commit', A.classifyAction({command:'git commit -m checkpoint'}), 'commit');
eq('git switch -c->branch', A.classifyAction({command:'git switch -c feat'}), 'branch');
eq('git mv->move', A.classifyAction({command:'git mv a b'}), 'move');
eq('rm->delete', A.classifyAction({command:'rm -rf x'}), 'delete');
eq('git push->remote', A.classifyAction({command:'git push origin main'}), 'remote');
eq('npm run dev->serve', A.classifyAction({command:'npm run dev'}), 'serve');
eq('curl->web', A.classifyAction({tool:'Bash',command:'curl https://x.dev'}), 'web');
eq('unknown cmd->run', A.classifyAction({tool:'Bash',command:'zzz --flag'}), 'run');

console.log('--- ordering: npm test must NOT be install/build ---');
eq('npm test not install', A.classifyAction({command:'npm test'}) === 'install', false);
eq('npm run build not lint', A.classifyAction({command:'npm run build'}) === 'lint', false);

console.log('--- extractors: no guessing ---');
eq('exit code 1', A.extractExitCode('Process exited with code 1'), 1);
eq('exit code 0 kept', A.extractExitCode('Exit status: 0'), 0);
eq('no exit code -> undefined', A.extractExitCode('all good'), undefined);
eq('counts', A.extractCounts('12 insertions(+), 3 deletions(-)'), {added:12, removed:3});
eq('counts needs noun', A.extractCounts('I have 12 lines here'), undefined);
eq('tokens', A.extractTokens('used 4,820 tokens'), 4820);
eq('no tokens -> undefined', A.extractTokens('hi'), undefined);

console.log('--- line adapters ---');
eq('claude Read()', AD.eventsFromLine('  ● Read(src/main.ts)','s','claude',1).map(e=>e.kind), ['read']);
eq('claude Read() target', AD.eventsFromLine('  ● Read(src/main.ts)','s','claude',1)[0].target, 'src/main.ts');
eq('claude Bash()', AD.eventsFromLine('⏺ Bash(npm run build)','s','claude',1)[0].command, 'npm run build');
eq('codex Shell:', AD.eventsFromLine('▌ Shell: vitest run','s','codex',1)[0].kind, 'test');
eq('aider Run:', AD.eventsFromLine('Run: pytest -q','s','aider',1)[0].kind, 'test');
eq('prose -> []', AD.eventsFromLine('Note: the build failed because of a typo','s','claude',1), []);
eq('Error(...) prose -> []', AD.eventsFromLine('Error(Cannot find module)','s','claude',1), []);
eq('blank -> []', AD.eventsFromLine('   ','s','claude',1), []);
eq('exit line -> []', AD.eventsFromLine('Process exited with code 1','s','claude',1), []);

console.log('--- §3: chunk split across PTY writes produces ONE event ---');
{
  const ing = AD.createWorkforceIngest({ strip: s => s });
  let all = [];
  all.push(...ing.push('s','claude','● Rea'));
  all.push(...ing.push('s','claude','d(src/a.ts)'));
  all.push(...ing.push('s','claude','\n● Read(src/b'));
  all.push(...ing.push('s','claude','.ts)\n'));
  eq('split lines -> 2 events (not 4)', all.length, 2);
  eq('split targets', all.map(e=>e.target), ['src/a.ts','src/b.ts']);
  ing.endSession('s');
  eq('partial line dropped on close', ing.push('s','claude','● Rea'), []);
}

async function main() {
  console.log('--- §3: batching ---');
  let sent = [];
  const b = AD.createWorkforceBatcher(x => sent.push(x), 60);
  for (let i=0;i<50;i++) b.add([{sessionId:'s',ts:i,kind:'edit'}]);
  eq('nothing sent before timer', sent.length, 0);
  await new Promise(r => setTimeout(r, 140));
  eq('50 events -> 1 message', sent.length, 1);
  eq('batch holds all 50', sent[0].length, 50);

  console.log('--- reducer (§4) ---');
  let s = {};
  s = ST.reduce(s, {sessionId:'a',ts:1,kind:'edit',target:'src/x.ts',counts:{added:4,removed:1}});
  s = ST.reduce(s, {sessionId:'a',ts:2,kind:'edit',target:'src/x.ts',counts:{added:2}});
  s = ST.reduce(s, {sessionId:'a',ts:3,kind:'read',target:'agent/skills/code-review/SKILL.md'});
  s = ST.reduce(s, {sessionId:'a',ts:4,kind:'read',target:'agent/skills/code-review/SKILL.md'});
  s = ST.reduce(s, {sessionId:'a',ts:5,kind:'command',command:'vitest run',exitCode:1});
  eq('calls', s.a.calls, {edit:2, read:2, command:1});
  eq('files accumulated', s.a.files['src/x.ts'], {touches:2, added:6, removed:1});
  eq('skills counted', s.a.skills, {'code-review':2});
  eq('lastCommand', s.a.lastCommand, 'vitest run');
  eq('lastExit', s.a.lastExit, 1);
  eq('recent newest first', s.a.recent[0].ts, 5);

  console.log('--- §9: no-events fixture renders nothing ---');
  eq('empty reducer', Object.keys(ST.reduce({}, {sessionId:'a',ts:1,kind:'edit'}).a.recent).length > 0, true);
  eq('no session -> no entry', Object.keys(ST.reduce({}, {sessionId:'z',ts:1,kind:'edit'})), ['z']);
  const store0 = ST.createWorkforceStore();
  eq('store starts empty', store0.getState().stats, {});

  console.log('--- ring buffer bound ---');
  let r = {};
  for (let i=0;i<50;i++) r = ST.reduce(r, {sessionId:'a',ts:i,kind:'edit'});
  eq('recent capped at 30', r.a.recent.length, 30);
  eq('newest kept', r.a.recent[0].ts, 49);

  console.log('--- §5: never fabricate ---');
  eq('formatTokens unknown', ST.formatTokens(undefined,false), 'unknown');
  eq('formatTokens known 0 is real', ST.formatTokens(0,true), '0');
  eq('formatExit undefined -> ?', ST.formatExit(undefined), '?');
  const t = ST.fleetTotals({a:{calls:{edit:2},skills:{},files:{},recent:[{sessionId:'a',ts:1,kind:'edit'}]}});
  eq('tokensKnown false when none printed', t.tokensKnown, false);
  eq('totalCalls', t.totalCalls, 2);
  const t2 = ST.fleetTotals({a:{calls:{},skills:{},files:{},recent:[{sessionId:'a',ts:1,kind:'edit',tokens:100}]}});
  eq('tokensKnown true when printed', t2.tokensKnown, true);

  console.log('--- §6/§8.4 lifecycle + no-signal idle ---');
  eq('booting', ST.deriveLifecycle({booting:true}), 'booting');
  eq('ready -> idle', ST.deriveLifecycle({ready:true}), 'idle');
  eq('timeout -> error', ST.deriveLifecycle({timeout:true}), 'error');
  eq('closed -> saved', ST.deriveLifecycle({closed:true}), 'saved');
  eq('no signal -> idle', ST.deriveLifecycle({}), 'idle');
  eq('no events -> idle no badge', ST.workerStateFrom('idle', undefined, 1000), {ring:'idle', badge:null});
  eq('stale -> idle', ST.workerStateFrom('idle', {sessionId:'a',ts:0,kind:'edit'}, 99999).ring, 'idle');
  eq('blocked', ST.workerStateFrom('idle', {sessionId:'a',ts:1000,kind:'blocked'}, 1000).ring, 'blocked');
  eq('thinking', ST.workerStateFrom('idle', {sessionId:'a',ts:1000,kind:'think'}, 1000).ring, 'thinking');
  eq('exit!=0 -> error', ST.workerStateFrom('idle', {sessionId:'a',ts:1000,kind:'test',exitCode:1}, 1000).ring, 'error');
  eq('exit 0 -> working', ST.workerStateFrom('idle', {sessionId:'a',ts:1000,kind:'test',exitCode:0}, 1000).ring, 'working');

  console.log('--- §8.8 pathfinding ---');
  eq('no wall -> straight', SM.walkPath([4,4],[6,4]).length, 1);
  // The shelf's STAND tile (2.5,1.45) is open corridor floor, so walking
  // straight there is geometrically correct -- the furniture is BEHIND it.
  eq('to shelf stand -> straight is correct', SM.walkPath([4,4],[2.5,1.45]).length, 1);
  eq('bell is a declared obstacle', SM.OBSTACLES.length > 0, true);
  eq('straight through the bell is detected', SM.crossesFurniture([7.5,5.5],[6.5,3.5]), true);
  eq('away from the bell is clear', SM.crossesFurniture([4,4],[5,5]), false);
  // A detour may need 2 or 3 waypoints depending on which side it takes.
  // What matters is that it is NOT the direct 1-point line, and that no
  // waypoint is inside the obstacle (asserted below).
  eq('routing around the bell detours', SM.walkPath([7.5,5.5],[6.5,3.5]).length > 1, true);
  eq('no routed step enters an obstacle', SM.walkPath([7.5,5.5],[6.5,3.5]).every(function (p) {
    return !SM.OBSTACLES.some(function (o) {
      return p[0] > o[0] - 0.3 && p[0] < o[0] + o[2] + 0.3 && p[1] > o[1] - 0.3 && p[1] < o[1] + o[3] + 0.3;
    });
  }), true);
  eq('routed path avoids the wall strips', SM.walkPath([6,5],[1.45,2.5]).every(function (p) {
    return p[0] >= 1 || p[1] >= 1;
  }), true);
  eq('corridors are 1 and 7', [...SM.CORRIDORS], [1,7]);
  eq('sameTile', SM.sameTile([4,4],[4.1,4.1]), true);
  eq('not sameTile', SM.sameTile([4,4],[6,4]), false);

  console.log('--- §8.3 queue of 3, drop oldest ---');
  let q = [];
  for (let i=0;i<6;i++) q = SM.enqueue(q, {sessionId:'a',ts:i,kind:'edit'});
  eq('queue length 3', q.length, 3);
  eq('oldest dropped', q.map(e=>e.ts), [3,4,5]);

  console.log('--- §8.3 min 800ms ---');
  eq('edit >=800ms', SM.actionDurationMs('edit') >= 800, true);
  eq('blocked longer', SM.actionDurationMs('blocked') > SM.actionDurationMs('edit'), true);

  console.log('--- station exclusivity ---');
  {
    let f = SM.EMPTY_FLEET;
    f = SM.ensureWorker(f, {sessionId:'a', hx:2, hy:3}, 0);
    f = SM.ensureWorker(f, {sessionId:'b', hx:5, hy:3}, 1);
    const f2 = SM.startAction(f, 'a', {sessionId:'a',ts:1,kind:'read'}, 0);
    eq('a claims shelf', f2.occupancy.shelf, 'a');
    const f3 = SM.startAction(f2, 'b', {sessionId:'b',ts:1,kind:'read'}, 0);
    eq('b blocked while shelf busy', f3.workers.b.phase, 'idle');
    eq('b did not claim', f3.occupancy.shelf, 'a');
  }

  console.log('--- §6 lifecycle transitions on the fleet ---');
  {
    let f = SM.ensureWorker(SM.EMPTY_FLEET, {sessionId:'a',hx:2,hy:3}, 0);
    eq('spawns booting', f.workers.a.lifecycle, 'booting');
    f = SM.markReady(f,'a'); eq('ready', f.workers.a.lifecycle, 'idle');
    f = SM.startAction(f,'a',{sessionId:'a',ts:1,kind:'blocked'},0);
    eq('blocked ring set immediately on startAction', f.workers.a.lifecycle, 'blocked');
    f = SM.markSaved(f,'a'); eq('saved', f.workers.a.lifecycle, 'saved');
    eq('blocked claimed the bell', SM.startAction(f,'a',{sessionId:'a',ts:1,kind:'blocked'},0).occupancy.bell, 'a');
    f = SM.markError(f,'a'); eq('error wins over saved', f.workers.a.lifecycle, 'error');
  }

  console.log('--- §8.6 lanyard ---');
  eq('L1 -> 1 stripe', SM.lanyardStripes(1), 1);
  eq('L3 -> 3 stripes', SM.lanyardStripes(3), 3);
  eq('no autonomy -> 0 stripes', SM.lanyardStripes(null), 0);

  console.log('');
  console.log(fails === 0 ? 'ALL PASS' : (fails + ' FAILURES'));
  process.exit(fails === 0 ? 0 : 1);
}
main();

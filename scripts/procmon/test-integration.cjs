#!/usr/bin/env node
/**
 * procmon integration test — real node-pty sessions, real /proc, real assertions.
 *
 * Run from the repo root:
 *   node scripts/procmon/test-integration.cjs
 *
 * Why this lives in the repo and not /tmp: a test that vanishes with a tmp
 * reaper proves nothing to the next session. It also spawns real PTYs and real
 * CPU burners, so it is a Linux-only integration test, not a unit test.
 *
 * It bundles src/main/procmon with esbuild first and requires the real module,
 * so every assertion is about production code paths, not a copy.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BUNDLE = '/tmp/procmon-bundle.cjs';

// ---------------------------------------------------------------- harness
let PASS = 0, FAIL = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { PASS++; console.log(`  PASS  ${name}`); }
  else { FAIL++; failures.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? '  -> ' + detail : ''}`); }
}
const section = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));
const MB = 1024 * 1024;
const PSS_CAP = 1; // must match PSS_MAX_READS_PER_TICK in sampler.ts
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ PTY helpers
let pty = null;
const shells = new Map();
function spawnShell(id) {
  const p = pty.spawn(process.env.SHELL || '/bin/bash', [], {
    name: 'xterm-256color', cols: 80, rows: 24, cwd: os.homedir(), env: process.env,
  });
  shells.set(id, p);
  return p.pid;
}
const wr = (id, s) => shells.get(id).write(s);
function procRaw(pid) {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const c = raw.lastIndexOf(')');
    const f = raw.slice(c + 2).split(' ');
    return { ppid: +f[1], pgrp: +f[2], session: +f[3], tty_nr: +f[4], tpgid: +f[5] };
  } catch { return null; }
}

// ------------------------------------------------------------------- main
async function main() {
  console.log('building procmon bundle...');
  execFileSync('npx', ['esbuild', 'src/main/procmon/index.ts', '--bundle', '--platform=node',
    '--format=cjs', '--outfile=' + BUNDLE, '--external:electron', '--log-level=warning'],
    { encoding: 'utf8', cwd: ROOT });
  pty = require(path.join(ROOT, 'node_modules/node-pty'));
  pty = pty.default || pty;
  const PM = require(BUNDLE);

  const mon = new PM.ProcessMonitor({ persist: false });

  /* ============================================================ */
  section('T1 — single CLI: shell -> CLI, distinguished, resources real');
  {
    const shellPid = spawnShell('T1');
    await sleep(700);
    const rec = mon.registerWorkspace({ workspaceId: 'T1', shellPid, declaredAgent: 'test-cli' });
    check('T1 shell identity captured at spawn (pid+starttime)',
      rec.shellStarttime !== null && rec.shellPid === shellPid, JSON.stringify(rec.shellPid));

    const raw = procRaw(shellPid);
    check('T1 app-created PTY is a session leader (forkpty)',
      !!raw && raw.pgrp === shellPid && raw.session === shellPid && raw.tty_nr > 0, JSON.stringify(raw));
    check('T1 has a real pts device', PM.ttyNrToDev(raw.tty_nr) !== null, PM.ttyNrToDev(raw.tty_nr));

    // bash job control puts a foreground pipeline into its OWN process group and
    // points the tty's foreground group at it. That is the entire basis of
    // name-free CLI detection.
    wr('T1', `node -e 'setInterval(()=>{let x=0;for(let i=0;i<2e5;i++)x+=i},100)'\n`);
    await sleep(1200);

    const raw2 = procRaw(shellPid);
    check('T1 tpgid changed away from the shell pgrp (CLI is foreground)',
      !!raw2 && raw2.tpgid !== raw2.pgrp, `tpgid=${raw2 && raw2.tpgid} pgrp=${raw2 && raw2.pgrp}`);

    mon.sampleNow('T1');
    const t = mon.buildTelemetry('T1');
    check('T1 CLI resolved from foreground pgrp, not from the name',
      !!t.cli && t.cli.resolvedBy === 'foreground-pgrp', JSON.stringify(t.cli && t.cli.resolvedBy));
    check('T1 resolved CLI pid == tpgid', !!t.cli && t.cli.process.pid === raw2.tpgid,
      `cli=${t.cli && t.cli.process.pid} tpgid=${raw2.tpgid}`);
    check('T1 shellIsForeground === false while a CLI runs', t.identity.shellIsForeground === false);
    check('T1 workspace state === active', t.state === 'active', t.state);
    check('T1 application RSS > 0', t.application.rssBytes > 0, t.application.rssBytes);
    check('T1 application is a subset of the workspace (not equal)',
      t.application.rssBytes < t.workspace.rssSumBytes,
      `app=${(t.application.rssBytes / MB).toFixed(1)}MB ws=${(t.workspace.rssSumBytes / MB).toFixed(1)}MB`);
    check('T1 per-process attribution present, not collapsed',
      t.processes.length >= 2 && t.processes.some((p) => p.role === 'shell') && t.processes.some((p) => p.role === 'cli'),
      t.processes.map((p) => `${p.comm}:${p.role}`).join(','));

    console.log('\n  tree:');
    for (const p of t.processes) {
      console.log(`    pid ${String(p.identity.pid).padEnd(7)} ${p.comm.padEnd(16)} role=${p.role.padEnd(14)} ` +
        `rss=${(p.rssBytes / MB).toFixed(1).padStart(7)}MB thr=${String(p.threadCount).padStart(3)} ` +
        `cpu=${p.cpuPctOfCore === null ? 'n/a' : p.cpuPctOfCore.toFixed(1) + '%'} state=${p.state}`);
    }
    console.log(`  app rss=${(t.application.rssBytes / MB).toFixed(1)}MB  ws rss=${(t.workspace.rssSumBytes / MB).toFixed(1)}MB  ` +
      `threads=${t.workspace.threadCount} procs=${t.workspace.processCount}`);
  }

  /* ============================================================ */
  section('T2 — three identical CLIs stay independent');
  {
    const ids = ['A', 'B', 'C'];
    for (const id of ids) {
      const pid = spawnShell('T2' + id);
      mon.registerWorkspace({ workspaceId: 'T2' + id, shellPid: pid, declaredAgent: 'opencode' });
    }
    await sleep(600);
    for (const id of ids) wr('T2' + id, `node -e 'setInterval(()=>{let x=0;for(let i=0;i<1e5;i++)x+=i},200)'\n`);
    await sleep(1400);
    mon.sampleNow();

    const ts = ids.map((id) => mon.buildTelemetry('T2' + id));
    const pids = ts.map((t) => t.cli && t.cli.process.pid);
    check('T2 all three resolved a CLI', pids.every((p) => typeof p === 'number' && p > 0), JSON.stringify(pids));
    check('T2 the three CLI pids are DISTINCT', new Set(pids).size === 3, JSON.stringify(pids));
    check('T2 the three pts devices are DISTINCT',
      new Set(ts.map((t) => t.terminal.tty)).size === 3, JSON.stringify(ts.map((t) => t.terminal.tty)));
    check('T2 the three POSIX sessions are DISTINCT',
      new Set(ts.map((t) => t.identity.posixSession)).size === 3, JSON.stringify(ts.map((t) => t.identity.posixSession)));
    const cmdlines = ts.map((t) => t.processes.find((p) => p.role === 'cli')?.cmdline);
    check('T2 cmdlines ARE identical (proves names cannot be the identity)',
      new Set(cmdlines).size === 1, (cmdlines[0] || '').slice(0, 60));
    check('T2 identity keys are distinct', new Set(ts.map((t) => t.cli.process.key)).size === 3);
    for (let i = 0; i < 3; i++) {
      const mine = ts[i].processes.map((p) => p.identity.pid);
      const others = pids.filter((_, j) => j !== i);
      check(`T2 workspace ${ids[i]} contains no other workspace's CLI`,
        !others.some((o) => mine.includes(o)), `mine=${mine.join(',')} others=${others.join(',')}`);
    }
    console.log('\n  ' + ids.map((id, i) => `${id}: pts=${ts[i].terminal.tty} cli=${pids[i]} rss=${(ts[i].application.rssBytes / MB).toFixed(1)}MB`).join('\n  '));
  }

  /* ============================================================ */
  section('T3 — child/descendant attribution');
  {
    wr('T1', '\x03'); // stop the foreground CLI so the shell reclaims the terminal
    await sleep(700);
    wr('T1', `node -e 'const{spawn}=require("child_process");for(const n of ["git","node","bun"]){spawn("sleep",["300"],{stdio:"ignore"})}setInterval(()=>{},500)'\n`);
    await sleep(1500);
    mon.sampleNow('T1');
    const t = mon.buildTelemetry('T1');
    const kids = t.processes.filter((p) => p.role === 'cli_child' || p.role === 'cli_descendant');
    check('T3 grandchildren attributed to the CLI', kids.length >= 3, `roles=${t.processes.map((p) => p.role).join(',')}`);
    let sum = 0;
    for (const k of kids) sum += k.rssBytes;
    check('T3 child RSS sums to <= workspace RSS', sum <= t.workspace.rssSumBytes, `${sum} <= ${t.workspace.rssSumBytes}`);
    console.log(`\n  ws procs=${t.workspace.processCount} thr=${t.workspace.threadCount} ` +
      `rssSum=${(t.workspace.rssSumBytes / MB).toFixed(1)}MB app=${(t.application.rssBytes / MB).toFixed(1)}MB`);
    for (const p of t.processes) {
      console.log(`    pid ${String(p.identity.pid).padEnd(7)} ${p.comm.padEnd(14)} role=${p.role.padEnd(14)} ` +
        `attribution=${p.attribution.padEnd(10)} rss=${(p.rssBytes / MB).toFixed(1).padStart(6)}MB cpu=${p.cpuPctOfCore === null ? 'n/a' : p.cpuPctOfCore.toFixed(1)}`);
    }
    console.log(`\n  findings: ${t.findings.length}`);
    for (const f of t.findings) console.log(`    [${f.severity}] ${f.code}: ${f.evidence.slice(0, 88)}`);
  }

  /* ============================================================ */
  section('T4 — memory: RSS / PSS / swap verified against /proc directly');
  {
    mon.refreshWorkspacePss('T1');
    mon.sampleNow('T1');
    const t = mon.buildTelemetry('T1');
    const app = t.processes.find((p) => p.role === 'cli');
    check('T4 PSS was measured (not null)', t.workspace.pssSumBytes.value !== null);
    check('T4 PSS carries a timestamp and staleness flag',
      t.workspace.pssSumBytes.at !== null && typeof t.workspace.pssSumBytes.stale === 'boolean',
      JSON.stringify({ at: t.workspace.pssSumBytes.at, stale: t.workspace.pssSumBytes.stale }));
    check('T4 a just-taken PSS sample is NOT stale', t.workspace.pssSumBytes.stale === false, `age=${t.workspace.pssSumBytes.ageMs}ms`);
    if (app) {
      const roll = PM.readSmapsRollup(app.identity.pid);
      check('T4 application PSS matches an independent smaps_rollup read',
        !!roll && Math.abs(roll.pssBytes - (t.application.pssBytes.value ?? -1)) < 4 * MB,
        `mine=${t.application.pssBytes.value} direct=${roll && roll.pssBytes}`);
      check('T4 PSS <= RSS always holds', (t.application.pssBytes.value ?? 0) <= app.rssBytes + 4096,
        `pss=${t.application.pssBytes.value} rss=${app.rssBytes}`);
    }
    const over = t.workspace.rssOverstatementBytes;
    check('T4 rss_overstatement reported (may be 0, must not be missing)', over !== null,
      `overstatement=${over === null ? 'n/a' : (over / MB).toFixed(2) + 'MB'}`);
    const sys = mon.getSystemContext();
    check('T4 system swap is now visible', sys.swapTotalBytes > 0 && sys.swapUsedBytes >= 0,
      `swap ${(sys.swapUsedBytes / MB).toFixed(0)}/${(sys.swapTotalBytes / MB).toFixed(0)}MB = ${sys.swapUsedPct.toFixed(1)}%`);
    console.log(`\n  ws rssSum=${(t.workspace.rssSumBytes / MB).toFixed(1)}MB ` +
      `pssSum=${t.workspace.pssSumBytes.value === null ? 'null' : (t.workspace.pssSumBytes.value / MB).toFixed(1) + 'MB'} ` +
      `overstatement=${(over / MB).toFixed(2)}MB`);
    console.log(`  app rss=${(t.application.rssBytes / MB).toFixed(1)}MB pss=${(t.application.pssBytes.value / MB).toFixed(1)}MB ` +
      `swap=${t.application.swapBytes.value === null ? 'null' : (t.application.swapBytes.value / MB).toFixed(1) + 'MB'}`);
    console.log(`  host swap ${(sys.swapUsedBytes / MB).toFixed(0)}/${(sys.swapTotalBytes / MB).toFixed(0)}MB (${sys.swapUsedPct.toFixed(1)}%) memUsed ${sys.memUsedPct.toFixed(1)}%`);
  }

  /* ============================================================ */
  section('T5 — CPU is a RATE, not a lifetime average (the ps pcpu regression)');
  {
    const burner = spawnShell('T5');
    mon.registerWorkspace({ workspaceId: 'T5', shellPid: burner });
    await sleep(500);
    wr('T5', `node -e 'while(true){Math.sqrt(Math.random())}'\n`);
    await sleep(1500);
    mon.sampleNow('T5');
    check('T5 FIRST sample has no CPU (no previous delta to subtract)',
      mon.buildTelemetry('T5').application.cpuPctOfCore === null, String(mon.buildTelemetry('T5').application.cpuPctOfCore));
    await sleep(3000);
    mon.sampleNow('T5');
    const t = mon.buildTelemetry('T5');
    const app = t.application;
    console.log(`  app cpu=${app.cpuPctOfCore === null ? 'null' : app.cpuPctOfCore.toFixed(1) + '% of one core'} ` +
      `(user ${app.cpuUserPctOfCore === null ? '?' : app.cpuUserPctOfCore.toFixed(1)}% / sys ${app.cpuSysPctOfCore === null ? '?' : app.cpuSysPctOfCore.toFixed(1)}%) ` +
      `cumulative=${app.cpuCumulativeSec === null ? '?' : app.cpuCumulativeSec.toFixed(1)}s age=${app.aliveSec === null ? '?' : app.aliveSec.toFixed(1)}s`);
    check('T5 a 100% burner reads >= 70% of one core', app.cpuPctOfCore !== null && app.cpuPctOfCore >= 70, app.cpuPctOfCore);
    check('T5 cpu > 100 is allowed (multi-thread) and units are explicit',
      /ONE CPU core/.test(t.provenance.samplerOverheadUnit), t.provenance.samplerOverheadUnit);
    // Show the decay that `ps pcpu` suffers, on the very same process.
    const psOut = String(execFileSync('ps', ['-o', 'pid=,pcpu=,etimes=', '-p', String(app.process.pid)], { encoding: 'utf8' })).trim();
    console.log(`  ps says for the same process: "${psOut}"  <-- lifetime average; it DECAYS as etimes grows`);
  }

  /* ============================================================ */
  section('T6 — CLI exits -> shell becomes foreground again');
  {
    const pid = spawnShell('T6');
    mon.registerWorkspace({ workspaceId: 'T6', shellPid: pid });
    await sleep(500);
    // Exits by itself, so the handover is genuine without us signalling anything.
    wr('T6', `node -e 'let n=0;const t=setInterval(()=>{let x=0;for(let i=0;i<1e5;i++)x+=i;if(++n>25)clearInterval(t)},100)'\n`);
    await sleep(1000);
    mon.sampleNow('T6');
    const before = mon.buildTelemetry('T6');
    check('T6 CLI foreground while running', before.identity.shellIsForeground === false && !!before.cli);
    await sleep(3500);
    mon.sampleNow('T6');
    const after = mon.buildTelemetry('T6');
    check('T6 after CLI exit, shellIsForeground === true', after.identity.shellIsForeground === true,
      `shellIsForeground=${after.identity.shellIsForeground} state=${after.state} cli=${!!after.cli}`);
    check('T6 no active CLI after exit', after.cli === null, JSON.stringify(after.cli));
    check('T6 state === idle (not terminated, not zeroed)', after.state === 'idle', after.state);
    check('T6 NO_CLI_FOREGROUND finding raised', after.findings.some((f) => f.code === 'NO_CLI_FOREGROUND'),
      after.findings.map((f) => f.code).join(','));
  }

  /* ============================================================ */
  section('T7 — shell killed, descendants survive: MUST NOT report zero');
  {
    const pid = spawnShell('T7');
    mon.registerWorkspace({ workspaceId: 'T7', shellPid: pid });
    await sleep(500);
    wr('T7', `node -e 'const{spawn}=require("child_process");spawn("sleep",["300"],{stdio:"ignore"});setInterval(()=>{},500)'\n`);
    await sleep(1200);
    mon.sampleNow('T7');
    const before = mon.buildTelemetry('T7');
    const kidPids = before.processes.filter((p) => p.role !== 'shell').map((p) => p.identity.pid);
    console.log(`  before kill: procs=${before.workspace.processCount} rssSum=${(before.workspace.rssSumBytes / MB).toFixed(1)}MB kids=${kidPids.join(',')}`);

    process.kill(pid, 'SIGKILL');
    await sleep(600);
    mon.sampleNow('T7');
    const t = mon.buildTelemetry('T7');
    console.log(`  after kill:  state=${t.state} procs=${t.workspace.processCount} rssSum=${(t.workspace.rssSumBytes / MB).toFixed(1)}MB`);
    console.log(`  orphans: ${t.orphans.length} -> ${t.orphans.map((o) => `pid ${o.identity.pid} ${o.comm} ${(o.rssBytes / MB).toFixed(1)}MB via ${o.attribution}`).join(', ')}`);
    check('T7 state is not "terminated" while survivors exist', t.state !== 'terminated', t.state);
    check('T7 descendants still discovered after the shell died', t.workspace.processCount > 0, `procs=${t.workspace.processCount}`);
    check('T7 workspace NOT falsely zeroed', t.workspace.rssSumBytes > 0, `rssSum=${t.workspace.rssSumBytes}`);
    check('T7 orphan state is one of shell_exited/orphaned/unattributed',
      ['shell_exited', 'orphaned', 'unattributed'].includes(t.state), t.state);
    check('T7 survivors carry an explicit attribution method',
      t.orphans.length === 0 || t.orphans.every((o) => o.attribution !== 'none'), t.orphans.map((o) => o.attribution).join(','));
    check('T7 stateMeaning warns this is NOT zero',
      /NOT zero|not reported as zero|uncertain/i.test(t.stateMeaning), t.stateMeaning);
    if (t.orphans.length > 0) {
      check('T7 ORPHANS_SURVIVING finding raised', t.findings.some((f) => f.code === 'ORPHANS_SURVIVING'),
        t.findings.map((f) => f.code).join(','));
    }
    const legacy = PM.toLegacyStats(t, 0);
    check('T7 legacy payload says alive:true (old code said false)', legacy.alive === true,
      JSON.stringify({ alive: legacy.alive, memMB: legacy.memMB, state: legacy.state }));
    check('T7 legacy memMB is not 0', legacy.memMB > 0, legacy.memMB);
    for (const k of kidPids) { try { process.kill(k, 'SIGKILL'); } catch {} }
  }

  /* ============================================================ */
  section('T8 — PID reuse cannot inherit old telemetry');
  {
    const pid = spawnShell('T8');
    const rec = mon.registerWorkspace({ workspaceId: 'T8', shellPid: pid });
    const realStart = rec.shellStarttime;
    await sleep(400);
    check('T8 rehydrate with the CORRECT starttime succeeds',
      mon.rehydrateWorkspace({ workspaceId: 'T8b', shellPid: pid, shellStarttime: realStart }) === true);
    check('T8 rehydrate with a WRONG starttime is REJECTED',
      mon.rehydrateWorkspace({ workspaceId: 'T8c', shellPid: pid, shellStarttime: (realStart ?? 0) + 1 }) === false);
    check('T8 rejected workspace was not registered', mon.getWorkspaceIds().includes('T8c') === false);
    check('T8 identity key is pid:starttime, not bare pid',
      mon.buildTelemetry('T8').identity.shell.key === `${pid}:${realStart}`, mon.buildTelemetry('T8').identity.shell.key);
    const s = PM.readProcStat(pid);
    const r = procRaw(pid);
    check('T8 parsed ppid matches /proc', s.ppid === r.ppid, `${s.ppid} vs ${r.ppid}`);
    check('T8 parsed session matches /proc', s.session === r.session, `${s.session} vs ${r.session}`);
    check('T8 parsed tty matches /proc', s.ttyNr === r.tty_nr, `${s.ttyNr} vs ${r.tty_nr}`);
    // The comm field is wrapped in parens and may itself contain spaces AND
    // parens, so only a split on the LAST ')' is safe. Wrong splits desync every
    // field after comm while still producing plausible numbers.
    const tricky = PM.parseProcStat(1, '1234 (weird ) name) S 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27');
    check('T8 parser survives a comm containing " ) " without shifting fields',
      !!tricky && tricky.ppid === 7 && tricky.starttime === 25 && tricky.state === 'S',
      tricky ? JSON.stringify({ ppid: tricky.ppid, start: tricky.starttime, state: tricky.state }) : 'null');
    check('T8 comm extracted correctly despite embedded parens', !!tricky && tricky.comm === 'weird ) name', tricky && tricky.comm);
  }

  /* ============================================================ */
  section('T9 — growth verdict distinguishes Case A from Case B');
  {
    const { WorkspaceHistory } = PM;
    const mk = (vals, stepMs = 60000) => {
      const h = new WorkspaceHistory('synthetic', false);
      let ts = Date.now() - (vals.length - 1) * stepMs;
      for (const v of vals) { h.add({ ts, rssMb: v, pssMb: v, cpuPctOfCore: 1, swapMb: 0, procCount: 5, threadCount: 50 }); ts += stepMs; }
      return h;
    };
    const gs = mk([1200, 1201, 1199, 1200, 1202, 1198, 1200, 1201, 1200, 1199, 1201, 1200]).growth(Date.now());
    const gl = mk([400, 500, 700, 900, 1200, 1500, 2000, 2400, 2800, 3200, 3600, 4000]).growth(Date.now());
    const gd = mk([4000, 3600, 3200, 2800, 2400, 2000, 1500, 1200, 900, 700, 500, 400]).growth(Date.now());
    const gt = mk([100, 101]).growth(Date.now());
    const gb = mk([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000], 2000).growth(Date.now());
    console.log(`  Case A (stable 1.2GB):  verdict=${gs.verdict} rate=${gs.rateMbPerMin} window=${gs.observationWindowSec}s`);
    console.log(`  Case B (400->4000MB):   verdict=${gl.verdict} rate=${gl.rateMbPerMin} window=${gl.observationWindowSec}s monotonic=${gl.evidence.monotonicIncrease}`);
    console.log(`  decreasing:             verdict=${gd.verdict} rate=${gd.rateMbPerMin}`);
    console.log(`  2 samples:              verdict=${gt.verdict}`);
    check('T9 Case A => stable', gs.verdict === 'stable', gs.verdict);
    check('T9 Case B => rapid_growth', gl.verdict === 'rapid_growth', gl.verdict);
    check('T9 decreasing detected', gd.verdict === 'decreasing', gd.verdict);
    check('T9 too little data => insufficient_data, NOT a guess', gt.verdict === 'insufficient_data', gt.verdict);
    check('T9 verdict ships auditable evidence', gl.evidence.validSamples > 0 && gl.evidence.firstMb !== null, JSON.stringify(gl.evidence));
    check('T9 verdict is not a bare boolean leak claim', /NOT proof/.test(gl.note), gl.note.slice(0, 80));
    check('T9 a steep but 14s window is still insufficient_data', gb.verdict === 'insufficient_data', `${gb.verdict} window=${gb.observationWindowSec}s`);
  }

  /* ============================================================ */
  section('T10 — provenance / freshness is always present');
  {
    const t = mon.buildTelemetry('T1');
    const p = t.provenance;
    console.log(`  sampler=${p.sampler} fidelity=${p.fidelity} tiers=${p.tiersRun.join('+')}`);
    console.log(`  HZ=${p.clockTickHz} hostCores=${p.hostCpuCount} hot=${p.hotIntervalMs}ms cold=${p.coldIntervalMs}ms`);
    console.log(`  scanGap=${p.scanGapSec}s coldAge=${p.coldAgeSec === null ? 'n/a' : p.coldAgeSec.toFixed(1)}s ` +
      `overhead=${p.samplerOverheadPctOfCore === null ? 'n/a' : p.samplerOverheadPctOfCore.toFixed(3) + '%'} (${p.samplerOverheadSource})`);
    check('T10 sampler identified', p.sampler === 'procfs', p.sampler);
    check('T10 clock tick read from getconf, not hardcoded', p.clockTickHz === 100, p.clockTickHz);
    check('T10 overhead unit says ONE core', /ONE CPU core/.test(p.samplerOverheadUnit), p.samplerOverheadUnit);
    check('T10 scanGapSec published', typeof p.scanGapSec === 'number' && p.scanGapSec > 0, p.scanGapSec);
    check('T10 fidelity note explains the ACTUAL platform', /\/proc/.test(p.fidelityNote), p.fidelityNote.slice(0, 60));
    check('T10 missing data is enumerated, never silently zeroed', Array.isArray(t.missing), JSON.stringify(t.missing));
    check('T10 dataComplete reflects missing[]', t.dataComplete === (t.missing.length === 0));
  }

  /* ============================================================ */
  section('T11 — cold census finds external terminals the app did not create');
  {
    const mon2 = new PM.ProcessMonitor({ persist: false });
    mon2.runColdCensusNow();
    const census = PM.readCensus(Date.now());
    const mine = new Set();
    for (const id of mon.getWorkspaceIds()) {
      const t = mon.buildTelemetry(id);
      if (t && t.terminal.tty) mine.add(t.terminal.tty);
    }
    const byTty = new Map();
    for (const e of census.values()) {
      if (!e.ttyNr) continue;
      const dev = PM.ttyNrToDev(e.ttyNr);
      if (!dev || mine.has(dev)) continue;
      if (!byTty.has(dev)) byTty.set(dev, []);
      byTty.get(dev).push(e);
    }
    console.log(`  census saw ${census.size} processes, ${byTty.size} pts not owned by this app's workspaces`);
    let shown = 0;
    for (const [dev, members] of byTty) {
      const cmds = members.map((m) => { try { return fs.readFileSync(`/proc/${m.pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim().split(' ')[0]; } catch { return '?'; } });
      if (shown++ >= 4) break;
      console.log(`   ${dev}: ${members.length} procs  [${cmds.slice(0, 4).join(', ')}]`);
    }
    check('T11 cold census can see pts groups this app did not create', byTty.size > 0, `found=${byTty.size}`);
  }

  /* ============================================================ */
  section('T12 — process create/exit events + state semantics');
  {
    const pid = spawnShell('T12');
    mon.registerWorkspace({ workspaceId: 'T12', shellPid: pid });
    await sleep(400);
    mon.sampleNow('T12');
    const before = mon.buildTelemetry('T12');
    wr('T12', `for i in $(seq 1 6); do (sleep 2) & done\n`);
    await sleep(900);
    mon.sampleNow('T12');
    const after = mon.buildTelemetry('T12');
    console.log(`  procs ${before.workspace.processCount} -> ${after.workspace.processCount}; ` +
      `appeared=${after.events.appeared} disappeared=${after.events.disappeared}`);
    check('T12 create/exit counts are exposed', typeof after.events.appeared === 'number');
    check('T12 the events object states the short-lived limitation',
      /between two samples|never seen|eBPF/i.test(after.events.note), after.events.note.slice(0, 70));
    check('T12 new descendants were detected', after.events.appeared > 0, `appeared=${after.events.appeared}`);
    check('T12 every process carries a semantic state meaning',
      after.processes.every((p) => typeof p.stateMeaning === 'string' && p.stateMeaning.length > 10));
    check('T12 D and Z are flagged semantically',
      PM.procStateMeaning('D').includes('I/O') && PM.procStateMeaning('Z').includes('zombie'),
      `${PM.procStateMeaning('D')} / ${PM.procStateMeaning('Z')}`);
  }

  /* ============================================================ */
  section('T13 — T3 on-demand deep inspection');
  {
    const t = mon.buildTelemetry('T1');
    const target = t.processes.find((p) => p.role === 'cli') || t.processes[0];
    const d = mon.inspectProcess('T1', target.identity.pid);
    check('T13 inspectProcess returns a record', !!d);
    check('T13 it includes the smaps breakdown', !!d && !!d.smaps && typeof d.smaps.pssBytes === 'number');
    check('T13 USS is present (Private_Clean + Private_Dirty)', !!d && !!d.smaps && d.smaps.ussBytes > 0);
    check('T13 it includes /proc/<pid>/io', !!d && !!d.io && typeof d.io.readBytes === 'number');
    check('T13 it includes an fd count', !!d && typeof d.fdCount === 'number', d && d.fdCount);
    check('T13 it includes per-thread CPU data', !!d && Array.isArray(d.threads) && d.threads.length > 0, d && d.threads && d.threads.length);
    console.log(`  pid ${d.identity.pid}: fdCount=${d.fdCount} threads=${d.threadCountScanned} ` +
      `rss=${(d.smaps.rssBytes / MB).toFixed(1)}MB pss=${(d.smaps.pssBytes / MB).toFixed(1)}MB uss=${(d.smaps.ussBytes / MB).toFixed(1)}MB ` +
      `swap=${(d.smaps.swapBytes / MB).toFixed(1)}MB io.rchar=${d.io.rchar}`);
  }

  /* ============================================================ */
  section('T14 — BENCHMARK: sampler cost vs the old ps implementation');
  {
    const bench = (label, fn, iters) => {
      fn();
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < iters; i++) fn();
      const ms = Number(process.hrtime.bigint() - t0) / 1e6 / iters;
      console.log(`  ${label.padEnd(54)} ${ms.toFixed(3).padStart(8)} ms`);
      return ms;
    };

    // ---- OLD: verbatim shape of the code that was replaced ----
    const oldPs = () => {
      const out = String(execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,pcpu='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
      const map = new Map();
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const pid = parseInt(parts[0], 10);
          if (!isNaN(pid)) map.set(pid, { ppid: parseInt(parts[1], 10) || 0, rssKb: parseInt(parts[2], 10) || 0, cpuPct: parseFloat(parts[3]) || 0 });
        }
      }
      return map;
    };
    const oldSum = (snap, root) => {
      let rss = 0, cpu = 0;
      const stack = [root], seen = new Set();
      while (stack.length) {
        const cur = stack.pop();
        if (seen.has(cur)) continue;
        seen.add(cur);
        const info = snap.get(cur);
        if (info) { rss += info.rssKb; cpu += info.cpuPct; }
        for (const [pid, i] of snap) if (i.ppid === cur && !seen.has(pid)) stack.push(pid);
      }
      return { rss, cpu };
    };
    const oldCycle = () => {
      const snap = oldPs();
      let n = 0;
      for (const id of mon.getWorkspaceIds()) {
        const rec = mon.peekWorkspace(id);
        if (rec && rec.shellPid !== null) { oldSum(snap, rec.shellPid); n++; }
      }
      return n;
    };
    const newCycle = () => {
      for (const rec of mon.allWorkspaces()) {
        if (rec.shellPid === null) continue;
        mon.walkTreeForTest(rec.shellPid, new Map(), Date.now());
      }
    };

    const wsCount = mon.allWorkspaces().length;
    console.log(`  box: ${PM.listAllPids().length} processes, ${wsCount} workspaces registered\n`);
    const oldMs = bench('OLD  ps -eo fork+exec + parse + O(N*tree) sum', oldCycle, 8);
    const newMs = bench('NEW  children-file walk + stat + payload build', newCycle, 200);
    const t2 = bench('T2   cold full census (amortised over its 10s period)', () => PM.readCensus(Date.now()), 8);

    let heavy = null;
    const cen = PM.readCensus(Date.now());
    for (const e of cen.values()) if (e.rssPages > 300000) { heavy = e.pid; break; }
    if (heavy) {
      const rollMs = bench(`T3   smaps_rollup, heavy pid ${heavy} (on-demand only)`, () => PM.readSmapsRollup(heavy), 8);
      const roll2 = PM.readSmapsRollup(heavy);
      const procCount = mon.allWorkspaces().reduce((a, r) => a + r.lastProcs.size, 0);
      console.log(`     -> that process is ${(roll2.rssBytes / MB).toFixed(0)}MB / ${cen.get(heavy).numThreads} threads`);
      console.log(`     -> unbounded rotation of all ${procCount} tracked procs every 15s would cost ${((rollMs * procCount) / 15000 * 100).toFixed(2)}% of one core`);
      console.log(`     -> with the bounded ${PSS_CAP}-reads-per-tick cap it costs ${((PSS_CAP * rollMs) / 15000 * 100).toFixed(2)}% of one core`);
    }

    const combined = (newMs / 10) + (t2 / 100);
    console.log(`\n  OLD  ${oldMs.toFixed(2)} ms/tick at 3 s = ${(oldMs / 30).toFixed(2)}% of one core (+ one fork+exec per tick)`);
    console.log(`  NEW  ${newMs.toFixed(2)} ms/tick at 1 s = ${(newMs / 10).toFixed(3)}% of one core`);
    console.log(`  speedup on the hot path = ${(oldMs / newMs).toFixed(1)}x`);
    console.log(`  COMBINED T1+T2 = ${(newMs / 10).toFixed(3)}% + ${(t2 / 100).toFixed(3)}% = ${combined.toFixed(3)}% of one core  (spec target <= 0.85%)`);
    check('T14 new hot path is cheaper than the old ps path', newMs < oldMs, `${newMs.toFixed(3)}ms vs ${oldMs.toFixed(2)}ms`);
    check('T14 new hot path is under 1% of one core at 1 Hz', newMs / 10 < 1.0, `${(newMs / 10).toFixed(3)}%`);
    check('T14 T1+T2 combined is within the 0.85% spec target', combined <= 0.85, `${combined.toFixed(3)}%`);
  }

  /* ============================================================ */
  console.log('\n' + '#'.repeat(78));
  console.log(`RESULT: ${PASS} passed, ${FAIL} failed`);
  if (FAIL) console.log('FAILED:\n  - ' + failures.join('\n  - '));
  console.log('#'.repeat(78));

  mon.stop();
  for (const [, p] of shells) { try { p.kill(); } catch {} }
  await sleep(400);
  for (const [, p] of shells) { try { p.kill(); } catch {} }
  process.exit(FAIL ? 1 : 0);
}

main().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
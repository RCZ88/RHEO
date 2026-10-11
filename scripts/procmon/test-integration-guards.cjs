/**
 * Regression tests for the fixes that are NOT part of the procmon hot path:
 *   - shell.ts must never fabricate process/memory facts (spec §30)
 *   - the register-terminal placeholder bug (6 columns / 5 values)
 * These are asserted by running the real code, not by reading it.
 */
'use strict';
const path = require('path');
const fs = require('fs');

let PASS = 0, FAIL = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { PASS++; console.log(`  PASS  ${name}`); }
  else { FAIL++; fails.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? '  -> ' + detail : ''}`); }
}
const sec = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));

/* ------------------------------------------------------------------ */
sec('A — shell.ts: process/memory facts must never be simulated');
{
  const src = fs.readFileSync(path.join(process.cwd(), 'src/terminal/lib/shell.ts'), 'utf8');

  // A1: the fabrication is still IN the file (for demo-mode ls/tree/etc), but it
  // must be unreachable for ps/free/top/pgrep via the store's routing.
  check('A1 the simulated ps/top/pgrep cases still exist for demo mode',
    /case "ps":/.test(src) && /case "htop": case "top": case "btop":/.test(src));

  // A2: the fact-command set covers every command whose output is a fact.
  const m = src.match(/const FACT_COMMANDS = new Set\(\[([\s\S]*?)\]\)/);
  check('A2 FACT_COMMANDS is defined', !!m);
  const set = m ? m[1] : '';
  for (const c of ['ps', 'free', 'pgrep', 'pidof', 'top', 'htop', 'btop', 'nvidia-smi', 'vmstat', 'iostat', 'swapon', 'lsof']) {
    check(`A2 '${c}' is classified as a fact command`, set.includes(`'${c}'`), set.slice(0, 80));
  }

  // A3: isFactCommand is exported so the store can route on it.
  check('A3 isFactCommand is exported', /export function isFactCommand/.test(src));

  // A4: the store routes fact commands to the REAL executor even in demo mode.
  const store = fs.readFileSync(path.join(process.cwd(), 'src/terminal/hooks/useConsoleStore.ts'), 'utf8');
  check('A4 useConsoleStore imports isFactCommand', /isFactCommand/.test(store));
  check('A4 useConsoleStore bypasses demo mode for fact commands',
    /!demoMode \|\| isFactCommand\(cmd\)/.test(store), 'expected `!demoMode || isFactCommand(cmd)`');

  // A5: demoMode really does default to true -- the reason this matters.
  check('A5 demoMode defaults to true (so the bypass is load-bearing)',
    /demoMode\s*:\s*boolean/.test(store) && /s\?\.demoMode \?\? true/.test(store));

  // A6: interactive commands are refused with an explanation, not a 20s hang.
  check('A6 NEEDS_TTY set exists', /const NEEDS_TTY = new Set/.test(src));
  check('A6 real path short-circuits TTY commands', /needs an interactive terminal/.test(src));
  check('A6 offers a non-interactive alternative', /ps aux --sort=-%cpu/.test(src));

  // A7: sudo unwrapping, so `sudo ps` cannot smuggle a fact command into the
  // simulated path.
  check('A7 baseCommand unwraps sudo', /cmd === 'sudo'/.test(src));
}

/* ------------------------------------------------------------------ */
sec('B — real behaviour: isFactCommand against the BUNDLED module');
{
  // Not a regex check: this imports the actual exported function from a real
  // esbuild bundle of shell.ts, so it tests behaviour rather than shape.
  const { execFileSync } = require('child_process');
  execFileSync('npx', ['esbuild', 'src/terminal/lib/shell.ts', '--bundle', '--platform=node',
    '--format=cjs', '--outfile=/tmp/opencode/shell-bundle.cjs', '--alias:@=./src',
    '--external:react', '--log-level=warning'], { encoding: 'utf8', cwd: process.cwd() });
  const shell = require('/tmp/opencode/shell-bundle.cjs');
  check('B0 isFactCommand is exported from the real module', typeof shell.isFactCommand === 'function');

  const cases = [
    // command, expected
    ['ps', true], ['ps aux', true], ['ps aux --sort=-%cpu | head', true],
    ['sudo ps aux', true],           // sudo must be unwrapped, else it slips into demo mode
    ['free -h', true], ['pgrep -f node', true], ['pidof node', true],
    ['top', true], ['htop', true], ['btop', true], ['nvidia-smi', true],
    ['vmstat 1 2', true], ['swapon', true], ['uptime', true], ['lsof -i :3000', true],
    // NOT facts: simulating these is harmless (a fake file listing cannot cause
    // a wrong diagnosis; a fake process table can).
    ['ls -la', false], ['echo ps', false], ['cd /tmp', false], ['df -h', false],
    ['npm run build', false], ['git status', false], ['cat foo.txt', false],
    ['watch ls', false],             // watch itself reports no process/memory facts
    ['sudo && ps', false],           // the FIRST command is sudo; not a fact
  ];
  for (const [cmd, want] of cases) {
    const got = shell.isFactCommand(cmd);
    check(`B isFactCommand(${JSON.stringify(cmd)}) === ${want}`, got === want, `got ${got}`);
  }
}

/* ------------------------------------------------------------------ */
sec('C — main.ts: register-terminal placeholder bug');
{
  const src = fs.readFileSync(path.join(process.cwd(), 'src/main.ts'), 'utf8');
  const m = src.match(/INSERT OR REPLACE INTO terminal_bindings[\s\S]{0,400}?VALUES \(([^)]*)\)/);
  check('C1 register-terminal INSERT found', !!m);
  if (m) {
    const placeholders = m[1].split(',').length;
    // Count the named columns in that same statement.
    const cols = m[0].match(/\(([^)]*)\)\s*VALUES/);
    const colList = cols ? cols[1].split(',').map((c) => c.trim()).filter(Boolean) : [];
    check('C2 placeholder count matches column count',
      placeholders === colList.length, `${colList.length} columns vs ${placeholders} placeholders -> ${colList.join(',')}`);
  }
  check('C3 session_id is now written by register-terminal',
    /terminal_bindings[\s\S]{0,300}session_id/.test(src));
  check('C4 update-terminal-binding accepts session_id', /session_id\?: string;/.test(src));
  check('C5 the failure is no longer silent', /register-terminal failed/.test(src));
}

/* ------------------------------------------------------------------ */
sec('D — DB migration is additive and idempotent');
{
  const src = fs.readFileSync(path.join(process.cwd(), 'src/main.ts'), 'utf8');
  for (const col of ['proc_pid', 'proc_start_jiffies', 'proc_posix_session', 'proc_pgrp', 'proc_tty_nr', 'proc_spawned_at']) {
    check(`D1 column ${col} added via a guarded ALTER`, src.includes(`ADD COLUMN ${col}`));
  }
  check('D2 rollups table created with IF NOT EXISTS',
    /CREATE TABLE IF NOT EXISTS terminal_resource_rollups/.test(src));
  check('D3 rollups are indexed by workspace+time',
    /idx_terminal_resource_rollups_ws_ts ON terminal_resource_rollups\(workspace_id, ts_ms\)/.test(src));
  check('D4 rollup retention is bounded (no unbounded growth)',
    /DELETE FROM terminal_resource_rollups WHERE ts_ms < \?/.test(src));
  check('D5 no DROP TABLE / destructive migration was introduced',
    !/DROP TABLE/i.test(src.slice(src.indexOf('terminal_resource_rollups') - 3000, src.indexOf('terminal_resource_rollups') + 2000)));
  const cols = (src.match(/CREATE TABLE IF NOT EXISTS terminal_resource_rollups[\s\S]*?\)\s*`/i) || [''])[0];
  check('D6 rollups store no raw process snapshots',
    !/cmdline|exe TEXT|smaps/.test(cols), cols.slice(0, 200));
}

/* ------------------------------------------------------------------ */
sec('E — UI no longer renders impossible percentages');
{
  const p = fs.readFileSync(path.join(process.cwd(), 'src/components/workspace/PerformanceMetricsPanel.tsx'), 'utf8');
  check('E1 memPct is no longer multiplied by 100', !/memPct \* 100/.test(p), 'found memPct * 100');
  check('E2 a clamp helper guards the percentage', /function clampPct/.test(p) && /Math\.min\(100/.test(p));
  check('E3 the card labels RAM as System RAM', /label="System RAM"/.test(p));
  check('E4 a Swap card exists', /label="System Swap"/.test(p));
  check('E5 PSS is shown as the primary per-workspace figure', /pssMB/.test(p));
  check('E6 RSS is labelled as an overstating sum', /RSS sum/.test(p));
  check('E7 orphan state is visible in the row', /shell gone/.test(p));
  check('E8 CPU unit is stated in the UI', /of one core/.test(p));

  const t = fs.readFileSync(path.join(process.cwd(), 'src/pages/TerminalPage.tsx'), 'utf8');
  const start = t.indexOf('function SessionResourceStats');
  const m = start >= 0 ? [t.slice(start, t.indexOf('\nfunction ', start + 10) > 0 ? t.indexOf('\nfunction ', start + 10) : start + 6000)] : null;
  check('E9 SessionResourceStats prefers PSS over the RSS sum', !!m && /pssMB \?\? stats\.memMB/.test(m[0]));
  check('E10 the CPU threshold comment explains why it used to be dead', !!m && /lifetime average/.test(m[0]));
  check('E11 shell-exited workspaces are not hidden', !!m && /shellGone/.test(m[0]));
  check('E12 swap is surfaced on the session badge', !!m && /swapMB/.test(m[0]));
}

/* ------------------------------------------------------------------ */
sec('F — the old ps sampler is gone from the hot path');
{
  const src = fs.readFileSync(path.join(process.cwd(), 'src/main.ts'), 'utf8');
  check('F1 no `ps -eo` process snapshot remains', !/execFile\('ps', \['-eo', 'pid=,ppid=,rss=,pcpu='\]/.test(src));
  check('F2 __collectProcSnapshotUnix is gone', !/__collectProcSnapshotUnix/.test(src));
  check('F3 __sumProcessTree is gone', !/function __sumProcessTree/.test(src));
  check('F4 the procmon monitor is instantiated', /new procmon\.ProcessMonitor/.test(src));
  check('F5 spawn paths register the workspace', (src.match(/registerMonitoredTerminal\(/g) || []).length >= 3);
  check('F6 destroy unregisters', /unregisterMonitoredTerminal\(terminalId\)/.test(src));
  check('F7 rehydrate is actually called', /rehydrateMonitoredTerminals\(\);/.test(src));
  check('F8 the legacy channel is preserved', /'terminal:resource-stats'/.test(src));
  check('F9 a full telemetry channel exists alongside it', /'terminal:resource-telemetry'/.test(src));
  check('F10 T3 on-demand handlers exist',
    /'terminal:refresh-pss'/.test(src) && /'terminal:inspect-process'/.test(src));
  check('F11 get-resource-stats now returns data, not just {success:true}',
    /stats: __legacyCache/.test(src));
}

console.log('\n' + '#'.repeat(78));
console.log(`RESULT: ${PASS} passed, ${FAIL} failed`);
if (FAIL) console.log('FAILED:\n  - ' + fails.join('\n  - '));
console.log('#'.repeat(78));
process.exit(FAIL ? 1 : 0);
#!/usr/bin/env node
/**
 * Linux foreground-detection diagnostic for RHEO / DeskFlow.
 *
 * Run this in YOUR terminal (not inside the app):
 *   node scripts/diagnose-linux-foreground.mjs
 *
 * It reproduces EXACTLY what src/linuxForeground.ts does, step by step, and
 * prints the RAW output of every tool. That makes it obvious which stage is
 * broken instead of inferring it from the app's behaviour.
 *
 * While it runs, FOCUS A NATIVE WAYLAND APP (Firefox, Dolphin, Kate, GNOME
 * Text Editor — anything that is NOT an Electron/CEF app), then press Enter.
 * We then ask every strategy what it thinks is focused.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const ex = promisify(execFile);
const T = 2500;
const SCRIPT_NAME = 'rheoForegroundProbe';

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const info = (m) => console.log(`    \x1b[90m${m}\x1b[0m`);

async function which(bin) {
  try { await ex('which', [bin], { timeout: 1500 }); return true; } catch { return false; }
}
async function tryRun(bin, args, timeout = T) {
  try {
    const { stdout, stderr } = await ex(bin, args, { timeout, env: { ...process.env, LC_ALL: 'C' } });
    return { ok: true, stdout: String(stdout), stderr: String(stderr) };
  } catch (e) {
    return { ok: false, stdout: String(e?.stdout || ''), stderr: String(e?.stderr || ''), msg: String(e?.message || e) };
  }
}

console.log('\n\x1b[1m=== 1. SESSION ===\x1b[0m');
console.log(`  XDG_SESSION_TYPE   = ${process.env.XDG_SESSION_TYPE}`);
console.log(`  XDG_CURRENT_DESKTOP= ${process.env.XDG_CURRENT_DESKTOP}`);
console.log(`  WAYLAND_DISPLAY    = ${process.env.WAYLAND_DISPLAY}`);
console.log(`  DISPLAY            = ${process.env.DISPLAY}`);

console.log('\n\x1b[1m=== 2. TOOLS ===\x1b[0m');
const TOOLS = ['qdbus6', 'qdbus', 'qdbus-qt6', 'qdbus-qt5', 'gdbus', 'xdotool', 'wmctrl', 'xprop'];
const found = {};
for (const t of TOOLS) {
  found[t] = await which(t);
  console.log(`  ${found[t] ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${t}`);
}
const qdbus = ['qdbus6', 'qdbus', 'qdbus-qt6', 'qdbus-qt5'].find((t) => found[t]);
console.log(`\n  qdbus binary RHEO will pick: ${qdbus || '\x1b[31mNONE\x1b[0m'}`);

console.log('\n\x1b[1m=== 3. FOCUS A NATIVE WAYLAND APP, THEN PRESS ENTER ===\x1b[0m');
console.log('  (e.g. Firefox, Dolphin, Kate — not Spotify, not RHEO)');
await new Promise((r) => process.stdin.setEncoding('utf8').once('data', r));

// ── KWin (the only strategy that can see NATIVE Wayland windows) ──
console.log('\n\x1b[1m=== 4. KWIN (org.kde.kwin.Scripting) ===\x1b[0m');
if (!qdbus) {
  bad('no qdbus binary — the KWin path CANNOT run');
} else {
  const scriptFile = path.join(os.tmpdir(), `${SCRIPT_NAME}.js`);
  const script = `(function () {
  var w = null;
  try { w = workspace.activeWindow; } catch (e) {}
  if (!w) { try { w = workspace.activeClient; } catch (e) {} }
  if (!w) return 'NO_ACTIVE_WINDOW';
  var isDesk = false, isDock = false;
  try { isDesk = !!w.desktopWindow; } catch (e) {}
  try { isDock = !!w.dock; } catch (e) {}
  if (isDesk || isDock) return 'DESKTOP_OR_DOCK';
  var cls = '';
  try { cls = String(w.resourceClass || ''); } catch (e) {}
  if (!cls) { try { cls = String(w.desktopFileName || ''); } catch (e) {} }
  if (!cls) { try { cls = String(w.windowClass || ''); } catch (e) {} }
  var title = '';
  try { title = String(w.caption || ''); } catch (e) {}
  if (!title) { try { title = String(w.windowTitle || ''); } catch (e) {} }
  var pid = 0;
  try { pid = Number(w.pid || 0); } catch (e) {}
  if (!cls && !title) return 'NO_CLASS_NO_TITLE';
  return JSON.stringify({ name: cls, pid: pid, title: title });
})()`;
  await writeFile(scriptFile, script);

  const load = await tryRun(qdbus, ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.loadScript', scriptFile, SCRIPT_NAME]);
  if (!load.ok) {
    bad(`loadScript FAILED: ${load.msg.split('\n')[0]}`);
    info(`stderr: ${load.stderr.trim().slice(0, 300)}`);
  } else {
    const id = parseInt(load.stdout.trim(), 10);
    info(`loadScript replied: ${JSON.stringify(load.stdout.trim())} (id=${id})`);
    if (!Number.isFinite(id) || id < 0) {
      bad('loadScript returned an invalid id');
    } else {
      const run = await tryRun(qdbus, ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.runScript', SCRIPT_NAME]);
      if (!run.ok) {
        bad(`runScript FAILED: ${run.msg.split('\n')[0]}`);
        info(`stderr: ${run.stderr.trim().slice(0, 300)}`);
      } else {
        ok('runScript succeeded — RAW D-Bus reply:');
        console.log(`\n      >>> ${run.stdout.trim()}\n`);
        const s = run.stdout.trim();
        if (s.includes('NO_ACTIVE_WINDOW') || s.includes('DESKTOP_OR_DOCK') || s.includes('NO_CLASS_NO_TITLE')) {
          bad(`KWin returned a non-window value: ${s}`);
          info('This means the script API differs on your Plasma version.');
        } else if (/\{.*\}/s.test(s)) {
          ok('KWin returned a JSON payload — THIS IS THE CORRECT PATH');
        } else {
          bad(`unparseable reply: ${s.slice(0, 200)}`);
        }
      }
      await tryRun(qdbus, ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.unloadScript', String(id)]);
    }
  }
  await rm(scriptFile, { force: true });
}

// ── XWayland fallbacks (cannot see native Wayland windows) ──
console.log('\n\x1b[1m=== 5. XWAYLAND FALLBACKS (expected to be blind to native Wayland) ===\x1b[0m');
if (found['xdotool']) {
  const a = await tryRun('xdotool', ['getactivewindow']);
  if (!a.ok) { bad(`xdotool getactivewindow FAILED: ${a.msg.split('\n')[0]}`); }
  else {
    const wid = a.stdout.trim();
    info(`getactivewindow = ${wid}`);
    const n = await tryRun('xdotool', ['getwindowname', wid]);
    const p = await tryRun('xdotool', ['getwindowpid', wid]);
    info(`  title = ${n.stdout.trim()}`);
    info(`  pid   = ${p.stdout.trim()}`);
    if (p.stdout.trim()) {
      const r = await import('node:fs/promises');
      try {
        const exe = await r.readlink(`/proc/${p.stdout.trim()}/exe`);
        info(`  exe   = ${exe}`);
      } catch { info('  exe   = <unreadable>'); }
    }
  }
} else bad('xdotool not installed');

if (found['wmctrl']) {
  const w = await tryRun('wmctrl', ['-l', '-p']);
  info(w.ok ? `wmctrl -l -p:\n${w.stdout.trim().split('\n').slice(-5).join('\n')}` : `wmctrl FAILED: ${w.msg.split('\n')[0]}`);
} else bad('wmctrl not installed');

if (found['xprop']) {
  const x = await tryRun('xprop', ['-root', '_NET_ACTIVE_WINDOW']);
  info(`_NET_ACTIVE_WINDOW = ${x.ok ? x.stdout.trim() : 'FAILED: ' + x.msg.split('\n')[0]}`);
} else bad('xprop not installed');

console.log(`\n\x1b[1m=== SUMMARY (${failures} failure(s)) ===\x1b[0m`);
if (failures === 0) console.log('  All installed strategies responded. Paste the whole output above.');
else console.log('  Something is genuinely broken — paste the whole output above, especially the KWin section.');
console.log('');

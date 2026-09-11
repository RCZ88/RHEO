#!/usr/bin/env node
// RHEO — Cross-platform dev launcher (Linux / macOS / Windows)
// Usage: node start-dev.js [--no-desktop] [--no-sync] [--build]
// or:   ./start-dev.js [--no-desktop] [--no-sync] [--build]
// (chmod +x on Unix; works as-is on Windows via node)

import { createRequire } from 'module';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI flags ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const NO_DESKTOP = args.includes('--no-desktop');
const NO_SYNC    = args.includes('--no-sync');
const FORCE_BUILD = args.includes('--build');

// ── platform helpers ───────────────────────────────────────────────
const PLATFORM = process.platform; // 'win32' | 'darwin' | 'linux'
const IS_WIN = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';
const IS_LIN = PLATFORM === 'linux';
const PLATFORM_LABEL = IS_WIN ? 'Windows' : IS_MAC ? 'macOS' : 'Linux';

function generateSecret() {
  // prefer openssl on Unix, otherwise node crypto
  let secret = '';
  if (!IS_WIN) {
    try {
      secret = execSync('openssl rand -base64 32', { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] })
        .trim().replace(/\+/g, '_').replace(/\//g, '_').replace(/=+$/, '');
    } catch {}
  }
  if (!secret) {
    try {
      const b = require('crypto').randomBytes(32);
      secret = b.toString('base64').replace(/\+/g, '_').replace(/=/g, '').replace(/\//g, '_');
    } catch {}
  }
  return secret || 'dev-secret-fallback';
}

function cmd(...parts) {
  // join with platform-appropriate separator
  return IS_WIN ? parts.join('.exe ') + '.exe' : parts.join(' ');
}

function spawnCmd(cmd, args, opts) {
  return spawn(cmd, args, { stdio: 'inherit', shell: IS_WIN, ...opts });
}

// ── print banner ───────────────────────────────────────────────────
console.log('============================================');
console.log(`    RHEO - Dev Startup (${PLATFORM_LABEL})`);
console.log('============================================');

// ── secrets ────────────────────────────────────────────────────────
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = generateSecret();
  process.env.JWT_SECRET = JWT_SECRET;
}
let RELAY_TICKET_SECRET = process.env.RELAY_TICKET_SECRET;
if (!RELAY_TICKET_SECRET) {
  RELAY_TICKET_SECRET = generateSecret();
  process.env.RELAY_TICKET_SECRET = RELAY_TICKET_SECRET;
}

console.log(`[keys] JWT_SECRET ............ ${JWT_SECRET.substring(0, 16)}...`);
console.log(`[keys] RELAY_TICKET_SECRET ... ${RELAY_TICKET_SECRET.substring(0, 16)}...`);

const SYNC_PORT = process.env.SYNC_PORT || '8787';
const RELAY_PORT = process.env.RELAY_PORT || '8788';

// ── sync server ────────────────────────────────────────────────────
let syncProcess = null;

if (!NO_SYNC) {
  console.log(`\n[server] Starting sync server on 0.0.0.0:${SYNC_PORT} ...`);
  const syncDir = join(__dirname, 'sync-server');

  if (!existsSync(syncDir)) {
    console.log(`[server] WARNING: sync-server/ not found at ${syncDir} — skipping sync server`);
  } else {
    const envFile = join(syncDir, '.env');
    if (!existsSync(envFile)) {
      const envContent = [
        `PORT=${SYNC_PORT}`,
        `HOST=0.0.0.0`,
        `DATABASE_URL=file:/tmp/rheo-sync.db`,
        `JWT_SECRET=${JWT_SECRET}`,
        `RELAY_TICKET_SECRET=${RELAY_TICKET_SECRET}`,
        `CORS_ORIGINS=*`,
      ].join('\n') + '\n';
      writeFileSync(envFile, envContent);
      console.log(`[server] Created ${envFile}`);
    }

    const env = {
      ...process.env,
      PORT: SYNC_PORT,
      HOST: '0.0.0.0',
      DATABASE_URL: 'file:./data/sync.db',
      JWT_SECRET,
      RELAY_TICKET_SECRET,
      CORS_ORIGINS: '*',
    };

    // Use npx tsx to run the sync server
    const tsx = IS_WIN ? 'npx.cmd' : 'npx';
    syncProcess = spawn(tsx, ['tsx', 'src/index.ts'], {
      cwd: syncDir,
      env,
      stdio: 'inherit',
      shell: IS_WIN,
    });
    console.log(`[server] Sync server started (PID ${syncProcess.pid})`);
    console.log('[server] Waiting for sync server to be ready...');
    await new Promise(r => setTimeout(r, 3000));

    // Attempt device pairing
    const pairUrl = `http://127.0.0.1:${SYNC_PORT}/v1/auth/pair`;
    const pairBody = JSON.stringify({ deviceName: 'desktop-dev', platform: PLATFORM });
    try {
      const result = execSync(
        IS_WIN
          ? `powershell -Command "Invoke-RestMethod -Uri '${pairUrl}' -Method Post -Body '${pairBody}' -ContentType 'application/json'"`
          : `curl -s -X POST '${pairUrl}' -H 'Content-Type: application/json' -d '${pairBody}'`,
        { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'], timeout: 5000 }
      );
      try {
        const json = JSON.parse(result);
        if (json.accessToken) {
          process.env.SYNC_ACCESS_TOKEN = json.accessToken;
          console.log('[sync] Paired desktop device');
        }
      } catch {
        console.log('[sync] Warning: Could not parse pair response');
      }
    } catch {
      console.log('[sync] Warning: Could not pair.');
    }
  }
}

// ── relay host ─────────────────────────────────────────────────────
let relayHost = process.env.RELAY_HOST;
if (!relayHost) {
  if (IS_LIN) {
    // try tailscale
    try {
      const tsIp = execSync('tailscale ip -4', { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }).trim();
      if (tsIp) {
        relayHost = tsIp;
        console.log(`[relay] Detected Tailscale IP: ${relayHost}`);
      }
    } catch {}
  }
  if (!relayHost && IS_MAC) {
    try {
      const tsIp = execSync('tailscale ip -4 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }).trim();
      if (tsIp && !tsIp.includes('error')) {
        relayHost = tsIp;
        console.log(`[relay] Detected Tailscale IP: ${relayHost}`);
      }
    } catch {}
  }
  if (!relayHost) {
    // fallback: get first non-loopback IPv4
    if (IS_WIN) {
      try {
        const ips = execSync(
          'powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike \\"*Loopback*\\" } | Select-Object -First 1 | ForEach-Object { $_.IPAddress }"',
          { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
        ).trim();
        if (ips) relayHost = ips;
      } catch {}
    } else {
      try {
        const ips = execSync('ip -4 addr show scope global 2>/dev/null | grep -oP "inet \\K[\\d.]+" | head -1', { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }).trim();
        if (ips) relayHost = ips;
      } catch {}
      if (!relayHost) {
        try {
          const hostnameIp = execSync('hostname -I 2>/dev/null | awk \'{print $1}\'', { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }).trim();
          if (hostnameIp) relayHost = hostnameIp;
        } catch {}
      }
    }
  }
  relayHost = relayHost || '127.0.0.1';
  if (relayHost !== '127.0.0.1') {
    console.log(`[relay] Using LAN IP: ${relayHost}`);
  } else {
    console.log(`[relay] Using localhost: ${relayHost}`);
  }
}

process.env.RELAY_PORT = RELAY_PORT;
process.env.SYNC_URL = `http://127.0.0.1:${SYNC_PORT}`;
if (!process.env.SYNC_ENC_KEY) {
  process.env.SYNC_ENC_KEY = generateSecret();
}
console.log(`[config] SYNC_URL = ${process.env.SYNC_URL}`);
console.log(`[config] RELAY_PORT = ${process.env.RELAY_PORT}`);

// ── desktop app ────────────────────────────────────────────────────
if (!NO_DESKTOP) {
  console.log(`\n[desktop] Starting RHEO app ...`);

  // kill stale RHEO instances (platform-appropriate)
  if (IS_WIN) {
    try {
      const stale = execSync(
        `powershell -Command "Get-CimInstance Win32_Process -Filter 'Name = \\"electron.exe\\" OR Name = \\"RHEO.exe\\"' | Where-Object { $_.CommandLine -like '*${__dirname}*' } | ForEach-Object { $_.ProcessId }"`,
        { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
      ).trim().split(/\s+/).filter(Boolean).map(Number);
      for (const pid of stale) {
        try {
          console.log(`[desktop] Killing stale RHEO instance (PID ${pid})...`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        } catch {}
      }
    } catch {}
  } else {
    try {
      // kill by project-specific electron binary path (works because
      // the binary lives under node_modules/electron/dist/electron in the project)
      const pids = execSync(
        `pgrep -af "${__dirname}/node_modules/electron" 2>/dev/null || true`,
        { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
      ).trim().split('\\n').filter(Boolean).map(Number);
      for (const pid of pids) {
        try {
          console.log(`[desktop] Killing stale RHEO instance (PID ${pid})...`);
          process.kill(pid, 'SIGKILL');
        } catch {}
      }
    } catch {}

    // kill whatever is holding our ports (stale relay / leftover processes)
    const RELAY_PORT_NUM = parseInt(RELAY_PORT, 10);
    for (const port of [RELAY_PORT_NUM]) {
      try {
        const portPids = execSync(
          `lsof -ti :${port} 2>/dev/null || true`,
          { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
        ).trim().split('\n').filter(Boolean).map(Number);
        for (const pid of portPids) {
          try {
            console.log(`[desktop] Killing process on port ${port} (PID ${pid})...`);
            process.kill(pid, 'SIGKILL');
          } catch {}
        }
      } catch {}
    }
  }

  // production mode — not vite dev server
  delete process.env.VITE_DEV_SERVER_URL;

  // ── build gating ────────────────────────────────────────────────
  console.log('[build] Checking staleness... ');

  const nodeModules = join(__dirname, 'node_modules');
  if (!existsSync(nodeModules)) {
    console.log('[build] node_modules missing. Running npm install...');
    execSync(IS_WIN ? 'npm.cmd install' : 'npm install', { cwd: __dirname, stdio: 'inherit' });
  }

  const preloadExists = existsSync(join(__dirname, 'dist-electron', 'preload.cjs'));
  const mainExists    = existsSync(join(__dirname, 'dist-electron', 'main.cjs'));
  const htmlExists    = existsSync(join(__dirname, 'dist', 'index.html'));
  let indexJsExists = false;
  try {
    const assets = require('fs').readdirSync(join(__dirname, 'dist', 'assets'));
    indexJsExists = assets.some(f => /^index-.*\.js$/.test(f));
  } catch {}

  let needBuild = FORCE_BUILD;
  let buildReason = '';

  if (FORCE_BUILD) {
    buildReason = 'Force rebuild (--build flag)';
  } else if (!preloadExists || !mainExists || !htmlExists || !indexJsExists) {
    needBuild = true;
    const missing = [];
    if (!preloadExists) missing.push('preload.cjs');
    if (!mainExists)    missing.push('main.cjs');
    if (!htmlExists)    missing.push('dist/index.html');
    if (!indexJsExists) missing.push('dist/assets/index-*.js');
    buildReason = `Missing: (${missing.join(', ')})`;
  }

  if (needBuild) {
    console.log(`[build] ${buildReason}`);

    if (!preloadExists) {
      console.log('[build] Building preload...');
      execSync(
        `npx esbuild "src/preload.ts" --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs`,
        { cwd: __dirname, stdio: 'inherit' }
      );
      if (process.exitCode !== 0) { console.log('[build] Preload failed!'); process.exit(1); }
    } else {
      console.log('[build] Preload OK (skipping)');
    }

    if (!mainExists) {
      console.log('[build] Building main...');
      execSync('node scripts/rebuild-main.mjs', { cwd: __dirname, stdio: 'inherit' });
      if (process.exitCode !== 0) { console.log('[build] Main build failed!'); process.exit(1); }
    } else {
      console.log('[build] Main OK (skipping)');
    }

    if (!htmlExists || !indexJsExists) {
      console.log('[build] Building renderer...');
      try {
        execSync('npx vite build', { cwd: __dirname, stdio: 'inherit' });
        console.log('[build] Renderer build OK');
      } catch (e) {
        console.log('[build] Renderer build failed!');
        process.exit(1);
      }
    } else {
      console.log('[build] Renderer OK (skipping)');
    }
  } else {
    console.log('[build] Skipped (use --build to force)');
  }

  // ── launch electron ──────────────────────────────────────────────
  // Find electron binary
  let electronCmd = null;
  const localBin = join(__dirname, 'node_modules', '.bin', IS_WIN ? 'electron.cmd' : 'electron');
  const localDist = join(__dirname, 'node_modules', 'electron', 'dist', IS_WIN ? 'electron.exe' : 'electron');
  const globalElectron = IS_WIN ? 'electron.cmd' : 'electron';

  if (existsSync(localBin)) electronCmd = localBin;
  else if (existsSync(localDist)) electronCmd = localDist;
  else if (isCommandAvailable(globalElectron)) electronCmd = globalElectron;
  else electronCmd = 'npx';

  if (!electronCmd) {
    console.log('[desktop] ERROR: electron not found. Install it: npm install electron');
    process.exit(1);
  }

  // sanity check: is it a real binary or a Windows PE on Linux?
  if (existsSync(electronCmd) && !IS_WIN) {
    try {
      const fileType = execSync(`file "${electronCmd}"`, { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
      if (fileType.includes('Windows')) {
        console.log('[desktop] WARNING: electron binary is a Windows executable.');
        console.log('[desktop] npm install was run on Windows. Run npm install on Linux first.');
        console.log('[desktop] Attempting launch anyway...');
      }
    } catch {}
  }

  console.log(`[desktop] Launching ${IS_WIN ? 'electron.cmd' : 'electron'}...`);
  const electronArgs = ['.'];
  // Force X11 on Linux to avoid Wayland SIGTRAP/SIGSEGV crashes
  if (!IS_WIN && process.env.ELECTRON_OZONE_PLATFORM !== 'wayland') {
    electronArgs.unshift('--ozone-platform=x11');
  }
  const electronEnv = { ...process.env };
  // Persist the user data directory across launches so Windows and Linux
  // share the same NTFS path (or fallback to Electron default).
  if (!electronEnv.ELECTRON_USER_DATA_DIR) {
    const LEGACY_USER_DATA_DIR = '/run/media/clementzhao/78FADEEEFADEA820/Users/cleme/Application Data/RHEO';
    if (existsSync(LEGACY_USER_DATA_DIR)) {
      electronEnv.ELECTRON_USER_DATA_DIR = LEGACY_USER_DATA_DIR;
    }
  }

  const child = IS_WIN
    ? spawn('cmd', ['/c', electronCmd, ...electronArgs], { cwd: __dirname, env: electronEnv, stdio: 'inherit' })
    : spawn(electronCmd, electronArgs, { cwd: __dirname, env: electronEnv, stdio: 'inherit' });

  console.log(`[desktop] RHEO started (PID ${child.pid}). Press Ctrl+C to terminate.`);

  const cleanup = () => {
    try { child.kill('SIGTERM'); } catch {}
    if (syncProcess) try { syncProcess.kill('SIGTERM'); } catch {}
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  // keep the launcher alive as long as electron runs
  child.on('error', (err) => {
    console.error('[desktop] Failed to start electron:', err.message);
    process.exit(1);
  });
} else {
  console.log(`\n=== Quick Reference ===`);
  console.log(`Sync server:     http://127.0.0.1:${SYNC_PORT}`);
  console.log(`Desktop relay:  ws://${relayHost}:${RELAY_PORT}`);
}

// ── helpers ────────────────────────────────────────────────────────
function isCommandAvailable(cmd) {
  try {
    if (IS_WIN) {
      execSync(`where ${cmd}`, { stdio: 'pipe' });
    } else {
      execSync(`command -v ${cmd}`, { stdio: 'pipe' });
    }
    return true;
  } catch {
    return false;
  }
}

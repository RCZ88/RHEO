import { app, ipcMain, BrowserWindow } from 'electron';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';

/**
 * Sync Server lifecycle manager — start/stop `rheo/sync-server` from the app.
 *
 * WHY THIS IS A SEPARATE MODULE (autoUpdate.ts pattern)
 * ----------------------------------------------------
 * `src/main.ts` is ~30,000 lines and is the most contended file in this repo.
 * Everything here is additive and independently loadable, so the manager is
 * wired with ONE import and ONE call, and removed the same way.
 *
 * OWNERSHIP RULES (mirrors aiRouterProcess.disposeRouter + §0.6 of AGENTS.md)
 * --------------------------------------------------------------------------
 * The app only ever signals a sync server THIS process spawned. A server the
 * user started in their own terminal (or via start-dev.sh) is reported as
 * "running (external)" and is never killed by the app. Stop is only offered
 * for managed instances.
 *
 * SECRETS ARE STABLE ACROSS RESTARTS
 * ----------------------------------
 * Paired devices hold JWTs signed with JWT_SECRET. The manager REUSES an
 * existing `sync-server/.env` (the same file start-dev.sh writes) so tokens
 * survive restarts, and only generates + persists secrets when that file has
 * none. It never regenerates secrets that already exist.
 *
 * LOG HYGIENE (the halo-diagnostic lesson: a 163 MB diagnostic log)
 * ----------------------------------------------------------------
 * Child output is kept in a 100-line ring buffer for the UI and mirrored to
 * `<userData>/sync-server.log`, truncated to 256 KB before each session so a
 * chatty server can never grow an unbounded file.
 *
 * Lifecycle: app quit stops ONLY the managed child (before-quit →
 * disposeSyncServer). If the app crashes, the server keeps serving — which is
 * the desirable failure direction for a device-facing service.
 */

export interface SyncServerStatus {
    running: boolean;            // something is LISTENING on the port
    managed: boolean;            // this app spawned it and may stop it
    starting: boolean;           // spawned, port not confirmed yet
    port: number;
    dirAvailable: boolean;       // sync-server/ exists next to the app (dev-only)
    unavailableReason?: string;  // 'not-found' when dirAvailable is false
    lastLine?: string;           // most recent child output line
    pid?: number;                // managed child pid
}

let child: ChildProcess | null = null;
let managed = false;
let starting = false;
let logLines: string[] = [];
const MAX_LOG_LINES = 100;
const MAX_LOG_FILE_BYTES = 256 * 1024;

/* ── paths + ports ─────────────────────────────────────────────────────── */

function syncDir(): string | null {
    try {
        const dir = path.join(app.getAppPath(), 'sync-server');
        if (fs.existsSync(path.join(dir, 'src', 'index.ts'))) return dir;
        return null;
    } catch { return null; }
}

function syncPort(): number {
    const raw = process.env.SYNC_PORT
        || (process.env.SYNC_URL || '').match(/:(\d+)/)?.[1]
        || '';
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : 8787;
}

/* ── port probe ────────────────────────────────────────────────────────── */

function probePort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect({ host: '127.0.0.1', port });
        let settled = false;
        const finish = (listening: boolean) => {
            if (settled) return;
            settled = true;
            try { socket.destroy(); } catch { /* ignore */ }
            resolve(listening);
        };
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.setTimeout(400, () => finish(false));
    });
}

/* ── .env (secrets) ────────────────────────────────────────────────────── */

function readEnvFile(envPath: string): Record<string, string> {
    try {
        const out: Record<string, string> = {};
        for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (m && !(m[1] in out)) out[m[1]] = m[2].trim();
        }
        return out;
    } catch { return {}; }
}

function genSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/** Reuse existing .env secrets (token stability); only generate what's missing. */
function ensureEnv(dir: string, port: number): NodeJS.ProcessEnv {
    const envPath = path.join(dir, '.env');
    const existing = readEnvFile(envPath);
    const jwt = existing['JWT_SECRET'] || genSecret();
    const relay = existing['RELAY_TICKET_SECRET'] || genSecret();
    const dbUrl = existing['DATABASE_URL'] || 'file:./data/sync.db';
    if (!existing['JWT_SECRET'] || !existing['RELAY_TICKET_SECRET']) {
        try {
            fs.writeFileSync(envPath,
                `PORT=${port}\nHOST=0.0.0.0\nDATABASE_URL=${dbUrl}\nJWT_SECRET=${jwt}\nRELAY_TICKET_SECRET=${relay}\nCORS_ORIGINS=*\n`);
            addLog('[syncsrv] wrote sync-server/.env (generated missing secrets)');
        } catch (err: any) {
            addLog(`[syncsrv] could not write .env: ${err?.message || err}`);
        }
    }
    return {
        ...process.env,
        PORT: String(port),
        HOST: '0.0.0.0',
        DATABASE_URL: dbUrl,
        JWT_SECRET: jwt,
        RELAY_TICKET_SECRET: relay,
        CORS_ORIGINS: '*',
    };
}

/* ── log buffer + capped file ──────────────────────────────────────────── */

function addLog(line: string): void {
    logLines.push(line);
    if (logLines.length > MAX_LOG_LINES) logLines = logLines.slice(-MAX_LOG_LINES);
    try {
        const logPath = path.join(app.getPath('userData'), 'sync-server.log');
        if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_FILE_BYTES) {
            fs.writeFileSync(logPath, '');
        }
        fs.appendFileSync(logPath, line + '\n');
    } catch { /* logging must never break the server */ }
}

/* ── status + broadcast (on TRANSITIONS, not per line) ─────────────────── */

async function computeStatus(): Promise<SyncServerStatus> {
    const dir = syncDir();
    const port = syncPort();
    const listening = !!dir && (starting ? true : await probePort(port));
    return {
        running: listening,
        managed,
        starting,
        port,
        dirAvailable: !!dir,
        unavailableReason: dir ? undefined : 'not-found',
        lastLine: logLines[logLines.length - 1],
        pid: child?.pid ?? undefined,
    };
}

function broadcast(status: SyncServerStatus): void {
    try {
        for (const win of BrowserWindow.getAllWindows()) {
            try { win.webContents.send('sync-server-status', status); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

async function refreshAndBroadcast(): Promise<void> {
    try { broadcast(await computeStatus()); } catch { /* ignore */ }
}

/* ── start / stop ──────────────────────────────────────────────────────── */

export async function startSyncServer(): Promise<{ ok: boolean; reason?: string; external?: boolean; starting?: boolean; pid?: number }> {
    const dir = syncDir();
    if (!dir) return { ok: false, reason: 'not-found' };
    if (child && (managed || starting)) return { ok: false, reason: 'already-starting' };

    const port = syncPort();
    if (await probePort(port)) {
        addLog(`[syncsrv] start refused — port ${port} already held by an external process`);
        return { ok: false, reason: 'port-busy', external: true };
    }

    const env = ensureEnv(dir, port);
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    let proc: ChildProcess;
    try {
        // detached → own process group → group-kill on stop (npx→tsx→node tree)
        proc = spawn(cmd, ['tsx', 'src/index.ts'], {
            cwd: dir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (err: any) {
        child = null;
        addLog(`[syncsrv] spawn failed: ${err?.message || err}`);
        return { ok: false, reason: 'spawn-failed' };
    }

    child = proc;
    starting = true;
    managed = false; // confirmed only when the port actually answers
    addLog(`[syncsrv] spawned (pid ${proc.pid}) — waiting for :${port}`);
    attachChild(proc, port);
    void pollUntilRunning(port);
    void refreshAndBroadcast();
    return { ok: true, starting: true, pid: proc.pid ?? undefined };
}

function attachChild(proc: ChildProcess, port: number): void {
    const onLine = (buf: any) => {
        for (const line of String(buf).split(/\r?\n/)) {
            if (line.trim()) addLog(line);
        }
    };
    proc.stdout?.on('data', onLine);
    proc.stderr?.on('data', onLine);
    proc.on('error', (err: any) => {
        addLog(`[syncsrv] child error: ${err?.message || err}`);
    });
    proc.on('exit', (code, signal) => {
        addLog(`[syncsrv] exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
        const wasStarting = starting;
        managed = false;
        starting = false;
        child = null;
        void refreshAndBroadcast();
        if (wasStarting) {
            addLog('[syncsrv] died before its port opened — see the last lines in Logs');
        }
        void port; // port kept for future restart logging
    });
}

async function pollUntilRunning(port: number): Promise<void> {
    for (let i = 0; i < 17; i++) {
        if (!child) return; // died or was stopped while polling
        if (await probePort(port)) {
            managed = true;
            starting = false;
            addLog(`[syncsrv] listening on :${port} — managed by the app`);
            await refreshAndBroadcast();
            return;
        }
        await new Promise((r) => setTimeout(r, 700));
    }
    if (child) {
        starting = false;
        addLog(`[syncsrv] port ${port} never opened — check Logs (config/port mismatch?)`);
        await refreshAndBroadcast();
    }
}

export async function stopSyncServer(): Promise<{ ok: boolean; reason?: string }> {
    const proc = child;
    if (!proc) return { ok: false, reason: 'not-managed' };
    const pid = proc.pid;
    addLog(`[syncsrv] stopping managed server (pid ${pid})`);
    try {
        if (pid) process.kill(-pid, 'SIGTERM');   // whole group: npx → tsx → node
        else proc.kill('SIGTERM');
    } catch {
        try { proc.kill('SIGTERM'); } catch { /* already gone */ }
    }
    managed = false;
    starting = false;
    child = null;
    setTimeout(() => { void refreshAndBroadcast(); }, 600);
    return { ok: true };
}

/** before-quit hook: stop ONLY the child this app spawned. */
export function disposeSyncServer(): void {
    const proc = child;
    if (!proc) return;
    const pid = proc.pid;
    try {
        if (pid) process.kill(-pid, 'SIGTERM');
        else proc.kill('SIGTERM');
    } catch { try { proc.kill('SIGTERM'); } catch { /* already gone */ } }
    // hard fallback if SIGTERM is ignored
    const t = setTimeout(() => {
        try { if (pid) process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
    }, 1500);
    if (typeof t.unref === 'function') t.unref();
    child = null;
    managed = false;
    starting = false;
}

/* ── IPC ───────────────────────────────────────────────────────────────── */

export function registerSyncServerIpc(): void {
    ipcMain.handle('sync-server:status', async () => {
        try { return await computeStatus(); } catch (err: any) {
            return { running: false, managed: false, starting: false, port: syncPort(), dirAvailable: false, unavailableReason: String(err?.message || err) };
        }
    });
    ipcMain.handle('sync-server:start', () => startSyncServer());
    ipcMain.handle('sync-server:stop', () => stopSyncServer());
    ipcMain.handle('sync-server:logs', () => ({ lines: logLines.slice(-80) }));
    console.log('[DeskFlow] sync-server manager: IPC registered (channels: status/start/stop/logs)');
}

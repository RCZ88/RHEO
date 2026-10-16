import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

// ===================================================================
// AI Router process supervisor.
//
// WHY THIS EXISTS
// ai-router is a separate Python service the user otherwise has to start by
// hand in a terminal. When it is down, EVERY call routed through the `airouter`
// provider fails — which reads to the user as "DeskFlow's AI is broken" rather
// than "a sidecar isn't running". This module lets the app own that lifecycle.
//
// HARD RULES (see agent/MEMORY.md + AGENTS.md §0.5/§0.6)
// 1. We kill ONLY a pid we spawned ourselves. There is no pattern-kill and no
//    `pkill` anywhere in this file. If the user started the router manually,
//    we detect it, adopt it read-only, and NEVER send it a signal.
// 2. Health-check BEFORE spawning, so a second DeskFlow window (or a manually
//    started router) never causes a second process fighting for port 4000.
// 3. Detached + unref'd, and stdout/stderr go to a log file. An unconsumed pipe
//    fills and deadlocks the child.
// 4. Never throw into the caller. A failure to start must surface as UI copy,
//    not an unhandled rejection in the main process.
// ===================================================================

export interface RouterConfig {
  /** Directory containing the ai-router checkout. */
  dir: string;
  /** Config file passed to `airouter run --config`. */
  configFile: string;
  /** Base URL used for the health probe and by the renderer. */
  baseUrl: string;
  /** Interpreter. The venv python, never bare `python`. */
  python: string;
  logFile?: string;
}

export type RouterState = 'running' | 'stopped' | 'starting' | 'external' | 'error';

export interface RouterStatus {
  state: RouterState;
  /** True when /health answered. */
  healthy: boolean;
  pid: number | null;
  /** True when WE spawned it (and therefore may stop it). */
  managed: boolean;
  baseUrl: string;
  /** Populated when state === 'error'. */
  message?: string;
  /** Populated when the config dir or interpreter is missing. */
  detail?: string;
  logFile?: string;
}

let child: ChildProcess | null = null;
let childPid: number | null = null;
/** PID we spawned. ONLY this is ever signalled. */
let managedPid: number | null = null;
let state: RouterState = 'stopped';
let message = '';
let starting = false;
let cfg: RouterConfig | null = null;

/** Defaults match this machine's checkout; overridable via userPreferences. */
export function defaultRouterConfig(baseUrl?: string): RouterConfig {
  const dir = '/home/clementzhao/dev/ai-router';
  return {
    dir,
    configFile: path.join(dir, 'config', 'providers.yaml'),
    python: path.join(dir, '.venv', 'bin', 'python'),
    baseUrl: (baseUrl || 'http://127.0.0.1:4000').replace(/\/+$/, ''),
    logFile: path.join(dir, 'airouter-deskflow.log'),
  };
}

export function configureRouter(c: Partial<RouterConfig> | undefined) {
  const base = defaultRouterConfig(c?.baseUrl);
  cfg = { ...base, ...(c || {}) } as RouterConfig;
}

function healthUrl(base: string): string {
  return `${base.replace(/\/+$/, '')}/health`;
}

/** Probe /health. Short timeout — this runs on the UI's polling path. */
export async function probeHealth(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(healthUrl(baseUrl), { signal: ctrl.signal });
    if (!res.ok) return false;
    const body: any = await res.json().catch(() => null);
    return !!body && (body.status === 'ok' || typeof body.providers_ready === 'number');
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function alive(pid: number | null): boolean {
  if (!pid || pid <= 0) return false;
  try {
    // Signal 0 performs the permission/existence check without delivering.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Cheap liveness for the pid WE own, without an HTTP round-trip. */
export function isManagedAlive(): boolean {
  return alive(managedPid);
}

export function currentStatus(): RouterStatus {
  const base = cfg?.baseUrl || 'http://127.0.0.1:4000';
  return {
    state,
    healthy: state === 'running' || state === 'external',
    pid: managedPid ?? child?.pid ?? null,
    managed: managedPid != null,
    baseUrl: base,
    message: message || undefined,
    logFile: cfg?.logFile,
  };
}

/** Environment gap check, surfaced verbatim in the UI so the user can fix it. */
export function diagnose(): { ok: boolean; detail?: string } {
  if (!cfg) return { ok: false, detail: 'Router not configured' };
  if (!fs.existsSync(cfg.dir)) {
    return { ok: false, detail: `ai-router directory not found: ${cfg.dir}` };
  }
  if (!fs.existsSync(cfg.python)) {
    return { ok: false, detail: `Python interpreter not found: ${cfg.python}` };
  }
  if (!fs.existsSync(cfg.configFile)) {
    return { ok: false, detail: `Config not found: ${cfg.configFile}` };
  }
  return { ok: true };
}

/**
 * Start the router if it is not already answering.
 *
 * Idempotent by design: this is safe to call on every routed request. If the
 * router is already up — whether we started it or the user did — it returns
 * immediately without spawning.
 */
export async function startRouter(opts?: { timeoutMs?: number }): Promise<RouterStatus> {
  if (!cfg) configureRouter(undefined);
  const timeoutMs = opts?.timeoutMs ?? 20000;

  // Rule 2: never race an already-healthy router.
  if (await probeHealth(cfg!.baseUrl)) {
    state = managedPid && alive(managedPid) ? 'running' : 'external';
    message = state === 'external' ? 'Router was already running outside DeskFlow.' : '';
    return currentStatus();
  }

  // Rule 1/2: if our previous child is somehow alive but unhealthy, do not
  // spawn a second one — that is how you get EADDRINUSE.
  if (managedPid && alive(managedPid)) {
    state = 'starting';
    message = 'Router process is alive but not answering /health yet.';
  } else {
    const diag = diagnose();
    if (!diag.ok) {
      state = 'error';
      message = diag.detail || 'ai-router is not installed at the expected path.';
      return currentStatus();
    }
    if (starting) return currentStatus();
    starting = true;
    state = 'starting';
    message = '';
    try {
      const out = fs.openSync(cfg!.logFile!, 'a');
      child = spawn(
        cfg!.python,
        ['-m', 'airouter', 'run', '--config', cfg!.configFile],
        {
          cwd: cfg!.dir,
          detached: true,          // own process group, so we can signal the tree
          stdio: ['ignore', out, out],
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        },
      );
      childPid = child.pid ?? null;
      managedPid = childPid;     // the ONLY pid we will ever signal
      child.unref();
      child.on('error', (err) => {
        state = 'error';
        message = `Failed to launch router: ${err.message}`;
        managedPid = null;
        childPid = null;
      });
    } catch (err: any) {
      state = 'error';
      message = `Failed to launch router: ${err?.message}`;
    } finally {
      starting = false;
    }
  }

  // Poll until healthy, bounded. uvicorn takes a moment to bind.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probeHealth(cfg!.baseUrl, 1000)) {
      state = 'running';
      message = '';
      return currentStatus();
    }
    // If the child died during boot, stop waiting immediately.
    if (managedPid && !alive(managedPid)) {
      state = 'error';
      message = `Router exited during startup. See ${cfg!.logFile} for details.`;
      managedPid = null;
      childPid = null;
      return currentStatus();
    }
    await new Promise(r => setTimeout(r, 400));
  }

  state = 'error';
  message = `Router did not become healthy within ${Math.round(timeoutMs / 1000)}s. See ${cfg!.logFile}.`;
  return currentStatus();
}

/**
 * Stop the router — but ONLY the one we spawned.
 *
 * If the router is healthy and `managedPid` is null, it was started outside
 * DeskFlow and we leave it completely alone. This is the whole point: a user
 * who runs the router in their own terminal keeps it.
 */
export async function stopRouter(): Promise<RouterStatus> {
  const pid = managedPid;
  if (!pid) {
    const healthy = cfg ? await probeHealth(cfg.baseUrl) : false;
    state = healthy ? 'external' : 'stopped';
    message = healthy
      ? 'Router is running outside DeskFlow — left it alone. Stop it from the terminal you started it in.'
      : '';
    return currentStatus();
  }
  if (!alive(pid)) {
    managedPid = null; childPid = null; state = 'stopped'; message = '';
    return currentStatus();
  }
  try {
    // Negative pid targets the process GROUP (we spawned detached), so uvicorn's
    // workers and any grandchildren go with it. Never a pattern match.
    process.kill(-pid, 'SIGTERM');
  } catch {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  // Give it a moment to release the port, then escalate.
  for (let i = 0; i < 20; i++) {
    if (!alive(pid)) break;
    await new Promise(r => setTimeout(r, 100));
  }
  if (alive(pid)) {
    try { process.kill(-pid, 'SIGKILL'); } catch { /* ignore */ }
  }
  managedPid = null; childPid = null; child = null;
  state = 'stopped'; message = '';
  return currentStatus();
}

export async function restartRouter(): Promise<RouterStatus> {
  await stopRouter();
  await new Promise(r => setTimeout(r, 400));
  return startRouter();
}

/** Called on app quit. Only ever signals our own child. */
export function disposeRouter() {
  const pid = managedPid;
  if (!pid || !alive(pid)) { managedPid = null; return; }
  try { process.kill(-pid, 'SIGTERM'); } catch { /* best-effort at exit */ }
  managedPid = null;
}

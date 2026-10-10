/**
 * ai-router IPC handlers.
 *
 * DeskFlow talks to the router in two directions:
 *   1. AS A PROVIDER — `chat/completions` on the router's OpenAI-compatible
 *      surface. That path needs no handler at all; it is the normal provider
 *      call path (see `services/providers/templates.ts` -> `airouter`).
 *   2. AS A CONSOLE — this module. The renderer needs to show which providers
 *      are actually live, what the failover chains look like, and why a node was
 *      skipped. That data lives behind the router's admin API, which the
 *      renderer cannot reach: it is a separate local service and the renderer
 *      has no business making arbitrary network calls.
 *
 * Everything here goes through the MAIN process, which keeps the router URL in
 * one place and means a router that is simply not running returns a clean
 * "offline" state instead of a stack trace in the UI.
 *
 * Every handler returns a discriminated `{ ok: boolean, ... }` and NEVER throws
 * on a transport failure. A router that is down is a normal condition the UI
 * must render, not an exception.
 */

import { ipcMain } from 'electron';

// ── WHY THIS IS A STATIC IMPORT, NOT require() ─────────────────────────────
// These were `require('../../…')` calls. That path is correct for the SOURCE
// file but wrong for the OUTPUT: the build leaves a bare require() in
// dist-electron/main.cjs, where `../../` resolves ABOVE the repo root.
// The aiEval twin of this bug KILLED THE APP AT BOOT:
//     Cannot find module '../../services/aiEval'
// These ones never threw, because each sat inside `catch {}` — which converts a
// crash into a SILENT NO-OP. `airouter` has been quietly failing to configure
// its router this entire time. Silence is strictly worse than a crash.
// A static import is inlined by the bundler, so there is no path to misresolve.
// Verified: none of these modules run code at module scope.
import * as RouterProcess from '../../services/aiRouterProcess';

/** Default matches the router default in ai-router/config. Overridable per call. */
const DEFAULT_ROUTER_URL = 'http://127.0.0.1:4000';

const REQUEST_TIMEOUT_MS = 4000;

interface RouterFetchOptions {
  path: string;
  baseUrl?: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}

function normalizeBaseUrl(raw?: string): string {
  const candidate = (raw || DEFAULT_ROUTER_URL).trim().replace(/\/+$/, '');
  // Validate up front so a typo produces an honest message instead of a
  // "fetch failed" from Node, which tells the user nothing.
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_ROUTER_URL;
    }
    return url.origin;
  } catch {
    return DEFAULT_ROUTER_URL;
  }
}

/**
 * Single place that actually touches the router socket.
 * Returns a plain result object instead of throwing so callers stay simple.
 */
async function routerFetch<T>(options: RouterFetchOptions): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const url = `${baseUrl}${options.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      signal: controller.signal,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
      // Surface the router's own message where it gave one — its error text is
      // far more actionable than the status code (e.g. CalDAV-style hints).
      let detail = '';
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.detail || parsed?.error || '';
      } catch {
        detail = text.slice(0, 200);
      }
      return { ok: false, error: detail || `Router responded ${response.status}` };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, error: 'Router returned a response DeskFlow could not parse' };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: `Router did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Is it still starting?` };
    }
    // ECONNREFUSED is the overwhelmingly common case: the user has not started
    // the router. Say that specifically, because "fetch failed" is useless.
    const code = err?.cause?.code || err?.code || '';
    if (code === 'ECONNREFUSED') {
      return { ok: false, error: `No router listening at ${baseUrl}. Start it with: airouter run` };
    }
    return { ok: false, error: err?.message || 'Could not reach the AI router' };
  } finally {
    clearTimeout(timer);
  }
}

export function registerAirRouterHandlers(deps: {
  getRouterUrl?: () => string | undefined;
  /** Optional hook so a routed AI call can bring the router up on demand. */
  onRouterNeeded?: () => Promise<void>;
} = {}) {
  const configuredUrl = () => {
    try {
      return normalizeBaseUrl(deps.getRouterUrl?.());
    } catch {
      return DEFAULT_ROUTER_URL;
    }
  };

  /** Keep the process supervisor pointed at whatever URL is configured. */
  const syncSupervisor = () => {
    try {
      const P = RouterProcess;
      P.configureRouter({ baseUrl: configuredUrl() });
    } catch { /* supervisor is optional */ }
  };
  syncSupervisor();

  // ---- process lifecycle (new) ----
  ipcMain.handle('airouter:process-status', async () => {
    try {
      const P = RouterProcess;
      syncSupervisor();
      const st = P.currentStatus();
      // Fold a live health probe in, so a router the user started in their own
      // terminal reports healthy even though we do not manage its pid.
      const healthy = await P.probeHealth(st.baseUrl);
      return { ...st, healthy, state: healthy ? (st.managed ? 'running' : 'external') : st.state };
    } catch (err: any) {
      return { state: 'error', healthy: false, managed: false, pid: null, baseUrl: DEFAULT_ROUTER_URL, message: err?.message };
    }
  });

  ipcMain.handle('airouter:start', async () => {
    try {
      const P = RouterProcess;
      syncSupervisor();
      console.log('[DeskFlow] ▶ starting AI Router…');
      const st = await P.startRouter();
      console.log(`[DeskFlow] AI Router state=${st.state}${st.message ? ' — ' + st.message : ''}`);
      return st;
    } catch (err: any) {
      return { state: 'error', healthy: false, managed: false, pid: null, message: err?.message };
    }
  });

  ipcMain.handle('airouter:stop', async () => {
    try {
      const P = RouterProcess;
      syncSupervisor();
      return await P.stopRouter();
    } catch (err: any) {
      return { state: 'error', healthy: false, managed: false, pid: null, message: err?.message };
    }
  });

  ipcMain.handle('airouter:restart', async () => {
    try {
      const P = RouterProcess;
      syncSupervisor();
      return await P.restartRouter();
    } catch (err: any) {
      return { state: 'error', healthy: false, managed: false, pid: null, message: err?.message };
    }
  });

  ipcMain.handle('airouter:diagnose', async () => {
    try {
      const P = RouterProcess;
      syncSupervisor();
      return P.diagnose();
    } catch (err: any) {
      return { ok: false, detail: err?.message };
    }
  });

  /** Full provider health: which nodes are live, cooldowns, config summary. */
  ipcMain.handle('airouter:status', async (_event, opts?: { baseUrl?: string }) => {
    const baseUrl = normalizeBaseUrl(opts?.baseUrl || configuredUrl());
    if (opts?.autostart !== false) { try { await deps.onRouterNeeded?.(); } catch { /* best-effort */ } }
    const result = await routerFetch<Record<string, any>>({ path: '/router/status', baseUrl });
    if (!result.ok) return { ok: false, error: result.error, baseUrl };
    return { ok: true, ...result.data, baseUrl };
  });

  /** Group definitions + the failover chain for each, with live availability. */
  ipcMain.handle('airouter:groups', async (_event, opts?: { baseUrl?: string }) => {
    const baseUrl = normalizeBaseUrl(opts?.baseUrl || configuredUrl());
    const result = await routerFetch<Record<string, any>>({ path: '/router/groups', baseUrl });
    if (!result.ok) return { ok: false, error: result.error, baseUrl };
    return { ok: true, ...result.data, baseUrl };
  });

  /** Recent request log — answers "why did it pick that provider?". */
  ipcMain.handle('airouter:log', async (_event, opts?: { baseUrl?: string; limit?: number }) => {
    const baseUrl = normalizeBaseUrl(opts?.baseUrl || configuredUrl());
    const limit = Math.min(Math.max(Number(opts?.limit) || 25, 1), 200);
    const result = await routerFetch<Record<string, any>>({ path: `/router/log?n=${limit}`, baseUrl });
    if (!result.ok) return { ok: false, error: result.error, baseUrl };
    return { ok: true, ...result.data, baseUrl };
  });

  /**
   * Cheap liveness probe for the connect button.
   *
   * NOTE THE PATH: `/health`, NOT `/v1/health`. The health route is registered
   * on its own router with no prefix, so the `/v1/health` guess returns 404
   * even when the router is perfectly healthy — which would have shown the
   * user "router offline" while it was serving requests. Verified against the
   * running router: GET /health -> 200 {"status":"ok","providers_ready":3}.
   */
  ipcMain.handle('airouter:ping', async (_event, opts?: { baseUrl?: string }) => {
    const baseUrl = normalizeBaseUrl(opts?.baseUrl || configuredUrl());
    const started = Date.now();
    const result = await routerFetch<{ status?: string; providers_ready?: number }>({ path: '/health', baseUrl });
    const latencyMs = Date.now() - started;
    return result.ok
      ? { ok: true, baseUrl, latencyMs, providersReady: result.data?.providers_ready }
      : { ok: false, baseUrl, error: result.error, latencyMs };
  });

  /** Clear a provider's cooldowns after the user adds a key or fixes a URL. */
  ipcMain.handle('airouter:reset-provider', async (_event, opts: { provider: string; baseUrl?: string }) => {
    const name = String(opts?.provider || '').trim();
    if (!name) return { ok: false, error: 'No provider named' };
    const baseUrl = normalizeBaseUrl(opts?.baseUrl || configuredUrl());
    const result = await routerFetch<Record<string, any>>({
      path: `/router/providers/${encodeURIComponent(name)}/reset`,
      baseUrl,
      method: 'POST',
    });
    if (!result.ok) return { ok: false, error: result.error, baseUrl };
    return { ok: true, ...result.data, baseUrl };
  });

  /** Reset every cooldown at once — the "try again" button after adding keys. */
  ipcMain.handle('airouter:reset-cooldowns', async (_event, opts?: { baseUrl?: string }) => {
    const baseUrl = normalizeBaseUrl(opts?.baseUrl || configuredUrl());
    const result = await routerFetch<Record<string, any>>({
      path: '/router/cooldowns/reset',
      baseUrl,
      method: 'POST',
    });
    if (!result.ok) return { ok: false, error: result.error, baseUrl };
    return { ok: true, ...result.data, baseUrl };
  });
}
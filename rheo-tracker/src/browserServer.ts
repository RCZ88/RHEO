import * as http from 'node:http';
import { BROWSER_PORT, log, warn } from './config';
import { categorizeApp, categorizeDomain } from './categories';
import { commitLog } from './db';
import { current } from './session';

/**
 * Stand-in for startBrowserTrackingServer() (src/main.ts:21205) so website
 * tracking survives the app being closed. The extension already targets
 * localhost:54321 and needs no change.
 *
 * Only started while the daemon owns tracking — two processes binding 54321 is
 * exactly the EADDRINUSE failure the coordination protocol calls out.
 *
 * Payload shape is taken verbatim from browser-extension/background.js:427-443
 * (tab switch) and :471-489 (periodic delta).
 */

interface BrowserPayload {
  url?: string;
  domain?: string;
  title?: string;
  tab_id?: number;
  timestamp?: string;
  active_duration_ms?: number;
  sanitized_url?: string;
  is_periodic?: boolean;
  delta_ms?: number;
  is_browser_focused?: boolean;
  profileId?: string;
  browserName?: string;
}

const MAX_BODY_BYTES = 256 * 1024;

/** Process names the extension reports, mapped back to the app rows they belong to. */
function appForBrowser(browserName: string | undefined): string {
  const lower = (browserName || '').toLowerCase();
  if (!lower) return 'browser';
  return lower.replace(/\s*browser$/, '').replace(/[^a-z0-9]/g, '') || 'browser';
}

function writeJson(res: http.ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function ingest(payload: BrowserPayload): { ok: boolean; reason?: string } {
  const domain = (payload.domain || '').trim();
  const duration = Math.floor(payload.delta_ms || payload.active_duration_ms || 0);
  if (!domain) return { ok: false, reason: 'missing domain' };
  if (duration < 1000) return { ok: false, reason: 'sub-second payload' };

  // The extension sends a DELTA, and the app's browser_sessions aggregate sums
  // this column. Sending the cumulative session total instead would count the
  // same seconds once per tick — quadratic growth within a single tab visit.
  const timestamp = payload.timestamp && !Number.isNaN(Date.parse(payload.timestamp))
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();

  const browser = appForBrowser(payload.browserName);
  const category = categorizeDomain(domain);
  const title = (payload.title || domain).slice(0, 300);

  const ok = commitLog(
    {
      timestamp,
      app: browser,
      category,
      duration_ms: duration,
      title,
      url: payload.url ?? null,
      domain,
      tab_id: typeof payload.tab_id === 'number' ? payload.tab_id : null,
      is_browser_tracking: 1,
      platform: 'linux',
      source: 'auto',
    },
    {
      timestamp,
      app: browser,
      category,
      duration_ms: duration,
      domain,
      is_browser_tracking: 1,
    },
  );
  if (!ok) return { ok: false, reason: 'DB write failed' };
  log(`browser ${domain} ${Math.round(duration / 1000)}s via ${payload.browserName || 'unknown'}`);
  return { ok: true };
}

/**
 * Resolves with the listening server, or null if the port was unavailable.
 *
 * It NEVER rejects and NEVER leaves the promise unsettled. That is deliberate and
 * was a hard bug: the 'error' handler returned without resolving, so on EADDRINUSE
 * the promise hung forever, the caller's top-level `await` never returned, and the
 * poll loop below it never started — the daemon ran, logged nothing, and tracked
 * nothing. A hung promise in a boot path is a silent total failure.
 */
export function startBrowserServer(): Promise<http.Server | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: http.Server | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const server = http.createServer((req, res) => {
      // Same permissive CORS the app sets, so the extension's preflight passes.
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const pathOnly = (req.url || '').split('?')[0];

      if (req.method === 'GET' && pathOnly === '/health') {
        writeJson(res, 200, { ok: true, server: 'rheo-tracker', source: 'daemon' });
        return;
      }

      if (req.method === 'GET' && pathOnly === '/foreground-app') {
        const state = current();
        writeJson(res, 200, {
          app: state.app,
          category: state.category ? categorizeApp(state.app || '') : null,
          title: state.title,
          platform: 'linux',
          source: 'rheo-tracker',
        });
        return;
      }

      if (req.method === 'POST' && pathOnly === '/browser-identify') {
        readBody(req)
          .then(() => writeJson(res, 200, { ok: true }))
          .catch(() => writeJson(res, 400, { ok: false }));
        return;
      }

      if (req.method === 'POST' && (pathOnly === '/browser-data' || pathOnly === '/code-activity')) {
        readBody(req)
          .then((body) => {
            if (!body) {
              writeJson(res, 200, { ok: true, skipped: 'empty' });
              return;
            }
            const result = ingest(JSON.parse(body) as BrowserPayload);
            // A rejected payload is a client problem, not a server fault: 200 with
            // a reason keeps the extension from marking the server unhealthy.
            writeJson(res, result.ok ? 200 : 200, result);
          })
          .catch((err: Error) => writeJson(res, 400, { ok: false, reason: err.message }));
        return;
      }

      writeJson(res, 404, { ok: false, error: 'not found' });
    });

    // EPIPE kills an unhandled 'error' event on the socket and takes the whole
    // daemon with it. The extension aborts requests on a 2s timeout, so this
    // fires constantly in normal operation.
    server.on('clientError', (_err, socket) => {
      if (socket && !socket.destroyed) socket.destroy();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        warn(`port ${BROWSER_PORT} already in use — another browser server is live, skipping`);
        settle(null);
        return;
      }
      warn('browser server error:', err.message);
      settle(null);
    });

    server.listen(BROWSER_PORT, '127.0.0.1', () => {
      log(`browser ingest listening on 127.0.0.1:${BROWSER_PORT}`);
      settle(server);
    });
  });
}

export async function stopBrowserServer(server: http.Server | null): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    // Don't let a lingering keep-alive socket hold the unit open during shutdown.
    server.closeAllConnections?.();
    setTimeout(resolve, 2000);
  });
  log('browser ingest stopped');
}
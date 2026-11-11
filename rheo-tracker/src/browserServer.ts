import * as http from 'node:http';
import {
  BROWSER_PORT,
  BROWSER_MAX_DELTA_MS,
  BROWSER_SNAPSHOT_CEILING_MS,
  log,
  warn,
} from './config';
import { categorizeApp, categorizeDomain } from './categories';
import {
  commitBrowserPayload,
  isProfileTrackingAllowed,
} from './db';
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

// ── FOCUS RESOLUTION ────────────────────────────────────────────────────────
// Copied from src/main.ts:8928-8959 (BROWSER_PROCESS_NAMES + isAppMatchingBrowser)
// so BOTH writers reach the SAME verdict for the same payload. The two processes
// trade ownership of tracking; if their focus rules differed, a session the app
// accepted would be skipped by the daemon (or vice versa) and totals would jump
// at every app start/close.
//
// The firefox entry is fork-rich ON PURPOSE (see the app's comment): Zen ships a
// stock Firefox UA in some builds, the OS names the process "zen", and the
// extension may self-report "Firefox" — a bare ["firefox"] list rejects every
// payload from a healthy extension. The over-claim tradeoff is the app's own,
// made 2026-10-16.
const BROWSER_PROCESS_NAMES: Record<string, string[]> = {
  comet: ['chrome', 'comet', 'chromium'],
  chrome: ['chrome', 'chromium'],
  brave: ['brave', 'chrome'],
  edge: ['msedge', 'edge'],
  opera: ['opera'],
  vivaldi: ['vivaldi'],
  firefox: ['firefox', 'firefox-esr', 'zen', 'zen-browser', 'zenbrowser', 'floorp', 'librewolf', 'waterfox', 'mullvad', 'basilisk', 'ghost-browser'],
  arc: ['arc'],
  safari: ['safari'],
  zen: ['zen', 'zen-browser', 'zenbrowser'],
};

function getBrowserProcessNames(browserName: string): string[] {
  const key = (browserName || '').toLowerCase();
  return BROWSER_PROCESS_NAMES[key] || [key];
}

function isAppMatchingBrowser(appName: string, browserName: string): boolean {
  if (!appName || !browserName) return false;
  const appLower = appName.toLowerCase().replace(/\.exe$/i, '');
  const browserLower = browserName.toLowerCase();
  return appLower.includes(browserLower) ||
    browserLower.includes(appLower) ||
    getBrowserProcessNames(browserName).some((p) => appLower.includes(p));
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

/**
 * What a payload MEANS (browser-extension/background.js:488-529 tab switch,
 * :532-573 periodic delta) — the two shapes do NOT mean the same thing:
 *
 *   periodic   : is_periodic=true,  timestamp = SYNC time (changes each tick),
 *                active_duration_ms = delta since the last sync (<= 5 min).
 *   tab switch : is_periodic=false, timestamp = SESSION START (constant),
 *                active_duration_ms = the CUMULATIVE session total.
 *
 * The old ingest ran `delta_ms || active_duration_ms`. A tab switch's delta_ms
 * is 0 — falsy — so every snapshot resolved to the WHOLE session, and since
 * every payload was INSERTed blind, a session re-delivered N times became N
 * full-length rows. 252 rows at one timestamp = 252 h of a 24-h day. The
 * collapse and the blind insert had to BOTH go: magnitude is now selected by
 * shape, and the write goes through commitBrowserPayload(), which adopts /
 * raises / adds against the database as the session registry.
 */
function ingest(payload: BrowserPayload): { ok: boolean; reason?: string; replay?: boolean } {
  const domain = (payload.domain || '').trim();
  const isPeriodic = payload.is_periodic === true;
  // Shape selection — never `||` across the two fields again. A snapshot's
  // delta_ms is 0 BY DESIGN; reading it as "no duration" and falling through to
  // active_duration_ms is precisely the collapse that manufactured 600-hour days.
  const magnitudeMs = Math.floor(
    isPeriodic
      ? (payload.delta_ms ?? payload.active_duration_ms ?? 0)
      : (payload.active_duration_ms ?? 0),
  );
  if (!domain) return { ok: false, reason: 'missing domain' };
  if (magnitudeMs < 1000) return { ok: false, reason: 'sub-second payload' };

  // FOCUS GATE — mirrors src/main.ts:24162. The extension's flag is a hint, not
  // the authority, and it can be stale-false (UA misdetect: Zen reporting as
  // "Firefox" can never match its own alias list, so a healthy extension
  // foregrounds as unfocused). So: when the extension says focused, track. When
  // it says NOT focused, the daemon's own foreground read decides, using the
  // same fork-rich alias table the app uses. Without this gate a browser in the
  // BACKGROUND reported periodic deltas every 30 s and away-time was logged as
  // website time; with a bare-substring gate, a misdetected Zen tracked nothing.
  if (payload.is_browser_focused === false) {
    const fg = current();
    if (!isAppMatchingBrowser(fg.app || '', appForBrowser(payload.browserName))) {
      return { ok: false, reason: 'browser not focused' };
    }
  }

  // A profile the user paused must contribute nothing, whichever process is
  // the writer. Same rule the app enforces in handleBrowserData.
  const profileId = payload.profileId || null;
  const browserName = payload.browserName || null;
  if (!isProfileTrackingAllowed(profileId, browserName)) {
    return { ok: false, reason: 'profile paused' };
  }

  // The extension sends a DELTA for periodic payloads, and the app's
  // browser_sessions aggregate sums what we credit — crediting the cumulative
  // total here would count the same seconds once per tick.
  const magnitude = Math.min(
    magnitudeMs,
    isPeriodic ? BROWSER_MAX_DELTA_MS : BROWSER_SNAPSHOT_CEILING_MS,
  );

  const timestamp = payload.timestamp && !Number.isNaN(Date.parse(payload.timestamp))
    ? new Date(payload.timestamp).toISOString()
    : new Date().toISOString();

  const browser = appForBrowser(payload.browserName);
  const category = categorizeDomain(domain);
  const title = (payload.title || domain).slice(0, 300);

  const result = commitBrowserPayload({
    timestamp,
    app: browser,
    category,
    magnitudeMs: magnitude,
    isPeriodic,
    title,
    url: payload.sanitized_url || payload.url || null,
    domain,
    tab_id: typeof payload.tab_id === 'number' ? payload.tab_id : null,
    browser_name: browserName,
    profile_id: profileId,
  });
  if (!result.ok) return { ok: false, reason: result.reason || 'DB write failed' };
  log(
    `browser ${domain} ${Math.round(magnitude / 1000)}s ` +
    `${isPeriodic ? 'delta' : 'snapshot'} ` +
    `+${Math.round(result.addedMs / 1000)}s ` +
    `via ${browserName || 'unknown'}${profileId ? ` / ${profileId.slice(0, 8)}` : ''}` +
    `${result.replay ? ' (replay skipped)' : ''}`,
  );
  return { ok: true, replay: result.replay };
}

/** Exported for the ingest probe (agent/probes/tracking-daemon-browser.probe.mjs)
 *  so the real payload path can be driven against a scratch DB. Not used by the
 *  server itself, which calls it from the /browser-data handler. */
export { ingest };
export { setCurrentForTest } from './session';

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
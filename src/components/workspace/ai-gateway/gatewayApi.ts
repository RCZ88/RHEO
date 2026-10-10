// AI Gateway frontend API — typed wrapper over the preload bridge.
//
// WHY THIS FILE IS DEFENSIVE (read before "simplifying" it)
// ───────────────────────────────────────────────────────────
// The main-process handlers do NOT agree on a return shape (src/main.ts:7797-7861):
//
//   channel                      service returns            handler returns        envelope?
//   aigateway:list-providers     ProviderAdapter[]          BARE ARRAY             ✗ no
//   aigateway:all-statuses       ProviderStatusReport[]     {success,data}         ✓ yes
//   aigateway:playwright-status  {available,error}          BARE OBJECT            ✗ no
//   aigateway:setup-provider     {success,...}              as-is                   ✓ yes
//   aigateway:verify-setup       {success,...}              as-is                   ✓ yes
//   aigateway:send-prompt        {success,data}             as-is                   ✓ yes
//   aigateway:clear-conversation {success,...}              as-is                   ✓ yes
//   aigateway:close-provider     {success,...}              as-is                   ✓ yes
//   aigateway:logout-provider    {success,...}              as-is                   ✓ yes
//   aigateway:set-disabled       {success,...}              as-is                   ✓ yes
//   aigateway:recent-runs        any[]                      BARE ARRAY (and [] on
//                                                              error — see REPORT)
//
// A bare array has no `.success`, so `if (!a.success) setError(a.error || 'Failed to
// load providers')` fired on the HAPPY path: StatusTab showed "Failed to load
// providers" while the IPC had in fact returned 8 adapters. That single missing
// `.success` is why every gateway tab looked dead.
//
// So: never trust the raw payload. `asList` / `asProbe` / `asAction` below accept
// every shape the main process can actually produce, and when a payload is
// genuinely unusable they say WHICH channel produced it and WHAT it produced —
// never a generic string. See `describePayload`.

export interface GatewayAdapterInfo {
  id: string;
  name: string;
  url: string;
  loginUrl: string;
  rateLimit: { requestsPerMinute: number; concurrentRequests: number; cooldownMs: number };
  dailyBudget?: number;
  notes?: string;
}

export type GatewayStatus =
  | 'ready' | 'needs_setup' | 'authenticating' | 'rate_limited'
  | 'error' | 'disabled' | 'unavailable';

export interface GatewayStatusReport {
  provider: string;
  status: GatewayStatus;
  sessionValid: boolean;
  browserRunning: boolean;
  playwrightAvailable: boolean;
  lastUsedAt: string | null;
  requestsRemaining: number | null;
  queueDepth: number;
  lastError: string | null;
}

export interface GatewayRunRecord {
  id: number;
  provider: string;
  prompt_len: number;
  response_len: number;
  duration_ms: number;
  detection_strategy: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface GatewaySendResult {
  text: string;
  provider: string;
  durationMs: number;
  completionStrategy: string;
}

export interface GatewayEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** IPC channel this came from — every error message names it. */
  channel: string;
}

/** Bridge fn name → the main-process channel it invokes (for diagnosable errors). */
const CHANNEL: Record<string, string> = {
  aigatewayListProviders: 'aigateway:list-providers',
  aigatewayAllStatuses: 'aigateway:all-statuses',
  aigatewayPlaywrightStatus: 'aigateway:playwright-status',
  aigatewaySetupProvider: 'aigateway:setup-provider',
  aigatewayVerifySetup: 'aigateway:verify-setup',
  aigatewaySendPrompt: 'aigateway:send-prompt',
  aigatewayClearConversation: 'aigateway:clear-conversation',
  aigatewayCloseProvider: 'aigateway:close-provider',
  aigatewayLogoutProvider: 'aigateway:logout-provider',
  aigatewaySetDisabled: 'aigateway:set-disabled',
  aigatewayRecentRuns: 'aigateway:recent-runs',
};

const api = () => (window as any).deskflowAPI;

// ── payload description ─────────────────────────────────────────────────────
// The whole point of problem 3: when a payload is unusable, the operator needs to
// see the channel and the actual shape, not "Failed to load providers".
function describePayload(channel: string, raw: unknown): string {
  if (raw === undefined) return `${channel} returned undefined (handler threw before returning, or the response was dropped)`;
  if (raw === null) return `${channel} returned null`;
  if (Array.isArray(raw)) return `${channel} returned a bare array of ${raw.length} — expected { success, data }`;
  if (typeof raw !== 'object') return `${channel} returned a ${typeof raw} (${JSON.stringify(raw)}) — expected { success, data }`;
  const keys = Object.keys(raw as object);
  const hasSuccess = typeof (raw as any).success === 'boolean';
  if (!hasSuccess) {
    return `${channel} returned an object with no "success" field (keys: ${keys.join(', ') || 'none'}) — expected { success, data }`;
  }
  return `${channel} returned { success: true } with no "data" field`;
}

function fail<T>(channel: string, error: string): GatewayEnvelope<T> {
  return { success: false, error, channel };
}

// ── shape normalisers ───────────────────────────────────────────────────────
/**
 * Endpoints whose payload is a LIST. Accepts a bare array (what
 * `aigateway:list-providers` and `aigateway:recent-runs` actually return today),
 * a proper `{success,data}` envelope, or a single record.
 */
function asList<T>(channel: string, raw: unknown): GatewayEnvelope<T[]> {
  if (Array.isArray(raw)) return { success: true, data: raw as T[], channel };
  if (raw === null || raw === undefined) return fail(channel, describePayload(channel, raw));
  if (typeof raw !== 'object') return fail(channel, describePayload(channel, raw));

  const o = raw as Record<string, unknown>;
  if (typeof o.success === 'boolean') {
    if (!o.success) return fail(channel, String(o.error || `${channel} reported failure with no message`));
    if (o.data === undefined || o.data === null) return fail(channel, describePayload(channel, raw));
    if (!Array.isArray(o.data)) {
      // envelope, but data isn't a list — wrap it rather than throwing on .map
      return { success: true, data: [o.data as T], channel };
    }
    return { success: true, data: o.data as T[], channel };
  }
  // Not an envelope. A single record is plausible (one adapter / one run).
  if (o.id || o.provider || o.name) return { success: true, data: [raw as T], channel };
  // A bare `{error}` is a failure report that lost its envelope.
  if (typeof o.error === 'string' && o.error) return fail(channel, o.error);
  return fail(channel, describePayload(channel, raw));
}

/**
 * Endpoints whose payload is a single status OBJECT with no envelope
 * (`aigateway:playwright-status` returns `{available, error}` verbatim).
 */
function asProbe<T>(channel: string, raw: unknown): GatewayEnvelope<T> {
  if (raw === null || raw === undefined) return fail(channel, describePayload(channel, raw));
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail(channel, describePayload(channel, raw));
  const o = raw as Record<string, unknown>;
  if (typeof o.success === 'boolean') {
    if (!o.success) return fail(channel, String(o.error || `${channel} reported failure with no message`));
    if (o.data === undefined || o.data === null) return fail(channel, describePayload(channel, raw));
    return { success: true, data: o.data as T, channel };
  }
  return { success: true, data: raw as T, channel };
}

/** Endpoints that DO return `{success, ...}`. Still hardened: no `success` ⇒ fail. */
function asAction<T>(channel: string, raw: unknown): GatewayEnvelope<T> {
  if (raw === null || raw === undefined) return fail(channel, describePayload(channel, raw));
  if (typeof raw !== 'object' || Array.isArray(raw)) return fail(channel, describePayload(channel, raw));
  const o = raw as Record<string, unknown>;
  if (o.success === true) return { success: true, data: o.data as T, channel };
  if (o.success === false) return fail(channel, String(o.error || `${channel} reported failure with no message`));
  return fail(channel, describePayload(channel, raw));
}

async function invoke(fnName: string, ...args: any[]): Promise<unknown> {
  const bridge = api();
  if (!bridge) {
    throw new Error(
      'window.deskflowAPI is undefined — the preload bridge did not load, so no IPC is reachable from the renderer.'
    );
  }
  const fn = bridge[fnName];
  if (typeof fn !== 'function') {
    throw new Error(
      `window.deskflowAPI.${fnName} is missing — dist-electron/preload.cjs predates the AI Gateway bridge ` +
      `(it exposes no ${fnName}, so the renderer cannot reach ${CHANNEL[fnName]}).`
    );
  }
  return fn.apply(bridge, args);
}

async function call<T>(
  fnName: string,
  shape: (channel: string, raw: unknown) => GatewayEnvelope<T>,
  ...args: any[]
): Promise<GatewayEnvelope<T>> {
  const channel = CHANNEL[fnName] || fnName;
  try {
    const raw = await invoke(fnName, ...args);
    return shape(channel, raw);
  } catch (e: any) {
    // Keep the ORIGINAL message (that is the real cause) but name the channel.
    return fail(channel, e?.message ? `${channel}: ${e.message}` : `${channel}: ${String(e)}`);
  }
}

// ── row coercion ────────────────────────────────────────────────────────────
// A malformed row must not take the tab down with it. `allStatuses()` in
// AIGatewayService maps `this.status(id).data as ProviderStatusReport`, so an
// undefined row is representable — and `for (const r of rows) map[r.provider]`
// then throws "Cannot read properties of undefined".

const DEFAULT_RATE_LIMIT = { requestsPerMinute: 0, concurrentRequests: 1, cooldownMs: 0 };
const KNOWN_STATUS: GatewayStatus[] = [
  'ready', 'needs_setup', 'authenticating', 'rate_limited', 'error', 'disabled', 'unavailable',
];

export function coerceAdapter(raw: any): GatewayAdapterInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id) return null;
  const rl = raw.rateLimit && typeof raw.rateLimit === 'object' ? raw.rateLimit : {};
  const num = (v: any, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : id,
    url: typeof raw.url === 'string' ? raw.url : '',
    loginUrl: typeof raw.loginUrl === 'string' ? raw.loginUrl : '',
    rateLimit: {
      requestsPerMinute: num(rl.requestsPerMinute, DEFAULT_RATE_LIMIT.requestsPerMinute),
      concurrentRequests: num(rl.concurrentRequests, DEFAULT_RATE_LIMIT.concurrentRequests),
      cooldownMs: num(rl.cooldownMs, DEFAULT_RATE_LIMIT.cooldownMs),
    },
    ...(typeof raw.dailyBudget === 'number' ? { dailyBudget: raw.dailyBudget } : {}),
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
  };
}

export function coerceReport(raw: any): GatewayStatusReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const provider = typeof raw.provider === 'string' ? raw.provider : null;
  if (!provider) return null;
  const status = KNOWN_STATUS.includes(raw.status) ? (raw.status as GatewayStatus) : 'needs_setup';
  return {
    provider,
    status,
    sessionValid: raw.sessionValid === true,
    browserRunning: raw.browserRunning === true,
    playwrightAvailable: raw.playwrightAvailable === true,
    lastUsedAt: typeof raw.lastUsedAt === 'string' ? raw.lastUsedAt : null,
    requestsRemaining: typeof raw.requestsRemaining === 'number' ? raw.requestsRemaining : null,
    queueDepth: typeof raw.queueDepth === 'number' ? raw.queueDepth : 0,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
  };
}

/** Build the provider → report map without ever throwing on a bad row. */
export function indexReports(raw: unknown): Record<string, GatewayStatusReport> {
  const out: Record<string, GatewayStatusReport> = {};
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    const r = coerceReport(row);
    if (r) out[r.provider] = r;
  }
  return out;
}

export function coerceAdapters(raw: unknown): GatewayAdapterInfo[] {
  if (!Array.isArray(raw)) return [];
  const out: GatewayAdapterInfo[] = [];
  for (const row of raw) {
    const a = coerceAdapter(row);
    if (a) out.push(a);
  }
  return out;
}

export function coerceRuns(raw: unknown): GatewayRunRecord[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return raw.filter((r: any) => r && typeof r === 'object').map((r: any, i: number) => ({
    id: typeof r.id === 'number' ? r.id : i,
    provider: typeof r.provider === 'string' ? r.provider : '',
    prompt_len: num(r.prompt_len),
    response_len: num(r.response_len),
    duration_ms: num(r.duration_ms),
    detection_strategy: typeof r.detection_strategy === 'string' ? r.detection_strategy : null,
    status: typeof r.status === 'string' ? r.status : 'unknown',
    error: typeof r.error === 'string' ? r.error : null,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
  }));
}

// ── public surface ──────────────────────────────────────────────────────────
export const gatewayApi = {
  listProviders: () => call<unknown>('aigatewayListProviders', asList),
  allStatuses: () => call<unknown>('aigatewayAllStatuses', asList),
  playwrightStatus: () => call<{ available: boolean; error: string | null }>('aigatewayPlaywrightStatus', asProbe),
  setupProvider: (providerId: string) =>
    call<{ mode?: string; url?: string }>('aigatewaySetupProvider', asAction, providerId),
  verifySetup: (providerId: string) =>
    call<{ sessionValid?: boolean }>('aigatewayVerifySetup', asAction, providerId),
  sendPrompt: (opts: { provider: string; prompt: string; model?: string; timeoutMs?: number }) =>
    call<GatewaySendResult>('aigatewaySendPrompt', asAction, opts),
  clearConversation: (providerId: string) =>
    call<undefined>('aigatewayClearConversation', asAction, providerId),
  closeProvider: (providerId: string) => call<undefined>('aigatewayCloseProvider', asAction, providerId),
  logoutProvider: (providerId: string) => call<undefined>('aigatewayLogoutProvider', asAction, providerId),
  setDisabled: (providerId: string, disabled: boolean) =>
    call<undefined>('aigatewaySetDisabled', asAction, providerId, disabled),
  recentRuns: (providerId: string, limit?: number) =>
    call<unknown>('aigatewayRecentRuns', asList, providerId, limit),
  onProviderStatus: (cb: (d: { provider: string; status?: string }) => void) => {
    try { return api()?.onAIGatewayProviderStatus?.(cb) || (() => {}); } catch { return () => {}; }
  },
  onSessionExpired: (cb: (d: { provider: string; reason: string }) => void) => {
    try { return api()?.onAIGatewaySessionExpired?.(cb) || (() => {}); } catch { return () => {}; }
  },
};
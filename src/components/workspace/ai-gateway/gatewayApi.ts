// AI Gateway frontend API — typed wrapper over the preload bridge.
// Every call is optional-chained: UI degrades to error states, never crashes,
// when the bridge or service is unavailable.

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

const api = () => (window as any).deskflowAPI;

async function call<T>(fnName: string, ...args: any[]): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const fn = api()?.[fnName];
    if (typeof fn !== 'function') return { success: false, error: 'Gateway bridge unavailable' };
    const r = await fn(...args);
    return r || { success: false, error: 'Empty response' };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

export const gatewayApi = {
  listProviders: () => call<GatewayAdapterInfo[]>('aigatewayListProviders'),
  allStatuses: () => call<GatewayStatusReport[]>('aigatewayAllStatuses'),
  playwrightStatus: () => call<{ available: boolean; error: string | null }>('aigatewayPlaywrightStatus'),
  setupProvider: (providerId: string) =>
    call<{ mode?: string; url?: string }>('aigatewaySetupProvider', providerId),
  verifySetup: (providerId: string) =>
    call<{ sessionValid?: boolean }>('aigatewayVerifySetup', providerId),
  sendPrompt: (opts: { provider: string; prompt: string; model?: string; timeoutMs?: number }) =>
    call<{ text: string; provider: string; durationMs: number; completionStrategy: string }>('aigatewaySendPrompt', opts),
  clearConversation: (providerId: string) => call('aigatewayClearConversation', providerId),
  closeProvider: (providerId: string) => call('aigatewayCloseProvider', providerId),
  logoutProvider: (providerId: string) => call('aigatewayLogoutProvider', providerId),
  setDisabled: (providerId: string, disabled: boolean) => call('aigatewaySetDisabled', providerId, disabled),
  recentRuns: (providerId: string, limit?: number) =>
    call<GatewayRunRecord[]>('aigatewayRecentRuns', providerId, limit),
  onProviderStatus: (cb: (d: { provider: string; status?: string }) => void) => {
    try { return api()?.onAIGatewayProviderStatus?.(cb) || (() => {}); } catch { return () => {}; }
  },
  onSessionExpired: (cb: (d: { provider: string; reason: string }) => void) => {
    try { return api()?.onAIGatewaySessionExpired?.(cb) || (() => {}); } catch { return () => {}; }
  },
};

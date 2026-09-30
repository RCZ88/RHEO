// External AI transport — the single seam every bridge button goes through.
//
// Two transports exist and they are NOT interchangeable:
//
//  1. EXTENSION (default, unchanged behaviour) — the prompt is queued, the
//     browser extension injects it into a ChatGPT/Claude tab you already have
//     open and logged into, then scrapes the reply back. Nothing is signed in
//     inside DeskFlow. The reply arrives asynchronously, matched by
//     correlationId.
//
//  2. GATEWAY (on demand) — DeskFlow drives the provider's web UI with
//     Playwright using a per-provider persistent profile and an encrypted
//     session vault. The reply arrives SYNCHRONOUSLY in the promise, so there
//     is no correlation to wait for and no browser tab to juggle.
//
// The gateway path is brain-blind upstream (AIGatewayService.sendPrompt only
// writes `aigateway_runs`). main.ts compensates by mirroring every successful
// gateway run into the Chat Library, which in turn writes the brain episode —
// so both transports feed the same learning loop.

import { parseBridgeResponse } from '@/components/ai-bridge/parse';

export type Transport = 'extension' | 'gateway';

const PREFS = 'deskflow_external_ai_transport';

export function getPreferredTransport(): Transport {
  try {
    const v = localStorage.getItem(PREFS);
    return v === 'gateway' ? 'gateway' : 'extension';
  } catch {
    return 'extension';
  }
}

export function setPreferredTransport(t: Transport): void {
  try {
    localStorage.setItem(PREFS, t);
  } catch {
    /* storage unavailable — keep the current in-memory choice */
  }
}

export interface GatewayAvailability {
  ready: boolean;
  provider: string | null;
  /** Providers signed in and usable right now, in preference order. */
  signedIn: string[];
  reason?: string;
}

/**
 * The gateway is only usable when a provider session is valid. Asking is cheap
 * (a table read) and the answer changes when the user signs in or out, so this
 * is queried on demand rather than cached across renders.
 */
export async function gatewayAvailability(): Promise<GatewayAvailability> {
  const api = (window as any).deskflowAPI;
  if (typeof api?.aigatewayAllStatuses !== 'function') {
    return { ready: false, provider: null, signedIn: [], reason: 'Gateway bridge unavailable' };
  }
  try {
    const r = await api.aigatewayAllStatuses();
    const rows: any[] = Array.isArray(r?.data) ? r.data : [];
    const signedIn = rows
      .filter((x) => x?.sessionValid && x?.status !== 'disabled' && x?.status !== 'error')
      .map((x) => x.provider);
    if (!signedIn.length) {
      return {
        ready: false,
        provider: null,
        signedIn,
        reason: 'No AI provider is signed in yet.',
      };
    }
    return { ready: true, provider: signedIn[0], signedIn };
  } catch (e: any) {
    return { ready: false, provider: null, signedIn: [], reason: e?.message || 'Gateway unreachable' };
  }
}

export interface GatewaySendResult {
  ok: boolean;
  text?: string;
  provider?: string;
  error?: string;
}

export async function sendViaGateway(
  prompt: string,
  opts: { provider?: string; timeoutMs?: number } = {}
): Promise<GatewaySendResult> {
  const api = (window as any).deskflowAPI;
  if (typeof api?.aigatewaySendPrompt !== 'function') {
    return { ok: false, error: 'Gateway bridge unavailable' };
  }
  const provider = opts.provider || (await gatewayAvailability()).provider;
  if (!provider) return { ok: false, error: 'No AI provider is signed in yet.' };
  try {
    const r = await api.aigatewaySendPrompt({
      provider,
      prompt,
      timeoutMs: opts.timeoutMs ?? 180000,
    });
    if (!r?.success) return { ok: false, provider, error: r?.error || 'The provider did not answer.' };
    const text = r.data?.text;
    if (!text) return { ok: false, provider, error: 'The provider returned an empty response.' };
    return { ok: true, text, provider };
  } catch (e: any) {
    return { ok: false, provider, error: e?.message || 'The gateway request failed.' };
  }
}

/**
 * Pull the target field straight out of a gateway reply. The external-AI
 * contract is "return ONLY this JSON", so the same parser the paste-back path
 * uses works unchanged — one less parsing dialect to keep in sync.
 */
export function extractField(reply: string, keys: string[]): {
  values: Record<string, string>;
  error?: string;
} {
  const parsed = parseBridgeResponse(reply, keys);
  if (!parsed.ok && !parsed.rawJson) {
    return { values: {}, error: parsed.error || 'Could not read the response.' };
  }
  return { values: parsed.values };
}

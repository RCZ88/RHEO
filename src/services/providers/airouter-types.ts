/**
 * Types mirroring the ai-router admin API (`/router/status`, `/router/groups`).
 *
 * Kept as a separate module because these are the router's shapes, not
 * DeskFlow's. The router is a separate project on disk and its API can evolve
 * independently; anything the UI needs from it is declared here once instead of
 * being re-inferred at every call site.
 *
 * Every field is optional-tolerant on purpose: the router reports providers that
 * are `disabled`, `no_key`, and `ready`, and a UI that throws on an unfamiliar
 * status string is a UI that breaks when the router is upgraded.
 */

/** One provider as reported by the router. */
export interface AirRouterProvider {
  name: string;
  /** ready | no_key | disabled | cooldown | unknown — treat as string, not union. */
  status: string;
  status_detail?: string | null;
  adapter?: string;
  enabled?: boolean;
  groups?: string[];
  privacy?: string | null;
  notes?: string | null;
  /** Rolling latency estimate in ms, null until enough samples exist. */
  ewma_ms?: number | null;
  keys?: Array<{
    key_id?: string;
    cooldown?: number | null;
    usage?: {
      minute?: { requests?: number; tokens?: number };
      hour?: { requests?: number; tokens?: number };
      day?: { requests?: number; tokens?: number };
    } | null;
  }>;
}

export interface AirRouterStatus {
  ok: boolean;
  version?: string;
  /** Present when the router is unreachable — this is the offline case. */
  error?: string;
  baseUrl?: string;
  config?: {
    default_group?: string;
    strategy?: string;
    max_attempts?: number;
    response_model?: string;
  };
  providers?: AirRouterProvider[];
  cooldowns?: unknown[];
}

/** One candidate inside a group: who would serve it, and whether it can right now. */
export interface AirRouterChainEntry {
  provider: string;
  model: string;
  priority?: number;
  available?: boolean;
  reason?: string | null;
}

export interface AirRouterGroup {
  description?: string;
  chain?: AirRouterChainEntry[];
  skipped?: Array<{ provider: string; reason?: string | null }>;
}

export interface AirRouterGroups {
  ok: boolean;
  error?: string;
  /** alias -> group it resolves to */
  aliases?: Record<string, string>;
  groups?: Record<string, AirRouterGroup>;
}

/** How a provider status should read in the UI. */
export function airRouterStatusTone(status: string): 'ready' | 'warn' | 'muted' | 'error' {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'no_key':
    case 'cooldown':
      return 'warn';
    case 'disabled':
      return 'muted';
    default:
      return 'error';
  }
}

/** Human label for a status string. Keeps raw enum-ish text off the screen. */
export function airRouterStatusLabel(status: string, detail?: string | null): string {
  switch (status) {
    case 'ready':
      return detail || 'Live';
    case 'no_key':
      return 'No API key set';
    case 'disabled':
      return detail || 'Disabled in config';
    case 'cooldown':
      return 'Cooling down';
    default:
      return detail || status;
  }
}
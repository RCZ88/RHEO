// ============================================================================
// AI Gateway — shared types (main-process service layer)
// Mirrors agent/docs/external-ai-communication/AI_WebUI_Gateway_Specification.md
// Data-only module: no playwright/electron imports — always safe to load.
// ============================================================================

export type SubmitMethod = 'enter' | 'button' | 'both';

export interface DetectionStrategy {
  type: 'dom_marker' | 'button_appearance' | 'button_disappearance' | 'text_stability' | 'network_idle' | 'custom_js';
  selector?: string[];
  condition?: 'exists' | 'not_exists' | 'count_increased' | 'stable';
  stableDurationMs?: number;
  customScript?: string;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  url: string;
  newChatUrl?: string;
  loginUrl: string;
  input: {
    selector: string[];
    submitMethod: SubmitMethod;
    submitButtonSelector?: string[];
    preSubmitDelay: number;
    clearInput: boolean;
  };
  response: {
    containerSelector: string[];
    textExtractor: string;
    streaming: boolean;
  };
  completionDetection: {
    primary: DetectionStrategy;
    fallback: DetectionStrategy;
    lastResort: DetectionStrategy;
    timeoutMs: number;
    pollIntervalMs: number;
  };
  auth: {
    type: 'email' | 'oauth' | 'qr' | 'phone' | 'sso';
    sessionValidityMs: number;
  };
  antiBot: {
    cloudflare: boolean;
    viewport: { width: number; height: number };
  };
  rateLimit: {
    requestsPerMinute: number;
    concurrentRequests: number;
    cooldownMs: number;
  };
  /** Rough daily budget shown in UI; enforced client-side only. */
  dailyBudget?: number;
  notes?: string;
}

export type GatewayProviderStatus =
  | 'ready'
  | 'needs_setup'
  | 'authenticating'
  | 'rate_limited'
  | 'error'
  | 'disabled'
  | 'unavailable';

export interface ProviderStatusReport {
  provider: string;
  status: GatewayProviderStatus;
  sessionValid: boolean;
  browserRunning: boolean;
  playwrightAvailable: boolean;
  lastUsedAt: string | null;
  requestsRemaining: number | null;
  queueDepth: number;
  lastError: string | null;
}

export interface SendPromptOptions {
  provider: string;
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

export interface SendPromptResult {
  text: string;
  provider: string;
  durationMs: number;
  completionStrategy: string;
  conversationId: string | null;
}

export interface GatewayRunLog {
  id?: number;
  provider: string;
  promptLength: number;
  responseLength: number;
  durationMs: number;
  detectionStrategy: string;
  status: 'ok' | 'error';
  error?: string;
  createdAt?: string;
}

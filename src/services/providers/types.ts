export interface ProviderTemplate {
  id: string;
  label: string;
  defaultBaseUrl: string;
  auth: { type: 'bearer' | 'header' | 'query'; headerName?: string; queryParam?: string };
  staticHeaders?: Record<string, string>;
  buildBody?: (req: CanonicalRequest) => unknown;
  parseResponse?: (raw: any) => CanonicalResponse;
  suggestedModels?: string[];
  docsUrl?: string;
  interpolateUrl?: (url: string, config: ProviderConfig) => string;
  supportsStream?: boolean;
}

export interface ContentPartText {
  type: 'text';
  text: string;
}
export interface ContentPartImage {
  type: 'image_url';
  image_url: { url: string };
}
export type ContentPart = ContentPartText | ContentPartImage;

export interface CanonicalRequest {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string | ContentPart[]; tool_calls?: any[]; tool_call_id?: string }>;
  maxTokens?: number;
  temperature?: number;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }>;
  toolChoice?: 'auto' | 'none';
  // ---- AI observability (Phase 1). Optional, so every existing object literal
  // that builds a CanonicalRequest still compiles untouched. runWithFallback
  // prefers its explicit `trace` argument and falls back to these.
  /** Joins every row emitted by one call: route-decision + attempt + prompt + output. */
  traceId?: string;
  /** Which product surface asked. Replaces the racy module-level `currentFeature`. */
  feature?: string;
  /** Thread / session / terminal id, for grouping a conversation. */
  contextId?: string;
}

export interface CanonicalResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface ResolvedProvider {
  config: ProviderConfig;
  template: ProviderTemplate;
}

export interface ProviderConfig {
  id: string;
  templateId: string;
  label: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  priority: number;
  monthlyTokenBudget?: number;
  tokensUsedThisMonth?: number;
  budgetResetDate?: string;
  extraConfig?: Record<string, string>;
  timeoutMs?: number;        // ADDED — bounded per-provider timeout
}

export interface AiProvidersState {
  providers: ProviderConfig[];
  routing: {
    default: { providerId: string; model: string };
    researchDigest?: { providerId: string; model: string } | null;
    goalAssistant?: { providerId: string; model: string } | null;
    category?: { providerId: string; model: string } | null;
    colors?: { providerId: string; model: string } | null;
    vision?: { providerId: string; model: string } | null;
    presentation?: { providerId: string; model: string } | null;
  };
}

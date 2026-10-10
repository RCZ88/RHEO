import type { ProviderTemplate } from './types';

export const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    auth: { type: 'bearer' },
    staticHeaders: { 'HTTP-Referer': 'https://deskflow.app', 'X-Title': 'DeskFlow' },
    suggestedModels: ['google/gemini-2.0-flash-001', 'deepseek/deepseek-chat-v3-0324'],
    docsUrl: 'https://openrouter.ai/docs',
    supportsStream: true,
  },
  cloudflare: {
    id: 'cloudflare',
    label: 'Cloudflare',
    defaultBaseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions',
    auth: { type: 'bearer' },
    staticHeaders: { 'Content-Type': 'application/json' },
    suggestedModels: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1'],
    docsUrl: 'https://developers.cloudflare.com/workers-ai/',
    interpolateUrl: (url, config) => url.replace('{account_id}', config.extraConfig?.cloudflareAccountId || '{account_id}'),
    parseResponse: (raw: any) => ({
      content: raw.result?.response || raw.choices?.[0]?.message?.content || '',
      usage: raw.result?.usage || raw.usage,
    }),
    supportsStream: false,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1/chat/completions',
    auth: { type: 'bearer' },
    suggestedModels: ['llama3.1', 'qwen2.5', 'qwen2.5-vl:3b'],
    supportsStream: true,
  },
  github: {
    id: 'github',
    label: 'GitHub Models',
    defaultBaseUrl: 'https://models.inference.ai.azure.com/chat/completions',
    auth: { type: 'bearer' },
    staticHeaders: { 'Accept': 'application/json' },
    suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'DeepSeek-V3', 'Mistral-large', 'Llama-3.1-70B'],
    docsUrl: 'https://docs.github.com/github-models',
    supportsStream: true,
  },
  google: {
    id: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    auth: { type: 'bearer' },
    suggestedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    docsUrl: 'https://ai.google.dev/gemini-api/docs/quickstart',
    supportsStream: true,
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    defaultBaseUrl: '',
    auth: { type: 'bearer' },
    suggestedModels: [],
    supportsStream: true,
  },

  /**
   * ai-router — the self-hosted provider router.
   *
   * Not a vendor: a local OpenAI-compatible gateway that picks a provider per
   * request from a quality GROUP, failing over across 26 configured providers
   * when one is slow, down, or out of free quota. Because it speaks the OpenAI
   * shape, this is a normal provider entry — no special-casing in the call path.
   *
   * The "models" here are GROUPS and ALIASES, not concrete model ids. Asking for
   * `reasoning` means "best available for hard thinking right now", which is the
   * whole point: the answer changes without the user changing anything.
   * Router status (which providers are live, what is on cooldown, why a node was
   * skipped) is surfaced by AirRouterPanel via the admin API.
   */
  airouter: {
    id: 'airouter',
    label: 'AI Router (local failover)',
    defaultBaseUrl: 'http://127.0.0.1:4000/v1/chat/completions',
    auth: { type: 'bearer' },
    // Any non-empty placeholder: the router is open on localhost unless
    // AI_ROUTER_AUTH_KEYS is set, in which case this must match one of them.
    staticHeaders: { 'X-Router-Client': 'deskflow' },
    // Groups first — they are the primary way to use the router. Aliases after,
    // because a tool with a hardcoded name should just work.
    suggestedModels: [
      'auto',
      'fast',
      'reasoning',
      'coding',
      'vision',
      'embed',
      'local',
      'default',
      'gpt-4o-mini',
      'gpt-4o',
      'deepseek-coder',
      'claude-sonnet-4',
    ],
    docsUrl: 'http://127.0.0.1:4000/router/status',
    supportsStream: true,
  },
};

/**
 * Flat, render-safe view of the catalogue.
 *
 * THE canonical provider list for this app. `PROVIDER_TEMPLATES` above is what
 * `router.ts`/`callProvider` actually dispatch on and what Settings -> Integrations
 * & AI edits, so any UI that needs a provider picker must derive its options from
 * here instead of keeping a hand-maintained copy. (AgentProviderPanel used to carry
 * its own divergent list: opencode/claude/gemini/codex/custom, with endpoints and
 * model defaults that matched nothing in this file.)
 */
export interface ProviderTemplateSummary {
  id: string;
  label: string;
  defaultBaseUrl: string;
  suggestedModels: string[];
  docsUrl?: string;
  requiresKey: boolean;
}

export function summariseTemplate(t: ProviderTemplate): ProviderTemplateSummary {
  return {
    id: t.id,
    label: t.label,
    defaultBaseUrl: t.defaultBaseUrl,
    suggestedModels: [...(t.suggestedModels || [])],
    ...(t.docsUrl ? { docsUrl: t.docsUrl } : {}),
    // Every template is bearer-auth, but only the hosted vendors actually need a
    // credential; local/self-hosted ones are usable with a placeholder.
    requiresKey: t.id !== 'ollama' && t.id !== 'airouter' && !!t.defaultBaseUrl,
  };
}

export function listProviderTemplates(): ProviderTemplateSummary[] {
  return Object.values(PROVIDER_TEMPLATES).map(summariseTemplate);
}

export function getProviderTemplate(id: string): ProviderTemplateSummary | null {
  const t = PROVIDER_TEMPLATES[id];
  return t ? summariseTemplate(t) : null;
}


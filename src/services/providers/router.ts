import { CanonicalRequest, CanonicalResponse, ResolvedProvider, AiProvidersState, ProviderConfig } from './types';
import { PROVIDER_TEMPLATES } from './templates';
import { callProvider } from './callProvider';

// ---- AI Debug Vault sink (registered by main.ts; keeps router DB-free) ----
export type DebugSinkFn = (ev: {
  source: string;
  event: string;
  feature?: string;
  provider?: string;
  model?: string;
  contextId?: string;
  role?: string;
  tokensIn?: number;
  tokensOut?: number;
  payload?: unknown;
}) => void;

export let debugSink: DebugSinkFn | null = null;
let currentFeature = 'default';

export function setDebugSink(fn: DebugSinkFn | null) {
  debugSink = fn;
}

export function sink(ev: Parameters<DebugSinkFn>[0]) {
  try {
    debugSink?.({ source: 'provider-router', feature: currentFeature, ...ev });
  } catch { /* sink is best-effort */ }
}

export function buildChain(
  state: AiProvidersState,
  feature: 'researchDigest' | 'goalAssistant' | 'resumeBuilder' | 'category' | 'colors' | 'lifeAssistant' | 'monthlyRecap' | 'contentEngine' | 'vision' | 'presentation',
): Array<{ provider: ResolvedProvider; model: string }> {
  currentFeature = feature;
  const enabled = state.providers.filter(p => p.enabled);
  const assigned = state.routing[feature] ?? state.routing.default;

  console.log(`[PROV] buildChain feature=${feature} enabled=${enabled.length} assigned=${JSON.stringify(assigned)}`);

  const resolve = (cfg: ProviderConfig): ResolvedProvider | null => {
    const template = PROVIDER_TEMPLATES[cfg.templateId];
    if (!template) {
      console.log(`[PROV] buildChain: no template for ${cfg.id} templateId=${cfg.templateId}`);
      return null;
    }
    return { config: cfg, template };
  };

  const chain: Array<{ provider: ResolvedProvider; model: string }> = [];
  const primaryCfg = enabled.find(p => p.id === assigned.providerId);
  if (primaryCfg) {
    console.log(`[PROV] buildChain: primary = ${primaryCfg.id} (${primaryCfg.templateId}) model=${assigned.model}`);
    const p = resolve(primaryCfg);
    if (p) chain.push({ provider: p, model: assigned.model });
  } else {
    console.log(`[PROV] buildChain: no primary found for providerId=${assigned.providerId}`);
  }

  enabled
    .sort((a, b) => a.priority - b.priority)
    .filter(p => p.id !== assigned.providerId)
    .forEach(p => {
      const r = resolve(p);
      if (r) {
        const model = p.models[0] ?? assigned.model;
        console.log(`[PROV] buildChain: fallback ${p.id} (${p.templateId}) model=${model}`);
        chain.push({ provider: r, model });
      }
    });

  console.log(`[PROV] buildChain: final chain length=${chain.length}`);
  return chain;
}

async function callWithTokenTiers(
  provider: ResolvedProvider,
  req: CanonicalRequest,
  externalSignal?: AbortSignal,   // ADDED
): Promise<CanonicalResponse> {
  const cfg = provider.config;

  if (cfg.monthlyTokenBudget && (cfg.tokensUsedThisMonth ?? 0) >= cfg.monthlyTokenBudget) {
    console.log(`[PROV] ${cfg.id}: budget exhausted (${cfg.tokensUsedThisMonth}/${cfg.monthlyTokenBudget})`);
    const e = new Error(`Budget exhausted for ${cfg.label}`);
    (e as any).status = 402;
    throw e;
  }

  const tiers = [req.maxTokens ?? 1500, 100, 50, 40];
  let lastErr: any;

  for (const maxTokens of tiers) {
    try {
      console.log(`[PROV] ${cfg.id}: trying tier maxTokens=${maxTokens}`);
      const res = await callProvider(provider, { ...req, maxTokens }, externalSignal);
      const used = (res.usage?.prompt_tokens ?? 0) + (res.usage?.completion_tokens ?? 0);
      cfg.tokensUsedThisMonth = (cfg.tokensUsedThisMonth ?? 0) + used;
      console.log(`[PROV] ${cfg.id}: tier maxTokens=${maxTokens} SUCCEEDED, used=${used} tokens`);
      return res;
    } catch (err: any) {
      lastErr = err;
      console.log(`[PROV] ${cfg.id}: tier maxTokens=${maxTokens} FAILED status=${err.status} msg=${err.message?.slice(0, 120)}`);
      // CHANGED — AbortError is now retryable (treated like 402 budget exhaustion)
      const isRetryable = err?.status === 402 || err?.name === 'AbortError' || (err?.status >= 500 && err?.status < 600);
      if (!isRetryable) throw err;
    }
  }

  console.log(`[PROV] ${cfg.id}: all tiers exhausted`);
  throw lastErr;
}

export async function runWithFallback(
  chain: ReturnType<typeof buildChain>,
  req: Omit<CanonicalRequest, 'model'>,
  externalSignal?: AbortSignal,   // ADDED
): Promise<{ result: CanonicalResponse; usedProviderId: string }> {
  console.log(`[PROV] runWithFallback: chain has ${chain.length} providers`);
  for (const [i, link] of chain.entries()) {
    console.log(`[PROV] chain[${i}]: ${link.provider.config.id} model=${link.model}`);
  }
  console.log(`[PROMPT] ============ SYSTEM PROMPT ============`);
  console.log(`[PROMPT] ${req.systemPrompt}`);
  if (req.messages?.length) {
    console.log(`[PROMPT] ============ MESSAGES (${req.messages.length}) ============`);
    req.messages.forEach((m, i) => {
      console.log(`[PROMPT] [${i}] <${m.role}> ${m.content}`);
    });
  }
  console.log(`[PROMPT] ============ END PROMPT ============`);
  let lastErr: any;
  const errors: { name: string; error: string; kind: 'timeout' | 'failure' }[] = [];
  for (const [i, link] of chain.entries()) {
    try {
      console.log(`[PROV] runWithFallback: trying chain[${i}] ${link.provider.config.id} model=${link.model}`);
      const result = await callWithTokenTiers(link.provider, { ...req, model: link.model }, externalSignal);
      console.log(`[PROV] runWithFallback: chain[${i}] ${link.provider.config.id} SUCCEEDED`);
      console.log(`[RESULT] ============ AI RESULT (provider=${link.provider.config.id}) ============`);
      console.log(`[RESULT] ${String(result.content)}`);
      console.log(`[RESULT] ============ END AI RESULT ============`);
      sink({
        event: 'prompt',
        provider: link.provider.config.id,
        model: link.model,
        role: 'system',
        payload: { systemPrompt: req.systemPrompt, messages: req.messages },
      });
      const reasoning = (result as any).reasoning;
      if (reasoning != null && String(reasoning).trim()) {
        sink({ event: 'thinking', provider: link.provider.config.id, model: link.model, payload: reasoning });
      }
      sink({
        event: 'output',
        provider: link.provider.config.id,
        model: link.model,
        payload: result.content,
        tokensIn: result.usage?.prompt_tokens,
        tokensOut: result.usage?.completion_tokens,
      });
      return { result, usedProviderId: link.provider.config.id };
    } catch (err: any) {
      console.log(`[PROV] runWithFallback: chain[${i}] ${link.provider.config.id} FAILED: ${err.message?.slice(0, 150)}`);
      lastErr = err;
      const kind: 'timeout' | 'failure' = err?.name === 'AbortError' ? 'timeout' : 'failure';
      errors.push({ name: link.provider.config.label || link.provider.config.id, error: err.message || String(err), kind });
    }
  }
  console.log(`[PROV] runWithFallback: ALL providers failed`);
  sink({ event: 'error', payload: { errors, message: errors.map(e => `${e.name}: ${e.error}`) } });
  // CHANGED — distinguish timeouts from failures in the aggregate message
  const timeouts = errors.filter(e => e.kind === 'timeout');
  const failures = errors.filter(e => e.kind === 'failure');
  const parts: string[] = [];
  if (timeouts.length) parts.push(`${timeouts.length} timed out (${timeouts.map(e => e.name).join(', ')})`);
  if (failures.length) parts.push(`${failures.length} failed (${failures.map(e => `${e.name}: ${e.error}`).join('; ')})`);
  if (errors.length) throw new Error(`All ${errors.length} provider(s) exhausted — ${parts.join('; ')}`);
  throw lastErr ?? new Error('No providers available');
}

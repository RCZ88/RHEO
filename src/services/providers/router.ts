import type { CanonicalRequest, CanonicalResponse, ResolvedProvider, AiProvidersState, ProviderConfig } from './types';
import { PROVIDER_TEMPLATES } from './templates';
import { callProvider } from './callProvider';
import { costForCall } from './modelPricing';
import { randomUUID } from 'crypto';

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
  traceId?: string;
  latencyMs?: number;
  costUsd?: number | null;
  httpStatus?: number | null;
  errorKind?: 'timeout' | 'failure' | 'budget' | null;
  attemptIndex?: number;
  parseOk?: boolean;
}) => void;

export let debugSink: DebugSinkFn | null = null;

export function setDebugSink(fn: DebugSinkFn | null) {
  debugSink = fn;
}

/**
 * `feature` is now an explicit argument instead of module state.
 *
 * It used to be `let currentFeature` mutated by buildChain(), which meant two
 * concurrent requests shared one slot — the second request's buildChain
 * overwrote the first's feature, so the first call's rows were filed under the
 * wrong feature. Passing it per-call makes misattribution structurally
 * impossible rather than merely unlikely.
 *
 * `...ev` is spread FIRST so a caller-supplied feature wins over the default.
 */
export type SinkInput = Omit<Parameters<DebugSinkFn>[0], 'source'> & { feature?: string };

export function sink(ev: SinkInput) {
  try {
    // `source` is fixed by this function; callers never supply it.
    debugSink?.({ source: 'provider-router', feature: 'unattributed', ...ev });
  } catch { /* sink is best-effort */ }
}

/**
 * PROMPT/OUTPUT BODY LOGGING IS OFF BY DEFAULT.
 *
 * This module used to `console.log` the entire system prompt, every message and
 * the full model response on EVERY call. That is a privacy problem (user
 * prompts land in stdout, terminal scrollback and any log collector) and a
 * performance one (a 20KB response is a 20KB synchronous write per call).
 *
 * The content is not lost: the AI Debug Vault already records prompt, output,
 * thinking and parsed events — redacted, queryable, and bounded. That is the
 * right place for it. This file keeps the per-call trace, which is what you
 * actually read while the app is running.
 *
 * Set RHEO_LOG_PROMPTS=1 only when debugging one specific call and you accept
 * that its contents hit the console.
 */
const LOG_BODIES = process.env.RHEO_LOG_PROMPTS === '1';

/** Redact obvious credentials even in the opt-in path. */
function maskForLog(s: unknown, cap = 400): string {
  const t = typeof s === 'string' ? s : String(s ?? '');
  return t
    .replace(/\bsk-ant-[A-Za-z0-9_-]{16,}/g, 'sk-ant-***')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}/g, 'sk-***')
    .replace(/\bAIza[A-Za-z0-9_-]{20,}/g, 'AIza***')
    .replace(/\bBearer\s+\S{16,}/gi, 'Bearer ***')
    .slice(0, cap) + (t.length > cap ? `…[+${t.length - cap} chars]` : '');
}

export interface SkippedProvider { provider: string; reason: string }
export interface ChainLink { provider: ResolvedProvider; model: string }
export interface BuiltChain { chain: ChainLink[]; skipped: SkippedProvider[] }

/** Context for one traced call. Appended to runWithFallback's parameters so the
 *  existing signature and all ~50 call sites stay valid. */
export interface TraceMeta {
  traceId?: string;
  feature?: string;
  contextId?: string;
  /** Skip reasons from buildChainDetailed — needed for the route-decision row. */
  skipped?: SkippedProvider[];
}

export type BuildChainFeature = 'researchDigest' | 'goalAssistant' | 'resumeBuilder' | 'category' | 'colors' | 'lifeAssistant' | 'monthlyRecap' | 'contentEngine' | 'vision' | 'presentation';

/**
 * Full routing resolution INCLUDING why each candidate was dropped.
 *
 * Before this, every skip was `console.log`-only, so the single most important
 * question about a failover — "why did it pick that provider and skip these?" —
 * had no durable answer anywhere. Those reasons are what `route-decision`
 * now persists.
 *
 * Disabled providers are recorded explicitly rather than filtered out silently:
 * a provider the user switched off is the most common cause of "why is it not
 * using Claude", and it has to be visible in the vault.
 */
export function buildChainDetailed(
  state: AiProvidersState,
  feature: BuildChainFeature,
): BuiltChain {
  const enabled = state.providers.filter(p => p.enabled);
  const routingTable = state.routing as Record<string, { providerId: string; model: string } | null | undefined>;
  const assigned = routingTable[feature] ?? state.routing.default;
  const skipped: SkippedProvider[] = [];

  for (const p of state.providers) {
    if (!p.enabled) skipped.push({ provider: p.id, reason: 'disabled_by_user' });
    else if (!PROVIDER_TEMPLATES[p.templateId]) skipped.push({ provider: p.id, reason: 'no_template' });
    else if (p.id === assigned.providerId) { /* primary, resolved below */ }
    else if (!(p.models?.length)) skipped.push({ provider: p.id, reason: 'no_models_configured' });
  }

  console.log(`[PROV] buildChain feature=${feature} enabled=${enabled.length} assigned=${JSON.stringify(assigned)}`);

  const resolve = (cfg: ProviderConfig): ResolvedProvider | null => {
    const template = PROVIDER_TEMPLATES[cfg.templateId];
    if (!template) {
      console.log(`[PROV] buildChain: no template for ${cfg.id} templateId=${cfg.templateId}`);
      return null;
    }
    return { config: cfg, template };
  };

  const chain: ChainLink[] = [];
  const primaryCfg = enabled.find(p => p.id === assigned.providerId);
  if (primaryCfg) {
    console.log(`[PROV] buildChain: primary = ${primaryCfg.id} (${primaryCfg.templateId}) model=${assigned.model}`);
    const p = resolve(primaryCfg);
    if (p) chain.push({ provider: p, model: assigned.model });
  } else {
    // The assigned provider is either disabled or gone — record BOTH reasons so
    // the vault can distinguish "user switched it off" from "misconfigured id".
    const missing = state.providers.find(p => p.id === assigned.providerId);
    skipped.push({
      provider: assigned.providerId || '(unset)',
      reason: missing ? 'primary_unavailable' : 'primary_id_not_found',
    });
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

  console.log(`[PROV] buildChain: final chain length=${chain.length} skipped=${skipped.length}`);
  return { chain, skipped };
}

/** Unchanged public contract — still returns a bare array of links, so every
 *  existing call site (`chain.length`, `runWithFallback(chain, …)`) keeps
 *  working untouched. Use buildChainDetailed when you need skip reasons. */
export function buildChain(
  state: AiProvidersState,
  feature: BuildChainFeature,
): ChainLink[] {
  return buildChainDetailed(state, feature).chain;
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
  chain: ChainLink[],
  req: Omit<CanonicalRequest, 'model'>,
  externalSignal?: AbortSignal,   // ADDED
  trace?: TraceMeta,
): Promise<{ result: CanonicalResponse; usedProviderId: string }> {
  // Resolve trace identity ONCE, up front, and thread it through every row this
  // call emits. Nothing downstream reads module state.
  const traceId = trace?.traceId ?? randomUUID();
  const feature = trace?.feature ?? (req as any).feature ?? 'unattributed';
  const contextId = trace?.contextId ?? (req as any).contextId;
  const t0 = performance.now();
  console.log(`[PROV] runWithFallback: chain has ${chain.length} providers`);
  for (const [i, link] of chain.entries()) {
    console.log(`[PROV] chain[${i}]: ${link.provider.config.id} model=${link.model}`);
  }
  // Metadata always: sizes and roles are what you read while debugging, and
  // they reveal nothing about what the user actually typed.
  console.log(`[PROMPT] systemPrompt=${req.systemPrompt.length} chars, messages=${req.messages?.length || 0}, maxTokens=${req.maxTokens ?? 'default'}`);
  if (req.messages?.length) {
    console.log(`[PROMPT] roles=[${req.messages.map(m => m.role).join(',')}]`);
  }
  if (LOG_BODIES) {
    console.log(`[PROMPT] --- bodies (RHEO_LOG_PROMPTS=1) ---`);
    console.log(`[PROMPT] system: ${maskForLog(req.systemPrompt, 2000)}`);
    req.messages.forEach((m, i) => console.log(`[PROMPT] [${i}] <${m.role}> ${maskForLog(m.content, 2000)}`));
  }
  // ---- ROUTE DECISION, persisted before any provider is touched. This is the
  // row that answers "why did it choose that provider and skip these?".
  sink({
    event: 'route-decision',
    traceId,
    feature,
    contextId,
    payload: {
      chain: chain.map((l, i) => ({
        attemptIndex: i,
        providerId: l.provider.config.id,
        templateId: l.provider.config.templateId,
        model: l.model,
      })),
      skipped: trace?.skipped ?? [],
      chainLength: chain.length,
    },
  });

  let lastErr: any;
  const errors: { name: string; error: string; kind: 'timeout' | 'failure' | 'budget' }[] = [];
  for (const [i, link] of chain.entries()) {
    const attemptStart = performance.now();
    try {
      console.log(`[PROV] runWithFallback: trying chain[${i}] ${link.provider.config.id} model=${link.model}`);
      const result = await callWithTokenTiers(link.provider, { ...req, model: link.model }, externalSignal);
      console.log(`[PROV] runWithFallback: chain[${i}] ${link.provider.config.id} SUCCEEDED`);
      const outText = String(result.content ?? '');
      console.log(`[RESULT] provider=${link.provider.config.id} model=${link.model} chars=${outText.length} tokens=${result.usage?.prompt_tokens ?? 0}/${result.usage?.completion_tokens ?? 0} latency=${Math.round(performance.now() - attemptStart)}ms`);
      if (LOG_BODIES) console.log(`[RESULT] ${maskForLog(outText, 2000)}`);
      const latencyMs = performance.now() - attemptStart;
      const costUsd = costForCall(link.model, result.usage);
      const parseState = (result as any).parse;

      // One row per provider attempt. httpStatus stays null on success because
      // callProvider does not surface a status on the CanonicalResponse — a
      // hardcoded 200 would be a claim we cannot back up.
      sink({
        event: 'attempt',
        traceId, feature, contextId,
        provider: link.provider.config.id,
        model: link.model,
        attemptIndex: i,
        latencyMs,
        costUsd,
        httpStatus: null,
        errorKind: null,
        parseOk: parseState ? !!parseState.ok : undefined,
        tokensIn: result.usage?.prompt_tokens,
        tokensOut: result.usage?.completion_tokens,
        payload: { outcome: 'success', attemptIndex: i, latencyMs, costUsd, tokens: result.usage ?? null },
      });

      sink({
        event: 'prompt',
        traceId, feature, contextId,
        provider: link.provider.config.id,
        model: link.model,
        role: 'system',
        payload: { systemPrompt: req.systemPrompt, messages: req.messages },
      });
      const reasoning = (result as any).reasoning;
      if (reasoning != null && String(reasoning).trim()) {
        sink({ event: 'thinking', traceId, feature, contextId, provider: link.provider.config.id, model: link.model, payload: reasoning });
      }
      sink({
        event: 'output',
        traceId, feature, contextId,
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
      const latencyMs = performance.now() - attemptStart;
      // 402 is the budget-exhaustion error callWithTokenTiers throws; it is a
      // distinct operational state from a transport failure and worth separating.
      const kind: 'timeout' | 'failure' | 'budget' =
        err?.name === 'AbortError' ? 'timeout' : err?.status === 402 ? 'budget' : 'failure';
      const httpStatus = typeof err?.status === 'number' ? err.status : null;

      sink({
        event: 'attempt',
        traceId, feature, contextId,
        provider: link.provider.config.id,
        model: link.model,
        attemptIndex: i,
        latencyMs,
        costUsd: null,
        httpStatus,
        errorKind: kind,
        payload: { outcome: 'error', attemptIndex: i, latencyMs, httpStatus, errorKind: kind, error: err.message || String(err) },
      });

      errors.push({ name: link.provider.config.label || link.provider.config.id, error: err.message || String(err), kind });
    }
  }
  console.log(`[PROV] runWithFallback: ALL providers failed`);
  sink({
    event: 'error',
    traceId, feature, contextId,
    payload: {
      errors,
      message: errors.map(e => `${e.name}: ${e.error}`),
      totalLatencyMs: performance.now() - t0,
      attempts: errors.length,
    },
  });
  // CHANGED — distinguish timeouts from failures in the aggregate message
  const timeouts = errors.filter(e => e.kind === 'timeout');
  const failures = errors.filter(e => e.kind === 'failure');
  const parts: string[] = [];
  if (timeouts.length) parts.push(`${timeouts.length} timed out (${timeouts.map(e => e.name).join(', ')})`);
  if (failures.length) parts.push(`${failures.length} failed (${failures.map(e => `${e.name}: ${e.error}`).join('; ')})`);
  if (errors.length) throw new Error(`All ${errors.length} provider(s) exhausted — ${parts.join('; ')}`);
  throw lastErr ?? new Error('No providers available');
}

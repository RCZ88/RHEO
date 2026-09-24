import { CanonicalRequest, CanonicalResponse, ResolvedProvider, ProviderConfig } from './types';
import { PROVIDER_TEMPLATES } from './templates';

export async function callProvider(
  provider: ResolvedProvider | ProviderConfig,
  req: CanonicalRequest,
  externalSignal?: AbortSignal,   // ADDED — propagate external abort
): Promise<CanonicalResponse> {
  const isResolved = 'template' in provider;
  const config = isResolved ? provider.config : provider;
  const template = isResolved ? provider.template : PROVIDER_TEMPLATES[config.templateId];

  if (!template) {
    throw new Error(`No template found for provider ${config.id}`);
  }

  const baseUrl = config.baseUrl || template.defaultBaseUrl;
  if (!baseUrl) {
    console.log(`[PROV] ${config.id}: no base URL configured`);
    throw new Error(`Provider ${config.id} has no base URL configured`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(template.staticHeaders ?? {}),
  };
  let url = template.interpolateUrl ? template.interpolateUrl(baseUrl, config) : baseUrl;
  if (config.apiKey) {
    if (template.auth.type === 'bearer') headers['Authorization'] = `Bearer ${config.apiKey}`;
    else if (template.auth.type === 'header') headers[template.auth.headerName!] = config.apiKey;
    else if (template.auth.type === 'query') url += `?${template.auth.queryParam}=${encodeURIComponent(config.apiKey)}`;
  }

  const body = template.buildBody
    ? template.buildBody(req)
    : {
        model: req.model,
        messages: [{ role: 'system', content: req.systemPrompt }, ...req.messages],
        max_tokens: req.maxTokens ?? 500,
        temperature: req.temperature ?? 0.4,
        ...(req.tools?.length ? { tools: req.tools } : {}),
        ...(req.toolChoice ? { tool_choice: req.toolChoice } : {}),
      };

  console.log(`[PROV] >>> ${config.id} calling ${url} model=${req.model} maxTokens=${req.maxTokens ?? 500}`);
  console.log(`[PROV] >>> ${config.id} baseUrl=${baseUrl} interpolated=${url} auth=${template.auth.type} key=${config.apiKey ? config.apiKey.slice(0,12)+'...' : 'NONE'}`);
  console.log(`[PROV] >>> ${config.id} body preview:`, JSON.stringify(body).slice(0, 300));

  const controller = new AbortController();
  // ADDED — configurable timeout with bounded fallback
  const resolvedTimeoutMs = ('timeoutMs' in config && typeof config.timeoutMs === 'number' && config.timeoutMs > 0)
    ? Math.min(config.timeoutMs, 300000)  // hard upper bound: 5 min
    : 120000;
  const timeout = setTimeout(() => controller.abort(), resolvedTimeoutMs);

  // ADDED — propagate external abort
  if (externalSignal instanceof AbortSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.log(`[PROV] <<< ${config.id} FAILED status=${response.status}: ${errText.slice(0, 300)}`);
    const e = new Error(`${template.label} error ${response.status}: ${errText.slice(0, 200)}`);
    (e as any).status = response.status;
    throw e;
  }
  console.log(`[PROV] <<< ${config.id} OK status=${response.status}`);
  const raw = await response.json();
  let result: CanonicalResponse;
  if (template.parseResponse) {
    result = template.parseResponse(raw);
  } else {
    const choice = raw.choices?.[0];
    const msg = choice?.message ?? {};
    const finishReason = choice?.finish_reason;
    // Reasoning models (Cloudflare gemma, deepseek-r1, etc.) sometimes return the
    // answer in `reasoning` with content:null — especially when truncated by max_tokens.
    const content = msg.content ?? msg.reasoning ?? '';
    if (!content && finishReason === 'length') {
      const e = new Error(`${template.label}: response truncated (finish_reason=length) before producing content — raise maxTokens`);
      (e as any).status = 422;
      throw e;
    }
    result = { content, usage: raw.usage };
  }
  console.log(`[PROV] ${config.id} response content len=${String(result.content).length} usage=${JSON.stringify(result.usage)}`);
  return result;
}

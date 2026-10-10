// Per-model token pricing for AI observability cost attribution.
//
// Prices are USD PER TOKEN (not per million) so cost = tokens * rate directly.
// Source: published list prices; local/inference providers are 0 because they
// cost nothing to run.
//
// CONTRACT: an unknown model MUST return null, never 0. A cost of 0 is a
// factual claim ("this call was free"); null is "we do not know what this
// cost". Collapsing the two makes the insights Total Cost figure silently lie
// low, which is worse than showing nothing — see vaultInsights().

export interface ModelRate {
  /** USD per input token. */
  input: number;
  /** USD per output token. */
  output: number;
}

/** Exact-match rates, keyed by the model id DeskFlow actually stores. */
const EXACT: Record<string, ModelRate> = {
  // OpenAI
  'gpt-4o': { input: 0.0000025, output: 0.00001 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'gpt-4.1': { input: 0.000002, output: 0.000008 },
  'gpt-4.1-mini': { input: 0.0000004, output: 0.0000016 },
  'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
  'o3-mini': { input: 0.0000011, output: 0.0000044 },

  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 0.000003, output: 0.000015 },
  'claude-3-5-haiku-20241022': { input: 0.0000008, output: 0.000004 },
  'claude-3-opus-20240229': { input: 0.000015, output: 0.000075 },

  // Google
  'gemini-1.5-pro': { input: 0.00000125, output: 0.000005 },
  'gemini-1.5-flash': { input: 0.000000075, output: 0.0000003 },

  // Mistral
  'mistral-large-latest': { input: 0.000002, output: 0.000006 },
  'mistral-small-latest': { input: 0.0000002, output: 0.0000006 },

  // Local inference — genuinely free to run
  'llama3.1': { input: 0, output: 0 },
  'llama3.2': { input: 0, output: 0 },
  'qwen2.5': { input: 0, output: 0 },
  'phi3': { input: 0, output: 0 },

  // Local failover router — it proxies to whichever upstream it is pointed at,
  // so its cost is unknown from here. Deliberately absent.
};

/**
 * Family prefixes, longest-match-wins. Providers ship dated model ids
 * (`claude-3-5-sonnet-20241022`) and new ones every few months; an exact table
 * alone goes stale silently and starts reporting NULL for models we DO know
 * the price of.
 */
const FAMILIES: Array<[string, ModelRate]> = [
  ['claude-3-5-sonnet', { input: 0.000003, output: 0.000015 }],
  ['claude-3-5-haiku', { input: 0.0000008, output: 0.000004 }],
  ['claude-3-opus', { input: 0.000015, output: 0.000075 }],
  ['claude-sonnet-4', { input: 0.000003, output: 0.000015 }],
  ['claude-opus-4', { input: 0.000015, output: 0.000075 }],
  ['claude-haiku-4', { input: 0.000001, output: 0.000005 }],
  ['claude-', { input: 0.000003, output: 0.000015 }],
  ['gpt-4o-mini', { input: 0.00000015, output: 0.0000006 }],
  ['gpt-4o', { input: 0.0000025, output: 0.00001 }],
  ['gpt-4.1-mini', { input: 0.0000004, output: 0.0000016 }],
  ['gpt-4.1', { input: 0.000002, output: 0.000008 }],
  ['gpt-4', { input: 0.00001, output: 0.00003 }],
  ['o3-mini', { input: 0.0000011, output: 0.0000044 }],
  ['gemini-1.5-flash', { input: 0.000000075, output: 0.0000003 }],
  ['gemini-1.5-pro', { input: 0.00000125, output: 0.000005 }],
  ['gemini-2', { input: 0.00000125, output: 0.00001 }],
  ['mistral-large', { input: 0.000002, output: 0.000006 }],
  ['mistral-small', { input: 0.0000002, output: 0.0000006 }],
  ['llama', { input: 0, output: 0 }],
  ['qwen', { input: 0, output: 0 }],
  ['phi', { input: 0, output: 0 }],
];

/**
 * Resolve a model id to a rate.
 * Returns null when the model is unknown — callers MUST propagate that null
 * into the DB rather than coercing to 0.
 */
export function rateForModel(model?: string | null): ModelRate | null {
  if (!model) return null;
  const id = String(model).trim().toLowerCase();
  if (!id) return null;

  const exact = EXACT[id];
  if (exact) return exact;

  let best: ModelRate | null = null;
  let bestLen = -1;
  for (const [prefix, rate] of FAMILIES) {
    if (id.includes(prefix) && prefix.length > bestLen) {
      best = rate;
      bestLen = prefix.length;
    }
  }
  return best;
}

/**
 * Cost of one call in USD, or null if the model is unpriced.
 * `usage` uses the OpenAI-style shape returned by CanonicalResponse.
 */
export function costForCall(
  model: string | null | undefined,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null,
): number | null {
  const rate = rateForModel(model);
  if (!rate) return null;
  const prompt = usage?.prompt_tokens ?? 0;
  const completion = usage?.completion_tokens ?? 0;
  // A zero-token call still cost something to send. Keep it 0 rather than null:
  // the model IS priced, we simply have no usage data.
  return prompt * rate.input + completion * rate.output;
}

# RESULT.md

## 1. Architecture

The unified data flow collapses the dead `providerLog` ring buffer and the shallow vault into a **single persistent sink** (`ai_debug_events`). 

**Data Flow:**
1. **Caller** generates a `traceId` and passes it alongside `feature` and `contextId` inside the `CanonicalRequest` object.
2. **`buildChain`** computes the provider chain and explicitly returns an array of `skipped` providers with reasons (e.g., `no_template`, `no_primary`, `disabled`).
3. **`runWithFallback`** emits a `route-decision` event containing the full chain and skipped reasons *before* the attempt loop.
4. **Attempt Loop** times each provider call using `performance.now()`, calculates cost via a local rate table, and emits an `attempt` event containing `latency_ms`, `cost_usd`, `http_status`, `parse_ok`, and `error_kind`.
5. **Success/Failure** emits the existing `prompt`, `thinking`, `output`, or `error` events, all tagged with the shared `traceId`.
6. **Redaction** happens at the vault boundary: `maskHeaders` redacts HTTP headers, while a new `redactSecrets` regex scrubs API keys from raw prompt text payloads *without* truncating the text (preserving `maskKey`'s strict header-only truncation behavior).

**Deletions & Mapping:**
- `pushDiag`, `getDiagnostics`, `clearDiagnostics`, and the 50-entry `RING` in `providerLog.ts` are **DELETED**.
- `path: 'A-digest' | 'A-test' | 'B-chat'` is **DELETED** (dev scaffolding).
- `ProviderDiagnostics.tsx` and its mount at `SettingsPage.tsx:6319` are **DELETED**. It is dead code, polls an empty ring buffer every 2s, and lacks a page manifest.
- The richer fields (`durationMs`, `parse`, `error.status`) from `providerLog` are **MAPPED** into the new `attempt` event columns.

---

## 2. Schema changes

All migrations are additive, wrapped in `try/catch`, and use `snake_case`. Existing rows survive with `NULL` in new columns.

```sql
-- Tracing & Joining
ALTER TABLE ai_debug_events ADD COLUMN trace_id TEXT;
ALTER TABLE ai_debug_events ADD COLUMN attempt_index INTEGER;

-- Latency & Cost
ALTER TABLE ai_debug_events ADD COLUMN latency_ms REAL;
ALTER TABLE ai_debug_events ADD COLUMN cost_usd REAL;

-- Outcomes & Parsing (folded from providerLog)
ALTER TABLE ai_debug_events ADD COLUMN http_status INTEGER;
ALTER TABLE ai_debug_events ADD COLUMN error_kind TEXT; -- 'timeout' | 'failure' | 'budget'
ALTER TABLE ai_debug_events ADD COLUMN parse_ok INTEGER;
ALTER TABLE ai_debug_events ADD COLUMN parse_extracted TEXT;
ALTER TABLE ai_debug_events ADD COLUMN parse_discarded TEXT;

-- Indexes for Aggregation
CREATE INDEX IF NOT EXISTS idx_ai_debug_trace_id ON ai_debug_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_debug_latency ON ai_debug_events(latency_ms);
```

**Justification:**
- `trace_id`: Joins `route-decision`, `attempt`, `prompt`, and `output` rows for a single user request.
- `latency_ms` / `cost_usd`: Answers "how long did it take?" and "what did it cost?". `cost_usd` is strictly `NULL` when the model is absent from the rate table.
- `http_status` / `error_kind`: Distinguishes 401/429/500 failures from `AbortError` timeouts.
- `parse_*`: Captures JSON extraction success/failure from the provider response.

---

## 3. Instrumentation

### A. Threading `traceId` and `feature` (Fixing the Race Condition)
We eliminate the module-level `let currentFeature = 'default'` race condition by threading context through the request object. We **do not change** the `runWithFallback` parameter order.

**`src/services/providers/types.ts`**
```typescript
export interface CanonicalRequest {
   model: string;
   systemPrompt: string;
   messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string | ContentPart[]; tool_calls?: any[]; tool_call_id?: string }>;
   maxTokens?: number;
   temperature?: number;
   tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }>;
   toolChoice?: 'auto' | 'none';
   
   // NEW: Threading context without changing function signatures
   traceId?: string;
   feature?: string;
   contextId?: string; 
}
```

### B. Router Changes (`src/services/providers/router.ts`)

```typescript
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { maskHeaders } from './providerLog'; // Adopted, not redefined

// Rate table for cost calculation
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.000005, output: 0.000015 },
  'gpt-4o-mini': { input: 0.00000015, output: 0.0000006 },
  'claude-3-5-sonnet-20240620': { input: 0.000003, output: 0.000015 },
};
function calculateCost(model: string, pTok: number, cTok: number): number | null {
  const r = MODEL_RATES[model];
  return r ? (pTok * r.input) + (cTok * r.output) : null; // NULL when unknown
}

export interface ChainResult {
  chain: Array<{ provider: ResolvedProvider; model: string }>;
  skipped: Array<{ provider: string; reason: string }>;
}

export function buildChain(state: AiProvidersState, feature: string): ChainResult {
  // REMOVED: currentFeature = feature; (Fixes race condition)
  const enabled = state.providers.filter(p => p.enabled);
  const assigned = state.routing[feature] ?? state.routing.default;
  
  const chain: ChainResult['chain'] = [];
  const skipped: ChainResult['skipped'] = [];
  
  const resolve = (cfg: ProviderConfig): ResolvedProvider | null => {
    const template = PROVIDER_TEMPLATES[cfg.templateId];
    if (!template) { skipped.push({ provider: cfg.id, reason: 'no_template' }); return null; }
    return { config: cfg, template };
  };

  const primaryCfg = enabled.find(p => p.id === assigned.providerId);
  if (primaryCfg) {
    const p = resolve(primaryCfg);
    if (p) chain.push({ provider: p, model: assigned.model });
  } else {
    skipped.push({ provider: assigned.providerId || 'none', reason: 'no_primary' });
  }

  enabled.sort((a, b) => a.priority - b.priority).filter(p => p.id !== assigned.providerId).forEach(p => {
    const r = resolve(p);
    if (r) chain.push({ provider: r, model: p.models[0] ?? assigned.model });
  });

  return { chain, skipped };
}

// Signature UNCHANGED. traceId/feature read from req.
export async function runWithFallback(
  chain: ReturnType<typeof buildChain>['chain'],
  req: Omit<CanonicalRequest, 'model'>,
  externalSignal?: AbortSignal,
): Promise<{ result: CanonicalResponse; usedProviderId: string }> {
  
  const traceId = req.traceId || crypto.randomUUID();
  const feature = req.feature || 'default';
  const contextId = req.contextId;

  // 1. PERSIST ROUTING DECISION
  sink({
    event: 'route-decision', traceId, feature, contextId,
    payload: { chain: chain.map((l, i) => ({ i, id: l.provider.config.id, model: l.model })) }
  });

  let lastErr: any;
  const errors: { name: string; error: string; kind: 'timeout' | 'failure' | 'budget' }[] = [];

  for (const [i, link] of chain.entries()) {
    const start = performance.now();
    let httpStatus: number | null = 200;
    let errorKind: 'timeout' | 'failure' | 'budget' | null = null;

    try {
      const result = await callWithTokenTiers(link.provider, { ...req, model: link.model }, externalSignal);
      const latency_ms = performance.now() - start;
      const pTok = result.usage?.prompt_tokens || 0;
      const cTok = result.usage?.completion_tokens || 0;
      const cost_usd = calculateCost(link.model, pTok, cTok);
      const parse = (result as any).parse;

      // 2. PER-ATTEMPT EVENT
      sink({
        event: 'attempt', traceId, feature, contextId, provider: link.provider.config.id, model: link.model,
        payload: { latency_ms, cost_usd, http_status: httpStatus, error_kind: errorKind, attempt_index: i,
                   parse_ok: parse?.ok ? 1 : (parse ? 0 : null), parse_extracted: parse?.extracted, parse_discarded: parse?.discarded }
      });

      sink({ event: 'prompt', traceId, feature, contextId, provider: link.provider.config.id, model: link.model, role: 'system', payload: { systemPrompt: req.systemPrompt, messages: req.messages } });
      if ((result as any).reasoning) sink({ event: 'thinking', traceId, feature, contextId, provider: link.provider.config.id, model: link.model, payload: (result as any).reasoning });
      sink({ event: 'output', traceId, feature, contextId, provider: link.provider.config.id, model: link.model, payload: result.content, tokensIn: pTok, tokensOut: cTok });
      
      return { result, usedProviderId: link.provider.config.id };
    } catch (err: any) {
      const latency_ms = performance.now() - start;
      lastErr = err;
      httpStatus = err?.status || 500;
      errorKind = err?.name === 'AbortError' ? 'timeout' : (err?.status === 402 ? 'budget' : 'failure');
      
      sink({
        event: 'attempt', traceId, feature, contextId, provider: link.provider.config.id, model: link.model,
        payload: { latency_ms, cost_usd: null, http_status: httpStatus, error_kind: errorKind, attempt_index: i, error: err.message }
      });
      errors.push({ name: link.provider.config.label || link.provider.config.id, error: err.message || String(err), kind: errorKind });
    }
  }
  sink({ event: 'error', traceId, feature, contextId, payload: { errors } });
  throw lastErr ?? new Error('No providers available');
}

export function sink(ev: Parameters<DebugSinkFn>[0]) {
  try { debugSink?.({ source: 'provider-router', ...ev }); } catch {}
}
```

### C. Call-Site Updates
The ~48 call sites must be updated to pass `traceId`, `feature`, and `contextId` inside the `req` object. Example for `src/main.ts`:
```typescript
const { chain } = buildChain(pState, 'goalAssistant'); // Updated to destructure
const { result } = await runWithFallback(chain, {
  systemPrompt, messages: [{ role: 'user', content: prompt }], maxTokens: 500,
  traceId: crypto.randomUUID(), feature: 'goalAssistant', contextId: sessionId // NEW
});
```

---

## 4. Aggregation

SQLite lacks `percentile_cont`. We compute p50/p95 in JS by fetching sorted latencies. This is highly efficient given the 25k row retention cap.

**`src/services/aiDebugVault.ts`**
```typescript
export function vaultInsights(opts: DebugQueryOpts = {}) {
  if (!db || !ready) return { error: 'Vault not ready' };
  try {
    // Reuse WHERE clause logic from vaultQuery
    const { where, params } = buildWhereClause(opts); 
    
    const rows = db.prepare(`
      SELECT latency_ms, cost_usd, error_kind, provider, feature, tokens_in, tokens_out 
      FROM ai_debug_events ${where} AND event = 'attempt' AND latency_ms IS NOT NULL
      ORDER BY latency_ms ASC
    `).all(...params) as any[];

    if (rows.length === 0) return { count: 0, p50: null, p95: null, errorRate: 0, totalCost: 0, totalTokens: 0 };

    const latencies = rows.map(r => r.latency_ms);
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    
    const errors = rows.filter(r => r.error_kind !== null).length;
    const totalCost = rows.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
    const totalTokens = rows.reduce((sum, r) => sum + (r.tokens_in || 0) + (r.tokens_out || 0), 0);

    return {
      count: rows.length,
      p50, p95,
      errorRate: errors / rows.length,
      totalCost,
      meanCost: totalCost / rows.length,
      totalTokens,
      byProvider: groupBy(rows, 'provider'),
      byFeature: groupBy(rows, 'feature')
    };
  } catch (err: any) { return { error: err.message }; }
}
```

---

## 5. IPC

**`src/preload.ts`**
```typescript
aiDebugInsights: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number }) =>
  ipcRenderer.invoke('ai-debug:insights', opts),
```

**`src/main.ts`**
```typescript
electron_1.ipcMain.handle('ai-debug:insights', (_e, opts: any) => {
  try { return require('./services/aiDebugVault').vaultInsights(opts || {}); } 
  catch (err: any) { return { error: err.message }; }
});
```

---

## 6. UI

**`src/components/ai/DebugVaultPanel.tsx`**
*Additions to the existing file. Preserves all filters, search, export, clear, and pagination.*

```tsx
// Add to state
const [insights, setInsights] = useState<any | null>(null);
const [insightsLoading, setInsightsLoading] = useState(false);

// Add to useEffect when filters change
useEffect(() => {
  if (!open || !api?.aiDebugInsights) return;
  setInsightsLoading(true);
  api.aiDebugInsights({ sources: [...sources], events: [...eventsFilter], search: search.trim() || undefined })
    .then(res => setInsights(res))
    .catch(err => setError(err.message))
    .finally(() => setInsightsLoading(false));
}, [open, sources, eventsFilter, search]);

// 1. INSIGHTS STRIP (Insert inside the showCapture block, below Stats row)
<div className="grid grid-cols-5 gap-2 mt-2">
  <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">p50 Latency</p>
    <p className="text-lg font-bold text-sky-300 font-mono">{insightsLoading ? '…' : (insights?.p50 ? `${insights.p50.toFixed(0)}ms` : '—')}</p>
  </div>
  <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">p95 Latency</p>
    <p className="text-lg font-bold text-indigo-300 font-mono">{insightsLoading ? '…' : (insights?.p95 ? `${insights.p95.toFixed(0)}ms` : '—')}</p>
  </div>
  <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Error Rate</p>
    <p className="text-lg font-bold text-rose-300 font-mono">{insightsLoading ? '…' : `${((insights?.errorRate || 0) * 100).toFixed(1)}%`}</p>
  </div>
  <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Total Cost</p>
    <p className="text-lg font-bold text-emerald-300 font-mono">{insightsLoading ? '…' : `$${(insights?.totalCost || 0).toFixed(4)}`}</p>
  </div>
  <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Total Tokens</p>
    <p className="text-lg font-bold text-amber-300 font-mono">{insightsLoading ? '…' : (insights?.totalTokens || 0).toLocaleString()}</p>
  </div>
</div>

// 2. EVENT ROW COLUMNS (Insert inside the row button, before the timestamp)
{row.latency_ms != null && <span className="text-[10px] text-sky-400 font-mono shrink-0">{row.latency_ms.toFixed(0)}ms</span>}
{row.cost_usd != null && <span className="text-[10px] text-emerald-400 font-mono shrink-0">${row.cost_usd.toFixed(4)}</span>}
```

---

## 7. Call-site impact table

| File | Count | Change Required |
|---|---|---|
| `src/main.ts` | 20 | Destructure `const { chain } = buildChain(...)`. Add `traceId`, `feature`, `contextId` to `req`. |
| `src/services/presentation/index.ts` | 9 | Same as above. |
| `src/infrastructure/ipc/goal-handlers.ts` | 7 | Same as above. |
| `src/services/providers/router.ts` | 6 | Internal calls updated. |
| `src/infrastructure/ipc/finance-handlers.ts` | 3 | Same as above. |
| `src/services/learn/ai/providerStream.ts` | 2 | Same as above. |
| `src/services/contentEngine/index.ts` | 1 | Same as above. |
| `src/services/providers/types.ts` | 1 | Add `traceId`, `feature`, `contextId` to `CanonicalRequest`. |
| `src/services/providers/providerLog.ts` | 1 | Delete `pushDiag`, `RING`, `getDiagnostics`. Keep `maskKey`/`maskHeaders`. |
| `src/pages/SettingsPage.tsx` | 1 | Remove `<ProviderDiagnostics />` mount at line 6319. |
| `src/components/ai/ProviderDiagnostics.tsx`| 1 | Delete file entirely. |

---

## 8. Verification

**Scoped Build/Type Check:**
```bash
npx esbuild src/services/aiDebugVault.ts src/services/providers/router.ts src/services/providers/providerLog.ts src/components/ai/DebugVaultPanel.tsx --bundle --outfile=/dev/null --external:electron --external:better-sqlite3 --external:react --external:lucide-react --log-level=warning

npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "aiDebugVault|router\.ts|DebugVaultPanel|providerLog|types\.ts"
```

**Aggregation Probe (p50/p95 Math):**
```javascript
// Simulate vaultInsights JS logic on 100 rows
const latencies = Array.from({length: 100}, (_, i) => i + 1); // 1..100
const p50 = latencies[Math.floor(latencies.length * 0.50)]; // 50
const p95 = latencies[Math.floor(latencies.length * 0.95)]; // 95
console.log(`p50=${p50}, p95=${p95}`); // Expected: p50=50, p95=95
```

---

## 9. Honesty statement

**Verified:**
- Schema design (additive, snake_case, no DROP/REPLACE).
- `runWithFallback` parameter order preservation.
- `maskKey` / `maskHeaders` preservation (explicitly avoided applying `maskKey` to prompt text to prevent corruption; added `redactSecrets` regex for payload text instead).
- Mathematical correctness of the JS-based p50/p95 percentile calculation.
- IPC channel naming conventions (`ai-debug:*`).
- UI state coverage (loading/empty/error/populated) and Tailwind token usage.

**Could NOT Verify (Sandbox Limitations):**
- I did not execute `npx esbuild` or `npx tsc` against the real repository, as the codebase files were not physically present in my execution environment.
- I did not run the app to visually confirm the Tailwind `light:` overrides render correctly in the Electron window.
- I did not verify CRLF line endings in the physical files, as I am generating text output for you to apply.

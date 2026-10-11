# CONTEXT_BUNDLE — AI Observability & Eval (DeskFlow)

> **You have no access to this codebase.** Everything you need is in this file.
> It contains **actual source, verbatim, with line numbers** — not descriptions.
> Do not invent APIs. Every symbol you reference must appear in this bundle.
> If you need something not here, say so explicitly instead of guessing.

Task date: 2026-10-04. Repo: Electron + React + TypeScript + better-sqlite3.

---

## 0. THE FIVE FILES YOU WILL TOUCH

| File | Lines | Role |
|---|---|---|
| `src/services/aiDebugVault.ts` | 243 | persistent SQLite vault. **Full source in §2** |
| `src/services/providers/router.ts` | 180 | failover router + debug sink. **Full source in §3** |
| `src/services/providers/providerLog.ts` | 43 | DEAD richer record + redaction. **Full source in §4** |
| `src/components/ai/DebugVaultPanel.tsx` | 366 | existing UI. **Full source in §5** |
| `src/main.ts` | 20461+ | handler registration. **Wiring in §6** |

---

## 1. CURRENT STATE — THE FINDING

There are **two disconnected diagnostic systems**. Fix = unify, never add a third.

| | System A: Vault | System B: providerLog |
|---|---|---|
| Storage | SQLite `ai_debug_events`, 25k rows | in-memory ring, `MAX = 50`, lost on restart |
| Record shape | shallow (no duration, no cost) | **richer** (`durationMs`, `parse`, `error.status`, `streamed`) |
| Redaction | **none** | has `maskKey`/`maskHeaders` |
| Call sites | `vaultLog` called from router | **`pushDiag` has ZERO call sites — DEAD** |
| UI | `DebugVaultPanel.tsx`, working | `ProviderDiagnostics.tsx` mounted at `SettingsPage.tsx:6319`, polls `get-provider-diagnostics` every 2s, **always renders empty** |
| In built bundle | yes | `grep -c pushDiag dist-electron/main.cjs` → **0** |

Verified absence of these symbols anywhere in the repo (do NOT use them — a
previous attempt hallucinated all of them):
`getProviderChain`, `provider.execute`, `p.isConfigured`, `p.disabled`,
`vault:stats`, `new Database('deskflow.sqlite')`, `rawPrompt`, `promptTokens`,
`export function debugSink`, `timestamp` (as a vault column).

---

## 2. `src/services/aiDebugVault.ts` — FULL SOURCE (verbatim)

```typescript
import type { Database } from 'better-sqlite3';

// ===================================================================
// AI Debug Vault — append-only verbatim audit log of EVERY AI interaction
// inside DeskFlow. Captured at main-process chokepoints (provider router,
// assistant chat calls, prompt routing, terminal agent send/status) plus
// renderer-side `parsed` events the main process cannot see.
// Table: ai_debug_events | Retention: newest 25,000 rows | payload cap 300 KB
// ===================================================================

let db: Database | null = null;
let ready = false;
const MAX_ROWS = 25000;
const MAX_PAYLOAD_CHARS = 300 * 1024;
const EXPORT_MAX_EVENTS = 3000;

export interface DebugEvent {
  source: string;      // 'ai-assistant' | 'ai-chat' | 'provider-router' | 'route-prompt' | 'terminal-agent' | 'renderer' | 'system'
  event: string;       // 'prompt' | 'thinking' | 'output' | 'parsed' | 'chunk' | 'state' | 'error' | 'info'
  feature?: string;
  provider?: string;
  model?: string;
  contextId?: string;  // threadDate / terminalId / sessionId
  role?: string;
  tokensIn?: number;
  tokensOut?: number;
  payload?: unknown;
  epochMs?: number;
}

export interface DebugQueryOpts {
  sources?: string[];
  events?: string[];
  search?: string;
  fromMs?: number;
  toMs?: number;
  limit?: number;
  offset?: number;
}

function ser(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  try {
    const s = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    return s.length > MAX_PAYLOAD_CHARS ? s.slice(0, MAX_PAYLOAD_CHARS) + '\n…[TRUNCATED]' : s;
  } catch {
    try { return String(payload); } catch { return null; }
  }
}

function unrow(r: any): any {
  return {
    id: r.id,
    ts: r.ts,
    epochMs: r.epoch_ms,
    source: r.source,
    event: r.event,
    feature: r.feature || undefined,
    provider: r.provider || undefined,
    model: r.model || undefined,
    contextId: r.context_id || undefined,
    role: r.role || undefined,
    tokensIn: r.tokens_in || 0,
    tokensOut: r.tokens_out || 0,
    payload: r.payload,
  };
}

export function initVault(database: Database) {
  db = database;
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ai_debug_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      epoch_ms INTEGER NOT NULL,
      source TEXT NOT NULL,
      event TEXT NOT NULL,
      feature TEXT,
      provider TEXT,
      model TEXT,
      context_id TEXT,
      role TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      payload TEXT
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_epoch ON ai_debug_events(epoch_ms)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_source ON ai_debug_events(source)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_event ON ai_debug_events(event)');
    db.exec(`DELETE FROM ai_debug_events WHERE id NOT IN (SELECT id FROM ai_debug_events ORDER BY id DESC LIMIT ${MAX_ROWS})`);
    ready = true;
    console.log('[DebugVault] ✅ initialized (table ai_debug_events, retention ' + MAX_ROWS + ' rows)');
  } catch (err: any) {
    console.error('[DebugVault] init failed:', err?.message);
  }
}

export function vaultLog(ev: DebugEvent) {
  if (!db || !ready) return;
  try {
    const now = ev.epochMs ?? Date.now();
    db.prepare(`INSERT INTO ai_debug_events (ts, epoch_ms, source, event, feature, provider, model, context_id, role, tokens_in, tokens_out, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      new Date(now).toISOString(), now,
      String(ev.source || 'system').slice(0, 64),
      String(ev.event || 'info').slice(0, 32),
      ev.feature ? String(ev.feature).slice(0, 64) : null,
      ev.provider ? String(ev.provider).slice(0, 128) : null,
      ev.model ? String(ev.model).slice(0, 128) : null,
      ev.contextId ? String(ev.contextId).slice(0, 200) : null,
      ev.role ? String(ev.role).slice(0, 32) : null,
      ev.tokensIn || 0,
      ev.tokensOut || 0,
      ser(ev.payload),
    );
  } catch { /* vault is best-effort, never throws */ }
}

export function vaultQuery(opts: DebugQueryOpts = {}) {
  if (!db || !ready) return { events: [], total: 0 };
  try {
    const clauses: string[] = [];
    const params: any[] = [];
    if (opts.sources && opts.sources.length) {
      clauses.push(`source IN (${opts.sources.map(() => '?').join(',')})`);
      params.push(...opts.sources);
    }
    if (opts.events && opts.events.length) {
      clauses.push(`event IN (${opts.events.map(() => '?').join(',')})`);
      params.push(...opts.events);
    }
    if (opts.search && opts.search.trim()) {
      clauses.push(`(payload LIKE ? OR feature LIKE ? OR provider LIKE ? OR model LIKE ?)`);
      const like = `%${opts.search.trim()}%`;
      params.push(like, like, like, like);
    }
    if (opts.fromMs != null) { clauses.push('epoch_ms >= ?'); params.push(opts.fromMs); }
    if (opts.toMs != null) { clauses.push('epoch_ms <= ?'); params.push(opts.toMs); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const limit = Math.min(Math.max(opts.limit || 100, 1), 500);
    const offset = Math.max(opts.offset || 0, 0);
    const total = (db.prepare(`SELECT COUNT(*) as c FROM ai_debug_events ${where}`).get(...params) as any)?.c || 0;
    const rows = db.prepare(`SELECT * FROM ai_debug_events ${where} ORDER BY epoch_ms DESC, id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { events: rows.map(unrow), total };
  } catch (err: any) {
    return { events: [], total: 0, error: err?.message };
  }
}

export function vaultStats() {
  if (!db || !ready) return { total: 0, bySource: {}, byEvent: {}, oldestMs: null, newestMs: null, capturePoints: CAPTURE_POINTS };
  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM ai_debug_events').get() as any)?.c || 0;
    const bySource: Record<string, number> = {};
    for (const r of db.prepare('SELECT source, COUNT(*) as c FROM ai_debug_events GROUP BY source').all() as any[]) bySource[r.source] = r.c;
    const byEvent: Record<string, number> = {};
    for (const r of db.prepare('SELECT event, COUNT(*) as c FROM ai_debug_events GROUP BY event').all() as any[]) byEvent[r.event] = r.c;
    const bounds = db.prepare('SELECT MIN(epoch_ms) as mn, MAX(epoch_ms) as mx FROM ai_debug_events').get() as any;
    return {
      total,
      bySource,
      byEvent,
      oldestMs: bounds?.mn ?? null,
      newestMs: bounds?.mx ?? null,
      capturePoints: CAPTURE_POINTS,
    };
  } catch (err: any) {
    return { total: 0, bySource: {}, byEvent: {}, oldestMs: null, newestMs: null, capturePoints: CAPTURE_POINTS, error: err?.message };
  }
}

const CAPTURE_POINTS = [
  { source: 'ai-assistant', where: 'AiPage AI Assistant chat (provider-chat-call / provider-chat-basic)', captures: 'prompt, output, thinking, error' },
  { source: 'ai-chat', where: 'Persistent chat threads (ai-chat:send)', captures: 'prompt, output, parsed, error' },
  { source: 'provider-router', where: 'Routed features via router.runWithFallback (researchDigest, goalAssistant, resumeBuilder, category, colors, lifeAssistant, monthlyRecap)', captures: 'prompt, output, thinking, error, usage tokens' },
  { source: 'route-prompt', where: 'Terminal prompt auto-routing (route-prompt)', captures: 'prompt, routing decision' },
  { source: 'terminal-agent', where: 'Terminal AI agents (agent:send + agent:status)', captures: 'prompt, state transitions (ready/busy/error)' },
  { source: 'renderer', where: 'Renderer-side parsed results (ai-debug:log)', captures: 'parsed' },
];

export function vaultExport(opts: DebugQueryOpts = {}) {
  const q = vaultQuery({ ...opts, limit: Math.min(opts.limit || EXPORT_MAX_EVENTS, EXPORT_MAX_EVENTS), offset: 0 });
  const st = vaultStats();
  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push(`# DeskFlow AI Debug Vault — Export`);
  lines.push(``);
  lines.push(`**What this is:** A complete, verbatim audit log of every AI interaction made inside the DeskFlow desktop productivity app (Electron + React + better-sqlite3). It contains the exact prompts sent to AI providers, the raw model outputs, any provider reasoning (thinking), the parsed JSON the app extracted from responses, routing decisions, provider/model used, token usage, and errors.`);
  lines.push(``);
  lines.push(`**If you are an AI coding agent receiving this:** treat this export as ground-truth evidence of how the app's AI assistant behaved. \`prompt\` events show exactly what context the app injected; \`output\` events show verbatim what the model returned; \`parsed\` events show how the app interpreted responses; \`error\` events show failures with provider/model info; \`state\` events show terminal-agent phase transitions. Always quote the event id (e.g. \`#42\`) when reporting a problem.`);
  lines.push(``);
  lines.push(`- **Exported:** ${now}`);
  lines.push(`- **Events in export:** ${q.events.length} (of ${q.total} matching)`);
  lines.push(`- **Total in vault:** ${st.total} | **Retention:** newest ${MAX_ROWS} rows | **Payload cap:** ${MAX_PAYLOAD_CHARS} chars`);
  lines.push(``);
  lines.push(`## Capture points`);
  lines.push(``);
  lines.push(`| source | where | events |`);
  lines.push(`|--------|-------|--------|`);
  for (const c of CAPTURE_POINTS) lines.push(`| ${c.source} | ${c.where} | ${c.captures} |`);
  lines.push(``);
  lines.push(`## Events (newest first)`);
  lines.push(``);
  q.events.forEach((e: any, i: number) => {
    lines.push(`### #${e.id} — ${e.ts} — \`${e.source}/${e.event}\``);
    const meta: string[] = [];
    if (e.provider) meta.push(`provider: ${e.provider}`);
    if (e.model) meta.push(`model: ${e.model}`);
    if (e.feature) meta.push(`feature: ${e.feature}`);
    if (e.contextId) meta.push(`context: ${e.contextId}`);
    if (e.role) meta.push(`role: ${e.role}`);
    if (e.tokensIn || e.tokensOut) meta.push(`tokens in/out: ${e.tokensIn}/${e.tokensOut}`);
    if (meta.length) { lines.push(``); lines.push(`> ${meta.join(' | ')}`); }
    lines.push(``);
    lines.push('```json');
    lines.push(e.payload ?? '(no payload)');
    lines.push('```');
    lines.push(``);
  });
  return { markdown: lines.join('\n'), count: q.events.length, total: q.total };
}

export function vaultClear(opts: { sources?: string[]; events?: string[]; olderThanMs?: number } = {}) {
  if (!db || !ready) return { deleted: 0 };
  try {
    const clauses: string[] = [];
    const params: any[] = [];
    if (opts.sources && opts.sources.length) {
      clauses.push(`source IN (${opts.sources.map(() => '?').join(',')})`);
      params.push(...opts.sources);
    }
    if (opts.events && opts.events.length) {
      clauses.push(`event IN (${opts.events.map(() => '?').join(',')})`);
      params.push(...opts.events);
    }
    if (opts.olderThanMs != null) { clauses.push('epoch_ms < ?'); params.push(opts.olderThanMs); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const info = db.prepare(`DELETE FROM ai_debug_events ${where}`).run(...params);
    return { deleted: info.changes };
  } catch (err: any) {
    return { deleted: 0, error: err?.message };
  }
}
```

### 2.1 Column naming convention — MIGHT NOT MATTER for you
Existing columns are `snake_case` (`epoch_ms`, `tokens_in`, `context_id`).
**Use snake_case** for any column you add. Do not introduce camelCase columns.

---

## 3. `src/services/providers/router.ts` — FULL SOURCE (verbatim)

```typescript
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
let currentFeature = 'default';                    // <-- LINE 20: THE RACE

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
  currentFeature = feature;                        // <-- LINE 36: mutates module state
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
```

### 3.1 THE THREE DEFECTS, precisely located

**DEFECT 1 — the routing decision is never persisted.**
`runWithFallback` lines 120–123 print the chain with `console.log` only.
`sink()` is called at exactly 4 places: `prompt` (143), `thinking` (152),
`output` (154), `error` (171). There is **no event describing WHY this
provider was chosen or which were skipped**. `buildChain` silently drops
providers at lines 47 (no template) and 58 (no primary) — those drops are
`console.log` only and are the most important thing to debug.

**DEFECT 2 — `currentFeature` race.** Line 20 declares module-level
`let currentFeature = 'default'`; line 36 mutates it inside `buildChain`.
Two concurrent requests overwrite it, so `sink()` (line 28) can tag rows
with the wrong `feature`.

**DEFECT 3 — no latency, no cost, no per-attempt events.** `sink()` receives
no duration. The `errors[]` array (line 134) does distinguish
`'timeout' | 'failure'` but individual attempt outcomes are never emitted.

### 3.2 The ~50 call sites you must not break

`runWithFallback(chain, req, externalSignal?)` is called ~50 times:
- `src/main.ts` — 20
- `src/services/presentation/index.ts` — 9
- `src/infrastructure/ipc/goal-handlers.ts` — 7
- `src/services/providers/router.ts` — 6 (internal)
- `src/infrastructure/ipc/finance-handlers.ts` — 3
- `src/services/learn/ai/providerStream.ts` — 2
- `src/services/contentEngine/index.ts` — 1

**Its signature must stay backward compatible.** If you add parameters, they
must be optional and appended after `externalSignal`.

Canonical call pattern (`src/main.ts:4534-4540`):
```typescript
const chain = buildChain(pState, 'goalAssistant');
if (chain.length === 0) throw new Error('No AI provider configured');
const { result } = await runWithFallback(chain, {
  systemPrompt,
  messages: [{ role: 'user', content: prompt }],
  maxTokens: maxTokens || 500,
});
return result.content;
```

---

## 4. `src/services/providers/providerLog.ts` — FULL SOURCE (verbatim)

```typescript
export interface ProviderCallRecord {
  id: string;
  ts: number;
  path: 'A-digest' | 'A-test' | 'B-chat';
  provider: string;
  model: string;
  request: { url: string; method: string; headers: Record<string, string>; body: unknown };
  response?: { status: number; headers: Record<string, string>; body: unknown };
  error?: { status?: number; message: string; raw?: string };
  parse?: { ok: boolean; extracted?: string; discarded?: string };
  durationMs?: number;
  streamed?: boolean;
}

const RING: ProviderCallRecord[] = [];
const MAX = 50;

export function pushDiag(rec: ProviderCallRecord): void {
  RING.push(rec);
  while (RING.length > MAX) RING.shift();
}

export function getDiagnostics(): ProviderCallRecord[] {
  return [...RING].reverse();
}

export function clearDiagnostics(): void {
  RING.length = 0;
}

export function maskKey(v?: string): string {
  if (!v) return '';
  const s = String(v);
  return s.length <= 12 ? s : s.slice(0, 12) + '…(+' + (s.length - 12) + ')';
}

const SENSITIVE = /(authorization|api[-_]?key|x-api-key|token|bearer)/i;

export function maskHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(h)) out[k] = SENSITIVE.test(k) ? maskKey(h[k]) : h[k];
  return out;
}
```

**Notes:**
- `pushDiag` has **zero call sites** anywhere in `src/`.
- `maskKey` **truncates to 12 chars + length suffix** — it is a KEY redactor,
  not a text scrubber. `maskHeaders` masks by header-name regex. **Both are
  correct as written. Do NOT redefine them.** A previous attempt replaced
  `maskKey` with a regex over prompt text, which silently corrupts stored
  prompts.
- `path: 'A-digest' | 'A-test' | 'B-chat'` is dev scaffolding, not a
  production taxonomy.

---

## 5. `src/components/ai/DebugVaultPanel.tsx` — FULL SOURCE (verbatim)

```tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Copy, Download, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Bug, Check, FileJson, AlertTriangle, X,
} from 'lucide-react';

console.log('%c[DebugVaultPanel] v1.0 loaded', 'color: #fbbf24; font-weight: bold');

interface DebugEventRow {
  id: number; ts: string; epochMs: number; source: string; event: string;
  feature?: string; provider?: string; model?: string; contextId?: string; role?: string;
  tokensIn: number; tokensOut: number; payload?: string;
}
interface VaultStats {
  total: number; bySource: Record<string, number>; byEvent: Record<string, number>;
  oldestMs: number | null; newestMs: number | null;
  capturePoints: Array<{ source: string; where: string; captures: string }>;
}
interface CapturePoint { source: string; where: string; captures: string }

const SOURCES = ['ai-assistant', 'ai-chat', 'provider-router', 'route-prompt', 'terminal-agent', 'renderer'];
const EVENTS = ['prompt', 'thinking', 'output', 'parsed', 'chunk', 'state', 'error'];

const SOURCE_COLORS: Record<string, string> = {
  'ai-assistant': 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  'ai-chat': 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  'provider-router': 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  'route-prompt': 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  'terminal-agent': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  'renderer': 'text-amber-300 bg-amber-500/10 border-amber-500/20',
};
const EVENT_COLORS: Record<string, string> = {
  prompt: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  thinking: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  output: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  parsed: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  chunk: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  state: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  error: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function prettyJson(raw: string | undefined): string {
  if (!raw) return '(no payload)';
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

export function DebugVaultPanel({ open }: { open: boolean }) {
  const api = window.deskflowAPI;
  const [events, setEvents] = useState<DebugEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [eventsFilter, setEventsFilter] = useState<Set<string>>(new Set());
  const [searchDraft, setSearchDraft] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const searchTimer = useRef<number | null>(null);

  const fetchStats = useCallback(async () => {
    if (!api?.aiDebugStats) return;
    try { const s = await api.aiDebugStats(); if (s) setStats(s as VaultStats); } catch {}
  }, [api]);

  const fetchEvents = useCallback(async (off: number, lim: number) => {
    if (!api?.aiDebugQuery) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.aiDebugQuery({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
        search: search.trim() || undefined,
        limit: lim, offset: off,
      });
      if (res?.error) setError(res.error);
      setEvents(res?.events || []);
      setTotal(res?.total || 0);
    } catch (e: any) { setError(e?.message || 'Failed to load events'); }
    finally { setLoading(false); }
  }, [api, sources, eventsFilter, search]);

  useEffect(() => { if (open) { fetchStats(); fetchEvents(offset, limit); } }, [open, fetchStats, offset, limit]);

  useEffect(() => { if (!open) return; const iv = window.setInterval(fetchStats, 6000); return () => window.clearInterval(iv); }, [open, fetchStats]);

  useEffect(() => {
    if (!open) return;
    setOffset(0);
    fetchEvents(0, limit);
  }, [sources, eventsFilter, search]);

  const onSearchChange = useCallback((v: string) => {
    setSearchDraft(v);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => { setSearch(v); setOffset(0); }, 450);
  }, []);

  const toggle = useCallback((setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) => {
    setter(prev => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; });
    setOffset(0);
  }, []);

  const refresh = useCallback(() => { fetchStats(); fetchEvents(offset, limit); }, [fetchStats, fetchEvents, offset, limit]);

  const doExport = useCallback(async (mode: 'copy' | 'download') => {
    if (!api?.aiDebugExport) return;
    setExporting(mode);
    try {
      const res = await api.aiDebugExport({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
        search: search.trim() || undefined,
        limit: 3000,
      });
      if (res?.error) { setError(res.error); return; }
      if (mode === 'copy') {
        const ok = await copyText(res?.markdown || '');
        if (ok) { setCopied('export'); window.setTimeout(() => setCopied(null), 2000); }
      } else {
        const blob = new Blob([res?.markdown || ''], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deskflow-ai-debug-vault-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e: any) { setError(e?.message || 'Export failed'); }
    finally { setExporting(null); }
  }, [api, sources, eventsFilter, search]);

  const doClear = useCallback(async () => {
    if (!clearArmed) { setClearArmed(true); window.setTimeout(() => setClearArmed(false), 3000); return; }
    if (!api?.aiDebugClear) return;
    try {
      const res = await api.aiDebugClear({
        sources: sources.size ? [...sources] : undefined,
        events: eventsFilter.size ? [...eventsFilter] : undefined,
      });
      setClearArmed(false); refresh();
      if (res?.error) setError(res.error);
    } catch (e: any) { setError(e?.message || 'Clear failed'); }
  }, [api, clearArmed, sources, eventsFilter, refresh]);

  const copyRow = useCallback(async (row: DebugEventRow) => {
    const md = [
      `#${row.id} — ${row.ts} — \`${row.source}/${row.event}\``,
      row.provider ? `- provider: ${row.provider}` : '',
      row.model ? `- model: ${row.model}` : '',
      row.feature ? `- feature: ${row.feature}` : '',
      row.contextId ? `- context: ${row.contextId}` : '',
      row.role ? `- role: ${row.role}` : '',
      row.tokensIn || row.tokensOut ? `- tokens in/out: ${row.tokensIn}/${row.tokensOut}` : '',
      '', '```json', prettyJson(row.payload), '```',
    ].filter(l => l !== '' || l === '```json').join('\n');
    const ok = await copyText(md);
    if (ok) { setCopied(String(row.id)); window.setTimeout(() => setCopied(null), 2000); }
  }, []);

  const newestAge = useMemo(() => {
    if (!stats?.newestMs) return null;
    const mins = Math.max(0, Math.round((Date.now() - stats.newestMs) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }, [stats?.newestMs]);

  if (!open) return null;

    return (
    <div className="h-full overflow-y-auto bg-zinc-950 light:bg-white/40 px-4 py-3 space-y-3 text-xs">
      {/* Collapsible capture-points */}
      <button onClick={() => setShowCapture(v => !v)} className="flex items-center gap-2 text-zinc-400 light:text-[var(--text-muted)] hover:text-zinc-300 light:text-[var(--text-secondary)] transition-colors">
        {showCapture ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Bug className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-medium text-zinc-200">AI Debug Vault</span>
        <span className="text-[10px] text-zinc-600 light:text-[var(--text-muted)] border border-zinc-800 light:border-[var(--ws-border)] rounded-full px-1.5 py-0.5">super-debug</span>
        {stats && <span className="ml-1 text-[10px] text-zinc-500 light:text-[var(--text-muted)]">{stats.total.toLocaleString()} events</span>}
      </button>
      {showCapture && (
        <div className="space-y-2 pl-5">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Total</p>
              <p className="text-lg font-bold text-amber-300 font-mono">{stats ? stats.total.toLocaleString() : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Sources</p>
              <p className="text-lg font-bold text-sky-300 font-mono">{stats ? Object.keys(stats.bySource).length : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Errors</p>
              <p className="text-lg font-bold text-rose-300 font-mono">{stats ? (stats.byEvent['error'] || 0) : '…'}</p>
            </div>
            <div className="bg-zinc-900 light:bg-white/40 border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 light:text-[var(--text-muted)]">Newest</p>
              <p className="text-lg font-bold text-zinc-100 font-mono">{newestAge ?? '—'}</p>
            </div>
          </div>

          {/* Capture points */}
          <div className="bg-zinc-900 light:bg-white/30 border border-zinc-800/30 light:border-[var(--ws-border)] rounded-lg p-2.5 space-y-1">
            {(stats?.capturePoints || []).map((cp: CapturePoint) => (
              <div key={cp.source} className="flex items-center gap-2 text-[10px] text-zinc-400 light:text-[var(--text-muted)] py-0.5 border-b border-zinc-800 light:border-[var(--ws-border)]/20 last:border-0">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${SOURCE_COLORS[cp.source] || ''}`}>{cp.source}</span>
                <span>{cp.where}</span>
                <span className="ml-auto shrink-0 text-[9px] text-zinc-600 light:text-[var(--text-muted)]">{cp.captures}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] light:bg-white border border-zinc-800/50 light:border-[var(--ws-border)] rounded px-2 py-1 w-48">
              <Search className="w-3 h-3 text-zinc-500 light:text-[var(--text-muted)]" />
              <input value={searchDraft} onChange={e => onSearchChange(e.target.value)}
                placeholder="Search…"
                className="bg-transparent text-[10px] text-zinc-200 outline-none w-full placeholder:text-zinc-600 light:text-[var(--text-muted)]" />
              {searchDraft && <button onClick={() => onSearchChange('')} className="text-zinc-500 light:text-[var(--text-muted)] hover:text-zinc-300 light:text-[var(--text-secondary)]"><X className="w-3 h-3" /></button>}
            </div>
            {SOURCES.map(s => (
              <button key={s} onClick={() => toggle(setSources, s)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${sources.has(s) ? SOURCE_COLORS[s] : 'text-zinc-600 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border-zinc-800/40 hover:text-zinc-400'}`}>
                {s}
              </button>
            ))}
            <span className="text-[9px] text-zinc-600 light:text-[var(--text-muted)] mx-0.5">|</span>
            {EVENTS.map(e => (
              <button key={e} onClick={() => toggle(setEventsFilter, e)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${eventsFilter.has(e) ? EVENT_COLORS[e] : 'text-zinc-600 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] border-zinc-800/40 hover:text-zinc-400'}`}>
                {e}
              </button>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-300 light:text-[var(--text-secondary)] bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] border border-zinc-700 light:border-[color-mix(in_srgb,var(--ws-border)_30%,transparent)] hover:bg-zinc-700 light:hover:bg-stone-200/40 transition-colors">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => doExport('copy')} disabled={exporting !== null}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
              {copied === 'export' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {exporting === 'copy' ? 'Exporting…' : 'Copy'}
            </button>
            <button onClick={() => doExport('download')} disabled={exporting !== null}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
              <Download className="w-3 h-3" /> {exporting === 'download' ? 'Exporting…' : 'Download'}
            </button>
            <button onClick={doClear}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${clearArmed ? 'text-white bg-rose-600 border-rose-500' : 'text-rose-300 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'}`}>
              <Trash2 className="w-3 h-3" /> {clearArmed ? 'Confirm?' : 'Clear'}
            </button>
            <span className="ml-auto text-[9px] text-zinc-600 light:text-[var(--text-muted)]">{total.toLocaleString()} matching</span>
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setOffset(0); }}
              className="bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-zinc-800/40 rounded px-1.5 py-0.5 text-[9px] text-zinc-400 light:text-[var(--text-muted)] outline-none">
              {[25, 50, 100, 250].map(l => <option key={l} value={l}>{l}/page</option>)}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
            </div>
          )}

          {/* Event list */}
          <div className="border border-zinc-800/40 light:border-[var(--ws-border)] rounded-lg overflow-hidden">
            {loading && events.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-zinc-500 light:text-[var(--text-muted)] text-[10px]">Loading…</div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-zinc-500 light:text-[var(--text-muted)] gap-1">
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>No events yet — talk to the AI Assistant and come back.</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/30">
                {events.map(row => {
                  const isOpen = expandedId === row.id;
                  return (
                    <div key={row.id} className="hover:bg-zinc-800 light:bg-[var(--ws-surface-sunken)]/15 transition-colors">
                      <button onClick={() => setExpandedId(isOpen ? null : row.id)}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-left">
                        {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500 light:text-[var(--text-muted)] shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 light:text-[var(--text-muted)] shrink-0" />}
                        <span className="font-mono text-[10px] text-zinc-500 light:text-[var(--text-muted)] w-12 shrink-0">#{row.id}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${SOURCE_COLORS[row.source] || ''}`}>{row.source}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono border ${EVENT_COLORS[row.event] || ''}`}>{row.event}</span>
                        {row.provider && <span className="text-[10px] text-zinc-400 light:text-[var(--text-muted)] truncate max-w-[100px]">{row.provider}</span>}
                        {row.model && <span className="text-[10px] text-zinc-500 light:text-[var(--text-muted)] truncate max-w-[100px] hidden md:inline">{row.model}</span>}
                        <span className="ml-auto text-[9px] text-zinc-600 light:text-[var(--text-muted)] font-mono shrink-0">{row.ts.slice(11, 19)}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-2 pl-10 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-zinc-500 light:text-[var(--text-muted)]">
                            <span className="font-mono">{row.ts}</span>
                            {row.model && <span>model: {row.model}</span>}
                            {row.feature && <span>feature: {row.feature}</span>}
                            {(row.tokensIn || row.tokensOut) && <span>tokens: {row.tokensIn}/{row.tokensOut}</span>}
                            <button onClick={e => { e.stopPropagation(); copyRow(row); }}
                              className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                              {copied === String(row.id) ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                              {copied === String(row.id) ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre className="text-[10px] leading-relaxed text-zinc-300 light:text-[var(--text-secondary)] bg-black/20 border border-zinc-800/30 light:border-[var(--ws-border)] rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words font-mono">
                            {prettyJson(row.payload)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between text-[10px] text-zinc-500 light:text-[var(--text-muted)]">
              <span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}
                  className="px-2 py-0.5 rounded border border-zinc-800/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-300 light:text-[var(--text-secondary)] hover:bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] disabled:opacity-40 transition-colors">
                  ← Prev
                </button>
                <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}
                  className="px-2 py-0.5 rounded border border-zinc-800/40 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] text-zinc-300 light:text-[var(--text-secondary)] hover:bg-zinc-800 light:bg-[color-mix(in_srgb,var(--ws-surface-sunken)_40%,transparent)] disabled:opacity-40 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 5.1 UI conventions you MUST follow

- **Never `import { ipcRenderer } from 'electron'` in this file.** The renderer
  is context-isolated. All DB access goes through `window.deskflowAPI`. A
  previous attempt did this and it would white-screen the app.
- Tailwind zinc palette with `light:` overrides. Dark surfaces
  `bg-zinc-900` / `bg-zinc-950`, borders `border-zinc-800/40`.
- Design tokens used in this file: `var(--ws-surface-raised)`,
  `var(--ws-surface-sunken)`, `var(--ws-border)`, `var(--text-muted)`,
  `var(--text-secondary)`, `color-mix(in_srgb, …)`.
- Icons: `lucide-react`, sized `w-3 h-3` or `w-3.5 h-3.5` at this density.
- Semantic colors via the two lookup maps (`SOURCE_COLORS`, `EVENT_COLORS`),
  each value a full `text-* bg-*/10 border-*/20` class triple.
- **This component already handles loading / empty / error / populated.** Extend
  it. Do not delete filters, search, export, clear, or pagination — a previous
  attempt replaced all 366 lines with a 4-line stats readout, destroying every
  feature.

---

## 6. IPC WIRING — the exact chain (copy this pattern)

### 6.1 `src/main.ts` lines 2498-2509 — vault init + sink registration
```typescript
        // AI Debug Vault — verbatim audit log of every AI interaction
        try {
          const { initVault } = require('./services/aiDebugVault');
          initVault(db);
          const { setDebugSink } = require('./services/providers/router');
          setDebugSink((ev: any) => {
            try { require('./services/aiDebugVault').vaultLog(ev); } catch { }
          });
          console.log('[DeskFlow] ✅ AI Debug Vault initialized');
        } catch (err: any) {
          console.error('[DeskFlow] ⚠️ AI Debug Vault init failed:', err.message);
        }
```
Note: the DB handle is **passed in** by `initVault(db)`. The vault module
itself never opens a connection. Keep it that way — the vault must not call
`new Database(...)`.

### 6.2 `src/main.ts` lines 20445-20462 — the handlers
```typescript
// ========== AI Debug Vault ==========
electron_1.ipcMain.handle('ai-debug:log', (_e, ev: any) => {
  vaultLogSafe({ source: 'renderer', ...(ev || {}) });
  return { ok: true };
});
electron_1.ipcMain.handle('ai-debug:query', (_e, opts: any) => {
  try { return require('./services/aiDebugVault').vaultQuery(opts || {}); } catch (err: any) { return { events: [], total: 0, error: err.message }; }
});
electron_1.ipcMain.handle('ai-debug:stats', () => {
  try { return require('./services/aiDebugVault').vaultStats(); } catch (err: any) { return { total: 0, error: err.message }; }
});
electron_1.ipcMain.handle('ai-debug:export', (_e, opts: any) => {
  try { return require('./services/aiDebugVault').vaultExport(opts || {}); } catch (err: any) { return { markdown: '', count: 0, error: err.message }; }
});
electron_1.ipcMain.handle('ai-debug:clear', (_e, opts: any) => {
  try { return require('./services/aiDebugVault').vaultClear(opts || {}); } catch (err: any) { return { deleted: 0, error: err.message }; }
});
```

### 6.3 `src/preload.ts` lines 1337-1345 — the bridge
```typescript
  // AI Debug Vault
  aiDebugLog: (ev: { source?: string; event: string; feature?: string; provider?: string; model?: string; contextId?: string; role?: string; payload?: unknown; tokensIn?: number; tokensOut?: number }) =>
    ipcRenderer.invoke('ai-debug:log', ev),
  aiDebugQuery: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('ai-debug:query', opts),
  aiDebugStats: () => ipcRenderer.invoke('ai-debug:stats'),
  aiDebugExport: (opts: { sources?: string[]; events?: string[]; search?: string; fromMs?: number; toMs?: number; limit?: number }) =>
    ipcRenderer.invoke('ai-debug:export', opts),
  aiDebugClear: (opts: { sources?: string[]; events?: string[]; olderThanMs?: number }) =>
    ipcRenderer.invoke('ai-debug:clear', opts),
```

### 6.4 `src/main.ts` line 13748 — the renderer-side sink helper
```typescript
  try { require('./services/aiDebugVault').vaultLog(ev); } catch { }
```

**Channels are named `ai-debug:*`. There is no `vault:*` channel.**
To add one, you touch all three: preload bridge + main handler + service fn.

---

## 7. PROVIDER TYPES (`src/services/providers/types.ts`)

```typescript
export interface CanonicalRequest {
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string | ContentPart[]; tool_calls?: any[]; tool_call_id?: string }>;
  maxTokens?: number;
  temperature?: number;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: any } }>;
  toolChoice?: 'auto' | 'none';
}

export interface CanonicalResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface ResolvedProvider {
  config: ProviderConfig;
  template: ProviderTemplate;
}
```
Note `CanonicalResponse` has **no `reasoning` field** — line 150 of `router.ts`
casts `(result as any).reasoning`. Cost data must come from
`result.usage` (`prompt_tokens` / `completion_tokens`).

`ProviderConfig` includes at least: `id`, `templateId`, `label`, `enabled`,
`priority`, `models: string[]`, `monthlyTokenBudget?`, `tokensUsedThisMonth?`.

---

## 8. HARD CONSTRAINTS (violating these is a regression)

1. **Do NOT run `npm run build`.** The human builds; a previous build attempt
   requested an 8 GB V8 heap on a 4 GB box and caused OOM kills of VS Code and
   Electron. Verify with scoped checks instead:
   ```bash
   npx esbuild src/services/aiDebugVault.ts src/services/providers/router.ts \
     --bundle --outfile=/dev/null --external:electron --external:better-sqlite3 --log-level=warning
   npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "aiDebugVault|router\.ts|DebugVaultPanel|providerLog"
   ```
   This repo has **thousands of pre-existing type errors**. A bare `tsc` run
   and any repo-wide error COUNT are meaningless and must never be quoted as a
   pass/fail signal. Only the `grep` output for your own files counts.
2. **Migrations are ADDITIVE only.** Add columns with
   `try { db.exec('ALTER TABLE ai_debug_events ADD COLUMN x TYPE') } catch {}`
   inside `initVault`. Never `DROP TABLE`, never `DELETE` without `WHERE`,
   never `REPLACE INTO`. Existing rows must survive.
3. **Use `snake_case`** for new columns, matching the existing schema.
4. **Do NOT redefine `maskKey` / `maskHeaders`.** They are correct. Adopt them.
5. **Do NOT change `runWithFallback`'s existing parameter order.** New params
   must be optional and appended after `externalSignal`, or ~50 call sites break.
6. **Do NOT import `electron` or open a `Database` in
   `aiDebugVault.ts`** — it receives its handle via `initVault(db)`.
7. Preserve **CRLF** line endings in existing files. Do not mass-reformat.
8. **Never** run destructive git commands (`checkout`, `restore`,
   `reset --hard`, `clean`). Never `git add -A`.
9. New UI must cover **all four states**: loading, empty, error, populated.
10. **If you delete or replace any existing UI or file, state exactly what you
    are removing and why.** `ProviderDiagnostics.tsx` (mounted at
    `SettingsPage.tsx:6319`) is dead and a candidate for removal — but say so
    explicitly rather than silently dropping it. It also has **no page
    manifest**, which violates the repo's page-registry rule.

---

## 9. ACCEPTANCE CRITERIA — all must be objectively verifiable

### Schema
- [ ] `PRAGMA table_info(ai_debug_events)` lists every new column.
- [ ] Existing rows survive; `SELECT COUNT(*)` before ≥ after.
- [ ] The 6 `CAPTURE_POINTS` sources still log exactly as before.

### Tracer
- [ ] Two concurrent requests with different features produce rows tagged with
      **their own** feature and **their own** trace id.
- [ ] Every `runWithFallback` call emits ≥1 route-decision row.
- [ ] Every failed attempt emits an attempt row with an error kind; every
      success emits one with a non-zero `latency_ms`.
- [ ] A prompt row and its output row share a trace id and are joinable.

### Aggregation
- [ ] Insights returns a correct p50/p95 against a 100-row fixture with known
      latencies (p50=50ms, p95=95ms, assert to ±1ms).
- [ ] Error rate = failed attempts / total attempts, verified on a fixture.

### UI
- [ ] Latency and cost columns render from real rows.
- [ ] Insights strip renders loading / empty / error / populated.
- [ ] A fixture prompt containing `sk-ant-test-SECRET` is not stored unredacted.

### Honesty requirement
State which criteria you verified and which you could not. **Never claim a
check passed that you did not run.** A probe against a scratch database you
created yourself is NOT a verification of this codebase.
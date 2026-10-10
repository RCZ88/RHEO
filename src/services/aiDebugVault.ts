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
  // ---- Added by AI-observability work (Phases 1-2) ----
  traceId?: string;      // joins route-decision + attempt + prompt + output for ONE request
  latencyMs?: number;    // wall-clock duration of a single provider attempt
  costUsd?: number | null; // null when the model is unpriced — NEVER coerce to 0
  httpStatus?: number | null; // null when the transport surfaced no status (success path)
  errorKind?: 'timeout' | 'failure' | 'budget' | null;
  attemptIndex?: number; // 0-based position in the failover chain
  parseOk?: boolean;     // did the response parse into the shape the caller expected
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

// Payloads contain verbatim user prompts, which can carry credentials the user
// pasted in. Redact known key shapes BEFORE serialising. This fails toward
// over-masking on purpose: a prompt that merely LOOKS like it contains a key
// loses those characters, which is recoverable. A leaked key in a plaintext
// SQLite file is not.
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bAIza[A-Za-z0-9_-]{20,}/g,
  /\bghp_[A-Za-z0-9]{20,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/gi,
  /"(api[_-]?key|authorization|x-api-key|access[_-]?token|secret)"\s*:\s*"[^"]{8,}"/gi,
];

function redact(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (m) => {
      // Keep JSON headers redacted but obviously shaped, so the row is still debuggable.
      if (m.startsWith('"')) return m.replace(/:\s*"[^"]{8,}"$/, ': "***REDACTED***"');
      if (/^Bearer/i.test(m)) return 'Bearer ***REDACTED***';
      return '***REDACTED***';
    });
  }
  return out;
}

function ser(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  try {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    const s = redact(raw);
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
    traceId: r.trace_id || undefined,
    latencyMs: r.latency_ms ?? undefined,
    costUsd: r.cost_usd ?? null,
    httpStatus: r.http_status ?? null,
    errorKind: r.error_kind || undefined,
    attemptIndex: r.attempt_index ?? undefined,
    parseOk: r.parse_ok == null ? undefined : !!r.parse_ok,
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
    // ---- Additive migrations (AI observability, Phase 1).
    // The CREATE TABLE above is IF NOT EXISTS, so on an EXISTING database these
    // columns do not exist and every read of them would throw. ALTERs must be
    // idempotent and individually guarded so one failure cannot abort the rest.
    // NEVER DROP or REPLACE here — this table holds the only record of what the
    // AI actually said.
    for (const col of [
      'trace_id TEXT',
      'latency_ms REAL',
      'cost_usd REAL',
      'http_status INTEGER',
      'error_kind TEXT',
      'attempt_index INTEGER',
      'parse_ok INTEGER',
    ]) {
      try { db.exec(`ALTER TABLE ai_debug_events ADD COLUMN ${col}`); } catch { /* already present */ }
    }
    // ---- Full-text search mirror.
    // Measured on the 25k-row retention cap: a leading-wildcard LIKE across
    // payload+feature+provider+model took ~980ms-2.4s because SQLite cannot
    // index a '%term%' pattern and had to scan every row, dragging 2KB payloads
    // with it. The trigram tokenizer supports the same SUBSTRING semantics via
    // an index: the same search returns in ~41ms, and ~0.4ms for a selective
    // term. Cost is one extra insert per event (~0.5ms).
    //
    // content=''/'content_rowid' make it an INDEX of ev rather than a copy, so
    // the 300KB payload is not duplicated on disk.
    try {
      db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ai_debug_fts USING fts5(
        payload, feature, provider, model,
        content='ai_debug_events', content_rowid='id', tokenize='trigram'
      )`);
      // Populate only if the mirror is behind, so restarts are cheap.
      const ftsN = (db.prepare('SELECT COUNT(*) c FROM ai_debug_fts').get() as any)?.c || 0;
      const rowN = (db.prepare('SELECT COUNT(*) c FROM ai_debug_events').get() as any)?.c || 0;
      if (ftsN !== rowN) db.exec("INSERT INTO ai_debug_fts(ai_debug_fts) VALUES('rebuild')");
    } catch (err: any) {
      // Search degrades to the slow LIKE path below; never fail init over it.
      console.warn('[DebugVault] FTS unavailable, search will use LIKE:', err?.message);
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_trace ON ai_debug_events(trace_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_latency ON ai_debug_events(latency_ms)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_feature ON ai_debug_events(feature)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_debug_provider ON ai_debug_events(provider)');
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
    db.prepare(`INSERT INTO ai_debug_events (ts, epoch_ms, source, event, feature, provider, model, context_id, role, tokens_in, tokens_out, payload, trace_id, latency_ms, cost_usd, http_status, error_kind, attempt_index, parse_ok)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
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
      ev.traceId ? String(ev.traceId).slice(0, 64) : null,
      typeof ev.latencyMs === 'number' && Number.isFinite(ev.latencyMs) ? ev.latencyMs : null,
      // Preserve the null/unknown distinction: only a real number lands here.
      typeof ev.costUsd === 'number' && Number.isFinite(ev.costUsd) ? ev.costUsd : null,
      typeof ev.httpStatus === 'number' && Number.isFinite(ev.httpStatus) ? ev.httpStatus : null,
      ev.errorKind ? String(ev.errorKind).slice(0, 16) : null,
      typeof ev.attemptIndex === 'number' ? ev.attemptIndex : null,
      typeof ev.parseOk === 'boolean' ? (ev.parseOk ? 1 : 0) : null,
    );
    // Mirror into FTS. Best-effort: a logging failure must never break a call.
    try {
      db.prepare(`INSERT INTO ai_debug_fts(rowid, payload, feature, provider, model) VALUES (?, ?, ?, ?, ?)`)
        .run(
          (db.prepare('SELECT last_insert_rowid() AS id').get() as any).id,
          ser(ev.payload),
          ev.feature ? String(ev.feature).slice(0, 64) : null,
          ev.provider ? String(ev.provider).slice(0, 128) : null,
          ev.model ? String(ev.model).slice(0, 128) : null,
        );
    } catch { /* FTS is an accelerator, never a requirement */ }
  } catch { /* vault is best-effort, never throws */ }
}

/** Escape a user term for an FTS5 MATCH string.
 *  Without this, a stray quote or hyphen is a syntax error and the search
 *  silently returns nothing — the worst failure for a search box. */
function toMatchQuery(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

/** Shared filter compiler. Extracted from vaultQuery so the insights query
 *  can never drift from the list query — if they disagree, the p95 you read is
 *  computed over a different population than the rows you are looking at.
 *
 *  A search term becomes a row-id subquery against the FTS mirror rather than a
 *  4-way OR of leading-wildcard LIKEs, which is what made search take ~2.4s.
 *  If FTS is unavailable the flag is false and we fall back to the LIKE path,
 *  so behaviour degrades in speed only, never in correctness. */
function buildWhere(opts: DebugQueryOpts): { where: string; params: any[]; useFts: boolean } {
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
  let useFts = false;
  const term = opts.search?.trim();
  if (term) {
    let ftsUsable = false;
    try {
      // A bare alphanumeric term is the common case and is always safe; the
      // trigram tokenizer handles the rest. Verify FTS exists before relying on it.
      db?.prepare('SELECT 1 FROM ai_debug_fts LIMIT 1');
      ftsUsable = true;
    } catch { ftsUsable = false; }
    if (ftsUsable) {
      clauses.push(`id IN (SELECT rowid FROM ai_debug_fts WHERE ai_debug_fts MATCH ?)`);
      params.push(toMatchQuery(term));
      useFts = true;
    } else {
      clauses.push(`(payload LIKE ? OR feature LIKE ? OR provider LIKE ? OR model LIKE ?)`);
      const like = `%${term}%`;
      params.push(like, like, like, like);
    }
  }
  if (opts.fromMs != null) { clauses.push('epoch_ms >= ?'); params.push(opts.fromMs); }
  if (opts.toMs != null) { clauses.push('epoch_ms <= ?'); params.push(opts.toMs); }
  return { where: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params, useFts };
}

export function vaultQuery(opts: DebugQueryOpts = {}) {
  if (!db || !ready) return { events: [], total: 0 };
  try {
    const { where, params } = buildWhere(opts);
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

export interface VaultInsightGroup {
  calls: number;
  errors: number;
  errorRate: number;
  p50: number | null;
  p95: number | null;
  totalCostUsd: number;
  pricedCalls: number;
}

export interface VaultInsights {
  calls: number;
  errors: number;
  errorRate: number;
  p50: number | null;
  p95: number | null;
  totalCostUsd: number;
  meanCostUsd: number | null;
  unpricedCalls: number;
  totalTokens: number;
  byProvider: Record<string, VaultInsightGroup>;
  byFeature: Record<string, VaultInsightGroup>;
}

/** Nearest-rank percentile over an ASC-sorted array.
 *  `Math.floor(n*p)` is the off-by-one: for n=100 and values 1..100 it returns
 *  index 50, i.e. 51, not 50. ceil(n*p)-1 is the correct nearest-rank index. */
function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(sortedAsc.length * p) - 1));
  return sortedAsc[idx];
}

interface AttemptRow {
  latency_ms: number | null;
  cost_usd: number | null;
  error_kind: string | null;
  http_status: number | null;
  provider: string | null;
  feature: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
}

function summarise(rows: AttemptRow[]): VaultInsightGroup {
  const lats = rows.map(r => r.latency_ms).filter((n): n is number => n != null).sort((a, b) => a - b);
  const errors = rows.filter(r => r.error_kind != null).length;
  // SUM over rows, but count how many rows actually carried a price. A NULL cost
  // means "unpriced model", and silently treating those as $0 makes total cost
  // under-report while looking authoritative.
  let totalCostUsd = 0;
  let pricedCalls = 0;
  for (const r of rows) {
    if (r.cost_usd != null) { totalCostUsd += r.cost_usd; pricedCalls++; }
  }
  return {
    calls: rows.length,
    errors,
    errorRate: rows.length ? errors / rows.length : 0,
    p50: percentile(lats, 0.5),
    p95: percentile(lats, 0.95),
    totalCostUsd,
    pricedCalls,
  };
}

/**
 * Aggregation over per-attempt rows: latency percentiles, error rate and cost.
 *
 * Population is `event = 'attempt'` — the router emits exactly one attempt row
 * per provider try, so a 3-provider chain that fails twice then succeeds
 * contributes 3 rows (2 errors), not 1. Reading `event = 'output'` instead
 * would report a 100% success rate no matter how broken the failover is.
 */
export function vaultInsights(opts: DebugQueryOpts = {}): VaultInsights | { error: string } {
  const empty: VaultInsights = {
    calls: 0, errors: 0, errorRate: 0, p50: null, p95: null,
    totalCostUsd: 0, meanCostUsd: null, unpricedCalls: 0, totalTokens: 0,
    byProvider: {}, byFeature: {},
  };
  if (!db || !ready) return { error: 'AI Debug Vault not initialised' };
  try {
    const { where, params } = buildWhere(opts);
    const clause = where ? `${where} AND` : 'WHERE';
    const rows = db.prepare(
      `SELECT latency_ms, cost_usd, error_kind, http_status, provider, feature, tokens_in, tokens_out
       FROM ai_debug_events ${clause} event = 'attempt'`
    ).all(...params) as AttemptRow[];

    if (!rows.length) return empty;

    const byProvider: Record<string, VaultInsightGroup> = {};
    const byFeature: Record<string, VaultInsightGroup> = {};
    const providerRows: Record<string, AttemptRow[]> = {};
    const featureRows: Record<string, AttemptRow[]> = {};
    for (const r of rows) {
      const pk = r.provider || '(none)';
      const fk = r.feature || '(none)';
      (providerRows[pk] ||= []).push(r);
      (featureRows[fk] ||= []).push(r);
    }
    for (const [k, v] of Object.entries(providerRows)) byProvider[k] = summarise(v);
    for (const [k, v] of Object.entries(featureRows)) byFeature[k] = summarise(v);

    const all = summarise(rows);
    let totalTokens = 0;
    for (const r of rows) totalTokens += (r.tokens_in || 0) + (r.tokens_out || 0);

    return {
      calls: all.calls,
      errors: all.errors,
      errorRate: all.errorRate,
      p50: all.p50,
      p95: all.p95,
      totalCostUsd: all.totalCostUsd,
      meanCostUsd: all.pricedCalls ? all.totalCostUsd / all.pricedCalls : null,
      unpricedCalls: all.calls - all.pricedCalls,
      totalTokens,
      byProvider,
      byFeature,
    };
  } catch (err: any) {
    return { error: err?.message };
  }
}

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
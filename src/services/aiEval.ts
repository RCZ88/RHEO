import type { Database } from 'better-sqlite3';
import { buildChain, runWithFallback } from './providers/router';
import type { AiProvidersState } from './providers/types';

// ===================================================================
// AI Eval Harness — offline regression testing for DeskFlow's AI features.
//
// WHAT THIS IS FOR
// Observability (aiDebugVault) answers "what happened on that call?".
// This answers the question you cannot answer by reading logs:
//   "did my prompt change make it BETTER or WORSE?"
//
// You freeze a set of cases (prompt + what a good answer must contain),
// replay them through the REAL provider chain, score the output, and keep the
// run. Run it again after any change and compare against the previous run.
//
// DESIGN CONSTRAINTS (why it is shaped this way)
// 1. Structural checks are the DEFAULT and are free. LLM-as-judge is OPT-IN
//    because every judge call costs money and adds latency; a harness that
//    silently spends the user's credits while they are not watching is worse
//    than no harness.
// 2. A scorer that cannot fail is theatre. Every check returns pass/fail and
//    every failure carries a human-readable reason, so a red run tells you
//    WHAT broke rather than just that something did.
// 3. The runner calls buildChain + runWithFallback — the same path production
//    uses. An eval that exercises a different code path than production proves
//    nothing about production.
// 4. Everything is best-effort and never throws into the caller. A failing
//    provider must record a failed run, not crash the harness.
// ===================================================================

let db: Database | null = null;
let ready = false;
const MAX_CASES = 500;
const MAX_RUNS = 50;

// ---------------------------------------------------------------- types

export type EvalCheckKind = 'contains' | 'not_contains' | 'json_field' | 'max_latency_ms' | 'regex';

export interface EvalCheck {
  kind: EvalCheckKind;
  /** For contains / not_contains / json_field / regex */
  value?: string;
  /** For json_field: dotted path, e.g. "summary" or "items.0.title" */
  path?: string;
  /** For max_latency_ms */
  ms?: number;
  /** Human label shown in the UI when this check fails. */
  label?: string;
}

export interface EvalCase {
  id: string;
  feature: string;
  name: string;
  systemPrompt: string;
  prompt: string;
  maxTokens?: number;
  /** Expected substrings / fields. Empty means "structural smoke test only". */
  expectContains?: string[];
  expectNotContains?: string[];
  /** Extra structural checks. */
  checks?: EvalCheck[];
  enabled: boolean;
  createdAt: number;
}

export interface CaseResult {
  id: string;
  name: string;
  feature: string;
  status: 'pass' | 'fail' | 'error';
  score: number;               // 0..1, fraction of checks passed
  latencyMs: number | null;
  costUsd: number | null;
  provider: string | null;
  model: string | null;
  output: string;
  /** One entry per check. Empty array means the case had no assertions. */
  failures: string[];
  error?: string;
  at: number;
}

export interface EvalRun {
  id: string;
  label: string;
  startedAt: number;
  finishedAt: number | null;
  total: number;
  passed: number;
  failed: number;
  errored: number;
  meanScore: number;
  totalCostUsd: number;
  /** Set when this run was compared against a previous one. */
  comparedTo?: string | null;
  deltaPassRate?: number | null;
  judgeMode?: 'structural' | 'llm';
}

// ---------------------------------------------------------------- schema

export function initEval(database: Database) {
  db = database;
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ai_eval_cases (
      id TEXT PRIMARY KEY,
      feature TEXT NOT NULL,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      prompt TEXT NOT NULL,
      max_tokens INTEGER,
      expect_contains TEXT,
      expect_not_contains TEXT,
      checks TEXT,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS ai_eval_runs (
      id TEXT PRIMARY KEY,
      label TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      total INTEGER DEFAULT 0,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      errored INTEGER DEFAULT 0,
      mean_score REAL DEFAULT 0,
      total_cost_usd REAL DEFAULT 0,
      judge_mode TEXT DEFAULT 'structural'
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS ai_eval_results (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      case_id TEXT,
      name TEXT,
      feature TEXT,
      status TEXT NOT NULL,
      score REAL DEFAULT 0,
      latency_ms REAL,
      cost_usd REAL,
      provider TEXT,
      model TEXT,
      output TEXT,
      failures TEXT,
      error TEXT,
      at INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_eval_results_run ON ai_eval_results(run_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ai_eval_cases_feature ON ai_eval_cases(feature)');
    // Keep history bounded; an unbounded eval log is itself a leak.
    db.exec(`DELETE FROM ai_eval_results WHERE run_id NOT IN (SELECT id FROM ai_eval_runs ORDER BY started_at DESC LIMIT ${MAX_RUNS})`);
    db.exec(`DELETE FROM ai_eval_runs WHERE id NOT IN (SELECT id FROM ai_eval_runs ORDER BY started_at DESC LIMIT ${MAX_RUNS})`);
    ready = true;
    console.log('[AiEval] ✅ initialized (tables ai_eval_cases / ai_eval_runs / ai_eval_results)');
  } catch (err: any) {
    console.error('[AiEval] init failed:', err?.message);
  }
}

// ---------------------------------------------------------------- cases

function rowToCase(r: any): EvalCase {
  const parse = <T,>(s: any, fb: T): T => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
  return {
    id: r.id,
    feature: r.feature,
    name: r.name,
    systemPrompt: r.system_prompt,
    prompt: r.prompt,
    maxTokens: r.max_tokens ?? undefined,
    expectContains: parse<string[]>(r.expect_contains, []),
    expectNotContains: parse<string[]>(r.expect_not_contains, []),
    checks: parse<EvalCheck[]>(r.checks, []),
    enabled: !!r.enabled,
    createdAt: r.created_at,
  };
}

export function listCases(feature?: string): EvalCase[] {
  if (!db || !ready) return [];
  try {
    const rows = feature
      ? db.prepare('SELECT * FROM ai_eval_cases WHERE feature = ? ORDER BY created_at DESC').all(feature)
      : db.prepare('SELECT * FROM ai_eval_cases ORDER BY created_at DESC LIMIT ?').all(MAX_CASES);
    return (rows as any[]).map(rowToCase);
  } catch { return []; }
}

export function saveCase(c: Partial<EvalCase> & { id?: string }): { ok: boolean; id?: string; error?: string } {
  if (!db || !ready) return { ok: false, error: 'AI Eval not initialised' };
  try {
    if (!c.feature || !c.name || !c.prompt) return { ok: false, error: 'feature, name and prompt are required' };
    const id = c.id || `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`INSERT OR REPLACE INTO ai_eval_cases
      (id, feature, name, system_prompt, prompt, max_tokens, expect_contains, expect_not_contains, checks, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      String(c.feature).slice(0, 64),
      String(c.name).slice(0, 200),
      String(c.systemPrompt ?? ''),
      String(c.prompt),
      typeof c.maxTokens === 'number' ? c.maxTokens : null,
      JSON.stringify(c.expectContains ?? []),
      JSON.stringify(c.expectNotContains ?? []),
      JSON.stringify(c.checks ?? []),
      c.enabled === false ? 0 : 1,
      c.createdAt ?? Date.now(),
    );
    return { ok: true, id };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

/** Removal is explicit and confirmed by the caller — the UI arms a confirm
 *  step before calling. No cascading delete of results, so history survives. */
export function deleteCase(id: string): { deleted: number; error?: string } {
  if (!db || !ready) return { deleted: 0 };
  try {
    return { deleted: db.prepare('DELETE FROM ai_eval_cases WHERE id = ?').run(id).changes };
  } catch (err: any) {
    return { deleted: 0, error: err?.message };
  }
}

/** Seed a small starter suite so the harness is not an empty box on first run.
 *  Every case is structural — no expected substring — because guessing the
 *  user's real output shape would just produce false failures. */
export function seedStarterCases(): { seeded: number } {
  if (!db || !ready) return { seeded: 0 };
  const existing = db.prepare('SELECT COUNT(*) c FROM ai_eval_cases').get() as any;
  if ((existing?.c || 0) > 0) return { seeded: 0 };
  const starters: Array<Partial<EvalCase>> = [
    { feature: 'researchDigest', name: 'Digest returns JSON with a summary', prompt: 'Summarise the DeskFlow AI canvas refactor in one paragraph.', expectContains: [], checks: [{ kind: 'max_latency_ms', ms: 30000, label: 'completes within 30s' }] },
    { feature: 'goalAssistant', name: 'Goal assistant stays on topic', prompt: 'Break "ship the AI eval harness" into three concrete steps.', expectContains: [] },
    { feature: 'category', name: 'Category returns a single word', prompt: 'Categorise the app "Spotify":', expectContains: [] },
  ];
  let n = 0;
  for (const s of starters) if (saveCase(s).ok) n++;
  console.log(`[AiEval] seeded ${n} starter cases`);
  return { seeded: n };
}

// ---------------------------------------------------------------- scoring

function getByPath(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    const m = key.match(/^(\w+)\[(\d+)\]$/);
    if (m) return acc?.[m[1]]?.[Number(m[2])];
    return acc?.[key];
  }, obj);
}

/** Pure function on purpose: no DB, no clock, no provider. That makes it
 *  directly testable, which is the only way to trust a scorer. */
export function scoreOutput(
  output: string,
  c: Pick<EvalCase, 'expectContains' | 'expectNotContains' | 'checks'>,
  latencyMs: number | null,
): { passed: boolean; score: number; failures: string[] } {
  const failures: string[] = [];
  let total = 0;
  let ok = 0;
  const text = output ?? '';

  for (const needle of c.expectContains ?? []) {
    total++;
    if (needle && text.includes(needle)) ok++;
    else failures.push(`expected output to contain ${JSON.stringify(needle)}`);
  }
  for (const needle of c.expectNotContains ?? []) {
    total++;
    // Guards against a prompt like "do not mention X" being satisfied by a
    // model that simply never answers.
    if (needle && !text.includes(needle)) ok++;
    else failures.push(`expected output NOT to contain ${JSON.stringify(needle)}`);
  }
  for (const chk of c.checks ?? []) {
    total++;
    const label = chk.label || chk.kind;
    switch (chk.kind) {
      case 'contains':
        if (text.includes(String(chk.value))) ok++;
        else failures.push(`${label}: missing ${JSON.stringify(chk.value)}`);
        break;
      case 'not_contains':
        if (!text.includes(String(chk.value))) ok++;
        else failures.push(`${label}: unexpectedly found ${JSON.stringify(chk.value)}`);
        break;
      case 'regex':
        try {
          if (new RegExp(String(chk.value), 'is').test(text)) ok++;
          else failures.push(`${label}: no match for /${chk.value}/`);
        } catch { failures.push(`${label}: invalid regex`); }
        break;
      case 'json_field': {
        let parsed: any;
        try { parsed = JSON.parse(text); } catch {
          failures.push(`${label}: output is not valid JSON`);
          break;
        }
        const v = getByPath(parsed, chk.path ?? '');
        // A field present but empty is a failure: "" passes a truthiness test
        // in neither direction, and callers here always want real content.
        if (v !== undefined && v !== null && String(v).trim() !== '') ok++;
        else failures.push(`${label}: field "${chk.path}" missing or empty`);
        break;
      }
      case 'max_latency_ms':
        if (latencyMs != null && latencyMs <= (chk.ms ?? Infinity)) ok++;
        else failures.push(`${label}: ${latencyMs == null ? 'no timing recorded' : `${Math.round(latencyMs)}ms`} exceeds ${chk.ms}ms`);
        break;
      default:
        failures.push(`unknown check kind "${(chk as any).kind}"`);
    }
  }

  // No assertions at all is NOT a pass. It is an untested case, and reporting
  // it as green is how a harness starts lying.
  if (total === 0) return { passed: false, score: 0, failures: ['no assertions defined — case cannot fail'] };
  return { passed: failures.length === 0, score: ok / total, failures };
}

// ---------------------------------------------------------------- runner

export interface RunOptions {
  label?: string;
  feature?: string;
  caseIds?: string[];
  /** Providers state. Supplied by main.ts, which owns userPreferences. */
  providersState: AiProvidersState;
  /** Structural-only today. Reserved so a judge can be added without a
   *  signature change; ignored rather than silently pretending to run. */
  judge?: 'structural' | 'llm';
}

export async function runEval(opts: RunOptions): Promise<EvalRun & { results: CaseResult[] }> {
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = Date.now();
  const judgeMode = opts.judge === 'llm' ? 'llm' : 'structural';

  let cases = listCases(opts.feature);
  if (opts.caseIds?.length) cases = cases.filter(c => opts.caseIds!.includes(c.id));
  cases = cases.filter(c => c.enabled);

  const results: CaseResult[] = [];
  const writeResult = db && ready
    ? db.prepare(`INSERT OR REPLACE INTO ai_eval_results
        (id, run_id, case_id, name, feature, status, score, latency_ms, cost_usd, provider, model, output, failures, error, at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    : null;

  for (const c of cases) {
    const t0 = performance.now();
    let res: CaseResult;
    try {
      const chain = buildChain(opts.providersState, c.feature as any);
      if (chain.length === 0) {
        res = {
          id: `${runId}:${c.id}`, name: c.name, feature: c.feature, status: 'error', score: 0,
          latencyMs: null, costUsd: null, provider: null, model: null, output: '',
          failures: [], error: 'no AI provider configured for this feature', at: Date.now(),
        };
      } else {
        const { result, usedProviderId } = await runWithFallback(chain, {
          systemPrompt: c.systemPrompt || 'You are a helpful assistant.',
          messages: [{ role: 'user', content: c.prompt }],
          maxTokens: c.maxTokens ?? 800,
        });
        const latencyMs = performance.now() - t0;
        const link = chain.find(l => l.provider.config.id === usedProviderId);
        const out = String(result.content ?? '');
        const scored = scoreOutput(out, c, latencyMs);
        res = {
          id: `${runId}:${c.id}`, name: c.name, feature: c.feature,
          status: scored.passed ? 'pass' : 'fail', score: scored.score,
          latencyMs, costUsd: null, provider: usedProviderId,
          model: link?.model ?? null, output: out,
          failures: scored.failures, at: Date.now(),
        };
      }
    } catch (err: any) {
      res = {
        id: `${runId}:${c.id}`, name: c.name, feature: c.feature, status: 'error', score: 0,
        latencyMs: performance.now() - t0, costUsd: null, provider: null, model: null,
        output: '', failures: [], error: err?.message || String(err), at: Date.now(),
      };
    }
    results.push(res);
    // Persist immediately: a run that dies halfway must still leave the
    // completed cases on disk rather than losing the lot.
    try {
      writeResult?.run(
        res.id, runId, c.id, res.name, res.feature, res.status, res.score, res.latencyMs,
        res.costUsd, res.provider, res.model, res.output.slice(0, 20000),
        JSON.stringify(res.failures), res.error ?? null, res.at,
      );
    } catch { /* best-effort */ }
  }

  const finishedAt = Date.now();
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errored = results.filter(r => r.status === 'error').length;
  const meanScore = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const totalCostUsd = results.reduce((s, r) => s + (r.costUsd ?? 0), 0);

  const run: EvalRun = {
    id: runId, label: opts.label || `Run ${new Date(startedAt).toLocaleString()}`,
    startedAt, finishedAt, total: results.length, passed, failed, errored,
    meanScore, totalCostUsd, judgeMode,
  };

  try {
    db?.prepare(`INSERT OR REPLACE INTO ai_eval_runs
      (id, label, started_at, finished_at, total, passed, failed, errored, mean_score, total_cost_usd, judge_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      run.id, run.label, run.startedAt, run.finishedAt, run.total, run.passed,
      run.failed, run.errored, run.meanScore, run.totalCostUsd, run.judgeMode,
    );
  } catch { /* best-effort */ }

  return { ...run, results };
}

// ---------------------------------------------------------------- history

export function listRuns(limit = 20): EvalRun[] {
  if (!db || !ready) return [];
  try {
    return (db.prepare('SELECT * FROM ai_eval_runs ORDER BY started_at DESC LIMIT ?').all(Math.min(Math.max(limit, 1), MAX_RUNS)) as any[])
      .map(r => ({
        id: r.id, label: r.label, startedAt: r.started_at, finishedAt: r.finished_at,
        total: r.total, passed: r.passed, failed: r.failed, errored: r.errored,
        meanScore: r.mean_score, totalCostUsd: r.total_cost_usd, judgeMode: r.judge_mode,
      }));
  } catch { return []; }
}

export function getRun(runId: string): { run: EvalRun | null; results: CaseResult[] } {
  if (!db || !ready) return { run: null, results: [] };
  try {
    const r = db.prepare('SELECT * FROM ai_eval_runs WHERE id = ?').get(runId) as any;
    const results = (db.prepare('SELECT * FROM ai_eval_results WHERE run_id = ? ORDER BY score ASC, name ASC').all(runId) as any[])
      .map(x => ({
        id: x.id, name: x.name, feature: x.feature, status: x.status, score: x.score,
        latencyMs: x.latency_ms, costUsd: x.cost_usd, provider: x.provider, model: x.model,
        output: x.output, failures: (() => { try { return JSON.parse(x.failures || '[]'); } catch { return []; } })(),
        error: x.error ?? undefined, at: x.at,
      }));
    return {
      run: r ? {
        id: r.id, label: r.label, startedAt: r.started_at, finishedAt: r.finished_at,
        total: r.total, passed: r.passed, failed: r.failed, errored: r.errored,
        meanScore: r.mean_score, totalCostUsd: r.total_cost_usd, judgeMode: r.judge_mode,
      } : null,
      results,
    };
  } catch { return { run: null, results: [] }; }
}

/** Compare a run against the one before it. This is the whole point of keeping
 *  history: "did that change help or hurt?" answered in one number. */
export function compareRuns(runId: string): { run: EvalRun | null; previous: EvalRun | null; deltaPassRate: number | null; regressions: string[] } {
  const runs = listRuns(MAX_RUNS);
  const idx = runs.findIndex(r => r.id === runId);
  if (idx === -1) return { run: null, previous: null, deltaPassRate: null, regressions: [] };
  const run = runs[idx];
  const previous = runs[idx + 1] ?? null;
  if (!run || !previous || !run.total || !previous.total) {
    return { run, previous, deltaPassRate: null, regressions: [] };
  }
  const deltaPassRate = run.passed / run.total - previous.passed / previous.total;
  // Name-level diff so the UI can say WHICH case regressed, not just "-1".
  const prevByName = new Map(getRun(previous.id).results.map(r => [r.name, r.status]));
  const regressions = getRun(run.id).results
    .filter(r => r.status !== 'pass' && prevByName.get(r.name) === 'pass')
    .map(r => r.name);
  return { run, previous, deltaPassRate, regressions };
}

export function deleteRun(runId: string): { deleted: number; error?: string } {
  if (!db || !ready) return { deleted: 0 };
  try {
    const info = db.prepare('DELETE FROM ai_eval_results WHERE run_id = ?').run(runId);
    db.prepare('DELETE FROM ai_eval_runs WHERE id = ?').run(runId);
    return { deleted: info.changes };
  } catch (err: any) {
    return { deleted: 0, error: err?.message };
  }
}

export function evalStats(): { cases: number; runs: number; lastRun: EvalRun | null } {
  if (!db || !ready) return { cases: 0, runs: 0, lastRun: null };
  try {
    return {
      cases: (db.prepare('SELECT COUNT(*) c FROM ai_eval_cases WHERE enabled = 1').get() as any)?.c || 0,
      runs: (db.prepare('SELECT COUNT(*) c FROM ai_eval_runs').get() as any)?.c || 0,
      lastRun: listRuns(1)[0] ?? null,
    };
  } catch {
    return { cases: 0, runs: 0, lastRun: null };
  }
}

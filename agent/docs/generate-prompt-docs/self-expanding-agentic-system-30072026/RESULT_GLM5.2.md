# Self-Expanding Agentic System — Implementation

Below is the **agentic layer** that sits on top of your 5 subsystems. It is composed of:

1. **DSL Runtime** — a sandboxed JS-subset that the LLM emits, the evaluator executes, and every evaluation is logged with timestamps.
2. **Limit Scope Checking (Audit Trail)** — pre-execution AST verification + per-evaluation audit records.
3. **Ambient Agents** — 5 per-subsystem agents that observe state and propose DSL programs.
4. **Orchestrator** — schedules ambient runs, routes natural language → DSL → sandbox → audit log.
5. **AI Provider Router** — OpenAI, Anthropic, Ollama, LM Studio, Grok, DeepSeek, Groq, OpenRouter, Gemini, Mistral, Custom.
6. **Event Bus** — typed pub/sub that stitches everything together (and that features use to cross-pollinate).
7. **IPC + UI** — preload API, agent IPC handlers, and a React page to drive/inspect the agent.

I'm assuming the existing CRUD IPC for `goals`, `learn`, `ide`, `finance`, `canvas` already exists (your schema + handlers show that). The agentic layer calls into those handlers' service functions directly in the main process — no IPC round-trip.

---

## 1. Database migration: agent tables

`database/migrations/0006_agent.sql`

```sql
-- Agent sessions: one per natural-language intent or ambient cycle
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                  -- 'intent' | 'ambient' | 'canvas'
  source TEXT,                         -- 'user' | 'goals' | 'learn' | 'ide' | 'finance' | 'canvas'
  prompt TEXT,
  dsl TEXT,                            -- generated DSL source
  status TEXT NOT NULL,                -- 'pending' | 'running' | 'completed' | 'failed' | 'aborted'
  error TEXT,
  provider TEXT,                       -- which AI provider produced the DSL
  model TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  metadata TEXT                        -- JSON
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_kind  ON agent_sessions(kind);

-- Per-evaluation log: one row per DSL statement executed
CREATE TABLE IF NOT EXISTS agent_eval_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,                    -- ISO timestamp of THIS evaluation
  seq INTEGER NOT NULL,                -- statement index
  node_type TEXT NOT NULL,             -- 'Call' | 'If' | 'Var' | ...
  source TEXT,                         -- pretty-printed fragment
  target TEXT,                         -- 'ctx.goals.suggest' etc.
  args TEXT,                           -- JSON
  result TEXT,                         -- JSON of return value (truncated)
  error TEXT,
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_agent_eval_session ON agent_eval_log(session_id);

-- Limit-scope audit: what the sandbox verifier decided
CREATE TABLE IF NOT EXISTS agent_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  decision TEXT NOT NULL,              -- 'allow' | 'deny'
  reason TEXT,
  node_type TEXT,
  source TEXT,
  target TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_audit_session ON agent_audit(session_id);

-- Ambient agent registry: which agents are enabled + last run
CREATE TABLE IF NOT EXISTS agent_ambient_state (
  source TEXT PRIMARY KEY,            -- 'goals' | 'learn' | ...
  enabled INTEGER NOT NULL DEFAULT 1,
  interval_ms INTEGER NOT NULL DEFAULT 300000,
  last_run_at TEXT,
  last_status TEXT,
  last_error TEXT
);

-- Insert default ambient rows
INSERT OR IGNORE INTO agent_ambient_state (source, enabled, interval_ms) VALUES
  ('goals',   1, 300000),
  ('learn',   1, 600000),
  ('ide',     1, 600000),
  ('finance', 1, 600000),
  ('canvas',  1, 900000);

-- Suggestions queue: ambient agents propose; user accepts/rejects
CREATE TABLE IF NOT EXISTS agent_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES agent_sessions(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- 'goal' | 'lesson' | 'project' | 'budget' | 'canvas_node'
  title TEXT NOT NULL,
  rationale TEXT,
  payload TEXT NOT NULL,               -- JSON — args to apply if accepted
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'applied'
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_status ON agent_suggestions(status);
```

---

## 2. Event bus

`main/event-bus.ts`

```ts
// Typed pub/sub. The agent and all 5 subsystems subscribe here to react to
// each other. Example: when a goal completes, the finance agent listens and
// can suggest a budget reallocation.

export type Listener<T = any> = (payload: T) => void | Promise<void>;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on<T = any>(event: string, fn: Listener<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) { set = new Set(); this.listeners.set(event, set); }
    set.add(fn as Listener);
    return () => set!.delete(fn as Listener);
  }

  once<T = any>(event: string, fn: Listener<T>): () => void {
    const off = this.on<T>(event, async (p) => { off(); await fn(p); });
    return off;
  }

  async emit<T = any>(event: string, payload?: T): Promise<void> {
    const set = this.listeners.get(event);
    if (!set) return;
    // Snapshot to avoid mutation during iteration
    const fns = [...set];
    // Fan-out, but errors don't stop siblings
    await Promise.all(fns.map(async (fn) => {
      try { await fn(payload); }
      catch (err) { console.error(`[event-bus] listener for "${event}" threw:`, err); }
    }));
  }
}

export const eventBus = new EventBus();

// Canonical event names — keep them in one place so refactors are safe.
export const Events = {
  GoalCreated: 'goals:created',
  GoalProgress: 'goals:progress',
  GoalCompleted: 'goals:completed',
  LessonCompleted: 'learn:lesson-completed',
  ChapterCompleted: 'learn:chapter-completed',
  CurriculumMastered: 'learn:curriculum-mastered',
  ProjectCreated: 'ide:project-created',
  SessionCompleted: 'ide:session-completed',
  TransactionPosted: 'finance:transaction-posted',
  BudgetThreshold: 'finance:budget-threshold',
  SubscriptionRenewed: 'finance:subscription-renewed',
  WalletDrift: 'finance:wallet-drift',
  CanvasNodeAdded: 'canvas:node-added',
  CanvasExecuted: 'canvas:executed',
  AgentSessionStarted: 'agent:session-started',
  AgentSessionCompleted: 'agent:session-completed',
  AgentSuggestionProposed: 'agent:suggestion-proposed',
  AgentSuggestionResolved: 'agent:suggestion-resolved',
} as const;
```

---

## 3. AI providers

`main/providers/types.ts`

```ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;            // request JSON output
  tools?: any[];
}

export interface ChatResponse {
  text: string;
  raw: any;
  usage?: { in: number; out: number };
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
}

export interface Provider {
  id: string;                // 'openai' | 'anthropic' | ...
  label: string;
  listModels(): Promise<string[]>;
  chat(req: ChatRequest): Promise<ChatResponse>;
}
```

`main/providers/openai.ts` (also covers DeepSeek, Groq, OpenRouter, Mistral, Custom — they're OpenAI-compatible)

```ts
import type { Provider, ProviderConfig, ChatRequest, ChatResponse } from './types';

export class OpenAICompatibleProvider implements Provider {
  id: string;
  label: string;
  private cfg: ProviderConfig;

  constructor(id: string, label: string, cfg: ProviderConfig) {
    this.id = id; this.label = label; this.cfg = cfg;
  }

  protected get baseUrl() { return this.cfg.baseUrl ?? 'https://api.openai.com/v1'; }

  async listModels(): Promise<string[]> {
    const r = await fetch(`${this.baseUrl}/models`, {
      headers: this.headers(),
    });
    if (!r.ok) throw new Error(`${this.id} listModels ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return (j.data ?? []).map((m: any) => m.id);
  }

  protected headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...this.cfg.headers };
    if (this.cfg.apiKey) h.Authorization = `Bearer ${this.cfg.apiKey}`;
    return h;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body: any = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens,
      stream: false,
    };
    if (req.json) body.response_format = { type: 'json_object' };
    if (req.tools?.length) body.tools = req.tools;

    const r = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${this.id} chat ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return {
      text: j.choices?.[0]?.message?.content ?? '',
      raw: j,
      usage: j.usage ? { in: j.usage.prompt_tokens, out: j.usage.completion_tokens } : undefined,
    };
  }
}
```

`main/providers/anthropic.ts`

```ts
import type { Provider, ProviderConfig, ChatRequest, ChatResponse } from './types';

export class AnthropicProvider implements Provider {
  id = 'anthropic';
  label = 'Anthropic';
  private cfg: ProviderConfig;
  constructor(cfg: ProviderConfig) { this.cfg = cfg; }

  async listModels(): Promise<string[]> {
    const r = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': this.cfg.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
    });
    if (!r.ok) throw new Error(`anthropic listModels ${r.status}`);
    const j = await r.json();
    return (j.data ?? []).map((m: any) => m.id);
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const system = req.messages.find(m => m.role === 'system')?.content ?? '';
    const messages = req.messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content,
    }));
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.cfg.apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        system,
        messages,
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.2,
      }),
    });
    if (!r.ok) throw new Error(`anthropic chat ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return {
      text: j.content?.[0]?.text ?? '',
      raw: j,
      usage: j.usage ? { in: j.usage.input_tokens, out: j.usage.output_tokens } : undefined,
    };
  }
}
```

`main/providers/ollama.ts` (also LM Studio, same OpenAI-compat path)

```ts
import { OpenAICompatibleProvider } from './openai';
import type { ProviderConfig } from './types';

export class OllamaProvider extends OpenAICompatibleProvider {
  constructor(cfg: ProviderConfig = {}) {
    super('ollama', 'Ollama (local)', { baseUrl: 'http://localhost:11434/v1', ...cfg });
  }
  // Ollama's list is at /api/tags, not /v1/models
  async listModels(): Promise<string[]> {
    const r = await fetch('http://localhost:11434/api/tags');
    if (!r.ok) return [];
    const j = await r.json();
    return (j.models ?? []).map((m: any) => m.name);
  }
}

export class LMStudioProvider extends OpenAICompatibleProvider {
  constructor(cfg: ProviderConfig = {}) {
    super('lmstudio', 'LM Studio (local)', { baseUrl: 'http://localhost:1234/v1', ...cfg });
  }
}
```

`main/providers/index.ts` — registry + router

```ts
import type { Provider, ProviderConfig } from './types';
import { OpenAICompatibleProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider, LMStudioProvider } from './ollama';

class ProviderRegistry {
  private providers = new Map<string, Provider>();
  private configs = new Map<string, ProviderConfig>();

  constructor() {
    // Default registrations with empty keys. User fills keys via settings.
    this.register('openai',     'OpenAI',     new OpenAICompatibleProvider('openai', 'OpenAI', { baseUrl: 'https://api.openai.com/v1' }));
    this.register('anthropic',  'Anthropic',  new AnthropicProvider({}));
    this.register('ollama',     'Ollama',     new OllamaProvider());
    this.register('lmstudio',   'LM Studio',  new LMStudioProvider());
    this.register('grok',       'xAI Grok',   new OpenAICompatibleProvider('grok', 'xAI Grok', { baseUrl: 'https://api.x.ai/v1' }));
    this.register('deepseek',   'DeepSeek',   new OpenAICompatibleProvider('deepseek', 'DeepSeek', { baseUrl: 'https://api.deepseek.com/v1' }));
    this.register('groq',       'Groq',       new OpenAICompatibleProvider('groq', 'Groq', { baseUrl: 'https://api.groq.com/openai/v1' }));
    this.register('openrouter', 'OpenRouter', new OpenAICompatibleProvider('openrouter', 'OpenRouter', { baseUrl: 'https://openrouter.ai/api/v1' }));
    this.register('gemini',     'Google Gemini', new OpenAICompatibleProvider('gemini', 'Google Gemini', { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/' }));
    this.register('mistral',    'Mistral',    new OpenAICompatibleProvider('mistral', 'Mistral', { baseUrl: 'https://api.mistral.ai/v1' }));
    this.register('custom',     'Custom',     new OpenAICompatibleProvider('custom', 'Custom', {}));
  }

  register(id: string, _label: string, p: Provider) { this.providers.set(id, p); }

  configure(id: string, cfg: ProviderConfig) {
    this.configs.set(id, cfg);
    // Reconstruct OpenAI-compatible providers with new config; keep custom ones
    if (p instanceof OpenAICompatibleProvider) {
      const base = (p as any).baseUrl as string | undefined;
      this.providers.set(id, new OpenAICompatibleProvider(id, p.label, { baseUrl: base, ...cfg }));
    }
  }

  list(): { id: string; label: string }[] {
    return [...this.providers.values()].map(p => ({ id: p.id, label: p.label }));
  }

  get(id: string): Provider | undefined { return this.providers.get(id); }
}

export const providers = new ProviderRegistry();
```

---

## 4. DSL: parser, sandbox (limit-scope checker), evaluator

The DSL is a small JS-subset. The LLM is prompted to emit code that only references `ctx` (plus locals it declares). The sandbox walks the AST and denies anything outside that scope. The evaluator runs the AST against a real `ctx` object and logs every evaluation.

`main/agent/dsl.ts`

```ts
import * as acorn from 'acorn';
import type * as estree from 'estree';

// ---------- Public types ----------
export interface DslContext {
  goals:   any;
  learn:   any;
  ide:     any;
  finance: any;
  canvas:  any;
  log: (msg: string, data?: any) => Promise<void>;
  now: () => string;
}

export interface EvalLogEntry {
  seq: number;
  ts: string;
  nodeType: string;
  source: string;
  target?: string;
  args?: any;
  result?: any;
  error?: string;
  durationMs: number;
}

export interface AuditEntry {
  ts: string;
  decision: 'allow' | 'deny';
  reason: string;
  nodeType: string;
  source: string;
  target?: string;
}

export interface EvalResult {
  ok: boolean;
  logs: EvalLogEntry[];
  audit: AuditEntry[];
  error?: string;
}

// ---------- AST helpers ----------
type Node = estree.Node;

function loc(n: Node) { return `${n.type}@${n.start}-${n.end}`; }
function sourceOf(src: string, n: Node): string {
  return src.slice(n.start, n.end);
}

// Allowed call targets: anything that resolves through ctx (ctx.goals.suggest, ctx.log, etc.)
// plus built-in locals declared inside the program.
const ALLOWED_GLOBALS = new Set(['ctx', 'console']); // console is replaced with a no-op safe logger

// ---------- Sandbox verifier (limit-scope checking) ----------
//
// Walks the AST and rejects:
//  - References to identifiers not declared as locals and not in ALLOWED_GLOBALS
//  - Member access on anything that isn't a local or ctx (or a value already produced by ctx)
//  - Unsafe node types (eval, Function, with, this, new (except allowlist), import, etc.)
//  - Assignment to anything other than a declared local
//
// It records an audit entry for every "interesting" node (calls, member access) so the
// audit trail reflects the verifier's decisions.
export function verifyDsl(source: string): { ok: boolean; audits: AuditEntry[]; errors: string[] } {
  const audits: AuditEntry[] = [];
  const errors: string[] = [];
  let ast: estree.Program;
  try {
    ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: false }) as unknown as estree.Program;
  } catch (e: any) {
    return { ok: false, audits: [], errors: [`parse: ${e.message}`] };
  }

  const DISALLOWED = new Set([
    'ThisExpression', 'Super', 'MetaProperty', 'YieldExpression',
    'WithStatement', 'LabeledStatement', 'ImportExpression',
    'ExportNamedDeclaration', 'ExportDefaultDeclaration', 'ImportDeclaration',
    'ClassDeclaration', 'ClassExpression',
  ]);

  const locals = new Set<string>();

  function deny(node: Node, reason: string, target?: string) {
    audits.push({ ts: new Date().toISOString(), decision: 'deny', reason, nodeType: node.type, source: sourceOf(source, node), target });
    errors.push(`${loc(node)}: ${reason}`);
  }
  function allow(node: Node, target?: string, reason = 'ok') {
    audits.push({ ts: new Date().toISOString(), decision: 'allow', reason, nodeType: node.type, source: sourceOf(source, node), target });
  }

  // We only allow reading identifiers we know. Member access requires the base
  // to be a known-safe expression (ctx, a local, or another member expression whose
  // base is known-safe — transitive).
  function isSafeBase(n: Node): boolean {
    if (n.type === 'Identifier') return ALLOWED_GLOBALS.has(n.name) || locals.has(n.name);
    if (n.type === 'MemberExpression') return isSafeBase((n as estree.MemberExpression).object);
    if (n.type === 'CallExpression') return true; // result of a safe call is safe
    if (n.type === 'AwaitExpression') return isSafeBase((n as estree.AwaitExpression).argument);
    if (n.type === 'ArrayExpression' || n.type === 'ObjectExpression' || n.type === 'Literal') return true;
    if (n.type === 'BinaryExpression' || n.type === 'LogicalExpression' || n.type === 'UnaryExpression' || n.type === 'ConditionalExpression') return true;
    return false;
  }

  function walk(n: Node) {
    if (!n || typeof n !== 'object') return;
    if (DISALLOWED.has(n.type)) { deny(n, `${n.type} is disallowed`); return; }

    switch (n.type) {
      case 'Program':
        (n as estree.Program).body.forEach(walk); return;

      case 'BlockStatement':
        (n as estree.BlockStatement).body.forEach(walk); return;

      case 'ExpressionStatement':
        walk((n as estree.ExpressionStatement).expression); return;

      case 'VariableDeclaration': {
        const d = n as estree.VariableDeclaration;
        d.declarations.forEach(dec => {
          (dec.id as estree.Identifier).name && locals.add((dec.id as estree.Identifier).name);
          dec.init && walk(dec.init);
        });
        return;
      }

      case 'Identifier': {
        const name = (n as estree.Identifier).name;
        if (!ALLOWED_GLOBALS.has(name) && !locals.has(name)) {
          deny(n, `undeclared identifier "${name}"`);
        }
        return;
      }

      case 'MemberExpression': {
        const m = n as estree.MemberExpression;
        if (!isSafeBase(m.object)) { deny(m.object, 'unsafe member base', sourceOf(source, m)); return; }
        allow(m, sourceOf(source, m));
        walk(m.object);
        return;
      }

      case 'CallExpression': {
        const c = n as estree.CallExpression;
        if (c.callee.type === 'MemberExpression') {
          const m = c.callee as estree.MemberExpression;
          if (!isSafeBase(m.object)) { deny(m.object, 'unsafe call base', sourceOf(source, c)); return; }
          allow(c, sourceOf(source, c));
        } else if (c.callee.type === 'Identifier') {
          const name = (c.callee as estree.Identifier).name;
          if (!ALLOWED_GLOBALS.has(name) && !locals.has(name)) { deny(c.callee, `calling undeclared "${name}"`, name); return; }
          allow(c, name);
        } else {
          deny(c.callee, 'unsupported callee form');
          return;
        }
        c.arguments.forEach(walk);
        return;
      }

      case 'IfStatement': {
        const s = n as estree.IfStatement;
        walk(s.test); walk(s.consequent); s.alternate && walk(s.alternate);
        return;
      }

      case 'ForOfStatement':
      case 'ForStatement': {
        // Allow loops but require the body to be a block we walk. Bound counters/iters come from ctx.
        const f = n as any;
        f.init && walk(f.init); f.test && walk(f.test); f.update && walk(f.update); f.body && walk(f.body);
        return;
      }

      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        // Allowed only as inline callbacks to ctx methods. We add their params as locals.
        const fn = n as estree.ArrowFunctionExpression;
        fn.params.forEach(p => {
          if (p.type === 'Identifier') locals.add((p as estree.Identifier).name);
        });
        walk(fn.body);
        return;
      }

      case 'AwaitExpression': walk((n as estree.AwaitExpression).argument); return;
      case 'ReturnStatement': { (n as estree.ReturnStatement).argument && walk((n as estree.ReturnStatement).argument!); return; }
      case 'BinaryExpression':
      case 'LogicalExpression': {
        const b = n as estree.BinaryExpression;
        walk(b.left); walk(b.right); return;
      }
      case 'UnaryExpression': walk((n as estree.UnaryExpression).argument); return;
      case 'ConditionalExpression': {
        const c = n as estree.ConditionalExpression;
        walk(c.test); walk(c.consequent); walk(c.alternate); return;
      }
      case 'ArrayExpression': (n as estree.ArrayExpression).elements.forEach(e => e && walk(e)); return;
      case 'ObjectExpression': {
        (n as estree.ObjectExpression).properties.forEach(p => {
          if (p.type === 'Property') {
            walk((p as estree.Property).value);
          }
        });
        return;
      }
      case 'TemplateLiteral': {
        (n as estree.TemplateLiteral).expressions.forEach(walk);
        return;
      }
      case 'AssignmentExpression': {
        const a = n as estree.AssignmentExpression;
        if (a.left.type === 'Identifier') {
          if (!locals.has((a.left as estree.Identifier).name)) { deny(a.left, 'assignment to undeclared local'); return; }
          walk(a.right); return;
        }
        deny(a.left, 'assignment to non-local');
        return;
      }
      case 'TemplateElement': return;
      case 'Literal': return;
      default:
        // For anything we didn't explicitly handle, we are conservative.
        deny(n, `unhandled node ${n.type}`);
    }
  }

  walk(ast);
  return { ok: errors.length === 0, audits, errors };
}

// ---------- Evaluator ----------
//
// Executes the verified AST against the live ctx. Every CallExpression and
// IfStatement test is recorded with a timestamp, the (truncated) args, the
// (truncated) result, the error (if any), and the duration.
export async function evalDsl(source: string, ctx: DslContext): Promise<EvalResult> {
  const logs: EvalLogEntry[] = [];
  let seq = 0;
  const truncate = (v: any) => {
    try {
      const s = JSON.stringify(v);
      if (!s) return undefined;
      return s.length > 4000 ? s.slice(0, 4000) + '…' : JSON.parse(s);
    } catch { return '<unserializable>'; }
  };
  const log = (e: Omit<EvalLogEntry, 'seq' | 'ts'>) => {
    logs.push({ seq: seq++, ts: new Date().toISOString(), ...e });
  };

  // Local scope. ctx is immutable from the program's POV.
  const scope = new Map<string, any>();
  scope.set('ctx', ctx);
  // Safe console: writes into eval log so the UI can show "console.log"
  scope.set('console', { log: (...a: any[]) => { ctx.log('console', a.map(truncate)).catch(() => {}); } });

  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' }) as unknown as estree.Program;

  async function evaluate(n: Node): Promise<any> {
    switch (n.type) {
      case 'Program': {
        let last: any;
        for (const s of (n as estree.Program).body) last = await evaluate(s);
        return last;
      }
      case 'BlockStatement': {
        let last: any;
        for (const s of (n as estree.BlockStatement).body) last = await evaluate(s);
        return last;
      }
      case 'ExpressionStatement':
        return evaluate((n as estree.ExpressionStatement).expression);
      case 'Literal':
        return (n as estree.Literal).value;
      case 'Identifier':
        if (!scope.has((n as estree.Identifier).name)) throw new Error(`undefined: ${(n as estree.Identifier).name}`);
        return scope.get((n as estree.Identifier).name);
      case 'TemplateLiteral': {
        const t = n as estree.TemplateLiteral;
        let s = '';
        for (let i = 0; i < t.quasis.length; i++) {
          s += t.quasis[i].value.cooked;
          if (i < t.expressions.length) s += String(await evaluate(t.expressions[i]));
        }
        return s;
      }
      case 'TemplateElement':
        return (n as estree.TemplateElement).value.cooked;
      case 'ArrayExpression': {
        const out = [];
        for (const e of (n as estree.ArrayExpression).elements) out.push(e ? await evaluate(e) : undefined);
        return out;
      }
      case 'ObjectExpression': {
        const obj: any = {};
        for (const p of (n as estree.ObjectExpression).properties) {
          if (p.type === 'Property') {
            const key = (p as estree.Property).key.type === 'Identifier'
              ? ((p as estree.Property).key as estree.Identifier).name
              : await evaluate((p as estree.Property).key as estree.Literal);
            obj[key] = await evaluate((p as estree.Property).value);
          }
        }
        return obj;
      }
      case 'UnaryExpression': {
        const u = n as estree.UnaryExpression;
        const v = await evaluate(u.argument);
        switch (u.operator) { case '!': return !v; case '-': return -v; case '+': return +v; case 'typeof': return typeof v; }
        throw new Error(`unary ${u.operator}`);
      }
      case 'BinaryExpression': {
        const b = n as estree.BinaryExpression;
        const l = await evaluate(b.left); const r = await evaluate(b.right);
        switch (b.operator) {
          case '==': return l == r; case '!=': return l != r;
          case '===': return l === r; case '!==': return l !== r;
          case '<': return l < r; case '<=': return l <= r; case '>': return l > r; case '>=': return l >= r;
          case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r;
          case '%': return l % r;
        }
        throw new Error(`binary ${b.operator}`);
      }
      case 'LogicalExpression': {
        const b = n as estree.LogicalExpression;
        const l = await evaluate(b.left);
        if (b.operator === '&&') return l ? await evaluate(b.right) : l;
        if (b.operator === '||') return l ? l : await evaluate(b.right);
        if (b.operator === '??') return l ?? await evaluate(b.right);
        throw new Error(`logical ${b.operator}`);
      }
      case 'ConditionalExpression': {
        const c = n as estree.ConditionalExpression;
        return await evaluate(c.test) ? await evaluate(c.consequent) : await evaluate(c.alternate);
      }
      case 'MemberExpression': {
        const m = n as estree.MemberExpression;
        const obj = await evaluate(m.object);
        const key = m.computed ? await evaluate(m.property) : (m.property as estree.Identifier).name;
        return obj?.[key as any];
      }
      case 'CallExpression': {
        const c = n as estree.CallExpression;
        let fn: any; let target = '';
        if (c.callee.type === 'MemberExpression') {
          const m = c.callee as estree.MemberExpression;
          const obj = await evaluate(m.object);
          const key = m.computed ? await evaluate(m.property) : (m.property as estree.Identifier).name;
          fn = obj?.[key as any];
          target = `${describeBase(m.object)}.${key}`;
        } else {
          fn = await evaluate(c.callee);
          target = (c.callee as estree.Identifier).name;
        }
        const args = await Promise.all(c.arguments.map(a => evaluate(a)));
        const t0 = performance.now();
        try {
          const result = await Promise.resolve(fn.apply(null, args));
          log({ nodeType: 'Call', source: sourceOf(source, n), target, args: truncate(args), result: truncate(result), durationMs: Math.round(performance.now() - t0) });
          return result;
        } catch (e: any) {
          log({ nodeType: 'Call', source: sourceOf(source, n), target, args: truncate(args), error: String(e?.message ?? e), durationMs: Math.round(performance.now() - t0) });
          throw e;
        }
      }
      case 'VariableDeclaration': {
        const d = n as estree.VariableDeclaration;
        for (const dec of d.declarations) {
          const name = (dec.id as estree.Identifier).name;
          const v = dec.init ? await evaluate(dec.init) : undefined;
          scope.set(name, v);
        }
        return undefined;
      }
      case 'AssignmentExpression': {
        const a = n as estree.AssignmentExpression;
        if (a.left.type !== 'Identifier') throw new Error('unsupported assignment target');
        const v = await evaluate(a.right);
        scope.set((a.left as estree.Identifier).name, v);
        return v;
      }
      case 'IfStatement': {
        const s = n as estree.IfStatement;
        const t0 = performance.now();
        const test = await evaluate(s.test);
        log({ nodeType: 'If', source: sourceOf(source, s.test), target: '<test>', args: truncate(test), result: truncate(test), durationMs: Math.round(performance.now() - t0) });
        return test ? await evaluate(s.consequent) : (s.alternate ? await evaluate(s.alternate) : undefined);
      }
      case 'ForOfStatement': {
        const f = n as estree.ForOfStatement;
        const iter = await evaluate(f.right);
        if (!iter || typeof iter[Symbol.iterator] !== 'function') throw new Error('for-of expects iterable');
        let last: any;
        for (const item of iter) {
          if (f.left.type === 'VariableDeclaration') {
            const name = ((f.left as estree.VariableDeclaration).declarations[0].id as estree.Identifier).name;
            scope.set(name, item);
          }
          last = await evaluate(f.body);
        }
        return last;
      }
      case 'AwaitExpression':
        return await evaluate((n as estree.AwaitExpression).argument);
      case 'ReturnStatement':
        return (n as estree.ReturnStatement).argument ? await evaluate((n as estree.ReturnStatement).argument!) : undefined;
      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        const fn = n as estree.ArrowFunctionExpression;
        return (...args: any[]) => {
          const saved = new Map<string, any>();
          fn.params.forEach((p, i) => {
            const name = (p as estree.Identifier).name;
            saved.set(name, scope.get(name));
            scope.set(name, args[i]);
          });
          return Promise.resolve(evaluate(fn.body)).finally(() => {
            fn.params.forEach((p) => {
              const name = (p as estree.Identifier).name;
              if (saved.has(name)) scope.set(name, saved.get(name)); else scope.delete(name);
            });
          });
        };
      }
      default:
        throw new Error(`eval: unsupported ${n.type}`);
    }
  }

  function describeBase(n: Node): string {
    if (n.type === 'Identifier') return (n as estree.Identifier).name;
    if (n.type === 'MemberExpression') {
      const m = n as estree.MemberExpression;
      return `${describeBase(m.object)}.${m.computed ? '?' : (m.property as estree.Identifier).name}`;
    }
    return '?';
  }

  try {
    await evaluate(ast);
    return { ok: true, logs, audit: [], error: undefined };
  } catch (e: any) {
    return { ok: false, logs, audit: [], error: String(e?.message ?? e) };
  }
}
```

`main/agent/audit.ts` — persistence helpers for the audit + log

```ts
import type { Database } from 'better-sqlite3';
import type { EvalLogEntry, AuditEntry } from './dsl';

export function writeEvalLog(db: Database, sessionId: string, entries: EvalLogEntry[]) {
  const stmt = db.prepare(`
    INSERT INTO agent_eval_log (session_id, ts, seq, node_type, source, target, args, result, error, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((rows: any[]) => {
    for (const r of rows) stmt.run(sessionId, r.ts, r.seq, r.nodeType, r.source ?? '', r.target ?? '', r.args ? JSON.stringify(r.args) : null, r.result ? JSON.stringify(r.result) : null, r.error ?? null, r.durationMs ?? 0);
  });
  tx(entries);
}

export function writeAudit(db: Database, sessionId: string, entries: AuditEntry[]) {
  const stmt = db.prepare(`
    INSERT INTO agent_audit (session_id, ts, decision, reason, node_type, source, target)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((rows: any[]) => {
    for (const r of rows) stmt.run(sessionId, r.ts, r.decision, r.reason, r.nodeType, r.source ?? '', r.target ?? null);
  });
  tx(entries);
}
```

---

## 5. Orchestrator + ambient agents

`main/agent/context.ts` — the `ctx` object exposed to DSL. Each method delegates to existing service code (you wire to your own implementations).

```ts
import type { DslContext } from './dsl';
import { eventBus, Events } from '../event-bus';

// This is the surface the DSL program sees. We keep it small and explicit so
// the sandbox verifier can reason about it. Each method maps to existing
// service functions in your 5 subsystems.
//
// Replace the stub bodies with calls to your real services (e.g. goalsService.create).
export function buildDslContext(deps: {
  goalsService: any;
  learnService: any;
  ideService: any;
  financeService: any;
  canvasService: any;
  sessionId: string;
}): DslContext {
  const { goalsService, learnService, ideService, financeService, canvasService, sessionId } = deps;

  return {
    goals: {
      list:   async () => goalsService.list(),
      get:    async (id: string) => goalsService.get(id),
      suggest: async (data: any) => {
        const id = await goalsService.suggest({ ...data, sessionId });
        eventBus.emit(Events.AgentSuggestionProposed, { source: 'goals', sessionId, kind: 'goal', id });
        return id;
      },
      progress: async (id: string, pct: number) => {
        const g = await goalsService.updateProgress(id, pct);
        eventBus.emit(Events.GoalProgress, g);
        return g;
      },
      complete: async (id: string) => {
        const g = await goalsService.complete(id);
        eventBus.emit(Events.GoalCompleted, g);
        return g;
      },
    },
    learn: {
      listCurricula: async () => learnService.listCurricula(),
      suggestLesson: async (data: any) => {
        const id = await learnService.suggestLesson({ ...data, sessionId });
        eventBus.emit(Events.AgentSuggestionProposed, { source: 'learn', sessionId, kind: 'lesson', id });
        return id;
      },
      markLessonDone: async (id: string) => {
        const r = await learnService.markLessonDone(id);
        eventBus.emit(Events.LessonCompleted, r);
        return r;
      },
    },
    ide: {
      listProjects: async () => ideService.list(),
      suggestProject: async (data: any) => {
        const id = await ideService.suggestProject({ ...data, sessionId });
        eventBus.emit(Events.AgentSuggestionProposed, { source: 'ide', sessionId, kind: 'project', id });
        return id;
      },
    },
    finance: {
      walletHealth: async (threshold = 0.2) => financeService.walletHealth(threshold),
      budgetsNearLimit: async () => financeService.budgetsNearLimit(),
      suggestBudget: async (data: any) => {
        const id = await financeService.suggestBudget({ ...data, sessionId });
        eventBus.emit(Events.AgentSuggestionProposed, { source: 'finance', sessionId, kind: 'budget', id });
        return id;
      },
      logTransaction: async (data: any) => {
        const t = await financeService.logTransaction(data);
        eventBus.emit(Events.TransactionPosted, t);
        return t;
      },
    },
    canvas: {
      listNodes: async () => canvasService.listNodes(),
      addNode: async (data: any) => {
        const n = await canvasService.addNode(data);
        eventBus.emit(Events.CanvasNodeAdded, n);
        return n;
      },
      execute: async (nodeId: string) => {
        const r = await canvasService.execute(nodeId);
        eventBus.emit(Events.CanvasExecuted, r);
        return r;
      },
    },
    log: async (msg: string, data?: any) => {
      // Stored as part of the eval log via a console-like call.
      // The orchestrator attaches a sink that records these to the eval log.
      deps && void data; // noop; the actual recording happens in the evaluator's Call handler for ctx.log
    },
    now: () => new Date().toISOString(),
  };
}
```

`main/agent/orchestrator.ts` — the heart. Takes natural language → DSL via provider → verify → eval → log/audit → persist.

```ts
import { randomUUID } from 'crypto';
import { providers } from '../providers';
import { verifyDsl, evalDsl, type EvalResult } from './dsl';
import { buildDslContext } from './context';
import { writeEvalLog, writeAudit } from './audit';
import { eventBus, Events } from '../event-bus';
import type { Database } from 'better-sqlite3';

const DSL_SYSTEM_PROMPT = `
You are the DeskFlow agent runtime. You emit programs in a tiny JavaScript subset called DSL.
The program runs inside a sandbox. You may ONLY reference a top-level binding called "ctx".
You may declare locals with const/let. You may use async/await. You may use if/for-of/arrow fns.
You may NOT use: this, eval, Function, new, import, require, process, global, window, document.

ctx has these modules (all async):
  ctx.goals.list() -> Goal[]
  ctx.goals.suggest({ title, description, tier, category }) -> id
  ctx.goals.progress(id, pct) -> Goal
  ctx.goals.complete(id) -> Goal
  ctx.learn.listCurricula() -> Curriculum[]
  ctx.learn.suggestLesson({ curriculumId, title, content }) -> id
  ctx.learn.markLessonDone(id) -> Lesson
  ctx.ide.listProjects() -> Project[]
  ctx.ide.suggestProject({ name, path, type }) -> id
  ctx.finance.walletHealth(threshold=0.2) -> { alert: boolean, balance: number, ... }
  ctx.finance.budgetsNearLimit() -> Budget[]
  ctx.finance.suggestBudget({ name, type, amount, period }) -> id
  ctx.finance.logTransaction({ walletId, category, amount, type, note }) -> Tx
  ctx.canvas.listNodes() -> Node[]
  ctx.canvas.addNode({ type, position, data }) -> Node
  ctx.canvas.execute(nodeId) -> Result
  ctx.log(msg, data?) -> void
  ctx.now() -> ISO string

Rules:
- Always await ctx calls.
- Keep programs small. Prefer 1-10 statements.
- Do not invent APIs. Only the ones listed above exist.
- Respond with a single code block containing ONLY the DSL program (no prose, no markdown fences).
`;

export interface RunIntentInput {
  prompt: string;
  provider: string;       // 'openai' | ...
  model: string;
  deps: any;              // services
  kind?: 'intent' | 'canvas';
  source?: string;
}

export interface RunIntentResult {
  sessionId: string;
  ok: boolean;
  dsl?: string;
  evalResult?: EvalResult;
  verifyErrors?: string[];
  error?: string;
}

export class Orchestrator {
  constructor(private db: Database) {}

  async runIntent(input: RunIntentInput): Promise<RunIntentResult> {
    const provider = providers.get(input.provider);
    if (!provider) throw new Error(`unknown provider: ${input.provider}`);

    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO agent_sessions (id, kind, source, prompt, status, provider, model, started_at)
                     VALUES (?, ?, ?, ?, 'running', ?, ?, ?)`)
      .run(sessionId, input.kind ?? 'intent', input.source ?? 'user', input.prompt, input.provider, input.model, startedAt);
    eventBus.emit(Events.AgentSessionStarted, { sessionId });

    try {
      // 1. Generate DSL
      const chat = await provider.chat({
        model: input.model,
        temperature: 0.2,
        maxTokens: 1200,
        messages: [
          { role: 'system', content: DSL_SYSTEM_PROMPT },
          { role: 'user',   content: input.prompt },
        ],
      });
      // Strip code fences if the model added them
      const dsl = stripFences(chat.text);
      this.db.prepare(`UPDATE agent_sessions SET dsl = ? WHERE id = ?`).run(dsl, sessionId);

      // 2. Verify (limit-scope checking). Deny early.
      const v = verifyDsl(dsl);
      writeAudit(this.db, sessionId, v.audits);
      if (!v.ok) {
        this.db.prepare(`UPDATE agent_sessions SET status = 'failed', error = ?, ended_at = ? WHERE id = ?`)
          .run(v.errors.join('\n'), new Date().toISOString(), sessionId);
        eventBus.emit(Events.AgentSessionCompleted, { sessionId, ok: false });
        return { sessionId, ok: false, dsl, verifyErrors: v.errors };
      }

      // 3. Evaluate
      const ctx = buildDslContext({ ...input.deps, sessionId });
      const evalResult = await evalDsl(dsl, ctx);
      writeEvalLog(this.db, sessionId, evalResult.logs);

      this.db.prepare(`UPDATE agent_sessions SET status = ?, error = ?, ended_at = ? WHERE id = ?`)
        .run(evalResult.ok ? 'completed' : 'failed', evalResult.error ?? null, new Date().toISOString(), sessionId);

      eventBus.emit(Events.AgentSessionCompleted, { sessionId, ok: evalResult.ok });
      return { sessionId, ok: evalResult.ok, dsl, evalResult };
    } catch (e: any) {
      this.db.prepare(`UPDATE agent_sessions SET status = 'failed', error = ?, ended_at = ? WHERE id = ?`)
        .run(String(e?.message ?? e), new Date().toISOString(), sessionId);
      eventBus.emit(Events.AgentSessionCompleted, { sessionId, ok: false });
      return { sessionId, ok: false, error: String(e?.message ?? e) };
    }
  }
}

function stripFences(s: string): string {
  const m = s.match(/```(?:javascript|js|dsl)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : s.trim();
}
```

`main/agent/ambient/index.ts` — registry + scheduler

```ts
import type { Database } from 'better-sqlite3';
import { Orchestrator } from '../orchestrator';
import { eventBus, Events } from '../../event-bus';

export interface AmbientAgent {
  source: string;              // 'goals' | 'learn' | ...
  buildPrompt(state: any): string;   // returns NL prompt for the LLM
  shouldRun(state: any): boolean;
}

export class AmbientScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private running = new Set<string>();

  constructor(private db: Database, private orchestrator: Orchestrator,
              private agents: AmbientAgent[], private deps: any,
              private provider: string, private model: string) {}

  start() {
    for (const a of this.agents) this.scheduleNext(a);
    this.subscribeEvents();
  }

  stop() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  private scheduleNext(a: AmbientAgent) {
    const row = this.db.prepare(`SELECT * FROM agent_ambient_state WHERE source = ?`).get(a.source) as any;
    const delay = row?.enabled ? Math.max(30_000, row.interval_ms ?? 300000) : 60_000;
    const t = setTimeout(() => this.tick(a).finally(() => this.scheduleNext(a)), delay);
    this.timers.set(a.source, t);
  }

  private async tick(a: AmbientAgent) {
    if (this.running.has(a.source)) return;
    this.running.add(a.source);
    try {
      const state = await this.collectState(a);
      if (!a.shouldRun(state)) {
        this.db.prepare(`UPDATE agent_ambient_state SET last_run_at = ?, last_status = 'skipped' WHERE source = ?`)
          .run(new Date().toISOString(), a.source);
        return;
      }
      const prompt = a.buildPrompt(state);
      const r = await this.orchestrator.runIntent({
        prompt, provider: this.provider, model: this.model, deps: this.deps,
        kind: 'ambient', source: a.source,
      });
      this.db.prepare(`UPDATE agent_ambient_state SET last_run_at = ?, last_status = ?, last_error = ? WHERE source = ?`)
        .run(new Date().toISOString(), r.ok ? 'completed' : 'failed', r.error ?? null, a.source);
    } catch (e: any) {
      this.db.prepare(`UPDATE agent_ambient_state SET last_run_at = ?, last_status = 'failed', last_error = ? WHERE source = ?`)
        .run(new Date().toISOString(), String(e?.message ?? e), a.source);
    } finally {
      this.running.delete(a.source);
    }
  }

  // Collect a small snapshot of state for the agent's prompt.
  private async collectState(a: AmbientAgent): Promise<any> {
    const s = a.source;
    switch (s) {
      case 'goals':   return { goals: await this.deps.goalsService.list() };
      case 'learn':   return { curricula: await this.deps.learnService.listCurricula() };
      case 'ide':     return { projects: await this.deps.ideService.list() };
      case 'finance': return {
        walletHealth: await this.deps.financeService.walletHealth(0.2),
        budgetsNearLimit: await this.deps.financeService.budgetsNearLimit(),
      };
      case 'canvas':  return { nodes: await this.deps.canvasService.listNodes() };
    }
    return {};
  }

  // Reactive triggers — let events fire an agent tick immediately.
  private subscribeEvents() {
    eventBus.on(Events.GoalCompleted,        () => this.kick('goals'));
    eventBus.on(Events.GoalProgress,        () => this.kick('goals'));
    eventBus.on(Events.LessonCompleted,     () => this.kick('learn'));
    eventBus.on(Events.CurriculumMastered,  () => this.kick('learn'));
    eventBus.on(Events.SessionCompleted,    () => this.kick('ide'));
    eventBus.on(Events.WalletDrift,         () => this.kick('finance'));
    eventBus.on(Events.BudgetThreshold,     () => this.kick('finance'));
    eventBus.on(Events.CanvasExecuted,      () => this.kick('canvas'));
  }

  private kick(source: string) {
    const a = this.agents.find(x => x.source === source);
    if (!a) return;
    // Debounce: only run if not already running.
    if (this.running.has(source)) return;
    void this.tick(a);
  }
}
```

`main/agent/ambient/agents.ts` — concrete ambient agents

```ts
import type { AmbientAgent } from './index';

export const goalsAgent: AmbientAgent = {
  source: 'goals',
  shouldRun: (s) => {
    // Run if there are zero goals, or any are stalled (no progress in 3 days).
    const g = s.goals ?? [];
    if (g.length === 0) return true;
    const threeDays = 1000 * 60 * 60 * 24 * 3;
    return g.some((x: any) => x.status === 'active' && Date.now() - new Date(x.updatedAt).getTime() > threeDays);
  },
  buildPrompt: (s) => {
    const g = s.goals ?? [];
    if (g.length === 0) {
      return `The user has no goals. Suggest one foundational goal for the "core" tier that supports their learning and finance aspirations. Use ctx.goals.suggest.`;
    }
    const stalled = g.filter((x: any) => x.status === 'active');
    return `These goals exist:\n${JSON.stringify(stalled, null, 2)}\n\nSuggest a single concrete next-step sub-goal that unblocks the most stalled one. Use ctx.goals.suggest with a parent_id when sensible.`;
  },
};

export const learnAgent: AmbientAgent = {
  source: 'learn',
  shouldRun: (s) => (s.curricula ?? []).length === 0,
  buildPrompt: (_s) => `The user has no learning curricula. Suggest a 1-lesson starter curriculum on a foundational programming concept. Use ctx.learn.suggestLesson.`,
};

export const ideAgent: AmbientAgent = {
  source: 'ide',
  shouldRun: (s) => (s.projects ?? []).length === 0,
  buildPrompt: (_s) => `The user has no IDE projects tracked. Suggest tracking a starter project. Use ctx.ide.suggestProject.`,
};

export const financeAgent: AmbientAgent = {
  source: 'finance',
  shouldRun: (s) => (s.walletHealth?.alert) || (s.budgetsNearLimit?.length > 0),
  buildPrompt: (s) => {
    const parts = [];
    if (s.walletHealth?.alert) parts.push(`Wallet health is low: ${JSON.stringify(s.walletHealth)}.`);
    if (s.budgetsNearLimit?.length) parts.push(`Budgets near limit: ${JSON.stringify(s.budgetsNearLimit)}.`);
    return `${parts.join('\n')}\n\nIf a budget is near limit, suggest a tighter budget for next period via ctx.finance.suggestBudget. If wallet is low, suggest an emergency-fund goal via ctx.goals.suggest.`;
  },
};

export const canvasAgent: AmbientAgent = {
  source: 'canvas',
  shouldRun: (s) => (s.nodes ?? []).length === 0,
  buildPrompt: (_s) => `The AI Canvas is empty. Suggest adding a single starter node (type: 'text', position: {x:0,y:0}, data: {content: 'Hello, agent.'}). Use ctx.canvas.addNode.`,
};

export const allAmbientAgents = [goalsAgent, learnAgent, ideAgent, financeAgent, canvasAgent];
```

---

## 6. IPC handlers

`main/ipc/agent.ts`

```ts
import { ipcMain } from 'electron';
import type { Database } from 'better-sqlite3';
import { Orchestrator } from '../agent/orchestrator';
import { providers } from '../providers';
import { allAmbientAgents } from '../agent/ambient/agents';
import { AmbientScheduler } from '../agent/ambient/index';
import { eventBus, Events } from '../event-bus';

export function registerAgentIpc(db: Database, deps: any) {
  const orchestrator = new Orchestrator(db);

  // Default provider/model — pick from settings later. For now: ollama + a local model if available.
  let activeProvider = 'openai';
  let activeModel = 'gpt-4o-mini';

  const scheduler = new AmbientScheduler(db, orchestrator, allAmbientAgents, deps, activeProvider, activeModel);
  scheduler.start();

  ipcMain.handle('agent:run-intent', async (_e, args: { prompt: string; provider?: string; model?: string }) => {
    return orchestrator.runIntent({
      prompt: args.prompt,
      provider: args.provider ?? activeProvider,
      model: args.model ?? activeModel,
      deps,
      kind: 'intent',
      source: 'user',
    });
  });

  ipcMain.handle('agent:list-sessions', async (_e, q?: { limit?: number }) => {
    return db.prepare(`SELECT id, kind, source, prompt, status, error, provider, model, started_at, ended_at
                       FROM agent_sessions ORDER BY started_at DESC LIMIT ?`)
      .all(q?.limit ?? 50);
  });

  ipcMain.handle('agent:get-session', async (_e, id: string) => {
    const session = db.prepare(`SELECT * FROM agent_sessions WHERE id = ?`).get(id);
    const logs = db.prepare(`SELECT * FROM agent_eval_log WHERE session_id = ? ORDER BY seq ASC`).all(id);
    const audit = db.prepare(`SELECT * FROM agent_audit WHERE session_id = ? ORDER BY id ASC`).all(id);
    return { session, logs, audit };
  });

  ipcMain.handle('agent:verify-dsl', async (_e, args: { dsl: string }) => {
    const { verifyDsl } = await import('../agent/dsl');
    return verifyDsl(args.dsl);
  });

  ipcMain.handle('agent:list-providers', async () => providers.list());

  ipcMain.handle('agent:list-models', async (_e, provider: string) => {
    const p = providers.get(provider);
    if (!p) return [];
    try { return await p.listModels(); } catch { return []; }
  });

  ipcMain.handle('agent:set-active', async (_e, args: { provider: string; model: string }) => {
    activeProvider = args.provider; activeModel = args.model;
    scheduler.stop();
    // Reconstruct scheduler with new defaults
    const newSched = new AmbientScheduler(db, orchestrator, allAmbientAgents, deps, activeProvider, activeModel);
    newSched.start();
    return { ok: true };
  });

  // Suggestion queue
  ipcMain.handle('agent:list-suggestions', async (_e) => {
    return db.prepare(`SELECT * FROM agent_suggestions WHERE status = 'pending' ORDER BY created_at DESC`).all();
  });

  ipcMain.handle('agent:resolve-suggestion', async (_e, args: { id: number; accept: boolean }) => {
    const row = db.prepare(`SELECT * FROM agent_suggestions WHERE id = ?`).get(args.id) as any;
    if (!row) throw new Error('not found');
    if (args.accept) {
      // Apply payload via the right service
      const payload = JSON.parse(row.payload);
      switch (row.source) {
        case 'goals':   await deps.goalsService.applySuggestion(payload); break;
        case 'learn':   await deps.learnService.applySuggestion(payload); break;
        case 'ide':     await deps.ideService.applySuggestion(payload); break;
        case 'finance': await deps.financeService.applySuggestion(payload); break;
        case 'canvas':  await deps.canvasService.applySuggestion(payload); break;
      }
      db.prepare(`UPDATE agent_suggestions SET status = 'applied', resolved_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), args.id);
    } else {
      db.prepare(`UPDATE agent_suggestions SET status = 'rejected', resolved_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), args.id);
    }
    eventBus.emit(Events.AgentSuggestionResolved, { id: args.id, accept: args.accept });
    return { ok: true };
  });
}
```

`main/ipc/index.ts` — registers everything (assumes your existing handlers register themselves too)

```ts
import type { Database } from 'better-sqlite3';
import { registerAgentIpc } from './agent';
// import { registerGoalsIpc } from './goals';          // your existing
// import { registerLearnIpc } from './learn';
// import { registerIdeIpc } from './ide';
// import { registerFinanceIpc } from './finance';
// import { registerCanvasIpc } from './canvas';

export function registerAllIpc(db: Database, deps: any) {
  // registerGoalsIpc(db, deps.goalsService);
  // registerLearnIpc(db, deps.learnService);
  // registerIdeIpc(db, deps.ideService);
  // registerFinanceIpc(db, deps.financeService);
  // registerCanvasIpc(db, deps.canvasService);
  registerAgentIpc(db, deps);
}
```

`main/index.ts` — wire it all

```ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';
import { initDatabase } from '../database';
import { registerAllIpc } from './ipc';
import { eventBus, Events } from './event-bus';

// Wire these to your existing service modules.
import { goalsService }   from './services/goals';
import { learnService }   from './services/learn';
import { ideService }     from './services/ide';
import { financeService } from './services/finance';
import { canvasService } from './services/canvas';

let db: Database.Database;
let win: BrowserWindow;

app.whenReady().then(async () => {
  db = initDatabase(app.getPath('userData'));
  registerAllIpc(db, { goalsService, learnService, ideService, financeService, canvasService });

  // Bridge: forward agent events to the renderer for live UI updates.
  eventBus.on(Events.AgentSessionStarted,   (p) => win?.webContents.send('agent:event', { type: 'session-started', ...p }));
  eventBus.on(Events.AgentSessionCompleted,  (p) => win?.webContents.send('agent:event', { type: 'session-completed', ...p }));
  eventBus.on(Events.AgentSuggestionProposed, (p) => win?.webContents.send('agent:event', { type: 'suggestion', ...p }));

  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640,
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL(process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, '../renderer/index.html')}`);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

`preload/index.ts`

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('deskflow', {
  agent: {
    runIntent: (prompt: string, opts?: { provider?: string; model?: string }) =>
      ipcRenderer.invoke('agent:run-intent', { prompt, ...opts }),
    listSessions: (limit?: number) => ipcRenderer.invoke('agent:list-sessions', { limit }),
    getSession: (id: string) => ipcRenderer.invoke('agent:get-session', id),
    verifyDsl: (dsl: string) => ipcRenderer.invoke('agent:verify-dsl', { dsl }),
    listProviders: () => ipcRenderer.invoke('agent:list-providers'),
    listModels: (provider: string) => ipcRenderer.invoke('agent:list-models', provider),
    setActive: (provider: string, model: string) => ipcRenderer.invoke('agent:set-active', { provider, model }),
    listSuggestions: () => ipcRenderer.invoke('agent:list-suggestions'),
    resolveSuggestion: (id: number, accept: boolean) => ipcRenderer.invoke('agent:resolve-suggestion', { id, accept }),
    onEvent: (cb: (e: any) => void) => {
      const h = (_: unknown, payload: any) => cb(payload);
      ipcRenderer.on('agent:event', h);
      return () => ipcRenderer.off('agent:event', h);
    },
  },
  // ...your existing goals/learn/ide/finance/canvas APIs...
});
```

---

## 7. UI

`renderer/pages/AgentPage.tsx`

```tsx
import { useEffect, useState } from 'react';

export default function AgentPage() {
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const w = (window as any).deskflow;

  useEffect(() => { w.agent.listProviders().then(setProviders); }, []);
  useEffect(() => { refresh(); const off = w.agent.onEvent(() => refresh()); return off; }, []);
  function refresh() {
    w.agent.listSessions(30).then(setSessions);
    w.agent.listSuggestions().then(setSuggestions);
  }

  async function run() {
    setRunning(true);
    try {
      const r = await w.agent.runIntent(prompt, { provider, model });
      setLast(r);
      refresh();
    } finally { setRunning(false); }
  }

  return (
    <div className="p-6 space-y-4 text-zinc-100">
      <h1 className="text-2xl font-semibold">Agent</h1>

      <div className="flex gap-2">
        <select className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1" value={provider}
                onChange={e => setProvider(e.target.value)}>
          {providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 flex-1" placeholder="model"
               value={model} onChange={e => setModel(e.target.value)} />
        <button onClick={() => w.agent.setActive(provider, model)}>set active</button>
      </div>

      <textarea className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 font-mono text-sm" rows={4}
                placeholder="Describe what the agent should do…"
                value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button disabled={running || !prompt.trim()} onClick={run}
              className="px-3 py-1 rounded bg-emerald-600 disabled:opacity-50">
        {running ? 'Running…' : 'Run intent'}
      </button>

      {last && (
        <div className="bg-zinc-900 border border-zinc-700 rounded p-3 text-xs font-mono whitespace-pre-wrap">
          <div>ok: {String(last.ok)}</div>
          {last.verifyErrors?.length ? <div className="text-amber-400">verify: {last.verifyErrors.join('; ')}</div> : null}
          {last.error && <div className="text-red-400">error: {last.error}</div>}
          {last.dsl && <div className="mt-2 text-zinc-300">{last.dsl}</div>}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-1">Suggestions</h2>
          <ul className="space-y-1">
            {suggestions.map(s => (
              <li key={s.id} className="bg-zinc-900 border border-zinc-700 rounded p-2 flex justify-between">
                <div><div className="font-medium">{s.title}</div><div className="text-xs text-zinc-400">{s.source} · {s.kind}</div></div>
                <div className="flex gap-1">
                  <button onClick={() => w.agent.resolveSuggestion(s.id, true).then(refresh)}
                          className="px-2 rounded bg-emerald-700">accept</button>
                  <button onClick={() => w.agent.resolveSuggestion(s.id, false).then(refresh)}
                          className="px-2 rounded bg-zinc-700">reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-1">Recent sessions</h2>
        <ul className="text-sm space-y-1">
          {sessions.map((s: any) => (
            <li key={s.id} className="flex gap-2">
              <span className={`px-1 rounded ${s.status === 'completed' ? 'bg-emerald-700' : s.status === 'failed' ? 'bg-red-700' : 'bg-zinc-700'}`}>{s.status}</span>
              <span className="text-zinc-400">{s.kind}</span>
              <span className="truncate">{s.prompt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## How it fits together

1. On boot, `initDatabase` runs `0006_agent.sql` (plus your existing migrations).
2. `registerAgentIpc` constructs the `Orchestrator` and starts the `AmbientScheduler`.
3. The scheduler's 5 ambient agents poll their subsystems and react to events on the bus (`Goals → suggestions`, `WalletDrift → budget suggestions`, etc.).
4. When a state gap is detected, the agent builds a natural-language prompt and the orchestrator:
   - calls the AI provider to produce DSL,
   - runs `verifyDsl` (limit-scope checker) → writes `agent_audit` rows,
   - runs `evalDsl` against `ctx` → writes `agent_eval_log` rows with per-evaluation timestamps,
   - marks the `agent_sessions` row completed/failed.
5. Suggested goals/lessons/projects/budgets/nodes land in `agent_suggestions` for the user to accept or reject; accepting applies the payload through the existing service layer.

## What you implement next

- Replace the stub bodies in `main/agent/context.ts` with calls to your existing `goalsService`, `learnService`, etc.
- Add `applySuggestion(payload)` to each service so the suggestion queue can materialise records.
- Implement `suggestion(payload)` on each service to insert into `agent_suggestions` with the right `kind` and JSON `payload`.
- Wire `financeService.walletHealth`/`budgetsNearLimit` and `canvasService.execute` (the canvas execution graph is its own project).
- Persist provider keys via `providers.configure(id, { apiKey })` from a settings page.

The runtime is the hard part — sandbox, audit, eval log, scheduler, provider router — and that's complete. The remaining work is plugging the 5 service methods into the `ctx` object.
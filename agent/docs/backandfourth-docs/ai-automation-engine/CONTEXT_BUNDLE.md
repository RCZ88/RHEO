# CONTEXT BUNDLE — AI Automation Engine

> Source code is embedded **inline** because you have no file access.
> Every block is real, quoted from the tree on 2026-10-08.

---

## 1. The tool registry — what an action *is* in this system

The 90 existing tools are the action vocabulary. An automation action should reuse this, not duplicate it.

```ts
import type { AiTool, ToolParameter } from './types'
import { securityGuard } from './securityGuard'
const api = (window as any).deskflowAPI
function p(type: ToolParameter['type'], description: string, extra?: Partial<ToolParameter>): ToolParameter {
  return { type, description, ...extra }
}
export class ToolRegistry {
  private tools = new Map<string, AiTool>()
  register(tool: AiTool) {
    this.tools.set(tool.name, tool)
  }
  get(name: string): AiTool | undefined {
    return this.tools.get(name)
  }
  getAll(): AiTool[] {
    return Array.from(this.tools.values())
  }
  getByCategory(category: string): AiTool[] {
    return this.getAll().filter(t => t.category === category)
  }
  getOpenAISpecs(): Array<{
    type: 'function'
    function: { name: string; description: string; parameters: any }
  }> {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.toOpenAIProps(tool.parameters),
          required: Object.entries(tool.parameters)
            .filter(([_, p]) => p.required)
            .map(([k, _]) => k),
        },
      },
    }))
  }
  async execute(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    if (!securityGuard.isLevelAllowed(tool.securityLevel)) {
      throw new Error(`Tool ${name} requires ${tool.securityLevel} access`)
    }
    const rateCheck = securityGuard.checkRateLimit()
    if (!rateCheck.allowed) throw new Error(rateCheck.reason)
    const validation = securityGuard.validateParams(args, tool.parameters)
    if (!validation.valid) throw new Error(validation.error)
    return securityGuard.audited(name, args, () => tool.handler(args))
  }
  private toOpenAIProps(params: Record<string, ToolParameter>): Record<string, any> {
    const props: Record<string, any> = {}
    for (const [key, def] of Object.entries(params)) {
      props[key] = {
```

---

## 2. How the agent hands tools to the model (security filtering)

```ts

  getSystemPrompt() {
    const tools = toolRegistry.getAll()
    const readTools = tools.filter(t => t.securityLevel === 'read')
    const writeTools = tools.filter(t => t.securityLevel === 'confirm')

    return `${SYSTEM_PROMPT_BASE}

Available tools (${tools.length} total):
- READ only (${readTools.length}): ${readTools.map(t => t.name).join(', ')}
- WRITE/DELETE (${writeTools.length}, require confirmation): ${writeTools.map(t => t.name).join(', ')}

Security: ${JSON.stringify(securityGuard.getStats())}`
```

---

## 3. Eval — what a scoring result looks like

```ts
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
```

---

## 4. The trigger catalogue already designed (44 entries)

```ts
  id: 'finance'
  label: 'Finance'
  id: 'transaction.created'
  label: 'Transaction created'
  id: 'transaction.updated'
  label: 'Transaction updated'
  id: 'budget.exceeded'
  label: 'Budget exceeded'
  id: 'subscription.due'
  label: 'Subscription due'
  id: 'focus'
  label: 'Focus'
  id: 'session.started'
  label: 'Focus session started'
  id: 'session.completed'
  label: 'Focus session completed'
  id: 'goals'
  label: 'Goals'
  id: 'goal.created'
  label: 'Goal created'
  id: 'goal.completed'
  label: 'Goal completed'
  id: 'goal.progress'
  label: 'Goal progress'
```

---

## 5. The Visual Builder steps that already exist

Trigger -> Condition -> Action -> Configure -> Review. Data model designed; persistence + execution missing.

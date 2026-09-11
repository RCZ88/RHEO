import type Database from 'better-sqlite3';
import { Notification, shell } from 'electron';
import crypto from 'crypto';
import { ASTNode, CompositionRule, EventPattern, SchedulePattern, ConditionClause, ActionItem, ExpressionNode, LiteralNode, IdentifierNode, EventBusEvent, ExecutionResult } from './compositionTypes';
import { lex } from './compositionLexer';
import { parse } from './compositionParser';
import { scopeCheck } from './compositionScopeChecker';
import { CompositionEventBus } from './compositionEventBus';
import { querySource, getAdapter } from './dataSourceRegistry';

export class CompositionEngine {
  private rules = new Map<string, { manifest: any; ast: ASTNode[] }>();
  private compiledCache = new Map<string, ASTNode[]>();

  constructor(
    private db: Database.Database,
    private eventBus: CompositionEventBus,
  ) {}

  loadRules(): number {
    const rows = this.db.prepare(`SELECT * FROM composition_rules WHERE enabled = 1 ORDER BY priority ASC`).all() as any[];
    let count = 0;
    for (const row of rows) {
      try {
        const tokens = lex(row.dsl_source);
        const ast = parse(tokens);
        this.rules.set(row.id, { manifest: row, ast });
        this.compiledCache.set(row.id, ast);
        count++;
      } catch (err) {
        console.error(`[Compositions] Failed to compile rule ${row.id}:`, err);
      }
    }
    return count;
  }

  reloadRule(ruleId: string): boolean {
    const row = this.db.prepare(`SELECT * FROM composition_rules WHERE id = ?`).get(ruleId) as any;
    if (!row) { this.rules.delete(ruleId); this.compiledCache.delete(ruleId); return false; }
    try {
      const tokens = lex(row.dsl_source);
      const ast = parse(tokens);
      this.rules.set(row.id, { manifest: row, ast });
      this.compiledCache.set(row.id, ast);
      return true;
    } catch {
      this.rules.delete(ruleId); this.compiledCache.delete(ruleId);
      return false;
    }
  }

  compileRule(dslSource: string) {
    const tokens = lex(dslSource);
    const ast = parse(tokens);
    return ast;
  }

  validateRule(dslSource: string, manifestId: string) {
    const ast = this.compileRule(dslSource);
    return scopeCheck(manifestId, dslSource, ast);
  }

  async evaluate(ruleId: string, context: Record<string, any> = {}): Promise<ExecutionResult[]> {
    const entry = this.rules.get(ruleId);
    if (!entry) throw new Error(`Rule ${ruleId} not found or not loaded`);

    const { manifest, ast } = entry;
    const results: ExecutionResult[] = [];

    for (const node of ast) {
      if (node.kind === 'rule') {
        const r = node as CompositionRule;

        if (r.conditions) {
          const passed = this.evaluateConditions(r.conditions, context);
          if (!passed) {
            return [{ ruleId, actionId: 'all', action: 'skip', status: 'skipped', startedAt: new Date().toISOString(), result: 'conditions not met' }];
          }
        }

        for (const item of r.actions.items) {
          try {
            const result = await this.executeAction(item, context, ruleId);
            results.push(result);
          } catch (err: any) {
            results.push({ ruleId, actionId: item.name, action: item.name, status: 'error', startedAt: new Date().toISOString(), error: err.message });
          }
        }
      }
    }

    this.logExecution(ruleId, results);
    return results;
  }

  private evaluateConditions(cc: ConditionClause, context: Record<string, any>): boolean {
    const values = cc.operands.map(op => {
      if (op.kind === 'condition') return this.evaluateConditions(op, context);
      return this.evaluateExpression(op, context);
    });

    if (cc.operator === 'not') return !values[0];
    if (cc.operator === 'or') return values.some(v => v === true);
    return values.every(v => v === true);
  }

  private evaluateExpression(node: ExpressionNode | LiteralNode | IdentifierNode, context: Record<string, any>): any {
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'identifier') {
      const { name, path } = node;
      if (path && path.length > 0) {
        const source = context[name];
        if (source && typeof source === 'object') {
          let val = source;
          for (const key of path) { if (val != null) val = (val as any)[key]; else return undefined; }
          return val;
        }
        const eventPayload = context.event?.payload;
        if (eventPayload) {
          let val = eventPayload;
          for (const key of [name, ...path]) { if (val != null) val = (val as any)[key]; else return undefined; }
          return val;
        }
        return undefined;
      }
      return context[name] ?? context.event?.payload?.[name];
    }
    if (node.kind === 'expr') {
      const left = this.evaluateExpression(node.left, context);
      const right = node.right ? this.evaluateExpression(node.right, context) : undefined;
      return this.applyOperator(node.operator, left, right);
    }
    return undefined;
  }

  private applyOperator(op: string, left: any, right: any): boolean {
    switch (op) {
      case '==':
      case '=':
      case 'eq': return left == right;
      case '!=':
      case 'neq': return left != right;
      case '>':
      case 'gt': return left > right;
      case '>=':
      case 'gte': return left >= right;
      case '<':
      case 'lt': return left < right;
      case '<=':
      case 'lte': return left <= right;
      case 'contains': return typeof left === 'string' && typeof right === 'string' ? left.includes(right) : false;
      case 'matches': return typeof left === 'string' && typeof right === 'string' ? new RegExp(right).test(left) : false;
      case 'exists': return left !== null && left !== undefined;
      case 'not_exists': return left === null || left === undefined;
      case 'not': return !left;
      case 'and': return left && right;
      case 'or': return left || right;
      default: return false;
    }
  }

  private async executeAction(item: ActionItem, context: Record<string, any>, ruleId: string): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    try {
      const resolvedParams: Record<string, any> = {};
      for (const [key, expr] of Object.entries(item.params)) {
        resolvedParams[key] = this.evaluateExpression(expr, context);
      }

      const aliases: Record<string, string> = {
        'system.notify': 'notify',
        'finance.notify': 'notify',
        'system.log': 'log',
        'app.open': 'open_link',
        'app.track': 'log',
        'app.focus': 'log',
        'system.launch': 'exec_blocked',
        'system.script': 'exec_blocked',
        'exec': 'exec_blocked',
        'finance.add': 'connector_only',
        'finance.summary': 'connector_only',
        'finance.categorize': 'connector_only',
      };
      const actionName = aliases[item.name] || item.name;

      let result: any;
      switch (actionName) {
        case 'notify': {
          const title = String(resolvedParams.title || resolvedParams.subject || 'DeskFlow Automation');
          const body = String(resolvedParams.message || resolvedParams.body || resolvedParams.text || '');
          this.eventBus.enqueue('compositions.notification', 'engine', { title, body, ...resolvedParams });
          try {
            if (typeof Notification !== 'undefined') new Notification({ title, body, silent: false }).show();
          } catch { /* notification API unavailable in this environment */ }
          result = { sent: true, title, body };
          break;
        }
        case 'log':
          console.log(`[Composition:${ruleId}] ${resolvedParams.message || ''}`, resolvedParams.data || '');
          result = { logged: true };
          break;
        case 'open_link': {
          const url = String(resolvedParams.url || resolvedParams.link || resolvedParams.href || '');
          if (url && /^https?:\/\//i.test(url)) {
            try { shell.openExternal(url); result = { opened: url }; }
            catch (e: any) { result = { error: 'open failed: ' + e?.message }; }
          } else { result = { error: 'no valid url' }; }
          break;
        }
        case 'http': {
          const url = String(resolvedParams.url || resolvedParams.endpoint || '');
          if (url) {
            const method = String(resolvedParams.method || 'POST').toUpperCase();
            const bodyArg = resolvedParams.body ? (typeof resolvedParams.body === 'string' ? resolvedParams.body : JSON.stringify(resolvedParams.body)) : undefined;
            try {
              await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: bodyArg });
              result = { http: method, url };
            } catch (e: any) { result = { error: 'http failed: ' + e?.message }; }
          } else { result = { error: 'no url' }; }
          break;
        }
        case 'query':
          result = this.executeQuery(resolvedParams);
          break;
        case 'trigger':
          this.eventBus.enqueue(resolvedParams.event || 'compositions.custom', 'engine', resolvedParams.payload || {});
          result = { triggered: true };
          break;
        case 'sleep':
          await new Promise(r => setTimeout(r, resolvedParams.ms || 1000));
          result = { slept: resolvedParams.ms || 1000 };
          break;
        case 'goal:create': {
          const title = String(resolvedParams.title || resolvedParams.name || 'Automation goal');
          const category = String(resolvedParams.category || 'work');
          const period = String(resolvedParams.period || 'daily');
          const id = crypto.randomUUID();
          this.db.prepare(
            `INSERT INTO goals (id, date, title, description, category, period, status, source, created_at)
             VALUES (?, date('now'), ?, ?, ?, ?, 'pending', 'automation', datetime('now'))`
          ).run(id, title, resolvedParams.description ? String(resolvedParams.description) : null, category, period);
          this.eventBus.enqueue('goals.goal.created', 'goals', { id, title, category });
          result = { goal_created: id };
          break;
        }
        case 'goal:complete': {
          if (resolvedParams.title) {
            this.db.prepare(
              `UPDATE goals SET status='completed', completed_at=datetime('now') WHERE title=? AND status!='completed' ORDER BY created_at DESC LIMIT 1`
            ).run(String(resolvedParams.title));
            this.eventBus.enqueue('goals.goal.completed', 'goals', { title: resolvedParams.title });
          } else if (resolvedParams.id) {
            this.db.prepare(`UPDATE goals SET status='completed', completed_at=datetime('now') WHERE id=?`).run(String(resolvedParams.id));
          }
          result = { goal_completed: true };
          break;
        }
        case 'deadline:add': {
          const title = String(resolvedParams.title || resolvedParams.name || 'Automation deadline');
          const due = String(resolvedParams.due_date || resolvedParams.due || resolvedParams.date || '');
          const id = crypto.randomUUID();
          this.db.prepare(
            `INSERT INTO deadlines (id, title, due_date, priority, status, description, created_at)
             VALUES (?, ?, ?, 'medium', 'pending', ?, datetime('now'))`
          ).run(id, title, due, resolvedParams.description ? String(resolvedParams.description) : null);
          result = { deadline_created: id };
          break;
        }
        case 'schedule:add': {
          const name2 = String(resolvedParams.title || resolvedParams.name || 'Automation schedule');
          const id = crypto.randomUUID();
          const entries = resolvedParams.entries
            ? (typeof resolvedParams.entries === 'string' ? resolvedParams.entries : JSON.stringify(resolvedParams.entries))
            : '[]';
          this.db.prepare(
            `INSERT INTO schedule_templates (id, name, entries_json, created_at) VALUES (?, ?, ?, datetime('now'))`
          ).run(id, name2, entries);
          result = { schedule_created: id };
          break;
        }
        case 'exec_blocked':
          console.warn(`[Composition] BLOCKED untrusted action '${item.name}' (system.script/system.launch not permitted)`);
          result = { blocked: true, note: 'untrusted command execution not permitted' };
          break;
        case 'connector_only':
        case 'email:send':
        case 'calendar:create':
          this.eventBus.enqueue('compositions.notification', 'engine', {
            title: 'Automation action not yet connected',
            body: `${item.name} requires an external connector that is not configured.`,
            ...resolvedParams,
          });
          result = { connector_missing: item.name };
          break;
        default:
          result = { action: item.name, params: resolvedParams, note: 'action dispatched' };
      }

      return {
        ruleId, actionId: item.name, action: item.name,
        status: 'success', startedAt, completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs, result,
      };
    } catch (err: any) {
      if (item.fallback && item.fallback.length > 0) {
        return this.executeAction(item.fallback[0], context, ruleId);
      }
      return {
        ruleId, actionId: item.name, action: item.name,
        status: 'error', startedAt, completedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs, error: err.message,
      };
    }
  }

  private executeQuery(params: Record<string, any>): any[] {
    const source = params.source || 'system';
    const table = params.table;
    const columns = params.columns || ['*'];
    const where = params.where || undefined;
    const order = params.order || undefined;
    const limit = params.limit || undefined;

    return querySource(source, {
      table, columns,
      where: where ? JSON.parse(JSON.stringify(where)) : undefined,
      orderBy: order ? { column: order, dir: 'ASC' } : undefined,
      limit,
    });
  }

  private logExecution(ruleId: string, results: ExecutionResult[]) {
    const stmt = this.db.prepare(`
      INSERT INTO composition_execution_log (rule_id, action_id, action_name, status, result, error, duration_ms, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of results) {
      stmt.run(ruleId, r.actionId, r.action, r.status, r.result ? JSON.stringify(r.result) : null, r.error || null, r.durationMs || null, r.startedAt, r.completedAt || null);
    }

    const last = results[results.length - 1];
    this.db.prepare(`
      INSERT INTO composition_execution_status (rule_id, last_status, last_error, consecutive_failures, last_run_at)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(rule_id) DO UPDATE SET
        last_status = excluded.last_status,
        last_error = excluded.last_error,
        consecutive_failures = CASE WHEN excluded.last_status = 'error' THEN consecutive_failures + 1 ELSE 0 END,
        last_run_at = excluded.last_run_at
    `).run(ruleId, last?.status || 'unknown', last?.error || null, last?.status === 'error' ? 1 : 0);
  }

  matchAndFire(event: EventBusEvent): Promise<ExecutionResult[]>[] {
    const results: Promise<ExecutionResult[]>[] = [];
    for (const [ruleId, entry] of this.rules.entries()) {
      for (const node of entry.ast) {
        if (node.kind === 'rule') {
          const rule = node as CompositionRule;
          if (rule.trigger && rule.trigger.source === event.source && rule.trigger.eventName === event.topic.split('.').pop()) {
            results.push(this.evaluate(ruleId, { event, ...event.payload }));
          }
        }
      }
    }
    return results;
  }
}

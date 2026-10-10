import { ipcMain, BrowserWindow } from 'electron';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { ensureCompositionsSchema } from './compositionSchema';
import { CompositionEngine } from './compositionEngine';
import { CompositionEventBus } from './compositionEventBus';
import { registerAdapter } from './dataSourceRegistry';
import { createFinanceAdapter } from './dataAdapterFinance';
import { createFocusAdapter } from './dataAdapterFocus';
import { createGoalsAdapter } from './dataAdapterGoals';
import { createLearningAdapter } from './dataAdapterLearning';
import { createIdeAdapter } from './dataAdapterIde';
import { createSystemAdapter } from './dataAdapterSystem';
import { lex } from './compositionLexer';
import { parse } from './compositionParser';
import { scopeCheck } from './compositionScopeChecker';
import { CompositionEngineService } from './CompositionEngineService';
import { querySource, listRegisteredSources, listAdapterEvents } from './dataSourceRegistry';

export type AiCallFn = (prompt: string, systemPrompt: string, maxTokens?: number) => Promise<string>;

const SUGGEST_SYSTEM_PROMPT = `You are the DeskFlow Composition Builder. You translate a natural-language request into ONE automation rule written in the DeskFlow Composition DSL.

DSL GRAMMAR (exactly this shape):
  ON <source>.<event> [WHEN <condition> AND <condition> ...] DO <action> [USING <key> = <value>, <key> = <value>, ...]

Rules:
- Start with "ON" then a trigger source.event.
- Optional "WHEN" introduces conditions joined by AND. Each condition is <field> <operator> <value>.
  Operators: ==, !=, >, >=, <, <=, contains, matches, exists, not_exists
  String values may be quoted. Numeric values are bare.
- "DO" is followed by an action source.action.
- Optional "USING" supplies action parameters as key = value pairs separated by commas.

AVAILABLE SOURCES + EVENTS:
- finance: finance.transaction.created, finance.transaction.updated, finance.budget.exceeded, finance.subscription.due
- focus: focus.session.started, focus.session.completed, focus.goal.reached
- system: system.boot, system.idle, system.tick
- app: app.active, app.idle

AVAILABLE ACTIONS:
- system.notify, system.launch, system.log, system.script
- app.track, app.open, app.focus
- finance.add, finance.summary, finance.categorize, finance.notify

EXAMPLE:
  ON finance.transaction.created WHEN amount > 500 DO system.notify USING message = "Large expense logged"

Constraints:
- Only use sources/events/actions listed above.
- Emit exactly ONE "ON ... DO ..." rule.
- Keep field names simple and lowercase (e.g. amount, category, merchant).

Return ONLY a JSON object (no markdown fences, no prose):
{"name": "<short title>", "description": "<one sentence>", "dsl": "<the ON ... DO ... rule>"}

If the request cannot be expressed with the available sources/events/actions, still return JSON with "dsl": "" and explain in "description".`;

function extractJson(raw: string): any | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

export class CompositionEngineManager {
  private engine: CompositionEngine;
  private eventBus: CompositionEventBus;
  private service: CompositionEngineService;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private aiCall?: AiCallFn;

  constructor(
    private db: Database.Database,
    private getMainWindow: () => BrowserWindow | null,
    aiCall?: AiCallFn,
  ) {
    ensureCompositionsSchema(db);
    this.eventBus = new CompositionEventBus();
    this.eventBus.setDb(db);
    this.engine = new CompositionEngine(db, this.eventBus);
    this.wireEventForwarding();
    this.service = new CompositionEngineService(db, this.engine, this.eventBus);
    this.registerAdapters(db);
    this.registerIpc();
    this.eventBus.startFlushTimer(10000);

    const count = this.engine.loadRules();
    console.log(`[Compositions] Loaded ${count} active rules`);
  }

  /** Activate the event→rule firing pipeline (subscribe the engine to the bus). */
  activate() {
    try { this.service.start(); } catch (err) { console.error('[CompositionEngine] activate failed', err); }
  }

  /** Publish an event onto the composition bus so matching rules fire. */
  emitEvent(topic: string, payload?: any) {
    try {
      this.eventBus.enqueue(topic, topic.split('.')[0], payload);
    } catch (err) {
      // Shutting down: the outbox DB is closed and the flush timer is stopped.
      // That is expected, not an error worth logging every tick.
      const msg = String((err as any)?.message || err);
      if (!/connection is not open|closed database/i.test(msg)) {
        console.error('[CompositionEngine] emitEvent failed', err);
      }
    }
  }

  /**
   * Forward notable composition/domain events to the renderer so the UI
   * (history panel, toasts) can reflect real executions. The engine already
   * raises desktop Notifications directly for `compositions.notification`.
   */
  private wireEventForwarding() {
    const FORWARD = new Set([
      'compositions.notification', 'compositions.log', 'compositions.query',
      'compositions.trigger', 'goals.goal.created', 'goals.goal.completed',
    ]);
    this.eventBus.subscribeAll((event) => {
      if (!FORWARD.has(event.topic)) return;
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        try {
          win.webContents.send('composition-events', {
            topic: event.topic,
            payload: event.payload,
            timestamp: event.timestamp,
          });
        } catch { /* renderer may be unavailable */ }
      }
    });
  }

  /**
   * Turn a natural-language request into a validated Composition DSL rule via the
   * configured AI provider. Returns the generated name/description/dsl plus a
   * validation report so the UI can preview before creating.
   */
  async suggest(request: string): Promise<any> {
    if (!this.aiCall) return { ok: false, error: 'No AI provider configured' };
    if (!request || !request.trim()) return { ok: false, error: 'Empty request' };
    let raw: string;
    try {
      raw = await this.aiCall(
        `User request: ${request}\n\nReturn ONLY the JSON object described.`,
        SUGGEST_SYSTEM_PROMPT,
        1200,
      );
    } catch (err: any) {
      return { ok: false, error: 'AI call failed: ' + (err?.message ?? String(err)) };
    }

    const parsed = extractJson(raw);
    const dsl = String(parsed?.dsl ?? raw).trim();
    const name = String(parsed?.name ?? 'AI Automation').trim().slice(0, 80) || 'AI Automation';
    const description = String(parsed?.description ?? request).trim();

    if (!dsl) {
      return { ok: false, name, description, dsl_source: '', validation: { valid: false, errors: [{ line: 0, col: 0, message: 'AI returned no DSL rule', code: 'no-dsl' }], warnings: [] }, raw };
    }

    const compiled = this.engine.compileRule(dsl);
    const validation = this.engine.validateRule(dsl, 'ai-suggested');
    return { ok: !!compiled.ok, name, description, dsl_source: dsl, validation, raw };
  }

  /** Validate then persist an AI-suggested (or hand-edited) composition. */
  async acceptSuggestion(data: { name: string; description: string; dsl_source: string; category?: string; enabled?: boolean }): Promise<any> {
    const result = this.create({
      name: data.name,
      description: data.description,
      dsl_source: data.dsl_source,
      enabled: data.enabled ? 1 : 0,
      priority: 500,
      category: data.category ?? 'general',
      lifecycle: 'forever',
    });
    if ((result as any)?.error) return { ok: false, error: (result as any).error };
    return { ok: true, id: (result as any)?.id };
  }

  private registerAdapters(db: Database.Database) {
    registerAdapter(createFinanceAdapter(db));
    registerAdapter(createFocusAdapter(db));
    registerAdapter(createGoalsAdapter(db));
    registerAdapter(createLearningAdapter(db));
    registerAdapter(createIdeAdapter(db));
    registerAdapter(createSystemAdapter(db));
  }

  private registerIpc() {
    ipcMain.handle('compositions:list', () => {
      return this.db.prepare('SELECT * FROM composition_rules ORDER BY priority ASC').all();
    });

    ipcMain.handle('compositions:get', (_e, id: string) => {
      return this.db.prepare('SELECT * FROM composition_rules WHERE id = ?').get(id);
    });

    ipcMain.handle('compositions:create', (_e, data: any) => {
      const id = data.id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO composition_rules (id, name, description, dsl_source, version, enabled, priority, category, lifecycle, schedule_cron, schedule_tz, metadata)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, data.name, data.description || null, data.dsl_source, data.enabled ?? 1, data.priority ?? 500, data.category || 'general', data.lifecycle || 'manual', data.schedule_cron || null, data.schedule_tz || null, data.metadata ? JSON.stringify(data.metadata) : null);

      this.db.prepare(`INSERT INTO composition_versions (rule_id, version, dsl_source, changelog) VALUES (?, 1, ?, 'initial')`)
        .run(id, data.dsl_source);

      this.engine.reloadRule(id);
      return { id };
    });

    ipcMain.handle('compositions:update', (_e, id: string, data: any) => {
      const existing = this.db.prepare('SELECT * FROM composition_rules WHERE id = ?').get(id) as any;
      if (!existing) throw new Error(`Rule ${id} not found`);

      this.db.prepare(`
        UPDATE composition_rules SET
          name = ?, description = ?, dsl_source = ?, enabled = ?, priority = ?,
          category = ?, lifecycle = ?, schedule_cron = ?, schedule_tz = ?,
          metadata = ?, version = version + 1, updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(
        data.name ?? existing.name, data.description ?? existing.description,
        data.dsl_source ?? existing.dsl_source,
        data.enabled ?? existing.enabled, data.priority ?? existing.priority,
        data.category ?? existing.category, data.lifecycle ?? existing.lifecycle,
        data.schedule_cron ?? existing.schedule_cron, data.schedule_tz ?? existing.schedule_tz,
        data.metadata ? JSON.stringify(data.metadata) : existing.metadata, id
      );

      const newVersion = (existing.version || 0) + 1;
      this.db.prepare(`INSERT INTO composition_versions (rule_id, version, dsl_source, changelog) VALUES (?, ?, ?, ?)`)
        .run(id, newVersion, data.dsl_source ?? existing.dsl_source, data.changelog || 'updated');

      this.engine.reloadRule(id);
      return { id };
    });

    ipcMain.handle('compositions:delete', (_e, id: string) => {
      this.db.prepare('DELETE FROM composition_rules WHERE id = ?').run(id);
      this.engine.reloadRule(id);
      return { deleted: true };
    });

    ipcMain.handle('compositions:compile', (_e, dslSource: string) => {
      return this.engine.compileRule(dslSource);
    });

    ipcMain.handle('compositions:validate', (_e, dslSource: string, manifestId: string) => {
      return this.engine.validateRule(dslSource, manifestId);
    });

    ipcMain.handle('compositions:evaluate', async (_e, ruleId: string, context?: any) => {
      return await this.engine.evaluate(ruleId, context || {});
    });

    ipcMain.handle('compositions:history', (_e, ruleId?: string, limit = 50) => {
      if (ruleId) {
        return this.db.prepare('SELECT * FROM composition_execution_log WHERE rule_id = ? ORDER BY started_at DESC LIMIT ?').all(ruleId, limit);
      }
      return this.db.prepare('SELECT * FROM composition_execution_log ORDER BY started_at DESC LIMIT ?').all(limit);
    });

    ipcMain.handle('compositions:status', (_e, ruleId?: string) => {
      if (ruleId) {
        return this.db.prepare('SELECT * FROM composition_execution_status WHERE rule_id = ?').get(ruleId);
      }
      return this.db.prepare('SELECT * FROM composition_execution_status').all();
    });

    ipcMain.handle('compositions:settings:get', (_e, key: string) => {
      const row = this.db.prepare('SELECT value FROM composition_settings WHERE key = ?').get(key) as any;
      return row ? row.value : null;
    });

    ipcMain.handle('compositions:settings:set', (_e, key: string, value: string) => {
      this.db.prepare('INSERT OR REPLACE INTO composition_settings (key, value) VALUES (?, ?)').run(key, value);
      return { key, value };
    });

    ipcMain.handle('compositions:list-events', () => {
      const sources = listRegisteredSources();
      const events: Record<string, string[]> = {};
      for (const s of sources) {
        events[s] = listAdapterEvents(s);
      }
      return events;
    });

    ipcMain.handle('compositions:enqueue-event', (_e, topic: string, source: string, payload: any) => {
      this.eventBus.enqueue(topic, source, payload);
      return { enqueued: true };
    });

    ipcMain.handle('compositions:suggest', async (_e, request: string) => {
      return await this.suggest(request);
    });

    ipcMain.handle('compositions:accept-suggestion', async (_e, data: any) => {
      return await this.acceptSuggestion(data);
    });
  }

  pushState() {
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('compositions:state', {
        ruleCount: this.db.prepare('SELECT COUNT(*) as c FROM composition_rules').get() as any,
      });
    }
  }

  destroy() {
    this.eventBus.destroy();
  }
}

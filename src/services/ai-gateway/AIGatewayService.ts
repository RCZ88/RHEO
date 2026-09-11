// ============================================================================
// AI Gateway — AIGatewayService: orchestrator (spec §2, §5)
// - Lazy BrowserManager: constructing this service NEVER launches browsers or
//   requires playwright. All browser work happens on explicit user actions.
// - Per-provider serialization (single session limitation, spec risk table).
// - Rate limiting + run logging. DB handle optional (in-memory fallback).
// - Never throws across the IPC boundary: all public methods return
//   { success, ... } envelopes.
// ============================================================================
import * as path from 'path';
import { PROVIDER_ADAPTERS, getAdapter } from './providers';
import type {
  ProviderAdapter, ProviderStatusReport, SendPromptOptions,
  SendPromptResult, GatewayProviderStatus,
} from './types';
import { CredentialVault } from './CredentialVault';
import { BrowserManager } from './BrowserManager';
import { waitForCompletion, probeChatInput, extractResponse } from './CompletionDetector';
import { resolveSelector, humanType, humanSubmit } from './HumanSimulator';

export interface GatewayServiceOpts {
  dataDir: string;
  db?: any;
  broadcast?: (event: string, payload?: any) => void;
  openExternal?: (url: string) => void;
}

interface QueueItem {
  opts: SendPromptOptions;
  resolve: (v: any) => void;
  startedAt: number;
}

export class AIGatewayService {
  private dir: string;
  private db: any;
  private broadcast: (event: string, payload?: any) => void;
  private openExternal: ((url: string) => void) | null;
  private vault: CredentialVault;
  private browsers: BrowserManager;
  private queues = new Map<string, QueueItem[]>();
  private busy = new Set<string>();
  private lastSentAt = new Map<string, number>();
  private disabled = new Set<string>();
  private lastError = new Map<string, string | null>();
  private sentToday = new Map<string, { day: string; count: number }>();

  constructor(opts: GatewayServiceOpts) {
    this.dir = opts.dataDir;
    this.db = opts.db || null;
    this.broadcast = opts.broadcast || (() => {});
    this.openExternal = opts.openExternal || null;
    this.vault = new CredentialVault(path.join(this.dir, 'vault'));
    this.browsers = new BrowserManager(this.dir);
    this.loadDisabledFromDb();
  }

  // ── providers ──────────────────────────────────────────────────────────
  listProviders(): ProviderAdapter[] {
    return PROVIDER_ADAPTERS;
  }

  setProviderDisabled(providerId: string, disabled: boolean): { success: boolean } {
    if (!getAdapter(providerId)) return { success: false };
    if (disabled) this.disabled.add(providerId); else this.disabled.delete(providerId);
    try {
      this.db?.prepare(`INSERT INTO aigateway_providers (provider_id, disabled, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(provider_id) DO UPDATE SET disabled = excluded.disabled, updated_at = CURRENT_TIMESTAMP`)
        .run(providerId, disabled ? 1 : 0);
    } catch {}
    return { success: true };
  }

  private loadDisabledFromDb(): void {
    try {
      const rows = this.db?.prepare('SELECT provider_id FROM aigateway_providers WHERE disabled = 1').all() as any[];
      for (const r of rows || []) this.disabled.add(r.provider_id);
    } catch {}
  }

  playwrightStatus(): { available: boolean; error: string | null } {
    try { return this.browsers.availability(); } catch (e: any) {
      return { available: false, error: e?.message || 'unknown' };
    }
  }

  status(providerId: string): { success: boolean; data?: ProviderStatusReport; error?: string } {
    const adapter = getAdapter(providerId);
    if (!adapter) return { success: false, error: 'Unknown provider: ' + providerId };
    const pw = this.playwrightStatus();
    const entry = safeGet(() => this.vault.get(providerId));
    const today = dayKey();
    const sent = this.sentToday.get(providerId);
    const sentCount = sent && sent.day === today ? sent.count : 0;
    let st: GatewayProviderStatus;
    if (!pw.available) st = 'unavailable';
    else if (this.disabled.has(providerId)) st = 'disabled';
    else if (this.busy.has(providerId)) st = 'authenticating';
    else if (entry?.isValid) st = this.queueDepth(providerId) > 0 ? 'authenticating' : 'ready';
    else st = 'needs_setup';
    const lastErr = this.lastError.get(providerId) || null;
    if (lastErr && st === 'ready') st = 'error';
    return {
      success: true,
      data: {
        provider: providerId,
        status: st,
        sessionValid: !!entry?.isValid,
        browserRunning: this.browsers.isRunning(providerId),
        playwrightAvailable: pw.available,
        lastUsedAt: entry?.lastUsedAt ? new Date(entry.lastUsedAt).toISOString() : this.dbLastUsed(providerId),
        requestsRemaining: adapter.dailyBudget != null ? Math.max(0, adapter.dailyBudget - sentCount) : null,
        queueDepth: this.queueDepth(providerId),
        lastError: lastErr,
      },
    };
  }

  allStatuses(): ProviderStatusReport[] {
    return PROVIDER_ADAPTERS.map((a) => this.status(a.id).data as ProviderStatusReport);
  }

  private queueDepth(providerId: string): number {
    return this.queues.get(providerId)?.length || 0;
  }

  private dbLastUsed(providerId: string): string | null {
    try {
      const r = this.db?.prepare('SELECT MAX(created_at) AS ts FROM aigateway_runs WHERE provider = ?').get(providerId) as any;
      return r?.ts || null;
    } catch { return null; }
  }

  // ── setup (human-in-the-loop, spec §4.1/§4.4) ───────────────────────────
  /** Open the provider login in the automated browser window (or system browser fallback). */
  async setupProvider(providerId: string): Promise<{ success: boolean; mode?: string; url?: string; error?: string }> {
    const adapter = getAdapter(providerId);
    if (!adapter) return { success: false, error: 'Unknown provider' };
    if (this.disabled.has(providerId)) return { success: false, error: 'Provider is disabled' };
    const pw = this.playwrightStatus();
    if (!pw.available) {
      // Fallback: open login in system browser; session import stays manual.
      try { this.openExternal?.(adapter.loginUrl); } catch {}
      return { success: true, mode: 'external', url: adapter.loginUrl };
    }
    try {
      const entry = safeGet(() => this.vault.get(providerId));
      await this.browsers.launch(adapter, { url: adapter.loginUrl, storageState: entry?.storageState });
      this.broadcast('aigateway:provider-status', { provider: providerId, status: 'authenticating' });
      return { success: true, mode: 'window', url: adapter.loginUrl };
    } catch (e: any) {
      this.lastError.set(providerId, e?.message || 'launch failed');
      return { success: false, error: e?.message || 'launch failed' };
    }
  }

  /** Verify the chat input is present (= logged in), then persist the session. */
  async verifySetup(providerId: string): Promise<{ success: boolean; sessionValid?: boolean; error?: string }> {
    const adapter = getAdapter(providerId);
    if (!adapter) return { success: false, error: 'Unknown provider' };
    const page = this.browsers.getPage(providerId);
    if (!page) return { success: false, error: 'Setup window is not open — click Setup first' };
    try {
      try { await page.goto(adapter.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch {}
      await new Promise((r) => setTimeout(r, 2500));
      const ok = await probeChatInput(page, adapter.input.selector);
      const storageState = await this.browsers.exportStorageState(providerId);
      this.vault.touch(providerId, {
        lastValidatedAt: Date.now(), isValid: ok, failureCount: ok ? 0 : undefined as any,
        ...(storageState ? { storageState } : {}),
      });
      try {
        this.db?.prepare(`INSERT INTO aigateway_sessions (provider_id, is_valid, last_validated_at, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(provider_id) DO UPDATE SET is_valid = excluded.is_valid,
            last_validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`)
          .run(providerId, ok ? 1 : 0);
      } catch {}
      this.lastError.set(providerId, ok ? null : 'Login not detected — complete login in the browser window, then Verify again');
      this.broadcast('aigateway:provider-status', { provider: providerId, status: ok ? 'ready' : 'needs_setup' });
      return ok
        ? { success: true, sessionValid: true }
        : { success: false, sessionValid: false, error: 'Login not detected yet. Finish logging in inside the opened browser window, then press Verify again.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'verify failed' };
    }
  }

  async closeProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
    try { await this.browsers.close(providerId); return { success: true }; }
    catch (e: any) { return { success: false, error: e?.message }; }
  }

  async clearConversation(providerId: string): Promise<{ success: boolean; error?: string }> {
    const adapter = getAdapter(providerId);
    if (!adapter) return { success: false, error: 'Unknown provider' };
    const page = this.browsers.getPage(providerId);
    if (!page) return { success: false, error: 'Browser window is not open' };
    try {
      await page.goto(adapter.newChatUrl || adapter.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { success: true };
    } catch (e: any) { return { success: false, error: e?.message }; }
  }

  async logoutProvider(providerId: string): Promise<{ success: boolean }> {
    try { await this.browsers.close(providerId); } catch {}
    try { this.vault.remove(providerId); } catch {}
    try { this.db?.prepare('DELETE FROM aigateway_sessions WHERE provider_id = ?').run(providerId); } catch {}
    this.lastError.set(providerId, null);
    this.broadcast('aigateway:provider-status', { provider: providerId, status: 'needs_setup' });
    return { success: true };
  }

  // ── send_prompt (MCP tool §5.2) ────────────────────────────────────────
  sendPrompt(opts: SendPromptOptions): Promise<{ success: boolean; data?: SendPromptResult; error?: string }> {
    const adapter = getAdapter(opts.provider);
    if (!adapter) return Promise.resolve({ success: false, error: 'Unknown provider' });
    if (!opts.prompt || !opts.prompt.trim()) return Promise.resolve({ success: false, error: 'Prompt is empty' });
    return new Promise((resolve) => {
      const q = this.queues.get(opts.provider) || [];
      q.push({ opts, resolve, startedAt: Date.now() });
      this.queues.set(opts.provider, q);
      void this.pump(opts.provider);
    });
  }

  private async pump(providerId: string): Promise<void> {
    if (this.busy.has(providerId)) return;
    const q = this.queues.get(providerId);
    if (!q || q.length === 0) return;
    const adapter = getAdapter(providerId)!;
    const item = q.shift()!;
    this.busy.add(providerId);
    try {
      const out = await this.executePrompt(adapter, item.opts);
      item.resolve(out);
    } catch (e: any) {
      item.resolve({ success: false, error: e?.message || 'send failed' });
    } finally {
      this.busy.delete(providerId);
      this.broadcast('aigateway:provider-status', { provider: providerId });
      if ((this.queues.get(providerId)?.length || 0) > 0) void this.pump(providerId);
    }
  }

  private async executePrompt(
    adapter: ProviderAdapter, opts: SendPromptOptions,
  ): Promise<{ success: boolean; data?: SendPromptResult; error?: string }> {
    const t0 = Date.now();
    const log = (status: 'ok' | 'error', extra: any = {}) => {
      try {
        this.db?.prepare(`INSERT INTO aigateway_runs
          (provider, prompt_len, response_len, duration_ms, detection_strategy, status, error)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(adapter.id, opts.prompt.length, extra.responseLength || 0,
            Date.now() - t0, extra.strategy || null, status, extra.error || null);
      } catch {}
    };
    const bumpSent = () => {
      const day = dayKey();
      const cur = this.sentToday.get(adapter.id);
      this.sentToday.set(adapter.id, { day, count: (cur && cur.day === day ? cur.count : 0) + 1 });
    };

    // Cooldown (rate limiting, spec §3.1).
    const since = Date.now() - (this.lastSentAt.get(adapter.id) || 0);
    if (since < adapter.rateLimit.cooldownMs) {
      await new Promise((r) => setTimeout(r, adapter.rateLimit.cooldownMs - since));
    }

    let page = this.browsers.getPage(adapter.id);
    if (!page || isClosed(page)) {
      const entry = safeGet(() => this.vault.get(adapter.id));
      if (!entry?.isValid) {
        const err = 'No valid session — run Setup & Verify first';
        log('error', { error: err });
        return { success: false, error: err };
      }
      try {
        const r = await this.browsers.launch(adapter, { url: adapter.url, storageState: entry.storageState });
        page = r.page;
      } catch (e: any) {
        log('error', { error: e?.message });
        this.lastError.set(adapter.id, e?.message || 'browser launch failed');
        return { success: false, error: e?.message || 'browser launch failed' };
      }
    }

    try {
      // Navigate to chat home (keeps conversation continuity inside provider).
      try { await page.goto(adapter.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch {}
      await new Promise((r) => setTimeout(r, 1500));

      const inputSel = await resolveSelector(page, adapter.input.selector);
      if (!inputSel) {
        // Session may have expired → flag for re-auth (spec §4.3 graceful degradation).
        this.vault.touch(adapter.id, { isValid: false, failureCount: ((safeGet(() => this.vault.get(adapter.id))?.failureCount) || 0) + 1 });
        this.broadcast('aigateway:session-expired', { provider: adapter.id, reason: 'input_not_found' });
        const err = 'Chat input not found — session may have expired. Re-run Setup & Verify.';
        log('error', { error: err });
        return { success: false, error: err };
      }

      if (adapter.input.clearInput) {
        try {
          await page.click(inputSel, { timeout: 8000 });
          await page.evaluate((s: string) => {
            try {
              const el = document.querySelector(s) as HTMLElement | null;
              if (el && (el as any).isContentEditable) { el.focus(); document.execCommand('selectAll', false); }
            } catch {}
          }, inputSel);
          await page.keyboard.press('Backspace').catch(() => {});
        } catch {}
      }

      await humanType(page, inputSel, opts.prompt);
      await humanSubmit(page, adapter.input.submitMethod, adapter.input.submitButtonSelector, adapter.input.preSubmitDelay);

      const outcome = await waitForCompletion(page, adapter, { timeoutMs: opts.timeoutMs });
      const text = outcome.text || (await extractResponse(page, adapter.response.containerSelector));
      this.lastSentAt.set(adapter.id, Date.now());
      bumpSent();
      this.vault.touch(adapter.id, { lastUsedAt: Date.now() });
      // Refresh persisted storage state (cookies rotate).
      try {
        const ss = await this.browsers.exportStorageState(adapter.id);
        if (ss) this.vault.touch(adapter.id, { storageState: ss });
      } catch {}

      if (!outcome.complete && !text) {
        const err = 'Timed out waiting for a response';
        log('error', { error: err, strategy: outcome.strategy });
        return { success: false, error: err };
      }
      this.lastError.set(adapter.id, null);
      log('ok', { responseLength: text.length, strategy: outcome.strategy });
      const data: SendPromptResult = {
        text, provider: adapter.id,
        durationMs: Date.now() - t0,
        completionStrategy: outcome.strategy,
        conversationId: null,
      };
      return { success: true, data };
    } catch (e: any) {
      const err = e?.message || 'send failed';
      this.lastError.set(adapter.id, err);
      log('error', { error: err });
      return { success: false, error: err };
    }
  }

  recentRuns(provider: string, limit = 20): any[] {
    try {
      return this.db?.prepare('SELECT * FROM aigateway_runs WHERE provider = ? ORDER BY id DESC LIMIT ?').all(provider, limit) || [];
    } catch { return []; }
  }

  async shutdown(): Promise<void> {
    try { await this.browsers.shutdown(); } catch {}
  }
}

function isClosed(page: any): boolean {
  try { return !!page.isClosed?.(); } catch { return true; }
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeGet<T>(fn: () => T): T | undefined {
  try { return fn(); } catch { return undefined; }
}

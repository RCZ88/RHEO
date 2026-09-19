import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import type Database from 'better-sqlite3';
import { ensureFocusSchema } from './focusSchema';

type CompositionEmitter = (topic: string, payload?: any) => void;
let compositionEmitter: CompositionEmitter | null = null;

/** main.ts wires this to the Composition engine so focus events can fire rules. */
export function setCompositionEmitter(fn: CompositionEmitter | null) { compositionEmitter = fn; }

function emitCompositionEvent(topic: string, payload?: any) {
  try { compositionEmitter?.(topic, payload); } catch {}
}

export type Tier = 'productive' | 'neutral' | 'distracting';
export type Strictness = 'distracting' | 'non_allowed';

export interface FocusConfig {
  durationSec: number;
  strictness?: Strictness;
  allowed?: { apps?: string[]; domains?: string[]; tiers?: Tier[]; categories?: string[] };
}

interface FocusState {
  active: boolean; sessionId: number | null;
  startedAt: number | null; endsAt: number | null;
  strictness: Strictness;
  allowed: { apps: string[]; domains: string[]; tiers: Tier[]; categories: string[] };
  returnCount: number; paused: boolean;
}

export class FocusManager {
  private state: FocusState = this.idle();
  private overlay: BrowserWindow | null = null;
  private endTimer: NodeJS.Timeout | null = null;
  private current: { type: 'app' | 'website'; name: string } | null = null;
  private overlayHideTimer: NodeJS.Timeout | null = null;

  constructor(
    private db: Database.Database,
    private getMainWindow: () => BrowserWindow | null,
    private classifyApp: (appName: string, category?: string) => Tier,
    private classifyDomain: (domain: string) => Tier,
    private token: string,
  ) {
    ensureFocusSchema(db);
    this.registerIpc();
  }

  private idle(): FocusState {
    return { active: false, sessionId: null, startedAt: null, endsAt: null,
      strictness: 'distracting',
      allowed: { apps: [], domains: [], tiers: ['productive', 'neutral'], categories: [] },
      returnCount: 0, paused: false };
  }

  getPublicState() {
    return {
      active: this.state.active,
      endsAt: this.state.endsAt,
      strictness: this.state.strictness,
      remainingSec: this.state.endsAt
        ? Math.max(0, Math.round((this.state.endsAt - Date.now()) / 1000))
        : 0,
      paused: this.state.paused,
      outcome: this.state.active ? 'active' : null,
      id: this.state.sessionId,
      allowed_json: JSON.stringify(this.state.allowed),
      broke_on_type: null,
      broke_on_name: null,
      startedAt: this.state.startedAt,
    };
  }

  getActiveSessionId(): number | null {
    return this.state.active ? this.state.sessionId : null;
  }

  verifyToken(t?: string | string[]) {
    const v = Array.isArray(t) ? t[0] : t;
    return !!v && v === this.token;
  }

  start(cfg: FocusConfig) {
    if (this.state.active) this.end('aborted', 'restart');
    const now = Date.now();
    const strictness = cfg.strictness ?? 'distracting';
    const isStopwatch = cfg.durationSec === 0;
    const allowed = {
      apps: cfg.allowed?.apps ?? [],
      domains: cfg.allowed?.domains ?? [],
      tiers: cfg.allowed?.tiers ?? (strictness === 'non_allowed' ? ['productive'] : ['productive', 'neutral']) as Tier[],
      categories: cfg.allowed?.categories ?? [],
    };
    const info = this.db.prepare(
      `INSERT INTO deep_focus_sessions (started_at, planned_sec, outcome, strictness, allowed_json)
       VALUES (?, ?, 'active', ?, ?)`
    ).run(new Date(now).toISOString(), cfg.durationSec, strictness, JSON.stringify(allowed));
    this.state = {
      active: true, sessionId: Number(info.lastInsertRowid),
      startedAt: now,
      endsAt: isStopwatch ? null : now + cfg.durationSec * 1000,
      strictness, allowed, returnCount: 0, paused: false,
    };
    // Only set auto-complete timer for countdown mode (durationSec > 0)
    // Stopwatch mode has no auto-completion — user ends manually
    if (!isStopwatch && cfg.durationSec > 0) {
      this.endTimer = setTimeout(() => this.complete(), cfg.durationSec * 1000);
    }
    console.log('[focus] start', { id: this.state.sessionId, durationSec: cfg.durationSec, strictness, isStopwatch });
    emitCompositionEvent('focus.session.started', { id: this.state.sessionId, strictness, durationSec: cfg.durationSec });
    this.pushState();
    return this.getPublicState();
  }

  private isAllowed(tier: Tier, name: string, kind: 'app' | 'website', category?: string) {
    const a = this.state.allowed;
    if (kind === 'app' && a.apps.includes(name)) return true;
    if (kind === 'website') {
      // Normalize: strip www. prefix + lowercase so extension's "youtube.com"
      // matches group's "www.youtube.com" (or vice versa). Case-insensitive.
      const norm = name.toLowerCase().replace(/^www\./, '');
      if (a.domains.some(d => d.toLowerCase().replace(/^www\./, '') === norm)) return true;
    }
    const hasExplicit = a.apps.length > 0 || a.domains.length > 0;
    if (this.state.strictness === 'non_allowed') {
      // STRICT: exact whitelist only — the category buffer is BLOCKED here.
      // A group session (explicit list present) allows ONLY its exact apps/sites.
      if (hasExplicit) return false;
      return a.tiers.includes(tier); // plain session (no group): productive tier only
    }
    // LENIENT: the category buffer is tolerated alongside the exact list.
    if (a.categories.length > 0) return !!category && a.categories.includes(category);
    return tier !== 'distracting'; // plain session (no buffer): blocks distracting only
  }

  onForegroundApp(appName: string, category?: string) {
    if (!this.state.active || this.state.paused) return;
    const tier = this.classifyApp(appName, category);
    if (this.isAllowed(tier, appName, 'app', category)) {
      // Only hide overlay if no pending hide timer (user just returned)
      if (!this.overlayHideTimer) this.hideOverlay();
      return;
    }
    // Clear any pending hide timer — new distraction overrides
    if (this.overlayHideTimer) { clearTimeout(this.overlayHideTimer); this.overlayHideTimer = null; }
    this.current = { type: 'app', name: appName };
    this.logEvent('distraction_shown', 'app', appName);
    console.log('[focus] app distraction', appName, tier);
    this.showOverlay({ type: 'app', name: appName, tier });
  }

  onWebActivity(domain: string) {
    if (!this.state.active || this.state.paused) return { overlay: false };
    const tier = this.classifyDomain(domain);
    if (this.isAllowed(tier, domain, 'website')) {
      if (!this.overlayHideTimer) this.hideOverlay();
      return { overlay: false };
    }
    if (this.overlayHideTimer) { clearTimeout(this.overlayHideTimer); this.overlayHideTimer = null; }
    this.current = { type: 'website', name: domain };
    this.logEvent('distraction_shown', 'website', domain);
    console.log('[focus] web distraction', domain, tier);
    this.showOverlay({ type: 'website', name: domain, tier });
    return { overlay: true, endsAt: this.state.endsAt, domain };
  }

  breakFocus(source: 'app' | 'website', name: string) {
    if (!this.state.active) return;
    this.logEvent('broke', source, name);
    console.log('[focus] BROKE', source, name);
    this.end('failed', `${source}:${name}`);
  }

  returnToFocus() {
    if (!this.state.active) return;
    this.state.returnCount++;
    this.logEvent('returned', this.current?.type, this.current?.name);
    console.log('[focus] returned', this.current);
    // Keep overlay visible for 2s after returning so user sees the confirmation
    if (this.overlayHideTimer) clearTimeout(this.overlayHideTimer);
    this.overlayHideTimer = setTimeout(() => {
      this.hideOverlay();
      this.refocusMain();
    }, 2000);
  }

  private complete() { this.end('completed', null); }

  end(outcome: 'completed' | 'failed' | 'aborted', reason: string | null) {
    if (!this.state.active) return;
    const now = Date.now();
    const actualSec = this.state.startedAt ? Math.round((now - this.state.startedAt) / 1000) : 0;
    const [bt, bn] = reason && reason.includes(':') ? reason.split(':') : [null, null];
    this.db.prepare(
      `UPDATE deep_focus_sessions SET ended_at=?, actual_sec=?, outcome=?, broke_on_type=?, broke_on_name=?, return_count=? WHERE id=?`
    ).run(new Date(now).toISOString(), actualSec, outcome,
          outcome === 'failed' ? bt : null, outcome === 'failed' ? bn : null,
          this.state.returnCount, this.state.sessionId);
    this.logEvent(outcome === 'completed' ? 'completed' : 'aborted');
    if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; }
    if (this.overlayHideTimer) { clearTimeout(this.overlayHideTimer); this.overlayHideTimer = null; }
    console.log('[focus] end', { outcome, actualSec, reason });
    this.hideOverlay();
    const id = this.state.sessionId;
    emitCompositionEvent(outcome === 'failed' ? 'focus.session.broken' : 'focus.session.ended', { id, outcome, reason, actualSec });

    // Fire a human-centric notification when a focus session completes successfully
    if (outcome === 'completed' && this.getMainWindow()) {
      try {
        const { notificationsFocusDone } = require('../../main/notifications');
        const goalLabel = this.state.strictness === 'non_allowed' ? 'Deep Focus session' : 'Focus session';
        notificationsFocusDone(this.db, goalLabel, actualSec);
      } catch {}
    }

    this.state = this.idle();
    this.pushState();
    this.getMainWindow()?.webContents.send('focus:ended', { outcome, reason, id });
  }

  private showOverlay(payload: { type: 'app' | 'website'; name: string; tier: Tier }) {
    const display = screen.getPrimaryDisplay();
    const isLinux = process.platform === 'linux';
    if (!this.overlay) {
      const overlayPreloadPath = path.join(__dirname, '..', '..', 'resources', 'focus', 'overlayPreload.cjs');
      const overlayHtmlPath = path.join(__dirname, '..', '..', 'resources', 'focus', 'overlay.html');
      this.overlay = new BrowserWindow({
        ...display.bounds, frame: false, resizable: false,
        // Linux/Wayland compositors often render transparent fullscreen windows as
        // opaque black or refuse them outright — use opaque there, transparent elsewhere.
        transparent: !isLinux,
        movable: false, skipTaskbar: true, alwaysOnTop: true,
        fullscreenable: false, focusable: true,
        // 'screen-saver' level is macOS/Windows-only; on Linux use a normal
        // always-on-top window so the compositor actually raises it.
        webPreferences: {
          preload: overlayPreloadPath,
          contextIsolation: true, nodeIntegration: false,
        },
      });
      try {
        this.overlay.setAlwaysOnTop(true, isLinux ? 'pop-up-menu' : 'screen-saver');
      } catch { this.overlay.setAlwaysOnTop(true); }
      try {
        this.overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      } catch { /* not supported on this compositor — overlay stays on current workspace */ }
      this.overlay.loadFile(overlayHtmlPath).catch((e) =>
        console.error('[focus] overlay loadFile failed:', overlayHtmlPath, e?.message));
      this.overlay.on('closed', () => { this.overlay = null; });
    }
    const send = () => this.overlay?.webContents.send('focus:overlay-data', { ...payload, endsAt: this.state.endsAt });
    if (this.overlay.webContents.isLoading())
      this.overlay.webContents.once('did-finish-load', send);
    else send();
    this.overlay.show();
    try {
      this.overlay.setAlwaysOnTop(true, process.platform === 'linux' ? 'pop-up-menu' : 'screen-saver');
    } catch { this.overlay.setAlwaysOnTop(true); }
    this.overlay.focus();
    emitCompositionEvent('focus.overlay.shown', payload);
  }

  private hideOverlay() { if (this.overlay?.isVisible()) this.overlay.hide(); this.current = null; }
  private refocusMain() { const mw = this.getMainWindow(); mw?.show(); mw?.focus(); }

  private logEvent(kind: string, t?: string | null, n?: string | null) {
    if (!this.state.sessionId) return;
    this.db.prepare(
      `INSERT INTO deep_focus_events (session_id, ts, kind, target_type, target_name) VALUES (?, ?, ?, ?, ?)`
    ).run(this.state.sessionId, new Date().toISOString(), kind, t ?? null, n ?? null);
  }

  private pushState() { this.getMainWindow()?.webContents.send('focus:state', this.getPublicState()); }

  getGoalConfig() {
    const row = this.db.prepare('SELECT * FROM focus_goal_config WHERE id = 1').get() as
      | { lenient_goal_sec: number; strict_goal_sec: number; updated_at: string | null }
      | undefined;
    return {
      lenient_goal_sec: row?.lenient_goal_sec ?? 0,
      strict_goal_sec: row?.strict_goal_sec ?? 0,
      updated_at: row?.updated_at ?? null,
    };
  }

  saveGoalConfig(cfg: { lenient_goal_sec?: number; strict_goal_sec?: number }) {
    const current = this.getGoalConfig();
    const lenient = Math.max(0, Math.round(Number(cfg?.lenient_goal_sec ?? current.lenient_goal_sec) || 0));
    const strict = Math.max(0, Math.round(Number(cfg?.strict_goal_sec ?? current.strict_goal_sec) || 0));
    this.db.prepare(
      `INSERT INTO focus_goal_config (id, lenient_goal_sec, strict_goal_sec, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET lenient_goal_sec = excluded.lenient_goal_sec,
         strict_goal_sec = excluded.strict_goal_sec, updated_at = excluded.updated_at`
    ).run(lenient, strict, new Date().toISOString());
    return this.getGoalConfig();
  }

  private registerIpc() {
    ipcMain.handle('focus:start', (_e, cfg: FocusConfig) => this.start(cfg));
    ipcMain.handle('focus:end', (_e, outcome?: 'aborted') => { this.end(outcome ?? 'aborted', 'user'); });
    ipcMain.handle('focus:get-state', () => this.getPublicState());
    ipcMain.handle('focus:history', (_e, opts?: { limit?: number }) =>
      this.db.prepare(`SELECT * FROM deep_focus_sessions ORDER BY started_at DESC LIMIT ?`).all(opts?.limit ?? 50));
    ipcMain.handle('focusGoal:get', () => this.getGoalConfig());
    ipcMain.handle('focusGoal:save', (_e, cfg: { lenient_goal_sec?: number; strict_goal_sec?: number }) =>
      this.saveGoalConfig(cfg));
    ipcMain.on('focus:overlay-return', () => this.returnToFocus());
    ipcMain.on('focus:overlay-break', () =>
      this.breakFocus(this.current?.type ?? 'app', this.current?.name ?? 'unknown'));
  }
}

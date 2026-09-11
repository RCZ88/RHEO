<aside>
🎯

**Build packet for the "Focus Session + Soft-Block Overlay" feature.** Part 1 is the kickoff prompt to relay to your coding agent (opencode). Part 2 is the drafted code — new files + exact edits to existing files. The code is the *Architect's draft*: the agent should adapt it to the real extension + confirm the CONFIRM items, not blind-paste.

</aside>

## How to use this packet

1. Relay **Part 1** to your coding agent to kick it off.
2. The agent confirms the 3 CONFIRM items (extension manifest, existing `focus_sessions` schema, the browser-server port variable).
3. Then it implements **Part 2** file-by-file in the build order at the end.

---

# Part 1 — Kickoff prompt for the coding agent

```
ROLE: You are the implementation agent ("Hands & Eyes") for DeskFlow, a Windows Electron + React (Tailwind v4, local-first) productivity tracker. The Architect has drafted a full spec + code for a new feature. Adapt and wire it into the real codebase; do not blind-paste.

FEATURE: "Deep Focus" sessions with a soft-block accountability overlay.
- User starts a focus session with a chosen duration + strictness.
- While active, if the user opens a DISTRACTING app or website, an overlay covers it: "You're in a focus session (mm:ss left). Continuing will break it." with [Back to focus] (default) and [Break focus — end session].
- "Break focus" ends the session as FAILED and logs what broke it. Timer reaching 0 = COMPLETED.
- Full session history (planned vs actual duration, outcome, what broke it).
- This is a SOFT / honor-system overlay, NOT enforcement (no process killing, no firewall). Say so in the UI.

WHAT ALREADY EXISTS (reuse, do not rebuild):
- Real-time foreground app detection via active-win -> 'foreground-changed' event (main.ts ~3565/3593).
- Tier system (productive/neutral/distracting) for apps: categorizeApp -> tier (main.ts ~1781-1786) and for domains: set-domain-tier / get-domain-* handlers (main.ts ~4486+).
- A local HTTP server the browser extension already talks to (main.ts ~14554, listens on browserServerPort ~14682) that forwards 'browser-tracking-event'. The extension already knows this base URL/port.
- A focus_sessions table name is referenced (main.ts ~4150) and productivity-session IPC (preload.ts ~145-149).

CONFIRM BACK TO THE ARCHITECT BEFORE CODING:
1. Paste the browser extension's manifest.json + background/service-worker + content script(s), and the exact base URL/port the extension uses to reach the app.
2. Paste the current schema of the existing `focus_sessions` table (PRAGMA table_info) so we don't collide — the draft uses a NEW table `deep_focus_sessions` to be safe; confirm that's fine or reconcile.
3. Confirm the variable/env for `browserServerPort` and whether it's fixed or random per run.

HARD CONSTRAINTS:
- Keep contextIsolation:true, nodeIntegration:false on every window incl. the overlay (use a preload).
- SECURITY: the browser server currently listens with NO host arg (main.ts ~14682) = all interfaces. Rebind to '127.0.0.1' and gate the new control endpoints with the X-DeskFlow-Token header (token provisioned to the extension via DeskFlow Settings, reusing the existing pairing-code pattern). Do not add permissive CORS.
- Tailwind v4 only (no postcss/autoprefixer). Match the existing dark/glass UI.
- Rigorous logging on every state transition (start/return/break/complete/abort) — the user wants deterministic, inspectable behavior.
- Follow the domain-module layout: put main-process code under electron/domains/focus/.

DELIVERABLES: implement the files in Part 2 in the stated build order; open a PR per band (main-process core, overlay window, HTTP endpoints + security, preload+renderer UI, extension). After the main-process bands, ping the Architect to review before the extension band.
```

---

# Part 2 — Drafted code & edits

> Paths assume TypeScript source that compiles to the shipped `main.ts`. If your source is already the monolithic `main.ts`, place the new modules alongside and `import` them; the CONFIRM step will settle this.
> 

## 2.1 — New: `electron/domains/focus/focusSchema.ts`

Uses a **new** table (`deep_focus_sessions`) so it can't clobber any existing `focus_sessions`.

```tsx
import type Database from 'better-sqlite3';

export function ensureFocusSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deep_focus_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at    TEXT NOT NULL,
      ended_at      TEXT,
      planned_sec   INTEGER NOT NULL,
      actual_sec    INTEGER,
      outcome       TEXT NOT NULL DEFAULT 'active',   -- active | completed | failed | aborted
      strictness    TEXT NOT NULL DEFAULT 'distracting', -- 'distracting' | 'non_allowed'
      broke_on_type TEXT,   -- 'app' | 'website'
      broke_on_name TEXT,
      return_count  INTEGER NOT NULL DEFAULT 0,
      allowed_json  TEXT,   -- { apps:[], domains:[], tiers:[] }
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_dfs_started ON deep_focus_sessions(started_at);

    CREATE TABLE IF NOT EXISTS deep_focus_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES deep_focus_sessions(id) ON DELETE CASCADE,
      ts          TEXT NOT NULL,
      kind        TEXT NOT NULL,   -- distraction_shown | returned | broke | completed | aborted
      target_type TEXT,            -- 'app' | 'website'
      target_name TEXT
    );
  `);
}
```

## 2.2 — New: `electron/domains/focus/focusManager.ts`

The state machine. Constructor takes adapters onto your existing tier logic so it reuses your categorization.

```tsx
import { BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import type Database from 'better-sqlite3';
import { ensureFocusSchema } from './focusSchema';

export type Tier = 'productive' | 'neutral' | 'distracting';
export type Strictness = 'distracting' | 'non_allowed';

export interface FocusConfig {
  durationSec: number;
  strictness?: Strictness;
  allowed?: { apps?: string[]; domains?: string[]; tiers?: Tier[] };
}

interface FocusState {
  active: boolean; sessionId: number | null;
  startedAt: number | null; endsAt: number | null;
  strictness: Strictness;
  allowed: { apps: string[]; domains: string[]; tiers: Tier[] };
  returnCount: number; paused: boolean;
}

export class FocusManager {
  private state: FocusState = this.idle();
  private overlay: BrowserWindow | null = null;
  private endTimer: NodeJS.Timeout | null = null;
  private current: { type: 'app' | 'website'; name: string } | null = null;

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
      allowed: { apps: [], domains: [], tiers: ['productive', 'neutral'] },
      returnCount: 0, paused: false };
  }

  getPublicState() {
    return {
      active: this.state.active,
      endsAt: this.state.endsAt,
      strictness: this.state.strictness,
      remainingSec: this.state.endsAt ? Math.max(0, Math.round((this.state.endsAt - Date.now()) / 1000)) : 0,
      paused: this.state.paused,
    };
  }

  verifyToken(t?: string | string[]) {
    const v = Array.isArray(t) ? t[0] : t;
    return !!v && v === this.token;
  }

  start(cfg: FocusConfig) {
    if (this.state.active) this.end('aborted', 'restart');
    const now = Date.now();
    const strictness = cfg.strictness ?? 'distracting';
    const allowed = {
      apps: cfg.allowed?.apps ?? [],
      domains: cfg.allowed?.domains ?? [],
      tiers: cfg.allowed?.tiers ?? ['productive', 'neutral'] as Tier[],
    };
    const info = this.db.prepare(
      `INSERT INTO deep_focus_sessions (started_at, planned_sec, outcome, strictness, allowed_json)
       VALUES (?, ?, 'active', ?, ?)`
    ).run(new Date(now).toISOString(), cfg.durationSec, strictness, JSON.stringify(allowed));
    this.state = { active: true, sessionId: Number(info.lastInsertRowid),
      startedAt: now, endsAt: now + cfg.durationSec * 1000,
      strictness, allowed, returnCount: 0, paused: false };
    this.endTimer = setTimeout(() => this.complete(), cfg.durationSec * 1000);
    console.log('[focus] start', { id: this.state.sessionId, durationSec: cfg.durationSec, strictness });
    this.pushState();
    return this.getPublicState();
  }

  private isAllowed(tier: Tier, name: string, kind: 'app' | 'website') {
    const a = this.state.allowed;
    if (kind === 'app' && a.apps.includes(name)) return true;
    if (kind === 'website' && a.domains.includes(name)) return true;
    if (this.state.strictness === 'non_allowed') return a.tiers.includes(tier);
    return tier !== 'distracting'; // 'distracting' strictness: only distracting triggers
  }

  /** Hook this into the existing 'foreground-changed' emit site. */
  onForegroundApp(appName: string, category?: string) {
    if (!this.state.active || this.state.paused) return;
    const tier = this.classifyApp(appName, category);
    if (this.isAllowed(tier, appName, 'app')) { this.hideOverlay(); return; }
    this.current = { type: 'app', name: appName };
    this.logEvent('distraction_shown', 'app', appName);
    console.log('[focus] app distraction', appName, tier);
    this.showOverlay({ type: 'app', name: appName, tier });
  }

  /** Called by the HTTP server when the extension reports the active tab domain. */
  onWebActivity(domain: string) {
    if (!this.state.active || this.state.paused) return { overlay: false };
    const tier = this.classifyDomain(domain);
    if (this.isAllowed(tier, domain, 'website')) return { overlay: false };
    this.current = { type: 'website', name: domain };
    this.logEvent('distraction_shown', 'website', domain);
    console.log('[focus] web distraction', domain, tier);
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
    this.hideOverlay();
    this.refocusMain();
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
    console.log('[focus] end', { outcome, actualSec, reason });
    this.hideOverlay();
    const id = this.state.sessionId;
    this.state = this.idle();
    this.pushState();
    this.getMainWindow()?.webContents.send('focus:ended', { outcome, reason, id });
  }

  // ---- overlay window ----
  private showOverlay(payload: { type: 'app' | 'website'; name: string; tier: Tier }) {
    const display = screen.getPrimaryDisplay();
    if (!this.overlay) {
      this.overlay = new BrowserWindow({
        ...display.bounds, frame: false, transparent: true, resizable: false,
        movable: false, skipTaskbar: true, alwaysOnTop: true,
        fullscreenable: false, focusable: true,
        webPreferences: {
          preload: path.join(__dirname, 'overlayPreload.js'),
          contextIsolation: true, nodeIntegration: false,
        },
      });
      this.overlay.setAlwaysOnTop(true, 'screen-saver');
      this.overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.overlay.loadFile(path.join(__dirname, 'overlay.html'));
      this.overlay.on('closed', () => { this.overlay = null; });
    }
    const send = () => this.overlay?.webContents.send('focus:overlay-data', { ...payload, endsAt: this.state.endsAt });
    if (this.overlay.webContents.isLoading())
      this.overlay.webContents.once('did-finish-load', send);
    else send();
    this.overlay.show();
    this.overlay.setAlwaysOnTop(true, 'screen-saver');
    this.overlay.focus();
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

  private registerIpc() {
    ipcMain.handle('focus:start', (_e, cfg: FocusConfig) => this.start(cfg));
    ipcMain.handle('focus:end', (_e, outcome?: 'aborted') => { this.end(outcome ?? 'aborted', 'user'); });
    ipcMain.handle('focus:get-state', () => this.getPublicState());
    ipcMain.handle('focus:history', (_e, opts?: { limit?: number }) =>
      this.db.prepare(`SELECT * FROM deep_focus_sessions ORDER BY started_at DESC LIMIT ?`).all(opts?.limit ?? 50));
    ipcMain.on('focus:overlay-return', () => this.returnToFocus());
    ipcMain.on('focus:overlay-break', () =>
      this.breakFocus(this.current?.type ?? 'app', this.current?.name ?? 'unknown'));
  }
}
```

## 2.3 — New: `electron/domains/focus/overlayPreload.js`

```jsx
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('focusOverlay', {
  onData: (cb) => ipcRenderer.on('focus:overlay-data', (_e, d) => cb(d)),
  return: () => ipcRenderer.send('focus:overlay-return'),
  break: () => ipcRenderer.send('focus:overlay-break'),
});
```

## 2.4 — New: `electron/domains/focus/overlay.html`

Self-contained (no bundler). Dark glass, countdown, two buttons.

```html
<!doctype html>
<html><head><meta charset="utf-8" /><style>
  html,body{margin:0;height:100%;font-family:Inter,system-ui,sans-serif;overflow:hidden}
  body{display:grid;place-items:center;background:rgba(9,9,11,0.72);backdrop-filter:blur(14px);color:#fafafa}
  .card{width:min(560px,86vw);padding:40px;border-radius:24px;text-align:center;
    background:rgba(24,24,27,0.85);border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 80px rgba(0,0,0,.5)}
  .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a1a1aa}
  h1{font-size:26px;margin:14px 0 6px}
  .name{color:#f472b6;font-weight:600}
  .timer{font-variant-numeric:tabular-nums;font-size:40px;font-weight:700;margin:18px 0}
  p{color:#d4d4d8;margin:0 0 26px;line-height:1.5}
  .row{display:flex;gap:12px;justify-content:center}
  button{border:0;border-radius:12px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer}
  .back{background:#6366f1;color:#fff}
  .break{background:transparent;color:#a1a1aa;border:1px solid rgba(255,255,255,.15)}
  .hint{margin-top:18px;font-size:11px;color:#71717a}
</style></head><body>
  <div class="card">
    <div class="eyebrow">Deep Focus</div>
    <h1>Opening <span class="name" id="name">this</span> will break your focus.</h1>
    <div class="timer" id="timer">--:--</div>
    <p>You set this time aside to focus. Continuing marks this session as <b>failed</b>.</p>
    <div class="row">
      <button class="back" id="back">Back to focus</button>
      <button class="break" id="brk">Break focus &amp; continue</button>
    </div>
    <div class="hint">This is a reminder, not a lock — your choice is logged.</div>
  </div>
  <script>
    let endsAt = null;
    const fmt = (s)=>{s=Math.max(0,s|0);return String((s/60)|0).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
    function tick(){ if(endsAt) document.getElementById('timer').textContent = fmt((endsAt-Date.now())/1000); }
    window.focusOverlay.onData(d=>{ document.getElementById('name').textContent=d.name; endsAt=d.endsAt; tick(); });
    setInterval(tick,1000);
    document.getElementById('back').onclick=()=>window.focusOverlay.return();
    document.getElementById('brk').onclick=()=>window.focusOverlay.break();
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') window.focusOverlay.return(); });
  </script>
</body></html>
```

## 2.5 — EDIT `main.ts`: instantiate + wire foreground + HTTP endpoints + security

**(a) Instantiate** after the DB and `mainWindow` exist (and after your tier helpers are defined):

```tsx
import { FocusManager } from './electron/domains/focus/focusManager';
import crypto from 'crypto';

// Reuse existing pairing token if you have one; otherwise generate + persist in settings.
const focusToken = getOrCreateFocusToken(); // store in your settings table; expose in Settings UI
const focusManager = new FocusManager(
  db,
  () => mainWindow,
  // adapt to your real helpers:
  (appName, category) => categorizeToTier(appName, category),   // main.ts ~1781-1786
  (domain) => getDomainTier(domain),                            // from set/get-domain-tier handlers ~4486
  focusToken,
);
```

**(b) Wire the foreground signal.** At the existing `foreground-changed` emit site (main.ts ~3565 / ~3593), add:

```tsx
focusManager.onForegroundApp(appName, resolved?.category);
```

**(c) SECURITY fix + endpoints** in the browser server (main.ts ~14554–14682).

Rebind to loopback:

```tsx
// BEFORE:  server.listen(browserServerPort, () => { ... })
server.listen(browserServerPort, '127.0.0.1', () => {
  console.log('[DeskFlow] browser server on 127.0.0.1:' + browserServerPort);
});
```

Add routes inside the request handler (token-gated):

```tsx
const tok = req.headers['x-deskflow-token'];

if (req.method === 'GET' && req.url && req.url.startsWith('/focus-state')) {
  if (!focusManager.verifyToken(tok)) { res.writeHead(403); return res.end('{}'); }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(focusManager.getPublicState()));
}

if (req.method === 'POST' && req.url === '/focus-web-activity') {
  if (!focusManager.verifyToken(tok)) { res.writeHead(403); return res.end('{}'); }
  let body = ''; req.on('data', c => body += c);
  return req.on('end', () => {
    try {
      const { domain } = JSON.parse(body || '{}');
      const r = focusManager.onWebActivity(String(domain || ''));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r));
    } catch { res.writeHead(400); res.end('{}'); }
  });
}

if (req.method === 'POST' && req.url === '/focus-break') {
  if (!focusManager.verifyToken(tok)) { res.writeHead(403); return res.end('{}'); }
  let body = ''; req.on('data', c => body += c);
  return req.on('end', () => {
    try {
      const { domain } = JSON.parse(body || '{}');
      focusManager.breakFocus('website', String(domain || 'unknown'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch { res.writeHead(400); res.end('{}'); }
  });
}
```

## 2.6 — EDIT `preload.ts`: expose the focus API

```tsx
focus: {
  start: (cfg) => ipcRenderer.invoke('focus:start', cfg),
  end: (outcome) => ipcRenderer.invoke('focus:end', outcome),
  getState: () => ipcRenderer.invoke('focus:get-state'),
  history: (opts) => ipcRenderer.invoke('focus:history', opts),
  onState: (cb) => { const h = (_e, s) => cb(s); ipcRenderer.on('focus:state', h); return () => ipcRenderer.removeListener('focus:state', h); },
  onEnded: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('focus:ended', h); return () => ipcRenderer.removeListener('focus:ended', h); },
},
```

## 2.7 — New renderer: `src/hooks/useFocusSession.ts`

```tsx
import { useEffect, useState, useCallback } from 'react';
const api = (window as any).deskflowAPI.focus;

export interface FocusPublicState { active: boolean; endsAt: number | null; remainingSec: number; strictness: string; paused: boolean; }

export function useFocusSession() {
  const [state, setState] = useState<FocusPublicState | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const refreshHistory = useCallback(async () => setHistory(await api.history({ limit: 50 })), []);

  useEffect(() => {
    api.getState().then(setState);
    const offS = api.onState(setState);
    const offE = api.onEnded(() => { api.getState().then(setState); refreshHistory(); });
    refreshHistory();
    return () => { offS?.(); offE?.(); };
  }, [refreshHistory]);

  const start = useCallback((durationSec: number, strictness: 'distracting' | 'non_allowed' = 'distracting') =>
    api.start({ durationSec, strictness }).then(setState), []);
  const stop = useCallback(() => api.end('aborted').then(() => api.getState().then(setState)), []);

  return { state, history, start, stop, refreshHistory };
}
```

## 2.8 — New renderer: `src/components/focus/FocusSessionCard.tsx`

Drop into the Dashboard (replaces/augments the existing focus card). Tailwind v4.

```tsx
import { useState } from 'react';
import { useFocusSession } from '../../hooks/useFocusSession';

const PRESETS = [25, 50, 90];
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function FocusSessionCard() {
  const { state, history, start, stop } = useFocusSession();
  const [mins, setMins] = useState(25);
  const [strict, setStrict] = useState<'distracting' | 'non_allowed'>('distracting');
  const active = state?.active;

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-200">Deep Focus</h3>
        {active && <span className="text-xs text-emerald-400">Active</span>}
      </div>

      {active ? (
        <div className="text-center">
          <div className="text-4xl font-bold tabular-nums text-white">{fmt(state!.remainingSec)}</div>
          <p className="text-xs text-zinc-500 mt-1">Distracting {state!.strictness === 'non_allowed' ? '& neutral ' : ''}apps/sites will prompt you.</p>
          <button onClick={stop} className="mt-4 text-xs px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800">End session</button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2 mb-3">
            {PRESETS.map(p => (
              <button key={p} onClick={() => setMins(p)}
                className={`flex-1 py-2 rounded-lg text-sm ${mins === p ? 'bg-indigo-500 text-white' : 'bg-zinc-800/60 text-zinc-400'}`}>{p}m</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
            <input type="checkbox" checked={strict === 'non_allowed'} onChange={e => setStrict(e.target.checked ? 'non_allowed' : 'distracting')} />
            Strict (also block neutral — only productive allowed)
          </label>
          <button onClick={() => start(mins * 60, strict)}
            className="w-full py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400">
            Start {mins}-min focus
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-5 border-t border-zinc-800/60 pt-3 space-y-1.5">
          {history.slice(0, 5).map(h => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">{new Date(h.started_at).toLocaleDateString()} · {Math.round((h.planned_sec) / 60)}m</span>
              <span className={h.outcome === 'completed' ? 'text-emerald-400' : h.outcome === 'failed' ? 'text-rose-400' : 'text-zinc-500'}>
                {h.outcome === 'failed' ? `broke on ${h.broke_on_name ?? '?'}` : h.outcome}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 2.9 — Extension: content script `focusOverlay.js` (NEW)

Injects a full-page overlay; does not modify the site. Adapt import/registration to your extension.

```jsx
(() => {
  let shown = false;
  function domain() { return location.hostname.replace(/^www\./, ''); }

  function showOverlay() {
    if (shown) return; shown = true;
    const el = document.createElement('div');
    el.id = '__deskflow_focus_overlay';
    el.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;background:rgba(9,9,11,.82);
        backdrop-filter:blur(12px);display:grid;place-items:center;font-family:system-ui,sans-serif;color:#fff">
        <div style="width:min(520px,86vw);padding:36px;border-radius:22px;text-align:center;
          background:rgba(24,24,27,.9);border:1px solid rgba(255,255,255,.08)">
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a1a1aa">Deep Focus</div>
          <h1 style="font-size:24px;margin:12px 0 6px">Continuing on <span style="color:#f472b6">${domain()}</span> will break your focus.</h1>
          <p style="color:#d4d4d8;margin:0 0 24px">This site is marked distracting. Continuing marks the session <b>failed</b>.</p>
          <div style="display:flex;gap:12px;justify-content:center">
            <button id="__df_back" style="border:0;border-radius:12px;padding:13px 20px;font-weight:600;background:#6366f1;color:#fff;cursor:pointer">Go back</button>
            <button id="__df_break" style="border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:13px 20px;font-weight:600;background:transparent;color:#a1a1aa;cursor:pointer">Break focus &amp; continue</button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(el);
    document.getElementById('__df_back').onclick = () => { history.length > 1 ? history.back() : window.close(); };
    document.getElementById('__df_break').onclick = () => {
      chrome.runtime.sendMessage({ type: 'FOCUS_BREAK', domain: domain() });
      hideOverlay();
    };
  }
  function hideOverlay() { const e = document.getElementById('__deskflow_focus_overlay'); if (e) e.remove(); shown = false; }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'FOCUS_SHOW') showOverlay();
    if (msg?.type === 'FOCUS_HIDE') hideOverlay();
  });
  // Ask background on load / SPA navigation.
  const ping = () => chrome.runtime.sendMessage({ type: 'FOCUS_CHECK', domain: domain() });
  ping();
  let last = location.href;
  new MutationObserver(() => { if (location.href !== last) { last = location.href; hideOverlay(); ping(); } })
    .observe(document, { subtree: true, childList: true });
})();
```

## 2.10 — Extension: background/service-worker additions (NEW)

```jsx
// CONFIRM: reuse the exact base URL/port the extension already uses to reach the app.
const BASE = 'http://127.0.0.1:' + (self.DESKFLOW_PORT || 'CONFIRM_PORT');
let TOKEN = ''; // load from chrome.storage; user pastes it from DeskFlow Settings -> Focus
chrome.storage.local.get('deskflowToken', (v) => { TOKEN = v.deskflowToken || ''; });

async function post(path, body) {
  return fetch(BASE + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-DeskFlow-Token': TOKEN }, body: JSON.stringify(body) })
    .then(r => r.ok ? r.json() : null).catch(() => null);
}

async function checkTab(tabId, domain) {
  const r = await post('/focus-web-activity', { domain });
  if (r && r.overlay) chrome.tabs.sendMessage(tabId, { type: 'FOCUS_SHOW' });
  else chrome.tabs.sendMessage(tabId, { type: 'FOCUS_HIDE' });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'FOCUS_CHECK' && sender.tab) checkTab(sender.tab.id, msg.domain);
  if (msg?.type === 'FOCUS_BREAK') post('/focus-break', { domain: msg.domain });
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const t = await chrome.tabs.get(tabId);
  if (t.url) checkTab(tabId, new URL(t.url).hostname.replace(/^www\./, ''));
});
chrome.tabs.onUpdated.addListener((tabId, info, t) => {
  if (info.status === 'complete' && t.url && t.url.startsWith('http'))
    checkTab(tabId, new URL(t.url).hostname.replace(/^www\./, ''));
});
```

## 2.11 — Extension: `manifest.json` (MERGE these keys)

```json
{
  "permissions": ["tabs", "storage"],
  "host_permissions": ["http://127.0.0.1/*", "http://localhost/*"],
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["focusOverlay.js"], "run_at": "document_idle" }
  ],
  "background": { "service_worker": "background.js" }
}
```

---

# Build order (PR per band)

1. **Core (main):** `focusSchema.ts` + `focusManager.ts`, instantiate in `main.ts`, wire `onForegroundApp` at the foreground emit site. Verify start/complete/abort + history via logs. *(No overlay yet.)*
2. **Overlay window:** `overlay.html` + `overlayPreload.js`; app-side overlay on distracting app. Test alt-tab into Discord/YouTube-app.
3. **HTTP endpoints + SECURITY:** rebind `127.0.0.1`, add token + `/focus-state`, `/focus-web-activity`, `/focus-break`. Add token to Settings UI.
4. **Renderer UI:** `useFocusSession` + `FocusSessionCard` into Dashboard; live countdown + history.
5. **Extension:** content script + background + manifest; token paste in options. Test on a distracting site.

# Open decisions for CZ

- **Neutral apps under “Strict”:** default is neutral allowed; Strict = only productive. OK?
- **Grace period:** none by default (overlay is instant). Want a few-seconds tolerance before it appears?
- **Return vs break wording** on the overlay — current copy is “Back to focus” / “Break focus & continue.”
- **Token provisioning:** copy-paste from Settings (simplest) vs reuse the existing pairing-code flow (nicer). Draft assumes copy-paste.
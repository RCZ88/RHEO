# CONTEXT_BUNDLE.md — Desktop focus → phone link (publish + consume)

Target AI: you are implementing **inside the App Tracker Electron desktop app**
repo (`C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker`). The phone side
(Expo Android) and the sync server are **already built** — your job is the two
missing desktop halves. All source below is verbatim from the repo, with exact
paths and line numbers. CRLF line endings — preserve them, no mass-reformat.

## 1. What already exists (do not rebuild)

- Phone polls `GET /v1/focus/state` every ~30s and shields blocked apps natively.
- Phone reports return/break via `POST /v1/focus/event` → stored as
  `deep_focus_events` KV rows (`value_json` holds the full event).
- Sync server routes `/v1/focus/publish|state|event` are live (§7).
- Desktop `SyncAgent` pushes/pulls every ~20s via `syncAgent.sync()` (§5).
- Desktop `FocusManager` owns sessions, strictness, allowed lists (§2–§3).

## 2. `src/domains/focus/focusManager.ts` — the session owner

```ts
// lines 7-15: composition hook (EXISTS but nothing subscribes — see §6 task A)
type CompositionEmitter = (topic: string, payload?: any) => void;
let compositionEmitter: CompositionEmitter | null = null;

/** main.ts wires this to the Composition engine so focus events can fire rules. */
export function setCompositionEmitter(fn: CompositionEmitter | null) { compositionEmitter = fn; }

function emitCompositionEvent(topic: string, payload?: any) {
  try { compositionEmitter?.(topic, payload); } catch {}
}
```

```ts
// lines 17-24
export type Tier = 'productive' | 'neutral' | 'distracting';
export type Strictness = 'distracting' | 'non_allowed';

export interface FocusConfig {
  durationSec: number;
  strictness?: Strictness;
  allowed?: { apps?: string[]; domains?: string[]; tiers?: Tier[]; categories?: string[] };
}
```

```ts
// lines 59-75: the public snapshot — EVERYTHING the phone needs is here
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
    id: this.state.sessionId,                       // INTEGER (better-sqlite3 rowid)
    allowed_json: JSON.stringify(this.state.allowed), // { apps, domains, tiers, categories }
    broke_on_type: null,
    broke_on_name: null,
    startedAt: this.state.startedAt,                 // ms epoch
  };
}
```

```ts
// lines 86-116: start() — note what it returns and what it emits
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
  if (!isStopwatch && cfg.durationSec > 0) {
    this.endTimer = setTimeout(() => this.complete(), cfg.durationSec * 1000);
  }
  console.log('[focus] start', { id: this.state.sessionId, durationSec: cfg.durationSec, strictness, isStopwatch });
  emitCompositionEvent('focus.session.started', { id: this.state.sessionId, strictness, durationSec: cfg.durationSec });
  this.pushState();
  return this.getPublicState();
}
```

```ts
// lines 192-222: end() — ALL terminations funnel here (complete/failed/aborted)
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
  // ... notification block omitted (lines 210-217, untouched) ...
  this.state = this.idle();
  this.pushState();
  this.getMainWindow()?.webContents.send('focus:ended', { outcome, reason, id });
}
```

```ts
// lines 289-301: FocusManager registers its own IPC — focus:start/focus:end
// ALREADY EXIST here, do not duplicate in main.ts
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
```

Also relevant (verbatim signatures, bodies unchanged):
- `breakFocus(source, name)` (lines 170-175): logs `broke`, calls `this.end('failed', ...)`
- `returnToFocus()` (lines 177-188): increments `returnCount`, hides overlay after 2s
- `getActiveSessionId(): number | null` (lines 77-79)

## 3. `src/domains/focus/focusSchema.ts` — tables (verbatim, all guarded)

`deep_focus_sessions(id INTEGER PK, started_at, ended_at, planned_sec,
actual_sec, outcome, strictness, broke_on_type, broke_on_name, return_count,
allowed_json, created_at)`, `deep_focus_events(id INTEGER PK, session_id INTEGER
REFERENCES deep_focus_sessions(id) ON DELETE CASCADE, ts, kind, target_type,
target_name)`, `focus_groups(id, name, description, allowed_apps/domains/
categories JSON-TEXT, strictness, default_duration, daily_goal_sec,
goal_category, created_at, updated_at)`, `focus_group_usage(group_id,
session_id, goal_ids, used_at, PK(group_id, session_id))`,
`focus_goal_config(id CHECK(id=1), lenient_goal_sec, strict_goal_sec, updated_at)`.
Full SQL in `src/domains/focus/focusSchema.ts` lines 1-88.

## 4. `src/main.ts` — where sessions start + where sync lives

```ts
// line 54
import { SyncAgent } from "./main/syncAgent";
// lines 4436-4438
let syncUrl = process.env.SYNC_URL || "http://127.0.0.1:8787";
let getSyncTokenForRelay: (() => Promise<string>) | null = null;
let syncAgent: InstanceType<typeof SyncAgent> | null = null;
// lines 4441-4486: authStore-backed token manager; _getSyncTokenDeduped()
// refreshes via POST ${syncUrl}/v1/auth/refresh, persists via saveAuth().
// getSyncTokenForRelay = _getSyncTokenDeduped. Returns "" when unpaired.
// line 4505 (inside startSyncAgent(), 20s interval calling syncAgent.sync())
syncAgent = new SyncAgent(db, syncUrl, getSyncTokenForRelay, undefined, undefined, fetch, encKey);
```

```ts
// line 5333: construction site (classifyApp/classifyDomain closures above it)
focusManager = new FocusManager(db!, () => mainWindow, classifyApp, classifyDomain, focusToken);
// lines ~5371-5386: group session entry — focusManager.start(cfg) returns getPublicState()
electron_1.ipcMain.handle('focusGroup:startWith', (_e, id: number, durationSec?: number, strictness?: string) => {
    try {
        const cfg = focusGroupManager.toConfig(Number(id), ...);
        if (!cfg) return { success: false, error: 'Focus group not found' };
        const state = focusManager ? focusManager.start(cfg) : null;
        ...
        const sessionId = focusManager?.getActiveSessionId?.() ?? null;
        if (sessionId != null) focusGroupManager.recordUsage(Number(id), sessionId);
        return { success: true, state, sessionId };
```

`focusGroup:startWithMany` follows the same shape (merged config, same
`focusManager.start()` call). Plain (non-group) sessions enter via the
`focus:start` IPC inside FocusManager itself (§2).

## 5. `src/main/syncAgent.ts` — full source (242 lines, verbatim)

```ts
// lines 1-30 (header + types)
import type Database from "better-sqlite3"
import crypto from "crypto"
type Fetcher = typeof fetch
interface SyncChange { table: string; row: Record<string, unknown> }
interface SyncPushResponse { applied: number; cursor?: number }
interface SyncPullResponse { changes: Record<string, SyncChange[]>; cursor: number }
// lines 32-50: defaultEncrypt/defaultDecrypt (AES-256-GCM, iv:tag:ct base64)
// lines 52-78: class SyncAgent { cursor; syncKey; tables;
//   constructor(db, baseUrl, getAccessToken, encryptField?, decryptField?, fetcher = fetch, keyMaterial?)
//   tables = ["terminal_sessions", "terminal_messages", "workspace_problems", "workspace_requests"] }
// lines 80-85: authHeaders() → { content-type, authorization: *** ${await this.getAccessToken()}` }
// lines 93-157: push() — SELECTs local rows newer than cursor (unixepoch compare),
//   encrypts terminal content, POSTs ${baseUrl}/v1/sync/push, advances cursor.
// lines 160-229: pull() — GETs ${baseUrl}/v1/sync/pull?since=${cursor}, merges
//   terminal_sessions/messages/problems/requests in ONE better-sqlite3
//   transaction (upserts LWW / INSERT OR IGNORE), advances cursor.
// lines 232-236: sync() = push() then pull(). getCursor() diagnostics.
```

(Full verbatim bodies: read `src/main/syncAgent.ts` lines 1-242 before editing.
Note: desktop pull() currently merges ONLY the 4 tables above — `deep_focus_events`
is NOT consumed anywhere. `phone_kv` does NOT exist on desktop.)

## 6. Server contract — `/v1/focus/*` (live on the sync server, verbatim shapes)

```
POST /v1/focus/publish  (auth: device Bearer)
  { active: true, sessionId?: string(≤128), strictness?: "distracting"|"non_allowed",
    allowedApps?: string[≤500], allowedDomains?: string[≤500],
    startedAt?: string, endsAt?: string|null }
  { active: false }                              → clears the row
  → { ok: true, active: bool }

GET /v1/focus/state  (auth)
  → { active: false, serverTime }  (also when countdown expired)
  → { active: true, sessionId, strictness, allowedApps[], allowedDomains[],
      startedAt, endsAt, updatedAt, serverTime }

POST /v1/focus/event  (auth)
  { kind: "returned"|"broke", sessionId: string(≤128), origin: "phone"|"desktop",
    packageName?: string, ts?: string }
  → { ok: true, id }   (stored as deep_focus_events KV row)
```

Phone→desktop event envelope in `deep_focus_events.value_json` (verbatim):
```json
{ "id": "<uuid>", "session_id": "<desktop sessionId echoed back>",
  "origin": "phone", "ts": "<iso>", "kind": "returned|broke",
  "target_type": "app", "target_name": "<android package>" }
```

Matching rule: desktop live id is INTEGER (`getActiveSessionId()`); the phone
echoes the `sessionId` string the desktop published. Compare with
`String(liveId) === String(event.session_id)`. Ignore events with
`origin !== "phone"`, events for dead sessions, and duplicates (track handled
event uuids in-memory — pull repeats rows until the cursor advances past them).

## 7. Strictness semantics (locked — do not reinterpret)

- Groups are PURE allowed-set containers (`allowed_apps/domains/categories`).
- `non_allowed` (strict / "super-focus") + explicit list = EXACT whitelist only.
  This is the mode that arms the phone shield.
- `distracting` (lenient) = blocks distracting tier only; phone does NOT shield.
- Per-mode daily goals live in `focus_goal_config`, NOT in groups.

## 8. Repo hard rules for this task

- Multi-agent protocol: register + `status` + `claim` BEFORE edits via
  `agent/docs/feature-docs/deskflow-multi-agent-coordination/agent-coordination/coord.mjs`.
  **Known tool bug:** `coord.mjs main()` never fires when the repo path contains
  a space (it compares a raw argv path against a URL-encoded `import.meta.url`).
  Workaround — import it as a library:
  ```js
  import { pathToFileURL } from 'node:url';
  const coord = await import(pathToFileURL('<abs path>/coord.mjs').href);
  coord.register('<id>', '<task>'); coord.getState();
  coord.claim('<id>', ['src/main/syncAgent.ts', 'src/main.ts']); coord.done('<id>');
  ```
- better-sqlite3 is single-writer; your changes are HTTP-only (no desktop DB
  writes except the existing pull transaction) — no db-guard needed, but never
  run the app while building and never run two app instances.
- Surgical edits. No `git add -A`, no force-push, no destructive git.
- Files are CRLF — preserve line endings.
- `src/domains/focus/*.ts` compile PER-FILE via `scripts/build.mjs` Step 3
  (esbuild, NO --bundle). Full build `node scripts/build.mjs` (~5min), then
  `npx tsc -p tsconfig.app.json`-equivalent per repo convention.
- Console stamps: `[focus-phone] publish ...` / `[focus-phone] event ...` so the
  user can verify in the main console without guessing.

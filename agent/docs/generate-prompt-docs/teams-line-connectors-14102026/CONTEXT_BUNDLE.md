# CONTEXT_BUNDLE — Teams + LINE Messaging Connectors

**Date:** 2026-10-14
**Target:** Lead Designer & Engineer for connector subsystem
**Repo root:** `/home/clementzhao/dev/rheo`

This bundle is self-contained. You do not need to read the codebase to design
the solution. Every code block below is the **actual current source**.

---

## 1. THE USER'S VERBATIM REQUEST

> https://learn.microsoft.com/en-us/microsoftteams/platform/teams-sdk/essentials/api?tabs=legacy%2Ccore&pivots=typescript
> https://developers.line.biz/en/services/messaging-api/
> i would like to integrate this into my connector, figure out how to
> pulling both data

---

## 2. THE CORE ARCHITECTURAL FINDING (read this first)

The existing connector subsystem is **pull-only**. Both platforms you want to
add are **push-first**. This is the single most important fact in this bundle and
every design decision follows from it.

| | Existing (IMAP / CalDAV) | LINE Messaging API | Teams |
|---|---|---|---|
| Direction | You **poll** them | They **POST to you** | They **POST to you** |
| Transport | Direct TCP/HTTP out | HTTPS webhook **inbound** | HTTPS webhook **inbound** (Bot Framework) |
| Endpoint needed | none | Public HTTPS URL | Public HTTPS URL + Azure AD app + Bot registration |
| Works on `localhost`? | Yes | **No** | **No** |

**Consequence:** an Electron app listening on `127.0.0.1` cannot receive either
webhook. Some tunnel (Cloudflare Tunnel, ngrok, Tailscale Funnel, dev tunnels)
or a small always-on relay is **required**. This is not optional and cannot be
designed around.

### 2a. Existing local HTTP servers (the hook point for a webhook receiver)

There is already precedent for listening sockets in the main process, so a
webhook receiver is not architecturally alien to this codebase.

`src/main.ts:5668`
```ts
let browserServerPort = 54321;
```

`src/main.ts:6750` (browser tracking HTTP server)
```ts
const server = http_1.default.createServer((req, res) => {
```

`src/main.ts:21941` (second local server)
```ts
const server = http_1.default.createServer((req, res) => {
```

`src/main.ts:6837` (production renderer server — NOTE: the renderer itself is
served here; per project rules this directory is the running application and
must never be deleted or rebuilt by an agent)
```ts
startProdServer(FIXED_PROD_PORT, (port) => {
```

---

## 3. CURRENT TYPES — `src/types/connectors.ts` (full file, verbatim)

```ts
export interface ConnectorConfig {
  id: string;
  type: 'email' | 'calendar';
  provider: 'imap' | 'caldav';
  displayName: string;
  config: ImapConfig | CalDavConfig;
  status: 'connected' | 'error' | 'disconnected';
  lastSync?: string;
  errorMessage?: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  folder?: string;
}

export interface CalDavConfig {
  url: string;
  username: string;
  password: string;
  calendarName?: string;
}

export interface ConnectorItem {
  id: string;
  connectorId: string;
  itemType: 'email' | 'event' | 'reminder';
  subject?: string;
  summary?: string;
  date: string;
  read: boolean;
  metadata?: Record<string, any>;
}

export interface ConnectorTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ConnectorSyncResult {
  success: boolean;
  itemsAdded: number;
  itemsUpdated: number;
  error?: string;
}
```

### 3a. Why these types block the feature

1. `type: 'email' | 'calendar'` — **a messaging platform is neither.** There is
   no value to add Teams or LINE to. A third axis (`'messaging'`) is required.
2. `provider: 'imap' | 'caldav'` — needs `'line' | 'teams'`.
3. `itemType: 'email' | 'event' | 'reminder'` — no `'message'`. A chat message
   has no `subject`; it has a conversation, a sender, and a body.
4. `ConnectorItem` has **no `sender`, no `conversationId`, no `threadId`, no
   `direction`, no `replyToId`** — all required by LINE and Teams.
5. `ConnectorConfig.config` is a **union of two concrete shapes** with no
   extension point for OAuth tokens or webhook secrets.

---

## 4. DATABASE SCHEMA — `src/main.ts:4125-4152` (verbatim)

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    display_name TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT DEFAULT 'disconnected',
    last_sync TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS connector_items (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    subject TEXT,
    summary TEXT,
    date TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    metadata TEXT,
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_connector_items_connector ON connector_items(connector_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_connector_items_date ON connector_items(date)');
```

### 4a. Schema assessment

**Good news:** `connectors.type` and `connectors.provider` are plain `TEXT`, so
new values need **no migration**. `connector_items.metadata` is a JSON TEXT blob
and is already the escape hatch for provider-specific fields.

**Gaps to solve:**
- **No index on `(connector_id, date)`** — the list query will degrade. The two
  existing indexes are single-column and cannot serve a composite sort.
- **No uniqueness on the remote id.** IMAP fakes it as `ci_${id}_${seqno}`
  (below). LINE has a real `messageId`; Teams has a real message id. Without a
  stable remote key, webhook delivery and polling will **duplicate every
  message** — this is the classic idempotency bug and it is the #1 thing your
  data pipeline must get right.
- **No webhook/dedup table.** A LINE webhook can be redelivered; Bot Framework
  retries. You need a seen-key store.

---

## 5. IPC SURFACE — `src/preload.ts:1762-1780` (verbatim)

```ts
connectors: {
  list: () => ipcRenderer.invoke('connectors:list'),
  add: (connector: { type: string; provider: string; displayName: string; config: any }) => ipcRenderer.invoke('connectors:add', connector),
  remove: (id: string) => ipcRenderer.invoke('connectors:remove', id),
  test: (id: string) => ipcRenderer.invoke('connectors:test', id),
  sync: (id: string) => ipcRenderer.invoke('connectors:sync', id),
  items: (id: string, opts?: { type?: string; limit?: number; offset?: number; search?: string; unreadOnly?: boolean }) => ipcRenderer.invoke('connectors:items', id, opts),
  status: (id: string) => ipcRenderer.invoke('connectors:status', id),
  sendEmail: (data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string }) => ipcRenderer.invoke('connectors:send-email', data),
  createEvent: (data: { connectorId: string; title: string; startTime: string; endTime?: string; description?: string }) => ipcRenderer.invoke('connectors:create-event', data),
  updateEvent: (data: { connectorId: string; eventId: string; changes: any }) => ipcRenderer.invoke('connectors:update-event', data),
  deleteEvent: (data: { connectorId: string; eventId: string }) => ipcRenderer.invoke('connectors:delete-event', data),
  markRead: (data: { connectorId: string; emailId: string; read: boolean }) => ipcRenderer.invoke('connectors:mark-read', data),
  onNewEmails: (callback: (data: { connectorId: string; connectorName: string; unreadCount: number; newItems: any[] }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('connectors:new-emails', handler);
    return () => { ipcRenderer.removeListener('connectors:new-emails', handler); };
  },
},
```

**Note:** the push channel is named `connectors:new-emails`. That name is
email-specific and will be wrong the moment messages exist. Rename to something
neutral.

---

## 6. THE SYNC HANDLER — `src/infrastructure/ipc/goal-handlers.ts`

Handlers are **not** in `src/main.ts` — they live in this module. This is
important: `main.ts` imports handler modules directly and never calls a
`registerAllHandlers()`. Anything registered only in an index file is dead code.

- `src/infrastructure/ipc/goal-handlers.ts:2899` → `connectors:list`
- `src/infrastructure/ipc/goal-handlers.ts:3135` → `connectors:sync`

### 6a. `connectors:sync` — IMAP branch (lines 3135-3178, verbatim excerpt)

```ts
ipcMain.handle('connectors:sync', async (_event, id: string) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(id) as any;
    if (!row) return { success: false, error: 'Connector not found', itemsAdded: 0, itemsUpdated: 0 };
    const config = JSON.parse(row.config);
    let itemsAdded = 0;
    if (row.type === 'email' && row.provider === 'imap') {
      const Imap = require('node-imap');
      const { simpleParser } = require('mailparser');
      const imapCfg = {
        user: config.username, password: config.password,
        host: config.host, port: config.port, tls: config.tls,
        tlsOptions: { rejectUnauthorized: false },
      };
      const rawItems: any[] = await new Promise((resolve, reject) => {
        const imap = new Imap(imapCfg);
        const results: any[] = [];
        imap.once('ready', () => {
          imap.openBox(config.folder || 'INBOX', true, (err: any, box: any) => {
            if (err) { imap.end(); reject(err); return; }
            const fetch = imap.seq.fetch(`${Math.max(1, box.messages.total - 19)}:*`, { bodies: '', markSeen: false });
            fetch.on('message', (msg: any, seqno: number) => {
              let raw = '';
              msg.on('body', (stream: any) => { stream.on('data', (chunk: any) => { raw += chunk.toString('utf8'); }); });
              msg.on('attributes', (attrs: any) => { msg._attrs = attrs; });
              msg.on('end', () => { results.push({ seqno, raw, attrs: msg._attrs }); });
            });
            fetch.once('error', (e: any) => { imap.end(); reject(e); });
            fetch.once('end', () => { imap.end(); resolve(results); });
          });
        });
        imap.once('error', reject);
        imap.connect();
      });
      const ins = db!.prepare(`INSERT OR REPLACE INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'email', ?, ?, ?, ?, ?)`);
      for (const item of rawItems) {
        try {
          const parsed = await simpleParser(item.raw);
          const itemId = `ci_${id}_${item.seqno}`;
          const dateStr = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          const fromAddr = parsed.from?.text || '';
          const subject = parsed.subject || '(no subject)';
          const snippet = (parsed.text || '').slice(0, 200).replace(/\s+/g, ' ').trim();
          const isRead = item.attrs?.flags?.includes('\\Seen') ? 1 : 0;
          ins.run(itemId, id, subject, snippet, dateStr, isRead, JSON.stringify({ from: fromAddr, sequenceNumber: item.seqno }));
          itemsAdded++;
        } catch {}
      }
    } else if (row.type === 'calendar' && row.provider === 'caldav') {
      // ... CalDAV REPORT query, see below
```

### 6b. Critical observations for your design

1. **The backend is REAL, not a stub.** It genuinely connects and fetches. Do
   not design as though it is mocked.
2. **`INSERT OR REPLACE` with a synthesized id** (`ci_${id}_${seqno}`) is how
   idempotency is currently faked. **IMAP sequence numbers are not stable** — a
   deletion renumbers the whole mailbox. This is a latent bug in the existing
   code. Do not copy this pattern for LINE/Teams, which give you real stable
   message ids.
3. **Only the last 20 messages** are fetched (`box.messages.total - 19`).
4. **Hardcoded `'email'` item_type** inside the prepared statement.
5. **`itemsAdded` is incremented even when the row already existed** — it counts
   writes, not new items. Your UI cannot trust this number.
6. **Per-item `try {} catch {}` swallows all parse failures silently.** No
   dead-letter. A malformed message vanishes with no trace.
7. The dispatch is an `if/else if` on `row.type`/`row.provider`. Adding two more
   providers makes this chain unwieldy — the dispatch should become a registry.

---

## 7. PLATFORM API FACTS (from the official docs you linked)

### 7a. LINE Messaging API — `https://developers.line.biz/en/services/messaging-api/`

Two-way communication between your service and LINE users. Bot can send
messages at any time, and can reply. Supports **1-on-1 and group chats** (add
your bot as a friend, or add it to a group). Many message types available.

Practical specifics you must design around:
- **Inbound:** LINE `POST`s a JSON event array to your HTTPS webhook URL.
- **Verify:** the URL must return **200** within a few seconds or LINE disables
  the bot. Ack first, process after.
- **Signature:** validate `X-Line-Signature` (HMAC-SHA256 of the raw body with
  your channel secret). **Use the raw body**, not re-serialized JSON.
- **Verify endpoint:** LINE calls your webhook with a blank body and a
  `X-Line-Signature` of the empty string on setup; respond 200.
- **Outbound:** `POST https://api.line.me/v2/bot/message/push` (and
  `/reply`, `/multicast`, `/broadcast`) with header
  `Authorization: Bearer <channel access token>`.
- **Credentials:** channel ID + channel secret + channel access token (long-lived
  or issue short-lived ones). Verify via
  `GET /v2/bot/channel/accessToken/validate`.
- **Rich content:** text, sticker, image, video, audio, file, location, and
  **template/flex messages**. Flex messages are JSON — they are the single
  biggest surface area for "what does an item look like".
- **Rate limits:** messages are throttled; pushes are not free-quota-limited
  like email. Treat 429 as normal and back off.
- **Redelivery:** LINE may redeliver the same event. **Dedup on `messageId`.**

### 7b. Teams — `https://learn.microsoft.com/en-us/microsoftteams/platform/teams-sdk/essentials/api`

The Teams API client is exposed as `app.api` (TypeScript/Python) or
`context.Api` / `teams.Api` (C#). Areas:

| Area | Description |
|---|---|
| `conversations` | Perform activities on conversations (send, update, delete messages), or create conversations (like 1:1 chat) |
| `meetings` | Meeting details and participants via `getById` / `getParticipant` |
| `teams` | Team or channel details |

Example (TypeScript, inside an activity handler):
```typescript
app.on('message', async ({ activity, api }) => {
  const members = await api.conversations.getMembers(activity.conversation.id);
});
```

**Proactive access, outside a handler** (this is the one that matters for a
pull-style connector):
```typescript
import * as endpoints from '@microsoft/teams.graph-endpoints';

const res = await app.api.graph.call(endpoints.chats.getAllMessages.get);
```

Meeting participants example:
```typescript
app.on('meetingStart', async ({ activity, api }) => {
  const meetingId = activity.channelData?.meeting?.id;
  const tenantId = activity.channelData?.tenant?.id;
  const userId = activity.from?.aadObjectId;

  if (meetingId && tenantId && userId) {
    const participant = await api.meetings.getParticipant(meetingId, userId, tenantId);
    // participant.meeting?.role — "Organizer", "Presenter", "Attendee"
    // participant.meeting?.inMeeting — true/false
  }
});
```

Notes: `meetingId`/`tenantId` come from `activity.channelData`; `userId` is the
AAD object id. To get **all** meeting members use the conversations API, since
meetings are also conversations.

**Hard requirements this implies:**
- The `api` object is **activity-scoped**. Proactive access outside a turn goes
  through `app.api.graph.call(...)` (Microsoft Graph) — a different auth path.
- Requires a **Bot Framework** app registration: Azure AD app ID + client
  secret, bot registration, and a **publicly reachable HTTPS** messaging
  endpoint. Multi-tenant bot registration if you need other tenants.
- Reading *existing* Teams chat history is a **Microsoft Graph** problem
  (`/chats/{id}/messages`), and needs `Chat.Read` (application) permissions
  plus admin consent. The Teams SDK is oriented at *receiving* activities, not
  at bulk history retrieval.
- Activity delivery is **at-least-once** with retries → dedup required.

---

## 8. UI LAYER (what currently renders connectors)

Files:
- `src/components/ConnectorsPanel.tsx`
- `src/components/ConnectorSetupModal.tsx`
- `src/components/ai/connectors/ConnectorsPanel.tsx`
- `src/components/ai/connectors/ConnectorItemModal.tsx`
- `src/components/ai/chat/ConnectorStatusBar.tsx`
- `src/components/ai/chat/renderers/ConnectorStatusCard.tsx`
- `src/hooks/useConnectors.ts`
- `src/hooks/useConnectorItems.ts`

`ConnectorSetupModal` currently collects host/port/username/password/folder —
an **IMAP-shaped form**. A messaging connector needs a different setup entirely
(token paste + webhook URL registration + connection test), so the setup flow is
not parameterisable by adding fields.

---

## 9. CONSTRAINTS (hard limits — do not violate)

1. **The app must run fully offline.** Push-based webhooks must degrade to a
   **poll fallback**, because a desktop machine that is asleep or offline misses
   deliveries. Design for at-least-once + reconciliation, never webhook-only.
2. **`connectors.type` and `connectors.provider` are TEXT** — new values require
   no migration, but **new columns and tables DO**, and the DB has exactly one
   writer. Never run DDL while the app is running.
3. **Tunnel credentials are secrets.** They belong in the existing encrypted
   vault (see `src/services/ai-gateway/CredentialVault.ts` for the pattern), never
   in `connectors.config` JSON in plaintext, never in `localStorage`.
4. **Do not overwrite `dist/` or `dist-electron/`.** `dist/` IS the running
   application — it is served straight off disk on `127.0.0.1:38123`. Deleting it
   bricks the app until CZ rebuilds.
5. Only CZ builds. An agent never runs `npm run build`.
6. Full-repo `tsc` reports thousands of pre-existing errors. Verify with scoped
   greps, never a repo-wide error count.

---

## 10. THE QUESTION YOU MUST ANSWWER FIRST

Before designing anything, state your answer to this explicitly:

> **How does an offline desktop app that sleeps for hours reconcile messages
> delivered by a webhook it was not listening for?**

Then design the complete system around your answer. Everything else — the data
model, the dedup strategy, the UI — follows from it.
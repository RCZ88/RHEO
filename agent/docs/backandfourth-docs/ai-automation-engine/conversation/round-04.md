# Round 04 — Project Owner replies

> **RESULT.md accepted.** It is saved verbatim at `RESULT.md` in this folder and becomes the
> implementation contract. Your §C correction was right and **worse than you stated** —
> details in §1, and it upgrades WF-C1 from hygiene to a correctness gate.
>
> **Three findings that change Appendix A and your extraction budget** — §2. One of them
> deletes a work item you priced.

---

## 1. §C CONFIRMED, and it is worse: 38 legacy ids, not 16

You said the NL path could emit ids the canonical 16 lacks. The real numbers:

```
legacy ids (src/components/ai/automation/triggerRegistry.ts)     : 38
canonical ids (…/automations/data/triggerRegistry.ts)             : 16
legacy ids with NO canonical equivalent                          : 22
```

The 22 orphans include exactly the ones your mission-lane thesis depends on:

```
note.created   note.summarized   goal.created   goal.completed
goal.progress  session.completed session.started transaction.created
transaction.updated  budget.exceeded  app.launched  app.quit
window.changed  project.opened  build.completed  subscription.due …
```

And the live importer is confirmed:

```ts
// src/components/ai/automation/nlParser.ts:2-3
import { EVENT_SOURCES } from './triggerRegistry';      // <-- the LEGACY one
import { ACTION_DEFS } from './actionRegistry';
```

**My "one delete" was wrong and I withdraw it.** Deleting the legacy registry without
rewiring `nlParser` would leave a live authoring path emitting 22 permanently-unmatchable
trigger ids — your Q5 violation, manufactured on day one, by the tool the original brief
names as half the input surface. **WF-C1 stays a correctness gate.**

---

## 2. Three corrections to Appendix A

### (a) `email:send` is NOT a gap. **WF-E1 is largely deletable.**

I told you "only `replyToEmail` exists." **Wrong.** There is a general send with optional
reply-to:

```ts
// src/preload.ts:1720
sendEmail: (data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string })
  => ipcRenderer.invoke('connectors:send-email', data)
```

and the handler is **29 lines, already written**:

```ts
### `connectors:send-email` — src/infrastructure/ipc/goal-handlers.ts

```ts
('connectors:send-email', async (_event, data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const nodemailer = require('nodemailer');
    // Derive SMTP host from IMAP host (imap.gmail.com ? smtp.gmail.com)
    const smtpHost = config.host.replace(/^imap\./, 'smtp.');
    const smtpPort = config.tls ? 465 : 587;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: config.tls,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: false },
    });
    const info = await transporter.sendMail({
      from: config.username,
      to: data.to,
      subject: data.subject,
      text: data.body,
      inReplyTo: data.inReplyTo,
      references: data.inReplyTo ? [data.inReplyTo] : undefined,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
})
```

### `connectors:create-event` — src/infrastructure/ipc/goal-handlers.ts

```ts
('connectors:create-event', async (_event, data: { connectorId: string; title: string; startTime: string; endTime?: string; description?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dtStart = icalUtc(data.startTime);
    const dtEnd = data.endTime ? icalUtc(data.endTime) : dtStart;
    // PROPER CRLF + escaping. The old body used bare \n and unescaped commas,
    // semicolons and newlines in the title/description, which produces an
    // invalid VCALENDAR that stricter servers (Google, iOS) reject with 400.
    const vevent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DeskFlow//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icalEscape(data.title)}`,
      `DESCRIPTION:${icalEscape(data.description || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

    // normalizeCalDavUrl was NOT applied here before — a connector could test
    // green and then fail every write with 404. Now both paths agree.
    const baseUrl = normalizeCalDavUrl(config.url, config.username);
    const { status, body } = await calDavRequest(
      (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + encodeURIComponent(`${uid}.ics`),
      {
        method: 'PUT',
        username: config.username,
        password: config.password,
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'If-None-Match': '*' },
        body: vevent,
        timeoutMs: 15000,
      }
    );
    if (status >= 200 && status < 300) {
      db!.prepare(`INSERT INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'event', ?, ?, ?, 1, ?)`)
        .run(`ci_${data.connectorId}_${uid}`, data.connectorId, data.title, data.description || data.title, data.startTime, JSON.stringify({ startTime: data.startTime, endTime: data.endTime }));
      return { success: true, eventId: uid };
    }
    const detail = body.length < 200 ? body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
    return { success: false, error: `Calendar rejected the event (HTTP ${status})${detail ? ' — ' + detail : ''}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
})
```

### `connectors:items` — src/infrastructure/ipc/goal-handlers.ts

```ts
('connectors:items', async (_event, id: string, opts?: { type?: string; limit?: number; offset?: number; search?: string; unreadOnly?: boolean }) => {
  try {
    const limit = opts?.limit || 20;
    const offset = opts?.offset || 0;
    let query = 'SELECT * FROM connector_items WHERE connector_id = ?';
    const params: any[] = [id];
    if (opts?.type) { query += ' AND item_type = ?'; params.push(opts.type); }
    if (opts?.search) { query += ' AND (subject LIKE ? OR summary LIKE ?)'; const s = `%${opts.search}%`; params.push(s, s); }
    if (opts?.unreadOnly) { query += ' AND is_read = 0'; }
    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db!.prepare(query).all(...params) as any[];
    return {
      success: true,
      items: rows.map(r => ({
        id: r.id, connectorId: r.connector_id, itemType: r.item_type,
        subject: r.subject, summary: r.summary, date: r.date,
        read: !!r.is_read, metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, items: [] };
  }
})
```
```

So `email:send` is category **(i)** — extract in place — not a net-new capability. Its cost
drops from "connector-level work, may slip past P2" to one extraction with an existing
`external` tier already defined for it. **WF-E1 should be re-scoped, not deleted**: the
security question (strictest unattended policy for the one action that leaves the machine)
survives; the implementation gap does not.

### (b) `calendar:create` is also already backed — 49 lines exist

```ts
('connectors:create-event', async (_event, data: { connectorId: string; title: string; startTime: string; endTime?: string; description?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dtStart = icalUtc(data.startTime);
    const dtEnd = data.endTime ? icalUtc(data.endTime) : dtStart;
    // PROPER CRLF + escaping. The old body used bare \n and unescaped commas,
    // semicolons and newlines in the title/description, which produces an
    // invalid VCALENDAR that stricter servers (Google, iOS) reject with 400.
    const vevent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DeskFlow//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icalEscape(data.title)}`,
      `DESCRIPTION:${icalEscape(data.description || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

    // normalizeCalDavUrl was NOT applied here before — a connector could test
    // green and then fail every write with 404. Now both paths agree.
    const baseUrl = normalizeCalDavUrl(config.url, config.username);
    const { status, body } = await calDavRequest(
      (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + encodeURIComponent(`${uid}.ics`),
      {
        method: 'PUT',
        username: config.username,
        password: config.password,
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'If-None-Match': '*' },
        body: vevent,
        timeoutMs: 15000,
      }
    );
    if (status >= 200 && status < 300) {
      db!.prepare(`INSERT INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'event', ?, ?, ?, 1, ?)`)
        .run(`ci_${data.connectorId}_${uid}`, data.connectorId, data.title, data.description || data.title, data.startTime, JSON.stringify({ startTime: data.startTime, endTime: data.endTime }));
      return { success: true, eventId: uid };
    }
    const detail = body.length < 200 ? body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
    return { success: false, error: `Calendar rejected the event (HTTP ${status})${detail ? ' — ' + detail : ''}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
})
```

That is `connectors:create-event`, driven by `createEvent` in preload. Category **(i)**,
already implemented. Your `?` resolves.

### (c) **The extraction surface is 913 closures, not 629 — and only 629 are in `main.ts`.**

```
src/main.ts                            : 629 ipcMain.handle closures
src/infrastructure/ipc/*.ts (9 files)  : 284 ipcMain.handle closures
                                        ---
                                        913 total
```

**All 12 `connectors:*` channels live in `src/infrastructure/ipc/goal-handlers.ts`** — a
2,700-line file, not the 31,000-line one. That materially lowers the cost of the three
connector-backed actions: extraction happens in a small, modular, already-handler-shaped
file, with no dependency threading, and `goal-handlers.ts` is a pure handler module where
the (d) "in-place, same file" property is nearly free.

**Budget revision:** your Appendix A is now

| action | backing | file | extraction | status |
|---|---|---|---|---|
| `notify` | Electron `Notification` | — | none — native (ii) | ✅ confirmed |
| `goal:create` | `save-goal` | `main.ts` | in-place (i) | ✅ **resolved** — 1-line delegation |
| `goal:complete` | `complete-goal` | `main.ts` | in-place (i) | ✅ **resolved** — 1-line delegation |
| `log` | `log-activity` | `main.ts` | in-place (i) | ✅ **resolved** |
| `schedule:add` | — | — | — | ⚠️ **no channel found** |
| `deadline:add` | — | — | — | ⚠️ **no channel found** |
| `calendar:create` | `connectors:create-event` | `goal-handlers.ts` | in-place (i) | ✅ **49 lines exist** |
| `email:send` | `connectors:send-email` | `goal-handlers.ts` | in-place (i) | ✅ **29 lines exist** |

**Two actions still have no backing at all: `schedule:add` and `deadline:add`.** Your table
guessed they sat behind `createScheduleFromEmail` / `createDeadlineFromEmail`. **Those two
functions exist only inside `toolRegistry.ts`** — they are tool *names*, not channels. I
found no `ipcMain.handle` for either, and no preload entry. So they are the same situation
you originally priced `email:send` as, and they need the same treatment as a work item.

---

## 3. The REQUEST — verbatim

### 3.1 `save-goal` — `goal:create`

```ts
NOT FOUND as ipcMain.handle in main.ts (may live in infrastructure/ipc/*)
```

### 3.2 `complete-goal` — `goal:complete`

```ts
NOT FOUND as ipcMain.handle in main.ts (may live in infrastructure/ipc/*)
```

### 3.3 `log-activity` — `log`

```ts
('log-activity', async (_event, data: {
  entityType: string; entityId: string; entityTitle?: string;
  action: string; actor: string; summary: string; details?: string;
}) => {
  logActivity(data);
  return { success: true };
})
```

### 3.4 `connectors:send-email` — `email:send` (confirms the finding above)

```ts
### `connectors:send-email` — src/infrastructure/ipc/goal-handlers.ts

```ts
('connectors:send-email', async (_event, data: { connectorId: string; to: string; subject: string; body: string; inReplyTo?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const nodemailer = require('nodemailer');
    // Derive SMTP host from IMAP host (imap.gmail.com ? smtp.gmail.com)
    const smtpHost = config.host.replace(/^imap\./, 'smtp.');
    const smtpPort = config.tls ? 465 : 587;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: config.tls,
      auth: { user: config.username, pass: config.password },
      tls: { rejectUnauthorized: false },
    });
    const info = await transporter.sendMail({
      from: config.username,
      to: data.to,
      subject: data.subject,
      text: data.body,
      inReplyTo: data.inReplyTo,
      references: data.inReplyTo ? [data.inReplyTo] : undefined,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
})
```

### `connectors:create-event` — src/infrastructure/ipc/goal-handlers.ts

```ts
('connectors:create-event', async (_event, data: { connectorId: string; title: string; startTime: string; endTime?: string; description?: string }) => {
  try {
    const row = db!.prepare('SELECT * FROM connectors WHERE id = ?').get(data.connectorId) as any;
    if (!row) return { success: false, error: 'Connector not found' };
    const config = JSON.parse(row.config);
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dtStart = icalUtc(data.startTime);
    const dtEnd = data.endTime ? icalUtc(data.endTime) : dtStart;
    // PROPER CRLF + escaping. The old body used bare \n and unescaped commas,
    // semicolons and newlines in the title/description, which produces an
    // invalid VCALENDAR that stricter servers (Google, iOS) reject with 400.
    const vevent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DeskFlow//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${icalEscape(data.title)}`,
      `DESCRIPTION:${icalEscape(data.description || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

    // normalizeCalDavUrl was NOT applied here before — a connector could test
    // green and then fail every write with 404. Now both paths agree.
    const baseUrl = normalizeCalDavUrl(config.url, config.username);
    const { status, body } = await calDavRequest(
      (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + encodeURIComponent(`${uid}.ics`),
      {
        method: 'PUT',
        username: config.username,
        password: config.password,
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'If-None-Match': '*' },
        body: vevent,
        timeoutMs: 15000,
      }
    );
    if (status >= 200 && status < 300) {
      db!.prepare(`INSERT INTO connector_items (id, connector_id, item_type, subject, summary, date, is_read, metadata) VALUES (?, ?, 'event', ?, ?, ?, 1, ?)`)
        .run(`ci_${data.connectorId}_${uid}`, data.connectorId, data.title, data.description || data.title, data.startTime, JSON.stringify({ startTime: data.startTime, endTime: data.endTime }));
      return { success: true, eventId: uid };
    }
    const detail = body.length < 200 ? body.replace(/<[^>]+>/g, '').trim().slice(0, 150) : '';
    return { success: false, error: `Calendar rejected the event (HTTP ${status})${detail ? ' — ' + detail : ''}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
})
```

### `connectors:items` — src/infrastructure/ipc/goal-handlers.ts

```ts
('connectors:items', async (_event, id: string, opts?: { type?: string; limit?: number; offset?: number; search?: string; unreadOnly?: boolean }) => {
  try {
    const limit = opts?.limit || 20;
    const offset = opts?.offset || 0;
    let query = 'SELECT * FROM connector_items WHERE connector_id = ?';
    const params: any[] = [id];
    if (opts?.type) { query += ' AND item_type = ?'; params.push(opts.type); }
    if (opts?.search) { query += ' AND (subject LIKE ? OR summary LIKE ?)'; const s = `%${opts.search}%`; params.push(s, s); }
    if (opts?.unreadOnly) { query += ' AND is_read = 0'; }
    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db!.prepare(query).all(...params) as any[];
    return {
      success: true,
      items: rows.map(r => ({
        id: r.id, connectorId: r.connector_id, itemType: r.item_type,
        subject: r.subject, summary: r.summary, date: r.date,
        read: !!r.is_read, metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message, items: [] };
  }
})
```
```

---

## 4. What changes in RESULT.md, and what I need

**Three edits, then one question.**

1. **WF-E1 re-scoped:** not a capability gap; extraction of an existing 29-line handler.
   The `external` tier and its never-unattended policy are unchanged.
2. **WF-S1 added:** `schedule:add` and `deadline:add` have **no main-side implementation**.
   Same class as old WF-E1 — connector-level work, may slip past P2.
3. **§10 extraction policy gains one sentence:** *"the handler surface is 913 closures of
   which 284 already live in `src/infrastructure/ipc/`, so phase-1 and phase-2 extractions
   land in small modular handler files, not in `main.ts`."*

**The question:** `save-goal` and `complete-goal` are **one-line delegations** — the closure
calls a function that already exists and exports. That means category (i) for those two is
**free**: no body to move, the runner just imports the same function. Does that change your
P0/P1 boundary? Concretely: if `goal:create` and `goal:complete` are free, is there any
extraction left in P1 at all — or does P0 become "spine + 4 executors, zero extraction,"
and every real extraction move to P2?

That matters because it would let P0 ship **completely**, spine and four working executors
with no closure touched, which is the strongest possible first milestone and exactly the
"notify-first proves the gating invariant" argument you made in §B.

Still queued, for WF-H1 sizing only: the `tick()` body, and whether a main-process LLM
invocation loop exists.

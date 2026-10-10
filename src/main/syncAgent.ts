// syncAgent.ts — Desktop ↔ Cloud sync bridge (Electron main process).
//
// Keeps the local better-sqlite3 DB in sync with the cloud sync server.
// The desktop stays the primary writer; this pushes local changes up and pulls
// remote (mobile) changes down.
//
// Strategy (offline-first, last-write-wins):
//   * Local rows have updated_at; we track a per-table "last pushed cursor".
//   * Sensitive free-text (terminal message content) is ENCRYPTED on the desktop
//     before it ever leaves the machine. The server only stores ciphertext.

import type Database from "better-sqlite3"
import crypto from "crypto"

type Fetcher = typeof fetch

interface SyncChange {
  table: string
  row: Record<string, unknown>
}

interface SyncPushResponse {
  applied: number
  cursor?: number
}

interface SyncPullResponse {
  changes: Record<string, SyncChange[]>
  cursor: number
}

// AES-256-GCM encryption matching the codebase's audit encryption pattern.
// Returns base64-encoded ciphertext with IV prepended (iv:authTag:ciphertext).
function defaultEncrypt(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

function defaultDecrypt(b64: string, key: Buffer): string {
  const buf = Buffer.from(b64, "base64")
  const iv = buf.subarray(0, 16)
  const tag = buf.subarray(16, 32)
  const enc = buf.subarray(32)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

export class SyncAgent {
  private cursor = 0
  private syncKey: Buffer
  private tables: string[]

  constructor(
    private db: Database.Database,
    private baseUrl: string,
    private getAccessToken: () => Promise<string>,
    private encryptField: (plain: string) => string = (p) => defaultEncrypt(p, this.syncKey),
    private decryptField: (b64: string) => string = (b) => defaultDecrypt(b, this.syncKey),
    private fetcher: Fetcher = fetch,
    keyMaterial?: Buffer,
  ) {
    // Derive a sync-specific encryption key from the material (or random fallback).
    // In production, pass a stable key derived from the user's device secret.
    this.syncKey = keyMaterial
      ? crypto.createHash("sha256").update(keyMaterial).digest()
      : crypto.randomBytes(32)

    this.tables = [
      "terminal_sessions",
      "terminal_messages",
      "workspace_problems",
      "workspace_requests",
      "schedule_entries",
    ]
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${await this.getAccessToken()}`,
    }
  }

  private safeUnix(dateStr: string | null | undefined): number {
    if (!dateStr) return 0
    const t = Date.parse(dateStr)
    return isNaN(t) ? 0 : Math.floor(t / 1000)
  }

  // ── Push local changes newer than cursor ──────────────────────────
  async push(): Promise<SyncPushResponse> {
    const changes: SyncChange[] = []
    const limit = 100

    // terminal_sessions — only columns that exist on the server schema
    const sessions = this.db
      .prepare("SELECT id, topic, status, agent, working_directory, total_tokens, total_cost, created_at, updated_at FROM terminal_sessions WHERE updated_at > datetime(?, 'unixepoch') LIMIT ?")
      .all(this.cursor, limit) as Record<string, unknown>[]
    for (const row of sessions) {
      changes.push({ table: "terminal_sessions", row })
    }

    // terminal_messages — encrypt content before upload (server uses content_enc, not content)
    const msgs = this.db
      .prepare("SELECT id, session_id, role, content, status, created_at FROM terminal_messages WHERE created_at > datetime(?, 'unixepoch') LIMIT ?")
      .all(this.cursor, limit) as Record<string, unknown>[]
    for (const row of msgs) {
      changes.push({
        table: "terminal_messages",
        row: {
          id: row.id,
          session_id: row.session_id,
          role: row.role,
          content_enc: this.encryptField(String(row.content ?? "")),
          status: row.status,
          created_at: row.created_at,
        },
      })
    }

    // workspace_problems — only columns that exist on the server schema
    const problems = this.db
      .prepare("SELECT id, title, status, priority, category, created_at, updated_at FROM workspace_problems WHERE updated_at > datetime(?, 'unixepoch') LIMIT ?")
      .all(this.cursor, limit) as Record<string, unknown>[]
    for (const row of problems) {
      changes.push({ table: "workspace_problems", row })
    }

    // workspace_requests — only columns that exist on the server schema
    const requests = this.db
      .prepare("SELECT id, title, status, priority, category, description, created_at, updated_at FROM workspace_requests WHERE updated_at > datetime(?, 'unixepoch') LIMIT ?")
      .all(this.cursor, limit) as Record<string, unknown>[]
    for (const row of requests) {
      changes.push({ table: "workspace_requests", row })
    }

    // schedule_entries — pushed so the phone sees the desktop's timetable, and so a
    // phone-authored edit has something to conflict against on the way back.
    // `updated_at` must be sent: pull filters on it, so omitting it would store
    // rows the desktop can never read back (the bug that stranded 100 messages).
    const schedule = this.db
      .prepare(`SELECT id, title, location, day_of_week, start_time, end_time, category, color, is_recurring, created_at, updated_at, deleted
                FROM schedule_entries WHERE updated_at > datetime(?, 'unixepoch') LIMIT ?`)
      .all(this.cursor, limit) as Record<string, unknown>[]
    for (const row of schedule) {
      changes.push({ table: "schedule_entries", row })
    }

    if (changes.length === 0) return { applied: 0 }

    const res = await this.fetcher(`${this.baseUrl}/v1/sync/push`, {
      method: "POST",
      headers: await this.authHeaders(),
      body: JSON.stringify({ changes }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`sync push failed ${res.status}: ${body}`)
    }
    const result = (await res.json()) as SyncPushResponse
    // Advance cursor after successful push so we don't re-push same rows
    if (typeof result.cursor === "number" && result.cursor > this.cursor) {
      this.cursor = result.cursor
    }
    return result
  }

  // ── Pull remote changes and merge (LWW by updated_at) ────────────
  async pull(): Promise<{ cursor: number; phoneFocusEvents: any[] }> {
    const res = await this.fetcher(
      `${this.baseUrl}/v1/sync/pull?since=${this.cursor}`,
      { headers: await this.authHeaders() },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`sync pull failed ${res.status}: ${body}`)
    }
    const { changes, cursor } = (await res.json()) as SyncPullResponse

    const merge = this.db.transaction(() => {
      // terminal_sessions — upsert LWW
      const upsertSession = this.db.prepare(`
        INSERT INTO terminal_sessions (id, updated_at) VALUES (@id, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          topic=excluded.topic, status=excluded.status, updated_at=excluded.updated_at
        WHERE excluded.updated_at > terminal_sessions.updated_at
      `)
      for (const r of changes.terminal_sessions ?? []) {
        upsertSession.run(r)
      }

      // terminal_messages — decrypt and insert (skip if id exists)
      const insertMsg = this.db.prepare(`
        INSERT OR IGNORE INTO terminal_messages (id, session_id, role, content, status, created_at)
        VALUES (@id, @session_id, @role, @content, @status, @created_at)
      `)
      for (const r of changes.terminal_messages ?? []) {
        const content = r.content_enc
          ? this.decryptField(String(r.content_enc))
          : String(r.content ?? "")
        insertMsg.run({
          id: r.id,
          session_id: r.session_id,
          role: r.role,
          content,
          status: r.status ?? "completed",
          created_at: r.created_at,
        })
      }

      // workspace_problems — upsert LWW.
      // These previously wrote ONLY `updated_at` and threw every other column away,
      // so a phone marking a problem "Fixed" would sync successfully and the status
      // would silently vanish on arrival. The full editable column set is now applied.
      const upsertProblem = this.db.prepare(`
        INSERT INTO workspace_problems (id, title, status, priority, category, created_at, updated_at, deleted)
        VALUES (@id, @title, @status, @priority, @category, @created_at, @updated_at, COALESCE(@deleted, 0))
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, status=excluded.status, priority=excluded.priority,
          category=excluded.category, updated_at=excluded.updated_at, deleted=excluded.deleted
        WHERE excluded.updated_at > workspace_problems.updated_at
      `)
      for (const r of changes.workspace_problems ?? []) {
        upsertProblem.run(r)
      }

      // workspace_requests — upsert LWW (same fix: description/status were discarded)
      const upsertRequest = this.db.prepare(`
        INSERT INTO workspace_requests (id, title, status, priority, category, description, created_at, updated_at, deleted)
        VALUES (@id, @title, @status, @priority, @category, @description, @created_at, @updated_at, COALESCE(@deleted, 0))
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, status=excluded.status, priority=excluded.priority,
          category=excluded.category, description=excluded.description,
          updated_at=excluded.updated_at, deleted=excluded.deleted
        WHERE excluded.updated_at > workspace_requests.updated_at
      `)
      for (const r of changes.workspace_requests ?? []) {
        upsertRequest.run(r)
      }

      // schedule_entries — the phone edits the timetable, so the desktop has to apply
      // the real columns. Without this branch the table is a fifth write-only dead
      // store: the phone's edits would be stored and never seen here, exactly like
      // finance/goals/learning were.
      const upsertSchedule = this.db.prepare(`
        INSERT INTO schedule_entries (id, title, location, day_of_week, start_time, end_time, category, color, is_recurring, created_at, updated_at)
        VALUES (@id, @title, @location, @day_of_week, @start_time, @end_time, @category, @color, COALESCE(@is_recurring, 1), @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, location=excluded.location, day_of_week=excluded.day_of_week,
          start_time=excluded.start_time, end_time=excluded.end_time,
          category=excluded.category, color=excluded.color,
          is_recurring=excluded.is_recurring, updated_at=excluded.updated_at
        WHERE excluded.updated_at > schedule_entries.updated_at
      `)
      const deleteSchedule = this.db.prepare(`DELETE FROM schedule_entries WHERE id = ?`)
      for (const r of changes.schedule_entries ?? []) {
        // The desktop schema has no `deleted` column on this table, so honour it as a
        // real delete rather than resurrecting a removed class.
        if (Number(r.deleted) === 1) {
          deleteSchedule.run(r.id)
        } else {
          upsertSchedule.run(r)
        }
      }
    })

    merge()

    // ── Focus → phone link: collect inbound phone focus events ──────
    // deep_focus_events rows are KV envelopes; value_json holds the event.
    // Keep phone-origin events only — the main-process handler matches them
    // against the live desktop session (dedupe there; pull repeats rows).
    // Do NOT merge these into any desktop table; events only.
    const phoneFocusEvents: any[] = []
    try {
      for (const change of changes.deep_focus_events ?? []) {
        const row = (change.row ?? {}) as Record<string, unknown>
        const raw = row.value_json
        if (typeof raw !== "string" || !raw) continue
        try {
          const ev = JSON.parse(raw)
          if (ev && ev.origin === "phone") phoneFocusEvents.push(ev)
        } catch {}
      }
    } catch {}

    if (typeof cursor === "number" && cursor > this.cursor) {
      this.cursor = cursor
    }
    return { cursor: this.cursor, phoneFocusEvents }
  }

  // ── Convenience: push then pull in one call ───────────────────────
  async sync(): Promise<{ pushed: number; cursor: number; phoneFocusEvents: any[] }> {
    const pushResult = await this.push()
    const pullResult = await this.pull()
    return { pushed: pushResult.applied, cursor: pullResult.cursor, phoneFocusEvents: pullResult.phoneFocusEvents }
  }

  // ── Get current cursor (for diagnostics) ──────────────────────────
  getCursor(): number {
    return this.cursor
  }
}

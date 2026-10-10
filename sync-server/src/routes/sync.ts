// routes/sync.ts — Push + pull endpoints
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { requireAuth } from "../auth.js"
import { getDb } from "../db/client.js"

const PushBody = z.object({
  changes: z.array(z.object({
    table: z.string(),
    row: z.record(z.unknown()),
  })),
})

const VALID_TABLES = new Set([
  "terminal_sessions",
  "terminal_messages",
  "workspace_problems",
  "workspace_requests",
  "finance",
  "goals",
  "learning",
  "phone_tracking",
  "schedule_entries",
])

// Server-side column whitelists — drop unknown columns before INSERT to prevent schema mismatches
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  terminal_sessions: new Set(["id", "user_id", "device_id", "topic", "status", "agent", "working_directory", "total_tokens", "total_cost", "created_at", "updated_at", "deleted"]),
  terminal_messages: new Set(["id", "user_id", "device_id", "session_id", "role", "content_enc", "status", "created_at", "updated_at", "deleted"]),
  workspace_problems: new Set(["id", "user_id", "device_id", "title", "status", "priority", "category", "description", "created_at", "updated_at", "deleted"]),
  workspace_requests: new Set(["id", "user_id", "device_id", "title", "status", "priority", "category", "description", "created_at", "updated_at", "deleted"]),
  finance: new Set(["id", "device_id", "value_json", "updated_at", "deleted", "rev"]),
  goals: new Set(["id", "device_id", "value_json", "updated_at", "deleted", "rev"]),
  learning: new Set(["id", "device_id", "value_json", "updated_at", "deleted", "rev"]),
  phone_tracking: new Set(["id", "device_id", "value_json", "updated_at", "deleted", "rev"]),
  schedule_entries: new Set(["id", "user_id", "device_id", "title", "location", "day_of_week", "start_time", "end_time", "category", "color", "is_recurring", "created_at", "updated_at", "deleted"]),
}

// Tables that use (user_id, id) composite PK — ON CONFLICT must exclude user_id from updates
const COMPOSITE_PK_TABLES = new Set(["finance", "goals", "learning", "phone_tracking"])

// Cursors are stored in SECONDS everywhere (push computes `Date.parse/1000`, and
// pull compares against `datetime(?, 'unixepoch')`).
//
// Historical bug: the push fallback was `maxTs || Date.now()`, and `Date.now()`
// is MILLISECONDS. Every cursor written by that fallback is ~1000x too large, and
// SQLite's `datetime(<ms>, 'unixepoch')` silently returns NULL for it -- which
// makes `updated_at > NULL` false for every row, so those users can never pull a
// single row again. Not a transient failure: it is permanent, and it is silent.
//
// We normalise on both write and read so already-poisoned cursors self-heal on
// the next push instead of requiring a manual DB repair.
const MS_CUTOFF = 1e11 // values above this are ms (1e11s is year 5138)
function toSeconds(v: number): number {
  return v > MS_CUTOFF ? Math.floor(v / 1000) : v
}

export async function syncRoutes(app: FastifyInstance) {
  // POST /v1/sync/push — upload local changes
  app.post("/push", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = PushBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }
    const { sub: userId } = (req as any).user
    const db = getDb()
    let applied = 0
    let maxTs = 0
    // Never swallow a failed row: the old behaviour logged and continued, then
    // still returned HTTP 200 {applied, cursor}, so the desktop advanced its
    // cursor past rows that were never stored and reported success. That is
    // silent, unrecoverable data loss. Surface it so the caller can retry.
    const failures: Array<{ table: string; error: string }> = []

    for (const change of parsed.data.changes) {
      if (!VALID_TABLES.has(change.table)) continue
      const allowed = ALLOWED_COLUMNS[change.table]
      // Filter to only columns the server knows about (defense against schema drift)
      const filteredRow: Record<string, unknown> = { user_id: userId }
      for (const [k, v] of Object.entries(change.row)) {
        if (allowed.has(k)) filteredRow[k] = v
      }
      const row = filteredRow

      // terminal_messages are pushed with `created_at` only, but PULL filters on
      // `updated_at`. Without this mirror they are written and then can never be
      // read back by anyone, ever -- which is exactly what happened: all 100
      // stored messages had `updated_at` NULL. Mirror it so rows land on the
      // same clock pull reads, rather than being stranded out of the cursor's reach.
      if (allowed.has("updated_at") && row.updated_at == null && row.created_at != null) {
        row.updated_at = row.created_at
      }

      // Track the max timestamp from the pushed rows' updated_at or created_at
      const tsField = row.updated_at ?? row.created_at
      if (tsField != null) {
        const ts = typeof tsField === "number"
          ? tsField
          : Date.parse(String(tsField)) / 1000
        if (!isNaN(ts) && ts > maxTs) maxTs = ts
      }

      const cols = Object.keys(row)
      const placeholders = cols.map(() => "?").join(", ")
      const isComposite = COMPOSITE_PK_TABLES.has(change.table)
      // SQLite requires the conflict target to be a PARENTHESISED column list —
      // `ON CONFLICT id` is a syntax error ("near \"id\""), `ON CONFLICT (id)` is
      // not. The bare `id` form here is why push could never upsert a
      // non-composite table.
      const conflictTarget = isComposite ? "(user_id, id)" : "(id)"
      const updates = cols.filter(c => c !== "id" && c !== "user_id")
        .map(c => `${c} = excluded.${c}`)
        .join(", ")
      // `ON CONFLICT${target}` with no space interpolates to `ON CONFLICTid`,
      // which is a SQLITE_ERROR -- so EVERY push that hit an existing row failed
      // with "near \"CONFLICTid\": syntax error", while the handler still returned
      // HTTP 200 {applied, cursor}. That is the whole reason sync never moved
      // data: the desktop advanced its cursor past rows that were never stored.
      // And when a row carries only its key columns, `DO UPDATE SET ` is itself a
      // syntax error, so an insert-only row must use DO NOTHING.
      const conflictClause = updates
        ? `ON CONFLICT ${conflictTarget} DO UPDATE SET ${updates}`
        : `ON CONFLICT ${conflictTarget} DO NOTHING`

      try {
        await db.execute({
          sql: `INSERT INTO ${change.table} (${cols.join(", ")}) VALUES (${placeholders})
                ${conflictClause}`,
          args: cols.map(c => row[c] as any),
        })
        applied++
      } catch (err: any) {
        failures.push({ table: change.table, error: err?.message ?? String(err) })
        console.error(`[sync] push FAILED for ${change.table}:`, err.message)
      }
    }

    // Update cursor — use max timestamp of pushed rows, not Date.now()
    // This prevents skipping un-pushed rows when cursor jumps ahead.
    // NOTE the /1000: the fallback MUST be in seconds like every other cursor,
    // or `datetime(cursor,'unixepoch')` on the pull side returns NULL forever.
    const cursor = maxTs || Math.floor(Date.now() / 1000)
    await db.execute({
      sql: `INSERT INTO sync_cursors (user_id, table_name, cursor) VALUES (?, '__push__', ?)
            ON CONFLICT(user_id, table_name) DO UPDATE SET cursor = excluded.cursor`,
      args: [userId, cursor],
    })

    // If anything failed we must NOT hand back a cursor that claims success:
    // the caller would advance past the unstored rows and never retry them.
    if (failures.length > 0) {
      return reply.status(500).send({ error: "push_failed", failed: failures, applied })
    }

    return { applied, cursor, failures: [] }
  })

  // GET /v1/sync/pull?since=<cursor> — download remote changes
  app.get("/pull", { preHandler: requireAuth }, async (req, reply) => {
    const { sub: userId } = (req as any).user
    // Heal a legacy millisecond cursor on read as well as write (see toSeconds).
    const since = toSeconds(Number((req.query as any).since) || 0)
    const db = getDb()

    const changes: Record<string, any[]> = {}
    let maxCursor = since

    for (const table of VALID_TABLES) {
      const isComposite = COMPOSITE_PK_TABLES.has(table)
      // New tables use INTEGER updated_at; existing tables use TEXT
      // ORDER BY is mandatory with LIMIT: without it SQLite returns an arbitrary
      // 500 rows, so a large table would page non-deterministically and the
      // caller could never advance past the rows it never received.
      const sql = isComposite
        ? `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC LIMIT 500`
        : `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > datetime(?, 'unixepoch') ORDER BY updated_at ASC LIMIT 500`
      const result = await db.execute({
        sql,
        args: [userId, since],
      })
      if (result.rows.length > 0) {
        changes[table] = result.rows
        for (const row of result.rows) {
          const ts = isComposite
            ? (row.updated_at as number)
            : Date.parse(row.updated_at as string) / 1000
          if (ts > maxCursor) maxCursor = ts
        }
      }
    }

    return { changes, cursor: maxCursor }
  })
}

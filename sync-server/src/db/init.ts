// db/init.ts — Database schema initialization
import { getDb } from "./client.js"

export async function initDatabase() {
  const db = getDb()

  await db.executeMultiple(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      display_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Devices table (for multi-device pairing)
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT,
      platform TEXT,
      paired_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_seen INTEGER
    );

    -- Refresh tokens
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Sync state (per-table cursor tracking)
    CREATE TABLE IF NOT EXISTS sync_cursors (
      user_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      cursor INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, table_name)
    );

    -- Terminal sessions (synced from desktop)
    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      topic TEXT,
      status TEXT DEFAULT 'active',
      agent TEXT,
      working_directory TEXT,
      total_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      deleted INTEGER DEFAULT 0
    );

    -- Terminal messages (encrypted content from desktop)
    CREATE TABLE IF NOT EXISTS terminal_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content_enc TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT,
      updated_at TEXT,
      deleted INTEGER DEFAULT 0
    );

    -- Workspace problems (synced)
    CREATE TABLE IF NOT EXISTS workspace_problems (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      status TEXT DEFAULT 'NEW',
      priority TEXT DEFAULT 'medium',
      category TEXT,
      description TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted INTEGER DEFAULT 0
    );

    -- Workspace requests (synced)
    CREATE TABLE IF NOT EXISTS workspace_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      status TEXT DEFAULT 'Pending',
      priority TEXT DEFAULT 'medium',
      category TEXT,
      description TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted INTEGER DEFAULT 0
    );

    -- Pairing codes (phone pairing — 8-char code, SHA-256 hash)
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code_hash TEXT NOT NULL PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      relay_host TEXT NOT NULL,
      relay_port INTEGER NOT NULL DEFAULT 8788,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      consumed_by_device_id TEXT,
      consumed_at INTEGER
    );

    -- Learn lessons (Lyceum)
    CREATE TABLE IF NOT EXISTS learn_lessons (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      part INTEGER NOT NULL DEFAULT 0,
      version TEXT NOT NULL DEFAULT '1.0',
      summary TEXT,
      node_count INTEGER DEFAULT 0,
      lesson_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Learn progress (Lyceum — per node per user)
    CREATE TABLE IF NOT EXISTS learn_progress (
      node_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      progress_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (node_id, user_id)
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      event TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      detail TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Phone telemetry (battery, DeskFlow usage, device info)
    CREATE TABLE IF NOT EXISTS phone_telemetry (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      deskflow_foreground_sec INTEGER DEFAULT 0,
      deskflow_background_sec INTEGER DEFAULT 0,
      battery_level REAL,
      battery_state TEXT,
      platform TEXT,
      platform_version TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Phone-originated finance data (JSON blob per row)
    CREATE TABLE IF NOT EXISTS finance (
      id TEXT NOT NULL,
      device_id TEXT,
      value_json TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      rev INTEGER NOT NULL DEFAULT 1,
      user_id TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    -- Phone-originated goals data
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT NOT NULL,
      device_id TEXT,
      value_json TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      rev INTEGER NOT NULL DEFAULT 1,
      user_id TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    -- Phone-originated learning data
    CREATE TABLE IF NOT EXISTS learning (
      id TEXT NOT NULL,
      device_id TEXT,
      value_json TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      rev INTEGER NOT NULL DEFAULT 1,
      user_id TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    -- Phone-originated phone tracking data (foreground/background time)
    CREATE TABLE IF NOT EXISTS phone_tracking (
      id TEXT NOT NULL,
      device_id TEXT,
      value_json TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      rev INTEGER NOT NULL DEFAULT 1,
      user_id TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    -- Real-column mirror of the desktop's schedule_entries, NOT a value_json KV
    -- blob. The phone edits a schedule (add/edit/delete a class or appointment) and
    -- the desktop has to apply those edits to its own real columns, so a KV blob
    -- would be unreadable on the other side. "deleted" is honoured for hard-delete
    -- parity with the other synced tables, and "updated_at" is what pull filters
    -- on, so it MUST be written by every writer (the push handler mirrors
    -- created_at into it when a client omits it).
    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT,
      -- Deliberately NOT NULL-free. This is a sync TRANSPORT, not a validator, and
      -- clients legitimately send PARTIAL rows (only the fields that changed) — the
      -- DO UPDATE clause is built from the supplied columns alone. SQLite checks a
      -- NOT NULL column against the candidate insert row BEFORE it resolves the
      -- conflict, so "title TEXT NOT NULL" made every partial update die with
      -- "NOT NULL constraint failed: schedule_entries.title" even though the row
      -- already existed and was about to be updated. Verified by hand on a real DB.
      title TEXT,
      location TEXT,
      day_of_week INTEGER,
      start_time TEXT,
      end_time TEXT,
      category TEXT,
      color TEXT,
      is_recurring INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user ON terminal_sessions(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_terminal_messages_user ON terminal_messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_workspace_problems_user ON workspace_problems(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_workspace_requests_user ON workspace_requests(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_pairing_codes_expires ON pairing_codes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_learn_lessons_user ON learn_lessons(user_id, part);
    CREATE INDEX IF NOT EXISTS idx_learn_progress_user ON learn_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_phone_telemetry_user ON phone_telemetry(user_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_phone_telemetry_device ON phone_telemetry(device_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_finance_user ON finance(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_learning_user ON learning(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_phone_tracking_user ON phone_tracking(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_schedule_entries_user ON schedule_entries(user_id, updated_at);
  `)

  // Migration: add device_id to existing tables (safe to run repeatedly)
  const alterTables = [
    "terminal_sessions",
    "terminal_messages",
    "workspace_problems",
    "workspace_requests",
  ]
  for (const table of alterTables) {
    try {
      await db.execute({
        sql: `ALTER TABLE ${table} ADD COLUMN device_id TEXT`,
        args: [],
      })
    } catch {
      // Column already exists — ignore
    }
  }

  // Migration: add password_hash to users (for email/password auth)
  try {
    await db.execute({ sql: `ALTER TABLE users ADD COLUMN password_hash TEXT`, args: [] })
  } catch { /* already exists */ }

  // Migration: add user_id to pairing_codes (so pair endpoint knows which user to join)
  try {
    await db.execute({ sql: `ALTER TABLE pairing_codes ADD COLUMN user_id TEXT`, args: [] })
  } catch { /* already exists */ }

  console.log("[db] schema initialized")
}

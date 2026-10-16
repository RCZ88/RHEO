// Migration 001: messaging (additive). All ALTERs safe for existing rows because
// of addColumnIfMissing; the result-directory schema lives here.
export const MIGRATION_001 = [
  "ALTER TABLE connector_items ADD COLUMN remote_id TEXT",
  "ALTER TABLE connector_items ADD COLUMN conversation_id TEXT",
  "ALTER TABLE connector_items ADD COLUMN direction TEXT",
  "ALTER TABLE connector_items ADD COLUMN sender_id TEXT",
  "ALTER TABLE connector_items ADD COLUMN sender_name TEXT",
  "ALTER TABLE connector_items ADD COLUMN body TEXT",
  "ALTER TABLE connector_items ADD COLUMN content_type TEXT",
  "ALTER TABLE connector_items ADD COLUMN reply_to_remote_id TEXT",
  "ALTER TABLE connector_items ADD COLUMN edited_at TEXT",
  "ALTER TABLE connector_items ADD COLUMN deleted_at TEXT",
  "ALTER TABLE connector_items ADD COLUMN ingested_at TEXT",

  "CREATE UNIQUE INDEX IF NOT EXISTS ux_ci_remote ON connector_items(connector_id, remote_id) WHERE remote_id IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS idx_ci_conn_date ON connector_items(connector_id, date DESC)",
  "CREATE INDEX IF NOT EXISTS idx_ci_conv_date ON connector_items(conversation_id, date DESC) WHERE conversation_id IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS idx_ci_unread ON connector_items(connector_id, date DESC) WHERE is_read = 0",

  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    remote_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT,
    avatar_path TEXT,
    participant_count INTEGER,
    last_message_at TEXT,
    last_message_preview TEXT,
    last_sender_name TEXT,
    sync_cursor TEXT,
    left_at TEXT,
    deleted_at TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS ux_conv_remote ON conversations(connector_id, remote_id)",
  "CREATE INDEX IF NOT EXISTS idx_conv_recent ON conversations(connector_id, last_message_at DESC) WHERE deleted_at IS NULL",

  `CREATE TABLE IF NOT EXISTS connector_participants (
    connector_id TEXT NOT NULL,
    remote_id TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    avatar_path TEXT,
    fetched_at TEXT,
    is_self INTEGER DEFAULT 0,
    PRIMARY KEY (connector_id, remote_id),
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS connector_state (
    connector_id TEXT PRIMARY KEY,
    cursor TEXT,
    last_poll_at TEXT,
    last_success_at TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    backoff_until TEXT,
    live_mode TEXT DEFAULT 'off',
    extra TEXT,
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS webhook_receipts (
    connector_id TEXT NOT NULL,
    delivery_key TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (connector_id, delivery_key)
  )`,

  `CREATE TABLE IF NOT EXISTS dead_letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connector_id TEXT NOT NULL,
    source TEXT NOT NULL,
    raw TEXT NOT NULL,
    error TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))",
]

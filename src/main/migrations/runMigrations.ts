import type Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

interface MigrationRow {
  version: number
  applied_at: string
}

function ensureMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db.prepare('SELECT version FROM schema_migrations').all() as MigrationRow[]
  return new Set(rows.map(r => r.version))
}

export function runMigrations(db: Database.Database) {
  ensureMigrationsTable(db)
  const applied = getAppliedVersions(db)

  const migrations = [
    { version: 1, file: '001_relax_role_check.sql' },
    { version: 2, file: '002_stt_transcripts.sql' },
  ]

  for (const m of migrations) {
    if (applied.has(m.version)) continue

    const sql = readFileSync(join(__dirname, m.file), 'utf8')
    const tx = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version)
    })
    tx()

    console.log(`[Migration] Applied v${m.version}: ${m.file}`)
  }

  // Corrective data fix (v2): chat timestamps were stored as UTC wall-clock
  // strings but the renderer parses "YYYY-MM-DD HH:MM:SS" as LOCAL time, so
  // every message showed ~7h (GMT+7) off. We transpose stored UTC -> localtime.
  // Also: word_tracker_counts rows from the no-project scan path had `count`
  // and `project_id` columns swapped (count=NULL, project_id=<real count>).
  if (!applied.has(2)) {
    const tx = db.transaction(() => {
      db.exec(`UPDATE ai_chat_messages SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL`)
      db.exec(`UPDATE ai_chat_threads SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL`)
      db.exec(`UPDATE word_tracker_counts SET count = project_id, project_id = NULL WHERE count IS NULL AND project_id IS NOT NULL`)
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(2)
    })
    try {
      tx()
      console.log('[Migration] Applied v2: fix chat timestamp timezone + word_tracker counts')
    } catch (e) {
      console.error('[Migration] v2 failed (tables may not exist yet):', e)
    }
  }
}

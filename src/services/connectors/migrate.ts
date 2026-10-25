import * as fs from 'node:fs'
import { MIGRATION_001 } from './migrations/001-messaging'

function addColumnIfMissing(db: any, table: string, ddl: string, col: string) {
  const has = (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).some(c => c.name === col)
  if (!has) db.exec(ddl)
}

export function migrateConnectors(db: any, dbPath: string) {
  // Ensure schema_migrations table exists with the correct schema. If a previous
  // version created it with a different column layout (e.g. `version` instead
  // of `id`), drop and recreate so the migration check below doesn't crash.
  const cols = (db.prepare(`PRAGMA table_info(schema_migrations)`).all() as any[]).map(c => c.name)
  if (cols.length > 0 && !cols.includes('id')) {
    db.exec(`DROP TABLE schema_migrations`)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))`)
  if (db.prepare(`SELECT 1 FROM schema_migrations WHERE id='001-messaging'`).get()) return

  const backup = `${dbPath}.pre-messaging.bak`
  if (!fs.existsSync(backup)) {
    try { db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`) } catch {}
  }

  db.transaction(() => {
    for (const stmt of MIGRATION_001) {
      const m = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/.exec(stmt)
      if (m) addColumnIfMissing(db, m[1], stmt, m[2])
      else db.exec(stmt)
    }
    db.prepare(`INSERT INTO schema_migrations(id) VALUES ('001-messaging')`).run()
  })()
}

import * as fs from 'node:fs'
import { MIGRATION_001 } from './migrations/001-messaging'

function addColumnIfMissing(db: any, table: string, ddl: string, col: string) {
  const has = (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).some(c => c.name === col)
  if (!has) db.exec(ddl)
}

export function migrateConnectors(db: any, dbPath: string) {
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

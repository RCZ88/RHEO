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
    // v3 and v4 are inline corrective blocks below (they need PRAGMA diffing,
    // which a .sql file cannot express).
    { version: 5, file: '005_substrate_repair.sql' },
    { version: 6, file: '006_training_log.sql' },
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

  // Corrective data fix (v3): chat timestamps were stored as UTC wall-clock
  // strings but the renderer parses "YYYY-MM-DD HH:MM:SS" as LOCAL time, so
  // every message showed ~7h (GMT+7) off. We transpose stored UTC -> localtime.
  // Also: word_tracker_counts rows from the no-project scan path had `count`
  // and `project_id` columns swapped (count=NULL, project_id=<real count>).
  // Version 3, NOT 2: the file-migration list above already applies version 2
  // (002_stt_transcripts.sql), so claiming 2 here collided on the PRIMARY KEY and
  // the whole corrective fix rolled back on every boot.
  if (!applied.has(3)) {
    // Each correction is guarded by its own table's existence. `word_tracker_counts`
    // is created by a lazily-initialised module, so it is often absent here — and
    // because all three shared one transaction, that single missing table threw,
    // rolled back the chat-timezone fix as well, and then failed again every boot.
    const hasTable = (name: string) => {
      try {
        return !!db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
          .get(name)
      } catch {
        return false
      }
    }

    const skipped: string[] = []
    const tx = db.transaction(() => {
      for (const t of ['ai_chat_messages', 'ai_chat_threads']) {
        if (!hasTable(t)) { skipped.push(t); continue }
        db.exec(`UPDATE ${t} SET created_at = datetime(created_at, 'localtime') WHERE created_at IS NOT NULL`)
      }
      if (hasTable('word_tracker_counts')) {
        db.exec(`UPDATE word_tracker_counts SET count = project_id, project_id = NULL WHERE count IS NULL AND project_id IS NOT NULL`)
      } else {
        skipped.push('word_tracker_counts')
      }
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(3)
    })
    try {
      tx()
      console.log(
        skipped.length
          ? `[Migration] Applied v3: chat timestamp timezone fix (skipped absent tables: ${skipped.join(', ')})`
          : '[Migration] Applied v3: fix chat timestamp timezone + word_tracker counts'
      )
    } catch (e: any) {
      console.error('[Migration] v3 corrective fix failed:', e?.message || e)
    }
  }

  // Corrective schema fix (v4): `stt_transcripts` gained columns it did not
  // always have.
  //
  // 002_stt_transcripts.sql uses `CREATE TABLE IF NOT EXISTS`, which is a NO-OP
  // when the table already exists. So a database created by an EARLIER version
  // of that file kept the old, narrower shape forever, and the save handler
  // then died with:
  //   SqliteError: table stt_transcripts has no column named title
  // which broke dictation end to end — the transcript was recorded and then
  // silently lost on save.
  //
  // SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so the columns are
  // diffed against `PRAGMA table_info` first. The expected list is the FULL set
  // from 002 rather than just the four known-missing ones, so a database that
  // drifted any other way is repaired by the same pass.
  if (!applied.has(4)) {
    try {
      const hasStt = !!db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='stt_transcripts'`)
        .get()

      if (!hasStt) {
        // Never created on this machine (the feature was never used); 002 will
        // create it correctly on a fresh database.
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(4)
        console.log('[Migration] v4: stt_transcripts absent, nothing to repair')
      } else {
        const cols = (db.prepare(`PRAGMA table_info(stt_transcripts)`).all() as any[])
          .map(c => String(c.name))

        const expected: Array<[string, string]> = [
          ['title', 'TEXT'],
          ['note', 'TEXT'],
          ['prompt', 'TEXT'],
          ['project', 'TEXT'],
          ['created_at', "TEXT NOT NULL DEFAULT ''"],
          ['duration_ms', 'INTEGER NOT NULL DEFAULT 0'],
          ['category', "TEXT NOT NULL DEFAULT 'other'"],
          ['tags', "TEXT NOT NULL DEFAULT '[]'"],
          ['project_id', 'TEXT'],
          ['project_name', 'TEXT'],
          ['is_favorite', 'INTEGER NOT NULL DEFAULT 0'],
          ['source', 'TEXT'],
        ]

        const missing = expected.filter(([name]) => !cols.includes(name))

        if (missing.length === 0) {
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(4)
          console.log('[Migration] v4: stt_transcripts already current')
        } else {
          const tx = db.transaction(() => {
            for (const [name, type] of missing) {
              db.exec(`ALTER TABLE stt_transcripts ADD COLUMN ${name} ${type}`)
            }
            // Backfill so the NOT NULL defaults are never empty strings that
            // the renderer would try to parse as a date.
            db.exec(
              `UPDATE stt_transcripts
                  SET created_at = datetime('now')  WHERE created_at IS NULL OR created_at = ''`,
            )
            db.exec(`UPDATE stt_transcripts SET tags    = '[]' WHERE tags    IS NULL OR tags    = ''`)
            db.exec(`UPDATE stt_transcripts SET category = 'other' WHERE category IS NULL OR category = ''`)
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(4)
          })
          tx()
          console.log(
            `[Migration] v4: added missing stt_transcripts columns: ${missing.map(m => m[0]).join(', ')}`,
          )
        }
      }
    } catch (e: any) {
      console.error('[Migration] v4 stt_transcripts repair failed:', e?.message || e)
    }
  }

  // Corrective schema fix (v6): `goals` gained six columns that only ever
  // existed in CZ's database.
  //
  // `goalToRow()` in src/types/goals.ts writes all six on every serialisation:
  //
  //     completion_config · tracking_mode · cadence_config
  //     cross_feature_link · external_activity_id · match_apps
  //
  // but no CREATE TABLE and no ALTER TABLE for them exists anywhere in the
  // repository or in git history. On a database built from current source they
  // are simply absent, so any write touching them fails on a fresh install
  // while working fine on this machine.
  //
  // `completion_config` is the consequential one: it carries `streakOnMiss`,
  // which GoalCompletionEngine reads to choose between reset / continue /
  // pause. With the column missing the read throws, the caller swallows it, and
  // every goal silently behaves as the harshest option.
  //
  // SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and CZ's database
  // already has these, so the expected FULL set is diffed against
  // `PRAGMA table_info` first — the same approach v4 uses.
  if (!applied.has(6)) {
    try {
      const hasGoals = !!db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='goals'`)
        .get()

      if (!hasGoals) {
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(6)
        console.log('[Migration] v6: goals absent, nothing to repair')
      } else {
        const cols = (db.prepare(`PRAGMA table_info(goals)`).all() as any[]).map((c) => String(c.name))

        // Defaults are copied verbatim from what CZ's live database already
        // holds, so an upgraded database and a fresh one behave identically.
        const expected: Array<[string, string]> = [
          ['completion_config', `TEXT DEFAULT '{"lateAllowed":false,"gracePeriodMinutes":0,"partialCredit":false,"partialCreditThreshold":80,"streakOnMiss":"reset"}'`],
          ['tracking_mode', "TEXT DEFAULT 'manual'"],
          ['cadence_config', `TEXT DEFAULT '{"type":"fixed","fixedDays":[],"rollingTarget":1,"flexibleWindowDays":7}'`],
          ['cross_feature_link', 'TEXT'],
          ['external_activity_id', 'INTEGER'],
          ['match_apps', 'TEXT'],
        ]

        const missing = expected.filter(([name]) => !cols.includes(name))

        if (missing.length === 0) {
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(6)
          console.log('[Migration] v6: goals already current')
        } else {
          const tx = db.transaction(() => {
            for (const [name, type] of missing) {
              db.exec(`ALTER TABLE goals ADD COLUMN ${name} ${type}`)
            }
            // Backfill NULLs so a row written before this migration reads as a
            // valid config rather than failing JSON.parse at every read site.
            db.exec(
              `UPDATE goals SET completion_config = '{"lateAllowed":false,"gracePeriodMinutes":0,"partialCredit":false,"partialCreditThreshold":80,"streakOnMiss":"reset"}'
                WHERE completion_config IS NULL OR completion_config = ''`,
            )
            db.exec(
              `UPDATE goals SET cadence_config = '{"type":"fixed","fixedDays":[],"rollingTarget":1,"flexibleWindowDays":7}'
                WHERE cadence_config IS NULL OR cadence_config = ''`,
            )
            db.exec(`UPDATE goals SET tracking_mode = 'manual' WHERE tracking_mode IS NULL OR tracking_mode = ''`)
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(6)
          })
          tx()
          console.log(
            `[Migration] Applied v6: added missing goals columns: ${missing.map((m) => m[0]).join(', ')}`,
          )
        }
      }
    } catch (e: any) {
      console.error('[Migration] v6 goals repair failed:', e?.message || e)
    }
  }

  // v7: give `life_phases` the columns that make a PHASE set rules rather than
  // just describe a period (feature 5).
  //
  // A phase was a dated narrative card with a title and a mood. "Learn" vs
  // "burn-down" is not a description of a period, it is a SET OF RULES the app
  // enforces — new material blocked, a daily checklist, a different floor.
  // Those rules need somewhere to live, and they belong on the phase.
  //
  // `training_mode` is constrained to the two modes in `shared/phaseRules.ts`
  // (enforced in code, for the same reason `pattern` is not a CHECK).
  // `daily_checklist_json` is the checklist that SWAPS when the phase flips —
  // the feature's actual requirement.
  // `plan_mode_armed` exists so the plan-mode guard can only ever be ON if CZ
  // turned it on for this phase. A guard that arms itself is indistinguishable
  // from a bug.
  if (!applied.has(7)) {
    try {
      const hasPhases = !!db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='life_phases'`)
        .get()

      if (!hasPhases) {
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(7)
        console.log('[Migration] v7: life_phases absent, nothing to repair')
      } else {
        const cols = (db.prepare(`PRAGMA table_info(life_phases)`).all() as any[]).map((c) => String(c.name))
        const expected: Array<[string, string]> = [
          ['training_mode', "TEXT DEFAULT 'learn'"],
          ['daily_checklist_json', "TEXT DEFAULT '[]'"],
          ['review_floor_minutes', 'INTEGER'],
          ['plan_mode_armed', 'INTEGER NOT NULL DEFAULT 0'],
        ]
        const missing = expected.filter(([name]) => !cols.includes(name))

        if (missing.length === 0) {
          db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(7)
          console.log('[Migration] v7: life_phases already current')
        } else {
          const tx = db.transaction(() => {
            for (const [name, type] of missing) {
              db.exec(`ALTER TABLE life_phases ADD COLUMN ${name} ${type}`)
            }
            // Backfill so an existing phase has a usable checklist rather than an
            // empty one that renders as "no checklist" on first open.
            db.exec(
              `UPDATE life_phases SET training_mode = 'learn'
                WHERE training_mode IS NULL OR training_mode NOT IN ('learn','burn_down')`,
            )
            db.exec(
              `UPDATE life_phases SET daily_checklist_json = '[]'
                WHERE daily_checklist_json IS NULL OR daily_checklist_json = ''`,
            )
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(7)
          })
          tx()
          console.log(
            `[Migration] Applied v7: added missing life_phases columns: ${missing.map((m) => m[0]).join(', ')}`,
          )
        }
      }
    } catch (e: any) {
      console.error('[Migration] v7 life_phases repair failed:', e?.message || e)
    }
  }
}

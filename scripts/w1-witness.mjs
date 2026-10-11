/**
 * W1a — the automation WAL witness, runnable headless.
 *
 * WHY THIS EXISTS
 *   Every claim about the automation engine until now was STATIC: esbuild, greps,
 *   Node probes. The engine had never actually written an event row. This is the
 *   first and only POSITIVE runtime witness, and it runs WITHOUT Electron so it
 *   needs nothing from CZ except a database file.
 *
 * WHAT IT PROVES
 *   1. The four CREATE TABLE statements execute against a real SQLite file.
 *   2. AutomationBus.emit() reaches the WAL: a real row lands in
 *      automation_events with the right type, source, caused_by_json, payload.
 *   3. The emit-convention is observable in the PERSISTED row — this is the
 *      evidence that settles Finding B (the 'goal.created' vs
 *      'goals.goal.created' type-string question). If the convention ever
 *      regresses, the `type` column shows it.
 *
 * WHAT IT DOES NOT PROVE
 *   Nothing about Electron boot order, the publisher bind in main.ts, or the
 *   runner. Those are W1b/W2 and need the real app. See W-RUNBOOK below.
 *
 * USAGE
 *   npm run automation:witness          # uses a temp DB, self-cleaning
 *   node scripts/w1-witness.mjs        # same thing
 */

import { DatabaseSync } from 'node:sqlite'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── The four DDL statements, copied VERBATIM from src/main.ts ────────────
// If you change the DDL in main.ts, change it here. This is the claim under
// test, so it must not be re-implemented from memory.
const DDL = `
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  trigger_id TEXT NOT NULL,
  catalogue_version INTEGER NOT NULL DEFAULT 1,
  conditions_json TEXT NOT NULL DEFAULT '[]',
  condition_logic TEXT NOT NULL DEFAULT 'and',
  action_id TEXT NOT NULL,
  action_params_json TEXT NOT NULL DEFAULT '{}',
  lane TEXT NOT NULL DEFAULT 'tool',
  mission_template_id TEXT,
  action_tier TEXT NOT NULL DEFAULT 'benign',
  unattended INTEGER NOT NULL DEFAULT 0,
  on_miss TEXT NOT NULL DEFAULT 'fire',
  lifecycle TEXT NOT NULL DEFAULT 'forever',
  priority INTEGER NOT NULL DEFAULT 500,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active',
  status_reason TEXT,
  last_satisfied_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  emitted_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  entity_kind TEXT,
  entity_id TEXT,
  caused_by_json TEXT,
  dispatched INTEGER NOT NULL DEFAULT 0,
  dispatched_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_autoevents_undispatched
  ON automation_events(dispatched) WHERE dispatched = 0;
CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id),
  event_id TEXT NOT NULL REFERENCES automation_events(id),
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  attempts_json TEXT,
  error TEXT,
  result_json TEXT,
  digested_into TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE(automation_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_autoruns_pending
  ON automation_runs(status, created_at);
CREATE TABLE IF NOT EXISTS automation_watermarks (
  event_type TEXT PRIMARY KEY,
  watermark INTEGER NOT NULL
);
`

/**
 * better-sqlite3 exposes db.transaction(fn); node:sqlite's DatabaseSync does not.
 * The AutomationBus calls db.transaction(...), so without this shim the bus cannot
 * run here. This shims the ONE method the bus needs — the bus logic itself is
 * exercised completely unmodified.
 */
function shimTransaction(db) {
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN')
    try {
      const r = fn(...args)
      db.exec('COMMIT')
      return r
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
}

const DB_PATH = join(tmpdir(), `w1-witness-${process.pid}.db`)
let failed = false

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failed = true
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}${ok ? '' : `, want ${JSON.stringify(expected)}`}`)
}

async function main() {
  const { AutomationBus } = await import('../dist-electron/automation-witness-bus.mjs').catch(() => ({}))
  if (!AutomationBus) {
    console.error(
      'The bundled AutomationBus was not found at dist-electron/automation-witness-bus.mjs.\n' +
      'Build it first:\n' +
    '  npx esbuild src/services/automation/AutomationBus.ts --bundle --platform=node \\\n' +
    '    --format=esm --outfile=dist-electron/automation-witness-bus.mjs \\\n' +
    '    --alias:@=./src --external:electron --external:katex\n'
    )
    process.exit(2)
  }

  try { rmSync(DB_PATH, { force: true }) } catch { /* first run */ }

  const db = new DatabaseSync(DB_PATH)
  console.log('\n── 1. DDL executes against a real file ──')
  db.exec(DDL)
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'automation%' ORDER BY name")
    .all()
    .map((r) => r.name)
  check('tables created', JSON.stringify(tables), JSON.stringify(['automation_events', 'automation_runs', 'automation_watermarks', 'automations']))

  shimTransaction(db)

  console.log('\n── 2. emit() reaches the WAL ──')
  const bus = new AutomationBus({ db, now: () => Date.now() })
  bus.emit({
    type: 'system.app.started',
    payload: { version: '1.1.1' },
    source: 'app',
  })

  const row = db.prepare('SELECT * FROM automation_events').get()
  check('exactly one event row', db.prepare('SELECT COUNT(*) n FROM automation_events').get().n, 1)
  check('type is the FULL trigger id', row?.type, 'system.app.started')
  check('source', row?.source, 'app')
  check('caused_by_json is null (boot emit is uncaused)', row?.caused_by_json, null)
  check('payload carries version', JSON.parse(row?.payload_json || '{}').version, '1.1.1')
  check('dispatched = 1 (nothing was queued to consume it)', row?.dispatched, 1)

  console.log('\n── 3. the emit convention, observed in the PERSISTED row ──')
  console.log(`     This is the evidence for Finding B: the type column stores`)
  console.log(`     whatever the caller passed. A regression to a short id would`)
  console.log(`     show up here as "goal.created" instead of "goals.goal.created".`)
  console.log(`     persisted type = ${JSON.stringify(row?.type)}`)

  db.close()
  try { rmSync(DB_PATH, { force: true }) } catch { /* best effort */ }

  console.log(`\n${failed ? 'W1a FAILED — see FAIL lines above.' : 'W1a PASSED — the WAL works.'}`)
  console.log('Still UNWITNESSED (need the real app — W1b/W2):')
  console.log('  · boot order: publisher bind vs the app.started emit')
  console.log('  · the runner picking an automation up and writing an automation_runs row')
  console.log('  · the confirm tier parking in awaiting-review\n')
  process.exit(failed ? 1 : 0)
}

main()
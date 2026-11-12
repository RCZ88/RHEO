/**
 * brain-f12-f7-redact.probe.mjs — runs the REAL contextBrain/predicates/redact
 * code against a mock db and prints numbers for:
 *   F12  multi-cardinality 'discussed' (different objects coexist, exact edge dedupes)
 *   F12  single-cardinality closure ('has_status' closes the old fact)
 *   F7   logEpisode occurredAt (valid historical time preserved; invalid → now + warn)
 *   B1   redactSecrets (key/jwt/bearer)
 * Exit 0 only if every assertion passes.
 */
import * as brain from '../../src/main/ai/contextBrain'
import { redactSecrets } from '../../src/main/ai/redact'
import { cardinalityOf, PREDICATES } from '../../src/main/ai/predicates'

let failures = 0
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  → ${JSON.stringify(detail)}`)
  if (!cond) failures++
}

// ── mock better-sqlite3 db (only the statements contextBrain.addFact/logEpisode use) ──
function mockDb() {
  const facts = []
  const eps = []
  return {
    facts, eps,
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim()
      if (s.startsWith('INSERT INTO context_facts'))
        return { run: (...a) => { facts.push({ id: a[0], subject: a[1], pred: a[2], obj: a[3], lit: a[4], from: a[5], to: null }); return { changes: 1 } } }
      if (s.startsWith('UPDATE context_facts SET valid_to = ? WHERE id = ?'))
        return { run: (to, id) => { const f = facts.find(x => x.id === id); if (f) f.to = to; return { changes: f ? 1 : 0 } } }
      if (s.startsWith('SELECT id FROM context_facts WHERE subject_id = ? AND predicate = ? AND valid_to IS NULL AND object_id IS'))
        return { get: (subj, pred, obj, lit) => facts.find(x => x.subject === subj && x.pred === pred && x.to === null && x.obj === obj && x.lit === lit) || undefined }
      if (s.startsWith('SELECT id FROM context_facts WHERE subject_id = ? AND predicate = ? AND valid_to IS NULL'))
        return { get: (subj, pred) => facts.find(x => x.subject === subj && x.pred === pred && x.to === null) || undefined }
      if (s.startsWith('INSERT INTO context_episodes'))
        return { run: (...a) => { eps.push({ id: a[0], occurred: a[4], ingested: a[5] }); return { changes: 1 } } }
      throw new Error('unmocked SQL: ' + s.slice(0, 90))
    },
  }
}

const db = mockDb()
brain.setBrainDb(db)

// ── F12: discussed is multi-valued ──
const subj = 'ent_ai_provider_Chatgpt'
const e1 = brain.addFact(subj, PREDICATES.DISCUSSED, 'React', 'ep1', 'ent_concept_react')
const e2 = brain.addFact(subj, PREDICATES.DISCUSSED, 'SQLite', 'ep1', 'ent_concept_sqlite')
const active = db.facts.filter((f) => f.to === null)
check('F12 both discussed objects active', active.length === 2, { active: active.map((f) => f.lit) })

// dedupe: exact same edge returns the existing id, adds no row
const e3 = brain.addFact(subj, PREDICATES.DISCUSSED, 'React', 'ep1', 'ent_concept_react')
const activeAfterDup = db.facts.filter((f) => f.to === null)
check('F12 exact edge dedupes', e3 === e1 && activeAfterDup.length === 2, { returnedSameId: e3 === e1, active: activeAfterDup.length })

// ── F12: has_status stays single-value (closure) ──
const s1 = brain.addFact(subj, PREDICATES.HAS_STATUS, 'active', 'ep1')
const s2 = brain.addFact(subj, PREDICATES.HAS_STATUS, 'done', 'ep1')
const statusActive = db.facts.filter((f) => f.pred === 'has_status' && f.to === null)
check('F12 single-cardinality closes old', s2 !== s1 && statusActive.length === 1 && statusActive[0].lit === 'done', { active: statusActive.map((f) => f.lit) })

// cardinality registry sanity
check('cardinalityOf defaults to single', cardinalityOf('has_status') === 'single' && cardinalityOf(PREDICATES.DISCUSSED) === 'multi', { discussed: cardinalityOf(PREDICATES.DISCUSSED) })

// ── F7: occurredAt preserved ──
const hist = '2026-08-27T16:15:10.675Z'
brain.logEpisode('external_ai', 'test content', 'ref', {}, hist)
const ep = db.eps[db.eps.length - 1]
check('F7 valid historical occurredAt preserved', ep.occurred === hist, { occurred: ep.occurred })
check('F7 ingested_at stays now', ep.ingested !== hist && !Number.isNaN(new Date(ep.ingested).getTime()), { ingested: ep.ingested })

// F7: invalid → now + warned (stderr shows the [Brain] warn)
brain.logEpisode('goals', 'bad ts content', 'ref2', {}, 'not-a-date')
const epBad = db.eps[db.eps.length - 1]
check('F7 invalid ts falls back to now with warn', epBad.occurred === epBad.ingested, { occurred: epBad.occurred })

// F7: no arg → now (backward compatible)
brain.logEpisode('goals', 'no ts content', 'ref3', {})
const epNow = db.eps[db.eps.length - 1]
check('F7 backward compatible (no occurredAt)', epNow.occurred === epNow.ingested, { occurred: epNow.occurred })

// ── B1: redactSecrets ──
const samples = [
  'my key is sk-abcdefghijklmnopqrstuvwx',
  'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jWm8C4vLMABc5CvKIRImHgJGMxuSTVw here',
  'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
]
const redacted = samples.map(s => redactSecrets(s))
check('B1 sk- key redacted', !/sk-abc/.test(redacted[0]), { out: redacted[0] })
check('B1 jwt redacted', !/eyJhbGci/.test(redacted[1]), { out: redacted[1].slice(0, 40) })
check('B1 bearer redacted', !/abcdefghijklmnopqrstuvwxyz/.test(redacted[2]), { out: redacted[2] })
check('B1 plain text untouched', redactSecrets('hello world, discussed React') === 'hello world, discussed React', {})

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)

/**
 * brain-backfill-f2-f3.probe.mjs — runs the REAL contextBackfill.backfillCaptures()
 * and relinkLegacyFacts() against a mock db and prints numbers:
 *   F2  match-first (existing episode → re-mark, never duplicate)
 *   F2  dryRun (no writes) + abort guard (>maxCreate without force → aborted)
 *   F2  TEXT-epoch-ms timestamp normalized to ISO and threaded to occurredAt (F7)
 *   F3  relinkLegacyFacts (fills object_id only for discussed + exact name match)
 * Exit 0 only if every assertion passes.
 */
import { backfillCaptures, relinkLegacyFacts, setContextDb } from '../../src/main/ai/contextBackfill'
import * as brain from '../../src/main/ai/contextBrain'

let failures = 0
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  → ${JSON.stringify(detail)}`)
  if (!cond) failures++
}

// ── mock db ──
function mockDb() {
  const captures = []
  const episodes = []
  return {
    captures, episodes,
    prepare(sql) {
      const s = sql.replace(/\s+/g, ' ').trim()
      if (s.startsWith("SELECT * FROM ai_context_captures WHERE episode_status = 'pending'"))
        return { all: () => captures.filter(c => c.episode_status === 'pending') }
      if (s.startsWith("SELECT id FROM context_episodes WHERE source = 'external_ai'"))
        return { get: (r1, r2, r3) => episodes.find(e => r1 === e.source_ref || r2 === e.source_ref || r3 === e.source_ref) || undefined }
      if (s.startsWith("UPDATE ai_context_captures SET episode_status = 'episode_written'"))
        return { run: (id) => { const c = captures.find(x => x.id === id); if (c) { c.episode_status = 'episode_written' } return { changes: c ? 1 : 0 } } }
      if (s.startsWith("UPDATE ai_context_captures SET episode_status = 'error'"))
        return { run: (msg, id) => { const c = captures.find(x => x.id === id); if (c) { c.episode_status = 'error'; c.error_message = msg } return { changes: c ? 1 : 0 } } }
      if (s.startsWith('SELECT COUNT(*) AS c FROM context_facts'))
        return { get: () => ({ c: facts.filter(f => f.object_id === null && f.pred === 'discussed' && f.lit && concepts.has(f.lit.toLowerCase())).length }) }
      if (s.startsWith('UPDATE context_facts SET object_id ='))
        return { run: () => { let n = 0; for (const f of facts) if (f.object_id === null && f.pred === 'discussed' && f.lit && concepts.has(f.lit.toLowerCase())) { f.object_id = 'ent_' + f.lit.toLowerCase(); n++ } return { changes: n } } }
      throw new Error('unmocked SQL: ' + s.slice(0, 90))
    },
  }
}

// brain.addFact/upsertEntity also need the brain db handle — reuse the F12 mock shape
const facts = []
const eps = []
const concepts = new Set(['react', 'sqlite'])
const brainDb = {
  prepare(sql) {
    const s = sql.replace(/\s+/g, ' ').trim()
    if (s.startsWith('INSERT INTO context_facts'))
      return { run: (...a) => { facts.push({ id: a[0], subject: a[1], pred: a[2], obj: a[3], lit: a[4], to: null }); return { changes: 1 } } }
    if (s.startsWith('UPDATE context_facts SET valid_to = ? WHERE id = ?'))
      return { run: (to, id) => { const f = facts.find(x => x.id === id); if (f) f.to = to; return { changes: 1 } } }
    if (s.startsWith('SELECT id FROM context_facts WHERE subject_id = ? AND predicate = ? AND valid_to IS NULL AND object_id IS'))
      return { get: (subj, pred, obj, lit) => facts.find(x => x.subject === subj && x.pred === pred && x.to === null && x.obj === obj && x.lit === lit) || undefined }
    if (s.startsWith('SELECT id FROM context_facts WHERE subject_id = ? AND predicate = ? AND valid_to IS NULL'))
      return { get: (subj, pred) => facts.find(x => x.subject === subj && x.pred === pred && x.to === null) || undefined }
    if (s.startsWith('INSERT INTO context_episodes'))
      return { run: (...a) => { eps.push({ id: a[0], source: a[1], ref: a[2], occurred: a[4] }); return { changes: 1 } } }
    if (s.startsWith('INSERT INTO context_entities') || s.startsWith('UPDATE context_entities'))
      return { run: () => ({ changes: 1 }), get: () => undefined }
    if (s.startsWith('SELECT id FROM context_entities'))
      return { get: () => undefined }
    // tolerant catch-all: the live writer also touches context_extraction_jobs
    // and upserts entities — none of those are under test here.
    return { run: () => ({ changes: 1 }), get: () => undefined, all: () => [] }
  },
}
brain.setBrainDb(brainDb)

const db = mockDb()
setContextDb(db)

// seed: capture 1 already has its episode (matched by ai_context_capture:<id>)
// capture 2 has NO episode — TEXT epoch-ms timestamp 2026-08-27T16:15:10.675Z = 1787863441180? use real value
const HIST_MS = 1787863441180
db.captures.push(
  { id: 1, provider: 'claude', messages: JSON.stringify([{ role: 'user', content: 'hello world content' }]), url: 'https://claude.ai/x', title: 't', source: null, timestamp: String(HIST_MS), captured_at: HIST_MS, episode_status: 'pending', error_message: null },
  { id: 2, provider: 'chatgpt', messages: JSON.stringify([{ role: 'user', content: 'discussing react and sqlite' }]), url: 'https://chatgpt.com/y', title: 't2', source: null, timestamp: String(HIST_MS), captured_at: HIST_MS, episode_status: 'pending', error_message: null },
)
db.episodes.push({ id: 'ep_existing', source: 'external_ai', source_ref: 'ai_context_capture:1', occurred: null })

// ── dryRun: reports without writing ──
const dry = backfillCaptures({ dryRun: true })
check('F2 dryRun: 1 alreadyHadEpisode, 1 wouldCreate, 0 created',
  dry.scanned === 2 && dry.alreadyHadEpisode === 1 && dry.wouldCreate === 1 && dry.created === 0,
  { scanned: dry.scanned, had: dry.alreadyHadEpisode, would: dry.wouldCreate, created: dry.created })
check('F2 dryRun wrote nothing', db.captures[1].episode_status === 'pending', { status: db.captures[1].episode_status })

// ── real run: creates the missing one through the live writer path ──
const r = backfillCaptures({})
check('F2 real run: created 1, failed 0, no abort', r.created === 1 && r.failed === 0 && !r.aborted, { created: r.created, failed: r.failed, aborted: r.aborted })
check('F2 capture 1 re-marked', db.captures[0].episode_status === 'episode_written', { s1: db.captures[0].episode_status })
check('F2 capture 2 marked after create', db.captures[1].episode_status === 'episode_written', { s2: db.captures[1].episode_status })

// the created episode carries the normalized historical timestamp (F7 path)
const newEp = eps[eps.length - 1]
check('F2 timestamp normalized TEXT-ms → ISO occurredAt', newEp && newEp.occurred === new Date(HIST_MS).toISOString(), { occurred: newEp && newEp.occurred, expect: new Date(HIST_MS).toISOString() })
check('F2 source_ref is ai_context_capture:<id>', newEp && newEp.ref === 'ai_context_capture:2', { ref: newEp && newEp.ref })

// ── idempotent re-run: match-first finds both, creates 0 ──
const r2 = backfillCaptures({})
check('F2 idempotent re-run: 2 matched, 0 created', r2.scanned === 0 && r2.created === 0, { scanned: r2.scanned, created: r2.created })

// ── abort guard: many unmatched + no force ──
const bigDb = mockDb()
setContextDb(bigDb)
eps.length = 0
for (let i = 1; i <= 30; i++) bigDb.captures.push({ id: i, provider: 'p', messages: '[]', url: null, title: null, source: null, timestamp: null, captured_at: null, episode_status: 'pending', error_message: null })
const r3 = backfillCaptures({})
check('F2 abort guard: >25 without force stops', !!r3.aborted && r3.created === 0 && r3.wouldCreate === 30, { aborted: r3.aborted?.slice(0, 60), created: r3.created })
const r4 = backfillCaptures({ force: true, maxCreate: 25 })
check('F2 force overrides the guard', r4.created === 30 && !r4.aborted, { created: r4.created })

// ── F3: relinkLegacyFacts ──
setContextDb(db)
facts.push(
  { id: 'f1', subject: 'ent_x', pred: 'discussed', object_id: null, lit: 'React', to: null },
  { id: 'f2', subject: 'ent_x', pred: 'discussed', object_id: null, lit: 'NoSuchConcept', to: null },
  { id: 'f3', subject: 'ent_y', pred: 'has_status', object_id: null, lit: 'React', to: null },
)
const relDry = relinkLegacyFacts(true)
check('F3 dryRun counts only discussable matches', relDry.candidates === 1 && relDry.linked === 0, { candidates: relDry.candidates })
const rel = relinkLegacyFacts(false)
check('F3 links only the matching discussed fact', rel.linked === 1, { linked: rel.linked })
check('F3 the linked fact got an object_id', facts.find(f => f.id === 'f1').object_id === 'ent_react' && facts.find(f => f.id === 'f2').object_id === null && facts.find(f => f.id === 'f3').object_id === null, { f1: facts.find(f => f.id === 'f1').object_id })

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)

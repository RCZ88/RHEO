/**
 * ContextBackfill — history catch-up for the Context Brain
 *
 * The Context Brain is a NEW system: without this pass it only ever sees
 * events that happen AFTER install, so the profile/graph start empty even
 * though months of real data exist. This miner replays EXISTING DeskFlow
 * data into episodes + signals so the brain catches up on day one.
 *
 * Idempotency: a `context_backfill_meta` table stores the last-processed
 * watermark per source. New rows created after the first run are captured
 * by the live episode writers (episodeWriters.ts) — the two paths do not
 * double-write.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as brain from './contextBrain'
import * as userContext from './userContextService'
import { writeGoalEpisode, writeLifePhaseEpisode, writeDeadlineEpisode, writeAiContextEpisode } from './episodeWriters'

let dbRef: any = null
export function setContextDb(db: any) { dbRef = db }

const BATCH_SIZE = 250
// Kept per RESULT-M6 F1.3 — deletion waits on CZ's confirm (currently unused).
const TEXT_PK_SOURCES = ['terminal_sessions', 'goals', 'life_phases', 'deadlines']
void TEXT_PK_SOURCES

function ensureMeta() {
  dbRef.exec(`CREATE TABLE IF NOT EXISTS context_backfill_meta (
    source TEXT PRIMARY KEY,
    last_id TEXT,
    run_at TEXT
  )`)
}

function getWatermark(source: string): string | null {
  const row = dbRef.prepare('SELECT last_id FROM context_backfill_meta WHERE source = ?').get(source)
  return row ? row.last_id : null
}

function setWatermark(source: string, lastId: string) {
  dbRef.prepare(`INSERT INTO context_backfill_meta (source, last_id, run_at) VALUES (?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET last_id = excluded.last_id, run_at = excluded.run_at`)
    .run(source, String(lastId), new Date().toISOString())
}

function rowId(row: any): string {
  return String(row.id)
}

// ═══ Terminal sessions — topic + agent type as interest signals + episodes ═══
function mineTerminalSessions(): number {
  const wm = getWatermark('terminal_sessions')
  const rows = wm
    ? dbRef.prepare('SELECT * FROM terminal_sessions WHERE id > ? AND topic IS NOT NULL AND topic != ? ORDER BY id ASC LIMIT ?')
        .all(wm, '', BATCH_SIZE)
    : dbRef.prepare('SELECT * FROM terminal_sessions WHERE topic IS NOT NULL AND topic != ? ORDER BY id ASC LIMIT ?')
        .all('', BATCH_SIZE)
  for (const row of rows) {
    const content = `[Terminal session] "${row.topic}" (agent: ${row.agent || 'unknown'})${row.total_tokens ? ` — ${row.total_tokens} tokens` : ''}`
    brain.logEpisode('terminal', content.slice(0, 600), row.id, {
      sessionId: row.id,
      agentType: row.agent,
      topic: row.topic,
      backfilled: true,
    })
    const signals = userContext.extractSignalsFromText(`I am working on ${row.topic}`, 'terminal')
    for (const s of signals) userContext.addSignal(s.signalType, s.content, 'terminal', s.confidence, { sourceRef: `terminal_session:${row.id}` })
    setWatermark('terminal_sessions', rowId(row))
  }
  return rows.length
}

// ═══ Terminal messages — user prompts → interest/topic signals ═══
function mineTerminalMessages(): number {
  const wm = getWatermark('terminal_messages')
  const rows = wm
    ? dbRef.prepare('SELECT id, session_id, role, content FROM terminal_messages WHERE id > ? AND role = ? ORDER BY id ASC LIMIT ?')
        .all(Number(wm), 'user', BATCH_SIZE)
    : dbRef.prepare('SELECT id, session_id, role, content FROM terminal_messages WHERE role = ? ORDER BY id ASC LIMIT ?')
        .all('user', BATCH_SIZE)
  for (const row of rows) {
    const text = String(row.content || '').slice(0, 500)
    if (text.length < 20) { setWatermark('terminal_messages', rowId(row)); continue }
    const signals = userContext.extractSignalsFromText(text, 'terminal')
    for (const s of signals) userContext.addSignal(s.signalType, s.content, 'terminal', s.confidence, { sourceRef: `terminal_msg:${row.id}` })
    setWatermark('terminal_messages', rowId(row))
  }
  return rows.length
}

// ═══ Goals — reuse the live writer so the graph stays consistent ═══
function mineGoals(): number {
  const wm = getWatermark('goals')
  const rows = wm
    ? dbRef.prepare('SELECT * FROM goals WHERE id > ? ORDER BY id ASC LIMIT ?').all(wm, BATCH_SIZE)
    : dbRef.prepare('SELECT * FROM goals ORDER BY id ASC LIMIT ?').all(BATCH_SIZE)
  for (const row of rows) {
    try { writeGoalEpisode(row, 'created') } catch {}
    setWatermark('goals', rowId(row))
  }
  return rows.length
}

// ═══ Life phases — milestones/reflections are high-value context ═══
function mineLifePhases(): number {
  const wm = getWatermark('life_phases')
  const rows = wm
    ? dbRef.prepare('SELECT * FROM life_phases WHERE id > ? ORDER BY id ASC LIMIT ?').all(wm, BATCH_SIZE)
    : dbRef.prepare('SELECT * FROM life_phases ORDER BY id ASC LIMIT ?').all(BATCH_SIZE)
  for (const row of rows) {
    try { writeLifePhaseEpisode(row, 'created') } catch {}
    setWatermark('life_phases', rowId(row))
  }
  return rows.length
}

// ═══ Deadlines — due dates/courses as goal_pattern signals ═══
function mineDeadlines(): number {
  const wm = getWatermark('deadlines')
  const rows = wm
    ? dbRef.prepare('SELECT * FROM deadlines WHERE id > ? ORDER BY id ASC LIMIT ?').all(wm, BATCH_SIZE)
    : dbRef.prepare('SELECT * FROM deadlines ORDER BY id ASC LIMIT ?').all(BATCH_SIZE)
  for (const row of rows) {
    try { writeDeadlineEpisode(row, 'created') } catch {}
    setWatermark('deadlines', rowId(row))
  }
  return rows.length
}

// ═══ Problems & requests (agent/ JSON store) — user priorities as signals ═══
function mineProblemFiles(): number {
  let mined = 0
  const projectRoot = process.cwd()
  const candidates = [
    path.join(projectRoot, 'agent', 'problems.json'),
    path.join(projectRoot, 'agent', 'requests.json'),
  ]
  for (const file of candidates) {
    const source = file.endsWith('problems.json') ? 'problems' : 'requests'
    let raw = ''
    try { raw = fs.readFileSync(file, 'utf8') } catch { continue }
    // Content-hash watermark (WP-F F1): skip the whole file when unchanged
    // since the last run — the agents rewrite these JSON stores constantly.
    const hash = crypto.createHash('sha1').update(raw).digest('hex')
    if (getWatermark('problems:' + source) === hash) continue
    let items: any[] = []
    try { items = JSON.parse(raw) } catch { continue }
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const title = item.title || item.name
      const desc = item.description || item.details || ''
      const text = `${title}${desc ? ` — ${desc}` : ''}`.slice(0, 400)
      if (text.length < 15) continue
      const signals = userContext.extractSignalsFromText(`My priority: ${text}`, source)
      for (const s of signals) userContext.addSignal(s.signalType, s.content, source, s.confidence, { sourceRef: `${source}:${item.id || item.title}` })
      mined++
    }
    setWatermark('problems:' + source, hash)
  }
  return mined
}

export function runContextBackfill(): { ok: boolean; sources: Record<string, number>; total: number } {
  const results: Record<string, number> = {}
  let total = 0
  if (!dbRef) return { ok: false, sources: results, total: 0 }
  try { ensureMeta() } catch (e: any) { console.warn('[ContextBackfill] meta init failed:', e?.message); return { ok: false, sources: results, total: 0 } }

  const miners: Array<[string, () => number]> = [
    ['terminal_sessions', mineTerminalSessions],
    ['terminal_messages', mineTerminalMessages],
    ['goals', mineGoals],
    ['life_phases', mineLifePhases],
    ['deadlines', mineDeadlines],
    ['problems', mineProblemFiles],
  ]
  for (const [name, fn] of miners) {
    try {
      // Drain guard (WP-F F1): a source with more rows than one batch keeps
      // being mined until it is caught up (bounded at 20 batches).
      let n = 0, guard = 0, sum = 0
      do { n = fn(); sum += n; guard++ } while (n >= BATCH_SIZE && guard < 20)
      results[name] = sum
      total += sum
    } catch (e: any) {
      console.warn(`[ContextBackfill] ${name} failed:`, e?.message)
      results[name] = -1
    }
  }
  if (total > 0) console.log(`[ContextBackfill] processed ${total} existing record(s) into the context brain`, results)
  else console.log('[ContextBackfill] nothing to backfill — all sources already caught up')
  return { ok: true, sources: results, total }
}

// ═══ Captures backfill (WP-F F2) — the stranded browser-extension rows ═══
// Captures whose episode was never written (the extension died ~11 weeks and
// the receiver queue never drained). Match-first so already-written rows are
// only re-marked, never duplicated.
export interface CaptureBackfillResult {
  scanned: number; alreadyHadEpisode: number; wouldCreate: number; created: number; failed: number; aborted?: string
}

export function backfillCaptures(opts: { dryRun?: boolean; maxCreate?: number; force?: boolean } = {}): CaptureBackfillResult {
  const r: CaptureBackfillResult = { scanned: 0, alreadyHadEpisode: 0, wouldCreate: 0, created: 0, failed: 0 }
  if (!dbRef) return r
  const maxCreate = opts.maxCreate ?? 25
  const rows = dbRef.prepare("SELECT * FROM ai_context_captures WHERE episode_status = 'pending' ORDER BY id ASC LIMIT 1000").all()
  // Match both the live writer's sourceRef forms: `ai_context_capture:<id>`
  // and the legacy fallbacks (url / bare provider name) used before ids were
  // threaded through. More matching here is SAFE — it prevents duplicates.
  const findEp = dbRef.prepare("SELECT id FROM context_episodes WHERE source = 'external_ai' AND source_ref IN (?, ?, ?) LIMIT 1")
  const markOk = dbRef.prepare("UPDATE ai_context_captures SET episode_status = 'episode_written', error_message = NULL WHERE id = ?")
  const markErr = dbRef.prepare("UPDATE ai_context_captures SET episode_status = 'error', error_message = ? WHERE id = ?")

  // Pass 1: match first. Most rows should already have their episode.
  const needCreate: any[] = []
  for (const row of rows) {
    r.scanned++
    if (findEp.get(`ai_context_capture:${row.id}`, row.url || null, row.provider || null)) {
      r.alreadyHadEpisode++
      if (!opts.dryRun) markOk.run(row.id)
    } else needCreate.push(row)
  }
  r.wouldCreate = needCreate.length
  if (opts.dryRun) return r
  // Abort guard: we expect about zero. A big number means the match rule is
  // wrong, not that data is missing — stop and surface it.
  if (needCreate.length > maxCreate && !opts.force) {
    r.aborted = `${needCreate.length} captures have no episode (limit ${maxCreate}). Review with dryRun, then re-run with force:true.`
    return r
  }

  // Pass 2: write the missing ones through the SAME path the live receiver
  // uses (writeAiContextEpisode). F7 (RESULT-2C) threads the capture's real
  // timestamp into occurred_at, so no post-hoc UPDATE is needed. The stored
  // `timestamp` column is TEXT epoch-ms; `captured_at` is INTEGER ms.
  for (const row of needCreate) {
    try {
      const rawMs = row.timestamp ? Number(row.timestamp) : (row.captured_at ? Number(row.captured_at) : NaN)
      writeAiContextEpisode({
        id: row.id, provider: row.provider,
        messages: JSON.parse(row.messages || '[]'),
        url: row.url || undefined, title: row.title || undefined, source: row.source || undefined,
        timestamp: Number.isFinite(rawMs) && rawMs > 0 ? new Date(rawMs).toISOString() : undefined,
      })
      markOk.run(row.id); r.created++
    } catch (e: any) { markErr.run(String(e?.message || e).slice(0, 300), row.id); r.failed++ }
  }
  return r
}

// ═══ Legacy fact relink (WP-F F3) — old facts stored subject-only ═══
// 0 of 220 facts have object_id, so the stored graph has zero real edges.
// This only fills a MISSING LINK (same value the fact already carries); it
// never changes validity dates or values.
export function relinkLegacyFacts(dryRun = false): { candidates: number; linked: number } {
  if (!dbRef) return { candidates: 0, linked: 0 }
  const where = `object_id IS NULL AND predicate = 'discussed' AND object_literal IS NOT NULL
                 AND EXISTS (SELECT 1 FROM context_entities e WHERE e.type = 'concept' AND lower(e.name) = lower(context_facts.object_literal))`
  const candidates = dbRef.prepare(`SELECT COUNT(*) AS c FROM context_facts WHERE ${where}`).get().c
  if (dryRun || candidates === 0) return { candidates, linked: 0 }
  const info = dbRef.prepare(`UPDATE context_facts SET object_id =
      (SELECT e.id FROM context_entities e WHERE e.type = 'concept' AND lower(e.name) = lower(context_facts.object_literal) LIMIT 1)
      WHERE ${where}`).run()
  return { candidates, linked: info.changes }
}
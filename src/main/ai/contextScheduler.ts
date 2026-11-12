/**
 * ContextScheduler — background workers for the context system
 * 
 * Tier 3 batch operations (spec §21):
 * - Extraction queue worker: every 60s, process pending LLM extraction jobs
 * - Signal decay recalculation: every 6h, re-score aging signals
 * - Embedding catch-up: every 30min, embed episodes missing embeddings
 * - Full profile rebuild: daily (and on-demand via IPC)
 */

import * as brain from './contextBrain'
import * as userContext from './userContextService'
import * as extraction from './entityExtraction'
import * as embeddings from './embeddingService'

let timers: Array<ReturnType<typeof setInterval>> = []
let started = false
let lastRun: Record<string, number> = {}
let dbRef: any = null

export function setSchedulerDb(db: any) { dbRef = db }

// R2 caveat (RESULT-2C): brain:evaluate reads numeric timestamps from the
// context_scheduler_state key/value table (`signal_decay.lastRun`,
// `profile.lastRebuild`) — but that table did not exist and run times were
// only held in this module's memory, so evaluate could never see a recorded
// run. Persist after every real run.
function persistRun(key: string): void {
  try {
    if (!dbRef) return
    dbRef.prepare('CREATE TABLE IF NOT EXISTS context_scheduler_state (key TEXT PRIMARY KEY, value TEXT)').run()
    dbRef.prepare(
      'INSERT INTO context_scheduler_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, String(Date.now()))
  } catch (err: any) {
    console.warn('[ContextScheduler] state persist failed:', err?.message)
  }
}

function logWorker(name: string, detail: string) {
  console.log(`[ContextScheduler] ${name}: ${detail}`)
}

async function runExtractionWorker() {
  try {
    const processed = await extraction.processPendingJobs(3)
    if (processed > 0) logWorker('extraction', `processed ${processed} job(s)`)
  } catch (err: any) {
    console.warn('[ContextScheduler] extraction worker error:', err?.message)
  }
}

function runDecayRecalc() {
  try {
    const now = Date.now()
    const signals = userContext.getSignals(undefined, undefined, 500, true)
    let updated = 0
    for (const s of signals) {
      if (!s.active || s.supersededBy) continue
      const ageDays = (now - s.lastSeenAt) / 86400000
      const halfLife = HALF_LIFE_OVERRIDES[s.signalType] ?? 90
      const decay = halfLife === Infinity ? 1 : Math.exp(-ageDays / halfLife)
      const newConf = Math.min(1, s.confidence * (0.6 + 0.4 * decay))
      if (Math.abs(newConf - s.confidence) > 0.02) {
        userContext.setSignalConfidence(s.id, newConf)
        updated++
      }
    }
    if (updated > 0) logWorker('decay', `re-scored ${updated} signal(s)`)
    persistRun('signal_decay.lastRun')
  } catch (err: any) {
    console.warn('[ContextScheduler] decay error:', err?.message)
  }
}

const HALF_LIFE_OVERRIDES: Record<string, number> = {
  correction: 365,
  preference: 180,
  communication: 180,
  habit: 60,
  interest: 90,
  milestone: Infinity,
  goal_pattern: 90,
}

function runEmbeddingCatchUp() {
  try {
    // Only run when the machine is idle-ish: skip if a reindex happened recently
    if (Date.now() - (lastRun.reindex || 0) < 30 * 60000) return
    const res = embeddings.reindexEpisodes()
    if (res.processed > 0) logWorker('embeddings', `embedded ${res.processed} episode(s), skipped ${res.skipped}`)
  } catch (err: any) {
    console.warn('[ContextScheduler] embedding error:', err?.message)
  }
}

function runNightlyRebuild() {
  try {
    userContext.rebuildProfile()
    logWorker('rebuild', 'full profile projection rebuilt')
    persistRun('profile.lastRebuild')
  } catch (err: any) {
    console.warn('[ContextScheduler] rebuild error:', err?.message)
  }
}

export function startSchedulers(): void {
  if (started) return
  started = true

  // Extraction queue worker — every 60s
  timers.push(setInterval(() => { runExtractionWorker() }, 60000))
  // Decay recalculation — every 6h
  timers.push(setInterval(() => { runDecayRecalc() }, 6 * 3600000))
  // Embedding catch-up — every 30min
  timers.push(setInterval(() => { runEmbeddingCatchUp() }, 30 * 60000))
  // Nightly full rebuild — every 24h
  timers.push(setInterval(() => { runNightlyRebuild() }, 24 * 3600000))

  // Immediate first pass (after short delay so DB is warm)
  setTimeout(() => { try { runExtractionWorker() } catch {} }, 15000)
  setTimeout(() => { try { runEmbeddingCatchUp() } catch {} }, 60000)

  logWorker('start', 'schedulers running (extraction 60s / decay 6h / embeddings 30m / rebuild 24h)')
}

export function stopSchedulers(): void {
  for (const t of timers) clearInterval(t)
  timers = []
  started = false
}

export function getSchedulerStatus(): any {
  return {
    started,
    lastRun: { ...lastRun },
    extractionAvailable: extraction.isLlmAvailable(),
    pendingJobs: (() => {
      try { return brain.getJobStats() } catch { return {} }
    })(),
  }
}

export function runNow(kind: 'extraction' | 'decay' | 'embeddings' | 'rebuild'): any {
  lastRun[kind] = Date.now()
  switch (kind) {
    case 'extraction': return runExtractionWorker()
    case 'decay': runDecayRecalc(); return { ok: true }
    case 'embeddings': runEmbeddingCatchUp(); return { ok: true }
    case 'rebuild': runNightlyRebuild(); return { ok: true }
  }
}
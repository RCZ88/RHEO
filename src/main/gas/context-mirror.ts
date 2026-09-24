// GAS Integration — Context Brain Cloud Mirror
// Bidirectional sync of facts/triples with GAS.
// Privacy tier: facts/triples ONLY — never raw episodes.
// Sync is nightly batch (not live). Failures render "sync pending".

import { GasSyncPayload, GasResponse, Triple, SyncStatus, PendingSyncEntry } from './types'
import { post, get as gasGet } from './client'
import { addToPendingQueue, getPendingQueue } from './ipc'
import { contextBrain } from '../ai/contextBrain'

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024 // 5MB chunking threshold

// ── Push: Read facts/triples from Context Brain since timestamp, POST to GAS ──

export async function pushTriples(
  triples: Triple[],
  since: number = 0,
  cursor?: string
): Promise<GasResponse> {
  // Get all current facts from Context Brain
  const allFacts = contextBrain.getAllCurrentFacts()

  if (allFacts.length === 0) {
    return { ok: true, data: { pushed: 0, message: 'No facts to sync' } }
  }

  // Filter by since if provided
  const factsToPush = since > 0
    ? allFacts.filter(f => new Date(f.validFrom).getTime() >= since)
    : allFacts

  // Convert facts to Triple format for GAS
  const triplesToSend: Triple[] = factsToPush.map(f => ({
    subject: f.subjectId,
    predicate: f.predicate,
    object: f.objectLiteral || f.objectId || '',
    confidence: f.confidence,
    sourceEpisodeId: f.sourceEpisodeId,
  }))

  // Check payload size — chunk if >5MB
  const payloadStr = JSON.stringify({ action: 'push-triples', triples: triplesToSend })
  if (payloadStr.length > MAX_PAYLOAD_BYTES && cursor) {
    // Split into chunks
    const chunkSize = Math.floor(triplesToSend.length / 2)
    const firstChunk = triplesToSend.slice(0, chunkSize)
    const secondChunk = triplesToSend.slice(chunkSize)

    const result1 = await sendTripleChunk(firstChunk, cursor)
    if (!result1.ok) return result1

    const result2 = await sendTripleChunk(secondChunk, `${cursor}_chunk2`)
    return result2
  }

  const result = await post({
    action: 'push-triples',
    triples: triplesToSend,
    since,
    cursor,
  })

  if (!result.ok && result.syncPending) {
    addToPendingQueue({ action: 'push-triples', triples: triplesToSend, since, cursor })
  }

  return result
}

async function sendTripleChunk(
  triples: Triple[],
  cursor: string
): Promise<GasResponse> {
  const result = await post({
    action: 'push-triples',
    triples,
    cursor,
  })
  return result
}

// ── Pull: GET triples from GAS, write to Context Brain via episode-writer pipeline ──

export async function pullTriples(
  since: number = 0,
  cursor?: string
): Promise<GasResponse> {
  const result = await gasGet({
    action: 'pull-triples',
    since: since.toString(),
    ...(cursor ? { cursor } : {}),
  })

  if (!result.ok) {
    if (result.syncPending) {
      addToPendingQueue({ action: 'pull-triples', triples: [], since, cursor })
    }
    return result
  }

  const data = result.data as { triples?: Triple[] }
  if (!data?.triples || data.triples.length === 0) {
    return { ok: true, data: { pulled: 0, message: 'No new triples' } }
  }

  // Write pulled triples through the existing episode-writer pipeline
  // NOT direct SQLite writes — go through contextBrain.addFact so
  // Context Brain's integrity (bitemporal facts, entity tracking) is preserved
  for (const triple of data.triples) {
    const entityId = `ent_gas_${triple.subject.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`
    contextBrain.addFact(
      entityId,
      triple.predicate,
      triple.object,
      triple.sourceEpisodeId || 'gas_sync',
      undefined,
      triple.confidence
    )
  }

  // Log a sync episode
  contextBrain.logEpisode(
    'gas-sync',
    `Pulled ${data.triples.length} triples from GAS`,
    'gas-cloud-mirror',
    { tripleCount: data.triples.length, since, cursor }
  )

  return { ok: true, data: { pulled: data.triples.length } }
}

// ── Orchestration ──

export async function nightlySync(): Promise<{ pushResult: GasResponse; pullResult: GasResponse }> {
  const pushResult = await pushTriples([])
  const pullResult = await pullTriples(Date.now() - 24 * 60 * 60 * 1000) // Since 24h ago
  return { pushResult, pullResult }
}

// ── Status ──

export async function getSyncStatus(): Promise<SyncStatus> {
  const pendingQueue = getPendingQueue()
  const lastSyncEntry = pendingQueue.length > 0
    ? Math.max(...pendingQueue.map(e => e.timestamp))
    : null

  return {
    lastSync: lastSyncEntry,
    pendingCount: pendingQueue.length,
    lastError: pendingQueue.length > 0
      ? (pendingQueue[pendingQueue.length - 1].payload as any).error || 'Sync pending'
      : null,
    isSyncing: false,
  }
}

// ── Stats ──

export function getMirrorStats(): { totalFacts: number; pendingSyncs: number } {
  const allFacts = contextBrain.getAllCurrentFacts()
  const pendingQueue = getPendingQueue()
  return {
    totalFacts: allFacts.length,
    pendingSyncs: pendingQueue.length,
  }
}

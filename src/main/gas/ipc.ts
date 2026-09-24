// GAS Integration — IPC Handlers
// Handles gas:sync and gas:export channels.
// Validates payloads, calls the client, and returns responses.
// When GAS is unreachable, stores failed payloads in pending queue.

import { ipcMain } from 'electron'
import { Database } from 'better-sqlite3'
import { GasSyncPayload, GasExportPayload, GasResponse, PendingSyncEntry } from './types'
import { post, get as gasGet } from './client'
import { loadGasSecrets } from './secrets'
import { contextBrain } from '../ai/contextBrain'
import { pushTriples, pullTriples, getSyncStatus } from './context-mirror'
import { exportToDocs, exportToSheets, exportToForms } from './exporters'

let db: Database.Database | null = null

export interface GasIpcDeps {
  db: Database.Database
}

const PENDING_QUEUE_FILE = 'gas-pending-syncs.json'

export function registerGasHandlers(deps: GasIpcDeps) {
  db = deps.db
  contextBrain.setBrainDb(db)

  // ── gas:sync channel ──
  ipcMain.handle('gas:sync', async (_event, payload: GasSyncPayload) => {
    try {
      // Validate payload
      if (!payload || !payload.action) {
        return { ok: false, error: 'INVALID_PAYLOAD' } as GasResponse
      }

      switch (payload.action) {
        case 'push-triples':
          return await handlePushTriples(payload)
        case 'pull-triples':
          return await handlePullTriples(payload)
        case 'status':
          return await handleStatus()
        default:
          return { ok: false, error: `UNKNOWN_ACTION: ${payload.action}` } as GasResponse
      }
    } catch (err: any) {
      console.error('[GAS] Sync handler error:', err)
      return { ok: false, error: err?.message || 'SYNC_HANDLER_ERROR' } as GasResponse
    }
  })

  // ── gas:export channel ──
  ipcMain.handle('gas:export', async (_event, payload: GasExportPayload) => {
    try {
      if (!payload || !payload.target) {
        return { ok: false, error: 'INVALID_PAYLOAD' } as GasResponse
      }

      switch (payload.target) {
        case 'docs':
          return await exportToDocs(payload)
        case 'sheets':
          return await exportToSheets(payload)
        case 'forms':
          return await exportToForms(payload)
        default:
          return { ok: false, error: `UNKNOWN_TARGET: ${payload.target}` } as GasResponse
      }
    } catch (err: any) {
      console.error('[GAS] Export handler error:', err)
      return { ok: false, error: err?.message || 'EXPORT_HANDLER_ERROR' } as GasResponse
    }
  })

  console.log('[GAS] ✅ IPC handlers registered')
}

async function handlePushTriples(payload: GasSyncPayload): Promise<GasResponse> {
  const secrets = loadGasSecrets()
  if (!secrets) {
    return { ok: false, error: 'GAS_NOT_CONFIGURED' }
  }

  const result = await pushTriples(payload.triples, payload.since, payload.cursor)
  return result
}

async function handlePullTriples(payload: GasSyncPayload): Promise<GasResponse> {
  const secrets = loadGasSecrets()
  if (!secrets) {
    return { ok: false, error: 'GAS_NOT_CONFIGURED' }
  }

  const result = await pullTriples(payload.since, payload.cursor)
  return result
}

async function handleStatus(): Promise<GasResponse> {
  const status = await getSyncStatus()
  const configured = loadGasSecrets() !== null
  return {
    ok: true,
    data: { ...status, configured },
  }
}

// ── Pending Queue (JSON file) ──

export function addToPendingQueue(payload: GasSyncPayload): void {
  try {
    const queue = getPendingQueue()
    const entry: PendingSyncEntry = {
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      payload,
      timestamp: Date.now(),
      retries: 0,
    }
    queue.push(entry)
    writePendingQueue(queue)
  } catch (err) {
    console.error('[GAS] Failed to add to pending queue:', err)
  }
}

export function getPendingQueue(): PendingSyncEntry[] {
  try {
    // Note: This reads from userData. In production, use a SQLite table.
    const { app } = require('electron')
    const fs = require('fs')
    const path = require('path')
    const filePath = path.join(app.getPath('userData'), PENDING_QUEUE_FILE)
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch {}
  return []
}

function writePendingQueue(queue: PendingSyncEntry[]): void {
  const { app } = require('electron')
  const fs = require('fs')
  const path = require('path')
  const filePath = path.join(app.getPath('userData'), PENDING_QUEUE_FILE)
  fs.writeFileSync(filePath, JSON.stringify(queue, null, 2), 'utf-8')
}

// GAS Integration — Nightly Scheduler
// Runs nightlySync() at a configurable time (default: 3 AM local).
// Exposes triggerSyncNow() for manual trigger.

import { nightlySync, getSyncStatus } from './context-mirror'
import { loadGasSecrets } from './secrets'

let syncInterval: NodeJS.Timeout | null = null
let lastSyncResult: any = null

interface SchedulerConfig {
  syncHour: number // 0-23, default 3 (3 AM)
  syncMinute: number // 0-59, default 0
  enabled: boolean
}

let config: SchedulerConfig = {
  syncHour: 3,
  syncMinute: 0,
  enabled: true,
}

export function getConfig(): SchedulerConfig {
  return { ...config }
}

export function setConfig(newConfig: Partial<SchedulerConfig>): void {
  config = { ...config, ...newConfig }
  restartScheduler()
}

export function triggerSyncNow(): Promise<any> {
  return nightlySync().then(result => {
    lastSyncResult = result
    return result
  }).catch(err => {
    lastSyncResult = { error: err?.message }
    return lastSyncResult
  })
}

export function getLastSyncResult(): any {
  return lastSyncResult
}

export function startScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }

  if (!config.enabled) return

  const now = new Date()
  const targetHour = config.syncHour
  const targetMinute = config.syncMinute

  // Calculate ms until next target time
  const nextSync = new Date(now)
  nextSync.setHours(targetHour, targetMinute, 0, 0)
  if (nextSync <= now) {
    nextSync.setDate(nextSync.getDate() + 1)
  }

  const delay = nextSync.getTime() - now.getTime()

  // Schedule first sync
  setTimeout(() => {
    runScheduledSync()
    // Then set interval for daily
    syncInterval = setInterval(runScheduledSync, 24 * 60 * 60 * 1000) // 24 hours
  }, delay)

  console.log(`[GAS Scheduler] Next sync at ${targetHour}:${String(targetMinute).padStart(2, '0')}`)
}

function runScheduledSync(): void {
  if (!config.enabled) return

  const secrets = loadGasSecrets()
  if (!secrets) {
    console.log('[GAS Scheduler] Skipped — GAS not configured')
    return
  }

  nightlySync()
    .then(result => {
      lastSyncResult = result
      console.log('[GAS Scheduler] Sync completed:', result)
    })
    .catch(err => {
      lastSyncResult = { error: err?.message }
      console.error('[GAS Scheduler] Sync failed:', err)
    })
}

function restartScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  if (config.enabled) {
    startScheduler()
  }
}

export function stopScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  config.enabled = false
}

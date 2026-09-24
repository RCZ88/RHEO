// React hook for polling GAS sync status from the renderer.
// Returns { lastSync, pendingCount, lastError, isSyncing }.

import { useState, useEffect, useCallback } from 'react'

interface GasSyncStatus {
  lastSync: number | null
  pendingCount: number
  lastError: string | null
  isSyncing: boolean
}

export function useGasSyncStatus(pollInterval: number = 30000): GasSyncStatus {
  const [status, setStatus] = useState<GasSyncStatus>({
    lastSync: null,
    pendingCount: 0,
    lastError: null,
    isSyncing: false,
  })

  const fetchStatus = useCallback(async () => {
    try {
      const response = await window.deskflowAPI?.gasSync?.({ action: 'status' })
      if (response?.ok && response.data) {
        setStatus({
          lastSync: response.data.lastSync,
          pendingCount: response.data.pendingCount ?? 0,
          lastError: response.data.lastError,
          isSyncing: response.data.isSyncing ?? false,
        })
      }
    } catch {
      // GAS not configured or unreachable — keep current status
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, pollInterval)
    return () => clearInterval(interval)
  }, [fetchStatus, pollInterval])

  return status
}

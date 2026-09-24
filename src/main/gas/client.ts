// GAS Integration — HTTP Client Wrapper
// Takes GAS webapp URL + auth token. Exposes post(payload) and get(params).
// Handles timeouts, retries (1 retry, 2s backoff), returns structured { ok, data?, error? }.

import { GasResponse, GasSyncPayload, GasExportPayload } from './types'
import { loadGasSecrets } from './secrets'

const DEFAULT_TIMEOUT_MS = 30000 // 30s — under GAS 6min cap
const RETRY_DELAY_MS = 2000
const MAX_RETRIES = 1

interface HttpClientDeps {
  webappUrl: string
  authToken: string
}

export async function post(payload: GasSyncPayload | GasExportPayload): Promise<GasResponse> {
  const secrets = loadGasSecrets()
  if (!secrets) {
    return { ok: false, error: 'GAS_NOT_CONFIGURED' }
  }

  const { webappUrl, authToken } = secrets
  const url = `${webappUrl}/__/functions/gasSync`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }

      const data = await response.json()
      return { ok: true, data }
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      return { ok: false, error: err?.message || 'GAS_UNREACHABLE', syncPending: true }
    }
  }

  return { ok: false, error: 'MAX_RETRIES_EXCEEDED' }
}

export async function get(params: Record<string, string>): Promise<GasResponse> {
  const secrets = loadGasSecrets()
  if (!secrets) {
    return { ok: false, error: 'GAS_NOT_CONFIGURED' }
  }

  const { webappUrl, authToken } = secrets
  const searchParams = new URLSearchParams(params).toString()
  const url = `${webappUrl}/__/functions/gasSync?${searchParams}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }

    const data = await response.json()
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'GAS_UNREACHABLE', syncPending: true }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

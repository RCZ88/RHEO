// GAS Integration — Exporter Router
// Takes { target, source } and dispatches to the right exporter.

import { GasExportPayload, GasResponse } from '../types'
import { exportToDocs } from './docs'
import { exportToSheets } from './sheets'
import { exportToForms } from './forms'

export async function dispatchExport(payload: GasExportPayload): Promise<GasResponse> {
  switch (payload.target) {
    case 'docs':
      return exportToDocs(payload)
    case 'sheets':
      return exportToSheets(payload)
    case 'forms':
      return exportToForms(payload)
    default:
      return { ok: false, error: `UNKNOWN_EXPORT_TARGET: ${payload.target}` }
  }
}

// Re-export for direct access
export { exportToDocs } from './docs'
export { exportToSheets } from './sheets'
export { exportToForms } from './forms'

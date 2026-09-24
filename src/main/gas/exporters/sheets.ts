// GAS Integration — Sheets Exporter
// Formats goals table and usage ledger into Sheets-compatible payload (rows, columns, headers).
// Handles chunking for large datasets.

import { GasExportPayload, GasResponse } from '../types'

interface SheetRow {
  values: string[]
}

interface SheetData {
  title: string
  headers: string[]
  rows: SheetRow[]
}

export async function exportToSheets(payload: GasExportPayload): Promise<GasResponse> {
  try {
    const { content, meta } = payload

    // Format content into Sheets-compatible structure
    const formattedData = formatForSheets(content)

    // Check size — chunk if needed
    const payloadStr = JSON.stringify({
      target: 'sheets',
      content: formattedData,
      meta,
    })

    if (payloadStr.length > 4 * 1024 * 1024 && formattedData.rows.length > 1) {
      const mid = Math.floor(formattedData.rows.length / 2)
      const chunk1 = { ...formattedData, rows: formattedData.rows.slice(0, mid) }
      const chunk2 = { ...formattedData, rows: formattedData.rows.slice(mid) }

      const result1 = await sendToGAS({ target: 'sheets', content: chunk1, meta: { ...meta, chunk: 1 } })
      if (!result1.ok) return result1

      return sendToGAS({ target: 'sheets', content: chunk2, meta: { ...meta, chunk: 2 } })
    }

    return sendToGAS(payload)
  } catch (err: any) {
    console.error('[GAS Exporter:Sheets] Error:', err)
    return { ok: false, error: err?.message || 'SHEETS_EXPORT_FAILED' }
  }
}

function formatForSheets(content: unknown): SheetData {
  if (Array.isArray(content)) {
    const items = content as Record<string, any>[]
    if (items.length === 0) {
      return { title: 'RHEO Data', headers: [], rows: [] }
    }

    const headers = Object.keys(items[0])
    const rows = items.map(item => ({
      values: headers.map(h => String(item[h] ?? ''))
    }))

    return {
      title: items[0].title || items[0].name || 'RHEO Data',
      headers,
      rows,
    }
  }

  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, any>
    const headers = Object.keys(obj)
    return {
      title: obj.title || obj.name || 'RHEO Data',
      headers,
      rows: [{ values: headers.map(h => String(obj[h] ?? '')) }],
    }
  }

  return { title: 'RHEO Data', headers: ['Value'], rows: [{ values: [String(content)] }] }
}

async function sendToGAS(payload: any): Promise<GasResponse> {
  console.log('[GAS Exporter:Sheets] Export payload:', JSON.stringify(payload).slice(0, 200))
  return { ok: true, data: { exported: true, target: 'sheets', chunk: payload.meta?.chunk } }
}

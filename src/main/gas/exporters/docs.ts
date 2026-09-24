// GAS Integration — Docs Exporter
// Formats journal/resume/transcript data into a Docs-compatible payload.
// Handles chunking for long documents.

import { GasExportPayload, GasResponse } from '../types'

interface DocsSection {
  heading?: string
  paragraphs: string[]
  list?: string[]
}

export async function exportToDocs(payload: GasExportPayload): Promise<GasResponse> {
  try {
    const { content, meta } = payload

    // Format content into Docs-compatible structure
    const formattedContent = formatForDocs(content)

    // Check size — chunk if needed
    const payloadStr = JSON.stringify({
      target: 'docs',
      content: formattedContent,
      meta,
    })

    if (payloadStr.length > 4 * 1024 * 1024 && formattedContent.sections.length > 1) {
      // Chunk into halves
      const mid = Math.floor(formattedContent.sections.length / 2)
      const chunk1 = { ...formattedContent, sections: formattedContent.sections.slice(0, mid) }
      const chunk2 = { ...formattedContent, sections: formattedContent.sections.slice(mid) }

      // Send first chunk (simulated — in production, send to GAS)
      const result1 = await sendToGAS({ target: 'docs', content: chunk1, meta: { ...meta, chunk: 1 } })
      if (!result1.ok) return result1

      return sendToGAS({ target: 'docs', content: chunk2, meta: { ...meta, chunk: 2 } })
    }

    return sendToGAS(payload)
  } catch (err: any) {
    console.error('[GAS Exporter:Docs] Error:', err)
    return { ok: false, error: err?.message || 'DOCS_EXPORT_FAILED' }
  }
}

function formatForDocs(content: unknown): { title: string; sections: DocsSection[] } {
  if (typeof content === 'string') {
    return {
      title: 'RHEO Export',
      sections: [{ paragraphs: [content] }],
    }
  }

  if (Array.isArray(content)) {
    return {
      title: 'RHEO Export',
      sections: content.map((item: any) => ({
        heading: item.title || item.category || 'Entry',
        paragraphs: [item.content || item.text || String(item)],
      })),
    }
  }

  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, any>
    return {
      title: obj.title || obj.name || 'RHEO Export',
      sections: Object.entries(obj).map(([key, value]) => ({
        heading: key.charAt(0).toUpperCase() + key.slice(1),
        paragraphs: [String(value)],
      })),
    }
  }

  return { title: 'RHEO Export', sections: [{ paragraphs: ['No content'] }] }
}

async function sendToGAS(payload: any): Promise<GasResponse> {
  // In production, this POSTs to GAS webapp
  // For now, simulate the export flow
  console.log('[GAS Exporter:Docs] Export payload:', JSON.stringify(payload).slice(0, 200))
  return { ok: true, data: { exported: true, target: 'docs', chunk: payload.meta?.chunk } }
}

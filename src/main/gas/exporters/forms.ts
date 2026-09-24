// GAS Integration — Forms Exporter
// Formats quiz data into Forms-compatible payload (questions, options, correct answers).

import { GasExportPayload, GasResponse } from '../types'

interface FormQuestion {
  question: string
  type: 'multiple_choice' | 'checkbox' | 'text' | 'paragraph'
  options?: string[]
  correctAnswer?: string
}

interface FormData {
  title: string
  description?: string
  questions: FormQuestion[]
}

export async function exportToForms(payload: GasExportPayload): Promise<GasResponse> {
  try {
    const { content, meta } = payload

    // Format content into Forms-compatible structure
    const formData = formatForForms(content)

    // Check size — chunk if needed
    const payloadStr = JSON.stringify({
      target: 'forms',
      content: formData,
      meta,
    })

    if (payloadStr.length > 4 * 1024 * 1024 && formData.questions.length > 1) {
      const mid = Math.floor(formData.questions.length / 2)
      const chunk1 = { ...formData, questions: formData.questions.slice(0, mid) }
      const chunk2 = { ...formData, questions: formData.questions.slice(mid) }

      const result1 = await sendToGAS({ target: 'forms', content: chunk1, meta: { ...meta, chunk: 1 } })
      if (!result1.ok) return result1

      return sendToGAS({ target: 'forms', content: chunk2, meta: { ...meta, chunk: 2 } })
    }

    return sendToGAS(payload)
  } catch (err: any) {
    console.error('[GAS Exporter:Forms] Error:', err)
    return { ok: false, error: err?.message || 'FORMS_EXPORT_FAILED' }
  }
}

function formatForForms(content: unknown): FormData {
  if (Array.isArray(content)) {
    const items = content as Record<string, any>[]
    return {
      title: 'RHEO Quiz Export',
      questions: items.map(item => ({
        question: item.question || item.text || String(item),
        type: item.type || 'multiple_choice',
        options: item.options || item.choices || [],
        correctAnswer: item.correctAnswer || item.correct_answer || item.answer,
      })),
    }
  }

  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, any>
    return {
      title: obj.title || obj.name || 'RHEO Quiz Export',
      description: obj.description || obj.instructions,
      questions: [
        {
          question: obj.question || obj.text || String(content),
          type: obj.type || 'multiple_choice',
          options: obj.options || obj.choices || [],
          correctAnswer: obj.correctAnswer || obj.correct_answer || obj.answer,
        }
      ],
    }
  }

  return {
    title: 'RHEO Quiz Export',
    questions: [{ question: String(content), type: 'text' as const }],
  }
}

async function sendToGAS(payload: any): Promise<GasResponse> {
  console.log('[GAS Exporter:Forms] Export payload:', JSON.stringify(payload).slice(0, 200))
  return { ok: true, data: { exported: true, target: 'forms', chunk: payload.meta?.chunk } }
}

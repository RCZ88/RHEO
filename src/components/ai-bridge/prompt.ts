// Shared prompt-building + category routing for the External AI Bridge.
// The backend owns the heavy step prompts (classify/synthesize/script/...).
// This module owns the per-FIELD "fill this form from our conversation" prompt,
// which every feature's form fields share.

import { PROMPT_SECTIONS, STYLE_TEMPLATES } from '@/features/content-engine/components/PromptSectionToggle'

export type BridgeCategory =
  | 'content-engine'
  | 'learn'
  | 'goals'
  | 'finance'
  | 'resume'
  | 'general'

export const BRIDGE_CATEGORIES: BridgeCategory[] = [
  'content-engine',
  'learn',
  'goals',
  'finance',
  'resume',
  'general',
]

/**
 * Map a feature category to the browser-extension injection command type.
 * Only `content-engine` is currently handled natively by the extension overlay;
 * every other category falls back to clipboard + open-chat so the flow is reliable.
 */
export const INJECTION_BY_CATEGORY: Record<BridgeCategory, string> = {
  'content-engine': 'CONTENT_ENGINE_INJECT',
  learn: 'LEARN_INJECT',
  goals: 'GOALS_INJECT',
  finance: 'FINANCE_INJECT',
  resume: 'RESUME_INJECT',
  general: 'CONTENT_ENGINE_INJECT',
}

export interface StyleTemplate {
  id: string
  label: string
  directive: string
}

export function getStyleDirective(styleId?: string): string | undefined {
  if (!styleId) return undefined
  return STYLE_TEMPLATES.find((t) => t.id === styleId)?.directive
}

export function sectionLabel(id: string): string {
  return PROMPT_SECTIONS.find((s) => s.id === id)?.label ?? id
}

export interface BuildFieldPromptArgs {
  category: BridgeCategory
  label: string
  fieldName: string
  allFields: Record<string, string>
  context?: string
  frameMode?: 'strict' | 'flexible'
  /** Optional style template id (punchy/storyteller/...). Its directive is INJECTED into the prompt per the skill. */
  styleId?: string
}

/**
 * Build the format-only field prompt. Mirrors the external-ai-bridge skill:
 * - starts with "Based on our conversation above..."
 * - includes the EXACT JSON schema with all fields
 * - the target field is marked [FILL THIS]
 * - ends with "Return ONLY this JSON"
 * - injects the selected style directive (TONE:/VISUAL:/EVIDENCE:) when provided
 */
export function buildFieldPrompt({
  category,
  label,
  fieldName,
  allFields,
  context,
  frameMode = 'strict',
  styleId,
}: BuildFieldPromptArgs): string {
  const keys = Object.keys(allFields)
  const otherLines = keys
    .filter((k) => k !== fieldName && allFields[k])
    .map((k) => `  "${k}": "${(allFields[k] || '').replace(/"/g, '\\"')}"`)
    .join('\n')

  const fieldLines = keys
    .map((k) =>
      k === fieldName
        ? `  "${k}": "[FILL THIS]"`
        : `  "${k}": "${(allFields[k] || '').replace(/"/g, '\\"')}"`
    )
    .join(',\n')

  const ctxBlock = context ? `\nAdditional context: ${context}` : ''
  const styleDirective = getStyleDirective(styleId)
  const styleBlock = styleDirective ? `\nStyle: ${styleDirective}` : ''
  const modeLine =
    frameMode === 'strict'
      ? 'Every field is mandatory. Do not skip any field.'
      : 'Include all fields but creative variation is allowed.'

  return [
    `Based on our conversation above, fill in the "${label}" field for this ${category} entry.`,
    '',
    otherLines ? `Existing fields:\n${otherLines}\n` : '',
    ctxBlock,
    styleBlock,
    '',
    'Return ONLY this JSON with ALL fields filled:',
    '{',
    fieldLines,
    '}',
    '',
    'Rules:',
    `- Fill in "${fieldName}" with the best value based on the conversation context`,
    '- Keep existing field values unless they clearly need updating',
    '- Return ONLY this JSON (no explanation, no markdown)',
    `- ${modeLine}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export interface BridgeFormField {
  key: string
  label: string
}

export interface BuildFormPromptArgs {
  category: BridgeCategory
  /** Section heading shown in the prompt, e.g. "Content Series" */
  heading: string
  fields: BridgeFormField[]
  /** current values; empty ones are marked [FILL THIS] */
  values: Record<string, string>
  context?: string
  frameMode?: 'strict' | 'flexible'
  /** Optional style template id (punchy/storyteller/...). Its directive is INJECTED into the prompt per the skill. */
  styleId?: string
  /** Ids of the prompt sections the user has switched on. */
  sections?: string[]
}

/**
 * Build a whole-form fill prompt: every field in the schema is shown, blank ones
 * are marked [FILL THIS], so the external AI fills the entire form in one pass from
 * the existing conversation. This is the "planning stage" use case (e.g. Episode 1).
 */
export function buildFormPrompt({
  category,
  heading,
  fields,
  values,
  context,
  frameMode = 'strict',
  styleId,
  sections = [],
}: BuildFormPromptArgs): string {
  const fieldLines = fields
    .map((f) => {
      const v = (values[f.key] || '').trim()
      return v
        ? `  "${f.key}": "${(v || '').replace(/"/g, '\\"')}"`
        : `  "${f.key}": "[FILL THIS]"`
    })
    .join(',\n')

  const ctxBlock = context ? `\nContext about this ${category} entry: ${context}` : ''
  const styleDirective = getStyleDirective(styleId)
  const styleBlock = styleDirective ? `\nStyle: ${styleDirective}` : ''
  // BridgeForm already passes the enabled section ids; it also detects this exact
  // line in the live preview, so the heading text is part of the contract.
  const sectionLabels = sections.map((id) => sectionLabel(id))
  const sectionBlock = sectionLabels.length
    ? `\nInclude these sections: ${sectionLabels.join(', ')}`
    : ''
  const modeLine =
    frameMode === 'strict'
      ? 'Every field is mandatory. Do not skip any field. Fill every [FILL THIS] slot.'
      : 'Include all fields; creative variation is allowed, but fill every [FILL THIS] slot.'

  return [
    `Based on our conversation above, fill in the "${heading}" form for this ${category} entry.`,
    '',
    ctxBlock,
    styleBlock,
    sectionBlock,
    '',
    'Return ONLY this JSON with ALL fields filled:',
    '{',
    fieldLines,
    '}',
    '',
    'Rules:',
    '- Use the conversation context to infer the best values',
    '- Keep values already filled unless they are clearly wrong',
    '- Return ONLY this JSON (no explanation, no markdown)',
    `- ${modeLine}`,
  ]
    .filter((l) => l !== '')
    .join('\n')
}

/** Palette used to color-tag each dynamic region in the live preview. */
export const SECTION_COLORS = [
  'bg-[#f5c518]/15 text-[#f5c518] border-[#f5c518]/30',
  'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30',
  'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30',
  'bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/30',
  'bg-[#ec4899]/15 text-[#ec4899] border-[#ec4899]/30',
  'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/30',
  'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/30',
  'bg-[#84cc16]/15 text-[#84cc16] border-[#84cc16]/30',
]

/**
 * Build the inject command sent to the browser extension. Carries a one-time
 * `correlationId` and the `expectedKeys` so the extension can echo the id and
 * report which keys were found in the AI's response — enabling auto-fill without
 * guessing which field a response belongs to by a generic promptType.
 */
export interface BridgeInjectCommand {
  type: string
  prompt: string
  promptType: string
  category: BridgeCategory
  correlationId: string
  expectedKeys: string[]
}

export function buildInjectCommand(
  category: BridgeCategory,
  prompt: string,
  promptType: string,
  expectedKeys: string[],
  correlationId?: string
): BridgeInjectCommand {
  const genId =
    correlationId ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return {
    type: INJECTION_BY_CATEGORY[category] || 'CONTENT_ENGINE_INJECT',
    prompt,
    promptType,
    category,
    correlationId: genId,
    expectedKeys,
  }
}

// Re-export the section/style catalogs so the bridge components can source them
// from one module. They live in PromptSectionToggle (content-engine) but the
// bridge consumes them for its style picker + (content-engine) section toggle.
export { PROMPT_SECTIONS, STYLE_TEMPLATES } from '@/features/content-engine/components/PromptSectionToggle'

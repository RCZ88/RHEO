/**
 * EntityExtraction — LLM-powered extraction pipeline for free-text episodes
 * 
 * Free-text sources (AI chat, terminal, reflections, manual episodes) are
 * queued as extraction jobs. The worker calls the configured LLM with a
 * strict-JSON prompt, validates the output, then upserts entities, adds
 * bitemporal facts, creates signals, and triggers profile rebuild.
 * 
 * The LLM caller is injected by main.ts (provider chain) so this module
 * stays decoupled from user preferences.
 */

import * as brain from './contextBrain'
import * as userContext from './userContextService'

type LlmCaller = (prompt: string, systemPrompt: string, maxTokens?: number) => Promise<string>

let llmCaller: LlmCaller | null = null

export function setLlmCaller(fn: LlmCaller) { llmCaller = fn }

export function isLlmAvailable(): boolean { return llmCaller !== null }

const EXTRACTION_SYSTEM_PROMPT = `You extract knowledge from a user's activity episode into strict JSON.
Rules:
- Return JSON ONLY, no commentary, no markdown fences.
- Use evidence only from the provided episode text. Do not invent personal facts.
- Confidence must be between 0 and 1. Be conservative: 0.5-0.7 for clear text, 0.8-0.95 only for explicit statements.
- Prefer specific entities over generic ones.
- Mark contradictions explicitly when the text contradicts existing knowledge (provide old_object/new_object).`

const VALID_ENTITY_TYPES = new Set(['goal', 'project', 'deadline', 'person', 'tool', 'concept', 'life_phase', 'finance_item', 'application', 'connector', 'terminal_session', 'location', 'organization'])

function normalizeEntityName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '')
}

export interface ExtractionResult {
  entities: Array<{ name: string; type: string; aliases?: string[] }>
  facts: Array<{ subject: string; predicate: string; object: string; confidence?: number }>
  signals: Array<{ signal_type: string; content: string; confidence?: number }>
  contradictions?: Array<{ subject: string; predicate: string; old_object: string; new_object: string }>
}

function parseExtractionJson(text: string): ExtractionResult | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
    }
  } catch {
    return null
  }
}

const MIN_EXTRACTION_LENGTH = 20;

function regexFallbackExtract(text: string): ExtractionResult {
  const entities: ExtractionResult['entities'] = []
  const facts: ExtractionResult['facts'] = []
  const signals: ExtractionResult['signals'] = []
  const seenEntities = new Set<string>()

  const capitalizedPhraseRe = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)\b/g
  let match: RegExpExecArray | null
  while ((match = capitalizedPhraseRe.exec(text)) !== null) {
    const name = match[1].trim()
    const key = name.toLowerCase()
    if (name.length < 3 || name.length > 60) continue
    if (/^(The|This|That|These|Those|What|When|Where|How|Why|Who)\s/.test(name)) continue
    if (seenEntities.has(key)) continue
    seenEntities.add(key)
    entities.push({ name, type: 'concept' })
  }

  const factRe = /\b([A-Z][a-zA-Z\s]{2,30}?)\s+(?:is|are|was|were|uses?|has|have|requires?|needs?)\s+([a-zA-Z0-9][a-zA-Z0-9\s,.]{2,60}?)(?:[.;,!]|$)/gm
  while ((match = factRe.exec(text)) !== null) {
    const subject = match[1].trim()
    const predicate = match[0].match(/\b(is|are|was|were|uses?|has|have|requires?|needs?)\b/i)?.[1] || 'is'
    const object = match[2].trim()
    if (subject.length < 2 || object.length < 2) continue
    facts.push({ subject, predicate, object })
  }

  const decisionRe = /(?:decided|decision|going with|chose|selected|will use)\s*[:\-]?\s*(.{5,80})/gi
  while ((match = decisionRe.exec(text)) !== null) {
    signals.push({ type: 'decision', content: match[1].trim() })
  }

  return { entities, facts, signals, contradictions: [] }
}

export function extractFromText(
  llmOutput: string | null,
  rawText: string
): { result: ExtractionResult; status: 'full' | 'partial' | 'empty' } {
  if (llmOutput) {
    const parsed = parseExtractionJson(llmOutput)
    if (parsed && (parsed.entities.length > 0 || parsed.facts.length > 0)) {
      return { result: parsed, status: 'full' }
    }
  }
  if (rawText.length >= MIN_EXTRACTION_LENGTH) {
    const regexResult = regexFallbackExtract(rawText)
    if (regexResult.entities.length > 0 || regexResult.facts.length > 0 || regexResult.signals.length > 0) {
      return { result: regexResult, status: 'partial' }
    }
  }
  return { result: { entities: [], facts: [], signals: [], contradictions: [] }, status: 'empty' }
}

export function applyExtraction(episodeId: string, result: ExtractionResult): void {
  const episode = brain.getEpisodes(undefined, 500).find((e: any) => e.id === episodeId)
  if (!episode) return

  // 1. Upsert entities
  const entityIds: string[] = []
  for (const ent of result.entities || []) {
    const name = normalizeEntityName(ent.name || '')
    if (!name) continue
    const type = VALID_ENTITY_TYPES.has(ent.type) ? ent.type : 'concept'
    const id = brain.upsertEntity(type, name, (ent.aliases || []).filter(Boolean))
    entityIds.push(id)
  }

  // 2. Add facts (bitemporal — old fact closed automatically by addFact)
  for (const f of result.facts || []) {
    const subject = normalizeEntityName(f.subject || '')
    if (!subject || !f.predicate) continue
    const found = brain.findEntities(subject)
    const subjectId = found.length > 0 ? found[0].id : brain.upsertEntity('concept', subject)
    brain.addFact(subjectId, f.predicate, String(f.object || ''), episodeId, undefined, f.confidence || 0.55)
  }

  // 3. Create signals
  for (const s of result.signals || []) {
    if (!s.signal_type || !s.content) continue
    userContext.addSignal(s.signal_type, s.content, 'llm_extraction', s.confidence || 0.55, { sourceRef: episodeId })
  }

  // 4. Handle explicit contradictions (supersede)
  for (const c of result.contradictions || []) {
    const subject = normalizeEntityName(c.subject || '')
    const found = brain.findEntities(subject)
    if (found.length === 0) continue
    const subjectId = found[0].id
    const oldFacts = brain.getCurrentFacts(subjectId).filter(f => f.predicate === c.predicate)
    for (const oldFact of oldFacts) {
      brain.closeFact(oldFact.id)
    }
    brain.addFact(subjectId, c.predicate, c.new_object, episodeId, undefined, 0.8)
  }
}

export async function processEpisode(episodeId: string): Promise<{ ok: boolean; error?: string }> {
  if (!llmCaller) return { ok: false, error: 'No LLM caller configured' }

  const episode = brain.getEpisodes(undefined, 500).find((e: any) => e.id === episodeId)
  if (!episode) return { ok: false, error: 'Episode not found' }

  // Skip very short episodes (nothing to extract)
  if ((episode.content || '').trim().length < 40) {
    const job = brain.getJobs().find(j => j.episodeId === episodeId)
    if (job) brain.updateJob(job.id, { status: 'skipped', completedAt: Date.now() })
    return { ok: true }
  }

  const prompt = `Extract knowledge from this episode:
<episode>
source: ${episode.source}
content: ${episode.content.slice(0, 4000)}
</episode>

Return JSON in this exact shape:
{
  "entities": [{"name": "...", "type": "goal|project|deadline|person|tool|concept|life_phase|finance_item|application|connector|terminal_session", "aliases": ["..."]}],
  "facts": [{"subject": "...", "predicate": "...", "object": "...", "confidence": 0.6}],
  "signals": [{"signal_type": "preference|habit|correction|interest|milestone|pattern|communication_style|tool_preference|goal_pattern|rule", "content": "...", "confidence": 0.6}],
  "contradictions": [{"subject": "...", "predicate": "...", "old_object": "...", "new_object": "..."}]
}
Empty arrays are fine when nothing is extractable.`

  try {
    const job = brain.getJobs().find(j => j.episodeId === episodeId && j.status === 'pending')
    if (job) brain.updateJob(job.id, { status: 'processing', startedAt: Date.now() })

    const raw = await llmCaller(prompt, EXTRACTION_SYSTEM_PROMPT, 600)
    const parsed = parseExtractionJson(raw)
    if (!parsed) {
      if (job) brain.updateJob(job.id, { status: 'failed', lastError: 'LLM returned invalid JSON', completedAt: Date.now() })
      return { ok: false, error: 'Invalid JSON from LLM' }
    }

    applyExtraction(episodeId, parsed)
    if (job) brain.updateJob(job.id, { status: 'completed', completedAt: Date.now() })

    // Incremental profile refresh
    try { userContext.rebuildProfile() } catch {}

    return { ok: true }
  } catch (err: any) {
    if (job) brain.updateJob(job.id, { status: 'failed', lastError: err?.message?.slice(0, 200) || 'Unknown error', completedAt: Date.now() })
    return { ok: false, error: err?.message }
  }
}

export async function processPendingJobs(limit: number = 3): Promise<number> {
  const jobs = brain.getPendingJobs(limit)
  let processed = 0
  for (const job of jobs) {
    // Re-check: skip if this job is already locked/processing
    if (job.status !== 'pending') continue
    const res = await processEpisode(job.episodeId)
    if (res.ok) processed++
  }
  return processed
}
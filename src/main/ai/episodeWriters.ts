/**
 * EpisodeWriters — Capture episodes from existing DeskFlow features
 * 
 * Each writer converts a feature event into an episode + entity/fact extraction.
 */

import * as brain from './contextBrain'
import { redactSecrets } from './redact'
import { extractConcepts } from './conceptExtraction'

// Sources worth LLM enrichment (sparse + descriptive). Routine sources
// (finance transactions, chat turns, terminal) are covered by regex signals.
const EXTRACTION_SOURCES = new Set(['goals', 'life_phase', 'deadlines', 'connector', 'manual', 'external_ai', 'voice_note', 'reflection'])

// B2 (RESULT-M6 WP-B): redact secrets at the episode boundary — before text is
// stored, embedded, extracted or served. Every writer in this file logs
// through logEp, never through brain.logEpisode directly.
const logEp = (source: string, content: string, ref?: string, meta?: Record<string, any>, occurredAt?: string) =>
  brain.logEpisode(source, redactSecrets(content), ref, meta, occurredAt)

function logAndQueue(source: string, content: string, sourceRef?: string, metadata?: Record<string, any>): string {
  const epId = logEp(source, content, sourceRef, metadata)
  if (epId && EXTRACTION_SOURCES.has(source) && content.length >= 40) {
    brain.createExtractionJob(epId)
  }
  return epId
}

// ═══ Goal Episode Writer ═══
// NOTE: goal saves are a manual/user action and must NOT auto-trigger the LLM
// extraction worker. We still capture the episode + entity/fact for history, but
// we deliberately skip createExtractionJob so no AI call fires on goal create /
// update / delete / complete (unless the user explicitly asks for AI via the
// Goal Coach / AI Health Check buttons, which go through a different path).
export function writeGoalEpisode(goal: any, action: 'created' | 'completed' | 'updated' | 'deleted') {
  const content = `Goal ${action}: "${goal.title}" (${goal.category || 'general'}) — status: ${goal.status || 'pending'}${goal.description ? ` — ${goal.description}` : ''}`
  const epId = logEp('goals', content, goal.id, { goalId: goal.id, action, category: goal.category })

  // Extract entity
  const entityId = brain.upsertEntity('goal', goal.title, [goal.category].filter(Boolean))

  // Extract fact
  brain.addFact(entityId, 'has_status', goal.status || 'pending', epId)
  if (goal.category) brain.addFact(entityId, 'in_category', goal.category, epId)
  if (action === 'completed') brain.addFact(entityId, 'completed_at', new Date().toISOString(), epId)
}

// ═══ Finance Episode Writer ═══
export function writeFinanceEpisode(type: 'transaction' | 'budget' | 'wallet' | 'subscription', data: any, action: string) {
  let content = ''
  switch (type) {
    case 'transaction':
      content = `Transaction: ${data.description || data.category} — ${data.amount} ${data.currency || 'IDR'} (${data.type || 'expense'})`
      break
    case 'budget':
      content = `Budget ${action}: ${data.category} — limit ${data.limit_amount} / spent ${data.spent_amount}`
      break
    case 'wallet':
      content = `Wallet ${action}: ${data.name} — balance ${data.balance} ${data.currency || 'IDR'}`
      break
    case 'subscription':
      content = `Subscription ${action}: ${data.name} — ${data.price} ${data.currency || 'IDR'}/${data.billing_cycle || 'monthly'}`
      break
  }
  const epId = logEp('finance', content, data.id, { type, action })
  // R-2 (CZ-approved): NO LLM extraction for finance — routine sources get
  // regex signals only, and finance text never leaves the machine.

  if (type === 'wallet') {
    const entityId = brain.upsertEntity('tool', data.name, ['wallet', 'finance'])
    brain.addFact(entityId, 'has_balance', `${data.balance} ${data.currency || 'IDR'}`, epId)
  }
}

// ═══ Deadline Episode Writer ═══
export function writeDeadlineEpisode(deadline: any, action: 'created' | 'updated' | 'completed') {
  const content = `Deadline ${action}: "${deadline.title}" — due ${deadline.due_date}${deadline.course ? ` (${deadline.course})` : ''}`
  const epId = logAndQueue('deadlines', content, deadline.id)

  const entityId = brain.upsertEntity('deadline', deadline.title, [deadline.course].filter(Boolean))
  brain.addFact(entityId, 'due_date', deadline.due_date, epId)
  if (deadline.course) brain.addFact(entityId, 'in_course', deadline.course, epId)
}

// ═══ Terminal Session Episode Writer ═══
export function writeTerminalEpisode(session: any, message: string, role: 'user' | 'agent') {
  const content = `[Terminal ${role}] ${message.slice(0, 500)}`
  const epId = logEp('terminal', content, session.id, {
    sessionId: session.id,
    agentType: session.agent_type,
    topic: session.topic,
  })
  // R-2: no LLM extraction for terminal sessions — regex signals only.

  // Only extract entities from agent messages (more structured)
  if (role === 'agent' && session.topic) {
    const entityId = brain.upsertEntity('project', session.topic, [])
    brain.addFact(entityId, 'discussed_in', 'terminal session', epId)
  }
}

// ═══ AI Chat Episode Writer ═══
export function writeAiChatEpisode(messages: Array<{ role: string; content: string }>, threadDate: string) {
  for (const msg of messages) {
    if (!msg.content || msg.content.length < 10) continue
    const content = `[AI Chat ${msg.role}] ${msg.content.slice(0, 1000)}`
    logEp('deskflow_ai', content, threadDate, { threadDate, role: msg.role })
    // R-2: no LLM extraction for chat lines — regex signals only.
  }
}

// ═══ Life Phase Episode Writer ═══
export function writeLifePhaseEpisode(phase: any, action: 'created' | 'updated' | 'reflected') {
  // Accept both DB rows (snake_case) and LifePhase objects (camelCase).
  const sy = phase.start_year ?? phase.startYear
  const sm = phase.start_month ?? phase.startMonth
  const ey = phase.end_year ?? phase.endYear
  const em = phase.end_month ?? phase.endMonth
  const content = `Life phase ${action}: "${phase.title}" (${phase.category || 'general'}) — ${sy}/${sm} to ${ey || 'ongoing'}/${em || '?'}`
  const epId = logAndQueue('life_phase', content, phase.id)

  const entityId = brain.upsertEntity('concept', phase.title, [phase.category].filter(Boolean))
  if (phase.reflection) brain.addFact(entityId, 'has_reflection', String(phase.reflection).slice(0, 200), epId)
  let milestones: any[] = []
  try {
    milestones = typeof phase.milestones === 'string' ? JSON.parse(phase.milestones) : (Array.isArray(phase.milestones) ? phase.milestones : [])
  } catch { /* bad JSON: skip milestones */ }
  for (const m of milestones.slice(0, 5)) {
    const label = typeof m === 'string' ? m : (m?.label || m?.title)
    if (label) brain.addFact(entityId, 'milestone', String(label).slice(0, 200), epId)
  }
}

// ═══ Connector Episode Writer ═══
export function writeConnectorEpisode(connector: any, items: any[], action: 'synced' | 'new_items') {
  const content = `Connector ${action}: ${connector.displayName || connector.name} — ${items.length} items`
  logAndQueue('connector', content, connector.id, {
    connectorType: connector.type,
    provider: connector.provider,
    itemCount: items.length,
  })
}

// ═══ AI Context Capture Episode Writer (external AI conversations) ═══
const PROVIDER_ALIASES: Record<string, string[]> = {
  chatgpt: ['chatgpt', 'openai'],
  claude: ['claude', 'anthropic'],
  perplexity: ['perplexity'],
  you: ['you', 'you.com'],
  gemini: ['gemini', 'bard', 'google gemini'],
};

export function writeAiContextEpisode(capture: { id?: number; provider: string; messages: Array<{ role: string; content: string }>; url?: string; title?: string; source?: string; timestamp?: string }) {
  const providerName = capture.provider || 'unknown';
  const aliases = PROVIDER_ALIASES[providerName] || [providerName];
  const summary = capture.messages.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
  const content = `External AI conversation on ${providerName}${capture.title ? ` (${capture.title})` : ''}${capture.url ? `\nURL: ${capture.url}` : ''}\nMessages: ${capture.messages.length}\n\n${summary.slice(0, 1500)}`;
  const sourceRef = capture.id ? `ai_context_capture:${capture.id}` : (capture.url || providerName);
  const epId = logEp('external_ai', content, sourceRef, {
    provider: providerName,
    messageCount: capture.messages.length,
    url: capture.url,
    title: capture.title,
  }, capture.timestamp);
  if (epId && content.length >= 40) {
    brain.createExtractionJob(epId);
  }
  // Upsert provider entity with aliases
  const entityId = brain.upsertEntity('ai_provider', providerName.charAt(0).toUpperCase() + providerName.slice(1), aliases);
  if (entityId && epId) {
    brain.addFact(entityId, 'has_conversation', `External AI conversation (${capture.messages.length} messages)`, epId);
  }

  // Lightweight concept extraction so the graph shows real structure even before
  // the (optional) LLM extraction worker runs. F11 (RESULT-2C): this used to
  // carry its own inline copy of the extractor while the shared deterministic
  // extractor also existed — the swap means exactly ONE extractor runs at
  // capture time.
  try {
    const fullText = (capture.messages || []).map((m: any) => m.content || '').join(' ').slice(0, 4000)
    for (const c of extractConcepts(fullText, providerName)) {
      const cid = brain.upsertEntity('concept', c, [])
      if (cid && entityId && epId) {
        brain.addFact(entityId, 'discussed', c, epId, cid)
      }
    }
  } catch (e) { /* never let extraction break capture */ }
}

// ── Content Engine → Context Brain ──────────────────────────
// Every committed Content Engine asset (idea / episode / lesson / framework /
// reflection) becomes an episode + a `content_asset` entity so the Knowledge
// Graph auto-populates from AI feature usage. Extraction jobs then derive
// finer `concept` nodes from the content.
export function writeContentEngineEpisode(p: {
  kind: 'idea' | 'episode' | 'lesson' | 'framework' | 'reflection';
  title: string;
  detail?: string;
  refId?: string | number;
  extra?: Record<string, any>;
}): string {
  const source = 'content_engine';
  const content = `[${p.kind}] ${p.title}\n${p.detail || ''}`.slice(0, 1500);
  const sourceRef = p.refId != null ? `content:${p.kind}:${p.refId}` : undefined;
  const epId = logEp(source, content, sourceRef, { kind: p.kind, ...(p.extra || {}) });
  if (epId && content.length >= 40) brain.createExtractionJob(epId);
  const entityId = brain.upsertEntity('content_asset', p.title.slice(0, 80), [p.kind, 'content_engine']);
  if (entityId && epId) {
    brain.addFact(entityId, 'asset_kind', p.kind, epId);
    if (sourceRef) brain.addFact(entityId, 'source_ref', sourceRef, epId);
  }
  return epId;
}

// ── Learn (Lyceum) → Context Brain ──────────────────────────
// Authored lessons become episodes + `lesson` entities so studying/writing in
// the Learn OS feeds the same graph as everything else.
export function writeLearnLessonEpisode(p: {
  lessonId: string;
  title: string;
  summary?: string;
  topic?: string;
}): string {
  const source = 'learn_lesson';
  const content = `[learn] ${p.title}${p.topic ? ` (topic: ${p.topic})` : ''}\n${p.summary || ''}`.slice(0, 1500);
  const sourceRef = `learn:lesson:${p.lessonId}`;
  const epId = logEp(source, content, sourceRef, { lessonId: p.lessonId, topic: p.topic });
  if (epId && content.length >= 40) brain.createExtractionJob(epId);
  const entityId = brain.upsertEntity('lesson', p.title.slice(0, 80), [p.topic || 'learn', 'lyceum']);
  if (entityId && epId) brain.addFact(entityId, 'taught_in', p.topic || 'learn', epId);
  return epId;
}

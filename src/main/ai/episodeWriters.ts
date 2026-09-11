/**
 * EpisodeWriters — Capture episodes from existing DeskFlow features
 * 
 * Each writer converts a feature event into an episode + entity/fact extraction.
 */

import * as brain from './contextBrain'

// Sources worth LLM enrichment (sparse + descriptive). Routine sources
// (finance transactions, chat turns, terminal) are covered by regex signals.
const EXTRACTION_SOURCES = new Set(['goals', 'life_phase', 'deadlines', 'connector', 'manual', 'external_ai', 'voice_note', 'reflection'])

function logAndQueue(source: string, content: string, sourceRef?: string, metadata?: Record<string, any>): string {
  const epId = brain.logEpisode(source, content, sourceRef, metadata)
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
  const epId = brain.logEpisode('goals', content, goal.id, { goalId: goal.id, action, category: goal.category })

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
  const epId = brain.logEpisode('finance', content, data.id, { type, action })
  if (epId && content.length >= 20) {
    try { brain.createExtractionJob(epId); } catch (_e) { /* best-effort */ }
  }

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
  const epId = brain.logEpisode('terminal', content, session.id, {
    sessionId: session.id,
    agentType: session.agent_type,
    topic: session.topic,
  })
  if (epId && content.length >= 20) {
    try { brain.createExtractionJob(epId); } catch (_e) { /* best-effort */ }
  }

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
    const epId = brain.logEpisode('deskflow_ai', content, threadDate, { threadDate, role: msg.role })
    if (epId && content.length >= 20) {
      try { brain.createExtractionJob(epId); } catch (_e) { /* best-effort */ }
    }
  }
}

// ═══ Life Phase Episode Writer ═══
export function writeLifePhaseEpisode(phase: any, action: 'created' | 'updated' | 'reflected') {
  const content = `Life phase ${action}: "${phase.title}" (${phase.category || 'general'}) — ${phase.start_year}/${phase.start_month} to ${phase.end_year || 'ongoing'}/${phase.end_month || '?'}`
  const epId = logAndQueue('life_phase', content, phase.id)

  const entityId = brain.upsertEntity('concept', phase.title, [phase.category].filter(Boolean))
  if (phase.reflection) brain.addFact(entityId, 'has_reflection', phase.reflection.slice(0, 200), epId)
  if (phase.milestones) {
    try {
      const milestones = JSON.parse(phase.milestones)
      for (const m of milestones.slice(0, 5)) {
        brain.addFact(entityId, 'milestone', m.title || m, epId)
      }
    } catch {}
  }
}

// ═══ Connector Episode Writer ═══
export function writeConnectorEpisode(connector: any, items: any[], action: 'synced' | 'new_items') {
  const content = `Connector ${action}: ${connector.displayName || connector.name} — ${items.length} items`
  const epId = logAndQueue('connector', content, connector.id, {
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
  const epId = brain.logEpisode('external_ai', content, sourceRef, {
    provider: providerName,
    messageCount: capture.messages.length,
    url: capture.url,
    title: capture.title,
  });
  if (epId && content.length >= 40) {
    brain.createExtractionJob(epId);
  }
  // Upsert provider entity with aliases
  const entityId = brain.upsertEntity('ai_provider', providerName.charAt(0).toUpperCase() + providerName.slice(1), aliases);
  if (entityId && epId) {
    brain.addFact(entityId, 'has_conversation', `External AI conversation (${capture.messages.length} messages)`, epId);
  }
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
  const epId = brain.logEpisode(source, content, sourceRef, { kind: p.kind, ...(p.extra || {}) });
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
  const epId = brain.logEpisode(source, content, sourceRef, { lessonId: p.lessonId, topic: p.topic });
  if (epId && content.length >= 40) brain.createExtractionJob(epId);
  const entityId = brain.upsertEntity('lesson', p.title.slice(0, 80), [p.topic || 'learn', 'lyceum']);
  if (entityId && epId) brain.addFact(entityId, 'taught_in', p.topic || 'learn', epId);
  return epId;
}

/**
 * predicates.ts — canonical predicate vocabulary for the Context Brain.
 *
 * Every episode writer and the LLM extraction layer MUST import predicate
 * strings from here. Typos silently fragment the graph (EntityDetailPanel
 * renders per-predicate, and retrieval ranks by predicate), so a registry with
 * a typed union is the single source of truth.
 *
 * Adding a predicate: append to PREDICATES and to the Predicate type.
 * Unknown predicates at write time are logged (warn) but not blocked, so a
 * new writer can ship before the registry is updated.
 */
export const PREDICATES = {
  // status / state
  HAS_STATUS: 'has_status',
  HAS_PHASE: 'has_phase',
  HAS_CONVERSATION: 'has_conversation',
  HAS_AMOUNT: 'has_amount',
  HAS_ACCOUNT: 'has_account',
  HAS_PROGRESS: 'has_progress',
  // categorisation
  IN_CATEGORY: 'in_category',
  IN_SERIES: 'in_series',
  BELONGS_TO_COURSE: 'belongs_to_course',
  BELONGS_TO_PROJECT: 'belongs_to_project',
  // relationships
  WITH_PERSON: 'with_person',
  TAUGHT_LESSON: 'taught_lesson',
  COVERS_TOPIC: 'covers_topic',
  PRODUCED_IDEA: 'produced_idea',
  // temporal
  COMPLETED_AT: 'completed_at',
  TRANSACTED_ON: 'transacted_on',
  DUE_DATE: 'due_date',
  SUMMARIZED_AS: 'summarized_as',
  // activity
  RAN_COMMAND: 'ran_command',
  ERRORED_WITH: 'errored_with',
  IN_SESSION: 'in_session',
  SAID_IN_CHAT: 'said_in_chat',
  DISCUSSED: 'discussed',
  MENTIONS: 'mentions',
  AT_LOCATION: 'at_location',
  PLAYED_MEDIA: 'played_media',
  // co-occurrence (synthetic, rendering-time only — never persisted)
  CO_OCCURS: 'co_occurs',
  // generic
  RELATES: 'relates',
} as const

export type Predicate = (typeof PREDICATES)[keyof typeof PREDICATES]

export function isKnownPredicate(p: string): p is Predicate {
  return (Object.values(PREDICATES) as string[]).includes(p)
}

// ── Cardinality (RESULT-2C F12) ──
// How many facts with the same (subject_id, predicate) may be ACTIVE at once.
// 'single' (default): a new fact closes the previous one — bitemporal
//   contradiction handling; right for statuses, dates and amounts.
// 'multi': different objects are preserved side by side; only an exact
//   (subject, predicate, object) match is treated as a duplicate. Right for
//   predicates where several values are simultaneously true. Without this,
//   repeated concept links closed every earlier edge and only the LAST concept
//   stayed active — confirmed bug, RESULT-2C F12.
export type Cardinality = 'single' | 'multi'

export const MULTI_CARDINALITY = new Set<string>([
  PREDICATES.DISCUSSED,
  PREDICATES.MENTIONS,
  PREDICATES.WITH_PERSON,
  PREDICATES.PRODUCED_IDEA,
  PREDICATES.COVERS_TOPIC,
])

export function cardinalityOf(p: string): Cardinality {
  return MULTI_CARDINALITY.has(p) ? 'multi' : 'single'
}

# RESULT-2C: ASSUMES Finalization

## WP-E: `brainContext.ts`
**Reuse existing modules; do not create a parallel retrieval/formatting stack.** Keep `brainContext.ts` as the policy layer (profile/rules, source gates, redaction, ranking, token budget). Reuse `contextBrain.retrieve()`, `memoryRetrieval.getRelevantMemories()`, and `contextFormatter.formatBrainContext()` / `formatMemoryContext()`.

Before formatting, redact and source-filter the data. Fix `formatBrainContext()` to show entity names rather than raw `subjectId`. Its `truncateToBudget()` is not a reliable relevance-aware token allocator, so improve it or keep budget allocation in `brainContext.ts`. Never inject raw `finance`/`terminal` episodes or raw `external_ai` episode text. Make `brain:enrich-prompt` delegate to this builder while preserving its existing IPC return shape.

## F12: `addFact` cardinality
**Confirmed bug. `discussed` must be multi-valued.** `addFact()` closes the current fact for every `(subject_id, predicate)` match, regardless of object. Repeated concept links therefore leave only the final concept active. Add explicit predicate cardinality: preserve different active `discussed` objects, deduplicate the same subject/predicate/object edge, and retain single-value closure for other predicates unless configured otherwise. `predicates.ts` lists `DISCUSSED` but has no cardinality rules.

## F7: historical episode time
**Confirmed limitation.** `logEpisode()` has no occurrence-time input and writes `now` to both `occurred_at` and `ingested_at`. Add a backward-compatible optional `occurredAt`; pass the capture timestamp through `writeAiContextEpisode()` to `occurred_at`, while `ingested_at` remains import time. Validate the timestamp and preserve its timezone meaning; do not silently replace invalid historical time with `now`. Apply this to newly created episodes, not already-matched episodes.

## Other assumptions resolved
- `getEmbedding()` returns `number[] | undefined`; `getAllEmbeddings()` returns `{ refId, refType, vec: number[] }[]`. Use `.length` for vector dimensions.
- `retrieve()` episodes include `id`, `source`, `content`, `occurredAt`, `ingestedAt`. Semantic/hybrid MCP results can remain IDs and scores; no `getEpisode()` helper is needed.
- `extractConcepts(text, providerName?)` returns `string[]`. Replace the inline extractor in `writeAiContextEpisode`; do not run both.
- `main.ts` already calls `writeAiChatEpisode()` after the chat transaction. Do not add another caller.
- No deletion API exists for `forget`; `closeFact()` only closes validity. Keep `forget` deferred and do not add raw SQL deletion to MCP.
- Existing `brain:enrich-prompt` is keyword-overlap fact retrieval only. Delegate it to the new builder, not a second enrichment implementation.

## R2 scheduler caveat
`contextScheduler.ts` already runs decay every 6h and profile rebuild every 24h, but the shown code does not persist run times. `brain:evaluate` expects numeric timestamps at `context_scheduler_state` keys `signal_decay.lastRun` and `profile.lastRebuild`. Do not introduce `brain_meta` or ISO-string values. Reuse `context_scheduler_state` only after checking its real schema: the supplied R2 appendix contains no PRAGMA output.

**Scope:** This resolves source-dependent assumptions only. R-1 through R-7 and D6 still require CZ's explicit decisions. Runtime remains NOT TESTED until CZ builds and verifies.

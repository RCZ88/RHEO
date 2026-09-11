# Context System — Full Fix & Retrieval Implementation

## Raw Request

"how bad is the context system that you dont know these stuff and theres no proper context management and retrieval system... SOMETHING TO FIX AND IMPLEMENT A SYSTEM THAT CAN MAKE SO THAT YOU KNOW WHAT THE CHANGES ARE THE LATEST CHANGES... the brain system ARE YOU AWARE OF THAT?"

## Problem Statement

The context system exists on paper but delivers near-zero value in practice.

| Subsystem | Status | Bug |
|---|---|---|
| Context Brain | 86 episodes, 16 entities, 25 facts | LIKE %topic% returns nothing for generic topics |
| Agent memories | 0 rows | captureMemory regex only triggers on "you idiot", never normal conversation |
| AI Chat memories | 17 stale rows | getRelevantMemories(db, '', topic, 3) empty threadDate matches nothing |
| Entity extraction | 46/47 FAILED | LLM returns non-JSON, parseExtractionJson catches, silently moves on |
| User Profile | Generic traits only | Regex keyword frequency, not real knowledge |
| state.md | NOT injected | Only loaded via system prompt file, not dynamically |
| ContextService.ts | NEVER CALLED | Renderer-side assembly is dead code |
| Budget | 2000 tokens shared | Brain/memory get scraps (~100-2000 chars) |
| Episode writers | 3 of 8 skip extraction | finance, terminal, chat episodes not queued |

**Result:** Agent gets problems + requests + sessions + backup text + weak profile = No memory, no brain, no state.md, no continuity.

## Context Bundle

Read CONTEXT_BUNDLE.md in the same directory — VERBATIM source code.

---

## Engineering Tasks

### Task A — Fix memoryRetrieval threadDate Bug
**File:** src/main/ai/memoryRetrieval.ts
**Bug:** getRelevantMemories(db, '', topic, 3) passes empty threadDate. Primary query WHERE thread_date = ? matches nothing.
**Fix:** Search by topic relevance instead:
- WHERE content LIKE ? OR category LIKE ? ORDER BY importance DESC
- Keep fallback query as-is

### Task B — Fix Entity Extraction Pipeline
**File:** src/main/ai/entityExtraction.ts
**Bug:** LLM returns non-JSON, 46/47 jobs failed.
**Fix:**
1. Add regex-based fallback extractor (capitalized phrases as entities, "X is Y" as facts)
2. Mark jobs 'partial' instead of 'failed' when regex succeeds
3. Lower extraction threshold from 40 chars to 20 chars

### Task C — Fix Budget Starvation
**File:** src/main.ts assemble-context handler
**Bug:** 2000 tokens shared across ALL sources.
**Fix:** Double default to 4000. Add per-source allocation caps:
- problems: 800, requests: 600, sessions: 400, backup: 500, profile: 400
- pageContext: 1000, crossSession: 800, brainMemory: 1500, chat: 600, learner: 400

### Task D — Wire ContextService.ts Into Runtime
**File:** src/pages/TerminalPage.tsx
**Bug:** ContextService.ts (state.md, MEMORY.md, knowledge systems) imported but never called.
**Fix:** Call ContextService.assembleContext() during session creation BEFORE IPC assemble-context. Merge output into initContent.

### Task E — Inject state.md Into assemble-context
**File:** src/main.ts assemble-context handler
**Bug:** state.md never injected.
**Fix:** Add block that reads project's agent/state.md, condenses (header + last 3 date sections), caps at 1500 chars, injects.

### Task F — Populate Agent Memories
**File:** src/main/ai/memoryCapture.ts
**Bug:** captureMemory regex only triggers on "you idiot", "wrong", "stop doing" — never on normal conversation.
**Fix:** Add capture triggers for:
- Decisions: "let's go with", "we'll use", "the approach is"
- Corrections: "actually", "no wait", "that's wrong", "change it to"
- Preferences: "I prefer", "I like", "don't use", "always do"
- Patterns: "every time", "whenever", "the rule is"

### Task G — Fix Episode Source Coverage
**File:** src/main/ai/episodeWriters.ts
**Bug:** writeFinanceEpisode, writeTerminalEpisode, writeAiChatEpisode skip extraction queue.
**Fix:** Add brain.createExtractionJob(epId) call to these 3 writers (same pattern as writeGoalEpisode).

### Task H — Brain Retrieval Improvements
**File:** src/main/ai/contextBrain.ts
**Bug:** LIKE %topic% returns nothing for generic topics like "Quick instruction".
**Fix:**
1. Add STOP WORD filter: skip retrieval if query is < 3 words or all stop words
2. Add RECENCY BOOST: weight recent episodes (last 7 days) 2x higher
3. Add SOURCE DIVERSITY: limit to max 3 episodes per source type
4. If keyword search returns 0 results, fall back to retrieving the 5 most recent episodes regardless of topic

---

## Constraints

- No new npm dependencies
- All fixes are BEST-EFFORT (never crash session)
- Budget caps are hard limits
- ContextService.ts integration must not break existing flow
- Entity extraction regex fallback must not hallucinate entities
- memoryCapture changes must not over-capture (keep existing strict triggers + add new ones)

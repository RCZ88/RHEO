I have enough context to produce the final converged specification.

Below is the content for `RESULT.md`.

---

# RESULT.md — DeskFlow Unified Context Brain & Context Management System

**Target artifact path:**  
`agent/docs/backandfourth-docs/context-brain-system/RESULT.md`

## 1. Executive Summary

DeskFlow currently has multiple partially overlapping context systems:

- Agent memory
- AI chat memory
- Learner profile
- Life phases
- Context assembly service
- AI context bundle
- Context Brain tables and engine
- 3D graph visualization
- Profile visualization placeholders

The missing piece is a **single unified context architecture** that does two things at once:

1. **Captures everything as queryable memory**  
   Episodes, entities, facts, embeddings, signals, corrections, milestones, and app behavior.

2. **Projects that memory into a living user context profile**  
   A read-derived, continuously updated understanding of the user that feeds AI chat, workspace agents, Life pages, and future MCP clients.

This specification defines a two-layer architecture:

### Layer 1 — Context Brain

A bitemporal knowledge graph backed by SQLite.

It stores:

- Episodes
- Entities
- Facts
- Embeddings
- Extraction jobs
- Signals

This layer answers:

> “What happened, when did it happen, what entities were involved, and what facts were true at which time?”

### Layer 2 — Unified User Context Profile

A derived, continuously updated profile projected from the Context Brain and existing DeskFlow systems.

It stores:

- Traits
- Interests
- Habits
- Preferences
- Communication style
- Activity patterns
- Goal patterns
- Growth markers
- Memory highlights

This layer answers:

> “Who is this user, how do they work, what do they care about, and how should the AI behave toward them?”

The profile is **never manually edited**. It is always derived from evidence.

---

## 2. Core Product Principles

### 2.1 Always-updating context

Every meaningful user interaction should update the context system.

Examples:

- User sends an AI chat message
- User corrects the AI
- User completes a goal
- User creates or closes a life phase
- User uses a terminal workspace
- User adds a deadline
- User logs finance activity
- User updates preferences
- User asks the AI not to do something

### 2.2 Read-derived profile

The user profile page is not a form.

It is a mirror of accumulated behavior.

The user should not fill in:

- Personality traits
- Interests
- Habits
- Communication preferences
- Growth markers

These are inferred from evidence.

### 2.3 Bitemporal memory

Facts are never simply deleted.

When a new fact contradicts an old fact:

- Close the old fact’s `valid_to`
- Insert the new fact with a new `valid_from`
- Keep history queryable

Example:

```text
Old fact:
User prefers concise answers
valid_from: 2026-01-01
valid_to: 2026-04-10

New fact:
User prefers detailed explanations
valid_from: 2026-04-10
valid_to: null
```

### 2.4 Confidence-based truth

Not all signals are equal.

Explicit user correction beats inferred behavior.

Example:

```text
Inferred:
User may prefer JavaScript because they open JS files often.
Confidence: 0.42

Explicit:
User said: “I prefer TypeScript over JavaScript.”
Confidence: 0.95
```

The explicit statement should win.

### 2.5 Local-first, privacy-preserving

The core context system must work with the local SQLite database.

External LLM or embedding calls should be optional and configurable.

---

## 3. Recommended Design Decisions

### Decision 1 — Entity extraction should be hybrid

Use a hybrid extraction model:

| Source Type | Extraction Strategy |
|---|---|
| Structured features | Immediate deterministic extraction |
| Semi-structured chat | Immediate lightweight heuristics + queued LLM enrichment |
| Free-form terminal output | Batch LLM extraction |
| Life phase reflections | Batch LLM extraction |
| Manual brain episodes | Immediate or queued depending on length |

#### Why hybrid?

A small LLM call per episode is simple but can create latency and cost.

A pure batch system is efficient but delays context updates.

The hybrid approach gives:

- Immediate profile updates for high-value explicit signals
- Background enrichment for noisy free-form text
- Lower latency in the UI
- Better cost control

### Decision 2 — Do not start with sqlite-vec

`sqlite-vec` requires compiling/loading a native SQLite extension. That adds packaging risk in Electron.

Instead, start with:

1. **Transformers.js / ONNX WASM embeddings**
2. Local embedding model such as:
   - `Xenova/all-MiniLM-L6-v2`
   - or `Xenova/bge-small-en-v1.5`
3. Store embeddings as BLOBs in `context_embeddings`
4. Perform cosine similarity in JavaScript
5. Use SQLite keyword search and graph traversal as primary fallback

This avoids native C extension compilation.

At DeskFlow scale, brute-force cosine similarity over a local embedding table is acceptable.

If the dataset becomes large, sqlite-vec can be introduced later as an optimization.

### Decision 3 — Profile is a projection, not a source of truth

The Context Brain stores evidence.

The Unified Context Profile stores the current projection.

This means:

- The profile can be rebuilt
- The profile can be versioned
- The profile can be explained
- The profile can be audited
- The profile can be regenerated without losing raw memory

### Decision 4 — Existing systems are integrated, not replaced

The new system reads from:

- `agent_memories`
- `ai_chat_memories`
- `life_phases`
- goals
- deadlines
- finance
- app usage logs
- terminal sessions
- connectors
- existing context episodes

It does not delete or replace them.

### Decision 5 — MCP should expose both brain and profile summary

The MCP server should expose:

- Search
- Entity lookup
- Entity history
- Episode logging
- Stats
- Recent episodes
- Active facts
- User profile summary

The profile summary should be exposed only as a compact summary resource, not as raw private signals unless explicitly enabled.

---

## 4. Target Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      DeskFlow Features                      │
│                                                             │
│ AI Chat   Goals   Finance   Deadlines   Life Phases         │
│ Terminal  App Usage  Connectors  Learner Profile            │
└───────────────┬─────────────────────────────────────────────┘
                │ feature events / IPC handlers
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Episode Writer Layer                     │
│                                                             │
│ writeGoalEpisode()                                          │
│ writeFinanceEpisode()                                       │
│ writeDeadlineEpisode()                                      │
│ writeTerminalEpisode()                                      │
│ writeAiChatEpisode()                                        │
│ writeLifePhaseEpisode()                                     │
│ writeConnectorEpisode()                                     │
└───────────────┬─────────────────────────────────────────────┘
                │ episodes
                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Context Brain Core                      │
│                                                             │
│ context_episodes                                            │
│ context_entities                                            │
│ context_facts                                               │
│ context_embeddings                                          │
│ context_extraction_jobs                                     │
└───────┬──────────────────────────────┬──────────────────────┘
        │                              │
        ▼                              ▼
┌────────────────────┐      ┌───────────────────────────────┐
│ Retrieval Router   │      │ Auto-Context Engine           │
│                    │      │                               │
│ keyword search     │      │ signal extraction             │
│ graph traversal    │      │ confidence scoring            │
│ embedding search   │      │ conflict resolution           │
│ MCP tools          │      │ profile projection            │
└────────────────────┘      └──────────────┬────────────────┘
                                           │
                                           ▼
                            ┌───────────────────────────────┐
                            │ Unified User Context Profile  │
                            │                               │
                            │ user_context_profile          │
                            │ user_context_signals          │
                            └──────────────┬────────────────┘
                                           │
        ┌──────────────────────────────────┼──────────────────────────────────┐
        ▼                                  ▼                                  ▼
┌───────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
│ AI Chat Context   │          │ Workspace Context   │          │ Profile UI          │
│ aiContextBundle   │          │ ContextAssembly     │          │ /life?tab=profile   │
└───────────────────┘          └─────────────────────┘          └─────────────────────┘
```

---

## 5. Database Schema

Use the existing SQLite database:

```text
%APPDATA%/RHEO/deskflow-data.db
```

All migrations must be safe:

- Use `CREATE TABLE IF NOT EXISTS`
- Use `PRAGMA table_info` before any `ALTER TABLE`
- Never destructively migrate existing tables
- Wrap schema setup in try/catch
- Log migration failures without crashing the app

---

## 5.1 Existing Context Brain Tables

These already exist according to the context bundle.

### `context_episodes`

```sql
CREATE TABLE IF NOT EXISTS context_episodes (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_ref TEXT,
  content TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  metadata TEXT
);
```

### `context_entities`

```sql
CREATE TABLE IF NOT EXISTS context_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT DEFAULT '[]',
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
```

### `context_facts`

```sql
CREATE TABLE IF NOT EXISTS context_facts (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_id TEXT,
  object_literal TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  source_episode_id TEXT NOT NULL,
  confidence REAL DEFAULT 1.0
);
```

### `context_embeddings`

```sql
CREATE TABLE IF NOT EXISTS context_embeddings (
  ref_id TEXT PRIMARY KEY,
  ref_type TEXT NOT NULL,
  embedding BLOB
);
```

---

## 5.2 New Unified Context Tables

These must be created.

### `user_context_profile`

```sql
CREATE TABLE IF NOT EXISTS user_context_profile (
  id TEXT PRIMARY KEY DEFAULT 'main',

  traits JSON DEFAULT '{}',
  habits JSON DEFAULT '{}',
  preferences JSON DEFAULT '{}',
  goals_pattern JSON DEFAULT '{}',
  activity_pattern JSON DEFAULT '{}',
  growth_markers JSON DEFAULT '[]',
  communication_style JSON DEFAULT '{}',
  interests JSON DEFAULT '[]',
  memory_highlights JSON DEFAULT '[]',
  summary TEXT DEFAULT '',

  context_version INTEGER DEFAULT 1,
  last_updated_at INTEGER,
  created_at INTEGER
);
```

### `user_context_signals`

```sql
CREATE TABLE IF NOT EXISTS user_context_signals (
  id TEXT PRIMARY KEY,

  signal_type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  evidence_episode_id TEXT,
  category TEXT,
  confidence REAL DEFAULT 0.5,

  first_seen_at INTEGER,
  last_seen_at INTEGER,
  occurrence_count INTEGER DEFAULT 1,

  superseded_by TEXT,
  active INTEGER DEFAULT 1
);
```

Recommended indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_user_context_signals_type
ON user_context_signals(signal_type);

CREATE INDEX IF NOT EXISTS idx_user_context_signals_source
ON user_context_signals(source);

CREATE INDEX IF NOT EXISTS idx_user_context_signals_active
ON user_context_signals(active);

CREATE INDEX IF NOT EXISTS idx_user_context_signals_last_seen
ON user_context_signals(last_seen_at);
```

---

## 5.3 New Extraction Job Table

This supports asynchronous LLM extraction.

```sql
CREATE TABLE IF NOT EXISTS context_extraction_jobs (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  locked_at INTEGER
);
```

Status values:

```text
pending
processing
completed
failed
skipped
```

Recommended indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_context_extraction_jobs_status
ON context_extraction_jobs(status);

CREATE INDEX IF NOT EXISTS idx_context_extraction_jobs_episode
ON context_extraction_jobs(episode_id);
```

---

## 6. Unified Context Profile Contract

The profile stored in `user_context_profile` should be a single JSON-shaped aggregate.

Example:

```json
{
  "summary": "The user is currently in a deep technical building phase, focused on DeskFlow, AI context systems, and local-first productivity tools. They prefer direct answers, code-first explanations, and iterative design.",

  "traits": {
    "analytical": 0.82,
    "creative": 0.74,
    "detail_oriented": 0.77,
    "big_picture": 0.68,
    "planner": 0.61,
    "spontaneous": 0.42,
    "code_first": 0.88,
    "concise": 0.71
  },

  "interests": [
    {
      "topic": "AI context systems",
      "score": 0.93,
      "source_count": 18,
      "last_seen_at": 1760000000000
    },
    {
      "topic": "Electron architecture",
      "score": 0.81,
      "source_count": 12,
      "last_seen_at": 1760000000000
    }
  ],

  "habits": {
    "primary_work_window": "22:00-02:00",
    "secondary_work_window": "10:00-13:00",
    "focus_pattern": "late-night deep work",
    "tool_preferences": {
      "terminal": 0.76,
      "ai_chat": 0.89,
      "browser": 0.64
    }
  },

  "preferences": {
    "ai": [
      "Prefers implementation-ready answers",
      "Dislikes vague high-level answers",
      "Wants backend gaps flagged immediately"
    ],
    "ui": [
      "Prefers dark warm UI",
      "Likes glassmorphism cards",
      "Prefers compact technical dashboards"
    ]
  },

  "communication_style": {
    "tone": "direct",
    "preferred_response_format": "structured markdown with implementation plan",
    "avoid": [
      "generic advice",
      "excessive caveats",
      "repeating obvious context"
    ],
    "asking_style": "iterative refinement"
  },

  "goals_pattern": {
    "primary_categories": [
      "product",
      "engineering",
      "ai"
    ],
    "completion_rate_30d": 0.64,
    "active_focus": "Context Brain and unified context management"
  },

  "activity_pattern": {
    "hour_by_day_grid": [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]
    ]
  },

  "growth_markers": [
    {
      "id": "marker_1",
      "date": "2026-04-01",
      "title": "Started DeskFlow Context Brain",
      "source": "life_phase",
      "source_ref": "phase_id_123",
      "evidence": "Life phase milestone"
    }
  ],

  "memory_highlights": [
    {
      "id": "mem_1",
      "content": "User wants AI to always update context and remember corrections.",
      "source": "ai_chat",
      "importance": 0.92
    }
  ]
}
```

---

## 7. Auto-Context Engine

The Auto-Context Engine is the background process responsible for turning raw activity into signals and profile updates.

It should live in the main process.

Suggested file:

```text
src/main/ai/contextAutoEngine.ts
```

---

## 7.1 Engine Responsibilities

The engine should:

1. Receive events from features
2. Create or enrich episodes
3. Extract lightweight signals immediately
4. Queue heavier LLM extraction when needed
5. Upsert entities and facts
6. Detect contradictions
7. Update confidence scores
8. Rebuild the unified profile incrementally
9. Notify renderer/AI systems when profile changes materially

---

## 7.2 Event Sources

| Source | Event Examples | Derived Signals |
|---|---|---|
| AI chat | user message, assistant correction, repeated request | communication style, interests, explicit preferences |
| Agent memory | saved memory, correction, self-reflection | habits, preferences, rules |
| Goals | created, updated, completed, abandoned | achievement patterns, category focus |
| Life phases | created, edited, milestone added | growth markers, mood patterns |
| App usage | active app, focus duration, time of day | schedule patterns, tool preferences |
| Terminal | commands, workspace conversations | technical interests, project focus |
| Finance | expense/income entries | financial priorities, stress patterns if relevant |
| Deadlines | created, completed, missed | planning behavior, time pressure patterns |
| Connectors | imported items | external interests, sources of attention |

---

## 7.3 Signal Types

Recommended signal types:

```text
preference
habit
correction
interest
milestone
pattern
communication_style
tool_preference
goal_pattern
mood_pattern
rule
```

Examples:

```text
preference:
User prefers TypeScript over JavaScript.

correction:
User asked the AI not to generate long generic summaries.

habit:
User often works between 22:00 and 02:00.

interest:
User repeatedly discusses context-aware AI systems.

milestone:
User completed the DeskFlow Context Brain prototype.
```

---

## 7.4 Immediate Lightweight Extraction

Some signals should be extracted synchronously or near-synchronously.

Use deterministic rules for:

- Explicit corrections
- “I prefer” statements
- “Don’t do X” statements
- “I am working on” statements
- Goal completion events
- Life phase milestones
- Repeated app usage patterns

Example regex/heuristic categories:

```text
/prefer|i prefer|i like|i want|always use|never use/i
/don't|do not|stop|avoid|never/i
/i am working on|current focus|right now i'm/i
/my goal|milestone|finished|completed/i
```

These should create signals with moderate-to-high confidence depending on explicitness.

---

## 7.5 Batch LLM Extraction

For free-form text, create an extraction job.

Sources that should be batch-enriched:

- AI chat threads
- Terminal messages
- Life phase reflections
- Manual episodes
- Long memory entries

The extraction LLM should return strict JSON.

Recommended schema:

```json
{
  "entities": [
    {
      "name": "DeskFlow",
      "type": "project",
      "aliases": ["deskflow"]
    }
  ],
  "facts": [
    {
      "subject": "user",
      "predicate": "prefers",
      "object": "TypeScript",
      "confidence": 0.9
    }
  ],
  "signals": [
    {
      "signal_type": "preference",
      "content": "User prefers TypeScript over JavaScript",
      "confidence": 0.88
    }
  ],
  "contradictions": [
    {
      "subject": "user",
      "predicate": "prefers",
      "old_object": "JavaScript",
      "new_object": "TypeScript"
    }
  ]
}
```

The LLM prompt should enforce:

- JSON only
- No commentary
- Conservative confidence
- Do not invent personal facts
- Use evidence only from the provided episode text
- Prefer specific entities over generic ones
- Mark contradictions explicitly

---

## 8. Confidence Scoring

Each signal receives a confidence score between `0.0` and `1.0`.

### 8.1 Formula

```text
confidence =
  sourceWeight
  * explicitness
  * recencyDecay
  * occurrenceBoost
  * extractionReliability
```

### 8.2 Source Weights

| Source | Weight |
|---|---:|
| Explicit user correction | 1.00 |
| Explicit user statement | 0.90 |
| User-created milestone | 0.85 |
| Life phase reflection | 0.75 |
| Agent memory | 0.70 |
| Goal event | 0.65 |
| LLM-extracted signal | 0.55 |
| Regex-extracted signal | 0.40 |
| App usage inference | 0.35 |

### 8.3 Recency Decay

Use exponential decay:

```text
recencyDecay = exp(-ageInDays / halfLifeDays)
```

Recommended half-lives:

| Signal Type | Half-Life |
|---|---:|
| correction | 365 days |
| preference | 180 days |
| communication_style | 180 days |
| habit | 60 days |
| interest | 90 days |
| mood_pattern | 30 days |
| milestone | no decay |
| goal_pattern | 90 days |

### 8.4 Occurrence Boost

```text
occurrenceBoost = 1 + log(occurrence_count)
```

Cap final confidence at `1.0`.

---

## 9. Conflict Resolution

Signals and facts may contradict each other.

### 9.1 Rules

1. Explicit beats inferred.
2. Newer explicit beats older explicit if confidence is close.
3. Higher-confidence inferred can weaken but should not immediately delete an explicit older fact.
4. Contradictory facts should be closed bitemporally, not deleted.
5. Superseded signals should remain queryable with `active = 0`.

### 9.2 Signal Supersession

When a new signal replaces an old one:

```text
old_signal.active = 0
old_signal.superseded_by = new_signal.id
```

### 9.3 Fact Closure

When a contradiction is detected:

```text
old_fact.valid_to = now
new_fact.valid_from = now
new_fact.valid_to = null
```

### 9.4 Example

```text
Old:
User prefers concise answers
confidence: 0.72

New:
User explicitly asks for detailed implementation specs
confidence: 0.94

Result:
Old fact closed.
New fact active.
Communication style profile updated.
```

---

## 10. Entity Extraction Pipeline

Suggested file:

```text
src/main/ai/entityExtraction.ts
```

### 10.1 Structured Extraction

Episode writers should create entities immediately for known structured objects.

Examples:

| Feature | Entity Type |
|---|---|
| Goal | `goal` |
| Finance entry | `finance_item` |
| Deadline | `deadline` |
| Life phase | `life_phase` |
| Terminal session | `terminal_session` |
| Connector | `connector` |
| App | `application` |
| Project | `project` |

### 10.2 Free-Text Extraction

Free-text sources require LLM extraction.

Pipeline:

```text
episode created
→ extraction job created
→ extraction worker picks job
→ LLM returns JSON
→ entities upserted
→ facts inserted/closed
→ signals inserted
→ profile rebuild triggered
```

### 10.3 Entity Normalization

Before inserting an entity:

1. Normalize name casing
2. Trim punctuation
3. Check aliases
4. Merge duplicates
5. Update `last_seen`
6. Add aliases if new alias appears

Example:

```text
DeskFlow
deskflow
Desk Flow
```

All should resolve to one entity.

---

## 11. Embedding Generation

Suggested file:

```text
src/main/ai/embeddingService.ts
```

### 11.1 Recommended Approach

Use Transformers.js with ONNX/WASM.

Model options:

```text
Xenova/all-MiniLM-L6-v2
Xenova/bge-small-en-v1.5
```

Embedding dimension:

```text
384
```

Store as `Float32Array` serialized to `Buffer`.

### 11.2 Embedding Targets

Embed:

- Episodes
- Signals
- Facts, optionally
- Profile summary, optionally

Primary target should be episodes.

### 11.3 Storage

Use existing `context_embeddings`:

```text
ref_id = episode_id or signal_id
ref_type = 'episode' | 'signal' | 'fact'
embedding = BLOB
```

### 11.4 Search Flow

```text
query
→ embed query
→ load candidate embeddings
→ cosine similarity
→ combine with keyword score
→ return retrieval result
```

### 11.5 Fallback

If embedding model cannot load:

- Use keyword search
- Use graph traversal
- Use hashed term vector fallback

The app must remain functional without embeddings.

---

## 12. Episode Writer Integration

Current gap: episode writers exist but are not called from feature IPC handlers.

This must be fixed.

### 12.1 Integration Rule

Every feature mutation that matters to context should call the appropriate episode writer.

This should be done in the main process after the primary feature operation succeeds.

Important: episode writing must never break the feature.

Use:

```ts
try {
  writeGoalEpisode(goal, action);
} catch (err) {
  console.error('[contextBrain] episode writer failed', err);
}
```

### 12.2 Feature Hook Map

| Feature | Hook Location | Episode Writer |
|---|---|---|
| Goals | goal create/update/complete handlers | `writeGoalEpisode` |
| Finance | finance add/update/delete handlers | `writeFinanceEpisode` |
| Deadlines | deadline create/update/complete handlers | `writeDeadlineEpisode` |
| Terminal | terminal message handler | `writeTerminalEpisode` |
| AI Chat | AI chat message persistence | `writeAiChatEpisode` |
| Life Phases | life phase save/delete/milestone handlers | `writeLifePhaseEpisode` |
| Connectors | connector sync/import handlers | `writeConnectorEpisode` |

### 12.3 Debouncing

Do not write an episode for every keystroke.

Use debouncing for high-frequency events:

- Terminal output: batch by session or message role
- App usage: aggregate into intervals
- AI chat: capture completed user turns, not streaming deltas

---

## 13. Retrieval Router

The existing retrieval router should be expanded.

### 13.1 Retrieval Strategies

The router should support:

```text
keyword
graph
embedding
profile
recency
hybrid
```

### 13.2 Hybrid Ranking

Final score should combine:

```text
finalScore =
  0.35 * keywordScore
+ 0.30 * embeddingScore
+ 0.20 * recencyScore
+ 0.15 * graphProximityScore
```

If embeddings are unavailable:

```text
finalScore =
  0.55 * keywordScore
+ 0.25 * recencyScore
+ 0.20 * graphProximityScore
```

### 13.3 Retrieval Output Shape

```ts
interface RetrievalResult {
  query: string;
  episodes: ContextEpisode[];
  entities: ContextEntity[];
  facts: ContextFact[];
  signals: UserContextSignal[];
  profileSummary?: string;
  tokenBudgetUsed: number;
}
```

---

## 14. MCP Server

Existing file:

```text
src/main/ai/contextBrainMCP.ts
```

The MCP server must be verified and hardened.

---

## 14.1 Startup Requirement

On app ready:

```text
initContextBrain()
startMcpServer()
```

If port `54322` is already in use:

1. Try next port if appropriate
2. Log clearly
3. Expose actual MCP status via IPC
4. Do not crash the app

Recommended IPC:

```text
brain:mcp-status
```

---

## 14.2 MCP Tools

Existing tools:

```text
search_context
get_entity
get_entity_history
log_episode
get_stats
```

Add:

```text
get_user_profile_summary
get_active_facts
get_recent_signals
```

### `get_user_profile_summary`

Returns compact profile summary only.

Example:

```json
{
  "summary": "User is currently focused on building DeskFlow's context system.",
  "communication_style": "direct",
  "top_interests": [
    "AI context systems",
    "Electron architecture"
  ],
  "active_focus": "Context Brain implementation"
}
```

Do not expose full raw signals by default.

---

## 14.3 MCP Resources

Existing:

```text
context://recent-episodes
context://active-facts
context://stats
```

Add:

```text
context://user-profile-summary
context://recent-signals
```

---

## 14.4 Security

The MCP server is local, but it should still be protected.

Minimum:

- Bind to localhost only
- Add optional token header:

```text
X-DeskFlow-MCP-Token
```

- Add rate limiting
- Reject malformed JSON
- Limit response size
- Log requests optionally

Recommended rate limit:

```text
60 requests per minute per client
```

---

## 15. IPC Specification

Use existing Electron IPC pattern:

- `ipcMain.handle` in main process
- `ipcRenderer.invoke` via preload
- No direct DB access from renderer

---

## 15.1 Existing Brain IPC

These already exist according to the bundle:

| Channel | Purpose |
|---|---|
| `brain:search` | Search context brain |
| `brain:get-entity` | Get entity by ID |
| `brain:get-entity-history` | Get entity fact history |
| `brain:log-episode` | Manually log episode |
| `brain:stats` | Get brain stats |
| `brain:export` | Export context bundle |

---

## 15.2 New Unified Context IPC

These must be built.

| Channel | Direction | Purpose |
|---|---|---|
| `context:get-profile` | renderer → main | Get unified profile |
| `context:update-profile` | renderer → main | Internal/profile-rebuild update |
| `context:add-signal` | renderer → main | Record explicit signal |
| `context:get-signals` | renderer → main | Query signals |
| `context:rebuild` | renderer → main | Rebuild profile from sources |
| `context:get-growth` | renderer → main | Get growth timeline |
| `context:get-memory-highlights` | renderer → main | Get highlighted memories |
| `context:get-debug` | renderer → main | Get engine/job status |

---

## 15.3 New Brain Management IPC

Recommended additions:

| Channel | Purpose |
|---|---|
| `brain:get-episodes` | Paginated episode list |
| `brain:get-entities` | Paginated entity list |
| `brain:get-facts` | Active or historical facts |
| `brain:get-jobs` | Extraction job status |
| `brain:retry-job` | Retry failed extraction |
| `brain:create-episode` | Manual episode creation UI |
| `brain:mcp-status` | MCP server status |
| `brain:reindex-embeddings` | Rebuild embeddings |

---

## 15.4 Preload API

Add to `src/preload.ts`.

Example namespace:

```ts
contextAPI: {
  getProfile: () => ipcRenderer.invoke('context:get-profile'),
  updateProfile: (patch) => ipcRenderer.invoke('context:update-profile', patch),
  addSignal: (signal) => ipcRenderer.invoke('context:add-signal', signal),
  getSignals: (query) => ipcRenderer.invoke('context:get-signals', query),
  rebuild: () => ipcRenderer.invoke('context:rebuild'),
  getGrowth: () => ipcRenderer.invoke('context:get-growth'),
  getMemoryHighlights: () => ipcRenderer.invoke('context:get-memory-highlights'),
  getDebug: () => ipcRenderer.invoke('context:get-debug'),
}
```

Brain additions:

```ts
brainAPI: {
  search: (query, options) => ipcRenderer.invoke('brain:search', query, options),
  getEpisodes: (options) => ipcRenderer.invoke('brain:get-episodes', options),
  getEntities: (options) => ipcRenderer.invoke('brain:get-entities', options),
  getFacts: (options) => ipcRenderer.invoke('brain:get-facts', options),
  getEntity: (id) => ipcRenderer.invoke('brain:get-entity', id),
  getEntityHistory: (id) => ipcRenderer.invoke('brain:get-entity-history', id),
  logEpisode: (episode) => ipcRenderer.invoke('brain:log-episode', episode),
  stats: () => ipcRenderer.invoke('brain:stats'),
  export: () => ipcRenderer.invoke('brain:export'),
  getJobs: () => ipcRenderer.invoke('brain:get-jobs'),
  retryJob: (id) => ipcRenderer.invoke('brain:retry-job', id),
  mcpStatus: () => ipcRenderer.invoke('brain:mcp-status'),
  reindexEmbeddings: () => ipcRenderer.invoke('brain:reindex-embeddings'),
}
```

---

## 16. Context Profile Page

Route:

```text
/life?tab=profile
```

This page must be read-derived.

No manual editing fields.

---

## 16.1 Page Structure

### Header Summary Card

Shows:

- User context summary
- Last updated time
- Context version
- Rebuild button

The rebuild button does not manually edit profile data. It regenerates the projection from evidence.

### Personality Radar

Derived traits:

```text
Analytical ↔ Creative
Detail-oriented ↔ Big-picture
Planner ↔ Spontaneous
Code-first ↔ Concept-first
Concise ↔ Detailed
Independent ↔ Collaborative
```

Use SVG or canvas radar chart.

### Interest Map

Top interests ranked by engagement.

Display:

- Topic
- Score
- Source count
- Last seen

Show top 10 by default.

### Growth Timeline

Vertical timeline of growth markers.

Each marker shows:

- Date
- Title
- Source type
- Evidence preview

Clicking a marker opens source details.

Possible sources:

- Life phase
- Goal completion
- AI chat memory
- Agent memory
- Manual brain episode

### Activity Heatmap

Grid:

```text
Rows: day of week
Columns: hour of day
```

Data sources:

- App usage logs
- AI chat timestamps
- Terminal activity
- Goal work patterns

### Communication Style Card

Shows:

- Tone
- Preferred response format
- Things to avoid
- Explicit corrections

Example:

```text
Prefers implementation-ready answers.
Avoid generic summaries.
Flag backend gaps immediately.
Use structured markdown.
```

### Memory Highlights

Important memories and corrections.

Sources:

- `agent_memories`
- `ai_chat_memories`
- High-confidence context signals

---

## 16.2 Profile Page UX Flow

```text
User opens /life?tab=profile
→ show skeleton layout
→ call context:get-profile
→ if empty, call context:rebuild or show onboarding empty state
→ animate sections in
→ allow expanding each card
→ clicking a marker or signal shows source evidence drawer
```

### Loading State

Show skeletons for:

- Summary
- Radar
- Heatmap
- Timeline
- Interests
- Communication style

### Empty State

If no profile exists:

```text
Your context profile is being generated from your DeskFlow activity.
```

If still empty:

```text
Not enough context yet. Use DeskFlow features, chat with AI, complete goals, and update life phases.
```

### Evidence Drawer

When clicking a derived item, show:

- Signal content
- Confidence
- Source
- First seen
- Last seen
- Occurrence count
- Related episode or memory

---

## 16.3 Visual Design

Use existing warm dark design tokens.

Do not hardcode colors if a token exists.

Primary tokens:

```css
--dk-bg-deep
--dk-bg-base
--dk-bg-surface
--dk-bg-raised
--dk-accent
--dk-accent-dim
--dk-success
--dk-warning
--dk-danger
--dk-text-primary
--dk-text-secondary
--dk-text-muted
```

Design language:

- Glassmorphism cards
- Warm amber accent
- Soft borders
- Subtle blur
- Smooth fade/slide entry
- High readability
- No manual form fields

Card style direction:

```css
background: var(--dk-bg-surface);
backdrop-filter: blur(16px);
border: 1px solid color-mix(in srgb, var(--dk-accent) 12%, transparent);
border-radius: 16px;
```

Accent usage:

```css
color: var(--dk-accent);
background: var(--dk-accent-dim);
```

---

## 17. Brain Management UI

Current gap: only the 3D graph exists.

Add a management tab.

Recommended route:

```text
/life?tab=brain
```

This is separate from the profile tab.

---

## 17.1 Brain Tab Sections

### Search Panel

Input:

```text
Search episodes, entities, facts, signals...
```

Filters:

- Source
- Entity type
- Date range
- Strategy: keyword / semantic / hybrid
- Include superseded facts

### Episodes List

Columns:

- Source
- Preview
- Occurred at
- Ingested at
- Entity count
- Extraction status

Actions:

- Open episode
- View entities
- View facts
- Re-run extraction

### Entities List

Columns:

- Name
- Type
- First seen
- Last seen
- Fact count
- Alias count

Clicking entity opens detail panel.

### Entity Detail Panel

Shows:

- Entity name
- Type
- Aliases
- First/last seen
- Current facts
- Historical facts
- Related episodes
- Graph focus button

### Manual Episode Creator

This is allowed because it creates evidence, not profile fields.

Fields:

```text
Source
Content
Source reference, optional
Metadata, optional
```

Sources:

```text
manual
note
reflection
correction
observation
```

On submit:

```text
brain:create-episode
→ episode inserted
→ extraction job queued
→ profile eventually updated
```

### Extraction Jobs Panel

Shows:

- Pending
- Processing
- Completed
- Failed
- Skipped

Actions:

- Retry failed
- Clear completed

### Brain Stats

Show:

- Episodes
- Entities
- Facts
- Current facts
- Signals
- Embeddings
- MCP status
- Last rebuild time

---

## 18. 3D Graph Improvements

The existing graph stack should remain:

- React Three Fiber
- d3-force-3d
- Bloom postprocessing
- GraphNode
- GraphEdge
- EntityDetailPanel
- GraphControls

Improvements:

### 18.1 Filtering

Allow filtering by:

- Entity type
- Source
- Date range
- Confidence threshold
- Current facts only

### 18.2 Node Sizing

Size nodes by:

- Fact count
- Episode references
- Recency
- Confidence-weighted importance

### 18.3 Edge Semantics

Edges should display predicate labels on hover.

Examples:

```text
user → prefers → TypeScript
user → working_on → DeskFlow
DeskFlow → has_feature → Context Brain
```

### 18.4 Focus Mode

Clicking an entity should:

- Center camera
- Highlight connected entities
- Dim unrelated nodes
- Open EntityDetailPanel

### 18.5 Performance

For large graphs:

- Limit visible nodes
- Cluster low-importance entities
- Use instanced meshes if needed
- Pause simulation when tab inactive

---

## 19. AI Chat Integration

Existing file:

```text
src/services/aiContextBundle.ts
```

This must not be broken.

The unified profile should be injected as an additional section.

---

## 19.1 Token Budget

Total AI chat context budget remains under:

```text
12,000 characters
```

Recommended allocation:

| Section | Budget |
|---|---:|
| Live feature context | 5,500 chars |
| User profile summary | 2,500 chars |
| Relevant brain memories | 2,500 chars |
| Reserved safety buffer | 1,500 chars |

If total exceeds budget, drop in priority order:

1. Low-confidence inferred signals
2. Old activity patterns
3. Low-importance memories
4. Interests below top 5
5. Older growth markers

Never drop explicit corrections first.

---

## 19.2 Profile Injection Format

Use compact markdown.

Example:

```markdown
<user_context>
Summary:
User is currently focused on building DeskFlow's context system and prefers implementation-ready, structured technical answers.

Communication:
- Direct tone
- Prefers code-first explanations
- Dislikes vague summaries
- Wants backend gaps flagged

Active interests:
- AI context systems
- Electron architecture
- SQLite knowledge graphs

Current focus:
- Context Brain entity extraction
- Unified profile projection
- MCP integration

Relevant memories:
- User wants all AI interactions to update persistent context.
- User wants the profile to be auto-derived, not manually entered.
</user_context>
```

---

## 19.3 Behavioral Adaptation

The AI chat should use the profile to:

- Match tone
- Prefer the user’s response format
- Remember explicit corrections
- Reference recent focus areas
- Avoid repeating forgotten context
- Ask better follow-up questions

But it should not:

- Over-personalize when irrelevant
- Mention private data unnecessarily
- Invent memories
- Present low-confidence inferences as facts

---

## 20. Workspace Integration

Existing service:

```text
src/services/ContextAssemblyService.ts
```

Terminal/workspace agents should also receive user context.

---

## 20.1 Workspace Context Sections

Add a compact user context section to assembled workspace prompts.

Example:

```markdown
## User Context
- Prefers TypeScript and implementation-ready output.
- Current focus: DeskFlow Context Brain.
- Communication style: direct, structured, technical.
- Avoid generic advice and vague summaries.
```

Budget:

```text
500–900 tokens
```

### 20.2 Workspace Capability Hints

The workspace agent should also know what DeskFlow UI/tools can do.

Add a static capability summary:

```markdown
## DeskFlow Capabilities
- Life pages: profile, graph, phases
- Goals tracking
- Finance tracking
- Deadlines
- Terminal workspace
- AI chat
- Context Brain search and episode logging
```

This helps the AI understand what UI tools are available.

---

## 21. Real-Time Update Strategy

The requirement is that context updates continuously.

Use a tiered update model.

### Tier 1 — Immediate

Occurs during the interaction.

Examples:

- Explicit correction
- “I prefer X”
- Goal completed
- Milestone added
- Manual episode created

Effect:

- Signal inserted
- Profile incrementally updated
- AI context cache invalidated

### Tier 2 — Near-real-time

Occurs within seconds to minutes.

Examples:

- Chat episode enrichment
- Terminal episode enrichment
- Entity extraction job completion

Effect:

- Entities/facts updated
- Interests updated
- Traits adjusted

### Tier 3 — Batch

Occurs periodically.

Examples:

- App usage aggregation
- Embedding reindex
- Full profile rebuild
- Decay recalculation

Recommended schedules:

```text
Signal decay recalculation: every 6 hours
Full profile rebuild: daily or on demand
Embedding catch-up: every 30 minutes when idle
Extraction queue worker: every 60 seconds
```

---

## 22. Profile Rebuild Process

`context:rebuild` should regenerate the profile from evidence.

### Rebuild Sources

```text
context_episodes
context_entities
context_facts
user_context_signals
agent_memories
ai_chat_memories
life_phases
goals
logs
```

### Rebuild Steps

1. Mark rebuild as running
2. Collect existing signals
3. Scan source systems
4. Extract or refresh signals
5. Apply confidence scoring
6. Resolve conflicts
7. Aggregate traits, interests, habits, patterns
8. Generate growth markers
9. Generate summary
10. Write `user_context_profile`
11. Increment `context_version`
12. Notify renderer

### Rebuild Output

Return:

```json
{
  "success": true,
  "profileVersion": 7,
  "signalsProcessed": 184,
  "sourcesScanned": [
    "agent_memories",
    "ai_chat_memories",
    "life_phases",
    "goals",
    "logs",
    "context_episodes"
  ]
}
```

---

## 23. File-by-File Implementation Plan

This is the recommended implementation plan.

---

## 23.1 Main Process Files

### `src/main/ai/contextBrain.ts`

Changes:

- Add profile-aware retrieval
- Add signal-aware search
- Add current fact closure helpers
- Add contradiction handling
- Add stats for signals and jobs
- Add export summary for profile

New responsibilities:

- Coordinate with Auto-Context Engine
- Support hybrid search
- Expose active facts and signals

---

### `src/main/ai/episodeWriters.ts`

Changes:

- Harden try/catch
- Return episode IDs
- Emit event after episode creation
- Add source metadata
- Add extraction job creation for free-text sources

---

### `src/main/ai/contextBrainMCP.ts`

Changes:

- Verify startup
- Add localhost binding guard
- Add token auth option
- Add rate limiting
- Add profile summary tool/resource
- Add MCP status endpoint

---

### `src/main/ai/contextAutoEngine.ts`

New file.

Responsibilities:

- Signal ingestion
- Lightweight extraction
- Confidence scoring
- Conflict resolution
- Profile aggregation
- Incremental rebuild
- Full rebuild orchestration

---

### `src/main/ai/entityExtraction.ts`

New file.

Responsibilities:

- LLM extraction prompt
- JSON validation
- Entity normalization
- Fact upsert
- Contradiction detection
- Signal creation

---

### `src/main/ai/embeddingService.ts`

New file.

Responsibilities:

- Load embedding model
- Embed episodes/signals/query
- Store embedding BLOBs
- Cosine similarity search
- Fallback hashed vector mode

---

### `src/main/ai/contextScheduler.ts`

New file.

Responsibilities:

- Run extraction worker
- Run decay recalculation
- Run nightly rebuild
- Run embedding catch-up
- Expose job status

---

### `src/main.ts`

Changes:

- Create new tables
- Register new IPC handlers
- Call `initContextBrain()` on app ready
- Start MCP server
- Wire episode writers into feature handlers
- Expose context engine status
- Ensure graceful shutdown

Feature handlers to wire:

- Goals
- Finance
- Deadlines
- Terminal
- AI chat
- Life phases
- Connectors

---

### `src/preload.ts`

Changes:

- Add `contextAPI`
- Extend `brainAPI`
- Expose MCP status
- Expose signal/profile/rebuild methods

---

## 23.2 Renderer Files

### `src/App.tsx`

Changes:

- Ensure Life route supports profile/graph/brain tabs
- No direct context logic here

---

### `src/pages/LifePage.tsx`

Changes:

- Add tabs:
  - `profile`
  - `graph`
  - `brain`
- Load tab from query param
- Preserve tab state

---

### `src/components/life/ProfileTab.tsx`

Primary profile implementation.

If a `life-river` variant exists, consolidate or re-export.

Responsibilities:

- Fetch profile
- Skeleton loading
- Section rendering
- Evidence drawer
- Rebuild action

---

### `src/components/life/profile/SummaryCard.tsx`

New component.

Shows:

- Summary
- Last updated
- Context version
- Rebuild button

---

### `src/components/life/profile/PersonalityRadar.tsx`

New or refactored component.

Shows trait radar.

---

### `src/components/life/profile/InterestCloud.tsx`

New or refactored component.

Shows top interests.

---

### `src/components/life/profile/GrowthTimeline.tsx`

New component.

Shows growth markers and source evidence.

---

### `src/components/life/profile/ActivityHeatmap.tsx`

New or refactored component.

Shows day/hour activity grid.

---

### `src/components/life/profile/CommunicationStyleCard.tsx`

New component.

Shows communication preferences and corrections.

---

### `src/components/life/profile/MemoryHighlights.tsx`

New component.

Shows important memories and corrections.

---

### `src/features/warmth/context-brain/BrainManagementView.tsx`

New file.

Main brain tab container.

Sections:

- Search
- Episodes
- Entities
- Facts
- Jobs
- Manual episode creator
- Stats

---

### `src/features/warmth/context-brain/EpisodeList.tsx`

New file.

Paginated episode browser.

---

### `src/features/warmth/context-brain/EntityList.tsx`

New file.

Entity browser.

---

### `src/features/warmth/context-brain/EntityDetailDrawer.tsx`

New file.

Shows:

- Current facts
- Historical facts
- Related episodes
- Graph focus action

---

### `src/features/warmth/context-brain/ManualEpisodeForm.tsx`

New file.

Creates manual evidence episodes.

---

### `src/features/warmth/context-brain/ExtractionJobsPanel.tsx`

New file.

Shows extraction job status.

---

### `src/features/warmth/context-graph/GraphScene.tsx`

Changes:

- Add filtering props
- Improve node focus
- Improve performance
- Show predicate labels on hover

---

### `src/features/warmth/context-graph/EntityDetailPanel.tsx`

Changes:

- Show current facts vs historical facts
- Show confidence
- Show source episode
- Add “focus graph” action

---

### `src/services/aiContextBundle.ts`

Changes:

- Fetch unified profile summary
- Fetch relevant brain memories
- Merge into existing context bundle
- Enforce token budget
- Prioritize explicit corrections

---

### `src/hooks/useContextProfile.ts`

New hook.

Responsibilities:

- Fetch profile
- Track loading
- Trigger rebuild
- Refresh on context update events

---

### `src/hooks/useContextBrain.ts`

New hook.

Responsibilities:

- Search brain
- Fetch episodes/entities/facts
- Manage brain tab state

---

## 24. Backend Audit

### 24.1 Already Exists

| Feature | Status |
|---|---|
| SQLite context tables | ✅ Exists |
| Context Brain core engine | ✅ Exists |
| Episode writers | ✅ Exists |
| MCP server file | ✅ Exists |
| Brain IPC endpoints | ✅ Exists |
| Brain preload methods | ✅ Exists |
| 3D graph UI | ✅ Exists |
| Profile visualization primitives | ✅ Partially exists |
| Agent memory system | ✅ Exists |
| AI chat memory extractor | ✅ Exists |
| Life phases | ✅ Exists |
| Goals/finance/deadline/app usage sources | ✅ Exist |

---

### 24.2 Must Be Built

| Feature | Status |
|---|---|
| `user_context_profile` table | 🔴 Must build |
| `user_context_signals` table | 🔴 Must build |
| `context_extraction_jobs` table | 🔴 Must build |
| Auto-Context Engine | 🔴 Must build |
| Entity extraction pipeline | 🔴 Must build |
| Embedding generation | 🔴 Must build |
| Episode writer feature wiring | 🔴 Must build |
| MCP startup verification | 🟠 Must verify |
| MCP auth/rate limiting | 🔴 Must build |
| Brain management UI | 🔴 Must build |
| Unified profile IPC | 🔴 Must build |
| Profile evidence drawer | 🔴 Must build |
| AI chat profile injection | 🔴 Must build |
| Workspace profile injection | 🔴 Must build |

---

### 24.3 IPC Verification Matrix

| Feature | IPC Channel | Handler Exists? | Service Class | DB Schema | Status |
|---|---|---:|---|---|---|
| Get profile | `context:get-profile` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Update profile | `context:update-profile` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Add signal | `context:add-signal` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Get signals | `context:get-signals` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Rebuild profile | `context:rebuild` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Get growth | `context:get-growth` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Get memory highlights | `context:get-memory-highlights` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Get context debug | `context:get-debug` | ❌ No | ❌ No | ❌ No | 🔴 Optional but recommended |
| Brain search | `brain:search` | ✅ Yes | ✅ contextBrain | ✅ context tables | ✅ Real |
| Get entity | `brain:get-entity` | ✅ Yes | ✅ contextBrain | ✅ context_entities | ✅ Real |
| Get entity history | `brain:get-entity-history` | ✅ Yes | ✅ contextBrain | ✅ context_facts | ✅ Real |
| Log episode | `brain:log-episode` | ✅ Yes | ✅ contextBrain | ✅ context_episodes | ✅ Real |
| Brain stats | `brain:stats` | ✅ Yes | ✅ contextBrain | ✅ context tables | ✅ Real |
| Brain export | `brain:export` | ✅ Yes | ✅ contextBrain | ✅ context tables | ✅ Real |
| Get episodes list | `brain:get-episodes` | ❌ No | ❌ No | ✅ context_episodes | 🔴 Must build |
| Get entities list | `brain:get-entities` | ❌ No | ❌ No | ✅ context_entities | 🔴 Must build |
| Get facts list | `brain:get-facts` | ❌ No | ❌ No | ✅ context_facts | 🔴 Must build |
| Get extraction jobs | `brain:get-jobs` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| Retry extraction job | `brain:retry-job` | ❌ No | ❌ No | ❌ No | 🔴 Must build |
| MCP status | `brain:mcp-status` | ❌ No | ❌ No | N/A | 🔴 Must build |
| Reindex embeddings | `brain:reindex-embeddings` | ❌ No | ❌ No | ✅ context_embeddings | 🔴 Must build |
| Read agent memories | `memory:get` | ✅ Yes | ✅ memoryStore | ✅ agent_memories | ✅ Real |
| Read chat memories | `ai-chat:get-memories` | ✅ Yes | ✅ main.ts | ✅ ai_chat_memories | ✅ Real |
| Read life phases | `lifePhase:get` | ✅ Yes | ✅ main.ts | ✅ life_phases | ✅ Real |
| Read goals | `get-goals` | ✅ Yes | ✅ main.ts | ✅ goals | ✅ Real |
| Read app usage | `getDashboardAggregates` | ✅ Yes | ✅ main.ts | ✅ logs | ✅ Real |

---

## 25. Constraints Compliance

### Existing DB

✅ Uses existing better-sqlite3 database.

No new database file required.

### Existing IPC Pattern

✅ Uses `ipcMain.handle` and preload `ipcRenderer.invoke`.

### Integration With Existing Memory Systems

✅ Reads from:

- `agent_memories`
- `ai_chat_memories`
- life phases
- goals
- app usage logs

Does not replace them.

### Warm Dark Theme

✅ Uses existing design tokens.

Profile UI uses glassmorphism and warm accent tokens.

### Does Not Break Existing AI Chat Flow

✅ Extends `aiContextBundle.ts` instead of replacing it.

### Profile Data Auto-Derived

✅ Profile page has no manual profile editing.

Manual episode creation is evidence entry, not profile editing.

### Real-Time Context Updates

✅ Immediate lightweight signal capture plus asynchronous enrichment.

### Token Budget

✅ AI chat context remains under 12K chars by using compact summary projection.

---

## 26. Risks and Mitigations

### Risk 1 — LLM extraction cost or latency

Mitigation:

- Batch extraction
- Queue worker
- Only enrich high-value sources
- Use regex heuristics for explicit signals
- Make LLM extraction optional

---

### Risk 2 — Embedding model too heavy for Electron

Mitigation:

- Use small ONNX/WASM model
- Lazy-load model only when needed
- Provide fallback keyword search
- Make embeddings optional

---

### Risk 3 — Profile becomes noisy or wrong

Mitigation:

- Confidence scoring
- Evidence drawer
- Supersession instead of deletion
- Explicit correction priority
- Manual rebuild action

---

### Risk 4 — MCP server security

Mitigation:

- Localhost only
- Optional token
- Rate limiting
- Payload validation
- Response size limits

---

### Risk 5 — Main process overload

Mitigation:

- Debounce episode creation
- Batch extraction
- Run heavy work off critical UI paths
- Use job queue
- Limit concurrent extraction jobs

---

## 27. Acceptance Criteria

The implementation is complete when:

### Context Brain

- [ ] Episodes are created from major feature actions
- [ ] Entities are created from structured sources
- [ ] Free-text episodes can be enriched by extraction jobs
- [ ] Facts are bitemporal and contradictions close old facts
- [ ] Search returns keyword/graph/embedding-aware results
- [ ] MCP server starts on app launch
- [ ] MCP tools work locally
- [ ] Brain stats are accurate

### Unified Profile

- [ ] `user_context_profile` exists and loads
- [ ] `user_context_signals` exists and accepts signals
- [ ] Profile updates after explicit chat correction
- [ ] Profile updates after goal completion
- [ ] Profile updates after life phase milestone
- [ ] Profile can be rebuilt
- [ ] Profile page is read-only
- [ ] Every derived item can show evidence

### AI Integration

- [ ] AI chat receives profile summary
- [ ] Total AI context remains under 12K chars
- [ ] Explicit corrections are prioritized
- [ ] Workspace agents receive user context
- [ ] Existing chat flow still works

### UI

- [ ] `/life?tab=profile` renders profile
- [ ] `/life?tab=graph` renders graph
- [ ] `/life?tab=brain` renders brain management
- [ ] Profile page uses warm dark glassmorphism theme
- [ ] Skeleton loading works
- [ ] Evidence drawer works
- [ ] Manual episode creation works

---

## 28. Recommended Implementation Order

### Phase 1 — Foundation

1. Create new tables
2. Add context IPC skeleton
3. Add preload methods
4. Verify MCP startup
5. Add brain stats/debug endpoint

### Phase 2 — Episode Wiring

1. Wire goal episodes
2. Wire life phase episodes
3. Wire AI chat episodes
4. Wire terminal episodes
5. Wire finance/deadline/connector episodes

### Phase 3 — Auto-Context Engine

1. Create signal table ingestion
2. Add lightweight regex/heuristic extraction
3. Add confidence scoring
4. Add conflict resolution
5. Build profile projection

### Phase 4 — Profile UI

1. Build ProfileTab
2. Add radar, heatmap, interests, timeline
3. Add evidence drawer
4. Add rebuild action

### Phase 5 — Extraction and Embeddings

1. Add extraction jobs
2. Add LLM extraction worker
3. Add embedding service
4. Add semantic search fallback
5. Add reindex action

### Phase 6 — Brain Management UI

1. Episode list
2. Entity list
3. Fact history
4. Manual episode form
5. Job monitor

### Phase 7 — AI Injection

1. Inject profile into AI chat
2. Inject profile into workspace assembly
3. Enforce token budgets
4. Add priority pruning

---

## 29. Final Specification Summary

Build DeskFlow’s context system as two connected layers:

1. **Context Brain**
   - Episodes
   - Entities
   - Bitemporal facts
   - Embeddings
   - MCP exposure
   - 3D graph
   - Management UI

2. **Unified User Context Profile**
   - Signals
   - Confidence scoring
   - Conflict resolution
   - Read-derived profile
   - Life page visualization
   - AI chat injection
   - Workspace injection

The system must feel like a living memory:

- It updates continuously
- It remembers corrections
- It explains its evidence
- It never requires manual profile entry
- It makes AI interactions feel personally aware
- It remains local-first and inspectable

The most important architectural rule:

> Raw memory lives in the Context Brain.  
> The user profile is a derived projection of that memory.  
> The AI receives only the compact, high-value projection needed for the current interaction.
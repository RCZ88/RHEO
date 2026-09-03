# CONTEXT_BUNDLE.md — Browser Extension Brain Orchestration Fix

> **Task:** Fix and extend the DeskFlow browser extension so external AI websites properly update the brain context orchestrated by an AI provider. Extend with chart/category management, AI topic-awareness, bidirectional chat injection, chart export, and generate-prompt skill integration.
> **Generated:** 2026-09-02
> **Project:** App Tracker (DeskFlow) — Electron + React + Vite

---

## 1. Project Overview

DeskFlow is an Electron + React + Vite app (RHEO) that includes a browser extension (MV3, Manifest v3, version 1.3.0, "DeskFlow Browser Bridge"). The extension captures AI conversations from external websites (ChatGPT, Claude, Perplexity, etc.) and sends them to the Electron app at `localhost:54321`, where they should be processed into brain context entities and facts.

## 2. Architecture — Browser Extension → Context Brain Data Flow

```
[chatgpt.com / claude.ai / perplexity.ai / etc.]
        │
        ▼
┌─ browser-extension/ai-context-content.js (content script, 17,948 chars)
│  • fetch interceptor clones API responses from 14 AI provider domains
│  • MutationObserver watches DOM for chat messages
│  • Buffers captures: FLUSH_INTERVAL_MS=5000, MAX_PAYLOAD_BYTES=280000
│  • Sends POST to http://localhost:54321/ai-context
│
├─ browser-extension/background.js (service worker, 22,040 chars)
│  • Polls GET http://localhost:54321/extension/poll every 2s for commands
│  • Command types: INSERT_INTO_CHAT, CONTENT_ENGINE_INJECT, LEARN_INJECT,
│    GOALS_INJECT, FINANCE_INJECT, RESUME_INJECT, GENERAL_INJECT
│  • Injected back via DESKFLOW_INSERT_CONTEXT / INJECT_PROMPT window.postMessage
│  • flushAiContext() drains aiContextBuffer via POST /ai-context
│  • On chrome.runtime.onSuspend: flushes remaining buffer
│
├─ src/main.ts POST /ai-context (line ~21204)
│  • Parses payload.captures[]
│  • INSERT OR IGNORE INTO ai_context_captures (provider, messages, url, title, source, timestamp, dedup_key, captured_at, is_manual)
│  • Max message JSON size 300000 chars; skips oversized captures
│  • Calls episodeWriters.writeAiContextEpisode({id, provider, messages, url, title})
│  • Broadcasts 'ai-context-captured' to renderer via mainWindow.webContents.send()
│
├─ src/main/ai/episodeWriters.ts writeAiContextEpisode() (line 145)
│  • Calls brain.logEpisode('external_ai', content, 'ai_context_capture:<id>')
│  • Calls brain.createExtractionJob(epId) — triggers LLM entity/fact extraction
│  • Calls brain.upsertEntity('ai_provider', providerName, aliases)
│  • Calls brain.addFact(entityId, 'has_conversation', ...)
│  • sourceRef format: 'ai_context_capture:<id>'
│
├─ src/main/ai/contextBrain.ts (21,339 chars)
│  • logEpisode(source, content, sourceRef, metadata) → writes context_episodes
│  • upsertEntity(type, name, aliases) → writes context_entities
│  • addFact(subjectId, predicate, objectLiteral, sourceEpisodeId) → writes context_facts
│  • createExtractionJob(episodeId) → async LLM extraction
│  • retrieve(query, strategies=['keyword','graph']) → retrieval router
│  • Entity groups: generateGroupId(), createGroup(), getGroups(), etc.
│
├─ src/main/ai/contextBrainMCP.ts (20,559 chars) — MCP server on port 54322
├─ src/main/ai/contextScheduler.ts — scheduled context compaction (30min interval)
├─ src/main/ai/userContextService.ts — user context signals by section
├─ src/main/ai/contextBackfill.ts — backfill historical context
├─ src/main/ai/contextFormatter.ts — format context for display
├─ src/services/providers/router.ts — buildChain(pState, role) routing
│  • buildChain(pState, 'goalAssistant') → enabled provider for goal extraction
│  • buildChain(pState, 'contentEngine') → enabled provider for content engine
├─ src/services/contentEngine/index.ts — registerContentEngineHandlers()
├─ src/services/AIService.ts — generateTopicDigest (default model: google/gemini-2.0-flash-001)
└─ src/main.ts IPC handlers: brain:search, brain:get-entity, brain:get-entity-history,
   brain:log-episode, brain:stats, brain:export, brain:get-episodes, brain:get-entities,
   brain:get-facts, brain:get-entity-related, brain:get-jobs, brain:retry-job, etc.
```

## 3. Key Data Structures

### DB Tables
```sql
-- Raw captures from browser extension
CREATE TABLE ai_context_captures (
    id INTEGER PRIMARY KEY,
    provider TEXT,           -- e.g. 'chatgpt', 'claude', 'perplexity'
    messages JSON,           -- [{role, content}]
    url TEXT,
    title TEXT,
    source TEXT,             -- 'fetch-intercept' | 'dom-grab' | 'manual'
    timestamp TEXT,
    dedup_key TEXT,          -- unique dedup key
    captured_at INTEGER,     -- Date.now()
    is_manual INTEGER DEFAULT 0,
    group_id INTEGER,
    pinned INTEGER DEFAULT 0,
    nickname TEXT,
    note TEXT,
    tags TEXT
);
CREATE INDEX idx_aic_provider ON ai_context_captures(provider);
CREATE INDEX idx_aic_captured ON ai_context_captures(captured_at DESC);
CREATE INDEX idx_aic_dedup ON ai_context_captures(dedup_key);
CREATE INDEX idx_aic_group ON ai_context_captures(group_id);

-- Processed episodes (written by writeAiContextEpisode)
CREATE TABLE context_episodes (...);
-- Queried by: source_ref LIKE 'ai_context_capture:<id>%'

-- Extracted entities and facts
CREATE TABLE context_entities (id, type, name, aliases);
CREATE TABLE context_facts (id, subject_id, predicate, object_id, object_literal, valid_from, valid_to, source_episode_id, confidence);
CREATE TABLE context_entity_facts (episode_id, fact_id);
CREATE TABLE context_extraction_jobs (id, episodeId, status, attempts);

-- AI interests / topics
CREATE TABLE ai_interests (id, topic TEXT UNIQUE, enabled INTEGER DEFAULT 1);

-- AI briefs (summaries)
CREATE TABLE ai_briefs (type, date, content, model_used);

-- Category configuration (in deskflow-categories.json)
-- appCategoryMap, domainCategoryMap, appTierMap, domainTierMap,
-- tierAssignments, detectedDomains, detectedApps,
-- domainKeywordRules, domainDefaultCategories, customCategories,
-- lockedApps, lockedDomains, aiChangeHistory
```

### categoryConfig Structure (main.ts line 1865)
```js
{
    version: 2,
    appCategoryMap: {},           // appName → category
    domainCategoryMap: {},        // domain → category
    appTierMap: {},               // appName → tier
    domainTierMap: {},            // domain → tier
    tierAssignments: { ...DEFAULT_TIER_ASSIGNMENTS },
    detectedDomains: {},          // domain → detection info
    detectedApps: {},             // appName → detection info
    domainKeywordRules: {},       // domain → [{category, keywords}]
    domainDefaultCategories: {},  // domain → default category
    customCategories: [],         // user-defined categories
    lockedApps: {},               // app → locked boolean
    lockedDomains: {},            // domain → locked boolean
    aiChangeHistory: []           // undo/redo history
}
```

### Provider Chain Routing (src/services/providers/router.ts)
- `buildChain(pState, 'goalAssistant')` → routes to whichever AI provider is enabled for goal extraction
- `buildChain(pState, 'contentEngine')` → routes to enabled provider for content engine tasks
- `runWithFallback(chain, prompt, systemPrompt, maxTokens?)` → executes the chain with fallback logic
- `DEFAULT_PROVIDERS` — apiKey stored securely; openrouter uses `getOpenRouterApiKey()`
- Supported providers: chatgpt, claude, perplexity, you, gemini, qwen, kimi, chatglm, huggingface, poe, character, deepseek

### Browser Extension Command Types (background.js poll handler)
```js
const COMMAND_TYPES = [
    'INSERT_INTO_CHAT',
    'CONTENT_ENGINE_INJECT',
    'LEARN_INJECT',
    'GOALS_INJECT',
    'FINANCE_INJECT',
    'RESUME_INJECT',
    'GENERAL_INJECT'
];
```

### Content Script Window Message Types
```js
const MSG = {
    DESKFLOW_AI_CONTEXT: 'DESKFLOW_AI_CONTEXT',       // AI context captured
    DESKFLOW_CE_RESPONSE: 'DESKFLOW_CE_RESPONSE',     // Content engine response
    DESKFLOW_GRAB_CHAT_RESPONSE: 'DESKFLOW_GRAB_CHAT_RESPONSE',
    DESKFLOW_INSERT_CONTEXT_RESPONSE: 'DESKFLOW_INSERT_CONTEXT_RESPONSE',
    DESKFLOW_INSERT_CONTEXT: 'DESKFLOW_INSERT_CONTEXT', // Inject into chat
    INJECT_PROMPT: 'INJECT_PROMPT',                    // Generic prompt injection
};
```

## 4. HTTP Endpoints (Electron app on port 54321)

### Existing Endpoints
| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/extension/poll` | Poll for commands | Returns pending extension commands |
| POST | `/ai-context` | ~main.ts:21204 | Accept AI context captures from extension |
| POST | `/browser-data` | handleBrowserData | Browser tracking data |
| POST | `/code-activity` | handleBrowserData | Code activity tracking |

### Missing Endpoints (to be added)
| Method | Path | Returns | Purpose |
|--------|------|---------|---------|
| GET | `/extension/chart-categories` | categoryMap + topics | Extension sees categories and topics |
| PATCH | `/extension/chart-categories` | Partial updates | Rename categories, assign domains |
| GET | `/extension/topics` | ai_interests rows | View topics |
| POST | `/extension/topics` | New topic | Add topic |
| POST | `/extension/topics/ai-suggest` | Suggested topics | AI generates topic names |
| POST | `/extension/ai-summarize` | Summary text | AI summarize current page |
| POST | `/extension/ai-chat` | AI response | Bidirectional AI chat |
| POST | `/extension/ai-research` | Research results | AI research via provider |

## 5. Broken Pieces — Detailed Analysis

### P1: `/ai-context` silently swallows errors
**Location:** `src/main.ts` lines 21204–21266
**Problem:** `episodeWriters.writeAiContextEpisode()` is wrapped in a bare `try {}` with no error logging. If the episode writer fails (DB schema missing, extraction crash), the capture lands in `ai_context_captures` but never enters the brain. No failure signal back to the extension.
**Fix:** Add proper error logging. Add a `status` field to the response indicating success/failure count. Return error details in the response when extraction fails.

### P2: No offline queue in the extension
**Location:** `browser-extension/background.js` lines 701–715
**Problem:** If `fetch(`${DESKFLOW_SERVER}/ai-context`)` fails (Electron app closed or `localhost:54321` unreachable), the buffer is restored via `aiContextBuffer.unshift(...batch)` but this is in-memory only. If the service worker is terminated before the next flush, captures are lost.
**Fix:** Persist the buffer to `chrome.storage.local` as a retry queue. On next service worker activation, check for pending retries and attempt to flush them before processing new captures.

### P3: Extension has zero visibility into provider→brain-section routing
**Location:** `src/services/providers/router.ts`, `src/main/ai/userContextService.ts`
**Problem:** The extension doesn't know which AI provider maps to which brain section. The mapping lives inside `buildChain(pState, 'goalAssistant')` and `buildChain(pState, 'contentEngine')` but there's no endpoint exposing it.
**Fix:** Add a new endpoint `/extension/provider-routing` that returns the current provider configuration for each role (`goalAssistant`, `contentEngine`, etc.) and the brain section mapping.

### P4: `ai_context_captures` → brain entities/facts pipeline unconfirmed
**Location:** `src/main/ai/episodeWriters.ts` line 145, `src/main/ai/contextBrain.ts` lines 25–550
**Problem:** `writeAiContextEpisode()` calls `brain.logEpisode()` and `brain.createExtractionJob()`, but the extraction job runs asynchronously via LLM extraction. There's no status endpoint to verify extraction completed, and no retry mechanism for failed extractions.
**Fix:** Add a `brain:extraction-status` query endpoint. Add retry logic for failed extraction jobs. Add a `/extension/episode-status` endpoint that returns extraction status for a given capture ID.

### P5: Categories and topics are internal-only
**Location:** `src/main.ts` lines 1865–1994 (categoryConfig), line 2285 (ai_interests)
**Problem:** `deskflow-categories.json` and the `ai_interests` table power topic suggestion and categorization, but nothing exposes them to the extension. The user cannot see or manage categories/topics from the extension UI.
**Fix:** Add GET/PATCH endpoints for categories and topics. Add a popup tab in the extension UI.

## 6. Proposed Features

### Feature 1: Chart/Category Management + AI Topic Awareness
- Extension sees all current categories (app, domain, tier assignments)
- User can rename categories, assign domains to categories, toggle topics on/off
- AI inspects the current brain context and suggests new topic names based on recent `context_episodes`
- Categories are synced bidirectionally between extension and main app

### Feature 2: AI Summarization + Bidirectional Chat Injection
- Extension sends a research prompt → DeskFlow calls the AI provider → response auto-inserts into the chat input on the current page
- AI summarizes current page topics and returns them to the extension overlay
- New command types: `AI_SUMMARIZE`, `AI_CHAT`, `AI_RESEARCH`

## 7. generate-prompt Skill Workflow (MANDATORY)

The `agent/skills/generate-prompt/` skill contains:
- `SKILL.md` — Full prompt generation workflow (531 lines)
- `CANVAS-REDESIGN-PROMPT.md` — Canvas redesign prompt template (178 lines)
- `claude-unifinishded-skill.md` — Claude-specific prompt generation (467 lines)

### Required Workflow Steps (per SKILL.md):
1. **Step 0 — Update state.md first** ✅ Done (created spoke file)
2. **Create CONTEXT_BUNDLE.md** (this file) — self-contained codebase reference
3. **Generate the prompt** referencing the context bundle
4. **Prompt must include:**
   - User's original request verbatim
   - Problem statement
   - Context bundle reference
   - Engineering Task: Data Processing Pipeline
   - Design Task: High-Fidelity Visual Specs
   - UX Task: Interaction Flow
   - Constraints
5. **Frontend-specific:** Include MCP inventory, anti-slop checklist, frontend design skills list
6. **Save prompt to** `agent/docs/generate-prompt-docs/<task-name>/prompt.md`
7. **Save RESULT.md** verbatim if generated

## 8. Key File Paths

| File | Purpose | Size |
|------|---------|------|
| `browser-extension/manifest.json` | Extension manifest (MV3, v1.3.0) | 2,728 chars |
| `browser-extension/ai-context-content.js` | Content script | 17,948 chars |
| `browser-extension/background.js` | Background service worker | 22,040 chars |
| `browser-extension/overlay.js` | Overlay logic | 29,131 chars |
| `browser-extension/popup.js` | Popup UI logic | 4,851 chars |
| `browser-extension/focusOverlay.js` | Focus overlay logic | 11,402 chars |
| `browser-extension/popup.html` | Popup HTML | — |
| `src/main.ts` | Electron main process (~25000+ chars) | — |
| `src/main/ai/contextBrain.ts` | Brain context orchestration | 21,339 chars |
| `src/main/ai/episodeWriters.ts` | Episode writers | 11,176 chars |
| `src/main/ai/contextBrainMCP.ts` | MCP integration | 20,559 chars |
| `src/main/ai/contextScheduler.ts` | Context scheduler | 5,004 chars |
| `src/main/ai/userContextService.ts` | User context service | 15,176 chars |
| `src/main/ai/contextBackfill.ts` | Context backfill | 8,586 chars |
| `src/main/ai/contextFormatter.ts` | Context formatter | 4,864 chars |
| `src/main/services/knowledge-store.ts` | Knowledge store | 7,820 chars |
| `src/services/providers/router.ts` | Provider routing (buildChain) | 1,800+ chars |
| `src/services/contentEngine/index.ts` | Content engine module registration | 6,417+ chars |
| `src/services/AIService.ts` | AI service (generateTopicDigest) | — |
| `src/preload.ts` | Preload script | 37,980 chars |
| `src/components/agentic/BrainStatusPanel.tsx` | Brain status panel UI | 7,179 chars |
| `src/components/agentic/ContextDashboard.tsx` | Context dashboard UI | 5,004 chars |
| `agent/skills/generate-prompt/SKILL.md` | generate-prompt skill workflow | 8,006 chars |
| `agent/skills/generate-prompt/CANVAS-REDESIGN-PROMPT.md` | Canvas redesign prompt template | 4,655 chars |
| `agent/skills/generate-prompt/claude-unifinishded-skill.md` | Claude prompt generation skill | 22,354 chars |
| `agent/state.md` | Multi-agent state hub | — |
| `agent/context.md` | Project context | — |

## 9. Design Tokens & Styling Reference

The project uses CSS custom properties (`--dk-*` tokens) defined in `src/components/ai/design-tokens.css`. Key tokens include:
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` — background colors
- `--accent-primary`, `--accent-secondary` — accent colors (pink #ec4899)
- `--text-primary`, `--text-secondary`, `--text-muted` — text colors
- `--border` — border color
- Glass effects: `bg-zinc-900/80 backdrop-blur-xl`
- Fonts: Geist (display), JetBrains Mono (code/data), Inter (body)
- Dark mode only — no light mode support needed
- 40px cell grid system for canvas

## 10. Constraints

1. **Keep all existing TypeScript types and interfaces unchanged**
2. **Keep all existing IPC handlers and data flow unchanged**
3. **Keep the `--dk-*` token naming convention**
4. **Keep the 40px cell grid system**
5. **Keep the `StateView` 4-state pattern**
6. **Don't add new npm dependencies**
7. **Preserve all existing CSS class names** referenced in TSX files
8. **Keep the canvas dark-mode only**
9. **Maintain the component file structure**
10. **No API keys, tokens, passwords, secrets, credentials** — use `[REDACTED]`
11. **Browser extension communicates with DeskFlow at `localhost:54321`**
12. **`agent/skills/generate-prompt/` skill must be used properly**

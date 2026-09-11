Below is the converged **RESULT.md** for the uploaded `PROMPT.md` / `CONTEXT_BUNDLE.md` pair: **DeskFlow External AI Context Capture System**.

---

# RESULT.md — DeskFlow External AI Context Capture System

**Target artifact path:**  
`agent/docs/backandfourth-docs/context-brain-system/RESULT.md`

## 1. Executive Summary

DeskFlow’s browser extension currently tracks website usage, but it does **not** capture the actual content of external AI conversations from web apps such as:

- ChatGPT
- Claude
- Perplexity
- You.com
- Gemini

This system adds a complete capture pipeline:

```text
External AI website
→ MAIN-world content script intercepts fetch responses
→ DOM observer fallback catches missed messages
→ content-script relay bridge
→ MV3 background service worker batches captures
→ HTTP POST to DeskFlow desktop app on localhost:54321/ai-context
→ SQLite persistence in ai_context_captures
→ IPC exposure to renderer
→ AI Context Viewer UI
→ Context Brain episode writer
→ entity extraction / signal generation
```

The result is that DeskFlow can see what the user discusses with external AIs, store that memory locally, show it inside the app, and feed it into the Context Brain and unified user profile.

---

## 2. Core Goals

### 2.1 Capture external AI conversations

Capture user/assistant messages from supported AI web services without requiring the user to copy/paste anything.

### 2.2 Insert captured conversations into DeskFlow

Captured conversations must be stored in the Electron app’s SQLite database and survive restarts.

### 2.3 Make captures visible in the app

Users must be able to:

- Browse captured conversations
- Filter by provider
- Search captures
- Expand full conversations
- Delete captures
- Clear captures per provider or globally
- See stats and topics

### 2.4 Feed captures into the Context Brain

Each capture should become a Context Brain episode.

From that episode, the system should derive:

- Entities
- Topics
- Facts
- Signals
- Interest patterns
- Tool usage patterns
- External AI usage patterns

### 2.5 Respect constraints

The implementation must respect:

- MV3 extension architecture
- MAIN-world fetch interception
- 280KB batch payload cap
- 4000-character per-message cap
- 20 captures per batch
- 5-second batching interval
- Flush on service worker suspend
- No system prompt capture
- Local-first storage

---

## 3. Target Architecture

```text
┌────────────────────────────────────────────────────────────┐
│ Browser: chatgpt.com / claude.ai / perplexity.ai / etc.    │
│                                                            │
│ ai-context-content.js                                      │
│ MAIN world                                                 │
│                                                            │
│ - patches window.fetch                                     │
│ - detects provider                                         │
│ - intercepts matching API responses                        │
│ - extracts messages                                        │
│ - normalizes messages                                      │
│ - deduplicates                                             │
│ - trims oversized content                                  │
│ - buffers captures                                         │
│ - DOM observer fallback                                    │
└──────────────────────┬─────────────────────────────────────┘
                       │ window.postMessage
                       ▼
┌────────────────────────────────────────────────────────────┐
│ focusOverlay.js                                            │
│ content-script world                                       │
│                                                            │
│ - listens for DESKFLOW_AI_CONTEXT messages                 │
│ - forwards to chrome.runtime.sendMessage                   │
└──────────────────────┬─────────────────────────────────────┘
                       │ chrome.runtime.sendMessage
                       ▼
┌────────────────────────────────────────────────────────────┐
│ background.js                                              │
│ MV3 service worker                                         │
│                                                            │
│ - receives AI_CONTEXT_CAPTURED                             │
│ - buffers captures                                         │
│ - deduplicates across tabs                                 │
│ - batches every 5 seconds                                  │
│ - max 20 captures per batch                                │
│ - max 280KB payload                                        │
│ - POSTs to http://localhost:54321/ai-context               │
│ - flushes on suspend                                       │
└──────────────────────┬─────────────────────────────────────┘
                       │ HTTP POST
                       ▼
┌────────────────────────────────────────────────────────────┐
│ DeskFlow Electron main process                             │
│                                                            │
│ POST /ai-context handler                                   │
│                                                            │
│ - validates payload                                        │
│ - trims oversized captures                                 │
│ - inserts into ai_context_captures                         │
│ - writes Context Brain episode                             │
│ - queues extraction job                                    │
│ - emits renderer event                                     │
└──────────────────────┬─────────────────────────────────────┘
                       │ SQLite + IPC
                       ▼
┌────────────────────────────────────────────────────────────┐
│ Renderer UI                                                │
│                                                            │
│ AI Context Viewer                                          │
│                                                            │
│ - provider list                                            │
│ - conversation cards                                       │
│ - full conversation drawer                                 │
│ - search/filter                                            │
│ - delete/clear                                             │
│ - stats dashboard                                          │
│ - Context Brain integration panel                          │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Supported Providers

| Provider | Badge Color | Hostnames | API Pattern | Message Format |
|---|---|---|---|---|
| ChatGPT | Green | `chatgpt.com`, `chat.openai.com` | `/backend-api/conversation` | `data.mapping.messages[].message.content.parts[]` or `data.messages[].content` |
| Claude | Orange | `claude.ai` | `/api/chat` | `data.messages[].content` string or text blocks |
| Perplexity | Blue | `perplexity.ai` | `/api/chat` | `data.messages[].content` or `data.thread.messages[].content` |
| You.com | Purple | `you.com` | `/api/chat` | Generic message array |
| Gemini | Red | `gemini.google.com` | `/_/BardChat` | Provider-specific format |

Provider names should be normalized to:

```text
chatgpt
claude
perplexity
you
gemini
unknown
```

---

## 5. Browser Extension Specification

## 5.1 Manifest Requirements

File:

```text
browser-extension/manifest.json
```

Must be MV3.

Required permissions:

```json
[
  "tabs",
  "webNavigation",
  "activeTab",
  "alarms",
  "storage",
  "scripting"
]
```

Recommended host permissions:

```json
[
  "http://localhost/*",
  "http://127.0.0.1/*"
]
```

Content scripts:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["focusOverlay.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://perplexity.ai/*",
        "https://you.com/*",
        "https://gemini.google.com/*"
      ],
      "js": ["ai-context-content.js"],
      "run_at": "document_start",
      "world": "MAIN"
    }
  ]
}
```

Important:

`world: "MAIN"` is required because the script must patch `window.fetch` in the page context.

After any extension update, the user must reload the extension from:

```text
chrome://extensions
```

---

## 5.2 MAIN-World Content Script

File:

```text
browser-extension/ai-context-content.js
```

This script runs inside the page context.

### Responsibilities

1. Detect provider from hostname.
2. Patch `window.fetch`.
3. Intercept matching API responses.
4. Clone responses so page behavior is not broken.
5. Parse JSON safely.
6. Extract messages using provider adapter.
7. Normalize messages into a common format.
8. Trim oversized message content.
9. Deduplicate repeated captures.
10. Buffer captures.
11. Flush buffer every 5 seconds.
12. Relay captures to content-script world using `window.postMessage`.
13. Run DOM observer fallback when fetch capture is unavailable.

---

## 5.3 Common Capture Shape

All providers must normalize into this shape:

```ts
interface CapturedMessage {
  role: "user" | "assistant" | "system" | "tool" | "unknown";
  content: string;
}

interface AiContextCapture {
  provider: "chatgpt" | "claude" | "perplexity" | "you" | "gemini" | "unknown";
  messages: CapturedMessage[];
  url?: string;
  title?: string;
  source?: "fetch-intercept" | "dom-observer";
  timestamp?: string;
  captureKey?: string;
}
```

---

## 5.4 Fetch Interception Strategy

The content script should preserve the original fetch:

```js
const originalFetch = window.fetch;
```

Then override:

```js
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  try {
    maybeCaptureResponse(args, response.clone());
  } catch (err) {
    // never break the host page
  }
  return response;
};
```

Rules:

- Only intercept requests matching provider API patterns.
- Prefer POST responses.
- Clone response before reading.
- Ignore non-JSON responses.
- Ignore failed responses.
- Ignore streaming deltas unless a final message can be reconstructed.
- Never throw into the page.
- Never block the original response.

---

## 5.5 Provider Adapters

Each provider should have an adapter:

```js
const PROVIDERS = {
  chatgpt: {
    hostnames: ["chatgpt.com", "chat.openai.com"],
    apiPattern: /\/backend-api\/conversation/,
    extract(data) {
      // return CapturedMessage[]
    }
  },

  claude: {
    hostnames: ["claude.ai"],
    apiPattern: /\/api\/chat/,
    extract(data) {
      // return CapturedMessage[]
    }
  },

  perplexity: {
    hostnames: ["perplexity.ai"],
    apiPattern: /\/api\/chat/,
    extract(data) {
      // return CapturedMessage[]
    }
  },

  you: {
    hostnames: ["you.com"],
    apiPattern: /\/api\/chat/,
    extract(data) {
      // return CapturedMessage[]
    }
  },

  gemini: {
    hostnames: ["gemini.google.com"],
    apiPattern: /\/_\/BardChat/,
    extract(data) {
      // return CapturedMessage[]
    }
  }
};
```

### ChatGPT Extraction Paths

Try in order:

```text
data.mapping.messages[].message.content.parts[]
data.messages[].content
data.message.content.parts[]
```

Role mapping:

```text
message.author.role === "user"
message.author.role === "assistant"
message.author.role === "system"
message.author.role === "tool"
```

### Claude Extraction Paths

Try:

```text
data.messages[].content
data.message.content
```

Content may be:

```text
string
```

or:

```text
[{ type: "text", text: "..." }]
```

### Perplexity Extraction Paths

Try:

```text
data.messages[].content
data.thread.messages[].content
```

### You.com Extraction Paths

Try generic:

```text
data.messages[]
data.thread.messages[]
data.response.messages[]
```

Role may be:

```text
role
author
sender
```

### Gemini Extraction

Gemini is the most fragile.

Use best-effort extraction from:

```text
/_/BardChat
```

Because Gemini responses may be encoded or streamed, DOM fallback is especially important.

---

## 5.6 DOM Observer Fallback

The DOM fallback should only be used when fetch interception does not produce captures.

### Purpose

Catch visible messages that bypass fetch interception or are delivered through streaming mechanisms.

### Observer Targets

Use provider-specific selectors where possible, plus generic fallbacks:

```text
[data-message-author-role]
[data-testid]
.prose
[class*="message"]
[class*="conversation"]
[class*="turn"]
```

### Rules

- Debounce mutations by 1000–2000ms.
- Extract only completed messages.
- Avoid capturing partial streaming text.
- Deduplicate against previously captured message hashes.
- Mark source as `dom-observer`.
- Keep DOM capture lower priority than fetch capture.

### DOM Capture Shape

Same normalized shape:

```json
{
  "provider": "chatgpt",
  "messages": [
    {
      "role": "user",
      "content": "..."
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ],
  "source": "dom-observer"
}
```

---

## 5.7 Deduplication

Deduplication should happen in two places:

1. Inside the content script
2. Inside the background service worker
3. Optionally inside the desktop app

### Content Script Deduplication

Generate a capture key from:

```text
provider
URL pathname
message count
first message content prefix
last message content prefix
```

Example:

```js
captureKey = `${provider}:${pathname}:${messageCount}:${hash(first + last)}`;
```

Keep recent keys in a `Set`.

### Background Deduplication

Keep a short-lived map:

```js
recentCaptureKeys = new Map();
```

Expire keys after 5–10 minutes.

This prevents duplicate captures from multiple tabs or repeated flushes.

---

## 5.8 Batching and Payload Limits

### Content Script Buffer

```text
Flush interval: 5 seconds
Max captures per batch: 20
Max payload size: 280KB
Max individual message content: 4000 chars
```

### Trimming Rules

For each message:

```text
if content.length > 4000:
  content = content.slice(0, 4000)
```

For each capture:

```text
if serialized capture is too large:
  reduce number of messages
  keep first user message and final assistant message where possible
```

For entire batch:

```text
if batch > 280KB:
  remove lowest-priority captures
  or split into smaller batches
```

Priority:

```text
1. fetch-intercept captures
2. captures with both user and assistant messages
3. larger conversations
4. dom-observer captures
```

---

## 5.9 Relay Bridge

File:

```text
browser-extension/focusOverlay.js
```

Add listener:

```js
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "DESKFLOW_AI_CONTEXT") return;

  try {
    chrome.runtime.sendMessage({
      type: "AI_CONTEXT_CAPTURED",
      captures: event.data.data
    });
  } catch (err) {
    // ignore relay errors
  }
});
```

This bridges:

```text
MAIN world
→ content-script world
→ background service worker
```

---

## 5.10 Background Service Worker

File:

```text
browser-extension/background.js
```

### Responsibilities

1. Receive `AI_CONTEXT_CAPTURED`.
2. Add captures to buffer.
3. Deduplicate by `captureKey`.
4. Flush every 5 seconds.
5. Send max 20 captures per batch.
6. Keep payload under 280KB.
7. POST to desktop app.
8. Retry on failure.
9. Flush on service worker suspend.

### Message Listener

```js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "AI_CONTEXT_CAPTURED" && Array.isArray(msg.captures)) {
    relayAiContext(msg.captures);
  }
});
```

### Buffer Flush

Recommended behavior:

```text
aiContextBuffer.push(...captures)

if flush timer already active:
  return

flushTimer = setTimeout(flushAiContext, 5000)
```

### Flush Function

```js
async function flushAiContext() {
  const batch = aiContextBuffer.splice(0, 20);

  if (!batch.length) return;

  try {
    await fetch("http://localhost:54321/ai-context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ captures: batch })
    });
  } catch (err) {
    // requeue batch for retry
  }
}
```

### Suspend Handling

```js
chrome.runtime.onSuspend.addListener(() => {
  flushAiContext();
});
```

Recommended extra safety:

- Use `chrome.alarms` to force periodic flush.
- Store failed batch in `chrome.storage.session` for retry.
- Avoid persisting sensitive captures to long-term extension storage unless necessary.

---

## 6. Desktop HTTP Endpoint

File:

```text
src/main.ts
```

Endpoint:

```text
POST /ai-context
```

Host:

```text
localhost:54321
```

This endpoint should be part of the existing browser tracking capture server.

---

## 6.1 Request Body

```json
{
  "captures": [
    {
      "provider": "chatgpt",
      "messages": [
        {
          "role": "user",
          "content": "Help me design a context system"
        },
        {
          "role": "assistant",
          "content": "We should model episodes, entities, and facts."
        }
      ],
      "url": "https://chatgpt.com/c/123",
      "title": "ChatGPT",
      "source": "fetch-intercept",
      "timestamp": "2026-07-24T10:00:00.000Z",
      "captureKey": "chatgpt:/c/123:2:abc123"
    }
  ]
}
```

---

## 6.2 Validation Rules

The server must:

1. Accept only `POST`.
2. Parse JSON safely.
3. Reject malformed bodies without crashing.
4. Validate that `captures` is an array.
5. Validate each capture has:
   - `provider`
   - `messages`
6. Normalize provider string.
7. Trim message content to 4000 characters.
8. Trim oversized payloads instead of rejecting them.
9. Limit total batch size.
10. Ignore captures with zero usable messages.
11. Optionally deduplicate by `captureKey`.

---

## 6.3 Oversized Payload Handling

Requirement:

> Oversized payloads are trimmed, not rejected.

Implementation:

```text
For each capture:
  trim each message content to 4000 chars

If capture still too large:
  keep first user message
  keep final assistant message
  drop middle messages
  mark source metadata as truncated

If batch still too large:
  split into smaller internal batches
```

Response should include:

```json
{
  "status": "ok",
  "accepted": 3,
  "rejected": 0,
  "truncated": 1
}
```

---

## 7. Database Schema

Use existing SQLite database:

```text
%APPDATA%/RHEO/deskflow-data.db
```

### Required Table

```sql
CREATE TABLE IF NOT EXISTS ai_context_captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  messages TEXT NOT NULL,
  url TEXT,
  title TEXT,
  source TEXT DEFAULT 'fetch-intercept',
  timestamp TEXT,
  captured_at INTEGER DEFAULT (unixepoch() * 1000)
);
```

Recommended additional column:

```sql
ALTER TABLE ai_context_captures
ADD COLUMN dedup_key TEXT;
```

Use guarded migration:

```text
Check PRAGMA table_info(ai_context_captures)
Add dedup_key only if missing
```

Recommended indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_aic_provider
ON ai_context_captures(provider);

CREATE INDEX IF NOT EXISTS idx_aic_captured
ON ai_context_captures(captured_at);

CREATE INDEX IF NOT EXISTS idx_aic_dedup
ON ai_context_captures(dedup_key);
```

### Stored Message Format

`messages` must be stored as JSON string:

```json
[
  {
    "role": "user",
    "content": "..."
  },
  {
    "role": "assistant",
    "content": "..."
  }
]
```

---

## 8. IPC Layer

All renderer access must go through existing IPC pattern:

```text
ipcMain.handle in main.ts
ipcRenderer.invoke in preload.ts
```

---

## 8.1 Existing Required IPC Channels

| Channel | Direction | Purpose |
|---|---|---|
| `ai-context:list` | renderer → main | List captures |
| `ai-context:stats` | renderer → main | Aggregate stats |
| `ai-context:delete` | renderer → main | Delete one capture |
| `ai-context:clear` | renderer → main | Clear all or per provider |

---

## 8.2 Recommended Extended List API

`ai-context:list` should support options:

```ts
interface AiContextListOptions {
  provider?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
```

Return shape:

```ts
{
  captures: Array<{
    id: number;
    provider: string;
    messages: string;
    url?: string;
    title?: string;
    source?: string;
    timestamp?: string;
    captured_at: number;
  }>;
  total: number;
}
```

Search should match:

- provider
- url
- title
- message content

For performance, search can be limited to `LIKE` queries with reasonable limits.

---

## 8.3 Stats API

`ai-context:stats` should return:

```ts
{
  total: number;
  byProvider: Record<string, number>;
  newestMs: number | null;
}
```

Recommended extended stats:

```ts
{
  total: number;
  byProvider: Record<string, number>;
  newestMs: number | null;
  capturesByDay: Array<{ date: string; count: number }>;
}
```

---

## 8.4 Brain Link API

Recommended new IPC channel:

```text
ai-context:get-brain-links
```

Purpose:

For a capture, return related Context Brain data.

Input:

```ts
{
  captureId: number;
}
```

Return:

```ts
{
  episodes: Array<{
    id: string;
    source: string;
    content: string;
    occurred_at: string;
    ingested_at: string;
  }>;
  entities: Array<{
    id: string;
    type: string;
    name: string;
  }>;
  facts: Array<{
    id: string;
    predicate: string;
    object_literal?: string;
    confidence?: number;
  }>;
  signals: Array<{
    id: string;
    signal_type: string;
    content: string;
    confidence: number;
  }>;
}
```

This supports the UI requirement:

> Show how captured conversations feed into the Context Brain.

---

## 8.5 Topics API

Recommended new IPC channel:

```text
ai-context:topics
```

Purpose:

Provide most discussed topics from entity extraction.

Return:

```ts
{
  topics: Array<{
    name: string;
    type: string;
    count: number;
    lastSeen: number;
  }>;
}
```

Source:

- Context Brain entities linked to `external_ai` episodes
- Facts derived from captured conversations
- Extracted signals where source is `external_ai`

---

## 9. Preload Bridge

File:

```text
src/preload.ts
```

Expose:

```ts
aiContextList: (opts?) => ipcRenderer.invoke('ai-context:list', opts || {}),
aiContextStats: () => ipcRenderer.invoke('ai-context:stats'),
aiContextDelete: (id) => ipcRenderer.invoke('ai-context:delete', id),
aiContextClear: (provider?) => ipcRenderer.invoke('ai-context:clear', provider),
onAiContextCaptured: (cb) => {
  ipcRenderer.on('ai-context-captured', (_e, data) => cb(data));
}
```

Recommended additions:

```ts
aiContextGetBrainLinks: (captureId) =>
  ipcRenderer.invoke('ai-context:get-brain-links', captureId),

aiContextTopics: () =>
  ipcRenderer.invoke('ai-context:topics')
```

---

## 10. Type Declarations

File:

```text
src/types/deskflow-api.d.ts
```

Add or verify:

```ts
aiContextList: (opts?: {
  provider?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) => Promise<{
  captures: Array<{
    id: number;
    provider: string;
    messages: string;
    url?: string;
    title?: string;
    source?: string;
    timestamp?: string;
    captured_at: number;
  }>;
  total: number;
}>;

aiContextStats: () => Promise<{
  total: number;
  byProvider: Record<string, number>;
  newestMs: number | null;
}>;

aiContextDelete: (id: number) => Promise<{ ok: boolean; error?: string }>;

aiContextClear: (provider?: string) => Promise<{ ok: boolean; error?: string }>;

onAiContextCaptured: (cb: (data: unknown) => void) => void;
```

Recommended additions:

```ts
aiContextGetBrainLinks: (captureId: number) => Promise<{
  episodes: Array<{
    id: string;
    source: string;
    content: string;
    occurred_at: string;
    ingested_at: string;
  }>;
  entities: Array<{
    id: string;
    type: string;
    name: string;
  }>;
  facts: Array<{
    id: string;
    predicate: string;
    object_literal?: string;
    confidence?: number;
  }>;
  signals: Array<{
    id: string;
    signal_type: string;
    content: string;
    confidence: number;
  }>;
}>;

aiContextTopics: () => Promise<{
  topics: Array<{
    name: string;
    type: string;
    count: number;
    lastSeen: number;
  }>;
}>;
```

---

## 11. Context Brain Integration

Each stored capture must become a Context Brain episode.

File:

```text
src/main/ai/episodeWriters.ts
```

Function:

```ts
writeAiContextEpisode(capture)
```

---

## 11.1 Episode Writer Behavior

Input:

```ts
{
  id?: number;
  provider: string;
  messages: Array<{ role: string; content: string }>;
  url?: string;
  title?: string;
  source?: string;
  timestamp?: string;
}
```

Steps:

1. Normalize provider.
2. Build short summary from messages.
3. Limit episode content to about 1500 characters.
4. Log episode with source `external_ai`.
5. Use stable `source_ref`.
6. Upsert provider entity.
7. Link provider entity to episode.
8. Create extraction job if content is long enough.
9. Return episode ID.

---

## 11.2 Source Reference

To link captures back to Context Brain episodes, use:

```text
ai_context_capture:<captureId>
```

Example:

```text
ai_context_capture:42
```

If capture ID is not available, fallback to:

```text
capture.url || provider
```

But capture ID is strongly preferred.

---

## 11.3 Episode Content Format

Example:

```text
External AI conversation on chatgpt.

URL: https://chatgpt.com/c/123
Title: ChatGPT
Messages: 8

user: Help me design a context system.
assistant: We should model episodes, entities, and facts.
user: How do we handle contradictions?
assistant: Use bitemporal facts and close old windows.
```

Content should be trimmed:

```text
episode content max: ~1500 chars
message preview max: ~200 chars per message
```

---

## 11.4 Entity Creation

Immediately create provider entity:

```ts
brain.upsertEntity("ai_provider", "ChatGPT", ["chatgpt", "openai"]);
```

Provider entity mapping:

| Provider | Entity Name | Aliases |
|---|---|---|
| chatgpt | ChatGPT | `chatgpt`, `openai` |
| claude | Claude | `claude`, `anthropic` |
| perplexity | Perplexity | `perplexity` |
| you | You.com | `you`, `you.com` |
| gemini | Gemini | `gemini`, `bard`, `google gemini` |

Add fact:

```text
provider entity discussed_in external AI conversation
```

or:

```text
capture episode has_provider ChatGPT
```

---

## 11.5 Extraction Job

If episode content is sufficiently rich, queue extraction:

```ts
if (episodeId && content.length >= 40) {
  brain.createExtractionJob(episodeId);
}
```

Extraction should derive:

- Topics
- Tools mentioned
- Projects mentioned
- User interests
- Problems discussed
- Desired outcomes
- Technical concepts
- Behavioral signals

Example extracted entities:

```text
project: DeskFlow
concept: Context Brain
concept: bitemporal facts
tool: Electron
tool: SQLite
interest: AI memory systems
```

Example extracted signals:

```text
interest: User frequently discusses AI context systems.
tool_usage: User uses ChatGPT for architecture discussions.
pattern: User asks external AIs about Electron IPC design.
```

---

## 11.6 Extraction Scheduler

File:

```text
src/main/ai/contextScheduler.ts
```

Recommended schedule:

```text
Process extraction jobs every 60 seconds.
```

If no LLM is configured:

- Use keyword extraction fallback
- Create basic topic entities
- Mark extraction source as `heuristic`

If LLM is configured:

- Use structured JSON extraction
- Create entities/facts/signals
- Link extraction back to episode ID

---

## 12. AI Context Viewer UI

The captured conversations must be viewable inside DeskFlow.

Recommended location:

```text
AI Assistant page → Context Captures tab
```

Route suggestion:

```text
/ai?tab=context
```

If AiPage does not support tabs, add a dedicated collapsible panel inside AiPage.

---

## 12.1 Main Layout

```text
┌────────────────────────────────────────────────────────────┐
│ AI Context Captures                                        │
│                                                            │
│ [Provider Filter] [Search] [Stats] [Clear]                 │
├──────────────────────┬─────────────────────────────────────┤
│ Provider sidebar     │ Conversation list                   │
│                      │                                     │
│ ChatGPT       12     │ ┌─────────────────────────────────┐ │
│ Claude         5     │ │ ChatGPT · 2h ago · 8 messages   │ │
│ Perplexity     2     │ │ Title / URL                     │ │
│ You.com        0     │ │ Expand / Delete                 │ │
│ Gemini         1     │ └─────────────────────────────────┘ │
│                      │                                     │
│ All           20     │ ┌─────────────────────────────────┐ │
│                      │ │ Claude · 5h ago · 3 messages    │ │
│                      │ └─────────────────────────────────┘ │
└──────────────────────┴─────────────────────────────────────┘
```

---

## 12.2 Provider List

Show providers with:

- Provider badge
- Provider name
- Capture count
- Active filter state

Provider badge colors:

```text
ChatGPT    = green
Claude     = orange
Perplexity = blue
You.com    = purple
Gemini     = red
Unknown    = zinc/neutral
```

Clicking a provider filters the conversation list.

---

## 12.3 Conversation Card

Each conversation card shows:

- Provider badge
- Relative timestamp
- Message count
- URL or title
- Source type:
  - fetch
  - dom
- Expand button
- Delete button
- Context Brain status:
  - episode created
  - extraction pending
  - entities extracted

Example:

```text
[ChatGPT] 2h ago · 8 messages
https://chatgpt.com/c/123
source: fetch-intercept
brain: episode + 4 entities
```

---

## 12.4 Conversation Drawer

Clicking a conversation opens a drawer or modal.

Display full conversation as message bubbles.

### Message Bubble Rules

```text
user messages:
  right-aligned
  bg-zinc-700
  text-zinc-100

assistant messages:
  left-aligned
  bg-zinc-800
  text-zinc-200

system/tool messages:
  centered or muted
  smaller text
  optional collapsed
```

If using DeskFlow theme tokens, equivalents are acceptable, but the visual hierarchy should remain:

```text
user = visually right and slightly lighter
assistant = visually left and darker
```

### Timestamp

Each conversation header uses:

```text
relative timestamp: "2h ago"
absolute tooltip: full local date/time
```

---

## 12.5 Search and Filters

Search should match:

- provider
- title
- URL
- message content

Filters:

```text
All
ChatGPT
Claude
Perplexity
You.com
Gemini
Unknown
```

Optional advanced filters:

```text
Today
Last 7 days
Last 30 days
Has Context Brain entities
Has extraction pending
```

---

## 12.6 Delete and Clear Actions

Each capture row should support:

```text
Delete capture
```

The toolbar should support:

```text
Clear all
Clear per provider
```

Use confirmation modal for destructive actions:

```text
Delete this AI capture?
This cannot be undone.
```

```text
Clear all ChatGPT captures?
This will remove 12 captures.
```

---

## 12.7 Empty State

Exact empty state copy:

```text
No AI conversations captured yet — visit ChatGPT, Claude, or Perplexity with the DeskFlow extension active
```

Secondary helper text:

```text
Make sure the DeskFlow browser extension is enabled and has been reloaded after the latest update.
```

---

## 13. Stats Dashboard

The UI should include a stats view.

Recommended placement:

```text
AI Context Captures → Stats tab
```

or collapsible dashboard above list.

---

## 13.1 Required Stats

### Total Captures by Provider

Example:

```text
ChatGPT    12
Claude      5
Perplexity  2
You.com     0
Gemini      1
```

Visual:

- Colored provider badges
- Horizontal bars
- Count labels

### Capture Timeline

Show captures per day.

Suggested range:

```text
Last 30 days
```

Visual:

- Bar chart
- Simple heatmap strip
- Or vertical timeline

### Most Discussed Topics

Derived from Context Brain entity extraction.

Example:

```text
Context Brain        8
Electron             6
SQLite               5
AI memory            4
Browser extension    3
```

If extraction has not run yet, show:

```text
Topics will appear after Context Brain extraction runs.
```

---

## 14. Context Brain Integration Display

Each capture should show how it feeds the Context Brain.

### Capture-Level Brain Panel

Inside the conversation drawer, add a tab:

```text
Conversation | Brain
```

Brain tab shows:

1. Episode

```text
Episode ID
Source: external_ai
Occurred at
Ingested at
```

2. Entities

```text
ChatGPT
DeskFlow
Context Brain
SQLite
```

3. Facts

```text
ChatGPT discussed_in external AI conversation
DeskFlow mentioned_in external AI conversation
```

4. Signals

```text
interest: User discusses AI context systems.
tool_usage: User uses ChatGPT for architecture design.
```

### States

```text
Episode created
Extraction pending
Extraction completed
No entities extracted yet
```

---

## 15. Real-Time Updates

When the desktop server receives captures:

1. Insert into DB.
2. Emit renderer event:

```text
ai-context-captured
```

3. Renderer refreshes:
   - list
   - stats
   - provider counts
   - active conversation drawer if relevant

Preload:

```ts
onAiContextCaptured: (cb) => {
  ipcRenderer.on('ai-context-captured', (_e, data) => cb(data));
}
```

UI should refresh automatically without requiring a page reload.

---

## 16. File-by-File Implementation Plan

## 16.1 Browser Extension Files

### `browser-extension/manifest.json`

Changes:

- Ensure MV3
- Add AI-domain content script with `world: "MAIN"`
- Add `scripting` permission if not present
- Add localhost host permissions if needed
- Bump version

---

### `browser-extension/ai-context-content.js`

New or updated file.

Responsibilities:

- Provider detection
- Fetch interception
- Response parsing
- Provider adapters
- Message normalization
- Content trimming
- Capture deduplication
- 5s batching
- DOM observer fallback
- `window.postMessage` relay

---

### `browser-extension/focusOverlay.js`

Changes:

- Add `message` listener
- Filter `DESKFLOW_AI_CONTEXT`
- Forward to background via `chrome.runtime.sendMessage`

---

### `browser-extension/background.js`

Changes:

- Handle `AI_CONTEXT_CAPTURED`
- Maintain capture buffer
- Deduplicate across tabs
- Batch every 5s
- Limit batch to 20 captures
- Limit payload to 280KB
- POST to `http://localhost:54321/ai-context`
- Retry failed POSTs
- Flush on `chrome.runtime.onSuspend`

---

## 16.2 Main Process Files

### `src/main.ts`

Changes:

- Create `ai_context_captures` table
- Add optional `dedup_key` migration
- Add indexes
- Add `POST /ai-context` endpoint inside existing capture server
- Validate and trim payloads
- Insert captures
- Call episode writer after insert
- Emit `ai-context-captured` event
- Register IPC handlers:
  - `ai-context:list`
  - `ai-context:stats`
  - `ai-context:delete`
  - `ai-context:clear`
  - optional:
    - `ai-context:get-brain-links`
    - `ai-context:topics`

---

### `src/main/ai/episodeWriters.ts`

Changes:

- Add or update `writeAiContextEpisode`
- Accept capture ID
- Use `source_ref = ai_context_capture:<id>`
- Build trimmed episode summary
- Upsert provider entity
- Create extraction job
- Link provider entity to episode

---

### `src/main/ai/contextBrain.ts`

Changes:

- Ensure `createExtractionJob` exists
- Add query helpers:
  - get episodes by source ref
  - get entities by episode
  - get facts by episode
  - get extraction status
- Support external AI episode source:

```text
external_ai
```

---

### `src/main/ai/contextScheduler.ts`

Changes:

- Process extraction jobs every 60 seconds
- Extract entities/facts/signals from external AI episodes
- Use LLM extraction if available
- Use heuristic fallback if not
- Project high-confidence signals into unified profile if profile system exists

---

## 16.3 Preload and Type Files

### `src/preload.ts`

Changes:

- Add `aiContextList`
- Add `aiContextStats`
- Add `aiContextDelete`
- Add `aiContextClear`
- Add `onAiContextCaptured`
- Optional:
  - `aiContextGetBrainLinks`
  - `aiContextTopics`

---

### `src/types/deskflow-api.d.ts`

Changes:

- Add type declarations for all AI context APIs
- Add capture object type
- Add stats type
- Add brain links type
- Add topics type

---

## 16.4 Renderer Files

### `src/pages/AiPage.tsx`

Changes:

- Add Context Captures tab or panel
- Support query param:

```text
/ai?tab=context
```

---

### `src/features/ai-context/AiContextPanel.tsx`

New file.

Main container.

Responsibilities:

- Fetch captures
- Fetch stats
- Listen for live capture events
- Manage provider filter
- Manage search
- Manage selected capture
- Render list and drawer

---

### `src/features/ai-context/AiContextProviderList.tsx`

New file.

Shows provider filters and counts.

---

### `src/features/ai-context/AiContextConversationList.tsx`

New file.

Shows capture cards.

---

### `src/features/ai-context/AiContextConversationCard.tsx`

New file.

Shows:

- provider badge
- timestamp
- message count
- title/url
- source
- brain status
- delete button

---

### `src/features/ai-context/AiContextConversationDrawer.tsx`

New file.

Shows full conversation.

Tabs:

```text
Conversation
Brain
```

---

### `src/features/ai-context/AiContextBrainPanel.tsx`

New file.

Shows:

- episode
- entities
- facts
- signals
- extraction state

---

### `src/features/ai-context/AiContextStats.tsx`

New file.

Shows:

- total captures
- captures by provider
- timeline
- top topics

---

### `src/hooks/useAiContextCaptures.ts`

New file.

Responsibilities:

- Load captures
- Search
- Filter
- Delete
- Clear
- Subscribe to live events

---

### `src/hooks/useAiContextStats.ts`

New file.

Responsibilities:

- Load stats
- Load topics
- Refresh after new capture

---

## 17. Backend Audit

| Feature | Status | Notes |
|---|---:|---|
| MAIN-world content script | ✅ Specified | Needs provider adapters |
| Fetch interception | ✅ Specified | Primary capture method |
| DOM observer fallback | ✅ Specified | Best-effort |
| MAIN → content-script relay | ✅ Specified | Via `window.postMessage` |
| Background batching | ✅ Specified | 5s / 20 captures / 280KB |
| Flush on suspend | ✅ Specified | Required |
| Desktop HTTP endpoint | ✅ Specified | `POST /ai-context` |
| `ai_context_captures` table | ✅ Specified | SQLite |
| Payload trimming | ✅ Specified | Do not reject oversized if trimmable |
| IPC list/stats/delete/clear | ✅ Specified | Existing pattern |
| Preload bridges | ✅ Specified | Existing pattern |
| Type declarations | ✅ Specified | `deskflow-api.d.ts` |
| Episode writer | ✅ Specified | `writeAiContextEpisode` |
| Context Brain episode creation | ✅ Specified | source `external_ai` |
| Extraction job creation | ✅ Specified | Requires scheduler |
| Entity extraction pipeline | ⚠️ Dependency | LLM or heuristic fallback |
| Brain links UI | 🔴 Must build | Requires IPC |
| Topics stats | 🔴 Must build | Requires extraction |
| AI Context Viewer UI | 🔴 Must build | Main frontend work |
| Capture deduplication | ⚠️ Recommended | `dedup_key` recommended |
| MCP exposure | Optional | Can expose captures later |

---

## 18. IPC Verification Matrix

| Feature | IPC Channel | Handler Required | Preload Required | DB Required | Status |
|---|---|---:|---:|---:|---|
| List captures | `ai-context:list` | ✅ Yes | ✅ Yes | ✅ `ai_context_captures` | Required |
| Capture stats | `ai-context:stats` | ✅ Yes | ✅ Yes | ✅ `ai_context_captures` | Required |
| Delete capture | `ai-context:delete` | ✅ Yes | ✅ Yes | ✅ `ai_context_captures` | Required |
| Clear captures | `ai-context:clear` | ✅ Yes | ✅ Yes | ✅ `ai_context_captures` | Required |
| Live capture event | `ai-context-captured` | Main → renderer | ✅ Yes | N/A | Required |
| Brain links | `ai-context:get-brain-links` | ✅ Recommended | ✅ Recommended | Context Brain tables | Recommended |
| Topics | `ai-context:topics` | ✅ Recommended | ✅ Recommended | Context Brain tables | Recommended |
| Context Brain search | `brain:search` | Existing | Existing | Context Brain tables | Real |
| Episode logging | `brain:log-episode` | Existing | Existing | `context_episodes` | Real |
| Brain stats | `brain:stats` | Existing | Existing | Context Brain tables | Real |

---

## 19. Constraints Compliance Checklist

| Constraint | Compliance |
|---|---|
| MV3 extension architecture | ✅ Uses service worker, no background page |
| `world: "MAIN"` for fetch interception | ✅ Required in manifest |
| Payload cap 280KB per batch | ✅ Enforced in content script/background |
| Individual message cap 4000 chars | ✅ Trimmed before relay and before DB insert |
| Max 20 captures per batch | ✅ Enforced |
| 5s batching interval | ✅ Enforced |
| Extension reload after update | ✅ Documented in UX |
| System prompts not captured | ✅ Acknowledged limitation |
| DOM selectors may break | ✅ Fetch interceptor is primary |
| Captures survive app restart | ✅ SQLite persistence |
| Oversized payloads trimmed, not rejected | ✅ Server trims before insert |
| Background flush on suspend | ✅ `chrome.runtime.onSuspend` |
| Existing DB used | ✅ Same SQLite DB |
| Existing IPC pattern used | ✅ `ipcMain.handle` / preload invoke |
| Context Brain integration | ✅ Episode writer + extraction job |

---

## 20. Requirement Checklist

| Requirement | Status |
|---|---|
| Content script intercepts fetch on supported AI domains | ✅ Specified |
| DOM observer fallback for non-API messages | ✅ Specified |
| MAIN world → content script world relay bridge | ✅ Specified |
| Background script batches + relays to `/ai-context` | ✅ Specified |
| HTTP endpoint stores in `ai_context_captures` table | ✅ Specified |
| IPC handlers for list/stats/delete/clear | ✅ Specified |
| Preload bridges + `deskflow-api.d.ts` types | ✅ Specified |
| Episode writer feeds Context Brain | ✅ Specified |
| Extension manifest updated with content scripts | ✅ Specified |
| User can reload extension to activate capture | ✅ Specified |
| Captures survive app restart | ✅ Specified |
| Oversized payloads are trimmed, not rejected | ✅ Specified |
| Background script flushes on service worker suspend | ✅ Specified |
| AI Context Viewer UI | ✅ Specified |
| Context Brain integration display | ✅ Specified |
| Stats dashboard | ✅ Specified |

---

## 21. Edge Cases

### 21.1 DeskFlow app is closed

The extension POST will fail.

Recommended handling:

- Keep batch in memory briefly
- Retry once or twice with backoff
- If still failing, drop batch
- Do not store sensitive conversation content long-term in extension storage unless user opts in

---

### 21.2 Service worker suspends before flush

Use:

```js
chrome.runtime.onSuspend.addListener(flushAiContext);
```

Also use periodic alarm flush.

---

### 21.3 Duplicate tabs

Deduplicate by:

```text
captureKey
provider
URL
message count
first/last message hash
```

---

### 21.4 Streaming responses

Do not capture every token delta.

Capture:

- final JSON response if available
- completed DOM messages as fallback

---

### 21.5 API shape changes

Provider adapters should fail safely.

If extraction fails:

- Do not crash page
- Do not block fetch
- Optionally capture DOM fallback

---

### 21.6 Very large conversation

Trim:

```text
message content: 4000 chars
episode preview: 1500 chars
capture batch: 280KB
```

Keep:

```text
first user message
final assistant message
```

Drop middle content if necessary.

---

### 21.7 Sensitive content

Captures may contain sensitive data.

UI should provide:

- delete individual capture
- clear provider
- clear all
- local-only storage notice

---

## 22. Known Limitations

### System prompts are not capturable

System prompts are usually server-side and not exposed in the page or API response.

Therefore:

```text
System prompts are NOT captured.
```

### Only post-install conversations

The extension cannot capture conversations that happened before it was installed.

### DOM selectors are fragile

AI services frequently change class names and markup.

Fetch interception is primary because API endpoints tend to be more stable than DOM structure.

### Gemini support is best-effort

Gemini may use non-standard response formats.

DOM fallback may be required.

### Multi-tab duplication

Deduplication reduces duplicates but may not eliminate every possible duplicate.

### Streaming partial responses

Partial streaming tokens are not captured.

Only completed messages or final responses should be captured.

---

## 23. Acceptance Criteria

The feature is complete when:

### Extension

- [ ] Extension loads without errors
- [ ] MAIN-world content script runs on supported AI domains
- [ ] Fetch interception captures ChatGPT conversations
- [ ] Fetch interception captures Claude conversations
- [ ] Fetch interception captures Perplexity conversations
- [ ] You.com capture works or degrades gracefully
- [ ] Gemini capture works best-effort
- [ ] DOM fallback captures visible messages when fetch fails
- [ ] Captures are batched every 5 seconds
- [ ] Max 20 captures per batch is enforced
- [ ] 280KB payload cap is enforced
- [ ] Message content is capped at 4000 chars
- [ ] Background worker flushes on suspend
- [ ] Extension reload activates new capture logic

### Desktop App

- [ ] `POST /ai-context` accepts valid captures
- [ ] Invalid payloads do not crash the app
- [ ] Oversized payloads are trimmed
- [ ] Captures are stored in SQLite
- [ ] Captures survive app restart
- [ ] Renderer receives `ai-context-captured`
- [ ] IPC list returns captures
- [ ] IPC stats returns provider counts
- [ ] IPC delete removes one capture
- [ ] IPC clear removes all or per provider

### Context Brain

- [ ] Each stored capture creates an episode
- [ ] Episode source is `external_ai`
- [ ] Provider entity is created
- [ ] Episode is linked to capture source ref
- [ ] Extraction job is created when content is sufficient
- [ ] Extracted entities appear in brain UI or graph
- [ ] Derived topics appear in stats when extraction is available

### UI

- [ ] AI Context panel is accessible
- [ ] Captures are grouped by provider
- [ ] Provider badges use correct colors
- [ ] Conversation cards show timestamp, message count, title/url
- [ ] Conversation drawer shows full messages
- [ ] User messages are right-aligned
- [ ] Assistant messages are left-aligned
- [ ] Relative timestamps show absolute tooltip
- [ ] Provider filter works
- [ ] Search works
- [ ] Delete capture works
- [ ] Clear provider works
- [ ] Clear all works
- [ ] Empty state shows required copy
- [ ] Stats dashboard shows totals by provider
- [ ] Stats dashboard shows capture timeline
- [ ] Stats dashboard shows topics when extraction exists
- [ ] Brain integration panel shows episodes/entities/signals

---

## 24. Final Implementation Summary

Build the system as a five-stage pipeline:

```text
1. Browser capture
   MAIN-world fetch interception + DOM fallback

2. Relay
   MAIN world → focusOverlay → background service worker

3. Desktop ingestion
   POST /ai-context → SQLite ai_context_captures

4. App exposure
   IPC + preload + AI Context Viewer UI

5. Memory integration
   episode writer → Context Brain → extraction → signals/profile
```

The most important architectural rule:

> The browser extension captures normalized conversation evidence.  
> The desktop app stores it locally and turns it into Context Brain episodes.  
> The Context Brain turns episodes into entities, facts, and signals.  
> The UI lets the user inspect and delete that memory.
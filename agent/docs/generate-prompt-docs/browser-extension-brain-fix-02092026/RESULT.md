# RESULT — DeskFlow Browser Extension → Brain Orchestration Fix
**Task:** browser-extension-brain-fix-02092026
**Source of truth:** `CONTEXT_BUNDLE.md` (do not contradict its data structures)

---

## 1. Summary

The fix treats the extension→brain pipeline as five sequential trust boundaries — capture, transport, processing, retrieval, and visibility — and closes each one instead of patching symptoms. `/ai-context` gets real status reporting so failures are never silent; the extension gets a persistent `chrome.storage.local` retry queue so the service worker's ephemeral lifecycle can't lose captures; and three new read endpoints (`provider-routing`, `episode-status`, `chart-categories`/`topics`) give the extension visibility into brain-side state it currently has none of. On top of that foundation, Chart/Category Management and AI Summarization/Chat are built as thin extension surfaces over existing brain primitives (`buildChain`, `context_episodes`, `ai_interests`) rather than new subsystems — no new npm dependencies, no schema rewrites, only additive columns and endpoints. The design leans on Raycast-style command-panel density for the popup and keeps the pink `--accent-primary` reserved for one thing only: "this is live/AI-touched," so users can tell orchestration status apart from static config at a glance.

---

## 2. Backend Specification

### 2.1 Fix P1 — `/ai-context` error handling & status reporting

**File:** `src/main.ts` (~line 21204)

**Migration (additive, non-breaking):**
```sql
ALTER TABLE ai_context_captures ADD COLUMN episode_status TEXT DEFAULT 'pending';
  -- 'pending' | 'episode_written' | 'extraction_failed' | 'write_failed'
ALTER TABLE ai_context_captures ADD COLUMN error_message TEXT;
```

**Handler change** — replace the bare `try {}` around `writeAiContextEpisode()` with per-capture try/catch inside the existing loop over `payload.captures[]`, so one bad capture can't blank out the whole batch:

```ts
const results: Array<{ dedup_key: string; status: 'ok' | 'error'; episodeId?: string; error?: string }> = [];

for (const capture of payload.captures) {
  try {
    const id = insertCapture(capture); // existing INSERT OR IGNORE
    const episode = await episodeWriters.writeAiContextEpisode({
      id, provider: capture.provider, messages: capture.messages,
      url: capture.url, title: capture.title,
    });
    db.run(`UPDATE ai_context_captures SET episode_status = 'episode_written' WHERE id = ?`, id);
    results.push({ dedup_key: capture.dedup_key, status: 'ok', episodeId: episode.id });
  } catch (err) {
    logger.error('[ai-context] episode write failed', { dedup_key: capture.dedup_key, err });
    db.run(
      `UPDATE ai_context_captures SET episode_status = 'write_failed', error_message = ? WHERE dedup_key = ?`,
      String(err), capture.dedup_key
    );
    results.push({ dedup_key: capture.dedup_key, status: 'error', error: String(err) });
  }
}

res.json({ received: payload.captures.length, ok: results.filter(r => r.status === 'ok').length,
           failed: results.filter(r => r.status === 'error').length, results });
```

**Response shape (new):**
```json
{ "received": 3, "ok": 2, "failed": 1,
  "results": [
    { "dedup_key": "abc123", "status": "ok", "episodeId": "ep_9f2" },
    { "dedup_key": "def456", "status": "error", "error": "brain.upsertEntity: constraint failed" }
  ] }
```
The extension already reads the `/ai-context` response in `flushAiContext()` — it currently discards it. Change it to inspect `results[]` and only re-queue (2.2) the captures that came back `status: 'error'`, not the whole batch.

### 2.2 Fix P2 — Persistent offline queue in the extension

**File:** `browser-extension/background.js` (~line 701–715)

Replace the in-memory `aiContextBuffer.unshift(...batch)` fallback with a `chrome.storage.local`-backed queue. This survives service-worker termination, which the in-memory buffer cannot.

```js
const RETRY_QUEUE_KEY = 'deskflow_retry_queue';
const MAX_RETRY_ATTEMPTS = 8;

async function enqueueRetry(batch) {
  const { [RETRY_QUEUE_KEY]: existing = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);
  const entry = { batch, attempts: 0, firstFailedAt: Date.now(), lastAttemptAt: Date.now() };
  await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: [...existing, entry] });
}

async function drainRetryQueue() {
  const { [RETRY_QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);
  if (!queue.length) return;
  const remaining = [];
  for (const entry of queue) {
    if (entry.attempts >= MAX_RETRY_ATTEMPTS) continue; // drop after max attempts, logged separately
    try {
      const res = await fetch(`${DESKFLOW_SERVER}/ai-context`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captures: entry.batch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const stillFailing = entry.batch.filter(c =>
        body.results?.find(r => r.dedup_key === c.dedup_key)?.status === 'error');
      if (stillFailing.length) {
        remaining.push({ ...entry, batch: stillFailing, attempts: entry.attempts + 1, lastAttemptAt: Date.now() });
      }
    } catch {
      remaining.push({ ...entry, attempts: entry.attempts + 1, lastAttemptAt: Date.now() });
    }
  }
  await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: remaining });
}
```

Call `drainRetryQueue()` at the top of the existing `chrome.alarms` poll handler (the same one driving the 2s `/extension/poll` cycle — reuse it rather than adding a second alarm, per "no new dependencies / minimal surface" constraint) **before** processing new captures, and also on `chrome.runtime.onStartup`. On `chrome.runtime.onSuspend`, push whatever's left in `aiContextBuffer` into `enqueueRetry()` instead of relying on the in-memory flush alone.

### 2.3 Fix P3 — `/extension/provider-routing`

**New file or addition to `src/main.ts`.** Read-only, reflects what `buildChain()` would resolve to right now — do not duplicate routing logic, call the same resolver `router.ts` already exposes.

```
GET /extension/provider-routing
```
```json
{
  "roles": {
    "goalAssistant":  { "provider": "claude",  "model": "claude-sonnet-4-6", "brainSection": "goals" },
    "contentEngine":  { "provider": "openrouter/gemini", "model": "google/gemini-2.0-flash-001", "brainSection": "content" },
    "financeAssistant": { "provider": "chatgpt", "model": "gpt-4o-mini", "brainSection": "finance" }
  },
  "fallbackChainLength": { "goalAssistant": 2, "contentEngine": 1 }
}
```
Implementation: call `buildChain(pState, role)` for each known role and read the head of the returned chain (`chain[0].provider`, `chain[0].model`) plus `chain.length` for fallback depth — do not execute the chain, just introspect it. `brainSection` is a static lookup table (role → section) since that mapping doesn't currently live anywhere retrievable; add it as a small const map co-located with `router.ts`.

### 2.4 Fix P4 — `/extension/episode-status` + extraction retry

**Endpoint:**
```
GET /extension/episode-status?captureId=123
```
```json
{
  "captureId": 123,
  "episodeStatus": "episode_written",
  "extraction": { "jobId": "job_44", "status": "completed", "attempts": 1,
                   "entitiesCreated": 3, "factsCreated": 7 },
  "error": null
}
```
Joins `ai_context_captures.episode_status` → `context_episodes` (via `source_ref = 'ai_context_capture:<id>'`) → `context_extraction_jobs` (via `episodeId`). If no extraction job row exists yet (still queued), return `"extraction": { "status": "queued" }`.

**Retry mechanism** — add to `contextBrain.ts`:
```ts
async function retryFailedExtractions(maxAge = 24 * 60 * 60 * 1000) {
  const failed = db.query(
    `SELECT * FROM context_extraction_jobs WHERE status = 'failed' AND attempts < 3
     AND createdAt > ?`, Date.now() - maxAge);
  for (const job of failed) {
    await createExtractionJob(job.episodeId); // existing function, re-triggers the async LLM extraction
  }
}
```
Wire this into `contextScheduler.ts`'s existing 30-minute compaction interval rather than adding a new timer — one extra query per cycle. This directly reuses `brain:retry-job` IPC handler logic that already exists per the context bundle's IPC list, so the retry endpoint for the extension (`POST /extension/episode-status/:captureId/retry`) can just resolve the job id and call that same internal function.

### 2.5 Fix P5 — Category & topic visibility

```
GET   /extension/chart-categories
PATCH /extension/chart-categories
GET   /extension/topics
POST  /extension/topics
POST  /extension/topics/ai-suggest
```

**GET `/extension/chart-categories`** — returns a *read projection* of `deskflow-categories.json`, not the raw file (avoids leaking internal-only fields like `aiChangeHistory`):
```json
{
  "categories": [
    { "id": "work", "label": "Work", "color": "#ec4899", "domains": ["github.com","linear.app"], "apps": ["VS Code"], "locked": false },
    { "id": "research", "label": "Research", "color": "#8b5cf6", "domains": ["arxiv.org"], "apps": [], "locked": false }
  ],
  "customCategoriesOnly": true
}
```

**PATCH `/extension/chart-categories`** — partial update, same shape as one category object plus an `id`:
```json
{ "id": "work", "label": "Deep Work", "addDomains": ["notion.so"], "removeDomains": [] }
```
Server merges into `categoryConfig.customCategories` / `domainCategoryMap`, writes `deskflow-categories.json`, appends one entry to the existing `aiChangeHistory` array (for undo/redo — constraint #2 says don't touch existing IPC/data flow, and undo/redo already runs off that array, so extension edits ride the same history mechanism the desktop UI uses).

**GET `/extension/topics`** → rows from `ai_interests` (`id, topic, enabled`).
**POST `/extension/topics`** → `{ "topic": "quantum computing" }` → inserts, `UNIQUE(topic)` constraint already prevents dupes.

**POST `/extension/topics/ai-suggest`**:
```json
// request
{ "lookbackDays": 7 }
// response
{ "suggested": [
    { "topic": "Rust async runtimes", "basedOnEpisodes": 4, "confidence": 0.81 },
    { "topic": "SQLite bitemporal modeling", "basedOnEpisodes": 2, "confidence": 0.63 }
] }
```
Implementation: pull the last N `context_episodes` (source `external_ai`), pass their content to `buildChain(pState, 'contentEngine')` with a prompt asking for topic labels not already present in `ai_interests`, parse JSON response. This is the same code path `AIService.generateTopicDigest` already uses — reuse it, don't fork it.

### 2.6 New feature endpoints

```
POST /extension/ai-summarize   { url, title, pageText }        → { summary, topics: string[] }
POST /extension/ai-chat        { message, conversationId? }    → { reply, conversationId }
POST /extension/ai-research    { prompt, targetProvider? }     → { result, sourcesUsed?: string[] }
```
All three route through `buildChain(pState, 'contentEngine')` + `runWithFallback()` — same pattern as `router.ts` already implements elsewhere, so no new provider-selection logic is needed. `ai-chat` persists turns to a lightweight `extension_chat_sessions` table (`id, messages JSON, createdAt, updatedAt`) so the popup's chat history survives a popup close/reopen — this is the one genuinely new table in the whole spec; everything else is additive columns on existing tables.

Error handling for all three: on provider failure, `runWithFallback` already walks the chain — if every provider in the chain fails, return `503 { "error": "all_providers_unavailable", "chain": [...] }` so the popup can show *which* providers were tried, not a generic failure.

---

## 3. Frontend Specification

### 3.1 Popup UI redesign

Four tabs, Raycast-style top tab bar (not a sidebar — popup width is too narrow):

```
┌─────────────────────────────────────┐
│  ● Capture   Topics   AI Chat  Status│  ← .dk-ext-tabbar
├─────────────────────────────────────┤
│                                       │
│         [ active tab content ]       │
│                                       │
└─────────────────────────────────────┘
```
- **Capture tab** (default) — live list of the last ~10 captures for the current tab's provider, each row shows provider icon, truncated title, and an `episode_status` dot (green=written, amber=pending, red=failed — click to see `error_message`).
- **Topics & Categories tab** — see 3.2.
- **AI Chat tab** — see 3.3.
- **Status tab** — brain sync summary: pending extraction jobs count, last successful flush timestamp, offline-queue length (from `chrome.storage.local`, read directly, no round trip needed), and a manual "flush now" button that calls `drainRetryQueue()` immediately.

### 3.2 Category management UI

```
Topics & Categories
┌───────────────────────────────────┐
│ Categories                    [+]  │
│ ● Work           3 domains  [Edit] │
│ ● Research       1 domain   [Edit] │
├───────────────────────────────────┤
│ Topics                    [AI ✨] │
│ ⬤ quantum computing         [off] │
│ ⬤ SQLite internals          [on]  │
└───────────────────────────────────┘
```
- Category rows expand inline on `[Edit]` into a domain-chip editor (add/remove chips, rename inline) — no modal, keeps popup height stable.
- `[AI ✨]` button calls `POST /extension/topics/ai-suggest`; results appear as dashed-border "suggested" chips above the confirmed list with individual Accept/Dismiss — never auto-added, matching the "AI suggests, user approves" flow from the UX task.
- Locked categories/domains (`locked: true` from the categoryConfig) render with a lock glyph and are not editable from the extension — respects constraint #1 (don't fork the source of truth for what's editable).

### 3.3 AI Chat panel

Standard chat layout: scrollable message list (`.dk-ext-chat-bubble--user` right-aligned, `.dk-ext-chat-bubble--ai` left-aligned), single-line input pinned to bottom, send button. Below the input, one secondary action: **"Insert reply into page"** — visible only when the active tab is a known AI provider domain (from the same 14-domain list `ai-context-content.js` already matches against). Clicking it does *not* re-call the AI; it takes the last `ai-chat` reply already in state and dispatches the injection described in 3.4.

### 3.4 Content-script injection points

New poll command types, added to the existing `COMMAND_TYPES` array in `background.js` alongside `INSERT_INTO_CHAT` etc.:
```js
const COMMAND_TYPES = [
  'INSERT_INTO_CHAT', 'CONTENT_ENGINE_INJECT', 'LEARN_INJECT', 'GOALS_INJECT',
  'FINANCE_INJECT', 'RESUME_INJECT', 'GENERAL_INJECT',
  'AI_SUMMARY_INJECT', 'AI_CHAT_RESPONSE', 'AI_RESEARCH_RESULT', // new
];
```
And corresponding window-message types alongside the existing `MSG` map:
```js
DESKFLOW_AI_SUMMARY_READY: 'DESKFLOW_AI_SUMMARY_READY',
DESKFLOW_AI_CHAT_INSERT:   'DESKFLOW_AI_CHAT_INSERT',
```
Flow for "Insert reply into page": popup → `background.js` stores the pending text in the *existing* `window.__deskflowPending` mechanism (already used by `DESKFLOW_INSERT_CONTEXT`/`INJECT_PROMPT` per the context bundle) → content script's existing `postMessage` listener picks it up and fills the page's chat input using the same DOM-insertion routine `INSERT_INTO_CHAT` already uses. **No new DOM-insertion code path** — `AI_CHAT_RESPONSE` reuses the existing `INSERT_INTO_CHAT` insertion function, it's only a new *source* of text, not a new *mechanism*. This directly satisfies constraint #2 (keep existing IPC/data flow unchanged).

`AI_SUMMARIZE`: content script extracts `document.body.innerText` (bounded, e.g. first 20k chars) on demand when the user opens the "Capture" tab or clicks a manual "Summarize this page" button — not on every page load, to avoid the always-on scraping the user hasn't asked for.

### 3.5 Chart export (flagged as follow-up phase per MVP scope constraint #13)

Spec only, not built this pass: overlay's existing chart DOM (`ContextDashboard.tsx` / `BrainStatusPanel.tsx` visuals) would need a `data-dk-export` attribute on chart containers so a future content script can read structured values rather than parsing pixels. Backend side would reuse `/extension/ai-research`'s provider chain to turn extracted series data into a written analysis. Deferred entirely — no endpoint added this phase.

---

## 4. Data Flow Diagrams

### 4.1 Capture flow (fixed)
```
[AI site]
   │ fetch/DOM capture
   ▼
ai-context-content.js ──buffer(5s)──▶ background.js
                                          │ POST /ai-context
                                          ▼
                                   src/main.ts handler
                                    │ per-capture try/catch (2.1)
                                    ├─ ok ──▶ episodeWriters.writeAiContextEpisode()
                                    │            │
                                    │            ▼
                                    │      context_episodes + createExtractionJob()
                                    │            │
                                    │            ▼ (async, LLM)
                                    │      context_entities / context_facts
                                    │
                                    └─ error ──▶ episode_status='write_failed'
                                                     │
                                                     ▼ (response.results[].status='error')
                                          background.js → enqueueRetry() (2.2)
                                                     │
                                                     ▼ (drained on next poll cycle)
                                              retried against /ai-context
```

### 4.2 Category management flow
```
popup (Topics & Categories tab)
   │ GET /extension/chart-categories, GET /extension/topics
   ▼
main app categoryConfig / ai_interests  ──render──▶ popup
   │
   │ user renames category / toggles topic
   ▼
PATCH /extension/chart-categories  or  POST /extension/topics
   │
   ▼
deskflow-categories.json written + aiChangeHistory entry appended
   │
   ▼
mainWindow.webContents.send() broadcasts change ──▶ desktop UI updates live
```

### 4.3 AI chat / bidirectional injection flow
```
popup AI Chat tab                              active AI-site tab
   │ POST /extension/ai-chat {message}
   ▼
buildChain(pState,'contentEngine') → runWithFallback()
   │
   ▼
extension_chat_sessions row updated, reply returned to popup
   │
   │ user clicks "Insert reply into page"
   ▼
background.js: window.__deskflowPending = reply   (poll: AI_CHAT_RESPONSE)
   │
   ▼ (2s poll cycle picks it up on the active-tab content script)
content script: existing INSERT_INTO_CHAT DOM routine fills + triggers send
```

### 4.4 Extraction status flow
```
popup Status tab / Capture row click
   │ GET /extension/episode-status?captureId=N
   ▼
ai_context_captures.episode_status ──▶ context_episodes (source_ref match) ──▶ context_extraction_jobs
   │
   └─ status='failed', attempts<3 → contextScheduler's 30-min cycle calls retryFailedExtractions()
```

---

## 5. Complete Prompt for the Implementation AI

```
You are implementing the DeskFlow browser-extension → brain-orchestration fix.
Read CONTEXT_BUNDLE.md and this RESULT.md fully before writing any code — they
are the source of truth for data structures, file locations, and API shapes.
Do not invent alternate schemas, endpoint names, or field names.

SCOPE (this phase only):
1. Backend: sections 2.1–2.6 of RESULT.md, in that order (2.1 and 2.2 are
   correctness fixes and must land before anything else — every later
   endpoint assumes captures are reliably reaching context_episodes).
2. Frontend: sections 3.1–3.4 of RESULT.md. Section 3.5 (chart export) is
   explicitly OUT of scope this phase — spec it in a comment, do not build it.
3. Follow every constraint in CONTEXT_BUNDLE.md section 10 without exception,
   in particular: no new npm dependencies, no changes to existing TypeScript
   interfaces/IPC handlers, --dk-* token naming preserved, 40px grid
   preserved, dark-mode only, [REDACTED] for any secret-shaped string.

ORDER OF OPERATIONS:
  a. Migration: add episode_status/error_message columns (2.1) and the new
     extension_chat_sessions table (2.6). Additive only — no ALTER that
     drops or renames existing columns.
  b. src/main.ts: rewrite the /ai-context handler per 2.1's per-capture
     try/catch. Verify existing callers of this endpoint still get a 200
     with the old fields present (received/ok/failed are additive, don't
     remove any field the extension currently reads).
  c. browser-extension/background.js: add the chrome.storage.local retry
     queue (2.2) and wire drainRetryQueue() into the existing poll alarm —
     do not add a second chrome.alarms registration.
  d. Add the five new GET/PATCH/POST endpoint groups from 2.3–2.6, each
     reusing existing internal functions (buildChain, createExtractionJob,
     categoryConfig writer) rather than reimplementing their logic.
  e. Frontend: popup tab bar (3.1), category editor (3.2), AI chat panel
     (3.3), and the two new poll command types + message types (3.4) —
     reusing the EXISTING INSERT_INTO_CHAT DOM-insertion function for
     AI_CHAT_RESPONSE, not a new one.

VERIFICATION before calling this done:
  - A capture that triggers an episode-writer error must show up in the
    popup's Capture tab with a red status dot and a readable error, not
    silently vanish.
  - Killing the Electron app mid-flush, then restarting it, must not lose
    captures — the retry queue must survive a service-worker restart
    (test via chrome://serviceworker-internals or manual SW termination).
  - /extension/chart-categories PATCH must show up in the desktop app's
    own category UI without a restart (existing webContents.send broadcast).

Return: a summary of files changed, and flag anywhere you had to deviate
from RESULT.md's shapes and why.
```

---

## 6. New CSS Classes / Tokens

| Class / token | Purpose |
|---|---|
| `.dk-ext-tabbar` | Popup's 4-tab horizontal nav, sticky top |
| `.dk-ext-tab` / `.dk-ext-tab--active` | Individual tab trigger; active uses `--accent-primary` underline |
| `.dk-ext-status-dot--ok` / `--pending` / `--error` | 6px dot on capture rows, green/amber/red mapped to existing semantic colors if defined, else `--accent-primary`/`#f59e0b`/`#ef4444` |
| `.dk-ext-category-row` | Collapsed category list item |
| `.dk-ext-category-row--editing` | Expanded inline editor state |
| `.dk-ext-domain-chip` | Removable chip inside category editor |
| `.dk-ext-topic-chip` | Confirmed topic toggle pill |
| `.dk-ext-topic-chip--suggested` | Dashed-border variant for unapproved AI suggestions |
| `.dk-ext-chat-panel` | Chat tab container, flex column, `bg-zinc-900/80 backdrop-blur-xl` |
| `.dk-ext-chat-bubble--user` / `--ai` | Message bubbles, right/left aligned |
| `.dk-ext-chat-insert-btn` | "Insert reply into page" secondary action, only rendered on known AI-provider domains |
| `.dk-ext-queue-badge` | Small counter on Status tab showing offline-queue length |

All use existing `--bg-*`, `--text-*`, `--border`, `--accent-primary` (#ec4899) tokens from `design-tokens.css` — no new color values introduced, `rounded-xl` / `p-5` ceiling respected per the anti-slop checklist.

---

## 7. Phasing note

Ship 2.1 + 2.2 alone first and verify in production use for a few days before touching anything else — they're the only changes that fix actual data loss, everything else (2.3–2.6, all of section 3) is visibility/feature work layered on top and can slip without risk to the existing pipeline.
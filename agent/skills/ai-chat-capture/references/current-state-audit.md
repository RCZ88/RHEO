# Current-state audit — external AI capture & transcripts

> Snapshot: **2026-10-01**. Read this before promising a feature. Most of the pipeline *exists*
> and a large part of it is *silently dead* — it looks installed and produces nothing, which is
> the worst failure mode because nothing alerts you.

**Verified against the live DB** (`~/.config/RHEO/deskflow-data.db`, read-only):
`ai_context_captures` = 143 rows · `context_episodes` = 146 (`external_ai` = 143) ·
`ai_chat_groups` **does not exist** · `ai_chat_fts` **does not exist**.

---

## What genuinely works

| Piece | Where | State |
|---|---|---|
| `POST /ai-context` ingest + dedup + Brain episode | `main.ts` ~19952 | ✅ real |
| `chatLibrary.ts` — `ingestConversation`, transcript hash, auto-title, groups, FTS5, search | `src/main/ai/chatLibrary.ts` | ✅ real, well-built |
| Chat Library UI — search, groups, pin, move, read preview | `src/components/ai/chat/ChatLibrary.tsx` (617 L) | ✅ real |
| `overlay.js` per-site selector table + copy buttons + export-MD | `browser-extension/overlay.js` (54 KB) | ✅ real |
| `AiContextPanel` — raw capture browser with copy-as-Markdown | `src/components/ai/AiContextPanel.tsx` (283 L) | ✅ real |

**The architecture is sound.** The failures are all in the seams.

---

## 🔴 Silently dead — looks alive, does nothing

### 1. `ai-context-content.js` almost certainly never runs

`manifest.json` declares it `world: "MAIN"`. Line 4 is:
```js
if (!chrome?.runtime?.id) return;
```
In the **MAIN** world `chrome.runtime.id` is `undefined`. The guard aborts the entire file.
The DB has 143 captures, all `source: 'dom-observer'` — from an **older build**. The current
file is likely inert.

> **Rule:** `chrome.*` APIs do not exist in `MAIN` world. A MAIN-world script that calls
> `chrome.*` has a dead guard. Communication must be `window.postMessage`; only the ISOLATED
> relay touches `chrome.runtime`.

### 2. Six HTTP routes the extension calls do not exist

Registered: `POST /ai-context` only. Called by the extension but **absent**:
`GET /ai-context/list`, `GET /ai-context/stats`, `POST /assemble-context`, `GET /ai-prompts`,
`POST /ai-prompts/build`, `DELETE /extension/topics/:id`.

Consequences — all invisible, all "the feature is just empty":
- extension "Recent Captures" history tab → permanently empty
- "→ Recent Captures" inject → silently does nothing
- extension popup → always shows **0 captures / Offline**

Bonus shape bug: `overlay.js` reads `d.newest`; the IPC returns `newestMs`.

### 3. Only 3 DOM selectors exist for 13 providers

`ai-context-content.js` has `[data-message-author-role]`, `[data-is-streaming]`, `.prose`, and
resolves them by **first-non-empty-wins**. On Gemini/Qwen/Kimi/GLM/DeepSeek/You/HF/Poe/Character
it falls to `.prose` — a generic markdown wrapper — yielding zero or one page-sized "message".

**The good per-site table exists in `overlay.js` (13 hosts, `msgSel`/`inputSel`/`roleAttr`) and
was never ported into the capture script.** Two tables, one truth, already drifted.

### 4. 7 of 13 providers fall through to the wrong parser

`extractMessages()` `default:` → `extractMessagesFromClaude`, which expects
`{chat:{messages:[{sender,text}]}}`. Qwen, Kimi, GLM, HuggingFace, Poe, Character, DeepSeek do
not return that shape → zero messages.

### 5. `fetch` monkey-patch cannot see streaming

`window.fetch` patched, then `clone.json()`. Every provider answers over SSE. Non-functional by
construction — which is why all 143 live captures are `dom-observer`, not `fetch-intercept`.

### 6. Roles are wrong for 8 providers

`overlay.js` sets `roleAttr: null` for Claude, Perplexity, You, Gemini, Qwen, Kimi, GLM, HF, Poe,
Character, DeepSeek. `scrapeAll()` then hard-codes `role = 'assistant'`.

**Every user turn is stored as an assistant turn.** Downstream: `deriveAutoTitle()` looks for
the first `role==='user'` turn → returns `null` → **every affected thread is titled "Untitled"**,
and alternating-turn rendering is impossible.

### 7. `AiContextPanel` is unreachable

`AiPage.tsx:1626` renders the toggle button **only when `aiSubPage === 'context'`** — and the
button is the only writer of `aiSubPage`. The panel that reads `ai_context_captures` **can never
be displayed.** `vault` and `brain` are unconditional by comparison.

### 8. Chat Library migration is lazy and probably never ran

`migrateChatLibrary()` runs only inside `chatLib()`. Live DB confirms `ai_chat_groups` and
`ai_chat_fts` are **absent**. The mirror failure is swallowed by a `console.warn`-only try/catch
(`main.ts` ~20015), so 143 captures may exist with **no library rows at all**.

> **Two stores, one request, non-blocking mirror, no reconciliation.** No
> `captureId → thread_date` back-link exists; `ai_chat_threads.brain_episode_id` is added by the
> migration and **written by nothing**.

---

## 🟠 Breaks the user's asks

| Ask | Blocker |
|---|---|
| **Export a transcript** | Library has **no export**. `ChatExportBridge` exports only the *currently-loaded in-app thread*, not an arbitrary captured one. |
| **See them from the external-AI subpage** | Nothing on `/terminal → ai-gateway` lists captures; `SessionsTab` renders `aigateway_runs` which stores **only prompt/response *lengths*** — no content columns exist. |
| **Open quickly** | `onOpenThread` loads an `external_ai` thread into the **in-app DeskFlow composer** — a category error. No transcript route, no deep link, no URL sync. |
| **Navigate quickly** | No jump rail. `ChatLibrary` holds `query`/`selected`/`activeGroup` in local `useState` — **reload loses your place**. No keyboard shortcuts, no `/` focus, no command palette. |
| **Delete** | No `deleteThread` export, no `chat-library:thread-delete`. `aiContextDelete`/`aiContextClear` exist in preload and are **called by nothing**. |

---

## 🟡 Data-integrity issues

1. **A partial capture can destroy a complete one.** `ingestConversation` does
   `DELETE FROM ai_chat_messages WHERE thread_date=?` then re-inserts. A DOM-only (virtualized,
   incomplete) capture that lands after a full API capture **wipes the earlier messages.**
   → Guard on `complete` before overwriting. **Highest-severity item here.**
2. **Dedup keyed on `messages.length`** → every new turn forks a *second* full copy.
3. **`focusOverlay.js` builds `captureKey` with `Date.now()`** → manual grabs are never deduped.
4. **Brain episodes truncate at 1500 chars** (`episodeWriters.ts:149`) → the graph learns only
   conversation openings. `PROVIDER_ALIASES` omits qwen/kimi/chatglm/deepseek → duplicate
   entities on re-capture.
5. **`aigateway_runs` has no content columns** — prompt/response text exists *only* as a
   transient 2-message library row, and re-runs create duplicates.
6. **`ai_context_captures.messages` is one opaque JSON blob.** No message-level table, no
   per-message timestamp, no per-message export. LIKE-search across the blob is unindexed and
   `O(n·transcript)` per keystroke.
7. `MAX_PAYLOAD_BYTES` truncation shortens content but **never re-checks or splits** the batch.
8. `overlay.js` binds DOM listeners once; SPA navigation replaces nodes → **per-message copy
   buttons disappear on every route change** inside ChatGPT/Claude.
9. `ai-context:get` and `ai-context:create` are allowlisted in preload but **have no handler**.

---

## Fix order (dependency-driven)

1. **Unbreak capture** — fix the MAIN-world `chrome.*` guard (#1), add the 6 missing routes (#2),
   port `overlay.js`'s selector table into the capture script (#3), add per-provider parsers (#4),
   replace the fetch patch with stability-debounced DOM + same-origin API (#5), real roles (#6).
   *Nothing downstream is verifiable until this is done.*
2. **Stop the data loss** — `complete`/`confidence` on every capture; never overwrite a complete
   transcript with an incomplete one (#1 in 🟠). Fix dedup key (#2, #3).
3. **Fix the library mirror** — run `migrateChatLibrary` at boot, backfill the 143 uncaptured
   rows, add the `captureId → thread_date` back-link, log loudly instead of `console.warn` (#8).
4. **Deliver the user's four asks** — export (Markdown/JSON/copy), surface on the external-AI
   subpage, a real transcript route with deep link, a jump rail + keyboard nav + persisted
   state.
5. **Add delete**, with confirm-or-undo, and confirm `ai_chat_messages` FK cascade (verify — it
   may differ from `ai_chat_memories`).
6. **Expose the unreachable panel** — hoist the Context toggle out of its own guard (#7).
7. **Per-provider color map** — currently 6 providers covered, the rest render `unknown`.

## Verification that must accompany every fix

- [ ] Capture a **15+ turn** conversation on the site; confirm **turn 1 is present**
- [ ] `ai_context_captures` grows AND `ai_chat_threads` grows (mirror proven, not assumed)
- [ ] Thread title is derived from the first **user** turn, not "Untitled"
- [ ] Roles alternate; a partial capture is visibly labelled
- [ ] Re-capture unchanged → no duplicate; re-capture after new turns → same thread updated
- [ ] Complete-then-incomplete capture → **earlier messages still present**
- [ ] Reload `/ai` → search, selection, and scroll position restored
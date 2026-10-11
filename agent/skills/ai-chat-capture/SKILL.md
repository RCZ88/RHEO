---
id: ai-chat-capture
name: External AI Chat Capture & Transcript
category: capture
version: 1.1.0
created: 2026-10-01
updated: 2026-10-01
tags: [browser-extension, ai-chat, capture, transcript, export, external-ai, chat-library]
description: >-
  THE reference for capturing AI chat conversations from external providers (ChatGPT, Claude,
  Gemini, Qwen, Kimi, GLM, DeepSeek, Perplexity, Grok, Copilot...), turning them into saved
  transcripts, and letting the user export, browse, open and navigate them fast inside DeskFlow.
  Load this whenever the work touches message detection, provider selectors, SSE interception,
  the copy button, transcript storage, Chat Library, or the external-AI subpage.
metadata:
  role: reference
  visibility: computer
  role_note: >-
    Not a design conductor and not a code generator — a FACT BASE. It exists because provider
    DOMs and internal APIs churn weekly, and the correct answer per site was previously spread
    across three files, two of which were wrong. Verify against the site before trusting it.
requires:
  - paint
governs:
  - browser-extension/ai-context-content.js
  - browser-extension/overlay.js
  - browser-extension/focusOverlay.js
  - browser-extension/manifest.json
  - src/main/ai/chatLibrary.ts
  - src/components/ai/chat/ChatLibrary.tsx
  - src/components/ai/AiContextPanel.tsx
  - src/main.ts (POST /ai-context)
  - src/main.ts (POST /ai-context/list, /ai-context/stats — MISSING, see audit)
---

# External AI Chat Capture & Transcript

> **Read this before touching provider selectors.** Three facts below have already cost this
> codebase multiple silent failures, and all three produce a feature that *looks* installed and
> captures nothing:
>
> 1. **Every major chat UI virtualizes its message list.** The DOM holds only what is near your
>    scroll position — Claude keeps roughly **12** messages (`data-test-render-count`), ChatGPT
>    and Gemini unload off-screen turns. A DOM scrape of a 40-turn conversation returns the last
>    dozen and **reports success**. There is no error, no empty state, nothing to notice.
> 2. **Every response is SSE/streaming.** `response.clone().json()` on a stream throws or yields
>    nothing. Monkey-patching `window.fetch` and calling `.json()` cannot see a finished reply.
> 3. **Provider DOMs restructure without warning.** Claude moved `data-testid="user-human-turn"`
>    → `data-testid="user-message"` and `.font-user-message` → `.!font-user-message`. A selector
>    that worked in June returns 0 elements in July and the capture simply stops.

---

## LAYER 0 — THE THREE LAWS

### Law 1 — API-first, DOM-fallback. Never DOM-only.

The only reliable source of a *complete* conversation is the provider's own **same-origin
internal API** — the same endpoints the web client itself calls, using the session cookie you
already have. DOM scraping is the fallback, and it is explicitly allowed to be incomplete; it
must be **labelled as incomplete in the UI**, never presented as the whole conversation.

| Provider | List conversations | Full messages | Notes |
|---|---|---|---|
| **Claude** | `GET /api/organizations/{orgId}/chat_conversations` | `GET /api/organizations/{orgId}/chat_conversations/{id}` | `chat_messages[]`, `sender: 'human'\|'assistant'`, `content[]` blocks, real `created_at` |
| **Claude (shared)** | — | `GET /api/chat_snapshots/{uuid}` | The public share page is a JS shell; the data is here |
| **ChatGPT** | `GET /backend-api/sidebar` (or `/conversations`) | `GET /backend-api/conversation/{id}` → `mapping` tree | Per-node `message.author.role`, `message.content.parts[]` |
| **Gemini** | `batchexecute` RPC | RPC `hNvQHb`, **cursor-paginated** | Auth token from `WIZ_global_data` |
| **Perplexity** | — | response carries `query_str` + `answer` | Flat pair, not a message list |
| **DeepSeek** | no documented internal API | — | DOM + configurable selectors; share links render server-side |
| **Qwen / Kimi / GLM / others** | no documented internal API | — | DOM + configurable selectors. See `references/site-adapters.md` |

> ### ⚠️ The Cloudflare wall on Claude (this is the one that breaks naive implementations)
>
> `claude.ai` puts a bot check in front of its API. **`curl` / `node fetch` / Python `requests`
> get HTTP 403 even with a perfectly valid session cookie.** The request must originate from
> inside the already-logged-in tab so it carries a real browser TLS fingerprint and same-origin
> cookies.
>
> **Consequence for this codebase: the provider fetch MUST run in the page (MAIN world content
> script or a same-origin `fetch` from an injected script).** You cannot call these endpoints
> from the Electron main process, and you cannot call them from a content script without host
> permission for the API path. This is the single most important architectural constraint in
> this skill.

### Law 2 — Debounce on DOM *stability*, never on DOM *presence*.

Streaming means the DOM is incomplete every time a `MutationObserver` fires. Reading on
presence captures half a `<div>`. Read on quiescence:

```js
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanForMessages, 600);   // stability window
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
```

600ms is the working value from shipped extensions. Do not shorten it.

### Law 3 — Role detection must be per-site. Never default to `assistant`.

If a provider has no role signal, infer from **geometry and structure**, not from a default:

- User turns are right-aligned (`justify-end`, `items-end`, `.user-message-bubble-color`).
- Assistant turns are left-aligned and carry the markdown/prose wrapper.
- If you genuinely cannot tell, capture it as `role: 'unknown'` and let the UI show it honestly.
  **Never** write every turn as `assistant` — that corrupts auto-title derivation (which looks
  for the first *user* turn, so titles silently become "Untitled") and destroys any
  alternating-turn rendering.

---

## LAYER 1 — PROVIDER ADAPTER CONTRACT

Every provider implements this shape. One file, one export, one row in the registry — no
per-site branching scattered through capture logic.

```ts
export interface ProviderAdapter {
  id: string;                 // 'claude'
  hosts: string[];            // ['claude.ai']
  label: string;              // 'Claude'

  /** API-first. Return null when unavailable so the caller falls back to the DOM. */
  fetchConversation(): Promise<RawMessage[] | null>;

  /** DOM fallback. MUST set `complete: false` — virtualization means it is partial. */
  scrapeDom(): { messages: RawMessage[]; complete: boolean };

  /** Role resolution. Required for every provider. */
  resolveRole(el: Element): 'user' | 'assistant' | 'unknown';
}

export interface RawMessage {
  role: 'user' | 'assistant' | 'unknown';
  content: string;
  createdAt?: number | null;  // real timestamp if the API gave one — do not guess
  index?: number;
}
```

**Registry requirements:**
1. `hosts` must be data, and `manifest.json` `content_scripts[].matches` must be generated from
   it — one source of truth. Today the manifest hardcodes 13 hosts while the adapter table has
   drifted from it; that drift is how you get "supported" sites that never load the script.
2. Each adapter needs **≥2 selectors in priority order**. One selector is a single point of
   failure against a platform that ships frontend changes weekly.
3. Unknown/new sites get a **generic adapter** with a documented heuristic, and the UI must
   mark their captures as low-confidence.

### Adding a provider — the checklist

- [ ] `hosts` added to the adapter registry
- [ ] `manifest.json` `matches` includes every host (and the matching `host_permissions`)
- [ ] `inputSel` (for the inject/paste path) added — a message extractor without an input
      selector is only half a provider
- [ ] `resolveRole` returns real roles (Law 3)
- [ ] `scrapeDom` sets `complete: false`
- [ ] Verified against a **real page** with ≥15 turns, confirming whether turn 1 survives
- [ ] Dedup key is stable across a re-capture of an unchanged conversation
- [ ] Captured conversation renders with alternating roles and a non-"Untitled" title
- [ ] Added to the provider→colour map in the transcript UI

---

## LAYER 2 — THE PIPELINE (three stages; AI only in stage 3)

> **The single most expensive mistake available here is putting an LLM in stage 1.**
> Capture must be deterministic. Stage 3 is where AI earns its cost.

```
STAGE 1 — CAPTURE          (deterministic · NO AI)
  same-origin internal API  ← primary, complete
  DOM + stability debounce  ← fallback, marked incomplete
  ├─ AI is USELESS here: it cannot see virtualized-away turns, 40 turns exceed
  │  context so chunking scrambles role order, and output is non-deterministic
  │  → same page, different transcript = corrupted library.
  ▼
STAGE 2 — STRUCTURE        (deterministic · AI as long-tail fallback only)
  adapter parse → {role, content, createdAt}
  ├─ AI fallback ONLY when: no adapter matches AND the generic heuristic failed.
  │  Feed the raw DOM fragment + a JSON schema. Still bounded by virtualization.
  ▼
STAGE 3 — ENRICH           (AI · this is what the tokens buy)
  ├─ auto-title / auto-group      (today: regex `classifyGroup`)
  ├─ summaries for previews       (today: raw slice)
  ├─ semantic dedup               (same conversation, re-captured)
  └─ COMPLETENESS GRADING         ← the valuable one
       compare claimed turn count vs parsed turns → flag virtualization truncation.
       Stage 3 catches a failure Stage 1 is structurally incapable of detecting.
  ▼
  INSERT ai_context_captures → context_episodes (Brain) → chatLibrary().ingestConversation
  ▼
  Transcript UI: browse · open · export · navigate
```

### The two lanes — "AI Gateway" is a misleading name

DeskFlow has **two different things called a gateway**, on opposite sides of a real boundary.
Do not merge them.

| | `ai-router` (external, Python) | `AIGatewayService` (in-repo) |
|---|---|---|
| Mechanism | HTTP OpenAI-shaped endpoint | **Playwright** browser automation |
| Identity | API keys | **your logged-in session** |
| Code | `airouter` → `http://127.0.0.1:4000/v1` | `BrowserManager`, `page.goto`, `humanType`, `CredentialVault` |
| Answers | *"which API model runs this?"* | *"which site am I logged into?"* |
| Reaches | any keyed provider | ChatGPT/Claude/Gemini **web** sessions |

`AIGatewayService` literally **types like a human** (`HumanSimulator.humanType`) and scrapes via
`CompletionDetector` — because those sites block headless/API access (SKILL.md Law 1, Cloudflare).
**ai-router cannot replace it and must not try to.** It holds no session cookie and cannot drive a DOM.

**The integration:** make `ai-router` the **primary API gateway** for
`src/services/providers/router.ts` — replace `buildChain`'s hand-rolled provider fallback rather
than stacking a third router beside it. Keep `AIGatewayService` as the session lane.

Full integration detail, feature→group mapping, and the IPC constraint:
**`references/ai-routing.md`**.

### Invariants that must not break

- Dedup must be by **conversation identity**, not message count. Keying on `messages.length`
  means every new turn creates a *second* full copy of the conversation.
- `ingestConversation` replaces messages wholesale (`DELETE` + re-insert). That is correct for
  a transcript, but it means the payload must be the **complete** conversation — a partial DOM
  capture would **delete** messages the API path had previously stored.
  → **This is why `complete: false` must be surfaced, not silently written.** A partial capture
  must never be allowed to overwrite a complete one. Guard on `complete`.
- Never truncate content below ~2000 chars in the store. Truncation belongs in the *preview*,
  not the transcript.
- Stage 3 is **fire-and-forget and never blocks ingest.** A capture must be stored even if every
  enrichment call fails. Capture is the source of truth; enrichment is derived and re-runnable.

## LAYER 3 — TRANSCRIPT UI (PAINT pipeline)

Any UI work here loads **`paint`** first. Surface classification:

| Surface | Token SoT | Latitude |
|---|---|---|
| Chat Library modal, `/ai` | `src/index.css`, `--page-accent` = `#8b5cf6` on `data-page="ai"` | **Zero** |
| external-AI subpage | `data-page="external"` → `--page-accent: #fbbf24` | **Zero** |
| Browser-extension overlay | `src/index.css`, re-skinned to match the host page | Zero |

### 3.1 Required states (Gate D)

Every transcript surface implements all five:

- **Empty** — "No saved conversations yet." + the one action that creates one
  ("Open ChatGPT and the extension captures automatically"), never "No data".
- **Loading** — skeleton rows matching the list row shape (avatar + 2 text lines), not a spinner.
- **Error** — plain cause + recovery. "Couldn't load saved chats because the DeskFlow service
  isn't running. Start DeskFlow and retry."
- **Populated** — the list.
- **Partial / incomplete** — the one state unique to this feature: a DOM-only capture is
  **visibly marked** ("12 of 40 turns — this capture may be incomplete"). Never present a
  truncated transcript as a whole one. See Law 1.

### 3.2 The three user verbs

The user's asks map to three affordances; each has a real design reason:

| Verb | Affordance | Why it looks like that |
|---|---|---|
| **Export** | Per-thread "Export" → Markdown / JSON / Copy | Markdown is the portable form (paste into any AI); JSON is the lossless one. Copy is the zero-friction default because most exports are "paste into another chat". |
| **Open** | Click a row → transcript view, **in place** | Opening must not load an *external* thread into the in-app DeskFlow composer — that is a category error and it is what the current code does. |
| **Navigate** | A **jump rail** down the left of the transcript: one tick per user turn, click to scroll | Long transcripts are unusable without it. Proven pattern (ChatNav); it turns a 40-turn scroll into a 40-tap jump. Tick = user turn only, because those are the landmarks a reader navigates by. |

### 3.3 Fast-open requirements

- Keyboard: `/` focuses search, `↑`/`↓` move selection, `Enter` opens, `Esc` closes,
  `Cmd/Ctrl+K` command palette over threads.
- Search must be **debounced and indexed**. `ai_chat_fts` (FTS5) exists; the LIKE fallback is
  `O(n·transcript)` and will stutter. Verify which one is actually active before claiming search
  is fast.
- Persist `query` / `selected` / `activeGroup` to `localStorage` **and** the URL. Reload losing
  your place in a transcript is the definition of not-navigable.

### 3.4 Motion

Liveliness **L2 (Responsive)** — this is a dense data tool, not a marketing surface.
- Reactive: row hover/press, `scale-[0.98]` on press.
- Transitional: transcript open/close, drawer slide.
- Ambient: **none.** No decorative loops. A "recording" dot is functional and allowed.
- `prefers-reduced-motion` fallback mandatory.
- Only `transform`/`opacity`. Never `width`/`height`. Never `transition-all`.

### 3.5 Gates that are not optional here

- [ ] No raw provider enum in user-facing text — show the provider **label**
- [ ] Buttons are verb + noun ("Export transcript", not "Export")
- [ ] Provider colour comes from `src/lib/CategoryColors.ts` or one hue per surface — never a
      second accent hue beside `--page-accent`
- [ ] Destructive (delete a transcript) confirms, or offers undo
- [ ] Meaning never carried by colour alone (the "incomplete" badge needs a label)
- [ ] Radii ∈ {8, 12, pill}; no `rounded-2xl`
- [ ] Max 2 font families; transcript body in `--font-sans`, code/timestamps in `--font-mono`
- [ ] No emoji as icons — `lucide-react`

---

## LAYER 4 — SELF-MAINTENANCE (MANDATORY, same cycle)

**This skill rots on a schedule the repo does not control.** Provider DOMs change without commit
history. So:

1. **Every time you touch a provider adapter**, re-verify it against a live page and bump
   `updated:` in the frontmatter. Add a comment with the date you last verified.
2. **Every time you find a broken selector, fix it here in the same cycle** — not just in the
   code. `references/site-adapters.md` is the reason this skill exists.
3. **When you add a provider**, add it to `references/site-adapters.md` AND to the manifest
   `matches` AND to the provider colour map. Three places, one cycle.
4. **When you change the transcript UI**, re-run PAINT Gates C/D/E/F for the changed surface.
5. Bump `version:` on every substantive sync, and update `agent/skills/skill-router/SKILL.md`
   if this skill's category changed.

### Regression checks before claiming a capture works

- [ ] Captured **15+ turns**, and turn 1 is present (proves it's not virtualization-truncated)
- [ ] Roles alternate correctly; titles are derived from the first *user* turn
- [ ] Re-capturing an unchanged conversation creates **no** duplicate
- [ ] Capturing after new turns **updates** the existing thread rather than forking it
- [ ] A paused/incomplete capture does not overwrite a complete transcript (Law 2 invariant)
- [ ] Restarting DeskFlow and reopening a transcript restores scroll position and jump rail

---

## Reference files

| File | Read it when |
|---|---|
| `references/site-adapters.md` | Adding or fixing a provider — per-site selectors, roles, APIs, known breakages |
| `references/ai-routing.md` | Wiring ai-router as the API gateway, or enriching in stage 3 — feature→group map, the two-lane boundary, the IPC constraint |
| `references/current-state-audit.md` | Before promising anything — what is built, what is silently dead |
| `references/transcript-ui.md` | Building or changing the browse/open/export/navigate surface |

## Related

- `paint` — design conductor for every UI change here
- `external-ai-bridge` — the extension ↔ gateway transport seam for *sending*
- `beautiful-charts` — only if a usage chart is added
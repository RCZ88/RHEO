# Provider Adapters — per-site fact base

> **Verified dates are load-bearing.** A selector table without dates is how this codebase got
> a silently dead capture path: selectors were correct once and nobody checked again. Re-verify
> before trusting a row, and update the `Verified` column **in the same cycle** as any code fix.

## Selector reliability ranking (read this first)

1. **`data-testid` / `data-cy`** — most stable, explicitly maintained for automation.
2. **`data-message-author-role` and similar role attributes** — stable, and they carry the role
   for free. Best value per byte.
3. **Stable semantic classes** (`query-text`, `group/query`) — survive longer than hash classes
   because they are not generated.
4. **`[class*="…"]` substring matches** — acceptable for Chinese providers whose classes are
   hashed, but expect false positives (a wrapper matches too).
5. **Utility/hash classes** (`.bg-bg-300`, `.font-claude-message`, `.prose`) — **brittle.** These
   break on theme or Tailwind config changes. Never use as the sole selector.

**Never rely on `.prose` as a message selector.** It is a *generic markdown wrapper* — on most
sites it wraps the whole page, so you get either zero messages or one page-sized message.

---

## Claude — `claude.ai`

| Role | Primary selector | Fallbacks |
|---|---|---|
| user | `[data-testid="user-message"]` | `[data-testid="user-human-turn"]`, `.!font-user-message`, `div.bg-bg-300` filtered by ancestor `.items-end` |
| assistant | `[data-is-streaming] .font-claude-response` | `.font-claude-message` |
| input | `div[contenteditable="true"]`, `div.ProseMirror` | `textarea` |

**Order matters — use a single `querySelectorAll` over the union so DOM order is preserved.**
Selecting users and assistants separately and concatenating them **scrambles the conversation**,
which is a bug shipped in at least one public exporter.

**API (preferred):**
```
GET /api/organizations/{orgId}/chat_conversations              → list
GET /api/organizations/{orgId}/chat_conversations/{id}         → chat_messages[]
GET /api/chat_snapshots/{uuid}                                 → shared chats
```
`chat_messages[]` → `{ sender: 'human' | 'assistant', content: [ {type:'text', text} ], created_at }`.
Real per-message timestamps, which the DOM cannot give you.

`orgId` comes from the session bootstrap; read it from the page's own network responses or the
`__NEXT_DATA__`-equivalent global rather than hardcoding.

**⚠️ Cloudflare bot check** — see SKILL.md Law 1. Must be fetched from inside the logged-in tab.

**Known breakage history:**
- v7.7 (2026-02-16): wrapper rebuilt, 11-level nesting, gradient overlays added.
- (2026-07-26, live): `data-testid="user-human-turn"` → **0 matches**; `data-testid="user-message"`
  → 3 matches. `.font-user-message` → 0; `.!font-user-message` is the live class.

**Virtualizes.** `data-test-render-count` shows only ~12 rendered turns. A DOM-only capture of a
long conversation is guaranteed incomplete.

---

## ChatGPT — `chatgpt.com`, `chat.openai.com`

| Role | Primary selector | Notes |
|---|---|---|
| both | `[data-message-author-role]` | values `user` / `assistant` / `system` — role is free |
| assistant | `article[data-turn="assistant"]` | contains `h5.sr-only` "ChatGPT said:" |
| user | `[data-message-author-role="user"]` inside `div.z-0.flex.justify-end` | right-aligned |
| input | `textarea#prompt-textarea`, `div#prompt-textarea` | ProseMirror editor |
| content | `.markdown` | **scan backwards** for the last assistant block |

**API (preferred):** `POST /backend-api/conversation` returns a `mapping` tree of nodes:
`node.message.author.role`, `node.message.content.parts[]`. Walk the tree in parent→child order.

**⚠️ Pitfall:** `containers[containers.length - 1]` is **wrong** in a conversation — the last
container may be the *user's* message. Always filter by
`[data-message-author-role="assistant"]`, or scan `.markdown` backwards.

**Codex Web shares the `chatgpt.com` hostname** and is differentiated by **path**. One host entry
covers both; do not treat them as one DOM — Codex uses a task/thread/item model and has no
`data-message-author-role` at all.

**Virtualizes.** Off-screen turns are unloaded.

---

## Gemini — `gemini.google.com`

| Role | Primary selector | Notes |
|---|---|---|
| model output | `div.query-text` | completely different DOM model from ChatGPT |
| user | model-response container's sibling / `user-query` | no `data-message-author-role` |
| input | `rich-textarea`, `div[contenteditable="true"]` | |
| expand collapsed | `role="button"` + `line-clamp-5` wrapper | **must expand before reading**, or you capture a 5-line stub |

**API (preferred):** `batchexecute` RPC — RPC id **`hNvQHb`**, auth token from
`WIZ_global_data`. **Cursor-paginated**; you must follow cursors to get all turns. A regenerated
draft continues from a parent pointer and must be matched on that, or you get duplicates.

**Lazy-loads** the message list — only recent turns exist until the user scrolls.

**Verified 2026-07-30 (live).** Re-verify: Gemini changes faster than the others.

---

## DeepSeek — `chat.deepseek.com`

| Role | Selector strategy |
|---|---|
| message | `[class*="message"]` filtered to exclude nav/sidebar |
| user vs assistant | alignment (`justify-end` / `items-end` for user) |
| input | `div[contenteditable="true"]`, `textarea` |

**No documented internal API.** Shipped extensions solve this by making selectors
**user-configurable** (`chrome.storage.local`) so a DOM change is a settings edit, not a release.
**That is the right pattern for every provider without an API.**

Share links (`chat.deepseek.com/share/...`) render server-side and are easier to extract from —
useful as a fallback path.

---

## Perplexity — `perplexity.ai`

| Role | Selector |
|---|---|
| answer | `.prose`, `.answer`, `[class*="group/query"]` |
| query | `.group/query` sibling |

**Response shape is a flat pair**, not a message list: `{ query_str, answer }` →
`[{role:'user', content:query_str}, {role:'assistant', content:answer}]`.

Citations live in a sibling structure — extract them separately or they are lost.

---

## Chinese providers — Qwen, Kimi, GLM (Zhipu), Doubao, Yuanbao

These share a family resemblance (Ant Design / Tailwind-derived class soup) and **none has a
documented internal API**. Treat them as one adapter family with per-host class overrides.

| Provider | Hosts | Starting selectors (UNVERIFIED — establish live before trusting) |
|---|---|---|
| Qwen | `chat.qwen.ai`, `tongyi.aliyun.com`, `qianwen.com` | `[class*="message-content"]`, `[class*="chat-message"]` |
| Kimi | `kimi.moonshot.cn`, `kimi.com` | `[class*="message-content"]`, `[class*="chat-message"]` |
| GLM | `chatglm.cn`, `chatglm.baidu.com`, `bigmodel.cn` | `[class*="message-content"]` |
| Doubao | `doubao.com` | `[class*="message"]` + alignment |
| Yuanbao | `yuanbao.tencent.com` | `[class*="message"]` + alignment |

**How to establish these properly (do not guess):**
1. Open the site, start a conversation with **≥8 turns**.
2. DevTools → inspect the message container. Look for `data-*` attributes **first**, then
   semantic classes, then substring class matching.
3. Record the role signal: alignment, or an avatar/`aria-label`, or a sibling structure.
4. Scroll to the top and confirm turn 1 is still in the DOM. If it isn't → virtualization.
5. Write the row into this file with today's date and the exact selector strings.
6. **Make them user-overridable in the UI** — these providers ship redesigns without notice.

**Role inference for this family:** user turns are right-aligned and typically have a filled
bubble background; assistant turns are left-aligned with no bubble. Use geometry, not a default
(SKILL.md Law 3).

---

## Other providers — same recipe, no shortcuts

| Provider | Hosts | Status |
|---|---|---|
| Grok | `grok.com`, `x.ai` | shares ChatGPT-ish role-attr pattern; **verify** |
| Copilot | `copilot.microsoft.com` | composer-based; **verify** |
| You.com | `you.com` | API returns `messages` in one of 3 shapes — check all three |
| HuggingFace | `huggingface.co/chat` | **verify** |
| Poe | `poe.com` | aggregates many models; provider field per message |
| Character.ai | `character.ai` | **verify** |
| Mistral | `chat.mistral.ai` | **verify** |
| OpenRouter | `openrouter.ai/chat` | **verify** |
| LM Studio / Ollama web UIs | localhost | **exclude** — localhost is already excluded from browser tracking; treat consistently |

**Any new provider goes through the SKILL.md LAYER 1 checklist. No exceptions.**

---

## Generic / unknown-site fallback

When no adapter matches:

1. Detect the highest-signal container: the element with the most repeated same-class siblings
   inside the main scroll region.
2. Split by geometry (alignment) for roles.
3. Strip known UI chrome before text extraction: action buttons, `sr-only` screen-reader text,
   copy-code decorations, artifact/tool chips (keep chips as inline markers).
4. Set `complete: false` and `confidence: 'low'`.
5. **Surface the low confidence in the UI.** A silent heuristic capture is how users end up
   trusting a transcript that is wrong.

---

## Quick verification recipe per provider

```
1. Open site → conversation with ≥15 turns (must exceed the virtualization window)
2. Run in DevTools console:
   document.querySelectorAll('<SELECTOR>').length
   → if 0, selector is dead. If < 15, virtualization is truncating you.
3. Check turn 1 exists:  [...document.querySelectorAll('<SELECTOR>')].at(0).innerText.slice(0,80)
4. Verify roles alternate.
5. Scroll to top, re-run step 2 — if the count changed, you're seeing a recycled window.
```

Record the date and the counts. That is the regression test for this table.
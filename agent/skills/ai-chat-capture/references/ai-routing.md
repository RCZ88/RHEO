# AI routing — ai-router as the API gateway

> Integration reference for `SKILL.md` LAYER 2. Read before changing how DeskFlow picks models.
> All paths below were verified 2026-10-01.

## What `ai-router` is

Self-hosted Python router at `/home/clementzhao/Documents/COMPUTAH SAYENCE/ai-router`
(not a sibling of this repo — it's under `/home`, not the `/run/media/…` mount).

- **Endpoint:** OpenAI-shaped, `http://127.0.0.1:4000/v1`
- **Start:** `cd ~/Documents/COMPUTAH\\ SAYENCE/ai-router && airouter run`
- **Also:** `airouter validate` (which providers are live), `airouter status`,
  `airouter demo` (offline, zero quota), and an MCP door (`airouter mcp`).
- **Not running by default** — every integration must degrade when it isn't.

### Config is split in two — this matters

| File | Holds | Notes |
|---|---|---|
| `config/config.yaml` | **policy** | `server.host: 127.0.0.1`, `server.port: 4000`, `auth_keys: []` (**open — fine on localhost, never expose it**), plus the model-echo mode (`requested` default, so client UIs don't get confused; truth is in `X-Router-*` headers). |
| `config/providers.yaml` | **catalog** | 26 providers, 6 groups, 19 aliases. Referenced via `providers_file`. |

**Groups (verified):** `fast` · `reasoning` · `coding` · `vision` · `embed` · `local`

**Useful aliases:** `auto`, `default`, `gpt-4o-mini`, `gpt-4o`, `gpt-5`, `o1`, `o3-mini`,
`claude-sonnet-5`, `deepseek-chat`, `deepseek-coder`, `qwen3-coder`, `codestral`.

> ⚠️ `config/providers.starter.yaml` (4 providers) is a **sample**, not the catalog. Don't read
> group names from it — it lacks `vision` and `embed`.

**Keyless providers** (ollama, lmstudio, vllm, llamacpp, koboldcpp) self-register. Providers
without keys load as `unavailable` and are **never routed to** — so a router with no keys still
works on local models, which is the correct offline behaviour.

---

## The feature → group map

DeskFlow's `buildChain` already declares per-feature routing. Map each existing feature to a
router **group**, not a concrete model — that is what preserves failover.

| `buildChain` feature | Group | Why |
|---|---|---|
| `category` | `fast` | Classification, high volume, cheap. |
| `colors` | `fast` | Same shape as `category`. |
| `contentEngine` | `reasoning` | Structure quality matters. |
| `researchDigest` | `reasoning` | Synthesis over many sources. |
| `goalAssistant` | `reasoning` | Planning. |
| `lifeAssistant` | `fast` | Conversational, latency-sensitive. |
| `monthlyRecap` | `reasoning` | Reflection over the month. |
| `resumeBuilder` | `reasoning` | Highest visible stakes. |
| `presentation` | `coding` | Mostly structured output. |
| `vision` | `vision` | Direct 1:1 (only feature already naming a modality). |
| *(new)* transcript enrichment | `fast` | Titles, groups, summaries, grading — batch, cheap. |
| *(new)* semantic dedup | `fast` | Embedding-shaped; consider the `embed` group. |

**Rule: request a group, never a model id.** A hardcoded model id disables failover and will
break the moment that provider's free tier changes — which, per the project's own notes, has
happened repeatedly (GitHub Models retired, Groq dropped Llama from free, Cerebras went
card-required, OpenRouter rotated its free roster).

---

## Integration shape

### 1. Calls MUST go through `ipcMain`

The renderer CSP restricts `connect-src`, so a renderer-side `fetch` to `127.0.0.1:4000` is
blocked. The app already has the correct precedent: `ipcMain.handle('ollama-chat', …)` at
`src/main.ts:4441` calls `http://localhost:11434/v1/chat/completions` **from main**.

- Register a single `ipcMain.handle('router-chat', …)` in main and call that from the renderer.
- Prefer the base URL **`http://localhost:4000/v1`** in config. `ai-router` binds `127.0.0.1`;
  `localhost` is the form that matches existing CSP allowances and existing code.
- **Never** put the router's `.env`, keys, or auth in the renderer bundle.

### 2. Make it the primary, and delete the hand-rolled fallback

The point is not to add a hop — it is to **remove** `buildChain`'s bespoke provider-fallback
logic, which `ai-router` does better (free-tier quota accounting, predictive skipping, cooldowns).

`buildChain` already returns `Array<{provider, model}>`; keep the signature and let it resolve
to a single router-backed provider. Anything that keeps a second, parallel fallback chain
reintroduces the duplication this integration is meant to remove.

### 3. Degrade, don't fail

When the router is down (it usually is), every caller must fall back to whatever it does today —
local Ollama first. `airouter validate` is a zero-quota liveness check; don't run it on a hot
path.

### 4. Schema gap to close first

`aigateway_runs` stores **only `prompt_len` and `response_len` — there are no content columns.**
If routed calls become a primary path, the actual prompt/response text exists nowhere durable
except a transient 2-message library row, and re-runs duplicate. Add content columns (or route
into `ai_chat_threads`) **before** making ai-router the main path, not after.

---

## Stage-3 enrichment: concrete jobs

Fire-and-forget, queued, never blocking ingest. Each writes back to the thread row.

| Job | Input | Output | Group |
|---|---|---|---|
| Auto-title | first substantive user turn | `ai_chat_threads.title` | `fast` |
| Auto-group | title + first ~4k of transcript | `group_id` | `fast` |
| Preview summary | transcript | `preview` / `summary` | `fast` |
| **Completeness grade** | claimed turn count vs parsed turns + `complete` flag | `confidence` + UI badge | `fast` |
| Semantic dedup | transcript hash + embedding | merge candidate | `embed` |

**Completeness grading is the highest-value one.** Stage 1 is structurally unable to detect
virtualization truncation — the turns are gone from the DOM. Stage 3 can compare the provider's
own turn count against what was parsed and flag the gap, which is what stops a truncated
transcript being presented as a whole one.

Re-runnable by design: enrichment is derived data. Losing it costs tokens, never content.

---

## Anti-patterns

- ❌ LLM in stage 1 — cannot see virtualized turns, scrambles roles on chunking, non-deterministic
- ❌ Hardcoding a model id instead of a group — silently disables failover
- ❌ Calling the router from the renderer — CSP blocks it
- ❌ Making ingest depend on enrichment — one provider outage would block all capture
- ❌ Exposing `auth_keys: []` beyond localhost — the router is unauthenticated by design
- ❌ Reading group names from `providers.starter.yaml` — it is a 4-provider sample

## Verify before claiming it works

- [ ] `curl http://localhost:4000/v1/models` responds (router up)
- [ ] `curl -D- …/chat/completions -d '{"model":"fast",…}'` shows `X-Router-Provider` +
      `X-Router-Model` + `X-Router-Attempts` headers
- [ ] Stop the router → the app still works via local Ollama fallback
- [ ] A `fast` group request with one provider keyless still returns a response
- [ ] Enrichment runs off the ingest path — killing the router mid-capture still stores the transcript
- [ ] Completeness grade correctly flags a known-truncated capture
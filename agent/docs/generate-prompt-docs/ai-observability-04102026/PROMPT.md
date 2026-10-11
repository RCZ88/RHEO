# PROMPT — AI Observability & Eval (DeskFlow)

> **Send this file AND `CONTEXT_BUNDLE.md` together.** The bundle is the
> codebase; this file is the mandate. The target AI has no repo access.
> Paste the whole of both into the external AI, or attach them as files.

---

## Raw Request (verbatim)

> so where can i acces s it and is it there?
>
> like is it up to the standard on how profesionals like evluate an like
> improve their ai ecosuystem?
>
> generate a prompt for an external ai to improve the system for the ai
> evalution thing idk what s hte term

---

## Context — the "why" and the "where"

DeskFlow is an Electron + React + better-sqlite3 desktop app. It routes AI
calls through a local failover router across Anthropic, OpenAI, Google,
Mistral, Ollama, and OpenRouter. Users compose AI work as cards on a canvas.

**Read `CONTEXT_BUNDLE.md` FIRST and treat it as the only source of truth.**
It contains the verbatim source of all five relevant files, the exact IPC
chain, the real type definitions, and the full acceptance criteria.

The app already has an **AI Debug Vault** — a persistent SQLite table
(`ai_debug_events`, 25,000-row retention, 300 KB payload cap) wired directly
into the provider router, with a working UI (`DebugVaultPanel.tsx`) offering
source filters, event filters, full-text search, provider/model columns,
markdown export, and scoped clear.

The problem is not that it is missing. **The problem is that it can tell you
*what* an AI call said, but not *how long it took*, *what it cost*, *why the
router picked the provider it picked*, or *whether any of that got worse after
a change.*** The data needed to answer those questions is either never
recorded, or recorded somewhere nobody reads.

There is a second, entirely dead diagnostic system
(`src/services/providers/providerLog.ts`) whose `pushDiag` function has
**zero call sites**, which is why the `ProviderDiagnostics` panel mounted in
Settings polls every two seconds and always renders empty — despite that file
containing the richer record shape (duration, parse result, HTTP status) and
correct secret-redaction helpers the vault lacks.

Measured gaps against how professionals actually evaluate an AI system:

| Layer | Purpose | Status |
|---|---|---|
| 1. Traces | verbatim per-call record | partial — router never sets `contextId`, so a prompt and its output cannot be joined |
| 2. Latency & cost | duration, $/call, tokens | **missing entirely** |
| 3. Aggregation | p95 latency, error rate, cost per provider | **missing** — only `COUNT(*) GROUP BY` |
| 4. Eval & regression | golden outputs, scores, regression detection | **missing** |

---

## The Mandate

Act as **Lead Engineer for AI infrastructure**. Design and specify the
complete, production-grade change that closes Layers 1–3 for DeskFlow. You own
the architecture, the schema, the instrumentation, and the UI. Produce a single
best solution — **not a menu of options.**

**Phase 4 (the eval harness) is explicitly OUT OF SCOPE.** Do not design
golden datasets, LLM-as-a-judge scoring, or CI gates. Mention them only as
noted future work. Do not propose OpenTelemetry, LangSmith, Arize, Phoenix,
Presidio, NeMo Guardrails, RAGAS, Braintrust, or any third-party
observability/eval dependency — this is a local-first Electron app with no
such dependency and none may be added.

---

## Requirement Checklist

### A. Unify, never add a third system
The vault becomes the **single persistent sink**. `providerLog.ts` must not
remain a parallel in-memory ring buffer. Decide and state plainly what
happens to `pushDiag`, `getDiagnostics`, `clearDiagnostics`, and the
`ProviderDiagnostics` component — and whether `path: 'A-digest' | 'A-test' |
'B-chat'` is deleted or mapped. **If you propose deleting any existing UI or
file, state it explicitly.**

### B. Schema (additive only)
Propose the exact `ALTER TABLE` statements, `snake_case` columns, and indexes.
Requirements: latency, cost, HTTP status, parse result, per-attempt index, and
a trace id. Justify every column against a question a user actually asks.
Cost must be `NULL` when the model is unknown — never `0`, never a guess.

### C. Instrumentation — the highest-value part
1. **Persist the routing decision.** Today `buildChain` silently drops
   providers (no template, no primary) and `runWithFallback` logs the chain to
   `console.log` only. Specify a route-decision event carrying the full chain
   **and each skipped provider's reason**, emitted before the attempt loop.
2. **Per-attempt events** with outcome, duration, HTTP status, and an error
   kind that distinguishes timeout from failure — the code already computes
   that distinction internally and then discards it.
3. **Fix the `currentFeature` race.** Design the fix so that concurrent
   requests cannot misattribute a feature. Specify exactly how the feature and
   a per-request trace id are threaded, and **how to do it without changing
   the existing `runWithFallback` parameter order** — there are ~50 call sites.
   Enumerate the call-site files from the bundle.
4. **Latency and cost** measured with `performance.now()`, priced from a new
   per-model rate table you specify. State where that table lives and what
   happens for an unknown model.

### D. Aggregation
Specify the insights API and the SQL or JS. **SQLite has no
`percentile_cont`** — state exactly how you compute p50/p95 and why. Required
outputs: per-provider and per-feature call counts, error rate, p50/p95
latency, total and mean cost, total tokens. Reuse the existing
`DebugQueryOpts` filter shape.

### E. UI
Extend `DebugVaultPanel.tsx`. Specify the exact new components and columns.
Requirements: a latency and cost column per row, an insights summary strip
reusing existing filters, and all four states (loading / empty / error /
populated). Follow the existing Tailwind `zinc` + `light:` token conventions
and the `SOURCE_COLORS` / `EVENT_COLORS` map pattern. **Preserve every
existing feature** — filters, search, export, clear, pagination. Never
`import { ipcRenderer } from 'electron'` in the renderer.

### F. IPC
Specify the new channel(s) across all three layers using the existing pattern
in bundle §6: preload bridge, `ipcMain.handle`, service function. Channels are
named `ai-debug:*`.

---

## Constraints (hard limits, not preferences)

- **Never run a build.** The human builds. Verify with scoped `esbuild` and a
  `grep`-scoped `tsc`. This repo has thousands of pre-existing type errors — a
  bare `tsc` run and any repo-wide error count are meaningless and must never
  be presented as pass/fail.
- **Additive migrations only.** No `DROP`, no unqualified `DELETE`, no
  `REPLACE`. Existing rows survive.
- **New columns are `snake_case`.**
- **Do not redefine `maskKey` / `maskHeaders`.** Adopt them. They are correct.
- **Do not change `runWithFallback`'s existing parameter order.**
- **Do not open a `Database` connection in `aiDebugVault.ts`** — it receives
  its handle via `initVault(db)`.
- Preserve CRLF. No mass reformatting. No destructive git commands.
- No new runtime dependencies.
- Secrets must not land in the DB unredacted; payloads contain raw user prompts.

---

## Output Format

Return `RESULT.md` with these sections:

1. **Architecture** — the unified data flow, as a diagram plus prose.
2. **Schema changes** — literal `ALTER TABLE` / `CREATE INDEX` SQL.
3. **Instrumentation** — literal code for the router changes, showing the
   exact new/changed function signatures and every one of the ~50 call sites
   that needs updating (by file and call shape).
4. **Aggregation** — literal `vaultInsights` implementation with the percentile
   approach explained.
5. **IPC** — literal preload + `ipcMain.handle` additions.
6. **UI** — literal TSX for the new components, plus exactly what (if
   anything) you are removing from existing files.
7. **Call-site impact table** — file → count → what changes.
8. **Verification** — the specific commands and the numbers each must print.
9. **Honesty statement** — which acceptance criteria from bundle §9 you
   actually verified, and which you could not.

If you need code that is not in `CONTEXT_BUNDLE.md`, say so explicitly and
name the file you need. **Do not invent APIs.** A previous attempt produced an
entire implementation against a codebase it could not see — every symbol was
fictional (`getProviderChain`, `provider.execute`, `p.isConfigured`,
`vault:stats`, `new Database('deskflow.sqlite')`, `export function debugSink`),
it deleted a working 366-line UI panel, and it redefined `maskKey` into
something that silently corrupts stored prompts. That is the failure mode to
avoid.
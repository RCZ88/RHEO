# AI Observability & Eval — Specification

> **Status:** DRAFT for external AI / Architect. Nothing here is implemented yet.
> **Scope:** `src/services/aiDebugVault.ts`, `src/services/providers/`,
> `src/components/ai/DebugVaultPanel.tsx`, `src/main.ts`, `src/preload.ts`
> **Terminology:** the field is **LLM observability** (tracing, latency, cost,
> reliability) and **LLM eval** (quality measurement / regression testing).
> Together: **LLMOps**. This spec covers observability first (Phase 1–3) and
> eval second (Phase 4).

---

## 1. Context

DeskFlow is an Electron + React + better-sqlite3 desktop app. It routes AI
calls through a local failover router (`ai-router`, OpenAI-compatible at
`http://127.0.0.1:4000/v1`) across multiple providers (Anthropic, OpenAI,
Google, Mistral, Ollama, OpenRouter). Users author these calls as "cards" on
a canvas UI.

When something misbehaves — wrong provider chosen, a parse silently returns
nothing, latency spikes, a fallback fires — there must be a way to see exactly
what happened, per call, and to compare it against what happened previously.

## 2. Current state (verified by reading the source, 2026-10-03)

### 2.1 System A — the AI Debug Vault (persistent, live, but shallow)

- `src/services/aiDebugVault.ts` (243 lines). SQLite table `ai_debug_events`,
  capped at 25,000 rows (`MAX_ROWS`), payloads capped at 300KB.
- Schema (all of it):
  ```sql
  id, ts, epoch_ms, source, event, feature, provider, model,
  context_id, role, tokens_in, tokens_out, payload
  ```
- Public API: `initVault`, `vaultLog`, `vaultQuery`, `vaultStats`,
  `vaultExport`, `vaultClear`, `setDebugSink` (on the provider router).
- Wired at `src/main.ts:2500-2506` — `setDebugSink` is installed into
  `src/services/providers/router.ts` so routed calls log automatically.
- Capture points (from `CAPTURE_POINTS`, `aiDebugVault.ts:172`):
  `ai-assistant`, `ai-chat`, `provider-router`, `route-prompt`,
  `terminal-agent`, `renderer`.
- UI: `src/components/ai/DebugVaultPanel.tsx` (365 lines). Source filter,
  event filter (`prompt|thinking|output|parsed|chunk|state|error`), text
  search, provider/model columns, markdown export, scoped clear.
  Mounted in `src/pages/AiPage.tsx` (was unreachable behind a dead
  conditional — fixed 2026-10-03).

### 2.2 System B — the provider diagnostics ring (richer, but DEAD)

- `src/services/providers/providerLog.ts` (43 lines). Exports
  `ProviderCallRecord`, `pushDiag`, `getDiagnostics`, `clearDiagnostics`,
  `maskKey`, `maskHeaders`.
- Its record is **strictly richer** than a vault row:
  ```ts
  interface ProviderCallRecord {
    id, ts, path: 'A-digest'|'A-test'|'B-chat', provider, model,
    request: { url, method, headers, body },
    response?: { status, headers, body },
    error?: { status?, message, raw? },
    parse?: { ok, extracted?, discarded? },
    durationMs?, streamed?
  }
  ```
- **It is never called.** `pushDiag` has zero call sites in `src/`, and the
  symbol does not appear in the built `dist-electron/main.cjs`.
  `src/components/ProviderDiagnostics.tsx` is mounted in
  `src/pages/SettingsPage.tsx:6319`, polls `get-provider-diagnostics`
  every 2s, and therefore **always renders empty**.
- It is in-memory only: a 50-entry ring buffer (`MAX = 50`), lost on restart.
- Its `path` union (`A-digest|A-test|B-chat`) is leftover dev scaffolding, not
  a production taxonomy.
- `maskKey` / `maskHeaders` are good secret-redaction helpers that the vault
  does **not** use.

### 2.3 Gaps against professional practice

| Layer | Purpose | Status |
|---|---|---|
| 1. Traces | verbatim per-call record | **partial** — no `contextId` from the router, so a prompt and its output cannot be joined |
| 2. Latency & cost | duration, $/call, tokens | **missing** — no `latency`/`cost` column anywhere in the vault |
| 3. Aggregation | p95 latency, error rate, cost per provider/feature | **missing** — `vaultStats()` only does `COUNT(*) GROUP BY` |
| 4. Eval & regression | golden outputs, scores, "did this change regress?" | **missing** — no harness in the repo |

Additional defects found:

- **The routing decision is never persisted.** `runWithFallback`
  (`router.ts:115`) logs the chain to `console.log` only
  (`[PROV] chain[0]: …`). `sink()` fires only at `prompt`, `thinking`,
  `output`, `error` (lines 143, 152, 154, 171). **Why** a provider was
  selected or skipped never reaches the vault — despite failover routing
  being the system's headline feature.
- **`currentFeature` is a race.** `router.ts:20` declares a module-level
  `let currentFeature = 'default'`, mutated per call. Two concurrent requests
  overwrite it, so `feature` can be attributed to the wrong call.
- **Per-attempt outcomes are invisible.** `errors[]` at `router.ts:134`
  distinguishes `'timeout' | 'failure'` but that distinction is only
  summarised at the end; individual attempt outcomes are not events.

## 3. Target architecture

**One write path, one table.** The vault becomes the single persistent sink.
`providerLog.ts` is demoted to a re-export/adapter over the vault — its richer
record shape becomes the vault's richer record shape, and its `maskKey` /
`maskHeaders` helpers are adopted for anything persisted. No second ring
buffer.

```
callProvider / runWithFallback
        │
        ├─ traceId (per request, passed explicitly — NOT module state)
        ├─ t0 = performance.now()
        ├─ sink(route-decision)   ← chain + skip reasons, BEFORE attempting
        ├─ for each attempt i:
        │     sink(attempt) start → … → sink(attempt) ok|error + latencyMs
        ├─ sink(prompt | thinking | output)   ← existing, now with traceId
        └─ sink(response)                     ← durationMs, cost, http status
                    │
                    ▼
        ai_debug_events  (single table, additive columns)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  DebugVaultPanel        ai-debug:insights  (new aggregation)
  (rows + new cols)      p50/p95, error rate, cost/provider/feature
```

## 4. Work items

### Phase 1 — schema + tracer (makes traces trustworthy)

1. **Additive migration** in `aiDebugVault.ts`. New nullable columns:
   `latency_ms INTEGER`, `cost_usd REAL`, `http_status INTEGER`,
   `parse_ok INTEGER`, `streamed INTEGER`, `route_decision TEXT`,
   `attempt_index INTEGER`, `trace_id TEXT`.
   Follow the repo's existing convention — `try { db.exec('ALTER TABLE …') } catch {}`
   inside `initVault` (see `src/main.ts:2490` for the pattern). **Never**
   `DROP`/`REPLACE` the table.
   New indexes: `(feature, epoch_ms)`, `(provider, epoch_ms)`,
   `(event, epoch_ms)`, `(trace_id, epoch_ms)`.
2. **Trace ids.** Add `traceId` and `attemptIndex` to the `DebugEvent` type.
   Generate a trace id in the **caller** and thread it through
   `runWithFallback` as an explicit parameter. Do not use module-level state.
3. **Kill the `currentFeature` race.** Replace the mutable module-level
   `currentFeature` (line 20) with a `feature` parameter on `sink()` /
   `runWithFallback`. All 6 `sink()` call sites and every caller of
   `runWithFallback` (~50 across `src/main.ts`, `goal-handlers.ts`,
   `finance-handlers.ts`, `presentation/index.ts`, `contentEngine/index.ts`,
   `learn/ai/providerStream.ts`) must be updated consistently.
4. **Latency + cost.** `performance.now()` around each attempt and the whole
   call. Cost from a per-model rate table (new file
   `src/services/providers/modelPricing.ts`); leave `cost_usd` NULL when the
   model is unknown rather than guessing 0.
5. **Redaction.** Anything persisted goes through `maskHeaders` /
   `maskKey`. Payloads contain raw prompts, which may contain user secrets.

### Phase 2 — make routing visible (the highest-value item)

6. **`route-decision` event**, emitted once before the attempt loop, carrying
   `{ chain: [{index, provider, model}], skipped: [{provider, reason}],
   feature }`. `buildChain`'s skip reasons must be captured, not just the
   surviving chain.
7. **Per-attempt `attempt` events** with `attemptIndex`, `provider`, `model`,
   `latencyMs`, `httpStatus`, `ok:boolean`, and `errorKind:'timeout'|'failure'`.

### Phase 3 — aggregation UI

8. **`vaultInsights(opts)`** in `aiDebugVault.ts`, same filter shape as
   `vaultQuery`. SQLite has no `percentile_cont`, so compute percentiles in JS
   from an ordered `latency_ms` column, or use the
   `ORDER BY … LIMIT 1 OFFSET n` index trick. Must return: per-provider and
   per-feature call counts, error rate, p50/p95 latency, total and mean cost,
   total tokens.
9. **IPC `ai-debug:insights`** in `src/main.ts` + `aiDebugInsights` in
   `src/preload.ts`.
10. **Insights surface in `DebugVaultPanel.tsx`** — a summary strip above the
    table reusing the existing source/event/search filters. Must cover all
    four states: loading, empty, error, populated.

### Phase 4 — eval harness (separate, larger; do not bundle with 1–3)

11. Golden-set store: per-feature frozen input→expected-shape fixtures.
12. Scoring: structural checks (valid JSON, required fields) plus optional
    LLM-as-judge, and a run history so runs are comparable.
13. A "compare to last run" view. Until this ships, do not claim eval exists.

### Also required (small, do not skip)

14. `ProviderDiagnostics.tsx` currently renders a permanently empty state
    because `pushDiag` is never called. Either delete the component and its
    `SettingsPage.tsx:6319` mount, or re-point it at the vault. Deleting is
    preferred — Phase 1–3 supersede it. It also has **no page manifest**,
    which violates the page-registry rule in `AGENTS.md` §5d.

## 5. Result specification (acceptance criteria)

A change is done only when **all** of these are objectively verifiable.

### Schema
- [ ] `PRAGMA table_info(ai_debug_events)` lists all 8 new columns.
- [ ] Existing rows survive; `SELECT COUNT(*)` before ≥ after (additive only).
- [ ] The 6 original `CAPTURE_POINTS` sources still log exactly as before.
- [ ] No `DROP TABLE`, no `DELETE FROM` without `WHERE`, no `REPLACE INTO`
      against `ai_debug_events`.

### Tracer
- [ ] Two concurrent requests with different features produce rows tagged with
      **their own** feature and **their own** `trace_id` (proves the race is gone).
- [ ] Every `runWithFallback` call emits ≥1 `route-decision` row.
- [ ] Every failed attempt emits an `attempt` row with
      `error_kind IN ('timeout','failure')`; every success emits one with
      `latency_ms > 0`.
- [ ] A prompt row and its output row share one `trace_id` and are joinable.

### Aggregation
- [ ] `ai-debug:insights` returns non-zero p95 for a synthetic 100-row fixture
      with known latencies (e.g. p50=50ms, p95=95ms — assert to ±1ms).
- [ ] Error rate = failed attempts / total attempts, verified against a
      fixture with a known ratio.

### UI
- [ ] `DebugVaultPanel` shows latency and cost columns, populated from real rows.
- [ ] Insights strip renders loading / empty / error / populated correctly.
- [ ] No secret appears in any persisted payload: a fixture prompt containing
      `sk-ant-test-SECRET` must not appear in the DB unredacted.

### Constraints (repo invariants — violating these is a regression)
- **Do not run `npm run build`.** Only CZ builds (`AGENTS.md` §0-0). Verify with
  scoped checks instead.
- Do not run destructive git operations (`checkout`/`restore`/`reset --hard`).
- Do not drop or rename tables; migrations are additive and wrapped in try/catch.
- Preserve CRLF line endings in existing files.
- Never reorder PTY events. Never remove the `#df-fallback` block.
- Do not add a third logging system, and do not keep a parallel in-memory ring.

### Verification without building
```bash
npx esbuild <changed files> --bundle --outfile=/dev/null \
  --alias:@=./src --external:electron --external:react --log-level=warning
npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "aiDebugVault|router\.ts|DebugVaultPanel"
# write a probe that PRINTS the new columns, a p95, and an error rate
```

## 6. Out of scope

- Changing provider selection policy or failover order.
- The ai-router service itself (separate repo:
  `/home/clementzhao/Documents/COMPUTAH SAYENCE/ai-router`).
- Phase 4 eval harness, unless explicitly requested.

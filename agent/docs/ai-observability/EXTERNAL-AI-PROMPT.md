# Copy-paste prompt — AI Observability (Phases 1–3)

> Paste everything inside the fence below into ChatGPT / Claude / any external AI.
> Full detail behind it: `AI-EVAL-SPEC.md`. Give the external AI repo access too,
> or paste this alone — it is self-contained.

```
You are improving AI observability in DeskFlow, an Electron + React +
better-sqlite3 desktop app at the repo root. Read
`agent/docs/ai-observability/AI-EVAL-SPEC.md` FIRST — it contains the full
verified inventory of what exists today, the target architecture, work items,
and acceptance criteria. Everything below is a summary; the spec is
authoritative.

GOAL
Right now the app can show you WHAT an AI call said, but not how long it took,
what it cost, why the router picked the provider it picked, or whether any of
that got worse after a change. We have all the raw material — it is just not
connected. Build the observability layer (Phases 1-3 of the spec). Phase 4
(eval harness) is explicitly OUT OF SCOPE.

THE CENTRAL FINDING
There are TWO disconnected diagnostic systems and the fix is to unify them,
not add a third:

1. `src/services/aiDebugVault.ts` — persistent SQLite table
   `ai_debug_events` (25k rows), with query/stats/export/clear IPC and a real
   UI at `src/components/ai/DebugVaultPanel.tsx`. It is wired into the
   provider router via `setDebugSink`. But its schema has NO latency and NO
   cost column, the router never populates `contextId`, and
   `vaultStats()` only does `COUNT(*) GROUP BY`.

2. `src/services/providers/providerLog.ts` — a much RICHER record shape
   (`durationMs`, `parse.ok/extracted/discarded`, `error.status`, `streamed`)
   with good `maskKey`/`maskHeaders` secret redaction. It is COMPLETELY DEAD:
   `pushDiag` has zero call sites, so the `ProviderDiagnostics` component
   mounted at `src/pages/SettingsPage.tsx:6319` polls forever and always
   renders empty. It is also in-memory only (a 50-entry ring buffer).

Make the vault the single persistent sink. Fold providerLog's richer fields
and its redaction helpers into it. Do not keep a parallel ring buffer.

THE THREE HIGHEST-VALUE FIXES
a) PERSIST THE ROUTING DECISION. `runWithFallback` in
   `src/services/providers/router.ts` logs its provider chain to
   `console.log` only. `sink()` fires just at prompt/thinking/output/error.
   So the single most important question — why did failover pick THIS
   provider and skip those? — is answered nowhere durable. Emit a
   `route-decision` event before the attempt loop carrying the full chain AND
   each skipped provider's reason.

b) ADD LATENCY + COST. No duration and no cost exist anywhere in the vault.
   Time each attempt with `performance.now()`, and price it from a new
   per-model rate table (leave NULL when unknown — never guess 0).

c) FIX A CONCURRENCY RACE. `router.ts:20` has a module-level
   `let currentFeature`, mutated per call, so two concurrent requests can
   attribute `feature` to the wrong call. Replace it with an explicit
   parameter and thread a per-request `traceId` through `runWithFallback`
   so a prompt row and its output row can finally be joined.

HARD CONSTRAINTS (violating these is a regression, not a style choice)
- Do NOT run `npm run build`. Only the human builds. Verify with scoped
  checks: `npx esbuild <files> --bundle --outfile=/dev/null
  --alias:@=./src --external:electron --external:react`, plus
  `npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep -E "<your files>"`
  (this repo has thousands of PRE-EXISTING type errors — a bare `tsc` run and
  any repo-wide error count are meaningless).
- Migrations must be ADDITIVE and wrapped in try/catch, following the existing
  `try { db.exec('ALTER TABLE …') } catch {}` pattern. Never DROP or REPLACE
  a table. Existing rows must survive.
- Do NOT run destructive git commands (checkout, restore, reset --hard,
  clean). Never `git add -A`.
- Preserve CRLF line endings in existing files.
- Payloads contain raw user prompts and may contain secrets. Anything you
  persist must go through `maskHeaders`/`maskKey`.
- Cover all four UI states on anything new: loading, empty, error, populated.

DELIVER
1. The implementation for Phases 1-3.
2. A probe that PRINTS real numbers as proof: the new columns present, a known
   p50/p95 computed correctly, a known error rate computed correctly, and a
   demonstration that two concurrent requests get distinct trace_ids and
   correct feature tags.
3. A list of which acceptance criteria in section 5 of the spec you verified,
   and which you could not — stated honestly. Do not claim a check passed
   that you did not run.
```

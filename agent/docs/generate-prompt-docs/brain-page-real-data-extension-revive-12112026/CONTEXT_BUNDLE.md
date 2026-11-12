# CONTEXT BUNDLE — Brain Page Real-Data Verification + Extension Revival

> Round: continuation of `brain-2d-connections-extension-debug` (Round 0 spec = `RESULT(9).md`, implemented 2026-11-12).
> Target AI: Architect. You have NO codebase access — everything you need is inline here.
> All numbers below are MEASURED against the live profile DB `/home/clementzhao/.config/RHEO/deskflow-data.db` on 2026-11-12 (read-only), not estimated.

---

## 1. MEASURED STATE — what is real vs what is still broken

### 1.1 Live DB (the profile the running Electron app writes)

| Measurement | Value | Meaning |
|---|---|---|
| `context_entities` | 37 | graph nodes exist |
| `context_facts` | 220 | facts exist |
| `context_facts` with `object_id NOT NULL` | **0** | **ZERO real edges in stored data** |
| `context_episodes` | 256 | episodes exist, by source: external_ai=143, deskflow_ai=33, goals=33, connector=14, deadlines=10, finance=10, terminal=8, life_phase=5 |
| `ai_context_captures` | 143 (chatgpt 72, claude 70, qwen 1) | extension DID work once |
| captures `episode_status='episode_written'` | **0** | all 143 still `'pending'` |
| Newest capture `timestamp` | **2026-08-27T20:44** | **extension has been DEAD ~11 weeks** |
| Newest external_ai episode | ep_1787863441186_o46ut3, occurred 2026-08-27 | episodes WERE written from captures once, but episode_status was never updated |

**Interpretation (the honest reading):**
1. The extension → app receiver chain WORKED historically (143 captures landed).
2. Capture → episode chain WORKED once (143 `external_ai` episodes created), but the `episode_status` bookkeeping update never ran — 143 stranded `pending` rows.
3. Episode → connected facts (object_id) NEVER happened: 0 of 220 facts carry an object link. The graph's connectivity is 100% synthetic co-occurrence.
4. The extension itself stopped sending on 2026-08-27. The app's receiver is ALIVE right now (verified: `curl http://127.0.0.1:54321/foreground-app` returns live foreground data). So the break is in the EXTENSION, not the server.
5. Everything implemented in source since RESULT(9) is **unbuilt** — the running app still runs the old bundle. Every runtime symptom CZ sees is the OLD code until he rebuilds.

### 1.2 What shipped in source since RESULT(9) (verified by grep, scoped tsc = 0 errors)

| Change | File(s) | Marker to verify |
|---|---|---|
| Main-process graph assembly (real + synthetic edges, caps: ≤3 synth/entity/episode, ≤200 total) | `src/main/ai/graphAssembler.ts` (new, 200 lines) | `assembleGraph` |
| Canonical predicate registry | `src/main/ai/predicates.ts` (new) | `PREDICATES` |
| LLM-free concept extractor (tech tokens + capitalised phrases, cap 24) | `src/main/ai/conceptExtraction.ts` (new) | `extractConcepts` |
| Concept linking with objectId at capture time | `src/main/ai/episodeWriters.ts` | `writeAiContextEpisode` now calls `addFact(..., objectId)` |
| objectId resolution in LLM extraction | `src/main/ai/entityExtraction.ts` | `applyExtraction` resolves via `findEntities` |
| `brain:get-graph` IPC | `src/main.ts` (~line 18061 block) | `brain:get-graph` |
| Structured logger: ring 500 + console mirror `[BRAIN-<COMP>]` + file `agent/logs/brain.log` rotate 10MB | `src/main/ai/brainLogger.ts` (new) | `init/getEntries/setLevel` |
| Log IPCs: `brain:logs`, `brain:log-level`, `brain:logs-clear`, `brain:logs-export` | `src/main.ts` | same strings |
| `brain:health` IPC + HTTP `GET /brain/health` | `src/main.ts` | `brain:health` |
| `brain:evaluate` IPC — 9 checks incl. edges_exist, no_orphan_facts, extraction_success_rate, signal_decay_ran, profile_fresh, embeddings_coverage, mcp_server_up | `src/main.ts` | `brain:evaluate` |
| `brain:run-extraction`, `brain:export-subgraph`, `brain:enrich-prompt` IPCs | `src/main.ts` | same strings |
| `[BRAIN-EXT]` capture logging in the POST /ai-context chain | `src/main.ts` (~23340) | `capture.received`, `capture.inserted` |
| Renderer consumes `brain:get-graph` (client-side assembly deleted) | `src/features/warmth/self/SelfOrchestrator.tsx` (`loadGraphData`) | `api.brainGetGraph?.(` |
| Selection highlight fix (white ring r+7 + 2.5px stroke, NO persistent amber fill; firing halo unchanged) | `src/features/warmth/context-brain/BrainGraph.tsx` | ring in draw |
| Single monotonic clock `now()` for the whole avalanche system | `src/features/warmth/context-brain/physics/avalanche.ts` | `export function now()` |
| ActivityFeed honest states (glow-only activity, cascade summary line, ↻ Replay last cascade, real empty state) | `src/features/warmth/context-brain/ActivityFeed.tsx` | `onReplay`, `cascadeSummary` |
| goal/finance/deadline episodes were silently never written (`episodeWriters` undeclared) | `src/main/ai/goal-handlers.ts`, `finance-handlers.ts` | `require('../../main/ai/episodeWriters')` |
| preload + types for ALL new endpoints | `src/preload.ts`, `src/types/deskflow-api.d.ts` | `brainGetGraph/brainLogs/brainEvaluate/brainExportSubgraph/brainEnrichPrompt/brainRunExtraction` |

### 1.3 What did NOT ship (open items from RESULT(9))

- Dedicated `/brain` page + `src/pages/registry/pages/brain.ts` manifest — **NOT created**. `brain`/`graph`/`profile` hashes map to the LifePage `self` tab (`src/features/warmth/LifePage.tsx:204` `tabMap`).
- BrainHealthPanel / BrainDebugPanel UI — **NOT created** (the IPCs exist; no UI consumes them except nothing yet).
- Signals supersession engine, embeddings (semantic search), profile rebuild, MCP new tools, retrieval budget — **NOT implemented** (these need `userContextService.ts`, `embeddingService.ts`, MCP server file, chat send path — none read yet).

---

## 2. THE DUAL-UI PROBLEM (layout/content question CZ asked)

The "brain page" is actually THREE surfaces with different layouts, one dataset:

### 2.1 `SelfOrchestrator` — LifePage → Self tab (THE revamped one)
`src/features/warmth/self/SelfOrchestrator.tsx`. Layout (real, audited):
```
<div data-section="life.self.brain">                      (NeuralFlow ambient, aria-hidden, z-0)
  <header> masthead: title + 4 StatTiles (Episodes/Entities/Facts/All-time,
           real via brainStats IPC, loading/errored states) + Refresh button
           statsError line: "Totals unavailable — the graph below is still live."
  <stage>  graph FULL WIDTH, height clamp(320px, 52vh, 420px)
           data-section="life.self.graph" → <BrainVisualization> (3 shells
           empty/loading/error + populated <BrainGraph> 2D canvas)
  <row>    Reflection card (life.self.reflection) + ActivityFeed (life.self.activity,
           real avalanche events, cascade summary + replay)
  <row>    Identity card (life.self.identity + legend) + Governance card
           (life.self.governance, "Open in AI Assistant")
```
Data: nodes/links from `brain:get-graph` (main-process, real DB rows). Stats real. Activity real (from `computeCascade`). NeuralFlow is decorative but aria-hidden + reducedMotion-aware — acceptable ambience, not data.

### 2.2 `ContextGraphView` / `BrainSurface` — a SECOND parallel brain UI
`src/features/warmth/context-brain/ContextGraphView.tsx` is mounted by `src/components/ai/chat/BrainSurface.tsx` (AI chat page, tabs: search=`ContextRetrievalPanel`, trail=`ExternalAITrail`, manage=`BrainManagementView`). It renders its own layout with `ExternalAITrail` + `BrainManagementView`. Comment in `ContextGraphView.tsx:329`: *"second CanvasGraph running beside a decorative background"* — i.e. the code itself admits duplication.

### 2.3 Dead components (built, fed, mounted by NOTHING)
| Component | Evidence |
|---|---|
| `CanvasGraph.tsx` | only referenced in a comment in ContextGraphView:329 |
| `BrainGrowthChart.tsx` | zero importers (grep across src/) |
| `EntityGroups.tsx` | only referenced from ContextGraphView internals (itself only mounted via BrainSurface) |

### 2.4 There is no 3D
`BrainVisualization` is 2D canvas (`getContext('2d')`). No three.js/webgl anywhere in `context-brain/`. "2D 3D" as CZ phrased it = the 2D graph plus the canvas shells; no 3D view exists. Decision needed: is 3D wanted at all, or is "2D done right + honest states" the answer?

**The question for you:** should the app have ONE brain surface (a real `/brain` route with a manifest, absorbing BrainSurface's search/trail/manage tabs) or two purposeful ones (Life-Self = visual brain; AI-chat BrainSurface = tools)? Current state is the worst of both: duplicated layouts, duplicated names, dead files, no manifest, and `npm run validate:pages` does not know any of it.

---

## 3. THE EXTENSION CONNECTION (measured end to end)

### 3.1 The POST receiver — actual current code (`src/main.ts` ~23332)
```ts
else if (req.method === 'POST' && req.url === '/ai-context') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const payload = JSON.parse(body);
            const captures = Array.isArray(payload?.captures) ? payload.captures : [];
            try { require('./main/ai/brainLogger').info('EXT', 'capture.received', { count: captures.length, providers: [...new Set(captures.map((c: any) => c.provider))] }) } catch {}
            if (!captures.length) { /* 200 {received:0} */ }
            const stmt = db.prepare(`INSERT OR IGNORE INTO ai_context_captures
                (provider, messages, url, title, source, timestamp, dedup_key, captured_at, is_manual)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const cap of captures) {
                const messagesJson = JSON.stringify(cap.messages || []);
                if (messagesJson.length > 300000) continue;
                const dedupKey = cap.captureKey || `${cap.provider}:${cap.url}:${(cap.messages || []).length}`;
                const existing = db.prepare('SELECT id FROM ai_context_captures WHERE dedup_key = ?').get(dedupKey);
                if (existing) continue;
                const isManual = cap.source === 'manual' ? 1 : 0;
                const info = stmt.run(cap.provider || 'unknown', messagesJson, cap.url || null,
                    cap.title || null, cap.source || 'fetch-intercept',
                    cap.timestamp || new Date().toISOString(), dedupKey, Date.now(), isManual);
                // → then writes episode via writeAiContextEpisode, and on success:
                //   db.prepare(`UPDATE ai_context_captures SET episode_status='episode_written' WHERE id=?`).run(...)
                //   brainLogger.info('EXT', 'capture.inserted', { id, dedupKey })
```

### 3.2 Capture schema (live DB)
```sql
CREATE TABLE ai_context_captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, messages TEXT NOT NULL,
  url TEXT, title TEXT, source TEXT DEFAULT 'fetch-intercept', timestamp TEXT,
  dedup_key TEXT, captured_at INTEGER DEFAULT (unixepoch()*1000),
  nickname TEXT, note TEXT, tags TEXT, group_id INTEGER, pinned INTEGER DEFAULT 0,
  is_manual INTEGER DEFAULT 0, episode_status TEXT DEFAULT 'pending', error_message TEXT);
```

### 3.3 The extension side (what we know)
- Packages exist: `release/deskflow-bridge/{deskflow-bridge-chrome.xpi,deskflow-bridge-firefox.xpi,…}`; manifest `gecko.id = deskflow-bridge@rheo.app`, **no `update_url`** (never published).
- Endpoint hardcoded in the extension: `127.0.0.1:54321` and `localhost:54321` (both appear in the built background script).
- Firefox install path = `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → the extension is REMOVED on every browser restart. Last capture 2026-08-27 is consistent with a browser restart after which it was never reloaded.
- Port 54321 ownership: the app's browser-ingest server when the app runs; `rheo-tracker` daemon claims it when the app is closed. Receiver answers correctly right now.

### 3.4 What is broken, ranked
1. **Extension not installed persistently** → dies on every restart. Needs: permanent install (Firefox: `extensions.webextensions.uuid` policy or AMO unsigned-allowed + `xpinstall.signatures.required=false` on ESR/dev; Chrome: unpacked load + README), plus an in-app extension-status card that shows last-capture age and surfaces `GET /brain/health`-style diagnostics.
2. **143 stranded `pending` captures** → need a one-shot backfill job: for each `episode_status='pending'` capture, run the same `writeAiContextEpisode` path the live handler now uses, then set `episode_status` + `error_message` on failure. Must be idempotent (dedup by dedup_key) and gated behind `brain:run-extraction`-style IPC.
3. **No watchdog** → nothing alerts when captures stop. Cheapest honest fix: a `captures.lastReceivedAt` value in `context_scheduler_state` written on every accepted capture; `brain:health` reports `daysSinceLastCapture`; Self page stat tile turns amber >3 days, red >14.

---

## 4. IPC CONTRACT YOU MUST DESIGN AGAINST (already implemented; additive only)

| Channel | In | Out |
|---|---|---|
| `brain:get-graph` | `{maxNodes?, maxFacts?, includeSynthetic?, types?}` | `{status:'empty'|'populated'|'error', nodes:AssembledNode[], links:AssembledLink[], stats, truncated, error?}` |
| `brain:health` | — | `{status, metrics, humanReason}` |
| `brain:evaluate` | — | `{pass, checks:[{name, pass, skipped, value, threshold, detail}]}` (9 checks) |
| `brain:logs` | `{since?, level?, component?, limit?}` | `{entries:[{ts,level,component,msg,payload}]}` |
| `brain:log-level` | `{level}` | `{level}` |
| `brain:logs-clear` / `brain:logs-export` | — | `{ok}` / `{path}` |
| `brain:run-extraction` | — | `{processed, ok, error?}` |
| `brain:export-subgraph` | `{rootId?, entityIds?, depth?, tokenBudget?}` | `{text, entities, facts, episodes, tokensEst}` |
| `brain:enrich-prompt` | `{prompt, tokenBudget?}` | `{enriched, usedFacts, tokensEst}` |
| HTTP `GET /brain/health` | — | same as IPC |

`AssembledNode`: `{id,name,type,state:'active'|'blocked'|'neutral',degree,facts:[{predicate,value}],source,x,y,z,vx,vy,vz,lastFiredAt?,lastFiredPeak?}`. `AssembledLink`: `{source,target,predicate,synthetic?}`.

DB schema facts: `context_entities(id,type,name,aliases,source,state)`, `context_facts(id,subject_id,object_id,object_literal,predicate,source_episode_id,valid_to,confidence)`, `context_episodes(id TEXT PK, source, source_ref, content, occurred_at, ingested_at, metadata)` — note: **no `created_at`** (use `ingested_at`/`occurred_at`); `ai_context_captures` as §3.2.

---

## 5. CONSTRAINTS (hard)

1. **Agents never build.** CZ builds (`npm run build`). Design for "source correct + scoped tsc/esbuild clean" as the agent's verification ceiling; runtime verdicts must be named NOT TESTED.
2. **Additive only.** Do not propose deleting UI/features without an explicit removal list for CZ to confirm.
3. **Page manifest rule (repo law, §5d):** every new page/tab needs `src/pages/registry/pages/<name>.ts` + registration + `data-section` anchors + `npm run validate:pages`. Never hand-edit palette/tutorial registries.
4. **One DB writer.** No direct DB edits; changes ship as code through app-owned handlers.
5. LAMINAR design tokens (zinc surfaces, ONE signal hue, radii 8/12/pill, no glass on chrome, reduced-motion honored).
6. `context_episodes` has NO `created_at` column; `ai_context_captures` has NO `prompt_text` (it's `messages` JSON).

## 6. RAW REQUEST (verbatim, CZ 2026-11-12)

> "i want you t cehck whether the revamp for the 2d 3d and the LAYOUT and the content of the BRAIN PAGE MAKE SENSE ADN REVAMPED? because previously, theres nothing owkring proeprly, evrything is gimmick, nothingi s using the realand dynamic data. and also, how is the connection to the extension from the browser of the ai chats and the overall evrhting inthe app?"

<aside>
⚙️

**Implementation-grade backend spec** for the Lyceum "Learn" module. This makes the Lyceum v0.1 — Design Critique & .ldoc Spec buildable: data model, IPC contracts, validator, retrieval, tutor algorithm, mastery math, and prompts. Pairs with the Frontend Design Spec (linked from the design doc).

Still design/spec only — **no app code is written until you say “go.”** Reuses DeskFlow's existing Electron + SQLite + AI-provider plumbing rather than adding new stacks.

</aside>

## 0 · How to read this

Every section is written so an implementing model/engineer can build it directly. Where a value is a tunable, it's marked `DEFAULT → x`. Where something reuses existing DeskFlow infra, it's marked ♻️.

## 1 · Tech stack & module boundaries

| Concern | Choice | Notes |
| --- | --- | --- |
| Runtime | Electron (existing) ♻️ | New code lives in main + renderer + preload |
| Language | TypeScript (strict) | Match repo config |
| Store | SQLite (better-sqlite3, the finance DB) ♻️ | One new schema namespace `learn_*` |
| Vectors | `sqlite-vec` extension (fallback: `hnswlib-node`) | Local, in-process; **not** pgvector |
| Embeddings | DeskFlow AI provider's embedding endpoint ♻️ | Cache at build-time |
| LLM calls | DeskFlow AI provider abstraction ♻️ | Two roles: `small` (tutor) + `big` (escalation/authoring) |
| Validation | `ajv` (JSON Schema 2020-12) | Compiles `ldoc-1.0` once |
| Hashing | Node `crypto` sha256 | Node + block canonicalization |

**Layer rule (from v0.1):** Content / Knowledge / Interaction stay decoupled. The backend exposes them as three services behind one IPC facade: `ContentService`, `GroundingService`, `TutorService`, plus `ProgressService` and `ImportService`.

## 2 · Codebase layout

```
src/
  main/
    learn/
      index.ts                # registers IPC handlers
      import.service.ts        # parse → validate → hash → store → embed
      content.service.ts       # CRUD over lessons/nodes/blocks
      grounding.service.ts     # packet retrieval + vector search + scope gate
      tutor.service.ts         # answer → self-check → assess → escalate
      progress.service.ts      # evidence → mastery estimate → spaced rep
      validator/
        ldoc.schema.json       # the v0.1 schema (source of truth)
        validate.ts            # ajv + DAG + link/visual/key rules
      db/
        migrations/00x_learn.sql
        repo.ts                # typed query layer
      ai/
        providers.ts           # ♻️ wraps existing provider; small|big|embed
        prompts.ts             # tutor/self-check/assess/author templates
  preload/
    learn.bridge.ts            # contextBridge: window.learn.*
  renderer/
    learn/                     # (see Frontend Design Spec)
  shared/
    learn/types.ts             # shared TS types (request/response DTOs)
```

## 3 · Data model — SQLite DDL

Store the full `.ldoc` as a JSON blob per lesson (source of truth) **and** normalize the parts needed for querying/retrieval/progress.

```sql
CREATE TABLE learn_lessons (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  part         INTEGER NOT NULL CHECK(part BETWEEN 0 AND 10),
  version      TEXT NOT NULL,
  summary      TEXT,
  authored_by  TEXT,
  doc_json     TEXT NOT NULL,           -- full validated .ldoc
  status       TEXT NOT NULL DEFAULT 'draft', -- draft|valid|published
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE learn_nodes (
  id             TEXT PRIMARY KEY,      -- node id, globally unique
  lesson_id      TEXT NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  mastery_target TEXT NOT NULL,         -- L0..L5
  content_hash   TEXT NOT NULL,
  ord            INTEGER NOT NULL,
  blocks_json    TEXT NOT NULL,         -- array of typed blocks
  grounding_json TEXT NOT NULL          -- the packet
);

CREATE TABLE learn_node_prereqs (
  node_id    TEXT NOT NULL REFERENCES learn_nodes(id) ON DELETE CASCADE,
  prereq_id  TEXT NOT NULL,
  PRIMARY KEY (node_id, prereq_id)
);

CREATE TABLE learn_sources (
  id        TEXT NOT NULL,             -- source_id, unique per node
  node_id   TEXT NOT NULL REFERENCES learn_nodes(id) ON DELETE CASCADE,
  url       TEXT NOT NULL,
  title     TEXT,
  kind      TEXT,
  license   TEXT,
  retrieved TEXT,
  PRIMARY KEY (node_id, id)
);

-- One retrievable chunk per grounding fact AND per prose/quiz block.
CREATE TABLE learn_chunks (
  rowid     INTEGER PRIMARY KEY,
  node_id   TEXT NOT NULL REFERENCES learn_nodes(id) ON DELETE CASCADE,
  block_id  TEXT,                      -- null for grounding-fact chunks
  kind      TEXT NOT NULL,             -- fact|prose|quiz|misconception
  text      TEXT NOT NULL,
  source_id TEXT
);

-- sqlite-vec virtual table; one row per learn_chunks.rowid
CREATE VIRTUAL TABLE learn_vec USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[768]                 -- dim = provider's embed dim
);

CREATE TABLE learn_progress (
  node_id    TEXT PRIMARY KEY REFERENCES learn_nodes(id) ON DELETE CASCADE,
  level      TEXT NOT NULL DEFAULT 'L0',
  belief_json TEXT NOT NULL,           -- Beta(α,β) per level, see §10
  stability  REAL NOT NULL DEFAULT 0,  -- spaced-rep stability (days)
  last_seen  TEXT,
  due_at     TEXT
);

CREATE TABLE learn_evidence (
  id           INTEGER PRIMARY KEY,
  node_id      TEXT NOT NULL REFERENCES learn_nodes(id) ON DELETE CASCADE,
  ts           TEXT NOT NULL,
  source       TEXT NOT NULL,          -- tutor|quiz|self-report
  target_level TEXT NOT NULL,
  outcome      TEXT NOT NULL,          -- demonstrated|partial|wrong
  detail_json  TEXT
);

CREATE TABLE learn_tutor_cache (
  key         TEXT PRIMARY KEY,        -- hash(node_id + question_cluster + content_hash)
  node_id     TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  model       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE learn_media_cache (
  url          TEXT PRIMARY KEY,
  status       INTEGER,                -- last HTTP status
  content_type TEXT,
  checked_at   TEXT,
  local_path   TEXT                    -- optional cached copy
);

CREATE INDEX idx_nodes_lesson ON learn_nodes(lesson_id);
CREATE INDEX idx_chunks_node  ON learn_chunks(node_id);
CREATE INDEX idx_progress_due ON learn_progress(due_at);
```

## 4 · Import pipeline

`ImportService.import(ldocJson)` → ordered, transactional:

```
1. parse JSON                      (fail → ParseError)
2. validate(ldoc)                  (§5; fail → ValidationReport, abort)
3. for each node: content_hash = sha256(canonicalize(node))
4. diff vs existing hashes → classify minor|major (§6)
5. BEGIN TX:
     upsert lesson, nodes, prereqs, sources
     rebuild learn_chunks for changed nodes
   COMMIT
6. embed new/changed chunks → learn_vec (batched)
7. media precheck: HEAD each image/video → learn_media_cache
8. apply migration policy to learn_progress (§6)
9. return ImportResult { lessonId, nodes, warnings[], validation }
```

Import is **idempotent**: re-importing identical JSON is a no-op (hashes match).

## 5 · Validator spec (the gate)

`validate(ldoc): ValidationReport` runs all rules; returns every failure (don't stop at first).

| Rule | Implementation | Severity |
| --- | --- | --- |
| Schema valid | `ajv` against `ldoc-1.0` | error |
| Prereq DAG | Kahn's algo over `node_prereqs`; cycle → fail | error |
| Prereq ids resolve | every `prereq` ∈ node ids (this lesson or published) | error |
| Visual rule | node `mastery_target ≥ L2` ⇒ ≥1 `mermaid`/`image`/`widget` | error |
| Media resolves | HEAD each `image.url`/`video.ref`; 2xx/3xx required; else require `fallback_url` | error |
| Provenance | every `image`/`video` has `source`+`license`+`alt` | error |
| Fact grounding | every `must_know.source_id` resolves to a `sources[].id` | error |
| Quiz keys | closed quiz has `answer_key`; open quiz has `rubric` | error |
| Widget safety | `template` ∈ registry w/ valid `params`; or `html`  • capability manifest | error |
| Scope present | every node `grounding.scope.includes` non-empty | error |
| Hash | recompute + store `content_hash` | info |
| Orphan blocks | block ids unique within node | warn |

`ValidationReport = { ok: boolean, errors: Issue[], warnings: Issue[] }`, `Issue = { rule, nodeId?, blockId?, message }`.

## 6 · Content hashing & migration

- **Canonicalize** a node = stable-stringify `{ blocks, grounding, mastery_target }` (sorted keys, normalized whitespace), then sha256.
- **Minor change** (prose typo, caption): cosine of node-embedding vs previous `≥ 0.92 DEFAULT` → keep `learn_progress` untouched.
- **Major change** (new/removed blocks, changed `mastery_target`, must_know delta): keep history but **flag node for re-assessment** (`due_at = now`, add evidence `outcome='wrong'? no` — instead set a `stale` marker in `belief_json`). Never silently wipe or inflate mastery.

## 7 · Grounding & retrieval

**Build-time:** for each node, create chunks from (a) each `must_know.claim`, (b) each `misconception` (wrong+correct), (c) each `prose` block, (d) each `quiz.q`. Embed → `learn_vec`.

**Query-time** `GroundingService.retrieve(nodeId, question)`:

```
q_vec = embed(question)
hits  = vec_search(q_vec, filter node_id=nodeId, k=8 DEFAULT)
retrieval_score = max(cosine(hits))           # 0..1
packet = { must_know, misconceptions, canonical_answers,
           scope, sources, top_chunks: hits }
scope_gate:
  out_of_scope = matches(question, scope.excludes)         # keyword/regex
                 OR retrieval_score < 0.35 DEFAULT
return { packet, retrieval_score, out_of_scope }
```

The **scope gate is deterministic** and runs *before* any model call (v0.1 Change 3).

## 8 · Tutor agent algorithm

`TutorService.ask({ nodeId, blockId?, question })`:

```
1. cacheKey = hash(nodeId + cluster(question) + node.content_hash)
   if hit → return cached
2. { packet, retrieval_score, out_of_scope } = grounding.retrieve(...)
3. if out_of_scope: escalate(big) with a 'scope-limited' notice; goto 6
4. answer = small.complete(ANSWER_FROM_PACKET, packet, question)
5. check = small.complete(SELF_CHECK, answer, packet)   // per-sentence entailed?
   if check.unsupported_sentences > 0 OR check.confident=false:
        answer = big.complete(ANSWER_FROM_PACKET, packet, question)
        recheck; if still unsupported → mark 'low-confidence' for UI
6. assessment = small.complete(ASSESS, { question, userPriorMsgs, packet, rubric })
7. cache + emit evidence(nodeId, assessment) → ProgressService
8. return { answer, citations: packet.sources used, scope, assessment,
            escalated, confidence }
```

**Model roles:** `small DEFAULT → a cheap fast model`; `big` only on escalation/low-confidence. Both calls are JSON-mode (constrained) so the UI gets structured output.

## 9 · Prompt templates (`ai/prompts.ts`)

```
ANSWER_FROM_PACKET (system):
  You are a tutor for ONE concept. Answer ONLY using FACTS below.
  If the answer isn't in FACTS, say you can't answer from this section.
  Be visual-first: prefer an analogy or a step list; cite fact ids [s1].
  FACTS: {must_know}  MISCONCEPTIONS: {misconceptions}
  SCOPE(includes): {scope.includes}  CANONICAL: {canonical_answers}
  QUESTION: {question}
  Return JSON: { answer_md, used_source_ids[], used_fact_ids[] }

SELF_CHECK (system):
  For each sentence in ANSWER, is it entailed by FACTS? 
  Return JSON: { confident: bool, unsupported_sentences: string[] }

ASSESS (system):
  Given the learner's question/answers and the node RUBRIC + mastery_target,
  rate demonstrated understanding.
  Return JSON: { target_level, outcome: demonstrated|partial|wrong,
                 rationale, suggested_next: deeper|reinforce|remedial }
```

## 10 · Mastery estimator (the math)

**Belief:** per node, keep a `Beta(α_L, β_L)` for each level L0–L5 (`belief_json`). Prior `Beta(1,1)`.

- On evidence targeting level L with outcome → score `s` = `demonstrated:1 | partial:0.5 | wrong:0`:
    
    `α_L += w·s ; β_L += w·(1−s)` with recency weight `w DEFAULT → 1`.
    
- **Decay** (called on access): pull α,β toward prior: `α ← 1+(α−1)·γ^{Δdays}`, `β ← 1+(β−1)·γ^{Δdays}`, `γ DEFAULT → 0.98/day`.
- **Current level** = highest L where `mean(Beta_L) ≥ 0.8 DEFAULT` AND `count_L ≥ 2` (corroboration). One reply never promotes.
- **Write-back:** map level → North Star L0–L5 tracker row shape so doc + app agree.

**Spaced repetition:** on each assessment, update `stability` (SM-2-style): success → `stability × ease (DEFAULT 2.0)`; failure → `stability × 0.5`. `due_at = last_seen + max(1, stability) days`. Dashboard surfaces nodes with `due_at ≤ now`.

## 11 · IPC API (the renderer contract)

All channels namespaced `learn:` via `contextBridge` → `window.learn.*`. All return `Promise<Result<T>>` where `Result = { ok:true, data:T } | { ok:false, error }`.

| Channel | Request | Response |
| --- | --- | --- |
| `learn:importLdoc` | `{ json }` | `ImportResult` |
| `learn:validate` | `{ json }` | `ValidationReport` |
| `learn:listLessons` | `{ part? }` | `LessonSummary[]` |
| `learn:getLesson` | `{ lessonId }` | `{ lesson, nodes }` (renderable) |
| `learn:getNode` | `{ nodeId }` | `{ node, progress }` |
| `learn:askTutor` | `{ nodeId, blockId?, question }` | `TutorAnswer` |
| `learn:submitQuiz` | `{ nodeId, blockId, response }` | `{ correct, explanation, evidenceId }` |
| `learn:getProgress` | `{ lessonId? }` | `ProgressMap` (per node level + due) |
| `learn:getDueReviews` | `{}` | `NodeRef[]` |
| `learn:getGraph` | `{ part? }` | `{ nodes, edges }` (prereq DAG) |
| `learn:revalidateMedia` | `{ lessonId }` | `MediaReport` |

Shared DTOs live in `shared/learn/types.ts` so renderer + main never drift.

## 12 · Generation pipeline (authoring backend)

Reordered per v0.1 (ground-first). Each stage is a `big`-model call with a typed output; the pipeline is a queue job, not user-blocking.

```
Architect(outline+DAG+targets) → Researcher(sources+media, provenance)
  → GroundingBuilder(source-backed packets) → Author(blocks FROM packet)
  → Visualizer(mermaid + widget templates) → Critic(run §5 validator)
  → on fail: loop back to Author with the ValidationReport
  → on pass: ImportService.import()
```

The content-generation **system prompt** (deliverable 2 in the brief) is authored against this schema; spec'd in a follow-up once you approve build order.

## 13 · Eval harness

- **Lesson eval:** run validator on a corpus; report pass rate, broken-link rate, visual-coverage, fact-grounding coverage.
- **Tutor eval:** golden Q→A set per node; metrics: groundedness (answer sentences entailed by packet), scope-leak rate (answered out-of-scope), escalation precision, latency, cache hit-rate.
- **Assessment eval:** compare estimator levels vs a held-out human rating; track calibration.

## 14 · Cross-cutting

- **Offline:** all reads + tutor cache work offline; live tutor/embeds degrade gracefully (queue + notice).
- **Errors:** typed error union per service; never throw raw across IPC.
- **Perf:** embeddings + validator run off the UI thread (worker); tutor answers cached; vector `k=8`.
- **Security:** widgets run in sandboxed `<iframe sandbox>` with a `postMessage` io-contract and a network allowlist from `capabilities`; free-form `html` widgets require explicit user enable.

## 15 · Build order → API mapping

| Step (from v0.1 §8) | Backend deliverables |
| --- | --- |
| 1 Renderer (static) | DDL + `importLdoc`  • `validate`  • `getLesson` |
| 2 Quiz/layer/progress | `submitQuiz`  • evidence + estimator + `getProgress` |
| 3 Widget templates | widget registry + capability sandbox contract |
| 4 Grounding + tutor | chunks/embeddings + `askTutor`  • scope gate + cache |
| 5 Generation | pipeline jobs + content-gen prompt |
| 6 Eval | harness + metrics |
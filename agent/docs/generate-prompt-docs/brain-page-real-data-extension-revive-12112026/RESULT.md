# RESULT — Brain Page Round 2: Layout Consolidation + Real-Data Backfill + Extension Revival

> Answering `prompt.md` + `CONTEXT_BUNDLE.md` (2026-11-12). I have no codebase access; every measured number below is quoted from the bundle, every code anchor I do not own is marked with the file I derived it from. Everything runtime is **NOT TESTED** until CZ builds.
>
> Status legend used throughout:
> - **[LOCKED]** — decided, implementable from this document alone.
> - **[PIN PENDING → 2b]** — design locked at contract level; the file-by-file pass lands in Round 2b after the REQUEST block (§1) is answered. Per the mandate I will not design against imagined APIs.
> - **[NOT TESTED]** — any runtime claim; verifiable only by CZ after `npm run build`.

---

## 0. Verdicts at a glance

| Mandate | Verdict | One-line rationale |
|---|---|---|
| M1 | **Two purposeful surfaces, no `/brain` route.** Life→Self is the visual brain; BrainSurface (AI chat) is the tools surface. 3 dead files + 2 duplicated sections on the deletion/dedupe confirm-list. | A new route would create a third layout — the exact disease being cured — and churn the hash mapping (`brain`/`graph`/`profile` → Self tab) that already works. |
| M2 | **New `brain:backfill` IPC** (not an extension of `brain:run-extraction`), two phases: link existing facts by object literal, then reconcile the 143 stranded captures with a duplicate-episode guard. Dry-run mandatory before the real run. | Backfill is a repair job with its own report shape; overloading `run-extraction` conflates its logs, metrics, and semantics. The 143 episodes already exist — a naive re-run would duplicate them, so reconciliation is match-first. |
| M3 | **Watchdog derived from `MAX(captured_at)`, no state row.** 5th Self stat tile ("Extension") + ExtensionStatusCard at the top of the trail tab + `docs/bridge-install.md`. Firefox honest answer: permanent unsigned install requires ESR/Dev/Nightly; Chrome: unpacked, persists. | `MAX(captured_at) WHERE is_manual=0` is exactly "last automatic capture accepted", works today for the 143 existing rows, and needs zero schema delta and zero new write paths — strictly simpler than the `context_scheduler_state` row sketched in the bundle. |
| M4 | **BrainHealthPanel + BrainDebugPanel live in BrainSurface → manage tab** (collapsed sections under BrainManagementView). | Per M1, manage is the canonical tools surface; the Self page stays a life page, not a log viewer. |
| M5 | **No 3D. 2D canvas is the permanent graph.** Kill the ambiguity permanently; one explicit reopen condition recorded. | 37 entities / ≤200 links; 3D adds occlusion and cost, zero legibility, fights reduced-motion, and re-opens the "gimmick" door CZ is closing. |
| M6 | **[PIN PENDING → 2b]** All five subsystems designed at contract level (§7): semantics, DB deltas, eval growth, IPC shapes. File-by-file plans land in 2b against the six requested files (§1). | The mandate's own rule: do not design against imagined APIs. `userContextService.ts`, `embeddingService.ts`, the MCP server file, and the chat send path have not been read. |

**Round 2a (this document, M1–M5) requires zero schema changes.** All DB deltas in this round are none; the additive CREATEs belong to M6/2b (§7.7).

---

## 1. ROUND 2B INPUTS — REQUEST block (opencode: answer with `CONTEXT:`)

These six files gate only **M6** (and two small pins inside M2/M1). M1–M5 are implementable now; do not block them.

```
REQUEST: src/main/ai/userContextService.ts
REQUEST: src/main/ai/embeddingService.ts
REQUEST: <the MCP server entry file — wherever brain MCP tools would register; exact path + exported registration function>
REQUEST: <the chat send path — the function that assembles the outbound LLM prompt today; file + function name>
REQUEST: src/main/ai/episodeWriters.ts
REQUEST: src/features/warmth/context-brain/ContextGraphView.tsx
```

Why each:
- `episodeWriters.ts` — pin the `source_ref` convention `writeAiContextEpisode` records for external_ai episodes (M2 Phase B match key) and the exact `writeAiContextEpisode` signature for reuse.
- `ContextGraphView.tsx` — precision for the M1 slim-down (which render blocks die, what the graph-only host keeps).
- The four M6 files — per the mandate; they gate §7's file-by-file plans only.

---

## 2. M1 — One-brain decision [LOCKED]

### 2.1 Decision

**Two purposeful surfaces with explicit ownership. No `/brain` route is created. No new page manifest is created.**

1. **Life → Self tab (`SelfOrchestrator`) = the visual brain.** The canonical home of the graph, the stats, the activity, the identity. This is what Round 0/1 revamped and what the hashes `brain`/`graph`/`profile` already resolve to (`LifePage.tsx:204` `tabMap`). Nothing moves.
2. **AI chat → `BrainSurface` = the tools surface.** Its three existing tabs (search / trail / manage) are purposeful: retrieve context, audit what the browser bridge captured, manage + diagnose the brain. `ContextGraphView` stops being a second layout and becomes a slim graph host inside it.

### 2.2 Why not a `/brain` page

- A standalone route needs a new masthead, nav entry, and layout → a **third** brain layout. The current disease is three overlapping surfaces; the cure cannot be a fourth consolidated-into-a-fourth-place layout.
- The hash mapping (`brain`/`graph`/`profile` → Self tab, `LifePage.tsx:204`) already routes CZ's muscle memory correctly. A `/brain` route would break or duplicate it.
- Repo law cost is real but wasteful here: `src/pages/registry/pages/brain.ts` + registration + `validate:pages` updates to canonize a page whose entire content already lives one tab away, inside a page that is not going anywhere.
- The Self tab is where brain content belongs conceptually: Self = "my brain". Moving it out would gut the tab that was just revamped.
- `npm run validate:pages` "knows none of it" is resolved **by decision**, not by registration: no new page and no new tab is created in this round, so the validator's world does not change. If the pages registry grows an alias concept later, registering `brain`→self there is a one-line follow-up — do not hand-invent one now.

### 2.3 Panel ownership table (every panel: keep / add / dedupe / delete)

| Panel / component | Home today | Verdict | Notes |
|---|---|---|---|
| Masthead + 4 StatTiles (Episodes/Entities/Facts/All-time) | Self | **KEEP** | Real via `brainStats`; loading/errored states stay. |
| **Extension stat tile (new, 5th)** | — | **ADD (M3)** | Same anatomy as the other four; see §4.4. |
| BrainVisualization + BrainGraph (2D canvas) | Self stage | **KEEP** — canonical graph | M5 verdict: permanent. Honest-state shells stay. |
| Reflection card | Self | **KEEP** | |
| ActivityFeed (honest states, replay) | Self | **KEEP** | |
| Identity card + legend | Self | **KEEP** | |
| Governance card ("Open in AI Assistant") | Self | **KEEP** | This is the sanctioned bridge Self → BrainSurface. No new nav. |
| ContextRetrievalPanel | BrainSurface.search | **KEEP** | |
| ExternalAITrail | BrainSurface.trail **and** rendered again inside ContextGraphView | **DEDUPE** — keep the tab copy; remove ContextGraphView's internal copy | Grows the ExtensionStatusCard header (M3). |
| BrainManagementView | BrainSurface.manage **and** rendered again inside ContextGraphView | **DEDUPE** — keep the tab copy; remove ContextGraphView's internal copy | Grows two collapsed sections (M4). |
| **ExtensionStatusCard (new)** | — | **ADD (M3)** to BrainSurface.trail header | §4.5. |
| **BrainHealthPanel (new)** | — | **ADD (M4)** to BrainSurface.manage | §5. |
| **BrainDebugPanel (new)** | — | **ADD (M4)** to BrainSurface.manage | §5. |
| ContextGraphView | mounted by BrainSurface; renders its own trail+manage copies | **SLIM** to graph-only stage host | The code itself admits it at `ContextGraphView.tsx:329` ("second CanvasGraph running beside a decorative background"). Keep the graph stage + aria-hidden ambience; delete the duplicated panel renders. |
| CanvasGraph.tsx | referenced only by that comment | **DELETE (confirm)** | Zero mounters. |
| BrainGrowthChart.tsx | zero importers | **DELETE (confirm)** | Dead. |
| EntityGroups.tsx | referenced only from ContextGraphView internals | **DELETE after slim (confirm)** | Becomes dead the moment ContextGraphView slims. Gate: grep zero importers post-slim before deleting. |

### 2.4 Deletion confirm-list (CZ must explicitly approve)

```
DELETE src/features/warmth/context-brain/CanvasGraph.tsx
DELETE src/features/warmth/context-brain/BrainGrowthChart.tsx
DELETE src/features/warmth/context-brain/EntityGroups.tsx        (only after ContextGraphView slim + grep zero importers)
DEDUPE ContextGraphView.tsx internal ExternalAITrail render      (component file stays, as the tab's trail)
DEDUPE ContextGraphView.tsx internal BrainManagementView render  (component file stays, as the tab's manage)
```

Nothing user-visible is removed by this list: every deleted file is dead or duplicated code. The tabs and their contents all survive.

### 2.5 File-by-file (M1)

| File | Change |
|---|---|
| `src/features/warmth/context-brain/ContextGraphView.tsx` | Slim to graph-only host: keep the graph stage and the aria-hidden decorative background (same ambience class as NeuralFlow); remove the internal `<ExternalAITrail>` and `<BrainManagementView>` renders and any tab-like scaffolding around them. Anchor: comment block at `ContextGraphView.tsx:329`. Exact line edits pinned by the §1 REQUEST. |
| `src/features/warmth/context-brain/CanvasGraph.tsx`, `BrainGrowthChart.tsx`, `EntityGroups.tsx` | Delete after CZ confirms §2.4 and grep shows zero importers. |
| `src/features/warmth/LifePage.tsx:204` (`tabMap`) | **No change.** Optional one-line comment: `// brain/graph/profile intentionally resolve to Self — M1 Round 2: Self is the canonical brain surface.` |

### 2.6 Verify (M1)

- Static: scoped tsc + esbuild clean after slim and deletions; `rg -n "CanvasGraph|BrainGrowthChart|EntityGroups" src/` returns zero (post-deletion).
- Runtime [NOT TESTED]: Self tab renders exactly as today (regression check); BrainSurface trail/manage tabs still render their panels exactly once; no duplicated trail/manage sections visible.

---

## 3. M2 — Real-edge backfill [LOCKED, one pin]

### 3.1 Decision: new IPC `brain:backfill`, two phases, dry-run first

`brain:run-extraction` keeps its meaning (forward extraction of episodes → facts). Backfill is a one-shot **repair** of stored rows with its own report; it gets its own channel so logs, metrics and UI never conflate the two.

**Expected end state after one real run (against today's measured data):**
- `facts.linked` ≈ every fact whose `object_literal` resolves to one of the 37 entities; `context_facts.object_id NOT NULL` count > 0 (today: 0 of 220).
- `captures.matched` = **143** (every stranded capture reconciles to its already-written episode — external_ai episodes number exactly 143), `captures.created` = **0**.
- `brain:evaluate` `edges_exist` and `no_orphan_facts` flip to real passes; the stored graph's connectivity stops being 100% synthetic.

### 3.2 Phase A — link facts by object literal

Scan once:

```sql
SELECT id, subject_id, object_literal, predicate
FROM context_facts
WHERE object_id IS NULL AND object_literal IS NOT NULL AND TRIM(object_literal) <> '';
```

Resolve each `object_literal` with **exactly the same chain as `applyExtraction`** (exact → alias → casefold). To make "same" structural rather than aspirational, factor the chain out of `src/main/ai/entityExtraction.ts` as:

```ts
export function resolveEntityId(name: string): number | null
```

- exact: `WHERE name = ?` — 1 row → id; 2+ rows → ambiguous → null.
- alias: same alias lookup `applyExtraction` uses today (the helper becomes the single source of truth for the aliases storage format — this removes the one format assumption I would otherwise have to make).
- casefold: `LOWER(name) = LOWER(?)` over names **and** aliases — unique match → id; else null.

Rules:
- **Unambiguous wins only.** Ambiguous or no-match literals are left untouched and counted (`facts.ambiguous`, `facts.noMatch`).
- **No self-loops:** if the resolved id equals `subject_id`, skip and count (`facts.selfLoop`).
- **`object_literal` is never cleared or modified** — linking is additive (`SET object_id = ?`), predicate/confidence untouched.
- Idempotent by construction: the scan predicate (`object_id IS NULL`) shrinks to empty; a second run links 0.

### 3.3 Phase B — reconcile the 143 stranded captures

**The trap this phase exists to avoid:** the 143 `external_ai` episodes already exist (episodes were written; only the `episode_status` bookkeeping update never ran). Re-running `writeAiContextEpisode` blindly would create 143 duplicate episodes. So Phase B is **match-first**:

For each `SELECT id, provider, messages, url, title, source, timestamp, dedup_key FROM ai_context_captures WHERE episode_status = 'pending'`:

1. **Match an existing episode** with one query over three plausible ref conventions:

```ts
// brainBackfill.ts — the single pin point; adjust ONLY this array if episodeWriters.ts
// (requested in §1) shows a different source_ref convention.
const captureRefCandidates = (cap) => [cap.dedup_key, `capture:${cap.id}`, String(cap.id)];
// SELECT id FROM context_episodes WHERE source='external_ai' AND source_ref IN (?,?,?) LIMIT 1
```

   - **Matched** → bookkeeping repair only: `UPDATE ai_context_captures SET episode_status='episode_written' WHERE id=?`. No episode, no facts are created.
   - **Unmatched** → the capture genuinely never became an episode: run the same `writeAiContextEpisode` path the live POST `/ai-context` handler uses (parse `messages` JSON, ≤300 KB as the handler enforces), then set `episode_status='episode_written'`; on throw, `episode_status='failed'`, `error_message=<message>`.
2. **Bulk-create guard (the safety valve):** if a run would **create** more than `maxCreate` (default **25**) episodes, abort with `aborted:{reason:'unmatched-captures-above-guard', stage:'captures'}` and write nothing further. Rationale: with 143 episodes already in the DB, the expected create count is **0**; a large create count means the `source_ref` match key is wrong, and aborting beats silently duplicating history. A wrong key surfaces in the dry-run counts and gets fixed by pinning `captureRefCandidates` from the requested `episodeWriters.ts`.
3. Per-capture try/catch; one failure never stops the batch. `messages` that fail `JSON.parse` → `episode_status='failed'`, `error_message='messages JSON parse failed'`.

Idempotency: only `'pending'` rows are touched; every processed row ends in a terminal state (`'episode_written'` | `'failed'`). Re-run processes 0. Reentry guard: module-level `running` flag; a second concurrent `brain:backfill` returns `{ok:false, error:'backfill already running'}`.

Phase ordering: A then B, one channel call. (B's new facts already carry `objectId` from the shipped `writeAiContextEpisode`; A's `object_id IS NULL` predicate would catch them anyway.)

### 3.4 Dry-run

`dryRun: true` executes both scans and all match queries, **writes nothing**, and returns the identical report shape. The Health panel flow (§5) makes it mandatory: the "Run backfill" button stays disabled until a dry-run's counts are displayed.

### 3.5 File-by-file (M2)

| File | Change |
|---|---|
| `src/main/ai/brainBackfill.ts` **(new)** | `runBackfill(opts: {mode:'all'|'facts'|'captures', dryRun:boolean, maxCreate:number}): Promise<BackfillReport>`. Phases per §3.2–3.4; logging via `brainLogger` component `BACKFILL` (one summary line per phase + per-batch lines); per-row autocommit (no mega-transaction — at 220 facts / 143 captures this is both safe and restart-tolerant). |
| `src/main/ai/entityExtraction.ts` | Export `resolveEntityId(name)` (refactor of `applyExtraction`'s inline exact→alias→casefold chain; `applyExtraction` refactored to call it — behavior identical, scoped tsc proves it). |
| `src/main.ts` (brain IPC block, ~line 18061 region where `brain:get-graph`/`brain:run-extraction` are registered) | Register `brain:backfill` handler → `runBackfill` with the reentry guard. |
| `src/preload.ts`, `src/types/deskflow-api.d.ts` | `brainBackfill(opts)` binding + `BackfillReport` type. |

One DB-writer note: backfill runs inside the app's main process — the single writer — so repo law is honored by construction. No external scripts, ever.

### 3.6 Verify (M2)

- Static: scoped tsc/esbuild clean.
- Probe [NOT TESTED until CZ builds]: DevTools → call `api.brainBackfill({dryRun:true})` → expect `captures.scanned=143`, and with the correct ref pin `captures.matched≈143, created=0`; then real run; then `sqlite3` read-only check `SELECT COUNT(*) FROM context_facts WHERE object_id IS NOT NULL` > 0 and `SELECT episode_status, COUNT(*) FROM ai_context_captures GROUP BY 1` shows zero `'pending'`; then `brain:evaluate` shows `edges_exist` pass.

---

## 4. M3 — Extension revival [LOCKED, one assumption]

### 4.1 (a) Permanent install — the honest answer

The receiver is fine (verified live in the bundle). The extension died of its install model: Firefox "Load Temporary Add-on" evaporates on every browser restart; last capture 2026-08-27 = exactly that, ~11 weeks (77 days) ago.

**Firefox (release) — say it plainly: there is no supported way to permanently install an unsigned add-on on release Firefox.** `xpinstall.signatures.required=false` only unlocks on ESR / Developer Edition / Nightly. The permanent paths, no AMO publishing:

1. `about:config` → set `xpinstall.signatures.required` → `false` (works on ESR/Dev/Nightly; release locks it — that lock is *why* the add-on kept disappearing).
2. `about:addons` → gear icon → **Install Add-on From File…** → `release/deskflow-bridge/deskflow-bridge-firefox.xpi`.
3. Sanity test: send one message in any ChatGPT/Claude tab → the Extension tile turns Live within ~60 s.
4. No AMO, no `update_url`; updating = install the new xpi the same way (version shown in the trail card).
5. Flathub Nightly (`org.mozilla.FirefoxNightly`) or Mozilla's ESR build are valid vehicle choices on Fedora — **NOT TESTED**, named as options in the guide only.

**Chrome/Chromium/Brave — unpacked persists across restarts:**

1. Unzip `release/deskflow-bridge/deskflow-bridge-chrome.xpi` into a folder that will stay put (e.g. `~/tools/deskflow-bridge`). Never `/tmp` — Chrome reloads from that path at every start.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder.
3. Sanity test as above. The "developer mode extensions" notice on launch is expected and harmless on Linux.

Deliverable: **`docs/bridge-install.md`** (new) carrying exactly the copy in §4.5; the in-app accordion mirrors it. No extension code changes in this round (the bridge already works when installed — 143 captures prove the chain).

### 4.2 (c) Watchdog design — derived, not stored

The bundle sketched a `captures.lastReceivedAt` row in `context_scheduler_state`. I am overruling that sketch with something strictly simpler and immediately true for existing data:

```sql
SELECT MAX(captured_at) FROM ai_context_captures WHERE is_manual = 0;
```

- `captured_at` is written at insert time by the receiver, so `MAX` **is** "last automatic capture accepted" — it already covers the 143 historical rows, needs **no schema delta, no new write path, no lazy backfill of a state key**.
- Excludes `is_manual=1` so the BRIDGE watchdog watches the browser pipe, not user-added captures. **Assumption flagged:** I read `is_manual` as "capture entered manually (source='manual')". If opencode knows `is_manual` means something else, the fix is one WHERE clause in `bridgeWatch.ts` — flagged, not silent.
- Provider counts: `SELECT provider, COUNT(*) FROM ai_context_captures GROUP BY provider` (measured today: chatgpt 72 · claude 70 · qwen 1).
- `receiverAlive` = the ingest HTTP server's own `listening` flag (cheap, real; it also catches the rare "daemon never released 54321 at app boot" case).
- One source of truth: new `src/main/ai/bridgeWatch.ts` exports `computeCaptureWatch(db)` and the thresholds; `brain:health`, `brain:evaluate`, the tile, and the card all consume its output. Renderer never recomputes thresholds.

**State machine** (constants live in `bridgeWatch.ts`):

| State | Rule (days since last automatic capture) | Tile chip |
|---|---|---|
| `live` | ≤ 3 (`GREEN_DAYS = 3`) | Live |
| `stale` | ≤ 14 (`AMBER_DAYS = 14`) | Stale |
| `silent` | > 14 | Silent |
| `never` | zero rows | Silent |
| `down` | receiver not listening (overrides) | Down |

LAMINAR compliance: zinc surfaces stay; **one signal hue**; the state is carried by the dot's treatment (filled / 50% opacity / outlined) plus the word — no red/green rainbow, no glass.

**`brain:health` growth** (metrics block `captures`):

```json
{ "lastReceivedAt": "<ISO|null>", "daysSinceLastCapture": 77, "state": "silent",
  "receiverAlive": true, "countsByProvider": { "chatgpt": 72, "claude": 70, "qwen": 1 } }
```

`humanReason` gains one sentence, e.g. `"Browser bridge: silent — no automatic capture for 77 days; receiver is alive, so the break is on the browser side."`

**`brain:evaluate` growth:** new check `extension_alive` — pass when state ∈ {live, stale}; fail when {silent, never, down}; `value = daysSinceLastCapture` (null for never), `threshold = 14`, detail carries the exact age and state word. (§9.)

### 4.3 (b) Where the status surfaces live

- **Self masthead: 5th StatTile "Extension"** — the passive signal every morning (§4.4).
- **BrainSurface.trail: ExtensionStatusCard** at the top of ExternalAITrail — the diagnostic surface: age, provider counts, receiver state, install accordion (§4.5). The trail tab is already the bridge's audit home; this is its header, not a new page.

### 4.4 StatTile — exact UX copy

- Label: `Extension`
- Value: `2h ago` / `12d ago` / `77d ago` / `Never` (relative time; `Never` when zero rows)
- Chip: `Live` / `Stale` / `Silent` (+ `Down` when receiver dead)
- Error state (health call fails — same pattern as the existing statsError line): value `—`, chip `n/a`, and under the masthead: `Extension status unavailable — the graph above is still live.`
- Accessibility: dot carries `aria-label="Bridge state: silent — last automatic capture 77 days ago"`.
- `data-section="life.self.stat.extension"`; layout: the 4-tile row may wrap to two rows on narrow widths — acceptable, flagged for visual check.

### 4.5 ExtensionStatusCard — exact UX copy

Title: `Browser bridge`. Providers line (dynamic): `ChatGPT 72 · Claude 70 · Qwen 1`. Body by state:

- **live**: `Captures are arriving. Last capture {age} ago.`
- **stale**: `No captures for {days} days. If you have used an AI chat today, the bridge add-on probably did not reload with the browser.`
- **silent**: `No captures for {days} days. The bridge add-on is not installed or not sending. The receiver is alive — the break is on the browser side.`
- **never**: `No capture has ever arrived. Install the bridge add-on to connect your AI chats.`
- **down**: `The receiver on port 54321 is not answering. Restart the app; if it persists, another process is holding the port.`
- Collapsed accordion: `Install the bridge permanently` → verbatim steps from §4.1 (Firefox first, with the release-Firefox honesty line: `On release Firefox there is no supported way to keep an unsigned add-on. Either switch to ESR / Developer / Nightly, or accept re-loading it via about:debugging after each restart.`).
- Footer: `Full guide: docs/bridge-install.md`
- `data-section="brain.trail.bridge"`.

### 4.6 File-by-file (M3)

| File | Change |
|---|---|
| `src/main/ai/bridgeWatch.ts` **(new, ~60 lines)** | `computeCaptureWatch(db)` per §4.2; constants `GREEN_DAYS/AMBER_DAYS`; state derivation. |
| `src/main.ts` (`brain:health` handler) | Merge `computeCaptureWatch` into `metrics.captures` + extend `humanReason`; `receiverAlive` from the ingest server's `listening` flag. **No change to the POST `/ai-context` insert path** — the watchdog is derived, so the receiver needs zero edits. |
| `src/preload.ts`, `src/types/deskflow-api.d.ts` | **Verify `brainHealth` binding exists.** The bundle's preload marker list (`brainGetGraph/brainLogs/brainEvaluate/…`) does not name it — grep first; add `brainHealth()` + `CaptureWatch` types if missing. This is the one preload gap I can see from here. |
| `src/features/warmth/self/SelfOrchestrator.tsx` | 5th StatTile per §4.4, fed by `brainHealth`; error state mirrors the existing `statsError` pattern. |
| `src/features/warmth/context-brain/ExtensionStatusCard.tsx` **(new)** | §4.5; consumes the same `brainHealth` payload. |
| `src/features/warmth/context-brain/ExternalAITrail.tsx` | Mount the card as the trail header. |
| `docs/bridge-install.md` **(new)** | §4.1 copy verbatim + troubleshooting (port ownership table: app vs `rheo-tracker` daemon). |

### 4.7 Verify (M3)

- Static: tsc/esbuild clean; grep `computeCaptureWatch` referenced by health + evaluate.
- Probe [NOT TESTED]: `curl http://127.0.0.1:54321/brain/health` → JSON contains `metrics.captures` with `daysSinceLastCapture≈77, state:"silent"`; Self tile shows `77d ago / Silent` red; trail card shows the silent copy; then install the bridge per §4.1, send one ChatGPT message → tile flips Live ≤ 60 s, new capture row appears, `extension_alive` check passes.

---

## 5. M4 — BrainHealthPanel + BrainDebugPanel [LOCKED]

Home (per M1): **BrainSurface → manage tab**, mounted as two collapsed sections below `BrainManagementView`. The Self page stays a life page.

### 5.1 BrainHealthPanel

- Data: `brainHealth` + `brainEvaluate`.
- Layout: status line (the `humanReason` sentence, verbatim), then the checks table — columns **Check / Result / Value / Threshold / Detail**; `skipped: true` rows render dimmed with a `skipped` chip and the detail explains why (this is the honest styling the mandate asks for); zinc borders, radius 8, no glass.
- Buttons: `Refresh`; **`Dry-run backfill…`** → shows the counts from §3.4 inline → **`Run backfill`** stays disabled until a dry-run has been displayed in this session; the confirm line echoes the counts (`143 captures will be reconciled · 0 episodes will be created`). Result line after run: per-phase counts, or the abort reason if the §3.3 guard fired.
- `data-section="brain.manage.health"`.

### 5.2 BrainDebugPanel

- Data: `brainLogs` polled every 2 s with a `since` cursor; cap 200 rendered rows (ring is 500).
- Controls: level select (debug/info/warn/error → `brain:log-level`, persists for the session); `Pause`/`Resume` tail; `Clear` (confirm dialog → `brain:logs-clear`); `Export` → `brain:logs-export` → renders the returned path as selectable text (no auto-open).
- Row anatomy: `hh:mm:ss [COMP] LEVEL message` with the payload JSON in an expandable row. Component filter = free-text match on the `[COMP]` token (minimal; no dropdown plumbing).
- `data-section="brain.manage.debug"`.

### 5.3 File-by-file (M4)

| File | Change |
|---|---|
| `src/features/warmth/context-brain/BrainHealthPanel.tsx` **(new)** | §5.1. |
| `src/features/warmth/context-brain/BrainDebugPanel.tsx` **(new)** | §5.2. |
| `src/features/warmth/context-brain/BrainManagementView.tsx` | Mount both sections, collapsed by default, honest loading/empty states. |
| `src/preload.ts`, `src/types/deskflow-api.d.ts` | Verify `brainLogLevel` / `brainLogsClear` / `brainLogsExport` bindings exist (bundle §1.2 lists `brainLogs`; grep the other three, add any that are missing). |

### 5.4 Verify (M4)

- Static: tsc/esbuild clean.
- Probe [NOT TESTED]: manage tab → Health shows 11 checks with skipped styling; dry-run counts match §3.1 expectations; Debug shows `[BRAIN-EXT]`/`[BRAIN-BACKFILL]` entries flowing; level switch filters; export writes a file and prints its path.

---

## 6. M5 — 2D/3D verdict [LOCKED]

**No 3D. The 2D canvas graph is the permanent brain visualization.** The ambiguity is killed, not deferred.

Reasoning, in order of weight:
1. **The data does not need it.** 37 entities and a link set capped at 200. Depth adds occlusion and orientation loss at scales where every node is already legible in 2D; it would hide data, not reveal it.
2. **It re-opens the gimmick door.** CZ's own diagnosis: "everything is gimmick, nothing is using the real and dynamic data." Round 1 made the 2D graph real (main-process assembly, honest states, selection fix, avalanche clock). 3D would be new spectacle on top of a graph whose *data* has never even had a real edge until M2 lands. Order of operations: real edges first, spectacle never.
3. **Cost is not free.** `three`/r3f is a heavy dependency for zero analytic gain; a permanent WebGL render loop fights battery; orbit controls fight `reduced-motion` — a token the repo explicitly honors.
4. **Honest states already live in 2D.** The empty/loading/error shells, the replay, the selection ring — all built and verified in 2D. 3D would re-enter that whole verification cycle for nothing.

**Reopen condition (the only one):** the graph exceeds ~1,500 entities **and** someone names a concrete analytical task that 2D demonstrably cannot do. Until both are true, "3D" is not a backlog item, not a maybe, and not a TODO comment — it is out of the design. `BrainVisualization`/`BrainGraph` keep their names, their shells, and their single data source (`brain:get-graph`).

---

## 7. M6 — Phase-5 backend [PIN PENDING → 2b; contracts locked here]

Everything below is the locked design: semantics, storage contracts, DB deltas, eval growth. The file-by-file plans are deliberately absent until the §1 files arrive — the mandate forbids designing against imagined APIs. Where a contract touches an unread file, the touchpoint is named as a **PIN**.

### 7.1 Signals supersession

- **Contract:** a signal is a typed user fact with a strength, occupying a slot `(kind, key)` (e.g. `kind='tool', key='editor'`). Write-time semantics, applied in the same path that writes facts:
  - new value on an occupied slot → old row: `valid_to = now`, `superseded_by = new.id`; new row inserted with `valid_from = now`. (Supersession, not deletion — audit survives.)
  - same value again → reinforcement: `strength = min(1, strength + 0.15)`.
- **Decay (scheduler-time, daily):** `strength *= 0.99`; below `0.05` → `valid_to = now` (retired, row kept). This is what makes the existing `signal_decay_ran` check real: pass when the last decay run is ≤ 26 h.
- **Storage [PIN → userContextService.ts]:** if a signals store already exists, adopt its table and add only nullable columns; otherwise:

```sql
CREATE TABLE IF NOT EXISTS context_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5, confidence REAL NOT NULL DEFAULT 0.5,
  source_episode_id TEXT,
  superseded_by INTEGER, valid_from INTEGER NOT NULL, valid_to INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE INDEX IF NOT EXISTS idx_context_signals_slot ON context_signals(kind, key, valid_to);
```

### 7.2 Embeddings

- **Table (additive, safe regardless):**

```sql
CREATE TABLE IF NOT EXISTS context_fact_embeddings (
  fact_id INTEGER PRIMARY KEY,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,              -- float32 little-endian
  created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE INDEX IF NOT EXISTS idx_fact_embeddings_model ON context_fact_embeddings(model);
```

- **Provider chain (one design, no remote calls):** `embeddingService.ts` local model when available [PIN: its export names] → deterministic `hash-v1` fallback (256-dim bag-of-words over fact text + entity names, cosine-comparable, clearly labeled `hash-v1` so quality is honest) → else `skipped`. **No remote embedding API, ever** — offline-first, no silent data egress.
- **Retrieval queries only the active model's rows**; a model switch marks coverage stale and the backfill re-embeds (`mode:'embeddings'` joins `brain:backfill` in 2b).
- Eval: `embeddings_coverage` (today skipped) becomes real: ≥ 90% of eligible facts have active-model rows → pass.

### 7.3 Profile rebuild

- **Contract:** pure function `rebuildProfile()` folds non-superseded signals (strength-desc, top 40) + top-degree entities (≤ 30) + 50 most recent facts (by `ingested_at` — `context_episodes` has no `created_at`; the law is honored) into the profile document the chat prompt assembly consumes.
- **Triggers:** after any `brain:backfill` real run; nightly with the decay job. **No new IPC** (surface stays small).
- **Storage [PIN → userContextService.ts]:** the existing profile store, else a `context_scheduler_state`-style row. Eval: `profile_fresh` becomes real: rebuilt ≤ 7 d.

### 7.4 Retrieval budget enforcement (chat send path)

- **Contract:** factor the `brain:enrich-prompt` handler body into `src/main/ai/retrieval.ts` → `enrichPrompt(prompt, tokenBudget)`; both the IPC handler and the chat send path call the same function [PIN: send-path file + call site].
- **Budget ladder (default 800 tokens):** tier 1 signals (top 10 by strength) → tier 2 facts (degree × confidence, ≤ 20; embeddings-ranked when §7.2 is live) → tier 3 episode snippets (≤ 6, newest first by `occurred_at`). Hard cap: a tier that would overflow is **dropped whole** — never truncated mid-fact.
- **Verifiability:** every send logs `[BRAIN-CTX] {usedFacts, tokensEst, budget}`; new eval check `budget_enforced`: last 20 send logs all ≤ budget.

### 7.5 MCP tool additions

- **Contract (names + payloads mirror existing IPC):** `brain_graph` (`{includeSynthetic?:false}` → compact nodes/links), `brain_search` (`{query, tokenBudget}` → ranked facts; embeddings when available, else predicate/name match), `brain_health` (mirror of `/brain/health`). [PIN: MCP server file + registration function.]

### 7.6 brain:evaluate growth map (today → 2b)

| Check | Today | Becomes real when |
|---|---|---|
| `signal_decay_ran` | skipped | §7.1 decay job ships |
| `embeddings_coverage` | skipped | §7.2 ships |
| `profile_fresh` | skipped | §7.3 ships |
| `mcp_server_up` | skipped | §7.5 ships [PIN: health ping of the MCP server] |
| `extension_alive` | **new in 2a (real now)** | §4.2 |
| `facts_linked` | **new in 2a (real now)** | §9 |
| `budget_enforced` | new in 2b | §7.4 |

### 7.7 DB deltas (all additive; all in 2b, none in 2a)

Round 2a (M1–M5): **zero schema changes.** 2b: the two `CREATE TABLE IF NOT EXISTS` in §7.1/§7.2 (the §7.1 one only if the PIN reveals no existing signals store), plus any nullable-column ALTERs the PINs require. No destructive migration, ever.

---

## 8. IPC contract deltas (same table format as bundle §4)

| Channel | In | Out | Round |
|---|---|---|---|
| `brain:backfill` | `{mode?: 'all'\|'facts'\|'captures', dryRun?: boolean, maxCreate?: number}` | `{ok: true, mode, dryRun, durationMs, facts:{scanned, linked, ambiguous, selfLoop, noMatch}, captures:{scanned, matched, created, failed, failures:[{captureId, error}]}, aborted?: {reason, stage}}` — or `{ok:false, error}` when busy | 2a |
| `brain:health` | — | unchanged shape; `metrics` gains `captures:{lastReceivedAt, daysSinceLastCapture, state:'live'\|'stale'\|'silent'\|'never'\|'down', receiverAlive, countsByProvider}`; `humanReason` gains one bridge sentence | 2a |
| `brain:evaluate` | — | unchanged shape; `checks` grows from 9 to 11 (`extension_alive`, `facts_linked`) | 2a |
| preload/types | — | `brainBackfill` added; **`brainHealth`, `brainLogLevel`, `brainLogsClear`, `brainLogsExport` verified-and-added-if-missing** | 2a |
| `brain:backfill` `{mode:'embeddings'}`, `budget_enforced` check, MCP tools | — | — | 2b (§7) |

---

## 9. brain:evaluate — additions shipping in 2a

| Check | Pass | Fail | Skipped | Value / Threshold | Detail |
|---|---|---|---|---|---|
| `extension_alive` | state ∈ {live, stale} | state ∈ {silent, never, down} | never (derived query) | `daysSinceLastCapture` (null if never) / `14` | e.g. `"silent — last automatic capture 77d ago; receiver alive"` |
| `facts_linked` | `resolvableUnlinked == 0` (facts with `object_id IS NULL AND object_literal` resolvable to exactly one entity) | > 0 | never (cheap query) | `resolvableUnlinked` / `0` | names the drift the next backfill run would fix |

Existing checks are untouched; `edges_exist` / `no_orphan_facts` are expected to flip from fail to pass after the first real backfill — that flip is the acceptance signal, not a code change.

---

## 10. Build/verify checklist (CZ, in order)

1. `npm run build` (CZ-only, per repo law — everything in source since RESULT(9) is still unbuilt; the running app shows old behavior until this).
2. Static ceiling: scoped `tsc --noEmit` clean; esbuild bundle clean; `npm run validate:pages` — expect **unchanged pass** (no page/tab added by design, §2.2).
3. Grep markers: `brain:backfill` registered in `src/main.ts`; `resolveEntityId` exported from `entityExtraction.ts` and consumed by `applyExtraction` + `brainBackfill.ts`; `computeCaptureWatch` consumed by health + evaluate; `ExtensionStatusCard` imported by `ExternalAITrail`.
4. Runtime probes [all NOT TESTED until here]:
   - `curl http://127.0.0.1:54321/brain/health` → `metrics.captures.daysSinceLastCapture ≈ 77`, `state:"silent"`.
   - Self tab → 5th tile `77d ago / Silent`; four existing tiles unchanged.
   - BrainSurface → trail → bridge card silent copy + provider counts; manage → Health → 11 checks with skipped styling; `Dry-run backfill…` → expect `captures.scanned=143, matched≈143, created=0` → `Run backfill` → report.
   - Read-only sqlite spot-check: `context_facts.object_id NOT NULL` count > 0; `ai_context_captures` has zero `'pending'`.
   - Manage → Debug: entries flow; level switch; export path prints.
   - Install the bridge permanently (§4.1) → one ChatGPT message → tile Live ≤ 60 s; `extension_alive` passes.
5. After all green: CZ replies with the §2.4 confirm-list approved → opencode deletes the three files + dedupes ContextGraphView → re-grep zero references → tsc clean. Deletions ship **after** the working state is proven, never before.

## 11. Non-goals and NOT TESTED ledger

- **Non-goals:** AMO/Chrome-store publishing; any `/brain` route; 3D (§6 — permanent); extension code changes; remote embedding calls; new npm dependencies in 2a; renaming any surface (BrainSurface, SelfOrchestrator keep their names).
- **NOT TESTED (everything runtime):** all probes in §2.6, §3.6, §4.7, §5.4, §10. Static verification ceiling (agent-side): scoped tsc, esbuild, grep. Runtime verdicts are CZ's, post-build.
- **Flagged assumptions (one-line fixes if wrong):** `is_manual=0` = automatic captures (§4.2); `captureRefCandidates` covers the `source_ref` convention (§3.3 — the dry-run + `maxCreate` guard exists precisely to catch this being wrong); the missing preload bindings listed in §4.6/§5.3.

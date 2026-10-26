# RESULT — IDE File Change Tracking: Per-File Added/Removed Lines (Git-Style)

> Response to `PROMPT.md` (ide-file-change-tracking-24102026). One solution, designed end to end — no options. The baseline described in CONTEXT_BUNDLE §3 is treated as shipped code; this spec upgrades its semantics, closes its double-counting gap, completes the editor-extension spine (VS Code + IntelliJ minimum), and finishes the UI. Sections map 1:1 to the mandated output format.

---

## 1. Design Thesis — The Ledger Principle

**The product is a churn ledger, not a diff viewer.** `get-git-diff` already shows *what changed*; this feature answers *how much was written, per file, over time, in any folder, from any editor*. Those are different products with different semantics, and conflating them is what creates the double-counting trap the prompt calls out.

**The Ledger Principle (one rule, everything else follows):**
> A delta is only ever recorded as *(current content) − (content at last observation)*, and the **snapshot table is the single observation memory**. Every trigger — manual scan, auto-scan, editor save event, watcher daemon — reconciles against the same snapshots through the same diff engine.

Under this principle the committed-vs-working-tree question dissolves by construction. There are no overlapping windows to double-count: the git path's `prevBaseline..HEAD` numstat window and the working-tree numstat window overlap *by design* in the baseline implementation (a committed line appears in both diff #1 and diff #2 until the baseline advances), and an editor-reported delta has no shared memory with either. In the ledger, each observation's window is *last snapshot → now*; once a delta is recorded, the snapshot advances, so the same line can never be counted twice by any trigger, in any order, across restarts.

This also makes the ledger **self-healing**. A lost, duplicated, or malformed editor event can never corrupt totals: if ingestion misses an event, the snapshot simply wasn't advanced, and the next scan records the accumulated delta. If ingestion sees an event twice, the second one is hash-equal and skipped. Observation state lives in exactly one place; triggers are stateless and idempotent. Every edge case in §5 is a corollary of this sentence.

**Semantic consequences (documented, deliberate):**

- The ledger measures **working-tree line churn between observations**. `git pull`, branch switches, and checkouts are real content changes and would pollute "you wrote this" totals — see the bulk-change guard in §5.2 (re-baseline instead of recording).
- The git numstat/baseline delta math from the baseline is **retired**. `git` remains in the stack only for the untouched `get-git-diff` feature; `baseline_commit` is kept as an informational column (current HEAD SHA, for debugging) and never used for delta math again. Existing `project_file_changes` history rows remain valid history under the old semantics; nothing is migrated or deleted.
- Per-row `source` collapses to two values: `'scan' | 'editor'`. Whether a project is a git repo is a property of the project (shown once in the section header), not a per-row attribute — the user no longer needs to interpret the distinction because both paths feed one ledger (this also answers the UX question in §6.6).

**What changes vs. the shipped baseline (implementer awareness list):**

| Area | Baseline behavior | This spec |
|---|---|---|
| Delta math (git repos) | numstat vs `baseline_commit` (committed + staged + unstaged) | snapshot reconciliation, same as non-git |
| Delta math (non-git) | per-file `git diff --no-index` | in-repo Myers `lineDiff` (§5.4) — no git dependency |
| First scan | records every file as "all lines added" | **re-baselines silently** (captures baseline, records nothing) |
| Rename | collapses to new path, content delta lost | collapses to new path **with real content delta** (§5.3) |
| Files > 512KB | excluded entirely (`_countFileLines` → 0) | tracked via streaming hash + count-approx deltas (flagged `approx`) |
| Snapshot content | plain TEXT in `content` | deflated BLOB in `content_gz` (zlib, built-in), ~3–4× smaller |
| Ingestion | README sketch, 3 transport options | JSONL spine, specified end to end (§7) |

---

## 2. Open Questions — Decisive Answers

| # | Question | Answer | Why |
|---|---|---|---|
| 1 | Auto-run change scan on `count-project-lines`? | **No — separate actions, but the changes system self-triggers**: manual button, silent auto-scan on project open / window focus when stale ≥ 15 min, and editor events as the live path. | The two commands share a walk but not a cost profile: counting reads bytes once; the ledger hashes, diffs, and writes. Coupling would slow the cheap path and make a read-intent action perform surprise writes. Self-triggering gets the freshness benefit without the coupling. |
| 2 | Ingestion: HTTP vs JSONL tail? | **JSONL file drop** (`changes.jsonl` in the app's userData dir), tailed by the main process. HTTP is rejected. | An HTTP endpoint on the sync server either writes SQLite from outside the Electron process (violates single-writer) or relays into it (extra hop, new lifecycle coupling, ports + auth). JSONL preserves single-writer trivially (editors append a file; only main writes the DB), is the offline queue *by construction*, needs zero dependencies and zero ports, and is the identical contract for VS Code, IntelliJ, Vim, and a cron daemon. |
| 3 | Attribute changes to a session? | **As metadata only, in v1**: nullable `session_id` column, stamped with the app's active session at write time when trivially resolvable (else NULL). No UI, no filtering on it. | Editor events cannot be attributed reliably (editors don't know RHEO sessions; mapping by time window is fiction). The column future-proofs cheaply; building UI on unreliable mapping would erode trust in the numbers. |
| 4 | Renames: collapse or delete+add? | **Collapse to the new path, with the real content delta** (similarity-paired, §5.3). A pure rename (identical content) records nothing (0/0 rule) but moves the snapshot. | Delete+add would report a 500-line file move as +502/−500 — noise that poisons "how much did I write". Git's own `numstat -M` collapses renames; users expect that. The baseline "lost" the delta; we now measure it via lineDiff between old and new content. |
| 5 | Is the 512KB content cap enough? | **The cap is right; the strategy around it changes**: content ≤ 512KB stored deflated; content evicted after 90 days untouched (hash kept); files > 512KB stay *tracked* via streaming sha1 + line-count deltas flagged `approx` (never skipped). | Storing raw text for a 10k-file repo ≈ 200MB of DB; deflate (built-in zlib, not an npm dep) cuts it ~3–4×, eviction bounds it long-term. Skipping big files entirely (baseline) makes minified/bundled/generated churn invisible — worse than an approximate count. |
| 6 | UI placement? | **Inside Code Stats** (`ProjectLineStats.tsx`), as the refined "Changes" section below the file-detail table. The IDE Projects overview gets nothing in this pass. | Same data, same cadence, same mental model as line stats — zero navigation cost. The overview is a launcher; embedding live counters there invites staleness questions the section header already answers. The summary strip is built as a self-contained component so lifting it into the overview later is a one-line import, not a redesign. |

---

## 3. Data Model (exact SQL)

Both tables exist (bundle §3.1); this spec only **adds columns** via idempotent `ALTER TABLE` inside the existing migration block (guard each with a `PRAGMA table_info(...)` check in a helper `addColumnIfMissing(table, ddl)` — SQLite's `ALTER TABLE ADD COLUMN` errors if the column exists).

```sql
-- project_file_changes: attribution + approximation flags
ALTER TABLE project_file_changes ADD COLUMN approx INTEGER NOT NULL DEFAULT 0;
    -- 1 = delta derived from line-count difference, not a real diff
    --    (files > 512KB, or bulk guard fallback). Rendered as "~N".
ALTER TABLE project_file_changes ADD COLUMN session_id TEXT;
    -- nullable; active app session at write time when resolvable. Metadata only (§2 Q3).

-- project_file_snapshots: compressed content + binary/oversize support
ALTER TABLE project_file_snapshots ADD COLUMN content_gz BLOB;
    -- zlib.deflateSync(content) — Node built-in. Read precedence: content_gz, else legacy
    -- `content` TEXT column (existing rows). All NEW writes go to content_gz; content set to NULL.
ALTER TABLE project_file_snapshots ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;
    -- file size in bytes; drives the >512KB approx rule without re-reading content.
ALTER TABLE project_file_snapshots ADD COLUMN binary INTEGER NOT NULL DEFAULT 0;
    -- 1 = binary marker row (sniffed \0 in first 8KB). Marker rows carry total_lines=0,
    -- content_gz=NULL, content_hash of first 8KB. Prevents re-sniffing binaries every scan.
```

No new tables. No new indexes — `idx_file_changes_project` and `idx_file_changes_scanned` cover the shipped queries; add a covering index only if a profiler says so. `baseline_commit` stays (informational). `source` accepts new values `'scan' | 'editor'`; legacy rows (`'git'`, `'snapshot'`) are normalized to `'scan'` at read time in the handler (one mapping constant, no data migration).

**Retention rule (one):** `delete-project-changes(projectId)` wipes both tables for the project (existing behavior, unchanged). No automatic pruning of change history in v1; per-project volume is small (rows only on real deltas).

**Content eviction (the only automatic write outside scans):** during any scan, snapshots whose `scanned_at` older than 90 days AND whose file hash is unchanged have `content_gz`/`content` nulled (hash + total_lines + bytes kept). Next real change to such a file degrades to one `approx` delta, then full diffing resumes. Rationale in §2 Q5.

---

## 4. IPC Contracts & Types

### 4.1 Channel inventory (checklist for the "every preload channel has a handler" rule)

| Channel (ipcMain.handle) | Preload key | Status | Handler shape |
|---|---|---|---|
| `scan-project-changes` | `scanProjectChanges` | exists — behavior upgraded (§5.1) | useJson guard + try/catch + `{success, data\|error}` |
| `get-project-changes` | `getProjectChanges` | exists — return shape extended (additive) | same |
| `delete-project-changes` | `deleteProjectChanges` | exists — unchanged | same |
| `get-changes-ingest-status` | `getChangesIngestStatus` | **NEW — the only new channel** | same |

```ts
// src/preload.ts (add one line under the existing block ~713-722)
getChangesIngestStatus: () => ipcRenderer.invoke('get-changes-ingest-status'),
```

```ts
// src/main.ts — new handler, exact convention match
electron_1.ipcMain.handle('get-changes-ingest-status', async (_: any) => {
  if (useJson) return { success: false, message: 'Requires SQLite' };
  try { return { success: true, data: ingestService.status() }; }
  catch (err: any) { return { success: false, error: err.message }; }
});
```

### 4.2 Types (`src/types/line-stats.ts`) — additions and changes

```ts
export interface FileChangeResult {
  filePath: string;
  fileType: string;
  added: number;
  removed: number;
  totalLines: number;
  approx?: boolean;      // new: count-derived delta (~ prefix in UI)
}

export interface FileChangeData {
  files: FileChangeResult[];
  summary: FileChangeSummary;
  scannedAt: string | null;      // last observation of any kind (scan or ingest)
  lastScanAt: string | null;     // new: last explicit scan
  lastEventAt: string | null;    // new: last editor event ingested
  source: 'ledger';              // changed: was 'git' | 'snapshot' — one ledger now
  engine: 'diff' | 'approx';     // new: 'approx' if any row degraded this scan
  approxCount?: number;          // new: rows flagged approx in the latest scan
  rebaselined?: number;          // new: files re-baselined by the bulk guard (§5.2)
  baselineCommit: string | null; // kept, informational (current HEAD)
  totalFiles: number;
  totalRows?: number;
}

export interface IngestStatus {           // returned by get-changes-ingest-status
  ingestPath: string;                     // absolute path of changes.jsonl
  fileExists: boolean;
  bytes: number;
  counters: {
    received: number;                     // parseable events seen
    ingested: number;                     // produced a delta row
    unchanged: number;                    // hash-equal, skipped (dedupe working)
    droppedMalformed: number;
    droppedUnknownProject: number;
    droppedEscape: number;                // filePath outside projectPath
    droppedVersion: number;               // unknown event schema version
  };
  lastEventAt: string | null;
  sources: { source: string; lastSeenAt: string }[];  // from 'hello'/save events
}
```

`scan-project-changes` signature and `options` param are unchanged (options stay reserved). `get-project-changes(projectId, limit=200)` keeps its cumulative `files[]` semantics (one row per file path, summed deltas) and additionally returns `history[]` (the last `limit` raw `project_file_changes` rows with `source`, `scanned_at`, `approx`) for tooltips and future charts.

## 5. Backend Logic

### 5.1 `scanProjectChanges(projectPath, projectId)` — step by step (the ledger scan)

1. **Validate** `projectPath` exists and is a directory → else return `{ success: false, error: 'ENOENT' | 'EACCES' ... }` (the UI maps these to error copy, §6.5).
2. **Load observation memory:** `SELECT file_path, content_hash, content, content_gz, total_lines, bytes, binary FROM project_file_snapshots WHERE project_id = ?` → `Map<path, Snapshot>`. Empty map ⇒ first scan.
3. **Walk the tree** with the *exact* skip rules of `count-project-lines` — extract the ignore list into one shared constant/module so the two features can never drift (`node_modules`, `.git`, build output, etc. — whatever the shipped list is, it is the single source of truth).
4. **Per file, read once:**
   - Stat first. If `bytes > 512KB`: stream in 64KB chunks — count `\n`, compute sha1 incrementally, never buffer the body. `approx`-eligible.
   - Else read whole buffer. Sniff first 8KB for `\0` → binary: write/update a **binary marker row** in snapshots (hash of the 8KB header, `binary=1`), no delta ever. If the *previous* snapshot for this path was text and the file is now binary, the text is gone → record `removed = oldTotalLines` (accuracy rule: deleted text = all lines removed).
   - Text ≤ 512KB: compute sha1 of raw bytes, count lines with the **shared `countLines()` helper extracted from `_countFileLines`** — the Total column must agree with `count-project-lines` to the line.
5. **Compare against the snapshot map:**
   - **No snapshot (new file):** first scan ⇒ baseline candidate (step 7). Later scans ⇒ `added = totalLines, removed = 0`, real row. Snapshot upserted (deflated content).
   - **Hash equal:** no-op. No row (0/0 never stored), no snapshot write, no scanned_at churn. This is the dedupe that makes everything idempotent — including EOL flips, which change the raw hash but diff to 0/0 after CRLF→LF normalization and are therefore silently absorbed.
   - **Hash differs, both text ≤ 512KB:** `lineDiff(oldContent, newContent)` → `{added, removed}` (§5.4). Old content = `gunzipSync(content_gz)` or legacy `content`.
   - **Hash differs, either side > 512KB:** count-approx: `added = max(0, newTotal − oldTotal)`, `removed = max(0, oldTotal − newTotal)`, row flagged `approx=1`, response `engine='approx'`.
6. **Deletions:** snapshot paths not seen in the walk → if `binary=1`, just delete the marker; else record `removed = oldTotalLines, added = 0` and delete the snapshot.
7. **Bulk guard (first scan + checkout/clone noise):** if the changed+new set exceeds **2000 files**, or the project has *no prior snapshots at all*: **re-baseline** — upsert all snapshots, record **zero** delta rows, return `rebaselined: N` and a summary of `0/0`. Rationale: no human writes 2000 files between two observations; a checkout, clone, or generator did. Codemods are the accepted false negative (documented trade-off; a codemod still shows up file-by-file in any sub-2000 window). First scan always re-baselines — the ledger starts at zero and everything after is earned.
8. **Rename pairing** (§5.3) runs on this scan's removed×added text sets.
9. **Persist in one transaction** (better-sqlite3 `.transaction()`): insert non-0/0 rows into `project_file_changes` (prepared statement, batched; `source='scan'`, `approx` per row, `session_id` stamped if resolvable, `baseline_commit` = `git rev-parse HEAD` when the folder is a repo, else NULL), upsert/insert/delete snapshot rows. Single-writer is structural: this is the only writer in the process.
10. **Return** `FileChangeData` per §4.2 (`source: 'ledger'`, `engine`, `lastScanAt`, counts).

### 5.2 Why this kills the double-count (the argument, once, precisely)

Any delta row is the difference between two *snapshot states*. Snapshots advance exactly when a delta is recorded — never before, never after. Therefore the windows `(t_last_snapshot → t_scan)` and `(t_scan → t_next_observation)` are disjoint by construction, regardless of whether the observation was triggered by a button, a focus event, an editor save, or a git commit that happened in between. Committed and working-tree changes are not separate windows to sum; they are both just "content now vs. content then". This is the answer to the prompt's double-counting question, and it is why the baseline's `prevBaseline..HEAD` + `--cached` + unstaged merge — three windows that overlap — is retired.

### 5.3 Edge-case rules (the accuracy contract, consolidated)

| Case | Rule |
|---|---|
| Binary file | Never diffed, never counted. Marker row in snapshots. Text→binary transition = all old lines removed. |
| 0/0 delta | Never stored (hash-equal files produce no row at all). |
| Untracked / new file | All lines added (`added = totalLines`). |
| Deleted file | All lines removed (`removed = oldTotalLines`). |
| Rename | Removed×added pairing within one scan (only if both sets ≤ 50 paths): `lineDiff(old, new)`; similarity `= matched / max(oldTotal, newTotal) ≥ 0.6` ⇒ one row on the **new path** with the content delta, old snapshot deleted, new upserted. Below threshold (or sets too large) ⇒ honest delete + add. Pure rename (identical content) ⇒ no row, snapshot moved. |
| File > 512KB | Tracked; deltas are count-approx, flagged `approx`. |
| EOL flips / trailing whitespace-only | Hash changes → diff runs on CRLF→LF-normalized text → 0/0 → no row. Noise absorbed by the 0/0 rule. |
| Unknown project (ingest) | Dropped, counter incremented — folders must be added as projects in RHEO first (UI surfaces the hint, §6.4). |
| Path escape (ingest) | `filePath` normalized (resolve, forward slashes) must be inside `projectPath` — else dropped, counter `droppedEscape`. |
| Bulk change (> 2000 files) | Re-baseline, zero rows, `rebaselined: N` in response. |

### 5.4 `lineDiff` — in-repo, dependency-free (replaces `_gitDiffNoIndex` in the ledger)

New module `src/main/lib/lineDiff.ts`: Myers O(ND) line diff. Pipeline: split lines on `\n` after CRLF→LF normalization → trim common prefix/suffix → Myers over the middle → return `{added, removed}` counts only (no hunks needed). Equality = exact string match. Memory is O(N+D) on the trimmed middle — trivial for ≤ 512KB code files. Determinism: same inputs, same counts, on every machine — a property `git diff --no-index` cannot promise across git versions/configs (rename/whitespace flags), which matters because the verification probes (§8) assert exact numbers. Keep `_gitDiffNoIndex` in the codebase unused-or-removed per house style; the ledger no longer shells out for diffs, so non-git folders work with **no git binary at all**.

### 5.5 Ingestion service (main process) — the JSONL spine

**File:** `path.join(app.getPath('userData'), 'changes.jsonl')` (Linux: `~/.config/RHEO/changes.jsonl`, matching the existing README; macOS: `~/Library/Application Support/RHEO/changes.jsonl`; Windows: `%APPDATA%\RHEO\changes.jsonl`). Env override `RHEO_INGEST_FILE` for tests. Created with mode `0600` if absent.

**Tail loop (polling, cross-platform, no deps):** every 2s, `stat` the file. Grew ⇒ read `[offset, size)`, split `\n`, parse each line (`JSON.parse` in try/catch → `droppedMalformed`), process, advance offset. Shrank (rotation/truncation) ⇒ reset offset to 0 and read all. On app start ⇒ read the whole file once (bounded: if > 5MB, read only the last 5MB), then if still > 5MB rotate (`rename` → `changes.jsonl.1`, recreate). Idempotency (§1) makes every read path safe to repeat; the snapshot ledger self-heals anything a rotation race drops.

**Per-event pipeline:**
1. Reject unknown `v` → `droppedVersion`. `type: 'hello'` ⇒ update `sources` map, done.
2. Resolve project: normalize `projectPath` (resolve, strip trailing separator, lowercase on win32/darwin) and match against the projects table **using the same path→project helper the rest of main uses** (extract it if inline; confirm the root-path column name in the migration block before wiring — do not guess). Unknown ⇒ `droppedUnknownProject`.
3. Path safety: normalized `filePath` must start with normalized `projectPath` + separator ⇒ else `droppedEscape`.
4. Collapse per `(projectPath, filePath)` within the batch, keep latest `timestamp` (intermediate save states are gone anyway — disk holds the final content).
5. `type: 'delete'` (no hash/lines): snapshot exists ⇒ row `removed = oldTotalLines`, delete snapshot; no snapshot ⇒ ignore. (Live deletes come from editor file-watchers; out-of-band deletes are caught by the next scan — the ledger heals.)
6. `type: 'save'`: read the file from disk (main does the diffing — the editor never computes counts). Missing ⇒ treat as delete. sha1 equals snapshot hash ⇒ `unchanged++` (dedupe). Else diff per §5.1 rules → row with `source='editor'` + snapshot upsert, in one transaction.
7. Update counters; `lastEventAt` = now.

**Why editors don't send added/removed counts:** if extensions computed deltas, three implementations would own diff correctness (VS Code, IntelliJ, daemon) with no shared test surface and no dedupe memory. In this design an editor event is a *claim that content changed*; the app owns *how much*. One diff engine, one test suite (§8 P1), every client equally dumb — which is exactly why "compatible with all IDEs" is 30 lines of client code instead of a diff porting project.

---

## 6. UI Spec (Warm Paper / LAMINAR)

### 6.1 Token contract (no raw hex, no zinc steps — hard rule)

Surfaces: `--ws-surface-sunken` (strip, inputs, skeletons, banners), `--ws-surface-recess-deep` (row hover), `--ws-border-strong` (control borders), `--ws-veil` (row dividers). Text: `--text-primary` (values, file paths), `--text-secondary` (totals), `--text-muted` (labels, meta). Accent: `--page-accent` / `--page-accent-fill` / `--page-accent-on-fill` (primary button, live dot, sort affordance, `+` glyph). Radii: 8 (buttons, inputs), 12 (strip, banner, popover), pill (Live chip, source badges). Motion: L1 Composed only — 150ms `transition-colors`; **no shimmer, no pulse, no transform on data** (skeletons are static blocks).

**+/− color decision (explicit):** the token set ships no success/danger hues, and inventing hexes violates the contract. So the ledger stays ink-on-paper: values are mono; the **sign glyph carries the accent** — `+` in `--page-accent`, `−` in `--text-muted` — while the number itself is `--text-primary` (added) / `--text-secondary` (removed). Git semantics survive via sign + position + the strip's labels; a semantic-hue token pair can be adopted later without layout rework.

### 6.2 Anatomy (v2 of `ProjectFileChanges.tsx`)

```
Changes (section h3, --text-primary)
├─ meta row: "Last scanned 3 min ago · auto"   [Scan]  [Auto ⏻]        (Live · VS Code ⏺)
├─ summary strip  (flex, --ws-surface-sunken, rounded-12, p-3, divide-x --ws-veil)
│   ├─ block: "+N" (mono 20px --text-primary, + glyph --page-accent) / "added" (11px --text-muted)
│   ├─ block: "−M" (mono 20px --text-secondary, − glyph --text-muted) / "removed"
│   └─ block: "K"  (mono 20px) / "files touched"   — + "re-baselined: N" note when present
├─ table (--ws-border-strong 1px outer, rounded-8)
│   ├─ header: FILE · ADDED · REMOVED · TOTAL   (11px uppercase tracking-wide --text-muted;
│   │          click = sort cycle desc→asc, aria-sort, active col --page-accent; default added desc)
│   ├─ rows (h-9, hover --ws-surface-recess-deep, divider --ws-veil)
│   │   ├─ file: mono 13px --text-primary, middle-truncated ("src/…/useFileChanges.ts"),
│   │   │        title=full path; ~ prefix when approx (title: "approximated — file over 512KB")
│   │   ├─ added / removed: mono 13px right-aligned (glyph colors per §6.1)
│   │   └─ total: mono 13px right-aligned --text-secondary
│   └─ footer: "Show all N" ghost button when rows > 200 (paged, no virtualization)
└─ (section sits below the existing line-stats file table inside ProjectLineStats)
```

- **Live pill** (right of meta row): dot 6px + `Live · VS Code`; accent dot when any source lastSeen < 120s, else `Live · off` in `--text-muted`. Click → popover (`--ws-surface-sunken`, `--ws-border-strong`, rounded-12): ingest path (mono + copy), counter table (received / ingested / unchanged / dropped by reason), per-source last-seen, and — when `droppedUnknownProject > 0` — the hint: *"N events from folders not added as projects. Add the folder in Projects to track it."* This is also where the user discovers the ingest path for wiring up editors.
- **Sort:** client-side on the already-loaded cumulative rows; ties broken by path asc. Truncation: middle-truncate > 48 chars.
- **Source attribution (UX answer):** git-ness is stated once in the section — header meta shows `via working-tree ledger` (git repo) or `via content snapshots` (plain folder); per-row source (`scan`/`editor`) appears only in the row tooltip with the observation timestamp. The user no longer has to interpret two delta systems because there is only one.

### 6.3 States matrix

| State | Trigger | Render |
|---|---|---|
| **Idle** | no scan ever for this project | Explainer card (`--ws-surface-sunken`, rounded-12): *"Track line changes — per-file +added/−removed, git-style. Works in git and non-git folders; editor extensions stream saves live."* + primary CTA `Run first scan` (`--page-accent-fill` bg, `--page-accent-on-fill` text, radius 8). Note: the first scan re-baselines — say so: *"Your first scan sets the baseline; changes appear as you work."* |
| **Loading** | scan in flight | CTA → disabled + inline spinner; table area → 5 static `--ws-surface-sunken` rows (no shimmer). Auto-scans run silent (no skeleton swap) to avoid layout jump. |
| **Empty** | scanned, zero delta rows | One quiet row: *"No changes since the last scan."* (`--text-muted`) — a clean zero is a feature, not a gap. |
| **Error** | handler `{success:false}` | Banner (`--ws-surface-sunken`, rounded-12): title `--text-primary`, body `--text-secondary`, `Retry` text-button in `--page-accent`. Copy map: ENOENT → *"Folder not found — check the project path."* · EACCES → *"Permission denied."* · other → raw message, muted. Rate limits cannot occur (no server in the path) — the error surface only ever reflects filesystem reality. |
| **Populated** | rows exist | Summary strip + table + live pill, per §6.2. |

### 6.4 Interaction flow

`Scan` button = explicit `scanProjectChanges` (spinner, then data). `Auto` toggle (default **on**, persisted in `localStorage['changes.autoScan']` — renderer-side pref, no new IPC): on project open and on window focus, if `lastScanAt` older than 15 min → silent rescan. Editor events stream in independently of scans and update `scannedAt`/`lastEventAt` on next section mount; the Live pill reflects the ingest service, not the last button press. First-run order for a new user: add project → open Code Stats → Changes idle card → `Run first scan` (baseline) → work in VS Code with the extension → deltas appear; scans only needed for out-of-editor churn.

### 6.5 Empty-state-first UX

The idle card is the onboarding: it names the feature, promises git- and non-git support, sets the baseline expectation, and offers exactly one action. No tabs, no configuration. Editor setup is *discovered later* via the Live pill popover ("off" state includes one line: *"Install the RHEO extension to stream saves live — see docs."*), not shoved into the empty state.

## 7. Editor Extension Protocol (the JSONL spine)

### 7.1 Contract summary

- **Transport:** append-only JSON Lines to `changes.jsonl` (path table in §5.5; override `RHEO_INGEST_FILE`). One JSON object per line, one `fs.appendFile`/`FileWriter` write per line (single write ⇒ effectively line-atomic on local filesystems for ≤ 4KB events). Lines > 1MB rejected by the app.
- **Event shape v1:**
```json
{"v":1,"type":"save","projectPath":"/abs/repo","filePath":"/abs/repo/src/foo.ts","contentSha1":"da39…","totalLines":140,"bytes":4200,"timestamp":"2026-10-25T09:00:00.000Z","source":"vscode"}
{"v":1,"type":"delete","projectPath":"/abs/repo","filePath":"/abs/repo/src/old.ts","timestamp":"…","source":"vscode"}
{"v":1,"type":"hello","editor":"vscode","version":"0.1.0","timestamp":"…"}
```
  Editors report **only identity and hashes** — never counts (§5.5 rationale). `hello` on editor start and every 5 min feeds the Live pill.
- **Client duties (all three, deliberately tiny):** resolve ingest path → hash + count lines of saved content → dedupe by `(path, hash)` → queue + flush (≥ 2s or 20 events) → append. That's the whole protocol. Any language, any editor.
- **Security:** the app creates the file `0600`; clients must JSON-escape paths (backslashes on Windows!); the app drops events whose `filePath` escapes `projectPath` (§5.5).

### 7.2 VS Code extension (TypeScript, zero dependencies)

```ts
import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { appendFile } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

function ingestPath(): string {
  return process.env.RHEO_INGEST_FILE ?? (
    platform() === 'win32' ? join(process.env.APPDATA ?? '', 'RHEO', 'changes.jsonl')
    : platform() === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'RHEO', 'changes.jsonl')
    : join(homedir(), '.config', 'RHEO', 'changes.jsonl'));
}
type Ev = Record<string, unknown>;
const last = new Map<string, string>();          // path → last emitted hash (client-side dedupe)
let queue: Ev[] = [], timer: NodeJS.Timeout | undefined;

export function activate(ctx: vscode.ExtensionContext) {
  const FILE = ingestPath();
  const emit = (e: Ev) => {
    queue.push({ v: 1, timestamp: new Date().toISOString(), ...e });
    timer ??= setTimeout(flush, 2000);
    if (queue.length >= 20) flush();
  };
  const flush = () => {
    timer && clearTimeout(timer); timer = undefined;
    if (!queue.length) return;
    const payload = queue.splice(0).map(e => JSON.stringify(e)).join('\n') + '\n';
    appendFile(FILE, payload, { mode: 0o600 }, () => { /* next event retries; scan heals */ });
  };
  const rootOf = (p: string) =>
    vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p))?.uri.fsPath;

  ctx.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
    const root = rootOf(doc.uri.fsPath); if (!root) return;           // outside a workspace ⇒ skip
    const text = doc.getText();
    const sha = createHash('sha1').update(text, 'utf8').digest('hex');
    if (last.get(doc.uri.fsPath) === sha) return;                     // autosave echo
    last.set(doc.uri.fsPath, sha);
    emit({ type: 'save', source: 'vscode', projectPath: root, filePath: doc.uri.fsPath,
           contentSha1: sha, totalLines: text.split('\n').length, bytes: Buffer.byteLength(text) });
  }));
  const w = vscode.workspace.createFileSystemWatcher('**');
  w.onDidChange(u => { /* content events are covered by save; keep watcher for deletes: */ });
  w.onDidDelete(u => { const root = rootOf(u.fsPath);
    if (root) emit({ type: 'delete', source: 'vscode', projectPath: root, filePath: u.fsPath }); });
  ctx.subscriptions.push(w, { dispose: flush });
  emit({ type: 'hello', source: 'vscode', editor: 'vscode', version: '0.1.0' });
  setInterval(() => emit({ type: 'hello', source: 'vscode', editor: 'vscode', version: '0.1.0' }), 300_000);
}
```

Packaging notes: `activationEvents: onStartupFinished`; no telemetry, no network; debounce comes from the queue (2s) so autosave storms collapse into one hash check each.

### 7.3 IntelliJ-platform plugin (Kotlin, platform-bundled Gson only)

Hooks: `FileDocumentManagerListener.beforeDocumentSaving` (fires for user saves *and* autosave — dedupe makes that safe) and a `BulkFileListener` for `VFileDeleteEvent`. All hashing/appending happens on a single background thread (never EDT I/O).

```kotlin
class RheoSaver : FileDocumentManagerListener {
  override fun beforeDocumentSaving(document: Document) {
    val text = document.text                       // already in memory; no read action needed here
    IngestQueue.submit(document) {                 // IngestQueue: single-thread executor
      val path = IngestQueue.pathOf(document) ?: return@submit
      val sha = sha1(text)
      if (IngestQueue.seen(path, sha)) return@submit
      IngestQueue.append(json(v = 1, type = "save", source = "intellij",
        projectPath = IngestQueue.projectRootOf(path) ?: return@submit,
        filePath = path, contentSha1 = sha,
        totalLines = text.count { it == '\n' } + if (text.isNotEmpty() && !text.endsWith('\n')) 1 else 0,
        bytes = text.toByteArray(Charsets.UTF_8).size))
    }
  }
}
// register in plugin.xml:
// <applicationListeners>
//   <listener topic="com.intellij.openapi.fileEditor.impl.FileDocumentManagerListener"
//             implementation="…RheoSaver"/>
// </applicationListeners>
// <projectListeners>
//   <listener topic="com.intellij.util.messages.Topic[BulkFileListener]" implementation="…RheoFiles"/>
// </projectListeners>
```

`IngestQueue` (companion): `ConcurrentHashMap<String, String>` for dedupe, ` Executors.newSingleThreadExecutor()`, `BufferedWriter(FileWriter(path, true))` + `"\n"` per event, Gson (`com.google.gson` — ships with the IntelliJ Platform, not an npm/gradle dep) for JSON escaping. `projectRootOf` walks the VFS to the containing `Project` and returns `project.basePath`. Deletes: map `VFileDeleteEvent` URLs to their project, emit `type:"delete"`. Same `hello` heartbeat as VS Code (via `AppLifecycleListener`).

### 7.4 Universal fallback (any editor / headless): stdlib-only Python watcher

The JSONL contract is the compatibility story: ~30 lines of Python stdlib cover every other editor and CI boxes — poll a folder every 30s, emit `save` on sha1 change, `delete` on vanish:

```python
#!/usr/bin/env python3
import hashlib, json, os, time
INGEST = os.environ.get("RHEO_INGEST_FILE") or os.path.expanduser(
    "~/Library/Application Support/RHEO/changes.jsonl" if __import__("sys").platform == "darwin"
    else (os.path.join(os.environ.get("APPDATA", ""), "RHEO", "changes.jsonl") if os.name == "nt"
          else "~/.config/RHEO/changes.jsonl")).replace("~", os.path.expanduser("~"))
ROOT, state = os.environ["RHEO_WATCH_DIR"], {}
def emit(ev): open(INGEST, "a").write(json.dumps(ev, separators=(",", ":")) + "\n")
while True:
    seen = {}
    for d, _, files in os.walk(ROOT):
        if any(x in d for x in ("/.git/", "/node_modules/")): continue
        for f in files:
            p = os.path.join(d, f)
            try:
                b = open(p, "rb").read()
                seen[p] = hashlib.sha1(b).hexdigest()
                if state.get(p) != seen[p] and p in state:
                    emit({"v":1,"type":"save","source":"watcher","projectPath":ROOT,"filePath":p,
                          "contentSha1":seen[p],"totalLines":b.count(b"\n")+ (0 if b.endswith(b"\n") or not b else 1),
                          "bytes":len(b),"timestamp":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
            except OSError: pass
    for p in state:
        if p not in seen:
            emit({"v":1,"type":"delete","source":"watcher","projectPath":ROOT,"filePath":p,
                  "timestamp":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    state, _ = seen, time.sleep(30)
```

(`RHEO_WATCH_DIR=/path/to/folder python3 watcher.py` — first run populates state without emitting, mirroring the app's first-scan re-baseline.)

---

## 8. Verification Plan — probes, not claims

Every probe is a runnable command with an expected output; "done" means the probe printed `PASS`. Fixtures are created by `scripts/probe/fixtures.sh` (idempotent): a git repo `probe-repo` (known history) and a plain folder `probe-plain`, plus a 5k-file tree for perf.

| ID | Probe | Command / action | Expected (PASS condition) |
|---|---|---|---|
| P1 | Diff engine correctness | `node scripts/probe/line-diff.mjs` — 12 fixture pairs (insert-only, delete-only, replace, CRLF flip, empty file, whole-file rewrite, unicode) | prints `PASS` when counts match the hard-coded truth table exactly, incl. CRLF flip → `0/0` |
| P2 | 0/0 never stored | `sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM project_file_changes WHERE added=0 AND removed=0"` | `0` |
| P3 | Ground truth vs git | In `probe-repo`: make 3 known edits (append 5 lines / delete 2 / rewrite 3); capture `git diff --numstat`; scan via UI; `sqlite3 -readonly … "SELECT file_path, added, removed FROM project_file_changes ORDER BY id DESC LIMIT 3"` | DB rows equal numstat exactly (mod CRLF rule) |
| P4 | No double-count | Scan twice in a row (button ×2, or focus-triggered auto) | Second scan: summary `+0 / −0 / 0 files`, zero new rows (`SELECT MAX(id)` unchanged) |
| P5 | Ingest dedupe + self-heal | Append the same valid `save` event to `changes.jsonl` twice + 1 malformed line; wait 5s (poll); check status via DevTools → `getChangesIngestStatus()` | `ingested:1, unchanged:1, droppedMalformed:1`; DB has exactly one delta row for the file |
| P6 | Guardrails | Append events with (a) unknown `projectPath`, (b) `filePath` outside `projectPath`, (c) `"v":2` | counters `droppedUnknownProject:+1, droppedEscape:+1, droppedVersion:+1`; no rows |
| P7 | Editor→ledger round trip | In `probe-plain` (non-git): edit a file, append a real event (sha1 via `sha1sum`), then press Scan | event delta recorded once; scan adds nothing extra (hash-equal) — **the double-count kill shot** |
| P8 | Bulk guard + first-scan baseline | Point a fresh project at the 5k-file tree; scan | `rebaselined: 5000`, zero delta rows; then touch 3 files, scan → exactly 3 rows |
| P9 | Performance | Time the 5k-tree scans (dev console in main) | cold (hash+baseline) < 10s; warm no-op (all hash-equal) < 2s; UI never blocks (async handler) |
| P10 | DB size | `du` the DB before/after enabling `content_gz` on the fixture | ≥ 40% smaller than raw-text equivalent |
| P11 | Channel wiring | `rg "get-changes-ingest-status" src/` | exactly 2 hits: preload invoke + `ipcMain.handle` |

Failure signatures worth documenting: P4 failing ⇒ a window overlap survived (someone reintroduced baseline numstat); P5 `ingested:2` ⇒ dedupe not keyed on hash; P7 mismatching ⇒ scan and ingest diverged into two engines — the whole design review is "there is one engine".

---

## 9. Build Order & Constraint Compliance

**Build order (≈ 4.5 days):**

| Phase | Scope | Files | Est |
|---|---|---|---|
| A | Schema ALTERs + `lineDiff.ts` + shared `countLines`/ignore-list extraction + scan v2 (ledger) | `src/main.ts` (migration + scan handler), `src/main/lib/lineDiff.ts`, `src/main/lib/scanShared.ts` | 0.75d |
| B | Ingest service (poll, collapse, resolve, guards, counters) + bootstrap + `get-changes-ingest-status` | `src/main/lib/ingest.ts`, `src/main.ts`, `src/preload.ts` | 0.75d |
| C | VS Code extension from §7.2 | `extensions/vscode/` | 0.5d |
| D | IntelliJ plugin from §7.3 | `extensions/intellij/` | 1.0d |
| E | UI v2 (states matrix, strip, table, Live pill, auto-scan pref) | `src/components/line-stats/useFileChanges.ts`, `ProjectFileChanges.tsx` | 0.75d |
| F | Probes P1–P11 + fixtures script + README update (retire the 3-option transport section) | `scripts/probe/`, `agent/docs/feature-docs/ide-file-change-tracking/README.md` | 0.5d |

**Constraint compliance:**

| Constraint | How it holds |
|---|---|
| Existing IPC/preload/main/DB conventions | §4.1 uses the exact `useJson` + `{success, data\|error}` wrapper; one new channel, wired by name in the checklist table |
| No new npm dependencies | `lineDiff` is in-repo Myers; zlib/crypto/fs are Node built-ins; Gson ships with the IntelliJ Platform; VS Code ext and Python watcher are zero-dep |
| Single-writer DB (better-sqlite3) | Only the Electron main process writes; editors/daemons append a flat file; probes read with `sqlite3 -readonly` |
| Agents can't build — probe, not claim | §8: eleven runnable probes with PASS conditions and failure signatures |
| Every preload channel ↔ handler | §4.1 table + probe P11 (grep-enforced) |
| VS Code + IntelliJ minimum | §7.2 / §7.3 skeletons on the same contract; §7.4 covers everything else |
| Works for non-git folders | The ledger never needs git; git only decorates `baseline_commit` when present |

**Final note on semantics.** This spec deliberately trades "which commit contributed these lines" for "one number you can trust from any editor, any folder, any order of events." The first is a git log view (already shipped via `get-git-diff`); the second is the feature the user asked for. Every design decision above — snapshot ledger, dumb clients, self-healing ingestion, re-baseline guard — exists to protect the trustworthiness of that one number.


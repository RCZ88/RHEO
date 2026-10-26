# CONTEXT BUNDLE — IDE File Change Tracking (per-file added/removed lines)

Generated: 2026-10-24. Self-contained reference for the target AI.

## 1. Raw request (verbatim)

> "can you make so that the ide project subapgeo f hte prrojects can detect hte
> line changes not just hte mamoutn of lines but like the amount of lines made
> and added to each file. so like maybe handing on a script and then avscode
> extnsion or a intelij exnteion an editor extneiosn that is compatible iwth
> all ides andl ike be able to have like git styyle changes thing"

## 2. What already exists

### 2.1 Line-count snapshot system (already shipped)
- `src/components/line-stats/useLineStats.ts` — single data pipeline for every
  Code Stats surface. `scan()` calls `countProjectLines`; `reload()` calls
  `getProjectLineStats`. Raw payload cached in a ref so ignore-list changes
  re-derive without a rescan.
- `src/components/line-stats/ProjectLineStats.tsx` — renders cards, chart, table.
- IPC: `count-project-lines`, `get-project-line-stats`, `delete-project-line-stats`
  (preload lines ~710-714).
- DB table `project_line_stats` (project_id, file_path, file_type, total_lines,
  blank_lines, comment_lines, code_lines, scanned_at).

### 2.2 Git diff (already shipped)
- `get-git-diff` (main.ts ~20609): runs `git diff [--cached]` for a project,
  returns the raw unified diff text.

### 2.3 What is MISSING
Per-file **added/removed** deltas (git-style `+N / -M`), tracked over time, for
ANY folder (git or not), plus an editor-extension protocol so changes can be
reported live from VS Code / IntelliJ / any editor.

## 3. What was just implemented (the baseline for this prompt)

### 3.1 DB schema (src/main.ts, migration block ~2720-2760)

```sql
CREATE TABLE IF NOT EXISTS project_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  added INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  total_lines INTEGER NOT NULL DEFAULT 0,
  baseline_commit TEXT,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL DEFAULT 'snapshot',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_file_changes_project ON project_file_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_scanned ON project_file_changes(project_id, scanned_at);

CREATE TABLE IF NOT EXISTS project_file_snapshots (
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content TEXT,
  total_lines INTEGER NOT NULL DEFAULT 0,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, file_path),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 3.2 Types (src/types/line-stats.ts)

```ts
export interface FileChangeResult {
  filePath: string;
  fileType: string;
  added: number;
  removed: number;
  totalLines: number;
}

export interface FileChangeSummary {
  filesChanged: number;
  added: number;
  removed: number;
}

export interface FileChangeData {
  files: FileChangeResult[];
  summary: FileChangeSummary;
  scannedAt: string | null;
  source: 'git' | 'snapshot';
  baselineCommit: string | null;
  totalFiles: number;
  totalRows?: number;
}
```

### 3.3 IPC handlers (src/main.ts ~13779-14030)

Three handlers, all follow the `useJson` guard + try/catch + `{success, data/error}`
wrapper:

- `scan-project-changes(projectPath, projectId, options?)` →
  `{ success, data: { files, summary, scannedAt, source, baselineCommit, totalFiles } }`
- `get-project-changes(projectId, limit?)` → cumulative per-file totals + history
- `delete-project-changes(projectId)` → wipes deltas + snapshots

**Git path** (isGit): `git rev-parse HEAD` → baseline_commit from last scan; then:
1. committed: `git diff --numstat <prevBaseline>..HEAD`
2. staged: `git diff --numstat --cached`
3. unstaged: `git diff --numstat`
4. untracked: `git ls-files --others --exclude-standard` → each file's lines = added
5. total_lines = current file size

Merge all into a Map<filePath, {added, removed, total, type}>; store only 0/0-excluded rows.

**Non-git path** (snapshot): walk tree (same skip rules as count-project-lines), hash
each file (sha1), compare to stored snapshot. Changed file → real diff via
`git diff --no-index --numstat oldTmp newTmp`. New file → all lines added. Deleted
file → all lines removed. Upsert snapshot (content capped at 512KB).

Key helpers:
```ts
const _parseNumstat = (text) => Map<filePath, {added, removed}>  // handles renames "a => b", binary "-"
const _countFileLines = (fullPath) => number  // 0 for binary / >512KB
const _gitDiffNoIndex = (oldPath, newPath) => {added, removed}  // catches exit code 1
```

**Accuracy rules enforced:** renames collapse to the new path; binary files skipped
(`\0` check); 0/0 deltas never stored; untracked = all lines added; deleted = all
lines removed.

### 3.4 Preload (src/preload.ts ~713-722)

```ts
scanProjectChanges: (projectPath, projectId, options?) => ipcRenderer.invoke('scan-project-changes', projectPath, projectId, options),
getProjectChanges: (projectId, limit?) => ipcRenderer.invoke('get-project-changes', projectId, limit),
deleteProjectChanges: (projectId) => ipcRenderer.invoke('delete-project-changes', projectId),
```

### 3.5 Renderer (src/components/line-stats/)

- `useFileChanges.ts` — hook mirroring useLineStats: `scan()`, `reload()`, data/error/isScanning.
- `ProjectFileChanges.tsx` — summary (+N added / -M removed / K files) + per-file
  table (File, Added, Removed, Total) + "Scan changes" button. Uses design tokens
  (`--text-primary`, `--text-muted`, `--ws-surface-recess-deep`, `--ws-border-strong`).
- Wired into `ProjectLineStats.tsx` below the existing file detail table.

### 3.6 Editor extension protocol (agent/docs/feature-docs/ide-file-change-tracking/README.md)

Transport options: HTTP POST to sync server, JSONL file drop
(`~/.config/RHEO/changes.jsonl`), or CLI. Event shape:
```json
{ "projectId": "...", "filePath": "src/foo.ts", "added": 12, "removed": 3,
  "totalLines": 140, "timestamp": "...", "source": "vscode" }
```
Reference skeletons for VS Code and IntelliJ; universal fallback is a file-watcher
daemon (like `rheo-tracker.service`) using `git diff --no-index`.

## 4. IPC convention (end-to-end example)

preload.ts:
```ts
foo: (arg: string) => ipcRenderer.invoke('foo', arg),
```
main.ts:
```ts
electron_1.ipcMain.handle('foo', async (_: any, arg: string) => {
  if (useJson) return { success: false, message: 'Requires SQLite' };
  try { ... return { success: true, data }; }
  catch (err: any) { return { success: false, error: err.message }; }
});
```

## 5. Design tokens (Warm Paper / LAMINAR)

- Surfaces: `--ws-surface-sunken` (fields), `--ws-surface-recess-deep` (hover),
  `--ws-border-strong` (control boundary, 4.29:1), `--ws-veil`.
- Text: `--text-primary`, `--text-secondary`, `--text-muted`.
- Accent: `--page-accent` / `--page-accent-fill` / `--page-accent-on-fill`.
- Selection = signal hue, never a zinc step (zinc ramp is NOT remapped in light).
- Radii: 8 / 12 / pill only. Motion: L1 Composed (150ms, transition-colors).
- Dark mode: `text-white` is netted to ink in light (`index.css:647`).

## 6. Open questions for the design

1. Should `scan-project-changes` also run automatically on `count-project-lines`
   (so the two stay in sync), or stay a separate action?
2. Editor-extension ingestion: HTTP endpoint on the sync server vs. JSONL tail —
   which is more robust given the single-writer DB constraint?
3. Should changes be attributed to a "session" (the existing session system) so
   per-developer deltas are visible?
4. Rename detection: currently collapses to the new path with 0/0 delta lost.
   Should renames be reported as delete+add with the full counts?
5. Performance: storing full file content in `project_file_snapshots` doubles DB
   size for large repos. Cap at 512KB/file (already done) — is that enough?
6. UI: where should the changes view live — inside Code Stats tab, a new tab,
   or the IDE Projects overview?

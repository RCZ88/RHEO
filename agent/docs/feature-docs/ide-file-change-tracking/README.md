# IDE File Change Tracking — Design & Protocol\n\n> **Transport decision (RESULT.md): JSONL file drop is the chosen spine.** HTTP and CLI\n> transports from the earlier draft are retired — they either violate the\n> single-writer DB rule or add lifecycle coupling. Editors append to\n> `changes.jsonl`; only the Electron main process writes the DB.

## Goal
Track per-file added/removed lines ("git-style" deltas) for every IDE project,
regardless of whether the project is a git repo and regardless of which editor
is used. The app already does this for git repos and for any folder via
snapshot diffing (`scan-project-changes` IPC). This document covers the
remaining piece: **editor extensions** that report changes in real time.

## Why an extension at all
Git-based tracking is accurate but only sees committed/uncommitted deltas at scan
time. It misses:
- changes in non-git folders where files are edited but never "scanned",
- line-level attribution while the user is typing (before save),
- editors that don't leave a `.git` (scratch dirs, monorepo sub-packages).

An extension reports deltas as they happen, so the app's "changes" view is live
instead of scan-gated.

## Data contract (app side)
The app exposes (main process, `src/main.ts`):

- `scan-project-changes(projectPath, projectId, opts?)` → `{ files: [{filePath, fileType, added, removed, totalLines}], summary, scannedAt, source, baselineCommit }`
- `get-project-changes(projectId, limit?)` → cumulative per-file totals + history
- `delete-project-changes(projectId)` → wipes deltas + snapshots

Storage: `project_file_changes` (append-only deltas) and `project_file_snapshots`
(content hash + content for non-git diffing). Both cascade on project delete.

## Extension protocol (v1)
An extension reports a **change event** for a single file:

```json
{
  "projectId": "proj-...",
  "filePath": "src/foo.ts",          // path relative to the project root
  "added": 12,                      // lines added in this event
  "removed": 3,                     // lines removed in this event
  "totalLines": 140,                // current total lines of the file
  "timestamp": "2026-10-24T12:00:00.000Z",
  "source": "vscode"                // editor id
}
```

### Transport options (pick one per editor)
1. **HTTP** — POST the event to `http://127.0.0.1:<port>/changes` (the app's
   sync server, already running on a known port). Simplest, works for any editor.
2. **File drop** — append a JSON line to
   `~/.config/RHEO/changes.jsonl`. The app tails this file on each
   `get-project-changes` / scan. No port discovery needed; survives app restarts.
3. **CLI** — `rheo track-change --project <id> --file <rel> --added N --removed M`.

The app ingests events with `source = 'editor:<id>'` so they are distinguishable
from `git`/`snapshot` scans in the UI.

### What the extension must do
- On file save (or on a debounced idle), compute the delta vs the last reported
  version of that file (the extension keeps its own baseline in memory / a
  small state file).
- Report only real deltas (skip 0/0).
- Use relative paths (the project root is the workspace folder).
- Batch events (max 50 per POST) to avoid hammering the app.
- Reconnect on failure; queue locally if the app is down.

### Reference: VS Code extension skeleton
```
my-extension/
  package.json        // contributes commands + activationEvents onWorkspaceContains
  src/extension.ts    // vscode.workspace.onDidSaveTextDocument -> compute delta -> POST
```
Compute delta with `vscode.diff` between the saved document and the previous
version (kept in a Map<uri, string>), count `+`/`-` lines, then POST.

### Reference: IntelliJ plugin skeleton
Use `DocumentListener` + `VirtualFileListener` to detect saves, compute the
delta with IntelliJ's `DiffUtil`, POST via `OkHttpClient`.

### Universal (language-server / file-watcher) option
A small daemon (like the existing `rheo-tracker.service`) using `chokidar`/`inotify`
to watch the project tree, hashing each file on change and diffing via
`git diff --no-index` (already implemented server-side) — works for ANY editor
with zero extension install. This is the recommended fallback and reuses the
non-git snapshot path already in `scan-project-changes`.

## Accuracy rules (must hold for any source)
- A rename is a delete + add (do not report 0/0).
- Binary files are skipped (no line counts).
- A 0/0 delta is never stored (noise).
- Untracked new files count every line as "added".
- Deleted files count every line as "removed".
- Deltas are append-only; the UI aggregates.

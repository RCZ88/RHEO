# PROMPT — IDE File Change Tracking: Per-File Added/Removed Lines (Git-Style)

## Raw Request (verbatim)

> "can you make so that the ide project subapgeo f hte prrojects can detect hte
> line changes not just hte mamoutn of lines but like the amount of lines made
> and added to each file. so like maybe handing on a script and then avscode
> extnsion or a intelij exnteion an editor extneiosn that is compatible iwth
> all ides andl ike be able to have like git styyle changes thing"

## Context Bundle

Read `CONTEXT_BUNDLE.md` in this same folder FIRST. It contains the exact DB
schema, IPC handlers, types, preload wiring, renderer hook, and design tokens.
Do not guess shapes — use the bundle as the source of truth.

## Problem Statement

The app already counts **total lines per file** (`count-project-lines`) and shows
a snapshot. It does NOT show **how many lines were added or removed** per file,
git-style (`+42 / -3`), and it has no way to capture changes from editors that
are not git repos or that are not scanned. The user wants a proper, accurate
change-tracking system across all IDEs.

## The Mandate

Design and specify the complete solution for per-file line-change tracking. You
are the Lead Designer and Engineer. Own it end to end: data model, backend logic,
UI, and the editor-extension protocol. Do not offer Option A/B/C — design the
best version.

## Engineering Task

1. **Data Processing Pipeline** — how deltas are computed (git path vs snapshot
   path), how renames/untracked/deleted/binary files are handled, how
   cumulative totals aggregate across scans, and how the "since last scan" delta
   avoids double-counting committed vs working-tree changes.
2. **Accuracy rules** — binary skip, 0/0 never stored, untracked = all lines
   added, deleted = all lines removed, rename = delete + add.
3. **Editor extension ingestion** — HTTP vs JSONL vs CLI; batching; offline queue;
   how the app ingests editor-reported deltas without breaking the
   single-writer DB constraint.
4. **Performance** — content storage cap, scan cost, large-repo handling.

## Design Task

High-fidelity visual specs for the changes surface:
- Summary strip (`+N added / -M removed / K files`).
- Per-file table (File, Added, Removed, Total) with sorting and truncation.
- States: idle / loading / empty / error / populated.
- Light-mode token usage (see bundle §5) — no zinc-step selections, no raw hex.
- Placement: inside Code Stats vs. new tab vs. IDE Projects overview.

## UX Task

- Interaction flow: when does a scan happen (manual button, auto on scan, on
  save)? How is "last scan" surfaced?
- Empty state: what does the user do first?
- Error state: rate limits, unreachable paths, non-git folders.
- How does the user tell git-derived deltas from editor-reported ones?

## Constraints

- Must work with the existing IPC/preload/main/DB conventions (see bundle §4).
- Must not introduce new npm dependencies (cmdk/@base-ui are absent; stay
  dependency-free).
- Must respect the single-writer DB rule (better-sqlite3).
- Agents cannot build; verification must be a probe, not a claim.
- Every new preload channel needs a matching `ipcMain.handle` (check by name).

## Open Questions (answer in your spec)

See bundle §6.

## Output Format

Markdown. A complete technical + visual specification with:
- Data model (exact SQL)
- IPC contracts (channel, payload, return shape)
- Backend logic (step-by-step, including edge cases)
- UI spec (tokens, spacing, states, interactions)
- Editor extension protocol (transport, event shape, reference skeletons)
- Verification plan (what to measure, how to prove it works)

Do NOT output multiple options. Design the best version and justify choices.

# GAS-DECISIONS.md — Implementation Decisions & Deviations

> Documented per spec requirement: "Document any decisions or deviations in a GAS-DECISIONS.md file"

## Phase 1: Infrastructure Foundation — ✅ COMPLETE

### Decisions
1. **Secrets mechanism**: Used `gas-secrets.json` in `userData` (same pattern as `sync-auth.json`). Read/write via `src/main/gas/secrets.ts`.
2. **IPC channel names**: `gas:sync` and `gas:export` as specified.
3. **Pending queue**: JSON file (`gas-pending-syncs.json`) in `userData` instead of SQLite table — simpler, no schema migration needed. Can be migrated to SQLite later.
4. **HTTP client**: Uses `fetch` API (available in Electron main process). 1 retry, 2s backoff, 30s timeout.
5. **Import path**: `./main/gas/ipc` from `src/main.ts` (relative to the file structure, consistent with `./main/syncAgent` etc.).

### Deviations
- **Phase 4 blocked**: GS-4 (Event-Driven Ingestion) is conditional pending privacy ruling. Not implemented.
- **UI indicators not added**: The spec mentions "sync pending indicator" but Phase 1 explicitly says "Do NOT add any UI yet". The `useGasSyncStatus` hook is provided for renderer use but no UI components were added.

## Phase 2: GS-1 Context Brain Cloud Mirror — ✅ COMPLETE

### Decisions
1. **Facts/triples only**: `pushTriples()` reads from `contextBrain.getAllCurrentFacts()` and converts to Triple format. Raw episodes are never transmitted.
2. **Episode-writer pipeline**: `pullTriples()` writes via `contextBrain.addFact()` preserving Context Brain's bitemporal integrity.
3. **Chunking**: 5MB threshold. Payload split in half when exceeded.
4. **Nightly scheduler**: Default 3 AM. Uses `setTimeout` + `setInterval`. `triggerSyncNow()` available for manual trigger.
5. **Privacy compliance**: `contextBrain.logEpisode()` called with source `'gas-sync'` to track sync activity without exposing raw content.

## Phase 3: GS-2 + R-22 Artifact Exports — ✅ COMPLETE

### Decisions
1. **Exporters as separate modules**: `docs.ts`, `sheets.ts`, `forms.ts` each handle formatting for their target.
2. **Export router**: `exporters/index.ts` dispatches by `target` field.
3. **Chunking**: Each exporter checks payload size and splits into halves when >4MB.
4. **User-initiated only**: All exports go through `gas:export` IPC channel triggered by renderer button clicks.
5. **Usage ledger export**: Sheets exporter can handle AI usage data (token counts, costs, sessions).

### UI Integration Notes
- Export buttons need to be added to existing pages (Journal, Gold Goals, Learn, Resume, Transcripts, AI Usage)
- Each button calls `window.deskflowAPI.gasExport({ target, source, content, meta })`
- Toast notifications should be shown on success/failure
- No new dashboard surfaces created (§16 compliance)

## Phase 4: GS-4 Event-Driven Ingestion — BLOCKED

- Waiting on principal's privacy tier ruling
- All preparatory code (parser, oauth, pipeline structure) designed but not implemented
- Blocked by: privacy ruling, OAuth scope definition, GS-1/GS-2 stability

## Test Results

- `npx tsc --noEmit --project tsconfig.app.json`: Pre-existing errors only (App.tsx has unused imports, not related to gas)
- `node scripts/build.mjs`: Main process compiles all gas files to `dist-electron/main/gas/`
- `npx esbuild src/preload.ts`: Preload builds successfully (124.3kb) with `gasSync`/`gasExport` exposed
- All 10 gas source files verified: types, secrets, client, ipc, context-mirror, scheduler, exporters (docs/sheets/forms/index), hook

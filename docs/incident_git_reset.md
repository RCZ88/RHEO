# Incident Report — git reset --hard + blank content area

## Timeline
- 2026-09-02/03: A destructive `git reset --hard` was executed, wiping uncommitted working-tree files.
- Post-incident partial repair attempted but left the repo in a mixed state: source fixes were applied, but `dist/`, `dist-electron/`, and `node_modules/.vite/` were empty on disk.
- 2026-09-03: Recovery performed — backup branch `backup/pre-repair-20260903` created, stale `.d.ts` files removed, source corruption patched, rebuild executed, runtime verified via fresh Electron launch.

## Root Cause
The blank content area on every route was caused by **empty dist artifacts**, not a broken route table or TitleBar regression. Electron started, served an empty bundle, so `#root` rendered with no React tree. The empty `dist/`/`dist-electron/`/`.vite/` came from the reset/repair sequence wiping build outputs and no rebuild being run afterward.

## Artifact Verdicts
- `src/services/ai/aiAgentService.ts` — fallback `apiKey` object was corrupted with redaction artifact; restored to env lookup only.
- `src/services/ai/aiAgentService.test.ts` — invalid `vi.mock` syntax fixed.
- `src/main.ts` — `window:focus-change` IPC handler fixed to use `mainWindow.isFocused()`.
- `src/main.tsx` — `__DESKFLOW_LOADED` renamed to `__RHEO_LOADED`.
- `src/components/MonthWall/MonthWall.tsx` — component exists; no route fix needed.

## Secrets
No hardcoded apiKey found after repair. Restored as `process.env?.OPENROUTER_API_KEY` lookup only.

## MonthWall Disposition
`src/components/MonthWall/MonthWall.tsx` exists and is mounted from `src/features/warmth/gold/GoldPage.tsx`. The `/gold` route is reachable only through the Life page tab system, not directly from the sidebar; it is not orphaned, but it is also not a top-level sidebar entry.

## Prevention Rules
1. Create `backup/auto-YYYY-MM-DD` branch before ANY destructive git operation (reset/checkout --/clean).
2. Do not invent new components during repairs — restore from history/backups or stop and report.
3. `tsc --noEmit` is a gate after any recovery.
4. `dist/`, `dist-electron/`, `node_modules/.vite/` are gitignored artifacts — verify existence + rebuild after any history operation.

# Incident Report — git reset --hard + blank content area

## Timeline
- 2026-09-02/03: A destructive `git reset --hard` was executed, wiping uncommitted working-tree files.
- Post-incident partial repair attempted but left the repo in a mixed state: source fixes were applied, but `dist/`, `dist-electron/`, and `node_modules/.vite/` were empty on disk.
- 2026-09-03: Recovery performed — backup branch `backup/pre-repair-20260903` created, stale `.d.ts` files removed, source corruption patched, rebuild executed, runtime verified via fresh Electron launch.

## Root Cause
The blank content area on every route had **two contributing causes**:

1. **Empty dist artifacts** — `dist/`, `dist-electron/`, and `node_modules/.vite/` were wiped to 0 bytes by the `git reset --hard` on 2026-09-02/03; no rebuild was run afterward, so Electron served an empty bundle and `#root` rendered with no React tree.

2. **Invented resizer family + flex chain collapse** — `src/components/dashboard/QuadCardSlotResizer.tsx`, `CardHeightResizer.tsx`, and `ResizableHeightHandle.tsx` measured containers and wrote inline pixel sizes via ResizeObserver/MutationObserver. On a zero-height measure moment (after the flex-col shell change that introduced the TitleBar), the resizer pinned content containers to `height: 0px`. The DOM was present but computed height was 0px, so only the sidebar rendered and the content area was blank. The resizer family was deleted and replaced with pure CSS grid (`grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-2 gap-2 flex-1 min-h-0`, cards `h-full min-h-0 overflow-auto`). No new components; CSS only.

**Lesson (verification-gap):** renderer-attach tests must be accompanied by a real shell-launch smoke test. The prior repair verified the renderer attach but did not confirm the Electron shell reaches rendered content on cold launch — that gap allowed the 0px-height collapse to go undetected until the user reported it.

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

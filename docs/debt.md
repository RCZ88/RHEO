# Debt Log — known issues to address later

## Resolver family (RESOLVED)
- `src/components/dashboard/QuadCardSlotResizer.tsx`, `CardHeightResizer.tsx`, `ResizableHeightHandle.tsx` — RESOLVED 2026-09-03. Invented resizer family measured containers and wrote inline pixel sizes via ResizeObserver/MutationObserver; on a zero-height measure moment it pinned content to 0px (the blank-content root cause). Replaced with pure CSS grid: `grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-2 gap-2 flex-1 min-h-0`, cards `h-full min-h-0 overflow-auto`. No new components; CSS only. Commits: `fc98646`, `428fc88`.
- Root cause #3: invented resizer + shell change (TitleBar flex-col) = 0px collapse. Lesson: invented repair components get deleted, not kept (design.md §13, perf law).

## Finance/main
- `dist-electron/main/migrations/001_relax_role_check.sql` missing after build; migration runner throws ENOENT on boot.
- `src/services/RAGService.ts` references `ServiceResponse`, `RAGMessage`, `MessageRole` that are undefined in module scope — DEFERRED: structural type cascade exceeds 20-line threshold; logged to `docs/debt.md`, not fixed in-place. tsc --noEmit gate passes outside these errors.
- `src/services/SymbolIndexService.ts` and `src/services/WorkspaceStateService.ts` use type imports without `type` keyword under `verbatimModuleSyntax`.

## Frontend components
- `src/components/ui/v-calendar.tsx` — current VCalendar is effectively a single-option select, not a real date picker.
- `src/components/ui/glare-hover.tsx` — current implementation is an empty passthrough; the actual glare sweep effect needs a LAMINAR pass (white ≤8%, hover-only, RM off) or usages should be removed.

## Learn types
- `src/shared/learn/types.ts` — `AnnotatedCodeBlock`/`AnnotatedMathBlock` extend `BaseBlock` with invalid literal `type` values; needs narrowing against `BlockType`.

## Stores
- `src/stores/resumeStore.ts` — type inference on `set`/`get` callbacks in Zustand `persist` produces massive implicit-any noise; acceptable under `noImplicitAny: false` in `tsconfig.app.json`.

## Naming
- `src/App.tsx` and `src/components/TitleBar.tsx` still carry `DeskFlow` console labels / comments despite the app branding being `RHEO`.
- `src/stores/resumeStore.ts` — Zustand `set`/`get` generic inference causes massive TS7006 noise; fixing would cascade >20 lines and risk runtime regression. Defer.

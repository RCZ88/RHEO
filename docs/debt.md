# Debt Log — known issues to address later

## Finance/main
- `dist-electron/main/migrations/001_relax_role_check.sql` missing after build; migration runner throws ENOENT on boot.
- `src/services/RAGService.ts` references `ServiceResponse`, `RAGMessage`, `MessageRole` that are undefined in module scope.
- `src/services/SymbolIndexService.ts` and `src/services/WorkspaceStateService.ts` use type imports without `type` keyword under `verbatimModuleSyntax`.

## Frontend components
- `src/components/dashboard/QuadCardSlotResizer.tsx` — replace height-drag logic with CSS grid 2×2 layout.
- `src/components/ui/v-calendar.tsx` — current VCalendar is effectively a single-option select, not a real date picker.
- `src/components/ui/glare-hover.tsx` — current implementation is an empty passthrough; the actual glare sweep effect needs a LAMINAR pass (white ≤8%, hover-only, RM off) or usages should be removed.

## Learn types
- `src/shared/learn/types.ts` — `AnnotatedCodeBlock`/`AnnotatedMathBlock` extend `BaseBlock` with invalid literal `type` values; needs narrowing against `BlockType`.

## Stores
- `src/stores/resumeStore.ts` — type inference on `set`/`get` callbacks in Zustand `persist` produces massive implicit-any noise; acceptable under `noImplicitAny: false` in `tsconfig.app.json`.

## Naming
- `src/App.tsx` and `src/components/TitleBar.tsx` still carry `DeskFlow` console labels / comments despite the app branding being `RHEO`.
- `src/stores/resumeStore.ts` — Zustand `set`/`get` generic inference causes massive TS7006 noise; fixing would cascade >20 lines and risk runtime regression. Defer.

/**
 * index.ts — pure barrel.
 *
 * Deliberately contains NO data and NO logic beyond re-exports, so it can sit
 * above both `manifests.ts` (data) and `registry.ts` (logic) without creating a
 * cycle. See the circular-dependency note in `manifests.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AGENTS.md §5d — A NEW PAGE OR SUB-PAGE MUST BE REGISTERED IN `manifests.ts`.
 * This file should never need editing for a new page.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export { PAGE_MANIFESTS } from './manifests'

export type {
  PageManifest,
  SectionSpec,
  TabSpec,
  TabModel,
  FindSpec,
  TutorialStepSpec,
  SearchSegmentSpec,
} from './types'

export { isKnownIcon, ICON_NAMES, ICONS, resolveIcon, FALLBACK_ICON } from './icons'

export {
  PALETTE_ENTRIES,
  PAGE_ROUTES,
  TUTORIAL_STEPS,
  getManifest,
  getPaletteEntry,
  manifestForPath,
  pageIdForPath,
  resolvePageRoute,
  tabIdsFor,
} from './registry'
export type { PaletteEntry } from './registry'

export { usePageSurface } from './usePageSurface'
export type { PageSurface, PageSurfaceOptions } from './usePageSurface'
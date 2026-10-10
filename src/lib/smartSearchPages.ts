/**
 * smartSearchPages.ts — pageId -> route, for the Ctrl+F result-click handler.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS LIST IS NOW DERIVED FROM THE PAGE REGISTRY.
 *
 * It used to be 89 hand-written keys that had drifted out of sync with everything
 * else in the app. Concretely, three of its keys pointed at `/focus`, a route
 * that does not exist — `App.tsx:40` imports `FocusPage` but never routes it — so
 * selecting any of those results navigated to `NotFoundPage`.
 *
 * It also spelled ids with a hyphen (`resume-build`, `activity-apps`) while the
 * palette spelled the same destinations with a dot or a slash (`life.notes`,
 * `terminal/context`), and `App.tsx` minted a THIRD spelling by slicing the
 * pathname (`resume/build`). One destination, three ids, three resolvers.
 *
 * One registry, one spelling. If a page is not in `src/pages/registry/`, it is
 * not reachable — and `npm run validate:pages` enforces that.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { PAGE_ROUTES } from '../pages/registry'

export const SMART_SEARCH_PAGES: Record<string, { route: string; tab?: string }> = PAGE_ROUTES

export function resolvePageRoute(pageId: string): { route: string; tab?: string } | null {
  return SMART_SEARCH_PAGES[pageId] ?? null
}
/**
 * usePageSurface.ts — the single hook a page calls to join the navigation system.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES
 *
 * Every page used to hand-roll some subset of this:
 *   • read `location.state.tab` and hope deepNav wrote the key it expected
 *   • read `localStorage['<something>-activeTab']` with a name it invented
 *   • parse `?tab=` out of `window.location.hash` because `location.search` is
 *     always empty under `HashRouter`
 *   • publish curated search segments for Ctrl+F
 *   • declare tour steps in a second file keyed by a third spelling of its id
 *
 * Each of those was a chance to spell it differently, and they all did.
 * `deepNav` carried a hardcoded four-route special-case table mapping route to
 * storage key, and three of its five entries were wrong:
 *
 *   route      deepNav wrote          page actually read
 *   /ide       ide-activeTab          ide-projects-activeTab   ✗
 *   /finance   finance-activeTab      (nothing)                 ✗
 *   /reports   insights-activeTab     (nothing)                 ✗
 *   /guide     /guide-activeTab       guide-activeTab           ✗
 *
 * A page now declares its key ONCE, next to the tab that uses it, and calls
 * this hook. A wrong key is a validator failure, not a silent no-op.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { PageManifest, TabSpec } from './types'
import { getManifest, manifestForPath } from './registry'

/** Read `?tab=` / `?stage=` out of the HASH. `location.search` is empty under HashRouter. */
function hashParam(hash: string, key: string): string | undefined {
  const q = hash.indexOf('?')
  if (q === -1) return undefined
  return new URLSearchParams(hash.slice(q + 1)).get(key) ?? undefined
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeRemove(key: string): void {
  try { localStorage.removeItem(key) } catch { /* private mode — hint is best-effort */ }
}

export interface PageSurface<T extends string = string> {
  /** The page's stable id. Use this as the search-index pageId. */
  pageId: string
  /** Top-level tabs, for a uniform tab bar. Children stay nested. */
  items: TabSpec[]
  /** Every selectable id, nested tabs included. */
  tabIds: T[]
  /**
   * The tab a deep link asked for, or undefined.
   *
   * Read on the FIRST render of a navigation and then cleared, so switching
   * tabs by hand does not get overridden by a stale hint. Call this from a
   * `useState` lazy initialiser:
   *
   *   const surface = usePageSurface(lifeManifest)
   *   const [tab, setTab] = useState(() => surface.requestedTab ?? 'covenant')
   */
  requestedTab?: T
  /** The `data-section` this page should scroll to on arrival, if any. */
  requestedSection?: string
  /** Ids declared but with no element carrying `data-section`. Dev-only aid. */
  missingAnchors: string[]
}

export interface PageSurfaceOptions {
  /**
   * Disable the dev-time anchor audit. Only set this when a section is rendered
   * by a conditionally-mounted child, so the first paint legitimately lacks it.
   */
  skipAnchorAudit?: boolean
  /**
   * Called ONCE per navigation when a deep link asked for a specific tab.
   *
   * Prefer this over reading `requestedTab` yourself. "Once per navigation" is
   * the whole problem: `/life` does not change `location.pathname` when you jump
   * from `Life — Gold` to `Life — Notes`, so the page does NOT remount, and a
   * `useState` lazy initialiser or a `useEffect([])` never re-runs. Meanwhile
   * `location.state` still holds `{ tab: 'gold' }` from the last jump, so any
   * effect that re-reads it on every render will drag the user back to Gold the
   * moment they click the Notes tab by hand.
   *
   * The hook keys off `location.key`, which React Router changes on EVERY
   * navigation — including one that only pushes state — so the request is
   * delivered exactly once and then forgotten.
   */
  onTabRequest?: (tabId: string) => void
}

/**
 * Hook a page surface up to the navigation system.
 *
 * @param manifest The page's manifest from `./pages/<name>.ts`.
 */
export function usePageSurface<T extends string = string>(
  manifest: PageManifest,
  options: PageSurfaceOptions = {},
): PageSurface<T> {
  const location = useLocation()
  const { skipAnchorAudit = false, onTabRequest } = options

  /**
   * TOP-LEVEL tabs only — what a tab bar actually renders.
   *
   * Nested children are deliberately not hoisted into this list. The Terminal
   * workspace has `providers` and `settings` under BOTH `conductor` and
   * `ai-gateway`, so flattening produces duplicate ids and any `key=` or
   * `aria-controls` built from them silently collides.
   */
  const items = useMemo(() => manifest.tabs?.items ?? [], [manifest])

  /**
   * Every id that a deep link is allowed to name, nested included. Validation
   * uses this so `conductor/providers` resolves even though it is not a top-level
   * tab.
   */
  const tabIds = useMemo(() => {
    const out: string[] = []
    const walk = (tabs: TabSpec[]) => {
      for (const t of tabs) {
        out.push(t.id)
        if (t.children?.length) walk(t.children)
      }
    }
    walk(manifest.tabs?.items ?? [])
    return out
  }, [manifest])

  const validIds = useMemo(() => new Set<string>(tabIds), [tabIds])

  /**
   * Resolve the incoming tab from every channel, most authoritative first.
   *
   * 1. `location.state[stateKey]` — the live same-session hop from ⌘K.
   * 2. `?tab=` in the hash — survives a refresh and a shared link.
   * 3. `localStorage[storageKey]` — survives a hard reload of the SAME url.
   *
   * The storage hint is REMOVED once consumed. Leaving it in place was a real
   * bug: the hint outlived the navigation, so any later manual reload snapped
   * you back to the tab you had drifted away from.
   */
  const requestedTab = useMemo(() => {
    const model = manifest.tabs
    if (!model) return undefined
    const stateKey = model.stateKey ?? 'tab'

    const fromState = (location.state as Record<string, unknown> | null)?.[stateKey]
    if (typeof fromState === 'string' && validIds.has(fromState)) return fromState

    if (model.hashParam) {
      const fromHash = hashParam(location.hash, model.hashParam)
      if (fromHash && validIds.has(fromHash)) return fromHash
    }

    if (model.storageKey) {
      const fromStorage = safeGet(model.storageKey)
      if (fromStorage && validIds.has(fromStorage)) {
        safeRemove(model.storageKey)
        return fromStorage
      }
      if (fromStorage) safeRemove(model.storageKey) // stale id — drop it
    }

    return undefined
  }, [location.state, location.hash, manifest.tabs, validIds])

  const requestedSection = useMemo(() => {
    const fromState = (location.state as Record<string, unknown> | null)?.section
    if (typeof fromState === 'string') return fromState
    return undefined
  }, [location.state])

  /**
   * Deliver an incoming tab request exactly once per navigation.
   *
   * `location.key` is the discriminator. React Router v6 mints a fresh key for
   * every navigation, including `navigate(path, { state })` — which is exactly
   * what `deepNav` does — while leaving `location.state` intact afterwards. So:
   * new key + a valid tab  => deliver it; same key (a re-render, or the user
   * clicking a tab by hand) => stay silent.
   */
  const onTabRequestRef = useRef(onTabRequest)
  onTabRequestRef.current = onTabRequest
  const consumedKey = useRef<string | undefined>(undefined)
  const routeKey = location.key

  useEffect(() => {
    if (consumedKey.current === routeKey) return
    consumedKey.current = routeKey
    if (requestedTab) onTabRequestRef.current?.(requestedTab)
  }, [routeKey, requestedTab])

  /**
   * Publish this page's curated Ctrl+F segments and claim its place in the
   * index under its canonical id.
   *
   * Note we send `manifest.id`, never a string sliced out of the pathname — see
   * the `/resume/build` note in `registry.ts`.
   */
  useEffect(() => {
    const segments = manifest.find?.segments
    if (!segments?.length) return
    const api = (window as any).deskflowAPI
    if (!api?.smartSearchIndex) return

    const payload = segments.map(s => ({
      id: `${manifest.id}:${s.id}`,
      pageId: manifest.id,
      title: s.title,
      text: s.text,
      section: s.section,
      rank: s.rank ?? 1,
    }))
    try { void api.smartSearchIndex(payload) } catch { /* index is best-effort */ }
  }, [manifest])

  /**
   * Dev-time anchor audit.
   *
   * Every same-page section a manifest declares MUST have a matching
   * `data-section` in the DOM. Twelve palette rows used to point at ids nobody
   * wrote (`dash.summary`, `database.browse`, `guide.specs`, …) and the failure
   * was a 1.6s retry loop that gave up silently — the user saw "navigated, but
   * nothing scrolled" and no error anywhere.
   *
   * Runs after paint and on route change, so lazily-mounted panels have had a
   * chance to render. Cross-page sections (those with a `route`) are skipped:
   * they carry no anchor by design.
   */
  const missingAnchors = useMemo<string[]>(() => {
    if (skipAnchorAudit) return []
    if (typeof document === 'undefined') return []
    const declared: string[] = [
      ...(manifest.sections ?? []).filter(s => !s.route).map(s => s.id),
      ...(manifest.tabs?.items ?? []).flatMap(t =>
        t.section ? [t.section] : [],
      ),
    ]
    return declared.filter(id => {
      if (!id) return false
      try {
        return document.querySelector(`[data-section="${CSS.escape(id)}"]`) === null
      } catch {
        return false
      }
    })
  }, [manifest, skipAnchorAudit, location.pathname])

  const warned = useRef<string>('')
  useEffect(() => {
    if (import.meta.env?.DEV && missingAnchors.length) {
      const key = `${manifest.id}:${missingAnchors.join(',')}`
      if (warned.current !== key) {
        warned.current = key
        console.warn(
          `[pageRegistry] ${manifest.id} declares sections with no [data-section] in the DOM: ` +
          missingAnchors.join(', ') +
          '\n  ⌘K will navigate but cannot scroll. Add the attribute to the page, or fix the id in ' +
          `src/pages/registry/pages/. Run \`npm run validate:pages\` for the full list.`,
        )
      }
    }
  }, [missingAnchors, manifest.id])

  return {
    pageId: manifest.id,
    items,
    tabIds: tabIds as T[],
    requestedTab: requestedTab as T | undefined,
    requestedSection,
    missingAnchors,
  }
}

/** Imperative helper: which manifest is this pathname? */
export { getManifest, manifestForPath }
import type { NavigateFunction } from 'react-router-dom'
// Import the LEAF, not the `@/pages/registry` barrel.
//
// The barrel re-exports `usePageSurface`, which imports React and reads
// `import.meta.env`. `deepNav` is a plain navigation utility used by the renderer
// AND by anything that needs the tab key outside React; pulling the hook chain in
// made a data module depend on React, and made any node-side bundle of deepNav
// fail on `import.meta`. `registry.ts` imports only `manifests.ts` + types, so
// this stays React-free. No cycle: the registry never imports deepNav.
import { getManifest, pageIdForPath } from '../pages/registry/registry'

export interface DeepNavTarget {
  route: string
  section?: string
  tab?: string
  subpage?: string
  state?: Record<string, any>
}

const NAVIGATE_KEY = 'deepNav:navigate'
const SECTION_STORAGE_KEY = 'deepNav:section'

/**
 * Resolve which localStorage key carries a tab hint for a route.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NO LONGER A HARD-CODED FOUR-ROUTE TABLE
 *
 * The previous version was:
 *
 *   route === '/settings' ? 'settings-activeTab'
 *   : route === '/ide'    ? 'ide-activeTab'
 *   : route === '/finance'? 'finance-activeTab'
 *   : route === '/reports'? 'insights-activeTab'
 *   : `${route}-activeTab`
 *
 * Three of those five branches named a key NOBODY READ:
 *
 *   route      wrote          page actually read            worked?
 *   /ide       ide-activeTab  ide-projects-activeTab        no
 *   /finance   finance-activeTab  (nothing)                 no
 *   /reports   insights-activeTab (nothing)                 no
 *   /guide     /guide-activeTab   guide-activeTab          no
 *
 * They only appeared to work because `navigateTo` also passes
 * `location.state.tab`, which most pages read. So the localStorage half was
 * dead weight that looked alive — and it is the half that survives a hard reload.
 *
 * Now the key is DECLARED by the page, next to the tab that consumes it, in
 * `src/pages/registry/pages/<page>.ts` under `tabs.storageKey`. Guessing is gone,
 * and a wrong key is a `npm run validate:pages` failure instead of a silent
 * no-op.
 *
 * Pages with no manifest fall back to the old generic convention, so an
 * un-migrated page keeps working exactly as before.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function tabStorageKeyFor(route: string): string {
  const manifest = getManifest(pageIdForPath(route))
  const declared = manifest?.tabs?.storageKey
  if (declared) return declared
  return `${route}-activeTab`
}

export function navigateTo(target: DeepNavTarget, navigate?: NavigateFunction) {
  const { route, section, tab, subpage, state } = target

  // Persist section for pages that need to scroll on mount
  if (section) {
    try { sessionStorage.setItem(SECTION_STORAGE_KEY, section) } catch {}
  }

  // Set tab hints via localStorage (works for pages that read on mount).
  // The key now comes from the page's manifest rather than a guess.
  if (tab) {
    try { localStorage.setItem(tabStorageKeyFor(route), tab) } catch {}
  }

  // Set subpage hint for terminal workspace
  if (subpage) {
    try { sessionStorage.setItem('deepNav:subpage', subpage) } catch {}
  }

  if (navigate) {
    navigate(route, {
      state: { section, tab, subpage, ...state },
      replace: false,
    })
  } else {
    // Fallback: store route for pages that read on mount
    try {
      sessionStorage.setItem(NAVIGATE_KEY, route)
      sessionStorage.setItem(`${NAVIGATE_KEY}:tab`, tab ?? '')
      sessionStorage.setItem(`${NAVIGATE_KEY}:section`, section ?? '')
      sessionStorage.setItem(`${NAVIGATE_KEY}:subpage`, subpage ?? '')
    } catch {}
  }
}

export function consumeSectionHint(): string | undefined {
  try {
    const val = sessionStorage.getItem(SECTION_STORAGE_KEY)
    if (val) sessionStorage.removeItem(SECTION_STORAGE_KEY)
    return val ?? undefined
  } catch { return undefined }
}

export function consumeSubpageHint(): string | undefined {
  try {
    const val = sessionStorage.getItem('deepNav:subpage')
    if (val) sessionStorage.removeItem('deepNav:subpage')
    return val ?? undefined
  } catch { return undefined }
}

export function scrollToSection(sectionId: string, smooth = true) {
  if (!sectionId || !document) return false;
  const sel = `[data-section="${CSS.escape(sectionId)}"]`;
  console.debug('[scrollToSection] querying:', sel);
  const el = document.querySelector<HTMLElement>(sel);
  if (el) {
    console.debug('[scrollToSection] found element:', el);
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'center' });
    return true;
  }
  console.debug('[scrollToSection] no element found for:', sectionId);
  return false;
}

export function useScrollToSection(sectionHint?: string) {
  // Call this in a useEffect after mount
  const section = sectionHint || consumeSectionHint()
  if (section) {
    // Retry with backoff for slow renders
    const tryScroll = (attempts: number) => {
      if (attempts <= 0) return
      if (!scrollToSection(section)) {
        setTimeout(() => tryScroll(attempts - 1), 200)
      }
    }
    setTimeout(() => tryScroll(5), 100)
  }
}

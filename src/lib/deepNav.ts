import type { NavigateFunction } from 'react-router-dom'

const NAVIGATE_KEY = 'deepNav:navigate'
const SECTION_STORAGE_KEY = 'deepNav:section'

export function navigateTo(target: DeepNavTarget, navigate?: NavigateFunction) {
  const { route, section, tab, subpage, state } = target

  // Persist section for pages that need to scroll on mount
  if (section) {
    try { sessionStorage.setItem(SECTION_STORAGE_KEY, section) } catch {}
  }

  // Set tab hints via localStorage (works for pages that read on mount)
  if (tab) {
    const tabKey = route === '/settings' ? 'settings-activeTab'
      : route === '/ide' ? 'ide-activeTab'
      : route === '/finance' ? 'finance-activeTab'
      : route === '/reports' ? 'insights-activeTab'
      : `${route}-activeTab`
    try { localStorage.setItem(tabKey, tab) } catch {}
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

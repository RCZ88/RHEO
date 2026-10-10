/**
 * registry.ts — turns manifests into every index the app needs.
 *
 * Everything here is DERIVED. There is no hand-maintained list anywhere else:
 * the palette, the Ctrl+F page registry and the tour lookup all read from
 * `PAGE_MANIFESTS`. Adding a page means adding one file under `./pages/` and
 * importing it in `./index.ts` — nothing else, or `npm run validate:pages`
 * fails.
 */
import type { PageManifest, SectionSpec, TabSpec } from './types'
import { PAGE_MANIFESTS } from './manifests'

/* ───────────────────────── flattening ───────────────────────── */

/** One row in the Ctrl+K palette, derived from a page/tab/section triple. */
export interface PaletteEntry {
  /** Stable, unique. `page` | `page/tab` | `page#section`. */
  id: string
  label: string
  route: string
  tab?: string
  section?: string
  /** Extra `location.state` for the jump. */
  navState?: Record<string, unknown>
  keywords: string[]
  group: string
  icon?: string
  /** Short right-aligned detail line in the palette. */
  detail?: string
  /** When set, this row dispatches a window event instead of navigating. */
  event?: string
}

/**
 * Palette rows for a tab and its nested children.
 *
 * `path` is the ACCUMULATED parent path, not the page id. That is the fix for
 * duplicate ids: the Terminal workspace has `settings` and `providers` under
 * BOTH `conductor` and `ai-gateway`, and `context` as a group that also contains
 * a child called `context`. Keying children off their parent chain gives
 * `terminal/conductor/settings` and `terminal/ai-gateway/settings` — unique, and
 * still readable in the DOM if you ever need to debug a row.
 */
/** De-dupe keywords case-insensitively, preserving first-seen order. */
function uniqKeywords(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of list) {
    const key = k.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function tabEntries(
  page: PageManifest,
  tab: TabSpec,
  label: string,
  parentPath: string,
): PaletteEntry[] {
  const navState = { ...page.navState, ...tab.navState }
  const path = `${parentPath}/${tab.id}`
  const row: PaletteEntry = {
    id: path,
    label,
    route: page.route,
    tab: tab.id,
    section: tab.section,
    navState: Object.keys(navState).length ? navState : undefined,
    keywords: uniqKeywords([...(page.keywords ?? []), tab.label.toLowerCase(), ...(tab.keywords ?? [])]),
    group: page.group ?? page.label,
    icon: tab.icon ?? page.icon,
    detail: tab.section ?? page.route,
  }
  const kids = (tab.children ?? []).map(k => tabEntries(page, k, `${label} — ${k.label}`, path))
  return [row, ...kids.flat()]
}

function sectionEntry(
  page: PageManifest,
  section: SectionSpec,
  groupLabel?: string,
): PaletteEntry {
  // A section with a `route` is a CROSS-PAGE shortcut (the Labs hub cards). Its
  // `id` is a palette key only — no `data-section` is required or checked.
  const crossPage = !!section.route
  return {
    id: `${page.id}#${section.id}`,
    label: crossPage ? section.label : `${groupLabel ?? page.label} — ${section.label}`,
    route: section.route ?? page.route,
    tab: crossPage ? section.tab : undefined,
    section: crossPage ? undefined : section.id,
    navState: section.navState ?? page.navState,
    keywords: uniqKeywords([...(page.keywords ?? []), section.label.toLowerCase(), ...(section.keywords ?? [])]),
    group: page.group ?? page.label,
    icon: section.icon ?? page.icon,
    detail: crossPage ? section.route : section.id,
  }
}

/**
 * Every palette row for one manifest, including its children.
 *
 * A child manifest is a page in its own right (it has its own route and its own
 * Ctrl+F pageId) but it INHERITS the parent's group unless it sets one, so ⌘K
 * keeps Lecture → Decks visually nested under Lecture instead of scattering it
 * into a top-level group.
 */
function paletteRowsFor(page: PageManifest): PaletteEntry[] {
  if (page.hidden) return []
  const pageRow: PaletteEntry = {
    id: page.id,
    label: page.label,
    route: page.event ? '' : page.route,
    event: page.event,
    tab: page.tab,
    section: page.section,
    navState: page.navState,
    keywords: uniqKeywords([...(page.keywords ?? []), page.label.toLowerCase()]),
    group: page.group ?? page.label,
    icon: page.icon,
    detail: page.hint ?? page.route,
  }
  const tabs = (page.tabs?.items ?? []).flatMap(t =>
    tabEntries(page, t, `${page.label} — ${t.label}`, page.id),
  )
  const sections = (page.sections ?? []).map(s => sectionEntry(page, s, page.label))
  const children = (page.children ?? []).flatMap(c =>
    paletteRowsFor({ ...c, group: c.group ?? page.group ?? page.label }),
  )
  return [pageRow, ...tabs, ...sections, ...children]
}

/** Every palette row in the app, derived from the manifests. */
export const PALETTE_ENTRIES: PaletteEntry[] = PAGE_MANIFESTS.flatMap(paletteRowsFor)

/* ───────────────────────── pageId resolution ───────────────────────── */

const BY_ID = new Map<string, PageManifest>()
const BY_ALIAS = new Map<string, PageManifest>()
const BY_PALETTE = new Map<string, PaletteEntry>()

for (const page of PAGE_MANIFESTS) {
  const collect = (p: PageManifest) => {
    BY_ID.set(p.id, p)
    for (const a of p.aliases ?? []) {
      if (BY_ALIAS.has(a)) {
        console.warn(`[pageRegistry] duplicate alias "${a}" on ${p.id}`)
      }
      BY_ALIAS.set(a, p)
    }
    for (const e of paletteRowsFor(p)) BY_PALETTE.set(e.id, e)
    for (const c of p.children ?? []) collect(c)
  }
  collect(page)
}

export function getManifest(id: string): PageManifest | undefined {
  return BY_ID.get(id) ?? BY_ALIAS.get(id)
}

/** Look up a palette row by its stable id (`life/notes`). */
export function getPaletteEntry(id: string): PaletteEntry | undefined {
  return BY_PALETTE.get(id)
}

/**
 * Match a pathname against a route pattern.
 *
 * `/resume/build` -> exact segment count + literal match.
 * `/lecture/decks/42` -> `decks/:id` matches, one segment consumed.
 * `/lecture/anything/else` -> a trailing `*` wildcard catches the rest.
 *
 * Why this exists: `App.tsx` used to derive the pageId with
 * `pathname.replace('/', '')`, which mints `resume/build` for `/resume/build`
 * and `lecture/decks/42` for a deck. Those ids match no registry key, so the
 * Ctrl+F "Page" scope compared `h.pageId === 'resume/build'` against segments
 * stored under `resume-build` and returned nothing — silently, every time.
 */
function matchPattern(pattern: string, pathname: string): boolean {
  const wild = pattern.endsWith('/*')
  const pat = (wild ? pattern.slice(0, -2) : pattern).split('/').filter(Boolean)
  const seg = pathname.split('/').filter(Boolean)

  if (wild) {
    if (seg.length < pat.length) return false
  } else if (seg.length !== pat.length) {
    return false
  }
  for (let i = 0; i < pat.length; i++) {
    const p = pat[i]
    if (p.startsWith(':')) continue
    if (p !== seg[i]) return false
  }
  return true
}

/** Every manifest that could match, most specific first. */
function candidates(): PageManifest[] {
  const all: PageManifest[] = []
  for (const page of PAGE_MANIFESTS) {
    const push = (p: PageManifest) => {
      all.push(p)
      for (const c of p.children ?? []) push(c)
    }
    push(page)
  }
  // Specificity: no wildcard > no param > has param > has wildcard.
  // `/lecture/decks` must win over `/lecture/decks/:id`, and `/lecture` over both.
  return all.sort((a, b) => spec(b) - spec(a))
}
function spec(p: PageManifest): number {
  const m = p.match ?? p.route
  let s = 0
  if (!m.endsWith('/*')) s += 100
  if (m.includes(':')) s -= 50
  if (m.endsWith('/*')) s -= 100
  return s + m.split('/').filter(Boolean).length
}

let MATCHERS: PageManifest[] | null = null

/**
 * The manifest for a pathname, or undefined.
 *
 * This is THE fix for the nested-route pageId mismatch — App.tsx calls this
 * instead of string-slicing the pathname.
 */
export function manifestForPath(pathname: string): PageManifest | undefined {
  if (!MATCHERS) MATCHERS = candidates()
  return MATCHERS.find(p => matchPattern(p.match ?? p.route, pathname))
}

/** The stable pageId for a pathname. Falls back to `dashboard` at the root. */
export function pageIdForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'dashboard'
  return manifestForPath(pathname)?.id ?? pathname.replace(/^\//, '').replace(/\//g, '-')
}

/* ───────────────────────── Ctrl+F registry ───────────────────────── */

/**
 * pageId -> route + tab, for the find bar's result-click handler.
 * Replaces the hand-maintained `SMART_SEARCH_PAGES`.
 */
export const PAGE_ROUTES: Record<string, { route: string; tab?: string }> = (() => {
  const out: Record<string, { route: string; tab?: string }> = {}
  for (const page of PAGE_MANIFESTS) {
    const collect = (p: PageManifest) => {
      out[p.id] = { route: p.route, tab: p.tab }
      for (const a of p.aliases ?? []) out[a] = { route: p.route, tab: p.tab }
      for (const c of p.children ?? []) collect(c)
    }
    collect(page)
  }
  return out
})()

export function resolvePageRoute(pageId: string): { route: string; tab?: string } | null {
  return PAGE_ROUTES[pageId] ?? null
}

/* ───────────────────────── tutorials ───────────────────────── */

/**
 * featureId -> steps, for the guided tour.
 * Replaces `tutorial-steps.ts` for anything that declares a manifest.
 */
export const TUTORIAL_STEPS: Record<string, NonNullable<PageManifest['tutorial']>> = (() => {
  const out: Record<string, NonNullable<PageManifest['tutorial']>> = {}
  for (const page of PAGE_MANIFESTS) {
    if (page.tutorial) out[page.tutorial.id ?? page.id] = page.tutorial
    for (const c of page.children ?? []) {
      if (c.tutorial) out[c.tutorial.id ?? c.id] = c.tutorial
    }
  }
  return out
})()

/** Every tab id for a page — what the validator compares against the page source. */
export function tabIdsFor(pageId: string): string[] {
  const p = getManifest(pageId)
  return p?.tabs?.items.map(t => t.id) ?? []
}
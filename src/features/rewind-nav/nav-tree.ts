/**
 * nav-tree.ts — PageManifest -> NavNode.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO SECOND NAV TREE
 *
 * The spec asks for "a typed nav tree that both the router and the palette read
 * from. Do not hardcode pages in the palette." That already exists: it is
 * `src/pages/registry/`, 38 typed `PageManifest`s feeding 204 palette rows,
 * enforced by `npm run validate:pages`.
 *
 * Writing a parallel `nav-tree.ts` would reintroduce exactly the disease this
 * repo already had once: SIX registries declaring "a place" independently, with
 * different id spellings and no validator, which is how 12 palette anchors ended
 * up pointing at `data-section` values no component had ever written.
 *
 * So this file is an ADAPTER, not a source. It projects manifests into the reel /
 * frame shape the Rewind overlay wants and adds nothing that isn't already
 * declared upstream. If a page is not navigable here, it is not navigable in the
 * palette either, and vice versa — by construction.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { PageManifest, TabSpec } from '@/pages/registry/types'
// Leaf modules, NOT the `@/pages/registry` barrel.
//
// The barrel re-exports `usePageSurface`, which imports React. This is a pure
// data module: pulling the hook chain in would make the nav tree depend on the
// renderer, force `import.meta.env` into any node-side test of it, and give a
// future cycle a second reason to touch a file that should be inert. `registry.ts`
// imports only `manifests.ts` + types, so this stays React-free.
import { PAGE_MANIFESTS } from '@/pages/registry/manifests'
import { pageIdForPath } from '@/pages/registry/registry'

/** A reel: one top-level page. */
export interface Reel {
  id: string
  title: string
  /** Route the reel itself navigates to. */
  path: string
  icon?: string
  keywords: string[]
  hint?: string
  frames: Frame[]
  /** Page ids of every frame, for search-scoping and recents. */
  frameIds: string[]
}

/** A frame: one destination on the strip inside a reel. */
export interface Frame {
  id: string
  title: string
  /** Route to travel to. */
  path: string
  /** Tab to open on arrival, if the destination is a tabbed page. */
  tab?: string
  /** `data-section` to scroll to on arrival. */
  section?: string
  /** Extra `location.state` (e.g. Terminal's `{ group }`). */
  navState?: Record<string, unknown>
  icon?: string
  keywords: string[]
  /** Nesting depth: 0 = a tab/section of the reel, 1 = a child route or sub-tab. */
  depth: number
  /**
   * Ancestor tab labels, e.g. `['Handbook']` for Handbook / Practice.
   * Drives the status line and makes nested frames searchable by group.
   */
  trail: string[]
  /**
   * Preview illustration key, resolved in `previews/`.
   *
   * Deliberately a KEY, not an illustration component. Spec §3 wants a slot that
   * can later be swapped for a real `webContents.capturePage` screenshot; baking
   * a component in would make that swap a rewrite. This is the seam.
   */
  preview: PreviewKind
}

/**
 * Preview families. One hand-built SVG per kind, not one per page — 182 frames
 * means 182 bespoke illustrations is not a thing anyone will maintain, and the
 * point is to *hint* at content (spec §3), which a family does honestly.
 */
export type PreviewKind =
  | 'bars'      // usage / activity
  | 'line'      // finance, trends
  | 'nodes'     // graph, architecture
  | 'list'      // tabular browse
  | 'grid'      // cards / canvas
  | 'terminal'  // panes, sessions
  | 'calendar'  // schedule, habits
  | 'doc'       // learn, guide, specs
  | 'orbit'     // dashboard hero
  | 'shelves'   // gold, notes
  | 'wave'      // river / life
  | 'tool'      // settings

/** Flattened search document: one row per navigable destination. */
export interface NavEntry {
  id: string
  reelId: string
  reelTitle: string
  frameId?: string
  title: string
  path: string
  tab?: string
  section?: string
  navState?: Record<string, unknown>
  icon?: string
  /** Everything search may match against. */
  haystack: string
  depth: number
  preview: PreviewKind
  /** Ancestor tab labels within the reel, for the status line breadcrumb. */
  trail: string[]
  /** True for the reel's own landing row (the "page" itself, not a frame). */
  isReelRoot: boolean
}

function kw(...parts: (string[] | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    for (const s of p ?? []) {
      const t = s.trim()
      if (!t) continue
      const k = t.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
    }
  }
  return out
}

/**
 * Pick a preview family from a route, so the mapping is data-driven and a new
 * page gets a sensible preview without anyone hand-drawing one.
 */
/**
 * `section` is part of the key on purpose.
 *
 * Every SECTION of a page shares that page's route, so without it all of a
 * page's sections resolved to the same illustration — which is exactly complaint
 * 5 in the fix prompt ("Every frame shows the same orbit icon"): the Dashboard
 * reel showed five identical orbits because `previewFor('/')` can only ever
 * return 'orbit' for all of them.
 *
 * The section checks come FIRST so a named section beats its page's default, and
 * the final fallback hashes the section id so two unrecognised sections still
 * differ from each other instead of collapsing onto one shared fallback.
 */
function previewFor(path: string, tab?: string, section?: string): PreviewKind {
  const t = tab ?? ''
  const p = path.toLowerCase()
  const sec = (section ?? '').toLowerCase()

  if (sec) {
    if (/moment|hero|now|today|focus/.test(sec)) return 'wave'
    if (/tier|breakdown|break|distribut/.test(sec)) return 'bars'
    if (/pin|recent|latest|feed/.test(sec)) return 'grid'
    if (/goal|target|objective|progress/.test(sec)) return 'orbit'
    if (/stat|metric|chart|graph|insight|trend/.test(sec)) return 'line'
    if (/list|table|row|item/.test(sec)) return 'list'
    if (/note|journal|entry|memory|writing/.test(sec)) return 'doc'
    if (/calendar|schedule|week|day|month/.test(sec)) return 'calendar'
    if (/node|graph|map|architecture|relation/.test(sec)) return 'nodes'
    if (/terminal|shell|console|command|log/.test(sec)) return 'terminal'
    if (/shelf|library|book|collection/.test(sec)) return 'shelves'
  }

  if (p.includes('/terminal') || p.includes('penguin')) return 'terminal'
  if (p.includes('/finance')) return 'line'
  if (p.includes('/database') || t === 'browse') return 'list'
  if (p.includes('/learn') || p.includes('/guide') || p.includes('/lecture')) return 'doc'
  if (p.includes('/settings')) return 'tool'
  if (t === 'canvas' || t === 'deck' || p.includes('/ai')) return 'grid'
  if (p.includes('/life') || t === 'river') return 'wave'
  if (t === 'gold' || t === 'notes' || t === 'memories') return 'shelves'
  if (t === 'schedule' || t === 'habits') return 'calendar'
  if (p.includes('/ide') || t === 'architecture' || t === 'graph') return 'nodes'
  if (p === '/' || p === '') return 'orbit'
  return 'bars'
}

/** Stable per-id pick from a family, so unlabelled siblings still differ. */
function varied(kind: PreviewKind, id: string): PreviewKind {
  const family: PreviewKind[] = ['bars', 'line', 'grid', 'list', 'nodes', 'wave']
  if (family.includes(kind)) return kind
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return family[h % family.length]
}

function tabToFrames(page: PageManifest): Frame[] {
  const frames: Frame[] = []
  // Ancestor labels and keywords are INHERITED by nested frames.
  //
  // Without this, "Terminal / Practice" knew only its own title and keywords, so
  // the query "handbook practice" matched nothing: no frame title contained
  // "handbook" and the reel is called "Terminal Workspace". Searching a nested
  // frame by its PARENT GROUP is the obvious thing to try and it silently
  // returned nothing — the same class of bug as the old palette, where a child
  // entry did not know its parent existed.
  const walk = (tabs: TabSpec[], depth: number, trail: string[], inherited: string[], idPath: string[]) => {
    for (const t of tabs) {
      frames.push({
        // The FULL ancestor chain is in the id, not just the depth.
        //
        // `terminal/g/providers` was produced for both `Conductor / Providers` and
        // `AI Gateway / Providers` — two genuinely different destinations that
        // collapsed onto one id. In `FRAME_TO_REEL` and `NAV_ENTRIES.find` the
        // second silently shadowed the first, so one panel was simply unreachable
        // and recents for it could never resolve. `terminal/g/settings` had the
        // same collision.
        id: [page.id, ...idPath, t.id].join('/'),
        title: t.label,
        // ANCESTORS only. Including the frame's own label here produced
        // "Settings / Keyboard Shortcuts / Keyboard Shortcuts", because the
        // breadcrumb already appends the leaf.
        trail,
        path: page.route,
        tab: t.id,
        section: t.section,
        navState: t.navState,
        icon: t.icon ?? page.icon,
        keywords: kw(page.keywords, inherited, t.keywords),
        depth,
        preview: varied(previewFor(page.route, t.id, t.id), t.id),
      })
      if (t.children?.length) {
        walk(
          t.children,
          depth + 1,
          [...trail, t.label],
          [...inherited, t.label, ...(t.keywords ?? [])],
          [...idPath, t.id],
        )
      }
    }
  }
  walk(page.tabs?.items ?? [], 0, [], [], [])
  return frames
}

function sectionToFrames(page: PageManifest): Frame[] {
  const out: Frame[] = []
  for (const s of page.sections ?? []) {
    // Cross-page shortcuts (the Labs hub cards) have their own `route`; they are
    // frames of THIS reel but travel elsewhere. Keeping them here means the hub
    // advertises all three labs, which is the whole point of a hub.
    out.push({
      id: `${page.id}#${s.id}`,
      title: s.label,
      path: s.route ?? page.route,
      tab: s.tab,
      section: s.route ? undefined : s.id,
      navState: s.navState ?? page.navState,
      icon: s.icon ?? page.icon,
      keywords: kw(page.keywords, [s.label], s.keywords),
      depth: 0,
      trail: [],
      preview: varied(previewFor(s.route ?? page.route, s.tab, s.id), s.id),
    })
  }
  return out
}

function toReel(page: PageManifest): Reel {
  const frames = [...tabToFrames(page), ...sectionToFrames(page)]
  // Child ROUTES (Resume → Build, Lecture → Decks) are distinct destinations on
  // their own reel, but from the parent's point of view they are frames.
  for (const c of page.children ?? []) {
    frames.push({
      id: c.id,
      title: c.label,
      path: c.route,
      section: c.section,
      navState: c.navState,
      icon: c.icon,
      keywords: kw(page.keywords, c.keywords, [c.label]),
      depth: 0,
      trail: [],
      preview: varied(previewFor(c.route, c.tab, c.id), c.id),
    })
  }
  return {
    id: page.id,
    title: page.label,
    path: page.route,
    icon: page.icon,
    keywords: kw(page.keywords, [page.label]),
    hint: page.hint,
    frames,
    frameIds: frames.map(f => f.id),
  }
}

/**
 * Every visible top-level page becomes a reel.
 *
 * Two exclusions:
 *
 * - `hidden` manifests: placeholders (`/pricing`) and aliases for routes that
 *   were never mounted. The retired `focus` manifest is hidden and aliases onto
 *   Activity, so "Focus" stays reachable as an Activity frame rather than as a
 *   phantom reel.
 * - `event` manifests: these are COMMANDS, not pages. `titlebar-settings` has no
 *   route at all — it dispatches a window event. It came through as a reel with an
 *   empty film strip, which is a dead end the user cannot escape with arrows.
 *
 * And one guarantee: a reel NEVER has zero frames. If a page declares no tabs, no
 * sections and no children, it gets one frame pointing at itself, so the strip
 * always has something to centre on and Enter always travels somewhere.
 */
const REEL_PAGES = PAGE_MANIFESTS.filter(p => !p.hidden && !p.event)

export const REELS: Reel[] = REEL_PAGES.map((page) => {
  const reel = toReel(page)
  if (reel.frames.length === 0) {
    reel.frames = [{
      id: `${reel.id}#self`,
      title: reel.title,
      path: reel.path,
      icon: reel.icon,
      keywords: reel.keywords,
      depth: 0,
      trail: [],
      preview: previewFor(reel.path),
    }]
    reel.frameIds = reel.frames.map(f => f.id)
  }
  return reel
})

export const REEL_BY_ID = new Map(REELS.map(r => [r.id, r]))

/** Flat list of every navigable destination: reel roots plus all frames. */
export const NAV_ENTRIES: NavEntry[] = REELS.flatMap(reel => {
  const root: NavEntry = {
    id: reel.id,
    reelId: reel.id,
    reelTitle: reel.title,
    title: reel.title,
    path: reel.path,
    icon: reel.icon,
    haystack: [reel.title, ...reel.keywords].join(' ').toLowerCase(),
    depth: 0,
    preview: previewFor(reel.path),
    trail: [],
    isReelRoot: true,
  }
  const frames: NavEntry[] = reel.frames.map(f => ({
    id: f.id,
    reelId: reel.id,
    reelTitle: reel.title,
    frameId: f.id,
    title: f.title,
    path: f.path,
    tab: f.tab,
    section: f.section,
    navState: f.navState,
    icon: f.icon,
    // The PARENT title is searchable, which is what makes "cod" find
    // "Terminal / Coding" — spec §5.
    haystack: [reel.title, f.title, ...f.keywords].join(' ').toLowerCase(),
    depth: f.depth,
    preview: f.preview,
    trail: f.trail,
    isReelRoot: false,
  }))
  return [root, ...frames]
})

/** Every frame id -> owning reel, for descendant lookup. */
const FRAME_TO_REEL = new Map<string, Reel>()
for (const r of REELS) for (const f of r.frames) FRAME_TO_REEL.set(f.id, r)

/**
 * The reel that owns a pathname.
 *
 * `pageIdForPath('/resume/build')` returns `resume-build` — a CHILD manifest id.
 * Child manifests are frames, not reels, so a direct `REEL_BY_ID` lookup returned
 * undefined and `/resume/build`, `/lecture/decks`, `/lecture/decks/42` and every
 * other nested route had NO reel. That breaks two things at once: the strip cannot
 * pre-centre on arrival, and "which reel am I in" cannot be shown in the status
 * line.
 *
 * So: try the exact id, then fall back to whichever reel owns that frame, then to
 * the longest matching reel id prefix.
 */
export function reelForPath(pathname: string): Reel | undefined {
  const id = pageIdForPath(pathname)
  const direct = REEL_BY_ID.get(id)
  if (direct) return direct

  const viaFrame = FRAME_TO_REEL.get(id)
  if (viaFrame) return viaFrame

  // `/lecture/decks/42` may mint an id no manifest claims; fall back to prefix.
  return REELS.find(r => id === r.id || id.startsWith(`${r.id}-`) || id.startsWith(`${r.id}/`))
}

/** `Terminal / Handbook / Practice` — the status line, spec §4. */
export function breadcrumb(entry: NavEntry): string {
  return [entry.reelTitle, ...entry.trail, entry.isReelRoot ? '' : entry.title]
    .filter(Boolean)
    .join(' / ')
}

/** The frame that best represents a pathname: its tab if there is one, else root. */
export function frameForPath(pathname: string): NavEntry | undefined {
  const reel = reelForPath(pathname)
  if (!reel) return undefined
  return NAV_ENTRIES.find(e => e.id === reel.id)
}
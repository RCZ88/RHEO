/**
 * types.ts — the ONE vocabulary for "a place" in DeskFlow.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * Before this registry the app had SIX parallel places-to-declare-a-page:
 *
 *   1. `GlobalSearchCommandPalette.ITEMS`        (Ctrl+K)   103 entries
 *   2. `smartSearchPages.SMART_SEARCH_PAGES`     (Ctrl+F)    89 keys
 *   3. `tutorial-steps.TUTORIAL_STEPS`           (tour)      21 keys
 *   4. `TutorialPage.FEATURES`                   (tour)      21 keys
 *   5. `feature-specs.FEATURE_SPECS`             (specs)     17 keys
 *   6. `sidebar/items.SIDEBAR_ITEMS`             (nav rail)  13 keys
 *
 * They disagreed on id spelling (`nav-dashboard` vs `dashboard` vs `activity-apps`),
 * on separators (`-` for tabs, `.` for sections), and — worse — on whether the
 * target even existed. 43 of 72 tutorial step targets had no element in the DOM.
 * 12 of 59 palette section anchors pointed at `data-section` values nobody had
 * ever written. `/focus` was in two registries but routed nowhere.
 *
 * A page is now declared ONCE, in a manifest, and every surface derives from it.
 * See `AGENTS.md` §5d — adding a page without a manifest is a build failure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A scroll anchor. Must match a `data-section` attribute written in the page. */
export interface SectionSpec {
  /** The exact `data-section` value rendered in the page. Validated by the build. */
  id: string
  label: string
  icon?: string
  keywords?: string[]
  /** Longer description, surfaced in the palette's detail line. */
  hint?: string
  /**
   * Jump to a DIFFERENT route instead of scrolling this page.
   *
   * A section without `route` is a same-page anchor and `id` MUST exist as a
   * `data-section`. A section WITH `route` is a cross-page shortcut — the Labs
   * hub's three cards point at `/studio`, `/resume` and `/lecture` — so `id` is
   * just a stable palette key and no `data-section` is required. Mixing the two
   * shapes in one field is what forces `as never` casts, which is why it is
   * modelled explicitly instead.
   */
  route?: string
  /** Tab to open on the destination route. Only valid together with `route`. */
  tab?: string
  navState?: Record<string, unknown>
}

/** A tab / sub-page / panel within a page. May nest one level (Terminal workspace). */
export interface TabSpec {
  /** The value held by the page's tab state. Validated against the page's own tab array. */
  id: string
  label: string
  icon?: string
  keywords?: string[]
  /** `data-section` to scroll to once this tab is active. */
  section?: string
  /** Nested tab (e.g. Terminal group -> sub-tab). */
  children?: TabSpec[]
  /** Extra `location.state` this tab needs, e.g. `{ group: 'work' }`. */
  navState?: Record<string, unknown>
  /**
   * Ctrl+F configuration for THIS TAB's subtree.
   *
   * A tab that carries several panes needs its own `find.segments`, scoped by
   * `root`, because the page-level `find` cannot distinguish them: the panes
   * only exist while the tab is mounted. Declaring them at page level would make
   * each one a ⌘K row that navigates to the page, lands on the DEFAULT tab, and
   * then scrolls to an anchor that was never rendered (AGENTS.md §5d).
   */
  find?: FindSpec
}

/**
 * How a page stores and receives its active tab.
 *
 * This is the fix for the `deepNav` localStorage-key mismatch table: the key is
 * no longer *guessed* by a hardcoded 4-route special case in `deepNav.ts`, it is
 * *declared* here next to the tab that uses it. Get it wrong here and
 * `npm run validate:pages` says so, instead of the palette silently doing nothing.
 */
export interface TabModel {
  /** Name of the `useState` binding in the page. Documentation + validator cross-check. */
  variable?: string
  /**
   * Legacy tab ids that must still resolve to one of `items`.
   *
   * The Life consolidation deleted the `habits` tab. Every live emitter of that
   * id — the dashboard's `WIDGET_NAV`, a shared `?tab=habits` link, and the
   * persisted `/life-activeTab` value — kept working as a *string*, so nothing
   * failed at build or at typecheck. It failed at RUNTIME, silently: every one of
   * those three channels is validated against `validIds`, so an unknown id was
   * discarded and the page fell back to its default tab. The dashboard widget
   * labelled "Habits & streaks" opened the promises tab and left 'habits'
   * sitting in storage.
   *
   * This is the tab-level analogue of the page-level `aliases` field, and it is
   * the ONLY place a retired tab id can be retired safely. Fixing the emitters
   * alone does not help: the ids also arrive from links already in the wild and
   * from storage written by an older build.
   */
  tabAliases?: Record<string, string>
  /** `location.state` key carrying the incoming tab hint. Default: `'tab'`. */
  stateKey?: string
  /** localStorage key the hint is written to and read back from. */
  storageKey?: string
  /** Query param read out of the hash. Required under `HashRouter`. */
  hashParam?: string
  /** The tab shown when nothing is requested. */
  default?: string
  items: TabSpec[]
}

/** A curated search segment, indexed into the main-process search index. */
export interface SearchSegmentSpec {
  id: string
  title: string
  text: string
  /** `data-section` this segment maps to, so a click can scroll to it. */
  section?: string
  /** Higher wins. 2 = primary, 1 = normal, 0.5 = incidental. */
  rank?: number
}

/** Ctrl+F configuration for the page. */
export interface FindSpec {
  /** Selector for the subtree that IS this page, used to narrow live find. */
  root?: string
  /** Extra selectors excluded from both the live walk and the harvest. */
  skip?: string[]
  /** Curated segments. Harvested DOM is added on top of these, never instead. */
  segments?: SearchSegmentSpec[]
  /** Disable the 'app' scope for this page (rare — search it from a hub instead). */
  appScope?: false
}

/** One step of the guided tour. `target` must match a `data-tutorial` attribute. */
export interface TutorialStepSpec {
  /** CSS selector, e.g. `[data-tutorial="life.notes"]`. */
  target: string
  title: string
  instruction: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  type?: 'info' | 'action'
}

/**
 * A page. This is the unit an agent creates when it adds a route.
 *
 * `id` is the join key across EVERY subsystem — search index pageIds, tour ids,
 * spec ids, and the Ctrl+F page scope all key off it, so it must be stable.
 */
export interface PageManifest {
  /** Stable kebab-case id. Never rename — add `aliases` instead. */
  id: string
  /** Canonical route the palette navigates to. */
  route: string
  /**
   * Route pattern used to decide "which manifest is this pathname?". Defaults to
   * `route`. Supports `:param` and a trailing `*`. Without this, nested routes
   * like `/resume/build` mint the pageId `resume/build` and Ctrl+F scoping
   * silently matches nothing.
   */
  match?: string
  label: string
  /** lucide icon name, resolved through `icons.ts`. */
  icon?: string
  /** Palette group heading. Defaults to `label`. */
  group?: string
  keywords?: string[]
  /** Longer subtitle shown in the palette. */
  hint?: string
  /** Keep out of the palette and out of search (legacy redirects, internal shells). */
  hidden?: boolean
  /** Older ids that must keep resolving. Never delete an id, alias it. */
  aliases?: string[]
  /** `location.state` handed to `navigate()` for this page. */
  navState?: Record<string, unknown>
  /**
   * Tab to open when the user arrives at `route` without naming one.
   *
   * Also how a RETIRED page id keeps working: `focus` was never routed, so its
   * manifest points at `/activity` with `tab: 'focus'` — the surface really
   * lives there. An alias therefore always resolves to a real, reachable screen.
   */
  tab?: string
  /** Scroll anchor to open on arrival, when `route` needs one. */
  section?: string
  /**
   * A COMMAND row rather than a destination: selecting it dispatches
   * `new CustomEvent(event)` on `window` instead of navigating.
   *
   * Needed because not everything is a page. `titlebar-settings` opens a
   * settings sheet inside the title bar — it has no route and never had one, but
   * it must still be reachable from ⌘K. Modelled as data so it is still covered
   * by the validator, rather than surviving as a hand-written row in the palette
   * (which is how it was found in the first place).
   */
  event?: string
  /** Group label used when this command is listed in the palette. */
  group?: string
  tabs?: TabModel
  /** Anchors that are not tabs (cards, panels, subsections). */
  sections?: SectionSpec[]
  find?: FindSpec
  tutorial?: {
    /** Tour id. Defaults to the page id. */
    id?: string
    /** Tour title. Defaults to the page label. */
    name?: string
    steps: TutorialStepSpec[]
  }
  /** Nested routes (`/lecture/decks`, `/lecture/decks/:id`). */
  children?: PageManifest[]
}
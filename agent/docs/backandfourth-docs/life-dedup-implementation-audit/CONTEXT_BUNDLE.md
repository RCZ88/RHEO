# CONTEXT BUNDLE — ROUND 02

Delta only. This replaces the Round 01 bundle: the files below are the ones that
CHANGED as a result of the audit, plus the code Claude asked for in REQUESTs 4/6.
Everything is verbatim from the repo.

════════════════════════════════════════════════════════════
## `src/components/goals/goalPredicates.ts` — D2 — the classifier Claude specified
════════════════════════════════════════════════════════════
```typescript
import type { Goal } from '@/types/goals'

/**
 * Is this goal a recurring ROUTINE?
 *
 * ONE definition. This predicate previously existed three times and two of
 * the three disagreed:
 *
 *   • GoldPage.tsx:175          →  correct
 *   • TodayTributary.tsx:50     →  correct
 *   • HabitsPage.tsx:147        →  ALSO matched `period === 'longterm'`
 *
 * The stale copy put every long-term goal into the Routines list AND into
 * The Vault — the same record, two lists, one screen. That is the user's
 * "the routine and the goal are the same thing" report, reproduced exactly.
 *
 * THE RULE, stated so it survives the next edit: a recurring ROUTINE is not a
 * long-term DESTINATION. `longterm` belongs to the Vault, alone.
 */
export const isWeeklyish = (g: Goal): boolean =>
  !!g.isHabit ||
  g.cadence === 'weekly' ||
  g.period === 'weekly'

/** `period === 'longterm'` — The Vault's membership test. */
export const isLongterm = (g: Goal): boolean => g.period === 'longterm'

/**
 * AI-suggested goals live in a REVIEW QUEUE, not in any of the four groups.
 *
 * It is here rather than in GoldPage because the classifier below needs it, and
 * a predicate that the classifier depends on cannot live in the file that calls
 * the classifier.
 *
 * WHY A LOCAL WIDENING: the `goals` table still carries the legacy AI statuses
 * ('suggested', 'pending') that the canonical `GoalStatus` union does not
 * declare. The value is genuinely in the DB — it was previously filtered out
 * with no way to reach it, leaving 11 rows unreachable — so this widens locally
 * rather than casting the whole goal away.
 */
export const isSuggested = (g: Goal): boolean => (g.status as string) === 'suggested'

/** The five mutually exclusive buckets a goal can land in. */
export type GoalKind = 'suggested' | 'vault' | 'habit' | 'routine' | 'daily'

/**
 * THE CLASSIFIER. Exactly one bucket per goal, by construction.
 *
 * ── WHY THIS EXISTS RATHER THAN FOUR `.filter()` CALLS ──
 * Four independent filters were NOT disjoint, and the overlap was invisible to
 * both the compiler and my first probe (which covered 7 shapes and missed it).
 * The cross-product over `isHabit × cadence × period × suggested` found 4 goals
 * landing in two buckets at once:
 *
 *   • `isHabit && period==='longterm'`      → Habits AND Vault
 *   • `cadence==='weekly' && period==='longterm'` → Routines AND Vault
 *
 * That is the ORIGINAL bug — "the routine and the goal are the same thing" —
 * reproduced one layer up, because each filter was individually defensible and
 * only the COMBINATION was wrong. Filtering can only ever be correct if every
 * filter is written with the others in mind, which nothing enforces.
 *
 * A single ordered `if/else` chain makes disjointness a property of control
 * flow rather than of five predicates agreeing. There is no combination of
 * inputs that reaches two arms, because the first match returns.
 *
 * ORDER IS THE SPEC: suggested wins over everything (it is a queue, not a
 * group), then long-term (a destination outranks every recurring reading), then
 * habit, then routine, then daily.
 */
export const goalKind = (g: Goal): GoalKind =>
  isSuggested(g) ? 'suggested'
  : g.period === 'longterm' ? 'vault'
  : g.isHabit ? 'habit'
  : (g.cadence === 'weekly' || g.period === 'weekly') ? 'routine'
  : 'daily'```

════════════════════════════════════════════════════════════
## `src/lib/covenant.ts` — D4 — new module, no I/O
════════════════════════════════════════════════════════════
```typescript
/**
 * Covenant streak and completion dates.
 *
 * ── WHY A NEW MODULE, AND WHY IT TAKES DATA ──
 * RESULT.md §3.3 put these in `src/lib/week.ts`. They do not belong there:
 * `week.ts` is pure date arithmetic, imported by main-process services that must
 * not pull in renderer storage, so it cannot import `loadCompletions`. The first
 * implementation papered over that with `covenantStreakFrom(read)`, whose
 * try/catch returned 0 — which converts a broken store into "streak: 0", a
 * plausible lie rendered with total confidence. That is worse than a crash.
 *
 * So both helpers here take `completions` as an ARGUMENT. They do no I/O, so
 * they cannot fail silently, and the page that owns the data owns the failure:
 *
 *   const completions = useMemo(() => {
 *     try { return loadCompletions() } catch { return [] }
 *   }, [])
 *
 * The `try/catch` moves to the CALLER, where it is visible, and where an empty
 * read is a decision rather than a swallowed exception.
 */

export interface CompletionDate {
  date: string
}

/**
 * Consecutive days with a completion, counting back from today.
 *
 * If today is not yet logged the count falls back to yesterday, so the streak is
 * not reported as broken at 9am — the same rule the three copies of this
 * function disagreed about, which is why there is one now.
 */
export function covenantStreak(completions: CompletionDate[], today: string, step: (d: string, n: number) => string): number {
  const set = new Set(completions.map(c => c.date))
  if (set.size === 0) return 0
  let cursor = today
  if (!set.has(cursor)) cursor = step(cursor, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = step(cursor, -1)
  }
  return streak
}

/**
 * The set of dates carrying a completion — the day-dots in the weekly recap.
 *
 * Derived from the SAME array the streak uses, so the two cannot disagree.
 */
export function covenantDoneDates(completions: CompletionDate[]): Set<string> {
  return new Set(completions.map(c => c.date))
}```

════════════════════════════════════════════════════════════
## `src/components/goals/WeekReview.tsx` — 7 — the shared recap, all seven holes closed
════════════════════════════════════════════════════════════
```typescript
/**
 * WeekReview — the Monday→Sunday hard-data recap.
 *
 * ONE component. This previously existed twice (GoldPage, HabitsPage) with
 * byte-identical bodies, so a fix to one left the other still wrong and nothing
 * in the compiler would say so.
 *
 * THE SUMMARY MATHS IS NOT RE-DERIVED HERE. `buildWeeklyReview` in
 * `src/shared/weeklyReview.ts` is the tested backend logic — it is unit-tested
 * in `src/__tests__/weeklyReview.test.ts` — so this component renders the
 * result and never recomputes the ratio, the most-skipped habit or the single
 * proposal. Re-deriving those in JSX is how the renderer and the stored
 * `weekly_reviews` row drift apart.
 *
 * Spec §3.4.
 */

import { motion } from 'framer-motion'
import { TrendingUp, Flame, Target, Repeat } from 'lucide-react'
import { buildWeeklyReview, type WeeklyInput } from '@/shared/weeklyReview'
import { formatTime, prettyDate } from '@/lib/format'
import { todayStr } from '@/lib/week'

/** One day's hard data. Aligned to the week, Monday first. */
export interface WeekReviewDay {
  date: string
  /** Productive seconds. Drives the bar length. */
  productiveSec: number
  /** Goals completed that day. */
  goalsCompleted: number
  /** Habits completed that day. */
  habitsCompleted: number
}

export interface WeekReviewProps {
  /** Seven entries, Monday first. */
  days: WeekReviewDay[]
  /** Everything `buildWeeklyReview` needs. Computed by the caller, which is the
   *  only place that has the goal rows. */
  weekly: WeeklyInput
  /** Consecutive days with a covenant completion. */
  streak?: number
  /** Dates with a covenant completion — draws the flame per day. */
  doneDates?: Set<string>
  /** Called when a day is selected. Omit to render non-interactive. */
  onDayClick?: (date: string) => void
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekReview({ days, weekly, streak = 0, doneDates, onDayClick }: WeekReviewProps) {
  const summary = buildWeeklyReview(weekly)

  const maxProd = Math.max(1, ...days.map(d => d.productiveSec))
  const avgProd = days.reduce((s, d) => s + d.productiveSec, 0) / (days.length || 1)
  const goalsSealed = days.reduce((s, d) => s + d.goalsCompleted, 0)
  const habitsKept = days.reduce((s, d) => s + d.habitsCompleted, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-medium text-zinc-300 flex items-center gap-1.5">
          <TrendingUp size={13} style={{ color: 'var(--page-accent)' }} aria-hidden />
          This week, at a glance
          <span className="warmth-serif italic text-zinc-600 font-normal">
            {/* `summary.start`/`summary.end` are raw YYYY-MM-DD. This is the one
                place a date reaches the user, and an ISO string reads as a bug. */}
            — {prettyDate(summary.start)} to {prettyDate(summary.end)}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {days.map((d, i) => {
          const isToday = d.date === todayStr()
          /* A <button disabled> is announced as a disabled control and is
             unreachable by keyboard, which tells a screen-reader user these rows
             are interactive-but-locked when they are in fact static. When there
             is nothing to click, render a <div> — no role, no tab stop, no lie. */
          const Row: any = onDayClick ? 'button' : 'div'
          return (
            <Row
              key={d.date}
              {...(onDayClick ? { type: 'button', onClick: () => onDayClick(d.date) } : {})}
              className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                isToday
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-zinc-900/30 light:bg-[var(--ws-surface-raised)]'
              } ${onDayClick ? 'hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)]/50' : ''}`}
            >
              <span className="w-11 shrink-0">
                <span className={`block text-[9px] uppercase tracking-wider ${isToday ? 'text-amber-400' : 'text-zinc-600'}`}>
                  {DOW[i]}
                </span>
                <span className={`block text-[11px] font-semibold tabular-nums ${isToday ? 'text-amber-300' : 'text-zinc-500'}`}>
                  {d.date.slice(5)}
                </span>
              </span>

              <span className="flex-1 h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                <motion.span
                  /* LAMINAR §6 / PAINT Gate E: transform only, never width. */
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(1, d.productiveSec / maxProd) }}
                  transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="block h-full w-full rounded-full origin-left"
                  /* LAMINAR §7.1: flat fill, no decorative chrome gradient. */
                  style={{ backgroundColor: d.productiveSec > 0 ? 'var(--color-amber-400)' : 'transparent' }}
                />
              </span>

              <span className="w-12 text-right text-[11px] tabular-nums text-zinc-400">
                {d.productiveSec > 0 ? formatTime(d.productiveSec) : '—'}
              </span>
              <span className="w-6 text-center text-[11px] tabular-nums text-[var(--color-emerald-ink)]">
                {d.goalsCompleted || ''}
              </span>
              <span className="w-5 text-center">
                {doneDates?.has(d.date)
                  ? <Flame size={12} className="inline text-amber-400" aria-hidden />
                  : <span className="text-zinc-700">·</span>}
              </span>
            </Row>
          )
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-zinc-800/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>avg <span className="text-zinc-300 tabular-nums">{formatTime(Math.round(avgProd))}</span>/day</span>
        {/* Was labelled "routines sealed" while counting every completed goal in
            `days`, which is not what "routine" means anywhere else in this file. */}
        <span>
          <span className="text-[var(--color-emerald-ink)] tabular-nums">{goalsSealed}</span> goals sealed
        </span>
        <span>
          <span className="text-[var(--color-violet-ink)] tabular-nums">{habitsKept}</span> habits kept
        </span>
        <span className="flex items-center gap-1">
          <Flame size={12} className="text-amber-400" aria-hidden />
          <span className="text-amber-300 tabular-nums">{streak}</span> day streak
        </span>
      </div>

      {/* The ONE proposal. Rendered as text, never as an array of suggestions —
          a review that lists five changes has an adoption rate of zero. */}
      {summary.proposal && (
        <div className="mt-2.5 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2">
          <div className="flex items-start gap-2">
            <Target size={12} className="mt-0.5 shrink-0 text-[var(--page-accent)]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12px] text-zinc-200">{summary.proposal.text}</p>
              {summary.proposal.why && (
                <p className="text-[11px] text-zinc-600 mt-0.5">{summary.proposal.why}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* `mostSkippedHabit` was computed by `buildWeeklyReview` on every call and
          then never rendered, so the one habit the review exists to name was
          invisible. Shown on its own row, by title. */}
      {summary.mostSkippedHabit && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-zinc-800/60 px-2.5 py-2">
          <Flame size={12} className="shrink-0 text-amber-400" aria-hidden />
          <p className="text-[12px] text-zinc-300 min-w-0">
            <span className="text-zinc-500">Skipped most:</span>{' '}
            <span className="text-zinc-200">{weekly.habitTitles?.[summary.mostSkippedHabit.id] ?? 'a tracked habit'}</span>
            <span className="text-zinc-600"> · missed {summary.mostSkippedHabit.missedDays} of 7 days</span>
          </p>
        </div>
      )}

      {/* "Nothing to change" is information, not an absence — it is shown. */}
      {summary.allClear && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-zinc-800/60 px-2.5 py-2">
          <Repeat size={12} className="text-[var(--color-emerald-ink)]" aria-hidden />
          <p className="text-[12px] text-zinc-300">
            {summary.done} of {summary.planned} sealed. Nothing to change.
          </p>
        </div>
      )}
    </div>
  )
}```

════════════════════════════════════════════════════════════
## `src/pages/registry/types.ts` — TabSpec.find + tabAliases
════════════════════════════════════════════════════════════
```typescript
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
}```

════════════════════════════════════════════════════════════
## `src/components/dashboard/widgetNav.ts` — #5 — the dead dashboard widget, now fixed
════════════════════════════════════════════════════════════
```typescript
import type { WidgetId } from './widgetRegistry';

export interface WidgetNavTarget {
  /** Router path — MUST exist in src/App.tsx <Route path="..."> */
  route: string;
  /** DeepNav target section, must match a [data-section="..."] attribute on the target page */
  section?: string;
  /** Sub-tab of the target page (Life: covenant|gold|notes|schedule|habits|self|memories) */
  tab?: string;
  /** Short human label used in the button tooltip and aria-label */
  label: string;
  /** Shown on the button face when it has room (short forms only) */
  short?: string;
}

/**
 * CANONICAL widget -> origin-page map.
 *
 * Every dashboard widget MUST have an entry here. The dashboard renders a
 * real <button> from WIDGET_NAV[widgetId]; no entry means no button, which is
 * exactly the regression this map exists to prevent.
 *
 * Route validity is enforced against the route table in src/App.tsx.
 * Previously the dashboard hard-coded these inline and 5 of them were dead:
 *   /lyceum, /browser-history, /context-brain, /covenant, /terminal/tabs/console
 * -> all fell through to NotFoundPage. They are now remapped to live routes.
 */
export const WIDGET_NAV: Record<WidgetId, WidgetNavTarget> = {
  // ── Row 1: hero band ───────────────────────────────────────────────
  'status-band':       { route: '/activity', tab: 'focus', section: 'activity.focus',        label: 'Focus sessions',  short: 'Focus' },
  momentum:            { route: '/activity', tab: 'productivity', section: 'activity.productivity', label: 'Productivity', short: 'Prod' },
  // ── Row 2 ──────────────────────────────────────────────────────────
  'tier-breakdown':    { route: '/activity', tab: 'apps', section: 'activity.apps',           label: 'App breakdown' },
  // ── Row 3 ──────────────────────────────────────────────────────────
  'pinned-activities': { route: '/activity', tab: 'focus', section: 'activity.focus',         label: 'Activity log' },
  // ── Row 4 ──────────────────────────────────────────────────────────
  goals:               { route: '/life',    tab: 'gold',                       label: 'Goals' },
  'quick-focus':       { route: '/activity', tab: 'focus', section: 'activity.focus',         label: 'Focus sessions',  short: 'Focus' },
  // `tab: 'habits'` pointed at a tab deleted in the Life consolidation.
  // The failure was SILENT and is the exact class AGENTS.md §5d warns about:
  // deepNav wrote `/life-activeTab = 'habits'` AND `location.state.tab`, then
  // usePageSurface rejected it against `validIds` and Life fell back to
  // Covenant — so clicking 'Habits & streaks' on the dashboard opened the
  // promises tab, and permanently poisoned the persisted tab key.
  deadlines:           { route: '/life',    tab: 'gold',                       label: 'Habits & streaks' },
  'longest-focus':     { route: '/rankings',                                  label: 'Rankings' },
  // ── Row 5 ──────────────────────────────────────────────────────────
  schedule:            { route: '/life',    tab: 'schedule',                   label: 'Schedule' },
  insights:            { route: '/reports', section: 'insights.recap',          label: 'Insights' },
  // ── Row 6 ──────────────────────────────────────────────────────────
  'productivity-chart':{ route: '/activity', tab: 'productivity', section: 'activity.productivity', label: 'Productivity' },
  // ── Row 7 ──────────────────────────────────────────────────────────
  'recent-sessions':   { route: '/activity', tab: 'apps', section: 'activity.apps',           label: 'Session history' },
  // ── Rows 8-9: stat widgets ─────────────────────────────────────────
  'ai-usage':          { route: '/ai',                                        label: 'AI' },
  'console-widget':    { route: '/terminal',                                  label: 'Console' },
  'finance-widget':    { route: '/finance', section: 'finance.overview',       label: 'Finance' },
  'learn-widget':      { route: '/learn',                                     label: 'Learn' },
  'browser-widget':    { route: '/activity', tab: 'websites', section: 'activity.websites',   label: 'Websites' },
  'brain-widget':      { route: '/life',    tab: 'self',                       label: 'Context Brain' },
  'covenant-widget':   { route: '/life',    tab: 'covenant',                   label: 'Covenant' },
  'health-widget':     { route: '/external',                                  label: 'Health & sleep' },
};

/** True when the widget has a real destination to jump to. */
export function hasWidgetNav(id: string): boolean {
  return Boolean((WIDGET_NAV as Record<string, WidgetNavTarget>)[id]?.route);
}

/** Dev guard: returns the widget ids that would render a dead button. */
export function findWidgetsMissingNav(ids: readonly string[]): string[] {
  return ids.filter((id) => !hasWidgetNav(id));
}
```


════════════════════════════════════════════════════════════
## REQUEST 4 — TheVault body + the two goal types (unblocks D3a)
════════════════════════════════════════════════════════════
```typescript
function TheVault({ longTermGoals, todayGoals, onSave, onDelete }: {
  longTermGoals: LongTermGoal[];
  todayGoals: Goal[];
  onSave: (form: LTGForm, existing?: LongTermGoal) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
```

```typescript
// src/types/goals.ts
64:export interface Goal {
65-  id: string;
66-  title: string;
67-  description?: string;
68-  category: GoalCategory;
69-  target: GoalTarget;
70-  period: GoalPeriod;
71-  status: GoalStatus;
72-  date: string;
73-  source: GoalSource;
74-  links: GoalLink[];
75-  progressSeconds?: number;
76-  completedAt?: string;
77-  createdAt: string;
78-
79-  // Existing extended fields
80-  parentId?: string;
81-  parentIds?: string[];
82-  streak?: number;
83-  isHabit?: boolean;
84-  cadence?: 'daily' | 'weekly';
85-  weeklyTargetDays?: number[];
86-  detection?: {
```

```typescript
// LongTermGoal — where is it declared?
src/types/goals.ts:107:export interface LongTermGoal {
```

════════════════════════════════════════════════════════════
## REQUEST 4 (answered) — TheVault props + the two queries
════════════════════════════════════════════════════════════
```typescript
/* `todayGoals` was declared here, destructured, and NEVER READ — and the caller
   was feeding it the long-term bucket through an `as unknown as Goal[]` cast. So
   the cast was a type lie with no consumer behind it.

   Worse, it hid a real defect: the Vault's list renders from `longTermGoals`
   (`api.getLongtermGoals`), a DIFFERENT query from the `goals` batch that produces
   `vaultGoals`. Two queries, one concept, no reconciliation — so the group header
   could count N while the list rendered M. That is the same "two sources that can
   disagree" failure as the double-reading completions.
// ...body references longTermGoals at two sites only; todayGoals was NEVER read.
```

## REQUEST 6 (answered) — the pageId consumer that broke D1
════════════════════════════════════════════════════════════
```typescript
// src/App.tsx:420-425
  const handleSmartSearchSelect = useCallback((hit: SearchHit) => {
    if (hit.pageId !== currentPageId) {
      const route = resolvePageRoute(hit.pageId);
      // Never drop the click on the floor for an unregistered page id.
      navigateTo({ route: route?.route ?? `/${hit.pageId}`, tab: hit.section ? route?.tab : undefined }, navigate);
    }
```
```typescript
// src/App.tsx:368 — currentPageId, what the Page scope compares against
  const currentPageId = location.pathname === '/' ? 'dashboard'
    : location.pathname.replace('/', '') || 'dashboard';
```

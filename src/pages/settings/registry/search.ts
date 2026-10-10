/**
 * search.ts — ranked Settings search over the manifest.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE OLD MATCHER GOT WRONG
 *
 *   for (const [tabId, keywords] of Object.entries(settingsTabKeywords)) {
 *     if (keywords.some(kw => q.includes(kw) || kw.includes(q))) return tabId
 *   }
 *
 * Three separate defects, all of which produce a wrong answer rather than an
 * error:
 *
 * 1. `return` on the FIRST hit resolves ambiguity by OBJECT INSERTION ORDER.
 *    `sync` is a keyword of both `category` and `auth`, so "sync" always landed
 *    on Category and the Auth tab was unreachable by its own headline feature.
 * 2. `kw.includes(q)` makes very short queries match almost everything: "a" is
 *    contained in "category", so a one-letter query picked whichever tab happened
 *    to be declared first.
 * 3. No synonym expansion and no coverage requirement, so a word absent from the
 *    keyword list produced NO match at all, and the page silently did not move.
 *    Combined with three tabs missing from the list entirely, "keyboard
 *    shortcut" found nothing — which reads exactly like broken search.
 *
 * This scores instead. A tab wins on the BEST match, and partial coverage is
 * allowed with a penalty, so "dark mode narrow font" still lands on Appearance.
 */
import { SETTINGS_TABS, SETTING_GROUPS } from './settings-manifest'
import type { SettingGroupSpec, SettingsTabId, SettingsTabSpec } from './types'

export interface TabMatch {
  tab: SettingsTabSpec
  score: number
  /** Keywords that matched, for highlighting and for explaining the result. */
  hits: string[]
  /** Index of the winning keyword within the tab's own list; the tiebreak. */
  firstHitIndex: number
}

export interface GroupMatch {
  group: SettingGroupSpec
  score: number
  hits: string[]
}

export interface SettingsSearchResult {
  tabs: TabMatch[]
  groups: GroupMatch[]
  /** The tab to jump to, or null when nothing matched well enough. */
  bestTab: SettingsTabId | null
  /** True when the query was understood but matched nothing at all. */
  empty: boolean
}

/** How many query words a tab must cover to be a candidate at all. */
const MIN_COVERAGE = 0.5

/**
 * Score one keyword against one query token.
 *
 * Tiers, mirroring the Ctrl+K scorer so the two surfaces behave identically:
 *   exact 1000 · prefix 700 · word-start 500 · substring 300
 * minus a small penalty for how far in the keyword the match starts, so "cat"
 * prefers a keyword that is literally "category" over one that merely ends in it.
 */
function scoreToken(text: string, token: string): number {
  if (!text) return 0
  const t = text.toLowerCase()
  if (t === token) return 1000
  if (t.startsWith(token)) return 700 - Math.min(t.length, 40)
  const at = t.indexOf(token)
  if (at > -1) return 300 - Math.min(at, 40)
  return 0
}

function scoreList(items: string[], tokens: string[]): { score: number; hits: string[]; firstHitIndex: number } {
  let total = 0
  const hits: string[] = []
  let firstHitIndex = Number.MAX_SAFE_INTEGER
  for (const token of tokens) {
    let best = 0
    let bestTerm = ''
    let bestIndex = Number.MAX_SAFE_INTEGER
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      let s = scoreToken(item, token)

      // One-character tokens are not a search. "a" is a prefix of "appearance"
      // (689) and a substring of "category" (299), so before this guard typing
      // "a" yanked the user to Appearance and looked like a random jump. A single
      // character may still FILTER within the current tab, but it must never
      // navigate.
      if (token.length < 2) s = Math.min(s, 200)

      // Position tiebreak. Keywords are written in order of importance to their
      // tab, so when two tabs tie on the same word the one that lists it EARLIER
      // meant it more. This is what stops `sync` (a headline feature of both Auth
      // and Category) from being decided by array order.
      if (s > 0 && s >= best) {
        if (s > best || i < bestIndex) { best = s; bestTerm = item; bestIndex = i }
      }
    }
    if (best > 0) {
      total += best
      hits.push(bestTerm)
      if (bestIndex < firstHitIndex) firstHitIndex = bestIndex
    }
  }
  return { score: total, hits, firstHitIndex }
}

/**
 * Search tabs and groups.
 *
 * `extraCorpus` is the live text of the currently rendered settings, harvested by
 * `SearchableSection`. Feeding it in means a control that was never added to the
 * manifest is still findable by the words on screen — the manifest supplies
 * SYNONYMS, the DOM supplies TRUTH.
 */
export function searchSettings(
  query: string,
  opts: { extraCorpus?: string; visibleTabs?: SettingsTabId[] } = {},
): SettingsSearchResult {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return { tabs: [], groups: [], bestTab: null, empty: false }
  }

  const visible = opts.visibleTabs
    ? new Set(opts.visibleTabs)
    : null
  const corpus = (opts.extraCorpus ?? '').toLowerCase()

  const tabs: TabMatch[] = []
  for (const tab of SETTINGS_TABS) {
    if (visible && !visible.has(tab.id)) continue

    const { score, hits, firstHitIndex } = scoreList([tab.label, tab.id, ...tab.keywords], tokens)
    // Live text can rescue a tab the manifest does not know a word for.
    const live = tokens.every(t => corpus.includes(t)) ? 250 : 0

    const coverage = tokens.filter(t => scoreToken(tab.label, t) > 0
      || tab.keywords.some(k => scoreToken(k, t) > 0)).length / tokens.length
    if (coverage < MIN_COVERAGE && live === 0) continue

    tabs.push({ tab, score: score + live, hits, firstHitIndex })
  }
  // Across-tab tiebreak. Three tabs can each hold a keyword worth exactly 1000
  // for the same word — `sync` is a headline feature of Auth, Category AND
  // Devices — and the old matcher resolved that by array order, which is
  // arbitrary. Keywords are written in order of importance to their tab, so the
  // tab that lists the word EARLIER meant it more.
  tabs.sort((a, b) => b.score - a.score || a.firstHitIndex - b.firstHitIndex)

  const groups: GroupMatch[] = []
  for (const group of SETTING_GROUPS) {
    if (visible && !visible.has(group.tab)) continue
    const { score, hits } = scoreList(
      [group.id.replace(/-/g, ' '), group.title ?? '', ...(group.keywords ?? [])],
      tokens,
    )
    // Inherited tab keywords make every group in a tab match its tab's words,
    // which would flood the list. Only keep a group when the group itself has a
    // reason to match, or when the tab is the single best tab.
    if (score === 0) continue
    groups.push({ group, score, hits })
  }
  groups.sort((a, b) => b.score - a.score)

  const best = tabs[0]
  // Navigate only when the match is REAL. Two conditions, both learned from
  // failures: the top score must clear the noise floor, AND at least one token
  // must have matched strongly on its own.
  //
  // The second condition exists because "ctrl k" is a legitimate query whose
  // second token is one character. A blanket "any short token blocks navigation"
  // rule threw that away. Meanwhile "a" alone is capped at 200 in `scoreList`, so
  // it can never clear the floor and cannot navigate. The floor plus the cap
  // already handle it; requiring a strong token as well stops a long query whose
  // only real signal came from incidental substrings.
  const hasStrongToken = tokens.some(t => scoreToken(best?.tab.label ?? '', t) >= 500
    || (best?.tab.keywords ?? []).some(k => scoreToken(k, t) >= 500))
  const bestTab = best && best.score >= 500 && hasStrongToken ? best.tab.id : null

  return {
    tabs,
    groups: groups.slice(0, 6),
    bestTab,
    empty: tabs.length === 0 && groups.length === 0,
  }
}

/** Highlight runs for rendering a matched keyword inside a longer label. */
export function highlightRuns(text: string, terms: string[]): Array<{ text: string; hit: boolean }> {
  if (!terms.length) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const marks: Array<[number, number]> = []
  for (const term of terms) {
    if (!term) continue
    let from = 0
    for (;;) {
      const at = lower.indexOf(term.toLowerCase(), from)
      if (at === -1) break
      marks.push([at, at + term.length])
      from = at + term.length
    }
  }
  if (!marks.length) return [{ text, hit: false }]
  marks.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const m of marks) {
    const last = merged[merged.length - 1]
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1])
    else merged.push([m[0], m[1]])
  }
  const out: Array<{ text: string; hit: boolean }> = []
  let cur = 0
  for (const [a, b] of merged) {
    if (a > cur) out.push({ text: text.slice(cur, a), hit: false })
    out.push({ text: text.slice(a, b), hit: true })
    cur = b
  }
  if (cur < text.length) out.push({ text: text.slice(cur), hit: false })
  return out
}

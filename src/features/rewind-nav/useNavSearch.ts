/**
 * useNavSearch.ts — ranked fuzzy search with match ranges, plus recents.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY NOT uFuzzy / fuse.js
 *
 * The spec suggests a library. Both are absent from package.json, and installing
 * on this box right now means mutating `node_modules` while two other agents are
 * running `vite build` with swap exhausted. The work a library would save is the
 * part we need anyway: scoring and MATCH RANGES for highlighting. That is ~60
 * lines below, with no dependency and no install risk.
 *
 * If we later want trigram tolerance or typo distance, swap this module for
 * uFuzzy behind the same signature — it is the only file that would change.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState } from 'react'
import { NAV_ENTRIES, type NavEntry } from './nav-tree'

/** A highlighted character range within a title. */
export type Range = [start: number, end: number]

export interface Scored {
  entry: NavEntry
  score: number
  /** Ranges in `entry.title` that matched. */
  ranges: Range[]
  /** Ranges in `entry.reelTitle` that matched. */
  reelRanges: Range[]
}

const RECENTS_KEY = 'rewind:recents'
const RECENTS_MAX = 24

/* ── recents ─────────────────────────────────────────────────────────────── */

export interface RecentVisit {
  id: string
  at: number
}

function loadRecents(): RecentVisit[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(r => r && typeof r.id === 'string') : []
  } catch {
    return []
  }
}

/**
 * Record a visit. localStorage, not SQLite: this is per-user UI state with no
 * query value, and SQLite here is single-writer on a contended box (see
 * agent-coordination/MULTI_AGENT_PROTOCOL.md R1).
 */
export function noteVisit(id: string) {
  try {
    const next = [{ id, at: Date.now() }, ...loadRecents().filter(r => r.id !== id)]
      .slice(0, RECENTS_MAX)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch { /* private mode — recents are a nicety */ }
}

export function useRecents() {
  const [recents, setRecents] = useState<RecentVisit[]>(() => loadRecents())
  // Re-read on open: visits happen while the overlay is closed.
  useEffect(() => {
    const on = () => setRecents(loadRecents())
    window.addEventListener('rewind:opened', on)
    return () => window.removeEventListener('rewind:opened', on)
  }, [])
  return recents
}

/** The last N visited frames, newest first. */
export function recentEntries(recents: RecentVisit[], limit = 5): NavEntry[] {
  const out: NavEntry[] = []
  for (const r of recents) {
    const e = NAV_ENTRIES.find(n => n.id === r.id)
    if (e && !out.some(o => o.id === e.id)) out.push(e)
    if (out.length >= limit) break
  }
  return out
}

/* ── scoring ─────────────────────────────────────────────────────────────── */

/** Subsequence match: chars must appear in order. Returns index pairs or null. */
function subsequence(hay: string, needle: string): number[] | null {
  const idx: number[] = []
  let j = 0
  for (let i = 0; i < hay.length && j < needle.length; i++) {
    if (hay[i] === needle[j]) idx.push(i), j++
  }
  return j === needle.length ? idx : null
}

/** Merge adjacent indices into contiguous ranges for clean highlighting. */
function toRanges(indices: number[]): Range[] {
  const out: Range[] = []
  for (const i of indices) {
    const last = out[out.length - 1]
    if (last && i === last[1]) last[1] = i + 1
    else out.push([i, i + 1])
  }
  return out
}

interface Match { score: number; ranges: Range[] }

/**
 * Score one field. Tiered so that a prefix beats a substring beats a subsequence:
 *
 *   1000 exact            "gold"
 *    700 prefix            "gol" -> "Gold"
 *    500 word-start        "life" -> "Life / Notes"
 *    300 substring         "ife" -> "Notes"
 *    220 subsequence       "nts" -> "Notes"
 *
 * A leading-index penalty makes "code" prefer "Coding" over "Barcode".
 */
function matchField(text: string, query: string): Match {
  if (!query) return { score: 0, ranges: [] }
  const t = text.toLowerCase()
  const q = query.toLowerCase()

  if (t === q) return { score: 1000, ranges: [[0, text.length]] }
  if (t.startsWith(q)) return { score: 700 - Math.min(t.length, 40), ranges: [[0, q.length]] }

  const at = t.indexOf(q)
  if (at > -1) return { score: 300 - Math.min(at, 40), ranges: [[at, at + q.length]] }

  // word-start anywhere: preceded by a space, slash or dot
  let best = -1
  for (let i = 0; i + q.length <= t.length; i++) {
    if (t.startsWith(q, i) && i > 0 && /[\s/.]/.test(t[i - 1])) { best = i; break }
  }
  if (best > -1) return { score: 500 - Math.min(best, 40), ranges: [[best, best + q.length]] }

  const sub = subsequence(t, q)
  if (sub) {
    // Tightness: how much of the field the match consumes.
    const coverage = q.length / t.length
    return { score: 120 + Math.round(coverage * 100), ranges: toRanges(sub) }
  }
  return { score: 0, ranges: [] }
}

/** Keywords are worth less than the visible title. */
function matchKeywords(entry: NavEntry, query: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  for (const k of entry.haystack.split(' ')) {
    if (k === q) return 180
  }
  return entry.haystack.includes(q) ? 90 : 0
}

/**
 * Score every entry against the query.
 *
 * EVERY token must contribute (spec §5: "typing changes the selection to the best
 * match"). Requiring all tokens is what stops "life notes" from matching every
 * Life page via the inherited reel title.
 */
export function searchEntries(query: string): Scored[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const out: Scored[] = []
  for (const entry of NAV_ENTRIES) {
    let total = 0
    const titleIdx: number[] = []
    const reelIdx: number[] = []
    let ok = true

    for (const tok of tokens) {
      const inTitle = matchField(entry.title, tok)
      const inReel = matchField(entry.reelTitle, tok)
      const inKw = matchKeywords(entry, tok)

      // A token satisfied by the PARENT reel title is worth less than one that
      // hits the frame's own name, otherwise every frame of a reel ties.
      const best = Math.max(inTitle.score, inReel.score * 0.6, inKw)
      if (best === 0) { ok = false; break }
      total += best
      titleIdx.push(...inTitle.ranges.flatMap(([a, b]) => {
        const r: number[] = []; for (let i = a; i < b; i++) r.push(i); return r
      }))
      reelIdx.push(...inReel.ranges.flatMap(([a, b]) => {
        const r: number[] = []; for (let i = a; i < b; i++) r.push(i); return r
      }))
    }
    if (!ok) continue

    // Shallower wins ties: a reel root beats one frame among many.
    out.push({
      entry,
      score: total * 10 - entry.depth,
      ranges: toRanges([...new Set(titleIdx)].sort((a, b) => a - b)),
      reelRanges: toRanges([...new Set(reelIdx)].sort((a, b) => a - b)),
    })
  }

  out.sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length)
  return applyFinestWordBias(out, tokens[tokens.length - 1])
}

/**
 * Prefer the entry that matches the LAST query word BY NAME.
 *
 * Without this, "handbook practice" tied the `Handbook` GROUP frame against the
 * `Practice` frame and the group won on ordering luck, because the two score
 * identically: the group matches "handbook" in its own title (1000) and "practice"
 * only via keywords (180); Practice matches "practice" in its own title (1000) and
 * "handbook" only via its inherited group keywords (180). 1180 each.
 *
 * People type coarse to fine — "handbook" narrows, "practice" picks. So the final
 * word in the query is the finest-grained one, and an entry that matches it BY
 * NAME is the one meant. Only a strong tier counts (exact / prefix / word-start),
 * so an entry that merely happens to contain the letters does not qualify.
 */
function applyFinestWordBias(scored: Scored[], lastToken: string): Scored[] {
  if (!lastToken) return scored
  const BIAS = 600
  return scored
    .map(s => (matchField(s.entry.title, lastToken).score >= 500
      ? { ...s, score: s.score + BIAS }
      : s))
    .sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length)
}

/**
 * Splits `text` into alternating plain/marked runs for rendering highlights.
 * Merges overlapping ranges so nested marks never stack.
 */
export function highlight(text: string, ranges: Range[]): Array<{ text: string; hit: boolean }> {
  if (!ranges.length) return [{ text, hit: false }]
  const merged: Range[] = []
  for (const r of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
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

/**
 * Suggestions for the no-match state. Spec §5: "say so plainly and suggest 2 or
 * 3 real pages. No jokes." Picks the most-visited real destinations, so the
 * suggestion is genuinely likely to be what they meant.
 */
export function suggestions(recents: RecentVisit[], limit = 3): NavEntry[] {
  const ranked = recents
    .map(r => ({ e: NAV_ENTRIES.find(n => n.id === r.id), at: r.at }))
    .filter((x): x is { e: NavEntry; at: number } => !!x)
    .sort((a, b) => b.at - a.at)
    .map(x => x.e)
  if (ranked.length >= limit) return ranked.slice(0, limit)
  const filler = NAV_ENTRIES.filter(n => n.isReelRoot).slice(0, limit - ranked.length)
  return [...ranked, ...filler].slice(0, limit)
}
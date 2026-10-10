/**
 * ClassicNav.tsx — MODE 1 of 2: the plain list.
 *
 * This is the default, and deliberately so. It is the familiar ranked list that
 * Ctrl+K has always been: no reels, no strip, no animation, instant travel. It is
 * also the fallback that guarantees the film mode can never make the app feel
 * broken — if the animation is ever janky on someone's machine, switching to
 * classic removes 100% of it with no loss of function.
 *
 * Same search, same destinations, same `travel()` as the film mode. The only
 * difference is the presentation.
 */
import { useMemo, useRef } from 'react'
import { CornerDownLeft, Search } from 'lucide-react'
import { highlight, type Scored } from './useNavSearch'
import { breadcrumb, REELS, type NavEntry } from './nav-tree'

export interface ClassicNavProps {
  query: string
  onQueryChange: (q: string) => void
  results: Scored[]
  selectedIndex: number
  onSelectIndex: (i: number) => void
  onCommit: (entry: NavEntry, instant: boolean) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  recent: NavEntry[]
}

export default function ClassicNav({
  query, onQueryChange, results, selectedIndex, onSelectIndex, onCommit,
  inputRef, recent,
}: ClassicNavProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const emptyQuery = query.trim().length === 0

  /**
   * With an empty query the spec wants a "Recent" group plus the reel roots.
   * `results` is empty in that state (search returns [] for a blank query), so we
   * compose the view here rather than teaching the search function to fake hits.
   */
  const groups = useMemo(() => {
    if (emptyQuery) return []
    const byReel = new Map<string, Scored[]>()
    for (const r of results) {
      const list = byReel.get(r.entry.reelId) ?? []
      list.push(r)
      byReel.set(r.entry.reelId, list)
    }
    return [...byReel].map(([reelId, items]) => ({
      key: reelId,
      label: REELS.find(r => r.id === reelId)?.title ?? reelId,
      items,
    }))
  }, [emptyQuery, results])

  const recentScored = useMemo<Scored[]>(
    () => recent.map(e => ({ entry: e, score: 0, ranges: [], reelRanges: [] })),
    [recent],
  )

  return (
    <div className="flex w-full max-w-2xl flex-col" style={{ maxHeight: 'min(60vh, 520px)' }}>
      {/* input */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="rewind-classic-results"
          aria-activedescendant={
            results[selectedIndex] ? `rw-c-${results[selectedIndex].entry.id}` : undefined
          }
          aria-label="Search pages"
          placeholder="Go to a page"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        />
      </div>

      <div
        ref={listRef}
        id="rewind-classic-results"
        role="listbox"
        aria-label="Results"
        className="flex-1 overflow-y-auto overscroll-contain py-1"
      >
        {emptyQuery && (
          <>
            {recentScored.length > 0 && (
              <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Recent
              </div>
            )}
            {recentScored.map((s, i) => (
              <Row
                key={`recent-${s.entry.id}`}
                s={s}
                index={i}
                selected={selectedIndex === i}
                onHover={() => onSelectIndex(i)}
                onClick={() => onCommit(s.entry, false)}
              />
            ))}
            {REELS.map((reel, i) => {
              const idx = recentScored.length + i
              // A reel row navigates to the reel's own route. Using `frames[0]`
              // here was a type error and, worse, would have jumped you straight
              // into a sub-tab the moment you picked the reel from the list.
              const target: NavEntry = {
                id: reel.id,
                reelId: reel.id,
                reelTitle: reel.title,
                title: reel.title,
                path: reel.path,
                icon: reel.icon,
                haystack: [reel.title, ...reel.keywords].join(' ').toLowerCase(),
                depth: 0,
                preview: 'bars',
                trail: [],
                isReelRoot: true,
              }
              return (
                <Row
                  key={`reel-${reel.id}`}
                  s={{ entry: target, score: 0, ranges: [], reelRanges: [] }}
                  index={idx}
                  selected={selectedIndex === idx}
                  onHover={() => onSelectIndex(idx)}
                  onClick={() => onCommit(target, false)}
                  label={reel.title}
                  breadcrumb={reel.hint}
                />
              )
            })}
          </>
        )}

        {!emptyQuery && groups.map(g => (
          <div key={g.key}>
            <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {g.label}
            </div>
            {g.items.map((s) => {
              const i = results.indexOf(s)
              return (
                <Row
                  key={s.entry.id}
                  s={s}
                  index={i}
                  selected={selectedIndex === i}
                  onHover={() => onSelectIndex(i)}
                  onClick={() => onCommit(s.entry, false)}
                />
              )
            })}
          </div>
        ))}

        {!emptyQuery && results.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-zinc-400">Nothing matches “{query.trim()}”.</p>
            <p className="mt-1 text-xs text-zinc-600">Try a page name, or clear the search.</p>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-600">
        <span><span className="text-zinc-400">↑↓</span> move</span>
        <span><span className="text-zinc-400">↵</span> open</span>
        <span><span className="text-zinc-400">⇧↵</span> instant</span>
        <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
          <CornerDownLeft className="h-3 w-3" aria-hidden />
          {emptyQuery ? 'type to filter' : `${selectedIndex + 1} of ${results.length}`}
        </span>
      </div>
    </div>
  )
}

function Row({
  s, index, selected, onHover, onClick, label, breadcrumb: crumb,
}: {
  s: Scored
  index: number
  selected: boolean
  onHover: () => void
  onClick: () => void
  label?: string
  breadcrumb?: string
}) {
  const title = label ?? s.entry.title
  return (
    <div
      id={`rw-c-${s.entry.id}`}
      role="option"
      aria-selected={selected}
      data-idx={index}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ${
        selected ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:bg-zinc-800/50'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">
        {highlight(title, s.ranges).map((p, i) => (
          <span key={i} className={p.hit ? 'text-amber-400' : undefined}>{p.text}</span>
        ))}
      </span>
      {crumb !== undefined && (
        <span className="max-w-[45%] shrink-0 truncate text-[10px] text-zinc-600">{crumb}</span>
      )}
      {crumb === undefined && !s.entry.isReelRoot && (
        <span className="max-w-[45%] shrink-0 truncate text-[10px] text-zinc-600">
          {breadcrumb(s.entry)}
        </span>
      )}
    </div>
  )
}

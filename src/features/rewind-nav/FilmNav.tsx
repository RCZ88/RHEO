/**
 * FilmNav.tsx — MODE 2 of 2: reels + film strip + rewind.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN INTENT (AGENTS.md §5b requires this before any UI code)
 *
 * **1. What is the idea?**
 * Navigation as a film rewinder. You are not picking from a list; you are
 * scrubbing back to where you were. Pages are reels, their subpages are frames
 * on that reel's film, and travel is the physical act of the strip running past
 * your thumb and stopping on the frame you chose.
 *
 * **2. What does the meaning require?**
 * - The reels spin ONLY during travel. A reel turning idly is decoration and
 *   violates LAMINAR §6 ("no decorative infinite loops"); spinning while
 *   rewinding is the literal thing the metaphor describes. So motion is spent
 *   entirely in the rewind, which is also what spec §3 asks for ("spend the
 *   boldness in ONE place").
 * - The timecode counts back through REAL `lastVisitedAt` dates, so the metaphor
 *   is carrying information rather than decorating it.
 * - Matte black film, hairline rim, one amber accent — the darkroom, not a toy.
 *   No thick strokes, no cartoon outlines, no emoji (LAMINAR §7.5/§7.8).
 *
 * **3. What does the meaning require of every choice?**
 * - Selected frame is amber; nothing else in the chrome is. One signal hue.
 * - Non-matching reels and frames DIM rather than disappear (spec §5) so the
 *   shape of the app stays visible while you type.
 * - Reels are a single rail that centres the selection and scales neighbours —
 *   a soft fisheye — because a wrapped grid stops working past ~10 pages and
 *   there are 21.
 *
 * **4. Does it fit the parent?**
 * The overlay uses the same matte surface and hairline rules as every other
 * DeskFlow modal, and the same amber as the AFK chain. It reads as part of the
 * app, with one deliberate moment of theatre at the end.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import Reel from './Reel'

import Frame from './Frame'
import FilmGrain from './FilmGrain'
import type { Scored } from './useNavSearch'
import { REELS, breadcrumb, type NavEntry, type Reel as ReelT } from './nav-tree'
import type { TravelProgress } from './useTravel'

export interface FilmNavProps {
  query: string
  onQueryChange: (q: string) => void
  /** Ranked matches; drives dimming and strip selection. */
  results: Scored[]
  /** Currently selected entry (a reel root or a frame). */
  selected: NavEntry | undefined
  onSelectIndex: (i: number) => void
  onCommit: (entry: NavEntry, instant: boolean) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  progress: TravelProgress
  /** True while a travel is running; reels spin and the rail blurs. */
  traveling: boolean
  /** Real epoch the rewind is counting back toward. */
  targetVisitedAt?: number
  /** Rendered height of the rail viewport; narrows on small windows (spec §4). */
  railViewport: React.RefObject<HTMLDivElement | null>
}

export default function FilmNav({
  query, onQueryChange, results, selected, onSelectIndex,
  onCommit, inputRef, progress, traveling, targetVisitedAt, railViewport,
}: FilmNavProps) {
  const empty = query.trim().length === 0

  /** Reels whose frames match. Empty query matches everything (spec §5). */
  const matched = useMemo(() => {
    if (empty) return new Set(REELS.map(r => r.id))
    const s = new Set<string>()
    for (const r of results) s.add(r.entry.reelId)
    // A reel with NO matched frame still deserves to be selectable when its own
    // title is the match (e.g. typing "terminal" with no subpage hit).
    for (const r of REELS) {
      if (results.some(x => x.entry.id === r.id)) s.add(r.id)
    }
    return s
  }, [results, empty])

  /** The reel being browsed: the selected entry's reel, else the first match. */
  const activeReel: ReelT | undefined = useMemo(() => {
    if (selected) return REELS.find(r => r.id === selected.reelId)
    if (!empty) {
      const first = results[0]?.entry
      if (first) return REELS.find(r => r.id === first.reelId)
    }
    return REELS[0]
  }, [selected, results, empty])

  const matchedFrameIds = useMemo(
    () => new Set(results.map(r => r.entry.id)),
    [results],
  )

  // ── Film-strip centring ──────────────────────────────────────────────────
  // The strip must centre the SELECTED FRAME, not the first frame. Padding the
  // row (the old `px-[38vw]`) pushed the first frame to x=1422 inside a strip
  // whose visible window was 644-1404, i.e. every frame sat off the right edge
  // and the strip rendered as an empty black band. Measured, not guessed.
  //
  // Prompt 04 gives the formula:
  //   translateX(stripWidth / 2 - (frame.offsetLeft + frame.offsetWidth / 2))
  // We use getBoundingClientRect deltas rather than offsetLeft because the row
  // is already transformed, so offsetLeft is measured pre-transform and drifts
  // as we scroll. Difference-of-rects is transform-agnostic.
  const stripRef = useRef<HTMLDivElement>(null)
  const frameRefs = useRef(new Map<string, HTMLDivElement>())
  const [stripOffset, setStripOffset] = useState(0)

  const centerStrip = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const frames = activeReel?.frames
    if (!frames || frames.length === 0) { setStripOffset(0); return }

    // Prefer the selected frame; fall back to the middle one (prompt: "or the
    // middle frame if none").
    const selIdx = selected
      ? frames.findIndex(f => f.id === selected.id)
      : -1
    const idx = selIdx >= 0 ? selIdx : Math.floor(frames.length / 2)
    const target = frameRefs.current.get(frames[idx].id)
    if (!target) return

    // ABSOLUTE, from offsetLeft -- the prompt's own formula:
    //   translateX(stripWidth/2 - (frame.offsetLeft + frame.offsetWidth/2))
    //
    // The previous version accumulated `prev - (rectCentre - stripCentre)`, and
    // that is a FEEDBACK LOOP: setState had not committed the new transform when
    // the effect re-measured, so getBoundingClientRect returned pre-transform
    // rects and the same delta was applied twice. Measured result: the row sat at
    // -1700px when it should have been -850px, shoving 8 of 10 frames off-screen.
    //
    // offsetLeft is LAYOUT position, unaffected by transforms, so this computes
    // the right answer on the first try and cannot double-apply.
    const row = target.offsetParent as HTMLElement | null
    const base = row ? target.offsetLeft - row.offsetLeft : target.offsetLeft
    const stripW = strip.clientWidth
    const next =
      idx <= 0
        ? base                                  // first frame flush left
        : idx >= frames.length - 1
          ? stripW - (base + target.offsetWidth) // last frame flush right
          : stripW / 2 - (base + target.offsetWidth / 2)
    setStripOffset(next)
  }, [activeReel, selected])

  useEffect(() => {
    centerStrip()
  }, [centerStrip, activeReel?.id])

  // Re-centre once webfonts/layout settle, and on window resize.
  useEffect(() => {
    const id = requestAnimationFrame(centerStrip)
    window.addEventListener('resize', centerStrip)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', centerStrip) }
  }, [centerStrip])
  /** Absolute index of the active reel in the rail, for centring. */
  const activeReelIndex = activeReel ? REELS.findIndex(r => r.id === activeReel.id) : 0

  /**
   * Rail centring, measured rather than computed from an assumed slot width.
   *
   * This was a `useMemo` reading `railViewport.current.clientWidth`. On the first
   * render that ref is still null, so it returned 0, and because it only listed
   * `visibleReels` as a dependency it never recomputed once the ref attached. The
   * rail therefore never scrolled: reel 0 sat hard left and you saw only the flat
   * tail of the fisheye (every outer reel the same 56px), which is what made all
   * the labels collide at one another too.
   *
   * Measuring the active reel's own rect has the same property that fixed the film
   * strip: it is correct regardless of slot width, gap, or how many reels exist.
   */
  const reelRefs = useRef(new Map<string, HTMLDivElement>())
  const [railOffset, setRailOffset] = useState(0)

  const centerRail = useCallback(() => {
    const vp = railViewport.current
    if (!vp || !activeReel) return
    const target = reelRefs.current.get(activeReel.id)
    if (!target) return
    // Absolute, same reasoning as the strip: offsetLeft is transform-independent,
    // so there is no accumulate-and-double feedback loop here either.
    const idx = REELS.findIndex(r => r.id === activeReel.id)
    const row = target.offsetParent as HTMLElement | null
    const base = row ? target.offsetLeft - row.offsetLeft : target.offsetLeft
    const vpW = vp.clientWidth
    const next =
      idx <= 0
        ? base
        : idx >= REELS.length - 1
          ? vpW - (base + target.offsetWidth)
          : vpW / 2 - (base + target.offsetWidth / 2)
    setRailOffset(next)
  }, [activeReel])

  useEffect(() => {
    const id = requestAnimationFrame(centerRail)
    window.addEventListener('resize', centerRail)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', centerRail) }
  }, [centerRail, activeReelIndex])

  /** Real date the timecode counts toward. */
  const timecode = useMemo(() => {
    const target = targetVisitedAt ?? Date.now() - 1000 * 60 * 60 * 24 * 3
    const from = Date.now()
    const at = from + (target - from) * progress.t
    const d = new Date(at)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }, [progress.t, targetVisitedAt])

  /**
   * `FRAME 07 / 46` for the edge print (spec §3: "the page name and a frame
   * number"). Zero-padded so the counter does not jitter in width as you arrow
   * through the strip — an unpadded `7 / 46` reflows and the whole strip shifts by
   * a pixel on every selection, which reads as instability.
   */
  const frameCount = activeReel?.frames.length ?? 0
  const selectedFrameIndex = selected && activeReel
    ? activeReel.frames.findIndex(f => f.id === selected.id)
    : -1
  const edgeCounter = frameCount === 0
    ? ''
    : `frame ${String(selectedFrameIndex < 0 ? 0 : selectedFrameIndex + 1).padStart(2, '0')} / ${frameCount}`

  const statusText = selected
    ? breadcrumb(selected)
    : (results[0] ? breadcrumb(results[0].entry) : '')

  return (
    <div className="flex w-full max-w-[760px] flex-col items-center">
      <FilmGrain />

      {/* search */}
      <div className="group flex w-full max-w-[640px] items-center gap-3 border-b-2 border-zinc-700 px-1 pb-2 transition-colors duration-150 focus-within:border-amber-400">
        <Search className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="rewind-strip"
          aria-activedescendant={selected ? `rw-f-${selected.id}` : undefined}
          aria-label="Search pages"
          placeholder="Where to?"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent text-[27px] font-semibold text-zinc-50 outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* reel rail — a single centred rail, NOT wrapped rows (spec §4) */}
      <div
        ref={railViewport}
        className={`mt-9 w-full overflow-hidden transition-[filter] duration-200 ${traveling ? 'blur-[1.5px]' : ''}`}
      >
        <div
          className="relative flex items-end gap-2 will-change-transform"
          style={{
            transform: `translate3d(${railOffset}px,0,0)`,
            // Half-viewport gutters. Without them the first reel sits hard left and
            // can never be centred, because any translate that would centre it is
            // also a translate that runs the row off the right edge.
            paddingLeft: 'calc(50% - 60px)',
            paddingRight: 'calc(50% - 60px)',
          }}
        >
          {REELS.map((reel, i) => {
            const distance = i - activeReelIndex
            // Soft fisheye: neighbours shrink and dim. Distance is clamped so a
            // 21-page rail does not collapse its own ends to nothing.
            const d = Math.max(-3, Math.min(3, distance))
            const isActive = reel.id === activeReel?.id
            // Explicit per-distance width (prompt: 120 / 84 / 56) instead of a
            // transform scale. Scaling a fixed box changes the GAPS but not the
            // layout, so neighbours slid under each other; real widths reflow the
            // rail properly and keep the falloff honest at both edges.
            const reelPx = isActive ? 120 : Math.abs(d) === 1 ? 84 : 56
            return (
              <div
                key={reel.id}
                ref={(el: HTMLDivElement | null) => {
                  if (el) reelRefs.current.set(reel.id, el)
                  else reelRefs.current.delete(reel.id)
                }}
                className="flex shrink-0 cursor-pointer flex-col items-center transition-opacity duration-200"
                style={{
                  // Width only. This column must stay AUTO height.
                  //
                  // It was `height: reelPx` too, which was my bug: the column holds
                  // the reel (h-full == reelPx) PLUS the label (~17px) PLUS gap-2
                  // (8px), so every label was pushed ~25px outside its own box. The
                  // rail is `items-end`, so five reels of three different heights
                  // bottom-aligned their columns and spilled their labels to three
                  // different depths -- straight down into the film strip, which is
                  // exactly the "colliding with one another" report.
                  //
                  // Now the reel's SIZE lives on the square below (reelBox) and the
                  // column grows naturally. items-end then bottom-aligns the columns,
                  // which puts every label at the same height and grows the reels
                  // upward -- the fisheye we actually wanted.
                  width: reelPx,
                  opacity: matched.has(reel.id) ? (isActive ? 1 : Math.max(0.4, 1 - Math.abs(d) * 0.3)) : 0.15,
                }}
                onClick={() => {
                  const idx = results.findIndex(r => r.entry.reelId === reel.id)
                  if (idx > -1) onSelectIndex(idx)
                }}
                role="option"
                aria-selected={isActive}
                aria-label={reel.title}
              >
                <div
                  className={`flex items-center justify-center ${
                    isActive ? 'rounded-[12px] ring-2 ring-amber-400' : ''
                  }`}
                  style={{ width: reelPx, height: reelPx }}
                >
                  <Reel spinning={traveling} seed={i} />
                </div>
                {/* Labels were `max-w-[120px]` on EVERY reel while outer reels are
                    only 56px wide, so neighbouring titles overlapped into an
                    unreadable pile ("Terminal WorkAI Studio"). Now: the active reel
                    and its two neighbours get a label, each truncated to its OWN
                    slot width, and the rest get none. Nothing can collide because
                    nothing is wider than the gap it sits in. */}
                {(isActive || Math.abs(d) === 1) && (
                  <>
                  <span
                    className={`block truncate text-[14px] leading-tight ${
                      isActive ? 'font-semibold text-amber-400' : 'text-zinc-400'
                    }`}
                    style={{ maxWidth: reelPx }}
                  >
                    {reel.title}
                  </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* film strip for the active reel
          `rewind-strip` supplies the matte black base, the sprocket holes along
          both edges and the quiet edge print. It is the OUTER, fixed container on
          purpose: the holes stay put while the frames slide underneath them,
          which is what film looks like. On the scrolling row the sprockets would
          race across the screen with the content. */}
      <div
        id="rewind-strip"
        ref={stripRef}
        role="listbox"
        aria-label={`${activeReel?.title ?? 'Page'} sections`}
        className="rewind-strip relative mt-10 w-full overflow-hidden"
        style={{
          // Soft fade at both edges, per spec §4. Mask rather than a gradient
          // overlay so the frames underneath do not double up.
          maskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)',
        }}
      >
        {/* Edge print: reel name + frame counter, as on real stock. */}
        <div className="rewind-edge rewind-edge--top" aria-hidden>
          <span>{activeReel?.title ?? ''}</span>
          <span>{edgeCounter}</span>
        </div>
        <div className="rewind-edge rewind-edge--bottom" aria-hidden>
          <span>{selected?.path ?? ''}</span>
          <span>{edgeCounter}</span>
        </div>

        {/*
          py-7 (28px) is load-bearing, not styling. The strip stacks as:
            4px strip padding -> 3px sprocket offset + 8px holes -> 15px edge
            print offset + ~9px of text
          so the topmost 24px are spoken for. With py-3 (12px) the frame box
          started at 16px and ran straight THROUGH the edge print, hiding it.
          4 + 28 = 32px clears 24px with 8px to spare, and the same maths puts the
          bottom sprockets and edge print clear of the frame's lower edge.
        */}
        <div
          className="relative flex gap-0 py-7 will-change-transform"
          style={{
            transform: `translate3d(${stripOffset}px,0,0)`,
            paddingLeft: 'calc(50% - 85px)',
            paddingRight: 'calc(50% - 85px)',
          }}
        >
          {(activeReel?.frames ?? []).map(frame => {
            const entry: NavEntry = {
              id: frame.id,
              reelId: activeReel!.id,
              reelTitle: activeReel!.title,
              frameId: frame.id,
              title: frame.title,
              path: frame.path,
              tab: frame.tab,
              section: frame.section,
              navState: frame.navState,
              icon: frame.icon,
              haystack: frame.title.toLowerCase(),
              depth: frame.depth,
              preview: frame.preview,
              trail: frame.trail,
              isReelRoot: false,
            }
            const matchIdx = results.findIndex(r => r.entry.id === frame.id)
            const ranges = matchIdx > -1 ? results[matchIdx].ranges : []
            return (
              <Frame
                key={frame.id}
                frameRef={(el: HTMLDivElement | null) => {
                  if (el) frameRefs.current.set(frame.id, el)
                  else frameRefs.current.delete(frame.id)
                }}
                entry={entry}
                selected={selected?.id === frame.id}
                dim={!empty && !matchedFrameIds.has(frame.id)}
                ranges={ranges}
                onSelect={() => { if (matchIdx > -1) onSelectIndex(matchIdx); else onCommit(entry, false) }}
              />
            )
          })}
        </div>
      </div>

      {/*
        Status + timecode.

        Fix-prompt 04 complaint 6: the idle line used to read "Type to search" with
        "Try a page name" beneath it -- instructions in the middle of the screen
        telling you to do the obvious, which pushed the actual content down and
        gave the eye nothing to land on. With nothing typed there is nothing to
        report, so the line now shows the Reel and hints the two keys that matter.
        "Nothing matches." survives because that IS information, and PAINT P5
        wants the empty state to explain what would have been there.
      */}
      <div className="mt-5 flex min-h-[2.5rem] flex-col items-center gap-1 px-6 text-center">
        <p className="max-w-full truncate text-sm text-zinc-300">
          {results.length === 0 && !empty
            ? 'Nothing matches.'
            : statusText || activeReel?.title || ''}
        </p>
        <p className="text-[12px] text-zinc-400">
          {results.length > 0 ? 'Enter to rewind there' : '↑↓ reels · ↵ rewind · esc close'}
        </p>
        {/* Screen readers get the travel result; visually the timecode carries it. */}
        <p aria-live="polite" className="sr-only">
          {traveling ? `Rewinding to ${statusText}` : `${statusText}${results.length ? `, ${results.length} matches` : ''}`}
        </p>
      </div>

      <div
        className="mt-1 font-mono text-xs tabular-nums text-zinc-500"
        aria-hidden={!traveling}
      >
        {traveling ? timecode : ' '}
      </div>
    </div>
  )
}

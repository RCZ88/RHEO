/**
 * RewindNav.tsx — the overlay. Hosts BOTH modes and owns the keyboard contract.
 *
 * Modes (spec-free addition the user asked for):
 *   `classic` — plain ranked list, instant travel. The DEFAULT.
 *   `film`    — reels + film strip + rewind travel.
 *
 * Switching is instant and lives in Settings. Both modes share this file's search
 * results, selection index, travel function and accessibility wiring, so they
 * cannot drift apart on behaviour.
 *
 * Keyboard (spec §5), identical in both modes:
 *   Ctrl/Cmd K  toggle          Esc  close (cancels a running travel)
 *   ↑ ↓         move            ← →  same when the query is empty
 *   Tab         next reel       Shift+Tab  previous reel
 *   Enter       travel          Shift+Enter  travel instantly, no animation
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ClassicNav from './ClassicNav'
import FilmNav from './FilmNav'
import { REELS, type NavEntry } from './nav-tree'
import { recentEntries, searchEntries, suggestions, useRecents } from './useNavSearch'
import { useTravel } from './useTravel'
import { readRewindPrefs } from './useRewindSetting'
import './rewind-nav.css'

export interface RewindNavProps {
  open: boolean
  onClose: () => void
  /**
   * Persist the frame rect the zoom expands from. Classic mode has no frame, so
   * the zoom is skipped there and travel is instant.
   */
  setZoomFrom?: (r: DOMRect | null) => void
}

export default function RewindNav({ open, onClose }: RewindNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const recents = useRecents()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const railViewport = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  // Read the mode on OPEN, not per render: the overlay is lazy-mounted and this
  // avoids re-reading localStorage on every keystroke.
  const [mode, setMode] = useState(() => readRewindPrefs().mode)

  const { phase, progress, zoomFrom, setPhase, close: closeTravel, cancel, travel } = useTravel({
    navigate,
    onSettled: onClose,
    pathname: location.pathname,
  })

  const results = useMemo(() => searchEntries(query), [query])
  const empty = query.trim().length === 0
  const recent = useMemo(() => recentEntries(recents, 5), [recents])
  const sugg = useMemo(() => suggestions(recents, 3), [recents])

  const selected = results[selectedIndex]?.entry

  /** The list the keyboard walks. Matches what is on screen. */
  const ordered = useMemo<NavEntry[]>(() => {
    if (!empty) return results.map(r => r.entry)
    const roots: NavEntry[] = REELS.map(reel => ({
      id: reel.id,
      reelId: reel.id,
      reelTitle: reel.title,
      title: reel.title,
      path: reel.path,
      icon: reel.icon,
      haystack: reel.title.toLowerCase(),
      depth: 0,
      preview: 'bars',
      trail: [],
      isReelRoot: true,
    }))
    return [...recent, ...roots]
  }, [empty, results, recent])

  /* ── open / close ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return
    // Re-read prefs on each open so changing the mode in Settings takes effect
    // without needing a reload.
    setMode(readRewindPrefs().mode)
    setQuery('')
    setSelectedIndex(0)
    setPhase('browsing')
    restoreFocus.current = document.activeElement as HTMLElement | null
    window.dispatchEvent(new CustomEvent('rewind:opened'))
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => {
      clearTimeout(t)
      // Spec §7: focus return on close.
      restoreFocus.current?.focus?.()
    }
  }, [open, setPhase])

  /** Unmount the heavy SVG when closed — spec §6, zero cost when idle. */
  if (!open) return null

  const commit = useCallback((entry: NavEntry, instant: boolean) => {
    if (phase === 'traveling') cancel()
    void travel(entry, { instant })
  }, [travel, phase, cancel])

  /* ── keyboard ─────────────────────────────────────────────────────────── */

  const move = useCallback((delta: number) => {
    setSelectedIndex(i => {
      const n = ordered.length
      if (n === 0) return 0
      return Math.min(Math.max(i + delta, 0), n - 1)
    })
  }, [ordered.length])

  /** Tab / Shift+Tab jump between REELS (spec §5). */
  const jumpReel = useCallback((dir: number) => {
    const cur = ordered[selectedIndex]
    const curReel = cur?.reelId ?? REELS[0].id
    const at = REELS.findIndex(r => r.id === curReel)
    const next = REELS[Math.min(Math.max(at + dir, 0), REELS.length - 1)]
    const idx = ordered.findIndex(e => e.reelId === next.id)
    if (idx > -1) setSelectedIndex(idx)
  }, [ordered, selectedIndex])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Esc always works, and cancels an in-flight travel (spec §6).
      if (e.key === 'Escape') {
        e.preventDefault()
        if (phase === 'traveling') cancel()
        else { closeTravel(); onClose() }
        return
      }
      if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && empty && query.length === 0)) {
        e.preventDefault(); move(1); return
      }
      if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && empty && query.length === 0)) {
        e.preventDefault(); move(-1); return
      }
      if (e.key === 'Tab') {
        e.preventDefault(); jumpReel(e.shiftKey ? -1 : 1); return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const entry = ordered[selectedIndex]
        if (entry) commit(entry, e.shiftKey)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, move, jumpReel, ordered, selectedIndex, commit, phase, cancel, closeTravel, onClose, empty, query])

  /* ── focus trap (spec §7) ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!open || !dialogRef.current) return
    const node = dialogRef.current
    const onFocusIn = (e: FocusEvent) => {
      if (node.contains(e.target as Node)) return
      inputRef.current?.focus()
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [open])

  /** Clicking the backdrop closes; clicking inside must not. */
  const onBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) { closeTravel(); onClose() }
  }, [closeTravel, onClose])

  const traveling = phase === 'traveling'
  const showSuggestions = !empty && results.length === 0

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Go to a page"
      onMouseDown={onBackdrop}
      className="fixed inset-0 z-[10000] flex min-h-0 flex-col items-center justify-center overflow-hidden bg-zinc-950 light:bg-[var(--ws-surface)] px-6"
    >
      {mode === 'film' ? (
        <FilmNav
          query={query}
          onQueryChange={q => { setQuery(q); setSelectedIndex(0) }}
          results={results}
          selected={selected}
          onSelectIndex={setSelectedIndex}
          onCommit={commit}
          inputRef={inputRef}
          progress={progress}
          traveling={traveling}
          targetVisitedAt={recents.find(r => r.id === selected?.id)?.at}
          railViewport={railViewport}
        />
      ) : (
        <div className="flex w-full max-w-[760px] flex-1 items-start justify-center px-6">
          <ClassicNav
            query={query}
            onQueryChange={q => { setQuery(q); setSelectedIndex(0) }}
            results={results}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            onCommit={commit}
            inputRef={inputRef}
            recent={recent}
          />
        </div>
      )}

      {/* No-match state is plain and gives real destinations (spec §5, no jokes). */}
      {showSuggestions && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
          <div className="pointer-events-auto rounded-xl border border-white/10 bg-zinc-900 light:bg-[var(--ws-surface-raised)] px-4 py-3">
            <p className="text-xs text-zinc-500">Try instead</p>
            <div className="mt-2 flex gap-2">
              {sugg.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setQuery(s.title); setSelectedIndex(0) }}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  {s.reelTitle} / {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/*
        Zoom proxy: a fixed-position element sized ONCE and moved with
        translate/scale. The prototype animates left/top/width/height, which
        forces layout on every frame (spec §5 and LAMINAR §7.9 both forbid it).
      */}
      {traveling && zoomFrom && mode === 'film' && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[10001] rounded-[8px] bg-amber-400/15 ring-1 ring-amber-400/50"
          style={{
            left: zoomFrom.left,
            top: zoomFrom.top,
            width: zoomFrom.width,
            height: zoomFrom.height,
            animation: 'rewind-zoom 400ms cubic-bezier(0.7,0,0.2,1) forwards',
          }}
        />
      )}
    </div>
  )
}
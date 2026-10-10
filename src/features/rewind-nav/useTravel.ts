/**
 * useTravel.ts — the travel sequence and the overlay state machine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY NOT `layoutId`
 *
 * Spec §5 asks for a FLIP / `layoutId` shared-element expansion. Both require the
 * source AND the destination to be mounted and measurable at the same time. Here
 * the destination is a ROUTE that is not mounted until the travel completes, which
 * is the last step of the animation. `layoutId` would have nothing to measure.
 *
 * So the zoom is driven by explicit transforms on a proxy element, measured from
 * the frame's real rect. Same visual result, and it actually works.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY transform/opacity only
 *
 * Spec §5 and LAMINAR §7.9 both forbid it. The prototype animates `left`, `top`,
 * `width` and `height` on the zoom element — four layout-triggering properties,
 * which forces reflow on every frame and visibly stutters on a large overlay.
 * The proxy here is sized once and moved with `translate3d` + `scale`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { navigateTo } from '@/lib/deepNav'
import type { NavigateFunction } from 'react-router-dom'
import type { NavEntry } from './nav-tree'
import { noteVisit } from './useNavSearch'
import { BurstGuard, effectiveMotion, readRewindPrefs, type RewindMotion } from './useRewindSetting'

/** Spec §9: a state machine, not loose booleans. */
export type NavPhase = 'closed' | 'browsing' | 'traveling'

export interface TravelProgress {
  /** 0..1 through the rewind; drives the timecode and the reel spin. */
  t: number
  /** ms remaining, for the status line. */
  remaining: number
}

/** Spec §5 phase boundaries, in ms. `full` total is 1400. */
export const TIMING = {
  spinUp: 250,
  rewind: 550,
  settle: 200,
  zoom: 400,
  get full() { return this.spinUp + this.rewind + this.settle + this.zoom },
  /** Spec §5: "Quick (about 300ms crossfade plus slide)". */
  quick: 300,
}

function wait(ms: number, signal?: { cancelled: boolean }) {
  return new Promise<void>(resolve => {
    if (ms <= 0 || signal?.cancelled) return resolve()
    setTimeout(resolve, ms)
  })
}

export interface UseTravelArgs {
  navigate: NavigateFunction
  /** Called when the overlay should unmount (after the zoom reveals the page). */
  onSettled: () => void
  /** Current pathname, for the "already here" nudge. */
  pathname: string
}

export function useTravel({ navigate, onSettled, pathname }: UseTravelArgs) {
  const [phase, setPhase] = useState<NavPhase>('closed')
  const [progress, setProgress] = useState<TravelProgress>({ t: 0, remaining: 0 })
  /** The frame rect the zoom expands from. */
  const [zoomFrom, setZoomFrom] = useState<DOMRect | null>(null)
  const cancelRef = useRef({ cancelled: false })
  const burst = useRef(new BurstGuard())
  const rafRef = useRef<number | null>(null)

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => stopRaf, [stopRaf])

  const open = useCallback(() => {
    cancelRef.current = { cancelled: false }
    setPhase('browsing')
  }, [])

  const close = useCallback(() => {
    cancelRef.current.cancelled = true
    stopRaf()
    setPhase('closed')
    setProgress({ t: 0, remaining: 0 })
    setZoomFrom(null)
  }, [stopRaf])

  /**
   * Cancel an in-flight travel and snap back.
   * Spec §6: "User retypes or presses Enter during an animation: finish or cancel
   * cleanly, never stack animations." Every travel takes the token, so a second
   * Enter mid-animation cancels the first rather than racing it.
   */
  const cancel = useCallback(() => {
    cancelRef.current.cancelled = true
    stopRaf()
    setProgress({ t: 0, remaining: 0 })
    setZoomFrom(null)
    setPhase('browsing')
  }, [stopRaf])

  /** Drives the timecode + spin. Pure rAF, transform-only consumers. */
  const runProgress = useCallback((duration: number) => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setProgress({ t, remaining: Math.round(duration * (1 - t)) })
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else rafRef.current = null
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  /**
   * Travel to a destination.
   *
   * `instant` is Shift+Enter (spec §5): route changes immediately, no animation,
   * no timecode. Also used when motion is `off`.
   */
  const travel = useCallback(async (
    entry: NavEntry,
    opts: { instant?: boolean; fromRect?: DOMRect | null } = {},
  ) => {
    if (phase === 'traveling') cancel()
    const signal = cancelRef.current
    const prefs = readRewindPrefs()
    const motion: RewindMotion = prefs.mode === 'film' ? effectiveMotion(prefs) : 'off'

    const shortCircuit = burst.current.shouldShortCircuit()
    const instant = opts.instant || motion === 'off' || shortCircuit

    // Already here: spec §6, "close with a small nudge, no rewind".
    if (entry.path === pathname && !entry.tab && !entry.section) {
      close()
      return
    }

    setPhase('traveling')

    const doRoute = () => {
      navigateTo(
        { route: entry.path, tab: entry.tab, section: entry.section, state: entry.navState },
        navigate,
      )
    }

    if (instant) {
      // Spec §5 "Quick": a short crossfade so the change is not a hard cut.
      if (motion === 'quick') {
        await wait(TIMING.quick * 0.6, signal)
        if (signal.cancelled) return cancel()
      }
      doRoute()
      noteVisit(entry.id)
      close()
      onSettled()
      return
    }

    const total = TIMING.full
    setZoomFrom(opts.fromRect ?? null)
    runProgress(total)

    await wait(TIMING.spinUp + TIMING.rewind, signal)
    if (signal.cancelled) return cancel()

    await wait(TIMING.settle, signal)
    if (signal.cancelled) return cancel()

    // Spec §5 step 4: change the route WHILE the frame fully covers the screen,
    // then fade the frame out. The route change goes first so the real page is
    // already mounted behind the frame when it fades — otherwise you get a flash
    // of the old page.
    doRoute()
    noteVisit(entry.id)

    await wait(TIMING.zoom, signal)
    stopRaf()
    close()
    onSettled()
  }, [phase, pathname, navigate, close, cancel, runProgress, stopRaf, onSettled])

  return { phase, setPhase, progress, zoomFrom, open, close, cancel, travel }
}

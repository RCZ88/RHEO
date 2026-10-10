/**
 * usePerfProfiler.ts — the React binding for `lib/perfRecorder`.
 *
 * `useSyncExternalStore` rather than a context provider, for the same reason
 * `lib/stopwatchStore.ts` uses it: the store has to outlive any provider,
 * because the provider would live inside the tree that `<Routes
 * key={location.pathname}>` tears down on every navigation. A profiler that
 * reset its history each time you opened the page would be useless.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  arm,
  disarm,
  getSnapshot,
  isArmed,
  reset,
  subscribe,
} from '../lib/perfRecorder'
import type { PerfSnapshot } from '../shared/perfTypes'

export function usePerfSnapshot(): PerfSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Arm/disarm plus the clear action, as one hook so a page cannot accidentally
 * wire a toggle to `reset()` (which wipes data but leaves the profiler running)
 * or to `disarm()` when it meant `reset()`.
 */
export function usePerfControl(): {
  armed: boolean
  toggle: () => void
  clear: () => void
} {
  const snapshot = usePerfSnapshot()

  const toggle = useCallback(() => {
    if (isArmed()) disarm()
    else arm()
  }, [])

  const clear = useCallback(() => {
    reset()
  }, [])

  return { armed: snapshot.armed, toggle, clear }
}

/**
 * Arm on mount, disarm on unmount.
 *
 * Deliberately NOT the default for the page: the user asked for an explicit
 * control, and auto-arming on page entry would tax the app for anyone who only
 * came to read the numbers. The page calls this only when the user opts in.
 */
export function useArmWhileMounted(armed: boolean): void {
  useEffect(() => {
    if (!armed) return
    arm()
    return () => disarm()
  }, [armed])
}

/**
 * useRewindSetting.ts — the mode switch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO MODES, AND WHY THE DEFAULT IS `classic`
 *
 * `classic` — the familiar ranked list. Zero animation, instant travel, no
 *   learning curve. This is what Ctrl+K did for years.
 * `film`    — reels + film strip + rewind travel.
 *
 * Default is `classic`, deliberately. The film mode is the more expensive thing:
 * it costs ~1.1s per navigation and it is a new interaction. Making it the
 * default would tax every existing user with a slower, unfamiliar Ctrl+K on the
 * strength of it being prettier, and there is no way to opt out if you dislike
 * motion. Opting IN is the reversible choice.
 *
 * `prefers-reduced-motion` additionally forces `quick`/`off` INSIDE film mode:
 * the mode is the user's explicit choice, so we keep the film layout and drop
 * only the travel animation, rather than silently overriding the mode itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useState } from 'react'

export type RewindMode = 'classic' | 'film'

/** Travel animation length. Only meaningful in `film` mode. */
export type RewindMotion = 'full' | 'quick' | 'off'

export interface RewindPrefs {
  mode: RewindMode
  motion: RewindMotion
}

const KEY = 'rewind:prefs:v1'

const DEFAULTS: RewindPrefs = { mode: 'classic', motion: 'full' }

function load(): RewindPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const p = JSON.parse(raw) ?? {}
    return {
      mode: p.mode === 'film' ? 'film' : 'classic',
      motion: p.motion === 'quick' || p.motion === 'off' ? p.motion : 'full',
    }
  } catch {
    return DEFAULTS
  }
}

/** Effective motion after honouring the OS reduced-motion preference. */
export function effectiveMotion(prefs: RewindPrefs): RewindMotion {
  if (prefs.motion === 'off') return 'off'
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return prefs.motion === 'full' ? 'quick' : 'off'
    }
  } catch { /* matchMedia unavailable */ }
  return prefs.motion
}

/**
 * Burst guard, spec §5: "if the user travels more than 3 times within 20 seconds,
 * auto drop to Quick for that burst. Power users must never feel slowed down."
 *
 * A ref, not state: it must not trigger a re-render, it is read inside the travel
 * call, and it expires on its own.
 */
const BURST_LIMIT = 3
const BURST_WINDOW_MS = 20_000

export class BurstGuard {
  private stamps: number[] = []
  /** True when this travel should skip the full animation. */
  shouldShortCircuit(now = Date.now()): boolean {
    this.stamps = this.stamps.filter(t => now - t < BURST_WINDOW_MS)
    if (this.stamps.length >= BURST_LIMIT) {
      // Re-arm without recording, so the burst does not grow forever.
      this.stamps = [now]
      return true
    }
    this.stamps.push(now)
    return false
  }
}

export function useRewindSetting() {
  const [prefs, setPrefs] = useState<RewindPrefs>(load)

  const update = useCallback((patch: Partial<RewindPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [])

  // Keep multiple windows / a remount in sync.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === KEY) setPrefs(load())
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  return { prefs, update, setMode: (m: RewindMode) => update({ mode: m }), setMotion: (m: RewindMotion) => update({ motion: m }) }
}

/**
 * Standalone read for non-React callers (the Ctrl+K handler in App.tsx reads this
 * on every keypress, and wrapping it in a hook would re-render the whole app when
 * the setting changes).
 */
export function readRewindPrefs(): RewindPrefs {
  return load()
}

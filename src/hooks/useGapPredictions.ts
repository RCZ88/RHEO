import { useCallback, useRef, useState } from 'react'
import type { ConfirmFill, DayGapGroup, Gap, GapMode, PredictedGap } from '../types/gaps'

const MODE_KEY = 'deskflow.gapFillMode'

export function loadMode(): GapMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'separate' ? 'separate' : 'combined'
  } catch {
    return 'combined'
  }
}
export function saveMode(mode: GapMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* storage disabled; ignore */
  }
}
export function modeChosen(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) != null
  } catch {
    return false
  }
}

type Api = {
  detectUsageGaps: (o?: { period?: string; minGapMinutes?: number }) => Promise<Gap[]>
  predictGapFill: (start: string, end: string, mode?: GapMode) => Promise<{ gaps: PredictedGap[] }>
  predictDayGaps: (date: string, mode?: GapMode) => Promise<{ date: string; slots: DayGapGroup[] }>
  confirmGapFill: (fills: ConfirmFill[]) => Promise<unknown>
}
const api = (): Api => (window as unknown as { deskflowAPI: Api }).deskflowAPI

export function useGapPredictions(period: string) {
  const [gaps, setGaps] = useState<Gap[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cache = useRef<Map<string, PredictedGap | null>>(new Map())

  const detect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api().detectUsageGaps({ period, minGapMinutes: 15 })
      setGaps(Array.isArray(list) ? list : [])
    } catch {
      setError('Could not load gaps')
    } finally {
      setLoading(false)
    }
  }, [period])

  const predictGap = useCallback(async (gap: Gap, mode: GapMode): Promise<PredictedGap | null> => {
    const key = gap.start + '|' + gap.end + '|' + mode
    if (cache.current.has(key)) return cache.current.get(key) ?? null
    try {
      const res = await api().predictGapFill(gap.start, gap.end, mode)
      const pg = res?.gaps?.[0] ?? null
      cache.current.set(key, pg)
      return pg
    } catch {
      setError('Could not load predictions')
      return null
    }
  }, [])

  const predictDay = useCallback(async (date: string, mode: GapMode): Promise<DayGapGroup[]> => {
    try {
      const res = await api().predictDayGaps(date, mode)
      return res?.slots ?? []
    } catch {
      setError('Could not load predictions')
      return []
    }
  }, [])

  const confirm = useCallback(async (fills: ConfirmFill[]): Promise<boolean> => {
    if (!fills.length) return true
    try {
      await api().confirmGapFill(fills)
      return true
    } catch {
      setError('Could not save filled slots')
      return false
    }
  }, [])

  return { gaps, loading, error, setError, detect, predictGap, predictDay, confirm }
}

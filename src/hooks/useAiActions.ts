import { useState, useEffect, useCallback, useRef } from 'react'
import { actionBus, type ActionEvent } from '../components/ai/lib/actionBus'

export function useAiActions() {
  const [active, setActive] = useState<ActionEvent[]>([])
  const [lastCompleted, setLastCompleted] = useState<ActionEvent | null>(null)
  const [lastError, setLastError] = useState<ActionEvent | null>(null)
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = actionBus.subscribe((event) => {
      setActive(actionBus.getActive())
      if (event.status === 'complete') {
        setLastCompleted(event)
        if (completeTimer.current) clearTimeout(completeTimer.current)
        completeTimer.current = setTimeout(() => setLastCompleted(null), 1500)
      }
      if (event.status === 'error') {
        setLastError(event)
        if (errorTimer.current) clearTimeout(errorTimer.current)
        errorTimer.current = setTimeout(() => setLastError(null), 2000)
      }
    })
    setActive(actionBus.getActive())
    return () => {
      unsub()
      if (completeTimer.current) clearTimeout(completeTimer.current)
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [])

  const isSlotActive = useCallback((slot: string) => actionBus.isSlotActive(slot), [])
  const isCardActive = useCallback((cardId: string) => actionBus.isCardActive(cardId), [])
  const getActionForSlot = useCallback((slot: string) => active.find(e => e.targetSlot === slot), [active])

  return { active, lastCompleted, lastError, isSlotActive, isCardActive, getActionForSlot }
}

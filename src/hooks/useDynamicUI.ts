import { useState, useCallback, useEffect, useRef } from 'react'
import type { DynamicUIComponent, AiUIGenerationResponse } from '../types/dynamicUI'
import type { CanvasCard } from '../types/canvas'
import { actionBus } from '../components/ai/lib/actionBus'

const STORAGE_KEY = 'rheo-dynamic-ui-components'

function loadFromStorage(): DynamicUIComponent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveToStorage(components: DynamicUIComponent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(components)) } catch {}
}

export function useDynamicUI() {
  const [components, setComponents] = useState<DynamicUIComponent[]>(loadFromStorage)
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildingProgress, setBuildingProgress] = useState(0)
  const buildTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { saveToStorage(components) }, [components])

  const simulateBuild = useCallback((onComplete: () => void) => {
    setIsBuilding(true)
    setBuildingProgress(0)
    let progress = 0
    buildTimerRef.current = setInterval(() => {
      progress += 0.05 + Math.random() * 0.1
      if (progress >= 1) {
        if (buildTimerRef.current) clearInterval(buildTimerRef.current)
        setBuildingProgress(1)
        setIsBuilding(false)
        onComplete()
      } else {
        setBuildingProgress(progress)
      }
    }, 100)
  }, [])

  const generateFromAI = useCallback((response: AiUIGenerationResponse) => {
    const actionId = `ui-gen-${Date.now()}`
    actionBus.start(actionId, 'ai-generate', 'Generating UI components')
    simulateBuild(() => {
      const newComps = response.components.map(c => ({
        ...c,
        id: c.id || crypto.randomUUID(),
        createdAt: Date.now(),
        source: 'ai-generated' as const,
      }))
      setComponents(prev => [...prev, ...newComps])
      actionBus.complete(actionId)
    })
  }, [simulateBuild])

  const addComponent = useCallback((comp: DynamicUIComponent) => {
    setComponents(prev => [...prev, { ...comp, id: comp.id || crypto.randomUUID(), createdAt: Date.now(), source: 'ai-generated' }])
  }, [])

  const removeComponent = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateComponent = useCallback((id: string, patch: Partial<DynamicUIComponent>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const toCanvasCards = useCallback((): CanvasCard[] => {
    return components.map(c => ({
      id: c.id,
      type: 'generated' as const,
      position: c.position || { x: 100, y: 100 },
      size: c.size || { w: 4, h: 3 },
      zIndex: 1,
      pinned: false,
      data: { dynamicComponent: c },
      source: 'ai' as const,
      status: 'live' as const,
      createdAt: c.createdAt,
    }))
  }, [components])

  return { components, isBuilding, buildingProgress, generateFromAI, addComponent, removeComponent, updateComponent, toCanvasCards }
}

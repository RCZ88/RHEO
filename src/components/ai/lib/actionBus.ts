import type { ActionType } from '../tokens'

export interface ActionEvent {
  id: string
  type: ActionType
  label: string
  targetSlot?: string
  targetCardId?: string
  status: 'executing' | 'complete' | 'error'
  error?: string
  startedAt: number
  completedAt?: number
}

type ActionCallback = (event: ActionEvent) => void

class ActionBus {
  private listeners: Set<ActionCallback> = new Set()
  private active: Map<string, ActionEvent> = new Map()
  private lastCompleted: ActionEvent | null = null
  private lastError: ActionEvent | null = null

  start(id: string, type: ActionType, label: string, meta?: { targetSlot?: string; targetCardId?: string }) {
    const event: ActionEvent = {
      id, type, label,
      targetSlot: meta?.targetSlot,
      targetCardId: meta?.targetCardId,
      status: 'executing',
      startedAt: Date.now(),
    }
    this.active.set(id, event)
    this.emit(event)
  }

  complete(id: string) {
    const event = this.active.get(id)
    if (!event) return
    event.status = 'complete'
    event.completedAt = Date.now()
    this.active.delete(id)
    this.lastCompleted = event
    this.emit(event)
  }

  fail(id: string, error?: string) {
    const event = this.active.get(id)
    if (!event) return
    event.status = 'error'
    event.error = error
    event.completedAt = Date.now()
    this.active.delete(id)
    this.lastError = event
    this.emit(event)
  }

  subscribe(cb: ActionCallback) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  getActive() { return Array.from(this.active.values()) }
  getLastCompleted() { return this.lastCompleted }
  getLastError() { return this.lastError }
  isSlotActive(slot: string) { return Array.from(this.active.values()).some(e => e.targetSlot === slot) }
  isCardActive(cardId: string) { return Array.from(this.active.values()).some(e => e.targetCardId === cardId) }

  private emit(event: ActionEvent) {
    this.listeners.forEach(cb => cb(event))
  }
}

export const actionBus = new ActionBus()

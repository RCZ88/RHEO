export type CardType =
  | 'focus' | 'plan' | 'reflect' | 'finance'
  | 'digest' | 'approval' | 'transient' | 'annotation'
  | 'response' | 'group' | 'connectors'
  | 'schedule' | 'deadlines' | 'planner'
  | 'automation'
  | 'generated'

export type CardStatus = 'live' | 'stale' | 'error' | 'loading'

export const GROUP_COLORS = [
  { id: 'violet', label: 'Violet', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', accent: '#8b5cf6' },
  { id: 'blue', label: 'Blue', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', accent: '#3b82f6' },
  { id: 'emerald', label: 'Emerald', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', accent: '#10b981' },
  { id: 'amber', label: 'Amber', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', accent: '#f59e0b' },
  { id: 'rose', label: 'Rose', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.35)', accent: '#f43f5e' },
  { id: 'cyan', label: 'Cyan', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.35)', accent: '#06b6d4' },
  { id: 'pink', label: 'Pink', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.35)', accent: '#ec4899' },
  { id: 'slate', label: 'Slate', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.35)', accent: '#64748b' },
] as const

export type GroupColorId = typeof GROUP_COLORS[number]['id']

export interface CanvasCard {
  id: string
  type: CardType
  position: { x: number; y: number }
  size: { w: number; h: number }
  zIndex: number
  pinned: boolean
  data: Record<string, any>
  source: 'ai' | 'user' | 'system'
  status: CardStatus
  createdAt: number
  dismissedAt?: number
  groupId?: string
}

export type GroupOrientation = 'vertical' | 'horizontal'

export interface CanvasGroup {
  id: string
  label: string
  colorId: GroupColorId
  cardIds: string[]
  position: { x: number; y: number }
  size: { w: number; h: number }
  createdAt: number
  orientation?: GroupOrientation
  ratio?: number // 0-1, controls the size split between items (0.5 = equal)
}

export interface CanvasState {
  cards: Record<string, CanvasCard>
  groups: Record<string, CanvasGroup>
  nextZIndex: number
  pan: { x: number; y: number }
  zoom: number
}

export type CanvasAction =
  | { type: 'ADD_CARD'; card: CanvasCard }
  | { type: 'UPDATE_CARD'; id: string; patch: Partial<CanvasCard> }
  | { type: 'REMOVE_CARD'; id: string }
  | { type: 'MOVE_CARD'; id: string; position: { x: number; y: number } }
  | { type: 'RESIZE_CARD'; id: string; size: { w: number; h: number } }
  | { type: 'PIN_CARD'; id: string }
  | { type: 'DISMISS_CARD'; id: string }
  | { type: 'SET_STATUS'; id: string; status: CardStatus }
  | { type: 'RESET_LAYOUT' }
  | { type: 'HYDRATE'; state: CanvasState }
  | { type: 'SET_PAN_ZOOM'; pan: { x: number; y: number }; zoom: number }
  | { type: 'CREATE_GROUP'; group: CanvasGroup; cardIds: string[]; groupCard: CanvasCard }
  | { type: 'UPDATE_GROUP'; id: string; patch: Partial<Pick<CanvasGroup, 'label' | 'colorId' | 'orientation' | 'ratio'>> }
  | { type: 'DELETE_GROUP'; id: string }
  | { type: 'UNGROUP'; id: string; mode: 'restore' | 'scatter' }
  | { type: 'ADD_TO_GROUP'; cardId: string; groupId: string }
  | { type: 'REMOVE_FROM_GROUP'; cardId: string; newPosition?: { x: number; y: number } }
  | { type: 'ARRANGE_GROUP'; id: string; positions: Record<string, { x: number; y: number }>; size: { w: number; h: number } }
  | { type: 'ADD_GENERATED_CARD'; card: CanvasCard }
  | { type: 'REMOVE_GENERATED_CARD'; id: string }
  | { type: 'SYNC_AUTOMATIONS'; automations: any[]; usedPositions: Set<string> }

export const DEFAULT_STATE: CanvasState = {
  cards: {},
  groups: {},
  nextZIndex: 1,
  pan: { x: 0, y: 0 },
  zoom: 1,
}

export interface DefaultSetupCard {
  type: CardType
  enabled: boolean
  defaultData?: Record<string, any>
  position: { x: number; y: number }
  size: { w: number; h: number }
  pinned: boolean
}

export interface DefaultSetupConfig {
  version: 1
  cards: DefaultSetupCard[]
  updatedAt: number
}

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'ADD_CARD':
      return {
        ...state,
        cards: { ...state.cards, [action.card.id]: { ...action.card, zIndex: state.nextZIndex } },
        nextZIndex: state.nextZIndex + 1,
      }
    case 'UPDATE_CARD':
      if (!state.cards[action.id]) return state
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], ...action.patch } } }
    case 'REMOVE_CARD': {
      const { [action.id]: _, ...rest } = state.cards
      return { ...state, cards: rest }
    }
    case 'MOVE_CARD':
      if (!state.cards[action.id]) return state
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], position: action.position } } }
    case 'RESIZE_CARD':
      if (!state.cards[action.id]) return state
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], size: action.size } } }
    case 'PIN_CARD':
      if (!state.cards[action.id]) return state
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], pinned: !state.cards[action.id].pinned } } }
    case 'DISMISS_CARD':
      if (!state.cards[action.id]) return state
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], dismissedAt: Date.now() } } }
    case 'SET_STATUS':
      if (!state.cards[action.id]) return state
      return { ...state, cards: { ...state.cards, [action.id]: { ...state.cards[action.id], status: action.status } } }
    case 'RESET_LAYOUT':
      return DEFAULT_STATE
    case 'HYDRATE':
      return action.state
    case 'SET_PAN_ZOOM':
      return { ...state, pan: action.pan, zoom: action.zoom }

    // ── Group actions ──
    case 'CREATE_GROUP': {
      const { group, cardIds, groupCard } = action
      const updatedCards = { ...state.cards }
      // Tag child cards with groupId (they remain visible, CanvasGrid will filter)
      cardIds.forEach(id => {
        if (updatedCards[id]) {
          updatedCards[id] = { ...updatedCards[id], groupId: group.id }
        }
      })
      return {
        ...state,
        groups: { ...state.groups, [group.id]: group },
        cards: { ...updatedCards, [groupCard.id]: groupCard },
        nextZIndex: state.nextZIndex + 1,
      }
    }
    case 'UPDATE_GROUP': {
      const group = state.groups[action.id]
      if (!group) return state
      return { ...state, groups: { ...state.groups, [action.id]: { ...group, ...action.patch } } }
    }
    case 'DELETE_GROUP': {
      const { [action.id]: _, ...rest } = state.groups
      const cards = { ...state.cards }
      for (const [id, c] of Object.entries(cards)) {
        if (c.type === 'group' && c.data?.groupId === action.id) {
          // Remove the visual group card itself
          delete cards[id]
        } else if (c.groupId === action.id) {
          cards[id] = { ...c, groupId: undefined }
        }
      }
      return { ...state, groups: rest, cards }
    }
    case 'UNGROUP': {
      const group = state.groups[action.id]
      if (!group) return state
      const { [action.id]: _, ...restGroups } = state.groups
      const updatedCards = { ...state.cards }

      // Find the visual group card and extract child card data
      const groupCardId = Object.keys(updatedCards).find(
        id => updatedCards[id].data?.groupId === action.id
      )
      const childCards = groupCardId ? updatedCards[groupCardId].data?.childCards || [] : []

      // Remove the visual group card
      if (groupCardId) {
        delete updatedCards[groupCardId]
      }

      // Restore child cards from stored data or clear groupId
      group.cardIds.forEach((id, index) => {
        const storedChild = childCards.find((c: any) => c.id === id)
        if (storedChild) {
          // Restore from stored data
          let newPos = storedChild.position || { x: 0, y: 0 }
          if (action.mode === 'scatter') {
            const offset = (index % 3) * 40
            const offsetY = Math.floor(index / 3) * 40
            newPos = { x: group.position.x + offset, y: group.position.y + offsetY }
          }
          updatedCards[id] = {
            ...storedChild,
            position: newPos,
            groupId: undefined,
            dismissedAt: undefined,
            zIndex: state.nextZIndex + index,
          }
        } else if (updatedCards[id]) {
          // Fallback: just clear groupId
          let newPos = updatedCards[id].position
          if (action.mode === 'scatter') {
            const offset = (index % 3) * 40
            const offsetY = Math.floor(index / 3) * 40
            newPos = { x: group.position.x + offset, y: group.position.y + offsetY }
          }
          updatedCards[id] = {
            ...updatedCards[id],
            groupId: undefined,
            position: newPos,
            dismissedAt: undefined,
          }
        }
      })

      return { ...state, groups: restGroups, cards: updatedCards, nextZIndex: state.nextZIndex + group.cardIds.length }
    }
    case 'ADD_TO_GROUP': {
      if (!state.cards[action.cardId] || !state.groups[action.groupId]) return state
      const group = state.groups[action.groupId]
      const card = state.cards[action.cardId]
      const updatedCards = {
        ...state.cards,
        [action.cardId]: { ...card, groupId: action.groupId },
      }
      // Keep the group card's childCards snapshot in sync
      for (const [id, c] of Object.entries(updatedCards)) {
        if (c.type === 'group' && c.data?.groupId === action.groupId) {
          const existing = (c.data?.childCards || []).filter((cc: any) => cc.id !== action.cardId)
          const snapshot = {
            id: card.id, type: card.type, data: card.data, source: card.source,
            position: card.position, size: card.size, pinned: card.pinned,
            status: card.status, createdAt: card.createdAt,
          }
          updatedCards[id] = { ...c, data: { ...c.data, childCards: [...existing, snapshot] } }
        }
      }
      return {
        ...state,
        cards: updatedCards,
        groups: { ...state.groups, [action.groupId]: { ...group, cardIds: [...group.cardIds, action.cardId] } },
      }
    }
    case 'REMOVE_FROM_GROUP': {
      const card = state.cards[action.cardId]
      if (!card?.groupId || !state.groups[card.groupId]) return state
      const group = state.groups[card.groupId]
      const updatedCards = {
        ...state.cards,
        [action.cardId]: {
          ...card,
          groupId: undefined,
          position: action.newPosition || card.position,
          dismissedAt: undefined,
        },
      }
      // Keep the group card's childCards snapshot in sync
      for (const [id, c] of Object.entries(updatedCards)) {
        if (c.type === 'group' && c.data?.groupId === card.groupId) {
          updatedCards[id] = {
            ...c,
            data: { ...c.data, childCards: (c.data?.childCards || []).filter((cc: any) => cc.id !== action.cardId) },
          }
        }
      }
      return {
        ...state,
        cards: updatedCards,
        groups: {
          ...state.groups,
          [card.groupId]: { ...group, cardIds: group.cardIds.filter(id => id !== action.cardId) },
        },
      }
    }
    case 'ARRANGE_GROUP': {
      const group = state.groups[action.id]
      if (!group) return state
      const updatedCards = { ...state.cards }
      Object.entries(action.positions).forEach(([cardId, pos]) => {
        if (updatedCards[cardId]) {
          updatedCards[cardId] = { ...updatedCards[cardId], position: pos }
        }
      })
      return {
        ...state,
        groups: { ...state.groups, [action.id]: { ...group, size: action.size } },
        cards: updatedCards,
      }
    }
    case 'ADD_GENERATED_CARD':
      return {
        ...state,
        cards: { ...state.cards, [action.card.id]: { ...action.card, zIndex: state.nextZIndex } },
        nextZIndex: state.nextZIndex + 1,
      }
    case 'REMOVE_GENERATED_CARD': {
      const { [action.id]: _, ...restCards } = state.cards
      return { ...state, cards: restCards }
    }
    case 'SYNC_AUTOMATIONS': {
      const updatedCards = { ...state.cards }
      let nextZ = state.nextZIndex
      const payloadIds = new Set(action.automations.map((a: any) => `auto-${a.ruleId}`))

      // Remove deleted automations
      for (const [id, c] of Object.entries(updatedCards)) {
        if (c.type === 'automation' && !payloadIds.has(id)) delete updatedCards[id]
      }

      // Add new / update existing
      let col = 0, row = 0
      for (const auto of action.automations) {
        const id = `auto-${auto.ruleId}`
        if (updatedCards[id]) {
          updatedCards[id] = { ...updatedCards[id], data: { ...updatedCards[id].data, automation: auto } }
        } else {
          while (action.usedPositions.has(`${col},${row}`)) {
            col += 6
            if (col > 18) { col = 0; row += 6 }
          }
          action.usedPositions.add(`${col},${row}`)
          updatedCards[id] = {
            id, type: 'automation', position: { x: 40 + col * 40, y: 40 + row * 40 },
            size: { w: 8, h: 5 }, zIndex: nextZ, pinned: true, source: 'system',
            status: 'live', data: { automation: auto }, createdAt: Date.now(),
          }
          nextZ++
        }
      }
      return { ...state, cards: updatedCards, nextZIndex: nextZ }
    }
    default:
      return state
  }
}

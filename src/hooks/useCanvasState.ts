import { useReducer, useState, useCallback, useEffect, useRef } from 'react'
import { canvasReducer, DEFAULT_STATE } from '../types/canvas'
import {
  loadCanvasLayout, saveCanvasLayout, clearCanvasLayout,
  listCanvases, loadCanvasById, renameCanvas, deleteCanvas,
  loadDefaultSetup, BUILTIN_DEFAULT_SETUP, createNewCanvas,
  type CanvasSnapshot
} from '../services/canvasPersistence'
import { generateUUID } from '../lib/uuid'
import type { CanvasCard, CanvasState, CardStatus, CardType, CanvasGroup, GroupColorId, CanvasAction, DefaultSetupConfig } from '../types/canvas'

const DISMISS_TIMEOUT_MS = 30_000
const MAX_HISTORY = 50

// Actions that should be recorded in undo history
const HISTORY_ACTIONS = new Set<CanvasAction['type']>([
  'ADD_CARD', 'REMOVE_CARD', 'UPDATE_CARD', 'MOVE_CARD', 'RESIZE_CARD',
  'PIN_CARD', 'DISMISS_CARD', 'SET_STATUS',
  'CREATE_GROUP', 'DELETE_GROUP', 'UNGROUP', 'ADD_TO_GROUP', 'REMOVE_FROM_GROUP',
  'ARRANGE_GROUP', 'UPDATE_GROUP',
  'ADD_GENERATED_CARD', 'REMOVE_GENERATED_CARD',
])

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── Group tidy layout ───────────────────────────────────────────────────
// ONE algorithm for every path that organises a group (creation, the Tidy
// button, arrange modes). Reads cards in reading order, packs them into
// equal-width columns (the shortest column takes the next card — masonry, so
// no holes), and returns an EXACT-fit frame size. Cards are never resized.
const GROUP_CELL = 40
const GROUP_PAD = 14       // item inset from the coating edge
const GROUP_GAP = 16       // gap between items
const GROUP_HEADER = 30    // matches the -30 offset in GroupCard's placement math
const GROUP_CHROME = 54    // CardFrame header (~38px) + body padding (16px) above the group
const GROUP_CHROME_W = 24  // CardFrame body horizontal padding (12px each side)
const GROUP_HDR_ROW = 32   // the group's own header row (expand / rename / actions)

// One algorithm for every path that organises a group (creation, the Tidy
// button, arrange modes). Exported so the layout math is probeable: a probe
// runs the REAL function and asserts every card lands inside the frame with
// zero overlaps, instead of trusting hand-computed constants.
export function layoutTidyGrid(
  cards: CanvasCard[],
  columns = 2,
  anchor?: { x: number; y: number }
) {
  const ordered = [...cards].sort((a, b) =>
    (a.position.y - b.position.y) || (a.position.x - b.position.x))

  let minX = Infinity, minY = Infinity
  for (const c of cards) {
    minX = Math.min(minX, c.position.x)
    minY = Math.min(minY, c.position.y)
  }

  // Keep the -10/-30 convention shared with GroupCard's placement math
  // (rendered offset = card.pos - group.pos - (10, 30)).
  const baseX = anchor ? anchor.x : minX - 10
  const baseY = anchor ? anchor.y : minY - 30

  const cols = Math.max(1, Math.min(columns, ordered.length))
  const colW = Math.max(...ordered.map(c => c.size.w * GROUP_CELL))
  const colY = new Array<number>(cols).fill(0)
  const positions: Record<string, { x: number; y: number }> = {}

  for (const c of ordered) {
    let col = 0
    for (let i = 1; i < cols; i++) if (colY[i] < colY[col]) col = i
    positions[c.id] = {
      x: baseX + 10 + GROUP_PAD + col * (colW + GROUP_GAP),
      y: baseY + GROUP_HEADER + GROUP_PAD + colY[col],
    }
    colY[col] += c.size.h * GROUP_CELL + GROUP_GAP
  }

  return {
    positions,
    position: { x: baseX, y: baseY },
    size: groupFrameFor(ordered, positions, { x: baseX, y: baseY }),
  }
}

// Exact-fit frame for a group from where its members ACTUALLY sit. Shares the
// placement convention with layoutTidyGrid (rendered = pos - base - (10, 30)),
// so a hand-arranged layout sizes exactly like a tidied one and the frame
// grows/shrinks as members are dragged. Exported for the layout probe.
export function groupFrameFor(
  members: Array<{ id: string; position: { x: number; y: number }; size: { w: number; h: number } }>,
  positions: Record<string, { x: number; y: number }>,
  base: { x: number; y: number },
): { w: number; h: number } {
  let rightMax = 0
  let bottomMax = 0
  for (const c of members) {
    const p = positions[c.id] ?? c.position
    rightMax = Math.max(rightMax, p.x - base.x - 10 + c.size.w * GROUP_CELL)
    bottomMax = Math.max(bottomMax, p.y - base.y - 30 + c.size.h * GROUP_CELL)
  }
  return {
    w: Math.max(10, Math.ceil((GROUP_CHROME_W + GROUP_PAD + rightMax) / GROUP_CELL)),
    h: Math.max(6, Math.ceil((GROUP_CHROME + GROUP_HDR_ROW + GROUP_PAD + bottomMax) / GROUP_CELL)),
  }
}

function seedCardsFromSetup(dispatch: (action: CanvasAction) => void, config: DefaultSetupConfig) {
  for (const c of config.cards) {
    if (!c.enabled) continue
    const card: CanvasCard = {
      id: generateUUID(),
      type: c.type,
      position: c.position,
      size: c.size,
      zIndex: 0,
      pinned: c.pinned,
      data: c.defaultData || {},
      source: 'system',
      status: 'live',
      createdAt: Date.now(),
    }
    dispatch({ type: 'ADD_CARD', card })
  }
}

export function useCanvasState() {
  const loadedFromStorage = useRef(false)
  const [state, rawDispatch] = useReducer(canvasReducer, null, () => {
    const loaded = loadCanvasLayout()
    if (loaded) loadedFromStorage.current = true
    return loaded || DEFAULT_STATE
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [canvasList, setCanvasList] = useState<CanvasSnapshot[]>(listCanvases())
  const [canvasEpoch, setCanvasEpoch] = useState(0)

  // ── Undo / Redo History ──
  const pastRef = useRef<CanvasState[]>([])
  const futureRef = useRef<CanvasState[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)

  const dispatch = useCallback((action: CanvasAction) => {
    // Push current state to history before applying mutation actions
    if (HISTORY_ACTIONS.has(action.type)) {
      // Deep-clone minimal state (cards + groups only — pan/zoom don't need undo)
      const snapshot: CanvasState = {
        ...stateRef.current,
        cards: { ...stateRef.current.cards },
        groups: { ...stateRef.current.groups },
      }
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot]
      futureRef.current = [] // clear redo stack on new action
    }
    rawDispatch(action)
  }, [])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    // Save current to future
    const current: CanvasState = {
      ...stateRef.current,
      cards: { ...stateRef.current.cards },
      groups: { ...stateRef.current.groups },
    }
    futureRef.current = [...futureRef.current, current]
    // Restore previous state
    rawDispatch({ type: 'HYDRATE', state: prev })
    setHistoryVersion(v => v + 1)
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    // Save current to past
    const current: CanvasState = {
      ...stateRef.current,
      cards: { ...stateRef.current.cards },
      groups: { ...stateRef.current.groups },
    }
    pastRef.current = [...pastRef.current, current]
    // Restore next state
    rawDispatch({ type: 'HYDRATE', state: next })
    setHistoryVersion(v => v + 1)
  }, [])

  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Save on every state change — synchronous, no debounce, no timer to cancel
  useEffect(() => {
    setSaveStatus('saving')
    try {
      saveCanvasLayout(state)
      setSaveStatus('saved')
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current)
      saveResetTimer.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }, [state.cards, state.groups, state.pan, state.zoom])

  // Force-save on unmount (React navigation away) — saves synchronously
  useEffect(() => {
    return () => {
      try {
        saveCanvasLayout(stateRef.current)
      } catch { /* ignore */ }
    }
  }, [])

  // Force-save on app close (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        saveCanvasLayout(stateRef.current)
      } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    return () => {
      dismissTimers.current.forEach(t => clearTimeout(t))
      dismissTimers.current.clear()
    }
  }, [])

  const addCard = useCallback((
    type: CardType,
    data: Record<string, any>,
    opts?: { position?: { x: number; y: number }; size?: { w: number; h: number }; pinned?: boolean; source?: CanvasCard['source'] }
  ) => {
    const id = generateUUID()
    const card: CanvasCard = {
      id, type,
      position: opts?.position ?? { x: 40, y: 40 },
      size: opts?.size ?? { w: 8, h: 5 },
      zIndex: 0, pinned: opts?.pinned ?? false,
      data, source: opts?.source ?? 'ai',
      status: 'live', createdAt: Date.now(),
    }
    dispatch({ type: 'ADD_CARD', card })
    if (!card.pinned) {
      const timer = setTimeout(() => {
        dispatch({ type: 'DISMISS_CARD', id })
        dismissTimers.current.delete(id)
      }, DISMISS_TIMEOUT_MS)
      dismissTimers.current.set(id, timer)
    }
    return id
  }, [])

  const updateCard = useCallback((id: string, patch: Partial<CanvasCard>) => {
    dispatch({ type: 'UPDATE_CARD', id, patch })
  }, [])

  const removeCard = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id)
    if (timer) { clearTimeout(timer); dismissTimers.current.delete(id) }
    dispatch({ type: 'REMOVE_CARD', id })
  }, [])

  const moveCard = useCallback((id: string, position: { x: number; y: number }) => {
    dispatch({ type: 'MOVE_CARD', id, position })
  }, [])

  const resizeCard = useCallback((id: string, size: { w: number; h: number }) => {
    dispatch({ type: 'RESIZE_CARD', id, size })
  }, [])

  const pinCard = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id)
    if (timer) { clearTimeout(timer); dismissTimers.current.delete(id) }
    dispatch({ type: 'PIN_CARD', id })
  }, [])

  const dismissCard = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id)
    if (timer) { clearTimeout(timer); dismissTimers.current.delete(id) }
    dispatch({ type: 'DISMISS_CARD', id })
  }, [])

  const setStatus = useCallback((id: string, status: CardStatus) => {
    dispatch({ type: 'SET_STATUS', id, status })
  }, [])

  const resetLayout = useCallback(() => {
    dismissTimers.current.forEach(t => clearTimeout(t))
    dismissTimers.current.clear()
    dispatch({ type: 'RESET_LAYOUT' })
  }, [])

  const arrangeCards = useCallback((positions: Record<string, { x: number; y: number }>) => {
    for (const [id, pos] of Object.entries(positions)) {
      dispatch({ type: 'MOVE_CARD', id, position: pos })
    }
  }, [])

  const setPanZoom = useCallback((pan: { x: number; y: number }, zoom: number) => {
    dispatch({ type: 'SET_PAN_ZOOM', pan, zoom })
  }, [])

  // Group operations
  const createGroup = useCallback((label: string, cardIds: string[], colorId: GroupColorId = 'violet') => {
    const cards = cardIds.map(id => state.cards[id]).filter(Boolean)
    if (cards.length === 0) return null

    const groupId = generateUUID()
    const groupCardId = generateUUID()

    // Tidy on creation: grouping must ORGANISE the members, not just wrap a
    // union-box around wherever they happened to sit. (The old bounding-box
    // math kept the raw scattered positions, which is why a group of cards
    // from opposite corners rendered as one huge frame with cards floating
    // in it — the "mess" CZ reported.)
    const layout = layoutTidyGrid(cards)

    const group: CanvasGroup = {
      id: groupId,
      label,
      colorId,
      cardIds,
      position: layout.position,
      size: layout.size,
      createdAt: Date.now(),
    }

    const groupCard: CanvasCard = {
      id: groupCardId,
      type: 'group',
      position: { ...layout.position },
      size: layout.size,
      zIndex: 0,
      pinned: true,
      data: {
        groupId,
        arrange: 'grid',
        childCards: cards.map(c => ({
          id: c.id, type: c.type, data: c.data, source: c.source,
          position: layout.positions[c.id] || c.position,
          size: c.size, pinned: c.pinned, status: c.status, createdAt: c.createdAt,
        })),
      },
      source: 'user',
      status: 'live',
      createdAt: Date.now(),
    }

    dispatch({ type: 'CREATE_GROUP', group, cardIds, groupCard })
    // Move the LIVE member cards onto the tidy grid as well — React batches
    // both dispatches into one commit (so one undo entry), and removing a
    // card from the group later returns it to its tidy slot instead of a
    // random corner of the board.
    dispatch({ type: 'ARRANGE_GROUP', id: groupId, positions: layout.positions, size: layout.size })
    return groupId
  }, [state.cards])

  const updateGroup = useCallback((id: string, patch: Partial<Pick<CanvasGroup, 'label' | 'colorId'>>) => {
    dispatch({ type: 'UPDATE_GROUP', id, patch })
  }, [])

  const ungroup = useCallback((id: string, mode: 'restore' | 'scatter' = 'restore') => {
    dispatch({ type: 'UNGROUP', id, mode })
  }, [])

  const deleteGroup = useCallback((id: string) => {
    dispatch({ type: 'DELETE_GROUP', id })
  }, [])

  const addToGroup = useCallback((cardId: string, groupId: string) => {
    dispatch({ type: 'ADD_TO_GROUP', cardId, groupId })
  }, [])

  const removeFromGroup = useCallback((cardId: string, newPosition?: { x: number; y: number }) => {
    dispatch({ type: 'REMOVE_FROM_GROUP', cardId, newPosition })
  }, [])

  const syncAutomations = useCallback((automations: any[]) => {
    const currentCards = Object.values(stateRef.current.cards) as CanvasCard[]
    const usedPositions = new Set(currentCards.map((c) => `${Math.round(c.position.x / 40)},${Math.round(c.position.y / 40)}`))
    dispatch({ type: 'SYNC_AUTOMATIONS', automations, usedPositions })
  }, [])

  const arrangeGroup = useCallback((groupId: string, mode: 'grid' | 'stack' | 'mosaic' | 'custom', customPositions?: Record<string, { x: number; y: number }>) => {
    const group = state.groups[groupId]
    if (!group) return

    const groupCards = group.cardIds.map(id => state.cards[id]).filter(Boolean)
    if (groupCards.length === 0) return

    if (mode === 'custom' && customPositions) {
      dispatch({ type: 'ARRANGE_GROUP', id: groupId, positions: customPositions, size: group.size })
      return
    }

    // Every tidy mode shares ONE algorithm; the mode only picks the column
    // count. Anchored at the group's current position so re-arranging snaps
    // the frame to the content without teleporting the group itself.
    const columns = mode === 'stack' ? 1 : mode === 'mosaic' ? 3 : 2
    const layout = layoutTidyGrid(groupCards, columns, group.position)
    dispatch({ type: 'ARRANGE_GROUP', id: groupId, positions: layout.positions, size: layout.size })
  }, [state.groups, state.cards])

  // Move ONE member inside a group (manual positioning). The frame is re-fitted
  // from the childCards SNAPSHOT — the positions GroupCard actually renders —
  // and dispatched through ARRANGE_GROUP so the live card, the snapshot and the
  // group/frame sizes all stay in lock-step.
  const moveGroupChild = useCallback((groupId: string, cardId: string, position: { x: number; y: number }) => {
    const group = state.groups[groupId]
    if (!group || !group.cardIds.includes(cardId)) return
    const visual = Object.values(state.cards).find(c => c.type === 'group' && c.data?.groupId === groupId)
    const snapshot: Array<{ id: string; position: { x: number; y: number }; size: { w: number; h: number } }> =
      (visual?.data?.childCards || []).map((c: any) => ({
        id: c.id,
        position: c.position || { x: 0, y: 0 },
        size: c.size || { w: 4, h: 4 },
      }))
    const members = snapshot.length
      ? snapshot
      : group.cardIds.map(id => state.cards[id]).filter(Boolean).map(c => ({ id: c.id, position: c.position, size: c.size }))
    if (members.length === 0) return
    const positions: Record<string, { x: number; y: number }> = {}
    for (const m of members) positions[m.id] = m.id === cardId ? position : m.position
    const size = groupFrameFor(members, positions, group.position)
    dispatch({ type: 'ARRANGE_GROUP', id: groupId, positions: { [cardId]: position }, size })
  }, [state.groups, state.cards])

  const cards = Object.values(state.cards).filter(c => !c.dismissedAt)
  const groups = state.groups

  const clearAll = useCallback(() => {
    dismissTimers.current.forEach(t => clearTimeout(t))
    dismissTimers.current.clear()
    // Reset the loaded flag so live-data attachment re-runs on this fresh canvas.
    loadedFromStorage.current = false
    // Create a new canvas: saves current state, returns fresh state
    const { newState } = createNewCanvas(stateRef.current)
    // Update stateRef immediately so beforeunload/unmount saves the new empty
    // state, not the old state (React batches the dispatch).
    stateRef.current = newState
    // Clear history stacks for the fresh canvas
    pastRef.current = []
    futureRef.current = []
    dispatch({ type: 'HYDRATE', state: newState })
    // Seed from the saved Default Canvas Setup
    const config = loadDefaultSetup() ?? { version: 1 as const, cards: BUILTIN_DEFAULT_SETUP, updatedAt: Date.now() }
    seedCardsFromSetup(dispatch, config)
    // Bump the epoch so AiPage's seeding/live-data effect re-runs for this
    // fresh canvas (wasLoaded is a ref — ref changes alone never re-trigger).
    setCanvasEpoch((e) => e + 1)
    setCanvasList(listCanvases())
  }, [dispatch])

  const forceSave = useCallback(() => {
    setSaveStatus('saving')
    try {
      saveCanvasLayout(state)
      setSaveStatus('saved')
      setCanvasList(listCanvases())
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current)
      saveResetTimer.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }, [state])

  // Canvas management
  const saveAs = useCallback((name: string) => {
    setSaveStatus('saving')
    try {
      saveCanvasLayout(state, name)
      setCanvasList(listCanvases())
      setSaveStatus('saved')
      if (saveResetTimer.current) clearTimeout(saveResetTimer.current)
      saveResetTimer.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    }
  }, [state])

  const loadCanvas = useCallback((id: string) => {
    const loaded = loadCanvasById(id)
    if (loaded) {
      dismissTimers.current.forEach(t => clearTimeout(t))
      dismissTimers.current.clear()
      dispatch({ type: 'HYDRATE', state: loaded })
      setCanvasList(listCanvases())
    }
  }, [])

  const rename = useCallback((id: string, newName: string) => {
    renameCanvas(id, newName)
    setCanvasList(listCanvases())
  }, [])

  const removeCanvas = useCallback((id: string) => {
    deleteCanvas(id)
    setCanvasList(listCanvases())
  }, [])

  const refreshList = useCallback(() => {
    setCanvasList(listCanvases())
  }, [])

  return {
    cards, allCards: state.cards, groups, nextZIndex: state.nextZIndex, saveStatus,
    wasLoaded: loadedFromStorage.current, canvasEpoch,
    addCard, updateCard, removeCard, moveCard, resizeCard, pinCard, dismissCard,
    setStatus, resetLayout, arrangeCards, clearAll, forceSave, setPanZoom,
    createGroup, updateGroup, ungroup, deleteGroup, addToGroup, removeFromGroup, arrangeGroup, moveGroupChild, syncAutomations,
    canvasList, saveAs, loadCanvas, rename, removeCanvas, refreshList,
    undo, redo, canUndo, canRedo,
  }
}

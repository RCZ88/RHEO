# RESULT.md — AI Canvas: Drag / Resize / Grouping Fix

**Date:** 2026-08-07
**Author:** Architect AI
**Scope:** `AiPage.tsx`, `CanvasContainer.tsx`, `CanvasGrid.tsx`, `CanvasCard.tsx`, `GroupCard.tsx`, `useCanvasState.ts`, `canvas.ts`, `canvas.css`

---

## 1. ROOT-CAUSE CONFIRMATION

| ID | Issue | Verified Root Cause (from Bundle) |
|---|---|---|
| **R1** | Automation cards cannot be dragged | `automationCanvasCards` in `AiPage.tsx` (lines 232-263) are a `useMemo` derived from the automations store and **are not persisted in the canvas state**. When dragged, `MOVE_CARD` reducer (canvas.ts:106-108) guards `if (!state.cards[action.id]) return state` and silently discards the move. The `useMemo` then recomputes their position based on grid layout, causing them to snap back. |
| **R2** | Drop-to-group fails for automation cards | `onGroupCards` in `AiPage.tsx` (line 1685) maps IDs through `canvas.allCards`, which lacks `auto-*` IDs. `groupedCards.length < 2` evaluates true and the grouping silently aborts. `createGroup` has the same store-lookup gap. |
| **R3** | Normal card drag "snap-back" / jump | `.dk-canvas-card` has `transition: all 0.2s`. During drag, `.dragging` sets `transition: none !important`. On `pointerup`, `.dragging` is removed, and React re-renders with the newly snapped `transform`. The CSS transition then animates the delta between the dragged DOM position and the snapped state, creating a visible "jump" or slide. |
| **R4** | Resize fails for automation cards | Same as R1: `RESIZE_CARD` reducer guards against missing IDs and silently no-ops for derived automation cards. |
| **R5** | Grouping changes how cards are displayed | `GroupCard.tsx` (line 179) renders only the raw inner content (`renderChild`) wrapped in a basic `.group-real-card` div. It omits the standard `.dk-canvas-card` frame (header, type label, dismiss button, glassmorphism background), violating the "SHOW THE CARD" hard requirement. |

---

## 2. CHOSEN ARCHITECTURE: OPTION A (First-Class Store Promotion)

To unify all card behaviors, **automation cards must be promoted to first-class citizens in `state.cards`**. Option B (position overrides) was rejected because `CanvasGrid` filters grouped cards via `card.groupId`. If automation cards remain outside the store, they cannot be tagged with `groupId`, meaning they would render **both** on the main canvas and inside the group, breaking the layout.

### State Shape & Serialization Strategy
*   **Store:** Automation cards live in `state.cards` with `type: 'automation'`. They track `position`, `size`, `zIndex`, and `groupId` normally.
*   **Closures:** The `data` object in the store contains **only static serializable data** (e.g., `data: { automation: { ruleId, name, enabled } }`). Closures like `onToggle`, `onDelete`, and `onTestRun` **cannot be serialized** to `localStorage`.
*   **Injection:** `AiPage.tsx` intercepts cards of `type: 'automation'` in a `useMemo` immediately before passing them to `CanvasContainer`. It looks up the live automation from the automation store and injects the fresh closures. This ensures closures always point to the current state, and reloading from `localStorage` seamlessly restores functionality.

### New Reducer Action
Add `SYNC_AUTOMATIONS` to `canvasReducer`:
```ts
| { type: 'SYNC_AUTOMATIONS'; automations: any[]; usedPositions: Set<string> }

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
```

---

## 3. FILE-BY-FILE CHANGE LIST

### `src/types/canvas.ts`
*   **Lines 61-85 (`CanvasAction`):** Add `SYNC_AUTOMATIONS` action definition.
*   **Lines 106-108 (`canvasReducer`):** Insert the `case 'SYNC_AUTOMATIONS'` block as defined above.

### `src/hooks/useCanvasState.ts`
*   **Lines 100+ (Hook API):** Add `syncAutomations` dispatcher. It must compute `usedPositions` from the current state (via `get()` or state ref) to avoid dependency loops in the UI.
    ```ts
    const syncAutomations = useCallback((automations: any[]) => {
      const currentCards = Object.values(get().cards) // Zustand get()
      const usedPositions = new Set(currentCards.map((c: any) => `${Math.round(c.position.x / 40)},${Math.round(c.position.y / 40)}`))
      dispatch({ type: 'SYNC_AUTOMATIONS', automations, usedPositions })
    }, [])
    ```
*   **Lines 143-192 (`createGroup`):** No logic change needed. It will now correctly find `auto-*` cards in `state.cards` and generate valid snapshots.

### `src/pages/AiPage.tsx`
*   **Lines 232-263:** **DELETE** the entire `automationCanvasCards` `useMemo`.
*   **Lines 178+:** Add closure injection and sync effect:
    ```tsx
    // 1. Sync automations into the canvas store
    useEffect(() => {
      canvas.syncAutomations(automationActions.automations)
    }, [automationActions.automations, canvas.syncAutomations])

    // 2. Inject live closures into automation cards before rendering
    const enrichedCards = useMemo(() => {
      return canvas.cards.map((c: any) => {
        if (c.type === 'automation' && c.data?.automation) {
          const auto = automationActions.automations.find((a: any) => a.ruleId === c.data.automation.ruleId)
          if (auto) {
            return {
              ...c,
              data: {
                ...c.data,
                automation: auto,
                onToggle: () => toggleAutomation(auto.ruleId, auto.enabled),
                onDelete: () => deleteAutomation(auto.ruleId, auto.name),
                onTestRun: () => testRun(auto.ruleId, auto.name),
              }
            }
          }
        }
        return c
      })
    }, [canvas.cards, automationActions.automations, toggleAutomation, deleteAutomation, testRun])
    ```
*   **Line 1663:** Pass `cards={[...enrichedCards]}` to `<CanvasContainer>` instead of the old array merge.
*   **Line 1685:** `onGroupCards` works without modification as `canvas.allCards` now contains automation cards.

### `src/components/ai/canvas/CanvasCard.tsx`
*   **Lines 243-268 (`handlePointerUp`):** Fix R3 (Snap-back) by committing the snapped DOM transform **before** React re-renders and removes the `.dragging` class.
    ```ts
    if (hasMovedRef.current) {
      // ... compute snappedX, snappedY
      // FIX R3: Commit to DOM immediately to prevent CSS transition animation
      if (cardRef.current) {
        cardRef.current.style.transform = `translate(${snappedX}px, ${snappedY}px)`
      }
      onDragEnd(card.id, { x: snappedX, y: snappedY })
      suppressClickRef.current = true
    }
    ```

### `src/components/ai/canvas/GroupCard.tsx`
*   **Lines 175-190 (Body Rendering):** Replace the raw `renderChild` wrapper with the full `.dk-canvas-card` frame to satisfy R5 ("SHOW THE CARD"). Disable internal pointer events to prevent breaking the group layout.
    ```tsx
    placed.map(({ card, left, top }) => (
      <div
        key={card.id}
        className="dk-canvas-card group-real-card"
        style={{
          left, top, width: card.size.w * CELL, height: card.size.h * CELL,
          transform: 'none', position: 'absolute', zIndex: 0, cursor: 'default'
        }}
        onPointerDown={(e) => e.stopPropagation()} // Prevent internal dragging
      >
        <div className="dk-canvas-card-header" style={{ cursor: 'default' }}>
          <span className="dk-canvas-card-type">{card.type}</span>
          <div className="dk-canvas-card-actions">
            <button className="dk-canvas-dismiss" onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(card.id) }} title="Remove from group">✕</button>
          </div>
        </div>
        <div className="dk-canvas-card-body">{renderChild(card)}</div>
      </div>
    ))
    ```

### `src/components/ai/canvas/canvas.css`
*   **Lines 1050-1060 (`.group-cards`):** Remove the dead `display: flex; flex-direction: column; max-height: 320px` rules. The inline styles in `GroupCard.tsx` override them, but cleaning the CSS prevents future regressions.
*   **Lines 1070-1080 (`.group-real-card`):** Strip the custom background/border rules. The element now inherits all visuals from `.dk-canvas-card`.

---

## 4. GROUPING SPECIFICATION

*   **Visual Fidelity:** Grouped cards render identically to standalone cards. They retain their exact `size.w * CELL` dimensions, glassmorphic backgrounds, and headers.
*   **Interaction Guard:** `onPointerDown={(e) => e.stopPropagation()}` is applied to the `.group-real-card` wrapper. This ensures that if a user clicks and drags *inside* the group, they do not accidentally trigger the card's native drag handlers (which would attempt to move the card on the main canvas grid while it is visually trapped inside the group DOM node).
*   **Bounds Tracking:** Handled natively by the existing `useMemo` in `GroupCard.tsx` (lines 29-44). It calculates `contentW` and `contentH` by finding the maximum `right` and `bottom` coordinates of all placed children. When a new card is added via `ADD_TO_GROUP`, the group body automatically expands to wrap it.
*   **Empty State:** Preserved. If `cards.length === 0`, it renders `.group-empty`.

---

## 5. MANUAL TEST SCRIPT (For CZ)

1.  **Automation Card Drag/Resize:**
    *   Open `/ai`. Create a new automation.
    *   Drag the automation card to a new location. Release. **Expected:** Card stays at the snapped grid position.
    *   Resize the automation card via the bottom-right handle. **Expected:** Card resizes and persists on reload.
2.  **Snap-Back Elimination (Normal Cards):**
    *   Drag a standard `focus` or `response` card quickly across the canvas.
    *   Release at low zoom (0.5x). **Expected:** Card snaps instantly to the grid. No visible "sliding" animation post-release.
3.  **Cross-Type Grouping:**
    *   Drag an automation card directly on top of a standard `digest` card.
    *   **Expected:** Both cards highlight as drop targets. On release, a group is created wrapping BOTH cards.
    *   **Visual Check:** Both cards inside the group must show their full headers, type labels, and glassmorphic backgrounds.
4.  **Group Persistence & Ungrouping:**
    *   Reload the app. **Expected:** The group persists. Automation cards inside the group still have functional "Toggle/Test" buttons (closures successfully re-injected).
    *   Click the "Ungroup" button on the group header. Select "Scatter". **Expected:** All cards, including automations, return to the main canvas grid at scattered positions.
5.  **Zoom/Pan Integrity:**
    *   Zoom to 3.0x, drag a card, drop. Zoom to 0.15x, drag a card, drop. **Expected:** Math holds, drop targets highlight correctly, no camera auto-panning occurs during the drop.

---

## 6. RISKS & GUARD CODE

| Risk | Guard Code |
|---|---|
| **Closure Serialization Failure** | `AiPage.tsx` `enrichedCards` memo strictly injects closures *after* hydration from `localStorage`. The store only holds `ruleId`. |
| **Internal Group Drag Desync** | `GroupCard.tsx` applies `onPointerDown={(e) => e.stopPropagation()}` to the `.group-real-card` frame, preventing internal cards from triggering the main canvas drag logic. |
| **CSS Transition Snap-Bac** | `CanvasCard.tsx` explicitly sets `cardRef.current.style.transform` to the snapped coordinates synchronously in `handlePointerUp` before the `.dragging` class is removed, nullifying the CSS delta. |
| **Auto-Focus Camera Shift** | The `draggingRef` guard in `CanvasContainer.tsx` (line 195) remains intact. Mid-drag re-renders will not trigger auto-pan. `suppressClickRef` prevents the post-drag click from selecting the card. |
| **Infinite Sync Loops** | `syncAutomations` in `useCanvasState.ts` reads state via `get()` internally, removing the need for `canvas.cards` in the `useEffect` dependency array in `AiPage.tsx`. |

---

## 7. OPEN QUESTIONS

None. The architecture fully resolves the serialization, store-sync, and visual rendering constraints without violating any invariants. Proceed with implementation.
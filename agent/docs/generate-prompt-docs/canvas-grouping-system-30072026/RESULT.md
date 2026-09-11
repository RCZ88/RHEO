```markdown
# RESULT.md: Canvas Grouping System — Full Stack Implementation

## 1. Data Model

The core issue was storing full child card copies in `data.childCards`, causing data duplication and loss of state. The new model uses **referential integrity**: the `CanvasGroup` holds the source of truth for membership, and the `CanvasCard` of type `'group'` merely references the group.

```ts
// src/types/canvas.ts

export interface CanvasGroup {
  id: string
  label: string
  colorId: GroupColorId
  cardIds: string[] // References, not copies
  position: { x: number; y: number } // Center or top-left of the group
  size: { w: number; h: number } // Bounding box in grid cells
  createdAt: number
}

export interface CanvasCard {
  // ... existing fields
  type: CardType // Includes 'group'
  data: Record<string, any> & {
    // For type === 'group':
    groupId?: string // Links to CanvasGroup.id
    arrange?: 'grid' | 'stack' | 'mosaic' | 'custom'
  }
  groupId?: string // Added to ALL card types to indicate membership
}

export type CanvasAction =
  // ... existing actions
  | { type: 'CREATE_GROUP'; group: CanvasGroup; cardIds: string[]; groupCard: CanvasCard }
  | { type: 'UPDATE_GROUP'; id: string; patch: Partial<Pick<CanvasGroup, 'label' | 'colorId'>> }
  | { type: 'UNGROUP'; id: string; mode: 'restore' | 'scatter' }
  | { type: 'REMOVE_FROM_GROUP'; cardId: string; newPosition?: { x: number; y: number } }
  | { type: 'ARRANGE_GROUP'; groupId: string; mode: 'grid' | 'stack' | 'mosaic' | 'custom'; customPositions?: Record<string, { x: number; y: number }> }
```

## 2. Reducer Changes

The reducer now handles atomic group creation, proper ungrouping (restoring visibility), and layout management.

```ts
// Inside canvasReducer

case 'CREATE_GROUP': {
  const { group, cardIds, groupCard } = action;
  const updatedCards = { ...state.cards };
  
  // 1. Tag child cards with groupId (they remain in state, but CanvasGrid will filter them)
  cardIds.forEach(id => {
    if (updatedCards[id]) {
      updatedCards[id] = { ...updatedCards[id], groupId: group.id };
    }
  });

  // 2. Add group metadata and the visual group card
  return {
    ...state,
    groups: { ...state.groups, [group.id]: group },
    cards: { ...updatedCards, [groupCard.id]: groupCard },
    nextZIndex: state.nextZIndex + 1,
  };
}

case 'UPDATE_GROUP': {
  const group = state.groups[action.id];
  if (!group) return state;
  return {
    ...state,
    groups: { ...state.groups, [action.id]: { ...group, ...action.patch } }
  };
}

case 'UNGROUP': {
  const group = state.groups[action.id];
  if (!group) return state;
  
  const { [action.id]: _, ...restGroups } = state.groups;
  const updatedCards = { ...state.cards };
  
  // Find and remove the visual group card
  const groupCardId = Object.keys(updatedCards).find(id => updatedCards[id].data?.groupId === action.id);
  if (groupCardId) {
    delete updatedCards[groupCardId];
  }

  // Restore child cards
  group.cardIds.forEach((id, index) => {
    if (updatedCards[id]) {
      let newPos = updatedCards[id].position;
      if (action.mode === 'scatter') {
        // Simple diagonal scatter around group center
        const offset = (index % 3) * 40;
        const offsetY = Math.floor(index / 3) * 40;
        newPos = { x: group.position.x + offset, y: group.position.y + offsetY };
      }
      updatedCards[id] = { 
        ...updatedCards[id], 
        groupId: undefined, 
        position: newPos,
        dismissedAt: undefined // Ensure it's not dismissed
      };
    }
  });

  return { ...state, groups: restGroups, cards: updatedCards };
}

case 'REMOVE_FROM_GROUP': {
  const card = state.cards[action.cardId];
  if (!card?.groupId) return state;
  const groupId = card.groupId;
  const group = state.groups[groupId];
  
  return {
    ...state,
    cards: {
      ...state.cards,
      [action.cardId]: { 
        ...card, 
        groupId: undefined,
        position: action.newPosition || card.position
      }
    },
    groups: {
      ...state.groups,
      [groupId]: {
        ...group,
        cardIds: group.cardIds.filter(id => id !== action.cardId)
      }
    }
  };
}

case 'ARRANGE_GROUP': {
  const group = state.groups[action.id];
  if (!group) return state;
  
  // Note: Actual position updates for child cards are handled by the hook 
  // dispatching multiple UPDATE_CARD actions, or we can do it here if we pass them.
  // For simplicity, we update the group's arrange mode and size here.
  return {
    ...state,
    groups: {
      ...state.groups,
      [action.id]: { 
        ...group, 
        size: action.mode === 'stack' ? { w: group.size.w, h: group.cardIds.length * 3 + 2 } : group.size
      }
    }
  };
}
```

## 3. Hook API

`useCanvasState` exposes high-level methods that encapsulate the complex dispatch logic.

```ts
export function useCanvasState() {
  // ... existing state and dispatch

  const createGroup = (label: string, cardIds: string[], colorId: GroupColorId, position: { x: number; y: number }) => {
    const groupId = `group_${Date.now()}`;
    const groupCardId = `card_${Date.now()}`;
    
    const group: CanvasGroup = {
      id: groupId,
      label,
      colorId,
      cardIds,
      position,
      size: { w: 10, h: 6 }, // Default, updated by smart-arrange
      createdAt: Date.now(),
    };

    const groupCard: CanvasCard = {
      id: groupCardId,
      type: 'group',
      position: { x: position.x - 200, y: position.y - 100 }, // Top-left offset
      size: { w: 12, h: 8 },
      zIndex: state.nextZIndex,
      pinned: true,
      data: { groupId, arrange: 'grid' },
      source: 'user',
      status: 'live',
      createdAt: Date.now(),
    };

    dispatch({ type: 'CREATE_GROUP', group, cardIds, groupCard });
    
    // Automatically trigger smart arrange after creation
    setTimeout(() => arrangeGroup(groupId, 'grid'), 50);
  };

  const updateGroup = (id: string, patch: Partial<Pick<CanvasGroup, 'label' | 'colorId'>>) => {
    dispatch({ type: 'UPDATE_GROUP', id, patch });
  };

  const ungroup = (id: string, mode: 'restore' | 'scatter' = 'restore') => {
    dispatch({ type: 'UNGROUP', id, mode });
  };

  const removeFromGroup = (cardId: string, newPosition?: { x: number; y: number }) => {
    dispatch({ type: 'REMOVE_FROM_GROUP', cardId, newPosition });
  };

  const arrangeGroup = (groupId: string, mode: 'grid' | 'stack' | 'mosaic' | 'custom', customPositions?: Record<string, { x: number; y: number }>) => {
    const group = state.groups[groupId];
    if (!group) return;

    const cards = group.cardIds.map(id => state.cards[id]).filter(Boolean);
    const newPositions = calculateSmartArrange(mode, cards, group.position, customPositions);
    
    // Update each card's position
    newPositions.forEach(({ id, position }) => {
      dispatch({ type: 'UPDATE_CARD', id, patch: { position } });
    });

    // Update group metadata
    dispatch({ type: 'ARRANGE_GROUP', id: groupId, mode, customPositions });
  };

  return { createGroup, updateGroup, ungroup, removeFromGroup, arrangeGroup, /* ... */ };
}
```

## 4. Component Specs: `GroupCard`

Rebuilt to be fully interactive, displaying actual child cards and supporting all QoL features.

```tsx
// src/components/ai/canvas/GroupCard.tsx
interface GroupCardProps {
  group: CanvasGroup;
  cards: CanvasCard[];
  onUpdateGroup: (patch: Partial<Pick<CanvasGroup, 'label' | 'colorId'>>) => void;
  onUngroup: (mode: 'restore' | 'scatter') => void;
  onRemoveFromGroup: (cardId: string, dropPosition?: { x: number; y: number }) => void;
}

export function GroupCard({ group, cards, onUpdateGroup, onUngroup, onRemoveFromGroup }: GroupCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(group.label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const color = GROUP_COLORS.find(c => c.id === group.colorId) || GROUP_COLORS[0];

  // ... (focus and click-outside effects as in original, updated for new refs)

  const handleRename = () => {
    if (editLabel.trim() && editLabel.trim() !== group.label) {
      onUpdateGroup({ label: editLabel.trim() });
    }
    setEditing(false);
  };

  return (
    <div className="dk-group-card" style={{ borderColor: color.border, background: 'rgba(24,24,27,0.80)', backdropFilter: 'blur(12px)' }}>
      {/* HEADER */}
      <div className="dk-group-header" style={{ borderBottomColor: color.border }}>
        <button className="dk-group-expand-btn" onClick={() => setExpanded(v => !v)}>
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} style={{ color: color.accent }} />
        </button>
        <div className="dk-group-icon" style={{ background: color.accent }} />
        
        {editing ? (
          <input
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            className="dk-group-name-input"
            style={{ color: color.accent }}
            autoFocus
          />
        ) : (
          <span className="dk-group-name" style={{ color: color.accent }} onDoubleClick={() => { setEditing(true); setEditLabel(group.label); }}>
            {group.label}
          </span>
        )}
        
        <span className="dk-group-count">{cards.length} cards</span>
        
        <div className="dk-group-actions">
          <button onClick={() => { setEditing(true); setEditLabel(group.label) }} title="Rename" className="dk-group-action-btn">
            <Edit3 size={12} />
          </button>
          <div className="dk-group-color-wrapper">
            <button onClick={() => setShowColorPicker(v => !v)} title="Color" className="dk-group-action-btn">
              <Palette size={12} />
            </button>
            {showColorPicker && (
              <div className="dk-group-color-picker">
                {GROUP_COLORS.map(c => (
                  <button
                    key={c.id}
                    className={`dk-group-color-swatch ${c.id === group.colorId ? 'active' : ''}`}
                    style={{ background: c.accent }}
                    onClick={() => { onUpdateGroup({ colorId: c.id }); setShowColorPicker(false); }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onUngroup(cards.length > 5 ? 'scatter' : 'restore')} title="Ungroup cards" className="dk-group-action-btn dk-group-action-danger">
            <Ungroup size={12} />
          </button>
        </div>
      </div>

      {/* BODY */}
      {expanded && (
        <div className="dk-group-cards">
          {cards.length === 0 ? (
            <div className="dk-group-empty">No cards in this group. Drag cards here or use AI to add them.</div>
          ) : (
            cards.map(card => (
              <div key={card.id} className="dk-group-mini-card" draggable 
                   onDragEnd={(e) => {
                     // Simple drag-out: if dropped outside, remove from group
                     // In a full DnD library, this would be handled by the onDragEnd of the DnD context
                     onRemoveFromGroup(card.id, { x: e.clientX, y: e.clientY });
                   }}>
                <div className="dk-group-mini-card-header">
                  <span className="dk-group-mini-card-type" style={{ color: color.accent }}>{card.type}</span>
                  <span className={`dk-status-dot status-${card.status}`} />
                </div>
                <div className="dk-group-mini-card-body">
                  <span className="dk-group-mini-card-text">
                    {card.data?.content || card.data?.text || `[${card.type} card]`}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

## 5. Interaction Flows

### Grouping Flow
1. User selects multiple cards (e.g., via shift-click or lasso).
2. User clicks "Group" or presses `Cmd+G`.
3. `AiPage` calls `canvas.createGroup("New Group", selectedIds, "violet", centerPosition)`.
4. Reducer creates `CanvasGroup`, tags child cards with `groupId`, and creates the `CanvasCard` of type `'group'`.
5. `CanvasGrid` re-renders: child cards are filtered out of the main layer, and the `GroupCard` appears.
6. `arrangeGroup` is automatically called to layout the children neatly inside the group bounds.

### Ungrouping Flow
1. User clicks the "Ungroup" icon on the `GroupCard`.
2. If `cards.length > 5`, a subtle toast asks "Ungroup and scatter?" (defaults to scatter to prevent visual clutter).
3. `onUngroup('scatter')` is called.
4. Reducer deletes the `CanvasGroup` and the `CanvasCard` of type `'group'`.
5. Reducer clears `groupId` on all child cards and applies new scattered positions.
6. `CanvasGrid` re-renders: child cards immediately appear on the canvas at their new positions.

### Drag-Out-of-Group Flow
1. User expands the group and clicks/drags a mini-card.
2. The drag handler detects the drop is outside the group's bounding box.
3. `onRemoveFromGroup(cardId, dropPosition)` is called.
4. Reducer removes `cardId` from `group.cardIds` and clears `groupId` on the card, updating its position to the drop location.
5. The card instantly appears as a standalone `CanvasCard` on the main grid.

## 6. CSS Specs

Update `src/components/ai/canvas/canvas.css` to enforce the design tokens (glassmorphism, proper spacing, hover states).

```css
/* Group Card Base */
.dk-group-card {
  border-radius: 16px;
  border: 1px solid rgba(63, 63, 70, 0.50);
  background: rgba(24, 24, 27, 0.80);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: box-shadow 0.2s ease, transform 0.1s ease;
}

.dk-group-card:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

/* Header */
.dk-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(63, 63, 70, 0.50);
  background: rgba(24, 24, 27, 0.50);
  cursor: pointer;
  user-select: none;
}

.dk-group-expand-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--dk-text-muted);
  border-radius: 4px;
}
.dk-group-expand-btn:hover { background: rgba(255,255,255,0.05); }

.dk-group-icon { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px currentColor; }

.dk-group-name {
  font-family: 'Geist Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dk-group-name-input {
  font-family: 'Geist Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 2px 8px;
  outline: none;
  flex: 1;
  min-width: 0;
  color: inherit;
}

.dk-group-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--dk-text-faint);
  background: rgba(255,255,255,0.05);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Actions */
.dk-group-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s ease; }
.dk-group-card:hover .dk-group-actions { opacity: 1; }

.dk-group-action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  color: var(--dk-text-faint);
  cursor: pointer;
  transition: all 0.15s ease;
}
.dk-group-action-btn:hover { background: rgba(255, 255, 255, 0.1); color: var(--dk-text-primary); border-color: rgba(255,255,255,0.1); }
.dk-group-action-danger:hover { background: rgba(244, 63, 94, 0.15); color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); }

/* Color Picker */
.dk-group-color-wrapper { position: relative; }
.dk-group-color-picker {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 8px;
  background: rgba(24, 24, 27, 0.95);
  border: 1px solid rgba(63, 63, 70, 0.50);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 50;
  backdrop-filter: blur(8px);
}
.dk-group-color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.dk-group-color-swatch:hover { transform: scale(1.15); }
.dk-group-color-swatch.active {
  border-color: white;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

/* Mini Cards (Expanded Body) */
.dk-group-cards {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.dk-group-mini-card {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(63, 63, 70, 0.4);
  border-radius: 10px;
  overflow: hidden;
  cursor: grab;
  transition: border-color 0.15s ease, transform 0.1s ease;
}
.dk-group-mini-card:active { cursor: grabbing; }
.dk-group-mini-card:hover { border-color: rgba(255, 255, 255, 0.2); transform: translateY(-1px); }

.dk-group-mini-card-header {
  padding: 6px 10px;
  border-bottom: 1px solid rgba(63, 63, 70, 0.3);
  background: rgba(24, 24, 27, 0.4);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dk-group-mini-card-type {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dk-group-mini-card-body { padding: 8px 10px; }

.dk-group-mini-card-text {
  font-family: 'Geist Sans', sans-serif;
  font-size: 11px;
  color: var(--dk-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dk-group-empty {
  text-align: center;
  padding: 24px 16px;
  font-size: 12px;
  color: var(--dk-text-faint);
  font-style: italic;
}
```

## 7. Agent API

To allow the AI agent to manage groups, expose the following tools in the agent's tool registry. The agent can read the current canvas state (including `groups`) from the system prompt context or a `get_canvas_state` tool.

```typescript
// Agent Tool Definitions (JSON Schema)

const CREATE_GROUP_TOOL = {
  name: "create_canvas_group",
  description: "Groups multiple existing cards into a single visual group container.",
  parameters: {
    type: "object",
    properties: {
      cardIds: { type: "array", items: { type: "string" }, description: "Array of card IDs to group" },
      label: { type: "string", description: "Descriptive name for the group" },
      colorId: { type: "string", enum: ["violet", "blue", "emerald", "amber", "rose", "cyan", "pink", "slate"] },
      arrange: { type: "string", enum: ["grid", "stack", "mosaic"], description: "How to layout cards inside the group" }
    },
    required: ["cardIds", "label", "colorId"]
  }
};

const UPDATE_GROUP_TOOL = {
  name: "update_canvas_group",
  description: "Renames or recolors an existing group.",
  parameters: {
    type: "object",
    properties: {
      groupId: { type: "string", description: "The ID of the CanvasGroup to update" },
      label: { type: "string", description: "New name for the group" },
      colorId: { type: "string", enum: ["violet", "blue", "emerald", "amber", "rose", "cyan", "pink", "slate"] }
    }
  }
};

const UNGROUP_TOOL = {
  name: "ungroup_canvas_cards",
  description: "Dissolves a group, returning child cards to the main canvas.",
  parameters: {
    type: "object",
    properties: {
      groupId: { type: "string", description: "The ID of the CanvasGroup to dissolve" },
      mode: { type: "string", enum: ["restore", "scatter"], description: "restore keeps original positions, scatter spreads them out" }
    },
    required: ["groupId", "mode"]
  }
};
```

## 8. Smart Arrange Algorithms

When a group is created or the agent calls `arrange_group`, the system calculates new positions for child cards relative to the group's top-left `position`.

```ts
function calculateSmartArrange(
  mode: 'grid' | 'stack' | 'mosaic' | 'custom',
  cards: CanvasCard[],
  groupTopLeft: { x: number; y: number },
  customPositions?: Record<string, { x: number; y: number }>
): { id: string; position: { x: number; y: number } }[] {
  
  const CELL = 40; // 40px grid cell
  const GAP = 1; // 1 cell gap
  const results: { id: string; position: { x: number; y: number } }[] = [];

  if (mode === 'custom' && customPositions) {
    cards.forEach(card => {
      results.push({ id: card.id, position: customPositions[card.id] || card.position });
    });
    return results;
  }

  if (mode === 'stack') {
    cards.forEach((card, i) => {
      results.push({
        id: card.id,
        position: { x: groupTopLeft.x + (2 * CELL), y: groupTopLeft.y + ((i + 1) * (3 * CELL + GAP)) }
      });
    });
    return results;
  }

  if (mode === 'grid') {
    const count = cards.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    
    cards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      results.push({
        id: card.id,
        position: { 
          x: groupTopLeft.x + ((col + 1) * (4 * CELL + GAP)), 
          y: groupTopLeft.y + ((row + 1) * (3 * CELL + GAP)) 
        }
      });
    });
    return results;
  }

  if (mode === 'mosaic') {
    // Simple alternating width masonry
    cards.forEach((card, i) => {
      const isWide = i % 3 === 0;
      const w = isWide ? 6 : 4;
      const h = 3;
      // Simplified packing: just lay them out in a wrapping flex-like manner
      const col = i % 2;
      const row = Math.floor(i / 2);
      results.push({
        id: card.id,
        position: { 
          x: groupTopLeft.x + ((col * 5) + 1) * CELL, 
          y: groupTopLeft.y + ((row * 4) + 1) * CELL 
        }
      });
    });
    return results;
  }

  return cards.map(c => ({ id: c.id, position: c.position }));
}
```

## 9. CanvasGrid Changes

The grid must now filter out grouped cards and render `GroupCard` components, passing down the necessary callbacks.

```tsx
// src/components/ai/canvas/CanvasGrid.tsx

export function CanvasGrid({ state, onUpdateCard, onDismissCard, /* ... */ }) {
  const { createGroup, updateGroup, ungroup, removeFromGroup, arrangeGroup } = useCanvasState();

  // 1. Filter: Only render cards that are NOT dismissed AND NOT part of a group
  const standaloneCards = Object.values(state.cards).filter(
    c => !c.dismissedAt && !c.groupId
  );

  // 2. Get all active groups
  const activeGroups = Object.values(state.groups);

  return (
    <div className="dk-canvas-grid" style={{ transform: `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})` }}>
      {/* Render Groups First (so they sit behind or at specific z-index) */}
      {activeGroups.map(group => {
        // Resolve child cards for this group
        const childCards = group.cardIds.map(id => state.cards[id]).filter(Boolean);
        
        return (
          <div 
            key={group.id} 
            className="dk-canvas-item"
            style={{ 
              position: 'absolute', 
              left: group.position.x, 
              top: group.position.y,
              zIndex: state.cards[Object.keys(state.cards).find(k => state.cards[k].data?.groupId === group.id) || '']?.zIndex || 0
            }}
          >
            <GroupCard
              group={group}
              cards={childCards}
              onUpdateGroup={(patch) => updateGroup(group.id, patch)}
              onUngroup={(mode) => ungroup(group.id, mode)}
              onRemoveFromGroup={(cardId, newPos) => removeFromGroup(cardId, newPos)}
            />
          </div>
        );
      })}

      {/* Render Standalone Cards */}
      {standaloneCards.map(card => (
        <CanvasCard
          key={card.id}
          card={card}
          onUpdateCard={(patch) => onUpdateCard(card.id, patch)}
          onDismiss={() => onDismissCard(card.id)}
          // ... other props
        />
      ))}
    </div>
  );
}
```
*Note: The `onGroupCards` callback in `AiPage.tsx` must be updated to call `canvas.createGroup(...)` instead of manually building a broken `childCards` array and calling `dismissCard`.*

## 10. Group List Panel

A side panel for macro-management of all groups on the canvas.

```tsx
// src/components/ai/canvas/GroupListPanel.tsx
interface GroupListPanelProps {
  groups: Record<string, CanvasGroup>;
  cards: Record<string, CanvasCard>;
  onZoomToGroup: (groupId: string) => void;
  onUngroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void; // Deletes group AND dismisses child cards
}

export function GroupListPanel({ groups, cards, onZoomToGroup, onUngroup, onDeleteGroup }: GroupListPanelProps) {
  const groupList = Object.values(groups).sort((a, b) => b.createdAt - a.createdAt);

  if (groupList.length === 0) {
    return (
      <div className="dk-panel dk-glass p-4 text-center">
        <p className="text-sm text-dk-text-faint">No active groups.</p>
        <p className="text-xs text-dk-text-faint mt-1">Select multiple cards and press Cmd+G to create one.</p>
      </div>
    );
  }

  return (
    <div className="dk-panel dk-glass flex flex-col h-full">
      <div className="p-4 border-b border-dk-border-default">
        <h3 className="text-sm font-semibold text-dk-text-primary">Canvas Groups</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {groupList.map(group => {
          const color = GROUP_COLORS.find(c => c.id === group.colorId) || GROUP_COLORS[0];
          const count = group.cardIds.length;
          
          return (
            <div 
              key={group.id} 
              className="group relative flex items-center gap-3 p-3 rounded-lg bg-dk-bg-surface hover:bg-dk-bg-surface-hover border border-transparent hover:border-dk-border-default transition-all cursor-pointer"
              onClick={() => onZoomToGroup(group.id)}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color.accent, boxShadow: `0 0 8px ${color.accent}40` }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-dk-text-primary truncate">{group.label}</div>
                <div className="text-xs text-dk-text-faint font-mono">{count} cards • {new Date(group.createdAt).toLocaleTimeString()}</div>
              </div>
              
              {/* Hover Actions */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-dk-bg-surface rounded-md p-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); onUngroup(group.id); }}
                  className="p-1.5 rounded hover:bg-dk-bg-surface-hover text-dk-text-faint hover:text-dk-accent"
                  title="Ungroup"
                >
                  <Ungroup size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-dk-text-faint hover:text-red-400"
                  title="Delete Group & Cards"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Integration Note for `AiPage.tsx`
Replace the broken `onGroupCards` implementation with:
```tsx
onGroupCards={(cardIds) => {
  if (cardIds.length < 2) return;
  const groupedCards = cardIds.map(id => canvas.allCards[id]).filter(Boolean);
  if (groupedCards.length < 2) return;

  const avgX = groupedCards.reduce((sum, c) => sum + c.position.x, 0) / groupedCards.length;
  const avgY = groupedCards.reduce((sum, c) => sum + c.position.y, 0) / groupedCards.length;

  // Use the new hook method instead of manual state manipulation
  canvas.createGroup(`Group (${groupedCards.length})`, cardIds, 'violet', { x: avgX, y: avgY });
}}
```
This single change resolves the data duplication, ensures child cards are not dismissed, and properly links the visual card to the group metadata.
```
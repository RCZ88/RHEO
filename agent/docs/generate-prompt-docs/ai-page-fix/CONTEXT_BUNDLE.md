# Context Bundle — AI Page Revamp Fix

> This bundle contains the ACTUAL source code for the AI page.
> The target AI must read this FIRST, then fix the UI to match the RESULT (5).md specification.

---

## Problem

The AI page layout is broken:
1. The AiPageDeck still uses the OLD 3-column layout (dk-main-row, dk-sidebar, dk-grid) instead of the new Command Center layout
2. The chat is squeezed between sidebar and strip
3. Buttons on the AI chat need to work properly
4. The RESULT (5).md specifies a complete rewrite but it wasn't fully applied

## RESULT (5).md Reference

The full specification is at `agent/docs/2026-07-12_ai-page-full-revamp/RESULT (5).md` (2998 lines). The target AI MUST read this file first.

Key points from RESULT (5).md:
- The page becomes a **command center** with the chat as the absolute focal point
- Top bar with History + Settings buttons
- Status bar with glance metrics + connector status
- Chat card as the main content (60% viewport)
- Memory chips bar
- Input area with slash commands
- Collapsible Focus/Plan/Reflect strip
- No more 3-column sidebar layout

## Source Code

### AiPageDeck.tsx (current - BROKEN)

```tsx
// src/components/ai/deck/AiPageDeck.tsx
// Current implementation still uses OLD layout:
// - dk-main-row (3-column sidebar)
// - dk-sidebar (glance + digest + connectors)
// - dk-grid (chat panel)
// This needs to be replaced with the Command Center layout from RESULT (5).md

export function AiPageDeck(props: DeckProps) {
  return (
    <>
      {/* Top bar - OK */}
      <div style={{...}}>...</div>
      
      {/* Status bar - OK */}
      <div style={{...}}>...</div>
      
      {/* OLD LAYOUT: 3-column sidebar (BROKEN) */}
      <div className="dk-main-row">  // <-- THIS IS THE PROBLEM
        <div className="dk-sidebar">  // <-- 3-column sidebar
          <div className="dk-col">Today at a glance</div>
          <div className="dk-col">{props.digestSlot}</div>
          <div className="dk-col">{props.connectorsSlot}</div>
        </div>
        <div className="dk-grid">  // <-- Chat panel squeezed
          <ChatPanel ... />
        </div>
      </div>
      
      {/* Strip */}
      <div className="dk-strip">...</div>
    </>
  )
}
```

### deck.css (current)

```css
/* The CSS already has the new variables and some new classes */
/* But the old dk-main-row, dk-sidebar, dk-grid classes are still used */
/* The new dk-chat-card, dk-stream, dk-msg classes exist but aren't used */
```

### ChatPanel.tsx (current)

```tsx
// ChatPanel is already well-structured
// Uses dk-card dk-acc dk-pink dk-deck classes
// Has proper scroll behavior and message rendering
```

### ChatInput.tsx (current)

```tsx
// ChatInput has slash command palette
// Has voice input support
// Has send/stop buttons
// Looks correct
```

### ChatEmptyState.tsx (current)

```tsx
// Empty state with greeting, suggestions, new thread button
// Looks correct
```

### MessageBubble.tsx (current)

```tsx
// Message bubble with user/ai styling
// Has parsed message routing
// Looks correct
```

---

## What Needs to Be Fixed

1. **AiPageDeck.tsx**: Replace the old 3-column layout with the new Command Center layout from RESULT (5).md
2. **deck.css**: Ensure the new CSS classes (dk-chat-card, dk-stream, dk-msg, etc.) are properly applied
3. **Buttons**: Make sure History, Settings, and other buttons actually work (onOpenHistory, onOpenSettings callbacks)
4. **Layout**: The chat should be the focal point, not squeezed into a sidebar

## Constraints

1. Must work with existing chat infrastructure (ChatPanel, ChatInput, MessageBubble, etc.)
2. Must preserve all existing functionality (slash commands, voice input, agent steps, etc.)
3. Must follow the RESULT (5).md specification for the Command Center layout
4. The rest is up to the AI to decide which to include and which to adjust or remove

# PROMPT: Fix AI Page Layout — Command Center Design

## Raw Request

> U FUCKING DESTROYED ALL THE UI AND EVERYTHING U FUCKING IDIOT. WHY IS IT EVERYTHING IN ONE COLUMN?? ALL OF IT IN ROWS??? I JUST WANT TO KEEP SOME OF THE CARDS BUT NOT IMPLEMENT THEM LIKE THAT WITH THE UGLY LAYOUTS THAT ARE NON EXISTENT. I WANT YOU TO REFER TO THE RESULT THAT THE AI HAS ALREADY CREATED AND FIX THE CODES WE HAD. ITS SO MESSY AND WHY IS EVERYTHING SQUASHED AND THE SIZINGS ITS NOT FITTING THE CONTENT. I NEED YOU TO REFER TO THE RESULT AND MAKE SURE THE BUTTONS ACTUALLY WORK. THE AI CHAT. THE ONES WHERE LIKE THERE'S SOMETHING ON THE AI CHAT. NOT SOMEWHERE ELSE BUT ON THE AI CHAT. THE REST IS UP TO THE AI TO DECIDE WHICH TO INCLUDE AND WHICH TO ADJUST OR REMOVE.

## Context Bundle

Read `agent/docs/ai-page-fix/CONTEXT_BUNDLE.md` for the full source code of the current AI page. This file contains the actual TypeScript/React code with file paths and line numbers. Do NOT guess at the code structure — the context bundle IS the codebase reference.

## RESULT Reference

Read `agent/docs/2026-07-12_ai-page-full-revamp/RESULT (5).md` for the complete AI page revamp specification. This is a 2998-line document that specifies:
- The Command Center layout (chat as focal point)
- Exact CSS rules for every component
- Component specifications (AiPageDeck, ChatPanel, ChatInput, SlashCommandPalette, MessageBubble, ChatEmptyState)
- Animation specifications
- File change list

The target AI MUST read this RESULT (5).md first, then fix the code to match.

---

## Mandate

Fix the AI page layout to match the RESULT (5).md specification. You are the **Lead Designer and Engineer**. Do NOT provide options. Design THE solution.

The current AiPageDeck.tsx still uses the OLD 3-column layout (dk-main-row, dk-sidebar, dk-grid). This needs to be replaced with the new Command Center layout from RESULT (5).md.

---

## What Needs to Be Fixed

### 1. AiPageDeck.tsx — Complete Rewrite
Replace the old 3-column layout with the new Command Center layout:
- Top bar with History + Settings buttons
- Status bar with glance metrics + connector status
- Chat card as the main content (60% viewport)
- Memory chips bar
- Input area with slash commands
- Collapsible Focus/Plan/Reflect strip

### 2. deck.css — Ensure New Classes Are Applied
The CSS already has the new variables and classes (dk-chat-card, dk-stream, dk-msg, etc.). Make sure they are properly applied in the components.

### 3. Buttons — Make Them Work
- History button should open the history drawer
- Settings button should navigate to settings
- All other buttons should have working onClick handlers

### 4. Layout — Chat as Focal Point
- The chat should take up most of the viewport
- No more 3-column sidebar layout
- Everything else is secondary (toggles, modals, slide-overs)

---

## Constraints

1. Must work with existing chat infrastructure (ChatPanel, ChatInput, MessageBubble, etc.)
2. Must preserve all existing functionality (slash commands, voice input, agent steps, etc.)
3. Must follow the RESULT (5).md specification for the Command Center layout
4. The rest is up to the AI to decide which to include and which to adjust or remove

## Output Format

Return a RESULT.md with:
1. **Layout Fix** — exact code changes for AiPageDeck.tsx
2. **CSS Updates** — any CSS changes needed
3. **Button Wiring** — ensure all buttons work
4. **Verification** — how to test the fix

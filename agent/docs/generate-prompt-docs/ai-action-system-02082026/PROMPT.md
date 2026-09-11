# PROMPT — AI Action System: Animations + Compositions Integration + Dynamic UI

## Raw Request

"simple but noticable animations that shows the ai actions for example on adding things or like on removing or editing some parts of the contents of the ui for example, and for exmaple showing that it is creating a new external activity. HOWS THE PROGRESS ON THE SUPER ADAPTIVE AIA SYSTEM THAT I SABLE TO GENERATE TEH UI AND FEATURES BY ITSELF? WOULD LIKE FOR THAT FEATURE TO FOCUS MORE ON HOW IT CAN GENERATE LIKE THE UI FOR THE PROCESS DYANMICALLY TOO. AND WHY is it a separate page? ITS SUPPOSED TO BE PART OF THE AI ASSISTANT PAGE, and NOT the compositions page whatever that is."

## Context Bundle

Read `CONTEXT_BUNDLE.md` in this folder. It contains ALL source code, types, IPC endpoints, design tokens, and architecture notes. The target AI must read it first.

## Problem Statement

The RHEO AI assistant page has three gaps:

1. **No visible AI action feedback.** When the AI performs actions (adding goals, creating deadlines, sending emails, scheduling events), the only feedback is a plain text toast. The user cannot see what the AI did or is doing. There are existing animation primitives (ThinkingIndicator, ActionConfirmCard, AgentProgressBar, framer-motion variants) but they are not wired to AI actions.

2. **Compositions is a separate page.** The DSL-driven automation engine (`/compositions` route, `CompositionPage.tsx`) is isolated from the AI assistant page. The user wants it integrated as a view mode inside the AI page, not as a standalone page.

3. **No dynamic UI generation.** The AI cannot generate UI components that render live on the canvas. The user wants the AI to build visual elements in real-time, showing the creation process with animations.

## The Mandate

Design a **comprehensive AI Action Animation + Compositions Integration + Dynamic UI Generation system** for the RHEO AI assistant page. This is NOT a menu of options — design ONE complete solution covering all three systems.

### System 1: AI Action Animation Layer

Design an animation system that gives visible, noticeable feedback for EVERY AI action across ALL pages. The existing primitives (ThinkingIndicator, ActionConfirmCard, AgentProgressBar, toast system, framer-motion variants) must be reused and extended.

**Requirements:**
- Every AI action (goal CRUD, email, schedule, deadline, calendar, canvas, composition) must have a distinct animation
- Animations must be in-context (not just toasts) — show the action happening in the relevant UI area
- Animations must use the existing `motion.ts` system (sectionVariants, itemVariants, staggerParent, AnimatePresence)
- Animations must respect `prefers-reduced-motion`
- Duration budget: fast (150ms) for micro-interactions, normal (250ms) for content changes, slow (400ms) for major transitions
- Each action type needs: entering animation, execution indicator, completion confirmation

**For each action type, specify:**
- The animation recipe (framer-motion variants)
- Where it appears (which slot/section/card)
- The visual sequence (enter → execute → complete)
- Icon/color changes during state transitions

### System 2: Compositions Integration

Move the Compositions DSL engine from standalone `/compositions` route into the AI assistant page as a third view mode (alongside Deck and Canvas).

**Requirements:**
- Add a COMPOSITIONS toggle to the top bar (next to DECK/CANVAS)
- CompositionPage content becomes a panel/slot inside AiPageDeck or a standalone layout in AiPage
- Remove the standalone route from App.tsx sidebar and router
- Composition rules list, editor modal, execution history all render inside the AI page
- The DSL editor can be triggered by the AI (e.g., "create a composition rule for X")
- New compositions created by the AI appear with entrance animations

### System 3: Dynamic UI Generation

Design a system where the AI can generate UI components that render live on the canvas. This is the "super adaptive AI system" the user wants.

**Requirements:**
- The AI can emit structured UI descriptions (JSON) that get rendered as real components
- Components render on the Canvas mode with entrance animations
- The AI shows a "building" progress indicator while generating
- Generated components are: cards, charts, lists, forms, or custom layouts
- Each generated component gets a creation animation (assembles from parts, fades in, slides up)
- The user can interact with generated components (edit, dismiss, save)
- Generated components are persisted in canvas state

**For the dynamic UI system, specify:**
- The JSON schema for AI-generated UI descriptions
- The renderer that converts descriptions to React components
- The animation sequence for component generation
- The persistence model (localStorage via canvas state)
- Error handling (what happens if generation fails mid-way)

## Design Specifications

### Animation Recipes

Design these specific animations:

1. **Card Enter** — New card appears on canvas (scale from 0.95 + fade + slide up)
2. **Card Exit** — Card dismissed (fade + slide down + scale to 0.95)
3. **Content Update** — Existing card content changes (flash highlight + smooth text transition)
4. **Action Spinner** — AI executing an action (Loader2 spin in context, not just toast)
5. **Completion Burst** — Action completed (CheckDraw animation + brief emerald glow)
6. **Error Shake** — Action failed (horizontal shake + red border flash)
7. **List Item Add** — New item inserted into a list (slide in from right + fade)
8. **List Item Remove** — Item removed (slide out left + fade + collapse height)
9. **Drag Feedback** — Card being dragged (scale up slightly, shadow deepens, z-index boost)
10. **Group Formation** — Cards merging into group (converge animation + color pulse)
11. **AI Building** — AI generating a component (progress bar + partial renders appearing)
12. **Composition Execute** — DSL rule runs (brief flash on affected cards + status badge pulse)

### Visual Hierarchy

- **Primary feedback**: In-context animation at the action site (card appears, item slides in)
- **Secondary feedback**: AgentProgressBar for multi-step actions
- **Tertiary feedback**: Toast for background actions (sync, digest generation)

### Color Coding

- Success: emerald (#10b981) — brief glow, checkmark
- Error: red (#ef4444) — shake, red border flash
- In-progress: pink (#ec4899) — spinner, pulse
- Info: violet (#8b5cf6) — entrance, transition

## Constraints

- Must use existing framer-motion infrastructure (motion.ts, tokens.ts)
- Must respect `prefers-reduced-motion`
- Must not break existing functionality
- Must work in both Deck and Canvas modes
- Must persist generated components in canvas state (localStorage)
- Must work with the existing glass aesthetic (backdrop-blur, zinc-900, rounded-2xl)
- Dark mode only
- Geist Sans + JetBrains Mono fonts

## Output Format

Provide:
1. **Component architecture** — new files, modified files, component hierarchy
2. **Animation specifications** — exact framer-motion variant objects for each recipe
3. **Integration plan** — how each system connects to existing code
4. **File-by-file changes** — what to add/modify in each affected file
5. **Generated UI schema** — JSON structure for AI-generated components
6. **Persistence model** — how generated components are stored
7. **Error handling** — graceful degradation for each failure mode

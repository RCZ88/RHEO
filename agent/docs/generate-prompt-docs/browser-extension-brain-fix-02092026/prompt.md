# 📝 Generate Prompt — Browser Extension Brain Orchestration Fix

## Raw Request (verbatim from user)

> theres a lot of things that are not working. hence why i would like you to review it back So feature that I would like to make sure that it is included in the extension feature where it's related to the Chrome extension or whatever browser extension are we using the extension. It needs to handle those properly and how they're supposed to handle the properly. There's supposed to be that it can do such things such as handling multiple different charts and handling the handling. how it is able to handle and save the categories of charts and like we can assign those names or we can assign the names to those and we can use AI to you know have a contact on like what are the things to the you know what are the topics that are already living there and how can we make it so that the name is just and follow those stuff properly right So, it needs to be that there's an AI-appropriate system, it needs to be that the AI system is dynamic and where we're able to make sure that it has a surrounding, it's aware of the surrounding of the list of charts we have, the list of topics and connected to the brain and how does it update the brain, how do we update, how do we make sure that it updates it properly, it has a proper system where it can send the message to the, it can send a message to the AI to be able to summarize it because... Because we can't just rely on us selecting the ... So, it needs to be that there's an AI-appropriate system, it needs to be that the AI system is dynamic and where we're able to make sure that it has a surrounding, it's aware of the surrounding of the list of charts we have, the list of topics and connected to the brain and how does it update the brain, how do we update, how do we make sure that it updates it properly, it has a proper system where it can send the message to the, it can send a message to the AI to be able to summarize it because... Because we can't just rely on us selecting the charts manually, and one of the other features that I would like is to be able to export the chart and have a system where we're able to conduct output. So how do you make sure that the exchange agent is able to insert a text into the text input of the AI? I would like you to use a generic prompt to use some sort of research using that prompt. But maybe other AI, do the research for that. How is it able to do those multiple stuff and how is it able to connect to our features, right? That uses the external AI chat that has the prompt and it is able to send it, like essentially it's able to once it sends it, and it is able to leave the ones to receive it and instantly input it back. I don't know if that features a possible or not, but we need to try to do that and try to do the research and how we can do that properly, right? So I think we need to do those, I need you to just generate from skill to manage all of those and to do the research, right? Because we need to do the research and how we can do this and how do we manage using the complicated context system management. One of the proper context management systems that are we going to use And how will we make sure that those stuff are used properly and yeah, that's basically it.

> @folder:`agent/skills/generate-prompt/` make sure to use this skills properly

---

## Problem Statement

The DeskFlow browser extension feature is not working properly. External AI websites (ChatGPT, Claude, Perplexity, etc.) are not properly updating the brain context orchestrated by an AI provider that assigns contexts into the correct section of the context management brain system. The browser extension captures AI conversations and sends them to the Electron app, but the pipeline from `ai_context_captures` → `context_episodes` → brain entities/facts is broken or unconfirmed. There are 5 major broken pieces in the pipeline, plus missing features for chart/category management, AI topic-awareness, bidirectional chat injection, chart export, and generate-prompt skill integration.

---

## Context Bundle Reference

`CONTEXT_BUNDLE.md` is the source of truth for the complete codebase context, data structures, architecture, and broken-pieces analysis. Read it first.

Key references from the context bundle:

### Data Flow
- **Extension capture pipeline:** `ai-context-content.js` → `fetch` interceptor → `POST localhost:54321/ai-context` → `ai_context_captures` table → `episodeWriters.writeAiContextEpisode()` → `context_episodes` → extraction jobs → brain entities/facts
- **Provider chain routing:** `buildChain(pState, 'goalAssistant')` and `buildChain(pState, 'contentEngine')` in `src/services/providers/router.ts`
- **Two-way context loop:** `background.js` polls `/extension/poll` every 2s; `DESKFLOW_INSERT_CONTEXT` / `INJECT_PROMPT` stashes `window.__deskflowPending`

### Broken Pieces
1. **P1 — `/ai-context` silently swallows errors** — `writeAiContextEpisode()` wrapped in bare `try {}`, no failure signal back to extension
2. **P2 — No offline queue** — `fetch` to `/ai-context` fails → captures lost if service worker terminates
3. **P3 — Extension has zero visibility into provider→brain-section routing** — no endpoint exposes `buildChain` mapping
4. **P4 — `ai_context_captures` → brain entities/facts pipeline unconfirmed** — extraction runs async, no status endpoint
5. **P5 — Categories and topics are internal-only** — `deskflow-categories.json` and `ai_interests` not exposed to extension

### Proposed Features
- **Feature 1:** Chart/Category Management + AI Topic Awareness — extension sees categories, user renames/assigns, AI suggests topics
- **Feature 2:** AI Summarization + Bidirectional Chat Injection — extension sends research prompt → AI → auto-inserts into chat input

### Key Endpoints to Add
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/extension/chart-categories` | Return category maps + topics |
| PATCH | `/extension/chart-categories` | Partial category updates |
| GET | `/extension/topics` | Return `ai_interests` rows |
| POST | `/extension/topics` | Add new topic |
| POST | `/extension/topics/ai-suggest` | AI generates topic names |
| POST | `/extension/ai-summarize` | AI summarize current page |
| POST | `/extension/ai-chat` | Bidirectional AI chat |
| POST | `/extension/ai-research` | AI research via provider |

---

## Engineering Task

Design a complete data processing pipeline and feature specification for fixing and extending the browser extension → brain context orchestration system. Specifically:

1. **Fix the 5 broken pieces** in the existing pipeline:
   - Add proper error handling and status reporting to `/ai-context` endpoint
   - Add persistent offline queue to browser extension using `chrome.storage.local`
   - Add `/extension/provider-routing` endpoint exposing AI provider → brain section mapping
   - Add `/extension/episode-status` endpoint and extraction retry mechanism
   - Add GET/PATCH endpoints for categories and topics with bidirectional sync

2. **Design the Chart/Category Management + AI Topic Awareness system:**
   - Data model for categories (custom categories, domain assignments, tier assignments)
   - API endpoints for CRUD on categories and topics
   - AI topic suggestion flow: extension sends request → `AIService.generateTopicDigest` or `buildChain(pState, 'contentEngine')` → returns suggested topic names
   - Bidirectional sync between extension popup and main app

3. **Design the AI Summarization + Bidirectional Chat Injection system:**
   - New command types: `AI_SUMMARIZE`, `AI_CHAT`, `AI_RESEARCH`
   - Backend endpoints that call the AI provider chain
   - Frontend injection: `DESKFLOW_INSERT_CONTEXT` with type `AI_SUMMARY_INJECT` → content script reads page, posts to `/extension/ai-summarize`
   - `DESKFLOW_INSERT_CONTEXT` with type `AI_CHAT_RESPONSE` → programmatically fills chat input field via DOM and triggers send
   - Chart export: content script extracts chart data from DOM, sends to backend for AI analysis

4. **Design the generate-prompt skill integration:**
   - The `agent/skills/generate-prompt/` skill must be used properly per the skill's workflow
   - Follow the skill's mandatory steps: update state.md, create CONTEXT_BUNDLE.md, generate prompt
   - Include MCP inventory query, anti-slop checklist, frontend design skills list

---

## Design Task

Design the high-fidelity UI/UX for the browser extension popup and overlay:

1. **Popup UI redesign** — The extension popup needs new tabs:
   - "Capture" tab — shows active captures, provider status
   - "Topics & Categories" tab — shows/manages categories and topics
   - "AI Chat" panel — text input + send button for AI interaction
   - "Status" tab — shows brain sync status, extraction progress

2. **Category management UI:**
   - List of custom categories with rename capability
   - Domain-to-category assignment interface
   - Toggle for topics (ai_interests) on/off
   - AI-suggest button that triggers topic generation

3. **AI Chat panel:**
   - Text input field (like a chat interface)
   - Send button
   - Message history display
   - Auto-insert into the active AI chat page when sent

4. **Visual design:**
   - Follow the project's design tokens (`--dk-*` tokens)
   - Glass effects: `bg-zinc-900/80 backdrop-blur-xl`
   - Fonts: Geist (display), JetBrains Mono (code/data), Inter (body)
   - Dark mode only
   - Pink accent color (#ec4899) for active states
   - 40px cell grid system

---

## UX Task

Design the interaction flow:

1. **Capture flow:** User visits an AI website → extension captures conversation → sends to backend → stored in `ai_context_captures` → `writeAiContextEpisode` → `context_episodes` → extraction → brain entities/facts → user sees status in popup

2. **Category management flow:** User opens popup → goes to "Topics & Categories" tab → sees current categories and topics → renames a category → change synced to main app → AI suggests new topics based on recent captures → user approves/dismisses

3. **AI chat flow:** User types a question in popup AI Chat → sends → backend calls AI provider via `buildChain(pState, 'contentEngine')` → response returned → auto-inserted into the active AI chat page via DOM injection

4. **Chart export flow:** User views charts in the overlay → clicks export → chart data extracted from DOM → sent to backend → AI analyzes and returns structured data → user can copy or download

---

## Constraints

1. **Keep all existing TypeScript types and interfaces unchanged**
2. **Keep all existing IPC handlers and data flow unchanged**
3. **Keep the `--dk-*` token naming convention**
4. **Keep the 40px cell grid system**
5. **Keep the `StateView` 4-state pattern**
6. **Don't add new npm dependencies**
7. **Preserve all existing CSS class names** referenced in TSX files
8. **Keep the canvas dark-mode only**
9. **Maintain the component file structure**
10. **No API keys, tokens, passwords, secrets, credentials** — use `[REDACTED]`
11. **Browser extension communicates with DeskFlow at `localhost:54321`**
12. **`agent/skills/generate-prompt/` skill must be used properly**
13. **MVP scope:** Focus on the backend data processing pipeline and core UI for categories/topics/AI chat. Chart export can be a follow-up phase.

---

## MCP Inventory (MANDATORY for frontend tasks)

When generating a prompt for a **frontend/UI task**, include these sections:

### A. Frontend Design Skills
1. **Frontend Design** — DeskFlow-specific component patterns, tokens, spacing, typography, glass cards
2. **Human-Centric UX** — empty/loading/error states, progressive disclosure, visual hierarchy, feedback
3. **Impeccable** — 7 design dimensions, 27 anti-patterns
4. **Motion — Bring the UI Alive** — Liveliness Levels, motion taxonomy
5. **UI UX Pro Max** — industry-specific design rules
6. **Design Taste System** — master aggregator, design variance knobs
7. **frontend-external-infra** — source routing, re-skin rules, anti-slop checklist

### B. Query ALL MCP servers and list their real inventory
1. **shadcn MCP** → Run `npx -y shadcn@latest search '@shadcn'` for relevant components
2. **Magic UI MCP** → Fetch from https://magicui.design/docs/components/
3. **Lucide MCP** — List specific icon names relevant to the task
4. **React Bits MCP** — 135+ components available
5. **Iconify MCP** — 200k+ icons as fallback

### C. Anti-Slop Checklist
After any MCP-sourced component, the target AI must:
1. Re-skin to DeskFlow tokens (colors → --bg-primary, --accent-primary, etc.)
2. Max rounded-xl, p-5 padding
3. Dark mode only
4. Geist + JetBrains Mono fonts
5. Glass layer (bg-zinc-900/80 backdrop-blur-xl)

---

## Output Format

Return your changes as:

1. **A summary** (3-5 sentences) describing the design direction you chose and why
2. **The complete backend specification** — new endpoints, data models, API request/response shapes, error handling
3. **The complete frontend specification** — popup UI redesign, category management UI, AI chat panel, injection points in content scripts
4. **The data flow diagrams** — showing how captures flow from extension → backend → brain, and how AI responses flow back
5. **The complete prompt for the design AI** — a ready-to-use prompt that the receiving AI can use to implement the full system
6. **A list of new CSS classes** you introduced and what they do

Be bold. Make it beautiful and functional. The goal is "the browser extension properly updates the brain context orchestrated by an AI provider."

---

## Inspiration (optional reference points)

- **Linear.app** — clean glass panels, subtle depth, premium feel
- **Raycast** — command palette UX, glow effects, command center vibe
- **Figma** — infinite canvas interaction model, minimap quality
- **Vercel Dashboard** — data cards with clarity and restraint
- **Arc Browser** — playful but precise, spatial navigation

Don't copy any of these wholesale. Use them as mood references.

---

## CRITICAL: RESULT.md Usage Rules

When the design prompt generates a `RESULT.md` (or equivalent output), follow these rules strictly:

### Rule 1 — RESULT.md is RAW and UNTOUCHABLE
The RESULT.md from the prompt's target AI must be consumed **exactly as-is**. Do NOT:
- Edit, rewrite, or summarize it
- Add your own interpretation or commentary
- Pre-process it to "fit" the codebase
- Remove or reorder sections

Save it to `agent/docs/generate-prompt-docs/browser-extension-brain-fix-02092026/RESULT.md` verbatim.

### Rule 2 — Implement After Analysis (Not During)
Do not start implementing until the full RESULT.md has been generated and saved. Read it completely before making any code changes.

### Rule 3 — Cross-Reference with CONTEXT_BUNDLE.md
All implementation must reference the `CONTEXT_BUNDLE.md` for exact data structures, API shapes, and architecture. Never improvise data models that contradict the bundle.

---

## Notes for the Target AI

This is a **research and design task**, not a code implementation task. The goal is to produce a comprehensive specification that can be used to implement the browser extension brain orchestration fix. The specification must be detailed enough that a developer could implement it directly from the output.

The `generate-prompt` skill workflow must be followed:
1. ✅ Update state.md first
2. ✅ Create CONTEXT_BUNDLE.md (this file's companion)
3. Generate this prompt
4. Save prompt to `agent/docs/generate-prompt-docs/browser-extension-brain-fix-02092026/prompt.md`
5. After receiving RESULT.md, save it verbatim
6. Then implement the specification

**Target AI role:** You are acting as a Lead Designer and Engineer for DeskFlow. Design the complete data processing pipeline, UI/UX, and interaction flow for fixing the browser extension → brain context orchestration system.

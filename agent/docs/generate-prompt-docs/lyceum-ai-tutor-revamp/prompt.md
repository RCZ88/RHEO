# Lyceum AI Tutor System Overhaul — Design Prompt

## Raw Request

> "i need you to use @agent/skills/generate-prompt/SKILL.md for this request next: Provide a detailed summary for continuing our conversation above. You are writing a summary that will be used as context for the next session, and MUST include the following blocks: Summary of what the user wants and your conversation; Goal(s); Relevant Files, any decisions made, and any discoveries found. It's okay if you don't have some of these, just leave them out." ... "Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed." ... "Provide a detailed summary for continuing our conversation above" ... Actually wait — I have on more thing. The user's summary request is a high-level capture of what they want in the AI assistant overhaul. The key point they made in the original message was: **The AI shouldn't be a lame text bot — it should be able to edit stuff and give notes to actual things** ... [previous session user:] "Honestly this is amazing. But i REALLY need the AI to not be a text bot. Like right now i ask a question and the AI just gives me text. I need the AI do things. I need the AI on that page to be able to put notes and edit text inside the learning content. I need to be able to save whatever the AI is explaining. I need a better UI for the chatbot itself and better parsing of the AI responses into actual interactive UI. I need the system prompts to be adjusted so the AI responds in a format that can be parsed properly and turned into interactive UI. Also for when the AI does things like create notes or edit things — the user should have to confirm that the AI can create/edit things. So if the AI wants to create a note for me, i have to agree to it. Obviously some settings where which things require permission and which things can auto-apply. and yeah, the dashboard too."

## Context

**Read `agent/docs/ai-tutor-revamp/CONTEXT_BUNDLE.md` first.** It contains the full codebase context: every file path, type signature, IPC channel, DB schema, design token, and current UI pattern — extracted directly from the repository.

This is the single source of truth. The target AI has no access to the codebase. Every line number cited below refers to `CONTEXT_BUNDLE.md`.

## The Mandate

Design a **comprehensive technical and visual specification** for transforming the Lyceum AI tutor from a single-turn text Q&A bot into an **interactive, action-capable learning companion**. The solution must cover:

1. **AI Response Parsing** — Replace regex Markdown→HTML with structured block-level parsing
2. **AI Action System** — Give the AI a vocabulary to create notes, edit content, and suggest changes
3. **Confirmation Workflow** — User must approve AI-initiated actions before they take effect
4. **Permission Settings** — Per-action mode (auto / confirm / blocked)
5. **Chatbot UI Revamp** — Multi-turn conversations, rich interactive responses, persistent history
6. **Dashboard Integration** — Surface learning stats, recent lessons, and AI activity on dashboard
7. **Backend Infrastructure** — New IPC channels, DB tables, service methods for notes, edits, conversations, permissions

## Design Requirements

### A. AI Response Parsing

**Current (`TutorPanel.tsx:204-221`):** `renderAnswerHtml()` does 13 `.replace()` calls — HTML entity escaping (3×), heading levels h2/h3/h4 (3×), bold, italic, inline code, unordered lists, ordered lists, paragraph breaks, citation markers. Returns raw HTML string injected via `dangerouslySetInnerHTML` at line 306.

**Current (`types.ts:79-93`):** `TutorAnswer.answer_md: string` is the sole content field. It carries `citations`, `assessment`, `escalated`, `confidence`, but no structured blocks.

**Current (`tutor.service.ts:1238-1241`):** The tutor system prompt (`TUTOR_SYSTEM_PROMPT`) instructs the model: `Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[] }`. This is a flat string response format.

**Current (`tutor.service.ts:1270`):** `TutorService.ask()` returns `Promise<Result<TutorAnswer>>`. The AI calls are synchronous (no streaming) — `this.callAi()` at line 1304 wraps `router.ts:1397-1473` (`buildChain`+`runWithFallback` → `callProvider.ts:1480` HTTP POST).

**Required:** The AI tutor system prompt must be rewritten so the model returns a **structured block array** instead of a single markdown string. Each block has a `type` and `content` that can be rendered as an interactive UI component.

Design:
1. **Structured response schema** — Extend `TutorAnswer` (or replace with `TutorResponse`) adding a `blocks: TutorBlock[]` field while keeping `answer_md` as fallback. Define types in `types.ts` (current location of all shared types).
2. **Block types the AI can emit in tutor responses:**
   - `explanation` — prose explanation (current default, maps to current `answer_md` path)
   - `code_snippet` — syntax-highlighted code with copy button
   - `diagram` — Mermaid diagram or ASCII diagram
   - `flashcard` — Q&A pair the user can flip
   - `key_point` — bulleted key takeaways
   - `analogy` — visual callout with comparison
   - `note_proposal` — "I'll create a note for this section" UI
   - `edit_proposal` — "I suggest changing this paragraph to..."
   - `quiz_question` — interactive practice question
   - `comparison_table` — side-by-side comparison
   - `step_list` — numbered steps with progress
   - `resource_link` — external resource with description
   - `exercise` — interactive practice exercise
3. **Parsing pipeline:** Rewrite `TutorService.ask()` (`tutor.service.ts:1270`) to accept and return the new structured format. The AI call returns `{ blocks: TutorBlock[], metadata: { confidence, citations, assessment } }`. Each block is validated and rendered by a new `TutorBlockRenderer` component (analogous to the existing `BlockRenderer` at `LearnPage.tsx:1689` which already renders `LessonBlock` types).
4. **System prompt update:** Modify the tutor system prompt at `tutor.service.ts:1238-1241` and/or `promptLibrary.ts:1582-1677`. The prompt must instruct the AI to emit block-structured JSON with examples of each block type. The `composeTutorPersona()` function at `promptLibrary.ts:1645` should be extended to include block-format instructions.

### B. AI Action System

**Current (`types.ts:79-93`):** `TutorAnswer` has no action fields. AI returns only text. No content modification, no note creation. The `TutorPanel.tsx:349-356` shows an "Insert into note" button but that is a manual user action, not AI-initiated.

**Required:** The AI must have a vocabulary for proposing actions. Actions are returned as special `action` blocks in the tutor response:

1. **Action types:**
   - `create_note(title, content, nodeId, blockId?)` — AI proposes a note on specific content
   - `edit_content(nodeId, blockId, originalText, replacementText, rationale)` — AI proposes text replacement
   - `insert_block(nodeId, afterBlockId, newBlock)` — AI proposes inserting a new block (type `LessonBlock` from `types.ts:102-112`)
   - `suggest_exercise(topic, difficulty)` — AI proposes a practice exercise
2. **Action flow:**
   - AI includes `action` block in tutor response
   - UI renders action as a "proposal card" with visual diff/preview
   - User sees: "The AI suggests creating a note: [title]" with [Approve] [Reject] [Edit] buttons
   - Approved actions execute: run IPC → update DB → refresh UI
   - Rejected actions just dismiss
3. **Visual design for proposals:**
   - Proposal cards: distinctive border (`amber-500/40`), slide-in animation (framer-motion `AnimatePresence` as used in `TutorPanel.tsx:257-258`), action buttons at bottom
   - Diff view for content edits: split-pane showing original vs proposed
   - Note preview: rendered markdown preview before saving

### C. Confirmation Workflow

**Required:**
1. Every AI-initiated action goes through a `pending` state first
2. `PendingAction` type: `{ id, type, payload, status: 'pending' | 'approved' | 'rejected', createdAt }`
3. Pending actions render as "pill" indicators on the tutor panel or floating notification
4. User can approve/reject individually or in bulk
5. Approving executes the action; rejecting discards it with an optional reason stored
6. Design the database table: `learn_pending_actions`

**Existing patterns to follow:**
- `Result<T>` pattern at `types.ts:71`: `{ ok: true; data: T } | { ok: false; error: string }` — all new IPC handlers must use this
- Migration convention at `repo.ts:1025-1048`: sequential files `003_learn_notes.sql`, `004_learn_actions.sql`, etc. Each migration checks `_migrations` tracking table
- Prepared statement pattern at `repo.ts:1051-1083`: `db.prepare('SELECT ...').get()`, `.run()`, `.all()` — no raw SQL strings in handlers

### D. Permission Settings

**Required:**
1. A settings page (subtab under Learn or a modal) with per-action-type toggles:
   - `Create Notes`: Auto-apply / Confirm / Blocked
   - `Edit Content`: Auto-apply / Confirm / Blocked
   - `Insert Blocks`: Auto-apply / Confirm / Blocked
   - `Suggest Exercises`: Auto-apply / Confirm / Blocked
2. Stored in DB (`learn_permission_settings` table) with IPC CRUD
3. Design the UI: toggle switches with descriptive text, grouped by category, with a "Reset to defaults" button
4. Integration: either as a subtab in the Learn area (`LearnPage.tsx:1719` — `view` state `'welcome' | 'showcase' | 'library' | 'reader' | 'import'` could add `'settings'`) or as a section in Settings page. If in Settings, follow the existing `SettingsPage.tsx` pattern (uses `bg-zinc-900/80 backdrop-blur-xl` glass pattern).

### E. Chatbot UI Revamp

**Current (`TutorPanel.tsx:193-393`):** Single Q&A panel, no history, no multi-turn. Messages not persisted. `TutorAnswer` has a single `answer_md` field.
- Loading state at `TutorPanel.tsx:285-289`: Spinner (`Loader2` with `animate-spin`) + "Thinking..." text
- Typing animation at `TutorPanel.tsx:223-238`: `useTypingEffect()` — 18ms per character via `setInterval`
- Empty state at `TutorPanel.tsx:279-283`: `Sparkles` icon + "Select text or type a question"
- No suggestions array — `tutorActions` exists only in `SelectionActions.tsx:444-449`
- Citations expand/collapse at `TutorPanel.tsx:311-332` using `AnimatePresence` with height animation
- Assessment footer at `TutorPanel.tsx:336-346` showing level + `suggested_next`

**Required:**
1. **Multi-turn conversation:** Track conversation per node via new DB table `learn_conversations`. Each exchange adds a message array. User can scroll through history.
2. **Rich message rendering:** Each message is an array of `TutorBlock` components. Different blocks get different rendering:
   - Prose blocks → styled typography (reuse `renderAnswerHtml` as fallback for `explanation` blocks at `TutorPanel.tsx:304-307`)
   - Code blocks → syntax-highlighted with copy button
   - Diagram blocks → rendered Mermaid
   - Flashcard blocks → interactive flip card
   - Proposal blocks → confirmation UI with Amber border (`amber-500/40` per design tokens at `src/index.css:1994`)
3. **Message threading:** Messages grouped by exchange, with clear visual separation
4. **Input improvements:**
   - Auto-resize textarea (replace current `<input>` at `TutorPanel.tsx:371-378` with `<textarea>`)
   - Inline code insertion via backtick button
   - Quick-action buttons below input (e.g., "Save this explanation", "Create note from this")
5. **Suggested follow-ups:** After each answer, AI suggests 2-3 follow-up questions as chips. New optional field in `TutorAnswer`: `suggestions: string[]`
6. **Panel design:** Current 320px width (`w-80` at `TutorPanel.tsx:264`) is acceptable, but should support expansion to 480px via drag handle. Consider a "pop out" mode that opens a larger overlay.
7. **Animations:**
   - Messages slide in staggered (framer-motion `AnimatePresence` already used at `TutorPanel.tsx:257-258`)
   - New blocks fade in with blur-fade effect
   - Streaming text should use real streaming (SSE from backend) not client-side simulation
8. **Mobile/responsive:** Panel should be full-width overlay on narrow screens

### F. Dashboard Integration

**Current (`DashboardPage.tsx:2118-2125`):** Zero Learn module references in `DashboardPage.tsx`. No learning stats, no recent lessons, no mastery overview.

**Current dashboard component patterns:**
- `GlassCard.tsx:2067` — reusable card with 7 variants (`default` | `elevated` | `bordered` | `glass` | `flat` | `interactive` | `outlined`) + 5 accent colours (`clay` | `sage` | `amber` | `sky` | `accent`)
- `SectionHeader.tsx:2098` — icon + title + subtitle + action region
- The dashboard uses `motion` and `AnimatePresence` for transitions (already imported in `DashboardPage.tsx`)

**Required:**
1. **Learning Streak Card:** Number of consecutive days with at least one lesson interaction. Streak flame icon (Lucide `Flame`), motivational message.
2. **Mastery Overview:** Compact bar showing overall progress across all lessons. Click → navigate to `/learn`.
3. **Recent Activity:** Last 3 lessons accessed, with progress % and last-accessed time.
4. **Due Reviews:** If any nodes are due for spaced repetition review, show a "Review Due" badge/card.
5. **Quick Action:** "Continue Learning" button or card that resumes the last-read lesson.
6. **Placement:** Fit into the existing dashboard layout within `GlassCard` containers using `SectionHeader` pattern. Add cards without disrupting the existing grid layout.

### G. Backend Infrastructure

**Current IPC patterns (from `preload.ts:712-787`):**
- `contextBridge.exposeInMainWorld('deskflowAPI', { ... })` at `preload.ts`
- Each method calls `ipcRenderer.invoke('learn:xxx', params)`
- All current learn IPC handlers are registered at `index.ts:867-1009` via `registerLearnHandlers(db, callAi)`
- Main-process `callAi` wrapper at `main.ts:1189-1203`

**Current DB patterns:**
- `Result<T>` at `types.ts:71`: `{ ok: true; data: T } | { ok: false; error: string }`
- Migration runner at `repo.ts:1025-1048`: sequential `NNN_learn.sql` files tracked in `_migrations` table
- Prepared statements at `repo.ts:1051-1083`: `db.prepare('SQL').get()`, `.run()`, `.all()`
- Existing tables: `lessons`, `lesson_nodes`, `lesson_edges`, `evidence`, `tutor_cache`, `mastery_progress`, `curriculum_parts`, `profile_kv` (see `migrations/001_learn.sql` at CONTEXT_BUNDLE.md section 9b)

**New IPC channels needed:**

| Channel | Payload | Returns | Purpose |
|---------|---------|---------|---------|
| `learn:saveNote` | `{ lessonId, nodeId?, blockId?, title, content, source }` | `Result<Note>` | Create a note |
| `learn:getNotes` | `{ lessonId?, nodeId? }` | `Result<Note[]>` | Get notes for lesson/node |
| `learn:deleteNote` | `{ noteId }` | `Result<void>` | Delete a note |
| `learn:proposeAction` | `{ actionType, payload }` | `Result<PendingAction>` | AI proposes an action |
| `learn:approveAction` | `{ actionId }` | `Result<void>` | Approve pending action |
| `learn:rejectAction` | `{ actionId, reason? }` | `Result<void>` | Reject pending action |
| `learn:getPendingActions` | `{ lessonId? }` | `Result<PendingAction[]>` | List pending actions |
| `learn:getConversation` | `{ nodeId }` | `Result<Conversation>` | Get conversation history |
| `learn:addMessage` | `{ nodeId, role, blocks[], metadata? }` | `Result<Message>` | Add message to conversation |
| `learn:getPermissionSettings` | — | `Result<PermissionSettings>` | Get current settings |
| `learn:setPermissionSettings` | `{ settings }` | `Result<void>` | Update settings |
| `learn:getLearnDashboard` | — | `Result<DashboardStats>` | Dashboard data |
| `learn:updateContent` | `{ nodeId, blockId, content }` | `Result<void>` | Apply content edit |

**New DB tables:**

```sql
-- Notes (persistent, not localStorage — current highlights use localStorage via highlightAnchor.ts:568-648)
CREATE TABLE learn_notes (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  node_id TEXT,
  block_id TEXT,
  title TEXT,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'ai' | 'ai_pending'
  color TEXT DEFAULT 'yellow',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES lesson_nodes(id) ON DELETE SET NULL
);

-- Pending actions (confirmation queue)
CREATE TABLE learn_pending_actions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,           -- JSON payload
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  rationale TEXT,                  -- AI's reason for the action
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Conversations (persistent chat history)
CREATE TABLE learn_conversations (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL UNIQUE,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES lesson_nodes(id) ON DELETE CASCADE
);

-- Conversation messages
CREATE TABLE learn_conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'user' | 'assistant' | 'system'
  blocks TEXT NOT NULL,             -- JSON array of TutorBlock
  metadata TEXT,                    -- JSON object (confidence, citations, etc.)
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES learn_conversations(id) ON DELETE CASCADE
);

-- Permission settings
CREATE TABLE learn_permission_settings (
  action_type TEXT PRIMARY KEY,     -- 'create_note' | 'edit_content' | 'insert_block' | 'suggest_exercise'
  mode TEXT NOT NULL DEFAULT 'confirm',  -- 'auto' | 'confirm' | 'blocked'
  updated_at TEXT NOT NULL
);

-- Dashboard stats (computed on request via IPC handler)
-- Return shape: { streak: number, totalMastery: number, recentLessons: [], dueReviews: [], lastLessonId: string }
```

**Service layer additions:**

New service class `NoteService` in `src/services/learn/services/note.service.ts`:
- CRUD for notes
- Create note from AI proposal

New service class `ConversationService` in `src/services/learn/services/conversation.service.ts`:
- Get/create conversation for node
- Add message with block array
- Get conversation history

Extension to `TutorService`:
- `askV2()` that returns `TutorResponse { blocks[], metadata }`
- Action detection and proposal creation

New `PermissionService` in `src/services/learn/services/permission.service.ts`:
- CRUD for permission settings
- Check if action type is allowed

New `LearnDashboardService` in `src/services/learn/services/dashboard.service.ts`:
- Compute streak, mastery, recent lessons, due reviews

### H. AI Call Chain — Streaming Support

**Current (`callProvider.ts:1480-1535`):** No SSE/streaming support. AI call is a direct main-process function call. The `callProvider()` function does:
- HTTP POST with `fetch()` at line 1510
- `AbortController` for timeout at `callProvider.ts:1507-1508` (10s timeout)
- Awaits full response JSON at line 1519
- Returns `CanonicalResponse { content: string; usage?: {...} }` at `types.ts:1560`

**Current (`router.ts:1397-1473`):** `buildChain()` at line 1406 returns an ordered array of providers. `runWithFallback()` at line 1455 tries each provider sequentially, awaiting the full response before returning. No streaming, no partial content delivery to the renderer.

**Current (`TutorPanel.tsx:223-238`):** The "typing effect" is simulated client-side via `useTypingEffect()` — a `setInterval` at 18ms that progressively reveals already-received text. This is fake streaming: all text arrives at once, then is revealed character by character.

**Required:** Implement real streaming (SSE from AI provider → main process → IPC renderer):

1. **Provider layer (`callProvider.ts`):** Add a `callProviderStream()` function that uses `fetch()` with `response.body.getReader()` for SSE-style streaming. Each chunk is parsed for content delta and forwarded.
2. **Router layer (`router.ts`):** Add `runWithFallbackStream()` that yields `ReadableStream<string>` chunks. The fallback chain should also work in streaming mode — if primary provider fails mid-stream, the fallback should start over.
3. **IPC layer:** Add `learn:askTutorStream` channel. Main process streams chunks via `webContents.send('learn:tutorChunk', chunk)` (event-based, not invoke-based). Renderer uses `window.deskflowAPI.onTutorChunk(callback)` via `ipcRenderer.on`.
4. **Renderer (`TutorPanel.tsx`):** Replace `useTypingEffect` with a direct chunk-appending state. New chunks arrive via IPC listener, appended to displayed text. For block-mode responses, full blocks are rendered when their `type` is known.
5. **AbortController at `callProvider.ts:1507`:** Reuse the existing `AbortController` pattern for cancellation — if user closes the tutor panel or asks a new question, abort the in-flight stream.

**Key considerations:**
- The `ProviderTemplate` type at `types.ts:1543` already has `supportsStream?: boolean` at line 1551 — use this flag to determine whether to call `callProviderStream()` vs `callProvider()`
- Existing `buildChain()` return type must be compatible with streaming — the chain order and fallback logic remain the same
- Preload bridge needs a new `onTutorChunk` listener via `ipcRenderer.on('learn:tutorChunk', ...)`
- The `CanonicalResponse` type at `types.ts:1560` may need a stream variant

## Constraints

1. **No breaking changes to existing data.** Existing lessons, nodes, progress, and highlights must continue to work. New features layer on top. The `renderAnswerHtml` function (`TutorPanel.tsx:204-221`) and `TutorAnswer.answer_md` field (`types.ts:80`) must be kept as fallback for backward compatibility, but the primary flow should use the new block-based format.

2. **Build commands:**
   - Preload must be rebuilt: `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs`
   - Main process must be rebuilt: `node scripts/rebuild-main.mjs`
   - Vite build: `npx vite build` (for renderer changes)

3. **All `localStorage` access must be wrapped in try/catch** (existing pattern at `highlightAnchor.ts:592-598` and `highlightAnchor.ts:603-607`). The new notes system must use SQLite, not localStorage.

4. **Dark mode only.** All colors use the `bg-zinc-*` / `text-zinc-*` palette with clay/amber accents. Custom tokens at `src/index.css:1989-1996`: `--color-clay-*`, `--color-sage-400`, `--color-amber-400`, `--color-sky-400`.

5. **Re-skin rule:** Any component sourced from external libraries (shadcn, Magic UI, React Bits) must be re-skinned with DeskFlow design tokens before use. See Section 20 of CONTEXT_BUNDLE.md for the re-skin checklist.

6. **No new npm dependencies unless absolutely necessary.** Framer Motion is already available (used at `TutorPanel.tsx:189`, `LearnPage.tsx:1687`). React Bits and Magic UI require adding their packages.

7. **CRLF line endings** — preserve existing line endings, do not mass-reformat.

8. **Tailwind v4** — `@import "tailwindcss"` in `src/index.css:1976`. No `tailwind.config.*` file. Custom tokens in `@theme` block.

## AI Call Chain Summary (visual reference)

```
Current flow (no streaming):
  Renderer (TutorPanel.tsx:251)
    → ipcRenderer.invoke('learn:askTutor', ...)   [preload.ts:745-746]
      → ipcMain.handle('learn:askTutor')            [index.ts:950]
        → TutorService.ask()                        [tutor.service.ts:1270]
          → GroundingService.retrieve()             [tutor.service.ts:1281]
          → this.callAi(prompt, systemPrompt)       [tutor.service.ts:1304]
            → callProvider() HTTP POST              [callProvider.ts:1510]
              → await response.json()               [callProvider.ts:1519]
                → return { content, usage }
      ← TutorAnswer (full response)
    ← setTutorAnswer(data)                          [LearnPage.tsx:1831]
      → renderAnswerHtml(useTypingEffect(...))       [TutorPanel.tsx:306]

Required flow (streaming):
  Renderer
    → ipcRenderer.invoke('learn:askTutorStream', ...)
      → TutorService.askStream()
        → callProviderStream() (SSE via fetch reader)
          → webContents.send('learn:tutorChunk', chunk)
            → ipcRenderer.on('learn:tutorChunk', appendChunk)
  ← Progressive block rendering (no useTypingEffect needed)
```

## Output Format

Save the design to `agent/docs/ai-tutor-revamp/RESULT.md`. Structure it as:

```markdown
# RESULT: Lyceum AI Tutor Overhaul

## Phase 1: [Core Foundation — response parsing + backend]
### 1.1 [Feature name]
- Files affected
- Changes needed
- Data structures
- Implementation order
...

## Phase 2: [Action System + Confirmation]
...

## Phase 3: [Chatbot UI Revamp]
...

## Phase 4: [Dashboard Integration]
...

## Phase 5: [Polish + Settings]
...
```

For each item, specify:
- **Exact file paths** (from CONTEXT_BUNDLE.md)
- **Code changes** — what to add, remove, or modify in each file
- **New types/interfaces** — full TypeScript definitions
- **DB schema** — exact SQL (follow migration pattern at `repo.ts:1025-1048`)
- **IPC channels** — exact signatures (follow pattern at `preload.ts:712-787`)
- **UI components** — exact props, states (empty/loading/error/populated), animations
- **Verification** — how to manually test each feature

## MCP Inventory

The following libraries are available for UI components. Re-skin everything to DeskFlow tokens (see Section 20 of CONTEXT_BUNDLE.md).

| Component | Source | Use For |
|-----------|--------|---------|
| Particles | Magic UI | Background ambiance on tutor panel or dashboard |
| Shimmer Button | Magic UI | CTA buttons (Continue Learning, Save Note) |
| Magic Card | Magic UI | Proposal cards, highlight cards |
| Shine Border | Magic UI | Active/pending action indicators |
| Border Beam | Magic UI | Animated borders on active content |
| Blur Fade | Magic UI | Message entrance animations |
| Hyper Text | Magic UI | Scramble/reveal effect on AI thinking indicator |
| Morphing Text | Magic UI | Status text transitions |
| Bento Grid | Magic UI | Dashboard learning stats layout |

## Anti-Slop Checklist

After sourcing any component from MCP:
1. Re-skin to DeskFlow tokens (colors → bg-zinc-*, text-zinc-*, clay/amber accent)
2. Max rounded-xl, p-5 padding
3. Dark mode only
4. Geist (body) + JetBrains Mono (code) fonts
5. Glass layer: `bg-zinc-900/80 backdrop-blur-xl`
6. Ease curve: `[0.16, 1, 0.3, 1]`
7. Every component handles empty/loading/error/populated states
8. Animate all state transitions
9. No default library styling visible
10. Icons from Lucide (already in project)

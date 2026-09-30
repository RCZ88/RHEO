# Workspace Architecture & Planning Document

**Date:** 2026-05-03
**Version:** 1.80
**Purpose:** Document workspace/terminal page architecture for AI continuity

---

## Overview

The workspace page (`TerminalPage.tsx`) is the central development environment in DeskFlow. It combines:
- Multi-pane terminal (via `TerminalLayout` / `TerminalWindow.tsx`)
- Sidebar with 7 tabs: Presets, Sessions, Todos, Files, Prompts, Map, Analytics
- Chat context/session history viewing
- Project-specific context (cwd, presets, sessions, todos)

---

## Architecture

### File Structure

```
src/pages/TerminalPage.tsx          # Main workspace page (sidebar + terminal area)
src/components/TerminalWindow.tsx   # TerminalLayout + TerminalPane (xterm.js)
src/hooks/useTerminalLayout.ts      # Layout persistence via SQLite
src/main.ts                         # IPC handlers + terminalManager (node-pty)
src/preload.ts                      # Exposed APIs to renderer
```

### Data Flow

```
User Action → TerminalPage State → IPC Invoke → main.ts Handler → SQLite/node-pty
                                                    ↓
                                           Response → TerminalPage State Update → UI Render
```

### Terminal Spawning Flow

1. `TerminalPane` mounts → calls `onTerminalReady(terminalId, terminal)`
2. `TerminalLayout.handleTerminalReady()` checks `spawnedTerminals` Set (in-memory!)
3. If not spawned, calls `spawnTerminal(terminalId, cwd)`
4. `spawnTerminal` calls `terminalAPI.create(terminalId, cwd, 80, 24)` via IPC
5. `main.ts terminal:create` handler calls `terminalManager.spawn()`
6. `terminalManager` spawns `node-pty` process, attaches `onData`/`onExit` immediately
7. Data is buffered if no frontend callback registered yet
8. `getDataHandler()` flushes buffered data when frontend registers callback
9. Frontend `onTerminalData` receives data and writes to xterm.js
10. First data arrival clears placeholder text

### Conductor Orchestration Flow

1. `ConductorService` lives in main process (`src/services/conductor/ConductorService.ts`)
2. Host interface (`ConductorHost`) provides `spawnAgentTerminal`, `writeTerminal`, `killTerminal`, `isAgentReady`, `broadcast`
3. **Critical:** `spawnAgentTerminal` spawns PTY directly via `terminalManager.spawn()` — does NOT depend on renderer
4. Renderer notification (`terminal:spawn-for-conductor`) is best-effort only
5. Missions managed via `Map<string, Mission>` with nodes, messages, escalations, pending children
6. IPC handlers: `conductor:start`, `conductor:pause`, `conductor:resume`, `conductor:kill`, `conductor:send-directive`

**CRITICAL:** `spawnedTerminals` is an in-memory `Set`, NOT localStorage. localStorage persisted across app restarts and caused terminals to never spawn again.

---

## Database Schema (Workspace-Related)

### Existing Tables
- `terminal_layouts` - Saved pane layouts per project
- `terminal_presets` - Command presets (name, command, category, project_id)
- `terminal_sessions` - AI chat sessions (agent, resume_id, topic, working_directory, cost, tokens)

### New Tables (Added 2026-05-03)
- `workspace_todos` - Todo items per project (text, completed, priority)
- `prompt_templates` - Reusable prompts and formatting templates (name, content, category, is_formatting_template)

---

## IPC Endpoints (Workspace)

### Terminal
- `terminal:create` - Spawn PTY shell (with cwd)
- `terminal:write` - Write to PTY stdin
- `terminal:resize` - Resize PTY
- `terminal:destroy` - Kill PTY process

### Presets
- `get-terminal-presets` - List presets (optional project filter)
- `add-terminal-preset` - Create preset
- `remove-terminal-preset` - Delete preset
- `execute-terminal-preset` - Returns command string (NOT executed automatically)

### Sessions
- `get-terminal-sessions` - List sessions (optional project/limit filter)
- `get-terminal-session-resume-id` - Get resume ID for session
- `save-terminal-session` - Record new session
- `get-session-messages` - **NEW** Read chat messages from AI tool storage (OpenCode SQLite, Claude Code JSONL, Codex JSONL)

### Todos
- `get-workspace-todos` - List todos
- `add-workspace-todo` - Create todo
- `toggle-workspace-todo` - Toggle completed status
- `delete-workspace-todo` - Remove todo

### Prompts
- `get-prompt-templates` - List prompts
- `save-prompt-template` - Create/update prompt
- `delete-prompt-template` - Remove prompt

### Files
- `read-agent-file` - Read markdown file from agent/ directory
- `list-agent-files` - List files in agent/ subdirectory

### Layouts
- `get-terminal-layouts` - Load saved layouts
- `save-terminal-layout` - Save layout
- `delete-terminal-layout` - Remove layout

---

## Sidebar Tabs

| Tab | Functionality | Status |
|-----|--------------|--------|
| **Presets** | Save/run command presets. Click play to execute in active terminal. | ✅ Working |
| **Sessions** | View AI chat sessions. Click session to see message history (chat bubbles). Start/Resume buttons launch agent in terminal. | ✅ Working |
| **Todos** | Task list with priorities (low/medium/high). Toggle completion. Per-project. | ✅ Working |
| **Files** | Browse agent/ directory. View markdown files (state.md, PROBLEMS.md, etc.). | ✅ Working |
| **Prompts** | Save reusable prompts and formatting templates. Copy to clipboard or insert into terminal. | ✅ Working |
| **Map** | Visual grid of terminal panes. Click to focus. | ✅ Working |
| **Analytics** | AI usage stats (tokens, cost, by agent). | ✅ Working |

---

## Chat Context / Session History

### How It Works

1. User clicks a session in Sessions tab
2. Frontend calls `getSessionMessages(sessionId, agentType)` via IPC
3. Backend tries multiple sources:
   - **OpenCode:** Reads `~/.local/share/opencode/opencode.db` SQLite, `message` table
   - **Claude Code:** Reads `~/.claude/sessions/*.jsonl`
   - **Codex:** Reads `~/.codex/sessions/*.jsonl`
4. Returns standardized format: `{ role, content, timestamp, model }[]`
5. Frontend renders as chat bubbles (user right, assistant left, system yellow)

### Message Parsing Logic

Each AI tool stores messages differently:
- **OpenCode:** SQLite `message` table, `data` column is JSON. Message content in `data.message.role` and `data.message.content`
- **Claude Code:** JSONL format. Each line has `type: 'message'` with `message.role` and `message.content`
- **Codex:** JSONL format. Each line has `role` and `content` directly

The `get-session-messages` handler tries all formats and returns whatever succeeds first.

---

## Active Terminal Tracking

Problem: Multiple terminal panes exist. Presets and prompts need to write to the CORRECT terminal.

Solution:
- `TerminalLayout` tracks `activeTerminal` state (which pane has focus/ring)
- `onActiveTerminalChange` callback propagates active terminal ID up to `TerminalPage`
- `TerminalPage` stores `activeTerminalId` and passes it to preset/prompt handlers
- All write operations use `activeTerminalId || 'term-initial'` as target

---

## Terminal Splitting

### Current Implementation
- `TerminalLayout` uses recursive `PaneNode` tree structure
- `splitPane(parentId, direction)` creates new pane + spawns terminal
- `closePane(paneId)` removes pane and reparents
- `SplitControls` overlay shows on hover (split left/right/top/bottom, close)
- `SplitHandle` visual divider between panes

### Layout Persistence
- `useTerminalLayout` hook loads/saves layout to SQLite `terminal_layouts` table
- Layout saved automatically 1 second after change (debounced)
- Per-project layouts supported

### Known Limitations
- Split resize via drag is visual only (no actual resize logic)
- Layout saving may fail silently (errors caught and ignored)

---

## Prompt Engineering Workspace

### How Prompts Work
1. User creates prompt with name, content, optional category
2. Saved to SQLite `prompt_templates` table
3. Two actions available:
   - **Copy:** Copies prompt content to clipboard (2-second checkmark feedback)
   - **Insert:** Writes prompt content directly into active terminal via `terminalAPI.write()`

### Future Enhancements (Not Yet Implemented)
- File-based prompt storage in `agent/docs/promptname-date/PROMPT.md`
- Result files (`result.md`) linked to prompts
- Prompt categories/folders
- Search within prompt content (not just name/category)

---

## Data Models

### Session (from DB)
```typescript
interface Session {
  id: string;
  agent: string;          // 'claude', 'opencode', 'codex', etc.
  topic: string;
  resume_id?: string;     // For resuming the chat
  started_at: string;
  total_cost_usd?: number;
}
```

### ChatMessage (from AI tool storage)
```typescript
interface ChatMessage {
  role: string;           // 'user', 'assistant', 'system', 'tool'
  content: string;
  timestamp?: string;
  model?: string;
}
```

### Todo
```typescript
interface Todo {
  id: string;
  project_id?: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}
```

### PromptTemplate
```typescript
interface PromptTemplate {
  id: string;
  project_id?: string;
  name: string;
  content: string;
  category?: string;
  is_formatting_template: boolean;
  created_at: string;
}
```

---

## Future Work / TODO for Next AI

### High Priority
1. **Fix terminal split resize dragging** - Currently visual only, needs actual pane size update
2. **Add session message real-time sync** - Currently loads once on click; should auto-refresh for active sessions
3. **Improve message parsing** - Handle more edge cases in Claude/Codex JSONL formats; extract tool calls
4. **Add chat input in sidebar** - Allow typing messages directly in the session view that get sent to the terminal

### Medium Priority
5. **File-based prompt storage** - Save prompts to `agent/docs/` as markdown files instead of/in addition to SQLite
6. **Prompt result tracking** - Link results (`result.md`) to prompts; show result history
7. **Better agent file viewer** - Syntax highlighting, edit capability, file tree navigation
8. **Session search** - Search across session topics and message content

### Low Priority
9. **Analytics charts** - Replace text stats with Recharts visualizations
10. **Todo due dates** - Add scheduling to todos
11. **Workspace templates** - Save entire workspace states (layout + open files + todos) as templates

---

## Backup System

Backup functionality lives in `src/main/backup/BackupService.ts` (360 lines). Provides:

### Features
- **DB Backup:** WAL checkpoint before copy, gzip compression, SHA256 manifest, integrity verification
- **Retention:** Hourly (24), daily (14), weekly (8), monthly (12) buckets with pruning
- **Mirror:** Optional mirror directory for redundant copies
- **Scheduling:** Startup/interval/quit/manual/pre-restore triggers
- **Restore:** Integrity-checked restore with previous DB preserved as `.replaced-*.db`
- **Export:** JSON and CSV exports of all tables

### Settings
Controlled via `backup-settings.json` in userData:
- `autoBackup`: boolean (default true) — toggles interval scheduler
- `mirrorDir`: string — optional mirror path
- `retention`: { hourly, daily, weekly, monthly }

### IPC Handlers
`backup:create`, `backup:list`, `backup:restore`, `backup:exportJSON`, `backup:exportCSV`, `backup:status`, `backup:verify`, `backup:settings:get`, `backup:settings:set`, `backup:pickMirrorDir`

**Note:** `startBackupScheduler` respects `autoBackup:false` — if disabled, no interval timer starts.

---

## Critical Rules for Future Development

1. **NEVER use localStorage for terminal spawn tracking** - Use the in-memory `spawnedTerminals` Set only
2. **Always clean up IPC listeners** - `onTerminalData` returns cleanup function; must call on unmount
3. **Buffer PTY data properly** - `proc.onData` must be attached IMMEDIATELY in `spawn()`, not deferred
4. **Presets write to active terminal** - Always use `activeTerminalId`, never hardcode `'term-initial'`
5. **Project context flows via props** - `projectId` + `projectPath` props ensure correct directory/context

---

**Last Updated:** 2026-05-03
**Maintained By:** AI Development Team

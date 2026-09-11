# RESULT.md Extension — All Gaps Covered

This document extends the original RESULT.md to cover every gap identified in the uncovered-gaps audit. Items are inserted into the appropriate existing phase or into a new Phase 7.

---

## Additions to Phase 1: Core Flows

### Fix 1.5: Skills Pipeline Verification (Bug #19 / Task L)

After Fix 1 wires `onSend` and Fix 2 unifies context assembly, verify the full skills pipeline:

**InstructionPanel skill selector:**

The `InstructionPanel` component has a skill dropdown that populates via `deskflowAPI.getSkills()`. When a skill is selected and the user clicks Send, `handleInstructionPanelSend` must append the skill content:

```typescript
// In handleInstructionPanelSend — already covered in Fix 1 but verify this section:
if (config.skillId) {
  const skill = skills.find(s => s.id === config.skillId || s.name === config.skillId);
  if (skill) {
    // Append full skill content (not just the name)
    composedPrompt += `\n\n--- Skill: ${skill.name} ---\n${skill.content || skill.description}`;
  }
}
```

**Setup dialog skill toggle:**

The `ctxSkills` toggle in NewSessionDialog controls `contextConfig.systems.obsidian_skills.enabled`. When enabled, `assembleContext()` calls `buildSkillIndex()` which includes skill names and descriptions (not full content) in the init context. This is correct — skill *index* goes in the system prompt, skill *content* goes in the per-message instruction.

**Verification test:**
1. Open Setup dialog → toggle Skills ON → create session → verify session init contains skill index
2. Open InstructionPanel → select a skill → click Send → verify the sent message includes skill content
3. Toggle Skills OFF → create session → verify NO skill index in init content

---

### Fix 1.6: FlowView Audit & Wiring (Bug #18 / Task K)

**File:** `src/components/FlowView.tsx`

Audit the FlowView component to determine its current state and wire it:

```typescript
// FlowView should call ProblemsService via IPC when a problem node is created
// Current state: likely uses a local state or partial IPC call

// REQUIRED wiring in FlowView:
async function handleCreateProblemFromFlow(problemData: {
  title: string;
  priority?: string;
  category?: string;
  description?: string;
}) {
  try {
    const problemId = await deskflowAPI.createProblem({
      title: problemData.title,
      priority: problemData.priority || 'medium',
      category: problemData.category || 'other',
      description: problemData.description,
      projectId: selectedProjectId,
      sessionId: activeSessionId,
    });
    
    // Problem created — UI refresh happens via context-changed event (Fix 5)
    // Optionally assign to current terminal
    if (activeTerminalId) {
      await deskflowAPI.updateTerminalBinding({
        terminalId: activeTerminalId,
        activeProblemId: problemId,
      });
    }
    
    return problemId;
  } catch (e) {
    console.error('FlowView problem creation failed:', e);
    return null;
  }
}
```

If FlowView doesn't exist as a functional component (only a placeholder), add a note:

> **FlowView Status:** If `FlowView.tsx` is a placeholder or stub with no functional problem creation, add this to Phase 7 as a new feature implementation. The IPC wiring above is the target architecture — apply it when the component is built out.

---

### Fix 1.7: Status Change → Terminal Message Format (Bug #49)

**File:** `src/pages/TerminalPage.tsx`

The `context-changed` handler writes `[System: Problem updated: ...]` to the active terminal. This can cause formatting issues because agents may interpret markdown or special characters in the message.

**Current (likely broken):**
```typescript
deskflowAPI.terminalWrite(terminalId, `[System: Problem updated: ${problem.title}]\n`);
```

**Fixed format:**
```typescript
// System messages to the terminal must be:
// 1. Plain text only (no markdown)
// 2. Single line (no \n that might be interpreted as submit)
// 3. Clearly delimited so the agent knows it's not user input
// 4. Use \r not \n (carriage return = submit in most agents)

const systemMessage = `[SYSTEM: Problem #${problem.id} status changed to "${problem.status}"]`;
deskflowAPI.terminalWriteRaw(terminalId, systemMessage + '\r');
```

Key differences:
- `terminalWriteRaw` instead of `terminalWrite` — don't record as a user message in DB
- No markdown formatting (no **bold**, no backticks)
- No newlines within the message
- Square bracket delimiters are universally recognized as system messages by agents
- Include problem ID for traceability

---

## Additions to Phase 2: Session Creation

### Fix 2.5: Init vs Setup Mode Distinction (Bug #14 / Task H)

**File:** `src/components/NewSessionDialog.tsx`

Two distinct modes with different UX:

```typescript
interface NewSessionDialogProps {
  mode: 'initialize' | 'setup';
  onClose: () => void;
  onCreate: (config: SessionCreateConfig) => void;
  projectPath?: string;
}
```

**`mode='initialize'` — Quick Init:**
- Shows: agent selector + "Initialize" button only
- Hides: all 6 toggle cards, file selectors, system prompt editor, prompt preview
- Uses: `DEFAULT_CONTEXT_CONFIG` (all systems on with default settings)
- Flow: click Initialize → `tracker-mind-setup init-all` → `assembleContext(DEFAULT_CONTEXT_CONFIG)` → spawn → done
- No configuration — just pick an agent and go

**`mode='setup'` — Full Setup:**
- Shows: everything — 6 toggle cards, file selectors per system, system prompt editor, prompt preview, context map
- Uses: user-customized `contextConfig` from toggle state
- Flow: configure → preview → click Create → `tracker-mind-setup init-all` → `assembleContext(customConfig)` → spawn → done

**Which button opens which mode:**
- Header "Setup" button → `mode='setup'` (full configuration)
- New "Quick Init" button in header → `mode='initialize'` (one-click)
- "+" tab button → `mode='initialize'` (fastest path, uses defaults)
- Session list "Resume" → skips dialog entirely (resumes directly)

```tsx
// In NewSessionDialog.tsx:
const isQuickMode = mode === 'initialize';

return (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 ...">
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 w-[520px] ...">
      <h2 className="text-[14px] text-zinc-200 font-medium font-syne">
        {isQuickMode ? 'Quick Initialize' : 'Setup Agent Workspace'}
      </h2>

      {/* Agent selector — always visible */}
      <AgentSelector value={selectedAgent} onChange={setSelectedAgent} />

      {/* Toggle cards — only in setup mode */}
      {!isQuickMode && (
        <div className="mt-4 space-y-2">
          <ContextToggleCards config={contextConfig} onToggle={handleToggle} />
          <ContextMapVisualization systems={systems} config={contextConfig} />
          <PromptPreviewButton onClick={buildPromptPreview} />
        </div>
      )}

      {/* Create button */}
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="...">Cancel</button>
        <button onClick={handleCreate} className="...">
          {isQuickMode ? 'Initialize' : 'Create Session'}
        </button>
      </div>
    </div>
  </div>
);
```

**Header button wiring in TerminalPage.tsx:**

```typescript
// "Setup" button → full setup
<button onClick={() => setShowNewSessionDialog({ mode: 'setup' })}>
  <Settings className="w-4 h-4" />
  Setup
</button>

// "Quick Init" button → fast init
<button onClick={() => setShowNewSessionDialog({ mode: 'initialize' })}>
  <Zap className="w-4 h-4" />
  Quick Init
</button>
```

---

### Fix 2.6: Agent Selection Defaults Unification (Bug #38)

**File:** `src/pages/TerminalPage.tsx`

Single source of truth for default agent:

```typescript
// Add this utility function at the top of TerminalPage.tsx
function getDefaultAgent(): string {
  return localStorage.getItem('terminal-defaultAgent') || 'claude';
}

function setDefaultAgent(agent: string): void {
  localStorage.setItem('terminal-defaultAgent', agent);
}
```

Replace ALL hardcoded agent defaults with `getDefaultAgent()`:

```typescript
// Line ~1233 (header "Open Terminal"):
const agent = getDefaultAgent();  // was: localStorage.getItem('terminal-defaultAgent') || 'claude'

// Line ~883 (initializeSession):
const agent = getDefaultAgent();  // was: config.agentType || 'claude'

// NewSessionDialog — on mount:
const [selectedAgent, setSelectedAgent] = useState(getDefaultAgent());

// On agent change in dialog:
const handleAgentChange = (agent: string) => {
  setSelectedAgent(agent);
  setDefaultAgent(agent);  // Persist immediately
};
```

---

### Fix 2.7: Agent Selection Dropdown Population (Bug #24)

**File:** `src/components/NewSessionDialog.tsx`

The dropdown needs a list of supported agents:

```typescript
const SUPPORTED_AGENTS = [
  { id: 'claude', name: 'Claude Code', command: 'claude' },
  { id: 'opencode', name: 'OpenCode', command: 'opencode' },
  { id: 'aider', name: 'Aider', command: 'aider' },
  { id: 'codex', name: 'Codex CLI', command: 'codex' },
  { id: 'gemini', name: 'Gemini CLI', command: 'gemini' },
];

// In the dialog:
<select
  value={selectedAgent}
  onChange={(e) => handleAgentChange(e.target.value)}
  className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 
             text-[11px] text-zinc-300 focus:border-cyan-500/50 focus:outline-none"
>
  {SUPPORTED_AGENTS.map(agent => (
    <option key={agent.id} value={agent.id}>
      {agent.name}
    </option>
  ))}
</select>
```

Also use `SUPPORTED_AGENTS` in Settings page agent selector (same list, same source).

---

### Fix 2.8: Existing Session ID Input (Bug #27)

**File:** `src/components/NewSessionDialog.tsx`

Add an optional "Resume Session" field:

```tsx
{/* Session ID input — optional, for resuming existing sessions */}
<div className="mt-3">
  <label className="text-[10px] text-zinc-500">Resume Session ID (optional)</label>
  <input
    type="text"
    value={resumeSessionId}
    onChange={(e) => setResumeSessionId(e.target.value)}
    placeholder="Paste session ID to resume..."
    className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 
               text-[11px] text-zinc-300 placeholder:text-zinc-700 
               focus:border-cyan-500/50 focus:outline-none"
  />
  {resumeSessionId && (
    <button
      onClick={async () => {
        const session = await deskflowAPI.getTerminalSessions(undefined, 100)
          .then(s => s.find(s => s.id === resumeSessionId || s.id.startsWith(resumeSessionId)));
        if (session) {
          setSelectedAgent(session.agent || 'claude');
          setResumeSession(session);
        } else {
          setError('Session not found');
        }
      }}
      className="mt-1 text-[9px] text-cyan-400 hover:text-cyan-300"
    >
      Lookup session
    </button>
  )}
</div>
```

**In `handleCreateSession`:**

```typescript
if (resumeSessionId && resumeSession) {
  // Resume existing session — don't create a new one
  const terminalId = generateTerminalId();
  dispatchCreateTerminal(terminalId, resumeSession.agent);
  
  // Queue resume command
  const resumeId = resumeSession.resume_id || resumeSession.id;
  messageQueueRef.current.set(terminalId, [
    { terminalId, content: getAgentLaunchCommand(resumeSession.agent, resumeId), timestamp: Date.now(), isLaunchCommand: true },
  ]);
  
  // Update session with new terminal_id
  await deskflowAPI.saveTerminalSession({
    ...resumeSession,
    terminal_id: terminalId,
    status: 'active',
  });
} else {
  // Create new session (existing flow from Fix 2)
  // ...
}
```

---

### Fix 2.9: Session List Audit (Bug #30)

**File:** `src/pages/TerminalPage.tsx`

Audit `loadSessions()` to ensure ALL sessions appear:

```typescript
const loadSessions = useCallback(async () => {
  try {
    // Current query may have a LIMIT or date filter — remove it
    const allSessions = await deskflowAPI.getTerminalSessions(
      selectedProjectId || undefined,
      500  // High limit — show everything
    );
    
    // Don't filter out sessions without a topic — they're still valid
    setSessions(allSessions || []);
  } catch (e) {
    console.error('loadSessions failed:', e);
    setSessions([]);
  }
}, [selectedProjectId]);
```

**File:** `src/main.ts` — verify the `get-terminal-sessions` handler doesn't filter:

```typescript
ipcMain.handle('get-terminal-sessions', async (_event, projectId?: string, limit?: number) => {
  const db = getDatabase();
  if (!db) return [];
  
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const projectFilter = projectId ? `WHERE project_id = '${projectId}'` : '';
  
  return db.prepare(`
    SELECT * FROM terminal_sessions 
    ${projectFilter}
    ORDER BY updated_at DESC, created_at DESC
    ${limitClause}
  `).all();
});
```

---

## Additions to Phase 3: IPC Bridges

### Fix 3.5: Verify `sendInstructionsToTerminal` Handler (Bug #9)

**File:** `src/main.ts`

Search for the handler. If it doesn't exist, add it:

```typescript
ipcMain.handle('send-instructions-to-terminal', async (_event, data: {
  terminalId: string;
  instructions: string;
  linkedProblemId?: string;
  linkedRequestId?: string;
}) => {
  const info = terminalManager.get(data.terminalId);
  if (!info?.pty) {
    return { success: false, error: 'Terminal not found' };
  }

  // Write instructions to the PTY
  info.pty.write(data.instructions + '\r');

  // Update binding if linked entities provided
  if (data.linkedProblemId || data.linkedRequestId) {
    const db = getDatabase();
    if (db) {
      db.prepare(`
        UPDATE terminal_bindings 
        SET active_problem_id = ?, active_request_id = ?, last_activity_at = datetime('now')
        WHERE terminal_id = ?
      `).run(data.linkedProblemId || null, data.linkedRequestId || null, data.terminalId);
    }
  }

  return { success: true };
});
```

---

### Fix 3.6: `tracker-mind-generate` Command (Bug #16)

**File:** `src/main.ts`

Search for this handler:

```bash
grep -n "tracker-mind-generate\|trackerMindGenerate\|mind.*generate" src/main.ts
```

If found, document what it does. If not found, it may be a planned feature that was never implemented. Decision: **Skip for now.** The setup flow uses `tracker-mind-setup init-all` which is sufficient. `tracker-mind-generate` was likely intended for generating content (like PROBLEMS.md from DB data) but `tracker-mind-setup` already covers this with its `step=problems` parameter.

Add a comment in main.ts:

```typescript
// TODO: tracker-mind-generate — if needed, implement as a separate IPC handler
// that generates specific files (PROBLEMS.md, REQUESTS.md) from DB data.
// Currently covered by tracker-mind-setup with step parameter.
```

---

## Additions to Phase 4: Prompt Preview & Compose

### Fix 4.5: Always-Updating Context — Delta Messages (Bug #33)

**File:** `src/pages/TerminalPage.tsx`

After Fix 5 adds `context-changed` events, the handler that writes to the terminal must include meaningful delta information, not just "something changed":

```typescript
// In the context-changed handler:
useEffect(() => {
  const cleanup = deskflowAPI.onContextChanged(async (data) => {
    // Refresh local data
    switch (data.type) {
      case 'problems':
        await loadProblems();
        break;
      case 'requests':
        await loadRequests();
        break;
      case 'checklists':
        await loadChecklists();
        break;
    }

    // Notify the active terminal's agent about the change
    if (activeTerminalId && agentReadyRef.current.get(activeTerminalId)) {
      let deltaMessage = '';
      
      switch (data.type) {
        case 'problems':
          deltaMessage = `[SYSTEM: Problem list updated — ${data.action}]`;
          if (data.entity) {
            deltaMessage = `[SYSTEM: Problem #${data.entity.id} "${data.entity.title}" status changed to "${data.entity.status}"]`;
          }
          break;
        case 'requests':
          deltaMessage = `[SYSTEM: Request list updated — ${data.action}]`;
          if (data.entity) {
            deltaMessage = `[SYSTEM: Request #${data.entity.id} "${data.entity.title}" status changed to "${data.entity.status}"]`;
          }
          break;
        case 'checklists':
          deltaMessage = `[SYSTEM: Checklist updated — ${data.action}]`;
          break;
      }
      
      if (deltaMessage) {
        // Use terminalWriteRaw — don't record as user message
        deskflowAPI.terminalWriteRaw(activeTerminalId, deltaMessage + '\r');
      }
    }
  });
  return cleanup;
}, [activeTerminalId]);
```

**File:** `src/main.ts` — Enhance `context-changed` events to include entity data:

```typescript
// In executeActionsFromFile — after each action:
win.webContents.send('context-changed', {
  type: 'problems',
  action: 'created',
  entity: { id: newProblemId, title: action.data.title, status: action.data.status || 'open' },
});
```

---

## Additions to Phase 6: UI Polish

### Fix 6.5: Closing Session Blinking (Bug #23)

**File:** `src/pages/TerminalPage.tsx`

The blink happens because `closeTerminal()` triggers multiple state updates that cause cascade re-renders:

```typescript
// CURRENT (causes blink):
const closeTerminal = (terminalId: string) => {
  setTerminalTabs(prev => { /* remove tab */ });        // Render 1
  setTerminalLayout(prev => removePane(prev, terminalId)); // Render 2
  setActiveTerminalId(nextActive);                          // Render 3
  setSessions(prev => prev.filter(s => s.terminal_id !== terminalId)); // Render 4
};

// FIXED — batch all updates and use React.startTransition:
const closeTerminal = useCallback((terminalId: string) => {
  // Compute all new state values first (no intermediate renders)
  const newTabs = { ...terminalTabs };
  delete newTabs[terminalId];
  
  const newLayout = terminalLayout ? removePane(terminalLayout, terminalId) : null;
  
  const remainingIds = Object.keys(newTabs);
  const newActiveId = activeTerminalId === terminalId 
    ? (remainingIds[0] || null) 
    : activeTerminalId;

  // Apply all state updates in a single batch
  React.startTransition(() => {
    setTerminalTabs(newTabs);
    setTerminalLayout(newLayout);
    setActiveTerminalId(newActiveId);
  });

  // Non-urgent: update sessions list
  deskflowAPI.saveTerminalSession({
    id: sessions.find(s => s.terminal_id === terminalId)?.id,
    status: 'completed',
  }).then(() => loadSessions());
}, [terminalTabs, terminalLayout, activeTerminalId, sessions]);
```

Also wrap the terminal tab component in `React.memo`:

```typescript
const TerminalTab = React.memo(({ terminalId, agent, isActive, onSelect, onClose }: ...) => {
  // ... existing tab rendering
}, (prev, next) => {
  return prev.terminalId === next.terminalId && prev.isActive === next.isActive;
});
```

---

### Fix 6.6: Product Area / Category as Visible Tags (Bug #25)

**File:** `src/pages/TerminalPage.tsx`

The `product_area` and `category` fields are stored but not displayed. Add them as tags on session cards:

```tsx
// In session card rendering:
<div className="flex items-center gap-1 mt-1">
  {session.category && (
    <CategoryBadge category={session.category} />
  )}
  {session.product_area && (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/20">
      {session.product_area}
    </span>
  )}
</div>
```

Add filter pills in the session list header:

```tsx
<div className="flex gap-1 mb-2">
  {['all', 'bug-fix', 'feature', 'refactor', 'research', 'review'].map(cat => (
    <button key={cat}
      className={`text-[9px] px-1.5 py-0.5 rounded-full
        ${sessionFilter === cat ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-500'}`}
      onClick={() => setSessionFilter(cat)}>
      {cat === 'all' ? 'All' : cat}
    </button>
  ))}
</div>
```

---

### Fix 6.7: Problem-Request Linking UI (Bug #50)

**File:** `src/components/ProblemDetailModal.tsx`

Add a "Related Requests" section:

```tsx
<div className="mt-3 border-t border-zinc-700/30 pt-2">
  <div className="text-[10px] text-zinc-500 mb-1">Related Requests</div>
  
  {/* Show linked requests */}
  {linkedRequests.map(req => (
    <div key={req.id} className="flex items-center gap-2 text-[10px] py-0.5">
      <LinkIcon className="w-2.5 h-2.5 text-zinc-600" />
      <span className="text-zinc-400">{req.title}</span>
      <span className="text-zinc-600">#{req.id}</span>
      <button onClick={() => unlinkProblemFromRequest(problem.id, req.id)}
        className="text-red-500/50 hover:text-red-400 ml-auto">
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  ))}
  
  {/* Add link */}
  <select
    onChange={(e) => {
      if (e.target.value) linkProblemToRequest(problem.id, e.target.value);
      e.target.value = '';
    }}
    className="mt-1 bg-zinc-900/50 border border-zinc-700/50 rounded px-2 py-0.5 
               text-[9px] text-zinc-500 w-full">
    <option value="">Link a request...</option>
    {unlinkedRequests.map(req => (
      <option key={req.id} value={req.id}>{req.title}</option>
    ))}
  </select>
</div>
```

---

### Fix 6.8: Problem/Request Modal Styling (Bug #53)

**File:** `src/components/ProblemDetailModal.tsx`

Apply consistent zinc/dark theme styling:

```tsx
// Modal wrapper
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 
                flex items-center justify-center"
     onClick={onClose}>
  <div className="bg-zinc-800 border border-zinc-700/50 rounded-xl 
                  w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl"
       onClick={(e) => e.stopPropagation()}>
    
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b border-zinc-700/30">
      <h3 className="text-[13px] text-zinc-200 font-medium font-syne">
        Problem Details
      </h3>
      <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400">
        <X className="w-4 h-4" />
      </button>
    </div>
    
    {/* Content — uses Fix 22 status badges and category tags */}
    <div className="p-4 space-y-3">
      {/* Title */}
      <div className="text-[12px] text-zinc-300">{problem.title}</div>
      
      {/* Status + Priority + Category row */}
      <div className="flex items-center gap-2">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[problem.status]}`}>
          {problem.status}
        </span>
        <span className="text-[10px]">{PRIORITY_INDICATORS[problem.priority || 'medium']}</span>
        {problem.category && <CategoryBadge category={problem.category} />}
      </div>
      
      {/* Description */}
      {problem.description && (
        <div className="text-[11px] text-zinc-400 leading-relaxed">
          {problem.description}
        </div>
      )}
      
      {/* Root cause */}
      {problem.root_cause && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2">
          <div className="text-[9px] text-amber-500/70 mb-0.5">Root Cause</div>
          <div className="text-[10px] text-amber-400/80">{problem.root_cause}</div>
        </div>
      )}
      
      {/* Files */}
      {problem.files && problem.files.length > 0 && (
        <div>
          <div className="text-[9px] text-zinc-600 mb-1">Files</div>
          <div className="flex flex-wrap gap-1">
            {problem.files.map((f, i) => (
              <code key={i} className="text-[9px] bg-zinc-900/50 px-1.5 py-0.5 rounded text-cyan-400/70">
                {f}
              </code>
            ))}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-zinc-700/30">
        <button className="flex-1 py-1.5 bg-cyan-500/15 text-cyan-400 text-[10px] 
                           rounded-lg hover:bg-cyan-500/25">
          Assign to Terminal
        </button>
        <button className="py-1.5 px-3 bg-zinc-700/30 text-zinc-400 text-[10px] 
                           rounded-lg hover:bg-zinc-700/50">
          Edit
        </button>
      </div>
    </div>
  </div>
</div>
```

---

### Fix 6.9: Drag Between Sidebar Groups (Bug #54)

**Decision:** Remove the visual drag feedback from group headers. Cross-group drag adds complexity without clear user value. Terminal tabs already support drag-to-reorder within the tab bar, and the Map Editor supports drag-to-split. Sidebar groups are conceptual (Problems, Sessions, Configs) — dragging between them doesn't have a meaningful semantic.

**File:** `src/pages/TerminalPage.tsx`

Remove any `draggable` attributes or `onDragStart`/`onDragOver` handlers from sidebar section headers. If using `@dnd-kit`, remove the `DndContext` wrapper from the sidebar or restrict it to within-group reordering only.

```typescript
// REMOVE from sidebar section headers:
// draggable={true}
// onDragStart={...}
// onDragOver={...}

// KEEP: expand/collapse click handler only
<button onClick={() => toggleSection(sectionId)} className="...">
  <ChevronRight className={expanded ? 'rotate-90' : ''} />
  {sectionTitle}
</button>
```

---

## New Data Flow Diagrams for Section 8

### Flow: Session Resume (FIXED)

```
═══════════════════════════════════════════════════════════════════════
                      SESSION RESUME (FIXED)
═══════════════════════════════════════════════════════════════════════

Session list → click "Resume" button
  ① IPC getTerminalSessionResumeId(sessionId) → returns resumeId or null
  ② handleResumeSession:
     a. Resolve terminal: use existing if alive, else create new
     b. If new terminal needed:
        - generateTerminalId()
        - dispatch create-terminal event → spawnTerminal()
        - Wait for terminal:ready
     c. Load saved session config: loadSessionConfig(sessionId)
     d. Build launch command: getAgentLaunchCommand(agent, resumeId)
        - claude: "claude --resume <resumeId>"
        - opencode: "opencode" (no --resume flag, uses session internally)
        - aider: "aider" (no --resume, uses git history)
        - codex: "codex" (no --resume flag known)
     e. Queue messages:
        - System prompt (from saved config or rebuild via assembleContext)
        - Init content (from saved config)
        - Launch command with resume flag
     f. On agent:ready → flush queue
     g. setupActionsFileWatcher({ terminalId, projectPath })
     h. Update session status to 'active'

  AGENT --resume SUPPORT:
  ┌──────────┬──────────────────────────────────────────────────────┐
  │ Agent    │ Resume behavior                                      │
  ├──────────┼──────────────────────────────────────────────────────┤
  │ claude   │ ✅ --resume <sessionId> restores full conversation  │
  │ opencode │ ⚠️ No CLI flag — session resumes via internal DB   │
  │ aider    │ ❌ No resume — starts fresh each time              │
  │ codex    │ ⚠️ Unknown — may support --session-id              │
  │ gemini   │ ⚠️ Unknown — may support --resume                  │
  └──────────┴──────────────────────────────────────────────────────┘
  
  FALLBACK (for agents without --resume):
  1. Start new session
  2. Write "[RESUMED SESSION — continuing from previous work]"
  3. Write a brief summary of the previous session
  4. Write "Continue from where we left off."
  5. Agent picks up from context in the message
```

### Flow: Setup File Generation (FIXED)

```
═══════════════════════════════════════════════════════════════════════
                   SETUP FILE GENERATION (FIXED)
═══════════════════════════════════════════════════════════════════════

Called BEFORE assembleContext in handleCreateSession (Fix 2):

  ① deskflowAPI.trackerMindSetup('init-all', projectId, agentName)
  ② main.ts handler:
     a. Ensure agent/ directory exists
     b. For each step:
     
        step='agent':
          - Check if AGENTS.md exists
          - If NOT: generate from template with agent name + file listing
          - If EXISTS: skip (idempotent)
          
        step='init':
          - Check if INITIALIZE.md exists
          - If NOT: generate from template (agent-specific init guide)
          - If EXISTS: skip
          
        step='problems':
          - Check if problems.json exists and is non-empty
          - If empty []: try parsing PROBLEMS.md → populate JSON
          - If PROBLEMS.md doesn't exist: create empty template
          
        step='requests':
          - Same pattern as problems
          
        step='json-export':
          - Export terminal-sessions.json from DB
          
     c. Return { success: true, filesCreated: [...] }
     
  ③ After setup completes → assembleContext reads the guaranteed-to-exist files
  
  IDEMPOTENCY RULES:
  ┌────────────────┬─────────────────────────────────────────────┐
  │ File           │ Behavior if already exists                  │
  ├────────────────┼─────────────────────────────────────────────┤
  │ AGENTS.md      │ Skip — don't overwrite user customizations  │
  │ INITIALIZE.md  │ Skip — don't overwrite user customizations  │
  │ PROBLEMS.md    │ Skip — user may have edited manually        │
  │ problems.json  │ Migrate from MD if empty, else skip         │
  │ requests.json  │ Migrate from MD if empty, else skip         │
  │ state.md       │ Skip — managed by AI agents                 │
  └────────────────┴─────────────────────────────────────────────┘
```

### Flow: Workspace Save/Load (FIXED)

```
═══════════════════════════════════════════════════════════════════════
                   WORKSPACE SAVE/LOAD (FIXED)
═══════════════════════════════════════════════════════════════════════

  WORKSPACE STATE SCHEMA:
  interface WorkspaceState {
    version: 1;
    projectId: string;
    activeTerminalId: string | null;
    terminals: Array<{
      id: string;
      agent: string;
      sessionId: string | null;
      sessionTopic?: string;
      resumeId?: string;
      contextConfig?: ContextConfig;
    }>;
    layout: PaneNode | null;
    activeTab: string;
    sidebarWidth: number;
    contextConfig: ContextConfig;  // ← NEW: saves toggle card state
    savedAt: string;
  }

  SAVE FLOW:
  ┌─────────────────────────────────────────────────────────────────┐
  │ Trigger: Manual save button click                              │
  │                                                                  │
  │ ① Collect current state:                                        │
  │    - terminalTabs → terminals array                              │
  │    - terminalLayout → layout                                     │
  │    - activeTerminalId                                            │
  │    - activeTab                                                   │
  │    - sidebarWidth                                                │
  │    - contextConfig (from last Setup dialog)                      │
  │                                                                  │
  │ ② deskflowAPI.saveWorkspace({                                   │
  │      projectId,                                                  │
  │      scope: 'project',                                           │
  │      state: workspaceState                                       │
  │    })                                                            │
  │                                                                  │
  │ ③ main.ts handler:                                              │
  │    - Serialize to JSON                                           │
  │    - Write to {projectPath}/.deskflow/workspace.json             │
  │    - Also save to DB (terminal_layouts table) for sidebar list   │
  │                                                                  │
  │ ④ Show "Workspace saved" toast                                   │
  └─────────────────────────────────────────────────────────────────┘

  LOAD FLOW:
  ┌─────────────────────────────────────────────────────────────────┐
  │ Trigger: Click "Load" on saved config in Configs tab            │
  │                                                                  │
  │ ① deskflowAPI.loadWorkspace({ projectId, name })                │
  │                                                                  │
  │ ② main.ts handler:                                              │
  │    - Read {projectPath}/.deskflow/workspace.json                 │
  │    - Parse WorkspaceState                                        │
  │                                                                  │
  │ ③ Renderer receives state:                                       │
  │    - Close all current terminals                                 │
  │    - For each terminal in state.terminals:                       │
  │      a. generateTerminalId()                                     │
  │      b. spawnTerminal(id, cwd)                                   │
  │      c. If sessionId: resume session (Fix 2.8)                  │
  │    - Set layout                                                  │
  │    - Set activeTerminalId                                        │
  │    - Set activeTab                                               │
  │    - Set sidebarWidth                                            │
  │    - Set contextConfig (restores toggle card state)              │
  │                                                                  │
  │ ④ Show "Workspace restored: {name}" toast                       │
  └─────────────────────────────────────────────────────────────────┘

  AUTO-SAVE TRIGGERS:
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. Terminal close → auto-save (debounced 2s)                   │
  │ 2. Project switch → auto-save current project                   │
  │ 3. 60s timer → auto-save if dirty                              │
  │ 4. App quit → auto-save all                                    │
  └─────────────────────────────────────────────────────────────────┘
```

### Flow: FlowView Problem Creation (FIXED)

```
═══════════════════════════════════════════════════════════════════════
                 FLOWVIEW PROBLEM CREATION (FIXED)
═══════════════════════════════════════════════════════════════════════

  FlowView → user creates problem node
  ① User fills in: title, priority, category, description
  ② IPC deskflowAPI.createProblem({
       title,
       priority: priority || 'medium',
       category: category || 'other',
       description,
       projectId: selectedProjectId,
       sessionId: activeSessionId,
     })
  ③ ProblemsService.createProblem():
     a. Generate unique ID
     b. Write to problems.json
     c. Sync to PROBLEMS.md
     d. Return problemId
  ④ context-changed event dispatched → TerminalPage refreshes problem list
  ⑤ New problem appears in ProblemsTab immediately
  
  OPTIONAL — Assign to terminal:
  ⑥ If user drags problem node onto a terminal node in FlowView:
     a. IPC deskflowAPI.assignProblemToTerminal({
          problemId, terminalId: targetTerminalId
        })
     b. Update terminal_bindings in DB
     c. Write problem prompt to terminal (via queueOrSend)
```

---

## New Phase 7: Verification & Lower-Priority Fixes

### Fix 7.1: `create-terminal` Event Verification (Bug #3)

All 4 dispatch sites must be verified:

| Location | Trigger | Expected Behavior | Verification |
|----------|---------|-------------------|-------------|
| Line ~1070 | `handleCreateTerminalForProblem` | Spawns terminal with problem prompt | Create problem → assign → terminal appears |
| Line ~1240 | Header "Open Terminal" button | Spawns terminal with default agent | Click button → terminal appears |
| Line ~1574 | "+" tab button | Spawns terminal with default agent | Click "+" → terminal appears |
| Line ~2457 | `handleResumeSession` | Spawns terminal with resume command | Resume session → terminal appears with context |

**Conflict check:** The `create-terminal` listener calls `spawnTerminal()`. If `initializeTerminal()` is also called separately (e.g., from `handleTerminalCreated`), both might try to write to the same PTY. Fix: `initializeTerminal` should be called ONLY from the `agent:ready` handler, never directly from the `create-terminal` listener. The `create-terminal` listener only spawns the PTY; the `agent:ready` handler initializes it.

```typescript
// create-terminal listener — ONLY spawns, does NOT initialize
window.addEventListener('create-terminal', async (e: CustomEvent) => {
  const { terminalId, agent } = e.detail;
  await deskflowAPI.spawnTerminal(terminalId, computedProjectPath, agent);
  // Do NOT call initializeTerminal here — it will be called when agent:ready fires
});

// agent:ready listener — initializes after agent starts
deskflowAPI.onAgentReady(async (data) => {
  const { terminalId } = data;
  // Now safe to flush the message queue (system prompt + init content)
  await flushQueue(terminalId);
});
```

### Fix 7.2: QMD & Graphify Path Verification (Bugs #6, #7)

Since `buildInitContent()` is killed in Fix 2, these path fixes are moot for that function. But `assembleContext()` has its own path logic. Verify:

**ContextService.ts — `buildGraphifyContext()`:**
```typescript
// Should read from: graphify-out/GRAPH_REPORT.md
// NOT from: agent/GRAPH_REPORT.md
const graphifyPath = path.join(projectPath, 'graphify-out', 'GRAPH_REPORT.md');
```

**ContextService.ts — `buildQMDContext()`:**
```typescript
// Should read from: agent/templates/*.qmd
// NOT from: agent/templates/agent/*.qmd (double-nested)
const templatesDir = path.join(projectPath, 'agent', 'templates');
```

Add a runtime check and log:

```typescript
if (!fs.existsSync(graphifyPath)) {
  console.warn(`[ContextService] Graphify path not found: ${graphifyPath}`);
  return '';
}
```

### Fix 7.3: Obsidian Vault Sync (Bug #13 / Task I)

**Current state:** The vault at `CZVault/` contains canonical copies of skills, graphify graphs, and PARA content. The `graphify_maintain.py` script syncs TO the vault with `sync_to_para()`. But the context system reads from LOCAL paths (`agent/skills/`, `graphify-out/`).

**Resolution:** The context system reads from local paths. The vault is the archival/visualization layer (Obsidian). Sync is one-way: **project → vault** (not vault → project). This means:

1. `agent/skills/` is the source of truth for the context system
2. `CZVault/` is a read-only visualization/archive for Obsidian
3. `graphify_maintain.py sync_to_para` copies from project to vault
4. No vault → project sync exists (and shouldn't — the project files are the working copies)

**No code changes needed.** Add documentation:

```typescript
// In ContextService.ts — add comment:
// NOTE: Context reads from LOCAL project paths (agent/skills/, graphify-out/).
// The Obsidian vault (CZVault/) is an archival/visualization layer.
// Sync is one-way: project → vault (via graphify_maintain.py sync_to_para).
// If vault has newer content, user must manually copy to project paths.
```

### Fix 7.4: Natural Language Task Routing (Bug #32 / Task Q)

**Decision: DEFER.** This is a feature, not a bug fix. It requires an AI API call to classify intent, which adds latency and cost. The current routing (`@term` + active terminal) is sufficient for now.

Add a TODO comment:

```typescript
// TODO: Smart task routing — classify user input (bug fix / feature / research)
// and auto-route to matching session or create new one.
// Requires: AI classification API call, session affinity scoring, auto-creation logic.
// Deferred to future implementation.
```

### Fix 7.5: `useJson` Flag Handling

All IPC handlers that touch the DB must handle the case where `getDatabase()` returns null:

```typescript
// Pattern for all DB-touching IPC handlers:
ipcMain.handle('some-handler', async (_event, params) => {
  const db = getDatabase();
  if (!db) {
    // useJson mode — return empty/default data
    console.warn('[useJson] some-handler called but DB unavailable');
    return [];  // or {} or null depending on expected return type
  }
  
  // Normal DB operations
  return db.prepare('...').all();
});
```

This is already handled in most existing handlers. For new handlers added by this overhaul, include the guard:

| New Handler | useJson Fallback |
|------------|-----------------|
| `electron:execute-command` | N/A — doesn't touch DB |
| `send-instructions-to-terminal` | Write to PTY only (no DB needed for core function) |
| `summarize-session` | Return null, log warning |
| Context-changed events | Fire anyway (renderer refresh is harmless) |

---

## Updated File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/pages/TerminalPage.tsx` | 1,2,4,6,7 | Wire onSend, replace buildInitContent, add context-changed listener, fix problem delivery, session creation flow, prompt preview, problem list, rich file display, session resume flow, closeTerminal batching, agent defaults, session filter, delta context messages |
| `src/main.ts` | 1,3,7 | UI refresh events after actions, electron:execute-command handler, sendInstructionsToTerminal handler, useJson guards, context-changed entity data |
| `src/preload.ts` | 3 | executeCommand bridge |
| `src/components/TerminalWindow.tsx` | 1,5,6 | Verify term.onData, fix drag-drop, fix split height, add resize handles, React.memo on tabs |
| `src/components/NewSessionDialog.tsx` | 2 | Import ContextConfig, wire toggles, init/setup mode distinction, existing session ID input, agent selector dropdown |
| `src/components/InstructionPanel.tsx` | 4 | Enlarge textarea, target terminal indicator |
| `src/components/ProblemDetailModal.tsx` | 6 | Status badges, category tags, related requests section, consistent zinc styling |
| `src/services/ContextService.ts` | 7 | Verify graphify/QMD paths, add vault sync comment |
| `src/components/FlowView.tsx` | 1 | Wire to ProblemsService via IPC (if functional) |

---

## Updated Implementation Order

```
Step  1: Wire onSend (Fix 1)
Step  2: Kill buildInitContent, use assembleContext only (Fix 2)
Step  3: Add UI refresh events (Fix 5)
Step  4: Fix terminal input (Fix 3)
Step  5: Fix problem prompt delivery (Fix 4)
Step  6: Skills pipeline verification (Fix 1.5)
Step  7: FlowView audit & wiring (Fix 1.6)
Step  8: Fix status change terminal format (Fix 1.7)
Step  9: Wire tracker-mind-setup (Fix 6)
Step 10: Init vs Setup mode distinction (Fix 2.5)
Step 11: Agent defaults unification (Fix 2.6)
Step 12: Agent dropdown population (Fix 2.7)
Step 13: Existing session ID input (Fix 2.8)
Step 14: Session list audit (Fix 2.9)
Step 15: Add electron:execute-command (Fix 11)
Step 16: Verify sendInstructionsToTerminal (Fix 3.5)
Step 17: tracker-mind-generate — document or skip (Fix 3.6)
Step 18: Fix prompt preview (Fix 15)
Step 19: Delta context messages (Fix 4.5)
Step 20: Enlarge compose + target indicator (Fix 16, 17)
Step 21: Fix @term routing (Fix 18)
Step 22: Fix drag-drop layout (Fix 19)
Step 23: Fix split pane height (Fix 20)
Step 24: Add resize handles (Fix 21)
Step 25: Problem list redesign (Fix 22)
Step 26: Rich file display (Fix 23)
Step 27: Close session blinking (Fix 6.5)
Step 28: Product area tags + filters (Fix 6.6)
Step 29: Problem-request linking UI (Fix 6.7)
Step 30: Modal styling (Fix 6.8)
Step 31: Remove cross-group drag (Fix 6.9)
Step 32: Verify create-terminal events (Fix 7.1)
Step 33: Verify graphify/QMD paths (Fix 7.2)
Step 34: Document vault sync (Fix 7.3)
Step 35: Add useJson guards (Fix 7.5)
Step 36: Context sharpening / deep memory (Fix 24)
Step 37: DEFER: Smart task routing (Fix 7.4)
```
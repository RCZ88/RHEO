# Terminal + Context Management — Complete Overhaul Specification

## 0. Direct Answers to Your Questions

### "DOES THE SESSION WORK?"
**Partially.** Sessions are created and saved to the DB. The terminal PTY spawns. But the agent launch command may be wrong, the system prompt may not be properly sent, and the actions file watcher isn't always initialized. The session *record* exists but the *agent* may not actually be running inside it.

### "DOES THE SENDING THE PROMPT WITH THE SYSTEM PROMPT WORK?"
**No.** The InstructionPanel's `onSend` is a STUB at `TerminalPage.tsx:1384`. It closes the panel and does nothing else. `handleInstructionPanelSend` is defined at line 385 but never wired. Everything the user composes (problems, requests, skills, custom text) is thrown away.

### "DOES THE CONTEXT MANAGEMENT WITH ALL THE TOOLS WORK?"
**Partially.** The 6 context toggle cards in the Setup dialog are decorative — they feed into `assembleContext()` but there's a SECOND independent code path (`buildInitContent()`) with its own flags. Toggling Graphify OFF in the cards may still produce graphify content because `buildInitContent` has its own `includeGraphify` flag. These two paths are not synchronized.

### "NAME ME THE LIST OF TOOLS THAT WORK WITH THE CONTEXT SYSTEM"

| Tool | Reads From | Works? | Why |
|------|-----------|--------|-----|
| **LLM Wiki** | `agent/*.md` | ✅ Yes | `buildLLMWikiContext()` reads files, budgets tokens |
| **Obsidian Skills** | `agent/skills/*/SKILL.md` | ✅ Yes | `buildSkillIndex()` reads frontmatter |
| **Graphify** | `graphify-out/GRAPH_REPORT.md` | ⚠️ Partial | Path fixed, content read, but NO way to trigger rebuild from UI |
| **PARA** | `CZVault/` directories | ⚠️ Partial | Lists directories, but vault sync mechanism unclear |
| **QMD Templates** | `agent/templates/*.qmd` | ⚠️ Partial | Path fixed, lists templates, but content not loaded into context |
| **Automations** | `agent/automations/` | ❌ No | Directory may not exist, `buildAutomationsContext()` untested |
| **Deep Memory** | `agent/context/deep-memory.json` | ❌ No | File doesn't exist yet, no mechanism to populate it |

### "HOW DOES THE CONTEXT SYSTEM WORK?"

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT ASSEMBLY PIPELINE                     │
│                                                                  │
│  TWO CODE PATHS (this is the bug):                              │
│                                                                  │
│  PATH A: buildInitContent()          PATH B: assembleContext()   │
│  ├─ includeAgentsMd flag             ├─ ctxLLMWiki toggle       │
│  ├─ includeGraphify flag             ├─ ctxSkills toggle         │
│  ├─ includeQMD flag                  ├─ ctxGraphify toggle       │
│  ├─ includeSkills flag               ├─ ctxPara toggle           │
│  └─ reads files directly             ├─ ctxQMD toggle            │
│                                       ├─ ctxAutomations toggle   │
│                                       └─ reads via ContextService│
│                                                                  │
│  Both produce text content. Both may include the SAME systems.  │
│  Both get concatenated into the init prompt sent to the agent.  │
│  Result: duplicate graphify, duplicate skills, etc.             │
│                                                                  │
│  FIX: Eliminate PATH A. Use ONLY PATH B (assembleContext).     │
│  The toggle cards control everything. buildInitContent dies.    │
└─────────────────────────────────────────────────────────────────┘
```

### "HOW DOES THE AI UPDATE PROBLEM/REQUEST/CHECKLIST STATUS?"

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI → APP COMMUNICATION                         │
│                                                                  │
│  METHOD 1: actions.json file (PRIMARY)                          │
│  ─────────────────────────────────────                          │
│  AI writes to agent/actions.json:                                │
│  {                                                               │
│    "actions": [                                                  │
│      { "type": "create_problem",                                │
│        "data": { "title": "Fix login bug",                      │
│                   "priority": "high",                            │
│                   "category": "bug-fix" } },                     │
│      { "type": "update_problem",                                │
│        "data": { "id": "123", "status": "in-progress" } },      │
│      { "type": "complete_checklist",                            │
│        "data": { "id": "456" } }                                │
│    ]                                                             │
│  }                                                               │
│                                                                  │
│  main.ts fs.watch detects change →                              │
│    executeActionsFromFile() reads JSON →                         │
│    Performs CRUD via ProblemsService/RequestsService/etc →       │
│    Clears actions.json to {"actions":[]} →                       │
│    ❌ MISSING: dispatches context-changed to renderer            │
│                                                                  │
│  METHOD 2: Terminal output parsing (SECONDARY)                  │
│  ──────────────────────────────────────────                     │
│  AI outputs ## Session Metadata block in terminal →              │
│  parseTerminalOutput() extracts metadata →                       │
│  parseAndExecuteActions() processes action blocks →              │
│  Updates DB →                                                    │
│  ❌ MISSING: dispatches refresh events to renderer              │
│                                                                  │
│  METHOD 3: System prompt instructions (PASSIVE)                 │
│  ────────────────────────────────────────                       │
│  DEFAULT_SYSTEM_PROMPT tells the AI about actions.json          │
│  format. The AI knows it CAN write to this file.                │
│  This part works — the AI is instructed.                        │
│  What's broken is the file watcher + UI refresh.                │
└─────────────────────────────────────────────────────────────────┘
```

### "HOW DOES THE USER SEND SOMETHING AND THE AI INSERTS A PROBLEM?"

```
CURRENT FLOW (BROKEN):
  User types in InstructionPanel → selects problems/requests/skill → clicks Send
  → onSend STUB fires → panel closes → NOTHING HAPPENS
  → User's composed text is lost

FIXED FLOW:
  User types in InstructionPanel → selects problems/requests/skill → clicks Send
  → handleInstructionPanelSend fires:
    1. Composes full prompt: user text + linked problems + linked requests + skill content
    2. Resolves target terminal (activeTerminalId or @term routing)
    3. queueOrSend(terminalId, composedPrompt)
    4. If agent ready → writes to PTY immediately
    5. If agent not ready → queues until agent:ready fires
    6. Saves message to terminal_messages DB
    7. Updates terminal_bindings with linked problem/request IDs
  → Agent receives the composed text
  → Agent may write to actions.json to create new problems
  → File watcher picks it up → ProblemsService creates the problem
  → context-changed event → UI refreshes problem list
```

### "HOW IS THE LOGIC ON AUTO ASSIGNING WHICH SESSION DOES A PROMPT GO TO?"

```
CURRENT LOGIC:
  1. If user typed @term-xxx in quick-input bar → parse and route to that terminal
  2. Else → use activeTerminalId (the currently focused terminal tab)
  3. Else → use sendTargetSession state (from session selector)
  4. Else → show error "No terminal available"

PROBLEM:
  - @term parsing may not work
  - Active terminal may not have a ready agent
  - sendTargetSession may be stale
  - No visual indicator of which terminal will receive the input

FIX:
  1. Always show target terminal in the compose bar header
  2. @term dropdown shows all terminals with agent status
  3. If active terminal agent not ready → auto-queue with "Queued for Terminal X" toast
  4. If no terminal at all → offer to create one
```

---

## 1. Priority-Ordered Fix List

I'm organizing the 54 bugs into **6 implementation phases**, ordered by what unblocks what.

```
Phase 1: CORE FLOWS (unblocks everything else)
  ├─ Fix 1: Wire InstructionPanel onSend → handleInstructionPanelSend
  ├─ Fix 2: Unify context assembly (kill buildInitContent, use assembleContext only)
  ├─ Fix 3: Fix terminal manual input (xterm → PTY)
  ├─ Fix 4: Fix problem → terminal prompt delivery
  └─ Fix 5: Add UI refresh events after AI actions

Phase 2: SESSION CREATION (makes sessions actually work)
  ├─ Fix 6: Wire tracker-mind-setup into Setup dialog
  ├─ Fix 7: Fix agent launch command
  ├─ Fix 8: Separate system prompt from first message
  ├─ Fix 9: Fix actions file watcher for all creation paths
  └─ Fix 10: Fix session ID display

Phase 3: IPC BRIDGES (makes graphify/automations work)
  ├─ Fix 11: Add electron:execute-command handler
  ├─ Fix 12: Verify sendInstructionsToTerminal handler
  ├─ Fix 13: Verify workspace:save/load handlers
  └─ Fix 14: Verify getAiContext handler

Phase 4: PROMPT PREVIEW & COMPOSE (makes the UX usable)
  ├─ Fix 15: Fix prompt preview (show full merged prompt)
  ├─ Fix 16: Enlarge compose area
  ├─ Fix 17: Show target terminal indicator
  └─ Fix 18: Fix @term routing

Phase 5: TERMINAL LAYOUT (makes split panes work)
  ├─ Fix 19: Fix drag-drop layout mutation
  ├─ Fix 20: Fix split pane height
  └─ Fix 21: Add resize handles

Phase 6: UI POLISH (makes everything look right)
  ├─ Fix 22: Problem list redesign
  ├─ Fix 23: Rich file display
  ├─ Fix 24: Context sharpening / deep memory
  └─ Fix 25: All remaining medium/low bugs
```

---

## 2. Phase 1: Core Flows

### Fix 1: Wire InstructionPanel onSend

**File:** `src/pages/TerminalPage.tsx`

**Current (line ~1384):**
```typescript
onSend={(config) => { setPendingSkill(undefined); setShowInstructionPanel(false); }}
```

**Replace with:**
```typescript
onSend={handleInstructionPanelSend}
```

**Verify `handleInstructionPanelSend` (line ~385) is complete:**

```typescript
const handleInstructionPanelSend = useCallback(async (config: {
  prompt: string;
  linkedProblemIds?: string[];
  linkedRequestIds?: string[];
  skillId?: string;
  targetTerminalId?: string;
}) => {
  // 1. Resolve target terminal
  const targetId = config.targetTerminalId || activeTerminalId || sendTargetSession;
  if (!targetId) {
    showError('No terminal available. Open a terminal first.');
    return;
  }

  // 2. Compose full prompt with linked context
  let composedPrompt = config.prompt;
  
  if (config.linkedProblemIds && config.linkedProblemIds.length > 0) {
    const linkedProblems = problems.filter(p => config.linkedProblemIds!.includes(p.id));
    if (linkedProblems.length > 0) {
      composedPrompt += '\n\n--- Linked Problems ---';
      for (const p of linkedProblems) {
        composedPrompt += `\nProblem #${p.id}: ${p.title}\nStatus: ${p.status}${p.description ? `\nDescription: ${p.description}` : ''}`;
      }
    }
  }

  if (config.linkedRequestIds && config.linkedRequestIds.length > 0) {
    const linkedRequests = requests.filter(r => config.linkedRequestIds!.includes(r.id));
    if (linkedRequests.length > 0) {
      composedPrompt += '\n\n--- Linked Requests ---';
      for (const r of linkedRequests) {
        composedPrompt += `\nRequest #${r.id}: ${r.title}\nStatus: ${r.status}`;
      }
    }
  }

  if (config.skillId) {
    const skill = skills.find(s => s.id === config.skillId || s.name === config.skillId);
    if (skill) {
      composedPrompt += `\n\n--- Skill: ${skill.name} ---\n${skill.content || skill.description}`;
    }
  }

  // 3. Send to terminal (queue or direct)
  queueOrSend(targetId, composedPrompt);

  // 4. Save message to DB
  const session = sessions.find(s => s.terminal_id === targetId);
  if (session) {
    try {
      await deskflowAPI.saveTerminalMessage({
        sessionId: session.id,
        role: 'user',
        content: composedPrompt,
      });
    } catch (e) {
      console.error('Failed to save terminal message:', e);
    }

    // 5. Update terminal binding with linked entities
    try {
      await deskflowAPI.updateTerminalBinding({
        terminalId: targetId,
        activeProblemId: config.linkedProblemIds?.[0],
        activeRequestId: config.linkedRequestIds?.[0],
      });
    } catch (e) {
      console.error('Failed to update terminal binding:', e);
    }
  }

  // 6. Close panel and clear state
  setPendingSkill(undefined);
  setShowInstructionPanel(false);
  setQueuedMessages(prev => ({
    ...prev,
    [targetId]: (prev[targetId] || 0) + (agentReadyRef.current.get(targetId) ? 0 : 1),
  }));
}, [activeTerminalId, sendTargetSession, problems, requests, skills, sessions]);
```

### Fix 2: Unify Context Assembly

**The problem:** `buildInitContent()` and `assembleContext()` are two independent code paths that may both include the same systems, producing duplicate content.

**The fix:** Kill `buildInitContent()`. Use ONLY `assembleContext()` from `ContextService.ts`. The 6 toggle cards become the single source of truth.

**File:** `src/pages/TerminalPage.tsx`

Remove or gut the `buildInitContent()` function. Replace all calls to it with `assembleContext()`:

```typescript
// BEFORE: buildInitContent() + assembleContext() both called, both produce content
// AFTER: Only assembleContext() is called, toggle cards control everything

const handleCreateSession = useCallback(async (dialogConfig: {
  agentType: string;
  contextConfig: ContextConfig;  // From toggle cards
  customSystemPrompt?: string;
  projectPath?: string;
}) => {
  const projectPath = dialogConfig.projectPath || computedProjectPath || '';
  const agent = dialogConfig.agentType || localStorage.getItem('terminal-defaultAgent') || 'claude';

  // 1. Run tracker-mind-setup first (ensure files exist)
  try {
    await deskflowAPI.trackerMindSetup('init-all', undefined, agent);
  } catch (e) {
    console.warn('tracker-mind-setup failed (files may already exist):', e);
  }

  // 2. Assemble context using ONLY the toggle-card-driven path
  let initContent = '';
  try {
    initContent = await assembleContext(projectPath, dialogConfig.contextConfig);
  } catch (e) {
    console.error('assembleContext failed:', e);
  }

  // 3. Build system prompt (merged layers)
  const defaultPrompt = DEFAULT_SYSTEM_PROMPT;
  const prefs = await deskflowAPI.getPreferences();
  const generalAdditions = prefs.systemPrompts?.[agent] || '';
  const projectId = projects.find(p => p.path === projectPath)?.id;
  const projectAdditions = projectId ? (prefs.projectPrompts?.[projectId] || '') : '';
  const sessionAdditions = dialogConfig.customSystemPrompt || '';

  const mergedSystemPrompt = [
    defaultPrompt,
    projectAdditions ? `\n## Project Instructions\n${projectAdditions}` : '',
    generalAdditions ? `\n## General Instructions\n${generalAdditions}` : '',
    sessionAdditions ? `\n## Session Instructions\n${sessionAdditions}` : '',
  ].filter(Boolean).join('\n');

  // 4. Create terminal
  const terminalId = generateTerminalId();
  dispatchCreateTerminal(terminalId, agent);

  // 5. Wait for agent ready, then write prompts
  // The agent:ready handler will flush the queue
  messageQueueRef.current.set(terminalId, [
    { terminalId, content: mergedSystemPrompt, timestamp: Date.now(), isSystemPrompt: true },
    { terminalId, content: initContent, timestamp: Date.now() + 1, isInitContent: true },
  ]);

  // 6. Save session
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  await deskflowAPI.saveTerminalSession({
    id: sessionId,
    projectId,
    agent,
    topic: 'New Session',
    terminal_id: terminalId,
    category: 'other',
    status: 'active',
  });

  // 7. Set up actions file watcher
  try {
    await deskflowAPI.setupActionsFileWatcher({ terminalId, projectPath });
  } catch (e) {
    console.warn('setupActionsFileWatcher failed:', e);
  }
}, [computedProjectPath, projects]);
```

**File:** `src/components/NewSessionDialog.tsx`

Remove the duplicate inline `ContextConfig` type. Import from `ContextConfig.ts`:

```typescript
import { ContextConfig, DEFAULT_CONTEXT_CONFIG } from '../services/ContextConfig';
```

Make toggle cards directly control `contextConfig` state and pass it through to `onCreate`:

```typescript
// The 6 toggle states feed into contextConfig
const [contextConfig, setContextConfig] = useState<ContextConfig>(DEFAULT_CONTEXT_CONFIG);

const handleToggle = (system: keyof ContextConfig['systems'], enabled: boolean) => {
  setContextConfig(prev => ({
    ...prev,
    systems: {
      ...prev.systems,
      [system]: { ...prev.systems[system], enabled },
    },
  }));
};

// On create, pass the full config
const handleCreate = () => {
  onCreate({
    agentType: selectedAgent,
    contextConfig,  // ← This is the single source of truth
    customSystemPrompt,
    projectPath,
  });
};
```

### Fix 3: Terminal Manual Input

**File:** `src/components/TerminalWindow.tsx`

The xterm `Terminal` instance needs to have its `onData` handler properly routing keystrokes to the PTY:

```typescript
// In TerminalPane component, when initializing xterm:

const term = new Terminal({
  cursorBlink: true,
  fontSize: 13,
  fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: '#1a1a2e',
    foreground: '#e0e0e0',
    cursor: '#22d3ee',
    selectionBackground: 'rgba(34, 211, 238, 0.2)',
  },
});

// THIS IS THE CRITICAL LINE — route user keystrokes to PTY
term.onData((data: string) => {
  // User typed something → send to PTY via IPC
  deskflowAPI.terminalWrite(terminalId, data);
});

// Also handle binary data (paste, special keys)
term.onBinary((data: string) => {
  deskflowAPI.terminalWrite(terminalId, data);
});

// Make sure the terminal is focusable
term.element?.addEventListener('focus', () => {
  setActiveTerminalId(terminalId);
});

// Click to focus
term.element?.addEventListener('click', () => {
  term.focus();
});
```

**Verify in `src/main.ts`** that the `terminal:write` handler correctly routes to node-pty:

```typescript
ipcMain.handle('terminal:write', (event, terminalId: string, data: string) => {
  const info = terminalManager.get(terminalId);
  if (!info?.pty) {
    console.warn(`terminal:write — no PTY for ${terminalId}`);
    return false;
  }
  info.pty.write(data);
  return true;
});
```

### Fix 4: Problem → Terminal Prompt Delivery

**File:** `src/pages/TerminalPage.tsx`

The `handleCreateTerminalForProblem` function creates the terminal but never writes the problem prompt to it:

```typescript
const handleCreateTerminalForProblem = useCallback(async (event: CustomEvent) => {
  const { terminalId, problemId, prompt, agent } = event.detail;

  // 1. Create tab
  setTerminalTabs(prev => ({
    ...prev,
    [terminalId]: { id: terminalId, agent: agent || 'claude', sessionId: null },
  }));

  // 2. Set layout
  setTerminalLayout(prev => prev ? insertIntoLayout(prev, terminalId) : {
    type: 'leaf', terminalId,
  });

  // 3. Set active
  setActiveTerminalId(terminalId);

  // 4. Queue the problem prompt for when the agent is ready
  // This is the MISSING piece — the prompt was only saved to session, never sent
  if (prompt) {
    const queue = messageQueueRef.current.get(terminalId) || [];
    queue.push({ terminalId, content: prompt, timestamp: Date.now() });
    messageQueueRef.current.set(terminalId, queue);
  }

  // 5. Save session with problem binding
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  await deskflowAPI.saveTerminalSession({
    id: sessionId,
    agent: agent || 'claude',
    topic: `Problem #${problemId}`,
    terminal_id: terminalId,
  });

  // 6. Update terminal binding with problem
  await deskflowAPI.updateTerminalBinding({
    terminalId,
    activeProblemId: problemId,
    session_id: sessionId,
  });

  // 7. Set up actions file watcher
  try {
    await deskflowAPI.setupActionsFileWatcher({ terminalId, projectPath: computedProjectPath });
  } catch (e) {
    console.warn('setupActionsFileWatcher failed:', e);
  }
}, [computedProjectPath]);
```

### Fix 5: Add UI Refresh Events After AI Actions

**File:** `src/main.ts`

After `executeActionsFromFile()` and `parseAndExecuteActions()` update the DB, dispatch refresh events:

```typescript
// In executeActionsFromFile() — after all actions are processed:
function executeActionsFromFile(projectPath: string) {
  const actionsPath = path.join(projectPath, 'agent', 'actions.json');
  if (!fs.existsSync(actionsPath)) return;

  try {
    const content = fs.readFileSync(actionsPath, 'utf-8');
    const { actions } = JSON.parse(content);
    if (!actions || actions.length === 0) return;

    let problemsChanged = false;
    let requestsChanged = false;
    let checklistsChanged = false;

    for (const action of actions) {
      switch (action.type) {
        case 'create_problem': {
          ProblemsService.createProblem(action.data);
          problemsChanged = true;
          break;
        }
        case 'update_problem': {
          ProblemsService.updateProblem(action.data.id, action.data);
          problemsChanged = true;
          break;
        }
        case 'update_request': {
          RequestsService.updateStatus(action.data.id, action.data.status);
          requestsChanged = true;
          break;
        }
        case 'complete_checklist': {
          ChecklistService.updateItem(action.data.id, { status: 'completed' });
          checklistsChanged = true;
          break;
        }
        // ... other action types
      }
    }

    // Clear the file
    fs.writeFileSync(actionsPath, JSON.stringify({ actions: [] }, null, 2));

    // ✅ NEW: Dispatch refresh events to renderer
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win.isDestroyed()) continue;
      if (problemsChanged) {
        win.webContents.send('context-changed', { type: 'problems', action: 'updated' });
      }
      if (requestsChanged) {
        win.webContents.send('context-changed', { type: 'requests', action: 'updated' });
      }
      if (checklistsChanged) {
        win.webContents.send('context-changed', { type: 'checklists', action: 'updated' });
      }
    }
  } catch (e) {
    console.error('executeActionsFromFile error:', e);
  }
}
```

Same pattern in `parseAndExecuteActions()`:

```typescript
// After processing actions from terminal output:
if (problemsChanged || requestsChanged || checklistsChanged) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (win.isDestroyed()) continue;
    win.webContents.send('context-changed', {
      type: problemsChanged ? 'problems' : requestsChanged ? 'requests' : 'checklists',
      action: 'updated',
    });
  }
}
```

**File:** `src/pages/TerminalPage.tsx` — Wire the `context-changed` event to refresh data:

```typescript
// Add this effect to refresh problem/request lists when AI changes them
useEffect(() => {
  const cleanup = deskflowAPI.onContextChanged(async (data) => {
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
  });
  return cleanup;
}, []);
```

---

## 3. Phase 2: Session Creation

### Fix 6: Wire tracker-mind-setup into Setup Dialog

Already covered in Fix 2 above — the `handleCreateSession` function calls `deskflowAPI.trackerMindSetup('init-all', ...)` before reading files.

### Fix 7: Fix Agent Launch Command

**File:** `src/pages/TerminalPage.tsx`

The launch command must match the actual CLI name of each agent:

```typescript
const AGENT_LAUNCH_COMMANDS: Record<string, string> = {
  claude: 'claude',
  opencode: 'opencode',
  aider: 'aider',
  codex: 'codex',
  gemini: 'gemini',
};

function getAgentLaunchCommand(agent: string, resumeId?: string): string {
  const baseCmd = AGENT_LAUNCH_COMMANDS[agent] || agent;
  
  if (resumeId && agent === 'claude') {
    return `claude --resume ${resumeId}`;
  }
  
  return baseCmd;
}
```

**In the agent:ready handler**, write the launch command:

```typescript
// After agent:ready fires (shell is ready), write the agent launch command
const launchCmd = getAgentLaunchCommand(agent, resumeId);
deskflowAPI.terminalWriteRaw(terminalId, launchCmd + '\r');
```

### Fix 8: Separate System Prompt from First Message

The system prompt and the init content must be sent as distinct blocks with clear markers:

```typescript
// In the message queue flush (when agent:ready fires):

async function flushQueue(terminalId: string) {
  const queue = messageQueueRef.current.get(terminalId) || [];
  if (queue.length === 0) return;

  // Separate system prompts from user messages
  const systemMessages = queue.filter(m => m.isSystemPrompt || m.isInitContent);
  const userMessages = queue.filter(m => !m.isSystemPrompt && !m.isInitContent);

  // 1. Write system prompt block
  for (const msg of systemMessages) {
    if (msg.isSystemPrompt) {
      // Claude Code: use /system command or --append-system-prompt at launch
      // For other agents: write as first input with clear delimiter
      const systemBlock = `[SYSTEM CONTEXT — This configures your behavior for this session]\n${msg.content}\n[END SYSTEM CONTEXT]`;
      await deskflowAPI.terminalWriteRaw(terminalId, systemBlock + '\r');
      await new Promise(r => setTimeout(r, 300)); // Let agent process
    }
    if (msg.isInitContent) {
      const initBlock = `[PROJECT CONTEXT — Read this to understand the workspace]\n${msg.content}\n[END PROJECT CONTEXT]`;
      await deskflowAPI.terminalWriteRaw(terminalId, initBlock + '\r');
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 2. Write user messages
  for (const msg of userMessages) {
    deskflowAPI.terminalWrite(terminalId, msg.content + '\r');
    await new Promise(r => setTimeout(r, 100));
  }

  messageQueueRef.current.delete(terminalId);
}
```

### Fix 9: Fix Actions File Watcher for All Creation Paths

**File:** `src/pages/TerminalPage.tsx`

Add `setupActionsFileWatcher` call in every terminal creation path:

```typescript
// In handleTerminalCreated (the agent:ready handler):
const handleTerminalCreated = useCallback(async (terminalId: string, agent: string) => {
  // ... existing initialization logic ...

  // Set up actions file watcher for THIS terminal
  try {
    await deskflowAPI.setupActionsFileWatcher({
      terminalId,
      projectPath: computedProjectPath,
    });
  } catch (e) {
    console.warn('setupActionsFileWatcher failed:', e);
  }
}, [computedProjectPath]);
```

### Fix 10: Fix Session ID Display

**File:** `src/pages/TerminalPage.tsx`

The session list should show the DB-generated session ID, not the terminal ID:

```typescript
// In session list rendering:
{sessions.map(session => (
  <div key={session.id} className="...">
    <span className="text-[10px] text-zinc-600">
      {session.id.length > 12 ? session.id.slice(0, 8) + '...' : session.id}
    </span>
    <span className="text-[11px] text-zinc-300">
      {session.topic || 'Untitled Session'}
    </span>
    {/* ... rest of card ... */}
  </div>
))}
```

---

## 4. Phase 3: IPC Bridges

### Fix 11: Add electron:execute-command Handler

**File:** `src/main.ts`

```typescript
ipcMain.handle('electron:execute-command', async (_event, params: {
  command: string;
  args?: string[];
  cwd?: string;
}) => {
  const { command, args = [], cwd } = params;
  
  return new Promise((resolve, reject) => {
    const proc = require('child_process').execFile(
      command,
      args,
      { cwd: cwd || process.cwd(), timeout: 60000 },
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject({ error: error.message, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      }
    );
  });
});
```

**File:** `src/preload.ts`

```typescript
executeCommand: (params: { command: string; args?: string[]; cwd?: string }) =>
  ipcRenderer.invoke('electron:execute-command', params),
```

**Usage for graphify rebuild:**

```typescript
await deskflowAPI.executeCommand({
  command: 'python',
  args: ['agent/skills/maintain-context/graphify_maintain.py', 'full'],
  cwd: projectPath,
});
```

### Fix 12-14: Verify Existing Handlers

Audit `src/main.ts` for these handlers:

```typescript
// Verify these exist and work:
ipcMain.handle('send-instructions-to-terminal', ...);
ipcMain.handle('workspace:save', ...);
ipcMain.handle('workspace:load', ...);
ipcMain.handle('get-ai-context', ...);
```

If any are missing, add them. The preload bridges already exist.

---

## 5. Phase 4: Prompt Preview & Compose

### Fix 15: Fix Prompt Preview

**File:** `src/pages/TerminalPage.tsx`

The prompt preview should show the COMPLETE merged prompt with section labels:

```typescript
const [showPromptPreview, setShowPromptPreview] = useState(false);
const [mergedPromptPreview, setMergedPromptPreview] = useState('');

const buildPromptPreview = useCallback(async () => {
  const agent = localStorage.getItem('terminal-defaultAgent') || 'claude';
  const prefs = await deskflowAPI.getPreferences();
  const projectPath = computedProjectPath;
  const projectId = projects.find(p => p.path === projectPath)?.id;

  const sections = [
    {
      label: 'DEFAULT_SYSTEM_PROMPT (always prepended)',
      content: DEFAULT_SYSTEM_PROMPT,
      tokens: estimateTokens(DEFAULT_SYSTEM_PROMPT),
    },
    {
      label: 'Project Additions',
      content: projectId ? (prefs.projectPrompts?.[projectId] || '(empty)') : '(no project)',
      tokens: estimateTokens(prefs.projectPrompts?.[projectId] || ''),
    },
    {
      label: 'General Additions',
      content: prefs.systemPrompts?.[agent] || '(empty)',
      tokens: estimateTokens(prefs.systemPrompts?.[agent] || ''),
    },
  ];

  // Add context from assembleContext if config available
  try {
    const contextContent = await assembleContext(projectPath, contextConfig);
    if (contextContent) {
      sections.push({
        label: 'Assembled Context (6 systems)',
        content: contextContent,
        tokens: estimateTokens(contextContent),
      });
    }
  } catch (e) {
    sections.push({
      label: 'Assembled Context',
      content: '(failed to assemble)',
      tokens: 0,
    });
  }

  const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
  setMergedPromptPreview(
    sections.map(s => `═══ ${s.label} [~${s.tokens} tokens] ═══\n${s.content}`).join('\n\n') +
    `\n\n═══ TOTAL: ~${totalTokens} tokens ═══`
  );
  setShowPromptPreview(true);
}, [computedProjectPath, projects, contextConfig]);
```

### Fix 16: Enlarge Compose Area

**File:** `src/components/InstructionPanel.tsx`

```typescript
// Change the textarea from a cramped 3-row to a larger, resizable area
<textarea
  value={instruction}
  onChange={(e) => setInstruction(e.target.value)}
  placeholder="Write your instruction here..."
  className="w-full min-h-[120px] max-h-[300px] bg-zinc-900/50 border border-zinc-700/50 
             rounded-lg p-3 text-[12px] text-zinc-300 resize-y
             placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none
             font-mono"
  rows={6}
/>
```

### Fix 17: Show Target Terminal Indicator

**File:** `src/pages/TerminalPage.tsx`

In the quick-input bar and InstructionPanel header:

```typescript
<div className="flex items-center gap-2 mb-2">
  <span className="text-[9px] text-zinc-600">Sending to:</span>
  <span className="text-[10px] text-cyan-400 font-medium">
    {activeTerminalId 
      ? `Terminal ${activeTerminalId.slice(0, 6)}` 
      : 'No terminal selected'}
  </span>
  {agentReadyRef.current.get(activeTerminalId) ? (
    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
  ) : (
    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Agent not ready — will queue" />
  )}
</div>
```

### Fix 18: Fix @term Routing

**File:** `src/pages/TerminalPage.tsx`

```typescript
const parseAtMention = (input: string): { targetTerminalId: string | null; cleanPrompt: string } => {
  const match = input.match(/^@(\S+)\s*(.*)/s);
  if (!match) return { targetTerminalId: null, cleanPrompt: input };
  
  const termRef = match[1]; // e.g., "term-abc123" or "1" or "claude"
  const cleanPrompt = match[2];
  
  // Try exact terminal ID match
  if (terminalTabs[termRef]) {
    return { targetTerminalId: termRef, cleanPrompt };
  }
  
  // Try partial match
  const matchingTerminal = Object.keys(terminalTabs).find(id => 
    id.startsWith(termRef) || 
    id.includes(termRef) ||
    terminalTabs[id].agent?.includes(termRef)
  );
  
  if (matchingTerminal) {
    return { targetTerminalId: matchingTerminal, cleanPrompt };
  }
  
  // Use the IPC resolver
  return { targetTerminalId: null, cleanPrompt: input };
};
```

---

## 6. Phase 5: Terminal Layout

### Fix 19: Fix Drag-Drop Layout Mutation

**File:** `src/components/TerminalWindow.tsx`

The `onDragEnd` handler needs to actually call the layout mutation function:

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  setTerminalLayout(prev => {
    if (!prev) return prev;
    
    const newLayout = JSON.parse(JSON.stringify(prev));
    const activeId = String(active.id);
    const overId = String(over.id);
    
    // Swap the two leaves
    return swapLeavesInTree(newLayout, activeId, overId);
  });
};
```

### Fix 20: Fix Split Pane Height

**File:** `src/components/TerminalWindow.tsx`

Ensure `min-h-0` and `flex-1` propagate at all nesting levels:

```typescript
// Root container
<div className="flex-1 min-h-0 flex flex-col">
  {/* Tab bar */}
  <div className="flex-shrink-0 ...">...</div>
  
  {/* Terminal area */}
  <div className="flex-1 min-h-0">
    <TerminalLayout layout={terminalLayout} ... />
  </div>
</div>

// Split pane container
<div className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} flex-1 min-h-0 min-w-0`}>
  {children.map((child, i) => (
    <div key={i} style={{ flex: sizes[i] || 1 }} className="min-h-0 min-w-0">
      {/* Render child */}
    </div>
  ))}
</div>
```

### Fix 21: Add Resize Handles

**File:** `src/components/TerminalWindow.tsx`

```typescript
function ResizeHandle({ direction, onResize }: { direction: 'horizontal' | 'vertical'; onResize: (delta: number) => void }) {
  const startPos = useRef(0);
  const dragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    dragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`${
        direction === 'horizontal' 
          ? 'w-1 cursor-col-resize hover:w-1.5 hover:bg-cyan-500/30' 
          : 'h-1 cursor-row-resize hover:h-1.5 hover:bg-cyan-500/30'
      } bg-zinc-700/50 transition-all flex-shrink-0`}
    />
  );
}
```

---

## 7. Phase 6: UI Polish

### Fix 22: Problem List Redesign

**File:** `src/pages/TerminalPage.tsx` — ProblemsTab section

```typescript
const STATUS_COLORS: Record<string, string> = {
  'open': 'bg-red-500/15 text-red-400 border-red-500/20',
  'in-progress': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'resolved': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  'closed': 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const PRIORITY_INDICATORS: Record<string, string> = {
  'high': '🔴',
  'medium': '🟡',
  'low': '🟢',
};

function ProblemCard({ problem, onClick }: { problem: Problem; onClick: () => void }) {
  const statusClass = STATUS_COLORS[problem.status] || STATUS_COLORS['open'];
  
  return (
    <div
      onClick={onClick}
      className="px-3 py-2 border-b border-zinc-700/20 hover:bg-zinc-700/10 
                 cursor-pointer transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-[10px]">{PRIORITY_INDICATORS[problem.priority || 'medium']}</span>
        <span className="text-[11px] text-zinc-300 truncate flex-1">{problem.title}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${statusClass}`}>
          {problem.status || 'open'}
        </span>
      </div>
      {problem.category && (
        <div className="flex items-center gap-2 mt-1 ml-5">
          <CategoryBadge category={problem.category} />
          {problem.terminal_id && (
            <span className="text-[9px] text-zinc-600">
              Terminal {problem.terminal_id.slice(0, 6)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

### Fix 23: Rich File Display

**File:** `src/pages/TerminalPage.tsx` — FilesTab section

For AI infrastructure files (`agent/*.md`, `graphify-out/*.md`), render markdown as styled HTML instead of raw text:

```typescript
function AgentFileViewer({ filename, content }: { filename: string; content: string }) {
  // Detect file type
  const isProblems = filename.toLowerCase().includes('problems');
  const isGraph = filename.toLowerCase().includes('graph_report');
  const isSkill = filename.toLowerCase().includes('skill');
  const isAgent = filename.toLowerCase() === 'agents.md';

  if (isProblems) return <ProblemFileViewer content={content} />;
  if (isGraph) return <GraphReportViewer content={content} />;
  if (isSkill) return <SkillFileViewer content={content} />;
  if (isAgent) return <AgentContextViewer content={content} />;
  
  // Default: basic markdown rendering
  return <BasicMarkdownViewer content={content} />;
}

function BasicMarkdownViewer({ content }: { content: string }) {
  // Simple markdown → HTML transformation (no external library)
  const html = useMemo(() => {
    return content
      .replace(/^### (.+)$/gm, '<h3 class="text-[12px] text-zinc-300 font-medium mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-[13px] text-zinc-200 font-semibold mt-4 mb-1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-[14px] text-cyan-400 font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-200">$1</strong>')
      .replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1 py-0.5 rounded text-[10px] text-cyan-400">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="text-[11px] text-zinc-400 ml-3">$1</li>')
      .replace(/\n/g, '<br/>');
  }, [content]);

  return (
    <div className="p-3 text-[11px] text-zinc-400" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
```

### Fix 24: Context Sharpening / Deep Memory

**File:** `src/main.ts`

Add a session summarization handler that runs when a session ends:

```typescript
ipcMain.handle('summarize-session', async (_event, sessionId: string) => {
  const db = getDatabase();
  if (!db) return null;

  // Get last assistant message
  const lastMsg = db.prepare(`
    SELECT content FROM terminal_messages 
    WHERE session_id = ? AND role = 'assistant' 
    ORDER BY created_at DESC LIMIT 1
  `).get(sessionId) as { content: string } | undefined;

  // Get first user message
  const firstMsg = db.prepare(`
    SELECT content FROM terminal_messages 
    WHERE session_id = ? AND role = 'user' 
    ORDER BY created_at ASC LIMIT 1
  `).get(sessionId) as { content: string } | undefined;

  if (!firstMsg && !lastMsg) return null;

  // Simple keyword-based summary (no AI call needed)
  const firstText = firstMsg?.content?.slice(0, 200) || '';
  const lastText = lastMsg?.content?.slice(0, 200) || '';
  const summary = `Started: ${firstText.slice(0, 80)}. Ended: ${lastText.slice(0, 80)}`;

  // Save to session-summaries.json
  const projectPath = getProjectPath();
  const summariesPath = path.join(projectPath, 'agent', 'context', 'session-summaries.json');
  
  let summaries: any[] = [];
  if (fs.existsSync(summariesPath)) {
    try {
      summaries = JSON.parse(fs.readFileSync(summariesPath, 'utf-8')).summaries || [];
    } catch {}
  }

  summaries.push({
    id: sessionId,
    summary,
    endedAt: new Date().toISOString(),
  });

  // Keep last 50 summaries
  if (summaries.length > 50) summaries = summaries.slice(-50);

  fs.mkdirSync(path.dirname(summariesPath), { recursive: true });
  fs.writeFileSync(summariesPath, JSON.stringify({ summaries }, null, 2));

  return { summary };
});
```

---

## 8. Complete Data Flow — After All Fixes

```
═══════════════════════════════════════════════════════════════════════
                      SESSION CREATION (FIXED)
═══════════════════════════════════════════════════════════════════════

Setup button → NewSessionDialog → onCreate
  ① tracker-mind-setup init-all (ensures files exist)
  ② assembleContext(projectPath, contextConfig) ← TOGGLE CARDS CONTROL THIS
  ③ Merge system prompt layers:
     DEFAULT_SYSTEM_PROMPT → project additions → general additions → session additions
  ④ spawnTerminal() → node-pty creates child process
  ⑤ Write agent launch command (e.g., "claude\r")
  ⑥ Wait for agent:ready (signature detection)
  ⑦ Flush queue: system prompt block → init content block
  ⑧ setupActionsFileWatcher({ terminalId, projectPath })
  ⑨ Save session to DB

═══════════════════════════════════════════════════════════════════════
                      INSTRUCTION SEND (FIXED)
═══════════════════════════════════════════════════════════════════════

InstructionPanel → user composes → clicks Send
  ① handleInstructionPanelSend fires (NO LONGER A STUB)
  ② Compose: user text + linked problems + linked requests + skill content
  ③ Resolve target: @term → activeTerminalId → sendTargetSession → error
  ④ queueOrSend(terminalId, composedPrompt)
     ├─ Agent ready → terminalWrite(terminalId, prompt + '\r')
     └─ Agent not ready → queue, show "Queued" toast
  ⑤ Save to terminal_messages DB
  ⑥ Update terminal_bindings with linked entities

═══════════════════════════════════════════════════════════════════════
                      AI → APP COMMUNICATION (FIXED)
═══════════════════════════════════════════════════════════════════════

Agent writes agent/actions.json:
  { "actions": [{ "type": "create_problem", "data": {...} }] }

main.ts fs.watch detects change:
  ① executeActionsFromFile() reads JSON
  ② Performs CRUD via ProblemsService/RequestsService/ChecklistService
  ③ Clears actions.json
  ④ Dispatches context-changed IPC event ← NEW
  ⑤ Renderer receives event → reloads problem/request lists ← NEW

═══════════════════════════════════════════════════════════════════════
                      PROBLEM → TERMINAL (FIXED)
═══════════════════════════════════════════════════════════════════════

ProblemDetailModal → "Assign to Terminal":
  ① IPC assignProblemToTerminal → { terminalId, prompt }
  ② handleCreateTerminalForProblem:
     - Creates tab + layout
     - Queues problem prompt in messageQueueRef ← NEW (was missing)
     - Saves session with problem details
     - Updates terminal binding
     - setupActionsFileWatcher ← NEW
  ③ When agent:ready → queue flushes → prompt delivered to agent

═══════════════════════════════════════════════════════════════════════
                      MANUAL TERMINAL INPUT (FIXED)
═══════════════════════════════════════════════════════════════════════

User clicks terminal → xterm gets focus
  ① term.onData handler fires with keystroke data
  ② deskflowAPI.terminalWrite(terminalId, data)
  ③ main.ts terminal:write handler → pty.write(data)
  ④ PTY processes input → output appears in xterm

═══════════════════════════════════════════════════════════════════════
                      CONTEXT ASSEMBLY (FIXED — SINGLE PATH)
═══════════════════════════════════════════════════════════════════════

assembleContext(projectPath, contextConfig):
  ├─ If contextConfig.systems.llm_wiki.enabled → buildLLMWikiContext()
  ├─ If contextConfig.systems.obsidian_skills.enabled → buildSkillIndex()
  ├─ If contextConfig.systems.graphify.enabled → buildGraphifyContext()
  ├─ If contextConfig.systems.para.enabled → buildParaContext()
  ├─ If contextConfig.systems.qmd.enabled → buildQMDContext()
  ├─ If contextConfig.systems.automations.enabled → buildAutomationsContext()
  └─ If contextConfig.deep_memory.enabled → buildDeepMemoryContext()
  
  Each builder respects max_tokens budget
  Total stays within total_token_budget
  NO DUPLICATE CONTENT (buildInitContent is dead)
```

---

## 9. Implementation Order — Exact Sequence

```
Step 1: Wire onSend (Fix 1)
  File: TerminalPage.tsx line ~1384
  Change: onSend={handleInstructionPanelSend}
  Test: Open compose → type text → click Send → text appears in terminal

Step 2: Kill buildInitContent, use assembleContext only (Fix 2)
  File: TerminalPage.tsx — replace handleCreateSession
  File: NewSessionDialog.tsx — import ContextConfig, wire toggles
  Test: Toggle cards ON/OFF → verify content included/excluded

Step 3: Add UI refresh events (Fix 5)
  File: main.ts — add webContents.send after executeActionsFromFile
  File: TerminalPage.tsx — add onContextChanged listener
  Test: AI creates problem → problem appears in list immediately

Step 4: Fix terminal input (Fix 3)
  File: TerminalWindow.tsx — verify term.onData → terminalWrite
  Test: Click terminal → type → characters appear

Step 5: Fix problem prompt delivery (Fix 4)
  File: TerminalPage.tsx — add queue in handleCreateTerminalForProblem
  Test: Assign problem to terminal → agent receives problem description

Step 6: Wire tracker-mind-setup (Fix 6)
  File: TerminalPage.tsx — add call before assembleContext
  Test: Fresh project → Setup → AGENTS.md/INITIALIZE.md created

Step 7: Fix agent launch command (Fix 7)
  File: TerminalPage.tsx — use AGENT_LAUNCH_COMMANDS map
  Test: Select opencode → correct command written

Step 8: Add electron:execute-command (Fix 11)
  File: main.ts — add IPC handler
  File: preload.ts — add bridge
  Test: Click "Rebuild Graph" → graphify_maintain.py runs

Step 9: Fix prompt preview (Fix 15)
  File: TerminalPage.tsx — rebuild preview with all sections
  Test: Open preview → see system prompt + context + additions

Step 10: Fix drag-drop layout (Fix 19)
  File: TerminalWindow.tsx — fix onDragEnd handler
  Test: Drag tab → tab actually moves

Step 11: Fix split pane height (Fix 20)
  File: TerminalWindow.tsx — add min-h-0 at all levels
  Test: Split terminal → both panes visible, no cut-off

Step 12: Add resize handles (Fix 21)
  File: TerminalWindow.tsx — add ResizeHandle component
  Test: Drag handle → pane resizes

Step 13: Problem list redesign (Fix 22)
  File: TerminalPage.tsx — update ProblemsTab
  Test: Problems show badges, priorities, categories

Step 14: Rich file display (Fix 23)
  File: TerminalPage.tsx — add BasicMarkdownViewer
  Test: Click AGENTS.md → rendered HTML instead of raw markdown

Step 15: All remaining fixes (24-54)
  Fix session IDs, @term routing, save button, closing blink, etc.
```

---

## 10. File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `src/pages/TerminalPage.tsx` | All | Wire onSend, replace buildInitContent with assembleContext, add context-changed listener, fix handleCreateTerminalForProblem, fix session creation flow, fix prompt preview, problem list redesign, rich file display |
| `src/main.ts` | 1,3 | Add UI refresh events after actions, add electron:execute-command handler, verify workspace:save/load handlers |
| `src/preload.ts` | 3 | Add executeCommand bridge |
| `src/components/TerminalWindow.tsx` | 1,5 | Verify term.onData routing, fix drag-drop handler, fix split pane height, add resize handles |
| `src/components/NewSessionDialog.tsx` | 2 | Import ContextConfig from shared module, wire toggle cards to contextConfig state, remove duplicate type |
| `src/components/InstructionPanel.tsx` | 4 | Enlarge textarea, add target terminal indicator |
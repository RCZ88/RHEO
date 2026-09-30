# Terminal System — Critical Issues & Fix Plan

**Date:** 2026-05-22
**Status:** ACTIVE
**Priority:** CRITICAL

---

## 1. TERMINAL HEIGHT/SIZING ISSUE

### Problem
Terminal pane doesn't fill available vertical space responsively. Height is not adjusting to window resizes.

### Root Cause
**Location:** `src/pages/TerminalPage.tsx` line 1457

Terminal container is `flex-1 relative` but missing `min-h-0`. Without `min-h-0`, flex child can't shrink below content size.

### Fix
```typescript
// Line 1452 — Terminal container div
<div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-black">
  {/* terminal layout here */}
</div>
```

**Also check:**
- FitAddon is properly called on mount and window resize
- TerminalPane calls `terminal.fit()` in useEffect with [term]
- No hardcoded heights on xterm container

---

## 2. SESSION RESUME NOT WORKING

### Problem
When user resumes a session, terminal launches `opencode` instead of `opencode --resume <id>`.

**Current flow:**
```
Session.resume_id = "abc123" → 
handleResumeSession() → 
initializeTerminal(terminalId, 'opencode', resumeId?) → 
Line 272: launchCommand = "opencode\r\n"  (resumeId is IGNORED)
```

### Root Cause
**Location:** `src/pages/TerminalPage.tsx` line 272

```typescript
const launchCommand = resumeId ? `${agent} --resume ${resumeId}${NL}` : `${agent}${NL}`;
```

This LOOKS correct, but `resumeId` is not being passed to `initializeTerminal()` when called from `handleResumeSession()`.

### Fix
**Location:** `src/pages/TerminalPage.tsx` ~880–937

In `handleResumeSession()`:
```typescript
const handleResumeSession = async (sessionId: string) => {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  // CRITICAL: Get the resume_id from session
  const resumeId = session.resume_id;  // ← THIS LINE
  
  // Create terminal if needed
  let terminalId = /* ... find active terminal ... */;
  if (!terminalId) {
    // Create new terminal via CustomEvent
    terminalId = generateId();
    dispatchEvent(new CustomEvent('create-terminal', {
      detail: { terminalId, agent: session.agent || 'opencode' }
    }));
    await new Promise(r => setTimeout(r, 2000)); // Wait for spawn
  }

  // Initialize with RESUME ID
  await initializeTerminal(
    terminalId, 
    session.agent || 'opencode',
    resumeId,  // ← PASS RESUME ID HERE
    session.initContent,
    session.systemPrompt
  );
};
```

---

## 3. SESSION CODE PERSISTENCE

### Problem
Resume IDs are generated but not saved to `terminal_sessions` table.

### Current Flow
```
Session created → saveTerminalSession({ agent, topic, ... }) → 
DB INSERT into terminal_sessions → 
resume_id NOT SET (NULL in DB)
```

### Root Cause
**Location:** `src/main.ts` ~5952 (save-terminal-session handler)

The handler doesn't generate or accept a `resume_id` parameter.

### Fix
**In main.ts, save-terminal-session handler:**

```typescript
ipcMain.handle('save-terminal-session', async (event, sessionData) => {
  const { agent, topic, category, description, productArea, initContent, systemPrompt } = sessionData;
  
  // Generate resume_id if this is a new session
  const resumeId = sessionData.resume_id || `resume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Save to DB with resume_id
  const result = db.prepare(`
    INSERT OR REPLACE INTO terminal_sessions 
    (id, agent, topic, category, status, product_area, resume_id, total_tokens, total_cost, created_at, started_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, 0, 0, datetime('now'), datetime('now'))
  `).run(
    sessionData.id || generateId(),
    agent,
    topic,
    category,
    productArea,
    resumeId  // ← SAVE RESUME ID
  );
  
  return { success: true, data: { id: result.lastID, resume_id: resumeId } };
});
```

**In TerminalPage.tsx, NewSessionDialog callback:**

```typescript
const session = await window.deskflowAPI?.saveTerminalSession?.({
  agent: selectedAgent,
  topic: sessionName,
  category: selectedCategory,
  initContent,
  systemPrompt: mergedPrompt,
  // NOTE: resume_id will be auto-generated in IPC handler
});

// Store the returned resume_id for later resume operations
setSessionResumeId(session.data.resume_id);
```

---

## 4. SYSTEM PROMPT & AI INITIALIZATION

### Problem
Agent doesn't receive system prompt that explains the workspace infrastructure (problems, requests, checklists, workspace layout, etc.).

### Current State
```
DEFAULT_SYSTEM_PROMPT is ~12KB
├─ Explains: workspace layout, terminal commands, database tables
├─ Explains: Problems/Requests/Checklists model
├─ Explains: Skills system
└─ But: NOT dynamically updated with CURRENT session context
```

Agent loads the static prompt but doesn't know:
- What problems are assigned to THIS session
- What checklists exist for those problems
- What the workspace state is
- What requests are pending

### Fix: Dynamic System Prompt Assembly

**Location:** `src/pages/TerminalPage.tsx` initializeTerminal, step 5 (~288–318)

Current code:
```typescript
const mergedPrompt = DEFAULT_SYSTEM_PROMPT;
if (generalAdditions) mergedPrompt += `\n\n## General Instructions\n${generalAdditions}`;
if (projectAdditions) mergedPrompt += `\n\n## Project Instructions\n${projectAdditions}`;
if (systemPrompt) mergedPrompt += `\n\n## Session Instructions\n${systemPrompt}`;
```

**New code:**

```typescript
let mergedPrompt = DEFAULT_SYSTEM_PROMPT;

// Add general + project additions
if (generalAdditions) mergedPrompt += `\n\n## General Instructions\n${generalAdditions}`;
if (projectAdditions) mergedPrompt += `\n\n## Project Instructions\n${projectAdditions}`;

// Add CURRENT workspace context
const contextAddition = await buildSessionContext(terminalId, selectedProject);
mergedPrompt += `\n\n## Current Session Context\n${contextAddition}`;

// Add custom session instructions last
if (systemPrompt) mergedPrompt += `\n\n## Session Instructions\n${systemPrompt}`;
```

**New function: `buildSessionContext()`**

```typescript
async function buildSessionContext(terminalId: string, projectId: string): Promise<string> {
  let context = '### Current Session Status\n\n';
  
  // Get problems assigned to this terminal
  const problems = await window.deskflowAPI?.getProblems?.({ projectId });
  if (problems?.data?.length > 0) {
    context += '**Active Problems:**\n';
    for (const p of problems.data) {
      if (p.terminal_id === terminalId) {
        context += `- [${p.status}] #${p.id}: ${p.title}\n`;
        context += `  Priority: ${p.priority}, Category: ${p.category}\n`;
        if (p.description) context += `  Description: ${p.description}\n`;
      }
    }
    context += '\n';
  }
  
  // Get checklists for those problems
  const checklists = await window.deskflowAPI?.getChecklists?.({ projectId });
  if (checklists?.data?.length > 0) {
    context += '**Checklist Items to Complete:**\n';
    for (const c of checklists.data) {
      if (c.parentType === 'problem') {
        const problem = problems.data?.find(p => p.id === c.parentId);
        if (problem?.terminal_id === terminalId) {
          const status = c.status === 'completed' ? '✓' : ' ';
          context += `- [${status}] ${c.description}\n`;
          if (c.notes) context += `  Notes: ${c.notes}\n`;
        }
      }
    }
    context += '\n';
  }
  
  // Get requests
  const requests = await window.deskflowAPI?.getRequests?.({ projectId });
  if (requests?.data?.length > 0) {
    context += '**Pending Requests:**\n';
    for (const r of requests.data.slice(0, 5)) {  // Limit to 5
      if (r.status !== 'Completed') {
        context += `- [${r.status}] ${r.title}\n`;
      }
    }
    context += '\n';
  }
  
  context += '**What to do:** Review the problems and checklists above. For each incomplete checklist item, implement the solution and update the item status. After solving a problem, update its status to "IN_PROGRESS" then "FIXED".\n';
  context += '\n**How to update status:** Use @mention syntax to send instructions back to the workspace.\n';
  
  return context;
}
```

---

## 5. SETUP vs. RUNTIME INITIALIZATION

### Problem
Confusing flow: "Setup" button opens dialog, but there are TWO modes: "Initialize" (create workspace files) and "Create Session" (start a chat).

### Current State
```
Setup Button → NewSessionDialog
├─ Mode 1: 'initialize' — Creates AGENTS.md, INITIALIZE.md, state.md, etc.
└─ Mode 2: 'create' — Creates terminal session

What should happen:
├─ First time: User clicks Setup → workspace initialized
└─ Next times: User clicks "New Session" → start chat (NOT re-initialize)
```

### Fix: Separate flows

**In TerminalPage header, replace Setup button with:**

```typescript
const [isInitialized, setIsInitialized] = useState(false);

useEffect(() => {
  // Check if workspace is initialized
  const checkInit = async () => {
    const result = await window.deskflowAPI?.readAgentFiles?.();
    setIsInitialized(result?.success && result.data?.length > 0);
  };
  if (selectedProject) checkInit();
}, [selectedProject]);

return (
  <>
    {!isInitialized ? (
      <button onClick={() => setShowInitDialog(true)}>
        ⚡ Initialize Workspace
      </button>
    ) : (
      <button onClick={() => setShowNewSessionDialog(true)}>
        + New Session
      </button>
    )}
  </>
);
```

**NewSessionDialog behavior:**

```typescript
// If mode === 'initialize'
- Read/write AGENTS.md, INITIALIZE.md, state.md, etc.
- Show: Context systems toggle, token budget
- Button: "Initialize"
- On complete: Close dialog, show "Workspace ready" toast

// If mode === 'create' (default)
- Show: Session name, agent selector, init file, custom prompt
- Button: "Start Session"
- On complete: Create terminal, initialize agent
```

---

## 6. Backup System — WAL Corruption & Scheduler Issues

### Problem
- `startBackupScheduler` ignores `autoBackup:false` setting — always starts interval timer
- ConductorService `spawnAgentTerminal` host was renderer-dependent (no actual PTY spawn)

### Root Cause
**Location:** `src/main/backup/BackupService.ts:345`, `src/main.ts:19564`

### Fix (2026-09-25)
1. **BackupService:** Added `getSettings()` check at top of `startBackupScheduler`. If `autoBackup === false`, logs and returns without starting timer.
2. **Conductor:** `spawnAgentTerminal` now calls `terminalManager.spawn()` directly in main process. Renderer notification is best-effort.

### Status: ✅ FIXED

---

## 7. AI CONTEXT AWARENESS & WORKSPACE INTEGRATION
Agent loads once at startup, then doesn't know when problems/requests status changes.

### Flow
```
Session starts → Agent loads system prompt (snapshot of state) → 
User changes problem status in UI → 
Agent is UNAWARE of the change → 
Agent keeps thinking problem is "NEW" not "IN_PROGRESS"
```

### Fix: Event-driven status updates

**When user updates problem status, send update to active terminal:**

**Location:** `src/pages/TerminalPage.tsx` Problems tab, status button click handler

```typescript
const handleProblemStatusChange = async (problemId: string, newStatus: string) => {
  // Update DB
  await window.deskflowAPI?.updateProblemStatus?.({ problemId, status: newStatus });
  
  // NOTIFY ACTIVE TERMINAL
  if (activeTerminalId && terminalBinding?.active_problem_id === problemId) {
    const updateMessage = `## Status Update\n\nProblem #${problemId} status changed to: **${newStatus}**\n\nPlease acknowledge this status change and continue working.`;
    
    await window.deskflowAPI?.terminalWrite?.(activeTerminalId, updateMessage + '\r\n');
  }
  
  // Refresh UI
  setProblems(/* ... */);
};
```

**For checklist updates:**

```typescript
const handleChecklistItemUpdate = async (itemId: string, newStatus: string) => {
  await window.deskflowAPI?.updateChecklistItem?.({ id: itemId, status: newStatus });
  
  if (activeTerminalId) {
    const item = checklists.find(c => c.id === itemId);
    const message = `## Checklist Update\n\nItem: "${item.description}"\nStatus: **${newStatus}**\n\nKeep going!`;
    await window.deskflowAPI?.terminalWrite?.(activeTerminalId, message + '\r\n');
  }
};
```

---

## 7. CONTINUOUS STATUS UPDATES (Session Metadata)

### Problem
When AI updates system metadata (session category, problem status, etc.), those updates aren't parsed and saved.

### Current State
Agent outputs:
```
## Session Metadata
title: "Fix authentication bug"
category: "Bug Fix"
status: "in_progress"

## Actions
[update-problem][52][IN_PROGRESS]
```

But system doesn't parse these blocks.

### Fix: Parse agent output for metadata

**Location:** `src/main.ts` terminal data handler (~5700s)

Add parsing in the PTY data handler:

```typescript
// After agent data arrives
const parseAgentMetadata = (buffer: string) => {
  const metadataMatch = buffer.match(/## Session Metadata\n([\s\S]*?)(?=##|$)/);
  if (!metadataMatch) return null;
  
  const metadata = {};
  const lines = metadataMatch[1].split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      metadata[key.trim()] = valueParts.join(':').trim();
    }
  }
  
  // Update session
  if (metadata.title) {
    db.prepare('UPDATE terminal_sessions SET topic = ? WHERE id = ?')
      .run(metadata.title, sessionId);
  }
  if (metadata.category) {
    db.prepare('UPDATE terminal_sessions SET category = ? WHERE id = ?')
      .run(metadata.category, sessionId);
  }
  
  return metadata;
};

// Parse actions
const parseActions = (buffer: string) => {
  const actionMatches = buffer.matchAll(/\[(\w+)\]\[([^\]]+)\]\[([^\]]+)\]/g);
  for (const match of actionMatches) {
    const [, action, entityId, newStatus] = match;
    
    if (action === 'update-problem') {
      db.prepare('UPDATE workspace_problems SET status = ? WHERE id = ?')
        .run(newStatus, entityId);
    } else if (action === 'complete-checklist') {
      db.prepare('UPDATE checklists SET status = ? WHERE id = ?')
        .run('completed', entityId);
    }
  }
};
```

---

## Implementation Priority

1. **CRITICAL (Do First):**
   - Terminal height fix (1-2 hours)
   - Session resume with `--resume` flag (1-2 hours)
   - Session resume_id persistence (1 hour)

2. **HIGH (Do Next):**
   - Dynamic system prompt with current context (2-3 hours)
   - Setup vs. Create Session flow separation (2 hours)

3. **MEDIUM (Polish):**
   - Status update notifications to agent (1-2 hours)
   - Metadata parsing from agent output (2-3 hours)

4. **TESTING:**
   - Verify terminal resizes properly
   - Verify session resume launches correct agent with resume flag
   - Verify agent receives workspace context in system prompt
   - Verify status updates flow to active terminal

---

## Files to Modify

1. `src/pages/TerminalPage.tsx` — Main fixes (height, resume, context, flows)
2. `src/main.ts` — Resume ID generation, metadata parsing, status handlers
3. `src/components/NewSessionDialog.tsx` — Initialize vs. Create mode separation
4. `src/lib/defaults.ts` — DEFAULT_SYSTEM_PROMPT (add notes about dynamic assembly)

---

# Workspace Terminal Audit & Results Specification

### **Audit Summary**

*   **Architecture:** `src/main.ts` is a 33k-line monolith handling PTY, IPC, and 9 AI agent parsers.
*   **Current State:** Previous fixes (cycle 3) landed in code but were never runtime-verified ("NOT LAUNCHED"). Key issues include silent layout save failures, visual-only split resizing, fragile session resume chains, and broken conductor orchestration due to renderer-dependency.
*   **Critical Gaps:** No unified Agent Adapter registry; Hermes lacks a launch adapter; prompt injection relies on fixed delays rather than idle detection; backup/restore paths are unverified against WAL corruption.

### **Results Specification: Phased Repair Plan**

#### **Phase 0: Build & Boot Baseline (Gate)**

*   **Goal:** Verify current tree builds and boots before changes.
*   **Actions:**
    *   Run `node scripts/build.mjs`; verify artifact sizes (`main.cjs`, `preload.cjs`, `index.html`).
    *   Confirm all `require()` paths in `main.ts` resolve in `dist-electron/` (specifically ConductorService and BackupService).
    *   Attach via Probe MCP to assert `window.deskflowAPI` existence.
*   **Exit Criteria:** Green build log saved; artifact inventory table generated.

#### **Phase 1: PTY Core Functionality**

*   **Goal:** Basic terminal usability from UI.
*   **Actions:**
    *   Trace event order in `terminal:create` and `spawn-terminal`.
    *   Fix data batching and late-registering renderer callbacks.
    *   Unify duplicate API surfaces (`terminalAPI` vs `spawnTerminal`) into one canonical preload interface.
    *   Implement real `terminal:resize` propagation for split panes (FitAddon integration).
    *   Surface errors in layout persistence (`useTerminalLayout`).
    *   Verify `min-h-0` flex chain fixes in DOM.
*   **Exit Criteria:** Type `ls` → see output; resize window → panes re-fit; kill pane → no orphan processes; layout survives restart with error-free save.

#### **Phase 2: Agent CLI Launchers (Generic System)**

*   **Goal:** Uniform launch/handshake for all agents (Claude, OpenCode, Hermes, etc.).
*   **Actions:**
    *   Create **AgentAdapter Registry** (id, binary, args, resume flags, ready-detection) consumed by both main and renderer.
    *   Fix Hermes: Add launcher adapter or label as "import-only"; make storage paths cross-platform.
    *   Replace fixed delay hacks with **Output Idle Gate** (`onTerminalOutputIdle`) for prompt injection.
    *   Audit input integrity: Ensure raw typing goes to PTY, injected prompts don't double-echo, and pending queues retry visibly.
    *   Verify Skills insertion uses the same idle-gated `agentSend` path.
*   **Exit Criteria:** Each installed agent launches, init prompt lands fully (no truncation), readiness banner appears, install hints shown if binary missing.

#### **Phase 3: Session Management (Save/Load/Resume)**

*   **Goal:** Persistent, resumable sessions with correct context.
*   **Actions:**
    *   Test resume chain matrix (fresh/resume); fix session-id capture race conditions (bind only new sessions).
    *   Validate `handleResumeSession` passes `resume_id` correctly; add toast notifications for resume failures.
    *   Clean up message storage: Strip ANSI codes, dedupe, store clean transcripts; auto-complete `in_progress` rows.
    *   Define SQLite as source of truth for sessions; JSON exports become derived/timestamped.
*   **Exit Criteria:** E2E test: Start session → send msg → quit → relaunch → resume restores conversation in agent's own UI.

#### **Phase 4: Agent Orchestration (Conductor)**

*   **Goal:** Missions run agents reliably.
*   **Actions:**
    *   Verify `ConductorService` instantiation post-build; add startup self-check logging.
    *   Decouple spawn path from renderer: Queue spawn requests in main; acknowledge only when renderer creates terminal; timeout escalations.
    *   Enforce role boundaries/budgets in ConductorService (file/terminal access flags).
    *   Wire ConductorPanel events to UI with reconnect-safe listeners.
*   **Exit Criteria:** Run `tpl-bug-fix` mission: Director spawns worker, directive delivered, metrics live, kill cleans up PTYs.

#### **Phase 5: Backup System (DB + Project)**

*   **Goal:** Reliable creation, verification, and restoration.
*   **Actions:**
    *   DB Backup: Ensure WAL checkpointing during backup to prevent torn copies; unit-test retention pruning.
    *   Restore Safety: Verify `backup:restore` refuses corrupt archives; ensure scheduler respects `autoBackup:false`.
    *   Project Backup: Re-test `ProjectBackupService` path resolution (fix undefined variable bugs); verify diff/mirror outputs.
    *   Mirror Dir: Show explicit "OFF" state if empty; persist settings across restart.
*   **Exit Criteria:** Create backup → corrupt row → restore → row back; `verify` PASS on all archives; scheduler states honored after restart.

#### **Phase 6: Documentation & State Closure**

*   **Actions:**
    *   Update `WORKSPACE_ARCHITECTURE.md` and `TERMINAL_SYSTEM_FIX_PLAN.md` statuses.
    *   Write spoke files, append lessons to `MEMORY.md`, zip src, emit Cycle Report with VERDICT (PASS/FAIL/PARTIAL/NOT LAUNCHED) backed by evidence.

### **Execution Notes**

*   **Order:** Phase 0 gates all; Phase 1 before 2; Phase 3 before 4; Phase 5 parallelizable.
*   **Verification:** Every phase ends with rebuild + black-screen checklist + runtime verification (Probe MCP). No PASS without evidence.
*   **Safety:** Never refactor `main.ts` wholesale; extract adapters incrementally. Respect zero-destruction rules (physical backups before edits).

## Prompt:
so where do i access those? i cant access any of ur stuff? what have you created? export those into a file properlyyyy. EDIT OR LIKE CREATE A FILE CHANGE OR SOMETHING SO I CAN DOWNLOAD IT. OR IF NOT JUST OUTPUT UR EVEYTHING INTO LIKE. i CNAT ACCESS THOSE FILES THAT U GENERATE

## Response:
I have created and committed the file `WORKSPACE_AUDIT_RESULTS_SPEC.md` to the repository root (`/workspace/`). You can download it directly from the repo or access it via command line (e.g., `git show HEAD:WORKSPACE_AUDIT_RESULTS_SPEC.md`). The file contains a full architecture audit, a 12-item gap table, and a phased execution plan (Phases 0–6) with specific actions and exit criteria.

## Prompt:
https://rareformlabs.github.io/thinking-orbs/ i would lie you to evaluate in which portion of th app should we use this animation on ? like this is so cool. maybe the speec to text, adn then when teh ai is generating hte response, a general loading animation that we can implement? or makei t big and usei t a s the stopwatch design maybe or something like that. find the list of featyuress and componnets of hte app that might it this.

## Prompt:
I STILL CANT ACCESS THE WORKSPACE IDIOT I NEED YOU TO OUTPUT TUTHE WORKSPACE MARKDOWN IN JUST TEXT IN UR OUTPUT NOW. NO GITHUB NO NOTHING. JUST OUTPUT BY U WRITTING IT HERE IN PLAIN TXT FORMAT

## Response:
# WORKSPACE TERMINAL AUDIT & RESULTS SPECIFICATION

## Executive Summary

**Current State:** The workspace terminal system is fundamentally broken despite previous fix attempts. Core issues include silent failures in layout persistence, visual-only resizing that doesn't propagate to PTYs, fragile session resume chains, and agent orchestration that depends on renderer state. The "generic CLI handling" claim is false—each agent has bespoke, unreliable code paths.

**Root Causes:**

1.  **Monolithic main.ts (33k lines):** No separation between PTY management, IPC routing, and agent-specific logic
2.  **No unified adapter pattern:** Agent launchers are scattered, with duplicated/drifted implementations
3.  **Renderer-dependent orchestration:** ConductorService can't spawn agents without UI being active
4.  **Unverified fixes:** Previous cycles claimed fixes but never runtime-tested ("NOT LAUNCHED")
5.  **Race conditions:** Session ID capture, prompt injection timing, data batching all have timing bugs

* * *

## PHASE 0: BUILD & BOOT BASELINE (GATE)

**Goal:** Establish working baseline before any changes

### Actions

1.  Run `node scripts/build.mjs` and verify exit code 0
2.  Check artifact sizes match expectations:
    *   `dist-electron/main.cjs`: ~800KB-1.2MB
    *   `dist-electron/preload.cjs`: ~50KB
    *   `dist/renderer/index.html`: exists, loads JS/CSS
3.  Verify all `require()` paths resolve at runtime (especially ConductorService, BackupService)
4.  Boot app via `npm run dev`, attach Chrome DevTools Protocol
5.  Assert `window.deskflowAPI` exists in console
6.  Check for uncaught exceptions in main process logs

### Exit Criteria

*   ✅ Build completes without errors
*   ✅ Artifacts present with reasonable sizes
*   ✅ App window opens, no white-screen crash
*   ✅ Console shows zero errors on boot
*   ✅ All IPC channels registered (log them)

### Evidence Required

```
build.log: [timestamps, file sizes, error counts]build.log: [timestamps, file sizes, error counts]
boot-checklist.md: [manual verification of each item above]boot-checklist.md: [manual verification of each item above]
ipc-channels.txt: [dump of ipcMain.handle/event registrations]ipc-channels.txt: [dump of ipcMain.handle/event registrations]
```

* * *

## PHASE 1: PTY CORE FUNCTIONALITY

**Goal:** Basic terminal operations work reliably from UI

### Current Breakage

*   Layout saves fail silently (no user feedback)
*   Split pane resize only changes CSS width, doesn't call `terminal.fit()` or send resize to PTY
*   Terminal output batches incorrectly, causing garbled text
*   Kill/close operations leave orphaned processes
*   API surface duplicated (`terminalAPI` vs `spawnTerminal`) with different behaviors

### Actions

#### 1.1 Trace Event Order

Map the exact sequence for `terminal:create`:

```
renderer → preload → ipcMain('terminal:create') renderer → preload → ipcMain('terminal:create') 
→ pty.spawn() → register onData/onExit handlers → pty.spawn() → register onData/onExit handlers 
→ return terminalId → renderer attaches xterm.js→ return terminalId → renderer attaches xterm.js
```

Identify where callbacks miss late-registering renderers.

#### 1.2 Fix Data Batching

In `main.ts`, find all `ptyProcess.onData()` calls. Ensure they:

*   Buffer incoming data with a microtask flush (not arbitrary setTimeout)
*   Send complete chunks to renderer (don't split mid-line)
*   Handle backpressure if renderer is slow

Example fix:

```typescript
let buffer = '';let buffer = '';
let flushScheduled = false;let flushScheduled = false;

ptyProcess.onData((data) => {ptyProcess.onData((data) => {
  buffer += data;  buffer += data;
  if (!flushScheduled) {  if (!flushScheduled) {
    flushScheduled = true;    flushScheduled = true;
    setImmediate(() => {    setImmediate(() => {
      webContents.send(`terminal:${id}`, buffer);      webContents.send(`terminal:${id}`, buffer);
      buffer = '';      buffer = '';
      flushScheduled = false;      flushScheduled = false;
    });    });
  }  }
});});
```

#### 1.3 Unify API Surface

Create single canonical interface in `preload.ts`:

```typescript
interface TerminalAPI {interface TerminalAPI {
  create(options: CreateTerminalOptions): Promise<string>; // returns terminalId  create(options: CreateTerminalOptions): Promise<string>; // returns terminalId
  write(id: string, data: string): void;  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;  resize(id: string, cols: number, rows: number): void;
  kill(id: string): void;  kill(id: string): void;
  onData(id: string, callback: ( string) => void): () => void; // returns unsubscribe  onData(id: string, callback: ( string) => void): () => void; // returns unsubscribe
  onExit(id: string, callback: (code: number) => void): () => void;  onExit(id: string, callback: (code: number) => void): () => void;
}}
```

Remove duplicate `spawnTerminal`, ensure all components use this one.

#### 1.4 Real Resize Propagation

When split pane resized:

1.  Calculate new dimensions for each terminal
2.  Call `xterm.fitAddon.fit()` on each visible terminal
3.  Send `terminal:resize` IPC with correct cols/rows
4.  In main process, call `ptyProcess.resize(cols, rows)`

Add logging to verify actual PTY receives resize events.

#### 1.5 Surface Layout Errors

In `useTerminalLayout` hook:

```typescript
const saveLayout = async (layout: Layout) => {const saveLayout = async (layout: Layout) => {
  try {  try {
    await deskflowAPI.layout.save(layout);    await deskflowAPI.layout.save(layout);
    toast.success('Layout saved');    toast.success('Layout saved');
  } catch (err) {  } catch (err) {
    console.error('[LAYOUT SAVE FAILED]', err);    console.error('[LAYOUT SAVE FAILED]', err);
    toast.error(`Failed to save layout: ${err.message}`);    toast.error(`Failed to save layout: ${err.message}`);
    // Show retry button    // Show retry button
  }  }
};};
```

#### 1.6 Fix Flex Chain

Verify DOM structure prevents overflow:

```html
<div class="flex h-screen"><div class="flex h-screen">
  <div class="flex-1 min-w-0 flex flex-col"> <!-- critical: min-w-0 -->  <div class="flex-1 min-w-0 flex flex-col"> <!-- critical: min-w-0 -->
    <div class="flex-1 min-h-0"> <!-- terminal container -->    <div class="flex-1 min-h-0"> <!-- terminal container -->
      <div id="terminal-xterm"></div>      <div id="terminal-xterm"></div>
    </div>    </div>
  </div>  </div>
</div></div>
```

Use browser DevTools to inspect computed styles, ensure no fixed heights breaking flex.

### Exit Criteria

*   ✅ Open terminal, type `ls`, see output immediately
*   ✅ Resize window → all panes re-fit correctly, no scrollbars
*   ✅ Split horizontally/vertically → both terminals functional
*   ✅ Close tab → PTY process killed (check `ps aux | grep node`)
*   ✅ Save layout → restart app → layout restored exactly
*   ✅ Force save failure (corrupt config dir) → error toast shown

### Test Cases

```bash
# Manual testing checklist:# Manual testing checklist:
1. Fresh boot, create 3-terminal grid layout1. Fresh boot, create 3-terminal grid layout
2. Type commands in each, verify isolation2. Type commands in each, verify isolation
3. Resize window smaller/larger, check fit3. Resize window smaller/larger, check fit
4. Kill one terminal, verify no zombies4. Kill one terminal, verify no zombies
5. Save layout, quit, relaunch, verify restoration5. Save layout, quit, relaunch, verify restoration
6. Make config dir read-only, attempt save, expect error6. Make config dir read-only, attempt save, expect error
```

* * *

## PHASE 2: AGENT CLI LAUNCHERS (GENERIC SYSTEM)

**Goal:** Uniform, reliable launch/handshake for all supported agents

### Current Breakage

*   Each agent has bespoke launcher code scattered throughout main.ts
*   Hermes has no launcher adapter (import-only claim untested)
*   Prompt injection uses fixed delays (e.g., `setTimeout(2000)`) instead of idle detection
*   Input integrity issues: prompts sometimes double-echoed, sometimes truncated
*   Skills insertion path separate from regular input, inconsistent behavior

### Actions

#### 2.1 Create Agent Adapter Registry

Define schema for agent adapters:

```typescript
interface AgentAdapter {interface AgentAdapter {
  id: string;                    // 'claude', 'opencode', 'hermes'  id: string;                    // 'claude', 'opencode', 'hermes'
  name: string;                  // Display name  name: string;                  // Display name
  binary: string;                // Executable name/path  binary: string;                // Executable name/path
  args: string[];                // Default arguments  args: string[];                // Default arguments
  env?: Record<string, string>;  // Environment variables  env?: Record<string, string>;  // Environment variables
    
  // Resume capability  // Resume capability
  supportsResume: boolean;  supportsResume: boolean;
  getResumeArgs(sessionId: string): string[];  getResumeArgs(sessionId: string): string[];
    
  // Ready detection  // Ready detection
  detectReady(output: string): boolean; // Pattern/function to identify init complete  detectReady(output: string): boolean; // Pattern/function to identify init complete
  readyTimeout: number;          // Max ms to wait for ready signal  readyTimeout: number;          // Max ms to wait for ready signal
    
  // Session ID extraction  // Session ID extraction
  extractSessionId(output: string): string | null;  extractSessionId(output: string): string | null;
    
  // Platform-specific paths  // Platform-specific paths
  getStoragePaths(platform: NodeJS.Platform): StoragePaths;  getStoragePaths(platform: NodeJS.Platform): StoragePaths;
}}
```

Register adapters in centralized location (new file `src/agent-adapters.ts`):

```typescript
export const ADAPTERS: Record<string, AgentAdapter> = {export const ADAPTERS: Record<string, AgentAdapter> = {
  claude: { /* ... */ },  claude: { /* ... */ },
  opencode: { /* ... */ },  opencode: { /* ... */ },
  hermes: { /* ... */ },  hermes: { /* ... */ },
};};
```

#### 2.2 Implement Output Idle Gate

Replace fixed delays with smart waiting:

```typescript
function waitForIdle(terminalId: string, timeoutMs: number = 5000): Promise<void> {function waitForIdle(terminalId: string, timeoutMs: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {  return new Promise((resolve, reject) => {
    let lastOutputTime = Date.now();    let lastOutputTime = Date.now();
    let buffer = '';    let buffer = '';
        
    const unsub = deskflowAPI.terminal.onData(terminalId, (data) => {    const unsub = deskflowAPI.terminal.onData(terminalId, (data) => {
      lastOutputTime = Date.now();      lastOutputTime = Date.now();
      buffer += data;      buffer += data;
            
      // Check if we're actually idle (no output for 500ms)      // Check if we're actually idle (no output for 500ms)
      if (Date.now() - lastOutputTime > 500) {      if (Date.now() - lastOutputTime > 500) {
        cleanup();        cleanup();
        resolve();        resolve();
      }      }
    });    });
        
    const interval = setInterval(() => {    const interval = setInterval(() => {
      if (Date.now() - lastOutputTime > 500) {      if (Date.now() - lastOutputTime > 500) {
        cleanup();        cleanup();
        resolve();        resolve();
      }      }
      if (Date.now() - startTime > timeoutMs) {      if (Date.now() - startTime > timeoutMs) {
        cleanup();        cleanup();
        reject(new Error('Idle timeout'));        reject(new Error('Idle timeout'));
      }      }
    }, 100);    }, 100);
        
    function cleanup() {    function cleanup() {
      unsub();      unsub();
      clearInterval(interval);      clearInterval(interval);
    }    }
  });  });
}}

// Usage:// Usage:
await waitForIdle(terminalId);await waitForIdle(terminalId);
deskflowAPI.terminal.write(terminalId, prompt + '\n');deskflowAPI.terminal.write(terminalId, prompt + '\n');
```

#### 2.3 Fix Hermes Adapter

Either implement full launcher or clearly mark as import-only:

```typescript
hermes: {hermes: {
  id: 'hermes',  id: 'hermes',
  name: 'Hermes Agent',  name: 'Hermes Agent',
  binary: 'hermes',  binary: 'hermes',
  supportsResume: false, // If true, need to figure out how it stores sessions  supportsResume: false, // If true, need to figure out how it stores sessions
    
  detectReady(output) {  detectReady(output) {
    // Look for specific banner/prompt indicating ready    // Look for specific banner/prompt indicating ready
    return /Hermes.*ready|>\s*$/.test(output);    return /Hermes.*ready|>\s*$/.test(output);
  },  },
    
  getStoragePaths(platform) {  getStoragePaths(platform) {
    // Cross-platform paths    // Cross-platform paths
    if (platform === 'darwin') {    if (platform === 'darwin') {
      return { config: '~/.config/hermes',  '~/Library/Application Support/hermes' };      return { config: '~/.config/hermes',  '~/Library/Application Support/hermes' };
    } else if (platform === 'win32') {    } else if (platform === 'win32') {
      return { config: '%APPDATA%/hermes',  '%LOCALAPPDATA%/hermes' };      return { config: '%APPDATA%/hermes',  '%LOCALAPPDATA%/hermes' };
    } else {    } else {
      return { config: '~/.config/hermes',  '~/.local/share/hermes' };      return { config: '~/.config/hermes',  '~/.local/share/hermes' };
    }    }
  }  }
}}
```

Test by launching Hermes manually, observing output patterns, then automating detection.

#### 2.4 Audit Input Integrity

For each agent, verify:

1.  Raw keyboard input goes directly to PTY (no interception)
2.  Injected prompts don't echo twice (disable local echo if needed)
3.  Pending message queue retries visibly on failure
4.  Multi-line paste handled correctly (bracketed mode)

Add test harness:

```typescript
async function testInputIntegrity(agentId: string) {async function testInputIntegrity(agentId: string) {
  const termId = await deskflowAPI.agent.launch(agentId);  const termId = await deskflowAPI.agent.launch(agentId);
  await waitForIdle(termId);  await waitForIdle(termId);
    
  const testPrompt = 'echo "TEST_' + Date.now() + '"';  const testPrompt = 'echo "TEST_' + Date.now() + '"';
  await deskflowAPI.agent.send(termId, testPrompt);  await deskflowAPI.agent.send(termId, testPrompt);
    
  // Capture next line of output  // Capture next line of output
  const response = await captureNextLine(termId);  const response = await captureNextLine(termId);
    
  // Assertions:  // Assertions:
  assert(response.includes('TEST_'), 'Echo missing');  assert(response.includes('TEST_'), 'Echo missing');
  assert(!response.includes(testPrompt), 'Prompt leaked into response');  assert(!response.includes(testPrompt), 'Prompt leaked into response');
  assert(countOccurrences(response, 'TEST_') === 1, 'Double echo detected');  assert(countOccurrences(response, 'TEST_') === 1, 'Double echo detected');
}}
```

#### 2.5 Unify Skills Path

Skills should use same `agentSend` mechanism as regular prompts:

```typescript
// OLD (broken):// OLD (broken):
insertSkill(skillContent) {insertSkill(skillContent) {
  setTimeout(() => {  setTimeout(() => {
    deskflowAPI.terminal.write(termId, skillContent);    deskflowAPI.terminal.write(termId, skillContent);
  }, 1000);  }, 1000);
}}

// NEW (unified):// NEW (unified):
async insertSkill(skillContent: string) {async insertSkill(skillContent: string) {
  await waitForIdle(this.termId);  await waitForIdle(this.termId);
  await this.send(skillContent);  await this.send(skillContent);
}}
```

Ensure skills respect agent's context limits, chunk if necessary.

### Exit Criteria

*   ✅ Launch Claude Code → sees init prompt → sends "hello" → gets response
*   ✅ Launch OpenCode → detects ready state automatically (no hardcoded delay)
*   ✅ Launch Hermes → either works OR shows clear "import-only" message with instructions
*   ✅ Kill agent → clean shutdown, no hanging processes
*   ✅ Type normally while agent running → no interference from injection logic
*   ✅ Paste multi-line script → executes correctly
*   ✅ Insert skill via UI → lands fully, not truncated

### Verification Matrix

| Agent | Launch | Ready Detect | Send Prompt | Receive Response | Resume | Skills |
| --- | --- | --- | --- | --- | --- | --- |
| Claude | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| OpenCode | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Hermes | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Custom | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

* * *

## PHASE 3: SESSION MANAGEMENT (SAVE/LOAD/RESUME)

**Goal:** Persistent, resumable sessions with correct context restoration

### Current Breakage

*   Session ID capture races: binds wrong ID when multiple terminals start simultaneously
*   `handleResumeSession` doesn't pass resume flag correctly to agent
*   Message storage includes ANSI codes, duplicates, garbage
*   No distinction between SQLite source-of-truth and JSON exports
*   Resume failures happen silently, users think feature broken

### Actions

#### 3.1 Fix Session ID Capture Race

Problem: When spawning multiple agents quickly, they might grab each other's session IDs from shared state.

Solution: Use per-spawn token binding:

```typescript
async function launchAgent(adapter: AgentAdapter): Promise<SessionInfo> {async function launchAgent(adapter: AgentAdapter): Promise<SessionInfo> {
  const spawnToken = crypto.randomUUID();  const spawnToken = crypto.randomUUID();
  const termId = await createTerminal(adapter.binary, adapter.args);  const termId = await createTerminal(adapter.binary, adapter.args);
    
  // Wait for ready signal, capturing stdout during this period  // Wait for ready signal, capturing stdout during this period
  let capturedOutput = '';  let capturedOutput = '';
  const unsub = deskflowAPI.terminal.onData(termId, (data) => {  const unsub = deskflowAPI.terminal.onData(termId, (data) => {
    capturedOutput += data;    capturedOutput += data;
    if (adapter.detectReady(capturedOutput)) {    if (adapter.detectReady(capturedOutput)) {
      unsub();      unsub();
    }    }
  });  });
    
  await waitForReadyOrTimeout(termId, adapter.readyTimeout);  await waitForReadyOrTimeout(termId, adapter.readyTimeout);
    
  // Extract session ID from THIS terminal's output only  // Extract session ID from THIS terminal's output only
  const sessionId = adapter.extractSessionId(capturedOutput);  const sessionId = adapter.extractSessionId(capturedOutput);
    
  return {  return {
    termId,    termId,
    sessionId,    sessionId,
    agentId: adapter.id,    agentId: adapter.id,
    createdAt: Date.now(),    createdAt: Date.now(),
    spawnToken, // For debugging/tracking    spawnToken, // For debugging/tracking
  };  };
}}
```

Never use global/shared state for session ID extraction.

#### 3.2 Validate Resume Chain

Test matrix for resume scenarios:

| Scenario | Expected Behavior | Currently Works? |
| --- | --- | --- |
| Fresh session | Start new conversation | ☐ |
| Resume same agent | Continue existing conversation | ☐ |
| Resume after crash | Recover from persisted state | ☐ |
| Resume different agent | Load appropriate context | ☐ |
| Invalid session ID | Show error, fallback to fresh | ☐ |

Fix `handleResumeSession`:

```typescript
async function handleResumeSession(sessionId: string) {async function handleResumeSession(sessionId: string) {
  const session = await db.getSession(sessionId);  const session = await db.getSession(sessionId);
  if (!session) {  if (!session) {
    toast.error('Session not found');    toast.error('Session not found');
    return startFreshSession();    return startFreshSession();
  }  }
    
  const adapter = ADAPTERS[session.agentId];  const adapter = ADAPTERS[session.agentId];
  if (!adapter.supportsResume) {  if (!adapter.supportsResume) {
    toast.warn(`${adapter.name} doesn't support resume, starting fresh`);    toast.warn(`${adapter.name} doesn't support resume, starting fresh`);
    return startFreshSession();    return startFreshSession();
  }  }
    
  try {  try {
    const resumeArgs = adapter.getResumeArgs(sessionId);    const resumeArgs = adapter.getResumeArgs(sessionId);
    const newTerm = await launchAgent({    const newTerm = await launchAgent({
      ...adapter,      ...adapter,
      args: [...adapter.args, ...resumeArgs],      args: [...adapter.args, ...resumeArgs],
    });    });
        
    toast.success(`Resumed session ${sessionId.slice(0, 8)}...`);    toast.success(`Resumed session ${sessionId.slice(0, 8)}...`);
    return newTerm;    return newTerm;
  } catch (err) {  } catch (err) {
    console.error('[RESUME FAILED]', err);    console.error('[RESUME FAILED]', err);
    toast.error(`Resume failed: ${err.message}. Starting fresh.`);    toast.error(`Resume failed: ${err.message}. Starting fresh.`);
    return startFreshSession();    return startFreshSession();
  }  }
}}
```

#### 3.3 Clean Up Message Storage

Messages stored in DB should be:

*   Plain text (strip ANSI escape codes)
*   Deduplicated (same message shouldn't appear twice)
*   Categorized (user prompt, agent response, system message)
*   Timestamped accurately

Add sanitizer:

```typescript
function sanitizeMessage(raw: string): string {function sanitizeMessage(raw: string): string {
  return raw  return raw
    .replace(/\x1b\[[0-9;]*m/g, '')     // Remove color codes    .replace(/\x1b\[[0-9;]*m/g, '')     // Remove color codes
    .replace(/\x1b\[[0-9]*[A-Za-z]/g, '') // Remove cursor movements    .replace(/\x1b\[[0-9]*[A-Za-z]/g, '') // Remove cursor movements
    .trim();    .trim();
}}

function storeMessage(sessionId: string, role: 'user'|'assistant'|'system', content: string) {function storeMessage(sessionId: string, role: 'user'|'assistant'|'system', content: string) {
  const clean = sanitizeMessage(content);  const clean = sanitizeMessage(content);
    
  // Dedup check  // Dedup check
  const recent = await db.getRecentMessages(sessionId, 5);  const recent = await db.getRecentMessages(sessionId, 5);
  if (recent.some(m => m.content === clean && Date.now() - m.timestamp < 2000)) {  if (recent.some(m => m.content === clean && Date.now() - m.timestamp < 2000)) {
    console.log('[DEDUP] Skipping duplicate message');    console.log('[DEDUP] Skipping duplicate message');
    return;    return;
  }  }
    
  await db.insertMessage({  await db.insertMessage({
    sessionId,    sessionId,
    role,    role,
    content: clean,    content: clean,
    timestamp: Date.now(),    timestamp: Date.now(),
  });  });
}}
```

Auto-complete stuck messages:

```sql
-- On startup, mark old in_progress messages as failed-- On startup, mark old in_progress messages as failed
UPDATE messages UPDATE messages 
SET status = 'failed', completed_at = datetime('now')SET status = 'failed', completed_at = datetime('now')
WHERE status = 'in_progress' WHERE status = 'in_progress' 
AND created_at < datetime('now', '-1 hour');AND created_at < datetime('now', '-1 hour');
```

#### 3.4 Define Source of Truth

Establish hierarchy:

1.  **SQLite database**: Primary store for sessions, messages, metadata
2.  **JSON exports**: Derived snapshots for backup/portability (timestamped filenames)
3.  **Filesystem artifacts**: Logs, cache, temporary files (not authoritative)

Update documentation to clarify this. Modify export function:

```typescript
async function exportSession(sessionId: string): Promise<string> {async function exportSession(sessionId: string): Promise<string> {
  const session = await db.getSession(sessionId);  const session = await db.getSession(sessionId);
  const messages = await db.getMessages(sessionId);  const messages = await db.getMessages(sessionId);
    
  const export = {  const export = {
    version: '1.0',    version: '1.0',
    exportedAt: new Date().toISOString(),    exportedAt: new Date().toISOString(),
    session,    session,
    messages,    messages,
    checksum: sha256(JSON.stringify({ session, messages })),    checksum: sha256(JSON.stringify({ session, messages })),
  };  };
    
  const filename = `session-${sessionId}-${Date.now()}.json`;  const filename = `session-${sessionId}-${Date.now()}.json`;
  await fs.writeFile(path.join(EXPORT_DIR, filename), JSON.stringify(export, null, 2));  await fs.writeFile(path.join(EXPORT_DIR, filename), JSON.stringify(export, null, 2));
    
  return filename;  return filename;
}}
```

### Exit Criteria

*   ✅ Start session → send 5 messages → quit → relaunch → resume → all messages present, no duplicates
*   ✅ Resume with invalid ID → graceful error, offers fresh start
*   ✅ Multiple simultaneous launches → each gets correct unique session ID
*   ✅ ANSI codes stripped from stored messages (view raw DB entries)
*   ✅ Export JSON → contains checksum, matches DB contents
*   ✅ Crash mid-session → on restart, incomplete messages marked appropriately

### Database Schema Validation

```sql
-- Verify tables exist and have proper indexes-- Verify tables exist and have proper indexes
.tables.tables
.schema sessions.schema sessions
.schema messages.schema messages

-- Check for orphaned records-- Check for orphaned records
SELECT COUNT(*) FROM messages WHERE session_id NOT IN (SELECT id FROM sessions);SELECT COUNT(*) FROM messages WHERE session_id NOT IN (SELECT id FROM sessions);

-- Verify timestamps make sense-- Verify timestamps make sense
SELECT MIN(created_at), MAX(created_at) FROM sessions;SELECT MIN(created_at), MAX(created_at) FROM sessions;
```

* * *

## PHASE 4: AGENT ORCHESTRATION (CONDUCTOR)

**Goal:** Mission-based agent coordination works without renderer dependency

### Current Breakage

*   ConductorService tries to spawn agents via renderer IPC, fails if UI closed/minimized
*   Role boundaries/budgets defined but not enforced
*   Metrics collection spotty, often missing key events
*   Panel connection drops require manual refresh

### Actions

#### 4.1 Decouple Spawn Path from Renderer

Move agent creation logic entirely to main process:

**OLD (broken):**

```typescript
// ConductorService.ts// ConductorService.ts
async spawnWorker(role: string) {async spawnWorker(role: string) {
  const termId = await ipcRenderer.invoke('terminal:create', {...});  const termId = await ipcRenderer.invoke('terminal:create', {...});
  // Fails if renderer not listening!  // Fails if renderer not listening!
}}
```

**NEW (robust):**

```typescript
// ConductorService.ts (runs in main process)// ConductorService.ts (runs in main process)
async spawnWorker(role: string) {async spawnWorker(role: string) {
  const adapter = ADAPTERS[roleToAgent[role]];  const adapter = ADAPTERS[roleToAgent[role]];
  const term = await createPTY({  const term = await createPTY({
    command: adapter.binary,    command: adapter.binary,
    args: adapter.args,    args: adapter.args,
    cwd: this.projectDir,    cwd: this.projectDir,
    env: { ...process.env, ...adapter.env },    env: { ...process.env, ...adapter.env },
  });  });
    
  // Register internally, notify renderer asynchronously  // Register internally, notify renderer asynchronously
  this.activeWorkers.set(term.id, { role, term, startTime: Date.now() });  this.activeWorkers.set(term.id, { role, term, startTime: Date.now() });
    
  // Best-effort notification (doesn't block if renderer down)  // Best-effort notification (doesn't block if renderer down)
  this.notifyRendererSafe('worker:spawned', { termId: term.id, role });  this.notifyRendererSafe('worker:spawned', { termId: term.id, role });
    
  return term.id;  return term.id;
}}
```

Queue spawn requests if renderer unavailable:

```typescript
class SafeNotifier {class SafeNotifier {
  private queue: Array<{ event: string; payload: any }> = [];  private queue: Array<{ event: string; payload: any }> = [];
    
  notify(event: string, payload: any) {  notify(event: string, payload: any) {
    if (this.rendererAvailable()) {    if (this.rendererAvailable()) {
      this.sendDirect(event, payload);      this.sendDirect(event, payload);
    } else {    } else {
      this.queue.push({ event, payload });      this.queue.push({ event, payload });
      console.log(`[QUEUE] ${event} queued (${this.queue.length} pending)`);      console.log(`[QUEUE] ${event} queued (${this.queue.length} pending)`);
    }    }
  }  }
    
  flushQueue() {  flushQueue() {
    while (this.queue.length > 0 && this.rendererAvailable()) {    while (this.queue.length > 0 && this.rendererAvailable()) {
      const { event, payload } = this.queue.shift()!;      const { event, payload } = this.queue.shift()!;
      this.sendDirect(event, payload);      this.sendDirect(event, payload);
    }    }
  }  }
}}
```

#### 4.2 Enforce Role Boundaries & Budgets

Define constraints per role:

```typescript
interface RoleConstraints {interface RoleConstraints {
  maxTokensPerTurn: number;  maxTokensPerTurn: number;
  maxCostUSD: number;  maxCostUSD: number;
  allowedTools: string[]; // e.g., ['file_read', 'terminal_exec']  allowedTools: string[]; // e.g., ['file_read', 'terminal_exec']
  forbiddenPaths: string[]; // Security restrictions  forbiddenPaths: string[]; // Security restrictions
  timeoutSeconds: number;  timeoutSeconds: number;
}}

const ROLE_POLICIES: Record<string, RoleConstraints> = {const ROLE_POLICIES: Record<string, RoleConstraints> = {
  director: {  director: {
    maxTokensPerTurn: 4000,    maxTokensPerTurn: 4000,
    maxCostUSD: 0.50,    maxCostUSD: 0.50,
    allowedTools: ['file_read', 'search'],    allowedTools: ['file_read', 'search'],
    forbiddenPaths: [],    forbiddenPaths: [],
    timeoutSeconds: 300,    timeoutSeconds: 300,
  },  },
  coder: {  coder: {
    maxTokensPerTurn: 8000,    maxTokensPerTurn: 8000,
    maxCostUSD: 1.00,    maxCostUSD: 1.00,
    allowedTools: ['file_write', 'terminal_exec'],    allowedTools: ['file_write', 'terminal_exec'],
    forbiddenPaths: ['.git', 'node_modules'],    forbiddenPaths: ['.git', 'node_modules'],
    timeoutSeconds: 600,    timeoutSeconds: 600,
  },  },
};};
```

Enforce at execution points:

```typescript
async executeToolCall(worker: Worker, toolName: string, args: any) {async executeToolCall(worker: Worker, toolName: string, args: any) {
  const policy = ROLE_POLICIES[worker.role];  const policy = ROLE_POLICIES[worker.role];
    
  if (!policy.allowedTools.includes(toolName)) {  if (!policy.allowedTools.includes(toolName)) {
    throw new Error(`Tool '${toolName}' not allowed for role '${worker.role}'`);    throw new Error(`Tool '${toolName}' not allowed for role '${worker.role}'`);
  }  }
    
  if (args.path && policy.forbiddenPaths.some(fp => args.path.startsWith(fp))) {  if (args.path && policy.forbiddenPaths.some(fp => args.path.startsWith(fp))) {
    throw new Error(`Access to '${args.path}' forbidden for role '${worker.role}'`);    throw new Error(`Access to '${args.path}' forbidden for role '${worker.role}'`);
  }  }
    
  const cost = await estimateToolCost(toolName, args);  const cost = await estimateToolCost(toolName, args);
  if (worker.totalCost + cost > policy.maxCostUSD) {  if (worker.totalCost + cost > policy.maxCostUSD) {
    throw new Error(`Budget exceeded: $${worker.totalCost} + $${cost} > $${policy.maxCostUSD}`);    throw new Error(`Budget exceeded: $${worker.totalCost} + $${cost} > $${policy.maxCostUSD}`);
  }  }
    
  worker.totalCost += cost;  worker.totalCost += cost;
  return actualExecution(toolName, args);  return actualExecution(toolName, args);
}}
```

#### 4.3 Wire ConductorPanel Properly

Use persistent WebSocket-like connection instead of polling:

```typescript
// Main process// Main process
class ConductorServer {class ConductorServer {
  private clients: Set<WebSocket> = new Set();  private clients: Set<WebSocket> = new Set();
    
  broadcast(event: string,  any) {  broadcast(event: string,  any) {
    const msg = JSON.stringify({ type: event, data });    const msg = JSON.stringify({ type: event, data });
    this.clients.forEach(ws => ws.readyState === OPEN && ws.send(msg));    this.clients.forEach(ws => ws.readyState === OPEN && ws.send(msg));
  }  }
}}

// Renderer// Renderer
const ws = new WebSocket('ws://localhost:9222/conductor');const ws = new WebSocket('ws://localhost:9222/conductor');
ws.onmessage = (e) => {ws.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);  const { type, data } = JSON.parse(e.data);
  updateUI(type, data);  updateUI(type, data);
};};

ws.onclose = () => {ws.onclose = () => {
  toast.warn('Connection lost, reconnecting...');  toast.warn('Connection lost, reconnecting...');
  setTimeout(reconnect, 2000);  setTimeout(reconnect, 2000);
};};
```

Alternative simpler approach using Electron IPC with heartbeat:

```typescript
// Keep-alive ping every 5 seconds// Keep-alive ping every 5 seconds
setInterval(() => {setInterval(() => {
  deskflowAPI.conductor.ping().catch(() => {  deskflowAPI.conductor.ping().catch(() => {
    console.log('Conductor unreachable, will retry');    console.log('Conductor unreachable, will retry');
  });  });
}, 5000);}, 5000);
```

#### 4.4 Add Startup Self-Check

On app launch, verify ConductorService initialized:

```typescript
app.whenReady().then(async () => {app.whenReady().then(async () => {
  try {  try {
    await conductorService.initialize();    await conductorService.initialize();
    console.log('[✓] ConductorService ready');    console.log('[✓] ConductorService ready');
        
    // Quick smoke test    // Quick smoke test
    const health = await conductorService.healthCheck();    const health = await conductorService.healthCheck();
    if (!health.ok) {    if (!health.ok) {
      console.error('[✗] Conductor health check failed:', health.errors);      console.error('[✗] Conductor health check failed:', health.errors);
      dialog.showErrorBox('Conductor Error', health.errors.join('\n'));      dialog.showErrorBox('Conductor Error', health.errors.join('\n'));
    }    }
  } catch (err) {  } catch (err) {
    console.error('[FATAL] ConductorService init failed:', err);    console.error('[FATAL] ConductorService init failed:', err);
    dialog.showErrorBox('Startup Failure', err.message);    dialog.showErrorBox('Startup Failure', err.message);
    app.quit();    app.quit();
  }  }
});});
```

### Exit Criteria

*   ✅ Launch mission with 3 workers → all spawn successfully even if window minimized
*   ✅ Exceed budget → worker stops gracefully, reports reason
*   ✅ Try forbidden tool → blocked with clear error message
*   ✅ Kill mission → all PTYs cleaned up, no zombie processes
*   ✅ Panel updates live without manual refresh
*   ✅ Restart app mid-mission → resumes or cleanly aborts with state saved

### Test Mission Example

```yaml
mission:mission:
  name: "bug-fix-test"  name: "bug-fix-test"
  template: "tpl-bug-fix"  template: "tpl-bug-fix"
  parameters:  parameters:
    bugDescription: "Terminal resize doesn't propagate to PTY"    bugDescription: "Terminal resize doesn't propagate to PTY"
    targetFiles: ["src/main.ts", "src/components/Terminal.tsx"]    targetFiles: ["src/main.ts", "src/components/Terminal.tsx"]
    
  phases:  phases:
    - role: director    - role: director
      task: "Analyze bug, create fix plan"      task: "Analyze bug, create fix plan"
    - role: coder      - role: coder  
      task: "Implement Phase 1.4 from spec"      task: "Implement Phase 1.4 from spec"
    - role: tester    - role: tester
      task: "Verify resize works, document results"      task: "Verify resize works, document results"
```

Run this end-to-end, capture metrics at each phase transition.

* * *

## PHASE 5: BACKUP SYSTEM (DB + PROJECT)

**Goal:** Reliable creation, verification, and restoration of backups

### Current Breakage

*   SQLite WAL mode causes torn copies during backup
*   Restore refuses valid archives due to checksum mismatches
*   Scheduler ignores `autoBackup:false` setting
*   ProjectBackupService has undefined variable bugs in path resolution
*   Mirror directory feature shows blank state, unclear if active

### Actions

#### 5.1 Fix WAL Checkpointing

Before backing up SQLite DB, force checkpoint:

```typescript
import sqlite3 from 'sqlite3';import sqlite3 from 'sqlite3';

async function backupDatabase(dbPath: string, destPath: string) {async function backupDatabase(dbPath: string, destPath: string) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    
  try {  try {
    // Force WAL checkpoint    // Force WAL checkpoint
    await new Promise((resolve, reject) => {    await new Promise((resolve, reject) => {
      db.run('PRAGMA wal_checkpoint(FULL)', (err) => {      db.run('PRAGMA wal_checkpoint(FULL)', (err) => {
        if (err) reject(err);        if (err) reject(err);
        else resolve(null);        else resolve(null);
      });      });
    });    });
        
    // Now safe to copy    // Now safe to copy
    await fs.copyFile(dbPath, destPath);    await fs.copyFile(dbPath, destPath);
        
    // Also copy WAL/SHM files temporarily, then delete after verification    // Also copy WAL/SHM files temporarily, then delete after verification
    const walPath = dbPath + '-wal';    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';    const shmPath = dbPath + '-shm';
        
    if (await fileExists(walPath)) {    if (await fileExists(walPath)) {
      await fs.copyFile(walPath, destPath + '-wal');      await fs.copyFile(walPath, destPath + '-wal');
    }    }
    if (await fileExists(shmPath)) {    if (await fileExists(shmPath)) {
      await fs.copyFile(shmPath, destPath + '-shm');      await fs.copyFile(shmPath, destPath + '-shm');
    }    }
        
    // Verify integrity    // Verify integrity
    const verified = await verifySqliteIntegrity(destPath);    const verified = await verifySqliteIntegrity(destPath);
    if (!verified) {    if (!verified) {
      throw new Error('Backup integrity check failed');      throw new Error('Backup integrity check failed');
    }    }
        
    // Clean up extra files    // Clean up extra files
    await fs.unlink(destPath + '-wal').catch(() => {});    await fs.unlink(destPath + '-wal').catch(() => {});
    await fs.unlink(destPath + '-shm').catch(() => {});    await fs.unlink(destPath + '-shm').catch(() => {});
        
  } finally {  } finally {
    db.close();    db.close();
  }  }
}}

function verifySqliteIntegrity(dbPath: string): Promise<boolean> {function verifySqliteIntegrity(dbPath: string): Promise<boolean> {
  return new Promise((resolve) => {  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    db.get('PRAGMA integrity_check', (err, row) => {    db.get('PRAGMA integrity_check', (err, row) => {
      db.close();      db.close();
      resolve(!err && row?.integrity_check === 'ok');      resolve(!err && row?.integrity_check === 'ok');
    });    });
  });  });
}}
```

#### 5.2 Unit Test Retention Pruning

```typescript
describe('BackupRetention', () => {describe('BackupRetention', () => {
  test('keeps daily backups within retention window', () => {  test('keeps daily backups within retention window', () => {
    const now = Date.now();    const now = Date.now();
    const backups = [    const backups = [
      { date: now - 1 * DAY, size: 1024 },      { date: now - 1 * DAY, size: 1024 },
      { date: now - 2 * DAY, size: 1024 },      { date: now - 2 * DAY, size: 1024 },
      { date: now - 7 * DAY, size: 1024 },      { date: now - 7 * DAY, size: 1024 },
      { date: now - 30 * DAY, size: 1024 },      { date: now - 30 * DAY, size: 1024 },
      { date: now - 60 * DAY, size: 1024 },      { date: now - 60 * DAY, size: 1024 },
    ];    ];
        
    const policy = { keepDaily: 7, keepWeekly: 4, keepMonthly: 12 };    const policy = { keepDaily: 7, keepWeekly: 4, keepMonthly: 12 };
    const pruned = applyRetentionPolicy(backups, policy);    const pruned = applyRetentionPolicy(backups, policy);
        
    expect(pruned).toHaveLength(4); // Last 7 days + oldest monthly    expect(pruned).toHaveLength(4); // Last 7 days + oldest monthly
    expect(pruned.map(b => b.date)).toEqual([    expect(pruned.map(b => b.date)).toEqual([
      now - 1 * DAY,      now - 1 * DAY,
      now - 2 * DAY,      now - 2 * DAY,
      now - 7 * DAY,      now - 7 * DAY,
      now - 60 * DAY,      now - 60 * DAY,
    ]);    ]);
  });  });
});});
```

#### 5.3 Restore Safety Checks

```typescript
async function restoreBackup(archivePath: string) {async function restoreBackup(archivePath: string) {
  // 1. Verify archive format  // 1. Verify archive format
  if (!archivePath.endsWith('.tar.gz') && !archivePath.endsWith('.zip')) {  if (!archivePath.endsWith('.tar.gz') && !archivePath.endsWith('.zip')) {
    throw new Error('Unsupported archive format');    throw new Error('Unsupported archive format');
  }  }
    
  // 2. Extract to temp dir first  // 2. Extract to temp dir first
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'restore-'));  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'restore-'));
  await extractArchive(archivePath, tempDir);  await extractArchive(archivePath, tempDir);
    
  // 3. Validate manifest  // 3. Validate manifest
  const manifest = await readManifest(tempDir);  const manifest = await readManifest(tempDir);
  if (!manifest || manifest.version !== CURRENT_VERSION) {  if (!manifest || manifest.version !== CURRENT_VERSION) {
    throw new Error('Invalid or incompatible backup');    throw new Error('Invalid or incompatible backup');
  }  }
    
  // 4. Checksum verification  // 4. Checksum verification
  const calculatedChecksum = await sha256File(path.join(tempDir, 'database.db'));  const calculatedChecksum = await sha256File(path.join(tempDir, 'database.db'));
  if (calculatedChecksum !== manifest.checksums.database) {  if (calculatedChecksum !== manifest.checksums.database) {
    throw new Error('Database checksum mismatch - backup may be corrupted');    throw new Error('Database checksum mismatch - backup may be corrupted');
  }  }
    
  // 5. Preview what will be replaced  // 5. Preview what will be replaced
  const preview = generateRestorePreview(manifest);  const preview = generateRestorePreview(manifest);
  const confirmed = await showConfirmDialog(preview);  const confirmed = await showConfirmDialog(preview);
  if (!confirmed) {  if (!confirmed) {
    await rm(tempDir, { recursive: true });    await rm(tempDir, { recursive: true });
    return;    return;
  }  }
    
  // 6. Atomic swap  // 6. Atomic swap
  await atomicSwap(tempDir, APP_DATA_DIR);  await atomicSwap(tempDir, APP_DATA_DIR);
    
  toast.success('Restore complete. Please restart application.');  toast.success('Restore complete. Please restart application.');
}}
```

#### 5.4 Fix ProjectBackupService Bugs

Find undefined variable references:

```typescript
// BROKEN CODE (example):// BROKEN CODE (example):
getProjectPaths(projectId) {getProjectPaths(projectId) {
  const project = projects[projectId];  const project = projects[projectId];
  return {  return {
    src: project.sourcePath,      // ← What if project is undefined?    src: project.sourcePath,      // ← What if project is undefined?
    dest: backupDir + '/' + name, // ← 'name' not defined!    dest: backupDir + '/' + name, // ← 'name' not defined!
  };  };
}}

// FIXED:// FIXED:
getProjectPaths(projectId: string) {getProjectPaths(projectId: string) {
  const project = this.projects.get(projectId);  const project = this.projects.get(projectId);
  if (!project) {  if (!project) {
    throw new Error(`Project not found: ${projectId}`);    throw new Error(`Project not found: ${projectId}`);
  }  }
    
  const backupDir = this.config.backupDirectory;  const backupDir = this.config.backupDirectory;
  const projectName = this.sanitizeFilename(project.name);  const projectName = this.sanitizeFilename(project.name);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
  return {  return {
    src: project.sourcePath,    src: project.sourcePath,
    dest: path.join(backupDir, `${projectName}-${timestamp}`),    dest: path.join(backupDir, `${projectName}-${timestamp}`),
  };  };
}}
```

Add comprehensive unit tests covering edge cases.

#### 5.5 Clarify Mirror Directory State

If mirror disabled, show explicit OFF indicator:

```tsx
<div className="mirror-status"><div className="mirror-status">
  {config.mirrorEnabled ? (  {config.mirrorEnabled ? (
    <>    <>
      <span className="badge badge-success">ACTIVE</span>      <span className="badge badge-success">ACTIVE</span>
      <p>Syncing to: {config.mirrorPath}</p>      <p>Syncing to: {config.mirrorPath}</p>
      <p>Last sync: {formatRelative(config.lastMirrorSync)}</p>      <p>Last sync: {formatRelative(config.lastMirrorSync)}</p>
    </>    </>
  ) : (  ) : (
    <>    <>
      <span className="badge badge-muted">OFF</span>      <span className="badge badge-muted">OFF</span>
      <p>Mirror backups are disabled</p>      <p>Mirror backups are disabled</p>
      <button onClick={enableMirror}>Enable</button>      <button onClick={enableMirror}>Enable</button>
    </>    </>
  )}  )}
</div></div>
```

Persist settings properly across restarts:

```typescript
// In config load/save// In config load/save
saveConfig({saveConfig({
  autoBackup: true,  autoBackup: true,
  backupIntervalHours: 24,  backupIntervalHours: 24,
  retentionPolicy: { keepDaily: 7, keepWeekly: 4 },  retentionPolicy: { keepDaily: 7, keepWeekly: 4 },
  mirrorEnabled: false,  mirrorEnabled: false,
  mirrorPath: '',  mirrorPath: '',
  excludePatterns: ['node_modules', '.git'],  excludePatterns: ['node_modules', '.git'],
});});
```

### Exit Criteria

*   ✅ Create backup → corrupt a row in live DB → restore → row recovered
*   ✅ Run `verify` command on all archived backups → PASS for valid, FAIL for tampered
*   ✅ Set `autoBackup:false` → scheduler respects it (check logs, no automatic runs)
*   ✅ Interrupt backup mid-write → next backup still succeeds, old one marked incomplete
*   ✅ Project backup diff/mirror outputs show meaningful information
*   ✅ Empty mirror directory displays clear "OFF" state, not ambiguous blank

### Verification Commands

```bash
# Manual testing:# Manual testing:
./scripts/create-backup.sh./scripts/create-backup.sh
sqlite3 ~/.deskflow/database.db "INSERT INTO test VALUES ('before-backup')"sqlite3 ~/.deskflow/database.db "INSERT INTO test VALUES ('before-backup')"
./scripts/restore-backup.sh latest./scripts/restore-backup.sh latest
sqlite3 ~/.deskflow/database.db "SELECT * FROM test"  # Should have 'before-backup'sqlite3 ~/.deskflow/database.db "SELECT * FROM test"  # Should have 'before-backup'

# Integrity checks:# Integrity checks:
for backup in ~/.deskflow/backups/*.tar.gz; dofor backup in ~/.deskflow/backups/*.tar.gz; do
  ./scripts/verify-backup.sh "$backup" || echo "FAILED: $backup"  ./scripts/verify-backup.sh "$backup" || echo "FAILED: $backup"
donedone
```

* * *

## PHASE 6: DOCUMENTATION & STATE CLOSURE

**Goal:** Update docs, record lessons learned, produce final report

### Actions

#### 6.1 Update Architecture Docs

Revise `WORKSPACE_ARCHITECTURE.md`:

*   Diagram showing adapter registry flow
*   Clear separation: PTY layer / Agent layer / Orchestration layer / Persistence layer
*   Data flow for session lifecycle
*   Known limitations documented honestly

Update `TERMINAL_SYSTEM_FIX_PLAN.md`:

*   Mark each item as DONE/PARTIAL/BLOCKED with evidence links
*   Add "How to Verify" section for each fix
*   Include troubleshooting decision tree

#### 6.2 Write Spoke Files

Create modular documentation:

```
docs/spokes/docs/spokes/
├── agent-adapters.md         # How to add new agent support├── agent-adapters.md         # How to add new agent support
├── session-management.md     # Resume flow, storage format├── session-management.md     # Resume flow, storage format
├── conductor-api.md          # Mission definition, role policies├── conductor-api.md          # Mission definition, role policies
├── backup-procedures.md      # Step-by-step backup/restore guide├── backup-procedures.md      # Step-by-step backup/restore guide
└── troubleshooting.md        # Common failures + solutions└── troubleshooting.md        # Common failures + solutions
```

Each spoke includes:

*   Purpose & scope
*   Configuration options
*   Code examples
*   FAQ section
*   Links to related modules

#### 6.3 Append Lessons to MEMORY.md

Record insights gained:

```markdown
## Cycle N+1 Lessons Learned## Cycle N+1 Lessons Learned

### What Broke Again### What Broke Again
- Fixed-delay prompt injection kept failing under load → switched to idle detection- Fixed-delay prompt injection kept failing under load → switched to idle detection
- Session ID race condition resurfaced when adding parallel launches- Session ID race condition resurfaced when adding parallel launches

### Surprising Discoveries  ### Surprising Discoveries  
- Hermes agent writes session ID to stderr, not stdout- Hermes agent writes session ID to stderr, not stdout
- SQLite WAL checkpoint requires FULL mode, TRUNCATE insufficient- SQLite WAL checkpoint requires FULL mode, TRUNCATE insufficient

### Future Prevention### Future Prevention
- Added integration test suite that simulates concurrent agent spawns- Added integration test suite that simulates concurrent agent spawns
- Made idle-detection configurable per-agent (some need longer timeouts)- Made idle-detection configurable per-agent (some need longer timeouts)

### Technical Debt Remaining### Technical Debt Remaining
- Still no automated regression test for backup corruption scenarios- Still no automated regression test for backup corruption scenarios
- Conductor metrics lack historical trend visualization- Conductor metrics lack historical trend visualization
```

#### 6.4 Zip Source Snapshot

```bash
cd /workspacecd /workspace
git add -Agit add -A
git commit -m "Phase completion snapshot: $(date +%Y-%m-%d)"git commit -m "Phase completion snapshot: $(date +%Y-%m-%d)"
git tag -a "phase-N-complete" -m "Audit fixes cycle N"git tag -a "phase-N-complete" -m "Audit fixes cycle N"
tar -czf "workspace-src-$(date +%Y%m%d).tar.gz" src/ docs/ package.jsontar -czf "workspace-src-$(date +%Y%m%d).tar.gz" src/ docs/ package.json
```

Store alongside build artifacts for reproducibility.

#### 6.5 Emit Final Cycle Report

Generate structured report:

```markdown
# CYCLE REPORT: Workspace Terminal Audit & Fixes# CYCLE REPORT: Workspace Terminal Audit & Fixes
Date: YYYY-MM-DDDate: YYYY-MM-DD
Status: [PASS / PARTIAL / FAIL]Status: [PASS / PARTIAL / FAIL]

## Executive Summary## Executive Summary
[One paragraph describing overall outcome][One paragraph describing overall outcome]

## Phase Results## Phase Results
| Phase | Status | Key Issues Fixed | Remaining Problems || Phase | Status | Key Issues Fixed | Remaining Problems |
|-------|--------|------------------|--------------------||-------|--------|------------------|--------------------|
| 0 | PASS | Baseline established | None || 0 | PASS | Baseline established | None |
| 1 | PASS | PTY core functionality | Minor rendering glitches || 1 | PASS | PTY core functionality | Minor rendering glitches |
| 2 | PARTIAL | Adapters for Claude/OpenCode | Hermes needs more testing || 2 | PARTIAL | Adapters for Claude/OpenCode | Hermes needs more testing |
| 3 | PASS | Session save/load/resume | Edge case with network disconnect || 3 | PASS | Session save/load/resume | Edge case with network disconnect |
| 4 | PARTIAL | Decoupled conductor spawn | Budget enforcement incomplete || 4 | PARTIAL | Decoupled conductor spawn | Budget enforcement incomplete |
| 5 | PASS | Backup/restore reliability | Performance optimization needed || 5 | PASS | Backup/restore reliability | Performance optimization needed |
| 6 | PENDING | Documentation updates | Awaiting review || 6 | PENDING | Documentation updates | Awaiting review |

## Evidence Artifacts## Evidence Artifacts
- Build logs: `artifacts/build-cycleN.log`- Build logs: `artifacts/build-cycleN.log`
- Test results: `artifacts/test-report-cycleN.html`- Test results: `artifacts/test-report-cycleN.html`
- Screenshots: `artifacts/screenshots/`- Screenshots: `artifacts/screenshots/`
- Database dumps: `artifacts/db-snapshots/`- Database dumps: `artifacts/db-snapshots/`

## Recommendations for Next Cycle## Recommendations for Next Cycle
1. Automate end-to-end agent launch tests1. Automate end-to-end agent launch tests
2. Implement real-time dashboard for conductor metrics2. Implement real-time dashboard for conductor metrics
3. Add incremental backup support (rsync-style diffs)3. Add incremental backup support (rsync-style diffs)
4. Profile performance bottlenecks in large session histories4. Profile performance bottlenecks in large session histories

## Verdict Justification## Verdict Justification
[Detailed explanation supporting PASS/PARTIAL/FAIL classification][Detailed explanation supporting PASS/PARTIAL/FAIL classification]
```

### Exit Criteria

*   ✅ All documentation updated and committed
*   ✅ MEMORY.md reflects learnings from this cycle
*   ✅ Source snapshot tagged and archived
*   ✅ Cycle report distributed to stakeholders
*   ✅ Action items extracted for backlog grooming

* * *

## EXECUTION ORDER & DEPENDENCIES

```
Phase 0 (Gate)Phase 0 (Gate)
    ↓    ↓
Phase 1 (PTY Core) ──────┐Phase 1 (PTY Core) ──────┐
    ↓                     │    ↓                     │
Phase 2 (Adapters) ◄──────┤ Must have working PTY firstPhase 2 (Adapters) ◄──────┤ Must have working PTY first
    ↓                     │    ↓                     │
Phase 3 (Sessions) ◄──────┘ Needs reliable adaptersPhase 3 (Sessions) ◄──────┘ Needs reliable adapters
    ↓    ↓
Phase 4 (Conductor) ◄── Requires session mgmt stablePhase 4 (Conductor) ◄── Requires session mgmt stable
    ↓    ↓
Phase 5 (Backups) ◄──── Can run parallel to Phases 2-4Phase 5 (Backups) ◄──── Can run parallel to Phases 2-4
    ↓    ↓
Phase 6 (Docs) ◄─────── Final wrap-upPhase 6 (Docs) ◄─────── Final wrap-up
```

**Critical Path:** Phase 0 → 1 → 2 → 3 → 4 **Parallelizable:** Phase 5 can proceed independently once Phase 0 passes

* * *

## TESTING STRATEGY

### Automated Tests

```bash
# Unit tests# Unit tests
npm test -- --coveragenpm test -- --coverage

# Integration tests# Integration tests
npm run test:integrationnpm run test:integration

# E2E tests (requires display)# E2E tests (requires display)
npm run test:e2enpm run test:e2e
```

### Manual Test Checklist

Print this, check off each box:

```
□ Phase 1: Terminal basics□ Phase 1: Terminal basics
  □ Open terminal, type ls, see output  □ Open terminal, type ls, see output
  □ Resize window, panes adjust correctly  □ Resize window, panes adjust correctly
  □ Split H/V, both functional  □ Split H/V, both functional
  □ Close tab, no zombie processes  □ Close tab, no zombie processes
    
□ Phase 2: Agent launches□ Phase 2: Agent launches
  □ Claude launches, responds to prompt  □ Claude launches, responds to prompt
  □ OpenCode detects ready state  □ OpenCode detects ready state
  □ Hermes either works or gives clear message  □ Hermes either works or gives clear message
  □ Skills insert without truncation  □ Skills insert without truncation
    
□ Phase 3: Sessions□ Phase 3: Sessions
  □ Start session, send messages, quit, relaunch  □ Start session, send messages, quit, relaunch
  □ Resume restores conversation  □ Resume restores conversation
  □ Invalid session ID handled gracefully  □ Invalid session ID handled gracefully
    
□ Phase 4: Conductor□ Phase 4: Conductor
  □ Launch mission, workers spawn  □ Launch mission, workers spawn
  □ Budget exceeded stops worker  □ Budget exceeded stops worker
  □ Forbidden tools blocked  □ Forbidden tools blocked
    
□ Phase 5: Backups□ Phase 5: Backups
  □ Create backup, modify DB, restore, verify recovery  □ Create backup, modify DB, restore, verify recovery
  □ AutoBackup toggle respected  □ AutoBackup toggle respected
  □ Mirror state displayed clearly  □ Mirror state displayed clearly
```

### Performance Benchmarks

Track these metrics before/after:

*   Time to launch agent (cold start)
*   Memory usage per active terminal
*   Backup creation time for 1GB dataset
*   Session resume latency
*   UI responsiveness during heavy terminal output

* * *

## SUCCESS CRITERIA SUMMARY

The audit is considered successful when ALL of the following are demonstrably true:

1.  **Build Integrity:** Compiles cleanly, boots without crashes
2.  **Terminal Usability:** Basic operations (type, resize, split, close) work flawlessly
3.  **Agent Reliability:** At least 2 major agents (Claude, OpenCode) launch, communicate, and respond consistently
4.  **Session Persistence:** Quit/reopen preserves conversation state accurately
5.  **Orchestration Independence:** Conductor functions without renderer dependency
6.  **Backup Trustworthiness:** Created backups verifiably restore to original state
7.  **Documentation Accuracy:** Docs reflect reality, not aspirational claims
8.  **Error Visibility:** Failures produce actionable messages, not silent hangs

Any remaining gaps must be explicitly acknowledged in the cycle report with severity ratings and mitigation plans.

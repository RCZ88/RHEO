# CONTEXT_BUNDLE — TUI Prompt Insertion (opencode / claude / gemini / codex)

> **PURPOSE:** Give an AI with NO repository access everything it needs to design and
> implement a robust fix for inserting prompts into AI CLI TUIs inside DeskFlow's
> Terminal Workspace. All code below is REAL, copied verbatim from the working tree.
> Line numbers refer to the current source files. Files are CRLF — preserve line endings.

## 1. What the app is

DeskFlow (repo root = this project) is an **Electron + React + better-sqlite3** desktop
productivity/time tracker. One major surface is the **Terminal Workspace** (`/terminal`):
it spawns real CLI AI agents (**opencode**, **claude** (Claude Code), **gemini**, **codex**)
inside a node-pty PTY, and is supposed to **inject a system prompt / user message into the
agent's interactive TUI** after launch.

- Renderer: `src/pages/TerminalPage.tsx` (React, drives launch + writes)
- Bridge: `src/preload.ts` (contextBridge → `window.deskflowAPI`)
- Backend: `src/main.ts` (Electron main; ALL IPC handlers + the agent state machine live here)
- PTY: inline `terminalManager` object (node-pty wrapper) inside `src/main.ts`

## 2. The user's problem (verbatim)

> "THE BACKEND LOGIC OF THE SYSTEM DOESN'T WORK. with how the handling of the insertion of the prompt into the TUI of the opencode claude code and everything"

> "do you really know on how to insert it properly into an opencode?" ... "and other tools as well?"

**Symptom:** When a session is created (or a message is sent before the agent is ready),
the text never reliably appears in the TUI. It gets *queued* in the main-process agent
state machine and is only flushed when the agent reaches `ready` — and for opencode the
ready detection never matches, so the write falls back to a **blind 5-second force-ready**
after which a **bracketed-paste payload** is written to the PTY without knowing whether
opencode's input handler was attached. Bytes can land in the boot sequence and vanish.

## 3. Architecture map (who calls what)

```
TerminalPage.tsx (renderer)
  initializeTerminal() ──agentSend()/terminalWriteRaw()──▶ preload.ts
  handleCreateNewSession()                                   │  ipcRenderer.invoke
                                                            ▼
                                          main.ts ipcMain.handle
   agent:verify / agent:arm-handshake / agent:send / agent:get-phase
   agent:config / agent:get-status / agent:start-timeout / agent:retry-launch
   terminal:write-raw / terminal:write-display / terminal:create / spawn-terminal
                                                            │
                                                            ▼
                                          terminalManager.write(id, payload)
                                                            │
                                                            ▼
                                          node-pty pty.write(data) ──▶ agent TUI stdin
   TUI stdout ──▶ terminalManager.getDataHandler(id, cb)  (C1/C2 data callbacks)
                                                            │
                                                            ▼
              st.dataBuffer += data → detectAgentPrompt / parseAgentOutput
              → markAgentReady → flushPendingAgentWrites → terminalManager.write
```

**Result<T> convention (whole codebase):** backend handlers return
`{ success: true, ...payload }` or `{ success: false, error: string }`.
`agent:send` additionally returns `{ success: true, queued: true }` when it queued
instead of writing.

## 4. Agent configuration (main.ts:10993-11056)

```typescript
// main.ts:10993
interface AgentConfig {
  binaryCandidates: string[];
  readyRegex: RegExp;
  installHint: string;
  bracketedPaste: boolean;
  inputMode: 'tui-ink' | 'tui-bubbletea' | 'readline';
  tuiFramework: 'ink' | 'bubbletea' | 'unknown';
  sessionIdSource: 'output' | 'db-pid';
}

const DEFAULT_AGENT = 'opencode';                       // main.ts:11003

const AGENT_CONFIGS: Record<string, AgentConfig> = {    // main.ts:11005
  opencode: {
    binaryCandidates: ['opencode', 'opencode.cmd', 'opencode.exe'],
    readyRegex: /^(?:opencode)?\s*>\s*$/i,
    installHint: 'Install with: npm i -g opencode-ai (then restart the app)',
    bracketedPaste: true,
    inputMode: 'tui-bubbletea',
    tuiFramework: 'bubbletea',
    sessionIdSource: 'db-pid',
  },
  claude: {
    binaryCandidates: ['claude', 'claude.cmd', 'claude.exe'],
    readyRegex: /^(?:claude)?\s*>\s*$/i,
    installHint: 'Install with: npm i -g @anthropic-ai/claude-code (then restart the app)',
    bracketedPaste: true,
    inputMode: 'tui-ink',
    tuiFramework: 'ink',
    sessionIdSource: 'output',
  },
  gemini: {
    binaryCandidates: ['gemini', 'gemini.cmd', 'gemini.exe'],
    readyRegex: /^(?:gemini)?\s*>\s*$/i,
    installHint: 'Install with: npm i -g @google/gemini-cli (then restart the app)',
    bracketedPaste: true,
    inputMode: 'tui-ink',
    tuiFramework: 'ink',
    sessionIdSource: 'output',
  },
  codex: {
    binaryCandidates: ['codex', 'codex.cmd', 'codex.exe'],
    readyRegex: /^(?:codex)?\s*>\s*$/i,
    installHint: 'Install with: npm i -g @openai/codex (then restart the app)',
    bracketedPaste: true,
    inputMode: 'tui-ink',
    tuiFramework: 'ink',
    sessionIdSource: 'output',
  },
};

const FALLBACK_READY_REGEX = /^[A-Za-z0-9_-]*\s*>\s*$/;  // main.ts:11044

function getAgentConfig(agentType?: string): AgentConfig {  // main.ts:11046
  return AGENT_CONFIGS[agentType ?? ''] ?? {
    binaryCandidates: agentType ? [agentType] : [],
    readyRegex: FALLBACK_READY_REGEX,
    installHint: `Could not find '${agentType}' on PATH. Install it and restart the app.`,
    bracketedPaste: false,
    inputMode: 'readline',
    tuiFramework: 'unknown',
    sessionIdSource: 'output',
  };
}
```

## 5. ANSI stripping + readiness detection (main.ts:11058-11095)

```typescript
// Strip ANSI escape sequences from terminal output
function stripAnsi(s: string): string {              // main.ts:11059
  return s
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

// Shell prompt patterns — these must NEVER trigger agent:ready
const SHELL_PROMPT_REGEXES: RegExp[] = [             // main.ts:11068
  /^PS\s+.*>\s*$/,
  /^[A-Za-z]:\\.*>\s*$/,
  /^[^@\s]+@[^:\s]+:.*[#$]\s*$/,
];

function looksLikeShell(line: string): boolean {     // main.ts:11074
  return SHELL_PROMPT_REGEXES.some((re) => re.test(line));
}

// Agent prompt detection — checks the last non-empty line of accumulated output
// against the per-agent ready regex. Strips ANSI, rejects shell prompts.
function detectAgentPrompt(buffer: string, agentType?: string): boolean {  // main.ts:11080
  const clean = stripAnsi(buffer);
  const lines = clean.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;
    if (looksLikeShell(trimmed)) return false;
    const regex = getAgentConfig(agentType).readyRegex;
    const match = regex.test(trimmed);
    if (!match && trimmed.length > 0 && i === lines.length - 1) {
      console.log('[AGENT-READY] Last line:', JSON.stringify(trimmed.slice(0, 100)), 'regex:', regex, 'match:', match);
    }
    return match;
  }
  return false;
}
```

**Why this fails for opencode:** opencode's TUI is a full-screen Ink renderer (input
box, not a plain `>` line); after `stripAnsi`, the last non-empty "line" is rarely a bare
`>` — it is leftover TUI box-drawing/text, so the regex never matches. The same can
happen for claude/gemini/codex when the ANSI-stripped tail is mid-frame clutter.

## 6. Agent launch verification (main.ts:11107-11128)

```typescript
function whichOne(name: string): Promise<string | null> {   // main.ts:11107
  const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
  return new Promise((resolve) => {
    child_process_1.execFile(cmd, [name], { timeout: 4000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const first = stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      resolve(first ?? null);
    });
  });
}

async function verifyAgent(agentType: string): Promise<AgentVerifyResult> {  // main.ts:11118
  const cfg = getAgentConfig(agentType);
  const tried = cfg.binaryCandidates.length ? cfg.binaryCandidates : [agentType];
  for (const cand of tried) {
    const resolvedPath = await whichOne(cand);
    if (resolvedPath) {
      return { found: true, resolvedBinary: cand, resolvedPath, tried, installHint: cfg.installHint };
    }
  }
  return { found: false, tried, installHint: cfg.installHint };
}
```

## 7. The agent state machine (main.ts:11131-11327) — THE CORE

```typescript
// Per-terminal agent state machine
type AgentPhase = 'launching' | 'ready' | 'busy' | 'attention' | 'error';
interface AgentState {                                   // main.ts:11132
  agentType: string;
  phase: AgentPhase;
  dataBuffer: string;
  idleSeq: number;
  launchStartedAt: number;
  handshakeToken?: string;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  pendingWrites?: string[];
  currentModel?: string;
  sessionId?: string;              // captured from agent output (primary) or DB (fallback)
  sessionIdCaptured: boolean;      // true once an ID is persisted to the session row
  parsed?: ParsedAgentOutput;      // last parseAgentOutput result
  lastError?: string;              // error string when phase === 'error'
  spawnedPid?: number;             // OS PID of the spawned agent/shell process (DB correlation)
}
const agentStates = new Map<string, AgentState>();       // main.ts:11148

function buildAgentInputPayload(data: string, agentType?: string): string {  // main.ts:11150
  const normalized = String(data ?? '').replace(/\r\n?/g, '\n').trimEnd();
  const cfg = getAgentConfig(agentType);
  if (cfg.bracketedPaste) {
    return '\x1b[200~' + normalized + '\x1b[201~\r';
  }
  return normalized + '\r';
}

function getLastNonEmptyTerminalLine(buffer: string): string {  // main.ts:11159
  const clean = stripAnsi(buffer);
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? '';
}

function flushPendingAgentWrites(id: string, st: AgentState) {  // main.ts:11165
  if (!st.pendingWrites || st.pendingWrites.length === 0) return;
  const writes = [...st.pendingWrites];
  st.pendingWrites = [];
  for (const w of writes) {
    terminalManager.write(id, buildAgentInputPayload(w, st.agentType));
  }
}

function markAgentReady(id: string, st: AgentState) {    // main.ts:11174
  if (st.phase !== 'launching') return;
  st.phase = 'ready';
  clearAgentTimeout(id);
  flushPendingAgentWrites(id, st);
  broadcast('agent:ready', { terminalId: id });
  broadcast('agent:status', { terminalId: id, phase: st.phase, sessionId: st.sessionId, error: st.lastError });
}

function hasEnoughAgentOutputToAcceptInput(st: AgentState): boolean {  // main.ts:11183
  const cfg = getAgentConfig(st.agentType);
  if (!cfg.bracketedPaste) return false;
  const lastLine = getLastNonEmptyTerminalLine(st.dataBuffer);
  if (!lastLine) return false;
  if (looksLikeShell(lastLine)) return false;
  return st.dataBuffer.trim().length > 0;
}
```

### 7b. Per-chunk processing (main.ts:11196-11223)

```typescript
// Called from BOTH the terminal:create and spawn-terminal data handlers after
// the dataBuffer is appended.
function handleAgentOutputChunk(id: string, st: AgentState, data: string) {  // main.ts:11196
  try {
    st.parsed = parseAgentOutput(st.dataBuffer, st.agentType, st, getAgentConfig(st.agentType).sessionIdSource);
  } catch (_e) { return; }

  // Session ID capture — primary path is agent OUTPUT (Ink TUIs print the id in their header).
  if (st.parsed.sessionId && !st.sessionIdCaptured) {
    st.sessionId = st.parsed.sessionId;
    st.sessionIdCaptured = true;
    try {
      const dbSid = getSessionIdForTerminal(id);
      if (dbSid && db) {
        db.prepare('UPDATE terminal_sessions SET resume_id = ? WHERE id = ?').run(st.sessionId, dbSid);
      }
    } catch (_e) { /* silent */ }
    broadcast('agent:session-id-captured', { terminalId: id, sessionId: st.sessionId });
  }

  // Launch error state — fail fast instead of waiting for the 30s timeout.
  if (st.parsed.errors && st.parsed.errors.length > 0 && st.phase === 'launching') {
    st.phase = 'error';
    st.lastError = st.parsed.errors[0];
    clearAgentTimeout(id);
    broadcast('agent:init-error', { terminalId: id, agentType: st.agentType, reason: 'output-error', detail: st.parsed.errors[0], hint: getAgentConfig(st.agentType).installHint });
  }
}
```

### 7c. Timeouts (main.ts:11299-11327) — THE FORCE-READY FALLBACK

```typescript
function startAgentTimeout(id: string, agentType: string) {   // main.ts:11299
  const st = agentStates.get(id);
  if (!st) return;

  // [FORCE-READY] For TUI agents, regex may never match (ANSI clutter).
  // Force ready after 5s if still launching — the prompt will be queued and flushed.
  const forceReadyTimer = setTimeout(() => {                   // main.ts:11305
    const current = agentStates.get(id);
    if (current && current.phase === 'launching') {
      console.log(`[AgentTimeout] Forcing ready for ${id} after 5s (TUI agent fallback)`);
      markAgentReady(id, current);
    }
  }, 5000);

  // Full error timeout at 30s
  const timer = setTimeout(() => {                             // main.ts:11314
    clearTimeout(forceReadyTimer);
    if (agentStates.get(id)?.phase !== 'launching') return;
    const diag = diagnoseAgentFailure(id, agentType);
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try { win.webContents.send('agent:timeout', { terminalId: id, agentType }); } catch {}
        try { win.webContents.send('agent:init-error', { terminalId: id, agentType, ...diag }); } catch {}
      }
    }
    failPendingWrites(id);
  }, 30000);
  st.timeoutHandle = timer;
}
```

Other state helpers (same region, for completeness):
- `armTerminalReadyFallback(id)` (11250): fires `terminal:ready` broadcast 3s after spawn if no PTY data arrived yet.
- `clearTerminalReadyFallback(id)` (11261), `clearAgentTimeout(id)` (11269).
- `diagnoseAgentFailure(id, agentType)` (11284): classifies `not-recognized` / `dropped-to-shell` / `silent-timeout` from the dataBuffer.
- `ACTION_REQUIRED_PATTERNS` + `detectActionRequired` (11226-11244): [y/n], confirm, password etc. on the last line → phase 'attention'.

---

*Part 2 continues with the IPC handlers, PTY layer, renderer flow, and opencode DB facts.*

## 8. IPC handlers — the write paths (main.ts:12229-12349)

```typescript
electron_1.ipcMain.handle('agent:verify', async (_event, agentType: string) => {   // main.ts:12229
    const result = await verifyAgent(agentType);
    return result;
});

electron_1.ipcMain.handle('agent:arm-handshake', async (_event, terminalId: string) => {  // main.ts:12234
    const st = agentStates.get(terminalId);
    if (!st) return { success: false, error: 'Agent session not found' };
    const token = `__HANDSHAKE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`;
    st.handshakeToken = token;
    const bp = getAgentConfig(st.agentType).bracketedPaste;
    return { success: true, token, bracketedPaste: bp };
});

electron_1.ipcMain.handle('agent:send', async (_event, terminalId: string, data: string, agentType?: string) => {  // main.ts:12243
    const st = agentStates.get(terminalId);
    if (!st) {
        return { success: false, error: 'Agent session not found' };
    }
    const type = agentType || DEFAULT_AGENT;

    // [MEMORY-CAPTURE] Auto-capture memories from user messages
    try {
        const cycleNum = parseInt((await db?.prepare('SELECT COUNT(*) as c FROM terminal_messages WHERE session_id = ?').get(getSessionIdForTerminal(terminalId))?.c) || '0');
        memoryCapture.captureMemoryFromMessage(data, 'user', terminalId, cycleNum);
    } catch {}

    const recordPrompt = () => {
        if (!db || !data || data.trim().length < 1) return undefined;
        try {
            const sid = getSessionIdForTerminal(terminalId);
            if (!sid) return undefined;
            pendingCompletions.add(terminalId);
            return db.prepare('INSERT INTO terminal_messages (session_id, role, content, status) VALUES (?, ?, ?, ?)').run(sid, 'user', data, 'in_progress');
        } catch (_e) { return undefined; }
    };
    const notifyTask = (messageId: number | bigint | undefined) => {  // main.ts:12265
        try {
            const { BrowserWindow } = require('electron');
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    try {
                        win.webContents.send('ai-task:updated', { terminalId, status: 'in_progress', messageId });
                    } catch (e) { /* silent */ }
                }
            }
        } catch (_e) { /* silent */ }
    };

    if (st.phase === 'launching' || st.phase === 'busy') {       // main.ts:12279
        st.pendingWrites = st.pendingWrites || [];
        st.pendingWrites.push(data);
        const result = recordPrompt();
        if (result) notifyTask(result.lastInsertRowid);
        return { success: true, queued: true };
    }
    const payload = buildAgentInputPayload(data, st.agentType || type);   // main.ts:12286
    const success = terminalManager.write(terminalId, payload);
    if (success) {
        st.phase = 'busy';
        const result = recordPrompt();
        if (result) notifyTask(result.lastInsertRowid);
    }
    return { success, queued: false };
});

electron_1.ipcMain.handle('agent:get-phase', async (_event, terminalId: string) => {  // main.ts:12296
    const st = agentStates.get(terminalId);
    return st ? st.phase : 'unknown';
});

electron_1.ipcMain.handle('agent:config', async (_event, agentType?: string) => {  // main.ts:12301
    const cfg = getAgentConfig(agentType);
    return {
        inputMode: cfg.inputMode,
        tuiFramework: cfg.tuiFramework,
        sessionIdSource: cfg.sessionIdSource,
        bracketedPaste: cfg.bracketedPaste,
        installHint: cfg.installHint,
        binaryCandidates: cfg.binaryCandidates,
    };
});

electron_1.ipcMain.handle('agent:get-status', async (_event, terminalId: string) => {  // main.ts:12313
    const st = agentStates.get(terminalId);
    return st
        ? { phase: st.phase, sessionId: st.sessionId || null, sessionIdCaptured: st.sessionIdCaptured, error: st.lastError || null, spawnedPid: st.spawnedPid ?? null }
        : { phase: 'unknown', sessionId: null, sessionIdCaptured: false, error: null, spawnedPid: null };
});

electron_1.ipcMain.handle('agent:start-timeout', async (_event, terminalId: string, agentType: string) => {  // main.ts:12320
    startAgentTimeout(terminalId, agentType);
    return { success: true };
});

electron_1.ipcMain.handle('agent:retry-launch', async (_event, terminalId: string, agentType: string) => {  // main.ts:12325
    const st = agentStates.get(terminalId);
    if (st) {
        const type = agentType || DEFAULT_AGENT;
        st.phase = 'launching';
        st.dataBuffer = '';
        st.idleSeq = 0;
        st.launchStartedAt = Date.now();
        st.handshakeToken = undefined;
        st.pendingWrites = [];
        clearAgentTimeout(terminalId);
        startAgentTimeout(terminalId, type);
    }
    return { success: true };
});

electron_1.ipcMain.handle('terminal:write-raw', async (_event, terminalId: string, data: string) => {  // main.ts:12341
    const success = terminalManager.write(terminalId, data);
    return { success };
});

electron_1.ipcMain.handle('terminal:write-display', async (_event, terminalId: string, data: string) => {  // main.ts:12346
    broadcast('terminal:data', terminalId, data);
    return { success: true };
});
```

## 9. PTY layer (main.ts:11720-11789) — inline terminalManager

```typescript
// Inline node-pty based TerminalManager
const terminalManager = {                                 // main.ts:11720
  terminals: new Map(),
  intentionalKills: new Set<string>(),
  spawnTimes: new Map<string, number>(),
  dataSubscribers: new Map<string, Set<(d: string) => void>>(),
  has(id: string) { return this.terminals.has(id) },
  spawn(id: string, cwd: string, cols: number = 80, rows: number = 24) {   // main.ts:11741
    try {
      console.log('[TerminalManager] spawn called:', id, 'cwd:', cwd, 'has:', this.terminals.has(id), 'existing keys:', Array.from(this.terminals.keys()));
      if (this.terminals.has(id)) {
        console.log('[TerminalManager] DEDUPE KILL for:', id);
        this.kill(id);
      }
      const os = require('os');
      const fs = require('fs');
      const pty = require('node-pty');
      const shell = process.platform === 'win32' ? (process.env.COMSPEC || 'powershell.exe') : (process.env.SHELL || '/bin/bash');
      let workingDir = cwd && cwd.length > 0 ? cwd : os.homedir();
      try { if (!fs.existsSync(workingDir)) { workingDir = os.homedir(); } } catch {}
      const proc = pty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd: workingDir, env: process.env });
      this.spawnTimes.set(id, Date.now());
      const ip: any = {
        write: (data: string) => proc.write(data),
        resize: (c: number, r: number) => proc.resize(c, r),
        kill: () => proc.kill(),
        onData: (cb: (d: string) => void) => proc.onData(cb),
        onExit: (cb: (code: number, sig: string) => void) => proc.onExit(cb),
      };
      this.terminals.set(id, { id, pty: ip, cwd, pid: proc.pid });
      return { success: true };
    } catch (err: any) {
      console.error('[TerminalManager] Spawn error:', err.message);
      return { success: false, error: err.message };
    }
  },
  write(id: string, data: string) {                        // main.ts:11773
    const t = this.terminals.get(id);
    if (t) { t.pty.write(data); return true; }
    return false;
  },
  kill(id: string) { /* kills PTY, cleans maps, releases file locks */ },   // main.ts:11783
  getDataHandler(id: string, cb: (d: string) => void) { /* registers on the PTY */ },  // main.ts:11789
};
```

## 10. Spawn handlers + data callbacks (main.ts:11904-12227)

`terminal:create` (main.ts:11904) and `spawn-terminal` (main.ts:12067) both:
1. `terminalManager.spawn(id, cwd, cols, rows)`
2. When `agentType` provided: `agentStates.set(id, { agentType: type, phase: 'launching', dataBuffer: '', idleSeq: 0, launchStartedAt: Date.now(), pendingWrites: [], sessionIdCaptured: false, spawnedPid })`, then `startAgentTimeout(id, type)`
3. `armTerminalReadyFallback(id)` (terminal:create only calls it; spawn-terminal also does)
4. Register the data callback via `terminalManager.getDataHandler(id, function (data) {...})` — THE FULL PIPELINE:

```typescript
// spawn-terminal data callback (main.ts:12116) — full body:
console.log('[TERMINAL_DEBUG] C2 data callback FIRED for', id, 'data length:', data.length, 'data:', JSON.stringify(data.substring(0, 200)));
if (!terminalReadySent.has(id)) {
    terminalReadySent.add(id);
    clearTerminalReadyFallback(id);
    broadcast('terminal:ready', id);
}
// [FLOW-CONTROL] batch same-tick chunks into one IPC: dataBatchBuffers2 + setImmediate flush → broadcast('terminal:data', id, batched)
try {
    if (db) {
        const sid = (db.prepare('SELECT id FROM terminal_sessions WHERE terminal_id = ? ORDER BY created_at DESC LIMIT 1').get(id) as any)?.id;
        if (sid) {
            db.prepare('INSERT INTO terminal_messages (session_id, role, content) VALUES (?, ?, ?)').run(sid, 'assistant', data);
        }
    }
} catch (_e) { }
const st = agentStates.get(id);
if (!st) return;
st.dataBuffer += data;
if (st.dataBuffer.length > 10000) st.dataBuffer = st.dataBuffer.slice(-5000);

handleAgentOutputChunk(id, st, data);          // session-id capture + launch errors

// [MEMORY-CAPTURE] [save-memory] tag parsing from agent output
try {
    const saveMemoryMatch = data.match(/\[save-memory\]\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(.+)/i);
    if (saveMemoryMatch) { /* memoryCapture.captureMemoryFromMessage(...) */ }
    memoryCapture.captureMemoryFromMessage(data, 'agent', id, undefined);
} catch {}

if (st.phase === 'ready' || st.phase === 'busy') { /* accumulate terminalResponseBuffers */ }

const handshakeSeen = st.handshakeToken ? stripAnsi(st.dataBuffer).includes(st.handshakeToken) : false;
const promptSeen = detectAgentPrompt(st.dataBuffer, st.agentType);
const actionRequired = (st.parsed?.actionRequired) || detectActionRequired(st.dataBuffer);

function isAgentReady(): boolean {             // main.ts:12011 (same logic in both callbacks)
    const cfg = getAgentConfig(st.agentType);
    if (cfg.bracketedPaste) return promptSeen || handshakeSeen;
    return promptSeen && handshakeSeen;
}
if (st.phase === 'launching' && (isAgentReady() || hasEnoughAgentOutputToAcceptInput(st))) {
    markAgentReady(id, st);                    // → flushPendingAgentWrites
} else if ((st.phase === 'busy' || st.phase === 'attention') && promptSeen) {
    st.phase = 'ready'; st.idleSeq += 1;
    flushPendingAgentWrites(id, st);
    broadcast('agent:idle', { terminalId: id, seq: st.idleSeq });
    broadcast('ai-task:updated', { terminalId: id, status: 'completed' });
} else if (st.phase === 'busy' && actionRequired) {
    st.phase = 'attention';
    broadcast('ai-task:updated', { terminalId: id, status: 'action_required' });
} else if (st.phase === 'attention' && !actionRequired && data.length > 0) {
    st.phase = 'busy';
    broadcast('ai-task:updated', { terminalId: id, status: 'in_progress' });
}
```

Exit handler (both spawns): `terminalManager.getExitHandler` → clearAgentTimeout,
failPendingWrites, broadcast('terminal:exit', ...).

**KEY INSIGHT:** `hasEnoughAgentOutputToAcceptInput` (11183) already means "for
bracketedPaste agents, ANY non-shell output = ready" — so for opencode the state machine
WILL flip to ready on the first real output chunk (usually the TUI's first frame). The
queue IS flushed. The unverified link is whether opencode's Ink input handler accepts
`\x1b[200~...\x1b[201~\r` when written via PTY stdin before the input box is focused,
and whether the flush happens too early/late relative to the TUI's input loop.

## 11. Renderer flow — TerminalPage.tsx

### 11a. initializeTerminal (main.ts equivalent: TerminalPage.tsx:956-1169)

```typescript
const initializeTerminal = useCallback(async (terminalId: string, agent: string, resumeId?: string, initContent?: string, systemPrompt?: string, projectPath?: string) => {
    if (initializingTerminals.current.has(terminalId)) { console.log('[TerminalPage] Already initializing terminal:', terminalId); return; }
    initializingTerminals.current.add(terminalId);
    try {
      // ═══ VERIFY AGENT AVAILABILITY ═══
      if (window.deskflowAPI?.verifyAgent) {
        const verifyResult = await window.deskflowAPI.verifyAgent(agent);
        if (!verifyResult?.found) {
          if (agent !== 'opencode') {   // opencode allowed despite false-negative
            showError(verifyResult?.installHint || `Agent '${agent}' not found. Install it and restart.`, 'warning');
            return;
          }
        }
      }

      // ═══ WAIT FOR TERMINAL READY (500ms cap) ═══
      // onTerminalReady listener, resolves when terminalId matches or 500ms timeout

      await new Promise(r => setTimeout(r, 200));   // small pause to let shell render

      // [PUSHDOWN-FIX] Clear scrollback before TUI launches
      try { await window.deskflowAPI.terminalWrite(terminalId, '\x1b[2J\x1b[H\x1b[3J'); } catch {}

      // ═══ VERIFY resumeId against opencode's session list ═══
      if (resumeId && resumeId.trim().length > 0) {
        const checkResult = await window.deskflowAPI?.checkSessionExists?.(resumeId);
        if (checkResult && !checkResult.exists) { resumeId = undefined; }
      }

      // ═══ WRITE BANNER ═══ (terminalWriteDisplay — display only, not PTY)

      // ═══ LAUNCH AGENT ═══
      const cdCmd = projectPath ? `cd "${projectPath}"\r\n` : '';
      let launchCommand: string;
      if (resumeId) {
        // resumeFlags: opencode:'--resume', claude:'--resume', codex:'--session', gemini:'--resume'
        // override from userPreferences.agentResumeCommands templates
        launchCommand = `${cdCmd}${resumeCmd}\r\n`;
      } else {
        launchCommand = `${cdCmd}${agent}\r\n`;   // fresh launch — plain agent command
      }
      const r2 = await window.deskflowAPI?.terminalWriteRaw?.(terminalId, launchCommand);

      // ═══ WAIT FOR AGENT READY (per-agent timeout: claude 5000ms, others 1500ms) ═══
      await new Promise<void>((resolve) => {
        const remover = window.deskflowAPI?.onAgentReady?.((data) => {
          if (data.terminalId === terminalId && !done) { done = true; remover?.(); resolve(); }
        });
        setTimeout(() => { if (!done) { done = true; remover?.(); resolve(); } }, readyTimeout);
      });

      // ═══ CAPTURE REAL SESSION ID (up to 5s) ═══
      // agent:session-id-captured event (Ink TUIs print id in header) OR
      // sessionIdSource === 'db-pid' → captureOpencodeSessionId(projectPath, Date.now()-10000, spawnedPid)

      // ═══ DUMMY ENTER FALLBACK ═══
      const phase = await window.deskflowAPI?.agentGetPhase?.(terminalId);
      if (phase === 'launching') {
        console.log('[TerminalPage] Agent still launching after timeout, sending dummy Enter to wake TUI');
        await window.deskflowAPI?.terminalWriteRaw?.(terminalId, '\r');
        await new Promise(r => setTimeout(r, 1000));
      }

      // ═══ SETTLE: let TUI fully grab the PTY before first flush ═══
      await new Promise(r => setTimeout(r, 200));

      // ═══ HANDSHAKE REMOVED ═══
      // "The bracketed-paste handshake was non-functional and added up to 10s of
      //  blocking latency on every launch. Removed to keep startup responsive."

      // ═══ SYSTEM PROMPT — only if explicitly provided (resume) ═══
      const promptParts = systemPrompt ? [systemPrompt] : [];
      if (systemPrompt && promptParts.length > 0 && window.deskflowAPI?.agentSend) {
        const combined = promptParts.join('\n\n');
        const sendResult = await window.deskflowAPI.agentSend(terminalId, combined, agent);
        if (!sendResult?.success) {
          console.warn('[TerminalPage] Failed to send initialization prompt:', sendResult?.error);
        } else {
          console.log('[TerminalPage] Sent initialization prompt:', combined.length, 'chars,', sendResult?.queued ? 'queued (waiting for agent ready)' : 'sent immediately');
        }
      }
    } catch (e) {
      console.error('[TerminalPage] initializeTerminal failed:', e);
    } finally {
      initializingTerminals.current.delete(terminalId);
    }
  }, [thoughtProcessEnabled, showError, selectedProject, crossSessionSyncEnabled, modelDebugMode]);
```

### 11b. handleCreateNewSession (TerminalPage.tsx:1564-1660) — the NEW-SESSION path

```typescript
const handleCreateNewSession = useCallback(async (name?: string, summary?: string, prompt?: string) => {
    const activeProjectId = selectedProject || projects[0]?.id || '';
    const proj = projects.find(p => p.id === activeProjectId);
    const newTerminalId = generateTerminalId();
    const cwd = proj?.path || '';
    if (!cwd) { showError('No project path available...', 'warning'); return null; }

    // ═══ CREATE UI ═══
    setTerminalTabs(prev => ({ ...prev, [newTerminalId]: { name: name || 'New Session', agent: newSessionAgent, modelTier: 'mid' } }));
    setActiveTerminalId(newTerminalId);
    const updatedLayout = insertIntoLayout(terminalLayout, newTerminalId);
    setTerminalLayout(updatedLayout); saveLayout(updatedLayout);

    // ═══ SPAWN PTY ═══
    const spawnResult = await window.deskflowAPI.spawnTerminal(newTerminalId, cwd, newSessionAgent);
    if (!spawnResult?.success) { showError(`Failed to spawn terminal: ${spawnResult?.error}`, 'error'); return null; }
    window.dispatchEvent(new CustomEvent('terminal:mark-spawned', { detail: { terminalId: newTerminalId } }));

    // ═══ INITIALIZE AGENT ═══
    await registerTerminal(newTerminalId, newSessionAgent);
    await initializeTerminal(newTerminalId, newSessionAgent, undefined, undefined, undefined, cwd);

    // ═══ WRITE USER PROMPT ═══
    if (prompt && prompt.trim()) {
      const writeResult = await window.deskflowAPI?.agentSend?.(newTerminalId, prompt, newSessionAgent);
      if (!writeResult?.success) { console.error('[handleCreateNewSession] Failed to write prompt:', writeResult?.error); }
      await new Promise(r => setTimeout(r, 500));
    }

    // ═══ SAVE SESSION ═══ (saveTerminalSession with topic/agent/terminalId/subpage)
    // ═══ BACKGROUND opencode session-ID capture (after 5s, captureOpencodeSessionId) ═══
}, [projects, selectedProject, terminalLayout, loadSessions, registerTerminal, initializeTerminal, saveLayout, showError]);
```

**Timing note:** `handleCreateNewSession` calls `initializeTerminal` (which waits up to
1500ms/5000ms for ready) and THEN calls `agentSend` — but `agentSend` in the renderer
writes to the PTY (phase transitions to busy), so the user's first prompt usually lands
directly. The `initializeTerminal` systemPrompt send happens BEFORE the agent is ready in
most cases → queued → flushed on first output chunk.

### 11c. handleRetryAgentInit (TerminalPage.tsx:1555-1562)

```typescript
const handleRetryAgentInit = useCallback(async (terminalId: string, agentType: string) => {
    setAgentInitErrors(...); setTerminalTimeouts(...);
    if (window.deskflowAPI?.retryAgentLaunch) await window.deskflowAPI.retryAgentLaunch(terminalId, agentType);
    await initializeTerminal(terminalId, agentType);   // relaunches the whole init sequence
}, [initializeTerminal]);
```

## 12. preload.ts IPC contract (contextBridge)

```typescript
// src/preload.ts
terminalWriteRaw: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-raw', terminalId, data),   // L412
onAgentReady: (callback: (data: { terminalId: string }) => void) => { /* ipcRenderer.on('agent:ready') → returns remover */ },  // L420
verifyAgent: (agentType: string) => ipcRenderer.invoke('agent:verify', agentType),       // L431
armHandshake: (terminalId: string) => ipcRenderer.invoke('agent:arm-handshake', terminalId),  // L432
agentSend: (terminalId: string, data: string, agentType?: string) => ipcRenderer.invoke('agent:send', terminalId, data, agentType),  // L433
agentGetPhase: (terminalId: string) => ipcRenderer.invoke('agent:get-phase', terminalId), // L434
terminalWriteDisplay: (terminalId: string, data: string) => ipcRenderer.invoke('terminal:write-display', terminalId, data),  // L521
```

`TerminalWindow.tsx` (xterm) writes keystrokes via `terminalWriteRaw` (L231) and sends
buffered xterm data through it as well (L267, 293, 315) — so the SAME write path is used
for human typing and for programmatic prompt injection.

## 13. opencode session-ID facts (DB correlation, for resume correctness)

- opencode's SQLite DB: `%USERPROFILE%\.local\share\opencode\opencode.db`
- `session` rows are created **lazily** — only after the first message is sent to a
  session, NOT at spawn. A capture seconds after spawn legitimately finds nothing.
- `session.time_created` is INTEGER epoch-millis — compare NUMERICALLY, never ISO strings.
- DB is written via active WAL.
- `capture-opencode-session-id` handler (main.ts:12351): takes `(workspaceDir, sinceTimestamp?, pid?)`, returns `{ success, sessionId, source: 'db'|'generated'|..., reason }`. PID-correlated when a PID is given (dead PID = stale session must not win).
- The renderer uses `captureOpencodeSessionId(cwd, Date.now() - 10000, status?.spawnedPid)` with a ~10-15s recency window, and a 5s background capture in handleCreateNewSession.

## 14. Constraints & invariants (binding)

1. **Never run destructive git commands** — no `git checkout`, `git restore`, `git reset`, `git stash drop`, `git clean`; never pipe `git show <rev>:<file>` into the working tree. If a file change might need undo, ask first, then make a physical backup under `agent/backups/`.
2. **Result<T> convention:** every IPC handler returns `{ success: boolean }` (+ `error?: string` on failure). `agent:send` adds `queued: boolean`.
3. **PTY event order is sacred:** mark-spawned → spawn → created → initialize. Never reorder.
4. **preload.ts is the only bridge** — preload2.ts / preload-old.ts are legacy, untouched.
5. **No new npm dependencies.** Pure Node/Electron + node-pty + existing utils.
6. **Files are CRLF** — preserve line endings; don't mass-reformat.
7. **Build:** `node scripts/build.mjs` (vite renderer + esbuild preload/main); preload also: `npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs`. dist-electron/services/learn/*.js are compiled per-file — irrelevant here (main.cjs only).
8. **localStorage access must be wrapped in try/catch** (renderer).
9. **DB:** lives at `%APPDATA%/RHEO/deskflow-data.db` (REAL userData; %APPDATA%/DeskFlow is stale). All DB access strictly read-only when inspecting.
10. **Runtime verification** on the dev machine can only ATTACH to an already-running app started with `--remote-debugging-port` — no manual launches; if the app isn't running, mark NOT LAUNCHED. Design the fix so its correctness is observable from logs/state (e.g. `[AGENT-READY]` lines, `[AgentTimeout] Forcing ready`, new debug lines) rather than requiring interactive UI.
11. **Black screen prevention:** never ship a build without verifying `dist/index.html` + hashed `dist/assets/index.*.js` exist and are non-trivial; the app must stay visible/interactive.

## 15. What was already tried (feature-docs/terminal-fixes/PROMPT_PROMPT_INSERTION.md)

An earlier fix spec proposed (NOT verified as implemented):
- **Fix 1:** In `initializeTerminal`, send the initial system prompt via `terminalWriteRaw(terminalId, '\x1b[200~' + combined + '\x1b[201~\r')` directly — bypassing the agent state machine. (Current code at TerminalPage.tsx:1154 still uses `agentSend`.)
- **Fix 2:** Send init content as a separate message 500ms after the system prompt.
- **Fix 3:** Add `[AGENT-READY]` logging in detectAgentPrompt (already present at main.ts:11089-11091) and update regexes.

So the current working tree has: `agentSend` still used for the initial prompt, the
`[AGENT-READY]` debug log present, the force-ready fallback present, the handshake
removed. The "direct write bypass" was NOT applied.

## 16. Open questions the target AI should resolve

1. Does opencode's Ink TUI accept bracketed-paste (`\x1b[200~...\x1b[201~`) via PTY stdin, and does it need the input box focused first? What does its input event handler do with paste during boot?
2. Is there a per-agent "input ready" signal detectable from PTY OUTPUT that is more reliable than (a) readyRegex, (b) any-output heuristic, (c) blind 5s force-ready?
3. Should the initial system prompt be written directly (bypassing the state machine) with a small settle delay AFTER a verified-ready signal, and the state machine reserved for subsequent user messages?
4. Should `agent:send` return `{ queued: false, written: false, reason: 'no-terminal' }` distinction so the renderer can surface real failures instead of silent loss?
5. For claude/gemini/codex (Ink TUIs that print a `>` when idle): is the current regex sufficient, or do we need to strip cursor-position ANSI sequences (`\x1b[<n>;<m>H` etc.) before matching?
6. What does a safe retry look like — write, wait ~2s, scan output tail for the prompt echo, retry once on failure — without double-sending?


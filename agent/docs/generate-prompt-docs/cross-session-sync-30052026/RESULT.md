# RESULT — Cross-Session Conflict Detection & Context Sync

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS                                                    │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ File Lock    │  │ Touched Files│  │ Context Delta        │   │
│  │ Manager      │  │ DB Table     │  │ Broadcaster          │   │
│  │ (in-memory)  │  │ (SQLite)     │  │ (terminalWriteRaw)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │ parseTerminalOutput()                                     │  │
│  │   → detectFileEdits() → acquire lock + record touch       │  │
│  │   → parseAndExecuteActions() → richer context-changed     │  │
│  │   → /sync command → compile-sync-summary                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  IPC Events: file-lock-conflict, file-lock-released,             │
│              context-changed (enhanced with entity details)       │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
    IPC invoke           IPC events           IPC invoke
         │                    │                    │
┌──────────────────────────────────────────────────────────────────┐
│  RENDERER (TerminalPage.tsx)                                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ onContextChanged  │  │ ConflictToast    │  │ /sync input  │  │
│  │ listener          │  │ component        │  │ handler      │  │
│  │ (writes to ALL    │  │ (file lock       │  │ (compile     │  │
│  │  terminals)       │  │  conflicts)      │  │  + write)    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Main Process Changes — `src/main.ts`

### 2a. File Lock Manager (add near top, after terminalManager)

```typescript
// ═══════════════════════════════════════════════════════════════
// File Lock Manager — In-memory lock registry with auto-expiry
// ═══════════════════════════════════════════════════════════════

const FILE_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes default

interface FileLock {
  terminalId: string;
  sessionId: string | null;
  acquiredAt: number;
  lastActivityAt: number;
  expiresAt: number;
  projectPath: string;
}

const fileLockManager = new Map<string, FileLock>();

function normalizeFilePath(filePath: string): string {
  try { return path.resolve(filePath); } catch { return filePath; }
}

function acquireFileLock(
  filePath: string,
  terminalId: string,
  sessionId: string | null,
  projectPath: string,
  ttlMs: number = FILE_LOCK_TTL_MS
): { success: boolean; conflictWith?: { terminalId: string; sessionId: string | null; acquiredAt: number } } {
  const key = normalizeFilePath(filePath);
  const existing = fileLockManager.get(key);

  // If lock exists and is not expired and belongs to a DIFFERENT terminal → conflict
  if (existing && existing.terminalId !== terminalId && Date.now() < existing.expiresAt) {
    return {
      success: false,
      conflictWith: {
        terminalId: existing.terminalId,
        sessionId: existing.sessionId,
        acquiredAt: existing.acquiredAt,
      },
    };
  }

  // If lock exists and belongs to SAME terminal → renew
  // If no lock or expired → acquire new

  fileLockManager.set(key, {
    terminalId,
    sessionId,
    acquiredAt: existing?.terminalId === terminalId ? existing.acquiredAt : Date.now(),
    lastActivityAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    projectPath,
  });

  return { success: true };
}

function releaseFileLock(filePath: string, terminalId: string): boolean {
  const key = normalizeFilePath(filePath);
  const existing = fileLockManager.get(key);
  if (existing && existing.terminalId === terminalId) {
    fileLockManager.delete(key);
    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file-lock-released', {
        filePath: key,
        terminalId,
      });
    }
    return true;
  }
  return false;
}

function releaseAllLocksForTerminal(terminalId: string): string[] {
  const released: string[] = [];
  for (const [filePath, lock] of fileLockManager) {
    if (lock.terminalId === terminalId) {
      fileLockManager.delete(filePath);
      released.push(filePath);
    }
  }
  if (released.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('file-lock-released', {
      terminalId,
      filesReleased: released,
    });
  }
  return released;
}

function getFileLock(filePath: string): FileLock | null {
  const key = normalizeFilePath(filePath);
  const lock = fileLockManager.get(key);
  if (!lock || Date.now() >= lock.expiresAt) {
    if (lock) fileLockManager.delete(key);
    return null;
  }
  return lock;
}

function getLocksForTerminal(terminalId: string): Array<{ filePath: string; acquiredAt: number; expiresAt: number }> {
  const locks: Array<{ filePath: string; acquiredAt: number; expiresAt: number }> = [];
  for (const [filePath, lock] of fileLockManager) {
    if (lock.terminalId === terminalId && Date.now() < lock.expiresAt) {
      locks.push({ filePath, acquiredAt: lock.acquiredAt, expiresAt: lock.expiresAt });
    }
  }
  return locks;
}

function getAllActiveLocks(projectPath?: string): Array<{ filePath: string; terminalId: string; sessionId: string | null; acquiredAt: number; expiresAt: number; projectPath: string }> {
  const now = Date.now();
  const result: Array<{ filePath: string; terminalId: string; sessionId: string | null; acquiredAt: number; expiresAt: number; projectPath: string }> = [];
  for (const [filePath, lock] of fileLockManager) {
    if (now < lock.expiresAt && (!projectPath || lock.projectPath === projectPath)) {
      result.push({ filePath, ...lock });
    }
  }
  return result;
}

function cleanupExpiredLocks(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [filePath, lock] of fileLockManager) {
    if (now >= lock.expiresAt) {
      fileLockManager.delete(filePath);
      cleaned++;
    }
  }
  return cleaned;
}

// Periodic cleanup — every 60 seconds
setInterval(() => {
  const cleaned = cleanupExpiredLocks();
  if (cleaned > 0) console.log(`[FileLocks] Cleaned up ${cleaned} expired locks`);
}, 60_000);
```

### 2b. Touched Files DB Table (add in DB initialization section)

```sql
CREATE TABLE IF NOT EXISTS touched_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id TEXT NOT NULL,
  session_id TEXT,
  file_path TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'edit',
  project_path TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_touched_files_terminal ON touched_files(terminal_id);
CREATE INDEX IF NOT EXISTS idx_touched_files_path ON touched_files(file_path);
CREATE INDEX IF NOT EXISTS idx_touched_files_timestamp ON touched_files(timestamp);
```

### 2c. File Edit Detection (add as new function)

```typescript
// ═══════════════════════════════════════════════════════════════
// File Edit Detection — Parses terminal output for file operations
// ═══════════════════════════════════════════════════════════════

function detectFileEdits(output: string): Array<{ filePath: string; action: string }> {
  const results: Array<{ filePath: string; action: string }> = [];
  const seen = new Set<string>();

  // Pattern: "Editing: path/to/file.ts" or "Wrote: path/to/file.ts" etc.
  const editPatterns = [
    { regex: /(?:Editing|Edited|Modified|Modifying|Writing|Wrote|Updating|Updated|Changed|Changing|Saving|Saved):\s*`?([\w./\-]+\.\w{1,12})`?/gi, action: 'edit' },
    { regex: /(?:Created|Creating|Added|Adding):\s*`?([\w./\-]+\.\w{1,12})`?/gi, action: 'create' },
    { regex: /(?:Deleted|Deleting|Removed|Removing):\s*`?([\w./\-]+\.\w{1,12})`?/gi, action: 'delete' },
    { regex: /\[EDIT\]\s+([\w./\-]+\.\w{1,12})/gi, action: 'edit' },
    { regex: /\[CREATE\]\s+([\w./\-]+\.\w{1,12})/gi, action: 'create' },
    { regex: /\[DELETE\]\s+([\w./\-]+\.\w{1,12})/gi, action: 'delete' },
  ];

  // Skip patterns — noise that looks like file paths
  const skipPatterns = [
    /node_modules\//,
    /\.git\//,
    /\/dist\//,
    /\/build\//,
    /package-lock\.json/,
    /yarn\.lock/,
    /\.DS_Store/,
  ];

  for (const { regex, action } of editPatterns) {
    let match;
    while ((match = regex.exec(output)) !== null) {
      const filePath = match[1];
      if (filePath && !skipPatterns.some(p => p.test(filePath))) {
        const key = `${filePath}:${action}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ filePath, action });
        }
      }
    }
  }

  return results;
}

function processDetectedEdits(
  edits: Array<{ filePath: string; action: string }>,
  terminalId: string,
  projectPath: string
): { locksAcquired: number; conflicts: Array<{ filePath: string; conflictWith: string }> } {
  let locksAcquired = 0;
  const conflicts: Array<{ filePath: string; conflictWith: string }> = [];

  // Get session_id for this terminal if available
  let sessionId: string | null = null;
  try {
    const binding = db.prepare('SELECT * FROM terminal_bindings WHERE terminal_id = ?').get(terminalId) as any;
    if (binding?.active_problem_id) {
      sessionId = binding.active_problem_id; // approximate — use problem as session proxy
    }
  } catch {}

  // Also check terminal_sessions
  try {
    const session = db.prepare('SELECT id FROM terminal_sessions WHERE terminal_id = ? AND status = ?').get(terminalId, 'active') as any;
    if (session?.id) sessionId = session.id;
  } catch {}

  for (const edit of edits) {
    // Record touched file
    try {
      db.prepare(`
        INSERT INTO touched_files (terminal_id, session_id, file_path, action, project_path)
        VALUES (?, ?, ?, ?, ?)
      `).run(terminalId, sessionId, edit.filePath, edit.action, projectPath);
    } catch {}

    // Try to acquire lock
    if (edit.action === 'edit' || edit.action === 'create') {
      const lockResult = acquireFileLock(edit.filePath, terminalId, sessionId, projectPath);
      if (lockResult.success) {
        locksAcquired++;
      } else if (lockResult.conflictWith) {
        conflicts.push({
          filePath: edit.filePath,
          conflictWith: lockResult.conflictWith.terminalId,
        });

        // Fire conflict event
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file-lock-conflict', {
            filePath: edit.filePath,
            requestingTerminal: terminalId,
            lockingTerminal: lockResult.conflictWith.terminalId,
            lockingSessionId: lockResult.conflictWith.sessionId,
            action: edit.action,
          });
        }

        // Write warning to the requesting terminal
        const term = terminalManager.terminals.get(terminalId);
        if (term) {
          const warning = `\r\n\x1b[33m[CONFLICT] ${edit.filePath} is being edited by another session (${lockResult.conflictWith.terminalId})\x1b[0m\r\n`;
          term.pty.write(warning);
        }
      }
    }
  }

  return { locksAcquired, conflicts };
}
```

### 2d. Integrate File Detection into Terminal Data Handler

Find the terminal data handler (where `terminal:data` events are sent, around line 6242). Add file edit detection AFTER the existing output processing:

```typescript
// In the terminal data handler callback, after existing processing:
const dataHandler = (data: string) => {
  // ... existing code that sends terminal:data event ...
  
  // ═══ NEW: File edit detection ═══
  if (data.length > 10) { // Skip tiny chunks
    const edits = detectFileEdits(data);
    if (edits.length > 0) {
      const cwd = terminalManager.terminals.get(id)?.cwd || '';
      processDetectedEdits(edits, id, cwd);
    }
  }
};
```

### 2e. Enhanced parseAndExecuteActions — Richer Context Events

Find `parseAndExecuteActions` (line 7006-7090). The function currently fires a generic `context-changed` event at the end. Enhance it to fire per-action events with entity details:

```typescript
// At the end of parseAndExecuteActions, REPLACE the single generic event:

// BEFORE:
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send('context-changed', { type: 'problems', action: 'batch-processed' });
}

// AFTER:
// (The per-action events are already fired inside each action handler)
// Add a summary event with full details for cross-session broadcast:
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send('context-changed', {
    type: 'batch-processed',
    action: 'batch-processed',
    source: terminalId,
    entities: processedEntities, // Array of { type, id, title, status, action }
    timestamp: new Date().toISOString(),
  });
}
```

Also, inside each individual action handler within `parseAndExecuteActions`, ensure the `context-changed` event includes the `source` terminal ID:

```typescript
// Inside the [create-problem] handler, for example:
mainWindow?.webContents?.send('context-changed', {
  type: 'problem',
  action: 'created',
  entity: { id: problem.id, title: problem.title, status: problem.status },
  source: terminalId,  // ← ADD THIS
  timestamp: new Date().toISOString(),
});
```

### 2f. Terminal Kill Cleanup

Find where terminals are killed (the `kill` method in terminalManager or the `terminal:exit` handler). Add lock cleanup:

```typescript
// In terminalManager.kill():
kill(id: string) {
  const term = this.terminals.get(id);
  if (term) {
    term.pty.kill();
    this.terminals.delete(id);
    // ═══ NEW: Release all file locks for this terminal ═══
    releaseAllLocksForTerminal(id);
  }
}

// In the terminal:exit handler:
// After existing cleanup code, add:
releaseAllLocksForTerminal(terminalId);
```

### 2g. New IPC Handlers (add alongside existing handlers)

```typescript
// ═══════════════════════════════════════════════════════════════
// File Lock IPC Handlers
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('acquire-file-lock', (_event, request: {
  filePath: string;
  terminalId: string;
  sessionId?: string;
  projectPath: string;
}) => {
  return acquireFileLock(request.filePath, request.terminalId, request.sessionId || null, request.projectPath);
});

ipcMain.handle('release-file-lock', (_event, request: {
  filePath: string;
  terminalId: string;
}) => {
  return { success: releaseFileLock(request.filePath, request.terminalId) };
});

ipcMain.handle('release-all-locks', (_event, request: {
  terminalId: string;
}) => {
  return { released: releaseAllLocksForTerminal(request.terminalId) };
});

ipcMain.handle('get-file-locks', (_event, request?: {
  filePath?: string;
  terminalId?: string;
  projectPath?: string;
}) => {
  if (request?.filePath) {
    return { lock: getFileLock(request.filePath) };
  }
  if (request?.terminalId) {
    return { locks: getLocksForTerminal(request.terminalId) };
  }
  return { locks: getAllActiveLocks(request?.projectPath) };
});

ipcMain.handle('record-touched-file', (_event, request: {
  terminalId: string;
  sessionId?: string;
  filePath: string;
  action: string;
  projectPath?: string;
}) => {
  try {
    db.prepare(`
      INSERT INTO touched_files (terminal_id, session_id, file_path, action, project_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(request.terminalId, request.sessionId || null, request.filePath, request.action, request.projectPath || null);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('get-touched-files', (_event, request?: {
  terminalId?: string;
  sessionId?: string;
  filePath?: string;
  projectPath?: string;
  limit?: number;
  since?: string; // ISO timestamp
}) => {
  try {
    let query = 'SELECT * FROM touched_files WHERE 1=1';
    const params: any[] = [];
    if (request?.terminalId) { query += ' AND terminal_id = ?'; params.push(request.terminalId); }
    if (request?.sessionId) { query += ' AND session_id = ?'; params.push(request.sessionId); }
    if (request?.filePath) { query += ' AND file_path = ?'; params.push(request.filePath); }
    if (request?.projectPath) { query += ' AND project_path = ?'; params.push(request.projectPath); }
    if (request?.since) { query += ' AND timestamp > ?'; params.push(request.since); }
    query += ' ORDER BY timestamp DESC';
    if (request?.limit) { query += ' LIMIT ?'; params.push(request.limit); }
    return { files: db.prepare(query).all(...params) };
  } catch (err) {
    return { files: [], error: (err as Error).message };
  }
});

// ═══════════════════════════════════════════════════════════════
// Context Sync / Broadcast IPC Handlers
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('broadcast-context-delta', (_event, request: {
  message: string;
  excludeTerminalId?: string;
  targetTerminalIds?: string[];
}) => {
  const targets = request.targetTerminalIds || [...terminalManager.terminals.keys()]
    .filter(id => id !== request.excludeTerminalId);

  let sentCount = 0;
  const deltaMessage = `\r\n\x1b[36m[CTX] ${request.message}\x1b[0m\r\n`;

  for (const termId of targets) {
    const term = terminalManager.terminals.get(termId);
    if (term) {
      term.pty.write(deltaMessage);
      sentCount++;
    }
  }
  return { sentCount };
});

ipcMain.handle('compile-sync-summary', async (_event, request: {
  terminalId: string;
  projectPath: string;
}) => {
  const { terminalId, projectPath } = request;

  let summary = '';

  try {
    // Recent problems (last hour)
    const recentProblems = db.prepare(`
      SELECT id, title, status, priority FROM problems
      WHERE project_path = ? AND updated_at > datetime('now', '-1 hour')
      ORDER BY updated_at DESC LIMIT 10
    `).all(projectPath);

    if (recentProblems.length > 0) {
      summary += 'Recent Problems:\n';
      for (const p of recentProblems as any[]) {
        summary += `  - [${p.status}] ${p.title} (${String(p.id).substring(0, 8)})\n`;
      }
    }

    // Recent requests
    const recentRequests = db.prepare(`
      SELECT id, title, status FROM requests
      WHERE project_path = ? AND updated_at > datetime('now', '-1 hour')
      ORDER BY updated_at DESC LIMIT 10
    `).all(projectPath);

    if (recentRequests.length > 0) {
      summary += 'Recent Requests:\n';
      for (const r of recentRequests as any[]) {
        summary += `  - [${r.status}] ${r.title}\n`;
      }
    }

    // Active file locks
    const locks = getAllActiveLocks(projectPath);
    if (locks.length > 0) {
      summary += 'Active File Locks:\n';
      for (const l of locks) {
        summary += `  - ${l.filePath} (terminal: ${l.terminalId})\n`;
      }
    }

    // Recently touched files
    const touched = db.prepare(`
      SELECT DISTINCT file_path, action, terminal_id FROM touched_files
      WHERE project_path = ? AND timestamp > datetime('now', '-1 hour')
      ORDER BY timestamp DESC LIMIT 20
    `).all(projectPath);

    if (touched.length > 0) {
      summary += 'Recently Modified Files:\n';
      for (const t of touched as any[]) {
        summary += `  - ${t.file_path} (${t.action} by ${t.terminal_id})\n`;
      }
    }

    // Active terminals
    const activeTerminals = [...terminalManager.terminals.keys()];
    if (activeTerminals.length > 0) {
      summary += `Active Terminals: ${activeTerminals.join(', ')}\n`;
    }

    if (!summary) {
      summary = 'No recent context changes.\n';
    }
  } catch (err) {
    summary = `Error compiling sync: ${(err as Error).message}\n`;
  }

  return { summary };
});
```

---

## 3. Preload Bridge Changes — `src/preload.ts`

Add these bridges to the `deskflowAPI` object:

```typescript
// File locks
acquireFileLock: (request: { filePath: string; terminalId: string; sessionId?: string; projectPath: string }) =>
  ipcRenderer.invoke('acquire-file-lock', request),

releaseFileLock: (request: { filePath: string; terminalId: string }) =>
  ipcRenderer.invoke('release-file-lock', request),

releaseAllLocks: (request: { terminalId: string }) =>
  ipcRenderer.invoke('release-all-locks', request),

getFileLocks: (request?: { filePath?: string; terminalId?: string; projectPath?: string }) =>
  ipcRenderer.invoke('get-file-locks', request),

// Touched files
recordTouchedFile: (request: { terminalId: string; sessionId?: string; filePath: string; action: string; projectPath?: string }) =>
  ipcRenderer.invoke('record-touched-file', request),

getTouchedFiles: (request?: { terminalId?: string; sessionId?: string; filePath?: string; projectPath?: string; limit?: number; since?: string }) =>
  ipcRenderer.invoke('get-touched-files', request),

// Context sync
broadcastContextDelta: (request: { message: string; excludeTerminalId?: string; targetTerminalIds?: string[] }) =>
  ipcRenderer.invoke('broadcast-context-delta', request),

compileSyncSummary: (request: { terminalId: string; projectPath: string }) =>
  ipcRenderer.invoke('compile-sync-summary', request),

// File lock events
onFileLockConflict: (callback: (data: any) => void) => {
  const handler = (_event: any, data: any) => callback(data);
  ipcRenderer.on('file-lock-conflict', handler);
  return () => { ipcRenderer.removeListener('file-lock-conflict', handler); };
},

onFileLockReleased: (callback: (data: any) => void) => {
  const handler = (_event: any, data: any) => callback(data);
  ipcRenderer.on('file-lock-released', handler);
  return () => { ipcRenderer.removeListener('file-lock-released', handler); };
},
```

---

## 4. Renderer Changes — `src/pages/TerminalPage.tsx`

### 4a. New State Variables (add near existing state declarations)

```typescript
// Cross-session conflict detection
const [fileConflicts, setFileConflicts] = useState<Array<{
  filePath: string;
  requestingTerminal: string;
  lockingTerminal: string;
  action: string;
  timestamp: number;
}>>([]);
const [terminalFileLocks, setTerminalFileLocks] = useState<Record<string, string[]>>({});
```

### 4b. Re-enable and Enhance onContextChanged Listener

Add this `useEffect` (this was previously removed — now restored with enhancements):

```typescript
// ── Cross-session context sync ──────────────────────────────────
useEffect(() => {
  if (!window.deskflowAPI?.onContextChanged) return;

  const cleanup = window.deskflowAPI.onContextChanged(async (data: any) => {
    // 1. Refresh local data
    if (data.type === 'problem' || data.type === 'problems') {
      await loadAllProblems?.();
    } else if (data.type === 'request' || data.type === 'requests') {
      await loadAllRequests?.();
    }

    // 2. Build delta message for other terminals
    let deltaMessage = '';
    const source = data.source || 'unknown';

    if (data.type === 'problem' && data.entity) {
      deltaMessage = `Problem ${data.action}: "${data.entity.title}" (${data.entity.status || 'unknown'})`;
    } else if (data.type === 'request' && data.entity) {
      deltaMessage = `Request ${data.action}: "${data.entity.title}" (${data.entity.status || 'unknown'})`;
    } else if (data.type === 'batch-processed' && data.entities?.length > 0) {
      deltaMessage = `${data.entities.length} changes by ${source}`;
    }

    if (!deltaMessage) return;

    // 3. Broadcast to ALL terminals EXCEPT the source
    try {
      await window.deskflowAPI?.broadcastContextDelta?.({
        message: deltaMessage,
        excludeTerminalId: source,
      });
    } catch (err) {
      console.error('[ContextSync] Broadcast failed:', err);
    }
  });

  return () => cleanup?.();
}, [loadAllProblems, loadAllRequests]);
```

### 4c. File Lock Conflict Listener

```typescript
// ── File lock conflict listener ─────────────────────────────────
useEffect(() => {
  if (!window.deskflowAPI?.onFileLockConflict) return;

  const cleanup = window.deskflowAPI.onFileLockConflict((data: any) => {
    console.warn('[FileLock] Conflict:', data.filePath, 'requested by', data.requestingTerminal, 'locked by', data.lockingTerminal);

    setFileConflicts(prev => [...prev, {
      filePath: data.filePath,
      requestingTerminal: data.requestingTerminal,
      lockingTerminal: data.lockingTerminal,
      action: data.action,
      timestamp: Date.now(),
    }]);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setFileConflicts(prev => prev.filter(c => c.timestamp !== Date.now() - 10000));
    }, 10_000);
  });

  return () => cleanup?.();
}, []);

// ── File lock released listener ─────────────────────────────────
useEffect(() => {
  if (!window.deskflowAPI?.onFileLockReleased) return;

  const cleanup = window.deskflowAPI.onFileLockReleased((data: any) => {
    // Remove conflicts for released files
    setFileConflicts(prev => prev.filter(c => {
      if (data.filesReleased) return !data.filesReleased.includes(c.filePath);
      return c.filePath !== data.filePath;
    }));
  });

  return () => cleanup?.();
}, []);
```

### 4d. /sync Command Handler

Find the instruction send handler (`handleInstructionPanelSend` or equivalent, around line 479-528). Add `/sync` interception BEFORE the normal send logic:

```typescript
// Inside handleInstructionPanelSend, BEFORE writing to terminal:

if (instructionText.trim().startsWith('/sync')) {
  const targetTermId = sendTargetSession?.terminal_id || activeTerminalId;
  if (!targetTermId) return;

  try {
    const result = await window.deskflowAPI?.compileSyncSummary?.({
      terminalId: targetTermId,
      projectPath: selectedProjectPath || '',
    });

    if (result?.summary) {
      const syncMessage = `\r\n\x1b[36m--- Context Sync ---\x1b[0m\r\n\x1b[36m${result.summary}\x1b[0m\x1b[36m--- End Sync ---\x1b[0m\r\n`;
      await window.deskflowAPI?.terminalWriteRaw?.(targetTermId, syncMessage);
    }
  } catch (err) {
    console.error('[Sync] Failed:', err);
  }
  return; // Don't send /sync as a regular instruction
}
```

### 4e. Conflict Toast Rendering

Add near where other toasts/dialogs are rendered:

```tsx
{/* ── File Lock Conflict Toasts ─────────────────────── */}
{fileConflicts.length > 0 && (
  <div className="fixed bottom-4 right-4 z-50 space-y-2">
    {fileConflicts.map((conflict, i) => (
      <div
        key={`${conflict.filePath}-${conflict.timestamp}`}
        className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/95 border border-amber-500/30 rounded-lg shadow-xl backdrop-blur-sm max-w-sm"
      >
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-amber-300 font-medium truncate">
            File Conflict
          </p>
          <p className="text-[10px] text-zinc-400 truncate">
            {conflict.filePath}
          </p>
          <p className="text-[10px] text-zinc-500">
            Locked by {conflict.lockingTerminal}
          </p>
        </div>
        <button
          onClick={() => setFileConflicts(prev => prev.filter((_, idx) => idx !== i))}
          className="text-zinc-500 hover:text-zinc-300 shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
)}
```

### 4f. File Lock Indicators in Session List

Find where sessions are rendered in the sidebar. Add a lock indicator after each session item:

```tsx
{/* Inside each session list item, after the existing content */}
{terminalFileLocks[session.terminal_id]?.length > 0 && (
  <div className="flex items-center gap-1 mt-0.5">
    <Lock className="w-2.5 h-2.5 text-amber-500" />
    <span className="text-[9px] text-amber-500/70">
      {terminalFileLocks[session.terminal_id].length} file{terminalFileLocks[session.terminal_id].length !== 1 ? 's' : ''} locked
    </span>
  </div>
)}
```

### 4g. Load File Locks Periodically

```typescript
// ── Refresh file locks for active terminals ─────────────────────
useEffect(() => {
  const refreshLocks = async () => {
    try {
      const result = await window.deskflowAPI?.getFileLocks?.({});
      if (result?.locks) {
        const byTerminal: Record<string, string[]> = {};
        for (const lock of result.locks) {
          if (!byTerminal[lock.terminalId]) byTerminal[lock.terminalId] = [];
          byTerminal[lock.terminalId].push(lock.filePath);
        }
        setTerminalFileLocks(byTerminal);
      }
    } catch {}
  };

  refreshLocks();
  const interval = setInterval(refreshLocks, 10_000);
  return () => clearInterval(interval);
}, []);
```

### 4h. Add Required Icons to Import

Add to the existing `lucide-react` import:

```typescript
import { ..., AlertTriangle, Lock, X } from 'lucide-react';
```

---

## 5. Configuration — Terminal Sidebar Configs Tab

The cross-session sync feature gets a settings section in the **terminal sidebar Configs tab**, following the same pattern as Model Configuration and Auto-Assign Routing.

### 5a. UI — Configs Tab Content (added to `src/pages/TerminalPage.tsx`)

Insert inside the `{activeTab === 'configs' && (...)}` block, after the Auto-Assign section (around line 2845). Follows the existing layout: orange-500 header with sub-controls in a border-t separator.

```tsx
{/* ── Cross-Session Sync ────────────────────────────────────── */}
<div className="px-2 py-3 bg-amber-500/5 border border-amber-500/20 rounded">
  <div className="flex items-center justify-between mb-2">
    <div>
      <h4 className="text-[11px] font-medium text-amber-300">Cross-Session Sync</h4>
      <p className="text-[9px] text-zinc-500">File lock detection, context broadcast</p>
    </div>
    <button
      onClick={() => {
        const v = !crossSessionSyncEnabled;
        setCrossSessionSyncEnabled(v);
        localStorage.setItem('cross-session-sync-enabled', String(v));
        window.deskflowAPI?.setCrossSessionSyncConfig?.({ enabled: v });
      }}
      className={`w-8 h-4 rounded-full transition-colors relative ${
        crossSessionSyncEnabled ? 'bg-amber-500' : 'bg-zinc-700'
      }`}
    >
      <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${
        crossSessionSyncEnabled ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  </div>

  <div className="space-y-3">
    {/* File Lock TTL slider */}
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-zinc-400">Lock TTL</span>
        <span className="text-[10px] text-amber-400 font-mono">{fileLockTTL}s</span>
      </div>
      <p className="text-[8px] text-zinc-600 mb-1">How long a file lock lasts before auto-release</p>
      <input
        type="range"
        min={30}
        max={600}
        step={30}
        value={fileLockTTL}
        onChange={(e) => {
          const v = Number(e.target.value);
          setFileLockTTL(v);
          localStorage.setItem('file-lock-ttl', String(v));
          window.deskflowAPI?.setCrossSessionSyncConfig?.({ lockTTL: v });
        }}
        className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full"
      />
      <div className="flex justify-between text-[8px] text-zinc-600">
        <span>30s</span>
        <span>10m</span>
      </div>
    </div>

    {/* Context broadcast toggle */}
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[10px] text-zinc-400">Context Broadcast</span>
        <p className="text-[8px] text-zinc-600">Notify other terminals of problem/request changes</p>
      </div>
      <button
        onClick={() => {
          const v = !contextBroadcastEnabled;
          setContextBroadcastEnabled(v);
          localStorage.setItem('context-broadcast-enabled', String(v));
          window.deskflowAPI?.setCrossSessionSyncConfig?.({ contextBroadcast: v });
        }}
        className={`w-8 h-4 rounded-full transition-colors relative ${
          contextBroadcastEnabled ? 'bg-amber-500' : 'bg-zinc-700'
        }`}
      >
        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${
          contextBroadcastEnabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>

    {/* Conflict notification preference */}
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[10px] text-zinc-400">Conflict Warnings</span>
        <p className="text-[8px] text-zinc-600">Show toast + terminal warning, or toast only</p>
      </div>
      <select
        value={conflictWarningMode}
        onChange={(e) => {
          setConflictWarningMode(e.target.value);
          localStorage.setItem('conflict-warning-mode', e.target.value);
          window.deskflowAPI?.setCrossSessionSyncConfig?.({ conflictWarningMode: e.target.value });
        }}
        className="bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 px-2 py-1"
      >
        <option value="both">Toast + Terminal</option>
        <option value="toast">Toast Only</option>
        <option value="none">Off</option>
      </select>
    </div>

    {/* /sync command toggle */}
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[10px] text-zinc-400">/sync Command</span>
        <p className="text-[8px] text-zinc-600">Enable the /sync slash command</p>
      </div>
      <button
        onClick={() => {
          const v = !syncCommandEnabled;
          setSyncCommandEnabled(v);
          localStorage.setItem('sync-command-enabled', String(v));
          window.deskflowAPI?.setCrossSessionSyncConfig?.({ syncCommand: v });
        }}
        className={`w-8 h-4 rounded-full transition-colors relative ${
          syncCommandEnabled ? 'bg-amber-500' : 'bg-zinc-700'
        }`}
      >
        <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${
          syncCommandEnabled ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  </div>
</div>
```

### 5b. State Variables (`src/pages/TerminalPage.tsx`, add near line 176)

```typescript
// ── Cross-session sync config ─────────────────────────────────
const [crossSessionSyncEnabled, setCrossSessionSyncEnabled] = useState(() => {
  return localStorage.getItem('cross-session-sync-enabled') !== 'false'; // default ON
});
const [fileLockTTL, setFileLockTTL] = useState(() => {
  const saved = localStorage.getItem('file-lock-ttl');
  return saved ? Number(saved) : 300; // default 5 minutes
});
const [contextBroadcastEnabled, setContextBroadcastEnabled] = useState(() => {
  return localStorage.getItem('context-broadcast-enabled') !== 'false'; // default ON
});
const [conflictWarningMode, setConflictWarningMode] = useState(() => {
  return localStorage.getItem('conflict-warning-mode') || 'both';
});
const [syncCommandEnabled, setSyncCommandEnabled] = useState(() => {
  return localStorage.getItem('sync-command-enabled') !== 'false'; // default ON
});
```

### 5c. IPC Handler — `set-cross-session-sync-config` (`src/main.ts`, add alongside other IPC handlers)

```typescript
// ═══════════════════════════════════════════════════════════════
// Cross-Session Sync Config IPC Handler
// ═══════════════════════════════════════════════════════════════

interface CrossSessionSyncConfig {
  enabled?: boolean;
  lockTTL?: number;        // seconds
  contextBroadcast?: boolean;
  conflictWarningMode?: 'both' | 'toast' | 'none';
  syncCommand?: boolean;
}

// In-memory runtime config — starts with defaults, overridden by IPC
let crossSessionSyncRuntimeConfig: CrossSessionSyncConfig = {
  enabled: true,
  lockTTL: 300,         // 5 minutes
  contextBroadcast: true,
  conflictWarningMode: 'both',
  syncCommand: true,
};

ipcMain.handle('get-cross-session-sync-config', () => {
  return crossSessionSyncRuntimeConfig;
});

ipcMain.handle('set-cross-session-sync-config', (_event, config: CrossSessionSyncConfig) => {
  crossSessionSyncRuntimeConfig = { ...crossSessionSyncRuntimeConfig, ...config };
  return { success: true };
});
```

### 5d. Preload Bridges (`src/preload.ts`, add alongside existing bridges)

```typescript
// Cross-session sync config
getCrossSessionSyncConfig: () =>
  ipcRenderer.invoke('get-cross-session-sync-config'),

setCrossSessionSyncConfig: (config: {
  enabled?: boolean;
  lockTTL?: number;
  contextBroadcast?: boolean;
  conflictWarningMode?: string;
  syncCommand?: boolean;
}) => ipcRenderer.invoke('set-cross-session-sync-config', config),
```

### 5e. Type Declarations (`src/App.tsx`, add alongside other Window type declarations)

```typescript
getCrossSessionSyncConfig: () => Promise<{
  enabled: boolean;
  lockTTL: number;
  contextBroadcast: boolean;
  conflictWarningMode: string;
  syncCommand: boolean;
}>;
setCrossSessionSyncConfig: (config: any) => Promise<{ success: boolean }>;
```

### 5f. Wire Config into Runtime Behavior

**File Lock Manager — use configurable TTL instead of hardcoded default:**

In `src/main.ts`, modify `acquireFileLock` to accept a TTL from config, or modify the data handler integration to pass the config value:

```typescript
// Where detectFileEdits is called in the data handler, pass ttl from config:
const ttl = crossSessionSyncRuntimeConfig?.lockTTL
  ? crossSessionSyncRuntimeConfig.lockTTL * 1000
  : FILE_LOCK_TTL_MS;
// Use this ttl when calling acquireFileLock
```

**Context Broadcast — skip if disabled:**

```typescript
// In the onContextChanged broadcast section (4b), guard with config:
if (!crossSessionSyncRuntimeConfig?.contextBroadcast) return;
```

**Conflict Warning — respect mode:**

```typescript
// In processDetectedEdits, guard terminal warnings:
if (crossSessionSyncRuntimeConfig?.conflictWarningMode === 'none') return;
if (crossSessionSyncRuntimeConfig?.conflictWarningMode === 'toast') {
  // Only fire the IPC event (for toast), skip terminal warning write
} else {
  // Fire IPC event + write warning to terminal
}
```

**/sync Command — disable if turned off:**

```typescript
// In handleInstructionPanelSend, guard the /sync interception:
if (config.prompt.trim().toLowerCase() === '/sync' && !crossSessionSyncRuntimeConfig?.syncCommand) {
  return; // /sync is disabled
}
```

**Master Enable — guards all features:**

```typescript
// Gate the entire file detection integration:
if (crossSessionSyncRuntimeConfig?.enabled !== false) {
  // ... existing detectFileEdits logic ...
}

// Gate the onContextChanged listener registration:
if (crossSessionSyncRuntimeConfig?.enabled !== false) {
  // ... register context sync listener ...
}
```

### 5g. Implementation Order — New Steps

| Step | File | Action | Verify |
|------|------|--------|--------|
| 13 | `src/main.ts` | Add `crossSessionSyncRuntimeConfig` + `get/set-cross-session-sync-config` IPC handlers | IPC responds with config |
| 14 | `src/preload.ts` | Add `getCrossSessionSyncConfig` + `setCrossSessionSyncConfig` bridges | `npm run build` passes |
| 15 | `src/App.tsx` | Add type declarations | `npm run build` passes |
| 16 | `src/pages/TerminalPage.tsx` | Add 5 state variables for sync config (defaults ON) | No crash on mount |
| 17 | `src/pages/TerminalPage.tsx` | Add Configs tab UI section (toggle, TTL slider, broadcast toggle, conflict mode select, /sync toggle) | UI renders in sidebar |
| 18 | `src/main.ts` | Wire config into `acquireFileLock` TTL, `contextBroadcast` guard, `conflictWarningMode` guard, `syncCommand` guard, `enabled` master gate | Toggling master OFF stops all detection |

### Before (Broken — No Sync)

```
Terminal A (opencode)          Terminal B (claude)
     │                              │
     ├─ Edits src/auth.ts           ├─ Edits src/auth.ts
     │  (no lock, no notification)  │  (SILENT OVERWRITE — A's edits lost)
     │                              │
     ├─ Creates Problem P1          ├─ Never knows P1 exists
     │  (context-changed fires      │  (listener removed, no delta push)
     │   but nobody listens)        │
```

### After (Working — Full Sync)

```
Terminal A (opencode)          Terminal B (claude)          Main Process
     │                              │                          │
     ├─ Edits src/auth.ts           │                          │
     │  ────terminal:data──────►    │                     detectFileEdits()
     │                              │                     acquireFileLock(auth.ts, A)
     │                              │                     recordTouchedFile(A, auth.ts)
     │                              │                          │
     │                              ├─ Edits src/auth.ts      │
     │                              │  ────terminal:data──────►│
     │                              │                     detectFileEdits()
     │                              │                     acquireFileLock(auth.ts, B)
     │                              │                     → CONFLICT (locked by A)
     │                              │                          │
     │                              │  ◄──file-lock-conflict───┤
     │                              │  [CONFLICT] warning      │
     │                              │  in terminal              │
     │                              │  + toast in UI            │
     │                              │                          │
     ├─ Creates Problem P1          │                          │
     │  ────terminal:data──────►    │                     parseAndExecuteActions()
     │                              │                          │
     │                              │  ◄──context-changed──────┤
     │                              │  [CTX] Problem created:  │
     │                              │  "Fix auth bug"          │
     │                              │  (broadcast to all       │
     │                              │   terminals except A)    │
     │                              │                          │
     ├─ Types /sync                 │                          │
     │  ────compile-sync-summary──► │                          │
     │  ◄──sync summary─────────────┤                          │
     │  (recent problems, locks,    │                          │
     │   touched files)             │                          │
```

---

## 6. Implementation Order

| Step | File | Action | Verify |
|------|------|--------|--------|
| 1 | `src/main.ts` | Add File Lock Manager (data structure + functions) | App starts, no errors |
| 2 | `src/main.ts` | Add `touched_files` table in DB init | `SELECT * FROM touched_files` returns empty set |
| 3 | `src/main.ts` | Add `detectFileEdits()` + `processDetectedEdits()` functions | Unit test with sample output |
| 4 | `src/main.ts` | Integrate file detection into terminal data handler | Edit a file in terminal → see `[FileLock]` logs |
| 5 | `src/main.ts` | Enhance `parseAndExecuteActions` with `source` field in events | Context-changed events include source terminalId |
| 6 | `src/main.ts` | Add terminal kill/exit lock cleanup | Kill terminal → locks released |
| 7 | `src/main.ts` | Add all new IPC handlers (7 handlers) | DevTools: each handler responds |
| 8 | `src/preload.ts` | Add all new bridges (9 bridges) | `npm run build` passes |
| 9 | `src/pages/TerminalPage.tsx` | Add state, context sync listener, conflict listeners | No crash on mount |
| 10 | `src/pages/TerminalPage.tsx` | Add `/sync` command handler | Type `/sync` → summary appears in terminal |
| 11 | `src/pages/TerminalPage.tsx` | Add conflict toast + file lock indicators | Conflict → amber toast appears |
| 12 | `src/pages/TerminalPage.tsx` | Add periodic lock refresh | Lock indicators update in session list |
| 13 | `src/main.ts` | Add `crossSessionSyncRuntimeConfig` + IPC handlers | IPC returns config |
| 14 | `src/preload.ts` | Add config bridges | `npm run build` passes |
| 15 | `src/App.tsx` | Add type declarations | `npm run build` passes |
| 16 | `src/pages/TerminalPage.tsx` | Add 5 state variables + Configs tab UI | Configs render in sidebar |
| 17 | `src/main.ts` | Wire config into TTL, broadcast, warning mode, /sync, master gate | Toggle master OFF stops all detection |

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| **Terminal spawns with no session** | `sessionId` is `null` throughout — locks and touched files accept null |
| **Lock expires while agent still editing** | Next `detectFileEdits` call renews the lock automatically |
| **Two terminals edit different files** | No conflict — each acquires its own lock |
| **Terminal crashes (no clean exit)** | Lock auto-expires according to configured TTL (default 5 min) |
| **Same terminal edits same file again** | Lock is renewed, no self-conflict |
| **Agent outputs noise that looks like a file path** | Skip patterns filter out `node_modules/`, `.git/`, `dist/`, lock files |
| **Rapid consecutive edits** | Each `detectFileEdits` call renews the lock TTL |
| **`/sync` with no project path** | Returns "No recent context changes" |
| **Broadcast with only 1 terminal** | `sentCount: 0` — no other terminals to notify |
| **DB write fails for touched_files** | Caught silently, doesn't block terminal output |
| **Main window destroyed when firing events** | `!mainWindow.isDestroyed()` guard on every `webContents.send` |
| **File lock conflict during batch processing** | First lock wins, subsequent get conflict event + terminal warning |
| **Config toggled OFF mid-session** | File detection integration stops on next data handler call; existing locks remain until TTL expiry |
| **Config loaded before IPC handler is ready** | State initializes from localStorage (UI shows instantly); IPC is fire-and-forget for persistence |
| **Lock TTL changed mid-session** | New TTL applies to subsequent lock acquisitions; existing locks keep their original TTL |
| **`/sync` disabled after being typed** | If `/sync` text is already being processed, it completes; subsequent `/sync` inputs are ignored |

---

## 8. Context Delta Message Format

Messages written to terminals use ANSI escape codes for visual distinction:

```
\r\n\x1b[36m[CTX] Problem created: "Fix auth bug" (open)\x1b[0m\r\n
\r\n\x1b[33m[CONFLICT] src/auth.ts is being edited by another session (term-1234)\x1b[0m\r\n
\r\n\x1b[36m--- Context Sync ---\x1b[0m\r\n\x1b[36mRecent Problems:\n  - [open] Fix auth bug (abc12345)\x1b[0m\r\n\x1b[36m--- End Sync ---\x1b[0m\r\n
```

- `[CTX]` prefix = cyan — context delta from another session
- `[CONFLICT]` prefix = yellow/amber — file lock conflict warning
- `--- Context Sync ---` = cyan — /sync command output

These are written via `terminalWriteRaw` (no DB record) and use `\r\n` line endings so they appear above the agent's prompt without interfering with input.
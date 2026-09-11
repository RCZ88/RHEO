Here is the complete, engineered solution to fix the file locking and conflict prevention system. The implementation addresses all 8 tasks (A–H) while strictly adhering to your constraints (no new dependencies, best-effort git, 5-minute stale build lock, etc.).

---

### 1. `src/main.ts`
This file receives the most significant updates: DB schema migrations, pre-edit locking IPC handlers, git snapshotting, TTL config integration, and `touched_files` cleanup.

```typescript
import path from 'path';
// ... existing imports

// --- TASK C: Connect TTL Config ---
function getLockTTL(): number {
  return (crossSessionSyncRuntimeConfig.lockTTL || 60) * 1000; // Config is in seconds
}

// --- TASK B: Lock Persistence to DB ---
// Ensure this runs during your DB initialization sequence
db.exec(`CREATE TABLE IF NOT EXISTS file_locks (
  file_path TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  session_id TEXT,
  action TEXT DEFAULT 'edit',
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  stash_ref TEXT,
  PRIMARY KEY (file_path)
)`);

// Sweep expired locks on startup (handles app crashes)
db.exec("DELETE FROM file_locks WHERE expires_at < datetime('now')");

// --- TASK D: Add session_context Column ---
try {
  db.exec('ALTER TABLE terminal_bindings ADD COLUMN session_context TEXT');
} catch (_e) {
  /* column already exists */
}

// --- TASK G: touched_files Cleanup ---
// On startup: delete rows older than 7 days
db.exec("DELETE FROM touched_files WHERE timestamp < datetime('now', '-7 days')");

// Periodic sweep every hour
setInterval(() => {
  db.exec("DELETE FROM touched_files WHERE timestamp < datetime('now', '-7 days')");
}, 3600000);

// --- TASK E: Git Auto-Commit Before Agent Edits ---
async function gitSnapshotBeforeEdit(filePath: string, terminalId: string): Promise<string | null> {
  try {
    const { execSync } = require('child_process');
    const gitDir = execSync('git rev-parse --show-toplevel', { cwd: path.dirname(filePath), encoding: 'utf-8' }).trim();
    
    execSync(`git add "${filePath}"`, { cwd: gitDir });
    const stashResult = execSync(`git stash push -m "agent-lock:${terminalId}:${Date.now()}" -- "${filePath}"`, { cwd: gitDir, encoding: 'utf-8' });
    
    const stashMatch = stashResult.match(/stash@\{(\d+)\}/);
    return stashMatch ? `stash@{${stashMatch[1]}}` : null;
  } catch {
    return null; // Not a git repo or git not available — best-effort
  }
}

async function gitRestoreOnCorrupt(filePath: string, stashRef: string): Promise<boolean> {
  try {
    const { execSync } = require('child_process');
    const gitDir = execSync('git rev-parse --show-toplevel', { cwd: path.dirname(filePath), encoding: 'utf-8' }).trim();
    execSync(`git stash pop ${stashRef}`, { cwd: gitDir });
    return true;
  } catch {
    return false;
  }
}

// --- Updated Lock Manager (Tasks A, B, C) ---
function acquireLock(filePath: string, terminalId: string, sessionId?: string, action?: string): { acquired: boolean; heldBy?: string } {
  const ttl = getLockTTL();
  const existing = fileLocks.get(filePath);
  
  if (existing) {
    if (existing.terminalId === terminalId) {
      fileLocks.set(filePath, { filePath, terminalId, sessionId, action, acquiredAt: Date.now(), ttlMs: ttl });
      return { acquired: true };
    }
    if (Date.now() - existing.acquiredAt < ttl) {
      return { acquired: false, heldBy: existing.terminalId };
    }
    fileLocks.delete(filePath);
  }
  
  // Cold start fallback: check DB if in-memory map is empty/stale
  const dbLock = db.prepare('SELECT * FROM file_locks WHERE file_path = ?').get(filePath) as any;
  if (dbLock && dbLock.terminal_id !== terminalId) {
    if (new Date(dbLock.expires_at).getTime() > Date.now()) {
      return { acquired: false, heldBy: dbLock.terminal_id };
    }
    db.prepare('DELETE FROM file_locks WHERE file_path = ?').run(filePath);
  }
  
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  db.prepare(`INSERT OR REPLACE INTO file_locks (file_path, terminal_id, session_id, action, acquired_at, expires_at) 
              VALUES (?, ?, ?, ?, datetime('now'), ?)`).run(
    filePath, terminalId, sessionId || null, action || 'edit', expiresAt
  );
  
  fileLocks.set(filePath, { filePath, terminalId, sessionId, action, acquiredAt: Date.now(), ttlMs: ttl });
  return { acquired: true };
}

// --- TASK A: Pre-Edit Lock Acquisition IPC ---
ipcMain.handle('pre-acquire-file-lock', async (_event, data: {
  filePath: string;
  terminalId: string;
  sessionId?: string;
  timeoutMs?: number;
}) => {
  const { filePath, terminalId, sessionId, timeoutMs = 30000 } = data;
  
  const existing = fileLocks.get(filePath);
  if (existing && existing.terminalId !== terminalId) {
    if (Date.now() - existing.acquiredAt < (existing.ttlMs || getLockTTL())) {
      return {
        acquired: false,
        heldBy: existing.terminalId,
        heldSince: existing.acquiredAt,
        message: `File locked by terminal ${existing.terminalId}. Wait or coordinate.`,
      };
    }
    fileLocks.delete(filePath);
  }
  
  // Git snapshot before edit (best-effort)
  let stashRef: string | null = null;
  try {
    stashRef = await gitSnapshotBeforeEdit(filePath, terminalId);
  } catch (e) { /* ignore */ }
  
  const ttl = timeoutMs;
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  
  db.prepare(`INSERT OR REPLACE INTO file_locks (file_path, terminal_id, session_id, action, acquired_at, expires_at, stash_ref) 
              VALUES (?, ?, ?, ?, datetime('now'), ?, ?)`).run(
    filePath, terminalId, sessionId || null, 'pre-edit', expiresAt, stashRef
  );
  
  fileLocks.set(filePath, {
    filePath,
    terminalId,
    sessionId,
    action: 'pre-edit',
    acquiredAt: Date.now(),
    ttlMs: ttl,
  });
  
  return { acquired: true, ttlMs: ttl, stashRef };
});

ipcMain.handle('release-pre-lock', async (_event, data: { filePath: string; terminalId: string }) => {
  const lock = fileLocks.get(data.filePath);
  if (lock && lock.terminalId === data.terminalId && lock.action === 'pre-edit') {
    const ttl = getLockTTL();
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    
    lock.action = 'post-edit';
    lock.acquiredAt = Date.now();
    lock.ttlMs = ttl;
    
    db.prepare(`UPDATE file_locks SET action = 'post-edit', acquired_at = datetime('now'), expires_at = ? WHERE file_path = ? AND terminal_id = ?`).run(
      expiresAt, data.filePath, data.terminalId
    );
  }
  return { success: true };
});

ipcMain.handle('git-snapshot-before-edit', async (_event, filePath: string, terminalId: string) => {
  return await gitSnapshotBeforeEdit(filePath, terminalId);
});

ipcMain.handle('git-restore-on-corrupt', async (_event, filePath: string, stashRef: string) => {
  return await gitRestoreOnCorrupt(filePath, stashRef);
});

// --- TASK G: Fix detectEditsInOutput project_path population ---
function detectEditsInOutput(data: string, terminalId: string, sessionId?: string): void {
  const FILE_VERB_RE = /(?:wrote|saved|written|modified|created|updated|writes? to|edits?)\s+`?(?:\.\/)?([^\s`'"()]+\.[a-zA-Z]+)/gi;
  let match;
  while ((match = FILE_VERB_RE.exec(data)) !== null) {
    const filePath = match[1];
    const result = acquireLock(filePath, terminalId, sessionId, 'edit');
    
    if (!result.acquired && mainWindow) {
      mainWindow.webContents.send('file:conflict', {
        filePath,
        requestingTerminal: terminalId,
        lockingTerminal: result.heldBy,
      });
    }
    
    try {
      const binding = db.prepare('SELECT project_id FROM terminal_bindings WHERE terminal_id = ?').get(terminalId) as any;
      const projectPath = binding?.project_id 
        ? (db.prepare('SELECT path FROM projects WHERE id = ?').get(binding.project_id) as any)?.path 
        : null;

      db.prepare('INSERT INTO touched_files (terminal_id, session_id, file_path, action, project_path) VALUES (?, ?, ?, ?, ?)').run(
        terminalId, sessionId || null, filePath, result.acquired ? 'edit' : 'conflict', projectPath || null
      );
    } catch {}
  }
}
```

---

### 2. `scripts/build.mjs`
Implements a PID-based mutex with a 5-minute stale-lock detection window to prevent parallel build corruption without blocking development indefinitely.

```javascript
import fs from 'fs';
import path from 'path';

const LOCK_FILE = path.join(process.cwd(), '.build-lock');

function acquireBuildLock() {
  try {
    const existing = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
    const pid = parseInt(existing);
    
    if (pid && !isNaN(pid)) {
      try {
        process.kill(pid, 0); // Check if process exists
        
        // Check if lock is stale (older than 5 minutes)
        const stats = fs.statSync(LOCK_FILE);
        const ageMs = Date.now() - stats.mtimeMs;
        
        if (ageMs < 5 * 60 * 1000) {
          console.error(`Build already in progress (PID ${pid}). Wait or kill it.`);
          process.exit(1);
        } else {
          console.warn(`Stale build lock detected (PID ${pid}, age ${Math.round(ageMs/1000)}s). Removing.`);
          fs.unlinkSync(LOCK_FILE);
        }
      } catch {
        // Process doesn't exist — stale lock, remove it
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch {}
  
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  
  const cleanup = () => {
    try { fs.unlinkSync(LOCK_FILE); } catch {}
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });
}

acquireBuildLock();

// ... rest of your build script (vite build -> esbuild, etc.)
```

---

### 3. `src/preload.ts`
Exposes the new IPC bridges to the renderer process.

```typescript
// Add to the contextBridge.exposeInMainWorld('deskflowAPI', { ... }) object:

preAcquireFileLock: (data: { filePath: string; terminalId: string; sessionId?: string; timeoutMs?: number }) =>
  ipcRenderer.invoke('pre-acquire-file-lock', data),

releasePreLock: (data: { filePath: string; terminalId: string }) =>
  ipcRenderer.invoke('release-pre-lock', data),

gitSnapshotBeforeEdit: (filePath: string, terminalId: string) =>
  ipcRenderer.invoke('git-snapshot-before-edit', filePath, terminalId),

gitRestoreOnCorrupt: (filePath: string, stashRef: string) =>
  ipcRenderer.invoke('git-restore-on-corrupt', filePath, stashRef),
```

---

### 4. `src/types/deskflow-api.d.ts`
Provides strict TypeScript definitions for the new API surface.

```typescript
export interface DeskflowAPI {
  // ... existing types
  
  preAcquireFileLock: (data: { 
    filePath: string; 
    terminalId: string; 
    sessionId?: string; 
    timeoutMs?: number; 
  }) => Promise<{ 
    acquired: boolean; 
    heldBy?: string; 
    heldSince?: number; 
    ttlMs?: number; 
    message?: string; 
    stashRef?: string | null; 
  }>;
  
  releasePreLock: (data: { filePath: string; terminalId: string }) => Promise<{ success: boolean }>;
  
  gitSnapshotBeforeEdit: (filePath: string, terminalId: string) => Promise<string | null>;
  
  gitRestoreOnCorrupt: (filePath: string, stashRef: string) => Promise<boolean>;
}
```

---

### Key Design Decisions & Constraint Checks
1. **Pre-Edit Blocking**: The `pre-acquire-file-lock` handler actively blocks concurrent edits by returning `acquired: false` *before* the agent writes, solving the post-hoc cosmetic lock issue.
2. **Crash Resilience**: Locks are persisted to SQLite (`file_locks` table). On startup, expired locks are swept (`DELETE FROM file_locks WHERE expires_at < datetime('now')`), ensuring no deadlocks after a crash.
3. **Git Safety Net**: `gitSnapshotBeforeEdit` runs per-file right before lock acquisition. If a conflict or corruption occurs, the renderer can call `gitRestoreOnCorrupt` using the returned `stashRef`. Wrapped in `try/catch` so it fails silently if not in a git repo.
4. **Build Mutex**: The 5-minute stale lock check (`ageMs < 5 * 60 * 1000`) ensures that if a dev machine crashes mid-build, the next build won't be permanently blocked.
5. **No New Dependencies**: Uses only Node.js built-ins (`child_process.execSync`, `fs`, `path`).
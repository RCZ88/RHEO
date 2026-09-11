# RESULT.md

## 1. DB Schema for All New Tables
*To be added in `main.ts` migration block (~line 3803)*

```sql
-- Task A: Agent Communication Protocol
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'TASK' | 'REPORT' | 'ESCALATE' | 'DIRECTIVE' | 'MERGE_OK' | 'MERGE_CONFLICT' | 'INFO'
  summary TEXT,
  payload TEXT, -- JSON stringified
  status TEXT DEFAULT 'pending', -- 'pending' | 'delivered' | 'completed' | 'failed'
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_mission ON agent_messages(mission_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to_node ON agent_messages(to_node_id, status);

-- Task B: Session Grouping
CREATE TABLE IF NOT EXISTS session_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL, -- hex code
  project_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Alter existing sessions table (conceptual migration)
-- ALTER TABLE sessions ADD COLUMN group_id TEXT REFERENCES session_groups(id);

-- Task D: Brain→Agent Learning Loop
CREATE TABLE IF NOT EXISTS brain_memories (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  entity TEXT NOT NULL,
  fact TEXT NOT NULL,
  confidence REAL DEFAULT 0.8,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_brain_memories_entity ON brain_memories(entity);

-- Task E: Mission Persistence (if not fully persisted already)
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  config TEXT NOT NULL, -- JSON stringified
  status TEXT DEFAULT 'pending', -- 'pending' | 'running' | 'blocked' | 'done' | 'failed'
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

---

## 2. IPC Handlers (Complete Code)
*To be added in `main.ts` (e.g., around line 15000+ where other IPC handlers are registered)*

```typescript
// --- Task A: Agent Communication ---
ipcMain.handle('conductor:send-message', async (event, msg: Omit<ConductorMessage, 'ts' | 'id'>) => {
  const msgId = crypto.randomUUID();
  const ts = Date.now();
  const fullMsg = { ...msg, id: msgId, ts };
  
  // 1. Persist to DB
  await db.run(`INSERT INTO agent_messages (id, mission_id, from_node_id, to_node_id, type, summary, payload, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [msgId, msg.missionId, msg.from, msg.to, msg.type, msg.summary, JSON.stringify(msg.payload)]);
  
  // 2. Write to file for agent polling
  const commsDir = path.join(projectRoot, '.conductor', 'comms');
  await fs.mkdir(commsDir, { recursive: true });
  await fs.writeFile(path.join(commsDir, `${msgId}.json`), JSON.stringify(fullMsg, null, 2));
  
  // 3. Notify renderer
  mainWindow?.webContents.send('conductor:message-updated', fullMsg);
  return fullMsg;
});

ipcMain.handle('conductor:mark-message-status', async (event, msgId: string, status: 'delivered' | 'completed' | 'failed') => {
  await db.run(`UPDATE agent_messages SET status = ?, updated_at = strftime('%s', 'now') WHERE id = ?`, [status, msgId]);
  
  // Update file to reflect completion for polling agents
  const commsDir = path.join(projectRoot, '.conductor', 'comms');
  const filePath = path.join(commsDir, `${msgId}.json`);
  if (await fs.exists(filePath)) {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    data.status = status;
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
  
  mainWindow?.webContents.send('conductor:message-updated', { id: msgId, status });
  return { success: true };
});

ipcMain.handle('conductor:get-messages', async (event, nodeId: string, missionId: string) => {
  const rows = await db.all(`SELECT * FROM agent_messages WHERE to_node_id = ? AND mission_id = ? ORDER BY created_at ASC`, [nodeId, missionId]);
  return rows.map((r: any) => ({ ...r, payload: JSON.parse(r.payload || '{}') }));
});

// --- Task B: Session Grouping ---
ipcMain.handle('session-groups:create', async (event, group: { name: string; color: string; project_id: string }) => {
  const id = crypto.randomUUID();
  await db.run(`INSERT INTO session_groups (id, name, color, project_id) VALUES (?, ?, ?, ?)`, [id, group.name, group.color, group.project_id]);
  return { id, ...group };
});

ipcMain.handle('session-groups:assign', async (event, sessionId: string, groupId: string | null) => {
  await db.run(`UPDATE sessions SET group_id = ? WHERE id = ?`, [groupId, sessionId]);
  return { success: true };
});

ipcMain.handle('session-groups:list', async (event, projectId: string) => {
  return await db.all(`SELECT * FROM session_groups WHERE project_id = ?`, [projectId]);
});

// --- Task C & D: Context & Brain ---
ipcMain.handle('context:get-dashboard', async (event, sessionId: string) => {
  // Aggregate token usage, vocabulary mappings, active problems
  const vocab = await db.all(`SELECT * FROM vocabulary WHERE session_id = ? OR session_id IS NULL`, [sessionId]);
  const problems = await db.all(`SELECT * FROM problems WHERE status = 'active' LIMIT 5`);
  return { vocabulary: vocab, activeProblems: problems, tokenBudget: 4000 };
});

ipcMain.handle('brain:query', async (event, entity: string) => {
  const memories = await db.all(`SELECT * FROM brain_memories WHERE entity LIKE ? ORDER BY confidence DESC LIMIT 10`, [`%${entity}%`]);
  return memories;
});

ipcMain.handle('brain:add-reflection', async (event, reflection: { session_id: string; entity: string; fact: string }) => {
  const id = crypto.randomUUID();
  await db.run(`INSERT INTO brain_memories (id, session_id, entity, fact) VALUES (?, ?, ?, ?)`, 
    [id, reflection.session_id, reflection.entity, reflection.fact]);
  return { success: true };
});
```

---

## 3. Preload Bridges (Complete Code)
*To be added in `preload.ts` (e.g., around line 800+)*

```typescript
// Agent Communication
conductor: {
  sendMessage: (msg: Omit<ConductorMessage, 'ts' | 'id'>) => 
    ipcRenderer.invoke('conductor:send-message', msg),
  markMessageStatus: (msgId: string, status: 'delivered' | 'completed' | 'failed') => 
    ipcRenderer.invoke('conductor:mark-message-status', msgId, status),
  getMessages: (nodeId: string, missionId: string) => 
    ipcRenderer.invoke('conductor:get-messages', nodeId, missionId),
  onMessageUpdated: (callback: (msg: any) => void) => {
    const subscription = (_event: any, msg: any) => callback(msg);
    ipcRenderer.on('conductor:message-updated', subscription);
    return () => ipcRenderer.removeListener('conductor:message-updated', subscription);
  }
},

// Session Grouping
sessionGroups: {
  create: (group: { name: string; color: string; project_id: string }) => 
    ipcRenderer.invoke('session-groups:create', group),
  assign: (sessionId: string, groupId: string | null) => 
    ipcRenderer.invoke('session-groups:assign', sessionId, groupId),
  list: (projectId: string) => 
    ipcRenderer.invoke('session-groups:list', projectId),
},

// Context & Brain
context: {
  getDashboard: (sessionId: string) => 
    ipcRenderer.invoke('context:get-dashboard', sessionId),
},
brain: {
  query: (entity: string) => 
    ipcRenderer.invoke('brain:query', entity),
  addReflection: (reflection: { session_id: string; entity: string; fact: string }) => 
    ipcRenderer.invoke('brain:add-reflection', reflection),
}
```

---

## 4. ConductorService Modifications (Diff-Style)
*File: `src/services/conductor/ConductorService.ts`*

```diff
@@ -1,5 +1,6 @@
 import * as path from 'path';
 import * as fs from 'fs/promises';
+import { getDb } from '../../main'; // Access to main process DB
 
 export class ConductorService {
   private nodes: Map<string, ConductorNode> = new Map();
+  private missionId: string;
 
-  constructor(private projectPath: string) {}
+  constructor(private projectPath: string, missionId: string) {
+    this.missionId = missionId;
+  }
 
@@ -45,6 +48,15 @@
   async startMission(config: any) {
+    // Task E: DB Persistence for missions
+    const db = getDb();
+    await db.run(`INSERT INTO missions (id, config, status) VALUES (?, ?, 'running')`, 
+      [this.missionId, JSON.stringify(config)]);
+
     // ... existing spawning logic ...
   }
 
@@ -120,10 +132,25 @@
   private async pollNode(node: ConductorNode) {
     const dir = path.join(this.projectPath, node.worktreePath, '.conductor');
     
+    // Task E: Build mutex integration before merge operations
+    if (node.role === 'resolver' || node.role === 'auditor') {
+      const { acquireBuildLock } = await import('../../main');
+      const lock = await acquireBuildLock(this.missionId);
+      if (!lock.acquired) {
+        this.log(`Node ${node.id} waiting for build lock...`);
+        return; // Skip this tick, try again next time
+      }
+    }
+
+    // Task A: Process DB-backed communication queue
+    await this.processCommunicationQueue(node, dir);
+
     // ... existing file polling logic (REPORT.json, ESCALATE.json, etc.) ...
   }
 
+  private async processCommunicationQueue(node: ConductorNode, dir: string) {
+    const db = getDb();
+    const commsDir = path.join(dir, 'comms');
+    
+    // Fetch pending messages for this node from DB
+    const messages = await db.all(`SELECT * FROM agent_messages WHERE to_node_id = ? AND status = 'pending'`, [node.id]);
+    
+    for (const msg of messages) {
+      const filePath = path.join(commsDir, `${msg.id}.json`);
+      if (await fs.access(filePath).catch(() => false)) {
+        // Agent will read this file. We mark it as 'delivered' in DB
+        await db.run(`UPDATE agent_messages SET status = 'delivered' WHERE id = ?`, [msg.id]);
+        
+        // Notify renderer of status change
+        // (Assuming mainWindow is accessible or via event emitter)
+      }
+    }
+  }
+
   async sendMessage(fromNodeId: string, toNodeId: string, type: ConductorMessage['type'], summary: string, payload?: any) {
+    // Task A: Delegate to IPC handler for dual-write (DB + File)
+    const { ipcRenderer } = await import('electron');
+    return await ipcRenderer.invoke('conductor:send-message', {
+      missionId: this.missionId,
+      from: fromNodeId,
+      to: toNodeId,
+      type,
+      summary,
+      payload
+    });
   }
 }
```

---

## 5. `assemble-context` Modifications
*File: `src/main/assemble-context.ts` (or equivalent context building function)*

```typescript
interface AssembleContextOptions {
  sessionId: string;
  problems: any[];
  requests: any[];
  sessions: any[];
  vocabulary: any[];
  dictionary: any[];
  brainMemories: any[];
  selectionCaptures: string[];
  maxTokens?: number; // Default 4000
}

export async function assembleContext(opts: AssembleContextOptions) {
  const maxTokens = opts.maxTokens || 4000;
  const parts: string[] = [];
  let tokensUsed = 0;

  // Helper to estimate tokens (1 token ≈ 4 chars) and add if under budget
  const addPart = (priority: number, title: string, content: string) => {
    const estimatedTokens = Math.ceil(content.length / 4);
    if (tokensUsed + estimatedTokens <= maxTokens) {
      parts.push(`### ${title}\n${content}`);
      tokensUsed += estimatedTokens;
      return true;
    }
    return false; // Budget exceeded
  };

  // 1. Active Problems (Highest Priority)
  for (const p of opts.problems.filter(x => x.status === 'active')) {
    addPart(1, `Active Problem: ${p.title}`, p.description);
  }

  // 2. Recent Sessions
  for (const s of opts.sessions.slice(0, 3)) {
    addPart(2, `Recent Session: ${s.name}`, s.summary || 'No summary');
  }

  // 3. Vocabulary Mappings (Variant → Canonical)
  const vocabMap = opts.vocabulary.map((v: any) => `"${v.variant}" → "${v.canonical}"`).join('\n');
  if (vocabMap) addPart(3, 'Vocabulary Mappings', vocabMap);

  // 4. User Dictionary Definitions
  const dictMap = opts.dictionary.map((d: any) => `${d.term}: ${d.definition}`).join('\n');
  if (dictMap) addPart(4, 'User Dictionary', dictMap);

  // 5. Brain Memories (Contextual)
  const brainMap = opts.brainMemories.map((m: any) => `[${m.entity}] ${m.fact} (confidence: ${m.confidence})`).join('\n');
  if (brainMap) addPart(5, 'Context Brain Memories', brainMap);

  // 6. Selection Captures (Visual Context)
  for (const capture of opts.selectionCaptures) {
    addPart(6, 'Visual Selection Context', capture);
  }

  const context = parts.join('\n\n---\n\n');
  return { success: true, context, tokensUsed };
}
```

---

## 6. UI Component Specs

### 6.1 `AgentCommsPanel.tsx`
- **Location**: `src/components/conductor/AgentCommsPanel.tsx`
- **Purpose**: Shows message queue, read/unread status, and completion state.
- **Features**:
  - List view of `ConductorMessage` filtered by current mission/node.
  - Color-coded status badges: `pending` (gray), `delivered` (blue), `completed` (green), `failed` (red).
  - "Mark as Completed" button that calls `window.electronAPI.conductor.markMessageStatus(msgId, 'completed')`.
  - Auto-scrolls to latest message.

### 6.2 `SessionGroupsManager.tsx`
- **Location**: `src/components/sessions/SessionGroupsManager.tsx`
- **Purpose**: Create/edit/delete groups, assign sessions.
- **Features**:
  - Sidebar or modal with a list of groups (showing `name` and `color` chip).
  - "Create Group" form (name input, color picker).
  - Drag-and-drop interface (using HTML5 `draggable` or existing DnD lib) to drop session items into group buckets.
  - Calls `window.electronAPI.sessionGroups.assign(sessionId, groupId)`.

### 6.3 `ContextDashboard.tsx`
- **Location**: `src/components/context/ContextDashboard.tsx`
- **Purpose**: Shows what's injected, token usage, vocabulary mappings.
- **Features**:
  - Progress bar showing `tokensUsed / 4000` budget.
  - Collapsible sections for "Active Problems", "Vocabulary Mappings", and "Brain Memories" currently injected.
  - Refresh button to re-evaluate context assembly.

### 6.4 `BrainStatusPanel.tsx`
- **Location**: `src/components/brain/BrainStatusPanel.tsx`
- **Purpose**: Entities, facts, recent memories, learning rate.
- **Features**:
  - Search input to query the brain: `window.electronAPI.brain.query(entity)`.
  - List of recent memories with confidence scores.
  - "Learning Rate" metric (e.g., "5 new facts added this session").
  - Manual "Add Reflection" button for human-in-the-loop (L2) to save a fact.

---

## 7. File-by-File Change List with Line Numbers

| File | Approx. Line(s) | Change Description |
| :--- | :--- | :--- |
| `src/main.ts` | ~3803 | Add DB migration SQL for `agent_messages`, `session_groups`, `brain_memories`, `missions`. |
| `src/main.ts` | ~15000+ | Add IPC handlers: `conductor:send-message`, `conductor:mark-message-status`, `conductor:get-messages`, `session-groups:*`, `context:get-dashboard`, `brain:*`. |
| `src/preload.ts` | ~800+ | Add `contextBridge.exposeInMainWorld` entries for `conductor`, `sessionGroups`, `context`, and `brain` APIs. |
| `src/services/conductor/ConductorService.ts` | ~1-10 | Import `getDb` and `acquireBuildLock`. Update constructor to accept `missionId`. |
| `src/services/conductor/ConductorService.ts` | ~45-60 | Modify `startMission` to insert mission record into DB for persistence. |
| `src/services/conductor/ConductorService.ts` | ~120-160 | Modify `pollNode` to check `acquireBuildLock` and call new `processCommunicationQueue`. |
| `src/services/conductor/ConductorService.ts` | ~200+ | Modify `sendMessage` to invoke IPC handler for dual-write (DB + File) instead of just file write. |
| `src/main/assemble-context.ts` | ~1-20 | Update function signature to accept `vocabulary`, `dictionary`, `brainMemories`, `selectionCaptures`, `maxTokens`. |
| `src/main/assemble-context.ts` | ~20-80 | Implement prioritized token budgeting logic (active problems > recent sessions > vocabulary > dictionary > brain). |
| `src/components/conductor/AgentCommsPanel.tsx` | New File | Implement UI for message queue, status badges, and completion actions. |
| `src/components/sessions/SessionGroupsManager.tsx` | New File | Implement UI for group CRUD and drag-to-group session assignment. |
| `src/components/context/ContextDashboard.tsx` | New File | Implement UI for token usage progress bar and injected context preview. |
| `src/components/brain/BrainStatusPanel.tsx` | New File | Implement UI for brain querying, memory list, and reflection addition. |

---
*Note: Ensure all build steps (`npx vite build`, `npx esbuild src/preload.ts`, `node scripts/rebuild-main.mjs`) are executed after applying these changes to verify type safety and correct IPC bridging.*
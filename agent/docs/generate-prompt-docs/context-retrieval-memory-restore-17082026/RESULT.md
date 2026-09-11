# RESULT.md — Topic-Based Memory Restoration Wiring

**Target Package:** `agent/docs/generate-prompt-docs/context-retrieval-memory-restore-17082026/`
**Architect:** Qwen3.8 (AI Architect)
**Date:** 2026-08-17

This document specifies the exact missing wiring to connect the fully implemented Context Brain (`contextBrain.ts`) and Memory Store to the terminal agent session assembly pipeline (`assemble-context`). No existing brain logic or IPC handlers are rewritten.

---

## 1. Exact Diffs & Patches

### 1.1 Main Process: `src/main.ts`
**Target:** The `assemble-context` IPC handler.
**Goal:** Inject the optional `topic` parameter, retrieve context from the Brain and Memory Store, format it, and enforce the token budget.

```diff
--- a/src/main.ts
+++ b/src/main.ts
@@ -15073,7 +15073,7 @@
 // main.ts:15073
- electron_1.ipcMain.handle('assemble-context', async (_event, data: { projectId: string; problemIds?: string[]; requestIds?: string[]; tokenBudget?: number }) => {
+ electron_1.ipcMain.handle('assemble-context', async (_event, data: { projectId: string; problemIds?: string[]; requestIds?: string[]; tokenBudget?: number; topic?: string; sessionId?: string }) => {
    try {
      const parts = [];
      let totalChars = 0;
@@ -15082,6 +15082,7 @@
      // existing logic queries terminal_sessions.topic here
+     const sessionTopic = db.prepare('SELECT topic FROM terminal_sessions WHERE id = ?').get(data.sessionId)?.topic || '';
      
      // ... [existing sections 1-4: problems, requests, sessions, backup protocol] ...
      
@@ -15130,6 +15131,45 @@
      // 5. [CONTEXT-BRAIN] userContextService.getProfile()
      try {
          const profile = userContextService.getProfile();
          parts.push(formatUserProfile(profile));
          totalChars = parts.reduce((sum, p) => sum + p.length, 0);
      } catch (e) { /* graceful degradation */ }
+
+     // 6. [CONTEXT-BRAIN] Topic-Based Memory Restoration
+     try {
+         const queryTopic = data.topic || sessionTopic || '';
+         if (queryTopic && queryTopic.trim().length > 1) {
+             const maxChars = (data.tokenBudget || 2000) * 4;
+             
+             // A. Brain Retrieval
+             let brainMd = '';
+             try {
+                 const brainResult = contextBrain.retrieve(queryTopic, ['keyword', 'graph']);
+                 brainMd = require('./main/ai/contextFormatter').formatBrainContext(queryTopic, brainResult);
+             } catch (brainErr) {
+                 console.warn('[assemble-context] Brain retrieval failed:', brainErr.message);
+             }
+
+             // B. Memory Store Retrieval (agent_memories / ai_chat_memories)
+             let memoryMd = '';
+             try {
+                 const memoryResult = require('./main/ai/memoryRetrieval').search(queryTopic, 3);
+                 memoryMd = require('./main/ai/contextFormatter').formatMemoryContext(memoryResult);
+             } catch (memErr) {
+                 console.warn('[assemble-context] Memory retrieval failed:', memErr.message);
+             }
+
+             // C. Budget Enforcement & Injection
+             const combinedMd = (brainMd + '\n' + memoryMd).trim();
+             if (combinedMd.length > 0) {
+                 const remainingBudget = maxChars - totalChars - 200; // 200 char safety margin
+                 if (remainingBudget > 100) {
+                     const truncatedMd = require('./main/ai/contextFormatter').truncateToBudget(combinedMd, remainingBudget);
+                     parts.push(truncatedMd);
+                     totalChars += truncatedMd.length;
+                 }
+             }
+         }
+     } catch (err) {
+         console.warn('[assemble-context] Memory restoration block failed:', err.message);
+     }
```

### 1.2 Renderer: `src/services/ContextService.ts`
**Target:** Line 149. Pass-through for the explicit topic.

```diff
--- a/src/services/ContextService.ts
+++ b/src/services/ContextService.ts
@@ -149,6 +149,6 @@
- assembleContext(projectId: string, problemIds?: string[], requestIds?: string[], tokenBudget?: number) {
-   return window.electron.assembleContext({ projectId, problemIds, requestIds, tokenBudget });
+ assembleContext(projectId: string, problemIds?: string[], requestIds?: string[], tokenBudget?: number, topic?: string) {
+   return window.electron.assembleContext({ projectId, problemIds, requestIds, tokenBudget, topic });
  }
```

### 1.3 Preload Bridge: `src/preload.ts`
**Target:** Line 876. Update IPC invoke signature.

```diff
--- a/src/preload.ts
+++ b/src/preload.ts
@@ -876,5 +876,5 @@
- assembleContext: (data) => ipcRenderer.invoke('assemble-context', data),
+ assembleContext: (data: { projectId: string; problemIds?: string[]; requestIds?: string[]; tokenBudget?: number; topic?: string }) => ipcRenderer.invoke('assemble-context', data),
```

---

## 2. Final Markdown Template

To prevent collisions with the reserved `## Session Metadata` and `## Actions` blocks, the injected text uses strictly scoped `## Memory` headers.

```markdown
## Memory — {{topic}} (from Context Brain)
### Facts
- {{subject}} {{predicate}} {{objectLiteral}} (confidence: {{confidence}})
- {{subject}} {{predicate}} {{objectLiteral}} (confidence: {{confidence}})

### Related entities
- {{type}}: {{name}} (aliases: {{aliases}})

### Relevant episodes
- [{{source}}] {{content_excerpt}}... ({{occurredAt}})
- [{{source}}] {{content_excerpt}}... ({{occurredAt}})

## Memory — saved notes
- {{memory_excerpt_1}}... ({{date}})
```
*(Note: If a section is empty, it is omitted entirely. The headers are dynamically generated by `contextFormatter.ts`.)*

---

## 3. Truncation & Budget Algorithm (Pseudocode)

This algorithm guarantees that memory injection never causes context-window overflow, prioritizing high-value, low-token facts over verbose episodes.

```javascript
// contextFormatter.ts
function truncateToBudget(markdownString, maxChars) {
    if (markdownString.length <= maxChars) return markdownString;

    // 1. Parse Markdown into blocks based on ### headers
    const blocks = parseMarkdownBlocks(markdownString);
    
    // 2. Prioritize Blocks (Facts & Entities are small and high-value)
    const facts = blocks.filter(b => b.header.includes('Facts'));
    const entities = blocks.filter(b => b.header.includes('entities'));
    const episodes = blocks.filter(b => b.header.includes('episodes'));
    const savedNotes = blocks.filter(b => b.header.includes('saved notes'));

    let output = '';
    let currentLength = 0;

    // 3. Inject Facts & Entities unconditionally (they rarely exceed 500 chars total)
    for (const block of [...facts, ...entities]) {
        output += block.raw + '\n';
        currentLength += block.raw.length;
    }

    // 4. Truncate Episodes (Longest-first removal to save the most recent/relevant)
    // Sort episodes by length descending, drop the longest until it fits, or truncate the longest.
    episodes.sort((a, b) => b.length - a.length);
    for (const ep of episodes) {
        if (currentLength + ep.length < maxChars - 200) {
            output += ep.raw + '\n';
            currentLength += ep.length;
        } else {
            // Hard truncate the longest episode if we are slightly over
            const allowedChars = maxChars - currentLength - 100;
            if (allowedChars > 50) {
                output += ep.raw.substring(0, allowedChars) + '... [TRUNCATED]\n';
            }
            break; // Stop adding episodes
        }
    }

    // 5. Inject saved notes if space remains
    for (const note of savedNotes) {
        if (currentLength + note.length < maxChars) {
            output += note.raw + '\n';
            currentLength += note.length;
        }
    }

    return output.trim();
}
```

---

## 4. Memory-Store Population Hook (Closing the Loop)

Currently, `agent_memories` has 0 rows. To make the `## Memory — saved notes` section viable, we must populate it when a session successfully concludes.

**Hook Point:** `src/main/ai/memoryCapture.ts` (or the `terminal_sessions` status update handler in `main.ts`).
**Trigger:** When `terminal_sessions.status` transitions to `'completed'` or `'success'`.

```javascript
// main.ts (inside terminal session status update handler)
if (newStatus === 'completed' && sessionTopic) {
    try {
        // Summarize the session's final output via local LLM or simple regex extraction
        const summary = await summarizeSession(sessionId); 
        require('./main/ai/memoryStore').saveAgentMemory({
            topic: sessionTopic,
            content: summary,
            source: 'terminal_session_completion',
            timestamp: Date.now()
        });
    } catch (e) {
        console.warn('Failed to capture agent memory on completion:', e);
    }
}
```
*This ensures that the next time the user opens a session about "tracking system", the `ai_chat_memories` / `agent_memories` query will return the actual work done previously.*

---

## 5. Verification Checklist (For Hands & Eyes Agent)

To prove the wiring is successful and functional without breaking the main process:

1. [ ] **Database Sanity Check:** Open `%APPDATA%\RHEO\deskflow-data.db`. Verify `context_facts` (25 rows) and `context_episodes` (23 rows) exist.
2. [ ] **Manual IPC Trigger:** Open DevTools in the renderer and execute:
    ```javascript
    window.electron.assembleContext({ 
        projectId: 'default', 
        tokenBudget: 2000, 
        topic: 'tracking system' // Explicitly passing the topic
    }).then(ctx => console.log(ctx));
    ```
3. [ ] **Output Validation:** Inspect the console log output. Confirm that the string contains:
    *   `## Memory — tracking system (from Context Brain)`
    *   `### Facts` containing at least one predicate/object pair.
    *   `[CONTEXT-BRAIN]` or standard `console.warn` logs if tables are missing (graceful degradation).
4. [ ] **Budget Overflow Test:** Trigger the IPC call with `tokenBudget: 50`. Verify that the resulting context string length is strictly `< 200` characters (50 * 4), and that the application does not crash.
5. [ ] **Collision Check:** Search the final output string. Ensure `## Session Metadata` and `## Actions` only appear in their designated places and are not overwritten or duplicated by the memory injection block.
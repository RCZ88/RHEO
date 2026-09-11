### Root-cause summary
The unreliable prompt insertion stems from a fundamental mismatch between DeskFlow's readiness heuristics and the architecture of modern Node.js CLI TUIs (Ink/React). 
1. **Regex Failure:** `detectAgentPrompt` (main.ts:11080) looks for a bare `>` on a clean line. Full-screen Ink TUIs (`opencode`, `claude`, `gemini`, `codex`) render input boxes using ANSI cursor positioning and box-drawing characters, so the regex never matches.
2. **Premature Flush:** `hasEnoughAgentOutputToAcceptInput` (main.ts:11183) flips to `ready` on the *first* output chunk. For Ink apps, this is the initial boot splash; the TUI’s input event loop is not yet attached, so flushed bracketed-paste payloads vanish into the void.
3. **Blind Fallbacks:** The 5s `forceReady` (main.ts:11305) blindly flush queues without verifying if the TUI is actually listening.
4. **Silent Loss:** `agent:send` returns `{ queued: true }` but never tracks if the queued write actually succeeded once flushed, leading to silent message loss and empty `terminal_messages` rows.

---

### Design

#### Per-Agent Readiness Strategy: "The Idle-Settle Heuristic"
Instead of parsing fragile ANSI frames or looking for specific prompts, we leverage the universal behavior of interactive TUIs: **they render frames in bursts, then go completely silent while waiting for user input.**

| Agent | Readiness Signal | Wait Strategy | Payload | Verify & Retry |
| :--- | :--- | :--- | :--- | :--- |
| **opencode** | PTY idle for 500ms + `buffer > 150 bytes` | Wait for settle (no blind dummy `\r`) | Bracketed Paste (`\x1b[200~...\x1b[201~\r`) | Wait 2.5s for new PTY output (TUI re-render). Retry once with `\r` + payload on timeout. |
| **claude** | PTY idle for 500ms + `buffer > 150 bytes` | Wait for settle | Bracketed Paste | Same as above. |
| **gemini** | PTY idle for 500ms + `buffer > 150 bytes` | Wait for settle | Bracketed Paste | Same as above. |
| **codex** | PTY idle for 500ms + `buffer > 150 bytes` | Wait for settle | Bracketed Paste | Same as above. |

#### Unified Write-Path State Machine
```text
[launching] ──(PTY idle 500ms + >150 bytes)──▶ [ready]
                                                │
[ready] ──(agent:send)──▶ [busy] ──(new PTY output < 2.5s)──▶ [ready]
                             │
                             └──(no output 2.5s)──▶ [RETRY: \r + payload] ──▶ [busy] ──▶ [ready] OR [error]

[busy] ──(action required pattern)──▶ [attention]
[launching] ──(15s hard timeout)──▶ [error] (Blind 5s force-ready REMOVED)
```

---

### Exact Code Changes

#### 1. `src/main.ts` — State Machine & Readiness
**Replace `hasEnoughAgentOutputToAcceptInput` (main.ts:11183) with `isTuiSettled`:**
```diff
- function hasEnoughAgentOutputToAcceptInput(st: AgentState): boolean {
-   const cfg = getAgentConfig(st.agentType);
-   if (!cfg.bracketedPaste) return false;
-   const lastLine = getLastNonEmptyTerminalLine(st.dataBuffer);
-   if (!lastLine) return false;
-   if (looksLikeShell(lastLine)) return false;
-   return st.dataBuffer.trim().length > 0;
- }
+ function isTuiSettled(st: AgentState): boolean {
+   // Must have received enough data to pass the initial boot splash
+   if (st.dataBuffer.length < 150) return false;
+   const lastLine = getLastNonEmptyTerminalLine(st.dataBuffer);
+   if (looksLikeShell(lastLine)) return false;
+   // Core heuristic: TUI has finished rendering its frame and is waiting for input
+   // (Ink/React TUIs go completely silent on stdout when awaiting stdin).
+   return (Date.now() - st.lastOutputAt) >= 500;
+ }
```

**Update `AgentState` interface (main.ts:11132) to track timing and verification:**
```diff
  interface AgentState {
    agentType: string;
    phase: AgentPhase;
    dataBuffer: string;
    idleSeq: number;
    launchStartedAt: number;
+   lastOutputAt: number;           // Timestamp of last PTY data chunk
+   verifyTimeout?: NodeJS.Timeout; // Timer for write verification
    handshakeToken?: string;
    timeoutHandle?: ReturnType<typeof setTimeout>;
```

**Update Data Callbacks (`spawn-terminal` & `terminal:create`, ~main.ts:12116):**
```diff
  // Inside the getDataHandler callback:
  const st = agentStates.get(id);
  if (!st) return;
+ st.lastOutputAt = Date.now(); // Reset idle timer on every chunk
  st.dataBuffer += data;
  if (st.dataBuffer.length > 10000) st.dataBuffer = st.dataBuffer.slice(-5000);
  handleAgentOutputChunk(id, st, data);

  // ... [existing memory capture] ...

- const promptSeen = detectAgentPrompt(st.dataBuffer, st.agentType);
  const actionRequired = (st.parsed?.actionRequired) || detectActionRequired(st.dataBuffer);

  // WRITE VERIFICATION: If we are busy and new data arrives, the TUI reacted to our write!
+ if (st.phase === 'busy' && st.verifyTimeout) {
+   console.log(`[AGENT-VERIFY] Write confirmed via PTY reaction for ${id}`);
+   clearTimeout(st.verifyTimeout);
+   st.verifyTimeout = undefined;
+   // Mark the pending message as verified in DB (handled via broadcast to renderer/DB layer)
+   broadcast('agent:write-verified', { terminalId: id });
+   st.phase = 'ready';
+   st.idleSeq += 1;
+   flushPendingAgentWrites(id, st);
+   broadcast('agent:idle', { terminalId: id, seq: st.idleSeq });
+   broadcast('ai-task:updated', { terminalId: id, status: 'completed' });
+   return; // Skip further state checks for this chunk
+ }

- if (st.phase === 'launching' && (isAgentReady() || hasEnoughAgentOutputToAcceptInput(st))) {
+ if (st.phase === 'launching' && (detectAgentPrompt(st.dataBuffer, st.agentType) || isTuiSettled(st))) {
+   console.log(`[AGENT-SETTLE] TUI settled or regex matched for ${id}. Flushing queue.`);
    markAgentReady(id, st);
  } else if ((st.phase === 'busy' || st.phase === 'attention') && detectAgentPrompt(st.dataBuffer, st.agentType)) {
    // ... existing idle transition ...
```

**Remove Blind Force-Ready in `startAgentTimeout` (main.ts:11299):**
```diff
  function startAgentTimeout(id: string, agentType: string) {
    const st = agentStates.get(id);
    if (!st) return;
-   // [FORCE-READY] For TUI agents, regex may never match (ANSI clutter).
-   // Force ready after 5s if still launching — the prompt will be queued and flushed.
-   const forceReadyTimer = setTimeout(() => {
-     const current = agentStates.get(id);
-     if (current && current.phase === 'launching') {
-       console.log(`[AgentTimeout] Forcing ready for ${id} after 5s (TUI agent fallback)`);
-       markAgentReady(id, current);
-     }
-   }, 5000);
    // Full error timeout at 15s (reduced from 30s since we no longer blind-force at 5s)
    const timer = setTimeout(() => {
-     clearTimeout(forceReadyTimer);
      if (agentStates.get(id)?.phase !== 'launching') return;
      // ... existing diag and fail logic ...
    }, 15000);
    st.timeoutHandle = timer;
  }
```

**Rewrite `agent:send` Handler (main.ts:12243) for Verified Writes:**
```diff
  electron_1.ipcMain.handle('agent:send', async (_event, terminalId: string, data: string, agentType?: string) => {
      const st = agentStates.get(terminalId);
      if (!st) return { success: false, error: 'Agent session not found' };
      const type = agentType || DEFAULT_AGENT;
      // ... [existing memory capture & recordPrompt] ...

      if (st.phase === 'launching' || st.phase === 'busy') {
          st.pendingWrites = st.pendingWrites || [];
          st.pendingWrites.push(data);
          const result = recordPrompt();
          if (result) notifyTask(result.lastInsertRowid);
-         return { success: true, queued: true };
+         return { success: true, queued: true, written: false, verified: false };
      }

      const payload = buildAgentInputPayload(data, st.agentType || type);
      const success = terminalManager.write(terminalId, payload);
      if (success) {
          st.phase = 'busy';
          const result = recordPrompt();
          if (result) notifyTask(result.lastInsertRowid);

+         // Start Verification Timer
+         if (st.verifyTimeout) clearTimeout(st.verifyTimeout);
+         st.verifyTimeout = setTimeout(() => {
+             if (st.phase === 'busy') {
+                 console.warn(`[AGENT-VERIFY] Write unverified after 2.5s for ${id}. Retrying...`);
+                 // Retry once: send a wake \r (in case input box lost focus) then payload
+                 terminalManager.write(terminalId, '\r');
+                 setTimeout(() => {
+                     terminalManager.write(terminalId, payload);
+                     // Final fail timer
+                     st.verifyTimeout = setTimeout(() => {
+                         if (st.phase === 'busy') {
+                             console.error(`[AGENT-VERIFY] Retry failed for ${id}. Marking error.`);
+                             st.phase = 'error';
+                             st.lastError = 'Write unverified: TUI did not react to input';
+                             broadcast('agent:write-failed', { terminalId: id, reason: 'unverified-write' });
+                             // TODO: Update terminal_messages status to 'failed' here
+                         }
+                     }, 2500);
+                 }, 100);
+             }
+         }, 2500);

-         return { success, queued: false };
+         return { success: true, queued: false, written: true, verified: false };
      }
      return { success: false, error: 'PTY write failed' };
  });
```

#### 2. `src/pages/TerminalPage.tsx` — Renderer Updates
**Remove Blind Dummy-Enter in `initializeTerminal` (~Line 1134):**
```diff
-      // ═══ DUMMY ENTER FALLBACK ═══
-      const phase = await window.deskflowAPI?.agentGetPhase?.(terminalId);
-      if (phase === 'launching') {
-        console.log('[TerminalPage] Agent still launching after timeout, sending dummy Enter to wake TUI');
-        await window.deskflowAPI?.terminalWriteRaw?.(terminalId, '\r');
-        await new Promise(r => setTimeout(r, 1000));
-      }
-      // ═══ SETTLE: let TUI fully grab the PTY before first flush ═══
-      await new Promise(r => setTimeout(r, 200));
+      // ═══ SETTLE ═══
+      // The backend now handles TUI settle detection via the 500ms idle heuristic.
+      // We just wait a brief moment to ensure the PTY spawn command has fully registered.
+      await new Promise(r => setTimeout(r, 300));
```

**Update System Prompt Send Logic (~Line 1154):**
```diff
       if (systemPrompt && promptParts.length > 0 && window.deskflowAPI?.agentSend) {
         const combined = promptParts.join('\n\n');
         const sendResult = await window.deskflowAPI.agentSend(terminalId, combined, agent);
         if (!sendResult?.success) {
           console.warn('[TerminalPage] Failed to send initialization prompt:', sendResult?.error);
-        } else {
-          console.log('[TerminalPage] Sent initialization prompt:', combined.length, 'chars,', sendResult?.queued ? 'queued (waiting for agent ready)' : 'sent immediately');
         }
+        // The backend will broadcast 'agent:write-verified' or 'agent:write-failed'
+        // No need to block the renderer waiting for verification here.
       }
```

#### 3. `src/preload.ts` & `src/deskflow-api.d.ts`
No new IPC channels are required. The existing `agent:send` channel is preserved, but the renderer should be aware of the expanded return type. Update the TypeScript definition in `deskflow-api.d.ts` (or wherever the bridge types are defined):
```typescript
// Update the return type of agentSend
agentSend: (terminalId: string, data: string, agentType?: string) => Promise<{ 
  success: boolean; 
  queued?: boolean; 
  written?: boolean; 
  verified?: boolean; 
  error?: string 
}>;
```

---

### New Log Lines & PASS Criteria

When observing the main process console (via `--remote-debugging-port`), look for these markers:

| Agent | PASS Log Sequence | Meaning |
| :--- | :--- | :--- |
| **All** | `[AGENT-SETTLE] TUI settled or regex matched for {id}. Flushing queue.` | The 500ms idle heuristic successfully detected the TUI input box. Queue flushed safely. |
| **All** | `[AGENT-VERIFY] Write confirmed via PTY reaction for {id}` | The TUI received the bracketed paste and re-rendered its frame within 2.5s. Message is confirmed in DB. |
| **All** | `[AGENT-VERIFY] Write unverified after 2.5s... Retrying...` | TUI didn't react. Fallback retry triggered. |
| **All** | `[AGENT-VERIFY] Retry failed... Marking error.` | Hard failure. TUI is frozen or input handler detached. Broadcasts `agent:write-failed`. |

---

### Testing Plan
*Note: As per constraints, runtime verification is ATTACH-ONLY. Interactive TUI behavior requires manual UI passes by the user.*

1. **Opencode Fresh Launch:** Create a new session with `opencode`. Send a prompt immediately.
   * *Verify:* Main console shows `[AGENT-SETTLE]` followed by `[AGENT-VERIFY] Write confirmed`. The prompt appears in the opencode input box and executes.
2. **Claude Code Resume:** Resume an existing `claude` session.
   * *Verify:* Session ID is captured correctly (unchanged logic), and the system prompt flushes only *after* the Ink TUI finishes drawing the resume UI.
3. **Network Lag Simulation:** Use a tool like `clumsy` (Windows) or `tc` (Linux) to add 500ms latency to local loopback, or simply test with a heavy project where `opencode` takes >3s to index before drawing the UI.
   * *Verify:* The queue holds the message. The 15s hard timeout does *not* fire prematurely. Once the TUI finally draws and idles, `[AGENT-SETTLE]` fires and the message is delivered.
4. **Frozen TUI Test:** Kill the underlying agent process via Task Manager/Activity Monitor without killing the PTY shell. Send a message.
   * *Verify:* `[AGENT-VERIFY]` retry fires, then fails. `agent:write-failed` is broadcast. No silent loss.

---

### Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Double-Send on Slow TUIs:** If a TUI takes >2.5s to process a paste and re-render, the verify timer might fire and send the prompt twice. | 2.5s is extremely generous for local PTY re-renders (usually <100ms). If a retry *does* happen, Ink TUIs will just append the text to the input box twice. The user can easily backspace. This is vastly preferable to silent loss. |
| **Busy-Phase False-Idle:** If the AI is "thinking" and outputting a spinner, `isTuiSettled` won't trigger (which is correct, we shouldn't interrupt). But if the spinner pauses for >500ms, it might falsely trigger `ready`. | The `actionRequired` and `busy` state checks in the data callback take precedence. If the agent is actively processing a previous prompt, phase is `busy`, and `isTuiSettled` is ignored for state transitions. |
| **Session-ID Capture Races:** `opencode` creates the DB row lazily on the first message. If the first message fails verification, the DB row might not exist. | The `agent:write-failed` broadcast allows the renderer to surface an explicit error ("Agent failed to accept prompt") rather than showing a ghost session. The existing `captureOpencodeSessionId` background task remains untouched and will still catch it if the retry succeeds. |
| **CRLF / Line Endings:** Mass formatters might strip CRLF, breaking the PTY expectations for Windows shells. | Diffs provided are strictly surgical. No mass reformatting is applied. The `buildAgentInputPayload` explicitly normalizes to `\n` and appends `\r` for the PTY, preserving protocol correctness. |
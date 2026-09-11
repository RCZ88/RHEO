I'll analyze your DeskFlow terminal workspace issue and research systematic approaches for wrapping/interacting with these TUI CLIs. Let me start by examining the specific technical problems in your context and then research how each CLI tool works.
I've analyzed your DeskFlow context bundle and researched the current state of programmatic interfaces for all major AI coding CLIs. Here's what I found and my recommended approach.

---

## 1. The Root Cause: Why Your TUI Content Gets "Pushed Down"

Your context bundle explicitly documents this in the **Known Issues** section:

> **Terminal dimensions mismatch**: If `measureSpawnSize()` runs before xterm.js finishes layout, it returns 80x24 fallback. The TUI renders for wrong dimensions → content pushes down.

This is exactly what you're experiencing. When OpenCode, Claude Code, or Gemini CLI launches, they query the terminal dimensions to calculate their TUI layout. If the PTY was spawned with 80×24 (the fallback) but your xterm.js container is actually 120×40, the TUI draws its interface for a small terminal. The result: the text input area appears at the bottom of the 24-row "virtual" terminal, which gets pushed down visually in your larger container.

### The Fix

Your current code waits for `2x requestAnimationFrame` before measuring, but xterm.js's internal char measurement happens asynchronously via its `CharMeasure` component. You need to wait for xterm.js to finish its own internal layout, not just the browser's.

**Replace your `measureSpawnSize` + spawn timing with this approach:**

```typescript
// In TerminalWindow.tsx / TerminalLayout
function waitForXtermLayout(terminalId: string, timeout = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.querySelector(`[data-terminal-id="${terminalId}"]`);
    if (!el) return resolve(false);
    
    // xterm.js uses .xterm-char-measure-element for font metrics
    const checkReady = () => {
      const measureEl = el.querySelector('.xterm-char-measure-element');
      const rowsContainer = el.querySelector('.xterm-rows');
      if (measureEl && rowsContainer && rowsContainer.children.length > 0) {
        // Also verify dimensions are non-zero and non-fallback
        const rect = el.getBoundingClientRect();
        const cellW = (measureEl as HTMLElement).offsetWidth;
        const cellH = (rowsContainer.children[0] as HTMLElement).offsetHeight;
        if (cellW > 0 && cellH > 0 && rect.width > 0 && rect.height > 0) {
          return resolve(true);
        }
      }
      return resolve(false);
    };
    
    // Use MutationObserver to detect when xterm.js injects its DOM
    const observer = new MutationObserver((_, obs) => {
      if (checkReady()) {
        obs.disconnect();
      }
    });
    
    observer.observe(el, { childList: true, subtree: true });
    
    // Fallback: poll for up to timeout
    const start = Date.now();
    const interval = setInterval(() => {
      if (checkReady() || Date.now() - start > timeout) {
        clearInterval(interval);
        observer.disconnect();
        resolve(checkReady());
      }
    }, 50);
  });
}

// In handleTerminalReady:
async function handleTerminalReady(terminalId: string) {
  if (spawnedTerminalsRef.current.has(terminalId)) return;
  
  // Wait for xterm.js DOM to be fully ready, not just browser layout
  const xtermReady = await waitForXtermLayout(terminalId);
  if (!xtermReady) {
    console.warn(`[DeskFlow] xterm.js layout not ready for ${terminalId}, using fallback`);
  }
  
  const { cols, rows } = measureSpawnSize(terminalId);
  spawnedTerminalsRef.current.add(terminalId);
  
  await spawnTerminal(terminalId, projectPath, agentType, cols, rows);
  
  // Critical: re-measure and resize AFTER spawn, not just refit
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const { cols: newCols, rows: newRows } = measureSpawnSize(terminalId);
      if (newCols !== cols || newRows !== rows) {
        terminalResize(terminalId, newCols, newRows);
      }
      // Dispatch refit to sync xterm ↔ PTY
      window.dispatchEvent(new CustomEvent(`terminal:refit-${terminalId}`));
    });
  });
}
```

**Also fix the ResizeObserver** — your current code disconnects after one fire, but TUI apps need continuous resize:

```typescript
// Instead of one-shot, keep observing (or use a debounced observer)
const ro = new ResizeObserver(debounce(() => {
  fitAddon.fit();
  terminalResize(terminalId, terminal.cols, terminal.rows);
}, 100));
ro.observe(container);
```

---

## 2. The Strategic Question: Should You Wrap TUIs at All?

You asked whether wrapping CLIs is the right approach. Based on my research, **the answer is: use a hybrid architecture — API-first, PTY-fallback.** Every major CLI now exposes a programmatic interface, and relying solely on PTY scraping is fragile.

Here's the state of programmatic interfaces:

| CLI | Headless Mode | API/Server | SDK | Structured Output |
|-----|--------------|------------|-----|-------------------|
| **OpenCode** | `opencode run` | `opencode serve` (HTTP) | `@opencode-ai/sdk` (JS/TS) | JSON via `--format json` |
| **Claude Code** | `claude -p` | Agent SDK | Python/TypeScript packages | `stream-json`, `json` |
| **Gemini CLI** | `gemini -p` | In progress | Community tools | JSON/JSONL streaming |
| **Codex CLI** | `codex exec` | GitHub-native | Limited | Text/structured |

### The Three-Layer Architecture I Recommend

```
┌─────────────────────────────────────────────┐
│  Layer 3: DeskFlow Workspace UI              │
│  (Session mgmt, context, skills, themes)     │
├─────────────────────────────────────────────┤
│  Layer 2: Agent Bridge (your wrapper)        │
│  ├── Native API/SDK (preferred)              │
│  ├── Headless CLI (scripting)                │
│  └── PTY Wrapper (TUI fallback)              │
├─────────────────────────────────────────────┤
│  Layer 1: CLI Processes                      │
│  (OpenCode, Claude, Gemini, Codex)           │
└─────────────────────────────────────────────┘
```

**Rule:** Always try Layer 2 (Native API/Headless) first. Only spawn a PTY when the user explicitly wants the TUI experience.

---

## 3. Per-CLI Integration Strategy

### OpenCode (Best for your use case)

OpenCode is the most wrapper-friendly. It has a built-in HTTP server and official SDK.

**Recommended approach:**
```typescript
// Start opencode serve in background
const server = spawn('opencode', ['serve', '--port', '0', '--hostname', '127.0.0.1'], {
  cwd: projectPath,
  env: { ...process.env, OPENCODE_SERVER_PASSWORD: 'deskflow' }
});

// Use the SDK
import { createOpencodeClient } from '@opencode-ai/sdk';

const client = createOpencodeClient({ 
  baseUrl: 'http://localhost:PORT',
  password: 'deskflow'
});

// Create session
const session = await client.session.create({ 
  body: { title: 'DeskFlow Session' } 
});

// Send prompts
const result = await client.session.prompt({
  path: { id: session.id },
  body: { parts: [{ type: 'text', text: 'Implement auth' }] }
});
```

**Why this is ideal for you:**
- You get full session management via API (list, export, import, stats)
- You can manage context, models, and agents without parsing TUI screens
- The `opencode run` command supports `--model`, `--agent`, `--file` flags
- You can attach to a persistent server to avoid cold-start delays

### Claude Code

Claude Code has a mature non-interactive mode and Agent SDK.

**Headless approach:**
```typescript
// For one-off tasks
const result = spawn('claude', [
  '--bare',           // Skip auto-discovery, consistent behavior
  '-p',               // Print mode (non-interactive)
  '--output-format', 'stream-json',
  '--allowedTools', 'Read,Edit,Bash',
  prompt
], { cwd: projectPath });

// Parse stream-json output for real-time updates
```

**Key flags for your wrapper:**
- `--bare`: Essential for consistent behavior across machines
- `--output-format stream-json`: Gives you structured events (`init`, `message`, `tool_use`, `tool_result`, `result`)
- `--allowedTools`: Pre-approve tools so it doesn't hang waiting for input
- `--permission-mode acceptEdits`: Auto-approve file edits

**For interactive sessions**, use the Agent SDK instead of PTY scraping.

### Gemini CLI

Gemini CLI supports headless mode with structured output, though it's still maturing.

**Headless approach:**
```typescript
const result = spawn('gemini', [
  '-p', prompt,
  '--output-format', 'json'
], { cwd: projectPath });

// Returns: { response: string, stats: object, error?: object }
```

**Caveat:** The Gemini CLI team has an open tracking issue (#8016) for robust non-interactive mode. It has limitations with tool execution and MCP servers in headless mode. For now, use it for simple generation tasks, not complex multi-step agentic workflows.

### Codex CLI

Codex is designed for autonomous execution.

**Headless approach:**
```typescript
const result = spawn('codex', [
  'exec',
  '--full-auto',
  prompt
], { cwd: projectPath });
```

**Limitation:** Codex CLI is primarily text-based and GitHub-focused. It doesn't have the rich session management of OpenCode or Claude Code.

---

## 4. When You MUST Use PTY (TUI Fallback)

Sometimes users want the actual TUI (e.g., to change models interactively, handle updates, or use TUI-specific features). For these cases, you need a robust PTY wrapper.

### The Problem with Your Current Approach

Your current agent state machine uses regex-based prompt detection (`readyRegex`) and bracketed paste. This is fragile because:
- TUIs use complex ANSI escape sequences
- Screen redraws are 27-28KB per frame
- Prompt detection can false-positive on shell output
- You can't "read" the TUI state — you can only guess from output streams

### Better PTY Interaction: Screen Buffer Parsing

Instead of regex on the raw output stream, parse the terminal's **screen buffer**. xterm.js maintains an internal buffer of what's currently visible on screen.

```typescript
// Access xterm.js buffer to "read" the TUI state
const buffer = terminalRef.current.buffer.active;
const lines: string[] = [];
for (let i = 0; i < buffer.length; i++) {
  lines.push(buffer.getLine(i)?.translateToString(true) || '');
}

// Now you can search for UI elements, not just raw output
const screenText = lines.join('\n');
if (screenText.includes('Select a model')) {
  // The TUI is showing a model picker
  // Send the appropriate keystrokes
}
```

### Tmux-Based Wrapper (Advanced)

For complex TUI interactions, consider using **tmux** as an intermediary. A community tool called `claude-code-tools` uses this approach — it's like Playwright for terminals.

```typescript
// Spawn CLI inside tmux
const tmux = spawn('tmux', ['new-session', '-d', '-s', 'deskflow-agent', 'claude']);

// Capture screen
const screen = execSync('tmux capture-pane -t deskflow-agent -p');

// Send keystrokes
execSync('tmux send-keys -t deskflow-agent "Enter"');
```

This gives you:
- Reliable screen capture (not streaming output)
- Keystroke injection that the TUI can't distinguish from real typing
- Session persistence even if your app crashes

---

## 5. Recommended Implementation Roadmap

### Phase 1: Fix the Immediate Bug (This Week)
1. Fix `measureSpawnSize` race condition using `MutationObserver` (code above)
2. Keep ResizeObserver alive with debouncing
3. Add post-spawn dimension verification
4. Test with `opencode`, `claude`, `gemini`, `codex` TUIs

### Phase 2: Add Headless Mode Support (Next)
1. Implement `AgentBridge` class with three backends:
   - `OpenCodeBridge` (uses `@opencode-ai/sdk`)
   - `ClaudeBridge` (uses `claude -p --output-format stream-json`)
   - `GeminiBridge` (uses `gemini -p --output-format json`)
   - `CodexBridge` (uses `codex exec --full-auto`)
2. Add session management layer (list, resume, export, stats)
3. Build context injection system (project rules, skills, themes)

### Phase 3: TUI-to-GUI Bridge (Later)
For the PTY fallback path:
1. Parse xterm.js screen buffer to detect TUI state
2. Overlay native GUI controls for common actions (model picker, settings)
3. Instead of sending keystrokes to the TUI, use the CLI's config/API to change settings directly
4. Use bracketed paste + expect-like patterns for unavoidable interactions

### Phase 4: Context & Skills Management
1. Generate `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` from your workspace config
2. Sync skills, MCP servers, and themes across all agents
3. Implement token usage tracking and cost optimization

---

## 6. Why This Solves Your "Lower Tier Models" Goal

Your goal is to improve the experience for free/cheaper models. Here's how this architecture helps:

| Feature | How Headless Mode Helps |
|---------|------------------------|
| **Context management** | You control what gets sent to the model, not the CLI's auto-context |
| **Session persistence** | You store conversation history in your SQLite DB, not the CLI's opaque format |
| **Model switching** | Change models via API/config without navigating TUI menus |
| **Skills/Themes** | Inject system prompts and rules programmatically |
| **Cost tracking** | Parse `--output-format json` to get per-model token usage |
| **Multi-agent** | Run OpenCode + Claude + Gemini in parallel, route tasks to cheapest capable model |

**Example:** You could have a "planner" agent running a cheap model (e.g., Grok free tier via OpenCode) that generates a plan, then a "coder" agent running Claude Sonnet that executes it. You manage the handoff in your workspace layer, not in any single CLI's TUI.

---

## Summary

**The "pushed down" bug** is caused by `measureSpawnSize` running before xterm.js finishes its internal char measurement. Fix it with `MutationObserver` and post-spawn re-measurement.

**The systematic approach** is a **hybrid architecture**: use each CLI's native headless/API mode as the primary path, and only spawn a PTY when the user explicitly wants the TUI. OpenCode's `serve` + SDK, Claude's `-p --output-format stream-json`, and Gemini's `-p --output-format json` all give you structured, programmatic access that bypasses the TUI entirely.

**For the TUI fallback**, improve your PTY wrapper by parsing xterm.js's screen buffer instead of regex-matching output streams, and consider tmux as an intermediary for complex interactions.

This gives you the session management, context control, and multi-agent orchestration you want — without fighting TUI rendering bugs.
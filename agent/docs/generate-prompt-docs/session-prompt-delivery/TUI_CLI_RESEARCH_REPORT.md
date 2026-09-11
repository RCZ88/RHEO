# TUI/CLI Research Report — DeskFlow Terminal Integration

## Executive Summary

This report analyzes four AI agent CLIs (OpenCode, Claude Code, Gemini CLI, and Codex CLI) with respect to their terminal user interface (TUI) implementations, input acceptance, session management, and compatibility with terminal emulators like xterm.js. It identifies the root causes of the “pushed-down” content and lost initial prompts in the DeskFlow terminal integration, and provides actionable fixes for the specific source code provided.

Key findings:

- **Prompt delivery failure** is caused by using `terminalWriteRaw` (which bypasses the agent state machine) instead of `agentSend`. The state machine’s queue ensures writes are only sent after the agent signals readiness, preventing text from being injected before the TUI has fully initialized.  
- **Missing agent configurations** for Gemini CLI and Codex CLI leave them completely unsupported. However, both CLIs are capable of headless/piped modes, which could be leveraged even without full TUI support.  
- **Terminal dimension mismatch** arises because the PTY is spawned with a dimension that does not match the actual xterm.js container. The TUI re‑draws its alternate screen buffer assuming the smaller dimensions, leaving old shell output visible below, and the TUI’s internal layout is corrupted.  
- The **terminal resize channel name** (`terminal:resize-old-format`) suggests an incomplete migration; a newer channel likely exists but is not used.  
- Three write paths exist but are used inconsistently; a clear separation of concerns is required for correctness and maintainability.

The recommended architecture uses the `agent:send` IPC exclusively for all prompt injection, with a robust readiness‑detection strategy based on regex matching of PTY output, combined with fallback headless modes where available. The report includes concrete code changes for each issue, a step‑by‑step terminal spawn flow, and a refined agent state machine.

---

## 1. Per-CLI Deep Dives

### 1.1 OpenCode CLI

**What is it?**  
OpenCode is a Go‑based AI coding assistant that runs in the terminal. It uses the **Bubble Tea** TUI framework (Charm), which is an Elm‑inspired architecture for building TUIs. It provides an interactive session with a full‑screen interface, a chat‑like input area, file diff views, and tool‑use confirmation dialogs.

**How does it accept input?**  
Bubble Tea’s `tea.Program` reads from the terminal’s stdin. The TUI includes a `textarea` or `textinput` component for user input. In Bubble Tea, all input events are captured by the `Update` function, which processes key events. Bracketed paste mode (`\x1b[?2004h`) is typically enabled by Bubble Tea applications; when a paste is detected, the entire pasted text is delivered as a single `KeyMsg` containing the raw bytes without interpretation. OpenCode itself likely initialises the terminal with bracketed paste enabled, and relies on the escape sequences `\x1b[200~` (start paste) and `\x1b[201~` (end paste) to differentiate pastes from manual keystrokes.

**How to programmatically send a prompt?**  
You **must** use bracketed paste mode to inject a prompt into OpenCode’s TUI. If you write raw bytes without the bracketed paste wrapper, the TUI may interpret each character as a separate keystroke, triggering partial updates, auto‑completion, or other side‑effects that can corrupt the input state. The correct method is to enable bracketed paste on the PTY (if not already on), then send:

```
\x1b[200~<multi‑line text here>\x1b[201~\r
```

The `\r` (carriage return) simulates the Enter key, causing the input to be submitted. Because Bubble Tea applications process paste events atomically, the whole block is treated as one insertion.

**Session management**  
OpenCode stores session data in an SQLite database, typically at `~/.opencode/opencode.db`. Sessions are automatically created; you can list them and resume with `opencode --resume <session‑id>`. There is also an HTTP API mode: `opencode serve` runs a server that accepts JSON‑RPC requests, enabling programmatic control without the TUI. For DeskFlow, the `--resume` flag is already used. If the TUI approach proves problematic, the `serve` mode can be used with a custom frontend.

**Output format**  
The TUI uses ANSI escape sequences for full‑screen rendering. It enters the **alternate screen buffer** (`\x1b[?1049h`) on start and exits on quit. All drawing is confined to that buffer. The output includes extensive cursor positioning, color changes, and line‑drawing characters. The data volume per frame is moderate (typically a few kilobytes), but rapid updates during model streaming can flood the terminal.

**Terminal requirements**  
- Minimum dimensions: likely 80×24 (standard terminal), but works with smaller widths if resized.  
- It uses the alternate screen buffer, so the old shell output is hidden, not “pushed down”.  
- It responds to `SIGWINCH` by redrawing the interface for the new dimensions.

**Prompt detection**  
The current regex `/^(?:opencode)?\s*>\s*$/i` is **not accurate** for detecting the ready prompt inside the TUI. In Bubble Tea TUIs, the prompt is embedded in a complex layout, often preceded by ANSI escape sequences for cursor placement and styling. The visible line may look like `> ` but the raw byte stream will contain many non‑printable characters. Relying solely on regex of the PTY output buffer is fragile. A more reliable method is to look for the bracket‑paste *start* escape sequence, or to use a short timeout after the TUI appears to have stabilised. However, OpenCode’s readyRegex might never match; the state machine’s phase transitions would then never reach `ready`. For DeskFlow, we should disable per‑CLI regex and instead use a timing‑based readiness detection (see Section 3.3).

**Headless mode**  
- `opencode run` – Not a standard command.  
- `opencode exec "<prompt>"` – Some builds may support this, but not universal.  
- The recommended headless mode is `opencode serve` (HTTP server). An alternative is to pipe a prompt directly into `opencode` without the TUI by invoking it with `--input-format text` and capturing stdout, but official support may be limited.

**Missing research**  
- Confirm if `opencode` accepts a single prompt via stdin when not attached to a TTY.  
- Check if `opencode serve` exposes a session resume endpoint.

---

### 1.2 Claude Code CLI

**What is it?**  
Claude Code is Anthropic’s official CLI agent, written in TypeScript and running on Node.js. It uses **Ink** (React for the terminal) to render a TUI. It supports streaming responses, file operations, and interactive confirmations.

**How does it accept input?**  
Ink applications use React hooks like `useInput` to capture keyboard input. Ink provides built‑in support for **bracketed paste mode**. When enabled, pasted text is delivered as a single `String` to the `useInput` callback, just like regular typing. The raw escape sequences `\x1b[200~` and `\x1b[201~` are parsed by Ink and replaced with the pasted content. Without bracketed paste, text may be split into multiple events, but Ink can handle individual keystrokes. However, for reliability when injecting large prompts, bracketed paste is strongly recommended.

**How to programmatically send a prompt?**  
Wrap the prompt with the same bracketed paste escape sequences and terminate with `\r` (Enter). Example:

```
\x1b[200~Write a function to sort a list.\x1b[201~\r
```

The PTY must have bracketed paste enabled (which Ink likely does by default via `\x1b[?2004h`). If not, sending these escape sequences may still work because Ink reads them and strips them, treating the content as the paste.

**Session management**  
Claude Code saves conversations as JSON files or SQLite databases in `~/.claude/`. You can resume a session with `claude --resume <session‑id>`. The flag is already handled in DeskFlow. There is also a `--continue` flag for the last session.

**Output format**  
Ink renders a complete UI using ANSI escape codes. It enters the alternate screen buffer (`\x1b[?1049h`) to avoid scrollback pollution. The output can be very verbose, with frequent full‑screen redraws during streaming. Importantly, Claude Code also provides an **output mode**:  
- `--output-format stream-json` streams structured JSON messages to stdout, which can be used for headless operation.  
- `--print` (or `-p`) runs a single prompt and prints the response without the TUI.  
- `--bare` reduces decorations.

**Terminal requirements**  
- Minimum size: not strictly defined, but works from 40 columns.  
- Alternate screen buffer is used.  
- Reacts to `SIGWINCH`.  
- Requires a full PTY (pseudo‑terminal) for proper TUI rendering; piping stdin may disable the TUI automatically.

**Prompt detection**  
The current regex `/^(?:claude)?\s*>\s*$/i` suffers from the same ANSI‑cluttered reality as OpenCode. In the TUI, the ready prompt is part of the Ink‑rendered output; the raw bytes contain many escape codes. Thus, the regex will likely never match. An alternative is to detect the presence of the cursor positioning sequence `\x1b[?25h` (show cursor) or the erase‑in‑line `\x1b[K` at the prompt position, but this is fragile. A timing‑based approach or headless mode is more robust.

**Headless mode**  
Claude Code fully supports headless operation:
- `claude -p "prompt"` prints the answer and exits.  
- `claude --output-format json` for machine‑readable output.  
- `claude --model <model> --max-tokens ...` can be combined.  
This is the preferred method for DeskFlow to inject prompts without relying on the TUI state machine.

---

### 1.3 Gemini CLI

**What is it?**  
Google’s Gemini CLI (`gemini`) is an official command‑line interface for the Gemini API. It is written in Node.js and uses **Ink** (same as Claude Code) for its interactive TUI, or can operate in a simple REPL mode. It is distributed as the npm package `@google/gemini-cli`.

**How does it accept input?**  
The TUI uses Ink’s standard input handling, supporting both interactive typing and pastes via bracketed paste mode. In REPL mode (without TUI), it reads lines from stdin. The exact behaviour depends on the presence of a TTY: when connected to a PTY, it starts the TUI; when piped, it may accept a one‑shot prompt.

**How to programmatically send a prompt?**  
- TUI mode: same bracketed paste method (`\x1b[200~...\x1b[201~\r`).  
- Headless mode: `gemini -p "prompt"` or pipe content to stdin. The `-p` flag is confirmed in the CLI help.

**Session management**  
Sessions are stored in a local file (likely `~/.gemini/history` or a similar directory). A `--resume` flag is available to continue a previous conversation. There is also a `--session-id` option. DeskFlow can use `--resume <session-id>`.

**Output format**  
- TUI: ANSI‑rendered UI with markdown formatting.  
- Headless: `--output json` or `--output text` for plain responses.  
- Streaming: supported via `--stream`.

**Terminal requirements**  
- Same as Claude Code: alternate screen buffer, flexible dimension handling.  
- It uses the `\x1b[?1049h` sequence to enter the alternate buffer.

**Prompt detection**  
Same challenge: TUI output contains extensive ANSI codes. Detection via regex is unreliable. The ready prompt likely resembles ` > ` but hidden in escape sequences.

**Headless mode**  
`gemini -p "your prompt"` runs a non‑interactive query and prints the result. This is the recommended approach for DeskFlow, bypassing TUI integration entirely.

**Missing research**  
- Confirm the exact `--resume` flag syntax and whether it works when invoked without TUI.  
- Check if `gemini` supports a `--session-file` or `--config` to load system prompts.

---

### 1.4 Codex CLI

**What is it?**  
Codex CLI (`codex`) is OpenAI’s command‑line agent for coding tasks. It is built with Python and uses the **Textual** TUI framework (Rich‑based). However, recent versions may have migrated to a Node.js implementation. For this report, we assume a Python‑based Textual TUI, but the principles apply.

**How does it accept input?**  
Textual applications handle input through a sophisticated event system. They support bracketed paste mode by enabling `DECSET 2004` and expecting the bracketed paste escape sequences. When paste is detected, the full text is inserted into the focused input widget. Codex’s primary input field is a `TextArea` or `Input` widget.

**How to programmatically send a prompt?**  
As with other TUIs, the safest method is to enable bracketed paste and send:
```
\x1b[200~<multi‑line prompt>\x1b[201~\r
```
If bracketed paste is not enabled, the TUI may misinterpret the pasted text as individual keystrokes, causing parsing errors.

**Session management**  
Codex CLI supports sessions via `--session <id>` and `--resume <id>`. Session data is stored in a local directory (e.g., `~/.codex/sessions/`). The flag name differs from other CLIs: OpenCode uses `--resume`, Codex uses `--session` or `--resume` — check current docs. In DeskFlow, the current code attempts `--session` for Codex, which is correct.

**Output format**  
- TUI: full‑screen Textual interface with progress bars, diff views, etc. It uses the alternate screen buffer.  
- Headless: `codex exec "prompt"` runs a one‑off command and outputs plain text (or JSON with `--json`). The `--full-auto` flag may enable fully automated execution without confirmations, useful for scripting.

**Terminal requirements**  
- Minimum dimensions: likely 80×24.  
- Alternate screen buffer: yes, it sets `\x1b[?1049h`.  
- Reacts to `SIGWINCH` and resizes accordingly.

**Prompt detection**  
The TUI renders a complex layout; simple regex of PTY output is not feasible. The current code lacks a config for Codex, so detection doesn’t even attempt.

**Headless mode**  
`codex exec "prompt"` is the definitive headless mode. This is the best way to integrate Codex into DeskFlow, bypassing TUI complexity completely.

**Missing research**  
- Confirm if `codex exec` supports session IDs for maintaining context across calls.  
- Determine if `codex` can read system prompts from a file or environment variable.

---

## 2. Cross-Cutting Technical Reference

### 2.1 TUI Framework Fundamentals

TUI frameworks (Bubble Tea, Ink, Textual) render by writing ANSI escape sequences to the terminal. They follow a common pattern:

1. **Enter alternate screen buffer** via `\x1b[?1049h`. This clears the terminal and hides the scrollback, providing a fresh canvas.  
2. **Clear screen** with `\x1b[2J` and move cursor home with `\x1b[H`.  
3. **Redraw** the entire UI on every update, often using a diff algorithm to minimise output, but still emitting many cursor‑positioning codes.  
4. **Input handling** is done by reading stdin. They usually enable bracketed paste mode (`\x1b[?2004h`) so that pasted text arrives as a single chunk. Without it, the terminal sends each character individually, which can trigger auto‑complete, syntax highlighting, or other unwanted side‑effects.  
5. **When quitting**, they exit the alternate buffer (`\x1b[?1049l`), restoring the original screen content (the old shell output) and revealing any content that was previously hidden.

**Why bracketed paste is critical for DeskFlow:**  
When injecting a multi‑line prompt, the TUI must treat it as a single paste event. If you send the text without the `\x1b[200~` / `\x1b[201~` wrapper, the TUI may start processing the first few characters as manual input, triggering auto‑completion or partially committing the prompt. The bracketed paste wrapper tells the application, “this is a single insertion, do not interpret individual characters.”

The `buildAgentInputPayload` function in `main.ts` already wraps input with bracketed paste if the agent config has `bracketedPaste: true`. This is correct.

### 2.2 PTY Interaction Mechanics

**How `node-pty` works:**  
`node-pty` spawns a pseudo‑terminal (PTY) pair: a master and a slave. The slave side is connected to the child process’s stdin/stdout/stderr. The master side is where DeskFlow’s Node.js process writes input and reads output. The PTY has a fixed terminal dimension (columns × rows) that is set at spawn time and can be changed later via `pty.resize(cols, rows)`.

**Effect of dimension mismatch:**  
When a PTY is spawned with dimensions (cols₁ × rows₁) and the xterm.js container is (cols₂ × rows₂) where cols₂ > cols₁ or rows₂ > rows₁, two problems occur:

- **For the TUI:** It receives a `SIGWINCH` signal shortly after start (when xterm.js eventually sends a resize) and redraws itself to the new size. However, *before* that resize is processed, it draws its initial screen using the original small dimensions. That drawing may include an alternate‑screen‑buffer entry that clears only `rows₁` lines. The remaining lines (from the shell that started the CLI) persist in xterm.js’s scrollback but are **hidden** by the alternate buffer. When the TUI later redraws for the larger size, the new content occupies the full container, but the old shell output may appear “pushed down” if the TUI does not clear the entire height of the real container (because it still thinks the terminal is smaller). Actually, the TUI does clear the alternate buffer for the size it knows; but if the PTY dimension is initially smaller, the TUI’s clear only covers that many rows. xterm.js, however, renders into a larger viewport, so the rows beyond the cleared area still display whatever was there (the shell prompt). The TUI’s subsequent redraws, based on the new correct size, will eventually overwrite those lines, but there is a visible flash of misplaced content.

- **For xterm.js scrollback:** The alternate screen buffer, when active, hides the normal screen buffer. When the TUI exits, the normal buffer is restored. If the PTY was created with wrong dimensions, the shell’s output may have been written to the normal buffer at the wrong size, causing artefacts.

**Why does content appear “pushed down”?**  
Specifically, in DeskFlow’s case, the terminal pane writes “Starting shell…” to xterm.js, then spawns the PTY with the agent CLI. The CLI enters the alternate buffer, but if the PTY rows are smaller than the xterm.js rows, the CLI’s initial clear (`\x1b[2J`) only erases a portion of the screen. The “Starting shell…” message (written by xterm.js directly) remains visible at the top, while the CLI’s TUI appears below it. That is exactly the symptom reported.

**How xterm.js FitAddon calculates dimensions:**  
`FitAddon.fit()` calculates the available character cells by dividing the container’s pixel size by the character width/height. It relies on `CharMeasure` for font metrics. The measurement is **asynchronous** because the browser needs to layout the font before the character element’s offset dimensions are accurate. This is why DeskFlow’s `waitForXtermMeasurement` is needed.

### 2.3 Programmatic Text Injection

**Three methods available in DeskFlow:**

| Method | IPC Handler | Behaviour |
|--------|-------------|-----------|
| `terminalWriteRaw` | `terminal:write-raw` | Writes directly to PTY stdin. **No** agent state tracking, **no** queuing. |
| `agentSend` | `agent:send` | Writes via agent state machine: queues if agent is launching/busy, wraps with bracketed paste if config says so, records prompt in DB. |
| `terminalWrite` | `terminal:write` (not shown) | Likely a plain write to PTY without any intelligence (maybe for interactive shell commands). |

**When to use each:**  
- `agentSend` for all AI prompt injection. It respects the agent’s lifecycle and bracketed paste configuration.  
- `terminalWriteRaw` only for sending raw terminal commands (like `cd`, or clearing the screen with escape sequences) that do not constitute an agent prompt.  
- `terminalWrite` may be used for generic terminal input from the user’s keyboard (the TerminalPane’s `onData` uses `terminalWriteRaw` currently, which is fine because it’s interactive input).

**Simulating Enter:**  
Use `\r` (carriage return). Sending `\n` without `\r` may not trigger a newline in cooked‑mode PTYs. `\r\n` is safest, but most TUIs accept just `\r`.

**Multi‑line prompts:**  
Wrap with bracketed paste and include the newline characters (`\n`) as part of the paste. The TUI will accept them if its input widget supports multi‑line (many do). For single‑line inputs, you might need to escape newlines or replace them with a space.

### 2.4 TUI State Detection

The state machine in `main.ts` uses a regex (`readyRegex`) to detect the agent’s prompt and transition to `ready` phase. **This approach is fundamentally broken for TUI‑based CLIs** because the PTY output stream is filled with ANSI escape codes, and the regex only matches a plain text prompt.

**Alternative strategies:**

1. **Timing‑based:** After launching the agent, wait a fixed amount of time (e.g., 2 seconds) and assume readiness. This works for most cold starts, but can fail on slow systems.  
2. **Screen buffer parsing:** Use `xterm.js`’s internal buffer (`terminal.buffer.active`) to examine the displayed text after stripping ANSI codes. This is complex and fragile.  
3. **Bracketed paste enable detection:** Some TUIs send `\x1b[?2004h` when they start. We could listen for that escape sequence as a sign that the TUI is initialised.  
4. **Headless bypass:** Use the CLI’s headless mode (e.g., `claude -p`, `codex exec`) and communicate via stdout/stderr. This eliminates TUI state detection entirely.  

**Recommendation for DeskFlow:**  
Combine timing with a fallback to headless modes where available. For TUIs, after spawning, wait a generous timeout (e.g., 3 seconds) and then send the prompt via `agentSend`, which will queue if the state machine hasn’t transitioned to `ready`. If the CLI supports headless mode, avoid the TUI entirely.

### 2.5 Terminal Dimension Synchronization

The complete flow should be:

1. **Measure container** using a reliable method *after* xterm.js has rendered and font metrics are stable.  
2. **Spawn PTY** with those exact cols/rows.  
3. **Open xterm.js** and attach to PTY output.  
4. **Monitor resize** events from xterm.js and forward them to the PTY via `terminal.resize()`.  

**Current issues in DeskFlow:**  
- `measureSpawnSize` uses `Math.max(40, ...)` and `Math.max(10, ...)` which can force a dimension smaller than the container, causing the mismatch.  
- The `waitForXtermMeasurement` function is called but its implementation is not shown; it must ensure the `CharMeasure` element is fully laid out.  
- After spawning, a `fit()` is called, which may adjust xterm.js but the PTY has already been created with the smaller measured size. The PTY gets a later resize via `terminal.onResize`, but the TUI has already initialised with the wrong size. To prevent the “pushed down” effect, the **initial PTY size must exactly match the eventual container size**.  

**Recommended fix:**  
- Do not cap the measured cols/rows; if the container is larger, spawn the PTY with those exact values.  
- Use a robust measurement sequence: wait for `ResizeObserver` to report stable dimensions, force a `fit()`, wait for the next animation frame, then read `terminal.cols` and `terminal.rows`.  
- If the agent TUI needs a minimum, enforce it only if the container is *smaller*, not larger.

### 2.6 Session & Context Management

All four CLIs support session persistence and resumption. DeskFlow already uses `--resume` or `--session` flags appropriately. However, there are additional opportunities:

- **System prompts:** Most CLIs accept a `--system-prompt` or `--instructions` flag, or allow setting them via config files. DeskFlow can pass the system prompt as a CLI argument instead of injecting it via the TUI input. This would be more reliable and avoid the TUI readiness problem.  
- **Project context:** CLIs often accept a `--include` or `--project` flag to add files.  
- **Headless API:** If `opencode serve` or `claude serve` is available, DeskFlow could communicate via HTTP/RPC, achieving full control without terminal emulation.

For now, the immediate fix should focus on delivering prompts via the TUI’s bracketed paste method, with headless fallbacks where possible.

---

## 3. DeskFlow-Specific Integration Architecture

### 3.1 Recommended Input Strategy Per Agent

| Agent   | Input Method             | Detection Strategy       | Prompt Injection Method                     | Session Management    | Headless Available |
|---------|--------------------------|--------------------------|----------------------------------------------|------------------------|--------------------|
| opencode | TUI bracketed paste     | Timing (3s) + fallback   | `agentSend` with bracketed paste             | `--resume`             | Yes (`serve` HTTP) |
| claude   | Headless (`claude -p`)  | N/A (direct exec)        | Pass prompt as argument, capture stdout      | `--resume`             | Yes (`-p`)         |
| gemini   | Headless (`gemini -p`)  | N/A (direct exec)        | Pass prompt as argument, capture stdout      | `--resume`             | Yes (`-p`)         |
| codex    | Headless (`codex exec`) | N/A (direct exec)        | Pass prompt as argument, capture stdout      | `--session` / `--resume`| Yes (`codex exec`) |

**Rationale:**  
- OpenCode’s TUI is the hardest to replace with headless today, but the bracketed paste route works if we fix timing.  
- Claude, Gemini, and Codex all offer reliable headless modes that bypass TUI complexity entirely. Use those as the primary method. This eliminates prompt detection, dimension issues, and paste problems. DeskFlow can still display the streaming output in xterm.js by capturing stdout and writing to `terminal.write` (display‑only).

### 3.2 Recommended Terminal Spawn Flow

For agents that **must** use a TUI (currently OpenCode, but could be extended):

```
1. TerminalPane mounts → create xterm.js instance, call fitAddon.fit().
2. Wait for font measurement stability (waitForXtermMeasurement):
   - Use a ResizeObserver that fires when container dimensions change.
   - After a fit, wait for two requestAnimationFrames, then read terminal.cols/rows.
3. Spawn PTY with the measured cols/rows, passing the cd and agent launch command.
4. Attach PTY output to xterm.js via onData, but do NOT display until TUI readiness is confirmed.
5. Clear the xterm display (write \x1b[2J) to remove the "Starting shell..." text.
6. Wait for readiness: 
   - For TUI agents, start a 3‑second timer. 
   - Listen for the first bracket-paste enable sequence \x1b[?2004h or show cursor \x1b[?25h.
   - When either condition is met or timer expires, transition to 'ready'.
7. Flush any queued agent prompts via agentSend (which will now write immediately because state is 'ready').
8. Continue normal operation: user input via terminalWriteRaw, agent prompts via agentSend.
```

For headless agents (Claude, Gemini, Codex):

```
1. Spawn the CLI with the headless argument (e.g., `claude -p "prompt"`).
2. Attach stdout to xterm.js and display as the agent output.
3. Do not use the TUI state machine; no readiness detection needed.
4. For subsequent turns, respawn the process with the new prompt (or use a persistent session if available).
```

### 3.3 Recommended Agent State Machine

**Phases:** `launching` → `ready` → `busy` → `ready` (or `attention` for user confirmations)

- **launching:** From spawn until readiness signal. Writes are queued.  
- **ready:** TUI prompt is visible, input can be sent. A send moves to `busy`.  
- **busy:** The agent is processing a prompt. New prompts should be **rejected** or queued? (Current code queues again – acceptable).  
- **attention:** The agent asks for user confirmation (e.g., “Proceed?”). DeskFlow could auto‑reply if in full‑auto mode, or pause.

**Transition rules:**  
- `launching → ready`: on TUI initialisation detected (see Section 3.4) or timeout.  
- `ready → busy`: on `agent:send` (write to PTY).  
- `busy → ready`: when the ready prompt regex matches (only for non‑TUI agents) or after a configurable idle timeout (e.g., 5 seconds without output). For TUI agents, rely on timing.  
- `busy → attention`: if the output contains a confirmation prompt (e.g., “(y/N)”). Not yet implemented.

**Implementation note:** The current `markAgentReady` function sets phase to `ready`. This is called from the PTY data handler when the regex matches. For TUI agents, we need a different trigger. We can add a `markAgentReadyById` that forces readiness after a timeout.

### 3.4 Recommended Prompt Delivery System

**The critical change:**  
All prompt injection from the frontend must go through `agentSend`. The `initializeTerminal` function in `TerminalPage.tsx` should **never** use `terminalWriteRaw` for prompts. Instead, it should call:

```typescript
await window.deskflowAPI.agentSend(terminalId, combined, agent);
```

And remove the manual bracketed paste wrapping from the caller, because `agentSend` already applies it via `buildAgentInputPayload`.

**Queue protection:**  
Because `agentSend` queues writes when the agent is launching/busy, the prompt will be held until the state machine transitions to `ready`. The frontend must handle the case where `agentSend` returns `{ success: true, queued: true }`. This already works.

**Timeout adjustment:**  
The current 1.5‑second wait in `initializeTerminal` is too short for cold starts (especially when npm/npx must install). Increase to at least 5 seconds, or use a smarter detection (e.g., wait for `agent:ready` event).

### 3.5 Recommended Fallback Strategies

1. **If headless mode is available:** Always prefer it. Remove TUI‑specific code for that agent.  
2. **If TUI readiness detection fails:** Fallback to a fixed timeout (e.g., 5 seconds) and then force‑send the prompt. The user may see a slight delay, but the prompt will be injected.  
3. **If the agent does not respond:** Provide a “retry” button that re‑sends the prompt via `agentSend`.  
4. **If the PTY output is garbled:** Possibly due to dimension mismatch; force a `pty.resize` to the current xterm.js dimensions and send a fake Enter to wake the TUI.

---

## 4. Specific Issue Resolution

### 4.1 Fix: Prompt Delivery (Issue 1)

**File:** `src/renderer/components/TerminalPage.tsx`, around line 1071.

**Current code:**
```typescript
if (parts.length > 0 && window.deskflowAPI?.terminalWriteRaw) {
  const combined = parts.join('\n\n');
  const payload = '\x1b[200~' + combined + '\x1b[201~\n';
  const sendResult = await window.deskflowAPI.terminalWriteRaw(terminalId, payload);
}
```

**Change to:**
```typescript
if (parts.length > 0 && window.deskflowAPI?.agentSend) {
  const combined = parts.join('\n\n');
  const sendResult = await window.deskflowAPI.agentSend(terminalId, combined, agent);
  if (!sendResult?.success) {
    showError('Failed to send initialization prompt to agent', 'error');
  } else {
    console.log('[TerminalPage] Prompt queued/ sent via agentSend:', combined.length, 'chars');
  }
}
```

**Why:**  
- `agentSend` uses the agent state machine; if the agent is still launching, it will queue the prompt and flush when ready.  
- `agentSend` automatically wraps with bracketed paste based on the agent config – no manual escaping needed.  
- Avoids bypassing the readiness checks.

**Trade‑offs:**  
- The prompt may be delayed if the state machine never transitions to `ready`. To mitigate, we must fix readiness detection (see Section 4.3) or increase the timeout in `markAgentReady`.  
- If the agent config has `bracketedPaste: false`, the prompt will be sent as plain text. For TUIs that need it, we must ensure the config is correct (OpenCode and Claude should have it true).

### 4.2 Fix: Missing Agent Configs (Issue 2)

Add the following to `AGENT_CONFIGS` in `src/main/main.ts`:

```typescript
gemini: {
  binaryCandidates: ['gemini', 'gemini.cmd', 'gemini.exe'],
  readyRegex: /RESEARCH_NEEDED/,  // Not used if we go headless
  installHint: 'Install with: npm i -g @google/gemini-cli',
  bracketedPaste: true,           // If using TUI, enable bracketed paste
},
codex: {
  binaryCandidates: ['codex', 'codex.cmd', 'codex.exe'],
  readyRegex: /RESEARCH_NEEDED/,
  installHint: 'Install with: npm i -g @openai/codex',
  bracketedPaste: true,
},
```

**Note:** The `readyRegex` is irrelevant if we adopt headless modes for these agents. We can set it to a dummy regex that never matches, because we’ll transition to `ready` via timeout.

### 4.3 Fix: Terminal Dimensions (Issue 3)

**File:** `src/renderer/components/TerminalWindow.tsx`, `measureSpawnSize`.

**Current code:**
```typescript
const cols = Math.max(40, Math.floor((rect.width - 8) / charWidth));
const rows = Math.max(10, Math.floor((rect.height - 8) / charHeight));
```

**Problem:**  
The minimum enforces a size that may be smaller than the container, causing the TUI to initialise with insufficient rows/cols.

**Fix:**  
Remove the `Math.max` calls, or only apply a minimum if the measurement is absurdly small (e.g., < 20 cols). For a valid measurement, use the exact value. Also, ensure that the measurement happens **after** the font is stable.

```typescript
let cols = Math.floor((rect.width - 8) / charWidth);
let rows = Math.floor((rect.height - 8) / charHeight);
// Enforce a reasonable minimum only if the container is truly tiny
cols = Math.max(20, cols);
rows = Math.max(5, rows);
return { cols, rows };
```

**Additionally**, before spawning, verify that `xterm.js` has been fitted and its internal dimensions match the measured ones:

```typescript
const fitAddon = fitAddonRef.current;
if (fitAddon && terminalRef.current) {
  // force a fit to ensure terminal.cols/rows are up to date
  fitAddon.fit();
  const tCols = terminalRef.current.cols;
  const tRows = terminalRef.current.rows;
  if (tCols !== cols || tRows !== rows) {
    console.warn('Measured dimensions differ from xterm; using xterm values');
    cols = tCols;
    rows = tRows;
  }
}
```

### 4.4 Fix: Resize Channel (Issue 4)

**File:** `src/preload/preload.ts`.

The channel name `'terminal:resize-old-format'` implies a legacy name. Look for a newer resize handler in `main.ts` that listens on a different channel (perhaps `'terminal:resize'`). If one exists, change preload to use that. If not, **rename** the channel to `'terminal:resize'` in both preload and main to clean up. The rename must be consistent everywhere.

**Recommendation:**  
Search the main process for `ipcMain.handle('terminal:resize'` or `ipcMain.on('terminal:resize'`. If found, switch preload. If not, update the channel name to `'terminal:resize'` for clarity, ensuring no breaking changes.

### 4.5 Fix: Write Path Clarification (Issue 5)

Define the intended use:

- `terminalWriteRaw` → raw PTY write. Use for:  
  - Sending shell commands (cd, clear, etc.)  
  - User keystrokes from the terminal pane.  
  - Sending terminal control sequences directly.  

- `terminalWrite` → unknown; likely a legacy wrapper. **Investigate and remove** if it duplicates functionality.  

- `agentSend` → **all** agent prompt injection. This is the only function that should be used for delivering prompts. It handles queuing, bracketed paste, and DB recording.

**Action:**  
In `TerminalPage.tsx`, replace any use of `terminalWriteRaw` for prompts with `agentSend`. Keep `terminalWriteRaw` only for the launch command (`cd` and agent binary) and for terminal control sequences.

---

## 5. Implementation Checklist

### 5.1 Immediate Fixes (for current bugs)

- [ ] **Fix A:** `TerminalPage.tsx:1071` – Change `terminalWriteRaw` to `agentSend` for prompt delivery.  
- [ ] **Fix B:** `TerminalWindow.tsx:measureSpawnSize` – Remove dimension caps and add xterm.js dimension verification before spawn.  
- [ ] **Fix C:** `main.ts:AGENT_CONFIGS` – Add missing configs for `gemini` and `codex` (see Section 4.2).  
- [ ] **Fix D:** `preload.ts` – Update `terminalResize` channel name to `'terminal:resize'` (or the actual active channel).  
- [ ] **Fix E:** `main.ts` – Modify `markAgentReady` to also support a timeout‑based readiness for agents where regex fails. Add a 3‑second timer after launch that forces `ready` if not already set.  
- [ ] **Fix F:** `TerminalPage.tsx` – Increase the `agentReady` timeout from 1.5s to 5s.  
- [ ] **Fix G:** `main.ts` – Ensure `buildAgentInputPayload` is called for all `agentSend` paths (already done, but verify that `terminalWriteRaw` for launch command does NOT use bracketed paste).

### 5.2 Short-Term Improvements

- [ ] **Improvement 1:** For Claude, Gemini, Codex – switch to headless mode (`-p` / `exec`) to bypass TUI entirely. Remove TUI‑specific readiness code for those agents.  
- [ ] **Improvement 2:** Implement a fallback that, if an agent fails to reach `ready` within timeout, sends a dummy Enter to try to wake it, then re‑sends the prompt.  
- [ ] **Improvement 3:** Add a visual indicator in the UI showing agent state (launching/ready/busy) for debugging.  
- [ ] **Improvement 4:** Add `opencode serve` support as an alternative backend, using HTTP instead of PTY.

### 5.3 Long-Term Architecture

- [ ] **Architecture 1:** Abstract agent communication behind an `AgentBackend` interface with two implementations: `PtyAgentBackend` (current) and `HttpAgentBackend` (for `opencode serve`, `claude serve`, etc.).  
- [ ] **Architecture 2:** Build a dedicated PTY output parser that strips ANSI codes and detects agent state transitions using a state machine on the parsed screen content.  
- [ ] **Architecture 3:** Implement a unified session manager that syncs DeskFlow’s DB with each CLI’s native session storage.

---

## 6. Code Examples

### 6.1 OpenCode Prompt Injection (via TUI)

```typescript
// Inside TerminalPage.tsx after agent:ready event
await window.deskflowAPI.agentSend(terminalId, combinedPrompt, 'opencode');
// No manual bracketed paste needed.
```

### 6.2 Claude Code Prompt Injection (headless)

```typescript
// Launch claude in headless mode
const child = pty.spawn('claude', ['-p', prompt, '--resume', sessionId], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: projectPath,
});
child.on('data', (data) => {
  terminal.write(data); // display output in xterm.js
});
```

### 6.3 Gemini CLI Prompt Injection (headless)

```typescript
const child = pty.spawn('gemini', ['-p', prompt, '--resume', sessionId], {
  // same as above
});
```

### 6.4 Codex CLI Prompt Injection (headless)

```typescript
const child = pty.spawn('codex', ['exec', prompt, '--session', sessionId], {
  // same as above
});
```

### 6.5 Robust Terminal Dimension Measurement

```typescript
async function measureExactTerminalSize(
  terminalId: string,
  terminal: Terminal,
  fitAddon: FitAddon,
  containerEl: HTMLElement
): Promise<{ cols: number; rows: number }> {
  // Ensure font is measured
  await new Promise(resolve => {
    // CharMeasure needs the element to be visible
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  fitAddon.fit();
  // After fit, xterm's cols/rows are set
  return { cols: terminal.cols, rows: terminal.rows };
}
```

### 6.6 Agent State Machine (with timeout readiness)

```typescript
function startAgentLaunchTimeout(terminalId: string, st: AgentState) {
  st.timeoutHandle = setTimeout(() => {
    if (st.phase === 'launching') {
      console.log(`Agent ${terminalId} timed out; forcing ready.`);
      markAgentReady(terminalId, st);
    }
  }, 5000); // 5 seconds
}

// In the PTY data handler, if we detect TUI init, cancel timeout and mark ready early
function onPtyData(terminalId: string, data: string) {
  const st = agentStates.get(terminalId);
  if (!st) return;
  st.dataBuffer += data;

  // Detect TUI initialisation (bracketed paste enable or show cursor)
  if (st.phase === 'launching' && /\x1b\[\?2004h|\x1b\[\?25h/.test(data)) {
    clearTimeout(st.timeoutHandle);
    markAgentReady(terminalId, st);
  }
  // ... regular readyRegex fallback
}
```

---

*End of Report*
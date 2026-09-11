# AGENT PROMPT — DeskFlow Terminal Infrastructure Fix

## Read first
`CONTEXT_BUNDLE.md` (already in this repo/conversation) has the full height-chain trace and the confirmed root cause for Bug 1. This prompt supersedes it — it includes that fix plus four additional infrastructure fixes needed because this terminal will host full-screen raw-mode TUI coding agents (Claude Code, Codex CLI, Gemini CLI, OpenCode), not just a shell.

## Why this is more than a CSS bug
These four agent CLIs are built on different rendering stacks (Claude Code: custom Ink/React fork with a Yoga layout engine and its own ANSI/CSI/DEC/OSC parser; Gemini CLI: stock Ink/React; Codex CLI: Ratatui/crossterm, immediate-mode full-frame redraw; OpenCode: BubbleTea/Elm architecture in Go) — but from the terminal host's side they are identical: raw-mode processes that call `TIOCGWINSZ` once at startup, switch to the alternate screen buffer, and do fixed-grid cursor-addressed redraws from then on. If the PTY is spawned with wrong dimensions, or resized incorrectly afterward, these tools do not gracefully self-correct the way a shell does — they own the whole screen and only redraw on their own event loop's terms. So the fix has to guarantee correct sizing *at spawn time* and a correct resize *protocol* afterward, not just a correct CSS chain.

## MANDATORY FIXES — apply in this order

### Fix 1 — Pane area flex container (confirmed, from CONTEXT_BUNDLE.md)
File: `src/pages/TerminalPage.tsx`, line ~3138.

Change:
```jsx
<div className="flex-1 relative overflow-hidden">
```
To:
```jsx
<div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
```
This makes the pane area an actual flex container so the child `data-tutorial` div's `flex-1 min-h-0` resolves correctly instead of being ignored.

### Fix 2 — Compute real container dimensions BEFORE calling `pty.spawn()`, not after mount
Currently the likely flow is: mount terminal component → spawn PTY at a default size (or whatever FitAddon reports on first tick) → fit/resize afterward. That's fine for `bash`, but a TUI that snapshots its terminal size on the very first frame (all four target agents do this) will have already committed to a wrong layout by the time a corrective resize arrives.

Required flow:
1. Container mounts, `ResizeObserver` or layout effect fires once the pane area (post-Fix-1) has a real resolved height (not 0, not content-sized).
2. `FitAddon.proposeDimensions()` (or equivalent) is called synchronously to get real `{cols, rows}` from actual pixel size.
3. Only then does the renderer request PTY spawn via IPC, passing the real `cols`/`rows` — not a hardcoded `80x24` default.
4. Main process calls `pty.spawn(shell, args, { cols, rows, ... })` with those values.

Find the spawn call (search the main process for `pty.spawn` / `node-pty`) and trace backward to confirm cols/rows aren't hardcoded or coming from a stale default before the real fit calculation runs. Also check `TERMINAL_AGENT_FIX.md` if it exists in this repo — it documents a prior five-bug PTY pipeline diagnosis and may already touch this exact spawn-ordering issue.

### Fix 3 — Strict three-step resize handshake, always in this order
On every resize (pane split, window resize, sidebar toggle, etc.):
1. FitAddon computes new `{cols, rows}` from the container's current pixel size.
2. `terminal.resize(cols, rows)` — local xterm.js instance.
3. IPC call → main process → `ptyProcess.resize(cols, rows)` — this is what actually updates the kernel's winsize and fires `SIGWINCH` to the child.

All three steps must fire together, every time. Debounce the *trigger* (ResizeObserver fires on every pixel during a drag — don't call resize on every one of those), but do not debounce or skip the final settled call, and do not skip step 3 under any circumstance — if the renderer-side xterm.js is resized but the IPC resize to the PTY doesn't fire, the child process's internal notion of terminal size silently diverges from what's displayed, and Ratatui/BubbleTea/Ink will lay out for the wrong grid.

Pseudocode:
```ts
const debouncedResize = debounce(() => {
  const { cols, rows } = fitAddon.proposeDimensions();
  if (!cols || !rows) return;
  terminal.resize(cols, rows);
  window.deskflowAPI.terminalResize(terminalId, cols, rows); // must reach ptyProcess.resize()
}, 100);

resizeObserver.observe(containerEl); // triggers debouncedResize on entry change
```

### Fix 4 — Simplify the input-ready gate
Current logic (`TerminalWindow.tsx` lines ~222-231, ~280-313) buffers input until one of: `onTerminalReady` IPC event, first `onTerminalData`, or a 2.5s timeout. That's a reasonable stopgap for a bug whose real cause was wrong initial sizing (Fix 2) — once spawn-time sizing is correct, the shell/TUI should start cleanly and emit output almost immediately, so:
- Keep the "unlock on first `onTerminalData`" path as primary.
- Keep `onTerminalReady` as secondary.
- Keep the timeout only as a last-resort safety net (it's fine to leave the 2.5s fallback in place, but it should not be the path that's actually triggering in normal operation once Fix 2 lands — if it still is, that's a signal Fix 2 isn't fully fixed).
- Do not add any new buffering logic. Do not change the xterm-helper-textarea CSS (standard xterm.js pattern).

### Fix 5 — Output flow control for high-volume agent streaming
These agent CLIs stream tokens rapidly while generating — much higher and burstier output volume than a typical shell command. Unbounded per-chunk IPC from the PTY `data` event to the renderer can flood the render thread (this is a documented failure mode in VS Code's own terminal — they had to add flow control and event batching for exactly this reason). Add basic batching:
- In the main process, coalesce PTY `data` events arriving within the same tick/macrotask into a single IPC message instead of forwarding each chunk separately.
- In the renderer, write coalesced chunks to `terminal.write()` on animation-frame boundaries rather than synchronously on every IPC message.
- Do not add artificial delay — this is about batching same-tick bursts, not throttling.

## Constraints (unchanged)
- Tailwind v4 only.
- No git commands.
- Renderer communicates with main process only via IPC through `window.deskflowAPI` — no direct node-pty access from renderer.
- `better-sqlite3` stays main-process only.
- Do not touch the `xterm-helper-textarea` CSS block.
- Do not parse, pattern-match, or special-case output based on which agent CLI is running (Claude Code vs Codex vs Gemini vs OpenCode). Treat every child process as an opaque PTY client — app-specific interception will break on the next upstream release of any of these tools.
- Only touch: `src/pages/TerminalPage.tsx`, `src/components/TerminalWindow.tsx`, `src/components/PageShell.tsx` if needed for Fix 1, plus whatever main-process file(s) own `pty.spawn()` / `ptyProcess.resize()` for Fixes 2–3, and the preload bridge for Fix 5's batching if it lives there. Locate the main-process files yourself by searching for `node-pty` / `pty.spawn` usage — don't assume a specific filename.

## Verification / test matrix
Build must succeed: `npx vite build`.

Then, inside the terminal pane, actually launch each of the following and confirm:
- `claude` (Claude Code)
- `codex`
- `gemini`
- `opencode`

For each: pane fills full available height at spawn (not just after a manual resize), resizing the window/pane produces a correct redraw with no garbled or truncated frame, typing is instant with zero dropped or buffered characters, entering/exiting the tool's alternate screen leaves no leftover artifacts in the shell underneath, and generating a long streaming response doesn't lag or freeze the terminal UI.

## Deliverable
Patches to the identified files, a short changelog of what changed and why per fix number above, and confirmation that all five fixes were applied (not just Fix 1) plus the build passing.
# PROMPT: Probe MCP Multi-Instance Support for RHEO

## Raw Request
"can WE MAKE SURE THAT WE CAN RUN MULTIPLE AT THE SAME TIME FOR THE RHEO INSTANCE SO THAT OTEHR AI CAN ALSO WORK WITH THE RHEO MCP PROEPRLY?"

## Problem Statement
RHEO uses `app.requestSingleInstanceLock()` which prevents multiple instances.
Only one RHEO can run at a time, so only one AI agent can use Probe MCP at a time.
Other agents are blocked. The app also has no way to distinguish between instances
when multiple are running.

## Context Bundle
Read `CONTEXT_BUNDLE.md` in this folder first. It contains the relevant code
from both RHEO (src/main.ts) and Probe MCP (/home/clementzhao/dev/probe/).

## Engineering Task

### Part 1: RHEO — Make single-instance lock conditional (DONE)
Already implemented: `RHEO_ALLOW_MULTIPLE=1` env var bypasses the lock.
Each instance MUST use a distinct `--user-data-dir`.

### Part 2: Probe MCP — Multi-instance discovery and management

1. **discover() enhancement**: List ALL running RHEO instances with their debug ports,
   user-data-dir, and PID. Distinguish between:
   - User's real instance (userData = ~/.config/RHEO)
   - Test instances (userData = probe-profile-* or RHEO-TEST-*)
   
2. **open() enhancement**: Accept a `port` or `instanceId` parameter to select
   which instance to attach to. Default to the first discovered instance.

3. **launch() enhancement**: When launching a new RHEO instance:
   - Pass `RHEO_ALLOW_MULTIPLE=1` in the environment
   - Use a unique userData dir (already does via mkdtempSync)
   - Use a free debug port (already does via getFreePort)
   - Do NOT kill existing instances (remove killExistingElectron or make it opt-in)

4. **killExistingElectron() fix**: Should only kill instances spawned by Probe,
   not the user's running instance. Track spawned PIDs.

5. **Session isolation**: Each Probe session should track which instance it's
   attached to. Tools should operate on the attached instance only.

6. **Concurrent access**: Multiple AI agents (multiple Probe MCP servers) should
   be able to attach to different instances simultaneously without conflicts.

### Part 3: Documentation
- Update Probe MCP README/docs with multi-instance usage
- Add examples for running multiple instances

## Constraints
- RHEO's DB must not be corrupted by concurrent access
- Each instance must have its own userData dir
- The real profile (~/.config/RHEO) should only be used by ONE instance
- Probe MCP must not kill the user's instance when launching test instances

## Files to modify
- /home/clementzhao/dev/probe/src/cdp/launcher.ts — launch, killExistingElectron
- /home/clementzhao/dev/probe/src/cdp/client.ts — listTargets, discover
- /home/clementzhao/dev/probe/src/mcp/server.ts — tool registration
- /home/clementzhao/dev/probe/src/probe/agent.ts — session tracking
- /home/clementzhao/dev/rheo/src/main.ts — single-instance lock (DONE)

## Expected Outcome
- User runs RHEO normally (single instance, real data)
- AI agent 1 runs `RHEO_ALLOW_MULTIPLE=1 ... --remote-debugging-port=9222` with test profile
- AI agent 2 runs `RHEO_ALLOW_MULTIPLE=1 ... --remote-debugging-port=9223` with test profile
- Each agent attaches to its own instance via Probe
- No conflicts, no DB corruption, no killed processes

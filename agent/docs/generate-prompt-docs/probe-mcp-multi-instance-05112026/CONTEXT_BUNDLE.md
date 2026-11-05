# CONTEXT BUNDLE: Probe MCP Multi-Instance Support

## Problem
RHEO uses `app.requestSingleInstanceLock()` which prevents multiple instances from running.
Only one RHEO can run at a time, so only one AI agent can use Probe MCP at a time.
Other agents are blocked.

## Goal
1. Allow multiple RHEO instances to run simultaneously (each with own debug port + userData dir)
2. Update Probe MCP to discover, list, and attach to any instance
3. Allow concurrent AI agents to each have their own RHEO + Probe session

## RHEO Side (src/main.ts)

### Single-instance lock (line ~24860)
```typescript
const gotTheLock = allowMultiple ? true : electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
} else {
```
Already made conditional via `RHEO_ALLOW_MULTIPLE=1` env var.

### Key constraint: each instance MUST use a distinct --user-data-dir
RHEO stores its SQLite DB in userData. Two instances sharing the same userData
will corrupt the database (better-sqlite3 is single-writer).

### RHEO launch command for testing:
```bash
RHEO_ALLOW_MULTIPLE=1 node_modules/.bin/electron --ozone-platform=x11 \
  --user-data-dir=/home/clementzhao/.config/RHEO-TEST-1 \
  --remote-debugging-port=9222 .
```

## Probe MCP Side (/home/clementzhao/dev/probe/)

### Discovery (src/cdp/client.ts → listTargets)
```typescript
export async function listTargets(host: string, port: number): Promise<any[]>
```
Probe's discover() finds instances by scanning ports. Currently finds all
instances on the machine but doesn't differentiate between them.

### Launcher (src/cdp/launcher.ts)
- `launch()` spawns a new instance with a free port
- `getFreePort()` reserves a port
- `killExistingElectron()` kills ALL electron processes (dangerous with multiple)
- Electron single-instance lock causes 2nd launch to quit immediately

### Session management (src/cdp/session.ts)
Need to check how sessions are tracked.

### MCP Server (src/mcp/server.ts)
Need to check how tools are registered and whether they support multiple sessions.

### Key files to examine:
- src/cdp/client.ts — listTargets, CdpClient
- src/cdp/launcher.ts — launch, killExistingElectron, getFreePort
- src/cdp/session.ts — session management
- src/mcp/server.ts — MCP tool registration
- src/probe/agent.ts — agent/session tracking
- src/index.ts — entry point

## Current Problem
When RHEO is already running (for the user), and an AI agent tries to
launch a 2nd instance via Probe, the single-instance lock kills it.
The agent then can't test anything.

## Desired Behavior
1. RHEO can run multiple instances when RHEO_ALLOW_MULTIPLE=1
2. Each instance uses a distinct userData dir + debug port
3. Probe MCP discover() lists ALL running instances with their ports
4. Probe MCP open(attach:true, port:N) attaches to a specific instance
5. Multiple AI agents can each have their own instance + Probe session
6. killExistingElectron() should only kill instances spawned by Probe, not user's

## Security/Database Concern
- Each instance MUST have its own userData dir
- Sharing userData between instances = DB corruption
- The real profile (~/.config/RHEO) should only be used by ONE instance at a time
- Test instances should use throwaway profiles (probe-profile-*) or copies

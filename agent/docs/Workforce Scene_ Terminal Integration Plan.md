# Connecting the Workforce Scene to the Terminal Infrastructure

For the build agent. Names like `parseAgentOutput`, `onTerminalData`, `conductorCloseNode`, `useVisualAgents` come from the earlier RHEO prompt and feature list. I have not seen the real source. Check each name exists before you use it.

## 1. The one rule

The scene is a pure function of a stream of events. It never reads the filesystem or the database. The prototype already works this way: the simulator calls `window.workforce.ingest(ev)`, and the scene reacts. In the real app, the simulator is replaced by a real adapter. Same entry point, same shape.

```
PTY data (onTerminalData)
  -> main: line buffer per session (strip ANSI, rejoin split chunks)
  -> main: agent adapter (claude | opencode | codex | gemini | aider)
  -> classifyAction()  -> ActionEvent[]
  -> webContents.send('workforce:event', events)   (batched every 100 ms)
  -> preload: deskflowAPI.onWorkforceEvent(cb)
  -> renderer: workforceStore (pure reducer) -> useVisualAgents -> WorkforceScene
  -> click -> selection state -> Inspector
```

## 2. The contract (`workforceActivity.ts`)

```ts
export type ActionKind =
  | 'edit'|'read'|'search'|'look'|'think'|'plan'|'build'|'test'|'lint'|'serve'
  | 'web'|'remote'|'mcp'|'install'|'container'|'database'|'commit'|'branch'
  | 'move'|'delete'|'delegate'|'run'|'command'|'blocked'|'archived'|'unknown';

export interface ActionEvent {
  sessionId: string;
  ts: number;
  kind: ActionKind;
  tool?: string;            // raw tool name
  command?: string;         // raw shell command
  target?: string;          // path, pattern, url, or mcp server
  result?: 'ok' | 'fail' | 'running';
  exitCode?: number;
  counts?: { added?: number; removed?: number; passed?: number; failed?: number };
  tokens?: number;          // only if the agent prints it. Never guess.
}
```

## 3. Main process

Hook after the existing `parseAgentOutput` call. Do not add a second parser.

```ts
// one line buffer per session
const buf = new Map<string, string>();

function onChunk(sessionId: string, agent: AgentName, raw: string) {
  const text = (buf.get(sessionId) ?? '') + stripAnsi(raw);
  const lines = text.split('\n');
  buf.set(sessionId, lines.pop() ?? '');          // keep the unfinished line
  const events = lines.flatMap(l => adapters[agent]?.(l, sessionId) ?? []);
  if (events.length) queueSend(events);           // batch, flush every 100 ms
}
```

- `adapters[agent](line, sessionId)` returns `ActionEvent[]`. One file per agent. Each one only turns that agent's output format into `{ tool, input }`, then calls the shared `classifyAction()`.
- Batch the send. A busy agent can print hundreds of lines per second. Never send one IPC message per line.
- Unknown line: return `[]`. Do not emit `unknown` for every line of noise.

## 4. Renderer store (pure, testable)

```ts
export interface WorkerStats {
  calls: Partial<Record<ActionKind, number>>;
  skills: Record<string, number>;
  files: Record<string, { touches: number; added?: number; removed?: number }>;
  lastCommand?: string;
  lastExit?: number;
  recent: ActionEvent[];                 // ring buffer, last 30
}

export function reduce(s: Record<string, WorkerStats>, ev: ActionEvent) {
  const w = s[ev.sessionId] ?? { calls: {}, skills: {}, files: {}, recent: [] };
  const skill = ev.target?.match(/skills\/([^/]+)\/SKILL\.md/)?.[1];
  const file = ev.kind === 'edit' && ev.target ? ev.target : undefined;
  const f = file ? w.files[file] ?? { touches: 0 } : undefined;
  return {
    ...s,
    [ev.sessionId]: {
      ...w,
      calls: { ...w.calls, [ev.kind]: (w.calls[ev.kind] ?? 0) + 1 },
      skills: skill ? { ...w.skills, [skill]: (w.skills[skill] ?? 0) + 1 } : w.skills,
      files: f ? { ...w.files, [file!]: { touches: f.touches + 1,
        added: (f.added ?? 0) + (ev.counts?.added ?? 0),
        removed: (f.removed ?? 0) + (ev.counts?.removed ?? 0) } } : w.files,
      lastCommand: ev.command ?? w.lastCommand,
      lastExit: ev.exitCode ?? w.lastExit,
      recent: [ev, ...w.recent].slice(0, 30),
    },
  };
}
```

Memory only. Nothing here is written to the DB. Transcripts are already saved by the existing `flushTranscriptToDb` path.

## 5. Where each inspector field comes from

Rule: if there is no source, show "unknown". Never show 0 or a made up number.

| Inspector field | Real source | Status |
| --- | --- | --- |
| Objective, agent, category, status | `TerminalSession` row (`get-terminal-sessions`) | exists |
| Tokens, cost | `total_tokens`, `total_cost` on the session row, and `getAIUsageSummary` | exists, may be null. Show "unknown" if null. |
| Running time | `started_at` on the session row | exists |
| Tool call counts | reducer over `ActionEvent` | new, derived |
| Skills used | reducer: a `read` event whose path matches `agent/skills/<name>/SKILL.md` | new, derived. No extra capture needed. |
| Files touched | reducer on `edit` events | new. File names derived. +/- lines need the agent's patch output or a `git diff --numstat` on commit. Until then show touch counts only. |
| Last command and exit | `ActionEvent.command`, `exitCode` | new. Exit code only if the agent prints it. Otherwise show "?" |
| Bound problem | `TerminalBinding.active_problem_id` | exists |
| File locks | the cross-session sync live context (Configs tab) | exists. Pipe into the store as a read only list. |
| Role, mission, autonomy L2/L3/L4, depth | Conductor node | exists, Conductor only. Plain sessions hide this block. |
| Worktree, branch | `node.worktreePath`, `node.branch` | exists, Conductor only |
| Model tier | session config (`default-model-tier`) | exists |

## 6. Session lifecycle to worker state

| Terminal infra | Worker |
| --- | --- |
| PTY spawning, `terminal:ready` not yet seen | booting: ring only, no badge |
| `agent:ready` received | idle |
| `agent:timeout` | error ring with "failed to start" in the inspector |
| Events arriving | action, station, pose from the translation table |
| Terminal closed, session saved | saved: dim ghost at its desk (later: folder in the archive cabinet) |
| Click a saved worker, Resume | `handleResumeSession` with the stored `resume_id` |
| Zero terminals open | render nothing |

## 7. Click actions to real calls

| Inspector button | Call |
| --- | --- |
| Focus terminal | `window.dispatchEvent(new CustomEvent('focus-terminal', { detail: { sessionId } }))` |
| Close worker (Conductor) | confirm, then `window.deskflowAPI.conductorCloseNode(missionId, nodeId, { reason, checkpointFirst: true })`. Keep an undo until the replacement worker starts. |
| Close worker (plain session) | the existing `closeTerminal`, after the same confirm |
| Resume session | `handleResumeSession` |

Never close silently. The confirm text must say the worktree stays.

## 8. What the prototype does NOT do yet (do these, in this order)

1. **Replace the simulator** with the real adapter. Keep the simulator behind a dev flag.
2. **Record and replay.** In dev, write every `ActionEvent` to a JSON file. Replay it into the prototype to tune the look with real data.
3. **Real event timing.** The prototype holds each action for about 3 seconds. Real agents fire many calls per second. Use: minimum 800 ms per action, queue of 3, drop the oldest, skip the walk if the next action is at the same station.
4. **Unknown state.** No signal means idle pose and no badge. The prototype's random "unblocked" message is fake. Delete it.
5. **Archive cabinet** for saved sessions, and the **director desk with the escalation tray** (AI handling vs needs you).
6. **Autonomy lanyard** (1, 2, 3 stripes) on each worker.
7. **Crowd chip**, swarm density, and the close confirm with undo.
8. **Pathfinding.** Workers walk straight lines through furniture. Use corridor rows (gx or gy equal to 1 or 7) and walk along them.
9. **Performance.** The prototype re-sorts and re-appends every node each frame. In React, memoize each station, and only re-sort when a worker crosses a tile.
10. **Components.** The prototype builds SVG from strings. Port each station to a small React component with props `{ gx, gy, active, failed }`.

## 9. Test before trusting it

- Unit test `classifyAction`, each adapter, and `reduce` with recorded fixtures.
- A fixture with no events must render nothing, not a working worker.
- A fixture with a failed test must show the red lamp and the red ring.
- Screenshot at 1, 6, and 14 workers, and with reduced motion on.
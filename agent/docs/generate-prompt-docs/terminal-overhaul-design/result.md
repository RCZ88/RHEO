# DeskFlow Terminal & Session UX Overhaul — Complete Architecture

## Architecture Overview

This is a single unified design addressing all five problem areas. The key insight is that they're deeply interconnected: terminal initialization timing (Area 1) determines when sessions become active (Area 2), which drives problem categorization (Area 3), which feeds into skill UIs (Area 4), and session state underpins save/load (Area 5). The solution introduces one new architectural concept — the **Agent Readiness Protocol** — that threads through everything else.

```
┌─────────────────────────────────────────────────────────┐
│                    TerminalPage.tsx                       │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ AgentRead │  │ SessionState │  │ SkillUIRegistry   │  │
│  │ yManager  │──│ Manager      │──│                   │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬──────────┘  │
│       │               │                    │             │
│  ┌────▼─────┐  ┌──────▼───────┐  ┌────────▼──────────┐  │
│  │ Message  │  │ ProblemGroup │  │ PromptDesigner    │  │
│  │ Queue    │  │ Engine       │  │ CodeReviewUI      │  │
│  └──────────┘  └──────────────┘  │ InstructionPanel  │  │
│                                   └───────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              WorkspaceManager                        │ │
│  │  (unified save, checkpoint timeline, config list)    │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Area 1: Terminal Initialization Timing

### 1.1 Agent Readiness Protocol

The root cause: the app writes to the PTY immediately after spawning, but the agent process (opencode, claude, aider, codex) hasn't started yet inside that PTY. The bytes go to the shell, not the agent.

**Solution: Three-phase initialization with message queuing.**

```
Phase 1: SPAWN          Phase 2: DETECT           Phase 3: FLUSH
┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Create PTY   │─────▶│ Monitor PTY      │─────▶│ Queue flushed    │
│ Show shell   │      │ output for       │      │ Messages sent    │
│ Display      │      │ agent signature  │      │ Agent receives   │
│ "Starting    │      │ Show "Waiting    │      │ input            │
│  agent..."   │      │  for agent..."   │      │ Hide overlay     │
└──────────────┘      └──────────────────┘      └──────────────────┘
```

### 1.2 Agent Signature Detection

Each agent emits a distinctive pattern when ready. The main process monitors PTY output and fires `agent:ready` when matched.

```typescript
// In main.ts — Agent readiness signatures
const AGENT_SIGNATURES: Record<string, RegExp> = {
  opencode:   /\>\s*$/,                           // opencode prompt
  claude:     /claude[\s>]|\?\s*$/i,              // claude interactive prompt
  aider:      /aider>\s*$/i,                       // aider prompt
  codex:      />\s*$/,                             // codex prompt
  // Fallback: any known shell prompt after agent launch command
  generic:    /\$\s*$/,                            // shell prompt (agent exited/crashed)
};
```

**Detection logic in main.ts:**

```typescript
// Added to terminal:create and spawn-terminal handlers
// After PTY is created and agent launch command is written:

const agentType = args.agentType || 'claude';
const signature = AGENT_SIGNATURES[agentType] || AGENT_SIGNATURES.generic;
let agentReady = false;

ptyProcess.onData((data: string) => {
  // ... existing data forwarding to renderer ...
  
  if (!agentReady && signature.test(data)) {
    agentReady = true;
    event.sender.send('agent:ready', { terminalId: args.terminalId });
  }
});

// Timeout: if agent doesn't become ready in 30s, send agent:timeout
setTimeout(() => {
  if (!agentReady) {
    event.sender.send('agent:timeout', { terminalId: args.terminalId, agentType });
  }
}, 30_000);
```

### 1.3 Message Queue (Renderer Side)

```typescript
// In TerminalPage.tsx — per-terminal message queue
interface PendingMessage {
  terminalId: string;
  content: string;
  timestamp: number;  // Date.now() at queue time
}

const messageQueueRef = useRef<Map<string, PendingMessage[]>>(new Map());
const agentReadyRef = useRef<Map<string, boolean>>(new Map());
```

**Queue logic:**

```typescript
// When user sends a message or system initializes a terminal:
function queueOrSend(terminalId: string, content: string) {
  if (agentReadyRef.current.get(terminalId)) {
    // Agent is ready — send immediately
    deskflowAPI.terminalWrite(terminalId, content);
  } else {
    // Agent not ready — queue it
    const queue = messageQueueRef.current.get(terminalId) || [];
    queue.push({ terminalId, content, timestamp: Date.now() });
    messageQueueRef.current.set(terminalId, queue);
  }
}

// When agent:ready fires:
function handleAgentReady(terminalId: string) {
  agentReadyRef.current.set(terminalId, true);
  const queue = messageQueueRef.current.get(terminalId) || [];
  for (const msg of queue) {
    deskflowAPI.terminalWrite(terminalId, msg.content);
  }
  messageQueueRef.current.delete(terminalId);
  // Update UI state
  setAgentStatuses(prev => ({ ...prev, [terminalId]: 'ready' }));
}
```

### 1.4 Visual States in TerminalPane

Three visual states for each terminal:

| State | Overlay | Behavior |
|-------|---------|----------|
| `spawning` | "Starting shell..." (existing) | No input accepted |
| `waiting` | "Waiting for {agent}..." with cyan pulse animation | Messages queued, input disabled |
| `ready` | No overlay, green dot in tab | Messages sent immediately, input enabled |
| `timeout` | "Agent didn't start. Click to retry." with amber warning | Click retries initialization |

**TerminalPane overlay JSX:**

```tsx
{agentStatus === 'waiting' && (
  <div className="absolute inset-0 flex items-center justify-center 
                  bg-zinc-900/80 backdrop-blur-sm z-10">
    <div className="flex items-center gap-2 text-cyan-400 text-xs">
      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
      Waiting for {session?.agent || 'agent'}...
    </div>
  </div>
)}

{agentStatus === 'timeout' && (
  <div className="absolute inset-0 flex items-center justify-center 
                  bg-zinc-900/80 backdrop-blur-sm z-10 cursor-pointer"
       onClick={() => retryInitialization(terminalId)}>
    <div className="flex items-center gap-2 text-amber-400 text-xs">
      <AlertTriangle className="w-3 h-3" />
      Agent didn't start. Click to retry.
    </div>
  </div>
)}
```

### 1.5 IPC Additions

```typescript
// preload.ts additions
onAgentReady: (callback: (terminalId: string) => void) => {
  ipcRenderer.on('agent:ready', (_e, data) => callback(data.terminalId));
},
onAgentTimeout: (callback: (terminalId: string, agentType: string) => void) => {
  ipcRenderer.on('agent:timeout', (_e, data) => callback(data.terminalId, data.agentType));
},
retryAgentInit: (terminalId: string) => {
  ipcRenderer.invoke('retry-agent-init', terminalId);
},
```

### 1.6 Fixing `computedProjectPath` Error

The error `Uncaught ReferenceError: computedProjectPath is not defined` at TerminalPage.tsx:3433 indicates a variable referenced before declaration or outside scope. Fix:

```typescript
// Ensure computedProjectPath is declared at component top level
const computedProjectPath = propProjectPath || 
  projects.find(p => p.id === selectedProjectId)?.path || 
  '';
```

This must be declared before any usage — move it above all handler functions.

---

## Area 2: Session Management UX

### 2.1 Auto-Naming Sessions

After the first assistant message in a new session, the system analyzes the content and generates a name.

**Flow:**

```
User sends first message →
  AI responds →
  save-terminal-message fires →
  If session.topic starts with "Session" (default) AND 
     message count <= 2 →
    Parse assistant message for keywords →
    Generate topic from keywords →
    Update session via save-terminal-session
```

**Auto-namer in main.ts:**

```typescript
function generateSessionTopic(userMsg: string, assistantMsg: string): string {
  // Extract key nouns/verbs from first exchange
  const combined = `${userMsg} ${assistantMsg}`.slice(0, 2000);
  
  // Priority patterns:
  // 1. "fix/implement/add/create X" → "Fix X" / "Implement X"
  const actionMatch = combined.match(
    /\b(fix|implement|add|create|build|refactor|debug|update|remove|clean)\s+([\w\s]{3,40})/i
  );
  if (actionMatch) {
    const action = actionMatch[1].charAt(0).toUpperCase() + actionMatch[1].slice(1);
    const target = actionMatch[2].trim().split(/\s+/).slice(0, 4).join(' ');
    return `${action} ${target}`;
  }
  
  // 2. File path mention → "Work on {filename}"
  const fileMatch = combined.match(/([\w-]+\.\w{1,10})/);
  if (fileMatch) {
    return `Work on ${fileMatch[1]}`;
  }
  
  // 3. First meaningful phrase from user message
  const phraseMatch = userMsg.match(/.{10,60}?[.!?]/);
  if (phraseMatch) {
    return phraseMatch[0].trim().slice(0, 50);
  }
  
  // 4. Fallback: date-based
  return `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
}
```

**Integration in `save-terminal-message` handler:**

```typescript
// After inserting the message, check if auto-name is needed
if (message.role === 'assistant' && session.message_count <= 2) {
  const currentTopic = session.topic || '';
  if (!currentTopic || currentTopic.startsWith('Session') || currentTopic === 'New Session') {
    const lastUserMsg = db.prepare(
      `SELECT content FROM terminal_messages 
       WHERE session_id = ? AND role = 'user' 
       ORDER BY created_at DESC LIMIT 1`
    ).get(message.session_id) as { content: string } | undefined;
    
    if (lastUserMsg) {
      const newTopic = generateSessionTopic(lastUserMsg.content, message.content);
      db.prepare(`UPDATE terminal_sessions SET topic = ? WHERE id = ?`)
        .run(newTopic, message.session_id);
    }
  }
}
```

### 2.2 Session State Visualization

Sessions have four states. Each is visually distinct:

| State | Tab Badge | Sidebar Card | Behavior |
|-------|-----------|--------------|----------|
| `active` | Green pulsing dot | Full color card, cyan left border | Terminal alive, agent running |
| `paused` | Yellow static dot | Muted card, yellow left border | Terminal alive, no agent activity |
| `completed` | Gray dot | Muted card, gray left border | Terminal closed, session saved |
| `archived` | No badge | Gray card, dashed border | Hidden by default, filterable |

**Status transition logic:**

```typescript
function computeSessionStatus(session, terminalAlive: boolean): SessionStatus {
  if (session.status === 'archived') return 'archived';
  if (!terminalAlive) return 'completed';
  if (session.last_activity_at) {
    const inactiveMs = Date.now() - new Date(session.last_activity_at).getTime();
    if (inactiveMs > 10 * 60 * 1000) return 'paused'; // 10 min no activity
  }
  return 'active';
}
```

**Session card in sidebar (enhanced):**

```tsx
<div className={`p-2 rounded-lg border cursor-pointer transition-colors
  ${isActive ? 'bg-zinc-700/50 border-cyan-500/30' : 'bg-zinc-800/30 border-zinc-700/50'}
  ${status === 'active' ? 'border-l-2 border-l-cyan-500' : ''}
  ${status === 'paused' ? 'border-l-2 border-l-yellow-500' : ''}
  ${status === 'completed' ? 'border-l-2 border-l-zinc-500' : ''}
  hover:bg-zinc-700/30`}
  onClick={() => focusTerminal(session.terminal_id)}>
  
  <div className="flex items-center gap-2 mb-1">
    <StatusDot status={status} />
    <span className="text-[11px] text-zinc-400 font-medium truncate">
      {session.topic || 'New Session'}
    </span>
    <CategoryBadge category={session.category} />
  </div>
  
  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
    <span>{session.agent}</span>
    <span>·</span>
    <span>{formatRelativeTime(session.created_at)}</span>
    {session.product_area && (
      <>
        <span>·</span>
        <span className="text-teal-500">{session.product_area}</span>
      </>
    )}
  </div>
  
  {/* Checkpoint timeline — mini version */}
  {checkpoints.length > 0 && (
    <div className="mt-1 flex gap-1">
      {checkpoints.map((cp, i) => (
        <div key={cp.id} 
             className="w-1.5 h-1.5 rounded-full bg-zinc-600 hover:bg-cyan-400 
                        transition-colors cursor-pointer"
             title={cp.name}
             onClick={(e) => { e.stopPropagation(); loadCheckpoint(cp.id); }} />
      ))}
    </div>
  )}
</div>
```

### 2.3 Checkpoint Timeline

Each session detail view shows a timeline of saves:

```tsx
<div className="mt-3 border-t border-zinc-700/50 pt-2">
  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
    Checkpoints
  </div>
  {checkpoints.length === 0 ? (
    <div className="text-[10px] text-zinc-600 italic">No checkpoints yet</div>
  ) : (
    <div className="space-y-1">
      {checkpoints.map((cp, i) => (
        <div key={cp.id} 
             className="flex items-center gap-2 text-[10px] group cursor-pointer
                        hover:bg-zinc-700/30 rounded px-1 py-0.5">
          <div className="w-2 h-2 rounded-full border border-zinc-600 
                          group-hover:border-cyan-400 flex-shrink-0" />
          <span className="text-zinc-400 truncate flex-1">{cp.name}</span>
          <span className="text-zinc-600">{formatRelativeTime(cp.created_at)}</span>
          <button className="opacity-0 group-hover:opacity-100 text-cyan-400 
                            hover:text-cyan-300 transition-opacity"
                  onClick={() => loadCheckpoint(cp.id)}>
            Load
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

### 2.4 Unified Save — One Button

**Remove**: Sidebar "Save Checkpoint" button entirely.

**Keep**: Single topbar save button (💾 icon) that:
1. Opens the save dialog asking for name
2. Saves current layout + terminal states + session bindings to `terminal_layouts` DB
3. Updates `savedConfigs` state immediately (no refresh needed)
4. The saved config appears in the Configs tab list

```typescript
// Unified save handler
async function handleSave(name: string) {
  const config = {
    name,
    layout: terminalLayout,
    terminals: Object.entries(terminalTabs).map(([id, tab]) => ({
      id,
      session: tab.sessionId ? sessions.find(s => s.id === tab.sessionId) : null,
    })),
    savedAt: new Date().toISOString(),
  };
  
  await deskflowAPI.saveTerminalLayout(config);
  
  // Immediately update local state (no reload needed)
  setSavedConfigs(prev => [...prev, { ...config, id: Date.now().toString() }]);
}
```

---

## Area 3: Problem Categorization & Display

### 3.1 Text Sanitization

```typescript
// Utility function for all problem/request display
function sanitizeDisplayText(text: string): string {
  if (!text) return '';
  return text
    // Replace null bytes
    .replace(/\0/g, '')
    // Replace other control characters (except newline, tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Replace invalid UTF-8 sequences with replacement character
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '�')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Limit consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

### 3.2 Timestamp Fix

The "7 hours ago" bug: the current code computes relative time from a stale reference or uses client-side `Date.now()` instead of the DB's `created_at`.

**Fix**: All timestamps come from the data source. Never compute from client clock.

```typescript
// In main.ts — all problem/request queries return created_at directly
// In renderer — format using the DB timestamp
function formatRelativeTime(dbTimestamp: string): string {
  const date = new Date(dbTimestamp + 'Z'); // Ensure UTC
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
```

**Critical**: Ensure `problems.json` and `requests.json` include `created_at` from the original parse. Update `ProblemsService.parseProblems()` to extract timestamp from PROBLEMS.md sections:

```typescript
// In parseProblems — extract date from "Date:" field or section header
const dateMatch = section.match(/Date:\s*(.+)/i);
const createdAt = dateMatch 
  ? new Date(dateMatch[1]).toISOString()
  : new Date().toISOString(); // Fallback for problems without dates
```

### 3.3 Problem Grouping Engine

```typescript
type GroupBy = 'session' | 'terminal' | 'status' | 'category' | 'none';

interface ProblemGroup {
  key: string;
  label: string;
  color?: string;
  problems: Problem[];
}

function groupProblems(problems: Problem[], groupBy: GroupBy): ProblemGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All Problems', problems }];
  }
  
  const groups = new Map<string, Problem[]>();
  
  for (const problem of problems) {
    let key: string, label: string, color: string | undefined;
    
    switch (groupBy) {
      case 'session':
        key = problem.session_id || 'unassigned';
        label = problem.session_id 
          ? sessions.find(s => s.id === problem.session_id)?.topic || `Session ${problem.session_id.slice(0,8)}`
          : 'No Session';
        break;
      case 'terminal':
        key = problem.terminal_id || 'unassigned';
        label = problem.terminal_id 
          ? `Terminal ${problem.terminal_id.slice(0,4)}`
          : 'No Terminal';
        break;
      case 'status':
        key = problem.status || 'open';
        label = key.charAt(0).toUpperCase() + key.slice(1);
        color = STATUS_COLORS[key] || '#71717a';
        break;
      case 'category':
        key = problem.category || 'other';
        label = key.charAt(0).toUpperCase() + key.slice(1);
        color = CATEGORY_COLORS[key] || '#71717a';
        break;
    }
    
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(problem);
  }
  
  return Array.from(groups.entries()).map(([key, problems]) => ({
    key,
    label: groups.label, // computed above
    color: groups.color,
    problems,
  }));
}
```

### 3.4 ProblemsTab Redesign

```tsx
function ProblemsTab({ problems, sessions, terminals, onProblemClick }) {
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['open']));
  
  const groups = useMemo(
    () => groupProblems(problems, groupBy), 
    [problems, groupBy, sessions]
  );
  
  return (
    <div className="flex flex-col h-full">
      {/* Group-by controls */}
      <div className="flex gap-1 p-2 border-b border-zinc-700/50">
        {(['status', 'category', 'session', 'none'] as GroupBy[]).map(g => (
          <button key={g}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors
              ${groupBy === g 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
            onClick={() => setGroupBy(g)}>
            {g === 'none' ? 'Flat' : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Grouped problem list */}
      <div className="flex-1 overflow-y-auto">
        {groups.map(group => (
          <div key={group.key}>
            {/* Group header — expandable */}
            <button 
              className="w-full flex items-center gap-2 px-3 py-1.5 
                         hover:bg-zinc-800/50 text-[11px]"
              onClick={() => toggleGroup(group.key)}>
              <ChevronRight 
                className={`w-3 h-3 text-zinc-600 transition-transform
                  ${expandedGroups.has(group.key) ? 'rotate-90' : ''}`} />
              <span className="text-zinc-400">{group.label}</span>
              <span className="text-zinc-600">({group.problems.length})</span>
              {group.color && (
                <div className="w-2 h-2 rounded-full" style={{ background: group.color }} />
              )}
            </button>
            
            {/* Expanded problems */}
            {expandedGroups.has(group.key) && (
              <div className="pl-4">
                {group.problems.map(problem => (
                  <ProblemCard 
                    key={problem.id} 
                    problem={problem}
                    sessions={sessions}
                    terminals={terminals}
                    onClick={() => onProblemClick(problem)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3.5 Problem Card with Session Link + Progress

```tsx
function ProblemCard({ problem, sessions, terminals, onClick }) {
  const session = problem.session_id 
    ? sessions.find(s => s.id === problem.session_id) 
    : null;
  const terminal = problem.terminal_id 
    ? terminals.find(t => t.id === problem.terminal_id) 
    : null;
  
  // Progress: compute from status + sub-items
  const progress = computeProgress(problem);
  
  return (
    <div className="px-3 py-2 hover:bg-zinc-800/30 cursor-pointer border-l-2 
                    border-transparent hover:border-cyan-500/30 transition-colors"
         onClick={onClick}>
      
      {/* Title + status */}
      <div className="flex items-center gap-2">
        <StatusDot status={problem.status === 'fixed' ? 'completed' : 
                           problem.status === 'in-progress' ? 'active' : 'paused'} />
        <span className="text-[11px] text-zinc-300 truncate">
          {sanitizeDisplayText(problem.title)}
        </span>
        <CategoryBadge category={problem.category} />
      </div>
      
      {/* Session / Terminal link */}
      {(session || terminal) && (
        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600">
          {session && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" />
              {sanitizeDisplayText(session.topic || '').slice(0, 30)}
            </span>
          )}
          {terminal && (
            <span className="flex items-center gap-1">
              <Terminal className="w-2.5 h-2.5" />
              Terminal {terminal.id.slice(0, 4)}
            </span>
          )}
        </div>
      )}
      
      {/* Progress bar */}
      {progress && progress.total > 0 && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between text-[9px] text-zinc-600 mb-0.5">
            <span>{progress.completed}/{progress.total} steps</span>
            <span>{Math.round(progress.percent)}%</span>
          </div>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500/60 rounded-full transition-all"
                 style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}
      
      {/* Timestamp — from DB */}
      <div className="text-[9px] text-zinc-700 mt-1">
        {formatRelativeTime(problem.created_at)}
      </div>
    </div>
  );
}

function computeProgress(problem: Problem) {
  // If problem has sub-items (from checklists or fix steps)
  if (!problem.steps || problem.steps.length === 0) return null;
  
  const total = problem.steps.length;
  const completed = problem.steps.filter(s => s.done).length;
  return {
    total,
    completed,
    percent: (completed / total) * 100,
  };
}
```

### 3.6 Problem-Session Join

The `workspace_problems` table already has `session_id` (added in prior work). Ensure every problem creation or assignment links to a session:

```typescript
// When creating a problem from a terminal context:
const currentSessionId = sessions.find(s => s.terminal_id === activeTerminalId)?.id;
if (currentSessionId) {
  problem.session_id = currentSessionId;
}

// When assigning a problem to a terminal:
db.prepare(`UPDATE workspace_problems SET session_id = ? WHERE id = ?`)
  .run(activeSessionId, problem.id);
```

---

## Area 4: Skill UI System

### 4.1 Skill Frontmatter Convention

Each skill's `SKILL.md` can declare a `ui` field in frontmatter:

```yaml
---
name: generate-prompt
description: Generate a structured prompt for complex design tasks
ui: prompt-designer
---
```

```yaml
---
name: code-review
description: Review code changes in the project
ui: code-review
---
```

```yaml
---
name: debug-issue
description: Debug a specific issue
ui: default
---
```

If no `ui` field is present, it defaults to `default` (InstructionPanel).

### 4.2 Skill UI Registry

```typescript
// In src/lib/skillUIRegistry.ts (new file)

import React from 'react';

export interface SkillUIProps {
  skill: {
    name: string;
    description: string;
    content: string;        // Full SKILL.md content
    frontmatter: Record<string, any>;
  };
  linkedProblems: Problem[];
  linkedRequests: Request[];
  onSend: (composedPrompt: string) => void;
  onCancel: () => void;
  projectId: string;
}

type SkillUIComponent = React.ComponentType<SkillUIProps>;

const registry = new Map<string, SkillUIComponent>();

export function registerSkillUI(uiType: string, component: SkillUIComponent) {
  registry.set(uiType, component);
}

export function getSkillUI(uiType: string): SkillUIComponent | null {
  return registry.get(uiType) || null;
}

export function hasSkillUI(uiType: string): boolean {
  return registry.has(uiType);
}
```

### 4.3 Registry Initialization

```typescript
// In TerminalPage.tsx or App.tsx init

import { registerSkillUI } from '../lib/skillUIRegistry';
import { PromptDesignerUI } from '../components/skills/PromptDesignerUI';
import { CodeReviewUI } from '../components/skills/CodeReviewUI';
import { InstructionPanel } from '../components/InstructionPanel';

// Register built-in skill UIs
registerSkillUI('prompt-designer', PromptDesignerUI);
registerSkillUI('code-review', CodeReviewUI);
registerSkillUI('default', InstructionPanel as any); // Backward compat
```

### 4.4 Skill Dispatch in SkillsTab

When "Use" is clicked on a skill, the system reads the `ui` frontmatter and renders the matching component:

```tsx
function SkillsTab({ skills, onUseSkill }) {
  // When Use is clicked:
  function handleUseSkill(skill) {
    const uiType = skill.frontmatter?.ui || 'default';
    onUseSkill(skill, uiType);
  }
  
  return (
    <div className="grid grid-cols-1 gap-1.5 p-2">
      {skills.map(skill => (
        <SkillCard key={skill.name} skill={skill} onUse={handleUseSkill} />
      ))}
    </div>
  );
}
```

### 4.5 Skill UI Rendering in TerminalPage

```tsx
// State for currently active skill UI
const [activeSkillUI, setActiveSkillUI] = useState<{
  skill: Skill;
  uiType: string;
} | null>(null);

// In the sidebar content area:
{activeTab === 'skills' && !activeSkillUI && (
  <SkillsTab 
    skills={skills} 
    onUseSkill={(skill, uiType) => setActiveSkillUI({ skill, uiType })} 
  />
)}

{activeSkillUI && (
  <SkillUIRenderer 
    skill={activeSkillUI.skill}
    uiType={activeSkillUI.uiType}
    linkedProblems={selectedProblems}
    linkedRequests={selectedRequests}
    onSend={handleSkillSend}
    onCancel={() => setActiveSkillUI(null)}
    projectId={selectedProjectId}
  />
)}

// SkillUIRenderer component
function SkillUIRenderer({ skill, uiType, ...props }: SkillUIProps & { uiType: string }) {
  const Component = getSkillUI(uiType);
  
  if (!Component) {
    // Fallback to default (InstructionPanel)
    const DefaultComponent = getSkillUI('default')!;
    return <DefaultComponent skill={skill} {...props} />;
  }
  
  return <Component skill={skill} {...props} />;
}
```

### 4.6 PromptDesignerUI — Reference Implementation

This replaces the current `PromptDesignDialog` and becomes the canonical custom skill UI:

```tsx
// In src/components/skills/PromptDesignerUI.tsx

import React, { useState, useEffect } from 'react';
import { Copy, Save, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { SkillUIProps } from '../../lib/skillUIRegistry';

export function PromptDesignerUI({ skill, onSend, onCancel, projectId }: SkillUIProps) {
  const [promptContent, setPromptContent] = useState('');
  const [resultContent, setResultContent] = useState('');
  const [promptGenerated, setPromptGenerated] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  // When user clicks "Generate", compose the skill instruction and send to AI
  async function handleGenerate() {
    const composedPrompt = `Use the generate-prompt skill. ${skill.content}\n\nProject: ${projectId}`;
    setPromptGenerated(true);
    onSend(composedPrompt);
  }
  
  // When user has pasted the AI's result and wants to save it
  async function handleSaveResult() {
    if (!resultContent.trim()) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `agent/docs/${skill.name}-${timestamp}/result.md`;
    
    await deskflowAPI.writeProjectFile(path, resultContent);
    // Show success feedback
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] text-zinc-300 font-medium">
            {skill.name}
          </span>
        </div>
        <button onClick={onCancel} className="text-zinc-600 hover:text-zinc-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Step 1: Generate */}
      <div className="p-3 border-b border-zinc-700/50">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
          Step 1: Generate Prompt
        </div>
        <button
          onClick={handleGenerate}
          className="w-full py-1.5 bg-cyan-500/20 text-cyan-400 text-[11px] 
                     rounded-lg hover:bg-cyan-500/30 transition-colors
                     flex items-center justify-center gap-1.5"
          disabled={promptGenerated}>
          <Sparkles className="w-3 h-3" />
          {promptGenerated ? 'Prompt Sent to AI' : 'Generate Design Prompt'}
        </button>
      </div>
      
      {/* Step 2: Paste AI output */}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Step 2: Paste AI Result
          </div>
          {resultContent && (
            <button onClick={handleSaveResult}
              className="text-[10px] px-2 py-0.5 bg-teal-500/20 text-teal-400 
                         rounded hover:bg-teal-500/30 flex items-center gap-1">
              <Save className="w-2.5 h-2.5" /> Save
            </button>
          )}
        </div>
        <textarea
          value={resultContent}
          onChange={(e) => setResultContent(e.target.value)}
          placeholder="Paste the AI's generated prompt output here..."
          className="flex-1 w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg 
                     p-2 text-[11px] text-zinc-300 resize-none
                     placeholder:text-zinc-700 focus:border-cyan-500/50 
                     focus:outline-none font-mono"
        />
      </div>
    </div>
  );
}
```

### 4.7 CodeReviewUI — Second Custom UI

```tsx
// In src/components/skills/CodeReviewUI.tsx

export function CodeReviewUI({ skill, onSend, onCancel, projectId, linkedProblems }: SkillUIProps) {
  const [reviewScope, setReviewScope] = useState<'staged' | 'unstaged' | 'full'>('staged');
  const [focusFiles, setFocusFiles] = useState('');
  
  function handleStartReview() {
    const composed = `Perform a ${reviewScope} code review.\n${
      focusFiles ? `Focus on: ${focusFiles}\n` : ''
    }${
      linkedProblems.length > 0 
        ? `Related problems: ${linkedProblems.map(p => p.title).join(', ')}\n` 
        : ''
    }\n${skill.content}`;
    onSend(composed);
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-zinc-700/50">
        <span className="text-[11px] text-zinc-300 font-medium">Code Review</span>
        <button onClick={onCancel} className="text-zinc-600 hover:text-zinc-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Scope selector */}
      <div className="p-3 border-b border-zinc-700/50">
        <div className="text-[10px] text-zinc-500 mb-2">Review Scope</div>
        <div className="flex gap-1">
          {(['staged', 'unstaged', 'full'] as const).map(scope => (
            <button key={scope}
              className={`text-[10px] px-2 py-0.5 rounded-full
                ${reviewScope === scope 
                  ? 'bg-cyan-500/20 text-cyan-400' 
                  : 'bg-zinc-800 text-zinc-500'}`}
              onClick={() => setReviewScope(scope)}>
              {scope}
            </button>
          ))}
        </div>
      </div>
      
      {/* Focus files */}
      <div className="p-3 flex-1">
        <div className="text-[10px] text-zinc-500 mb-2">Focus Files (optional)</div>
        <textarea
          value={focusFiles}
          onChange={(e) => setFocusFiles(e.target.value)}
          placeholder="src/main.ts&#10;src/preload.ts"
          className="w-full h-20 bg-zinc-900/50 border border-zinc-700/50 rounded-lg 
                     p-2 text-[11px] text-zinc-300 resize-none
                     placeholder:text-zinc-700 font-mono"
        />
      </div>
      
      {/* Start button */}
      <div className="p-3 border-t border-zinc-700/50">
        <button onClick={handleStartReview}
          className="w-full py-1.5 bg-cyan-500/20 text-cyan-400 text-[11px] 
                     rounded-lg hover:bg-cyan-500/30">
          Start Review
        </button>
      </div>
    </div>
  );
}
```

### 4.8 Skill Parsing — Frontmatter Extraction

```typescript
// In src/lib/skillParser.ts (new file)

export interface ParsedSkill {
  name: string;
  description: string;
  content: string;
  frontmatter: Record<string, any>;
}

export function parseSkillMarkdown(markdown: string): ParsedSkill {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter: Record<string, any> = {};
  let content = markdown;
  
  if (frontmatterMatch) {
    content = markdown.slice(frontmatterMatch[0].length).trim();
    const yaml = frontmatterMatch[1];
    
    // Simple YAML parser (no dependency needed)
    for (const line of yaml.split('\n')) {
      const kvMatch = line.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2].trim().replace(/^["']|["']$/g, '');
        frontmatter[key] = value;
      }
    }
  }
  
  return {
    name: frontmatter.name || 'unnamed-skill',
    description: frontmatter.description || '',
    content,
    frontmatter,
  };
}
```

---

## Area 5: Workspace Save/Load

### 5.1 Configs Tab — Final Wiring

The placeholder JSX in the Configs tab needs to be connected to the `savedConfigs` state and `loadSavedConfigs` function.

```tsx
// In the Configs tab rendering section of TerminalPage.tsx
{activeTab === 'configs' && (
  <div className="flex flex-col h-full">
    {/* Save Current button */}
    <div className="p-2 border-b border-zinc-700/50">
      <button
        onClick={() => setShowSaveDialog(true)}
        className="w-full py-1.5 bg-cyan-500/15 text-cyan-400 text-[11px] 
                   rounded-lg hover:bg-cyan-500/25 transition-colors
                   flex items-center justify-center gap-1.5
                   border border-cyan-500/20">
        <Save className="w-3 h-3" />
        Save Current Workspace
      </button>
    </div>
    
    {/* Saved configs list */}
    <div className="flex-1 overflow-y-auto">
      {savedConfigs.length === 0 ? (
        <div className="p-4 text-center text-[10px] text-zinc-600">
          No saved workspaces yet.
          <br />
          Click "Save Current Workspace" to create one.
        </div>
      ) : (
        <div className="space-y-1 p-2">
          {savedConfigs.map(config => (
            <SavedConfigCard 
              key={config.id}
              config={config}
              onLoad={handleLoadConfig}
              onDelete={handleDeleteConfig}
            />
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

### 5.2 SavedConfigCard Component

```tsx
function SavedConfigCard({ config, onLoad, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-2 hover:bg-zinc-700/20 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <ChevronRight className={`w-3 h-3 text-zinc-600 transition-transform
          ${expanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 text-left">
          <div className="text-[11px] text-zinc-300 truncate">
            {sanitizeDisplayText(config.name)}
          </div>
          <div className="text-[9px] text-zinc-600">
            {formatRelativeTime(config.savedAt)}
            {' · '}
            {config.terminals?.length || 0} terminal(s)
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onLoad(config); }}
          className="text-[9px] px-1.5 py-0.5 bg-teal-500/15 text-teal-400 
                     rounded hover:bg-teal-500/25 border border-teal-500/20">
          Load
        </button>
      </button>
      
      {expanded && (
        <div className="px-3 pb-2 border-t border-zinc-700/30 pt-2">
          {config.terminals?.map(t => (
            <div key={t.id} className="text-[10px] text-zinc-500 mb-0.5">
              Terminal {t.id.slice(0,6)}
              {t.session && (
                <span className="text-zinc-400 ml-1">
                  → {sanitizeDisplayText(t.session.topic || '').slice(0, 25)}
                </span>
              )}
            </div>
          ))}
          <div className="flex justify-end mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(config.id); }}
              className="text-[9px] text-red-500/60 hover:text-red-400">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.3 Load Config Handler

```typescript
async function handleLoadConfig(config: SavedConfig) {
  // 1. Close all current terminals
  for (const tid of Object.keys(terminalTabs)) {
    await deskflowAPI.terminalDestroy(tid);
  }
  
  // 2. Reset layout
  setTerminalLayout(null);
  setTerminalTabs({});
  
  // 3. Recreate terminals from saved config
  for (const terminalConfig of config.terminals) {
    // Spawn new terminal
    const newId = await deskflowAPI.spawnTerminal(
      terminalConfig.id,
      deskflowAPI.getProjectPath()
    );
    
    // Resume session if one was bound
    if (terminalConfig.session) {
      await deskflowAPI.initializeTerminal(
        newId,
        terminalConfig.session.agent,
        terminalConfig.session.resume_id
      );
    }
  }
  
  // 4. Restore layout
  if (config.layout) {
    setTerminalLayout(config.layout);
  }
  
  // 5. Refresh sessions list
  await loadSessions();
}
```

### 5.4 Unified Save Button (Topbar Only)

The topbar save button:

```tsx
{/* In header, next to Send and Open Terminal */}
<button
  onClick={() => setShowSaveDialog(true)}
  className="px-2 py-1 text-[11px] text-zinc-400 hover:text-cyan-400 
             transition-colors flex items-center gap-1"
  title="Save workspace (layout + sessions + bindings)">
  <Save className="w-3.5 h-3.5" />
</button>
```

**Remove** the sidebar "Save Checkpoint" button entirely. The topbar button triggers the same save dialog, which writes to `terminal_layouts` DB and updates `savedConfigs` state.

### 5.5 Save Dialog

```tsx
{showSaveDialog && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 
                  flex items-center justify-center"
       onClick={() => setShowSaveDialog(false)}>
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 
                    w-80 shadow-xl"
         onClick={(e) => e.stopPropagation()}>
      <div className="text-[12px] text-zinc-300 font-medium mb-3">
        Save Workspace
      </div>
      
      <input
        type="text"
        value={saveName}
        onChange={(e) => setSaveName(e.target.value)}
        placeholder={`${activeSession?.topic || 'Workspace'} — ${new Date().toLocaleDateString()}`}
        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg 
                   px-3 py-1.5 text-[11px] text-zinc-300
                   placeholder:text-zinc-600 focus:border-cyan-500/50 
                   focus:outline-none"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave(saveName || `${activeSession?.topic || 'Workspace'} — ${new Date().toLocaleDateString()}`);
            setShowSaveDialog(false);
          }
        }}
      />
      
      <div className="text-[9px] text-zinc-600 mt-2">
        Saves: layout, terminal tabs, session bindings
      </div>
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setShowSaveDialog(false)}
          className="flex-1 py-1.5 text-[11px] text-zinc-500 
                     hover:text-zinc-300 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => {
            handleSave(saveName || `${activeSession?.topic || 'Workspace'} — ${new Date().toLocaleDateString()}`);
            setShowSaveDialog(false);
          }}
          className="flex-1 py-1.5 bg-cyan-500/20 text-cyan-400 text-[11px] 
                     rounded-lg hover:bg-cyan-500/30 transition-colors">
          Save
        </button>
      </div>
    </div>
  </div>
)}
```

---

## Database Schema Changes

### New Tables

```sql
-- None needed — all required tables already exist.
-- The terminal_layouts table already stores saved configs.
-- The workspace_problems table already has session_id.
```

### Column Additions

```sql
-- Already added in prior work:
-- terminal_sessions: category, status, product_area, description, auto_tags, category_confirmed
-- workspace_problems: session_id

-- New additions needed:
ALTER TABLE terminal_sessions ADD COLUMN last_activity_at TEXT;
ALTER TABLE terminal_sessions ADD COLUMN auto_named INTEGER DEFAULT 0;
```

### Data Integrity

```sql
-- Ensure problems.json includes created_at from parsing
-- Ensure terminal_messages.created_at is always set from server time (DEFAULT CURRENT_TIMESTAMP)
-- Ensure problems in DB have created_at populated
UPDATE workspace_problems SET created_at = datetime('now') WHERE created_at IS NULL;
```

---

## IPC Handler Changes

### New Handlers

| Handler | Direction | Purpose |
|---------|-----------|---------|
| `agent:ready` | Main → Renderer | Agent detected in terminal |
| `agent:timeout` | Main → Renderer | Agent didn't start in 30s |
| `retry-agent-init` | Renderer → Main | Re-send initialization to terminal |

### Modified Handlers

| Handler | Change |
|---------|--------|
| `save-terminal-message` | Auto-name session after first assistant message |
| `save-terminal-session` | Update `last_activity_at` on every save |
| `terminal:create` | Add agent readiness detection + `agent:ready` event |
| `spawn-terminal` | Add agent readiness detection + `agent:ready` event |
| `save-terminal-layout` | Return the saved config object for immediate state update |
| `get-terminal-layouts` | Return full config objects (not just names) |
| `delete-terminal-layout` | New handler for deleting saved configs |

---

## Interaction Flow Summary

### Flow 1: Creating a New Session (Fixed)

```
1. User clicks "Open Terminal" or "New Session"
2. PTY spawns → shows "Starting shell..."
3. Agent launch command written to PTY
4. Main process monitors PTY output for agent signature
5. UI shows "Waiting for {agent}..." with cyan pulse
6. Agent starts → signature detected → main fires agent:ready
7. Renderer receives agent:ready → flushes message queue
8. System prompt + INITIALIZE.md + session config sent
9. UI transitions to "ready" state (green dot in tab)
10. After first exchange, session auto-named
```

### Flow 2: Saving and Loading Workspaces

```
1. User clicks 💾 in topbar
2. Save dialog opens with auto-generated name
3. User confirms → layout + terminals + sessions saved to DB
4. savedConfigs state updated immediately (no refresh)
5. Config appears in Configs tab sidebar
6. To load: click "Load" on a config card
7. Current terminals closed → saved terminals recreated → layout restored
8. Sessions resumed if they have resume_id
```

### Flow 3: Problem with Session Context

```
1. Problem created from terminal context → automatically linked to session
2. ProblemsTab shows problems grouped by session/status/category
3. Each problem card shows which session/terminal it belongs to
4. Click problem → expand to full detail + linked session + progress
5. Timestamp from DB created_at, sanitized display text
```

### Flow 4: Using a Skill with Custom UI

```
1. User clicks skill in SkillsTab
2. Skill's frontmatter `ui` field read → matched to registry
3. Custom UI component rendered in sidebar (e.g., PromptDesignerUI)
4. User interacts with custom UI (generate → paste result → save)
5. On completion, UI calls onSend or onCancel
6. Returns to SkillsTab list
```

---

## Implementation Order

The five areas have dependencies. Implement in this order:

```
Phase 1: Area 1 (Terminal Init Timing)
  ├─ Agent readiness detection in main.ts
  ├─ Message queue in TerminalPage.tsx
  ├─ Visual states in TerminalPane
  └─ Fix computedProjectPath reference error

Phase 2: Area 2 (Session Management)
  ├─ Auto-naming in save-terminal-message handler
  ├─ Session status computation
  ├─ Enhanced session cards with status dots + category badges
  ├─ Checkpoint timeline in session detail
  └─ last_activity_at column + updates

Phase 3: Area 5 (Save/Load)  ← depends on session status from Phase 2
  ├─ Configs tab wiring (render savedConfigs)
  ├─ Remove sidebar save button
  ├─ Unified save dialog from topbar
  ├─ Load config handler
  └─ Delete config handler

Phase 4: Area 3 (Problem Categorization)  ← depends on session links from Phase 2
  ├─ Text sanitization utility
  ├─ Timestamp fix (DB created_at everywhere)
  ├─ Grouping engine + group-by controls
  ├─ Problem cards with session/terminal links + progress
  └─ Problem-session auto-linking

Phase 5: Area 4 (Skill UI System)  ← independent, can parallel with Phase 4
  ├─ Skill frontmatter parser
  ├─ Skill UI registry
  ├─ PromptDesignerUI (refactor from PromptDesignDialog)
  ├─ CodeReviewUI
  ├─ Skill dispatch in SkillsTab
  └─ SkillUIRenderer in TerminalPage
```

---

## Complete File Change List

| File | Changes |
|------|---------|
| `src/main.ts` | Agent readiness detection in terminal:create/spawn, auto-naming in save-terminal-message, `agent:ready`/`agent:timeout` IPC events, `retry-agent-init` handler, `delete-terminal-layout` handler, `last_activity_at` updates |
| `src/preload.ts` | `onAgentReady`, `onAgentTimeout`, `retryAgentInit`, `deleteTerminalLayout` bridges |
| `src/pages/TerminalPage.tsx` | Message queue, agent ready/timeout handlers, `computedProjectPath` fix, unified save button, remove sidebar save, Configs tab wiring, session status computation, enhanced session cards, checkpoint timeline, save dialog, load config handler, problem grouping integration, skill UI dispatch + renderer, `activeSkillUI` state |
| `src/components/TerminalWindow.tsx` | Agent status overlay (spawning/waiting/ready/timeout), `agentReadyRef` per terminal |
| `src/lib/skillUIRegistry.ts` | **NEW** — Registry + types |
| `src/lib/skillParser.ts` | **NEW** — Frontmatter parser |
| `src/lib/sanitize.ts` | **NEW** — `sanitizeDisplayText()` utility |
| `src/components/skills/PromptDesignerUI.tsx` | **NEW** — Refactored from PromptDesignDialog |
| `src/components/skills/CodeReviewUI.tsx` | **NEW** — Second custom skill UI |
| `src/services/ProblemsService.ts` | Include `created_at` in parse output, add `session_id` to problem interface |
| `agent/skills/*/SKILL.md` | Add `ui:` frontmatter field to each skill |

---

## Visual Specification

### Color Tokens (consistent with existing)

```css
/* Status colors */
--status-active: #22d3ee;    /* cyan-400 */
--status-paused: #facc15;    /* yellow-400 */
--status-completed: #71717a; /* zinc-500 */
--status-archived: #3f3f46;  /* zinc-700 */

/* Category colors (existing from CategoryBadge) */
--cat-bug-fix: #ef4444;      /* red-500 */
--cat-feature: #3b82f6;      /* blue-500 */
--cat-refactor: #a855f7;     /* purple-500 */
--cat-research: #14b8a6;     /* teal-500 */
--cat-review: #f59e0b;       /* amber-500 */
--cat-other: #71717a;        /* zinc-500 */
```

### Font Sizes (metadata hierarchy)

```
Section header:   text-[11px] font-medium text-zinc-400
Card title:       text-[11px] text-zinc-300
Card metadata:    text-[10px] text-zinc-500
Timestamps:       text-[9px]  text-zinc-600
Badges:           text-[9px]  px-1.5 py-0.5 rounded-full
Progress label:   text-[9px]  text-zinc-600
```

### Animation Specs

```
Status pulse:     animate-pulse (Tailwind built-in) — 2s cycle
Waiting overlay:  cyan-400 pulse dot + text
Group expand:     chevron rotate-90 transition-transform duration-150
Card hover:       bg-zinc-700/30 transition-colors duration-150
```

---

This is the single complete architecture. No alternatives. Every component spec, data flow, database change, and interaction is specified. Implementation follows the phased order above.
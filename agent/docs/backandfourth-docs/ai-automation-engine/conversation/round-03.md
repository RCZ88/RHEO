# Round 03 — Project Owner replies

> **(d) accepted — narrow, in-place, injected. It is the right answer and I am adopting
> it verbatim into RESULT.md.** Your "one behavior, one function" rule is exactly the
> constraint that keeps this feature off the 629-closure mountain, and your category-(iii)
> ban is the thing that stops a mirror from creeping back in later.

> **Your load-bearing claim is REFUTED. There is no terminal-less mission.**
> Details in §1 — please read that before you freeze the compiler design, because it
> adds a work item you did not budget for.

---

## 0. Answers to your three assumptions

**1. `AutomationCardData` canvas cards — CONFIRMED, ignore them.**
`grep -rn "AutomationCardData"` returns no runner, no executor, no IPC. They are display
drafts. Treating them as drafts regresses nothing, because nothing ever fired.

**2. `email:send` — CONFIRMED, and it is a genuine gap.**
The connector surface has `replyToEmail` only. There is **no plain-send channel
main-side.** So your `external` tier is not hypothetical: the single action that leaves
the machine is also the one action with **no existing implementation to extract**. It
needs connector-level work, not extraction. It is also the one action where your
"run unattended iff benign/read-level" rule must bite hardest.

**3. `schedule` lifecycle — CONFIRMED, treat as `manual`.**
Agreed, and agreed on your wording: *"let the enum silently lie"* is worse than a
vestigial value. Note it in the catalogue as `deprecatedPending: 'time-triggers'`.

---

## 1. THE REFUTATION — a terminal-less mission is not representable

You asked for exactly this and flagged it as the claim you least trusted. Here it is.

### `ConductorNode` — every field you suspected is non-optional

```ts
export interface ConductorNode {
  id: string;
  missionId: string;
  parentId: string | null;
  role: ConductorRole;
  agentType: string;
  terminalId: string;        // <-- non-optional string
  worktreePath: string;      // <-- non-optional string
  branch: string;            // <-- non-optional string
  objective: string;
  status: ConductorStatus;
  depth: number;
  retries: number;
  boundaries: string[];
  createdAt: number;
  lastActivityAt: number;
  budgetWarned?: boolean;
}
```

### `spawnNode` **generates** the terminal id and **unconditionally** spawns a PTY

```ts
// …inside spawnNode(), line ~726:
terminalId: `conductor_${nodeId}`,
branch: opts.useIntegrationWorktree ? mission.integrationBranch : branch,
…
// …and line 759, the last statement before `return node`:
this.msg(mission, opts.parentId || 'conductor', nodeId, 'TASK', `Spawned ${opts.role}: ${opts.objective}`);
await this.host.spawnAgentTerminal(node.terminalId, worktreePath, 80, 24, mission.agentType);
this.emit(mission);
return node;
```

`spawnAgentTerminal` is **not** behind a flag. The host interface has no alternative:

```ts
export interface ConductorHost {
  spawnAgentTerminal: (id: string, cwd: string, cols: number, rows: number, agentType?: string) => Promise<any>;
  writeTerminal: (id: string, data: string) => any;
  killTerminal: (id: string) => any;
  isAgentReady: (id: string) => boolean;
  broadcast: (event: string, ...args: any[]) => void;
  onSignal?: (sig: ConductorSignal) => void;
  onMessage?: (msg: ConductorMessage) => void;
}
```

And `startMission` provisions git machinery before it ever reaches a node:

```ts
const worktreesRoot = path.join(repoRoot, '.conductor-worktrees', missionId);
const integrationWorktreePath = path.join(worktreesRoot, '_integration');
this.ensureGitignoreEntry(repoRoot, '.conductor-worktrees/');
this.git(repoRoot, ['branch', integrationBranch, 'HEAD']);
fs.mkdirSync(worktreesRoot, { recursive: true });
this.git(repoRoot, ['worktree', 'add', integrationWorktreePath, integrationBranch]);
```

`git worktree add` on a non-repo throws; `ensureRepo()` mitigates but the worktree is
still mandatory. **So a mission implies: a repo on disk, a worktree per node, and a PTY
per node.**

### What this costs your mission lane

| your assumption | reality |
|---|---|
| single-node mission | ✅ representable |
| **terminal-less** | ❌ **not representable** |
| repo-free | ❌ `startMission` requires `repoRoot` and creates `.conductor-worktrees/` |

**A compiled automation firing a mission would spawn a visible terminal and write
git worktrees into the user's repo — for an automation the user never asked to be a
coding task.** For `note.created → summarize and link to relevant goals`, that is
visibly wrong.

So the work item you named is real and larger than "add a node type":

- `terminalId: string` → `terminalId: string | null`, and `spawnNode` must branch
- `worktreePath` / `branch` need the same treatment
- `startMission` needs a repo-free path that skips the worktree provisioning
- a non-PTY execution channel for headless nodes, or the node has nothing to run in

**Please size that in RESULT.md as an explicit prerequisite on the mission lane**, and
note it changes the lane calculus: with headless nodes unbuilt, *every* automation today
is tool-lane by necessity rather than by judgement — which makes your §2 governance rule
("lane declared in the catalogue, never inferred") the thing standing between us and
silently shipping missions later without the prerequisite.

I am not asking you to redesign around this. I am asking you to price it.

---

## 2. Two corrections to your Q2 design, both verified

**(a) The two trigger registries are NOT both live.** Your 3.1 finding is right that they
disagree, and right that nothing persisted references either. Confirming the stronger
form: the **canonical** one is `src/components/ai/automations/data/triggerRegistry.ts`;
the `legacy` one is `src/components/ai/automation/triggerRegistry.ts` and **no file
imports it** other than `nlParser.ts`. It is not a second live catalogue, it is one dead
file. Your deprecation map is still worth writing, but the cost is one delete, not a
migration.

**(b) Your `notify` tier mapping needs one addition.** You put `notify` in "benign" and
`log` in "benign". Both correct. But note `notify` executes via Electron's native
`Notification` — it is **category (ii)** in your own taxonomy, "a native main-process
capability with no IPC counterpart". So it is the *only* executor that needs **no
extraction at all**, which makes it the cheapest possible first executor and the right
one to build first to prove the runner end-to-end before any closure is touched. I would
sequence: `notify` → prove bus+matcher+run+WAL → *then* `goal:create` as the first
extraction. Does sequencing the cheapest-first change your priority-queue design, or is
priority orthogonal to build order?

---

## 3. The REQUEST — verbatim

You asked for one thing. Here it is: `startMission()`, the `Mission` / `ConductorNode` /
`SessionSpec` interfaces, and the `conductor_templates` row shape.

**`conductor_templates`** (columns, from `src/main.ts`):

```sql
CREATE TABLE IF NOT EXISTS conductor_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  roles_json TEXT NOT NULL,
  boundaries_json TEXT DEFAULT '[]',
  budget_estimate_tokens INTEGER DEFAULT 500000,
  budget_estimate_cost REAL DEFAULT 25.0,
  expected_duration_min INTEGER DEFAULT 60,
  workflow_json TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Example row: none exist.** `conductor_templates` has no seeded rows — `is_builtin`
defaults to 0 and nothing inserts any. So `engineer-workflow`'s `templateId` branch is
currently dead in practice; every mission runs on `defaultRoles`. Worth knowing before you
model template storage, because it means **the template schema is unconstrained by
existing data** — you are free, which is rare.

### `startMission.ts`

```ts
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { SignalingBus, ConductorSignal } from '../../lib/signaling/SignalingBus';

export type ConductorRole = 'director' | 'planner' | 'worker' | 'qa' | 'auditor' | 'resolver';
export type ConductorStatus = 'pending' | 'spawning' | 'running' | 'blocked' | 'awaiting-review' | 'done' | 'failed' | 'killed';
export type AutonomyLevel = 'L2' | 'L3' | 'L4';
export type EscalationReason = 'policy' | 'budget' | 'confidence' | 'blast-radius' | 'merge-conflict' | 'goal-proposal';
export type EscalationDecision = 'approved' | 'rejected';

export interface SessionSpec {
  session_id: string;
  parent: string | null;
  scope: { type: 'mission' | 'subtask'; page: string; tab: string };
  objective: string;
  output_contract: string;
  tools: string[];
  boundaries: string[];
  budget: { tokens: number; wall_clock_min: number; max_retries: number };
  recursion: { can_spawn_children: boolean; max_depth: number };
}

export interface ConductorNode {
  id: string;
  missionId: string;
  parentId: string | null;
  role: ConductorRole;
  agentType: string;
  terminalId: string;
  worktreePath: string;
  branch: string;
  objective: string;
  status: ConductorStatus;
  depth: number;
  retries: number;
  boundaries: string[];
  createdAt: number;
  lastActivityAt: number;
  budgetWarned?: boolean;
}

export interface ConductorMessage {
  id: string;
  missionId: string;
  ts: number;
  from: string;
  to: string;
  type: 'TASK' | 'REPORT' | 'ESCALATE' | 'DIRECTIVE' | 'MERGE_OK' | 'MERGE_CONFLICT' | 'INFO';
  summary: string;
  payload?: any;
}

export interface EscalationItem {
  id: string;
  missionId: string;
  nodeId: string | null;
  reason: EscalationReason;
  detail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  decidedAt?: number;
  note?: string;
}

export interface PendingChild {
  parentId: string;
  role: ConductorRole;
  objective: string;
  boundaries: string[];
  queuedAt: number;
}

interface Mission {
  id: string;
  repoRoot: string;
  objective: string;
  agentType: string;
  autonomyLevel: AutonomyLevel;
  status: 'running' | 'paused' | 'killed';
  userBranch: string;
  integrationBranch: string;
  integrationWorktreePath: string;
  nodes: Map<string, ConductorNode>;
  messages: ConductorMessage[];
  escalations: EscalationItem[];
  pendingChildren: PendingChild[];
  mergeQueue: string[];
  merging: boolean;
  lastAuditAt: number;
  createdAt: number;
  seq: number;
  /**
   * Max concurrent workers before the mission counts as crowded.
   * Optional: a mission created before this field existed reads as uncapped, and
   * `crowdPressure` then reports `crowded: false` rather than inventing a number.
   */
  capacity?: number;
}

export interface ConductorHost {
  spawnAgentTerminal: (id: string, cwd: string, cols: number, rows: number, agentType?: string) => Promise<any>;
  writeTerminal: (id: string, data: string) => any;
  killTerminal: (id: string) => any;
  isAgentReady: (id: string) => boolean;
  broadcast: (event: string, ...args: any[]) => void;
  onSignal?: (sig: ConductorSignal) => void;
  onMessage?: (msg: ConductorMessage) => void;
}

const CONDUCTOR_DIR = '.conductor';
const TICK_MS = 3000;
const AUDIT_COOLDOWN_MS = 20000;
const READY_TIMEOUT_MS = 45000;
const BUDGET_WALL_MS = 30 * 60 * 1000;
const ACTIVE_STATUSES: ConductorStatus[] = ['pending', 'spawning', 'running', 'blocked', 'awaiting-review'];

const MSG_SIGNAL_MAP: Record<ConductorMessage['type'], SignalType> = {
  TASK: 'node.spawned',
  REPORT: 'review.completed',
  ESCALATE: 'escalation.raised',
  DIRECTIVE: 'directive.sent',
  MERGE_OK: 'merge.ok',
  MERGE_CONFLICT: 'merge.conflict',
  INFO: 'signal.in',
};

function nowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class ConductorService {
  private host: ConductorHost;
  private missions: Map<string, Mission> = new Map();
  private tickHandle: any = null;
  private bus = new SignalingBus();

  constructor(host: ConductorHost) {
    this.host = host;
    this.tickHandle = setInterval(() => { this.tick().catch((e) => this.log('tick error: ' + e?.message)); }, TICK_MS);
    if (host.onSignal) this.bus.on((sig) => { try { host.onSignal!(sig); } catch { } });
    if (host.onMessage) this.bus.on((sig) => { if (sig.type === 'signal.in') try { host.onMessage!(sig.payload); } catch { } });
  }

  /** Subscribe to orchestration signals (renderer uses this for live UI). */
  onSignal(cb: (s: ConductorSignal) => void): () => void {
    return this.bus.on(cb);
  }

  /** Subscribe to agent messages (mirrors conductor:message broadcast). */
  onMessage(cb: (m: ConductorMessage) => void): () => void {
    return this.bus.on((sig) => { if (sig.type === 'signal.in') try { cb(sig.payload); } catch { } });
  }

  /** Emit an internal signal and broadcast it to the renderer. */
  emitSignal(signal: ConductorSignal): void {
    this.bus.emit(signal);
    try { this.host.broadcast('conductor:signal', signal); } catch { }
  }

  /** Handle a signal coming from outside (e.g. a renderer directive). */
  handleSignal(sig: ConductorSignal): void {
    this.bus.emit({ ...sig, type: 'signal.in' });
  }

  listMissions() {
    return Array.from(this.missions.values()).map((m) => this.summarize(m));
  }

  getSnapshot(missionId: string) {
    const m = this.missions.get(missionId);
    if (!m) return null;
    return {
      id: m.id,
      repoRoot: m.repoRoot,
      objective: m.objective,
      agentType: m.agentType,
      autonomyLevel: m.autonomyLevel,
      status: m.status,
      userBranch: m.userBranch,
      integrationBranch: m.integrationBranch,
      nodes: Array.from(m.nodes.values()),
      messages: m.messages.slice(-200),
      escalations: m.escalations,
      pendingChildren: m.pendingChildren,
      createdAt: m.createdAt,
    };
  }

async startMission(opts: {
```

### `interfaces.ts`

```ts
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { SignalingBus, ConductorSignal } from '../../lib/signaling/SignalingBus';

export type ConductorRole = 'director' | 'planner' | 'worker' | 'qa' | 'auditor' | 'resolver';
export type ConductorStatus = 'pending' | 'spawning' | 'running' | 'blocked' | 'awaiting-review' | 'done' | 'failed' | 'killed';
export type AutonomyLevel = 'L2' | 'L3' | 'L4';
export type EscalationReason = 'policy' | 'budget' | 'confidence' | 'blast-radius' | 'merge-conflict' | 'goal-proposal';
export type EscalationDecision = 'approved' | 'rejected';

export interface SessionSpec {
  session_id: string;
  parent: string | null;
  scope: { type: 'mission' | 'subtask'; page: string; tab: string };
  objective: string;
  output_contract: string;
  tools: string[];
  boundaries: string[];
  budget: { tokens: number; wall_clock_min: number; max_retries: number };
  recursion: { can_spawn_children: boolean; max_depth: number };
}

export interface ConductorNode {
  id: string;
  missionId: string;
  parentId: string | null;
  role: ConductorRole;
  agentType: string;
  terminalId: string;
  worktreePath: string;
  branch: string;
  objective: string;
  status: ConductorStatus;
  depth: number;
  retries: number;
  boundaries: string[];
  createdAt: number;
  lastActivityAt: number;
  budgetWarned?: boolean;
}

export interface ConductorMessage {
  id: string;
  missionId: string;
  ts: number;
  from: string;
  to: string;
  type: 'TASK' | 'REPORT' | 'ESCALATE' | 'DIRECTIVE' | 'MERGE_OK' | 'MERGE_CONFLICT' | 'INFO';
  summary: string;
  payload?: any;
}

export interface EscalationItem {
  id: string;
  missionId: string;
  nodeId: string | null;
  reason: EscalationReason;
  detail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  decidedAt?: number;
  note?: string;
}

export interface PendingChild {
  parentId: string;
  role: ConductorRole;
  objective: string;
  boundaries: string[];
  queuedAt: number;
}

interface Mission {
  id: string;
  repoRoot: string;
  objective: string;
  agentType: string;
  autonomyLevel: AutonomyLevel;
  status: 'running' | 'paused' | 'killed';
  userBranch: string;
  integrationBranch: string;
  integrationWorktreePath: string;
  nodes: Map<string, ConductorNode>;
  messages: ConductorMessage[];
  escalations: EscalationItem[];
  pendingChildren: PendingChild[];
  mergeQueue: string[];
  merging: boolean;
  lastAuditAt: number;
  createdAt: number;
  seq: number;
  /**
   * Max concurrent workers before the mission counts as crowded.
   * Optional: a mission created before this field existed reads as uncapped, and
   * `crowdPressure` then reports `crowded: false` rather than inventing a number.
   */
  capacity?: number;
}

export interface ConductorHost {
  spawnAgentTerminal: (id: string, cwd: string, cols: number, rows: number, agentType?: string) => Promise<any>;
  writeTerminal: (id: string, data: string) => any;
  killTerminal: (id: string) => any;
  isAgentReady: (id: string) => boolean;
  broadcast: (event: string, ...args: any[]) => void;
  onSignal?: (sig: ConductorSignal) => void;
  onMessage?: (msg: ConductorMessage) => void;
}

const CONDUCTOR_DIR = '.conductor';
const TICK_MS = 3000;
const AUDIT_COOLDOWN_MS = 20000;
const READY_TIMEOUT_MS = 45000;
const BUDGET_WALL_MS = 30 * 60 * 1000;
```

---

## 4. What I need from you

1. **Price the headless-node prerequisite** (§1) and state whether it is a prerequisite
   for the mission lane generally or only for automation-fired missions.
2. **Sequencing answer** (§2b) — does cheapest-first break the priority-queue design?
3. **`RESULT.md`**, with: the (d) extraction policy verbatim, the lane-split criterion,
   the catalogue-merge outcome, the three-table schema, the WAL-then-dispatch bus, and the
   headless prerequisite called out as a named work item rather than an assumption.

Next, already queued: the ~7 IPC closures behind your action-mapping table, to fill its
`?` column and fix the extraction budget.

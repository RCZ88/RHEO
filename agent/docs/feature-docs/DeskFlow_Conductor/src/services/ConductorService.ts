import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

// ============================================================================
// Conductor: autonomous multi-agent orchestration service
// ============================================================================

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
}

export interface ConductorHost {
  spawnAgentTerminal: (id: string, cwd: string, cols: number, rows: number, agentType?: string) => Promise<any>;
  writeTerminal: (id: string, data: string) => any;
  killTerminal: (id: string) => any;
  isAgentReady: (id: string) => boolean;
  broadcast: (event: string, ...args: any[]) => void;
}

const CONDUCTOR_DIR = '.conductor';
const TICK_MS = 3000;
const AUDIT_COOLDOWN_MS = 20000;
const READY_TIMEOUT_MS = 45000;
const ACTIVE_STATUSES: ConductorStatus[] = ['pending', 'spawning', 'running', 'blocked', 'awaiting-review'];

function nowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export class ConductorService {
  private host: ConductorHost;
  private missions: Map<string, Mission> = new Map();
  private tickHandle: any = null;

  constructor(host: ConductorHost) {
    this.host = host;
    this.tickHandle = setInterval(() => { this.tick().catch((e) => this.log('tick error: ' + e?.message)); }, TICK_MS);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

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

  async startMission(opts: { repoRoot: string; objective: string; agentType: string; autonomyLevel?: AutonomyLevel }) {
    const repoRoot = this.normalizeRoot(opts.repoRoot);
    this.ensureRepo(repoRoot);
    const missionId = nowId('mission');
    let userBranch = 'main';
    try { userBranch = this.git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'main'; } catch { }

    const integrationBranch = `conductor/${missionId}/integration`;
    const worktreesRoot = path.join(repoRoot, '.conductor-worktrees', missionId);
    const integrationWorktreePath = path.join(worktreesRoot, '_integration');

    this.ensureGitignoreEntry(repoRoot, '.conductor-worktrees/');
    this.git(repoRoot, ['branch', integrationBranch, 'HEAD']);
    fs.mkdirSync(worktreesRoot, { recursive: true });
    this.git(repoRoot, ['worktree', 'add', integrationWorktreePath, integrationBranch]);

    const mission: Mission = {
      id: missionId,
      repoRoot,
      objective: opts.objective,
      agentType: opts.agentType,
      autonomyLevel: opts.autonomyLevel || 'L3',
      status: 'running',
      userBranch,
      integrationBranch,
      integrationWorktreePath,
      nodes: new Map(),
      messages: [],
      escalations: [],
      pendingChildren: [],
      mergeQueue: [],
      merging: false,
      lastAuditAt: 0,
      createdAt: Date.now(),
      seq: 0,
    };
    this.missions.set(missionId, mission);

    await this.spawnNode(mission, {
      parentId: null,
      role: 'director',
      objective: opts.objective,
      boundaries: ['**'],
      depth: 0,
    });

    this.emit(mission);
    return this.getSnapshot(missionId);
  }

  pauseMission(missionId: string) {
    const m = this.req(missionId);
    m.status = 'paused';
    this.msg(m, 'system', 'boss', 'INFO', 'Mission paused.');
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  resumeMission(missionId: string) {
    const m = this.req(missionId);
    m.status = 'running';
    this.msg(m, 'system', 'boss', 'INFO', 'Mission resumed.');
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  killMission(missionId: string) {
    const m = this.req(missionId);
    m.status = 'killed';
    for (const node of m.nodes.values()) {
      if (ACTIVE_STATUSES.includes(node.status)) {
        try { this.host.killTerminal(node.terminalId); } catch { }
        node.status = 'killed';
      }
    }
    this.msg(m, 'system', 'boss', 'INFO', 'Mission killed. Worktrees preserved for inspection.');
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  setAutonomy(missionId: string, level: AutonomyLevel) {
    const m = this.req(missionId);
    m.autonomyLevel = level;
    this.msg(m, 'boss', 'conductor', 'DIRECTIVE', `Autonomy set to ${level}.`);
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  sendDirective(missionId: string, text: string) {
    const m = this.req(missionId);
    const director = Array.from(m.nodes.values()).find((n) => n.role === 'director' && ACTIVE_STATUSES.includes(n.status));
    if (director) {
      try { this.host.writeTerminal(director.terminalId, `\n[BOSS DIRECTIVE] ${text}\n`); } catch { }
    }
    this.msg(m, 'boss', director ? director.id : 'conductor', 'DIRECTIVE', text);
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  resolveEscalation(missionId: string, escalationId: string, decision: EscalationDecision, note?: string) {
    const m = this.req(missionId);
    const esc = m.escalations.find((e) => e.id === escalationId);
    if (!esc) throw new Error('Escalation not found');
    esc.status = decision;
    esc.decidedAt = Date.now();
    esc.note = note;
    this.applyEscalationDecision(m, esc);
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  promoteIntegration(missionId: string) {
    const m = this.req(missionId);
    this.git(m.repoRoot, ['merge', '--no-ff', '-m', `Conductor: promote mission ${m.id}`, m.integrationBranch]);
    this.msg(m, 'conductor', 'boss', 'MERGE_OK', `Integration branch merged into ${m.userBranch}.`);
    this.emit(m);
    return this.getSnapshot(missionId);
  }

  disposeAll() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    for (const m of this.missions.values()) {
      for (const node of m.nodes.values()) {
        if (ACTIVE_STATUSES.includes(node.status)) {
          try { this.host.killTerminal(node.terminalId); } catch { }
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Tick loop
  // ---------------------------------------------------------------------

  private async tick() {
    for (const m of this.missions.values()) {
      if (m.status !== 'running') continue;
      for (const node of Array.from(m.nodes.values())) {
        if (!ACTIVE_STATUSES.includes(node.status)) continue;
        try { await this.pollNode(m, node); } catch (e: any) { this.log(`pollNode ${node.id} error: ${e?.message}`); }
      }
      this.processBlocked(m);
      await this.processMergeQueue(m);
      await this.maybeAudit(m);
    }
  }

  private async pollNode(mission: Mission, node: ConductorNode) {
    const dir = path.join(node.worktreePath, CONDUCTOR_DIR);
    if (node.status === 'spawning') {
      if (this.host.isAgentReady(node.terminalId)) {
        node.status = 'running';
        node.lastActivityAt = Date.now();
        this.host.writeTerminal(node.terminalId, this.buildPrompt(mission, node));
        this.msg(mission, 'conductor', node.id, 'TASK', `Briefed ${node.role}: ${node.objective}`);
      } else if (Date.now() - node.createdAt > READY_TIMEOUT_MS) {
        node.status = 'blocked';
        this.raiseEscalation(mission, node.id, 'confidence', `${node.role} agent (${node.id}) did not become ready in time.`);
      }
      return;
    }

    const reportPath = path.join(dir, 'REPORT.json');
    const escalatePath = path.join(dir, 'ESCALATE.json');
    const planPath = path.join(dir, 'PLAN.json');
    const goalsPath = path.join(dir, 'NEW_GOALS.json');

    if (fs.existsSync(escalatePath)) {
      const data = this.readJson(escalatePath);
      if (data) {
        this.raiseEscalation(mission, node.id, (data.reason || 'confidence') as EscalationReason, data.detail || 'Agent requested help.');
        node.status = 'blocked';
        try { fs.renameSync(escalatePath, escalatePath + '.handled'); } catch { }
      }
    }

    if (fs.existsSync(planPath)) {
      const data = this.readJson(planPath);
      if (data && Array.isArray(data.subtasks)) {
        for (const sub of data.subtasks) {
          this.dispatchChild(mission, node, {
            role: (sub.role || 'worker') as ConductorRole,
            objective: String(sub.objective || 'Unnamed subtask'),
            boundaries: Array.isArray(sub.boundaries) ? sub.boundaries : ['**'],
          });
        }
        node.status = 'awaiting-review';
      }
      try { fs.renameSync(planPath, planPath + '.handled'); } catch { }
    }

    if (fs.existsSync(goalsPath)) {
      const data = this.readJson(goalsPath);
      if (data && Array.isArray(data.goals)) {
        for (const g of data.goals) this.proposeGoal(mission, node, String(g));
      }
      try { fs.renameSync(goalsPath, goalsPath + '.handled'); } catch { }
    }

    if (fs.existsSync(reportPath)) {
      const data = this.readJson(reportPath);
      node.lastActivityAt = Date.now();
      const success = !data || data.success !== false;
      if (success) {
        node.status = node.role === 'worker' || node.role === 'qa' || node.role === 'resolver' ? 'done' : 'awaiting-review';
        this.msg(mission, node.id, node.parentId || 'conductor', 'REPORT', data?.summary || 'Reported completion.');
        if (node.role === 'worker') this.queueMerge(mission, node.id);
        if (node.parentId === null) {
          // Director finished top-level mission objective
          node.status = 'done';
        }
      } else {
        node.retries += 1;
        if (node.retries > 2) {
          node.status = 'failed';
          this.raiseEscalation(mission, node.id, 'confidence', `${node.role} (${node.id}) failed after ${node.retries} attempts: ${data?.summary || 'no details'}`);
        } else {
          node.status = 'running';
          this.host.writeTerminal(node.terminalId, `\n[Conductor] Attempt ${node.retries} did not meet the output contract. Please retry: ${data?.summary || 'unspecified issue'}\n`);
        }
      }
      try { fs.renameSync(reportPath, reportPath + '.handled'); } catch { }
    }
  }

  private processBlocked(mission: Mission) {
    if (mission.pendingChildren.length === 0) return;
    const still: PendingChild[] = [];
    for (const pending of mission.pendingChildren) {
      const active = Array.from(mission.nodes.values()).filter((n) => ACTIVE_STATUSES.includes(n.status));
      const overlap = this.findOverlap(pending.boundaries, active.map((n) => n.boundaries));
      if (overlap) { still.push(pending); continue; }
      const parent = mission.nodes.get(pending.parentId);
      if (!parent) continue;
      this.spawnNode(mission, {
        parentId: pending.parentId,
        role: pending.role,
        objective: pending.objective,
        boundaries: pending.boundaries,
        depth: parent.depth + 1,
      }).catch((e) => this.log('spawn from queue failed: ' + e?.message));
    }
    mission.pendingChildren = still;
  }

  private async maybeAudit(mission: Mission) {
    const anyActive = Array.from(mission.nodes.values()).some((n) => ACTIVE_STATUSES.includes(n.status));
    if (anyActive) return;
    if (Date.now() - mission.lastAuditAt < AUDIT_COOLDOWN_MS) return;
    if (mission.pendingChildren.length > 0) return;
    mission.lastAuditAt = Date.now();

    // Never-idle self-goal-generation: the mission never truly "finishes" a
    // single static goal. Once the tree goes quiet, spawn an Auditor whose
    // job is to inspect the integration worktree, test/read the codebase,
    // and propose the next round of goals back to the Director/Boss.
    await this.spawnNode(mission, {
      parentId: null,
      role: 'auditor',
      objective: `Audit the current state of the integration branch against the mission objective ("${mission.objective}"). Run any available tests/build, read changed files, and propose the next concrete improvements or confirm completion.`,
      boundaries: ['**'],
      depth: 0,
      useIntegrationWorktree: true,
    });
    this.msg(mission, 'conductor', 'boss', 'INFO', 'Tree went idle — auditor dispatched to find the next goal.');
  }

  // ---------------------------------------------------------------------
  // Merge coordination
  // ---------------------------------------------------------------------

  private queueMerge(mission: Mission, nodeId: string) {
    if (!mission.mergeQueue.includes(nodeId)) mission.mergeQueue.push(nodeId);
  }

  private async processMergeQueue(mission: Mission) {
    if (mission.merging) return;
    const nextId = mission.mergeQueue.shift();
    if (!nextId) return;
    const node = mission.nodes.get(nextId);
    if (!node) return;
    mission.merging = true;
    try {
      this.git(mission.integrationWorktreePath, ['merge', '--no-ff', '-m', `Conductor: merge ${node.role} ${node.id}`, node.branch]);
      this.msg(mission, 'conductor', node.id, 'MERGE_OK', `Merged ${node.id} into integration branch cleanly.`);
      this.cleanupWorktree(mission, node);
    } catch (e: any) {
      this.msg(mission, 'conductor', node.id, 'MERGE_CONFLICT', `Merge conflict integrating ${node.id}. Dispatching a resolver.`);
      try { this.git(mission.integrationWorktreePath, ['merge', '--abort']); } catch { }
      await this.spawnResolver(mission, node);
    } finally {
      mission.merging = false;
    }
  }

  private cleanupWorktree(mission: Mission, node: ConductorNode) {
    try { this.git(mission.repoRoot, ['worktree', 'remove', '--force', node.worktreePath]); } catch { }
  }

  private async spawnResolver(mission: Mission, conflictedNode: ConductorNode) {
    await this.spawnNode(mission, {
      parentId: conflictedNode.parentId,
      role: 'resolver',
      objective: `Resolve the git merge conflict between the integration branch and branch "${conflictedNode.branch}" (work originally done for: ${conflictedNode.objective}). Preserve both sides' intent; do not silently drop changes.`,
      boundaries: conflictedNode.boundaries,
      depth: conflictedNode.depth,
      mergeSourceBranch: conflictedNode.branch,
    });
  }

  // ---------------------------------------------------------------------
  // Escalations & goals
  // ---------------------------------------------------------------------

  private raiseEscalation(mission: Mission, nodeId: string | null, reason: EscalationReason, detail: string) {
    const autoApprove = mission.autonomyLevel === 'L4' && (reason === 'confidence' || reason === 'goal-proposal');
    const esc: EscalationItem = {
      id: nowId('esc'),
      missionId: mission.id,
      nodeId,
      reason,
      detail,
      status: autoApprove ? 'approved' : 'pending',
      createdAt: Date.now(),
    };
    mission.escalations.push(esc);
    this.msg(mission, nodeId || 'conductor', 'boss', 'ESCALATE', detail);
    if (autoApprove) this.applyEscalationDecision(mission, esc);
  }

  private proposeGoal(mission: Mission, fromNode: ConductorNode, goal: string) {
    this.raiseEscalation(mission, fromNode.id, 'goal-proposal', goal);
  }

  private applyEscalationDecision(mission: Mission, esc: EscalationItem) {
    if (esc.reason === 'goal-proposal' && esc.status === 'approved') {
      this.spawnNode(mission, {
        parentId: null,
        role: 'director',
        objective: esc.detail,
        boundaries: ['**'],
        depth: 0,
        useIntegrationWorktree: true,
      }).catch((e) => this.log('goal spawn failed: ' + e?.message));
      this.msg(mission, 'boss', 'conductor', 'DIRECTIVE', `Approved new goal: ${esc.detail}`);
      return;
    }
    if (!esc.nodeId) return;
    const node = mission.nodes.get(esc.nodeId);
    if (!node) return;
    if (esc.status === 'approved') {
      node.status = 'running';
      try { this.host.writeTerminal(node.terminalId, `\n[Boss approved] ${esc.note || 'Proceed.'}\n`); } catch { }
    } else {
      node.status = 'failed';
      try { this.host.writeTerminal(node.terminalId, `\n[Boss rejected] ${esc.note || 'Stop this line of work.'}\n`); } catch { }
    }
  }

  // ---------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------

  private dispatchChild(mission: Mission, parent: ConductorNode, req: { role: ConductorRole; objective: string; boundaries: string[] }) {
    const active = Array.from(mission.nodes.values()).filter((n) => ACTIVE_STATUSES.includes(n.status));
    const overlap = this.findOverlap(req.boundaries, active.map((n) => n.boundaries));
    if (overlap) {
      mission.pendingChildren.push({ parentId: parent.id, role: req.role, objective: req.objective, boundaries: req.boundaries, queuedAt: Date.now() });
      this.msg(mission, parent.id, 'conductor', 'INFO', `Queued ${req.role} task — file boundary overlap with an active node (${overlap}).`);
      return;
    }
    this.spawnNode(mission, {
      parentId: parent.id,
      role: req.role,
      objective: req.objective,
      boundaries: req.boundaries,
      depth: parent.depth + 1,
    }).catch((e) => this.log('dispatchChild spawn failed: ' + e?.message));
  }

  private async spawnNode(mission: Mission, opts: {
    parentId: string | null;
    role: ConductorRole;
    objective: string;
    boundaries: string[];
    depth: number;
    useIntegrationWorktree?: boolean;
    mergeSourceBranch?: string;
  }) {
    const parent = opts.parentId ? mission.nodes.get(opts.parentId) : null;
    if (parent && parent.depth >= 4) {
      this.raiseEscalation(mission, parent.id, 'policy', 'Max recursion depth reached; refusing to spawn further children.');
      return;
    }

    const nodeId = nowId(opts.role);
    const branch = `conductor/${mission.id}/${nodeId}`;
    const worktreePath = opts.useIntegrationWorktree
      ? mission.integrationWorktreePath
      : path.join(mission.repoRoot, '.conductor-worktrees', mission.id, nodeId);

    if (!opts.useIntegrationWorktree) {
      fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
      this.git(mission.repoRoot, ['worktree', 'add', '-b', branch, worktreePath, mission.integrationBranch]);
    }

    const node: ConductorNode = {
      id: nodeId,
      missionId: mission.id,
      parentId: opts.parentId,
      role: opts.role,
      agentType: mission.agentType,
      terminalId: `conductor_${nodeId}`,
      worktreePath,
      branch: opts.useIntegrationWorktree ? mission.integrationBranch : branch,
      objective: opts.objective,
      status: 'spawning',
      depth: opts.depth,
      retries: 0,
      boundaries: opts.boundaries,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    mission.nodes.set(nodeId, node);

    const spec: SessionSpec = {
      session_id: nodeId,
      parent: opts.parentId,
      scope: { type: opts.parentId ? 'subtask' : 'mission', page: mission.repoRoot, tab: opts.role },
      objective: opts.objective,
      output_contract: 'Write .conductor/REPORT.json with { success: boolean, summary: string } when finished. Use .conductor/ESCALATE.json if you need help. Use .conductor/PLAN.json to hand off subtasks. Use .conductor/NEW_GOALS.json to propose follow-up goals.',
      tools: ['fs', 'git', 'terminal'],
      boundaries: opts.boundaries,
      budget: { tokens: 200000, wall_clock_min: 30, max_retries: 2 },
      recursion: { can_spawn_children: opts.role === 'director' || opts.role === 'planner', max_depth: 4 },
    };
    const confDir = path.join(worktreePath, CONDUCTOR_DIR);
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(path.join(confDir, 'SESSION.json'), JSON.stringify(spec, null, 2));
    for (const f of ['REPORT.json', 'ESCALATE.json', 'PLAN.json', 'NEW_GOALS.json']) {
      try { if (fs.existsSync(path.join(confDir, f))) fs.unlinkSync(path.join(confDir, f)); } catch { }
    }

    this.msg(mission, opts.parentId || 'conductor', nodeId, 'TASK', `Spawned ${opts.role}: ${opts.objective}`);
    await this.host.spawnAgentTerminal(node.terminalId, worktreePath, 80, 24, mission.agentType);
    this.emit(mission);
    return node;
  }

  private buildPrompt(mission: Mission, node: ConductorNode): string {
    const contracts: Record<ConductorRole, string> = {
      director: 'You are the DIRECTOR agent for this mission. Break the objective into subtasks for planner/worker/qa agents and write them to .conductor/PLAN.json as { "subtasks": [{ "role": "worker", "objective": "...", "boundaries": ["path/glob"] }] }. If the whole objective is small enough to do yourself, just do it and write .conductor/REPORT.json.',
      planner: 'You are a PLANNER agent. Decompose your objective into concrete, non-overlapping file-scoped subtasks and write .conductor/PLAN.json.',
      worker: 'You are a WORKER agent. Complete the objective within your declared file boundaries only. When done, write .conductor/REPORT.json as { "success": true, "summary": "..." }.',
      qa: 'You are a QA agent. Verify the work described in your objective (run tests/build/lint if available). Write .conductor/REPORT.json with your findings.',
      auditor: 'You are the AUDITOR agent. Inspect the current state of the repo, run tests/build if possible, and decide: (a) the mission objective is fully met — write .conductor/REPORT.json {"success":true}; or (b) more work is needed — write concrete next goals to .conductor/NEW_GOALS.json as { "goals": ["..."] }.',
      resolver: 'You are a RESOLVER agent handling a git merge conflict. Merge the source branch into your current branch, resolve conflicts preserving intent from both sides, then write .conductor/REPORT.json.',
    };
    const lines = [
      `[Conductor Session ${node.id}] Role: ${node.role}`,
      `Mission objective: ${mission.objective}`,
      `Your objective: ${node.objective}`,
      `File boundaries: ${node.boundaries.join(', ')}`,
      contracts[node.role],
      'Read .conductor/SESSION.json for the full machine-readable spec.',
    ];
    return '\n' + lines.join('\n') + '\n';
  }

  // ---------------------------------------------------------------------
  // Boundaries / overlap detection
  // ---------------------------------------------------------------------

  private boundariesOverlap(a: string[], b: string[]): boolean {
    for (const pa of a) {
      for (const pb of b) {
        if (pa === '**' || pb === '**') return true;
        const na = pa.replace(/\*+$/, '');
        const nb = pb.replace(/\*+$/, '');
        if (na === nb || na.startsWith(nb) || nb.startsWith(na)) return true;
      }
    }
    return false;
  }

  private findOverlap(boundaries: string[], others: string[][]): string | null {
    for (const other of others) {
      if (this.boundariesOverlap(boundaries, other)) return other.join(',');
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Git plumbing
  // ---------------------------------------------------------------------

  private git(cwd: string, args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  }

  private ensureRepo(repoRoot: string) {
    try {
      this.git(repoRoot, ['rev-parse', '--is-inside-work-tree']);
    } catch {
      throw new Error('Selected folder is not a git repository. Conductor requires git for branch isolation.');
    }
  }

  private ensureGitignoreEntry(repoRoot: string, entry: string) {
    const gi = path.join(repoRoot, '.gitignore');
    let content = '';
    try { content = fs.readFileSync(gi, 'utf-8'); } catch { }
    if (!content.split(/\r?\n/).includes(entry)) {
      fs.writeFileSync(gi, content + (content.endsWith('\n') || content === '' ? '' : '\n') + entry + '\n');
    }
  }

  private normalizeRoot(root: string): string {
    return path.resolve(root);
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private req(missionId: string): Mission {
    const m = this.missions.get(missionId);
    if (!m) throw new Error('Mission not found: ' + missionId);
    return m;
  }

  private readJson(p: string): any {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
  }

  private summarize(m: Mission) {
    const nodes = Array.from(m.nodes.values());
    return {
      id: m.id,
      repoRoot: m.repoRoot,
      objective: m.objective,
      status: m.status,
      autonomyLevel: m.autonomyLevel,
      nodeCount: nodes.length,
      activeCount: nodes.filter((n) => ACTIVE_STATUSES.includes(n.status)).length,
      pendingEscalations: m.escalations.filter((e) => e.status === 'pending').length,
      createdAt: m.createdAt,
    };
  }

  private msg(mission: Mission, from: string, to: string, type: ConductorMessage['type'], summary: string, payload?: any) {
    const m: ConductorMessage = { id: nowId('msg'), missionId: mission.id, ts: Date.now(), from, to, type, summary, payload };
    mission.messages.push(m);
    if (mission.messages.length > 500) mission.messages = mission.messages.slice(-500);
    try { this.host.broadcast('conductor:message', m); } catch { }
  }

  private emit(mission: Mission) {
    try { this.host.broadcast('conductor:snapshot', this.getSnapshot(mission.id)); } catch { }
  }

  private log(text: string) {
    try { console.error('[Conductor] ' + text); } catch { }
  }
}

import type { WorkspaceState, ModuleState, ComponentState, Decision, SessionSnapshot } from './ContextStateTypes';

const STATE_FILE = 'agent/workspace-state.json';
const STATE_MD = 'agent/WORKSPACE_STATE.md';

/**
 * Single source of truth for "what's implemented, what's not"
 * Updated by the agent after every meaningful change
 */
export class WorkspaceStateService {
  private state: WorkspaceState;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.state = this.loadState();
  }

  // ─── CRUD: Modules ─────────────────────────────────────────────

  addModule(name: string, dependencies: string[] = []): void {
    if (this.state.modules[name]) return;
    this.state.modules[name] = {
      status: 'not_started',
      components: {},
      dependencies
    };
    this.persist();
  }

  addComponent(moduleName: string, componentId: string, initial: Partial<ComponentState> = {}): void {
    const mod = this.state.modules[moduleName];
    if (!mod) throw new Error(`Module ${moduleName} not found`);
    mod.components[componentId] = {
      status: 'todo',
      ...initial
    };
    this.recalcModuleStatus(moduleName);
    this.persist();
  }

  updateComponent(moduleName: string, componentId: string, update: Partial<ComponentState>): void {
    const mod = this.state.modules[moduleName];
    if (!mod?.components[componentId]) return;
    Object.assign(mod.components[componentId], update);
    this.recalcModuleStatus(moduleName);
    this.persist();
  }

  private recalcModuleStatus(moduleName: string): void {
    const mod = this.state.modules[moduleName];
    const statuses = Object.values(mod.components).map(c => c.status);

    if (statuses.every(s => s === 'done')) mod.status = 'done';
    else if (statuses.some(s => s === 'in_progress')) mod.status = 'in_progress';
    else if (statuses.some(s => s === 'blocked')) mod.status = 'blocked';
    else mod.status = 'not_started';
  }

  // ─── Decisions ─────────────────────────────────────────────────

  recordDecision(decision: Omit<Decision, 'id' | 'date'>): Decision {
    const d: Decision = {
      id: `dec-${Date.now()}`,
      date: new Date().toISOString(),
      ...decision
    };
    this.state.decisions.push(d);
    this.persist();
    return d;
  }

  supersedeDecision(oldId: string, newDecision: Omit<Decision, 'id' | 'date'>): Decision {
    const old = this.state.decisions.find(d => d.id === oldId);
    if (old) old.superseded_by = `dec-${Date.now()}`;

    const newDec = this.recordDecision(newDecision);
    return newDec;
  }

  // ─── Session Snapshots ───────────────────────────────────────────

  snapshotSession(summary: string, filesModified: string[], decisionsMade: string[], nextSteps: string[]): SessionSnapshot {
    const snap: SessionSnapshot = {
      id: `sess-${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary,
      filesModified,
      decisionsMade,
      nextSteps
    };
    this.state.sessions = [...this.state.sessions.slice(-19), snap];
    this.persist();
    return snap;
  }

  // ─── Queries ───────────────────────────────────────────────────

  getDashboard(): { completion: number; blocked: string[]; inProgress: string[]; recentActivity: SessionSnapshot[] } {
    const allComponents = Object.values(this.state.modules)
      .flatMap(m => Object.entries(m.components).map(([id, c]) => ({ module: m, id, ...c })));

    const total = allComponents.length;
    const done = allComponents.filter(c => c.status === 'done').length;

    return {
      completion: total === 0 ? 0 : Math.round((done / total) * 100),
      blocked: allComponents.filter(c => c.status === 'blocked').map(c => `${c.module}:${c.id} (${c.blocker})`),
      inProgress: allComponents.filter(c => c.status === 'in_progress').map(c => `${c.module}:${c.id}`),
      recentActivity: this.state.sessions.slice(-5)
    };
  }

  getModuleStatus(moduleName: string): ModuleState | null {
    return this.state.modules[moduleName] || null;
  }

  getDecisionHistory(topic?: string): Decision[] {
    const decisions = [...this.state.decisions].reverse();
    return topic ? decisions.filter(d => d.topic.includes(topic)) : decisions;
  }

  getState(): WorkspaceState {
    return this.state;
  }

  // ─── Persistence ────────────────────────────────────────────────

  private loadState(): WorkspaceState {
    try {
      const dapi = (window as any).deskflowAPI;
      if (!dapi?.readProjectFile) return this.getDefaultState();
      const raw = dapi.readProjectFile(STATE_FILE, this.projectPath);
      if (raw?.success && raw.data) return JSON.parse(raw.data);
      return this.getDefaultState();
    } catch {
      return this.getDefaultState();
    }
  }

  private persist(): void {
    this.state.lastUpdated = new Date().toISOString();

    const dapi = (window as any).deskflowAPI;
    if (!dapi?.writeProjectFile) return;

    // Write JSON
    dapi.writeProjectFile(STATE_FILE, JSON.stringify(this.state, null, 2), this.projectPath);

    // Write Markdown mirror
    const md = this.generateMarkdown();
    dapi.writeProjectFile(STATE_MD, md, this.projectPath);
  }

  private generateMarkdown(): string {
    const { modules, decisions, sessions: _sessions } = this.state;
    let md = `# Workspace State\n\n*Last updated: ${this.state.lastUpdated}*\n\n`;

    md += `## Progress Overview\n\n`;
    const dashboard = this.getDashboard();
    md += `- **Completion:** ${dashboard.completion}%\n`;
    md += `- **Blocked:** ${dashboard.blocked.length} items\n`;
    md += `- **In Progress:** ${dashboard.inProgress.length} items\n\n`;

    md += `## Modules\n\n`;
    for (const [name, mod] of Object.entries(modules)) {
      const icon = mod.status === 'done' ? '✅' : mod.status === 'in_progress' ? '🔄' : mod.status === 'blocked' ? '⛔' : '⬜';
      md += `### ${icon} ${name}\n\n`;
      for (const [cid, comp] of Object.entries(mod.components)) {
        const cIcon = comp.status === 'done' ? '✅' : comp.status === 'in_progress' ? '🔄' : comp.status === 'blocked' ? '⛔' : '⬜';
        md += `- ${cIcon} **${cid}**${comp.lines ? ` \`${comp.lines}\`` : ''}${comp.tested ? ' (tested)' : ''}${comp.blocker ? ` — blocked: ${comp.blocker}` : ''}\n`;
      }
      md += '\n';
    }

    md += `## Recent Decisions\n\n`;
    for (const d of decisions.slice(-10).reverse()) {
      md += `### ${d.id} (${d.date.split('T')[0]})\n`;
      md += `- **Topic:** ${d.topic}\n`;
      md += `- **Choice:** ${d.choice}\n`;
      md += `- **Rationale:** ${d.rationale}\n\n`;
    }

    return md;
  }

  private getDefaultState(): WorkspaceState {
    return {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      modules: {},
      decisions: [],
      sessions: []
    };
  }
}

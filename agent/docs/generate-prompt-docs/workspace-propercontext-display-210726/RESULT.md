 I hear you — you want a **single prompt** that gives your AI coding agent enough context about your workspace so it stops asking "what's the project structure?" every session. And you want the **context management system itself** to be visualizable (mind maps, trees) so both you and the AI can see the project state at a glance.

Let me build you a complete prompt + a starter implementation based on your workspace's actual architecture.

---

## The Prompt: `AGENTS.md` / `CLAUDE.md` for Your Workspace

Save this as `AGENTS.md` at your project root. It follows the **AGENTS.md standard**  and the **three-layer persistence model** (context files + agent memory + living specs) :

```markdown
# AGENTS.md — DeskFlow Workspace Context

## 1. PROJECT OVERVIEW

DeskFlow is an **AI-native terminal workspace** — a desktop application (Electron + React + TypeScript) that orchestrates multiple AI coding agents (Claude, Codex, etc.) through a unified terminal + sidebar interface.

**What it does:** Spawn AI agents in xterm.js terminals, manage problems/requests/checklists, track AI usage analytics, manage skills, and coordinate cross-session context.

**Who uses it:** Solo developers running multiple AI agents simultaneously on different tasks.

**Key constraint:** The app must handle 10+ concurrent terminal sessions without losing agent state or context.

---

## 2. TECH STACK & ARCHITECTURE

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Desktop Shell | Electron (main.ts + preload.ts IPC bridge) |
| Terminal Engine | `@xterm/xterm` + `node-pty` (PTY spawning) |
| State Management | React hooks + localStorage + IPC to main process |
| Data Persistence | JSON files + Markdown mirrors in `agent/` directory |
| Layout System | Recursive split-pane tree (custom, not react-split-pane) |
| Drag & Drop | `@dnd-kit/core` (MiniMap tab reordering) |

---

## 3. PROJECT STRUCTURE

```
src/
├── pages/
│   └── TerminalPage.tsx          # (~6000 lines) Main workspace — toolbar, sidebar, terminal tabs
├── components/
│   ├── TerminalWindow.tsx        # xterm pane + recursive split layout
│   ├── TerminalMiniMap.tsx       # Visual layout editor with DnD
│   ├── IssuesWorkspace.tsx       # (49KB) Problems/Requests/Checklists tracker
│   ├── ContextSidebar.tsx        # (37KB) Context management — knowledge systems
│   ├── ContextMaintenanceTab.tsx # (15KB) Context maintenance utilities
│   ├── InstructionPanel.tsx      # Full compose/instruction panel
│   ├── NewSessionDialog.tsx      # Session creation/init
│   ├── AnalyticsDashboard.tsx    # AI usage analytics
│   └── [other dialogs...]
├── services/
│   ├── ProblemsService.ts        # Problems CRUD + MD migration
│   ├── RequestsService.ts        # Requests CRUD + linking
│   ├── ChecklistService.ts       # Checklist CRUD
│   ├── SkillsService.ts          # Skill discovery + parsing
│   ├── ContextService.ts         # Context assembly (6 knowledge systems)
│   └── ContextConfig.ts          # Context types + defaults
├── lib/
│   └── defaults.ts               # DEFAULT_SYSTEM_PROMPT, constants
├── main.ts                       # All IPC handlers (Electron main)
└── preload.ts                    # IPC bridge (Electron preload)
```

---

## 4. CRITICAL ARCHITECTURAL PATTERNS

### 4.1 Agent File System (Dual-Write Pattern)
Every entity has both a **JSON source-of-truth** and a **Markdown mirror** for human readability:

| Entity | JSON File | Markdown Mirror |
|--------|-----------|-----------------|
| Problems | `agent/problems.json` | `agent/PROBLEMS.md` |
| Requests | `agent/requests.json` | `agent/REQUESTS.md` |
| Checklists | `agent/checklists.json` | *(JSON only)* |
| Skills | `agent/skills/*/SKILL.md` | *(Skills folder, read from files)* |

**Rule:** Always write to JSON first, then regenerate the Markdown mirror. The Markdown is for humans; JSON is for the app.

### 4.2 Terminal Lifecycle (5-Step State Machine)
```
[spawning] → (terminal:ready) → [waiting] → (agent:ready) → [ready]
                                  ↓
                            (35s timeout) → [timeout] → (click retry) → [waiting]
```

- `spawnTerminal`: Creates PTY via IPC (`terminal:create`)
- `initializeTerminal`: Waits for PTY ready → writes launch command (`claude\r\n`) → waits for `agent:ready` event → writes system prompt + init content
- `queueOrSend`: Messages queue if agent not ready, flush after `agent:ready`

### 4.3 Context Assembly (6 Knowledge Systems)
At session init, `ContextService.ts` assembles context from togglable systems:

| System | Source Path | Default | Max Tokens |
|--------|-------------|---------|------------|
| LLM Wiki | `<projectPath>/agent/*.md` | ✅ Yes | 2000 |
| Obsidian Skills | `<projectPath>/agent/skills/*/SKILL.md` | ✅ Yes | 500 |
| Graphify | `<projectPath>/graphify-out/graph.json` | ✅ Yes | 500 |
| PARA | `<projectPath>/CZVault/` | ❌ No | 300 |
| QMD Templates | `<projectPath>/agent/templates/*.qmd` | ✅ Yes | 200 |
| Automations | `<projectPath>/agent/automations/automations.json` | ❌ No | 100 |
| Deep Memory | `<projectPath>/agent/context/` | ✅ Yes | dynamic |

**Rule:** Only include enabled systems. Respect max token budgets per system.

### 4.4 Session Categories (6 Types)
| Category | Color | Use For |
|----------|-------|---------|
| Bug Fix | red | Debugging, fixing broken code |
| Feature | blue | New functionality |
| Refactor | purple | Code restructuring without behavior change |
| Research | cyan | Exploration, spike, investigation |
| Review | green | Code review, audit |
| Other | gray | Everything else |

### 4.5 IPC Naming Convention
All IPC channels use **kebab-case** with category prefixes:
- Terminal lifecycle: `terminal:*`, `agent:*`
- Sessions: `get-terminal-sessions`, `save-terminal-session`
- Problems: `get-problems`, `create-problem`, `update-problem-status`
- Files: `read-agent-files`, `read-agent-file`, `write-project-file`

---

## 5. BEHAVIORAL RULES

### ✅ ALWAYS
- Use TypeScript strict mode throughout
- Prefer functional components + hooks over class components
- Use named exports only (no `export default`)
- File names: PascalCase for components, kebab-case for utilities
- When adding IPC handlers, register in BOTH `main.ts` AND `preload.ts`
- Run `npm run lint` before committing
- Update the JSON source before the Markdown mirror

### ⚠️ ASK FIRST
- Adding new npm dependencies (prefer built-in Electron APIs)
- Changing the terminal lifecycle state machine
- Modifying the recursive layout tree structure
- Altering the 6 knowledge system context assembly logic

### 🚫 NEVER
- Commit secrets or API keys (use `.env` + `process.env`)
- Edit files in `node_modules/`
- Use `window.confirm()` — use the custom `ConfirmDialog` component
- Break the dual-write pattern (JSON ↔ Markdown)
- Modify `agent/problems.json` directly without going through `ProblemsService.ts`

---

## 6. CURRENT WORKSPACE STATE (LIVING SPEC — UPDATE AFTER EACH SESSION)

### Active Development
- **Feature:** Context Management System overhaul
- **Status:** Designing hierarchical workspace memory + AST-based code indexing
- **Blockers:** None

### Recent Decisions
- Decision 001: Using JSON as primary format for state tracking (queryable, UI-friendly)
- Decision 002: Tree-sitter AST indexing for code navigation (not RAG)
- Decision 003: Hierarchical memory (HORMA-style) for session continuity

### Known Issues
| Function | Location | Status |
|----------|----------|--------|
| `handleTerminalMoveToGroup` | TerminalPage.tsx | Broken — DnD in Map tab |
| `loadSavedConfigs` | TerminalPage.tsx | Broken — Configs tab |
| `handleSaveWorkspace` | TerminalPage.tsx | Broken — Save dialog |
| `handleLoadWorkspace` | TerminalPage.tsx | Broken — Load workspace |

---

## 7. QUICK REFERENCE

**Start dev server:** `npm run dev`
**Build:** `npm run build`
**Lint:** `npm run lint`
**Test:** `npm test`

**Key IPC to know:**
- `get-projects` → returns array of `{id, name, path, language, vcs}`
- `read-agent-files` → returns `{state, context, problems, requests, checklists, skills}`
- `tracker-mind-setup` → initializes agent file system for a project

**Critical file paths:**
- Agent files: `<projectPath>/agent/`
- Context config: `src/services/ContextConfig.ts`
- Default system prompt: `src/lib/defaults.ts`
```

---

## The Context Management System: Starter Implementation

Now here's the **actual code** to implement the hierarchical workspace memory system we discussed. This is designed to slot into your existing architecture.

### 1. Core Types (`src/services/ContextStateTypes.ts`)

```typescript
/**
 * Workspace State Machine — tracks implementation progress
 * NOT RAG. NOT semantic search. Structured state tracking.
 */
export interface WorkspaceState {
  version: string;
  lastUpdated: string;
  modules: Record<string, ModuleState>;
  decisions: Decision[];
  sessions: SessionSnapshot[];
}

export interface ModuleState {
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  components: Record<string, ComponentState>;
  dependencies: string[]; // other module names
}

export interface ComponentState {
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  lines?: string; // "file.ts:45-67"
  tested?: boolean;
  blocker?: string; // reference to decision or issue
  depends_on?: string[]; // component IDs
}

export interface Decision {
  id: string;
  topic: string;
  choice: string;
  rationale: string;
  date: string;
  alternatives_considered?: string[];
  superseded_by?: string; // decision ID that replaced this
}

export interface SessionSnapshot {
  id: string;
  timestamp: string;
  summary: string;
  filesModified: string[];
  decisionsMade: string[];
  nextSteps: string[];
}

/**
 * AST Symbol Index — for precise code navigation
 * Populated by Tree-sitter parsing, NOT by text search
 */
export interface SymbolIndex {
  version: string;
  lastIndexed: string;
  symbols: SymbolEntry[];
  callGraph: CallEdge[];
}

export interface SymbolEntry {
  id: string;
  name: string;
  kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type';
  file: string;
  lineStart: number;
  lineEnd: number;
  signature?: string; // for methods: "function foo(bar: string): number"
  language: string;
  parent?: string; // enclosing class/module ID
  children?: string[]; // member IDs
}

export interface CallEdge {
  caller: string; // symbol ID
  callee: string; // symbol ID
  file: string;
  line: number;
  type: 'direct' | 'indirect' | 'dynamic';
}
```

### 2. Workspace State Service (`src/services/WorkspaceStateService.ts`)

```typescript
import { WorkspaceState, ModuleState, ComponentState, Decision, SessionSnapshot } from './ContextStateTypes';

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
    if (old) old.superseded_by = newId;
    
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
    // Keep only last 20 sessions to prevent bloat
    this.state.sessions = [...this.state.sessions.slice(-19), snap];
    this.persist();
    return snap;
  }

  // ─── Queries (what the AI calls to "remember") ───────────────────

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
    const decisions = [...this.state.decisions].reverse(); // newest first
    return topic ? decisions.filter(d => d.topic.includes(topic)) : decisions;
  }

  // ─── Persistence (JSON + Markdown dual-write) ────────────────────

  private loadState(): WorkspaceState {
    try {
      const fs = window.electronAPI?.readProjectFile;
      if (!fs) return this.getDefaultState();
      const raw = fs(this.projectPath, STATE_FILE);
      return JSON.parse(raw);
    } catch {
      return this.getDefaultState();
    }
  }

  private persist(): void {
    this.state.lastUpdated = new Date().toISOString();
    
    // Write JSON
    window.electronAPI?.writeProjectFile?.(
      this.projectPath,
      STATE_FILE,
      JSON.stringify(this.state, null, 2)
    );
    
    // Write Markdown mirror (human-readable)
    const md = this.generateMarkdown();
    window.electronAPI?.writeProjectFile?.(this.projectPath, STATE_MD, md);
  }

  private generateMarkdown(): string {
    const { modules, decisions, sessions } = this.state;
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
```

### 3. Tree-Sitter Symbol Index Service (`src/services/SymbolIndexService.ts`)

```typescript
import { SymbolIndex, SymbolEntry, CallEdge } from './ContextStateTypes';

const INDEX_FILE = '.context/index/symbols.json';
const DB_FILE = '.context/index/symbols.db';

/**
 * AST-based code index — NOT RAG, NOT text search
 * Uses Tree-sitter to extract precise symbols and call graphs
 */
export class SymbolIndexService {
  private index: SymbolIndex;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.index = this.loadIndex();
  }

  /**
   * Build or incrementally update the symbol index
   * Called after file changes or on explicit reindex
   */
  async buildIndex(changedFiles?: string[]): Promise<void> {
    // In production, this calls a Tree-sitter parser (Python/Node binding)
    // For now, stub with the interface
    const { symbols, callGraph } = await this.parseWithTreeSitter(changedFiles);
    
    if (changedFiles) {
      // Incremental: remove old entries for changed files, add new
      this.index.symbols = this.index.symbols.filter(s => !changedFiles.includes(s.file));
      this.index.symbols.push(...symbols);
      
      this.index.callGraph = this.index.callGraph.filter(e => !changedFiles.includes(e.file));
      this.index.callGraph.push(...callGraph);
    } else {
      this.index.symbols = symbols;
      this.index.callGraph = callGraph;
    }
    
    this.index.lastIndexed = new Date().toISOString();
    this.persist();
  }

  // ─── Queries (precise, not fuzzy) ────────────────────────────────

  findSymbol(name: string, kind?: string): SymbolEntry[] {
    return this.index.symbols.filter(s => {
      const nameMatch = s.name === name; // EXACT match, not similarity
      return kind ? nameMatch && s.kind === kind : nameMatch;
    });
  }

  findDefinition(file: string, line: number): SymbolEntry | undefined {
    return this.index.symbols.find(s => 
      s.file === file && s.lineStart <= line && s.lineEnd >= line
    );
  }

  getCallers(symbolId: string): CallEdge[] {
    return this.index.callGraph.filter(e => e.callee === symbolId);
  }

  getCallees(symbolId: string): CallEdge[] {
    return this.index.callGraph.filter(e => e.caller === symbolId);
  }

  getFileSymbols(file: string): SymbolEntry[] {
    return this.index.symbols.filter(s => s.file === file);
  }

  // ─── Visualization Data (for mind map / tree view) ───────────────

  getModuleTree(): ModuleTreeNode[] {
    // Group symbols by file path into a tree
    const tree: Record<string, ModuleTreeNode> = {};
    
    for (const sym of this.index.symbols) {
      const parts = sym.file.split('/');
      let current = tree;
      let path = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        path = path ? `${path}/${part}` : part;
        
        if (!current[path]) {
          current[path] = {
            name: part,
            path,
            type: i === parts.length - 1 ? 'file' : 'directory',
            children: i === parts.length - 1 ? undefined : {},
            symbols: i === parts.length - 1 ? [] : undefined
          };
        }
        
        if (i === parts.length - 1) {
          current[path].symbols!.push(sym);
        } else {
          current = current[path].children!;
        }
      }
    }
    
    return Object.values(tree);
  }

  getCallGraphForSymbol(symbolId: string, depth: number = 2): CallGraphNode {
    const sym = this.index.symbols.find(s => s.id === symbolId);
    if (!sym) throw new Error(`Symbol ${symbolId} not found`);
    
    const node: CallGraphNode = { symbol: sym, callers: [], callees: [] };
    
    if (depth > 0) {
      for (const edge of this.getCallers(symbolId)) {
        node.callers.push(this.getCallGraphForSymbol(edge.caller, depth - 1));
      }
      for (const edge of this.getCallees(symbolId)) {
        node.callees.push(this.getCallGraphForSymbol(edge.callee, depth - 1));
      }
    }
    
    return node;
  }

  // ─── Private ─────────────────────────────────────────────────────

  private async parseWithTreeSitter(files?: string[]): Promise<{ symbols: SymbolEntry[]; callGraph: CallEdge[] }> {
    // TODO: Integrate with tree-sitter CLI or MCP server
    // This would call: tree-sitter parse --symbols --calls
    // For now, return empty (index builds on first use)
    return { symbols: [], callGraph: [] };
  }

  private loadIndex(): SymbolIndex {
    try {
      const raw = window.electronAPI?.readProjectFile?.(this.projectPath, INDEX_FILE);
      return raw ? JSON.parse(raw) : this.getDefaultIndex();
    } catch {
      return this.getDefaultIndex();
    }
  }

  private persist(): void {
    window.electronAPI?.writeProjectFile?.(
      this.projectPath,
      INDEX_FILE,
      JSON.stringify(this.index, null, 2)
    );
  }

  private getDefaultIndex(): SymbolIndex {
    return {
      version: '1.0',
      lastIndexed: new Date().toISOString(),
      symbols: [],
      callGraph: []
    };
  }
}

// Types for visualization
export interface ModuleTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: Record<string, ModuleTreeNode>;
  symbols?: SymbolEntry[];
}

export interface CallGraphNode {
  symbol: SymbolEntry;
  callers: CallGraphNode[];
  callees: CallGraphNode[];
}
```

### 4. Context Manager Hook (`src/hooks/useWorkspaceContext.ts`)

```typescript
import { useState, useCallback, useEffect } from 'react';
import { WorkspaceStateService } from '../services/WorkspaceStateService';
import { SymbolIndexService } from '../services/SymbolIndexService';
import { WorkspaceState, SymbolIndex, ModuleTreeNode, CallGraphNode } from '../services/ContextStateTypes';

/**
 * React hook that gives components access to the workspace state + symbol index
 * This is what the UI (and the AI) query to "remember" the project state
 */
export function useWorkspaceContext(projectPath: string) {
  const [stateService] = useState(() => new WorkspaceStateService(projectPath));
  const [indexService] = useState(() => new SymbolIndexService(projectPath));
  
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [symbolIndex, setSymbolIndex] = useState<SymbolIndex | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  // Refresh state from disk
  const refresh = useCallback(() => {
    setWorkspaceState(stateService['state']); // access private for reload
    setSymbolIndex(indexService['index']);
  }, [stateService, indexService]);

  // Build symbol index
  const buildIndex = useCallback(async (files?: string[]) => {
    setIsIndexing(true);
    await indexService.buildIndex(files);
    setIsIndexing(false);
    refresh();
  }, [indexService, refresh]);

  // ─── Queries ───────────────────────────────────────────────────

  const getDashboard = useCallback(() => stateService.getDashboard(), [stateService]);
  
  const getModuleTree = useCallback((): ModuleTreeNode[] => {
    return indexService.getModuleTree();
  }, [indexService]);

  const getCallGraph = useCallback((symbolId: string, depth?: number): CallGraphNode => {
    return indexService.getCallGraphForSymbol(symbolId, depth);
  }, [indexService]);

  const findSymbol = useCallback((name: string, kind?: string) => {
    return indexService.findSymbol(name, kind);
  }, [indexService]);

  // ─── Mutations ───────────────────────────────────────────────────

  const updateComponent = useCallback((module: string, component: string, update: any) => {
    stateService.updateComponent(module, component, update);
    refresh();
  }, [stateService, refresh]);

  const recordDecision = useCallback((decision: any) => {
    stateService.recordDecision(decision);
    refresh();
  }, [stateService, refresh]);

  const snapshotSession = useCallback((summary: string, files: string[], decisions: string[], next: string[]) => {
    stateService.snapshotSession(summary, files, decisions, next);
    refresh();
  }, [stateService, refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    workspaceState,
    symbolIndex,
    isIndexing,
    refresh,
    buildIndex,
    getDashboard,
    getModuleTree,
    getCallGraph,
    findSymbol,
    updateComponent,
    recordDecision,
    snapshotSession
  };
}
```

### 5. Visualization Component — Mind Map Tree View (`src/components/WorkspaceMindMap.tsx`)

```tsx
import React, { useState } from 'react';
import { ModuleTreeNode, CallGraphNode, SymbolEntry } from '../services/ContextStateTypes';
import { useWorkspaceContext } from '../hooks/useWorkspaceContext';

/**
 * Interactive mind map / tree view of the workspace
 * Shows: module hierarchy, implementation status, symbol relationships
 * Both human-readable AND AI-queriable
 */
export const WorkspaceMindMap: React.FC<{ projectPath: string }> = ({ projectPath }) => {
  const { getModuleTree, getCallGraph, findSymbol, workspaceState } = useWorkspaceContext(projectPath);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'files' | 'calls' | 'status'>('files');

  const tree = getModuleTree();
  const dashboard = workspaceState ? {
    completion: 0, // calculated from state
    modules: Object.entries(workspaceState.modules).map(([name, mod]) => ({
      name,
      status: mod.status,
      componentCount: Object.keys(mod.components).length,
      doneCount: Object.values(mod.components).filter(c => c.status === 'done').length
    }))
  } : null;

  return (
    <div className="h-full flex flex-col bg-zinc-900 text-zinc-100 p-4 overflow-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 border-b border-zinc-700 pb-3">
        <h2 className="text-lg font-semibold text-cyan-400">Workspace Mind Map</h2>
        <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
          {(['files', 'calls', 'status'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded text-sm capitalize transition ${
                viewMode === mode ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {dashboard && (
          <div className="ml-auto flex gap-4 text-sm">
            <span className="text-emerald-400">✅ {dashboard.modules.reduce((a, m) => a + m.doneCount, 0)} done</span>
            <span className="text-amber-400">🔄 {dashboard.modules.filter(m => m.status === 'in_progress').length} in progress</span>
            <span className="text-red-400">⛔ {dashboard.modules.filter(m => m.status === 'blocked').length} blocked</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'files' && <FileTreeView nodes={tree} onSelect={setSelectedSymbol} />}
        {viewMode === 'calls' && selectedSymbol && <CallGraphView rootId={selectedSymbol} />}
        {viewMode === 'status' && dashboard && <StatusHeatmap modules={dashboard.modules} />}
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────

const FileTreeView: React.FC<{ nodes: ModuleTreeNode[]; onSelect: (id: string) => void; depth?: number }> = ({ 
  nodes, onSelect, depth = 0 
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div className="space-y-0.5">
      {nodes.map(node => (
        <div key={node.path} style={{ marginLeft: depth * 16 }}>
          <div 
            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-zinc-800 ${
              node.type === 'file' ? 'text-zinc-300' : 'text-cyan-400 font-medium'
            }`}
            onClick={() => node.type === 'directory' ? toggle(node.path) : null}
          >
            <span className="text-xs w-4">{node.type === 'directory' ? (expanded[node.path] ? '▼' : '▶') : '📄'}</span>
            <span className="text-sm">{node.name}</span>
            {node.symbols && (
              <span className="text-xs text-zinc-500 ml-2">{node.symbols.length} symbols</span>
            )}
          </div>
          
          {node.type === 'directory' && expanded[node.path] && node.children && (
            <FileTreeView nodes={Object.values(node.children)} onSelect={onSelect} depth={depth + 1} />
          )}
          
          {node.symbols && node.symbols.map(sym => (
            <div 
              key={sym.id}
              className="flex items-center gap-2 py-0.5 px-2 ml-6 rounded cursor-pointer hover:bg-zinc-800 text-xs"
              onClick={() => onSelect(sym.id)}
            >
              <span className="text-zinc-500">{sym.kind === 'function' ? 'ƒ' : sym.kind === 'class' ? 'C' : '◇'}</span>
              <span className="text-zinc-400">{sym.name}</span>
              <span className="text-zinc-600 ml-auto">{sym.file}:{sym.lineStart}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const CallGraphView: React.FC<{ rootId: string }> = ({ rootId }) => {
  const { getCallGraph } = useWorkspaceContext('');
  const [graph, setGraph] = useState<CallGraphNode | null>(null);

  React.useEffect(() => {
    try {
      setGraph(getCallGraph(rootId, 2));
    } catch (e) {
      // symbol not found
    }
  }, [rootId, getCallGraph]);

  if (!graph) return <div className="text-zinc-500">Symbol not found</div>;

  const renderNode = (node: CallGraphNode, depth: number = 0): React.ReactNode => (
    <div key={node.symbol.id} style={{ marginLeft: depth * 24 }} className="my-1">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
        <span className="text-cyan-400 text-xs">{node.symbol.kind}</span>
        <span className="text-sm font-medium">{node.symbol.name}</span>
        <span className="text-zinc-600 text-xs">{node.symbol.file}:{node.symbol.lineStart}</span>
      </div>
      {node.callers.length > 0 && (
        <div className="mt-1">
          <span className="text-xs text-zinc-600 ml-2">← called by</span>
          {node.callers.map(caller => renderNode(caller, depth + 1))}
        </div>
      )}
      {node.callees.length > 0 && (
        <div className="mt-1">
          <span className="text-xs text-zinc-600 ml-2">→ calls</span>
          {node.callees.map(callee => renderNode(callee, depth + 1))}
        </div>
      )}
    </div>
  );

  return <div className="p-4">{renderNode(graph)}</div>;
};

const StatusHeatmap: React.FC<{ modules: any[] }> = ({ modules }) => {
  const getColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-emerald-500';
      case 'in_progress': return 'bg-amber-500';
      case 'blocked': return 'bg-red-500';
      default: return 'bg-zinc-700';
    }
  };

  return (
    <div className="grid grid-cols-1 gap-2 p-4">
      {modules.map(mod => (
        <div key={mod.name} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
          <div className={`w-3 h-3 rounded-full ${getColor(mod.status)}`} />
          <span className="font-medium min-w-[150px]">{mod.name}</span>
          <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${mod.componentCount > 0 ? (mod.doneCount / mod.componentCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 w-16 text-right">
            {mod.doneCount}/{mod.componentCount}
          </span>
        </div>
      ))}
    </div>
  );
};
```

---

## How the AI Uses This System

After every meaningful change, the agent calls:

```typescript
// After implementing a feature
stateService.updateComponent('auth', 'jwt_middleware', {
  status: 'done',
  lines: 'auth.ts:45-67',
  tested: true
});

// After making a decision
stateService.recordDecision({
  topic: 'caching strategy',
  choice: 'Redis with pub/sub',
  rationale: 'Need real-time features, Memcached lacks pub/sub'
});

// At session end
stateService.snapshotSession(
  'Implemented JWT auth middleware',
  ['src/auth.ts', 'tests/auth.test.ts'],
  ['dec-001'],
  ['Add rate limiting', 'Write refresh token logic']
);
```

**When the AI needs to "remember":**
- *"What's the status of auth?"* → `getModuleStatus('auth')` — structured JSON, not text search
- *"Where is `validateToken` defined?"* → `findSymbol('validateToken', 'function')` — exact file:line, not grep
- *"What calls `validateToken`?"* → `getCallers(symbolId)` — precise call graph
- *"What's blocked?"* → `getDashboard().blocked` — array of blocked items with reasons
- *"What did we decide about caching?"* → `getDecisionHistory('caching')` — exact decisions

---

## Integration with Your Existing Tabs

Add a new sidebar tab (e.g., tab #13: **Context Map**) that renders `WorkspaceMindMap`:

```typescript
// In TerminalPage.tsx sidebar tabs array, add:
{ id: 'context-map', label: 'Context Map', icon: Network, color: 'cyan', component: WorkspaceMindMap }
```

This gives you:
1. **Visual progress tracking** — the status heatmap shows completion at a glance
2. **Interactive code exploration** — click a symbol, see its call graph
3. **File tree with symbols** — navigate code structure, not just folders
4. **AI-queriable state** — the same data the UI shows is what the AI queries

The key difference from your current QMD/Graphify setup: **this tracks implementation state and decisions, not just semantic relationships**. QMD tells you "these concepts are related"; this tells you "this component is done, that one is blocked, here's why."
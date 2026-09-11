# Context Management Architecture — Complete Research & Design

## 1. The Problem: Why AI Gets Stale Context

After a few chats in the same session, the AI agent begins predicting what the user will say. This happens because:

1. **The system prompt is static** — it's written once at session start and never updated
2. **No summarization occurs** — the agent's context window fills with raw messages, and older relevant context gets pushed out
3. **No cross-session memory** — each new session starts from zero; the agent doesn't know what happened yesterday
4. **No selective injection** — all LLM Wiki files are dumped into the system prompt regardless of relevance, wasting tokens on unused content

The fix is a **layered context system** that manages what the AI knows at each point in time, trimming what's irrelevant and reinforcing what matters.

---

## 2. Layered Context Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT LAYERS (inside system prompt)        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 0: IDENTITY (always present, ~500 tokens)         │   │
│  │ - Agent name, role, project name                        │   │
│  │ - Core behavioral rules from DEFAULT_SYSTEM_PROMPT      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 1: PROJECT CONTEXT (~1000-3000 tokens)            │   │
│  │ - LLM Wiki: state.md, context.md (condensed)            │   │
│  │ - Active problems summary (top 3-5 by recency)          │   │
│  │ - Active requests summary (top 3-5 by recency)          │   │
│  │ - PARA structure overview (area names, not content)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 2: SESSION CONTEXT (~500-2000 tokens)             │   │
│  │ - Current session goal/topic                             │   │
│  │ - Recent decisions made this session                     │   │
│  │ - Files modified this session                            │   │
│  │ - Skills used this session                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 3: SKILL CONTEXT (on-demand, ~200-1000 tokens)    │   │
│  │ - Only loaded when a skill is invoked                    │   │
│  │ - Skill instructions + linked problems/requests          │   │
│  │ - QMD template reference (not full content)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 4: DEEP MEMORY (cross-session, ~200-500 tokens)   │   │
│  │ - Recurring patterns ("user often works on X")           │   │
│  │ - Past session summaries (last 5 sessions, 1-sentence)  │   │
│  │ - Personal preferences discovered over time              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  TOTAL BUDGET: ~2500-7000 tokens (configurable)                │
│  Full context window: 100k-200k tokens                         │
│  Context overhead: 2.5-7% of window — very efficient           │
└─────────────────────────────────────────────────────────────────┘
```

### Token Budget Strategy

| Layer | Min Tokens | Max Tokens | When Loaded |
|-------|-----------|-----------|-------------|
| 0: Identity | 300 | 500 | Always |
| 1: Project | 1000 | 3000 | Session start |
| 2: Session | 500 | 2000 | Session start, updated every N messages |
| 3: Skill | 0 | 1000 | On skill invocation only |
| 4: Deep Memory | 200 | 500 | Session start |
| **Total** | **2000** | **7000** | — |

This is deliberately conservative. The AI agent has its own conversation context (the actual messages), which uses the bulk of the context window. Our system prompt layers are the "meta-context" that keeps the agent oriented.

---

## 3. Data Schemas

### 3.1 Session Summaries

Stored in `agent/context/session-summaries.json`:

```typescript
interface SessionSummary {
  id: string;                    // Matches terminal_sessions.id
  topic: string;                 // Auto-generated or user-set
  agent: string;                 // claude, opencode, etc.
  started_at: string;            // ISO timestamp
  ended_at: string;              // ISO timestamp
  duration_minutes: number;
  
  // Condensed session info
  decisions: string[];           // Key decisions made (max 5)
  files_modified: string[];      // Files touched (max 10)
  problems_addressed: string[];  // Problem IDs (max 5)
  skills_used: string[];         // Skill names used
  
  // AI-generated summary (1-2 sentences)
  summary: string;
  
  // Token count of the summary itself
  summary_tokens: number;
}

// File structure:
// {
//   "summaries": [
//     { ... SessionSummary ... },
//     ...
//   ],
//   "last_updated": "2026-05-18T12:00:00Z",
//   "retention_days": 90
// }
```

### 3.2 Deep Memory

Stored in `agent/context/deep-memory.json`:

```typescript
interface DeepMemory {
  patterns: UserPattern[];
  preferences: UserPreference[];
  project_insights: ProjectInsight[];
  last_updated: string;
}

interface UserPattern {
  id: string;
  pattern_type: 'workflow' | 'debugging' | 'feature' | 'refactor';
  description: string;           // e.g., "User often debugs by reading error logs first"
  frequency: number;             // How often this pattern appears
  last_seen: string;             // ISO timestamp
  confidence: number;            // 0-1, how confident we are
  source_sessions: string[];     // Session IDs where this was observed
}

interface UserPreference {
  id: string;
  key: string;                   // e.g., "code_style", "test_framework"
  value: string;                 // e.g., "functional", "jest"
  confidence: number;
  source: string;                // "explicit" (user said it) or "inferred"
}

interface ProjectInsight {
  id: string;
  insight: string;               // e.g., "This project uses SQLite with JSON fallback"
  category: string;              // "architecture", "tech_stack", "convention"
  last_confirmed: string;        // When was this last verified
}
```

### 3.3 Context Configuration (per project)

Stored in project preferences (`deskflow-prefs.json` under `projectContext`):

```typescript
interface ProjectContextConfig {
  // System toggles
  systems: {
    llm_wiki: {
      enabled: boolean;
      files: string[];            // Which agent/*.md files to include
      max_tokens: number;         // Token budget for this system
    };
    obsidian_skills: {
      enabled: boolean;
      skills: string[];           // Which skills to include (empty = all)
      max_tokens: number;
    };
    graphify: {
      enabled: boolean;
      include_graph: boolean;     // Include graph structure
      include_summary: boolean;   // Include text summary
      max_tokens: number;
    };
    para: {
      enabled: boolean;
      areas: string[];            // Which PARA areas to include
      max_tokens: number;
    };
    qmd: {
      enabled: boolean;
      templates: string[];        // Which templates to reference
      max_tokens: number;
    };
    automations: {
      enabled: boolean;
      automations: string[];      // Which automations to activate
      max_tokens: number;
    };
  };
  
  // Context behavior
  summarization: {
    enabled: boolean;
    message_threshold: number;    // Summarize every N messages (default: 10)
    max_recent_messages: number;  // Keep last N messages unsummarized (default: 5)
    summary_style: 'brief' | 'detailed';  // 1-sentence or paragraph
  };
  
  // Deep memory
  deep_memory: {
    enabled: boolean;
    pattern_detection: boolean;   // Auto-detect patterns
    max_patterns: number;         // Max patterns to store (default: 20)
    retention_days: number;       // How long to keep (default: 90)
  };
  
  // Token budget
  total_token_budget: number;     // Max tokens for all context layers (default: 7000)
}
```

### 3.4 Context Injection Record

Tracked per session, stored in DB table `context_injections`:

```sql
CREATE TABLE IF NOT EXISTS context_injections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  layer TEXT NOT NULL,              -- 'identity', 'project', 'session', 'skill', 'deep_memory'
  system_name TEXT,                 -- Which system provided this (llm_wiki, graphify, etc.)
  content_hash TEXT,                -- SHA256 of injected content (for dedup)
  token_count INTEGER,
  injected_at TEXT DEFAULT (datetime('now')),
  removed_at TEXT,                  -- When this context was removed/summarized away
  UNIQUE(session_id, layer, content_hash)
);

CREATE INDEX idx_context_injections_session 
  ON context_injections(session_id);
```

---

## 4. Per-System Integration Approach

### 4.1 LLM Wiki (`agent/*.md`)

**What it provides:** Project state, context, problems, debugging patterns, feature inventory.

**Current behavior:** The entire `DEFAULT_SYSTEM_PROMPT` includes a condensed version of LLM Wiki content, hardcoded. This means it's always present regardless of relevance.

**New approach:** Selective, token-budgeted injection.

```typescript
// In main.ts — new function: buildLLMWikiContext

function buildLLMWikiContext(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const maxTokens = config.systems.llm_wiki.max_tokens || 2000;
  let content = '';
  let estimatedTokens = 0;
  
  // Priority order for LLM Wiki files:
  const filePriority = [
    { file: 'state.md', label: 'Project State', maxTokens: 800 },
    { file: 'context.md', label: 'Project Context', maxTokens: 600 },
    { file: 'PROBLEMS.md', label: 'Active Problems', maxTokens: 400 },
    { file: 'REQUESTS.md', label: 'Active Requests', maxTokens: 200 },
    { file: 'debugging.md', label: 'Debugging Patterns', maxTokens: 200 },
    { file: 'data.md', label: 'Data Schemas', maxTokens: 200 },
    { file: 'AGENTS.md', label: 'Agent Configuration', maxTokens: 200 },
  ];
  
  // Filter by enabled files in config
  const enabledFiles = config.systems.llm_wiki.files;
  
  for (const { file, label, maxTokens: fileMax } of filePriority) {
    if (enabledFiles.length > 0 && !enabledFiles.includes(file)) continue;
    if (estimatedTokens >= maxTokens) break;
    
    const filePath = path.join(projectPath, 'agent', file);
    if (!fs.existsSync(filePath)) continue;
    
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Truncate to fit token budget
    const remainingTokens = Math.min(fileMax, maxTokens - estimatedTokens);
    fileContent = truncateToTokens(fileContent, remainingTokens);
    
    if (fileContent) {
      content += `\n## ${label}\n${fileContent}\n`;
      estimatedTokens += estimateTokens(fileContent);
    }
  }
  
  return content;
}

// Rough token estimation: ~4 chars per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n... (truncated)';
}
```

**For state.md specifically — condensation:**

state.md can be 15,000+ tokens. We don't need all of it. Extract only the most recent entries:

```typescript
function condenseStateMd(fullContent: string, maxTokens: number): string {
  // Strategy: Keep the header + last 3 entries
  const sections = fullContent.split(/###?\s+20\d{2}-\d{2}-\d{2}/);
  
  if (sections.length <= 1) return truncateToTokens(fullContent, maxTokens);
  
  // Keep the header (everything before the first date heading)
  const header = sections[0];
  
  // Keep the last 3 date-sections (most recent activity)
  const recentSections = sections.slice(-3);
  
  let result = header;
  for (const section of recentSections) {
    result += '\n### ' + section;
  }
  
  return truncateToTokens(result, maxTokens);
}
```

### 4.2 Obsidian Skills (`agent/skills/*/SKILL.md`)

**What it provides:** Skill instructions for tasks the user can invoke.

**Current behavior:** Skills are listed in the sidebar SkillsTab, but their content is only injected when the user clicks "Use" on a skill. The system prompt mentions skills exist but doesn't include skill details.

**New approach:** Include a skill index (names + descriptions only) in Layer 1, full skill content on-demand in Layer 3.

```typescript
function buildSkillIndex(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const skillsDir = path.join(projectPath, 'agent', 'skills');
  if (!fs.existsSync(skillsDir)) return '';
  
  const enabledSkills = config.systems.obsidian_skills.skills;
  const maxTokens = config.systems.obsidian_skills.max_tokens || 500;
  
  let content = '## Available Skills\n';
  let estimatedTokens = estimateTokens(content);
  
  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());
  
  for (const skillDir of skillDirs) {
    const skillFile = path.join(skillsDir, skillDir.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    
    const skillContent = fs.readFileSync(skillFile, 'utf-8');
    const parsed = parseSkillFrontmatter(skillContent);
    
    // Filter by enabled skills
    if (enabledSkills.length > 0 && !enabledSkills.includes(parsed.name)) continue;
    
    // Index entry: name + description only (not full content)
    const entry = `- **${parsed.name}**: ${parsed.description || 'No description'}${parsed.ui ? ` (UI: ${parsed.ui})` : ''}\n`;
    
    if (estimatedTokens + estimateTokens(entry) > maxTokens) break;
    
    content += entry;
    estimatedTokens += estimateTokens(entry);
  }
  
  return content;
}

function buildFullSkillContext(skillName: string): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const skillFile = path.join(projectPath, 'agent', 'skills', skillName, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return '';
  
  const content = fs.readFileSync(skillFile, 'utf-8');
  const parsed = parseSkillFrontmatter(content);
  
  return `## Skill: ${parsed.name}\n${parsed.content}`;
}
```

### 4.3 Graphify (`graphify-out/`)

**What it provides:** Architecture overview — how files/modules connect, dependency graph.

**Current behavior:** Graphify generates a graph structure in `graphify-out/` and syncs to CZVault (Obsidian). The Setup dialog includes a Graphify toggle but doesn't inject the graph into context.

**New approach:** Include a text-based architecture summary, not the full graph.

```typescript
function buildGraphifyContext(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const maxTokens = config.systems.graphify.max_tokens || 500;
  
  // Read the graphify summary file (if it exists)
  const summaryFile = path.join(projectPath, 'graphify-out', 'summary.md');
  const graphFile = path.join(projectPath, 'graphify-out', 'graph.json');
  
  let content = '## Architecture\n';
  
  if (config.systems.graphify.include_summary && fs.existsSync(summaryFile)) {
    const summary = fs.readFileSync(summaryFile, 'utf-8');
    content += truncateToTokens(summary, maxTokens * 0.6) + '\n';
  }
  
  if (config.systems.graphify.include_graph && fs.existsSync(graphFile)) {
    try {
      const graph = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
      
      // Extract just the high-level structure: modules and their connections
      const modules = extractModuleSummary(graph);
      content += truncateToTokens(modules, maxTokens * 0.4) + '\n';
    } catch (e) {
      // Graph file invalid, skip
    }
  }
  
  return content;
}

function extractModuleSummary(graph: any): string {
  // Convert full graph JSON to a concise text summary
  // Show: module names, connection counts, key dependencies
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  
  // Group nodes by directory/module
  const moduleMap = new Map<string, string[]>();
  for (const node of nodes) {
    const dir = path.dirname(node.id || node.path || '');
    if (!moduleMap.has(dir)) moduleMap.set(dir, []);
    moduleMap.get(dir)!.push(path.basename(node.id || node.path || ''));
  }
  
  let summary = 'Module structure:\n';
  for (const [dir, files] of moduleMap) {
    if (dir === '.') continue; // Skip root
    summary += `  ${dir}/ (${files.length} files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''})\n`;
  }
  
  // Key connections (most-connected nodes)
  const connectionCounts = new Map<string, number>();
  for (const edge of edges) {
    const source = edge.source || edge.from || '';
    const target = edge.target || edge.to || '';
    connectionCounts.set(source, (connectionCounts.get(source) || 0) + 1);
    connectionCounts.set(target, (connectionCounts.get(target) || 0) + 1);
  }
  
  const topConnected = Array.from(connectionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  if (topConnected.length > 0) {
    summary += 'Key dependencies:\n';
    for (const [node, count] of topConnected) {
      summary += `  ${path.basename(node)} → ${count} connections\n`;
    }
  }
  
  return summary;
}
```

### 4.4 PARA (`CZVault/`)

**What it provides:** Project organization — Areas, Resources, Archives structure.

**Current behavior:** PARA structure exists in CZVault/ but is never injected into AI context. Graphify's `graphify_maintain.py` syncs to it but the AI agent doesn't know about it.

**New approach:** Include PARA area names and resource counts only, not file contents.

```typescript
function buildParaContext(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const maxTokens = config.systems.para.max_tokens || 300;
  const vaultPath = path.join(projectPath, 'CZVault');
  if (!fs.existsSync(vaultPath)) return '';
  
  const enabledAreas = config.systems.para.areas;
  
  let content = '## Project Organization (PARA)\n';
  
  const paraDirs = [
    { dir: '01_Areas', label: 'Areas' },
    { dir: '02_Resources', label: 'Resources' },
    { dir: '03_Archives', label: 'Archives' },
  ];
  
  for (const { dir, label } of paraDirs) {
    const dirPath = path.join(vaultPath, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory());
    
    // Filter by enabled areas
    const filteredItems = enabledAreas.length > 0 
      ? items.filter(i => enabledAreas.includes(i.name))
      : items;
    
    content += `${label}:\n`;
    for (const item of filteredItems.slice(0, 10)) {
      const files = fs.readdirSync(path.join(dirPath, item.name))
        .filter(f => f.endsWith('.md'));
      content += `  - ${item.name} (${files.length} notes)\n`;
    }
  }
  
  return truncateToTokens(content, maxTokens);
}
```

### 4.5 QMD Templates (`agent/templates/*.qmd`)

**What it provides:** Structured templates for sessions, problems, etc.

**Current behavior:** QMD templates are referenced in the Setup dialog. The AI is told about their existence but full template content isn't injected.

**New approach:** Reference templates by name and structure hint, not full content.

```typescript
function buildQMDContext(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const maxTokens = config.systems.qmd.max_tokens || 200;
  const templatesDir = path.join(projectPath, 'agent', 'templates');
  if (!fs.existsSync(templatesDir)) return '';
  
  const enabledTemplates = config.systems.qmd.templates;
  
  let content = '## Templates Available\n';
  
  const templateFiles = fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.qmd'));
  
  for (const file of templateFiles) {
    if (enabledTemplates.length > 0 && !enabledTemplates.includes(file)) continue;
    
    const filePath = path.join(templatesDir, file);
    const templateContent = fs.readFileSync(filePath, 'utf-8');
    
    // Extract just the section headers (not full content)
    const headers = templateContent.match(/^#+\s+.+$/gm) || [];
    const templateName = file.replace('.qmd', '');
    
    content += `- **${templateName}**: ${headers.map(h => h.replace(/^#+\s+/, '')).join(' → ')}\n`;
  }
  
  return truncateToTokens(content, maxTokens);
}
```

### 4.6 Automations (`agent/automations/`)

**What it provides:** Automated triggers that update context based on events.

**Current behavior:** Not yet implemented. Directory doesn't exist.

**New approach:** Automations are event-driven scripts that trigger context updates.

```typescript
// Automation definition schema
interface Automation {
  id: string;
  name: string;
  trigger: {
    event: 'file_changed' | 'session_end' | 'problem_created' | 'periodic';
    pattern?: string;            // Glob pattern for file_changed
    interval_minutes?: number;   // For periodic
  };
  action: {
    type: 'update_context' | 'regenerate_summary' | 'sync_para' | 'run_graphify';
    params: Record<string, any>;
  };
  enabled: boolean;
}
```

Example automations:

```json
[
  {
    "id": "auto-summary",
    "name": "Auto-Summarize on Session End",
    "trigger": { "event": "session_end" },
    "action": { "type": "update_context", "params": { "layer": "session" } },
    "enabled": true
  },
  {
    "id": "graphify-on-change",
    "name": "Rebuild Graph on File Change",
    "trigger": { "event": "file_changed", "pattern": "src/**/*.{ts,tsx}" },
    "action": { "type": "run_graphify", "params": { "mode": "ast" } },
    "enabled": false
  },
  {
    "id": "para-daily-sync",
    "name": "Daily PARA Sync",
    "trigger": { "event": "periodic", "interval_minutes": 1440 },
    "action": { "type": "sync_para", "params": {} },
    "enabled": false
  }
]
```

For context injection, automations are listed but not executed within the system prompt:

```typescript
function buildAutomationsContext(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const maxTokens = config.systems.automations.max_tokens || 100;
  const automationsFile = path.join(projectPath, 'agent', 'automations', 'automations.json');
  
  if (!fs.existsSync(automationsFile)) return '';
  
  try {
    const automations: Automation[] = JSON.parse(
      fs.readFileSync(automationsFile, 'utf-8')
    );
    
    const enabled = automations.filter(a => a.enabled);
    let content = `## Active Automations (${enabled.length})\n`;
    
    for (const auto of enabled) {
      content += `- ${auto.name}: on ${auto.trigger.event}`;
      if (auto.trigger.pattern) content += ` (${auto.trigger.pattern})`;
      content += ` → ${auto.action.type}\n`;
    }
    
    return truncateToTokens(content, maxTokens);
  } catch {
    return '';
  }
}
```

---

## 5. Context Injection Protocol

### 5.1 When to Inject

| Trigger | Layers Updated | Method |
|---------|---------------|--------|
| Session start | 0, 1, 4 | Full rebuild of system prompt |
| Every N messages (default: 10) | 2 | Update session context section |
| Skill invocation | 3 | Append skill content, remove after response |
| Manual "Update Context" click | 1, 2, 4 | Re-read files, regenerate |
| Problem/request change | 1 | Update project context section |
| Session end | 2, 4 | Summarize + save to deep memory |

### 5.2 How to Inject — The System Prompt Assembly

```typescript
// In main.ts — replaces the current initializeTerminal logic

function assembleSystemPrompt(
  projectPath: string,
  agent: string,
  sessionId: string | null,
  config: ProjectContextConfig
): string {
  let prompt = '';
  let totalTokens = 0;
  const budget = config.total_token_budget || 7000;
  
  // Layer 0: Identity (always present)
  prompt += buildIdentityContext(agent);
  totalTokens += estimateTokens(prompt);
  
  // Layer 1: Project Context
  if (config.systems.llm_wiki.enabled) {
    const wiki = buildLLMWikiContext(config);
    if (totalTokens + estimateTokens(wiki) <= budget) {
      prompt += wiki;
      totalTokens += estimateTokens(wiki);
    }
  }
  
  if (config.systems.obsidian_skills.enabled) {
    const skills = buildSkillIndex(config);
    if (totalTokens + estimateTokens(skills) <= budget) {
      prompt += skills;
      totalTokens += estimateTokens(skills);
    }
  }
  
  if (config.systems.graphify.enabled) {
    const graph = buildGraphifyContext(config);
    if (totalTokens + estimateTokens(graph) <= budget) {
      prompt += graph;
      totalTokens += estimateTokens(graph);
    }
  }
  
  if (config.systems.para.enabled) {
    const para = buildParaContext(config);
    if (totalTokens + estimateTokens(para) <= budget) {
      prompt += para;
      totalTokens += estimateTokens(para);
    }
  }
  
  if (config.systems.qmd.enabled) {
    const qmd = buildQMDContext(config);
    if (totalTokens + estimateTokens(qmd) <= budget) {
      prompt += qmd;
      totalTokens += estimateTokens(qmd);
    }
  }
  
  if (config.systems.automations.enabled) {
    const autos = buildAutomationsContext(config);
    if (totalTokens + estimateTokens(autos) <= budget) {
      prompt += autos;
      totalTokens += estimateTokens(autos);
    }
  }
  
  // Layer 2: Session Context (if session exists)
  if (sessionId) {
    const sessionCtx = buildSessionContext(sessionId);
    if (totalTokens + estimateTokens(sessionCtx) <= budget) {
      prompt += sessionCtx;
      totalTokens += estimateTokens(sessionCtx);
    }
  }
  
  // Layer 4: Deep Memory
  if (config.deep_memory.enabled) {
    const memory = buildDeepMemoryContext(config);
    if (totalTokens + estimateTokens(memory) <= budget) {
      prompt += memory;
      totalTokens += estimateTokens(memory);
    }
  }
  
  return prompt;
}
```

### 5.3 Mid-Session Context Update

The key innovation: context updates don't require restarting the session. Instead, we write an update message to the PTY that the AI agent processes as part of conversation:

```typescript
function injectMidSessionContext(terminalId: string, update: string) {
  // Format as a context update that the agent can process
  const contextUpdate = `\n[System: Context updated]\n${update}\n[End context update]\n`;
  
  // Write to PTY as if the user sent this
  // But mark it as a system message, not a user message
  deskflowAPI.terminalWriteRaw(terminalId, contextUpdate);
}
```

Wait — this approach has a problem. Writing to the PTY mid-session would appear as if the user typed something, disrupting the agent's flow.

**Better approach: Use the agent's own context update mechanism.**

For Claude Code, this is `--append-system-prompt` at launch time. Mid-session, the only way to update is through the conversation itself.

**The practical mid-session update:**

```typescript
// When context needs updating mid-session, send a structured message
// that tells the agent this is context, not a user instruction
function sendContextRefresh(terminalId: string, newContext: string) {
  const message = `[CONTEXT REFRESH — The following updates your project context. Acknowledge briefly, then continue.]\n\n${newContext}`;
  deskflowAPI.terminalWrite(terminalId, message + '\r');
}
```

This is simple and works with all agents. The agent sees it as a user message containing updated context. It's not perfect (it uses conversation turns) but it's the only reliable method across all agent types without API access.

### 5.4 Session Summarization

When a session ends (or every N messages), generate a summary:

```typescript
async function summarizeSession(sessionId: string): Promise<SessionSummary> {
  const db = getDatabase();
  
  // Get messages for this session
  const messages = db.prepare(`
    SELECT role, content, created_at 
    FROM terminal_messages 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `).all(sessionId);
  
  // Build summary from messages
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // Extract key information
  const decisions = extractDecisions(assistantMessages.map(m => m.content));
  const filesModified = extractFileMentions(
    [...userMessages, ...assistantMessages].map(m => m.content)
  );
  const problemsAddressed = extractProblemReferences(
    userMessages.map(m => m.content)
  );
  
  // Generate 1-2 sentence summary from first + last exchange
  const firstUser = userMessages[0]?.content || '';
  const lastAssistant = assistantMessages[assistantMessages.length - 1]?.content || '';
  const summary = generateSessionSummary(firstUser, lastAssistant, decisions);
  
  return {
    id: sessionId,
    topic: '', // Will be filled by auto-namer
    agent: '',
    started_at: messages[0]?.created_at || new Date().toISOString(),
    ended_at: messages[messages.length - 1]?.created_at || new Date().toISOString(),
    duration_minutes: 0,
    decisions: decisions.slice(0, 5),
    files_modified: filesModified.slice(0, 10),
    problems_addressed: problemsAddressed.slice(0, 5),
    skills_used: [],
    summary,
    summary_tokens: estimateTokens(summary),
  };
}

function extractDecisions(assistantMessages: string[]): string[] {
  const decisions: string[] = [];
  const patterns = [
    /(?:I'll|I will|Let's|let me|going to|decided to|we should)\s+(.{10,80})/gi,
    /(?:fixed|implemented|added|removed|changed|updated)\s+(.{10,60})/gi,
  ];
  
  for (const msg of assistantMessages) {
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(msg)) !== null && decisions.length < 10) {
        decisions.push(match[1].trim());
      }
    }
  }
  
  return [...new Set(decisions)]; // Deduplicate
}

function extractFileMentions(messages: string[]): string[] {
  const files = new Set<string>();
  const filePattern = /(?:src\/|agent\/|CZVault\/)[\w/.-]+\.\w{1,10}/g;
  
  for (const msg of messages) {
    let match;
    while ((match = filePattern.exec(msg)) !== null) {
      files.add(match[0]);
    }
  }
  
  return Array.from(files);
}

function extractProblemReferences(messages: string[]): string[] {
  const problems = new Set<string>();
  const problemPattern = /(?:problem|issue)\s*#?(\d+)/gi;
  
  for (const msg of messages) {
    let match;
    while ((match = problemPattern.exec(msg)) !== null) {
      problems.add(`#${match[1]}`);
    }
  }
  
  return Array.from(problems);
}
```

### 5.5 Deep Memory — Pattern Detection

```typescript
function detectPatterns(allSummaries: SessionSummary[]): UserPattern[] {
  const patterns: UserPattern[] = [];
  
  // 1. Most-touched files → workflow patterns
  const fileFreq = new Map<string, number>();
  for (const s of allSummaries) {
    for (const f of s.files_modified) {
      fileFreq.set(f, (fileFreq.get(f) || 0) + 1);
    }
  }
  
  for (const [file, freq] of fileFreq) {
    if (freq >= 3) {
      patterns.push({
        id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pattern_type: 'workflow',
        description: `User frequently works on ${file} (${freq} sessions)`,
        frequency: freq,
        last_seen: new Date().toISOString(),
        confidence: Math.min(freq / 10, 1),
        source_sessions: allSummaries.filter(s => s.files_modified.includes(file)).map(s => s.id),
      });
    }
  }
  
  // 2. Problem patterns → debugging patterns
  const problemFreq = new Map<string, number>();
  for (const s of allSummaries) {
    for (const p of s.problems_addressed) {
      problemFreq.set(p, (problemFreq.get(p) || 0) + 1);
    }
  }
  
  for (const [problem, freq] of problemFreq) {
    if (freq >= 2) {
      patterns.push({
        id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pattern_type: 'debugging',
        description: `Problem ${problem} has been addressed ${freq} times across sessions`,
        frequency: freq,
        last_seen: new Date().toISOString(),
        confidence: Math.min(freq / 5, 1),
        source_sessions: allSummaries.filter(s => s.problems_addressed.includes(problem)).map(s => s.id),
      });
    }
  }
  
  // 3. Decision patterns
  const decisionKeywords = new Map<string, number>();
  for (const s of allSummaries) {
    for (const d of s.decisions) {
      const keywords = d.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      for (const kw of keywords) {
        decisionKeywords.set(kw, (decisionKeywords.get(kw) || 0) + 1);
      }
    }
  }
  
  // Sort by frequency, keep top patterns
  return patterns
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
}
```

### 5.6 Deep Memory Context Builder

```typescript
function buildDeepMemoryContext(config: ProjectContextConfig): string {
  const projectPath = getProjectPath();
  if (!projectPath) return '';
  
  const memoryFile = path.join(projectPath, 'agent', 'context', 'deep-memory.json');
  if (!fs.existsSync(memoryFile)) return '';
  
  const maxTokens = config.deep_memory.pattern_detection ? 500 : 200;
  
  try {
    const memory: DeepMemory = JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
    
    let content = '## User Patterns & Preferences\n';
    
    // Top patterns (most frequent)
    const topPatterns = memory.patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    
    for (const p of topPatterns) {
      content += `- ${p.description}\n`;
    }
    
    // Known preferences
    for (const pref of memory.preferences.filter(p => p.confidence > 0.5)) {
      content += `- Preference: ${pref.key} = ${pref.value}\n`;
    }
    
    // Recent session summaries (last 3)
    const summariesFile = path.join(projectPath, 'agent', 'context', 'session-summaries.json');
    if (fs.existsSync(summariesFile)) {
      const summaries: { summaries: SessionSummary[] } = JSON.parse(
        fs.readFileSync(summariesFile, 'utf-8')
      );
      
      const recentSummaries = summaries.summaries
        .sort((a, b) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime())
        .slice(0, 3);
      
      if (recentSummaries.length > 0) {
        content += '\nRecent sessions:\n';
        for (const s of recentSummaries) {
          content += `- ${s.topic || s.id.slice(0, 8)}: ${s.summary}\n`;
        }
      }
    }
    
    return truncateToTokens(content, maxTokens);
  } catch {
    return '';
  }
}
```

---

## 6. Setup Dialog Redesign

### 6.1 Full Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Setup Agent Workspace                                          [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent: [Claude Code ▾]    Session: [New Session ▾]                 │
│                                                                     │
│  ┌── Context Systems ────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ 📚 LLM Wiki                              [●] ON       │   │  │
│  │  │ 7 files · ~2,400 tokens · state.md, context.md, ...    │   │  │
│  │  │ [Configure files ▾]                                     │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ ⚡ Obsidian Skills                        [●] ON       │   │  │
│  │  │ 13 skills · ~300 tokens · Index only (content on-demand)│   │  │
│  │  │ [Configure skills ▾]                                    │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ 🔗 Graphify                               [●] ON       │   │  │
│  │  │ 45 nodes · 120 edges · Built 2h ago · ~400 tokens      │   │  │
│  │  │ ☑ Summary  ☑ Module structure                           │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ 📂 PARA                                   [○] OFF      │   │  │
│  │  │ 3 areas · 24 resources · Last sync: never               │   │  │
│  │  │ [Configure areas ▾]                                     │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ 📝 QMD Templates                          [●] ON       │   │  │
│  │  │ 4 templates · ~150 tokens · session, problem, ...       │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ 🤖 Automations                            [○] OFF      │   │  │
│  │  │ 0 automations configured                                 │   │  │
│  │  │ [Add automation ▾]                                      │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌── Context Map ────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │     📚 LLM Wiki ────────── ⚡ Skills                         │  │
│  │         │                      │                               │  │
│  │         │                      ↓                               │  │
│  │     🔗 Graphify ──────── 📂 PARA                              │  │
│  │         │                      │                               │  │
│  │         ↓                      ↓                               │  │
│  │     📝 QMD ──────────── 🤖 Automations                        │  │
│  │                                                                │  │
│  │  Active: 4/6 systems · Estimated: ~3,250 / 7,000 tokens      │  │
│  │  ████████████████████░░░░░░░░░░░░░░░░░░░░  46% budget used   │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌── Behavior ───────────────────────────────────────────────────┐  │
│  │ Summarize every [10▾] messages  Keep last [5▾] unsummarized  │  │
│  │ ☑ Deep memory (cross-session patterns)                        │  │
│  │ ☑ Auto-refresh context on problem changes                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌── System Prompt Preview ──────────────────────────────────────┐  │
│  │ [▼ Show merged prompt]                                        │  │
│  │ ... Layer 0: Identity ...                                     │  │
│  │ ... Layer 1: Project Context ...                              │  │
│  │ ... Layer 4: Deep Memory ...                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                        [Cancel]  [Apply & Start Session]            │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 System Toggle Card Component

```tsx
function SystemToggleCard({ 
  system, 
  config, 
  onToggle, 
  onConfigure 
}: {
  system: SystemInfo;
  config: SystemConfig;
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
}) {
  const icons = {
    llm_wiki: BookOpen,
    obsidian_skills: Zap,
    graphify: Network,
    para: FolderTree,
    qmd: FileText,
    automations: Bot,
  };
  
  const accentColors = {
    llm_wiki: 'text-blue-400',
    obsidian_skills: 'text-purple-400',
    graphify: 'text-cyan-400',
    para: 'text-teal-400',
    qmd: 'text-amber-400',
    automations: 'text-rose-400',
  };
  
  const Icon = icons[system.id];
  const accent = accentColors[system.id];
  
  return (
    <div className={`border rounded-lg p-3 transition-colors
      ${config.enabled 
        ? 'bg-zinc-800/40 border-zinc-600/50' 
        : 'bg-zinc-900/30 border-zinc-700/30 opacity-60'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${accent}`} />
          <span className="text-[11px] text-zinc-300 font-medium">
            {system.name}
          </span>
        </div>
        <button
          onClick={() => onToggle(!config.enabled)}
          className={`w-8 h-4 rounded-full transition-colors relative
            ${config.enabled ? 'bg-emerald-500/60' : 'bg-zinc-700'}`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all
            ${config.enabled ? 'left-4.5 bg-emerald-300' : 'left-0.5 bg-zinc-500'}`} />
        </button>
      </div>
      
      <div className="text-[9px] text-zinc-500">
        {system.itemCount} {system.itemLabel} · ~{config.max_tokens} tokens
        {system.lastBuilt && ` · Built ${formatRelativeTime(system.lastBuilt)}`}
      </div>
      
      {config.enabled && (
        <button
          onClick={onConfigure}
          className="mt-1 text-[9px] text-cyan-400/70 hover:text-cyan-400 transition-colors">
          Configure {system.name.toLowerCase()} ▾
        </button>
      )}
    </div>
  );
}
```

### 6.3 Context Map Visualization

An in-app mini-graph showing system connections. Uses SVG, not Three.js — this is a 2D diagram.

```tsx
function ContextMapVisualization({ systems, config }: {
  systems: SystemInfo[];
  config: ProjectContextConfig;
}) {
  // Node positions (simple 3x2 grid layout)
  const nodePositions = {
    llm_wiki: { x: 80, y: 40 },
    obsidian_skills: { x: 240, y: 40 },
    graphify: { x: 80, y: 120 },
    para: { x: 240, y: 120 },
    qmd: { x: 80, y: 200 },
    automations: { x: 240, y: 200 },
  };
  
  // Edges (system dependencies)
  const edges = [
    { from: 'llm_wiki', to: 'obsidian_skills', label: 'skills reference wiki' },
    { from: 'graphify', to: 'para', label: 'syncs to vault' },
    { from: 'llm_wiki', to: 'graphify', label: 'reads source' },
    { from: 'qmd', to: 'llm_wiki', label: 'templates for wiki' },
    { from: 'automations', to: 'graphify', label: 'triggers rebuild' },
    { from: 'automations', to: 'para', label: 'triggers sync' },
  ];
  
  const enabledSystems = Object.entries(config.systems)
    .filter(([_, c]) => c.enabled)
    .map(([id]) => id);
  
  return (
    <div className="bg-zinc-900/50 border border-zinc-700/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-500">Context Map</span>
        <span className="text-[9px] text-zinc-600">
          {enabledSystems.length}/{Object.keys(config.systems).length} active
        </span>
      </div>
      
      <svg width="320" height="240" className="w-full">
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = nodePositions[edge.from];
          const to = nodePositions[edge.to];
          const bothEnabled = enabledSystems.includes(edge.from) && 
                              enabledSystems.includes(edge.to);
          
          return (
            <g key={i}>
              <line
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
                stroke={bothEnabled ? 'rgba(34,211,238,0.3)' : 'rgba(63,63,70,0.3)'}
                strokeWidth={bothEnabled ? 1.5 : 0.5}
                strokeDasharray={bothEnabled ? 'none' : '4,4'}
              />
              {bothEnabled && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  className="text-[7px] fill-zinc-600"
                  textAnchor="middle">
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Nodes */}
        {systems.map(system => {
          const pos = nodePositions[system.id];
          const enabled = enabledSystems.includes(system.id);
          const accentColors = {
            llm_wiki: '#3b82f6',
            obsidian_skills: '#a855f7',
            graphify: '#22d3ee',
            para: '#14b8a6',
            qmd: '#f59e0b',
            automations: '#f43f5e',
          };
          
          return (
            <g key={system.id}>
              <circle
                cx={pos.x} cy={pos.y}
                r={enabled ? 24 : 20}
                fill={enabled ? `${accentColors[system.id]}20` : '#18181b'}
                stroke={enabled ? accentColors[system.id] : '#3f3f46'}
                strokeWidth={enabled ? 1.5 : 0.5}
                className="cursor-pointer transition-all"
              />
              <text
                x={pos.x} y={pos.y - 2}
                className="text-[8px] fill-zinc-300"
                textAnchor="middle"
                dominantBaseline="middle">
                {system.name.split(' ')[0]}
              </text>
              <text
                x={pos.x} y={pos.y + 10}
                className="text-[6px] fill-zinc-500"
                textAnchor="middle">
                {system.itemCount}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Token budget bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[8px] text-zinc-600 mb-0.5">
          <span>Token budget</span>
          <span>~{calculateTotalTokens(config)} / {config.total_token_budget}</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-cyan-500/40 rounded-full transition-all"
            style={{ 
              width: `${Math.min(
                (calculateTotalTokens(config) / config.total_token_budget) * 100, 
                100
              )}%` 
            }} />
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Session Context Panel

A sidebar section showing what context is currently loaded for the active session.

```tsx
function SessionContextPanel({ sessionId, injections }: {
  sessionId: string;
  injections: ContextInjection[];
}) {
  const activeInjections = injections.filter(i => i.removed_at === null);
  const totalTokens = activeInjections.reduce((sum, i) => sum + i.token_count, 0);
  
  return (
    <div className="border-t border-zinc-700/50 p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
          Active Context
        </span>
        <span className="text-[9px] text-zinc-600">
          {totalTokens} tokens
        </span>
      </div>
      
      {/* Layer indicators */}
      <div className="space-y-1">
        {['identity', 'project', 'session', 'skill', 'deep_memory'].map(layer => {
          const layerInjections = activeInjections.filter(i => i.layer === layer);
          const layerTokens = layerInjections.reduce((s, i) => s + i.token_count, 0);
          
          return (
            <div key={layer} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full
                ${layerInjections.length > 0 ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
              <span className="text-[9px] text-zinc-500 flex-1">
                {layer.replace('_', ' ')}
              </span>
              {layerInjections.length > 0 && (
                <span className="text-[8px] text-zinc-600">
                  {layerTokens}t · {layerInjections.map(i => i.system_name).filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Actions */}
      <div className="flex gap-1 mt-2">
        <button
          onClick={handleRefreshContext}
          className="text-[9px] px-2 py-0.5 bg-cyan-500/15 text-cyan-400 
                     rounded hover:bg-cyan-500/25 transition-colors flex-1">
          Refresh
        </button>
        <button
          onClick={handleSummarizeContext}
          className="text-[9px] px-2 py-0.5 bg-amber-500/15 text-amber-400 
                     rounded hover:bg-amber-500/25 transition-colors flex-1">
          Summarize
        </button>
      </div>
    </div>
  );
}
```

---

## 8. IPC Handlers

```typescript
// In main.ts — new context management IPC handlers

// Get system status (file counts, last build times, etc.)
ipcMain.handle('get-context-systems', async (_event, projectPath?: string) => {
  const projPath = projectPath || getProjectPath();
  if (!projPath) return [];
  
  const systems: SystemInfo[] = [];
  
  // LLM Wiki
  const agentDir = path.join(projPath, 'agent');
  if (fs.existsSync(agentDir)) {
    const mdFiles = fs.readdirSync(agentDir).filter(f => f.endsWith('.md'));
    systems.push({
      id: 'llm_wiki',
      name: 'LLM Wiki',
      itemCount: mdFiles.length,
      itemLabel: 'files',
      lastBuilt: getLatestMtime(agentDir, '.md'),
      available: true,
    });
  }
  
  // Obsidian Skills
  const skillsDir = path.join(agentDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    systems.push({
      id: 'obsidian_skills',
      name: 'Obsidian Skills',
      itemCount: skillDirs.length,
      itemLabel: 'skills',
      lastBuilt: getLatestMtime(skillsDir),
      available: true,
    });
  }
  
  // Graphify
  const graphifyDir = path.join(projPath, 'graphify-out');
  if (fs.existsSync(graphifyDir)) {
    const graphFile = path.join(graphifyDir, 'graph.json');
    let nodeCount = 0, edgeCount = 0;
    if (fs.existsSync(graphFile)) {
      try {
        const graph = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
        nodeCount = graph.nodes?.length || 0;
        edgeCount = graph.edges?.length || 0;
      } catch {}
    }
    systems.push({
      id: 'graphify',
      name: 'Graphify',
      itemCount: nodeCount,
      itemLabel: `${nodeCount} nodes · ${edgeCount} edges`,
      lastBuilt: fs.existsSync(graphFile) 
        ? fs.statSync(graphFile).mtime.toISOString() 
        : null,
      available: true,
    });
  }
  
  // PARA
  const paraDir = path.join(projPath, 'CZVault');
  if (fs.existsSync(paraDir)) {
    const areas = fs.readdirSync(paraDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    systems.push({
      id: 'para',
      name: 'PARA',
      itemCount: areas.length,
      itemLabel: 'areas',
      lastBuilt: getLatestMtime(paraDir),
      available: true,
    });
  }
  
  // QMD
  const templatesDir = path.join(agentDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    const qmdFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.qmd'));
    systems.push({
      id: 'qmd',
      name: 'QMD Templates',
      itemCount: qmdFiles.length,
      itemLabel: 'templates',
      lastBuilt: getLatestMtime(templatesDir, '.qmd'),
      available: true,
    });
  }
  
  // Automations
  const autosDir = path.join(agentDir, 'automations');
  const autosFile = path.join(autosDir, 'automations.json');
  let autoCount = 0;
  if (fs.existsSync(autosFile)) {
    try {
      const autos = JSON.parse(fs.readFileSync(autosFile, 'utf-8'));
      autoCount = autos.length;
    } catch {}
  }
  systems.push({
    id: 'automations',
    name: 'Automations',
    itemCount: autoCount,
    itemLabel: 'automations',
    lastBuilt: null,
    available: fs.existsSync(autosDir),
  });
  
  return systems;
});

// Get project context config
ipcMain.handle('get-context-config', async (_event, projectPath?: string) => {
  const prefs = loadPreferences();
  const projPath = projectPath || getProjectPath();
  const projectId = getProjectId(projPath);
  
  return prefs.projectContext?.[projectId] || getDefaultContextConfig();
});

// Save project context config
ipcMain.handle('save-context-config', async (_event, config: ProjectContextConfig, projectPath?: string) => {
  const prefs = loadPreferences();
  const projPath = projectPath || getProjectPath();
  const projectId = getProjectId(projPath);
  
  if (!prefs.projectContext) prefs.projectContext = {};
  prefs.projectContext[projectId] = config;
  
  savePreferences(prefs);
  return true;
});

// Assemble and return the full system prompt (for preview)
ipcMain.handle('preview-system-prompt', async (_event, params: {
  agent: string;
  config: ProjectContextConfig;
  projectPath?: string;
}) => {
  const projPath = params.projectPath || getProjectPath();
  return assembleSystemPrompt(projPath, params.agent, null, params.config);
});

// Get context injections for a session
ipcMain.handle('get-context-injections', async (_event, sessionId: string) => {
  const db = getDatabase();
  if (!db) return [];
  
  return db.prepare(
    'SELECT * FROM context_injections WHERE session_id = ? AND removed_at IS NULL'
  ).all(sessionId);
});

// Trigger context refresh for active session
ipcMain.handle('refresh-session-context', async (_event, sessionId: string) => {
  const db = getDatabase();
  if (!db) return;
  
  // Get session info
  const session = db.prepare(
    'SELECT * FROM terminal_sessions WHERE id = ?'
  ).get(sessionId) as any;
  
  if (!session) return;
  
  // Get config
  const prefs = loadPreferences();
  const projPath = getProjectPath();
  const projectId = getProjectId(projPath);
  const config = prefs.projectContext?.[projectId] || getDefaultContextConfig();
  
  // Build updated context
  const updatedContext = assembleSessionUpdate(projPath, session, config);
  
  // Write to terminal
  if (session.terminal_id) {
    sendContextRefresh(session.terminal_id, updatedContext);
  }
  
  return true;
});

// Get session summaries
ipcMain.handle('get-session-summaries', async (_event, params: {
  limit?: number;
  offset?: number;
}) => {
  const projectPath = getProjectPath();
  const summariesFile = path.join(projectPath, 'agent', 'context', 'session-summaries.json');
  
  if (!fs.existsSync(summariesFile)) return [];
  
  try {
    const data = JSON.parse(fs.readFileSync(summariesFile, 'utf-8'));
    return data.summaries.slice(params.offset || 0, (params.offset || 0) + (params.limit || 20));
  } catch {
    return [];
  }
});

// Get deep memory
ipcMain.handle('get-deep-memory', async () => {
  const projectPath = getProjectPath();
  const memoryFile = path.join(projectPath, 'agent', 'context', 'deep-memory.json');
  
  if (!fs.existsSync(memoryFile)) return { patterns: [], preferences: [], project_insights: [] };
  
  try {
    return JSON.parse(fs.readFileSync(memoryFile, 'utf-8'));
  } catch {
    return { patterns: [], preferences: [], project_insights: [] };
  }
});

// Trigger session summarization
ipcMain.handle('summarize-session', async (_event, sessionId: string) => {
  const summary = await summarizeSession(sessionId);
  await saveSessionSummary(summary);
  return summary;
});
```

### Helper: Default Context Config

```typescript
function getDefaultContextConfig(): ProjectContextConfig {
  return {
    systems: {
      llm_wiki: {
        enabled: true,
        files: ['state.md', 'context.md', 'PROBLEMS.md', 'REQUESTS.md'],
        max_tokens: 2000,
      },
      obsidian_skills: {
        enabled: true,
        skills: [],
        max_tokens: 500,
      },
      graphify: {
        enabled: true,
        include_graph: false,
        include_summary: true,
        max_tokens: 500,
      },
      para: {
        enabled: false,
        areas: [],
        max_tokens: 300,
      },
      qmd: {
        enabled: true,
        templates: [],
        max_tokens: 200,
      },
      automations: {
        enabled: false,
        automations: [],
        max_tokens: 100,
      },
    },
    summarization: {
      enabled: true,
      message_threshold: 10,
      max_recent_messages: 5,
      summary_style: 'brief',
    },
    deep_memory: {
      enabled: true,
      pattern_detection: true,
      max_patterns: 20,
      retention_days: 90,
    },
    total_token_budget: 7000,
  };
}
```

---

## 9. Integration with Existing Initialize Flow

The current `initializeTerminal` function needs to use the new context assembly:

```typescript
// Modified initializeTerminal in TerminalPage.tsx

async function initializeTerminal(
  terminalId: string, 
  agent: string, 
  resumeId?: string
) {
  if (initializingTerminals.current.has(terminalId)) return;
  initializingTerminals.current.add(terminalId);
  
  try {
    // 1. Get context config for this project
    const config = await deskflowAPI.getContextConfig();
    
    // 2. Assemble system prompt using layered context
    const systemPrompt = await deskflowAPI.previewSystemPrompt({ agent, config });
    
    // 3. Get general additions from preferences
    const prefs = await deskflowAPI.getPreferences();
    const generalAdditions = prefs.systemPrompts?.[agent] || '';
    const projectAdditions = prefs.projectPrompts?.[selectedProjectId] || '';
    
    // 4. Merge: Identity + Context + User additions
    const mergedPrompt = [
      systemPrompt,          // Layer 0-4 from context assembly
      generalAdditions ? `\n## General Instructions\n${generalAdditions}` : '',
      projectAdditions ? `\n## Project Instructions\n${projectAdditions}` : '',
    ].filter(Boolean).join('\n');
    
    // 5. Write system prompt (raw — no DB record)
    await deskflowAPI.terminalWriteRaw(terminalId, mergedPrompt + '\r');
    
    // 6. Small delay for agent to process
    await new Promise(r => setTimeout(r, 500));
    
    // 7. Launch agent
    const launchCmd = getAgentLaunchCommand(agent, resumeId);
    await deskflowAPI.terminalWriteRaw(terminalId, launchCmd + '\r');
    
    // 8. Record context injections
    if (activeSessionId) {
      await recordContextInjections(activeSessionId, config, mergedPrompt);
    }
    
  } catch (err) {
    console.error('initializeTerminal failed:', err);
    showError(`Failed to initialize: ${err.message}`);
  } finally {
    initializingTerminals.current.delete(terminalId);
  }
}
```

---

## 10. File Change List

| File | Changes |
|------|---------|
| `src/main.ts` | 8 new IPC handlers (`get-context-systems`, `get-context-config`, `save-context-config`, `preview-system-prompt`, `get-context-injections`, `refresh-session-context`, `get-session-summaries`, `get-deep-memory`, `summarize-session`), `assembleSystemPrompt()`, `buildLLMWikiContext()`, `buildSkillIndex()`, `buildGraphifyContext()`, `buildParaContext()`, `buildQMDContext()`, `buildAutomationsContext()`, `buildSessionContext()`, `buildDeepMemoryContext()`, `summarizeSession()`, `detectPatterns()`, context_injections DB table creation |
| `src/preload.ts` | 9 new API bridges for context IPC handlers |
| `src/pages/TerminalPage.tsx` | Modified `initializeTerminal()` to use context assembly, added `SessionContextPanel` in sidebar, wired refresh/summarize actions |
| `src/components/NewSessionDialog.tsx` | Full redesign with 6 system toggle cards, Context Map visualization, behavior settings, token budget bar, system prompt preview |
| `src/App.tsx` | Type declarations for new `deskflowAPI` methods |
| `agent/context/session-summaries.json` | New file — session summary storage |
| `agent/context/deep-memory.json` | New file — deep memory storage |
| `agent/automations/automations.json` | New file — automation definitions |

---

## 11. Implementation Order

```
Phase 1: Backend Foundation
  ├─ Create agent/context/ directory
  ├─ Add context_injections DB table
  ├─ Implement token estimation utilities
  ├─ Implement per-system context builders (LLM Wiki, Skills, Graphify, PARA, QMD, Automations)
  ├─ Implement assembleSystemPrompt()
  ├─ Implement getDefaultContextConfig()
  └─ Add all IPC handlers

Phase 2: Setup Dialog Redesign
  ├─ SystemToggleCard component
  ├─ Context Map SVG visualization
  ├─ Per-system configuration panels (file picker, skill selector, etc.)
  ├─ Token budget bar
  ├─ System prompt preview
  └─ Behavior settings (summarization, deep memory)

Phase 3: Session Integration
  ├─ Modify initializeTerminal() to use context assembly
  ├─ Save/load context config per project
  ├─ Record context injections in DB
  └─ Context refresh on manual trigger

Phase 4: Session Summarization
  ├─ Summarize on session end
  ├─ Save summaries to session-summaries.json
  ├─ Deep memory pattern detection
  └─ Deep memory context builder

Phase 5: Session Context Panel
  ├─ Show active context in sidebar
  ├─ Token budget indicator
  ├─ Refresh/summarize buttons
  └─ Context history browser

Phase 6: Automations
  ├─ Create agent/automations/ directory + schema
  ├─ Automation editor in Setup dialog
  ├─ Event-driven triggers (file_changed, session_end, periodic)
  └─ Automation execution engine
```
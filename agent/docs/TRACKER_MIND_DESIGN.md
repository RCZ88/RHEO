Looking at your PROBLEMS.md format and the skills structure, I now have a clear picture. Let me design a concrete implementation.

## 🎯 Implementation Strategy

Based on your current setup, I recommend this approach:

### Agent Output Parsing Solution

Instead of parsing terminal output (which is unreliable), I propose a **Structured Action File**:

```
agent/.pending_actions.json
```

The AI agent writes to this file when it takes actions, and your app watches/polls this file for updates.

---

Let me start implementing. I'll begin with:

1. **Database schema** for problems
2. **PROBLEMS.md parser** that works with your existing format
3. **Dashboard page foundation** with problems panel
4. **IPC endpoints** for problem management

---

## 📁 New Files to Create

### 1. Database Schema Extensions

```typescript
// Add to main.ts - in initializeDatabase() function

// ═══════════════════════════════════════════════════════════════
// PROBLEM MANAGEMENT TABLES
// ═══════════════════════════════════════════════════════════════

await db.run(`
  CREATE TABLE IF NOT EXISTS workspace_problems (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'NEW',
    priority TEXT DEFAULT 'medium',
    category TEXT,
    terminal_id TEXT,
    session_id TEXT,
    skill_used TEXT,
    files TEXT,
    root_cause TEXT,
    user_notes TEXT,
    fix_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    source TEXT DEFAULT 'user',
    project_id TEXT
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS problem_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    actor TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES workspace_problems(id)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS terminal_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_id TEXT NOT NULL UNIQUE,
    project_id TEXT,
    purpose TEXT,
    active_problem_id TEXT,
    active_request_id TEXT,
    agent_type TEXT,
    session_context TEXT,
    status TEXT DEFAULT 'idle',
    last_activity_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (active_problem_id) REFERENCES workspace_problems(id)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS pending_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    problem_id TEXT,
    request_id TEXT,
    terminal_id TEXT,
    session_id TEXT,
    description TEXT,
    file_path TEXT,
    details TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (problem_id) REFERENCES workspace_problems(id)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS workspace_requests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'feature',
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    terminal_id TEXT,
    session_id TEXT,
    implementer TEXT,
    complexity TEXT DEFAULT 'medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    implemented_at DATETIME,
    project_id TEXT
  )
`);
```

---

### 2. Problems Markdown Parser

```typescript
// src/services/ProblemsParser.ts

export interface ParsedProblem {
  id: string;
  title: string;
  status: string;
  priority: string;
  files: string[];
  description: string;
  user_notes: string;
  fix_description: string;
  root_cause: string;
  category: string;
  session_date: string | null;
}

export class ProblemsParser {
  
  /**
   * Parse the PROBLEMS.md file content into structured problems
   */
  parse(content: string): ParsedProblem[] {
    const problems: ParsedProblem[] = [];
    
    // Split by issue pattern: **Issue XX:**
    const issuePattern = /\*\*Issue (\d+):\s*(.+?)\*\*/g;
    let match;
    
    // Find all issue matches first
    const issues: { index: number; id: string; title: string }[] = [];
    while ((match = issuePattern.exec(content)) !== null) {
      issues.push({
        index: match.index,
        id: `Issue ${match[1]}`,
        title: match[2].trim()
      });
    }
    
    // Parse each issue's content
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const nextIndex = i + 1 < issues.length ? issues[i + 1].index : content.length;
      const issueContent = content.substring(issue.index, nextIndex);
      
      const problem = this.parseIssueBlock(issue.id, issue.title, issueContent);
      problems.push(problem);
    }
    
    return problems;
  }
  
  private parseIssueBlock(id: string, title: string, content: string): ParsedProblem {
    const problem: ParsedProblem = {
      id,
      title,
      status: 'NEW',
      priority: 'medium',
      files: [],
      description: '',
      user_notes: '',
      fix_description: '',
      root_cause: '',
      category: '',
      session_date: null
    };
    
    // Extract status
    const statusMatch = content.match(/- Status:\s*(.+)/);
    if (statusMatch) {
      problem.status = statusMatch[1].trim();
    }
    
    // Extract files
    const filesMatch = content.match(/- Files:\s*(.+)/);
    if (filesMatch) {
      problem.files = filesMatch[1].split(',').map(f => f.trim()).filter(Boolean);
    }
    
    // Extract user notes (User said:)
    const userSaidMatch = content.match(/- User said:\s*"(.+?)"/s);
    if (userSaidMatch) {
      problem.user_notes = userSaidMatch[1].trim();
    }
    
    // Extract fix description
    const fixMatch = content.match(/- Fix:\s*([\s\S]+?)(?=- |\*\*Issue|\n##|$)/);
    if (fixMatch) {
      problem.fix_description = fixMatch[1].trim();
    }
    
    // Extract root cause
    const rootCauseMatch = content.match(/- Root Cause:\s*(.+)/);
    if (rootCauseMatch) {
      problem.root_cause = rootCauseMatch[1].trim();
    }
    
    // Check for session date (## 🚨 YYYY-MM-DD SESSION)
    const sessionMatch = content.match(/## 🚨 (\d{4}-\d{2}-\d{2}) SESSION/);
    if (sessionMatch) {
      problem.session_date = sessionMatch[1];
    }
    
    // Determine category from content
    if (content.includes('Terminal') || content.includes('terminal')) {
      problem.category = 'terminal';
    } else if (content.includes('Dashboard') || content.includes('dashboard')) {
      problem.category = 'dashboard';
    } else if (content.includes('External') || content.includes('external')) {
      problem.category = 'external';
    }
    
    return problem;
  }
  
  /**
   * Generate PROBLEMS.md content from structured problems
   */
  generate(problems: ParsedProblem[], headerInfo?: { lastUpdated: string; totalIssues: number }): string {
    let content = `# PROBLEMS.md - Comprehensive Issue List

**Last Updated:** ${headerInfo?.lastUpdated || new Date().toISOString().split('T')[0]}
**Total Issues:** ${headerInfo?.totalIssues || problems.length}

---

## 🚨 STATUS LEGEND (MUST READ)

| Status | Meaning | What to do |
|--------|---------|------------|
| **NEW** | Just reported, not looked at yet | Investigate and reproduce |
| **Not Started** | Has been looked at but not fixed yet | Start working on it |
| **In Progress** | Currently being fixed | Keep working |
| **AI Attempted Fix** | Made changes, needs user testing | Wait for user to test |
| **User Testing** | User is testing the fix | Wait for user feedback |
| **Fixed** | User confirmed it works | Document solution |
| **Irrelevant** | Feature changed, issue no longer applies | Document why |

---

`;

    // Group by session date (most recent first)
    const bySession = this.groupBySession(problems);
    const sortedSessions = Object.keys(bySession).sort((a, b) => b.localeCompare(a));
    
    for (const sessionDate of sortedSessions) {
      if (sessionDate !== 'unknown') {
        content += `## 🚨 ${sessionDate} SESSION\n\n`;
      }
      
      for (const problem of bySession[sessionDate]) {
        content += this.formatProblem(problem);
      }
    }
    
    // Add category summary at the end
    content += this.generateCategorySummary(problems);
    
    return content;
  }
  
  private formatProblem(problem: ParsedProblem): string {
    let block = `**${problem.id}: ${problem.title}**\n`;
    block += `- Status: ${problem.status}\n`;
    
    if (problem.user_notes) {
      block += `- User said: "${problem.user_notes}"\n`;
    }
    
    if (problem.files.length > 0) {
      block += `- Files: ${problem.files.join(', ')}\n`;
    }
    
    if (problem.fix_description) {
      block += `- Fix: ${problem.fix_description}\n`;
    }
    
    if (problem.root_cause) {
      block += `- Root Cause: ${problem.root_cause}\n`;
    }
    
    block += '\n';
    return block;
  }
  
  private groupBySession(problems: ParsedProblem[]): Record<string, ParsedProblem[]> {
    const grouped: Record<string, ParsedProblem[]> = {};
    
    for (const problem of problems) {
      const session = problem.session_date || 'unknown';
      if (!grouped[session]) {
        grouped[session] = [];
      }
      grouped[session].push(problem);
    }
    
    return grouped;
  }
  
  private generateCategorySummary(problems: ParsedProblem[]): string {
    const categories: Record<string, string[]> = {};
    
    for (const problem of problems) {
      const cat = problem.category || 'other';
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(problem.id);
    }
    
    let summary = '\n---\n\n## 📋 ISSUES BY CATEGORY\n\n';
    
    for (const [category, ids] of Object.entries(categories)) {
      const categoryName = this.formatCategoryName(category);
      summary += `### ${categoryName} Issues\n`;
      summary += `${ids.join(', ')}\n\n`;
    }
    
    return summary;
  }
  
  private formatCategoryName(category: string): string {
    const names: Record<string, string> = {
      'terminal': 'Terminal',
      'dashboard': 'Dashboard',
      'external': 'External Page',
      'other': 'Other'
    };
    return names[category] || category;
  }
}
```

---

### 3. Problems Sync Service

```typescript
// src/services/ProblemsSyncService.ts

import { ProblemsParser, ParsedProblem } from './ProblemsParser';
import * as fs from 'fs';
import * as path from 'path';

export class ProblemsSyncService {
  private parser: ProblemsParser;
  private db: any;
  private projectPath: string;
  private projectId: string;
  
  constructor(db: any, projectPath: string, projectId: string) {
    this.parser = new ProblemsParser();
    this.db = db;
    this.projectPath = projectPath;
    this.projectId = projectId;
  }
  
  /**
   * Sync from PROBLEMS.md to database
   * Call this on app startup or when file changes
   */
  async syncFromMarkdown(): Promise<{ added: number; updated: number; unchanged: number }> {
    const filePath = path.join(this.projectPath, 'agent', 'PROBLEMS.md');
    
    if (!fs.existsSync(filePath)) {
      return { added: 0, updated: 0, unchanged: 0 };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsedProblems = this.parser.parse(content);
    
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    
    for (const parsed of parsedProblems) {
      const existing = await this.db.get(
        'SELECT * FROM workspace_problems WHERE id = ?',
        [parsed.id]
      );
      
      if (existing) {
        // Check if anything changed
        if (existing.status !== parsed.status || 
            existing.title !== parsed.title ||
            existing.user_notes !== parsed.user_notes) {
          
          await this.db.run(
            `UPDATE workspace_problems 
             SET title = ?, status = ?, user_notes = ?, fix_description = ?, 
                 files = ?, root_cause = ?, category = ?, updated_at = ?
             WHERE id = ?`,
            [
              parsed.title,
              parsed.status,
              parsed.user_notes,
              parsed.fix_description,
              JSON.stringify(parsed.files),
              parsed.root_cause,
              parsed.category,
              new Date().toISOString(),
              parsed.id
            ]
          );
          updated++;
        } else {
          unchanged++;
        }
      } else {
        // Insert new problem
        await this.db.run(
          `INSERT INTO workspace_problems 
           (id, title, status, priority, files, user_notes, fix_description, 
            root_cause, category, source, project_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'markdown', ?, ?)`,
          [
            parsed.id,
            parsed.title,
            parsed.status,
            parsed.priority,
            JSON.stringify(parsed.files),
            parsed.user_notes,
            parsed.fix_description,
            parsed.root_cause,
            parsed.category,
            this.projectId,
            new Date().toISOString()
          ]
        );
        added++;
      }
    }
    
    return { added, updated, unchanged };
  }
  
  /**
   * Sync from database to PROBLEMS.md
   * Call this after UI changes or AI updates
   */
  async syncToMarkdown(): Promise<void> {
    const problems = await this.db.all(
      `SELECT * FROM workspace_problems 
       WHERE project_id = ? OR project_id IS NULL
       ORDER BY created_at DESC`,
      [this.projectId]
    );
    
    const parsedProblems: ParsedProblem[] = problems.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      priority: p.priority,
      files: p.files ? JSON.parse(p.files) : [],
      description: p.description || '',
      user_notes: p.user_notes || '',
      fix_description: p.fix_description || '',
      root_cause: p.root_cause || '',
      category: p.category || '',
      session_date: p.created_at ? p.created_at.split('T')[0] : null
    }));
    
    const content = this.parser.generate(parsedProblems, {
      lastUpdated: new Date().toISOString().split('T')[0],
      totalIssues: parsedProblems.length
    });
    
    const agentDir = path.join(this.projectPath, 'agent');
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }
    
    const filePath = path.join(agentDir, 'PROBLEMS.md');
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  
  /**
   * Update a single problem and sync to markdown
   */
  async updateProblem(problemId: string, updates: Partial<{
    status: string;
    terminal_id: string;
    skill_used: string;
    fix_description: string;
    user_notes: string;
  }>): Promise<void> {
    const setClause = Object.keys(updates)
      .map(k => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(updates), new Date().toISOString(), problemId];
    
    await this.db.run(
      `UPDATE workspace_problems SET ${setClause}, updated_at = ? WHERE id = ?`,
      values
    );
    
    // Add to history
    for (const [key, value] of Object.entries(updates)) {
      await this.db.run(
        `INSERT INTO problem_history (problem_id, action, new_value, actor)
         VALUES (?, ?, ?, 'user')`,
        [problemId, `${key}_changed`, value]
      );
    }
    
    // Sync to markdown
    await this.syncToMarkdown();
  }
  
  /**
   * Create a new problem from user input
   */
  async createProblem(data: {
    title: string;
    description?: string;
    user_notes?: string;
    files?: string[];
    priority?: string;
    category?: string;
  }): Promise<string> {
    // Get next issue number
    const lastIssue = await this.db.get(
      `SELECT id FROM workspace_problems 
       WHERE id LIKE 'Issue %' 
       ORDER BY CAST(SUBSTR(id, 7) AS INTEGER) DESC 
       LIMIT 1`
    );
    
    let nextNum = 1;
    if (lastIssue) {
      const match = lastIssue.id.match(/Issue (\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    
    const id = `Issue ${nextNum}`;
    
    await this.db.run(
      `INSERT INTO workspace_problems 
       (id, title, description, status, priority, files, user_notes, category, 
        source, project_id, created_at)
       VALUES (?, ?, ?, 'NEW', ?, ?, ?, ?, 'user', ?, ?)`,
      [
        id,
        data.title,
        data.description || '',
        data.priority || 'medium',
        JSON.stringify(data.files || []),
        data.user_notes || '',
        data.category || '',
        this.projectId,
        new Date().toISOString()
      ]
    );
    
    // Add to history
    await this.db.run(
      `INSERT INTO problem_history (problem_id, action, actor)
       VALUES (?, 'created', 'user')`,
      [id]
    );
    
    // Sync to markdown
    await this.syncToMarkdown();
    
    return id;
  }
}
```

---

### 4. Dashboard Page with Problems Panel

```tsx
// src/pages/DashboardPage.tsx (NEW VERSION - Problem Management Dashboard)

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface Problem {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  terminal_id: string | null;
  skill_used: string | null;
  user_notes: string | null;
  fix_description: string | null;
  files: string[];
  created_at: string;
  updated_at: string;
}

interface TerminalBinding {
  terminal_id: string;
  agent_type: string;
  status: string;
  active_problem_id: string | null;
  session_context: string | null;
}

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  'NEW': { color: 'bg-red-500', icon: '🔴', label: 'New' },
  'Not Started': { color: 'bg-gray-500', icon: '⚪', label: 'Not Started' },
  'In Progress': { color: 'bg-blue-500', icon: '🔵', label: 'In Progress' },
  'AI Attempted Fix': { color: 'bg-yellow-500', icon: '🟡', label: 'AI Attempted' },
  'User Testing': { color: 'bg-purple-500', icon: '🟣', label: 'User Testing' },
  'Fixed': { color: 'bg-green-500', icon: '🟢', label: 'Fixed' },
  'Irrelevant': { color: 'bg-gray-400', icon: '⚫', label: 'Irrelevant' }
};

const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
  'critical': { color: 'text-red-400', icon: '🔥' },
  'high': { color: 'text-orange-400', icon: '⚠️' },
  'medium': { color: 'text-yellow-400', icon: '📋' },
  'low': { color: 'text-gray-400', icon: '📌' }
};

export const AgentDashboardPage: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [terminals, setTerminals] = useState<TerminalBinding[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewProblemDialog, setShowNewProblemDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  
  // Load problems
  const loadProblems = useCallback(async () => {
    const result = await window.deskflowAPI?.getProblems?.();
    if (result?.success) {
      setProblems(result.data || []);
    }
  }, []);
  
  // Load terminals
  const loadTerminals = useCallback(async () => {
    const result = await window.deskflowAPI?.getTerminalBindings?.();
    if (result?.success) {
      setTerminals(result.data || []);
    }
  }, []);
  
  useEffect(() => {
    loadProblems();
    loadTerminals();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      loadProblems();
      loadTerminals();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadProblems, loadTerminals]);
  
  // Filter problems
  const filteredProblems = problems.filter(p => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return ['NEW', 'In Progress', 'AI Attempted Fix', 'User Testing'].includes(p.status);
    return p.status === filterStatus;
  });
  
  // Group by status for display
  const groupedProblems = filteredProblems.reduce((acc, p) => {
    const status = p.status || 'NEW';
    if (!acc[status]) acc[status] = [];
    acc[status].push(p);
    return acc;
  }, {} as Record<string, Problem[]>);
  
  // Get terminal working on a problem
  const getTerminalForProblem = (problemId: string) => {
    return terminals.find(t => t.active_problem_id === problemId);
  };
  
  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agent Dashboard</h1>
            <p className="text-gray-400 text-sm">Manage problems, assign to terminals, track progress</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
            >
              <option value="all">All Issues</option>
              <option value="active">Active Issues</option>
              <option value="NEW">New</option>
              <option value="In Progress">In Progress</option>
              <option value="AI Attempted Fix">AI Attempted</option>
              <option value="User Testing">User Testing</option>
              <option value="Fixed">Fixed</option>
            </select>
            <button
              onClick={() => setShowNewProblemDialog(true)}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded flex items-center gap-2"
            >
              <span>➕</span> New Problem
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Problems Panel */}
        <div className="w-1/2 border-r border-gray-700 overflow-y-auto p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>📋</span> Problems
            <span className="text-gray-400 text-sm">({filteredProblems.length})</span>
          </h2>
          
          {Object.entries(groupedProblems).map(([status, statusProblems]) => (
            <div key={status} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span>{STATUS_CONFIG[status]?.icon || '❓'}</span>
                <h3 className="font-medium">{STATUS_CONFIG[status]?.label || status}</h3>
                <span className="text-gray-500 text-sm">({statusProblems.length})</span>
              </div>
              
              <div className="space-y-2">
                {statusProblems.map(problem => (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    terminal={getTerminalForProblem(problem.id)}
                    isSelected={selectedProblem?.id === problem.id}
                    onClick={() => setSelectedProblem(problem)}
                    onAssign={() => {
                      setSelectedProblem(problem);
                      setShowAssignDialog(true);
                    }}
                    onStatusChange={(newStatus) => handleStatusChange(problem.id, newStatus)}
                  />
                ))}
              </div>
            </div>
          ))}
          
          {filteredProblems.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No problems found
            </div>
          )}
        </div>
        
        {/* Detail Panel */}
        <div className="w-1/2 overflow-y-auto p-4 bg-gray-800/50">
          {selectedProblem ? (
            <ProblemDetailPanel
              problem={selectedProblem}
              terminal={getTerminalForProblem(selectedProblem.id)}
              onAssign={() => setShowAssignDialog(true)}
              onStatusChange={(status) => handleStatusChange(selectedProblem.id, status)}
              onClose={() => setSelectedProblem(null)}
            />
          ) : (
            <div className="text-center text-gray-500 py-8">
              Select a problem to view details
            </div>
          )}
        </div>
      </div>
      
      {/* Terminal Quick View */}
      <div className="h-24 bg-gray-800 border-t border-gray-700 px-4 py-2">
        <TerminalQuickView terminals={terminals} onTerminalClick={handleTerminalClick} />
      </div>
      
      {/* Dialogs */}
      {showNewProblemDialog && (
        <NewProblemDialog
          onClose={() => setShowNewProblemDialog(false)}
          onCreated={() => {
            setShowNewProblemDialog(false);
            loadProblems();
          }}
        />
      )}
      
      {showAssignDialog && selectedProblem && (
        <AssignProblemDialog
          problem={selectedProblem}
          terminals={terminals}
          onClose={() => setShowAssignDialog(false)}
          onAssigned={() => {
            setShowAssignDialog(false);
            loadProblems();
            loadTerminals();
          }}
        />
      )}
    </div>
  );
  
  async function handleStatusChange(problemId: string, newStatus: string) {
    await window.deskflowAPI?.updateProblemStatus?.({ problemId, status: newStatus });
    loadProblems();
  }
  
  function handleTerminalClick(terminalId: string) {
    // Open terminal view
    console.log('Open terminal:', terminalId);
  }
};

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

const ProblemCard: React.FC<{
  problem: Problem;
  terminal?: TerminalBinding;
  isSelected: boolean;
  onClick: () => void;
  onAssign: () => void;
  onStatusChange: (status: string) => void;
}> = ({ problem, terminal, isSelected, onClick, onAssign, onStatusChange }) => {
  const statusConfig = STATUS_CONFIG[problem.status] || STATUS_CONFIG['NEW'];
  const priorityConfig = PRIORITY_CONFIG[problem.priority] || PRIORITY_CONFIG['medium'];
  
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-purple-600/30 border border-purple-500' : 'bg-gray-800 hover:bg-gray-700'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{problem.id}</span>
            <span className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
            <span className="text-xs">{priorityConfig.icon}</span>
          </div>
          <h4 className="font-medium truncate">{problem.title}</h4>
          {problem.user_notes && (
            <p className="text-sm text-gray-400 truncate mt-1">"{problem.user_notes.slice(0, 50)}..."</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {terminal && (
            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
              {terminal.terminal_id}
            </span>
          )}
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
        <button
          onClick={(e) => { e.stopPropagation(); onAssign(); }}
          className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
        >
          Assign
        </button>
        {problem.status === 'AI Attempted Fix' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange('User Testing'); }}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
          >
            Start Testing
          </button>
        )}
        {problem.status === 'User Testing' && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange('Fixed'); }}
              className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
            >
              ✓ Fixed
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange('In Progress'); }}
              className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
            >
              ✗ Not Fixed
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const ProblemDetailPanel: React.FC<{
  problem: Problem;
  terminal?: TerminalBinding;
  onAssign: () => void;
  onStatusChange: (status: string) => void;
  onClose: () => void;
}> = ({ problem, terminal, onAssign, onStatusChange, onClose }) => {
  const statusConfig = STATUS_CONFIG[problem.status] || STATUS_CONFIG['NEW'];
  
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-gray-400">{problem.id}</span>
            <span className={`text-sm ${statusConfig.color} px-2 py-0.5 rounded`}>
              {statusConfig.label}
            </span>
          </div>
          <h2 className="text-xl font-bold">{problem.title}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      
      {/* Terminal Assignment */}
      {terminal ? (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <span>💻</span>
            <span className="text-blue-300">Working on Terminal: {terminal.terminal_id}</span>
            <span className={`w-2 h-2 rounded-full ${
              terminal.status === 'working' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`} />
          </div>
          {terminal.session_context && (
            <p className="text-sm text-gray-400 mt-1">{terminal.session_context}</p>
          )}
        </div>
      ) : (
        <button
          onClick={onAssign}
          className="w-full bg-purple-600 hover:bg-purple-700 rounded-lg p-3 mb-4 flex items-center justify-center gap-2"
        >
          <span>📍</span> Assign to Terminal
        </button>
      )}
      
      {/* User Notes */}
      {problem.user_notes && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">User Notes</h3>
          <p className="bg-gray-700/50 rounded p-3 text-sm italic">"{problem.user_notes}"</p>
        </div>
      )}
      
      {/* Fix Description */}
      {problem.fix_description && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Fix Applied</h3>
          <div className="bg-gray-700/50 rounded p-3 text-sm">
            {problem.fix_description}
          </div>
        </div>
      )}
      
      {/* Files */}
      {problem.files && problem.files.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-1">Related Files</h3>
          <div className="space-y-1">
            {problem.files.map((file, i) => (
              <code key={i} className="block text-xs bg-gray-700/50 rounded px-2 py-1">
                {file}
              </code>
            ))}
          </div>
        </div>
      )}
      
      {/* Status Actions */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Change Status</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={`px-3 py-1 rounded text-sm ${
                problem.status === status
                  ? `${config.color} text-white`
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TerminalQuickView: React.FC<{
  terminals: TerminalBinding[];
  onTerminalClick: (id: string) => void;
}> = ({ terminals, onTerminalClick }) => {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">Terminals</h3>
      <div className="flex gap-2">
        {terminals.map(terminal => (
          <button
            key={terminal.terminal_id}
            onClick={() => onTerminalClick(terminal.terminal_id)}
            className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${
              terminal.status === 'working' ? 'bg-green-600/20 border border-green-500/50' :
              terminal.status === 'waiting_input' ? 'bg-yellow-600/20 border border-yellow-500/50' :
              'bg-gray-700 border border-gray-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              terminal.status === 'working' ? 'bg-green-500 animate-pulse' :
              terminal.status === 'waiting_input' ? 'bg-yellow-500' :
              'bg-gray-500'
            }`} />
            <span>{terminal.terminal_id}</span>
            {terminal.active_problem_id && (
              <span className="text-xs text-purple-300">{terminal.active_problem_id}</span>
            )}
          </button>
        ))}
        <button className="px-3 py-2 rounded text-sm bg-gray-700 border border-gray-600 hover:bg-gray-600">
          + New Terminal
        </button>
      </div>
    </div>
  );
};

const NewProblemDialog: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');
  
  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    const result = await window.deskflowAPI?.createProblem?.({
      title,
      description,
      priority,
      category
    });
    
    if (result?.success) {
      onCreated();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">New Problem</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="Brief description of the issue"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 h-24"
              placeholder="Detailed description..."
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="">Select...</option>
                <option value="terminal">Terminal</option>
                <option value="dashboard">Dashboard</option>
                <option value="external">External Page</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700"
          >
            Create Problem
          </button>
        </div>
      </div>
    </div>
  );
};

const AssignProblemDialog: React.FC<{
  problem: Problem;
  terminals: TerminalBinding[];
  onClose: () => void;
  onAssigned: () => void;
}> = ({ problem, terminals, onClose, onAssigned }) => {
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [skills, setSkills] = useState<any[]>([]);
  
  useEffect(() => {
    loadSkills();
  }, []);
  
  const loadSkills = async () => {
    const result = await window.deskflowAPI?.getSkills?.();
    if (result?.success) {
      setSkills(result.data || []);
    }
  };
  
  const handleAssign = async () => {
    const result = await window.deskflowAPI?.assignProblemToTerminal?.({
      problemId: problem.id,
      terminalId: selectedTerminal || null,
      skillId: selectedSkill || null,
      systemPrompt: systemPrompt || null
    });
    
    if (result?.success) {
      onAssigned();
    }
  };
  
  const idleTerminals = terminals.filter(t => t.status === 'idle');
  const workingTerminals = terminals.filter(t => t.status !== 'idle');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-2">Assign Problem</h2>
        <p className="text-gray-400 mb-4">{problem.id}: {problem.title}</p>
        
        <div className="space-y-4">
          {/* Terminal Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Terminal</label>
            <div className="space-y-2">
              {idleTerminals.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Idle Terminals</p>
                  <div className="flex flex-wrap gap-2">
                    {idleTerminals.map(t => (
                      <button
                        key={t.terminal_id}
                        onClick={() => setSelectedTerminal(t.terminal_id)}
                        className={`px-3 py-2 rounded text-sm ${
                          selectedTerminal === t.terminal_id
                            ? 'bg-purple-600 border border-purple-400'
                            : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                        }`}
                      >
                        {t.terminal_id} ({t.agent_type || 'idle'})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {workingTerminals.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Working Terminals (will interrupt)</p>
                  <div className="flex flex-wrap gap-2">
                    {workingTerminals.map(t => (
                      <button
                        key={t.terminal_id}
                        onClick={() => setSelectedTerminal(t.terminal_id)}
                        className={`px-3 py-2 rounded text-sm ${
                          selectedTerminal === t.terminal_id
                            ? 'bg-orange-600 border border-orange-400'
                            : 'bg-gray-700 border border-gray-600 hover:bg-gray-600 opacity-70'
                        }`}
                      >
                        {t.terminal_id} ({t.active_problem_id})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <button
                onClick={() => setSelectedTerminal('new')}
                className={`px-3 py-2 rounded text-sm ${
                  selectedTerminal === 'new'
                    ? 'bg-green-600 border border-green-400'
                    : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                }`}
              >
                + Create New Terminal
              </button>
            </div>
          </div>
          
          {/* Skill Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Skill (Optional)</label>
            <div className="grid grid-cols-3 gap-2">
              {skills.filter(s => s.applicable_to?.includes('problems')).map(skill => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill.id)}
                  className={`p-2 rounded text-sm text-left ${
                    selectedSkill === skill.id
                      ? 'bg-purple-600 border border-purple-400'
                      : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{skill.name}</div>
                  <div className="text-xs text-gray-400">{skill.description}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* System Prompt */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Additional Instructions (Optional)</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 h-20"
              placeholder="Any specific instructions for the agent..."
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700"
          >
            Assign & Start
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentDashboardPage;
```

---

### 5. IPC Handlers (Add to main.ts)

```typescript
// Add to main.ts - IPC Handlers for Problem Management

// ═══════════════════════════════════════════════════════════════
// PROBLEM MANAGEMENT IPC
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('get-problems', async (event) => {
  try {
    const problems = await getDb().all(
      `SELECT * FROM workspace_problems ORDER BY 
       CASE status 
         WHEN 'NEW' THEN 1 
         WHEN 'In Progress' THEN 2 
         WHEN 'AI Attempted Fix' THEN 3 
         WHEN 'User Testing' THEN 4 
         ELSE 5 
       END,
       created_at DESC`
    );
    
    // Parse files JSON
    const parsedProblems = problems.map(p => ({
      ...p,
      files: p.files ? JSON.parse(p.files) : []
    }));
    
    return { success: true, data: parsedProblems };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-problem', async (event, data: {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  files?: string[];
  user_notes?: string;
}) => {
  try {
    const db = getDb();
    
    // Get next issue number
    const lastIssue = await db.get(
      `SELECT id FROM workspace_problems 
       WHERE id LIKE 'Issue %' 
       ORDER BY CAST(SUBSTR(id, 7) AS INTEGER) DESC 
       LIMIT 1`
    );
    
    let nextNum = 1;
    if (lastIssue) {
      const match = lastIssue.id.match(/Issue (\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    
    const id = `Issue ${nextNum}`;
    const now = new Date().toISOString();
    
    await db.run(
      `INSERT INTO workspace_problems 
       (id, title, description, status, priority, category, files, user_notes, source, created_at)
       VALUES (?, ?, ?, 'NEW', ?, ?, ?, ?, 'user', ?)`,
      [
        id,
        data.title,
        data.description || '',
        data.priority || 'medium',
        data.category || '',
        JSON.stringify(data.files || []),
        data.user_notes || '',
        now
      ]
    );
    
    // Add to history
    await db.run(
      `INSERT INTO problem_history (problem_id, action, actor, created_at)
       VALUES (?, 'created', 'user', ?)`,
      [id, now]
    );
    
    return { success: true, data: { id } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-problem-status', async (event, { problemId, status }: {
  problemId: string;
  status: string;
}) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    
    await db.run(
      `UPDATE workspace_problems SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, problemId]
    );
    
    // Add to history
    await db.run(
      `INSERT INTO problem_history (problem_id, action, new_value, actor, created_at)
       VALUES (?, 'status_changed', ?, 'user', ?)`,
      [problemId, status, now]
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('assign-problem-to-terminal', async (event, {
  problemId,
  terminalId,
  skillId,
  systemPrompt
}: {
  problemId: string;
  terminalId?: string;
  skillId?: string;
  systemPrompt?: string;
}) => {
  try {
    const db = getDb();
    
    // Get problem
    const problem = await db.get(
      'SELECT * FROM workspace_problems WHERE id = ?',
      [problemId]
    );
    
    if (!problem) {
      return { success: false, error: 'Problem not found' };
    }
    
    // Determine terminal
    let targetTerminal = terminalId;
    let isNewTerminal = terminalId === 'new';
    
    if (isNewTerminal) {
      // Create new terminal
      const terminalNum = Date.now();
      targetTerminal = `term-${terminalNum}`;
      
      // Spawn terminal
      const result = await spawnTerminal(targetTerminal, process.cwd());
      if (!result?.success) {
        return { success: false, error: 'Failed to create terminal' };
      }
    }
    
    // Update problem
    await db.run(
      `UPDATE workspace_problems 
       SET status = 'In Progress', terminal_id = ?, skill_used = ?, updated_at = ?
       WHERE id = ?`,
      [targetTerminal, skillId || null, new Date().toISOString(), problemId]
    );
    
    // Update/create terminal binding
    await db.run(
      `INSERT OR REPLACE INTO terminal_bindings 
       (terminal_id, active_problem_id, status, session_context, last_activity_at)
       VALUES (?, ?, 'working', ?, ?)`,
      [targetTerminal, problemId, problem.title, new Date().toISOString()]
    );
    
    // Build prompt
    let prompt = `Work on ${problemId}: ${problem.title}\n\n`;
    if (problem.user_notes) {
      prompt += `User notes: "${problem.user_notes}"\n\n`;
    }
    if (problem.description) {
      prompt += `Description: ${problem.description}\n\n`;
    }
    
    // Get skill if specified
    if (skillId) {
      const skill = await db.get(
        'SELECT * FROM skill_templates WHERE id = ?',
        [skillId]
      );
      
      if (skill) {
        // Use skill prompt template
        let skillPrompt = skill.prompt_template;
        skillPrompt = skillPrompt.replace('{{problem_id}}', problemId);
        skillPrompt = skillPrompt.replace('{{problem_title}}', problem.title);
        skillPrompt = skillPrompt.replace('{{problem_description}}', problem.description || '');
        skillPrompt = skillPrompt.replace('{{user_notes}}', problem.user_notes || '');
        
        prompt = skillPrompt;
      }
    }
    
    // Add system prompt if provided
    if (systemPrompt) {
      prompt = `System instruction: ${systemPrompt}\n\n${prompt}`;
    }
    
    // Write to terminal (start agent if needed)
    // First check if agent is running
    const agentCommand = 'opencode'; // Default agent
    await terminalWrite(targetTerminal, `${agentCommand}\n`);
    
    // Wait a bit for agent to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send the prompt
    await terminalWrite(targetTerminal, prompt + '\n');
    
    // Add to history
    await db.run(
      `INSERT INTO problem_history (problem_id, action, new_value, actor, notes, created_at)
       VALUES (?, 'assigned', ?, 'user', ?, ?)`,
      [problemId, targetTerminal, `Skill: ${skillId || 'none'}`, new Date().toISOString()]
    );
    
    return { success: true, data: { terminalId: targetTerminal } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-terminal-bindings', async (event) => {
  try {
    const bindings = await getDb().all(
      'SELECT * FROM terminal_bindings ORDER BY last_activity_at DESC'
    );
    return { success: true, data: bindings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-skills', async (event) => {
  try {
    const skills = await getDb().all(
      'SELECT * FROM skill_templates WHERE is_active = 1 ORDER BY name'
    );
    return { success: true, data: skills };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

---

### 6. Preload API Extensions

```typescript
// Add to preload.ts

// Problem Management
getProblems: () => ipcRenderer.invoke('get-problems'),
createProblem: (data: any) => ipcRenderer.invoke('create-problem', data),
updateProblemStatus: (data: { problemId: string; status: string }) => 
  ipcRenderer.invoke('update-problem-status', data),
assignProblemToTerminal: (data: {
  problemId: string;
  terminalId?: string;
  skillId?: string;
  systemPrompt?: string;
}) => ipcRenderer.invoke('assign-problem-to-terminal', data),

// Terminal Bindings
getTerminalBindings: () => ipcRenderer.invoke('get-terminal-bindings'),

// Skills
getSkills: () => ipcRenderer.invoke('get-skills'),
```

---

## 🚀 Implementation Order

I recommend this sequence:

### Phase 1 (Immediate - This Session)
1. **Add database tables** to `main.ts` → `initializeDatabase()`
2. **Create ProblemsParser.ts** - Parse your existing PROBLEMS.md format
3. **Add IPC handlers** for basic problem CRUD
4. **Create basic DashboardPage.tsx** - Show problems list

### Phase 2 (Next Session)
5. **Sync service** - Bi-directional sync with PROBLEMS.md
6. **Terminal bindings** - Track which terminal is working on what
7. **Assignment dialog** - Assign problems to terminals

### Phase 3 (Future)
8. **Skill integration** - Load from SKILL.md files
9. **Action reports** - Track what the AI has done
10. **Requests.md integration** - Similar to problems

---

## ❓ Quick Question Before I Continue

Should I:

**A)** Continue implementing more components (full dialog components, sync service, etc.)

**B)** Focus on making the PROBLEMS.md parser work perfectly with your existing format

**C)** Create a minimal working prototype first (just the problems list + status updates)

**D)** Something else you have in mind?

Also, I noticed your PROBLEMS.md uses "Issue XX" format. Should new problems auto-increment from the highest existing number (e.g., next would be Issue 74)?
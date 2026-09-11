# RESULT — Checklist Algorithm Revamp

## Phase 1 — Data Model Extensions

### 1a. Extend `ProblemsService.Problem` Interface

**File:** `src/services/ProblemsService.ts`

```typescript
// ADD to the existing Problem interface (currently at line 4-21):

interface CheckItem {
  id: string;               // e.g. "problem-1.5-check-1"
  description: string;      // What needs to be done
  instruction: string;      // Verification instruction
  status: 'pending' | 'in_progress' | 'completed';
  feedback?: CheckFeedback;  // NEW — user feedback on this check
  session_id?: string;       // NEW — which session tested this
  created_at: string;
  updated_at: string;
}

interface CheckFeedback {
  type: 'approved' | 'rejected' | 'text';
  value?: string;            // Text feedback if type='text'
  timestamp: string;
  session_id?: string;       // Which session received the feedback
  terminal_id?: string;      // Which terminal was used
}

// Extend Problem interface:
interface Problem {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  terminal_id: string | null;
  skill_used: string | null;
  user_notes: string | null;
  session_id: string | null;
  session_name: string | null;
  description?: string;
  fix_description?: string;
  root_cause?: string;
  files: string[];
  checks: CheckItem[];       // ← NEW (defaults to [] for old data)
  created_at: string;
  updated_at: string;
}
```

### 1b. Add Check Methods to ProblemsService

**File:** `src/services/ProblemsService.ts`

Add these methods to the `ProblemsService` class:

```typescript
addCheck(problemId: string, description: string, instruction: string): CheckItem | null {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === problemId);
    if (!problem) return null;

    if (!problem.checks) problem.checks = [];
    const checkNum = problem.checks.length + 1;
    const check: CheckItem = {
        id: `${problem.id}-check-${checkNum}`,
        description,
        instruction,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    problem.checks.push(check);
    this.saveProblems(problems);
    return check;
}

updateCheck(problemId: string, checkId: string, updates: Partial<CheckItem>): CheckItem | null {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === problemId);
    if (!problem?.checks) return null;

    const check = problem.checks.find(c => c.id === checkId);
    if (!check) return null;

    Object.assign(check, updates, { updated_at: new Date().toISOString() });
    this.saveProblems(problems);
    return check;
}

completeCheck(problemId: string, checkId: string, feedback?: CheckFeedback): CheckItem | null {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === problemId);
    if (!problem?.checks) return null;

    const check = problem.checks.find(c => c.id === checkId);
    if (!check) return null;

    check.status = 'completed';
    check.updated_at = new Date().toISOString();
    if (feedback) check.feedback = feedback;

    this.saveProblems(problems);
    return check;
}

addCheckFeedback(problemId: string, checkId: string, feedback: CheckFeedback): CheckItem | null {
    const problems = this.getProblems();
    const problem = problems.find(p => p.id === problemId);
    if (!problem?.checks) return null;

    const check = problem.checks.find(c => c.id === checkId);
    if (!check) return null;

    check.feedback = feedback;
    check.updated_at = new Date().toISOString();
    this.saveProblems(problems);
    return check;
}
```

### 1c. Extend RequestsService CheckItem with Feedback

**File:** `src/services/RequestsService.ts`

Add the same `feedback` and `session_id` fields to the existing `CheckItem` interface in RequestsService, and add the `addCheckFeedback()` method:

```typescript
// Extend existing CheckItem in RequestsService:
interface CheckItem {
  id: string;
  description: string;
  instruction: string;
  status: 'pending' | 'in_progress' | 'completed';
  feedback?: CheckFeedback;   // ← NEW
  session_id?: string;        // ← NEW
  created_at: string;
  updated_at: string;
}

// Add method:
addCheckFeedback(requestId: string, checkId: string, feedback: CheckFeedback): CheckItem | null {
    const requests = this.getRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request?.checks) return null;

    const check = request.checks.find(c => c.id === checkId);
    if (!check) return null;

    check.feedback = feedback;
    check.updated_at = new Date().toISOString();
    this.saveRequests(requests);
    return check;
}
```

### 1d. New IPC Channels

**File:** `src/main.ts` — Add these handlers:

```typescript
// Add check feedback to a problem check
ipcMain.handle('add-check-feedback', async (_event, data: {
    parentId: string;
    checkId: string;
    parentType: 'problem' | 'request';
    feedback: CheckFeedback;
}) => {
    const { parentId, checkId, parentType, feedback } = data;
    let result;

    if (parentType === 'problem') {
        const ps = getProblemsService(undefined, undefined);
        result = ps.addCheckFeedback?.(parentId, checkId, feedback);
    } else {
        const rs = getRequestsService();
        result = rs.addCheckFeedback?.(parentId, checkId, feedback);
    }

    if (result && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('context-changed', {
            type: 'check',
            action: 'feedback-added',
            entity: { checkId, parentId, parentType, feedback },
        });
    }

    return { success: !!result, check: result };
});

// Send check feedback to terminal
ipcMain.handle('send-check-feedback-to-terminal', async (_event, data: {
    terminalId: string;
    checkId: string;
    checkDescription: string;
    feedback: CheckFeedback;
    sessionId?: string;
}) => {
    const { terminalId, checkId, checkDescription, feedback, sessionId } = data;

    // Build feedback message
    const emoji = feedback.type === 'approved' ? '✅' : feedback.type === 'rejected' ? '❌' : '💬';
    let message = `[USER FEEDBACK] Check "${checkDescription}": ${emoji}`;
    if (feedback.type === 'approved') message += ' Works';
    else if (feedback.type === 'rejected') message += ' Does not work';
    if (feedback.value) message += ` — ${feedback.value}`;

    // Write to terminal
    const term = terminalManager.terminals.get(terminalId);
    if (term) {
        const formattedMsg = `\r\n\x1b[36m${message}\x1b[0m\r\n`;
        term.pty.write(formattedMsg);
    }

    // Save to session messages if sessionId provided
    if (sessionId) {
        try {
            db.prepare(`
                INSERT INTO terminal_messages (session_id, role, content, created_at)
                VALUES (?, 'user', ?, datetime('now'))
            `).run(sessionId, `[CHECK FEEDBACK] ${message}`);
        } catch (err) {
            console.error('[CheckFeedback] Failed to save message:', err);
        }
    }

    return { success: !!term, message };
});
```

### 1e. Preload Bridges

**File:** `src/preload.ts` — Add to `deskflowAPI`:

```typescript
addCheckFeedback: (data: {
    parentId: string;
    checkId: string;
    parentType: 'problem' | 'request';
    feedback: { type: 'approved' | 'rejected' | 'text'; value?: string; timestamp: string; session_id?: string; terminal_id?: string };
}) => ipcRenderer.invoke('add-check-feedback', data),

sendCheckFeedbackToTerminal: (data: {
    terminalId: string;
    checkId: string;
    checkDescription: string;
    feedback: { type: 'approved' | 'rejected' | 'text'; value?: string; timestamp: string };
    sessionId?: string;
}) => ipcRenderer.invoke('send-check-feedback-to-terminal', data),
```

---

## Phase 2 — Sorting & Grouping Algorithm

### 2a. Algorithm Implementation

```typescript
// File: src/lib/checklistAlgorithm.ts (NEW)

export interface ChecklistConfig {
    autoSortByPriority: boolean;     // default: true
    groupByParent: boolean;          // default: true
    defaultFilterMode: 'all' | 'active' | 'completed';  // default: 'active'
    feedbackMode: 'simple' | 'simple+text' | 'rich';    // default: 'simple+text'
    maxChecksShown: number;          // default: 50
}

export const DEFAULT_CHECKLIST_CONFIG: ChecklistConfig = {
    autoSortByPriority: true,
    groupByParent: true,
    defaultFilterMode: 'active',
    feedbackMode: 'simple+text',
    maxChecksShown: 50,
};

export interface GroupedChecklist {
    groups: ChecklistGroup[];
    totalCount: number;
    completedCount: number;
}

export interface ChecklistGroup {
    parentId: string;
    parentTitle: string;
    parentType: 'problem' | 'request';
    parentStatus: string;
    parentPriority: string;
    parentSessionId: string | null;
    parentTerminalId: string | null;
    checks: SortedCheckItem[];
    progress: { done: number; total: number; percent: number };
}

export interface SortedCheckItem {
    checkId: string;
    description: string;
    instruction: string;
    checkStatus: 'pending' | 'in_progress' | 'completed';
    feedback?: {
        type: 'approved' | 'rejected' | 'text';
        value?: string;
        timestamp: string;
    };
    session_id?: string;
    updated_at: string;
}

// ── Priority rank (lower = shown first) ──────────────────────
const PRIORITY_RANK: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

// ── Status rank for parents (lower = shown first) ────────────
const PARENT_STATUS_RANK: Record<string, number> = {
    'In Progress': 0,
    'AI Attempted Fix': 1,
    'User Testing': 2,
    'NEW': 3,
    'Not Started': 4,
    'Fixed': 5,
    'Irrelevant': 6,
    'Completed': 7,
    'Cancelled': 8,
};

// ── Status rank for checks (lower = shown first) ─────────────
const CHECK_STATUS_RANK: Record<string, number> = {
    in_progress: 0,
    pending: 1,
    completed: 2,
};

export function sortAndGroupChecks(
    problems: any[],
    requests: any[],
    config: ChecklistConfig
): GroupedChecklist {
    const groups: ChecklistGroup[] = [];

    // ── Build groups from problems ────────────────────────────
    for (const problem of problems) {
        const checks: SortedCheckItem[] = (problem.checks || []).map((c: any) => ({
            checkId: c.id,
            description: c.description,
            instruction: c.instruction,
            checkStatus: c.status,
            feedback: c.feedback,
            session_id: c.session_id,
            updated_at: c.updated_at,
        }));

        // Apply filter
        const filtered = applyFilter(checks, config.defaultFilterMode);
        if (filtered.length === 0) continue;

        // Sort within group
        const sorted = config.autoSortByPriority
            ? filtered.sort((a, b) => CHECK_STATUS_RANK[a.checkStatus] - CHECK_STATUS_RANK[b.checkStatus])
            : filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        const done = checks.filter(c => c.checkStatus === 'completed').length;
        groups.push({
            parentId: problem.id,
            parentTitle: problem.title,
            parentType: 'problem',
            parentStatus: problem.status,
            parentPriority: problem.priority,
            parentSessionId: problem.session_id || null,
            parentTerminalId: problem.terminal_id || null,
            checks: sorted,
            progress: {
                done,
                total: checks.length,
                percent: checks.length > 0 ? Math.round((done / checks.length) * 100) : 0,
            },
        });
    }

    // ── Build groups from requests ────────────────────────────
    for (const request of requests) {
        const checks: SortedCheckItem[] = (request.checks || []).map((c: any) => ({
            checkId: c.id,
            description: c.description,
            instruction: c.instruction,
            checkStatus: c.status,
            feedback: c.feedback,
            session_id: c.session_id,
            updated_at: c.updated_at,
        }));

        const filtered = applyFilter(checks, config.defaultFilterMode);
        if (filtered.length === 0) continue;

        const sorted = config.autoSortByPriority
            ? filtered.sort((a, b) => CHECK_STATUS_RANK[a.checkStatus] - CHECK_STATUS_RANK[b.checkStatus])
            : filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        const done = checks.filter(c => c.checkStatus === 'completed').length;
        groups.push({
            parentId: request.id,
            parentTitle: request.title,
            parentType: 'request',
            parentStatus: request.status,
            parentPriority: request.priority,
            parentSessionId: request.session_id || null,
            parentTerminalId: null,
            checks: sorted,
            progress: {
                done,
                total: checks.length,
                percent: checks.length > 0 ? Math.round((done / checks.length) * 100) : 0,
            },
        });
    }

    // ── Sort groups ───────────────────────────────────────────
    if (config.autoSortByPriority) {
        groups.sort((a, b) => {
            // 1. By parent priority
            const priDiff = (PRIORITY_RANK[a.parentPriority] ?? 99) - (PRIORITY_RANK[b.parentPriority] ?? 99);
            if (priDiff !== 0) return priDiff;

            // 2. By parent status (active first)
            const statDiff = (PARENT_STATUS_RANK[a.parentStatus] ?? 99) - (PARENT_STATUS_RANK[b.parentStatus] ?? 99);
            if (statDiff !== 0) return statDiff;

            // 3. By progress (less complete first)
            return a.progress.percent - b.progress.percent;
        });
    } else {
        groups.sort((a, b) => {
            // By most recent check update
            const aLatest = Math.max(...a.checks.map(c => new Date(c.updated_at).getTime()));
            const bLatest = Math.max(...b.checks.map(c => new Date(c.updated_at).getTime()));
            return bLatest - aLatest;
        });
    }

    // ── Compute totals ────────────────────────────────────────
    const allChecks = groups.flatMap(g => g.checks);
    const totalCount = allChecks.length;
    const completedCount = allChecks.filter(c => c.checkStatus === 'completed').length;

    return { groups, totalCount, completedCount };
}

function applyFilter(
    checks: SortedCheckItem[],
    mode: 'all' | 'active' | 'completed'
): SortedCheckItem[] {
    switch (mode) {
        case 'active':
            return checks.filter(c => c.checkStatus !== 'completed');
        case 'completed':
            return checks.filter(c => c.checkStatus === 'completed');
        default:
            return checks;
    }
}
```

### 2b. Edge Cases

| Case | Handling |
|------|----------|
| Old problems without `checks` field | `(problem.checks || [])` — defaults to empty array |
| Problem with empty checks array | Group is skipped (no items to show) |
| Unknown priority | `PRIORITY_RANK[priority] ?? 99` — sorts to bottom |
| Unknown status | `PARENT_STATUS_RANK[status] ?? 99` — sorts to bottom |
| All checks completed | Group still shows (in "completed" filter), moves to bottom of active view |
| Mixed problem + request with same priority | Problems sort before requests (arbitrary tiebreaker) |
| `maxChecksShown` exceeded | Paginate — show first N groups, "Show more" button |

---

## Phase 3 — Feedback System

### 3a. Feedback Component

**New file:** `src/components/CheckFeedbackControls.tsx`

```tsx
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, X } from 'lucide-react';

interface CheckFeedbackControlsProps {
    checkId: string;
    checkDescription: string;
    parentType: 'problem' | 'request';
    parentId: string;
    parentSessionId: string | null;
    parentTerminalId: string | null;
    feedbackMode: 'simple' | 'simple+text' | 'rich';
    existingFeedback?: {
        type: 'approved' | 'rejected' | 'text';
        value?: string;
        timestamp: string;
    };
    onFeedbackSent?: () => void;
}

export default function CheckFeedbackControls({
    checkId,
    checkDescription,
    parentType,
    parentId,
    parentSessionId,
    parentTerminalId,
    feedbackMode,
    existingFeedback,
    onFeedbackSent,
}: CheckFeedbackControlsProps) {
    const [showTextInput, setShowTextInput] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState(!!existingFeedback);

    const sendFeedback = async (type: 'approved' | 'rejected' | 'text', value?: string) => {
        setIsSending(true);
        const timestamp = new Date().toISOString();
        const feedback = { type, value, timestamp };

        try {
            // 1. Save feedback to check
            await window.deskflowAPI?.addCheckFeedback?.({
                parentId,
                checkId,
                parentType,
                feedback: { ...feedback, session_id: parentSessionId || undefined, terminal_id: parentTerminalId || undefined },
            });

            // 2. Send to terminal if available
            if (parentTerminalId) {
                await window.deskflowAPI?.sendCheckFeedbackToTerminal?.({
                    terminalId: parentTerminalId,
                    checkId,
                    checkDescription,
                    feedback,
                    sessionId: parentSessionId || undefined,
                });
            }

            setSent(true);
            setShowTextInput(false);
            setFeedbackText('');
            onFeedbackSent?.();
        } catch (err) {
            console.error('[CheckFeedback] Failed:', err);
        } finally {
            setIsSending(false);
        }
    };

    if (sent && existingFeedback) {
        // Show existing feedback
        const emoji = existingFeedback.type === 'approved' ? '✅' : existingFeedback.type === 'rejected' ? '❌' : '💬';
        return (
            <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px]">{emoji}</span>
                <span className="text-[10px] text-zinc-500">
                    {existingFeedback.type === 'approved' ? 'Works' :
                     existingFeedback.type === 'rejected' ? "Doesn't work" : existingFeedback.value?.substring(0, 50)}
                </span>
            </div>
        );
    }

    return (
        <div className="mt-1.5">
            {/* Quick feedback buttons */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => sendFeedback('approved')}
                    disabled={isSending}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                    <ThumbsUp className="w-2.5 h-2.5" />
                    Works
                </button>
                <button
                    onClick={() => sendFeedback('rejected')}
                    disabled={isSending}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                    <ThumbsDown className="w-2.5 h-2.5" />
                    No
                </button>

                {/* Text feedback toggle (if enabled) */}
                {feedbackMode !== 'simple' && (
                    <button
                        onClick={() => setShowTextInput(!showTextInput)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/50 transition-colors"
                    >
                        <MessageSquare className="w-2.5 h-2.5" />
                        Feedback
                    </button>
                )}
            </div>

            {/* Text input (expandable) */}
            {showTextInput && (
                <div className="mt-1.5 flex gap-1.5">
                    <input
                        type="text"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Optional feedback..."
                        className="flex-1 text-[10px] bg-zinc-900/70 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/30"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && feedbackText.trim()) {
                                sendFeedback('text', feedbackText.trim());
                            }
                        }}
                    />
                    <button
                        onClick={() => sendFeedback('text', feedbackText.trim())}
                        disabled={!feedbackText.trim() || isSending}
                        className="px-1.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-30 transition-colors"
                    >
                        <Send className="w-2.5 h-2.5" />
                    </button>
                    <button
                        onClick={() => { setShowTextInput(false); setFeedbackText(''); }}
                        className="px-1 py-1 rounded text-zinc-500 hover:text-zinc-300"
                    >
                        <X className="w-2.5 h-2.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
```

### 3b. Session Resolution Strategy

```typescript
// File: src/lib/sessionResolution.ts (NEW)

export interface ResolvedSession {
    sessionId: string | null;
    terminalId: string | null;
    source: 'parent' | 'active' | 'none';
}

export function resolveSessionForCheck(
    check: { session_id?: string },
    parent: { session_id?: string | null; terminal_id?: string | null },
    activeTerminalId: string | null,
    sessions: Array<{ id: string; terminal_id: string | null; status: string }>,
): ResolvedSession {
    // Strategy 1: Check has its own session_id (from previous feedback)
    if (check.session_id) {
        const session = sessions.find(s => s.id === check.session_id && s.status === 'active');
        if (session?.terminal_id) {
            return { sessionId: session.id, terminalId: session.terminal_id, source: 'parent' };
        }
    }

    // Strategy 2: Parent has session_id
    if (parent.session_id) {
        const session = sessions.find(s => s.id === parent.session_id && s.status === 'active');
        if (session?.terminal_id) {
            return { sessionId: session.id, terminalId: session.terminal_id, source: 'parent' };
        }
    }

    // Strategy 3: Parent has terminal_id directly
    if (parent.terminal_id) {
        const session = sessions.find(s => s.terminal_id === parent.terminal_id && s.status === 'active');
        return {
            sessionId: session?.id || null,
            terminalId: parent.terminal_id,
            source: 'parent',
        };
    }

    // Strategy 4: Use currently active terminal
    if (activeTerminalId) {
        const session = sessions.find(s => s.terminal_id === activeTerminalId && s.status === 'active');
        return {
            sessionId: session?.id || null,
            terminalId: activeTerminalId,
            source: 'active',
        };
    }

    // Strategy 5: No terminal available
    return { sessionId: null, terminalId: null, source: 'none' };
}
```

### 3c. Terminal Message Format

When feedback is sent to the terminal, it appears as:

```
[USER FEEDBACK] Check "Verify click handler": ✅ Works — Additional feedback text
[USER FEEDBACK] Check "Test login flow": ❌ Does not work
[USER FEEDBACK] Check "Check API response": 💬 — The response time is too slow
```

Written via `terminalWriteRaw()` (no DB record in terminal_messages for the raw PTY write) + `saveTerminalMessage()` for the session history record.

---

## Phase 4 — UI Redesign

### 4a. Component Tree

```
IssuesWorkspace
├── Sub-tab bar (problems | requests | checklists)
├── [if checklists tab]:
│   ├── ChecklistConfigBar
│   │   ├── Filter mode selector (all / active / completed)
│   │   ├── Sort toggle (priority / recent)
│   │   ├── Group toggle (on / off)
│   │   └── Progress counter (X/Y done)
│   └── GroupedChecklist
│       └── ChecklistGroup (one per parent)
│           ├── GroupHeader
│           │   ├── Parent type dot (purple=problem, blue=request)
│           │   ├── Parent title
│           │   ├── Priority badge
│           │   ├── Status pill
│           │   └── Progress bar (mini)
│           └── ChecklistItem (one per check)
│               ├── Status circle (○ / ◉ / ✓)
│               ├── Check description
│               ├── Expand/collapse chevron
│               └── [expanded]:
│                   ├── Instruction text
│                   ├── CheckFeedbackControls
│                   └── Session info (if linked)
```

### 4b. Redesigned CombinedChecklist

**File:** `src/components/IssuesWorkspace.tsx` — Replace lines 714-851

```tsx
function CombinedChecklist({
    problems,
    requests,
    activeTerminalId,
    sessions,
}: {
    problems: any[];
    requests: any[];
    activeTerminalId: string | null;
    sessions: any[];
}) {
    const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('active');
    const [sortBy, setSortBy] = useState<'priority' | 'recent'>('priority');
    const [groupByParent, setGroupByParent] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
    const [checklistConfig, setChecklistConfig] = useState<ChecklistConfig>(DEFAULT_CHECKLIST_CONFIG);

    // Load config from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('checklist-config');
            if (saved) setChecklistConfig({ ...DEFAULT_CHECKLIST_CONFIG, ...JSON.parse(saved) });
        } catch {}
    }, []);

    const saveConfig = (updates: Partial<ChecklistConfig>) => {
        const newConfig = { ...checklistConfig, ...updates };
        setChecklistConfig(newConfig);
        localStorage.setItem('checklist-config', JSON.stringify(newConfig));
    };

    // Compute grouped checklist
    const result = useMemo(() =>
        sortAndGroupChecks(problems, requests, {
            ...checklistConfig,
            autoSortByPriority: sortBy === 'priority',
            groupByParent,
            defaultFilterMode: filterMode,
        }),
        [problems, requests, sortBy, groupByParent, filterMode]
    );

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleCheck = (id: string) => {
        setExpandedChecks(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const priorityColor: Record<string, string> = {
        critical: 'text-red-400 bg-red-500/10 border-red-500/20',
        high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    };

    return (
        <div className="space-y-3">
            {/* ── Config bar ────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <select
                        value={filterMode}
                        onChange={e => setFilterMode(e.target.value as any)}
                        className="text-[10px] bg-zinc-900/70 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300"
                    >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                    </select>

                    {/* Sort */}
                    <div className="flex rounded border border-zinc-700/50 overflow-hidden">
                        <button
                            onClick={() => setSortBy('priority')}
                            className={`text-[10px] px-2 py-0.5 ${sortBy === 'priority' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-zinc-900/70 text-zinc-500'}`}
                        >
                            Priority
                        </button>
                        <button
                            onClick={() => setSortBy('recent')}
                            className={`text-[10px] px-2 py-0.5 ${sortBy === 'recent' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-zinc-900/70 text-zinc-500'}`}
                        >
                            Recent
                        </button>
                    </div>

                    {/* Group toggle */}
                    <button
                        onClick={() => setGroupByParent(!groupByParent)}
                        className={`text-[10px] px-2 py-0.5 rounded border ${groupByParent ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-zinc-900/70 text-zinc-500 border-zinc-700/50'}`}
                    >
                        {groupByParent ? 'Grouped' : 'Flat'}
                    </button>
                </div>

                {/* Progress */}
                <span className="text-[10px] text-zinc-500 font-mono">
                    {result.completedCount}/{result.totalCount} done
                </span>
            </div>

            {/* ── Empty state ───────────────────────────── */}
            {result.groups.length === 0 && (
                <div className="text-center py-8">
                    <ListChecks className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">No checks yet</p>
                    <p className="text-[10px] text-zinc-600 mt-1">
                        AI can add them with <code className="text-zinc-400">[add-check]</code> actions
                    </p>
                </div>
            )}

            {/* ── Groups ────────────────────────────────── */}
            {result.groups.map(group => {
                const isExpanded = expandedGroups.has(group.parentId);
                const typeColor = group.parentType === 'problem' ? 'bg-purple-500' : 'bg-blue-500';
                const typeLabel = group.parentType === 'problem' ? 'P' : 'R';

                return (
                    <div
                        key={group.parentId}
                        className="bg-zinc-900/40 rounded-lg border border-zinc-800/50 overflow-hidden"
                    >
                        {/* Group header */}
                        <div
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                            onClick={() => toggleGroup(group.parentId)}
                        >
                            <button className="shrink-0">
                                {isExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                                ) : (
                                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                                )}
                            </button>

                            {/* Type dot */}
                            <div className={`w-2 h-2 rounded-full ${typeColor} shrink-0`} />

                            {/* Title */}
                            <span className="text-xs text-zinc-200 truncate flex-1">
                                {group.parentTitle}
                            </span>

                            {/* Priority */}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${priorityColor[group.parentPriority] || priorityColor.low}`}>
                                {group.parentPriority}
                            </span>

                            {/* Progress */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500/60 rounded-full transition-all duration-300"
                                        style={{ width: `${group.progress.percent}%` }}
                                    />
                                </div>
                                <span className="text-[9px] text-zinc-600 font-mono w-8 text-right">
                                    {group.progress.done}/{group.progress.total}
                                </span>
                            </div>
                        </div>

                        {/* Checks list */}
                        {isExpanded && (
                            <div className="border-t border-zinc-800/30 px-3 py-2 space-y-1">
                                {group.checks.map(check => {
                                    const isCheckExpanded = expandedChecks.has(check.checkId);
                                    const statusIcon = check.checkStatus === 'completed' ? '✓' :
                                        check.checkStatus === 'in_progress' ? '◉' : '○';
                                    const statusColor = check.checkStatus === 'completed' ? 'text-emerald-400' :
                                        check.checkStatus === 'in_progress' ? 'text-amber-400' : 'text-zinc-600';

                                    // Resolve session
                                    const resolved = resolveSessionForCheck(
                                        check,
                                        { session_id: group.parentSessionId, terminal_id: group.parentTerminalId },
                                        activeTerminalId,
                                        sessions,
                                    );

                                    return (
                                        <div
                                            key={check.checkId}
                                            className="rounded border border-zinc-800/30 bg-zinc-950/40"
                                        >
                                            <div
                                                className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                                                onClick={() => toggleCheck(check.checkId)}
                                            >
                                                <span className={`text-xs ${statusColor}`}>{statusIcon}</span>
                                                <span className={`text-[11px] flex-1 ${check.checkStatus === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                                                    {check.description}
                                                </span>
                                                <span className="text-[9px] text-zinc-700 font-mono">
                                                    {check.checkId.split('-').slice(-2).join('-')}
                                                </span>
                                            </div>

                                            {isCheckExpanded && (
                                                <div className="px-2.5 pb-2 pt-1 border-t border-zinc-800/20">
                                                    {/* Instruction */}
                                                    <p className="text-[10px] text-zinc-500 mb-2">
                                                        <span className="text-zinc-600">How to verify:</span> {check.instruction}
                                                    </p>

                                                    {/* Session info */}
                                                    {resolved.terminalId && (
                                                        <p className="text-[9px] text-zinc-600 mb-1.5">
                                                            Session: {resolved.sessionId?.substring(0, 12) || '—'} •
                                                            Terminal: {resolved.terminalId.substring(0, 12)}
                                                            {resolved.source === 'active' && ' (active)'}
                                                        </p>
                                                    )}

                                                    {/* Feedback controls */}
                                                    {check.checkStatus !== 'completed' && (
                                                        <CheckFeedbackControls
                                                            checkId={check.checkId}
                                                            checkDescription={check.description}
                                                            parentType={group.parentType}
                                                            parentId={group.parentId}
                                                            parentSessionId={resolved.sessionId}
                                                            parentTerminalId={resolved.terminalId}
                                                            feedbackMode={checklistConfig.feedbackMode}
                                                            onFeedbackSent={() => {
                                                                // Trigger data refresh
                                                                window.dispatchEvent(new CustomEvent('check-feedback-sent'));
                                                            }}
                                                        />
                                                    )}

                                                    {/* Existing feedback display */}
                                                    {check.feedback && (
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="text-[10px]">
                                                                {check.feedback.type === 'approved' ? '✅' :
                                                                 check.feedback.type === 'rejected' ? '❌' : '💬'}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-500">
                                                                {check.feedback.type === 'approved' ? 'Works' :
                                                                 check.feedback.type === 'rejected' ? "Doesn't work" :
                                                                 check.feedback.value?.substring(0, 80)}
                                                            </span>
                                                            {resolved.source === 'none' && (
                                                                <span className="text-[9px] text-amber-600">
                                                                    (no terminal connected)
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
```

### 4c. Settings Panel

Add inside the IssuesWorkspace component, as a collapsible section within the checklists tab:

```tsx
{/* ── Checklist Settings (gear icon) ──────────── */}
{showChecklistSettings && (
    <div className="bg-zinc-900/40 rounded-lg border border-zinc-800/50 p-3 space-y-2.5">
        <h4 className="text-[11px] font-semibold text-zinc-400">Checklist Settings</h4>

        <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Auto-sort by priority</span>
            <button
                onClick={() => saveConfig({ autoSortByPriority: !checklistConfig.autoSortByPriority })}
                className={`relative w-7 h-4 rounded-full transition-colors ${checklistConfig.autoSortByPriority ? 'bg-cyan-500/30 border border-cyan-500/40' : 'bg-zinc-700 border border-zinc-600'}`}
            >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${checklistConfig.autoSortByPriority ? 'translate-x-3 bg-cyan-400' : 'translate-x-0.5 bg-zinc-400'}`} />
            </button>
        </div>

        <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Group by parent</span>
            <button
                onClick={() => { setGroupByParent(!groupByParent); saveConfig({ groupByParent: !groupByParent }); }}
                className={`relative w-7 h-4 rounded-full transition-colors ${checklistConfig.groupByParent ? 'bg-cyan-500/30 border border-cyan-500/40' : 'bg-zinc-700 border border-zinc-600'}`}
            >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${checklistConfig.groupByParent ? 'translate-x-3 bg-cyan-400' : 'translate-x-0.5 bg-zinc-400'}`} />
            </button>
        </div>

        <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Default filter</span>
            <select
                value={checklistConfig.defaultFilterMode}
                onChange={e => saveConfig({ defaultFilterMode: e.target.value as any })}
                className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-zinc-300"
            >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
            </select>
        </div>

        <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Feedback mode</span>
            <select
                value={checklistConfig.feedbackMode}
                onChange={e => saveConfig({ feedbackMode: e.target.value as any })}
                className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-zinc-300"
            >
                <option value="simple">Simple (👍👎)</option>
                <option value="simple+text">Simple + Text</option>
                <option value="rich">Rich</option>
            </select>
        </div>

        <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Max checks shown</span>
            <input
                type="number"
                value={checklistConfig.maxChecksShown}
                onChange={e => saveConfig({ maxChecksShown: parseInt(e.target.value) || 50 })}
                className="w-14 text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-1.5 py-0.5 text-zinc-300 text-center"
                min={10}
                max={200}
            />
        </div>
    </div>
)}
```

---

## Phase 5 — Session Resolution & History

### 5a. Resolution Flow

```
User clicks "Works" on a check
    │
    ├─ Check has session_id? → Use that session's terminal
    │
    ├─ Parent (problem/request) has session_id? → Use that
    │
    ├─ Parent has terminal_id? → Use that terminal + find its active session
    │
    ├─ There's an activeTerminalId? → Use that + find its session
    │
    └─ None of the above? → Mark feedback as "queued" (no terminal)
         └─ Show amber "no terminal connected" text
         └─ When a terminal becomes active, pending feedback can be flushed
```

### 5b. Session History Record

When feedback is sent, two things happen:

1. **Raw terminal write** (visible to AI agent in real-time):
   ```
   \r\n\x1b[36m[USER FEEDBACK] Check "Verify click handler": ✅ Works\x1b[0m\r\n
   ```

2. **DB record** in `terminal_messages` (persistent history):
   ```sql
   INSERT INTO terminal_messages (session_id, role, content, created_at)
   VALUES ('abc123-def456', 'user', '[CHECK FEEDBACK] [USER FEEDBACK] Check "Verify click handler": ✅ Works', datetime('now'))
   ```

### 5c. Error Handling

| Scenario | Behavior |
|----------|----------|
| No terminal available | Feedback saved to check locally, "no terminal" warning shown, no terminal write attempted |
| Terminal exists but session_id null | Write to terminal, skip DB message save |
| Session exists but terminal dead | Skip terminal write, save DB message |
| `addCheckFeedback` IPC fails | Show error toast, don't attempt terminal write |
| `sendCheckFeedbackToTerminal` fails | Feedback was already saved to check, just log the error |

---

## Phase 6 — Settings

### 6a. Settings Interface

```typescript
interface ChecklistConfig {
    autoSortByPriority: boolean;     // default: true
    groupByParent: boolean;          // default: true
    defaultFilterMode: 'all' | 'active' | 'completed';  // default: 'active'
    feedbackMode: 'simple' | 'simple+text' | 'rich';    // default: 'simple+text'
    maxChecksShown: number;          // default: 50
}
```

### 6b. Storage Mechanism

- **Primary:** `localStorage` key `checklist-config` — instant read/write, no IPC needed
- **Fallback:** If localStorage unavailable, use in-memory defaults
- **Sync:** No cross-window sync needed (single-window Electron app)

### 6c. Default Values

```typescript
const DEFAULT_CHECKLIST_CONFIG: ChecklistConfig = {
    autoSortByPriority: true,
    groupByParent: true,
    defaultFilterMode: 'active',
    feedbackMode: 'simple+text',
    maxChecksShown: 50,
};
```

---

## Phase 7 — Session Compaction (Bonus)

### 7a. Trigger Conditions

```typescript
// New IPC handler in main.ts:
ipcMain.handle('check-session-compaction', async (_event, data: {
    sessionId: string;
    messageThreshold?: number;
}) => {
    const threshold = data.messageThreshold || 500;

    const count = db.prepare(
        'SELECT COUNT(*) as count FROM terminal_messages WHERE session_id = ?'
    ).get(data.sessionId) as any;

    if ((count?.count || 0) < threshold) {
        return { needsCompaction: false };
    }

    return { needsCompaction: true, messageCount: count.count };
});

ipcMain.handle('compact-session', async (_event, data: {
    sessionId: string;
    summaryPrompt?: string;
}) => {
    const { sessionId } = data;

    // 1. Get all messages
    const messages = db.prepare(
        'SELECT role, content FROM terminal_messages WHERE session_id = ? ORDER BY created_at'
    ).all(sessionId);

    // 2. Generate summary via LLM
    const summaryContent = messages.map((m: any) =>
        `[${m.role}]: ${m.content.substring(0, 200)}`
    ).join('\n');

    const llmResult = await callOpenRouter(
        'You summarize terminal sessions concisely. Produce a structured summary with key decisions, changes, and current state.',
        `Session ${sessionId} history:\n${summaryContent.substring(0, 4000)}`,
        { model: 'anthropic/claude-3.5-haiku', maxTokens: 500, temperature: 0.2 }
    );

    // 3. Archive old session
    db.prepare(`
        UPDATE terminal_sessions SET status = 'archived', updated_at = datetime('now')
        WHERE id = ?
    `).run(sessionId);

    // 4. Create new compacted session
    const newSessionId = `compacted-${Date.now()}`;
    const oldSession = db.prepare('SELECT * FROM terminal_sessions WHERE id = ?').get(sessionId) as any;

    db.prepare(`
        INSERT INTO terminal_sessions (id, project_id, agent, resume_id, topic, terminal_id, category, status, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
    `).run(
        newSessionId,
        oldSession?.project_id,
        oldSession?.agent,
        sessionId,  // resume_id points to original
        `[Compacted] ${oldSession?.topic || 'Session'}`,
        oldSession?.terminal_id,
        oldSession?.category,
        llmResult.content,
    );

    // 5. Save summary as first message in new session
    db.prepare(`
        INSERT INTO terminal_messages (session_id, role, content, created_at)
        VALUES (?, 'system', ?, datetime('now'))
    `).run(newSessionId, `[SESSION COMPACTION SUMMARY]\n${llmResult.content}`);

    return { success: true, newSessionId, archivedSessionId: sessionId };
});
```

### 7b. Auto-Compaction Check

Add to the periodic refresh in TerminalPage (or as a new effect):

```typescript
// Every 60 seconds, check if any active session needs compaction
useEffect(() => {
    const check = async () => {
        for (const session of sessions) {
            if (session.status !== 'active') continue;
            try {
                const result = await window.deskflowAPI?.checkSessionCompaction?.({
                    sessionId: session.id,
                    messageThreshold: 500,
                });
                // If needs compaction, could auto-compact or show a suggestion
            } catch {}
        }
    };
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
}, [sessions]);
```

---

## Phase 8 — Data Flow Diagram

### Before (Flat, No Feedback)

```
AI Agent outputs [add-check] / [complete-check]
    → main.ts parseAndExecuteActions()
    → ps.addCheck() / rs.addCheck() / ps.completeCheck() / rs.completeCheck()
    → context-changed IPC event (generic)
    → IssuesWorkspace refreshes
    → CombinedChecklist shows flat list sorted by updated_at
    → ✗ No user feedback
    → ✗ No session awareness
    → ✗ No terminal write-back
```

### After (Grouped, With Feedback Loop)

```
AI Agent outputs [add-check] / [complete-check]
    → main.ts parseAndExecuteActions()
    → ps.addCheck() / rs.addCheck() / ps.completeCheck() / rs.completeCheck()
    → context-changed IPC event (with entity details)
    → IssuesWorkspace refreshes
    → sortAndGroupChecks() produces grouped view
    → User sees checks grouped by parent, sorted by priority
         │
         ├─ User clicks "✅ Works"
         │   → resolveSessionForCheck() finds terminal
         │   → addCheckFeedback IPC → saves to JSON
         │   → sendCheckFeedbackToTerminal IPC
         │       → terminalWriteRaw to PTY (agent sees it)
         │       → saveTerminalMessage to DB (persistent record)
         │   → context-changed event → UI refreshes
         │
         ├─ User clicks "❌ No"
         │   → Same flow with rejected feedback
         │
         ├─ User types feedback + Submit
         │   → Same flow with text feedback
         │
         └─ No terminal available
             → Feedback saved locally
             → "No terminal connected" warning shown
             → Queued for later flush
```

---

## Backend Audit Table

| Feature | IPC Channel | Handler Exists? | Preload Bridge | Service | DB Schema | Status |
|---------|-------------|-----------------|----------------|---------|-----------|--------|
| Problem checks field | — | — | — | ProblemsService | — | Needs addition |
| `ps.addCheck()` | — | — | — | ProblemsService | — | Needs addition |
| `ps.completeCheck()` | — | — | — | ProblemsService | — | Needs addition |
| `ps.addCheckFeedback()` | — | — | — | ProblemsService | — | Needs addition |
| `rs.addCheckFeedback()` | — | — | — | RequestsService | — | Needs addition |
| Add check feedback IPC | `add-check-feedback` | ❌ | ❌ | Both services | — | Needs creation |
| Send feedback to terminal | `send-check-feedback-to-terminal` | ❌ | ❌ | main.ts | terminal_messages | Needs creation |
| Sort/group algorithm | — | — | — | checklistAlgorithm.ts | — | New file |
| Session resolution | — | — | — | sessionResolution.ts | — | New file |
| Check feedback controls UI | — | — | — | CheckFeedbackControls.tsx | — | New component |
| Grouped checklist UI | — | — | — | IssuesWorkspace.tsx | — | Rewrite lines 714-851 |
| Checklist settings | — | — | — | localStorage | — | New UI section |
| `[add-check]` action parsing | — | ✅ main.ts:7268 | — | Both services | — | Real, extend with feedback |
| `[complete-check]` action parsing | — | ✅ main.ts:7280 | — | Both services | — | Real, no changes needed |
| `terminalWriteRaw` | `terminal:write-raw` | ✅ | ✅ | main.ts | — | Real |
| `saveTerminalMessage` | `save-terminal-message` | ✅ | ✅ | main.ts | terminal_messages | Real |
| Session compaction | `check-session-compaction` | ❌ | ❌ | main.ts | terminal_sessions | Needs creation |
| Session compaction exec | `compact-session` | ❌ | ❌ | main.ts | terminal_sessions | Needs creation |
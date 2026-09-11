# RESULT.md — Auto-Assign Session via Prompt Routing

## 1. Architecture Overview

```
User types prompt in instruction input
  │
  ├─ Auto-assign OFF ──► Manual @term routing (existing, unchanged)
  │
  └─ Auto-assign ON ──► route-prompt IPC
        │
        ├─ Gather active sessions + summaries
        ├─ Call summarize-with-llm (cheap model, 800 tok, temp 0.1)
        │   with routing system prompt
        │
        ├─ LLM returns: { sessionId, confidence } or { action: "create_new", ... }
        │
        ├─ High confidence (≥0.7) ──► Auto-send to matched session
        ├─ Medium (0.4-0.69) ──► Toast "Routing to [session]" (3s cancel window)
        ├─ Low (<0.4) ──► Disambiguation popup (top 3 candidates + Create New)
        └─ "create_new" ──► Auto-create session + spawn terminal + send prompt
        
  After response received (async, fire-and-forget):
    │
    ├─ Check message count vs summary threshold
    ├─ If due: summarize-with-llm → update session description + topic
    ├─ Parse ## Session Status blocks from AI output
    └─ Track all LLM call costs → routing-costs.json
```

---

## 2. Database Changes

### 2a. New Table: `routing_costs`

Add in `main.ts` DB initialization block:

```sql
CREATE TABLE IF NOT EXISTS routing_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  call_type TEXT NOT NULL,        -- 'routing' | 'summary' | 'rename'
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  session_id TEXT,
  prompt_preview TEXT             -- first 100 chars of the routed prompt
);

CREATE INDEX IF NOT EXISTS idx_routing_costs_timestamp ON routing_costs(timestamp);
CREATE INDEX IF NOT EXISTS idx_routing_costs_call_type ON routing_costs(call_type);
```

### 2b. Add Column to `terminal_sessions`

```sql
ALTER TABLE terminal_sessions ADD COLUMN auto_named INTEGER DEFAULT 0;
```

If ALTER TABLE fails (column exists), catch and ignore — this is idempotent.

The existing `description` column stores the AI summary. The `auto_named` column tracks whether the topic was AI-generated (don't overwrite user-set names).

### 2c. Routing Costs JSON (backup)

Also maintain `agent/context/routing-costs.json` as a redundant log for quick reads without DB queries:

```typescript
interface RoutingCostsFile {
  entries: RoutingCostEntry[];
  lastUpdated: string;
}
```

---

## 3. IPC Handlers

### 3a. `route-prompt` — The core routing call

```typescript
ipcMain.handle('route-prompt', async (_event, request: {
  prompt: string;
  projectPath?: string;
}) => {
  const { prompt, projectPath } = request;

  // 1. Load auto-assign config
  const config = loadAutoAssignConfig();
  if (!config.enabled) {
    return { action: 'manual', reason: 'Auto-assign is disabled' };
  }

  // 2. Gather active sessions with summaries
  const sessions = db.prepare(`
    SELECT id, topic, description, agent, status, terminal_id,
           (SELECT COUNT(*) FROM terminal_messages WHERE session_id = terminal_sessions.id) as msg_count
    FROM terminal_sessions
    WHERE status = 'active'
    ORDER BY updated_at DESC
  `).all();

  if (sessions.length === 0) {
    return {
      action: 'create_new',
      suggestedName: generateSessionName(prompt),
      suggestedSummary: prompt.substring(0, 120),
      confidence: 1.0,
    };
  }

  // 3. Build routing prompt
  const sessionList = sessions.map((s: any, i: number) => {
    const topic = s.topic || 'Untitled';
    const summary = s.description || 'No summary available';
    const msgCount = s.msg_count || 0;
    return `[${i}] Session: "${topic}" | Summary: ${summary} | Messages: ${msgCount} | Agent: ${s.agent}`;
  }).join('\n');

  const routingSystemPrompt = `You are a session router for an AI agent workspace. Given a user's prompt and a list of active sessions, decide which session the prompt should be routed to.

RULES:
- Match based on topic similarity, ongoing work, and context overlap
- If the prompt is unrelated to ALL existing sessions, respond with action: "create_new"
- Be decisive — avoid "create_new" if any session is a reasonable match
- Confidence is 0.0-1.0: how certain you are that this session is the right target

RESPOND WITH EXACTLY THIS JSON FORMAT, NOTHING ELSE:
{"session_index": <number or null>, "action": "route" or "create_new", "confidence": <0.0-1.0>, "suggested_name": "<string if create_new>", "reason": "<1 sentence>"}`;

  const routingUserPrompt = `ACTIVE SESSIONS:\n${sessionList}\n\nUSER PROMPT:\n${prompt}`;

  // 4. Call LLM for routing
  const startTime = Date.now();
  let routingResult: any;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  try {
    const llmResponse = await callOpenRouter(routingSystemPrompt, routingUserPrompt, {
      model: config.routingModel || 'anthropic/claude-3.5-haiku',
      maxTokens: 300,
      temperature: 0.1,
    });

    inputTokens = llmResponse.usage?.prompt_tokens || Math.ceil((routingSystemPrompt.length + routingUserPrompt.length) / 4);
    outputTokens = llmResponse.usage?.completion_tokens || Math.ceil(llmResponse.content.length / 4);
    costUsd = computeCost(inputTokens, outputTokens, config.routingModel || 'anthropic/claude-3.5-haiku');

    // Parse the JSON response
    const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      routingResult = JSON.parse(jsonMatch[0]);
    } else {
      routingResult = { action: 'create_new', confidence: 0.3, suggested_name: generateSessionName(prompt) };
    }
  } catch (err) {
    console.error('[Route-Prompt] LLM call failed:', err);
    return { action: 'manual', reason: 'Routing LLM call failed: ' + (err as Error).message };
  }

  // 5. Log cost
  logRoutingCost({
    callType: 'routing',
    model: config.routingModel || 'anthropic/claude-3.5-haiku',
    inputTokens,
    outputTokens,
    costUsd,
    promptPreview: prompt.substring(0, 100),
  });

  // 6. Map result
  if (routingResult.action === 'create_new') {
    return {
      action: 'create_new',
      suggestedName: routingResult.suggested_name || generateSessionName(prompt),
      suggestedSummary: prompt.substring(0, 120),
      confidence: routingResult.confidence || 0.5,
      reason: routingResult.reason,
    };
  }

  const targetIndex = routingResult.session_index;
  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < sessions.length) {
    const target = sessions[targetIndex];
    return {
      action: 'route',
      sessionId: target.id,
      sessionName: target.topic || 'Untitled',
      terminalId: target.terminal_id,
      confidence: routingResult.confidence || 0.5,
      reason: routingResult.reason,
    };
  }

  // Fallback
  return { action: 'manual', reason: 'Could not parse routing result' };
});
```

### 3b. `update-session-summary` — Async summary generation

```typescript
ipcMain.handle('update-session-summary', async (_event, request: {
  sessionId: string;
  force?: boolean;
}) => {
  const { sessionId, force = false } = request;
  const config = loadAutoAssignConfig();

  // 1. Get session info
  const session = db.prepare(`
    SELECT id, topic, description, agent, auto_named,
           (SELECT COUNT(*) FROM terminal_messages WHERE session_id = ?) as msg_count
    FROM terminal_sessions WHERE id = ?
  `).get(sessionId, sessionId);

  if (!session) return { success: false, error: 'Session not found' };

  // 2. Check if summary update is due
  if (!force) {
    const lastSummary = session.description;
    const msgCount = session.msg_count || 0;
    const threshold = config.summaryFrequency || 10;
    // Only update if message count exceeds threshold since last summary
    // Simple heuristic: if msg_count is a multiple of threshold, or no summary exists
    if (lastSummary && msgCount % threshold !== 0) {
      return { success: true, skipped: true, reason: 'Not due for update' };
    }
  }

  // 3. Get recent messages
  const messages = db.prepare(`
    SELECT role, content FROM terminal_messages
    WHERE session_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(sessionId);

  if (messages.length < 2) {
    return { success: true, skipped: true, reason: 'Not enough messages' };
  }

  // 4. Build summary prompt
  const messageText = messages.reverse().map((m: any) =>
    `[${m.role}]: ${m.content.substring(0, 300)}`
  ).join('\n');

  const summaryPrompt = `Current summary: ${session.description || 'None'}\n\nRecent messages:\n${messageText}\n\nProvide an updated 1-2 sentence summary of what this session is working on. Be specific about the current task, not the entire history. Reply with ONLY the summary text, no formatting.`;

  // 5. Call LLM
  let inputTokens = 0, outputTokens = 0, costUsd = 0;

  try {
    const llmResponse = await callOpenRouter(
      'You are a concise session summarizer. Produce 1-2 sentence summaries of what a development session is currently working on.',
      summaryPrompt,
      { model: config.routingModel || 'anthropic/claude-3.5-haiku', maxTokens: 150, temperature: 0.2 }
    );

    inputTokens = llmResponse.usage?.prompt_tokens || Math.ceil(summaryPrompt.length / 4);
    outputTokens = llmResponse.usage?.completion_tokens || Math.ceil(llmResponse.content.length / 4);
    costUsd = computeCost(inputTokens, outputTokens, config.routingModel || 'anthropic/claude-3.5-haiku');

    const newSummary = llmResponse.content.trim();

    // 6. Auto-rename if enabled
    let newTopic = session.topic;
    let autoNamed = session.auto_named || 0;

    if (config.autoRename && (session.auto_named || !session.topic || session.topic === 'New Session')) {
      const renamePrompt = `Based on this summary: "${newSummary}"\n\nGenerate a short descriptive session name (3-5 words, no quotes). Reply with ONLY the name.`;
      const renameResponse = await callOpenRouter(
        'You generate short, descriptive session names.',
        renamePrompt,
        { model: config.routingModel || 'anthropic/claude-3.5-haiku', maxTokens: 30, temperature: 0.3 }
      );

      const renameTokens = (renameResponse.usage?.completion_tokens || Math.ceil(renameResponse.content.length / 4));
      outputTokens += renameTokens;
      costUsd += computeCost(0, renameTokens, config.routingModel || 'anthropic/claude-3.5-haiku');

      newTopic = renameResponse.content.trim().replace(/^["']|["']$/g, '');
      autoNamed = 1;
    }

    // 7. Update session
    db.prepare(`
      UPDATE terminal_sessions
      SET description = ?, topic = ?, auto_named = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newSummary, newTopic, autoNamed, sessionId);

    // 8. Log cost
    logRoutingCost({
      callType: config.autoRename && autoNamed ? 'rename' : 'summary',
      model: config.routingModel || 'anthropic/claude-3.5-haiku',
      inputTokens,
      outputTokens,
      costUsd,
      sessionId,
    });

    return { success: true, summary: newSummary, topic: newTopic, autoNamed };
  } catch (err) {
    console.error('[Update-Session-Summary] Failed:', err);
    return { success: false, error: (err as Error).message };
  }
});
```

### 3c. `get-routing-costs` — Cost aggregation

```typescript
ipcMain.handle('get-routing-costs', async (_event, _request?: any) => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  const todayCost = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total,
           COALESCE(SUM(input_tokens), 0) as inputTokens,
           COALESCE(SUM(output_tokens), 0) as outputTokens,
           COUNT(*) as calls
    FROM routing_costs WHERE date(timestamp) = ?
  `).get(today);

  const weekCost = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total,
           COALESCE(SUM(input_tokens), 0) as inputTokens,
           COALESCE(SUM(output_tokens), 0) as outputTokens,
           COUNT(*) as calls
    FROM routing_costs WHERE date(timestamp) >= ?
  `).get(weekAgo);

  const monthCost = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total,
           COALESCE(SUM(input_tokens), 0) as inputTokens,
           COALESCE(SUM(output_tokens), 0) as outputTokens,
           COUNT(*) as calls
    FROM routing_costs WHERE date(timestamp) >= ?
  `).get(monthStart);

  const totalCost = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total,
           COALESCE(SUM(input_tokens), 0) as inputTokens,
           COALESCE(SUM(output_tokens), 0) as outputTokens,
           COUNT(*) as calls
    FROM routing_costs
  `).get();

  const byType = db.prepare(`
    SELECT call_type,
           COALESCE(SUM(cost_usd), 0) as total,
           COUNT(*) as calls
    FROM routing_costs
    GROUP BY call_type
  `).all();

  return {
    today: todayCost,
    week: weekCost,
    month: monthCost,
    total: totalCost,
    byType,
  };
});
```

### 3d. `reset-routing-costs` — Clear cost counters

```typescript
ipcMain.handle('reset-routing-costs', async (_event, _request?: any) => {
  db.prepare('DELETE FROM routing_costs').run();
  return { success: true };
});
```

### 3e. `get-auto-assign-config` / `save-auto-assign-config`

```typescript
ipcMain.handle('get-auto-assign-config', async (_event, _request?: any) => {
  return loadAutoAssignConfig();
});

ipcMain.handle('save-auto-assign-config', async (_event, config: AutoAssignConfig) => {
  const configPath = path.join(getAppDataPath(), 'auto-assign-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { success: true };
});
```

### 3f. Helper Functions

```typescript
interface AutoAssignConfig {
  enabled: boolean;
  routingModel: string;
  summaryFrequency: number;      // messages between summaries
  autoRename: boolean;
  renameThreshold: number;       // messages before auto-rename
  confidenceThreshold: number;   // 0.0-1.0, below this shows disambiguation
}

const DEFAULT_AUTO_ASSIGN_CONFIG: AutoAssignConfig = {
  enabled: false,
  routingModel: 'anthropic/claude-3.5-haiku',
  summaryFrequency: 10,
  autoRename: false,
  renameThreshold: 5,
  confidenceThreshold: 0.7,
};

function loadAutoAssignConfig(): AutoAssignConfig {
  try {
    const configPath = path.join(getAppDataPath(), 'auto-assign-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return { ...DEFAULT_AUTO_ASSIGN_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_AUTO_ASSIGN_CONFIG };
}

function generateSessionName(prompt: string): string {
  // Take first 3-5 meaningful words from the prompt
  const words = prompt.replace(/[^a-zA-Z0-9\s-]/g, '').split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase).join(' ') || 'New Session';
}

// Rough cost per 1M tokens (input/output) for common models
const MODEL_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  'anthropic/claude-3.5-haiku': { inputPerM: 0.80, outputPerM: 4.00 },
  'anthropic/claude-3-haiku': { inputPerM: 0.25, outputPerM: 1.25 },
  'google/gemini-2.0-flash-001': { inputPerM: 0.10, outputPerM: 0.40 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
};

function computeCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['anthropic/claude-3.5-haiku'];
  return (inputTokens / 1_000_000 * pricing.inputPerM) + (outputTokens / 1_000_000 * pricing.outputPerM);
}

function logRoutingCost(entry: {
  callType: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  sessionId?: string;
  promptPreview?: string;
}) {
  try {
    db.prepare(`
      INSERT INTO routing_costs (call_type, model, input_tokens, output_tokens, cost_usd, session_id, prompt_preview)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entry.callType, entry.model, entry.inputTokens, entry.outputTokens, entry.costUsd, entry.sessionId || null, entry.promptPreview || null);
  } catch (err) {
    console.error('[RoutingCost] Failed to log:', err);
  }
}

// Wrapper around OpenRouter API call (reuses existing summarize-with-llm pattern)
async function callOpenRouter(systemPrompt: string, userPrompt: string, options: {
  model: string;
  maxTokens: number;
  temperature: number;
}): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const apiKey = getOpenRouterApiKey(); // existing function in main.ts
  if (!apiKey) throw new Error('No OpenRouter API key configured');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://deskflow.app',
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}
```

---

## 4. Preload Bridges

Add to `src/preload.ts` in the `deskflowAPI` object:

```typescript
// Auto-assign routing
routePrompt: (request: { prompt: string; projectPath?: string }) =>
  ipcRenderer.invoke('route-prompt', request),

updateSessionSummary: (request: { sessionId: string; force?: boolean }) =>
  ipcRenderer.invoke('update-session-summary', request),

getRoutingCosts: () =>
  ipcRenderer.invoke('get-routing-costs'),

resetRoutingCosts: () =>
  ipcRenderer.invoke('reset-routing-costs'),

getAutoAssignConfig: () =>
  ipcRenderer.invoke('get-auto-assign-config'),

saveAutoAssignConfig: (config: any) =>
  ipcRenderer.invoke('save-auto-assign-config', config),
```

---

## 5. Frontend Changes

### 5a. New Component: `src/components/RoutingDisambiguationDialog.tsx`

```typescript
import { X, Plus, ArrowRight, Sparkles } from 'lucide-react';

interface CandidateSession {
  sessionId: string;
  sessionName: string;
  summary: string;
  confidence: number;
}

interface RoutingDisambiguationDialogProps {
  candidates: CandidateSession[];
  onCreateNew: (suggestedName: string) => void;
  onSelectSession: (sessionId: string) => void;
  onCancel: () => void;
  suggestedName?: string;
}

export default function RoutingDisambiguationDialog({
  candidates,
  onCreateNew,
  onSelectSession,
  onCancel,
  suggestedName = 'New Session',
}: RoutingDisambiguationDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      onClick={onCancel}
    >
      <div
        className="bg-zinc-800 rounded-xl p-5 w-full max-w-md border border-zinc-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Route Prompt</h3>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mb-4">
          Which session should handle this prompt?
        </p>

        <div className="space-y-2 mb-4">
          {candidates.map((c) => (
            <button
              key={c.sessionId}
              onClick={() => onSelectSession(c.sessionId)}
              className="w-full text-left p-3 bg-zinc-900/60 rounded-lg border border-zinc-700/50 hover:border-cyan-500/30 hover:bg-zinc-800/80 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-200 group-hover:text-white">
                  {c.sessionName}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {Math.round(c.confidence * 100)}% match
                </span>
              </div>
              {c.summary && (
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{c.summary}</p>
              )}
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => onCreateNew(suggestedName)}
            className="w-full flex items-center justify-center gap-2 p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Create New: {suggestedName}</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

### 5b. New Component: `src/components/RoutingToast.tsx`

```typescript
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RoutingToastProps {
  sessionName: string;
  onCancel: () => void;
  onConfirm: () => void;
  autoConfirmMs?: number;
}

export default function RoutingToast({
  sessionName,
  onCancel,
  onConfirm,
  autoConfirmMs = 3000,
}: RoutingToastProps) {
  const [timeLeft, setTimeLeft] = useState(autoConfirmMs / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearInterval(interval);
          onConfirm();
          return 0;
        }
        return +(prev - 0.1).toFixed(1);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onConfirm]);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/95 border border-cyan-500/20 rounded-lg shadow-xl backdrop-blur-sm">
        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="text-xs text-zinc-300">
          Routing to <span className="text-cyan-400 font-medium">{sessionName}</span>
        </span>
        <span className="text-[10px] text-zinc-600">{timeLeft.toFixed(1)}s</span>
        <button
          onClick={onCancel}
          className="text-zinc-500 hover:text-zinc-300 transition-colors ml-1"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
```

### 5c. Modify `src/pages/TerminalPage.tsx`

**New imports:**

```typescript
import RoutingDisambiguationDialog from '../components/RoutingDisambiguationDialog';
import RoutingToast from '../components/RoutingToast';
import { Loader2 } from 'lucide-react'; // add to existing lucide import
```

**New state variables** (add near existing state, ~line 155-190):

```typescript
// Auto-assign routing
const [autoAssignConfig, setAutoAssignConfig] = useState<any>(null);
const [routingResult, setRoutingResult] = useState<any>(null);
const [isRouting, setIsRouting] = useState(false);
const [showDisambiguation, setShowDisambiguation] = useState(false);
const [disambiguationCandidates, setDisambiguationCandidates] = useState<any[]>([]);
const [showRoutingToast, setShowRoutingToast] = useState(false);
const [routingToastSession, setRoutingToastSession] = useState('');
const [routingCosts, setRoutingCosts] = useState<any>(null);
const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
```

**Load config on mount:**

```typescript
useEffect(() => {
  window.deskflowAPI?.getAutoAssignConfig?.().then(setAutoAssignConfig);
}, []);
```

**Modify the instruction send handler.** Find where instructions are currently sent (the function that handles `@term` routing). Add auto-assign logic BEFORE the existing manual routing:

```typescript
// In the instruction send handler, BEFORE the existing send logic:
const handleSendInstruction = async (prompt: string, targetTerminalId?: string) => {
  // If target is explicitly set (manual @term), use it directly
  if (targetTerminalId) {
    await sendPromptToTerminal(targetTerminalId, prompt);
    return;
  }

  // If auto-assign is OFF or not configured, fall back to default behavior
  if (!autoAssignConfig?.enabled) {
    // existing default behavior (send to active terminal or show picker)
    handleDefaultSend(prompt);
    return;
  }

  // AUTO-ASSIGN PATH
  setIsRouting(true);
  setPendingPrompt(prompt);

  try {
    const result = await window.deskflowAPI?.routePrompt?.({ prompt });

    if (!result) {
      handleDefaultSend(prompt);
      return;
    }

    if (result.action === 'manual') {
      // Fallback to manual
      handleDefaultSend(prompt);
      return;
    }

    if (result.action === 'create_new') {
      // Auto-create a new session
      const newSessionId = `session-${Date.now()}`;
      const newTerminalId = `term-${Date.now()}`;

      // Spawn terminal
      await window.deskflowAPI?.spawnTerminal?.(newTerminalId, {
        cwd: selectedProjectPath || undefined,
      });

      // Save session
      await window.deskflowAPI?.saveTerminalSession?.({
        id: newSessionId,
        projectId: selectedProject,
        agent: 'claude',
        terminalId: newTerminalId,
        topic: result.suggestedName,
        workingDirectory: selectedProjectPath || '',
        description: result.suggestedSummary,
        autoNamed: 1,
      });

      // Send prompt
      await sendPromptToTerminal(newTerminalId, prompt);

      // Refresh sessions
      loadSessions();
      return;
    }

    if (result.action === 'route') {
      const confidence = result.confidence || 0;

      if (confidence >= 0.7) {
        // High confidence — auto-route
        await sendPromptToTerminal(result.terminalId, prompt);
      } else if (confidence >= 0.4) {
        // Medium — show toast with 3s cancel window
        setRoutingToastSession(result.sessionName);
        setShowRoutingToast(true);
        setRoutingResult(result);
        // The toast auto-confirms after 3s or user cancels
      } else {
        // Low — show disambiguation
        setDisambiguationCandidates([{
          sessionId: result.sessionId,
          sessionName: result.sessionName,
          summary: result.reason || '',
          confidence: result.confidence,
        }]);
        setShowDisambiguation(true);
        setRoutingResult(result);
      }
    }
  } catch (err) {
    console.error('Auto-assign routing failed:', err);
    handleDefaultSend(prompt);
  } finally {
    setIsRouting(false);
  }
};

// Toast confirm/cancel handlers
const handleRoutingConfirm = async () => {
  setShowRoutingToast(false);
  if (routingResult?.terminalId && pendingPrompt) {
    await sendPromptToTerminal(routingResult.terminalId, pendingPrompt);
  }
  setPendingPrompt(null);
  setRoutingResult(null);
};

const handleRoutingCancel = () => {
  setShowRoutingToast(false);
  setPendingPrompt(null);
  setRoutingResult(null);
};

// Disambiguation handlers
const handleDisambiguationSelect = async (sessionId: string) => {
  setShowDisambiguation(false);
  const session = sessions.find((s: any) => s.id === sessionId);
  if (session?.terminal_id && pendingPrompt) {
    await sendPromptToTerminal(session.terminal_id, pendingPrompt);
  }
  setPendingPrompt(null);
};

const handleDisambiguationCreateNew = async (name: string) => {
  setShowDisambiguation(false);
  // Same create-new logic as above
  const newSessionId = `session-${Date.now()}`;
  const newTerminalId = `term-${Date.now()}`;
  await window.deskflowAPI?.spawnTerminal?.(newTerminalId, { cwd: selectedProjectPath || undefined });
  await window.deskflowAPI?.saveTerminalSession?.({
    id: newSessionId,
    projectId: selectedProject,
    agent: 'claude',
    terminalId: newTerminalId,
    topic: name,
    workingDirectory: selectedProjectPath || '',
    description: pendingPrompt?.substring(0, 120),
    autoNamed: 1,
  });
  if (pendingPrompt) {
    await sendPromptToTerminal(newTerminalId, pendingPrompt);
  }
  setPendingPrompt(null);
  loadSessions();
};
```

**Add async summary update after terminal responses.** Find where terminal output is processed (the `onData` callback for terminals). Add after parsing:

```typescript
// After existing metadata parsing in the terminal output handler:
// Fire-and-forget summary update
if (autoAssignConfig?.enabled) {
  const session = sessions.find((s: any) => s.terminal_id === terminalId);
  if (session) {
    // Don't await — fire and forget
    window.deskflowAPI?.updateSessionSummary?.({ sessionId: session.id }).catch(() => {});
  }
}
```

**Render routing UI elements** (add near where FeaturesDialog is rendered):

```tsx
{/* Routing toast */}
{showRoutingToast && (
  <RoutingToast
    sessionName={routingToastSession}
    onCancel={handleRoutingCancel}
    onConfirm={handleRoutingConfirm}
  />
)}

{/* Disambiguation dialog */}
{showDisambiguation && (
  <RoutingDisambiguationDialog
    candidates={disambiguationCandidates}
    onSelectSession={handleDisambiguationSelect}
    onCreateNew={handleDisambiguationCreateNew}
    onCancel={() => { setShowDisambiguation(false); setPendingPrompt(null); }}
  />
)}

{/* Routing spinner in instruction input */}
{isRouting && (
  <div className="flex items-center gap-1.5 text-cyan-400">
    <Loader2 className="w-3 h-3 animate-spin" />
    <span className="text-[10px]">Routing...</span>
  </div>
)}
```

**Modify the session list item rendering** (find where sessions are rendered in the sidebar). Add summary line and auto badge:

```tsx
{/* Inside each session list item, after the topic line */}
{session.description && (
  <p className="text-[10px] text-zinc-600 truncate max-w-[200px]">
    {session.description}
  </p>
)}
{session.auto_named && (
  <span className="text-[9px] text-cyan-600 bg-cyan-500/10 px-1 py-0.5 rounded">
    auto
  </span>
)}
```

### 5d. Configs Tab Additions

Find the Configs tab section (~line 2281-2360) and add these sections AFTER the existing "Debug Mode" toggle:

```tsx
{/* ── Auto-Assign Configuration ─────────────────────── */}
<div className="space-y-3">
  <h4 className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
    <Sparkles className="w-3 h-3" />
    Auto-Assign Routing
  </h4>

  {/* Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <span className="text-xs text-zinc-300">Auto-assign prompts to sessions</span>
      <p className="text-[10px] text-zinc-600">AI routes your prompts to the best-matching session</p>
    </div>
    <button
      onClick={async () => {
        const newConfig = { ...autoAssignConfig, enabled: !autoAssignConfig?.enabled };
        await window.deskflowAPI?.saveAutoAssignConfig?.(newConfig);
        setAutoAssignConfig(newConfig);
      }}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        autoAssignConfig?.enabled ? 'bg-cyan-500/30 border border-cyan-500/40' : 'bg-zinc-700 border border-zinc-600'
      }`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
        autoAssignConfig?.enabled ? 'translate-x-4 bg-cyan-400' : 'translate-x-0.5 bg-zinc-400'
      }`} />
    </button>
  </div>

  {/* Routing Model */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-400">Routing model</span>
    <select
      value={autoAssignConfig?.routingModel || 'anthropic/claude-3.5-haiku'}
      onChange={async (e) => {
        const newConfig = { ...autoAssignConfig, routingModel: e.target.value };
        await window.deskflowAPI?.saveAutoAssignConfig?.(newConfig);
        setAutoAssignConfig(newConfig);
      }}
      className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-orange-500/40"
    >
      <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku ($0.80/M)</option>
      <option value="anthropic/claude-3-haiku">Claude 3 Haiku ($0.25/M)</option>
      <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash ($0.10/M)</option>
      <option value="openai/gpt-4o-mini">GPT-4o Mini ($0.15/M)</option>
    </select>
  </div>

  {/* Summary Frequency */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-400">Summary frequency</span>
    <select
      value={autoAssignConfig?.summaryFrequency || 10}
      onChange={async (e) => {
        const newConfig = { ...autoAssignConfig, summaryFrequency: parseInt(e.target.value) };
        await window.deskflowAPI?.saveAutoAssignConfig?.(newConfig);
        setAutoAssignConfig(newConfig);
      }}
      className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-orange-500/40"
    >
      <option value="5">Every 5 messages</option>
      <option value="10">Every 10 messages</option>
      <option value="20">Every 20 messages</option>
      <option value="0">Manual only</option>
    </select>
  </div>

  {/* Auto-Rename Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <span className="text-xs text-zinc-300">Auto-rename sessions</span>
      <p className="text-[10px] text-zinc-600">AI generates descriptive session names</p>
    </div>
    <button
      onClick={async () => {
        const newConfig = { ...autoAssignConfig, autoRename: !autoAssignConfig?.autoRename };
        await window.deskflowAPI?.saveAutoAssignConfig?.(newConfig);
        setAutoAssignConfig(newConfig);
      }}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        autoAssignConfig?.autoRename ? 'bg-cyan-500/30 border border-cyan-500/40' : 'bg-zinc-700 border border-zinc-600'
      }`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
        autoAssignConfig?.autoRename ? 'translate-x-4 bg-cyan-400' : 'translate-x-0.5 bg-zinc-400'
      }`} />
    </button>
  </div>

  {/* Rename Threshold */}
  {autoAssignConfig?.autoRename && (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">Rename after N messages</span>
      <select
        value={autoAssignConfig?.renameThreshold || 5}
        onChange={async (e) => {
          const newConfig = { ...autoAssignConfig, renameThreshold: parseInt(e.target.value) };
          await window.deskflowAPI?.saveAutoAssignConfig?.(newConfig);
          setAutoAssignConfig(newConfig);
        }}
        className="text-[10px] bg-zinc-800 border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-orange-500/40"
      >
        <option value="3">3 messages</option>
        <option value="5">5 messages</option>
        <option value="10">10 messages</option>
      </select>
    </div>
  )}
</div>

{/* ── Infrastructure Cost Card ──────────────────────── */}
<div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/70">
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
      <DollarSign className="w-3 h-3 text-emerald-400" />
      Routing Infrastructure Cost
    </h4>
    <button
      onClick={async () => {
        if (confirm('Reset all routing cost counters?')) {
          await window.deskflowAPI?.resetRoutingCosts?.();
          loadRoutingCosts();
        }
      }}
      className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
    >
      Reset
    </button>
  </div>

  {routingCosts ? (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-zinc-800/50 rounded p-2">
        <span className="text-[10px] text-zinc-500">Today</span>
        <p className="text-sm font-mono text-emerald-400">${(routingCosts.today?.total || 0).toFixed(4)}</p>
        <span className="text-[9px] text-zinc-600">{routingCosts.today?.calls || 0} calls</span>
      </div>
      <div className="bg-zinc-800/50 rounded p-2">
        <span className="text-[10px] text-zinc-500">This Week</span>
        <p className="text-sm font-mono text-emerald-400">${(routingCosts.week?.total || 0).toFixed(4)}</p>
        <span className="text-[9px] text-zinc-600">{routingCosts.week?.calls || 0} calls</span>
      </div>
      <div className="bg-zinc-800/50 rounded p-2">
        <span className="text-[10px] text-zinc-500">This Month</span>
        <p className="text-sm font-mono text-emerald-400">${(routingCosts.month?.total || 0).toFixed(4)}</p>
        <span className="text-[9px] text-zinc-600">{routingCosts.month?.calls || 0} calls</span>
      </div>
      <div className="bg-zinc-800/50 rounded p-2">
        <span className="text-[10px] text-zinc-500">All Time</span>
        <p className="text-sm font-mono text-zinc-300">${(routingCosts.total?.total || 0).toFixed(4)}</p>
        <span className="text-[9px] text-zinc-600">{routingCosts.total?.calls || 0} calls</span>
      </div>
    </div>
  ) : (
    <div className="text-center py-3">
      <p className="text-[10px] text-zinc-600">Loading costs...</p>
    </div>
  )}

  {/* Cost breakdown by type */}
  {routingCosts?.byType && routingCosts.byType.length > 0 && (
    <div className="mt-2 pt-2 border-t border-zinc-800/50 space-y-1">
      {routingCosts.byType.map((bt: any) => (
        <div key={bt.call_type} className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 capitalize">{bt.call_type}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-400">${(bt.total || 0).toFixed(4)}</span>
            <span className="text-[9px] text-zinc-600">×{bt.calls}</span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

**Add `DollarSign` to the lucide-react import** in TerminalPage.tsx.

**Load routing costs when Configs tab is active:**

```typescript
const loadRoutingCosts = async () => {
  try {
    const costs = await window.deskflowAPI?.getRoutingCosts?.();
    setRoutingCosts(costs);
  } catch (err) {
    console.error('Failed to load routing costs:', err);
  }
};

// In the tab switch handler, when activeTab becomes 'configs':
useEffect(() => {
  if (activeTab === 'configs') {
    loadRoutingCosts();
    window.deskflowAPI?.getAutoAssignConfig?.().then(setAutoAssignConfig);
  }
}, [activeTab]);
```

---

## 6. Data Flow Diagram

```
BEFORE (Manual):
  User types prompt → @term dropdown → user picks terminal → terminal:write IPC

AFTER (Auto-Assign ON):
  User types prompt
    │
    ├─ @term explicit? ──► YES ──► terminal:write IPC (unchanged)
    │
    └─ No explicit target
         │
         ├─ route-prompt IPC
         │    ├─ Load active sessions + descriptions
         │    ├─ callOpenRouter (routing model, temp 0.1, 300 tok)
         │    │    └─ Input: session list + user prompt
         │    │    └─ Output: { action, session_index, confidence }
         │    ├─ Log cost to routing_costs table
         │    └─ Return result to renderer
         │
         ├─ confidence ≥ 0.7 ──► Auto-send (silent)
         ├─ confidence 0.4-0.69 ──► RoutingToast (3s cancel window)
         ├─ confidence < 0.4 ──► DisambiguationDialog (pick or create)
         └─ create_new ──► spawnTerminal + saveTerminalSession + terminal:write
         
  After response (async):
    │
    ├─ Check msg count vs summaryFrequency
    ├─ update-session-summary IPC
    │    ├─ summarize-with-llm → new description
    │    ├─ If autoRename ON && auto_named: summarize-with-llm → new topic
    │    ├─ UPDATE terminal_sessions
    │    └─ Log cost to routing_costs
    │
    └─ Parse ## Session Status blocks (existing)
```

---

## 7. Implementation Order

| Step | File | Action | Verify |
|------|------|--------|--------|
| 1 | `src/main.ts` | Add `routing_costs` table + `auto_named` column in DB init | App starts, table exists |
| 2 | `src/main.ts` | Add helper functions: `loadAutoAssignConfig`, `saveAutoAssignConfig`, `generateSessionName`, `computeCost`, `logRoutingCost`, `callOpenRouter` | No compile errors |
| 3 | `src/main.ts` | Add `route-prompt` IPC handler | DevTools: `deskflowAPI.routePrompt({prompt: 'test'})` returns result |
| 4 | `src/main.ts` | Add `update-session-summary` IPC handler | DevTools: `deskflowAPI.updateSessionSummary({sessionId: 'x'})` |
| 5 | `src/main.ts` | Add `get-routing-costs`, `reset-routing-costs`, `get-auto-assign-config`, `save-auto-assign-config` handlers | DevTools: each returns data |
| 6 | `src/preload.ts` | Add all 6 new preload bridges | `npm run build` passes |
| 7 | `src/components/RoutingDisambiguationDialog.tsx` | Create new file | No import errors |
| 8 | `src/components/RoutingToast.tsx` | Create new file | No import errors |
| 9 | `src/pages/TerminalPage.tsx` | Add state, config loading, routing handler, toast/dialog render | `npm run build` passes |
| 10 | `src/pages/TerminalPage.tsx` | Add Configs tab UI (toggle, model, frequency, costs) | Toggle works, costs display |
| 11 | `src/pages/TerminalPage.tsx` | Modify instruction send handler to check auto-assign | Typing prompt routes correctly |
| 12 | `src/pages/TerminalPage.tsx` | Add summary line + auto badge to session list | Sessions show descriptions |

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| **No API key** | `callOpenRouter` throws → `route-prompt` returns `{ action: 'manual', reason: '...' }` → falls back to default |
| **No active sessions** | Returns `{ action: 'create_new' }` with confidence 1.0 |
| **LLM returns invalid JSON** | `jsonMatch` check fails → fallback `{ action: 'create_new', confidence: 0.3 }` |
| **User has manually named session** | `auto_named = 0` → auto-rename skips, only updates description |
| **Summary frequency = 0** | Manual only — `update-session-summary` always returns `{ skipped: true }` unless `force: true` |
| **Routing call times out** | fetch throws → caught → fallback to manual routing |
| **Multiple rapid prompts** | Each triggers independent routing call; `isRouting` prevents double-send UI |
| **Session has no messages** | `update-session-summary` returns `{ skipped: true }` — needs ≥2 messages |
| **Empty DB / first run** | `auto-assign-config.json` doesn't exist → `loadAutoAssignConfig` returns defaults (enabled: false) |
| **`@term` explicit routing** | Takes priority over auto-assign — manual routing is never overridden |
| **Cost table missing** | `CREATE TABLE IF NOT EXISTS` is idempotent; queries return zeros |
| **`auto_named` column exists** | `ALTER TABLE` wrapped in try/catch — ignores "duplicate column" error |

---

## 9. The Routing System Prompt

This is the critical piece that makes auto-assign work. It's designed for:
- **Determinism** (temperature 0.1)
- **Speed** (300 max tokens)
- **Structured output** (JSON only)

```
You are a session router for an AI agent workspace. Given a user's prompt 
and a list of active sessions, decide which session the prompt should be 
routed to.

RULES:
- Match based on topic similarity, ongoing work, and context overlap
- If the prompt is unrelated to ALL existing sessions, respond with 
  action: "create_new"
- Be decisive — avoid "create_new" if any session is a reasonable match
- Confidence is 0.0-1.0: how certain you are that this session is the 
  right target

RESPOND WITH EXACTLY THIS JSON FORMAT, NOTHING ELSE:
{"session_index": <number or null>, "action": "route" or "create_new", 
 "confidence": <0.0-1.0>, "suggested_name": "<string if create_new>", 
 "reason": "<1 sentence>"}
```

**Cost estimate per routing call:**
- Input: ~200 tokens (session list + prompt)
- Output: ~50 tokens (JSON)
- Model: Claude 3.5 Haiku at $0.80/M input + $4.00/M output
- Per call: ~$0.00036 (0.036 cents)
- 100 calls/day = ~$0.036/day = ~$1.08/month
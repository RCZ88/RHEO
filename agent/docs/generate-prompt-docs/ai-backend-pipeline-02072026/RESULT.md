Here is the complete backend implementation for the AI Assistant pipeline. This covers the central `ai-chat:send` orchestrator, the bug fixes, and the missing IPC handlers. 

### 1. `src/main.ts` — Backend Pipeline & Handler Fixes

Add or replace these handlers in your `src/main.ts`. 

**Task A: The Central Chat Pipeline (`ai-chat:send`)**
This handler loads history, gathers context, builds the system prompt, streams the response, parses the JSON, and saves everything to the database.

```typescript
// ==========================================
// AI CHAT CENTRAL PIPELINE
// ==========================================
ipcMain.handle('ai-chat:send', async (event, data: {
  threadDate: string;
  message: string;
  providerId?: string;
}) => {
  try {
    if (!data.message || !data.threadDate) {
      return { success: false, error: 'Missing message or threadDate' };
    }

    // 1. Load chat history (last 50 messages)
    const history = db!.prepare(
      `SELECT role, content FROM ai_chat_messages WHERE thread_date = ? ORDER BY created_at ASC LIMIT 50`
    ).all(data.threadDate) as Array<{ role: string; content: string }>;

    // 2. Gather App Context
    const today = new Date().toISOString().split('T')[0];
    let contextGoals: any[] = [];
    let contextLongTerm: any[] = [];
    let contextPlanning: string = '';
    
    try {
      contextGoals = db!.prepare('SELECT id, title, status, category, period, date FROM goals WHERE date = ?').all(today);
    } catch {}
    
    try {
      contextLongTerm = db!.prepare("SELECT id, title, status, category FROM goals WHERE period = 'longterm' ORDER BY priority ASC").all();
    } catch {}

    try {
      const planningPath = path.join(app.getPath('userData'), 'PLANNING.md');
      if (fs.existsSync(planningPath)) {
        contextPlanning = fs.readFileSync(planningPath, 'utf-8').substring(0, 2000); // Truncate to prevent token bloat
      }
    } catch {}

    // 3. Build System Prompt
    const systemPrompt = `You are DeskFlow AI, an assistant integrated into the user's productivity tracker.
    
## Current App State
- Today's Goals: ${JSON.stringify(contextGoals)}
- Long-Term Goals: ${JSON.stringify(contextLongTerm)}
- Planning Notes (PLANNING.md): 
${contextPlanning}

## Your Output Format
You MUST respond in the following JSON structure. Do not include markdown formatting or code blocks, just raw JSON:
{
  "type": "general_chat" | "goal_suggestion" | "plan_update" | "stats_summary" | "action_list" | "digest_item" | "chart_data" | "error",
  "content": "Your natural language response text",
  "data": { ... type-specific structured data ... }
}

For type "general_chat": content is your plain text response, data is empty {}.
For type "goal_suggestion":
  data: { "goals": [{ "title": string, "category": string, "reason": string }], "source": "ai" }
For type "plan_update":
  data: { "changes": [{ "action": "add"|"modify"|"complete", "goal": { "title": string, "priority": number, "category": string } }] }
For type "stats_summary":
  data: { "metrics": [{ "label": string, "value": string, "change": string, "icon": string }], "period": "today"|"week"|"month" }
For type "action_list":
  data: { "actions": [{ "label": string, "description": string, "priority": "high"|"medium"|"low" }] }
For type "chart_data":
  data: { "chartType": "bar"|"line"|"pie", "labels": string[], "datasets": [{ "label": string, "data": number[], "color": string }] }
`;

    // 4. Call AI Provider
    const providersState = await getAiProvidersState(); // Assumes this internal function exists
    const providerKey = data.providerId || providersState.activeProvider;
    const provider = providersState.providers?.[providerKey];

    if (!provider || !provider.apiKey) {
      return { success: false, error: 'No AI provider configured. Open Settings → AI Providers to add an API key.' };
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: data.message }
    ];

    const { callProvider } = require('./services/providers/callProvider.cjs');
    
    const result = await callProvider(
      provider,
      { model: provider.defaultModel || 'gpt-4o-mini', messages, temperature: 0.7 },
      {
        onChunk: (delta: string) => {
          event.sender.send('provider-chunk', { delta, providerId: provider.id, threadDate: data.threadDate });
        },
        pathTag: 'AI_CHAT_SEND',
      }
    );

    event.sender.send('provider-chunk', {
      delta: null, 
      done: true, 
      providerId: provider.id, 
      full: result.content, 
      threadDate: data.threadDate 
    });

    // 5. Parse Response
    let parsedJson = null;
    try {
      // Attempt to extract JSON if the model wrapped it in markdown
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      } else {
        parsedJson = { type: 'general_chat', content: result.content, data: {} };
      }
    } catch (e) {
      parsedJson = { type: 'general_chat', content: result.content, data: {} };
    }

    // 6. Save to DB
    const now = new Date().toISOString();
    db!.prepare(
      `INSERT INTO ai_chat_messages (thread_date, role, content, parsed_json, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(data.threadDate, 'user', data.message, null, now);
    
    const assistantMsg = db!.prepare(
      `INSERT INTO ai_chat_messages (thread_date, role, content, parsed_json, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(data.threadDate, 'assistant', result.content, JSON.stringify(parsedJson), now);

    // 7. Return Result
    return {
      success: true,
      message: {
        id: assistantMsg.lastInsertRowid,
        role: 'assistant',
        content: result.content,
        parsed_json: parsedJson,
        created_at: now
      }
    };

  } catch (err: any) {
    console.error('ai-chat:send error', err);
    return { success: false, error: err.message || 'Failed to process AI chat' };
  }
});
```

**Task B: Fix `save-goal-review` Bug & Add `get-goal-review`**
Find the existing `save-goal-review` handler, delete it, and replace it with this block. This fixes the missing column bug by using the dedicated `goal_reviews` table.

```typescript
// ==========================================
// GOAL REVIEW FIXES
// ==========================================
ipcMain.removeHandler('save-goal-review');
ipcMain.handle('save-goal-review', async (_event, date: string, reviewSummary: string) => {
  try {
    db!.prepare(`
      INSERT INTO goal_reviews (date, review_summary, created_at) 
      VALUES (?, ?, datetime('now')) 
      ON CONFLICT(date) DO UPDATE SET review_summary = ?, created_at = datetime('now')
    `).run(date, reviewSummary, reviewSummary);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-goal-review', async (_event, date: string) => {
  try {
    const row = db!.prepare('SELECT date, review_summary, created_at FROM goal_reviews WHERE date = ?').get(date);
    return { success: true, review: row || null };
  } catch (err: any) {
    return { success: false, error: err.message, review: null };
  }
});
```

**Task C: Verify/Implement `get-goals-batch`**
If `get-goals-batch` is missing or broken, add this implementation. It groups goals by date and attaches the review summary.

```typescript
// ==========================================
// GOALS BATCH HISTORY
// ==========================================
ipcMain.handle('get-goals-batch', async (_event, startDate: string, endDate: string) => {
  try {
    const goals = db!.prepare('SELECT * FROM goals WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC').all(startDate, endDate);
    const reviews = db!.prepare('SELECT date, review_summary FROM goal_reviews WHERE date >= ? AND date <= ?').all(startDate, endDate);
    
    const reviewMap = new Map(reviews.map((r: any) => [r.date, r.review_summary]));
    const daysMap = new Map<string, any>();
    
    for (const g of goals) {
      if (!daysMap.has(g.date)) {
        daysMap.set(g.date, { date: g.date, goals: [], reviewSummary: reviewMap.get(g.date) });
      }
      daysMap.get(g.date)!.goals.push(g);
    }
    
    // Include days that only have a review but no goals
    for (const [date, review] of reviewMap.entries()) {
      if (!daysMap.has(date)) {
        daysMap.set(date, { date, goals: [], reviewSummary: review });
      }
    }

    const days = Array.from(daysMap.values()).sort((a, b) => a.date < b.date ? 1 : -1);
    return { success: true, days };
  } catch (err: any) {
    return { success: false, error: err.message, days: [] };
  }
});
```

**Task D: Create `save-goal-suggestion`**
Allows the frontend to accept AI suggestions and save them directly to the daily goals list.

```typescript
// ==========================================
// SAVE GOAL SUGGESTION
// ==========================================
ipcMain.handle('save-goal-suggestion', async (_event, data: {
  title: string;
  category: string;
  date: string;
  source: 'ai';
  reason?: string;
}) => {
  try {
    const id = `goal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db!.prepare(
      `INSERT INTO goals (id, title, category, date, status, source, period, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, data.title, data.category, data.date, 'active', 'ai', 'daily');
    
    return { success: true, goal: { id, ...data, status: 'active', period: 'daily' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
```

---

### 2. `src/preload.ts` — Expose New APIs to Renderer

Add these to the `deskflowAPI` object in `src/preload.ts` so the frontend can call them.

```typescript
// Inside the contextBridge.exposeInMainWorld('deskflowAPI', { ... }) block

// Central AI Chat Pipeline
aiChatSend: (data: { threadDate: string; message: string; providerId?: string }) =>
  ipcRenderer.invoke('ai-chat:send', data),

// Goal Review Fixes
getGoalReview: (date: string) =>
  ipcRenderer.invoke('get-goal-review', date),

// Batch History
getGoalsBatch: (startDate: string, endDate: string) =>
  ipcRenderer.invoke('get-goals-batch', startDate, endDate),

// Save AI Suggestions
saveGoalSuggestion: (data: { title: string; category: string; date: string; source: 'ai'; reason?: string }) =>
  ipcRenderer.invoke('save-goal-suggestion', data),
```

---

### 3. `src/pages/AiPage.tsx` — Hook Up the Frontend

Now that the backend pipeline exists, update the `handleChatSend` function in `AiPage.tsx` to call `aiChatSend` instead of the stub. It will automatically stream chunks via `onProviderChunk` and return the parsed JSON.

```tsx
// In src/pages/AiPage.tsx

const handleChatSend = useCallback(async (text: string) => {
  const trimmed = text.trim();
  if (!trimmed || chatStreaming) return;

  setChatError(null);
  
  const userMsg: ChatMessage = {
    id: `u-${Date.now()}`,
    role: 'user',
    content: trimmed,
    timestamp: new Date().toISOString(),
  };
  
  const aiMsgId = `a-${Date.now()}`;
  const aiMsg: ChatMessage = {
    id: aiMsgId,
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
  };
  
  setChatMessages((prev) => [...prev, userMsg, aiMsg]);
  setChatInput('');
  streamingMsgId.current = aiMsgId;
  setChatThinking(true);
  setChatStreaming(true);

  try {
    // Call the new central backend pipeline
    const result = await window.deskflowAPI!.aiChatSend({
      threadDate: TODAY,
      message: trimmed,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to get AI response');
    }

    // Update the AI message with the final content and parsed UI data
    setChatMessages((prev) => prev.map((m) =>
      m.id === aiMsgId 
        ? { 
            ...m, 
            content: result.message.content, 
            parsed_json: result.message.parsed_json,
            timestamp: result.message.created_at 
          } 
        : m
    ));
  } catch (e: any) {
    setChatError(e?.message ?? 'Failed to send message.');
    // Remove the empty AI placeholder on error
    setChatMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
  } finally {
    setChatStreaming(false);
    setChatThinking(false);
    streamingMsgId.current = null;
  }
}, [chatStreaming]);

// Make sure to attach the provider chunk listener in useEffect
useEffect(() => {
  const cleanup = window.deskflowAPI!.onProviderChunk((data: any) => {
    if (data.threadDate !== TODAY) return; // Ignore other threads
    
    if (data.done) {
      // Final chunk handling is done by the aiChatSend promise resolving
      return;
    }
    
    if (data.delta) {
      setChatMessages((prev) => prev.map((m) =>
        m.id === streamingMsgId.current ? { ...m, content: m.content + data.delta } : m
      ));
    }
  });
  
  return () => cleanup();
}, []);
```

### Summary of What This Unlocks
1. **Full App Context:** The AI now sees the user's goals, long-term plans, and PLANNING.md content automatically.
2. **Structured UI Rendering:** Because the backend enforces the JSON schema and saves it to `parsed_json`, your frontend `MessageBubble` component can now read `message.parsed_json` and render custom charts, goal cards, or action lists instead of just plain text.
3. **Persistent History:** All conversations are saved to the `ai_chat_messages` table with their structured data intact, meaning if you reload the page, the custom UI cards will re-render exactly as they were.
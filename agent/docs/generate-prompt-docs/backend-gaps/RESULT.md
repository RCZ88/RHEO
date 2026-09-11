# Backend Implementation Gaps — Complete Fix

## Gap 1: DORA Metrics — Real Change Failure Rate & MTTR

### Modification to `src/main.ts` (lines ~7459-7463)

Replace the two hardcoded lines and surrounding context:

```ts
// ─── BEFORE (lines ~7459-7463) ───
// Change failure rate (placeholder - would need incident data)
const changeFailureRate = 0; // Would need integration with incident tracking

// MTTR (placeholder)
const meanTimeToRecoveryHours = 0; // Would need integration with incident tracking

// ─── AFTER ───
// Change failure rate: deployment commits followed by terminal errors within 24h
let changeFailureRate = 0;
try {
    const deployCommits = db!.prepare(`
        SELECT id, date, message FROM commits
        WHERE project_id = ? AND date >= ?
        AND (message LIKE '%deploy%' OR message LIKE '%release%' OR message LIKE '%publish%')
    `).all(projectId, cutoffDate) as any[];

    if (deployCommits.length > 0) {
        const errorSessionsForCFR = db!.prepare(`
            SELECT created_at FROM terminal_sessions
            WHERE project_id = ? AND status = 'error' AND created_at >= ?
        `).all(projectId, cutoffDate) as any[];

        let failedDeployments = 0;
        for (const commit of deployCommits) {
            try {
                const commitTime = new Date(commit.date).getTime();
                if (isNaN(commitTime)) continue;
                const hasFailure = errorSessionsForCFR.some((s: any) => {
                    try {
                        const sessionTime = new Date(s.created_at).getTime();
                        return !isNaN(sessionTime)
                            && sessionTime >= commitTime
                            && sessionTime <= commitTime + 86400000; // 24h window
                    } catch { return false; }
                });
                if (hasFailure) failedDeployments++;
            } catch { continue; }
        }
        changeFailureRate = failedDeployments / deployCommits.length;
    }
} catch (e) {
    console.warn('[DORA] CFR calculation failed:', e);
    changeFailureRate = 0;
}

// MTTR: average time from error session to next successful session
let meanTimeToRecoveryHours = 0;
try {
    const errorSessionsForMTTR = db!.prepare(`
        SELECT id, created_at FROM terminal_sessions
        WHERE project_id = ? AND status = 'error' AND created_at >= ?
        ORDER BY created_at ASC
    `).all(projectId, cutoffDate) as any[];

    if (errorSessionsForMTTR.length > 0) {
        const successfulSessions = db!.prepare(`
            SELECT created_at FROM terminal_sessions
            WHERE project_id = ? AND status NOT IN ('error', 'stopped') AND created_at >= ?
            ORDER BY created_at ASC
        `).all(projectId, cutoffDate) as any[];

        let totalRecoveryHours = 0;
        let recoveredCount = 0;

        for (const errSession of errorSessionsForMTTR) {
            const errTime = new Date(errSession.created_at).getTime();
            if (isNaN(errTime)) continue;

            // Find the first successful session after this error
            for (const s of successfulSessions) {
                const successTime = new Date(s.created_at).getTime();
                if (isNaN(successTime) || successTime <= errTime) continue;

                const hours = (successTime - errTime) / 3600000;
                if (hours >= 0 && hours < 720) { // Cap at 30 days
                    totalRecoveryHours += hours;
                    recoveredCount++;
                }
                break; // Only count the first recovery
            }
        }

        meanTimeToRecoveryHours = recoveredCount > 0
            ? totalRecoveryHours / recoveredCount
            : 0;
    }
} catch (e) {
    console.warn('[DORA] MTTR calculation failed:', e);
    meanTimeToRecoveryHours = 0;
}
```

### What this does

**Change Failure Rate (CFR):**
1. Finds all deployment-like commits (messages containing "deploy", "release", "publish") in the period
2. Finds all terminal sessions with `status = 'error'` in the same period
3. For each deployment commit, checks if any error session occurred within 24 hours
4. CFR = deployments with failures / total deployments
5. Returns 0 if no deployments found (graceful degradation)

**Mean Time To Recovery (MTTR):**
1. Finds all error sessions in the period, sorted chronologically
2. Finds all successful sessions (not 'error' or 'stopped') in the period
3. For each error session, finds the first successful session after it
4. Computes the time difference in hours
5. Caps at 30 days (filters out stale sessions)
6. Averages across all recovered errors
7. Returns 0 if no error sessions found (graceful degradation)

---

## Gap 2: LLM Summarization — Real OpenRouter API Call

### Step 1: Add IPC handler to `src/main.ts`

Add this handler after the existing `test-openrouter-key` handler (around line 7755):

```ts
// ─── LLM Summarization via OpenRouter ─────────────────────

electron_1.ipcMain.handle('summarize-with-llm', async (_event, prompt: string, options?: { maxTokens?: number; model?: string }) => {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        return {
            success: false,
            error: 'No OpenRouter API key configured. Set openrouterApiKey in Settings to enable LLM summarization.'
        };
    }

    try {
        const maxTokens = options?.maxTokens || 800;
        const model = options?.model || OPENROUTER_MODELS[0];

        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://deskflow.app',
                'X-Title': 'DeskFlow',
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a technical session summarizer for a developer tool. Produce concise, structured markdown summaries of development sessions. Focus on:
- Key decisions made
- Changes implemented
- Problems encountered and their resolution status
- Outstanding items or next steps

Use headers (##) and bullet points. Be factual and precise. Do not fabricate information.`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: maxTokens,
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'unknown error');
            console.error('[LLM] API error:', response.status, errorBody.slice(0, 200));
            return {
                success: false,
                error: `LLM API error ${response.status}: ${errorBody.slice(0, 200)}`
            };
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content;

        if (!summary) {
            return { success: false, error: 'Empty response from LLM API' };
        }

        console.log(`[LLM] Summarization complete (${summary.length} chars, model: ${model})`);
        return { success: true, summary };

    } catch (err: any) {
        console.error('[LLM] Summarization failed:', err);
        return {
            success: false,
            error: err?.message || 'LLM summarization request failed'
        };
    }
});
```

### Step 2: Add preload bridge in `src/preload.ts`

Find the existing `deskflowAPI` object and add:

```ts
summarizeWithLLM: (prompt: string, options?: { maxTokens?: number; model?: string }) =>
    ipcRenderer.invoke('summarize-with-llm', prompt, options),
```

Add it near the other context-related bridges (e.g., near `summarize-session` if it exists, or near the OpenRouter test key bridge).

### Step 3: Modify `src/services/CompactionService.ts`

Replace the `DefaultLLMProvider` class (lines ~471-512) entirely:

```ts
class DefaultLLMProvider implements LLMProvider {
  async summarize(prompt: string): Promise<{
    success: boolean;
    summary?: string;
    error?: string;
  }> {
    try {
      const api = (window as any).deskflowAPI;

      if (!api?.summarizeWithLLM) {
        // Fallback: generate a basic extractive summary without LLM
        return this.extractiveFallback(prompt);
      }

      const result = await api.summarizeWithLLM(prompt, {
        maxTokens: 800,
      });

      if (result?.success && result.summary) {
        return { success: true, summary: result.summary };
      }

      // LLM failed — try extractive fallback
      if (result?.error) {
        console.warn('[LLMProvider] API call failed:', result.error);
      }

      return this.extractiveFallback(prompt);
    } catch (err: any) {
      console.warn('[LLMProvider] Summarization error:', err?.message);
      return this.extractiveFallback(prompt);
    }
  }

  /**
   * Extractive fallback: produces a structured summary from the raw
   * conversation text without calling an LLM. Used when no API key
   * is configured or the API call fails.
   */
  private extractiveFallback(prompt: string): {
    success: boolean;
    summary: string;
    error?: string;
  } {
    try {
      const lines = prompt.split('\n');
      const userMessages: string[] = [];
      const assistantMessages: string[] = [];

      for (const line of lines) {
        if (line.startsWith('[USER]:') || line.startsWith('USER:')) {
          const content = line.replace(/^\[?USER\]?:\s*/, '').trim();
          if (content) userMessages.push(content);
        } else if (line.startsWith('[ASSISTANT]:') || line.startsWith('ASSISTANT:')) {
          const content = line.replace(/^\[?ASSISTANT\]?:\s*/, '').trim();
          if (content) assistantMessages.push(content);
        }
      }

      const sections: string[] = ['# Session Summary (Auto-extracted)'];

      if (userMessages.length > 0) {
        sections.push('## User Requests');
        // Take up to 5 most significant user messages
        const significant = userMessages
          .filter(m => m.length > 20)
          .slice(0, 5)
          .map(m => `- ${m.slice(0, 200)}${m.length > 200 ? '...' : ''}`);
        sections.push(significant.join('\n'));
      }

      if (assistantMessages.length > 0) {
        sections.push('## Key Actions');
        const actions = assistantMessages
          .filter(m => m.length > 20)
          .slice(0, 5)
          .map(m => `- ${m.slice(0, 200)}${m.length > 200 ? '...' : ''}`);
        sections.push(actions.join('\n'));
      }

      sections.push(`## Stats`);
      sections.push(`- User messages: ${userMessages.length}`);
      sections.push(`- Assistant messages: ${assistantMessages.length}`);
      sections.push(`- Generated without LLM (extractive summary)`);

      return {
        success: true,
        summary: sections.join('\n\n'),
        error: 'LLM API unavailable — using extractive fallback',
      };
    } catch {
      return {
        success: true,
        summary: '# Session Summary\n\nSummary generation failed. Raw conversation data is available in the session history.',
        error: 'Both LLM and extractive summarization failed',
      };
    }
  }
}
```

### What this does

**When API key is configured:**
1. Calls OpenRouter API with the conversation text as a prompt
2. Uses the free/lightweight model (`liquid/lfm-2.5-1.2b-instruct:free`) by default
3. System prompt instructs the model to produce structured markdown summaries
4. Low temperature (0.3) for consistent, factual output
5. Returns the real LLM-generated summary

**When API key is NOT configured or API call fails:**
1. Falls back to **extractive summarization** — no LLM needed
2. Parses the conversation to extract user and assistant messages
3. Takes up to 5 significant messages from each role
4. Produces a structured markdown summary with stats
5. Clearly marks the summary as "auto-extracted" so users know it's not LLM-generated
6. Never returns the old misleading mock data

---

## Gap 3: RAG Semantic Search — Proper Cosine Similarity

### Modification to `src/services/RAGService.ts`

Replace the `semanticSearch` method (lines ~339-399) entirely:

```ts
/**
 * Perform semantic search using cosine similarity between the query
 * embedding and stored message embeddings.
 *
 * Embeddings are stored as BLOBs (Float32Array serialized via Buffer).
 * We deserialize and compute cosine similarity in JavaScript since
 * SQLite lacks native vector operations.
 */
public async semanticSearch(
    queryEmbedding: Float32Array, options: QueryOptions = {}
): Promise<ServiceResponse<RAGSearchResult[]>> {
    try {
        if (!this.db) {
            return {
                success: false,
                error: 'RAG database not initialized',
                timestamp: new Date()
            };
        }

        const limit = options.limit || 10;
        const minScore = options.minScore || 0.3;

        // Fetch all messages with embeddings
        let sql = `SELECT * FROM messages WHERE embedding IS NOT NULL`;
        const params: any[] = [];

        if (options.sessionId) {
            sql += ` AND session_id = ?`;
            params.push(options.sessionId);
        }

        const rows = this.db.prepare(sql).all(...params) as any[];

        if (rows.length === 0) {
            return { success: true, data: [], timestamp: new Date() };
        }

        // Compute cosine similarity for each stored embedding against the query
        const queryNorm = this.computeVectorNorm(queryEmbedding);

        if (queryNorm === 0) {
            return {
                success: true,
                data: [],
                timestamp: new Date(),
            };
        }

        const scored: Array<{ row: any; score: number }> = [];
        let skippedCount = 0;

        for (const row of rows) {
            try {
                if (!row.embedding) continue;

                const storedEmbedding = new Float32Array(Buffer.from(row.embedding));

                // Dimension mismatch — skip
                if (storedEmbedding.length !== queryEmbedding.length) {
                    skippedCount++;
                    continue;
                }

                const similarity = this.cosineSimilarity(
                    queryEmbedding,
                    storedEmbedding,
                    queryNorm
                );

                if (similarity >= minScore) {
                    scored.push({ row, score: similarity });
                }
            } catch {
                skippedCount++;
                continue;
            }
        }

        if (skippedCount > 0) {
            console.warn(
                `[RAG] semanticSearch: skipped ${skippedCount} embeddings (dimension mismatch or malformed)`
            );
        }

        // Sort by score descending, take top K
        scored.sort((a, b) => b.score - a.score);
        const topResults = scored.slice(0, limit);

        const results: RAGSearchResult[] = topResults.map(({ row, score }) => ({
            message: this.rowToMessage(row),
            score,
            type: 'semantic' as const,
        }));

        return { success: true, data: results, timestamp: new Date() };

    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Semantic search failed',
            timestamp: new Date()
        };
    }
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 = identical direction.
 */
private cosineSimilarity(
    a: Float32Array,
    b: Float32Array,
    normA?: number
): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
    }

    const normAVal = normA ?? this.computeVectorNorm(a);
    const normB = this.computeVectorNorm(b);

    if (normAVal === 0 || normB === 0) return 0;

    return dotProduct / (normAVal * normB);
}

/**
 * Compute L2 (Euclidean) norm of a vector.
 * Used as the denominator in cosine similarity.
 */
private computeVectorNorm(vec: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}
```

### What this does

1. **Fetches all messages with embeddings** from the RAG SQLite database
2. **Deserializes each embedding** from BLOB to `Float32Array` using `Buffer.from(row.embedding)`
3. **Computes proper cosine similarity** between the query embedding and each stored embedding:
   - `similarity = (A · B) / (||A|| × ||B||)`
   - Range: -1 to 1, where 1 = identical direction, 0 = orthogonal
4. **Filters by minimum score** (default 0.3) to exclude low-quality matches
5. **Handles dimension mismatches** gracefully — skips embeddings with different dimensions
6. **Sorts by score descending** and returns top K results
7. **Falls back gracefully** if no embeddings exist or database isn't initialized

The old broken SQL `CAST(SUM(CAST(SUBSTR(HEX(m.embedding), i*2-1, 2) AS INTEGER))` is completely replaced.

---

## Gap 4: Dead IPC Handlers — Stubs + Real Implementations

### Add to `src/main.ts`

Add this block near the end of the IPC handler registrations, before any final cleanup or app lifecycle handlers:

```ts
// ═══════════════════════════════════════════════════════════
// GAP 4: Previously dead IPC handlers (preload bridges existed
// but no main-process handlers). Prompt templates get real
// implementations; others get proper stubs.
// ═══════════════════════════════════════════════════════════

// ─── Prompt Templates (real implementation) ────────────────
// Stores templates in userPreferences JSON, keyed per-project or global.

electron_1.ipcMain.handle('get-prompt-templates', async (_event, projectId?: string) => {
    try {
        const key = projectId ? `prompt-templates-${projectId}` : 'prompt-templates-global';
        const templates = userPreferences[key] || [];
        return { success: true, data: templates };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to get prompt templates' };
    }
});

electron_1.ipcMain.handle('save-prompt-template', async (
    _event,
    data: { id?: string; projectId?: string; name: string; content: string; category?: string; isFormattingTemplate?: boolean }
) => {
    try {
        const key = data.projectId ? `prompt-templates-${data.projectId}` : 'prompt-templates-global';
        const templates: any[] = userPreferences[key] || [];

        const id = data.id || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        const existingIdx = templates.findIndex((t: any) => t.id === id);

        if (existingIdx >= 0) {
            // Update existing
            templates[existingIdx] = {
                ...templates[existingIdx],
                name: data.name,
                content: data.content,
                category: data.category || templates[existingIdx].category,
                isFormattingTemplate: data.isFormattingTemplate ?? templates[existingIdx].isFormattingTemplate,
                updatedAt: now,
            };
        } else {
            // Create new
            templates.push({
                id,
                name: data.name,
                content: data.content,
                category: data.category || 'general',
                isFormattingTemplate: data.isFormattingTemplate || false,
                projectId: data.projectId || null,
                createdAt: now,
                updatedAt: now,
            });
        }

        userPreferences[key] = templates;
        savePreferences();

        return { success: true, data: templates.find((t: any) => t.id === id) };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to save prompt template' };
    }
});

electron_1.ipcMain.handle('delete-prompt-template', async (_event, templateId: string) => {
    try {
        let deleted = false;

        // Search all template keys (project-scoped + global)
        for (const key of Object.keys(userPreferences)) {
            if (!key.startsWith('prompt-templates')) continue;
            const templates: any[] = userPreferences[key] || [];
            const idx = templates.findIndex((t: any) => t.id === templateId);
            if (idx >= 0) {
                templates.splice(idx, 1);
                userPreferences[key] = templates;
                deleted = true;
            }
        }

        if (deleted) savePreferences();

        return { success: true, data: deleted };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to delete prompt template' };
    }
});

// ─── Activity Chart Preference (real implementation) ───────

electron_1.ipcMain.handle('update-activity-chart-preference', async (
    _event, activityId: string, chartType: string
) => {
    try {
        userPreferences[`chart-type-${activityId}`] = chartType;
        savePreferences();
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to update chart preference' };
    }
});

// ─── Stub Handlers (planned features, not yet built) ──────
// These prevent unhandled promise rejections if called from
// the renderer. They return clear error messages so any
// future UI component knows the feature isn't available yet.

electron_1.ipcMain.handle('add-external-time', async (_event, _args: { activityId: string; durationMinutes: number }) => {
    console.warn('[IPC] add-external-time called — not yet implemented');
    return {
        success: false,
        error: 'Not implemented: add-external-time. This feature is planned for a future release.'
    };
});

electron_1.ipcMain.handle('get-hour-detail', async (_event, _date: string, _hour: number) => {
    console.warn('[IPC] get-hour-detail called — not yet implemented');
    return {
        success: false,
        error: 'Not implemented: get-hour-detail. This feature is planned for a future release.',
        data: []
    };
});

electron_1.ipcMain.handle('get-workspace-todos', async (_event, _projectId?: string) => {
    console.warn('[IPC] get-workspace-todos called — not yet implemented');
    return {
        success: false,
        error: 'Not implemented: get-workspace-todos. Workspace todos are planned for a future release.',
        data: []
    };
});

electron_1.ipcMain.handle('add-workspace-todo', async (_event, _data: { projectId?: string; text: string; priority?: string }) => {
    console.warn('[IPC] add-workspace-todo called — not yet implemented');
    return {
        success: false,
        error: 'Not implemented: add-workspace-todo. Workspace todos are planned for a future release.'
    };
});

electron_1.ipcMain.handle('toggle-workspace-todo', async (_event, _todoId: string) => {
    console.warn('[IPC] toggle-workspace-todo called — not yet implemented');
    return {
        success: false,
        error: 'Not implemented: toggle-workspace-todo. Workspace todos are planned for a future release.'
    };
});

electron_1.ipcMain.handle('delete-workspace-todo', async (_event, _todoId: string) => {
    console.warn('[IPC] delete-workspace-todo called — not yet implemented');
    return {
        success: false,
        error: 'Not implemented: delete-workspace-todo. Workspace todos are planned for a future release.'
    };
});
```

### What this does

| Channel | Status | Implementation |
|---------|--------|---------------|
| `get-prompt-templates` | **Real** | Stores in `userPreferences` JSON, keyed by project |
| `save-prompt-template` | **Real** | Creates/updates with auto-generated ID, timestamps |
| `delete-prompt-template` | **Real** | Searches all keys, removes by ID |
| `update-activity-chart-preference` | **Real** | Saves chart type per activity ID to preferences |
| `add-external-time` | **Stub** | Returns clear "not implemented" error |
| `get-hour-detail` | **Stub** | Returns empty data + error message |
| `get-workspace-todos` | **Stub** | Returns empty array + error message |
| `add-workspace-todo` | **Stub** | Returns error message |
| `toggle-workspace-todo` | **Stub** | Returns error message |
| `delete-workspace-todo` | **Stub** | Returns error message |

**Why stubs instead of removing from preload:** Removing preload methods would break the TypeScript interface and require frontend changes. Stubs are safer — they prevent unhandled promise rejections, document the planned API, and can be replaced with real implementations later without any frontend changes.

---

## Summary of All Changes

| Gap | File | What Changed |
|-----|------|-------------|
| **1: DORA** | `src/main.ts` (lines ~7459-7463) | Replaced `= 0` with real CFR (deployment commits → error sessions within 24h) and MTTR (error → next success session) calculations |
| **2: LLM** | `src/main.ts` (new handler) | Added `summarize-with-llm` IPC handler that calls OpenRouter API |
| **2: LLM** | `src/preload.ts` | Added `summarizeWithLLM` bridge |
| **2: LLM** | `src/services/CompactionService.ts` (lines ~471-512) | Replaced `DefaultLLMProvider` with IPC caller + extractive fallback |
| **3: RAG** | `src/services/RAGService.ts` (lines ~339-399) | Replaced broken SQL similarity with proper JS cosine similarity + `cosineSimilarity` and `computeVectorNorm` helper methods |
| **4: Stubs** | `src/main.ts` (new handlers) | Added 10 IPC handlers: 4 real (prompt templates + chart pref), 6 stubs (todos + external time + hour detail) |

### Data Flow After Changes

```
DORA Metrics
  getDORAMetrics() → IPC → main.ts handler
    → commits table: find deployment messages
    → terminal_sessions: find error statuses after deployments
    → CFR = failed_deployments / total_deployments
    → MTTR = avg(error_time → next_success_time)

LLM Summarization
  CompactionService.summarizeMessages()
    → DefaultLLMProvider.summarize()
      → Try: window.deskflowAPI.summarizeWithLLM()
        → IPC → main.ts → OpenRouter API → real summary
      → Fallback: extractiveFallback()
        → Parse conversation text → structured markdown

RAG Semantic Search
  RAGService.semanticSearch(queryEmbedding)
    → Fetch all messages with embedding BLOBs
    → Deserialize to Float32Array
    → cosineSimilarity(query, stored) for each
    → Filter by minScore, sort, return top K

Prompt Templates
  getPromptTemplates() → IPC → userPreferences JSON
  savePromptTemplate() → IPC → userPreferences JSON → savePreferences()
  deletePromptTemplate() → IPC → userPreferences JSON → savePreferences()
```
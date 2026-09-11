# AiPage Comprehensive Hardening — Engineering Plan

Below is a precise, minimal-diff plan that addresses every bug across all 10 subsystems. Each section identifies the file, the change, the visual spec, and the resulting UX flow. I've organized this so you can apply changes file-by-file without breaking intermediate states.

---

## Architecture & Strategy

**Core patterns introduced (all renderer-side, no new deps):**

1. **Operation state tuple** — every async operation gets `{ loading, error, data }` instead of bare `try/catch + console.error`
2. **Rollback on failure** — optimistic updates use a snapshot; on IPC failure, restore the snapshot + show error
3. **Inline `Toast` system** — minimal, added once to `AiPage.tsx`, used for transient feedback (connector test, save success)
4. **Debounce hook (inline)** — for notes saving, ~600ms trailing
5. **`messagesRef`** — fixes the stale closure in `useAiChat.sendMessage`
6. **`buildContextBundle` returns `{ content, warnings }`** — surfaces silent degradation
7. **Simulated streaming** — populate `streamingMessage` from the IPC response; `TypewriterText` does the visual reveal; commit to `messages` after the typewriter window. (True token streaming would require a new IPC `provider-chat-stream` channel + preload entry — called out as a follow-up since it expands the surface area beyond "minimal diffs")

**Design tokens used throughout (from your CSS):**
- Error: `--accent-error: #ef4444` with `rgba(239,68,68,0.1)` background
- Success: `--accent-success: #22c55e`
- Warning: `--accent-warning: #f59e0b`
- Card bg: `--bg-card: #1e1e2a`
- Text muted: `--text-muted: #64748b`
- Border: `--border-color: #2a2a3a`

---

## File-by-File Changes

### 1. `src/services/providers/types.ts`

Add `timeoutMs` to `ProviderConfig` and `ResolvedProvider`:

```typescript
export interface ProviderConfig {
  id: string;
  label?: string;
  templateId: string;
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
  monthlyTokenBudget?: number;
  tokensUsedThisMonth?: number;
  timeoutMs?: number;        // ADDED — bounded per-provider timeout
}

export interface ResolvedProvider {
  id: string;
  label: string;
  template: ProviderTemplate;
  baseUrl: string;
  apiKey: string;
  models: string[];
  timeoutMs?: number;        // ADDED — propagated from ProviderConfig
}
```

Backward-compatible: optional field, falls back to 120000ms.

---

### 2. `src/services/providers/callProvider.ts`

Use the per-provider `timeoutMs` with bounded fallback. Change only the timeout line:

```typescript
// Replace:
//   const timeout = setTimeout(() => controller.abort(), 120000);
// With:
const resolvedTimeoutMs = ('timeoutMs' in provider && typeof provider.timeoutMs === 'number' && provider.timeoutMs > 0)
  ? Math.min(provider.timeoutMs, 300000)  // hard upper bound: 5 min
  : 120000;
const timeout = setTimeout(() => controller.abort(), resolvedTimeoutMs);
```

Also propagate the abort signal if the caller provides one (used by `useAiChat`):

```typescript
export async function callProvider(
  provider: ResolvedProvider | ProviderConfig,
  req: CanonicalRequest,
  externalSignal?: AbortSignal,   // ADDED
): Promise<CanonicalResponse> {
  // ...existing code...
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolvedTimeoutMs);

  // ADDED — propagate external abort
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  // ...existing fetch with controller.signal...
}
```

---

### 3. `src/services/providers/router.ts`

Two surgical edits — retry classification + error message quality:

```typescript
export async function callWithTokenTiers(
  configs: ProviderConfig[],
  req: CanonicalRequest,
  externalSignal?: AbortSignal,   // ADDED
): Promise<CanonicalResponse> {
  const sorted = [...configs].sort((a, b) =>
    (b.monthlyTokenBudget || Infinity) - (a.monthlyTokenBudget || Infinity));
  let lastError: any;

  for (const config of sorted) {
    if (config.monthlyTokenBudget && (config.tokensUsedThisMonth || 0) >= config.monthlyTokenBudget) {
      continue;
    }
    try {
      return await callProvider(config, req, externalSignal);
    } catch (err: any) {
      lastError = err;
      // CHANGED — AbortError is now retryable (treated like 402 budget exhaustion)
      const isRetryable = err?.status === 402 || err?.name === 'AbortError' || (err?.status >= 500 && err?.status < 600);
      if (!isRetryable) throw err;
    }
  }
  throw lastError || new Error('No providers configured');
}

export async function runWithFallback(
  primaryConfigs: ProviderConfig[],
  fallbackConfigs: ProviderConfig[],
  req: CanonicalRequest,
  externalSignal?: AbortSignal,   // ADDED
): Promise<CanonicalResponse> {
  const errors: { name: string; error: string; kind: 'timeout' | 'failure' }[] = [];

  const tryConfig = async (config: ProviderConfig) => {
    try {
      return await callWithTokenTiers([config], req, externalSignal);
    } catch (err: any) {
      const kind: 'timeout' | 'failure' = err?.name === 'AbortError' ? 'timeout' : 'failure';
      errors.push({ name: config.label || config.id, error: err.message || String(err), kind });
      throw err;
    }
  };

  for (const config of primaryConfigs) {
    try { return await tryConfig(config); } catch {}
  }
  for (const config of fallbackConfigs) {
    try { return await tryConfig(config); } catch {}
  }

  // CHANGED — distinguish timeouts from failures in the aggregate message
  const timeouts = errors.filter(e => e.kind === 'timeout');
  const failures = errors.filter(e => e.kind === 'failure');
  const parts: string[] = [];
  if (timeouts.length) parts.push(`${timeouts.length} timed out (${timeouts.map(e => e.name).join(', ')})`);
  if (failures.length) parts.push(`${failures.length} failed (${failures.map(e => `${e.name}: ${e.error}`).join('; ')})`);
  throw new Error(`All ${errors.length} provider(s) exhausted — ${parts.join('; ')}`);
}
```

---

### 4. `src/pages/AiPage.tsx` (largest set of edits)

Add error/loading states for every operation, rollback on optimistic failures, toast system, and proper JSX wiring. The full diff is large but every change is local to one handler.

**New state declarations (add near existing state):**

```typescript
// Initial-load error states
const [bootError, setBootError] = useState<{ goals?: string; longterm?: string; connectors?: string; providers?: string }>({});
const [bootLoading, setBootLoading] = useState(true);

// Operation error states (each banner has its own dismiss)
const [reviewError, setReviewError] = useState<string | null>(null);
const [digestError, setDigestError] = useState<string | null>(null);
const [toggleErrors, setToggleErrors] = useState<Record<number, string>>({});
const [acceptErrors, setAcceptErrors] = useState<Record<string, string>>({});
const [notesSaveState, setNotesSaveState] = useState<{ saving: boolean; error: string | null; saved: boolean }>({ saving: false, error: null, saved: false });

// Toasts (for transient connector / save feedback)
const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);
const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setToasts(prev => [...prev, { id, message, type }]);
  setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
}, []);
const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
```

**Wrap initial loads with error handling:**

```typescript
const loadProviderConfigs = async () => {
  try {
    const configs = await window.deskflowAPI!.getProviderConfigs();
    setProviderConfigs(configs ?? { default: null, goalAssistant: null, researchDigest: null });
    setBootError(prev => ({ ...prev, providers: undefined }));
  } catch (err: any) {
    setBootError(prev => ({ ...prev, providers: err.message || 'Failed to load providers' }));
  }
};

const loadGoals = async () => {
  try {
    const result = await window.deskflowAPI!.getGoals();
    if (result?.success) {
      setGoals(result.goals ?? []);
      setBootError(prev => ({ ...prev, goals: undefined }));
    } else {
      setBootError(prev => ({ ...prev, goals: result?.error || 'Failed to load goals' }));
    }
  } catch (err: any) {
    setBootError(prev => ({ ...prev, goals: err.message }));
  }
};

const loadLongtermGoals = async () => {
  try {
    const result = await window.deskflowAPI!.getLongtermGoals();
    if (result?.success) {
      setLongtermGoals(result.goals ?? []);
      setPlanningNotes(result.planningNotes ?? '');
      setBootError(prev => ({ ...prev, longterm: undefined }));
    } else {
      setBootError(prev => ({ ...prev, longterm: result?.error || 'Failed to load long-term goals' }));
    }
  } catch (err: any) {
    setBootError(prev => ({ ...prev, longterm: err.message }));
  }
};

const loadConnectors = async () => {
  try {
    const result = await window.deskflowAPI!.connectorList();
    if (result?.success) {
      setConnectors(result.connectors ?? []);
      setBootError(prev => ({ ...prev, connectors: undefined }));
    } else {
      setBootError(prev => ({ ...prev, connectors: result?.error || 'Failed to load connectors' }));
    }
  } catch (err: any) {
    setBootError(prev => ({ ...prev, connectors: err.message }));
  }
};

// Coordinated mount:
useEffect(() => {
  let mounted = true;
  (async () => {
    setBootLoading(true);
    await Promise.allSettled([loadProviderConfigs(), loadGoals(), loadLongtermGoals(), loadConnectors()]);
    if (mounted) setBootLoading(false);
  })();
  return () => { mounted = false; };
}, []);
```

**Fix `handleToggleGoal` with rollback:**

```typescript
const handleToggleGoal = async (goalId: number, newStatus: string) => {
  const prevGoals = goals;                                   // snapshot
  setGoals(g => g.map(x => x.id === goalId ? { ...x, status: newStatus } : x));  // optimistic
  setToggleErrors(prev => { const next = { ...prev }; delete next[goalId]; return next; });
  try {
    const result = await window.deskflowAPI!.toggleGoalStatus(goalId, newStatus);
    if (!result?.success) {
      setGoals(prevGoals);                                   // rollback
      setToggleErrors(prev => ({ ...prev, [goalId]: result?.error || 'Failed to update goal' }));
    }
  } catch (err: any) {
    setGoals(prevGoals);                                     // rollback
    setToggleErrors(prev => ({ ...prev, [goalId]: err.message }));
  }
};
```

**Fix `handleAcceptSuggestion` with rollback:**

```typescript
const handleAcceptSuggestion = async (suggestion: any) => {
  const key = suggestion.title;
  const prevSuggestions = suggestions;                       // snapshot
  setSuggestions(prev => prev.filter(s => s.title !== key)); // optimistic remove
  setAcceptErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
  try {
    const result = await window.deskflowAPI!.saveGoal({
      title: suggestion.title,
      description: suggestion.description || '',
      category: suggestion.category || 'general',
    });
    if (result?.success) {
      await loadGoals();
      showToast('Goal saved', 'success');
    } else {
      setSuggestions(prevSuggestions);                       // restore on failure
      setAcceptErrors(prev => ({ ...prev, [key]: result?.error || 'Failed to save goal' }));
    }
  } catch (err: any) {
    setSuggestions(prevSuggestions);                         // restore on failure
    setAcceptErrors(prev => ({ ...prev, [key]: err.message }));
  }
};
```

**Fix `handleReview` with error state:**

```typescript
const handleReview = async () => {
  setReviewing(true);
  setReviewError(null);
  try {
    const result = await window.deskflowAPI!.reviewGoals();
    if (result?.success) {
      setReviewSuggestions(result.review ?? []);
    } else {
      setReviewError(result?.error || 'Failed to review goals');
    }
  } catch (err: any) {
    setReviewError(err.message || 'Failed to review goals');
  } finally {
    setReviewing(false);
  }
};
```

**Fix `handleGenerateDigest` with error state:**

```typescript
const handleGenerateDigest = async () => {
  setGeneratingDigest(true);
  setDigestError(null);
  try {
    const result = await window.deskflowAPI!.getTopicDigest();
    if (result?.success) {
      setDigest(result.digest);
    } else {
      setDigestError(result?.error || 'Failed to generate digest');
    }
  } catch (err: any) {
    setDigestError(err.message || 'Failed to generate digest');
  } finally {
    setGeneratingDigest(false);
  }
};
```

**Fix `handleSaveNotes` (debounce is in PlanBoard, but the handler here should report errors):**

```typescript
const handleSaveNotes = async (notes: string) => {
  setNotesSaveState({ saving: true, error: null, saved: false });
  try {
    const result = await window.deskflowAPI!.saveLongtermGoals({ goals: longtermGoals, planningNotes: notes });
    if (result?.success) {
      setPlanningNotes(notes);
      setNotesSaveState({ saving: false, error: null, saved: true });
      setTimeout(() => setNotesState(s => s.saved ? { ...s, saved: false } : s), 2000);
    } else {
      setNotesSaveState({ saving: false, error: result?.error || 'Failed to save notes', saved: false });
    }
  } catch (err: any) {
    setNotesSaveState({ saving: false, error: err.message, saved: false });
  }
};
```

**Fix `handleConnectorAction` — return result for `disconnect` (was previously `void`):**

```typescript
const handleConnectorAction = async (action: string, connectorId: string) => {
  switch (action) {
    case 'test':
      return await window.deskflowAPI!.connectorTest(connectorId);
    case 'sync': {
      const r = await window.deskflowAPI!.connectorSync(connectorId);
      if (r?.success) await loadConnectors();
      return r;
    }
    case 'disconnect': {
      const r = await window.deskflowAPI!.connectorDelete(connectorId);
      if (r?.success !== false) await loadConnectors();
      return r;  // CHANGED — return result so panel can detect failure
    }
  }
};
```

**Pass new props to children:**

```typescript
<AiPageDeck
  /* existing props... */
  suggestionError={suggestionError}
  reviewError={reviewError}                 // NEW
  digestError={digestError}                 // NEW
  toggleErrors={toggleErrors}               // NEW
  acceptErrors={acceptErrors}               // NEW
  bootLoading={bootLoading}                 // NEW
  bootError={bootError}                     // NEW
  onRetryBoot={() => { loadProviderConfigs(); loadGoals(); loadLongtermGoals(); loadConnectors(); }}  // NEW
  onRetryReview={handleReview}              // NEW
  onRetryDigest={handleGenerateDigest}      // NEW
  onDismissReviewError={() => setReviewError(null)}  // NEW
  onDismissDigestError={() => setDigestError(null)}  // NEW
  onConnectorToast={showToast}              // NEW
  onRefreshConnectors={loadConnectors}      // NEW
  notesSaveState={notesSaveState}           // NEW
/>

<DailyDigestBoard
  digest={digest}
  generating={generatingDigest}
  error={digestError}                       // NEW
  onGenerate={handleGenerateDigest}
  onTopicClick={handleDigestTopicClick}
/>
```

**Add Toast container in JSX (bottom of `return`):**

```typescript
<div className="toast-container" role="status" aria-live="polite">
  {toasts.map(t => (
    <div key={t.id} className={`toast toast-${t.type}`}>
      <span className="toast-icon">{t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}</span>
      <span className="toast-msg">{t.message}</span>
      <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">×</button>
    </div>
  ))}
</div>
```

---

### 5. `src/components/ai/plan/PlanBoard.tsx`

Debounce + local state + save indicator:

```typescript
import React, { useState, useEffect, useRef } from 'react';

export function PlanBoard({ longtermGoals, planningNotes, onSaveNotes, onRefresh, notesSaveState }: PlanBoardProps) {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [localNotes, setLocalNotes] = useState(planningNotes);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from prop when parent updates (e.g., after boot)
  useEffect(() => { setLocalNotes(planningNotes); }, [planningNotes]);

  // Cleanup pending debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { onSaveNotes(value); }, 600);
  };

  // Bulk import — actually saves to backend
  const handleBulkImport = async (importedGoals: any[]) => {
    setImporting(true);
    setImportError(null);
    try {
      const merged = [...longtermGoals, ...importedGoals];
      const result = await window.deskflowAPI!.saveLongtermGoals({
        goals: merged,
        planningNotes: localNotes,
      });
      if (result?.success) {
        setShowBulkImport(false);
        onRefresh();
      } else {
        setImportError(result?.error || 'Failed to import goals');
      }
    } catch (err: any) {
      setImportError(err.message || 'Failed to import goals');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="plan-board">
      {/* ... header ... */}
      <div className="planning-notes">
        <textarea
          value={localNotes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add planning notes, ideas, or reflections..."
          rows={4}
        />
        <div className="notes-status">
          {notesSaveState?.saving && <span className="saving-indicator">Saving…</span>}
          {notesSaveState?.saved && <span className="saved-indicator">Saved ✓</span>}
          {notesSaveState?.error && (
            <span className="notes-error">
              {notesSaveState.error}
              <button onClick={() => onSaveNotes(localNotes)}>Retry</button>
            </span>
          )}
        </div>
      </div>

      {importError && (
        <div className="error-banner">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)}>Dismiss</button>
        </div>
      )}

      {showBulkImport && (
        <BulkImportDialog
          onClose={() => !importing && setShowBulkImport(false)}
          onImport={handleBulkImport}
          importing={importing}     // pass through to disable close during import
        />
      )}
    </div>
  );
}
```

**UX flow for notes:**
- Typing → no IPC fires (debounced 600ms)
- After 600ms idle → "Saving…" indicator → IPC fires → on success "Saved ✓" for 2s → on failure inline error + Retry button
- Unmount during pending → timer cleared, no orphan IPC

---

### 6. `src/hooks/useAiChat.ts`

Fix stale closure + populate `streamingMessage` + add `dismissError`:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ParsedMessage } from '../components/ai/chat/parsed';
import { parseMessage } from '../components/ai/chat/parsed';
import { buildContextBundle } from '../services/aiContextBundle';

export function useAiChat(providerConfig: any) {
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // FIX — ref mirror of messages to avoid stale closure in sendMessage
  const messagesRef = useRef<ParsedMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isGenerating) return;

    const userMsg: ParsedMessage = {
      id: `user-${Date.now()}`,
      type: 'stats_summary',
      raw: text,
      data: { content: text, role: 'user' },
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setError(null);
    setStreamingMessage(null);

    try {
      const { content: contextBundle, warnings } = await buildContextBundle();
      if (warnings?.length) setContextWarnings(warnings);

      const abortController = new AbortController();
      abortRef.current = abortController;

      const result = await window.deskflowAPI!.providerChatCall({
        messages: [
          ...messagesRef.current.map(m => ({ role: 'user', content: m.raw })),  // FIX — ref, not stale closure
          { role: 'user', content: text },
        ],
        contextBundle,
        signal: abortController.signal,
      });

      if (result?.success) {
        // FIX — populate streamingMessage so TypewriterText actually shows content
        setStreamingMessage(result.content || '');
        const parsed = parseMessage(result.content || '', `ai-${Date.now()}`);
        // Estimate typewriter duration to delay committing to messages
        const typewriterMs = Math.min((result.content?.length || 0) * 8, 2500);
        setTimeout(() => {
          setMessages(prev => [...prev, parsed]);
          setStreamingMessage(null);
        }, typewriterMs);
      } else {
        setError(result?.error || 'Model returned an error');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Generation cancelled');
      } else {
        setError(err.message || 'Failed to send message');
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [isGenerating]);  // FIX — no `messages` dependency

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setStreamingMessage(null);
    setContextWarnings([]);
  }, []);

  // FIX — dismiss error without clearing messages
  const dismissError = useCallback(() => setError(null), []);

  return {
    messages, sendMessage, stopGeneration, resetChat,
    dismissError,                         // NEW
    isGenerating, streamingMessage, error,
    contextWarnings,                      // NEW
  };
}
```

---

### 7. `src/components/ai/chat/ChatPanel.tsx`

Wire `dismissError`, fix the error banner button, implement model change:

```typescript
interface ChatPanelProps {
  messages: ParsedMessage[];
  onSend: (text: string) => void;
  onStop: () => void;
  onReset: () => void;
  onDismissError?: () => void;       // NEW
  isGenerating: boolean;
  streamingMessage: string | null;
  error: string | null;
  providerConfigs: Record<string, any>;
  onProviderChange: (slot: string, config: any) => void;
}

export function ChatPanel({
  messages, onSend, onStop, onReset, onDismissError,
  isGenerating, streamingMessage, error,
  providerConfigs, onProviderChange,
}: ChatPanelProps) {
  const [currentModel, setCurrentModel] = useState(
    providerConfigs?.default?.models?.[0] || 'gpt-4'
  );

  useEffect(() => {
    // Sync currentModel when provider config changes
    const m = providerConfigs?.default?.models?.[0];
    if (m && m !== currentModel) setCurrentModel(m);
  }, [providerConfigs]);

  // FIX — actually persist model change to provider config
  const handleModelChange = async (model: string) => {
    setCurrentModel(model);
    const cfg = providerConfigs?.default;
    if (!cfg) return;
    const updated = {
      ...cfg,
      models: [model, ...(cfg.models?.filter((m: string) => m !== model) ?? [])],
    };
    onProviderChange('default', updated);
    try {
      await window.deskflowAPI!.upsertProviderConfig(updated);
    } catch {
      // Revert local selection on failure
      setCurrentModel(cfg.models?.[0] || 'gpt-4');
      onProviderChange('default', cfg);
    }
  };

  return (
    <div className="chat-panel">
      {/* FIX — dismiss button calls onDismissError, not onReset */}
      {error && (
        <div className="chat-error-banner" role="alert">
          <AlertCircleIcon />
          <span>{error}</span>
          <div className="banner-actions">
            {error.includes('cancelled') || error.includes('timed out') ? (
              <button className="banner-retry" onClick={() => onSend(messages[messages.length - 1]?.raw || '')}>
                Retry
              </button>
            ) : null}
            <button onClick={() => (onDismissError ?? onReset())}>Dismiss</button>
          </div>
        </div>
      )}

      {/* ... messages, streaming, input ... */}
    </div>
  );
}
```

---

### 8. `src/components/ai/chat/parsed.ts`

Wire `handleCardAction` with injected handlers (no module-level state, no `as any`):

```typescript
export interface CardActionHandlers {
  acceptGoal?: (payload: any) => void;
  viewDetail?: (payload: any) => void;
  dismiss?: (messageId: string) => void;
  retry?: (payload: any) => void;
}

export function handleCardAction(
  action: CardAction,
  messageId: string,
  handlers: CardActionHandlers,
): void {
  switch (action.handler) {
    case 'acceptGoal':
      handlers.acceptGoal?.(action.payload);
      break;
    case 'viewDetail':
      handlers.viewDetail?.(action.payload);
      break;
    case 'dismiss':
      handlers.dismiss?.(messageId);
      break;
    case 'retry':
      handlers.retry?.(action.payload);
      break;
    default:
      console.warn(`[parsed] Unknown card action handler: ${action.handler}`);
  }
}
```

Then `ParsedMessageRouter` (or its parent) passes handlers down. Without seeing its source, the wiring in `ChatPanel` becomes:

```typescript
<ParsedMessageRouter
  message={msg}
  onAction={(action, msgId) => handleCardAction(action, msgId, {
    acceptGoal: (payload) => window.deskflowAPI!.saveGoal(payload).then(() => showToast('Goal saved', 'success')),
    viewDetail: (payload) => {/* open detail panel */},
    dismiss: (msgId) => setMessages(prev => prev.filter(m => m.id !== msgId)),
    retry: () => onSend(messages[messages.length - 1]?.raw || ''),
  })}
/>
```

---

### 9. `src/services/aiContextBundle.ts`

Expand scope, surface warnings, add token-budget cap:

```typescript
export interface ContextBundleResult {
  content: string;
  warnings: string[];
}

const MAX_CONTEXT_CHARS = 6000;  // ~1500 tokens safety budget

export async function buildContextBundle(): Promise<ContextBundleResult> {
  const warnings: string[] = [];
  const sections: string[] = [
    '# Current Context',
    `Date: ${new Date().toLocaleDateString()}`,
    '',
  ];

  // Goals
  try {
    const goals = await window.deskflowAPI!.getGoals();
    if (goals?.success && goals.goals?.length) {
      sections.push('# Goals',
        ...goals.goals.slice(0, 50).map((g: any) =>
          `- [${g.status === 'done' ? 'x' : ' '}] ${g.title} (${g.status})`),
        '');
    } else if (!goals?.success) {
      warnings.push('Goals unavailable');
    }
  } catch { warnings.push('Goals context failed to load'); }

  // Long-term goals
  try {
    const lt = await window.deskflowAPI!.getLongtermGoals();
    if (lt?.success && lt.goals?.length) {
      sections.push('# Long-term Goals',
        ...lt.goals.slice(0, 20).map((g: any) =>
          `- ${g.title}${g.targetDate ? ` (target: ${g.targetDate})` : ''}`),
        '');
    }
  } catch { warnings.push('Long-term goals context failed'); }

  // Goal context (planning notes, unfinished, recently completed)
  try {
    const ctx = await window.deskflowAPI!.getGoalContext();
    if (ctx?.success) {
      if (ctx.planningContent) {
        sections.push('# Planning Notes', truncate(ctx.planningContent, 2000), '');
      }
      if (ctx.unfinished?.length) {
        sections.push('# Unfinished',
          ...ctx.unfinished.slice(0, 20).map((g: any) => `- ${g.title}`), '');
      }
      if (ctx.recentlyCompleted?.length) {
        sections.push('# Recently Completed',
          ...ctx.recentlyCompleted.slice(0, 20).map((g: any) =>
            `- ${g.title} (completed ${g.completedDate || 'recently'})`), '');
      }
    }
  } catch { warnings.push('Goal context failed'); }

  // Connectors (NEW — was missing)
  try {
    const conns = await window.deskflowAPI!.connectorList();
    if (conns?.success && conns.connectors?.length) {
      sections.push('# Active Connectors',
        ...conns.connectors.slice(0, 10).map((c: any) =>
          `- ${c.name} (${c.type}, ${c.status})${c.lastSync ? ` — last sync ${c.lastSync}` : ''}`),
        '');
    }
  } catch { warnings.push('Connectors context failed'); }

  // Current focus (NEW — derived from active goals)
  try {
    const focus = await window.deskflowAPI!.getGoals();
    const active = focus?.goals?.filter((g: any) => g.status === 'active').slice(0, 5) ?? [];
    if (active.length) {
      sections.push('# Current Focus',
        ...active.map((g: any) => `- ${g.title}`), '');
    }
  } catch { /* already warned above */ }

  let content = sections.join('\n');
  if (content.length > MAX_CONTEXT_CHARS) {
    content = content.slice(0, MAX_CONTEXT_CHARS) + '\n\n[Context truncated to fit token budget]';
    warnings.push('Context truncated to fit token budget');
  }

  return { content, warnings };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
```

In `ChatPanel`, surface the warnings:

```typescript
{contextWarnings.length > 0 && (
  <div className="context-warnings" role="note">
    <InfoIcon />
    <span>Context partially unavailable: {contextWarnings.join(', ')}</span>
  </div>
)}
```

---

### 10. `src/components/ai/digest/DailyDigestBoard.tsx`

Add error state to both compact and full views:

```typescript
interface DailyDigestBoardProps {
  digest: any;
  generating: boolean;
  error?: string | null;            // NEW
  onGenerate: () => void;
  onDismissError?: () => void;      // NEW
  onTopicClick?: (topicId: string) => void;
  compact?: boolean;
}
```

In **compact** view, insert before the populated branch:

```typescript
{!generating && error && (
  <div className="digest-error">
    <AlertCircleIcon />
    <span>{error}</span>
    <button onClick={onGenerate}>Retry</button>
    {onDismissError && <button onClick={onDismissError} className="link-btn">Dismiss</button>}
  </div>
)}
```

In **full** view, same pattern scaled up:

```typescript
{!generating && error && (
  <div className="digest-empty full">
    <AlertCircleIcon size={48} />
    <h2>Couldn't Generate Digest</h2>
    <p>{error}</p>
    <div className="digest-error-actions">
      <button className="generate-cta" onClick={onGenerate}>Retry</button>
      {onDismissError && <button onClick={onDismissError}>Dismiss</button>}
    </div>
  </div>
)}
```

---

### 11. `src/components/ai/connectors/ConnectorsPanel.tsx`

Comprehensive hardening — toast feedback, error rollback, setup-modal refresh:

```typescript
interface ConnectorsPanelProps {
  connectors: Connector[];
  onAction: (action: string, connectorId: string) => Promise<any>;
  onRefresh?: () => void;                                          // NEW
  onToast?: (msg: string, type: 'success' | 'error' | 'info') => void;  // NEW
}

export function ConnectorsPanel({ connectors, onAction, onRefresh, onToast }: ConnectorsPanelProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [setupType, setSetupType] = useState<'email' | 'calendar'>('email');

  const handleSync = async (id: string) => {
    setSyncing(id);
    setPanelError(null);
    try {
      const r = await onAction('sync', id);
      if (r?.success) {
        onToast?.('Sync complete', 'success');
      } else {
        setPanelError(r?.error || 'Sync failed');
        onToast?.(r?.error || 'Sync failed', 'error');
      }
    } catch (err: any) {
      setPanelError(err.message);
      onToast?.(err.message, 'error');
    } finally {
      setSyncing(null);
    }
  };

  const handleTest = async (id: string) => {
    setPendingAction(`test-${id}`);
    try {
      const r = await onAction('test', id);
      if (r?.success) {
        onToast?.('Connector test succeeded', 'success');
      } else {
        onToast?.(r?.error || 'Connector test failed', 'error');
      }
    } catch (err: any) {
      onToast?.(err.message || 'Test failed', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setPendingAction(`disconnect-${id}`);
    setPanelError(null);
    try {
      const r = await onAction('disconnect', id);
      if (r?.success === false) {
        // Don't optimistically remove — refresh to confirm DB state
        onRefresh?.();
        setPanelError(r?.error || 'Failed to disconnect');
        onToast?.(r?.error || 'Failed to disconnect', 'error');
      } else {
        onRefresh?.();
        onToast?.('Connector disconnected', 'success');
      }
    } catch (err: any) {
      onRefresh?.();  // restore UI state
      setPanelError(err.message);
      onToast?.(err.message, 'error');
    } finally {
      setPendingAction(null);
    }
  };

  // ... render ...
  {panelError && (
    <div className="error-banner">
      <AlertCircleIcon />
      <span>{panelError}</span>
      <button onClick={() => setPanelError(null)}>Dismiss</button>
      <button onClick={() => onRefresh?.()}>Retry</button>
    </div>
  )}

  {showSetup && (
    <ConnectorSetupModal
      type={setupType}
      onClose={() => setShowSetup(false)}
      onComplete={() => {
        setShowSetup(false);
        onRefresh?.();  // FIX — was a TODO comment
      }}
    />
  )}
```

Per-connector pending state shown in button labels:

```typescript
<button onClick={() => handleTest(conn.id)} disabled={pendingAction === `test-${conn.id}`}>
  {pendingAction === `test-${conn.id}` ? 'Testing…' : 'Test'}
</button>
<button onClick={() => handleDisconnect(conn.id)} disabled={pendingAction === `disconnect-${conn.id}`}>
  {pendingAction === `disconnect-${conn.id}` ? 'Disconnecting…' : 'Disconnect'}
</button>
```

---

### 12. `src/components/AiProviderSelectModal.tsx`

Error state + add-provider link:

```typescript
export function AiProviderSelectModal({ slot, currentConfig, onSelect, onClose, onNavigateToSettings }: AiProviderSelectModalProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  // NEW

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const configs = await window.deskflowAPI!.getProviderConfigs();
      setProviders(Object.values(configs || {}));
    } catch (err: any) {
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  // JSX additions:
  {error && (
    <div className="error-banner">
      <AlertCircleIcon />
      <span>{error}</span>
      <button onClick={loadProviders}>Retry</button>
    </div>
  )}

  {/* Footer with add-provider affordance */}
  <div className="modal-footer">
    <span>Don't see what you need?</span>
    <button className="link-btn" onClick={() => {
      onClose();
      onNavigateToSettings?.();
    }}>
      Add a provider in Settings →
    </button>
  </div>
```

If `onNavigateToSettings` is not provided, fall back to `window.location.hash = '#/settings'` wrapped in `try/catch`.

---

### 13. `src/components/ai/reflect/ReflectFeed.tsx`

The existing component already has good states. Two improvements: add "Load older" pagination and clearly mark it as a frontend transform.

```typescript
const [dayWindow, setDayWindow] = useState(7);

const loadReflections = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await window.deskflowAPI!.getGoalContext();
    if (result?.success) {
      const reflections = transformToReflections(result, dayWindow);
      setDays(reflections);
    } else {
      setError(result?.error || 'Failed to load reflections');
    }
  } catch (err: any) {
    setError(err.message || 'Error loading reflections');
  } finally {
    setLoading(false);
  }
};

useEffect(() => { loadReflections(); }, [dayWindow]);

// At bottom of populated view:
<div className="reflect-pagination">
  <button onClick={() => setDayWindow(w => w + 7)}>Load older (last {dayWindow + 7} days)</button>
</div>
```

Update `transformToReflections` to accept the window:

```typescript
function transformToReflections(ctx: any, windowDays = 7): any[] {
  if (!ctx?.unfinished && !ctx?.recentlyCompleted) return [];
  const days: Record<string, any[]> = {};
  const today = new Date();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    days[d] = [];
  }
  // ... rest unchanged ...
}
```

---

### 14. `src/components/ai/deck/AiPageDeck.tsx`

Pass through new props (no logic change, just plumbing):

```typescript
interface AiPageDeckProps {
  // ... all existing ...
  reviewError: string | null;        // NEW
  digestError: string | null;       // NEW
  toggleErrors: Record<number, string>;  // NEW
  acceptErrors: Record<string, string>;  // NEW
  bootLoading: boolean;             // NEW
  bootError: { goals?: string; longterm?: string; connectors?: string; providers?: string };  // NEW
  onRetryBoot: () => void;          // NEW
  onRetryReview: () => void;        // NEW
  onRetryDigest: () => void;        // NEW
  onDismissReviewError: () => void; // NEW
  onDismissDigestError: () => void; // NEW
  onConnectorToast: (msg: string, type: 'success' | 'error' | 'info') => void;  // NEW
  onRefreshConnectors: () => void;  // NEW
  notesSaveState: { saving: boolean; error: string | null; saved: boolean };  // NEW
}
```

For each child:
- `<FocusBoard>` receives `reviewError`, `toggleErrors`, `acceptErrors`, `onRetryReview`, `onDismissReviewError`
- `<PlanBoard>` receives `notesSaveState`
- `<DailyDigestBoard compact>` receives `error={digestError}`, `onDismissError={onDismissDigestError}`
- `<ConnectorsPanel>` receives `onToast={onConnectorToast}`, `onRefresh={onRefreshConnectors}`

Add a top-level boot-error banner:

```typescript
{bootLoading && (
  <div className="boot-loading">
    <div className="loading-pulse" />
    <span>Loading your workspace…</span>
  </div>
)}

{!bootLoading && Object.values(bootError).some(Boolean) && (
  <div className="boot-error-banner">
    <AlertCircleIcon />
    <span>Some sections failed to load: {Object.entries(bootError).filter(([,v]) => v).map(([k]) => k).join(', ')}</span>
    <button onClick={onRetryBoot}>Retry all</button>
  </div>
)}
```

---

### 15. `src/components/ai/focus/FocusBoard.tsx`

Accept per-goal and per-suggestion errors + render inline:

```typescript
interface FocusBoardProps {
  // ... existing ...
  reviewError?: string | null;                       // NEW
  toggleErrors?: Record<number, string>;             // NEW
  acceptErrors?: Record<string, string>;             // NEW
  onRetryReview?: () => void;                        // NEW
  onDismissReviewError?: () => void;                 // NEW
}
```

In the suggestions map:

```typescript
{props.suggestions.map((s, i) => {
  const errKey = s.title;
  const err = props.acceptErrors?.[errKey];
  return (
    <div key={i} className="goal-suggestion-card">
      <div className="suggestion-content">
        <strong>{s.title}</strong>
        {s.description && <p>{s.description}</p>}
      </div>
      <div className="suggestion-actions">
        <button onClick={() => props.onAcceptSuggestion(s)}>
          <CheckIcon /> Accept
        </button>
      </div>
      {err && (
        <div className="inline-error">
          <AlertCircleIcon />
          <span>{err}</span>
          <button onClick={() => props.onAcceptSuggestion(s)}>Retry</button>
        </div>
      )}
    </div>
  );
})}
```

In the active-goals map, render `toggleErrors[goal.id]` inline similarly.

Add a review error banner (mirroring the suggestion error banner pattern already present):

```typescript
{props.reviewError && (
  <div className="suggestion-error-banner">
    <AlertCircleIcon />
    <span>Review failed: {props.reviewError}</span>
    <button onClick={props.onRetryReview}>Retry</button>
    {props.onDismissReviewError && (
      <button onClick={props.onDismissReviewError} className="link-btn">Dismiss</button>
    )}
  </div>
)}
```

---

### 16. `src/main.ts` — minimal IPC handler hardening

For `provider-chat-call`, propagate the abort signal:

```typescript
ipcMain.handle('provider-chat-call', async (event, req) => {
  try {
    const configs = await getProviderConfigs();
    const primary = configs.filter(c => c.slot === 'default');
    const fallback = configs.filter(c => c.slot !== 'default');
    // CHANGED — pass externalSignal through (req.signal is not directly transferable
    // across IPC, but we can listen for the renderer-side abort via event)
    const result = await runWithFallback(primary, fallback, {
      ...req,
      // Note: AbortSignal doesn't serialize across IPC. For full propagation,
      // a streaming channel with explicit cancel events is needed (future work).
    });
    return { success: true, content: result.content };
  } catch (err: any) {
    return { success: false, error: err.message || 'Provider call failed' };
  }
});
```

For `suggest-goals`, guard against null config:

```typescript
ipcMain.handle('suggest-goals', async (event, date, context) => {
  try {
    const configs = await getGoalAssistantConfig();
    if (!configs || (Array.isArray(configs) && configs.length === 0)) {
      return { success: false, error: 'No goal-assistant provider configured. Open Settings to add one.' };
    }
    const result = await runWithFallback(
      Array.isArray(configs) ? configs : [configs],
      [],
      { /* ...existing... */ }
    );
    const suggestions = parseGoalSuggestions(result.content);
    return { success: true, suggestions };
  } catch (err: any) {
    return { success: false, error: err.message || 'Goal suggestion failed' };
  }
});
```

For Reflect Feed (optional — requires preload addition). If you choose the frontend-only path, skip this and the existing `getGoalContext` continues to power ReflectFeed. If you want a dedicated channel:

```typescript
// In main.ts (additive):
ipcMain.handle('get-reflections', async (event, windowDays = 7) => {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - (windowDays + 7) * 86400000).toISOString();
    const unfinished = db.prepare(
      'SELECT * FROM goals WHERE status = "active" ORDER BY updated_at DESC LIMIT 50'
    ).all();
    const recentlyCompleted = db.prepare(
      'SELECT * FROM goals WHERE status = "done" AND completed_date > ? ORDER BY completed_date DESC LIMIT 50'
    ).all(cutoff);
    return { success: true, unfinished, recentlyCompleted, windowDays };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
```

In preload (additive only):

```typescript
'get-reflections': (windowDays?: number) => ipcRenderer.invoke('get-reflections', windowDays),
```

---

## Layer 2 — High-Fidelity Visual Specs

### Toast (transient feedback)

```
┌──────────────────────────────────────────┐
│ ✓  Connector test succeeded          ×   │   ← green left border (3px)
└──────────────────────────────────────────┘
```
- Fixed position: `bottom-6 right-6`
- Stack vertically, gap-2
- Background: `var(--bg-card)` with `box-shadow: 0 4px 12px rgba(0,0,0,0.3)`
- Border-left: 3px solid `var(--accent-success | --accent-error | --accent-primary)`
- Text: `text-sm text-slate-100`
- Animation: `slideIn 0.2s ease-out` from `translateX(100%) opacity:0` → `translateX(0) opacity:1`
- Auto-dismiss: 4s
- Manual close: × button (8x8 hit target)

### Inline Error (per-item, e.g., per-goal toggle failure)

```
┌─────────────────────────────────────┐
│ ⚠ Failed to update goal  [Retry]    │
└─────────────────────────────────────┘
```
- Background: `rgba(239,68,68,0.08)`
- Border: `1px solid rgba(239,68,68,0.25)`
- Border-radius: `6px`
- Padding: `8px 12px`
- Text: `text-xs text-red-400`
- Retry button: `text-xs text-indigo-400 hover:text-indigo-300`
- No animation (instant, dismissable)

### Section Error Banner (e.g., review, digest, boot)

```
┌───────────────────────────────────────────┐
│ ⚠ Review failed: <message>   [Retry][×]   │
└───────────────────────────────────────────┘
```
- Background: `rgba(239,68,68,0.1)`
- Border: `1px solid rgba(239,68,68,0.3)`
- Border-radius: `8px`
- Padding: `12px 16px`
- Text: `text-sm text-red-300`
- Animation: `fadeIn 0.2s ease-out`
- Retry button: `bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded`
- Dismiss (×): `text-slate-400 hover:text-slate-200`

### Loading States

- **Skeleton rows**: `bg-zinc-800 animate-pulse h-4 rounded` for list items
- **Pulse bar**: existing `.loading-pulse` (gradient sweep, 1.5s)
- **Button loading**: replace label with `Generating…` + disable, keep size stable to prevent layout shift
- **Full-section loading**: pulse bar + `text-slate-500 text-sm` caption

### Empty States

- Icon at 32px (or 48px for full-page), `text-slate-600`
- Heading: `text-base font-medium text-slate-300`
- Description: `text-sm text-slate-500`
- CTA button: `bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg`

### Saving Indicator (PlanBoard notes)

- "Saving…": `text-xs text-slate-500` with pulsing dot
- "Saved ✓": `text-xs text-emerald-400`, fades out after 2s
- Error: inline `text-xs text-red-400` with Retry

---

## Layer 3 — UX Flows (Per Action)

### Goal Suggest
| State | What user sees |
|---|---|
| In progress | Button → "Generating…", button disabled, suggestion area shows pulse |
| Success | Suggestions render as cards with Accept buttons |
| Timeout | Red banner: "The model timed out. [Retry]" — Retry calls `handleSuggest` again |
| Other failure | Red banner with the provider's error message + Retry |
| Empty | "No suggestions returned. Try again or refine your context." |

### Goal Toggle
| State | What user sees |
|---|---|
| In progress | Goal row's toggle button shows spinner |
| Success | Goal moves to the new status section |
| Failure | Goal **stays in original state**, inline error below the row: "Failed to update. [Retry]" |

### Goal Accept Suggestion
| State | What user sees |
|---|---|
| In progress | Accept button → "Saving…", card dims slightly |
| Success | Card animates out (slide+fade), toast "Goal saved", active list refreshes |
| Failure | Card **reappears**, inline error on the card: "Failed to save. [Retry]" |

### Goal Review
| State | What user sees |
|---|---|
| In progress | Review button → "Reviewing…", existing suggestions dim |
| Success | Review cards render below active goals |
| Failure | Red banner under Focus header with Retry + Dismiss |

### Digest Generation
| State | What user sees |
|---|---|
| In progress | Pulse bar + "Generating your daily digest…" |
| Success | Summary + topic chips/cards render |
| Failure | Empty-state-style card: "Couldn't Generate Digest" + Retry + Dismiss |
| Empty | Friendly empty state with "Generate Your First Digest" CTA |

### Connector Test
| State | What user sees |
|---|---|
| In progress | Test button → "Testing…", disabled |
| Success | Toast (green): "Connector test succeeded" |
| Failure | Toast (red) with provider's error message |

### Connector Disconnect
| State | What user sees |
|---|---|
| In progress | Disconnect button → "Disconnecting…" |
| Success | Connector removed from list, toast (green) "Connector disconnected" |
| Failure | Connector **stays in list**, section banner with error + Retry |

### Connector Setup Complete
| State | What user sees |
|---|---|
| Complete | Modal closes, connector list refreshes (no longer a TODO), toast (green) "Connector added" |

### Bulk Import
| State | What user sees |
|---|---|
| In progress | Import button disabled, dialog stays open with spinner |
| Success | Dialog closes, long-term list refreshes, toast "N goals imported" |
| Failure | Dialog stays open, error banner inside dialog with Retry |

### Planning Notes Save
| State | What user sees |
|---|---|
| Typing | No IPC fires; local text updates immediately |
| After 600ms idle | "Saving…" indicator appears |
| Success | "Saved ✓" for 2s |
| Failure | Inline error with Retry — typing again resets the error |

### Chat Send
| State | What user sees |
|---|---|
| In progress | User bubble appears, ThinkingIndicator → then TypewriterText reveals content |
| Success | Parsed card renders with action buttons (Accept/View/Dismiss/Retry wired) |
| Failure | Red banner above input with Retry (if timeout/cancel) + Dismiss (clears error only, NOT messages) |
| Cancelled | "Generation cancelled" banner with Retry |

### Chat Error Dismiss
- Clicking Dismiss → only `error` clears; messages preserved
- Clicking Retry (if shown) → re-sends last user message

### Model Change
| State | What user sees |
|---|---|
| Select | Dropdown closes, new model shown |
| Persist | IPC `upsertProviderConfig` fires in background |
| Failure | Model reverts to previous, toast (red) "Failed to change model" |

### Initial Load Failure
- Each section independently shows its own error state
- Top-of-page banner aggregates: "Some sections failed to load: goals, providers"
- "Retry all" button re-runs all four load functions

### Provider Select Modal
| State | What user sees |
|---|---|
| Loading | "Loading providers…" with pulse |
| Empty (no providers) | "No providers configured. Add one in Settings →" |
| Empty (no search match) | "No providers match your search" |
| Error | Red banner with Retry |
| Populated | Filterable list, current selection highlighted with ✓ |

---

## Layer 4–7 — Verification Mapping

| # | Scenario | Covered By |
|---|---|---|
| 1 | Goal creation success | `handleSuggest` + `handleAcceptSuggestion` success paths |
| 2 | Goal timeout | `router.ts` AbortError retry + `suggestionError` banner + Retry button |
| 3 | Goal HTTP 500 | `router.ts` 5xx retry + banner with message |
| 4 | Goal toggle failure | `handleToggleGoal` rollback + `toggleErrors[goalId]` inline error |
| 5 | Goal accept failure | `handleAcceptSuggestion` rollback + `acceptErrors[title]` inline |
| 6 | Review failure | `reviewError` banner + Retry + Dismiss |
| 7 | Digest success | existing flow unchanged |
| 8 | Digest failure | `digestError` state + `DailyDigestBoard` error branch |
| 9 | Connector test | `handleTest` toast feedback |
| 10 | Connector disconnect failure | `handleDisconnect` rollback via `onRefresh()` + banner |
| 11 | Bulk import | `handleBulkImport` saves via `saveLongtermGoals` |
| 12 | Initial load failure | `bootError` per-section + aggregated banner + Retry all |
| 13 | Chat send + streaming | `streamingMessage` populated, `TypewriterText` reveals, card actions wired |
| 14 | Chat error dismiss | `dismissError` only clears error, not messages |
| 15 | Model change | `handleModelChange` calls `upsertProviderConfig` |
| 16 | Context bundle | `buildContextBundle` now includes connectors + focus + warnings |
| 17 | Reflect feed | pagination via `dayWindow` + existing states |
| 18 | Notes debounce | `debounceRef` 600ms trailing |
| 19 | Provider modal | loading + error + empty + populated + settings link |
| 20 | Tab switch | unchanged (state in AiPage, not in tabs) |
| 21 | Restart persistence | no schema changes; `timeoutMs` is optional with default |

---

## Summary of File Touchpoints

| File | Change Type |
|---|---|
| `src/services/providers/types.ts` | Add `timeoutMs` field |
| `src/services/providers/callProvider.ts` | Use `timeoutMs ?? 120000`, propagate external signal |
| `src/services/providers/router.ts` | Retry AbortError + 5xx; distinguish timeout/failure in error msg |
| `src/services/aiContextBundle.ts` | Expand scope, return `{content, warnings}`, truncate to budget |
| `src/hooks/useAiChat.ts` | `messagesRef`, populate `streamingMessage`, add `dismissError` |
| `src/pages/AiPage.tsx` | Per-op error states, rollback handlers, toast system, boot coordination |
| `src/components/ai/deck/AiPageDeck.tsx` | Pass through new props + boot banner |
| `src/components/ai/chat/ChatPanel.tsx` | `onDismissError`, real model change, retry button |
| `src/components/ai/chat/parsed.ts` | `handleCardAction` accepts `CardActionHandlers` |
| `src/components/ai/focus/FocusBoard.tsx` | Inline per-goal/per-suggestion errors, review error banner |
| `src/components/ai/plan/PlanBoard.tsx` | Debounced notes, real bulk import, save state indicator |
| `src/components/ai/digest/DailyDigestBoard.tsx` | Error state in compact + full |
| `src/components/ai/connectors/ConnectorsPanel.tsx` | Toast feedback, rollback on disconnect, setup-modal refresh |
| `src/components/ai/reflect/ReflectFeed.tsx` | Pagination via `dayWindow` |
| `src/components/AiProviderSelectModal.tsx` | Error state + Settings link |
| `src/main.ts` | Guard null goal config; (optional) `get-reflections` channel |

All changes are additive or surgical — no refactor of unrelated code, no new dependencies, no schema migrations (existing `timeout_ms` column already in `provider_configs` per your schema), backward-compatible with existing user data.
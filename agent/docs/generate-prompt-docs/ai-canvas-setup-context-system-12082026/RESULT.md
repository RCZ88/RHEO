# RESULT.md — AI Canvas: Self-Contained Context, Default Setup, UX & Digest Specs (v2)

**Date:** 2026-08-12
**Author:** Architect AI
**Target Audience:** Coding AI Agent (Strict adherence required)
**Core Directive:** **ZERO external dependencies for data.** All systems (Context/RAG, Canvas State, Digest) must be fully packaged, self-contained within the Electron app's `userData` directory or `localStorage`, and work out-of-the-box for any user without external folder mapping.

---

## 1. FEATURE-BY-FEATURE CODE SPECIFICATIONS

### R1: Default Canvas Setup (Headline Feature)
**Storage:** `localStorage` key `deskflow-canvas-default-setup`.
**Constraint:** Must respect the `wasLoaded` invariant. Never overwrite a loaded canvas.

#### 1.1 TypeScript Interfaces (`src/types/canvas.ts`)
```typescript
export interface DefaultSetupCard {
  type: CardType;
  enabled: boolean;
  // Optional default data to seed (e.g., specific goals for Focus)
  defaultData?: Record<string, any>; 
  position: { x: number; y: number };
  size: { w: number; h: number };
  pinned: boolean;
}

export interface DefaultSetupConfig {
  version: 1;
  cards: DefaultSetupCard[];
  updatedAt: number;
}
```

#### 1.2 Hook API Additions (`src/hooks/useCanvasState.ts`)
```typescript
// Add to the returned API object
const saveDefaultSetup = useCallback((config: DefaultSetupConfig) => {
  try {
    localStorage.setItem('deskflow-canvas-default-setup', JSON.stringify(config));
  } catch (e) { console.error('Failed to save default setup', e); }
}, []);

const loadDefaultSetup = useCallback((): DefaultSetupConfig | null => {
  try {
    const raw = localStorage.getItem('deskflow-canvas-default-setup');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}, []);

// Modify the existing clearAll / newCanvas logic:
const createNewCanvas = useCallback(() => {
  // 1. Clear current state
  dispatch({ type: 'RESET_LAYOUT' });
  clearCanvasLayout();
  loadedFromStorage.current = false; // CRITICAL: Allows seeding
  
  // 2. Seed from Default Setup
  const setup = loadDefaultSetup();
  if (setup && setup.cards.length > 0) {
    setup.cards.filter(c => c.enabled).forEach(c => {
      dispatch({
        type: 'ADD_CARD',
        card: {
          id: crypto.randomUUID(),
          type: c.type,
          position: c.position,
          size: c.size,
          pinned: c.pinned,
          data: c.defaultData || {},
          source: 'system',
          status: 'live',
          createdAt: Date.now(),
          zIndex: stateRef.current.nextZIndex
        }
      });
    });
  } else {
    // Fallback to hardcoded defaults if no setup exists
    seedHardcodedDefaults(); 
  }
}, [loadDefaultSetup]);
```

#### 1.3 UI Component (`src/components/ai/canvas/DefaultSetupDialog.tsx`)
*   **Trigger:** `LayoutTemplate` icon in `CanvasContainer.tsx` toolbar.
*   **Layout:** Full-screen modal (`z-[220]`).
*   **Logic:** Maps over `CARD_TEMPLATES`. Toggles `enabled` boolean. "Save" calls `canvas.saveDefaultSetup(config)`.

---

### R2 & R4: humancentred-UIUX & Adaptive Cards (Strict Matrix)
**Rule:** Every card MUST use the shared `<CardFrame>` and `<StateView>` components. No raw `div`s for card bodies. No `window.confirm`.

#### 2.1 Shared Components (`src/components/ai/canvas/shared/`)

**`CardFrame.tsx`** (Handles glassmorphism, header, drag-handle)
```tsx
interface CardFrameProps {
  card: CanvasCard;
  onDismiss: () => void;
  onPin: () => void;
  children: React.ReactNode;
}
// Tailwind classes: bg-[rgba(24,24,27,0.85)] backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-lg
// Header: flex justify-between items-center p-3 border-b border-zinc-700/50
// Dismiss/Pin buttons: MUST use CustomConfirmDialog for destructive actions if needed.
```

**`StateView.tsx`** (Enforces the 4 states)
```tsx
type ViewState = 'empty' | 'loading' | 'error' | 'populated';

interface StateViewProps {
  state: ViewState;
  emptyProps?: { icon: LucideIcon; title: string; description: string; ctaLabel?: string; onCta?: () => void };
  errorProps?: { message: string; onRetry?: () => void };
  loadingType?: 'list' | 'text' | 'chart'; // Maps to shadcn/skeleton shapes
  children: React.ReactNode; // The populated view
}
```

#### 2.2 Adaptive Data Checks (Inside each card component)
The coding agent MUST implement these exact checks at the top of the card's render function:
*   **Finance:** `if (!data.transactions?.length) return <StateView state="empty" emptyProps={{icon: Wallet, title: "No transactions", ctaLabel: "Add Transaction", onCta: openFinanceModal}} />`
*   **Connectors:** `if (!data.connectors?.length) return <StateView state="empty" ... />`
*   **Digest:** `if (!data.topics?.length) return <StateView state="empty" emptyProps={{icon: Newspaper, title: "No research topics", ctaLabel: "Configure in Settings", onCta: openSettings}} />`

---

### R3: Daily Research (Digest) & Fallback System
**Rule:** The main process MUST handle empty states and provider failures gracefully. The renderer MUST poll correctly.

#### 3.1 Main Process IPC (`src/main/ipc/digest.ts`)
```typescript
ipcMain.handle('get-topic-digest', async (event, opts: { force?: boolean }) => {
  const settings = getSettings();
  const topics = settings.digestTopics || [];
  
  // GUARD: Empty topics
  if (topics.length === 0) {
    return { status: 'no-topics', message: 'No research topics configured.' };
  }

  // GUARD: Already generating
  if (isDigestGenerating) return { status: 'in-progress' };
  
  isDigestGenerating = true;
  event.sender.send('digest-generation-complete', { status: 'started' });

  try {
    const pState = getProviderState();
    // MANDATORY: Use the fallback chain
    const chain = buildChain(pState, 'researchDigest'); 
    if (chain.length === 0) throw new Error('No AI providers enabled for Research Digest.');

    const result = await runWithFallback(chain, {
      messages: [{ role: 'user', content: `Research these topics: ${topics.join(', ')}` }],
      maxTokens: 2000
    });

    // Save to DB/Settings and notify renderer
    saveDigestResult(result.result.text);
    event.sender.send('digest-generation-complete', { status: 'success', data: result.result.text });
  } catch (err: any) {
    event.sender.send('digest-generation-complete', { status: 'error', error: err.message });
  } finally {
    isDigestGenerating = false;
  }
});
```

#### 3.2 Renderer Polling (`AiPage.tsx`)
*   Keep the `setInterval` polling `isDigestGenerating`.
*   Listen to `onDigestGenerationComplete`. If `status === 'error'`, dispatch `UPDATE_CARD` to set the Digest card's `status` to `'error'` and store the error message in `data.error`.

---

### R5: Self-Contained Context/RAG System (Zero External Dependencies)
**Architecture:** Main Process In-Memory JSON Store + BM25 Index. Fully packaged, works for any user, no external folders, no native builds.

#### 5.1 Storage Layer (`src/main/services/knowledge-store.ts`)
*   **File Path:** `path.join(app.getPath('userData'), 'deskflow-kb.json')`
*   **Schema:**
    ```typescript
    interface KBDocument { id: string; name: string; type: 'pdf'|'md'|'txt'; addedAt: number; }
    interface KBChunk { id: string; docId: string; content: string; tokens: string[]; }
    interface KnowledgeBase { documents: KBDocument[]; chunks: KBChunk[]; }
    ```
*   **Initialization:** On `app.ready`, read `deskflow-kb.json`. If missing, create empty `{ documents: [], chunks: [] }`. Load into memory (`let db: KnowledgeBase`).
*   **Persistence:** Debounced write to disk (500ms) after any mutation.

#### 5.2 Ingestion Pipeline (Main Process)
```typescript
ipcMain.handle('kb:ingest', async (event, file: { name: string, type: string, content: string }) => {
  // 1. Chunking (Simple paragraph/sentence split for v1)
  const rawChunks = splitIntoChunks(file.content, 500); // ~500 tokens max
  
  // 2. Tokenization (Lowercase, strip punctuation)
  const docId = crypto.randomUUID();
  const newChunks = rawChunks.map(text => ({
    id: crypto.randomUUID(),
    docId,
    content: text,
    tokens: tokenize(text)
  }));

  // 3. Update Memory & Disk
  db.documents.push({ id: docId, name: file.name, type: file.type, addedAt: Date.now() });
  db.chunks.push(...newChunks);
  scheduleSave();
  
  // 4. Rebuild Index
  buildBM25Index();
  return { success: true, docId };
});
```

#### 5.3 Retrieval Engine (BM25)
```typescript
// Inverted Index: Map<token, Set<chunkId>>
let invertedIndex = new Map<string, Set<string>>();
let idfScores = new Map<string, number>();

function buildBM25Index() {
  invertedIndex.clear();
  const N = db.chunks.length;
  const docFrequency = new Map<string, number>();

  db.chunks.forEach(chunk => {
    const uniqueTokens = new Set(chunk.tokens);
    uniqueTokens.forEach(token => {
      if (!invertedIndex.has(token)) invertedIndex.set(token, new Set());
      invertedIndex.get(token)!.add(chunk.id);
      docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
    });
  });

  // Calculate IDF: log(N / df)
  docFrequency.forEach((df, token) => {
    idfScores.set(token, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  });
}

ipcMain.handle('kb:query', async (event, query: string, limit = 5) => {
  const queryTokens = tokenize(query);
  const scores = new Map<string, number>();

  queryTokens.forEach(qt => {
    const chunkIds = invertedIndex.get(qt);
    if (!chunkIds) return;
    const idf = idfScores.get(qt) || 0;
    chunkIds.forEach(chunkId => {
      scores.set(chunkId, (scores.get(chunkId) || 0) + idf); // Simplified BM25
    });
  });

  // Sort and return top K
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
  return sorted.map(([chunkId]) => db.chunks.find(c => c.id === chunkId)!);
});
```

#### 5.4 Integration (Chat Prompt Injection)
In `AiPage.tsx`, before sending the user message to the AI:
```typescript
const contextChunks = await window.electronAPI.kbQuery(userMessage, 3);
const contextString = contextChunks.map(c => c.content).join('\n---\n');
const finalPrompt = `Context:\n${contextString}\n\nUser Query:\n${userMessage}`;
// Send finalPrompt to the LLM
```

---

## 2. UI/UX SPEC PER CARD (Strict Tailwind & Component Rules)

| Card Type | Empty State Config | Loading Skeleton | Error State Config |
| :--- | :--- | :--- | :--- |
| **Focus** | `icon: Target`, `title: "No daily goals"`, `cta: "Add Goal"` | 3x `<Skeleton className="h-8 w-full" />` | `message: "Failed to load goals"`, `retry: fetchGoals` |
| **Finance** | `icon: Wallet`, `title: "No transactions"`, `cta: "Add Transaction"` | Chart area `<Skeleton className="h-32 w-full" />` + 2x list rows | `message: "Sync failed"`, `retry: syncFinance` |
| **Digest** | `icon: Newspaper`, `title: "No research topics"`, `cta: "Configure"` | 3x `<Skeleton className="h-24 w-full" />` (article cards) | `message: data.error`, `retry: triggerDigest` |
| **Connectors**| `icon: Plug`, `title: "No integrations"`, `cta: "Connect"` | 2x `<Skeleton className="h-20 w-1/2" />` (grid) | `message: "Auth failed"`, `retry: reconnect` |

**Token Enforcement:**
*   **Glass Background:** `bg-[rgba(24,24,27,0.85)]` (Never use solid `bg-zinc-900` for cards).
*   **Borders:** `border border-zinc-700/50` (Never use `border-zinc-800`, too dark).
*   **Focus Rings:** `focus:ring-2 focus:ring-[var(--dk-accent)] focus:ring-offset-2 focus:ring-offset-zinc-900` (Mandatory on all buttons/inputs).
*   **Transitions:** `transition-all duration-200 ease-out` on all interactive elements.

---

## 3. IMPLEMENTATION ORDER (Strict Dependency Chain)

1.  **Phase 1: Foundation & Shared Components**
    *   Create `CardFrame.tsx`, `StateView.tsx`, `EmptyState.tsx`, `ErrorState.tsx`.
    *   Implement `CustomConfirmDialog` globally and replace ALL `window.confirm`.
2.  **Phase 2: Adaptive Cards (R2/R4)**
    *   Refactor ALL 14 card types to use `CardFrame` and `StateView`.
    *   Implement the specific empty-state data checks for Finance, Connectors, Digest, etc.
3.  **Phase 3: Default Setup (R1)**
    *   Add `DefaultSetupConfig` interfaces and `localStorage` logic to `useCanvasState.ts`.
    *   Build `DefaultSetupDialog.tsx` and wire to `CanvasContainer.tsx` toolbar.
    *   Update the `clearAll` / `createNewCanvas` logic to respect `wasLoaded` and seed from setup.
4.  **Phase 4: Digest & Fallback Hardening (R3)**
    *   Update `main.ts` `get-topic-digest` handler with the empty/failure guards.
    *   Verify `buildChain` is used for ALL AI features (Digest, Goal Assistant, etc.).
5.  **Phase 5: Self-Contained Context System (R5)**
    *   Implement `knowledge-store.ts` (Main Process JSON store + BM25).
    *   Add `kb:ingest`, `kb:query` IPC channels to `preload.ts`.
    *   Build "Knowledge Base" UI in Settings/Canvas to upload `.txt`/`.md` files.
    *   Wire `kb:query` into the AI Chat submission handler.

---

## 4. VERIFICATION CHECKLIST (For the Coding Agent)

*   **[ ] Invariant Check:** Delete `deskflow-canvas-active` from localStorage. Reload app. Verify hardcoded defaults load. Create a Default Setup with ONLY "Focus". Click "New Canvas". Verify ONLY Focus loads. Reload app. Verify Focus persists.
*   **[ ] UX Audit:** Open Finance card. Delete all transactions via the UI. Verify it transitions smoothly to the Empty State with the Wallet icon and CTA. Tab through the CTA button; verify the cyan focus ring appears.
*   **[ ] Digest Guard:** Go to Settings -> AI. Clear all Digest topics. Click "Generate Digest" in the Digest card. Verify it immediately shows the Empty State ("No research topics") and DOES NOT call the LLM provider.
*   **[ ] RAG Self-Contained:** Upload a `.txt` file via the Knowledge Base UI. Close the app completely. Reopen. Verify the file is still listed (proves `userData/deskflow-kb.json` persistence). Ask the AI a question about the file. Verify the context is injected into the prompt (check DevTools Network/Console logs).
*   **[ ] Confirmation Ban:** Search the entire `src/` directory for `window.confirm` and `window.alert`. Result MUST be 0 matches.

---

## 5. OPEN QUESTIONS RESOLVED (Final Architecture)

1.  **Context System Scope:** Resolved to **Fully Self-Contained**. No external folders (`CZVault`, `agent/`). Uses Main Process `userData/deskflow-kb.json` + In-Memory BM25. Zero native dependencies, works for any packaged user.
2.  **Default Setup Storage:** Resolved to `localStorage` (`deskflow-canvas-default-setup`). Pure frontend, instant sync.
3.  **Seeding Invariant:** Mathematically enforced via `loadedFromStorage.current` flag in `useCanvasState.ts`. If `true`, seeding is bypassed entirely.
4.  **Digest Generation:** Async IPC with explicit `no-topics` and `provider-failure` guards in the Main Process handler. Renderer polls state and updates card UI accordingly.
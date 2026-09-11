# Complete Fix: Lyceum AI Tutor System

## Diagnosis Summary

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | AI responses never appear | 14 preload bridges missing → `supportsV2 = false` → both V1 and V2 paths dead-end | Wire all 14 bridges in `preload.ts` |
| 2 | AI has no context for Explain/Simpler/Deeper | Same generic system prompt for all modes; mode info only prepended to question text | Add `mode` parameter to `ask()`/`askStream()` with mode-specific system prompts |
| 3 | Everything opens in chat panel | No inline answer rendering path exists | New `InlineAnswerCard` component + `LearnPage` branching logic |
| 4 | Highlight button does nothing | `SelectionActions.onCreateHighlight` not wired through to `useHighlights.createHighlight` | Wire callback chain in `ReaderView`/`LearnPage` |
| 5 | Notes don't work | `api.learnAddNote` is `undefined` (bridge missing) | Fixed by Task A bridge wiring |
| 6 | No provider/model visibility | No IPC endpoint or UI element | Add `learn:getTutorConfig` handler + preload bridge + TutorPanel header line |
| 7 | System prompt visible to user | Not actually rendered in current code, but verify defensively | Explicit guard: never pass `systemPrompt` to renderer |

---

## Phase 1 — Preload Bridges (Task A + Task F)

### File: `src/preload.ts`

**Locate** the line `learnBuildPromptFromRecipe: (params) => ipcRenderer.invoke('learn:buildPromptFromRecipe', params),` (approximately line 1083).

**Insert immediately after it:**

```typescript
  // ========== Tutor V2 Streaming ==========
  learnTutorStream: (params: {
    nodeId: string;
    blockId: string;
    question: string;
    convId?: string;
    mode?: 'explain' | 'ask' | 'simpler' | 'deeper';
  }) => ipcRenderer.invoke('learn:tutorStream', params),

  onTutorToken: (callback: (data: { blockId: string; token: string; done: boolean }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('learn:tutorToken', handler);
    return () => ipcRenderer.removeListener('learn:tutorToken', handler);
  },

  // ========== Tutor Config (Task F) ==========
  learnGetTutorConfig: () => ipcRenderer.invoke('learn:getTutorConfig'),

  // ========== Notes ==========
  learnAddNote: (params: {
    nodeId: string;
    text: string;
    tags?: string[];
    blockRef?: string;
  }) => ipcRenderer.invoke('learn:addNote', params),

  learnGetNotes: (params: { nodeId: string }) =>
    ipcRenderer.invoke('learn:getNotes', params),

  learnGetAllNotes: (params?: { limit?: number }) =>
    ipcRenderer.invoke('learn:getAllNotes', params || {}),

  learnDeleteNote: (params: { noteId: string }) =>
    ipcRenderer.invoke('learn:deleteNote', params),

  learnToggleNotePin: (params: { noteId: string; pinned: boolean }) =>
    ipcRenderer.invoke('learn:toggleNotePin', params),

  // ========== Tutor V2 Extras ==========
  learnCreateProposal: (params: {
    nodeId: string;
    blockId: string;
    title: string;
    bodyMd: string;
    actions: string[];
  }) => ipcRenderer.invoke('learn:createProposal', params),

  learnDecideProposal: (params: {
    proposal_id: string;
    approved: boolean;
    reason?: string;
  }) => ipcRenderer.invoke('learn:decideProposal', params),

  // ========== Conversations ==========
  learnStartConversation: (params: {
    id: string;
    nodeId: string;
    blockId: string;
  }) => ipcRenderer.invoke('learn:startConversation', params),

  learnAddMessage: (params: {
    nodeId: string;
    blockId?: string;
    role: string;
    text: string;
  }) => ipcRenderer.invoke('learn:addMessage', params),

  learnGetConversation: (params: { blockId: string }) =>
    ipcRenderer.invoke('learn:getConversation', params),

  learnResolveConversation: (params: { convId: string }) =>
    ipcRenderer.invoke('learn:resolveConversation', params),

  // ========== Dashboard ==========
  learnGetTutorDashboard: () => ipcRenderer.invoke('learn:getTutorDashboard'),
```

**Why this fixes the core issue:** `TutorPanel.tsx:55` checks `!!(api?.learnTutorStream && api?.onTutorToken)`. After this change, both are defined → `supportsV2 = true` → V2 streaming path activates. Additionally, all note/conversation/proposal APIs become callable from the renderer.

---

## Phase 2 — Mode-Specific System Prompts (Task B)

### File: `src/services/learn/services/tutor.service.ts`

**Replace** the top section (lines 1–22, from the `TUTOR_SYSTEM_PROMPT` constant through the `prependTutorPersona` function) with:

```typescript
const TUTOR_SYSTEM_PROMPT = `You are a tutor for ONE concept. Answer ONLY using FACTS below.
If the answer isn't in FACTS, say you can't answer from this section.
Be visual-first: prefer an analogy or a step list; cite fact ids [s1].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }

When the learner seems ready for deeper material, suggest "deeper".
When they need reinforcement, suggest "reinforce".
When they need remedial content, suggest "remedial".
Use the "escalate" flag only when the question fundamentally cannot be answered by this lesson's content.`;

// ── Mode-specific system prompts (Task B) ──────────────────────────
const MODE_SYSTEM_PROMPTS: Record<string, string> = {
  explain: `You are an expert teacher. Explain the following concept clearly and thoroughly.
Use analogies, step-by-step breakdowns, and concrete examples.
Assume the learner has basic knowledge but needs a clear explanation.
Ground your answer ONLY in the FACTS provided below. Cite fact ids [f1], [f2].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`,

  simpler: `You are a patient tutor simplifying a concept.
Rewrite the following in the simplest possible terms.
Use everyday language, short sentences, and relatable analogies.
A 12-year-old should be able to understand your explanation.
Ground your answer ONLY in the FACTS provided below. Cite fact ids [f1], [f2].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`,

  deeper: `You are an advanced instructor going deeper on a topic.
Provide nuanced analysis, edge cases, advanced patterns, and connections to other concepts.
Assume the learner already understands the basics and wants to go further.
Ground your answer ONLY in the FACTS provided below. Cite fact ids [f1], [f2].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`,
};

export type TutorMode = 'explain' | 'ask' | 'simpler' | 'deeper';

function resolveSystemPrompt(mode?: string, personaMd?: string): string {
  let base: string;
  if (mode && mode !== 'ask' && MODE_SYSTEM_PROMPTS[mode]) {
    base = MODE_SYSTEM_PROMPTS[mode];
  } else {
    base = TUTOR_SYSTEM_PROMPT;
  }
  if (!personaMd) return base;
  return `${personaMd}\n\n---\n\n## Core Tutor Instructions\n${base}`;
}

export function prependTutorPersona(personaMd: string): string {
  if (!personaMd) return TUTOR_SYSTEM_PROMPT;
  return `${personaMd}\n\n---\n\n## Core Tutor Instructions\n${TUTOR_SYSTEM_PROMPT}`;
}
```

**Then modify the `ask()` method signature and system prompt selection.** Find the `ask` method (line ~43) and update it:

```typescript
  async ask(params: {
    nodeId: string;
    blockId?: string;
    question: string;
    personaMd?: string;
    mode?: TutorMode;
  }): Promise<Result<TutorAnswer>> {
    try {
      const cacheKey = this.hashKey(params.nodeId, params.question);
      const cached = repo.getTutorCache(this.db, cacheKey);
      if (cached) {
        const c = cached as any;
        return { ok: true, data: JSON.parse(c.answer_json) };
      }

      const { packet, retrieval_score, out_of_scope } = this.grounding.retrieve(
        params.nodeId,
        params.question,
      );

      if (out_of_scope || retrieval_score < 0.35) {
        const answer: TutorAnswer = {
          answer_md: `That question is outside the scope of this section. This node covers: **${packet.scope.includes}**.`,
          used_source_ids: [], used_fact_ids: [], citations: [],
          scope: packet.scope.includes,
          assessment: { target_level: 'L0', outcome: 'partial', rationale: 'Out of scope question', suggested_next: 'reinforce' },
          escalated: true, confidence: 0,
        };
        return { ok: true, data: answer };
      }

      const factsText = packet.must_know.map((f, i) => `[f${i + 1}] ${f.claim}`).join('\n');
      const misconceptionsText = packet.misconceptions.map((m) => `⚠️ Wrong: ${m.wrong} → Correct: ${m.correct}`).join('\n');
      const sourcesText = packet.sources.map((s) => `[s${s.id}] ${s.title}: ${s.url}`).join('\n');

      const userPrompt = `FACTS:\n${factsText}\n\nMISCONCEPTIONS:\n${misconceptionsText}\n\nSOURCES:\n${sourcesText}\n\nQUESTION: ${params.question}`;

      // ── Use mode-specific system prompt (Task B) ──
      const systemPrompt = resolveSystemPrompt(params.mode, params.personaMd);

      let answerResult;
      try {
        answerResult = await this.callAi(userPrompt, systemPrompt, 500);
      } catch {
        return { ok: false, error: 'AI provider unavailable. Please check your AI configuration.' };
      }

      let answerMd = '';
      let usedSourceIds: string[] = [];
      let usedFactIds: string[] = [];
      try {
        const parsed = typeof answerResult === 'string' ? JSON.parse(answerResult) : answerResult;
        answerMd = parsed.answer_md || answerResult;
        usedSourceIds = parsed.used_source_ids || [];
        usedFactIds = parsed.used_fact_ids || [];
      } catch {
        answerMd = typeof answerResult === 'string' ? answerResult : JSON.stringify(answerResult);
      }

      const citations = packet.sources
        .filter((s) => usedSourceIds.includes(s.id))
        .map((s) => ({ id: s.id, url: s.url, title: s.title }));

      if (citations.length === 0 && packet.sources.length > 0) {
        return {
          answer_md: "I don't have enough information from the available sources to answer this question accurately.",
          used_source_ids: [], used_fact_ids: [], citations: [],
          assessment: { target_level: 'L1' as MasteryLevel, outcome: 'partial' as EvidenceOutcome, rationale: 'No relevant sources found.', suggested_next: 'review' as const },
          escalated: false, confidence: 0,
        };
      }

      const assessment = {
        target_level: 'L1' as MasteryLevel,
        outcome: 'partial' as EvidenceOutcome,
        rationale: 'Question received, awaiting learner response for assessment.',
        suggested_next: 'deeper' as const,
      };

      const answer: TutorAnswer = {
        answer_md: answerMd, used_source_ids: usedSourceIds, used_fact_ids: usedFactIds,
        citations, scope: packet.scope.includes, assessment,
        escalated: false, confidence: retrieval_score,
      };

      const now = new Date().toISOString();
      repo.setTutorCache(this.db, {
        key: cacheKey, node_id: params.nodeId,
        answer_json: JSON.stringify(answer), model: 'small', created_at: now,
      });

      return { ok: true, data: answer };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
```

**What changed:** Added `mode?: TutorMode` to params. Replaced the inline system prompt selection (`params.personaMd ? prependTutorPersona(...) : this.systemPrompt`) with `resolveSystemPrompt(params.mode, params.personaMd)`. The rest of the method body is identical.

---

### File: `src/services/learn/services/tutorV2.service.ts`

**Replace** the top section (lines 1–17, the `V2_SYSTEM_PROMPT` constant) with:

```typescript
const V2_SYSTEM_PROMPT = `You are a tutor for ONE concept. Answer ONLY using FACTS below.
If the answer isn't in FACTS, say you can't answer from this section.
Be visual-first: prefer an analogy or a step list; cite fact ids [s1].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`;

// ── Mode-specific system prompts (Task B) ──────────────────────────
const V2_MODE_PROMPTS: Record<string, string> = {
  explain: `You are an expert teacher. Explain the following concept clearly and thoroughly.
Use analogies, step-by-step breakdowns, and concrete examples.
Assume the learner has basic knowledge but needs a clear explanation.
Ground your answer ONLY in the FACTS provided below. Cite fact ids [f1], [f2].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`,

  simpler: `You are a patient tutor simplifying a concept.
Rewrite the following in the simplest possible terms.
Use everyday language, short sentences, and relatable analogies.
A 12-year-old should be able to understand your explanation.
Ground your answer ONLY in the FACTS provided below. Cite fact ids [f1], [f2].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`,

  deeper: `You are an advanced instructor going deeper on a topic.
Provide nuanced analysis, edge cases, advanced patterns, and connections to other concepts.
Assume the learner already understands the basics and wants to go further.
Ground your answer ONLY in the FACTS provided below. Cite fact ids [f1], [f2].
Return JSON: { answer_md: string, used_source_ids: string[], used_fact_ids: string[], suggested_next?: "deeper"|"reinforce"|"remedial" }`,
};

export type TutorV2Mode = 'explain' | 'ask' | 'simpler' | 'deeper';

function resolveV2SystemPrompt(mode?: string, personaMd?: string): string {
  let base: string;
  if (mode && mode !== 'ask' && V2_MODE_PROMPTS[mode]) {
    base = V2_MODE_PROMPTS[mode];
  } else {
    base = V2_SYSTEM_PROMPT;
  }
  if (!personaMd) return base;
  return `${personaMd}\n\n---\n\n## Core Tutor Instructions\n${base}`;
}
```

**Modify the `askStream` method** to accept and use `mode`:

```typescript
  async askStream(
    params: {
      nodeId: string;
      blockId: string;
      question: string;
      convId?: string;
      mode?: TutorV2Mode;
    },
    onToken: (chunk: string) => void,
  ): Promise<Result<{ answerMd: string; citations: { id: string; url: string; title: string }[] }>> {
    try {
      const { packet, retrieval_score } = this.grounding.retrieve(params.nodeId, params.question);
      const factsText = packet.must_know.map((f, i) => `[f${i + 1}] ${f.claim}`).join('\n');
      const sourcesText = packet.sources.map((s) => `[s${s.id}] ${s.title}: ${s.url}`).join('\n');
      const userPrompt = `FACTS:\n${factsText}\n\nSOURCES:\n${sourcesText}\n\nQUESTION: ${params.question}`;

      // ── Use mode-specific system prompt (Task B) ──
      const systemPrompt = resolveV2SystemPrompt(params.mode);

      if (!this.streamAi) {
        const answerResult = await this.callAi(userPrompt, systemPrompt, 500);
        let answerMd = '';
        let usedSourceIds: string[] = [];
        try {
          const parsed = typeof answerResult === 'string' ? JSON.parse(answerResult) : answerResult;
          answerMd = parsed.answer_md || answerResult;
          usedSourceIds = parsed.used_source_ids || [];
        } catch { answerMd = typeof answerResult === 'string' ? answerResult : JSON.stringify(answerResult); }
        onToken(answerMd);
        const citations = packet.sources.filter((s) => usedSourceIds.includes(s.id)).map((s) => ({ id: s.id, url: s.url, title: s.title }));
        await this.recordMessage(params.nodeId, params.blockId, 'ai', answerMd, citations);
        return { ok: true, data: { answerMd, citations } };
      }

      let fullAnswer = '';
      const citations = await this.streamAi(userPrompt, systemPrompt, (chunk: string) => {
        fullAnswer += chunk;
        onToken(chunk);
      });
      await this.recordMessage(params.nodeId, params.blockId, 'ai', fullAnswer, []);
      return { ok: true, data: { answerMd: fullAnswer, citations: [] } };
    } catch (err: any) {
      onToken(`\n\n*Error: ${err.message}*`);
      return { ok: false, error: err.message };
    }
  }
```

**Also modify the `ask` method** (non-streaming) to accept `mode`:

```typescript
  async ask(params: {
    nodeId: string;
    blockId?: string;
    question: string;
    mode?: TutorV2Mode;
  }): Promise<Result<TutorAnswer>> {
    try {
      const cacheKey = this.hashKey(params.nodeId, params.question);
      const cached = repo.getTutorCache(this.db, cacheKey);
      if (cached) { return { ok: true, data: JSON.parse((cached as any).answer_json) }; }

      const { packet, retrieval_score, out_of_scope } = this.grounding.retrieve(params.nodeId, params.question);
      if (out_of_scope || retrieval_score < 0.35) {
        return { ok: true, data: {
          answer_md: `That question is outside the scope of this section.`,
          used_source_ids: [], used_fact_ids: [], citations: [],
          scope: packet.scope.includes,
          assessment: { target_level: 'L0', outcome: 'partial' as EvidenceOutcome, rationale: 'Out of scope', suggested_next: 'reinforce' },
          escalated: true, confidence: 0,
        }};
      }

      const factsText = packet.must_know.map((f, i) => `[f${i + 1}] ${f.claim}`).join('\n');
      const sourcesText = packet.sources.map((s) => `[s${s.id}] ${s.title}: ${s.url}`).join('\n');
      const userPrompt = `FACTS:\n${factsText}\n\nSOURCES:\n${sourcesText}\n\nQUESTION: ${params.question}`;

      // ── Use mode-specific system prompt (Task B) ──
      const systemPrompt = resolveV2SystemPrompt(params.mode);

      const answerResult = await this.callAi(userPrompt, systemPrompt, 500);
      let answerMd = '', usedSourceIds: string[] = [], usedFactIds: string[] = [];
      try {
        const parsed = typeof answerResult === 'string' ? JSON.parse(answerResult) : answerResult;
        answerMd = parsed.answer_md || answerResult;
        usedSourceIds = parsed.used_source_ids || [];
        usedFactIds = parsed.used_fact_ids || [];
      } catch { answerMd = typeof answerResult === 'string' ? answerResult : JSON.stringify(answerResult); }

      const citations = packet.sources.filter((s) => usedSourceIds.includes(s.id)).map((s) => ({ id: s.id, url: s.url, title: s.title }));
      const answer: TutorAnswer = {
        answer_md: answerMd, used_source_ids: usedSourceIds, used_fact_ids: usedFactIds,
        citations, scope: packet.scope.includes,
        assessment: { target_level: 'L1', outcome: 'partial' as EvidenceOutcome, rationale: 'Answered', suggested_next: 'deeper' },
        escalated: false, confidence: retrieval_score,
      };

      repo.setTutorCache(this.db, { key: cacheKey, node_id: params.nodeId, answer_json: JSON.stringify(answer), model: 'small', created_at: new Date().toISOString() });
      await this.recordMessage(params.nodeId, params.blockId, 'ai', answerMd, citations);
      return { ok: true, data: answer };
    } catch (err: any) { return { ok: false, error: err.message }; }
  }
```

---

## Phase 3 — IPC Handler Updates (Task B continuation + Task F)

### File: `src/services/learn/index.ts`

**Update the `learn:askTutor` handler** (line ~233) to accept `mode`:

```typescript
  ipcMain.handle('learn:askTutor', (_event, params: {
    nodeId: string;
    blockId?: string;
    question: string;
    personaMd?: string;
    mode?: 'explain' | 'ask' | 'simpler' | 'deeper';
  }) => {
    return tutor.ask(params);
  });
```

**Update the `learn:tutorStream` handler** (line ~243) to accept and forward `mode`:

```typescript
  ipcMain.handle('learn:tutorStream', async (event, params: {
    nodeId: string;
    blockId: string;
    question: string;
    convId?: string;
    mode?: 'explain' | 'ask' | 'simpler' | 'deeper';
  }) => {
    if (!streamAi) {
      // Non-streaming fallback: call ask() with mode, send full answer as single token
      const result = await tutorV2.ask({
        nodeId: params.nodeId,
        blockId: params.blockId,
        question: params.question,
        mode: params.mode,
      });
      if (result.ok) {
        event.sender.send('learn:tutorToken', {
          blockId: params.blockId,
          token: result.data.answer_md,
          done: true,
        });
      } else {
        event.sender.send('learn:tutorToken', {
          blockId: params.blockId,
          token: `Error: ${result.error}`,
          done: true,
        });
      }
      return result;
    }

    // Streaming path: forward mode to askStream
    const result = await tutorV2.askStream(
      {
        nodeId: params.nodeId,
        blockId: params.blockId,
        question: params.question,
        convId: params.convId,
        mode: params.mode,
      },
      (token: string) => {
        event.sender.send('learn:tutorToken', {
          blockId: params.blockId,
          token,
          done: false,
        });
      },
    );
    event.sender.send('learn:tutorToken', {
      blockId: params.blockId,
      token: '',
      done: true,
    });
    return result;
  });
```

**Add the `learn:getTutorConfig` handler** (Task F). Insert near the other tutor handlers (after `learn:askTutor` or at the end of the learn section). You need to reference whatever variables hold the AI provider/model in your main process setup. Adjust variable names as needed:

```typescript
  // ── Task F: Expose AI provider/model to renderer ──
  ipcMain.handle('learn:getTutorConfig', () => {
    // These variables are defined wherever the AI service is initialized
    // in this file (look for where `callAi` / `streamAi` are created).
    // Adjust the variable names below to match your setup.
    const provider = (typeof aiProvider !== 'undefined' && aiProvider) || 'unknown';
    const model = (typeof aiModel !== 'undefined' && aiModel) || 'unknown';
    return { ok: true, data: { provider, model } };
  });
```

> **Note:** If `aiProvider` / `aiModel` are not in scope at the handler location, find where the `callAi` function is constructed (search for `const callAi =` or `function callAi` in this file). The provider and model strings will be captured in that closure. Extract them to module-level `let` variables or pass them through. A minimal approach:

```typescript
// At the top of the learn module setup function, after AI config is loaded:
let _tutorProvider = 'unknown';
let _tutorModel = 'unknown';

// When initializing the AI service:
_tutorProvider = config.provider || 'unknown';
_tutorModel = config.model || 'unknown';

// In the handler:
ipcMain.handle('learn:getTutorConfig', () => {
  return { ok: true, data: { provider: _tutorProvider, model: _tutorModel } };
});
```

---

## Phase 4 — Inline Answer Card Component (Task C)

### New File: `src/components/learn/InlineAnswerCard.tsx`

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Search,
  ArrowRight,
  X,
  Loader2,
  Brain,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import DOMPurify from 'dompurify';

export type InlineMode = 'explain' | 'simpler' | 'deeper';

export interface InlineAnswerState {
  mode: InlineMode;
  text: string;
  loading: boolean;
  streamingText: string;
  error?: string;
  blockId: string;
}

interface InlineAnswerCardProps {
  state: InlineAnswerState;
  onClose: () => void;
  onRetry: () => void;
}

const MODE_CONFIG: Record<InlineMode, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  explain: {
    icon: Lightbulb,
    label: 'Explanation',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
  },
  simpler: {
    icon: Search,
    label: 'Simplified',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
  },
  deeper: {
    icon: ArrowRight,
    label: 'Going Deeper',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
  },
};

function renderMarkdown(md: string): string {
  return md
    .replace(/```(\w+)?\n([\s\S]*?)```/g,
      '<pre class="bg-zinc-800/60 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-zinc-300"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g,
      '<code class="bg-zinc-800/60 rounded px-1 py-0.5 text-sm font-mono text-cyan-300">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

export function InlineAnswerCard({ state, onClose, onRetry }: InlineAnswerCardProps) {
  const config = MODE_CONFIG[state.mode];
  const Icon = config.icon;
  const displayText = state.streamingText;
  const isThinking = state.loading && !displayText;
  const isStreaming = state.loading && !!displayText;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="my-6 overflow-hidden"
      >
        <div className={`rounded-xl border ${config.borderClass} ${config.bgClass} overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/40">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${config.colorClass}`} />
              <span className="text-sm font-medium text-zinc-200">{config.label}</span>
              {isStreaming && (
                <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />
              )}
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition"
              aria-label="Close answer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quoted selected text */}
          <div className="px-4 py-2 border-b border-zinc-700/30 bg-zinc-900/40">
            <p className="text-xs text-zinc-500 italic leading-relaxed">
              <span className="text-zinc-600">Selected: </span>"{state.text}"
            </p>
          </div>

          {/* Answer body */}
          <div className="px-4 py-4">
            {state.error ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Something went wrong</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{state.error}</p>
                  </div>
                </div>
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 text-xs font-medium transition border border-zinc-700/50 w-fit"
                >
                  <RefreshCw className="w-3 h-3" /> Try again
                </button>
              </div>
            ) : isThinking ? (
              <div className="flex items-center gap-2.5 py-1">
                <Brain className={`w-4 h-4 ${config.colorClass} animate-pulse`} />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zinc-400">Thinking</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            ) : displayText ? (
              <div
                className="text-sm text-zinc-200 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(renderMarkdown(displayText)),
                }}
              />
            ) : null}

            {/* Streaming cursor */}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## Phase 5 — LearnPage Changes (Task C + Task D + Task E)

### File: `src/components/learn/LearnPage.tsx`

**Add imports** at the top:

```tsx
import { InlineAnswerCard, type InlineAnswerState, type InlineMode } from './InlineAnswerCard';
```

**Add state for inline answers** (near the existing tutor state declarations):

```tsx
  // ── Inline answer state (Explain/Simpler/Deeper) ──
  const [inlineAnswer, setInlineAnswer] = useState<InlineAnswerState | null>(null);
  const inlineStreamCleanup = useRef<(() => void) | null>(null);

  // ── Tutor config (Task F) ──
  const [tutorConfig, setTutorConfig] = useState<{ provider: string; model: string } | null>(null);
```

**Add a `useEffect` to fetch tutor config** (Task F):

```tsx
  useEffect(() => {
    if (api?.learnGetTutorConfig) {
      api.learnGetTutorConfig()
        .then((res: any) => {
          if (res?.ok && res.data) {
            setTutorConfig(res.data);
          }
        })
        .catch(() => {});
    }
  }, []);
```

**Add cleanup effect for inline stream listener:**

```tsx
  useEffect(() => {
    return () => {
      inlineStreamCleanup.current?.();
    };
  }, []);
```

**Replace `handleSelectionAsk`** (currently at line ~311). The new version branches: `ask` mode opens the chat panel; `explain`/`simpler`/`deeper` modes trigger inline streaming:

```tsx
  const handleSelectionAsk = useCallback((text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper') => {
    if (!selectedNode) return;

    if (mode === 'ask') {
      // ── Ask mode: open chat panel with selected text pre-filled ──
      // User can edit the question before submitting
      setTutorOpen(true);
      setTutorQuestion(text);
      return;
    }

    // ── Explain / Simpler / Deeper: inline streaming answer ──
    startInlineAnswer(selectedNode, text, mode as InlineMode);
  }, [selectedNode, startInlineAnswer]);
```

**Add the `startInlineAnswer` function:**

```tsx
  const startInlineAnswer = useCallback(async (nodeId: string, text: string, mode: InlineMode) => {
    // Clean up any previous inline stream
    inlineStreamCleanup.current?.();
    inlineStreamCleanup.current = null;

    const blockId = `inline-${mode}-${Date.now()}`;

    setInlineAnswer({
      mode,
      text,
      loading: true,
      streamingText: '',
      blockId,
    });

    // Register token listener
    const unsub = api.onTutorToken((data: { blockId: string; token: string; done: boolean }) => {
      if (data.blockId !== blockId) return;

      if (data.done) {
        setInlineAnswer(prev =>
          prev ? { ...prev, loading: false } : prev,
        );
        return;
      }

      if (data.token) {
        setInlineAnswer(prev =>
          prev
            ? { ...prev, streamingText: prev.streamingText + data.token }
            : prev,
        );
      }
    });
    inlineStreamCleanup.current = unsub;

    try {
      const result = await api.learnTutorStream({
        nodeId,
        blockId,
        question: text,
        mode,
      });

      if (!result?.ok) {
        setInlineAnswer(prev =>
          prev
            ? { ...prev, loading: false, error: result?.error || 'Failed to get answer' }
            : prev,
        );
      }
    } catch (err: any) {
      setInlineAnswer(prev =>
        prev
          ? { ...prev, loading: false, error: err?.message || 'Stream error' }
          : prev,
      );
    }
    // Note: do NOT call unsub here — the done token may not have arrived yet.
    // The listener will be cleaned up when the component unmounts or when
    // the user closes the inline answer.
  }, []);
```

**Add `handleCloseInlineAnswer`:**

```tsx
  const handleCloseInlineAnswer = useCallback(() => {
    inlineStreamCleanup.current?.();
    inlineStreamCleanup.current = null;
    setInlineAnswer(null);
  }, []);
```

**Add `handleRetryInlineAnswer`:**

```tsx
  const handleRetryInlineAnswer = useCallback(() => {
    if (!inlineAnswer || !selectedNode) return;
    startInlineAnswer(selectedNode, inlineAnswer.text, inlineAnswer.mode);
  }, [inlineAnswer, selectedNode, startInlineAnswer]);
```

**Update `handleAskTutor`** to pass `mode: 'ask'`:

```tsx
  const handleAskTutor = useCallback(async (nodeId: string, question: string) => {
    setTutorOpen(true);
    setTutorQuestion(question);
    setTutorLoading(true);
    try {
      const result = await api.learnAskTutor({ nodeId, question, mode: 'ask' });
      if (result.ok) { setTutorAnswer(result.data); }
    } catch (err: any) {
      setTutorAnswer({
        answer_md: `Error: ${err.message}`, used_source_ids: [], used_fact_ids: [], citations: [], scope: '',
        assessment: { target_level: 'L0' as MasteryLevel, outcome: 'wrong', rationale: err.message, suggested_next: 'reinforce' },
        escalated: false, confidence: 0,
      });
    } finally { setTutorLoading(false); }
  }, []);
```

**Render the `InlineAnswerCard`** in the reader content area. Find where the node content/blocks are rendered and add the card after the content:

```tsx
  {/* ... existing reader content rendering ... */}

  {/* ── Inline AI answer card (Explain/Simpler/Deeper) ── */}
  {inlineAnswer && (
    <InlineAnswerCard
      state={inlineAnswer}
      onClose={handleCloseInlineAnswer}
      onRetry={handleRetryInlineAnswer}
    />
  )}
```

**Pass `tutorConfig` to TutorPanel:**

```tsx
  <TutorPanel
    open={tutorOpen}
    onToggle={setTutorOpen}
    nodeId={selectedNode}
    question={tutorQuestion}
    onQuestionChange={setTutorQuestion}
    answer={tutorAnswer}
    loading={tutorLoading}
    onAsk={handleAskTutor}
    tutorConfig={tutorConfig}  // ← NEW PROP
  />
```

---

## Phase 6 — TutorPanel Changes (Task C + Task F)

### File: `src/components/learn/TutorPanel.tsx`

**Update the `Props` interface** to accept `tutorConfig`:

```tsx
interface Props {
  open: boolean;
  onToggle: (v: boolean) => void;
  nodeId: string;
  question: string;
  onQuestionChange: (v: string) => void;
  answer?: TutorAnswer | null;
  loading?: boolean;
  onAsk?: (nodeId: string, question: string) => void;
  tutorConfig?: { provider: string; model: string } | null;
}
```

**Update the component signature** to destructure `tutorConfig`:

```tsx
export function TutorPanel({
  open,
  onToggle,
  nodeId,
  question,
  onQuestionChange,
  answer: v1Answer,
  loading: v1Loading,
  onAsk,
  tutorConfig,
}: Props) {
```

**Update the V2 streaming call** in `handleSubmitV2` to pass `mode: 'ask'`:

```tsx
  const handleSubmitV2 = useCallback(async (q: string) => {
    cleanupRef.current?.();
    setV2Streaming(true);
    setV2State('streaming');
    setV2Answer('');
    setV2Error('');
    setLastQuestion(q);
    setShowSuggestions(false);

    const blockId = `tutor-chat-${Date.now()}`;

    const unsub = api.onTutorToken((data: { blockId: string; token: string; done: boolean }) => {
      if (data.blockId !== blockId) return;
      if (data.done) {
        setV2Streaming(false);
        // Use functional update to avoid stale closure on v2Answer
        setV2Answer(prev => {
          setV2State(prev.length > 0 ? 'grounded' : 'error');
          if (prev.length === 0) setV2Error('Empty response');
          return prev;
        });
        return;
      }
      setV2Answer(prev => prev + data.token);
    });
    cleanupRef.current = unsub;

    try {
      const result = await api.learnTutorStream({
        nodeId,
        blockId,
        question: q,
        mode: 'ask',  // ← Chat panel is always 'ask' mode
      });
      if (!result || !result.ok) {
        setV2Streaming(false);
        setV2State('error');
        setV2Error(result?.error || 'Failed to start stream');
      }
    } catch (err: any) {
      setV2Streaming(false);
      setV2State('error');
      setV2Error(err?.message || 'Stream error');
    }
  }, [nodeId]);
```

> **Critical fix:** The original `handleSubmitV2` had a stale closure bug — `v2Answer` was read inside the `onTutorToken` callback but was captured at callback creation time, so the `done` check always saw the initial empty string. The fix uses `setV2Answer(prev => ...)` functional update to read the latest value.

**Add the provider/model info line** in the header area. Find the header div (the one with `border-b border-zinc-800 shrink-0`) and add a config line below it:

```tsx
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-400" />
          Tutor
          {supportsV2 && (
            <span className="px-1 py-0.5 rounded bg-amber-500/15 text-[9px] text-amber-400 font-medium uppercase">
              V2
            </span>
          )}
        </span>
        <button
          onClick={() => {
            onToggle(false);
            setShowSuggestions(true);
            setV2State('idle');
            setV2Answer('');
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition"
          aria-label="Close tutor panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Task F: Provider/Model info ── */}
      {tutorConfig && (
        <div className="px-4 py-1.5 border-b border-zinc-800/50 bg-zinc-900/40 shrink-0">
          <p className="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500/60" />
            Powered by{' '}
            <span className="text-zinc-400 font-medium">{tutorConfig.provider}</span>
            {' · '}
            <span className="text-zinc-400 font-medium">{tutorConfig.model}</span>
          </p>
        </div>
      )}
```

**Update the suggestions** to be question-focused (since Explain/Simpler/Deeper are now inline, the chat panel is only for free-form questions):

```tsx
const SUGGESTIONS = [
  'What is the main idea of this lesson?',
  'Can you give me a concrete example?',
  'How does this connect to what I already know?',
  'What should I focus on to master this?',
];
```

**Verify the grounded V2 rendering path.** The current code at line ~258 has a condition:
```
displayState === 'grounded' && v1Answer && !v1Answer.escalated && !supportsV2
```
This is the V1-only path. After wiring bridges, `supportsV2` is `true`, so this path is correctly skipped. The V2 grounded path at line ~265 handles the display:
```
displayState === 'grounded' && displayAnswer && !(...)
```
This will now work because `displayAnswer` will contain the streamed `v2Answer`. No change needed here — the fix is that `supportsV2` is now `true` and `v2Answer` gets populated via streaming.

---

## Phase 7 — ReaderView Wiring (Task D + Task E)

### File: `src/components/learn/ReaderView.tsx` (or wherever SelectionActions is rendered)

This file is not in the context bundle, but based on the component interfaces, the wiring should look like this. **Verify and fix the `SelectionActions` usage:**

```tsx
import { SelectionActions } from './SelectionActions';
import { useHighlights } from './useHighlights';

// Inside the component that renders the reader content:

const {
  highlights,
  createHighlight,
  deleteHighlight,
} = useHighlights({ lessonId, partSlug });

const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

// ── Task D: Highlight creation wiring ──
const handleCreateHighlight = useCallback(
  (text: string, startOffset: number, endOffset: number, color: Highlight['color']) => {
    createHighlight(text, startOffset, endOffset, color);
  },
  [createHighlight],
);

// ── Task E: Note creation wiring ──
const handleCreateNote = useCallback(
  (text: string, startOffset: number, endOffset: number) => {
    if (!selectedNode) return;
    // Use the preload bridge (now wired in Phase 1)
    api.learnAddNote({
      nodeId: selectedNode,
      text,
      blockRef: `text-${startOffset}-${endOffset}`,
    }).then((result: any) => {
      if (result?.ok) {
        // Optionally refresh notes list
        // Or show a toast notification
      }
    }).catch(() => {});
  },
  [selectedNode],
);

// ── Tutor mode wiring ──
const handleAskTutor = useCallback(
  (text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper') => {
    // This calls the LearnPage's handleSelectionAsk
    onAskTutor(text, mode);
  },
  [onAskTutor],
);

// Render:
<div ref={contentRef} className="reader-content">
  {/* ... node content ... */}
</div>

<SelectionActions
  containerRef={contentRef}
  onCreateHighlight={handleCreateHighlight}
  onCreateNote={handleCreateNote}
  onDeleteHighlight={deleteHighlight}
  selectedHighlightId={selectedHighlightId}
  onAskTutor={handleAskTutor}
/>
```

**Key verification points for highlights (Task D):**

1. `SelectionActions` calls `onCreateHighlight(text, startOffset, endOffset, color)` when a color is picked
2. `onCreateHighlight` is wired to `useHighlights.createHighlight`
3. `createHighlight` calls `addHighlight()` from `highlightAnchor.ts`
4. `addHighlight()` writes to `localStorage` under key `lyceum-highlights`
5. The highlight should then be rendered in the content area (verify that `highlights` from `useHighlights` are applied to the DOM — typically by wrapping highlighted text ranges in `<mark>` elements)

**If highlights are stored but not visually rendered**, you need a highlight renderer. Add this to the reader content rendering:

```tsx
// After rendering the raw content, apply highlights to the DOM
useEffect(() => {
  if (!contentRef.current || highlights.length === 0) return;

  const container = contentRef.current;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  // Calculate cumulative offsets and wrap highlighted ranges
  let offset = 0;
  for (const textNode of textNodes) {
    const nodeLength = textNode.textContent?.length || 0;
    const nodeStart = offset;
    const nodeEnd = offset + nodeLength;

    for (const hl of highlights) {
      if (hl.endOffset <= nodeStart || hl.startOffset >= nodeEnd) continue;

      // This range overlaps this text node — wrap it
      const intersectStart = Math.max(hl.startOffset, nodeStart) - nodeStart;
      const intersectEnd = Math.min(hl.endOffset, nodeEnd) - nodeStart;

      try {
        const range = document.createRange();
        range.setStart(textNode, intersectStart);
        range.setEnd(textNode, intersectEnd);
        const mark = document.createElement('mark');
        mark.className = `hl-${hl.color}`;
        mark.dataset.highlightId = hl.id;
        mark.style.backgroundColor = getColorCss(hl.color);
        mark.style.padding = '0 1px';
        mark.style.borderRadius = '2px';
        range.surroundContents(mark);
      } catch {
        // Range may be invalid if DOM was already modified
      }
    }

    offset = nodeEnd;
  }
}, [highlights, contentRef.current]);
```

With a color helper:
```tsx
function getColorCss(color: string): string {
  const map: Record<string, string> = {
    yellow: 'rgba(234, 179, 8, 0.25)',
    green: 'rgba(34, 197, 94, 0.25)',
    blue: 'rgba(59, 130, 246, 0.25)',
    pink: 'rgba(236, 72, 153, 0.25)',
    orange: 'rgba(249, 115, 22, 0.25)',
  };
  return map[color] || map.yellow;
}
```

---

## Phase 8 — Notes UI Refresh (Task E)

### File: `src/components/learn/LearnPage.tsx`

After wiring the preload bridge, `handleAddNote`, `handleDeleteNote`, and `handleTogglePin` already exist (lines 365-380). They call `api.learnAddNote`, `api.learnDeleteNote`, and `api.learnToggleNotePin` respectively. **These will now work** because the preload bridges are wired.

**Add a notes refresh mechanism.** After creating/deleting/pinning a note, refresh the notes list:

```tsx
  const [notes, setNotes] = useState<any[]>([]);

  const refreshNotes = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const result = await api.learnGetNotes({ nodeId: selectedNode });
      if (result?.ok) {
        setNotes(result.data);
      }
    } catch {}
  }, [selectedNode]);

  // Refresh notes when node changes
  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  // Update handlers to refresh after mutation
  const handleAddNote = useCallback(async (blockId: string, text: string) => {
    if (!selectedNode) return;
    try {
      await api.learnAddNote({ nodeId: selectedNode, text, blockRef: blockId });
      await refreshNotes();
    } catch {}
  }, [selectedNode, refreshNotes]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await api.learnDeleteNote({ noteId });
      await refreshNotes();
    } catch {}
  }, [refreshNotes]);

  const handleTogglePin = useCallback(async (noteId: string) => {
    try {
      const note = notes.find((n) => n?.id === noteId);
      await api.learnToggleNotePin({ noteId, pinned: !note?.pinned });
      await refreshNotes();
    } catch {}
  }, [notes, refreshNotes]);
```

---

## Verification Checklist

Run through each item after applying all changes:

### 1. Preload Bridges (14 + 1)
```
grep -c "learnTutorStream\|onTutorToken\|learnAddNote\|learnGetNotes\|learnGetAllNotes\|learnDeleteNote\|learnToggleNotePin\|learnCreateProposal\|learnDecideProposal\|learnStartConversation\|learnAddMessage\|learnGetConversation\|learnResolveConversation\|learnGetTutorDashboard\|learnGetTutorConfig" src/preload.ts
```
Expected: **15** matches (14 required + 1 for tutor config).

### 2. V2 Detection
In `TutorPanel.tsx`, after bridges are wired:
- `api.learnTutorStream` is a function → truthy
- `api.onTutorToken` is a function → truthy
- `supportsV2 = true`
- V2 streaming path is active

### 3. Mode-Specific Prompts
Verify in `tutor.service.ts`:
- `MODE_SYSTEM_PROMPTS` object exists with `explain`, `simpler`, `deeper` keys
- `resolveSystemPrompt()` function exists and selects mode prompt when mode ≠ 'ask'
- `ask()` method accepts `mode` parameter

Verify in `tutorV2.service.ts`:
- `V2_MODE_PROMPTS` object exists
- `resolveV2SystemPrompt()` function exists
- Both `ask()` and `askStream()` accept `mode` parameter

### 4. IPC Handler Mode Forwarding
Verify in `index.ts`:
- `learn:askTutor` handler params type includes `mode?`
- `learn:tutorStream` handler params type includes `mode?`
- Both pass `mode` through to service methods

### 5. Inline Answer Card
- `InlineAnswerCard.tsx` exists in `src/components/learn/`
- Imported in `LearnPage.tsx`
- Rendered after reader content when `inlineAnswer` is not null
- Shows "Thinking..." animation before first token
- Shows streaming text with cursor during streaming
- Shows error with retry button on failure
- Close button clears state and unsubscribes listener

### 6. Chat Panel (Ask Mode Only)
- `handleSelectionAsk` with `mode === 'ask'` opens TutorPanel and pre-fills question
- `handleSelectionAsk` with `mode !== 'ask'` calls `startInlineAnswer`
- TutorPanel's `handleSubmitV2` passes `mode: 'ask'` to `learnTutorStream`
- TutorPanel shows suggestions for free-form questions only
- Provider/model info line appears below header when `tutorConfig` is loaded

### 7. System Prompt Never Visible
- System prompt is only passed to `callAi`/`streamAi` as the second argument
- Never stored in component state
- Never rendered in any component
- Never sent to renderer via IPC (only the answer tokens are sent)

### 8. Highlights
- `SelectionActions.onCreateHighlight` → `useHighlights.createHighlight` → `highlightAnchor.addHighlight` → `localStorage`
- Highlights render as `<mark>` elements in the reader content
- Delete highlight removes from localStorage and updates state

### 9. Notes
- `api.learnAddNote()` → IPC `learn:addNote` → `noteService.addNote()` → `repo.insertNote()` → SQLite
- `api.learnGetNotes()` → IPC `learn:getNotes` → `noteService.getNotesForNode()` → SQLite → returns notes array
- `api.learnDeleteNote()` → IPC `learn:deleteNote` → `noteService.deleteNote()` → SQLite
- `api.learnToggleNotePin()` → IPC `learn:toggleNotePin` → `noteService.togglePin()` → SQLite
- UI refreshes after each mutation via `refreshNotes()`

### 10. Provider/Model Info
- IPC handler `learn:getTutorConfig` returns `{ ok: true, data: { provider, model } }`
- Preload bridge `learnGetTutorConfig` invokes the handler
- `LearnPage` fetches config on mount and passes to `TutorPanel`
- `TutorPanel` renders "Powered by {provider} · {model}" below header

### 11. Build
```bash
npm run build
# or
yarn build
```
Should complete with zero TypeScript errors. Common issues to watch for:
- Ensure `useRef` is imported in `LearnPage.tsx` (for `inlineStreamCleanup`)
- Ensure `InlineMode` type is exported from `InlineAnswerCard.tsx`
- Ensure `tutorConfig` prop is added to `TutorPanel` Props interface

---

## Change Summary by File

| File | Changes |
|------|---------|
| `src/preload.ts` | +15 bridge definitions (14 required + tutor config) |
| `src/services/learn/services/tutor.service.ts` | +`MODE_SYSTEM_PROMPTS`, +`resolveSystemPrompt()`, `ask()` accepts `mode` |
| `src/services/learn/services/tutorV2.service.ts` | +`V2_MODE_PROMPTS`, +`resolveV2SystemPrompt()`, `ask()` and `askStream()` accept `mode` |
| `src/services/learn/index.ts` | `learn:askTutor` and `learn:tutorStream` accept/forward `mode`, +`learn:getTutorConfig` handler |
| `src/components/learn/InlineAnswerCard.tsx` | **NEW FILE** — inline answer rendering with thinking/streaming/error states |
| `src/components/learn/LearnPage.tsx` | +inline answer state, +`startInlineAnswer`, +`handleCloseInlineAnswer`, +`handleRetryInlineAnswer`, +tutor config fetch, `handleSelectionAsk` branches by mode, +notes refresh, render `InlineAnswerCard` |
| `src/components/learn/TutorPanel.tsx` | +`tutorConfig` prop, +provider/model info line, `handleSubmitV2` passes `mode: 'ask'`, fix stale closure bug in token callback, update suggestions |
| `src/components/learn/ReaderView.tsx` | Verify `SelectionActions` wiring (highlights, notes, tutor), add highlight DOM rendering |
# CONTEXT_BUNDLE — Terminal Handbook: Full AI + Interactive Practice

> This bundle replaces the target AI's need to read the codebase. All source is verbatim.

---

## 1. Design Tokens (terminal-handbook.html root CSS, lines 8–29)

```css
:root {
  --bg:#0a0e14; --bg2:#0d1219; --panel:#11161f; --panel2:#161d29;
  --line:#1f2836; --line2:#2a3547; --txt:#dbe4ee; --dim:#7d8aa0; --faint:#54617a;
  --grn:#7ee787; --grn-dim:rgba(126,231,135,.12);
  --blu:#79c0ff; --amb:#ffa657; --amb-dim:rgba(255,166,87,.12);
  --red:#ff7b72; --red-dim:rgba(255,123,114,.10);
  --pur:#d2a8ff; --pur-dim:rgba(210,168,255,.12);
  --mono:"Cascadia Code","JetBrains Mono","SF Mono",Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;
}
```

Depth badge colors: `core`=#79c0ff, `daily`=#7ee787, `power`=#d2a8ff, `rescue`=#ff7b72, `sudo`=#ffa657.

---

## 2. Data Layer — handbook-data.ts (full, lines 1–125)

**File:** `src/services/learn/handbook-data.ts`

Interfaces:
```ts
export interface CommandParam {
  base: string; subcommands: string[];
  flags: Array<{ flag: string; value: string | null; short?: boolean }>;
  args: Array<{ type: string; value: string }>;
  pipe_to?: string | null; is_sudo?: boolean;
}
export interface HandbookCommand {
  section: string; sectionTitle: string; sectionNum: string;
  command: string; isRoot: boolean;
  depth: 'core' | 'daily' | 'power' | 'rescue' | 'sudo';
  badges: Array<{ type: string; label: string }>;
  description: string; whenToUse: string; gotchas: string[]; notes: string[];
  params: CommandParam; rows?: Array<{ tag: string; value: string }>;
}
export interface HandbookSection {
  id: string; number: string; title: string; crumb: string; why: string;
  commands: HandbookCommand[];
  callouts: Array<{ type: 'tip' | 'danger'; title: string; body: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
}
export interface HandbookData {
  title: string; subtitle: string; sections: HandbookSection[]; commands: HandbookCommand[];
  stats: { totalSections: number; totalCommands: number; depthCounts: Record<string, number> };
}
```

Data source: `agent/docs/terminal-handbook-data.json`, lazy-loaded via dynamic import with `_cache`. Exports: `getHandbookData()`, `getSection(id)`, `getSectionByNumber(num)`, `getCommandsByDepth(depth)`, `searchHandbook(query)`, `peekData()`, `extractParamParts(cmd)`.

---

## 3. AI Agent — handbookPromptAgent.ts (full, lines 1–187)

**File:** `src/agents/handbookPromptAgent.ts`

Uses `deskflowAPI.learnAiChat` IPC (`learn:aiChat`). `explainCommand()` sends `{ command, section, commandData, chatHistory, userLevel }` and returns `HandbookCommandResponse`.

```ts
export interface HandbookCommandResponse {
  type: 'handbook_command_response'; version: string; command: string; title: string;
  estimatedMinutes: number;
  explanation: { what: string; when: string; gotcha?: string };
  params: Array<{ flag?: string; arg?: string; meaning: string; type: string }>;
  safety: { level: 'safe' | 'careful' | 'destructive'; note: string };
  exercises: Array<{ title: string; command: string; explanation: string }>;
  related: Array<{ command: string; relation: string }>;
  contextUsed: { chatHistoryLength: number; sectionId: string; userLevel: string };
}
```

Validator: `isHandbookResponse(data)` checks `data?.type === 'handbook_command_response'`. Uses `extractJsonFromResponse` from `./terminal-learn-prompt`. SYSTEM_PROMPT: "Handbook Command Parser... generates a structured learning aid that renders as interactive UI cards".

---

## 4. IPC Wiring — learn:aiChat handler (services/learn/index.ts:341–355)

```ts
ipcMain.handle('learn:aiChat', async (_event, { systemPrompt, messages }) => {
  const userMsg = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
  const raw = await callAi(userMsg, systemPrompt, 4000);
  return { ok: true, data: raw };
});
```

**Preload bridge** (`src/preload.ts:1454–1455`):
```ts
learnAiChat: (params) => ipcRenderer.invoke('learn:aiChat', params),
```

---

## 5. Backend Verification — ALL PRACTICE IPC CHANNELS (verified real)

| Channel | Location | Status |
|---------|----------|--------|
| `learn:runCode` | `services/learn/index.ts:1460` | ✅ Real — runs shell/python/js via `child_process` in `/tmp/lyceum-run`, 15s timeout, scratch cleanup |
| `learn:submitQuiz` | `services/learn/index.ts:229` | ✅ Real — `tutor.service.ts` grades mcq/numeric/open against answer_key/rubric |
| `learn:getDueCards` | `services/learn/index.ts:614` | ✅ Real — SRS flashcard retrieval |
| `learn:submitCardReview` | `services/learn/index.ts:618` | ✅ Real — records card review rating |
| `learn:generateCards` | `services/learn/index.ts:622` | ✅ Real — generates flashcards from node content |
| `learn:getProgress` | `services/learn/index.ts:325` | ✅ Real — returns node progress |
| `learn:getDueReviews` | `services/learn/index.ts:330` | ✅ Real — spaced repetition reviews |
| `learn:getStreak` | `services/learn/index.ts:1343` | ✅ Real — current streak |
| `learn:getAchievements` | `services/learn/index.ts:1353` | ✅ Real — achievement unlocks |
| `learn:getProfile`/`setProfile` | `services/learn/index.ts:595–607` | ✅ Real — knowledge base (`lyceum.learnerProfile.v1`) |
| `learn:addNote` | `services/learn/index.ts:287` | ✅ Real — per-node notes |
| `learn:timerStart`/`timerStop` | `services/learn/index.ts:1194–1225` | ✅ Real — records `quizzesTaken`, `cardsReviewed`, `masteryGained` per session |
| `learn:aiChat` | `services/learn/index.ts:341` | ✅ Real — generic AI chat |

**No backend gaps.** All features have real IPC channels.

---

## 6. Current UI Component — HandbookWorkspace.tsx (685 lines, full)

**File:** `src/components/learn/HandbookWorkspace.tsx`

Structure:
- Props: none (self-contained with `useState` for data, loading, query, activeSection, aiLoadingCmd, aiResponse, aiErrorCmd, expandedCmd, scrollPct, showTop)
- `DEPTH_STYLES` object maps depth → {color, bg, border, dot, label} with hardcoded hex
- `TypingTerminal` component: animated terminal script with `$ ` prompt, pulsing cursor, green output
- `Badge` component: depth badge with colored dot
- `CommandCard` component: shows command, badges, copy button, "explain" button, AI response expansion (explanation, params, safety, exercises, related)
- `SectionDetail`: section header + back button + CommandCard list
- `HandbookWorkspace`: sidebar (nav sections, depth legend) + main (hero with typing terminal, sticky search with `/` shortcut, sections list, scroll progress bar, scroll-to-top button, footer)
- State: `data` loaded via `getHandbookData()`, `query` for grep search, `activeSection` for detail view
- AI: `handleExplain(cmd, section)` calls `explainCommand()`, sets `aiResponse`
- Interactions: copy command (`navigator.clipboard`), `/` search shortcut, Escape to blur, scroll-to-top, scroll progress bar

**Missing for interactive practice:** No practice terminal input, no command execution, no quiz cards, no flashcard study, no progress persistence from practice.

---

## 7. Navigation — TerminalPage.tsx (handbook rendering, lines ~4230–4249)

```tsx
{activeGroup === 'handbook' && (
  <WorkspaceShell
    tabs={['handbook-sections', 'handbook-reference']}
    ...
  />
)}
```

`activeGroup` state (line 612), persisted to `localStorage['terminal-activeGroup']`. WorkspaceGroupRail defined at `src/components/workspace/WorkspaceGroupRail.tsx:32`: `{ key: 'handbook', icon: Terminal, label: 'Handbook', accent: 'emerald', accentHex: '#10b981' }`.

---

## 8. MCP Component Inventory (anti-slop)

| Component | Source | Use for |
|-----------|--------|---------|
| `terminal` | Magic UI | Terminal chrome window |
| `animated-beam` | Magic UI | Section connection animations |
| `border-beam` | Magic UI | Section highlight on completion |
| `shimmer-button` | Magic UI | Practice start / quiz submit |
| `terminal-demo` | Magic UI | Terminal with animated text |
| `card` | shadcn | Exercise/quiz cards |
| `dialog` | shadcn | Practice modal, quiz overlay |
| `tabs` | shadcn | Practice/Study subtabs |
| `input` | shadcn | Command input field |
| `button` | shadcn | All interactive controls |
| `Badge` | shadcn | Depth badges (custom Tailwind) |
| `Sparkles`, `Terminal`, `ArrowUp`, `Copy`, `AlertTriangle` | Lucide | Existing + new icons |
| `kbd` | Tailwind | Keyboard shortcut badges |

# 5. Integration Plan — Handbook AI Command Explainer

## Location in App
- **Primary**: Terminal workspace → Handbook group (emerald accent)
- **Component**: `HandbookWorkspace.tsx` with AI explain feature
- **Route**: `/terminal` → click Handbook icon in sidebar rail

## Data Sources
| Source | Direction | Purpose |
|--------|-----------|---------|
| `agent/docs/terminal-handbook-data.json` | read | Static handbook data |
| `deskflowAPI.learnAiChat(params)` | write | Send command + context to AI for explanation |
| Session context (optional) | read | Recent terminal commands for context |

## IPC Calls Used
| Call | Direction | Purpose |
|------|-----------|---------|
| `learnAiChat({ systemPrompt, messages })` | write | Send command to AI for structured explanation |

## Trigger
- **Manual**: User clicks "explain" button on command card
- **Expand**: Card expands inline with AI response (no modal)

## Dependencies
- Learn module IPC (`learnAiChat`) — must be functional
- Handbook data JSON — parsed from HTML
- TerminalPage handbook group — must exist

## Fallback Behavior
- If AI unavailable: show error text in card with retry button
- If parse fails: show raw output with copy button
- If no context: send without chat history

## File Structure
```
agent/agents/handbook-prompt/
├── prompt.md              # System prompt (created)
└── schema.ts              # TypeScript interfaces (created)

src/components/learn/
└── HandbookWorkspace.tsx  # Main component with AI feature (updated)

src/main/
└── handbook-ipc.ts        # Optional: dedicated IPC handler (if needed)
```

## Implementation Steps

### Phase A: Scaffold (done)
1. [x] Create agent prompt file
2. [x] Define parsing schema
3. [x] Create HandbookWorkspace component with AI feature

### Phase B: Integration
4. [ ] Wire `learnAiChat` IPC in component
5. [ ] Add JSON/YAML parser for AI response
6. [ ] Add expandable card UI for response
7. [ ] Add error boundary with retry

### Phase C: Guardrails
8. [ ] Add output validator using schema.ts
9. [ ] Add rate limiting (debounce clicks)
10. [ ] Add loading states

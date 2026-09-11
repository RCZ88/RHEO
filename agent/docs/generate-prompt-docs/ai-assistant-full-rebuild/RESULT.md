I'll generate a comprehensive, production-ready prompt that covers every subsystem, component, interaction pattern, and design specification for the AI Assistant rebuild. This will be a single document you can hand to any implementation team.

---

# AI Assistant Chat System — Full Rebuild Prompt

## 1. Executive Summary

Rebuild the AI Assistant chat subsystem (`/ai` route) into a fully functional, visually polished, and robust conversational interface. The system must handle streaming AI responses, parse structured output (including `<thought>` reasoning tags), render interactive response cards, manage session persistence, and provide a complete permission/safety layer.

**Critical Context:** All backend IPC handlers, database schema, and provider infrastructure already exist and work. This is a **frontend-only rebuild** using existing IPC endpoints. Do not create new IPC handlers or modify the backend database schema.

---

## 2. Architecture & Component Hierarchy

The component tree is fixed. You must implement within this structure:

```
AiPage.tsx (route: /ai)
  └─ AiPageDeck.tsx (layout: topbar + chat + expandable cards)
       ├─ ChatPanel.tsx (message list + input + thinking indicator)
       │    ├─ ChatEmptyState.tsx (greeting + suggestion chips)
       │    ├─ MessageBubble.tsx (user/assistant bubbles + markdown + parsed cards)
       │    │    ├─ TypewriterText.tsx (streaming text reveal with markdown)
       │    │    ├─ ThoughtSection.tsx (NEW: collapsible reasoning blocks)
       │    │    ├─ MarkdownRenderer.tsx (NEW: extracted markdown renderer)
       │    │    ├─ ParsedMessageRouter.tsx (routes parsed type → renderer)
       │    │    │    ├─ GoalSuggestionCard.tsx (Accept/Dismiss)
       │    │    │    ├─ PlanUpdateCard.tsx (animated diff)
       │    │    │    ├─ StatsSummaryCard.tsx (metric grid)
       │    │    │    ├─ ActionListCard.tsx (action buttons + confirmation)
       │    │    │    ├─ DigestTopicCard.tsx (collapsible topic)
       │    │    │    ├─ ConnectorStatusCard.tsx (status grid)
       │    │    │    ├─ FormFillCard.tsx (inline form)
       │    │    │    ├─ ChartDataCard.tsx (chart)
       │    │    │    └─ ErrorCard.tsx (error with retry)
       │    ├─ ThinkingIndicator.tsx (3-dot pulse during inference)
       │    ├─ ChatInput.tsx (textarea + slash commands + voice + history nav)
       │    ├─ SlashCommandPalette.tsx (command dropdown)
       │    ├─ AgentProgressBar.tsx (tool progress)
       │    └─ CharCountRing.tsx
       ├─ ExpandableCard (Daily Digest, Connectors, Focus, Plan, Reflect)
       └─ deck.css (all styling)
```

---

## 3. Data Flow & State Management

```
User types → ChatInput.onChange → useAiChat.setInput
User sends (Enter/Click) → useAiChat.send()
  → buildContextBundleDetailed() (system prompt with app data)
  → provider-chat-call IPC → streaming chunks via onProviderChunk
  → parseAssistantContent() → detect parsed_json → render via ParsedMessageRouter
  → persist() → ai-chat:save IPC → SQLite (ai_chat_messages + ai_chat_threads)
  → extractMemories() → ai-chat:extract-memories IPC
```

**State Management Requirements:**
- `useAiChat` hook manages: `messages`, `input`, `isLoading`, `isStreaming`, `currentThread`, `threads`, `autoApprove`
- Messages array: `ChatMsg[]` with `{ id, role, content, parsed_json?, created_at }`
- Thread identified by `thread_date` (YYYY-MM-DD format)
- Auto-approve toggle: persisted in localStorage (key: `ai-chat-auto-approve`, default: `false`)

---

## 4. IPC Endpoints (EXISTING — Do Not Create New Ones)

### Chat System
| Channel | Purpose |
|---------|---------|
| `provider-chat-call` | Streaming AI call with onChunk callback |
| `provider-chat-basic` | Non-streaming AI call |
| `ai-chat:save` | Save thread messages to SQLite |
| `ai-chat:load` | Load thread messages from SQLite |
| `ai-chat:reset` | Delete thread messages |
| `ai-chat:list-threads` | List all threads (returns `{ success: true, threads: [...] }`) |
| `ai-chat:get-memories` | Get memories for a thread |
| `ai-chat:extract-memories` | Extract memories from conversation |

### Provider System
| Channel | Purpose |
|---------|---------|
| `get-ai-providers` | Get all providers + routing config |
| `test-ai-provider` | Test a provider with a ping message |
| `set-ai-providers` | Save provider config |

### App Data (for context bundle)
| Channel | Purpose |
|---------|---------|
| `getGoals` | Get today's goals |
| `saveGoal` | Create/update goal |
| `suggestGoals` | AI suggests goals |
| `getLongtermGoals` | Get long-term goals |
| `getDashboardAggregates` | Today's usage stats |
| `getAIUsageSummary` | AI token/cost usage |
| `getProjects` | Active projects |
| `getTopicDigest` | Daily digest topics |
| `connectors:list` | List connectors |
| `connectors:sync` | Sync a connector |

---

## 5. Database Schema (EXISTING — Do Not Modify)

```sql
-- Chat threads
CREATE TABLE ai_chat_threads (
  thread_date TEXT PRIMARY KEY,
  title TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at INTEGER,
  preview TEXT,
  updated_at INTEGER
);

-- Chat messages
CREATE TABLE ai_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_date TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  parsed_json TEXT,
  created_at TEXT,
  FOREIGN KEY (thread_date) REFERENCES ai_chat_threads(thread_date)
);

-- Chat memories
CREATE TABLE ai_chat_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_date TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  created_at TEXT
);
```

---

## 6. TypeScript Types (MUST IMPLEMENT EXACTLY)

```ts
export type ParsedMessage =
  | { type: "text"; text?: string }
  | { type: "goal_suggestion"; goals: ParsedGoal[]; source?: string }
  | { type: "plan_update"; changes: PlanChange[]; note?: string }
  | { type: "stats_summary"; metrics: StatMetric[]; period?: string }
  | { type: "action_list"; actions: ActionItem[]; note?: string }
  | { type: "digest_item"; topic: string; summary: string; sources?: SourceLink[] }
  | { type: "connector_status"; connectors: ConnectorStatusItem[] }
  | { type: "form_fill"; title?: string; submitLabel?: string; fields: FormField[] }
  | { type: "chart_data"; chartType: "bar"|"line"|"pie"; labels: string[]; datasets: ChartDataset[]; title?: string }
  | { type: "error"; message: string; recovery?: string }

export type CardAction =
  | { kind: "accept-goal"; goal: ParsedGoal }
  | { kind: "dismiss-goal"; goal: ParsedGoal }
  | { kind: "apply-plan"; changes: PlanChange[] }
  | { kind: "run-ipc"; ipc: string; payload?: Record<string, unknown>; label?: string }
  | { kind: "submit-form"; values: Record<string, string | number | boolean> }
  | { kind: "sync-connector"; id?: string; name: string }
  | { kind: "open-url"; url: string }
  | { kind: "retry" }
  | { kind: "send-text"; text: string }

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parsed_json?: ParsedMessage;
  created_at?: string;
}
```

---

## 7. Design Tokens (MUST USE)

```ts
export const SURFACE = {
  base: "bg-zinc-950",
  card: "bg-zinc-900/40",
  cardHi: "bg-zinc-900/60",
  inset: "bg-zinc-950/60",
}

export const TEXT = {
  primary: "text-zinc-100",
  secondary: "text-zinc-400",
  muted: "text-zinc-500",
  disabled: "text-zinc-600",
}

export const ACCENT = {
  pink:    { hex: "#f472b6", pill: "bg-pink-500/10 text-pink-300 ring-pink-500/20" },
  emerald: { hex: "#10b981", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" },
  amber:   { hex: "#f59e0b", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/20" },
  violet:  { hex: "#a78bfa", pill: "bg-violet-500/10 text-violet-300 ring-violet-500/20" },
  red:     { hex: "#f87171", pill: "bg-red-500/10 text-red-300 ring-red-500/20" },
  cyan:    { hex: "#22d3ee", pill: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20" },
}
```

---

## 8. Core Feature Requirements

### A. Thinking Section (`<thought>` tags)

**Problem:** AI outputs `<thought>reasoning content here</thought>` but it renders as raw text.

**Solution:**
1. **Detection:** Parse raw AI output for `<thought>...</thought>` tags (case-insensitive, multiline)
2. **Extraction:** Remove thought content from visible response text
3. **Rendering:** Collapsible section, **CLOSED by default**
4. **Visual treatment:** Muted color, monospace font, subtle border, expand icon

**Implementation in `MessageBubble.tsx`:**
```ts
function extractThoughts(content: string): { thoughts: string[]; cleanContent: string } {
  const thoughtRegex = /<thought>([\s\S]*?)<\/thought>/gi
  const thoughts: string[] = []
  let cleanContent = content
  let match
  while ((match = thoughtRegex.exec(content)) !== null) {
    thoughts.push(match[1].trim())
    cleanContent = cleanContent.replace(match[0], '')
  }
  return { thoughts, cleanContent: cleanContent.trim() }
}
```

**`ThoughtSection.tsx` Spec:**
- Container: `bg-zinc-900/40 ring-1 ring-zinc-800/60 rounded-lg px-3 py-2 mb-3`
- Header (clickable): `flex items-center gap-2 cursor-pointer select-none`
- Icon: `ChevronRight` (closed) → `ChevronDown` (open) with `transition-transform duration-200`
- Label: `Brain` icon + "Thinking" text in `text-[11px] text-zinc-500 font-medium uppercase tracking-wider`
- Content (when expanded): `text-[11px] text-zinc-500 font-mono leading-relaxed mt-2 pl-5 border-l-2 border-zinc-800`
- Default state: **collapsed**
- Multiple thoughts: render sequentially with `gap-2` between them

### B. Markdown Rendering (ALL responses)

ALL assistant text (streaming AND final) MUST render as markdown:

| Element | Rendering Spec |
|---------|---------------|
| Headers (`# h1`, `## h2`, `### h3`) | `font-semibold`, h1=`text-lg`, h2=`text-base`, h3=`text-sm`, color=`text-zinc-200`, margin=`mt-4 mb-2` |
| Bold (`**text**`) | `font-semibold text-zinc-200` |
| Italic (`*text*`) | `italic text-zinc-400` |
| Inline code (`` `code` ``) | `text-pink-300 bg-zinc-800/80 px-1.5 py-0.5 rounded text-[13px] font-mono` |
| Fenced code (```` ``` ````) | `bg-zinc-950/80 border border-zinc-800/60 rounded-lg p-4 overflow-x-auto` + language label |
| Language label | `text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2` |
| Code text | `text-[13px] text-zinc-300 font-mono leading-relaxed` |
| Unordered lists (`- item`) | `list-disc pl-5 space-y-1 text-zinc-300` |
| Ordered lists (`1. item`) | `list-decimal pl-5 space-y-1 text-zinc-300` |
| Blockquotes (`> text`) | `border-l-2 border-pink-500/40 pl-3 italic text-zinc-400 my-3` |
| Links (`[text](url)`) | `text-pink-400 hover:text-pink-300 underline underline-offset-2 transition-colors` |
| Tables (`\| col \|`) | `w-full text-left border-collapse` with `border-b border-zinc-800/60` rows |
| Horizontal rule (`---`) | `border-t border-zinc-800/60 my-4` |

**During Streaming:** `TypewriterText.tsx` must parse markdown incrementally. Use a markdown parser that can handle partial input gracefully, or re-parse the full accumulated text on each chunk. The rendered output should update as new text arrives.

**After Streaming:** Use `MarkdownRenderer.tsx` (extracted from TypewriterText) for final rendering.

### C. Chat Container (Scrollable)

**Problem:** Chat area is not scrollable; text overflows without containment.

**Solution:**
- Container: `dk-stream` class with `flex: 1; overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth`
- Auto-scroll logic:
  - On new message: scroll to bottom if user was within 48px of bottom
  - If user scrolls up (>48px from bottom): pause auto-scroll
  - If user scrolls back to bottom (within 48px): resume auto-scroll
  - Use `scrollTop + clientHeight >= scrollHeight - 48` threshold
- Smooth scroll: `scroll-behavior: smooth` on container
- Custom scrollbar: thin, zinc-colored (already in `deck.css`)

**Implementation in `ChatPanel.tsx`:**
```ts
const scrollRef = useRef<HTMLDivElement>(null)
const [isAtBottom, setIsAtBottom] = useState(true)
const [userScrolled, setUserScrolled] = useState(false)

const handleScroll = () => {
  const el = scrollRef.current
  if (!el) return
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
  setIsAtBottom(atBottom)
  if (!atBottom) setUserScrolled(true)
  if (atBottom && userScrolled) setUserScrolled(false)
}

useEffect(() => {
  if (isAtBottom && !userScrolled) {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }
}, [messages])
```

### D. Chat Input — History Navigation

**Feature:** Press `Up Arrow` to recall previous prompt, `Down Arrow` to go forward (if not on latest).

**Implementation in `ChatInput.tsx`:**
```ts
const [historyIndex, setHistoryIndex] = useState(-1) // -1 = current input
const [savedInput, setSavedInput] = useState('')

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowUp' && !e.shiftKey && e.currentTarget.selectionStart === 0) {
    e.preventDefault()
    const userMessages = messages.filter(m => m.role === 'user')
    if (historyIndex === -1) setSavedInput(input)
    const newIndex = historyIndex === -1 ? userMessages.length - 1 : Math.max(0, historyIndex - 1)
    if (newIndex >= 0 && newIndex < userMessages.length) {
      setHistoryIndex(newIndex)
      setInput(userMessages[newIndex].content)
    }
  }
  if (e.key === 'ArrowDown' && !e.shiftKey) {
    e.preventDefault()
    const userMessages = messages.filter(m => m.role === 'user')
    if (historyIndex === -1) return
    const newIndex = historyIndex + 1
    if (newIndex >= userMessages.length) {
      setHistoryIndex(-1)
      setInput(savedInput)
    } else {
      setHistoryIndex(newIndex)
      setInput(userMessages[newIndex].content)
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    setHistoryIndex(-1)
    setSavedInput('')
    handleSend()
  }
}
```

### E. Interactive Response Cards

Each response type renders as a distinct visual card. All cards use `CardShell` component.

**`CardShell.tsx` Spec:**
- Border-radius: `rounded-xl`
- Border: `ring-1 ring-zinc-800/60`
- Background: `bg-zinc-900/40`
- Left accent bar: `w-[3px] rounded-l-xl` colored per card type
- Header: `flex items-center gap-2 px-5 pt-4 pb-2` with icon + title + badge
- Body: `px-5 pb-5 pt-2`
- Actions: `flex justify-end gap-2 px-5 pb-4` (if applicable)

**Card Type Specifications:**

| Type | Accent Color | Left Bar | Icon | Header Title | Actions |
|------|-------------|----------|------|-------------|---------|
| `goal_suggestion` | Emerald | `bg-emerald-500` | `Target` | "Suggested Goals" | Accept/Dismiss buttons |
| `plan_update` | Violet | `bg-violet-500` | `GitPullRequest` | "Plan Update" | Apply button |
| `stats_summary` | Cyan | `bg-cyan-500` | `BarChart3` | "Stats Summary" | None (read-only) |
| `action_list` | Pink | `bg-pink-500` | `Zap` | "Actions" | Run buttons + confirmation |
| `digest_item` | Cyan | `bg-cyan-500` | `Newspaper` | Topic title | None (read-only) |
| `connector_status` | Cyan | `bg-cyan-500` | `Plug` | "Connectors" | Sync buttons |
| `form_fill` | Violet | `bg-violet-500` | `FormInput` | Form title | Submit button |
| `chart_data` | Amber | `bg-amber-500` | `PieChart` | Chart title | None (read-only) |
| `error` | Red | `bg-red-500` | `AlertCircle` | "Error" | Retry/Dismiss |

**Action Button Styling:**
- Primary: `bg-pink-500/10 text-pink-300 ring-1 ring-pink-500/20 hover:bg-pink-500/20 active:bg-pink-500/30 transition-colors`
- Ghost: `text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300 active:bg-zinc-800 transition-colors`
- Danger: `bg-red-500/10 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20`
- Size: `px-3 py-1.5 rounded-lg text-[13px] font-medium`

### F. Permission & Safety System

**Action Classification:**
- **Read-only** (safe): `stats_summary`, `digest_item`, `connector_status` → auto-approve, no dialog
- **Suggestive** (low risk): `goal_suggestion`, `plan_update` → single confirmation dialog
- **Mutating** (medium risk): `action_list` (run-ipc), `form_fill` (submit) → confirmation dialog with description
- **Destructive** (high risk): any action with `delete`, `remove`, `reset`, `clear` in label → double confirmation (checkbox + confirm)

**Confirmation Dialog Spec:**
- Overlay: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center`
- Dialog: `bg-zinc-900 ring-1 ring-zinc-800 rounded-xl max-w-md w-full mx-4 p-5`
- Title: `text-base font-semibold text-zinc-100 mb-2`
- Description: `text-sm text-zinc-400 mb-5`
- For destructive: add checkbox `text-sm text-zinc-300` with `I understand this action cannot be undone`
- Buttons: Cancel (ghost) + Confirm (primary, or red for destructive)
- Focus trap: dialog must trap focus

**Auto-Approve Toggle:**
- Position: `ChatPanel.tsx` header, before Online/Offline chip
- Default: **OFF** (Manual mode)
- ON state: `bg-amber-500/10 text-amber-300` with `Shield` icon, label "Auto"
- OFF state: `bg-zinc-800/60 text-zinc-500` with `ShieldOff` icon, label "Manual"
- Tooltip: "Auto-approve actions without confirmation" / "Manual approval required for actions"
- Persist in localStorage

### G. Session History & Persistence

**Thread Management:**
- Threads saved to SQLite via `ai-chat:save` IPC
- Thread list loaded via `ai-chat:list-threads` (returns `{ success: true, threads: [...] }`)
- Thread metadata: `thread_date`, `title`, `message_count`, `preview`, `last_message_at`
- New thread button in topbar (clears current thread, starts fresh)
- Thread history drawer accessible from chat header

**Persistence Flow:**
1. User sends message → `messages` array updated
2. After each message pair (user + assistant), call `persist(messages)`
3. `persist` → `ai-chat:save` IPC with `{ thread_date, messages }`
4. On page load: `loadThread(today)` loads today's messages via `ai-chat:load`
5. `refreshThreads()` loads thread list for history drawer via `ai-chat:list-threads`

**Thread List Format:**
```ts
interface ThreadMeta {
  thread_date: string;
  title: string;
  message_count: number;
  last_message_at: number;
  preview: string;
}
```

**History Drawer:**
- Slide-out panel from right side
- List of threads sorted by `last_message_at` desc
- Each item: date + preview text + message count badge
- Click to switch threads
- Active thread highlighted with `bg-zinc-800/60`
- New thread button at top

### H. Context Bundle (AI System Prompt)

Before each chat, build a context bundle with:

```ts
interface ContextBundle {
  goals: Goal[];                    // from getGoals
  longtermGoals: LongtermGoal[];    // from getLongtermGoals
  stats: DashboardAggregates;       // from getDashboardAggregates
  aiUsage: AIUsageSummary;          // from getAIUsageSummary
  projects: Project[];              // from getProjects
  digest: TopicDigest[];            // from getTopicDigest
  connectors: Connector[];          // from connectors:list
  memories: string[];               // from ai-chat:get-memories
  planningNotes: string;           // from readPlanningMd
}
```

This bundle is prepended as a system message to every chat conversation. Format as markdown text within the system prompt.

---

## 9. Message Styling Specifications

### User Messages
- Alignment: `align-self: flex-end`, `flex-direction: row-reverse`, `margin-left: auto`
- Container: `dk-msg dk-user`
- Bubble: `dk-bubble` with:
  - Background: `var(--raised)` (rgba(39,39,42,.7))
  - Border: `1px solid var(--line-2)` (rgba(255,255,255,.12))
  - Border-radius: `16px 16px 4px 16px` (rounded top, flat bottom-right)
  - Text color: `#f4f4f5`
  - Padding: `11px 16px`
  - Max-width: `85%`
- Avatar: "CZ" text in raised background circle, `w-8 h-8 rounded-full`

### Assistant Messages
- Alignment: `align-self: flex-start`, `margin-right: auto`
- Container: `dk-msg dk-ai`
- Bubble: `dk-bubble` with:
  - No background (transparent)
  - Text color: `rgba(250,250,250,.88)`
  - Padding-top: `2px`
  - Max-width: `85%`
- Avatar: `Sparkles` icon in pink gradient circle (`bg-gradient-to-br from-pink-500 to-violet-500`)

### Message Entrance Animation
- All messages: `animation: msgEnter 0.25s ease-out`
- Keyframes: `from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`
- Stagger: 50ms between multiple messages appearing

---

## 10. Component Implementation Details

### `MessageBubble.tsx`
- Props: `msg: ChatMsg`, `isStreaming: boolean`, `autoApprove: boolean`
- If `msg.role === 'user'`: render user bubble with plain text (no markdown)
- If `msg.role === 'assistant'`:
  1. Extract thoughts using `extractThoughts(msg.content)`
  2. If thoughts exist: render `<ThoughtSection thoughts={thoughts} />`
  3. If `isStreaming` and this is the last message: render `<TypewriterText content={cleanContent} />`
  4. Else: render `<MarkdownRenderer content={cleanContent} />`
  5. If `msg.parsed_json`: render `<ParsedMessageRouter parsed={msg.parsed_json} autoApprove={autoApprove} />`

### `TypewriterText.tsx`
- Props: `content: string`, `speed?: number` (default: 1)
- Must parse markdown incrementally as text reveals
- Use `useEffect` with `requestAnimationFrame` for smooth character-by-character reveal
- On each frame, increment visible character count and re-parse markdown
- Final state: identical to `<MarkdownRenderer content={content} />`

### `MarkdownRenderer.tsx`
- Props: `content: string`
- Use a markdown parser (remark/rehype or marked) configured with custom renderers
- Must support all elements listed in Section 8B
- Code blocks: detect language from ```lang prefix, render with monospace font
- Links: must be clickable and open in external browser (use `open-url` IPC or `window.open`)

### `ParsedMessageRouter.tsx`
- Props: `parsed: ParsedMessage`, `autoApprove: boolean`, `onAction?: (action: CardAction) => void`
- Switch on `parsed.type`, render corresponding card
- Pass `autoApprove` down to all cards that have actions
- Cards with actions must call `onAction` when user interacts

### `ActionListCard.tsx`
- Props: `actions: ActionItem[]`, `note?: string`, `autoApprove: boolean`, `onAction: (action: CardAction) => void`
- Each action item: checkbox + label + Run button
- If `autoApprove === false`: clicking Run opens confirmation dialog first
- If `autoApprove === true`: execute immediately
- Show `AgentProgressBar` while action is running

### `GoalSuggestionCard.tsx`
- Props: `goals: ParsedGoal[]`, `source?: string`, `autoApprove: boolean`, `onAction: (action: CardAction) => void`
- Each goal: card with title, category badge, description
- Actions: Accept (emerald) + Dismiss (ghost)
- If `autoApprove === false`: confirmation dialog on Accept
- On Accept: emit `{ kind: 'accept-goal', goal }`
- On Dismiss: emit `{ kind: 'dismiss-goal', goal }`

### `FormFillCard.tsx`
- Props: `title?: string`, `submitLabel?: string`, `fields: FormField[]`, `autoApprove: boolean`, `onAction: (action: CardAction) => void`
- Render form fields dynamically based on `field.type` (text, number, select, checkbox, textarea)
- Submit button at bottom
- Validate required fields before submit
- On submit: emit `{ kind: 'submit-form', values: Record<string, string | number | boolean> }`

### `ConnectorStatusCard.tsx`
- Props: `connectors: ConnectorStatusItem[]`, `autoApprove: boolean`, `onAction: (action: CardAction) => void`
- Grid layout: name, status dot (green/yellow/red), last sync time
- Sync button per connector
- On sync: emit `{ kind: 'sync-connector', id, name }`

### `ErrorCard.tsx`
- Props: `message: string`, `recovery?: string`, `onAction: (action: CardAction) => void`
- Red accent bar
- Error message in `text-red-300`
- Recovery suggestion if provided
- Actions: Retry (primary) + Dismiss (ghost)
- On Retry: emit `{ kind: 'retry' }`

---

## 11. CSS Requirements (`deck.css`)

Add/modify these styles:

```css
/* Chat stream container */
.dk-stream {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  scroll-behavior: smooth;
}

/* Messages */
.dk-msg {
  display: flex;
  gap: 12px;
  max-width: 92%;
  animation: msgEnter 0.25s ease-out;
}
.dk-msg.dk-user { align-self: flex-end; flex-direction: row-reverse; margin-left: auto; }
.dk-msg.dk-ai { align-self: flex-start; margin-right: auto; }

/* Bubble */
.dk-bubble {
  font-size: 14px;
  line-height: 1.6;
  color: var(--tp);
  word-break: break-word;
}
.dk-msg.dk-user .dk-bubble {
  background: var(--raised);
  border: 1px solid var(--line-2);
  padding: 11px 16px;
  border-radius: 16px 16px 4px 16px;
  color: #f4f4f5;
}
.dk-msg.dk-ai .dk-bubble { padding-top: 2px; color: rgba(250,250,250,.88); }

/* Thinking section */
.dk-thought {
  background: rgba(24, 24, 27, 0.4);
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  cursor: pointer;
  user-select: none;
}
.dk-thought-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #71717a;
  font-family: ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.dk-thought-content {
  font-size: 11px;
  color: #71717a;
  font-family: ui-monospace, monospace;
  line-height: 1.6;
  margin-top: 8px;
  padding-left: 20px;
  border-left: 2px solid rgba(63, 63, 70, 0.6);
  white-space: pre-wrap;
}

/* Code blocks */
.dk-code-block {
  background: rgba(9, 9, 11, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.6);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin: 12px 0;
}
.dk-code-lang {
  font-size: 10px;
  color: #71717a;
  font-family: ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.dk-code-block code {
  font-size: 13px;
  color: #d4d4d8;
  font-family: ui-monospace, monospace;
  line-height: 1.6;
}

/* Scrollbar */
.dk-stream::-webkit-scrollbar { width: 6px; }
.dk-stream::-webkit-scrollbar-track { background: transparent; }
.dk-stream::-webkit-scrollbar-thumb { background: rgba(63, 63, 70, 0.6); border-radius: 3px; }
.dk-stream::-webkit-scrollbar-thumb:hover { background: rgba(63, 63, 70, 0.8); }

/* Message entrance */
@keyframes msgEnter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 12. MCP Components to Use

### shadcn/ui
| Component | Use For |
|-----------|---------|
| `card` | CardShell base |
| `dialog` | Confirmation modals |
| `button` | Action buttons |
| `tabs` | Thread history tabs |
| `tooltip` | Button tooltips |
| `skeleton` | Loading states |
| `scroll-area` | Chat scroll container (optional, can use native) |
| `textarea` | Chat input |
| `input` | Form fields |
| `switch` | Auto-approve toggle |
| `badge` | Status badges |
| `separator` | Dividers |
| `collapsible` | Thinking section |
| `progress` | Agent progress bar |
| `checkbox` | Confirmation checkboxes |
| `dropdown-menu` | Thread actions |
| `hover-card` | Card previews |
| `command` | Slash command palette |

### Magic UI
| Component | Use For |
|-----------|---------|
| `Number Ticker` | Stats count-up animation |
| `Blur Fade` | Message entrance animation |
| `Confetti` | Goal completion celebration |

### Lucide Icons
| Icon | Use For |
|------|---------|
| `Bot` | AI assistant |
| `Send` | Send message |
| `Square` | Stop streaming |
| `Mic` | Voice input |
| `Sparkles` | AI indicator |
| `Target` | Goals |
| `Brain` | Thinking/thoughts |
| `History` | Thread history |
| `Shield` / `ShieldOff` | Auto-approve toggle |
| `ChevronRight` / `ChevronDown` | Expand/collapse |
| `Check` | Success |
| `X` | Error/close |
| `AlertCircle` | Errors |
| `Loader2` | Loading spinner |
| `RefreshCw` | Sync/refresh |
| `Trash2` | Delete |
| `Plus` | New thread |
| `Settings` | Configure |

---

## 13. Anti-Slop Design Rules

1. **Re-skin all MCP components** to DeskFlow tokens (zinc-950 base, pink accent)
2. **Max rounded-xl (12px)**, padding `p-5`
3. **Dark mode only** — strip any light variants
4. **Fonts:** Geist (sans) + JetBrains Mono (mono)
5. **Glass layer:** `bg-zinc-900/80 backdrop-blur-xl`
6. **No box-shadow** — use border brightness + glass layers
7. **Animate only transform + opacity** — never width/height/top/left
8. **Every component** has empty/loading/error/populated states
9. **All icons from lucide-react** — no emoji as UI icons
10. **Focus-visible rings** use `ring-2 ring-pink-500/50 ring-offset-2 ring-offset-zinc-950`
11. **Reduced-motion support:** all animations respect `prefers-reduced-motion: reduce`
12. **Every localStorage access** wrapped in try/catch

---

## 14. Constraints

1. **No new IPC handlers** — Use existing endpoints only
2. **No backend changes** — All changes are frontend (React + IPC calls)
3. **Tailwind CSS v4 only** — `@import "tailwindcss"` syntax
4. **Dark theme only** — zinc/pink/emerald/amber palette
5. **No external chat packages** — Build from scratch using existing patterns
6. **Files are CRLF** — preserve line endings
7. **All card padding = p-5**, max border-radius = rounded-xl
8. **No box-shadow** — use border brightness + glass layers
9. **No spring physics** — use `cubic-bezier(0.16, 1, 0.3, 1)`
10. **No pure black** — use zinc-950
11. **Animate only transform + opacity** — never width/height
12. **Every localStorage access in try/catch**
13. **Reduced-motion support** — all animations respect `prefers-reduced-motion`

---

## 15. Files to Modify / Create

### Modify:
- `src/components/ai/chat/MessageBubble.tsx`
- `src/components/ai/chat/TypewriterText.tsx`
- `src/components/ai/chat/ChatPanel.tsx`
- `src/components/ai/chat/ChatInput.tsx`
- `src/components/ai/chat/ParsedMessageRouter.tsx`
- `src/components/ai/chat/renderers/ActionListCard.tsx`
- `src/components/ai/chat/renderers/FormFillCard.tsx`
- `src/components/ai/chat/renderers/ConnectorStatusCard.tsx`
- `src/components/ai/chat/renderers/ErrorCard.tsx`
- `src/components/ai/chat/renderers/CardShell.tsx`
- `src/components/ai/chat/renderers/GoalSuggestionCard.tsx`
- `src/components/ai/chat/renderers/PlanUpdateCard.tsx`
- `src/components/ai/chat/renderers/StatsSummaryCard.tsx`
- `src/components/ai/chat/renderers/DigestTopicCard.tsx`
- `src/components/ai/chat/renderers/ChartDataCard.tsx`
- `src/components/ai/deck/AiPageDeck.tsx`
- `src/components/ai/deck/deck.css`
- `src/pages/AiPage.tsx`
- `src/hooks/useAiChat.ts`

### Create:
- `src/components/ai/chat/ThoughtSection.tsx`
- `src/components/ai/chat/MarkdownRenderer.tsx`

---

## 16. Verification Checklist (ALL MUST PASS)

### Thinking Section:
1. AI response with `<thought>reasoning</thought>` renders thinking as collapsed section
2. Click expand shows the thinking content
3. Click collapse hides it
4. Default state is collapsed
5. Visual: muted monospace text with expand icon

### Markdown Rendering:
6. `**bold**` renders as bold text
7. `## heading` renders as heading
8. `` `code` `` renders as inline code
9. ```` ```code```` ```` renders as code block
10. `- list` renders as bullet list
11. `> quote` renders as blockquote
12. `[link](url)` renders as clickable link
13. Markdown renders during streaming (TypewriterText)

### Chat Scrolling:
14. Chat area is scrollable
15. Auto-scrolls to bottom on new messages
16. Pauses auto-scroll when user scrolls up
17. Resumes when user scrolls back to bottom
18. Smooth scroll behavior

### Interactive Cards:
19. GoalSuggestionCard shows Accept/Dismiss buttons
20. ActionListCard shows Run button with confirmation
21. FormFillCard shows form fields with Submit
22. ConnectorStatusCard shows Sync button
23. ErrorCard shows Retry button
24. All cards have consistent CardShell styling

### Permission System:
25. Auto-approve toggle visible in chat header
26. Toggle switches between Auto/Manual modes
27. Manual mode shows confirmation dialog before actions
28. Auto mode executes actions immediately
29. Destructive actions always require confirmation

### Session History:
30. Messages persist across page reload
31. Thread list shows in history drawer
32. New thread button creates fresh conversation
33. Thread switching loads correct messages
34. Thread metadata (preview, count) updates correctly

### Input & Navigation:
35. Up arrow recalls previous prompt
36. Down arrow returns to next prompt
37. Enter sends message (Shift+Enter for newline)
38. Slash commands show palette

### Design:
39. All buttons have hover/focus/active/disabled states
40. All data components have empty/loading/error/populated states
41. Messages animate in with stagger
42. Code blocks have proper syntax highlighting background
43. No box-shadow, no spring physics, no rounded-2xl/3xl
44. All cards use DeskFlow glass tokens
45. Reduced motion respected

---

## 17. Backend Design Requirements (For Reference / Documentation)

Even though this is a frontend-only rebuild, document the backend architecture:

### Provider System
- **File:** `services/providers/callProvider.ts`
- Supports multiple providers (OpenAI, Anthropic, local models)
- Handles streaming via Server-Sent Events
- Auth headers injected per provider config
- Chunk format: `{ delta: string }` sent via `event.sender.send('provider-chunk', { delta })`

### IPC Handler Locations
- `provider-chat-call`: `main.ts:14507`
- `provider-chat-basic`: `main.ts:14527`
- `ai-chat:save`: `main.ts:14798`
- `ai-chat:load`: `main.ts:14789`
- `ai-chat:reset`: `main.ts:14833`
- `ai-chat:list-threads`: `main.ts:14883`
- `ai-chat:get-memories`: `main.ts:14925`
- `ai-chat:extract-memories`: `main.ts:14960`

### Context Bundle Builder
- **File:** `src/lib/ai/buildContextBundleDetailed.ts`
- Fetches: goals, stats, projects, AI usage, connectors, memories, planning notes
- Formats as markdown system prompt
- Prepended to every conversation

### Database Layer
- SQLite via better-sqlite3
- Tables: `ai_chat_threads`, `ai_chat_messages`, `ai_chat_memories`
- Upsert pattern for threads (insert or replace)
- Messages inserted individually with `created_at = new Date().toISOString()`

---

## 18. Final Notes

- The AI model may output `<thought>` tags at any point in the stream. The parser must handle partial tags gracefully during streaming (don't break if a tag is cut off mid-stream).
- The `parseAssistantContent()` function must detect JSON blocks within markdown code fences (```` ```json ... ``` ````) and parse them into `ParsedMessage` objects.
- If a message contains both text and parsed JSON, render the text first, then the card.
- All IPC calls must handle errors gracefully — show ErrorCard if an IPC call fails.
- The chat input should grow vertically up to 6 lines, then scroll.
- Voice input (Mic button) should toggle recording state visually even if STT is not implemented yet.

---

**Deliverable:** A fully functional, visually polished AI Assistant chat system that passes all 45 verification checks, uses the existing backend infrastructure, and follows the DeskFlow design system exactly.
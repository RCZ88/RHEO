# Free AI Integration — Feature Specification
**Project:** DeskFlow  
**Models:** GLM-4.7-Flash (free), DeepSeek V4 Flash ($0.14/M), OpenRouter relay  
**Date:** 2026-06-04

---

## Part 1: Feature Catalog

### Category A: Analysis & Insights

#### Feature 1: Activity Pattern Analyst
- **Model:** GLM-4.7-Flash (free, 203K context — fits a full week of logs in one call)
- **Page:** Dashboard, Productivity
- **Data:** Last 30 days of `stats_daily` aggregates + category assignments + tier labels
- **What it does:** Sends compressed daily summaries to the AI and asks it to identify non-obvious patterns — e.g. "you code most productively Tuesday afternoons, but you always open social media for 22 min immediately after lunch before settling back in; removing that gap would give you ~2.5 extra focus hours per week"
- **Value:** Turns raw numbers into actionable behavioral insight the user would never compute manually
- **Feasibility:** Easy — `stats_daily` is already aggregated; one IPC call, one prompt, one text response rendered in a GlassCard

#### Feature 2: Focus Session Debrief
- **Model:** GLM-4.7-Flash
- **Page:** Dashboard (post-session toast) or External
- **Data:** The last completed work block — app logs, duration, interruptions (context switches), time of day
- **What it does:** When a long focus session ends (>45 min in productive apps), a small card appears: "You had a 1h 20min focus block in VS Code. You switched away twice (to Slack, 2 min total). That's your cleanest session this week. What were you working on?" — optional free-text response feeds a running session journal
- **Value:** Makes the tracking data feel alive instead of passive; gives the user a moment of reflection
- **Feasibility:** Easy — session detection already exists; trigger is a duration threshold

#### Feature 3: Weekly Review Brief
- **Model:** DeepSeek V4 Flash (cheap, better reasoning than GLM for synthesis)
- **Page:** New "AI Briefing" card on Dashboard, generated Sunday night / Monday morning
- **Data:** 7-day `stats_daily` rollup — top apps, productive vs distracted ratio, sleep patterns from `external_sessions`, goals if set
- **What it does:** Generates a 200-300 word structured weekly review: what went well, what was off, one concrete suggestion for next week. Cached — generated once per week, not on every render
- **Value:** Replaces the need to manually interpret the stats; feels like having a productivity coach
- **Feasibility:** Easy — batch job triggered on app start if `last_briefing_date` ≠ current week; result stored in DB

#### Feature 4: Anomaly Detector
- **Model:** GLM-4.7-Flash
- **Page:** Dashboard sidebar badge / notification
- **Data:** `stats_daily` rolling 14-day window, compared against 90-day baseline
- **What it does:** Runs silently once per day. Detects when today's pattern significantly deviates from baseline — unusual app usage, way more or less time tracked, sleep pattern change. Surfaces as a subtle badge: "Today looks unusual — 4h of games on a Tuesday. Something up?"
- **Value:** Passive awareness without the user having to check stats
- **Feasibility:** Medium — needs a baseline computation stored in DB; AI just interprets the delta

#### Feature 5: Category Suggestion Engine
- **Model:** GLM-4.5-Flash (simple classification)
- **Page:** Settings → App Categories
- **Data:** List of uncategorized or newly seen apps + their process names + window titles
- **What it does:** When new apps appear in tracking data that aren't categorized, batches them and asks the AI to classify them (Productivity / Entertainment / Communication / etc.). User sees suggestions with one-click accept/reject
- **Value:** Eliminates manual category assignment for new apps
- **Feasibility:** Easy — app name + window title is enough context for classification

---

### Category B: Interactive Chat

#### Feature 6: Data Chat ("Ask Your Stats")
- **Model:** DeepSeek V4 Flash — better tool-use and structured output
- **Page:** New `/ai-chat` page or slide-in panel accessible from Dashboard
- **Data:** On-demand: user query → AI generates a SQLite query plan → IPC executes it → AI interprets results
- **What it does:** User types natural language questions: "How much time did I spend on YouTube last month?", "Which day last week was most productive?", "When do I usually start working?" The AI translates this into a data lookup, executes it via IPC, and explains the result conversationally
- **Value:** Makes the DB transparent to the user without them needing to understand the schema
- **Feasibility:** Medium — requires a safe SQL generation + sandboxed execution layer; AI gets a schema description, not raw query access

#### Feature 7: Goal-Setting & Progress Coach
- **Model:** DeepSeek V4 Flash
- **Page:** New section in Productivity page
- **Data:** User-defined goals (stored in new `goals` table) + daily actual stats
- **What it does:** User sets natural language goals ("I want to code 4 hours a day", "Less than 1h of social media per day"). AI tracks progress, calculates streaks, and weekly gives a coach-style check-in: "You hit your coding goal 4/7 days this week. The 3 misses were all Fridays — might be worth protecting Friday mornings."
- **Value:** Closes the loop between tracking and intent; turns the app from a passive recorder to an active coach
- **Feasibility:** Medium — needs a `goals` table + IPC handlers; AI logic is mostly prompt engineering

#### Feature 8: Agent Chat (Non-Coding)
- **Model:** GLM-4.7-Flash or DeepSeek V4 Flash (user choice)
- **Page:** Terminal page — new "Chat" agent type alongside coding agents
- **Data:** Optionally injects tracking context into the system prompt
- **What it does:** Adds a "General Assistant" agent type to the existing terminal workflow. Not a coding agent — just a persistent chat window with an AI that can optionally be given the current week's tracking summary as context. Good for brainstorming, writing, planning.
- **Value:** Reuses the entire terminal infrastructure for a general chat experience; leverages the already-built context assembly system for personalization
- **Feasibility:** Easy — it's just a new agent template with a different system prompt; the terminal PTY + session system handles everything else

---

### Category C: Daily Briefings & Research

#### Feature 9: Daily Digest
- **Model:** GLM-4.7-Flash (free, runs daily = near-zero cost)
- **Page:** Dashboard widget + optional system notification on app start
- **Data:** Yesterday's tracking data (stats_daily, sleep entry, external activities) + last 7-day trend
- **What it does:** Every morning on app open, generates a 3-5 sentence "good morning" brief: yesterday's highlight, how sleep compared to average, one thing to focus on today based on patterns. Optional notification even when app is minimized.
- **Value:** Makes opening the app feel like a personalized daily ritual rather than a data dump
- **Feasibility:** Easy — GLM free tier, cached result, 1 IPC call per day

#### Feature 10: Topic Research Digest
- **Model:** DeepSeek V4 Pro + web search via OpenRouter (tool use)
- **Page:** New `/research` page or sidebar widget
- **Data:** User-subscribed topics (stored in DB) + optional context from tracking (e.g. "I work in TypeScript" inferred from app usage)
- **What it does:** User subscribes to topics ("AI models news", "Electron performance", "productivity research"). Daily, the AI fetches summaries of recent developments and presents them as a digest — filtered and summarized to the user's apparent skill level inferred from their app usage
- **Value:** Personalizes research to what the user actually does, not just what they say they're interested in; uses tracking data as implicit context
- **Feasibility:** Hard — requires web search tool use via OpenRouter, scheduling logic, topic management UI

#### Feature 11: Sleep & Energy Optimizer
- **Model:** GLM-4.7-Flash
- **Page:** External / Insights pages
- **Data:** `external_sessions` sleep records for last 30 days — sleep duration, fell-asleep time, wake time, correlated with next-day productivity scores
- **What it does:** Computes the correlation between sleep patterns and productive output hours. Gives a personalized insight: "Your best productive days follow 7-8h sleep starting before midnight. Last week's late nights (2am+) each preceded your worst productivity days."
- **Value:** Makes the external tracking feel connected to the app tracking; closes the sleep→performance loop
- **Feasibility:** Easy — data already exists in two tables; simple correlation computation + AI interpretation

---

### Category D: Automation & Suggestions

#### Feature 12: Smart Workspace Preset Generator
- **Model:** GLM-4.7-Flash
- **Page:** Terminal page — New Session Dialog
- **Data:** Most common app combinations from tracking data + time of day patterns + existing project structure
- **What it does:** When creating a new terminal session, AI suggests a pre-filled workspace preset based on the current time and recent patterns: "It's 2pm on Tuesday — you usually start frontend work now. Suggested: VS Code + Figma + Chrome, project: DeskFlow UI sprint"
- **Value:** Removes the friction of manual session setup; makes the terminal workspace feel intelligent
- **Feasibility:** Medium — needs pattern extraction from logs + preset template filling

#### Feature 13: Distraction Interrupt
- **Model:** GLM-4.5-Flash (very fast, very cheap)
- **Page:** Overlay / Toast system
- **Data:** Live tracking state — current app, time-in-app, session context (is a terminal session active?)
- **What it does:** If the user has been in a distracting app for >15 min while a coding session is open, a subtle toast appears: "You've been on YouTube for 18 minutes. Your terminal session is still open." Optional: AI generates a context-preserving re-entry prompt — "Want me to remind you where you left off in your coding session?"
- **Value:** Gentle, non-judgmental accountability that uses the tracking data actively
- **Feasibility:** Medium — needs a live tracking state listener + threshold logic + toast system

#### Feature 14: Context-Aware App Notes
- **Model:** GLM-4.7-Flash
- **Page:** Stats / Dashboard (hover tooltip or click-to-expand)
- **Data:** App name + window titles + time patterns + user's past interactions with this app
- **What it does:** Each tracked app has an AI-generated "card" the user can expand: what the app is for, how the user tends to use it (based on time patterns), and an AI suggestion (e.g. "You spend 3h+ in Figma on average Wednesdays — consider blocking that time proactively")
- **Value:** Turns the app list from a bare name/duration display into a rich, contextual picture of how the user works
- **Feasibility:** Easy — one-time generation per app, cached, updated weekly

#### Feature 15: End-of-Day Summary & Tomorrow Prep
- **Model:** DeepSeek V4 Flash
- **Page:** Dashboard modal, triggered at a user-configured "end of day" time
- **Data:** Today's full log, active terminal sessions, open problems/checklists from Tracker Mind
- **What it does:** At end-of-day, generates: today's work summary, open loops from Tracker Mind (unfinished checklist items, active problems), and a suggested first task for tomorrow based on patterns and open work. Optionally writes a session-end note to `agent/state.md`.
- **Value:** Closes the day deliberately; bridges the daily tracking and the AI agent workspace (Tracker Mind) in one place
- **Feasibility:** Medium — needs to query both tracking DB and agent workspace files; writes back to state.md via existing IPC

---

## Part 2: Top 3 Deep Dives

---

### Feature A: Data Chat — "Ask Your Stats"

#### User Flow

1. User clicks "Ask AI" button in Dashboard header (brain icon, top right of the page)
2. A slide-in panel opens from the right (400px wide, full height, glass backdrop)
3. Panel shows: 3 suggested starter questions as chips ("What was my most productive day this week?", "How much time on YouTube last month?", "When do I usually start working?")
4. User types or clicks a chip
5. AI responds in ~1-3 seconds: a short natural-language answer + optional small data table
6. Follow-up questions maintain context (multi-turn, last 10 messages)
7. "Clear" button resets the conversation; panel persists across Dashboard navigation

#### Technical Architecture

**IPC channels needed:**

| Channel | Direction | Payload |
|---------|-----------|---------|
| `ai-chat-message` | invoke | `{ messages: ChatMessage[], schemaContext: string }` |
| `ai-chat-stream` | send (event) | `{ chunk: string, done: boolean, sessionId: string }` |
| `ai-execute-safe-query` | invoke | `{ sql: string }` → `{ rows: any[], error?: string }` |

**Data flow:**
```
User types question
  → Renderer: window.deskflowAPI.aiChatMessage({ messages, schema })
    → main.ts: builds prompt with schema context + safety rules
    → DeepSeek V4 Flash API call (streaming)
    → If AI response contains [QUERY: SELECT ...], extract and validate
    → Execute safe query via sandboxed DB read (SELECT only, no user tables mutation)
    → Inject results back into AI response context
    → Stream final answer back via webContents.send('ai-chat-stream', chunk)
  → Renderer: accumulates stream chunks → renders in chat panel
```

**Schema injection (system prompt fragment):**
```
You have access to a read-only SQLite database with these tables:
- stats_daily(date, app_name, app_type, category, total_seconds, session_count)
- stats_hourly(date, hour, app_name, category, total_seconds, session_count)
- external_sessions(id, type, started_at, ended_at, duration_seconds, notes)

To query data, output a single line: [QUERY: SELECT ...]
Only SELECT queries. Never INSERT, UPDATE, DELETE, DROP.
Today is {DATE}. User's timezone is {TZ}.
After I return results, interpret them conversationally.
```

**Safe query sandbox in main.ts:**
```typescript
function executeSafeQuery(sql: string): { rows: any[], error?: string } {
  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith('SELECT')) return { rows: [], error: 'Only SELECT queries allowed' };
  if (/DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|ATTACH/i.test(sql)) {
    return { rows: [], error: 'Unsafe query rejected' };
  }
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all();
    return { rows: rows.slice(0, 200) }; // cap at 200 rows
  } catch (e) {
    return { rows: [], error: String(e) };
  }
}
```

#### API Integration

**Model:** DeepSeek V4 Flash via direct API  
**Endpoint:** `https://api.deepseek.com/chat/completions`  
**Mode:** Streaming (SSE)  
**Context:** Last 10 messages + schema context (~2K tokens system prompt)  
**Cost:** ~200 tokens per question × 30 questions/day = 6K tokens/day = $0.00084/day

**Streaming implementation in main.ts:**
```typescript
ipcMain.handle('ai-chat-message', async (event, { messages, schemaContext }) => {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey('deepseek')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: buildSchemaSystemPrompt(schemaContext) },
        ...messages
      ],
      stream: true,
      max_tokens: 500
    })
  });
  
  const sessionId = crypto.randomUUID();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') {
        event.sender.send('ai-chat-stream', { chunk: '', done: true, sessionId });
        return { sessionId };
      }
      try {
        const parsed = JSON.parse(data);
        const chunk = parsed.choices[0]?.delta?.content || '';
        if (chunk) event.sender.send('ai-chat-stream', { chunk, done: false, sessionId });
        
        // Check for [QUERY: ...] pattern mid-stream
        // ... (handled post-stream on accumulated text)
      } catch {}
    }
  }
  return { sessionId };
});
```

#### UI Layout

```
Dashboard page
├── Header row
│   ├── "Dashboard" title
│   └── [Brain icon button] "Ask AI"   ← new button, top right
│
└── AI Chat Panel (slide-in, right side, 400px)
    ├── Header
    │   ├── "Ask your stats"
    │   └── [X] close
    ├── Starter chips (shown when empty)
    │   ├── "Most productive day this week?"
    │   ├── "Time on YouTube last month?"
    │   └── "When do I usually start working?"
    ├── Message list (scrollable)
    │   ├── UserBubble — right aligned, zinc-700
    │   └── AIBubble — left aligned, zinc-800, markdown rendered
    │       └── Optional: DataTable (compact, 200px max height)
    └── Input row
        ├── TextInput (flex-1, "Ask anything about your activity...")
        └── [Send] button
```

#### Integration with Existing Systems

- Reads from `stats_daily`, `stats_hourly`, `external_sessions` (read-only, SELECT only)
- Injects current `selectedPeriod` from App.tsx as query context
- API key stored via `Electron.safeStorage` (see Part 3)
- Falls back gracefully: if no API key configured, shows "Configure AI in Settings" link
- Does NOT modify any existing state — pure read + display layer

#### Implementation Effort

New files: `src/components/AIChatPanel.tsx`, `src/services/AIService.ts` (main process)  
Modified files: `src/pages/DashboardPage.tsx` (add button + panel), `src/main.ts` (3 new IPC handlers), `src/preload.ts` (3 new bridges)  
Estimated: ~500 lines new code, 50 lines modified existing

---

### Feature B: Daily Digest + Weekly Review Brief

#### User Flow

**Daily Digest (Morning):**
1. User opens DeskFlow. App checks: "Has a digest been generated today?"
2. If no: background job fires immediately (non-blocking — app loads normally)
3. 2-3 seconds after app load, a toast slides in from top-right: "Good morning — your daily brief is ready"
4. User clicks toast → Dashboard scrolls to / expands the "AI Brief" card
5. Card shows: 3-4 sentences. Yesterday recap, one observation, one nudge for today.
6. "Regenerate" button refreshes it. "Dismiss" collapses card to a small "View brief" pill.

**Weekly Review (Monday morning / Sunday night):**
1. Same trigger mechanism — runs once per week, heavier prompt
2. Appears as a more prominent expandable card above the heatmap
3. Structured: "Last Week → What Went Well / What Was Off / Suggestion for This Week"
4. Optional: "Share with terminal agent" button injects the weekly review into the next Tracker Mind session as context

#### Technical Architecture

**New DB table for caching briefs:**
```sql
CREATE TABLE IF NOT EXISTS ai_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,          -- 'daily' | 'weekly'
  date TEXT NOT NULL,          -- 'YYYY-MM-DD' for daily, 'YYYY-WXX' for weekly
  content TEXT NOT NULL,       -- generated markdown text
  model_used TEXT,
  tokens_used INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(type, date)
);
```

**IPC channels:**

| Channel | Direction | Payload |
|---------|-----------|---------|
| `get-ai-brief` | invoke | `{ type: 'daily' \| 'weekly' }` → `{ content, date, cached }` |
| `regenerate-ai-brief` | invoke | `{ type }` → `{ content }` |
| `ai-brief-ready` | send (event) | `{ type, content }` |

**Generation flow:**
```
App startup (App.tsx useEffect)
  → window.deskflowAPI.getAiBrief({ type: 'daily' })
    → main.ts: check ai_briefs WHERE type='daily' AND date=today
    → If cached: return immediately (< 1ms)
    → If not cached:
        → Query stats_daily for yesterday + 7-day trend (5-10 rows)
        → Query external_sessions for last sleep
        → Build compact prompt (< 500 tokens input)
        → Call GLM-4.7-Flash (FREE)
        → Store result in ai_briefs
        → webContents.send('ai-brief-ready', { type: 'daily', content })
  → Renderer: show toast, update Dashboard card
```

**Prompt template (daily):**
```
You are a personal productivity assistant. Write a brief, friendly 3-4 sentence daily summary.

Yesterday's data:
- Total tracked time: {total_hours}h
- Top apps: {top_apps}
- Productive time: {productive_pct}% ({productive_hours}h)
- Distracting time: {distracting_pct}%
- Sleep last night: {sleep_hours}h (avg: {sleep_avg}h)
- 7-day trend: {trend_description}

Write in second person. Be specific, not generic. One concrete observation, one gentle suggestion.
Under 80 words. No bullet points.
```

#### API Integration

**Model:** GLM-4.7-Flash via `z.ai` API  
**Endpoint:** `https://api.z.ai/v1/chat/completions`  
**Cost:** FREE — unlimited  
**Input tokens per brief:** ~400 tokens (compressed stats)  
**Output tokens:** ~150 tokens  
**Weekly brief:** DeepSeek V4 Flash (~800 input, ~400 output = ~$0.0002/week)

**Error handling:**
- API timeout > 10s → skip silently, retry next app open
- Rate limit → exponential backoff, max 3 retries
- No API key configured → show static "Configure AI in Settings" message in brief card slot

#### UI Layout

```
Dashboard page
├── AI Daily Brief card (new, top of page, below header)
│   ├── Header: [Sparkles icon] "Daily Brief" | [date] | [↺ regenerate] [×]
│   ├── Content: 3-4 sentences, rendered as prose
│   └── Footer: "Generated by GLM-4.7-Flash · free" (small, muted)
│
└── Weekly Review card (replaces brief card on Mondays)
    ├── Header: [BarChart icon] "Weekly Review — Week 23"
    ├── Three columns (or stacked on narrow):
    │   ├── "What went well" (green left border)
    │   ├── "Watch out for" (amber left border)
    │   └── "This week's focus" (purple left border)
    └── [Inject into Tracker Mind] button (optional)
```

#### Integration with Existing Systems

- Reads `stats_daily` and `external_sessions` — no schema changes to existing tables
- New `ai_briefs` table migration added to DB init
- "Inject into Tracker Mind" button calls existing `buildInitContent()` flow, prepending the weekly review
- API key same as Feature A (shared `AIService` in main process)
- Falls back gracefully: if offline or no key, card slot shows yesterday's cached brief (or nothing)

#### Implementation Effort

New files: `src/components/AiBriefCard.tsx`, `src/components/WeeklyReviewCard.tsx`  
Modified files: `src/pages/DashboardPage.tsx`, `src/main.ts` (2 new handlers), `src/preload.ts`  
DB migration: 1 new table  
Estimated: ~350 lines new code, minimal existing code changes

---

### Feature C: Goal Coach + Progress Tracker

#### User Flow

1. User navigates to Productivity page → new "Goals" tab appears alongside existing tabs
2. First time: empty state with a "Set a goal" button and examples ("Code 4h/day", "Under 1h social media")
3. User clicks "Set a goal" → a simple modal: free-text goal description + optional target number + time period
4. AI parses the goal into a measurable rule (shown to user for confirmation): "Track: VS Code + Cursor + Terminal. Target: ≥ 240 min/day. Period: daily"
5. Goal appears in list with today's progress bar
6. Each goal card shows: target, today's actual, streak (consecutive days hit), 7-day sparkline
7. Weekly: AI generates a "Goal check-in" (same brief generation flow) — how each goal went, what to adjust

#### Technical Architecture

**New DB table:**
```sql
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,             -- user's natural language goal
  parsed_rule TEXT NOT NULL,       -- JSON: { apps: string[], metric: string, target_seconds: number, period: string }
  created_at TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS goal_streaks (
  goal_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  actual_seconds INTEGER DEFAULT 0,
  met INTEGER DEFAULT 0,           -- 1 if target hit
  PRIMARY KEY (goal_id, date),
  FOREIGN KEY (goal_id) REFERENCES goals(id)
);
```

**IPC channels:**

| Channel | Direction | Payload |
|---------|-----------|---------|
| `ai-parse-goal` | invoke | `{ text: string }` → `{ parsedRule, confirmation }` |
| `save-goal` | invoke | `{ title, parsedRule }` → `{ id }` |
| `get-goals-with-progress` | invoke | `{}` → `{ goals: GoalWithProgress[] }` |
| `compute-goal-streaks` | invoke | `{}` → triggers background computation |

**Goal parsing flow:**
```
User types: "I want to code at least 3 hours every day"
  → ai-parse-goal
    → GLM-4.7-Flash with system prompt:
      "Parse this productivity goal into structured JSON.
       Available app categories: {categories_list}
       Known productive apps: {top_apps_from_stats}
       Output JSON only: { apps: [], metric: 'time', target_seconds: N, period: 'daily'|'weekly' }"
    → Returns: { apps: ['VS Code', 'Cursor', 'Terminal', 'WebStorm'], target_seconds: 10800, period: 'daily' }
    → Renderer shows confirmation card: "Track time in: VS Code, Cursor, Terminal. Goal: ≥ 3h per day"
    → User confirms → save-goal IPC
```

**Progress computation (main.ts, runs on `get-goals-with-progress`):**
```typescript
// For each goal, query stats_daily for last 30 days
// Compare actual_seconds against goal.parsedRule.target_seconds
// Compute: streak (consecutive days met), 7-day values for sparkline, today's progress
// Update goal_streaks table
// Return enriched goal objects to renderer
```

#### API Integration

**Goal parsing:** GLM-4.7-Flash (free) — one call per new goal, ~100 input tokens  
**Weekly check-in:** Same brief generation pipeline as Feature B — DeepSeek V4 Flash, ~$0.0003/week  
**Streak/progress computation:** Pure SQL + TypeScript — zero AI tokens after initial parse

**Error handling:**
- If AI goal parsing fails → show manual rule builder (dropdown: app category, metric, target number)
- If progress computation fails → show "Last computed: X hours ago" with retry button

#### UI Layout

```
Productivity page
├── Tabs: [Overview] [Goals] [Trends]  ← new Goals tab
│
└── Goals tab
    ├── Header: "Your Goals" | [+ New Goal] button
    ├── Goal cards (each):
    │   ├── Title: "Code 3h/day"
    │   ├── Progress bar: "2h 14min / 3h today" (fills with green)
    │   ├── Streak badge: "🔥 5-day streak"
    │   ├── Sparkline: 7 small bars for last 7 days (green = met, gray = missed)
    │   └── [Edit] [Archive] buttons
    └── Weekly check-in card (Mondays):
        ├── "Goal check-in — Week 23"
        └── Per-goal: met X/7 days, one AI observation
```

#### Integration with Existing Systems

- Reads `stats_daily` — no change to existing data pipeline
- New `goals` and `goal_streaks` tables added to DB migration
- "Inject into Tracker Mind" on weekly check-in shares goals + progress with the coding agent workspace
- Goal-parsed apps are matched against existing app categories from `categories` table
- Progress computation can run as part of the existing daily data refresh cycle

#### Implementation Effort

New files: `src/pages/GoalsTab.tsx`, `src/components/GoalCard.tsx`, `src/components/GoalCreateModal.tsx`  
Modified files: `src/pages/ProductivityPage.tsx` (add tab), `src/main.ts` (4 new handlers), `src/preload.ts`  
DB migration: 2 new tables  
Estimated: ~600 lines new code, 80 lines modified existing

---

## Part 3: Shared Infrastructure

### IPC Design

All AI calls route through a single `AIService` class in `main.ts`. This avoids duplicating API key management, model configuration, and error handling across features.

**Generic handler pattern:**
```typescript
// main.ts — shared AI caller
class AIService {
  private config: AIConfig = loadAIConfig(); // from safeStorage
  
  async call(params: {
    feature: string,
    messages: ChatMessage[],
    maxTokens: number,
    stream: boolean,
    streamTarget?: WebContents
  }): Promise<string | void> {
    const model = this.config.featureModels[params.feature] ?? this.config.defaultModel;
    const provider = PROVIDERS[model.provider];
    // ... fetch call with streaming if requested
  }
}
```

**Registered IPC handlers:**
```
ai-chat-message          → AIService.call({ feature: 'chat', stream: true })
get-ai-brief             → AIService.call({ feature: 'brief', stream: false })
regenerate-ai-brief      → AIService.call({ feature: 'brief', stream: false })
ai-parse-goal            → AIService.call({ feature: 'goals', stream: false })
ai-classify-apps         → AIService.call({ feature: 'classify', stream: false })
get-ai-config            → returns current AIConfig (no API keys, safe)
save-ai-config           → writes to safeStorage
```

### Model Configuration

New section in `Settings` page — "AI Assistant" tab:

```
Settings → AI Assistant
├── Enable AI Features [toggle]
├── Provider
│   ├── [GLM / z.ai]  ← default (free)
│   ├── [DeepSeek direct]
│   └── [OpenRouter]
├── API Key [password input] [Test] [Save]
├── Per-feature model override (collapsible):
│   ├── Daily Brief: [GLM-4.7-Flash ▾]
│   ├── Weekly Review: [DeepSeek V4 Flash ▾]
│   ├── Data Chat: [DeepSeek V4 Flash ▾]
│   └── Goal Parsing: [GLM-4.7-Flash ▾]
└── Usage this month: 12,400 tokens (~$0.002)
```

Config stored as JSON in `ai_config` table (keys separately in safeStorage):
```json
{
  "enabled": true,
  "defaultProvider": "glm",
  "featureModels": {
    "brief": { "provider": "glm", "model": "glm-4-flash" },
    "chat": { "provider": "deepseek", "model": "deepseek-chat" },
    "goals": { "provider": "glm", "model": "glm-4-flash" }
  }
}
```

### API Key Management

Using `Electron.safeStorage` — encrypts with OS keychain (Windows DPAPI, macOS Keychain, Linux libsecret):

```typescript
// main.ts
import { safeStorage } from 'electron';

function saveApiKey(provider: string, key: string): void {
  const encrypted = safeStorage.encryptString(key);
  fs.writeFileSync(path.join(app.getPath('userData'), `ai-key-${provider}.enc`), encrypted);
}

function getApiKey(provider: string): string | null {
  const file = path.join(app.getPath('userData'), `ai-key-${provider}.enc`);
  if (!fs.existsSync(file)) return null;
  return safeStorage.decryptString(fs.readFileSync(file));
}
```

For GLM (free, no key needed for basic tier): uses Puter.js as a zero-key fallback until the user configures their own key.

### Cost Management

**Token tracking table:**
```sql
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

**Hard limits (configurable in Settings):**
- Default monthly cap: $2.00
- When cap approached (80%): switch all non-critical features to GLM free tier
- When cap reached: disable all paid features, show notification

**Budget-aware model selection in AIService:**
```typescript
function selectModel(feature: string, monthlySpend: number): ModelConfig {
  if (monthlySpend > MONTHLY_CAP * 0.8) {
    return FREE_MODELS[feature] ?? GLM_FLASH; // downgrade to free
  }
  return this.config.featureModels[feature] ?? this.config.defaultModel;
}
```

### Fallback Strategy

**Provider fallback chain (per feature):**
```
Primary: configured provider
  → If timeout/error: OpenRouter (if key exists)
    → If unavailable: GLM-4.7-Flash (free, always available)
      → If all fail: show cached result or "AI unavailable" state
```

**Offline behavior:** All AI features check for network before calling. If offline:
- Daily Brief: shows last cached brief with "Generated X days ago" label
- Data Chat: shows "AI chat requires internet connection"
- Goal progress: works fully offline (pure SQL computation, no AI needed after initial parse)
- Category suggestions: queues new apps, processes when online

### Response Streaming

Streaming responses flow from `main.ts` → renderer via `webContents.send` events.

**Renderer subscription pattern:**
```typescript
// In component (e.g. AIChatPanel.tsx)
useEffect(() => {
  const unsub = window.deskflowAPI.onAiStream(({ chunk, done, sessionId }) => {
    if (sessionId !== currentSessionId) return;
    if (done) {
      setStreaming(false);
    } else {
      setResponse(prev => prev + chunk);
    }
  });
  return unsub; // cleanup on unmount
}, [currentSessionId]);
```

**Preload bridge:**
```typescript
// preload.ts additions
onAiStream: (cb: (data: { chunk: string, done: boolean, sessionId: string }) => void) => {
  const handler = (_: any, data: any) => cb(data);
  ipcRenderer.on('ai-chat-stream', handler);
  return () => ipcRenderer.removeListener('ai-chat-stream', handler);
},
```

Non-streaming responses (brief generation, goal parsing) return directly from `invoke` — no streaming needed since they're background operations with a result displayed after completion.

---

## Implementation Roadmap

| Phase | Features | Effort | Models used | Cost |
|-------|---------|--------|-------------|------|
| 1 (week 1) | Daily Digest, AI Config in Settings, shared AIService | ~400 lines | GLM-4.7-Flash | Free |
| 2 (week 2) | Data Chat panel | ~500 lines | DeepSeek V4 Flash | ~$0.01/day |
| 3 (week 3) | Goal Coach | ~600 lines | GLM (parse) + DeepSeek (check-in) | ~$0.001/week |
| 4 (week 4) | Weekly Review, Agent Chat type, Category Suggestions | ~400 lines | GLM + DeepSeek | ~$0.002/week |
| Later | Topic Research Digest, Anomaly Detector, Distraction Interrupt | ~800 lines | DeepSeek Pro | ~$0.05/week |

Start with Phase 1 — it establishes the AIService, Settings UI, safeStorage key management, and GLM integration that every other feature builds on. Nothing in Phase 2+ can ship without Phase 1's infrastructure.
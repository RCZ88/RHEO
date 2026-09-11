# Free AI Integration — Feature Specification

## Part 1: Feature Catalog (15 Features)

### Category A: Analysis & Insights

#### Feature 1: AI Activity Insights
- **What it does:** Analyzes your weekly app usage patterns and surfaces non-obvious insights — "You're 40% more productive on Tuesdays," "Your VS Code sessions after 9pm average 2.3x longer but produce fewer commits," "You switch to Slack within 4 minutes of opening Stack Overflow 78% of the time."
- **Model:** DeepSeek V4 Flash ($0.14/M) — needs reasoning over structured data, but not heavy logic
- **Page:** Dashboard (new section below weekly overview) + Insights page
- **Data:** Last 30 days of `logs` table, aggregated by hour/day/app/category
- **Value:** Users can't see their own patterns. AI spots what spreadsheets can't.
- **Feasibility:** Easy — single IPC call, single GlassCard, no streaming needed

#### Feature 2: Distraction Pattern Detector
- **What it does:** Identifies when and why you get pulled off-task. Correlates distracting app opens with preceding events (e.g., "You open YouTube within 6 minutes of a build failure 62% of the time").
- **Model:** DeepSeek V3.2 ($0.27/M) — structured correlation analysis, doesn't need flagship reasoning
- **Page:** Productivity page (new "Distraction Analysis" card)
- **Data:** `logs` table filtered by tier (distracting), with preceding-app sequence
- **Value:** Turns vague "I get distracted" into actionable "Here's exactly when and why."
- **Feasibility:** Medium — needs sequential log analysis, not just aggregation

#### Feature 3: Focus Session Optimizer
- **What it does:** Recommends optimal focus blocks based on historical productivity patterns. "Your best deep work happens 10am-12pm on Wed/Thu — protect that time." Generates calendar-ready blocks.
- **Model:** GLM-4.7-Flash (free) — pattern matching on aggregated data, lightweight reasoning
- **Page:** Dashboard (floating card) + Productivity page
- **Data:** `stats_hourly` grouped by day-of-week × hour, filtered by productive tier
- **Value:** Data-driven schedule optimization — no guessing.
- **Feasibility:** Easy — works off pre-aggregated data, single API call

#### Feature 4: Weekly Engineering Summary
- **What it does:** Generates a dev-team-style weekly status report from your actual activity. "This week: 18h in VS Code (3 projects), fixed 4 bugs (2 critical), 23 commits across 6 repos, top focus area: authentication system."
- **Model:** DeepSeek V4 Flash ($0.14/M) — needs to synthesize diverse data types into prose
- **Page:** Stats page (new "AI Summary" tab)
- **Data:** App logs (IDE time), terminal session topics, problem/request status changes, commit patterns
- **Value:** Replaces manual standup notes. Auto-generates weekly report.
- **Feasibility:** Medium — pulls from multiple data sources (logs + sessions + problems)

### Category B: Daily/Weekly AI Briefings

#### Feature 5: Daily AI Briefing
- **What it does:** Every morning (or on-demand), generates a personalized briefing: yesterday's summary, today's focus recommendation, topic research digest (from user-selected interests), and any anomalies detected.
- **Model:** DeepSeek V4 Flash for summary + GLM-4.7-Flash for topic research (free tier)
- **Page:** New "Briefing" tab on Dashboard, or standalone overlay on app launch
- **Data:** Yesterday's logs, problem/request changes, user interest topics, recent anomalies
- **Value:** Start every day with a smart summary instead of scrolling through raw data.
- **Feasibility:** Medium — scheduled background task + multi-step prompt chain

#### Feature 6: Topic Research Digest
- **What it does:** User defines interest topics (e.g., "Rust async patterns", "AI agent architectures"). AI researches each topic daily using its training knowledge, produces 3-paragraph summaries with key developments.
- **Model:** DeepSeek V4 Pro ($0.435/M) — needs broad knowledge + synthesis
- **Page:** New "Research" section on Dashboard or External page
- **Data:** User-configured topic list + last 7 days of topic-related browsing history (as signal)
- **Value:** Personalized daily research without leaving the app.
- **Feasibility:** Medium — needs topic persistence + scheduled execution

#### Feature 7: Activity Anomaly Alerts
- **What it does:** Runs silently in background. When it detects unusual patterns (productivity drop >30%, new app appearing in top 5, sleep schedule shift), generates a brief explanation and surfaces it.
- **Model:** GLM-4.7-Flash (free) — simple threshold comparison + short explanation
- **Page:** Notification toast + Dashboard "Alerts" section
- **Data:** Comparing current period vs. rolling 30-day average from `stats_daily`
- **Value:** Proactive awareness. "You've been using Discord 3x more this week — is this intentional?"
- **Feasibility:** Easy — threshold logic in main process, AI just explains the anomaly

### Category C: Interactive AI Assistant

#### Feature 8: Activity Chat
- **What it does:** Natural language query interface for your tracking data. "What did I work on last Tuesday?" "How much time did I spend in Figma this month?" "When was the last time I used Blender?"
- **Model:** DeepSeek V4 Flash ($0.14/M) — needs SQL generation + natural language understanding
- **Page:** New floating chat panel (accessible from any page via keyboard shortcut or sidebar)
- **Data:** Read access to all SQLite tables (logs, stats_daily, stats_hourly, terminal_sessions, productivity_sessions)
- **Value:** No more clicking through pages to find answers. Ask naturally.
- **Feasibility:** Medium — needs SQL generation pipeline + safety guardrails

#### Feature 9: Productivity Coach
- **What it does:** Interactive AI coach that analyzes your work patterns and provides personalized advice. "I notice you context-switch every 12 minutes on average. Try the Pomodoro technique — your data shows 25-min blocks triple your productive output."
- **Model:** DeepSeek V4 Pro ($0.435/M) — needs deep reasoning + empathetic communication
- **Page:** Productivity page (chat interface)
- **Data:** Historical productivity scores, focus session data, distraction patterns
- **Value:** Turns raw tracking data into actionable coaching.
- **Feasibility:** Hard — needs persistent conversation context + multi-turn reasoning

#### Feature 10: Session Context Chat
- **What it does:** Chat with individual terminal sessions' context. "What was the main issue with the auth module?" AI answers based on that session's messages and problems.
- **Model:** GLM-4.7-Flash (free) — retrieval from existing session messages, lightweight
- **Page:** Terminal page (chat overlay on session detail)
- **Data:** `terminal_messages` for the selected session + linked problems/requests
- **Value:** Remember what each agent was working on without reading full scrollback.
- **Feasibility:** Medium — needs message retrieval + context window management

### Category D: Automation & Suggestions

#### Feature 11: Smart App Categorization
- **What it does:** When a new app appears that isn't in the category map, AI auto-classifies it. "Detected 'Warp Terminal' → categorized as 'Developer Tools'."
- **Model:** GLM-4.7-Flash (free) — simple classification, tiny prompt
- **Page:** Runs automatically in background, shows suggestion in Settings
- **Data:** New app names not found in `DEFAULT_APP_CATEGORIES` or `categoryConfig.detectedApps`
- **Value:** No more manual categorization. Catches new apps instantly.
- **Feasibility:** Easy — single classification call, deterministic output

#### Feature 12: Daily Plan Generator
- **What it does:** Based on yesterday's incomplete work + today's calendar + your productivity patterns, generates a prioritized daily plan. "Morning: finish auth bug (2h focus block 10-12). Afternoon: review PRs (low-energy period 2-3pm)."
- **Model:** DeepSeek V4 Flash ($0.14/M) — multi-factor planning, moderate reasoning
- **Page:** Dashboard (replaces/adds to current daily view)
- **Data:** Open problems, recent sessions, productivity patterns by hour
- **Value:** Data-driven daily planning instead of ad-hoc task selection.
- **Feasibility:** Medium — needs problem/request state + time pattern data

#### Feature 13: Auto-Tagging Sessions
- **What it does:** After each terminal session ends, AI generates tags describing what was worked on. Tags stored in `auto_tags` field. Enables search and filtering.
- **Model:** GLM-4.7-Flash (free) — simple tagging from session messages
- **Page:** Automatic background process, visible in session detail
- **Data:** Last 20 messages from the ended session
- **Value:** Sessions become searchable and filterable by content, not just name.
- **Feasibility:** Easy — hook into existing session-end flow, single short API call

### Category E: Cross-Model Orchestration

#### Feature 14: Tiered AI Pipeline
- **What it does:** Routes requests to the cheapest capable model. Simple classification → GLM-4.7-Flash (free). Analysis → DeepSeek V4 Flash ($0.14/M). Complex reasoning → DeepSeek V4 Pro ($0.435/M). User configures thresholds.
- **Model:** All three tiers — that's the point
- **Page:** Settings (AI Configuration section)
- **Data:** Model capabilities + pricing data + user preferences
- **Value:** Minimize cost while maximizing quality. Never waste expensive tokens on simple tasks.
- **Feasibility:** Medium — needs model registry + routing logic + cost tracking

#### Feature 15: Research Agent (Background)
- **What it does:** A persistent background AI agent that continuously researches user-defined topics. Stores findings in a knowledge base. User can query it anytime. "What's new in Rust async since last week?"
- **Model:** GLM-4.7-Flash (free) for periodic research + DeepSeek V4 Flash for synthesis
- **Page:** New "Knowledge" tab or section on External page
- **Data:** User interest topics + stored research results
- **Value:** Always-on research assistant that builds knowledge over time.
- **Feasibility:** Hard — needs background scheduling + knowledge persistence + deduplication

---

## Part 2: Top 3 Deep Dives

### Feature 5: Daily AI Briefing

#### User Flow

```
1. User opens DeskFlow in the morning
2. Dashboard loads → "Today's Briefing" card appears at top with "Generating..." state
3. After 3-5 seconds, card shows:
   ┌─────────────────────────────────────────────────┐
   │ ☀️ Daily Briefing · Monday, Jun 9              │
   │                                                  │
   │ Yesterday: 6.2h productive (12% above avg)      │
   │ • Completed: auth bug fix (3.1h in VS Code)     │
   │ • Started: API rate limiter (2 sessions)         │
   │ • Alert: Discord usage up 40% vs last week      │
   │                                                  │
   │ Today's Focus:                                  │
   │ → Continue rate limiter (carry-over from Fri)    │
   │ → Your best focus window: 10am-12pm             │
   │                                                  │
   │ Research Digest:                                │
   │ • Rust: async closures stabilized in 1.87       │
   │ • AI: DeepSeek V4 benchmarks released           │
   │                                                  │
   │ [Open Full Briefing]  [Dismiss]                 │
   └─────────────────────────────────────────────────┘
4. Click "Open Full Briefing" → expands to full page with sections
5. Click "Dismiss" → card collapses, returns next morning
6. User can also trigger manually via sidebar button
```

#### Technical Architecture

```
Renderer (DashboardPage)
  │
  ├── useState: briefingData, briefingLoading
  │
  ├── useEffect (on mount + daily interval)
  │   └── IPC: get-daily-briefing
  │       │
  │       ▼
  │   Main Process
  │       │
  │       ├── 1. Fetch yesterday's stats
  │       │   └── SQL: SELECT ... FROM stats_daily WHERE date = yesterday
  │       │   └── SQL: SELECT ... FROM logs WHERE date = yesterday AND tier = productive
  │       │
  │       ├── 2. Fetch recent problems/requests
  │       │   └── Read agent/problems.json + agent/requests.json
  │       │
  │       ├── 3. Fetch anomaly data
  │       │   └── Compare current week vs rolling average
  │       │
  │       ├── 4. Fetch research topics
  │       │   └── Read agent/context/interests.json
  │       │
  │       ├── 5. Call AI (DeepSeek V4 Flash)
  │       │   └── POST https://openrouter.ai/api/v1/chat/completions
  │       │       System: "You are a productivity briefing generator..."
  │       │       User: { yesterday's data + anomalies + interests }
  │       │
  │       ├── 6. Parse response → structured JSON
  │       │
  │       └── 7. Return to renderer
  │
  └── Render briefing card
```

#### API Integration

**IPC Handler:** `get-daily-briefing`

```typescript
// main.ts
ipcMain.handle('get-daily-briefing', async () => {
  const config = getAIConfig(); // user's model/key preferences
  const yesterday = getDateStr(-1);
  
  // Gather data
  const stats = db.prepare(`
    SELECT app_name, total_seconds, category 
    FROM stats_daily WHERE date = ?
  `).all(yesterday);
  
  const productiveTime = db.prepare(`
    SELECT SUM(total_seconds) as total FROM stats_daily 
    WHERE date = ? AND app_name IN (${productiveApps})
  `).get(yesterday);
  
  const problems = readProblemsFile();
  const recentProblems = problems.filter(p => 
    p.updated_at?.startsWith(yesterday)
  );
  
  const interests = getInterests(); // from config
  
  // Build prompt
  const systemPrompt = `You are a personalized daily briefing generator for a developer. 
Given yesterday's activity data, produce a concise morning briefing.
Format as JSON: { "summary": string, "highlights": string[], "focus": string, "anomalies": string[], "research": { topic: string, summary: string }[] }
Keep total output under 400 words. Be direct and actionable.`;

  const userPrompt = `Yesterday's data:
- Productive time: ${productiveTime?.total || 0}s
- Top apps: ${stats.slice(0, 10).map(s => `${s.app_name}(${Math.round(s.total_seconds/60)}m)`).join(', ')}
- Problems updated: ${recentProblems.map(p => p.title).join(', ') || 'none'}
- Research interests: ${interests.join(', ') || 'none configured'}
- 7-day avg productive: ${getWeeklyAvg()}s`;

  const result = await callAIModel({
    model: config.briefingModel || 'deepseek/deepseek-chat-v3-0324',
    systemPrompt,
    userPrompt,
    maxTokens: 800,
    temperature: 0.4,
    apiKey: config.apiKey,
  });

  return { 
    success: true, 
    data: parseJSON(result.content),
    model: result.model,
    tokensUsed: result.usage 
  };
});
```

#### UI Layout

```tsx
// DashboardPage.tsx — new section

<SectionHeader 
  icon={<Sun className="w-4 h-4" />} 
  title="Daily Briefing" 
  action={<button onClick={fetchBriefing} className="..."><RefreshCw /></button>}
/>

{briefingLoading ? (
  <GlassCard><LoadingState /></GlassCard>
) : briefingData ? (
  <GlassCard accent accentColor="var(--warning)">
    <div className="space-y-3">
      <p className="text-xs text-zinc-300">{briefingData.summary}</p>
      
      {briefingData.highlights?.length > 0 && (
        <div>
          <span className="text-[10px] text-zinc-500 font-medium">Highlights</span>
          <ul className="text-[11px] text-zinc-400 mt-1 space-y-0.5">
            {briefingData.highlights.map((h, i) => <li key={i}>• {h}</li>)}
          </ul>
        </div>
      )}
      
      {briefingData.focus && (
        <div className="bg-[var(--page-accent)]/10 rounded-lg px-3 py-2">
          <span className="text-[10px] text-[var(--page-accent)]">→ Today's Focus</span>
          <p className="text-xs text-zinc-300 mt-0.5">{briefingData.focus}</p>
        </div>
      )}
      
      {briefingData.research?.length > 0 && (
        <div>
          <span className="text-[10px] text-zinc-500 font-medium">Research Digest</span>
          {briefingData.research.map((r, i) => (
            <div key={i} className="mt-1">
              <span className="text-[10px] text-cyan-400">{r.topic}</span>
              <p className="text-[10px] text-zinc-500">{r.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  </GlassCard>
) : null}
```

#### Integration Points
- **Settings page:** New "AI Configuration" section for model selection, API key, interests
- **Dashboard:** Primary display location
- **IPC:** `get-daily-briefing` (new handler)
- **Background:** Optional: auto-generate on app launch if last briefing > 12h old

#### Implementation Effort
- **Files to modify:** 4 (DashboardPage, main.ts, preload.ts, SettingsPage)
- **New IPC handlers:** 1 (`get-daily-briefing`)
- **Complexity:** Medium — single AI call with multi-source data aggregation

---

### Feature 8: Activity Chat

#### User Flow

```
1. User presses Cmd+K (or clicks chat icon in sidebar)
2. Chat panel slides in from right (like Spotlight/Raycast)
3. Input field with placeholder: "Ask about your activity..."
4. User types: "What did I work on last Tuesday?"
5. Loading state (2-4 seconds)
6. AI response appears: 
   "Last Tuesday (Jun 3) you worked 7.2 hours across 4 apps:
    • VS Code: 4.1h (auth module, API rate limiter)
    • Chrome: 1.8h (Stack Overflow, GitHub PRs)
    • Terminal: 1.0h (git commits, npm scripts)
    • Figma: 0.3h (button component redesign)
    You had 2 focus sessions totaling 2.5h."
7. User follows up: "How does that compare to usual?"
8. AI responds with comparison to weekly average
9. User presses Esc or clicks backdrop → panel closes
```

#### Technical Architecture

```
Renderer (ActivityChatPanel)
  │
  ├── useState: messages[], isLoading
  │
  ├── handleSend(userMessage)
  │   └── IPC: chat-with-activity { message, conversationHistory }
  │       │
  │       ▼
  │   Main Process
  │       │
  │       ├── 1. Analyze query intent
  │       │   └── "What did I work on last Tuesday" → time_range=last_tuesday, type=summary
  │       │
  │       ├── 2. Fetch relevant data
  │       │   └── SQL queries based on intent:
  │       │       - Time range queries (stats_daily, stats_hourly)
  │       │       - App-specific queries (logs WHERE app LIKE ?)
  │       │       - Session queries (terminal_sessions WHERE ...)
  │       │       - Problem/request queries
  │       │
  │       ├── 3. Build context
  │       │   └── Format fetched data as structured context block
  │       │
  │       ├── 4. Call AI (streaming)
  │       │   └── System: "You are an assistant that answers questions about the user's activity data."
  │       │   User: { query + fetched_data + conversation_history }
  │       │   Stream: true → IPC events for each chunk
  │       │
  │       └── 5. Return/Stream response
  │           ├── Event: 'chat-chunk' { content, done }
  │           └── Final: 'chat-complete' { fullContent, tokensUsed }
  │
  └── Render messages with streaming
```

#### API Integration

**IPC Handler:** `chat-with-activity`

```typescript
// main.ts
ipcMain.handle('chat-with-activity', async (_event, request: {
  message: string;
  history: Array<{role: string; content: string}>;
}) => {
  const { message, history } = request;
  const config = getAIConfig();
  
  // Step 1: Extract time references and intent
  const intentPrompt = `Extract from this query: time_range (today/yesterday/last_week/last_month/specific_date), apps_mentioned, query_type (summary/comparison/detail/list).
Query: "${message}"
Respond as JSON only.`;
  
  const intentResult = await callAIModel({
    model: 'glm-4-flash', // Free model for intent parsing
    userPrompt: intentPrompt,
    maxTokens: 100,
    temperature: 0,
    apiKey: config.apiKey,
  });
  
  const intent = parseJSON(intentResult.content) || { time_range: 'today', query_type: 'summary' };
  
  // Step 2: Fetch data based on intent
  const data = fetchActivityData(intent);
  
  // Step 3: Build context
  const contextBlock = formatDataForAI(data, intent);
  
  // Step 4: Call AI with context
  const systemPrompt = `You are a helpful assistant that answers questions about the user's computer activity and productivity data. You have access to their actual tracking data below. Answer precisely with specific numbers and times. If the data doesn't contain the answer, say so.

ACTIVITY DATA:
${contextBlock}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6), // Keep last 3 exchanges
    { role: 'user', content: message }
  ];
  
  const result = await callAIModel({
    model: config.chatModel || 'deepseek/deepseek-chat-v3-0324',
    messages,
    maxTokens: 1000,
    temperature: 0.3,
    apiKey: config.apiKey,
  });
  
  return {
    success: true,
    content: result.content,
    tokensUsed: result.usage,
    model: result.model,
  };
});

// Helper: fetch relevant data
function fetchActivityData(intent: any) {
  const range = resolveTimeRange(intent.time_range);
  
  return {
    dailyStats: db.prepare(`
      SELECT app_name, total_seconds, category 
      FROM stats_daily WHERE date BETWEEN ? AND ?
    `).all(range.start, range.end),
    
    sessions: db.prepare(`
      SELECT topic, agent, status, total_tokens, created_at
      FROM terminal_sessions 
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC LIMIT 10
    `).all(range.start + 'T00:00:00', range.end + 'T23:59:59'),
    
    problems: readProblemsFile().filter(p => 
      p.updated_at >= range.start
    ).slice(0, 10),
  };
}
```

#### UI Layout

```
┌─────────────────────────────────────────────────────┐
│ 💬 Activity Chat                            [✕]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🤖 I can answer questions about your activity      │
│     tracking data. Try asking:                      │
│     • "What did I work on yesterday?"               │
│     • "How much time in VS Code this week?"         │
│     • "When did I last use Figma?"                  │
│                                                     │
│  👤 What did I work on last Tuesday?                │
│                                                     │
│  🤖 Last Tuesday (Jun 3) you worked 7.2h:          │
│     • VS Code: 4.1h (auth, rate limiter)            │
│     • Chrome: 1.8h (SO, GitHub)                     │
│     • Terminal: 1.0h (git, npm)                     │
│     2 focus sessions, 2.5h total.                   │
│                                                     │
│  👤 How vs usual?                                   │
│                                                     │
│  🤖 12% above your Tuesday average (6.4h).         │
│     VS Code time was typical but Chrome             │
│     was up 40% — mostly GitHub PR reviews.          │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [🔍 Ask about your activity...          ] [Send ➤] │
└─────────────────────────────────────────────────────┘
```

**Component tree:**
```
ActivityChatPanel (fixed overlay, right side)
├── ChatHeader (icon + title + close)
├── MessageList (scrollable)
│   ├── SystemMessage (intro)
│   ├── UserMessage
│   └── AssistantMessage (markdown rendered)
├── QuickPrompts (suggestion chips)
└── ChatInput (input + send button)
```

#### Integration Points
- **Global:** Accessible from any page via keyboard shortcut
- **Data:** Read-only access to all tracking tables
- **Settings:** Model selection for chat (default: DeepSeek V3.2)
- **IPC:** `chat-with-activity` (new), `get-ai-config` (shared)

#### Implementation Effort
- **Files:** 5 (new ActivityChatPanel.tsx, main.ts, preload.ts, App.tsx for shortcut, SettingsPage)
- **New IPC handlers:** 2 (`chat-with-activity`, intent parsing reuses `call-ai-model`)
- **Complexity:** Medium-Hard — needs intent parsing, data retrieval, conversation management

---

### Feature 11: Smart App Categorization

#### User Flow

```
1. New app detected by pollForeground() — not in category map
2. Main process: "Unknown app: 'Warp'" 
3. AI classifies: "Developer Tools" (confidence: 0.95)
4. Notification toast: " Classified 'Warp' as Developer Tools ✓"
5. Auto-applied to categoryConfig.detectedApps
6. Appears correctly in dashboard immediately
7. Settings page shows recent auto-categorizations (audit trail)
```

#### Technical Architecture

```
Main Process (pollForeground)
  │
  ├── New app detected → not in categoryConfig
  │
  ├── classifyAppViaAI(appName)
  │   ├── Check local cache first (persisted classifications)
  │   ├── If uncached: call GLM-4.7-Flash (free)
  │   │   System: "Classify app into one of: IDE, Browser, AI Tools, 
  │   │            Entertainment, Communication, Design, Productivity, 
  │   │            Developer Tools, Tools, News, Shopping, Social Media, Other"
  │   │   User: "Warp"
  │   │   → "Developer Tools"
  │   │
  │   ├── Cache result in categoryConfig.detectedApps
  │   └── Save categoryConfig
  │
  ├── If confidence > 0.8: auto-apply
  └── If confidence 0.5-0.8: show suggestion toast
  └── If confidence < 0.5: leave uncategorized
```

#### API Integration

```typescript
// main.ts — add to categorizeApp() function
async function classifyAppViaAI(appName: string): Promise<{category: string, confidence: number}> {
  const config = getAIConfig();
  
  // Check cache first
  const cachePath = path.join(getAppDataPath(), 'ai-category-cache.json');
  const cache = readJSON(cachePath) || {};
  if (cache[appName]) return cache[appName];
  
  // Call AI (GLM-4.7-Flash = free)
  const result = await callAIModel({
    model: config.classificationModel || 'google/gemini-2.0-flash-001',
    systemPrompt: `Classify this app name into exactly one category. Respond as JSON: {"category":"...","confidence":0.0-1.0}
Categories: IDE, Browser, AI Tools, Entertainment, Communication, Design, Productivity, Developer Tools, Tools, News, Shopping, Social Media, Other`,
    userPrompt: appName,
    maxTokens: 50,
    temperature: 0,
    apiKey: config.apiKey,
  });
  
  const parsed = parseJSON(result.content) || { category: 'Other', confidence: 0.3 };
  
  // Cache it
  cache[appName] = parsed;
  writeJSON(cachePath, cache);
  
  return parsed;
}
```

#### UI Layout

No new page needed. Integration is:
- **Toast notification** (existing pattern)
- **Settings page audit log** (new section in Categories tab)

```
Settings → Categories tab
  ├── Existing: category management
  └── New: "AI Classifications" section
      ├── Recent auto-classifications list
      │   • Warp → Developer Tools (AI, 95%) [Override]
      │   • Notion → Productivity (AI, 92%) [Override]
      │   • Figma → Design (AI, 98%) [Override]
      └── [Classify All Uncategorised] button
```

#### Integration Points
- **Main process:** Extends existing `categorizeApp()` with AI fallback
- **Settings:** New audit section + "Classify All" button
- **IPC:** `classify-app-ai` (new), `get-ai-classifications` (new for audit log)
- **No renderer changes needed** for auto-classification (main process handles it)

#### Implementation Effort
- **Files:** 3 (main.ts, preload.ts, SettingsPage)
- **New IPC handlers:** 2
- **Complexity:** Easy — single classification call, tiny prompt, cacheable

---

## Part 3: Shared Infrastructure

### IPC Design

**Single generic handler + per-feature convenience handlers:**

```typescript
// ═══ Core: Generic AI model call ═══════════════════════════════
ipcMain.handle('call-ai-model', async (_event, request: {
  systemPrompt: string;
  userPrompt?: string;
  messages?: Array<{role: string; content: string}>;
  model?: string;        // override default
  maxTokens?: number;
  temperature?: number;
  feature: string;       // "briefing" | "chat" | "classification" | etc.
}) => {
  const config = getAIConfig();
  
  // Resolve model from feature config or override
  const model = request.model || config.featureModels?.[request.feature] || config.defaultModel || 'deepseek/deepseek-chat-v3-0324';
  
  // Check rate limits
  const usage = getFeatureUsage(request.feature);
  if (usage.callsToday >= (config.dailyLimits?.[request.feature] || 50)) {
    return { success: false, error: 'Daily limit reached for this feature' };
  }
  
  // Call API
  const result = await callAIModel({
    model,
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    messages: request.messages,
    maxTokens: request.maxTokens || 800,
    temperature: request.temperature ?? 0.3,
    apiKey: config.apiKey,
  });
  
  // Track usage
  trackAIUsage({
    feature: request.feature,
    model,
    inputTokens: result.usage?.prompt_tokens || 0,
    outputTokens: result.usage?.completion_tokens || 0,
    costUsd: computeCost(result.usage, model),
  });
  
  return {
    success: true,
    content: result.content,
    usage: result.usage,
    model: result.model || model,
  };
});

// ═══ Streaming variant ═══════════════════════════════════════
ipcMain.handle('call-ai-model-stream', async (event, request: {
  systemPrompt: string;
  messages: Array<{role: string; content: string}>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  feature: string;
}) => {
  const config = getAIConfig();
  const model = request.model || config.featureModels?.[request.feature] || config.defaultModel;
  
  // Stream via fetch with ReadableStream
  const response = await fetch(getModelEndpoint(model), {
    method: 'POST',
    headers: getAPIHeaders(config.apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        ...request.messages,
      ],
      max_tokens: request.maxTokens || 1000,
      temperature: request.temperature ?? 0.3,
      stream: true,
    }),
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    // Parse SSE format
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(line.slice(6));
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            event.sender.send('ai-stream-chunk', { 
              feature: request.feature, 
              content: delta, 
              done: false 
            });
          }
        } catch {}
      }
    }
  }
  
  event.sender.send('ai-stream-chunk', { 
    feature: request.feature, 
    content: '', 
    done: true, 
    fullContent 
  });
  
  return { success: true, content: fullContent };
});
```

### Model Configuration

**Settings page section:**

```
Settings → AI Configuration
  ├── Provider: [OpenRouter ▼]
  ├── API Key: [••••••••••••••••] [Test Connection]
  ├── Default Model: [DeepSeek V3.2 ▼]
  │
  ├── Per-Feature Model Override:
  │   ├── Briefing: [DeepSeek V4 Flash ▼]
  │   ├── Chat: [DeepSeek V3.2 ▼]
  │   ├── Classification: [GLM-4.7-Flash (Free) ▼]
  │   └── Insights: [DeepSeek V4 Pro ▼]
  │
  ├── Research Interests:
  │   ├── [Rust async patterns] [×]
  │   ├── [AI agent architectures] [×]
  │   ├── [+ Add topic]
  │
  ├── Daily Limits:
  │   ├── Briefing: [3/day]
  │   ├── Chat: [50/day]
  │   └── Classification: [∞]
  │
  └── Usage This Month:
      ├── Calls: 47
      ├── Tokens: 234K
      └── Est. Cost: $0.08
```

**Storage:** `agent/context/ai-config.json`

```json
{
  "provider": "openrouter",
  "apiKey": "sk-or-...",
  "defaultModel": "deepseek/deepseek-chat-v3-0324",
  "featureModels": {
    "briefing": "deepseek/deepseek-chat-v3-0324",
    "chat": "deepseek/deepseek-chat-v3-0324",
    "classification": "google/gemini-2.0-flash-001",
    "insights": "deepseek/deepseek-r1"
  },
  "dailyLimits": {
    "briefing": 3,
    "chat": 50,
    "classification": 999,
    "insights": 10
  },
  "interests": ["Rust async patterns", "AI agent architectures"]
}
```

### API Key Management

**Approach:** Electron `safeStorage` for encryption, fallback to base64 obfuscation.

```typescript
// main.ts
import { safeStorage } from 'electron';

function saveAPIKey(key: string): void {
  const encrypted = safeStorage.encryptString(key);
  fs.writeFileSync(
    path.join(getAppDataPath(), 'ai-key.enc'),
    encrypted
  );
}

function loadAPIKey(): string | null {
  const encPath = path.join(getAppDataPath(), 'ai-key.enc');
  if (!fs.existsSync(encPath)) return null;
  const encrypted = fs.readFileSync(encPath);
  return safeStorage.decryptString(encrypted);
}
```

**IPC handlers:**

```typescript
ipcMain.handle('save-ai-key', async (_, key: string) => {
  saveAPIKey(key);
  return { success: true };
});

ipcMain.handle('get-ai-config', async () => {
  const config = loadAIConfig();
  return {
    ...config,
    hasApiKey: !!loadAPIKey(),
    apiKeyPreview: loadAPIKey()?.substring(0, 8) + '...',
  };
});

ipcMain.handle('test-ai-connection', async () => {
  const apiKey = loadAPIKey();
  if (!apiKey) return { success: false, error: 'No API key' };
  try {
    const result = await callAIModel({
      model: loadAIConfig().defaultModel,
      systemPrompt: 'Respond with: connected',
      userPrompt: 'test',
      maxTokens: 10,
      temperature: 0,
      apiKey,
    });
    return { success: true, model: result.model };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});
```

### Cost Management

**SQLite table for tracking:**

```sql
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  success INTEGER DEFAULT 1
);
```

**Tracking function:**

```typescript
function trackAIUsage(entry: {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  success?: boolean;
}) {
  db.prepare(`
    INSERT INTO ai_usage (feature, model, input_tokens, output_tokens, cost_usd, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.feature,
    entry.model,
    entry.inputTokens,
    entry.outputTokens,
    entry.costUsd,
    entry.success ? 1 : 0
  );
}

function getFeatureUsage(feature: string): { callsToday: number; tokensToday: number } {
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare(`
    SELECT COUNT(*) as calls, SUM(input_tokens + output_tokens) as tokens
    FROM ai_usage WHERE feature = ? AND date(timestamp) = ?
  `).get(feature, today);
  return { callsToday: result?.calls || 0, tokensToday: result?.tokens || 0 };
}
```

### Fallback Strategy

```typescript
const MODEL_FALLBACKS: Record<string, string[]> = {
  'deepseek/deepseek-chat-v3-0324': ['deepseek/deepseek-chat', 'google/gemini-2.0-flash-001'],
  'deepseek/deepseek-r1': ['deepseek/deepseek-chat-v3-0324', 'google/gemini-2.0-flash-001'],
  'google/gemini-2.0-flash-001': ['deepseek/deepseek-chat-v3-0324'],
};

async function callAIWithFallback(params: AIModelParams): Promise<AIModelResult> {
  const models = [params.model, ...(MODEL_FALLBACKS[params.model] || [])];
  
  for (const model of models) {
    try {
      return await callAIModel({ ...params, model });
    } catch (err) {
      console.warn(`[AI] Model ${model} failed, trying fallback: ${(err as Error).message}`);
      continue;
    }
  }
  
  // Last resort: GLM-4.7-Flash (free, usually available)
  try {
    return await callAIModel({ ...params, model: 'google/gemini-2.0-flash-001' });
  } catch (err) {
    throw new Error('All AI models failed: ' + (err as Error).message);
  }
}
```

### Response Streaming

**Renderer-side:**

```typescript
// Preload bridge
startAIStream: (request) => ipcRenderer.invoke('call-ai-model-stream', request),
onAIStreamChunk: (callback) => {
  ipcRenderer.on('ai-stream-chunk', (_event, data) => callback(data));
  return () => ipcRenderer.removeListener('ai-stream-chunk', callback);
},

// Component usage
const [streamContent, setStreamContent] = useState('');

const handleStream = async () => {
  setStreamContent('');
  
  const cleanup = window.deskflowAPI.onAIStreamChunk((chunk) => {
    if (chunk.done) return;
    setStreamContent(prev => prev + chunk.content);
  });
  
  await window.deskflowAPI.startAIStream({
    feature: 'chat',
    systemPrompt: '...',
    messages: [...],
  });
  
  cleanup();
};
```
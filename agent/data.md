# 📊 DeskFlow Data Reference

**Purpose:** Document data storage, schemas, and recent changes to database/information.

**Created:** 2026-04-13
**Last Updated:** 2026-06-20

---

## 🗄️ Data Storage Architecture

### Storage Strategy (Hybrid with Fallback)

**Primary:** SQLite via `better-sqlite3`
- **Location:** `%APPDATA%/deskflow/deskflow-data.db` (Windows)
- **Tables:**
  - `logs`: id, timestamp, app, category, duration_ms, title, project, keystrokes, clicks, window_switches, url, domain, tab_id, is_browser_tracking
  - `daily_stats`: id, date, app, category, total_sec, sessions, avg_session_sec, keystrokes, clicks, focus_score, productivity_type, total_time_sec, focus_time_sec (UNIQUE date+app)
  - `daily_aggregates`: id, date, category, total_sec, sessions, focus_score
  - `browser_sessions`: id, date, domain, category, title, total_sec, sessions, last_active

**Bug Reports Table (added 2026-06-18):**
  - `bug_reports`: id (TEXT PRIMARY KEY), project_id (TEXT), title (TEXT), error_text (TEXT), status (TEXT DEFAULT 'pending'), agent_responses (TEXT — JSON array), linked_problem_id (TEXT), flow_type (TEXT DEFAULT 'manual'), root_cause_report (TEXT — JSON), created_at (TEXT), updated_at (TEXT)

**AI Features Tables (added 2026-06-04):**
  - `goals`: id, date, title, description, category (default 'work'), target_type, target_seconds, match_category, status (pending/completed), period (daily/longterm), source, links, progress_seconds, created_at, completed_at, **priority** (added 2026-06-13, INTEGER DEFAULT 0)
  - `ai_briefs`: type (daily/weekly), date (YYYY-MM-DD or week key), content (JSON), model_used, tokens_used, created_at
  - `ai_interests`: id, topic (text), enabled (boolean default 1), created_at
  - `ai_feature_usage`: date, feature (briefing/weekly/topic/anomaly), model, input_tokens, output_tokens, cost_usd, success (boolean), created_at

- **Status:** Preferred, requires native module compilation

**Crypto Wallet Tables (added 2026-06-21):**
  - `finance_crypto_prices`: coin_id (TEXT PK), name (TEXT), symbol (TEXT), current_price (REAL), market_cap (REAL), total_volume (REAL), price_change_24h (REAL), price_change_percentage_24h (REAL), last_updated (TEXT)
  - `finance_crypto_history`: id (INTEGER PK AUTOINCREMENT), coin_id (TEXT), timestamp (INTEGER), price (REAL) — UNIQUE(coin_id, timestamp)

**Fallback:** JSON File
- **Location:** `%APPDATA%/deskflow/deskflow-data.json`
- **Format:** Array of log entries with same schema as SQLite
- **Status:** Automatically used if SQLite fails to initialize

---

## 📝 Recent Data Changes

### 2026-04-13

| Change | Description |
|--------|-------------|
| Tracking state sync | Removed auto-update from heartbeat to fix manual toggle override |
| Browser sessions aggregation | Added updateAggregates() call after browser data insert |
| ProductivityPage period | Removed local state, uses parent prop directly |

---

## 📚 IPC Endpoints (Data-Related)

| Endpoint | Description |
|----------|-------------|
| `get-logs` | Get all log entries |
| `get-logs-by-period` | Get logs filtered by today/week/month/all |
| `get-app-stats` | Get per-app detailed stats |
| `get-daily-stats` | Get daily aggregation for week/month/all |
| `get-daily-productivity` | Get productivity data for specific date |
| `get-productivity-range` | Get productivity scores for date range |
| `get-browser-logs` | Get browser activity logs |
| `get-browser-domain-stats` | Get browser stats by domain |
| `get-browser-category-stats` | Get browser stats by category |
| `get-daily-aggregates` | Get data from daily_aggregates table |
| `get-browser-sessions` | Get data from browser_sessions table |
| `get-sleep-for-date` | Get existing sleep session for a specific date (YYYY-MM-DD). Returns `{ id, started_at, ended_at, device_off_to_sleep_seconds, wake_up_to_app_seconds }` or null. |
| `update-manual-sleep` | Update an existing sleep session by ID. Accepts `(sessionId, { started_at, ended_at, device_off_to_sleep_seconds?, wake_up_to_app_seconds? })`. Returns `{ success }`. |
| `get-typical-day` | **REPLACED** — Returns `{ grid, legend, stats, generatedAt, daysCovered }` (7x24 multi-activity grid). Merges external_sessions + device logs, normalizes per-day, supports multi-activity cells with percentages and colors. |
| `link-problem-to-request` | Links a problem ID to a request in REQUESTS.md. Calls RequestsService.linkProblem(). Accepts `{ requestId, problemId }`. |
| `unlink-problem-from-request` | Removes a problem ID from a request's linked_problems array. Calls RequestsService.unlinkProblem(). Accepts `{ requestId, problemId }`. |
| `detect-project-language` | Scans project directory by file extension to detect primary language. Accepts `projectPath`. Returns `{ success, language, fileCount, totalFiles }`. |
| `terminal:create` | Creates a terminal PTY with specific dimensions + agent readiness. Accepts `(id, cwd, cols, rows, agentType?)`. Used by `terminalAPI.create` preload bridge. |
| `spawn-terminal` | Creates a terminal PTY with default 80x24 dimensions. Accepts `(terminalId, cwd, agentType?)`. Sets up agent readiness detection via AGENT_SIGNATURES regex patterns. |
| `terminal:write` | Write data to terminal via the new terminal API. Accepts `(id, data)`. |
| `terminal:resize` | Resize terminal via the new terminal API. Accepts `(id, cols, rows)`. |
| `terminal:destroy` | Kill terminal via the new terminal API. Accepts `(id)`. |
| `retry-agent-init` | Retries agent readiness detection for a terminal. Accepts `(terminalId, agentType)`. Re-attaches data handler with new agent signature. |
| `write-terminal` | Write data to terminal stdin. Accepts `(terminalId, data)`. |
| `resize-terminal` | Resize terminal PTY. Accepts `(terminalId, cols, rows)`. |
| `kill-terminal` | Kill terminal PTY process. Accepts `(terminalId)`. |
| `terminal:write-old-format` | Write data to terminal stdin (used by `terminalWrite` preload bridge). Accepts `(terminalId, data)`. **Phase-aware** — queues to `pendingWrites` during `launching`/`busy` phases. Persists to `terminal_messages` table. |
| `terminal:resize-old-format` | Resize terminal PTY (used by `terminalResize` preload bridge). Accepts `(terminalId, cols, rows)`. |
| `terminal:destroy-old-format` | Kill terminal PTY (used by `terminalDestroy` preload bridge). Accepts `(terminalId)`. |
| `get-terminal-session-resume-id` | Get resume_id for a terminal session. Accepts `(sessionId)`. Returns `resume_id` string or null. |
| `save-terminal-session` | Save/update terminal session metadata. Accepts `{ id, projectId, agent, resumeId, terminalId, topic, workingDirectory, ... }`. Auto-generates `resume_id` if missing. Returns `{ success, id, resumeId }`. |
| `electron:execute-command` | Execute an arbitrary shell command on the host. Accepts `{ command, cwd? }`. Returns `{ stdout, stderr, exitCode }`. Used for `deskflowAPI.executeCommand()` preload bridge. |
| `summarize-session` | Generates a summary of a terminal session by reading first/last messages. Accepts `(sessionId: string)`. Saves to `agent/context/session-summaries.json`. Returns `{ summary }` or null. |
| `get-context-systems` | Returns live status for all 7 context system directories. **Extended 2026-06-05:** now returns `lastBuilt` (ISO mtime of newest relevant file) + `error` (null for clean absences, populated on genuine failures). Returns array of `{ id, name, itemCount, itemLabel, available, lastBuilt?, error? }`. |
| `set-recording-mode` | Set recording mode for browser or app tracking. Accepts `{ type: 'browser' | 'app', mode: 'always' | 'on-view' }`. When `on-view`, data only persists while the corresponding page is visible. |
| `get-recording-modes` | Returns current recording modes: `{ browser: 'always' | 'on-view', app: 'always' | 'on-view', browserPageVisible: boolean, dashboardPageVisible: boolean }`. |
| `set-page-visibility` | Notify backend that a page became visible/hidden. Accepts `{ page: 'browser' | 'dashboard', visible: boolean }`. Used by on-view recording mode to gate DB writes. |
| `scan-ide-default-projects` | Scan hardcoded IDE directories (PyCharm, IntelliJ, etc.) for quick-add project suggestions. Returns array of `{ ide, projects: [{ name, path }] }`. |
| `scan-custom-directory` | Scan a user-specified root directory for subdirectories containing code files. Accepts `(rootDir: string)`. Returns `{ success, projects: [{ name, path, languages: string[], fileCount: number }] }`. Filters out directories with no recognized source file extensions. Depth-2 scan, max 200 files per directory. |
| `pick-folder` | Opens a native folder selection dialog. Returns `{ success: boolean, path: string | null }`. |

### Design Library IPC (added 2026-06-07)

| Endpoint | Description |
|----------|-------------|
| `mcp-server-status` | Get MCP server status (running/stopped) for a given source. Accepts `{ source: '21st-dev' \| 'refero' }`. Returns `{ running: boolean }`. |
| `fetch-refero-catalog` | Fetch Aceternity UI registry catalog. Returns component list from registry JSON. |
| `fetch-refero-system` | Fetch a specific Aceternity UI component system details. Accepts `(systemKey: string)`. Returns component code and metadata. |
| `search-refero-systems` | Search Aceternity UI components. Accepts `(query: string)`. Returns filtered system list. |
| `get-design-library-config` | Get design library configuration (enabled sources, API keys, settings). Returns `DesignLibraryConfig`. |
| `set-design-library-config` | Save design library configuration. Accepts `DesignLibraryConfig`. Returns `{ success }`. |
| `get-design-cached-data` | Get cached design library data by key. Accepts `(cacheKey: string)`. Returns cached data or null. |
| `test-design-library-connection` | Test connection to a design library source. Accepts `{ source: '21st-dev' \| 'aceternity' \| 'refero' }`. Returns `{ success, latencyMs? }`. |

### Bug Report IPC (Collaborative Debugging — added 2026-06-18)

| Endpoint | Description |
|----------|-------------|
| `bug-report:submit` | Submit a bug report. Accepts `{ projectId, title, errorText }`. Saves to `bug_reports` table, dispatches to all agent terminals via `terminalManager.write()` with `[System] BUG-REPORT: ...`. Returns `{ success, id }`. |
| `bug-report:list` | List bug reports for a project. Accepts `(projectId: string)`. Returns array of bug report objects ordered by `created_at` DESC. |
| `bug-report:get` | Get a single bug report by ID. Accepts `(reportId: string)`. Returns full bug report object with `agent_responses` parsed. |
| `bug-report:auto-consult` | Flow B — auto-consult other agents when a problem is created. Accepts `{ projectId, reportId, ownerAgentId }`. Dispatches consult to all non-owner agent terminals. |
| `bug-report:investigate` | Flow C — 3-phase evidence pipeline. Accepts `(reportId: string)`. Gathers file locks, sync logs, stack trace files, session metadata; builds `RootCauseReport` with suspect sessions, suspicious files, timeline, suggested approach. |

### Finance — Wallet Metadata & Crypto IPC (added 2026-06-21)

| Endpoint | Description |
|----------|-------------|
| `finance:get-wallet` | Get a single wallet by ID. Parses `metadata` JSON column to object. |
| `finance:update-wallet-metadata` | Merges metadata payload with existing metadata JSON. Accepts `{ id, metadata }`. Returns full updated wallet with parsed metadata. |
| `finance:fetch-crypto-prices` | Fetches current prices from CoinGecko free tier (`/simple/price`). Falls back to `finance_crypto_prices` cache table on network error. Accepts `(coinIds: string[])`. Returns array of `CryptoPrice`. |
| `finance:get-crypto-history` | Fetches historical price data from CoinGecko (`/coins/{id}/market_chart`). Caches in `finance_crypto_history`. Accepts `(coinId, days?)`. Returns `[{ timestamp, price }]`. |

### Finance Security IPC / Storage (updated 2026-06-20)

| Endpoint | Description |
|----------|-------------|
| `finance:get-display-currency` | Returns the persisted finance currency from `finance_settings.display_currency`. Used as the finance base currency source on startup. |
| `finance:set-display-currency` | Persists `display_currency` in `finance_settings` and updates the in-memory finance currency. |
| `finance:set-password` | First-time password setup only. Writes salted `password_hash` and `password_salt` rows. Rejects overwriting an existing password. |
| `finance:change-password` | Requires the current password, then rewrites the salted hash rows with a new password. Uses `scrypt` hashing and constant-time comparison. |
| `finance:verify-password` | Verifies a password against the stored hash. |

### Workspace IPC (multi-instance support — added 2026-06-17)

| Endpoint | Description |
|----------|-------------|
| `workspace:save` | Save/overwrite a named workspace instance. Accepts `{ projectId, name, state_json, sidebarWidth?, activeTab?, isActive? }`. Upserts by `UNIQUE(project_id, name)`, deactivates all other instances for the project. Returns `{ success, name }`. |
| `workspace:load` | Load a workspace instance by name (or active/default). Accepts `{ projectId, name? }`. Returns full `state_json` + `name` + `sidebarWidth` + `activeTab` + all saved fields. |
| `workspace:list` | List all workspace instances for a project. Accepts `{ projectId }`. Returns array of `{ name, isActive, sidebarWidth, activeTab, updatedAt }`. |
| `workspace:delete` | Delete a workspace instance. Accepts `{ projectId, name }`. Returns `{ success }`. |

### AI Features IPC (added 2026-06-04)

| Endpoint | Description |
|----------|-------------|
| `get-ai-brief` | Generate or retrieve cached daily/weekly AI brief. Accepts `{ type: 'daily' | 'weekly' }`. Checks `ai_briefs` cache first; if stale/missing, queries stats and calls `AIService.generateDailyBrief` or `generateWeeklyReview` via OpenRouter. Caches result. Sends `ai-brief-ready` push event on cache miss. |
| `regenerate-ai-brief` | Force-regenerates an AI brief (bypass cache). Same params as `get-ai-brief`. Deletes existing cache entry, then re-runs generation. |
| `get-topic-digest` | Generate topic research digest. Reads enabled interests from `ai_interests` table, calls `AIService.generateTopicDigest` via OpenRouter. Returns array of `{ topic, summary }`. Caches result in `ai_briefs` with type='topic'. |
| `check-anomalies` | Detect activity anomalies vs baseline. Queries today's stats + 7-day/30-day averages, calls `AIService.checkAnomalies` via OpenRouter. Returns `{ hasAnomaly, anomalies: [{ severity, detail }] }`. |
| `get-ai-config` | Returns current AI config object: `{ briefModel, weeklyModel, digestModel, anomalyModel, autoGenerateBrief }`. |
| `save-ai-config` | Saves AI config. Accepts `{ apiKey?, enabled? }`. Persists via preferences system. |
| `get-interest-topics` | Returns all rows from `ai_interests` table ordered by creation date desc. |
| `add-interest-topic` | Adds a new interest topic. Accepts `(topic: string)`. Inserts into `ai_interests` with `INSERT OR IGNORE`. |
| `remove-interest-topic` | Removes an interest topic by ID. Accepts `(topicId: number)`. Deletes from `ai_interests`. |
| `get-longterm-goals` | Returns all goals with `period='longterm'` ordered by priority ASC, created_at ASC. No params. |
| `delete-goal` | Deletes a goal by ID. Accepts `(goalId: string)`. Returns `{ success }`. |
| `suggest-goals` | **Extended 2026-06-13:** Now accepts an optional `longtermGoals` array in the context. Injects incomplete long-term goals into the AI system prompt so suggestions align with long-term plans. |

---

## 📡 IPC Events (Terminal)

| Event | Direction | Description |
|-------|-----------|-------------|
| `terminal:data` | main → renderer | PTY output data for a terminal. Payload: `(terminalId, data)`. |
| `terminal:exit` | main → renderer | PTY process exited. Payload: `(terminalId, exitCode, signal)`. |
| `terminal:ready` | main → renderer | PTY spawned and ready for I/O. Payload: `(terminalId)`. |
| `agent:ready` | main → renderer | AI agent signature detected in terminal output. Payload: `{ terminalId }`. Triggers system prompt write and message queue flush. |
| `agent:timeout` | main → renderer | Agent initialization timed out (30s). Payload: `{ terminalId, agentType }`. Shows retry overlay. **Added 2026-06-13:** Now armed on initial spawn (was only armed on retry). |
| `terminal:crashed` | renderer → layout | CustomEvent dispatched by TerminalPane on terminal exit. Triggers dead overlay with "Click to re-spawn" button. |
| `re-spawn-terminal` | layout → TerminalPage | CustomEvent dispatched by dead overlay's re-spawn button. TerminalPage cleans up agent state, re-initializes terminal. |
| `terminal:pending-failed` | main → renderer | Pending writes marked `failed` on terminal kill. Payload: `{ terminalId, count: number }`. Surfaced to notify user of lost messages. |
| `context-changed` | main → renderer | Problem/request/checklist/bug_report CRUD event. Payload: `{ type: 'problem'|'request'|'checklist'|'bug_report', action: 'created'|'updated'|'deleted', entity: { id, title?, status? } }`. Written to active terminal as `[System: ...]` message. |
| `session-metadata-updated` | main → renderer | Agent output was parsed for ## Session Metadata block. Payload: `{ sessionId, metadata: { title?, description?, status?, productArea?, category? }, autoTags: string[] }`. Triggers session list reload. |
| `ai-brief-ready` | main → renderer | Push event when a brief is freshly generated. Payload: `{ type: 'daily'|'weekly', content: any }`. Frontend subscribes via `onAiBriefReady` preload bridge. |

---

## 🗄️ DB Schema: `workspace_state`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Row ID |
| `project_id` | TEXT NOT NULL | Project identifier (UUID / path hash) |
| `name` | TEXT NOT NULL DEFAULT 'default' | Workspace instance name |
| `state_json` | TEXT | JSON blob containing terminal layout, sidebar configs, presets, todos, openFiles, configs tab state, analytics period, session category filter, map list ratio |
| `sidebar_width` | INTEGER | Saved sidebar width in pixels |
| `active_tab` | TEXT | Last active sidebar tab |
| `is_active` | INTEGER DEFAULT 0 | Flag: 1 = current active instance |
| `created_at` | TEXT DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TEXT DEFAULT CURRENT_TIMESTAMP | Last update timestamp |
- **UNIQUE constraint:** `UNIQUE(project_id, name)` — each project can have many uniquely named workspaces

## 🔧 Data Troubleshooting

## Life Phases (River of Years) — Gold warmth page

### DB tables
- `life_phases` — id TEXT PK, version INTEGER, title, description, category, start_month, start_year, end_month, end_year, magnitude, color, reflection, era_trends, impact_notes, milestones TEXT (JSON array), connections TEXT (JSON array), created_at, updated_at
- `life_timeline_meta` — key TEXT PK, value TEXT, updated_at (stores journey summary + summaryUpdatedAt)

### IPC (all return `{ ok, data?, error? }`)
| Channel | Purpose |
|---------|---------|
| `lifePhase:get` | All phases (ordered by start) |
| `lifePhase:getSummary` | Journey summary + summaryUpdatedAt from life_timeline_meta |
| `lifePhase:save` | Upsert one phase (version++ if existing) |
| `lifePhase:delete` | Delete phase by id |
| `lifePhase:saveAll` | Batch upsert (e.g. after title rename save) |
| `lifePhase:aiReflect` | AI reflection text for a phase (response.choices[0].message.content) |
| `lifePhase:aiEraTrends` | AI JSON `{ world, culture, field }` era trends |
| `lifePhase:aiSummarize` | AI journey summary string |

Preload: `window.deskflowAPI.lifePhase*` (8 methods, typed in `src/types/deskflow-api.d.ts`). Renderer: `src/hooks/useLifePhases.ts`, `src/lib/riverMath.ts`, `src/components/life-river/`.

## Finance Monthly Recap (added 2026-08-07)

### DB table
- `finance_monthly_recaps` — id INTEGER PK AUTOINCREMENT, month TEXT UNIQUE NOT NULL (YYYY-MM), title TEXT, summary TEXT (AI narrative), stats_json TEXT NOT NULL (camelCase keys: income.total/count, expense.total/count, net, activeDays, previousMonth, momDelta, topCategories, walletSpend, walletBalanceDelta, subscriptionsBilled, fixedExpenses, followThrough, biggestExpense, biggestIncome, displayCurrency), status TEXT (pending|generated|failed), provider_id TEXT, error_message TEXT, created_at/updated_at TEXT

### IPC (all return `{ ok, data?, error? }`)
| Channel | Purpose |
|---------|---------|
| `finance:recap-list` | All recaps, latest month first (list query uses json_extract for income/expense/net) |
| `finance:recap-get` | One recap by month; `{ ok, data: null }` when missing |
| `finance:recap-generate` | Generate/regenerate a month; params `{ month, force? }`; idempotent unless force |
| `finance:recap-delete` | Delete recap row by month |
| `finance:recap-months-with-data` | DISTINCT months having real transactions (excludes is_adjustment) |

- Auto-gen: `checkMonthlyRecaps(db)` runs at `whenReady` + every 6h; only the immediate previous calendar month; skips if row exists or no data. AI: provider chain (`buildChain(pState,'monthlyRecap')` + `runWithFallback`) then OpenRouter fallback `ai_briefModel || 'google/gemini-2.0-flash-001'`. There is NO `getLastUsedProviderId()` — provider comes from `runWithFallback`'s `usedProviderId`.
- Preload: `window.deskflowAPI.financeRecap*` (5 methods). Renderer: `src/components/finance/RecapPanel.tsx` (Finance page → Recap tab). Spec: `agent/docs/generate-prompt-docs/finance-monthly-recap-07082026/RESULT.md`.

### Weekly vs Today Inconsistency
- **Issue:** Weekly timeframe shows less time than Today (12h vs 10h)
- **Investigation:** Checking getAppStats query in main.ts
- **Possible causes:** Period filtering logic, aggregation query bugs


---

**Last Updated:** 2026-06-18

---

## Content Engine (2026-08-17) — src/services/contentEngine/index.ts
**Tables:** content_ideas (title, hook, format_type, status raw/refined/approved/used, priority 1-5, series, niche, frames JSON, synthesized_from JSON, gates JSON), content_episodes (title, idea_id, theme_id, status draft/scripted/gated/filming/published, niche, script JSON, seo JSON, gates JSON, gate_override), themes (name, description, accent_color, icon, status), content_frameworks (name, description, rules JSON, version, is_builtin, history JSON), content_videos (episode_id, platform, url, title, views, likes, saves, shares, comments, completion_pct, retention_curve JSON, audience JSON, dropoffs JSON, published_at, fetched_at), content_lessons (video_id, episode_id, lesson, evidence JSON, status active/applied/dismissed).
**IPC (33 channels, all via window.deskflowAPI.contentEngine):** content:ideas:list/save/delete; content:episodes:list/get/save/delete; content:script:generate {episodeId,ideaId} returns {frames, gates}; content:script:regenerate-line {episodeId,frameIndex,instruction}; content:validate-script-evidence {episodeId}; content:validate-gates {ideaId,episodeId}; content:gate-override {episodeId,override}; content:inject-seo {episodeId,niche}; ideas:synthesize {note,count}; content:brainstorm:classify {thought} -> content_idea|general_thought; content:brainstorm:summary; themes:create/generate/get-all/apply/delete; content:analytics:get/upsert-video/delete-video/insight; content:lessons:list/save/delete/extract {videoId}; content:frameworks:list/save/rollback {id,version}.
**AI wiring:** all calls via buildChain(pState,'contentEngine') + runWithFallback (provider chain), feature id added to router.ts:34 union. Script frame retention contract: {criteria[], mechanism, evidence, score}, <0.6 rejected. Gates: scroll_stop/hard_cut/asset_ready with overall pass/fail. Registered in main.ts initializeStorage after Learn block (~L3891).

# CONTEXT_BUNDLE — IDE Page: AI Tools Heatmap + Analytics Code Changes + Mojibake

Self-contained context for the target AI. All paths relative to repo root (`C:\Users\cleme\Documents\COMPUTAH_SAYENCE\App Tracker`). Line numbers reference the CURRENT working tree at round date 2026-08-05.

---

## 1. APP OVERVIEW, STACK & THE IPC PATTERN

**App:** DeskFlow (RHEO) — Electron + React 18 desktop productivity/development tracker. Tracks app/website usage, AI tool usage, IDE projects, terminal workspace, finance, life goals.

**Stack:** Electron, React 18, TypeScript, Tailwind CSS **v4** (`@import "tailwindcss";` in index.css, pinned `4.2.1`), better-sqlite3 (DB at `%APPDATA%/DeskFlow/deskflow-data.db`), Chart.js via react-chartjs-2, Framer Motion, zustand, dnd-kit. Files are **CRLF** — preserve line endings.

**One end-to-end IPC chain (the canonical pattern every feature follows):**

1. **preload** `src/preload.ts` — contextBridge exposing `window.deskflowAPI`:
```ts
// src/preload.ts:305 (exact lines)
getAIUsageSummary: (period?: string, dateOffset?: number, projectId?: string) =>
  ipcRenderer.invoke('get-ai-usage-summary', period, dateOffset, projectId),
// src/preload.ts:324-329
getCommitHistory: (projectId?: string, limit?: number) => ipcRenderer.invoke('get-commit-history', projectId, limit),
getContributorStats: (projectId?: string) => ipcRenderer.invoke('get-contributor-stats', projectId),
syncCommits: (projectId?: string) => ipcRenderer.invoke('sync-commits', projectId),
syncGithubCommits: (projectId?: string) => ipcRenderer.invoke('sync-github-commits', projectId),
getIDEProjectsOverview: (period?: string, dateOffset?: number) => ipcRenderer.invoke('get-ide-projects-overview', period, dateOffset),
```
2. **main** `src/main.ts` — `electron_1.ipcMain.handle('<channel>', (event, ...args) => { try { ... db.prepare(sql).all/get/run(...) ... } catch { return safeDefault } })`.
3. **renderer** — `window.deskflowAPI!.<channel>(...)` with `try/catch` + loading state.

**Result/error convention:** main handlers generally return plain objects or safe defaults (e.g. `{ totalTokens: 0, totalCost: 0, byTool: {} }`) on error/useJson mode — they do NOT throw across IPC. Service functions in `src/lib/*` use a `Result<T>` wrapper (`{ success: true, data } | { success: false, error }`). Renderer never sets React controlled inputs programmatically during verification (onChange must fire for a real pass).

**JSON mode:** `const useJson` in main.ts — when set (dev fallback), handlers return stubbed shapes. Check every handler for `if (useJson) return ...` — keep the stub updated when you change a response shape.

**Router:** HashRouter. IDE page route = `/ide` (IDEProjectsPage). Terminal workspace = `/terminal`.

---

## 2. FOLDER MAP (only relevant parts)

```
src/
  main.ts                       # ALL IPC handlers + DB + better-sqlite3 (29472 lines)
  preload.ts                    # contextBridge API surface
  types/deskflow-api.d.ts       # window.deskflowAPI type declarations (getIDEProjectsOverview at ~101-121)
  pages/IDEProjectsPage.tsx     # /ide page — overview + workspaceAnalytics + tab orchestration (4350 lines)
  components/AnalyticsDashboard.tsx   # shared analytics dashboard (used by IDE page AND Terminal workspace)
  components/ai/AIToolsTab.tsx  # AI Tools tab incl. Usage Pattern heatmap (3310 lines)
  components/ProblemsTab.tsx    # problems list (status styling)
  components/IssuesWorkspace.tsx# workspace issues (status styling)
  components/workspace/_ds/badges.tsx  # status badge styles
agent/
  problems.json                 # SOURCE OF TRUTH for problems (contains MOJIBAKE, see §6)
  requests.json                 # SOURCE OF TRUTH for requests (contains MOJIBAKE)
  state.md, dictionary.md, FEATURE_TRACKER.md   # infra docs
  docs/generate-prompt-docs/6-research-prompt-IDEtracker-15042026/
    research-01-ide-integration.md  # how to read VS Code/Cursor storage (state.vscdb, ItemTable, cursorDiskKV)
    research-03-git-metrics.md      # GitHub API /stats/code_frequency, /stats/commit_activity etc.
browser-extension/              # the browser extension (Comet etc.) — sends website + AI usage data
```

---

## 3. DESIGN TOKENS (re-skin rules for anything sourced externally)

- Dark mode only. Glass card: `bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl !p-5` (AnalyticsDashboard uses `bg-zinc-900/60`; IDE page cards often `bg-zinc-900/60` or `bg-[rgba(24,24,27,0.60)]`).
- Max radius `rounded-xl`, max padding `p-5`. Fonts: Geist (body), JetBrains Mono (numbers). 
- Card title: `text-sm font-medium text-zinc-200` with a Lucide icon `w-4 h-4 text-<accent>-400`. Stat number: `text-xl font-bold text-<accent>-400`. Label: `text-[10px] text-zinc-500`.
- Chart.js options pattern (used app-wide): `grid: { color: 'rgba(113,113,122,0.06)' }, border: { color: 'rgba(113,113,122,0.12)' }, ticks: { color: '#71717a', font: { size: 9 }, padding: 6 }`.
- Accents: AI/purple `#8b5cf6→#a78bfa`, emerald `#10b981` (additions/heatmap), rose `#f87171` (deletions), cyan `#22d3ee`, amber `#f59e0b`.
- Motion: Framer Motion `motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.35 }}`.
- Heatmap cell scale: `rgba(16,185,129,0.04 / 0.15 / 0.3 / 0.5 / 0.7 / 0.9)`, CELL=14, GAP=3, weekStartsOn:1 (Monday).

---

## 4. FEATURE A — USAGE PATTERN HEATMAP (AI Tools tab) + all AI usage data flow

### 4a. Renderer state + data sources — `src/pages/IDEProjectsPage.tsx`

Two separate fetch paths feed AIToolsTab:

```ts
// IDEProjectsPage.tsx:~340-371 (state) & ~755-771 (loadOverview — exact)
const [overview, setOverview] = useState<Overview | null>(null);          // getIDEProjectsOverview
const [workspaceAnalytics, setWorkspaceAnalytics] = useState<any>(null);  // composite fetch
const [effectiveAiPeriod, setEffectiveAiPeriod] = useState('30day');      // period for AI tab
const [dateOffset, setDateOffset] = useState(0);

const loadOverview = async (period?: string, offset?: number) => {
  setLoading(true);
  try {
    const effectivePeriod = period ?? (activeTab === 'ai' ? effectiveAiPeriod : selectedPeriod);
    const effectiveOffset = offset ?? dateOffset;
    console.log('[IDEProjectsPage] Loading overview for period:', effectivePeriod, 'offset:', effectiveOffset, 'activeTab:', activeTab);
    const data = await window.deskflowAPI!.getIDEProjectsOverview(effectivePeriod, effectiveOffset);
    console.log('[IDEProjectsPage] Overview loaded, projects:', data?.projects?.length);
    setOverview(data);
    setLoading(false);
  } catch (err) {
    console.error('[IDEProjectsPage] Failed to load IDE projects overview:', err);
    setLoading(false);
  }
};
```
The `useEffect` that refires `loadOverview` has `effectiveAiPeriod` in deps; the time-lock toggle sets `effectiveAiPeriod` to `'all'` when on, else `selectedPeriod`. `workspaceAnalytics` is fetched separately (composite: getAIUsageSummary + getProblems + getRequests + getTerminalSessions + getPromptHistory). AIToolsTab receives BOTH (`overview` and `workspaceAnalytics`) at IDEProjectsPage.tsx:~2041-2046.

### 4b. Agent list derivation — `src/components/ai/AIToolsTab.tsx:310-376` (exact)

```ts
const aiAgents = useMemo((): AIAgent[] => {
  const agents: AIAgent[] = []
  const wsByTool = workspaceAnalytics?.aiUsage?.byTool
  const ovByTool = overview?.aiUsage?.byTool
  const byTool =
    wsByTool && Object.keys(wsByTool).length > 0 ? wsByTool : ovByTool || {}
  for (const [agentId, data] of Object.entries(byTool)) {
    const config = AGENT_CONFIG[agentId] || { name: agentId, icon: agentId, color: '#6366f1' }
    agents.push({
      id: agentId, name: config.name, icon: config.icon, color: getAgentColor(agentId),
      tokens: (data as any).tokens || 0, tokensIn: (data as any).tokens_in || 0,
      tokensOut: (data as any).tokens_out || 0, cost: (data as any).cost || 0,
      sessions: (data as any).sessions || 0, messageCount: (data as any).messageCount || 0,
      status: (data as any).lastUsed ? 'active' : 'idle',
      lastUsed: (data as any).lastUsed ? new Date((data as any).lastUsed) : undefined,
      models: (data as any).models || [],
    })
  }
  // ... then inactive agents for AGENT_CONFIG keys missing from byTool
}, [workspaceAnalytics?.aiUsage?.byTool, overview?.aiUsage?.byTool])

const activeToolIds = useMemo(() => aiAgents.filter(a => a.status !== 'inactive').map(a => a.id), [aiAgents])
```
Note: `getAIUsageSummary` byTool entries (wsByTool) have NO `daily` key — only `getIDEProjectsOverview` byTool has `daily`.

### 4c. The Usage Pattern heatmap — `src/components/ai/AIToolsTab.tsx:1943-2110+` (exact, condensed)

```tsx
{/* ── AI Usage Heatmap — Calendar Grid ── */}
{(() => {
  const activeAgents = aiAgents.filter(a => a.status !== 'inactive' && a.tokens > 0)
  if (activeAgents.length === 0) return null            // <-- early return (i)

  const byTool = overview?.aiUsage?.byTool || {}         // <-- HEATMAP ONLY USES overview
  const selectedHeatmapTool = heatmapToolFilter          // state, default 'all'
  const filteredAgents = selectedHeatmapTool === 'all'
    ? activeAgents
    : activeAgents.filter(a => a.id === selectedHeatmapTool)
  if (filteredAgents.length === 0) return null           // <-- early return (ii)

  const dateMap: Record<string, Record<string, {tokens:number;cost:number;messages:number;sessions:number}>> = {}
  const allDateStrs = new Set<string>()
  let maxVal = 0

  for (const agent of filteredAgents) {
    const daily = byTool[agent.id]?.daily || {}          // <-- daily only in overview source
    for (const [dateStr, dayData] of Object.entries(daily) as [string, any][]) {
      const dt = new Date(dateStr)
      if (isNaN(dt.getTime())) continue
      allDateStrs.add(dateStr)
      if (!dateMap[dateStr]) dateMap[dateStr] = {}
      dateMap[dateStr][agent.id] = {
        tokens: dayData.tokens || 0, cost: dayData.cost || 0,
        messages: dayData.messageCount || 0, sessions: dayData.sessions || 0,
      }
    }
  }

  if (allDateStrs.size === 0) return null                // <-- early return (iii)

  const sortedDates = Array.from(allDateStrs).sort()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days: { date: Date; dateStr: string; raw: number;
    details: { agent: string; tokens: number; cost: number; messages: number; sessions: number }[];
    isToday: boolean }[] = []
  for (const ds of sortedDates) {
    const dayData = dateMap[ds]
    let tokens = 0, cost = 0, messages = 0, sessions = 0
    const details: typeof days[0]['details'] = []
    for (const [agentId, data] of Object.entries(dayData)) {
      tokens += data.tokens; cost += data.cost; messages += data.messages; sessions += data.sessions
      const agent = filteredAgents.find(a => a.id === agentId)
      details.push({ agent: agent?.name || agentId, tokens: data.tokens, cost: data.cost, messages: data.messages, sessions: data.sessions })
    }
    const raw = aiChartMode === 'tokens' ? tokens : aiChartMode === 'cost' ? cost : aiChartMode === 'messages' ? messages : sessions
    if (raw > maxVal) maxVal = raw
    days.push({
      date: new Date(ds), dateStr: ds, raw,
      details: details.filter(d => {
        const v = aiChartMode === 'tokens' ? d.tokens : aiChartMode === 'cost' ? d.cost : aiChartMode === 'messages' ? d.messages : d.sessions
        return v > 0
      }),
      isToday: ds === todayStr,
    })
  }

  if (days.length === 0) return null                     // <-- early return (iv)

  const cellColor = (b: number) => {
    if (b === 0) return 'rgba(255,255,255,0.04)'
    if (b < 0.2) return 'rgba(16, 185, 129, 0.15)'
    if (b < 0.4) return 'rgba(16, 185, 129, 0.3)'
    if (b < 0.6) return 'rgba(16, 185, 129, 0.5)'
    if (b < 0.8) return 'rgba(16, 185, 129, 0.7)'
    return 'rgba(16, 185, 129, 0.9)'
  }

  const dayLookup = new Map<string, typeof days[0]>()
  for (const day of days) dayLookup.set(day.dateStr, day)

  const firstDate = days[0].date
  const lastDate = days[days.length - 1].date
  const gridStart = startOfWeek(firstDate, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(lastDate, { weekStartsOn: 1 })

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const CELL = 14, GAP = 3, STEP = CELL + GAP

  const weeks: { days: Date[]; monthLabel?: string }[] = []
  let cur = gridStart
  let lastMonth = -1
  while (cur <= gridEnd) {
    const wd: Date[] = []
    for (let d = 0; d < 7; d++) wd.push(addDays(cur, d))
    const m = cur.getMonth()
    weeks.push({ days: wd, monthLabel: m !== lastMonth ? format(cur, 'MMM') : undefined })
    lastMonth = m
    cur = addDays(cur, 7)
  }
  // ... renders header ("Usage Pattern", "All tools · {days.length} days · {aiChartMode}"),
  // tool filter chips (All + first 8 active agents via setToolFilter), mode chips
  // (tokens/messages/cost/sessions via setAiChartMode), then the scrollable
  // (.overflow-x-auto max-w-full) grid: month label row (marginLeft 30), 7 day-label
  // rows, and for each day a cell button colored by cellColor(raw/maxVal).
})()}
```
Heatmap tool filter state: `heatmapToolFilter` (default `'all'`), set by the chip row (`setToolFilter('all')` / `setToolFilter(a.id)`). The Usage Pattern card renders as part of the AI Tools tab body regardless of `activeTab`/period — its ONLY data source is `overview.aiUsage.byTool[].daily`, and `days.length` reflects whatever period `overview` was last loaded with (the heatmap itself has NO period control of its own).

### 4d. Backend — `src/main.ts` handlers

**`get-ai-usage-summary` (main.ts:10022-10087+, exact):**
```ts
electron_1.ipcMain.handle('get-ai-usage-summary', (event, period = 'week', dateOffset = 0, projectId) => {
    if (useJson) return { totalTokens: 0, totalCost: 0, byTool: {} };
    try {
        const now = new Date();
        let sinceDateStr: string | null = null;
        if (period === 'today') {
            const d = new Date(now); d.setDate(d.getDate() - dateOffset);
            sinceDateStr = d.toISOString().split('T')[0];
        } else if (period === 'week' || period === '7day') {
            sinceDateStr = new Date(now.getTime() - (7 + dateOffset * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (period === 'month' || period === '30day') {
            sinceDateStr = new Date(now.getTime() - (30 + dateOffset * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }   // NOTE: NO branch for 'all' → sinceDateStr stays null → no date filter (all history)

        let query = `SELECT tool, SUM(input_tokens) as total_input_tokens,
               SUM(output_tokens) as total_output_tokens,
               SUM(input_tokens + output_tokens) as total_tokens,
               SUM(cost_usd) as total_cost, COUNT(*) as session_count,
               SUM(message_count) as total_messages, MAX(date) as last_used,
               GROUP_CONCAT(DISTINCT model) as models
           FROM ai_usage`;
        const params: any[] = [];
        const conditions: string[] = [];
        if (sinceDateStr) conditions.push(`date >= ?`);
        if (projectId) conditions.push(`project_id = ?`);
        if (conditions.length > 0) { query += `WHERE ${conditions.join(' AND ')} GROUP BY tool`; if (sinceDateStr) params.push(sinceDateStr); if (projectId) params.push(projectId); }
        else { query += `GROUP BY tool`; }
        const summary = db.prepare(query).all(...params);
        const byTool: Record<string, any> = {};
        let totalTokens = 0, totalCost = 0;
        for (const row of summary) {
            const models = row.models ? row.models.split(',').filter((m: string) => m) : [];
            byTool[row.tool] = {
                tokens: row.total_tokens, tokens_in: row.total_input_tokens || 0,
                tokens_out: row.total_output_tokens || 0, cost: row.total_cost,
                sessions: row.session_count, messageCount: row.total_messages || 0,
                lastUsed: row.last_used || null, models,
            };   // <-- NO 'daily' key in this handler's byTool
        }
        // ... totals, then returns { totalTokens, totalCost, byTool }
```
**`get-ide-projects-overview` (main.ts:10190-10309+, exact — the ONLY source of `daily`):**
```ts
electron_1.ipcMain.handle('get-ide-projects-overview', (event, period?: string, dateOffset = 0) => {
    if (useJson) return { ides: [], tools: [], projects: [], aiUsage: { totalTokens: 0, totalCost: 0, totalMessages: 0, byTool: {} }, commits: { totalCommits: 0, totalAdditions: 0, totalDeletions: 0 } };
    try {
        const ides = db.prepare('SELECT * FROM ides ORDER BY name').all();
        const tools = db.prepare('SELECT * FROM tools ORDER BY category, name').all();
        const projects = db.prepare('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY last_activity_at DESC').all();

        let dateFilterSQL = '';
        let dateFilterParam: string | null = null;
        if (period && period !== 'all') {
            const now = new Date();
            let sinceDate: Date | null = null;
            if (period === 'today' || period === 'day') { const d = new Date(now); d.setDate(d.getDate() - dateOffset); sinceDate = d; }
            else if (period === 'week' || period === '7day') { sinceDate = new Date(now.getTime() - (7 + dateOffset * 7) * 24 * 60 * 60 * 1000); }
            else if (period === 'month' || period === '30day') { sinceDate = new Date(now.getTime() - (30 + dateOffset * 30) * 24 * 60 * 60 * 1000); }
            if (sinceDate) { dateFilterSQL = 'WHERE date >= ?'; dateFilterParam = sinceDate.toISOString().split('T')[0]; }
        }   // 'all' → no filter → all history. daily arrays are UNBOUNDED in 'all'.

        const aiUsage = db.prepare(`SELECT tool, SUM(input_tokens) as tokens_in, SUM(output_tokens) as tokens_out,
               SUM(input_tokens + output_tokens) as tokens, SUM(cost_usd) as cost, COUNT(*) as session_count,
               SUM(message_count) as messageCount, MAX(date) as lastUsed, GROUP_CONCAT(DISTINCT model) as models
           FROM ai_usage ${dateFilterSQL} GROUP BY tool`).all(...(dateFilterParam ? [dateFilterParam] : []));

        const commits = db.prepare(`SELECT COUNT(*) as count, SUM(additions) as additions, SUM(deletions) as deletions
           FROM commits WHERE date >= datetime('now', '-30 days')`).get();   // <-- HARDCODED 30d, ignores period

        const aiUsageDaily = db.prepare(`SELECT tool, date, SUM(input_tokens) as tokens_in, SUM(output_tokens) as tokens_out,
               SUM(input_tokens + output_tokens) as tokens, SUM(cost_usd) as cost, COUNT(*) as session_count,
               SUM(message_count) as messageCount FROM ai_usage ${dateFilterSQL} GROUP BY tool, date ORDER BY date DESC`).all(...(dateFilterParam ? [dateFilterParam] : []));
        // ... plus aiUsageProjects, aiUsageModels, aiUsageModelDaily queries (WHERE project_path/model IS NOT NULL)
        // then byTool is built: for each tool row, daily: { [dateStr]: { tokens, cost, messageCount, sessions } }
        // accumulated from aiUsageDaily rows. Response: { ides, tools, projects, aiUsage: { totalTokens, totalCost, totalMessages, byTool }, commits: { totalCommits: count, totalAdditions: additions, totalDeletions: deletions } }
```
`ai_usage` table columns (used): `tool, date, input_tokens, output_tokens, cost_usd, message_count, model, project_id, project_path`.

---

## 5. FEATURE B — ANALYTICS DASHBOARD + COMMITS/CODE-CHANGE DATA

### 5a. `src/components/AnalyticsDashboard.tsx` (654 lines — used by BOTH IDE page and Terminal workspace)

Props (from IDEProjectsPage.tsx:2547-2552 — exact):
```tsx
<AnalyticsDashboard
  aiUsage={workspaceAnalytics?.aiUsage}
  sessions={workspaceAnalytics?.sessions}
  problems={workspaceAnalytics?.problems}
  requests={workspaceAnalytics?.requests}
  dailyStats={workspaceAnalytics?.dailyStats}
  appStats={workspaceAnalytics?.appStats}
  promptHistory={workspaceAnalytics?.promptHistory}
  period={selectedPeriod}
/>
```
Component structure (in order): header, Sessions card, **Problems Progress card** (`<h3>Problems Progress</h3>` with AlertTriangle icon, progress bar of Fixed vs In Progress vs Open — lines 369-406), **Requests Progress card** (407+), AI Usage Summary card (`aiUsage.byTool` table, 311-367), Language Distribution doughnut (300-309), charts. There is NO code/commit card today. Status colors referenced: `CHART_COLORS`, `'AI Attempted Fix'` purple `rgba(168,85,247,0.8)` in status color maps (line ~34), problems status strings: `NEW`, `Not Started`, `In Progress`, `AI Attempted Fix`, `User Testing`, `Fixed`, `Won't Fix`.

### 5b. Commits data layer — `src/main.ts`

**Schema (main.ts:2153-2168, guarded CREATE):**
```sql
CREATE TABLE IF NOT EXISTS commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  sha TEXT UNIQUE,
  author TEXT,
  author_email TEXT,
  date TEXT,            -- ISO date string
  message TEXT,
  additions INTEGER,
  deletions INTEGER,
  files_changed INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
)
```
**`sync-commits` (main.ts:14371-14403):** for each project, runs `git log` / `git show --numstat --format=...` per commit and INSERTs rows (additions/deletions/files_changed real values from numstat). `sync-github-commits` (main.ts:14427) pulls from GitHub API. **`get-commit-history`** (main.ts:14662): `SELECT * FROM commits [WHERE project_id = ?] ORDER BY date DESC LIMIT ?`. **`get-contributor-stats`** (main.ts:14678): groups by author (commits, additions, deletions).

**GAP for the feature:** no IPC returns per-day/per-week commit series, no period-respecting totals (the overview handler's commit query is hardcoded `-30 days`), no hours. New backend work is REQUIRED (see PROMPT §2.2 — extend `get-ide-projects-overview` or add `get-code-change-stats`).

### 5c. Research references (read these before designing the access strategy)

- `agent/docs/generate-prompt-docs/6-research-prompt-IDEtracker-15042026/research-01-ide-integration.md` — IDE detection: VS Code/Cursor `state.vscdb` (`ItemTable`, `cursorDiskKV`), session windows, working file access.
- `.../research-03-git-metrics.md` — GitHub REST: `/repos/{owner}/{repo}/stats/code_frequency` (weekly {week, additions, deletions}), `/stats/commit_activity`, `/stats/contributors`; git CLI alternatives.
- The desktop app ALREADY syncs commits via `git` CLI (sync-commits) — the primary file-change access path is local git history per project (`projects` table has `path` + `repositoryUrl`). The `browser-extension/` folder holds the tracking extension (website/AI usage events) — it does NOT touch files today.

---

## 6. FEATURE C — MOJIBAKE IN PROBLEMS/REQUESTS

**Confirmed:** `agent/problems.json` has 485 double-encoded-UTF8 matches, `agent/requests.json` 327. Sample bytes from problems.json:
```
voke('write-terminal', { terminalId, text })` A��'A.A�A�A�A��?sA�A.�?oA��'A+�?TA��?sA,A�A��'A+�?TA�A�A��?sA�A,A� `ipcRenderer.invoke('write-...
```
(Visible mojibake: `â€"` for em-dash, `â€™` for apostrophe, `é` for é, `A�A` garbage — double UTF-8 encoding of original UTF-8 bytes.) A standalone mojibake sample with clean ASCII context: the `â€œ`/`â€` sequences appear in problem titles/descriptions.

**Flow:** main.ts `sync` IPC (workspace sync) reads these JSONs and upserts rows into `workspace_problems` / `problems` tables → UI renders verbatim → "cursed letters". UI renderers: `ProblemsTab.tsx:28` (status colors), `IssuesWorkspace.tsx:37`, `components/workspace/_ds/badges.tsx:19`, `AnalyticsDashboard.tsx:369-406` (Problems Progress card). Repair must: (1) decode JSON content in place (detect mojibake bytes → re-decode as UTF-8), (2) repair already-synced DB rows (UPDATE, never DELETE), (3) add a render-time sanitizer util used by all problem/request title/description renderers so future mojibake never displays raw. Also consider a write-time guard so future JSON writes are clean UTF-8.

---

## 7. BUILD & VERIFY (implementer must run after changes)

```powershell
# 1. Renderer build (must exit 0)
npx vite build
# 2. Preload rebuild (window.deskflowAPI undefined if skipped/broken — must be > 1 KB)
npx esbuild src/preload.ts --bundle --platform=node --format=cjs --external:electron --outfile=dist-electron/preload.cjs
# 3. Main process rebuild
node scripts/rebuild-main.mjs
# 4. Sanity: dist/index.html has <div id="root"></div> + module script + #df-fallback; dist/assets/index.*.js exists > 10 KB
```
Runtime verification: app must be fully closed + relaunched to load a new bundle (stale bundle = "fix doesn't work" false alarm). Do NOT launch the app yourself in CI; report "NOT LAUNCHED" if the UI cannot be visually verified. UI verification must drive real clicks (never set controlled inputs programmatically). DB checks via `%APPDATA%/DeskFlow/deskflow-data.db`. No test runner exists in the repo (vitest not installed) — verification = build + tsc on changed files + real UI.

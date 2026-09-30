# dictionary.md — DeskFlow terminology & location resolution

> PURPOSE: resolve ambiguous words to an EXACT place in the app before acting.
>
> ⚠️ **THIS FILE IS *NOT* FORCE-INJECTED.** It is ~36KB, which is why it is not in
> `opencode.json` → `instructions`. (It was previously documented here as
> "FORCE-INJECTED into every agent prompt" — that was **false** and made everyone
> trust it and nobody read it.) Treat it as LOOK-UP-ON-DEMAND.
>
> **What IS force-loaded is [`SURFACES.md`](./SURFACES.md)** — the small alias index
> (word you say → route → owning file). Read THAT first. Use this file only when
> SURFACES.md has no row, or the term is a concept rather than a place.
>
> Rule (see AGENTS.md): before you create/move/modify anything that lives
> "somewhere", look the noun up HERE first. If it's not here, ASK — do not guess.
> If the noun is a *place*, also check SURFACES.md, and if it is missing there,
> ADD a row to SURFACES.md rather than grepping.

## 🔴 High-confusion terms (these have burned us before)

### "workspace"  (DEFAULT meaning in the terminal context)
- MEANS: the **Terminal Workspace** at route `/terminal` — the multi-pane terminal area
  PLUS its own internal 5-group sub-navigation (Setup / Work / Insights / Studio /
  Context). This is NOT the application's left router sidebar.
- "work ON the workspace" / "in the workspace" = work inside `/terminal` and its subtabs.
- DO NOT create app-level routes or items in the App.tsx router sidebar when the user
  says "workspace". Those are different navigations (see "sidebar" below).

### "saved workspace" / "save the workspace" / "list of workspaces"
- MEANS: a snapshot row in the `workspace_state` table (layout + terminal_tabs +
  sidebar_width + active_tab + configs), managed by IPC `workspace:save` / `workspace:list`
  / `workspace:load` / `workspace:delete`.
- It is surfaced in the UI under **Work → Workspaces** subtab.
- "warn before exiting" = prompt to `workspace:save` when leaving `/terminal` with unsaved changes.

### "conductor" / "swarm" / "mission"
- **Conductor:** The multi-agent orchestration system that manages swarms of AI agents (director, planner, worker, QA, auditor, resolver) operating on a user project.
- **Swarm subtab:** Located under Work group in the workspace sidebar (not a standalone page). Shows mission list for the selected project.
- **Mission:** A specific swarm task with objective, autonomy level (L2/L3/L4), and agent type. Multiple missions per project. Scoped to `selectedProject` path.
- **repoRoot in ConductorContext:** Comes from the selected project's `path` — NOT user-picked via folder dialog. The ConductorPanel passes `projectPath` as `repoRoot` to `conductorStart`.
- **Key invariant:** No standalone ConductorPage route. No folder picker for repoRoot. The project must be selected in TerminalPage first.

### "sidebar"  (AMBIGUOUS — always disambiguate)
- "workspace sidebar" = the in-`/terminal` 5-group sidebar (Setup/Work/Insights/Studio/Context).
- "app sidebar" / "navigation" = the App.tsx router rail (Dashboard, Stats, IDE, Settings…).
- If unqualified and the topic is the terminal workspace → assume the WORKSPACE sidebar.

### "page" vs "subpage"
- App-level "page" = a route (e.g. `/ide`, `/dashboard`). Lives in App.tsx router + sidebar.
- Workspace "subpage" / "subtab" = a section INSIDE `/terminal`, addressed like
  `work/sessions`, `work/map`, `studio/skills` (see `terminal_sessions.subpage`).
- "create a page in the workspace" = add a workspace SUBPAGE/subtab, NOT an app route.

### "Follow Through" (formerly "on-behalf-of")
- MEANS: transactions made on behalf of someone else who will pay you back (e.g. family
  member using your account). Uses `on_behalf_of=1` in DB. Excluded from personal spending
  calculations. Shows amber `Handshake` icon in UI. Label in modals: "Follow Through — Is
  this for someone else? They'll pay me back".
- Dashboard section: "Follow Through" card in OverviewTab with total, breakdown by person,
  "You'll be repaid: $X" indicator.
- Filter: RecentTxnsCard has Personal / Follow Through / All toggle.
- Technical: `on_behalf_of` column on `finance_transactions`, `financeGetOnBehalfOfSummary`
  IPC handler. Backend filtering via `AND on_behalf_of = 0` in summary queries.

### "subscriptions page"
- MEANS: the dedicated route `/subscriptions` (SubscriptionsPage.tsx) — full-page subscription
  management with card grid, search, filters, Record Payment, cancel links, renewal countdown.
- NOT the SubscriptionsTab inside `/finance` — that's a compact overview with "View all" link.
- Sidebar entry: `CalendarClock` icon, "Subscriptions" label.

### "content engine" / "Content Engine"
- MEANS: the full content-creation pipeline workspace (brainstorm → ideas → episodes/scripts with
  per-frame RETENTION EVIDENCE → themes → analytics → lessons → frameworks) — the ENTIRE scripting,
  planning, post-publish social analytics (retention times, likes, saves, audience age/country,
  % watch-to-end), and learning-from-mistakes loop. NOT just an editing tool.
- UI LOCATION: mounted INSIDE the Overlay Studio page (`src/features/overlay-studio/OverlayStudioPage.tsx`)
  via a header mode toggle ("Overlay Studio" | "Content Engine"). UI components: `src/features/content-engine/`
  (7 views: Brainstorm, Ideas, Episodes, Themes, Analytics, Lessons, Frameworks).
- BACKEND: `src/services/contentEngine/` — rubric.ts (RETENTION_RUBRIC v1.0.0, 7 criteria, threshold 0.6),
  prompts.ts (template registry), responseParser.ts (JSON retry parser),
  index.ts `registerContentEngineHandlers(db, aiCall)` (tables: content_ideas, content_episodes, themes,
  content_frameworks, content_videos, content_lessons). Registered from main.ts (~L3891, after Learn block)
  with provider-chain feature id 'contentEngine' (router.ts:34 union).
- IPC: all channels via `window.deskflowAPI.contentEngine` (content:ideas:*, content:episodes:*,
  content:script:generate, content:script:regenerate-line, content:validate-script-evidence,
  content:validate-gates, content:gate-override, content:inject-seo, ideas:synthesize,
  content:brainstorm:classify/summary, themes:*, content:analytics:*, content:lessons:*, content:frameworks:*).
- "script frame" = one bullet of the script with `retention: {criteria, mechanism, evidence, score}`;
  score < 0.6 = REJECTED. "gates" = 3 pre-production checks (scroll stop, hard cut, asset ready).

## 🗺️ App page map (route → page → where features live)
| You say… | Route | Page component | Notable sub-areas |
|---|---|---|---|
| dashboard / home / orbit | `/` | DashboardPage | 3D orbit, heatmap, weekly overview, timer |
| stats / app table | `/stats` | StatsPage | app table, charts, session list |
| productivity / focus score | `/productivity` | ProductivityPage | score, focus sessions, trends |
| browser / websites | `/browser` | BrowserActivityPage | domain groups, top sites |
| **IDE projects / "ID projects"** | `/ide` | IDEProjectsPage | project grid, detection, **AI Tools subpage** |
| terminal / **workspace** | `/terminal` | TerminalPage | 5-group sidebar, panes, sessions, map |
| external / sleep | `/external` | ExternalPage | activity grid, sleep, comparison |
| reports / insights | `/reports` | InsightsPage | Day / Weekly / Activities tabs |
| database / tables | `/database` | DatabasePage | analytics + table browser |
| settings | `/settings` | SettingsPage | Category, Colors, General, Tracking, Prompts |

### IDE Projects → "AI Tools" subpage (your line-chart example)
- "AI tools subpage" = the AI usage section inside `/ide` (IDEProjectsPage).
- "line chart" there = AI usage / cost over time (fed by IPC `get-ai-usage-summary`,
  `get-ide-projects-overview`). When the user says "the line chart on AI tools", target
  THIS chart, not a dashboard chart.

## 🧭 Terminal Workspace sub-navigation (the 5 groups)
| Group | Accent | Subtabs (subpage keys) |
|---|---|---|
| Setup | orange | Presets (`setup/presets`), Configs (`setup/configs`) |
| Work | green | Sessions (`work/sessions`), Map (`work/map`), Files (`work/files`), Workspaces (`work/workspaces`) |
| Insights | purple | Analytics (`insights/analytics`), Issues (`insights/issues`), Bugs (`insights/bugs`) |
| Studio | indigo | Skills (`studio/skills`), Design (`studio/design`) |
| Context | amber | Context (`context/context`), Maintenance (`context/maintenance`), Page Context (`context/page`) |

---

## Key Terms & Meanings (legacy definitions — kept for reference)

### Living Substrate (Cross-App Ambient Background)
- **Current Location:** Life page river view (`src/features/warmth/LifePage.tsx` line 587) at z-0 behind Vital Thread (z-[1]). Previously inside CoreSample — moved out in the Living Art overhaul.
- **Target Location:** Global — `src/components/AppBackground.tsx` (replaces particles, sits at z-[0] behind all content)
- **What it is:** A Gray-Scott reaction-diffusion ambient background — slow-moving organic coral patterns rendered via R3F with two ping-pong WebGLRenderTargets (256x256, 384 on high-DPI). Each page gets a color-tinted version derived from its `--page-accent`.
- **Current state:** Hardcoded amber (#f59e0b) display ramp. Zero props. Only renders on Life page.
- **Target state:** Props: `accent`, `speed`, `resolution`, `maxAlpha`, `enabled`. Shader reads `uniform vec3 accentColor` and computes ramp from it. Global mounting in AppBackground.
- **Files:** `src/components/life-river/LivingSubstrate.tsx`, `src/shaders/rd-simulation.glsl`, `src/shaders/rd-display.glsl`, `src/shaders/glsl.d.ts`
- **Behavior:** pauses on `document.hidden`, unmounts on `prefers-reduced-motion`, error-boundary fallback = null (never black screen)
- **Design spec:** `agent/docs/design-specs/cross-app-living-substrate.md`
- **Generate-prompt:** `agent/docs/generate-prompt-docs/cross-app-living-substrate/`

### Tracking Browser
- **Setting Location:** Settings → Browser Activity page
- **What it is:** The browser with the DeskFlow extension installed (e.g., "Comet ★")
- **How it works:** When this browser is detected as active window, tracking switches from APP mode to WEBSITE mode
- **Important:** This is DYNAMIC - reads from `browserWithExtension` preference in Settings

### Recent Sessions / Activity Feed
- **Location:** Dashboard page, bottom section
- **What it shows:** List of tracked apps and websites with live stopwatches
- **Active session:** Has green pulsing dot, shows live timer counting up (格式: HH:MM:SS)
- **Completed session:** Shows "X ago" (time since finished)

### Timer / Stopwatch
- **Location:** Dashboard page, main hero section
- **What it tracks:** Productive time only (from productive-tier apps/websites)
- **Behavior:** 
  - Counts UP when using productive apps
  - Resets/pauses based on timerBehavior settings when switching to distracting apps
  - Continues tracking when in browser (uses website category, not app category)

### Tracking - Provision vs New Agent
- **Provision** (formerly "Setup"): One-click infrastructure setup. Creates AGENTS.md, INITIALIZE.md, PROBLEMS.md, REQUESTS.md, state.md on disk. Green button, FolderTree icon. Does NOT create a terminal session.
- **New Agent** (formerly "Initialize"): Dialog-based agent session creation. Opens NewSessionDialog with session name, agent dropdown, terminal selector, system prompt. Amber button, Bot icon. Has collapsible "Advanced Configuration" section for context system toggles.
- **Start Agent**: Submit button in New Agent dialog. Creates terminal session with init content + system prompt.

### Advanced Configuration
- **Location:** New Agent dialog, collapsed by default
- **What it contains:** Context System toggles (LLM Wiki, Obsidian Skills, Graphify, PARA, QMD, Automations), Behavior toggles (Auto-summarize, Deep memory, agents.md), Agent Files selection, Preview Init Content
- **Trigger:** Click ChevronDown toggle inside New Agent dialog

### Context Delta Messages
- **What they are:** Real-time notifications written to active terminal when context changes (problems/requests/checklists created or updated)
- **Format:** `[Context] New problem: Bug X (ID: 123)` or `[Context] Updated problem: Bug X → Fixed`
- **IPC:** `onContextChanged` → `context-changed` event from main process
- **Delivery:** `terminalWriteRaw` with `\r` for reliable agent parsing

### Bidirectional Problem↔Request Linking
- **Linked Problems:** RequestDetailModal shows which problems are linked to a request (dropdown to add, chips to view)
- **Related Requests:** ProblemDetailModal shows which requests are linked to a problem (dropdown to add, chips with × to unlink)
- **IPC:** `linkProblemToRequest` / `unlinkProblemFromRequest`
- **DB Storage:** `linked_problems` array on Request records

### BasicMarkdownViewer
- **File:** `src/components/BasicMarkdownViewer.tsx`
- **What it does:** Lightweight markdown renderer for file previews. Handles headers, bold, italic, inline code, fenced code blocks, ordered/unordered lists, checkboxes, blockquotes, links.
- **No external dependencies** — pure React + Tailwind

### Agent Defaults
- **Utility:** `getDefaultAgent()` / `setDefaultAgent()` in `src/lib/defaults.ts`
- **Storage:** `localStorage` key `'terminal-defaultAgent'`
- **Default value:** `'claude'`
- **Replaces:** 9 previously-inline `localStorage.getItem('terminal-defaultAgent')` calls

### Terminal Workspace

- **Location:** Terminal page (`/terminal`)
- **What it is:** The entire terminal UI including sidebar + terminal layout (split panes, tabs)
- **Minimize:** Hides the terminal layout and sidebar but keeps PTY processes alive in the background. Clicking "Restore" shows everything again.
- **Close Workspace:** Kills all terminal processes and clears the workspace state. Always prompts to save first (Save & Close / Discard / Cancel). The save feature saves all active terminal sessions.
- **Saved Workspace Config:** A named snapshot of the terminal layout (which terminals are open, their split ratios) that can be restored later via the Configs tab in the sidebar.

### Workspace vs Session Distinction

- **Workspace** (noun): The permanent container — sidebar groups (Setup/Work/Insights/Studio/Context), terminal layout, project integration, presets, configs. Persists via `workspace:save`/`workspace:load` IPC. Survives session close/reopen.
- **Session** (noun): An ephemeral AI agent conversation within the workspace. Has a topic, agent type, status (active/idle/completed/error/cancelled), category, cost, tokens. Lives in `terminal_sessions` DB table. Can be resumed via `resume_id`.
- **Workspace Group** (noun): One of 5 top-level nav buttons (Setup/Work/Insights/Studio/Context) with browser-tab style, accent color, and sub-tab navigation.
- **Sub-tab** (noun): A secondary navigation within a group (e.g., Sessions/Map/Files under Work group). Rendered as rounded-full chip pills via SubTabBar.
- **Open Workspace:** Launch terminal workspace for a project from IDE page (navigates to /terminal with projectId + projectPath).
- **New Session:** Create a new AI agent conversation within an existing workspace (opens NewSessionDialog in terminal page).
- **Resume Session:** Reconnect to a previous AI agent conversation using its resume_id.
- **Saved Workspace List:** DOES NOT EXIST YET — workspace state auto-saves to `workspace_state` DB table but there's no UI to browse/restore previous workspaces.

### IPC Endpoints

| Endpoint | Purpose |
|----------|---------|
| `browserWithExtension` | Gets/Sets the tracking browser name from Settings |
| `timerBehavior` | Gets/Sets timer behavior (neutralAction, distractingAction) |
| `onForegroundChange` | Event: active window changed |
| `onBrowserTrackingEvent` | Event: browser tab changed (from extension) |
| `addLog` | Saves app/website session to database |
| `context-changed` | Event: context changed (problems/requests/checklists created/updated) |
| `link-problem-to-request` | Links a problem to a request |
| `unlink-problem-from-request` | Removes a problem-request link |
| `trackerMindSetup` | Provision flow: creates AGENTS.md, INITIALIZE.md, etc. |
| `terminal:write-raw` | Writes raw data to terminal PTY (used for context deltas) |

### File References

| File | Purpose |
|------|---------|
| `src/pages/DashboardPage.tsx` | Main UI: timer, recent sessions, heatmap |
| `src/pages/SettingsPage.tsx` | Settings UI: timerBehavior, browserWithExtension |
| `src/pages/TerminalPage.tsx` | Terminal workspace: context delta listener, bidirectional linking, agent defaults |
| `src/App.tsx` | Main app shell, loads preferences, passes to Dashboard |
| `src/main.ts` | Electron main process, database, IPC handlers |
| `src/components/NewSessionDialog.tsx` | New Agent dialog with Advanced Configuration toggle |
| `src/components/BasicMarkdownViewer.tsx` | Markdown renderer for file previews |
| `src/components/InstructionPanel.tsx` | Compose instruction panel with prompt preview |
| `src/lib/defaults.ts` | `getDefaultAgent()`/`setDefaultAgent()` + `DEFAULT_SYSTEM_PROMPT` |

### Key State Variables

| Variable | Where Defined | Purpose |
|----------|---------------|---------|
| `trackingBrowser` | App.tsx | Browser name from Settings (e.g., "Comet") |
| `isInBrowser` | DashboardPage.tsx | Boolean - is user currently in tracking browser |
| `currentApp` | DashboardPage.tsx | Current foreground app data |
| `currentWebsite` | DashboardPage.tsx | Current website data from browser extension |
| `activityFeed` | DashboardPage.tsx | Array of recent sessions with timestamps |
| `timerBehavior` | App.tsx / DashboardPage.tsx | { neutralAction, distractingAction } |
| `tierAssignments` | App.tsx / DashboardPage.tsx | { productive, neutral, distracting } arrays |
| `activeTerminalId` | TerminalPage.tsx | Currently focused terminal ID (context deltas target this) |
| `showAdvanced` | NewSessionDialog.tsx | Whether Advanced Configuration is expanded |
| `allRequests` | TerminalPage.tsx (ProblemDetailModal) | All requests loaded for bidirectional linking |

### Browser App
- **Setting Location:** Settings → Browser Activity → "Browser with Extension" dropdown
- **What it is:** The browser that has the DeskFlow extension installed (e.g., Comet, Chrome)
- **How it works:** When the browser app is the foreground window, the extension sends website data that gets logged to the database. When the user switches to a non-browser app, the extension data is blocked by the foreground app check in `handleBrowserData()` (main.ts:10643).
- **Key constraint:** Browser website data is ONLY persisted when the browser app is the active foreground window. This prevents phantom entries from background browser tabs.

### Flow: How Tracking Works

1. **App active** → `onForegroundChange` fires → check if tracking browser
2. **If tracking browser** → set `isInBrowser = true`, don't update `currentApp`
3. **Browser tab changes** → `onBrowserTrackingEvent` fires → show website
4. **Switch away from browser** → set `isInBrowser = false`, resume app tracking
5. **Timer logic** → uses `currentApp.category` OR `currentWebsite.category` depending on mode

---

## External Frontend Infrastructure Terms

### frontend-external-infra skill
- **Location:** `agent/skills/frontend-external-infra/SKILL.md`
- **What it is:** A skill that connects MCP servers serving real component/icon/motion libraries, so the agent doesn't invent UI from zero ("AI slop")
- **How it differs from other design skills:** Other design skills (frontend-design, impeccable, humancentred-UIUX) are *instructions* — they teach taste. This skill is the *inventory connector* — it tells the agent which MCP server to call for real building blocks.

### MCP Servers for Frontend (configured in opencode.json)

| Server | Package | Purpose |
|--------|---------|---------|
| **shadcn** | `npx shadcn@latest mcp` | Browse/search/read source of thousands of shadcn-compatible Tailwind+React components from any registered registry (shadcn/ui, Aceternity, etc.) |
| **magicui** | `@magicuidesign/mcp` | 150+ animated React components: beams, particles, bento grids, text animations, backgrounds, device mocks |
| **lucide** | `lucide-icons-mcp` | 1500+ SVG icon search — never guess icon names |
| **@21st-dev/magic** | `@21st-dev/magic` | Prompt→polished-React-component generation for unique variations (API key from `.env`) |
| **motion-dev** (community) | `github.com/Abhishekrajpurohit/motion-dev-mcp` | Offline Motion.dev docs + animation codegen for React/JS/Vue (free — clone+`npm run build`) |
| **unsplash** | `unsplash-smart-mcp-server` | Search stock photography with auto-attribution (Unsplash API key from `.env`) |
| **reactbits** | `reactbits-dev-mcp-server` | 135+ animated React components (CSS + Tailwind variants) |
| **iconify** | `better-icons-mcp` | 200,000+ icons across 200+ icon sets |

### AI Slop
- **Definition:** Generic, mass-produced UI output that looks like the statistical average of training data — indistinguishable from every other AI build
- **Root cause (in this context):** The agent invents UI patterns from scratch instead of pulling from real, curated, production-grade libraries
- **Fix:** Connected MCP servers (shadcn, Magic UI, Lucide, 21st.dev, Motion community MCP, Unsplash, React Bits, Iconify) + re-skin rules + anti-slop checklist
- **Reference:** `agent/docs/frontend-external-infra.md`

### Source Routing
- **Definition:** The decision table in the frontend-external-infra skill that tells the agent *which* MCP server to call for *what* kind of UI need (e.g., "standard block → shadcn", "animated effect → Magic UI", "icon → Lucide")
- **Location:** `agent/skills/frontend-external-infra/SKILL.md` — "Source Routing" section

### Re-Skin (or "re-skin rules")
- **Definition:** After pulling a component from any external source, the agent must replace the source's original styling with the project's own design tokens
- **For DeskFlow:** Replace colors with `--bg-primary`, `--accent-primary`, etc.; use `rounded-xl` max; use `p-5` padding; use Geist/JetBrains Mono fonts
- **Why this matters:** Without re-skin rules, sourced components would look foreign and inconsistent with the rest of the app

### Anti-Slop Checklist
- **Location:** `agent/skills/frontend-external-infra/SKILL.md`
- **What it is:** 10 checkpoints that block a PR if any fail — type, color, geometry, hero pattern, section labels, motion, imagery, empty states, icons, accessibility
- **Purpose:** Guards against the recognizable signature of AI-generated UI (default fonts, purple gradients, same-radius-everything, hero clichés)

## Design Workspace — New Library Sources

### Cult UI
- **Where:** Design Workspace → Registry Browser tab (`src/components/workspace/CultUIRegistry.tsx`)
- **What it is:** Premium shadcn registry components (Dynamic Islands, Family Buttons, rich animations). Installed via `npx shadcn@latest add https://www.cult-ui.com/r/<slug>`.
- **46 components** across 10 categories (Layout, Buttons, Navigation, Effects, Typography, Data Display, Cards, Forms, Overlay, Backgrounds).

### Fragments UI
- **Where:** MCP source in Design Workspace. Package `@usefragments/mcp`, channel `fragments-ui`.
- **What it is:** 66 accessible React components + 80 design tokens + `.fragment.tsx` metadata with 11 MCP tools (search, get, list, etc.). Free, no API key.

### shadcn/ui MCP
- **Where:** MCP source in Design Workspace. Package `@jpisnice/shadcn-ui-mcp-server`, channel `shadcn-ui-mcp`.
- **What it is:** Multi-framework shadcn/ui component documentation (React, Svelte, Vue, React Native) with smart caching.

### AIDesigner (aidesigner)
- **Where:** MCP source in Design Workspace. URL-based MCP at `https://ai-design.xyz/mcp`, channel `aidesigner`.
- **What it is:** Generate, clone, and refine production-ready web designs via MCP from a live URL. Requires API key.

### React Bits
- **Where:** Registry source in Design Workspace. Channel `reactbits`.
- **What it is:** 135+ animated React components (CSS + Tailwind variants) — text animations, particles, hover effects, background effects. No API key needed.

### Swishy Motion
- **Where:** Motion source in Design Workspace → Motion Explorer tab (`src/components/workspace/MotionExplorer.tsx`). Channel `swishy-motion`.
- **What it is:** Kinetic typography presets and Framer Motion curve settings. Includes 12+ motion preset snippets (Word Fade Cascade, Character Reveal, Glow Pulse, Card Hover Lift, Magnetic Button, etc.) and 9 easing curve presets with SVG bezier visualization.

### Variant
- **Where:** Web-tool source in Design Workspace. Channel `variant`. External link opens variant.com.
- **What it is:** Visual theme exploration canvas — infinite layout ideas based on visual themes. Feed canvas screenshots into agent vision.

### Design Workspace Tabs
- **Design Sources tab:** The main library card grid + taste knobs + style references + color picker. Shows all 10 library sources.
- **Motion Explorer tab:** Sub-tab of Design Workspace showing motion presets (kinetic typography code snippets) and easing curve browser with SVG cubic-bezier visualization.
- **Registry Browser tab:** Sub-tab of Design Workspace showing Cult UI component registry with search, category filters, and npx shadcn@latest command builder.

---

## 🧠 Context Systems & Retrieval Infrastructure — THE MAP (do NOT search again)

> User-mandated (2026-08-17): this is the definitive location map for the project's
> context/Brain/RAG/retrieval infrastructure. If a question asks "where is X in the
> context system", answer from HERE — never grep the repo again.

### Context Brain (knowledge graph + keyword + vector retrieval) — THE BRAIN
- **Engine:** `src/main/ai/contextBrain.ts` — bitemporal knowledge graph. Exports:
  `retrieve(query, strategies=['keyword','graph'])` (line 283 — the retrieval router),
  `keywordSearch` (208), `traverseFromEntity(entityId, depth=2)` (241), `logEpisode` (25),
  `upsertEntity` (68), `addFact` (120), `getAllCurrentFacts` (156), `storeEmbedding` (174),
  `exportContextBundle` (331), `getBrainStats` (370), job/extraction management (499-576).
- **Wiring in main.ts:** `require('./main/ai/contextBrain')` at **main.ts:13490**,
  `setBrainDb(db)` at 13554, IPC handlers `brain:search/get-entity/get-entity-history/
  log-episode/stats/export/get-episodes/get-entities/get-facts/get-entity-related/
  get-jobs/retry-job/create-episode/mcp-status/reindex-embeddings` at **main.ts:13619-13694**.
- **Preload bridges:** `brainSearch` … `brainReindexEmbeddings` at **preload.ts:1542-1556**.
- **DB tables:** `context_episodes`, `context_entities`, `context_facts` (bitemporal valid_from/valid_to),
  `context_embeddings` (Float32Array BLOB), `context_extraction_jobs`. DDLs in `src/main.ts` (~2980-3090).
- **Live data:** %APPDATA%\RHEO\deskflow-data.db — ~23 episodes, 16 entities, 25 facts, 23 embeddings.

### Context Brain MCP server (exposes the brain to AI tools over MCP)
- **File:** `src/main/ai/contextBrainMCP.ts` — HTTP MCP server, **port 54322**, optional token
  `DESKFLOW_MCP_TOKEN`, rate limit 60 req/min, MCP protocol 2026-07-28.
- **Tools:** search_context, get_entity, get_entity_history, log_episode, get_stats,
  get_user_profile_summary, get_active_facts, get_recent_signals.
- **Start:** `startMcpServer()` wired at main.ts:13556; status via IPC `brain:mcp-status`.

### User Profile & Signals (auto-context)
- **Files:** `src/main/ai/userContextService.ts` (profile + signals), `embeddingService.ts`
  (embedding generation; reached via brain's db), `entityExtraction.ts`, `episodeWriters.ts`
  (writeAiContextEpisode — AI Context Capture + other sources feed the brain).
- **Tables:** `user_context_profile` (1 row), `user_context_signals` (15 rows).
- **Injected into:** `assemble-context` handler (main.ts:15073) via `userContextService.getProfile()`
  (main.ts:15130-15132).

### Memory store (agent memories)
- **Files:** `src/main/ai/memoryStore.ts`, `memoryCapture.ts`, `memoryCompaction.ts`,
  `memoryExtractor.ts`, `memoryRetrieval.ts`.
- **Tables:** `agent_memories` (currently 0 rows — never populated), `ai_chat_memories` (17 rows).

### Backfill & Scheduler
- **Files:** `src/main/ai/contextBackfill.ts` (`runContextBackfill`), `contextScheduler.ts`
  (`startSchedulers`).
- **Wiring:** main.ts:13534 (`startSchedulers`), main.ts:13539 (`runContextBackfill`),
  main.ts:13714 (`runNow`).

### AI Context Capture (browser extension → brain pipeline)
- **Content scripts:** extension `ai-context-content.js` (MAIN world, fetch interception) on
  ChatGPT/Claude/Perplexity/You/Gemini → relay via `focusOverlay.js` → background.js →
  `POST http://localhost:54321/ai-context` → table `ai_context_captures` (CREATE at main.ts:2428,
  insert handler ~19956, IPC `ai-context:list/stats/delete/clear/get-brain-links/topics` ~7626-7646).
- **Renderer viewer:** AI Context Viewer panel in AiPage (provider filters, conversation cards,
  message bubbles, brain integration display).

### Knowledge Base (R5, BM25)
- **File:** `src/main/services/knowledge-store.ts` + `deskflow-kb.json`; IPC `get-rag-stats`
  (preload.ts:567). Separate from the brain.

### Context assembly for terminal agents
- **IPC:** `assemble-context` (main.ts:15073; preload.ts:876-877, preload2.ts:691-692;
  renderer `src/services/ContextService.ts:149` + `ContextAssemblyService.ts:68`).
- ⚠ **KNOWN GAP (2026-08-17):** assemble-context injects ONLY workspace_problems /
  workspace_requests / terminal_sessions / backup protocol / compact user profile. It does
  NOT call `contextBrain.retrieve()` — topic-based memory restoration ("if I say X it should
  know about X") is NOT wired into agent sessions. This is the gap the Architect prompt
  `agent/docs/generate-prompt-docs/context-retrieval-memory-restore-17082026/PROMPT.md` targets.

### The 6 knowledge systems (Setup toggles; digests injected per system)
- **Graphify:** `graphify-out/graph.json` + `GRAPH_REPORT.md` (rebuild via
  `python agent/skills/maintain-context/graphify_maintain.py rebuild`; use `python` = 3.12,
  NOT `py` = 3.14). `.graphifyignore` at repo root keeps scans fast (~40s). Skill:
  `agent/skills/graphify/SKILL.md` (missing in-project; global at
  `C:\Users\cleme\.config\opencode\skills\graphify\SKILL.md`).
- **LLM Wiki:** all `agent/*.md` files.
- **Obsidian Skills:** `agent/skills/<name>/SKILL.md` (YAML frontmatter).
- **PARA:** `CZVault/` (00_Projects, 01_Areas, 02_Resources, 03_Archives — currently empty
  scaffolding; PARA sync never completed). ⚠ `graphify_maintain.py sync/full/para` block on
  interactive `input()` in non-tty shells — pass vault path as arg or patch the script.
- **QMD:** `agent/templates/session.qmd`, `problem.qmd` — display-only, listed via
  `src/services/ContextService.ts`, surfaced in `ContextSidebar.tsx` + `WorkspaceSettingsDialog.tsx`.
- **Automations:** `agent/automations/automations.json` (declarative only; file currently missing).

### Renderer Brain UI (Life page "self" tab)
- ProfileTab ("Identity & Profile"), ContextGraphView ("Knowledge Graph"),
  BrainManagementView ("Memory & Brain") — all stacked inside the `self` tab of LifePage
  (max-w-5xl space-y-10, uppercase section headers). Never re-split into separate tabs.
- ✅ **MOVED 2026-09-30 (user decision, SHIPPED):** the brain now lives on **AI Assistant**
  (`BrainSurface.tsx`, the **Brain** button in the AiPage topbar — a 4th `aiSubPage`).
  Tabs: Graph / Search / Trail / Manage. Life's `self` tab keeps Identity + episode/entity/fact
  counts + an "Open Context Brain" link (`#/life?tab=self`, and Life defaults to `river`
  view mode so the `self` tab needs the Pages toggle).
  **`ContextRetrievalPanel` and `ExternalAITrail` are no longer dead code** — both had zero
  reachable mount sites before this.
- ⚠ **Still-dead brain UI (2026-09-30):** `features/warmth/ContextGraphView.tsx` is still
  imported by `LifePage.tsx:27` and NEVER rendered; `components/life/ContextGraphView.tsx`
  has zero importers. `BrainGraph.tsx` / `CanvasGraph.tsx` are reachable only via
  `BrainVisualization`. `/context-brain` route does not exist (remapped per
  `components/dashboard/widgetNav.ts:25`).
- ⚠ **API SHAPE TRAP (cost a verification cycle):** `brain:get-entities` and `brain:get-facts`
  return `{ items, total }` — NOT `{ entities }` / `{ facts }`. Facts use camelCase
  `subjectId`/`objectId`/`objectLiteral`, not snake_case. A fact with `object_id IS NULL`
  is a LITERAL (e.g. `has_conversation: "..."`), so it counts as a fact but never becomes
  a graph edge — a graph showing `0 links` with non-zero facts is correct, not a bug.

### Chat Library — one store for every AI conversation (2026-09-30)
- **MEANS:** the search/group/browse surface for EVERY conversation with any AI — in-app
  DeskFlow chat, external AI (ChatGPT/Claude/Perplexity…) captured by the extension, AI
  Gateway runs, and imported files. Not a "chat history" list.
- **Engine:** `src/main/ai/chatLibrary.ts`. Makes `ai_chat_threads` + `ai_chat_messages`
  the single store. `ingestConversation()` is the ONE funnel; `searchChats()` is the query.
- **Load-bearing invariants:** (1) ingest is content-hash deduped (`sha1` of normalised
  transcript) because the extension re-captures the same conversation on every poll;
  (2) `migrateChatLibrary()` MUST run before any ingest or the additive
  `source`/`group_id`/`pinned` columns do not exist and inserts silently fail.
- **Wiring:** IPC `chat-library:*` (main.ts ~18640); preload `chatLibrary*`
  (preload.ts ~1254). Auto-ingest wired into `ai-chat:save` and `POST /ai-context`.
  The **AI Gateway `sendPrompt` path does NOT feed the library yet** (gaps: gateway has no
  session/provider wiring into the library, and imports the brain-blind `sendPrompt`).
- **UI:** `src/components/ai/chat/ChatLibrary.tsx`, opened by the **Library** button in the
  AiPage topbar. Two-column: search-first index | transcript preview. Pinned items render
  in their own section ABOVE the group sections (pin beats group order). Auto-titles skip
  greetings ("hi"/"ok") and take the first substantive user turn. Auto-group classifies
  into Work/Learning/Creative/Life/Reference/Unsorted by keyword.
- **Still dead:** the `Export` button (AiPage ~1636) downloads JSON that nothing reads back.

### External AI transport — extension vs gateway (2026-09-30)
- **MEANS:** the seam every bridge "Send to AI" button uses.
  **EXTENSION (default, unchanged):** queue → extension injects into an AI tab you already
  have open + logged into → scrapes reply → matched by `correlationId` (async).
  **GATEWAY (opt-in):** Playwright drives the provider web UI with a per-provider persistent
  profile + AES-256-GCM vault; the reply arrives SYNCHRONOUSLY in the promise, so there is
  no correlation to wait for. User choice persists in `localStorage.deskflow_external_ai_transport`.
- **Engine:** `src/services/externalAiTransport.ts` (`getPreferredTransport`,
  `setPreferredTransport`, `gatewayAvailability`, `sendViaGateway`, `extractField`).
- **Consumed by:** `ai-bridge/FieldAIButton.tsx`, `ai-bridge/BridgeForm.tsx`,
  `content-engine/ExternalAIBridge.tsx`, `content-engine/ExternalAIBridgeField.tsx`
  — the only 4 real seams; the other ~11 files consume those and needed no change.
- **Gateway is brain-blind upstream** — `AIGatewayService.sendPrompt` only writes
  `aigateway_runs`. Compensated in `main.ts` `aigateway:send-prompt`, which mirrors every
  successful run into the Chat Library AND writes a brain episode, so both transports feed
  the same learning loop.
- **Sign-in:** Workspace → AI Gateway → Providers → "Setup" (opens real Chrome at the login
  URL, solve 2FA/CAPTCHA by hand) → "Verify & Save" (persists cookies to the vault).
  There is NO automated login and there should not be — every adapter sets
  `antiBot.cloudflare: true`, so scripting that login is a ToS violation and a ban risk.

## 🛠️ Tool Terms (IPC tools available to agents)

### "architecture map" / "arch map" / "scan the codebase"
- MEANS: the Architecture Map tool at `window.deskflowAPI.archMap` that scans `src/` and returns nodes (pages, components, services, hooks) with file paths, line counts, imports, exports, features, IPC handlers/calls, and child components.
- IPC: `arch-map:generate` (full scan, cached 30s), `arch-map:get-node` (single node detail), `arch-map:search` (fuzzy search).
- UI: **Insights → Architecture** subtab in the terminal workspace.
- Prompt: `agent/docs/generate-prompt-docs/architecture-map/PROMPT.md` — paste into AI agent to generate `ARCHITECTURE.md` with file:line references.

### "user dictionary" / "custom terms" / "my terminology"
- MEANS: the User Dictionary system at `window.deskflowAPI.userDictionary` where users define their own word meanings. Terms are injected into every agent's system prompt via `assemble-context`.
- IPC: `user-dictionary:list/add/update/delete/export/import`.
- UI: **Context → Dictionary** subtab in the terminal workspace.
- DB: `user_dictionary` table (term, definition, context, aliases).

### "agent phase" / "agent state" / "is the agent ready"
- MEANS: the 5-phase state machine tracking AI agent lifecycle: `launching → ready → busy → attention → error`.
- Detection: prompt regex (per-agent patterns like `/^(?:opencode)?\s*>\s*$/i`), TUI settle heuristic (150B + 500ms silence), shell rejection, write verification (2.5s timer).
- IPC events: `agent:status`, `agent:ready`, `agent:idle`, `agent:timeout`, `agent:init-error`, `agent:write-verified`, `terminal:anomaly`.
- Preload: `agentGetPhase(terminalId)`, `agentGetStatus(terminalId)`, `agentSend(terminalId, data, agentType)`.

### "context systems" / "system health"
- MEANS: the 7 knowledge systems (LLM Wiki, Obsidian Skills, Graphify, PARA, QMD, Automations, Design Skills) tracked by `window.deskflowAPI.getContextSystems()`.
- IPC: `get-context-systems` returns per-system: id, name, itemCount, itemLabel, available, lastBuilt, error.
- UI: **Context → Maintenance** subtab + **New Agent dialog → Advanced Configuration**.
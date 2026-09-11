# PROMPT — IDE Page: AI Tools Heatmap Fix + Analytics Code Changes + Mojibake Statuses

**ROUND:** generate-prompt round for App Tracker (DeskFlow) IDE page
**DATE:** 2026-08-05
**CONTEXT BUNDLE:** `CONTEXT_BUNDLE.md` (same folder) — contains all actual source code referenced below. Read it BEFORE designing. Every feature must be engineered end-to-end: `main.ts` IPC handler → `preload.ts` bridge → renderer component → DB.

---

## 1. RAW USER REQUEST (verbatim, as transmitted)

> **Message 1 — Usage Pattern heatmap bug (AI Tools tab):**
> "im on the AI tools page. u know the usage pattern card. so when I change the period... All tools and then switch it to all time... doesn't show the heatmap. ... this problem only actually appears when I select it into the all mode... when I switch it into like the individual AI coding tools, it works properly... even in the 30 days, I do think it works properly. It's only on the all-time mode where I think there's multiple different AIs."
>
> **Message 2 — Analytics page missing code changes:**
> "the analytics page doesn't show code lines or changes. I want the analytics page to show code changes over time. Like 7 days or all time. With a chart showing weekly and daily amounts of code added and removed, hours, and I want to know how it will access the files and changes. I want the agent to research how the extension works, how it can access the files, and what changes would be needed."
>
> **Message 3 — Garbled status display:**
> "the red thing with weird cursed letters" (problems with status `AI Attempted Fix` render with garbled/double-encoded characters in the IDE analytics/workspace UI).

## 2. MANDATE — DESIGN EVERYTHING, NOTHING IS OPTIONAL

You are designing for a target AI that has **ZERO access to this codebase**. Produce complete, self-contained designs. Every directive below is mandatory — there is no triage step where you decide what matters.

### 2.1 Fix the Usage Pattern heatmap (AI Tools tab, IDE page)

Repro (user-confirmed): open `/ide` → AI Tools tab → Usage Pattern card. Set the heatmap tool filter to **All** and the period selector to **All Time** (the lock toggle) → **the heatmap does not render at all**. The same card renders fine when a single tool is selected in All Time mode, and renders fine in 30-day mode with All selected.

Design the root-cause fix. Known suspicious spots (confirmed in code, see bundle §3):
- The heatmap reads ONLY `overview?.aiUsage?.byTool[agent.id]?.daily` (AIToolsTab.tsx:1948-1960) while the agent list reads `workspaceAnalytics?.aiUsage?.byTool` **preferentially** when non-empty (AIToolsTab.tsx:312-315). `get-ai-usage-summary` (main.ts:10022-10087) builds `byTool` entries **WITHOUT** a `daily` key — only `get-ide-projects-overview` provides `daily`. Any mismatch between the two fetches (period, error, empty result) silently empties the heatmap.
- In All Time (`period === 'all'`) both handlers leave `sinceDateStr`/`dateFilterSQL` null (main.ts:10029-10041, 10209) — so data exists; verify the exact early-return that kills rendering (AIToolsTab.tsx:1946, 1953, 1975, 2007) and the `heatmapToolFilter` state wiring.
- Verify whether `get-ide-projects-overview` returns an `aiUsage` object for period `'all'` at all (main.ts:10227-10260) and whether `overview` state in IDEProjectsPage can go stale vs. `effectiveAiPeriod` (IDEProjectsPage.tsx:755-771).

**Required deliverables for 2.1:**
- Exact root cause (name the line(s) that return null / skip data).
- The fix, renderer-side preferred (hard invariant: prefer renderer-side fixes; read the WHOLE IPC handler before editing main.ts).
- A hardening rule so the heatmap can never silently vanish again (e.g. defensive fallback between the two byTool sources, period-aware data derivation).
- Verification steps in the real UI (click All + All Time lock, assert grid renders; switch modes; assert no regressions in 30-day/individual modes).

### 2.2 Add code-change analytics to the Analytics page (IDE page + Terminal workspace analytics)

Current state: the Analytics dashboard (`AnalyticsDashboard.tsx`, used by both IDE page and Terminal workspace) shows sessions, problems, requests, AI usage, language distribution — **no code lines or change metrics at all**. The only commit surface today: `get-ide-projects-overview` returns `commits: { totalCommits, totalAdditions, totalDeletions }` — and its SQL is **hardcoded to the last 30 days regardless of period** (main.ts:10241-10245).

User wants:
1. Code changes over time — **7 days and all time** (plus the existing period selector).
2. A chart showing **weekly** code added/removed.
3. **Daily** amounts of code added and removed.
4. **Hours** worked (derive from commit timestamps / `date` column).
5. A research answer: **how will the app access the files and changes** — how the browser extension + desktop app can obtain commit/file-change data, and **what changes are needed** to make it work. (Reference: prior research docs `agent/docs/generate-prompt-docs/6-research-prompt-IDEtracker-15042026/research-01-ide-integration.md` and `research-03-git-metrics.md` — VS Code/Cursor SQLite storage, GitHub `/stats/code_frequency` etc. — must be incorporated into the design.)

Known backend reality (see bundle §4):
- `commits` table EXISTS with real data when `sync-commits` ran: `id, project_id, sha, author, author_email, date, message, additions, deletions, files_changed` (main.ts:2153-2168).
- IPC channels exist: `get-commit-history` (main.ts:14662), `get-contributor-stats` (main.ts:14678), `sync-commits` (main.ts:14371+), `sync-github-commits` (main.ts:14427).
- **GAP:** no per-period commit aggregation, no daily/weekly series endpoint, no hours computation. This is a backend gap — you MUST design a backend implementation spec (new/updated IPC handler + SQL + response shape) alongside the frontend spec.

**Required deliverables for 2.2:**
- Backend spec: extend `get-ide-projects-overview` (or new `get-code-change-stats`) to return: daily series `[{ date, additions, deletions, commits, hours }]`, weekly aggregates, totals for arbitrary period (`7day`/`all`/etc.). SQL must respect the requested period — kill the hardcoded 30-day commit query. Include the actual SQL statements and the exact response shape.
- Hours derivation rule (e.g. cluster commits by day, cap per-day hours, use `date` column).
- Frontend spec: where the chart(s) live in `AnalyticsDashboard.tsx` (new card set, ordering, empty/loading/error states), chart type (Chart.js bar/line with stacked added/removed), the period selector behavior (reuse existing `period` prop), weekly + daily view toggling.
- The research answer (extension/file-access strategy) as a design section with a concrete recommendation and the changes needed (extension side + desktop side).
- Empty state design (no commits synced yet → CTA to run sync-commits or add a git remote).

### 2.3 Fix the "weird cursed letters" red cards

User calls them "the red thing with weird cursed letters" — problems cards (status `AI Attempted Fix`) on the IDE Analytics page / workspace issues UI display mojibake text.

Confirmed root cause: `agent/problems.json` (485 occurrences) and `agent/requests.json` (327 occurrences) contain **double-encoded UTF-8** (mojibake sequences like `â€"`, `â€™`, `Aâ€'A`, `ê`). Sample from problems.json:
```
voke('write-terminal', { terminalId, text })` A��'A.A�A�A�A��?sA�A.�?oA��'A+�?TA��?sA,A�A��'A+�?TA�A�A��?sA�A,A� `ipcRenderer.invoke('write-...
```
The UI renders these bytes verbatim → cursed letters.

**Required deliverables for 2.3:**
- Fix strategy: decode/clean the data (precise algorithm for detecting + repairing double-encoded UTF-8 in the JSON files AND in already-synced DB rows in `workspace_problems`/`problems` tables), plus a **render-time guard** so any future mojibake never shows raw (e.g. a sanitizer util applied in the ProblemsTab/IssuesWorkspace/badges rendering path).
- Note: DB rows are synced from these JSONs (workspace `sync` IPC) — design the repair to run on both JSON and DB without data loss. Never DELETE rows — only decode.
- Verify against the actual samples provided.

---

## 3. ENGINEERING TASK (pipeline overview)

- **Stack:** Electron + React 18 + TypeScript + Tailwind CSS v4 (`@import "tailwindcss";`, pinned 4.2.1) + better-sqlite3 + Chart.js (react-chartjs-2) + Framer Motion + zustand. All localStorage access MUST be wrapped in try/catch.
- **Data pipeline pattern (one end-to-end example in bundle §1):** renderer → `window.deskflowAPI.<channel>` (preload.ts contextBridge, channel names verbatim) → `ipcMain.handle('<channel>', ...)` in main.ts → better-sqlite3 query → typed object → renderer.
- **File conventions:** files are CRLF, do not mass-reformat. New components go where the bundle says. Reuse existing UI primitives (GlassCard, SectionHeader, ChartCard) — do not create duplicate card systems.
- **Errors:** return Result-like shapes or safe defaults (see bundle §1 for the `Result<T>` convention used by main.ts services); never throw uncaught into the renderer.
- **Hard invariant:** prefer renderer-side fixes; read the WHOLE IPC handler before editing main.ts. Never reorder PTY events (irrelevant here but don't touch terminal code at all unless the feature requires it — it does not).

## 4. VISUAL & UX SPEC (DeskFlow design language)

- **Dark mode only.** Glass layer: `bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl !p-5` (exact pattern used by every card in AnalyticsDashboard). Max radius `rounded-xl`, max padding `p-5`.
- **Fonts:** Geist (body) + JetBrains Mono (numbers/code). Text hierarchy: `text-sm font-medium text-zinc-200` card titles, `text-[10px] text-zinc-500` labels, bold accent numbers (`text-xl font-bold text-<accent>-400`).
- **Accent mapping (existing):** AI = purple/violet (#8b5cf6→#a78bfa), code/commits = emerald/cyan family or blue (existing language chart uses CHART_COLORS; commits card accents: emerald for additions `#10b981`, rose `#f87171` for deletions — consistent with Git convention).
- **Heatmap cells:** existing scale `rgba(16,185,129,<0.04→0.9>)` emerald, 14px cells, 3px gap, Monday-start weeks, month labels, scrollable overflow-x.
- **Charts:** Chart.js. Bar chart for daily added/removed (stacked or grouped), line/bar for weekly totals. Match existing chart options pattern in AnalyticsDashboard (`grid: { color: 'rgba(113,113,122,0.06)' }`, tick color `#71717a`).
- **All 4 states everywhere:** empty (no commits/data → CTA, see 2.2), loading (skeleton or existing pattern), error (inline message, never blank), populated.
- **Mojibake guard:** sanitizer must be invisible in normal cases — only affects corrupt bytes.
- **Anti-slop:** no purple gradients on everything, no hero clichés, no duplicate "AI" labels, icons from Lucide only (import from `lucide-react`), motion via Framer Motion `initial/animate` like siblings, no new font imports.
- **Icons (Lucide, use exact names):** `Code2`, `GitCommitHorizontal`, `GitPullRequestArrow`, `Plus`, `Minus`, `Clock`, `CalendarDays`, `FileCode2`, `AlertTriangle`, `Wrench`, `FileText`. Verify names via lucide-icons-mcp before use — never guess.

## 5. CONSTRAINTS & RULES

- **MCP component sources** (you MUST pull real components, never invent from zero):
  - shadcn/ui (`@shadcn/*` registry) — standard UI (button, card, select, tooltip, skeleton, tabs, badge)
  - Magic UI (`magicui_*` tools) — animated accents (BorderBeam, NumberTicker, AnimatedCircularProgressBar) ONLY where the bundle says the project already uses them; do not add heavy effects to data cards
  - Lucide via lucide-icons-mcp — all icons
  - React Bits / Iconify — only if a shadcn+Lucide combination is insufficient
- **Skills the implementer must follow:** frontend-design, impeccable, humancentred-UIUX (all 4 states), frontend-external-infra (source routing + anti-slop checklist + DeskFlow re-skin), TDD (jsdom test env).
- **Re-skin rule:** any external component pulled in MUST be re-styled to the §4 tokens. Never ship raw third-party styling.
- **DB safety:** never DELETE/DROP. Mojibake repair = decode in place. All migrations via guarded `ALTER TABLE` pattern (see bundle §4).
- **Backup rule:** any file replaced during implementation gets a timestamped backup (`.bak.YYYYMMDD-HHMMSS`), and the user must confirm before destructive actions.

## 6. DELIVERABLES (RESULT.md must cover ALL of these)

1. Root cause + fix for the All/All-Time heatmap vanish (2.1), with the exact lines changed.
2. Full backend spec + implementation for code-change analytics (2.2): IPC channel, SQL, response shapes, hours rule.
3. Frontend implementation of the code-change cards + weekly/daily charts + empty/loading/error states (2.2).
4. The research answer: how file/change access works (extension + desktop) and what changes are needed (2.2).
5. Mojibake repair (2.3): decode algorithm for JSON + DB, render-time sanitizer, verified against real samples.
6. Verification checklist per feature (real UI clicks, console logs, DB queries) in the layer each feature lives in.

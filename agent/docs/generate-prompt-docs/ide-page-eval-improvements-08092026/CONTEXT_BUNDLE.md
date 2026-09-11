# Context Bundle: IDE Page — Evaluate & Improve Dashboard + Projects Subpages

**Date:** 2026-09-08
**Target page:** `src/pages/IDEProjectsPage.tsx` (4396 lines)
**Subpages in scope:** `overview` tab + `projects` tab
**User request (verbatim):** "focus on the ide page and see htag most of ht pages areally fucking soppy in termso f thedesign especialyl the first two subpages of hte page which is the dahbaord and the projects subpage. i would like you to evaluate and see hwat are some improvements and doing it by using hte /generate-prompt skill to beable to do so properly. explore the features nad like sutf f and the ui revmap usign all frontend skills /skill-router skill to know what are htelist of skills to use and how to use htem properly."

---

## 1. Page Routing & Entry Point

From `src/App.tsx` line 2815:
```tsx
<Route path="/ide" element={<IDEProjectsPage selectedPeriod={selectedPeriod} dateOffset={dateOffset} />} />
```

Sidebar entry (App.tsx line 1159):
```tsx
{ icon: Code2, label: 'IDE Projects', path: '/ide' }
```

`data-page="ide"` in `src/index.css` line 7:
```css
[data-page="ide"] { --page-accent: #8b5cf6; }
```

---

## 2. Tab Structure (7 tabs)

From `src/pages/IDEProjectsPage.tsx` lines 325-333:
```tsx
const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'ai', label: 'AI Tools', icon: Bot },
  { key: 'git', label: 'Git', icon: GitBranch },
  { key: 'environment', label: 'Environment', icon: Boxes },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'backup', label: 'Backup', icon: Archive },
];
```

Type definition (line 317):
```tsx
type TabKey = 'overview' | 'projects' | 'ai' | 'git' | 'environment' | 'analytics' | 'backup';
```

---

## 3. Overview Tab — Full Source (lines 1350-1578)

```tsx
{activeTab === 'overview' && (
  <div data-section="ide.overview" className="space-y-6">
    {/* Live Pulse Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Live Coding', value: `+${fmtNum(codeActivity?.totalLinesAdded || 0)}`, sub: `-${fmtNum(codeActivity?.totalLinesRemoved || 0)} lines · ${fmtSec((codeActivity?.totalDurationMs || 0) / 1000)} active`, icon: Code2, color: '#10b981', bg: 'bg-emerald-500/10' },
        { label: 'AI Pulse', value: <TokenValue value={overview?.aiUsage?.totalTokens || 0} />, sub: <CostValue value={overview?.aiUsage?.totalCost || 0} />, icon: Sparkles, color: '#a855f7', bg: 'bg-violet-500/10' },
        { label: 'Git Velocity', value: overview?.commits?.totalCommits || 0, sub: `commits this period`, icon: GitCommit, color: '#f59e0b', bg: 'bg-amber-500/10' },
        { label: 'Top Tool', value: topToolName || '—', icon: Cpu, color: '#3b82f6', bg: 'bg-blue-500/10' },
      ].map((stat, idx) => (
        <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
          className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
            <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold tabular-nums tracking-tight text-white truncate">{stat.value}</div>
            <div className="text-xs text-zinc-400 truncate">{stat.label}</div>
            {stat.sub && <div className="text-[10px] text-zinc-500 truncate mt-0.5">{stat.sub}</div>}
          </div>
        </motion.div>
      ))}
    </div>

    {/* AI & Projects Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* AI Usage Overview */}
      <motion.div data-tutorial="ide.usage"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <div>
              <div className="text-xl font-semibold">AI Tool Usage</div>
              <div className="text-sm text-zinc-500">Last 30 days</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setLogScale(!logScale)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition ${logScale ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-400 hover:text-white'}`}>Log</button>
            <button onClick={() => setExcludeOutliers(!excludeOutliers)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition ${excludeOutliers ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-white'}`}>♯ Out</button>
          </div>
        </div>

        {aiAgents.filter(a => a.status !== 'inactive').length > 0 ? (
          <>
            <div className="h-48 mb-6">
              {/* Bar chart — 29-day stacked AI token usage */}
            </div>
            <div className="space-y-3">
              {aiAgents.filter(a => a.status !== 'inactive').map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: agent.color + '22' }}>
                      <Code2 className="w-4 h-4" style={{ color: agent.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{agent.name}</div>
                      <div className="text-xs text-zinc-500">{agent.sessions} sessions · {agent.messageCount} msgs</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-emerald-400"><CostValue value={agent.cost} /></div>
                    <div className="text-xs text-zinc-500"><CostValue value={agent.cost} /></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState icon={<Sparkles className="w-12 h-12" />} title="No AI usage data yet" description="Sync AI to start tracking" />
        )}
      </motion.div>

      {/* Recent Projects */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-xl p-5"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xl font-semibold">Recent Projects</div>
              <div className="text-sm text-zinc-500">{overview?.projects?.length || 0} projects tracked</div>
            </div>
          </div>
          <button onClick={() => setActiveTab('projects')} className="text-xs text-violet-400 hover:text-violet-300">View all →</button>
        </div>
        {overview?.projects && overview.projects.length > 0 ? (
          <div className="space-y-3">
            {overview.projects.slice(0, 5).map((project: any) => (
              <div key={project.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl hover:bg-zinc-900/70 transition-colors">
                <div>
                  <div className="text-sm font-medium text-white">{project.name}</div>
                  <div className="text-xs text-zinc-500 truncate max-w-[200px]">{project.path}</div>
                </div>
                <div className="flex items-center gap-2">
                  {project.vcs_type && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-md flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />{project.vcs_type}
                    </span>
                  )}
                  {(() => {
                    const langs = projectLanguages[project.path];
                    const detected = langs?.[0]?.language || project.primary_language;
                    const pct = langs?.[0]?.percentage;
                    if (detected) {
                      return (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-md">
                          {detected}{pct !== undefined ? ` ${pct}%` : ''}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Terminal className="w-12 h-12" />} title="No projects tracked yet" description="Add a project to get started" />
        )}
      </motion.div>
    </div>
  </div>
)}
```

---

## 4. Projects Tab — Full Source (lines 1695-2078)

Key sections:

### Add Project button (lines 1703-1736):
```tsx
<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl transition-colors duration-150">
  <Plus className="w-4 h-4" /> Add Project
</motion.button>
```

### Project card structure (lines 1747-2062):
```tsx
<motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
  transition={{ delay: idx * 0.05 }}
  className="glass rounded-xl overflow-hidden">
  {/* Card Header */}
  <div className="p-5">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold truncate">{project.name}</h3>
          {project.default_ide && (
            <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full">
              {projectIde?.name || project.default_ide}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 font-mono truncate mt-1">{project.path}</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => handleEditProjectClick(project)}
          className="p-2 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => toggleProjectExpand(project)}
          className={`p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors duration-150 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-4 h-4" />
        </button>
        <button onClick={() => handleDeleteClick(project)}
          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
    {/* Quick Actions */}
    <div className="flex items-center gap-3 mt-4">
      {/* Run / Stop, Open in IDE, Open Workspace buttons */}
    </div>
    {/* Tags row — languages, health, tools, sessions */}
  </div>
  {/* Expanded content (AnimatePresence) */}
</motion.div>
```

---

## 5. Data Fetching — IPC Calls

From `src/pages/IDEProjectsPage.tsx`:

**Overview load (line 771):**
```tsx
const loadOverview = async (period?, offset?) => {
  const [data, caData] = await Promise.all([
    window.deskflowAPI!.getIDEProjectsOverview(effectivePeriod, effectiveOffset),
    window.deskflowAPI!.getCodeActivityStats?.(effectivePeriod, effectiveOffset, selectedProject || undefined).catch(err => null),
  ]);
};
```

**AI usage + analytics (line 627-656):**
```tsx
const [aiUsageSummary, problems, requests, sessions, promptHistory, codeStats, codeActivityResult] = await Promise.all([
  window.deskflowAPI.getAIUsageSummary(effectivePeriod, effectiveOffset),
  window.deskflowAPI.getProblems(),
  window.deskflowAPI.getRequests(),
  window.deskflowAPI.getTerminalSessions?.(undefined, 500),
  window.deskflowAPI.getPromptHistory?.({ limit: 1000 }),
  window.deskflowAPI.getCodeChangeStats?.(effectivePeriod, effectiveOffset, selectedProject || undefined),
  window.deskflowAPI.getCodeActivityStats?.(effectivePeriod, effectiveOffset, selectedProject || undefined),
]);
```

**Git data (line 731-744):**
```tsx
const [commits, contributors, dora] = await Promise.all([
  window.deskflowAPI!.getCommitHistory(projectId, 50),
  window.deskflowAPI!.getContributorStats(projectId),
  window.deskflowAPI!.getDORAMetrics(projectId, 'month'),
]);
```

---

## 6. Design Tokens in Use

From `src/index.css` line 7:
```css
[data-page="ide"] { --page-accent: #8b5cf6; }  /* violet-500 */
```

From `src/index.css` lines 1-2 (Tailwind v4 theme tokens):
```css
@theme {
  --color-background: #09090b;
  --color-foreground: #fafafa;
  --color-card: #18181b;
  --color-card-foreground: #fafafa;
  --color-popover: #18181b;
  --color-popover-foreground: #fafafa;
  --color-primary: #fbbf24;
  --color-primary-foreground: #09090b;
  --color-secondary: #27272a;
  --color-secondary-foreground: #fafafa;
  --color-muted: #27272a;
  --color-muted-foreground: #a1a1aa;
  --color-accent: #27272a;
  --color-accent-foreground: #fafafa;
  --color-destructive: #ef4444;
  --color-border: #27272a;
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

Glass classes from `src/index.css` lines ~20:
```css
.glass { background: var(--bg-glass); backdrop-filter: blur(16px); border: 1px solid var(--border-glass); }
.glass-heavy { background: var(--bg-glass-heavy); backdrop-filter: blur(24px); border: 1px solid var(--border-glass); }
```

---

## 7. Current UI Problems Observed

### Overview Tab:
1. **Header missing** — no `<h1>` page title, no `SectionHeader`. Just a plain `<p>` tagline and a Help button. No visual anchor.
2. **Four stat cards all use identical styling** — same `bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-xl p-4` — no hierarchy, no depth differentiation (violates design spec §5: "Every card must have a distinct visual weight").
3. **"Live Coding" card shows `+0`** and `-0 lines` with empty `0m active` — no loading skeleton, no empty state for the code activity data.
4. **"AI Pulse" card duplicates sub text** — `sub` and the second line of the right column both render `<CostValue>` (same value twice).
5. **"View all →" link** in Recent Projects is just a `<button className="text-xs text-violet-400">` — no visual cue it's clickable, no hover affordance beyond color change (impeccable anti-pattern: interactive elements need clear hover/active).
6. **29-day bar chart** has no empty state — if `aiAgents` all have `status === 'inactive'`, the chart area collapses into EmptyState (design inconsistency: chart area is `h-48` but disappears entirely).
7. **AI agent list cards** — `p-3 bg-zinc-900/50 rounded-xl` all same — no visual hierarchy between agents with significant usage vs zero usage.

### Projects Tab:
1. **No page title** — same issue as Overview.
2. **"Add Project" button** uses `bg-gradient-to-r from-violet-600 to-indigo-600` — gradient background on a functional action button violates `frontend-design` §Anti-Patterns ("Decorative gradients on functional elements"). Violates `Impeccable` §Color anti-pattern #11 ("Gradients that span more than 45°").
3. **Project cards** are all `glass rounded-xl` — identical border treatment, no way to distinguish active/running projects from idle ones visually beyond a small "Stop" button.
4. **Running project indicator** — only a small animated `w-2 h-2 bg-red-400` dot + "Stop" button. No prominent running-state treatment.
5. **Language tags** — 3 stacked pills with tiny colored dots, plus an expand-on-hover tooltip that shows 5 more languages. Dense and complex for a small card header area.
6. **No keyboard focus states** visible on project card buttons — three icon-only buttons (pencil, chevron, trash) with only `hover:` styles.
7. **The "Run" / "Stop" / "Open in IDE" / "Open Workspace" buttons** are all `flex-1` of equal width — no primary action emphasis (Impeccable §UX Writing: "Primary action of any screen is obvious within 1 second").
8. **Project path** is `font-mono truncate` at 200px max — on smaller windows this truncates without ellipsis context.
9. **Expanded project details section** uses `border-t border-zinc-800 bg-zinc-900/30` — no visual connection to the card header, feels tacked on.
10. **No loading state** for project cards while `loadingProjectDetails` is true — shows a spinner inside the expanded area only.

---

## 8. Skills Mandated for This Evaluation

Per `skill-router` DESIGN category, ALL 8 MANDATORY skills must be applied:

| # | Skill | Key Principles for This Page |
|---|-------|------------------------------|
| 1 | `frontend-external-infra` | Pull real MCP components before hand-rolling; use shadcn for cards, Magic UI for chart variants; re-skin to DeskFlow tokens |
| 2 | `frontend-design` | IDE Projects page pattern = Sticky Header + Tabs; page-accent = violet-500; card padding `p-5`; max `rounded-xl`; TabBar pills pattern |
| 3 | `Human-Centric UX` | 4 states for every data element (empty/loading/error/populated); primary action obvious in 1s; plain-language copy |
| 4 | `Impeccable` | 7 domains; typography min 13px body, 400 weight min; no gradients on functional elements; cubic-bezier not spring; focus-visible rings |
| 5 | `Motion` | L2 (Responsive) default for dev tools; 150-300ms; transform+opacity only; one ambient accent max; stagger 40-60ms |
| 6 | `Design Taste System` | Variance=5, Motion=5, Density=7 (DeskFlow defaults); anti-repetition rules |
| 7 | `UI UX Pro Max` | Developer tool rules: dark chrome, monospace dominance, high density, no rounded corners > 8px on terminal elements |
| 8 | `Taste Skill` | Knob tuning; aesthetic matrix; prevent generic output |

Plus RECOMMENDED: `signature-design` (page-level redesign), `font-selection` (verify font stack).
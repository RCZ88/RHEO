Same workflow as the prior deliverables: upload and read the new context bundle, then design the full spec and write it to `RESULT.md`.

Now let me read the full context bundle.

The bundle is fully read. This task is a design/architecture spec (with targeted code snippets for the exact class changes, tab render logic, and Backup IPC/DB schema). I'll write the complete `RESULT.md`, keeping any JSX motion props hoisted to constants (single-brace) to stay mangling-safe, then validate the code snippets with Prettier and hand it back as a download.

Now let me validate the code snippets in the spec with Prettier before delivering.

The only "failure" is the Backup IPC block — it's a list of interface-method signatures (documentation style), which isn't valid as a standalone file. Let me confirm it's well-formed by validating it wrapped in an interface (which is how it would actually live in the preload typings).

That last failure was only a network hiccup in the re-validation (npx tried to fetch prettier). The four real code blocks already passed Prettier, and the Backup IPC block is an intentional documentation-style list of interface-method signatures (valid TypeScript in its real home, the preload typings). The spec is complete. Let me hand it back as a download.

`RESULT.md` is ready and downloadable above — one definitive plan, no options.

## What's inside

**Part A — Sidebar Spacing**

The core technique: wrap the nav items in a flex column and give the items group `my-auto`. Auto margins absorb spare space (so the group fills the height instead of clumping at the top), but — unlike `justify-center`/`justify-between` — they **collapse to 0 on overflow**, so the list never clips and stays scrollable. Plus roomier rows (`py-2.5 → py-3`) and `gap-2`. Includes exact class changes at every nesting level, height ratios (logo ~8% / nav ~88% / footer ~5%), and a before/after.

**Part B — Tab Architecture (8 → 7)**

Order: **Overview · Projects · AI Tools · Git · Environment · Analytics · Backup**, each with a lucide icon and a Framer Motion shared-layout active indicator. Covers, per tab: architecture decision, data pipeline (mapped to your existing IPC), visual spec, and empty/loading/error states.

- **Environment** merges IDEs + Tools into an actionable health dashboard (versions, update suggestions, missing-tool warnings), with one "Scan Environment" action.
- **Backup** replaces Trash — snapshot timeline with triggers (`Manual`/`Scheduled`/`Pre-AI-Edit`), file-level diffs, session/file restore, retention settings — plus the full SQLite data model (`backups`, `backup_files`, `backup_settings`) and all the **new** IPC handlers it needs.
- **Sync AI** moves into the AI Tools tab toolbar; the header scan/sync buttons are removed.
- Includes the `TabKey` type, the `TABS` config render logic, and **localStorage migration** (`ides`/`tools` → `environment`, `trash` → `backup`) for backward compatibility.

**Part C — Implementation Order** + a **Backend Audit Table** marking every feature ✅ exists / ⚠️ small add / ❌ new build (the ❌ items are all concentrated in Backup).

Two notes:

- The **Trash capability isn't lost** — soft-deleted projects move to a low-traffic "Recently removed" affordance in the Projects tab's overflow menu, since Backup takes Trash's tab slot.
- The only **new backend** required is for Backup (no backup IPC exists today); everything else reuses your current endpoints. There's one optional `getToolHealth` IPC for richer "update available" data in Environment, which degrades gracefully if not built.

All four TSX snippets passed a Prettier syntax check; the Backup IPC block is intentionally a documentation-style list of interface-method signatures.

# RESULT — Sidebar Spacing + IDE Projects Page Revamp

> One definitive plan. Part A re-distributes the sidebar nav to use the full height (overflow-safe). Part B collapses **8 tabs → 7** (Overview, Projects, AI Tools, Git, **Environment** [replaces IDEs+Tools], Analytics, **Backup** [replaces Trash]), moves **Sync AI** into the AI Tools tab, and specifies the new Backup backend. Part C gives a low-breakage implementation order. Stack: React 19 + Tailwind v4 + Framer Motion + lucide-react, all data over Electron IPC.

---

## Part A: Sidebar Spacing

### Problem
The nav inner uses `px-3 py-4 space-y-1.5` with items at `px-4 py-2.5 gap-3`. Items pile at the top, leaving dead space at the bottom, and feel cramped.

### The fix (overflow-safe vertical distribution)
The key technique: wrap the nav items in a flex column and give the **items group `my-auto`**. Auto margins absorb spare space (centering/spreading the group so it fills the height visually), but — unlike `justify-center`/`justify-between` — **auto margins collapse to `0` when content overflows**, so nothing ever gets clipped and the list stays fully scrollable. Combined with larger per-item padding and gap, this removes the cramped feel.

### Exact class changes

| Nesting level | Before | After |
|---|---|---|
| Sidebar wrapper | `w-64 border-r border-zinc-800 flex flex-col h-full glass` | **unchanged** |
| Logo header | `p-5 … shrink-0` | **unchanged** (`shrink-0` keeps it fixed) |
| Nav region (outer) | `flex-1 min-h-0 max-h-full` | `flex-1 min-h-0 flex flex-col` |
| Nav scroll container | `h-full overflow-y-auto px-3 py-4 space-y-1.5` | `flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col` |
| **Items group (NEW wrapper)** | — | `flex flex-col gap-2 my-auto` |
| Item button | `… px-4 py-2.5 rounded-xl text-sm gap-3` | `… px-4 py-3 rounded-xl text-sm gap-3.5` |
| Footer | `px-5 py-2 … shrink-0` | `px-5 py-3 … shrink-0` |

The only structural change is inserting one wrapper `<div>` (the items group) inside the scroll container and moving the `map` into it.

```tsx
{/* Nav region */}
<div className="flex-1 min-h-0 flex flex-col">
  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col">
    {/* Items group: my-auto centers/spreads when there's room, collapses to 0 on overflow */}
    <div className="flex flex-col gap-2 my-auto">
      {sidebarItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <motion.button
            key={item.path}
            onClick={() => handleSidebarNavigation(item.path)}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-colors duration-150 ${
              isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </motion.button>
        );
      })}
    </div>
  </div>
</div>
```

### Visual spec (height ratios)
Fixed regions stay constant; the nav flexes to fill everything between them.

| Section | Height | ~Ratio @ 900px tall |
|---|---|---|
| Logo header | fixed ~72px (`p-5` + content) | ~8% |
| **Nav (flex-1)** | remaining | **~88%** |
| Footer | fixed ~44px (`py-3` + 2 lines) | ~5% |

Within the nav: 11 items × (`py-3` ≈ 44px tall) + 10 gaps × 8px ≈ **564px** of content. On an ~784px nav viewport that leaves ~220px of slack, which `my-auto` splits top/bottom (~110px each) so the group sits centered and the list "nearly fills" the height instead of clumping at the top.

### Before / after
- **Before:** items glued to the top with `space-y-1.5`; ~220px of dead space pinned at the bottom; tight tap targets.
- **After:** roomier `py-3` rows with `gap-2`, the whole group vertically centered via `my-auto`, dead space distributed evenly above and below.

### UX flow — overflow
- If items + padding exceed the nav viewport (small window, or future items added), `my-auto` resolves to `0` and the scroll container (`overflow-y-auto`) scrolls normally — **no clipping**, first and last items always reachable.
- Logo and footer never scroll (`shrink-0`); only the middle region scrolls.

---

## Part B: Tab Architecture

### New Tab Bar

**8 → 7 tabs.** Order (most-used → supporting): **Overview · Projects · AI Tools · Git · Environment · Analytics · Backup**.

| Order | Key | Label | lucide icon | Replaces |
|---|---|---|---|---|
| 1 | `overview` | Overview | `LayoutDashboard` | keep |
| 2 | `projects` | Projects | `FolderGit2` | keep (+ IDE-per-project) |
| 3 | `ai` | AI Tools | `Bot` | keep (+ Sync AI moved in) |
| 4 | `git` | Git | `GitBranch` | keep |
| 5 | `environment` | Environment | `Boxes` | **IDEs + Tools merged** |
| 6 | `analytics` | Analytics | `BarChart3` | keep |
| 7 | `backup` | Backup | `Archive` | **Trash replaced** |

**Active state** keeps the existing token (`bg-zinc-800 text-white`; inactive `text-zinc-400 hover:text-white`) and adds an icon before each label plus a Framer Motion shared-layout underline for a polished active indicator.

#### Type + localStorage migration (backward compatible)
Old persisted values (`ides`, `tools`, `trash`) must still resolve. Map them on read; never crash on an unknown value.

```tsx
type TabKey = 'overview' | 'projects' | 'ai' | 'git' | 'environment' | 'analytics' | 'backup';

const TAB_KEYS: TabKey[] = ['overview', 'projects', 'ai', 'git', 'environment', 'analytics', 'backup'];

// Back-compat: retired keys map to their new home.
const TAB_MIGRATION: Record<string, TabKey> = {
  ides: 'environment',
  tools: 'environment',
  trash: 'backup',
};

const [activeTab, setActiveTab] = useState<TabKey>(() => {
  const saved = localStorage.getItem('ide-projects-activeTab') || '';
  const resolved = (TAB_MIGRATION[saved] ?? saved) as TabKey;
  return TAB_KEYS.includes(resolved) ? resolved : 'overview';
});

// Persist (unchanged key).
useEffect(() => {
  localStorage.setItem('ide-projects-activeTab', activeTab);
}, [activeTab]);
```

#### Tab bar render logic
Motion props are hoisted to module constants (so JSX uses single-brace expressions).

```tsx
import { LayoutDashboard, FolderGit2, Bot, GitBranch, Boxes, BarChart3, Archive } from 'lucide-react';

const TAB_HOVER = { scale: 1.02 };
const TAB_TAP = { scale: 0.98 };

const TABS: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'ai', label: 'AI Tools', icon: Bot },
  { key: 'git', label: 'Git', icon: GitBranch },
  { key: 'environment', label: 'Environment', icon: Boxes },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'backup', label: 'Backup', icon: Archive },
];

<div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl w-fit">
  {TABS.map(({ key, label, icon: Icon }) => {
    const isActive = activeTab === key;
    return (
      <motion.button
        key={key}
        onClick={() => setActiveTab(key)}
        whileHover={TAB_HOVER}
        whileTap={TAB_TAP}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
          isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
        }`}
      >
        {isActive ? (
          <motion.span
            layoutId="ide-tab-active"
            className="absolute inset-0 bg-zinc-800 rounded-xl"
            transition={TAB_LAYOUT_SPRING}
          />
        ) : null}
        <span className="relative z-10 flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label}
        </span>
      </motion.button>
    );
  })}
</div>
```

> `TAB_LAYOUT_SPRING` is a hoisted const, e.g. `const TAB_LAYOUT_SPRING = { type: 'spring', stiffness: 380, damping: 30 };`. The old per-tab `if (tab === 'trash') loadTrashProjects()` side-effect is removed; data loads are handled per-tab in their own effects (see Backup).

#### Page header cleanup
Remove the header's `activeTab === 'tools'`/`'ides'` Scan buttons and the **Sync AI** button + last-sync label. The header keeps only the title and the **Guide** button. Scanning now lives in the Environment tab; Sync AI lives in the AI Tools tab.

---

### Tab: Overview (improved)
**Architecture:** keep as the dashboard, make every tile actionable and add a backup pulse.
- **Metric cards (4 → 4, relabeled + clickable):** `Environment` (IDEs + tools count) → navigates to Environment; `AI Tokens` → AI Tools; `Commits` → Git; **`Last Backup`** (relative time + healthy/stale dot) → Backup. Each card is a `button` that calls `setActiveTab(...)`.
- Keep the AI Usage line chart + Token Distribution doughnut + Recent Git Activity widget.
- **Add** a compact "Environment health" strip (e.g. `3 IDEs · 12 tools · 2 updates available`) sourced from the Environment data.

**Data pipeline:** `getIDEProjectsOverview()` (existing) for metrics/charts; `getAISyncStatus()` for the AI freshness; new `listBackups()` (latest across projects) for the Last Backup tile.

**UX states:** skeleton cards while overview loads; per-widget empty copy ("No commits yet", "No AI usage imported — go to AI Tools → Sync"); error → inline retry on the affected widget only.

---

### Tab: Projects (keep + IDE-per-project merge)
**Architecture:** keep the core (add/open/scan/edit/delete) and absorb the useful half of the old IDEs tab: show **which IDE each project opens with**.
- On each project card add an **IDE badge** + an "Open with" dropdown populated from `detectIDEs()`; selecting an IDE calls `openProject(id, ideId)`. Persist the last chosen IDE per project via `updateProject(id, { preferredIdeId })`.
- Keep the Add Project modal + expandable detail (tools, sessions, health, presets).

**Data pipeline:** `getAllProjects()` / `getProjectDetails(id)` (existing); `detectIDEs()` (existing, now consumed here for the Open-with list); `openProject`, `addProject`, `updateProject`, `deleteProject` (existing). Note: `deleteProject` is a soft delete — see Backup note below for how "deleted" projects are reconciled.

**UX states:** empty → "Add your first project" CTA; loading → card skeletons; open/scan errors → toast + keep list intact.

---

### Tab: AI Tools (improved + Sync AI moved in)
**Architecture:** move the page-level **Sync AI** action into this tab's local toolbar; it's AI-agent-specific.
- Tab toolbar (right-aligned, above the agent summary): **`period` selector** + **Sync AI** button + **last-synced** label + inline progress bar.
- Wire `onAISyncProgress(cb)` to a local progress state; on completion refresh `getAIUsageSummary(period)` and `getAISyncStatus()`.
- Keep per-agent charts, comparison, detail drill-down, debug panel.

**How Sync AI integrates (state moves, logic identical):**
```tsx
// Inside the AI Tools tab toolbar
<div className="flex items-center gap-2">
  <button
    onClick={handleSyncAI}
    disabled={syncingAI}
    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg disabled:opacity-50"
  >
    <Sparkles className="w-4 h-4" />
    {syncingAI ? 'Syncing…' : 'Sync AI'}
  </button>
  {aiLastSyncAt && !syncingAI ? <span className="text-xs text-zinc-500">Last: {aiLastSyncLabel}</span> : null}
  {syncingAI ? <span className="text-xs text-zinc-500">{syncProgressLabel}</span> : null}
</div>
```
**Data pipeline:** `syncAIUsage()`, `getAISyncStatus()`, `onAISyncProgress()`, `getAIUsageSummary(period)`, `getPromptHistory()`, `debugAIAgents()` (all existing).
**UX states:** empty → "No AI usage imported yet — click Sync AI"; syncing → disabled button + progress; error → inline error chip, keep prior charts.

---

### Tab: Git (improved)
**Architecture:** keep; tighten the layout.
- Add a **repo/project selector** at the top (the Git view is per-project).
- **DORA cards** (deploy freq, lead time, change-fail rate, MTTR) with small trend deltas; **contributor leaderboard**; commit history list with relative dates.
- Keep local sync (`syncCommits`) and GitHub sync (`syncGitHubCommits`).

**Data pipeline:** `getCommitHistory(id, limit)`, `getContributorStats(id)`, `getDORAMetrics(id, period)`, `syncCommits(id, path)`, `syncGitHubCommits(id, owner, repo, token)` (all existing).
**UX states:** no repo selected → prompt to pick a project; no commits → "Sync commits" CTA; token/auth error on GitHub sync → inline message with retry.

---

### Tab: Environment (replaces IDEs + Tools)
**Architecture:** **merge** the IDEs tab and Tools tab into one actionable **Environment** dashboard. No more standalone "list of IDs."

**What it shows (two sections under one tab):**
1. **IDEs** — card grid: icon, name, version, install path, extension count, and a **"Set as default"** action (writes a preference consumed by Projects' Open-with). 
2. **Dev Tools (health-oriented, not just a list)** — grouped by category, but each tool row shows an **actionable health state**:
   - `healthy` (detected + current), `outdated` (newer version available → show suggested version), `missing` (referenced by a project but not found).
   - Category groups remain collapsible; add a summary header per group (`5 healthy · 2 outdated`).
- **One toolbar:** a single **"Scan Environment"** button runs IDE + tool detection together; an overflow menu holds **"Reset Tools."** (Replaces the two separate header scan buttons.)

**Why it's better:** turns two passive lists into a single environment health view — versions, update suggestions, and "missing tool" warnings tie directly back to projects, instead of a decorative inventory on its own page.

**Data pipeline:** `detectIDEs()`, `scanTools()`, `resetTools()` (existing). Health (`outdated`/update suggestions) is derived client-side from detected vs. known-latest where possible. *Optional backend gap:* a `getToolHealth()` IPC that resolves latest versions for richer "update available" data (see audit table) — the tab degrades gracefully to detected/missing without it.

**UX states:** first run / nothing scanned → "Scan your environment" CTA; scanning → spinner on the button + skeleton cards; partial detection → show found, mark the rest `missing`; scan error → inline banner + keep last results.

---

### Tab: Backup (replaces Trash)
**Architecture:** **replace** Trash entirely with a Backup manager for AI-coding changes — snapshots you can browse and restore. No backup IPC exists today; this needs new backend (specified below).

#### Layout / UX
- **Left:** project picker + **"Create Backup"** button + auto-backup status pill.
- **Main:** reverse-chronological **snapshot timeline**. Each snapshot row: timestamp (relative + absolute on hover), **trigger badge** (`Manual` · `Scheduled` · `Pre-AI-Edit`), file count, total size, optional label.
- **Expand a snapshot** → file list with per-file **change type** (`added`/`modified`/`deleted`) and a **"View diff"** action (file-level line diff) + per-file **Restore**.
- **Row actions:** **Restore snapshot** (session-level, with a confirm modal warning it overwrites current files), **Delete snapshot**.
- **Settings drawer:** toggle auto-backup, schedule (off / on AI edit / hourly / daily), retention count, include/exclude globs.

#### States
- **Empty:** "No backups yet — create one before your next AI coding session." + Create Backup CTA.
- **Loading:** timeline skeleton.
- **Restoring:** progress modal via `onBackupProgress`; block duplicate restores.
- **Error:** snapshot create/restore failure → inline error + keep timeline; never delete the only good snapshot on a failed restore.

#### Data model (new SQLite tables)
```sql
CREATE TABLE backups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at    TEXT    NOT NULL,                         -- ISO timestamp
  trigger       TEXT    NOT NULL,                         -- 'manual' | 'scheduled' | 'pre_ai_edit'
  label         TEXT,
  file_count    INTEGER NOT NULL DEFAULT 0,
  total_bytes   INTEGER NOT NULL DEFAULT 0,
  snapshot_path TEXT    NOT NULL,                         -- content-addressed store dir for this snapshot
  status        TEXT    NOT NULL DEFAULT 'complete'       -- 'complete' | 'partial' | 'failed'
);

CREATE TABLE backup_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_id   INTEGER NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
  rel_path    TEXT    NOT NULL,                           -- path relative to project root
  blob_hash   TEXT    NOT NULL,                           -- sha256 into the blob store
  size_bytes  INTEGER NOT NULL,
  change_type TEXT    NOT NULL                            -- 'added' | 'modified' | 'deleted'
);

CREATE TABLE backup_settings (
  project_id     INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  auto_enabled   INTEGER NOT NULL DEFAULT 0,              -- boolean
  schedule       TEXT    NOT NULL DEFAULT 'pre_ai_edit',  -- 'off' | 'pre_ai_edit' | 'hourly' | 'daily'
  retention_count INTEGER NOT NULL DEFAULT 20,
  include_globs  TEXT    NOT NULL DEFAULT '["**/*"]',     -- JSON
  exclude_globs  TEXT    NOT NULL DEFAULT '["node_modules/**",".git/**"]' -- JSON
);
```
Storage: a content-addressed blob store (files keyed by sha256) so unchanged files across snapshots are deduplicated; `backup_files` references blobs. Diffs are computed by reading the stored blob vs. the current working file.

#### IPC requirements (all NEW)
```ts
// preload bridge → main handlers (renderer never touches fs/db directly)
createBackup(projectId: number, opts?: { label?: string; trigger?: 'manual' | 'scheduled' | 'pre_ai_edit' }): Promise<Backup>;
listBackups(projectId?: number, opts?: { limit?: number }): Promise<Backup[]>;        // projectId omitted = latest across all (Overview tile)
getBackupDetails(backupId: number): Promise<{ backup: Backup; files: BackupFile[] }>;
getBackupFileDiff(backupId: number, relPath: string): Promise<{ before: string; after: string }>;
restoreBackup(backupId: number, opts?: { dryRun?: boolean }): Promise<{ restored: number }>;
restoreBackupFile(backupId: number, relPath: string): Promise<{ restored: boolean }>;
deleteBackup(backupId: number): Promise<{ deleted: boolean }>;
getBackupSettings(projectId: number): Promise<BackupSettings>;
setBackupSettings(projectId: number, settings: Partial<BackupSettings>): Promise<BackupSettings>;
onBackupProgress(cb: (p: { backupId: number; phase: 'snapshot' | 'restore'; done: number; total: number }) => void): void;
```
**Pre-AI-edit hook:** when `schedule = 'pre_ai_edit'`, the AI coding flow calls `createBackup(projectId, { trigger: 'pre_ai_edit' })` before applying edits — this is the feature the user actually wants ("any changes can be restored unless a backup was made").

> **Trash reconciliation:** soft-deleted projects (`deleteProject` sets `deleted_at`) no longer get a dedicated tab. Keep `restoreProject`/`removeProject` reachable from a small "Recently removed" affordance inside the **Projects** tab's overflow menu (low-traffic), so no existing capability is lost while the Backup tab takes Trash's slot.

---

### Tab: Analytics (kept)
**Architecture:** keep `<AnalyticsDashboard>`; add light improvements.
- Add a **project + time-range filter** bar and a small **KPI row** (AI usage, problems, requests) above the dashboard.
- Optional **export** (CSV/JSON) of the current view.

**Data pipeline:** `getAIUsageSummary(period)`, `getProblems()`, `getRequests()` (existing).
**UX states:** loading → skeleton KPIs; empty → "Not enough data yet"; error → retry on the KPI row.

---

## Part C: Implementation Order

1. **Sidebar spacing (isolated, lowest risk).** Insert the `my-auto` items wrapper + padding/gap changes. Pure CSS; no logic. Verify centering + overflow scroll at multiple window heights.
2. **Tab reorganization (no new content yet).** Update the `TabKey` union, `TABS` config, localStorage migration (`ides`/`tools` → `environment`, `trash` → `backup`), and the tab-bar render with icons + shared-layout indicator. Temporarily point `environment`/`backup` at placeholder panels so the app keeps building.
3. **Move Sync AI into AI Tools** + strip the header scan/sync buttons. Small, self-contained; verify sync + progress still work.
4. **Environment tab content.** Merge IDEs + Tools rendering, single Scan Environment action, tool health derivation. Reuses existing IPC.
5. **Backup backend + tab (largest).** Add tables, blob store, service, IPC handlers; wire the Backup UI; add the pre-AI-edit hook; add the Projects "Recently removed" affordance for old restore/remove.
6. **Polish.** Overview tile relabel + Last Backup tile, Analytics filters/export, empty/loading/error states, `AnimatePresence` tab transitions.

**Rationale:** each step builds and ships independently; the only step requiring new backend (5) comes after the UI shell is stable, so nothing blocks on it.

---

## Backend Audit Table

| Feature | IPC channel | Main handler | Service | DB schema | Status |
|---|---|---|---|---|---|
| Overview metrics/charts | `getIDEProjectsOverview` | existing | existing | existing | ✅ exists |
| AI sync + status + progress | `syncAIUsage` / `getAISyncStatus` / `onAISyncProgress` | existing | existing | existing | ✅ exists (relocate UI to AI Tools) |
| AI usage summary | `getAIUsageSummary` | existing | existing | existing | ✅ exists |
| Projects CRUD + open | `getAllProjects` / `getProjectDetails` / `addProject` / `updateProject` / `deleteProject` / `openProject` | existing | existing | existing (`projects.deleted_at`) | ✅ exists |
| IDE-per-project (Open-with) | `detectIDEs` + `updateProject` | existing | existing | reuse `projects` (add `preferred_ide_id`) | ⚠️ minor column add |
| Environment: IDE detection | `detectIDEs` | existing | existing | existing | ✅ exists |
| Environment: tool scan/reset | `scanTools` / `resetTools` | existing | existing | existing | ✅ exists |
| Environment: tool health/updates | `getToolHealth` | **NEW** (resolve latest versions) | **NEW** version-check service | none (in-memory/cache) | ⚠️ optional, graceful degrade |
| Git history/stats/DORA/sync | `getCommitHistory` / `getContributorStats` / `getDORAMetrics` / `syncCommits` / `syncGitHubCommits` | existing | existing | existing | ✅ exists |
| Analytics dashboard data | `getAIUsageSummary` / `getProblems` / `getRequests` | existing | existing | existing | ✅ exists |
| **Backup: create** | `createBackup` | **NEW** | **NEW** `BackupService` (snapshot + blob store) | **NEW** `backups`, `backup_files` | ❌ needs creation |
| **Backup: list** | `listBackups` | **NEW** | **NEW** | `backups` | ❌ needs creation |
| **Backup: details** | `getBackupDetails` | **NEW** | **NEW** | `backups`, `backup_files` | ❌ needs creation |
| **Backup: file diff** | `getBackupFileDiff` | **NEW** | **NEW** (blob vs. working file) | `backup_files` + blob store | ❌ needs creation |
| **Backup: restore (session)** | `restoreBackup` | **NEW** | **NEW** | `backups`, `backup_files` | ❌ needs creation |
| **Backup: restore (file)** | `restoreBackupFile` | **NEW** | **NEW** | `backup_files` | ❌ needs creation |
| **Backup: delete** | `deleteBackup` | **NEW** | **NEW** | `backups` (cascade) | ❌ needs creation |
| **Backup: settings** | `getBackupSettings` / `setBackupSettings` | **NEW** | **NEW** | **NEW** `backup_settings` | ❌ needs creation |
| **Backup: progress events** | `onBackupProgress` | **NEW** | **NEW** | none | ❌ needs creation |
| Old project restore/remove (moved out of Trash) | `restoreProject` / `removeProject` / `getAllProjects` | existing | existing | existing | ✅ exists (surface in Projects overflow) |

**Legend:** ✅ exists · ⚠️ small addition / optional · ❌ new build required (all concentrated in Backup, per Step 5).

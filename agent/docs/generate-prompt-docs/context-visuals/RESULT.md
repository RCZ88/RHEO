# RESULT — Context Systems Visual Feedback (Live Monitoring)

> One definitive implementation that turns the 7 decorative context-system toggle cards in `NewSessionDialog.tsx` into **live status cards**: real counts from the backend, health dots with tooltips, last-synced/last-built freshness, per-system verify, 30s auto-refresh, full error handling, and lightweight CSS animations. Backend `get-context-systems` is extended to emit `lastBuilt` + `error` and to discover all 7 systems. No new dependencies.

---

## 1. Architecture

### Data flow (new)

```
NewSessionDialog mounts (mode !== 'create')
  └─ useEffect: loadSystemStatus()  ──┐  immediately
                 setInterval 30s ─────┘  repeating, cleared on unmount/close

loadSystemStatus() / verifySystem(id)
  └─ window.deskflowAPI.getContextSystems(projectPath)   (IPC: 'get-context-systems')
        └─ main.ts handler scans disk → [{ id, name, itemCount, itemLabel, available, lastBuilt, error }]
  └─ applyIfLatest(issuedAt, data)   ← race guard: only newest issued request wins
        ├─ setCtxSystemData(data)
        ├─ setCtxLastSynced(now)
        └─ setCtxLoadFailed(false)

render: SYSTEM_DEFS (static UI) ⨝ ctxSystemData (live, by id) ⨝ global flags
  └─ systems: SystemInfo[]  →  <SystemToggleCard system verifySignal />  (grid grid-cols-2 gap-2)
```

### Source of truth: one IPC, joined by `id`
The frontend stops doing ad-hoc `readProjectFile` / `listAgentDirFiles` / `getSkills` probes (which covered only 3 systems) and instead calls the single `getContextSystems` handler that already exists in the preload bridge. The static per-system presentation (icon, accent color, token budget, toggle wiring) lives in a `SYSTEM_DEFS` table and is **joined at render time** with the live backend records by `id`. Anything the backend doesn't return is treated as `missing`.

### Component hierarchy
- **`NewSessionDialog`** (owner of all data state + pipeline functions)
  - data state: `ctxSystemData`, `ctxLastSynced`, `ctxLoadFailed`, `refreshingId`, `verifySignal`
  - pipeline: `fetchSystems()`, `applyIfLatest()`, `loadSystemStatus()`, `verifySystem()`
  - **`SystemToggleCard`** × 7 (presentational + self-contained micro-animations)
  - **`ContextMapVisualization`** (unchanged — explicitly preserved)

### Two deliberate deviations from the literal spec (documented, production-correct)
1. **`missing` vs `error` are kept distinct.** §1 says "directory doesn't exist *or* read fails → `error: "Path not found"`", but §2/§5 clearly want a missing directory to read as **`missing`** ("Not configured") and a genuine read failure to read as **`error`** ("Error: …"), with different tooltips. So the backend sets `error: null` for a cleanly-absent directory (→ `missing`) and only populates `error` when a filesystem call actually throws (→ `error`). Both render a red dot, so this is purely a tooltip-quality improvement and satisfies every acceptance criterion.
2. **Auto-refresh/verify failures never wipe good data.** §3a (initial load failure) clears to `[]` + `error`, but §3b/§6.3 require keeping previous data on later failures. The pipeline only shows the global error state when *no* successful load has happened yet (`appliedAtRef.current === 0`).

---

## 2. Visual Design Spec — `SystemToggleCard`

Layout (unchanged grid, new health dot + verify button + live meta line):

```
┌──────────────────────────────┐
│ ●  [icon] System Name    ↻ ═○ │   ● health dot (abs top-2 left-2) · ↻ verify · toggle
│     12 files · ~500t · 2m ago │   live count · token budget · last synced
└──────────────────────────────┘
```

| Element | Classes | Notes |
|---|---|---|
| Card root | `relative border rounded-xl p-3 transition-all duration-200` + enabled/disabled bg (unchanged) | added `relative` for the absolute dot |
| Content wrapper | `pl-3` | makes room for the dot (§4h) |
| **Health dot wrap** | `group/tooltip absolute top-2 left-2 z-10` | hover target for tooltip |
| Dot | `block w-2 h-2 rounded-full transition-transform duration-300` + scale + color | scale `scale-75`→`scale-100` on first data |
| Dot · healthy | `bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]` | §4a |
| Dot · degraded | `bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]` | §4a |
| Dot · missing/error | `bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]` | §4a |
| Dot · unknown | `bg-zinc-600` | §4a |
| Dot · verify-success flash | `bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse` (1s) | §4b |
| Dot · verify-fail flash | `bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse` (1s) | §4b |
| Tooltip | `absolute left-0 top-3 hidden group-hover/tooltip:block whitespace-nowrap rounded-md bg-zinc-950/95 border border-zinc-700/60 px-2 py-1 text-[9px] text-zinc-300 shadow-lg z-20` | §4c content varies by health |
| Icon chip | `p-1 rounded-md bg-zinc-800/60` + `w-3.5 h-3.5 {accentColor}` | unchanged |
| Name | `text-[11px] text-zinc-300 font-medium` | unchanged |
| **Verify button** | `p-1 rounded-md hover:bg-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed` | between name and toggle (§4f) |
| Verify icon (idle) | `w-3 h-3 text-zinc-600 hover:text-zinc-400` (`RefreshCw`) | §4f |
| Verify icon (refreshing) | `w-3 h-3 animate-spin text-cyan-400` | §4f |
| Toggle track / dot | `w-8 h-4` / `w-3 h-3` (unchanged colors per system) | §4h — NOT modified |
| Meta line | `text-[9px] text-zinc-500 leading-relaxed` | count · tokens · time |
| Count (normal) | `transition-colors duration-300 text-zinc-400` | §4d |
| Count (changed) | `text-emerald-400` for 800ms | §4d |
| Count (degraded, 0) | `text-amber-500` → `"Empty"` | §4d |
| Count (loading) | `"..."` | §4i |
| Token budget | `~{maxTokens}t` `text-zinc-600 text-[9px]` | §4g |
| Time text | `formatRelTime(lastSynced)` or `Built {…}` | §4e |
| Time staleness | `<5m` `text-zinc-500` · `5–30m` `text-zinc-600` · `>30m` `text-amber-600/70` | §4e |

Glassmorphic tokens, accent colors, and toggle color maps are reused verbatim from the existing component (§5 of the bundle). No `box-shadow` is used for elevation — the only shadows are the dot glow halos called out in §4a/§4b and the tooltip popover.

---

## 3. State / Logic

**Removed:** `infraStatus` state and the entire `checkInfra()` function (and its `readProjectFile`/`listAgentDirFiles`/`getSkills` probes).

**Added (in `NewSessionDialog`):**

| Item | Type | Purpose |
|---|---|---|
| `ctxSystemData` | `BackendSystem[]` | latest live records from backend |
| `ctxLastSynced` | `string \| null` | client timestamp of last *successful* fetch |
| `ctxLoadFailed` | `boolean` | true only when no successful load has occurred yet |
| `refreshingId` | `string \| null` | which card's verify spinner is active |
| `verifySignal` | `{ id; status:'green'\|'red'; n } \| null` | one-shot pulse trigger pushed to a specific card |
| `appliedAtRef` | `useRef<number>` | race guard — issue-time of the newest applied response |
| `signalSeq` | `useRef<number>` | monotonic counter so repeated verifies on the same card re-fire the pulse |

Health is **derived**, never stored: `deriveHealth(record)` plus the global/loading overrides computed during the render-time join. The token budgets, icons, accent colors, and toggle setters remain exactly as today.

---

## 4. Full Code

All code below is copy-paste-ready. Imports: add **`RefreshCw`** to the existing `lucide-react` import in `NewSessionDialog.tsx` (`BookOpen, Zap, Network, FolderTree, FileText, Bot, Palette` already imported).

### 4.1 Backend — replace `get-context-systems` handler (`src/main.ts:8134-8178`)

```typescript
electron_1.ipcMain.handle('get-context-systems', async (_event, projectPath?: string) => {
  const projPath = projectPath || (global as any).__projectPath || '';
  if (!projPath) return { success: false, data: [] };

  const fs = fs_1.default;
  const path = path_1.default;

  // --- mtime helpers --------------------------------------------------------
  const toIso = (ms: number): string | null => (ms > 0 ? new Date(ms).toISOString() : null);

  const mtimeOf = (file: string): number => {
    try {
      const st = fs.statSync(file);
      return st.isFile() ? st.mtimeMs : 0;
    } catch {
      return 0;
    }
  };

  // newest mtime among files matching `match` directly inside `dir`
  const newestInDir = (dir: string, match: (f: string) => boolean): number => {
    let newest = 0;
    if (!fs.existsSync(dir)) return 0;
    for (const f of fs.readdirSync(dir)) {
      if (!match(f)) continue;
      newest = Math.max(newest, mtimeOf(path.join(dir, f)));
    }
    return newest;
  };

  // newest mtime among files matching `match`, recursively under `dir`
  const newestRecursive = (dir: string, match: (f: string) => boolean): number => {
    let newest = 0;
    if (!fs.existsSync(dir)) return 0;
    const stack: string[] = [dir];
    while (stack.length) {
      const cur = stack.pop() as string;
      let entries: any[] = [];
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const full = path.join(cur, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile() && match(e.name)) newest = Math.max(newest, mtimeOf(full));
      }
    }
    return newest;
  };

  // newest SKILL.md across agent/skills/*/SKILL.md
  const newestSkillMd = (skillsDir: string): number => {
    let newest = 0;
    if (!fs.existsSync(skillsDir)) return 0;
    let dirs: any[] = [];
    try {
      dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const d of dirs) {
      if (d.isDirectory()) newest = Math.max(newest, mtimeOf(path.join(skillsDir, d.name, 'SKILL.md')));
    }
    return newest;
  };

  const agentDir = path.join(projPath, 'agent');
  const skillsDir = path.join(agentDir, 'skills');

  type Sys = {
    id: string;
    name: string;
    itemCount: number;
    itemLabel: string;
    available: boolean;
    lastBuilt: string | null;
    error: string | null;
  };

  // A cleanly-absent directory -> available:false, error:null (renders 'missing').
  const MISSING = { itemCount: 0, itemLabel: '', available: false, lastBuiltMs: 0 };

  // Per-system builder. Wrapped individually so one throwing system never blocks
  // the others (partial-data requirement, §6.2). A genuine throw -> error set ('error').
  const build = (
    id: string,
    name: string,
    fn: () => { itemCount: number; itemLabel: string; available: boolean; lastBuiltMs: number },
  ): Sys => {
    try {
      const r = fn();
      return {
        id,
        name,
        itemCount: r.itemCount,
        itemLabel: r.itemLabel,
        available: r.available,
        lastBuilt: toIso(r.lastBuiltMs),
        error: null,
      };
    } catch (e: any) {
      return { id, name, itemCount: 0, itemLabel: '', available: false, lastBuilt: null, error: e?.message || 'Path not found' };
    }
  };

  const systems: Sys[] = [
    // LLM Wiki — .md files directly in agent/
    build('llm_wiki', 'LLM Wiki', () => {
      if (!fs.existsSync(agentDir)) return MISSING;
      const md = fs.readdirSync(agentDir).filter((f: string) => f.endsWith('.md'));
      return { itemCount: md.length, itemLabel: 'files', available: true, lastBuiltMs: newestInDir(agentDir, (f) => f.endsWith('.md')) };
    }),

    // Obsidian Skills — skill folders under agent/skills/
    build('obsidian_skills', 'Obsidian Skills', () => {
      if (!fs.existsSync(skillsDir)) return MISSING;
      const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d: any) => d.isDirectory());
      return { itemCount: dirs.length, itemLabel: 'skills', available: true, lastBuiltMs: newestSkillMd(skillsDir) };
    }),

    // Graphify — graphify-out/graph.json
    build('graphify', 'Graphify', () => {
      const graphFile = path.join(projPath, 'graphify-out', 'graph.json');
      if (!fs.existsSync(graphFile)) return MISSING;
      let nodeCount = 0;
      let edgeCount = 0;
      try {
        const g = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
        nodeCount = g.nodes?.length || 0;
        edgeCount = g.edges?.length || 0;
      } catch {
        // malformed graph -> zero counts but the system still exists
      }
      return { itemCount: nodeCount, itemLabel: `nodes · ${edgeCount} edges`, available: true, lastBuiltMs: mtimeOf(graphFile) };
    }),

    // PARA — recursive newest .md under CZVault/
    build('para', 'PARA', () => {
      const paraDir = path.join(projPath, 'CZVault');
      if (!fs.existsSync(paraDir)) return MISSING;
      const areas = fs.readdirSync(paraDir, { withFileTypes: true }).filter((d: any) => d.isDirectory());
      return { itemCount: areas.length, itemLabel: 'areas', available: true, lastBuiltMs: newestRecursive(paraDir, (f) => f.endsWith('.md')) };
    }),

    // QMD Templates — .qmd files in agent/templates/
    build('qmd', 'QMD Templates', () => {
      const templatesDir = path.join(agentDir, 'templates');
      if (!fs.existsSync(templatesDir)) return MISSING;
      const qmd = fs.readdirSync(templatesDir).filter((f: string) => f.endsWith('.qmd'));
      return { itemCount: qmd.length, itemLabel: 'templates', available: true, lastBuiltMs: newestInDir(templatesDir, (f) => f.endsWith('.qmd')) };
    }),

    // Automations — agent/automations/automations.json
    build('automations', 'Automations', () => {
      const autoFile = path.join(agentDir, 'automations', 'automations.json');
      if (!fs.existsSync(autoFile)) return MISSING;
      let count = 0;
      try {
        const j = JSON.parse(fs.readFileSync(autoFile, 'utf-8'));
        count = Array.isArray(j) ? j.length : j.automations?.length || j.rules?.length || 0;
      } catch {
        // unreadable json -> 0 automations, still available
      }
      return { itemCount: count, itemLabel: 'automations', available: true, lastBuiltMs: mtimeOf(autoFile) };
    }),

    // Design Skills — shares agent/skills/ with Obsidian Skills
    build('design_skills', 'Design Skills', () => {
      if (!fs.existsSync(skillsDir)) return MISSING;
      const dirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d: any) => d.isDirectory());
      return { itemCount: dirs.length, itemLabel: 'design skills', available: true, lastBuiltMs: newestSkillMd(skillsDir) };
    }),
  ];

  return { success: true, data: systems };
});
```

> **Preload (`src/preload.ts:342`)** is unchanged — `getContextSystems` already proxies `invoke('get-context-systems', projectPath)` and transparently passes the richer payload through.

### 4.2 Frontend — shared types & helpers (module scope, `NewSessionDialog.tsx`)

```tsx
// Live record shape returned by the extended get-context-systems handler.
interface BackendSystem {
  id: string;
  name: string;
  itemCount: number;
  itemLabel: string;
  available: boolean;
  lastBuilt: string | null; // ISO file mtime
  error: string | null;
}

type Health = 'healthy' | 'degraded' | 'missing' | 'unknown' | 'error';

type VerifySignal = { id: string; status: 'green' | 'red'; n: number } | null;

interface SystemInfo {
  id: string;
  name: string;
  icon: any;
  accentColor: string;
  itemCount: number;
  itemLabel: string;
  lastBuilt: string | null;
  maxTokens: number;
  enabled: boolean;
  onToggle: () => void;
  health: Health;
  lastSynced: string | null;
  onVerify: () => void;
  refreshing: boolean;
  lastError: string | null;
}

// Health derivation (error first; a missing dir has error:null -> 'missing').
function deriveHealth(s: BackendSystem | null): Health {
  if (!s) return 'unknown';
  if (s.error) return 'error';
  if (s.available && s.itemCount > 0) return 'healthy';
  if (s.available && s.itemCount === 0) return 'degraded';
  if (!s.available) return 'missing';
  return 'unknown';
}

// NOTE: formatRelTime already exists in this file (used by the current card).
// Keep the existing one and DELETE this copy if so. Included for completeness.
function formatRelTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const s = Math.floor(Math.max(0, Date.now() - then) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Stale dimming thresholds (§4e).
function staleClass(iso: string | null): string {
  if (!iso) return 'text-zinc-600';
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < 5) return 'text-zinc-500';
  if (min < 30) return 'text-zinc-600';
  return 'text-amber-600/70';
}

// Static presentation table (icon/accent/tokens/label) — joined with live data by id.
const SYSTEM_DEFS: Array<{
  id: string;
  name: string;
  icon: any;
  accentColor: string;
  maxTokens: number;
  defaultLabel: string;
}> = [
  { id: 'llm_wiki', name: 'LLM Wiki', icon: BookOpen, accentColor: 'text-blue-400', maxTokens: 2000, defaultLabel: 'files' },
  { id: 'obsidian_skills', name: 'Obsidian Skills', icon: Zap, accentColor: 'text-purple-400', maxTokens: 500, defaultLabel: 'skills' },
  { id: 'graphify', name: 'Graphify', icon: Network, accentColor: 'text-cyan-400', maxTokens: 500, defaultLabel: 'nodes' },
  { id: 'para', name: 'PARA', icon: FolderTree, accentColor: 'text-teal-400', maxTokens: 300, defaultLabel: 'areas' },
  { id: 'qmd', name: 'QMD Templates', icon: FileText, accentColor: 'text-amber-400', maxTokens: 200, defaultLabel: 'templates' },
  { id: 'automations', name: 'Automations', icon: Bot, accentColor: 'text-rose-400', maxTokens: 100, defaultLabel: 'automations' },
  { id: 'design_skills', name: 'Design Skills', icon: Palette, accentColor: 'text-pink-400', maxTokens: 800, defaultLabel: 'design skills' },
];
```

### 4.3 Frontend — data pipeline (inside the `NewSessionDialog` component)

```tsx
// --- live status state (replaces infraStatus) ------------------------------
const [ctxSystemData, setCtxSystemData] = useState<BackendSystem[]>([]);
const [ctxLastSynced, setCtxLastSynced] = useState<string | null>(null);
const [ctxLoadFailed, setCtxLoadFailed] = useState(false);
const [refreshingId, setRefreshingId] = useState<string | null>(null);
const [verifySignal, setVerifySignal] = useState<VerifySignal>(null);

const appliedAtRef = useRef(0); // issue-time of newest applied response (race guard)
const signalSeq = useRef(0); // monotonic pulse id

// Apply a response only if it was issued no earlier than the newest applied one.
const applyIfLatest = useCallback((issuedAt: number, data: BackendSystem[]) => {
  if (issuedAt < appliedAtRef.current) return false;
  appliedAtRef.current = issuedAt;
  setCtxSystemData(data);
  setCtxLastSynced(new Date(issuedAt).toISOString());
  setCtxLoadFailed(false);
  return true;
}, []);

const fetchSystems = useCallback(async (): Promise<{ ok: boolean; data?: BackendSystem[] }> => {
  const dapi = (window as any).deskflowAPI;
  if (!dapi?.getContextSystems || !projectPath) return { ok: false };
  try {
    const res = await dapi.getContextSystems(projectPath);
    if (res?.success && Array.isArray(res.data)) return { ok: true, data: res.data as BackendSystem[] };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}, [projectPath]);

// Initial load + silent auto-refresh.
const loadSystemStatus = useCallback(async () => {
  if (mode === 'create') return; // systems aren't shown during session creation
  const issuedAt = Date.now();
  const r = await fetchSystems();
  if (r.ok && r.data) {
    applyIfLatest(issuedAt, r.data);
  } else if (appliedAtRef.current === 0) {
    // initial failure: empty + global error. Later failures keep good data.
    setCtxSystemData([]);
    setCtxLoadFailed(true);
  }
}, [mode, fetchSystems, applyIfLatest]);

// Per-system verify with green/red pulse.
const verifySystem = useCallback(
  async (id: string) => {
    setRefreshingId(id);
    const issuedAt = Date.now();
    const r = await fetchSystems();
    if (r.ok && r.data) {
      applyIfLatest(issuedAt, r.data);
      signalSeq.current += 1;
      setVerifySignal({ id, status: 'green', n: signalSeq.current });
    } else {
      // keep previous data; tag this system's tooltip with an error
      setCtxSystemData((prev) => prev.map((s) => (s.id === id ? { ...s, error: s.error ?? 'Verification failed' } : s)));
      signalSeq.current += 1;
      setVerifySignal({ id, status: 'red', n: signalSeq.current });
    }
    setRefreshingId(null);
  },
  [fetchSystems, applyIfLatest],
);

// Mount fetch + 30s interval; cleared on unmount/close. Skipped in 'create' mode.
useEffect(() => {
  if (mode === 'create') return;
  void loadSystemStatus();
  const t = setInterval(() => {
    void loadSystemStatus();
  }, 30000);
  return () => clearInterval(t);
}, [mode, loadSystemStatus]);
```

### 4.4 Frontend — build the `systems` array (replaces `:666-674`)

```tsx
const enabledById: Record<string, boolean> = {
  llm_wiki: ctxLLMWiki,
  obsidian_skills: ctxSkills,
  graphify: ctxGraphify,
  para: ctxPara,
  qmd: ctxQMD,
  automations: ctxAutomations,
  design_skills: ctxDesignSkills,
};
const toggleById: Record<string, () => void> = {
  llm_wiki: () => setCtxLLMWiki(!ctxLLMWiki),
  obsidian_skills: () => setCtxSkills(!ctxSkills),
  graphify: () => setCtxGraphify(!ctxGraphify),
  para: () => setCtxPara(!ctxPara),
  qmd: () => setCtxQMD(!ctxQMD),
  automations: () => setCtxAutomations(!ctxAutomations),
  design_skills: () => setCtxDesignSkills(!ctxDesignSkills),
};

const firstLoadDone = ctxLastSynced !== null || ctxLoadFailed;
const globalError = ctxLoadFailed && ctxSystemData.length === 0;

const systems: SystemInfo[] = SYSTEM_DEFS.map((def) => {
  const rec = ctxSystemData.find((d) => d.id === def.id) || null;

  let health: Health;
  let lastError: string | null;
  if (globalError) {
    health = 'error';
    lastError = 'Failed to load system status';
  } else if (!firstLoadDone) {
    health = 'unknown';
    lastError = null;
  } else if (!rec) {
    health = 'missing'; // backend didn't return it -> not configured
    lastError = null;
  } else {
    health = deriveHealth(rec);
    lastError = rec.error;
  }

  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    accentColor: def.accentColor,
    itemCount: rec?.itemCount ?? 0,
    itemLabel: rec?.itemLabel || def.defaultLabel,
    lastBuilt: rec?.lastBuilt ?? null,
    maxTokens: def.maxTokens,
    enabled: enabledById[def.id],
    onToggle: toggleById[def.id],
    health,
    lastSynced: ctxLastSynced,
    onVerify: () => verifySystem(def.id),
    refreshing: refreshingId === def.id,
    lastError,
  };
});
```

Render (grid unchanged — pass `verifySignal` down):

```tsx
<div className="grid grid-cols-2 gap-2">
  {systems.map((s) => (
    <SystemToggleCard key={s.id} system={s} verifySignal={verifySignal} />
  ))}
</div>
```

### 4.5 Frontend — `SystemToggleCard` (replaces `:84-137`)

```tsx
function SystemToggleCard({ system, verifySignal }: { system: SystemInfo; verifySignal: VerifySignal }) {
  // toggle color maps — unchanged from the original component
  const toggleColors: Record<string, { on: string }> = {
    llm_wiki: { on: 'bg-blue-500/40' },
    obsidian_skills: { on: 'bg-purple-500/40' },
    graphify: { on: 'bg-cyan-500/40' },
    para: { on: 'bg-teal-500/40' },
    qmd: { on: 'bg-amber-500/40' },
    automations: { on: 'bg-rose-500/40' },
    design_skills: { on: 'bg-pink-500/40' },
  };
  const dotColors: Record<string, { on: string }> = {
    llm_wiki: { on: 'left-3.5 bg-blue-400' },
    obsidian_skills: { on: 'left-3.5 bg-purple-400' },
    graphify: { on: 'left-3.5 bg-cyan-400' },
    para: { on: 'left-3.5 bg-teal-400' },
    qmd: { on: 'left-3.5 bg-amber-400' },
    automations: { on: 'left-3.5 bg-rose-400' },
    design_skills: { on: 'left-3.5 bg-pink-400' },
  };
  const c = toggleColors[system.id];
  const d = dotColors[system.id];

  // --- micro-animations (useState + timeout, no new deps) ------------------
  const [flash, setFlash] = useState<'none' | 'green' | 'red'>('none');
  const [countPulse, setCountPulse] = useState(false);
  const [dotReady, setDotReady] = useState(system.health !== 'unknown');
  const prevCount = useRef(system.itemCount);
  const lastSignalN = useRef(0);

  // verify success/failure pulse, targeted to this card
  useEffect(() => {
    if (verifySignal && verifySignal.id === system.id && verifySignal.n !== lastSignalN.current) {
      lastSignalN.current = verifySignal.n;
      setFlash(verifySignal.status);
    }
  }, [verifySignal, system.id]);

  useEffect(() => {
    if (flash === 'none') return;
    const t = setTimeout(() => setFlash('none'), 1000);
    return () => clearTimeout(t);
  }, [flash]);

  // first-data scale-up pulse: scale-75 -> scale-100 once health is known
  useEffect(() => {
    if (system.health !== 'unknown' && !dotReady) {
      const t = setTimeout(() => setDotReady(true), 20);
      return () => clearTimeout(t);
    }
  }, [system.health, dotReady]);

  // count-change green flash for 800ms (ignore the initial 0 -> n populate)
  useEffect(() => {
    if (prevCount.current !== system.itemCount && prevCount.current !== 0) {
      setCountPulse(true);
      const t = setTimeout(() => setCountPulse(false), 800);
      prevCount.current = system.itemCount;
      return () => clearTimeout(t);
    }
    prevCount.current = system.itemCount;
  }, [system.itemCount]);

  // --- derived classes ------------------------------------------------------
  const dotBase: Record<Health, string> = {
    healthy: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
    degraded: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    missing: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]',
    error: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]',
    unknown: 'bg-zinc-600',
  };
  const flashClass =
    flash === 'green'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse'
      : flash === 'red'
        ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse'
        : '';
  const dotClass = flash !== 'none' ? flashClass : dotBase[system.health];
  const scaleClass = dotReady ? 'scale-100' : 'scale-75';

  const loading = system.health === 'unknown';
  const isEmptyDegraded = system.health === 'degraded' && system.itemCount === 0;

  const tip =
    system.health === 'healthy'
      ? `Live: ${system.itemCount} ${system.itemLabel} · updated ${formatRelTime(system.lastSynced)}`
      : system.health === 'degraded'
        ? `System exists but no items found${system.lastBuilt ? ` · last built ${formatRelTime(system.lastBuilt)}` : ''}`
        : system.health === 'missing'
          ? 'Not configured — run Initialize or create the directory'
          : system.health === 'error'
            ? `Error: ${system.lastError ?? 'unknown'}`
            : 'Checking…';

  const timeText = system.lastSynced
    ? formatRelTime(system.lastSynced)
    : system.lastBuilt
      ? `Built ${formatRelTime(system.lastBuilt)}`
      : '';
  const timeClass = staleClass(system.lastSynced || system.lastBuilt);

  return (
    <div
      className={`relative border rounded-xl p-3 transition-all duration-200 ${
        system.enabled
          ? 'bg-zinc-800/40 border-zinc-600/40 shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
          : 'bg-zinc-900/30 border-zinc-700/30 opacity-60 hover:opacity-80'
      }`}
    >
      {/* Health dot + hover tooltip */}
      <span className="group/tooltip absolute top-2 left-2 z-10">
        <span className={`block w-2 h-2 rounded-full transition-transform duration-300 ${scaleClass} ${dotClass}`} />
        <span className="absolute left-0 top-3 hidden group-hover/tooltip:block whitespace-nowrap rounded-md bg-zinc-950/95 border border-zinc-700/60 px-2 py-1 text-[9px] text-zinc-300 shadow-lg z-20">
          {tip}
        </span>
      </span>

      <div className="pl-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${system.enabled ? 'bg-zinc-800/60' : 'bg-zinc-800/20'}`}>
              <system.icon className={`w-3.5 h-3.5 ${system.accentColor}`} />
            </div>
            <span className="text-[11px] text-zinc-300 font-medium">{system.name}</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Verify / sync */}
            <button
              onClick={system.onVerify}
              disabled={loading || system.refreshing}
              title="Verify"
              className="p-1 rounded-md hover:bg-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-3 h-3 ${system.refreshing ? 'animate-spin text-cyan-400' : 'text-zinc-600 hover:text-zinc-400'}`}
              />
            </button>

            {/* Toggle — dimensions UNCHANGED */}
            <button
              onClick={system.onToggle}
              className={`w-8 h-4 rounded-full transition-all duration-200 relative ${system.enabled ? c.on : 'bg-zinc-700'}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 shadow-sm ${
                  system.enabled ? d.on : 'left-0.5 bg-zinc-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Live meta line: count · tokens · time */}
        <div className="text-[9px] text-zinc-500 leading-relaxed">
          {loading ? (
            <span className="text-zinc-600">...</span>
          ) : isEmptyDegraded ? (
            <span className="text-amber-500">Empty</span>
          ) : (
            <span className={`transition-colors duration-300 ${countPulse ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {system.itemCount} {system.itemLabel}
            </span>
          )}
          <span className="text-zinc-600 mx-1">·</span>
          <span className="text-zinc-600 text-[9px]">~{system.maxTokens}t</span>
          {timeText ? (
            <>
              <span className="text-zinc-600 mx-1">·</span>
              <span className={timeClass}>{timeText}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Verification

### Build & deps
- [ ] `npm run build` passes with zero TypeScript/Vite errors.
- [ ] No new packages — only `react`, `lucide-react` (add `RefreshCw` to the existing import), and existing helpers. `framer-motion` is **not** required (animations are CSS + `useState`/`useEffect`).
- [ ] Tailwind v4 utilities only; arbitrary values used: `shadow-[0_0_6px_...]`, `shadow-[0_0_8px_...]`, `text-[9px]`, `text-[11px]`, `group/tooltip`, `group-hover/tooltip:block`.
- [ ] `formatRelTime` is declared exactly once (delete the duplicate in §4.2 if it already exists in the file).

### Behavior (maps to acceptance criteria)
1. Health dot color per state — green/amber/red/gray. ✅
2. Hover tooltip shows the health-specific message. ✅
3. Counts come from `getContextSystems`, not hardcoded — PARA/automations/graphify now show real numbers. ✅
4. `lastBuilt` reflects real newest-file mtime from the backend. ✅
5. `lastSynced` reflects the client fetch time. ✅
6. Stale dimming flips at 5min and 30min. ✅
7. Verify spins the `RefreshCw`; success → green pulse, failure → red pulse. ✅
8. Count change flashes the number `text-emerald-400` for 800ms. ✅
9. Auto-refresh every 30s; `clearInterval` on unmount/close. ✅
10. Backend failure → red dots + "Failed to load system status"; verify failure → red pulse + previous data preserved; partial data → per-system error tooltips. ✅
11. Loading: gray dots + "..." until first data; verify disabled. ✅
12. Builds with no new dependencies. ✅

### Manual smoke test
- Open the dialog in a project with all 7 directories present → 7 emerald dots, real counts, "just now".
- Delete `graphify-out/graph.json`, click that card's verify → red dot, "Not configured" tooltip, other cards untouched.
- Add a file to `agent/`, wait for the 30s tick (or verify LLM Wiki) → count increments with a green flash, time resets to "just now".
- Kill the IPC handler (simulate failure) on first open → all dots red, tooltip "Failed to load system status".

### Notes / out of scope
- **`ContextMapVisualization`** and the **`grid grid-cols-2 gap-2`** layout are untouched, per constraints.
- **`WorkspaceSettingsDialog.tsx`** needs no change for this feature. Be aware of the pre-existing naming mismatch (`qmd` here vs `qmd_templates` there) and the PARA default mismatch (`false` here vs `true` there) — both are unrelated to live monitoring and intentionally left as-is.
- **`mode` / dialog-open assumption:** the auto-refresh effect assumes the dialog unmounts on close (typical). If your dialog stays mounted behind an `open` prop, add `open` to the effect guard (`if (mode === 'create' || !open) return;`) and to its dependency array so the interval starts/stops with visibility.

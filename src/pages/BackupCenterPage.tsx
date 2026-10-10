import { useState, useEffect, useCallback } from 'react';
import {
  DatabaseBackup, FolderArchive, Bot, Settings2, Database, FolderOpen,
  Loader2, RefreshCw, CheckCircle2, AlertTriangle, HardDrive, Clock, ShieldCheck, Trash2,
} from 'lucide-react';
import BackupPanel from '../components/BackupPanel';
import { BackupTabPanel } from '../components/workspace/BackupTabPanel';

const TABS = [
  { id: 'database', label: 'Database', icon: Database },
  { id: 'projects', label: 'Projects', icon: FolderArchive },
  { id: 'agents', label: 'Agent Snapshots', icon: Bot },
  { id: 'setup', label: 'Setup', icon: Settings2 },
] as const;

type TabId = typeof TABS[number]['id'];

/* ══════════════════════════════════════════════════════════════════════
   PROJECT IDENTITY — the fix for "failed to detect a project" while the
   user is demonstrably inside one.

   THE BUG WAS NOT A COMPARISON. It was that this page had no notion of
   "which project am I in" at all. It listed every row of `projects` and
   auto-selected `projects[0]` — which `get-ide-projects-overview` orders
   by `last_activity_at DESC`, i.e. *the most recently touched project*,
   not *the project this app session is running*. Two consequences, both
   silent:
     1. It showed and backed up the WRONG project.
     2. If the current project's row was missing or soft-deleted, the id
        lookup returned undefined and the page rendered its empty state —
        the exact "No IDE projects detected yet" that CZ reported while
        sitting in the project.

   The app DOES already know the answer, and writes it down: TerminalPage
   persists the active project id to `localStorage['terminal-project']`
   (TerminalPage.tsx:2204) and reads it back on mount (:2156). This page
   never consulted it. That is the two-places-disagreeing shape from
   MEMORY.md — except here one of the two places simply had no opinion.

   We now read that key, match it against the list by ID first and by
   NORMALISED PATH second, and — critically — if neither matches we say so
   rather than silently substituting a different project. A backup aimed at
   the wrong directory is worse than no backup: `restore` writes files.
   ══════════════════════════════════════════════════════════════════════ */

/** The key TerminalPage.tsx:2204 writes and :2156 reads. Single source. */
const CURRENT_PROJECT_KEY = 'terminal-project';

function isWindowsPlatform(): boolean {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  const plat = String(nav?.userAgentData?.platform || nav?.platform || '');
  const ua = String(nav?.userAgent || '');
  return /win/i.test(plat) || /windows/i.test(ua);
}

function isCaseInsensitiveFS(): boolean {
  if (isWindowsPlatform()) return true;
  const plat = String((typeof navigator !== 'undefined' && (navigator as any).userAgentData?.platform) || (typeof navigator !== 'undefined' && navigator.platform) || '');
  return /mac/i.test(plat);
}

/**
 * Textual path normaliser.
 *
 * LIMITATION, stated rather than hidden: the renderer has no `fs`, so this
 * CANNOT resolve a symlink. Two paths that differ only by a symlinked
 * ancestor compare unequal here unless the prefix is special-cased (see
 * the /run/media note). A general realpath comparison needs a main-process
 * IPC — out of this slice, see the report.
 */
function normalisePath(input: unknown): string {
  if (typeof input !== 'string') return '';
  let s = input.trim();
  if (!s) return '';
  // Rewrite separators ONLY where the OS treats them as separators. On POSIX
  // a backslash is a legal FILENAME character, so rewriting it would turn
  // "/tmp/we\ird" into the different directory "/tmp/we/ird".
  if (isWindowsPlatform()) s = s.replace(/\\/g, '/');
  s = s.replace(/\/{2,}/g, '/');
  // Resolve "." and ".." TEXTUALLY. Safe because these are whole directory
  // paths, and leading ".." can never climb above the root this way.
  const isAbsolute = s.startsWith('/');
  const out: string[] = [];
  for (const seg of s.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  s = (isAbsolute ? '/' : '') + out.join('/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  // /run/media/<user>/<label> is the real systemd mount and /media/... is the
  // compat symlink to it — the same directory under two names. This repo
  // lives under /run/media/clementzhao/..., so a project registered via the
  // /media spelling must still match. POSIX only: on Windows "run/media" is
  // an ordinary first folder and collapsing it would be a false positive.
  if (!isWindowsPlatform()) s = s.replace(/^\/run\/media(?=\/|$)/i, '/media');
  return s;
}

/** True when two paths name the same directory, modulo the above. */
function samePath(a: unknown, b: unknown): boolean {
  const x = normalisePath(a);
  const y = normalisePath(b);
  if (!x || !y) return false;
  return isCaseInsensitiveFS() ? x.toLowerCase() === y.toLowerCase() : x === y;
}

interface ProjectRow {
  id: string;
  name: string;
  path: string;
}

function readCurrentProjectId(): string | null {
  // All localStorage access is wrapped, per the hard invariant.
  try {
    const v = localStorage.getItem(CURRENT_PROJECT_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the project this app session is actually in, by the id the app
 * itself persisted. Returns null — NEVER a guess — when it cannot be
 * identified, because a backup aimed at the wrong directory is worse than
 * no backup: `restore` writes files into it.
 */
function resolveCurrentProject(rows: ProjectRow[], appProjectId: string | null): ProjectRow | null {
  if (!Array.isArray(rows) || !appProjectId) return null;
  return rows.find((r) => r?.id === appProjectId) || null;
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const TRIGGER_META: Record<string, { label: string; color: string }> = {
  startup: { label: 'Startup', color: 'text-blue-400' },
  interval: { label: 'Auto', color: 'text-zinc-400' },
  quit: { label: 'Quit', color: 'text-orange-400' },
  manual: { label: 'Manual', color: 'text-green-400' },
  'pre-restore': { label: 'Pre-Restore', color: 'text-amber-400' },
  'agent-session': { label: 'Agent Session', color: 'text-violet-400' },
};

function triggerMeta(t?: string) {
  return TRIGGER_META[t || 'manual'] || TRIGGER_META.manual;
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-zinc-800/70 flex items-center justify-center text-zinc-300 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{label}</div>
        <div className="text-lg font-semibold text-zinc-100 truncate">{value}</div>
        {sub && <div className="text-[11px] text-zinc-500 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TABS.map((t) => {
        const Icon = t.icon;
        const activeTab = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all ${
              activeTab
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30'
                : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] text-zinc-400 ring-1 ring-inset ring-zinc-800/70 hover:text-zinc-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

interface AgentSnapshotRow {
  kind: 'db' | 'project';
  when: string;
  label: string;
  project?: string;
  detail: string;
}

export default function BackupCenterPage() {
  const [tab, setTab] = useState<TabId>('database');
  const [status, setStatus] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<AgentSnapshotRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Array<{ projectId: string; minutes: number; enabled: boolean; lastRunAt?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The project id the app itself recorded as current, or null if unknown. */
  const [appProjectId, setAppProjectId] = useState<string | null>(null);
  /** True when the app HAS a current project but we could not match it to a row. */
  const [currentProjectUnmatched, setCurrentProjectUnmatched] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = window.deskflowAPI;
      /* allSettled, not all: one rejected call used to reject the whole
         Promise.all, so a single IPC hiccup blanked EVERY panel on this page
         and reported one opaque error. Each panel now degrades on its own and
         the rest still load. */
      const [stR, ovR, schR, dbR, pbR, prR] = await Promise.allSettled([
        api?.backup.status() ?? Promise.resolve(null),
        api?.getIDEProjectsOverview?.() ?? Promise.resolve(null),
        api?.projectBackup.getSchedules?.() ?? Promise.resolve(null),
        api?.backup.list?.() ?? Promise.resolve([]),
        api?.projectBackup.list?.() ?? Promise.resolve({ success: true, data: [] }),
        /* `get-projects` is a DEDICATED one-query handler (main.ts:13094) whose
           catch can only mean "the projects table is unreachable". The overview
           above is a ~250-line analytics handler that wraps the project list in
           the SAME try/catch as ~15 unrelated queries — any one of them throwing
           makes its catch return `projects: []`, i.e. "you have no projects".
           Deriving the project LIST from an analytics endpoint is the mistake
           that made this page say it could not find the project the user was
           standing in. Ask the narrow handler first; keep the overview only as
           a fallback so a failure there degrades to "no extra data", never to
           "no projects". */
        api?.getProjects?.() ?? Promise.resolve(null),
      ]);
      const val = (r: PromiseSettledResult<any> | undefined, fb: any): any =>
        r && r.status === 'fulfilled' && r.value != null ? r.value : fb;
      /* GUARD THE ARRAY, NOT THE OBJECT. `overview?.projects` guards the
         wrapper; if `projects` is present but is not an array (a single row
         object, an object map) the first `.find`/`.map` throws one token later.
         Normalise once, at the only write site, so every reader downstream is
         safe by construction. */
      const asRows = (v: any): ProjectRow[] =>
        Array.isArray(v) ? v.filter((r: any) => r && typeof r.id === 'string' && r.id) : [];
      const st: any = val(stR, null);
      const overview: any = val(ovR, null);
      const sch: any = val(schR, null);
      const dbList: any = val(dbR, []);
      const projBackups: any = val(pbR, { success: true, data: [] });
      const failed = [stR, ovR, schR, dbR, pbR, prR].filter(r => r.status === 'rejected').length;
      if (failed) console.warn(`[BackupCenter] ${failed} panel(s) failed to load; showing the rest.`);
      setStatus(st);

      const fromDedicated = asRows(val(prR, null));
      const fromOverview = asRows(overview?.projects);
      const rows = fromDedicated.length ? fromDedicated : fromOverview;
      if (!fromDedicated.length && fromOverview.length) {
        console.warn('[BackupCenter] get-projects returned nothing; falling back to the overview payload.');
      }
      setProjects(rows);

      /* ── Which project are we IN? ──────────────────────────────────────
         Read the id the app persisted. Previously this page auto-selected
         `projects[0]` — ordered by last_activity_at DESC, i.e. the most
         recently *touched* project, which is not the same thing as the one
         this session is running. */
      const appId = readCurrentProjectId();
      setAppProjectId(appId);
      const current = resolveCurrentProject(rows, appId);
      /* Only claim "unmatched" when we actually know there IS a current
         project. No recorded id means first visit / terminal never opened —
         falling back to the first project is correct there. */
      setCurrentProjectUnmatched(Boolean(appId) && !current);

      setSelectedProject(prev => {
        if (prev && rows.some((r) => r.id === prev)) return prev; // keep user's explicit choice
        if (current) return current.id;                          // the project we are actually in
        if (!appId && rows.length) return rows[0].id;             // nothing recorded yet
        return null;                                              // do NOT guess a different project
      });

      /* Schedules: `projectBackup:getSchedules` rejects outright when the
         handler hands Electron a payload carrying a Node `timer`
         (ProjectBackupService.cjs:265 returns live Map values). It also
         disagrees between its two implementations — the .cjs returns
         objects, src/main/backup/ProjectBackupService.ts:376 returns bare
         id strings. Accept BOTH shapes rather than depending on which one
         is loaded, and guard the array. */
      const rawSched = val(sch, null);
      const schedData: any[] = Array.isArray(rawSched) ? rawSched : Array.isArray(rawSched?.data) ? rawSched.data : [];
      setSchedules(schedData
        .map((s: any) => (typeof s === 'string' ? { projectId: s, minutes: 0, enabled: true, lastRunAt: null } : s))
        .filter((s: any) => s && typeof s.projectId === 'string' && s.projectId));

      const snapshotRows: AgentSnapshotRow[] = [];
      if (Array.isArray(dbList)) {
        for (const b of dbList) {
          if (b?.trigger === 'agent-session') {
            snapshotRows.push({ kind: 'db', when: b.createdAt || '', label: 'Database snapshot', detail: `${b.totalRows ?? 0} rows · ${fmtBytes(b.bytes)}` });
          }
        }
      }
      const pbData: any[] = Array.isArray(projBackups?.data) ? projBackups.data : [];
      for (const p of pbData) {
        if (p?.trigger === 'agent-session') {
          snapshotRows.push({ kind: 'project', when: p.timestamp || '', label: p.label || 'Project snapshot', project: p.projectId, detail: `${p.fileCount ?? 0} files · ${fmtBytes(p.totalSize)}` });
        }
      }
      /* A manifest row can be missing its timestamp; `undefined.localeCompare`
         threw here and blanked the whole tab. Coerce, then sort. */
      snapshotRows.sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')));
      setSnapshots(snapshotRows);
    } catch (e: any) {
      setError(String(e.message || e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* Keep in step with the Terminal page, which owns this key and rewrites it
     whenever the user switches project. Without this the page shows whatever
     it found on mount, which is the original bug in another costume. */
  useEffect(() => {
    const sync = () => {
      const id = readCurrentProjectId();
      setAppProjectId(prev => (prev === id ? prev : id));
      if (id) setSelectedProject(prev => (prev === id ? prev : id));
    };
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const selectedProjectRow = projects.find((p) => p.id === selectedProject) || null;
  /* A schedule can carry the project it was created for as a PATH
     (ProjectBackupService.cjs:285 persists `projectPath` alongside `projectId`).
     Matching on id alone misses a schedule whose project row was re-created
     under a new id for the same folder, which makes the page report
     "Auto-backup: off" while a timer is in fact running against this
     directory. Fall back to a normalised path comparison. */
  const activeSchedule =
    schedules.find((s) => s.projectId === selectedProject) ||
    schedules.find((s) => samePath((s as any)?.projectPath, selectedProjectRow?.path)) ||
    undefined;
  /* Normalise before it leaves the renderer: `BackupTabPanel` and the scheduler
     both hand this straight to `fs.existsSync` / `glob({cwd})`, and a trailing
     separator or a doubled slash is a different STRING to every one of them.
     The stored value is left untouched — we normalise the copy we pass on, we
     do not rewrite the user's project. */
  const selectedProjectPath = normalisePath(selectedProjectRow?.path) || null;
  const saveSchedule = async (minutes: number) => {
    if (!selectedProject || !selectedProjectPath) return;
    const res = await window.deskflowAPI?.projectBackup.schedule(selectedProject, minutes, selectedProjectPath);
    if (res?.success) {
      /* Re-read through the same normaliser the loader uses; this call can
         reject (see the getSchedules note in loadAll). */
      try {
        const sch = await window.deskflowAPI?.projectBackup.getSchedules();
        const d: any = Array.isArray(sch) ? sch : Array.isArray(sch?.data) ? sch.data : [];
        setSchedules(d
          .map((s: any) => (typeof s === 'string' ? { projectId: s, minutes: 0, enabled: true, lastRunAt: null } : s))
          .filter((s: any) => s && typeof s.projectId === 'string'));
      } catch (e) {
        console.warn('[BackupCenter] schedule refresh failed; keeping current view.', e);
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto ws-scroll">
      <div className="relative z-10 p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30 flex items-center justify-center">
            <DatabaseBackup className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Backup Center</h1>
            <p className="text-xs text-zinc-500">Database + project file backups, agent snapshots, and mirror safety</p>
          </div>
          <button
            onClick={loadAll}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 ring-1 ring-inset ring-zinc-700/60 text-xs text-zinc-300 hover:text-zinc-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <TabBar active={tab} onChange={setTab} />

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 ring-1 ring-inset ring-red-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        {tab === 'database' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile icon={<Clock className="w-4 h-4" />} label="Last backup" value={status?.lastBackup ? fmtWhen(status.lastBackup.createdAt) : '—'} sub={status?.lastBackup ? triggerMeta(status.lastBackup.trigger).label : 'never'} />
                <StatTile icon={<HardDrive className="w-4 h-4" />} label="Backups kept" value={status?.backupCount ?? 0} sub={`${fmtBytes(status?.totalBytes)} total`} />
                <StatTile icon={<ShieldCheck className="w-4 h-4" />} label="Scheduler" value={status?.schedulerRunning ? 'Running' : 'Off'} sub={`every ${Math.round((status?.intervalMs || 0) / 60000)} min`} />
                <StatTile icon={<FolderOpen className="w-4 h-4" />} label="Mirror" value={status?.settings?.mirrorDir ? 'Active' : 'None'} sub={status?.settings?.mirrorDir || 'setup in Setup tab'} />
              </div>
            )}
            <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 overflow-hidden">
              <BackupPanel />
            </div>
          </div>
        )}

        {tab === 'projects' && (
          <div className="space-y-4">
            {/* An EMPTY LIST and an UNRESOLVED CURRENT PROJECT are different
                facts and must not render as the same sentence. The old code
                collapsed both into "No IDE projects detected yet", which is
                precisely the message CZ saw while demonstrably inside one. */}
            {currentProjectUnmatched ? (
              <div className="rounded-xl bg-amber-500/10 ring-1 ring-inset ring-amber-500/30 p-5 text-sm text-amber-200">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  The project you are working in is no longer registered
                </div>
                <p className="mt-2 text-xs text-amber-200/80">
                  The Terminal is running with project id <code className="font-mono">{appProjectId}</code>, but that
                  project is not in the list below — it was most likely removed, or its folder was moved or renamed.
                  Backups are not offered for a project that cannot be resolved, because a backup taken against
                  the wrong folder is worse than no backup at all.
                </p>
                <p className="mt-2 text-xs text-amber-200/80">
                  Pick a project below to back that one up, or re-add this folder on the IDE Projects page.
                </p>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-8 text-center text-sm text-zinc-500">
                No IDE projects detected yet. Open the IDE Projects page so a project is registered, then come back.
              </div>
            ) : (
              <>
                {selectedProject && selectedProjectRow?.id === appProjectId && (
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Detected the project you are working in</span>
                    <code className="font-mono text-zinc-400 truncate">{selectedProjectPath}</code>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Project</span>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProject(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        selectedProject === p.id
                          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30'
                          : 'bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] text-zinc-400 ring-1 ring-inset ring-zinc-800/70 hover:text-zinc-200'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {p.name || p.path}
                    </button>
                  ))}
                </div>

                {selectedProject && selectedProjectPath && (
                  <>
                    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-4">
                      <div className="text-xs text-zinc-500">
                        Auto-backup:{' '}
                        <span className={activeSchedule?.enabled ? 'text-emerald-400 font-medium' : 'text-zinc-400'}>
                          {activeSchedule?.enabled ? `every ${activeSchedule.minutes} min` : 'off'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[15, 30, 60, 120].map((m) => (
                          <button
                            key={m}
                            onClick={() => saveSchedule(m)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ring-1 ring-inset transition-all ${
                              activeSchedule?.minutes === m && activeSchedule?.enabled
                                ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                                : 'bg-zinc-800/60 text-zinc-400 ring-zinc-700/60 hover:text-zinc-200'
                            }`}
                          >
                            {m}m
                          </button>
                        ))}
                        <button
                          onClick={() => saveSchedule(0)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium ring-1 ring-inset ring-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:text-red-300"
                        >
                          Off
                        </button>
                      </div>
                      {activeSchedule?.lastRunAt && (
                        <span className="text-[11px] text-zinc-600">last run {fmtWhen(activeSchedule.lastRunAt)}</span>
                      )}
                    </div>
                    <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 overflow-hidden">
                      <BackupTabPanel projectId={selectedProject} projectPath={selectedProjectPath} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'agents' && (
          <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Bot className="w-4 h-4 text-violet-400" /> Agent session snapshots
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Every AI agent session spawns a pre-flight snapshot (database + project files) so agents always work on protected state.
                Agents are instructed about this via the Backup &amp; Safety Protocol in their context.
              </p>
            </div>
            {snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
                <ShieldCheck className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-sm">No agent snapshots yet — they appear automatically when an agent session starts.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {snapshots.map((s, i) => (
                  <div key={`${s.kind}-${s.when}-${i}`} className="rounded-xl ring-1 ring-inset ring-zinc-800/70 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.kind === 'db' ? 'bg-violet-500/15 text-violet-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {s.kind === 'db' ? <Database className="w-4 h-4" /> : <FolderArchive className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-zinc-200 truncate">{s.label}</div>
                      <div className="text-[11px] text-zinc-500 truncate">{s.kind === 'project' && s.project ? `${s.project} · ` : ''}{s.detail}</div>
                    </div>
                    <div className="text-[11px] text-zinc-500 shrink-0">{fmtWhen(s.when)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'setup' && (
          <SetupTab status={status} />
        )}
      </div>
    </div>
  );
}

function SetupTab({ status }: { status: any }) {
  const [retention, setRetention] = useState({ hourly: 24, daily: 14, weekly: 8, monthly: 12 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status?.settings) {
      setRetention({
        hourly: status.settings.retention?.hourly ?? 24,
        daily: status.settings.retention?.daily ?? 14,
        weekly: status.settings.retention?.weekly ?? 8,
        monthly: status.settings.retention?.monthly ?? 12,
      });
    }
  }, [status]);

  const setRet = (k: keyof typeof retention, v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setRetention((r) => ({ ...r, [k]: n }));
  };

  const saveRetention = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await window.deskflowAPI?.backup.settingsSet({ retention });
      setMsg({ type: 'success', text: 'Retention saved. Rotation applies on the next backup.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: String(e.message || e) });
    }
    setSaving(false);
  };

  const toggleAuto = async () => {
    const cur = status?.settings?.autoBackup ?? true;
    await window.deskflowAPI?.backup.settingsSet({ autoBackup: !cur });
    window.location.reload();
  };

  const pickMirror = async () => {
    setMsg(null);
    const res = await window.deskflowAPI?.backup.pickMirrorDir();
    if (res?.canceled) return;
    setMsg({ type: 'success', text: res?.mirrorDir ? `Mirror set: ${res.mirrorDir}` : 'Mirror cleared' });
    window.location.reload();
  };

  const clearMirror = async () => {
    await window.deskflowAPI?.backup.settingsSet({ mirrorDir: '' });
    window.location.reload();
  };

  const testBackup = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const b = await window.deskflowAPI?.backup.create();
      setMsg({ type: 'success', text: `Test backup OK: ${b?.totalRows} rows, ${fmtBytes(b?.bytes)} → ${b?.backupFile}` });
    } catch (e: any) {
      setMsg({ type: 'error', text: String(e.message || e) });
    }
    setSaving(false);
  };

  const mirrorDir = status?.settings?.mirrorDir;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-emerald-300" /> Mirror location
        </h2>
        <p className="text-xs text-zinc-500">
          Every verified backup is copied to a second location (USB drive, NAS, cloud folder) for off-machine safety.
        </p>
        <div className="rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 px-3 py-2 text-xs font-mono text-zinc-300 truncate">
          {mirrorDir || <span className="text-zinc-600">No mirror set — backups stay in the app folder only</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={pickMirror}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
          >
            <FolderOpen className="w-3.5 h-3.5" /> {mirrorDir ? 'Change mirror' : 'Choose mirror folder'}
          </button>
          {mirrorDir && (
            <button
              onClick={clearMirror}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 ring-1 ring-inset ring-zinc-700/60 text-zinc-300 text-xs hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-300" /> Retention &amp; automation
        </h2>
        <label className="flex items-center justify-between text-xs text-zinc-400">
          <span>Automatic backups (startup / 30 min / quit / agent sessions)</span>
          <button
            onClick={toggleAuto}
            className={`relative w-9 h-5 rounded-full transition-colors ${status?.settings?.autoBackup ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${status?.settings?.autoBackup ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((k) => (
            <label key={k} className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">{k}</span>
              <input
                type="number"
                min={0}
                value={retention[k]}
                onChange={(e) => setRet(k, e.target.value)}
                className="w-full mt-1 rounded-lg bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-inset ring-zinc-800/70 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-emerald-500/40"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveRetention}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Save retention
          </button>
          <button
            onClick={testBackup}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
          >
            <DatabaseBackup className="w-3.5 h-3.5" /> Test backup now
          </button>
        </div>
        {msg && (
          <div className={`flex items-center gap-1.5 text-xs ${msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {msg.text}
          </div>
        )}
      </div>

      <div className="md:col-span-2 rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-5">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">Agent context protocol</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Every agent session receives the <span className="text-violet-300 font-medium">Backup &amp; Safety Protocol</span> in its
          context: snapshots are taken automatically before the session and every 30 minutes; agents must ask the user for permission
          and create a physical backup in <code className="text-zinc-300">agent/backups/&lt;timestamp&gt;-desc-pre/</code> before risky
          edits; destructive git commands are forbidden; the database is read-only for agents; restores are always a user action from
          this page.
        </p>
      </div>
    </div>
  );
}

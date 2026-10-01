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
                : 'bg-zinc-900/60 text-zinc-400 ring-1 ring-inset ring-zinc-800/70 hover:text-zinc-200'
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
  const [projects, setProjects] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Array<{ projectId: string; minutes: number; enabled: boolean; lastRunAt?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = window.deskflowAPI;
      const [st, overview, sch, dbList, projBackups] = await Promise.all([
        api?.backup.status() ?? null,
        api?.getIDEProjectsOverview?.() ?? null,
        api?.projectBackup.getSchedules?.() ?? null,
        api?.backup.list() ?? [],
        api?.projectBackup.list() ?? { success: true, data: [] },
      ]);
      setStatus(st);
      setProjects(overview?.projects || []);
      // Auto-select first project only on initial load (when nothing is selected yet)
      setSelectedProject(prev => {
        if (prev) return prev; // keep user's selection
        if (overview?.projects?.length) return overview.projects[0].id;
        return null;
      });
      setSchedules(sch?.data || []);

      const rows: AgentSnapshotRow[] = [];
      for (const b of dbList || []) {
        if (b.trigger === 'agent-session') {
          rows.push({ kind: 'db', when: b.createdAt, label: 'Database snapshot', detail: `${b.totalRows} rows · ${fmtBytes(b.bytes)}` });
        }
      }
      for (const p of projBackups?.data || []) {
        if (p.trigger === 'agent-session') {
          rows.push({ kind: 'project', when: p.timestamp, label: p.label, project: p.projectId, detail: `${p.fileCount} files · ${fmtBytes(p.totalSize)}` });
        }
      }
      rows.sort((a, b) => b.when.localeCompare(a.when));
      setSnapshots(rows);
    } catch (e: any) {
      setError(String(e.message || e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selectedProjectPath = projects.find((p) => p.id === selectedProject)?.path || null;
  const activeSchedule = schedules.find((s) => s.projectId === selectedProject);

  const saveSchedule = async (minutes: number) => {
    if (!selectedProject || !selectedProjectPath) return;
    const res = await window.deskflowAPI?.projectBackup.schedule(selectedProject, minutes, selectedProjectPath);
    if (res?.success) {
      const sch = await window.deskflowAPI?.projectBackup.getSchedules();
      setSchedules(sch?.data || []);
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
            {projects.length === 0 ? (
              <div className="rounded-xl bg-[rgba(24,24,27,0.60)] ring-1 ring-inset ring-zinc-800/70 p-8 text-center text-sm text-zinc-500">
                No IDE projects detected yet. Open the IDE Projects page so a project is registered, then come back.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Project</span>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProject(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        selectedProject === p.id
                          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30'
                          : 'bg-zinc-900/60 text-zinc-400 ring-1 ring-inset ring-zinc-800/70 hover:text-zinc-200'
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
                  <div key={`${s.kind}-${s.when}-${i}`} className="rounded-xl ring-1 ring-inset ring-zinc-800/70 bg-zinc-900/40 p-3 flex items-center gap-3">
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
        <div className="rounded-lg bg-zinc-900/60 ring-1 ring-inset ring-zinc-800/70 px-3 py-2 text-xs font-mono text-zinc-300 truncate">
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
                className="w-full mt-1 rounded-lg bg-zinc-900/60 ring-1 ring-inset ring-zinc-800/70 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-emerald-500/40"
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

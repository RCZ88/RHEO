import { useState, useEffect, useCallback } from 'react';
import { Database, Trash2, Upload, Download, FileJson, FileSpreadsheet, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface BackupManifest {
  createdAt: string;
  trigger: 'startup' | 'interval' | 'quit' | 'manual' | 'pre-restore' | 'agent-session';
  backupFile: string;
  bytes: number;
  sha256: string;
  rowCounts: Record<string, number>;
  totalRows: number;
  integrityOk: boolean;
}

const triggerLabel: Record<string, string> = {
  startup: 'Startup',
  interval: 'Auto',
  quit: 'Quit',
  manual: 'Manual',
  'pre-restore': 'Pre-Restore',
  'agent-session': 'Agent Session',
};

const triggerColor: Record<string, string> = {
  startup: 'text-blue-400',
  interval: 'text-zinc-400',
  quit: 'text-orange-400',
  manual: 'text-green-400',
  'pre-restore': 'text-amber-400',
  'agent-session': 'text-violet-400',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupPanel() {
  const [backups, setBackups] = useState<BackupManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.deskflowAPI?.backup.list();
      setBackups(list || []);
    } catch (e: any) {
      setMessage({ type: 'error', text: `Failed to load backups: ${e.message}` });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const result = await window.deskflowAPI?.backup.create();
      setMessage({ type: 'success', text: `Backup created: ${result.totalRows} rows, ${formatBytes(result.bytes)}` });
      await loadBackups();
    } catch (e: any) {
      setMessage({ type: 'error', text: `Create failed: ${e.message}` });
    }
    setCreating(false);
  };

  const handleRestore = async (name: string) => {
    if (!confirm(`Restore backup "${name}"? This will close the current database and replace it.`)) return;
    setRestoring(name);
    setMessage(null);
    try {
      await window.deskflowAPI?.backup.restore(name);
      setMessage({ type: 'success', text: 'Database restored successfully. App will reload.' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (e: any) {
      setMessage({ type: 'error', text: `Restore failed: ${e.message}` });
    }
    setRestoring(null);
  };

  const handleExportJSON = async () => {
    setExporting('json');
    setMessage(null);
    try {
      const path = await window.deskflowAPI?.backup.exportJSON();
      setMessage({ type: 'success', text: `JSON export saved: ${path}` });
    } catch (e: any) {
      setMessage({ type: 'error', text: `JSON export failed: ${e.message}` });
    }
    setExporting(null);
  };

  const handleExportCSV = async () => {
    setExporting('csv');
    setMessage(null);
    try {
      const tables = await window.deskflowAPI?.getDatabaseTables?.();
      const names = tables?.tables || [];
      if (names.length === 0) {
        setMessage({ type: 'error', text: 'No tables found to export' });
        setExporting(null);
        return;
      }
      const paths = await window.deskflowAPI?.backup.exportCSV(names);
      setMessage({ type: 'success', text: `CSV exports saved (${paths?.length || 0} files)` });
    } catch (e: any) {
      setMessage({ type: 'error', text: `CSV export failed: ${e.message}` });
    }
    setExporting(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Backup & Restore</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {creating ? 'Creating...' : 'Create Backup'}
          </button>
          <button
            onClick={handleExportJSON}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 text-zinc-200 text-xs font-medium rounded-lg transition-colors"
          >
            {exporting === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
            Export JSON
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 text-zinc-200 text-xs font-medium rounded-lg transition-colors"
          >
            {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Export CSV
          </button>
          <button
            onClick={loadBackups}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        {message && (
          <div className={`mt-2 flex items-center gap-1.5 text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {message.text}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto ws-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        ) : backups.length === 0 ? (
          <EmptyState
            icon={<Database className="w-5 h-5" />}
            title="No backups yet"
            description="Create your first backup to protect your data"
            action={{ label: 'Create Backup', onClick: handleCreate }}
          />
        ) : (
          <div className="p-3 space-y-2">
            {backups.map((b, i) => (
              <div key={b.backupFile} className="rounded-lg ring-1 ring-inset ring-zinc-800/70 bg-zinc-900/50 light:bg-[var(--ws-surface-raised)] backdrop-blur-sm p-2.5 group hover:ring-zinc-700/50 transition-all duration-150">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase ${triggerColor[b.trigger]}`}>
                        {triggerLabel[b.trigger]}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <span>{formatBytes(b.bytes)}</span>
                      <span className="text-zinc-700">|</span>
                      <span>{b.totalRows} rows</span>
                      <span className="text-zinc-700">|</span>
                      <span className={`${b.integrityOk ? 'text-emerald-500' : 'text-red-500'}`}>
                        {b.integrityOk ? 'OK' : 'CORRUPT'}
                      </span>
                      {i === 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">latest</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleRestore(b.backupFile)}
                      disabled={restoring === b.backupFile}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
                      title="Restore this backup"
                    >
                      {restoring === b.backupFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    </button>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete backup"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

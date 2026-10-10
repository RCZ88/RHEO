import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive, Clock, Download, Trash2, RotateCcw, FileText, FolderTree,
  Plus, Search, Check, X, AlertTriangle, Loader2, ChevronRight,
  Calendar, HardDrive, Zap, Filter
} from 'lucide-react';
import { ProjectBackupManifest, ProjectBackupDiff } from '../../types/deskflow-api';
import { BackupDiffViewer } from './BackupDiffViewer';
import { EmptyState, Skeleton, IconButton, Chip } from './_ds/primitives';

interface BackupTabPanelProps {
  projectId: string | null;
  projectPath: string | null;
}

type IntervalOption = { label: string; value: number };

const INTERVAL_OPTIONS: IntervalOption[] = [
  { label: 'Off', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '4 hr', value: 240 },
];

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function BackupTabPanel({ projectId, projectPath }: BackupTabPanelProps) {
  const [backups, setBackups] = useState<ProjectBackupManifest[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<ProjectBackupManifest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoBackupInterval, setAutoBackupInterval] = useState(0);
  const [diff, setDiff] = useState<ProjectBackupDiff | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);

  const windowAPI = (window as any).deskflowAPI;

  const loadBackups = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.list(projectId);
      if (result?.success) {
        setBackups(result.data || []);
      } else {
        setError(result?.error || 'Failed to load backups');
      }
    } catch {
      setError('Failed to load backups');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const filteredBackups = backups.filter((b) =>
    b.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBackup = async () => {
    if (!projectId || !projectPath) return;
    setIsCreating(true);
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.create(projectId, projectPath);
      if (result?.success) {
        setSuccessMsg(`Backup created: ${result.data?.label}`);
        await loadBackups();
      } else {
        setError(result?.error || 'Backup creation failed');
      }
    } catch {
      setError('Backup creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!projectId || !selectedBackup) return;
    setIsRestoring(true);
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.restore(projectId, selectedBackup.id);
      if (result?.success) {
        setSuccessMsg(`Restored ${result.data?.restoredCount || 0} files`);
        setShowRestoreConfirm(false);
      } else {
        setError(result?.error || 'Restore failed');
      }
    } catch {
      setError('Restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !projectId) return;
    setError(null);
    try {
      const result = await windowAPI?.projectBackup?.delete(deleteTarget, projectId);
      if (result?.success) {
        setSuccessMsg('Backup deleted');
        setSelectedIds(prev => { const next = new Set(prev); next.delete(deleteTarget); return next; });
        if (selectedBackup?.id === deleteTarget) setSelectedBackup(null);
        await loadBackups();
      } else {
        setError(result?.error || 'Delete failed');
      }
    } catch {
      setError('Delete failed');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!projectId) return;
    setError(null);
    let failed = 0;
    for (const id of selectedIds) {
      try {
        const result = await windowAPI?.projectBackup?.delete(id, projectId);
        if (!result?.success) failed++;
      } catch {
        failed++;
      }
    }
    if (failed === 0) {
      setSuccessMsg(`Deleted ${selectedIds.size} backups`);
    } else {
      setError(`${failed} deletions failed`);
    }
    setSelectedIds(new Set());
    setSelectedBackup(null);
    setShowBulkDeleteConfirm(false);
    await loadBackups();
  };

  const handleDiff = async () => {
    if (!projectId || !selectedBackup) return;
    setIsDiffing(true);
    setDiff(null);
    try {
      const result = await windowAPI?.projectBackup?.diff(projectId, selectedBackup.id);
      if (result?.success) {
        setDiff(result.data || null);
      } else {
        setError(result?.error || 'Diff failed');
      }
    } catch {
      setError('Diff failed');
    } finally {
      setIsDiffing(false);
    }
  };

  const handleSchedule = async (minutes: number) => {
    if (!projectId || !projectPath) return;
    try {
      const result = await windowAPI?.projectBackup?.schedule(projectId, minutes, projectPath);
      if (result?.success) {
        setAutoBackupInterval(minutes);
        setLastAutoBackup(minutes > 0 ? new Date().toISOString() : null);
        setSuccessMsg(minutes > 0 ? `Auto-backup enabled: every ${minutes} min` : 'Auto-backup disabled');
      } else {
        setError(result?.error || 'Failed to update schedule');
      }
    } catch {
      setError('Failed to update schedule');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredBackups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBackups.map(b => b.id)));
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <EmptyState
          icon={<Archive className="w-8 h-8 text-zinc-500" />}
          title="No project selected"
          hint="Select a project from the Projects tab to view backups"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 mx-4 mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 mx-4 mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm"
          >
            <Check className="w-4 h-4 shrink-0" />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${autoBackupInterval > 0 ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span className="text-xs text-zinc-400">
            {autoBackupInterval > 0 ? `Auto-backup: ON — every ${autoBackupInterval} min` : 'Auto-backup: OFF'}
          </span>
          {lastAutoBackup && autoBackupInterval > 0 && (
            <span className="text-xs text-zinc-600">Last: {formatRelativeTime(lastAutoBackup)}</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={autoBackupInterval}
            onChange={(e) => handleSchedule(Number(e.target.value))}
            className="bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-pink-500/40"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-lg text-xs font-medium hover:bg-pink-500/25 disabled:opacity-50 transition-colors"
          >
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Backup Now
          </motion.button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[40%] min-w-[300px] border-r border-zinc-800/40 flex flex-col">
          <div className="p-3 border-b border-zinc-800/40 space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search backups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              <Filter className="w-3.5 h-3.5 text-zinc-600" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {selectedIds.size === filteredBackups.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-[10px] text-zinc-600 ml-auto">{filteredBackups.length} backups</span>
            </div>
          </div>

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-zinc-800/40"
              >
                <div className="flex items-center gap-2 p-2 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
                  <span className="text-xs text-zinc-400">{selectedIds.size} selected</span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))
            ) : filteredBackups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Archive className="w-8 h-8 text-zinc-600 mb-3" />
                <p className="text-sm text-zinc-500 mb-1">No backups yet</p>
                <p className="text-xs text-zinc-600 text-center px-4 mb-4">
                  Create your first backup before your next AI coding session
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateBackup}
                  className="px-4 py-2 bg-pink-500/15 text-pink-300 border border-pink-500/30 rounded-lg text-sm font-medium hover:bg-pink-500/25 transition-colors"
                >
                  Create Backup
                </motion.button>
              </div>
            ) : (
              filteredBackups.map((backup) => (
                <motion.div
                  key={backup.id}
                  layout
                  onClick={() => setSelectedBackup(backup)}
                  className={`
                    group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all
                    ${selectedBackup?.id === backup.id
                      ? 'bg-pink-500/10 border border-pink-500/20'
                      : 'bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] border border-transparent hover:bg-zinc-800/40 hover:border-zinc-700/40'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(backup.id)}
                    onChange={() => toggleSelection(backup.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 light:bg-[var(--ws-surface-raised)] accent-pink-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-zinc-200 truncate">{backup.label}</span>
                      {backup.autoBackup && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Auto</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-500" title={new Date(backup.timestamp).toLocaleString()}>
                        {formatRelativeTime(backup.timestamp)}
                      </span>
                      <span className="text-[10px] text-zinc-600">{backup.fileCount} files</span>
                      <span className="text-[10px] text-zinc-600">{formatBytes(backup.totalSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setSelectedBackup(backup); handleDiff(); }}
                      title="Diff"
                      className="w-6 h-6"
                    >
                      <FileText className="w-3 h-3 text-zinc-400" />
                    </IconButton>
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(backup.id); setShowDeleteConfirm(true); }}
                      title="Delete"
                      danger
                      className="w-6 h-6"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                    </IconButton>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedBackup ? (
            <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedBackup.label}</h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(selectedBackup.timestamp).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatBytes(selectedBackup.totalSize)}</span>
                    <span className="flex items-center gap-1"><Archive className="w-3 h-3" />{selectedBackup.compressionRatio > 0 ? `${Math.round((1 - selectedBackup.compressionRatio) * 100)}% compressed` : 'No compression'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDiff}
                    disabled={isDiffing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-50 transition-colors"
                  >
                    {isDiffing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                    Compare
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={isRestoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </motion.button>
                </div>
              </div>

              <BackupDiffViewer diff={diff} isLoading={isDiffing} />

              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FolderTree className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">File Tree</h3>
                  <span className="text-xs text-zinc-500 ml-auto">{selectedBackup.fileCount} files</span>
                </div>
                <div className="text-xs text-zinc-500">
                  Backup archive contains {selectedBackup.fileCount} files totaling {formatBytes(selectedBackup.totalSize)}.
                  Extract the archive to inspect individual file contents.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={<Archive className="w-8 h-8 text-zinc-600" />}
                title="Select a backup"
                hint="Click a backup from the list to view details and restore options"
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRestoreConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Restore Backup</h3>
                  <p className="text-sm text-zinc-400">This will overwrite your current project files</p>
                </div>
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                A pre-restore snapshot will be saved first. Continue?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                >
                  {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Restore'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-white">Delete Backup</h3>
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                Delete this backup? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDelete}
                  className="px-4 py-2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/25 transition-colors"
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-800/60 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-white">Delete Backups</h3>
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                Delete {selectedIds.size} selected backups? This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/25 transition-colors"
                >
                  Delete {selectedIds.size}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

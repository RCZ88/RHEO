import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Edit2, Trash2, Check, Loader2, FolderCog, BookMarked } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { LessonSummary } from '../../shared/learn/types';
import {
  loadCustomChapters,
  addCustomChapter,
  renameCustomChapter,
  removeCustomChapter,
} from '../../services/learn/learnerProfile';

const api = (window as any).deskflowAPI;

export interface ChapterGroupsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ChapterGroup {
  name: string;
  lessonCount: number;
  isCustom: boolean;
}

export function ChapterGroupsModal({ open, onClose }: ChapterGroupsModalProps) {
  const [groups, setGroups] = useState<ChapterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const custom = loadCustomChapters();
      const [existingRes, lessonsRes] = await Promise.all([
        api.learnListChapters?.({}) ?? { ok: true, data: [] },
        api.learnListLessons?.({}) ?? { ok: true, data: [] },
      ]);
      const existingChapters: string[] = existingRes.ok ? (existingRes.data ?? []) : [];
      const lessons: LessonSummary[] = lessonsRes.ok ? (lessonsRes.data ?? []) : [];

      const chapterCounts = new Map<string, number>();
      for (const l of lessons) {
        const ch = l.chapter?.trim();
        if (ch) chapterCounts.set(ch, (chapterCounts.get(ch) ?? 0) + 1);
      }

      const seen = new Set<string>();
      const all: ChapterGroup[] = [];

      for (const c of custom) {
        if (!seen.has(c)) {
          seen.add(c);
          all.push({ name: c, lessonCount: chapterCounts.get(c) ?? 0, isCustom: true });
        }
      }
      for (const c of existingChapters) {
        if (!seen.has(c)) {
          seen.add(c);
          all.push({ name: c, lessonCount: chapterCounts.get(c) ?? 0, isCustom: false });
        }
      }

      setGroups(all);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    addCustomChapter(name);
    setNewName('');
    load();
    setAdding(false);
  };

  const handleRename = async (oldName: string) => {
    const name = editName.trim();
    if (!name || name === oldName) {
      setEditing(null);
      return;
    }
    renameCustomChapter(oldName, name);
    setEditing(null);
    load();
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Remove group "${name}"? Lessons keep their chapter label.`)) return;
    setDeleting(name);
    removeCustomChapter(name);
    setDeleting(null);
    load();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editing) handleRename(editing);
      else handleAdd();
    } else if (e.key === 'Escape') {
      setEditing(null);
      setNewName('');
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.06 }}
          className="relative w-full max-w-md max-h-[70vh] flex flex-col rounded-xl border border-zinc-800/50 bg-zinc-900/80 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl shadow-2xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Manage chapter groups"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-clay-500/10 border border-clay-500/20 flex items-center justify-center shrink-0">
                <FolderCog className="w-4 h-4 text-clay-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100 leading-tight">Manage Chapter Groups</h2>
                <p className="text-xs text-zinc-500 mt-0.5 leading-none">Curate your own group list for lesson organization</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {/* Add new group */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Create new group</label>
              <div className="flex gap-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. OS Memory Management"
                  className="flex-1"
                  disabled={adding}
                />
                <Button
                  onClick={handleAdd}
                  disabled={adding || !newName.trim()}
                  className="shrink-0"
                >
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">Groups appear in the chapter selector when creating lessons</p>
            </div>

            {/* Groups list */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12">
                <BookMarked className="w-10 h-10 mx-auto text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No groups yet</p>
                <p className="text-xs text-zinc-600 mt-1">Create your first group above to start organizing lessons</p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((g) => (
                  <div
                    key={g.name}
                    className="flex items-center justify-between p-3 rounded-lg border transition-all
                      bg-zinc-800/40 border-zinc-700/40 hover:border-zinc-600/60"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <BookMarked className={`w-3.5 h-3.5 shrink-0 ${g.isCustom ? 'text-clay-400' : 'text-zinc-500'}`} />
                      <span className="text-sm text-zinc-200 truncate">{g.name}</span>
                      {g.lessonCount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800/60">
                          {g.lessonCount} lesson{g.lessonCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {!g.isCustom && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] text-zinc-500 bg-zinc-800/40">AI</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {g.isCustom && !editing && (
                        <button
                          onClick={() => { setEditName(g.name); setEditing(g.name); }}
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                          aria-label={`Rename ${g.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {editing === g.name ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => handleRename(g.name)}
                            autoFocus
                            className="w-40"
                          />
                          <button
                            onClick={() => handleRename(g.name)}
                            className="p-1.5 rounded text-sage-400 hover:text-sage-300 hover:bg-sage-500/10 transition-colors"
                            aria-label="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : g.isCustom && (
                        <button
                          onClick={() => handleDelete(g.name)}
                          disabled={deleting === g.name}
                          className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          aria-label={`Delete ${g.name}`}
                        >
                          {deleting === g.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-800/80 shrink-0 gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 border border-zinc-700/50 transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
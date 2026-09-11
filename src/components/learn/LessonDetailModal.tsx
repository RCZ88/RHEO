import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Code2, BookOpen, Edit3, Trash2, Copy, Check, ChevronDown, AlertCircle, Loader2, FileText } from 'lucide-react';
import { CURRICULUM_TOPICS, getTopic, getTopicsByBranch } from '../../services/learn/curriculum';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import type { LessonSummary } from '../../shared/learn/types';

const api = (window as any).deskflowAPI;

type Tab = 'source' | 'topic' | 'edit';

interface Props {
  lesson: LessonSummary | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
  onOpenReader: (id: string) => void;
}

export function LessonDetailModal({ lesson, open, onClose, onDeleted, onUpdated, onOpenReader }: Props) {
  const [tab, setTab] = useState<Tab>('source');
  const [source, setSource] = useState('');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPart, setEditPart] = useState(0);
  const [editSummary, setEditSummary] = useState('');
  const [editChapter, setEditChapter] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [existingChapters, setExistingChapters] = useState<string[]>([]);

  const part = lesson ? getTopic(lesson.part) : undefined;

  useEffect(() => {
    if (open && lesson) {
      setTab('source');
      setSource('');
      setEditTitle(lesson.title);
      setEditPart(lesson.part);
      setEditSummary('');
      setEditChapter(lesson.chapter || '');
      setOriginalPrompt(lesson.original_prompt || '');
      setShowDeleteConfirm(false);
      loadSource();
      loadExistingChapters();
    }
  }, [open, lesson]);

  const loadSource = async () => {
    if (!lesson) return;
    setSourceLoading(true);
    try {
      const result = await api.learnGetLessonSource({ lessonId: lesson.id });
      if (result.ok && result.data) {
        const doc = JSON.parse(result.data);
        setSource(JSON.stringify(doc, null, 2));
        setEditSummary(doc.lesson?.summary || '');
      }
    } catch { /* ignore */ }
    setSourceLoading(false);
  };

  const loadExistingChapters = async () => {
    try {
      const [chaptersRes, profileRes] = await Promise.all([
        api.learnListChapters({ part: lesson?.part }),
        api.learnGetProfile({ key: 'lyceum.learnerProfile.v1' }),
      ]);
      const chapters = chaptersRes.ok ? (chaptersRes.data ?? []) : [];
      const custom = profileRes?.ok ? JSON.parse(profileRes.value || '{}').customChapters ?? [] : [];
      const all = Array.from(new Set([...chapters, ...custom])).sort();
      setExistingChapters(all);
    } catch { /* ignore */ }
  };

  const handleCopy = useCallback(async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [source]);

  const handleSaveSource = async () => {
    if (!lesson || !source) return;
    setSourceSaving(true);
    try {
      const result = await api.learnUpdateLessonDoc({
        lessonId: lesson.id,
        docJson: source,
      });
      if (result.ok) {
        onUpdated();
        onClose();
      } else {
        alert(result.error || 'Failed to save');
      }
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    }
    setSourceSaving(false);
  };

  const handleSave = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      await api.learnUpdateLessonMeta({
        lessonId: lesson.id,
        title: editTitle.trim() || lesson.title,
        part: editPart,
        summary: editSummary.trim(),
        chapter: editChapter.trim(),
      });
      onUpdated();
      onClose();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!lesson) return;
    setDeleting(true);
    try {
      await api.learnDeleteLesson({ lessonId: lesson.id });
      onDeleted();
      onClose();
    } catch { /* ignore */ }
    setDeleting(false);
  };

  if (!open || !lesson) return null;

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
          className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl border border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl shadow-2xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-clay-500/10 border border-clay-500/20 flex items-center justify-center shrink-0 text-lg">
                {part?.emoji || '📖'}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-100 leading-snug truncate">{lesson.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-zinc-500">Topic {String(lesson.part).padStart(2, '0')}</span>
                  <span className="text-[10px] text-zinc-600">·</span>
                  <span className="text-[10px] text-zinc-500">{lesson.nodeCount} nodes</span>
                  <span className="text-[10px] text-zinc-600">·</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500">{lesson.status}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onOpenReader(lesson.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-clay-500/15 hover:bg-clay-500/25 text-clay-300 border border-clay-500/20 transition-all"
              >
                <BookOpen className="w-3 h-3" />
                Read
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 px-6 py-2 border-b border-zinc-800/60 shrink-0">
            {([
              { key: 'source' as Tab, icon: Code2, label: 'Source' },
              { key: 'topic' as Tab, icon: BookOpen, label: 'Topic' },
              { key: 'edit' as Tab, icon: Edit3, label: 'Edit' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === key
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {/* Source tab — editable ldoc JSON */}
            {tab === 'source' && (
              <div className="space-y-3 h-full flex flex-col">
                <div className="flex items-center justify-between shrink-0">
                  <p className="text-xs text-zinc-500">Edit the lesson document JSON directly</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        copied
                          ? 'bg-sage-500/15 text-sage-300 border-sage-500/25'
                          : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/80 hover:text-zinc-200'
                      }`}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleSaveSource}
                      disabled={sourceSaving}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-clay-500/15 text-clay-300 border border-clay-500/20 hover:bg-clay-500/25 transition-all disabled:opacity-50"
                    >
                      {sourceSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {sourceSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                {sourceLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <textarea
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="flex-1 min-h-[40vh] w-full rounded-xl border border-zinc-800/50 bg-zinc-950/80 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 resize-y focus:outline-none focus:border-clay-500/40 transition-all"
                    spellCheck={false}
                  />
                )}
              </div>
            )}

            {/* Topic tab */}
            {tab === 'topic' && (
              <div className="space-y-4">
                {part ? (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{part.emoji}</span>
                        <h3 className="text-base font-semibold text-zinc-100">{part.title}</h3>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{part.intro}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Phase</p>
                        <p className="text-sm text-zinc-200">
                          {part.phase === 1 ? 'Core Engineering' : part.phase === 2 ? 'AI/ML Depth' : 'Mastery & Meta'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Target Mastery</p>
                        <p className="text-sm text-zinc-200">{part.defaultMasteryTarget}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Rarity</p>
                        <p className="text-sm text-amber-400">{'★'.repeat(part.rarity)}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Checklist Items</p>
                        <p className="text-sm text-zinc-200">{part.checklist.length} competencies</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">What you'll learn</p>
                      <p className="text-sm text-zinc-400 leading-relaxed">{part.trailer.what}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Why it matters</p>
                      <p className="text-sm text-zinc-400 leading-relaxed">{part.trailer.why}</p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Competency Checklist</p>
                      <div className="space-y-1">
                        {part.checklist.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                            <span className="text-zinc-600 shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">No topic assigned (topic {lesson.part})</p>
                )}
              </div>
            )}

            {/* Edit tab */}
            {tab === 'edit' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Title
                    <FieldAIButton
                      fieldName="title"
                      label="Lesson Title"
                      value={editTitle}
                      onUpdate={setEditTitle}
                      allFields={{ title: editTitle, summary: editSummary, chapter: editChapter }}
                      category="learn"
                      context="Suggest a clear, descriptive title for this lesson"
                    />
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-sm focus:outline-none focus:border-clay-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Topic</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(lesson?.branch_id ? getTopicsByBranch(lesson.branch_id) : CURRICULUM_TOPICS).map((p) => (
                      <button
                        key={p.part}
                        onClick={() => setEditPart(p.part)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          editPart === p.part
                            ? 'bg-clay-500/15 text-clay-300 border-clay-500/30'
                            : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:border-zinc-600/60 hover:text-zinc-300'
                        }`}
                      >
                        {p.emoji} {p.title}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Chapter</label>
                  <input
                    type="text"
                    value={editChapter}
                    onChange={(e) => setEditChapter(e.target.value)}
                    placeholder="e.g. Introduction, Advanced Topics..."
                    list="chapter-suggestions"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-sm focus:outline-none focus:border-clay-500/50 transition-all placeholder:text-zinc-600"
                  />
                  {existingChapters.length > 0 && (
                    <datalist id="chapter-suggestions">
                      {existingChapters.map((ch) => (
                        <option key={ch} value={ch} />
                      ))}
                    </datalist>
                  )}
                  <p className="text-[10px] text-zinc-600 mt-1">Group lessons into groups within this topic. Leave blank for ungrouped.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Summary
                    <FieldAIButton
                      fieldName="summary"
                      label="Lesson Summary"
                      value={editSummary}
                      onUpdate={setEditSummary}
                      allFields={{ title: editTitle, summary: editSummary, chapter: editChapter }}
                      category="learn"
                      context="Write a concise one-sentence summary of this lesson"
                    />
                  </label>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="One-sentence summary of this lesson..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-sm focus:outline-none focus:border-clay-500/50 transition-all min-h-[60px] resize-y placeholder:text-zinc-600"
                  />
                </div>

                {/* Original prompt */}
                {originalPrompt && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                      <FileText className="w-3 h-3" />
                      Original Prompt
                    </label>
                    <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/80 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap overflow-x-auto max-h-[30vh]">
                      {originalPrompt}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">The prompt used to generate this lesson. Read-only.</p>
                  </div>
                )}

                {/* Danger zone */}
                <div className="mt-6 pt-4 border-t border-zinc-800/60">
                  <p className="text-[10px] uppercase tracking-wider text-red-400/80 mb-2">Danger Zone</p>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete this lesson
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-300 flex-1">
                        This will permanently delete "{lesson.title}" and all its nodes, progress, and notes.
                      </p>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800/80 shrink-0">
            <button
              onClick={onClose}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Close
            </button>
            {tab === 'edit' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-clay-500/15 hover:bg-clay-500/25 text-clay-300 border border-clay-500/20 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save changes
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

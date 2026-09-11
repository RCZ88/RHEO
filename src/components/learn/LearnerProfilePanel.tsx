import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, RefreshCw, Plus, Pencil, Trash2, BookOpen, Maximize2, Minimize2, Brain } from 'lucide-react';
import { loadProfile, saveProfile, updateKnob, resetProfile, addKnowledgeEntry, updateKnowledgeEntry, removeKnowledgeEntry, loadUserLessons } from '../../services/learn/learnerProfile';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import { PROFILE_KNOBS } from '../../shared/learn/types';
import { ImageGenSettings } from './ImageGenSettings';
import { KnowledgeIntakePanel } from './KnowledgeIntakePanel';
import type { LearnerProfile, ProfileKnob, MasteryLevel, KnowledgeEntry } from '../../shared/learn/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onRerunSetup: () => void;
}

const KNOB_LABELS: Record<ProfileKnob, { label: string; options: string[] }> = {
  density: { label: 'Density', options: ['terse', 'balanced', 'thorough'] },
  modalityBias: { label: 'Modality', options: ['diagram_first', 'balanced', 'text_ok'] },
  exampleStance: { label: 'Examples', options: ['worked_first', 'balanced', 'discovery_first'] },
  mathDepth: { label: 'Math depth', options: ['applied_only', 'intuition_first', 'derive_everything'] },
  handsOn: { label: 'Hands-on', options: ['0', '1', '2', '3'] },
  codeStagingDepth: { label: 'Code staging', options: ['framework_only', 'numpy_plus', 'scratch_first'] },
  quizAppetite: { label: 'Quiz appetite', options: ['light', 'normal', 'heavy'] },
  chunkSize: { label: 'Session size', options: ['micro', 'standard', 'deep'] },
  layerRevealDefault: { label: 'Layer reveal', options: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] },
  tone: { label: 'Tone', options: ['gentle', 'balanced', 'demanding'] },
};

export function LearnerProfilePanel({ open, onClose, onRerunSetup }: Props) {
  const [profile, setProfile] = useState<LearnerProfile>(loadProfile);
  const [userLessons, setUserLessons] = useState<{ titles: string[]; parts: number[] }>({ titles: [], parts: [] });
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('lyceum.profileExpanded') !== 'false'; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem('lyceum.profileExpanded', String(expanded)); } catch { /* ignore */ }
  }, [expanded]);

  useEffect(() => {
    if (open) {
      setProfile(loadProfile());
      loadUserLessons().then(setUserLessons).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setProfile(detail);
    };
    window.addEventListener('lyceum:profile-changed', handler);
    return () => window.removeEventListener('lyceum:profile-changed', handler);
  }, []);

  const handleKnobChange = (knob: ProfileKnob, value: string | number) => {
    const updated = updateKnob(knob, value as any, 0.6);
    setProfile(updated);
  };

  const handleReset = () => {
    if (confirm('Reset all profile settings to defaults?')) {
      resetProfile();
      setProfile(loadProfile());
    }
  };

  // ── Knowledge Base state ──

  interface KbForm {
    mode: 'add' | 'edit';
    id?: string;
    statement: string;
    topic: string;
    linkedLessons: string[];
    keywords: string;
    level: MasteryLevel | '';
  }

  const emptyKbForm = (): KbForm => ({ mode: 'add', statement: '', topic: '', linkedLessons: [], keywords: '', level: '' });
  const [kbForm, setKbForm] = useState<KbForm>(emptyKbForm);
  const [kbDirty, setKbDirty] = useState(false);

  const openKbAdd = () => { setKbForm(emptyKbForm()); setKbDirty(true); };
  const openKbEdit = (e: KnowledgeEntry) => {
    setKbForm({ mode: 'edit', id: e.id, statement: e.statement, topic: e.topic ?? '', linkedLessons: e.linkedLessons ?? [], keywords: (e.keywords ?? []).join(', '), level: e.level ?? '' });
    setKbDirty(true);
  };
  const closeKbForm = () => { setKbDirty(false); setKbForm(emptyKbForm()); };

  const toggleKbLesson = (title: string) => {
    setKbForm((f) => ({
      ...f,
      linkedLessons: f.linkedLessons.includes(title) ? f.linkedLessons.filter((t) => t !== title) : [...f.linkedLessons, title],
    }));
  };

  const submitKb = () => {
    const statement = kbForm.statement.trim();
    if (!statement) return;
    const input = {
      statement,
      topic: kbForm.topic.trim() || undefined,
      linkedLessons: kbForm.linkedLessons.length ? kbForm.linkedLessons : undefined,
      keywords: kbForm.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      level: kbForm.level || undefined,
    };
    const updated = kbForm.mode === 'edit' && kbForm.id
      ? updateKnowledgeEntry(kbForm.id, input)
      : addKnowledgeEntry(input);
    setProfile(updated);
    closeKbForm();
  };

  const deleteKb = (entry: KnowledgeEntry) => {
    if (!confirm(`Remove "${entry.statement.slice(0, 60)}…" from your knowledge?`)) return;
    const updated = removeKnowledgeEntry(entry.id);
    setProfile(updated);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`${expanded ? 'w-full max-w-none' : 'w-80'} h-full bg-zinc-900 border-l border-zinc-700/50 overflow-y-auto transition-all duration-300`}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900">
            <h2 className="font-serif text-lg font-semibold text-zinc-100">Your Profile</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setExpanded(!expanded)} className="text-zinc-500 hover:text-zinc-300 transition p-1" title={expanded ? 'Collapse' : 'Expand'}>
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className={`p-5 space-y-6 ${expanded ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-min' : ''}`}>
            {/* Knobs */}
            {PROFILE_KNOBS.map((knob) => {
              const meta = KNOB_LABELS[knob];
              const val = String(profile[knob]);
              const conf = profile.confidence[knob] ?? 0.3;
              return (
                <div key={knob}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-zinc-300">{meta.label}</span>
                    <span className="font-mono text-[10px] text-zinc-600">{conf >= 0.5 ? 'set by you' : 'learning from behavior'}</span>
                  </div>
                  <div className="flex gap-1">
                    {meta.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleKnobChange(knob, knob === 'handsOn' ? Number(opt) : opt)}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition border ${val === opt ? 'bg-clay-500/20 text-clay-300 border-clay-400/30' : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30 hover:text-zinc-300'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {/* Confidence bar */}
                  <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-clay-400 transition-all" style={{ width: `${conf * 100}%` }} />
                  </div>
                </div>
              );
            })}

            {/* Prior knowledge */}
            <div>
              <h3 className="text-xs font-medium text-zinc-300 mb-3">Prior Knowledge</h3>
              {userLessons.parts.length === 0 ? (
                <p className="text-[10px] text-zinc-600 leading-relaxed bg-zinc-800/30 border border-dashed border-zinc-700/40 rounded-lg px-3 py-2">
                  Topics appear here as you create lessons in the library.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {userLessons.parts.map((partNum) => {
                    const levels: MasteryLevel[] = ['L0', 'L2', 'L3', 'L4'];
                    const level = (profile.priorKnowledge as any)?.[partNum] ?? 'L0';
                    const labels: Record<string, string> = { L0: 'New', L2: 'Some', L3: 'Solid', L4: 'Teach' };
                    const colors: Record<string, string> = { L0: 'bg-zinc-700/50 text-zinc-500', L2: 'bg-clay-500/15 text-clay-400', L3: 'bg-sage-500/15 text-sage-400', L4: 'bg-amber-500/15 text-amber-400' };
                    const lessonTitle = userLessons.titles[userLessons.parts.indexOf(partNum)] ?? `Part ${partNum}`;
                    const cycle = () => {
                      const cur = levels.indexOf(level ?? 'L0');
                      const next = levels[(cur + 1) % levels.length];
                      const updated = { ...(profile.priorKnowledge ?? {}), [partNum]: next };
                      setProfile({ ...profile, priorKnowledge: updated } as any);
                      saveProfile({ ...profile, priorKnowledge: updated } as any);
                    };
                    return (
                      <button
                        key={partNum}
                        onClick={cycle}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition ${colors[level ?? 'L0'] ?? colors.L0}`}
                      >
                        <BookOpen className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[80px]">{lessonTitle}</span>
                        <span className="font-mono text-[8px] opacity-60">{labels[level ?? 'L0'] ?? 'New'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Knowledge Base */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-clay-400" />
                  Knowledge Base
                </h3>
                <button
                  onClick={kbDirty && kbForm.mode === 'add' ? closeKbForm : openKbAdd}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-clay-300 bg-clay-500/10 border border-clay-500/20 hover:bg-clay-500/20 transition"
                >
                  {kbDirty && kbForm.mode === 'add' ? <><X className="w-3 h-3" />Cancel</> : <><Plus className="w-3 h-3" />Add</>}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 leading-relaxed mb-3">
                Things you already know, in your own words. Lesson prompts use ONLY entries related to the topic — never everything.
              </p>

              {(profile.knowledgeBase ?? []).length === 0 && !kbDirty && (
                <div className="text-[11px] text-zinc-600 italic py-3 px-3 rounded-lg bg-zinc-800/30 border border-dashed border-zinc-700/40">
                  Nothing recorded yet. Add what you know so lessons build on it.
                </div>
              )}

              {/* Add/Edit form */}
              <AnimatePresence>
                {kbDirty && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2.5 rounded-xl border border-zinc-700/40 bg-zinc-800/30 p-3">
                      <div>
                        <label className="block text-[10px] font-medium text-zinc-500 mb-1">What do you know? <span className="text-clay-400">*</span>
                          <FieldAIButton
                            fieldName="statement"
                            label="Knowledge Statement"
                            value={kbForm.statement}
                            onUpdate={(v) => setKbForm((f) => ({ ...f, statement: v }))}
                            allFields={{ statement: kbForm.statement, topic: kbForm.topic, level: kbForm.level, keywords: kbForm.keywords }}
                            category="learn"
                            context="Help articulate what the user knows about a topic"
                          />
                        </label>
                        <textarea
                          value={kbForm.statement}
                          onChange={(e) => setKbForm((f) => ({ ...f, statement: e.target.value }))}
                          placeholder="e.g. I can implement gradient descent in NumPy and understand backpropagation end-to-end."
                          className="w-full px-2.5 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-200 text-[11px] leading-relaxed focus:outline-none focus:border-clay-500/40 focus:ring-2 focus:ring-clay-500/10 resize-y placeholder:text-zinc-600 min-h-[64px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] font-medium text-zinc-500 mb-1">Topic (optional)
                            <FieldAIButton
                              fieldName="topic"
                              label="Topic"
                              value={kbForm.topic}
                              onUpdate={(v) => setKbForm((f) => ({ ...f, topic: v }))}
                              allFields={{ statement: kbForm.statement, topic: kbForm.topic, level: kbForm.level, keywords: kbForm.keywords }}
                              category="learn"
                              context="Categorize this knowledge entry"
                            />
                          </label>
                          <input
                            value={kbForm.topic}
                            onChange={(e) => setKbForm((f) => ({ ...f, topic: e.target.value }))}
                            placeholder="e.g. Deep Learning"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-200 text-[11px] focus:outline-none focus:border-clay-500/40 placeholder:text-zinc-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-zinc-500 mb-1">Level</label>
                          <select
                            value={kbForm.level}
                            onChange={(e) => setKbForm((f) => ({ ...f, level: e.target.value as MasteryLevel | '' }))}
                            className="px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-300 text-[11px] focus:outline-none focus:border-clay-500/40"
                          >
                            <option value="">—</option>
                            {(['L1', 'L2', 'L3', 'L4', 'L5'] as MasteryLevel[]).map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-zinc-500 mb-1">Keywords (comma-separated, for relevance)
                          <FieldAIButton
                            fieldName="keywords"
                            label="Keywords"
                            value={kbForm.keywords}
                            onUpdate={(v) => setKbForm((f) => ({ ...f, keywords: v }))}
                            allFields={{ statement: kbForm.statement, topic: kbForm.topic, level: kbForm.level, keywords: kbForm.keywords }}
                            category="learn"
                            context="Extract relevant keywords from this knowledge statement"
                          />
                        </label>
                        <input
                          value={kbForm.keywords}
                          onChange={(e) => setKbForm((f) => ({ ...f, keywords: e.target.value }))}
                          placeholder="gradient descent, backprop, neural nets"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-700/50 text-zinc-200 text-[11px] focus:outline-none focus:border-clay-500/40 placeholder:text-zinc-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-zinc-500 mb-1">Your lessons</label>
                        {userLessons.titles.length === 0 ? (
                          <p className="text-[10px] text-zinc-600 bg-zinc-900/40 border border-zinc-700/30 rounded-lg px-2.5 py-2">
                            No lessons yet — this entry will relate to every topic until you create lessons and tag them.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {userLessons.titles.map((title) => (
                              <button
                                key={title}
                                onClick={() => toggleKbLesson(title)}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition border ${
                                  kbForm.linkedLessons.includes(title)
                                    ? 'bg-clay-500/15 text-clay-300 border-clay-500/30'
                                    : 'bg-zinc-900/40 text-zinc-500 border-zinc-700/30 hover:text-zinc-300'
                                }`}
                              >
                                {title.slice(0, 22)}{title.length > 22 ? '…' : ''}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          onClick={closeKbForm}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitKb}
                          disabled={!kbForm.statement.trim()}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-clay-300 bg-clay-500/15 border border-clay-500/25 hover:bg-clay-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {kbForm.mode === 'edit' ? 'Save changes' : 'Add to knowledge'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Entry list */}
              {(profile.knowledgeBase ?? []).length > 0 && (
                <div className="space-y-1.5 mt-1">
                  {(profile.knowledgeBase ?? []).map((e) => (
                    <div key={e.id} className="group rounded-lg border border-zinc-800/70 bg-zinc-800/20 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-zinc-300 leading-relaxed flex-1">{e.statement}</p>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => openKbEdit(e)} className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/40 transition" title="Edit">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteKb(e)} className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {e.topic && <span className="px-1.5 py-0.5 rounded bg-zinc-700/40 text-[9px] text-zinc-400">{e.topic}</span>}
                        {e.level && <span className="px-1.5 py-0.5 rounded bg-sage-500/10 text-[9px] text-sage-400 font-mono">{e.level}</span>}
                        {(e.linkedLessons ?? []).map((t) => <span key={t} className="px-1.5 py-0.5 rounded bg-clay-500/10 text-[9px] text-clay-400">{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Image Generation Settings */}
            <div className="pt-4 border-t border-zinc-800">
              <ImageGenSettings />
            </div>

            {/* Knowledge Intake System */}
            <div className="pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-300 mb-3 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-clay-400" />
                Knowledge Intake
              </h3>
              <p className="text-[10px] text-zinc-600 leading-relaxed mb-3">
                Import what you know from surveys, chat transcripts, or topic-focused extraction.
              </p>
              <KnowledgeIntakePanel
                profile={profile}
                onProfileUpdate={(updated) => setProfile(updated)}
              />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <button
                onClick={() => {
                  if (confirm('Open the setup wizard to adjust your answers? Your profile, prior knowledge and knowledge base are kept and pre-filled.')) {
                    onClose();
                    onRerunSetup();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-clay-500/15 hover:bg-clay-500/25 text-clay-300 text-sm transition border border-clay-400/20"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Adjust setup answers
              </button>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 text-sm transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

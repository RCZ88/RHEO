import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Copy,
  Check,
  FileText,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Wand2,
  Paperclip,
  X,
  AlignLeft,
  List,
  Lightbulb,
  BookOpen,
  Plus,
  BookMarked,
  Upload,
  ImageIcon,
  Search,
  Settings,
  Database,
  ExternalLink,
  Brain,
} from 'lucide-react';
import { ResourceInput, type Resource } from './ResourceInput';
import { BookCard } from './BookCard';
import { BulkAIFill } from '../../features/content-engine/components/BulkAIFill';
import type { LessonSummary } from '../../shared/learn/types';

const api = (window as any).deskflowAPI;

type Step = 'input' | 'prompt' | 'result';
type GenStatus = 'idle' | 'generating' | 'done' | 'error';
type InputMode = 'simple' | 'detailed';
type KnowledgeMode = 'auto' | 'select' | 'intake';

const STEPS = ['Describe', 'Prompt', 'Lesson'] as const;

function StepIndicator({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <motion.span
                animate={{ scale: active ? 1 : 0.85, opacity: active || done ? 1 : 0.5 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className={
                  'flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-semibold ' +
                  (active
                    ? 'bg-clay-500/15 text-clay-300 ring-1 ring-clay-500/40'
                    : done
                    ? 'bg-sage-400/10 text-sage-300'
                    : 'bg-zinc-800/60 text-zinc-500')
                }
              >
                {done ? '\u2713' : i + 1}
              </motion.span>
              <span className={`text-xs font-medium ${active ? 'text-zinc-200' : 'text-zinc-500'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-zinc-700/60" />}
          </div>
        );
      })}
    </div>
  );
}

const PHASES = ['Building prompt', 'Generating lesson', 'Validating', 'Importing'] as const;

function GenerationProgress({ phase }: { phase: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {PHASES.map((p, i) => {
        const state = i < phase ? 'done' : i === phase ? 'active' : 'pending';
        return (
          <div key={p} className="flex items-center gap-3">
            <span
              className={
                'flex h-5 w-5 items-center justify-center rounded-md text-[10px] ' +
                (state === 'done'
                  ? 'bg-sage-400/10 text-sage-300'
                  : state === 'active'
                  ? 'bg-clay-500/15 text-clay-300'
                  : 'bg-zinc-800/60 text-zinc-600')
              }
            >
              {state === 'done' ? '\u2713' : state === 'active' ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
                  className="block h-2.5 w-2.5 rounded-full border border-clay-300 border-t-transparent"
                />
              ) : i + 1}
            </span>
            <span className={`text-sm ${state === 'pending' ? 'text-zinc-600' : 'text-zinc-300'}`}>{p}</span>
          </div>
        );
      })}
    </div>
  );
}

interface KBEntry {
  statement: string;
  level?: string;
  topic?: string;
  keywords?: string[];
}

function KnowledgeBaseSelector({
  topic,
  selectedEntries,
  onSelectionChange,
  knowledgeMode,
  onModeChange,
}: {
  topic: string;
  selectedEntries: Set<number>;
  onSelectionChange: (s: Set<number>) => void;
  knowledgeMode: KnowledgeMode;
  onModeChange: (m: KnowledgeMode) => void;
}) {
  const [allEntries, setAllEntries] = useState<KBEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!api?.learnGetProfile) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.learnGetProfile({ key: 'lyceum.learnerProfile.v1' });
        if (res?.ok && res.value) {
          const profile = JSON.parse(res.value);
          if (!cancelled) setAllEntries(profile.knowledgeBase ?? []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const matchScores = useMemo(() => {
    if (!topic || topic.length < 5) return allEntries.map(() => 0);
    const tokens = topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return allEntries.map(e => {
      const text = `${e.statement} ${e.topic || ''} ${(e.keywords || []).join(' ')}`.toLowerCase();
      return tokens.filter(t => text.includes(t)).length;
    });
  }, [allEntries, topic]);

  const filtered = useMemo(() => {
    if (!search) return allEntries.map((e, i) => ({ ...e, idx: i }));
    const q = search.toLowerCase();
    return allEntries.map((e, i) => ({ ...e, idx: i })).filter(e =>
      e.statement.toLowerCase().includes(q) || (e.topic || '').toLowerCase().includes(q)
    );
  }, [allEntries, search]);

  const matchedEntries = useMemo(() => {
    return filtered.filter(e => matchScores[e.idx] > 0).sort((a, b) => matchScores[b.idx] - matchScores[a.idx]);
  }, [filtered, matchScores]);

  const unmatchedEntries = useMemo(() => {
    return filtered.filter(e => matchScores[e.idx] === 0);
  }, [filtered, matchScores]);

  const toggleEntry = (idx: number) => {
    const next = new Set(selectedEntries);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onSelectionChange(next);
  };

  const selectAllMatched = () => {
    const next = new Set(selectedEntries);
    matchedEntries.forEach(e => next.add(e.idx));
    onSelectionChange(next);
  };

  const clearSelection = () => onSelectionChange(new Set());

  if (allEntries.length === 0 && !loading) return null;

  const modes: { key: KnowledgeMode; label: string; desc: string }[] = [
    { key: 'auto', label: 'Auto-match', desc: 'AI picks relevant entries' },
    { key: 'select', label: 'Select entries', desc: 'You choose what to include' },
  ];

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-800/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-300">Knowledge Base</span>
          <span className="text-[10px] text-zinc-500">{allEntries.length} entries</span>
          {selectedEntries.size > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{selectedEntries.size} selected</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 px-3 py-2 border-b border-zinc-800/30">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition ${
              knowledgeMode === m.key
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            <div>{m.label}</div>
            <div className="text-[9px] font-normal opacity-70">{m.desc}</div>
          </button>
        ))}
      </div>

      {expanded && (
        <div className="p-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search knowledge base..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/40 placeholder:text-zinc-600"
            />
          </div>

          {/* Quick actions */}
          {knowledgeMode === 'select' && (
            <div className="flex gap-1.5">
              <button onClick={selectAllMatched} className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition">
                Select all matched ({matchedEntries.length})
              </button>
              <button onClick={clearSelection} className="text-[10px] px-2 py-1 rounded bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 transition">
                Clear
              </button>
            </div>
          )}

          {/* Matched entries */}
          {matchedEntries.length > 0 && (
            <div>
              <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider mb-1.5">Matched ({matchedEntries.length})</p>
              <div className="space-y-1">
                {matchedEntries.map(e => (
                  <label
                    key={e.idx}
                    className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition text-[11px] ${
                      knowledgeMode === 'select' && selectedEntries.has(e.idx)
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    {knowledgeMode === 'select' && (
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(e.idx)}
                        onChange={() => toggleEntry(e.idx)}
                        className="mt-0.5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30"
                      />
                    )}
                    <span className="text-zinc-300 flex-1">{e.statement}</span>
                    {e.level && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-500 shrink-0">{e.level}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched entries */}
          {unmatchedEntries.length > 0 && knowledgeMode === 'select' && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Other entries ({unmatchedEntries.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {unmatchedEntries.map(e => (
                  <label
                    key={e.idx}
                    className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition text-[11px] ${
                      selectedEntries.has(e.idx)
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'hover:bg-zinc-800/40 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntries.has(e.idx)}
                      onChange={() => toggleEntry(e.idx)}
                      className="mt-0.5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30"
                    />
                    <span className="text-zinc-400 flex-1">{e.statement}</span>
                    {e.level && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-500 shrink-0">{e.level}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {matchedEntries.length === 0 && unmatchedEntries.length === 0 && !loading && (
            <p className="text-[11px] text-zinc-500 text-center py-2">
              {search ? 'No entries match your search' : 'No knowledge base entries found. Add entries in your Profile.'}
            </p>
          )}
        </div>
      )}

      {/* Compact summary when collapsed */}
      {!expanded && topic.length >= 10 && (
        <div className="px-3 py-2">
          {matchedEntries.length > 0 ? (
            <p className="text-[10px] text-emerald-400/80">
              {matchedEntries.length} related {matchedEntries.length === 1 ? 'entry' : 'entries'} found
              {knowledgeMode === 'select' && selectedEntries.size > 0 && ` — ${selectedEntries.size} selected`}
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">No related entries. Lesson will be generated from scratch.</p>
          )}
        </div>
      )}
    </div>
  );
}

export interface LessonSeed {
  part: number;
  title: string;
  scope: string[];
  topicPrompt: string;
}

function PromptSectionPreview({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  if (!prompt) return null;

  // Parse sections from the prompt
  const sections: { label: string; content: string }[] = [];
  const lines = prompt.split('\n');
  let current = { label: 'System Instructions', content: '' };
  for (const line of lines) {
    const headerMatch = line.match(/^---\s*$/);
    const sectionMatch = line.match(/^## (.+)/);
    const titleMatch = line.match(/^# (.+)/);
    if (sectionMatch || titleMatch || headerMatch) {
      if (current.content.trim()) sections.push(current);
      current = { label: (sectionMatch?.[1] || titleMatch?.[1] || '---').trim(), content: '' };
    } else {
      current.content += line + '\n';
    }
  }
  if (current.content.trim()) sections.push(current);

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <List className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">Prompt Sections ({sections.length} found)</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-zinc-800/50 px-4 py-3 space-y-2 max-h-64 overflow-auto">
          {sections.map((s, i) => {
            const preview = s.content.trim().slice(0, 200);
            const lines = s.content.trim().split('\n').length;
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-mono text-clay-400/80 shrink-0 mt-0.5 min-w-[100px]">{s.label}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{preview}{preview.length < s.content.trim().length ? '...' : ''}</p>
                  <span className="text-[9px] text-zinc-600">{lines} lines</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CreateLessonDialog({
  open,
  onClose,
  onImported,
  seed,
  onBrowseSavedIdeas,
  onOpenLesson,
  savedIntentConfig,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  seed?: LessonSeed | null;
  onBrowseSavedIdeas?: () => void;
  onOpenLesson?: (id: string) => void;
  savedIntentConfig?: Record<string, any> | null;
}) {
  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<InputMode>('simple');
  const [userInput, setUserInput] = useState('');
  const [description, setDescription] = useState('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [numNodes, setNumNodes] = useState(5);
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedAssess, setCopiedAssess] = useState(false);
  const [genStatus, setGenStatus] = useState<GenStatus>('idle');
  const [genError, setGenError] = useState('');
  const [genResult, setGenResult] = useState<any>(null);
  const [building, setBuilding] = useState(false);
  const [validPrompt, setValidPrompt] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const [saved, setSaved] = useState(false);
  const [knowledgeUsed, setKnowledgeUsed] = useState<any>(null);
  const [chapterChoice, setChapterChoice] = useState('');
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [externalPaste, setExternalPaste] = useState('');
  const [externalImporting, setExternalImporting] = useState(false);
  const [externalImportError, setExternalImportError] = useState('');
  const [externalImportSuccess, setExternalImportSuccess] = useState('');
  const [createdLesson, setCreatedLesson] = useState<LessonSummary | null>(null);
  const [selectedKBEntries, setSelectedKBEntries] = useState<Set<number>>(new Set());
  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>('auto');
  const [lessonSize, setLessonSize] = useState<'compact' | 'standard' | 'comprehensive' | 'dynamic'>('dynamic');
  const [knowledgeContext, setKnowledgeContext] = useState('');
  const [focusArea, setFocusArea] = useState('balanced');
  const [depthLevel, setDepthLevel] = useState('adaptive');
  const [lessonStyle, setLessonStyle] = useState('standard');
  const [learnerContext, setLearnerContext] = useState('');

  // Auto-retrieve learner progress on open — topic-specific knowledge assessment
  useEffect(() => {
    if (!open) return;
    const topic = (inputMode === 'simple' ? userInput : description).trim();
    if (topic.length < 5) return;
    (async () => {
      try {
        const [profileRes, progressRes] = await Promise.all([
          api?.learnGetProfile?.({ key: 'lyceum.learnerProfile.v1' }),
          api?.learnGetProgress?.({}),
        ]);
        const parts: string[] = [];
        if (profileRes?.ok && profileRes.value) {
          const profile = JSON.parse(profileRes.value);
          // Find KB entries related to THIS topic
          const tokens = topic.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
          const relatedKB = (profile.knowledgeBase ?? []).filter((e: any) => {
            const text = `${e.statement} ${e.topic || ''} ${(e.keywords || []).join(' ')}`.toLowerCase();
            return tokens.some((t: string) => text.includes(t));
          });
          if (relatedKB.length > 0) {
            parts.push(`KNOWN about "${topic}":`);
            relatedKB.forEach((e: any) => parts.push(`  - ${e.statement}${e.level ? ` [${e.level}]` : ''}`));
          } else {
            parts.push(`KNOWN about "${topic}": Nothing in knowledge base — this is a new topic for the learner.`);
          }
          // Find completed nodes related to this topic
          if (progressRes?.ok && progressRes.data?.length) {
            const completed = progressRes.data.filter((p: any) => p.level && p.level !== 'L0');
            if (completed.length > 0) {
              parts.push(`COMPLETED ${completed.length} nodes total. Mastery: ${completed.slice(0, 8).map((p: any) => `${p.node_id}=${p.level}`).join(', ')}`);
            } else {
              parts.push(`COMPLETED: No nodes completed yet — this is the learner's first lesson.`);
            }
          }
          if (profile.currentLevel) parts.push(`Overall level: ${profile.currentLevel}`);
        }
        if (parts.length > 0) {
          setLearnerContext(parts.join('\n'));
        }
      } catch { /* ignore */ }
    })();
  }, [open, userInput, description, inputMode]);

  useEffect(() => {
    if (open) {
      setSaved(false);
      setCreatedLesson(null);
      setChapterChoice('');
      setChapterPickerOpen(false);
      setNewGroupName('');
      if (seed) {
        setInputMode('simple');
        setDescription(seed.title);
        setUserInput(`I want to learn about ${seed.title}. The key areas are:\n${seed.scope.map((s) => `- ${s}`).join('\n')}`);
        if (seed.topicPrompt) {
          setResources([{ id: 'res-seed', type: 'text', content: `Curriculum brief:\n${seed.topicPrompt}` }]);
        }
      }
      loadGroups();
    } else {
      setStep('input');
      setInputMode('simple');
      setUserInput('');
      setDescription('');
      setResources([]);
      setPrompt('');
      setCopied(false);
      setGenStatus('idle');
      setGenError('');
      setGenResult(null);
      setValidPrompt(false);
      setGenPhase(0);
      setKnowledgeUsed(null);
      setChapterChoice('');
      setAvailableGroups([]);
    }
  }, [open, seed]);

  // Restore config from saved intent when loading a draft
  useEffect(() => {
    if (open && savedIntentConfig && !seed) {
      const c = savedIntentConfig;
      if (c.inputMode) setInputMode(c.inputMode);
      if (c.selectedKBEntries) setSelectedKBEntries(new Set(c.selectedKBEntries));
      if (c.knowledgeMode) setKnowledgeMode(c.knowledgeMode);
      if (c.lessonSize) setLessonSize(c.lessonSize);
      if (c.focusArea) setFocusArea(c.focusArea);
      if (c.depthLevel) setDepthLevel(c.depthLevel);
      if (c.lessonStyle) setLessonStyle(c.lessonStyle);
      if (c.numNodes) setNumNodes(c.numNodes);
      if (c.chapterChoice) setChapterChoice(c.chapterChoice);
    }
  }, [open, savedIntentConfig, seed]);

  const canBuildSimple = userInput.trim().length >= 10 && !building;
  const canBuildDetailed = description.trim().length >= 3 && !building;
  const canBuild = inputMode === 'simple' ? canBuildSimple : canBuildDetailed;

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const [customRes, existingRes] = await Promise.all([
        api.learnGetProfile({ key: 'lyceum.learnerProfile.v1' }),
        api.learnListChapters({}),
      ]);
      const custom = customRes?.ok ? JSON.parse(customRes.value || '{}').customChapters ?? [] : [];
      const existing = existingRes.ok ? (existingRes.data ?? []) : [];
      const all = Array.from(new Set([...custom, ...existing])).sort();
      setAvailableGroups(all);
    } catch {
      setAvailableGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const res = await api.learnGetProfile({ key: 'lyceum.learnerProfile.v1' });
      if (res?.ok) {
        const profile = JSON.parse(res.value || '{}');
        const cur = profile.customChapters ?? [];
        if (!cur.includes(name)) {
          profile.customChapters = [...cur, name];
          await api.learnSetProfile({ key: 'lyceum.learnerProfile.v1', value: JSON.stringify(profile) });
        }
      }
      setAvailableGroups((prev) => Array.from(new Set([...prev, name])).sort());
      setChapterChoice(name);
      setNewGroupName('');
      setChapterPickerOpen(false);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleBuildPrompt = async () => {
    if (!canBuild) return;
    setBuilding(true);
    try {
      const selectedIndices = knowledgeMode === 'select' ? Array.from(selectedKBEntries) : undefined;
      const sizeMap = { compact: 3, standard: 5, comprehensive: 8, dynamic: undefined };
      const effectiveNumNodes = lessonSize === 'dynamic' ? (numNodes > 0 ? numNodes : undefined) : sizeMap[lessonSize];
      const contextDoc = [...resources.map(r => r.content), knowledgeContext].filter(Boolean).join('\n\n---\n\n');
      const params = inputMode === 'simple'
        ? { userInput: userInput.trim(), contextDoc: contextDoc || undefined, chapter: chapterChoice || undefined, selectedKBIndices: selectedIndices, knowledgeMode, lessonSize, numNodes: effectiveNumNodes, focusArea, depthLevel, lessonStyle, learnerContext: learnerContext || undefined }
        : { topic: description.trim(), description: description.trim(), contextDoc: contextDoc || undefined, numNodes: effectiveNumNodes, chapter: chapterChoice || undefined, selectedKBIndices: selectedIndices, knowledgeMode, lessonSize, focusArea, depthLevel, lessonStyle, learnerContext: learnerContext || undefined };
      const result = await api.learnBuildPrompt(params);
      if (result.ok) {
        setPrompt(result.prompt);
        setSystemPrompt(result.systemPrompt);
        setKnowledgeUsed(result.knowledgeUsed ?? null);
        setStep('prompt');
        setValidPrompt(true);
      } else {
        setGenError(result.error || 'Failed to build prompt');
        setGenStatus('error');
      }
    } catch (e: any) {
      setGenError(e.message);
      setGenStatus('error');
    } finally {
      setBuilding(false);
    }
  };

  const handleAssessKnowledge = async () => {
    const topic = (inputMode === 'simple' ? userInput : description).trim();
    if (!topic || topic.length < 3) return;
    try {
      const result = await api.learnGetKnowledgeAssessmentPrompt({ topic });
      if (result.ok && result.data) {
        await navigator.clipboard.writeText(result.data);
        setCopiedAssess(true);
        setTimeout(() => setCopiedAssess(false), 2000);
      }
    } catch (e) {
      console.error('[CreateLessonDialog] Failed to copy assessment prompt:', e);
    }
  };

   const handleCopy = async () => {
     if (!prompt) return;
     try {
       await navigator.clipboard.writeText(prompt);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     } catch (e) {
       console.error('[CreateLessonDialog] Copy failed:', e);
     }
   };

  const handleDownload = () => {
    const blob = new Blob([prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const text = inputMode === 'simple' ? userInput.trim() : description.trim();
    const slug = text.toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    a.download = `lyceum-prompt-${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExternalImport = async () => {
    setExternalImporting(true);
    setExternalImportError('');
    setExternalImportSuccess('');
    try {
      const text = externalPaste.trim();
      if (!text) { setExternalImportError('Paste some content first'); setExternalImporting(false); return; }
      const result = await api.learnImportLdoc({ source: text });
      if (result.ok) {
        setExternalImportSuccess('Lesson imported!');
        onImported();
        const lessonId = (result.data as any)?.lessonId;
        if (lessonId) {
          const summary = await fetchLessonSummary(lessonId);
          if (summary) setCreatedLesson(summary);
        }
        setStep('result');
      } else {
        setExternalImportError(result.error || 'Import failed');
      }
    } catch (e: any) {
      setExternalImportError(e.message || 'Import failed');
    }
    setExternalImporting(false);
  };

  const handleExternalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExternalImporting(true);
    setExternalImportError('');
    setExternalImportSuccess('');
    try {
      const text = await file.text();
      const result = await api.learnImportLdoc({ source: text });
      if (result.ok) {
        setExternalImportSuccess('Lesson imported!');
        onImported();
        const lessonId = (result.data as any)?.lessonId;
        if (lessonId) {
          const summary = await fetchLessonSummary(lessonId);
          if (summary) setCreatedLesson(summary);
        }
        setStep('result');
      } else {
        setExternalImportError(result.error || 'Import failed');
      }
    } catch (e: any) {
      setExternalImportError(e.message || 'Failed to read file');
    }
    setExternalImporting(false);
    e.target.value = '';
  };

  const handleExternalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExternalImporting(true);
    setExternalImportError('');
    setExternalImportSuccess('');
    try {
      const result = await api.learnUploadIllustration({
        lessonId: 'general',
        filename: file.name,
      });
      if (result.ok && result.data?.imagePath) {
        setExternalImportSuccess(`Image saved: ${result.data.imagePath}`);
      } else {
        setExternalImportError(result.error || 'Upload failed');
      }
    } catch (e: any) {
      setExternalImportError(e.message || 'Upload failed');
    }
    setExternalImporting(false);
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setContextDoc(reader.result as string);
    reader.readAsText(file);
  };

  const handleClearFile = () => {
    setContextDoc('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveForLater = async () => {
    const title = inputMode === 'simple'
      ? userInput.trim().slice(0, 80)
      : description.trim();
    if (!title) return;
    try {
      const context = resources.map(r => r.content).join('\n\n---\n\n');
      await api.learnSaveIntent({
        title,
        description: inputMode === 'simple' ? userInput.trim() : description.trim(),
        context: context || undefined,
        category: seed ? 'curriculum' : 'idea',
        knowledgeContext: learnerContext || undefined,
        config: {
          inputMode,
          selectedKBEntries: Array.from(selectedKBEntries),
          knowledgeMode,
          lessonSize,
          focusArea,
          depthLevel,
          lessonStyle,
          numNodes,
          chapterChoice,
        },
      });
      setSaved(true);
    } catch (e: any) {
      console.error('[CreateLessonDialog] Save failed:', e);
    }
  };

  const fetchLessonSummary = async (lessonId: string): Promise<LessonSummary | null> => {
    try {
      const res = await api.learnListLessons();
      const list: LessonSummary[] = res?.ok ? (res.data ?? []) : [];
      return list.find((l) => String(l.id) === String(lessonId)) ?? null;
    } catch {
      return null;
    }
  };

  const handleOpenLesson = (id: string) => {
    if (onOpenLesson) onOpenLesson(id);
    else { onClose(); onImported(); }
  };

  const handleGenerate = async () => {
    if (!validPrompt) return;
    setGenStatus('generating');
    setGenError('');
    setGenResult(null);
    setGenPhase(0);
    try {
      setGenPhase(1);
      await new Promise(r => setTimeout(r, 300));
      setGenPhase(2);
      const result = await api.learnGenerateLdoc({ prompt, systemPrompt });
      setGenPhase(3);
      await new Promise(r => setTimeout(r, 200));
      if (result.ok && result.data?.lessonId) {
        if (chapterChoice) {
          try {
            await api.learnUpdateLessonMeta({ lessonId: result.data.lessonId, chapter: chapterChoice });
          } catch { /* non-fatal, chapter already in prompt */ }
        }
        setGenStatus('done');
        setGenResult(result);
        onImported();
        const summary = await fetchLessonSummary(result.data.lessonId);
        if (summary) setCreatedLesson(summary);
        setStep('result');

        // Save clarification Q&A as tagged notes on the first node
        const qaPairs = clarificationQuestions
          .map((q, i) => ({ q, a: clarificationAnswers[i]?.trim() }))
          .filter((pair) => pair.a);
        if (qaPairs.length > 0 && result.data?.nodes?.length) {
          const firstNodeId = result.data.nodes[0].id;
          try {
            for (const pair of qaPairs) {
              await api.learnAddNote({
                nodeId: firstNodeId,
                text: `**Q:** ${pair.q}\n\n**A:** ${pair.a}`,
                tags: ['clarification'],
                blockRef: 'clarification',
              });
            }
          } catch { /* non-critical */ }
        }
      } else {
        setGenStatus('error');
        setGenError(result.error || 'Generation failed');
        if (result.validation) {
          const issues = (result.validation.errors || []).map((e: any) => e.message || e.rule).join('; ');
          setGenError(`${result.error}. Validation issues: ${issues}`);
        }
      }
    } catch (e: any) {
      setGenStatus('error');
      setGenError(e.message);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.06 }}
            className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-zinc-800/50 bg-zinc-900/80 backdrop-blur-xl shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create a new lesson"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-clay-500/10 border border-clay-500/20 flex items-center justify-center shrink-0">
                  <Wand2 className="w-4 h-4 text-clay-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100 leading-tight">Create a Lesson</h2>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-none">
                    {step === 'input' && 'Describe what you want to learn'}
                    {step === 'prompt' && 'Your prompt is ready'}
                    {step === 'result' && 'Lesson created'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors duration-150"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800/60 shrink-0">
              <StepIndicator current={step === 'input' ? 0 : step === 'prompt' ? 1 : 2} />
            </div>

            {/* Mode toggle */}
            <AnimatePresence>
              {step === 'input' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-zinc-800/60"
                >
                  <div className="flex items-center gap-1 px-6 py-2.5">
                    <span className="text-xs text-zinc-500 mr-1">Mode:</span>
                    <div className="flex bg-zinc-800/70 border border-zinc-700/50 rounded-lg p-0.5 gap-0.5">
                      <button
                        onClick={() => setInputMode('simple')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                          inputMode === 'simple'
                            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                        Simple
                      </button>
                      <button
                        onClick={() => setInputMode('detailed')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                          inputMode === 'detailed'
                            ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        Detailed
                      </button>
                    </div>
                    <span className="text-xs text-zinc-600 ml-auto">
                      {inputMode === 'simple' ? 'One input \u2014 AI figures out the rest' : 'Multiple fields for precise control'}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
              {step === 'input' && inputMode === 'simple' && (
                <motion.div
                  key="simple"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-zinc-400">
                        What do you want to learn? <span className="text-clay-400">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-600">{userInput.trim().length} chars</span>
                        <BulkAIFill
                          fields={[
                            { id: 'userInput', label: 'Learning Goal', value: userInput, placeholder: 'What to learn' },
                            { id: 'knowledgeContext', label: 'Existing Knowledge', value: knowledgeContext, placeholder: 'What you already know' },
                            { id: 'lessonSize', label: 'Lesson Size', value: lessonSize, type: 'select', options: ['compact', 'standard', 'comprehensive', 'dynamic'] },
                            { id: 'focusArea', label: 'Focus Area', value: focusArea, type: 'select', options: ['balanced', 'theory', 'practice', 'visual'] },
                            { id: 'depthLevel', label: 'Depth Level', value: depthLevel, type: 'select', options: ['adaptive', 'introductory', 'intermediate', 'advanced'] },
                          ]}
                          onFill={(updates) => {
                            if (updates.userInput) setUserInput(updates.userInput)
                            if (updates.knowledgeContext) setKnowledgeContext(updates.knowledgeContext)
                            if (updates.lessonSize) setLessonSize(updates.lessonSize as any)
                            if (updates.focusArea) setFocusArea(updates.focusArea)
                            if (updates.depthLevel) setDepthLevel(updates.depthLevel)
                          }}
                          category="learn"
                          context="Help configure a lesson by filling in the learning goal, existing knowledge, and lesson parameters based on the conversation"
                        />
                      </div>
                    </div>
                    <textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder={`Describe what you want to learn. For example:\n\n"I'm a CS student who knows basic Python. I want to understand how operating systems manage memory \u2014 virtual memory, paging, segmentation, and how the kernel allocates and frees memory. I've been reading OSTEP but find the chapters dense, so I'd like something more visual with diagrams and quizzes to check my understanding."`}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-clay-500/40 focus:ring-2 focus:ring-clay-500/10 resize-y placeholder:text-zinc-600 transition-all duration-150 min-h-[180px]"
                      autoFocus
                    />
                    {userInput.trim().length > 0 && userInput.trim().length < 10 && (
                      <p className="text-xs text-amber-500/80 mt-1.5">Please enter at least 10 characters</p>
                    )}
                  </div>

                  {/* Knowledge Base Selector */}
                  <KnowledgeBaseSelector
                    topic={userInput.trim()}
                    selectedEntries={selectedKBEntries}
                    onSelectionChange={setSelectedKBEntries}
                    knowledgeMode={knowledgeMode}
                    onModeChange={setKnowledgeMode}
                  />

                  {/* Lesson Size */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Lesson Size
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { key: 'compact' as const, label: 'Compact', desc: '3 nodes, concise', icon: '·' },
                        { key: 'standard' as const, label: 'Standard', desc: '5 nodes, balanced', icon: '··' },
                        { key: 'comprehensive' as const, label: 'Full', desc: '8 nodes, detailed', icon: '···' },
                        { key: 'dynamic' as const, label: 'Dynamic', desc: 'AI decides', icon: '⚡' },
                      ]).map(s => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setLessonSize(s.key)}
                          className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border text-[11px] font-medium transition ${
                            lessonSize === s.key
                              ? 'border-clay-500/40 bg-clay-500/10 text-clay-300'
                              : 'border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600/60'
                          }`}
                        >
                          <span className="text-sm leading-none">{s.icon}</span>
                          <span>{s.label}</span>
                          <span className="text-[9px] font-normal opacity-60">{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Knowledge Context — paste existing knowledge to send to external AI */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Your Knowledge Context <span className="text-zinc-600 font-normal">(optional — sent to AI for richer lessons)</span>
                    </label>
                    <textarea
                      value={knowledgeContext}
                      onChange={(e) => setKnowledgeContext(e.target.value)}
                      placeholder={`Paste what you already know about this topic. Examples:\n\n• Notes from a previous lesson\n• Key concepts you've learned\n• Points you want the AI to focus on\n• Things you already understand (so it skips basics)`}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-xs leading-relaxed focus:outline-none focus:border-clay-500/40 focus:ring-2 focus:ring-clay-500/10 resize-y placeholder:text-zinc-600 transition-all duration-150 min-h-[80px]"
                    />
                    {learnerContext && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
                        <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider mb-1">Auto-retrieved learner context</p>
                        <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">{learnerContext}</pre>
                      </div>
                    )}
                    <button
                      onClick={handleAssessKnowledge}
                      disabled={!canBuild}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy a knowledge check prompt — paste into any AI to find out what you already know"
                    >
                      {copiedAssess ? (
                        <><CheckCircle2 className="w-3 h-3" />Copied!</>
                      ) : (
                        <><Brain className="w-3 h-3" />Assess My Knowledge</>
                      )}
                    </button>
                  </div>

                  {/* Tunability controls */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Tuning <span className="text-zinc-600 font-normal">(optional)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Focus</label>
                        <select
                          value={focusArea}
                          onChange={(e) => setFocusArea(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300 focus:outline-none focus:border-clay-500/40"
                        >
                          <option value="balanced">Balanced</option>
                          <option value="theory">Theory-heavy</option>
                          <option value="practice">Practice-heavy</option>
                          <option value="visual">Visual-first</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Depth</label>
                        <select
                          value={depthLevel}
                          onChange={(e) => setDepthLevel(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300 focus:outline-none focus:border-clay-500/40"
                        >
                          <option value="adaptive">Adaptive</option>
                          <option value="introductory">Introductory</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Style</label>
                        <select
                          value={lessonStyle}
                          onChange={(e) => setLessonStyle(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300 focus:outline-none focus:border-clay-500/40"
                        >
                          <option value="standard">Standard</option>
                          <option value="socratic">Socratic (question-led)</option>
                          <option value="narrative">Narrative (story-driven)</option>
                          <option value="reference">Reference (concise)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Reference material */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">
                      Reference material <span className="text-zinc-600 font-normal">(optional)</span>
                    </label>
                    <ResourceInput resources={resources} onChange={setResources} />
                  </div>

                  {/* Chapter / Group selector */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Group <span className="text-zinc-600 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChapterPickerOpen(!chapterPickerOpen)}
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-clay-500/40 focus:ring-2 focus:ring-clay-500/10 text-left transition-all duration-150 hover:border-zinc-600/60"
                          aria-haspopup="listbox"
                          aria-expanded={chapterPickerOpen}
                        >
                          {chapterChoice
                            ? chapterChoice
                            : <span className="text-zinc-600">Let the AI pick</span>}
                        </button>
                        {!groupsLoading && availableGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setChapterPickerOpen(!chapterPickerOpen); }}
                            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                            aria-label="Open group picker"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {chapterPickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-xl"
                            role="listbox"
                          >
                            <button
                              onClick={() => { setChapterChoice(''); setChapterPickerOpen(false); }}
                              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                !chapterChoice
                                  ? 'bg-clay-500/15 text-clay-300'
                                  : 'text-zinc-300 hover:bg-zinc-800/50'
                              }`}
                              role="option"
                            >
                              <span className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Let the AI pick</span>
                              </span>
                            </button>
                            <div className="h-px bg-zinc-700/50 mx-2 my-1" />
                            {availableGroups.map((g) => (
                              <button
                                key={g}
                                onClick={() => { setChapterChoice(g); setChapterPickerOpen(false); }}
                                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors flex items-center gap-2"
                                role="option"
                              >
                                <BookMarked className="w-3.5 h-3.5 text-clay-400" />
                                <span className="truncate">{g}</span>
                              </button>
                            ))}
                            <div className="h-px bg-zinc-700/50 mx-2 my-1" />
                            <div className="px-2 py-1.5">
                              <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newGroupName.trim()) {
                                    e.preventDefault();
                                    handleCreateGroup();
                                  }
                                }}
                                placeholder="Create new group…"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-clay-500/40"
                                autoFocus
                              />
                            </div>
                            <div className="px-2 pb-2">
                              <button
                                onClick={handleCreateGroup}
                                disabled={creatingGroup || !newGroupName.trim()}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 text-clay-300 border border-clay-500/30 hover:bg-clay-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {creatingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                {creatingGroup ? 'Creating…' : 'Create group'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">Pick a group or create one — the lesson will be placed there</p>
                  </div>
                </motion.div>
              )}

              {step === 'input' && inputMode === 'detailed' && (
                <motion.div
                  key="detailed"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Topic <span className="text-clay-400">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. How neural networks learn through backpropagation"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-clay-500/40 focus:ring-2 focus:ring-clay-500/10 resize-y placeholder:text-zinc-600 transition-all duration-150 min-h-[80px]"
                      autoFocus
                    />
                    {description.trim().length > 0 && description.trim().length < 3 && (
                      <p className="text-xs text-amber-500/80 mt-1.5">Please enter at least 3 characters</p>
                    )}
                  </div>

                  {/* Reference material */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">
                      Reference material <span className="text-zinc-600 font-normal">(optional)</span>
                    </label>
                    <ResourceInput resources={resources} onChange={setResources} />
                  </div>

                  {/* Node count */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Number of concepts <span className="text-zinc-600 font-normal">(default: 5)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[3, 4, 5, 6, 8].map((n) => (
                        <button
                          key={n}
                          onClick={() => setNumNodes(n)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-150 ${
                            numNodes === n
                              ? 'bg-clay-500/20 text-clay-300 border border-clay-500/30'
                              : 'bg-zinc-800/40 text-zinc-500 border border-zinc-700/40 hover:border-zinc-600/60 hover:text-zinc-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chapter / Group selector */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Group <span className="text-zinc-600 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChapterPickerOpen(!chapterPickerOpen)}
                          className="flex-1 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-clay-500/40 focus:ring-2 focus:ring-clay-500/10 text-left transition-all duration-150 hover:border-zinc-600/60"
                          aria-haspopup="listbox"
                          aria-expanded={chapterPickerOpen}
                        >
                          {chapterChoice
                            ? chapterChoice
                            : <span className="text-zinc-600">Let the AI pick</span>}
                        </button>
                        {!groupsLoading && availableGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setChapterPickerOpen(!chapterPickerOpen); }}
                            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                            aria-label="Open group picker"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {chapterPickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-xl"
                            role="listbox"
                          >
                            <button
                              onClick={() => { setChapterChoice(''); setChapterPickerOpen(false); }}
                              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                !chapterChoice
                                  ? 'bg-clay-500/15 text-clay-300'
                                  : 'text-zinc-300 hover:bg-zinc-800/50'
                              }`}
                              role="option"
                            >
                              <span className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Let the AI pick</span>
                              </span>
                            </button>
                            <div className="h-px bg-zinc-700/50 mx-2 my-1" />
                            {availableGroups.map((g) => (
                              <button
                                key={g}
                                onClick={() => { setChapterChoice(g); setChapterPickerOpen(false); }}
                                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors flex items-center gap-2"
                                role="option"
                              >
                                <BookMarked className="w-3.5 h-3.5 text-clay-400" />
                                <span className="truncate">{g}</span>
                              </button>
                            ))}
                            <div className="h-px bg-zinc-700/50 mx-2 my-1" />
                            <div className="px-2 py-1.5">
                              <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newGroupName.trim()) {
                                    e.preventDefault();
                                    handleCreateGroup();
                                  }
                                }}
                                placeholder="Create new group…"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-clay-500/40"
                                autoFocus
                              />
                            </div>
                            <div className="px-2 pb-2">
                              <button
                                onClick={handleCreateGroup}
                                disabled={creatingGroup || !newGroupName.trim()}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 text-clay-300 border border-clay-500/30 hover:bg-clay-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {creatingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                {creatingGroup ? 'Creating…' : 'Create group'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">Pick a group or create one — the lesson will be placed there</p>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: PROMPT PREVIEW */}
              {step === 'prompt' && (
                <motion.div
                  key="prompt"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  {/* Info callout */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-clay-500/5 border border-clay-500/15">
                    <Sparkles className="w-4 h-4 text-clay-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your prompt is ready. Copy it and paste into any AI to generate a{' '}
                      <code className="text-clay-300 font-medium">.ldoc</code> lesson file, or use{' '}
                      <strong className="text-zinc-300 font-medium">Generate Here</strong>{' '}
                      to create it directly with DeskFlow.
                    </p>
                  </div>

                  {/* Knowledge used */}
                  {knowledgeUsed && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-sage-500/5 border border-sage-500/15">
                      <BookOpen className="w-4 h-4 text-sage-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-400 leading-relaxed mb-1.5">
                          {knowledgeUsed.entries?.length
                            ? 'Built on your knowledge of:'
                            : knowledgeUsed.relatedTopics?.length
                            ? 'No exact matches — referencing your related topics only:'
                            : 'No matching knowledge — teaching from first principles.'}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(knowledgeUsed.entries ?? []).map((e: any, i: number) => (
                            <span key={e.id ?? i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sage-500/10 border border-sage-500/20 text-[10px] text-sage-300 max-w-full">
                              <span className="truncate">{e.statement}</span>
                              {e.level && <span className="font-mono text-[9px] text-sage-400/70 shrink-0">{e.level}</span>}
                            </span>
                          ))}
                          {(knowledgeUsed.relatedTopics ?? []).map((rt: any) => (
                            <span key={rt.part} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-clay-500/10 border border-clay-500/20 text-[10px] text-clay-300">
                              {rt.emoji} {rt.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Prompt section preview — shows what's inside the prompt */}
                  <PromptSectionPreview prompt={prompt} />

                    {/* Prompt block */}
                    <div className="relative rounded-xl border border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl overflow-hidden">
                      <div className="flex items-center justify-between border-b border-zinc-800/50 px-4 py-2.5">
                        <span className="text-xs font-medium text-zinc-400">Generated prompt</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={handleCopy}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
                              copied
                                ? 'bg-sage-500/15 text-sage-300 border-sage-500/25'
                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/80 hover:text-zinc-200'
                            }`}
                          >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/80 hover:text-zinc-200 transition-all duration-150"
                          >
                            <FileText className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(prompt);
                              window.open('https://chatgpt.com', '_blank');
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-clay-500/15 text-clay-300 border border-clay-500/30 hover:bg-clay-500/25 transition-all duration-150"
                            title="Copy prompt and open ChatGPT"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Send to External AI
                          </button>
                        </div>
                      </div>
                      <pre className="max-h-72 overflow-auto p-4 font-mono text-[12px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
                        {prompt}
                      </pre>
                    </div>

                  {/* Generate Here card */}
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-clay-500/20 to-amber-500/10 border border-clay-500/25 flex items-center justify-center shrink-0">
                          <Wand2 className="w-4 h-4 text-clay-300" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-zinc-200 leading-tight">Generate Here</div>
                          <div className="text-xs text-zinc-500 mt-0.5">Uses DeskFlow's built-in AI provider</div>
                        </div>
                      </div>
                      <button
                        onClick={handleGenerate}
                        disabled={genStatus === 'generating' || genStatus === 'done'}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 shrink-0 ${
                          genStatus === 'done'
                            ? 'bg-sage-500/15 text-sage-300 border border-sage-500/25 cursor-default'
                            : genStatus === 'generating'
                            ? 'bg-clay-500/10 text-clay-400 border border-clay-500/20 opacity-70 cursor-wait'
                            : 'bg-clay-500/15 hover:bg-clay-500/25 text-clay-300 border border-clay-500/20 hover:border-clay-500/30'
                        }`}
                      >
                        {genStatus === 'generating' ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                        ) : genStatus === 'done' ? (
                          <><CheckCircle2 className="w-4 h-4" />Done</>
                        ) : (
                          <><Sparkles className="w-4 h-4" />Generate</>
                        )}
                      </button>
                    </div>

                    {/* Generation progress */}
                    <AnimatePresence>
                      {genStatus === 'generating' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-4 mb-3">
                            <GenerationProgress phase={genPhase} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Error state */}
                    <AnimatePresence>
                      {genStatus === 'error' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-start gap-2 mx-4 mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-400/30">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs text-red-300 leading-relaxed">{genError}</p>
                              <button
                                onClick={() => { setGenStatus('idle'); setGenError(''); setGenPhase(0); }}
                                className="mt-2 text-xs text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors"
                              >
                                Try again
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Success state */}
                    <AnimatePresence>
                      {genStatus === 'done' && genResult?.ok && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 mx-4 mb-3 p-2.5 rounded-lg bg-sage-500/10 border border-sage-500/20">
                            <CheckCircle2 className="w-4 h-4 text-sage-400 shrink-0" />
                            <div>
                              <p className="text-xs text-sage-300 font-medium">Lesson generated and imported successfully!</p>
                              {genResult.data?.lessonId && (
                                <p className="text-xs text-zinc-500 mt-0.5">ID: {genResult.data.lessonId}</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: LESSON RESULT */}
              {step === 'result' && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  {/* Created lesson book card */}
                  <div className={`rounded-xl border overflow-hidden ${createdLesson ? 'border-sage-500/25 bg-sage-500/5' : 'border-zinc-700/40 bg-zinc-800/20'}`}>
                    <div className="flex items-center gap-2.5 p-4">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${createdLesson ? 'bg-sage-500/15 border-sage-500/25' : 'bg-zinc-800/60 border-zinc-700/40'}`}>
                        {createdLesson ? <CheckCircle2 className="w-4 h-4 text-sage-300" /> : <BookMarked className="w-4 h-4 text-zinc-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-200 leading-tight">
                          {createdLesson ? 'Lesson created!' : 'No lesson yet'}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {createdLesson
                            ? 'Click the book to open the lesson, or import another result below'
                            : 'Import your AI-generated result below — it will appear here as a book you can click to open'}
                        </div>
                      </div>
                    </div>
                    {createdLesson && (
                      <div className="flex justify-center px-6 pb-6">
                        <div className="w-[190px]">
                          <BookCard lesson={createdLesson} onOpen={handleOpenLesson} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* External import section */}
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/20 overflow-hidden">
                    <div className="flex items-center gap-2.5 p-4">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/10 border border-blue-500/25 flex items-center justify-center shrink-0">
                        <Upload className="w-4 h-4 text-blue-300" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-200 leading-tight">Or import your result</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Paste .lmd (starts with ---) or .ldoc JSON, upload a file, or upload illustration images</div>
                      </div>
                    </div>

                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Paste .lmd or .ldoc content</label>
                        <textarea
                          value={externalPaste}
                          onChange={(e) => setExternalPaste(e.target.value)}
                          placeholder={'Paste your .lmd lesson (starts with ---) or .ldoc JSON here — code fences and preamble are stripped automatically...'}
                          className="w-full px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 text-zinc-300 text-[11px] font-mono leading-relaxed resize-y min-h-[100px] max-h-[200px] focus:outline-none focus:border-blue-500/40 placeholder:text-zinc-600 transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200 transition-all cursor-pointer">
                          <FileText className="w-3 h-3" />
                          Upload .ldoc file
                          <input type="file" accept=".ldoc,.json,.lmd" className="hidden" onChange={handleExternalFileUpload} />
                        </label>
                        <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200 transition-all cursor-pointer">
                          <ImageIcon className="w-3 h-3" />
                          Upload illustration
                          <input type="file" accept="image/*" className="hidden" onChange={handleExternalImageUpload} />
                        </label>
                        {externalPaste.trim().length > 0 && (
                          <button
                            onClick={handleExternalImport}
                            disabled={externalImporting}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/25 transition-all disabled:opacity-50"
                          >
                            {externalImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            Import
                          </button>
                        )}
                      </div>
                      {externalImportError && <p className="text-[11px] text-red-400">{externalImportError}</p>}
                      {externalImportSuccess && <p className="text-[11px] text-sage-400">{externalImportSuccess}</p>}
                    </div>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/80 shrink-0">
              <button
                onClick={() => {
                  if (step === 'prompt') setStep('input');
                  else if (step === 'result') setStep('prompt');
                  else onClose();
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {step === 'input' ? 'Cancel' : 'Back'}
              </button>

              {step === 'input' && (
                <div className="flex items-center gap-2">
                  {onBrowseSavedIdeas && (
                    <button
                      onClick={() => { onClose(); onBrowseSavedIdeas(); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-800/60 text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-300 transition-all duration-150"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      Pick from saved ideas
                    </button>
                  )}
                  {(userInput.trim().length > 0 || description.trim().length > 0) && (
                    <button
                      onClick={handleSaveForLater}
                      disabled={saved}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 border ${
                        saved
                          ? 'bg-sage-500/15 text-sage-300 border-sage-500/25'
                          : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200'
                      }`}
                    >
                      {saved ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</>
                      ) : (
                        <><FileText className="w-3.5 h-3.5" />Save for later</>
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleBuildPrompt}
                    disabled={!canBuild}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-clay-500/20 hover:bg-clay-500/30 text-clay-300 text-sm font-medium transition-all duration-150 border border-clay-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {building ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Building...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />Generate Prompt</>
                    )}
                  </button>
                  {!canBuild && (
                    <span className="text-[10px] text-zinc-600">
                      {inputMode === 'simple' ? 'Type at least 10 characters' : 'Type at least 3 characters'}
                    </span>
                  )}
                </div>
              )}

              {step === 'prompt' && (
                <button
                  onClick={() => setStep('result')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800/80 text-zinc-300 text-sm font-medium transition-all duration-150 border border-zinc-700/50"
                >
                  {genStatus === 'done' ? 'View Lesson' : 'Done'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {step === 'result' && (
                <div className="flex items-center gap-2">
                  {createdLesson && (
                    <button
                      onClick={() => handleOpenLesson(createdLesson.id)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sage-500/20 hover:bg-sage-500/30 text-sage-300 text-sm font-medium transition-all duration-150 border border-sage-500/30"
                    >
                      <BookOpen className="w-4 h-4" />
                      View Lesson
                    </button>
                  )}
                  <button
                    onClick={() => { onClose(); onImported(); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800/80 text-zinc-300 text-sm font-medium transition-all duration-150 border border-zinc-700/50"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
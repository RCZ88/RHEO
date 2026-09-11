import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronLeft, Import, BarChart3, Grid3X3, Network, FileUp, FileCode2, HelpCircle, Download, CheckCircle2, AlertCircle, Loader2, Keyboard, SlidersHorizontal, Lightbulb } from 'lucide-react';
import { BlockRenderer } from './blocks/BlockRenderer';
import { OnboardingPanel } from './OnboardingPanel';
import { CreateLessonDialog } from './CreateLessonDialog';
import { ValidationReport } from './ValidationReport';
import { TutorPanel } from './TutorPanel';
import { InlineAnswerCard, type InlineAnswerState, type InlineMode } from './InlineAnswerCard';

import { MasteryRing } from './MasteryRing';
import { CurriculumGraph } from './CurriculumGraph';

import { WelcomeEmptyState } from './WelcomeEmptyState';
import { LessonLibrary } from './LessonLibrary';
import { CurriculumShowcase } from './CurriculumShowcase';
import { IntentLibrary } from './IntentLibrary';
import { ProgressDashboard } from './ProgressDashboard';
import { LessonDetailModal } from './LessonDetailModal';
import { LearnerSetup } from './LearnerSetup';
import { LearnerProfilePanel } from './LearnerProfilePanel';
import { TableOfContents, type TOCHeading } from './TableOfContents';
import { ChecklistProgress } from './ChecklistProgress';
import { AssessmentCard, AssessmentCardBlock, parseAssessmentBlock, type Question } from './AssessmentCard';
import { useHighlights } from './useHighlights';
import { SelectionActions } from './SelectionActions';
import { ReaderView } from './ReaderView';
import { ImportView } from './ImportView';
import { TutorDashboardSection } from './TutorDashboardSection';
import type { LessonSummary, LessonWithNodes, RenderableNode, TutorAnswer, Result, ValidationIssue, MasteryLevel, NodeProgress, LessonSeed } from '../../shared/learn/types';
import { DEFAULT_PROFILE } from '../../shared/learn/types';
import { CURRICULUM_BLUEPRINT, type CurriculumPart } from '../../services/learn/curriculum';
import { getSystemPromptForSlug } from '../../services/learn/topicPrompts';
import { useMasteryStats } from './useMasteryStats';
import { hasProfile, saveProfile, syncProfileFromDB, isSetupCompleteAsync } from '../../services/learn/learnerProfile';

export interface LessonSeed {
  part: number;
  title: string;
  scope: string[];
  topicPrompt: string;
}

type View = 'welcome' | 'showcase' | 'library' | 'reader' | 'import' | 'intents' | 'progress';

const api = window.deskflowAPI;

export function LearnPage() {
  const [view, setView] = useState<View>('welcome');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<LessonWithNodes | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorAnswer, setTutorAnswer] = useState<TutorAnswer | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [progress, setProgress] = useState<Record<string, NodeProgress>>({});
  const [graphView, setGraphView] = useState<'grid' | 'graph'>('grid');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [importMode, setImportMode] = useState<'pick' | 'paste' | null>(null);
  const [importErrors, setImportErrors] = useState<ValidationIssue[]>([]);
  const [importWarnings, setImportWarnings] = useState<ValidationIssue[]>([]);
  const [importingExample, setImportingExample] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState<CurriculumPart | null>(null);
  const [lessonSeed, setLessonSeed] = useState<LessonSeed | null>(null);
  const [completedParts, setCompletedParts] = useState<string[]>([]);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [detailLesson, setDetailLesson] = useState<LessonSummary | null>(null);
  const setupChecked = useRef(false);
  const [inlineAnswer, setInlineAnswer] = useState<InlineAnswerState | null>(null);
  const inlineStreamCleanup = useRef<(() => void) | null>(null);
  const [tutorConfig, setTutorConfig] = useState<{ provider: string; model: string } | null>(null);

  const stats = useMasteryStats(progress, lessons);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const highlights = useHighlights({
    lessonId: selectedLesson ?? '',
    partSlug: selectedPart?.slug ?? '',
  });

  // Load lessons on mount
  useEffect(() => {
    loadLessons();
  }, []);

  // Fetch tutor config (provider/model info)
  useEffect(() => {
    if (api?.learnGetTutorConfig) {
      api.learnGetTutorConfig().then((res: any) => {
        if (res?.ok && res.data) setTutorConfig(res.data);
      }).catch(() => {});
    }
  }, []);

  // Cleanup inline stream listener
  useEffect(() => {
    return () => { inlineStreamCleanup.current?.(); };
  }, []);

  // First-visit profile check (runs once, restores from DB if localStorage was cleared)
  useEffect(() => {
    if (setupChecked.current) return;
    setupChecked.current = true;
    (async () => {
      // If setup was already completed before (checks both localStorage AND DB), never show again
      if (await isSetupCompleteAsync()) {
        console.log('[LearnPage] Setup already completed — skipping');
        return;
      }
      // Restore from DB — localStorage gets cleared on some Electron reloads
      await syncProfileFromDB();
      if (!hasProfile()) {
        saveProfile({ ...DEFAULT_PROFILE });
        setShowSetup(true);
        console.log('[LearnPage] First visit — default profile saved to localStorage');
      } else {
        console.log('[LearnPage] Profile found — skipping setup');
      }
    })();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (view === 'reader' && lessonData) {
        const nodes = lessonData.nodes;
        const currentIdx = nodes.findIndex((n) => n.id === selectedNode);
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = nodes[Math.min(currentIdx + 1, nodes.length - 1)];
          if (next) setSelectedNode(next.id);
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = nodes[Math.max(currentIdx - 1, 0)];
          if (prev) setSelectedNode(prev.id);
        }
        if (e.key === 'a' && selectedNode) {
          e.preventDefault();
          setTutorOpen(true);
        }
        if (e.key === '/') {
          e.preventDefault();
        }
        if (e.key === '?') {
          e.preventDefault();
          setShowShortcuts((s) => !s);
        }
        if (e.key === 'g' && graphView === 'grid') {
          setGraphView('graph');
        } else if (e.key === 'g' && graphView === 'graph') {
          setGraphView('grid');
        }
      }
      if (e.key === 'Escape' && tutorOpen) {
        setTutorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view, lessonData, selectedNode, graphView, tutorOpen]);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const result = await api.learnListLessons();
      if (result.ok) {
        setLessons(result.data);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const result = await api.learnGetLesson({ lessonId });
      if (result.ok) {
        setLessonData(result.data);
        setSelectedLesson(lessonId);
        setView('reader');
        const progResult = await api.learnGetProgress();
        if (progResult.ok) {
          setProgress(progResult.data);
        }
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      const result = await api.learnImportLdoc({ source: importText });
      setImportResult(result);
      if (result.ok && result.data.lessonId) {
        loadLessons();
      }
    } catch (err: any) {
      setImportResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleImportExample = async () => {
    setImportingExample(true);
    try {
      const { found, content } = await api.learnGetWorkedExample();
      if (!found || !content) {
        setImportResult({ ok: false, error: 'Worked example not found. Run the build to bundle resources.' });
        return;
      }
      setImportText(content);
      const valResult = await api.learnValidate({ source: content });
      setImportErrors(valResult.ok ? [] : valResult.errors);
      setImportWarnings(valResult.warnings || []);
      if (valResult.ok) {
        const r = await api.learnImportLdoc({ source: content });
        setImportResult(r);
        if (r.ok && r.data.lessonId) {
          loadLessons();
        }
      } else {
        setView('import');
        setImportMode('paste');
        setImportResult({ ok: false, error: 'Worked example failed validation — see errors below.' });
      }
    } catch (err: any) {
      setImportResult({ ok: false, error: err.message });
      setView('import');
      setImportMode('paste');
    } finally {
      setImportingExample(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await api.learnPickFile();
      if (result.canceled) return;
      setImportText(result.content);
      setImportMode('paste');
      setView('import');
      try {
        const valResult = await api.learnValidate({ source: result.content });
        setImportErrors(valResult.ok ? [] : valResult.errors);
        setImportWarnings(valResult.warnings || []);
      } catch {
      }
    } catch (err: any) {
      setImportResult({ ok: false, error: err.message });
      setView('import');
      setImportMode('paste');
    }
  };

  const handleImportWithValidation = async () => {
    try {
      setLoading(true);
      setImportResult(null);
      const valResult = await api.learnValidate({ source: importText });
      setImportErrors(valResult.ok ? [] : valResult.errors);
      setImportWarnings(valResult.warnings || []);
      if (valResult.ok) {
        const r = await api.learnImportLdoc({ source: importText });
        setImportResult(r);
        if (r.ok && r.data.lessonId) {
          loadLessons();
        }
      } else {
        setImportResult({ ok: false, error: 'Validation failed. Fix errors above and retry.' });
      }
    } catch (err: any) {
      setImportErrors([{ rule: 'parse', message: err.message }]);
      setImportWarnings([]);
      setImportResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAskTutor = useCallback(async (nodeId: string, question: string) => {
    setTutorOpen(true);
    setTutorQuestion(question);
    setTutorLoading(true);
    try {
      const result = await api.learnAskTutor({ nodeId, question, mode: 'ask' });
      if (result.ok) {
        setTutorAnswer(result.data);
      }
    } catch (err: any) {
      setTutorAnswer({
        answer_md: `Error: ${err.message}`,
        used_source_ids: [],
        used_fact_ids: [],
        citations: [],
        scope: '',
        assessment: { target_level: 'L0' as MasteryLevel, outcome: 'wrong', rationale: err.message, suggested_next: 'reinforce' },
        escalated: false,
        confidence: 0,
      });
    } finally {
      setTutorLoading(false);
    }
  }, []);

  const startInlineAnswer = useCallback(async (nodeId: string, text: string, mode: InlineMode) => {
    inlineStreamCleanup.current?.();
    inlineStreamCleanup.current = null;
    const blockId = `inline-${mode}-${Date.now()}`;
    setInlineAnswer({ mode, text, loading: true, streamingText: '', blockId });
    const unsub = api.onTutorToken((data: { blockId: string; token: string; done: boolean }) => {
      if (data.blockId !== blockId) return;
      if (data.done) { setInlineAnswer(prev => prev ? { ...prev, loading: false } : prev); return; }
      if (data.token) { setInlineAnswer(prev => prev ? { ...prev, streamingText: prev.streamingText + data.token } : prev); }
    });
    inlineStreamCleanup.current = unsub;
    try {
      const result = await api.learnTutorStream({ nodeId, blockId, question: text, mode });
      if (!result?.ok) { setInlineAnswer(prev => prev ? { ...prev, loading: false, error: result?.error || 'Failed' } : prev); }
    } catch (err: any) { setInlineAnswer(prev => prev ? { ...prev, loading: false, error: err?.message || 'Stream error' } : prev); }
  }, []);

  const handleCloseInlineAnswer = useCallback(() => {
    inlineStreamCleanup.current?.();
    inlineStreamCleanup.current = null;
    setInlineAnswer(null);
  }, []);

  const handleRetryInlineAnswer = useCallback(() => {
    if (!inlineAnswer || !selectedNode) return;
    startInlineAnswer(selectedNode, inlineAnswer.text, inlineAnswer.mode);
  }, [inlineAnswer, selectedNode, startInlineAnswer]);

  const handleSelectionAsk = useCallback((text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper') => {
    if (!selectedNode) return;
    if (mode === 'ask') {
      setTutorOpen(true);
      setTutorQuestion(text);
      return;
    }
    startInlineAnswer(selectedNode, text, mode as InlineMode);
  }, [selectedNode, startInlineAnswer]);

  const handleQuizSubmit = useCallback(async (nodeId: string, blockId: string, response: string) => {
    try {
      const result = await api.learnSubmitQuiz({ nodeId, blockId, response });
      if (result.ok) {
        const progResult = await api.learnGetProgress({ nodeId });
        if (progResult.ok) {
          setProgress((prev) => ({ ...prev, [nodeId]: progResult.data }));
        }
      }
      return result;
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }, []);

  // ── Tutor V2 callbacks ──

  const handleApproveProposal = useCallback(async (blockId: string) => {
    try {
      await api.learnDecideProposal({ proposal_id: blockId, approved: true });
    } catch { /* ignore */ }
  }, []);

  const handleRejectProposal = useCallback(async (blockId: string, reason?: string) => {
    try {
      await api.learnDecideProposal({ proposal_id: blockId, approved: false, reason });
    } catch { /* ignore */ }
  }, []);

  const handleAddMessage = useCallback(async (blockId: string, text: string) => {
    if (!selectedNode) return;
    try {
      await api.learnAddMessage({ nodeId: selectedNode, blockId, role: 'user', text });
    } catch { /* ignore */ }
  }, [selectedNode]);

  const handleResolveConversation = useCallback(async (blockId: string) => {
    try {
      const conv = await api.learnGetConversation({ blockId });
      if (conv && conv.id) {
        await api.learnResolveConversation({ convId: conv.id });
      }
    } catch { /* ignore */ }
  }, []);

  const handleAddNote = useCallback(async (blockId: string, text: string) => {
    if (!selectedNode) return;
    try {
      await api.learnAddNote({ nodeId: selectedNode, text, blockRef: blockId });
    } catch { /* ignore */ }
  }, [selectedNode]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await api.learnDeleteNote({ noteId });
    } catch { /* ignore */ }
  }, []);

  const handleTogglePin = useCallback(async (noteId: string) => {
    try {
      const note = lessonData?.nodes.flatMap(n => n.blocks.filter((b: any) => b.type === 'notes').flatMap((b: any) => b.notes)).find((n: any) => n?.id === noteId);
      await api.learnToggleNotePin({ noteId, pinned: !note?.pinned });
    } catch { /* ignore */ }
  }, [lessonData]);

  const currentNode = lessonData?.nodes.find((n) => n.id === selectedNode);
  const currentLevel = selectedNode ? progress[selectedNode]?.level : undefined;

  // Welcome landing — full editorial page, no chrome
  if (view === 'welcome') {
    return (
      <>
        <WelcomeEmptyState
          onCompose={() => setShowCreateDialog(true)}
          onTryExample={handleImportExample}
          onImport={() => setView('import')}
          onPaste={() => { setView('import'); setImportMode('paste'); }}
          onBrowse={() => setView('library')}
        />
        <OnboardingPanel open={showOnboarding} onClose={() => setShowOnboarding(false)} />
        <LearnerSetup open={showSetup} onClose={() => setShowSetup(false)} />
        <LearnerProfilePanel open={showProfilePanel} onClose={() => setShowProfilePanel(false)} onRerunSetup={() => { setShowProfilePanel(false); setShowSetup(true); }} />
        <CreateLessonDialog seed={lessonSeed} open={showCreateDialog} onClose={() => { setShowCreateDialog(false); setLessonSeed(null); }} onImported={() => { loadLessons(); setView('library'); }} />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col" data-page="learn">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-clay-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Learn</h1>
          {view !== 'library' && (
            <button
              onClick={() => { setView('library'); setSelectedLesson(null); setLessonData(null); setSelectedNode(null); setTutorOpen(false); setTutorAnswer(null); }}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              <ChevronLeft className="w-3 h-3" />
              Back to Library
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(view === 'library' || view === 'showcase') && (
            <>
              <button
                onClick={() => { setView('welcome'); setSelectedLesson(null); setLessonData(null); setSelectedNode(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Home
              </button>
              <button
                onClick={() => setView('showcase')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Curriculum
              </button>
              <button
                onClick={() => setShowProfilePanel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Profile
              </button>
              <button
                onClick={() => setView('intents')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
                  view === 'intents' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Ideas
              </button>
              <button
                onClick={() => setView('progress')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${
                  view === 'progress' ? 'text-sage-400 bg-sage-400/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Progress
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                How it works
              </button>
            </>
          )}
          {view === 'reader' && lessonData && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition"
                title="Keyboard shortcuts"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGraphView('grid')}
                className={`p-1.5 rounded transition ${graphView === 'grid' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Grid view"
                aria-label="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setGraphView('graph')}
                className={`p-1.5 rounded transition ${graphView === 'graph' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                title="Graph view"
                aria-label="Graph view"
              >
                <Network className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-5 w-80 max-w-[90vw] shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-clay-400" />
                Keyboard Shortcuts
              </h3>
              <div className="space-y-2 text-xs">
                {[
                  ['j / ↓', 'Next node'],
                  ['k / ↑', 'Previous node'],
                  ['a', 'Open tutor panel'],
                  ['g', 'Toggle graph view'],
                  ['?', 'Toggle shortcuts'],
                  ['Esc', 'Close tutor panel'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-mono text-[10px]">{key}</kbd>
                    <span className="text-zinc-500">{desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          {view === 'showcase' && (
            <CurriculumShowcase
              key="showcase"
              lessonsByPart={(() => {
                const byPart: Record<number, { id: string; title: string }[]> = {};
                lessons.forEach((l) => {
                  const p = l.part ?? 0;
                  if (!byPart[p]) byPart[p] = [];
                  byPart[p].push({ id: l.id, title: l.title });
                });
                return byPart;
              })()}
              checklistByPart={(() => {
                const byPart: Record<number, boolean[]> = {};
                CURRICULUM_BLUEPRINT.forEach((p) => {
                  byPart[p.part] = p.checklist.map((c) => completedItems.includes(c));
                });
                return byPart;
              })()}
              onGenerate={(part) => {
                setSelectedPart(part);
                setLessonSeed({
                  part: part.part,
                  title: part.title,
                  scope: part.checklist,
                  topicPrompt: getSystemPromptForSlug(part.slug),
                });
                setShowCreateDialog(true);
              }}
              onOpenLesson={(id) => loadLesson(id)}
              onToggleChecklist={(part, i) => {
                const item = CURRICULUM_BLUEPRINT[part]?.checklist[i];
                if (item) {
                  setCompletedItems((prev) =>
                    prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
                  );
                }
              }}
            />
          )}
          {view === 'library' && (
            <>
              <LessonLibrary
                key="library"
                lessons={lessons}
                loading={loading}
                onOpen={(id) => loadLesson(id)}
                onInfo={(id) => {
                  const lesson = lessons.find(l => l.id === id);
                  if (lesson) setDetailLesson(lesson);
                }}
                onCompose={() => setShowCreateDialog(true)}
                onImport={() => setView('import')}
                onWelcome={() => setView('showcase')}
                stats={stats}
                onOpenProfile={() => setShowProfilePanel(true)}
              />
              {lessons.length > 0 && (
                <div className="max-w-4xl mx-auto px-6 pb-8">
                  <TutorDashboardSection
                    getDashboard={async () => { const r = await api.learnGetTutorDashboard(); if (!r.ok) throw new Error(r.error); return r.data; }}
                    onNavigateToNode={(nodeId) => {
                      // Find which lesson contains this node and load it
                      const loadFirstMatching = async () => {
                        for (const l of lessons) {
                          const r = await api.learnGetLesson({ lessonId: l.id });
                          if (r.ok && r.data.nodes.some((n: any) => n.id === nodeId)) {
                            loadLesson(l.id);
                            setTimeout(() => setSelectedNode(nodeId), 100);
                            break;
                          }
                        }
                      };
                      loadFirstMatching();
                    }}
                  />
                </div>
              )}
            </>
          )}
          {view === 'reader' && lessonData && (
            <>
            <ReaderView
              key="reader"
              lesson={lessonData}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              currentNode={currentNode}
              currentLevel={currentLevel}
              onAsk={handleAskTutor}
              onSelectionAsk={handleSelectionAsk}
              onQuizSubmit={handleQuizSubmit}
              tutorOpen={tutorOpen}
              setTutorOpen={setTutorOpen}
              tutorQuestion={tutorQuestion}
              setTutorQuestion={setTutorQuestion}
              tutorAnswer={tutorAnswer}
              tutorLoading={tutorLoading}
              graphView={graphView}
              progress={progress}
              mobileOutlineOpen={mobileOutlineOpen}
              setMobileOutlineOpen={setMobileOutlineOpen}
              containerRef={readerContainerRef}
              highlights={highlights}
              completedItems={completedItems}
              onToggleCheck={(id: string) => {
                setCompletedItems((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                );
              }}
              completedParts={completedParts}
              onApproveProposal={handleApproveProposal}
              onRejectProposal={handleRejectProposal}
              onAddMessage={handleAddMessage}
              onResolveConversation={handleResolveConversation}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onTogglePin={handleTogglePin}
              tutorConfig={tutorConfig}
            />
            {inlineAnswer && (
              <InlineAnswerCard state={inlineAnswer} onClose={handleCloseInlineAnswer} onRetry={handleRetryInlineAnswer} />
            )}
            </>
          )}
          {view === 'import' && (
            <ImportView
              key="import"
              importText={importText}
              setImportText={setImportText}
              onImport={handleImportWithValidation}
              onPickFile={handlePickFile}
              onImportExample={handleImportExample}
              importingExample={importingExample}
              loading={loading}
              result={importResult}
              mode={importMode}
              setMode={setImportMode}
              errors={importErrors}
              warnings={importWarnings}
              onJumpToNode={() => {}}
              onShowOnboarding={() => setShowOnboarding(true)}
            />
          )}
          {view === 'intents' && (
            <IntentLibrary
              key="intents"
              onGenerateFromIntent={(intent) => {
                setLessonSeed({
                  part: 0,
                  title: intent.title,
                  scope: intent.description ? intent.description.split('\n').filter(Boolean) : [],
                  topicPrompt: intent.context || '',
                });
                setShowCreateDialog(true);
              }}
            />
          )}
          {view === 'progress' && (
            <ProgressDashboard key="progress" />
          )}
        </AnimatePresence>
      </div>

      <OnboardingPanel open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <LearnerSetup open={showSetup} onClose={() => setShowSetup(false)} />
      <LearnerProfilePanel open={showProfilePanel} onClose={() => setShowProfilePanel(false)} onRerunSetup={() => { setShowProfilePanel(false); setShowSetup(true); }} />
      <CreateLessonDialog seed={lessonSeed} open={showCreateDialog} onClose={() => { setShowCreateDialog(false); setLessonSeed(null); }} onImported={() => { loadLessons(); setView('library'); }} />
      <LessonDetailModal
        lesson={detailLesson}
        open={!!detailLesson}
        onClose={() => setDetailLesson(null)}
        onDeleted={() => { setDetailLesson(null); loadLessons(); }}
        onUpdated={() => { setDetailLesson(null); loadLessons(); }}
        onOpenReader={(id) => { setDetailLesson(null); loadLesson(id); }}
      />
    </div>
  );
}
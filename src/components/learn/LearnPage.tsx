import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import { Switch } from '../ui/switch';
import { LearnNavBar, type BreadcrumbSegment } from './LearnNavBar';
import { LearnTabBar, type LearnView } from './LearnTabBar';
import { LearnHome } from './LearnHome';
import { LessonLibrary } from './LessonLibrary';
import { ReaderView } from './ReaderView';
import { StudyView } from './StudyView';
import { IntentLibraryPanel } from './IntentLibraryPanel';
import { ImportDialog } from './ImportDialog';
import { ImportView } from './ImportView';
import { CreateLessonDialog } from './CreateLessonDialog';
import { LearnerSetup } from './LearnerSetup';
import { LearnerProfilePanel } from './LearnerProfilePanel';
import { OnboardingPanel } from './OnboardingPanel';
import { LessonDetailModal } from './LessonDetailModal';
import { ChapterGroupsModal } from './ChapterGroupsModal';
import { InlineAnswerCard, type InlineAnswerState, type InlineMode } from './InlineAnswerCard';
import { TutorPanel } from './TutorPanel';
import { viewVariants, viewTransition } from './transitions';
import { useMasteryStats } from './useMasteryStats';
import { useHighlights } from './useHighlights';
import type { LessonSummary, LessonWithNodes, RenderableNode, TutorAnswer, ValidationIssue, MasteryLevel, NodeProgress, LessonSeed } from '../../shared/learn/types';
import { DEFAULT_PROFILE } from '../../shared/learn/types';
import { CURRICULUM_TOPICS, type CurriculumTopic } from '../../services/learn/curriculum';
import { getSystemPromptForSlug } from '../../services/learn/topicPrompts';
import { hasProfile, saveProfile, syncProfileFromDB, isSetupCompleteAsync } from '../../services/learn/learnerProfile';

export interface LessonSeed {
  part: number;
  title: string;
  scope: string[];
  topicPrompt: string;
}

const api = window.deskflowAPI;

export function LearnPage() {
  const [[view, direction], setViewState] = useState<[LearnView, number]>(['home', 0]);
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
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('lyceum.shortcutsEnabled');
      return saved === null ? true : saved !== 'false';
    } catch { return true; }
  });
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState<CurriculumTopic | null>(null);
  const [lessonSeed, setLessonSeed] = useState<LessonSeed | null>(null);
  const [savedIntentConfig, setSavedIntentConfig] = useState<Record<string, any> | null>(null);
  const [completedParts, setCompletedParts] = useState<string[]>([]);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [detailLesson, setDetailLesson] = useState<LessonSummary | null>(null);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const setupChecked = useRef(false);
  const [inlineAnswer, setInlineAnswer] = useState<InlineAnswerState | null>(null);
  const inlineStreamCleanup = useRef<(() => void) | null>(null);
  const [tutorConfig, setTutorConfig] = useState<{ provider: string; model: string } | null>(null);

  // Modal states
  const [intentPanelOpen, setIntentPanelOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const stats = useMasteryStats(progress, lessons);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const highlights = useHighlights({
    lessonId: selectedLesson ?? '',
    partSlug: selectedPart?.slug ?? '',
  });

  // Load lessons on mount
  useEffect(() => { loadLessons(); }, []);

  // Fetch tutor config
  useEffect(() => {
    if (api?.learnGetTutorConfig) {
      api.learnGetTutorConfig().then((res: any) => {
        if (res?.ok && res.data) setTutorConfig(res.data);
      }).catch(() => {});
    }
  }, []);

  // Cleanup inline stream listener
  useEffect(() => { return () => { inlineStreamCleanup.current?.(); }; }, []);

  // First-visit profile check
  useEffect(() => {
    if (setupChecked.current) return;
    setupChecked.current = true;
    (async () => {
      if (await isSetupCompleteAsync()) return;
      await syncProfileFromDB();
      if (!hasProfile()) {
        saveProfile({ ...DEFAULT_PROFILE });
        setShowSetup(true);
      }
    })();
  }, []);

  // Navigation
  const navigate = useCallback((next: LearnView) => {
    const order: LearnView[] = ['home', 'library', 'reader', 'study'];
    const dir = order.indexOf(next) > order.indexOf(view) ? 1 : -1;
    if (next === 'home' || next === 'library') {
      setSelectedLesson(null);
      setLessonData(null);
      setSelectedNode(null);
      setTutorOpen(false);
      setTutorAnswer(null);
    }
    setViewState([next, dir]);
  }, [view]);

  const openLesson = useCallback((id: string) => {
    setSelectedLesson(id);
    setViewState(['reader', 1]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // When shortcuts are disabled, only Esc (close dialogs) and '?' (re-open this modal) stay active
      if (!shortcutsEnabled && e.key !== 'Escape' && e.key !== '?') return;

      // Global shortcuts
      if (e.key === 'Escape') {
        if (showCreateDialog) { setShowCreateDialog(false); return; }
        if (importDialogOpen) { setImportDialogOpen(false); return; }
        if (intentPanelOpen) { setIntentPanelOpen(false); return; }
        if (showProfilePanel) { setShowProfilePanel(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (tutorOpen) { setTutorOpen(false); return; }
        if (view !== 'home') { navigate('home'); return; }
      }

      // G-prefix navigation
      if (e.key === 'g') {
        const handler = (ev: KeyboardEvent) => {
          if (ev.key === 'h') navigate('home');
          if (ev.key === 'l') navigate('library');
          if (ev.key === 's' && selectedLesson) navigate('study');
          window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler, { once: true });
        return;
      }

      if (e.key === 'c' && !showCreateDialog) setShowCreateDialog(true);
      if (e.key === 'i' && !importDialogOpen) setImportDialogOpen(true);
      if (e.key === '?') setShowShortcuts(s => !s);

      // Reader-specific shortcuts
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
        if (e.key === 'g' && graphView === 'grid') {
          setGraphView('graph');
        } else if (e.key === 'g' && graphView === 'graph') {
          setGraphView('grid');
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view, lessonData, selectedNode, graphView, tutorOpen, showCreateDialog, importDialogOpen, intentPanelOpen, showProfilePanel, showShortcuts, selectedLesson, navigate, shortcutsEnabled]);

  // Persist shortcuts preference
  useEffect(() => {
    try {
      localStorage.setItem('lyceum.shortcutsEnabled', String(shortcutsEnabled));
    } catch { /* ignore */ }
  }, [shortcutsEnabled]);

  // Data fetching
  const loadLessons = async () => {
    try {
      setLoading(true);
      const result = await api.learnListLessons();
      if (result.ok) setLessons(result.data);
      else setError(result.error);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadLesson = async (lessonId: string) => {
    try {
      setLoading(true);
      const result = await api.learnGetLesson({ lessonId });
      if (result.ok) {
        setLessonData(result.data);
        setSelectedLesson(lessonId);
        setViewState(['reader', 1]);
        const progResult = await api.learnGetProgress();
        if (progResult.ok) setProgress(progResult.data);
      } else { setError(result.error); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // Persist a generated/uploaded illustration image_path back into the lesson doc
  const persistIllustration = useCallback(async (blockId: string, imagePath: string) => {
    if (!lessonData) return;
    try {
      const lessonId = String(lessonData.lesson.id);
      const src = await api.learnGetLessonSource({ lessonId });
      if (!src.ok || !src.data) return;
      const doc = typeof src.data === 'string' ? JSON.parse(src.data) : src.data;
      let found = false;
      for (const node of (doc.nodes || [])) {
        for (const block of (node.blocks || [])) {
          if (block.id === blockId) {
            block.meta = block.meta || {};
            block.meta.image_path = imagePath;
            found = true;
          }
        }
      }
      if (!found) return;
      const result = await api.learnUpdateLessonDoc({ lessonId, docJson: JSON.stringify(doc) });
      if (result.ok) loadLesson(lessonId);
    } catch { /* ignore */ }
  }, [lessonData]);

  const handleImport = async () => {
    try {
      setLoading(true);
      const result = await api.learnImportLdoc({ source: importText });
      setImportResult(result);
      if (result.ok && result.data.lessonId) loadLessons();
    } catch (err: any) { setImportResult({ ok: false, error: err.message }); }
    finally { setLoading(false); }
  };

  const handleImportExample = async () => {
    setImportingExample(true);
    try {
      const { found, content } = await api.learnGetWorkedExample();
      if (!found || !content) {
        setImportResult({ ok: false, error: 'Worked example not found.' });
        return;
      }
      setImportText(content);
      const valResult = await api.learnValidate({ source: content });
      setImportErrors(valResult.ok ? [] : valResult.errors);
      setImportWarnings(valResult.warnings || []);
      if (valResult.ok) {
        const r = await api.learnImportLdoc({ source: content });
        setImportResult(r);
        if (r.ok && r.data.lessonId) loadLessons();
      } else {
        setImportDialogOpen(true);
        setImportMode('paste');
        setImportResult({ ok: false, error: 'Worked example failed validation.' });
      }
    } catch (err: any) {
      setImportResult({ ok: false, error: err.message });
      setImportDialogOpen(true);
      setImportMode('paste');
    } finally { setImportingExample(false); }
  };

  const handlePickFile = async () => {
    try {
      const result = await api.learnPickFile();
      if (result.canceled) return;
      setImportText(result.content);
      setImportMode('paste');
      setImportDialogOpen(true);
      try {
        const valResult = await api.learnValidate({ source: result.content });
        setImportErrors(valResult.ok ? [] : valResult.errors);
        setImportWarnings(valResult.warnings || []);
      } catch {}
    } catch (err: any) {
      setImportResult({ ok: false, error: err.message });
      setImportDialogOpen(true);
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
        if (r.ok && r.data.lessonId) loadLessons();
      } else {
        setImportResult({ ok: false, error: 'Validation failed.' });
      }
    } catch (err: any) {
      setImportErrors([{ rule: 'parse', message: err.message }]);
      setImportWarnings([]);
      setImportResult({ ok: false, error: err.message });
    } finally { setLoading(false); }
  };

  // Tutor callbacks
  const handleAskTutor = useCallback(async (nodeId: string, question: string) => {
    setTutorOpen(true);
    setTutorQuestion(question);
    setTutorLoading(true);
    try {
      const result = await api.learnAskTutor({ nodeId, question, mode: 'ask' });
      if (result.ok) setTutorAnswer(result.data);
    } catch (err: any) {
      setTutorAnswer({
        answer_md: `Error: ${err.message}`,
        used_source_ids: [], used_fact_ids: [], citations: [], scope: '',
        assessment: { target_level: 'L0' as MasteryLevel, outcome: 'wrong', rationale: err.message, suggested_next: 'reinforce' },
        escalated: false, confidence: 0,
      });
    } finally { setTutorLoading(false); }
  }, []);

  const dashboardGetDashboard = useCallback(async () => {
    const r = await api.learnGetTutorDashboard();
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }, []);

  const dashboardNavigateToNode = useCallback((nodeId: string) => {
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
  }, [lessons]);

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
    if (mode === 'ask') { setTutorOpen(true); setTutorQuestion(text); return; }
    startInlineAnswer(selectedNode, text, mode as InlineMode);
  }, [selectedNode, startInlineAnswer]);

  const handleQuizSubmit = useCallback(async (nodeId: string, blockId: string, response: string) => {
    try {
      const result = await api.learnSubmitQuiz({ nodeId, blockId, response });
      if (result.ok) {
        const progResult = await api.learnGetProgress({ nodeId });
        if (progResult.ok) setProgress((prev) => ({ ...prev, [nodeId]: progResult.data }));
      }
      return result;
    } catch (err: any) { return { ok: false, error: err.message }; }
  }, []);

  const handleApproveProposal = useCallback(async (blockId: string) => {
    try { await api.learnDecideProposal({ proposal_id: blockId, approved: true }); } catch {}
  }, []);

  const handleRejectProposal = useCallback(async (blockId: string, reason?: string) => {
    try { await api.learnDecideProposal({ proposal_id: blockId, approved: false, reason }); } catch {}
  }, []);

  const handleAddMessage = useCallback(async (blockId: string, text: string) => {
    if (!selectedNode) return;
    try { await api.learnAddMessage({ nodeId: selectedNode, blockId, role: 'user', text }); } catch {}
  }, [selectedNode]);

  const handleResolveConversation = useCallback(async (blockId: string) => {
    try {
      const conv = await api.learnGetConversation({ blockId });
      if (conv && conv.id) await api.learnResolveConversation({ convId: conv.id });
    } catch {}
  }, []);

  const handleAddNote = useCallback(async (blockId: string, text: string) => {
    if (!selectedNode) return;
    try { await api.learnAddNote({ nodeId: selectedNode, text, blockRef: blockId }); } catch {}
  }, [selectedNode]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try { await api.learnDeleteNote({ noteId }); } catch {}
  }, []);

  const handleTogglePin = useCallback(async (noteId: string) => {
    try {
      const note = lessonData?.nodes.flatMap(n => n.blocks.filter((b: any) => b.type === 'notes').flatMap((b: any) => b.notes)).find((n: any) => n?.id === noteId);
      await api.learnToggleNotePin({ noteId, pinned: !note?.pinned });
    } catch {}
  }, [lessonData]);

  const currentNode = lessonData?.nodes.find((n) => n.id === selectedNode);
  const currentLevel = selectedNode ? progress[selectedNode]?.level : undefined;

  // Breadcrumb
  const breadcrumb = useMemo((): BreadcrumbSegment[] => {
    const segs: BreadcrumbSegment[] = [{ label: 'Home', view: 'home' }];
    if (view === 'library' || view === 'reader' || view === 'study') {
      segs.push({ label: 'Library', view: 'library' });
    }
    if ((view === 'reader' || view === 'study') && selectedLesson) {
      const title = lessons.find(l => l.id === selectedLesson)?.title ?? 'Lesson';
      segs.push({ label: title, view: 'reader' });
    }
    if (view === 'study') segs.push({ label: 'Study', view: 'study' });
    return segs;
  }, [view, selectedLesson, lessons]);

  // Render view
  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <LearnHome
            onCompose={() => setShowCreateDialog(true)}
            onTryExample={handleImportExample}
            onImport={() => setImportDialogOpen(true)}
            onPaste={() => { setImportDialogOpen(true); setImportMode('paste'); }}
            onBrowse={() => navigate('library')}
            onOpenSavedIdeas={() => setIntentPanelOpen(true)}
          />
        );
      case 'library':
        return (
          <LessonLibrary
            lessons={lessons}
            loading={loading}
            onOpen={(id) => loadLesson(id)}
            onInfo={(id) => {
              const lesson = lessons.find(l => l.id === id);
              if (lesson) setDetailLesson(lesson);
            }}
            onCompose={() => setShowCreateDialog(true)}
            onImport={() => setImportDialogOpen(true)}
            onWelcome={() => navigate('home')}
            stats={stats}
            onOpenProfile={() => setShowProfilePanel(true)}
            getDashboard={dashboardGetDashboard}
            onNavigateToNode={dashboardNavigateToNode}
            onManageGroups={() => setShowGroupsModal(true)}
          />
        );
      case 'reader':
        return lessonData ? (
          <ReaderView
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
            onSetGraphView={setGraphView}
            onOpenShortcuts={() => setShowShortcuts(true)}
            progress={progress}
            mobileOutlineOpen={mobileOutlineOpen}
            setMobileOutlineOpen={setMobileOutlineOpen}
            containerRef={readerContainerRef}
            highlights={highlights}
            completedItems={completedItems}
            onToggleCheck={(id: string) => {
              setCompletedItems((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
            }}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            onAddMessage={handleAddMessage}
            onResolveConversation={handleResolveConversation}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onTogglePin={handleTogglePin}
            tutorConfig={tutorConfig}
            onPersistIllustration={persistIllustration}
          />
        ) : null;
      case 'study':
        return <StudyView onBack={() => navigate('library')} />;
      default:
        return null;
    }
  };

  return (
    <div data-page="learn" className="h-full flex flex-col bg-[#0f0e0d] text-zinc-100 relative">
      <LearnNavBar
        breadcrumb={breadcrumb}
        onNavigate={navigate}
        onOpenProfile={() => setShowProfilePanel(true)}
        onOpenHelp={() => setShowOnboarding(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-h-0 overflow-hidden relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={view}
              custom={direction}
              variants={viewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={viewTransition}
              className="h-full overflow-y-auto"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        <LearnTabBar view={view} onChange={navigate} activeLessonId={selectedLesson} />
      </div>

      {/* Inline answer card (reader) */}
      {inlineAnswer && (
        <InlineAnswerCard state={inlineAnswer} onClose={handleCloseInlineAnswer} onRetry={handleRetryInlineAnswer} />
      )}

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
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/40 mb-3">
                <div>
                  <p className="text-xs font-medium text-zinc-200">Enable shortcuts</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Off: typing only — Esc &amp; ? stay active</p>
                </div>
                <Switch
                  checked={shortcutsEnabled}
                  onCheckedChange={setShortcutsEnabled}
                  aria-label="Enable keyboard shortcuts"
                />
              </div>
              <div className={`space-y-2 text-xs transition-opacity ${shortcutsEnabled ? '' : 'opacity-40'}`}>
                {[
                  ['g h', 'Go to Home'],
                  ['g l', 'Go to Library'],
                  ['g s', 'Go to Study'],
                  ['j / ↓', 'Next node'],
                  ['k / ↑', 'Previous node'],
                  ['a', 'Open tutor panel'],
                  ['g', 'Toggle graph view'],
                  ['c', 'Compose lesson'],
                  ['i', 'Import lesson'],
                  ['?', 'Toggle shortcuts'],
                  ['Esc', 'Close / go home'],
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

      {/* Modal overlays */}
      <IntentLibraryPanel
        open={intentPanelOpen}
        onClose={() => setIntentPanelOpen(false)}
        onGenerate={(intent) => {
          setIntentPanelOpen(false);
          setLessonSeed({
            part: 0,
            title: intent.title,
            scope: intent.description ? intent.description.split('\n').filter(Boolean) : [],
            topicPrompt: intent.context || '',
          });
          try {
            setSavedIntentConfig(intent.config ? JSON.parse(intent.config) : null);
          } catch { setSavedIntentConfig(null); }
          setShowCreateDialog(true);
        }}
      />
      <ImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <ImportView
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
      </ImportDialog>
      <CreateLessonDialog
        seed={lessonSeed}
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setLessonSeed(null); setSavedIntentConfig(null); }}
        onImported={() => { loadLessons(); navigate('library'); }}
        onBrowseSavedIdeas={() => { setShowCreateDialog(false); setIntentPanelOpen(true); }}
        onOpenLesson={(id) => { setShowCreateDialog(false); setLessonSeed(null); setSavedIntentConfig(null); loadLesson(id); }}
        savedIntentConfig={savedIntentConfig}
      />
      <OnboardingPanel open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <LearnerSetup open={showSetup} onClose={() => setShowSetup(false)} />
      <LearnerProfilePanel
        open={showProfilePanel}
        onClose={() => setShowProfilePanel(false)}
        onRerunSetup={() => { setShowProfilePanel(false); setShowSetup(true); }}
      />
      <LessonDetailModal
        lesson={detailLesson}
        open={!!detailLesson}
        onClose={() => setDetailLesson(null)}
        onDeleted={() => { setDetailLesson(null); loadLessons(); }}
        onUpdated={() => { setDetailLesson(null); loadLessons(); }}
        onOpenReader={(id) => { setDetailLesson(null); loadLesson(id); }}
      />
      <ChapterGroupsModal open={showGroupsModal} onClose={() => setShowGroupsModal(false)} />
    </div>
  );
}

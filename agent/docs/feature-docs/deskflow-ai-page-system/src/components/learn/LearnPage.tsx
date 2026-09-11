import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronLeft, Import, BarChart3, Grid3X3, Network, FileUp, FileCode2, HelpCircle, Download, CheckCircle2, AlertCircle, Loader2, Keyboard } from 'lucide-react';
import { BlockRenderer } from './blocks/BlockRenderer';
import { OnboardingPanel } from './OnboardingPanel';
import { CreateLessonDialog } from './CreateLessonDialog';
import { ValidationReport } from './ValidationReport';
import { TutorPanel } from './TutorPanel';

import { MasteryRing } from './MasteryRing';
import { CurriculumGraph } from './CurriculumGraph';

import { WelcomeEmptyState } from './WelcomeEmptyState';
import { LessonLibrary } from './LessonLibrary';
import { CurriculumShowcase } from './CurriculumShowcase';
import { TableOfContents, type TOCHeading } from './TableOfContents';
import { ChecklistProgress } from './ChecklistProgress';
import { AssessmentCard, AssessmentCardBlock, parseAssessmentBlock, type Question } from './AssessmentCard';
import { useHighlights } from './useHighlights';
import { SelectionActions } from './SelectionActions';
import type { LessonSummary, LessonWithNodes, RenderableNode, TutorAnswer, Result, ValidationIssue, MasteryLevel, NodeProgress, LessonSeed } from '../../shared/learn/types';
import { CURRICULUM_BLUEPRINT, type CurriculumPart } from '../../services/learn/curriculum';
import { getSystemPromptForSlug } from '../../services/learn/topicPrompts';

export interface LessonSeed {
  part: number;
  title: string;
  scope: string[];
  topicPrompt: string;
}

type View = 'welcome' | 'showcase' | 'library' | 'reader' | 'dashboard' | 'import';

const api = (window as any).deskflowAPI;

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

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const highlights = useHighlights({
    lessonId: selectedLesson ?? '',
    partSlug: selectedPart?.slug ?? '',
  });

  // Load lessons on mount
  useEffect(() => {
    loadLessons();
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
      const result = await api.learnAskTutor({ nodeId, question });
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

  const handleSelectionAsk = useCallback((text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper') => {
    if (!selectedNode) return;
    const prefix = mode === 'explain' ? 'Explain: ' : mode === 'simpler' ? 'Simplify: ' : mode === 'deeper' ? 'Go deeper on: ' : '';
    handleAskTutor(selectedNode, `${prefix}${text}`);
  }, [selectedNode, handleAskTutor]);

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
        <CreateLessonDialog seed={lessonSeed} open={showCreateDialog} onClose={() => { setShowCreateDialog(false); setLessonSeed(null); }} onImported={() => loadLessons()} />
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
                onClick={() => setView('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Dashboard
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
            <LessonLibrary
              key="library"
              lessons={lessons}
              loading={loading}
              onOpen={loadLesson}
              onCompose={() => setShowCreateDialog(true)}
              onImport={() => setView('import')}
              onWelcome={() => setView('showcase')}
            />
          )}
          {view === 'reader' && lessonData && (
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
            />
          )}
          {view === 'dashboard' && (
            <DashboardView key="dashboard" progress={progress} lessons={lessons} onRefresh={() => loadLessons()} />
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
        </AnimatePresence>
      </div>

      <OnboardingPanel open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <CreateLessonDialog seed={lessonSeed} open={showCreateDialog} onClose={() => { setShowCreateDialog(false); setLessonSeed(null); }} onImported={() => loadLessons()} />
    </div>
  );
}

// ── Reader View (3-pane with responsive behavior) ──

function ReaderView({ lesson, selectedNode, onSelectNode, currentNode, currentLevel, onAsk, onSelectionAsk, onQuizSubmit, tutorOpen, setTutorOpen, tutorQuestion, setTutorQuestion, tutorAnswer, tutorLoading, graphView, progress, mobileOutlineOpen, setMobileOutlineOpen, containerRef, highlights, completedItems, onToggleCheck, completedParts }: {
  lesson: LessonWithNodes;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
  currentNode: RenderableNode | undefined;
  currentLevel: string | undefined;
  onAsk: (nodeId: string, question: string) => void;
  onSelectionAsk: (text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper') => void;
  onQuizSubmit: (nodeId: string, blockId: string, response: string) => void;
  tutorOpen: boolean;
  setTutorOpen: (v: boolean) => void;
  tutorQuestion: string;
  setTutorQuestion: (v: string) => void;
  tutorAnswer: TutorAnswer | null;
  tutorLoading: boolean;
  graphView: 'grid' | 'graph';
  progress: Record<string, NodeProgress>;
  mobileOutlineOpen: boolean;
  setMobileOutlineOpen: (v: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlights: ReturnType<typeof useHighlights>;
  completedItems: string[];
  onToggleCheck: (id: string) => void;
  completedParts: string[];
}) {
  if (!selectedNode && lesson.nodes.length > 0) {
    onSelectNode(lesson.nodes[0].id);
    return null;
  }

  const levelOrder: MasteryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  const { getPart } = (window as any).__LYCEUM_CURRICULUM__ || {};
  const part = lesson.lesson ? { slug: `part-${lesson.lesson.part}`, title: lesson.lesson.title, checklist: [], defaultMasteryTarget: 'L2' as MasteryLevel } : null;

  // Build TOC headings from current node blocks
  const tocHeadings: TOCHeading[] = lesson.nodes.map((n) => ({
    id: n.id,
    text: n.title,
    level: 1,
  }));

  // Mock assessment questions from quiz blocks
  const assessmentQuestions: Question[] = (currentNode?.blocks || [])
    .filter((b) => b.type === 'quiz')
    .map((b, i) => ({
      id: b.id,
      type: 'multiple-choice' as const,
      prompt: (b as any).q || `Question ${i + 1}`,
      options: (b as any).options || ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: '',
      explanation: '',
    }));

  return (
    <>
      {/* Mobile outline dropdown */}
      <div className="lg:hidden border-b border-zinc-800">
        <button
          onClick={() => setMobileOutlineOpen(!mobileOutlineOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 bg-zinc-900/50"
        >
          <span className="truncate">{currentNode?.title || lesson.lesson.title}</span>
          <span className="text-zinc-500 text-xs">{mobileOutlineOpen ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {mobileOutlineOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-zinc-800"
            >
              <div className="p-2 space-y-0.5 bg-zinc-900/30">
                {lesson.nodes.map((node) => {
                  const nodeProgress = node.progress;
                  const level = nodeProgress?.level || 'L0' as MasteryLevel;
                  const isActive = node.id === selectedNode;
                  return (
                    <button
                      key={node.id}
                      onClick={() => { onSelectNode(node.id); setMobileOutlineOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                        isActive ? 'bg-clay-500/15 text-clay-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                    >
                      <MasteryRing level={level} target={node.mastery_target} size={20} strokeWidth={2} />
                      <span className="truncate">{node.title}</span>
                      {node.prereq && node.prereq.length > 0 && !isActive && (
                        <span className="text-[10px] text-zinc-600 ml-auto">{node.prereq.length} prereq</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex h-full">
        {/* Left: Outline + TOC (desktop) */}
        <div className="hidden lg:flex flex-col w-56 shrink-0 border-r border-zinc-800 overflow-y-auto ws-scroll">
          {/* Node outline */}
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 truncate">{lesson.lesson.title}</h3>
            <div className="space-y-0.5">
              {lesson.nodes.map((node) => {
                const nodeProgress = node.progress;
                const level = nodeProgress?.level || 'L0' as MasteryLevel;
                const isActive = node.id === selectedNode;
                const isLocked = (node.prereq || []).some((p) => {
                  const pNode = lesson.nodes.find((n) => n.id === p);
                  const pLevel = pNode?.progress?.level || 'L0';
                  return levelOrder.indexOf(pLevel) < levelOrder.indexOf(node.mastery_target);
                });
                return (
                  <button
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    disabled={isLocked && !isActive}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                      isActive ? 'bg-clay-500/15 text-clay-300' :
                      isLocked ? 'text-zinc-600 cursor-not-allowed' :
                      'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <MasteryRing level={level} target={node.mastery_target} size={20} strokeWidth={2} animated={false} />
                    <span className={`truncate ${isLocked ? 'opacity-50' : ''}`}>{node.title}</span>
                    {isLocked && <span className="text-[10px] text-zinc-600 ml-auto">🔒</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Curriculum TOC */}
          <div className="p-3">
            <TableOfContents
              part={part || { slug: '', title: lesson.lesson.title, checklist: [], defaultMasteryTarget: 'L2', emoji: '\uD83D\uDCD6', trailer: { what: '', why: '', where: '' }, intro: '', rarity: 1, phase: 1 }}
              headings={tocHeadings}
              completedItems={completedItems}
              onNavigate={(id) => onSelectNode(id)}
              activeId={selectedNode ?? undefined}
            />
          </div>
          {/* Checklist compact */}
          <div className="px-3 pb-3">
            <ChecklistProgress
              items={lesson.nodes.map((n) => n.title)}
              completedIds={completedItems}
              onToggle={onToggleCheck}
              partSlug={lesson.lesson.id ?? `lesson-${lesson.lesson.part}`}
              compact
            />
          </div>
        </div>

        {/* Center: Node content OR Graph view */}
        <div className="flex-1 min-w-0 flex flex-col">
          {graphView === 'graph' ? (
            <CurriculumGraph
              nodes={lesson.nodes}
              progress={progress}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 ws-scroll" ref={containerRef}>
              {currentNode ? (
                <div className="max-w-[72ch] mx-auto relative">
                  <div className="flex items-center gap-3 mb-1">
                    <MasteryRing level={currentLevel as MasteryLevel || 'L0'} target={currentNode.mastery_target} size={28} strokeWidth={2.5} />
                    <div>
                      <h2 className="text-xl font-semibold text-zinc-100">{currentNode.title}</h2>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                        <span>Target: {currentNode.mastery_target}</span>
                        {currentLevel && (
                          <>
                            <span>·</span>
                            <span>Your level: {currentLevel}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {currentNode.blocks.map((block) => (
                    <BlockRenderer
                      key={block.id}
                      block={block}
                      onAsk={(blockId, question) => onAsk(currentNode.id, question)}
                      onQuizSubmit={(nid, bid, resp) => onQuizSubmit(nid, bid, resp)}
                      currentLevel={currentLevel}
                      nodeId={currentNode.id}
                    />
                  ))}
                  {/* Checklist */}
                  <div className="mt-8">
                    <ChecklistProgress
                      items={lesson.nodes.map((n) => n.title)}
                      completedIds={completedItems}
                      onToggle={onToggleCheck}
                      partSlug={lesson.lesson.id ?? `lesson-${lesson.lesson.part}`}
                    />
                  </div>
                  {/* Assessment */}
                  {assessmentQuestions.length > 0 && (
                    <div className="mt-6">
                      <AssessmentCard
                        title="Check Your Understanding"
                        questions={assessmentQuestions}
                      />
                    </div>
                  )}
                  {/* Tutor assessment block */}
                  {(() => {
                    if (!tutorAnswer) return null;
                    const parsed = parseAssessmentBlock(tutorAnswer.answer_md);
                    if (!parsed) return null;
                    return (
                      <div className="mt-6">
                        <AssessmentCardBlock
                          assessment={parsed}
                          target={currentNode?.mastery_target}
                          assessedAt={Date.now()}
                        />
                      </div>
                    );
                  })()}
                  {/* Selection floating toolbar */}
                  <SelectionActions
                    containerRef={containerRef as React.RefObject<HTMLDivElement>}
                    onCreateHighlight={(text, start, end, color) =>
                      highlights.createHighlight(text, start, end, color)
                    }
                    onCreateNote={(text, start, end) => {
                      highlights.createHighlight(text, start, end, 'yellow');
                      highlights.editNote(
                        highlights.highlights[highlights.highlights.length - 1]?.id ?? '',
                        text.slice(0, 100),
                      );
                    }}
                    onDeleteHighlight={highlights.deleteHighlight}
                    onAskTutor={(text, mode) => onSelectionAsk(text, mode)}
                    selectedHighlightId={null}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Select a node from the outline
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: TutorPanel */}
        <TutorPanel
          open={tutorOpen}
          onToggle={setTutorOpen}
          nodeId={selectedNode || ''}
          question={tutorQuestion}
          onQuestionChange={setTutorQuestion}
          answer={tutorAnswer}
          loading={tutorLoading}
          onAsk={onAsk}
        />
      </div>
    </>
  );
}

// ── Dashboard View ──

function DashboardView({ progress, lessons, onRefresh }: { progress: Record<string, NodeProgress>; lessons: LessonSummary[]; onRefresh: () => void }) {
  const totalNodes = lessons.reduce((sum, l) => sum + l.nodeCount, 0);
  const masteredNodes = Object.values(progress).filter((p: any) => p.level === 'L5').length;
  const dueNodes = Object.values(progress).filter((p: any) => {
    if (!p.due_at) return false;
    return new Date(p.due_at) <= new Date();
  }).length;

  const levelColors: Record<string, string> = {
    L0: '#5B6472', L1: '#5B8DEF', L2: '#23B5B5',
    L3: '#3CCB7F', L4: '#A78BFA', L5: '#F5C04E',
  };

  const levelOrder: MasteryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Mastery Dashboard</h2>
        <button onClick={onRefresh} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Nodes" value={totalNodes} />
        <StatCard label="Mastered (L5)" value={masteredNodes} />
        <StatCard label="Due for Review" value={dueNodes} />
      </div>

      {/* Level distribution with mastery rings */}
      <div className="p-5 rounded-xl border border-zinc-700/40 bg-zinc-900/40 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Level Distribution</h3>
        <div className="flex items-end gap-2">
          {levelOrder.map((level) => {
            const count = Object.values(progress).filter((p: any) => p.level === level).length;
            const pct = totalNodes > 0 ? (count / totalNodes) * 100 : 0;
            return (
              <div key={level} className="flex-1 flex flex-col items-center gap-2">
                <MasteryRing level={level} size={28} strokeWidth={2.5} animated={false} />
                <div
                  className="w-full rounded transition-all"
                  style={{
                    height: `${Math.max(4, pct * 1.5)}px`,
                    backgroundColor: levelColors[level],
                    opacity: count > 0 ? 0.8 : 0.15,
                  }}
                />
                <div className="text-[10px] text-zinc-500">{level}</div>
                <div className="text-xs font-medium text-zinc-400">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Due reviews */}
      <div className="mt-6 p-5 rounded-xl border border-zinc-700/40 bg-zinc-900/40 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Due Reviews</h3>
        {dueNodes > 0 ? (
          <div className="space-y-2">
            {Object.entries(progress).filter(([, p]: [string, any]) => p.due_at && new Date(p.due_at) <= new Date()).slice(0, 10).map(([nodeId, p]: [string, any]) => (
              <div key={nodeId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/30">
                <span className="text-xs text-zinc-300 truncate">{nodeId}</span>
                <span className="text-[10px] text-amber-400">Due {new Date(p.due_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-600 text-sm">
            <CheckCircle2 className="w-4 h-4 text-sage-400/50" />
            <span>No reviews due — you're up to date!</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-5 rounded-xl border border-zinc-700/40 bg-zinc-900/40 backdrop-blur-sm">
      <div className="text-2xl font-semibold text-zinc-100">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

// ── Import View ──

function ImportView({ importText, setImportText, onImport, onPickFile, onImportExample, importingExample, loading, result, mode, setMode, errors, warnings, onJumpToNode, onShowOnboarding }: {
  importText: string;
  setImportText: (v: string) => void;
  onImport: () => void;
  onPickFile: () => void;
  onImportExample: () => void;
  importingExample: boolean;
  loading: boolean;
  result: any;
  mode: 'pick' | 'paste' | null;
  setMode: (m: 'pick' | 'paste' | null) => void;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  onJumpToNode: (nodeId: string) => void;
  onShowOnboarding: () => void;
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Import lesson</h2>
        <span className="text-[10px] text-zinc-600">lmd-import v2</span>
        <button
          onClick={onShowOnboarding}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          How it works
        </button>
      </div>

      <div className="space-y-6">
        {/* Worked example */}
        <div className="p-5 rounded-xl border border-zinc-700/40 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-zinc-200">Start with the worked example</h3>
              <p className="text-xs text-zinc-500 mt-1">Memory Hierarchy — demonstrates all 10 block types</p>
            </div>
            <button
              onClick={onImportExample}
              disabled={importingExample}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-clay-500/20 hover:bg-clay-500/30 text-clay-300 text-sm font-medium transition border border-clay-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importingExample ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {importingExample ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          <button
            onClick={() => setMode('pick')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              mode === 'pick' ? 'bg-zinc-800/60 text-zinc-200 border-b-2 border-clay-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileUp className="w-3.5 h-3.5 inline mr-1.5" />
            Pick file
          </button>
          <button
            onClick={() => setMode('paste')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              mode === 'paste' ? 'bg-zinc-800/60 text-zinc-200 border-b-2 border-clay-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 inline mr-1.5" />
            Paste lesson
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'pick' && (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                onClick={onPickFile}
                className="w-full flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed border-zinc-700/50 hover:border-zinc-600/50 hover:bg-zinc-800/20 transition text-zinc-400 hover:text-zinc-300 cursor-pointer"
              >
                <FileUp className="w-8 h-8" />
                <div>
                  <div className="text-sm font-medium">Click to select a lesson file</div>
                  <div className="text-xs text-zinc-600 mt-1">.lmd, .ldoc, or .json</div>
                </div>
              </button>
            </motion.div>
          )}

          {mode === 'paste' && (
            <motion.div key="paste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full h-64 px-4 py-3 rounded-xl bg-zinc-800/40 border border-zinc-700/50 text-zinc-200 text-sm font-mono focus:border-clay-500/50 focus:outline-none resize-y placeholder:text-zinc-600 transition"
                placeholder='Paste your .lmd lesson (starts with ---) or compiled .ldoc JSON'
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation report */}
        {(errors.length > 0 || warnings.length > 0) && (
          <ValidationReport errors={errors} warnings={warnings} onJumpToNode={onJumpToNode} />
        )}

        {/* Import button */}
        {importText && (
          <button
            onClick={onImport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-clay-500/20 hover:bg-clay-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-clay-300 font-medium transition border border-clay-500/30"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Import className="w-4 h-4" />}
            {loading ? 'Validating & importing...' : 'Validate & Import'}
          </button>
        )}

        {/* Result feedback */}
        {result && (
          <div className={`p-5 rounded-xl border ${result.ok ? 'border-clay-400/30 bg-clay-500/5 shadow-[0_0_20px_rgba(194,85,58,0.15)]' : 'border-zinc-600/40 bg-zinc-800/40'}`}>
            {result.ok ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sage-400" />
                <div>
                  <div className="text-sm text-clay-300 font-medium">Import successful</div>
                  {result.data.lessonId && <div className="text-xs text-zinc-500 mt-1">Lesson: {result.data.lessonId}</div>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-red-400 font-medium">Import failed</div>
                  <div className="text-xs text-zinc-500 mt-1">{result.error}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

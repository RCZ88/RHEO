import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, Network, Keyboard, BookOpen, Brain, RotateCcw, ImageIcon, FileCode2, Loader2, Link, StickyNote } from 'lucide-react';
import { BlockRenderer } from './blocks/BlockRenderer';
import { PendingIllustrationsPanel } from './blocks/PendingIllustrationsPanel';
import { FlashcardBlock } from './blocks/FlashcardBlock';
import { TutorPanel } from './TutorPanel';
import { NotesPanel } from './NotesPanel';
import { MasteryRing } from './MasteryRing';
import { CurriculumGraph } from './CurriculumGraph';
import { ChecklistProgress } from './ChecklistProgress';
import { AssessmentCard, AssessmentCardBlock, parseAssessmentBlock, type Question } from './AssessmentCard';
import { SelectionActions } from './SelectionActions';
import { NodeSourcesPanel } from './NodeSourcesPanel';
import { useHighlights } from './useHighlights';
import type { LessonWithNodes, RenderableNode, TutorAnswer, MasteryLevel, NodeProgress, LdocBlock } from '../../shared/learn/types';

const api = (window as any).deskflowAPI;

export function ReaderView({ lesson, selectedNode, onSelectNode, currentNode, currentLevel, onAsk, onSelectionAsk, onQuizSubmit, tutorOpen, setTutorOpen, tutorQuestion, setTutorQuestion,   tutorAnswer, tutorLoading, graphView, onSetGraphView, onOpenShortcuts, progress, mobileOutlineOpen, setMobileOutlineOpen, containerRef, highlights, completedItems, onToggleCheck, onApproveProposal, onRejectProposal, onAddMessage, onResolveConversation, onAddNote, onDeleteNote, onTogglePin, tutorConfig, onPersistIllustration }: {
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
  onSetGraphView: (v: 'grid' | 'graph') => void;
  onOpenShortcuts: () => void;
  progress: Record<string, NodeProgress>;
  mobileOutlineOpen: boolean;
  setMobileOutlineOpen: (v: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlights: ReturnType<typeof useHighlights>;
  completedItems: string[];
  onToggleCheck: (id: string) => void;
  onApproveProposal?: (blockId: string) => void;
  onRejectProposal?: (blockId: string, reason?: string) => void;
  onAddMessage?: (blockId: string, text: string) => void;
  onResolveConversation?: (blockId: string) => void;
  onAddNote?: (blockId: string, text: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onTogglePin?: (noteId: string) => void;
  tutorConfig?: { provider: string; model: string } | null;
  onPersistIllustration?: (blockId: string, imagePath: string) => void;
}) {
  if (!selectedNode && lesson.nodes.length > 0) {
    onSelectNode(lesson.nodes[0].id);
    return null;
  }

  // Scroll to top when node changes
  useEffect(() => {
    if (containerRef?.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [currentNode?.id]);

  // Memoize assessment questions — only changes when currentNode blocks change
  const assessmentQuestions: Question[] = useMemo(() => {
    return (currentNode?.blocks || [])
      .filter((b) => b.type === 'quiz')
      .map((b, i) => ({
        id: b.id,
        type: 'multiple-choice' as const,
        prompt: (b as any).q || `Question ${i + 1}`,
        options: (b as any).options || ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: '',
        explanation: '',
      }));
  }, [currentNode?.blocks]);

  // Memoize blocks array — CRITICAL for preventing re-renders
  const blocks: LdocBlock[] = useMemo(() => currentNode?.blocks ?? [], [currentNode]);

  // Reader tab: content | recall | tutor
  const [readerTab, setReaderTab] = useState<'content' | 'recall' | 'tutor'>('content');
  const [dueCards, setDueCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);

  // Load due cards when Recall tab is selected
  const loadDueCards = useCallback(async () => {
    if (!currentNode) return;
    setCardsLoading(true);
    try {
      const result = await api.learnGetDueCards({ limit: 10 });
      if (result.ok) {
        // Filter cards related to current node's lesson
        setDueCards(result.data || []);
      }
    } catch { /* ignore */ }
    setCardsLoading(false);
  }, [currentNode]);

  // Explain with Image state
  const [explainImage, setExplainImage] = useState<{
    loading: boolean;
    result?: { concept: string; metaphor: string; prompt: string; annotations: string[]; imagePath?: string };
    error?: string;
    selectedText?: string;
  }>({ loading: false });

  // Illustrations panel
  const [showIllustrations, setShowIllustrations] = useState(false);

  // LDOC source viewer
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Grounding sources panel
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Notes panel
  const [notesOpen, setNotesOpen] = useState(false);

  const lessonId = lesson.lesson.id != null ? String(lesson.lesson.id) : `lesson-${lesson.lesson.part}`;

  const toggleSource = useCallback(async () => {
    if (sourceOpen) { setSourceOpen(false); return; }
    setSourceOpen(true);
    setSourceLoading(true);
    setSourceError(null);
    try {
      const result = await api.learnGetLessonSource({ lessonId });
      if (result.ok && result.data) {
        let text = result.data;
        if (typeof text === 'string') {
          try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
        } else {
          text = JSON.stringify(text, null, 2);
        }
        setSourceText(text);
      } else {
        setSourceError(result.error || 'Failed to load lesson source');
      }
    } catch (e: any) {
      setSourceError(e.message || 'Failed to load lesson source');
    }
    setSourceLoading(false);
  }, [sourceOpen, lessonId]);

  // Count pending illustrations across all nodes
  const pendingIllustrationCount = useMemo(() => {
    let count = 0;
    for (const node of lesson.nodes) {
      for (const block of (node.blocks || [])) {
        if (block.type === 'illustration' && !(block as any).meta?.image_path) {
          count++;
        }
      }
    }
    return count;
  }, [lesson.nodes]);

  const handleExplainWithImage = useCallback(async (selectedText: string, contextText: string) => {
    setExplainImage({ loading: true, selectedText });
    try {
      const result = await api.learnExplainWithImage({ selectedText, contextText, nodeId: currentNode?.id });
      if (result.ok && result.data) {
        setExplainImage({ loading: false, result: result.data, selectedText });
      } else {
        setExplainImage({ loading: false, error: result.error || 'Failed to generate illustration', selectedText });
      }
    } catch (e: any) {
      setExplainImage({ loading: false, error: e.message || 'Failed to generate illustration', selectedText });
    }
  }, [currentNode?.id]);

  // Stable callbacks — empty deps = stable forever, never create new references
  const handleBlockAsk = useCallback((blockId: string, question: string) => {
    if (currentNode) onAsk(currentNode.id, question);
  }, [currentNode?.id, onAsk]);

  const handleQuizSubmit = useCallback((nid: string, bid: string, resp: string) => {
    onQuizSubmit(nid, bid, resp);
  }, [onQuizSubmit]);

  const handleCreateHighlight = useCallback((text: string, start: number, end: number, color: any) => {
    highlights.createHighlight(text, start, end, color);
  }, [highlights]);

  const handleCreateNote = useCallback((text: string, start: number, end: number) => {
    if (onAddNote && selectedNode) {
      onAddNote(`text-${start}-${end}`, text);
    }
  }, [onAddNote, selectedNode]);

  const handleDeleteHighlight = useCallback((id: string) => {
    highlights.deleteHighlight(id);
  }, [highlights]);

  const handleAskTutor = useCallback((text: string, mode: 'explain' | 'ask' | 'simpler' | 'deeper') => {
    onSelectionAsk(text, mode);
  }, [onSelectionAsk]);

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
                return (
                  <button
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                      isActive ? 'bg-clay-500/15 text-clay-300' :
                      'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <MasteryRing level={level} target={node.mastery_target} size={20} strokeWidth={2} animated={false} />
                    <span className="truncate">{node.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Always show tab bar + toggle, content switches */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tab bar: Content | Recall + graph toggle — always visible */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800/60 shrink-0">
            {([
              { key: 'content' as const, icon: BookOpen, label: 'Content' },
              { key: 'recall' as const, icon: RotateCcw, label: 'Recall' },
            ]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => {
                  setReaderTab(key);
                  if (key === 'recall') loadDueCards();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  readerTab === key
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                }`}
              >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}

                {/* Source (raw LDOC) */}
                <button
                  onClick={toggleSource}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sourceOpen
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                  title="View raw lesson source"
                  aria-label="View raw lesson source"
                >
                  <FileCode2 className="w-3 h-3" />
                  Source
                </button>

                {/* Grounding Sources */}
                {currentNode && (
                  <button
                    onClick={() => setSourcesOpen(!sourcesOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sourcesOpen
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                    title="Edit grounding sources for this node"
                    aria-label="Edit grounding sources"
                  >
                    <Link className="w-3 h-3" />
                    Sources
                  </button>
                )}

                {/* Notes */}
                {currentNode && (
                  <button
                    onClick={() => setNotesOpen(!notesOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      notesOpen
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                    title="View and add notes"
                    aria-label="Toggle notes panel"
                  >
                    <StickyNote className="w-3 h-3" />
                    Notes
                  </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Illustrations pending badge */}
                {pendingIllustrationCount > 0 && (
                  <button
                    onClick={() => setShowIllustrations(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                  >
                    <ImageIcon className="w-3 h-3" />
                    {pendingIllustrationCount} illustration{pendingIllustrationCount !== 1 ? 's' : ''} pending
                  </button>
                )}

                {/* Tutor toggle */}
                <button
                  onClick={() => setTutorOpen(!tutorOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tutorOpen
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                >
                  <Brain className="w-3 h-3" />
                  Tutor
                </button>

                <div className="w-px h-4 bg-zinc-800 mx-1" />

                {/* Keyboard shortcuts */}
                <button
                  onClick={onOpenShortcuts}
                  className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition"
                  title="Keyboard shortcuts"
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>

                {/* View toggle: grid | graph */}
                <div className="flex items-center rounded-lg bg-zinc-900/60 border border-zinc-800 p-0.5">
                  <button
                    onClick={() => onSetGraphView('grid')}
                    className={`p-1 rounded transition ${graphView === 'grid' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSetGraphView('graph')}
                    className={`p-1 rounded transition ${graphView === 'graph' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Graph view"
                    aria-label="Graph view"
                  >
                    <Network className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content area — hidden when graph view is active */}
              {graphView !== 'graph' && readerTab === 'content' && sourceOpen ? (
                <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 ws-scroll">
                  <div className="max-w-[88ch] mx-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                        <FileCode2 className="w-4 h-4 text-clay-400" />
                        Lesson source (.ldoc)
                      </h3>
                      <span className="font-mono text-[10px] text-zinc-600">{lessonId}</span>
                    </div>
                    {sourceLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-5 h-5 text-clay-400 animate-spin" />
                      </div>
                    ) : sourceError ? (
                      <div className="flex flex-col items-center gap-3 py-16">
                        <p className="text-xs text-red-400">{sourceError}</p>
                        <button
                          onClick={toggleSource}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <pre className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 text-[11px] font-mono leading-relaxed text-zinc-400 whitespace-pre overflow-x-auto max-h-[70vh] overflow-y-auto">
                        {sourceText}
                      </pre>
                    )}
                  </div>
                </div>
              ) : graphView !== 'graph' && readerTab === 'content' ? (
                <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 ws-scroll" ref={containerRef} style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                  {currentNode ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentNode.id}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="max-w-[72ch] mx-auto relative select-text"
                        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                      >
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
                        {blocks.map((block) => (
                          <div key={block.id} className={(block as any).is_expansion ? 'border-l-2 border-sage-400/40 pl-4' : ''}>
                            <BlockRenderer
                              block={block}
                              onAsk={handleBlockAsk}
                              onQuizSubmit={handleQuizSubmit}
                              onQuizSkip={(nid, bid) => { if (handleQuizSubmit) handleQuizSubmit(nid, bid, '__skip__'); }}
                              currentLevel={currentLevel}
                              nodeId={currentNode.id}
                              onApproveProposal={onApproveProposal}
                              onRejectProposal={onRejectProposal}
                              onAddMessage={onAddMessage}
                              onResolveConversation={onResolveConversation}
                              onAddNote={onAddNote}
                              onDeleteNote={onDeleteNote}
                              onTogglePin={onTogglePin}
                              onIllustrationGenerated={onPersistIllustration}
                            />
                          </div>
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
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center h-full text-zinc-600 text-sm"
                    >
                      Select a node from the outline
                    </motion.div>
                  )}
                </div>
              ) : graphView !== 'graph' && readerTab === 'recall' ? (
                /* Recall Tab — Flashcard review */
                <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 ws-scroll">
                  <div className="max-w-[480px] mx-auto">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-zinc-100 mb-1">Active Recall</h3>
                      <p className="text-xs text-zinc-500">Review due flashcards to strengthen your memory.</p>
                    </div>
                    {cardsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                      </div>
                    ) : dueCards.length > 0 ? (
                      <div className="space-y-4">
                        {dueCards.slice(0, 5).map((card: any, i: number) => (
                          <FlashcardBlock
                            key={card.id || i}
                            meta={{
                              deck_id: card.deck_id || '',
                              card_type: card.card_type || 'basic',
                              front: card.front || '',
                              back: card.back || '',
                              tags: card.tags ? JSON.parse(card.tags) : [],
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-2xl bg-sage-400/10 border border-sage-400/20 flex items-center justify-center mx-auto mb-3">
                          <RotateCcw className="w-6 h-6 text-sage-400" />
                        </div>
                        <p className="text-sm text-zinc-400">No cards due for review</p>
                        <p className="text-xs text-zinc-600 mt-1 mb-4">Generate flashcards from this lesson's content</p>
                        <button
                          onClick={async () => {
                            if (!currentNode) return;
                            try {
                              const res = await (window as any).deskflowAPI?.learnGenerateCards?.({
                                deckId: `deck-${currentNode.id}`,
                                nodeContent: currentNode.blocks?.map((b: any) => b.text || b.src || b.q || '').join('\n') || '',
                              });
                              if (res?.ok) loadDueCards();
                            } catch { /* ignore */ }
                          }}
                          className="px-4 py-2 rounded-lg bg-sage-500/20 hover:bg-sage-500/30 text-sage-300 text-xs font-medium transition border border-sage-500/30"
                        >
                          Generate Cards
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Selection toolbar — OUTSIDE the motion.div, rendered via portal to document.body */}
              {readerTab === 'content' && !sourceOpen && graphView !== 'graph' && (
                <SelectionActions
                  containerRef={containerRef as React.RefObject<HTMLDivElement>}
                  onCreateHighlight={handleCreateHighlight}
                  onCreateNote={handleCreateNote}
                  onDeleteHighlight={handleDeleteHighlight}
                  onAskTutor={handleAskTutor}
                  onExplainWithImage={handleExplainWithImage}
                  selectedHighlightId={null}
                />
              )}

              {/* Graph view content */}
              {graphView === 'graph' && (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CurriculumGraph
                    nodes={lesson.nodes}
                    progress={progress}
                    selectedNode={selectedNode}
                    onSelectNode={onSelectNode}
                    onExit={() => onSetGraphView('grid')}
                  />
                </div>
              )}
        </div>

        {/* Right: TutorPanel — only show when tutorOpen is true (toggled from tab bar) */}
        {tutorOpen && (
          <TutorPanel
            open={tutorOpen}
            onToggle={setTutorOpen}
            nodeId={selectedNode || ''}
            question={tutorQuestion}
            onQuestionChange={setTutorQuestion}
            answer={tutorAnswer}
            loading={tutorLoading}
            onAsk={onAsk}
            tutorConfig={tutorConfig}
            onAddNote={onAddNote}
          />
        )}

        {/* Right: NotesPanel — show when notesOpen is true */}
        {notesOpen && selectedNode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 border-l border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-emerald-400" />
                Notes
              </span>
              <button
                onClick={() => setNotesOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition"
                aria-label="Close notes panel"
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NotesPanel
                getNotes={async () => {
                  const res = await api?.learnGetAllNotes?.({ limit: 50 });
                  return res?.ok ? (res.data || []) : [];
                }}
                deleteNote={async (id: string) => { await api?.learnDeleteNote?.({ noteId: id }); }}
                togglePin={async (id: string) => { await api?.learnToggleNotePin?.({ noteId: id, pinned: true }); }}
              />
            </div>
          </motion.div>
        )}

        {/* Explain with Image Modal */}
        {(explainImage.loading || explainImage.result || explainImage.error) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setExplainImage({ loading: false })}>
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Visual Explanation</h3>
                    {explainImage.selectedText && (
                      <p className="text-[10px] text-zinc-500 max-w-xs truncate">"{explainImage.selectedText}"</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setExplainImage({ loading: false })} className="text-zinc-500 hover:text-zinc-300 text-xs">Close</button>
              </div>

              {/* Content */}
              <div className="p-5">
                {explainImage.loading ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    <p className="text-xs text-zinc-500">AI is thinking of a visual explanation...</p>
                  </div>
                ) : explainImage.error ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-red-400">{explainImage.error}</p>
                    <button onClick={() => setExplainImage({ loading: false })} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300">Try again</button>
                  </div>
                ) : explainImage.result ? (
                  <div className="space-y-4">
                    {/* Concept + Metaphor */}
                    <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-300 font-medium">{explainImage.result.concept}</p>
                      <p className="text-[10px] text-amber-400/70 mt-0.5">Visual metaphor: {explainImage.result.metaphor}</p>
                    </div>

                    {/* Image */}
                    {explainImage.result.imagePath ? (
                      <div className="rounded-lg overflow-hidden border border-zinc-800">
                        <img src={`file://${explainImage.result.imagePath}`} alt="Visual explanation" className="w-full" style={{ background: '#fff' }} />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
                        <p className="text-xs text-zinc-500">Image not generated yet</p>
                        <p className="text-[10px] text-zinc-600 mt-1">Enable image generation in Learn → Profile → AI Illustrations</p>
                      </div>
                    )}

                    {/* Annotations */}
                    {explainImage.result.annotations && explainImage.result.annotations.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {explainImage.result.annotations.map((ann, i) => (
                          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{ann}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Illustrations panel */}
      <PendingIllustrationsPanel
        lesson={lesson}
        open={showIllustrations}
        onClose={() => setShowIllustrations(false)}
        onNavigateToNode={(id) => { onSelectNode(id); setShowIllustrations(false); }}
        onImageUploaded={onPersistIllustration}
      />

      {/* Grounding Sources panel — side panel */}
      {currentNode && sourcesOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 border-l border-zinc-800 bg-zinc-900/30 flex flex-col overflow-hidden"
        >
          <NodeSourcesPanel
            nodeId={currentNode.id}
            open={sourcesOpen}
            onClose={() => setSourcesOpen(false)}
          />
        </motion.div>
      )}
    </>
  );
}

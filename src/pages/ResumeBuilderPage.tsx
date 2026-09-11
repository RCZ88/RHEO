import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Loader2, Settings, AlertTriangle, ChevronDown, ChevronUp, History, CheckCircle, Lock, Rocket, Briefcase, FolderOpen, Code2, TrendingUp, Search, FileText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResumeStore } from '../stores/resumeStore';
import { CareerTapestry } from '../features/resume/components/CareerTapestry';
import { QuestionCard } from '../features/resume/components/QuestionCard';
import { AnswerInput } from '../features/resume/components/AnswerInput';
import { AiFeedbackBox } from '../features/resume/components/AiFeedbackBox';
import { ResumePreview } from '../features/resume/components/ResumePreview';
import { ProgressBar } from '../features/resume/components/ProgressBar';
import { ResizablePanel } from '../features/resume/components/ResizablePanel';
import { AiProviderSelectModal } from '../components/AiProviderSelectModal';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { PHASE_NAMES, QUALITY_COLORS } from '../types/resume';
import type { ProviderOption, RoutingEntry } from '../components/AiProviderSelectModal';

const phaseIcons: Record<number, any> = {
  1: Rocket, 2: Briefcase, 3: FolderOpen, 4: Code2,
  5: TrendingUp, 6: Search, 7: FileText,
};

const totalQuestionsPerPhase = [4, 7, 6, 6, 4, 4, 6];

export default function ResumeBuilderPage() {
  const navigate = useNavigate();
  const {
    builderProgress, currentQuestion, aiFeedback, resumeContent, score,
    updateBuilderProgress, setCurrentQuestion, setAiFeedback, submitAnswer,
    isSaving, isLoading, setIsLoading, saveProgress, loadProgress,
  } = useResumeStore();

  const [answer, setAnswer] = useState<any>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const [skipWarningMessage, setSkipWarningMessage] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [previewMode, setPreviewMode] = useState<'styled' | 'ats_raw'>('styled');
  const [scale, setScale] = useState(50);
  const [showHistory, setShowHistory] = useState(false);
  const [revisitIndex, setRevisitIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // AI Provider state
  const [aiProviders, setAiProviders] = useState<ProviderOption[]>([]);
  const [aiRouting, setAiRouting] = useState<RoutingEntry | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  const totalQ = totalQuestionsPerPhase.reduce((a, b) => a + b, 0);
  const currentQNum = totalQuestionsPerPhase.slice(0, builderProgress.currentPhase - 1).reduce((a, b) => a + b, 0) + 1;

  const phaseHistory = (builderProgress.questionHistory ?? []).filter(
    (h) => h.question.phase === builderProgress.currentPhase
  );
  const isRevisitMode = revisitIndex !== null;
  const isFirstInPhase = phaseHistory.length === 0 || (isRevisitMode && revisitIndex === 0);
  const hasProviderConfigured = aiRouting !== null && !!aiRouting.providerId;

  // Load saved progress (or first question if nothing saved) on mount
  useEffect(() => {
    if (!currentQuestion) {
      initProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore previously saved builder progress from resume-data.json
  const initProgress = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const restored = await loadProgress();
      const hydrated = builderProgress;
      const hasAnswers = (p: any) =>
        p && (Object.keys(p.answers || {}).length > 0 || (p.questionHistory ?? []).length > 0);
      const hydratedHasData = hasAnswers(hydrated);
      const restoredHasData = hasAnswers(restored);
      if (!restoredHasData && !hydratedHasData) {
        await loadFirstQuestion();
        return;
      }
      const progress = restoredHasData ? restored : hydrated;
      const phaseStatus = Object.fromEntries(
        Object.entries(progress.phaseStatus || {}).map(([k, v]) => [Number(k), v])
      ) as Record<number, 'locked' | 'in_progress' | 'complete'>;
      updateBuilderProgress({ ...progress, phaseStatus });
      const phase = progress.currentPhase ?? 1;
      const hist = Array.isArray(progress.questionHistory) ? progress.questionHistory : [];
      const phaseHist = hist.filter((h: any) => h?.question?.phase === phase);
      const last = phaseHist.length ? phaseHist[phaseHist.length - 1] : hist.length ? hist[hist.length - 1] : null;
      if (last) {
        const result = await (window as any).deskflowAPI?.resume?.nextQuestion?.({
          currentPhase: phase,
          currentQuestionId: last.questionId,
          previousAnswers: progress.answers || {},
          targetRole: '',
          careerLevel: 'mid',
        });
        if (result?.nextQuestion) {
          setCurrentQuestion(result.nextQuestion);
          setAiFeedback(result.aiFeedback);
          return;
        }
      }
      await loadFirstQuestion(phase);
    } catch (e: any) {
      console.error('[Builder] Failed to restore progress:', e);
      setLoadError(e?.message || 'Failed to restore progress.');
      await loadFirstQuestion();
    } finally {
      setIsLoading(false);
    }
  };

  // Explicit Save button — persists builder progress to resume-data.json
  const handleSave = async () => {
    const ok = await saveProgress();
    if (ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    }
  };

  // Load AI providers on mount
  useEffect(() => {
    (async () => {
      try {
        const state = await (window as any).deskflowAPI?.getAiProviders?.();
        if (state?.providers) {
          setAiProviders(state.providers.map((p: any) => ({
            id: p.id, label: p.label, models: p.models || [], enabled: p.enabled,
          })));
          setAiRouting(state.routing?.resumeBuilder ?? null);
        }
      } catch (e) {
        console.error('[Builder] AI provider load failed:', e);
      }
    })();
  }, []);

  // Global Alt+Left handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phaseHistory, revisitIndex, builderProgress.questionHistory]);

  const loadFirstQuestion = async (phase?: number) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const result = await (window as any).deskflowAPI?.resume?.nextQuestion({
        currentPhase: phase || builderProgress.currentPhase,
        currentQuestionId: builderProgress.currentQuestionId,
        previousAnswers: builderProgress.answers,
        targetRole: '',
        careerLevel: 'mid',
      });
      if (result?.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
        setAiFeedback(result.aiFeedback);
      }
    } catch (e: any) {
      console.error('[Builder] Failed to load question:', e);
      setLoadError(e?.message || 'Failed to load question.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhaseClick = (phase: number) => {
    if (phase !== builderProgress.currentPhase) {
      const incompletePrior = Object.entries(builderProgress.phaseStatus)
        .filter(([p, s]) => parseInt(p) < phase && s !== 'complete').length;
      if (incompletePrior > 0) {
        setSkipWarningMessage(`You're skipping ${incompletePrior} incomplete phase${incompletePrior > 1 ? 's' : ''}. The preview may show partial data.`);
        setShowSkipWarning(true);
        setTimeout(() => setShowSkipWarning(false), 4000);
      }
      updateBuilderProgress({ currentPhase: phase });
      setRevisitIndex(null);
      loadFirstQuestion(phase);
    }
  };

  const handleSubmit = async () => {
    if (!answer || !currentQuestion) return;
    try {
      setIsLoading(true);

      const result = await (window as any).deskflowAPI?.resume?.submitAnswer(
        currentQuestion.id,
        answer,
        builderProgress.currentPhase
      );
      if (!result) return;

      if (isRevisitMode && revisitIndex !== null) {
        const newHistory = [...builderProgress.questionHistory];
        newHistory[revisitIndex] = {
          questionId: currentQuestion.id,
          question: currentQuestion,
          answer,
          aiFeedback: result.aiFeedback,
          timestamp: new Date().toISOString(),
        };
        updateBuilderProgress({
          questionHistory: newHistory,
          answers: { ...builderProgress.answers, [currentQuestion.id]: answer },
        });
        setAiFeedback(result.aiFeedback);
        setRevisitIndex(null);
      } else {
        const entry = {
          questionId: currentQuestion.id,
          question: currentQuestion,
          answer,
          aiFeedback: result.aiFeedback,
          timestamp: new Date().toISOString(),
        };
        const newHistory = [...builderProgress.questionHistory, entry];
        updateBuilderProgress({
          questionHistory: newHistory,
          answers: { ...builderProgress.answers, [currentQuestion.id]: answer },
          currentQuestionId: result.nextQuestion?.id ?? currentQuestion.id,
          overallPercent: result.progress?.overallPercent ?? builderProgress.overallPercent,
          phaseStatus: result.progress?.phaseStatus
            ? (Object.fromEntries(
                Object.entries(result.progress.phaseStatus).map(([k, v]) => [Number(k), v])
              ) as Record<number, 'locked' | 'in_progress' | 'complete'>)
            : builderProgress.phaseStatus,
        });
        setCurrentQuestion(result.nextQuestion);
        setAiFeedback(result.aiFeedback);
        setAnswer('');
      }
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 10000);
    } catch (e) {
      console.error('[Builder] Submit failed:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = useCallback(() => {
    const hist = (builderProgress.questionHistory ?? []).filter(
      (h) => h.question.phase === builderProgress.currentPhase
    );
    if (hist.length === 0) return;
    const newIndex = revisitIndex === null
      ? hist.length - 1
      : Math.max(0, revisitIndex - 1);
    if (newIndex === revisitIndex) return;
    const entry = hist[newIndex];
    const globalIdx = builderProgress.questionHistory.indexOf(entry);
    setRevisitIndex(globalIdx);
    setCurrentQuestion(entry.question);
    setAnswer(entry.answer);
    setAiFeedback(entry.aiFeedback);
    setShowFeedback(true);
  }, [builderProgress.questionHistory, builderProgress.currentPhase, revisitIndex]);

  const handleHistoryClick = (globalIdx: number) => {
    const entry = builderProgress.questionHistory[globalIdx];
    if (!entry) return;
    setRevisitIndex(globalIdx);
    setCurrentQuestion(entry.question);
    setAnswer(entry.answer);
    setAiFeedback(entry.aiFeedback);
    setShowFeedback(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentQuestion) return;
    const t = currentQuestion.inputType;

    if (t === 'textarea') {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    if (t === 'tags') {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFit = () => {
    const container = previewContainerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth - 16;
    const resumeWidthPx = 850;
    const fitScale = Math.round((containerWidth / resumeWidthPx) * 100);
    setScale(Math.max(25, Math.min(100, fitScale)));
  };

  const handleSaveRouting = async (entry: RoutingEntry | null) => {
    try {
      const state = await (window as any).deskflowAPI?.getAiProviders?.();
      const providers = state?.providers || [];
      const routing = { ...(state?.routing || {}) };
      if (entry === null) {
        delete routing.resumeBuilder;
      } else {
        routing.resumeBuilder = entry;
      }
      await (window as any).deskflowAPI?.saveAiProviders?.({ providers, routing });
      setAiRouting(entry);
    } catch (e) {
      console.error('[Builder] AI routing save failed:', e);
    }
  };

  const getPhaseState = (phase: number) => builderProgress.phaseStatus[phase] || 'locked';

  // ────── Builder content (left panel) ──────
  const renderBuilderContent = () => (
    <div className="px-5">
      {isLoading && !currentQuestion ? (
        <div className="space-y-4">
          <Skeleton className="h-[80px] rounded-xl" />
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-14 rounded-xl w-2/3" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); loadFirstQuestion(); }}
              className="mt-2 text-xs text-red-300 hover:text-white underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      ) : currentQuestion ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={isRevisitMode ? `revisit-${revisitIndex}` : builderProgress.currentPhase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <ProgressBar
              currentPhase={builderProgress.currentPhase}
              totalPhases={7}
              phaseStatus={builderProgress.phaseStatus}
              overallPercent={builderProgress.overallPercent}
            />

            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQNum}
              totalQuestions={totalQ}
            />

            {/* History panel */}
            <AnimatePresence initial={false}>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-2 mb-4">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                        Phase History · {phaseHistory.length} answered
                      </span>
                    </div>
                    {phaseHistory.length === 0 ? (
                      <div className="px-3 pb-3 text-[11px] text-zinc-600">
                        No questions answered in this phase yet.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                        {phaseHistory.map((entry, i) => {
                          const globalIdx = builderProgress.questionHistory.indexOf(entry);
                          const isCurrent = revisitIndex === globalIdx;
                          const quality = entry.aiFeedback?.quality;
                          return (
                            <motion.button
                              key={`${entry.questionId}-${entry.timestamp}`}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                              onClick={() => handleHistoryClick(globalIdx)}
                              className={`w-full p-3 rounded-lg hover:bg-zinc-800/30 cursor-pointer transition-colors duration-150 text-left ${
                                isCurrent
                                  ? 'ring-1 ring-[var(--page-accent)]/30 bg-[var(--page-accent)]/5'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-zinc-600 tabular-nums">
                                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {quality && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ring-1 ${QUALITY_COLORS[quality]}`}>
                                    {quality.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-300 line-clamp-2 mb-1">
                                {entry.question.text}
                              </div>
                              <div className="text-[11px] text-zinc-500 line-clamp-1">
                                {String(entry.answer ?? '').slice(0, 80)}
                                {String(entry.answer ?? '').length > 80 ? '…' : ''}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div onKeyDown={handleKeyDown} className="space-y-4">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider block">
                {isRevisitMode ? 'Revisit Answer' : 'Your Answer'}
              </label>
              <AnswerInput
                inputType={currentQuestion.inputType}
                value={answer}
                onChange={setAnswer}
                validation={currentQuestion.validation}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentQuestion.inputType === 'metric'
                    ? 'e.g., 42%, 3 months, $50k'
                    : currentQuestion.inputType === 'tags'
                    ? 'Type and press Enter...'
                    : 'Type your answer here...'
                }
              />

              {/* Buttons row */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={isFirstInPhase ? {} : { scale: 1.01 }}
                  whileTap={isFirstInPhase ? {} : { scale: 0.98 }}
                  onClick={handlePrevious}
                  disabled={isFirstInPhase}
                  className="h-14 px-5 rounded-xl bg-zinc-800/60 ring-1 ring-zinc-700/50 text-zinc-300 text-sm font-medium flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800/80 hover:text-white transition-colors"
                  title="Previous question (Alt+←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={!answer || isSaving || isLoading}
                  className="flex-1 h-14 rounded-xl bg-[var(--page-accent)] text-white font-semibold text-sm flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-[0_0_24px_rgba(99,102,241,0.25)] hover:shadow-[0_0_36px_rgba(99,102,241,0.4)]"
                >
                  {isSaving || isLoading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Analyzing your answer…</span>
                    </>
                  ) : isRevisitMode ? (
                    <>
                      <span>Update Answer</span>
                      <CheckCircle className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Submit Answer</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            <AiFeedbackBox
              feedback={aiFeedback}
              visible={showFeedback}
              onDismiss={() => setShowFeedback(false)}
            />

            {!hasProviderConfigured && showFeedback && (
              <button
                onClick={() => setAiModalOpen(true)}
                className="text-[11px] text-zinc-500 hover:text-[var(--page-accent)] transition-colors flex items-center gap-1.5 mt-2"
              >
                <Sparkles className="w-3 h-3" />
                Configure AI in Settings for real feedback
              </button>
            )}

            {/* Journey Checklist */}
            <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 overflow-hidden">
              <button
                onClick={() => setShowChecklist(!showChecklist)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-zinc-800/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400">Journey Checklist</span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    {Object.values(builderProgress.phaseStatus).filter(s => s === 'complete').length}/7 phases
                  </span>
                </div>
                {showChecklist ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
              </button>
              <AnimatePresence>
                {showChecklist && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-1">
                      {Array.from({ length: 7 }, (_, i) => {
                        const phase = i + 1;
                        const state = getPhaseState(phase);
                        const Icon = phaseIcons[phase] || FileText;
                        const phaseQuestionCount = totalQuestionsPerPhase[i];
                        const answeredInPhase = (builderProgress.questionHistory ?? []).filter(
                          (h) => h.question.phase === phase
                        ).length;

                        return (
                          <button
                            key={phase}
                            onClick={() => {
                              if (state === 'locked') return;
                              if (state === 'complete' || state === 'in_progress') handlePhaseClick(phase);
                            }}
                            disabled={state === 'locked'}
                            title={state === 'locked' ? 'Complete previous phases first' : undefined}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all duration-150 ${
                              state === 'locked'
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-zinc-800/30 cursor-pointer'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              state === 'complete'
                                ? 'bg-emerald-500/15 ring-1 ring-emerald-500/20'
                                : state === 'in_progress'
                                ? 'bg-[var(--page-accent)]/15 ring-1 ring-[var(--page-accent)]/20'
                                : 'bg-zinc-800/60'
                            }`}>
                              {state === 'complete' ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              ) : state === 'in_progress' ? (
                                <Icon className="w-3.5 h-3.5 text-[var(--page-accent)]" />
                              ) : (
                                <Lock className="w-3 h-3 text-zinc-600" />
                              )}
                            </div>

                            <span className={`text-xs flex-1 text-left ${
                              state === 'locked'
                                ? 'text-zinc-600'
                                : state === 'complete'
                                ? 'text-zinc-300'
                                : 'text-white'
                            }`}>
                              {phase}. {PHASE_NAMES[phase]}
                            </span>

                            {state === 'complete' && (
                              <span className="text-[10px] text-emerald-400 font-medium tabular-nums">
                                Done · {phaseQuestionCount}/{phaseQuestionCount}
                              </span>
                            )}
                            {state === 'in_progress' && (
                              <span className="text-[10px] text-[var(--page-accent)] font-medium tabular-nums">
                                Current · {answeredInPhase}/{phaseQuestionCount}
                              </span>
                            )}
                            {state === 'locked' && (
                              <span className="text-[10px] text-zinc-600 font-medium tabular-nums">
                                0/{phaseQuestionCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[var(--page-accent)] animate-spin mb-3" />
          <p className="text-sm text-zinc-400">Loading first question...</p>
        </div>
      )}
    </div>
  );

  // ────── Preview content (right panel) ──────
  const renderPreviewContent = () => (
    <div className="px-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Live Preview</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={25}
            max={100}
            step={5}
            value={scale}
            onChange={(e) => setScale(parseInt(e.target.value, 10))}
            className="w-20 h-1.5 rounded-full bg-zinc-700 accent-[var(--page-accent)] cursor-pointer"
            aria-label="Preview zoom"
          />
          <span className="text-[10px] tabular-nums text-zinc-500 w-10 text-center">
            {scale}%
          </span>
          <button
            onClick={handleFit}
            className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Fit to panel width"
          >
            Fit
          </button>
          <div className="w-px h-3 bg-zinc-700/50 mx-0.5" />
          <button
            onClick={() => setPreviewMode('styled')}
            className={`text-[10px] px-2.5 py-1 rounded-lg transition-all duration-150 ${
              previewMode === 'styled'
                ? 'text-white bg-[var(--page-accent)]/15 ring-1 ring-[var(--page-accent)]/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Styled
          </button>
          <button
            onClick={() => setPreviewMode('ats_raw')}
            className={`text-[10px] px-2.5 py-1 rounded-lg transition-all duration-150 ${
              previewMode === 'ats_raw'
                ? 'text-white bg-[var(--page-accent)]/15 ring-1 ring-[var(--page-accent)]/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            ATS Raw
          </button>
        </div>
      </div>
      <div
        ref={previewContainerRef}
        className="flex-1 rounded-xl overflow-hidden border border-zinc-800/60 shadow-lg shadow-black/20 relative"
        onWheel={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          const delta = e.deltaY < 0 ? 5 : -5;
          setScale((s) => Math.max(25, Math.min(100, s + delta)));
        }}
      >
        {!resumeContent || (!resumeContent.summary && (!resumeContent.experience || resumeContent.experience.length === 0)) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-zinc-950/40">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Rocket className="w-10 h-10 text-zinc-700 mb-3 mx-auto" />
              <p className="text-sm text-zinc-500 max-w-[220px]">
                Start answering questions to see your resume build here
              </p>
            </motion.div>
          </div>
        ) : (
          <ResumePreview content={resumeContent} mode={previewMode} scale={scale} />
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ '--page-accent': 'rgb(99, 102, 241)' } as any}>
      {/* Sticky Header */}
      <div className="shrink-0 border-b border-zinc-800/60 px-5 h-14 bg-gradient-to-r from-zinc-900/90 to-zinc-800/70 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/resume')} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Hub
          </button>
          <div className="w-px h-5 bg-zinc-700/50" />
          <div className="flex items-center gap-2">
            {(() => { const Icon = phaseIcons[builderProgress.currentPhase] || FileText; return <Icon className="w-4 h-4 text-[var(--page-accent)]" />; })()}
            <span className="text-sm font-semibold text-white">{PHASE_NAMES[builderProgress.currentPhase]}</span>
            <span className="text-[10px] text-zinc-500">Phase {builderProgress.currentPhase} of 7</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--page-accent)]/10 ring-1 ring-[var(--page-accent)]/20">
            <span className="text-xs text-[var(--page-accent)] font-bold tabular-nums">{score.current}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className={`relative text-zinc-400 hover:text-white ${showHistory ? 'text-white' : ''}`}
            title="Question history"
          >
            <History className="w-3.5 h-3.5" />
            {phaseHistory.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--page-accent)] text-[8px] font-bold text-white flex items-center justify-center">
                {phaseHistory.length}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAiModalOpen(true)}
            className="text-zinc-400 hover:text-white"
            title="AI provider settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={isSaving || justSaved} title="Save progress" className={`text-zinc-400 hover:text-white ${justSaved ? 'text-emerald-400' : ''}`}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : justSaved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Mini Tapestry */}
      <div className="shrink-0 border-b border-zinc-800/40 px-5 py-2 bg-gradient-to-r from-zinc-900/60 to-zinc-800/30">
        <CareerTapestry
          phaseStatus={builderProgress.phaseStatus as Record<number, 'locked' | 'in_progress' | 'complete'>}
          currentPhase={builderProgress.currentPhase}
          onPhaseClick={handlePhaseClick}
          compact
        />
      </div>

      {/* Skip Warning */}
      <AnimatePresence>
        {showSkipWarning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="shrink-0 px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-300">{skipWarningMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content — true split panel */}
      <div className="flex-1 min-h-0">
        <ResizablePanel
          storageKey="resume-split-ratio"
          defaultRatio={55}
          minRatio={30}
          maxRatio={80}
          left={renderBuilderContent()}
          right={renderPreviewContent()}
        />
      </div>

      <AiProviderSelectModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        featureKey="resumeBuilder"
        featureLabel="Resume Builder AI"
        accentColor="from-indigo-500/20 to-indigo-600/5"
        providers={aiProviders}
        currentRouting={aiRouting}
        onSave={handleSaveRouting}
      />
    </div>
  );
}

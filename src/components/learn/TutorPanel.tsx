import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, Sparkles, AlertTriangle, RefreshCw, Maximize2, MessageSquare, StopCircle, Loader2, Bookmark } from 'lucide-react';
import DOMPurify from 'dompurify';
import type { TutorAnswer } from '../../shared/learn/types';

type TutorState = 'idle' | 'streaming' | 'grounded' | 'out-of-scope' | 'error';

interface QAPair {
  question: string;
  answer: string;
  ts: string;
}

interface Props {
  open: boolean;
  onToggle: (v: boolean) => void;
  nodeId: string;
  question: string;
  onQuestionChange: (v: string) => void;
  answer?: TutorAnswer | null;
  loading?: boolean;
  onAsk?: (nodeId: string, question: string) => void;
  tutorConfig?: { provider: string; model: string } | null;
  onAddNote?: (blockId: string, text: string) => void;
}

const SUGGESTIONS = [
  'Explain this concept in simpler terms',
  'Give me a concrete example',
  'How does this connect to what I already know?',
  'What are common misconceptions?',
];

const api = (window as any).deskflowAPI || (window as any).api;

function renderAnswerHtml(md: string): string {
  return md
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-zinc-800/60 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-zinc-300"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800/60 rounded px-1 py-0.5 text-sm font-mono text-cyan-300">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');
}

export function TutorPanel({ open, onToggle, nodeId, question, onQuestionChange, answer: v1Answer, loading: v1Loading, onAsk, tutorConfig, onAddNote }: Props) {
  const [v2Streaming, setV2Streaming] = useState(false);
  const [v2Answer, setV2Answer] = useState('');
  const [v2State, setV2State] = useState<TutorState>('idle');
  const [v2Error, setV2Error] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [lastQuestion, setLastQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const blockIdRef = useRef(`tutor-${nodeId}-${Date.now()}`);
  const supportsV2 = !!(api?.learnTutorStream && api?.onTutorToken);

  const actualState: TutorState = v2Streaming ? 'streaming' : v2State;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Load conversation history when panel opens
  useEffect(() => {
    if (!open || !nodeId || !api?.learnGetConversation) return;
    const loadHistory = async () => {
      try {
        const result = await api.learnGetConversation({ blockId: `tutor-${nodeId}` });
        if (result?.ok && result.messages?.length) {
          const pairs: QAPair[] = [];
          const msgs = result.messages;
          for (let i = 0; i < msgs.length; i++) {
            if (msgs[i].role === 'user') {
              const answerMsg = msgs[i + 1];
              pairs.push({
                question: msgs[i].text,
                answer: answerMsg?.text || '',
                ts: msgs[i].ts,
              });
              if (answerMsg) i++;
            }
          }
          setQaHistory(pairs);
        }
      } catch { /* ignore */ }
    };
    loadHistory();
  }, [open, nodeId]);

  useEffect(() => {
    if (actualState === 'grounded' || actualState === 'out-of-scope' || actualState === 'error') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [actualState, v2Answer]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const handleSubmitV2 = useCallback(async (q: string) => {
    cleanupRef.current?.();
    setV2Streaming(true);
    setV2State('streaming');
    setV2Answer('');
    setV2Error('');
    setLastQuestion(q);
    setShowSuggestions(false);

    const blockId = blockIdRef.current;

    // Save user question to DB
    if (api?.learnAddMessage) {
      api.learnAddMessage({ nodeId, blockId: `tutor-${nodeId}`, role: 'user', text: q }).catch(() => {});
    }

    const unsub = api.onTutorToken((data: { blockId: string; token: string; done: boolean }) => {
      if (data.blockId !== blockId) return;
      if (data.done) {
        setV2Streaming(false);
        setV2Answer(prev => {
          setV2State(prev.length > 0 ? 'grounded' : 'error');
          if (prev.length === 0) {
            setV2Error('Empty response');
          } else {
            // Save AI answer to DB
            if (api?.learnAddMessage) {
              api.learnAddMessage({ nodeId, blockId: `tutor-${nodeId}`, role: 'ai', text: prev }).catch(() => {});
            }
            // Add to local history
            setQaHistory(h => [...h, { question: q, answer: prev, ts: new Date().toISOString() }]);
          }
          return prev;
        });
        return;
      }
      setV2Answer(prev => prev + data.token);
    });
    cleanupRef.current = unsub;

    try {
      const result = await api.learnTutorStream({ nodeId, blockId, question: q, mode: 'ask' });
      if (!result || !result.ok) {
        setV2Streaming(false);
        setV2State('error');
        setV2Error(result?.error || 'Failed to start stream');
      }
    } catch (err: any) {
      setV2Streaming(false);
      setV2State('error');
      setV2Error(err?.message || 'Stream error');
    }
  }, [nodeId]);

  const handleSubmit = useCallback(() => {
    const q = question.trim();
    if (!q) return;
    if (v2Streaming) return;
    onQuestionChange('');
    if (supportsV2) {
      handleSubmitV2(q);
    } else if (onAsk) {
      onAsk(nodeId, q);
      setShowSuggestions(false);
      setLastQuestion(q);
    }
  }, [question, v2Streaming, supportsV2, onAsk, nodeId, onQuestionChange, handleSubmitV2]);

  const cancelStream = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setV2Streaming(false);
    if (v2Answer.length > 0) {
      setV2State('grounded');
    } else {
      setV2State('idle');
    }
  }, [v2Answer]);

  if (!open) {
    return (
      <div className="shrink-0 w-12 border-l border-zinc-800 flex flex-col items-center justify-start pt-4 gap-2">
        <button
          onClick={() => onToggle(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition"
          title="Open Tutor"
          aria-label="Open tutor panel"
        >
          <Brain className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const displayAnswer = v2Answer || v1Answer?.answer_md || '';
  const displayState = supportsV2 ? actualState : (v1Loading ? 'streaming' : v1Answer ? (v1Answer.escalated ? 'out-of-scope' : 'grounded') : 'idle');
  const isStreaming = supportsV2 ? v2Streaming : !!v1Loading;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0 border-l border-zinc-800 bg-zinc-900/30 light:bg-[var(--ws-surface-raised)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-400" />
          Tutor
          {supportsV2 && <span className="px-1 py-0.5 rounded bg-amber-500/15 text-[9px] text-amber-400 font-medium uppercase">V2</span>}
        </span>
        <button
          onClick={() => { onToggle(false); setShowSuggestions(true); setV2State('idle'); setV2Answer(''); }}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition"
          aria-label="Close tutor panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {tutorConfig && (
        <div className="px-4 py-1.5 border-b border-zinc-800/50 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] shrink-0">
          <p className="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500/60" />
            Powered by <span className="text-zinc-400 font-medium">{tutorConfig.provider}</span> · <span className="text-zinc-400 font-medium">{tutorConfig.model}</span>
          </p>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto ws-scroll">
        <AnimatePresence mode="wait">
          {/* Idle state */}
          {displayState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-zinc-200 font-medium">Ask anything about this lesson</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    I'm grounded in the lesson content and can explain, simplify, or go deeper on any concept here.
                  </p>
                </div>
              </div>
              {showSuggestions && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium px-1">Try asking</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { onQuestionChange(s); inputRef.current?.focus(); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Streaming state */}
          {displayState === 'streaming' && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-xs text-zinc-500">Generating...</span>
                </div>
                {supportsV2 && (
                  <button
                    onClick={cancelStream}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-400 transition"
                  >
                    <StopCircle className="w-3 h-3" />
                    Stop
                  </button>
                )}
              </div>
              {displayAnswer && (
                <div className="text-sm text-zinc-200 leading-relaxed" aria-live="polite" dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(renderAnswerHtml(displayAnswer))
                }} />
              )}
              {displayAnswer.length > 0 && (
                <div className="flex gap-1 justify-center pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </motion.div>
          )}

          {/* Grounded answer */}
          {displayState === 'grounded' && v1Answer && !v1Answer.escalated && !supportsV2 && (
            <motion.div
              key="grounded"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-3"
            >
              <div className="text-sm text-zinc-200 leading-relaxed" dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(renderAnswerHtml(v1Answer.answer_md))
              }} />
              {v1Answer.citations.length > 0 && (
                <div className="pt-2 border-t border-zinc-800">
                  <div className="flex flex-wrap gap-1.5">
                    {v1Answer.citations.map((c: any) => (
                      <span key={c.id} className="px-2 py-0.5 rounded-full bg-zinc-800/60 text-[10px] text-zinc-400 border border-zinc-700/40">{c.title}</span>
                    ))}
                  </div>
                </div>
              )}
              {v1Answer.scope && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Scope</span>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800/60 text-[10px] text-zinc-400 border border-zinc-700/40">
                    {v1Answer.scope}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500/60 transition-all duration-500" style={{ width: `${Math.round(v1Answer.confidence * 100)}%` }} />
                </div>
                <span>{Math.round(v1Answer.confidence * 100)}% confidence</span>
              </div>
              {v1Answer.assessment && (
                <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">Assessment:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      v1Answer.assessment.outcome === 'demonstrated' ? 'text-emerald-400 bg-emerald-500/10' :
                      v1Answer.assessment.outcome === 'partial' ? 'text-amber-400 bg-amber-500/10' :
                      'text-zinc-500 bg-zinc-700/30'
                    }`}>
                      {v1Answer.assessment.outcome}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{v1Answer.assessment.rationale}</p>
                  {v1Answer.assessment.suggested_next && (
                    <p className="text-[11px] text-amber-400 mt-1">Next: {v1Answer.assessment.suggested_next}</p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Grounded (V2 or simple V1) */}
          {displayState === 'grounded' && displayAnswer && !(displayState === 'grounded' && v1Answer && !v1Answer.escalated && !supportsV2) && (
            <motion.div
              key="grounded-v2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="text-sm text-zinc-200 leading-relaxed" dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(renderAnswerHtml(displayAnswer))
              }} />
            </motion.div>
          )}

          {/* Out-of-scope */}
          {displayState === 'out-of-scope' && v1Answer && (
            <motion.div
              key="out-of-scope"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-300">Outside scope</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{v1Answer.answer_md}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {v1Answer.citations.map((c: any) => (
                        <span key={c.id} className="px-2 py-0.5 rounded-full bg-zinc-800/60 text-[10px] text-zinc-400 border border-zinc-700/40">{c.title}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => console.log('Expand scope requested')}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition border border-amber-500/30"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Use wider model
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error state */}
          {displayState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-300">Something went wrong</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{v2Error || v1Answer?.answer_md || 'The tutor encountered an error processing your question.'}</p>
                    <button
                      onClick={() => { if (lastQuestion) { if (supportsV2) handleSubmitV2(lastQuestion); else if (onAsk) onAsk(nodeId, lastQuestion); } }}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 text-xs font-medium transition border border-zinc-700/50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Q&A History */}
        {!isStreaming && displayAnswer && displayState === 'grounded' && (
          <div className="border-t border-zinc-800">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition"
            >
              {expanded ? 'Hide' : 'Show'} Q&A history ({qaHistory.length})
              <span className="text-zinc-600">{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
              <div className="px-4 pb-3 space-y-2 max-h-60 overflow-y-auto">
                {qaHistory.map((qa, i) => (
                  <div key={i} className="p-2 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-1">Q</p>
                        <p className="text-xs text-zinc-300 break-words">{qa.question}</p>
                      </div>
                      {onAddNote && (
                        <button
                          onClick={() => onAddNote(`qa-${i}`, `Q: ${qa.question}\n\nA: ${qa.answer}`)}
                          className="shrink-0 p-1 rounded hover:bg-zinc-700/50 text-zinc-600 hover:text-zinc-400 transition"
                          title="Save as note"
                        >
                          <Bookmark className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {qa.answer && (
                      <>
                        <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider mt-2 mb-1">A</p>
                        <div className="text-xs text-zinc-400 leading-relaxed break-words" dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(renderAnswerHtml(qa.answer))
                        }} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask about this node..."
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-sm focus:border-amber-500/50 focus:outline-none placeholder:text-zinc-600 transition"
            disabled={isStreaming}
          />
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || isStreaming}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition border border-amber-500/30"
            aria-label="Ask tutor"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-zinc-600">Press Enter to ask</span>
          {!isStreaming && lastQuestion && displayAnswer && (
            <button
              onClick={handleSubmit}
              className="text-[10px] text-amber-500 hover:text-amber-400 transition"
            >
              Re-ask
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

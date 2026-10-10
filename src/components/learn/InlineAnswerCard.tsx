import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Search, ArrowRight, X, Loader2, Brain, RefreshCw, AlertTriangle } from 'lucide-react';
import DOMPurify from 'dompurify';

export type InlineMode = 'explain' | 'simpler' | 'deeper';

export interface InlineAnswerState {
  mode: InlineMode;
  text: string;
  loading: boolean;
  streamingText: string;
  error?: string;
  blockId: string;
}

interface InlineAnswerCardProps {
  state: InlineAnswerState;
  onClose: () => void;
  onRetry: () => void;
}

const MODE_CONFIG: Record<InlineMode, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  explain: { icon: Lightbulb, label: 'Explanation', colorClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20' },
  simpler: { icon: Search, label: 'Simplified', colorClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/20' },
  deeper: { icon: ArrowRight, label: 'Going Deeper', colorClass: 'text-purple-400', bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/20' },
};

function renderMarkdown(md: string): string {
  return md
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-zinc-800/60 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono text-zinc-300"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800/60 rounded px-1 py-0.5 text-sm font-mono text-cyan-300">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .split(/\n\n+/)
    .map(p => { const t = p.trim(); if (!t) return ''; return `<p>${t.replace(/\n/g, '<br/>')}</p>`; })
    .join('\n');
}

export function InlineAnswerCard({ state, onClose, onRetry }: InlineAnswerCardProps) {
  const config = MODE_CONFIG[state.mode];
  const Icon = config.icon;
  const displayText = state.streamingText;
  const isThinking = state.loading && !displayText;
  const isStreaming = state.loading && !!displayText;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-auto"
      >
        <div className={`rounded-xl border ${config.borderClass} ${config.bgClass} overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700/40">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${config.colorClass}`} />
              <span className="text-sm font-medium text-zinc-200">{config.label}</span>
              {isStreaming && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
            </div>
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition" aria-label="Close answer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 py-2 border-b border-zinc-700/30 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)]">
            <p className="text-xs text-zinc-500 italic leading-relaxed">
              <span className="text-zinc-600">Selected: </span>"{state.text}"
            </p>
          </div>

          <div className="px-4 py-4">
            {state.error ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Something went wrong</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{state.error}</p>
                  </div>
                </div>
                <button onClick={onRetry} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 text-xs font-medium transition border border-zinc-700/50 w-fit">
                  <RefreshCw className="w-3 h-3" /> Try again
                </button>
              </div>
            ) : isThinking ? (
              <div className="flex items-center gap-2.5 py-1">
                <Brain className={`w-4 h-4 ${config.colorClass} animate-pulse`} />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zinc-400">Thinking</span>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            ) : displayText ? (
              <div className="text-sm text-zinc-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(displayText)) }} />
            ) : null}
            {isStreaming && <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-middle" />}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

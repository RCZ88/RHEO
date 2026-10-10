import React, { useState, useCallback } from 'react';
import { Brain, Send, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { TutorBlock as TutorBlockType } from '../../../shared/learn/types';

interface Props {
  block: TutorBlockType;
  nodeId: string;
  onAsk: (blockId: string, question: string) => void;
}

export function TutorBlock({ block, nodeId, onAsk }: Props) {
  const [question, setQuestion] = useState('');
  const isStreaming = block.status === 'streaming';

  const handleSubmit = useCallback(() => {
    if (!question.trim() || isStreaming) return;
    onAsk(block.id, question.trim());
    setQuestion('');
  }, [question, isStreaming, block.id, onAsk]);

  return (
    <div className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]">
        <Brain className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-medium text-zinc-300">Ask about this concept</span>
      </div>

      <div className="p-4 space-y-3">
        {block.answer_md && (
          <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {block.answer_md}
          </div>
        )}

        {block.status === 'streaming' && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating answer...
          </div>
        )}

        {block.status === 'error' && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            Failed to generate answer
          </div>
        )}

        {block.status === 'complete' && block.confidence !== undefined && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Confidence: {Math.round(block.confidence * 100)}%
            {block.suggested_next && (
              <span className="text-amber-400 ml-2">Next: {block.suggested_next}</span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={isStreaming ? 'Waiting for response...' : 'Ask a follow-up...'}
            disabled={isStreaming}
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-xs focus:border-amber-500/50 focus:outline-none placeholder:text-zinc-600 transition disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || isStreaming}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

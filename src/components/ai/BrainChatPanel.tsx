import React, { useState, useRef, useEffect } from 'react';
import { Brain, Send, LoaderCircle, Bot, ChevronDown, ChevronRight, Wrench, AlertTriangle, X } from 'lucide-react';

console.log('%c[BrainChatPanel] v1.0 loaded', 'color: #a78bfa; font-weight: bold');

const SUGGESTIONS = [
  'What does the brain know about my habits?',
  'What did I work on recently?',
  'Summarize my user profile',
  'Any facts about my goals?',
];

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ tool: string; args: any; result: string }>;
  fallback?: boolean;
  error?: boolean;
}

export function BrainChatPanel({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    setInput('');
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    try {
      const res = await (window as any).deskflowAPI?.brainChat?.({ query, history });
      if (!res) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Context Brain chat is not available in this build yet.', error: true }]);
        return;
      }
      if (res.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error}`, error: true }]);
        return;
      }
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.answer || '(no answer returned)',
        toolCalls: res.toolCalls || [],
        fallback: !!res.fallback,
      }]);
    } catch (e: any) {
      console.error('[BrainChatPanel] send failed:', e);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Failed to reach the brain: ${e?.message || 'unknown error'}`, error: true }]);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div
      className="h-full flex flex-col bg-zinc-950 light:bg-white text-zinc-200 overflow-hidden"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800/60 light:border-[var(--ws-border)] bg-gradient-to-r from-violet-500/10 to-transparent shrink-0">
        <Brain size={15} className="text-violet-300" />
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7' }}>Context Brain Chat</div>
          <div style={{ fontSize: 10, color: '#71717a', fontFamily: 'var(--mono)' }}>
            type what context you need — the AI retrieves it from your brain
          </div>
        </div>
        {loading && (
          <LoaderCircle size={14} className="text-violet-300 animate-spin" />
        )}
        <button
          onClick={onClose}
          title="Close"
          className="p-1.5 rounded-lg text-zinc-500 light:text-stone-500 hover:text-white hover:bg-zinc-800 light:bg-stone-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 120 }}>
        {messages.length === 0 && !loading && (
          <div className="text-center py-6 space-y-3">
            <Brain size={28} className="mx-auto text-violet-400/50" />
            <div style={{ fontSize: 11, color: '#71717a' }}>
              Ask for anything stored in your Personal AI Brain —
              episodes, entities, facts, signals and your profile.
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="px-2.5 py-1.5 rounded-full border border-violet-500/25 text-violet-200 hover:bg-violet-500/10 transition-colors"
                  style={{ fontSize: 10.5 }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === 'user'
                ? 'bg-violet-500/20 border border-violet-500/30 text-violet-50'
                : m.error
                  ? 'bg-red-500/10 border border-red-500/30 text-red-200'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
              }`}
              style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {m.role === 'assistant' && !m.error && (
                <div className="flex items-center gap-1.5 mb-1.5" style={{ fontSize: 10, color: '#8b5cf6', fontFamily: 'var(--mono)' }}>
                  <Bot size={11} />
                  <span>BRAIN</span>
                  {m.fallback && (
                    <span className="px-1.5 rounded" style={{ fontSize: 9, color: '#fbbf24', background: 'rgba(251,191,36,.12)' }}>direct retrieval</span>
                  )}
                </div>
              )}
              {m.role === 'assistant' && m.error && (
                <div className="flex items-center gap-1.5 mb-1.5" style={{ fontSize: 10, color: '#f87171', fontFamily: 'var(--mono)' }}>
                  <AlertTriangle size={11} />
                  <span>ERROR</span>
                </div>
              )}
              {m.content}

              {m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800 light:border-[var(--ws-border)]/70 space-y-1">
                  <button
                    onClick={() => setExpandedTools(expandedTools === i ? null : i)}
                    className="flex items-center gap-1 text-violet-300/80 hover:text-violet-200 transition-colors"
                    style={{ fontSize: 10, fontFamily: 'var(--mono)' }}
                  >
                    {expandedTools === i ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <Wrench size={10} />
                    {m.toolCalls.length} tool call{m.toolCalls.length > 1 ? 's' : ''} — {m.toolCalls.map(t => t.tool).join(', ')}
                  </button>
                  {expandedTools === i && m.toolCalls.map((t, ti) => (
                    <div key={ti} className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 light:bg-white px-2 py-1.5 space-y-0.5">
                      <div style={{ fontSize: 10, color: '#a78bfa', fontFamily: 'var(--mono)' }}>
                        {t.tool} {Object.keys(t.args || {}).length > 0 ? JSON.stringify(t.args) : ''}
                      </div>
                      <div className="text-zinc-400 light:text-stone-500 max-h-28 overflow-y-auto" style={{ fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                        {t.result}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 bg-zinc-900 light:bg-white border border-zinc-800 light:border-[var(--ws-border)] flex items-center gap-2" style={{ fontSize: 11, color: '#a1a1aa' }}>
              <LoaderCircle size={13} className="text-violet-300 animate-spin" />
              Retrieving from your brain…
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-zinc-800/60 light:border-[var(--ws-border)]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="What context do you need?"
            rows={1}
            className="flex-1 bg-zinc-900 light:bg-white border border-zinc-800 light:border-[var(--ws-border)] rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 resize-none"
            style={{ fontSize: 12, fontFamily: 'var(--mono)', minHeight: 34 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ fontSize: 11, fontFamily: 'var(--mono)' }}
          >
            <Send size={12} />
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

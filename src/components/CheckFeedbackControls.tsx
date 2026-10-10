import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Send, X } from 'lucide-react';

interface CheckFeedbackControlsProps {
  checkId: string;
  checkDescription: string;
  parentType: 'problem' | 'request';
  parentId: string;
  parentSessionId: string | null;
  parentTerminalId: string | null;
  feedbackMode: 'simple' | 'simple+text' | 'rich';
  existingFeedback?: {
    type: 'approved' | 'rejected' | 'text';
    value?: string;
    timestamp: string;
  };
  onFeedbackSent?: () => void;
}

export default function CheckFeedbackControls({
  checkId,
  checkDescription,
  parentType,
  parentId,
  parentSessionId,
  parentTerminalId,
  feedbackMode,
  existingFeedback,
  onFeedbackSent,
}: CheckFeedbackControlsProps) {
  const [showTextInput, setShowTextInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(!!existingFeedback);

  const sendFeedback = async (type: 'approved' | 'rejected' | 'text', value?: string) => {
    setIsSending(true);
    const timestamp = new Date().toISOString();
    const feedback = { type, value, timestamp };

    try {
      await window.deskflowAPI?.addCheckFeedback?.({
        parentId,
        checkId,
        parentType,
        feedback: { ...feedback, session_id: parentSessionId || undefined, terminal_id: parentTerminalId || undefined },
      });

      if (parentTerminalId) {
        await window.deskflowAPI?.sendCheckFeedbackToTerminal?.({
          terminalId: parentTerminalId,
          checkId,
          checkDescription,
          feedback,
          sessionId: parentSessionId || undefined,
        });
      }

      setSent(true);
      setShowTextInput(false);
      setFeedbackText('');
      onFeedbackSent?.();
    } catch (err) {
      console.error('[CheckFeedback] Failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  if (sent && existingFeedback) {
    const emoji = existingFeedback.type === 'approved' ? '\u2705' : existingFeedback.type === 'rejected' ? '\u274C' : '\uD83D\uDCAC';
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[10px]">{emoji}</span>
        <span className="text-[10px] text-zinc-500">
          {existingFeedback.type === 'approved' ? 'Works' :
           existingFeedback.type === 'rejected' ? "Doesn't work" : existingFeedback.value?.substring(0, 50)}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1">
        <button
          onClick={() => sendFeedback('approved')}
          disabled={isSending}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          <ThumbsUp className="w-2.5 h-2.5" />
          Works
        </button>
        <button
          onClick={() => sendFeedback('rejected')}
          disabled={isSending}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          <ThumbsDown className="w-2.5 h-2.5" />
          No
        </button>

        {feedbackMode !== 'simple' && (
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/50 transition-colors"
          >
            <MessageSquare className="w-2.5 h-2.5" />
            Feedback
          </button>
        )}
      </div>

      {showTextInput && (
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Optional feedback..."
            className="flex-1 text-[10px] bg-zinc-900/70 light:bg-[var(--ws-surface-raised)] border border-zinc-700/50 rounded px-2 py-1 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && feedbackText.trim()) {
                sendFeedback('text', feedbackText.trim());
              }
            }}
          />
          <button
            onClick={() => sendFeedback('text', feedbackText.trim())}
            disabled={!feedbackText.trim() || isSending}
            className="px-1.5 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 disabled:opacity-30 transition-colors"
          >
            <Send className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={() => { setShowTextInput(false); setFeedbackText(''); }}
            className="px-1 py-1 rounded text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}

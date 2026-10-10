import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, RotateCcw } from 'lucide-react';
import type { ConversationBlock as ConversationBlockType, ConversationMessage } from '../../../shared/learn/types';

interface Props {
  block: ConversationBlockType;
  nodeId: string;
  onAddMessage: (blockId: string, text: string) => void;
  onResolve?: (blockId: string) => void;
}

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
        isUser
          ? 'bg-amber-500/20 text-amber-200 border border-amber-500/20'
          : 'bg-zinc-800/60 text-zinc-300 border border-zinc-700/30'
      }`}>
        {msg.text}
        <span className="block text-[10px] text-zinc-600 mt-1">
          {new Date(msg.created_at).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export function ConversationBlock({ block, nodeId, onAddMessage, onResolve }: Props) {
  const [message, setMessage] = useState('');
  const isResolved = block.status === 'resolved';
  const isEmpty = block.messages.length === 0;

  const handleSend = () => {
    if (!message.trim() || isResolved) return;
    onAddMessage(block.id, message.trim());
    setMessage('');
  };

  return (
    <div className="my-4 rounded-xl border border-zinc-800 bg-zinc-900/40 light:bg-[var(--ws-surface-raised)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-medium text-zinc-300">
            Conversation{isResolved ? ' (Resolved)' : ''}
          </span>
          {block.label && (
            <span className="text-[10px] text-zinc-500 ml-1">— {block.label}</span>
          )}
        </div>
        {!isResolved && onResolve && block.messages.length > 1 && (
          <button
            onClick={() => onResolve(block.id)}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition"
          >
            <CheckCircle2 className="w-3 h-3" />
            Resolve
          </button>
        )}
        {isResolved && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <RotateCcw className="w-3 h-3" />
            Closed
          </span>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto p-3 space-y-2">
        {isEmpty ? (
          <p className="text-xs text-zinc-600 text-center py-4">No messages yet. Start the conversation.</p>
        ) : (
          block.messages.map((msg, i) => <MessageBubble key={msg.id || i} msg={msg} />)
        )}
      </div>

      {!isResolved && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 text-xs focus:border-sky-500/50 focus:outline-none placeholder:text-zinc-600 transition"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

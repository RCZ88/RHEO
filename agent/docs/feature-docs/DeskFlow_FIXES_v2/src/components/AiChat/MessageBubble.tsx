import { type FC, type ReactNode, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bot, Copy, Check, User } from 'lucide-react';
import { MOTION } from '../ai/tokens';

type Role = 'user' | 'assistant';

interface MessageBubbleProps {
  role: Role;
  children: ReactNode;
  timestamp?: number;
  content?: string;
}

export const MessageBubble: FC<MessageBubbleProps> = ({ role, children, timestamp, content }) => {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }, [content]);

  const timeStr = timestamp
    ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp)
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: MOTION.normal, ease: MOTION.ease }}
      className={`group flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-6 h-6 rounded-lg shrink-0 grid place-items-center ring-1 mt-0.5 ${
        isUser
          ? 'bg-pink-500/15 ring-pink-500/30'
          : 'bg-zinc-800 ring-zinc-700'
      }`}>
        {isUser ? <User className="h-3.5 w-3.5 text-pink-300" /> : <Bot className="h-3.5 w-3.5 text-zinc-300" />}
      </div>

      <div className={`relative ${isUser ? 'max-w-[80%]' : 'max-w-[85%]'}`}>
        <div className={`relative rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-pink-500/12 ring-1 ring-pink-500/20 text-zinc-100 rounded-tr-sm'
            : 'bg-zinc-900/60 ring-1 ring-zinc-800/60 text-zinc-200 rounded-tl-sm'
        }`}>
          {content && (
            <button
              onClick={handleCopy}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded-md hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {children}
        </div>
        {timeStr && (
          <div className="text-[10px] text-zinc-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {timeStr}
          </div>
        )}
      </div>
    </motion.div>
  );
};

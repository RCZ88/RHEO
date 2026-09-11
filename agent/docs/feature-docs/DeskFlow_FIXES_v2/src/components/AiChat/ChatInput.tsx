import { type FC, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { sanitizeInput, MAX_INPUT_LENGTH } from '../../services/chatSafety';
import { VoiceInputButton } from '../VoiceInputButton';
import type { UseVoiceInput } from '../../hooks/useVoiceInput';

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  voice: UseVoiceInput;
};

export const ChatInput: FC<Props> = ({ onSend, disabled, placeholder, voice }) => {
  const [text, setText] = useState('');
  const [justSent, setJustSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = sanitizeInput(text.trim());
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    setJustSent(true);
    setTimeout(() => setJustSent(false), 600);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleInput = useCallback((value: string) => {
    if (value.length > MAX_INPUT_LENGTH) return;
    setText(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 5 * 24) + 'px';
    }
  }, []);

  const isEmpty = !text.trim();
  const canSend = !disabled && !isEmpty;
  const progress = text.length / MAX_INPUT_LENGTH;
  const circumference = 2 * Math.PI * 7;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <div className="relative bg-zinc-950/60 backdrop-blur-md px-4 py-3">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-500/30 to-transparent pointer-events-none" />
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? 'Ask about your day, manage goals\u2026'}
            className="w-full resize-none bg-zinc-900/70 border border-zinc-800/50 focus:border-pink-400/40 focus:bg-zinc-900/90 rounded-xl pr-4 pl-4 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-500 outline-none transition-all duration-200 focus:ring-2 focus:ring-pink-400/20"
          />
        </div>
        <VoiceInputButton
          voice={voice}
          disabled={disabled}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${
            canSend
              ? justSent
                ? 'bg-emerald-500/80 text-zinc-950'
                : 'bg-pink-500/80 hover:bg-pink-400 text-zinc-950'
              : 'bg-zinc-800/60 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {justSent ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-zinc-600" />
          <span className="text-[10px] font-mono text-zinc-600 tracking-wide">AI-POWERED</span>
        </div>
        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="7" fill="none" stroke="#3f3f46" strokeWidth="2" />
          <circle
            cx="9" cy="9" r="7" fill="none"
            stroke={progress > 0.9 ? '#fbbf24' : '#f472b6'}
            strokeWidth="2" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
          />
        </svg>
      </div>
    </div>
  );
};

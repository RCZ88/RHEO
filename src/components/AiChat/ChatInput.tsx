import { type FC, useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef, type KeyboardEvent } from 'react';
import { Send, Zap } from 'lucide-react';
import { sanitizeInput, MAX_INPUT_LENGTH } from '../../services/chatSafety';
import { VoiceInputButton } from '../VoiceInputButton';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import type { UseVoiceInput } from '../../hooks/useVoiceInput';

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  voice: UseVoiceInput;
  overrideText?: string | null;
  onOverrideConsumed?: () => void;
  onOpenCommands?: () => void;
};

export interface ChatInputHandle {
  appendText: (text: string) => void;
}

export const ChatInput = forwardRef<ChatInputHandle, Props>(({ onSend, disabled, placeholder, voice, overrideText, onOverrideConsumed, onOpenCommands }, ref) => {
  useImperativeHandle(ref, () => ({
    appendText: (t: string) => {
      setText(prev => {
        const next = prev + t;
        return next;
      });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 5 * 24) + 'px';
        }
      }, 0);
    },
  }));
  const [text, setText] = useState('');
  const [justSent, setJustSent] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (overrideText) {
      setText(overrideText);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 5 * 24) + 'px';
        textareaRef.current.focus();
      }
      onOverrideConsumed?.();
    }
  }, [overrideText, onOverrideConsumed]);

  const handleSend = useCallback(() => {
    const trimmed = sanitizeInput(text.trim());
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    setJustSent(true);
    setTimeout(() => setJustSent(false), 250);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
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

  const isSlashCommand = text.startsWith('/');
  const slashMatch = isSlashCommand ? text.match(/^\/(\S*)(.*)$/) : null;
  const slashCommand = slashMatch ? slashMatch[1] : '';
  const slashArgs = slashMatch ? slashMatch[2] : '';

  return (
    <div className="border-t border-zinc-800/60 p-3 bg-zinc-950 light:bg-[var(--ws-surface-60)]">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <div
            className="absolute inset-0 text-sm leading-relaxed px-0.5 py-0 pointer-events-none whitespace-pre-wrap break-words"
            aria-hidden="true"
          >
            {isSlashCommand ? (
              <>
                <span className="text-pink-400 font-medium">/{slashCommand}</span>
                <span className={`text-zinc-100 transition-all duration-500 ${voice.solidifying ? 'voice-solidify' : ''}`}>{slashArgs}</span>
              </>
            ) : (
              <span className={`text-zinc-100 transition-all duration-500 ${voice.solidifying ? 'voice-solidify' : ''}`}>{text}</span>
            )}
            {voice.state === 'listening' && voice.interim && (
              <span className="text-zinc-400/60 animate-pulse">{text ? ' ' : ''}{voice.interim}</span>
            )}
          </div>
          <VoiceInputWrapper>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={1}
              disabled={disabled}
              placeholder={placeholder ?? 'Ask about your day, manage goals, or check your inbox\u2026'}
              className="relative w-full resize-none bg-transparent text-sm text-transparent caret-zinc-100 placeholder:text-zinc-600 focus:outline-none flex-1 leading-relaxed"
              style={{ fieldSizing: 'content' }}
            />
          </VoiceInputWrapper>
        </div>
        <VoiceInputButton voice={voice} disabled={disabled} />
        {onOpenCommands && (
          <button
            onClick={onOpenCommands}
            disabled={disabled}
            className="grid place-items-center rounded-lg w-8 h-8 min-w-[44px] min-h-[44px] p-0 text-zinc-400 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:text-pink-300 hover:ring-pink-500/30 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Manage slash commands"
          >
            <Zap className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`rounded-lg w-8 h-8 min-w-[44px] min-h-[44px] grid place-items-center transition-all duration-150 shrink-0 ${
            canSend
              ? justSent
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-pink-500 text-zinc-950 hover:bg-pink-400'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
          style={canSend && !justSent ? { transform: 'scale(1)' } : undefined}
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
      <div className="flex items-center justify-between mt-1 px-0.5">
        {progress > 0.8 && (
          <div className="flex items-center gap-1.5">
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
        )}
        <span className={`text-[10px] text-zinc-600 transition-opacity duration-150 ${focused ? 'opacity-0' : 'opacity-100'} ml-auto`}>
          \u23ce send \u00b7 \u21e7\u23ce newline
        </span>
      </div>
    </div>
  );
});

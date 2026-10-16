/**
 * VoiceMicButton — Universal microphone button with animated states
 * Idle / Listening / Processing / Error states with clay palette.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2, ChevronDown } from 'lucide-react';
import { BorderBeam } from './ui/border-beam';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../lib/voice-utils';
import type { VoiceState, VoiceError } from '../hooks/useVoiceInput';

interface VoiceMicButtonProps {
  state: VoiceState;
  isActive: boolean;
  disabled?: boolean;
  error?: VoiceError;
  lang: string;
  onToggle: () => void;
  onLangChange?: (lang: string) => void;
  size?: 'sm' | 'md';
  showLangPicker?: boolean;
}

const circumference = 2 * Math.PI * 8;

export function VoiceMicButton({
  state,
  isActive,
  disabled,
  error,
  lang,
  onToggle,
  onLangChange,
  size = 'md',
  showLangPicker = true,
}: VoiceMicButtonProps) {
  const [langOpen, setLangOpen] = useState(false);
  const isListening = state === 'listening';
  const isProcessing = state === 'processing';
  const isError = state === 'error';

  // Silence countdown (default 5s)
  const countdownRatio = 1; // Would come from props in real usage
  const strokeDashoffset = circumference * (1 - countdownRatio);

  const btnSize = size === 'sm' ? 'w-7 h-7 min-w-[36px] min-h-[36px]' : 'w-8 h-8 min-w-[44px] min-h-[44px]';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const label = isListening ? 'Stop voice input' : isError ? 'Voice input error' : 'Start voice input';

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={onToggle}
        disabled={disabled || isProcessing}
        aria-label={label}
        aria-pressed={isListening}
        className={`
          relative grid place-items-center rounded-lg ${btnSize} p-0
          transition-all duration-150
          focus-visible:ring-2 focus-visible:ring-[#e8866b]/60 focus-visible:outline-none
          disabled:opacity-40 disabled:cursor-not-allowed
          ${isListening
            ? 'bg-[#d96846]/15 text-[var(--color-clay-400)] ring-1 ring-[#d96846]/30'
            : isError
              ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/40'
              : 'text-zinc-400 bg-zinc-900/60 light:bg-[var(--ws-surface-raised)] ring-1 ring-zinc-800/60 hover:text-[var(--color-clay-400)] hover:ring-[#d96846]/30'
          }
        `}
        title={label}
      >
        {/* Pulse ring when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-lg animate-pulse-ring pointer-events-none" />
        )}

        {/* Border beam on active */}
        {isListening && <BorderBeam duration={6} size={80} borderWidth={1} colorFrom="#e8866b" colorTo="#d96846" />}

        {/* Icon */}
        {isProcessing ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : isListening ? (
          <Mic className={iconSize} />
        ) : (
          <MicOff className={iconSize} />
        )}

        {/* Countdown ring (SVG) */}
        {isListening && (
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="8" fill="none" stroke="rgba(232,134,107,0.2)" strokeWidth="2" />
            <circle
              cx="11" cy="11" r="8" fill="none"
              stroke={countdownRatio < 0.3 ? '#fbbf24' : '#e8866b'}
              strokeWidth="2" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 100ms linear, stroke 200ms ease' }}
            />
          </svg>
        )}

        {/* Mini sound wave bars when listening */}
        {isListening && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-[1px] h-2 pointer-events-none">
            {[0, 0.15, 0.3].map((delay, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-[var(--color-clay-500-70)] animate-voice-bar"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        )}
      </button>

      {/* Language picker dropdown */}
      {showLangPicker && onLangChange && (
        <div className="relative">
          <button
            onClick={() => setLangOpen(v => !v)}
            className="ml-0.5 p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Change voice language"
            title="Change language"
          >
            <ChevronDown className="h-3 w-3" />
          </button>

          <AnimatePresence>
            {langOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-1 z-50 min-w-[140px] rounded-lg bg-zinc-900/95 light:bg-[var(--ws-surface-raised)] backdrop-blur-xl border border-zinc-700/50 shadow-xl shadow-black/20 py-1"
              >
                {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => {
                      onLangChange(code);
                      setLangOpen(false);
                    }}
                    className={`
                      w-full text-left px-3 py-1.5 text-xs transition-colors
                      ${lang === code
                        ? 'text-[var(--color-clay-400)] bg-[#d96846]/10'
                        : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

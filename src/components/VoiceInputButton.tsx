import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { type UseVoiceInput } from '../hooks/useVoiceInput';
import { MOTION } from './ai/tokens';

interface VoiceInputButtonProps {
  voice: UseVoiceInput;
  disabled?: boolean;
}

const circumference = 2 * Math.PI * 8;

export function VoiceInputButton({ voice, disabled }: VoiceInputButtonProps) {
  if (!voice.supported) return null;

  const isListening = voice.state === 'listening';
  const isProcessing = voice.state === 'processing';
  const isError = voice.state === 'error';
  const isActive = isListening || isProcessing;
  const countdownRatio = voice.countdownMs / 5000;
  const strokeDashoffset = circumference * (1 - countdownRatio);
  const isNearEnd = countdownRatio < 0.3;

  const label = isListening ? 'Listening, tap to stop' : 'Start voice input';
  const shortcutHint = 'Ctrl+Shift+M';

  return (
    <div className="relative">
      <button
        onClick={isListening ? voice.stop : voice.start}
        disabled={disabled || isProcessing}
        aria-label={label}
        aria-pressed={isListening}
        className={`relative grid place-items-center rounded-lg
          w-8 h-8 min-w-[44px] min-h-[44px] p-0
          transition-all duration-150
          focus-visible:ring-2 focus-visible:ring-pink-500/60 focus-visible:outline-none
          disabled:opacity-40 disabled:cursor-not-allowed
          ${isListening
            ? 'bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/30'
            : isError
              ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/40'
              : 'text-zinc-400 bg-zinc-900/60 ring-1 ring-zinc-800/60 hover:text-pink-300 hover:ring-pink-500/30'
          }`}
        title={`${label} (${shortcutHint})`}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <ThinkingOrb
            state={isListening ? 'listening' : 'working'}
            size={32}
            theme="auto"
            color="#f472b6"
            aria-label={label}
          />
        ) : (
          <MicOff className="h-4 w-4" />
        )}

        {isListening && (
          <>
            <span className="absolute inset-0 rounded-lg v-ring pointer-events-none" />
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r="8" fill="none" stroke="rgba(244,114,182,0.2)" strokeWidth="2.5" />
              <circle
                cx="11" cy="11" r="8" fill="none"
                stroke={isNearEnd ? '#fbbf24' : '#f472b6'}
                strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 100ms linear, stroke 200ms ease' }}
              />
            </svg>
          </>
        )}

        {isListening && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-end gap-[1.5px] h-3 pointer-events-none">
            <span className="w-[2px] rounded-full bg-pink-400/70 v-bar" />
            <span className="w-[2px] rounded-full bg-pink-400/70 v-bar" style={{ animationDelay: '0.15s' }} />
            <span className="w-[2px] rounded-full bg-pink-400/70 v-bar" style={{ animationDelay: '0.3s' }} />
          </div>
        )}
      </button>

      <AnimatePresence>
        {isListening && voice.interim && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: MOTION.fast }}
            className="absolute bottom-full right-0 mb-2 z-30"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-lg bg-zinc-900/95 ring-1 ring-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 max-w-[240px]">
              {voice.interim}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
